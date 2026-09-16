/**
 * Reproduces the Cycle 06 acceptance evidence.
 *
 *   node scripts/verifyCycle06Spectroscopy.mjs
 *
 * Read-only. Checks the investigation-specific invariants that `checkContentConsistency.mjs` cannot
 * express, because they are facts about Investigation 1 and Investigation 11 rather than about the
 * shape of an action:
 *
 * 1. **The eight assigned ratios are complete and total 10 mL** (Inv. 1 finding 3.2), each with its
 *    own labelled tube, its own cuvette, its own reading, and its own concentration calculation.
 * 2. **Every photometric reading is gated.** A read names a wavelength measurement, a zero notebook
 *    tag, and the cuvette instance that must occupy the slot; the zero names a wavelength and a
 *    blank; and no read can run before an insert of the same cuvette.
 * 3. **Reading and recording are separate evidence events.** No `record` action bound to the
 *    photometer atom carries its own value, and each consumes the measurement its read produced.
 * 4. **The three photometric quantities never mix.** A stored measurement carries the unit its
 *    quantity fixes, `A = -log10(T)` is only ever applied to a decimal transmittance, and the
 *    percent-to-decimal conversion consumes a `%T` reading.
 * 5. **Teacher configuration survives.** Every open confirmation point in the two dated plans still
 *    has an action that records it and declares it unresolved, and no calculation whose operands are
 *    teacher-supplied carries a stored answer for them.
 * 6. **The cuvette slot lifecycle balances**, so no reading happens against an occupied-by-the-wrong
 *    -sample or empty compartment.
 * 7. **The optional hydroxide-order extension stays optional** (audit §17.4.1).
 *
 * Exits non-zero on any failure.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (relative) => JSON.parse(readFileSync(join(root, relative), "utf8"));

let failures = 0;
let checks = 0;
const check = (condition, message) => {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.log(`    FAIL ${message}`);
  }
};

const technique = (id) => read(`public/techniques/${id}.json`);
const lab = (id) => read(`public/labs/${id}.json`);
const byId = (definition) => new Map(definition.actions.map((action) => [action.id, action]));
const param = (action, key) => action?.parameters?.[key];
const prerequisiteMeasurements = (action) =>
  new Set(
    (action?.prerequisites ?? [])
      .filter((rule) => rule.type === "measurementRecorded")
      .map((rule) => rule.measurementId),
  );
const prerequisiteActions = (action) =>
  new Set(
    (action?.prerequisites ?? [])
      .filter((rule) => rule.type === "actionEvidence")
      .map((rule) => rule.actionId),
  );
const prerequisiteNotebookTags = (action) =>
  new Set(
    (action?.prerequisites ?? [])
      .filter((rule) => rule.type === "notebookEntry")
      .map((rule) => rule.notebookTag),
  );

/** The unit each quantity fixes, mirrored from `src/runtime/calculations.ts` and checked below. */
const PHOTOMETRIC_UNITS = {
  percentTransmittance: "%T",
  decimalTransmittance: "T",
  absorbance: "absorbance",
};

const calculationsSource = readFileSync(join(root, "src/runtime/calculations.ts"), "utf8");
for (const [quantity, unit] of Object.entries(PHOTOMETRIC_UNITS)) {
  check(
    calculationsSource.includes(`${quantity}: "${unit}"`),
    `src/runtime/calculations.ts no longer maps ${quantity} to "${unit}"`,
  );
}
check(
  calculationsSource.includes("export const calculateAbsorbanceFromDecimalT"),
  "calculateAbsorbanceFromDecimalT is gone; A = -log10(T) has no decimal-only entry point",
);
check(
  calculationsSource.includes("export const calculateDilutedConcentrationMicromolar"),
  "calculateDilutedConcentrationMicromolar is gone; the eight standards would compute 0 again",
);

/* ------------------------------------------------------------------ *
 * Investigation 1
 * ------------------------------------------------------------------ */

console.log("Investigation 1 — Blue #1");

const RATIOS = [
  ["10-0", 10, 0],
  ["8-2", 8, 2],
  ["6-4", 6, 4],
  ["4-6", 4, 6],
  ["3-7", 3, 7],
  ["2-8", 2, 8],
  ["1-9", 1, 9],
  ["0-10", 0, 10],
];

