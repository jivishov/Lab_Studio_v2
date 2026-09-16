import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { COMPOSITION_COMPILER_CONTRACT_VERSION } from "../src/data/compileLabComposition.ts";
import { runCompositionStaticFixtures } from "../src/data/compositionStaticFixtures.ts";
import { validateCompositionManifest } from "../src/domain/compositionValidation.ts";
import { validateActionDefinition, validateTechniqueDefinition } from "../src/domain/validation.ts";
import { createEquipmentInstance } from "../src/equipment/catalog.ts";
import { createRuntimeState } from "../src/runtime/createRuntime.ts";
import { performRuntimeAction } from "../src/runtime/reducer.ts";

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const baseAction = (verb, extra = {}) => ({
  id: `fixture-${verb}`, verb, label: `Fixture ${verb}`, parameters: {}, prerequisites: [], stateChanges: [], invalidCases: [],
  feedback: { success: "Complete.", invalid: "Retry." }, evidence: [], ...extra,
});

assert(COMPOSITION_COMPILER_CONTRACT_VERSION === "1.5", "Compiler does not emit contract 1.5.");
for (const version of ["1.0", "1.1", "1.2", "1.3", "1.4", "1.5"]) assert(validateCompositionManifest({
  schemaVersion: 1, compilerContractVersion: version, status: "compiled", instances: [], origins: [],
}).ok, `Known compiler manifest ${version} is no longer readable.`);
assert(!validateCompositionManifest({ schemaVersion: 1, compilerContractVersion: "1.6", status: "compiled", instances: [], origins: [] }).ok,
  "Unknown compiler manifest 1.6 was accepted.");

const valid = [
  baseAction("calculate", { analysis: { type: "mixedEvidenceRegression", pairs: [
    { x: { source: "measurement", referenceId: "x1" }, y: { source: "calculation", referenceId: "y1" } },
    { x: { source: "calculation", referenceId: "x2" }, y: { source: "measurement", referenceId: "y2" } },
  ], xUnit: "M", yUnit: "abs", outputCalculationId: "fit" } }),
  baseAction("calculate", { analysis: { type: "unaryEvidenceTransform", input: { source: "measurement", referenceId: "x" }, operation: "power10", outputUnit: "M", outputCalculationId: "inverse" } }),
  baseAction("calculate", { analysis: { type: "concentrationFromRegression", response: { source: "calculation", referenceId: "response" }, regressionCalculationId: "fit", outputUnit: "M", outputCalculationId: "unknown" } }),
  baseAction("calculate", { analysis: { type: "molarConcentrationToMass", concentration: { source: "measurement", referenceId: "c" }, solutionVolumeMeasurementId: "v", molarMassMeasurementId: "mm", outputCalculationId: "mass" } }),
  baseAction("observe", { runtimeRepeat: { countMeasurementId: "n", outputMeasurementId: "reading", progressId: "scan" } }),
  baseAction("observe", { parameters: { inputMode: "numeric", inputRole: "teacherConfiguration" }, sourceInventory: { sourceInstanceId: "source-1", sourceDefinitionId: "sample-bottle", outputMeasurementId: "inventory" } }),
  baseAction("dissolve", { parameters: { sourceDefinitionId: "sample-bottle", targetDefinitionId: "beaker-150ml" }, materialTransition: { kind: "solution", label: "Dissolved sample", wetState: "wet", visualState: "clear-solution" } }),
  baseAction("transfer", { parameters: { sourceDefinitionId: "sample-bottle", targetDefinitionId: "beaker-150ml" }, volume: { source: "measurement", referenceId: "aliquot" }, deliveryDevice: { deviceDefinitionId: "graduated-pipette-10ml" } }),
  baseAction("observe", { parameters: { inputMode: "choice" }, choiceObservation: { outputCalculationId: "endpoint", options: [
    { label: "Continues", tag: "continues", value: 0 }, { label: "Subsided", tag: "subsided", value: 1 },
  ] } }),
];
for (const action of valid) {
  const result = validateActionDefinition(action);
  assert(result.ok, `Valid ${action.analysis?.type ?? action.verb} contract rejected: ${result.errors.join(" ")}`);
}
const invalid = [
  baseAction("calculate", { analysis: { type: "mixedEvidenceRegression", pairs: [{ x: { source: "measurement", referenceId: "x" }, y: { source: "measurement", referenceId: "y" } }], xUnit: "M", yUnit: "abs", outputCalculationId: "fit" } }),
  baseAction("calculate", { parameters: { template: "legacy" }, analysis: valid[1].analysis }),
  baseAction("calculate", { analysis: { type: "unaryEvidenceTransform", input: { source: "measurement", referenceId: "x" }, operation: "ln", outputUnit: "x", outputCalculationId: "bad" } }),
  baseAction("observe", { runtimeRepeat: { countMeasurementId: "", outputMeasurementId: "reading", progressId: "scan" } }),
  baseAction("observe", { parameters: { inputMode: "numeric" }, sourceInventory: { sourceDefinitionId: "not-equipment", outputMeasurementId: "inventory" } }),
  baseAction("observe", { parameters: { inputMode: "numeric", inputRole: "teacherConfiguration", configuredValue: -1 }, sourceInventory: { sourceDefinitionId: "sample-bottle", outputMeasurementId: "inventory" } }),
  baseAction("observe", { parameters: { inputMode: "numeric", inputRole: "teacherConfiguration", configuredValue: 1 }, sourceInventory: { sourceDefinitionId: "ph-paper", outputMeasurementId: "inventory" } }),
  baseAction("dissolve", { parameters: { sourceDefinitionId: "sample-bottle", targetDefinitionId: "beaker-150ml" }, materialTransition: { concentration: 1 } }),
  baseAction("transfer", { parameters: { sourceDefinitionId: "sample-bottle", targetDefinitionId: "beaker-150ml" }, deliveryDevice: { deviceDefinitionId: "graduated-pipette-10ml" } }),
  baseAction("transfer", { parameters: { sourceDefinitionId: "sample-bottle", targetDefinitionId: "beaker-150ml", sourceInstanceId: "same", targetInstanceId: "receiver" }, volume: { source: "measurement", referenceId: "aliquot" }, deliveryDevice: { deviceInstanceId: "same", deviceDefinitionId: "graduated-pipette-10ml" } }),
  baseAction("transfer", { parameters: { sourceDefinitionId: "sample-bottle", targetDefinitionId: "beaker-150ml" }, volume: { source: "literal", valueMl: 1 }, interaction: { type: "dispenseDrops", sourceDefinitionId: "sample-bottle", targetDefinitionId: "beaker-150ml", accessibleLabel: "Dispense a drop." }, deliveryDevice: { deviceDefinitionId: "graduated-pipette-10ml" } }),
  baseAction("observe", { parameters: { inputMode: "choice" }, choiceObservation: { outputCalculationId: "endpoint", options: [
    { label: "Same", tag: "same", value: 1 }, { label: "Same", tag: "same", value: 1 },
  ] } }),
];
for (const action of invalid) assert(!validateActionDefinition(action).ok, "Malformed or ambiguous compiler 1.5 contract was accepted.");

