export type EquipmentCategory =
  | "measurement"
  | "container"
  | "filtration"
  | "chromatography"
  | "heating"
  | "reagent"
  | "sample"
  | "tool";

export type EquipmentAffordance =
  | "draggable"
  | "fillable"
  | "pourable"
  | "measurable"
  | "weighable"
  | "heatSource"
  | "filterTarget"
  | "spotTarget"
  | "chromatographyChamber"
  | "recordable";

export type ActionVerb =
  | "place"
  | "weigh"
  | "measureVolume"
  | "transfer"
  | "mix"
  | "vent"
  | "settle"
  | "dissolve"
  | "precipitate"
  | "dilute"
  | "filter"
  | "spotSample"
  | "developChromatogram"
  | "rinse"
  | "dry"
  | "heat"
  | "cool"
  | "stressEquilibrium"
  | "observe"
  | "record"
  | "calculate"
  | "reset";

export type ActionInteractionType =
  | "dragToZone"
  | "snapIntoTarget"
  | "pourInto"
  | "dispenseDrops"
  | "spotOnto"
  | "rinseTarget"
  | "placeInInstrument"
  | "readInstrument"
  | "recordTimeSeries"
  | "recordNotebook"
  | "submitCalculation";

export type EquipmentLocation = "shelf" | "workbench" | "snapZone" | "oven" | "storage";

export type EquipmentInteractionStatus = "free" | "snapped" | "locked" | "inInstrument";

export type ProcessNodeType =
  | "technique"
  | "action"
  | "checkpoint"
  | "decision"
  | "calculation"
  | "observation"
  | "teacherNote";

export type ProcessNodeDisplayState = "compact" | "expanded";

export type FeedbackSeverity = "success" | "info" | "warning" | "error";

export type RuntimeMode = "guided" | "assessment";

export type ValidationType =
  | "actionEvidence"
  | "measurementRecorded"
  | "dataSeriesRecorded"
  | "notebookEntry"
  | "calculationWithinTolerance"
  | "statePath"
  | "processCompleted";

export type EdgeConditionType =
  | "always"
  | "validationPassed"
  | "retry"
  | "calculationResult";

/** Canonical behavioural class used by the build-time composition boundary. */
export type ActionEffectClass =
  | "apparatus-material-instrument-state"
  | "measurement-direct-observation-acquisition"
  | "evidence-recording"
  | "calculation-analysis"
  | "pedagogical-orchestration";

export type ActionEffectTargetDomain =
  | "equipment"
  | "material"
  | "instrument"
  | "measurement-observation"
  | "evidence"
  | "calculation"
  | "analysis"
  | "pedagogy"
  | "configuration"
  | "approval"
  | "model";

export interface ActionEffectTarget {
  domain: ActionEffectTargetDomain;
  /** Typed owner-local identifier. It is never a filesystem or provider locator. */
  reference?: string;
}

export interface ActionEffectContract {
  classes: ActionEffectClass[];
  targets: ActionEffectTarget[];
}

export interface DimensionSpec {
  width: number;
  height: number;
  unit: "px" | "cm";
}

export interface CapacitySpec {
  amount: number;
  unit: "mL" | "g" | "none";
}

export interface PrecisionSpec {
  amount: number;
  unit: "mL" | "g" | "mg" | "none";
}

export interface SnapZone {
  id: string;
  label: string;
  accepts: string[];
  x: number;
  y: number;
}

export type InteractionRelationType =
  | "mounted"
  | "inserted"
  | "placedOn"
  | "receiving"
  | "developing"
  | "insideInstrument";

export interface InteractionZone {
  id: string;
  ownerDefinitionId: string;
  accepts: string[];
  relationType: InteractionRelationType;
  maxOccupancy: number;
}

export interface EquipmentDefinition {
  id: string;
  label: string;
  category: EquipmentCategory;
  asset: string;
  shelfPlaceable?: boolean;
  dimensions: DimensionSpec;
  capacity: CapacitySpec;
  precision: PrecisionSpec;
  allowedContents: string[];
  affordances: EquipmentAffordance[];
  snapZones: SnapZone[];
  accessibleName: string;
}

export interface SoluteState {
  id: string;
  label: string;
  amount: number;
  unit: "g" | "mg" | "mol";
}

export interface PrecipitateState {
  substance: string;
  massG: number;
  rinsed: boolean;
  dryMassG?: number;
  dryness: "wet" | "damp" | "dry";
}

export interface ChromatogramBandState {
  id: string;
  label: string;
  color: string;
  distanceMm: number;
  expectedRf: number;
}

export interface ChromatogramState {
  modelId: string;
  baselineMarked: boolean;
  spotted: boolean;
  solventFrontMm?: number;
  solventFrontMarked?: boolean;
  /**
   * Distance of the pencil origin above the strip's lower edge, in mm. Investigation 5 requires the
   * origin to stay above the mobile phase (TR-06, R), so the geometry has to be state rather than
   * prose: the develop step compares it with the chamber's configured solvent depth.
   */
  originDistanceMm?: number;
  /** Solvent depth the strip was developed against, in mm. Carried so the geometry stays auditable. */
  solventDepthMm?: number;
  /** What was spotted, taken from the source container rather than from a presentation string. */
  sampleProvenance?: string;
  bands: ChromatogramBandState[];
}

/**
 * Provenance for a solid whose physical quantity is deliberately unknown.
 *
 * A heated product is recovered as material whose mass nobody has measured: the AP source records
 * the loaded crucible (EX-07), each cooled cycle mass (EX-14), the accepted final residue and the
 * mass lost (EX-16, EX-17), and then transfers the product at EX-19 without ever reading it on a
 * balance (`purify-a-mixture-green-chemistry_2026-07-27.md`). Writing the input mass onto the
 * receiver would therefore state a known-wrong physical fact, so the receiver carries this record
 * instead of a `massG`. `sourceInventoryEquivalentMassG` states only how much represented input
 * inventory left the source; it is bookkeeping, not a product mass, yield, purity, residue mass or
 * calculation input, and no consumer may coerce it into a measurement or a physical mass.
 */
