import { equipmentRoleById } from "./atomRegistry";
import { equipmentById } from "../equipment/catalog";
import {
  compatibleInteractionVerbs,
  interactionOperationTypes,
  interactionStationIds,
} from "./interactions";
import {
  validateCompositionManifest,
  validateLabCompositionSourceShape,
  validateTechniqueCompositionContract,
} from "./compositionValidation";
import { structurallyExclusiveMassOutputIds } from "./bundledCatalogPolicy";
import type {
  ActionDefinition,
  ActionInteractionSpec,
  ActionInteractionType,
  ActionSolidTransferContract,
  ActionVerb,
  BundledLabSourceDefinition,
  EdgeConditionType,
  EquipmentAffordance,
  EquipmentCategory,
  EquipmentDefinition,
  EquipmentInteractionStatus,
  EquipmentLocation,
  LabDefinition,
  LabCompositionSourceDefinition,
  ProcessNodeDisplayState,
  ProcessDefinition,
  ProcessNodeType,
  RuntimeInvalidCase,
  SolidDestinationRepresentation,
  TechniqueDefinition,
  ValidationResult,
  ValidationRule,
  ValidationType,
} from "./types";

export const actionVerbs: readonly ActionVerb[] = [
  "place",
  "weigh",
  "measureVolume",
  "transfer",
  "mix",
  "vent",
  "settle",
  "dissolve",
  "precipitate",
  "dilute",
  "filter",
  "spotSample",
  "developChromatogram",
  "rinse",
  "dry",
  "heat",
  "cool",
  "stressEquilibrium",
  "observe",
  "record",
  "calculate",
  "reset",
];

const endpointRequiredActionVerbs = new Set<ActionVerb>([
  "measureVolume",
  "transfer",
  "dissolve",
  "precipitate",
  "dilute",
  "filter",
  "spotSample",
  "developChromatogram",
  "rinse",
  "heat",
  "cool",
]);

const nodeTypes: readonly ProcessNodeType[] = [
  "technique",
  "action",
  "checkpoint",
  "decision",
  "calculation",
  "observation",
  "teacherNote",
];

const processNodeDisplayStates: readonly ProcessNodeDisplayState[] = ["compact", "expanded"];

export const validationTypes: readonly ValidationType[] = [
  "actionEvidence",
  "measurementRecorded",
  "dataSeriesRecorded",
  "notebookEntry",
  "calculationWithinTolerance",
  "statePath",
  "processCompleted",
];

const edgeConditionTypes: readonly EdgeConditionType[] = [
  "always",
  "validationPassed",
  "retry",
  "calculationResult",
];

const equipmentCategories: readonly EquipmentCategory[] = [
  "measurement",
  "container",
  "filtration",
  "chromatography",
  "heating",
  "reagent",
  "sample",
  "tool",
];

const equipmentAffordances: readonly EquipmentAffordance[] = [
  "draggable",
  "fillable",
  "pourable",
  "measurable",
  "weighable",
  "heatSource",
  "filterTarget",
  "spotTarget",
  "chromatographyChamber",
  "recordable",
];

const equipmentLocations: readonly EquipmentLocation[] = [
  "shelf",
  "workbench",
  "snapZone",
  "oven",
  "storage",
];

const equipmentInteractionStatuses: readonly EquipmentInteractionStatus[] = [
  "free",
  "snapped",
  "locked",
  "inInstrument",
];

type ValidationContext = {
  actionIds?: Set<string>;
  equipmentIds?: Set<string>;
  titrationModelIds?: Set<string>;
  chromatographyModelIds?: Set<string>;
  kineticsModelIds?: Set<string>;
  kineticsConditionIdsByModelId?: Map<string, Set<string>>;
  dataSeriesIds?: Set<string>;
  allowExternalProcessStart?: boolean;
  allowEmptyProcessNodes?: boolean;
  compositionOwnedLegacyActionIds?: Set<string>;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

export const forbiddenPublicJsonFields = [
  "assetPath",
  "assetUrl",
  "assetHash",
  "resolvedAssetUrl",
  "blobUrl",
  "hash",
  "fileId",
  "naturalWidth",
  "naturalHeight",
  "imageElement",
  "runtimeId",
  "generatedAssetPath",
  "_runtime",
  "_resolved",
] as const;

export const findForbiddenPublicJsonFields = (
  input: unknown,
  path = "$",
): string[] => {
  if (Array.isArray(input)) {
    return input.flatMap((item, index) => findForbiddenPublicJsonFields(item, `${path}[${index}]`));
  }
  if (!isObject(input)) return [];

  return Object.entries(input).flatMap(([key, value]) => {
    const currentPath = `${path}.${key}`;
    const ownError = forbiddenPublicJsonFields.includes(
      key as (typeof forbiddenPublicJsonFields)[number],
    )
      ? [`${currentPath} is runtime-only and must not be serialized in public JSON.`]
      : [];
    return [...ownError, ...findForbiddenPublicJsonFields(value, currentPath)];
  });
};

export const validatePublicJsonForPublishing = (input: unknown): ValidationResult<unknown> => {
  const errors = findForbiddenPublicJsonFields(input);
  return errors.length === 0 ? { ok: true, value: input, errors: [] } : { ok: false, errors };
};

const requireString = (
  errors: string[],
  value: unknown,
  path: string,
): value is string => {
  if (!isString(value)) {
    errors.push(`${path} must be a non-empty string.`);
    return false;
  }
  return true;
};

const requireNumber = (errors: string[], value: unknown, path: string): value is number => {
  if (!isNumber(value)) {
    errors.push(`${path} must be a finite number.`);
    return false;
  }
  return true;
};

const validateMassContinuity = (
  input: unknown,
  path: string,
  errors: string[],
  consumer: boolean,
): void => {
  if (!isObject(input)) {
    errors.push(`${path} must be a typed continuity contract.`);
    return;
  }
  if (input.version !== 1) errors.push(`${path}.version must be 1.`);
  if (input.quantityKind !== "balance-display" && input.quantityKind !== "material-portion") {
    errors.push(`${path}.quantityKind must be balance-display or material-portion.`);
  }
  requireString(errors, input.measuredSupportInstanceId, `${path}.measuredSupportInstanceId`);
  if (input.quantityKind === "material-portion") {
    requireString(errors, input.materialSourceInstanceId, `${path}.materialSourceInstanceId`);
  } else if (input.materialSourceInstanceId !== undefined) {
    errors.push(`${path}.materialSourceInstanceId is legal only for material-portion evidence.`);
  }
  if (consumer) requireString(errors, input.producerActionId, `${path}.producerActionId`);
  const allowed = new Set([
    "version",
    "quantityKind",
    "measuredSupportInstanceId",
    "materialSourceInstanceId",
    ...(consumer ? ["producerActionId"] : []),
  ]);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) errors.push(`${path} contains unsupported field "${key}".`);
  }
};

const validateMetadata = (
  input: unknown,
  path: string,
  errors: string[],
): void => {
  if (!isObject(input)) {
    errors.push(`${path} is required.`);
    return;
  }
  requireString(errors, input.version, `${path}.version`);
  requireString(errors, input.author, `${path}.author`);
  requireString(errors, input.updatedAt, `${path}.updatedAt`);
  if (!isStringArray(input.tags)) errors.push(`${path}.tags must be a string array.`);
};

const validateRule = (
  input: unknown,
  path: string,
  errors: string[],
  context: ValidationContext,
): input is ValidationRule => {
  if (!isObject(input)) {
    errors.push(`${path} must be an object.`);
    return false;
  }
  requireString(errors, input.id, `${path}.id`);
  if (!validationTypes.includes(input.type as ValidationType)) {
    errors.push(`${path}.type must be a supported validation type.`);
  }
  requireString(errors, input.label, `${path}.label`);

  if (input.type === "actionEvidence") {
    if (requireString(errors, input.actionId, `${path}.actionId`) && context.actionIds && !context.actionIds.has(input.actionId)) {
      errors.push(`${path}.actionId must reference an existing action.`);
    }
    if (input.requireCurrentEvidenceScope !== undefined && !isBoolean(input.requireCurrentEvidenceScope)) {
      errors.push(`${path}.requireCurrentEvidenceScope must be a boolean.`);
    }
  } else if (input.requireCurrentEvidenceScope !== undefined) {
    errors.push(`${path}.requireCurrentEvidenceScope is legal only on actionEvidence rules.`);
  }
  if (input.type === "measurementRecorded") {
    requireString(errors, input.measurementId, `${path}.measurementId`);
    if (input.measurementContinuity !== undefined) {
      validateMassContinuity(input.measurementContinuity, `${path}.measurementContinuity`, errors, true);
    }
  } else if (input.measurementContinuity !== undefined) {
    errors.push(`${path}.measurementContinuity is legal only on measurementRecorded rules.`);
  }
  if (input.type === "dataSeriesRecorded") {
    if (
      requireString(errors, input.dataSeriesId, `${path}.dataSeriesId`) &&
      context.dataSeriesIds &&
      !context.dataSeriesIds.has(input.dataSeriesId)
    ) {
      errors.push(`${path}.dataSeriesId must reference an authored data series.`);
    }
  }
  if (input.type === "notebookEntry") {
    requireString(errors, input.notebookTag, `${path}.notebookTag`);
  }
  if (input.type === "calculationWithinTolerance") {
    requireString(errors, input.calculationId, `${path}.calculationId`);
    if (input.tolerance !== undefined) requireNumber(errors, input.tolerance, `${path}.tolerance`);
  }
  if (input.type === "statePath") {
    requireString(errors, input.path, `${path}.path`);
    if (
      input.equals !== undefined &&
      !isString(input.equals) &&
      !isNumber(input.equals) &&
      !isBoolean(input.equals)
    ) {
      errors.push(`${path}.equals must be a string, number, boolean, or omitted.`);
    }
  }
  return true;
};

const validateRuleArray = (
  input: unknown,
  path: string,
  errors: string[],
  context: ValidationContext,
): void => {
  if (!Array.isArray(input)) {
    errors.push(`${path} must be an array.`);
    return;
  }
  input.forEach((rule, index) => validateRule(rule, `${path}[${index}]`, errors, context));
};

const validateInvalidCase = (
  input: unknown,
  path: string,
  errors: string[],
): input is RuntimeInvalidCase => {
  if (!isObject(input)) {
    errors.push(`${path} must be an object.`);
    return false;
  }
  requireString(errors, input.id, `${path}.id`);
  requireString(errors, input.when, `${path}.when`);
  requireString(errors, input.message, `${path}.message`);
  requireString(errors, input.recovery, `${path}.recovery`);
  return true;
};

const validateParameterMap = (input: unknown, path: string, errors: string[]): void => {
  if (!isObject(input)) {
    errors.push(`${path} must be an object.`);
    return;
  }
  Object.entries(input).forEach(([key, value]) => {
    const valid =
      value === undefined ||
      isString(value) ||
      isNumber(value) ||
      isBoolean(value) ||
      isStringArray(value);
    if (!valid) errors.push(`${path}.${key} must be a string, number, boolean, string array, or omitted.`);
  });
};

const validateActionVolumeContract = (
  input: Record<string, unknown>,
  path: string,
  errors: string[],
  actionVerb: ActionVerb | undefined,
): void => {
  if (input.volume === undefined) return;
  const volumePath = `${path}.volume`;
  if (!isObject(input.volume)) {
    errors.push(`${volumePath} must be a typed volume contract.`);
    return;
  }
  if (!actionVerb || !["measureVolume", "transfer", "dilute"].includes(String(actionVerb))) {
    errors.push(`${volumePath} is legal only on measureVolume, transfer, or dilute actions.`);
  }
  const source = input.volume.source;
  const supported = [
    "action-input", "literal", "measurement", "calculation",
    "target-fill-fraction", "target-remaining-capacity",
  ];
  if (!supported.includes(String(source))) {
    errors.push(`${volumePath}.source is not supported.`);
    return;
  }
  if (source === "literal") {
    if (!isNumber(input.volume.valueMl) || input.volume.valueMl <= 0) {
      errors.push(`${volumePath}.valueMl must be a positive finite number.`);
    }
  } else if (input.volume.valueMl !== undefined) {
    errors.push(`${volumePath}.valueMl is legal only for a literal source.`);
  }
  if (source === "measurement" || source === "calculation") {
    requireString(errors, input.volume.referenceId, `${volumePath}.referenceId`);
  } else if (input.volume.referenceId !== undefined) {
    errors.push(`${volumePath}.referenceId is legal only for measurement or calculation sources.`);
  }
  if (source === "target-fill-fraction") {
    if (!isNumber(input.volume.fraction) || input.volume.fraction <= 0 || input.volume.fraction > 1) {
      errors.push(`${volumePath}.fraction must be greater than 0 and no greater than 1.`);
    }
  } else if (input.volume.fraction !== undefined) {
    errors.push(`${volumePath}.fraction is legal only for target-fill-fraction.`);
  }
  if (input.volume.outputMeasurementId !== undefined) {
    requireString(errors, input.volume.outputMeasurementId, `${volumePath}.outputMeasurementId`);
    if (actionVerb !== "measureVolume") {
      errors.push(`${volumePath}.outputMeasurementId is legal only on measureVolume actions.`);
    }
  }
  if (source === "action-input" && isObject(input.parameters) && input.parameters.inputMode !== "numeric") {
    errors.push(`${volumePath} action-input requires parameters.inputMode "numeric".`);
  }
  if (isObject(input.parameters)) {
    const parameters = input.parameters;
    const legacyVolumeFields = ["volumeMl", "targetVolumeMl", "finalVolumeMl"].filter(
      (key) => parameters[key] !== undefined,
    );
    if (legacyVolumeFields.length > 0) {
      errors.push(`${volumePath} cannot be combined with legacy parameter volume source${legacyVolumeFields.length === 1 ? "" : "s"} ${legacyVolumeFields.join(", ")}.`);
    }
    if (source !== "action-input" && parameters.inputMode === "numeric") {
      errors.push(`${volumePath} cannot combine a ${String(source)} source with parameters.inputMode "numeric"; use source "action-input" for learner-entered volume.`);
    }
  }
  const allowed = new Set(["source", "valueMl", "referenceId", "fraction", "outputMeasurementId"]);
  for (const key of Object.keys(input.volume)) {
    if (!allowed.has(key)) errors.push(`${volumePath} contains unsupported field "${key}".`);
  }
};

