import {
  acidBaseTitrationFamily,
  roleDefinitionIds,
} from "../experimentComposer/catalogs";
import { stageGuardIdentity, type StagedExperiment } from "../experimentComposer/types";
import { deriveTitrationDropPlan } from "../domain/titrationModels";
import { validateLabDefinition } from "../domain/validation";
import { equipmentById } from "../equipment/catalog";
import { collectStudioInteractionIssues } from "../studio/studioValidation";
import {
  createRuntimeState,
  getActions,
  getInitialEquipment,
  getProcess,
  runInteractionSequence,
  type RuntimeInteractionIntent,
} from "../runtime";
import {
  driveAcidBaseTitration,
  driveUntilNode,
  protocolIntentForAction,
  resetProtocolRuntime,
} from "./driveAcidBaseTitration";
import {
  PROTOCOL_CHECK_NAMES,
  type ProtocolCheckLimitations,
  type ProtocolCheckName,
  type ProtocolCheckReport,
  type ProtocolCheckResult,
  type ProtocolCheckRunResult,
} from "./types";

const pass = (name: ProtocolCheckName, message: string): ProtocolCheckResult => ({
  name,
  status: "passed",
  message,
});

const fail = (name: ProtocolCheckName, message: string): ProtocolCheckResult => ({
  name,
  status: "failed",
  message,
});

export const protocolCheckLimitations = (stage: StagedExperiment): ProtocolCheckLimitations => ({
  scientific: [...stage.blueprint.fidelity.limitations],
  safety: [
    "Protocol Check confirms declared simulation gates only; it is not a comprehensive safety review or regulatory certification.",
    ...stage.definition.safetyNotes,
  ],
  physical: [
    "A passing simulated protocol does not characterize an external physical sample or authorize physical laboratory work.",
    ...stage.blueprint.fidelity.proceduralOnly,
  ],
});

const REQUIRED_PROTOCOL_LIMITATION_CATEGORIES = Object.freeze([
  "scientific",
  "safety",
  "physical",
] as const satisfies readonly (keyof ProtocolCheckLimitations)[]);

export const hasRequiredProtocolLimitationCategories = (
  limitations: Partial<Record<keyof ProtocolCheckLimitations, unknown>> | null | undefined,
): boolean => Boolean(
  limitations
  && REQUIRED_PROTOCOL_LIMITATION_CATEGORIES.every((category) => {
    const items = limitations[category];
    return Array.isArray(items)
      && items.length > 0
      && Array.from(items).every(
        (item) => typeof item === "string" && item.trim().length > 0,
      );
  }),
);

const isolatedDefinition = (stage: StagedExperiment) => structuredClone(stage.definition);

const firstAction = (stage: StagedExperiment) => {
  const definition = isolatedDefinition(stage);
  const node = getProcess(definition).nodes.find((candidate) => candidate.id === definition.process.startNodeId);
  return { definition, action: getActions(definition).find((candidate) => candidate.id === node?.actionId) };
};

const checkSchema = (stage: StagedExperiment): ProtocolCheckResult => {
  const validated = validateLabDefinition(isolatedDefinition(stage));
  return validated.ok && validated.value
    ? pass("schema_valid", "The staged definition satisfies the current LabDefinition schema.")
    : fail("schema_valid", "The staged definition does not satisfy the current LabDefinition schema.");
};

const checkInteractions = (stage: StagedExperiment): ProtocolCheckResult =>
  collectStudioInteractionIssues(isolatedDefinition(stage)).length === 0
    ? pass("interaction_contracts_valid", "All staged actions have supported Studio interaction contracts.")
    : fail("interaction_contracts_valid", "One or more staged actions lack a supported interaction contract.");