export interface GreenChemistryProductRecoveryRecord {
  /** Deterministic within `runId`, so a duplicate can never read as a second replicate. */
  recordId: string;
  runId: string;
  replicate: number;
  operationId: "recover-replicate-product";
  stream: "heated-product";
  /** Opaque configured identity; asserts no bicarbonate/carbonate ratio and no final identity. */
  sourceMaterialId: string;
  sourceMaterialLabel: string;
  sourceInstanceId: string;
  destinationInstanceId: string;
  sourceActionId: string;
  quantityBasis: "source-inventory-equivalent";
  /** Source-side inventory resolved before the transfer. */
  sourceInventoryMassG: number;
  /** The same source-side quantity. Neither field is a destination physical mass. */
  sourceInventoryEquivalentMassG: number;
  destinationPhysicalMassKnown: false;
  measurementEvidenceIds: string[];
  recoveryEvidenceIds: string[];
  routeEvidenceIds: string[];
}

export type QualitativeSolidProvenanceRecord = GreenChemistryProductRecoveryRecord;

export interface ContentState {
  recoveryEvidence?: { fractionId: string; residueObserved: boolean; dry: boolean; provenance: "classroom-observation"; method: string; drynessCriterion: string; coolingLimitC: number };
  /** One holder retains this inventory when classroom evidence cannot allocate it between fractions. */
  unallocatedInventory?: { allocationId: string; sourceLabel: string; solutes: SoluteState[]; massG?: number; precipitate?: PrecipitateState; contamination: string[] };
  allocationReferenceId?: string;
  /**
   * Recovered solids whose physical quantity is unknown. A provenance collection, never an
   * alternative mass field: a holder carrying it must have `massG` absent, no solutes and no
   * concentration. Physical receivers do not acquire per-transfer provenance.
   */
  qualitativeSolidProvenance?: QualitativeSolidProvenanceRecord[];
  /** Waste packet ledger conserves material when a quantitative mixture model is unavailable. */
  wasteContents?: ContentState[];
  extractionState?: { stage: "charged" | "mixed" | "vented" | "settled"; observation?: "layers-observed" | "emulsion" | "incomplete"; layerIdentityConfirmed?: boolean };
  kind: "empty" | "liquid" | "solid" | "solution" | "mixture" | "precipitate";
  label: string;
  volumeMl?: number;
  finalVolumeMl?: number;
  massG?: number;
  solutes: SoluteState[];
  concentration?: {
    value: number;
    unit: "g/L" | "mg/L" | "M" | "mg/L as CaCO3";
  };
  precipitate?: PrecipitateState;
  chromatogram?: ChromatogramState;
  contamination: string[];
  temperatureC?: number;
  /** A student-submitted temperature preserved separately from the live/modelled temperature. */
  recordedTemperature?: {
    label: string;
    valueC: number;
    precision: number;
    provenance: "student-recorded";
  };
  wetState: "dry" | "wet" | "rinsed";
  /**
   * Whether a developing chamber's lid is seated. Investigation 5 (printed page 49) requires the
   * container to be sealed during development, so closure has to be state on the particular chamber
   * instance that the reducer can refuse on — reading an authored `chamberSealed: true` constant
   * would only prove that content asked for a seal, never that a learner produced one.
   *
   * Absent means the apparatus models no lid: a beaker is not an open chamber, and nothing about
   * closure is shown or announced for one. An apparatus that does model a lid declares the flag in
   * its authored initial contents — `false` for the open chamber every trial starts with — so the
   * open state is represented rather than inferred from a missing field. `createRuntimeState`
   * rebuilds contents from those authored values, so full and physical reset both restore the open
   * lid without any reset-specific code.
   */
  developingChamberClosed?: boolean;
  visualState: string;
  /** Runtime-only instrument state. Reset reconstructs it from the authored empty contents. */
  probeImmersedInInstanceId?: string;
  instrumentReadout?: {
    quantity: "pH";
    value: number;
    unit: "pH";
    precision: number;
    provenance: "simulator-generated";
    acceptedTitrantVolumeMl?: number;
    idealEquivalenceVolumeMl?: number;
    idealEquivalencePh?: number;
  };
}

export interface EquipmentInstance {
  id: string;
  definitionId: string;
  label: string;
  location: EquipmentLocation;
  snapZoneId?: string;
  x?: number;
  y?: number;
  rotation?: number;
  zIndex?: number;
  interactionStatus?: EquipmentInteractionStatus;
  contents: ContentState;
}

export interface AttachmentRelation {
  id: string;
  parentInstanceId: string;
  childInstanceId: string;
  zoneId: string;
  relationType: Exclude<InteractionRelationType, "insideInstrument">;
  renderMode: "delegated" | "layered" | "independent";
  locked?: boolean;
}

export interface ActionInteractionSpec {
  type: ActionInteractionType;
  sourceDefinitionId?: string;
  targetDefinitionId?: string;
  stationId?: string;
  snapZoneId?: string;
  valueParameter?: string;
  requiredState?: Record<string, string | number | boolean>;
  successCue?: string;
  invalidCue?: string;
  accessibleLabel: string;
}

export type ActionParameterValue = string | number | boolean | string[] | undefined;

/**
 * An explicit, executable volume source. This lives beside `parameters` so structured evidence
 * references are schema checked instead of being accepted as decorative free-form parameters.
 */
export type ActionVolumeContract =
  | { source: "action-input"; outputMeasurementId?: string }
  | { source: "literal"; valueMl: number; outputMeasurementId?: string }
  | { source: "measurement"; referenceId: string; outputMeasurementId?: string }
  | { source: "calculation"; referenceId: string; outputMeasurementId?: string }
  | { source: "target-fill-fraction"; fraction: number; outputMeasurementId?: string }
  | { source: "target-remaining-capacity"; outputMeasurementId?: string };

