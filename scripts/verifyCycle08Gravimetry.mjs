/**
 * Cycle 08 verifier — Investigation 3 hard-water gravimetry.
 *
 * `npm run content:check` enforces the contracts that apply to every owner: atom identity, role
 * bindings, source traceability, visual-state registration. This script enforces what is specific
 * to *this* investigation and could otherwise only be asserted in prose:
 *
 *   1. The practice phase and the inquiry phase stay separate recipes.
 *   2. Tare chronology cannot be bypassed.
 *   3. Drying, breakup, cooling, and weighing chronology cannot be bypassed.
 *   4. The two unresolved confirmation points are configured, not decided.
 *   5. Balance tolerances equal one configured readability, drawn from the source's two.
 *   6. Every derived quantity comes from named recorded evidence, never a literal.
 *   7. Sample C and Sample D never share an evidence identity.
 *
 * Every check below was tamper-tested: the mutation that should break it was applied to the real
 * content, the check was observed to fail, and the mutation was reverted.
 *
 * Usage:
 *   node scripts/verifyCycle08Gravimetry.mjs
 *   node scripts/verifyCycle08Gravimetry.mjs --json
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = new Set(process.argv.slice(2));
const readJson = (relativePath) => JSON.parse(readFileSync(join(root, relativePath), "utf8"));

const LAB_PATH = "public/labs/hard-water-analysis.json";
const TECHNIQUE_IDS = [
  "hard-water-practice-preparation",
  "gravimetric-vacuum-filtration",
  "two-stage-precipitate-drying",
  "inquiry-plan-approval",
  "hard-water-two-sample-inquiry",
];

const SOURCE_BALANCE_READABILITY_G = [0.001, 0.0001];
const SOURCE_OVEN_RANGE_C = { min: 110, max: 120 };
const SOURCE_PRECONCENTRATION_FACTOR = 200;
const SOURCE_ALIQUOT_ML = 20;

const failures = [];
const checks = [];
const check = (name, detail, passed) => {
  checks.push({ name, passed });
  if (!passed) failures.push(`${name}: ${detail}`);
};

const lab = readJson(LAB_PATH);
const techniques = new Map(
  TECHNIQUE_IDS.map((id) => [id, readJson(`public/techniques/${id}.json`)]),
);
const actionsById = new Map();
for (const [techniqueId, technique] of techniques) {
  for (const action of technique.actions) actionsById.set(action.id, { ...action, techniqueId });
}

const action = (id) => {
  const found = actionsById.get(id);
  if (!found) throw new Error(`Cycle 08 verifier: no action ${id}`);
  return found;
};

const prerequisiteIds = (id) => new Set(action(id).prerequisites.map((rule) => rule.actionId).filter(Boolean));
const prerequisiteTags = (id) =>
  new Set(action(id).prerequisites.map((rule) => rule.notebookTag).filter(Boolean));

/* ------------------------------------------------------------------ *
 * 1. Version pinning resolves.
 * ------------------------------------------------------------------ */

for (const ref of lab.techniqueRefs) {
  const technique = techniques.get(ref.techniqueId);
  check(
    `pin/${ref.techniqueId}`,
    `lab pins ${ref.version}, technique is ${technique?.metadata.version}`,
    Boolean(technique) && technique.metadata.version === ref.version,
  );
}

const resolvedActionIds = new Set();
for (const ref of lab.techniqueRefs) {
  const technique = techniques.get(ref.techniqueId);
  const ids =
    ref.actionIds === "all" ? technique.actions.map((entry) => entry.id) : ref.actionIds;
  for (const id of ids) resolvedActionIds.add(id);
}
const labNodeActionIds = lab.process.nodes.map((node) => node.actionId).filter(Boolean);
check(
  "pin/every-node-action-resolves",
  `unresolved: ${labNodeActionIds.filter((id) => !resolvedActionIds.has(id)).join(", ")}`,
  labNodeActionIds.every((id) => resolvedActionIds.has(id)),
);

/* ------------------------------------------------------------------ *
 * 2. Practice and inquiry stay separate recipes.
 *
 * Finding 1 (M/C): the practice uses about 2 g of each solid, the inquiry 0.50 M sodium carbonate
 * against unknown water. Substituting one for the other is the specific failure the source warns
 * against, so the two phases must not share a reagent source or a measurement id.
 * ------------------------------------------------------------------ */

