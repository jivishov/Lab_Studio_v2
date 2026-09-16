import { readFile } from "node:fs/promises";
import { compileLabComposition } from "../src/data/compileLabComposition.ts";
import { validateBundledLabSource, validateLabDefinition, validateTechniqueDefinition } from "../src/domain/validation.ts";

const planningRoot = "planning/2026-08-30_lab-studio-technique-composition-remediation";
const techniqueIds = [
  "transmittance-dilution", "beers-law-calibration", "brass-spectrophotometry",
  "blue1-standard-dilutions", "blue1-percent-transmittance", "blue1-class-calibration",
];
const versions = new Map([
  ["transmittance-dilution", "1.3.0"], ["beers-law-calibration", "1.3.0"], ["brass-spectrophotometry", "1.3.0"],
  ["blue1-standard-dilutions", "1.3.0"], ["blue1-percent-transmittance", "1.3.0"], ["blue1-class-calibration", "1.3.0"],
]);
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const fail = (message) => { throw new Error(message); };
const fidelityFailures = [];
const recordFailure = (message) => fidelityFailures.push(message);
const actionById = (technique, actionId) => technique.actions.find((action) => action.id === actionId);
const normalizedEffect = (effect) => JSON.stringify({
  classes: [...(effect?.classes ?? [])].sort(),
  targets: [...(effect?.targets ?? [])].map((target) => target.domain).sort(),
});
const baseline = await readJson(`${planningRoot}/evidence/CYCLE_05_SHARED_CONTRACT_BASELINE_REVISION_5.json`);
if (baseline.state !== "reviewed-frozen" || baseline.baselineRevision !== 5 || baseline.fileCount !== 1385 || baseline.aggregateSha256 !== "f50e1a3e763193c89df1ddf727d9418dbff0667bdaf77dd486d88f2c09c42cfb") fail("Revision-5 baseline identity changed.");
const runtimeReducerSource = await readFile("src/runtime/reducer.ts", "utf8");
const audit = await readJson(`${planningRoot}/LAB_COMPOSITION_AUDIT.json`);
const atomRegistry = await readJson("src/domain/atomRegistry.json");
const atomsById = new Map(atomRegistry.atoms.map((atom) => [atom.id, atom]));
const techniques = new Map();
const rawTechniques = new Map();
for (const id of techniqueIds) {
  const raw = await readJson(`public/techniques/${id}.json`);
  const result = validateTechniqueDefinition(raw);
  if (!result.ok || !result.value) fail(`${id}:\n${result.errors.join("\n")}`);
  if (raw.metadata.version !== versions.get(id)) fail(`${id} version/pin drift.`);
  if (raw.composition?.schemaVersion !== 1 || raw.composition.catalogDisposition !== "composable") fail(`${id} lacks a composable contract.`);
  const classified = new Set([
    ...raw.actions.filter((action) => action.atomId).map((action) => action.id),
    ...raw.composition.legacyActionEffects.map((row) => row.actionId),
  ]);
  if (classified.size !== raw.actions.length) fail(`${id} has unevaluated actions.`);
  for (const action of raw.actions) {
    for (const key of ["expected", "expectedMassG", "expectedVolumeMl", "value"]) {
      if (key in (action.parameters ?? {})) fail(`${id}/${action.id} embeds hidden output ${key}.`);
    }
    if (action.atomId && action.effect) {
      const atom = atomsById.get(action.atomId);
      if (!atom || normalizedEffect(action.effect) !== normalizedEffect(atom.effectContract)) {
        recordFailure(`${id}/${action.id} overrides its canonical atom effect contract.`);
      }
    }
  }
  rawTechniques.set(id, raw);
  techniques.set(id, result.value);
}

// A composable physical workflow cannot make the apparatus roles used to realize
// the source procedure optional. Optional roles let a lab compile while silently
// omitting the concrete instrument, holder, source, or receiver.
for (const id of [
  "transmittance-dilution", "beers-law-calibration", "brass-spectrophotometry",
  "blue1-standard-dilutions", "blue1-percent-transmittance",
]) {
  const optionalRoles = rawTechniques.get(id).composition.equipmentRoles.filter((role) => role.required !== true);
  if (optionalRoles.length) {
    recordFailure(`${id} leaves source-required equipment roles optional: ${optionalRoles.map((role) => role.roleId).join(", ")}`);
  }
}

// These are source-fidelity invariants, not just schema/coverage assertions. They
// intentionally derive from the Cycle 05 source disposition and the accepted
// accepted atom contracts so that an overlay cannot certify its own content.
for (const id of ["transmittance-dilution", "beers-law-calibration"]) {
  const technique = rawTechniques.get(id);
  const unatomizedBenchActions = technique.composition.legacyActionEffects.filter((row) =>
    row.effect.classes.some((effectClass) => [
      "apparatus-material-instrument-state",
      "measurement-direct-observation-acquisition",
    ].includes(effectClass)));
  if (unatomizedBenchActions.length) {
    recordFailure(`${id} still delegates source-required bench/acquisition work to legacy effects: ${unatomizedBenchActions.map((row) => row.actionId).join(", ")}`);
  }
  const disguisedBenchActions = technique.actions.filter((action) => !action.atomId &&
    /\b(swirl|invert|wipe|orient|fill|insert|transfer|measure|zero)\b/i.test(`${action.label ?? ""} ${action.parameters?.note ?? ""}`));
  if (disguisedBenchActions.length) {
    recordFailure(`${id} classifies physical work as legacy evidence/orchestration: ${disguisedBenchActions.map((action) => action.id).join(", ")}`);
  }
}

