import type {
  ActionDefinition,
  LabCompositionSourceDefinition,
  ProcessNode,
  TechniqueDefinition,
} from "../domain/types";
import type {
  CompiledWitnessAttempt,
  CompiledWitnessCollection,
  SourceInstanceScope,
  SuccessfulCompiledWitnessAttempt,
} from "./collectCompiledWitnesses";

export type CompiledDiagnosticStatus =
  | "compile-failed"
  | "unsupported-setup"
  | "unrepresented-configuration"
  | "fixed-role-configuration"
  | "representative-continuous-configuration"
  | "unresolved-origin"
  | "unresolved-template"
  | "inconclusive-static-only"
  | "not-applicable"
  | "unconsumed-authoring-surface";

/** Rules whose old raw-owner view is replaced by compiled witness contexts when one exists. */
export const COMPOSITION_CONTEXT_RULE_IDS = [
  "cycle06/photometer-wavelength-unproduced",
  "cycle06/cuvette-slot-unbalanced",
  "cycle09/initial-reading-not-instrument-derived",
  "cycle09/shared-endpoint-tag",
  "cycle09/dispense-ungated",
  "cycle09/dispense-unreachable",
  "cycle09/endpoint-disclosed-in-prose",
  "cycle10/recorded-distance-has-no-reading",
  "cycle11/gas-collection-instrument-never-zeroed",
  "cycle11/kinetics-chronology-out-of-order",
  "cycle11/reactant-preparation-after-contact",
  "cycle11/magnet-read-after-melting-stage",
  "cycle11/disposal-precedes-record",
  "cycle11/test-vessel-shared-between-samples",
] as const;

export interface CompiledDiagnosticLabInput {
  source: LabCompositionSourceDefinition;
  collection: CompiledWitnessCollection;
}

export interface TechniqueAuthoringSurface {
  id: string;
  version: string;
  indexed: boolean;
  path: string;
  /** Raw action inventory retained when this technique has no compiled occurrence. */
  actionIds: string[];
}

export interface CompiledDiagnosticsInput {
  labs: readonly CompiledDiagnosticLabInput[];
  techniques: readonly TechniqueDefinition[];
  techniqueSurfaces: readonly TechniqueAuthoringSurface[];
  /** Techniques still used through legacy action-only import paths stay on their raw rule path. */
  legacyTechniqueIds?: readonly string[];
}

export interface CompiledContextIdentity {
  contextKey: string;
  compiledActionOccurrenceKey: string;
  labId: string;
  witnessId: string;
  originKind: "technique" | "lab-local";
  declaredInstanceId: string | "not-applicable";
  compiledInstanceId: string | "not-applicable";
  repeatIndex: number | "not-applicable";
  techniqueId: string | "not-applicable";
  techniqueVersion: string | "not-applicable";
  originalActionId: string | "not-applicable";
  originalNodeId: string | "not-applicable";
  compiledActionId: string | "not-applicable";
  compiledNodeId: string;
}

export interface CompiledDiagnosticStatusRecord {
  status: CompiledDiagnosticStatus;
  labId?: string;
  witnessId?: string | null;
  rule?: string;
  contextKey?: string;
  detail: string;
  setupFixtureId?: string;
  context?: CompiledContextIdentity;
}

export interface CompiledContextFinding {
  rule: string;
  normalizedCause: string;
  authoringKey: string;
  context: CompiledContextIdentity;
  detail: string;
}

export interface CompiledAuthoringFinding {
  rule: string;
  normalizedCause: string;
  authoringKey: string;
  owner: string;
  affectedContextKeys: string[];
  affectedCompiledActionKeys: string[];
  affectedCompiledNodeIds: string[];
  witnessIds: string[];
}

export interface CompiledProbeResult {
  id: "wavelength-substitution" | "calibration-blanking-order" | "cuvette-identity" | "solvent-before-reading";
  status: CompiledDiagnosticStatus;
  evaluatedContextCount: number;
  staticFindingCount: number;
  boundary: string;
}

export interface CompiledDiagnosticsResult {
  schema: "lab-studio/compiled-content-diagnostics@1";
  validationBoundary: string;
  coverage: {
    declaredWitnessCount: number;
    selectedWitnessCount: number;
    attemptedContextCount: number;
    /** Successful lab+witness compiler attempts, distinct from the node rows evaluated below. */
    compiledContextCount: number;
    evaluatedNodeContextCount: number;
    byStatus: Record<string, number>;
    unrepresentedConfigurations: CompiledDiagnosticStatusRecord[];
    /** Authored fixed-role or host-predicate configuration boundaries, not missing coverage. */
    fixedRoleConfigurations: CompiledDiagnosticStatusRecord[];
    /** Valid continuous-numeric samples are informative but never an exhaustive domain claim. */
    representativeContinuousConfigurations: CompiledDiagnosticStatusRecord[];
  };
  /** Forward declaration-to-scope table, retained even when an instance has no selected witness. */
  sourceInstanceScopes: Array<SourceInstanceScope & { labId: string }>;
  contexts: CompiledContextIdentity[];
  statuses: CompiledDiagnosticStatusRecord[];
  findings: {
    authoring: CompiledAuthoringFinding[];
    contexts: CompiledContextFinding[];
    counts: {
      uniqueRawAuthoringFindings: number;
      uniqueCompiledContextFindings: number;
      affectedCompiledActions: number;
      affectedCompiledNodes: number;
    };
  };
  probes: CompiledProbeResult[];
  impact: {
    compiledLabIds: string[];
    compiledTechniqueIds: string[];
    unconsumedAuthoringSurfaces: Array<TechniqueAuthoringSurface & { status: "unconsumed-authoring-surface" }>;
  };
  routing: {
    contextRuleIds: string[];
    routableLabIds: string[];
    routableTechniqueIds: string[];
    untrustworthyLabIds: string[];
    untrustworthyTechniqueIds: string[];
    legacyTechniqueIds: string[];
  };
  notApplicable: CompiledDiagnosticStatusRecord[];
}

interface InternalContext extends CompiledContextIdentity {
  action?: ActionDefinition;
  node: ProcessNode;
  attempt: SuccessfulCompiledWitnessAttempt;
  source: LabCompositionSourceDefinition;
}

interface AttemptGraph {
  nodeById: Map<string, ProcessNode>;
  contextByNodeId: Map<string, InternalContext>;
  contextsByActionId: Map<string, InternalContext[]>;
  dominators: Map<string, Set<string>>;
}

const present = (value: unknown): value is string | number | boolean =>
  value !== undefined && value !== null && value !== "";

const paramsOf = (action: ActionDefinition): Record<string, unknown> =>
  action.parameters as Record<string, unknown>;

const keyOf = (...parts: unknown[]): string => JSON.stringify(parts);

const normalizeCause = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

const sourceInstanceScopeMap = (scopes: readonly SourceInstanceScope[]): Map<string, SourceInstanceScope> =>
  new Map(scopes.map((scope) => [scope.compiledInstanceId, scope]));

const compiledActionById = (attempt: SuccessfulCompiledWitnessAttempt): Map<string, ActionDefinition[]> => {
  const actions = new Map<string, ActionDefinition[]>();
  for (const action of attempt.compiled.actions) {
    actions.set(action.id, [...(actions.get(action.id) ?? []), action]);
  }
  return actions;
};

const makeLabLocalContext = (
  source: LabCompositionSourceDefinition,
  attempt: SuccessfulCompiledWitnessAttempt,
  node: ProcessNode,
  action: ActionDefinition | undefined,
): InternalContext => {
  const actionId = action?.id ?? "not-applicable";
  return {
    contextKey: keyOf(source.id, attempt.effectiveWitnessId, node.id),
    compiledActionOccurrenceKey: keyOf(source.id, attempt.effectiveWitnessId, actionId),
    labId: source.id,
    witnessId: attempt.effectiveWitnessId,
    originKind: "lab-local",
    declaredInstanceId: "not-applicable",
    compiledInstanceId: "not-applicable",
    repeatIndex: "not-applicable",
    techniqueId: "not-applicable",
    techniqueVersion: "not-applicable",
    originalActionId: actionId,
    originalNodeId: node.id,
    compiledActionId: actionId,
    compiledNodeId: node.id,
    action,
    node,
    attempt,
    source,
  };
};

const makeTechniqueContext = (
  source: LabCompositionSourceDefinition,
  attempt: SuccessfulCompiledWitnessAttempt,
  node: ProcessNode,
  action: ActionDefinition | undefined,
  scope: SourceInstanceScope,
  origin: { techniqueId: string; techniqueVersion: string; sourceActionId?: string; sourceNodeId: string },
): InternalContext => {
  const actionId = action?.id ?? "not-applicable";
  return {
    contextKey: keyOf(source.id, attempt.effectiveWitnessId, node.id),
    compiledActionOccurrenceKey: keyOf(source.id, attempt.effectiveWitnessId, actionId),
    labId: source.id,
    witnessId: attempt.effectiveWitnessId,
    originKind: "technique",
    declaredInstanceId: scope.declaredInstanceId,
    compiledInstanceId: scope.compiledInstanceId,
    repeatIndex: scope.repeatIndex,
    techniqueId: origin.techniqueId,
    techniqueVersion: origin.techniqueVersion,
    originalActionId: origin.sourceActionId ?? "not-applicable",
    originalNodeId: origin.sourceNodeId,
    compiledActionId: actionId,
    compiledNodeId: node.id,
    action,
    node,
    attempt,
    source,
  };
};