const practiceActions = [
  ...techniques.get("hard-water-practice-preparation").actions,
  ...techniques.get("gravimetric-vacuum-filtration").actions,
  ...techniques.get("two-stage-precipitate-drying").actions,
];
const inquiryActions = techniques.get("hard-water-two-sample-inquiry").actions;

const measurementIds = (list) =>
  new Set(
    list
      .map((entry) => entry.parameters.measurementId)
      .filter((value) => typeof value === "string"),
  );
const sharedMeasurements = [...measurementIds(practiceActions)].filter((id) =>
  measurementIds(inquiryActions).has(id),
);
check(
  "phases/no-shared-measurement-id",
  `shared: ${sharedMeasurements.join(", ")}`,
  sharedMeasurements.length === 0,
);

check(
  "phases/practice-uses-mass-recipe",
  "the practice preparation must weigh both solids as masses, not deliver a molarity",
  ["add-sodium-carbonate-solid", "add-calcium-chloride-solid"].every(
    (id) =>
      typeof action(id).parameters.massG === "number" &&
      action(id).parameters.reagentMolarityM === undefined,
  ),
);

check(
  "phases/inquiry-uses-molar-recipe",
  "the inquiry must add carbonate as a stated molarity, not as an about-2-g solid",
  ["unknown-c-add-carbonate", "unknown-d-add-carbonate"].every(
    (id) =>
      action(id).parameters.reagentMolarityM === 0.5 &&
      action(id).parameters.massG === undefined,
  ),
);

for (const sample of ["c", "d"]) {
  check(
    `phases/inquiry-${sample}-aliquot-is-source-stated`,
    `section 10 fixes a ${SOURCE_ALIQUOT_ML} mL aliquot for every assigned sample`,
    action(`unknown-${sample}-measure-aliquot`).parameters.volumeMl === SOURCE_ALIQUOT_ML,
  );
}

/* ------------------------------------------------------------------ *
 * 3. Sample identities stay independent.
 *
 * Finding 9: two of six samples, each with its own masses, observations, and calculations. A
 * notebook tag or measurement id shared between them would let one sample's evidence satisfy the
 * other's gate.
 * ------------------------------------------------------------------ */

const sampleEvidence = (sample) =>
  new Set(
    inquiryActions
      .filter((entry) => entry.id.startsWith(`unknown-${sample}-`))
      .flatMap((entry) => [
        entry.parameters.measurementId,
        entry.parameters.calculationId,
        entry.parameters.tag,
      ])
      .filter((value) => typeof value === "string"),
  );
const sharedSampleEvidence = [...sampleEvidence("c")].filter((id) => sampleEvidence("d").has(id));
check(
  "samples/evidence-identities-disjoint",
  `shared between Sample C and Sample D: ${sharedSampleEvidence.join(", ")}`,
  sharedSampleEvidence.length === 0,
);

/* ------------------------------------------------------------------ *
 * 4. Tare chronology.
 *
 * FD-01 weighs the dry paper before it is seated; FD-09/FD-10 label and weigh the watch glass
 * before it receives anything. Once the paper and solid are on the glass, neither tare can be
 * taken any more, so these are one-way gates rather than advice.
 * ------------------------------------------------------------------ */

const tareChronology = [
  ["seat-practice-filter-paper", "practice-filter-paper-mass"],
  ["transfer-practice-paper-to-watch", "practice-watch-glass-mass"],
  ["weigh-practice-watch-glass", "practice-watch-glass-identity"],
  ["unknown-c-seat-paper", "unknown-c-filter-paper-mass"],
  ["unknown-c-transfer-paper", "unknown-c-watch-glass-mass"],
  ["unknown-c-weigh-watch", "unknown-c-watch-glass-identity"],
  ["unknown-d-seat-paper", "unknown-d-filter-paper-mass"],
  ["unknown-d-transfer-paper", "unknown-d-watch-glass-mass"],
  ["unknown-d-weigh-watch", "unknown-d-watch-glass-identity"],
];
for (const [actionId, tag] of tareChronology) {
  check(
    `tare/${actionId}`,
    `must require the notebook entry ${tag}`,
    prerequisiteTags(actionId).has(tag),
  );
}

