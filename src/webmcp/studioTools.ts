import type { ValidateFunction } from "ajv";
import {
  acidBaseTitrationFamily,
  composerChemicalContainers,
  composerEquipmentIds,
  verifiedEquipmentCapabilities,
  verifiedModuleDescriptors,
} from "../experimentComposer/catalogs";
import type {
  LabInventoryProfile,
  ProtocolReportGuardIdentity,
  PublicStageSummary,
} from "../experimentComposer/types";
import { equipmentById } from "../equipment/catalog";
import {
  STUDIO_TOOL_NAMES,
  studioToolInputSchemas,
  studioToolInputValidators,
  validateFrozenToolInput,
  type ComposerSessionController,
  type EmptyToolInput,
  type PreviewLabExperimentInput,
  type ReplaceLabInventoryInput,
  type StageIdInput,
  type StudioToolName,
} from "./toolSchemas";
import {
  defineWebMCPToolSet,
  type WebMCPExecutionContext,
  type WebMCPToolDescriptor,
  type WebMCPToolSetDefinition,
} from "./registerToolSet";
import type { JsonValue, WebMCPResult } from "./result";

const invalidInventory = (
  controller: ComposerSessionController,
  code: string,
  message: string,
): WebMCPResult<JsonValue> => ({
  ok: false,
  code,
  message,
  state: { surface: "studio", revision: controller.getRevision() },
});

const semanticInventoryIssue = (
  controller: ComposerSessionController,
  input: ReplaceLabInventoryInput,
): WebMCPResult<JsonValue> | undefined => {
  if (input.expectedRevision !== controller.getInventory().revision) {
    return invalidInventory(
      controller,
      "STALE_INVENTORY_REVISION",
      `Expected inventory revision ${input.expectedRevision}; inspect again and use revision ${controller.getInventory().revision}.`,
    );
  }
  const supportedEquipment = new Set<string>(composerEquipmentIds);
  const unknown = input.equipment.find((item) => !supportedEquipment.has(item.definitionId));
  if (unknown) {
    return invalidInventory(controller, "UNKNOWN_EQUIPMENT_ID", `Unsupported equipment ID: ${unknown.definitionId}. Inspect capabilities for valid IDs.`);
  }
  if (new Set(input.equipment.map((item) => item.definitionId)).size !== input.equipment.length) {
    return invalidInventory(controller, "DUPLICATE_EQUIPMENT_ID", "Each equipment definition ID may appear only once; use count for multiples.");
  }
  if (new Set(input.chemicals.map((item) => item.chemicalId)).size !== input.chemicals.length) {
    return invalidInventory(controller, "DUPLICATE_CHEMICAL_ID", "Each supported chemical ID may appear only once.");
  }
  const invalidContainer = input.chemicals.find(
    (item) => composerChemicalContainers[item.chemicalId] !== item.containerDefinitionId,
  );
  if (invalidContainer) {
    return invalidInventory(
      controller,
      "INVALID_CHEMICAL_CONTAINER",
      `${invalidContainer.chemicalId} must use container ${composerChemicalContainers[invalidContainer.chemicalId]}.`,
    );
  }
  return undefined;
};

const compactCapabilities = (): JsonValue => ({
  family: {
    id: acidBaseTitrationFamily.id,
    version: acidBaseTitrationFamily.version,
    objective: "Estimate synthetic monoprotic-acid molarity with standardized NaOH and phenolphthalein.",
    aliquotVolumeMl: [...acidBaseTitrationFamily.parameterBounds.aliquotVolumeMl],
    titrantMolarityM: acidBaseTitrationFamily.parameterBounds.titrantMolarityM,
    audience: ["high_school", "intro_college", "technician_onboarding"],
    experience: ["novice", "intermediate"],
    deliveryContext: ["virtual_training", "physical_procedure_rehearsal"],
  },
  equipment: composerEquipmentIds.map((definitionId) => {
    const item = verifiedEquipmentCapabilities.find((candidate) => candidate.definitionId === definitionId);
    return {
      id: definitionId,
      alias: equipmentById.get(definitionId)?.label ?? definitionId,
      capacityMl: item?.capacityMl ?? 0,
      precisionMl: item?.precisionMl ?? 0,
    };
  }),
  chemicals: Object.entries(composerChemicalContainers).map(([id, containerId]) => ({ id, containerId })),
  moduleCount: verifiedModuleDescriptors.length,
  limits: [
    "One synthetic acid/NaOH family only.",
    "Simulation inventory is a declared profile, not proof of room contents.",
    "No pH curve, indicator equilibrium, analytical certification, Save, Export, Apply, or Publish tool.",
  ],
});

