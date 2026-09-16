/**
 * Cycle 08 static composition/evidence verifier.
 *
 * The Cycle 08 review found that a compiled composition can be structurally valid and still be
 * unplayable: the compiler rewrites evidence identities inside validation rules, but a writer's
 * own `parameters.tag` is never rewritten, and only a few `observe` handlers record a measurement
 * at all. Both labs shipped gates that no handler could ever satisfy.
 *
 * This verifier compiles each declared reachability witness and walks the compiled procedure in
 * order, modelling the evidence the runtime reducer actually produces per action. It fails when a
 * prerequisite or node validation rule can never be satisfied by an earlier step, and when a
 * `record` step has no measurement or supplied value to record.
 *
 * Allowed evidence ceiling: static composition/JSON analysis only. It proves nothing about live
 * timing, gas collection, instrument behaviour, fitting, reset, or physical safety.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compileLabComposition } from "../src/data/compileLabComposition.ts";
import { validateTechniqueDefinition } from "../src/domain/validation.ts";

const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const techniqueCache = new Map();
const resolveTechnique = async (id) => {
  if (!techniqueCache.has(id)) {
    const result = validateTechniqueDefinition(read(`public/techniques/${id}.json`));
    if (!result.ok) throw new Error(`${id}: ${result.errors.join(" | ")}`);
    techniqueCache.set(id, result.value);
  }
  return structuredClone(techniqueCache.get(id));
};

const str = (params, key) =>
  typeof params[key] === "string" && params[key].trim() ? params[key].trim() : undefined;

/**
 * Evidence the reducer stores for one action. Mirrors src/runtime/reducer.ts: `weigh` and
 * `measureVolume` store a measurement; `observe` stores one only on the pH-endpoint, ruler,
 * photometer-read, configuration-quantity, instrument-evidence and numeric-input paths, and
 * otherwise writes a notebook row tagged ["observe", parameters.tag]; `record` writes a row
 * tagged ["record", measurementId] and ignores parameters.tag entirely.
 */
const producedEvidence = (action) => {
  const p = action.parameters ?? {};
  const interaction = action.interaction?.type;
  const measurements = new Set();
  const tags = new Set();
  const dataSeries = new Set();
  const calculations = new Set();
  const measurementId = str(p, "measurementId") ?? action.measurementId;
  const notes = [];
  const addObservationRow = (fallbackTag, extra = []) => {
    tags.add("observe");
    tags.add(str(p, "tag") ?? fallbackTag);
    extra.forEach((tag) => tags.add(tag));
  };

  if (action.verb === "weigh" || action.verb === "measureVolume") {
    if (measurementId) measurements.add(measurementId);
  } else if (action.verb === "observe") {
    const photometerOperation = str(p, "photometerOperation");
    const readInstrument = interaction === "readInstrument";
    if (readInstrument && str(p, "phReadingMode") === "acceptedEndpoint") {
      if (measurementId) measurements.add(measurementId);
      addObservationRow("observation", [measurementId, "endpoint-ph"].filter(Boolean));
    } else if (readInstrument && str(p, "chromatographyMeasurementType")) {
      if (measurementId) measurements.add(measurementId);
      addObservationRow("observation", [measurementId, "ruler-reading"].filter(Boolean));
    } else if (readInstrument && photometerOperation === "read") {
      if (measurementId) measurements.add(measurementId);
      addObservationRow("observation", [measurementId, "photometer-reading"].filter(Boolean));
    } else if (readInstrument && (photometerOperation === "zero" || photometerOperation === "darkZero")) {
      const fallback = photometerOperation === "zero" ? "instrument-blanked" : "photometer-dark-zero";
      addObservationRow(fallback, [photometerOperation === "zero" ? "photometer-zero" : "photometer-dark-zero"]);
    } else if (str(p, "configurationQuantity")) {
      if (measurementId) measurements.add(measurementId);
      addObservationRow("configuration", ["configuration"]);
    } else if (str(p, "instrumentEvidence")) {
      if (measurementId) measurements.add(measurementId);
      tags.add("instrument-reading");
      tags.add("classroom-evidence");
    } else if ((str(p, "inputMode") === "numeric" || p.requireStudentValue === true) && measurementId) {
      measurements.add(measurementId);
      addObservationRow("observation", [measurementId]);
    } else {
      addObservationRow("observation");
      if (measurementId) {
        notes.push(`declares measurementId "${measurementId}" but the generic observe path stores no measurement`);
      }
    }
  } else if (action.verb === "record") {
    const conditionId = str(p, "conditionId");
    const seriesId = str(p, "dataSeriesId") ?? (conditionId ? `${conditionId}-gas-series` : undefined);
    if (interaction === "recordTimeSeries" || str(p, "kineticsModelId")) {
      if (seriesId) {
        dataSeries.add(seriesId);
        tags.add("record");
        tags.add(seriesId);
        tags.add("time-series");
      }
    } else {
      if (measurementId) measurements.add(measurementId);
      tags.add("record");
      if (measurementId) tags.add(measurementId);
    }
  } else if (action.verb === "calculate") {
    const calculationId = str(p, "calculationId");
    if (calculationId) {
      calculations.add(calculationId);
      tags.add("calculate");
      tags.add(calculationId);
    }
  }
  return { measurements, tags, dataSeries, calculations, notes };
};

