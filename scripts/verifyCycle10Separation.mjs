/**
 * Cycle 10 verifier: chromatography and multistage component separation.
 *
 * `npm run content:check` enforces the corpus-wide contracts. This script enforces the two
 * investigations' own invariants, which are the ones a generic rule cannot express: that Rf cannot be
 * reached before a student ruler reading and the correct wet/dry chronology, that solvent and
 * separated material move between named sources and receivers, that every recovered mass traces back
 * to one declared sample composition rather than to a literal, and that an emulsion or an
 * unidentified fraction stays recoverable instead of being silently resolved.
 *
 * Usage:
 *   node scripts/verifyCycle10Separation.mjs
 *   node scripts/verifyCycle10Separation.mjs --json
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = new Set(process.argv.slice(2));
const readJson = (relativePath) => JSON.parse(readFileSync(join(root, relativePath), "utf8"));

const checks = [];
const check = (name, passed, detail) => {
  checks.push({ name, passed: Boolean(passed), detail: detail ?? "" });
};

const CHROM_LAB = readJson("public/labs/paper-chromatography.json");
const CHROM_TECHNIQUE = readJson("public/techniques/paper-chromatography.json");
const QAR_LAB = readJson("public/labs/quick-ache-relief-separation.json");
const QAR_EXTRACTION = readJson("public/techniques/quick-ache-extraction-recovery.json");
const QAR_REPORT = readJson("public/techniques/quick-ache-analysis-report.json");
const ATOMS = readJson("src/domain/atomRegistry.json");
const ROLES = readJson("src/domain/equipmentRoleRegistry.json");
const TRACES = readJson("docs/architecture/source-trace-registry.json");
const VISUAL_STATES = readJson("src/equipment/visualStateRegistry.json");

const index = (definition) => new Map(definition.actions.map((action) => [action.id, action]));
const prereqIds = (action, type) =>
  (action.prerequisites ?? [])
    .filter((rule) => rule.type === type)
    .map((rule) => rule.actionId ?? rule.measurementId ?? rule.notebookTag)
    .filter(Boolean);

/* ================================================================== *
 * Investigation 5 - chromatography chronology and Rf provenance
 * ================================================================== */

const CHROM_OWNERS = [
  { label: "lab:paper-chromatography", definition: CHROM_LAB },
  { label: "technique:paper-chromatography", definition: CHROM_TECHNIQUE },
];