const transmittanceTechnique = rawTechniques.get("transmittance-dilution");
const transmittancePreparedReceiver = actionById(transmittanceTechnique, "transmittance-dilution-add-water-below-mark")?.parameters?.targetInstanceId;
const transmittanceReadSource = actionById(transmittanceTechnique, "transmittance-dilution-fill-sample-cuvette")?.parameters?.sourceInstanceId;
if (!transmittancePreparedReceiver || transmittanceReadSource !== transmittancePreparedReceiver) {
  recordFailure("transmittance-dilution does not fill the measured sample cuvette from the just-prepared dilution receiver.");
}
const beersTechnique = rawTechniques.get("beers-law-calibration");
const beersPreparedReceiver = actionById(beersTechnique, "beers-law-calibration-dilute-standard")?.parameters?.targetInstanceId;
const beersReadSource = actionById(beersTechnique, "beers-law-calibration-transfer-standard-cuvette")?.parameters?.sourceInstanceId;
if (!beersPreparedReceiver || beersReadSource !== beersPreparedReceiver) {
  recordFailure("beers-law-calibration does not fill the measured standard cuvette from the just-prepared standard receiver.");
}
if (/0\.0000*1\s*M|2\.5e-7/i.test(JSON.stringify(transmittanceTechnique.initialState))) {
  recordFailure("transmittance-dilution embeds a fixed stock concentration/amount instead of consuming the configured source value.");
}

const blueDilutionTechnique = rawTechniques.get("blue1-standard-dilutions");
const blueDisguisedMixes = blueDilutionTechnique.actions.filter((action) =>
  /-mix$/.test(action.id) && !action.atomId && /\bmix(?:ed)?\b/i.test(`${action.label ?? ""} ${action.parameters?.note ?? ""}`));
if (blueDisguisedMixes.length) {
  recordFailure(`blue1-standard-dilutions classifies physical P-06 mixing as legacy evidence: ${blueDisguisedMixes.map((action) => action.id).join(", ")}`);
}

const bluePercentTechnique = rawTechniques.get("blue1-percent-transmittance");
const blueRangeNode = "i1-classify-unknown-range-node";
const blueRangeEdges = bluePercentTechnique.process.edges.filter((edge) => edge.from === blueRangeNode);
const blueNormalEdge = blueRangeEdges.find((edge) => edge.to === "i1-calculate-raw-unknown-absorbance-node");
const blueDilutionEdge = blueRangeEdges.find((edge) => edge.to === "i1-measure-over-range-unknown-aliquot-node");
const blueRetryEdge = blueRangeEdges.find((edge) => edge.to === blueRangeNode);
if (blueNormalEdge?.condition?.type !== "calculationResult" ||
    blueNormalEdge.condition.calculationId !== "i1-unknown-range-classification" ||
    blueNormalEdge.condition.min !== 0 || blueNormalEdge.condition.max !== 0 ||
    blueDilutionEdge?.condition?.type !== "calculationResult" ||
    blueDilutionEdge.condition.calculationId !== "i1-unknown-range-classification" ||
    blueDilutionEdge.condition.min !== 1 || blueDilutionEdge.condition.max !== 1 ||
    blueRetryEdge?.condition?.type !== "retry" ||
    !Number.isInteger(blueRetryEdge.condition.maxAttempts) || blueRetryEdge.condition.maxAttempts < 1 ||
    blueRangeEdges.some((edge) => edge.condition.type === "validationPassed" || edge.condition.type === "always")) {
  recordFailure("blue1-percent-transmittance does not encode I-05 as a genuine in-range/over-range conditional subgraph with retry semantics.");
}
const blueRangeAction = actionById(bluePercentTechnique, "i1-classify-unknown-range");
const blueRangeTemplate = blueRangeAction?.parameters?.template;
if (blueRangeAction?.parameters?.measurementId !== "i1-unknown-percent-t-recorded" ||
    blueRangeAction?.parameters?.boundMeasurementId !== "i1-approved-instrument-range" ||
    blueRangeAction?.parameters?.comparison !== "below" ||
    typeof blueRangeTemplate !== "string" || !blueRangeTemplate ||
    !runtimeReducerSource.includes(`template === "${blueRangeTemplate}"`)) {
  recordFailure("blue1-percent-transmittance classifies I-05 without a runtime-supported calculation template derived from the recorded I-04 measurement and approved range evidence.");
}
if (bluePercentTechnique.process.edges.some((edge) => edge.from === "i1-remove-unknown-cuvette-node" && edge.to === "i1-measure-over-range-unknown-aliquot-node")) {
  recordFailure("blue1-percent-transmittance still enters the I-05 dilution branch unconditionally.");
}
for (const terminalNodeId of ["i1-calculate-direct-mass-500ml-node", "i1-calculate-diluted-mass-500ml-node"]) {
  if (!bluePercentTechnique.composition.ports.some((port) => port.kind === "exit" && port.nodeId === terminalNodeId)) {
    recordFailure(`blue1-percent-transmittance leaves conditional terminal ${terminalNodeId} unreachable from lab composition.`);
  }
}

const brassTechnique = rawTechniques.get("brass-spectrophotometry");
const scanReads = brassTechnique.actions.filter((action) => /^scan-read-\d+-salt-[ab]-action$/.test(action.id));
const preApprovalScanReads = scanReads.filter((action) => action.parameters?.wavelengthMeasurementId === "{{config.wavelengthMeasurementId}}");
if (preApprovalScanReads.length) {
  recordFailure(`brass-spectrophotometry binds ${preApprovalScanReads.length} prelab scan reads to the later approved-wavelength measurement instead of the source-required scan wavelength setting.`);
}
const saltSpecificPhysicalActions = brassTechnique.actions.filter((action) =>
  action.atomId && /apparatus-material-instrument-state/.test(normalizedEffect(atomsById.get(action.atomId)?.effectContract)) &&
  ["assigned-salt-a", "assigned-salt-b"].includes(action.parameters?.sampleIdentity));