const compactText = (value: string | undefined, limit: number): string | undefined => {
  const compact = value
    ?.replace(/[\u0000-\u001f\u007f-\u009f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!compact) return undefined;
  return compact.length <= limit ? compact : `${compact.slice(0, Math.max(0, limit - 1))}…`;
};

export const compactStudioStageSummary = (
  summary: PublicStageSummary,
  report?: ProtocolReportGuardIdentity,
): JsonValue => ({
  stageId: summary.stageId,
  stageRevision: summary.stageRevision,
  familyId: summary.familyId,
  request: {
    title: compactText(summary.title, 60) ?? "Untitled staged experiment",
    objective: compactText(summary.objective, 120) ?? "",
    audience: summary.audience,
    deliveryContext: summary.deliveryContext,
    durationMinutes: summary.durationMinutes,
  },
  moduleLabels: summary.moduleIds.map(
    (moduleId) => verifiedModuleDescriptors.find((descriptor) => descriptor.id === moduleId)?.label ?? moduleId,
  ),
  resolvedRoleCount: Object.keys(summary.resolvedRoles).length,
  workingVolumes: summary.workingVolumes,
  fidelity: {
    status: summary.fidelity.status,
    warningCount: summary.fidelity.warnings.length,
    limitationCount: summary.fidelity.limitations.length,
    firstWarning: compactText(summary.fidelity.warnings[0], 100) ?? null,
    firstLimitation: compactText(summary.fidelity.limitations[0], 120) ?? null,
  },
  protocolReport: report
    ? { reportId: compactText(report.reportId, 80) ?? "current-report", passed: report.passed }
    : null,
  staleReasons: summary.staleReasons,
});

const descriptor = <TInput extends object>(
  controller: ComposerSessionController,
  name: StudioToolName,
  title: string,
  description: string,
  inputSchema: object,
  validator: ValidateFunction<TInput>,
  annotations: WebMCP.ToolAnnotations,
  execute: (
    input: TInput,
    context: WebMCPExecutionContext,
  ) => ReturnType<WebMCPToolDescriptor["execute"]>,
): WebMCPToolDescriptor => ({
  name,
  title,
  description,
  inputSchema,
  annotations,
  validateInput: (input) => validateFrozenToolInput(
    validator as ValidateFunction<Record<string, unknown>>,
    input,
    { surface: "studio", revision: controller.getRevision() },
  ),
  execute: (input, context) => execute(input as TInput, context),
});

export const createStudioToolSet = (
  controller: ComposerSessionController,
): WebMCPToolSetDefinition => defineWebMCPToolSet({
  surface: "studio",
  allowedNames: STUDIO_TOOL_NAMES,
  tools: [
    descriptor<EmptyToolInput>(
      controller,
      "inspect_lab_capabilities",
      "Inspect lab capabilities",
      "Inspect the single verified experiment family, supported inputs, apparatus IDs, modules, and fidelity limits. Returns no hidden model values.",
      studioToolInputSchemas.inspect_lab_capabilities,
      studioToolInputValidators.inspect_lab_capabilities,
      { readOnlyHint: true },
      () => ({
        ok: true,
        code: "CAPABILITIES_INSPECTED",
        message: "Supported Composer capabilities returned.",
        data: compactCapabilities(),
        state: { surface: "studio", revision: controller.getRevision() },
      }),
    ),
    descriptor<EmptyToolInput>(
      controller,
      "inspect_lab_inventory",
      "Inspect lab inventory",
      "Inspect the current reversible simulation inventory profile and exact revision. The profile is declared simulation input, not proof of a physical room.",
      studioToolInputSchemas.inspect_lab_inventory,
      studioToolInputValidators.inspect_lab_inventory,
      { readOnlyHint: true },
      () => {
        const inventory = controller.getInventory();
        return {
          ok: true,
          code: "INVENTORY_INSPECTED",
          message: "Current simulation inventory profile returned.",
          data: { ...inventory, disclaimer: "Declared simulation profile; not verified physical-room contents." } as unknown as JsonValue,
          state: { surface: "studio", revision: controller.getRevision() },
        };
      },
    ),
    descriptor<ReplaceLabInventoryInput>(
      controller,
      "replace_lab_inventory",
      "Replace lab inventory",
      "Replace the complete reversible simulation inventory when expectedRevision matches. The visible revision acknowledgement is awaited before success.",
      studioToolInputSchemas.replace_lab_inventory,
      studioToolInputValidators.replace_lab_inventory,
      { readOnlyHint: false },
      async (input, context) => {
        const issue = semanticInventoryIssue(controller, input);
        if (issue) return issue;
        const profile: LabInventoryProfile = {
          schemaVersion: "1",
          revision: input.expectedRevision + 1,
          equipment: structuredClone(input.equipment),
          chemicals: structuredClone(input.chemicals),
          facilities: { ...input.facilities },
        };
        return controller.replaceInventory(profile, context.signal);
      },
    ),
    descriptor<PreviewLabExperimentInput>(
      controller,
      "preview_lab_experiment",
      "Preview lab experiment",
      "Validate and compile one supported request against current inventory, then stage it for visible human review without changing the Studio draft.",
      studioToolInputSchemas.preview_lab_experiment,
      studioToolInputValidators.preview_lab_experiment,
      { readOnlyHint: false, untrustedContentHint: true },
      async (input, context) => {
        const result = await controller.preview(input, context.signal);
        if (!result.ok) return result;
        const summary = controller.inspectPreview();
        const resultStageId = result.data !== null && result.data !== undefined
          && typeof result.data === "object" && !Array.isArray(result.data)
          && typeof result.data.stageId === "string"
          ? result.data.stageId
          : undefined;
        if (!summary || (resultStageId && summary.stageId !== resultStageId)) {
          return {
            ok: false,
            code: "VISIBLE_STAGE_CHANGED",
            message: "The preview mutation completed, but the visible stage changed before it could be summarized. Inspect the current preview; do not replay blindly.",
            state: { surface: "studio", revision: controller.getRevision() },
          };
        }
        return { ...result, data: compactStudioStageSummary(summary, controller.getProtocolReport()) };
      },
    ),
    descriptor<EmptyToolInput>(
      controller,
      "inspect_lab_preview",
      "Inspect lab preview",
      "Inspect the current sanitized staged summary and freshly recomputed staleness. Returns no full definition, fingerprint, ground truth, or hidden endpoint values.",
      studioToolInputSchemas.inspect_lab_preview,
      studioToolInputValidators.inspect_lab_preview,
      { readOnlyHint: true, untrustedContentHint: true },
      () => {
        const summary = controller.inspectPreview();
        return summary
          ? {
              ok: true,
              code: "PREVIEW_INSPECTED",
              message: summary.staleReasons.length ? "The current stage is stale and must be restaged." : "Current staged summary returned.",
              data: compactStudioStageSummary(summary, controller.getProtocolReport()),
              state: { surface: "studio", revision: controller.getRevision() },
            }
          : {
              ok: false,
              code: "NO_ACTIVE_STAGE",
              message: "No experiment is staged. Call preview_lab_experiment first.",
              state: { surface: "studio", revision: controller.getRevision() },
            };
      },
    ),
    descriptor<StageIdInput>(
      controller,
      "start_lab_rehearsal",
      "Start lab rehearsal",
      "Open a transient guided rehearsal for the exact current non-stale stage. Success waits for the visible Player and complete six-tool destination surface.",
      studioToolInputSchemas.start_lab_rehearsal,
      studioToolInputValidators.start_lab_rehearsal,
      { readOnlyHint: false },
      (input, context) => controller.startRehearsal(input.stageId, context.signal),
    ),
    descriptor<StageIdInput>(
      controller,
      "run_lab_protocol_check",
      "Run lab Protocol Check",
      "Execute ten isolated deterministic cases for the exact current non-stale stage and bind the completed visible report without changing a human rehearsal.",
      studioToolInputSchemas.run_lab_protocol_check,
      studioToolInputValidators.run_lab_protocol_check,
      { readOnlyHint: false },
      (input, context) => controller.runProtocolCheck(input.stageId, context.signal),
    ),
  ],
});