/**
 * Opt-in provenance for a mass observation. Legacy mass contracts intentionally omit this
 * object and retain their historical identifier-only behaviour. A continuity-aware contract
 * is fail-closed: the physical support, material source (when a material portion moves),
 * producer action, and the current evidence-scope attempt must all agree.
 */
export interface ActionMassProducerContinuity {
  version: 1;
  quantityKind: "balance-display" | "material-portion";
  measuredSupportInstanceId: string;
  materialSourceInstanceId?: string;
}

export interface ActionMassConsumerContinuity extends ActionMassProducerContinuity {
  producerActionId: string;
}

/** A narrow solid-mass evidence bridge used only when an action opts into it. */
export type ActionMassContract =
  | { source: "configured-input" }
  | {
      source: "action-input";
      outputMeasurementId: string;
      applyToSourceInventory?: boolean;
      confirmLatestMeasurementIds?: string[];
      toleranceMeasurementId?: string;
      noRepeatCalculationId?: string;
      continuity?: ActionMassProducerContinuity;
    }
  | {
      source: "measurement";
      referenceId: string;
      continuity?: ActionMassConsumerContinuity;
    };

export type ActionEvidenceReference =
  | { source: "measurement"; referenceId: string }
  | { source: "calculation"; referenceId: string };

/** Strict evidence-derived calculations added by composition compiler contract 1.5. */
export type ActionAnalysisContract =
  | { type: "massDifferenceWithinTolerance"; firstMassMeasurementId: string; secondMassMeasurementId: string; toleranceMeasurementId: string; comparison: "below" | "atOrBelow"; outputCalculationId: string }
  | {
      type: "mixedEvidenceRegression";
      pairs: Array<{ x: ActionEvidenceReference; y: ActionEvidenceReference }>;
      xUnit: string;
      yUnit: string;
      outputCalculationId: string;
    }
  | {
      type: "unaryEvidenceTransform";
      input: ActionEvidenceReference;
      operation: "identity" | "reciprocal" | "log10" | "negativeLog10" | "power10";
      outputUnit: string;
      outputCalculationId: string;
    }
  | {
      type: "concentrationFromRegression";
      response: ActionEvidenceReference;
      regressionCalculationId: string;
      outputUnit: string;
      outputCalculationId: string;
    }
  | {
      type: "molarConcentrationToMass";
      concentration: ActionEvidenceReference;
      solutionVolumeMeasurementId: string;
      molarMassMeasurementId: string;
      outputCalculationId: string;
    };

export interface ActionRuntimeRepeatContract {
  countMeasurementId: string;
  outputMeasurementId: string;
  progressId: string;
}

/**
 * Teacher-configured starting inventory for a named source container.
 *
 * The original contract described a liquid volume only: the handler wrote `volumeMl`, required an
 * mL capacity on the source definition, and emitted an mL measurement. That form is preserved
 * exactly, and an omitted `quantityKind` still means it. The `solid-mass` variant configures a
 * gram inventory instead; grams are never compared against a vessel's mL capacity and no density
 * conversion is implied. Setup evidence produced here is deliberately not mass-continuity
 * evidence: a configured stock quantity is not a balance reading of a measured portion.
 */
export type ActionSourceInventoryContract =
  | {
      /** Omit, or state it, for the historical liquid-volume form. */
      quantityKind?: "liquid-volume";
      sourceInstanceId?: string;
      sourceDefinitionId: string;
      outputMeasurementId: string;
    }
  | {
      quantityKind: "solid-mass";
      sourceInstanceId?: string;
      sourceDefinitionId: string;
      outputMeasurementId: string;
      /**
       * The single solid component the configured gram total belongs to. A solid stock container
       * may declare at most this one solute, so the configured mass has exactly one owner and the
       * handler never has to allocate a total across components.
       */
      materialSoluteId: string;
      /** Authored name for that component, so the handler never invents chemical naming. */
      materialLabel: string;
    };

/**
 * How a solid transfer's destination represents what it received.
 *
 * `physical` is the default and preserves every existing solid consumer: the destination gets a
 * real gram mass. `qualitative-unknown` is for material whose mass was never measured; the
 * destination gets a provenance record and no `massG`.
 */
export type SolidDestinationRepresentation =
  | "physical"
  | "qualitative-unknown";

/**
 * Authored contract for a solid transfer, on supported `transfer`/`pourInto` actions only.
 *
 * The allowlist is deliberately three keys. Identity and quantity live on the runtime request,
 * not here, and runtime qualitative provenance is never authored content - it is supplied to the
 * shared transfer helper during execution.
 *
 * `measured-portion` names the helper's quantitative mode. It does not turn an approved plan
 * target into a learner measurement: `add-carbonate-sample` keeps a single authoritative
 * `parameters.massG` plan reference and no `ActionDefinition.mass`, because the AP source loads a
 * "planned mixture mass" (EX-06) and reads the actual loaded mass separately (EX-07).
 */
export interface ActionSolidTransferContract {
  mode: "measured-portion" | "whole-remaining";
  /** Defaults to `physical`. Only a whole-remaining contract may be `qualitative-unknown`. */
  destinationRepresentation?: SolidDestinationRepresentation;
  /** Whole-remaining only. `false` lets a genuinely empty source complete as an explicit no-op. */
  requireNonEmptySource?: boolean;
}

export interface ActionMaterialTransitionContract {
  kind?: ContentState["kind"];
  label?: string;
  wetState?: ContentState["wetState"];
  visualState?: string;
}

export interface ActionDeliveryDeviceContract {
  deviceInstanceId?: string;
  deviceDefinitionId?: string;
}

export interface ActionChoiceObservationContract {
  outputCalculationId: string;
  options: Array<{ label: string; tag: string; value: number }>;
}

