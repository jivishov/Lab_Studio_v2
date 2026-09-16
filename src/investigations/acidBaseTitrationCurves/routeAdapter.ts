import type {
  LabDefinition,
  RouteTechniqueExecutionAdapter,
  RouteTechniqueExecutionEvidence,
  RouteTechniqueExecutionIntent,
  RouteTechniqueExecutionRejection,
  RouteTechniqueExecutionTarget,
} from "../../domain/types";
import {
  validateRouteTechniqueExecutionIntent,
  validateRouteTechniqueExecutionTargets,
} from "../shared/routeTechniqueExecution";

/** The single compiled technique instance this route drives. */
export const FORMAL_INSTANCE_ID = "formal-trial";
/** Scope name for the lab-owned nonphysical nodes of the compiled root process. */
export const LAB_ORCHESTRATION_INSTANCE_ID = "lab-orchestration";

export type AcidBaseRouteContext =
  | "strong-acid-strong-base"
  | "weak-acid-strong-base"
  | "weak-base-strong-acid";

export const ACID_BASE_ROUTE_CONTEXTS: readonly AcidBaseRouteContext[] = [
  "strong-acid-strong-base",
  "weak-acid-strong-base",
  "weak-base-strong-acid",
];

export const isAcidBaseRouteContext = (value: string): value is AcidBaseRouteContext =>
  (ACID_BASE_ROUTE_CONTEXTS as readonly string[]).includes(value);

export interface AcidBaseRouteState {
  /** Compiled witness context whose evidence this state holds, once a formal action has run. */
  context?: AcidBaseRouteContext;
  completedActionIds: string[];
  evidence: RouteTechniqueExecutionEvidence[];
  lastRejection?: RouteTechniqueExecutionRejection;
}

/**
 * Declared independently of the compiler so that a drift between this route and the
 * compiled formal trial is a hard target-validation error rather than a silent skip.
 */
const FORMAL_ACTION_IDS = [
  "formal-trial-place-ring-stand",
  "formal-trial-mount-burette",
  "formal-trial-condition-burette-drain-residual",
  "formal-trial-condition-burette",
  "formal-trial-condition-burette-discard-rinsate",
  "formal-trial-seat-burette-funnel",
  "formal-trial-fill-burette",
  "formal-trial-fill-burette-purge-tip",
  "formal-trial-fill-burette-check-tip",
  "formal-trial-remove-burette-funnel",
  "formal-trial-read-initial-burette",
  "formal-trial-record-initial-burette",
  "formal-trial-measure-analyte",
  "formal-trial-transfer-analyte-to-receiver",
  "formal-trial-position-flask-under-burette",
  "formal-trial-probe-ready",
  "formal-trial-place-ph-meter-on-workbench",
  "formal-trial-immerse-endpoint-ph-probe",
  "formal-trial-inspect-prepared-analyte",
  "formal-trial-initial-ph",
  "formal-trial-initial-row",
  "formal-trial-deliver-titrant",
  "formal-trial-deliver-titrant-mix",
  "formal-trial-deliver-titrant-observe",
  "formal-trial-deliver-titrant-read-ph",
  "formal-trial-deliver-titrant-record-point",
  "formal-trial-deliver-titrant-decide",
  "formal-trial-deliver-titrant-read-final",
  "formal-trial-record-final-burette",
  "formal-trial-dispose",
  "formal-trial-dispose-rinse",
  "formal-trial-dispose-discard-rinse",
  "formal-trial-deliver-titrant-retry-dispose",
  "formal-trial-deliver-titrant-retry-dispose-rinse",
  "formal-trial-deliver-titrant-retry-dispose-discard-rinse",
  "formal-trial-deliver-titrant-retry-reset",
] as const;

/** Lab-owned nonphysical nodes of the compiled root process, in compiled order. */
export const LAB_NODE_ACTION_IDS = [
  "ACID-PLAN-01",
  "ACID-ANALYSIS-01",
  "ACID-UNCERTAINTY-01",
  "ACID-CLEANUP-01",
] as const;

