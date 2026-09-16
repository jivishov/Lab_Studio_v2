import type { ContractDiagnostic, ContractValidationResult } from "../validation/jsonSchema";
import { validateProcedureIRSchema } from "./schema";
import type { AmbiguityIR, ProcedureIR, ReviewFlag, SourceLocator } from "./types";

export interface ProcedureIRReviewSummary {
  ambiguity: AmbiguityIR[];
  missingData: AmbiguityIR[];
  unsupportedSemantics: AmbiguityIR[];
  reviewFlags: ReviewFlag[];
}

const error = (code: string, path: string, message: string): ContractDiagnostic => ({
  code,
  path,
  message,
  severity: "error",
});

const duplicateDiagnostics = (
  values: readonly { id: string }[],
  basePath: string,
  code: string,
): ContractDiagnostic[] => {
  const seen = new Set<string>();
  return values.flatMap((value, index) => {
    if (seen.has(value.id)) return [error(code, `${basePath}/${index}/id`, `Duplicate id ${value.id}.`)];
    seen.add(value.id);
    return [];
  });
};

const locatorDiagnostics = (
  locators: readonly SourceLocator[],
  path: string,
  sourceIds: ReadonlySet<string>,
): ContractDiagnostic[] => locators.flatMap((locator, index) => sourceIds.has(locator.sourceRef)
  ? []
  : [error(
      "procedure.source-reference.missing",
      `${path}/${index}/sourceRef`,
      `Source ${locator.sourceRef} is not declared.`,
    )]);

const allLocatorDiagnostics = (
  procedure: ProcedureIR,
  sourceIds: ReadonlySet<string>,
): ContractDiagnostic[] => [
  ...procedure.roles.flatMap((role, index) => locatorDiagnostics(
    role.sourceLocators,
    `/roles/${index}/sourceLocators`,
    sourceIds,
  )),
  ...procedure.resources.flatMap((resource, index) => locatorDiagnostics(
    resource.sourceLocators,
    `/resources/${index}/sourceLocators`,
    sourceIds,
  ).concat(resource.reviewFlags.flatMap((flag, flagIndex) => locatorDiagnostics(
    flag.sourceLocators,
    `/resources/${index}/reviewFlags/${flagIndex}/sourceLocators`,
    sourceIds,
  )))),
  ...procedure.variables.flatMap((variable, index) => locatorDiagnostics(
    variable.sourceLocators,
    `/variables/${index}/sourceLocators`,
    sourceIds,
  ).concat(variable.reviewFlags.flatMap((flag, flagIndex) => locatorDiagnostics(
    flag.sourceLocators,
    `/variables/${index}/reviewFlags/${flagIndex}/sourceLocators`,
    sourceIds,
  )))),
  ...procedure.steps.flatMap((step, index) => [
    ...locatorDiagnostics(step.sourceLocators, `/steps/${index}/sourceLocators`, sourceIds),
    ...step.ambiguity.flatMap((ambiguity, ambiguityIndex) => locatorDiagnostics(
      ambiguity.sourceLocators,
      `/steps/${index}/ambiguity/${ambiguityIndex}/sourceLocators`,
      sourceIds,
    )),
    ...step.evidenceRequirements.flatMap((requirement, requirementIndex) => locatorDiagnostics(
      requirement.sourceLocators,
      `/steps/${index}/evidenceRequirements/${requirementIndex}/sourceLocators`,
      sourceIds,
    )),
    ...step.reviewFlags.flatMap((flag, flagIndex) => locatorDiagnostics(
      flag.sourceLocators,
      `/steps/${index}/reviewFlags/${flagIndex}/sourceLocators`,
      sourceIds,
    )),
  ]),
  ...procedure.reviewFlags.flatMap((flag, flagIndex) => locatorDiagnostics(
    flag.sourceLocators,
    `/reviewFlags/${flagIndex}/sourceLocators`,
    sourceIds,
  )),
];

export type ProcedureIRValidationResult = ContractValidationResult<ProcedureIR> & {
  review?: ProcedureIRReviewSummary;
};

export const summarizeProcedureIRReview = (procedure: ProcedureIR): ProcedureIRReviewSummary => {
  const ambiguity = procedure.steps.flatMap((step) => step.ambiguity)
    .filter((item) => item.resolutionStatus !== "resolved");
  return {
    ambiguity,
    missingData: ambiguity.filter((item) =>
      item.category === "missing-data"
      || item.category === "unknown-resource"
      || item.category === "unknown-unit"),
    unsupportedSemantics: ambiguity.filter((item) => item.category === "unsupported-semantics"),
    reviewFlags: [...procedure.reviewFlags, ...procedure.steps.flatMap((step) => step.reviewFlags)],
  };
};

