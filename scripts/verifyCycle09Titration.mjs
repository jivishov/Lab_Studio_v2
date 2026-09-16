/**
 * Cycle 09 titration verifier.
 *
 * `scripts/checkContentConsistency.mjs` answers "does this content declare the right things?".
 * This script answers a question no static rule can: "can a student actually finish these runs, and
 * does every number they end up with come from evidence they produced?".
 *
 * It re-derives the drop plan, the burette level history, and every calculation result from the
 * authored titration models — independently of `src/domain/titrationModels.ts` and
 * `src/runtime/calculations.ts`, which it deliberately does not import. It verifies that result
 * actions derive from those trial calculations and require the student's own submitted value; it
 * does not require an answer-key value in content.
 *
 * It also enforces the invariants the cycle's acceptance criteria turn on: dispensing is gated on an
 * instrument-derived initial reading, evidence identities are per-trial, material is conserved
 * through the fill/deliver/discard loop, and no vessel overflows.
 *
 * Usage:
 *   node scripts/verifyCycle09Titration.mjs
 *   node scripts/verifyCycle09Titration.mjs --json
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = new Set(process.argv.slice(2));
const readJson = (relativePath) => JSON.parse(readFileSync(join(root, relativePath), "utf8"));

const failures = [];
const checks = [];
const check = (name, ok, detail = "") => {
  checks.push({ name, ok, detail });
  if (!ok) failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
};

const CATALOG_CAPACITY_ML = {
  "burette-50ml": 50,
  "erlenmeyer-flask-250ml": 250,
  "beaker-250ml": 250,
  "graduated-cylinder": 100,
  "graduated-pipette-10ml": 10,
  "waste-beaker": 250,
  "reagent-bottle": 250,
  "sample-bottle": 125,
  "naoh-bottle": 500,
  "unknown-acid-bottle": 500,
};

const HYDROGEN_PEROXIDE_MOLAR_MASS_G_MOL = 34.0147;
const WHOLE_DROP_EPSILON = 1e-9;

/** Independent re-derivation of the drop plan. Mirrors the published algorithm, not the module. */
const derivePlan = (model) => {
  const ratio = model.stoichiometricRatio ?? { analyte: 1, titrant: 1 };
  const dropVolumeMl = model.dropVolumeMl ?? 0.05;
  const equivalenceMl =
    (model.analyteMolarityM * model.analyteVolumeMl * ratio.titrant) /
    (model.titrantMolarityM * ratio.analyte);
  const equivalenceDrops = Math.max(1, Math.ceil(equivalenceMl / dropVolumeMl - WHOLE_DROP_EPSILON));
  const endpointDrops = equivalenceDrops + (model.endpointOffsetDrops ?? 0);
  return {
    ratio,
    dropVolumeMl,
    equivalenceMl,
    endpointDrops,
    deliveredMl: Number((endpointDrops * dropVolumeMl).toFixed(10)),
    maxExtraDrops: model.maxExtraDrops ?? 5,
  };
};

const within = (value, expected, tolerance) => Math.abs(value - expected) <= tolerance + 1e-12;

/* ------------------------------------------------------------------ *
 * 1. Every titration model is derivable and its endpoint fits the burette.
 * ------------------------------------------------------------------ */

const owners = [
  ["lab", "hydrogen-peroxide-redox-titration", readJson("public/labs/hydrogen-peroxide-redox-titration.json")],
  ["lab", "beverage-acidity", readJson("public/labs/beverage-acidity.json")],
  ["lab", "acid-base-titration", readJson("public/labs/acid-base-titration.json")],
  ["technique", "titration-endpoint", readJson("public/techniques/titration-endpoint.json")],
  ["technique", "redox-titration", readJson("public/techniques/redox-titration.json")],
  ["technique", "titration-curve-analysis", readJson("public/techniques/titration-curve-analysis.json")],
  ["technique", "beverage-ph-volume-titration", readJson("public/techniques/beverage-ph-volume-titration.json")],
];

