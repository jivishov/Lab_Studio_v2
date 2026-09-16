/**
 * Serialize the deterministic Cycle 12 compiler witness.
 *
 * Collection lives in `src/data/collectCompiledWitnesses.ts`; this command retains only explicit
 * catalog I/O, historical witness formatting, and the requested artifact write. It is deliberately
 * not imported by F02 diagnostics.
 *
 * Run with:
 *   node --experimental-strip-types --experimental-loader ./scripts/tsCompositionLoader.mjs \
 *     scripts/collectCycle12CompileWitness.mjs
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { collectCompiledWitnesses } from "../src/data/collectCompiledWitnesses.ts";
import { prepareCycle12WitnessSource } from "../src/data/cycle12WitnessSetup.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (relativePath) => JSON.parse(await readFile(join(root, relativePath), "utf8"));

/** Edge conditions that make an entry into a node depend on a configuration or approval choice. */
const gatedConditionTypes = new Set(["configuration", "approval", "calculationResult"]);

/** Reachable node ids from the compiled start node, ignoring retry self-recovery edges. */
const reachableNodeIds = (process) => {
  const outgoing = new Map();
  for (const edge of process.edges) {
    if (edge.condition?.type === "retry") continue;
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
  }
  const reachable = new Set();
  const queue = [process.startNodeId ?? process.nodes[0]?.id];
  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId || reachable.has(nodeId)) continue;
    reachable.add(nodeId);
    queue.push(...(outgoing.get(nodeId) ?? []));
  }
  return reachable;
};

/** Node ids whose only non-retry entries are configuration/approval/calculation gated. */
const gatedNodeIds = (process) => {
  const incoming = new Map();
  for (const edge of process.edges) {
    if (edge.condition?.type === "retry") continue;
    incoming.set(edge.to, [...(incoming.get(edge.to) ?? []), edge]);
  }
  const gated = new Set();
  for (const [nodeId, edges] of incoming) {
    if (edges.length > 0 && edges.every((edge) => gatedConditionTypes.has(edge.condition?.type))) gated.add(nodeId);
  }
  return gated;
};

const techniqueIndex = await readJson("public/techniques/index.json");
const labIndex = await readJson("public/labs/index.json");
const techniqueById = new Map(techniqueIndex.map((entry) => [entry.id, entry]));
const resolveTechnique = async (id) => {
  const entry = techniqueById.get(id);
  if (!entry) throw new Error(`Technique ${id} is not present in public/techniques/index.json.`);
  return readJson(`public/techniques/${entry.file ?? `${id}.json`}`);
};

const witness = {
  schema: "lab-studio/cycle-12-compile-witness@2",
  generatedFor: "Cycle 12 reconciliation",
  validationBoundary: "Source/static compiler witness only; no runtime, browser, build, detailed test, or physical validation.",
  witnessPolicy: "Every lab is compiled once per declared reachability witness. `nodes` is the union across witnesses; `presentInWitnesses`, `reachableInWitnesses`, and `gatedInWitnesses` record where each node exists, is reachable from the compiled start node, and is entered only through a configuration/approval gate. Default-witness counts are retained for continuity.",
  labs: [],
};

