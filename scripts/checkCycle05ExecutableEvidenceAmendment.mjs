import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { COMPOSITION_COMPILER_CONTRACT_VERSION } from "../src/data/compileLabComposition.ts";
import { validateCompositionManifest } from "../src/domain/compositionValidation.ts";
import { validateActionDefinition } from "../src/domain/validation.ts";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

const action = (verb, extra = {}) => ({
  id: `fixture-${verb}`,
  verb,
  label: `Fixture ${verb}`,
  parameters: verb === "transfer" || verb === "measureVolume" || verb === "dilute"
    ? { sourceDefinitionId: "wash-bottle", targetDefinitionId: "graduated-cylinder" }
    : {},
  prerequisites: [],
  stateChanges: [],
  invalidCases: [],
  feedback: { success: "Complete.", invalid: "Retry." },
  evidence: [],
  ...extra,
});

const contractedMeasure = action("measureVolume", {
  volume: { source: "action-input", outputMeasurementId: "measured-volume" },
  parameters: {
    sourceDefinitionId: "wash-bottle",
    targetDefinitionId: "graduated-cylinder",
    inputMode: "numeric",
  },
});
assert(validateActionDefinition(contractedMeasure).ok, "Valid action-input volume contract was rejected.");
assert(!validateActionDefinition(action("transfer", {
  volume: { source: "literal", valueMl: 5 },
  parameters: { sourceDefinitionId: "wash-bottle", targetDefinitionId: "graduated-cylinder", volumeMl: 5 },
})).ok, "Typed volume plus legacy volumeMl ambiguity was accepted.");
assert(!validateActionDefinition(action("dilute", {
  volume: { source: "measurement", referenceId: "measured-final" },
  parameters: { sourceDefinitionId: "wash-bottle", targetDefinitionId: "volumetric-flask", inputMode: "numeric" },
})).ok, "Evidence volume plus numeric-input ambiguity was accepted.");
assert(!validateActionDefinition(action("transfer", {
  volume: { source: "target-fill-fraction", fraction: 1.1 },
})).ok, "Out-of-range target fill fraction was accepted.");
assert(!validateActionDefinition(action("observe", {
  volume: { source: "literal", valueMl: 1 },
})).ok, "Volume contract was accepted on an illegal verb.");
assert(validateActionDefinition(action("transfer", {
  mass: { source: "measurement", referenceId: "learner-mass" },
})).ok, "Named measurement mass transfer contract was rejected.");
assert(!validateActionDefinition(action("transfer", {
  volume: { source: "literal", valueMl: 1 },
  mass: { source: "measurement", referenceId: "learner-mass" },
})).ok, "Simultaneous mass and volume contracts were accepted.");
const classification = action("calculate", {
  parameters: {
    template: "classifyMeasurementAgainstBound",
    measurementId: "sample-reading",
    boundMeasurementId: "approved-bound",
    comparison: "below",
    calculationId: "classification",
  },
});
assert(validateActionDefinition(classification).ok, "Direction-explicit classification was rejected.");
assert(validateActionDefinition({
  ...classification,
  parameters: { ...classification.parameters, comparison: "sideways" },
}).ok === false, "Unsupported classification direction was accepted.");
assert(!validateActionDefinition(action("observe", {
  parameters: { configuredValue: 400, configurationValue: 400 },
})).ok, "Canonical/deprecated configuration alias conflict was accepted.");

assert(COMPOSITION_COMPILER_CONTRACT_VERSION === "1.4", "Compiler does not emit contract 1.4.");
for (const version of ["1.0", "1.1", "1.2", "1.3", "1.4"]) {
  assert(validateCompositionManifest({
    schemaVersion: 1,
    compilerContractVersion: version,
    status: "compiled",
    instances: [],
    origins: [],
  }).ok, `Known manifest ${version} is no longer readable.`);
}
assert(!validateCompositionManifest({
  schemaVersion: 1,
  compilerContractVersion: "1.5",
  status: "compiled",
  instances: [],
  origins: [],
}).ok, "Unknown compiler contract 1.5 was accepted.");

const compiler = readFileSync("src/data/compileLabComposition.ts", "utf8");
const reducer = readFileSync("src/runtime/reducer.ts", "utf8");
const validation = readFileSync("src/domain/validation.ts", "utf8");
const between = (source, start, end) => {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert(from >= 0 && to > from, `Unable to isolate source section ${start}.`);
  return source.slice(from, to);
};
const derivedSection = between(reducer, 'if (action.verb === "calculate")', "// Investigation 9's four composition");
const classificationSection = between(derivedSection,
  '} else if (template === "classifyMeasurementAgainstBound") {',
  '} else if (template === "dilutionFactorFromVolumes") {');