const physicallyPreparedSalts = new Set(saltSpecificPhysicalActions.map((action) => action.parameters.sampleIdentity));
if (physicallyPreparedSalts.size !== 2) {
  recordFailure("brass-spectrophotometry scans two salt labels without concrete salt-specific physical sample preparation/insertion/removal provenance.");
}
const scanSets = new Map(brassTechnique.actions.filter((action) => /^scan-set-\d+-action$/.test(action.id)).map((action) => [action.parameters?.measurementId, action]));
const allScanReads = scanReads;
const danglingScanReadiness = allScanReads.filter((action) => !scanSets.has(action.parameters?.wavelengthMeasurementId));
if (allScanReads.length !== 32 || danglingScanReadiness.length) {
  recordFailure(`brass-spectrophotometry has ${allScanReads.length} scan consumers and ${danglingScanReadiness.length} without a prior source-stated wavelength-readiness producer.`);
}
for (let wavelength = 400; wavelength <= 700; wavelength += 20) {
  for (const salt of ["a", "b"]) {
    const readId = `scan-read-${wavelength}-salt-${salt}-action`;
    const nodeIds = [
      `scan-insert-${wavelength}-salt-${salt}-action-node`,
      `${readId}-node`,
      `scan-record-${wavelength}-salt-${salt}-action-node`,
      `scan-remove-${wavelength}-salt-${salt}-action-node`,
    ];
    if (nodeIds.slice(0, -1).some((nodeId, index) => !new Set(brassTechnique.process.edges.map((edge) => `${edge.from}->${edge.to}`)).has(`${nodeId}->${nodeIds[index + 1]}`))) {
      recordFailure(`brass-spectrophotometry lacks the complete provenance-safe holder lifecycle for salt ${salt.toUpperCase()} at ${wavelength} nm.`);
    }
  }
}
for (const salt of ["a", "b"]) {
  for (const id of [`scan-condition-salt-${salt}-once-action`, `scan-fill-salt-${salt}-once-action`, `scan-prepare-salt-${salt}-once-action`, `scan-return-salt-${salt}-after-series-action`]) {
    if (!actionById(brassTechnique, id)) recordFailure(`brass-spectrophotometry lacks one-time assigned-salt lifecycle action ${id}.`);
  }
}
const requiredSampleAtoms = [
  "atom.rinse.condition-cuvette-with-sample",
  "atom.transfer.fill-cuvette",
  "atom.rinse.prepare-cuvette-optical-faces",
  "atom.place.insert-cuvette",
  "atom.observe.read-photometer",
  "atom.record.photometer-reading",
  "atom.place.remove-cuvette",
  "atom.transfer.return-cuvette-to-origin",
];
const brassAtomCounts = new Map();
for (const action of brassTechnique.actions) {
  if (action.atomId) brassAtomCounts.set(action.atomId, (brassAtomCounts.get(action.atomId) ?? 0) + 1);
}
const incompleteSampleAtoms = requiredSampleAtoms.filter((atomId) => (brassAtomCounts.get(atomId) ?? 0) < 6);
if (incompleteSampleAtoms.length) {
  recordFailure(`brass-spectrophotometry lacks a complete condition/fill/optical-prep/insert/read/record/remove/return sequence for five standards plus unknown: ${incompleteSampleAtoms.join(", ")}`);
}
const sampleIds = ["0p0250", "0p0500", "0p100", "0p200", "0p400", "unknown"];
const requiredSampleEdges = ["condition", "fill", "prepare", "insert", "read", "record", "remove", "return"];
const brassEdges = new Set(brassTechnique.process.edges.map((edge) => `${edge.from}->${edge.to}`));
for (const sampleId of sampleIds) {
  const nodeIds = [
    `condition-${sampleId}`,
    `fill-${sampleId}-cuvette-action-node`,
    `prepare-${sampleId}-optical-faces-action-node`,
    `insert-${sampleId}-cuvette-action-node`,
    `read-${sampleId}-absorbance`,
    `record-${sampleId}-absorbance`,
    `remove-${sampleId}-cuvette-action-node`,
    `return-${sampleId}`,
  ];
  const missingEdges = nodeIds.slice(0, -1).filter((nodeId, index) => !brassEdges.has(`${nodeId}->${nodeIds[index + 1]}`));
  if (missingEdges.length) {
    recordFailure(`brass-spectrophotometry does not enforce the complete ordered ${requiredSampleEdges.join("/")} lifecycle for ${sampleId}.`);
  }
  const fill = actionById(brassTechnique, `fill-${sampleId}-cuvette-action`);
  const returned = actionById(brassTechnique, `return-${sampleId}-action`);
  if (!fill?.parameters?.sourceInstanceId || !returned?.parameters?.targetInstanceId || fill.parameters.sourceInstanceId !== returned.parameters.targetInstanceId) {
    recordFailure(`brass-spectrophotometry does not carry an unambiguous provenance-matched source/return receiver identity for ${sampleId}.`);
  }
}
const unknownTransfer = actionById(brassTechnique, "transfer-prepared-unknown-to-original-tube-action");
if (unknownTransfer?.atomId !== "atom.transfer.measured-liquid" ||
    unknownTransfer?.parameters?.sourceInstanceId !== "unknown-volumetric-flask" ||
    unknownTransfer?.parameters?.targetInstanceId !== "unknown-sample-tube" ||
    Object.keys(unknownTransfer?.parameters ?? {}).some((key) => /volumeMl|expectedVolume|aliquotMl/i.test(key))) {
  recordFailure("brass-spectrophotometry does not carry the prepared unknown from the original volumetric flask into the original unknown tube without inventing an aliquot.");
}
if (!brassEdges.has("return-0p400->transfer-prepared-unknown-to-original-tube-action-node") || !brassEdges.has("transfer-prepared-unknown-to-original-tube-action-node->condition-unknown")) {
  recordFailure("brass-spectrophotometry leaves the prepared-unknown source path disconnected before unknown conditioning and fill.");
}
const boundaryConflictActions = brassTechnique.actions.filter((action) =>
  (action.id === "blank-wipe-orient-action" && /insert|lid (?:is )?closed/i.test(action.parameters?.note ?? "")) ||
  (/^condition-(?:0p\d+|unknown)-action$/.test(action.id) && /measurement-ready|exterior wiped|orientation preserved|filled/i.test(action.parameters?.note ?? "")));
