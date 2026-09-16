import type {
  AssayControlDefinition,
  AssayDefinition,
  ReplicateGroupDefinition,
} from "../types";
import { validateAssayDefinition } from "../types";
import type { AssayAssignmentChangeEvidencePayload } from "../evidence/types";

export class AssayAssignmentError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AssayAssignmentError";
  }
}

const unique = (values: readonly string[]): string[] => [...new Set(values)].sort();

const resolveCoordinates = (
  assay: AssayDefinition,
  coordinates: readonly string[],
): Set<string> => {
  const selected = new Set(unique(coordinates));
  if (selected.size === 0) throw new AssayAssignmentError(
    "assay.assignment.wells-required",
    "Select at least one well.",
  );
  const known = new Set(assay.plate.wells.map(({ coordinate }) => coordinate));
  selected.forEach((coordinate) => {
    if (!known.has(coordinate)) throw new AssayAssignmentError(
      "assay.assignment.well-unknown",
      `Unknown plate coordinate ${coordinate}.`,
    );
  });
  return selected;
};

const validateOrThrow = (assay: AssayDefinition): AssayDefinition => {
  const result = validateAssayDefinition(assay);
  if (!result.ok) throw new AssayAssignmentError(
    "assay.assignment.invalid",
    result.diagnostics.map(({ code, path }) => `${code} at ${path}`).join("; "),
  );
  return result.value;
};

export const upsertAssayControl = (
  assay: AssayDefinition,
  control: AssayControlDefinition,
): AssayDefinition => {
  const next = structuredClone(assay);
  const index = next.controls.findIndex(({ id }) => id === control.id);
  if (index >= 0) next.controls[index] = structuredClone(control);
  else next.controls.push(structuredClone(control));
  next.controls.sort((left, right) => left.id.localeCompare(right.id));
  next.plate.wells = next.plate.wells.map((well) => well.controlRef === control.id
    ? { ...well, role: control.role }
    : well);
  return validateOrThrow(next);
};

export const assignControlToWells = (
  assay: AssayDefinition,
  controlRef: string,
  coordinates: readonly string[],
): AssayDefinition => {
  const selected = resolveCoordinates(assay, coordinates);
  const control = assay.controls.find(({ id }) => id === controlRef);
  if (!control) throw new AssayAssignmentError(
    "assay.assignment.control-unknown",
    `Unknown control ${controlRef}.`,
  );
  const next = structuredClone(assay);
  next.plate.wells = next.plate.wells.map((well) => selected.has(well.coordinate)
    ? { ...well, role: control.role, controlRef: control.id }
    : well);
  return validateOrThrow(next);
};

export const clearControlFromWells = (
  assay: AssayDefinition,
  coordinates: readonly string[],
): AssayDefinition => {
  const selected = resolveCoordinates(assay, coordinates);
  const next = structuredClone(assay);
  next.plate.wells = next.plate.wells.map((well) => {
    if (!selected.has(well.coordinate)) return well;
    const { controlRef: _controlRef, ...withoutControl } = well;
    return { ...withoutControl, role: "sample" };
  });
  return validateOrThrow(next);
};

export const upsertReplicateGroupAssignment = (
  assay: AssayDefinition,
  group: Omit<ReplicateGroupDefinition, "memberWellIds">,
  coordinates: readonly string[],
): AssayDefinition => {
  const selected = resolveCoordinates(assay, coordinates);
  if (selected.size < group.minimumCount) throw new AssayAssignmentError(
    "assay.assignment.replicate-count",
    `Replicate group ${group.id} requires at least ${group.minimumCount} wells.`,
  );
  const next = structuredClone(assay);
  const memberWellIds = next.plate.wells
    .filter(({ coordinate }) => selected.has(coordinate))
    .map(({ id }) => id);
  const nextGroup: ReplicateGroupDefinition = { ...structuredClone(group), memberWellIds };
  const groupIndex = next.replicateGroups.findIndex(({ id }) => id === group.id);
  if (groupIndex >= 0) next.replicateGroups[groupIndex] = nextGroup;
  else next.replicateGroups.push(nextGroup);
  next.replicateGroups.sort((left, right) => left.id.localeCompare(right.id));
  next.plate.wells = next.plate.wells.map((well) => {
    const refs = well.replicateGroupRefs.filter((ref) => ref !== group.id);
    if (selected.has(well.coordinate)) refs.push(group.id);
    return { ...well, replicateGroupRefs: unique(refs) };
  });
  return validateOrThrow(next);
};

export const validateControlReplicateAssignments = (assay: unknown) =>
  validateAssayDefinition(assay);

export const projectAssayAssignmentChange = (input: {
  assignmentId: string;
  assignmentType: AssayAssignmentChangeEvidencePayload["assignmentType"];
  targetRef: string;
  wellIds: readonly string[];
  accepted: boolean;
  summary: string;
}): AssayAssignmentChangeEvidencePayload => ({
  assignmentId: input.assignmentId,
  assignmentType: input.assignmentType,
  targetRef: input.targetRef,
  wellIds: unique(input.wellIds),
  outcome: input.accepted ? "accepted" : "rejected",
  summary: input.summary,
});