const runtimeTechnique = (action, equipment = [], validation = []) => ({
  id: `runtime-${action.id}`, title: "Runtime contract fixture", learningGoal: "Verify typed runtime boundaries.",
  requiredEquipment: [...new Set(equipment.map((entry) => entry.definitionId))], initialState: { equipment }, actions: [action],
  process: { startNodeId: "runtime-node", nodes: [{ id: "runtime-node", type: "action", title: "Runtime action", description: "Fixture action", actionId: action.id, config: {}, validation, hints: [], feedback: { success: "Done.", retry: "Retry." } }], edges: [] },
  successCriteria: [], commonMistakes: [], resetBehavior: "resetTechnique", metadata: {},
});
const scientificState = (state) => JSON.stringify({
  equipmentInstances: state.equipmentInstances, attachments: state.attachments, contents: state.contents,
  measurements: state.measurements, dataSeries: state.dataSeries, calculations: state.calculations,
  repeatProgress: state.repeatProgress, evidenceScopeId: state.evidenceScopeId,
});

const bypassAction = baseAction("transfer", {
  id: "runtime-delivery-bypass", parameters: { sourceDefinitionId: "sample-bottle", targetDefinitionId: "beaker-150ml" },
  volume: { source: "literal", valueMl: 1 }, interaction: { type: "dispenseDrops", sourceDefinitionId: "sample-bottle", targetDefinitionId: "beaker-150ml", accessibleLabel: "Dispense a drop." },
  deliveryDevice: { deviceDefinitionId: "graduated-pipette-10ml" },
});
const bypassDefinition = runtimeTechnique(bypassAction);
const bypassBefore = createRuntimeState(bypassDefinition);
const bypassAfter = performRuntimeAction(bypassDefinition, bypassBefore, { actionId: bypassAction.id, verb: "transfer", parameters: { dispenseMode: "drop" } });
assert(scientificState(bypassAfter) === scientificState(bypassBefore) && bypassAfter.feedbackQueue.at(-1)?.message.includes("cannot be bypassed"),
  "Runtime accepted or mutated state for a typed delivery-device drop-path bypass.");

