import { deriveTitrationDropPlan, type TitrationDropPlan } from "../domain/titrationModels";
import type { AcidBaseTitrationModel } from "../domain/types";
import { equipmentById } from "../equipment/catalog";
import {
  ACID_RESERVE_ML,
  acidBaseTitrationFamily,
  composerChemicalContainers,
  composerEquipmentIds,
  DEFAULT_BURETTE_FILL_ML,
  INDICATOR_ADDITION_ML,
  NAOH_RESERVE_ML,
  roleDefinitionIds,
  SYNTHETIC_UNKNOWN_ACID_MOLARITY_M,
} from "./catalogs";
import {
  experimentRequestValidator,
  inventoryValidator,
  validateSchema,
} from "./schemas";
import type {
  ComposerErrorCode,
  ComposerRoleId,
  ComposerValidationIssue,
  ExperimentRequest,
  LabInventoryProfile,
} from "./types";

export interface ValidatedExperimentInputs {
  request: ExperimentRequest;
  inventory: LabInventoryProfile;
  resolvedRoles: Record<ComposerRoleId, string>;
  titrantMolarityM: number;
  plan: TitrationDropPlan;
}

export type ExperimentInputValidationResult =
  | { ok: true; value: ValidatedExperimentInputs }
  | { ok: false; issues: ComposerValidationIssue[] };

const issue = (
  code: ComposerErrorCode,
  phase: ComposerValidationIssue["phase"],
  message: string,
  path?: string,
): ComposerValidationIssue => ({ code, phase, message, path, recoverable: true });

const firstPhaseFailure = (issues: ComposerValidationIssue[]): ExperimentInputValidationResult => ({
  ok: false,
  issues,
});

const equipmentCount = (inventory: LabInventoryProfile, definitionId: string): number =>
  inventory.equipment
    .filter((item) => item.definitionId === definitionId)
    .reduce((total, item) => total + item.count, 0);

const chemical = (inventory: LabInventoryProfile, chemicalId: string) =>
  inventory.chemicals.find((item) => item.chemicalId === chemicalId);

const modelFor = (request: ExperimentRequest, titrantMolarityM: number): AcidBaseTitrationModel => ({
  id: "composer-unknown-acid-naoh",
  type: "acidBase",
  analyte: {
    formula: "CH3COOH",
    role: "acid",
    strength: "weak",
    equilibriumConstant: 1.753e-5,
    equilibriumConstantSource: "https://nvlpubs.nist.gov/nistpubs/jres/100/5/j15wu.pdf",
  },
  titrant: { formula: "NaOH", role: "base", strength: "strong" },
  analyteMolarityM: SYNTHETIC_UNKNOWN_ACID_MOLARITY_M,
  analyteVolumeMl: request.aliquotVolumeMl,
  titrantMolarityM,
  stoichiometricRatio: { analyte: 1, titrant: 1 },
  dropVolumeMl: 0.05,
  endpointOffsetDrops: 0,
  maxExtraDrops: 5,
  temperatureC: 25,
  waterIonProduct: 1e-14,
  phPrecision: 2,
});

