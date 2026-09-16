import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));
const args = new Set(process.argv.slice(2));
const strict = args.has("--strict");

const operationClasses = {
  dragToZone: ["apparatus-material-instrument-state"],
  snapIntoTarget: ["apparatus-material-instrument-state"],
  pourInto: ["apparatus-material-instrument-state"],
  dispenseDrops: ["apparatus-material-instrument-state"],
  spotOnto: ["apparatus-material-instrument-state"],
  rinseTarget: ["apparatus-material-instrument-state"],
  placeInInstrument: ["apparatus-material-instrument-state"],
  readInstrument: ["measurement-direct-observation-acquisition"],
  recordTimeSeries: ["measurement-direct-observation-acquisition", "evidence-recording"],
  recordNotebook: ["evidence-recording"],
  submitCalculation: ["calculation-analysis"],
};
const defaultOperation = (action) => {
  if (action.verb === "place") {
    return action.parameters?.targetDefinitionId || action.parameters?.snapZoneId
      ? "snapIntoTarget"
      : "dragToZone";
  }
  if (action.verb === "reset") return "dragToZone";
  if (["measureVolume", "transfer", "dissolve", "precipitate", "dilute", "filter"].includes(action.verb)) return "pourInto";
  if (action.verb === "spotSample") return "spotOnto";
  if (action.verb === "developChromatogram") return "snapIntoTarget";
  if (action.verb === "rinse") return "rinseTarget";
  if (["dry", "heat", "cool"].includes(action.verb)) return "placeInInstrument";
  if (action.verb === "weigh") return "readInstrument";
  if (action.verb === "record" && action.parameters?.kineticsModelId) return "recordTimeSeries";
  if (action.verb === "stressEquilibrium") {
    return action.parameters?.sourceDefinitionId && action.parameters?.targetDefinitionId
      ? "pourInto"
      : "recordNotebook";
  }
  if (["record", "observe"].includes(action.verb)) return "recordNotebook";
  if (action.verb === "calculate") return "submitCalculation";
  return undefined;
};
const sameSet = (left = [], right = []) =>
  left.length === right.length && [...left].sort().every((value, index) => value === [...right].sort()[index]);

const ownership = readJson("planning/2026-08-30_lab-studio-technique-composition-remediation/CATALOG_OWNERSHIP.json");
const atomicity = readJson("planning/2026-08-30_lab-studio-technique-composition-remediation/TECHNIQUE_ATOMICITY_AUDIT.json");
const labAudit = readJson("planning/2026-08-30_lab-studio-technique-composition-remediation/LAB_COMPOSITION_AUDIT.json");
const atomRegistry = readJson("src/domain/atomRegistry.json");
const equipmentRoleRegistry = readJson("src/domain/equipmentRoleRegistry.json");
const sourceTraceRegistry = readJson("docs/architecture/source-trace-registry.json");
const techniqueIndex = readJson("public/techniques/index.json");
const labIndex = readJson("public/labs/index.json");

const violations = [];
const baselineDebt = [];
const report = (code, owner, detail, severity = "error") =>
  (severity === "baseline" ? baselineDebt : violations).push({ code, owner, detail });
const duplicateValues = (values) => [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];

const validateOwners = (kind, index, byCycle) => {
  const indexed = index.map((entry) => entry.id).sort();
  const owned = Object.values(byCycle).flat().sort();
  for (const id of duplicateValues(owned)) report("ownership/duplicate", `${kind}:${id}`, "Owner appears in more than one final cycle.");
  for (const id of indexed.filter((id) => !owned.includes(id))) report("ownership/missing", `${kind}:${id}`, "Indexed owner has no final cycle.");
  for (const id of owned.filter((id) => !indexed.includes(id))) report("ownership/index-drift", `${kind}:${id}`, "Ownership map names an owner absent from the public index.");
};
validateOwners("technique", techniqueIndex, ownership.techniquesByFinalCycle);
validateOwners("lab", labIndex, ownership.labsByFinalCycle);
if (techniqueIndex.length !== ownership.expectedTechniqueCount) {
  report("ownership/index-drift", "technique:index", `Expected ${ownership.expectedTechniqueCount}; found ${techniqueIndex.length}.`);
}
if (labIndex.length !== ownership.expectedLabCount) {
  report("ownership/index-drift", "lab:index", `Expected ${ownership.expectedLabCount}; found ${labIndex.length}.`);
}

