/**
 * Current-source semantic projection for Cycle 09 evidence overlays.
 *
 * Cycle 09 overlays retain historical baseline reconciliation rows and record the
 * coordinator-owned audit hashes they observed.  Those mutable audit records are
 * useful review context, but they are not the authority for the lane's current
 * action, source-trace, or compiled-wiring semantics.  This helper centralizes
 * that current-source projection so the overlay writer, its checker, and Cycle
 * 12 reconciliation cannot drift into a write-old-overlay / check-new-overlay
 * dependency cycle.
 */

export const cycle09TechniqueIds = Object.freeze([
  "hand-warmer-calorimetry",
  "equilibrium-rainbow-inquiry",
]);

export const cycle09LabIds = Object.freeze([
  "hand-warmer-calorimetry",
  "equilibrium-rainbow-display",
]);

export const cycle09Owners = Object.freeze([
  ...cycle09LabIds.map((id) => `lab:${id}`),
  ...cycle09TechniqueIds.map((id) => `technique:${id}`),
]);

const asArray = (value) => Array.isArray(value) ? value : [];

const requiredEntries = (entriesById, ids, kind) => {
  const missing = ids.filter((id) => !entriesById.get(id));
  if (missing.length > 0) {
    throw new Error(`Cycle 09 current-source projection is missing ${kind}: ${missing.join(", ")}.`);
  }
  return new Map(ids.map((id) => [id, entriesById.get(id)]));
};

/**
 * Derive only the lane's current semantic rows from current public definitions
 * and the frozen registries.  Audit matrices and existing overlay files are
 * intentionally not accepted as inputs: the writer may record them as observed
 * historical context, but a reconciliation must not inherit their changing row
 * identities or source dispositions.
 */