export type LabNodeActionId = (typeof LAB_NODE_ACTION_IDS)[number];

export const PLAN_ACTION_ID: LabNodeActionId = "ACID-PLAN-01";

const formalEvidenceByAction: Readonly<Record<string, string[]>> = {
  "formal-trial-initial-row": ["formal-trial--formal-initial-point-evidence"],
  "formal-trial-deliver-titrant-record-point": ["formal-trial--formal-curve-point-evidence"],
  "formal-trial-deliver-titrant-decide": ["formal-trial--formal-curve-stability-evidence"],
  "formal-trial-record-final-burette": ["formal-trial--formal-final-burette-evidence"],
};

/** Authored decisions of the compiled endpoint node; the compiled action is the authority. */
export const CONTINUE_DELIVERY = "Continue delivery";
export const FINISH_AFTER_STABILITY_REVIEW = "Finish after stability review";
export const DISPOSE_AND_RESTART_TRIAL = "Dispose and restart trial";

export const ACID_BASE_ROUTE_EXECUTION_TARGETS: readonly RouteTechniqueExecutionTarget[] =
  FORMAL_ACTION_IDS.map((actionId) => ({
    techniqueId: "ph-volume-formal-titration-trial",
    techniqueVersion: "1.0.0",
    instanceId: FORMAL_INSTANCE_ID,
    actionId,
    nodeId: `${actionId}-node`,
    evidenceOutputIds: formalEvidenceByAction[actionId] ?? [],
    payload: {},
  }));

export const createInitialAcidBaseRouteState = (): AcidBaseRouteState => ({
  completedActionIds: [],
  evidence: [],
});

export const isPlanApproved = (state: AcidBaseRouteState): boolean =>
  state.completedActionIds.includes(PLAN_ACTION_ID);

const numericParameter = (
  definition: LabDefinition | undefined,
  actionId: string,
  key: string,
): number => {
  const value = definition?.actions.find((action) => action.id === actionId)?.parameters?.[key];
  return typeof value === "number" ? value : Number.NaN;
};

const choiceParameter = (
  definition: LabDefinition | undefined,
  actionId: string,
  key: string,
): string[] => {
  const value = definition?.actions.find((action) => action.id === actionId)?.parameters?.[key];
  return Array.isArray(value) ? value.filter((option): option is string => typeof option === "string") : [];
};

/** Compiled formal context of this witness, read from the compiler-resolved action parameters. */
export const acidBaseRouteContextId = (
  definition: LabDefinition | undefined,
): AcidBaseRouteContext | undefined => {
  const value = definition?.actions
    .find((action) => action.id === "formal-trial-deliver-titrant")
    ?.parameters?.formalContextId;
  return typeof value === "string" && isAcidBaseRouteContext(value) ? value : undefined;
};

/**
 * Predecessor action ids for every compiled node, taken from the compiled edges. A node is
 * enterable once any one of its compiled predecessors has recorded evidence, which is what makes
 * the authored delivery loop, the funnel re-purge edge, and the rejected-trial retry edge
 * reachable without this route restating the graph.
 */
const compiledPredecessors = (
  definition: LabDefinition | undefined,
): Map<string, string[]> => {
  const predecessors = new Map<string, string[]>();
  if (!definition) return predecessors;
  const actionByNode = new Map(
    definition.process.nodes.map((node) => [node.id, node.actionId] as const),
  );
  for (const edge of definition.process.edges) {
    const consumer = actionByNode.get(edge.to);
    const producer = actionByNode.get(edge.from);
    if (!consumer || !producer) continue;
    predecessors.set(consumer, [...(predecessors.get(consumer) ?? []), producer]);
  }
  return predecessors;
};

