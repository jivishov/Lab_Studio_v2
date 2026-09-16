import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const lab = JSON.parse(readFileSync(join(root, "public/labs/brass-colorimetry.json"), "utf8"));
const actions = new Map(lab.actions.map((action) => [action.id, action]));
let checks = 0;
let failures = 0;
const check = (condition, message) => {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.error(`FAIL ${message}`);
  }
};
const action = (id) => actions.get(id);
const params = (id) => action(id)?.parameters ?? {};

for (const id of [
  "teacher-wavelength-approval-action",
  "teacher-add-acid-action",
  "teacher-cover-digest-action",
  "teacher-add-water-action",
  "teacher-standard-approval-action",
  "teacher-disposal-gate-action",
]) {
  check(params(id).configurationRequired === true, `${id} declares a teacher configuration gate`);
  check(params(id).unlocked === false, `${id} starts locked`);
  check(params(id).inputRole === "teacherConfiguration", `${id} consumes session-only teacher approval`);
}

for (const id of [
  "record-0p0250-absorbance-action",
  "record-0p0500-absorbance-action",
  "record-0p100-absorbance-action",
  "record-0p200-absorbance-action",
  "record-0p400-absorbance-action",
  "record-unknown-absorbance-action",
]) {
  check(params(id).value === undefined, `${id} carries no fabricated reading`);
  check(params(id).inputMode === "numeric", `${id} has a reachable numeric classroom input`);
  check(params(id).inputRole === "teacherConfiguration", `${id} distinguishes configured run data`);
}

const calculationTemplates = {
  "minimum-hno3-volume-ml-action": "nitricAcidVolumeFromBrassMass",
  "standard-0p200-aliquot-ml-action": "dilutionAliquotVolume",
  "standard-0p100-aliquot-ml-action": "dilutionAliquotVolume",
  "standard-0p0500-aliquot-ml-action": "dilutionAliquotVolume",
  "standard-0p0250-aliquot-ml-action": "dilutionAliquotVolume",
  "calibration-table-check-action": "measurementCount",
  "calibration-slope-action": "linearRegressionMeasurements",
  "calibration-intercept-action": "regressionComponent",
  "calibration-r-squared-action": "regressionComponent",
  "spectrometric-unknown-molarity-action": "concentrationFromRegression",
  "spectrometric-copper-mass-g-action": "massFromConcentration",
  "spectrometric-copper-percent-action": "massPercentFromCalculation",
  "visual-unknown-molarity-action": "visualComparisonConcentration",
  "visual-copper-percent-action": "massPercentFromConcentration",
  "method-percent-difference-action": "percentDifferenceCalculations",
};
for (const [id, template] of Object.entries(calculationTemplates)) {
  check(params(id).template === template, `${id} uses ${template}`);
  check(params(id).expected === undefined, `${id} does not use an authored answer as its result`);
}

for (let iteration = 1; iteration <= 4; iteration += 1) {
  for (const prefix of ["rinse-beaker", "transfer-rinse"]) {
    const id = `${prefix}-${iteration}-action`;
    check(params(id).repeatGroupId === "quantitative-transfer-rinses", `${id} belongs to the rinse repeat`);
    check(params(id).repeatIteration === iteration, `${id} preserves rinse iteration ${iteration}`);
    check(params(id).repeatCount === 4, `${id} preserves the source's four-rinse implementation`);
  }
  check(params(`transfer-rinse-${iteration}-action`).repeatIterationComplete === true, `rinse ${iteration} closes on transfer`);
}

for (const id of ["record-unknown-depth-action", "record-standard-depth-action"]) {
  check(params(id).value === undefined, `${id} does not turn the comparison image into a stored measurement`);
  check(params(id).inputRole === "studentResponse", `${id} records the student's ruler reading`);
}

check(params("record-waste-ph-action").inputMin === 5, "waste pH lower limit is 5");
check(params("record-waste-ph-action").inputMax === 9, "waste pH upper limit is 9");
const disposalPrerequisites = action("teacher-disposal-gate-action")?.prerequisites ?? [];
check(disposalPrerequisites.some((rule) => rule.notebookTag === "waste-neutralization"), "disposal requires bubbling cessation evidence");
check(disposalPrerequisites.some((rule) => rule.measurementId === "neutralized-waste-ph"), "disposal requires the recorded pH");

console.log(`Cycle 07 brass checks: ${checks - failures}/${checks} passed`);
if (failures > 0) process.exitCode = 1;
