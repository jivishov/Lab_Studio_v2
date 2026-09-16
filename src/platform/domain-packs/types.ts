import type { ProcedureIR } from "../procedure-ir/types";
import type { CapabilityManifestFragment } from "../capabilities/types";
import type { EvidenceRegistryFragment } from "../evidence/types";
import type { ResourceRunPlan } from "../planning/types";
import type { StudioArtifactPackage } from "../artifacts/types";
export type { StudioArtifactPackage } from "../artifacts/types";

export type StudioDomainPackId = "chemistry" | "assay";

export type VersionedStudioArtifact =
  | {
      schema: string;
      schemaVersion: string;
      id: string;
    }
  | {
      id: string;
      metadata: {
        version: string;
      };
    };

export interface DomainPackDescriptor {
  id: StudioDomainPackId;
  version: string;
  title: string;
  artifactKinds: string[];
  supportedProcedureIRVersions: string[];
  minimumStudioCoreVersion: string;
  publicNamespaces: string[];
  limitations: string[];
}

export interface DomainPackSchemas {
  artifact: object;
  validationContext?: object;
  package?: object;
  planningProfile?: object;
  observationImport?: object;
  assayLensRequest?: object;
  assayLensObservation?: object;
  protocolProfile?: object;
  protocolAnalysis?: object;
}

export type CapabilityManifestFragmentContract = CapabilityManifestFragment;

export type EvidenceRegistryFragmentContract = EvidenceRegistryFragment;

export interface ProcedureConstraints<TExtension = unknown> {
  requiredOperationRefs: string[];
  allowedOperationRefs?: string[];
  maximumSteps?: number;
  extension?: TExtension;
}

export interface CompilationGap {
  stepId?: string;
  code: string;
  category: "missing-data" | "ambiguous" | "unsupported" | "version-mismatch";
  message: string;
  required: boolean;
}

export interface CoverageReportContract {
  procedureId: string;
  domainPackId: StudioDomainPackId;
  domainPackVersion: string;
  gaps: CompilationGap[];
}

export interface ComposeArtifactRequest<TConstraintExtension = unknown> {
  procedure: ProcedureIR;
  constraints: ProcedureConstraints<TConstraintExtension>;
}

export type ComposeArtifactResult<TArtifact extends VersionedStudioArtifact> =
  | { ok: true; artifact: TArtifact; gaps: [] }
  | { ok: false; gaps: CompilationGap[] };

export interface ArtifactValidationDiagnostic {
  code: string;
  path: string;
  message: string;
  severity: "error" | "warning";
}

export type ValidationReport<TArtifact extends VersionedStudioArtifact> =
  | { ok: true; artifact: TArtifact; diagnostics: ArtifactValidationDiagnostic[] }
  | { ok: false; diagnostics: ArtifactValidationDiagnostic[] };

export interface RunContext<TExtension = unknown> {
  requestId: string;
  extension?: TExtension;
}

export interface RunPlan<TExtension = unknown> {
  schema: "studio.run-plan";
  schemaVersion: string;
  domainPackId: StudioDomainPackId;
  extension?: TExtension;
}

export interface ArtifactPackageContext {
  packageId: string;
  createdAt: string;
  capabilityManifestVersion?: string;
  runPlan?: ResourceRunPlan;
}

export interface DomainPackConformanceProvider<TArtifact extends VersionedStudioArtifact> {
  readonly goldenArtifactIds: readonly string[];
  getGoldenArtifact(id: string): TArtifact | undefined;
}

export interface StudioDomainPack<
  TArtifact extends VersionedStudioArtifact = VersionedStudioArtifact,
  TValidationContext = unknown,
  TRunPlanExtension = unknown,
  TConstraintExtension = unknown,
  TCapabilityFragment extends CapabilityManifestFragmentContract = CapabilityManifestFragmentContract,
  TEvidenceFragment extends EvidenceRegistryFragmentContract = EvidenceRegistryFragmentContract,
  TCoverageReport extends CoverageReportContract = CoverageReportContract,
> {
  readonly descriptor: DomainPackDescriptor;
  readonly schemas: DomainPackSchemas;

  getCapabilityManifestFragment(): TCapabilityFragment;
  getEvidenceRegistryFragment(): TEvidenceFragment;

  assessProcedure(
    procedure: ProcedureIR,
    constraints: ProcedureConstraints<TConstraintExtension>,
  ): TCoverageReport;

  composeArtifact(
    request: ComposeArtifactRequest<TConstraintExtension>,
  ): ComposeArtifactResult<TArtifact>;

  validateArtifact(
    artifact: unknown,
    context: TValidationContext,
  ): ValidationReport<TArtifact>;

  planRun(
    artifact: TArtifact,
    context: RunContext,
  ): RunPlan<TRunPlanExtension>;

  packageArtifact(
    artifact: TArtifact,
    context: ArtifactPackageContext,
  ): StudioArtifactPackage<TArtifact>;

  readonly conformance: DomainPackConformanceProvider<TArtifact>;
}

export type AnyStudioDomainPack = StudioDomainPack<VersionedStudioArtifact, unknown, unknown, unknown>;