for (const [ownerType, ownerId, definition] of owners) {
  for (const model of definition.titrationModels ?? []) {
    const where = `${ownerType}:${ownerId}/${model.id}`;
    const plan = derivePlan(model);
    check(
      `${where} endpoint fits the burette`,
      plan.deliveredMl + plan.maxExtraDrops * plan.dropVolumeMl <= CATALOG_CAPACITY_ML["burette-50ml"],
      `${plan.deliveredMl} mL endpoint plus ${plan.maxExtraDrops} extra drops`,
    );
    check(
      `${where} declares a redox mass basis only when it reports one`,
      model.type === "redox" ||
        (model.analyteMolarMassGPerMol === undefined && model.sampleDensityGPerMl === undefined),
      `type=${model.type}`,
    );
  }
}

/* ------------------------------------------------------------------ *
 * 2. Investigation 8: replay all eight trials.
 * ------------------------------------------------------------------ */

const redox = owners.find(([, id]) => id === "hydrogen-peroxide-redox-titration")[2];
const redoxModels = new Map((redox.titrationModels ?? []).map((model) => [model.id, model]));
const redoxActions = new Map(redox.actions.map((action) => [action.id, action]));
const redoxOrder = redox.actions.map((action) => action.id);

const dispenses = redox.actions.filter((action) => action.interaction?.type === "dispenseDrops");
check("Investigation 8 keeps every trial physical", dispenses.length === 8, `${dispenses.length} dispense actions`);

const buretteInstance = redox.initialState.equipment.find((i) => i.definitionId === "burette-50ml");
check(
  "Investigation 8 burette starts empty",
  buretteInstance?.contents.kind === "empty",
  `kind=${buretteInstance?.contents.kind}`,
);
const flaskInstance = redox.initialState.equipment.find((i) => i.definitionId === "erlenmeyer-flask-250ml");
check(
  "Investigation 8 receiver starts empty",
  flaskInstance?.contents.kind === "empty",
  `kind=${flaskInstance?.contents.kind}`,
);
const titrantStock = redox.initialState.equipment.find((i) => i.id === "permanganate-stock-1");
check("Investigation 8 supplies a titrant stock to fill from", Boolean(titrantStock));

let buretteMl = 0;
let flaskMl = 0;
let wasteMl = 0;
let stockMl = titrantStock?.contents.volumeMl ?? 0;
const standardizationResults = [];
const sampleResults = { "sample-a": [], "sample-b": [] };
const evidenceOwners = new Map();
const claimEvidence = (id, trialKey) => {
  if (evidenceOwners.has(id) && evidenceOwners.get(id) !== trialKey) {
    check(`evidence id ${id} belongs to one trial`, false, `${evidenceOwners.get(id)} and ${trialKey}`);
    return;
  }
  evidenceOwners.set(id, trialKey);
};

