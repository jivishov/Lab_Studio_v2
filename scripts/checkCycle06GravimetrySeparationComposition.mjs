import { readFile } from "node:fs/promises";
import { compileLabComposition } from "../src/data/compileLabComposition.ts";
import { applyLabSetup } from "../src/data/labSetup.ts";
import { validateBundledLabSource, validateLabDefinition, validateTechniqueDefinition } from "../src/domain/validation.ts";

const planRoot = "planning/2026-08-30_lab-studio-technique-composition-remediation";
const versions = new Map([
  ["hard-water-gravimetry", "1.1.0"],
  ["hard-water-practice-preparation", "1.2.0"],
  ["gravimetric-vacuum-filtration", "1.2.0"],
  ["two-stage-precipitate-drying", "1.2.0"],
  ["inquiry-plan-approval", "1.2.0"],
  ["hard-water-two-sample-inquiry", "1.2.0"],
  ["paper-chromatography", "1.2.0"],
  ["bonding-solids-tests", "1.2.0"],
  ["tablet-separation", "1.1.0"],
  ["quick-ache-property-evidence", "1.2.0"],
  ["quick-ache-design-approval", "1.2.0"],
  ["quick-ache-extraction-recovery", "1.3.0"],
  ["quick-ache-analysis-report", "1.2.0"],
]);
const labIds = ["hard-water-analysis", "paper-chromatography", "bonding-unknown-solids", "quick-ache-relief-separation"];
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const fail = (message) => { throw new Error(message); };
const baseline = await readJson(`${planRoot}/evidence/CYCLE_08_SHARED_CONTRACT_BASELINE_REVISION_8.json`);
if (baseline.baselineRevision !== 8 || baseline.state !== "reviewed-frozen" || baseline.fileCount !== 1397 || baseline.aggregateSha256 !== "3fa1f0ab4fb61215542f397e675c3028ae811f17cf6a692aaf4e253f9c805e8b") {
  fail("Revision-8 baseline identity changed.");
}

const atoms = new Map((await readJson("src/domain/atomRegistry.json")).atoms.map((atom) => [atom.id, atom]));
const techniques = new Map();
const expectedTechniqueRows = new Set();
for (const [id, version] of versions) {
  const raw = await readJson(`public/techniques/${id}.json`);
  const result = validateTechniqueDefinition(raw);
  if (!result.ok || !result.value) fail(`${id} technique:\n${result.errors.join("\n")}`);
  if (raw.metadata.version !== version) fail(`${id} version drift: ${raw.metadata.version} !== ${version}.`);
  if (raw.composition?.schemaVersion !== 1 || raw.composition.catalogDisposition !== "composable") fail(`${id} lacks its composable contract.`);
  const classified = new Set([
    ...raw.actions.filter((action) => action.atomId && atoms.has(action.atomId)).map((action) => action.id),
    ...(raw.composition.legacyActionEffects ?? []).map((row) => row.actionId),
  ]);
  if (classified.size !== raw.actions.length || raw.actions.some((action) => !classified.has(action.id))) fail(`${id} has an unclassified action.`);
  for (const action of raw.actions) {
    expectedTechniqueRows.add(`${id}@${version}#${action.id}`);
    if (["expected", "expectedMassG", "expectedVolumeMl", "expectedIdentity", "expectedResult"].some((key) => key in (action.parameters ?? {}))) {
      fail(`${id}/${action.id} embeds an expected-result substitute.`);
    }
  }
  techniques.set(id, result.value);
}