export const deriveCycle09CurrentSourceProjection = ({
  registry,
  sourceRegistry,
  techniquesById,
  labsById,
}) => {
  if (!(techniquesById instanceof Map) || !(labsById instanceof Map)) {
    throw new Error("Cycle 09 current-source projection requires technique and lab maps.");
  }

  const techniques = requiredEntries(techniquesById, cycle09TechniqueIds, "techniques");
  const labs = requiredEntries(labsById, cycle09LabIds, "labs");
  const atoms = new Map(asArray(registry?.atoms).map((atom) => [atom.id, atom]));
  const traceMap = new Map(asArray(sourceRegistry?.traces).map((trace) => [
    `${trace.ownerType}:${trace.ownerId}#${trace.actionId}`,
    trace,
  ]));
  const ACQUISITION_CLASS = "measurement-direct-observation-acquisition";

  const effectFor = (technique, action) => {
    if (action.atomId && atoms.get(action.atomId)?.effectContract) return atoms.get(action.atomId).effectContract;
    return technique.composition?.legacyActionEffects?.find((entry) => entry.actionId === action.id)?.effect ?? {
      classes: ["pedagogical-orchestration"], targets: [{ domain: "evidence" }],
    };
  };

  const acquiresMeasurement = (technique, action) =>
    (effectFor(technique, action).classes ?? []).includes(ACQUISITION_CLASS);

  const actionTrace = (technique, action) => {
    const exact = traceMap.get(`technique:${technique.id}#${action.id}`);
    if (exact) return { ...exact, rationale: "Exact source-registry row retained for the current action identity." };
    if (acquiresMeasurement(technique, action)) {
      return {
        sourceFile: null,
        sourceTable: null,
        step: null,
        basis: null,
        traceDebt: "untraced-acquisition",
        rationale: "Conflict: this action acquires a measurement or direct observation but has no exact source-registry row, and this lane may not edit the shared registry. Recorded as untraced-acquisition debt rather than claimed as a configuration boundary; the acquired value itself is never authored.",
      };
    }
    if (technique.id === "hand-warmer-calorimetry") {
      return {
        sourceFile: null,
        sourceTable: null,
        step: null,
        basis: "C",
        rationale: "Simulator orchestration or teacher-configured inquiry boundary; no salt quantity, thermal outcome, or design winner is promoted to a source mandate.",
      };
    }
    return {
      sourceFile: null,
      sourceTable: null,
      step: null,
      basis: "C",
      rationale: "Simulator orchestration or teacher-approved inquiry boundary; observed colour and equilibrium response remain learner evidence rather than fixed conclusions.",
    };
  };

  const configValues = (value, path = [], output = {}) => {
    if (typeof value === "string" && value.startsWith("{{config.")) output[path.at(-1)] = value;
    else if (Array.isArray(value)) value.forEach((child, index) => configValues(child, [...path, String(index)], output));
    else if (value && typeof value === "object") Object.entries(value).forEach(([key, child]) => configValues(child, [...path, key], output));
    return output;
  };

  const sourceRows = [...techniques.values()].flatMap((technique) => technique.actions.map((action) => {
    const source = actionTrace(technique, action);
    return {
      rowId: `technique:${technique.id}#${action.id}`,
      owner: `technique:${technique.id}`,
      actionId: action.id,
      atomId: action.atomId ?? null,
      sourceFile: source.sourceFile ?? null,
      sourceTable: source.sourceTable ?? null,
      step: source.step ?? null,
      basis: source.basis ?? null,
      traceDebt: source.traceDebt ?? null,
      rationale: source.rationale,
      evaluated: true,
    };
  })).concat([...labs.values()].flatMap((lab) => asArray(lab.actions).map((action) => ({
    rowId: `lab:${lab.id}#${action.id}`,
    owner: `lab:${lab.id}`,
    actionId: action.id,
    atomId: action.atomId ?? null,
    sourceFile: null,
    sourceTable: null,
    step: null,
    basis: "C",
    traceDebt: null,
    rationale: "Nonphysical inquiry/orchestration remains local; physical state, measured temperature, and equilibrium observations belong to named technique instances.",
    evaluated: true,
  }))));

  const atomicRows = [...techniques.values()].flatMap((technique) => technique.actions.map((action) => {
    const source = actionTrace(technique, action);
    return {
      rowId: `${technique.id}@${technique.metadata.version}#${action.id}`,
      techniqueId: technique.id,
      techniqueVersion: technique.metadata.version,
      actionId: action.id,
      atomId: action.atomId ?? null,
      effect: effectFor(technique, action),
      roleBindings: action.equipmentRoleBindings ?? {},
      nodeConsumers: asArray(technique.process?.nodes).filter((node) => node.actionId === action.id).map((node) => node.id),
      decision: action.atomId
        ? "keep: one handler-dispatched bench, observation, stress, or evidence operation"
        : acquiresMeasurement(technique, action)
          ? "acquisition-without-atom: the effect contract acquires a measurement/direct observation, so this row is not a learner response or a configuration boundary; the value stays learner-acquired and untraced-acquisition debt is recorded"
          : "nonphysical: learner/instructor response or configured inquiry boundary",
      prerequisites: {
        authored: action.prerequisites ?? [],
        attachmentState: action.parameters?.requiredAttachmentState ?? null,
        assignedSource: action.parameters?.sourceInstanceId ?? null,
        assignedReceiver: action.parameters?.targetInstanceId ?? null,
        trial: action.parameters?.trialReferenceId ?? null,
        operation: action.interaction?.type ?? action.verb,
        model: action.parameters?.modelId ?? action.parameters?.equilibriumModelId ?? null,
      },
      pausePoint: action.label,
      recoveryBoundary: action.invalidCases ?? [],
      configurationParameters: configValues(action.parameters ?? {}),
      evidenceBoundary: {
        declared: action.evidence ?? [],
        acquisition: action.parameters?.measurementId ?? null,
        calculation: action.parameters?.calculationId ?? null,
      },
      reviewBoundary: "Static source/handler review; no executed physical, thermal, or browser validation.",
      configurationWitness: action.parameters?.configurationProvenance ?? "Exact action bindings plus teacher-configured inquiry values; no C value is promoted to a source mandate.",
      sourceConflict: source.rationale,
      evaluated: true,
    };
  }));

  const mergedLabRows = (lab) => {
    const witnessIds = ["default", ...asArray(lab.reachabilityWitnesses).map((witness) => witness.id)];
    const compiledNodeId = (instance, sourceNodeId) =>
      instance.preserveIds?.nodes?.[sourceNodeId] ?? `${instance.instanceId}--${sourceNodeId}`;
    const endpointNodeId = (endpoint) => {
      if (endpoint.kind === "lab-node") return endpoint.nodeId;
      const target = asArray(lab.techniqueInstances).find((candidate) => candidate.instanceId === endpoint.instanceId);
      const port = target && techniques.get(target.techniqueId)?.composition?.ports
        ?.find((candidate) => candidate.id === endpoint.portId);
      return port ? compiledNodeId(target, port.nodeId) : null;
    };
    const connectionEdges = asArray(lab.compositionConnections).flatMap((connection) => {
      const from = endpointNodeId(connection.from);
      const to = endpointNodeId(connection.to);
      return from && to ? [{ from, to, label: connection.label, condition: connection.condition ?? { type: "always" } }] : [];
    });
    const rows = new Map();
    const add = (row) => {
      const prior = rows.get(row.rowId);
      if (prior) prior.reachability = [...new Set([...prior.reachability, ...row.reachability])];
      else rows.set(row.rowId, row);
    };
    for (const witnessId of witnessIds) {
      for (const node of asArray(lab.process?.nodes)) add({
        rowId: `${lab.id}#${node.id}`,
        labId: lab.id,
        nodeId: node.id,
        actionId: node.actionId,
        techniqueId: null,
        techniqueVersion: null,
        instanceId: null,
        reachability: [witnessId],
        finalOrigin: { kind: "lab-local" },
        incoming: [...asArray(lab.process?.edges), ...connectionEdges].filter((edge) => edge.to === node.id),
        outgoing: [...asArray(lab.process?.edges), ...connectionEdges].filter((edge) => edge.from === node.id),
        effectDecision: "nonphysical lab orchestration",
        configurationWitness: asArray(lab.reachabilityWitnesses).find((candidate) => candidate.id === witnessId)?.configuration ?? {},
        sourceConflictDisposition: "Local evidence/planning action; physical/scientific-state acquisition is imported from an exact-version technique instance.",
        evaluated: true,
      });
      for (const instance of asArray(lab.techniqueInstances)) {
        const technique = techniques.get(instance.techniqueId);
        if (!technique) continue;
        const internalEdges = asArray(technique.process?.edges).map((edge) => ({
          from: compiledNodeId(instance, edge.from),
          to: compiledNodeId(instance, edge.to),
          label: edge.label,
          condition: edge.condition,
        }));
        const instanceEdges = [...internalEdges, ...connectionEdges];
        for (const sourceNode of asArray(technique.process?.nodes)) {
          const nodeId = instance.preserveIds?.nodes?.[sourceNode.id] ?? `${instance.instanceId}--${sourceNode.id}`;
          const actionId = instance.preserveIds?.actions?.[sourceNode.actionId] ?? `${instance.instanceId}--${sourceNode.actionId}`;
          const action = technique.actions.find((candidate) => candidate.id === sourceNode.actionId);
          add({
            rowId: `${lab.id}#${nodeId}`,
            labId: lab.id,
            nodeId,
            actionId,
            techniqueId: technique.id,
            techniqueVersion: technique.metadata.version,
            instanceId: instance.instanceId,
            reachability: [witnessId],
            finalOrigin: { kind: "technique-instance", sourceNodeId: sourceNode.id, sourceActionId: sourceNode.actionId },
            incoming: instanceEdges.filter((edge) => edge.to === nodeId),
            outgoing: instanceEdges.filter((edge) => edge.from === nodeId),
            effectDecision: action?.atomId ?? "nonphysical response",
            configurationWitness: {
              configuration: instance.bindings?.configuration ?? {},
              variantId: instance.variantId ?? null,
              approvalGates: asArray(lab.reachabilityWitnesses).find((candidate) => candidate.id === witnessId)?.approvalGates ?? {},
            },
            sourceConflictDisposition: action ? actionTrace(technique, action).rationale : "Exact-version technique node retained by compiler expansion.",
            evaluated: true,
          });
        }
      }
    }
    return [...rows.values()];
  };

  const composedRows = [...labs.values()].flatMap(mergedLabRows);
  const untracedAcquisitionRowIds = sourceRows
    .filter((row) => row.traceDebt === "untraced-acquisition")
    .map((row) => row.rowId);

  return {
    schema: "lab-studio/cycle09-current-source-projection@1",
    owners: [...cycle09Owners],
    techniqueIds: [...cycle09TechniqueIds],
    labIds: [...cycle09LabIds],
    sourceRows,
    atomicRows,
    composedRows,
    untracedAcquisitionRowIds,
  };
};

