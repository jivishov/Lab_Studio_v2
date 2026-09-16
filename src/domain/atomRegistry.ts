import { titrationOperations } from "./titrationOperations";
import rawAtomRegistry from "./atomRegistry.json";
import rawEquipmentRoleRegistry from "./equipmentRoleRegistry.json";
import type {
  ActionDefinition,
  ActionEffectClass,
  ActionEffectContract,
  ActionEffectTargetDomain,
  ActionInteractionType,
  ActionVerb,
  EquipmentCategory,
} from "./types";
import { resolveActionInteraction } from "./interactions";

/**
 * Typed readers for the Cycle 02 behavioural contracts.
 *
 * The JSON files are the source of truth. `docs/atomic-steps.md` is generated from
 * `atomRegistry.json`, and `scripts/checkContentConsistency.mjs` enforces both registries against
 * authored content. Nothing here carries source-trace data: that registry lives under
 * `docs/architecture/` precisely so no runtime loader can reach it.
 */

export type EquipmentRoleKind =
  | "instrument"
  | "vessel"
  | "delivery"
  | "consumable"
  | "tool"
  | "support";

export interface EquipmentRoleDefinition {
  id: string;
  label: string;
  kind: EquipmentRoleKind;
  /** Free-form, registry-declared constraints. Names are documented in the JSON entry. */
  constraints: Record<string, string | number | boolean>;
  allowedEquipmentIds: string[];
  prohibitedEquipmentIds?: string[];
  rationale: string;
  /** Roles this one must not be confused with, for example analyte receiver versus probe vessel. */
  distinguishedFrom?: string[];
}

/**
 * Which table in the dated plan the step lives in. A `phase` table carries an explicit `Basis`
 * column; an `apparatus`-assembly table does not, so an `apparatus` citation's basis must include
 * `F` rather than claim the manual states that exact step.
 */
export type AtomSourceTable = "phase" | "apparatus" | "safety";

export interface AtomSourceExample {
  sourceFile: string;
  sourceTable: AtomSourceTable;
  step: string;
  /** `M`, `F`, `R`, `C`, or a compound form such as `M/F` or `R/C`. */
  basis: string;
}

export interface AtomContentExample {
  /** `lab:<id>`, `lab:<id>/technique:<tid>`, or `technique:<id>`. */
  owner: string;
  actionId: string;
}

export interface AtomDefinition {
  id: string;
  family: string;
  /** Documentation wording only. Learner-facing action labels stay contextual. */
  documentationLabel: string;
  verb: ActionVerb;
  allowedInteractionTypes: ActionInteractionType[];
  effectContract: ActionEffectContract;
  requiredRoles: string[];
  optionalRoles: string[];
  proceduralConstraints: string[];
  evidence: string;
  sourceExamples: AtomSourceExample[];
  contentExamples: AtomContentExample[];
}

export interface AtomRegistry {
  schema: string;
  cycle: string;
  roleRegistry: string;
  documentationOutput: string;
  consumedBy: string[];
  policy: string;
  basisLegend: Record<string, string>;
  sourceTableLegend: Record<AtomSourceTable, string>;
  seedScope: string;
  atoms: AtomDefinition[];
}

export interface EquipmentRoleRegistry {
  schema: string;
  cycle: string;
  consumedBy: string[];
  policy: string;
  kindCategoryConstraints: Record<EquipmentRoleKind, EquipmentCategory[]>;
  roles: EquipmentRoleDefinition[];
}

export const atomRegistry = rawAtomRegistry as unknown as AtomRegistry;

export const equipmentRoleRegistry =
  rawEquipmentRoleRegistry as unknown as EquipmentRoleRegistry;

export const atomById: ReadonlyMap<string, AtomDefinition> = new Map(
  atomRegistry.atoms.map((atom) => [atom.id, atom]),
);

export const equipmentRoleById: ReadonlyMap<string, EquipmentRoleDefinition> = new Map(
  equipmentRoleRegistry.roles.map((role) => [role.id, role]),
);