const dilutions = technique("blue1-standard-dilutions");
const percentT = technique("blue1-percent-transmittance");
const classCalibration = technique("blue1-class-calibration");
const b1Lab = lab("blue1-spectroscopy");
const dilutionActions = byId(dilutions);
const percentTActions = byId(percentT);
const calibrationActions = byId(classCalibration);
const b1LabActions = byId(b1Lab);

check(RATIOS.length === 8, "Investigation 1 lists eight stock/water ratios");
for (const [key, stockMl, waterMl] of RATIOS) {
  check(stockMl + waterMl === 10, `ratio ${key} totals 10 mL`);
  check(dilutionActions.has(`i1-r${key}-label`), `ratio ${key} has a labelling step (P-02)`);

  if (stockMl > 0) {
    const measure = dilutionActions.get(`i1-r${key}-measure-stock`);
    const transfer = dilutionActions.get(`i1-r${key}-transfer-stock`);
    check(param(measure, "volumeMl") === stockMl, `ratio ${key} measures ${stockMl} mL of stock`);
    check(param(transfer, "volumeMl") === stockMl, `ratio ${key} transfers ${stockMl} mL of stock`);
    check(
      measure?.interaction?.type === "pourInto",
      `ratio ${key} stock measurement is an apparatus interaction, not prose`,
    );
    check(
      prerequisiteMeasurements(measure).has("i1-stock-concentration"),
      `ratio ${key} cannot be measured before the teacher's stock concentration is on record`,
    );
  }
  if (waterMl > 0) {
    const measure = dilutionActions.get(`i1-r${key}-measure-water`);
    const transfer = dilutionActions.get(`i1-r${key}-transfer-water`);
    check(param(measure, "volumeMl") === waterMl, `ratio ${key} measures ${waterMl} mL of water`);
    check(param(transfer, "volumeMl") === waterMl, `ratio ${key} transfers ${waterMl} mL of water`);
  }

  // The template had no implementation before this cycle: every standard computed 0 and passed.
  const concentration = dilutionActions.get(`i1-r${key}-calculate-concentration`);
  check(
    param(concentration, "template") === "dilutedConcentrationMicromolar",
    `ratio ${key} concentration uses the micromolar dilution template`,
  );
  check(
    param(concentration, "stockConcentrationMeasurementId") === "i1-stock-concentration",
    `ratio ${key} concentration consumes the teacher-supplied stock concentration`,
  );
  check(
    param(concentration, "expected") === undefined,
    `ratio ${key} concentration carries no stored answer: the stock molarity is teacher-supplied, so no expected value can exist`,
  );
  check(
    param(concentration, "stockVolumeMl") === stockMl && param(concentration, "finalVolumeMl") === 10,
    `ratio ${key} concentration uses ${stockMl} mL in 10 mL`,
  );

  // Instrument workflow: fill, condition, insert, read, record, remove.
  const insert = percentTActions.get(`i1-r${key}-insert-cuvette`);
  const readAction = percentTActions.get(`i1-r${key}-read-percent-t`);
  const record = percentTActions.get(`i1-r${key}-record-percent-t`);
  const remove = percentTActions.get(`i1-r${key}-remove-cuvette`);
  check(Boolean(insert), `ratio ${key} inserts its cuvette into the instrument`);
  check(Boolean(remove), `ratio ${key} removes its cuvette from the instrument`);
  check(
    param(insert, "equipmentInstanceId") === `i1-r${key}-cuvette` &&
      param(remove, "equipmentInstanceId") === `i1-r${key}-cuvette`,
    `ratio ${key} inserts and removes the same cuvette instance`,
  );
  check(
    param(readAction, "photometerOperation") === "read" &&
      param(readAction, "photometricQuantity") === "percentTransmittance",
    `ratio ${key} reads percent transmittance through the gated photometer path`,
  );
  check(
    param(readAction, "unit") === PHOTOMETRIC_UNITS.percentTransmittance,
    `ratio ${key} stores its reading in %T`,
  );
  check(
    param(readAction, "wavelengthMeasurementId") === "i1-wavelength",
    `ratio ${key} read requires the teacher-set wavelength`,
  );
  check(
    param(readAction, "requiresZeroNotebookTag") === "instrument-blanked",
    `ratio ${key} read requires the blank/zero`,
  );
  check(
    param(readAction, "cuvetteInstanceId") === `i1-r${key}-cuvette`,
    `ratio ${key} read names the cuvette that must occupy the slot`,
  );
  check(
    prerequisiteActions(readAction).has(`i1-r${key}-insert-cuvette`),
    `ratio ${key} cannot be read before its cuvette is seated`,
  );
  check(
    param(readAction, "instrumentReadingValue") === undefined,
    `ratio ${key} supplies no reading: Investigation 1 withholds the stock molarity and the wavelength, so no %T can be derived`,
  );
  check(
    param(record, "value") === undefined,
    `ratio ${key} record carries no value of its own`,
  );
  check(
    prerequisiteMeasurements(record).has(`i1-r${key}-percent-t`),
    `ratio ${key} record consumes the measurement its read produced`,
  );

  // %T -> T -> -log T, each conversion consuming the previous quantity and no other.
  const decimal = calibrationActions.get(`i1-r${key}-calculate-decimal-t`);
  const absorbance = calibrationActions.get(`i1-r${key}-calculate-absorbance`);
  check(
    param(decimal, "template") === "decimalTransmittance" &&
      param(decimal, "percentTransmittanceMeasurementId") === `i1-r${key}-percent-t`,
    `ratio ${key} decimal transmittance consumes the %T reading`,
  );
  check(
    param(absorbance, "template") === "absorbanceFromDecimalT" &&
      param(absorbance, "decimalTransmittanceCalculationId") === `i1-r${key}-decimal-t`,
    `ratio ${key} applies -log10 to the decimal transmittance, not to the percent`,
  );
  check(
    param(absorbance, "percentTransmittanceMeasurementId") === undefined,
    `ratio ${key} transformation never reads a percent transmittance`,
  );
}

