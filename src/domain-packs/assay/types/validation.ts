import { findForbiddenArtifactData } from "../../../platform/artifacts/security";
import { compareDecimal, parseDecimal } from "../../../platform/planning/decimal";
import { validateResourceSpec } from "../../../platform/planning/schema";
import { convertQuantity } from "../../../platform/planning/units";
import { canonicalSerializeJson } from "../../../platform/procedure-ir/canonical";
import { validatePlatformProcessGraph } from "../../../platform/process/validation";
import type { ContractDiagnostic, ContractValidationResult } from "../../../platform/validation/jsonSchema";
import {
  getCanonicalPlateCoordinates,
  getCanonicalPlateDimensions,
  WELL_COORDINATES_96,
} from "../plate/coordinates";
import { assertWellWithinCapacity, PlateInvariantError } from "../plate/state";
import {
  validateAssayDefinitionSchema,
  validatePlateDefinitionSchema,
  validatePlateRuntimeStateSchema,
} from "./schema";
import type {
  AssayDefinition,
  AssayQuantity,
  PlateDefinition,
  PlateRuntimeState,
  WellDefinition,
} from "./types";

const diagnostic = (
  code: string,
  path: string,
  message: string,
  severity: ContractDiagnostic["severity"] = "error",
): ContractDiagnostic => ({ code, path, message, severity });

const duplicateIdDiagnostics = (
  values: readonly { id: string }[],
  path: string,
  code: string,
): ContractDiagnostic[] => {
  const seen = new Set<string>();
  return values.flatMap(({ id }, index) => {
    if (seen.has(id)) return [diagnostic(code, `${path}/${index}/id`, `Duplicate id ${id}.`)];
    seen.add(id);
    return [];
  });
};

const exactArrayDiagnostics = (
  actual: readonly string[],
  expected: readonly string[],
  path: string,
  code: string,
): ContractDiagnostic[] => actual.length === expected.length
  && actual.every((value, index) => value === expected[index])
  ? []
  : [diagnostic(code, path, `Expected canonical order ${expected.join(", ")}.`)];

const toMicroliters = (quantity: AssayQuantity): ReturnType<typeof parseDecimal> => {
  if (!["uL", "mL", "L"].includes(quantity.unit)) throw new Error("Volume quantities must use uL, mL, or L.");
  return parseDecimal(convertQuantity(quantity, "uL").value);
};

const volumeComparisonDiagnostic = (
  left: AssayQuantity,
  right: AssayQuantity,
  path: string,
  code: string,
  message: string,
): ContractDiagnostic[] => {
  try {
    return compareDecimal(toMicroliters(left), toMicroliters(right)) <= 0
      ? []
      : [diagnostic(code, path, message)];
  } catch (error) {
    return [diagnostic(
      "assay.plate.volume.invalid",
      path,
      error instanceof Error ? error.message : "Volume is invalid.",
    )];
  }
};

