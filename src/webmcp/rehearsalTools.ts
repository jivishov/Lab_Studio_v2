import type {
  RehearsalController,
} from "../experimentComposer/types";
import type { ValidateFunction } from "ajv";
import {
  REHEARSAL_TOOL_NAMES,
  rehearsalToolInputSchemas,
  rehearsalToolInputValidators,
  validateFrozenToolInput,
  type ActCurrentStepInput,
  type OperateTitrationInput,
  type SubmitStepCalculationInput,
} from "./toolSchemas";
import {
  defineWebMCPToolSet,
  type WebMCPToolDescriptor,
  type WebMCPToolSetDefinition,
} from "./registerToolSet";

const validateAsRecord = (
  controller: RehearsalController,
  validator: ValidateFunction,
  input: unknown,
) => validateFrozenToolInput<Record<string, unknown>>(
  validator as ValidateFunction<Record<string, unknown>>,
  input,
  { surface: "rehearsal", revision: controller.getRevision() },
);

/**
 * Returns no descriptor set unless a guided Player has supplied an action-enabled controller.
 * Assessment mode therefore cannot accidentally register a partial or read-only rehearsal set.
 */
export const createRehearsalToolSet = (
  controller: RehearsalController | undefined,
): WebMCPToolSetDefinition | undefined => {
  if (!controller) return undefined;

  const tools: WebMCPToolDescriptor[] = [
    {
      name: "inspect_rehearsal",
      title: "Inspect guided rehearsal",
      description: "Inspect the visible current guided step, equipment, evidence, recovery feedback, and next operation without changing rehearsal state.",
      inputSchema: rehearsalToolInputSchemas.inspect_rehearsal,
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      validateInput: (input) => validateAsRecord(controller, rehearsalToolInputValidators.inspect_rehearsal, input),
      execute: () => ({
        ok: true,
        code: "REHEARSAL_INSPECTED",
        message: "Current guided rehearsal state inspected.",
        data: controller.inspect(),
        state: { surface: "rehearsal", revision: controller.getRevision() },
      }),
    },
    {
      name: "act_current_step",
      title: "Act on current step",
      description: "Attempt the current non-titration physical interaction through the ordinary Player resolver and reducer using optional visible source and target IDs.",
      inputSchema: rehearsalToolInputSchemas.act_current_step,
      annotations: { readOnlyHint: false },
      validateInput: (input) => validateAsRecord(controller, rehearsalToolInputValidators.act_current_step, input),
      execute: (input, context) => controller.act(input as unknown as ActCurrentStepInput, context.signal),
    },
    {
      name: "operate_titration",
      title: "Operate titration",
      description: "Use bounded ordinary drops for coarse approach, exactly one ordinary drop near endpoint, or ordinary endpoint acceptance on the current titration step.",
      inputSchema: rehearsalToolInputSchemas.operate_titration,
      annotations: { readOnlyHint: false },
      validateInput: (input) => validateAsRecord(controller, rehearsalToolInputValidators.operate_titration, input),
      execute: (input, context) => controller.operateTitration(input as unknown as OperateTitrationInput, context.signal),
    },
    {
      name: "record_step_evidence",
      title: "Record step evidence",
      description: "Record evidence already available to the current ordinary record step. This no-argument tool never fabricates a learner measurement.",
      inputSchema: rehearsalToolInputSchemas.record_step_evidence,
      annotations: { readOnlyHint: false },
      validateInput: (input) => validateAsRecord(controller, rehearsalToolInputValidators.record_step_evidence, input),
      execute: (_input, context) => controller.recordEvidence(context.signal),
    },
    {
      name: "submit_step_calculation",
      title: "Submit step calculation",
      description: "Submit the current ordinary calculation. Supply a numeric value only when the visible action explicitly requires learner numeric input.",
      inputSchema: rehearsalToolInputSchemas.submit_step_calculation,
      annotations: { readOnlyHint: false },
      validateInput: (input) => validateAsRecord(controller, rehearsalToolInputValidators.submit_step_calculation, input),
      execute: (input, context) => controller.submitCalculation(input as unknown as SubmitStepCalculationInput, context.signal),
    },
    {
      name: "reset_rehearsal",
      title: "Reset guided rehearsal",
      description: "Reset the transient guided attempt to the staged definition's initial state and clear its current progress and evidence.",
      inputSchema: rehearsalToolInputSchemas.reset_rehearsal,
      annotations: { readOnlyHint: false },
      validateInput: (input) => validateAsRecord(controller, rehearsalToolInputValidators.reset_rehearsal, input),
      execute: (_input, context) => controller.reset(context.signal),
    },
  ];

  return defineWebMCPToolSet({
    surface: "rehearsal",
    allowedNames: REHEARSAL_TOOL_NAMES,
    tools,
  });
};