const paperSource = { ...createEquipmentInstance("ph-paper", "source", "workbench"), contents: { kind: "liquid", label: "Configured liquid", volumeMl: 1, solutes: [], contamination: [], wetState: "wet", visualState: "clear-liquid" } };
const noCapacityAction = baseAction("observe", { id: "runtime-no-capacity-inventory", parameters: { inputMode: "numeric", inputRole: "teacherConfiguration", configuredValue: 1 }, sourceInventory: { sourceInstanceId: paperSource.id, sourceDefinitionId: "ph-paper", outputMeasurementId: "inventory" } });
const noCapacityDefinition = runtimeTechnique(noCapacityAction, [paperSource]);
const noCapacityBefore = createRuntimeState(noCapacityDefinition);
const noCapacityAfter = performRuntimeAction(noCapacityDefinition, noCapacityBefore, { actionId: noCapacityAction.id, verb: "observe" });
assert(scientificState(noCapacityAfter) === scientificState(noCapacityBefore) && noCapacityAfter.feedbackQueue.at(-1)?.message.includes("positive mL capacity"),
  "Runtime accepted or mutated state for a no-capacity inventory source.");

const repeatAction = baseAction("record", { id: "runtime-repeat", parameters: { unit: "abs" }, runtimeRepeat: { countMeasurementId: "repeat-count", outputMeasurementId: "reading", progressId: "repeat-progress" } });
const repeatDefinition = runtimeTechnique(repeatAction);
const repeatInitial = { ...createRuntimeState(repeatDefinition), measurements: [{ id: "repeat-count", label: "Configured repeats", value: 2, unit: "count", nodeId: "setup" }] };
const repeatFirst = performRuntimeAction(repeatDefinition, repeatInitial, { actionId: repeatAction.id, verb: "record", value: 0.25 });
assert(repeatFirst.measurements.some((entry) => entry.id === "reading--1" && entry.value === 0.25) &&
  repeatFirst.measurements.some((entry) => entry.id === "reading" && entry.value === 0.25) &&
  repeatFirst.repeatProgress["repeat-progress"]?.completedIterations.join() === "1" && !repeatFirst.completedNodes.includes("runtime-node"),
  "Runtime repeat did not retain its first suffixed history entry and stable base alias without premature completion.");
const repeatSecond = performRuntimeAction(repeatDefinition, repeatFirst, { actionId: repeatAction.id, verb: "record", value: 0.5 });
assert(repeatSecond.measurements.some((entry) => entry.id === "reading--1" && entry.value === 0.25) &&
  repeatSecond.measurements.some((entry) => entry.id === "reading--2" && entry.value === 0.5) &&
  repeatSecond.measurements.some((entry) => entry.id === "reading" && entry.value === 0.5) &&
  repeatSecond.repeatProgress["repeat-progress"]?.complete === true && repeatSecond.completedNodes.includes("runtime-node"),
  "Runtime repeat did not preserve suffixed history while advancing the stable base alias to completion.");

const rollbackDefinition = runtimeTechnique(repeatAction, [], [{ id: "must-not-exist", type: "measurementRecorded", label: "Impossible fixture measurement", measurementId: "never-produced" }]);
const rollbackInitial = { ...createRuntimeState(rollbackDefinition), measurements: [{ id: "repeat-count", label: "Configured repeats", value: 1, unit: "integer", nodeId: "setup" }] };
const rollbackAfter = performRuntimeAction(rollbackDefinition, rollbackInitial, { actionId: repeatAction.id, verb: "record", value: 0.75 });
assert(scientificState(rollbackAfter) === scientificState(rollbackInitial) && !rollbackAfter.completedNodes.includes("runtime-node"),
  "Failed repeated node validation retained produced evidence, progress, or scientific mutation.");