const plateSemanticDiagnostics = (plate: PlateDefinition, basePath = ""): ContractDiagnostic[] => {
  const path = (suffix: string) => `${basePath}${suffix}` || "/";
  const expectedDimensions = getCanonicalPlateDimensions(plate.format);
  const expectedCoordinates = getCanonicalPlateCoordinates(plate.format);
  const expectedCoordinateSet = new Set(expectedCoordinates);
  const diagnostics: ContractDiagnostic[] = [
    ...duplicateIdDiagnostics(plate.wells, path("/wells"), "assay.plate.well-id.duplicate"),
    ...duplicateIdDiagnostics(plate.regions, path("/regions"), "assay.plate.region-id.duplicate"),
    ...exactArrayDiagnostics(plate.rowLabels, expectedDimensions.rows, path("/rowLabels"), "assay.plate.row-labels.noncanonical"),
    ...exactArrayDiagnostics(
      plate.columnLabels,
      expectedDimensions.columns.map(String),
      path("/columnLabels"),
      "assay.plate.column-labels.noncanonical",
    ),
  ];

  if (plate.rowCount !== expectedDimensions.rows.length) diagnostics.push(diagnostic(
    "assay.plate.row-count.invalid",
    path("/rowCount"),
    `Plate format ${plate.format} requires ${expectedDimensions.rows.length} rows.`,
  ));
  if (plate.columnCount !== expectedDimensions.columns.length) diagnostics.push(diagnostic(
    "assay.plate.column-count.invalid",
    path("/columnCount"),
    `Plate format ${plate.format} requires ${expectedDimensions.columns.length} columns.`,
  ));

  const seenCoordinates = new Set<string>();
  plate.wells.forEach((well, index) => {
    const wellPath = path(`/wells/${index}`);
    if (seenCoordinates.has(well.coordinate)) diagnostics.push(diagnostic(
      "assay.plate.coordinate.duplicate",
      `${wellPath}/coordinate`,
      `Duplicate well coordinate ${well.coordinate}.`,
    ));
    seenCoordinates.add(well.coordinate);
    if (!expectedCoordinateSet.has(well.coordinate)) diagnostics.push(diagnostic(
      "assay.plate.coordinate.invalid",
      `${wellPath}/coordinate`,
      `${well.coordinate} is not canonical for a ${plate.format}-well plate.`,
    ));
    diagnostics.push(...volumeComparisonDiagnostic(
      well.expectedFinalVolume,
      plate.maxWellVolume,
      `${wellPath}/expectedFinalVolume`,
      "assay.plate.volume.capacity-exceeded",
      `Expected final volume for ${well.coordinate} exceeds plate capacity.`,
    ));
    well.plannedComponents.forEach((component, componentIndex) => diagnostics.push(
      ...volumeComparisonDiagnostic(
        component.volume,
        plate.maxWellVolume,
        `${wellPath}/plannedComponents/${componentIndex}/volume`,
        "assay.plate.component.capacity-exceeded",
        `Planned component volume for ${well.coordinate} exceeds plate capacity.`,
      ),
    ));
  });
  expectedCoordinates.forEach((coordinate) => {
    if (!seenCoordinates.has(coordinate)) diagnostics.push(diagnostic(
      "assay.plate.coordinate.missing",
      path("/wells"),
      `Plate is missing canonical well ${coordinate}.`,
    ));
  });
  if (plate.wells.length !== plate.format) diagnostics.push(diagnostic(
    "assay.plate.well-count.invalid",
    path("/wells"),
    `Plate format ${plate.format} requires exactly ${plate.format} wells.`,
  ));

  try {
    if (compareDecimal(toMicroliters(plate.maxWellVolume), parseDecimal("0")) <= 0) diagnostics.push(diagnostic(
      "assay.plate.capacity.nonpositive",
      path("/maxWellVolume/value"),
      "Plate capacity must be greater than zero.",
    ));
  } catch (error) {
    diagnostics.push(diagnostic(
      "assay.plate.volume.invalid",
      path("/maxWellVolume"),
      error instanceof Error ? error.message : "Plate capacity is invalid.",
    ));
  }
  if (plate.recommendedWorkingVolume) {
    diagnostics.push(
      ...volumeComparisonDiagnostic(
        plate.recommendedWorkingVolume.minimum,
        plate.recommendedWorkingVolume.maximum,
        path("/recommendedWorkingVolume/minimum"),
        "assay.plate.working-volume.range-invalid",
        "Recommended working-volume minimum exceeds its maximum.",
      ),
      ...volumeComparisonDiagnostic(
        plate.recommendedWorkingVolume.maximum,
        plate.maxWellVolume,
        path("/recommendedWorkingVolume/maximum"),
        "assay.plate.working-volume.capacity-exceeded",
        "Recommended working-volume maximum exceeds plate capacity.",
      ),
    );
  }

  const wellIds = new Set(plate.wells.map(({ id }) => id));
  plate.regions.forEach((region, regionIndex) => region.wellIds.forEach((wellId, wellIndex) => {
    if (!wellIds.has(wellId)) diagnostics.push(diagnostic(
      "assay.plate.region.well-ref-missing",
      path(`/regions/${regionIndex}/wellIds/${wellIndex}`),
      `Region ${region.id} references missing well ${wellId}.`,
    ));
  }));
  if (plate.format !== 96) diagnostics.push(diagnostic(
    "assay.plate.format.representational-only",
    path("/format"),
    `Plate format ${plate.format} is schema-describable but has no Cycle 06 renderer/runtime conformance fixture.`,
    "warning",
  ));
  return diagnostics;
};

