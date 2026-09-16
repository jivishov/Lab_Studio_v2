import type { LabDefinition } from "../domain/types";
import { validateLabDefinition } from "../domain/validation";
import { collectStudioInteractionIssues } from "./studioValidation";

export type StudioReadinessLevel =
  | "incomplete"
  | "structurallyValid"
  | "runnable"
  | "exportReady";

export type StudioReadinessCategoryId =
  | "draftStructure"
  | "references"
  | "studentPreview"
  | "exportReadiness";

export type StudioReadinessStatus = "pass" | "warning" | "fail";

export interface StudioDiagnostic {
  id: string;
  message: string;
  category: StudioReadinessCategoryId;
  severity: StudioReadinessStatus;
  anchor?: {
    section: "setup" | "process" | "details" | "preview" | "export";
    nodeId?: string;
    actionId?: string;
  };
}

export interface StudioReadinessCategory {
  id: StudioReadinessCategoryId;
  label: string;
  status: StudioReadinessStatus;
  diagnostics: StudioDiagnostic[];
}

export interface StudioReadiness {
  level: StudioReadinessLevel;
  label: string;
  categories: StudioReadinessCategory[];
  diagnostics: StudioDiagnostic[];
}

export const studioReadinessLabels: Record<StudioReadinessLevel, string> = {
  incomplete: "Incomplete",
  structurallyValid: "Structurally valid",
  runnable: "Runnable",
  exportReady: "Export ready",
};

const categoryLabels: Record<StudioReadinessCategoryId, string> = {
  draftStructure: "Draft structure",
  references: "References",
  studentPreview: "Student preview",
  exportReadiness: "Export readiness",
};

const referencePattern = /reference|unknown|not included|snap zone|compatible/i;

const issue = (
  id: string,
  message: string,
  category: StudioReadinessCategoryId,
  severity: StudioReadinessStatus,
  anchor?: StudioDiagnostic["anchor"],
): StudioDiagnostic => ({ id, message, category, severity, anchor });

const category = (
  id: StudioReadinessCategoryId,
  diagnostics: StudioDiagnostic[],
): StudioReadinessCategory => {
  const status: StudioReadinessStatus = diagnostics.some((diagnostic) => diagnostic.severity === "fail")
    ? "fail"
    : diagnostics.some((diagnostic) => diagnostic.severity === "warning")
      ? "warning"
      : "pass";

  return {
    id,
    label: categoryLabels[id],
    status,
    diagnostics,
  };
};

const hasSetupContent = (draft: LabDefinition): boolean =>
  draft.title.trim().length > 0 &&
  draft.description.trim().length > 0 &&
  draft.audience.trim().length > 0 &&
  draft.learningGoals.some((goal) => goal.trim().length > 0) &&
  draft.equipment.length > 0;

export const assessStudioReadiness = (draft: LabDefinition): StudioReadiness => {
  const validation = validateLabDefinition(draft);
  const interactionIssues = collectStudioInteractionIssues(draft);

  const draftDiagnostics: StudioDiagnostic[] = [];
  if (!draft.title.trim()) {
    draftDiagnostics.push(issue(
      "setup-title-missing",
      "Add a lab or technique title.",
      "draftStructure",
      "fail",
      { section: "setup" },
    ));
  }
  if (!draft.description.trim()) {
    draftDiagnostics.push(issue(
      "setup-description-missing",
      "Add a short description or goal.",
      "draftStructure",
      "fail",
      { section: "setup" },
    ));
  }
  if (!draft.process.nodes.length) {
    draftDiagnostics.push(issue(
      "process-empty",
      "Add at least one process step.",
      "draftStructure",
      "fail",
      { section: "process" },
    ));
  }
  if (!draft.actions.length) {
    draftDiagnostics.push(issue(
      "actions-empty",
      "Add at least one runnable action.",
      "draftStructure",
      "fail",
      { section: "details" },
    ));
  }
  validation.errors
    .filter((message) => !referencePattern.test(message))
    .forEach((message, index) => {
      draftDiagnostics.push(issue(
        `schema-${index}`,
        message,
        "draftStructure",
        "fail",
        { section: "details" },
      ));
    });

  const referenceDiagnostics: StudioDiagnostic[] = [
    ...validation.errors
      .filter((message) => referencePattern.test(message))
      .map((message, index) =>
        issue(`reference-${index}`, message, "references", "fail", { section: "details" }),
      ),
    ...interactionIssues.map((interactionIssue, index) =>
      issue(
        `interaction-${index}`,
        interactionIssue.message,
        "references",
        "warning",
        { section: "details", actionId: interactionIssue.actionId },
      ),
    ),
  ];

  const previewDiagnostics: StudioDiagnostic[] = validation.ok
    ? []
    : [
        issue(
          "preview-not-runnable",
          "Live preview needs a structurally valid draft.",
          "studentPreview",
          "fail",
          { section: "preview" },
        ),
      ];

  const exportDiagnostics: StudioDiagnostic[] = [];
  if (!validation.ok) {
    exportDiagnostics.push(issue(
      "export-invalid-schema",
      "Resolve schema errors before export.",
      "exportReadiness",
      "fail",
      { section: "export" },
    ));
  }
  if (interactionIssues.length) {
    exportDiagnostics.push(issue(
      "export-interaction-warnings",
      "Resolve interaction warnings before export.",
      "exportReadiness",
      "fail",
      { section: "details" },
    ));
  }
  if (!hasSetupContent(draft)) {
    exportDiagnostics.push(issue(
      "export-setup-incomplete",
      "Complete title, description, audience, goals, and required equipment before export.",
      "exportReadiness",
      "fail",
      { section: "setup" },
    ));
  }

  const categories = [
    category("draftStructure", draftDiagnostics),
    category("references", referenceDiagnostics),
    category("studentPreview", previewDiagnostics),
    category("exportReadiness", exportDiagnostics),
  ];
  const diagnostics = categories.flatMap((entry) => entry.diagnostics);

  const level: StudioReadinessLevel =
    validation.ok && !interactionIssues.length && hasSetupContent(draft)
      ? "exportReady"
      : validation.ok
        ? "runnable"
        : draft.title.trim() && draft.process.nodes.length
          ? "structurallyValid"
          : "incomplete";

  return {
    level,
    label: studioReadinessLabels[level],
    categories,
    diagnostics,
  };
};

export const isRunnableReadiness = (readiness: StudioReadiness): boolean =>
  readiness.level === "runnable" || readiness.level === "exportReady";

export const isExportReadyReadiness = (readiness: StudioReadiness): boolean =>
  readiness.level === "exportReady";
