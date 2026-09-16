import type { CapabilityRef } from "../../platform/capabilities/types";
import type {
  CompilationGap,
  VersionedStudioArtifact,
} from "../../platform/domain-packs/types";
import type { ProcedureIR } from "../../platform/procedure-ir/types";
import type { ContractDiagnostic } from "../../platform/validation/jsonSchema";
import type { CausalystAssessmentDefinition } from "../domain/types";

export const causalystPromptCandidateSchema = "causalyst.prompt-candidate" as const;
export const causalystPromptCandidateSchemaVersion = "1.0" as const;

export interface CausalystPromptRequest {
  assessment: CausalystAssessmentDefinition;
  prompt: string;
  revisionNumber: number;
  approvedSourceText?: string;
  sourceAttachment?: {
    attachmentId: string;
    name: string;
    mimeType: string;
    base64: string;
  };
}

export interface CausalystModelCandidateAdapter {
  readonly id: string;
  readonly modelRef: string;
  proposeProcedureIR(request: CausalystPromptRequest): Promise<unknown>;
}

export interface PromptRevisionRecord {
  revisionNumber: number;
  createdAt: string;
  promptText?: string;
  source: "prompt" | "manual";
  procedureRef?: { id: string; version: "1.0" };
  artifactRef?: { id: string; version: string };
  diagnosticCodes: string[];
  learnerChangeReason?: string;
}

export type PromptBuildResult =
  | {
      ok: true;
      procedure: ProcedureIR;
      artifact: VersionedStudioArtifact;
      usedCapabilityRefs: CapabilityRef[];
      revision: PromptRevisionRecord;
      diagnostics: ContractDiagnostic[];
    }
  | {
      ok: false;
      procedure?: ProcedureIR;
      gaps: CompilationGap[];
      revision: PromptRevisionRecord;
      diagnostics: ContractDiagnostic[];
    };