const ruleLabel = (rule) =>
  `${rule.type}:${rule.measurementId ?? rule.notebookTag ?? rule.dataSeriesId ?? rule.actionId ?? rule.calculationId ?? rule.path ?? ""}`;

const ruleSatisfied = (rule, evidence, selfActionId) => {
  if (rule.type === "actionEvidence") {
    return rule.actionId === selfActionId || evidence.actions.has(rule.actionId);
  }
  if (rule.type === "measurementRecorded") return evidence.measurements.has(rule.measurementId);
  if (rule.type === "notebookEntry") return evidence.tags.has(rule.notebookTag);
  if (rule.type === "dataSeriesRecorded") return evidence.dataSeries.has(rule.dataSeriesId);
  // `calculationWithinTolerance` only needs the calculation to exist: every calculate handler
  // stores an expected value, defaulting to the derived one.
  if (rule.type === "calculationWithinTolerance") return evidence.calculations.has(rule.calculationId);
  return true;
};

const auditWitness = (compiled) => {
  const actions = new Map(compiled.actions.map((action) => [action.id, action]));
  const nodes = new Map(compiled.process.nodes.map((node) => [node.id, node]));
  const outgoing = new Map();
  for (const edge of compiled.process.edges) {
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
  }
  const evidence = {
    actions: new Set(),
    measurements: new Set(),
    tags: new Set(),
    dataSeries: new Set(),
    calculations: new Set(),
  };
  const failures = [];
  const visited = new Set();
  let nodeId = compiled.process.startNodeId;
  let step = 0;
  while (nodeId && !visited.has(nodeId)) {
    visited.add(nodeId);
    step += 1;
    const node = nodes.get(nodeId);
    const action = node?.actionId ? actions.get(node.actionId) : undefined;
    if (action) {
      const p = action.parameters ?? {};
      for (const rule of action.prerequisites ?? []) {
        if (!ruleSatisfied(rule, evidence, action.id)) {
          failures.push(`step ${step}: action "${action.id}" prerequisite ${ruleLabel(rule)} is never produced by an earlier step`);
        }
      }
      const produced = producedEvidence(action);
      for (const note of produced.notes) failures.push(`step ${step}: action "${action.id}" ${note}`);
      if (action.verb === "record" && action.interaction?.type !== "recordTimeSeries" && !str(p, "kineticsModelId")) {
        const measurementId = str(p, "measurementId") ?? action.measurementId;
        const existing = measurementId ? evidence.measurements.has(measurementId) : false;
        const studentSupplies = p.studentValueRequired === true ||
          str(p, "inputMode") === "numeric" || p.requireStudentValue === true;
        if (p.copyExistingMeasurementOnly === true && !existing) {
          failures.push(`step ${step}: action "${action.id}" copies measurement "${measurementId}" that no earlier step reads`);
        }
        if (measurementId && !existing && p.value === undefined && !studentSupplies) {
          failures.push(`step ${step}: action "${action.id}" records "${measurementId}" with no prior measurement and no value`);
        }
      }
      evidence.actions.add(action.id);
      produced.measurements.forEach((id) => evidence.measurements.add(id));
      produced.tags.forEach((tag) => evidence.tags.add(tag));
      produced.dataSeries.forEach((id) => evidence.dataSeries.add(id));
      produced.calculations.forEach((id) => evidence.calculations.add(id));
    }
    for (const rule of node?.validation ?? []) {
      if (!ruleSatisfied(rule, evidence, action?.id)) {
        failures.push(`step ${step}: node "${nodeId}" validation ${ruleLabel(rule)} is never produced`);
      }
    }
    nodeId = (outgoing.get(nodeId) ?? [])[0];
  }
  return { failures, visited, evidence };
};