export const validatePlateDefinition = (
  input: unknown,
): ContractValidationResult<PlateDefinition> => {
  const schemaResult = validatePlateDefinitionSchema(input);
  if (!schemaResult.ok) return schemaResult;
  const diagnostics = plateSemanticDiagnostics(schemaResult.value);
  return diagnostics.some(({ severity }) => severity === "error")
    ? { ok: false, diagnostics }
    : { ok: true, value: schemaResult.value, diagnostics };
};

const referencedWellDiagnostics = (
  well: WellDefinition,
  index: number,
  context: {
    samples: ReadonlySet<string>;
    conditions: ReadonlySet<string>;
    controls: ReadonlyMap<string, AssayDefinition["controls"][number]>;
    replicateGroups: ReadonlyMap<string, AssayDefinition["replicateGroups"][number]>;
    resources: ReadonlySet<string>;
  },
): ContractDiagnostic[] => {
  const path = `/plate/wells/${index}`;
  const diagnostics: ContractDiagnostic[] = [];
  if (well.sampleRef && !context.samples.has(well.sampleRef)) diagnostics.push(diagnostic(
    "assay.well.sample-ref.missing", `${path}/sampleRef`, `Missing sample ${well.sampleRef}.`,
  ));
  well.conditionRefs.forEach((ref, refIndex) => {
    if (!context.conditions.has(ref)) diagnostics.push(diagnostic(
      "assay.well.condition-ref.missing", `${path}/conditionRefs/${refIndex}`, `Missing condition ${ref}.`,
    ));
  });
  if (well.controlRef) {
    const control = context.controls.get(well.controlRef);
    if (!control) diagnostics.push(diagnostic(
      "assay.well.control-ref.missing", `${path}/controlRef`, `Missing control ${well.controlRef}.`,
    ));
    else if (control.role !== well.role) diagnostics.push(diagnostic(
      "assay.well.control-role.mismatch",
      `${path}/role`,
      `Well role ${well.role} does not match control ${control.id} role ${control.role}.`,
    ));
  }
  well.replicateGroupRefs.forEach((ref, refIndex) => {
    const group = context.replicateGroups.get(ref);
    if (!group) diagnostics.push(diagnostic(
      "assay.well.replicate-ref.missing", `${path}/replicateGroupRefs/${refIndex}`, `Missing replicate group ${ref}.`,
    ));
    else if (!group.memberWellIds.includes(well.id)) diagnostics.push(diagnostic(
      "assay.well.replicate-membership.nonreciprocal",
      `${path}/replicateGroupRefs/${refIndex}`,
      `Replicate group ${ref} does not include well ${well.id}.`,
    ));
  });
  well.plannedComponents.forEach((component, componentIndex) => {
    if (!context.resources.has(component.resourceRef)) diagnostics.push(diagnostic(
      "assay.well.component.resource-ref.missing",
      `${path}/plannedComponents/${componentIndex}/resourceRef`,
      `Missing assay resource ${component.resourceRef}.`,
    ));
  });
  return diagnostics;
};