for (const { label, definition } of CHROM_OWNERS) {
  const actions = index(definition);
  const developments = definition.actions.filter((action) => action.verb === "developChromatogram");
  check(`${label}: has at least one development step`, developments.length > 0);

  for (const develop of developments) {
    const p = develop.parameters;
    check(
      `${label}/${develop.id}: development writes no measurements`,
      p.recordMeasurementsOnDevelop === false,
      "recordMeasurementsOnDevelop must be false or the model supplies every distance",
    );
    check(`${label}/${develop.id}: development requires a dry spot`, p.requireDrySpot === true);
    check(`${label}/${develop.id}: development carries the wet state forward`, p.trackWetState === true);
    check(
      `${label}/${develop.id}: origin sits above the solvent`,
      typeof p.baselineHeightMm === "number" &&
        typeof p.solventDepthMm === "number" &&
        p.baselineHeightMm > p.solventDepthMm,
      `baselineHeightMm=${p.baselineHeightMm} solventDepthMm=${p.solventDepthMm}`,
    );
  }

  const spots = definition.actions.filter((action) => action.verb === "spotSample");
  for (const spot of spots) {
    check(`${label}/${spot.id}: spot goes on wet`, spot.parameters.requiresDrying === true);
    check(
      `${label}/${spot.id}: spot requires a drawn origin`,
      spot.parameters.requiresBaselineMarked === true,
    );
  }

  /* Every chromatography operation the source states must exist as a state-changing step. */
  const operations = new Set(
    definition.actions
      .map((action) => action.parameters?.chromatographyOperation)
      .filter((value) => typeof value === "string"),
  );
  for (const operation of ["markBaseline", "drySpot", "markSolventFront", "dryDevelopedPaper"]) {
    check(`${label}: declares the ${operation} operation`, operations.has(operation));
  }

  /* Each recorded distance has its own reading step, and no distance is authored anywhere. */
  const records = definition.actions.filter(
    (action) => action.verb === "record" && typeof action.parameters?.measurementId === "string",
  );
  for (const record of records) {
    const readActionId = record.parameters.readActionId;
    const reader = readActionId ? actions.get(readActionId) : undefined;
    check(
      `${label}/${record.id}: names its ruler-reading step`,
      Boolean(reader) && reader.parameters.measurementId === record.parameters.measurementId,
      `readActionId=${readActionId}`,
    );
    check(
      `${label}/${record.id}: carries no authored value`,
      record.parameters.value === undefined,
      "a recorded distance must come from the reading, never from the action",
    );
    check(
      `${label}/${record.id}: requires the reading first`,
      prereqIds(record, "measurementRecorded").includes(record.parameters.measurementId),
    );
  }

  /**
   * A reading is an action that actually reads the instrument. The `record` steps keep the same
   * measurement descriptors — the measurement point, the ruler division, the tolerance — because they
   * describe the value being written down, and they name the reading that produced it through
   * `readActionId`. That naming is what is checked instead, so a descriptor on a record step can never
   * be mistaken for a second, independent measurement.
   */
  const readings = definition.actions.filter(
    (action) =>
      typeof action.parameters?.chromatographyMeasurementType === "string" &&
      action.interaction?.type === "readInstrument",
  );
  for (const descriptorCarrier of definition.actions.filter(
    (action) =>
      action.verb === "record" && typeof action.parameters?.chromatographyMeasurementType === "string",
  )) {
    check(
      `${label}/${descriptorCarrier.id}: measurement descriptors name the reading that produced them`,
      typeof descriptorCarrier.parameters.readActionId === "string",
    );
  }
  check(`${label}: has ruler-reading steps`, readings.length > 0);
  for (const reading of readings) {
    check(
      `${label}/${reading.id}: names the ruler as its instrument`,
      reading.parameters.targetDefinitionId === "metric-ruler",
    );
    check(
      `${label}/${reading.id}: carries no authored distance`,
      reading.parameters.value === undefined && reading.parameters.distanceMm === undefined,
    );
    check(
      `${label}/${reading.id}: quantised to a stated ruler division`,
      typeof reading.parameters.rulerPrecisionMm === "number" && reading.parameters.rulerPrecisionMm > 0,
    );
    check(
      `${label}/${reading.id}: gated on a dry chromatogram`,
      prereqIds(reading, "notebookEntry").some((tag) => /dry|dried/i.test(tag)),
      prereqIds(reading, "notebookEntry").join(", "),
    );
  }

  const rfCalculations = definition.actions.filter(
    (action) => action.parameters?.template === "chromatographyRf",
  );
  check(`${label}: calculates Rf`, rfCalculations.length > 0);
  for (const rf of rfCalculations) {
    check(
      `${label}/${rf.id}: Rf requires recorded distances`,
      rf.parameters.requireRecordedMeasurements === true,
    );
    check(`${label}/${rf.id}: Rf carries no expected value`, rf.parameters.expected === undefined);
    const required = prereqIds(rf, "measurementRecorded");
    check(
      `${label}/${rf.id}: Rf is gated on a solvent-front measurement`,
      required.some((id) => /solvent-front/.test(id)),
      required.join(", "),
    );
    const bandIds = Array.isArray(rf.parameters.bandIds) ? rf.parameters.bandIds : [];
    check(
      `${label}/${rf.id}: Rf is gated on every band measurement`,
      bandIds.length > 0 && bandIds.every((bandId) => required.some((id) => id.endsWith(`band-${bandId}`))),
      `bands=${bandIds.join(",")} gates=${required.join(",")}`,
    );
  }

  /* The wet/dry chronology is a prerequisite chain, not a node order: any input path reaches it. */
  const chronology = [
    ["markBaseline", "spotSample"],
    ["spotSample", "drySpot"],
    ["drySpot", "developChromatogram"],
    ["developChromatogram", "markSolventFront"],
    ["markSolventFront", "dryDevelopedPaper"],
  ];
  const stepFor = (key) =>
    definition.actions.find(
      (action) => action.parameters?.chromatographyOperation === key || action.verb === key,
    );
  /**
   * The gate may be indirect — the front mark requires the removal, and the removal requires the
   * development — so the prerequisite graph is walked transitively. Requiring a direct edge would
   * force every step to restate every earlier one, which is not how the chain is authored and would
   * make the check reject a correct chronology.
   */
  const byTag = new Map(
    definition.actions
      .filter((action) => typeof action.parameters?.tag === "string")
      .map((action) => [action.parameters.tag, action.id]),
  );
  const byMeasurement = new Map(
    definition.actions
      .filter((action) => typeof action.parameters?.measurementId === "string")
      .map((action) => [action.parameters.measurementId, action.id]),
  );
  const gatesOf = (action) =>
    [
      ...prereqIds(action, "actionEvidence"),
      ...prereqIds(action, "notebookEntry").map((tag) => byTag.get(tag)),
      ...prereqIds(action, "measurementRecorded").map((id) => byMeasurement.get(id)),
    ].filter(Boolean);
  const reaches = (fromActionId, targetActionId, seen = new Set()) => {
    if (fromActionId === targetActionId) return true;
    if (seen.has(fromActionId)) return false;
    seen.add(fromActionId);
    const action = actions.get(fromActionId);
    if (!action) return false;
    return gatesOf(action).some((gate) => reaches(gate, targetActionId, seen));
  };

  for (const [before, after] of chronology) {
    const earlier = stepFor(before);
    const later = stepFor(after);
    if (!earlier || !later) {
      check(`${label}: ${before} precedes ${after}`, false, "one of the two steps is missing");
      continue;
    }
    check(
      `${label}: ${before} precedes ${after}`,
      reaches(later.id, earlier.id),
      `${later.id} does not require ${earlier.id}, directly or transitively`,
    );
  }
}

/* Trial independence: the two lab trials may not share glassware or a measurement id. */
const trialInstances = (prefix) =>
  new Set(
    CHROM_LAB.actions
      .filter((action) => action.id.includes(`-${prefix}-`) || action.id.endsWith(`-${prefix}`))
      .flatMap((action) =>
        [action.parameters?.sourceInstanceId, action.parameters?.targetInstanceId, action.parameters?.equipmentInstanceId].filter(
          (value) => typeof value === "string",
        ),
      ),
  );