if (boundaryConflictActions.length) {
  recordFailure(`brass-spectrophotometry has atom/prose boundary conflicts: ${boundaryConflictActions.map((action) => action.id).join(", ")}`);
}
const optionalBrassRoles = brassTechnique.composition.equipmentRoles.filter((role) => role.required !== true);
if (optionalBrassRoles.length) {
  recordFailure(`brass-spectrophotometry marks every used equipment role optional instead of requiring concrete role bindings (${optionalBrassRoles.length} roles).`);
}

const labResults = [];
const rawLabs = new Map();
const expectedLabOverlayRows = new Set();
const expectedSourceTraceKeys = new Set([...techniques].flatMap(([id, technique]) =>
  technique.actions.map((action) => `technique:${id}#${action.id}`)));
for (const id of ["blue1-spectroscopy", "brass-colorimetry"]) {
  const raw = await readJson(`public/labs/${id}.json`);
  rawLabs.set(id, raw);
  const source = validateBundledLabSource(raw);
  if (!source.ok || !source.value) fail(`${id} source:\n${source.errors.join("\n")}`);
  if (raw.techniqueRefs) fail(`${id} retains legacy technique imports.`);
  for (const action of raw.actions) expectedSourceTraceKeys.add(`lab:${id}#${action.id}`);
  for (const instance of raw.techniqueInstances) {
    if (instance.version !== versions.get(instance.techniqueId)) fail(`${id}/${instance.instanceId} has a stale exact-version pin.`);
  }
  const physicalBaselineRows = audit.rows.filter((row) => row.labId === id && row.currentActionOrigin.kind === "lab-local" &&
    (row.effect.flags.apparatusMaterialInstrumentState || row.effect.flags.measurementOrDirectObservation));
  const localNodeIds = new Set(raw.process.nodes.map((node) => node.id));
  const retainedPhysical = physicalBaselineRows.filter((row) => localNodeIds.has(row.nodeId));
  if (retainedPhysical.length) fail(`${id} retains lab-local physical/acquisition nodes: ${retainedPhysical.map((row) => row.nodeId).join(", ")}`);
  const compiled = await compileLabComposition(source.value, async (techniqueId) => {
    const technique = techniques.get(techniqueId);
    if (!technique) fail(`${id} references unowned ${techniqueId}.`);
    return structuredClone(technique);
  });
  const compiledResult = validateLabDefinition(compiled);
  if (!compiledResult.ok || !compiledResult.value) fail(`${id} compiled:\n${compiledResult.errors.join("\n")}`);
  const nodeIds = new Set(compiled.process.nodes.map((node) => node.id));
  const actionIds = new Set(compiled.actions.map((action) => action.id));
  if (nodeIds.size !== compiled.process.nodes.length || actionIds.size !== compiled.actions.length) fail(`${id} compilation introduced duplicate public IDs.`);
  for (const node of compiled.process.nodes) expectedLabOverlayRows.add(`${id}#${node.id}`);
  labResults.push(`${id}: ${compiled.process.nodes.length} nodes, ${compiled.compositionManifest.origins.length} technique origins`);
}

const brassLab = rawLabs.get("brass-colorimetry");
const blueLab = rawLabs.get("blue1-spectroscopy");
const roleScopedEquipmentClones = brassLab.initialState.equipment.filter((equipment) => equipment.id.startsWith("cycle05-"));
if (roleScopedEquipmentClones.length) {
  recordFailure(`brass-colorimetry creates ${roleScopedEquipmentClones.length} role-scoped equipment clones instead of binding roles to the existing concrete apparatus instances.`);
}
for (const [owner, definition] of [
  ["blue1-percent-transmittance", bluePercentTechnique], ["blue1-spectroscopy", rawLabs.get("blue1-spectroscopy")],
  ["brass-spectrophotometry", brassTechnique], ["brass-colorimetry", brassLab],
]) {
  const destinationIds = new Set(["i1-blank-cuvette", "i1-unknown-cuvette", "measurement-cuvette", "unknown-sample-tube", "unknown-volumetric-flask", "i1-prepared-unknown-tube", "i1-diluted-unknown-tube", "standard-0p400-tube", "standard-0p200-tube", "standard-0p100-tube", "standard-0p0500-tube", "standard-0p0250-tube"]);
  const prefilled = (definition.initialState?.equipment ?? []).filter((item) =>
    (destinationIds.has(item.id) || item.definitionId === "cuvette") && item.contents?.kind !== "empty");
  if (prefilled.length) recordFailure(`${owner} pre-fills destination holders before authored fill actions: ${prefilled.map((item) => item.id).join(", ")}`);
}