export interface ActionDefinition {
  id: string;
  verb: ActionVerb;
  label: string;
  /**
   * Stable atomic identity from `src/domain/atomRegistry.json`. Optional so existing content stays
   * valid; `scripts/checkContentConsistency.mjs` requires it on new or modified physical actions.
   * Atomic identity constrains behaviour, prerequisites, state transitions, evidence, and equipment
   * roles — never the learner-facing `label`, which stays contextual.
   */
  atomId?: string;
  /**
   * Maps a role slot declared by the atom (`src/domain/equipmentRoleRegistry.json`) to the equipment
   * definition id that fills it, for example `{ "rinse-water-source": "wash-bottle" }`.
   */
  equipmentRoleBindings?: Record<string, string>;
  /**
   * Required only for lab-local actions in a composed source. Technique actions derive this contract
   * from `atomId`; a local declaration can be checked but can never override atom/handler semantics.
   */
  effect?: ActionEffectContract;
  volume?: ActionVolumeContract;
  mass?: ActionMassContract;
  analysis?: ActionAnalysisContract;
  runtimeRepeat?: ActionRuntimeRepeatContract;
  sourceInventory?: ActionSourceInventoryContract;
  solidTransfer?: ActionSolidTransferContract;
  extractionOperation?: { operation: "mix" | "vent" | "settle"; vesselInstanceId: string; requiredControlActionIds: string[] };
  extractionObservation?: { vesselInstanceId: string };
  extractionIdentity?: { vesselInstanceId: string };
  extractionDrain?: { vesselInstanceId: string };
  fractionHandling?: { operation: "remove-solvent" | "remove-drying-agent" | "observe-residue" | "collect-residue" | "observe-dryness" | "observe-cooling" | "dispose" | "remove-label"; sourceInstanceId: string; targetInstanceId?: string; fractionId: string };
  materialTransition?: ActionMaterialTransitionContract;
  deliveryDevice?: ActionDeliveryDeviceContract;
  choiceObservation?: ActionChoiceObservationContract;
  /** Optional calculation evidence emitted by a contracted dilute action. */
  dilutionFactorOutputId?: string;
  parameters: Record<string, ActionParameterValue>;
  interaction?: ActionInteractionSpec;
  prerequisites: ValidationRule[];
  stateChanges: string[];
  invalidCases: RuntimeInvalidCase[];
  feedback: {
    success: string;
    invalid: string;
  };
  evidence: string[];
}

export interface StoichiometricRatio {
  analyte: number;
  titrant: number;
}

export interface TitrationModelBase {
  id: string;
  analyteMolarityM: number;
  analyteVolumeMl: number;
  titrantMolarityM: number;
  stoichiometricRatio?: StoichiometricRatio;
  dropVolumeMl?: number;
  endpointOffsetDrops?: number;
  maxExtraDrops?: number;
}

export interface AcidBaseTitrationModel extends TitrationModelBase {
  type: "acidBase";
  analyte: AcidBaseSpeciesModel;
  titrant: AcidBaseSpeciesModel;
  temperatureC: number;
  waterIonProduct: number;
  phPrecision: number;
}

export type AcidBaseRole = "acid" | "base";
export type AcidBaseStrength = "strong" | "weak";

export interface AcidBaseSpeciesModel {
  formula: string;
  role: AcidBaseRole;
  strength: AcidBaseStrength;
  /** Ka for a weak acid or Kb for a weak base. Strong species must omit it. */
  equilibriumConstant?: number;
  equilibriumConstantSource?: string;
}

/**
 * A self-indicating redox titration (Investigation 8). It carries the same drop-plan geometry as an
 * acid-base model — the endpoint volume falls out of the two concentrations and the stoichiometric
 * ratio either way — and adds only what a percent-by-mass result needs. Before Cycle 09 the redox
 * flow hard-coded `endpointDropCount` on the action instead, which is the fabricated volume that
 * CONTINUATION_CYCLE_09.md's task 6 forbids.
 */
export interface RedoxTitrationModel extends TitrationModelBase {
  type: "redox";
  /** Molar mass used to turn titrated analyte moles into a mass. */
  analyteMolarMassGPerMol?: number;
  /** Manual-stated 1.00 g/mL when a percent by mass is reported (Investigation 8, finding 8). */
  sampleDensityGPerMl?: number;
}

export type TitrationModelDefinition = AcidBaseTitrationModel | RedoxTitrationModel;

export interface ChromatographyBandModel {
  id: string;
  label: string;
  color: string;
  distanceMm: number;
  expectedRf: number;
}

export interface PaperChromatographyModel {
  requiresClassroomDataset?: boolean;
  id: string;
  solventFrontMm: number;
  bands: ChromatographyBandModel[];
}

export type ChromatographyModelDefinition = PaperChromatographyModel;

export type KineticsVariable = "acidConcentration" | "chipSize" | "temperature";

export interface KineticsConditionDefinition {
  id: string;
  label: string;
  variable: KineticsVariable;
  acidConcentrationM: number;
  chipSize: "large" | "medium" | "small";
  temperatureC: number;
  rateFactor: number;
}

export interface GasSyringeKineticsModel {
  id: string;
  type: "gasSyringe";
  timepointsS: number[];
  baseMaxVolumeMl: number;
  baseRateConstant: number;
  defaultVariable: KineticsVariable;
  controlled: {
    acidVolumeMl: number;
    marbleMassG: number;
    acidConcentrationM: number;
    chipSize: "large" | "medium" | "small";
    temperatureC: number;
  };
  conditions: KineticsConditionDefinition[];
}

export type KineticsModelDefinition = GasSyringeKineticsModel;

export interface RuntimeInvalidCase {
  id: string;
  when: string;
  message: string;
  recovery: string;
}

export interface ValidationRule {
  id: string;
  type: ValidationType;
  label: string;
  actionId?: string;
  measurementId?: string;
  notebookTag?: string;
  calculationId?: string;
  dataSeriesId?: string;
  /** Optional exact producer/scope gate for an otherwise legacy measurementRecorded rule. */
  measurementContinuity?: ActionMassConsumerContinuity;
  /**
   * Optional current-attempt gate for an otherwise legacy actionEvidence rule. When set, only a
   * successful attempt recorded in the state's current evidence scope *and* generation satisfies
   * the rule, so a retained success from an earlier retry no longer does. Rules that omit it keep
   * their historical behaviour, and older persisted attempts — which carry no scope stamp — are
   * readable but never satisfy a qualified rule.
   */
  requireCurrentEvidenceScope?: boolean;
  path?: string;
  equals?: string | number | boolean;
  tolerance?: number;
}