for (const dispense of dispenses) {
  const trialKey = dispense.id.replace(/^dispense-/, "").replace(/-permanganate$/, "");
  const model = redoxModels.get(dispense.parameters.titrationModelId);
  check(`${trialKey} names a titration model that exists`, Boolean(model), dispense.parameters.titrationModelId);
  if (!model) continue;
  const plan = derivePlan(model);

  const fill = redoxActions.get(`fill-${trialKey}-burette`);
  if (fill) {
    stockMl -= fill.parameters.volumeMl;
    buretteMl += fill.parameters.volumeMl;
    check(
      `${trialKey} fill does not overflow the burette`,
      buretteMl <= CATALOG_CAPACITY_ML["burette-50ml"] + 1e-9,
      `${buretteMl.toFixed(2)} mL`,
    );
  }
  const headroom = plan.deliveredMl + plan.maxExtraDrops * plan.dropVolumeMl;
  check(
    `${trialKey} burette holds enough titrant for its endpoint plus the permitted overshoot`,
    buretteMl >= headroom - 1e-9,
    `${buretteMl.toFixed(2)} mL available, ${headroom.toFixed(2)} mL needed`,
  );

  const initialReadingMl = Number((CATALOG_CAPACITY_ML["burette-50ml"] - buretteMl).toFixed(2));
  const finalReadingMl = Number((initialReadingMl + plan.deliveredMl).toFixed(4));

  // The reading has to come from an instrument-read action, not from a constant.
  const read = redoxActions.get(`read-${trialKey}-initial-burette`);
  check(`${trialKey} reads the burette before dispensing`, Boolean(read), "no read action");
  check(
    `${trialKey} read is an instrument read`,
    read?.interaction?.type === "readInstrument" && read?.verb === "measureVolume",
    `${read?.verb}/${read?.interaction?.type}`,
  );
  const initialId = dispense.parameters.initialBuretteMeasurementId;
  check(
    `${trialKey} dispense counts from the reading it took`,
    read?.parameters.measurementId === initialId,
    `${read?.parameters.measurementId} vs ${initialId}`,
  );
  claimEvidence(initialId, trialKey);
  claimEvidence(dispense.parameters.finalBuretteMeasurementId, trialKey);

  // Analyte and acid go in before any titrant does.
  const measure = redoxActions.get(`measure-${trialKey}-aliquot`);
  const acidify = redoxActions.get(`acidify-${trialKey}-analyte`);
  check(`${trialKey} measures a fresh aliquot`, Boolean(measure));
  check(`${trialKey} acidifies the analyte`, Boolean(acidify));
  check(
    `${trialKey} acidifies before it titrates`,
    redoxOrder.indexOf(acidify?.id) < redoxOrder.indexOf(dispense.id),
  );
  claimEvidence(measure?.parameters.measurementId, trialKey);

  flaskMl += (measure?.parameters.volumeMl ?? 0) + (acidify?.parameters.volumeMl ?? 0);
  flaskMl += plan.deliveredMl;
  buretteMl = Number((buretteMl - plan.deliveredMl).toFixed(6));
  check(
    `${trialKey} receiver does not overflow`,
    flaskMl <= CATALOG_CAPACITY_ML["erlenmeyer-flask-250ml"],
    `${flaskMl.toFixed(2)} mL`,
  );

  // The endpoint observation is scoped to this dispense.
  const observe = redoxActions.get(`observe-${trialKey}-endpoint`);
  check(`${trialKey} records its own endpoint colour`, Boolean(observe));
  check(
    `${trialKey} endpoint observation is scoped to its own dispense`,
    observe?.parameters.dispenseActionId === dispense.id,
    `${observe?.parameters.dispenseActionId}`,
  );
  claimEvidence(observe?.parameters.tag, trialKey);

  // The trial's own calculation, replayed.
  const calculate = redoxActions.get(`calculate-${trialKey}`);
  check(`${trialKey} calculates its own result`, Boolean(calculate));
  if (calculate) {
    const deliveredMl = finalReadingMl - initialReadingMl;
    if (calculate.parameters.template === "permanganateMolarityFromIron") {
      const value = Number(
        (
          (model.analyteMolarityM * model.analyteVolumeMl * plan.ratio.titrant) /
          (deliveredMl * plan.ratio.analyte)
        ).toFixed(6),
      );
      const expected = model.titrantMolarityM;
      check(
        `${trialKey} standardization result closes against the model`,
        within(value, expected, calculate.parameters.tolerance),
        `computed ${value}, expected ${expected}, tolerance ${calculate.parameters.tolerance}`,
      );
      if (trialKey.startsWith("standardization-")) standardizationResults.push(value);
    } else if (calculate.parameters.template === "hydrogenPeroxidePercent") {
      const standardized = standardizationResults.length
        ? Number(
            (standardizationResults.reduce((total, value) => total + value, 0) /
              standardizationResults.length).toFixed(6),
          )
        : Number.NaN;
      check(
        `${trialKey} analysis runs only after standardization is accepted`,
        Number.isFinite(standardized),
        "no standardization result available",
      );
      const titrantMoles = (standardized * deliveredMl) / 1000;
      const analyteMoles = (titrantMoles * plan.ratio.analyte) / plan.ratio.titrant;
      const massG = analyteMoles * (model.analyteMolarMassGPerMol ?? HYDROGEN_PEROXIDE_MOLAR_MASS_G_MOL);
      const sampleMassG = model.analyteVolumeMl * (model.sampleDensityGPerMl ?? 1);
      const value = Number(((massG / sampleMassG) * 100).toFixed(4));
      const expectedMolarity =
        (model.titrantMolarityM * plan.deliveredMl * plan.ratio.analyte) /
        (model.analyteVolumeMl * plan.ratio.titrant);
      const expected = Number(
        (
          ((expectedMolarity * model.analyteVolumeMl * (model.analyteMolarMassGPerMol ?? 0)) /
            1000 /
            sampleMassG) *
          100
        ).toFixed(4),
      );
      check(
        `${trialKey} percent-by-mass result closes against the model`,
        within(value, expected, calculate.parameters.tolerance),
        `computed ${value}, expected ${expected}, tolerance ${calculate.parameters.tolerance}`,
      );
      const family = trialKey.startsWith("sample-a") ? "sample-a" : "sample-b";
      sampleResults[family].push(value);
    }
  }

  const discard = redoxActions.get(`discard-${trialKey}-mixture`);
  check(`${trialKey} discards its mixture before the next trial`, Boolean(discard));
  wasteMl += flaskMl;
  flaskMl = 0;
}

