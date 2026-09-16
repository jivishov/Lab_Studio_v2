import type { ValidateFunction } from "ajv";
import {
  chemicalInventoryItemSchema,
  experimentRequestSchema,
  facilityInventorySchema,
  equipmentInventoryItemSchema,
} from "../experimentComposer/schemas";
import type {
  ExperimentRequest,
  FacilityInventory,
  ChemicalInventoryItem,
  EquipmentInventoryItem,
  ComposerSessionController,
  RehearsalController,
  StageGuardIdentity,
  ProtocolReportGuardIdentity,
} from "../experimentComposer/types";
import {
  compileJsonSchemaValidator,
  schemaErrorsToDiagnostics,
} from "../platform/validation/jsonSchema";
import type { WebMCPInputValidation } from "./registerToolSet";
import type { JsonValue, WebMCPResult, WebMCPSurface } from "./result";

export type {
  ComposerSessionController,
  ProtocolReportGuardIdentity,
  RehearsalController,
  StageGuardIdentity,
};

export type StudioToolName =
  | "inspect_lab_capabilities"
  | "inspect_lab_inventory"
  | "replace_lab_inventory"
  | "preview_lab_experiment"
  | "inspect_lab_preview"
  | "start_lab_rehearsal"
  | "run_lab_protocol_check";

export type RehearsalToolName =
  | "inspect_rehearsal"
  | "act_current_step"
  | "operate_titration"
  | "record_step_evidence"
  | "submit_step_calculation"
  | "reset_rehearsal";

export const STUDIO_TOOL_NAMES = Object.freeze([
  "inspect_lab_capabilities",
  "inspect_lab_inventory",
  "replace_lab_inventory",
  "preview_lab_experiment",
  "inspect_lab_preview",
  "start_lab_rehearsal",
  "run_lab_protocol_check",
] as const satisfies readonly StudioToolName[]);

export const REHEARSAL_TOOL_NAMES = Object.freeze([
  "inspect_rehearsal",
  "act_current_step",
  "operate_titration",
  "record_step_evidence",
  "submit_step_calculation",
  "reset_rehearsal",
] as const satisfies readonly RehearsalToolName[]);

export interface EmptyToolInput extends Record<string, never> {}

export interface ReplaceLabInventoryInput {
  expectedRevision: number;
  equipment: EquipmentInventoryItem[];
  chemicals: ChemicalInventoryItem[];
  facilities: FacilityInventory;
}

export type PreviewLabExperimentInput = ExperimentRequest;

export interface StageIdInput {
  stageId: string;
}

export interface ActCurrentStepInput {
  sourceInstanceId?: string;
  targetInstanceId?: string;
}

export interface OperateTitrationInput {
  mode: "coarse" | "drop" | "accept";
}

export interface SubmitStepCalculationInput {
  value?: number;
}

export interface ToolStateIdentity {
  surface: WebMCPSurface;
  revision: number;
}

export type StudioToolResult<T extends JsonValue = JsonValue> = WebMCPResult<T> & {
  state: ToolStateIdentity & { surface: "studio" };
};

export type RehearsalToolResult<T extends JsonValue = JsonValue> = WebMCPResult<T> & {
  state: ToolStateIdentity & { surface: "rehearsal" };
};

const strictObject = (
  required: readonly string[],
  properties: Record<string, unknown>,
): Record<string, unknown> => ({
  type: "object",
  additionalProperties: false,
  required,
  properties,
});

const noInputSchema = strictObject([], {});
const stageIdSchema = strictObject(["stageId"], {
  stageId: {
    type: "string",
    minLength: 1,
    maxLength: 80,
    description: "Exact current stage ID returned by preview or preview inspection.",
  },
});

export const studioToolInputSchemas = {
  inspect_lab_capabilities: noInputSchema,
  inspect_lab_inventory: noInputSchema,
  replace_lab_inventory: strictObject(
    ["expectedRevision", "equipment", "chemicals", "facilities"],
    {
      expectedRevision: {
        type: "integer",
        minimum: 0,
        maximum: Number.MAX_SAFE_INTEGER,
        description: "Current inventory revision returned by inspection.",
      },
      equipment: {
        type: "array",
        minItems: 1,
        maxItems: 20,
        items: equipmentInventoryItemSchema,
        description: "Complete replacement list of supported apparatus counts.",
      },
      chemicals: {
        type: "array",
        minItems: 1,
        maxItems: 10,
        items: chemicalInventoryItemSchema,
        description: "Complete replacement list of supported reagent containers.",
      },
      facilities: {
        ...facilityInventorySchema,
        description: "Declared PPE, eyewash, spill, and compatible base-waste readiness.",
      },
    },
  ),
  preview_lab_experiment: experimentRequestSchema,
  inspect_lab_preview: noInputSchema,
  start_lab_rehearsal: stageIdSchema,
  run_lab_protocol_check: stageIdSchema,
} as const satisfies Record<StudioToolName, object>;