export interface ProcessNode {
  id: string;
  type: ProcessNodeType;
  title: string;
  description: string;
  actionId?: string;
  layout?: {
    x: number;
    y: number;
    lane?: string;
    display?: ProcessNodeDisplayState;
  };
  config: Record<string, string | number | boolean | string[] | undefined>;
  validation: ValidationRule[];
  hints: string[];
  feedback: {
    success: string;
    retry: string;
  };
}

export interface ProcessEdge {
  from: string;
  to: string;
  label: string;
  condition: {
    type: EdgeConditionType;
    calculationId?: string;
    min?: number;
    max?: number;
  };
}

export interface ProcessDefinition {
  startNodeId: string;
  nodes: ProcessNode[];
  edges: ProcessEdge[];
}

export interface TechniqueDefinition {
  id: string;
  title: string;
  learningGoal: string;
  requiredEquipment: string[];
  titrationModels?: TitrationModelDefinition[];
  chromatographyModels?: ChromatographyModelDefinition[];
  kineticsModels?: KineticsModelDefinition[];
  initialState: {
    equipment: EquipmentInstance[];
  };
  actions: ActionDefinition[];
  process: ProcessDefinition;
  successCriteria: ValidationRule[];
  commonMistakes: RuntimeInvalidCase[];
  resetBehavior: "resetTechnique" | "resetLab";
  metadata: DefinitionMetadata;
  /** Build-time interface. Standalone legacy techniques may omit it. */
  composition?: TechniqueCompositionContract;
}

export interface TechniquePortDefinition {
  id: string;
  kind: "entry" | "exit";
  nodeId: string;
  label: string;
}

export interface TechniqueEquipmentRoleRequirement {
  roleId: string;
  required: boolean;
  allowedDefinitionIds?: string[];
  /** Standalone technique instance identities owned by this role; enables unambiguous same-definition bindings. */
  sourceInstanceIds?: string[];
}

export type TechniqueModelKind = "titration" | "chromatography" | "kinetics";

export interface TechniqueModelSlot {
  id: string;
  kind: TechniqueModelKind;
  sourceModelId: string;
  required: boolean;
}

export type TechniqueConfigurationValue = string | number | boolean;

export interface TechniqueConfigurationSlot {
  id: string;
  valueType: "string" | "number" | "boolean";
  required: boolean;
  allowedValues?: TechniqueConfigurationValue[];
  defaultValue?: TechniqueConfigurationValue;
}

export interface TechniqueApprovalGateDefinition {
  id: string;
  label: string;
}

export type TechniqueVariantPredicate =
  | { kind: "configuration"; slotId: string; equals: TechniqueConfigurationValue }
  | { kind: "approval"; gateId: string; equals: boolean };

export interface TechniqueVariantDefinition {
  id: string;
  label: string;
  enabledWhen: TechniqueVariantPredicate;
}

export type TechniqueEvidenceOutputKind =
  | "action-evidence"
  | "measurement"
  | "data-series"
  | "notebook"
  | "calculation";

export interface TechniqueEvidenceOutput {
  id: string;
  kind: TechniqueEvidenceOutputKind;
  actionId: string;
  /** Optional owner-local runtime identity; the compiler scopes it with the technique instance. */
  referenceId?: string;
}

export interface TechniqueCompletionContract {
  exitPortIds: string[];
  requiredEvidenceOutputIds: string[];
  requiredValidationRuleIds: string[];
}

export type TechniqueCatalogDisposition =
  | "composable"
  | "standalone-practice"
  | "lab-scoped"
  | "deprecated";

export interface OrderedProcedureContract {
  configurationSlotId: string;
  startActionIds: string[];
  endActionIds: string[];
  minimumTests: number;
  requiredFamilies?: string[];
  selectionCount?: { configurationSlotId: string; baseCount: number; groupIds: string[] };
  requireMixedEvidence?: boolean;
  resources: Array<{ id: string; prepareActionIds: string[]; cleanupActionIds: string[] }>;
  groups: Array<{ id: string; actionAliases?: Record<string, string>; family?: string; actionIds: string[]; resourceId?: string; testCount: number; evidenceKind: "qualitative" | "quantitative" | "procedure"; requiresEarlier?: string[]; requiresSelected?: string[] }>;
}

export interface TechniqueCompositionContract {
  /** Canonical, versioned subflows; selection is materialized only by the compiler. */
  orderedProcedure?: OrderedProcedureContract;
  schemaVersion: 1;
  ports: TechniquePortDefinition[];
  equipmentRoles: TechniqueEquipmentRoleRequirement[];
  modelSlots: TechniqueModelSlot[];
  configurationSlots: TechniqueConfigurationSlot[];
  approvalGates: TechniqueApprovalGateDefinition[];
  variants: TechniqueVariantDefinition[];
  evidenceOutputs: TechniqueEvidenceOutput[];
  completion: TechniqueCompletionContract;
  catalogDisposition: TechniqueCatalogDisposition;
  /** Composition-only ownership metadata for legacy actions that cannot emit an `atomId` or `effect`. */
  legacyActionEffects?: Array<{
    actionId: string;
    effect: ActionEffectContract;
  }>;
  /** Dot paths whose string leaves may use `{{presentation.<key>}}`. */
  presentationPaths?: string[];
}

export interface CompositionReachabilityWitness {
  id: string;
  configuration: Record<string, TechniqueConfigurationValue>;
  approvalGates: Record<string, boolean>;
}

export interface TechniqueInstanceSingleEquipmentBinding {
  definitionId: string;
  /** Concrete lab-owned runtime instance. Never a technique standalone instance id. */
  instanceId: string;
  sourceInstances?: never;
}