/* ------------------------------------------------------------------ *
 * 5. Drying, breakup, cooling, and weighing chronology.
 *
 * Finding 7: 10-15 min at 110-120 C, remove, break up, 5 more minutes, cool, weigh. Each stage
 * must gate the next, the two stages must reach different dryness, and the cooled assembly is what
 * the balance accepts.
 * ------------------------------------------------------------------ */

const dryingChains = [
  {
    first: "first-practice-drying",
    second: "second-practice-drying",
    cool: "cool-practice-assembly",
    weigh: "weigh-practice-combined",
    breakupTag: "practice-breakup",
    transfer: "transfer-practice-paper-to-watch",
  },
  ...["c", "d"].map((sample) => ({
    first: `unknown-${sample}-first-dry`,
    second: `unknown-${sample}-second-dry`,
    cool: `unknown-${sample}-cool`,
    weigh: `unknown-${sample}-weigh-combined`,
    breakupTag: `unknown-${sample}-breakup`,
    transfer: `unknown-${sample}-transfer-paper`,
  })),
];

for (const chain of dryingChains) {
  check(
    `drying/${chain.first}-follows-transfer`,
    `must require ${chain.transfer}`,
    prerequisiteIds(chain.first).has(chain.transfer),
  );
  check(
    `drying/${chain.second}-follows-first-and-breakup`,
    `must require ${chain.first} and the notebook entry ${chain.breakupTag}`,
    prerequisiteIds(chain.second).has(chain.first) &&
      prerequisiteTags(chain.second).has(chain.breakupTag),
  );
  check(
    `drying/${chain.cool}-follows-second`,
    `must require ${chain.second}`,
    prerequisiteIds(chain.cool).has(chain.second),
  );
  check(
    `drying/${chain.weigh}-follows-cool`,
    `must require ${chain.cool}`,
    prerequisiteIds(chain.weigh).has(chain.cool),
  );

  const first = action(chain.first).parameters;
  const second = action(chain.second).parameters;
  check(
    `drying/${chain.first}-is-not-fully-dry`,
    "the first stage must not report the solid as dry; the manual dries again after breakup",
    first.drynessResult === "damp",
  );
  check(
    `drying/${chain.second}-is-dry`,
    "the second stage is the one that reaches dry mass",
    second.drynessResult === "dry",
  );
  check(
    `drying/${chain.first}-distinct-state`,
    "the two stages must not render the same visual state",
    typeof first.visualState === "string" && first.visualState !== second.visualState,
  );
  for (const stage of [first, second]) {
    check(
      `drying/${chain.first}-temperature-in-range`,
      `oven temperature must sit inside the manual's ${SOURCE_OVEN_RANGE_C.min}-${SOURCE_OVEN_RANGE_C.max} C`,
      typeof stage.temperatureC === "number" &&
        stage.temperatureC >= SOURCE_OVEN_RANGE_C.min &&
        stage.temperatureC <= SOURCE_OVEN_RANGE_C.max,
    );
  }
  // The oven temperature is what makes the assembly refuse the balance, so both must be present or
  // the cooling step is decorative.
  check(
    `drying/${chain.weigh}-refuses-warm-and-wet`,
    "the combined weighing must declare a safe temperature ceiling and require a dry precipitate",
    typeof action(chain.weigh).parameters.maxSafeTemperatureC === "number" &&
      action(chain.weigh).parameters.requiresDryPrecipitate === true,
  );
  check(
    `drying/${chain.cool}-cools-below-ceiling`,
    "the cooled temperature must fall below the weighing ceiling",
    action(chain.cool).parameters.cooledTemperatureC <
      action(chain.weigh).parameters.maxSafeTemperatureC,
  );
}

/* ------------------------------------------------------------------ *
 * 6. Filtration assembly chronology and the configuration gate.
 *
 * Confirmation point 1 leaves gravity versus vacuum open. Nothing here may assemble apparatus
 * before the selected configuration is on record, and the recorded choice must name both
 * admissible configurations rather than presenting one as the manual's.
 * ------------------------------------------------------------------ */

const configuration = action("select-filtration-configuration").parameters;
check(
  "configuration/filtration-choice-is-recorded",
  "the configuration action must record both admissible configurations and its provenance",
  Array.isArray(configuration.admissibleConfigurations) &&
    configuration.admissibleConfigurations.includes("gravity") &&
    configuration.admissibleConfigurations.includes("vacuum") &&
    configuration.configurationProvenance === "teacher-configured" &&
    configuration.tag === "filtration-configuration",
);