export const validateProcedureIR = (input: unknown): ProcedureIRValidationResult => {
  const schemaResult = validateProcedureIRSchema(input);
  if (!schemaResult.ok) return schemaResult;
  const procedure = schemaResult.value;
  const stepIds = new Set(procedure.steps.map(({ id }) => id));
  const sourceIds = new Set(procedure.sources.map(({ id }) => id));
  const roleIds = new Set(procedure.roles.map(({ id }) => id));
  const stateReferenceIds = new Set([
    ...procedure.resources.map(({ id }) => id),
    ...procedure.variables.map(({ id }) => id),
  ]);
  const diagnostics: ContractDiagnostic[] = [
    ...duplicateDiagnostics(procedure.sources, "/sources", "procedure.source.duplicate"),
    ...duplicateDiagnostics(procedure.roles, "/roles", "procedure.role.duplicate"),
    ...duplicateDiagnostics(procedure.resources, "/resources", "procedure.resource.duplicate"),
    ...duplicateDiagnostics(procedure.variables, "/variables", "procedure.variable.duplicate"),
    ...duplicateDiagnostics(procedure.steps, "/steps", "procedure.step.duplicate"),
    ...allLocatorDiagnostics(procedure, sourceIds),
  ];

  procedure.steps.forEach((step, stepIndex) => {
    if (stepIndex > 0 && step.ordinal <= procedure.steps[stepIndex - 1].ordinal) {
      diagnostics.push(error(
        "procedure.step.ordinal-order",
        `/steps/${stepIndex}/ordinal`,
        "Step ordinals must increase in structured source order.",
      ));
    }
    step.dependencies.forEach((dependency, dependencyIndex) => {
      const path = `/steps/${stepIndex}/dependencies/${dependencyIndex}`;
      if (dependency === step.id) {
        diagnostics.push(error("procedure.step.self-dependency", path, "A step cannot depend on itself."));
      } else if (!stepIds.has(dependency)) {
        diagnostics.push(error("procedure.step.dependency-missing", path, `Step ${dependency} is not declared.`));
      }
    });
    step.branch?.options.forEach((option, optionIndex) => option.nextStepIds.forEach((nextId, nextIndex) => {
      if (!stepIds.has(nextId)) diagnostics.push(error(
        "procedure.branch.step-missing",
        `/steps/${stepIndex}/branch/options/${optionIndex}/nextStepIds/${nextIndex}`,
        `Step ${nextId} is not declared.`,
      ));
    }));
    step.branch?.defaultNextStepIds.forEach((nextId, nextIndex) => {
      if (!stepIds.has(nextId)) diagnostics.push(error(
        "procedure.branch.step-missing",
        `/steps/${stepIndex}/branch/defaultNextStepIds/${nextIndex}`,
        `Step ${nextId} is not declared.`,
      ));
    });
    step.normalizedOperation?.actorRefs.forEach((actorRef, actorIndex) => {
      if (!roleIds.has(actorRef)) diagnostics.push(error(
        "procedure.operation.actor-missing",
        `/steps/${stepIndex}/normalizedOperation/actorRefs/${actorIndex}`,
        `Role ${actorRef} is not declared.`,
      ));
    });
    [
      ["inputRefs", step.normalizedOperation?.inputRefs ?? []],
      ["outputRefs", step.normalizedOperation?.outputRefs ?? []],
    ].forEach(([field, refs]) => (refs as string[]).forEach((reference, referenceIndex) => {
      if (!stateReferenceIds.has(reference)) diagnostics.push(error(
        "procedure.operation.resource-missing",
        `/steps/${stepIndex}/normalizedOperation/${field}/${referenceIndex}`,
        `Resource or variable ${reference} is not declared.`,
      ));
    }));
  });

  const validDependencies = new Map(procedure.steps.map((step) => [
    step.id,
    step.dependencies.filter((dependency) => stepIds.has(dependency) && dependency !== step.id),
  ]));
  const remainingDependencies = new Map(
    procedure.steps.map((step) => [step.id, validDependencies.get(step.id)?.length ?? 0]),
  );
  const pending = procedure.steps
    .filter((step) => (validDependencies.get(step.id)?.length ?? 0) === 0)
    .map(({ id }) => id);
  let visitedDependencyNodes = 0;
  while (pending.length > 0) {
    const completedId = pending.shift()!;
    visitedDependencyNodes += 1;
    procedure.steps.forEach((step) => {
      if (!validDependencies.get(step.id)?.includes(completedId)) return;
      const remaining = (remainingDependencies.get(step.id) ?? 0) - 1;
      remainingDependencies.set(step.id, remaining);
      if (remaining === 0) pending.push(step.id);
    });
  }
  if (visitedDependencyNodes !== procedure.steps.length) diagnostics.push(error(
    "procedure.step.dependency-cycle",
    "/steps",
    "Procedure step dependencies must be acyclic.",
  ));

  [
    ["entryStepIds", procedure.controlFlow.entryStepIds],
    ["completionStepIds", procedure.controlFlow.completionStepIds],
  ].forEach(([field, ids]) => (ids as string[]).forEach((id, index) => {
    if (!stepIds.has(id)) diagnostics.push(error(
      "procedure.control-flow.step-missing",
      `/controlFlow/${field}/${index}`,
      `Step ${id} is not declared.`,
    ));
  }));

  diagnostics.sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code));
  if (diagnostics.length > 0) return { ok: false, diagnostics, review: summarizeProcedureIRReview(procedure) };
  return { ok: true, value: procedure, diagnostics: [], review: summarizeProcedureIRReview(procedure) };
};