check(
  "Investigation 8 waste receiver does not overflow",
  wasteMl <= CATALOG_CAPACITY_ML["waste-beaker"],
  `${wasteMl.toFixed(2)} mL`,
);
check(
  "Investigation 8 titrant stock is sufficient",
  stockMl >= 0,
  `${stockMl.toFixed(2)} mL remaining`,
);

const acceptance = redoxActions.get("accept-standardized-kmno4");
if (acceptance) {
  const mean = Number(
    (standardizationResults.reduce((total, value) => total + value, 0) / standardizationResults.length).toFixed(6),
  );
  const range = Math.max(...standardizationResults) - Math.min(...standardizationResults);
  check(
    "standardization replicates fall inside the configured acceptable range",
    range <= acceptance.parameters.maximumRangeM + 1e-12,
    `range ${range}, allowed ${acceptance.parameters.maximumRangeM}`,
  );
  check(
    "standardized mean is derived from the three trial calculations",
    acceptance.parameters.template === "meanOfCalculations" &&
      acceptance.parameters.calculationIds?.length === standardizationResults.length &&
      Number.isFinite(mean),
    `mean ${mean}, sources ${acceptance.parameters.calculationIds?.length}`,
  );
  check(
    "standardized mean requires the student's submitted value and carries no authored answer",
    acceptance.parameters.requireStudentValue === true && acceptance.parameters.expected === undefined,
  );
  check(
    "standardization is accepted before the first sample trial",
    redoxOrder.indexOf("accept-standardized-kmno4") < redoxOrder.indexOf("calculate-sample-a-1"),
  );
}

// Two gates the source states outright. Both were enforced by process order and by the reducer's
// own operand guards; the self-review made them declarative so they hold on any input path.
for (const key of ["standardization-1", "standardization-2", "standardization-3"]) {
  const action = redoxActions.get(`measure-${key}-aliquot`);
  check(
    `${key} cannot begin before the teacher approval is recorded (PB-02, M)`,
    (action?.prerequisites ?? []).some(
      (rule) => rule.type === "notebookEntry" && rule.notebookTag === "teacher-approval",
    ),
  );
}
for (const key of ["sample-a-1", "sample-a-2", "sample-b-1", "sample-b-2"]) {
  const action = redoxActions.get(`measure-${key}-aliquot`);
  check(
    `${key} cannot begin before the standardization is accepted (finding 4, M)`,
    (action?.prerequisites ?? []).some(
      (rule) =>
        rule.type === "calculationWithinTolerance" &&
        rule.calculationId === "standardized-kmno4-molarity",
    ),
  );
}