/** A conservative dominance relation over the compiled graph; it never treats branch reachability as runtime proof. */
const buildAttemptGraph = (attempt: SuccessfulCompiledWitnessAttempt, contexts: readonly InternalContext[]): AttemptGraph => {
  const nodeById = new Map(attempt.compiled.process.nodes.map((node) => [node.id, node]));
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const edge of attempt.compiled.process.edges) {
    if (edge.condition?.type === "retry") continue;
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
    incoming.set(edge.to, [...(incoming.get(edge.to) ?? []), edge.from]);
  }
  const reachable = new Set<string>();
  const pending = [attempt.compiled.process.startNodeId];
  while (pending.length) {
    const nodeId = pending.pop();
    if (!nodeId || reachable.has(nodeId) || !nodeById.has(nodeId)) continue;
    reachable.add(nodeId);
    pending.push(...(outgoing.get(nodeId) ?? []));
  }
  const allReachable = new Set(reachable);
  const dominators = new Map<string, Set<string>>();
  for (const nodeId of reachable) {
    dominators.set(
      nodeId,
      nodeId === attempt.compiled.process.startNodeId ? new Set([nodeId]) : new Set(allReachable),
    );
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const nodeId of reachable) {
      if (nodeId === attempt.compiled.process.startNodeId) continue;
      const predecessors = (incoming.get(nodeId) ?? []).filter((candidate) => reachable.has(candidate));
      if (predecessors.length === 0) continue;
      const intersection = new Set(dominators.get(predecessors[0]) ?? []);
      for (const predecessor of predecessors.slice(1)) {
        for (const candidate of [...intersection]) {
          if (!(dominators.get(predecessor) ?? new Set()).has(candidate)) intersection.delete(candidate);
        }
      }
      intersection.add(nodeId);
      const prior = dominators.get(nodeId) ?? new Set<string>();
      if (prior.size !== intersection.size || [...prior].some((candidate) => !intersection.has(candidate))) {
        dominators.set(nodeId, intersection);
        changed = true;
      }
    }
  }
  const contextsByActionId = new Map<string, InternalContext[]>();
  const contextByNodeId = new Map<string, InternalContext>();
  for (const context of contexts) {
    contextByNodeId.set(context.compiledNodeId, context);
    if (context.compiledActionId === "not-applicable") continue;
    contextsByActionId.set(
      context.compiledActionId,
      [...(contextsByActionId.get(context.compiledActionId) ?? []), context],
    );
  }
  return { nodeById, contextByNodeId, contextsByActionId, dominators };
};

const dominates = (graph: AttemptGraph, beforeNodeId: string, afterNodeId: string): boolean =>
  beforeNodeId === afterNodeId || Boolean(graph.dominators.get(afterNodeId)?.has(beforeNodeId));

const actionEvidenceClosure = (actionId: string, actions: ReadonlyMap<string, ActionDefinition>): Set<string> => {
  const discovered = new Set<string>();
  const visit = (candidateId: string): void => {
    if (discovered.has(candidateId)) return;
    discovered.add(candidateId);
    for (const prerequisite of actions.get(candidateId)?.prerequisites ?? []) {
      if (prerequisite.type === "actionEvidence" && typeof prerequisite.actionId === "string") {
        visit(prerequisite.actionId);
      }
    }
  };
  visit(actionId);
  return discovered;
};

const writesMeasurement = (action: ActionDefinition, measurementId: string): boolean => {
  const params = paramsOf(action);
  if (
    action.mass?.source === "action-input" &&
    action.mass.outputMeasurementId === measurementId
  ) {
    return true;
  }
  if (params.measurementId !== measurementId) return false;
  if (new Set(["weigh", "measureVolume", "dilute", "developChromatogram", "record"]).has(action.verb)) return true;
  if (action.atomId === "atom.measure.read-burette") return true;
  return action.verb === "observe" && (
    present(params.chromatographyMeasurementType) ||
    present(params.configurationQuantity) ||
    params.photometerOperation === "read"
  );
};

const actionInstanceReferences = (value: unknown, key = ""): string[] => {
  if (Array.isArray(value)) return value.flatMap((item) => actionInstanceReferences(item, key));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([childKey, childValue]) => actionInstanceReferences(childValue, childKey));
  }
  return /InstanceIds?$/i.test(key) && typeof value === "string" ? [value] : [];
};

class FindingCollector {
  readonly contextFindings = new Map<string, CompiledContextFinding>();
  private readonly authoring = new Map<string, {
    rule: string;
    normalizedCause: string;
    authoringKey: string;
    owner: string;
    contexts: Map<string, InternalContext>;
  }>();

  report(rule: string, context: InternalContext, cause: string, detail: string): void {
    const normalizedCause = normalizeCause(cause);
    const owner = context.originKind === "technique"
      ? `technique:${context.techniqueId}@${context.techniqueVersion}/${context.originalActionId}`
      : `lab:${context.labId}/${context.originalActionId}`;
    const authoringKey = context.originKind === "technique"
      ? keyOf(rule, "technique", context.techniqueId, context.techniqueVersion, context.originalActionId, normalizedCause)
      : keyOf(rule, "lab", context.labId, context.originalActionId, normalizedCause);
    const contextKey = keyOf(rule, context.contextKey, normalizedCause);
    this.contextFindings.set(contextKey, {
      rule,
      normalizedCause,
      authoringKey,
      context: serializeContext(context),
      detail,
    });
    const aggregate = this.authoring.get(authoringKey) ?? {
      rule,
      normalizedCause,
      authoringKey,
      owner,
      contexts: new Map<string, InternalContext>(),
    };
    aggregate.contexts.set(context.contextKey, context);
    this.authoring.set(authoringKey, aggregate);
  }

  authoringFindings(): CompiledAuthoringFinding[] {
    return [...this.authoring.values()].map((finding) => {
      const contexts = [...finding.contexts.values()];
      return {
        rule: finding.rule,
        normalizedCause: finding.normalizedCause,
        authoringKey: finding.authoringKey,
        owner: finding.owner,
        affectedContextKeys: contexts.map((context) => context.contextKey).sort(),
        affectedCompiledActionKeys: [...new Set(contexts.map((context) => context.compiledActionOccurrenceKey))].sort(),
        affectedCompiledNodeIds: contexts.map((context) => context.compiledNodeId).sort(),
        witnessIds: [...new Set(contexts.map((context) => context.witnessId))].sort(),
      };
    }).sort((left, right) => left.authoringKey.localeCompare(right.authoringKey));
  }
}

const serializeContext = (context: InternalContext): CompiledContextIdentity => ({
  contextKey: context.contextKey,
  compiledActionOccurrenceKey: context.compiledActionOccurrenceKey,
  labId: context.labId,
  witnessId: context.witnessId,
  originKind: context.originKind,
  declaredInstanceId: context.declaredInstanceId,
  compiledInstanceId: context.compiledInstanceId,
  repeatIndex: context.repeatIndex,
  techniqueId: context.techniqueId,
  techniqueVersion: context.techniqueVersion,
  originalActionId: context.originalActionId,
  originalNodeId: context.originalNodeId,
  compiledActionId: context.compiledActionId,
  compiledNodeId: context.compiledNodeId,
});

const buildAttemptContexts = (
  source: LabCompositionSourceDefinition,
  scopes: readonly SourceInstanceScope[],
  attempt: SuccessfulCompiledWitnessAttempt,
  techniquesById: ReadonlyMap<string, TechniqueDefinition>,
  statuses: CompiledDiagnosticStatusRecord[],
): InternalContext[] => {
  const originsByNode = new Map<string, typeof attempt.manifest.origins>();
  for (const origin of attempt.manifest.origins) {
    originsByNode.set(origin.nodeId, [...(originsByNode.get(origin.nodeId) ?? []), origin]);
  }
  const scopeByCompiledId = sourceInstanceScopeMap(scopes);
  const manifestInstances = new Map(attempt.manifest.instances.map((instance) => [instance.instanceId, instance]));
  const actionsById = compiledActionById(attempt);
  const localActions = new Map(source.actions.map((action) => [action.id, action]));
  const contexts: InternalContext[] = [];

  for (const node of attempt.compiled.process.nodes) {
    const origins = originsByNode.get(node.id) ?? [];
    const compiledActions = node.actionId ? actionsById.get(node.actionId) ?? [] : [];
    const mappingError = (detail: string): void => {
      statuses.push({
        status: "unresolved-origin",
        labId: source.id,
        witnessId: attempt.effectiveWitnessId,
        contextKey: keyOf(source.id, attempt.effectiveWitnessId, node.id),
        detail,
        setupFixtureId: attempt.setupFixtureId,
      });
    };

    if (origins.length > 1) {
      mappingError(`Compiled node ${node.id} has ${origins.length} manifest origins.`);
      continue;
    }
    if (origins.length === 0) {
      if (!node.actionId) {
        contexts.push(makeLabLocalContext(source, attempt, node, undefined));
        continue;
      }
      if (!localActions.has(node.actionId)) {
        mappingError(`Compiled node ${node.id} has no manifest origin and action ${node.actionId} is not a raw lab-local action.`);
        continue;
      }
      if (compiledActions.length !== 1) {
        mappingError(`Compiled node ${node.id} refers to ${compiledActions.length} compiled actions named ${node.actionId}.`);
        continue;
      }
      contexts.push(makeLabLocalContext(source, attempt, node, compiledActions[0]));
      continue;
    }

    const origin = origins[0];
    const scope = scopeByCompiledId.get(origin.instanceId);
    const manifestInstance = manifestInstances.get(origin.instanceId);
    if (!scope || !manifestInstance) {
      mappingError(`Manifest origin for node ${node.id} names unknown compiled instance ${origin.instanceId}.`);
      continue;
    }
    if (origin.actionId !== node.actionId) {
      mappingError(`Manifest origin action ${origin.actionId ?? "none"} disagrees with compiled node action ${node.actionId ?? "none"}.`);
      continue;
    }
    if (origin.techniqueId !== scope.techniqueId || origin.techniqueVersion !== scope.techniqueVersion ||
      manifestInstance.techniqueId !== scope.techniqueId || manifestInstance.version !== scope.techniqueVersion ||
      manifestInstance.repeatIndex !== scope.repeatIndex) {
      mappingError(`Manifest origin for node ${node.id} disagrees with the explicit source-instance scope table.`);
      continue;
    }
    const sourceTechnique = techniquesById.get(scope.techniqueId);
    const sourceNode = sourceTechnique?.process.nodes.find((candidate) => candidate.id === origin.sourceNodeId);
    if (!sourceTechnique || sourceTechnique.metadata.version !== scope.techniqueVersion ||
      !sourceNode || sourceNode.actionId !== origin.sourceActionId ||
      (origin.sourceActionId !== undefined && !sourceTechnique.actions.some((candidate) =>
        candidate.id === origin.sourceActionId))) {
      mappingError(
        `Manifest origin for node ${node.id} does not join to ${scope.techniqueId}@${scope.techniqueVersion} ` +
        `source node ${origin.sourceNodeId} and source action ${origin.sourceActionId ?? "none"}.`,
      );
      continue;
    }
    if (!node.actionId && !origin.sourceActionId && compiledActions.length === 0) {
      contexts.push(makeTechniqueContext(source, attempt, node, undefined, scope, origin));
      continue;
    }
    if (!node.actionId || !origin.sourceActionId || compiledActions.length !== 1) {
      mappingError(`Technique origin for node ${node.id} does not resolve one action with a source action id.`);
      continue;
    }
    contexts.push(makeTechniqueContext(source, attempt, node, compiledActions[0], scope, origin));
  }
  return contexts;
};