const zero = percentTActions.get("i1-zero-instrument");
check(param(zero, "photometerOperation") === "zero", "the Blue #1 blank step zeroes the instrument");
check(
  param(zero, "cuvetteInstanceId") === "i1-blank-cuvette",
  "the Blue #1 zero names the blank cuvette that must occupy the slot",
);
check(
  prerequisiteActions(zero).has("i1-insert-blank-cuvette"),
  "the Blue #1 zero cannot run before the blank is seated",
);
check(
  Boolean(percentTActions.get("i1-remove-blank-cuvette")),
  "the Blue #1 blank is removed before a sample is seated",
);
check(
  param(percentTActions.get("i1-place-spectrophotometer"), "location") === "workbench" &&
    percentTActions.get("i1-place-spectrophotometer")?.interaction?.type === "dragToZone",
  "the Blue #1 spectrophotometer is placed as an apparatus interaction",
);

const unknownRead = b1LabActions.get("i1-read-unknown-percent-t");
check(
  param(unknownRead, "photometerOperation") === "read" &&
    param(unknownRead, "cuvetteInstanceId") === "i1-unknown-cuvette",
  "the sports-drink reading goes through the same gated path as the standards",
);
check(
  prerequisiteActions(unknownRead).has("i1-insert-unknown-cuvette") &&
    prerequisiteNotebookTags(unknownRead).has("inquiry-approval"),
  "the sports-drink reading requires both a seated cuvette and teacher approval (I-03)",
);
for (const id of ["i1-calculate-original-molarity", "i1-calculate-mass-500ml"]) {
  const action = b1LabActions.get(id);
  check(param(action, "studentValueRequired") === true, `${id} requires the student's own value`);
  check(param(action, "expected") === undefined, `${id} carries no stored answer`);
}

