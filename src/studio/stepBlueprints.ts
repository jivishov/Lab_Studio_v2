import type { ActionVerb, ProcessNodeType } from "../domain/types";
import { studioTemplates, type InsertTemplateStepOptions, type StudioTemplate } from "./studioState";
import type { StudioTransaction } from "./studioTransactions";
import type { StudioDiagnostic } from "./studioReadiness";

export interface BlueprintField {
  id: string;
  label: string;
  kind: "text" | "number" | "equipment" | "statePath" | "calculation" | "choice";
  required?: boolean;
}

export interface StudioBuildContext {
  revision: string;
  equipmentIds?: Set<string>;
}

export interface StepBlueprintInput {
  idempotencyKey?: string;
  options?: InsertTemplateStepOptions;
  values?: Record<string, unknown>;
}

export interface StepBlueprint<TInput = StepBlueprintInput> {
  id: string;
  label: string;
  nodeType: ProcessNodeType;
  verb: ActionVerb;
  fields: BlueprintField[];
  template: StudioTemplate;
  build: (input: TInput, ctx: StudioBuildContext) => StudioTransaction;
  validate: (input: TInput, ctx: StudioBuildContext) => StudioDiagnostic[];
}

const fieldsForVerb = (verb: ActionVerb): BlueprintField[] => {
  if (verb === "measureVolume") {
    return [
      { id: "sourceDefinitionId", label: "Source equipment", kind: "equipment", required: true },
      { id: "targetDefinitionId", label: "Target equipment", kind: "equipment", required: true },
      { id: "volumeMl", label: "Volume", kind: "number", required: true },
      { id: "measurementId", label: "Measurement", kind: "text", required: true },
    ];
  }
  if (verb === "weigh") {
    return [
      { id: "sourceDefinitionId", label: "Item to weigh", kind: "equipment", required: true },
      { id: "instrumentDefinitionId", label: "Balance", kind: "equipment", required: true },
      { id: "measurementId", label: "Measurement", kind: "text", required: true },
    ];
  }
  if (verb === "calculate") {
    return [
      { id: "calculationId", label: "Calculation", kind: "calculation", required: true },
      { id: "expected", label: "Expected value", kind: "number" },
      { id: "tolerance", label: "Tolerance", kind: "number" },
    ];
  }
  if (verb === "record" || verb === "observe") {
    return [
      { id: "notebookTag", label: "Notebook tag", kind: "text" },
      { id: "note", label: "Prompt", kind: "text" },
    ];
  }
  return [
    { id: "sourceDefinitionId", label: "Source equipment", kind: "equipment" },
    { id: "targetDefinitionId", label: "Target equipment", kind: "equipment" },
  ];
};

const blueprintIdempotencyKey = (template: StudioTemplate, input: StepBlueprintInput): string =>
  input.idempotencyKey ??
  `${template.id}:${input.options?.placement ?? "append"}:${input.options?.anchorNodeId ?? "end"}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;

const validateBlueprintInput = (
  blueprintId: string,
  fields: BlueprintField[],
  input: StepBlueprintInput,
  ctx: StudioBuildContext,
): StudioDiagnostic[] =>
  fields.flatMap<StudioDiagnostic>((field) => {
    const value = input.values?.[field.id];
    const missing = value === undefined || value === null || value === "";
    if (field.required && missing) {
      return [{
        id: `${blueprintId}-${field.id}-required`,
        message: `${field.label} is required for this step.`,
        category: "draftStructure",
        severity: "fail",
        anchor: { section: "process" },
      } satisfies StudioDiagnostic];
    }
    if (field.kind === "equipment" && typeof value === "string" && ctx.equipmentIds && !ctx.equipmentIds.has(value)) {
      return [{
        id: `${blueprintId}-${field.id}-equipment`,
        message: `${field.label} must use equipment already required by this draft.`,
        category: "references",
        severity: "warning",
        anchor: { section: "setup" },
      } satisfies StudioDiagnostic];
    }
    return [];
  });

const blueprintFromTemplate = (template: StudioTemplate): StepBlueprint | undefined => {
  if (!template.nodeType || !template.verb) return undefined;
  const fields = fieldsForVerb(template.verb);
  return {
    id: template.id,
    label: template.title,
    nodeType: template.nodeType,
    verb: template.verb,
    fields,
    template,
    build: (input, ctx) => ({
      baseRevision: ctx.revision,
      idempotencyKey: blueprintIdempotencyKey(template, input),
      label: `Add ${template.title}`,
      operations: [
        {
          type: "appendTemplateStep",
          templateId: template.id,
          options: input.options,
        },
      ],
    }),
    validate: (input, ctx) => validateBlueprintInput(template.id, fields, input, ctx),
  };
};

export const stepBlueprints: StepBlueprint[] = studioTemplates
  .map(blueprintFromTemplate)
  .filter((blueprint): blueprint is StepBlueprint => Boolean(blueprint));

export const stepBlueprintByTemplateId = new Map(
  stepBlueprints.map((blueprint) => [blueprint.id, blueprint]),
);