/**
 * Current-source inputs consumed by Cycle 12 when it summarizes and resolves
 * the three Cycle 09 semantic overlays.  The serialized overlays are still
 * independently checked after refresh, but they cannot supply a stale row
 * count, validation result, or fallback action disposition before that
 * refresh happens.
 */
export const deriveCycle09ReconciliationInputs = (projection) => {
  if (!projection || !Array.isArray(projection.owners)) {
    throw new Error("Cycle 09 reconciliation inputs require a current-source projection.");
  }

  const rowsByOverlay = {
    "source-trace-overlay.json": projection.sourceRows,
    "technique-atomicity-overlay.json": projection.atomicRows,
    "lab-composition-overlay.json": projection.composedRows,
  };
  const ownerSet = new Set(projection.owners);
  const sourceRowsByOwnerAction = new Map(rowsByOverlay["source-trace-overlay.json"].map((row) => [
    `${row.owner}#${row.actionId}`,
    row,
  ]));
  const atomicRowsByOwnerAction = new Map(rowsByOverlay["technique-atomicity-overlay.json"].map((row) => [
    `technique:${row.techniqueId}#${row.actionId}`,
    row,
  ]));
  const rowsForOverlay = (file) => rowsByOverlay[file] ?? null;

  return {
    rowsForOverlay,
    /**
     * `applies` is deliberately separate from `row`: a removed current action
     * is a Cycle 09 owner with no current row, not permission to fall back to
     * a serialized predecessor row.
     */
    rowForOverlay: ({ file, owner, actionId }) => {
      if (!ownerSet.has(owner) || !rowsForOverlay(file)) return { applies: false, row: undefined };
      if (file === "source-trace-overlay.json") {
        return { applies: true, row: sourceRowsByOwnerAction.get(`${owner}#${actionId}`) };
      }
      if (file === "technique-atomicity-overlay.json") {
        return { applies: true, row: atomicRowsByOwnerAction.get(`${owner}#${actionId}`) };
      }
      return { applies: true, row: undefined };
    },
    overlayMatchesCurrentSource: (file, serializedRows) => {
      const currentRows = rowsForOverlay(file);
      return Array.isArray(currentRows) && Array.isArray(serializedRows) &&
        JSON.stringify(serializedRows) === JSON.stringify(currentRows);
    },
  };
};