export const validateAssayDefinition = (
  input: unknown,
): ContractValidationResult<AssayDefinition> => {
  const schemaResult = validateAssayDefinitionSchema(input);
  if (!schemaResult.ok) return schemaResult;
  const assay = schemaResult.value;
  const diagnostics: ContractDiagnostic[] = [
    ...plateSemanticDiagnostics(assay.plate, "/plate"),
    ...duplicateIdDiagnostics(assay.resources, "/resources", "assay.resource.id.duplicate"),
    ...duplicateIdDiagnostics(assay.samples, "/samples", "assay.sample.id.duplicate"),
    ...duplicateIdDiagnostics(assay.conditions, "/conditions", "assay.condition.id.duplicate"),
    ...duplicateIdDiagnostics(assay.controls, "/controls", "assay.control.id.duplicate"),
    ...duplicateIdDiagnostics(assay.replicateGroups, "/replicateGroups", "assay.replicate-group.id.duplicate"),
    ...duplicateIdDiagnostics(assay.equipment, "/equipment", "assay.equipment.id.duplicate"),
    ...duplicateIdDiagnostics(assay.operations, "/operations", "assay.operation.id.duplicate"),
    ...duplicateIdDiagnostics(assay.evidenceRequirements, "/evidenceRequirements", "assay.evidence-requirement.id.duplicate"),
    ...findForbiddenArtifactData(assay),
  ];

  const processValidation = validatePlatformProcessGraph(assay.process);
  if (!processValidation.ok) diagnostics.push(...processValidation.diagnostics.map((entry) => ({
    ...entry,
    path: `/process${entry.path === "/" ? "" : entry.path}` || "/process",
  })));
  assay.materials.forEach((material, index) => {
    const materialResult = validateResourceSpec(material);
    if (!materialResult.ok) diagnostics.push(...materialResult.diagnostics.map((entry) => ({
      ...entry,
      path: `/materials/${index}${entry.path === "/" ? "" : entry.path}`,
    })));
    if (material.domainPackId !== "assay") diagnostics.push(diagnostic(
      "assay.material.domain-pack.invalid",
      `/materials/${index}/domainPackId`,
      "Assay materials must declare domainPackId assay.",
    ));
  });
  if (!Number.isFinite(Date.parse(assay.metadata.updatedAt))) diagnostics.push(diagnostic(
    "assay.metadata.updated-at.invalid", "/metadata/updatedAt", "updatedAt must be an ISO-8601 timestamp.",
  ));

  const samples = new Set(assay.samples.map(({ id }) => id));
  const conditions = new Set(assay.conditions.map(({ id }) => id));
  const controls = new Map(assay.controls.map((control) => [control.id, control]));
  const replicateGroups = new Map(assay.replicateGroups.map((group) => [group.id, group]));
  const resources = new Set(assay.resources.map(({ id }) => id));
  assay.plate.wells.forEach((well, index) => diagnostics.push(...referencedWellDiagnostics(
    well,
    index,
    { samples, conditions, controls, replicateGroups, resources },
  )));

  const wells = new Set(assay.plate.wells.map(({ id }) => id));
  assay.replicateGroups.forEach((group, groupIndex) => {
    if (group.memberWellIds.length < group.minimumCount) diagnostics.push(diagnostic(
      "assay.replicate-group.minimum-count.unmet",
      `/replicateGroups/${groupIndex}/memberWellIds`,
      `Replicate group ${group.id} requires at least ${group.minimumCount} members.`,
    ));
    group.memberWellIds.forEach((wellId, memberIndex) => {
      if (!wells.has(wellId)) diagnostics.push(diagnostic(
        "assay.replicate-group.well-ref.missing",
        `/replicateGroups/${groupIndex}/memberWellIds/${memberIndex}`,
        `Replicate group ${group.id} references missing well ${wellId}.`,
      ));
      const well = assay.plate.wells.find(({ id }) => id === wellId);
      if (well && !well.replicateGroupRefs.includes(group.id)) diagnostics.push(diagnostic(
        "assay.replicate-group.membership.nonreciprocal",
        `/replicateGroups/${groupIndex}/memberWellIds/${memberIndex}`,
        `Well ${wellId} does not reference replicate group ${group.id}.`,
      ));
    });
  });

  const evidenceIds = new Set(assay.evidenceRequirements.map(({ id }) => id));
  const operationIds = new Set(assay.operations.map(({ id }) => id));
  assay.process.nodes.forEach((node, nodeIndex) => {
    if (node.operationRef && !operationIds.has(node.operationRef)) diagnostics.push(diagnostic(
      "assay.process.operation-ref.missing",
      `/process/nodes/${nodeIndex}/operationRef`,
      `Process node references missing assay operation ${node.operationRef}.`,
    ));
    node.evidenceRequirementRefs.forEach((ref, refIndex) => {
      if (!evidenceIds.has(ref)) diagnostics.push(diagnostic(
        "assay.process.evidence-ref.missing",
        `/process/nodes/${nodeIndex}/evidenceRequirementRefs/${refIndex}`,
        `Process node references missing evidence requirement ${ref}.`,
      ));
    });
  });

  const operationObjectRefs = new Set([
    ...assay.plate.wells.map(({ id }) => id),
    ...assay.resources.map(({ id }) => id),
    ...assay.samples.map(({ id }) => id),
    ...assay.equipment.map(({ id }) => id),
  ]);
  assay.operations.forEach((operation, operationIndex) => {
    if (operation.sourceRef && !operationObjectRefs.has(operation.sourceRef)) diagnostics.push(diagnostic(
      "assay.operation.source-ref.missing",
      `/operations/${operationIndex}/sourceRef`,
      `Operation source ${operation.sourceRef} is not declared.`,
    ));
    operation.destinationRefs.forEach((ref, refIndex) => {
      if (!operationObjectRefs.has(ref)) diagnostics.push(diagnostic(
        "assay.operation.destination-ref.missing",
        `/operations/${operationIndex}/destinationRefs/${refIndex}`,
        `Operation destination ${ref} is not declared.`,
      ));
    });
  });
  if (assay.analysisPlan.analysisType !== "none" && !assay.analysisPlan.profileRef) diagnostics.push(diagnostic(
    "assay.analysis.profile-ref.required",
    "/analysisPlan/profileRef",
    "A non-empty analysis plan requires a versioned protocol profile.",
  ));
  if (assay.protocolProfileRef.id === "assay.protocol-profile.unassigned") diagnostics.push(diagnostic(
    "assay.protocol-profile.unassigned",
    "/protocolProfileRef",
    "This layout artifact has no protocol profile; protocol interpretation is unavailable until the user selects an explicit checked profile.",
    "warning",
  ));
  if (assay.operations.length > 0) diagnostics.push(diagnostic(
    "assay.operations.representational-only",
    "/operations",
    "AssayDefinition validates authored operation scaffolds but does not compile them; typed pipetting execution remains a separate Cycle 07 runtime service.",
    "warning",
  ));

  diagnostics.sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code));
  return diagnostics.some(({ severity }) => severity === "error")
    ? { ok: false, diagnostics }
    : { ok: true, value: assay, diagnostics };
};