const validateActionMassContract = (
  input: Record<string, unknown>,
  path: string,
  errors: string[],
  actionVerb: ActionVerb | undefined,
): void => {
  if (input.mass === undefined) return;
  const massPath = `${path}.mass`;
  if (!isObject(input.mass)) {
    errors.push(`${massPath} must be a typed mass contract.`);
    return;
  }
  if (input.mass.source === "configured-input") {
    if (actionVerb !== "transfer") errors.push(`${massPath} configured-input is legal only on transfer actions.`);
    if (!isObject(input.parameters) || input.parameters.inputMode !== "numeric" || input.parameters.inputRole !== "teacherConfiguration") {
      errors.push(`${massPath} configured-input requires numeric teacherConfiguration input.`);
    }
    if (Object.keys(input.mass).some((key) => key !== "source")) errors.push(`${massPath} configured-input cannot declare measurement outputs or inventory overrides.`);
  } else if (input.mass.source === "action-input") {
    if (actionVerb !== "weigh") errors.push(`${massPath} action-input is legal only on weigh actions.`);
    requireString(errors, input.mass.outputMeasurementId, `${massPath}.outputMeasurementId`);
    if (isObject(input.parameters) && input.parameters.inputMode !== "numeric") {
      errors.push(`${massPath} action-input requires parameters.inputMode "numeric".`);
    }
    if (input.mass.applyToSourceInventory !== undefined && !isBoolean(input.mass.applyToSourceInventory)) {
      errors.push(`${massPath}.applyToSourceInventory must be boolean when supplied.`);
    }
    if (input.mass.confirmLatestMeasurementIds !== undefined) {
      if (!Array.isArray(input.mass.confirmLatestMeasurementIds) || input.mass.confirmLatestMeasurementIds.length === 0 || input.mass.confirmLatestMeasurementIds.some((id) => !isString(id))) errors.push(`${massPath}.confirmLatestMeasurementIds must be nonempty measurement IDs.`);
      requireString(errors, input.mass.toleranceMeasurementId, `${massPath}.toleranceMeasurementId`);
      requireString(errors, input.mass.noRepeatCalculationId, `${massPath}.noRepeatCalculationId`);
    } else if (input.mass.toleranceMeasurementId !== undefined) errors.push(`${massPath}.toleranceMeasurementId requires confirmation measurements.`);
    if (input.mass.continuity !== undefined) {
      validateMassContinuity(input.mass.continuity, `${massPath}.continuity`, errors, false);
    }
  } else if (input.mass.source === "measurement") {
    if (actionVerb !== "transfer" && !(actionVerb === "record" && input.mass.continuity !== undefined)) {
      errors.push(`${massPath} measurement is legal only on transfer actions, or on continuity-aware record actions.`);
    }
    requireString(errors, input.mass.referenceId, `${massPath}.referenceId`);
    if (input.mass.outputMeasurementId !== undefined || input.mass.applyToSourceInventory !== undefined || input.mass.confirmLatestMeasurementIds !== undefined || input.mass.toleranceMeasurementId !== undefined || input.mass.noRepeatCalculationId !== undefined) {
      errors.push(`${massPath} measurement source cannot declare outputMeasurementId or applyToSourceInventory.`);
    }
    if (input.mass.continuity !== undefined) {
      validateMassContinuity(input.mass.continuity, `${massPath}.continuity`, errors, true);
    }
  } else {
    errors.push(`${massPath}.source must be action-input, configured-input or measurement.`);
  }
  const allowed = new Set(["source", "referenceId", "outputMeasurementId", "applyToSourceInventory", "confirmLatestMeasurementIds", "toleranceMeasurementId", "noRepeatCalculationId", "continuity"]);
  for (const key of Object.keys(input.mass)) {
    if (!allowed.has(key)) errors.push(`${massPath} contains unsupported field "${key}".`);
  }
};

const solidTransferModes: readonly ActionSolidTransferContract["mode"][] = ["measured-portion", "whole-remaining"];

const solidDestinationRepresentations: readonly SolidDestinationRepresentation[] = ["physical", "qualitative-unknown"];

/**
 * The one deferred authored form the composition compiler resolves, copied from the placeholder in
 * `src/data/compileLabComposition.ts`. Only the shape can be checked here: the slot is bound by the
 * lab that composes the technique, so the resolved number is an execution-time fact.
 */
const configuredSlotReference = /^\{\{config\.[a-zA-Z0-9_-]+\}\}$/;

/**
 * Authored solid-transfer contract, refused before an action can enter a compiled definition.
 *
 * The reducer's solid path already refuses the physical contradictions this contract can express: a
 * whole-solid delivery that also names a measured mass, and a non-empty-source requirement that
 * never declares the whole-solid delivery (`src/runtime/reducer.ts`, the transfer branch). Both are
 * runtime failures a learner meets mid-run, so the same contradictions are refused here while they
 * are still authored text.
 *
 * Runtime qualitative provenance is deliberately not checked. A provenance record is built from
 * resolved instance state and supplied to the shared transfer helper on its runtime request
 * (`SolidTransferRequest.provenance`), so authored content can never carry one.
 */
const validateSolidTransferContract = (
  input: Record<string, unknown>,
  path: string,
  errors: string[],
  actionVerb: ActionVerb | undefined,
): void => {
  if (input.solidTransfer === undefined) return;
  const solidPath = `${path}.solidTransfer`;
  if (!isObject(input.solidTransfer)) {
    errors.push(`${solidPath} must be a typed solid transfer contract.`);
    return;
  }
  const contract = input.solidTransfer;
  // The `transfer` verb also reaches a `dispenseDrops` endpoint, which dispenses drop volumes, and a
  // `recordNotebook` endpoint, which carries fraction and drain bookkeeping. Neither pours a solid
  // from one container into another, and `pourInto` is the only endpoint whose intent the reducer's
  // physical solid path implements, so the contract is restricted to that pair.
  if (actionVerb !== "transfer" || !isObject(input.interaction) || input.interaction.type !== "pourInto") {
    errors.push(`${solidPath} is legal only on transfer actions with a pourInto interaction.`);
  }
  const mode = solidTransferModes.includes(contract.mode as ActionSolidTransferContract["mode"])
    ? (contract.mode as ActionSolidTransferContract["mode"])
    : undefined;
  if (!mode) errors.push(`${solidPath}.mode must be measured-portion or whole-remaining.`);
  // An omitted representation is the physical form every existing solid consumer already reads;
  // nothing about that form changes here. A stated `null` is not an omission.
  const representation = contract.destinationRepresentation === undefined
    ? "physical"
    : contract.destinationRepresentation;
  if (!solidDestinationRepresentations.includes(representation as SolidDestinationRepresentation)) {
    errors.push(`${solidPath}.destinationRepresentation must be physical or qualitative-unknown.`);
  }
  if (contract.requireNonEmptySource !== undefined && !isBoolean(contract.requireNonEmptySource)) {
    errors.push(`${solidPath}.requireNonEmptySource must be boolean when supplied.`);
  }
  if (mode === "measured-portion" && contract.requireNonEmptySource !== undefined) {
    errors.push(`${solidPath}.requireNonEmptySource is legal only on whole-remaining transfers.`);
  }
  // A destination that carries no `massG` is truthful only when the whole of a source known to hold
  // material moved into it. A measured portion has a mass to write instead, and a source allowed to
  // be empty would let a completed transfer claim provenance for material that never moved.
  if (representation === "qualitative-unknown" && (mode !== "whole-remaining" || contract.requireNonEmptySource !== true)) {
    errors.push(`${solidPath} qualitative-unknown requires a whole-remaining transfer with requireNonEmptySource true.`);
  }
  const authoredMassG = isObject(input.parameters) ? input.parameters.massG : undefined;
  if (mode === "whole-remaining") {
    // The delivered amount is the source's own resolved inventory, so a second declared amount names
    // a contradictory quantity that the source inventory would silently win over.
    if (input.mass !== undefined) errors.push(`${solidPath} whole-remaining cannot also declare a mass contract.`);
    if (authoredMassG !== undefined) errors.push(`${solidPath} whole-remaining cannot also declare parameters.massG.`);
  }
  if (mode === "measured-portion") {
    // Exactly one amount authority. `add-carbonate-sample` keeps a single plan-target
    // `parameters.massG` reference and no mass contract, because the AP source loads a planned
    // mixture mass and reads the actual loaded mass separately; a weighed portion keeps its mass
    // contract and no parameter amount. A contract declaring both leaves the handler to choose.
    const configuredAmount = isString(authoredMassG) && configuredSlotReference.test(authoredMassG);
    const literalAmount = isNumber(authoredMassG) && authoredMassG > 0;
    if (authoredMassG !== undefined && !configuredAmount && !literalAmount) {
      errors.push(`${path}.parameters.massG must be a positive finite number or a "{{config.<slot>}}" reference.`);
    }
    if (input.mass !== undefined && authoredMassG !== undefined) {
      errors.push(`${solidPath} measured-portion cannot take its amount from both a mass contract and parameters.massG.`);
    } else if (input.mass === undefined && authoredMassG === undefined) {
      errors.push(`${solidPath} measured-portion requires a mass contract or a parameters.massG amount.`);
    }
  }
  // `emptyRemainingSolid` is the legacy whole-solid flag and `requireNonEmptySolidSource` its
  // required-first-delivery companion; the reducer refuses the second without the first. Shipped
  // content still carries the pair (hand-warmer P1-22, brass sample loading), so a legacy pair that
  // normalizes to the same typed mode stays an accepted compatibility input for the migration. Only
  // a legacy declaration that would drive a different mode, deny the typed non-empty-source
  // obligation, or add a quantity the whole-solid path ignores is refused.
  if (isObject(input.parameters)) {
    const legacyWholeRemaining = input.parameters.emptyRemainingSolid === true;
    const legacyRequireNonEmpty = input.parameters.requireNonEmptySolidSource === true;
    if (legacyRequireNonEmpty && !legacyWholeRemaining) {
      errors.push(`${path}.parameters.requireNonEmptySolidSource requires the legacy emptyRemainingSolid delivery.`);
    }
    if (mode === "measured-portion" && (legacyWholeRemaining || legacyRequireNonEmpty)) {
      errors.push(`${solidPath} measured-portion competes with legacy parameters that declare a whole-remaining solid delivery.`);
    }
    if (legacyRequireNonEmpty && contract.requireNonEmptySource !== true) {
      errors.push(`${solidPath} requireNonEmptySource must be true when legacy parameters.requireNonEmptySolidSource is true.`);
    }
    if (legacyWholeRemaining && authoredMassG !== undefined) {
      errors.push(`${path}.parameters.massG cannot accompany a legacy whole-solid transfer.`);
    }
  }
  const allowed = new Set(["mode", "destinationRepresentation", "requireNonEmptySource"]);
  for (const key of Object.keys(contract)) {
    if (!allowed.has(key)) errors.push(`${solidPath} contains unsupported field "${key}".`);
  }
};

const validateEvidenceReference = (value: unknown, path: string, errors: string[]): void => {
  if (!isObject(value)) {
    errors.push(`${path} must be a typed evidence reference.`);
    return;
  }
  if (value.source !== "measurement" && value.source !== "calculation") {
    errors.push(`${path}.source must be measurement or calculation.`);
  }
  requireString(errors, value.referenceId, `${path}.referenceId`);
  for (const key of Object.keys(value)) if (key !== "source" && key !== "referenceId") {
    errors.push(`${path} contains unsupported field "${key}".`);
  }
};