for (const actionId of ["place-practice-buchner", "place-practice-vacuum"]) {
  check(
    `configuration/${actionId}-is-gated`,
    "apparatus may not be placed before the filtration configuration is recorded",
    prerequisiteTags(actionId).has("filtration-configuration"),
  );
}
for (const sample of ["c", "d"]) {
  check(
    `configuration/unknown-${sample}-apparatus-is-gated`,
    "inquiry apparatus may not be placed before the approved materials plan is recorded",
    prerequisiteTags(`unknown-${sample}-place-buchner`).has("materials-plan") &&
      prerequisiteTags(`unknown-${sample}-place-vacuum`).has("materials-plan"),
  );
  check(
    `configuration/unknown-${sample}-execution-needs-approval`,
    "INQ-05 gates execution on recorded teacher approval",
    prerequisiteTags(`unknown-${sample}-measure-aliquot`).has("teacher-approval"),
  );
}

const filtrationChronology = [
  ["seat-practice-filter-paper", "place-practice-buchner"],
  ["attach-practice-filter-flask", "place-practice-buchner"],
  ["wet-practice-filter-paper", "seat-practice-filter-paper"],
  ["filter-practice-mixture", "wet-practice-filter-paper"],
  ["filter-practice-mixture", "attach-practice-filter-flask"],
  ["rinse-practice-beaker", "filter-practice-mixture"],
  ["wash-practice-precipitate", "filter-practice-mixture"],
  ...["c", "d"].flatMap((sample) => [
    [`unknown-${sample}-seat-paper`, `unknown-${sample}-place-buchner`],
    [`unknown-${sample}-attach-flask`, `unknown-${sample}-place-buchner`],
    [`unknown-${sample}-wet-paper`, `unknown-${sample}-seat-paper`],
    [`unknown-${sample}-filter`, `unknown-${sample}-wet-paper`],
    [`unknown-${sample}-filter`, `unknown-${sample}-attach-flask`],
    [`unknown-${sample}-rinse-beaker`, `unknown-${sample}-filter`],
    [`unknown-${sample}-wash-precipitate`, `unknown-${sample}-filter`],
  ]),
];
for (const [actionId, required] of filtrationChronology) {
  check(
    `filtration/${actionId}-after-${required}`,
    `must require ${required}`,
    prerequisiteIds(actionId).has(required),
  );
}

/* ------------------------------------------------------------------ *
 * 7. Balance readability is configured, and every tolerance equals it.
 *
 * Finding 2 (M): the balance is +/-0.001 g or +/-0.0001 g and the choice is the teacher's. A weigh
 * action whose tolerance disagrees with the configured readability would assert a precision the
 * configuration did not choose.
 * ------------------------------------------------------------------ */

const safety = action("review-practice-safety").parameters;
check(
  "precision/readability-is-configured",
  "the safety step must record the configured readability and both source-listed options",
  SOURCE_BALANCE_READABILITY_G.includes(safety.balanceReadabilityG) &&
    Array.isArray(safety.allowedBalanceReadabilityG) &&
    SOURCE_BALANCE_READABILITY_G.every((value) =>
      safety.allowedBalanceReadabilityG.includes(value),
    ) &&
    safety.precisionProvenance === "teacher-configured" &&
    safety.tag === "balance-precision-configuration",
);

const weighActions = [...practiceActions, ...inquiryActions].filter(
  (entry) => entry.verb === "weigh",
);
const mismatchedTolerances = weighActions.filter(
  (entry) => entry.parameters.tolerance !== safety.balanceReadabilityG,
);
check(
  "precision/tolerances-equal-configured-readability",
  `disagreeing: ${mismatchedTolerances.map((entry) => entry.id).join(", ")}`,
  mismatchedTolerances.length === 0,
);
const ungatedWeighs = weighActions.filter(
  (entry) => !prerequisiteTags(entry.id).has("balance-precision-configuration"),
);
// Only the tare and solid-portion reads are gated on the configuration directly; the combined
// weighings are gated on cooling, which is itself downstream of a gated tare.
check(
  "precision/first-reads-are-gated",
  `ungated first reads: ${ungatedWeighs.map((entry) => entry.id).join(", ")}`,
  ungatedWeighs.every((entry) => entry.id.includes("combined")),
);

