/**
 * Cycle 12 narrow source/static verifier.
 *
 * This verifies the deterministic reconciliation outputs and public composition shape. It does
 * not start the application, invoke a test runner, build, browse, or claim physical fidelity.
 *
 * Counts are recomputed from the public catalog and the compiler witness rather than compared to
 * literals copied out of the audits: asserting that an audit agrees with a number transcribed from
 * that same audit proves nothing, and it let the audits go stale against the catalog unnoticed.
 *
 * Usage:
 *   node scripts/verifyCycle12ScientificActivities.mjs
 *   node scripts/verifyCycle12ScientificActivities.mjs --json
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const jsonOutput = process.argv.includes("--json");
const readJson = (relativePath) => JSON.parse(readFileSync(join(root, relativePath), "utf8"));
const readText = (relativePath) => readFileSync(join(root, relativePath), "utf8");
const checks = [];
const check = (name, passed, detail = "") => checks.push({ name, passed: Boolean(passed), detail });
const planRoot = "planning/2026-08-30_lab-studio-technique-composition-remediation";
const report = readJson(`${planRoot}/evidence/lane-12/RECONCILIATION_REPORT.json`);
const compileWitness = readJson(`${planRoot}/evidence/lane-12/COMPILED_LAB_WITNESS.json`);
const techniqueAudit = readJson(`${planRoot}/TECHNIQUE_ATOMICITY_AUDIT.json`);
const labAudit = readJson(`${planRoot}/LAB_COMPOSITION_AUDIT.json`);
const ownership = readJson(`${planRoot}/CATALOG_OWNERSHIP.json`);
const formalAmendment = readJson(`${planRoot}/evidence/CYCLE_10_SHARED_CONTRACT_BASELINE_REVISION_10.json`);
const techniqueIndex = readJson("public/techniques/index.json");
const labIndex = readJson("public/labs/index.json");
const closure = readText("docs/technique-composition-closure.md");

const techniques = techniqueIndex.map((entry) => readJson(`public/techniques/${entry.file ?? `${entry.id}.json`}`));
const labs = labIndex.map((entry) => readJson(`public/labs/${entry.file ?? `${entry.id}.json`}`));
// Independent expectations, derived from the catalog and the compiler witness.
const expectedTechniqueActionRows = techniques.reduce((sum, technique) => sum + technique.actions.length, 0);
const expectedLabNodeRows = compileWitness.labs.reduce((sum, lab) => sum + lab.nodes.length, 0);
const expectedWitnessCompiles = labs.reduce((sum, lab) => sum + (lab.reachabilityWitnesses?.length ?? 0), 0);
const ownedTechniqueIds = Object.values(ownership.techniquesByFinalCycle).flat();
const ownedLabIds = Object.values(ownership.labsByFinalCycle).flat();

check("reconciliation is source/static accepted with no errors", report.status === "accepted-source-static" && report.errors.length === 0, `${report.status}; ${report.errors.length} error(s)`);
check(
  "fixed lane merge order is preserved",
  JSON.stringify(report.fixedReconciliationOrder) === JSON.stringify(["05", "06", "07", "08", "09", "11", "10"]),
  JSON.stringify(report.fixedReconciliationOrder),
);
check(
  "public technique inventory matches the ownership map plus the route-only carrier",
  techniqueIndex.length === ownership.expectedTechniqueCount + 1 &&
    report.catalog.indexedTechniqueCount === techniqueIndex.length &&
    techniqueAudit.inventory.indexedTechniques === techniqueIndex.length,
  `${techniqueIndex.length} indexed, ${ownership.expectedTechniqueCount} owned`,
);
check(
  "ownership inventory is unique and one route-only carrier is unowned",
  new Set(ownedTechniqueIds).size === ownedTechniqueIds.length &&
    new Set(ownedLabIds).size === ownedLabIds.length &&
    report.catalog.ownedTechniqueCount === ownership.expectedTechniqueCount &&
    report.catalog.routeOnlyTechniqueIds?.length === 1,
  JSON.stringify(report.catalog.routeOnlyTechniqueIds),
);
check(
  "public lab inventory matches the ownership map",
  labIndex.length === ownership.expectedLabCount &&
    report.catalog.indexedLabCount === labIndex.length &&
    labAudit.inventory.indexedLabs === labIndex.length,
  `${labIndex.length} indexed, ${ownership.expectedLabCount} owned`,
);
check(
  "technique audit accounts for every current catalog action",
  techniqueAudit.inventory.actionRows === expectedTechniqueActionRows &&
    techniqueAudit.inventory.uniqueRowIds === expectedTechniqueActionRows &&
    techniqueAudit.rows.length === expectedTechniqueActionRows,
  `${techniqueAudit.inventory.actionRows} rows for ${expectedTechniqueActionRows} catalog actions`,
);
check(
  "lab audit accounts for every compiler-witness node across every valid witness",
  labAudit.inventory.nodeActionRows === expectedLabNodeRows &&
    labAudit.inventory.uniqueRowIds === expectedLabNodeRows &&
    labAudit.rows.length === expectedLabNodeRows,
  `${labAudit.inventory.nodeActionRows} rows for ${expectedLabNodeRows} union nodes`,
);
check(
  "every declared reachability witness was compiled",
  compileWitness.totals.witnessCompileCount === expectedWitnessCompiles &&
    labAudit.inventory.witnessCompileCount === expectedWitnessCompiles &&
    compileWitness.labs.every((lab) => lab.witnessCompiles.length === lab.reachabilityWitnessIds.length),
  `${compileWitness.totals.witnessCompileCount} compiles for ${expectedWitnessCompiles} declared witnesses`,
);
check(
  "every declared technique instance compiles under some valid witness",
  report.compilerWitness.everyDeclaredInstanceCompiledUnderSomeWitness === true &&
    compileWitness.labs.every((lab) => lab.unionTechniqueInstanceIds.length === lab.sourceTechniqueInstanceCount),
);
check("technique effects and source decisions are complete", techniqueAudit.inventory.effectConflictRows === 0 && techniqueAudit.inventory.missingAtomOrEffectRows === 0);
check(
  "lab origins, local compliance, and reachability are clean",
  labAudit.inventory.effectConflictRows === 0 &&
    labAudit.inventory.complianceCounts["anonymous-local-procedure"] === 0 &&
    labAudit.inventory.complianceCounts["missing-origin"] === 0 &&
    labAudit.inventory.reachabilityCounts["dead-under-witness"] === 0 &&
    labAudit.inventory.unreferencedDeclaredActionCount === 0,
  JSON.stringify({ compliance: labAudit.inventory.complianceCounts, reachability: labAudit.inventory.reachabilityCounts }),
);
check(
  "compiler witness covers all labs and explicit initial equipment",
  report.compilerWitness.labCount === labIndex.length &&
    report.compilerWitness.allLabsEmitCompiledManifest === true &&
    report.compilerWitness.explicitInitialEquipment === true,
);
check(
  "custom route control maps are complete",
  Array.isArray(report.customRoutes) && report.customRoutes.length === 2 &&
    report.customRoutes.every((route) => route.everyControlMappedExactlyOnce === true && route.noHiddenExpectedAnswers === true && route.duplicateControlIds.length === 0),
  JSON.stringify(report.customRoutes?.map((route) => ({ lane: route.lane, controls: route.controlCount }))),
);
check(
  "formal route amendment is recorded with its authoritative candidate state",
  report.baseline?.formalAmendment?.revision === 10 &&
    formalAmendment.baselineRevision === 10 &&
    formalAmendment.state === "candidate-not-frozen" &&
    formalAmendment.candidate === true &&
    report.baseline.formalAmendment.state === formalAmendment.state,
  `report=${report.baseline?.formalAmendment?.state}; formal-amendment=${formalAmendment.state}`,
);
check(
  "predecessor source dispositions come from the frozen pinned projection",
  report.baseline?.frozenPredecessorSourceDisposition?.sourceSha256 ===
    readJson(`${planRoot}/evidence/lane-12/FROZEN_PREDECESSOR_SOURCE_DISPOSITION.json`).sourceSha256,
  report.baseline?.frozenPredecessorSourceDisposition?.sourceSha256,
);
check("public labs use techniqueInstances and no legacy techniqueRefs", labs.every((lab) =>
  Array.isArray(lab.techniqueInstances) && lab.techniqueInstances.length > 0 &&
    lab.techniqueRefs === undefined && lab.compositionManifest === undefined));
check(
  "public manifests carry no build-time locators, hashes, or provider handles",
  [...techniques, ...labs].every((entry) =>
    !/"(sourceFile|sourceTable|sourceLocator|providerHandle|apiKey|answerKey|expectedAnswer)"\s*:/.test(JSON.stringify(entry)) &&
    !/([A-Za-z]:\\\\|file:\/\/|node_modules)/.test(JSON.stringify(entry))),
);
// The residual counts must be recomputed and republished, so a future regeneration cannot quietly
// report a clean catalog while physical actions still lack an atom row.
const atomlessPhysicalRows = techniqueAudit.rows.filter((row) =>
  ["physical-without-atom", "acquisition-without-atom"].includes(row.atomicity.verdict)).length;
const untracedAcquisitionRows = techniqueAudit.rows.filter((row) => row.sourceDisposition.traceDebt).length;
check(
  "atomic-identity residual debt is counted and disclosed",
  techniqueAudit.inventory.atomlessPhysicalRows === atomlessPhysicalRows &&
    techniqueAudit.rubric.residualDebt.atomlessPhysicalRowIds.length === atomlessPhysicalRows &&
    closure.includes(`${atomlessPhysicalRows} technique rows with a physical or acquisitive effect contract but no atom registry row`) &&
    (atomlessPhysicalRows === 0) === (report.consistency.atomicIdentityCoverage === "pass"),
  `${atomlessPhysicalRows} rows; ${report.consistency.atomicIdentityCoverage}`,
);
check(
  "source-trace residual debt is counted and disclosed",
  techniqueAudit.inventory.untracedAcquisitionRows === untracedAcquisitionRows &&
    techniqueAudit.inventory.unreviewedBaselineConflicts === 0 &&
    closure.includes(`${untracedAcquisitionRows} lane-escalated untraced-acquisition rows`) &&
    (untracedAcquisitionRows === 0 && techniqueAudit.inventory.declaredSourceConflictRows === 0) ===
      (report.consistency.sourceTraceCoverage === "pass"),
  `${untracedAcquisitionRows} untraced; ${techniqueAudit.inventory.declaredSourceConflictRows} declared conflicts; ${report.consistency.sourceTraceCoverage}`,
);
check(
  "every declared source conflict carries a confirmation point",
  techniqueAudit.rows.every((row) => !row.sourceDisposition.conflict || Boolean(row.sourceDisposition.unresolvedConfirmationPoint)),
);
const unboundMassOutputRows = techniqueAudit.rows.filter((row) =>
  String(row.atomicity.massOutputBinding).startsWith("unbound")).length;
check(
  "unbound weighing mass outputs are counted and disclosed",
  techniqueAudit.inventory.unboundMassOutputRows === unboundMassOutputRows &&
    techniqueAudit.rubric.residualDebt.unboundMassOutputRowIds.length === unboundMassOutputRows &&
    closure.includes(`${unboundMassOutputRows} of ${techniqueAudit.inventory.weighActionRows} weighing actions with no bound mass output`) &&
    (unboundMassOutputRows === 0) === (report.consistency.massOutputBinding === "pass"),
  `${unboundMassOutputRows} of ${techniqueAudit.inventory.weighActionRows} weighing actions; ${report.consistency.massOutputBinding}`,
);
// A lab that still carries a placeholder configuration slot must appear as an open shared request
// in both the report and the closure note, so the workaround cannot be closed by omission.
const placeholderLabIds = labs
  .filter((lab) => (lab.techniqueInstances ?? []).some((instance) =>
    Object.values(instance.bindings?.configuration ?? {}).includes("unconfigured-teacher-choice")))
  .map((lab) => lab.id);
check(
  "labs with placeholder configuration are disclosed as open shared requests",
  placeholderLabIds.every((labId) =>
    report.openSharedContractRequests.some((request) => request.labId === labId) &&
    closure.includes(labId)) &&
    report.openSharedContractRequests.every((request) => placeholderLabIds.includes(request.labId)) &&
    (report.openSharedContractRequests.length === 0 || /Open shared-contract requests/.test(closure)),
  placeholderLabIds.join(", ") || "none",
);
check(
  "closure preserves the evidence boundary",
  /does not claim runtime/i.test(closure) && /intentionally unrun/i.test(closure) && /physical/i.test(closure),
);
check(
  "Cycle 07 linked review is retained without duplication",
  closure.includes("01a073d7-6520-7b42-9fbb-85fa30641716") && /was not repeated/i.test(closure),
);

const failed = checks.filter((item) => !item.passed);
if (jsonOutput) {
  console.log(JSON.stringify({ passed: failed.length === 0, checks }, null, 2));
} else {
  for (const item of checks) console.log(`${item.passed ? "PASS" : "FAIL"} ${item.name}${item.detail ? ` — ${item.detail}` : ""}`);
  console.log(`Cycle 12 static verifier: ${checks.length - failed.length}/${checks.length} checks passed.`);
}
if (failed.length > 0) process.exitCode = 1;