export const rehearsalToolInputSchemas = {
  inspect_rehearsal: noInputSchema,
  act_current_step: strictObject([], {
    sourceInstanceId: {
      type: "string",
      minLength: 1,
      maxLength: 100,
      description: "Visible source equipment instance ID; omit if the step has no source.",
    },
    targetInstanceId: {
      type: "string",
      minLength: 1,
      maxLength: 100,
      description: "Visible target equipment instance ID; omit if the step has no target.",
    },
  }),
  operate_titration: strictObject(["mode"], {
    mode: {
      enum: ["coarse", "drop", "accept"],
      description: "Use coarse before the fine window, drop near endpoint, or accept visible endpoint.",
    },
  }),
  record_step_evidence: noInputSchema,
  submit_step_calculation: strictObject([], {
    value: {
      type: "number",
      minimum: 0,
      maximum: 10,
      description: "Learner-entered numeric value only when the current calculation requests one.",
    },
  }),
  reset_rehearsal: noInputSchema,
} as const satisfies Record<RehearsalToolName, object>;

const deepFreeze = <T>(value: T): T => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value as Record<string, unknown>).forEach(deepFreeze);
  return value;
};

deepFreeze(studioToolInputSchemas);
deepFreeze(rehearsalToolInputSchemas);

export const studioToolInputValidators = Object.freeze({
  inspect_lab_capabilities: compileJsonSchemaValidator<EmptyToolInput>(studioToolInputSchemas.inspect_lab_capabilities),
  inspect_lab_inventory: compileJsonSchemaValidator<EmptyToolInput>(studioToolInputSchemas.inspect_lab_inventory),
  replace_lab_inventory: compileJsonSchemaValidator<ReplaceLabInventoryInput>(studioToolInputSchemas.replace_lab_inventory),
  preview_lab_experiment: compileJsonSchemaValidator<PreviewLabExperimentInput>(studioToolInputSchemas.preview_lab_experiment),
  inspect_lab_preview: compileJsonSchemaValidator<EmptyToolInput>(studioToolInputSchemas.inspect_lab_preview),
  start_lab_rehearsal: compileJsonSchemaValidator<StageIdInput>(studioToolInputSchemas.start_lab_rehearsal),
  run_lab_protocol_check: compileJsonSchemaValidator<StageIdInput>(studioToolInputSchemas.run_lab_protocol_check),
});

export const rehearsalToolInputValidators = Object.freeze({
  inspect_rehearsal: compileJsonSchemaValidator<EmptyToolInput>(rehearsalToolInputSchemas.inspect_rehearsal),
  act_current_step: compileJsonSchemaValidator<ActCurrentStepInput>(rehearsalToolInputSchemas.act_current_step),
  operate_titration: compileJsonSchemaValidator<OperateTitrationInput>(rehearsalToolInputSchemas.operate_titration),
  record_step_evidence: compileJsonSchemaValidator<EmptyToolInput>(rehearsalToolInputSchemas.record_step_evidence),
  submit_step_calculation: compileJsonSchemaValidator<SubmitStepCalculationInput>(rehearsalToolInputSchemas.submit_step_calculation),
  reset_rehearsal: compileJsonSchemaValidator<EmptyToolInput>(rehearsalToolInputSchemas.reset_rehearsal),
});

export const validateFrozenToolInput = <TInput extends Record<string, unknown>>(
  validator: ValidateFunction<TInput>,
  input: unknown,
  state: ToolStateIdentity,
): WebMCPInputValidation<TInput> => {
  if (validator(input)) return { ok: true, value: input };
  const diagnostics = schemaErrorsToDiagnostics(validator.errors);
  return {
    ok: false,
    result: {
      ok: false,
      code: "INVALID_TOOL_ARGUMENTS",
      message: diagnostics.length === 0
        ? "Tool arguments did not match the strict input schema."
        : diagnostics.map((item) => `${item.path}: ${item.message}`).join("; ").slice(0, 900),
      state,
    },
  };
};