const atoms = new Map();
for (const atom of atomRegistry.atoms) {
  if (atoms.has(atom.id)) report("effect/duplicate-atom", `atom:${atom.id}`, "Atom id is not unique.");
  atoms.set(atom.id, atom);
  if (!atom.effectContract || !Array.isArray(atom.effectContract.classes) || atom.effectContract.classes.length === 0) {
    report("effect/atom-contract-missing", `atom:${atom.id}`, "Every atom requires exactly one canonical effectContract.");
  }
}
const equipmentRoleIds = new Set(equipmentRoleRegistry.roles.map((role) => role.id));
const sourceTraceCounts = new Map();
for (const trace of sourceTraceRegistry.traces) {
  const key = `${trace.ownerType}:${trace.ownerId}#${trace.actionId}`;
  sourceTraceCounts.set(key, (sourceTraceCounts.get(key) ?? 0) + 1);
}
const nonSourceOwners = new Set(sourceTraceRegistry.nonSourceDerivedOwners.map((entry) => entry.owner));
const cycle04TechniqueIds = new Set(ownership.techniquesByFinalCycle["04"] ?? []);
const reviewedSplitRows = new Set([
  "equilibrium-rainbow-inquiry@2.2.0#iron-add-five-drops",
  "marble-gas-syringe-kinetics@1.1.0#gas-technique-zero-syringe",
]);

const atomicRows = new Map();
for (const row of atomicity.rows) {
  if (atomicRows.has(row.rowId)) report("audit/duplicate-row", row.rowId, "Atomicity row is duplicated.");
  atomicRows.set(row.rowId, row);
  if (!row.atomicity?.verdict || !row.techniqueMatchDecision || !row.finalOwningCycle) {
    report("audit/unevaluated-row", row.rowId, "Atomicity decision, technique match, or final owner is missing.");
  }
  const completeAtomicityRow = row.actionLabel && row.actionVerb && Array.isArray(row.reachableTechniqueNodeConsumers) &&
    row.coverage && row.effect?.registryHandlerDerivedClasses && row.effect?.typedTargetDomains && row.atomicity?.persistentStateTransition &&
    row.atomicity?.prerequisites && row.atomicity?.invalidUnsafeCases && row.atomicity?.evidenceBoundary && row.atomicity?.recoveryBoundary &&
    row.sourceDisposition?.applicableSourceClaims && row.sourceDisposition?.governingAuthorityAndRationale;
  if (!completeAtomicityRow) report("audit/incomplete-atomicity-row", row.rowId, "Full Cycle 01 atomicity/source/effect row detail is required.");
}

const labRows = new Map();
for (const row of labAudit.rows) {
  if (labRows.has(row.rowId)) report("audit/duplicate-row", row.rowId, "Lab composition row is duplicated.");
  labRows.set(row.rowId, row);
  if (!row.complianceVerdict || !row.reachability || !row.requiredRemediation) {
    report("audit/unevaluated-row", row.rowId, "Composition verdict, reachability, or remediation is missing.");
  }
  if (!row.processId || !Array.isArray(row.validConfigurationApprovalWitnesses) || !row.effect?.registryHandlerDerivedClasses ||
    !row.effect?.typedTargetDomains || !row.techniqueMatchEscalation || !row.sourceConflictOrConfigurationBlock) {
    report("audit/incomplete-lab-row", row.rowId, "Full Cycle 01 process/witness/effect/match/source row detail is required.");
  }
  if (row.complianceVerdict === "anonymous-local-procedure") {
    report("composition/anonymous-procedural-action", row.rowId, row.requiredRemediation, "baseline");
  }
  if (row.reachability === "dead") {
    report("composition/dead-under-all-witnesses", row.rowId, row.requiredRemediation, "baseline");
  }
}

