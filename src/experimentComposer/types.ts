import type { LabDefinition } from "../domain/types";
import type { ContractDiagnostic } from "../platform/validation/jsonSchema";
import type { JsonValue, WebMCPResult } from "../webmcp/result";

export type AudienceLevel = "high_school" | "intro_college" | "technician_onboarding";
export type ExperienceLevel = "novice" | "intermediate";
export type DeliveryContext = "virtual_training" | "physical_procedure_rehearsal";
export type EndpointEvidence = "phenolphthalein";
export type ExperimentFamilyId = "acid_base_titration_v1";

export interface ExperimentRequest {
  schemaVersion: "1";
  familyId: ExperimentFamilyId;
  expectedInventoryRevision: number;
  objective: string;
  title?: string;
  audience: AudienceLevel;
  experience: ExperienceLevel;
  durationMinutes: number;
  deliveryContext: DeliveryContext;
  aliquotVolumeMl: 10 | 20 | 25;
  endpointEvidence: EndpointEvidence;
  sampleLabel?: string;
}

export type ComposerEquipmentId =
  | "burette-50ml"
  | "ring-stand-clamp"
  | "graduated-cylinder"
  | "erlenmeyer-flask-250ml"
  | "waste-beaker";

export type ComposerChemicalId =
  | "synthetic_unknown_acid_a"
  | "standardized_naoh"
  | "phenolphthalein_indicator";

export interface EquipmentInventoryItem {
  definitionId: string;
  count: number;
}

export interface ChemicalInventoryItem {
  chemicalId: ComposerChemicalId;
  quantityMl: number;
  concentrationM?: number;
  containerDefinitionId: string;
}

export interface FacilityInventory {
  splashGoggles: boolean;
  eyewash: boolean;
  spillResponseMaterials: boolean;
  compatibleBaseWasteContainer: boolean;
}

export interface LabInventoryProfile {
  schemaVersion: "1";
  revision: number;
  equipment: EquipmentInventoryItem[];
  chemicals: ChemicalInventoryItem[];
  facilities: FacilityInventory;
}

export type ComposerRoleId =
  | "burette"
  | "burette_support"
  | "aliquot_measure"
  | "receiving_flask"
  | "waste_receiver"
  | "analyte_source"
  | "titrant_source"
  | "indicator_source";

export type ComposerModuleId =
  | "mount_burette_v1"
  | "measure_aliquot_cylinder_v1"
  | "record_aliquot_v1"
  | "transfer_aliquot_v1"
  | "add_indicator_v1"
  | "record_initial_burette_v1"
  | "dispense_titrant_v1"
  | "observe_indicator_endpoint_v1"
  | "record_final_burette_v1"
  | "calculate_molarity_v1";

export interface VerifiedModuleDescriptor {
  id: ComposerModuleId;
  version: "1.0.0";
  label: string;
  requiredRoleIds: readonly ComposerRoleId[];
  actionIds: readonly string[];
  nodeIds: readonly string[];
  prerequisiteModuleIds: readonly ComposerModuleId[];
  evidenceContract: string;
  limitation?: string;
}

export interface VerifiedExperimentFamily {
  id: ExperimentFamilyId;
  version: "1.0.0";
  sourceLabId: "acid-base-titration";
  sourceLabVersion: "3.0.1";
  sourceTechniqueId: "titration-endpoint";
  sourceTechniqueVersion: "3.0.1";
  supportedObjectives: readonly string[];
  parameterBounds: {
    aliquotVolumeMl: readonly [10, 20, 25];
    titrantMolarityM: { min: number; max: number };
  };
  requiredRoles: readonly ComposerRoleId[];
  optionalRoles: readonly ComposerRoleId[];
  moduleIds: readonly ComposerModuleId[];
  modelLimitations: readonly string[];
}

export type FidelityStatus =
  | "modeled_and_executable"
  | "procedurally_executable"
  | "design_only"
  | "unsupported";

export interface FidelityManifest {
  status: FidelityStatus;
  modeled: string[];
  proceduralOnly: string[];
  assumptions: string[];
  limitations: string[];
  safetyDeclarations: string[];
  warnings: string[];
}

export interface CompiledExperimentBlueprint {
  id: string;
  familyId: ExperimentFamilyId;
  familyVersion: "1.0.0";
  request: ExperimentRequest;
  sourceInventoryRevision: number;
  selectedSamplePresetId: "synthetic_unknown_acid_a";
  resolvedRoles: Record<ComposerRoleId, string>;
  moduleIds: ComposerModuleId[];
  model: {
    analyteMolarityM: number;
    analyteVolumeMl: number;
    titrantMolarityM: number;
    stoichiometricRatio: { analyte: 1; titrant: 1 };
    dropVolumeMl: number;
    endpointOffsetDrops: number;
    maxExtraDrops: number;
    buretteFillVolumeMl: number;
    indicatorVolumeMl: number;
    acidReserveMl: number;
    naohReserveMl: number;
  };
  fidelity: FidelityManifest;
}

export type StageStaleReason = "inventory_changed" | "draft_changed";

export interface StageGuardIdentity {
  stageId: string;
  stageRevision: number;
  sourceInventoryRevision: number;
  sourceDraftFingerprint: string;
}

export interface ProtocolReportGuardIdentity {
  reportId: string;
  stage: StageGuardIdentity;
  passed: boolean;
}

export interface StagedExperiment {
  stageId: string;
  stageRevision: number;
  createdAt: string;
  sourceInventoryRevision: number;
  sourceDraftFingerprint: string;
  request: ExperimentRequest;
  blueprint: CompiledExperimentBlueprint;
  definition: LabDefinition;
  validation: {
    schemaErrors: string[];
    interactionWarnings: string[];
    inventoryErrors: string[];
  };
  staleReasons: StageStaleReason[];
}

