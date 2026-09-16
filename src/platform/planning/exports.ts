import type { ResourceRunPlan } from "./types";

const csvCell = (value: string): string => /[",\r\n]/.test(value)
  ? `"${value.replace(/"/g, '""')}"`
  : value;

export const exportRequirementsCsv = (plan: ResourceRunPlan): string => {
  const rows = [
    ["resource_id", "label", "resource_class", "required_value", "required_unit", "normalized_value", "normalized_unit", "status"],
    ...plan.requirements.map((line) => [
      line.resourceId,
      line.label,
      line.resourceClass,
      line.required.value,
      line.required.unit,
      line.normalizedTotal.value,
      line.normalizedTotal.unit,
      plan.shortages.some(({ resourceId }) => resourceId === line.resourceId) ? "shortage" : "available-or-unchecked",
    ]),
  ];
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
};

export const exportPreparationChecklist = (plan: ResourceRunPlan): string => {
  const lines = [
    `# Run checklist: ${plan.requestId}`,
    "",
    `Status: ${plan.status}`,
    "",
    "## Requirements",
    "",
    ...plan.requirements.map((line) => `- [ ] ${line.label}: ${line.required.value} ${line.required.unit}`),
    "",
    "## Preparation",
    "",
    ...(plan.preparationBatches.length
      ? plan.preparationBatches.map((batch) => `- [ ] ${batch.task} (batch ${batch.batchNumber}, ${batch.resourceId})`)
      : ["- No preparation tasks declared."]),
    "",
    "## Station waves",
    "",
    ...(plan.stationWaves.length
      ? plan.stationWaves.map((wave) => `- [ ] ${wave.stationId}, wave ${wave.wave}: ${wave.groupIds.join(", ")}`)
      : ["- No constrained station waves declared."]),
    "",
    "## Cleanup and reset",
    "",
    ...(plan.cleanupTasks.length
      ? plan.cleanupTasks.map((task) => `- [ ] ${task.task}${task.resetRequired ? " (reset required)" : ""}`)
      : ["- No cleanup tasks declared."]),
    "",
    "## Diagnostics requiring review",
    "",
    ...(plan.diagnostics.length
      ? plan.diagnostics.map((diagnostic) => `- [ ] ${diagnostic.code}: ${diagnostic.message}`)
      : ["- No planning diagnostics."]),
    "",
    "No purchases, reservations, or inventory changes were performed.",
    "",
  ];
  return lines.join("\n");
};
