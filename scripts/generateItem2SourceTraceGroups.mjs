import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const registryPath = path.join(root, "docs/architecture/source-trace-registry.json");
const atomRegistryPath = path.join(root, "src/domain/atomRegistry.json");

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
const ownerKey = (ownerType, ownerId) => `${ownerType}:${ownerId}`;
const actionKey = (owner, actionId) => `${owner}#${actionId}`;
const atomKey = (owner, atomId) => `${owner}#${atomId}`;
const groupKey = (owner, atomId, trace, actionBasis) => [
  owner,
  atomId,
  trace.sourceFile,
  trace.sourceTable,
  trace.step,
  trace.basis,
  actionBasis,
].join("|");
const slug = (value) => String(value).replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

const registry = readJson(registryPath);
const atoms = readJson(atomRegistryPath).atoms;
const atomById = new Map(atoms.map((atom) => [atom.id, atom]));
const directTraces = registry.traces ?? [];
const directTraceKeys = new Set(directTraces.map((trace) => actionKey(ownerKey(trace.ownerType, trace.ownerId), trace.actionId)));
const tracesByOwnerAtom = new Map();
for (const trace of directTraces) {
  const key = atomKey(ownerKey(trace.ownerType, trace.ownerId), trace.atomId);
  const rows = tracesByOwnerAtom.get(key) ?? [];
  rows.push(trace);
  tracesByOwnerAtom.set(key, rows);
}

const sourceOwnerGroups = new Map();
for (const group of registry.sourceDerivedOwners ?? []) {
  for (const owner of group.owners ?? []) sourceOwnerGroups.set(owner, group);
}

const definitions = new Map();
for (const directory of ["public/techniques", "public/labs"]) {
  const ownerType = directory === "public/techniques" ? "technique" : "lab";
  for (const file of fs.readdirSync(path.join(root, directory)).filter((candidate) => candidate.endsWith(".json"))) {
    const definition = readJson(path.join(root, directory, file));
    definitions.set(ownerKey(ownerType, definition.id), definition);
  }
}

const actionBasisFor = (action) => {
  const parameters = action.parameters ?? {};
  if (
    parameters.inputRole === "teacherConfiguration" ||
    parameters.configurationChoice === true ||
    action.sourceInventory
  ) return "C";
  if (
    action.verb === "weigh" ||
    action.verb === "record" ||
    /\.(measure|read|record)-/.test(action.atomId ?? "")
  ) return "M";
  return "R/C";
};

const groups = new Map();
const unresolved = [];
let missingActionCount = 0;

for (const [owner, sourceGroup] of sourceOwnerGroups) {
  const definition = definitions.get(owner);
  if (!definition) continue;
  for (const action of definition.actions ?? []) {
    if (!action.atomId || directTraceKeys.has(actionKey(owner, action.id))) continue;
    missingActionCount += 1;
    const ownerRows = tracesByOwnerAtom.get(atomKey(owner, action.atomId)) ?? [];
    const examples = atomById.get(action.atomId)?.sourceExamples ?? [];
    const sourceTrace = ownerRows[0] ?? examples.find((example) => example.sourceFile === sourceGroup.sourceFile) ?? examples[0];
    if (!sourceTrace) {
      unresolved.push({ owner, actionId: action.id, atomId: action.atomId });
      continue;
    }
    const actionBasis = actionBasisFor(action);
    const key = groupKey(owner, action.atomId, sourceTrace, actionBasis);
    const entry = groups.get(key) ?? {
      ownerType: owner.split(":")[0],
      ownerId: owner.split(":").slice(1).join(":"),
      actionIds: [],
      atomId: action.atomId,
      sourceFile: sourceTrace.sourceFile,
      sourceTable: sourceTrace.sourceTable,
      step: sourceTrace.step,
      basis: sourceTrace.basis,
      traceDisposition: "context",
      sourceBasis: sourceTrace.basis,
      actionBasis,
      mappingRationale: "",
    };
    entry.actionIds.push(action.id);
    groups.set(key, entry);
  }
}

const traceGroups = [...groups.entries()]
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([, group]) => {
    const actionIds = [...new Set(group.actionIds)].sort();
    const owner = `${group.ownerType}:${group.ownerId}`;
    return {
      id: `context-${slug(owner)}-${slug(group.atomId)}-${slug(group.sourceFile)}-${slug(group.step)}-${slug(group.actionBasis)}`,
      ...group,
      actionIds,
      mappingRationale: `The listed action IDs are exact owner-local generated or decomposed members of ${owner} using ${group.atomId}. They share the ${group.sourceFile} ${group.sourceTable} ${group.step} source boundary and the ${group.actionBasis} action interpretation; the source row is contextual provenance, not a claim that the source prescribed each generated ID verbatim. The group is limited to these members and preserves each action's authored configuration and evidence contract.`,
    };
  });

registry.traceGroups = traceGroups;
writeJson(registryPath, registry);

console.log(JSON.stringify({
  missingActionCount,
  traceGroupCount: traceGroups.length,
  coveredActionCount: traceGroups.reduce((total, group) => total + group.actionIds.length, 0),
  unresolvedCount: unresolved.length,
  unresolved,
}, null, 2));