export const atomFamilies: readonly string[] = [
  ...new Set(atomRegistry.atoms.map((atom) => atom.family)),
].sort();

/** Every role slot the atom requires, in declaration order. */
export const requiredRolesForAtom = (atomId: string): readonly string[] =>
  atomById.get(atomId)?.requiredRoles ?? [];

/**
 * True when the equipment definition may fill the role. An unknown role is not permissive: callers
 * must treat it as a contract error, which is what the content checker reports.
 */
export const roleAcceptsEquipment = (roleId: string, definitionId: string): boolean => {
  const role = equipmentRoleById.get(roleId);
  if (!role) return false;
  if (role.prohibitedEquipmentIds?.includes(definitionId)) return false;
  return role.allowedEquipmentIds.includes(definitionId);
};

/** Role slots an action leaves unbound. Empty means the atom's required coverage is complete. */
export const missingRoleBindings = (
  atomId: string,
  bindings: Record<string, string> | undefined,
): readonly string[] =>
  requiredRolesForAtom(atomId).filter((role) => {
    const bound = bindings?.[role];
    return typeof bound !== "string" || bound.trim().length === 0;
  });

const operationEffectClasses: Record<ActionInteractionType, readonly ActionEffectClass[]> = {
  dragToZone: ["apparatus-material-instrument-state"],
  snapIntoTarget: ["apparatus-material-instrument-state"],
  pourInto: ["apparatus-material-instrument-state"],
  dispenseDrops: ["apparatus-material-instrument-state"],
  spotOnto: ["apparatus-material-instrument-state"],
  rinseTarget: ["apparatus-material-instrument-state"],
  placeInInstrument: ["apparatus-material-instrument-state"],
  readInstrument: ["measurement-direct-observation-acquisition"],
  recordTimeSeries: ["measurement-direct-observation-acquisition", "evidence-recording"],
  recordNotebook: ["evidence-recording"],
  submitCalculation: ["calculation-analysis"],
};

const operationEffectTargets: Record<ActionInteractionType, readonly ActionEffectTargetDomain[]> = {
  dragToZone: ["equipment"],
  snapIntoTarget: ["equipment", "instrument"],
  pourInto: ["equipment", "material"],
  dispenseDrops: ["equipment", "material"],
  spotOnto: ["equipment", "material"],
  rinseTarget: ["equipment", "material"],
  placeInInstrument: ["equipment", "instrument", "material"],
  readInstrument: ["instrument", "measurement-observation", "evidence"],
  recordTimeSeries: ["measurement-observation", "evidence"],
  recordNotebook: ["evidence"],
  submitCalculation: ["analysis", "evidence"],
};

const unique = <T>(items: readonly T[]): T[] => [...new Set(items)];

export const effectContractForInteraction = (
  interactionType: ActionInteractionType,
): ActionEffectContract => ({
  classes: [...operationEffectClasses[interactionType]],
  targets: operationEffectTargets[interactionType].map((domain) => ({ domain })),
});