/** Validate compiler-emitted evidence ownership against the same manifest-origin context table. */
const reportManifestEvidenceReferences = (
  attempt: SuccessfulCompiledWitnessAttempt,
  graph: AttemptGraph,
  statuses: CompiledDiagnosticStatusRecord[],
): void => {
  const actions = compiledActionById(attempt);
  for (const instance of attempt.manifest.instances) {
    const outputIds = new Set(instance.evidenceOutputs.map((output) => output.id));
    for (const output of instance.evidenceOutputs) {
      const actionMatches = actions.get(output.actionId) ?? [];
      const originContexts = (graph.contextsByActionId.get(output.actionId) ?? []).filter((context) =>
        context.originKind === "technique" && context.compiledInstanceId === instance.instanceId,
      );
      if (actionMatches.length !== 1 || originContexts.length === 0) {
        const resolvedContext = originContexts.length === 1 ? originContexts[0] : undefined;
        statuses.push({
          status: "unresolved-origin",
          labId: attempt.labId,
          witnessId: attempt.effectiveWitnessId,
          ...(resolvedContext ? {
            contextKey: resolvedContext.contextKey,
            context: serializeContext(resolvedContext),
          } : {}),
          detail: `Manifest evidence output ${output.id} for ${instance.instanceId} does not resolve one compiled action owned by that exact instance.`,
          setupFixtureId: attempt.setupFixtureId,
        });
      }
    }
    for (const exitNodeId of instance.completion.exitNodeIds) {
      const exitContext = graph.contextByNodeId.get(exitNodeId);
      if (exitContext?.originKind === "technique" && exitContext.compiledInstanceId === instance.instanceId) continue;
      statuses.push({
        status: "unresolved-origin",
        labId: attempt.labId,
        witnessId: attempt.effectiveWitnessId,
        ...(exitContext ? {
          contextKey: exitContext.contextKey,
          context: serializeContext(exitContext),
        } : {}),
        detail: `Manifest completion exit ${exitNodeId} for ${instance.instanceId} is not owned by that exact compiled instance.`,
        setupFixtureId: attempt.setupFixtureId,
      });
    }
    for (const requiredOutputId of instance.completion.requiredEvidenceOutputIds) {
      if (!outputIds.has(requiredOutputId)) {
        statuses.push({
          status: "unresolved-origin",
          labId: attempt.labId,
          witnessId: attempt.effectiveWitnessId,
          detail: `Manifest completion for ${instance.instanceId} requires evidence output ${requiredOutputId}, which the same compiled instance does not publish.`,
          setupFixtureId: attempt.setupFixtureId,
        });
      }
    }
  }
};

const contextsFor = (contexts: readonly InternalContext[], predicate: (context: InternalContext) => boolean): InternalContext[] =>
  contexts.filter((context) => Boolean(context.action) && predicate(context));

/**
 * Prefer an action from the same emitted technique occurrence. Falling back to the whole witness
 * preserves intentional cross-technique dependencies while preventing one repeated occurrence from
 * silently satisfying another occurrence when both contain the relevant action family.
 */
const occurrenceCandidates = (
  context: InternalContext,
  candidates: readonly InternalContext[],
): readonly InternalContext[] => {
  if (context.originKind !== "technique") return candidates;
  const sameOccurrence = candidates.filter((candidate) =>
    candidate.originKind === "technique" && candidate.compiledInstanceId === context.compiledInstanceId,
  );
  return sameOccurrence.length > 0 ? sameOccurrence : candidates;
};

const actionMapFor = (attempt: SuccessfulCompiledWitnessAttempt): Map<string, ActionDefinition> =>
  new Map(attempt.compiled.actions.map((action) => [action.id, action]));

const reportConcreteEquipmentReferences = (
  contexts: readonly InternalContext[],
  findings: FindingCollector,
): void => {
  for (const context of contexts) {
    if (!context.action) continue;
    const knownInstances = new Set((context.attempt.compiled.initialState?.equipment ?? []).map((item) => item.id));
    for (const instanceId of actionInstanceReferences(paramsOf(context.action))) {
      if (!knownInstances.has(instanceId)) {
        findings.report(
          "compiled/equipment-instance-not-concrete",
          context,
          `unresolved concrete equipment instance ${instanceId}`,
          `Compiled action ${context.compiledActionId} refers to ${instanceId}, which is absent from the compiled initial equipment state.`,
        );
      }
    }
    const declaredDefinitions = new Set(context.source.equipment);
    for (const definitionId of Object.values(context.action.equipmentRoleBindings ?? {})) {
      if (!declaredDefinitions.has(definitionId)) {
        findings.report(
          "compiled/equipment-role-binding-not-lab-owned",
          context,
          `unresolved concrete equipment definition ${definitionId}`,
          `Compiled action ${context.compiledActionId} binds a role to ${definitionId}, which the source lab does not declare.`,
        );
      }
    }
  }
};

const reportWavelengthAndBlanking = (
  contexts: readonly InternalContext[],
  graph: AttemptGraph,
  findings: FindingCollector,
): { wavelength: number; blanking: number } => {
  if (contexts.length === 0) return { wavelength: 0, blanking: 0 };
  let wavelength = 0;
  let blanking = 0;
  const actions = actionMapFor(contexts[0].attempt);
  const photometerContexts = contextsFor(contexts, (context) => {
    const operation = paramsOf(context.action!).photometerOperation;
    return operation === "read" || operation === "zero";
  });
  for (const context of photometerContexts) {
    const params = paramsOf(context.action!);
    const wavelengthId = params.wavelengthMeasurementId;
    if (typeof wavelengthId !== "string") continue;
    const wavelengthProducers = [...actions.values()].filter((action) =>
      writesMeasurement(action, wavelengthId),
    );
    if (wavelengthProducers.length === 0) {
      findings.report(
        "cycle06/photometer-wavelength-unproduced",
        context,
        `wavelength measurement ${wavelengthId} has no compiled producer`,
        `Compiled photometer action ${context.compiledActionId} requires ${wavelengthId}, but no action in this witness writes it.`,
      );
      wavelength += 1;
    } else {
      const producerContexts = wavelengthProducers.flatMap((action) =>
        graph.contextsByActionId.get(action.id) ?? [],
      );
      if (!producerContexts.some((producer) =>
        dominates(graph, producer.compiledNodeId, context.compiledNodeId),
      )) {
        findings.report(
          "compiled/photometer-wavelength-order-unproven",
          context,
          `wavelength measurement ${wavelengthId} has no dominating compiled producer`,
          `The compiled graph does not prove that ${wavelengthId} is written before photometer action ${context.compiledActionId}.`,
        );
        wavelength += 1;
      }
    }
    if (params.photometerOperation !== "read") continue;
    const zeroTag = params.requiresZeroNotebookTag;
    const selectedWavelengthCalibration =
      params.photometerCalibrationMethod === "selected-wavelength-pair";
    if (!selectedWavelengthCalibration && typeof zeroTag !== "string") continue;
    const matchingZeroes = photometerContexts.filter((candidate) => {
      const candidateParams = paramsOf(candidate.action!);
      if (candidateParams.photometerOperation !== "zero") return false;
      // Selected-wavelength reads are gated by the calibration state that the matching 100%T
      // operation writes. reducer.ts does not consume requiresZeroNotebookTag on that path, so a
      // compiler-scoped legacy tag must not replace its concrete calibration identity check.
      return selectedWavelengthCalibration
        ? candidateParams.photometerCalibrationMethod === "selected-wavelength-pair"
        : candidateParams.tag === zeroTag;
    });
    if (matchingZeroes.length === 0) {
      const blankingReference = selectedWavelengthCalibration
        ? "selected-wavelength calibration"
        : `blanking tag ${zeroTag}`;
      findings.report(
        "compiled/calibration-blanking-producer-missing",
        context,
        `${blankingReference} has no compiled zero action`,
        `Compiled read ${context.compiledActionId} requires ${blankingReference}, but this witness has no matching zero action.`,
      );
      blanking += 1;
      continue;
    }
    const readerInstrumentId = params.photometerInstanceId;
    const sameInstrument = typeof readerInstrumentId === "string"
      ? matchingZeroes.filter((candidate) => paramsOf(candidate.action!).photometerInstanceId === readerInstrumentId)
      : matchingZeroes;
    if (sameInstrument.length === 0) {
      findings.report(
        "compiled/calibration-blanking-instrument-identity-mismatch",
        context,
        `blanking tag ${zeroTag} uses a different photometer instance`,
        `Compiled read ${context.compiledActionId} has no matching blanking action on photometer ${readerInstrumentId}.`,
      );
      blanking += 1;
      continue;
    }
    const sameWavelength = sameInstrument.filter((candidate) =>
      paramsOf(candidate.action!).wavelengthMeasurementId === wavelengthId,
    );
    if (sameWavelength.length === 0) {
      findings.report(
        "compiled/calibration-blanking-wavelength-substitution",
        context,
        `blanking tag ${zeroTag} uses a different wavelength identity`,
        `Compiled read ${context.compiledActionId} and its matching blanking action do not use the same wavelength measurement identity.`,
      );
      blanking += 1;
      continue;
    }
    if (!sameWavelength.some((candidate) => dominates(graph, candidate.compiledNodeId, context.compiledNodeId))) {
      findings.report(
        "compiled/calibration-blanking-order-unproven",
        context,
        `blanking tag ${zeroTag} does not dominate the read`,
        `The compiled graph does not prove that a matching blanking action precedes read ${context.compiledActionId}.`,
      );
      blanking += 1;
    }
  }
  return { wavelength, blanking };
};