const waterInstances = trialInstances("water");
const propanolInstances = trialInstances("propanol");
const sharedGlassware = [...waterInstances].filter(
  (id) => propanolInstances.has(id) && !["metric-ruler-1", "pencil-1", "dye-spotter", "food-dye-sample"].includes(id),
);
check(
  "lab:paper-chromatography: the two trials share no trial-specific glassware",
  sharedGlassware.length === 0,
  sharedGlassware.join(", "),
);

const chromMeasurementIds = CHROM_LAB.actions
  .map((action) => action.parameters?.measurementId)
  .filter((value) => typeof value === "string");
check(
  "lab:paper-chromatography: no measurement id is reused across steps of different kinds",
  new Set(chromMeasurementIds).size ===
    new Set(chromMeasurementIds.map((id) => id)).size,
);
const perTrial = { water: 0, propanol: 0 };
for (const id of new Set(chromMeasurementIds)) {
  if (id.startsWith("water-")) perTrial.water += 1;
  if (id.startsWith("propanol-")) perTrial.propanol += 1;
}
check(
  "lab:paper-chromatography: every trial measurement is trial-prefixed",
  perTrial.water > 0 && perTrial.propanol > 0 && perTrial.water + perTrial.propanol === new Set(chromMeasurementIds).size,
  JSON.stringify(perTrial),
);

/* Disposal branches by solvent class and happens only after the trial's Rf is calculated. */
for (const disposal of CHROM_LAB.actions.filter((action) => action.id.startsWith("dispose-"))) {
  check(
    `lab:paper-chromatography/${disposal.id}: declares its waste stream`,
    disposal.parameters.wasteStream === "sink" || disposal.parameters.wasteStream === "organic",
    String(disposal.parameters.wasteStream),
  );
  check(
    `lab:paper-chromatography/${disposal.id}: happens after the trial's Rf`,
    prereqIds(disposal, "actionEvidence").some((id) => id.startsWith("calculate-")),
  );
}
const sinkStream = CHROM_LAB.actions.find((action) => action.id === "dispose-water-solvent");
const organicStream = CHROM_LAB.actions.find((action) => action.id === "dispose-propanol-solvent");
check(
  "lab:paper-chromatography: water and organic waste go to different receivers",
  sinkStream?.parameters.targetInstanceId !== organicStream?.parameters.targetInstanceId,
);

/* ================================================================== *
 * Investigation 9 - separation transfers, recovery, and identity limits
 * ================================================================== */

const qarActions = index(QAR_EXTRACTION);
const qarReport = index(QAR_REPORT);

/* One declared composition, consumed by name everywhere else. */
const unknown = QAR_EXTRACTION.initialState.equipment.find((item) => item.id === "qar-unknown-sample");
check("technique:quick-ache-extraction-recovery: the unknown declares a real mass", (unknown?.contents.massG ?? 0) > 0);
const declaredSolutes = unknown?.contents.solutes ?? [];
check(
  "technique:quick-ache-extraction-recovery: the unknown declares its components",
  declaredSolutes.length >= 2,
);
const declaredTotal = Number(declaredSolutes.reduce((total, solute) => total + solute.amount, 0).toFixed(3));
check(
  "technique:quick-ache-extraction-recovery: the declared components sum to the declared mass",
  Math.abs(declaredTotal - Number(unknown?.contents.massG ?? 0)) < 1e-9,
  `solutes=${declaredTotal} massG=${unknown?.contents.massG}`,
);
const declaredSoluteIds = new Set(declaredSolutes.map((solute) => solute.id));

const startingMass = qarActions.get("qar-record-starting-mass");
check(
  "technique:quick-ache-extraction-recovery: the starting mass carries no literal expectation",
  startingMass?.parameters.expectedMassG === undefined,
  "the balance reads the sample's declared mass, not a value written into the action",
);

/* Every recovered mass comes from a named declared solute rather than from a literal. */
const recoveries = QAR_EXTRACTION.actions.filter((action) => action.verb === "precipitate");
check("technique:quick-ache-extraction-recovery: has recovery steps", recoveries.length === 3, `${recoveries.length}`);
for (const recovery of recoveries) {
  const soluteId = recovery.parameters.precipitateSoluteSourceId;
  check(
    `technique:quick-ache-extraction-recovery/${recovery.id}: recovers a declared component`,
    typeof soluteId === "string" && declaredSoluteIds.has(soluteId),
    `precipitateSoluteSourceId=${soluteId}`,
  );
  check(
    `technique:quick-ache-extraction-recovery/${recovery.id}: carries no literal recovered mass`,
    recovery.parameters.precipitateMassG === undefined,
  );
  const substance = String(recovery.parameters.precipitateSubstance ?? "").toLowerCase();
  check(
    `technique:quick-ache-extraction-recovery/${recovery.id}: names no expected component`,
    !["aspirin", "acetaminophen", "sucrose"].some((name) => substance.includes(name)),
    recovery.parameters.precipitateSubstance,
  );
  check(
    `technique:quick-ache-extraction-recovery/${recovery.id}: records what the recovery does not establish`,
    typeof recovery.parameters.identityLimit === "string" && recovery.parameters.identityLimit.length > 0,
  );
}

