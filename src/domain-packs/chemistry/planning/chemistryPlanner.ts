import type { LabDefinition, TechniqueDefinition } from "../../../domain/types";
import { equipmentById } from "../../../equipment/catalog";
import { exportPreparationChecklist, exportRequirementsCsv } from "../../../platform/planning/exports";
import { incompleteResourceRunPlan, planResourceRun } from "../../../platform/planning/planner";
import type {
  PlanningDiagnostic,
  ResourceRunContext,
  ResourceRunPlan,
  ResourceSpec,
} from "../../../platform/planning/types";
import type { ChemistryArtifact, ChemistryArtifactKind } from "../artifactKind";
import { detectChemistryArtifactKind } from "../artifactKind";
import { chemistryPlanningMetadataByArtifactId } from "./metadata";

export interface ChemistryResourceProjection {
  resources: ResourceSpec[];
  diagnostics: PlanningDiagnostic[];
  assumptions: string[];
  limitations: string[];
}

export interface ChemistryRunPlanResult {
  status: "complete" | "incomplete";
  artifactId: string;
  artifactKind: ChemistryArtifactKind;
  plan: ResourceRunPlan;
  requirementsCsv: string;
  preparationChecklist: string;
}

const requiredEquipmentIds = (artifact: ChemistryArtifact): string[] =>
  "equipment" in artifact
    ? [...(artifact as LabDefinition).equipment]
    : [...(artifact as TechniqueDefinition).requiredEquipment];

export const projectChemistryPlanningResources = (
  artifact: ChemistryArtifact,
): ChemistryResourceProjection => {
  const metadata = chemistryPlanningMetadataByArtifactId.get(artifact.id) ?? [];
  const metadataById = new Map(metadata.map((resource) => [resource.id, resource]));
  const diagnostics: PlanningDiagnostic[] = [];
  requiredEquipmentIds(artifact).forEach((equipmentId) => {
    if (metadataById.has(equipmentId)) return;
    diagnostics.push({
      code: "chemistry.planning.quantity-metadata-missing",
      path: `/resources/${equipmentId}`,
      message: `Required equipment ${equipmentById.get(equipmentId)?.label ?? equipmentId} has no reviewed class-scaling quantity metadata.`,
      severity: "error",
      resourceId: equipmentId,
    });
  });
  if (metadata.length === 0) diagnostics.push({
    code: "chemistry.planning.artifact-metadata-incomplete",
    path: "/resources",
    message: `Artifact ${artifact.id} has no reviewed resource-planning profile; quantities were not inferred from runtime state.`,
    severity: "error",
  });
  return {
    resources: metadata.map((resource) => structuredClone(resource)),
    diagnostics,
    assumptions: metadata.length > 0
      ? ["The source-controlled chemistry planning profile is authoritative for this representative artifact only."]
      : [],
    limitations: [
      "Runtime container contents and action parameters are not treated as class-scale purchasing quantities.",
      "Safety, waste, and substitutions require local human review.",
    ],
  };
};

const isResourceRunContext = (input: unknown): input is ResourceRunContext => {
  if (!input || typeof input !== "object") return false;
  const value = input as Partial<ResourceRunContext>;
  return typeof value.requestId === "string"
    && typeof value.participants === "number"
    && typeof value.grouping === "object"
    && Array.isArray(value.sections)
    && typeof value.repeats === "number"
    && typeof value.technicalReplicates === "number"
    && Array.isArray(value.stations)
    && Array.isArray(value.availableInventory)
    && Array.isArray(value.instrumentCapacities);
};

export const planChemistryClassRun = (
  artifact: ChemistryArtifact,
  context: unknown,
  requestId: string,
): ChemistryRunPlanResult => {
  const detected = detectChemistryArtifactKind(artifact);
  if (!detected.ok) throw new Error(detected.diagnostic.message);
  const projection = projectChemistryPlanningResources(artifact);
  const plan = isResourceRunContext(context)
    ? planResourceRun(projection.resources, { ...context, requestId }, {
        initialDiagnostics: projection.diagnostics,
        assumptions: projection.assumptions,
        limitations: projection.limitations,
      })
    : incompleteResourceRunPlan(requestId, [{
        code: "chemistry.planning.run-context-missing",
        path: "/context",
        message: "participants, grouping, sections, repeats, technicalReplicates, stations, inventory, and capacity metadata are required for class-run planning.",
        severity: "error",
      }, ...projection.diagnostics], projection.limitations);
  return {
    status: plan.status,
    artifactId: artifact.id,
    artifactKind: detected.kind,
    plan,
    requirementsCsv: exportRequirementsCsv(plan),
    preparationChecklist: exportPreparationChecklist(plan),
  };
};