const requireActions = (techniqueId, actionIds) => {
  const actionSet = new Set(techniques.get(techniqueId).actions.map((action) => action.id));
  const missing = actionIds.filter((id) => !actionSet.has(id));
  if (missing.length) fail(`${techniqueId} misses required atomic boundaries: ${missing.join(", ")}`);
};
requireActions("hard-water-practice-preparation", ["add-sodium-carbonate-solid", "weigh-sodium-carbonate", "record-sodium-carbonate", "add-calcium-chloride-solid", "weigh-calcium-chloride", "record-calcium-chloride", "add-carbonate-portion-1", "observe-carbonate-portion-1", "add-carbonate-portion-4", "observe-carbonate-portion-4", "age-practice-precipitate"]);
requireActions("gravimetric-vacuum-filtration", ["weigh-practice-filter-paper", "record-practice-filter-paper", "place-practice-buchner", "seat-practice-filter-paper", "attach-practice-filter-flask", "place-practice-vacuum", "wet-practice-filter-paper", "filter-practice-mixture", "rinse-practice-beaker", "wash-practice-precipitate"]);
requireActions("two-stage-precipitate-drying", ["first-practice-drying", "remove-warm-practice-watch", "break-practice-precipitate", "second-practice-drying", "cool-practice-assembly", "weigh-practice-combined", "record-practice-combined"]);
requireActions("paper-chromatography", ["draw-water-baseline", "spot-water-sample", "dry-water-spot", "develop-water-paper", "remove-water-paper", "mark-water-front", "measure-water-solvent-front", "record-water-solvent-front", "dispose-water-solvent", "draw-propanol-baseline", "spot-propanol-sample", "measure-propanol-solvent-front", "record-propanol-solvent-front", "dispose-propanol-solvent"]);
requireActions("bonding-solids-tests", ["label-test-locations", "dispense-water-microsample", "read-aqueous-conductivity", "dispose-dry-test-line", "complete-sample-matrix"]);
requireActions("quick-ache-property-evidence", ["qar-transfer-sucrose-test-portion", "qar-apply-sucrose-approved-property-test", "qar-inspect-sucrose-property-result", "qar-record-sucrose-properties", "qar-transfer-acetaminophen-test-portion", "qar-inspect-acetaminophen-property-result", "qar-transfer-aspirin-test-portion", "qar-inspect-aspirin-property-result"]);
requireActions("quick-ache-extraction-recovery", ["qar-record-starting-mass", "qar-record-starting-mass-evidence", "qar-mix-and-vent", "qar-vent-extraction-funnel", "qar-settle-and-observe-layers", "qar-inspect-separated-layers", "qar-identify-layer-from-evidence", "qar-drain-lower-layer", "qar-drain-upper-layer", "qar-dry-organic-phase-with-mgso4", "qar-filter-recovered-solid", "qar-dry-acidic-solid", "qar-cool-acidic-solid", "qar-weigh-acidic-solid", "qar-weigh-organic-solid", "qar-weigh-aqueous-solid"]);
const quickAcheProperty = techniques.get("quick-ache-property-evidence");
const propertyVessels = ["sucrose", "acetaminophen", "aspirin"].map((component) =>
  quickAcheProperty.actions.find((action) => action.id === `qar-transfer-${component}-test-portion`)?.parameters?.targetInstanceId,
);
if (propertyVessels.some((id) => typeof id !== "string") || new Set(propertyVessels).size !== 3) {
  fail("QuickAche pure-component property tests do not use three isolated vessels.");
}

const bonding = techniques.get("bonding-solids-tests");
if (bonding.actions.length !== 40 || bonding.process.nodes.length !== 40 || bonding.process.edges.length !== 39) fail("Bonding requires the supported 40-operation per-sample contract.");
for (const action of bonding.actions.filter((item) => item.id.startsWith("dispense-"))) {
  if (action.mass?.source !== "configured-input" || action.parameters.inputRole !== "teacherConfiguration") fail("Microsample delivery requires a typed configured mass input.");
}
for (const action of bonding.actions.filter((item) => item.id.startsWith("apply-"))) if (action.volume?.source !== "action-input" || action.parameters.inputRole !== "teacherConfiguration") fail("Reagent amount lacks a real volume input contract.");
if (bonding.actions.some((action) => action.id === "read-solid-conductivity")) fail("This panel must not apply a metal-only conductivity test to arbitrary solids.");
for (const action of bonding.actions) {
  if (action.parameters.evidenceScopeSlotId !== "{{config.evidenceScopeId}}") fail("Bonding action lacks configured sample evidence scope.");
}