const currentTechniqueRows = [];
for (const entry of techniqueIndex) {
  const definition = readJson(`public/techniques/${entry.file ?? `${entry.id}.json`}`);
  for (const action of definition.actions ?? []) {
    const rowId = `${definition.id}@${definition.metadata?.version}#${action.id}`;
    currentTechniqueRows.push(rowId);
    if (!atomicRows.has(rowId)) report("audit/missing-atomicity-row", rowId, "Current indexed action is absent from the Cycle 01 matrix.");
    if (action.atomId && !atoms.has(action.atomId)) report("effect/unknown-atom", rowId, `Unknown atom ${action.atomId}.`);
    const row = atomicRows.get(rowId);
    if (!row) continue;
    const atom = action.atomId ? atoms.get(action.atomId) : undefined;
    const roleBindingIds = Object.keys(action.equipmentRoleBindings ?? {});
    const missingRequiredRoles = atom ? atom.requiredRoles.filter((roleId) => !roleBindingIds.includes(roleId)) : [];
    const roleRegistryComplete = roleBindingIds.every((roleId) => equipmentRoleIds.has(roleId));
    if (row.coverage.atomRegistryEntryPresent !== Boolean(atom) || row.coverage.equipmentRoleRegistryEntriesPresent !== roleRegistryComplete || !sameSet(row.coverage.missingRequiredRoles, missingRequiredRoles)) {
      report("audit/coverage-drift", rowId, "Atom or equipment-role coverage no longer matches the current registries.");
    }
    const sourceKey = `technique:${definition.id}#${action.id}`;
    const expectedTraceCount = sourceTraceCounts.get(sourceKey) ?? 0;
    const expectedSourceStatus = expectedTraceCount > 0
      ? "source-traced"
      : cycle04TechniqueIds.has(definition.id)
        ? "cycle-04-reviewed-r-c-contract"
        : nonSourceOwners.has(`technique:${definition.id}`)
          ? "declared-non-source-derived"
          : "source-trace-missing";
    if (row.coverage.sourceTraceCount !== expectedTraceCount || row.coverage.sourceStatus !== expectedSourceStatus) {
      report("audit/source-coverage-drift", rowId, `Expected ${expectedTraceCount}/${expectedSourceStatus}; found ${row.coverage.sourceTraceCount}/${row.coverage.sourceStatus}.`);
    }
    const operation = action.interaction?.type ?? defaultOperation(action);
    const expectedClasses = operationClasses[operation] ?? ["pedagogical-orchestration"];
    if (!sameSet(row.effect.registryHandlerDerivedClasses, expectedClasses) || row.effect.resolvedInteractionType !== (operation ?? null)) {
      report("audit/effect-derivation-drift", rowId, `Handler ${operation ?? "none"} no longer matches the audited effect classes.`);
    }
    const shouldSplit = reviewedSplitRows.has(rowId);
    if ((row.atomicity.verdict === "split") !== shouldSplit || (shouldSplit && row.atomicity.proposedChildOperations.length < 2)) {
      report("audit/atomic-split-drift", rowId, "Reviewed split identity or ordered child operations changed.");
    }
  }
}
for (const rowId of atomicRows.keys()) {
  if (!currentTechniqueRows.includes(rowId)) report("audit/stale-atomicity-row", rowId, "Matrix row no longer maps to an indexed technique action.");
}