const validateActionContract15 = (
  input: Record<string, unknown>, path: string, errors: string[], actionVerb: ActionVerb | undefined,
): void => {
  if (input.analysis !== undefined) {
    const p = `${path}.analysis`;
    if (!isObject(input.analysis)) errors.push(`${p} must be a typed analysis contract.`);
    else {
      const analysis = input.analysis;
      if (actionVerb !== "calculate") errors.push(`${p} is legal only on calculate actions.`);
      const allowedByType: Record<string, Set<string>> = {
        massDifferenceWithinTolerance: new Set(["type", "firstMassMeasurementId", "secondMassMeasurementId", "toleranceMeasurementId", "comparison", "outputCalculationId"]),
        mixedEvidenceRegression: new Set(["type", "pairs", "xUnit", "yUnit", "outputCalculationId"]),
        unaryEvidenceTransform: new Set(["type", "input", "operation", "outputUnit", "outputCalculationId"]),
        concentrationFromRegression: new Set(["type", "response", "regressionCalculationId", "outputUnit", "outputCalculationId"]),
        molarConcentrationToMass: new Set(["type", "concentration", "solutionVolumeMeasurementId", "molarMassMeasurementId", "outputCalculationId"]),
      };
      const allowed = allowedByType[String(analysis.type)];
      if (!allowed) errors.push(`${p}.type is not supported.`);
      else for (const key of Object.keys(analysis)) if (!allowed.has(key)) errors.push(`${p} contains unsupported field "${key}".`);
      requireString(errors, analysis.outputCalculationId, `${p}.outputCalculationId`);
      if (analysis.type === "massDifferenceWithinTolerance") {
        for (const key of ["firstMassMeasurementId", "secondMassMeasurementId", "toleranceMeasurementId"]) requireString(errors, analysis[key], `${p}.${key}`);
        if (analysis.firstMassMeasurementId === analysis.secondMassMeasurementId) errors.push(`${p} requires distinct successive mass measurements.`);
        if (!["below", "atOrBelow"].includes(String(analysis.comparison))) errors.push(`${p}.comparison is unsupported.`);
      } else if (analysis.type === "mixedEvidenceRegression") {
        if (!Array.isArray(analysis.pairs) || analysis.pairs.length < 2) errors.push(`${p}.pairs must contain at least two evidence pairs.`);
        else analysis.pairs.forEach((pair, index) => {
          if (!isObject(pair)) errors.push(`${p}.pairs[${index}] must contain x and y evidence references.`);
          else {
            validateEvidenceReference(pair.x, `${p}.pairs[${index}].x`, errors);
            validateEvidenceReference(pair.y, `${p}.pairs[${index}].y`, errors);
            for (const key of Object.keys(pair)) if (key !== "x" && key !== "y") errors.push(`${p}.pairs[${index}] contains unsupported field "${key}".`);
          }
        });
        requireString(errors, analysis.xUnit, `${p}.xUnit`);
        requireString(errors, analysis.yUnit, `${p}.yUnit`);
      } else if (analysis.type === "unaryEvidenceTransform") {
        validateEvidenceReference(analysis.input, `${p}.input`, errors);
        if (!["identity", "reciprocal", "log10", "negativeLog10", "power10"].includes(String(analysis.operation))) {
          errors.push(`${p}.operation is not supported.`);
        }
        requireString(errors, analysis.outputUnit, `${p}.outputUnit`);
      } else if (analysis.type === "concentrationFromRegression") {
        validateEvidenceReference(analysis.response, `${p}.response`, errors);
        requireString(errors, analysis.regressionCalculationId, `${p}.regressionCalculationId`);
        requireString(errors, analysis.outputUnit, `${p}.outputUnit`);
      } else if (analysis.type === "molarConcentrationToMass") {
        validateEvidenceReference(analysis.concentration, `${p}.concentration`, errors);
        requireString(errors, analysis.solutionVolumeMeasurementId, `${p}.solutionVolumeMeasurementId`);
        requireString(errors, analysis.molarMassMeasurementId, `${p}.molarMassMeasurementId`);
      }
      if (isObject(input.parameters) && input.parameters.template !== undefined) {
        errors.push(`${p} cannot be combined with a legacy parameters.template calculation.`);
      }
    }
  }
  if (input.runtimeRepeat !== undefined) {
    const p = `${path}.runtimeRepeat`;
    if (!isObject(input.runtimeRepeat)) errors.push(`${p} must be a typed runtime repeat contract.`);
    else {
      if (!["observe", "record"].includes(String(actionVerb))) errors.push(`${p} is legal only on acquisition actions.`);
      requireString(errors, input.runtimeRepeat.countMeasurementId, `${p}.countMeasurementId`);
      requireString(errors, input.runtimeRepeat.outputMeasurementId, `${p}.outputMeasurementId`);
      requireString(errors, input.runtimeRepeat.progressId, `${p}.progressId`);
      for (const key of Object.keys(input.runtimeRepeat)) if (!["countMeasurementId", "outputMeasurementId", "progressId"].includes(key)) errors.push(`${p} contains unsupported field "${key}".`);
    }
  }
  if (input.sourceInventory !== undefined) {
    const p = `${path}.sourceInventory`;
    if (!isObject(input.sourceInventory)) errors.push(`${p} must be a typed source inventory contract.`);
    else {
      if (actionVerb !== "observe") errors.push(`${p} is legal only on observe inventory-acquisition actions.`);
      // An omitted discriminator is the historical liquid-volume contract; nothing about that form
      // changes here. Only an explicit "solid-mass" selects the gram variant.
      const inventoryQuantityKind = input.sourceInventory.quantityKind ?? "liquid-volume";
      if (inventoryQuantityKind !== "liquid-volume" && inventoryQuantityKind !== "solid-mass") {
        errors.push(`${p}.quantityKind must be liquid-volume or solid-mass.`);
      }
      const solidInventory = inventoryQuantityKind === "solid-mass";
      requireString(errors, input.sourceInventory.outputMeasurementId, `${p}.outputMeasurementId`);
      if (requireString(errors, input.sourceInventory.sourceDefinitionId, `${p}.sourceDefinitionId`)) {
        const sourceDefinition = equipmentById.get(input.sourceInventory.sourceDefinitionId);
        if (!sourceDefinition) errors.push(`${p}.sourceDefinitionId references unknown equipment.`);
        else if (solidInventory) {
          // Grams are never checked against an mL capacity, so the solid form asks the definition
          // for the two things that actually matter: it can hold a solid, and it can pour one out.
          if (!sourceDefinition.allowedContents.includes("solid")) {
            errors.push(`${p}.sourceDefinitionId must reference equipment that may hold a solid.`);
          }
          if (!sourceDefinition.affordances.includes("pourable")) {
            errors.push(`${p}.sourceDefinitionId must reference pourable equipment for a solid stock.`);
          }
        } else if (sourceDefinition.capacity.unit !== "mL" || !Number.isFinite(sourceDefinition.capacity.amount) || sourceDefinition.capacity.amount <= 0) {
          errors.push(`${p}.sourceDefinitionId must reference equipment with a positive mL capacity.`);
        }
      }
      if (solidInventory) {
        // The runtime keys its one-initialization-per-physical-setup lifecycle marker to the
        // resolved source instance, so the solid form must name that instance rather than letting
        // the reducer take the first container of the definition.
        requireString(errors, input.sourceInventory.sourceInstanceId, `${p}.sourceInstanceId`);
        requireString(errors, input.sourceInventory.materialSoluteId, `${p}.materialSoluteId`);
        requireString(errors, input.sourceInventory.materialLabel, `${p}.materialLabel`);
        if (!isObject(input.parameters) || input.parameters.unit !== "g") errors.push(`${p} requires parameters.unit "g" for a configured solid mass.`);
        if (input.mass !== undefined) errors.push(`${p} cannot be combined with a mass contract.`);
      } else {
        for (const key of ["materialSoluteId", "materialLabel"] as const) {
          if (input.sourceInventory[key] !== undefined) errors.push(`${p}.${key} is legal only for a solid-mass inventory.`);
        }
      }
      if (!isObject(input.parameters) || input.parameters.inputMode !== "numeric") errors.push(`${p} requires parameters.inputMode "numeric".`);
      if (!isObject(input.parameters) || input.parameters.inputRole !== "teacherConfiguration") errors.push(`${p} requires parameters.inputRole "teacherConfiguration".`);
      if (isObject(input.parameters) && input.parameters.configuredValue !== undefined && (!isNumber(input.parameters.configuredValue) || input.parameters.configuredValue <= 0)) errors.push(`${p} configuredValue must be a positive finite ${solidInventory ? "gram" : "mL"} value.`);
      if (input.volume !== undefined) errors.push(`${p} cannot be combined with a volume contract.`);
      const inventoryKeys = ["quantityKind", "sourceInstanceId", "sourceDefinitionId", "outputMeasurementId", ...(solidInventory ? ["materialSoluteId", "materialLabel"] : [])];
      for (const key of Object.keys(input.sourceInventory)) if (!inventoryKeys.includes(key)) errors.push(`${p} contains unsupported field "${key}".`);
    }
  }
  if (["mix", "vent", "settle"].includes(String(actionVerb)) && input.extractionOperation === undefined && !["mix", "practice-mix"].includes(stringRecordField(input.parameters, "titrationOperation") ?? "")) errors.push(`${path} requires extractionOperation for this verb.`);
  for (const field of ["extractionOperation", "extractionObservation", "extractionDrain"] as const) {
    if (input[field] === undefined) continue;
    const contract = input[field]; const p = `${path}.${field}`;
    if (!isObject(contract)) { errors.push(`${p} must be a typed extraction contract.`); continue; }
    requireString(errors, contract.vesselInstanceId, `${p}.vesselInstanceId`);
    if ([input.extractionOperation, input.extractionObservation, input.extractionDrain].filter((item) => item !== undefined).length !== 1 || input.materialTransition !== undefined || input.choiceObservation !== undefined) errors.push(`${p} cannot combine with another extraction or competing transition contract.`);
    const allowed = field === "extractionOperation" ? ["operation", "vesselInstanceId", "requiredControlActionIds"] : ["vesselInstanceId"];
    for (const key of Object.keys(contract)) if (!allowed.includes(key)) errors.push(`${p} contains unsupported field "${key}".`);
    if (field === "extractionOperation") {
      if (input.atomId !== `atom.${String(contract.operation)}.extraction-funnel`) errors.push(`${p} requires its matching extraction atom.`);
      if (!["mix", "vent", "settle"].includes(String(contract.operation)) || actionVerb !== contract.operation) errors.push(`${p} operation must match a mix, vent, or settle verb.`);
      if (!Array.isArray(contract.requiredControlActionIds) || contract.requiredControlActionIds.length === 0 || contract.requiredControlActionIds.some((id) => !isString(id) || !id.trim())) errors.push(`${p} requires named teacher configuration actions.`);
    }
    if (field === "extractionObservation") {
      if (actionVerb !== "observe") errors.push(`${p} requires observe.`);
      if (!isObject(input.parameters) || input.parameters.inputMode !== "choice" || JSON.stringify(input.parameters.inputOptions) !== JSON.stringify(["layers-observed", "emulsion", "incomplete"])) errors.push(`${p} requires explicit closed layer observation choices.`);
      if (isObject(input.parameters) && (input.parameters.configuredValue !== undefined || input.parameters.observedVisualState !== undefined)) errors.push(`${p} must not default an observed outcome.`);
    }
    if (field !== "extractionDrain" && (!isObject(input.interaction) || input.interaction.type !== "recordNotebook")) errors.push(`${p} requires the process control recordNotebook endpoint.`);
    if (field === "extractionDrain" && (actionVerb !== "transfer" || !isObject(input.parameters) || input.parameters.sourceInstanceId !== contract.vesselInstanceId)) errors.push(`${p} requires transfer from its named vessel.`);
  }
  if (isObject(input.parameters) && input.parameters.chromatographyOperation !== undefined) {
    const atoms: Record<string, string> = { markBaseline: "atom.observe.mark-chromatography-baseline", drySpot: "atom.observe.dry-chromatography-spot", markSolventFront: "atom.observe.mark-chromatography-solvent-front", dryDevelopedPaper: "atom.observe.dry-developed-chromatography-paper" };
    const expectedAtom = atoms[String(input.parameters.chromatographyOperation)];
    if (!expectedAtom || actionVerb !== "observe" || input.atomId !== expectedAtom || !isObject(input.interaction) || input.interaction.type !== "recordNotebook") errors.push(`${path} has incompatible chromatography operation, atom, verb, or endpoint.`);
    requireString(errors, input.parameters.sourceInstanceId, `${path}.parameters.sourceInstanceId`);
  }
  // Chamber closure names the chamber it operates on, not the strip: the lid belongs to the vessel,
  // and two trials' chambers have to stay independent.
  if (isObject(input.parameters) && input.parameters.chamberOperation !== undefined) {
    const atoms: Record<string, string> = { closeChamber: "atom.observe.close-developing-chamber", openChamber: "atom.observe.open-developing-chamber" };
    const expectedAtom = atoms[String(input.parameters.chamberOperation)];
    if (!expectedAtom || actionVerb !== "observe" || input.atomId !== expectedAtom || !isObject(input.interaction) || input.interaction.type !== "recordNotebook") errors.push(`${path} has incompatible chamber operation, atom, verb, or endpoint.`);
    requireString(errors, input.parameters.targetInstanceId, `${path}.parameters.targetInstanceId`);
  }
  if (input.materialTransition !== undefined) {
    const p = `${path}.materialTransition`;
    if (!isObject(input.materialTransition)) errors.push(`${p} must be a typed material transition contract.`);
    else {
      const transition = input.materialTransition;
      // Two authored forms, both narrow. `dissolve` is the original learner-performed dissolution
      // confirmation and is unchanged. `observe` + `recordNotebook` is the external form: an
      // operation a teacher performed outside learner control, whose completed qualitative result
      // the learner confirms. The allowed qualitative fields are identical in both, so neither
      // form can create or change a quantity.
      const externalTransitionForm =
        actionVerb === "observe" && isObject(input.interaction) && input.interaction.type === "recordNotebook";
      if (actionVerb !== "dissolve" && !externalTransitionForm) {
        errors.push(`${p} is legal only on dissolve actions or an observe/recordNotebook external-transition confirmation.`);
      }
      if (externalTransitionForm) {
        requireString(errors, stringRecordField(input.parameters, "targetInstanceId"), `${path}.parameters.targetInstanceId`);
        requireString(errors, stringRecordField(input.parameters, "targetDefinitionId"), `${path}.parameters.targetDefinitionId`);
        if (!isObject(input.parameters) || input.parameters.externalOperationActor !== "teacher") {
          errors.push(`${p} external confirmation requires parameters.externalOperationActor "teacher".`);
        }
        for (const key of ["volume", "mass", "analysis", "sourceInventory", "choiceObservation"] as const) {
          if (input[key] !== undefined) errors.push(`${p} external confirmation cannot declare a ${key} contract.`);
        }
      }
      if (transition.kind !== undefined && !["liquid", "solution", "mixture"].includes(String(transition.kind))) errors.push(`${p}.kind must be liquid, solution, or mixture.`);
      if (transition.wetState !== undefined && !["dry", "wet", "rinsed"].includes(String(transition.wetState))) errors.push(`${p}.wetState is invalid.`);
      for (const key of ["label", "visualState"] as const) if (transition[key] !== undefined) requireString(errors, transition[key], `${p}.${key}`);
      if (transition.kind === undefined && transition.label === undefined && transition.wetState === undefined && transition.visualState === undefined) errors.push(`${p} must declare at least one qualitative field.`);
      for (const key of Object.keys(transition)) if (!["kind", "label", "wetState", "visualState"].includes(key)) errors.push(`${p} contains unsupported field "${key}".`);
    }
  }
  if (input.deliveryDevice !== undefined) {
    const p = `${path}.deliveryDevice`;
    if (!isObject(input.deliveryDevice)) errors.push(`${p} must be a typed delivery-device contract.`);
    else {
      if (actionVerb !== "transfer" || input.volume === undefined) errors.push(`${p} requires a contracted transfer action.`);
      if (isObject(input.interaction) && input.interaction.type === "dispenseDrops") errors.push(`${p} cannot mediate a dispenseDrops interaction path.`);
      if (!isString(input.deliveryDevice.deviceInstanceId) && !isString(input.deliveryDevice.deviceDefinitionId)) errors.push(`${p} must name a delivery-device instance or definition.`);
      if (isString(input.deliveryDevice.deviceDefinitionId) && !equipmentById.has(input.deliveryDevice.deviceDefinitionId)) errors.push(`${p}.deviceDefinitionId references unknown equipment.`);
      if (isObject(input.parameters)) {
        const identities = [input.parameters.sourceInstanceId, input.parameters.targetInstanceId, input.deliveryDevice.deviceInstanceId].filter(isString);
        if (new Set(identities).size !== identities.length) errors.push(`${p} source, receiver, and delivery-device instances must be pairwise distinct.`);
      }
      for (const key of Object.keys(input.deliveryDevice)) if (!["deviceInstanceId", "deviceDefinitionId"].includes(key)) errors.push(`${p} contains unsupported field "${key}".`);
    }
  }
  if (input.choiceObservation !== undefined) {
    const p = `${path}.choiceObservation`;
    if (!isObject(input.choiceObservation)) errors.push(`${p} must be a typed choice observation contract.`);
    else {
      if (actionVerb !== "observe") errors.push(`${p} is legal only on observe actions.`);
      requireString(errors, input.choiceObservation.outputCalculationId, `${p}.outputCalculationId`);
      const seenLabels = new Set<string>(); const seenTags = new Set<string>(); const seenValues = new Set<number>();
      if (!Array.isArray(input.choiceObservation.options) || input.choiceObservation.options.length < 2) errors.push(`${p}.options must contain at least two outcomes.`);
      else input.choiceObservation.options.forEach((option, index) => {
        if (!isObject(option)) { errors.push(`${p}.options[${index}] must be an object.`); return; }
        if (requireString(errors, option.label, `${p}.options[${index}].label`)) { if (seenLabels.has(option.label)) errors.push(`${p}.options labels must be unique.`); seenLabels.add(option.label); }
        if (requireString(errors, option.tag, `${p}.options[${index}].tag`)) { if (seenTags.has(option.tag)) errors.push(`${p}.options tags must be unique.`); seenTags.add(option.tag); }
        if (!isNumber(option.value)) errors.push(`${p}.options[${index}].value must be finite.`); else { if (seenValues.has(option.value)) errors.push(`${p}.options values must be unique.`); seenValues.add(option.value); }
        for (const key of Object.keys(option)) if (!["label", "tag", "value"].includes(key)) errors.push(`${p}.options[${index}] contains unsupported field "${key}".`);
      });
      if (!isObject(input.parameters) || input.parameters.inputMode !== "choice") errors.push(`${p} requires parameters.inputMode "choice".`);
      if (isObject(input.parameters) && input.parameters.inputOptions !== undefined) errors.push(`${p} owns its declared choices and cannot be combined with parameters.inputOptions.`);
    }
  }
};

const validateOperationEndpoints = (actions: unknown[], equipment: unknown[], path: string, errors: string[]): void => {
  for (const action of actions) {
    if (!isObject(action)) continue;
    const parameters = isObject(action.parameters) ? action.parameters : {};
    const extraction = [action.extractionOperation, action.extractionObservation, action.extractionIdentity, action.extractionDrain].find(isObject);
    const fraction = isObject(action.fractionHandling) ? action.fractionHandling : undefined;
    if (fraction) {
      const source = equipment.find((item) => isObject(item) && item.id === fraction.sourceInstanceId);
      const target = equipment.find((item) => isObject(item) && item.id === fraction.targetInstanceId);
      const binding = isObject(action.equipmentRoleBindings) ? action.equipmentRoleBindings["recovery-vessel"] : undefined;
      if (!isObject(source) || !isString(source.definitionId) || !equipmentRoleById.get("recovery-vessel")?.allowedEquipmentIds.includes(source.definitionId) || binding !== source.definitionId) errors.push(`${path}.${String(action.id)} requires its actual bound recovery vessel.`);
      if (fraction.targetInstanceId !== undefined && (!isObject(target) || fraction.sourceInstanceId === fraction.targetInstanceId)) errors.push(`${path}.${String(action.id)} requires a distinct existing target.`);
    }
    const role = extraction
      ? "extraction-funnel"
      : parameters.chromatographyOperation !== undefined
        ? "stationary-phase"
        : parameters.chamberOperation !== undefined
          ? "developing-chamber"
          : undefined;
    const instanceId = extraction?.vesselInstanceId
      ?? (parameters.chamberOperation !== undefined ? parameters.targetInstanceId : parameters.sourceInstanceId);
    if (role) {
      const instance = equipment.find((item) => isObject(item) && item.id === instanceId);
      const binding = isObject(action.equipmentRoleBindings) ? action.equipmentRoleBindings[role] : undefined;
      if (!isObject(instance) || !isString(instance.definitionId) || !equipmentRoleById.get(role)?.allowedEquipmentIds.includes(instance.definitionId) || (binding !== undefined && binding !== instance.definitionId)) errors.push(`${path}.${String(action.id)} requires its actual named ${role} endpoint; an unrelated role binding cannot substitute.`);
    }
    const operation = isObject(action.extractionOperation) ? action.extractionOperation : undefined;
    if (operation && Array.isArray(operation.requiredControlActionIds)) {
      for (const id of operation.requiredControlActionIds) {
        const control = actions.find((item) => isObject(item) && item.id === id);
        const declared = Array.isArray(action.prerequisites) && action.prerequisites.some((rule) => isObject(rule) && rule.type === "actionEvidence" && rule.actionId === id);
        if (!isObject(control) || !isObject(control.parameters) || control.parameters.inputRole !== "teacherConfiguration" || control.parameters.configuredValue !== undefined || !declared) errors.push(`${path}.${String(action.id)} control ${String(id)} must resolve to a non-prefilled teacherConfiguration action with an actionEvidence prerequisite.`);
      }
    }
  }
};