/* ------------------------------------------------------------------ *
 * 8. Calculation provenance.
 *
 * Every derived quantity must name the recorded evidence it consumes. A calculation carrying a
 * literal `expected` would be an answer key; a calculation naming no operands would be the zero
 * that used to pass silently.
 * ------------------------------------------------------------------ */

const CALCULATION_OPERANDS = {
  "calculate-practice-theoretical": [
    "sodiumCarbonateMassMeasurementId",
    "calciumChlorideMassMeasurementId",
  ],
  "calculate-practice-collected": [
    "combinedMassMeasurementId",
    "watchGlassMassMeasurementId",
    "filterPaperMassMeasurementId",
  ],
  "unknown-c-calculate-precipitate": [
    "combinedMassMeasurementId",
    "watchGlassMassMeasurementId",
    "filterPaperMassMeasurementId",
  ],
  "unknown-d-calculate-precipitate": [
    "combinedMassMeasurementId",
    "watchGlassMassMeasurementId",
    "filterPaperMassMeasurementId",
  ],
  "unknown-c-calculate-hardness": ["sampleVolumeMeasurementId", "precipitateMassCalculationId"],
  "unknown-d-calculate-hardness": ["sampleVolumeMeasurementId", "precipitateMassCalculationId"],
};

for (const [actionId, operands] of Object.entries(CALCULATION_OPERANDS)) {
  const parameters = action(actionId).parameters;
  const missing = operands.filter((key) => typeof parameters[key] !== "string");
  check(
    `calculation/${actionId}-names-its-operands`,
    `missing: ${missing.join(", ")}`,
    missing.length === 0,
  );
  check(
    `calculation/${actionId}-has-no-answer-key`,
    "a derived quantity must not carry a literal expected value",
    parameters.expected === undefined,
  );
}

for (const sample of ["c", "d"]) {
  check(
    `calculation/unknown-${sample}-applies-preconcentration`,
    `finding 10 states a ${SOURCE_PRECONCENTRATION_FACTOR}x preconcentration; the corrupted ppm text is not a formula`,
    action(`unknown-${sample}-calculate-hardness`).parameters.preconcentrationFactor ===
      SOURCE_PRECONCENTRATION_FACTOR,
  );
}

/* ------------------------------------------------------------------ *
 * 9. Analysis stays analysis.
 *
 * Class pooling, ranking, defence, and the client letter are evidence tasks. Turning any of them
 * into an equipment interaction would be decoration, which is the failure the cycle's acceptance
 * criteria name explicitly.
 * ------------------------------------------------------------------ */

const ANALYSIS_ACTIONS = [
  "post-two-local-results",
  "load-configured-peer-results",
  "rank-six-samples",
  "defend-inquiry-technique",
  "analyze-remaining-ions",
  "draft-client-letter",
  "compare-practice-yield",
  "explain-wet-unwashed-bias",
];
for (const actionId of ANALYSIS_ACTIONS) {
  const entry = action(actionId);
  check(
    `analysis/${actionId}-stays-evidence`,
    `verb=${entry.verb} interaction=${entry.interaction?.type}`,
    entry.verb === "observe" && entry.interaction?.type === "recordNotebook",
  );
}

/* ------------------------------------------------------------------ *
 * 10. Unresolved source points stay unresolved.
 * ------------------------------------------------------------------ */

const qualityChoices = action("define-inquiry-quality-choices").parameters.note;
check(
  "unresolved/constant-mass-is-not-invented",
  "confirmation point 3 leaves constant-mass repetitions to the instructor",
  /instructor decision|instructor/i.test(qualityChoices) && /constant-mass/i.test(qualityChoices),
);

const rerun = action("evaluate-extra-carbonate-branch").parameters.note;
check(
  "unresolved/optional-rerun-stays-optional",
  "Practice Question 2 is a branch, not a mandatory second trial",
  /optional/i.test(rerun),
);