// Confirmation points 2 and 5 stay open, and the ambiguous transformation is preserved verbatim.
const ambiguity = calibrationActions.get("i1-record-source-ambiguity");
check(
  Array.isArray(param(ambiguity, "candidateTransformations")) &&
    param(ambiguity, "candidateTransformations").includes("1 x 10^T"),
  "the ambiguous `1 x 10^T` transformation is preserved rather than reinterpreted",
);
for (const [owner, actions, id] of [
  ["blue1-standard-dilutions", dilutionActions, "i1-record-stock-concentration"],
  ["blue1-standard-dilutions", dilutionActions, "i1-record-dilution-assignments"],
  ["blue1-percent-transmittance", percentTActions, "i1-record-wavelength"],
  ["blue1-percent-transmittance", percentTActions, "i1-record-blank-cuvette-rule"],
  ["blue1-class-calibration", calibrationActions, "i1-record-source-ambiguity"],
  ["blue1-class-calibration", calibrationActions, "i1-record-confirmed-calibration"],
  ["blue1-spectroscopy", b1LabActions, "i1-record-molar-mass-reference"],
  ["blue1-spectroscopy", b1LabActions, "i1-record-over-range-response"],
]) {
  check(
    typeof param(actions.get(id), "unresolvedConfirmationPoint") === "string",
    `${owner}/${id} still declares its confirmation point unresolved`,
  );
}

/* ------------------------------------------------------------------ *
 * Investigation 11
 * ------------------------------------------------------------------ */

console.log("Investigation 11 — crystal violet");

const STANDARDS = [
  ["05", 5],
  ["10", 10],
  ["15", 15],
  ["20", 20],
  ["25", 25],
];

const series = technique("crystal-violet-micromolar-dilution-series");
const cvCalibration = technique("crystal-violet-spectrophotometer-calibration");
const waste = technique("crystal-violet-waste-treatment");
const cvLab = lab("crystal-violet-rate-law");
const seriesActions = byId(series);
const cvCalibrationActions = byId(cvCalibration);
const wasteActions = byId(waste);
const cvLabActions = byId(cvLab);

const setWavelength = cvCalibrationActions.get("cv11-set-approved-wavelength");
check(Boolean(setWavelength), "C-05, setting the approved wavelength, has an action");
check(
  param(setWavelength, "measurementId") === "cv11-approved-wavelength-nm" &&
    param(setWavelength, "unit") === "nm",
  "the approved wavelength is stored as a measurement in nm",
);
check(
  param(setWavelength, "inputMode") === "numeric" && param(setWavelength, "value") === undefined,
  "the approved wavelength is entered rather than supplied: it depends on the device and Figure 1",
);

const cvZero = cvCalibrationActions.get("cv11-zero-spectrophotometer");
check(
  param(cvZero, "photometerOperation") === "zero" &&
    param(cvZero, "wavelengthMeasurementId") === "cv11-approved-wavelength-nm" &&
    param(cvZero, "cuvetteInstanceId") === "cv11-blank-cuvette",
  "the crystal-violet zero requires the approved wavelength and the approved blank in the slot",
);

for (const [key, micromolar] of STANDARDS) {
  const condition = cvCalibrationActions.get(`cv11-condition-cuvette-${key}`);
  const insert = cvCalibrationActions.get(`cv11-insert-cuvette-${key}`);
  const readAction = cvCalibrationActions.get(`cv11-read-absorbance-${key}`);
  const record = cvCalibrationActions.get(`cv11-record-absorbance-${key}`);
  const remove = cvCalibrationActions.get(`cv11-remove-calibration-cuvette-${key}`);
  check(Boolean(condition && insert && readAction && record && remove), `${micromolar} uM standard runs the full condition/insert/read/record/remove cycle`);
  check(
    param(readAction, "photometerOperation") === "read" &&
      param(readAction, "photometricQuantity") === "absorbance",
    `${micromolar} uM read goes through the gated photometer path`,
  );
  check(
    param(readAction, "measurementId") === `cv11-calibration-absorbance-${key}`,
    `${micromolar} uM read produces the calibration measurement`,
  );
  check(
    typeof param(readAction, "instrumentReadingValue") === "number",
    `${micromolar} uM read carries the approved simulator response, so the instrument produces the number`,
  );
  check(
    param(readAction, "readingProvenance") === "teacher-approved simulator calibration profile",
    `${micromolar} uM reading declares where its value comes from`,
  );
  check(
    param(record, "value") === undefined,
    `${micromolar} uM record carries no value: the reading is the read's evidence, not the record's`,
  );
  check(
    prerequisiteMeasurements(record).has(`cv11-calibration-absorbance-${key}`),
    `${micromolar} uM record consumes the measurement its read produced`,
  );
  check(
    param(record, "unit") === PHOTOMETRIC_UNITS.absorbance &&
      param(record, "concentrationUm") === micromolar,
    `${micromolar} uM record keeps its unit and its micromolar concentration`,
  );
  check(
    prerequisiteActions(readAction).has(`cv11-insert-cuvette-${key}`),
    `${micromolar} uM read cannot run before its cuvette is seated`,
  );
}