const collisionTechnique = runtimeTechnique(baseAction("observe", { id: "repeat-count-producer", parameters: { measurementId: "repeat-count" } }));
collisionTechnique.actions.push(
  baseAction("record", { id: "repeat-a", runtimeRepeat: { countMeasurementId: "repeat-count", outputMeasurementId: "reading-a", progressId: "shared-progress" } }),
  baseAction("record", { id: "repeat-b", runtimeRepeat: { countMeasurementId: "repeat-count", outputMeasurementId: "reading-b", progressId: "shared-progress" } }),
);
const collisionResult = validateTechniqueDefinition(collisionTechnique);
assert(!collisionResult.ok && collisionResult.errors.some((error) => error.includes('repeats runtime repeat progress id "shared-progress"')),
  "Two runtime-repeat actions were allowed to inherit the same progress identity.");
for (const reverse of [false, true]) {
  const crossNamespace = runtimeTechnique(baseAction("observe", { id: "repeat-count-producer", parameters: { measurementId: "repeat-count" } }));
  const typed = baseAction("record", { id: "typed-repeat", runtimeRepeat: { countMeasurementId: "repeat-count", outputMeasurementId: "typed-reading", progressId: "cross-progress" } });
  const legacy = baseAction("record", { id: "legacy-repeat", parameters: { repeatGroupId: "cross-progress", repeatIteration: 1, repeatCount: 1 } });
  crossNamespace.actions.push(...(reverse ? [legacy, typed] : [typed, legacy]));
  const crossResult = validateTechniqueDefinition(crossNamespace);
  assert(!crossResult.ok && crossResult.errors.some((error) => error.includes('runtime repeat progress id "cross-progress" collides with a legacy repeat group id')),
    "Typed and legacy repeat actions shared repeatProgress state in one declaration order.");
}

const massAction = baseAction("calculate", { id: "runtime-molar-mass", analysis: { type: "molarConcentrationToMass", concentration: { source: "measurement", referenceId: "concentration" }, solutionVolumeMeasurementId: "solution-volume", molarMassMeasurementId: "molar-mass", outputCalculationId: "derived-mass" } });
const massDefinition = runtimeTechnique(massAction);
for (const measurements of [
  [{ id: "concentration", label: "Concentration", value: Number.NaN, unit: "M", nodeId: "setup" }, { id: "solution-volume", label: "Volume", value: 100, unit: "mL", nodeId: "setup" }, { id: "molar-mass", label: "Molar mass", value: 58.44, unit: "g/mol", nodeId: "setup" }],
  [{ id: "concentration", label: "Concentration", value: 1, unit: "M", nodeId: "setup" }, { id: "solution-volume", label: "Volume", value: 100, unit: "mL", nodeId: "setup" }, { id: "molar-mass", label: "Molar mass", value: Number.POSITIVE_INFINITY, unit: "g/mol", nodeId: "setup" }],
]) {
  const invalidMassState = { ...createRuntimeState(massDefinition), measurements };
  const invalidMassAfter = performRuntimeAction(massDefinition, invalidMassState, { actionId: massAction.id, verb: "calculate" });
  assert(!invalidMassAfter.calculations.some((entry) => entry.id === "derived-mass"), "Non-finite molar-mass evidence stored a derived calculation.");
}

const fixtures = await runCompositionStaticFixtures();
assert(fixtures.analysisAndProcedureEvidence === "eight-positive-and-negative-typed-contract-fixtures", "Contract 1.5 fixture matrix did not run.");
assert(fixtures.structuredEvidence.includes("compiler-1.5"), "Nested evidence output/reference scoping fixture did not run.");

const reducer = readFileSync("src/runtime/reducer.ts", "utf8");
const compiler = readFileSync("src/data/compileLabComposition.ts", "utf8");
const createRuntime = readFileSync("src/runtime/createRuntime.ts", "utf8");
const between = (source, start, end) => {
  const from = source.indexOf(start); const to = source.indexOf(end, from + start.length);
  assert(from >= 0 && to > from, `Unable to isolate ${start}.`); return source.slice(from, to);
};
const analysisSection = between(reducer, "if (actionDefinition.analysis)", "const calculationId = String(params.calculationId");
assert(analysisSection.includes("calculateLinearRegression(series)") && analysisSection.includes("new Set(series.map") &&
  analysisSection.includes("Math.log10") && analysisSection.includes("10 ** input.value") &&
  analysisSection.includes('molarMass.unit !== "g/mol"') && analysisSection.includes('solutionVolume.unit === "mL"') &&
  analysisSection.includes("xUnit: contract.xUnit") && analysisSection.includes("calibration.regression.yUnit !== response.unit") &&
  analysisSection.includes("calibration.regression.xUnit !== contract.outputUnit"),
  "Typed analysis runtime is not finite, domain-aware, and unit-aware.");