assert(classificationSection.includes('comparison !== "below" && comparison !== "above"') &&
  classificationSection.includes("Number.isFinite(measured.value)") &&
  classificationSection.includes("measured.unit !== bound.unit"),
"Classification is not direction-explicit, finite, and unit compatible.");
assert(derivedSection.includes("const value = nonOverridableDerivedTemplate ? derivedValue") &&
  derivedSection.includes('"classifyMeasurementAgainstBound"'),
"Evidence-derived classification remains caller-overridable.");
const edgeSection = between(reducer, "const calculationSatisfiesEdge", "const nextNodeId");
assert(edgeSection.includes("calculation.passed !== true"), "Calculation-result branches accept failed or spoofed calculations.");
const rinseSection = between(reducer, 'if (action.verb === "rinse")', 'if (action.verb === "dry")');
assert(rinseSection.includes("const explicitLiquidRinse") &&
  rinseSection.includes("explicitLiquidRinse && source") &&
  rinseSection.includes("conditionsWithSample") &&
  !rinseSection.includes("if (!source || source.contents.kind === \"empty\"") ,
"Rinse compatibility does not distinguish non-liquid operations from strict conditioning/quantitative rinses.");
const diluteSection = between(reducer, 'if (action.verb === "dilute")', 'if (action.verb === "developChromatogram")');
assert(diluteSection.indexOf("The contracted dilution source is not a pure diluent.") < diluteSection.indexOf("const nextTarget"),
  "Contracted dilute does not reject non-pure diluent before mutation.");
assert(diluteSection.includes("params.dilutionFactor ?? finalVolumeMl / Math.max") &&
  diluteSection.includes(': { value: factor, unit: "mg/L" as const }') &&
  diluteSection.includes('id: "dilution-factor"') &&
  diluteSection.indexOf("calculations: actionDefinition.dilutionFactorOutputId") <
    diluteSection.indexOf('id: "dilution-factor"'),
"Legacy untyped dilute no longer preserves authored dilutionFactor, fallback concentration, and dilution-factor measurement behavior.");
assert(/Reference\|Output/.test(compiler) && compiler.includes("/OutputIds?$/i"),
  "Structured output/reference ids are not compiler-scoped.");
assert(validation.includes("cannot declare both volume and mass contracts") &&
  validation.includes("cannot be combined with legacy parameter volume source"),
"Typed contract ambiguity validation is incomplete.");
assert(!/(?:blue1|brass-colorimetry)/i.test(reducer), "Runtime amendment contains a lab-specific branch.");

const planningRoot = "planning/2026-08-30_lab-studio-technique-composition-remediation";
const requestPath = `${planningRoot}/evidence/lane-05/shared-contract-request-03-executable-evidence.json`;
const predecessorPath = `${planningRoot}/evidence/CYCLE_05_SHARED_CONTRACT_PREDECESSOR_REVISION_3_EXECUTABLE_EVIDENCE.json`;
const baselinePath = `${planningRoot}/evidence/CYCLE_05_SHARED_CONTRACT_BASELINE_REVISION_4.json`;
const impactPath = `${planningRoot}/evidence/CYCLE_05_EXECUTABLE_EVIDENCE_AMENDMENT_IMPACT.json`;
const request = readJson(requestPath);
const predecessor = readJson(predecessorPath);
const baseline = readJson(baselinePath);
const impact = readJson(impactPath);
assert(request.requestId === "cycle-05-executable-evidence-03" && request.baselineRevision === 3,
  "Immutable request03 identity or predecessor revision is wrong.");
assert(predecessor.baselineRevision === 3 && predecessor.nextRevision === 4,
  "Revision-3 predecessor capture does not lead to revision 4.");
assert(baseline.baselineRevision === 4 && baseline.state === "reviewed-frozen" &&
  baseline.criticalReviewRequired === false && baseline.criticalReview?.performed === true &&
  baseline.criticalReview.accepted === true && baseline.criticalReview.model === "gpt-5.6-sol" &&
  baseline.criticalReview.reasoningEffort === "xhigh",
  "Revision-4 candidate state is wrong.");
assert(baseline.request.sha256 === sha256(requestPath) && baseline.predecessor.captureSha256 === sha256(predecessorPath),
  "Revision-4 request or predecessor capture hash is stale.");
assert(Array.isArray(baseline.files) && baseline.files.length === baseline.fileCount && baseline.fileCount > 1300,
  "Revision-4 baseline is not a complete full-file identity.");
const aggregate = createHash("sha256");
for (const file of baseline.files) {
  assert(file.sha256 === sha256(file.path), `Revision-4 shared hash is stale for ${file.path}.`);
  aggregate.update(`${file.path}\0${file.size}\0${file.sha256}\n`);
}
assert(aggregate.digest("hex") === baseline.aggregateSha256,
  "Revision-4 full-file aggregate is stale or internally inconsistent.");
assert(baseline.identityBoundary?.staleLaneBytesIncluded === true &&
  Array.isArray(baseline.identityBoundary.excludedExact),
"Revision-4 identity boundary is not reproducible.");
assert(impact.baselineRevision === 4 && impact.state === "reviewed-frozen" &&
  impact.criticalReview.performed === true && impact.criticalReview.accepted === true &&
  impact.criticalReview.acceptancePending === false && impact.affected.ownedPaths.length === 15 &&
  impact.baseline.fileCount === baseline.fileCount && impact.baseline.aggregateSha256 === baseline.aggregateSha256,
  "Revision-4 impact or mandatory review gate is incomplete.");

console.log(JSON.stringify({
  ok: true,
  compilerContractVersion: COMPOSITION_COMPILER_CONTRACT_VERSION,
  staticContracts: ["volume", "mass", "configuration-alias", "calculations", "photometer"],
  baselineState: baseline.state,
  baselineFileCount: baseline.fileCount,
  baselineAggregateSha256: baseline.aggregateSha256,
  affectedReplayPaths: impact.affected.ownedPaths.length,
}, null, 2));