const reportCuvetteIdentity = (
  contexts: readonly InternalContext[],
  graph: AttemptGraph,
  findings: FindingCollector,
): number => {
  if (contexts.length === 0) return 0;
  let count = 0;
  const inserts = contextsFor(contexts, (context) => context.action?.atomId === "atom.place.insert-cuvette");
  const removes = contextsFor(contexts, (context) => context.action?.atomId === "atom.place.remove-cuvette");
  const reads = contextsFor(contexts, (context) => paramsOf(context.action!).photometerOperation === "read");
  for (const context of reads) {
    const cuvetteId = paramsOf(context.action!).cuvetteInstanceId;
    if (typeof cuvetteId !== "string") continue;
    const matchingInserts = occurrenceCandidates(context, inserts).filter((candidate) => {
      const params = paramsOf(candidate.action!);
      return params.equipmentInstanceId === cuvetteId || params.sourceInstanceId === cuvetteId;
    });
    if (matchingInserts.length === 0) {
      findings.report(
        "compiled/cuvette-read-without-matching-insert",
        context,
        `cuvette ${cuvetteId} has no compiled insert`,
        `Compiled photometer read ${context.compiledActionId} names cuvette ${cuvetteId}, but no compiled insert action names it.`,
      );
      count += 1;
      continue;
    }
    if (!matchingInserts.some((candidate) => dominates(graph, candidate.compiledNodeId, context.compiledNodeId))) {
      findings.report(
        "compiled/cuvette-insert-order-unproven",
        context,
        `cuvette ${cuvetteId} insert does not dominate the read`,
        `The compiled graph does not prove that cuvette ${cuvetteId} is inserted before read ${context.compiledActionId}.`,
      );
      count += 1;
    }
  }
  const inserted = new Map<string, InternalContext[]>();
  const removed = new Map<string, InternalContext[]>();
  for (const context of inserts) {
    for (const id of [paramsOf(context.action!).equipmentInstanceId, paramsOf(context.action!).sourceInstanceId]) {
      if (typeof id === "string") inserted.set(id, [...(inserted.get(id) ?? []), context]);
    }
  }
  for (const context of removes) {
    for (const id of [paramsOf(context.action!).equipmentInstanceId, paramsOf(context.action!).sourceInstanceId]) {
      if (typeof id === "string") removed.set(id, [...(removed.get(id) ?? []), context]);
    }
  }
  for (const [instanceId, rows] of inserted) {
    for (const context of rows) {
      const matchingRemovals = occurrenceCandidates(context, removed.get(instanceId) ?? []);
      if (matchingRemovals.some((removal) =>
        dominates(graph, context.compiledNodeId, removal.compiledNodeId),
      )) continue;
      findings.report(
        "cycle06/cuvette-slot-unbalanced",
        context,
        `cuvette ${instanceId} has no later dominating removal`,
        `The compiled graph does not prove that cuvette ${instanceId} is removed after insert ${context.compiledActionId}.`,
      );
      count += 1;
    }
  }
  for (const [instanceId, rows] of removed) {
    for (const context of rows) {
      const matchingInserts = occurrenceCandidates(context, inserted.get(instanceId) ?? []);
      if (matchingInserts.some((insert) =>
        dominates(graph, insert.compiledNodeId, context.compiledNodeId),
      )) continue;
      findings.report(
        "cycle06/cuvette-slot-unbalanced",
        context,
        `cuvette ${instanceId} has no earlier dominating insert`,
        `The compiled graph does not prove that cuvette ${instanceId} was inserted before removal ${context.compiledActionId}.`,
      );
      count += 1;
    }
  }
  return count;
};

const reportSolventBeforeReading = (
  contexts: readonly InternalContext[],
  graph: AttemptGraph,
  findings: FindingCollector,
): number => {
  if (contexts.length === 0) return 0;
  let count = 0;
  const develops = contextsFor(contexts, (context) => context.action?.verb === "developChromatogram");
  const readers = contextsFor(contexts, (context) => present(paramsOf(context.action!).chromatographyMeasurementType));
  const actions = actionMapFor(contexts[0].attempt);
  for (const reader of readers) {
    const sourceInstanceId = paramsOf(reader.action!).sourceInstanceId;
    if (typeof sourceInstanceId !== "string") continue;
    const matchingDevelops = occurrenceCandidates(reader, develops).filter((candidate) =>
      paramsOf(candidate.action!).sourceInstanceId === sourceInstanceId,
    );
    if (matchingDevelops.length === 0) {
      findings.report(
        "compiled/solvent-before-reading-development-missing",
        reader,
        `chromatography source ${sourceInstanceId} has no development action`,
        `Compiled reading ${reader.compiledActionId} names ${sourceInstanceId}, but no matching developed strip exists in this witness.`,
      );
      count += 1;
      continue;
    }
    if (!matchingDevelops.some((candidate) => dominates(graph, candidate.compiledNodeId, reader.compiledNodeId))) {
      findings.report(
        "compiled/solvent-before-reading-order-unproven",
        reader,
        `development of ${sourceInstanceId} does not dominate the reading`,
        `The compiled graph does not prove development before chromatography reading ${reader.compiledActionId}.`,
      );
      count += 1;
    }
  }
  for (const develop of develops) {
    const prerequisiteActionIds = (develop.action?.prerequisites ?? [])
      .filter((rule) => rule.type === "actionEvidence" && typeof rule.actionId === "string")
      .map((rule) => rule.actionId!);
    const developingChamberId = paramsOf(develop.action!).targetInstanceId;
    const solventActions = prerequisiteActionIds.flatMap((actionId) => {
      const prerequisite = actions.get(actionId);
      return prerequisite?.atomId === "atom.transfer.charge-developing-chamber"
        ? [prerequisite]
        : [];
    });
    const matchingSolventActions = solventActions.filter((action) =>
      typeof developingChamberId !== "string" ||
      paramsOf(action).targetInstanceId === developingChamberId,
    );
    if (matchingSolventActions.length === 0) {
      findings.report(
        "compiled/development-without-solvent-evidence",
        develop,
        `development has no atom.transfer.charge-developing-chamber prerequisite for ${String(developingChamberId ?? "its concrete chamber")}`,
        `Compiled development ${develop.compiledActionId} has no action-evidence prerequisite that charges the same concrete chamber.`,
      );
      count += 1;
      continue;
    }
    const solventContexts = matchingSolventActions.flatMap((action) =>
      graph.contextsByActionId.get(action.id) ?? [],
    );
    if (!solventContexts.some((solvent) =>
      dominates(graph, solvent.compiledNodeId, develop.compiledNodeId),
    )) {
      findings.report(
        "compiled/development-solvent-order-unproven",
        develop,
        `solvent charge for ${String(developingChamberId ?? "the developing chamber")} does not dominate development`,
        `The compiled graph does not prove the matching developing-chamber solvent charge before ${develop.compiledActionId}.`,
      );
      count += 1;
    }
  }
  return count;
};

const reportTitrationContexts = (
  contexts: readonly InternalContext[],
  graph: AttemptGraph,
  findings: FindingCollector,
): void => {
  if (contexts.length === 0) return;
  const actions = actionMapFor(contexts[0].attempt);
  const allActions = [...actions.values()];
  const writesInstrumentBuretteMeasurement = (action: ActionDefinition, measurementId: string): boolean =>
    (action.atomId === "atom.measure.read-burette" && paramsOf(action).measurementId === measurementId) ||
    (action.interaction?.type === "dispenseDrops" &&
      (paramsOf(action).finalBuretteMeasurementId ?? "burette-final-volume") === measurementId);
  const dispensers = contextsFor(contexts, (context) => context.action?.interaction?.type === "dispenseDrops");
  const chargingAtoms = new Set([
    "atom.transfer.measured-liquid",
    "atom.transfer.acidify-analyte",
    "atom.transfer.add-indicator",
  ]);
  for (const context of dispensers) {
    const action = context.action!;
    const params = paramsOf(action);
    const initialMeasurementId = typeof params.initialBuretteMeasurementId === "string"
      ? params.initialBuretteMeasurementId
      : "burette-initial-volume";
    const initialWriters = allActions.filter((candidate) =>
      writesInstrumentBuretteMeasurement(candidate, initialMeasurementId),
    );
    if (initialWriters.length === 0) {
      findings.report(
        "cycle09/initial-reading-not-instrument-derived",
        context,
        `initial burette measurement ${initialMeasurementId} has no compiled writer`,
        `Compiled dispense ${context.compiledActionId} requires ${initialMeasurementId}, but no compiled action writes that measurement.`,
      );
    } else {
      const writerContexts = initialWriters.flatMap((writer) =>
        graph.contextsByActionId.get(writer.id) ?? [],
      );
      if (!writerContexts.some((writer) =>
        dominates(graph, writer.compiledNodeId, context.compiledNodeId),
      )) {
        findings.report(
          "compiled/initial-burette-reading-order-unproven",
          context,
          `initial burette measurement ${initialMeasurementId} has no dominating compiled instrument writer`,
          `The compiled graph does not prove an instrument-derived ${initialMeasurementId} before dispense ${context.compiledActionId}.`,
        );
      }
    }
    const closure = actionEvidenceClosure(action.id, actions);
    const closureActions = [...closure].map((actionId) => actions.get(actionId)).filter((candidate): candidate is ActionDefinition => Boolean(candidate));
    const directMeasurementGate = (action.prerequisites ?? []).some((rule) =>
      rule.type === "measurementRecorded" && rule.measurementId === initialMeasurementId,
    );
    const mounted = closureActions.some((candidate) => candidate.atomId === "atom.place.mount-burette");
    const charged = closureActions.some((candidate) => chargingAtoms.has(candidate.atomId ?? ""));
    if (!directMeasurementGate) {
      findings.report(
        "cycle09/dispense-ungated",
        context,
        `dispense lacks direct measurement gate for ${initialMeasurementId}`,
        `Compiled dispense ${context.compiledActionId} has no direct measurementRecorded prerequisite for ${initialMeasurementId}.`,
      );
    }
    if (!mounted) {
      findings.report(
        "cycle09/dispense-ungated",
        context,
        "dispense closure lacks a mounted burette",
        `Compiled dispense ${context.compiledActionId} has no action-evidence path to atom.place.mount-burette.`,
      );
    }
    if (!charged) {
      findings.report(
        "cycle09/dispense-ungated",
        context,
        "dispense closure lacks a charged receiver",
        `Compiled dispense ${context.compiledActionId} has no action-evidence path to an allowed receiver-charging action.`,
      );
    }
    if (!allActions.some((candidate) => candidate.atomId === "atom.place.mount-burette")) {
      findings.report(
        "cycle09/dispense-unreachable",
        context,
        "compiled context has no mount-burette action",
        `No compiled action in this witness mounts the burette required by ${context.compiledActionId}.`,
      );
    }
    if (!allActions.some((candidate) => chargingAtoms.has(candidate.atomId ?? ""))) {
      findings.report(
        "cycle09/dispense-unreachable",
        context,
        "compiled context has no receiver-charging action",
        `No compiled action in this witness prepares the receiver required by ${context.compiledActionId}.`,
      );
    }
  }
  if (dispensers.length > 1) {
    for (const context of contextsFor(contexts, (candidate) =>
      candidate.action?.verb === "observe" && paramsOf(candidate.action).tag === "endpoint",
    )) {
      findings.report(
        "cycle09/shared-endpoint-tag",
        context,
        "multiple compiled dispense actions share endpoint tag",
        `Compiled witness has ${dispensers.length} dispense actions while ${context.compiledActionId} uses the shared endpoint tag.`,
      );
    }
  }
  for (const context of dispensers) {
    const prose = `${context.node.title ?? ""} ${context.node.description ?? ""} ${(context.node.hints ?? []).join(" ")}`;
    if (/\b\d{2,}\s*(times|drops|clicks)\b/i.test(prose) || /\b\d+\.\d+\s*mL\b/.test(prose)) {
      findings.report(
        "cycle09/endpoint-disclosed-in-prose",
        context,
        "compiled dispense node discloses an endpoint quantity",
        `Compiled node ${context.compiledNodeId} exposes a numeric endpoint in learner-facing prose.`,
      );
    }
  }
};

