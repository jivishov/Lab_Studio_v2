import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// Basic source contract lint only: does not execute runtime fixtures or simulate a procedure.
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const reducer = read('src/runtime/reducer.ts');
const registry = JSON.parse(read('src/domain/atomRegistry.json'));
const effects = read('src/domain/atomRegistry.ts');
const validation = read('src/domain/validation.ts');
const compiler = read('src/data/compileLabComposition.ts');
for (const operation of ['mix', 'vent', 'settle']) {
  const atom = registry.atoms.find((entry) => entry.id === `atom.${operation}.extraction-funnel`);
  assert.equal(atom?.verb, operation);
  assert.deepEqual(atom.requiredRoles, ['extraction-funnel']);
}
assert.ok(reducer.includes('extractionState: { stage }')); // fresh operation clears old observation
assert.ok(reducer.includes('previous?.stage !== "mixed"'));
assert.ok(reducer.includes('previous?.stage !== "vented"'));
assert.ok(reducer.includes('readiness.observation !== "layers-observed"'));
assert.ok(reducer.includes('control.parameters.inputRole === "teacherConfiguration"'));
assert.ok(reducer.includes('attempt.actionId === id && attempt.success'));
assert.ok(reducer.includes('const observation = action.note;'));
assert.ok(validation.includes('must not default an observed outcome'));
assert.ok(effects.includes('has no typed physical handler'));
for (const operation of ['markBaseline', 'drySpot', 'markSolventFront', 'dryDevelopedPaper']) assert.ok(effects.includes(operation));
// Existing generic recursive compiler binding covers the new array and vessel endpoint.
assert.ok(compiler.includes('rewriteBoundValue(item, key, maps'));
assert.ok(compiler.includes('/ActionIds?$/.test(key)'));
assert.ok(compiler.includes('/InstanceIds?$/.test(key)'));
assert.ok(reducer.includes('Math.abs(second.value - first.value)'));
assert.ok(reducer.includes('difference < tolerance.value : difference <= tolerance.value'));
assert.ok(reducer.includes('second.unit !== first.unit || tolerance.unit !== first.unit'));
assert.ok(reducer.includes('!first || !second || !tolerance'));
assert.ok(reducer.includes('if (!toleranceApproved)'));
assert.ok(reducer.includes('target.extractionState ? { stage: "charged" } : undefined'));
assert.ok(reducer.includes('...mergeTransferredContentsBase(target, source), extractionState: chargedExtractionState(target)'));
assert.equal((reducer.match(/extractionState: chargedExtractionState\(target\)/g) ?? []).length, 3);
assert.ok(reducer.includes('matchesEquipmentRole(vessel, "extraction-funnel")'));
assert.ok(reducer.includes('matchesEquipmentRole(extractionSource, "extraction-funnel")'));
assert.ok(reducer.includes('matchesEquipmentRole(paper, "stationary-phase")'));
assert.ok(validation.includes('instance.definitionId'));
assert.ok(validation.includes('binding !== instance.definitionId'));
assert.ok(validation.includes('rule.type === "actionEvidence" && rule.actionId === id'));
assert.ok(validation.includes('control.parameters.inputRole !== "teacherConfiguration"'));
assert.ok(validation.includes('action.verb === "record" && isObject(action.interaction) && action.interaction.type === "recordNotebook"'));
assert.ok(validation.includes('action.parameters.copyExistingMeasurementOnly === true'));
assert.ok(validation.includes('copyConsumer ? undefined : parameters.measurementId'));
assert.ok(validation.includes('if (copyConsumer) references.push({ source: "measurement", referenceId: parameters.measurementId'));
assert.ok(validation.includes('if (!copyConsumer && ["weigh", "measureVolume", "observe", "record"]'));
assert.ok(validation.includes('measurement copy cannot author a replacement value'));
console.log('Cycle 06 extraction/chromatography basic source contract lint passed. Runtime fixtures intentionally not executed.');