assert(!analysisSection.includes("action.value ??"), "Typed derived outputs remain caller-overridable.");
const inventorySection = between(reducer, "if (actionDefinition.sourceInventory)", "if (actionDefinition.materialTransition)");
assert(inventorySection.includes('inputRole !== "teacherConfiguration"') && inventorySection.includes('!["liquid", "solution"].includes') &&
  !inventorySection.includes('"mixture"') && inventorySection.includes("actionDefinition.parameters.configuredValue") &&
  inventorySection.includes("source?.definitionId === contract.sourceDefinitionId") && inventorySection.includes("capacityProven") &&
  inventorySection.indexOf("if (actionDefinition.parameters.inputRole") < inventorySection.indexOf("updateInstance(state"),
  "Inventory provenance/content/value validation does not fail before mutation.");
const transitionSection = between(reducer, "if (actionDefinition.materialTransition)", "if (actionDefinition.choiceObservation)");
for (const conserved of ["...instance.contents", "kind:", "label:", "wetState:", "visualState:"]) assert(transitionSection.includes(conserved), "Qualitative transition does not preserve content before allowed overrides.");
assert(!/concentration\s*:|solutes\s*:|massG\s*:|volumeMl\s*:/.test(transitionSection), "Qualitative transition mutates conserved quantitative identity.");
const deliverySection = between(reducer, "const deliveryContract = actionDefinition.deliveryDevice", "const sourceDefinition = equipmentById.get(source.definitionId)");
assert(deliverySection.includes('device.location !== "shelf"') && deliverySection.includes("capacity.amount >= volumeMl") &&
  deliverySection.includes('precision.unit === "mL"') && deliverySection.includes('device.contents.kind === "empty"') &&
  deliverySection.includes("selectorsAgree") && deliverySection.includes("pairwiseDistinct"),
  "Delivery-device mediation does not enforce presence, calibration, capacity, and empty-state compatibility before source mutation.");
const dropDispatchSection = between(reducer, 'if (action.verb === "transfer")', "const source = findInstance(");
assert(dropDispatchSection.includes("actionDefinition.deliveryDevice") && dropDispatchSection.includes("cannot be bypassed") &&
  dropDispatchSection.indexOf("actionDefinition.deliveryDevice") < dropDispatchSection.indexOf("executeDropDispense"),
  "Typed delivery-device mediation is not rejected before direct drop dispensing.");
const repeatSection = between(reducer, "const runtimeRepeat = actionDefinition.runtimeRepeat", "const unmetPrerequisite");
assert(repeatSection.includes("Number.isInteger(count.value)") && repeatSection.includes("outputMeasurementId}--${runtimeRepeatIteration}") &&
  repeatSection.includes('["count", "integer"].includes(count.unit)') && repeatSection.includes("already exists"), "Runtime repeat does not fail closed or allocate deterministic collision-free outputs.");
const transactionSection = between(reducer, "const executableRequest = runtimeRepeatOutputMeasurementId", "const visualProxyInstanceId");
assert(transactionSection.includes("transactionalTypedAction") && transactionSection.includes("runtimeRepeat.outputMeasurementId") &&
  transactionSection.includes("{ ...produced, id: runtimeRepeat.outputMeasurementId }"),
  "Typed actions do not establish transactional failure handling and a stable repeat base alias.");
const completionSection = between(reducer, "if (!result.ok)", "return {");
assert(completionSection.includes("transactionalTypedAction") && completionSection.includes("...activeState"),
  "Typed failures do not restore the pre-action scientific state.");
const postValidationSection = between(reducer, "const validationEvidence", "const runtimeRepeatComplete");
assert(postValidationSection.includes("if (runtimeRepeat && !passed)") && postValidationSection.includes("...activeState"),
  "A failed repeated node validation is not rolled back before retry.");
const deliveredEmptySection = between(reducer, "if (deliveryContract) {\n      const deliveredThroughDevice", "return { ok: true, state: afterSource");
assert(deliveredEmptySection.includes('contents.kind !== "empty"') && deliveredEmptySection.includes("return fail(state"),
  "Delivery-device postcondition does not restore the pre-transfer state on failure.");