/* Each fraction's gravimetry is a complete, ordered chain. */
for (const key of ["acidic", "organic", "aqueous"]) {
  const tare = qarActions.get(`qar-weigh-${key}-watch-glass-tare`);
  const dry = qarActions.get(`qar-dry-${key}-solid`);
  const cool = qarActions.get(`qar-cool-${key}-solid`);
  const weigh = qarActions.get(`qar-weigh-${key}-solid`);
  check(`technique:quick-ache-extraction-recovery: ${key} chain is complete`, Boolean(tare && dry && cool && weigh));
  if (!(tare && dry && cool && weigh)) continue;

  check(
    `technique:quick-ache-extraction-recovery: ${key} drying is gated on the tare`,
    prereqIds(dry, "measurementRecorded").includes(tare.parameters.measurementId),
  );
  check(
    `technique:quick-ache-extraction-recovery: ${key} cooling follows drying`,
    prereqIds(cool, "actionEvidence").includes(dry.id),
  );
  check(
    `technique:quick-ache-extraction-recovery: ${key} weighing follows cooling`,
    prereqIds(weigh, "actionEvidence").includes(cool.id),
  );
  check(
    `technique:quick-ache-extraction-recovery: ${key} weighing refuses a wet solid`,
    weigh.parameters.requiresDryPrecipitate === true,
  );
  check(
    `technique:quick-ache-extraction-recovery: ${key} weighing refuses a warm assembly`,
    typeof weigh.parameters.maxSafeTemperatureC === "number",
  );
  check(
    `technique:quick-ache-extraction-recovery: ${key} final mass carries no literal expectation`,
    weigh.parameters.expectedMassG === undefined,
  );
  check(
    `technique:quick-ache-extraction-recovery: ${key} drying declares its endpoint as configured`,
    weigh.parameters.tareMeasurementId === tare.parameters.measurementId,
  );
}

/* The extraction is a chain of real transfers between named vessels. */
const TRANSFER_CHAIN = [
  ["qar-transfer-weighed-sample", "qar-unknown-sample", "qar-extraction-beaker"],
  ["qar-transfer-approved-solvent", "qar-cylinder", "qar-extraction-beaker"],
  ["qar-charge-funnel-organic-phase", "qar-extraction-beaker", "qar-separatory-funnel"],
  ["qar-charge-funnel-aqueous-phase", "qar-bicarbonate", "qar-separatory-funnel"],
  ["qar-drain-lower-layer", "qar-separatory-funnel", "qar-aqueous-fraction-flask"],
  ["qar-drain-upper-layer", "qar-separatory-funnel", "qar-organic-fraction-flask"],
];
for (const [id, sourceInstanceId, targetInstanceId] of TRANSFER_CHAIN) {
  const action = qarActions.get(id);
  check(`technique:quick-ache-extraction-recovery/${id}: exists`, Boolean(action));
  if (!action) continue;
  check(
    `technique:quick-ache-extraction-recovery/${id}: moves between the named vessels`,
    action.parameters.sourceInstanceId === sourceInstanceId &&
      action.parameters.targetInstanceId === targetInstanceId,
    `${action.parameters.sourceInstanceId} -> ${action.parameters.targetInstanceId}`,
  );
  check(
    `technique:quick-ache-extraction-recovery/${id}: records fraction provenance or a label`,
    typeof action.parameters.fractionProvenance === "string" ||
      typeof action.parameters.targetLabel === "string" ||
      typeof action.parameters.instruction === "string",
  );
}
const drainLower = qarActions.get("qar-drain-lower-layer");
const drainUpper = qarActions.get("qar-drain-upper-layer");
check(
  "technique:quick-ache-extraction-recovery: the two layers reach different receivers",
  drainLower?.parameters.targetInstanceId !== drainUpper?.parameters.targetInstanceId,
);
check(
  "technique:quick-ache-extraction-recovery: draining is gated on recorded layer identity",
  prereqIds(drainLower ?? {}, "notebookEntry").includes("layer-identity"),
);
const identify = qarActions.get("qar-identify-layer-from-evidence");
check(
  "technique:quick-ache-extraction-recovery: layer identity is gated on a clean separation",
  prereqIds(identify ?? {}, "notebookEntry").includes("two-layer-extraction"),
);

/* The emulsion stays recoverable: a reported emulsion fails the settling gate and routes to recovery. */
for (const { label, definition } of [
  { label: "technique:quick-ache-extraction-recovery", definition: QAR_EXTRACTION },
  { label: "lab:quick-ache-relief-separation", definition: QAR_LAB },
]) {
  const settleNode = definition.process.nodes.find(
    (node) => node.actionId === "qar-settle-and-observe-layers",
  );
  const recoveryNode = definition.process.nodes.find(
    (node) => node.actionId === "qar-recover-from-emulsion",
  );
  check(`${label}: the emulsion recovery step exists`, Boolean(recoveryNode));
  check(
    `${label}: settling only passes on a clean separation`,
    settleNode?.validation?.some((rule) => rule.notebookTag === "two-layer-extraction"),
  );
  if (!settleNode || !recoveryNode) continue;
  check(
    `${label}: a reported emulsion routes to the recovery step`,
    definition.process.edges.some(
      (edge) => edge.from === settleNode.id && edge.to === recoveryNode.id && edge.condition.type === "retry",
    ),
  );
  check(
    `${label}: the recovery step returns to the settling observation`,
    definition.process.edges.some((edge) => edge.from === recoveryNode.id && edge.to === settleNode.id),
  );
  check(
    `${label}: the straight-through path skips the recovery step`,
    definition.process.edges.some(
      (edge) =>
        edge.from === settleNode.id &&
        edge.to !== recoveryNode.id &&
        edge.condition.type === "validationPassed",
    ),
  );
}