const currentLabRows = [];
for (const entry of labIndex) {
  const definition = readJson(`public/labs/${entry.file ?? `${entry.id}.json`}`);
  const actionById = new Map((definition.actions ?? []).map((action) => [action.id, action]));
  const effectiveNodes = [...(definition.process?.nodes ?? [])];
  if (definition.techniqueInstances) {
    for (const instance of definition.techniqueInstances) {
      const techniqueEntry = techniqueIndex.find((candidate) => candidate.id === instance.techniqueId);
      if (!techniqueEntry) continue;
      const technique = readJson(`public/techniques/${techniqueEntry.file ?? `${techniqueEntry.id}.json`}`);
      const repeat = instance.repeat ?? 1;
      for (let repeatIndex = 0; repeatIndex < repeat; repeatIndex += 1) {
        const scopeId = repeat === 1 ? instance.instanceId : `${instance.instanceId}--${repeatIndex + 1}`;
        for (const node of technique.process?.nodes ?? []) {
          effectiveNodes.push({
            ...node,
            id: instance.preserveIds?.nodes?.[node.id] ?? `${scopeId}--${node.id}`,
            actionId: node.actionId
              ? instance.preserveIds?.actions?.[node.actionId] ?? `${scopeId}--${node.actionId}`
              : undefined,
          });
        }
      }
    }
  }
  for (const node of effectiveNodes) {
    if (!node.actionId) continue;
    const rowId = `${definition.id}#${node.id}`;
    currentLabRows.push(rowId);
    if (!labRows.has(rowId)) report("audit/missing-lab-row", rowId, "Current bundled process row is absent from the Cycle 01 matrix.");
  }
  if (definition.techniqueInstances) {
    if (definition.techniqueRefs) report("composition/source-discriminator-conflict", `lab:${definition.id}`, "techniqueRefs and techniqueInstances coexist.");
    if (definition.compositionManifest) report("composition/spoofed-origin", `lab:${definition.id}`, "Raw composition source asserts a compiler-issued manifest.");
    for (const action of definition.actions ?? []) {
      const owner = `lab:${definition.id}#${action.id}`;
      if (!action.effect) {
        report("composition/untyped-local-action", owner, "Composed lab-local action has no typed effect declaration.");
        continue;
      }
      const operation = action.interaction?.type ?? defaultOperation(action);
      const derived = operationClasses[operation] ?? [];
      const handlerClasses = action.effect.classes.filter((effectClass) =>
        effectClass !== "pedagogical-orchestration");
      if (!sameSet(handlerClasses, derived)) {
        report("effect/local-declaration-conflict", owner, `Declared ${action.effect.classes?.join(",")}; handler ${operation} derives ${derived.join(",")}.`);
      }
      if (derived.some((effectClass) => effectClass === "apparatus-material-instrument-state" || effectClass === "measurement-direct-observation-acquisition")) {
        report("composition/anonymous-procedural-action", owner, "Lab-local handler derives a technique-only effect class.");
      }
      if ((action.effect.targets ?? []).some((target) => ["equipment", "material", "instrument", "measurement-observation", "model"].includes(target.domain))) {
        report("effect/local-technique-target", owner, "Lab-local action declares a technique-only target domain.");
      }
    }
    for (const instance of definition.techniqueInstances) {
      if (!instance.version) report("composition/missing-version", `lab:${definition.id}#${instance.instanceId}`, "Technique instance is not exact-version pinned.");
      if (instance.enabledWhen && !(definition.reachabilityWitnesses ?? []).some((witness) => {
        const predicate = instance.enabledWhen;
        return predicate.kind === "approval"
          ? witness.approvalGates?.[`${predicate.instanceId}.${predicate.gateId}`] === predicate.equals
          : witness.configuration?.[`${predicate.instanceId}.${predicate.slotId}`] === predicate.equals;
      })) report("composition/dead-under-all-witnesses", `lab:${definition.id}#${instance.instanceId}`, "No declared witness enables this instance.");
    }
  }
  if (definition.compositionManifest) {
    const origins = new Map(definition.compositionManifest.origins.map((origin) => [origin.actionId, origin]));
    for (const node of definition.process?.nodes ?? []) {
      const action = actionById.get(node.actionId);
      if (!action) continue;
      const procedural = action.effect?.classes?.some((item) =>
        item === "apparatus-material-instrument-state" || item === "measurement-direct-observation-acquisition");
      if (procedural && !origins.has(action.id)) report("composition/spoofed-or-missing-origin", `lab:${definition.id}#${action.id}`, "Procedural compiled action lacks a compiler origin row.");
    }
    const used = new Set((definition.process?.nodes ?? []).map((node) => node.actionId).filter(Boolean));
    for (const actionId of origins.keys()) {
      if (!used.has(actionId)) report("composition/selected-variant-unused-output", `lab:${definition.id}#${actionId}`, "Compiler origin is emitted but unused.");
    }
  }
}
for (const rowId of labRows.keys()) {
  if (!currentLabRows.includes(rowId)) report("audit/stale-lab-row", rowId, "Matrix row no longer maps to a bundled root node/action.");
}