const forbiddenLocalBenchActions = new Map([
  ["blue1-spectroscopy", ["i1-prepare-unknown-under-approved-plan", "i1-record-over-range-response"]],
  ["brass-colorimetry", [
    "teacher-add-water-action", "mix-unknown-action",
    "standard-0p400-mix-action", "standard-0p200-mix-action", "standard-0p100-mix-action",
    "standard-0p0500-mix-action", "standard-0p0250-mix-action", "cleanup-action",
  ]],
]);
for (const [labId, actionIds] of forbiddenLocalBenchActions) {
  const localActionIds = new Set(rawLabs.get(labId).actions.map((action) => action.id));
  const retained = actionIds.filter((actionId) => localActionIds.has(actionId));
  if (retained.length) recordFailure(`${labId} retains lab-local physical/scientific-state or measurement work: ${retained.join(", ")}`);
}
const brassInstance = rawLabs.get("brass-colorimetry").techniqueInstances.find((instance) => instance.techniqueId === "brass-spectrophotometry");
if (!brassInstance || Object.keys(brassInstance.bindings?.equipment ?? {}).length === 0) {
  recordFailure("brass-colorimetry does not bind the technique's equipment roles to concrete lab instances.");
}
const evidenceIdsProducedBy = (definitions) => new Set(definitions.flatMap((definition) => definition.actions.flatMap((action) =>
  [action.parameters?.measurementId, action.parameters?.calculationId].filter((value) => typeof value === "string" && !value.includes("{{config.")))));
const blueProducedEvidenceIds = evidenceIdsProducedBy([blueLab, bluePercentTechnique]);
const approvedRangeEvidenceId = "i1-approved-instrument-range";
if (!blueProducedEvidenceIds.has(approvedRangeEvidenceId)) {
  recordFailure("blue1-spectroscopy binds I-05 to an approved instrument-range evidence id that no lab or technique action produces.");
}
const brassProducedEvidenceIds = evidenceIdsProducedBy([brassLab, brassTechnique]);
for (const evidenceId of ["brass-spectrophotometry--approved-standard-final-volume", "brass-spectrophotometry--approved-unknown-final-volume"]) {
  if (!brassProducedEvidenceIds.has(evidenceId)) {
    recordFailure(`brass-spectrophotometry consumes endpoint ${evidenceId} without a typed producer.`);
  }
}
const learnerFacingBrassText = JSON.stringify({
  techniqueActions: brassTechnique.actions,
  labActions: rawLabs.get("brass-colorimetry").actions,
  labNodes: rawLabs.get("brass-colorimetry").process.nodes,
});
for (const [pattern, description] of [
  [/configured noiseless teaching profile/i, "configured scan answer profile"],
  [/configured teaching-profile reading/i, "configured absorbance answer"],
  [/\b0\.160 M\b/i, "unknown-molarity answer"],
  [/\b1\.250 g\b/i, "recorded-mass answer"],
  [/\b81\.2%|\b80\.7%|\b3\.4%/i, "class-result answer"],
]) {
  if (pattern.test(learnerFacingBrassText)) recordFailure(`brass-colorimetry exposes a learner-facing ${description}.`);
}
const nonScanBrassText = JSON.stringify({
  techniqueActions: brassTechnique.actions.filter((action) => !action.id.startsWith("scan-")),
  labActions: brassLab.actions,
  labNodes: brassLab.process.nodes,
});
for (const [pattern, description] of [
  [/state\.(?:358|060|117|224|449|882)\s+AU/i, "fixed absorbance reading"],
  [/\(0\.0250\s*M,\s*0\.060\s*AU\).*\(0\.400\s*M,\s*0\.882\s*AU\)/i, "fixed calibration data table"],
  [/\b620\s*nm\b/i, "fixed approved wavelength"],
]) {
  if (pattern.test(nonScanBrassText)) recordFailure(`brass-colorimetry exposes a learner-facing ${description}.`);
}
if (/"massG":1\.25|"amount":1\.25/.test(JSON.stringify(brassLab.initialState))) {
  recordFailure("brass-colorimetry preloads the brass sample's measured mass as client-visible simulator truth.");
}
if (actionById(brassTechnique, "prepare-blank-action")?.parameters?.volumeMl === 3) {
  recordFailure("brass-spectrophotometry invents a fixed 3 mL blank fill instead of preserving the source/configured fill rule.");
}
for (const sampleId of ["0p200", "0p100", "0p0500", "0p0250"]) {
  const transfer = actionById(brassTechnique, `standard-${sampleId}-stock-transfer-action`);
  const dilute = actionById(brassTechnique, `standard-${sampleId}-dilute-action`);
  if (transfer?.volume?.source !== "calculation" || transfer.volume.referenceId !== `brass-spectrophotometry--standard-${sampleId}-aliquot-ml` || "volumeMl" in (transfer.parameters ?? {})) {
    recordFailure(`brass-spectrophotometry does not consume learner calculation evidence for ${sampleId} stock transfer.`);
  }
  if (dilute?.volume?.source !== "measurement" || dilute.volume.referenceId !== "brass-spectrophotometry--approved-standard-final-volume" || "volumeMl" in (dilute.parameters ?? {})) {
    recordFailure(`brass-spectrophotometry embeds or omits the configured final-volume endpoint for ${sampleId}.`);
  }
}
const calculatedStandardTransfers = ["0p200", "0p100", "0p0500", "0p0250"].map((sampleId) =>
  actionById(brassTechnique, `standard-${sampleId}-stock-transfer-action`));