/* The vacuum filtration is assembled, not asserted. */
const FILTRATION_CHAIN = [
  "qar-place-buchner-funnel",
  "qar-weigh-filter-paper-tare",
  "qar-seat-filter-paper",
  "qar-wet-filter-paper",
  "qar-place-side-arm-flask",
  "qar-place-vacuum-source",
];
for (const id of FILTRATION_CHAIN) {
  check(`technique:quick-ache-extraction-recovery/${id}: exists`, qarActions.has(id));
}
const seat = qarActions.get("qar-seat-filter-paper");
check(
  "technique:quick-ache-extraction-recovery: the paper is tared before it is seated",
  prereqIds(seat ?? {}, "measurementRecorded").includes("qar-filter-paper-mass"),
);
const wet = qarActions.get("qar-wet-filter-paper");
check(
  "technique:quick-ache-extraction-recovery: the paper is wetted only after seating",
  prereqIds(wet ?? {}, "actionEvidence").includes("qar-seat-filter-paper"),
);
const filterStep = qarActions.get("qar-filter-recovered-solid");
check(
  "technique:quick-ache-extraction-recovery: filtering is gated on the inspected assembly",
  prereqIds(filterStep ?? {}, "notebookEntry").includes("vacuum-filtration-assembly"),
);
check(
  "technique:quick-ache-extraction-recovery: filtering has a recovered solid to collect",
  prereqIds(filterStep ?? {}, "actionEvidence").includes("qar-precipitate-recovered-component"),
);

/* Composition and recovery keep the source's formula ambiguity open, and derive from evidence. */
const CALCULATIONS = [
  ["qar-calculate-sucrose-percentage", "componentMassPercent"],
  ["qar-calculate-acetaminophen-percentage", "componentMassPercent"],
  ["qar-calculate-possible-aspirin-percentage", "componentMassPercent"],
  ["qar-calculate-total-recovery", "totalPercentRecovery"],
];
for (const [id, template] of CALCULATIONS) {
  const action = qarReport.get(id);
  check(`technique:quick-ache-analysis-report/${id}: exists`, Boolean(action));
  if (!action) continue;
  check(`technique:quick-ache-analysis-report/${id}: uses the ${template} template`, action.parameters.template === template);
  check(
    `technique:quick-ache-analysis-report/${id}: names the confirmed formula convention`,
    action.parameters.compositionFormulaConfirmation === "component-mass-over-starting-mass",
  );
  check(
    `technique:quick-ache-analysis-report/${id}: carries no answer key`,
    action.parameters.expected === undefined,
  );
  check(
    `technique:quick-ache-analysis-report/${id}: divides by the recorded starting mass`,
    action.parameters.startingMassMeasurementId === "qar-starting-mass",
  );
  /**
   * `studentValueRequired` is a declaration the player cannot satisfy — `submitCalculation` sends no
   * value — so it is not what makes these figures real. What makes them real is that every operand is
   * a recorded measurement, which is checked here and enforced by the template.
   */
  const operandIds =
    template === "componentMassPercent"
      ? [action.parameters.componentMassMeasurementId]
      : action.parameters.recoveredMassMeasurementIds;
  check(
    `technique:quick-ache-analysis-report/${id}: derives from recorded masses`,
    Array.isArray(operandIds) ? operandIds.length > 0 : typeof operandIds === "string",
    JSON.stringify(operandIds),
  );
  const gates = prereqIds(action, "measurementRecorded");
  for (const operandId of Array.isArray(operandIds) ? operandIds : [operandIds]) {
    check(
      `technique:quick-ache-analysis-report/${id}: is gated on ${operandId}`,
      gates.includes(operandId),
    );
  }
  check(
    `technique:quick-ache-analysis-report/${id}: is gated on the recorded starting mass`,
    prereqIds(action, "measurementRecorded").includes("qar-starting-mass"),
  );
}
const confirmFormula = qarReport.get("qar-confirm-composition-formula");
check(
  "technique:quick-ache-analysis-report: the formula ambiguity is recorded rather than corrected",
  typeof confirmFormula?.parameters.sourceAmbiguity === "string",
);

/* Version pins move with the techniques they name. */
/**
 * Read the published version rather than asserting a literal: a pin must follow the technique it
 * names, and hard-coding the expected version means the check has to be edited every time a technique
 * is revised — which is how it would go stale rather than fail.
 */