const validateStructuredEvidenceContinuity = (
  actions: unknown,
  path: string,
  errors: string[],
  allowedStructuralMassOutputDuplicates: ReadonlySet<string> = new Set<string>(),
): void => {
  if (!Array.isArray(actions)) return;
  const isMeasurementCopyConsumer = (action: Record<string, unknown>): boolean =>
    action.verb === "record" && isObject(action.interaction) && action.interaction.type === "recordNotebook" &&
    isObject(action.parameters) && action.parameters.copyExistingMeasurementOnly === true && isString(action.parameters.measurementId);
  const structuredOutputs = new Set<string>();
  const legacyOutputs = new Set<string>();
  const runtimeRepeatProgressIds = new Set<string>();
  const legacyRepeatGroupIds = new Set<string>();
  const structuredDeclarations = new Map<string, boolean[]>();
  for (const action of actions) {
    if (!isObject(action)) continue;
    const volume = isObject(action.volume) ? action.volume : undefined;
    const mass = isObject(action.mass) ? action.mass : undefined;
    const analysis = isObject(action.analysis) ? action.analysis : undefined;
    const choice = isObject(action.choiceObservation) ? action.choiceObservation : undefined;
    const repeat = isObject(action.runtimeRepeat) ? action.runtimeRepeat : undefined;
    const inventory = isObject(action.sourceInventory) ? action.sourceInventory : undefined;
    for (const [output, isActionInputMass] of [
      [volume?.outputMeasurementId, false],
      [mass?.outputMeasurementId, mass?.source === "action-input"],
      [analysis?.outputCalculationId, false],
      [choice?.outputCalculationId, false],
      [repeat?.outputMeasurementId, false],
      [inventory?.outputMeasurementId, false],
    ] as const) {
      if (!isString(output) || /^\{\{config\./.test(output)) continue;
      const declarations = structuredDeclarations.get(output) ?? [];
      declarations.push(isActionInputMass);
      structuredDeclarations.set(output, declarations);
    }
  }
  const provenExclusiveMassOutputs = new Set<string>();
  for (const [output, declarations] of structuredDeclarations) {
    if (
      allowedStructuralMassOutputDuplicates.has(output) &&
      declarations.length === 2 &&
      declarations.every(Boolean)
    ) {
      provenExclusiveMassOutputs.add(output);
    }
  }
  for (const action of actions) {
    if (!isObject(action)) continue;
    const parameters = isObject(action.parameters) ? action.parameters : {};
    const volume = isObject(action.volume) ? action.volume : undefined;
    const mass = isObject(action.mass) ? action.mass : undefined;
    const analysis = isObject(action.analysis) ? action.analysis : undefined;
    const choice = isObject(action.choiceObservation) ? action.choiceObservation : undefined;
    const repeat = isObject(action.runtimeRepeat) ? action.runtimeRepeat : undefined;
    const inventory = isObject(action.sourceInventory) ? action.sourceInventory : undefined;
    if (repeat && isString(repeat.progressId) && !/^\{\{config\./.test(repeat.progressId)) {
      if (runtimeRepeatProgressIds.has(repeat.progressId)) errors.push(`${path} repeats runtime repeat progress id "${repeat.progressId}".`);
      runtimeRepeatProgressIds.add(repeat.progressId);
    }
    if (isString(parameters.repeatGroupId) && !/^\{\{config\./.test(parameters.repeatGroupId)) legacyRepeatGroupIds.add(parameters.repeatGroupId);
    for (const output of [
      volume?.outputMeasurementId, mass?.outputMeasurementId, analysis?.outputCalculationId,
      choice?.outputCalculationId, repeat?.outputMeasurementId, inventory?.outputMeasurementId,
    ]) {
      if (!isString(output) || /^\{\{config\./.test(output)) continue;
      const isProvenAlternativeMassOutput =
        mass?.source === "action-input" &&
        mass.outputMeasurementId === output &&
        !legacyOutputs.has(output) &&
        provenExclusiveMassOutputs.has(output);
      if ((structuredOutputs.has(output) || legacyOutputs.has(output)) && !isProvenAlternativeMassOutput) {
        errors.push(`${path} repeats structured output "${output}".`);
      }
      structuredOutputs.add(output);
    }
    const copyConsumer = isMeasurementCopyConsumer(action);
    if (copyConsumer && (parameters.value !== undefined || parameters.studentValueRequired === true || parameters.requireStudentValue === true)) errors.push(`${path}.${String(action.id)} measurement copy cannot author a replacement value or require a student value.`);
    if (copyConsumer && (volume || mass || analysis || choice || repeat || inventory || parameters.calculationId !== undefined || action.dilutionFactorOutputId !== undefined)) errors.push(`${path}.${String(action.id)} measurement copy must not declare a new output contract.`);
    for (const output of [copyConsumer ? undefined : parameters.measurementId, parameters.calculationId, action.dilutionFactorOutputId]) {
      if (!isString(output) || /^\{\{config\./.test(output)) continue;
      if (structuredOutputs.has(output)) errors.push(`${path} repeats structured output "${output}".`);
      legacyOutputs.add(output);
    }
  }
  for (const progressId of runtimeRepeatProgressIds) {
    if (legacyRepeatGroupIds.has(progressId)) errors.push(`${path} runtime repeat progress id "${progressId}" collides with a legacy repeat group id.`);
  }
  const availableMeasurements = new Set<string>();
  const availableCalculations = new Set<string>();
  actions.forEach((action, index) => {
    if (!isObject(action)) return;
    const volume = isObject(action.volume) ? action.volume : undefined;
    const mass = isObject(action.mass) ? action.mass : undefined;
    const analysis = isObject(action.analysis) ? action.analysis : undefined;
    const parameters = isObject(action.parameters) ? action.parameters : {};
    const copyConsumer = isMeasurementCopyConsumer(action);
    const references: Array<{ source: unknown; referenceId: unknown; path: string }> = [];
    // Confirmation candidates are optional branch outputs, but every declared candidate
    // must have a real producer. The runtime checks the latest present same-vessel reading.
    if (mass?.source === "action-input" && Array.isArray(mass.confirmLatestMeasurementIds)) {
      for (const id of [...mass.confirmLatestMeasurementIds, mass.toleranceMeasurementId]) {
        references.push({ source: "measurement", referenceId: id, path: "mass.confirmation" });
      }
    }
    if (mass?.source === "action-input" && mass.noRepeatCalculationId !== undefined) references.push({ source: "calculation", referenceId: mass.noRepeatCalculationId, path: "mass.noRepeatCalculationId" });
    if (copyConsumer) references.push({ source: "measurement", referenceId: parameters.measurementId, path: "parameters.measurementId" });
    for (const [key, contract] of [["volume", volume], ["mass", mass]] as const) {
      if (contract && isString(contract.referenceId)) references.push({ source: contract.source, referenceId: contract.referenceId, path: key });
    }
    if (analysis?.type === "mixedEvidenceRegression" && Array.isArray(analysis.pairs)) analysis.pairs.forEach((pair, pairIndex) => {
      if (isObject(pair) && isObject(pair.x)) references.push({ source: pair.x.source, referenceId: pair.x.referenceId, path: `analysis.pairs[${pairIndex}].x` });
      if (isObject(pair) && isObject(pair.y)) references.push({ source: pair.y.source, referenceId: pair.y.referenceId, path: `analysis.pairs[${pairIndex}].y` });
    });
    for (const [key, value] of [["input", analysis?.input], ["response", analysis?.response], ["concentration", analysis?.concentration]] as const) {
      if (isObject(value)) references.push({ source: value.source, referenceId: value.referenceId, path: `analysis.${key}` });
    }
    if (analysis?.type === "concentrationFromRegression") references.push({ source: "calculation", referenceId: analysis.regressionCalculationId, path: "analysis.regressionCalculationId" });
    if (analysis?.type === "massDifferenceWithinTolerance") for (const key of ["firstMassMeasurementId", "secondMassMeasurementId", "toleranceMeasurementId"]) references.push({ source: "measurement", referenceId: analysis[key], path: `analysis.${key}` });
    if (analysis?.type === "molarConcentrationToMass") {
      references.push({ source: "measurement", referenceId: analysis.solutionVolumeMeasurementId, path: "analysis.solutionVolumeMeasurementId" });
      references.push({ source: "measurement", referenceId: analysis.molarMassMeasurementId, path: "analysis.molarMassMeasurementId" });
    }
    const runtimeRepeat = isObject(action.runtimeRepeat) ? action.runtimeRepeat : undefined;
    if (runtimeRepeat) references.push({ source: "measurement", referenceId: runtimeRepeat.countMeasurementId, path: "runtimeRepeat.countMeasurementId" });
    for (const reference of references) {
      if (!isString(reference.referenceId) || /^\{\{config\./.test(reference.referenceId)) continue;
      const available = reference.source === "calculation" ? availableCalculations : availableMeasurements;
      if (!available.has(reference.referenceId)) errors.push(`${path}[${index}].${reference.path} reference "${reference.referenceId}" must be produced before it is consumed.`);
    }
    const addAvailable = (set: Set<string>, value: unknown) => { if (isString(value) && !/^\{\{config\./.test(value)) set.add(value); };
    addAvailable(availableMeasurements, volume?.outputMeasurementId);
    addAvailable(availableMeasurements, mass?.outputMeasurementId);
    addAvailable(availableMeasurements, runtimeRepeat?.outputMeasurementId);
    addAvailable(availableMeasurements, isObject(action.sourceInventory) ? action.sourceInventory.outputMeasurementId : undefined);
    if (!copyConsumer && ["weigh", "measureVolume", "observe", "record"].includes(String(action.verb))) addAvailable(availableMeasurements, parameters.measurementId);
    if (action.verb === "dilute") addAvailable(availableCalculations, action.dilutionFactorOutputId);
    if (action.verb === "calculate") addAvailable(availableCalculations, parameters.calculationId);
    addAvailable(availableCalculations, analysis?.outputCalculationId);
    addAvailable(availableCalculations, isObject(action.choiceObservation) ? action.choiceObservation.outputCalculationId : undefined);
  });
};

const requirePositiveNumber = (errors: string[], value: unknown, path: string): value is number => {
  if (!isNumber(value) || value <= 0) {
    errors.push(`${path} must be a positive finite number.`);
    return false;
  }
  return true;
};

const validateOptionalNonNegativeInteger = (
  value: unknown,
  path: string,
  errors: string[],
): void => {
  if (value === undefined) return;
  if (!isNumber(value) || value < 0 || !Number.isInteger(value)) {
    errors.push(`${path} must be a non-negative integer.`);
  }
};

const validateTitrationModels = (
  input: unknown,
  path: string,
  errors: string[],
): void => {
  if (input === undefined) return;
  if (!Array.isArray(input)) {
    errors.push(`${path} must be an array when provided.`);
    return;
  }

  const ids = new Set<string>();
  input.forEach((model, index) => {
    const modelPath = `${path}[${index}]`;
    if (!isObject(model)) {
      errors.push(`${modelPath} must be an object.`);
      return;
    }
    if (requireString(errors, model.id, `${modelPath}.id`)) {
      if (ids.has(model.id)) errors.push(`${modelPath}.id must be unique.`);
      ids.add(model.id);
    }
    if (model.type !== "acidBase" && model.type !== "redox") {
      errors.push(`${modelPath}.type must be acidBase or redox.`);
    }
    if (model.type === "acidBase") {
      for (const speciesKey of ["analyte", "titrant"] as const) {
        const species = model[speciesKey];
        const speciesPath = `${modelPath}.${speciesKey}`;
        if (!isObject(species)) {
          errors.push(`${speciesPath} must be an object.`);
          continue;
        }
        requireString(errors, species.formula, `${speciesPath}.formula`);
        if (species.role !== "acid" && species.role !== "base") {
          errors.push(`${speciesPath}.role must be acid or base.`);
        }
        if (species.strength !== "strong" && species.strength !== "weak") {
          errors.push(`${speciesPath}.strength must be strong or weak.`);
        }
        if (species.strength === "weak") {
          requirePositiveNumber(errors, species.equilibriumConstant, `${speciesPath}.equilibriumConstant`);
        } else if (species.equilibriumConstant !== undefined) {
          requirePositiveNumber(errors, species.equilibriumConstant, `${speciesPath}.equilibriumConstant`);
        }
        if (species.equilibriumConstantSource !== undefined) {
          requireString(errors, species.equilibriumConstantSource, `${speciesPath}.equilibriumConstantSource`);
        }
      }
      if (
        isObject(model.analyte) &&
        isObject(model.titrant) &&
        (model.analyte.role === "acid" || model.analyte.role === "base") &&
        model.analyte.role === model.titrant.role
      ) {
        errors.push(`${modelPath}.analyte.role and ${modelPath}.titrant.role must be opposite.`);
      }
      requireNumber(errors, model.temperatureC, `${modelPath}.temperatureC`);
      requirePositiveNumber(errors, model.waterIonProduct, `${modelPath}.waterIonProduct`);
      if (!isNumber(model.phPrecision) || !Number.isInteger(model.phPrecision) || model.phPrecision < 0 || model.phPrecision > 6) {
        errors.push(`${modelPath}.phPrecision must be an integer from 0 through 6.`);
      }
    }
    // Only a redox model reports a mass or a percent. Accepting these on an acid-base model would
    // let a lab claim a percent-by-mass result the model cannot derive.
    if (model.type === "redox") {
      if (model.analyteMolarMassGPerMol !== undefined) {
        requirePositiveNumber(errors, model.analyteMolarMassGPerMol, `${modelPath}.analyteMolarMassGPerMol`);
      }
      if (model.sampleDensityGPerMl !== undefined) {
        requirePositiveNumber(errors, model.sampleDensityGPerMl, `${modelPath}.sampleDensityGPerMl`);
      }
    } else if (
      model.analyteMolarMassGPerMol !== undefined ||
      model.sampleDensityGPerMl !== undefined
    ) {
      errors.push(
        `${modelPath} may only declare analyteMolarMassGPerMol or sampleDensityGPerMl when type is redox.`,
      );
    }
    requirePositiveNumber(errors, model.analyteMolarityM, `${modelPath}.analyteMolarityM`);
    requirePositiveNumber(errors, model.analyteVolumeMl, `${modelPath}.analyteVolumeMl`);
    requirePositiveNumber(errors, model.titrantMolarityM, `${modelPath}.titrantMolarityM`);
    if (model.dropVolumeMl !== undefined) {
      requirePositiveNumber(errors, model.dropVolumeMl, `${modelPath}.dropVolumeMl`);
    }
    validateOptionalNonNegativeInteger(model.endpointOffsetDrops, `${modelPath}.endpointOffsetDrops`, errors);
    validateOptionalNonNegativeInteger(model.maxExtraDrops, `${modelPath}.maxExtraDrops`, errors);

    if (model.stoichiometricRatio !== undefined) {
      if (!isObject(model.stoichiometricRatio)) {
        errors.push(`${modelPath}.stoichiometricRatio must be an object.`);
      } else {
        requirePositiveNumber(
          errors,
          model.stoichiometricRatio.analyte,
          `${modelPath}.stoichiometricRatio.analyte`,
        );
        requirePositiveNumber(
          errors,
          model.stoichiometricRatio.titrant,
          `${modelPath}.stoichiometricRatio.titrant`,
        );
      }
    }
  });
};

const validateChromatographyModels = (
  input: unknown,
  path: string,
  errors: string[],
): void => {
  if (input === undefined) return;
  if (!Array.isArray(input)) {
    errors.push(`${path} must be an array when provided.`);
    return;
  }

  const ids = new Set<string>();
  input.forEach((model, index) => {
    const modelPath = `${path}[${index}]`;
    if (!isObject(model)) {
      errors.push(`${modelPath} must be an object.`);
      return;
    }
    if (requireString(errors, model.id, `${modelPath}.id`)) {
      if (ids.has(model.id)) errors.push(`${modelPath}.id must be unique.`);
      ids.add(model.id);
    }
    requirePositiveNumber(errors, model.solventFrontMm, `${modelPath}.solventFrontMm`);
    if (!Array.isArray(model.bands) || model.bands.length === 0) {
      errors.push(`${modelPath}.bands must contain at least one band.`);
      return;
    }
    const bandIds = new Set<string>();
    model.bands.forEach((band, bandIndex) => {
      const bandPath = `${modelPath}.bands[${bandIndex}]`;
      if (!isObject(band)) {
        errors.push(`${bandPath} must be an object.`);
        return;
      }
      if (requireString(errors, band.id, `${bandPath}.id`)) {
        if (bandIds.has(band.id)) errors.push(`${bandPath}.id must be unique within the model.`);
        bandIds.add(band.id);
      }
      requireString(errors, band.label, `${bandPath}.label`);
      requireString(errors, band.color, `${bandPath}.color`);
      if (!isNumber(band.distanceMm) || band.distanceMm < 0) errors.push(`${bandPath}.distanceMm must be finite and nonnegative.`);
      if (!isNumber(band.expectedRf) || band.expectedRf < 0) errors.push(`${bandPath}.expectedRf must be finite and nonnegative.`);
      if (isNumber(band.expectedRf) && band.expectedRf > 1) {
        errors.push(`${bandPath}.expectedRf must be at most 1.`);
      }
      if (
        isNumber(band.distanceMm) &&
        isNumber(model.solventFrontMm) &&
        band.distanceMm > model.solventFrontMm
      ) {
        errors.push(`${bandPath}.distanceMm cannot exceed solventFrontMm.`);
      }
      if (
        isNumber(band.distanceMm) &&
        isNumber(model.solventFrontMm) &&
        model.solventFrontMm > 0 &&
        isNumber(band.expectedRf)
      ) {
        const calculatedRf = band.distanceMm / model.solventFrontMm;
        if (Math.abs(calculatedRf - band.expectedRf) > 0.005) {
          errors.push(`${bandPath}.expectedRf must equal distanceMm / solventFrontMm within 0.005.`);
        }
      }
    });
  });
};

const kineticsVariables = new Set(["acidConcentration", "chipSize", "temperature"]);
const chipSizes = new Set(["large", "medium", "small"]);

const validateKineticsModels = (
  input: unknown,
  path: string,
  errors: string[],
): void => {
  if (input === undefined) return;
  if (!Array.isArray(input)) {
    errors.push(`${path} must be an array when provided.`);
    return;
  }

  const ids = new Set<string>();
  input.forEach((model, index) => {
    const modelPath = `${path}[${index}]`;
    if (!isObject(model)) {
      errors.push(`${modelPath} must be an object.`);
      return;
    }
    if (requireString(errors, model.id, `${modelPath}.id`)) {
      if (ids.has(model.id)) errors.push(`${modelPath}.id must be unique.`);
      ids.add(model.id);
    }
    if (model.type !== "gasSyringe") {
      errors.push(`${modelPath}.type must be gasSyringe.`);
    }
    const timepointsS = model.timepointsS;
    if (!Array.isArray(timepointsS) || timepointsS.length < 2) {
      errors.push(`${modelPath}.timepointsS must contain at least two time points.`);
    } else {
      if (timepointsS[0] !== 0) {
        errors.push(`${modelPath}.timepointsS[0] must be 0.`);
      }
      timepointsS.forEach((timepoint, timepointIndex) => {
        if (!isNumber(timepoint) || timepoint < 0) {
          errors.push(`${modelPath}.timepointsS[${timepointIndex}] must be a non-negative finite number.`);
        }
        const previous = timepointsS[timepointIndex - 1];
        if (timepointIndex > 0 && isNumber(timepoint) && isNumber(previous) && timepoint <= previous) {
          errors.push(`${modelPath}.timepointsS must be strictly increasing.`);
        }
      });
    }
    requirePositiveNumber(errors, model.baseMaxVolumeMl, `${modelPath}.baseMaxVolumeMl`);
    requirePositiveNumber(errors, model.baseRateConstant, `${modelPath}.baseRateConstant`);
    if (!kineticsVariables.has(String(model.defaultVariable))) {
      errors.push(`${modelPath}.defaultVariable must be acidConcentration, chipSize, or temperature.`);
    }
    if (!isObject(model.controlled)) {
      errors.push(`${modelPath}.controlled must be an object.`);
    } else {
      requirePositiveNumber(errors, model.controlled.acidVolumeMl, `${modelPath}.controlled.acidVolumeMl`);
      requirePositiveNumber(errors, model.controlled.marbleMassG, `${modelPath}.controlled.marbleMassG`);
      requirePositiveNumber(errors, model.controlled.acidConcentrationM, `${modelPath}.controlled.acidConcentrationM`);
      if (!chipSizes.has(String(model.controlled.chipSize))) {
        errors.push(`${modelPath}.controlled.chipSize must be large, medium, or small.`);
      }
      requirePositiveNumber(errors, model.controlled.temperatureC, `${modelPath}.controlled.temperatureC`);
    }
    if (!Array.isArray(model.conditions) || model.conditions.length === 0) {
      errors.push(`${modelPath}.conditions must contain at least one condition.`);
      return;
    }
    const conditionIds = new Set<string>();
    model.conditions.forEach((condition, conditionIndex) => {
      const conditionPath = `${modelPath}.conditions[${conditionIndex}]`;
      if (!isObject(condition)) {
        errors.push(`${conditionPath} must be an object.`);
        return;
      }
      if (requireString(errors, condition.id, `${conditionPath}.id`)) {
        if (conditionIds.has(condition.id)) errors.push(`${conditionPath}.id must be unique within the model.`);
        conditionIds.add(condition.id);
      }
      requireString(errors, condition.label, `${conditionPath}.label`);
      if (!kineticsVariables.has(String(condition.variable))) {
        errors.push(`${conditionPath}.variable must be acidConcentration, chipSize, or temperature.`);
      }
      requirePositiveNumber(errors, condition.acidConcentrationM, `${conditionPath}.acidConcentrationM`);
      if (!chipSizes.has(String(condition.chipSize))) {
        errors.push(`${conditionPath}.chipSize must be large, medium, or small.`);
      }
      requirePositiveNumber(errors, condition.temperatureC, `${conditionPath}.temperatureC`);
      requirePositiveNumber(errors, condition.rateFactor, `${conditionPath}.rateFactor`);
    });
  });
};

const collectTitrationModelIds = (models: unknown): Set<string> => {
  if (!Array.isArray(models)) return new Set();
  return new Set(
    models
      .filter(isObject)
      .map((model) => model.id)
      .filter(isString),
  );
};

const collectChromatographyModelIds = (models: unknown): Set<string> => {
  if (!Array.isArray(models)) return new Set();
  return new Set(
    models
      .filter(isObject)
      .map((model) => model.id)
      .filter(isString),
  );
};

const collectKineticsModelIds = (models: unknown): Set<string> => {
  if (!Array.isArray(models)) return new Set();
  return new Set(
    models
      .filter(isObject)
      .map((model) => model.id)
      .filter(isString),
  );
};

const collectDefinitionTitrationModelIds = (input: Record<string, unknown>): Set<string> => {
  const ids = collectTitrationModelIds(input.titrationModels);
  if (Array.isArray(input.techniques)) {
    input.techniques.filter(isObject).forEach((technique) => {
      collectTitrationModelIds(technique.titrationModels).forEach((id) => ids.add(id));
    });
  }
  return ids;
};

const collectDefinitionChromatographyModelIds = (input: Record<string, unknown>): Set<string> => {
  const ids = collectChromatographyModelIds(input.chromatographyModels);
  if (Array.isArray(input.techniques)) {
    input.techniques.filter(isObject).forEach((technique) => {
      collectChromatographyModelIds(technique.chromatographyModels).forEach((id) => ids.add(id));
    });
  }
  return ids;
};

const collectDefinitionKineticsModelIds = (input: Record<string, unknown>): Set<string> => {
  const ids = collectKineticsModelIds(input.kineticsModels);
  if (Array.isArray(input.techniques)) {
    input.techniques.filter(isObject).forEach((technique) => {
      collectKineticsModelIds(technique.kineticsModels).forEach((id) => ids.add(id));
    });
  }
  return ids;
};

const validatePrimitiveRecord = (input: unknown, path: string, errors: string[]): void => {
  if (!isObject(input)) {
    errors.push(`${path} must be an object.`);
    return;
  }
  Object.entries(input).forEach(([key, value]) => {
    if (!isString(value) && !isNumber(value) && !isBoolean(value)) {
      errors.push(`${path}.${key} must be a string, number, or boolean.`);
    }
  });
};

const validateKnownEquipmentReference = (
  value: unknown,
  path: string,
  errors: string[],
  context: ValidationContext,
): value is string => {
  if (!requireString(errors, value, path)) return false;
  if (!equipmentById.has(value)) {
    errors.push(`${path} references unknown equipment "${value}".`);
    return false;
  }
  if (context.equipmentIds && !context.equipmentIds.has(value)) {
    errors.push(`${path} references equipment "${value}" that is not available in this definition.`);
    return false;
  }
  return true;
};

const isKnownInteractionStation = (stationId: string): boolean =>
  interactionStationIds.includes(stationId as (typeof interactionStationIds)[number]) ||
  equipmentById.has(stationId);

const findSnapZone = (
  snapZoneId: string,
  targetDefinitionId?: string,
) => {
  if (targetDefinitionId) {
    return equipmentById.get(targetDefinitionId)?.snapZones.find((zone) => zone.id === snapZoneId);
  }
  for (const definition of equipmentById.values()) {
    const zone = definition.snapZones.find((candidate) => candidate.id === snapZoneId);
    if (zone) return zone;
  }
  return undefined;
};

const validateRequiredInteractionFields = (
  interaction: ActionInteractionSpec,
  path: string,
  errors: string[],
): void => {
  if (
    (interaction.type === "dragToZone" ||
      interaction.type === "snapIntoTarget" ||
      interaction.type === "pourInto" ||
      interaction.type === "dispenseDrops" ||
      interaction.type === "spotOnto" ||
      interaction.type === "placeInInstrument" ||
      interaction.type === "readInstrument") &&
    !interaction.sourceDefinitionId
  ) {
    errors.push(`${path}.sourceDefinitionId is required for ${interaction.type}.`);
  }
  if (
    (interaction.type === "snapIntoTarget" ||
      interaction.type === "pourInto" ||
      interaction.type === "dispenseDrops" ||
      interaction.type === "spotOnto" ||
      interaction.type === "rinseTarget" ||
      interaction.type === "placeInInstrument") &&
    !interaction.targetDefinitionId
  ) {
    errors.push(`${path}.targetDefinitionId is required for ${interaction.type}.`);
  }
  if (
    (interaction.type === "dragToZone" ||
      interaction.type === "placeInInstrument" ||
      interaction.type === "readInstrument") &&
    !interaction.stationId
  ) {
    errors.push(`${path}.stationId is required for ${interaction.type}.`);
  }
  if (interaction.type === "submitCalculation" && !interaction.valueParameter) {
    errors.push(`${path}.valueParameter is required for submitCalculation.`);
  }
};

const validateInteractionSpec = (
  input: unknown,
  path: string,
  errors: string[],
  actionVerb: ActionVerb | undefined,
  context: ValidationContext,
): input is ActionInteractionSpec => {
  if (!isObject(input)) {
    errors.push(`${path} must be an object.`);
    return false;
  }

  const type = input.type as ActionInteractionType;
  if (!interactionOperationTypes.includes(type)) {
    errors.push(`${path}.type must be a supported interaction operation.`);
  } else if (actionVerb && !compatibleInteractionVerbs[type].includes(actionVerb)) {
    errors.push(`${path}.type ${type} is not compatible with action verb ${actionVerb}.`);
  }

  const sourceDefinitionId =
    input.sourceDefinitionId !== undefined
      ? validateKnownEquipmentReference(input.sourceDefinitionId, `${path}.sourceDefinitionId`, errors, context)
        ? input.sourceDefinitionId
        : undefined
      : undefined;
  const targetDefinitionId =
    input.targetDefinitionId !== undefined
      ? validateKnownEquipmentReference(input.targetDefinitionId, `${path}.targetDefinitionId`, errors, context)
        ? input.targetDefinitionId
        : undefined
      : undefined;

  if (input.stationId !== undefined) {
    if (requireString(errors, input.stationId, `${path}.stationId`) && !isKnownInteractionStation(input.stationId)) {
      errors.push(`${path}.stationId references unknown station "${input.stationId}".`);
    }
  }

  if (input.snapZoneId !== undefined) {
    if (requireString(errors, input.snapZoneId, `${path}.snapZoneId`)) {
      const snapZone = findSnapZone(input.snapZoneId, targetDefinitionId);
      if (!snapZone) {
        errors.push(`${path}.snapZoneId references an unknown snap zone.`);
      } else if (sourceDefinitionId && !snapZone.accepts.includes(sourceDefinitionId)) {
        errors.push(`${path}.snapZoneId does not accept source equipment "${sourceDefinitionId}".`);
      }
    }
  }

  if (input.valueParameter !== undefined) {
    requireString(errors, input.valueParameter, `${path}.valueParameter`);
  }
  if (input.requiredState !== undefined) {
    validatePrimitiveRecord(input.requiredState, `${path}.requiredState`, errors);
  }
  if (input.successCue !== undefined) {
    requireString(errors, input.successCue, `${path}.successCue`);
  }
  if (input.invalidCue !== undefined) {
    requireString(errors, input.invalidCue, `${path}.invalidCue`);
  }
  requireString(errors, input.accessibleLabel, `${path}.accessibleLabel`);

  if (interactionOperationTypes.includes(type)) {
    validateRequiredInteractionFields(input as unknown as ActionInteractionSpec, path, errors);
  }

  const sourceDefinition = sourceDefinitionId ? equipmentById.get(sourceDefinitionId) : undefined;
  const targetDefinition = targetDefinitionId ? equipmentById.get(targetDefinitionId) : undefined;
  if (type === "pourInto" || type === "dispenseDrops") {
    if (sourceDefinition && !sourceDefinition.affordances.includes("pourable")) {
      errors.push(`${path}.sourceDefinitionId must reference pourable equipment for ${type}.`);
    }
    if (
      targetDefinition &&
      !targetDefinition.affordances.some((affordance) =>
        affordance === "fillable" || affordance === "filterTarget"
      )
    ) {
      errors.push(`${path}.targetDefinitionId must reference fillable or filtration equipment for ${type}.`);
    }
  }
  if (type === "spotOnto") {
    if (targetDefinition && !targetDefinition.affordances.includes("spotTarget")) {
      errors.push(`${path}.targetDefinitionId must reference spot target equipment for ${type}.`);
    }
  }

  return true;
};

/** Action `parameters` keys that name an equipment definition. */
export const actionEquipmentParameterKeys = [
  "equipmentDefinitionId",
  "sourceDefinitionId",
  "targetDefinitionId",
  "instrumentDefinitionId",
  "ovenDefinitionId",
  "heatSourceDefinitionId",
  "coolingToolDefinitionId",
] as const;

/** Action `parameters` keys that name a lab-owned simulation model. */
export const actionModelParameterKeys = [
  "titrationModelId",
  "chromatographyModelId",
  "kineticsModelId",
] as const;

const stringRecordField = (
  value: unknown,
  key: string,
): string | undefined =>
  isObject(value) && isString(value[key]) ? value[key] : undefined;

const actionEndpoint = (
  input: Record<string, unknown>,
  key: "sourceDefinitionId" | "targetDefinitionId",
): string | undefined =>
  stringRecordField(input.parameters, key) ?? stringRecordField(input.interaction, key);

const validateAuthoredActionEndpoints = (
  input: Record<string, unknown>,
  path: string,
  errors: string[],
  actionVerb: ActionVerb | undefined,
  context: ValidationContext,
): void => {
  if (!actionVerb) return;

  for (const key of actionEquipmentParameterKeys) {
    const parameterValue = stringRecordField(input.parameters, key);
    if (parameterValue) {
      validateKnownEquipmentReference(parameterValue, `${path}.parameters.${key}`, errors, context);
    }
  }

  if (!endpointRequiredActionVerbs.has(actionVerb)) return;

  // Reading a graduated instrument has one operand: the instrument. `measureVolume` was written when
  // every such action poured from a source into a measuring device, so requiring a target here made
  // `atom.measure.read-burette` — measureVolume + readInstrument, declared by Cycle 02 — impossible
  // to author. The exemption is narrow: only readInstrument, and the source stays required.
  if (
    actionVerb === "measureVolume" &&
    stringRecordField(input.interaction, "type") === "readInstrument"
  ) {
    if (!actionEndpoint(input, "sourceDefinitionId")) {
      errors.push(
        `${path} (${String(input.id ?? actionVerb)}) requires sourceDefinitionId for a readInstrument measureVolume.`,
      );
    }
    return;
  }

  const source = actionEndpoint(input, "sourceDefinitionId");
  const target = actionEndpoint(input, "targetDefinitionId");
  if (!source || !target) {
    errors.push(
      `${path} (${String(input.id ?? actionVerb)}) requires sourceDefinitionId and targetDefinitionId for ${actionVerb}.`,
    );
  }
};

const finiteNumberParameter = (
  input: Record<string, unknown>,
  key: string,
): number | undefined => {
  if (!isObject(input.parameters)) return undefined;
  return isNumber(input.parameters[key]) ? input.parameters[key] : undefined;
};

const validateThermalActionParameters = (
  input: Record<string, unknown>,
  path: string,
  errors: string[],
  actionVerb: ActionVerb | undefined,
): void => {
  if (actionVerb === "heat") {
    if (
      isObject(input.parameters) &&
      input.parameters.thermalMode === "targetTemperature"
    ) {
      const targetTemperatureC = finiteNumberParameter(input, "targetTemperatureC");
      const toleranceC = finiteNumberParameter(input, "toleranceC");
      if (targetTemperatureC === undefined) {
        errors.push(`${path}.parameters.targetTemperatureC is required for target-temperature heating.`);
      }
      if (toleranceC !== undefined && toleranceC < 0) {
        errors.push(`${path}.parameters.toleranceC must be non-negative when provided.`);
      }
      return;
    }
    const heatedMassG =
      finiteNumberParameter(input, "heatedMassG") ??
      finiteNumberParameter(input, "finalMassG");
    if (heatedMassG === undefined || heatedMassG <= 0) {
      errors.push(`${path}.parameters.heatedMassG must be a positive finite number for heat actions.`);
    }
    const productMassG = finiteNumberParameter(input, "productMassG");
    if (productMassG === undefined || productMassG <= 0) {
      errors.push(`${path}.parameters.productMassG must be a positive finite number for heat actions.`);
    }
    if (heatedMassG !== undefined && productMassG !== undefined && productMassG > heatedMassG) {
      errors.push(`${path}.parameters.productMassG must not exceed heatedMassG for heat actions.`);
    }
    const heatedTemperatureC = finiteNumberParameter(input, "heatedTemperatureC");
    if (heatedTemperatureC !== undefined && heatedTemperatureC <= 0) {
      errors.push(`${path}.parameters.heatedTemperatureC must be a positive finite number when provided.`);
    }
    const minimumHotTemperatureC = finiteNumberParameter(input, "minimumHotTemperatureC") ?? 40;
    if (heatedTemperatureC !== undefined && heatedTemperatureC <= minimumHotTemperatureC) {
      errors.push(`${path}.parameters.heatedTemperatureC must exceed the safe weighing threshold for heat actions.`);
    }
  }

  if (actionVerb === "cool") {
    const cooledTemperatureC = finiteNumberParameter(input, "cooledTemperatureC");
    if (cooledTemperatureC !== undefined && cooledTemperatureC < 0) {
      errors.push(`${path}.parameters.cooledTemperatureC must be a non-negative finite number when provided.`);
    }
  }
};

const collectActionIds = (actions: unknown): Set<string> => {
  if (!Array.isArray(actions)) return new Set();
  return new Set(
    actions
      .filter(isObject)
      .map((action) => action.id)
      .filter(isString),
  );
};

const collectDataSeriesIds = (actions: unknown): Set<string> => {
  if (!Array.isArray(actions)) return new Set();
  return new Set(
    actions
      .filter(isObject)
      .filter((action) => action.verb === "record")
      .map((action) => (isObject(action.parameters) ? action.parameters : undefined))
      .filter(isObject)
      .filter((parameters) => parameters.kineticsModelId !== undefined)
      .map((parameters) => parameters.dataSeriesId)
      .filter(isString),
  );
};

const collectDefinitionDataSeriesIds = (input: Record<string, unknown>): Set<string> => {
  const ids = collectDataSeriesIds(input.actions);
  if (Array.isArray(input.techniques)) {
    input.techniques.filter(isObject).forEach((technique) => {
      collectDataSeriesIds(technique.actions).forEach((id) => ids.add(id));
    });
  }
  return ids;
};

const collectKineticsConditionIdsByModelId = (models: unknown): Map<string, Set<string>> => {
  const byModelId = new Map<string, Set<string>>();
  if (!Array.isArray(models)) return byModelId;
  models.filter(isObject).forEach((model) => {
    if (!isString(model.id) || !Array.isArray(model.conditions)) return;
    const conditionIds = new Set<string>();
    model.conditions.filter(isObject).forEach((condition) => {
      if (isString(condition.id)) conditionIds.add(condition.id);
    });
    byModelId.set(model.id, conditionIds);
  });
  return byModelId;
};

const mergeKineticsConditionIdsByModelId = (
  target: Map<string, Set<string>>,
  source: Map<string, Set<string>>,
): void => {
  source.forEach((conditionIds, modelId) => {
    const existing = target.get(modelId) ?? new Set<string>();
    conditionIds.forEach((conditionId) => existing.add(conditionId));
    target.set(modelId, existing);
  });
};

const collectDefinitionKineticsConditionIdsByModelId = (
  input: Record<string, unknown>,
): Map<string, Set<string>> => {
  const byModelId = collectKineticsConditionIdsByModelId(input.kineticsModels);
  if (Array.isArray(input.techniques)) {
    input.techniques.filter(isObject).forEach((technique) => {
      mergeKineticsConditionIdsByModelId(
        byModelId,
        collectKineticsConditionIdsByModelId(technique.kineticsModels),
      );
    });
  }
  return byModelId;
};

const validateProcess = (
  process: unknown,
  path: string,
  errors: string[],
  context: ValidationContext,
): process is ProcessDefinition => {
  if (!isObject(process)) {
    errors.push(`${path} must be an object.`);
    return false;
  }
  requireString(errors, process.startNodeId, `${path}.startNodeId`);
  const nodeIds = new Set<string>();

  if (!Array.isArray(process.nodes) || (process.nodes.length === 0 && !context.allowEmptyProcessNodes)) {
    errors.push(`${path}.nodes must contain at least one node.`);
  } else {
    process.nodes.forEach((node, index) => {
      const nodePath = `${path}.nodes[${index}]`;
      if (!isObject(node)) {
        errors.push(`${nodePath} must be an object.`);
        return;
      }
      if (requireString(errors, node.id, `${nodePath}.id`)) {
        if (nodeIds.has(node.id)) errors.push(`${nodePath}.id must be unique.`);
        nodeIds.add(node.id);
      }
      if (!nodeTypes.includes(node.type as ProcessNodeType)) {
        errors.push(`${nodePath}.type must be a supported v1 node type.`);
      }
      requireString(errors, node.title, `${nodePath}.title`);
      requireString(errors, node.description, `${nodePath}.description`);
      if (node.actionId !== undefined) {
        if (requireString(errors, node.actionId, `${nodePath}.actionId`) && context.actionIds && !context.actionIds.has(node.actionId)) {
          errors.push(`${nodePath}.actionId must reference an existing action.`);
        }
      }
      if (node.layout !== undefined) {
        if (!isObject(node.layout)) {
          errors.push(`${nodePath}.layout must be an object.`);
        } else {
          requireNumber(errors, node.layout.x, `${nodePath}.layout.x`);
          requireNumber(errors, node.layout.y, `${nodePath}.layout.y`);
          if (node.layout.lane !== undefined) {
            requireString(errors, node.layout.lane, `${nodePath}.layout.lane`);
          }
          if (
            node.layout.display !== undefined &&
            !processNodeDisplayStates.includes(node.layout.display as ProcessNodeDisplayState)
          ) {
            errors.push(`${nodePath}.layout.display must be compact or expanded.`);
          }
        }
      }
      if (!isObject(node.config)) errors.push(`${nodePath}.config must be an object.`);
      validateRuleArray(node.validation, `${nodePath}.validation`, errors, context);
      if (!isStringArray(node.hints)) errors.push(`${nodePath}.hints must be a string array.`);
      if (!isObject(node.feedback)) {
        errors.push(`${nodePath}.feedback must be an object.`);
      } else {
        requireString(errors, node.feedback.success, `${nodePath}.feedback.success`);
        requireString(errors, node.feedback.retry, `${nodePath}.feedback.retry`);
      }
    });
    if (isString(process.startNodeId) && !nodeIds.has(process.startNodeId) && !context.allowExternalProcessStart) {
      errors.push(`${path}.startNodeId must reference an existing node.`);
    }
  }

  if (!Array.isArray(process.edges)) {
    errors.push(`${path}.edges must be an array.`);
  } else {
    process.edges.forEach((edge, index) => {
      const edgePath = `${path}.edges[${index}]`;
      if (!isObject(edge)) {
        errors.push(`${edgePath} must be an object.`);
        return;
      }
      if (requireString(errors, edge.from, `${edgePath}.from`) && !nodeIds.has(edge.from)) {
        errors.push(`${edgePath}.from must reference an existing node.`);
      }
      if (requireString(errors, edge.to, `${edgePath}.to`) && !nodeIds.has(edge.to)) {
        errors.push(`${edgePath}.to must reference an existing node.`);
      }
      requireString(errors, edge.label, `${edgePath}.label`);
      if (!isObject(edge.condition)) {
        errors.push(`${edgePath}.condition must be an object.`);
      } else {
        if (!edgeConditionTypes.includes(edge.condition.type as EdgeConditionType)) {
          errors.push(`${edgePath}.condition.type must be a supported edge condition.`);
        }
        if (edge.condition.type === "calculationResult") {
          requireString(errors, edge.condition.calculationId, `${edgePath}.condition.calculationId`);
          if (edge.condition.min !== undefined) requireNumber(errors, edge.condition.min, `${edgePath}.condition.min`);
          if (edge.condition.max !== undefined) requireNumber(errors, edge.condition.max, `${edgePath}.condition.max`);
        }
      }
    });
  }
  return errors.length === 0;
};

export const validateEquipmentDefinition = (
  input: unknown,
): ValidationResult<EquipmentDefinition> => {
  const errors: string[] = [];
  if (!isObject(input)) {
    return { ok: false, errors: ["Equipment definition must be an object."] };
  }
  requireString(errors, input.id, "equipment.id");
  requireString(errors, input.label, "equipment.label");
  if (!equipmentCategories.includes(input.category as EquipmentCategory)) {
    errors.push("equipment.category must be a supported category.");
  }
  requireString(errors, input.asset, "equipment.asset");
  if (input.shelfPlaceable !== undefined && !isBoolean(input.shelfPlaceable)) {
    errors.push("equipment.shelfPlaceable must be a boolean when provided.");
  }
  if (!isObject(input.dimensions)) {
    errors.push("equipment.dimensions is required.");
  } else {
    requireNumber(errors, input.dimensions.width, "equipment.dimensions.width");
    requireNumber(errors, input.dimensions.height, "equipment.dimensions.height");
    if (input.dimensions.unit !== "px" && input.dimensions.unit !== "cm") {
      errors.push("equipment.dimensions.unit must be px or cm.");
    }
  }
  if (!isObject(input.capacity)) {
    errors.push("equipment.capacity is required.");
  } else {
    requireNumber(errors, input.capacity.amount, "equipment.capacity.amount");
    if (!["mL", "g", "none"].includes(String(input.capacity.unit))) {
      errors.push("equipment.capacity.unit must be mL, g, or none.");
    }
  }
  if (!isObject(input.precision)) {
    errors.push("equipment.precision is required.");
  } else {
    requireNumber(errors, input.precision.amount, "equipment.precision.amount");
    if (!["mL", "g", "mg", "none"].includes(String(input.precision.unit))) {
      errors.push("equipment.precision.unit must be mL, g, mg, or none.");
    }
  }
  if (!isStringArray(input.allowedContents)) errors.push("equipment.allowedContents must be a string array.");
  if (!Array.isArray(input.affordances)) {
    errors.push("equipment.affordances must be an array.");
  } else {
    input.affordances.forEach((affordance, index) => {
      if (!equipmentAffordances.includes(affordance as EquipmentAffordance)) {
        errors.push(`equipment.affordances[${index}] must be a supported affordance.`);
      }
    });
  }
  if (!Array.isArray(input.snapZones)) {
    errors.push("equipment.snapZones must be an array.");
  } else {
    input.snapZones.forEach((zone, index) => {
      const zonePath = `equipment.snapZones[${index}]`;
      if (!isObject(zone)) {
        errors.push(`${zonePath} must be an object.`);
        return;
      }
      requireString(errors, zone.id, `${zonePath}.id`);
      requireString(errors, zone.label, `${zonePath}.label`);
      if (!isStringArray(zone.accepts)) errors.push(`${zonePath}.accepts must be a string array.`);
      requireNumber(errors, zone.x, `${zonePath}.x`);
      requireNumber(errors, zone.y, `${zonePath}.y`);
    });
  }
  requireString(errors, input.accessibleName, "equipment.accessibleName");
  return errors.length === 0
    ? { ok: true, value: input as unknown as EquipmentDefinition, errors: [] }
    : { ok: false, errors };
};

/**
 * Shape-only validation for the Cycle 02 atomic-identity contract.
 *
 * Both fields are optional so every pre-existing action stays valid without a backfill. Registry
 * membership, verb/interaction compatibility, and required-role coverage are enforced separately by
 * `scripts/checkContentConsistency.mjs`, which reads `src/domain/atomRegistry.json` and
 * `src/domain/equipmentRoleRegistry.json`. Keeping the registries out of this module also keeps
 * build-time source-trace data out of anything a runtime loader can reach.
 */
const validateAtomIdentity = (
  input: Record<string, unknown>,
  path: string,
  errors: string[],
  context: ValidationContext,
): void => {
  if (input.atomId !== undefined) {
    requireString(errors, input.atomId, `${path}.atomId`);
  }
  if (input.equipmentRoleBindings === undefined) return;
  if (!isObject(input.equipmentRoleBindings)) {
    errors.push(`${path}.equipmentRoleBindings must be an object.`);
    return;
  }
  if (input.atomId === undefined &&
    (!isString(input.id) || !context.compositionOwnedLegacyActionIds?.has(input.id))) {
    errors.push(`${path}.equipmentRoleBindings requires ${path}.atomId to name the atom that declares the role slots.`);
  }
  for (const [role, definitionId] of Object.entries(input.equipmentRoleBindings)) {
    const bindingPath = `${path}.equipmentRoleBindings["${role}"]`;
    if (!isString(role)) {
      errors.push(`${path}.equipmentRoleBindings keys must be non-empty role ids.`);
      continue;
    }
    if (!requireString(errors, definitionId, bindingPath)) continue;
    if (!equipmentById.has(definitionId)) {
      errors.push(`${bindingPath} references unknown equipment "${definitionId}".`);
    }
  }
};

export const validateActionDefinition = (
  input: unknown,
  path = "action",
  context: ValidationContext = {},
): ValidationResult<ActionDefinition> => {
  const errors: string[] = [];
  if (!isObject(input)) {
    return { ok: false, errors: [`${path} must be an object.`] };
  }
  requireString(errors, input.id, `${path}.id`);
  const actionVerb = actionVerbs.includes(input.verb as ActionVerb)
    ? (input.verb as ActionVerb)
    : undefined;
  if (!actionVerbs.includes(input.verb as ActionVerb)) {
    errors.push(`${path}.verb must be a supported v1 action verb.`);
  }
  requireString(errors, input.label, `${path}.label`);
  if (input.effect !== undefined) {
    if (!isObject(input.effect)) {
      errors.push(`${path}.effect must be an object when provided.`);
    } else {
      if (!isStringArray(input.effect.classes) || input.effect.classes.length === 0) {
        errors.push(`${path}.effect.classes must be a non-empty string array.`);
      }
      if (!Array.isArray(input.effect.targets)) {
        errors.push(`${path}.effect.targets must be an array.`);
      } else {
        input.effect.targets.forEach((target, index) => {
          if (!isObject(target)) errors.push(`${path}.effect.targets[${index}] must be an object.`);
          else {
            requireString(errors, target.domain, `${path}.effect.targets[${index}].domain`);
            if (target.reference !== undefined) {
              requireString(errors, target.reference, `${path}.effect.targets[${index}].reference`);
            }
          }
        });
      }
    }
  }
  validateAtomIdentity(input, path, errors, context);
  validateParameterMap(input.parameters, `${path}.parameters`, errors);
  validateActionVolumeContract(input, path, errors, actionVerb);
  validateActionMassContract(input, path, errors, actionVerb);
  validateSolidTransferContract(input, path, errors, actionVerb);
  if (input.extractionIdentity !== undefined) {
    if (!isObject(input.extractionIdentity) || !isString(input.extractionIdentity.vesselInstanceId) || Object.keys(input.extractionIdentity).some((key) => key !== "vesselInstanceId") || actionVerb !== "observe" || !isObject(input.interaction) || input.interaction.type !== "recordNotebook") errors.push(`${path}.extractionIdentity requires a named vessel and observation endpoint.`);
  }
  if (input.fractionHandling !== undefined) {
    for (const key of ["volume", "mass", "analysis", "runtimeRepeat", "sourceInventory", "solidTransfer", "materialTransition", "extractionOperation", "extractionObservation", "extractionIdentity", "extractionDrain", "choiceObservation"]) if (input[key] !== undefined) errors.push(`${path}.fractionHandling cannot compete with ${key}.`);
    const contract = input.fractionHandling;
    const verbs: Record<string, string> = { "remove-solvent": "dry", "remove-drying-agent": "transfer", "observe-residue": "observe", "collect-residue": "transfer", "observe-dryness": "dry", "observe-cooling": "cool", dispose: "transfer", "remove-label": "rinse" };
    if (!isObject(contract)) errors.push(`${path}.fractionHandling must be a typed contract.`);
    else {
      if (!isString(contract.operation) || verbs[contract.operation] !== actionVerb) errors.push(`${path}.fractionHandling operation and verb disagree.`);
      requireString(errors, contract.sourceInstanceId, `${path}.fractionHandling.sourceInstanceId`);
      requireString(errors, contract.fractionId, `${path}.fractionHandling.fractionId`);
      if (["collect-residue", "dispose", "remove-drying-agent"].includes(String(contract.operation))) requireString(errors, contract.targetInstanceId, `${path}.fractionHandling.targetInstanceId`);
      for (const key of Object.keys(contract)) if (!["operation", "sourceInstanceId", "targetInstanceId", "fractionId"].includes(key)) errors.push(`${path}.fractionHandling contains unsupported field ${key}.`);
    }
  }
  if (isObject(input.parameters) && input.parameters.instrumentEvidence !== undefined) {
    const units: Record<string, string> = { "read-aqueous-conductivity": "uS/cm", "read-solid-conductivity": "uS/cm", "read-ph-indicator": "pH", "read-melting-behavior": "C", "test-magnetic-response": "flag" };
    const operation = input.parameters.instrumentEvidence;
    if (!isString(operation) || !units[operation] || input.parameters.unit !== units[operation] || input.parameters.inputMode !== "numeric" || actionVerb !== "observe" || !isObject(input.interaction) || input.interaction.type !== "readInstrument") errors.push(`${path} requires a recognized numeric instrument operation, matching units and readInstrument endpoint.`);
  }
  validateActionContract15(input, path, errors, actionVerb);
  if (input.volume !== undefined && input.mass !== undefined) {
    errors.push(`${path} cannot declare both volume and mass contracts on one action.`);
  }
  if (input.dilutionFactorOutputId !== undefined) {
    requireString(errors, input.dilutionFactorOutputId, `${path}.dilutionFactorOutputId`);
    if (actionVerb !== "dilute" || input.volume === undefined) {
      errors.push(`${path}.dilutionFactorOutputId requires a contracted dilute action.`);
    }
  }
  if (
    isObject(input.parameters) &&
    input.parameters.configuredValue !== undefined &&
    input.parameters.configurationValue !== undefined
  ) {
    errors.push(`${path}.parameters cannot declare configuredValue and deprecated configurationValue together.`);
  }
  if (
    actionVerb === "calculate" &&
    isObject(input.parameters) &&
    input.parameters.template === "classifyMeasurementAgainstBound"
  ) {
    requireString(errors, input.parameters.measurementId, `${path}.parameters.measurementId`);
    requireString(errors, input.parameters.boundMeasurementId, `${path}.parameters.boundMeasurementId`);
    if (input.parameters.comparison !== "below" && input.parameters.comparison !== "above") {
      errors.push(`${path}.parameters.comparison must be "below" or "above" for classifyMeasurementAgainstBound.`);
    }
  }
  if (isObject(input.parameters) && input.parameters.titrationModelId !== undefined) {
    if (
      requireString(errors, input.parameters.titrationModelId, `${path}.parameters.titrationModelId`) &&
      context.titrationModelIds &&
      !context.titrationModelIds.has(input.parameters.titrationModelId)
    ) {
      errors.push(`${path}.parameters.titrationModelId must reference an existing titration model.`);
    }
  }
  if (isObject(input.parameters) && input.parameters.chromatographyModelId !== undefined) {
    if (
      requireString(errors, input.parameters.chromatographyModelId, `${path}.parameters.chromatographyModelId`) &&
      context.chromatographyModelIds &&
      !context.chromatographyModelIds.has(input.parameters.chromatographyModelId)
    ) {
      errors.push(`${path}.parameters.chromatographyModelId must reference an existing chromatography model.`);
    }
  }
  if (isObject(input.parameters) && input.parameters.kineticsModelId !== undefined) {
    const kineticsModelId = input.parameters.kineticsModelId;
    const conditionId = input.parameters.conditionId;
    if (
      requireString(errors, kineticsModelId, `${path}.parameters.kineticsModelId`) &&
      context.kineticsModelIds &&
      !context.kineticsModelIds.has(kineticsModelId)
    ) {
      errors.push(`${path}.parameters.kineticsModelId must reference an existing kinetics model.`);
    }
    if (
      requireString(errors, conditionId, `${path}.parameters.conditionId`) &&
      isString(kineticsModelId) &&
      context.kineticsConditionIdsByModelId
    ) {
      const conditionIds = context.kineticsConditionIdsByModelId.get(kineticsModelId);
      if (conditionIds && !conditionIds.has(conditionId)) {
        errors.push(`${path}.parameters.conditionId must reference a condition on the kinetics model.`);
      }
    }
    requireString(errors, input.parameters.dataSeriesId, `${path}.parameters.dataSeriesId`);
  }
  if (isObject(input.parameters) && input.parameters.template === "initialRateMlPerS") {
    if (
      requireString(errors, input.parameters.dataSeriesId, `${path}.parameters.dataSeriesId`) &&
      context.dataSeriesIds &&
      !context.dataSeriesIds.has(input.parameters.dataSeriesId)
    ) {
      errors.push(`${path}.parameters.dataSeriesId must reference an authored data series.`);
    }
  }
  if (input.interaction !== undefined) {
    validateInteractionSpec(input.interaction, `${path}.interaction`, errors, actionVerb, context);
  }
  validateAuthoredActionEndpoints(input, path, errors, actionVerb, context);
  validateThermalActionParameters(input, path, errors, actionVerb);
  validateRuleArray(input.prerequisites, `${path}.prerequisites`, errors, context);
  if (!isStringArray(input.stateChanges)) errors.push(`${path}.stateChanges must be a string array.`);
  if (!Array.isArray(input.invalidCases)) {
    errors.push(`${path}.invalidCases must be an array.`);
  } else {
    input.invalidCases.forEach((invalidCase, index) =>
      validateInvalidCase(invalidCase, `${path}.invalidCases[${index}]`, errors),
    );
  }
  if (!isObject(input.feedback)) {
    errors.push(`${path}.feedback must be an object.`);
  } else {
    requireString(errors, input.feedback.success, `${path}.feedback.success`);
    requireString(errors, input.feedback.invalid, `${path}.feedback.invalid`);
  }
  if (!isStringArray(input.evidence)) errors.push(`${path}.evidence must be a string array.`);
  return errors.length === 0
    ? { ok: true, value: input as unknown as ActionDefinition, errors: [] }
    : { ok: false, errors };
};

const validateEquipmentIds = (ids: unknown, path: string, errors: string[]): void => {
  if (!isStringArray(ids)) {
    errors.push(`${path} must be a string array.`);
    return;
  }
  ids.forEach((id, index) => {
    if (!equipmentById.has(id)) errors.push(`${path}[${index}] references unknown equipment "${id}".`);
  });
};

export const validateTechniqueDefinition = (
  input: unknown,
): ValidationResult<TechniqueDefinition> => {
  const errors: string[] = [];
  if (!isObject(input)) {
    return { ok: false, errors: ["Technique definition must be an object."] };
  }
  const actionIds = collectActionIds(input.actions);
  const equipmentIds = isStringArray(input.requiredEquipment)
    ? new Set(input.requiredEquipment)
    : undefined;
  const titrationModelIds = collectTitrationModelIds(input.titrationModels);
  const chromatographyModelIds = collectChromatographyModelIds(input.chromatographyModels);
  const kineticsModelIds = collectKineticsModelIds(input.kineticsModels);
  const kineticsConditionIdsByModelId = collectKineticsConditionIdsByModelId(input.kineticsModels);
  const dataSeriesIds = collectDataSeriesIds(input.actions);
  const techniqueInput = input as unknown as TechniqueDefinition;
  const compositionOwnedLegacyActionIds = isObject(input.composition) &&
    Array.isArray(input.composition.legacyActionEffects)
    ? new Set(input.composition.legacyActionEffects.flatMap((declaration) =>
      isObject(declaration) && isString(declaration.actionId) ? [declaration.actionId] : []))
    : undefined;
  const context = {
    actionIds,
    equipmentIds,
    titrationModelIds,
    chromatographyModelIds,
    kineticsModelIds,
    kineticsConditionIdsByModelId,
    dataSeriesIds,
    compositionOwnedLegacyActionIds,
  };
  requireString(errors, input.id, "technique.id");
  requireString(errors, input.title, "technique.title");
  requireString(errors, input.learningGoal, "technique.learningGoal");
  validateEquipmentIds(input.requiredEquipment, "technique.requiredEquipment", errors);
  validateTitrationModels(input.titrationModels, "technique.titrationModels", errors);
  validateChromatographyModels(input.chromatographyModels, "technique.chromatographyModels", errors);
  validateKineticsModels(input.kineticsModels, "technique.kineticsModels", errors);
  if (!isObject(input.initialState) || !Array.isArray(input.initialState.equipment)) {
    errors.push("technique.initialState.equipment must be an array.");
  } else {
    input.initialState.equipment.forEach((instance, index) => {
      if (!isObject(instance)) {
        errors.push(`technique.initialState.equipment[${index}] must be an object.`);
        return;
      }
      requireString(errors, instance.id, `technique.initialState.equipment[${index}].id`);
      const definitionId = requireString(errors, instance.definitionId, `technique.initialState.equipment[${index}].definitionId`)
        ? instance.definitionId
        : undefined;
      if (definitionId && !equipmentById.has(definitionId)) {
        errors.push(`technique.initialState.equipment[${index}].definitionId references unknown equipment.`);
      }
      requireString(errors, instance.label, `technique.initialState.equipment[${index}].label`);
      if (!equipmentLocations.includes(instance.location as EquipmentLocation)) {
        errors.push(`technique.initialState.equipment[${index}].location must be a supported equipment location.`);
      }
      if (instance.snapZoneId !== undefined) {
        if (requireString(errors, instance.snapZoneId, `technique.initialState.equipment[${index}].snapZoneId`)) {
          const snapZone = findSnapZone(instance.snapZoneId);
          if (!snapZone) {
            errors.push(`technique.initialState.equipment[${index}].snapZoneId references an unknown snap zone.`);
          } else if (definitionId && !snapZone.accepts.includes(definitionId)) {
            errors.push(`technique.initialState.equipment[${index}].snapZoneId does not accept this equipment definition.`);
          }
        }
      }
      if (instance.x !== undefined) requireNumber(errors, instance.x, `technique.initialState.equipment[${index}].x`);
      if (instance.y !== undefined) requireNumber(errors, instance.y, `technique.initialState.equipment[${index}].y`);
      if (instance.rotation !== undefined) requireNumber(errors, instance.rotation, `technique.initialState.equipment[${index}].rotation`);
      if (instance.zIndex !== undefined) requireNumber(errors, instance.zIndex, `technique.initialState.equipment[${index}].zIndex`);
      if (
        instance.interactionStatus !== undefined &&
        !equipmentInteractionStatuses.includes(instance.interactionStatus as EquipmentInteractionStatus)
      ) {
        errors.push(`technique.initialState.equipment[${index}].interactionStatus must be a supported interaction status.`);
      }
      if (!isObject(instance.contents)) errors.push(`technique.initialState.equipment[${index}].contents must be an object.`);
    });
  }
  let validatedActions: ActionDefinition[] | undefined;
  if (!Array.isArray(input.actions) || input.actions.length === 0) {
    errors.push("technique.actions must contain at least one action.");
  } else {
    const actionResults = input.actions.map((action, index) =>
      validateActionDefinition(action, `technique.actions[${index}]`, context));
    actionResults.forEach((result) => errors.push(...result.errors));
    if (actionResults.every((result) => result.ok && result.value)) {
      validatedActions = actionResults.map((result) => result.value!);
    }
  }
  validateProcess(input.process, "technique.process", errors, context);
  validateRuleArray(input.successCriteria, "technique.successCriteria", errors, context);
  if (!Array.isArray(input.commonMistakes)) {
    errors.push("technique.commonMistakes must be an array.");
  } else {
    input.commonMistakes.forEach((invalidCase, index) =>
      validateInvalidCase(invalidCase, `technique.commonMistakes[${index}]`, errors),
    );
  }
  if (input.resetBehavior !== "resetTechnique" && input.resetBehavior !== "resetLab") {
    errors.push("technique.resetBehavior must be resetTechnique or resetLab.");
  }
  validateOperationEndpoints(Array.isArray(input.actions) ? input.actions : [], isObject(input.initialState) && Array.isArray(input.initialState.equipment) ? input.initialState.equipment : [], "technique.actions", errors);
  validateMetadata(input.metadata, "technique.metadata", errors);
  const compositionValidation = input.composition !== undefined
    ? validateTechniqueCompositionContract(techniqueInput)
    : undefined;
  if (compositionValidation) {
    errors.push(...compositionValidation.errors);
  }
  if (Array.isArray(input.actions)) {
    const allowedStructuralMassOutputDuplicates =
      validatedActions && compositionValidation?.ok
        ? structurallyExclusiveMassOutputIds(
          validatedActions,
          techniqueInput.composition?.orderedProcedure,
        )
        : new Set<string>();
    validateStructuredEvidenceContinuity(
      input.actions,
      "technique.actions",
      errors,
      allowedStructuralMassOutputDuplicates,
    );
  }
  return errors.length === 0
    ? { ok: true, value: input as unknown as TechniqueDefinition, errors: [] }
    : { ok: false, errors };
};

export interface LabValidationOptions {
  /**
   * Action ids a bundled source will import through `techniqueRefs`, so that a raw source can be
   * validated before hydration resolves them. `"unresolved"` means at least one reference selects
   * `"all"`, whose members cannot be known without loading the technique; action-id resolution is
   * then skipped and left to the post-hydration pass, which sees the real array.
   */
  importedActionIds?: ReadonlySet<string> | "unresolved";
  /** Raw composition sources may delegate their root to a typed technique entry port. */
  allowTechniqueOwnedProcessStart?: boolean;
}

export const validateLabDefinition = (
  input: unknown,
  options: LabValidationOptions = {},
): ValidationResult<LabDefinition> => {
  const errors: string[] = [];
  if (!isObject(input)) {
    return { ok: false, errors: ["Lab definition must be an object."] };
  }
  const declaredActionIds = collectActionIds(input.actions);
  const actionIds =
    options.importedActionIds === "unresolved"
      ? undefined
      : options.importedActionIds
        ? new Set([...declaredActionIds, ...options.importedActionIds])
        : declaredActionIds;
  const equipmentIds = isStringArray(input.equipment) ? new Set(input.equipment) : undefined;
  const titrationModelIds = collectDefinitionTitrationModelIds(input);
  const chromatographyModelIds = collectDefinitionChromatographyModelIds(input);
  const kineticsModelIds = collectDefinitionKineticsModelIds(input);
  const kineticsConditionIdsByModelId = collectDefinitionKineticsConditionIdsByModelId(input);
  const dataSeriesIds = collectDefinitionDataSeriesIds(input);
  const compositionOwnedLegacyActionIds = isObject(input.compositionManifest) &&
    (input.compositionManifest.compilerContractVersion === "1.2" ||
      input.compositionManifest.compilerContractVersion === "1.3" ||
      input.compositionManifest.compilerContractVersion === "1.4" ||
      input.compositionManifest.compilerContractVersion === "1.5" || input.compositionManifest.compilerContractVersion === "1.6") &&
    Array.isArray(input.compositionManifest.origins)
    ? new Set(input.compositionManifest.origins.flatMap((origin) =>
      isObject(origin) && isString(origin.actionId) ? [origin.actionId] : []))
    : undefined;
  const context = {
    actionIds,
    equipmentIds,
    titrationModelIds,
    chromatographyModelIds,
    kineticsModelIds,
    kineticsConditionIdsByModelId,
    dataSeriesIds,
    allowExternalProcessStart: options.allowTechniqueOwnedProcessStart,
    allowEmptyProcessNodes: options.allowTechniqueOwnedProcessStart,
    compositionOwnedLegacyActionIds,
  };
  requireString(errors, input.id, "lab.id");
  requireString(errors, input.title, "lab.title");
  requireString(errors, input.description, "lab.description");
  requireString(errors, input.audience, "lab.audience");
  if (!isStringArray(input.learningGoals)) errors.push("lab.learningGoals must be a string array.");
  if (!isStringArray(input.safetyNotes)) errors.push("lab.safetyNotes must be a string array.");
  validateEquipmentIds(input.equipment, "lab.equipment", errors);
  validateTitrationModels(input.titrationModels, "lab.titrationModels", errors);
  validateChromatographyModels(input.chromatographyModels, "lab.chromatographyModels", errors);
  validateKineticsModels(input.kineticsModels, "lab.kineticsModels", errors);
  if (!Array.isArray(input.techniques)) {
    errors.push("lab.techniques must be an array.");
  } else {
    input.techniques.forEach((technique, index) => {
      errors.push(
        ...validateTechniqueDefinition(technique).errors.map((error) => `lab.techniques[${index}]: ${error}`),
      );
    });
  }
  if (!Array.isArray(input.actions)) {
    errors.push("lab.actions must be an array.");
  } else {
    input.actions.forEach((action, index) => {
      errors.push(...validateActionDefinition(action, `lab.actions[${index}]`, context).errors);
    });
    validateStructuredEvidenceContinuity(input.actions, "lab.actions", errors);
    const endpointEquipment = [
      ...(isObject(input.initialState) && Array.isArray(input.initialState.equipment) ? input.initialState.equipment : []),
      ...(Array.isArray(input.techniques) ? input.techniques.flatMap((technique) => isObject(technique) && isObject(technique.initialState) && Array.isArray(technique.initialState.equipment) ? technique.initialState.equipment : []) : []),
    ];
    validateOperationEndpoints(input.actions, endpointEquipment, "lab.actions", errors);
  }
  validateProcess(input.process, "lab.process", errors, context);
  validateRuleArray(input.assessments, "lab.assessments", errors, context);
  if (input.compositionManifest !== undefined) {
    const manifestValidation = validateCompositionManifest(input.compositionManifest);
    errors.push(
      ...manifestValidation.errors.map(
        (error) => `lab.${error}`,
      ),
    );
    if (manifestValidation.ok && manifestValidation.value) {
      const nodes = new Map(
        (Array.isArray(input.process) ? [] : isObject(input.process) && Array.isArray(input.process.nodes)
          ? input.process.nodes.filter(isObject).map((node) => [node.id, node])
          : []) as Array<[unknown, Record<string, unknown>]>,
      );
      const actions = new Set(
        Array.isArray(input.actions)
          ? input.actions.filter(isObject).map((action) => action.id).filter(isString)
          : [],
      );
      for (const origin of manifestValidation.value.origins) {
        if (origin.actionId !== undefined && !actions.has(origin.actionId)) {
          errors.push(`lab.compositionManifest origin references missing compiled action "${origin.actionId}".`);
        }
        const node = nodes.get(origin.nodeId);
        if (!node) errors.push(`lab.compositionManifest origin references missing compiled node "${origin.nodeId}".`);
        else if (node.actionId !== origin.actionId) {
          errors.push(`lab.compositionManifest origin node "${origin.nodeId}" does not reference action "${origin.actionId}".`);
        }
      }
      const validationRuleIds = new Set<string>();
      if (Array.isArray(input.assessments)) {
        input.assessments.filter(isObject).forEach((rule) => {
          if (isString(rule.id)) validationRuleIds.add(rule.id);
        });
      }
      if (Array.isArray(input.actions)) {
        input.actions.filter(isObject).forEach((action) => {
          if (Array.isArray(action.prerequisites)) action.prerequisites.filter(isObject).forEach((rule) => {
            if (isString(rule.id)) validationRuleIds.add(rule.id);
          });
        });
      }
      if (isObject(input.process) && Array.isArray(input.process.nodes)) {
        input.process.nodes.filter(isObject).forEach((node) => {
          if (Array.isArray(node.validation)) node.validation.filter(isObject).forEach((rule) => {
            if (isString(rule.id)) validationRuleIds.add(rule.id);
          });
        });
      }
      for (const instance of manifestValidation.value.instances) {
        for (const output of instance.evidenceOutputs) {
          if (!actions.has(output.actionId)) {
            errors.push(`lab.compositionManifest evidence output "${output.id}" references missing action "${output.actionId}".`);
          }
        }
        for (const nodeId of instance.completion.exitNodeIds) {
          if (!nodes.has(nodeId)) {
            errors.push(`lab.compositionManifest completion references missing exit node "${nodeId}".`);
          }
        }
        for (const ruleId of instance.completion.requiredValidationRuleIds) {
          if (!validationRuleIds.has(ruleId)) {
            errors.push(`lab.compositionManifest completion references missing validation rule "${ruleId}".`);
          }
        }
        const outputIds = new Set(instance.evidenceOutputs.map((output) => output.id));
        for (const outputId of instance.completion.requiredEvidenceOutputIds) {
          if (!outputIds.has(outputId)) {
            errors.push(`lab.compositionManifest completion references missing evidence output "${outputId}".`);
          }
        }
      }
    }
  }
  validateMetadata(input.metadata, "lab.metadata", errors);
  return errors.length === 0
    ? { ok: true, value: input as unknown as LabDefinition, errors: [] }
    : { ok: false, errors };
};

/**
 * Structural contract for one `techniqueRefs` entry.
 *
 * Returns the ids the entry selects, or `"unresolved"` for `"all"`. A malformed entry contributes
 * nothing, so one bad reference produces its own error rather than a cascade of unresolved-node
 * errors from the lab contract below.
 */
const validateTechniqueActionRef = (
  input: unknown,
  path: string,
  errors: string[],
): ReadonlySet<string> | "unresolved" | undefined => {
  if (!isObject(input)) {
    errors.push(`${path} must be an object.`);
    return undefined;
  }
  requireString(errors, input.techniqueId, `${path}.techniqueId`);
  if (!isString(input.version)) {
    errors.push(`${path}.version must be an exact non-empty technique version.`);
  }
  if (input.actionIds === "all") return "unresolved";
  if (!Array.isArray(input.actionIds) || input.actionIds.length === 0) {
    errors.push(`${path}.actionIds must be "all" or a non-empty array of action ids.`);
    return undefined;
  }
  const selected = new Set<string>();
  input.actionIds.forEach((actionId, index) => {
    if (!requireString(errors, actionId, `${path}.actionIds[${index}]`)) return;
    if (selected.has(actionId)) {
      errors.push(`${path}.actionIds[${index}] repeats action id "${actionId}".`);
      return;
    }
    selected.add(actionId);
  });
  return selected;
};

/**
 * Contract for a raw bundled lab file, checked *before* hydration.
 *
 * Deliberately separate from `validateLabDefinition`: a raw source's `process` may reference actions
 * that only exist inside a referenced technique, so the resolved contract cannot be applied yet.
 *
 * This contract is the most permissive of the three. It checks the *shape* of `techniqueRefs` and
 * seeds the ids they select, but it cannot know whether a technique publishes a selected action, or
 * whether an imported id collides with a lab-local one. `hydrateBundledLab` decides both, then
 * re-runs `validateLabDefinition` on its output, so nothing relaxed here reaches the runtime
 * unchecked. `scripts/checkContentConsistency.mjs` enforces the same rules statically in CI.
 */
export const validateBundledLabSource = (
  input: unknown,
): ValidationResult<BundledLabSourceDefinition> => {
  if (!isObject(input)) {
    return { ok: false, errors: ["Bundled lab source must be an object."] };
  }
  const errors: string[] = [];
  let importedActionIds: ReadonlySet<string> | "unresolved" | undefined;

  if (input.techniqueInstances !== undefined) {
    const compositionResult = validateLabCompositionSourceShape(input);
    errors.push(...compositionResult.errors);
    importedActionIds = "unresolved";
  }

  if (input.techniqueRefs !== undefined) {
    if (input.techniqueInstances !== undefined) {
      errors.push("lab.techniqueRefs and lab.techniqueInstances are mutually exclusive.");
    }
    if (!Array.isArray(input.techniqueRefs)) {
      errors.push("lab.techniqueRefs must be an array when provided.");
    } else {
      const imported = new Set<string>();
      let unresolved = false;
      const referencedTechniqueIds = new Set<string>();
      input.techniqueRefs.forEach((ref, index) => {
        const path = `lab.techniqueRefs[${index}]`;
        const selected = validateTechniqueActionRef(ref, path, errors);
        if (isObject(ref) && isString(ref.techniqueId)) {
          if (referencedTechniqueIds.has(ref.techniqueId)) {
            errors.push(`${path}.techniqueId repeats technique "${ref.techniqueId}".`);
          }
          referencedTechniqueIds.add(ref.techniqueId);
        }
        if (selected === "unresolved") unresolved = true;
        else if (selected) selected.forEach((actionId) => imported.add(actionId));
      });
      importedActionIds = unresolved ? "unresolved" : imported;
    }
  }

  const labResult = validateLabDefinition(input, {
    importedActionIds,
    allowTechniqueOwnedProcessStart: input.compositionStart !== undefined,
  });
  errors.push(...labResult.errors);
  return errors.length === 0
    ? { ok: true, value: input as unknown as BundledLabSourceDefinition, errors: [] }
    : { ok: false, errors };
};

/** Full raw composition-source validator retained next to the existing schema validators. */
export const validateLabCompositionSource = (
  input: unknown,
): ValidationResult<LabCompositionSourceDefinition> => {
  const shape = validateLabCompositionSourceShape(input);
  const lab = validateLabDefinition(input, {
    importedActionIds: "unresolved",
    allowTechniqueOwnedProcessStart: isObject(input) && input.compositionStart !== undefined,
  });
  const errors = [...shape.errors, ...lab.errors];
  return errors.length === 0
    ? { ok: true, value: input as LabCompositionSourceDefinition, errors: [] }
    : { ok: false, errors };
};

export const validateImportedDefinition = (
  input: unknown,
): ValidationResult<LabDefinition | TechniqueDefinition> => {
  if (isObject(input) && (input.techniqueRefs !== undefined || input.techniqueInstances !== undefined)) {
    return {
      ok: false,
      errors: [
        "Imported JSON is an unresolved bundled lab source, not a self-contained LabDefinition.",
        "Resolve or compile its exact-version technique references before portable import.",
      ],
    };
  }
  if (
    isObject(input)
    && input.schema === "assay-studio.assay-definition"
  ) {
    return {
      ok: false,
      errors: [
        "Imported JSON did not match LabDefinition or TechniqueDefinition.",
        "This is an Assay Studio artifact. Open Assay Studio to import .assay.json files; the chemistry Studio accepts only LabDefinition or TechniqueDefinition JSON.",
      ],
    };
  }
  const labResult = validateLabDefinition(input);
  if (labResult.ok) return labResult;
  const techniqueResult = validateTechniqueDefinition(input);
  if (techniqueResult.ok) return techniqueResult;
  return {
    ok: false,
    errors: [
      "Imported JSON did not match LabDefinition or TechniqueDefinition.",
      ...labResult.errors.map((error) => `Lab: ${error}`),
      ...techniqueResult.errors.map((error) => `Technique: ${error}`),
    ],
  };
};