export const validateExperimentRequest = (
  requestInput: unknown,
  inventoryInput: unknown,
): ExperimentInputValidationResult => {
  // 1. JSON Schema. Both untrusted objects are checked before any semantic access.
  const requestResult = validateSchema(experimentRequestValidator, requestInput);
  const inventoryResult = validateSchema(inventoryValidator, inventoryInput);
  if (!requestResult.ok || !inventoryResult.ok) {
    const diagnostics = [
      ...(requestResult.ok ? [] : requestResult.diagnostics),
      ...(inventoryResult.ok ? [] : inventoryResult.diagnostics),
    ];
    const unsupportedFamily = !requestResult.ok && requestResult.diagnostics.some(
      (diagnostic) => diagnostic.path === "/familyId" && diagnostic.code === "schema.const",
    );
    return {
      ok: false,
      issues: [{
        code: unsupportedFamily ? "UNSUPPORTED_EXPERIMENT_FAMILY" : "SCHEMA_VALIDATION_FAILED",
        phase: "schema",
        message: unsupportedFamily
          ? "Only familyId 'acid_base_titration_v1' is supported in this build."
          : "The request or inventory does not match the strict Composer schema.",
        recoverable: true,
        diagnostics,
      }],
    };
  }
  const request = requestResult.value;
  const inventory = inventoryResult.value;

  // 2. Explicit inventory concurrency.
  if (request.expectedInventoryRevision !== inventory.revision) {
    return firstPhaseFailure([issue(
      "STALE_INVENTORY_REVISION",
      "revision",
      `Inventory revision ${inventory.revision} is current; retry with expectedInventoryRevision ${inventory.revision}.`,
      "/expectedInventoryRevision",
    )]);
  }

  // 3. Supported family/options. Schema enums are repeated here deliberately as an application gate.
  if (request.familyId !== acidBaseTitrationFamily.id) {
    return firstPhaseFailure([issue(
      "UNSUPPORTED_EXPERIMENT_FAMILY",
      "request_options",
      "Only the verified synthetic monoprotic-acid titration family is supported.",
      "/familyId",
    )]);
  }
  if (
    !acidBaseTitrationFamily.parameterBounds.aliquotVolumeMl.includes(request.aliquotVolumeMl)
    || request.endpointEvidence !== "phenolphthalein"
  ) {
    return firstPhaseFailure([issue(
      "UNSUPPORTED_REQUEST_OPTION",
      "request_options",
      "Use aliquotVolumeMl 10, 20, or 25 and endpointEvidence 'phenolphthalein'.",
    )]);
  }

  // 4. Equipment and role resolution. Chemical containers resolve roles separately and are not
  // duplicated in the equipment array.
  const roleIssues: ComposerValidationIssue[] = [];
  const duplicateEquipment = new Set<string>();
  const seenEquipment = new Set<string>();
  for (const item of inventory.equipment) {
    if (seenEquipment.has(item.definitionId)) duplicateEquipment.add(item.definitionId);
    seenEquipment.add(item.definitionId);
    if (!composerEquipmentIds.includes(item.definitionId as (typeof composerEquipmentIds)[number])) {
      roleIssues.push(issue(
        "UNKNOWN_EQUIPMENT_ID",
        "roles",
        `Equipment definitionId '${item.definitionId}' is not supported by this Composer family.`,
        "/equipment",
      ));
    }
  }
  duplicateEquipment.forEach((definitionId) => roleIssues.push(issue(
    "DUPLICATE_EQUIPMENT_ID",
    "roles",
    `Equipment definitionId '${definitionId}' appears more than once; combine it into one count.`,
    "/equipment",
  )));
  const requiredEquipment: Array<[string, ComposerErrorCode, string]> = [
    [roleDefinitionIds.burette, "MISSING_BURETTE", "A 50 mL burette is required. Add definitionId 'burette-50ml'."],
    [roleDefinitionIds.burette_support, "MISSING_BURETTE_SUPPORT", "A ring stand and clamp are required. Add definitionId 'ring-stand-clamp'."],
    [roleDefinitionIds.aliquot_measure, "MISSING_GRADUATED_CYLINDER", "A graduated cylinder is required. Add definitionId 'graduated-cylinder'."],
    [roleDefinitionIds.receiving_flask, "MISSING_RECEIVING_FLASK", "A 250 mL Erlenmeyer flask is required. Add definitionId 'erlenmeyer-flask-250ml'."],
    [roleDefinitionIds.waste_receiver, "MISSING_WASTE_RECEIVER", "A waste beaker is required. Add definitionId 'waste-beaker'."],
  ];
  requiredEquipment.forEach(([definitionId, code, message]) => {
    if (equipmentCount(inventory, definitionId) < 1) roleIssues.push(issue(code, "roles", message));
  });
  if (roleIssues.length > 0) return firstPhaseFailure(roleIssues);

  // 5. Chemical identities, quantities, containers, and titrant concentration.
  const chemicalIssues: ComposerValidationIssue[] = [];
  const chemicalById = new Map(inventory.chemicals.map((item) => [item.chemicalId, item]));
  if (chemicalById.size !== inventory.chemicals.length) {
    chemicalIssues.push(issue(
      "DUPLICATE_CHEMICAL_ID",
      "chemicals",
      "Each supported chemicalId must appear exactly once.",
      "/chemicals",
    ));
  }
  const analyte = chemical(inventory, "synthetic_unknown_acid_a");
  const titrant = chemical(inventory, "standardized_naoh");
  const indicator = chemical(inventory, "phenolphthalein_indicator");
  if (!analyte) chemicalIssues.push(issue("MISSING_ANALYTE", "chemicals", "Add chemicalId 'synthetic_unknown_acid_a'."));
  if (!titrant) chemicalIssues.push(issue("MISSING_TITRANT", "chemicals", "Add chemicalId 'standardized_naoh'."));
  if (!indicator) chemicalIssues.push(issue("MISSING_INDICATOR", "chemicals", "Add chemicalId 'phenolphthalein_indicator'."));
  for (const item of inventory.chemicals) {
    const expectedContainer = composerChemicalContainers[item.chemicalId];
    if (item.containerDefinitionId !== expectedContainer) {
      chemicalIssues.push(issue(
        "INVALID_CHEMICAL_CONTAINER",
        "chemicals",
        `${item.chemicalId} requires containerDefinitionId '${expectedContainer}'.`,
        "/chemicals",
      ));
    }
    const container = equipmentById.get(item.containerDefinitionId);
    if (!container || container.capacity.unit !== "mL" || item.quantityMl > container.capacity.amount) {
      chemicalIssues.push(issue(
        "INVALID_CHEMICAL_QUANTITY",
        "chemicals",
        `${item.chemicalId} quantity must fit its verified container capacity.`,
        "/chemicals",
      ));
    }
  }
  if (
    titrant
    && (titrant.concentrationM === undefined
      || titrant.concentrationM < acidBaseTitrationFamily.parameterBounds.titrantMolarityM.min
      || titrant.concentrationM > acidBaseTitrationFamily.parameterBounds.titrantMolarityM.max)
  ) {
    chemicalIssues.push(issue(
      "INVALID_TITRANT_CONCENTRATION",
      "chemicals",
      "Standardized NaOH concentrationM must be between 0.05 M and 0.20 M.",
      "/chemicals",
    ));
  }
  if (analyte?.concentrationM !== undefined) {
    chemicalIssues.push(issue(
      "COMPILER_OWNED_CHEMICAL_FIELD",
      "chemicals",
      "The synthetic analyte concentration is compiler-owned; omit concentrationM from that chemical item.",
      "/chemicals",
    ));
  }
  if (indicator?.concentrationM !== undefined) {
    chemicalIssues.push(issue(
      "COMPILER_OWNED_CHEMICAL_FIELD",
      "chemicals",
      "Phenolphthalein concentration is not an input for this model; omit concentrationM.",
      "/chemicals",
    ));
  }
  if (chemicalIssues.length > 0 || !analyte || !titrant || !indicator || titrant.concentrationM === undefined) {
    return firstPhaseFailure(chemicalIssues);
  }

  // 6. Physical readiness is declaration-gated; virtual training is not silently substituted.
  if (request.deliveryContext === "physical_procedure_rehearsal") {
    const missing = Object.entries(inventory.facilities)
      .filter(([, declared]) => !declared)
      .map(([name]) => name);
    if (missing.length > 0) {
      return firstPhaseFailure([issue(
        "MISSING_PHYSICAL_FACILITY",
        "facilities",
        `Physical procedure rehearsal requires declarations for: ${missing.join(", ")}.`,
        "/facilities",
      )]);
    }
  }

  // 7. Equipment capacity and reagent-quantity feasibility.
  const capacityIssues: ComposerValidationIssue[] = [];
  const graduatedCapacity = equipmentById.get(roleDefinitionIds.aliquot_measure)?.capacity.amount ?? 0;
  const flaskCapacity = equipmentById.get(roleDefinitionIds.receiving_flask)?.capacity.amount ?? 0;
  const buretteCapacity = equipmentById.get(roleDefinitionIds.burette)?.capacity.amount ?? 0;
  if (request.aliquotVolumeMl > graduatedCapacity) {
    capacityIssues.push(issue("CAPACITY_EXCEEDED", "capacity", "The aliquot exceeds graduated-cylinder capacity."));
  }
  if (DEFAULT_BURETTE_FILL_ML > buretteCapacity) {
    capacityIssues.push(issue("CAPACITY_EXCEEDED", "capacity", "The modeled burette fill exceeds 50 mL capacity."));
  }
  if (analyte.quantityMl < request.aliquotVolumeMl + ACID_RESERVE_ML) {
    capacityIssues.push(issue(
      "INSUFFICIENT_ACID_QUANTITY",
      "capacity",
      `Synthetic acid quantity must be at least ${request.aliquotVolumeMl + ACID_RESERVE_ML} mL for the aliquot and reserve.`,
    ));
  }
  if (titrant.quantityMl < DEFAULT_BURETTE_FILL_ML + NAOH_RESERVE_ML) {
    capacityIssues.push(issue(
      "INSUFFICIENT_NAOH_QUANTITY",
      "capacity",
      `NaOH quantity must be at least ${DEFAULT_BURETTE_FILL_ML + NAOH_RESERVE_ML} mL for the prefilled burette and reserve.`,
    ));
  }
  if (indicator.quantityMl < INDICATOR_ADDITION_ML) {
    capacityIssues.push(issue(
      "INSUFFICIENT_INDICATOR_QUANTITY",
      "capacity",
      `Phenolphthalein quantity must be at least ${INDICATOR_ADDITION_ML} mL.`,
    ));
  }
  if (capacityIssues.length > 0) return firstPhaseFailure(capacityIssues);

  // 8. Authoritative titration-model derivation.
  let plan: TitrationDropPlan;
  try {
    plan = deriveTitrationDropPlan(modelFor(request, titrant.concentrationM), {
      initialBuretteReadingMl: 0,
    });
  } catch (error) {
    return firstPhaseFailure([issue(
      "TITRATION_MODEL_DERIVATION_FAILED",
      "model",
      error instanceof Error ? error.message : "The titration model could not be derived.",
    )]);
  }
  const maximumDeliveryMl = plan.endpointDeliveredVolumeMl + plan.maxExtraDrops * plan.dropVolumeMl;
  if (maximumDeliveryMl > buretteCapacity) {
    return firstPhaseFailure([issue(
      "CAPACITY_EXCEEDED",
      "capacity",
      `The endpoint plus allowed extra drops requires ${maximumDeliveryMl.toFixed(2)} mL, exceeding the 50 mL burette. Increase NaOH concentration or choose a smaller aliquot.`,
    )]);
  }
  if (request.aliquotVolumeMl + INDICATOR_ADDITION_ML + plan.endpointDeliveredVolumeMl > flaskCapacity) {
    return firstPhaseFailure([issue(
      "CAPACITY_EXCEEDED",
      "capacity",
      "The aliquot, indicator, and modeled endpoint titrant exceed the receiving-flask capacity.",
    )]);
  }

  return {
    ok: true,
    value: {
      request,
      inventory,
      resolvedRoles: { ...roleDefinitionIds },
      titrantMolarityM: titrant.concentrationM,
      plan,
    },
  };
};