const failures = [];
for (const entry of labIndex) {
  const source = await readJson(`public/labs/${entry.file ?? `${entry.id}.json`}`);
  const collection = await collectCompiledWitnesses({
    source,
    resolveTechnique,
    prepareSource: prepareCycle12WitnessSource,
  });
  const failedAttempts = collection.attempts.filter((attempt) => attempt.status !== "compiled");
  if (failedAttempts.length > 0) {
    failures.push(...failedAttempts.map((attempt) =>
      `${attempt.labId}/${attempt.witnessId ?? "no-witness"} ${attempt.status}: ${attempt.error}`,
    ));
    continue;
  }
  const attempts = collection.attempts.filter((attempt) => attempt.status === "compiled");
  const unionNodes = new Map();
  const unionInstanceIds = new Set();
  const witnessCompiles = [];
  const defaultAttempt = attempts[0];
  if (!defaultAttempt) {
    failures.push(`${source.id} produced no compiled witness attempt.`);
    continue;
  }

  for (const attempt of attempts) {
    const { compiled, manifest, effectiveWitnessId } = attempt;
    const originByNode = new Map(manifest.origins.map((origin) => [origin.nodeId, origin]));
    const reachable = reachableNodeIds(compiled.process);
    const gated = gatedNodeIds(compiled.process);
    for (const instance of manifest.instances) unionInstanceIds.add(instance.instanceId);
    for (const node of compiled.process.nodes) {
      const origin = originByNode.get(node.id) ?? null;
      const existing = unionNodes.get(node.id);
      if (existing && (existing.actionId !== node.actionId || JSON.stringify(existing.origin) !== JSON.stringify(origin))) {
        failures.push(`Lab ${source.id} node ${node.id} resolves to a different action/origin under witness ${effectiveWitnessId}.`);
        continue;
      }
      const record = existing ?? {
        nodeId: node.id,
        actionId: node.actionId,
        origin,
        validationRuleCount: node.validation.length,
        presentInWitnesses: [],
        reachableInWitnesses: [],
        gatedInWitnesses: [],
      };
      record.presentInWitnesses.push(effectiveWitnessId);
      if (reachable.has(node.id)) record.reachableInWitnesses.push(effectiveWitnessId);
      if (gated.has(node.id)) record.gatedInWitnesses.push(effectiveWitnessId);
      if (!existing) unionNodes.set(node.id, record);
    }
    witnessCompiles.push({
      witnessId: effectiveWitnessId,
      setupFixtureId: attempt.setupFixtureId,
      startNodeId: compiled.process.startNodeId,
      compiledNodeCount: compiled.process.nodes.length,
      compiledActionCount: compiled.actions.length,
      compiledEdgeCount: compiled.process.edges.length,
      compiledOriginCount: manifest.origins.length,
      compiledManifestInstanceCount: manifest.instances.length,
      reachableNodeCount: compiled.process.nodes.filter((node) => reachable.has(node.id)).length,
      initialEquipmentCount: compiled.initialState?.equipment.length ?? 0,
      techniqueInstanceIds: manifest.instances.map((instance) => instance.instanceId),
    });
  }

  const declaredInstanceIds = source.techniqueInstances.map((instance) => instance.instanceId);
  const neverCompiledInstanceIds = declaredInstanceIds.filter((id) =>
    !collection.sourceInstanceScopes.some((scope) => scope.declaredInstanceId === id && unionInstanceIds.has(scope.compiledInstanceId)),
  );
  if (neverCompiledInstanceIds.length > 0) {
    failures.push(`Lab ${source.id} declares technique instances that no valid witness compiles: ${neverCompiledInstanceIds.join(", ")}.`);
  }
  const { compiled, manifest } = defaultAttempt;
  witness.labs.push({
    id: source.id,
    sourceTechniqueInstanceCount: declaredInstanceIds.length,
    sourceLocalActionCount: source.actions.length,
    sourceLocalNodeCount: source.process.nodes.length,
    compiledActionCount: compiled.actions.length,
    compiledNodeCount: compiled.process.nodes.length,
    compiledEdgeCount: compiled.process.edges.length,
    compiledOriginCount: manifest.origins.length,
    compiledManifestInstanceCount: manifest.instances.length,
    startNodeId: compiled.process.startNodeId,
    initialEquipmentCount: compiled.initialState?.equipment.length ?? 0,
    initialEquipmentIds: (compiled.initialState?.equipment ?? []).map((instance) => instance.id),
    reachabilityWitnessIds: collection.selectedWitnessIds,
    techniqueInstanceIds: manifest.instances.map((instance) => instance.instanceId),
    unionNodeCount: unionNodes.size,
    unionTechniqueInstanceIds: [...unionInstanceIds],
    witnessCompiles,
    edges: compiled.process.edges.map((edge) => ({
      from: edge.from,
      to: edge.to,
      condition: edge.condition,
    })),
    nodes: [...unionNodes.values()],
    localActionIds: source.actions.map((action) => action.id),
  });
}

if (failures.length > 0) {
  throw new Error(`Cycle 12 compiler witness did not serialize:\n${failures.join("\n")}`);
}

witness.totals = witness.labs.reduce((totals, lab) => ({
  sourceTechniqueInstanceCount: totals.sourceTechniqueInstanceCount + lab.sourceTechniqueInstanceCount,
  sourceLocalActionCount: totals.sourceLocalActionCount + lab.sourceLocalActionCount,
  sourceLocalNodeCount: totals.sourceLocalNodeCount + lab.sourceLocalNodeCount,
  compiledActionCount: totals.compiledActionCount + lab.compiledActionCount,
  compiledNodeCount: totals.compiledNodeCount + lab.compiledNodeCount,
  compiledEdgeCount: totals.compiledEdgeCount + lab.compiledEdgeCount,
  compiledOriginCount: totals.compiledOriginCount + lab.compiledOriginCount,
  compiledManifestInstanceCount: totals.compiledManifestInstanceCount + lab.compiledManifestInstanceCount,
  unionNodeCount: totals.unionNodeCount + lab.unionNodeCount,
  witnessCompileCount: totals.witnessCompileCount + lab.witnessCompiles.length,
}), {
  sourceTechniqueInstanceCount: 0,
  sourceLocalActionCount: 0,
  sourceLocalNodeCount: 0,
  compiledActionCount: 0,
  compiledNodeCount: 0,
  compiledEdgeCount: 0,
  compiledOriginCount: 0,
  compiledManifestInstanceCount: 0,
  unionNodeCount: 0,
  witnessCompileCount: 0,
});

await writeFile(
  join(root, "planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/lane-12/COMPILED_LAB_WITNESS.json"),
  `${JSON.stringify(witness, null, 2)}\n`,
  "utf8",
);
console.log(`Cycle 12 compiler witness passed: ${witness.labs.length} labs, ${witness.totals.witnessCompileCount} witness compiles, ${witness.totals.unionNodeCount} union nodes (${witness.totals.compiledNodeCount} under the default witness).`);