const continuity = readFileSync("src/domain/validation.ts", "utf8");
const continuitySection = between(continuity, "const validateStructuredEvidenceContinuity", "const requirePositiveNumber");
assert(continuitySection.includes('[["volume", volume], ["mass", mass]]') && continuitySection.includes("availableMeasurements") &&
  continuitySection.includes("must be produced before it is consumed") && continuitySection.includes("runtimeRepeatProgressIds") &&
  continuitySection.includes("legacyRepeatGroupIds") && continuitySection.includes("collides with a legacy repeat group id") &&
  continuitySection.includes("repeats runtime repeat progress id") && !continuitySection.includes("measurementProducers"),
  "Structured volume/mass continuity is not producer-before-consumer ordered.");
assert(createRuntime.includes("repeatProgress: {}"), "Reset initialization does not clear runtime repeat progress.");
assert(compiler.includes("rewriteBoundValue(child, childKey") && compiler.includes("Progress)Ids"), "Compiler does not recursively scope contract 1.5 reference/output/progress identities.");
assert(!/(?:blue1|brass-colorimetry)/i.test(reducer), "Runtime amendment contains a lab-specific branch.");

const planningRoot = "planning/2026-08-30_lab-studio-technique-composition-remediation";
const requestPath = `${planningRoot}/evidence/lane-05/shared-contract-request-04-analysis-and-procedure-evidence.json`;
const predecessorPath = `${planningRoot}/evidence/CYCLE_05_SHARED_CONTRACT_PREDECESSOR_REVISION_4_ANALYSIS_AND_PROCEDURE_EVIDENCE.json`;
const baselinePath = `${planningRoot}/evidence/CYCLE_05_SHARED_CONTRACT_BASELINE_REVISION_5.json`;
const impactPath = `${planningRoot}/evidence/CYCLE_05_ANALYSIS_AND_PROCEDURE_EVIDENCE_AMENDMENT_IMPACT.json`;
const request = readJson(requestPath); const predecessor = readJson(predecessorPath);
const baseline = readJson(baselinePath); const impact = readJson(impactPath);
assert(request.requestId === "cycle-05-analysis-and-procedure-evidence-04" && request.baselineRevision === 4, "Request04 lineage is wrong.");
assert(predecessor.baselineRevision === 4 && predecessor.nextRevision === 5, "Revision-4 predecessor capture is wrong.");
assert(baseline.baselineRevision === 5 && baseline.state === "reviewed-frozen" && baseline.criticalReviewRequired === false &&
  baseline.criticalReview.performed === true && baseline.criticalReview.accepted === true &&
  baseline.criticalReview.model === "gpt-5.6-sol" && baseline.criticalReview.reasoningEffort === "xhigh",
  "Revision-5 accepted review gate is not frozen.");
assert(baseline.request.sha256 === sha256(requestPath) && baseline.predecessor.captureSha256 === sha256(predecessorPath), "Revision-5 lineage hashes are stale.");
assert(Array.isArray(baseline.files) && baseline.files.length === baseline.fileCount && baseline.fileCount > 1382, "Revision-5 manifest is not a full-file identity.");
const aggregate = createHash("sha256");
for (const file of baseline.files) { assert(file.sha256 === sha256(file.path), `Revision-5 hash is stale for ${file.path}.`); aggregate.update(`${file.path}\0${file.size}\0${file.sha256}\n`); }
assert(aggregate.digest("hex") === baseline.aggregateSha256, "Revision-5 aggregate is stale.");
assert(impact.baselineRevision === 5 && impact.state === "reviewed-frozen" && impact.criticalReview.acceptancePending === false &&
  impact.criticalReview.performed === true && impact.criticalReview.accepted === true && impact.criticalReview.finalVerdict === "accepted" &&
  impact.affected.cycles.length === 1 && impact.affected.cycles[0] === "05" && impact.affected.ownedPaths.length === 15,
  "Revision-5 impact or affected replay boundary is incomplete.");

console.log(JSON.stringify({ ok: true, compilerContractVersion: COMPOSITION_COMPILER_CONTRACT_VERSION,
  contracts: ["mixed-regression", "unary-transform", "typed-regression-response", "molar-mass", "runtime-repeat", "source-inventory", "qualitative-transition", "delivery-device", "choice-observation"],
  baselineState: baseline.state, baselineFileCount: baseline.fileCount, baselineAggregateSha256: baseline.aggregateSha256,
  affectedReplayPaths: impact.affected.ownedPaths.length }, null, 2));