const nonEmptyParameterString = (
  parameters: ActionDefinition["parameters"],
  key: string,
): string | undefined => {
  const value = parameters[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
};

const isActivePhotometerConfiguration = (
  action: ActionDefinition,
): boolean =>
  action.verb === "observe" &&
  nonEmptyParameterString(action.parameters, "configurationQuantity") !== undefined &&
  nonEmptyParameterString(action.parameters, "photometerInstanceId") !== undefined &&
  ["wavelength-scan", "approved-selected-wavelength"].includes(
    nonEmptyParameterString(action.parameters, "photometerConfigurationMode") ?? "",
  );

/**
 * The role-free numeric-configuration atom is deliberately limited to the ordinary
 * `configurationQuantity` reducer branch. Its matching broad effect contract is not permission
 * for a typed instrument handler to shed its required instrument roles.
 */
const isOrdinaryTeacherConfiguredNumericObservation = (
  action: ActionDefinition,
  interactionType: ActionInteractionType,
): boolean => {
  if (
    action.verb !== "observe" ||
    interactionType !== "recordNotebook" ||
    action.parameters.inputMode !== "numeric" ||
    action.parameters.inputRole !== "teacherConfiguration" ||
    nonEmptyParameterString(action.parameters, "configurationQuantity") === undefined ||
    isActivePhotometerConfiguration(action)
  ) {
    return false;
  }

  if (
    action.parameters.titrationOperation !== undefined ||
    action.fractionHandling ||
    action.extractionIdentity ||
    action.extractionOperation ||
    action.extractionObservation ||
    action.extractionDrain ||
    action.sourceInventory ||
    action.materialTransition
  ) {
    return false;
  }

  if (
    nonEmptyParameterString(action.parameters, "controlType") === "stirrer" ||
    action.parameters.waitSeconds !== undefined ||
    nonEmptyParameterString(action.parameters, "temperatureEvidenceKind") !== undefined ||
    nonEmptyParameterString(action.parameters, "chromatographyOperation") !== undefined ||
    nonEmptyParameterString(action.parameters, "chamberOperation") !== undefined ||
    (nonEmptyParameterString(action.parameters, "visualStateTargetInstanceId") !== undefined &&
      nonEmptyParameterString(action.parameters, "observedVisualState") !== undefined) ||
    nonEmptyParameterString(action.parameters, "phReadingMode") === "acceptedEndpoint" ||
    ["darkZero", "zero", "read"].includes(
      nonEmptyParameterString(action.parameters, "photometerOperation") ?? "",
    )
  ) {
    return false;
  }

  return true;
};

/**
 * The reducer's configuration branch always records a configured measurement. Only its two
 * active-photometer modes also rewrite the instrument calibration state. This intentionally
 * keys off the branch parameters, rather than a claimed atom or the UI interaction label.
 */
const configurationEffectContract = (
  action: ActionDefinition,
): ActionEffectContract | undefined => {
  if (nonEmptyParameterString(action.parameters, "configurationQuantity") === undefined) {
    return undefined;
  }
  if (isActivePhotometerConfiguration(action)) {
    return {
      classes: ["apparatus-material-instrument-state", "evidence-recording"],
      targets: [
        { domain: "instrument" },
        { domain: "measurement-observation" },
        { domain: "evidence" },
      ],
    };
  }
  return {
    classes: ["measurement-direct-observation-acquisition", "evidence-recording"],
    targets: [{ domain: "measurement-observation" }, { domain: "evidence" }],
  };
};

/**
 * These are the only typed read-instrument branches that return before an `observe` action can
 * reach the later configurationQuantity branch. A plain readInstrument action without one of
 * these parameter forms falls through to configuration in reducer.ts.
 */
const readInstrumentHandlerPrecedesConfiguration = (
  action: ActionDefinition,
  interactionType: ActionInteractionType,
): boolean =>
  interactionType === "readInstrument" &&
  (
    nonEmptyParameterString(action.parameters, "phReadingMode") === "acceptedEndpoint" ||
    nonEmptyParameterString(action.parameters, "chromatographyMeasurementType") !== undefined ||
    ["darkZero", "zero", "read"].includes(
      nonEmptyParameterString(action.parameters, "photometerOperation") ?? "",
    )
  );

/**
 * `observe` is nominally a notebook action, but the reducer gives several typed handlers
 * precedence over that generic interaction. Keep those effects here with the same ordering so
 * every caller of the canonical derivation sees the actual state/acquisition contract.
 */
const observeHandlerEffectContract = (
  action: ActionDefinition,
  interactionType: ActionInteractionType,
): ActionEffectContract | undefined => {
  if (action.verb !== "observe") return undefined;

  // Mirrors reducer.ts: stirrer, timer, temperature evidence, chromatography, visual-state,
  // typed read-instrument branches, configurationQuantity, then the generic interaction handler.
  if (nonEmptyParameterString(action.parameters, "controlType") === "stirrer") {
    return {
      classes: ["apparatus-material-instrument-state"],
      targets: [{ domain: "equipment" }, { domain: "instrument" }],
    };
  }
  if (action.parameters.waitSeconds !== undefined) {
    return {
      classes: ["apparatus-material-instrument-state"],
      targets: [{ domain: "instrument" }],
    };
  }
  if (nonEmptyParameterString(action.parameters, "temperatureEvidenceKind")) {
    return {
      classes: ["measurement-direct-observation-acquisition"],
      targets: [{ domain: "measurement-observation" }, { domain: "evidence" }],
    };
  }
  if (nonEmptyParameterString(action.parameters, "chromatographyOperation") !== undefined) {
    return {
      classes: ["apparatus-material-instrument-state", "evidence-recording"],
      targets: [{ domain: "equipment" }, { domain: "material" }, { domain: "evidence" }],
    };
  }
  // Opening or closing a developing chamber changes the apparatus and records that it changed. It
  // touches no material: the lid neither adds nor removes anything, and the solvent and strip inside
  // are exactly as they were.
  if (nonEmptyParameterString(action.parameters, "chamberOperation") !== undefined) {
    return {
      classes: ["apparatus-material-instrument-state", "evidence-recording"],
      targets: [{ domain: "equipment" }, { domain: "evidence" }],
    };
  }
  if (
    nonEmptyParameterString(action.parameters, "visualStateTargetInstanceId") &&
    nonEmptyParameterString(action.parameters, "observedVisualState")
  ) {
    return {
      classes: ["apparatus-material-instrument-state", "evidence-recording"],
      targets: [{ domain: "equipment" }, { domain: "material" }, { domain: "evidence" }],
    };
  }
  return readInstrumentHandlerPrecedesConfiguration(action, interactionType)
    ? undefined
    : configurationEffectContract(action);
};

/**
 * True for the external-transition confirmation form of `materialTransition`: an operation a
 * teacher performed outside learner control, whose completed qualitative result the learner
 * confirms through the process control. The original learner-performed `dissolve` form is the
 * other authored shape and keeps its own behaviour.
 */
export const isExternalMaterialTransitionForm = (
  action: ActionDefinition,
  interactionType: ActionInteractionType,
): boolean =>
  action.materialTransition !== undefined &&
  action.verb === "observe" &&
  interactionType === "recordNotebook";

/**
 * Resolve the effective contract without trusting a local declaration. Atom semantics are the
 * ceiling; handler semantics must be represented by the atom or the action fails closed.
 */
export const deriveActionEffectContract = (
  action: ActionDefinition,
): { contract?: ActionEffectContract; errors: string[] } => {
  const errors: string[] = [];
  const interaction = resolveActionInteraction(action);
  if (!interaction) {
    errors.push(`Action "${action.id}" has no resolvable interaction handler.`);
    return { errors };
  }
  const chromatographyAtoms: Record<string, string> = {
    markBaseline: "atom.observe.mark-chromatography-baseline",
    drySpot: "atom.observe.dry-chromatography-spot",
    markSolventFront: "atom.observe.mark-chromatography-solvent-front",
    dryDevelopedPaper: "atom.observe.dry-developed-chromatography-paper",
  };
  const chromatographyOperation = action.parameters.chromatographyOperation;
  const chromatographyAtom = typeof chromatographyOperation === "string" ? chromatographyAtoms[chromatographyOperation] : undefined;
  const chamberAtoms: Record<string, string> = {
    closeChamber: "atom.observe.close-developing-chamber",
    openChamber: "atom.observe.open-developing-chamber",
  };
  const chamberOperation = action.parameters.chamberOperation;
  const chamberAtom = typeof chamberOperation === "string" ? chamberAtoms[chamberOperation] : undefined;
  const titrationOperation = typeof action.parameters.titrationOperation === "string" ? titrationOperations[action.parameters.titrationOperation] : undefined;
  if (action.parameters.titrationOperation !== undefined) {
    if (!titrationOperation || action.verb !== titrationOperation.verb || action.atomId !== `atom.${action.verb}.titration-${action.parameters.titrationOperation}` || interaction.type !== "recordNotebook") errors.push(`Action "${action.id}" requires a matching registered titration operation.`);
    for (const key of ["trialReferenceId", "buretteInstanceId", "receiverInstanceId", "titrationModelId"]) if (typeof action.parameters[key] !== "string" || !action.parameters[key]) errors.push(`Action "${action.id}" lacks titration binding ${key}.`);
  }
  if (interaction.type === "recordNotebook" && action.verb === "calculate" && !titrationOperation) errors.push(`Action "${action.id}" requires a typed calculation operation for this endpoint.`);
  if (action.atomId?.includes(".titration-") && !titrationOperation && !["atom.place.titration-receiver"].includes(action.atomId)) errors.push(`Action "${action.id}" lacks its titration operation.`);
  if (action.fractionHandling && (action.atomId !== `atom.${action.verb}.fraction-${action.fractionHandling.operation}` || interaction.type !== "recordNotebook")) errors.push(`Action "${action.id}" requires the matching fraction atom and process endpoint.`);
  if (action.atomId?.includes(".fraction-") && !action.fractionHandling && !titrationOperation) errors.push(`Action "${action.id}" requires typed fraction handling.`);
  if (interaction.type === "recordNotebook" && ["dry", "cool", "transfer", "rinse"].includes(action.verb) && !action.fractionHandling && !titrationOperation) errors.push(`Action "${action.id}" requires a typed physical fraction handler for this endpoint.`);
  if (action.extractionOperation && (action.verb !== action.extractionOperation.operation || action.atomId !== `atom.${action.extractionOperation.operation}.extraction-funnel` || interaction.type !== "recordNotebook")) errors.push(`Action "${action.id}" has incompatible extraction operation semantics.`);
  if (chromatographyOperation !== undefined && (!chromatographyAtom || action.verb !== "observe" || action.atomId !== chromatographyAtom || interaction.type !== "recordNotebook")) errors.push(`Action "${action.id}" has incompatible chromatography operation semantics.`);
  if (action.atomId && Object.values(chromatographyAtoms).includes(action.atomId) && action.atomId !== chromatographyAtom) errors.push(`Action "${action.id}" requires its chromatography operation.`);
  // A chamber atom and a chamber operation imply each other, so neither a notebook sentence claiming
  // the atom nor an operation without one can stand in for the physical handling.
  if (chamberOperation !== undefined && (!chamberAtom || action.verb !== "observe" || action.atomId !== chamberAtom || interaction.type !== "recordNotebook")) errors.push(`Action "${action.id}" has incompatible chamber operation semantics.`);
  if (action.atomId && Object.values(chamberAtoms).includes(action.atomId) && action.atomId !== chamberAtom) errors.push(`Action "${action.id}" requires its chamber operation.`);
  if (action.atomId === "atom.observe.set-active-photometer-wavelength" && !isActivePhotometerConfiguration(action)) {
    errors.push(`Action "${action.id}" requires an active photometer configuration mode.`);
  }
  if (
    action.atomId === "atom.observe.record-teacher-configured-numeric-value" &&
    !isOrdinaryTeacherConfiguredNumericObservation(action, interaction.type)
  ) {
    errors.push(
      `Action "${action.id}" requires the ordinary teacher-configured numeric observe branch, not a typed instrument or physical handler.`,
    );
  }
  if (action.atomId && /^atom\.(mix|vent|settle)\.extraction-funnel$/.test(action.atomId) && !action.extractionOperation) errors.push(`Action "${action.id}" requires its typed extraction handler.`);
  const observeHandler = observeHandlerEffectContract(action, interaction.type);
  let handler: ActionEffectContract;
  // The runtime handles these typed extraction/fraction contracts before the generic Observe
  // branches. Preserve that order even when a malformed authored action also carries a generic
  // observe parameter: the canonical contract must describe the reducer branch that wins.
  if (titrationOperation) {
    handler = titrationOperation.effect;
  } else if (action.extractionIdentity) {
    handler = {
      classes: ["measurement-direct-observation-acquisition", "evidence-recording"],
      targets: [{ domain: "measurement-observation" }, { domain: "evidence" }],
    };
  } else if (action.fractionHandling) {
    handler = {
      classes: ["apparatus-material-instrument-state", "evidence-recording"],
      targets: [{ domain: "equipment" }, { domain: "material" }, { domain: "evidence" }],
    };
  } else if (action.extractionDrain) {
    handler = effectContractForInteraction(interaction.type);
  } else if (action.extractionOperation) {
    handler = {
      classes: ["apparatus-material-instrument-state", "evidence-recording"],
      targets: [{ domain: "equipment" }, { domain: "material" }, { domain: "evidence" }],
    };
  } else if (action.extractionObservation) {
    handler = {
      classes: ["measurement-direct-observation-acquisition", "evidence-recording"],
      targets: [{ domain: "measurement-observation" }, { domain: "evidence" }],
    };
  } else if (action.sourceInventory &&
    ["liquid-volume", "solid-mass"].includes(action.sourceInventory.quantityKind ?? "liquid-volume")) {
    // The reducer dispatches a typed source-inventory contract before every verb branch and before
    // the generic Observe handling. It writes the named container's own starting inventory and
    // emits the configured setup quantity, so this is a physical setup operation rather than a
    // notebook observation.
    handler = {
      classes: ["apparatus-material-instrument-state", "evidence-recording"],
      targets: [{ domain: "equipment" }, { domain: "material" }, { domain: "evidence" }],
    };
  } else if (action.materialTransition) {
    // Also dispatched ahead of every verb branch. The handler rewrites the target material's
    // qualitative fields and preserves its quantities, so the physical class is real while no
    // measurement is acquired. The external confirmation form additionally records the completed
    // external operation in the notebook.
    handler = isExternalMaterialTransitionForm(action, interaction.type)
      ? {
          classes: ["apparatus-material-instrument-state", "evidence-recording"],
          targets: [{ domain: "equipment" }, { domain: "material" }, { domain: "evidence" }],
        }
      : {
          classes: ["apparatus-material-instrument-state"],
          targets: [{ domain: "equipment" }, { domain: "material" }],
        };
  } else if (observeHandler) {
    handler = observeHandler;
  } else {
    handler = effectContractForInteraction(interaction.type);
  }

  if (!action.atomId) return { contract: handler, errors };
  const atom = atomById.get(action.atomId);
  if (!atom) {
    errors.push(`Action "${action.id}" references unknown atom "${action.atomId}".`);
    return { errors };
  }
  if (interaction.type === "recordNotebook" && atom.effectContract.classes.includes("apparatus-material-instrument-state") && !handler.classes.includes("apparatus-material-instrument-state")) errors.push(`Action "${action.id}" has no typed physical handler for its claimed physical atom.`);
  for (const effectClass of handler.classes) {
    if (!atom.effectContract.classes.includes(effectClass)) {
      errors.push(
        `Action "${action.id}" handler ${interaction.type} derives effect class "${effectClass}", which atom "${atom.id}" does not permit.`,
      );
    }
  }
  if (errors.length > 0) return { errors };
  return {
    contract: {
      classes: unique([...atom.effectContract.classes, ...handler.classes]),
      targets: unique(
        [...atom.effectContract.targets, ...handler.targets].map(({ domain }) => domain),
      ).map((domain) => ({ domain })),
    },
    errors,
  };
};