export interface PublicStageSummary {
  stageId: string;
  stageRevision: number;
  familyId: ExperimentFamilyId;
  title: string;
  objective: string;
  audience: AudienceLevel;
  experience: ExperienceLevel;
  durationMinutes: number;
  deliveryContext: DeliveryContext;
  resolvedRoles: Record<ComposerRoleId, string>;
  moduleIds: ComposerModuleId[];
  workingVolumes: {
    aliquotMl: number;
    buretteFillMl: number;
    indicatorMl: number;
  };
  fidelity: FidelityManifest;
  staleReasons: StageStaleReason[];
}

export type ComposerValidationPhase =
  | "schema"
  | "revision"
  | "request_options"
  | "roles"
  | "chemicals"
  | "facilities"
  | "capacity"
  | "model"
  | "definition"
  | "studio_interactions";

export type ComposerErrorCode =
  | "SCHEMA_VALIDATION_FAILED"
  | "UNSUPPORTED_EXPERIMENT_FAMILY"
  | "STALE_INVENTORY_REVISION"
  | "UNSUPPORTED_REQUEST_OPTION"
  | "UNKNOWN_EQUIPMENT_ID"
  | "DUPLICATE_EQUIPMENT_ID"
  | "MISSING_BURETTE"
  | "MISSING_BURETTE_SUPPORT"
  | "MISSING_GRADUATED_CYLINDER"
  | "MISSING_RECEIVING_FLASK"
  | "MISSING_WASTE_RECEIVER"
  | "MISSING_ANALYTE"
  | "MISSING_TITRANT"
  | "MISSING_INDICATOR"
  | "DUPLICATE_CHEMICAL_ID"
  | "INVALID_CHEMICAL_CONTAINER"
  | "INVALID_CHEMICAL_QUANTITY"
  | "INVALID_TITRANT_CONCENTRATION"
  | "COMPILER_OWNED_CHEMICAL_FIELD"
  | "MISSING_PHYSICAL_FACILITY"
  | "CAPACITY_EXCEEDED"
  | "INSUFFICIENT_ACID_QUANTITY"
  | "INSUFFICIENT_NAOH_QUANTITY"
  | "INSUFFICIENT_INDICATOR_QUANTITY"
  | "TITRATION_MODEL_DERIVATION_FAILED"
  | "COMPILED_DEFINITION_INVALID"
  | "STUDIO_INTERACTION_BLOCKER";

export interface ComposerValidationIssue {
  code: ComposerErrorCode;
  phase: ComposerValidationPhase;
  message: string;
  path?: string;
  recoverable: true;
  diagnostics?: ContractDiagnostic[];
}

export type ComposerPreviewOutcome =
  | { ok: true; stage: StagedExperiment; summary: PublicStageSummary }
  | { ok: false; issues: ComposerValidationIssue[] };

export interface ComposerGuardedState {
  stage?: StagedExperiment;
  protocolReport?: ProtocolReportGuardIdentity;
}

/** Failed previews preserve both the previous valid stage and its matching report. */
export const applyComposerPreviewOutcome = (
  previous: ComposerGuardedState,
  outcome: ComposerPreviewOutcome,
): ComposerGuardedState => outcome.ok
  ? { stage: outcome.stage, protocolReport: undefined }
  : previous;

export const stageGuardIdentity = (stage: StagedExperiment): StageGuardIdentity => ({
  stageId: stage.stageId,
  stageRevision: stage.stageRevision,
  sourceInventoryRevision: stage.sourceInventoryRevision,
  sourceDraftFingerprint: stage.sourceDraftFingerprint,
});

export const stageGuardsMatch = (
  left: StageGuardIdentity,
  right: StageGuardIdentity,
): boolean => left.stageId === right.stageId
  && left.stageRevision === right.stageRevision
  && left.sourceInventoryRevision === right.sourceInventoryRevision
  && left.sourceDraftFingerprint === right.sourceDraftFingerprint;

export interface ComposerSessionController {
  getRevision(): number;
  getInventory(): LabInventoryProfile;
  getStage(): StagedExperiment | undefined;
  getProtocolReport(): ProtocolReportGuardIdentity | undefined;
  replaceInventory(input: LabInventoryProfile, signal: AbortSignal): Promise<WebMCPResult<JsonValue>>;
  preview(request: ExperimentRequest, signal: AbortSignal): Promise<WebMCPResult<JsonValue>>;
  inspectPreview(): PublicStageSummary | undefined;
  startRehearsal(stageId: string, signal: AbortSignal): Promise<WebMCPResult<JsonValue>>;
  runProtocolCheck(stageId: string, signal: AbortSignal): Promise<WebMCPResult<JsonValue>>;
}

export interface RehearsalController {
  getRevision(): number;
  inspect(): JsonValue;
  act(input: { sourceInstanceId?: string; targetInstanceId?: string }, signal: AbortSignal): Promise<WebMCPResult<JsonValue>>;
  operateTitration(input: { mode: "coarse" | "drop" | "accept" }, signal: AbortSignal): Promise<WebMCPResult<JsonValue>>;
  recordEvidence(signal: AbortSignal): Promise<WebMCPResult<JsonValue>>;
  submitCalculation(input: { value?: number }, signal: AbortSignal): Promise<WebMCPResult<JsonValue>>;
  reset(signal: AbortSignal): Promise<WebMCPResult<JsonValue>>;
}