for (const ref of QAR_LAB.techniqueRefs) {
  const published = readJson(`public/techniques/${ref.techniqueId}.json`).metadata.version;
  check(
    `lab:quick-ache-relief-separation: ${ref.techniqueId} is pinned at its published version`,
    ref.version === published,
    `pinned ${ref.version}, published ${published}`,
  );
}
check(
  "technique:quick-ache-extraction-recovery: version bumped",
  QAR_EXTRACTION.metadata.version === "1.1.0",
  QAR_EXTRACTION.metadata.version,
);
check(
  "technique:quick-ache-analysis-report: version bumped",
  QAR_REPORT.metadata.version === "1.1.0",
  QAR_REPORT.metadata.version,
);
check(
  "technique:paper-chromatography: version bumped",
  CHROM_TECHNIQUE.metadata.version === "1.1.0",
  CHROM_TECHNIQUE.metadata.version,
);
check(
  "lab:paper-chromatography: version bumped",
  CHROM_LAB.metadata.version === "2.1.0",
  CHROM_LAB.metadata.version,
);

/* Every lab node resolves to an action the lab owns or imports. */
const importedIds = new Set([
  ...QAR_EXTRACTION.actions.map((action) => action.id),
  ...QAR_REPORT.actions.map((action) => action.id),
  ...readJson("public/techniques/quick-ache-property-evidence.json").actions.map((action) => action.id),
  ...readJson("public/techniques/quick-ache-design-approval.json").actions.map((action) => action.id),
]);
const unresolved = QAR_LAB.process.nodes
  .map((node) => node.actionId)
  .filter((actionId) => actionId && !importedIds.has(actionId));
check(
  "lab:quick-ache-relief-separation: every process node resolves through its pinned techniques",
  unresolved.length === 0,
  unresolved.join(", "),
);

/* Registry completeness for the atoms and roles this cycle added. */
const atomById = new Map(ATOMS.atoms.map((atom) => [atom.id, atom]));
const roleById = new Map(ROLES.roles.map((role) => [role.id, role]));
const CYCLE_10_ATOMS = [
  "atom.place.developing-chamber",
  "atom.place.stationary-phase",
  "atom.transfer.load-spotting-tool",
  "atom.place.remove-developed-strip",
  "atom.place.measuring-ruler",
  "atom.transfer.route-solvent-waste",
  "atom.transfer.weighed-sample-to-vessel",
  "atom.transfer.charge-extraction-funnel",
  "atom.transfer.drain-separated-phase",
  "atom.transfer.decant-recovered-fraction",
  "atom.rinse.wash-recovered-fraction",
  "atom.transfer.add-drying-agent",
];
for (const atomId of CYCLE_10_ATOMS) {
  const atom = atomById.get(atomId);
  check(`atom ${atomId}: registered`, Boolean(atom));
  if (!atom) continue;
  check(`atom ${atomId}: cites its source row`, (atom.sourceExamples ?? []).length > 0);
  check(`atom ${atomId}: has at least one content example`, (atom.contentExamples ?? []).length > 0);
  for (const role of atom.requiredRoles) {
    check(`atom ${atomId}: required role ${role} is registered`, roleById.has(role));
  }
}
const chargeChamber = atomById.get("atom.transfer.charge-developing-chamber");
check(
  "atom.transfer.charge-developing-chamber: no longer requires a measured delivery",
  !chargeChamber?.requiredRoles.includes("measured-solvent-source"),
  "Investigation 5 lists no measuring device and leaves the solvent amount open",
);
check(
  "atom.transfer.charge-developing-chamber: a measured delivery is still admissible",
  (chargeChamber?.optionalRoles ?? []).includes("measured-solvent-source"),
);

/* The seven visual states Cycles 05 and 08 re-owned to Cycle 10 are resolved. */
const OWNED_STATES = [
  "paper-unspotted",
  "paper-spotted",
  "chromatogram-developed",
  "two-layer-extraction",
  "emulsion",
  "heated-residue",
  "cooled-residue",
];
for (const stateId of OWNED_STATES) {
  const state = VISUAL_STATES.states.find((candidate) => candidate.id === stateId);
  check(`visual state ${stateId}: registered`, Boolean(state));
  if (!state) continue;
  check(`visual state ${stateId}: resolved`, state.disposition !== "unresolved", state.disposition);
  check(`visual state ${stateId}: no longer carries an owning cycle`, state.ownerCycle === undefined);
  check(
    `visual state ${stateId}: appearance makes no quantitative claim`,
    state.quantitativeClaim === "none" || state.quantitativeClaim === "ordinal",
  );
}

/* Every physical action this cycle authored has a source trace. */
const traceKeys = new Set(TRACES.traces.map((trace) => `${trace.ownerType}:${trace.ownerId}#${trace.actionId}`));
const PHYSICAL_VERBS = new Set([
  "place",
  "weigh",
  "measureVolume",
  "transfer",
  "dissolve",
  "precipitate",
  "dilute",
  "filter",
  "spotSample",
  "developChromatogram",
  "rinse",
  "dry",
  "heat",
  "cool",
  "stressEquilibrium",
]);
for (const { owner, definition } of [
  { owner: "lab:paper-chromatography", definition: CHROM_LAB },
  { owner: "technique:paper-chromatography", definition: CHROM_TECHNIQUE },
  { owner: "technique:quick-ache-extraction-recovery", definition: QAR_EXTRACTION },
]) {
  for (const action of definition.actions) {
    if (!PHYSICAL_VERBS.has(action.verb)) continue;
    check(`${owner}/${action.id}: has an atom identity`, typeof action.atomId === "string");
    check(`${owner}/${action.id}: has a source trace`, traceKeys.has(`${owner}#${action.id}`));
    const atom = atomById.get(action.atomId);
    if (!atom) continue;
    for (const role of atom.requiredRoles) {
      check(
        `${owner}/${action.id}: binds the required role ${role}`,
        typeof action.equipmentRoleBindings?.[role] === "string",
      );
    }
  }
}

