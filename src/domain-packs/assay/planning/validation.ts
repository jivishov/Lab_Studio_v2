import { findForbiddenArtifactData } from "../../../platform/artifacts/security";
import {
  compileJsonSchemaValidator,
  validateWithJsonSchema,
  type ContractDiagnostic,
  type ContractValidationResult,
} from "../../../platform/validation/jsonSchema";
import assayPlanningProfileSchemaDocument from "./assay-planning-profile.schema.json";
import type { AssayPlanningProfile } from "./types";

export const assayPlanningProfileSchema =
  assayPlanningProfileSchemaDocument as Record<string, unknown>;

const validateSchema =
  compileJsonSchemaValidator<AssayPlanningProfile>(assayPlanningProfileSchema);

const duplicateDiagnostics = (
  values: readonly string[],
  path: string,
  code: string,
): ContractDiagnostic[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  values.forEach((value) => {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  });
  return [...duplicates].sort().map((value) => ({
    code,
    path,
    message: `Duplicate identifier ${value}.`,
    severity: "error" as const,
  }));
};

const semanticDiagnostics = (
  profile: AssayPlanningProfile,
): ContractDiagnostic[] => {
  const diagnostics: ContractDiagnostic[] = [
    ...duplicateDiagnostics(
      profile.operationLiquids.map(({ sourceRef }) => sourceRef),
      "/operationLiquids",
      "assay.planning-profile.operation-source.duplicate",
    ),
    ...duplicateDiagnostics(
      profile.tipPackages.map(({ tipTypeId }) => tipTypeId),
      "/tipPackages",
      "assay.planning-profile.tip-package.duplicate",
    ),
    ...duplicateDiagnostics(
      profile.masterMixes.map(({ id }) => id),
      "/masterMixes",
      "assay.planning-profile.master-mix.duplicate",
    ),
    ...duplicateDiagnostics(
      profile.instruments.map(({ resourceId }) => resourceId),
      "/instruments",
      "assay.planning-profile.instrument.duplicate",
    ),
    ...duplicateDiagnostics(
      profile.phases.map(({ id }) => id),
      "/phases",
      "assay.planning-profile.phase.duplicate",
    ),
    ...findForbiddenArtifactData(profile),
  ];

  const instrumentIds = new Set(
    profile.instruments.map(({ resourceId }) => resourceId),
  );
  profile.phases.forEach((phase, index) => {
    if (
      phase.capacityResourceId
      && !instrumentIds.has(phase.capacityResourceId)
    ) {
      diagnostics.push({
        code: "assay.planning-profile.phase.capacity-reference",
        path: `/phases/${index}/capacityResourceId`,
        message: `Unknown capacity resource ${phase.capacityResourceId}.`,
        severity: "error",
      });
    }
  });

  const operationResourceIds = new Set(
    profile.operationLiquids.map(({ resourceId }) => resourceId),
  );
  profile.masterMixes.forEach((masterMix, mixIndex) => {
    duplicateDiagnostics(
      masterMix.components.map(({ resourceId }) => resourceId),
      `/masterMixes/${mixIndex}/components`,
      "assay.planning-profile.master-mix.component.duplicate",
    ).forEach((diagnostic) => diagnostics.push(diagnostic));
    masterMix.components.forEach((component, componentIndex) => {
      if (operationResourceIds.has(component.resourceId)) {
        diagnostics.push({
          code: "assay.planning-profile.resource.double-count",
          path: `/masterMixes/${mixIndex}/components/${componentIndex}/resourceId`,
          message: `Resource ${component.resourceId} is already projected from the operation graph; declare it in exactly one consumption path.`,
          severity: "error",
        });
      }
    });
  });

  const projectedResourceIds = [
    ...profile.operationLiquids.map(({ resourceId }) => resourceId),
    ...profile.tipPackages.flatMap(
      ({ tipResourceId, boxResourceId }) => [tipResourceId, boxResourceId],
    ),
    ...profile.countResources.map(({ resourceId }) => resourceId),
    ...profile.masterMixes.flatMap(({ components }) =>
      components.map(({ resourceId }) => resourceId)),
    ...profile.instruments.map(({ resourceId }) => resourceId),
  ];
  diagnostics.push(...duplicateDiagnostics(
    projectedResourceIds,
    "/",
    "assay.planning-profile.resource-id.duplicate",
  ));

  return diagnostics.sort(
    (left, right) =>
      left.path.localeCompare(right.path) || left.code.localeCompare(right.code),
  );
};

export const validateAssayPlanningProfile = (
  input: unknown,
): ContractValidationResult<AssayPlanningProfile> => {
  const schemaResult = validateWithJsonSchema(validateSchema, input);
  if (!schemaResult.ok) return schemaResult;
  const diagnostics = semanticDiagnostics(schemaResult.value);
  return diagnostics.some(({ severity }) => severity === "error")
    ? { ok: false, diagnostics }
    : { ok: true, value: structuredClone(schemaResult.value), diagnostics };
};