const reviewedConditionalRows = [
  "hand-warmer-calorimetry#p1-c07-measurement-node",
  "quick-ache-relief-separation#qar-recover-from-emulsion-node",
];
const currentConditionalRows = labAudit.rows.filter((row) => row.reachability === "conditional").map((row) => row.rowId).sort();
if (!sameSet(currentConditionalRows, reviewedConditionalRows)) {
  report("audit/reachability-drift", "lab-audit", `Expected the two reviewed conditional rows; found ${currentConditionalRows.join(", ") || "none"}.`);
}
const reviewedUnreferencedRows = [
  "crystal-violet-rate-law#cv11-extension-approval-gate",
  "crystal-violet-rate-law#cv11-extension-design-hydroxide-series",
  "crystal-violet-rate-law#cv11-extension-determine-z-and-k",
];
const currentUnreferencedRows = (labAudit.unreferencedDeclaredActions ?? []).map((row) => `${row.labId}#${row.actionId}`).sort();
if (!sameSet(currentUnreferencedRows, reviewedUnreferencedRows)) {
  report("audit/unreferenced-action-drift", "lab-audit", `Expected the three current declared-but-unreferenced actions; found ${currentUnreferencedRows.join(", ") || "none"}.`);
}
if (atomicity.inventory.actionRows !== atomicity.rows.length || atomicity.inventory.uniqueRowIds !== atomicRows.size ||
  labAudit.inventory.nodeActionRows !== labAudit.rows.length || labAudit.inventory.uniqueRowIds !== labRows.size ||
  labAudit.inventory.unreferencedDeclaredActionCount !== currentUnreferencedRows.length) {
  report("audit/inventory-drift", "audit-matrices", "Stored inventory totals do not match detailed audit rows.");
}
const cycle04Rows = atomicity.rows.filter((row) => row.finalOwningCycle === "04");
if (cycle04Rows.filter((row) => row.atomicity.verdict === "keep").length !== 23 ||
  cycle04Rows.filter((row) => row.atomicity.verdict === "nonphysical").length !== 7 ||
  cycle04Rows.some((row) => row.atomicity.verdict === "blocked-for-source/configuration" || row.atomicity.verdict === "split")) {
  report("audit/cycle-04-closure-drift", "cycle:04", "Expected 23 reviewed physical keeps, 7 nonphysical rows, and no blocked/split Cycle 04 rows.");
}

const byOwnerCycle = {};
for (const row of atomicity.rows) byOwnerCycle[row.finalOwningCycle] = (byOwnerCycle[row.finalOwningCycle] ?? 0) + 1;
const result = {
  schema: "lab-studio/technique-composition-audit-result@1",
  strict,
  inventory: {
    techniques: techniqueIndex.length,
    labs: labIndex.length,
    atoms: atomRegistry.atoms.length,
    techniqueActionRows: currentTechniqueRows.length,
    labNodeActionRows: currentLabRows.length,
  },
  differences: {
    violations: violations.sort((a, b) => `${a.code}/${a.owner}`.localeCompare(`${b.code}/${b.owner}`)),
    baselinedRemediationRows: baselineDebt.sort((a, b) => a.owner.localeCompare(b.owner)),
    techniqueRowsByFinalOwnerCycle: Object.fromEntries(Object.entries(byOwnerCycle).sort()),
  },
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (violations.length > 0 || (strict && baselineDebt.length > 0)) process.exitCode = 1;