/** The lab-owned nodes must exist in the compiled root process with their compiled action. */
const validateLabNodeProjections = (definition: LabDefinition | undefined): string[] => {
  if (!definition) return ["Route execution requires a compiled acid-base composition."];
  const errors: string[] = [];
  for (const actionId of LAB_NODE_ACTION_IDS) {
    const nodeId = `${actionId}-node`;
    const node = definition.process.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) {
      errors.push(`Lab node projection "${nodeId}" is not part of the compiled root process.`);
      continue;
    }
    if (node.actionId !== actionId) {
      errors.push(`Compiled node "${nodeId}" owns action "${node.actionId}", not "${actionId}".`);
    }
    if (!definition.actions.some((action) => action.id === actionId)) {
      errors.push(`Compiled lab action "${actionId}" is missing from the compiled definition.`);
    }
  }
  return errors;
};

export const validateAcidBaseRouteDefinition = (
  definition: LabDefinition | undefined,
): string[] => {
  const manifest = definition?.compositionManifest;
  if (!definition || !manifest || manifest.status !== "compiled") {
    return ["Route execution requires a compiler-issued compiled composition manifest."];
  }
  if (!acidBaseRouteContextId(definition)) {
    return ["The compiled witness does not declare a supported indicator-free formal context."];
  }
  return [
    ...validateRouteTechniqueExecutionTargets(manifest, ACID_BASE_ROUTE_EXECUTION_TARGETS),
    ...validateLabNodeProjections(definition),
  ];
};

const rejection = (
  state: AcidBaseRouteState,
  code: string,
  message: string,
  recovery: string,
) => ({
  ok: false as const,
  state: { ...state, lastRejection: { code, message, recovery } },
  rejection: { code, message, recovery },
});

const success = (
  state: AcidBaseRouteState,
  actionId: string,
  context: AcidBaseRouteContext,
  evidence: RouteTechniqueExecutionEvidence,
) => ({
  ok: true as const,
  state: {
    ...state,
    context,
    lastRejection: undefined,
    completedActionIds: state.completedActionIds.includes(actionId)
      ? state.completedActionIds
      : [...state.completedActionIds, actionId],
    evidence: [...state.evidence, evidence],
  },
  evidence,
});

const BURETTE_READING_RESOLUTION_ML = 0.01;

