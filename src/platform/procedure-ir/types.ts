import type { FidelityLevel } from "../fidelity/types";

export const procedureIRSchemaId = "studio.procedure-ir" as const;
export const procedureIRSchemaVersion = "1.0" as const;

export type ProcedureIRSchemaVersion = typeof procedureIRSchemaVersion;
export type ProcedureDomainId = "chemistry" | "assay";
export type RequestedFidelityLevel = FidelityLevel;
export type DecimalString = string;

export const controlledUnitIds = [
  "1",
  "%",
  "s",
  "min",
  "h",
  "uL",
  "mL",
  "L",
  "ug",
  "mg",
  "g",
  "kg",
  "umol",
  "mmol",
  "mol",
  "uM",
  "mM",
  "M",
  "degC",
  "K",
  "rpm",
  "nm",
  "AU",
  "OD",
  "pH",
] as const;

export type ControlledUnitId = (typeof controlledUnitIds)[number];

export type UnitReferenceIR =
  | { kind: "known"; id: ControlledUnitId }
  | { kind: "unknown"; raw: string; reason: string };

export interface QuantityIR {
  value: DecimalString;
  unit: UnitReferenceIR;
  uncertainty?: DecimalString;
}

export type ScalarIR = string | boolean;
export type ScalarOrQuantity = ScalarIR | QuantityIR;

export interface SourcePosition {
  line?: number;
  column?: number;
  offset?: number;
}

export interface SourceLocator {
  sourceRef: string;
  kind:
    | "structured-step"
    | "section"
    | "paragraph"
    | "table-cell"
    | "page"
    | "timestamp"
    | "user-selection";
  pointer: string;
  start?: SourcePosition;
  end?: SourcePosition;
  quote?: string;
}

export interface SourceReference {
  id: string;
  kind: "user-input" | "document" | "dataset" | "protocol" | "web";
  title: string;
  reference?: string;
  version?: string;
  language?: string;
}

export interface ReviewFlag {
  id: string;
  code: string;
  severity: "info" | "warning" | "blocking";
  message: string;
  sourceLocators: SourceLocator[];
}

interface AmbiguityIRBase {
  id: string;
  category:
    | "ambiguous-term"
    | "missing-data"
    | "unsupported-semantics"
    | "conflict"
    | "unknown-unit"
    | "unknown-resource";
  message: string;
  sourceLocators: SourceLocator[];
  options: string[];
}

export type AmbiguityIR = AmbiguityIRBase & (
  | { resolutionStatus: "resolved"; selectedOption: string }
  | { resolutionStatus: "open" | "deferred"; selectedOption?: never }
);

export interface EvidenceRequirementIR {
  id: string;
  typeId: string;
  description: string;
  required: boolean;
  sourceLocators: SourceLocator[];
}

export interface ProcedureRole {
  id: string;
  title: string;
  description: string;
  responsibilities: string[];
  sourceLocators: SourceLocator[];
}

export interface UnknownResourceIR {
  raw: string;
  reason: string;
}

interface ProcedureResourceIRBase {
  id: string;
  label: string;
  quantity?: QuantityIR;
  sourceLocators: SourceLocator[];
  reviewFlags: ReviewFlag[];
}

export type ProcedureResourceIR = ProcedureResourceIRBase & (
  | {
      kind: "material" | "equipment" | "reagent" | "sample" | "instrument" | "consumable" | "service";
      knownResourceRef?: string;
      unknownResource?: never;
    }
  | {
      kind: "unknown";
      knownResourceRef?: never;
      unknownResource: UnknownResourceIR;
    }
);

export interface ProcedureVariableIR {
  id: string;
  label: string;
  kind: "controlled" | "independent" | "dependent" | "observed" | "unknown";
  value?: ScalarOrQuantity;
  allowedValues?: ScalarOrQuantity[];
  unit?: UnitReferenceIR;
  sourceLocators: SourceLocator[];
  reviewFlags: ReviewFlag[];
}

export interface StatePredicateIR {
  subjectRef: string;
  relation: "equals" | "not-equals" | "contains" | "exists" | "at-least" | "at-most";
  value?: ScalarOrQuantity;
  description: string;
}

export interface StateEffectIR {
  subjectRef: string;
  operation: "set" | "increase" | "decrease" | "create" | "remove" | "mark";
  value?: ScalarOrQuantity;
  description: string;
}

export type RepeatIR =
  | { count: number; until?: StatePredicateIR; maxIterations?: number }
  | { count?: never; until: StatePredicateIR; maxIterations?: number };

export interface ProcedureBranchOptionIR {
  id: string;
  condition: StatePredicateIR;
  nextStepIds: string[];
}

export interface BranchIR {
  options: ProcedureBranchOptionIR[];
  defaultNextStepIds: string[];
}

export type TimingIR =
  | { duration: QuantityIR; waitAfter?: QuantityIR; timepoint?: QuantityIR }
  | { duration?: never; waitAfter: QuantityIR; timepoint?: QuantityIR }
  | { duration?: never; waitAfter?: never; timepoint: QuantityIR };

export interface NormalizedOperationIR {
  family: string;
  actionKey: string;
  actorRefs: string[];
  inputRefs: string[];
  outputRefs: string[];
  parameters: Record<string, ScalarOrQuantity>;
}

export interface ProcedureStepIR {
  id: string;
  ordinal: number;
  title: string;
  instruction: string;
  sourceLocators: SourceLocator[];
  normalizedOperation?: NormalizedOperationIR;
  preconditions: StatePredicateIR[];
  effects: StateEffectIR[];
  dependencies: string[];
  repeat?: RepeatIR;
  branch?: BranchIR;
  timing?: TimingIR;
  requestedFidelity: RequestedFidelityLevel;
  evidenceRequirements: EvidenceRequirementIR[];
  accessibilityRequirements: string[];
  ambiguity: AmbiguityIR[];
  reviewFlags: ReviewFlag[];
}

export interface ProcedureControlFlow {
  mode: "ordered" | "dependency-graph";
  entryStepIds: string[];
  completionStepIds: string[];
  allowParallel: boolean;
}

export interface ProcedureIR {
  schema: typeof procedureIRSchemaId;
  schemaVersion: ProcedureIRSchemaVersion;
  id: string;
  title: string;
  purpose: string;
  audience?: string;
  learningObjectives: string[];
  domainHint?: ProcedureDomainId;
  sources: SourceReference[];
  roles: ProcedureRole[];
  resources: ProcedureResourceIR[];
  variables: ProcedureVariableIR[];
  steps: ProcedureStepIR[];
  controlFlow: ProcedureControlFlow;
  reviewFlags: ReviewFlag[];
  metadata: {
    createdAt: string;
    createdBy: "user" | "import" | "host-model" | "system";
    language: string;
  };
}