const labIds = ["marble-statue-kinetics", "crystal-violet-rate-law"];
const extensionActionIds = ["cv11-extension-approval-gate", "cv11-extension-design-hydroxide-series", "cv11-extension-determine-z-and-k"];
const problems = [];

for (const labId of labIds) {
  const lab = read(`public/labs/${labId}.json`);
  assert.equal(lab.actions.every((action) => {
    const interaction = action.interaction?.type ?? "recordNotebook";
    return interaction === "recordNotebook" || interaction === "submitCalculation";
  }), true, `${labId}: a lab-local action still performs a physical or acquisition operation`);
  assert.ok(lab.techniqueInstances.length > 0, `${labId}: no technique instances`);
  assert.ok(lab.reachabilityWitnesses.length > 0, `${labId}: no reachability witness`);

  for (const witness of lab.reachabilityWitnesses) {
    const compiled = await compileLabComposition(lab, resolveTechnique, { witnessId: witness.id });
    const { failures, visited, evidence } = auditWitness(compiled);
    assert.equal(visited.size, compiled.process.nodes.length,
      `${labId}/${witness.id}: ${compiled.process.nodes.length - visited.size} compiled nodes are off the ordered path`);
    problems.push(...failures.map((failure) => `${labId}/${witness.id}: ${failure}`));

    const compiledActionIds = new Set(compiled.actions.map((action) => action.id));
    if (labId === "crystal-violet-rate-law") {
      const approved = witness.approvalGates["analysis-extension.teacher-approved"] === true;
      for (const actionId of extensionActionIds) {
        assert.equal(compiledActionIds.has(actionId), approved,
          `${labId}/${witness.id}: optional extension action "${actionId}" presence must follow the teacher-approval gate`);
      }
    }
    if (labId === "marble-statue-kinetics") {
      // Reactants stay apart until the initiation step, and timing is armed before contact.
      const order = compiled.process.nodes.map((node) => node.actionId);
      for (const instance of lab.techniqueInstances.filter((item) => item.bindings.configuration.selectedProcedure === "trial-acquisition")) {
        const actionIdFor = (sourceId) => instance.preserveIds?.actions?.[sourceId] ?? `${instance.instanceId}--${sourceId}`;
        const pathCheck = order.indexOf(actionIdFor("gas-technique-check-path"));
        const acid = order.indexOf(actionIdFor("gas-technique-transfer-acid"));
        const armed = order.indexOf(actionIdFor("gas-technique-synchronize-start"));
        const contact = order.indexOf(actionIdFor("gas-technique-transfer-marble"));
        const seal = order.indexOf(actionIdFor("gas-technique-seat-stopper"));
        const series = order.indexOf(actionIdFor("gas-technique-record-series"));
        assert.ok(pathCheck >= 0 && acid > pathCheck, `${instance.instanceId}: the gas path is not verified before reactants are staged`);
        assert.ok(armed > acid && contact > armed, `${instance.instanceId}: the timer is not armed between staging and first contact`);
        assert.ok(seal > contact && series > seal, `${instance.instanceId}: sealing and the timed series do not follow first contact`);
      }
    }
    // No compiled step may pre-load the evidence a later acquisition step is supposed to produce.
    for (const action of compiled.actions) {
      if (action.verb !== "record" && action.verb !== "observe") continue;
      const p = action.parameters ?? {};
      assert.ok(!("expected" in p) || action.verb === "calculate",
        `${labId}/${witness.id}: action "${action.id}" stores an expected acquisition result`);
    }
    assert.ok(evidence.measurements.size > 0, `${labId}/${witness.id}: no measurement evidence is produced`);
  }
}

if (problems.length > 0) {
  console.error(`Cycle 08 evidence reachability failures (${problems.length}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exitCode = 1;
} else {
  console.log(`Cycle 08 composition, initiation order, optional-branch and evidence reachability checks passed for ${labIds.length} labs.`);
}