const reportRecordedDistanceProvenance = (
  contexts: readonly InternalContext[],
  graph: AttemptGraph,
  findings: FindingCollector,
): void => {
  if (contexts.length === 0) return;
  const actions = actionMapFor(contexts[0].attempt);
  for (const context of contextsFor(contexts, (candidate) => candidate.action?.verb === "record")) {
    const params = paramsOf(context.action!);
    const measurementId = params.measurementId;
    const readActionId = params.readActionId;
    if (typeof measurementId !== "string" || typeof readActionId !== "string") continue;
    const producer = actions.get(readActionId);
    if (!producer || !writesMeasurement(producer, measurementId)) {
      findings.report(
        "cycle10/recorded-distance-has-no-reading",
        context,
        `recorded measurement ${measurementId} has no matching compiled read action`,
        `Compiled record ${context.compiledActionId} references ${readActionId}, but that compiled action does not write ${measurementId}.`,
      );
      continue;
    }
    const producerContexts = graph.contextsByActionId.get(producer.id) ?? [];
    if (!producerContexts.some((producerContext) =>
      dominates(graph, producerContext.compiledNodeId, context.compiledNodeId),
    )) {
      findings.report(
        "compiled/recorded-distance-order-unproven",
        context,
        `reading ${readActionId} does not dominate record ${context.compiledActionId}`,
        `The compiled graph does not prove reading ${readActionId} before record ${context.compiledActionId}.`,
      );
    }
  }
};

const contextsWithAtom = (contexts: readonly InternalContext[], atomId: string): InternalContext[] =>
  contextsFor(contexts, (context) => context.action?.atomId === atomId);

const reportCycle11CompiledOrder = (
  contexts: readonly InternalContext[],
  graph: AttemptGraph,
  findings: FindingCollector,
): void => {
  if (contexts.length === 0) return;
  const byAtom = (atomId: string) => contextsWithAtom(contexts, atomId);
  const collection = byAtom("atom.place.gas-collection-apparatus");
  const zeroes = byAtom("atom.observe.zero-gas-collection-instrument");
  for (const context of collection) {
    if (occurrenceCandidates(context, zeroes).length === 0) {
      findings.report(
        "cycle11/gas-collection-instrument-never-zeroed",
        context,
        "compiled gas-collection context has no zero action",
        `Compiled witness includes ${context.compiledActionId} but no atom.observe.zero-gas-collection-instrument action.`,
      );
    }
  }

  const kineticsOrder = [
    "atom.place.gas-delivery-train",
    "atom.observe.zero-gas-collection-instrument",
    "atom.transfer.initiate-solid-reactant-contact",
    "atom.place.gas-collection-apparatus",
    "atom.record.timed-gas-volume",
  ];
  for (let index = 1; index < kineticsOrder.length; index += 1) {
    const previous = byAtom(kineticsOrder[index - 1]);
    const current = byAtom(kineticsOrder[index]);
    if (previous.length === 0 || current.length === 0) continue;
    for (const context of current) {
      if (occurrenceCandidates(context, previous).some((candidate) =>
        dominates(graph, candidate.compiledNodeId, context.compiledNodeId),
      )) continue;
      findings.report(
        "cycle11/kinetics-chronology-out-of-order",
        context,
        `${kineticsOrder[index - 1]} does not dominate ${kineticsOrder[index]}`,
        `The compiled graph does not prove ${kineticsOrder[index - 1]} before ${kineticsOrder[index]} at node ${context.compiledNodeId}.`,
      );
    }
  }

  const contact = byAtom("atom.transfer.initiate-solid-reactant-contact");
  for (const beforeAtom of [
    "atom.measure.variable-volume",
    "atom.transfer.measured-liquid",
    "atom.weigh.solid-reactant-portion",
  ]) {
    const predecessors = byAtom(beforeAtom);
    if (predecessors.length === 0) continue;
    for (const context of contact) {
      if (occurrenceCandidates(context, predecessors).some((candidate) =>
        dominates(graph, candidate.compiledNodeId, context.compiledNodeId),
      )) continue;
      findings.report(
        "cycle11/reactant-preparation-after-contact",
        context,
        `${beforeAtom} does not dominate reactant contact`,
        `The compiled graph does not prove ${beforeAtom} before reactant-contact action ${context.compiledActionId}.`,
      );
    }
  }

  const meltingStages = byAtom("atom.place.melting-point-sample");
  for (const magnet of byAtom("atom.observe.test-magnetic-response")) {
    const vessel = paramsOf(magnet.action!).sourceInstanceId;
    if (typeof vessel !== "string") continue;
    if (!meltingStages.some((stage) =>
      paramsOf(stage.action!).sourceInstanceId === vessel && dominates(graph, stage.compiledNodeId, magnet.compiledNodeId),
    )) continue;
    findings.report(
      "cycle11/magnet-read-after-melting-stage",
      magnet,
      `melting stage for ${vessel} dominates magnetic read`,
      `Compiled graph places a melting-stage action for ${vessel} before magnetic read ${magnet.compiledActionId}.`,
    );
  }

  for (const disposal of byAtom("atom.transfer.dispose-to-waste-stream")) {
    for (const rule of disposal.action?.prerequisites ?? []) {
      if (rule.type !== "actionEvidence" || typeof rule.actionId !== "string") continue;
      const prerequisites = graph.contextsByActionId.get(rule.actionId) ?? [];
      if (prerequisites.some((candidate) => dominates(graph, candidate.compiledNodeId, disposal.compiledNodeId))) continue;
      findings.report(
        "cycle11/disposal-precedes-record",
        disposal,
        `required evidence action ${rule.actionId} does not dominate disposal`,
        `The compiled graph does not prove prerequisite action ${rule.actionId} before disposal ${disposal.compiledActionId}.`,
      );
    }
  }

  const vesselOwners = new Map<string, InternalContext[]>();
  for (const sample of byAtom("atom.transfer.microsample-portion")) {
    const vessel = paramsOf(sample.action!).targetInstanceId;
    if (typeof vessel === "string") vesselOwners.set(vessel, [...(vesselOwners.get(vessel) ?? []), sample]);
  }
  for (const [vessel, rows] of vesselOwners) {
    if (rows.length < 2) continue;
    for (const context of rows) {
      findings.report(
        "cycle11/test-vessel-shared-between-samples",
        context,
        `multiple compiled microsample actions target ${vessel}`,
        `Compiled witness maps ${rows.length} microsample actions to test vessel ${vessel}.`,
      );
    }
  }
};

const selectedValueForSlot = (
  source: LabCompositionSourceDefinition,
  instanceId: string,
  slotId: string,
  fallback: unknown,
): unknown => {
  const instance = source.techniqueInstances.find((candidate) => candidate.instanceId === instanceId);
  return instance?.bindings.configuration[slotId] ?? fallback;
};

const branchOutcome = (
  source: LabCompositionSourceDefinition,
  witness: LabCompositionSourceDefinition["reachabilityWitnesses"][number],
  predicate: { kind: "configuration"; instanceId: string; slotId: string; equals: string | number | boolean } | {
    kind: "approval"; instanceId: string; gateId: string; equals: boolean;
  },
): boolean => {
  if (predicate.kind === "approval") {
    return witness.approvalGates[`${predicate.instanceId}.${predicate.gateId}`] === predicate.equals;
  }
  const instance = source.techniqueInstances.find((candidate) => candidate.instanceId === predicate.instanceId);
  const selected = witness.configuration[`${predicate.instanceId}.${predicate.slotId}`] ??
    instance?.bindings.configuration[predicate.slotId];
  return selected === predicate.equals;
};

/**
 * These host-owned instances intentionally bind one role-specific value rather than exposing the
 * whole reusable technique enum. Keep this allowlist narrow: generic fixtures and other hosted
 * instances must continue to report missing finite values until a witness covers them.
 */
const FIXED_ROLE_CONFIGURATION_SLOTS = new Set([
  "bonding-unknown-solids|bonding-solids-tests|sampleMode",
  "crystal-violet-rate-law|crystal-violet-kinetics|selectedProcedure",
  "crystal-violet-rate-law|crystal-violet-integrated-rate-law-comparison|selectedProcedure",
  "hard-water-demo|filtration|filtrationMode",
  "intro-filtration-demo|filtration|filtrationMode",
  "marble-statue-kinetics|marble-gas-syringe-kinetics|selectedProcedure",
]);