if (calculatedStandardTransfers.some((action) =>
  action?.volume?.source !== "calculation" || !action.volume.referenceId)) {
  recordFailure("brass-spectrophotometry names D-01 calculation ids on stock transfers, but the physical transfer path does not consume that learner calculation evidence to determine the delivered volume.");
}
const unknownDilution = actionById(brassTechnique, "dilute-unknown-to-mark-action");
if (unknownDilution?.volume?.source !== "measurement" || unknownDilution.volume.referenceId !== "brass-spectrophotometry--approved-unknown-final-volume" || "volumeMl" in (unknownDilution.parameters ?? {})) {
  recordFailure("brass-spectrophotometry retains the unsupported B-11 30 mL addition or lacks an approved final-volume endpoint.");
}
if (/learner-measured absorbances\.0250|\b(?:0\.060|0\.117|0\.224|0\.449|0\.882)\s*AU\b|configured teaching-profile reading|\b(?:0\.160\s*M|1\.250\s*g|81\.2%|80\.7%)\b/i.test(learnerFacingBrassText)) {
  recordFailure("brass-colorimetry retains fixed results or malformed answer fragments in learner/client-visible fields.");
}
const preparedUnknownSource = brassTechnique.initialState.equipment.find((item) => item.id === "unknown-volumetric-flask");
const originalUnknownReceiver = brassTechnique.initialState.equipment.find((item) => item.id === "unknown-sample-tube");
if (unknownTransfer &&
    !Object.keys(unknownTransfer.parameters ?? {}).some((key) => /volumeMl|volumeMeasurementId|calculationEvidenceId|portionRule/i.test(key)) &&
    runtimeReducerSource.includes("params.volumeMl ?? source?.contents.volumeMl")) {
  recordFailure("brass-spectrophotometry's volume-unspecified flask-to-tube action falls through to a whole-source transfer instead of a bounded prepared-sample portion.");
}
if (preparedUnknownSource?.contents?.kind !== "empty" || originalUnknownReceiver?.contents?.kind !== "empty") {
  recordFailure("brass-spectrophotometry does not start both the prepared-unknown flask and original unknown tube empty.");
}
const saltSources = ["assigned-salt-a-solution", "assigned-salt-b-solution"].map((instanceId) =>
  brassLab.initialState.equipment.find((item) => item.id === instanceId));
const saltInventoryActions = ["a", "b"].map((salt) => actionById(brassTechnique, `scan-configure-salt-${salt}-inventory-action`));
if (saltSources.some((source) => source?.contents?.kind !== "solution" || source.contents.volumeMl !== undefined) ||
    saltInventoryActions.some((action) => action?.verb !== "observe" || !action.sourceInventory || action.parameters?.inputMode !== "numeric" || action.parameters?.inputRole !== "teacherConfiguration")) {
  recordFailure("brass-colorimetry's assigned-salt sources have no usable configured liquid volume for the authored condition/fill/return scan lifecycle.");
}

// Consolidated xhigh correction invariants: keep these narrow and structural so
// the verifier cannot become green again on prose-only or mismatched evidence.
for (const sampleId of ["0p0250", "0p0500", "0p100", "0p200", "0p400", "unknown"]) {
  const expected = `${sampleId}-absorbance-au`;
  const read = actionById(brassTechnique, `read-${sampleId}-absorbance-action`);
  const record = actionById(brassTechnique, `record-${sampleId}-absorbance-action`);
  const recordedPrerequisites = (record?.prerequisites ?? []).filter((rule) => rule.type === "measurementRecorded");
  if (read?.parameters?.measurementId !== expected || record?.parameters?.measurementId !== expected ||
      recordedPrerequisites.length !== 1 || recordedPrerequisites[0].measurementId !== expected) {
    recordFailure(`brass-spectrophotometry does not align the read, record, and prerequisite identity ${expected}.`);
  }
}

