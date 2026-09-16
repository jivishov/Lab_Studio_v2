import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  cycle09LabIds,
  cycle09TechniqueIds,
  deriveCycle09CurrentSourceProjection,
} from "./cycle09CurrentSourceProjection.mjs";

// Cycle 09 owns only the hand-warmer and equilibrium composition overlays. The
// semantic rows are projected from current source in a shared helper. The
// coordinator-owned audit matrices remain recorded as observed historical
// context below, but cannot change the current source projection itself.
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const planRoot = "planning/2026-08-30_lab-studio-technique-composition-remediation";
const laneRoot = join(root, planRoot, "evidence", "lane-09");
mkdirSync(laneRoot, { recursive: true });

const read = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));
const sha256 = (path) => createHash("sha256").update(readFileSync(join(root, path))).digest("hex");
const write = (name, value) => writeFileSync(join(laneRoot, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`);

const baselinePath = `${planRoot}/evidence/CYCLE_08_PLUS_SHARED_CONTRACT_BASELINE_REVISION_9.json`;
const baseline = read(baselinePath);
const registry = read("src/domain/atomRegistry.json");
const traces = read("docs/architecture/source-trace-registry.json");
const techniqueAudit = read(`${planRoot}/TECHNIQUE_ATOMICITY_AUDIT.json`);
const labAudit = read(`${planRoot}/LAB_COMPOSITION_AUDIT.json`);
const techniqueIds = [...cycle09TechniqueIds];
const labIds = [...cycle09LabIds];
const techniques = new Map(techniqueIds.map((id) => [id, read(`public/techniques/${id}.json`)]));
const labs = new Map(labIds.map((id) => [id, read(`public/labs/${id}.json`)]));
const projection = deriveCycle09CurrentSourceProjection({
  registry,
  sourceRegistry: traces,
  techniquesById: techniques,
  labsById: labs,
});

// The lane pins the reviewed-frozen revision-9 manifest, but the shared audit matrices it
// reconciles against are coordinator-owned and later cycles regenerate them in place. Record what
// this run actually read next to what the manifest froze, and name any matrix that has moved, so a
// regenerated overlay can never claim a frozen identity it did not observe.
const observed = {
  techniqueAtomicityAuditSha256: sha256(`${planRoot}/TECHNIQUE_ATOMICITY_AUDIT.json`),
  labCompositionAuditSha256: sha256(`${planRoot}/LAB_COMPOSITION_AUDIT.json`),
  sourceTraceRegistrySha256: sha256("docs/architecture/source-trace-registry.json"),
};
const contractDrift = Object.entries(observed)
  .filter(([key, value]) => baseline.contractDependencies[key] !== value)
  .map(([key, value]) => ({ dependency: key, frozen: baseline.contractDependencies[key] ?? null, observed: value }));

const identity = {
  baselineRevision: baseline.baselineRevision,
  baselineManifestPath: baselinePath,
  baselineManifestSha256: sha256(baselinePath),
  baselineAggregateSha256: baseline.source.gitTreeListingSha256,
  baselineSourceCommit: baseline.source.commit,
  baselineLabStudioTree: baseline.source.labStudioTree,
  baselineGitTreeListingSha256: baseline.source.gitTreeListingSha256,
  baselineDisposition: "Reviewed-frozen revision 9 worktree-ref identity; this lane is additive and does not mutate the manifest.",
  frozenTechniqueAuditSha256: baseline.contractDependencies.techniqueAtomicityAuditSha256,
  frozenLabAuditSha256: baseline.contractDependencies.labCompositionAuditSha256,
  frozenRegistrySha256: baseline.contractDependencies.sourceTraceRegistrySha256,
  contractDependencies: baseline.contractDependencies,
  observedContractDependencies: observed,
  contractDrift,
  contractDriftDisposition: contractDrift.length === 0
    ? "Every shared matrix this run read still carries its frozen revision-9 identity."
    : "A coordinator-owned matrix moved after this lane was frozen. Reconciliation rows below are derived from the matrix actually on disk, not from the frozen copy; the coordinator owns closing the drift.",
};
const header = (schema) => ({
  schema: `lab-studio/${schema}@1`, lane: "09", ...identity, owners: projection.owners,
  validationBoundary: "Source/static evidence only; runtime, browser, detailed tests, build, and physical validation intentionally not run.",
});

const baselineReconcile = (row, currentActions) => {
  const current = currentActions.filter((action) => action.id === row.actionId).map((action) => action.id);
  return {
    rowId: row.rowId,
    originalOwner: row.techniqueId ? `technique:${row.techniqueId}` : `lab:${row.labId}`,
    originalActionId: row.actionId,
    replacementActionIds: current,
    disposition: current.length
      ? "Reconciled to the current named operation; source/static scope only."
      : "Retired historical anonymous row; current exact-version composition provenance replaces the old owner/action identity.",
    sourceSubsetLimitation: "Revision-9 audit row is preserved for reconciliation; this overlay does not rewrite the frozen matrix.",
    evaluated: true,
  };
};
const relevantTechniqueBaseline = techniqueAudit.rows
  .filter((row) => techniqueIds.includes(row.techniqueId) || row.finalOwningCycle === "09")
  .map((row) => baselineReconcile(row, techniques.get(row.techniqueId)?.actions ?? []));
const relevantLabBaseline = labAudit.rows
  .filter((row) => labIds.includes(row.labId) && (row.laterOwnerCycle === "09" || row.requiredRemediation?.includes("Cycle 09")))
  .map((row) => baselineReconcile(row, labs.get(row.labId)?.actions ?? []));

write("source-trace-overlay", {
  ...header("source-trace-overlay"),
  rows: projection.sourceRows,
  sourcePolicy: "Source-derived physical actions use exact registry rows; simulator/configuration carriers and lab orchestration carry explicit C/non-source dispositions. A row that acquires a measurement or direct observation without an exact registry row is never given a C basis; it is reported below as untraced-acquisition debt for the coordinator, because the shared registry is outside this lane.",
  untracedAcquisitionRowIds: projection.untracedAcquisitionRowIds,
});
write("technique-atomicity-overlay", {
  ...header("technique-atomicity-overlay"),
  rows: projection.atomicRows,
  baselineRows: relevantTechniqueBaseline,
  ownerDispositions: projection.owners.filter((owner) => owner.startsWith("technique:")).map((owner) => ({ owner, disposition: "Exact-version technique owner retained; open inquiry/configuration remains distinct from measured evidence.", evaluated: true })),
});
write("lab-composition-overlay", {
  ...header("lab-composition-overlay"),
  rows: projection.composedRows,
  baselineRows: relevantLabBaseline,
  compositionPolicy: "Rows are derived from current lab-local nodes and compiler-expanded exact-version technique instances for every default/reachability witness; no physical action is duplicated in a lab-local process.",
});

console.log(
  `Cycle 09 overlays written: ${projection.sourceRows.length} source rows, ${projection.atomicRows.length} technique actions, ` +
    `${projection.composedRows.length} composed rows ` +
    `(${projection.untracedAcquisitionRowIds.length} untraced-acquisition row(s) reported for the coordinator).`,
);