export const createAcidBaseRouteAdapter = (
  definition: LabDefinition | undefined,
): RouteTechniqueExecutionAdapter<AcidBaseRouteState> => {
  const definitionErrors = validateAcidBaseRouteDefinition(definition);
  const manifest = definition?.compositionManifest;
  const context = acidBaseRouteContextId(definition);
  const predecessors = compiledPredecessors(definition);
  return {
    execute(state, intent) {
      if (definitionErrors.length > 0 || !manifest || !context) {
        return rejection(
          state,
          "manifest-target-mismatch",
          definitionErrors.join(" ") ||
            "Route execution requires a compiler-issued compiled composition manifest.",
          "Reload the compiled acid-base composition before continuing.",
        );
      }
      const labActionId = LAB_NODE_ACTION_IDS.find((candidate) => candidate === intent.actionId);
      const isLabNode = intent.instanceId === LAB_ORCHESTRATION_INSTANCE_ID;
      if (isLabNode !== Boolean(labActionId)) {
        return rejection(
          state,
          "unmapped-control",
          `Action "${intent.actionId}" was not dispatched against its compiled scope.`,
          "Dispatch lab-owned nodes as lab orchestration and technique nodes against their compiled instance.",
        );
      }
      const declaredTarget = isLabNode
        ? undefined
        : ACID_BASE_ROUTE_EXECUTION_TARGETS.find((candidate) =>
            candidate.instanceId === intent.instanceId && candidate.actionId === intent.actionId);
      if (!isLabNode && !declaredTarget) {
        return rejection(
          state,
          "unmapped-control",
          `Action "${intent.actionId}" is not in the Cycle 10 route-control map.`,
          "Use one of the mapped compiled controls or a typed nonphysical projection.",
        );
      }
      if (declaredTarget) {
        const intentErrors = validateRouteTechniqueExecutionIntent(manifest, intent);
        if (intentErrors.length > 0) {
          return rejection(
            state,
            "manifest-intent-mismatch",
            intentErrors.join(" "),
            "Use the compiler-owned action and node for this route step.",
          );
        }
      }
      if (state.context && state.context !== context) {
        return rejection(
          state,
          "context-mismatch",
          `This route state holds ${state.context} evidence and cannot accept ${context} actions.`,
          "Reset the investigation before running a different configured context.",
        );
      }
      const requestedContext = intent.payload.contextId;
      if (typeof requestedContext === "string" && requestedContext !== context) {
        return rejection(
          state,
          "context-mismatch",
          `The compiled witness is ${context}; this control requested ${requestedContext}.`,
          "Dispatch each configured combination against its own compiled witness.",
        );
      }
      if (declaredTarget && !isPlanApproved(state)) {
        return rejection(
          state,
          "teacher-approval-required",
          "Formal acquisition is locked until the comparative plan and teacher approval are recorded.",
          "Complete the plan and record teacher approval before touching the apparatus.",
        );
      }
      const required = predecessors.get(intent.actionId) ?? [];
      if (required.length > 0 && !required.some((actionId) => state.completedActionIds.includes(actionId))) {
        return rejection(
          state,
          "prerequisite-missing",
          `Action "${intent.actionId}" requires ${required.join(" or ")} before it can advance.`,
          "Complete the preceding compiled route action, then retry this control.",
        );
      }
      if (intent.actionId === "formal-trial-deliver-titrant") {
        const incrementMl = intent.payload.value;
        const minimumMl = numericParameter(definition, intent.actionId, "minimumIncrementMl");
        const maximumMl = numericParameter(definition, intent.actionId, "maximumIncrementMl");
        if (!Number.isFinite(minimumMl) || !Number.isFinite(maximumMl)) {
          return rejection(
            state,
            "configuration-unresolved",
            "The compiled trial does not declare its titrant increment bounds.",
            "Reload the compiled composition; do not deliver against an unresolved configuration.",
          );
        }
        const steps = typeof incrementMl === "number"
          ? incrementMl / BURETTE_READING_RESOLUTION_ML
          : Number.NaN;
        if (
          typeof incrementMl !== "number" ||
          !Number.isFinite(incrementMl) ||
          incrementMl < minimumMl ||
          incrementMl > maximumMl ||
          Math.abs(steps - Math.round(steps)) > 1e-6
        ) {
          return rejection(
            state,
            "increment-out-of-contract",
            `A titrant delivery must be a single student-selected increment of ${minimumMl}-${maximumMl} mL read to ${BURETTE_READING_RESOLUTION_ML.toFixed(2)} mL.`,
            "Choose an increment inside the configured range at this burette's reading resolution, then redispatch the delivery.",
          );
        }
      }
      if (intent.actionId === "formal-trial-deliver-titrant-decide") {
        const options = choiceParameter(definition, intent.actionId, "inputOptions");
        const choice = intent.payload.note;
        if (typeof choice !== "string" || !options.includes(choice)) {
          return rejection(
            state,
            "unsupported-decision",
            `The compiled endpoint decision accepts only: ${options.join(", ")}.`,
            "Send one authored curve decision instead of a route-local verdict.",
          );
        }
        if (choice === FINISH_AFTER_STABILITY_REVIEW) {
          const recordedPointCount = intent.payload.recordedPointCount;
          const postSteepVolumeMl = intent.payload.postSteepVolumeMl;
          const consecutive = numericParameter(definition, intent.actionId, "stabilityConsecutiveReadings");
          const minimumPostSteepMl = numericParameter(definition, intent.actionId, "minimumPostSteepRegionMl");
          if (
            !Number.isFinite(consecutive) ||
            !Number.isFinite(minimumPostSteepMl) ||
            typeof recordedPointCount !== "number" ||
            typeof postSteepVolumeMl !== "number" ||
            recordedPointCount < consecutive + 2 ||
            postSteepVolumeMl + 1e-8 < minimumPostSteepMl
          ) {
            return rejection(
              state,
              "stability-evidence-required",
              `Accepting the curve needs at least ${consecutive + 2} recorded pH-volume rows and ${minimumPostSteepMl} mL recorded after the steepest observed interval.`,
              "Keep delivering configured increments and recording rows, or dispose and restart this trial.",
            );
          }
        }
      }
      if (labActionId) {
        const note = intent.payload.note;
        if (typeof note !== "string" || note.trim().length === 0) {
          return rejection(
            state,
            "student-response-required",
            `Compiled node ${labActionId}-node records a required student response.`,
            "Enter the required response before recording this nonphysical node.",
          );
        }
      }
      if (intent.actionId === "ACID-CLEANUP-01") {
        if (
          intent.payload.wasteWithinConfiguredRange !== true ||
          intent.payload.instructorRouteConfirmed !== true
        ) {
          return rejection(
            state,
            "waste-checkpoint-required",
            "Waste cannot be released before the configured neutralization checkpoint and the instructor-confirmed route.",
            "Measure the waste pH inside the configured release range and confirm the posted disposal route.",
          );
        }
      }
      // A technique node carries compiler-issued evidence outputs; a lab-owned node's completion
      // contract is its compiled validation rule, so that is what the route records for it.
      const evidenceOutputIds = declaredTarget
        ? declaredTarget.evidenceOutputIds
        : (definition?.process.nodes
            .find((node) => node.id === `${intent.actionId}-node`)
            ?.validation.map((rule) => rule.id) ?? []);
      const evidence: RouteTechniqueExecutionEvidence = {
        actionId: intent.actionId,
        evidence: [...evidenceOutputIds],
        ...(typeof intent.payload.value === "number"
          ? { measurements: { [intent.actionId]: intent.payload.value } }
          : {}),
        ...(typeof intent.payload.note === "string"
          ? { notebook: { [intent.actionId]: intent.payload.note } }
          : {}),
      };
      return success(state, intent.actionId, context, evidence);
    },
    recover(state, routeRejection) {
      return {
        ...state,
        lastRejection: routeRejection,
      };
    },
    /**
     * Clears recorded experiment evidence. Teacher configuration lives outside route state and is
     * reloaded, not reset, so a reset returns the route to its pre-acquisition contract position.
     */
    reset() {
      return createInitialAcidBaseRouteState();
    },
  };
};