const configuredNodes = new Map(
  lab.process.nodes.map((node) => [node.actionId, node.config ?? {}]),
);
for (const actionId of [
  "review-practice-safety",
  "select-filtration-configuration",
  "set-practice-oven",
  "define-carbonate-excess-plan",
  "define-inquiry-quality-choices",
  "select-inquiry-apparatus",
]) {
  check(
    `unresolved/${actionId}-node-declares-configuration`,
    "the lab node must declare the choice as teacher-configurable",
    configuredNodes.get(actionId)?.teacherConfigurable === true &&
      typeof configuredNodes.get(actionId)?.requiredConfiguration === "string",
  );
}
check(
  "unresolved/approval-node-declares-approval",
  "INQ-05's node must declare that approval is required",
  configuredNodes.get("approve-inquiry-procedure")?.approvalRequired === true,
);

/* ------------------------------------------------------------------ *
 * 11. Material conservation across the collection path.
 *
 * The mass the balance eventually reports must be the mass the precipitation produced. Each stage
 * must name the instance it moves solid from and to, so nothing is created between the beaker and
 * the watch glass.
 * ------------------------------------------------------------------ */

const conservationChains = [
  {
    label: "practice",
    precipitate: "establish-practice-precipitate-state",
    filter: "filter-practice-mixture",
    transfer: "transfer-practice-paper-to-watch",
    firstDry: "first-practice-drying",
    secondDry: "second-practice-drying",
    combinedWeigh: "weigh-practice-combined",
    paperTare: "weigh-practice-filter-paper",
    watchTare: "weigh-practice-watch-glass",
  },
  ...["c", "d"].map((sample) => ({
    label: `sample-${sample}`,
    precipitate: `unknown-${sample}-precipitate`,
    filter: `unknown-${sample}-filter`,
    transfer: `unknown-${sample}-transfer-paper`,
    firstDry: `unknown-${sample}-first-dry`,
    secondDry: `unknown-${sample}-second-dry`,
    combinedWeigh: `unknown-${sample}-weigh-combined`,
    paperTare: `unknown-${sample}-weigh-paper`,
    watchTare: `unknown-${sample}-weigh-watch`,
  })),
];

for (const chain of conservationChains) {
  const precipitateMassG = action(chain.precipitate).parameters.precipitateMassG;
  const dryMassG = action(chain.secondDry).parameters.dryMassG;
  check(
    `conservation/${chain.label}-dry-mass-matches-precipitate`,
    `precipitate ${precipitateMassG} g vs final dry ${dryMassG} g`,
    precipitateMassG === dryMassG,
  );
  check(
    `conservation/${chain.label}-first-stage-is-heavier`,
    "a damp stage must weigh more than the dried one, or the drying removed nothing",
    action(chain.firstDry).parameters.dryMassG > dryMassG,
  );
  const combined = action(chain.combinedWeigh).parameters.expectedMassG;
  const tares =
    action(chain.paperTare).parameters.expectedMassG +
    action(chain.watchTare).parameters.expectedMassG;
  check(
    `conservation/${chain.label}-combined-mass-is-consistent`,
    `combined ${combined} g minus tares ${tares.toFixed(5)} g should equal ${dryMassG} g`,
    Math.abs(combined - tares - dryMassG) < 1e-6,
  );
  const transfer = action(chain.transfer).parameters;
  check(
    `conservation/${chain.label}-transfer-names-both-instances`,
    "the transfer to the drying vessel must name the medium and the vessel it moves to",
    typeof transfer.equipmentInstanceId === "string" &&
      typeof transfer.targetInstanceId === "string" &&
      transfer.equipmentInstanceId !== transfer.targetInstanceId,
  );
  const filter = action(chain.filter).parameters;
  check(
    `conservation/${chain.label}-filter-names-source-and-funnel`,
    "the filtration must name the vessel it empties and the funnel it fills",
    typeof filter.sourceInstanceId === "string" &&
      typeof filter.targetInstanceId === "string" &&
      filter.sourceInstanceId !== filter.targetInstanceId,
  );
}

/* ------------------------------------------------------------------ *
 * Report.
 * ------------------------------------------------------------------ */

const result = {
  checks: checks.length,
  passed: checks.filter((entry) => entry.passed).length,
  failed: failures.length,
  failures,
};

if (argv.has("--json")) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`cycle 08 gravimetry: ${result.passed}/${result.checks} checks passed`);
  for (const failure of failures) console.log(`  FAIL ${failure}`);
}

process.exit(failures.length === 0 ? 0 : 1);