for (const [family, results] of Object.entries(sampleResults)) {
  const average = redoxActions.get(`average-${family}`);
  if (!average || results.length === 0) continue;
  const mean = Number((results.reduce((total, value) => total + value, 0) / results.length).toFixed(6));
  check(
    `${family} mean is derived from its replicate calculations`,
    average.parameters.template === "meanOfCalculations" &&
      average.parameters.calculationIds?.length === results.length &&
      Number.isFinite(mean),
    `mean ${mean}, sources ${average.parameters.calculationIds?.length}`,
  );
  check(
    `${family} keeps the label claim teacher-configured and carries no authored answer`,
    average.parameters.labelClaimPercent === "teacher-configured" &&
      average.parameters.requireStudentValue === true &&
      average.parameters.expected === undefined,
  );
}

for (const dispense of dispenses) {
  check(
    `${dispense.id} consumes one session-scoped teacher increment instead of exposing a target count`,
    dispense.parameters.inputRole === "teacherConfiguration" &&
      dispense.parameters.inputKey === "redox-calibrated-increment-volume-ml" &&
      dispense.parameters.configurationParameter === "dropVolumeMl" &&
      dispense.parameters.inputMinExclusive === true,
  );
  check(
    `${dispense.id} keeps endpoint persistence teacher-configured`,
    dispense.parameters.endpointPersistenceSeconds === "teacher-configured" &&
      dispense.parameters.endpointPersistenceIsTeacherConfigured === true,
  );
}

for (const id of ["record-teacher-approval", "record-configured-disposal"]) {
  const action = redoxActions.get(id);
  check(
    `${id} is a real session-only teacher gate`,
    action?.parameters.configurationRequired === true &&
      action?.parameters.unlocked === false &&
      action?.parameters.inputRole === "teacherConfiguration" &&
      action?.parameters.inputMode === "choice",
  );
}

const sidebarSource = readFileSync(join(root, "src/player/ProcessSidebar.tsx"), "utf8");
check(
  "the Student Player does not reveal the authored endpoint increment count",
  !sidebarSource.includes("/ {endpointDropCount}") && !sidebarSource.includes("titration-drop-meter"),
);
check(
  "the shared titration control uses chemistry-neutral incremental wording",
  sidebarSource.includes("Dispense one increment") && !sidebarSource.includes("NaOH endpoint"),
);

const beverageLab = owners.find(([, id]) => id === "beverage-acidity")[2];
const beverageTechnique = owners.find(([, id]) => id === "beverage-ph-volume-titration")[2];
const beverageLabActions = new Map(beverageLab.actions.map((action) => [action.id, action]));
const beverageTechniqueActions = new Map(beverageTechnique.actions.map((action) => [action.id, action]));
for (const [actions, id] of [
  [beverageLabActions, "record-teacher-approval"],
  [beverageTechniqueActions, "record-approved-run-configuration"],
]) {
  const action = actions.get(id);
  check(
    `${id} consumes the approved beverage configuration before unlocking`,
    action?.parameters.configurationRequired === true &&
      action?.parameters.unlocked === false &&
      action?.parameters.inputRole === "teacherConfiguration" &&
      action?.parameters.inputMode === "text",
  );
}
for (const id of [
  "practice-hcl-drop-count",
  "practice-acetic-drop-count",
  "submit-research-question-hypothesis",
  "record-beverage-a-run",
  "record-beverage-b-run",
  "analyze-beverage-a",
  "analyze-beverage-b",
]) {
  const action = beverageLabActions.get(id);
  check(
    `beverage lab ${id} requires student-produced evidence`,
    action?.parameters.inputRole === "studentResponse" &&
      action?.parameters.inputRequired === true,
  );
}
const beverageProbe = beverageLabActions.get("place-beverage-ph-probe");
check(
  "beverage acidity preserves the source-stated Erlenmeyer receiver",
  beverageProbe?.equipmentRoleBindings?.["immersed-probe-vessel"] === "erlenmeyer-flask-250ml",
);
const curveTechnique = owners.find(([, id]) => id === "titration-curve-analysis")[2];
const curveProbe = curveTechnique.actions.find((action) => action.id === "place-curve-ph-probe");
check(
  "titration-curve analysis retains the documented beaker receiver exception",
  curveProbe?.equipmentRoleBindings?.["immersed-probe-vessel"] === "beaker-250ml",
);