export interface TechniqueInstanceSourceEquipmentBinding {
  /** Explicit technique-owned instance; inference is forbidden in the plural form. */
  sourceInstanceId: string;
  /** Concrete lab-owned definition selected for this source instance. */
  definitionId: string;
  /** Concrete lab-owned runtime instance selected for this source instance. */
  instanceId: string;
}

export interface TechniqueInstanceMultipleEquipmentBinding {
  definitionId?: never;
  instanceId?: never;
  sourceInstances: TechniqueInstanceSourceEquipmentBinding[];
}

export type TechniqueInstanceEquipmentBinding =
  | TechniqueInstanceSingleEquipmentBinding
  | TechniqueInstanceMultipleEquipmentBinding;

export interface TechniqueInstanceBindings {
  equipment: Record<string, TechniqueInstanceEquipmentBinding>;
  models: Record<string, string>;
  configuration: Record<string, TechniqueConfigurationValue>;
  presentation?: Record<string, string>;
}

export interface TechniqueInstanceIdBindings {
  actions?: Record<string, string>;
  nodes?: Record<string, string>;
  validationRules?: Record<string, string>;
  /** Owner-local measurement, notebook, calculation, evidence, data-series, and related identities. */
  references?: Record<string, string>;
}

export interface TechniqueInstanceRef {
  instanceId: string;
  techniqueId: string;
  version: string;
  repeat?: number;
  bindings: TechniqueInstanceBindings;
  /** Explicit compatibility bindings preserve a public legacy id; other ids are instance-scoped. */
  preserveIds?: TechniqueInstanceIdBindings;
  /** Selects only a variant declared by the exact pinned technique contract. */
  variantId?: string;
  enabledWhen?: CompositionBranchPredicate;
}

export type CompositionBranchPredicate =
  | { kind: "configuration"; instanceId: string; slotId: string; equals: TechniqueConfigurationValue }
  | { kind: "approval"; instanceId: string; gateId: string; equals: boolean };

export type CompositionEndpoint =
  | { kind: "lab-node"; nodeId: string }
  | { kind: "technique-port"; instanceId: string; portId: string; repeatIndex?: number };

export interface TechniqueCompositionConnection {
  /** Stable source-only identity used by explicit global edge ordering. */
  id?: string;
  from: CompositionEndpoint;
  to: CompositionEndpoint;
  label: string;
  condition?: ProcessEdge["condition"];
  enabledWhen?: CompositionBranchPredicate;
}

export interface TechniqueAssessmentSourceRef {
  kind: "technique-success-criterion";
  instanceId: string;
  ruleId: string;
  repeatIndex?: number;
}

export interface LabAssessmentSourceRef {
  kind: "lab-assessment";
  ruleId: string;
  /** Declares the selected technique criterion replaced by this lab-owned compatibility row. */
  substitutes?: Omit<TechniqueAssessmentSourceRef, "kind">;
}

export type CompositionAssessmentSourceRef = TechniqueAssessmentSourceRef | LabAssessmentSourceRef;

export type CompositionEdgeSourceRef =
  | { kind: "lab-edge"; edgeIndex: number }
  | { kind: "technique-edge"; instanceId: string; edgeIndex: number; repeatIndex?: number }
  | { kind: "connection"; connectionId: string };

export interface CompositionOrigin {
  actionId?: string;
  nodeId: string;
  techniqueId: string;
  techniqueVersion: string;
  instanceId: string;
  sourceActionId?: string;
  sourceNodeId: string;
}

export interface CompiledTechniqueEvidenceOutput {
  id: string;
  sourceId: string;
  kind: TechniqueEvidenceOutputKind;
  actionId: string;
  referenceId?: string;
}

export interface CompiledTechniqueCompletionContract {
  exitNodeIds: string[];
  requiredEvidenceOutputIds: string[];
  requiredValidationRuleIds: string[];
}

export interface CompositionManifest {
  schemaVersion: 1;
  /** Readers accept prior flat-manifest contracts; new compilation emits 1.4. */
  compilerContractVersion: "1.0" | "1.1" | "1.2" | "1.3" | "1.4" | "1.5" | "1.6";
  status: "compiled" | "detached";
  instances: Array<{
    instanceId: string;
    techniqueId: string;
    version: string;
    repeatIndex: number;
    variantId?: string;
    evidenceOutputs: CompiledTechniqueEvidenceOutput[];
    completion: CompiledTechniqueCompletionContract;
  }>;
  origins: CompositionOrigin[];
}

export interface LabDefinition {
  id: string;
  title: string;
  description: string;
  audience: string;
  learningGoals: string[];
  safetyNotes: string[];
  equipment: string[];
  initialState?: {
    equipment: EquipmentInstance[];
  };
  titrationModels?: TitrationModelDefinition[];
  chromatographyModels?: ChromatographyModelDefinition[];
  kineticsModels?: KineticsModelDefinition[];
  techniques: TechniqueDefinition[];
  actions: ActionDefinition[];
  process: ProcessDefinition;
  assessments: ValidationRule[];
  metadata: DefinitionMetadata;
  /** Public compiler-issued provenance. It contains no build locators, hashes, or runtime data. */
  compositionManifest?: CompositionManifest;
}

/**
 * Version-pinned, action-only import of a standalone technique.
 *
 * A reference contributes **actions and nothing else**. Process nodes, edges, ordering, feedback,
 * equipment, models, success criteria, and presentation stay lab-owned, which is what keeps a
 * technique from silently rewriting a lab's teaching sequence. `version` must equal the referenced
 * technique's `metadata.version` exactly; there is no range syntax, so a technique edit cannot drift
 * into a lab unnoticed.
 */
export interface TechniqueActionRef {
  techniqueId: string;
  version: string;
  /** `"all"`, or an ordered list of unique action ids to import from the technique. */
  actionIds: "all" | string[];
}

/**
 * The raw shape of a bundled lab file under `public/labs/`.
 *
 * This is the on-disk contract, not the runtime one. It shares every `LabDefinition` field, but its
 * `actions` array holds only the lab-local actions: the ones a `techniqueRefs` entry imports are
 * absent until hydration, so its `process` may reference action ids that `actions` does not declare.
 * `src/data/hydrateBundledLab.ts` resolves the references and returns an ordinary self-contained
 * `LabDefinition`; runtime, Studio, and export consumers never see an unresolved reference.
 */