const reportUnrepresentedConfigurations = (
  input: CompiledDiagnosticsInput,
  statuses: CompiledDiagnosticStatusRecord[],
): {
  unrepresented: CompiledDiagnosticStatusRecord[];
  fixedRole: CompiledDiagnosticStatusRecord[];
  representativeContinuous: CompiledDiagnosticStatusRecord[];
} => {
  const unrepresented: CompiledDiagnosticStatusRecord[] = [];
  const fixedRole: CompiledDiagnosticStatusRecord[] = [];
  const representativeContinuous: CompiledDiagnosticStatusRecord[] = [];
  const techniquesByExactVersion = new Map(input.techniques.map((technique) => [
    keyOf(technique.id, technique.metadata.version),
    technique,
  ]));
  const recordUnrepresented = (detail: string, labId: string): void => {
    const status: CompiledDiagnosticStatusRecord = {
      status: "unrepresented-configuration",
      labId,
      detail,
    };
    unrepresented.push(status);
    statuses.push(status);
  };
  const recordFixedRole = (detail: string, labId: string): void => {
    const status: CompiledDiagnosticStatusRecord = {
      status: "fixed-role-configuration",
      labId,
      detail,
    };
    fixedRole.push(status);
    statuses.push(status);
  };
  const recordNotApplicable = (detail: string, labId: string, rule: string): void => {
    statuses.push({
      status: "not-applicable",
      labId,
      rule,
      detail,
    });
  };
  const recordRepresentativeContinuous = (detail: string, labId: string): void => {
    const status: CompiledDiagnosticStatusRecord = {
      status: "representative-continuous-configuration",
      labId,
      detail,
    };
    representativeContinuous.push(status);
    statuses.push(status);
  };
  const finiteNumber = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);
  for (const { source: rawSource, collection } of input.labs) {
    const source = collection.effectiveSource;
    const selectedWitnessIdSet = new Set(collection.selectedWitnessIds);
    const selectedWitnesses = source.reachabilityWitnesses.filter((witness) =>
      selectedWitnessIdSet.has(witness.id),
    );
    const omittedWitnessIds = collection.declaredWitnessIds.filter((witnessId) =>
      !selectedWitnessIdSet.has(witnessId),
    );
    if (omittedWitnessIds.length > 0) {
      recordUnrepresented(
        `Declared witnesses ${JSON.stringify(omittedWitnessIds)} were not selected for compilation.`,
        rawSource.id,
      );
    }
    const inspectedExactTechniqueVersions = new Set<string>();
    for (const instance of source.techniqueInstances) {
      const exactTechniqueKey = keyOf(instance.techniqueId, instance.version);
      const technique = techniquesByExactVersion.get(exactTechniqueKey);
      if (!technique || !technique.composition) {
        statuses.push({
          status: "unresolved-template",
          labId: source.id,
          detail: `Cannot inspect coverage for ${instance.instanceId}: ${instance.techniqueId}@${instance.version} is not an exact composable technique definition.`,
        });
        continue;
      }
      if (!inspectedExactTechniqueVersions.has(exactTechniqueKey)) {
        inspectedExactTechniqueVersions.add(exactTechniqueKey);
        const selectedVariantIds = new Set(
          source.techniqueInstances
            .filter((candidate) =>
              candidate.techniqueId === technique.id && candidate.version === technique.metadata.version,
            )
            .map((candidate) => candidate.variantId)
            .filter((variantId): variantId is string => typeof variantId === "string" && variantId.trim().length > 0),
        );
        for (const variant of technique.composition.variants) {
          if (selectedVariantIds.has(variant.id)) continue;
          const hostPredicate = source.compositionConnections.some((connection) => {
            const predicate = connection.enabledWhen;
            if (!predicate || predicate.kind !== variant.enabledWhen.kind) return false;
            if (predicate.kind === "approval" || variant.enabledWhen.kind === "approval") {
              return predicate.kind === "approval" &&
                variant.enabledWhen.kind === "approval" &&
                predicate.gateId === variant.enabledWhen.gateId &&
                predicate.equals === variant.enabledWhen.equals &&
                source.techniqueInstances.some((candidate) =>
                  candidate.instanceId === predicate.instanceId &&
                  candidate.techniqueId === technique.id &&
                  candidate.version === technique.metadata.version,
                );
            }
            return predicate.slotId === variant.enabledWhen.slotId &&
              predicate.equals === variant.enabledWhen.equals &&
              source.techniqueInstances.some((candidate) =>
                candidate.instanceId === predicate.instanceId &&
                candidate.techniqueId === technique.id &&
                candidate.version === technique.metadata.version,
              );
          });
          if (hostPredicate) {
            const represented = source.techniqueInstances
              .filter((candidate) =>
                candidate.techniqueId === technique.id && candidate.version === technique.metadata.version,
              )
              .some((candidate) => selectedWitnesses.some((witness) =>
                branchOutcome(source, witness, variant.enabledWhen.kind === "approval"
                  ? { ...variant.enabledWhen, instanceId: candidate.instanceId }
                  : { ...variant.enabledWhen, instanceId: candidate.instanceId }),
              ));
            if (represented) {
              recordFixedRole(
                `Declared variant ${technique.id}@${technique.metadata.version}.${variant.id} is represented by host connection predicates and witness configuration values; the host carrier intentionally leaves variantId unset on the shared instance.`,
                source.id,
              );
              continue;
            }
          }
          recordUnrepresented(
            `Declared variant ${technique.id}@${technique.metadata.version}.${variant.id} has no exact lab instance with variantId "${variant.id}"; matching witness configuration values do not select a variant.`,
            source.id,
          );
        }
      }
      for (const slot of technique.composition.configurationSlots) {
        const values = selectedWitnesses.map((witness) => {
          const explicit = witness.configuration[`${instance.instanceId}.${slot.id}`];
          return explicit ?? selectedValueForSlot(source, instance.instanceId, slot.id, slot.defaultValue);
        });
        const distinctValues = [...new Set(values.filter((value) => present(value)).map((value) => JSON.stringify(value)))];
        const selectedValues = distinctValues.map((value) => JSON.parse(value) as string | number | boolean);
        if (slot.valueType === "number" && (!slot.allowedValues || slot.allowedValues.length === 0)) {
          const representatives = selectedValues.filter(finiteNumber);
          if (representatives.length > 0) {
            recordRepresentativeContinuous(
              `Continuous numeric configuration ${instance.instanceId}.${slot.id} has finite representative witness values ${JSON.stringify(representatives)}; coverage is static-only and non-exhaustive.`,
              source.id,
            );
          } else {
            recordUnrepresented(
              `Continuous numeric configuration ${instance.instanceId}.${slot.id} has no finite representative witness value.`,
              source.id,
            );
          }
        }
        if (slot.allowedValues && slot.allowedValues.length > 0) {
          const declaredValues = slot.valueType === "number"
            ? slot.allowedValues.filter(finiteNumber)
            : slot.allowedValues;
          const invalidNumericDeclaredValues = slot.valueType === "number"
            ? slot.allowedValues.filter((candidate) => !finiteNumber(candidate))
            : [];
          if (invalidNumericDeclaredValues.length > 0) {
            recordUnrepresented(
              `Numeric configuration ${instance.instanceId}.${slot.id} declares non-finite values ${JSON.stringify(invalidNumericDeclaredValues)} instead of finite coverage values.`,
              source.id,
            );
          }
          const missing = declaredValues.filter((candidate) =>
            !selectedValues.some((selected) => selected === candidate),
          );
          if (missing.length > 0) {
            const authoredValue = instance.bindings.configuration[slot.id];
            const fixedRoleSlot = FIXED_ROLE_CONFIGURATION_SLOTS.has(
              `${source.id}|${technique.id}|${slot.id}`,
            ) && present(authoredValue) && selectedWitnesses.every((witness) => {
              const explicit = witness.configuration[`${instance.instanceId}.${slot.id}`];
              return !present(explicit) || explicit === authoredValue;
            });
            if (fixedRoleSlot) {
              recordFixedRole(
                `Configuration ${instance.instanceId}.${slot.id} is authored as the fixed host role value ${JSON.stringify(authoredValue)}; declared values ${JSON.stringify(missing)} belong to other role-specific instances or hosted scenarios and are not selectable on this instance.`,
                source.id,
              );
            } else {
              recordUnrepresented(
                `Configuration ${instance.instanceId}.${slot.id} omits declared values ${JSON.stringify(missing)} from its witnesses.`,
                source.id,
              );
            }
          }
        }
      }
      for (const gate of technique.composition.approvalGates) {
        const gateIsReferencedByInstance =
          (instance.enabledWhen?.kind === "approval" && instance.enabledWhen.gateId === gate.id) ||
          technique.composition.variants.some((variant) =>
            instance.variantId === variant.id &&
            variant.enabledWhen.kind === "approval" &&
            variant.enabledWhen.gateId === gate.id,
          ) ||
          source.compositionConnections.some((connection) =>
            connection.enabledWhen?.kind === "approval" &&
            connection.enabledWhen.instanceId === instance.instanceId &&
            connection.enabledWhen.gateId === gate.id,
          );
        if (!gateIsReferencedByInstance) {
          recordNotApplicable(
            `Approval ${instance.instanceId}.${gate.id} is declared by the reusable technique but is not referenced by this host instance or any host branch predicate; approval coverage belongs to the branch instance that owns the gate.`,
            source.id,
            "compiled/approval-gate-not-applicable-to-instance",
          );
          continue;
        }
        const values = new Set(selectedWitnesses.map((witness) =>
          witness.approvalGates[`${instance.instanceId}.${gate.id}`],
        ));
        if (!values.has(true) || !values.has(false)) {
          recordUnrepresented(
            `Approval ${instance.instanceId}.${gate.id} has declared witness values ${JSON.stringify([...values])}; both outcomes are not represented.`,
            source.id,
          );
        }
      }
      const branchPredicates: Array<{
        label: string;
        predicate: { kind: "configuration"; instanceId: string; slotId: string; equals: string | number | boolean } | {
          kind: "approval"; instanceId: string; gateId: string; equals: boolean;
        };
      }> = [];
      if (instance.enabledWhen) {
        branchPredicates.push({ label: `instance ${instance.instanceId}`, predicate: instance.enabledWhen });
      }
      if (instance.variantId) {
        const variant = technique.composition.variants.find((candidate) => candidate.id === instance.variantId);
        if (variant) {
          branchPredicates.push({
            label: `variant ${instance.instanceId}.${variant.id}`,
            predicate: variant.enabledWhen.kind === "configuration"
              ? { ...variant.enabledWhen, instanceId: instance.instanceId }
              : { ...variant.enabledWhen, instanceId: instance.instanceId },
          });
        }
      }
      for (const { label, predicate } of branchPredicates) {
        const outcomes = new Set(selectedWitnesses.map((witness) =>
          branchOutcome(source, witness, predicate),
        ));
        if (!outcomes.has(true) || !outcomes.has(false)) {
          recordUnrepresented(
            `${label} predicate ${JSON.stringify(predicate)} has declared outcomes ${JSON.stringify([...outcomes])}; both outcomes are not represented.`,
            source.id,
          );
        }
      }
    }
    for (const connection of source.compositionConnections) {
      if (!connection.enabledWhen) continue;
      const outcomes = new Set(selectedWitnesses.map((witness) =>
        branchOutcome(source, witness, connection.enabledWhen!),
      ));
      if (!outcomes.has(true) || !outcomes.has(false)) {
        recordUnrepresented(
          `connection ${connection.id ?? `${connection.from.kind}->${connection.to.kind}`} predicate ${JSON.stringify(connection.enabledWhen)} has declared outcomes ${JSON.stringify([...outcomes])}; both outcomes are not represented.`,
          source.id,
        );
      }
    }
  }
  return { unrepresented, fixedRole, representativeContinuous };
};