/**
 * Actions the route must clear when a rejected attempt is disposed and restarted. The compiled
 * retry edge re-enters at the funnel/fill segment, so the trial's own acquisition evidence is
 * withdrawn while the assembly and the approved plan stay recorded.
 */
export const RETRY_CLEARED_ACTION_IDS: readonly string[] = [
  "formal-trial-seat-burette-funnel",
  "formal-trial-fill-burette",
  "formal-trial-fill-burette-purge-tip",
  "formal-trial-fill-burette-check-tip",
  "formal-trial-remove-burette-funnel",
  "formal-trial-read-initial-burette",
  "formal-trial-record-initial-burette",
  "formal-trial-measure-analyte",
  "formal-trial-transfer-analyte-to-receiver",
  "formal-trial-position-flask-under-burette",
  "formal-trial-probe-ready",
  "formal-trial-place-ph-meter-on-workbench",
  "formal-trial-immerse-endpoint-ph-probe",
  "formal-trial-inspect-prepared-analyte",
  "formal-trial-initial-ph",
  "formal-trial-initial-row",
  "formal-trial-deliver-titrant",
  "formal-trial-deliver-titrant-mix",
  "formal-trial-deliver-titrant-observe",
  "formal-trial-deliver-titrant-read-ph",
  "formal-trial-deliver-titrant-record-point",
  "formal-trial-deliver-titrant-decide",
];

/** Withdraw a rejected attempt's evidence while preserving its documented rejection history. */
export const clearRetriedAttempt = (state: AcidBaseRouteState): AcidBaseRouteState => ({
  ...state,
  completedActionIds: state.completedActionIds.filter(
    (actionId) => !RETRY_CLEARED_ACTION_IDS.includes(actionId),
  ),
});