const sampleEvidence = (technique, prefix) => new Set(technique.actions.filter((action) => action.id.startsWith(prefix)).flatMap((action) => [action.parameters?.measurementId, action.parameters?.calculationId].filter(Boolean)));
const hardWaterInquiry = techniques.get("hard-water-two-sample-inquiry");
const sampleC = sampleEvidence(hardWaterInquiry, "unknown-c-");
const sampleD = sampleEvidence(hardWaterInquiry, "unknown-d-");
if ([...sampleC].some((id) => sampleD.has(id))) fail("Hard-water Sample C and D share measurement/calculation evidence IDs.");
const paper = techniques.get("paper-chromatography");
const waterIds = new Set(paper.actions.filter((action) => action.id.includes("water")).flatMap((action) => [action.parameters?.measurementId, action.parameters?.calculationId].filter(Boolean)));
const propanolIds = new Set(paper.actions.filter((action) => action.id.includes("propanol")).flatMap((action) => [action.parameters?.measurementId, action.parameters?.calculationId].filter(Boolean)));
if ([...waterIds].some((id) => propanolIds.has(id))) fail("Chromatography solvent trials share measurement/calculation evidence IDs.");

for (const [id, technique] of techniques) for (const action of technique.actions.filter((item) => item.verb === "weigh")) {
  const supported = action.mass?.source === "action-input" && typeof action.mass.outputMeasurementId === "string" && !action.mass.applyToSourceInventory;
  const guarded = action.parameters.unlocked === false && action.prerequisites.some((rule) => rule.path === "unsupportedMassOutputBindingApproved");
  if (!supported && !guarded) fail(`${id}/${action.id} still compares learner mass against a contents/zero fallback.`);
}
// Semantic source boundaries: these checks do not claim browser/runtime execution.
for (const action of paper.actions.filter((action) => action.parameters.chromatographyOperation)) {
  if (!action.atomId || !atoms.get(action.atomId)?.effectContract.classes.includes("apparatus-material-instrument-state")) fail("Chromatography paper mutation is misclassified as notebook evidence.");
}
for (const id of ["two-stage-precipitate-drying", "hard-water-two-sample-inquiry"]) {
  const technique = techniques.get(id);
  for (const action of technique.actions.filter((item) => item.analysis?.type === "massDifferenceWithinTolerance")) {
    const { firstMassMeasurementId, secondMassMeasurementId, toleranceMeasurementId, outputCalculationId } = action.analysis;
    if (firstMassMeasurementId === secondMassMeasurementId) fail("Constant mass reused one reading twice.");
    const tolerance = technique.actions.find((item) => item.parameters.measurementId === toleranceMeasurementId);
    if (tolerance?.parameters.inputRole !== "teacherConfiguration" || "configuredValue" in tolerance.parameters) fail("Constant-mass criterion is not explicit teacher input.");
    if (!action.prerequisites.some((rule) => rule.actionId === tolerance.id)) fail("Constant-mass comparison lacks the instructor criterion gate.");
    const node = technique.process.nodes.find((item) => item.actionId === action.id);
    const exits = technique.process.edges.filter((edge) => edge.from === node.id && edge.condition.calculationId === outputCalculationId);
    const rejected = exits.find((edge) => edge.condition.min === 0);
    if (!rejected || !exits.some((edge) => edge.condition.min === 1)) fail("Constant-mass result lacks blocked/accepted branches.");
    const accepted = exits.find((edge) => edge.condition.min === 1);
    const finalNode = technique.process.nodes.find((item) => item.id === accepted.to);
    const finalWeigh = technique.actions.find((item) => item.id === finalNode?.actionId);
    if (finalWeigh?.verb !== "weigh" || finalWeigh.mass?.source !== "action-input") fail("Accepted comparison must acquire the current final mass rather than reuse initial evidence.");
    const prefix = action.id.split(/-compare-constant-mass|-cycle-\d+-compare/)[0];
    const choiceNode = technique.process.nodes.find((item) => item.actionId === `${prefix}-constant-mass-choice`);
    if (!technique.process.edges.some((edge) => edge.from === choiceNode?.id && edge.condition.min === 0 && edge.to === accepted.to)) fail("No-extra-cycle and accepted-comparison paths must share the fresh final mass acquisition.");
    const blockedNode = technique.process.nodes.find((item) => item.id === rejected.to);
    const blockedAction = technique.actions.find((item) => item.id === blockedNode?.actionId);
    if (blockedAction?.verb !== "dry" && (!blockedAction?.evidence.includes("criterion-not-reached") || technique.process.edges.some((edge) => edge.from === rejected.to))) fail("Out-of-tolerance mass must reheat a fresh cycle or end without accepted mass.");
  }
  if (!technique.actions.some((action) => action.id.includes("choose-filtration")) && id === "hard-water-two-sample-inquiry") fail("Hard-water samples lack configured filtration branches.");
}
const extraction = techniques.get("quick-ache-extraction-recovery");
for (const verb of ["mix", "vent", "settle"]) {
  const action = extraction.actions.find((item) => item.extractionOperation?.operation === verb);
  if (!action || action.verb !== verb || !action.extractionOperation.requiredControlActionIds.every((id) => action.prerequisites.some((rule) => rule.type === "actionEvidence" && rule.actionId === id))) fail(`Extraction ${verb} lacks physical/control semantics.`);
}
const settled = extraction.actions.find((action) => action.extractionOperation?.operation === "settle");
if (!settled.prerequisites.some((rule) => rule.actionId === "qar-vent-extraction-funnel") || settled.prerequisites.some((rule) => rule.notebookTag === "funnel-vented")) fail("Settling relies on stale vent notebook evidence.");
const identify = extraction.actions.find((action) => action.id === "qar-identify-layer-from-evidence");
const identifyNode = extraction.process.nodes.find((node) => node.actionId === identify.id);
for (const rules of [identify.prerequisites, identifyNode.validation]) {
  if (!rules.some((rule) => rule.actionId === "qar-inspect-separated-layers") || !rules.some((rule) => rule.notebookTag === "layers-observed") || rules.some((rule) => rule.notebookTag === "two-layer-extraction")) fail("Layer identity must require explicit fresh acquired layers evidence.");
}
for (const technique of techniques.values()) for (const action of technique.actions.filter((item) => item.id.includes("-gravity-"))) {
  if (/Buchner|side-arm|perforated plate/i.test(JSON.stringify([action.label, action.parameters.instruction, action.interaction.accessibleLabel, action.feedback]))) fail("Gravity instructions still describe vacuum equipment.");
}
const layerRead = extraction.actions.find((action) => action.extractionObservation);
if (!layerRead || layerRead.parameters.observedVisualState || layerRead.parameters.configuredValue) fail("Layer observation has a preset result.");
for (const fraction of ["organic", "aqueous"]) {
  const action = extraction.actions.find((item) => item.id === `qar-recover-${fraction}-component`);
  if (action.fractionHandling?.operation !== "remove-solvent" || action.parameters.inputMode !== "numeric") fail("Solvent removal must consume actual remaining-volume evidence.");
}