// The four prepared standards come from the 25.0 uM stock in a stated 10. mL final volume.
for (const [key, micromolar] of STANDARDS.slice(0, 4)) {
  const calculate = seriesActions.get(`cv11-calculate-standard-${key}`);
  check(
    param(calculate, "stockConcentrationUm") === 25 &&
      param(calculate, "targetConcentrationUm") === micromolar &&
      param(calculate, "finalVolumeMl") === 10,
    `${micromolar} uM standard is ${micromolar} uM from 25.0 uM stock in 10. mL`,
  );
  check(
    param(calculate, "expected") === (micromolar * 10) / 25,
    `${micromolar} uM standard's stock volume matches M1V1 = M2V2`,
  );
  check(
    param(seriesActions.get(`cv11-add-water-${key}`), "statedFinalVolume") === "10. mL",
    `${micromolar} uM standard preserves the manual's printed '10. mL' precision`,
  );
  for (const step of ["measure-stock", "transfer-stock", "measure-water", "add-water"]) {
    const action = seriesActions.get(`cv11-${step}-${key}`);
    check(
      typeof param(action, "pipetteAssignment") === "string",
      `cv11-${step}-${key} names its assigned pipette (S-04: separate CV, NaOH, and water pipettes)`,
    );
  }
}

// The kinetic run: time zero, dead time, one fresh reading per interval, and a freed slot at the end.
check(
  prerequisiteNotebookTags(cvLabActions.get("cv11-start-reaction-with-naoh")).has("timer-armed"),
  "the reaction cannot be started before the timer and acquisition are armed (K-02 before K-03)",
);
check(
  prerequisiteActions(cvLabActions.get("cv11-measure-reacting-aliquot")).has(
    "cv11-start-reaction-with-naoh",
  ),
  "no aliquot is drawn before time zero",
);
const deadTime = cvLabActions.get("cv11-record-dead-time");
check(
  typeof param(deadTime, "value") === "number" && param(deadTime, "unit") === "s",
  "the dead time from reaction start to the first accepted reading is recorded",
);
for (let index = 1; index <= 8; index += 1) {
  const readAction = cvLabActions.get(`cv11-read-kinetic-absorbance-${index}`);
  const record = cvLabActions.get(`cv11-record-kinetic-absorbance-${index}`);
  check(
    param(readAction, "photometerOperation") === "read" &&
      param(readAction, "photometricQuantity") === "absorbance",
    `kinetic reading ${index} goes through the gated photometer path`,
  );
  check(
    param(readAction, "cuvetteInstanceId") === "cv11-kinetic-cuvette",
    `kinetic reading ${index} names the kinetic cuvette`,
  );
  check(
    typeof param(readAction, "scheduledTimeS") === "number",
    `kinetic reading ${index} is taken at its scheduled time`,
  );
  check(param(record, "value") === undefined, `kinetic record ${index} carries no value of its own`);
  check(
    prerequisiteMeasurements(record).has(`cv11-kinetic-absorbance-${index}`),
    `kinetic record ${index} consumes the measurement its read produced`,
  );
  check(
    param(record, "freshRecord") === true,
    `kinetic record ${index} is a fresh pair, never replayed data`,
  );
  if (index > 1) {
    check(
      prerequisiteMeasurements(readAction).has(`cv11-kinetic-absorbance-${index - 1}`),
      `kinetic reading ${index} follows reading ${index - 1}`,
    );
  }
}
const stop = cvLabActions.get("cv11-confirm-percent-completion-stop");
check(
  typeof param(stop, "unresolvedConfirmationPoint") === "string" &&
    param(stop, "configuredStopPercentCompletion") === "teacher-configured",
  "the stopping threshold stays an instructor decision and is never inferred from appearance",
);
check(
  prerequisiteNotebookTags(cvLabActions.get("cv11-remove-kinetic-cuvette")).has("stop-rule"),
  "the kinetic cuvette leaves the slot only after the approved stop rule is confirmed",
);