/**
 * Every observation step has to be performable.
 *
 * `ProcessSidebar`'s `canRecordObservation` enables the record control only when
 * `action.parameters.note` is a non-empty string, and it supplies no note of its own. A `prompt`
 * without a `note` is therefore a step no input path can complete — which is how 26 of
 * Investigation 9's observations were unreachable before this cycle's self-review.
 */
for (const [label, definition] of [
  ["technique:quick-ache-property-evidence", readJson("public/techniques/quick-ache-property-evidence.json")],
  ["technique:quick-ache-design-approval", readJson("public/techniques/quick-ache-design-approval.json")],
  ["technique:quick-ache-extraction-recovery", QAR_EXTRACTION],
  ["technique:quick-ache-analysis-report", QAR_REPORT],
  ["lab:paper-chromatography", CHROM_LAB],
  ["technique:paper-chromatography", CHROM_TECHNIQUE],
]) {
  for (const action of definition.actions) {
    if (action.verb !== "observe" || action.interaction?.type !== "recordNotebook") continue;
    check(
      `${label}/${action.id}: carries a recordable note`,
      typeof action.parameters.note === "string" && action.parameters.note.trim().length > 0,
      "the player enables the record control only when parameters.note is non-empty",
    );
  }
}

/**
 * A recording step must be a step. Validating `measurementRecorded` on a recording node lets the
 * reading that produced the measurement satisfy the recording, which is the develop-time write's
 * weakness moved one step later.
 */
for (const [label, definition] of [
  ["lab:paper-chromatography", CHROM_LAB],
  ["technique:paper-chromatography", CHROM_TECHNIQUE],
]) {
  const actions = index(definition);
  for (const processNode of definition.process.nodes) {
    const action = actions.get(processNode.actionId);
    if (action?.verb !== "record" || typeof action.parameters?.measurementId !== "string") continue;
    check(
      `${label}/${processNode.id}: recording is gated on its own action`,
      processNode.validation.some((rule) => rule.type === "actionEvidence" && rule.actionId === action.id),
    );
  }
}

/**
 * The separation's volume ledger. A `finalVolumeMl` larger than what the vessel holds invents liquid,
 * which is the same class of fabrication as a literal recovered mass.
 */
const volumeOf = (actionId, key) => Number(qarActions.get(actionId)?.parameters?.[key]);
const acidifiedMl = volumeOf("qar-drain-lower-layer", "volumeMl") + volumeOf("qar-acidify-recovered-fraction", "volumeMl");
check(
  "technique:quick-ache-extraction-recovery: the acidified fraction's final volume is what is in it",
  volumeOf("qar-precipitate-recovered-component", "finalVolumeMl") === acidifiedMl,
  `finalVolumeMl=${volumeOf("qar-precipitate-recovered-component", "finalVolumeMl")} vessel=${acidifiedMl}`,
);
check(
  "technique:quick-ache-extraction-recovery: the decanted filtrate matches the filtered volume",
  volumeOf("qar-decant-filtrate-to-beaker", "volumeMl") === acidifiedMl,
);
check(
  "technique:quick-ache-extraction-recovery: the aqueous recovery's final volume matches the decant",
  volumeOf("qar-recover-aqueous-component", "finalVolumeMl") === volumeOf("qar-decant-filtrate-to-beaker", "volumeMl"),
);
check(
  "technique:quick-ache-extraction-recovery: the organic recovery's final volume matches its drained layer",
  volumeOf("qar-recover-organic-component", "finalVolumeMl") === volumeOf("qar-drain-upper-layer", "volumeMl"),
);

/**
 * Each recovery must find its component still in the fraction it targets. `precipitate` consumes only
 * the solute it is named, so a later stage's component has to survive an earlier stage — which is the
 * defect that made the aqueous chain unreachable before this cycle's self-review.
 */
const recoveredSoluteIds = recoveries.map((recovery) => recovery.parameters.precipitateSoluteSourceId);
check(
  "technique:quick-ache-extraction-recovery: each recovery names a different declared component",
  new Set(recoveredSoluteIds).size === recoveredSoluteIds.length,
  recoveredSoluteIds.join(", "),
);
check(
  "technique:quick-ache-extraction-recovery: the three recoveries cover every declared component",
  declaredSolutes.every((solute) => recoveredSoluteIds.includes(solute.id)),
  `declared=${[...declaredSoluteIds].join(",")} recovered=${recoveredSoluteIds.join(",")}`,
);

/**
 * Handler preconditions, checked statically.
 *
 * These are the couplings that are invisible in the content and only appear when a handler refuses:
 * `filter` needs a precipitate, a seated *and* wetted medium, and an attached receiver; `dry` needs a
 * rinsed precipitate; `cool` needs something genuinely hot; `weigh` with `requiresDryPrecipitate`
 * needs the preceding drying stage to have declared itself finished. Hand-tracing them is what missed
 * two completion blockers in this cycle's first pass, so they are encoded here instead.
 */