const sortStatusRecords = (records: readonly CompiledDiagnosticStatusRecord[]): CompiledDiagnosticStatusRecord[] =>
  [...records].sort((left, right) => keyOf(
    left.status,
    left.labId,
    left.witnessId,
    left.rule,
    left.contextKey,
    left.detail,
  ).localeCompare(keyOf(
    right.status,
    right.labId,
    right.witnessId,
    right.rule,
    right.contextKey,
    right.detail,
  )));

const probeStatus = (
  evaluatedContextCount: number,
  attempts: readonly CompiledWitnessAttempt[],
): CompiledDiagnosticStatus => {
  if (evaluatedContextCount > 0) return "inconclusive-static-only";
  // A failed unrelated witness cannot identify which probe would have applied, so absence from the
  // successfully compiled subset is inconclusive rather than a probe-specific compile failure.
  return attempts.some((attempt) => attempt.status !== "compiled")
    ? "inconclusive-static-only"
    : "not-applicable";
};

/**
 * Evaluate composition-dependent checks only against in-memory compiler output. This is source and
 * graph analysis, not a claim that a learner traversed a branch or produced a measurement at runtime.
 */
export const evaluateCompiledWitnessDiagnostics = (
  input: CompiledDiagnosticsInput,
): CompiledDiagnosticsResult => {
  const statuses: CompiledDiagnosticStatusRecord[] = [];
  const contexts: InternalContext[] = [];
  const findings = new FindingCollector();
  const allAttempts = input.labs.flatMap(({ collection }) => collection.attempts);
  const techniquesById = new Map(input.techniques.map((technique) => [technique.id, technique]));
  const compiledLabIds = new Set<string>();
  const compiledTechniqueIds = new Set<string>();
  const compiledTechniqueVersions = new Set<string>();
  const mappingFailedLabIds = new Set<string>();
  const probeCounts = {
    wavelength: { evaluated: 0, findings: 0 },
    blanking: { evaluated: 0, findings: 0 },
    cuvette: { evaluated: 0, findings: 0 },
    solvent: { evaluated: 0, findings: 0 },
  };

  for (const { collection } of input.labs) {
    const source = collection.effectiveSource;
    for (const attempt of collection.attempts) {
      if (attempt.status !== "compiled") {
        statuses.push({
          status: attempt.status,
          labId: attempt.labId,
          witnessId: attempt.witnessId,
          detail: attempt.error,
          setupFixtureId: attempt.setupFixtureId,
        });
        continue;
      }
      compiledLabIds.add(source.id);
      for (const instance of attempt.manifest.instances) {
        compiledTechniqueIds.add(instance.techniqueId);
        compiledTechniqueVersions.add(keyOf(instance.techniqueId, instance.version));
      }
      const statusCountBeforeMapping = statuses.length;
      const attemptContexts = buildAttemptContexts(
        source,
        collection.sourceInstanceScopes,
        attempt,
        techniquesById,
        statuses,
      );
      contexts.push(...attemptContexts);
      const graph = buildAttemptGraph(attempt, attemptContexts);
      reportManifestEvidenceReferences(attempt, graph, statuses);
      if (statuses.slice(statusCountBeforeMapping).some((status) => status.status === "unresolved-origin")) {
        mappingFailedLabIds.add(source.id);
      }
      reportConcreteEquipmentReferences(attemptContexts, findings);

      const photometerContexts = contextsFor(attemptContexts, (context) => {
        const operation = paramsOf(context.action!).photometerOperation;
        return operation === "read" || operation === "zero";
      });
      probeCounts.wavelength.evaluated += photometerContexts.length;
      probeCounts.blanking.evaluated += photometerContexts.filter((context) =>
        paramsOf(context.action!).photometerOperation === "read" && typeof paramsOf(context.action!).requiresZeroNotebookTag === "string",
      ).length;
      probeCounts.cuvette.evaluated += photometerContexts.filter((context) =>
        paramsOf(context.action!).photometerOperation === "read" && typeof paramsOf(context.action!).cuvetteInstanceId === "string",
      ).length;
      probeCounts.solvent.evaluated += contextsFor(attemptContexts, (context) =>
        present(paramsOf(context.action!).chromatographyMeasurementType),
      ).length;

      const beforeWavelength = findings.contextFindings.size;
      reportWavelengthAndBlanking(attemptContexts, graph, findings);
      const afterWavelength = findings.contextFindings.size;
      const wavelengthFindings = [...findings.contextFindings.values()].slice(beforeWavelength, afterWavelength);
      probeCounts.wavelength.findings += wavelengthFindings.filter((finding) =>
        finding.rule === "cycle06/photometer-wavelength-unproduced" ||
        finding.rule === "compiled/calibration-blanking-wavelength-substitution" ||
        finding.rule === "compiled/photometer-wavelength-order-unproven",
      ).length;
      probeCounts.blanking.findings += wavelengthFindings.filter((finding) =>
        finding.rule.startsWith("compiled/calibration-blanking-"),
      ).length;

      const beforeCuvette = findings.contextFindings.size;
      reportCuvetteIdentity(attemptContexts, graph, findings);
      probeCounts.cuvette.findings += findings.contextFindings.size - beforeCuvette;
      const beforeSolvent = findings.contextFindings.size;
      reportSolventBeforeReading(attemptContexts, graph, findings);
      probeCounts.solvent.findings += findings.contextFindings.size - beforeSolvent;
      reportTitrationContexts(attemptContexts, graph, findings);
      reportRecordedDistanceProvenance(attemptContexts, graph, findings);
      reportCycle11CompiledOrder(attemptContexts, graph, findings);
    }
  }

  const configurationCoverage = reportUnrepresentedConfigurations(input, statuses);
  const unrepresentedConfigurations = configurationCoverage.unrepresented;
  const fixedRoleConfigurations = configurationCoverage.fixedRole;
  const untrustworthyLabIds = new Set<string>(mappingFailedLabIds);
  for (const { collection } of input.labs) {
    const source = collection.effectiveSource;
    if (collection.attempts.some((attempt) => attempt.status !== "compiled") ||
      collection.selectedWitnessIds.length !== collection.declaredWitnessIds.length ||
      unrepresentedConfigurations.some((record) => record.labId === source.id)) {
      untrustworthyLabIds.add(source.id);
    }
  }
  const untrustworthyTechniqueIds = new Set(input.labs.flatMap(({ collection }) => {
    const source = collection.effectiveSource;
    return untrustworthyLabIds.has(source.id)
      ? source.techniqueInstances.map((instance) => instance.techniqueId)
      : [];
  }));
  const authoringSurfaceCounts = input.techniqueSurfaces.reduce<Map<string, number>>((counts, surface) => {
    counts.set(surface.id, (counts.get(surface.id) ?? 0) + 1);
    return counts;
  }, new Map());
  for (const [techniqueId, count] of authoringSurfaceCounts) {
    if (count > 1) untrustworthyTechniqueIds.add(techniqueId);
  }
  const authoringFindings = findings.authoringFindings();
  const contextFindings = [...findings.contextFindings.values()].sort((left, right) =>
    keyOf(left.rule, left.context.contextKey, left.normalizedCause).localeCompare(
      keyOf(right.rule, right.context.contextKey, right.normalizedCause),
    ));
  const affectedActionKeys = new Set(contextFindings.map((finding) => finding.context.compiledActionOccurrenceKey));
  const affectedNodeIds = new Set(contextFindings.map((finding) => keyOf(
    finding.context.labId,
    finding.context.witnessId,
    finding.context.compiledNodeId,
  )));
  const byStatus = allAttempts.reduce<Record<string, number>>((totals, attempt) => {
    totals[attempt.status] = (totals[attempt.status] ?? 0) + 1;
    return totals;
  }, {});
  const sourceInstanceScopes = input.labs.flatMap(({ collection }) =>
    collection.sourceInstanceScopes.map((scope) => ({ labId: collection.effectiveSource.id, ...scope })),
  ).sort((left, right) => keyOf(
    left.labId,
    left.declaredInstanceId,
    left.repeatIndex,
  ).localeCompare(keyOf(
    right.labId,
    right.declaredInstanceId,
    right.repeatIndex,
  )));
  const unconsumedAuthoringSurfaces = input.techniqueSurfaces
    .filter((surface) => {
      if (!compiledTechniqueVersions.has(keyOf(surface.id, surface.version))) return true;
      return (authoringSurfaceCounts.get(surface.id) ?? 0) > 1 && !surface.indexed;
    })
    .map((surface) => ({ ...surface, status: "unconsumed-authoring-surface" as const }))
    .sort((left, right) => left.id.localeCompare(right.id));
  for (const surface of unconsumedAuthoringSurfaces) {
    statuses.push({
      status: "unconsumed-authoring-surface",
      detail: `${surface.id}@${surface.version} has no current compiled occurrence; its ${surface.actionIds.length} raw actions remain on the raw/template diagnostic path.`,
    });
  }
  const staticBoundaries: CompiledDiagnosticStatusRecord[] = [
    {
      status: "inconclusive-static-only",
      rule: "branch-ordering-and-runtime-dominance",
      detail: "Graph dominance can disprove a guaranteed producer-before-consumer relation, but does not prove a learner traversed a branch, satisfied a prerequisite, or produced evidence at runtime.",
    },
    {
      status: "inconclusive-static-only",
      rule: "brass-spectrophotometer-scan-validity",
      detail: "The brass source establishes the 400-700 nm scan at 20 nm intervals and a later approved-wavelength 0%T/100%T calibration pair, but not the instrument-specific reference/zero conditioning during the scan. Without the classroom SPEC 20 manual or local SOP, source silence is not a scan-validity clearance.",
    },
  ];
  const notApplicable: CompiledDiagnosticStatusRecord[] = [
    {
      status: "not-applicable",
      rule: "registry-and-asset-integrity",
      detail: "Registry, asset, source-pointer, and visual-state rules have no compiled-instance predicate and remain raw/template checks.",
    },
    {
      status: "not-applicable",
      rule: "runtime-and-physical-claims",
      detail: "Compiled graphs do not prove learner traversal, instrument response, timing, measurement truth, or physical validity.",
    },
  ];
  statuses.push(...staticBoundaries, ...notApplicable);
  const incompleteAttemptCount = allAttempts.filter((attempt) => attempt.status !== "compiled").length;
  const incompleteProbeBoundary = incompleteAttemptCount > 0
    ? ` ${incompleteAttemptCount} declared witness context(s) did not compile, so absence in successful contexts is not a clearance.`
    : "";

  const probes: CompiledProbeResult[] = [
    {
      id: "wavelength-substitution",
      status: probeStatus(probeCounts.wavelength.evaluated, allAttempts),
      evaluatedContextCount: probeCounts.wavelength.evaluated,
      staticFindingCount: probeCounts.wavelength.findings,
      boundary: `Final compiled identities and producer dominance were compared; this does not prove a wavelength was produced or accepted at runtime.${incompleteProbeBoundary}`,
    },
    {
      id: "calibration-blanking-order",
      status: probeStatus(probeCounts.blanking.evaluated, allAttempts),
      evaluatedContextCount: probeCounts.blanking.evaluated,
      staticFindingCount: probeCounts.blanking.findings,
      boundary: `Graph dominance can expose an absent or non-dominating blanking step, but cannot prove a physical blank was performed.${incompleteProbeBoundary}`,
    },
    {
      id: "cuvette-identity",
      status: probeStatus(probeCounts.cuvette.evaluated, allAttempts),
      evaluatedContextCount: probeCounts.cuvette.evaluated,
      staticFindingCount: probeCounts.cuvette.findings,
      boundary: `Compiled instance references and graph order were inspected; bench state changes and runtime slot behavior remain unverified.${incompleteProbeBoundary}`,
    },
    {
      id: "solvent-before-reading",
      status: probeStatus(probeCounts.solvent.evaluated, allAttempts),
      evaluatedContextCount: probeCounts.solvent.evaluated,
      staticFindingCount: probeCounts.solvent.findings,
      boundary: `Compiled chromatography dependencies, concrete chamber identities, and graph dominance were inspected; solvent behavior and learner sequencing remain runtime/physical questions.${incompleteProbeBoundary}`,
    },
  ];

  return {
    schema: "lab-studio/compiled-content-diagnostics@1",
    validationBoundary: "Source/static compilation and graph inspection only; no runtime session, browser, build, detailed test, physical procedure, or measurement outcome is established.",
    coverage: {
      declaredWitnessCount: input.labs.reduce((total, { collection }) => total + collection.declaredWitnessIds.length, 0),
      selectedWitnessCount: input.labs.reduce((total, { collection }) => total + collection.selectedWitnessIds.length, 0),
      attemptedContextCount: allAttempts.length,
      compiledContextCount: allAttempts.filter((attempt) => attempt.status === "compiled").length,
      evaluatedNodeContextCount: contexts.length,
      byStatus,
      unrepresentedConfigurations: sortStatusRecords(unrepresentedConfigurations),
      fixedRoleConfigurations: sortStatusRecords(fixedRoleConfigurations),
      representativeContinuousConfigurations: sortStatusRecords(
        configurationCoverage.representativeContinuous,
      ),
    },
    sourceInstanceScopes,
    contexts: contexts.map(serializeContext).sort((left, right) => left.contextKey.localeCompare(right.contextKey)),
    statuses: sortStatusRecords(statuses),
    findings: {
      authoring: authoringFindings,
      contexts: contextFindings,
      counts: {
        uniqueRawAuthoringFindings: authoringFindings.length,
        uniqueCompiledContextFindings: contextFindings.length,
        affectedCompiledActions: affectedActionKeys.size,
        affectedCompiledNodes: affectedNodeIds.size,
      },
    },
    probes,
    impact: {
      compiledLabIds: [...compiledLabIds].sort(),
      compiledTechniqueIds: [...compiledTechniqueIds].sort(),
      unconsumedAuthoringSurfaces,
    },
    routing: {
      contextRuleIds: [...COMPOSITION_CONTEXT_RULE_IDS],
      routableLabIds: [...compiledLabIds].filter((labId) => !untrustworthyLabIds.has(labId)).sort(),
      routableTechniqueIds: [...compiledTechniqueIds]
        .filter((techniqueId) => !untrustworthyTechniqueIds.has(techniqueId))
        .sort(),
      untrustworthyLabIds: [...untrustworthyLabIds].sort(),
      untrustworthyTechniqueIds: [...untrustworthyTechniqueIds].sort(),
      legacyTechniqueIds: [...new Set(input.legacyTechniqueIds ?? [])].sort(),
    },
    notApplicable,
  };
};