const checkInventoryRoles = (stage: StagedExperiment): ProtocolCheckResult => {
  try {
    const definition = isolatedDefinition(stage);
    const initialEquipment = getInitialEquipment(definition);
    const model = definition.titrationModels?.find((candidate) => candidate.id === "unknown-acid-naoh");
    if (!model) throw new Error("missing model");
    const plan = deriveTitrationDropPlan(model);
    const epsilon = 1e-9;
    const volumeFor = (definitionId: string): number | undefined =>
      initialEquipment.find((item) => item.definitionId === definitionId)?.contents.volumeMl;
    const capacityFor = (definitionId: string): number | undefined => {
      const capacity = equipmentById.get(definitionId)?.capacity;
      return capacity?.unit === "mL" ? capacity.amount : undefined;
    };
    const exactRoleInstances = acidBaseTitrationFamily.requiredRoles.every((role) => {
      const expectedDefinitionId = roleDefinitionIds[role];
      return stage.blueprint.resolvedRoles[role] === expectedDefinitionId
        && definition.equipment.includes(expectedDefinitionId)
        && initialEquipment.filter((item) => item.definitionId === expectedDefinitionId).length === 1;
    });
    const analyteVolume = volumeFor(roleDefinitionIds.analyte_source);
    const titrantReserve = volumeFor(roleDefinitionIds.titrant_source);
    const buretteVolume = volumeFor(roleDefinitionIds.burette);
    const indicatorVolume = volumeFor(roleDefinitionIds.indicator_source);
    const receivingCapacity = capacityFor(roleDefinitionIds.receiving_flask);
    const buretteCapacity = capacityFor(roleDefinitionIds.burette);
    const maximumTitrantDelivery = plan.endpointDeliveredVolumeMl
      + plan.maxExtraDrops * plan.dropVolumeMl;
    const quantitiesSupportPlan = [
      analyteVolume,
      titrantReserve,
      buretteVolume,
      indicatorVolume,
      receivingCapacity,
      buretteCapacity,
    ].every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0)
      && analyteVolume! + epsilon >= stage.blueprint.model.analyteVolumeMl + stage.blueprint.model.acidReserveMl
      && titrantReserve! + epsilon >= stage.blueprint.model.naohReserveMl
      && Math.abs(buretteVolume! - stage.blueprint.model.buretteFillVolumeMl) <= epsilon
      && buretteVolume! + epsilon >= maximumTitrantDelivery
      && buretteVolume! <= buretteCapacity! + epsilon
      && indicatorVolume! + epsilon >= stage.blueprint.model.indicatorVolumeMl
      && receivingCapacity! + epsilon >= stage.blueprint.model.analyteVolumeMl
        + stage.blueprint.model.indicatorVolumeMl
        + maximumTitrantDelivery;
    const valid = stage.blueprint.familyId === acidBaseTitrationFamily.id
      && stage.validation.inventoryErrors.length === 0
      && exactRoleInstances
      && quantitiesSupportPlan;
    return valid
      ? pass("inventory_roles_resolved", "Every verified role resolves once, and staged quantities and capacities support the full executable plan.")
      : fail("inventory_roles_resolved", "A verified role, staged quantity, or apparatus capacity does not support the full executable plan.");
  } catch {
    return fail("inventory_roles_resolved", "A verified role, staged quantity, or apparatus capacity could not be validated.");
  }
};

const checkModel = (stage: StagedExperiment): ProtocolCheckResult => {
  try {
    const definition = isolatedDefinition(stage);
    const model = definition.titrationModels?.find((candidate) => candidate.id === "unknown-acid-naoh");
    if (!model) return fail("titration_model_derives", "The staged acid-base model is missing.");
    const plan = deriveTitrationDropPlan(model);
    const dispense = getActions(definition).find((candidate) => candidate.id === "deliver-titrant");
    const runtimePlanMatches = dispense?.parameters.endpointDropCount === plan.endpointDropCount
      && dispense.parameters.dropVolumeMl === plan.dropVolumeMl;
    return Number.isFinite(plan.endpointDeliveredVolumeMl) && plan.endpointDropCount > 0 && runtimePlanMatches
      ? pass("titration_model_derives", "The staged acid-base model derives a finite executable drop plan.")
      : fail("titration_model_derives", "The staged acid-base model and ordinary dispense action do not share one executable derived plan.");
  } catch {
    return fail("titration_model_derives", "The staged acid-base model could not be derived.");
  }
};

const checkHappyPath = (stage: StagedExperiment, signal: AbortSignal): ProtocolCheckResult => {
  const driven = driveAcidBaseTitration(isolatedDefinition(stage), signal);
  return driven.ok
    ? pass("happy_path_completes", "A fresh staged runtime completed every required node through ordinary interactions.")
    : fail("happy_path_completes", driven.message);
};

const checkWrongTarget = (stage: StagedExperiment, signal: AbortSignal): ProtocolCheckResult => {
  const { definition, action } = firstAction(stage);
  const initial = createRuntimeState(definition, "guided");
  const firstIntent = action ? protocolIntentForAction(action) : undefined;
  if (!firstIntent) return fail("wrong_target_rejected", "The initial ordinary interaction could not be constructed.");
  const first = runInteractionSequence(definition, initial, [firstIntent], signal);
  if (first.status !== "completed") return fail("wrong_target_rejected", "Fresh setup did not reach the target-validation case.");
  const mount = getActions(definition).find((candidate) => candidate.id === "mount-burette");
  const wrongTarget = first.state.equipmentInstances.find((item) => item.definitionId === "erlenmeyer-flask-250ml");
  const source = first.state.equipmentInstances.find((item) => item.definitionId === "burette-50ml");
  if (!mount || !wrongTarget || !source) return fail("wrong_target_rejected", "The target-validation fixture apparatus is unavailable.");
  const rejected = runInteractionSequence(definition, first.state, [{
    type: "snapIntent",
    actionId: mount.id,
    origin: "programmatic",
    sourceInstanceId: source.id,
    targetInstanceId: wrongTarget.id,
  }], signal);
  const unchanged = rejected.state.currentNodeId === first.state.currentNodeId
    && rejected.state.completedNodes.length === first.state.completedNodes.length;
  return rejected.status === "rejected" && unchanged
    ? pass("wrong_target_rejected", "The ordinary resolver rejected a visibly wrong apparatus target without advancing the step.")
    : fail("wrong_target_rejected", "A wrong apparatus target was not rejected by the ordinary runtime path.");
};