const bluePercent = rawTechniques.get("blue1-percent-transmittance");
const replicateCountAction = actionById(bluePercent, "i1-record-approved-unknown-replicate-count");
const rawUnknownRead = actionById(bluePercent, "i1-read-unknown-percent-t");
const dilutedUnknownRead = actionById(bluePercent, "i1-read-diluted-unknown-percent-t");
if (replicateCountAction?.parameters?.inputMode !== "numeric" || replicateCountAction.parameters.inputRole !== "teacherConfiguration" ||
    replicateCountAction.parameters.inputStep !== 1 || replicateCountAction.parameters.unit !== "count" ||
    replicateCountAction.parameters.measurementId !== "i1-approved-unknown-replicate-count") {
  recordFailure("blue1-percent-transmittance lacks an evidence-producing teacher-configured integer replicate count.");
}
for (const [read, outputMeasurementId, progressId] of [
  [rawUnknownRead, "i1-unknown-percent-t", "i1-raw-unknown-readings"],
  [dilutedUnknownRead, "i1-diluted-unknown-percent-t", "i1-diluted-unknown-readings"],
]) {
  if (read?.parameters?.inputMode !== "numeric" || read.parameters.inputRole !== "studentResponse" ||
      read.runtimeRepeat?.countMeasurementId !== "i1-approved-unknown-replicate-count" ||
      read.runtimeRepeat?.outputMeasurementId !== outputMeasurementId || read.runtimeRepeat?.progressId !== progressId) {
    recordFailure(`blue1-percent-transmittance does not execute configured repeated numeric acquisition for ${outputMeasurementId}.`);
  }
}
const rawRecordAlias = actionById(bluePercent, "i1-record-unknown-percent-t");
const dilutedRecordAlias = actionById(bluePercent, "i1-record-diluted-unknown-percent-t");
const rawAbsorbanceConsumer = actionById(bluePercent, "i1-calculate-raw-unknown-absorbance");
const dilutedAbsorbanceConsumer = actionById(bluePercent, "i1-calculate-diluted-unknown-absorbance");
if (rawRecordAlias?.parameters?.sourceMeasurementId !== rawUnknownRead?.runtimeRepeat?.outputMeasurementId ||
    rawRecordAlias.prerequisites?.find((rule) => rule.type === "measurementRecorded")?.measurementId !== rawUnknownRead.runtimeRepeat.outputMeasurementId ||
    dilutedRecordAlias?.parameters?.sourceMeasurementId !== dilutedUnknownRead?.runtimeRepeat?.outputMeasurementId ||
    dilutedRecordAlias.prerequisites?.find((rule) => rule.type === "measurementRecorded")?.measurementId !== dilutedUnknownRead.runtimeRepeat.outputMeasurementId ||
    rawAbsorbanceConsumer?.parameters?.percentTransmittanceMeasurementId !== rawUnknownRead.runtimeRepeat.outputMeasurementId ||
    dilutedAbsorbanceConsumer?.parameters?.percentTransmittanceMeasurementId !== dilutedUnknownRead.runtimeRepeat.outputMeasurementId) {
  recordFailure("blue1-percent-transmittance does not bind each stable runtime-repeat alias to its exact downstream measurement consumers.");
}

const brassNodeId = (actionId) => brassTechnique.process.nodes.find((node) => node.actionId === actionId)?.id;
const visualSequence = [
  "fill-color-depth-unknown-action", "fill-color-depth-standard-action", "place-color-depth-comparison-action",
  "visual-match-action", "record-unknown-depth-action", "record-standard-depth-action",
];
if (visualSequence.some((id) => !actionById(brassTechnique, id)) || visualSequence.slice(1).some((id, index) =>
  !brassEdges.has(`${brassNodeId(visualSequence[index])}->${brassNodeId(id)}`))) {
  recordFailure("brass-spectrophotometry does not physically fill and stage both comparison columns before one-sided matching and separate depth acquisitions.");
}
const visualMatch = actionById(brassTechnique, "visual-match-action");
if (visualMatch?.parameters?.sourceInstanceId !== "color-depth-standard-tube" || visualMatch.parameters.targetInstanceId !== "waste-beaker" ||
    visualMatch.volume?.source !== "action-input" || visualMatch.equipmentRoleBindings?.["waste-receiver"] !== "waste-beaker") {
  recordFailure("brass-spectrophotometry does not make the color match a one-sided, learner-entered standard removal into waste.");
}
const comparisonInstances = new Set(brassTechnique.initialState.equipment.filter((item) => item.contents?.kind === "empty").map((item) => item.id));
if (!comparisonInstances.has("color-depth-unknown-tube") || !comparisonInstances.has("color-depth-standard-tube")) {
  recordFailure("brass-spectrophotometry preloads or omits the two empty physical comparison tubes.");
}

const wasteSources = ["0p0250", "0p0500", "0p100", "0p200", "0p400", "unknown"];
const collectWasteActions = wasteSources.map((sample) => actionById(brassTechnique, `collect-${sample}-waste-action`));
if (collectWasteActions.some((action) => action?.verb !== "transfer" || action.parameters?.targetInstanceId !== "waste-beaker" || action.interaction?.type !== "pourInto")) {
  recordFailure("brass-spectrophotometry does not physically collect every returned standard and unknown solution in the treatment beaker.");
}
const bicarbonate = actionById(brassTechnique, "neutralize-waste-action");
const bubbling = actionById(brassTechnique, "observe-waste-bubbling-action");
const phRead = actionById(brassTechnique, "record-waste-ph-action");
const phDisposition = actionById(brassTechnique, "classify-waste-ph-action");
if (bicarbonate?.parameters?.inputMode !== "numeric" || bicarbonate.parameters.inputRole !== "studentResponse" ||
    bubbling?.choiceObservation?.outputCalculationId !== "waste-bubbling-disposition" || bubbling.choiceObservation.options.length !== 2) {
  recordFailure("brass-spectrophotometry lacks incremental typed bicarbonate treatment followed by a two-state bubbling observation.");
}
if (phRead?.parameters?.inputMin !== 0 || phRead.parameters.inputMax !== 14 ||
    phDisposition?.choiceObservation?.outputCalculationId !== "waste-ph-disposition" ||
    !brassTechnique.process.edges.some((edge) => edge.from === brassNodeId(phDisposition.id) && edge.to === brassNodeId(bicarbonate.id) && edge.condition?.calculationId === "waste-ph-disposition" && edge.condition.max === 0)) {
  recordFailure("brass-spectrophotometry blocks or omits an out-of-range pH retreat and fresh-treatment retry.");
}
const teacherDestination = actionById(brassLab, "teacher-disposal-gate-action");
const finalDisposal = actionById(brassTechnique, "transfer-treated-waste-to-destination-action");
const finalConnection = brassLab.compositionConnections.find((row) => row.id === "brass-cross-33");
if (teacherDestination?.parameters?.inputMode !== "text" || teacherDestination.parameters.inputRole !== "teacherConfiguration" ||
    finalDisposal?.parameters?.sourceInstanceId !== "waste-beaker" || finalDisposal.parameters.targetInstanceId !== "teacher-designated-disposal-receiver" ||
    finalDisposal.interaction?.type !== "pourInto" || finalConnection?.from?.nodeId !== brassLab.process.nodes.find((node) => node.actionId === teacherDestination.id)?.id ||
    finalConnection?.to?.portId !== `entry-${brassNodeId(finalDisposal.id)}`) {
  recordFailure("brass-colorimetry does not require a teacher-configured destination before the final physical disposal transfer.");
}