export interface BundledLabSourceDefinition extends LabDefinition {
  techniqueRefs?: TechniqueActionRef[];
  techniqueInstances?: TechniqueInstanceRef[];
  compositionConnections?: TechniqueCompositionConnection[];
  reachabilityWitnesses?: CompositionReachabilityWitness[];
}

export interface LegacyBundledLabSourceDefinition extends BundledLabSourceDefinition {
  techniqueInstances?: never;
}

export interface LabCompositionSourceDefinition extends BundledLabSourceDefinition {
  techniqueRefs?: never;
  techniqueInstances: TechniqueInstanceRef[];
  compositionConnections: TechniqueCompositionConnection[];
  reachabilityWitnesses: CompositionReachabilityWitness[];
  /** Explicit root for a fully technique-owned composition. Resolves to the emitted process start node. */
  compositionStart?: CompositionEndpoint;
  /** Optional exact global edge order. Every active local, internal, and connection edge is accounted once. */
  compositionEdgeOrder?: CompositionEdgeSourceRef[];
  /** Optional exact output order. If present, all selected criteria and lab rows must be emitted or substituted once. */
  compositionAssessmentOrder?: CompositionAssessmentSourceRef[];
  /** Raw sources cannot assert compiler origin rows or compiled status. */
  compositionManifest?: never;
}

export interface RouteTechniqueExecutionIntent {
  instanceId: string;
  actionId: string;
  payload: Record<string, string | number | boolean>;
}

export interface RouteTechniqueExecutionTarget extends RouteTechniqueExecutionIntent {
  techniqueId: string;
  techniqueVersion: string;
  nodeId: string;
  evidenceOutputIds: string[];
}

export interface RouteTechniqueExecutionEvidence {
  actionId: string;
  evidence: string[];
  measurements?: Record<string, number>;
  notebook?: Record<string, string>;
}

export interface RouteTechniqueExecutionRejection {
  code: string;
  message: string;
  recovery: string;
}

/** Provisional until Cycle 04 proves it against both current custom-route control inventories. */
export interface RouteTechniqueExecutionAdapter<RouteState> {
  execute(
    state: RouteState,
    intent: RouteTechniqueExecutionIntent,
  ):
    | { ok: true; state: RouteState; evidence: RouteTechniqueExecutionEvidence }
    | { ok: false; state: RouteState; rejection: RouteTechniqueExecutionRejection };
  recover(state: RouteState, rejection: RouteTechniqueExecutionRejection): RouteState;
  reset(state: RouteState): RouteState;
}

export interface DefinitionMetadata {
  version: string;
  author: string;
  updatedAt: string;
  tags: string[];
}

export interface NotebookEntry {
  id: string;
  timestamp: string;
  nodeId: string;
  type: "observation" | "measurement" | "calculation" | "reflection";
  label: string;
  value: string;
  tags: string[];
}

export interface MeasurementRecord {
  id: string;
  label: string;
  value: number;
  unit: string;
  equipmentInstanceId?: string;
  nodeId: string;
  /** Present only for an action that explicitly opts into continuity-aware mass evidence. */
  sourceActionId?: string;
  evidenceScopeId?: string;
  evidenceScopeGeneration?: number;
  measuredSupportInstanceId?: string;
  materialSourceInstanceId?: string;
  quantityKind?: ActionMassProducerContinuity["quantityKind"];
}

export interface CalculationRecord {
  id: string;
  label: string;
  value: number;
  unit: string;
  expected?: number;
  tolerance?: number;
  passed?: boolean;
  regression?: {
    slope: number;
    intercept: number;
    rSquared: number;
    pointCount: number;
    xUnit?: string;
    yUnit?: string;
  };
  series?: DataSeriesPoint[];
  nodeId: string;
}

export interface DataSeriesPoint {
  x: number;
  y: number;
}

export interface DataSeriesRecord {
  id: string;
  label: string;
  xUnit: string;
  yUnit: string;
  points: DataSeriesPoint[];
  sourceActionId: string;
  nodeId: string;
  metadata?: Record<string, string | number | boolean>;
}

export type TemperatureEvidenceKind = "live" | "stable" | "peak" | "timed";

export interface TemperatureEvidenceRecord {
  id: string;
  label: string;
  valueC: number;
  kind: TemperatureEvidenceKind;
  equipmentInstanceId: string;
  scopeId: string;
  elapsedSeconds?: number;
  nodeId: string;
}

export interface ThermalControlState {
  equipmentInstanceId: string;
  heatOn: boolean;
  stirOn: boolean;
  heatLevel: number;
  stirLevel: number;
  splashing: boolean;
  elapsedSeconds: number;
  peakTemperatureC?: number;
}

export type DropDispenseColorState = "clear" | "palePink" | "darkPink";

export interface DropDispenseRecord {
  actionId: string;
  dropsDispensed: number;
  dropVolumeMl: number;
  deliveredVolumeMl: number;
  initialBuretteReadingMl: number;
  currentBuretteReadingMl: number;
  equivalenceDropCount: number;
  endpointDropCount: number;
  maxExtraDrops: number;
  accepted: boolean;
  colorState: DropDispenseColorState;
}

export interface RuntimeFeedback {
  id: string;
  timestamp: string;
  severity: FeedbackSeverity;
  message: string;
  recovery?: string;
  nodeId?: string;
}

export interface AttemptRecord {
  id: string;
  timestamp: string;
  nodeId: string;
  actionId: string;
  verb: ActionVerb;
  mode: RuntimeMode;
  success: boolean;
  message: string;
  /**
   * The evidence scope the attempt was performed in. Optional so histories written before this
   * field existed still load; a rule that opts into current-scope matching treats an unstamped
   * attempt as unattributable rather than as current.
   */
  evidenceScopeId?: string;
  evidenceScopeGeneration?: number;
}