// Waste treatment, and the two verifications the source keeps separate.
check(
  wasteActions.get("cv11-bleach-waste-with-naoh")?.atomId === "atom.transfer.treat-waste-to-endpoint",
  "bleaching the crystal violet is a treatment step with an endpoint, not a pour",
);
check(
  prerequisiteNotebookTags(wasteActions.get("cv11-neutralize-excess-base")).has("bleached-waste"),
  "neutralisation cannot run before decolorisation is verified",
);
check(
  typeof param(wasteActions.get("cv11-neutralize-excess-base"), "unresolvedConfirmationPoint") ===
    "string",
  "the acid identity, pH target, and disposal rule stay teacher-configured (confirmation point 6)",
);

// Audit §17.4.1: the optional z/k extension stays optional.
const carrier = (cvLab.techniques ?? []).find(
  (embedded) => embedded.id === "crystal-violet-hydroxide-order-extension",
);
check(Boolean(carrier), "the hydroxide-order extension carrier is still embedded in the lab");
check((carrier?.actions ?? []).length === 3, "the carrier still holds its three extension actions");
const rootActionIds = new Set(cvLab.process.nodes.map((node) => node.actionId));
for (const id of [
  "cv11-extension-approval-gate",
  "cv11-extension-design-hydroxide-series",
  "cv11-extension-determine-z-and-k",
]) {
  check(cvLabActions.has(id), `${id} is still declared`);
  check(!rootActionIds.has(id), `${id} stays out of the required student flow`);
}
check(
  (carrier?.initialState?.equipment ?? []).length === 0,
  "the carrier still contributes no runtime equipment payload",
);

/* ------------------------------------------------------------------ *
 * Measurement provenance closure
 *
 * The check this cycle needed and did not have. Every gate and every calculation operand names a
 * measurement id; a gate naming an id nothing writes is unsatisfiable through every input path, and
 * reads exactly like a working gate in the JSON. Reviewing this cycle's own code found three
 * configuration steps in that state, which had made both investigations unstartable.
 * ------------------------------------------------------------------ */

console.log("Measurement provenance");

/** Mirrors the reducer's measurement-writing sites. */
const MEASUREMENT_WRITING_VERBS = new Set([
  "weigh",
  "measureVolume",
  "dilute",
  "developChromatogram",
  "record",
]);

const producedMeasurementId = (action) => {
  const id = param(action, "measurementId");
  if (typeof id !== "string" || !id) return undefined;
  if (MEASUREMENT_WRITING_VERBS.has(action.verb)) return id;
  if (action.verb !== "observe") return undefined;
  const p = action.parameters ?? {};
  return p.chromatographyMeasurementType || p.configurationQuantity || p.photometerOperation === "read"
    ? id
    : undefined;
};

const consumedMeasurementIds = (actions) => {
  const consumed = new Map();
  for (const action of actions) {
    for (const rule of action.prerequisites ?? []) {
      if (rule.type === "measurementRecorded" && rule.measurementId) {
        consumed.set(rule.measurementId, action.id);
      }
    }
    for (const [key, value] of Object.entries(action.parameters ?? {})) {
      if (/MeasurementId$/.test(key) && typeof value === "string") consumed.set(value, action.id);
    }
  }
  return consumed;
};

const TECHNIQUES = [
  "blue1-standard-dilutions",
  "blue1-percent-transmittance",
  "blue1-class-calibration",
  "crystal-violet-micromolar-dilution-series",
  "crystal-violet-spectrophotometer-calibration",
  "crystal-violet-integrated-rate-law-comparison",
  "crystal-violet-waste-treatment",
];
const LABS = ["blue1-spectroscopy", "crystal-violet-rate-law"];

const resolvedActions = (definition) => {
  const actions = [...(definition.actions ?? [])];
  for (const ref of definition.techniqueRefs ?? []) {
    const pinned = technique(ref.techniqueId);
    const selected =
      ref.actionIds === "all"
        ? pinned.actions
        : pinned.actions.filter((action) => (ref.actionIds ?? []).includes(action.id));
    actions.push(...selected);
  }
  return actions;
};