const expectedLabRows = new Set();
const expectedTraceKeys = new Set();
const summaries = [];
for (const id of labIds) {
  const raw = await readJson(`public/labs/${id}.json`);
  const source = validateBundledLabSource(raw);
  if (!source.ok || !source.value) fail(`${id} source:\n${source.errors.join("\n")}`);
  if (raw.techniqueRefs) fail(`${id} retains legacy techniqueRefs.`);
  for (const instance of raw.techniqueInstances ?? []) {
    if (instance.version !== versions.get(instance.techniqueId)) fail(`${id}/${instance.instanceId} has stale version ${instance.version}.`);
    const contract = techniques.get(instance.techniqueId).composition;
    const incompleteRoles = contract.equipmentRoles.filter((role) => !role.required || !instance.bindings.equipment[role.roleId]);
    if (incompleteRoles.length) fail(`${id}/${instance.instanceId} has incomplete required role bindings: ${incompleteRoles.map((role) => role.roleId).join(", ")}.`);
  }
  const forbiddenLocal = raw.actions.filter((action) => action.atomId || !["recordNotebook", "submitCalculation"].includes(action.interaction?.type));
  if (forbiddenLocal.length) fail(`${id} retains lab-local physical/acquisition actions: ${forbiddenLocal.map((action) => action.id).join(", ")}`);
  if (id === "paper-chromatography") {
    let blocked;
    try { await compileLabComposition(source.value, async (techniqueId) => structuredClone(techniques.get(techniqueId))); }
    catch (error) { blocked = error.message; }
    const slots = ["baselineHeightMm", "solventDepthMm", "spotVolumeMl", "solventVolumeMl", "spotterLoadVolumeMl", "stopCondition"];
    if (!blocked || !slots.every((slot) => blocked.includes(`missing configuration slot "${slot}"`))) fail("Unconfigured chromatography must fail closed on every required classroom slot.");
    raw.process.nodes.forEach((node) => expectedLabRows.add(`${id}#${node.id}`));
    for (const instance of raw.techniqueInstances) for (const node of techniques.get(instance.techniqueId).process.nodes) expectedLabRows.add(`${id}#${instance.preserveIds?.nodes?.[node.id] ?? `${instance.instanceId}--${node.id}`}`);
    raw.actions.forEach((action) => expectedTraceKeys.add(`lab:${id}#${action.id}`));
    // Static instructor-setup witness, never shipped as classroom defaults.
    const configured = applyLabSetup(source.value, { baselineHeightMm: 15, solventDepthMm: 5, spotVolumeMl: 0.01, solventVolumeMl: 10, spotterLoadVolumeMl: 0.1, paperLengthMm: 120, stopFrontMm: 80 });
    const compiledPaper = await compileLabComposition(configured, async (techniqueId) => structuredClone(techniques.get(techniqueId)));
    const paperResult = validateLabDefinition(compiledPaper);
    if (!paperResult.ok) fail(`Configured paper: ${paperResult.errors.join("; ")}`);
    if (compiledPaper.actions.filter((action) => action.verb === "developChromatogram").some((action) => action.parameters.stopCondition !== "front-mm:80")) fail("Setup stop condition did not reach physical development.");
    summaries.push(`${id}:${compiledPaper.process.nodes.length} configured nodes (illustrative dataset)`);
    continue;
  }
  const preparedSource = id === "bonding-unknown-solids" ? applyLabSetup(source.value, { knownCount: 4, blindCount: 4, conductivityThresholds: 10, phThresholds: 7, meltingApparatusLimits: 150 }) : id === "hard-water-analysis" ? applyLabSetup(source.value, { ovenTemperatureC: 115, firstDurationMinutes: 12, coolingTemperatureC: 25 }) : id === "quick-ache-relief-separation" ? applyLabSetup(source.value, { organicRecoveryMethod: "external-unheated-evaporation", aqueousRecoveryMethod: "external-unheated-evaporation", drynessCriterion: "Instructor-approved observed dry endpoint", coolingLimitC: 25, acidEndpointPh: 3, organicDensity: 0.9, aqueousDensity: 1 }) : source.value;
  const compiled = await compileLabComposition(preparedSource, async (techniqueId) => {
    const technique = techniques.get(techniqueId);
    if (!technique) fail(`${id} references unowned technique ${techniqueId}.`);
    return structuredClone(technique);
  });
  const compiledResult = validateLabDefinition(compiled);
  if (!compiledResult.ok || !compiledResult.value) fail(`${id} compiled:\n${compiledResult.errors.join("\n")}`);
  if (compiled.compositionManifest?.origins.length !== compiled.process.nodes.length - raw.process.nodes.length) fail(`${id} has incomplete technique-origin coverage.`);
  if (new Set(compiled.process.nodes.map((node) => node.id)).size !== compiled.process.nodes.length) fail(`${id} compiled duplicate node IDs.`);
  if (new Set(compiled.actions.map((action) => action.id)).size !== compiled.actions.length) fail(`${id} compiled duplicate action IDs.`);
  compiled.process.nodes.forEach((node) => expectedLabRows.add(`${id}#${node.id}`));
  // Overlay covers every declared canonical alternative, not just the default selected path.
  for (const instance of raw.techniqueInstances) if (techniques.get(instance.techniqueId).composition.orderedProcedure) for (const node of techniques.get(instance.techniqueId).process.nodes) expectedLabRows.add(`${id}#${instance.preserveIds?.nodes?.[node.id] ?? `${instance.instanceId}--${node.id}`}`);
  for (const witness of raw.reachabilityWitnesses.slice(1)) {
    const variant = await compileLabComposition(preparedSource, async (techniqueId) => structuredClone(techniques.get(techniqueId)), { witnessId: witness.id });
    variant.process.nodes.forEach((node) => expectedLabRows.add(`${id}#${node.id}`));
    if (id === "bonding-unknown-solids") {
      const [known, blind] = witness.id.match(/\d+/g).map(Number);
      if (variant.compositionManifest.origins.length !== 40 * (known + blind)) fail(`Bonding witness ${witness.id} has wrong sample count.`);
    }
  }
  raw.actions.forEach((action) => expectedTraceKeys.add(`lab:${id}#${action.id}`));
  summaries.push(`${id}:${compiled.process.nodes.length}/${compiled.compositionManifest.origins.length}`);
}
for (const [id, technique] of techniques) technique.actions.forEach((action) => expectedTraceKeys.add(`technique:${id}#${action.id}`));