const checkEarlyEndpoint = (stage: StagedExperiment, signal: AbortSignal): ProtocolCheckResult => {
  const definition = isolatedDefinition(stage);
  const prepared = driveUntilNode(definition, "deliver-titrant-node", signal);
  if (!prepared.ok) return fail("early_endpoint_rejected", "A fresh runtime did not reach the endpoint-rejection checkpoint.");
  const rejected = runInteractionSequence(definition, prepared.state, [{
    type: "dispenseCompleteIntent",
    actionId: "deliver-titrant",
    origin: "programmatic",
  }], signal);
  const unchanged = rejected.state.currentNodeId === prepared.state.currentNodeId
    && rejected.state.completedNodes.length === prepared.state.completedNodes.length;
  return rejected.status === "rejected" && unchanged
    ? pass("early_endpoint_rejected", "Ordinary endpoint acceptance was rejected before visible endpoint evidence existed.")
    : fail("early_endpoint_rejected", "Premature endpoint acceptance was not rejected.");
};

const checkPrematureCalculation = (stage: StagedExperiment, signal: AbortSignal): ProtocolCheckResult => {
  const definition = isolatedDefinition(stage);
  const initial = createRuntimeState(definition, "guided");
  const rejected = runInteractionSequence(definition, initial, [{
    type: "calculationSubmitIntent",
    actionId: "calculate-acid-molarity",
    origin: "programmatic",
  }], signal);
  const unchanged = rejected.state.currentNodeId === initial.currentNodeId
    && rejected.state.completedNodes.length === initial.completedNodes.length;
  return rejected.status === "rejected" && unchanged
    ? pass("premature_calculation_rejected", "The ordinary resolver rejected calculation before its required evidence and sequence position.")
    : fail("premature_calculation_rejected", "A calculation was accepted before its evidence prerequisites were complete.");
};

const checkReset = (stage: StagedExperiment, signal: AbortSignal): ProtocolCheckResult => {
  const { definition, action } = firstAction(stage);
  const initial = createRuntimeState(definition, "guided");
  const intent = action ? protocolIntentForAction(action) : undefined;
  if (!intent) return fail("reset_restores_initial_state", "The reset fixture could not perform an initial ordinary interaction.");
  const changed = runInteractionSequence(definition, initial, [intent], signal);
  if (changed.status !== "completed") return fail("reset_restores_initial_state", "The reset fixture did not first change runtime state.");
  const reset = resetProtocolRuntime(definition, changed.state);
  const comparableRuntime = ({
    feedbackQueue: _feedbackQueue,
    ...state
  }: typeof initial) => state;
  const restored = JSON.stringify(comparableRuntime(reset))
    === JSON.stringify(comparableRuntime(initial));
  return restored
    ? pass("reset_restores_initial_state", "Ordinary runtime reset restored a fresh staged attempt and its configured apparatus state.")
    : fail("reset_restores_initial_state", "Runtime reset retained progress or apparatus changes from the isolated case.");
};

const checkLimitations = (stage: StagedExperiment): ProtocolCheckResult => {
  const limitations = protocolCheckLimitations(stage);
  return hasRequiredProtocolLimitationCategories(limitations)
    ? pass("limitations_present", "Scientific, declared-safety, and physical-transfer limitations are present and remain visible.")
    : fail("limitations_present", "The staged report is missing a scientific, safety, or physical limitation category.");
};

const aborted = (stage: StagedExperiment): ProtocolCheckRunResult => ({
  status: "aborted",
  stage: stageGuardIdentity(stage),
  message: "Protocol Check was cancelled. No partial report was stored or summarized as a pass.",
});

export const runProtocolCheck = async (
  stage: StagedExperiment,
  signal: AbortSignal,
): Promise<ProtocolCheckRunResult> => {
  const checks: ProtocolCheckResult[] = [];
  const cases: Array<() => ProtocolCheckResult> = [
    () => checkSchema(stage),
    () => checkInteractions(stage),
    () => checkInventoryRoles(stage),
    () => checkModel(stage),
    () => checkHappyPath(stage, signal),
    () => checkWrongTarget(stage, signal),
    () => checkEarlyEndpoint(stage, signal),
    () => checkPrematureCalculation(stage, signal),
    () => checkReset(stage, signal),
    () => checkLimitations(stage),
  ];

  for (const executeCase of cases) {
    if (signal.aborted) return aborted(stage);
    checks.push(executeCase());
    if (signal.aborted) return aborted(stage);
    await Promise.resolve();
  }

  if (checks.length !== PROTOCOL_CHECK_NAMES.length) return aborted(stage);
  const report: ProtocolCheckReport = {
    reportId: `protocol-${stage.stageId}-r${stage.stageRevision}`,
    stage: stageGuardIdentity(stage),
    passed: checks.every((result) => result.status === "passed"),
    completedAt: new Date().toISOString(),
    checks,
    limitations: protocolCheckLimitations(stage),
  };
  return { status: "completed", report };
};