/* ------------------------------------------------------------------ *
 * 3. The adopted acid-base technique and the lab that imports it.
 * ------------------------------------------------------------------ */

const endpointTechnique = owners.find(([, id]) => id === "titration-endpoint")[2];
const acidBaseLab = owners.find(([, id]) => id === "acid-base-titration")[2];

const ref = (acidBaseLab.techniqueRefs ?? []).find((entry) => entry.techniqueId === "titration-endpoint");
check("acid-base-titration imports the technique it used to duplicate", Boolean(ref));
check(
  "the import is version-pinned to the technique on disk",
  ref?.version === endpointTechnique.metadata.version,
  `${ref?.version} vs ${endpointTechnique.metadata.version}`,
);
const importedIds = new Set(
  ref?.actionIds === "all" ? endpointTechnique.actions.map((action) => action.id) : (ref?.actionIds ?? []),
);
const localIds = new Set(acidBaseLab.actions.map((action) => action.id));
for (const id of importedIds) {
  check(`imported action ${id} is not also declared locally`, !localIds.has(id));
}
const referenced = new Set(acidBaseLab.process.nodes.map((node) => node.actionId).filter(Boolean));
for (const id of importedIds) {
  check(`imported action ${id} is referenced by a node`, referenced.has(id));
}
for (const id of referenced) {
  check(`node action ${id} resolves`, importedIds.has(id) || localIds.has(id));
}

check(
  "the lab owns the titration model its imported actions name",
  (acidBaseLab.titrationModels ?? []).some((model) => model.id === "unknown-acid-naoh"),
);
check(
  "the lab now carries its own starting bench",
  (acidBaseLab.initialState?.equipment ?? []).length === 10,
  `${acidBaseLab.initialState?.equipment?.length} instances`,
);
const embed = (acidBaseLab.techniques ?? []).find((t) => t.id === "acid-base-titration-state");
check("the embedded starting-state technique is preserved", Boolean(embed));
check(
  "every instance the embed supplied survives on the lab",
  (embed?.initialState.equipment ?? []).every((instance) =>
    (acidBaseLab.initialState?.equipment ?? []).some((migrated) => migrated.id === instance.id),
  ),
);

const abModel = (acidBaseLab.titrationModels ?? [])[0];
if (abModel) {
  const plan = derivePlan(abModel);
  const fillAction = endpointTechnique.actions.find((action) => action.id === "fill-burette");
  const initialReadingMl = CATALOG_CAPACITY_ML["burette-50ml"] - fillAction.parameters.volumeMl;
  check(
    "the acid-base run has enough titrant in the burette for its endpoint",
    fillAction.parameters.volumeMl >= plan.deliveredMl + plan.maxExtraDrops * plan.dropVolumeMl,
    `${fillAction.parameters.volumeMl} mL filled, ${plan.deliveredMl} mL needed`,
  );
  const calculate = endpointTechnique.actions.find((action) => action.id === "calculate-acid-molarity");
  const value = Number(
    (
      (abModel.titrantMolarityM * plan.deliveredMl * plan.ratio.analyte) /
      (abModel.analyteVolumeMl * plan.ratio.titrant)
    ).toFixed(4),
  );
  check(
    "the acid-base molarity result closes against the model",
    within(value, abModel.analyteMolarityM, calculate.parameters.tolerance),
    `computed ${value} from an initial reading of ${initialReadingMl} mL, expected ${abModel.analyteMolarityM}`,
  );
}

/* ------------------------------------------------------------------ *
 * 4. Every dispense the corpus publishes must be reachable.
 *
 * Cycle 09 added three gates to `executeDropDispense` — clamped burette, charged receiver, recorded
 * initial reading — and a gate in a shared handler is a new obligation on every owner that reaches
 * it. The cycle's own self-review found it had made `redox-titration` and `titration-curve-analysis`
 * unfinishable this way: both dispense titrant and neither had a burette-mount action at all. This
 * block walks the same three conditions the reducer walks, per owner, so the omission cannot recur
 * silently in a later cycle that adds a titration flow.
 * ------------------------------------------------------------------ */