/**
 * Keep raw findings when no trustworthy compiled context exists, or when a technique still serves
 * a legacy action-only import. This prevents an attempted compiler pass from silently erasing debt.
 */
export interface RawCompositionRoutingDisposition {
  routeToCompiledContexts: boolean;
  evaluationScope:
    | "raw-template-rule"
    | "compiled-context-replacement"
    | "raw-template-legacy-import"
    | "raw-template-inconclusive-compiled-coverage"
    | "raw-template-no-compiled-consumer";
  detail: string;
}

export const rawCompositionRoutingDisposition = (
  violation: { rule: string; scope: string },
  routing: CompiledDiagnosticsResult["routing"],
): RawCompositionRoutingDisposition => {
  if (!(COMPOSITION_CONTEXT_RULE_IDS as readonly string[]).includes(violation.rule)) {
    return {
      routeToCompiledContexts: false,
      evaluationScope: "raw-template-rule",
      detail: "This rule is an authoring/template rule and is not replaced by compiled contexts.",
    };
  }
  const owner = violation.scope.split("/")[0] ?? "";
  if (owner.startsWith("lab:")) {
    const labId = owner.slice("lab:".length);
    if (routing.routableLabIds.includes(labId)) {
      return {
        routeToCompiledContexts: true,
        evaluationScope: "compiled-context-replacement",
        detail: "Every selected declared witness compiled with trustworthy origin mapping and represented configuration coverage; any continuous numeric coverage is representative/static-only, not an exhaustive domain claim.",
      };
    }
    return {
      routeToCompiledContexts: false,
      evaluationScope: routing.untrustworthyLabIds.includes(labId)
        ? "raw-template-inconclusive-compiled-coverage"
        : "raw-template-no-compiled-consumer",
      detail: routing.untrustworthyLabIds.includes(labId)
        ? "The raw result is retained as an authoring/template diagnosis because compiled witness, origin, or configuration coverage is incomplete; it is not presented as a concrete compiled-lab fact."
        : "No trustworthy compiled lab context replaces this authoring/template diagnosis.",
    };
  }
  if (owner.startsWith("technique:")) {
    const techniqueId = owner.slice("technique:".length);
    if (routing.legacyTechniqueIds.includes(techniqueId)) {
      return {
        routeToCompiledContexts: false,
        evaluationScope: "raw-template-legacy-import",
        detail: "This technique still serves a legacy action-only import, so its raw authoring diagnosis remains authoritative for that compatibility surface.",
      };
    }
    if (routing.routableTechniqueIds.includes(techniqueId)) {
      return {
        routeToCompiledContexts: true,
        evaluationScope: "compiled-context-replacement",
        detail: "All declared consuming contexts are represented by trustworthy compiled witness and origin coverage; any continuous numeric coverage is representative/static-only, not an exhaustive domain claim.",
      };
    }
    return {
      routeToCompiledContexts: false,
      evaluationScope: routing.untrustworthyTechniqueIds.includes(techniqueId)
        ? "raw-template-inconclusive-compiled-coverage"
        : "raw-template-no-compiled-consumer",
      detail: routing.untrustworthyTechniqueIds.includes(techniqueId)
        ? "The raw result is retained as an authoring/template diagnosis because at least one declared consumer has incomplete compiled witness, origin, or configuration coverage; it is not presented as a concrete compiled-instance fact."
        : "The technique has no trustworthy current compiled consumer, so its raw authoring diagnosis remains visible.",
    };
  }
  return {
    routeToCompiledContexts: false,
    evaluationScope: "raw-template-no-compiled-consumer",
    detail: "The raw finding has no routable lab or technique owner.",
  };
};

export const shouldRouteRawCompositionViolation = (
  violation: { rule: string; scope: string },
  routing: CompiledDiagnosticsResult["routing"],
): boolean => rawCompositionRoutingDisposition(violation, routing).routeToCompiledContexts;
