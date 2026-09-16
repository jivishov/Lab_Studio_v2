import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { compileLabComposition } from "../src/data/compileLabComposition.ts";
import {
  validateBundledLabSource,
  validateLabDefinition,
  validateTechniqueDefinition,
} from "../src/domain/validation.ts";

const techniqueIds = [
  "weighing", "measuring-volume", "making-solution", "dilution",
  "transfer", "hard-water-precipitation", "filtration", "drying", "hard-water-calculation",
];
const labIds = ["intro-filtration-demo", "hard-water-demo"];
const techniques = new Map();
const cycle01Baseline = JSON.parse(await readFile(
  "planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/CYCLE_01_BASELINE.json",
  "utf8",
));
const baselineLabById = new Map(cycle01Baseline.catalog.labs.map((lab) => [lab.id, lab]));

for (const techniqueId of techniqueIds) {
  const raw = JSON.parse(await readFile(`public/techniques/${techniqueId}.json`, "utf8"));
  const result = validateTechniqueDefinition(raw);
  if (!result.ok || !result.value) throw new Error(`${techniqueId}:\n${result.errors.join("\n")}`);
  if (raw.metadata.version !== "1.2.0" || raw.composition?.schemaVersion !== 1) {
    throw new Error(`${techniqueId} lacks the Cycle 04 exact-version composition contract.`);
  }
  if (!raw.composition.configurationSlots.length || !raw.composition.evidenceOutputs.length) {
    throw new Error(`${techniqueId} lacks reusable configuration or evidence outputs.`);
  }
  const covered = new Set([
    ...raw.actions.filter((action) => action.atomId).map((action) => action.id),
    ...(raw.composition.legacyActionEffects ?? []).map((item) => item.actionId),
  ]);
  if (covered.size !== raw.actions.length) throw new Error(`${techniqueId} has unclassified actions.`);
  techniques.set(techniqueId, result.value);
}

for (const labId of labIds) {
  const raw = JSON.parse(await readFile(`public/labs/${labId}.json`, "utf8"));
  const regenerated = JSON.parse(execFileSync(
    process.execPath,
    ["scripts/cycle04TechniqueCompositionTransform.mjs", "lab", labId],
    { encoding: "utf8" },
  ));
  if (JSON.stringify(raw) !== JSON.stringify(regenerated)) {
    throw new Error(`${labId} does not match its idempotent Cycle 04 transform output.`);
  }
  const result = validateBundledLabSource(raw);
  if (!result.ok || !result.value) throw new Error(`${labId} source:\n${result.errors.join("\n")}`);
  if (raw.techniqueRefs || raw.actions.length || raw.process.nodes.length || raw.process.edges.length) {
    throw new Error(`${labId} retains legacy imports or lab-local procedure.`);
  }
  const compiled = await compileLabComposition(result.value, async (techniqueId) => {
    const technique = techniques.get(techniqueId);
    if (!technique) throw new Error(`${labId} requested unexpected ${techniqueId}.`);
    return structuredClone(technique);
  });
  const compiledResult = validateLabDefinition(compiled);
  if (!compiledResult.ok || !compiledResult.value) {
    throw new Error(`${labId} compiled:\n${compiledResult.errors.join("\n")}`);
  }
  const expectedOrigins = raw.techniqueInstances.reduce(
    (count, instance) => count + techniques.get(instance.techniqueId).process.nodes.length,
    0,
  );
  if (compiled.compositionManifest?.origins.length !== expectedOrigins) {
    throw new Error(`${labId} origin coverage is incomplete.`);
  }
  if (compiled.process.nodes.some((node) =>
    !compiled.compositionManifest.origins.some((origin) => origin.nodeId === node.id))) {
    throw new Error(`${labId} contains a non-technique process node.`);
  }
  if (labId === "hard-water-demo") {
    const calculation = compiled.actions.find((action) => action.id === "calculate-hardness");
    if (calculation?.parameters.sampleVolumeMeasurementId !== "sample-volume" ||
      calculation?.parameters.precipitateMassMeasurementId !== "dry-precipitate-mass" ||
      "sampleVolumeMl" in calculation.parameters || "precipitateMassG" in calculation.parameters) {
      throw new Error("hard-water-demo calculation is not bound to the recorded mass/volume evidence identities.");
    }
    const ordered = ["dry-node", "remove-warm-precipitate-node", "break-precipitate-node", "second-dry-precipitate-node", "cool-dry-precipitate-node", "weigh-node", "record-dry-mass-node"];
    const positions = ordered.map((nodeId) => compiled.process.nodes.findIndex((node) => node.id === nodeId));
    if (positions.some((position) => position < 0) || positions.some((position, index) => index > 0 && position <= positions[index - 1])) {
      throw new Error("hard-water-demo omits or reorders the source-grounded two-stage drying evidence flow.");
    }
  }
  for (const instance of raw.techniqueInstances) {
    for (const [sourceActionId, targetActionId] of Object.entries(instance.preserveIds.actions)) {
      if (sourceActionId !== targetActionId) {
        throw new Error(`${labId}/${instance.instanceId} changes public action id ${sourceActionId} to ${targetActionId}.`);
      }
    }
  }
  const baselineLab = baselineLabById.get(labId);
  const compiledActionIds = new Set(compiled.actions.map((action) => action.id));
  const compiledNodeIds = new Set(compiled.process.nodes.map((node) => node.id));
  for (const actionId of baselineLab.actionIds) {
    if (!compiledActionIds.has(actionId)) throw new Error(`${labId} dropped frozen action id ${actionId}.`);
  }
  for (const ref of baselineLab.techniqueRefs) {
    if (ref.actionIds === "all") continue;
    for (const actionId of ref.actionIds) {
      if (!compiledActionIds.has(actionId)) throw new Error(`${labId} dropped frozen imported action id ${actionId}.`);
    }
  }
  for (const nodeId of baselineLab.nodeIds) {
    if (!compiledNodeIds.has(nodeId)) throw new Error(`${labId} dropped frozen node id ${nodeId}.`);
  }
  console.log(`${labId}: ${compiled.process.nodes.length} compiled technique nodes, ${expectedOrigins} origins`);
}

console.log(`Cycle 04 foundations: ${techniqueIds.length} techniques and ${labIds.length} demos passed.`);