const CHARGING_ATOMS = new Set([
  "atom.transfer.measured-liquid",
  "atom.transfer.acidify-analyte",
  "atom.transfer.add-indicator",
]);

for (const [ownerType, ownerId, definition] of owners) {
  const actions = definition.actions ?? [];
  const dispensesHere = actions.filter((action) => action.interaction?.type === "dispenseDrops");
  if (dispensesHere.length === 0) continue;
  const where = `${ownerType}:${ownerId}`;
  const order = actions.map((action) => action.id);
  const mounts = actions.filter((action) => action.atomId === "atom.place.mount-burette");
  const charges = actions.filter((action) => CHARGING_ATOMS.has(action.atomId));
  const reads = actions.filter((action) => action.atomId === "atom.measure.read-burette");

  check(`${where} publishes a burette mount its dispenses can satisfy`, mounts.length > 0);
  check(`${where} publishes an action that charges the receiver`, charges.length > 0);
  check(`${where} publishes a burette read`, reads.length > 0);
  for (const read of reads) {
    check(
      `${where}/${read.id} declares which way its scale runs`,
      read.parameters?.scaleReadsDownward === true,
      "a burette reads downward; the runtime defaults to the upward reading",
    );
  }

  for (const dispense of dispensesHere) {
    const scope = `${where}/${dispense.id}`;
    // The mount and the charge must both come earlier in the published order, which is the order the
    // process walks; a gate satisfied only after the dispense is not satisfied.
    const earliestMount = Math.min(...mounts.map((action) => order.indexOf(action.id)));
    const earliestCharge = Math.min(...charges.map((action) => order.indexOf(action.id)));
    check(`${scope} is preceded by a burette mount`, earliestMount < order.indexOf(dispense.id));
    check(`${scope} is preceded by a charging step`, earliestCharge < order.indexOf(dispense.id));
    const declared = new Set();
    const walk = (actionId) => {
      if (declared.has(actionId)) return;
      declared.add(actionId);
      const action = actions.find((candidate) => candidate.id === actionId);
      for (const rule of action?.prerequisites ?? []) {
        if (rule.type === "actionEvidence" && rule.actionId) walk(rule.actionId);
      }
    };
    walk(dispense.id);
    const reachable = [...declared].map((id) => actions.find((a) => a.id === id)).filter(Boolean);
    check(
      `${scope} declares the mount as a prerequisite, not only as process order`,
      reachable.some((action) => action.atomId === "atom.place.mount-burette"),
    );
    check(
      `${scope} declares the charged receiver as a prerequisite`,
      reachable.some((action) => CHARGING_ATOMS.has(action.atomId)),
    );
    const initialId = dispense.parameters?.initialBuretteMeasurementId ?? "burette-initial-volume";
    check(
      `${scope} declares its initial reading as a prerequisite`,
      (dispense.prerequisites ?? []).some(
        (rule) => rule.type === "measurementRecorded" && rule.measurementId === initialId,
      ),
    );
  }
}

/* ------------------------------------------------------------------ *
 * 5. Corpus-wide: no titration flow may reintroduce an authored reading.
 * ------------------------------------------------------------------ */

for (const [ownerType, ownerId, definition] of owners) {
  for (const action of definition.actions ?? []) {
    if (action.verb !== "record") continue;
    const id = String(action.parameters?.measurementId ?? "");
    if (!/burette|equivalence|initial-ph/.test(id)) continue;
    check(
      `${ownerType}:${ownerId}/${action.id} does not author the value it asks the student to read`,
      action.parameters.value === undefined,
      `${id}=${action.parameters.value}`,
    );
  }
}

/* ------------------------------------------------------------------ *
 * Report.
 * ------------------------------------------------------------------ */

if (argv.has("--json")) {
  console.log(JSON.stringify({ total: checks.length, failures }, null, 2));
} else {
  console.log(`cycle 09 titration invariants: ${checks.length - failures.length}/${checks.length} passed`);
  for (const failure of failures) console.log(`  FAIL ${failure}`);
}
process.exit(failures.length === 0 ? 0 : 1);
