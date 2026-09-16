import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  cycle09LabIds,
  cycle09TechniqueIds,
  deriveCycle09CurrentSourceProjection,
  deriveCycle09ReconciliationInputs,
} from "../cycle09CurrentSourceProjection.mjs";

const test = process.env.VITEST || globalThis.__vitest_worker__
  ? (await import("vitest")).test
  : (await import("node:test")).default;

const appRoot = resolve(join(dirname(fileURLToPath(import.meta.url)), "../.."));
const readJson = (relativePath) => JSON.parse(readFileSync(join(appRoot, relativePath), "utf8"));
const sourceOverlayFile = "source-trace-overlay.json";
const atomicOverlayFile = "technique-atomicity-overlay.json";

const currentTechniqueMap = () => new Map(cycle09TechniqueIds.map((id) => [
    id,
    readJson(`public/techniques/${id}.json`),
  ]));
const currentLabMap = () => new Map(cycle09LabIds.map((id) => [
    id,
    readJson(`public/labs/${id}.json`),
  ]));

const deriveProjection = ({
  sourceRegistry = readJson("docs/architecture/source-trace-registry.json"),
  techniquesById = currentTechniqueMap(),
  labsById = currentLabMap(),
} = {}) => deriveCycle09CurrentSourceProjection({
  registry: readJson("src/domain/atomRegistry.json"),
  sourceRegistry,
  techniquesById,
  labsById,
});

test("Cycle 09 semantic projection follows current source rather than mutable audit context", () => {
  const initial = deriveProjection();
  const sourceRow = initial.sourceRows.find((row) => row.owner.startsWith("technique:") && row.sourceFile);
  assert.ok(sourceRow, "fixture should include a source-traced Cycle 09 action");

  const [ownerType, ownerId] = sourceRow.owner.split(":");
  const amendedRegistry = structuredClone(readJson("docs/architecture/source-trace-registry.json"));
  const trace = amendedRegistry.traces.find((candidate) =>
    candidate.ownerType === ownerType && candidate.ownerId === ownerId && candidate.actionId === sourceRow.actionId);
  assert.ok(trace, "source projection row should map to an exact source-registry row");
  trace.sourceFile = "current-source-projection-fixture.md";

  const amended = deriveProjection({ sourceRegistry: amendedRegistry });
  const amendedRow = amended.sourceRows.find((row) => row.rowId === sourceRow.rowId);
  assert.equal(amendedRow.sourceFile, "current-source-projection-fixture.md");
  assert.equal(amended.baselineRows, undefined);
  assert.equal(amended.observedContractDependencies, undefined);
  assert.deepEqual(amended.owners, [
    "lab:hand-warmer-calorimetry",
    "lab:equilibrium-rainbow-display",
    "technique:hand-warmer-calorimetry",
    "technique:equilibrium-rainbow-inquiry",
  ]);
});

test("Cycle 09 reconciliation row counts follow a changed current source, not serialized rows", () => {
  const techniquesById = currentTechniqueMap();
  const initial = deriveProjection({ techniquesById });
  const initialInputs = deriveCycle09ReconciliationInputs(initial);
  const techniqueId = cycle09TechniqueIds[0];
  const amendedTechnique = structuredClone(techniquesById.get(techniqueId));
  const templateAction = structuredClone(amendedTechnique.actions[0]);
  templateAction.id = `${templateAction.id}-current-rowcount-regression`;
  templateAction.label = `${templateAction.label} current row-count regression`;
  amendedTechnique.actions.push(templateAction);
  const changedTechniquesById = new Map(techniquesById);
  changedTechniquesById.set(techniqueId, amendedTechnique);

  const changed = deriveProjection({ techniquesById: changedTechniquesById });
  const changedInputs = deriveCycle09ReconciliationInputs(changed);
  assert.equal(
    changedInputs.rowsForOverlay(sourceOverlayFile).length,
    initialInputs.rowsForOverlay(sourceOverlayFile).length + 1,
  );
  assert.equal(
    changedInputs.rowsForOverlay(atomicOverlayFile).length,
    initialInputs.rowsForOverlay(atomicOverlayFile).length + 1,
  );
  assert.equal(
    changedInputs.overlayMatchesCurrentSource(sourceOverlayFile, initialInputs.rowsForOverlay(sourceOverlayFile)),
    false,
    "a serialized pre-change row set must not be accepted after current source changes",
  );
});

test("Cycle 09 current owners do not fall back to a removed serialized row", () => {
  const techniquesById = currentTechniqueMap();
  const initial = deriveProjection({ techniquesById });
  const initialInputs = deriveCycle09ReconciliationInputs(initial);
  const retiredRow = initial.sourceRows.find((row) => row.owner.startsWith("technique:"));
  assert.ok(retiredRow, "fixture should include a current technique row");

  const techniqueId = retiredRow.owner.slice("technique:".length);
  const amendedTechnique = structuredClone(techniquesById.get(techniqueId));
  amendedTechnique.actions = amendedTechnique.actions.filter((action) => action.id !== retiredRow.actionId);
  const removedTechniquesById = new Map(techniquesById);
  removedTechniquesById.set(techniqueId, amendedTechnique);

  const removed = deriveProjection({ techniquesById: removedTechniquesById });
  const removedInputs = deriveCycle09ReconciliationInputs(removed);
  const lookup = removedInputs.rowForOverlay({
    file: sourceOverlayFile,
    owner: retiredRow.owner,
    actionId: retiredRow.actionId,
  });
  assert.equal(lookup.applies, true);
  assert.equal(lookup.row, undefined);
  assert.equal(
    removedInputs.rowsForOverlay(sourceOverlayFile).some((row) => row.rowId === retiredRow.rowId),
    false,
  );
  assert.equal(
    removedInputs.overlayMatchesCurrentSource(sourceOverlayFile, initialInputs.rowsForOverlay(sourceOverlayFile)),
    false,
  );
});

test("Cycle 09 rejects tampered serialized semantic evidence through the independent exactness gate", () => {
  const inputs = deriveCycle09ReconciliationInputs(deriveProjection());
  const tamperedRows = structuredClone(inputs.rowsForOverlay(sourceOverlayFile));
  tamperedRows[0].rationale = "tampered serialized evidence";
  assert.equal(inputs.overlayMatchesCurrentSource(sourceOverlayFile, tamperedRows), false);

  const checker = readFileSync(join(appRoot, "scripts/checkCycle09Composition.mjs"), "utf8");
  assert.match(checker, /overlayMatchesCurrentSource/);
});

test("Cycle 12 reconciliation is wired to current lane 09 inputs for summaries and lookups", () => {
  const reconciler = readFileSync(join(appRoot, "scripts/reconcileCycle12Catalog.mjs"), "utf8");
  assert.match(reconciler, /deriveCycle09ReconciliationInputs/);
  assert.match(reconciler, /semanticRowOrigins/);
  assert.match(reconciler, /if \(currentCycle09Row\.applies\) return currentCycle09Row\.row;/);
});