// Every lab must be closed: nothing a lab consumes may be unwritten, because the lab is what a
// student plays.
const labProduced = new Map();
for (const labId of LABS) {
  const actions = resolvedActions(lab(labId));
  const produced = new Set(actions.map(producedMeasurementId).filter(Boolean));
  labProduced.set(labId, produced);
  for (const [id, consumer] of consumedMeasurementIds(actions)) {
    check(produced.has(id), `${labId}: ${consumer} consumes ${id}, which no resolved action writes`);
  }
}

// A technique may legitimately consume a measurement a sibling technique writes — Investigation 1
// separates measuring %T (P-10/P-11) from pooling and plotting it (A-01 to A-04), so the class
// calibration technique cannot produce its own readings. What it may not do is consume an id no lab
// pinning it produces either, which would leave the operand unreachable everywhere.
for (const techniqueId of TECHNIQUES) {
  const definition = technique(techniqueId);
  const produced = new Set(definition.actions.map(producedMeasurementId).filter(Boolean));
  for (const [id, consumer] of consumedMeasurementIds(definition.actions)) {
    if (produced.has(id)) continue;
    const coveringLabs = LABS.filter(
      (labId) =>
        lab(labId).techniqueRefs.some((ref) => ref.techniqueId === techniqueId) &&
        labProduced.get(labId).has(id),
    );
    check(
      coveringLabs.length > 0,
      `${techniqueId}: ${consumer} consumes ${id}, which neither it nor any lab pinning it writes`,
    );
  }
}

// The three configuration values every gate in this cycle depends on.
for (const [ownerId, actionId, quantityWord] of [
  ["blue1-percent-transmittance", "i1-record-wavelength", "wavelength"],
  ["blue1-standard-dilutions", "i1-record-stock-concentration", "concentration"],
  ["crystal-violet-spectrophotometer-calibration", "cv11-set-approved-wavelength", "wavelength"],
]) {
  const action = byId(technique(ownerId)).get(actionId);
  check(
    typeof param(action, "configurationQuantity") === "string",
    `${ownerId}/${actionId} declares configurationQuantity, so the runtime stores it as a measurement`,
  );
  check(
    typeof param(action, "measurementId") === "string" && typeof param(action, "unit") === "string",
    `${ownerId}/${actionId} names the measurement id and unit its configuration is stored under`,
  );
  check(
    param(action, "configuredValue") === undefined,
    `${ownerId}/${actionId} ships no ${quantityWord} value: both plans state the teacher supplies it`,
  );
  check(
    param(action, "photometricQuantity") === undefined,
    `${ownerId}/${actionId} declares no photometricQuantity: a configuration step stores no photometric value`,
  );
}

/* ------------------------------------------------------------------ *
 * Version pins
 * ------------------------------------------------------------------ */

const PINS = [
  ["blue1-spectroscopy", "blue1-standard-dilutions", "1.1.0"],
  ["blue1-spectroscopy", "blue1-percent-transmittance", "1.1.0"],
  ["blue1-spectroscopy", "blue1-class-calibration", "1.1.0"],
  ["crystal-violet-rate-law", "crystal-violet-micromolar-dilution-series", "1.1.0"],
  ["crystal-violet-rate-law", "crystal-violet-spectrophotometer-calibration", "1.1.0"],
  ["crystal-violet-rate-law", "crystal-violet-integrated-rate-law-comparison", "1.0.0"],
  ["crystal-violet-rate-law", "crystal-violet-waste-treatment", "1.1.0"],
];
for (const [labId, techniqueId, version] of PINS) {
  const definition = lab(labId);
  const ref = definition.techniqueRefs.find((entry) => entry.techniqueId === techniqueId);
  check(ref?.version === version, `${labId} pins ${techniqueId}@${version}`);
  check(
    technique(techniqueId).metadata.version === version,
    `${techniqueId} publishes version ${version}`,
  );
}

console.log(
  failures === 0
    ? `OK: ${checks} Cycle 06 invariants hold`
    : `FAILURES: ${failures} of ${checks} Cycle 06 invariants`,
);
process.exit(failures === 0 ? 0 : 1);