export interface ValidationEvidence {
  id: string;
  ruleId: string;
  nodeId: string;
  passed: boolean;
  message: string;
}

export interface TitrationTrialState {
  initial: number; delivered: number; aliquot: number; revision: number;
  mixedRevision: number; observedRevision: number; recordedRevision: number;
  color: "clear" | "unmixed" | "faint-pink" | "overshot";
  accepted: boolean; observedAt?: number; endpointVolumeMl?: number; pendingPh?: number;
  incompletePractice?: boolean;
  equivalenceVolumeMl?: number; equivalenceApproved?: boolean;
  readingsRecorded: string[]; attempt: number;
  points: Array<{ volumeMl: number; ph?: number; color: string }>;
}

/**
 * One successful initialization of one named solid stock container.
 *
 * This is runtime execution state, not authored content, not learner evidence and not a notebook
 * entry: nothing writes it into lab JSON, a composition definition or public source metadata, and
 * it never travels inside material contents, so a transfer cannot copy it to a receiver. Its only
 * job is to answer "has this exact equipment instance already had its stock established in this
 * physical setup?", which no other runtime record can answer: a positive remaining mass is not
 * evidence of an unused source, and a measurement record can be replaced or removed.
 */
export interface SolidStockInitializationRecord {
  /** The setup action that performed the one successful initialization. */
  actionId: string;
  /** The single solid identity that was established in the container. */
  materialSoluteId: string;
  /** The configured gram total at the moment of initialization. Provenance only. */
  configuredMassG: number;
  /**
   * The evidence scope in force when the stock was established. Provenance only: a scope change
   * never reopens initialization, because changing scope is not proof that material was reset.
   */
  evidenceScopeId: string;
  evidenceScopeGeneration: number;
}

/**
 * Runtime-only readiness for a photometer's generic wavelength scan path.
 *
 * This is deliberately separate from notebook tags: a tag is durable evidence text, while this
 * record carries the instrument identity and reset epoch that make a blank usable for the current
 * physical setup. It is never part of a serialized lab definition or client-facing durable state.
 */
export type PhotometerCalibrationMethod =
  | "distilled-water-per-wavelength"
  | "selected-wavelength-pair";

export type PhotometerConfigurationMode =
  | "wavelength-scan"
  | "approved-selected-wavelength";

export interface PhotometerCalibrationState {
  epoch: number;
  /** Student proposal and teacher approval are evidence, not the instrument's actual setting. */
  proposedWavelengthNm?: number;
  approvedWavelengthNm?: number;
  /** The wavelength last explicitly configured on this instrument. */
  configuredWavelengthNm?: number;
  configurationMode?: PhotometerConfigurationMode;
  /** Incremented for every explicit configuration, including setting the same wavelength again. */
  configurationGeneration?: number;
  blankedWavelengthNm?: number;
  blankedGeneration?: number;
  blankedMethod?: PhotometerCalibrationMethod;
  darkZeroedWavelengthNm?: number;
  darkZeroedGeneration?: number;
  darkZeroMethod?: PhotometerCalibrationMethod;
}

export interface RuntimeState {
  titrationTrials?: Record<string, TitrationTrialState>;
  titrationRejectedTrials?: Record<string, TitrationTrialState[]>;
  currentNodeId: string;
  equipmentInstances: EquipmentInstance[];
  attachments: AttachmentRelation[];
  contents: Record<string, ContentState>;
  measurements: MeasurementRecord[];
  dataSeries: DataSeriesRecord[];
  temperatureEvidence: TemperatureEvidenceRecord[];
  thermalControls: Record<string, ThermalControlState>;
  evidenceScopeId: string;
  /**
   * An attempt-unique generation layered beneath the authored logical scope label. It makes a
   * repeated entry into the same label fresh for opt-in evidence without changing legacy labels.
   */
  evidenceScopeGeneration?: number;
  /**
   * Solid stock containers whose inventory has already been established in this physical setup,
   * keyed by resolved runtime equipment-instance id. Absence means uninitialized, so runtime state
   * built before this field existed stays loadable and simply starts every source uninitialized.
   *
   * The map is cleared only by constructing a fresh runtime — which is what a full physical reset
   * does — and is deliberately retained across scoped equipment resets, content clearing, evidence
   * removal and evidence-scope changes, none of which prove the material was physically restored.
   */
  solidStockInitializations?: Record<string, SolidStockInitializationRecord>;
  /** Runtime-only generic scan calibration, keyed by resolved photometer instance id. */
  photometerCalibration?: Record<string, PhotometerCalibrationState>;
  /** Incremented by physical/scoped resets so stale blank readiness cannot be revived. */
  photometerCalibrationEpoch?: number;
  calculations: CalculationRecord[];
  dropDispenses: Record<string, DropDispenseRecord>;
  repeatProgress: Record<string, {
    groupId: string;
    completedIterations: number[];
    expectedIterations: number;
    complete: boolean;
    countMeasurementId?: string;
    nextIteration?: number;
    outputMeasurementIds?: string[];
  }>;
  notebook: NotebookEntry[];
  completedNodes: string[];
  validationEvidence: ValidationEvidence[];
  attemptHistory: AttemptRecord[];
  feedbackQueue: RuntimeFeedback[];
  mode: RuntimeMode;
  importedLabs: LabDefinition[];
}

export interface RuntimeActionRequest {
  actionId?: string;
  verb: ActionVerb;
  sourceInstanceId?: string;
  targetInstanceId?: string;
  equipmentDefinitionId?: string;
  location?: EquipmentLocation;
  measurementId?: string;
  calculationId?: string;
  value?: number;
  unit?: string;
  note?: string;
  parameters?: Record<string, string | number | boolean | undefined>;
}

export interface ValidationResult<T> {
  ok: boolean;
  value?: T;
  errors: string[];
}

export const emptyContents = (label = "empty"): ContentState => ({
  kind: "empty",
  label,
  solutes: [],
  contamination: [],
  wetState: "dry",
  visualState: "empty",
});