for (const file of ["technique-atomicity-overlay.json", "lab-composition-overlay.json", "source-trace-overlay.json"]) {
  const overlay = await readJson(`${planRoot}/evidence/lane-06/${file}`);
  if (overlay.baselineRevision !== 8 || overlay.baselineManifestSha256 !== "09b3e1acbb63dce5633c26e574d2845adcae4065967ab0b997fd810f930a3bc7" || overlay.impactManifestSha256 !== "0b4b53a275f1bc26a7aae30c42fc1bba16e9a414ee2cd27680faaf71e8e1af00") fail(`${file} baseline identity drifted.`);
  if (overlay.rows.some((row) => row.evaluated !== true || !row.sourceFile || !row.sourceTable || !row.step || !row.basis || !row.effectDecision && file !== "source-trace-overlay.json")) fail(`${file} has unevaluated/incomplete rows.`);
  const rowIds = new Set(overlay.rows.map((row) => row.rowId));
  if (rowIds.size !== overlay.rows.length) fail(`${file} repeats row IDs.`);
  if (file === "technique-atomicity-overlay.json" && (rowIds.size !== expectedTechniqueRows.size || [...rowIds].some((id) => !expectedTechniqueRows.has(id)))) fail(`${file} does not exactly cover final technique actions.`);
  if (file === "lab-composition-overlay.json" && (rowIds.size !== expectedLabRows.size || [...rowIds].some((id) => !expectedLabRows.has(id)))) fail(`${file} does not exactly cover compiled lab nodes.`);
  if (file === "source-trace-overlay.json") {
    const keys = new Set(overlay.rows.map((row) => `${row.owner}#${row.actionId}`));
    if (keys.size !== expectedTraceKeys.size || [...keys].some((key) => !expectedTraceKeys.has(key))) fail(`${file} does not exactly cover final owned action keys.`);
  }
}

console.log(`Cycle 06 BLOCKED candidate static guards (not completion): ${versions.size} techniques; ${summaries.join("; ")}; overlays exact.`);