export const validatePlateRuntimeState = (
  input: unknown,
): ContractValidationResult<PlateRuntimeState> => {
  const schemaResult = validatePlateRuntimeStateSchema(input);
  if (!schemaResult.ok) return schemaResult;
  const state = schemaResult.value;
  const diagnostics: ContractDiagnostic[] = [];
  const seen = new Set<string>();
  state.wells.forEach((well, index) => {
    if (seen.has(well.coordinate)) diagnostics.push(diagnostic(
      "assay.plate-state.coordinate.duplicate",
      `/wells/${index}/coordinate`,
      `Duplicate runtime well ${well.coordinate}.`,
    ));
    seen.add(well.coordinate);
    try {
      assertWellWithinCapacity(well, state.maxWellVolume);
    } catch (error) {
      diagnostics.push(diagnostic(
        error instanceof PlateInvariantError ? error.code : "assay.plate-state.volume.invalid",
        `/wells/${index}/volume`,
        error instanceof Error ? error.message : "Runtime well volume is invalid.",
      ));
    }
    let isZeroVolume = false;
    try {
      isZeroVolume = compareDecimal(toMicroliters(well.volume), parseDecimal("0")) === 0;
    } catch {
      // The capacity check above records the actionable unit/decimal diagnostic.
    }
    if (well.status === "empty" && (!isZeroVolume || well.components.length > 0)) diagnostics.push(diagnostic(
      "assay.plate-state.empty.nonzero",
      `/wells/${index}`,
      `Empty well ${well.coordinate} must have zero volume and no components.`,
    ));
    const observationIds = new Set<string>();
    well.observations.forEach((observation, observationIndex) => {
      if (observationIds.has(observation.id)) diagnostics.push(diagnostic(
        "assay.plate-state.observation.duplicate",
        `/wells/${index}/observations/${observationIndex}/id`,
        `Duplicate observation ${observation.id} in well ${well.coordinate}.`,
      ));
      observationIds.add(observation.id);
    });
  });
  WELL_COORDINATES_96.forEach((coordinate) => {
    if (!seen.has(coordinate)) diagnostics.push(diagnostic(
      "assay.plate-state.coordinate.missing",
      "/wells",
      `Runtime plate state is missing well ${coordinate}.`,
    ));
  });
  diagnostics.sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code));
  return diagnostics.length > 0
    ? { ok: false, diagnostics }
    : { ok: true, value: state, diagnostics: [] };
};

export const serializeAssayDefinition = (assay: AssayDefinition): string => {
  const validation = validateAssayDefinition(assay);
  if (!validation.ok) throw new Error(validation.diagnostics.map(({ code, path }) => `${code} at ${path}`).join("; "));
  return canonicalSerializeJson(validation.value);
};

export const parseAssayDefinition = (serialized: string): AssayDefinition => {
  const input: unknown = JSON.parse(serialized);
  const validation = validateAssayDefinition(input);
  if (!validation.ok) throw new Error(validation.diagnostics.map(({ code, path }) => `${code} at ${path}`).join("; "));
  return validation.value;
};
