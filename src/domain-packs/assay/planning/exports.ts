import type { ResourceRunPlan } from "../../../platform/planning/types";
import type {
  AssayInventoryComparison,
  AssayOperationalPhaseScheduleItem,
  AssayPlanningExports,
} from "./types";
import { exportPreparationChecklist } from "../../../platform/planning/exports";

const csvCell = (value: string): string => /[",\r\n]/.test(value)
  ? `"${value.replace(/"/g, '""')}"`
  : value;

const csv = (rows: readonly (readonly string[])[]): string =>
  `${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;

export const exportAssayFormulaTraceCsv = (
  plan: ResourceRunPlan,
): string => csv([
  ["resource_id", "label", "step", "expression", "result_value", "result_unit"],
  ...plan.requirements.flatMap((line) =>
    line.formulaTrace.map((step) => [
      line.resourceId,
      line.label,
      step.label,
      step.expression,
      step.result.value,
      step.result.unit,
    ])),
]);

export const exportAssayRequirementsCsv = (
  plan: ResourceRunPlan,
  inventory: readonly AssayInventoryComparison[],
): string => csv([
  [
    "resource_id",
    "label",
    "resource_class",
    "required_value",
    "required_unit",
    "available_value",
    "available_unit",
    "shortage_value",
    "shortage_unit",
    "inventory_status",
  ],
  ...plan.requirements.map((line) => {
    const comparison = inventory.find(
      ({ resourceId }) => resourceId === line.resourceId,
    );
    return [
      line.resourceId,
      line.label,
      line.resourceClass,
      line.required.value,
      line.required.unit,
      comparison?.available?.value ?? "",
      comparison?.available?.unit ?? "",
      comparison?.shortage?.value ?? "",
      comparison?.shortage?.unit ?? "",
      comparison?.status ?? "not-declared",
    ];
  }),
]);

export const exportAssayScheduleCsv = (
  schedule: readonly AssayOperationalPhaseScheduleItem[],
): string => csv([
  [
    "phase_id",
    "label",
    "kind",
    "starts_after_value",
    "starts_after_unit",
    "duration_value",
    "duration_unit",
    "capacity_resource_id",
    "waves",
  ],
  ...schedule.map((phase) => [
    phase.phaseId,
    phase.label,
    phase.kind,
    phase.startsAfter.value,
    phase.startsAfter.unit,
    phase.duration.value,
    phase.duration.unit,
    phase.capacityResourceId ?? "",
    phase.waves === undefined ? "" : String(phase.waves),
  ]),
]);

export const createAssayPlanningExports = (
  plan: ResourceRunPlan,
  schedule: readonly AssayOperationalPhaseScheduleItem[],
  inventory: readonly AssayInventoryComparison[],
): AssayPlanningExports => ({
  requirementsCsv: exportAssayRequirementsCsv(plan, inventory),
  formulaTraceCsv: exportAssayFormulaTraceCsv(plan),
  scheduleCsv: exportAssayScheduleCsv(schedule),
  checklistMarkdown: exportPreparationChecklist(plan),
});