const expectedTechniqueOverlayRows = new Set();
for (const [id, technique] of techniques) {
  for (const action of technique.actions) expectedTechniqueOverlayRows.add(`${id}@${versions.get(id)}#${action.id}`);
}

for (const file of ["technique-atomicity-overlay.json", "lab-composition-overlay.json", "source-trace-overlay.json"]) {
  const overlay = await readJson(`${planningRoot}/evidence/lane-05/${file}`);
  if (overlay.baselineRevision !== 5 || overlay.rows.some((row) => row.evaluated !== true)) fail(`${file} has stale or unevaluated rows.`);
  if (new Set(overlay.owners).size !== overlay.owners.length) fail(`${file} repeats an owner.`);
  const rowIds = new Set(overlay.rows.map((row) => row.rowId));
  if (rowIds.size !== overlay.rows.length) fail(`${file} repeats a row identity.`);
  if (file === "technique-atomicity-overlay.json" && (rowIds.size !== expectedTechniqueOverlayRows.size || [...rowIds].some((id) => !expectedTechniqueOverlayRows.has(id)))) fail(`${file} does not cover exactly the final owned action rows.`);
  if (file === "lab-composition-overlay.json" && (rowIds.size !== expectedLabOverlayRows.size || [...rowIds].some((id) => !expectedLabOverlayRows.has(id)))) fail(`${file} does not cover exactly the compiled owned lab nodes.`);
  if (file === "source-trace-overlay.json") {
    if (overlay.rows.length !== expectedSourceTraceKeys.size || overlay.rows.some((row) => !expectedSourceTraceKeys.has(`${row.owner}#${row.actionId}`))) fail(`${file} does not cover exactly the final owned action keys.`);
    const missingExactLocator = overlay.rows.filter((row) => !row.sourceTable || !row.step || /\bper (?:investigation|source)\b/i.test(row.basis ?? ""));
    if (missingExactLocator.length) {
      recordFailure(`${file} has ${missingExactLocator.length} generic rows without an applicable source-table/step locator.`);
    }
    const missingAtomIdentity = overlay.rows.filter((row) => {
      if (!row.owner.startsWith("technique:")) return false;
      const technique = rawTechniques.get(row.owner.slice("technique:".length));
      const action = technique?.actions.find((candidate) => candidate.id === row.actionId);
      return Boolean(action?.atomId) && row.atomId !== action.atomId;
    });
    if (missingAtomIdentity.length) {
      recordFailure(`${file} omits the accepted atom identity for ${missingAtomIdentity.length} atom-backed technique rows.`);
    }
    for (const [groupName, entries] of Object.entries(overlay.reconciliation ?? {})) {
      for (const entry of entries) {
        const replacements = entry.replacements ?? (entry.replacementLocator ? [entry.replacementLocator] : []);
        if (replacements.length !== 1) {
          recordFailure(`${file} reconciliation ${groupName} is not exact for ${entry.frozenActionId ?? entry.reviewStopActionId ?? entry.actionId ?? "unknown"}: ${replacements.length} replacements.`);
          continue;
        }
        const replacement = replacements[0];
        if (!replacement.owner || !replacement.actionId || !replacement.sourceFile || !replacement.sourceTable || !replacement.step || !replacement.basis || !replacement.disposition || !replacement.effect) {
          recordFailure(`${file} reconciliation ${groupName} has an incomplete replacement locator for ${replacement.actionId ?? "unknown"}.`);
        }
      }
    }
  }
  if (file === "technique-atomicity-overlay.json") {
    const contradictedEffects = overlay.rows.filter((row) => {
      const technique = rawTechniques.get(row.techniqueId);
      const action = technique?.actions.find((candidate) => candidate.id === row.actionId);
      const canonical = action?.atomId ? atomsById.get(action.atomId)?.effectContract : action?.effect;
      return canonical && normalizedEffect(row.effectDecision) !== normalizedEffect(canonical);
    });
    if (contradictedEffects.length) {
      recordFailure(`${file} has ${contradictedEffects.length} effect decisions that do not match the final action/atom contracts.`);
    }
  }
  if (file === "lab-composition-overlay.json") {
    const internallyContradictoryPhysicalRows = overlay.rows.filter((row) =>
      /Technique-owned physical\/acquisition operation/i.test(row.sourceConflictDisposition ?? "") &&
      !row.effectDecision?.classes?.some((effectClass) => [
        "apparatus-material-instrument-state", "measurement-direct-observation-acquisition",
      ].includes(effectClass)));
    if (internallyContradictoryPhysicalRows.length) {
      recordFailure(`${file} labels ${internallyContradictoryPhysicalRows.length} rows physical/acquisition while assigning only nonphysical effects.`);
    }
  }
}
if (fidelityFailures.length) fail(`Cycle 05 independent fidelity invariants failed:\n- ${fidelityFailures.join("\n- ")}`);
console.log(`Cycle 05 spectroscopy: ${techniqueIds.length} techniques validated; ${labResults.join("; ")}.`);
