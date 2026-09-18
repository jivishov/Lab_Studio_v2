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
    techniqueId?: string;
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
const configurationTemplatePattern = /\{\{config\.([A-Za-z0-9_-]+)\}\}/g;

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

interface UnresolvedStudioConfiguration {
  slot: string;
  actionId?: string;
}

const configurationTemplatesIn = (value: unknown): string[] => {
  const found = new Set<string>();
  const visit = (current: unknown): void => {
    if (typeof current === "string") {
      for (const match of current.matchAll(configurationTemplatePattern)) found.add(match[1]);
      return;
    }
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    if (current && typeof current === "object") {
      Object.values(current as Record<string, unknown>).forEach(visit);
    }
  };
  visit(value);
  return [...found].sort();
};

/**
 * Studio intentionally allows an incomplete draft to be saved. Preview/export are different: a
 * template such as {{config.stockConcentrationMeasurementId}} is not a value and must not escape as
 * runnable content. Track action ownership where possible so diagnostics can take the teacher back
 * to the affected process step instead of merely showing a global warning.
 */
const unresolvedStudioConfiguration = (draft: LabDefinition): UnresolvedStudioConfiguration[] => {
  const unresolved: UnresolvedStudioConfiguration[] = [];
  const seen = new Set<string>();
  for (const action of draft.actions) {
    for (const slot of configurationTemplatesIn(action)) {
      const key = `${action.id}\u0000${slot}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unresolved.push({ slot, actionId: action.id });
    }
  }
  for (const slot of configurationTemplatesIn({
    assessments: draft.assessments,
    process: draft.process,
  })) {
    const key = `\u0000${slot}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unresolved.push({ slot });
  }
  return unresolved.sort((left, right) =>
    left.slot === right.slot
      ? (left.actionId ?? "").localeCompare(right.actionId ?? "")
      : left.slot.localeCompare(right.slot));
};

const actionAnchor = (
  draft: LabDefinition,
  actionId: string,
  section: NonNullable<StudioDiagnostic["anchor"]>["section"] = "process",
): NonNullable<StudioDiagnostic["anchor"]> => ({
  section,
  actionId,
  nodeId: draft.process.nodes.find((node) => node.actionId === actionId)?.id,
});

export const assessStudioReadiness = (draft: LabDefinition): StudioReadiness => {
  const validation = validateLabDefinition(draft);
  const interactionIssues = collectStudioInteractionIssues(draft);
  const unresolvedConfiguration = unresolvedStudioConfiguration(draft);

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
    ...unresolvedConfiguration.map((entry, index) =>
      issue(
        `unresolved-configuration-${index}`,
        `Bind teacher configuration "${entry.slot}" before preview or export. Saving this incomplete draft is still allowed.`,
        "references",
        "fail",
        entry.actionId
          ? { ...actionAnchor(draft, entry.actionId), techniqueId: draft.techniques.find((technique) =>
            technique.actions.some((action) => action.id === entry.actionId))?.id }
          : { section: "details" },
      ),
    ),
    ...interactionIssues.map((interactionIssue, index) =>
      issue(
        `interaction-${index}`,
        interactionIssue.message,
        "references",
        "warning",
        actionAnchor(draft, interactionIssue.actionId, "details"),
      ),
    ),
  ];

  const previewDiagnostics: StudioDiagnostic[] = [];
  if (!validation.ok) {
    previewDiagnostics.push(issue(
      "preview-not-runnable",
      "Live preview needs a structurally valid draft.",
      "studentPreview",
      "fail",
      { section: "preview" },
    ));
  }
  if (unresolvedConfiguration.length) {
    previewDiagnostics.push(issue(
      "preview-unresolved-configuration",
      "Live preview is blocked until every teacher configuration binding has a concrete approved value or evidence identifier.",
      "studentPreview",
      "fail",
      { section: "details" },
    ));
  }

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
  if (unresolvedConfiguration.length) {
    exportDiagnostics.push(issue(
      "export-unresolved-configuration",
      "Resolve teacher configuration before export; identifier names do not supply the scientific values they reference.",
      "exportReadiness",
      "fail",
      { section: "details" },
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
  const configurationResolved = unresolvedConfiguration.length === 0;

  const level: StudioReadinessLevel =
    validation.ok && configurationResolved && !interactionIssues.length && hasSetupContent(draft)
      ? "exportReady"
      : validation.ok && configurationResolved
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