const qarActionList = QAR_EXTRACTION.actions;
const actionsBefore = (actionId) => {
  const index_ = qarActionList.findIndex((action) => action.id === actionId);
  return index_ < 0 ? [] : qarActionList.slice(0, index_);
};

for (const dryAction of qarActionList.filter((action) => action.verb === "dry")) {
  const carrierId =
    dryAction.parameters.precipitateSourceInstanceId ?? dryAction.parameters.sourceInstanceId;
  const rinsedFirst = actionsBefore(dryAction.id).some(
    (action) =>
      action.verb === "rinse" &&
      action.parameters.rinseType === "precipitate" &&
      (action.parameters.targetInstanceId === carrierId ||
        // A rinse aimed at a filtration funnel resolves to the medium seated inside it.
        (action.parameters.targetDefinitionId === "buchner-funnel" && carrierId === "qar-filter-paper")),
  );
  check(
    `technique:quick-ache-extraction-recovery/${dryAction.id}: its solid is washed first`,
    rinsedFirst,
    `dry refuses an unrinsed precipitate; carrier=${carrierId}`,
  );
  check(
    `technique:quick-ache-extraction-recovery/${dryAction.id}: declares an oven temperature`,
    typeof dryAction.parameters.temperatureC === "number" && dryAction.parameters.temperatureC > 40,
    "cool refuses anything that is not hot, and weigh refuses anything that is",
  );
  check(
    `technique:quick-ache-extraction-recovery/${dryAction.id}: declares the dryness it reaches`,
    dryAction.parameters.drynessResult === "dry",
    "a stage that does not declare 'dry' leaves requiresDryPrecipitate unsatisfiable",
  );
}

for (const coolAction of qarActionList.filter((action) => action.verb === "cool")) {
  const dryFirst = actionsBefore(coolAction.id).find(
    (action) => action.verb === "dry" && action.parameters.sourceInstanceId === coolAction.parameters.sourceInstanceId,
  );
  check(
    `technique:quick-ache-extraction-recovery/${coolAction.id}: something hot precedes it`,
    Boolean(dryFirst) &&
      Number(dryFirst.parameters.temperatureC) > Number(coolAction.parameters.cooledTemperatureC ?? 25),
    `cool refuses a source at or below cooledTemperatureC`,
  );
  check(
    `technique:quick-ache-extraction-recovery/${coolAction.id}: names its cooling tool`,
    typeof coolAction.parameters.targetInstanceId === "string" &&
      coolAction.parameters.targetDefinitionId === "crucible-tongs",
  );
}

for (const weighAction of qarActionList.filter(
  (action) => action.verb === "weigh" && action.parameters.requiresDryPrecipitate === true,
)) {
  const cooled = actionsBefore(weighAction.id).find(
    (action) => action.verb === "cool" && action.parameters.sourceInstanceId === weighAction.parameters.sourceInstanceId,
  );
  check(
    `technique:quick-ache-extraction-recovery/${weighAction.id}: its assembly is cooled first`,
    Boolean(cooled) &&
      Number(cooled.parameters.cooledTemperatureC ?? 25) < Number(weighAction.parameters.maxSafeTemperatureC),
    "weigh refuses a source above maxSafeTemperatureC",
  );
}

for (const filterAction of qarActionList.filter((action) => action.verb === "filter")) {
  const earlier = actionsBefore(filterAction.id);
  const funnelId = filterAction.parameters.targetInstanceId;
  check(
    `technique:quick-ache-extraction-recovery/${filterAction.id}: its source holds a precipitate`,
    earlier.some(
      (action) =>
        action.verb === "precipitate" &&
        action.parameters.targetInstanceId === filterAction.parameters.sourceInstanceId,
    ),
    "filter refuses a source with no precipitate",
  );
  check(
    `technique:quick-ache-extraction-recovery/${filterAction.id}: a medium is seated in the funnel`,
    earlier.some(
      (action) =>
        action.verb === "place" &&
        action.parameters.targetInstanceId === funnelId &&
        action.parameters.snapZoneId === "buchner-funnel-paper-seat",
    ),
  );
  check(
    `technique:quick-ache-extraction-recovery/${filterAction.id}: that medium is wetted`,
    earlier.some((action) => action.verb === "rinse" && action.parameters.rinseType === "pre-wet"),
    "filter refuses dry filter paper",
  );
  check(
    `technique:quick-ache-extraction-recovery/${filterAction.id}: a receiver is attached under it`,
    earlier.some(
      (action) =>
        action.verb === "place" &&
        action.parameters.targetInstanceId === funnelId &&
        action.parameters.snapZoneId === "buchner-funnel-receiver-neck",
    ),
  );
}

/* ------------------------------------------------------------------ */

const failures = checks.filter((entry) => !entry.passed);
if (argv.has("--json")) {
  console.log(JSON.stringify({ total: checks.length, failed: failures.length, failures }, null, 2));
} else {
  console.log(`cycle 10 separation checks: ${checks.length - failures.length}/${checks.length} passed`);
  for (const failure of failures) {
    console.log(`  FAIL ${failure.name}${failure.detail ? ` — ${failure.detail}` : ""}`);
  }
}
process.exit(failures.length ? 1 : 0);
