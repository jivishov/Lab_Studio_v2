import fs from "node:fs";
import path from "node:path";
import {
  reviewedDecisionFor,
  selectionFor,
} from "./generatorInputs/item2SourceTraceMappings.mjs";

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
const locatorKey = (trace) => [trace.sourceFile, trace.sourceTable, trace.step, trace.basis].join("|");

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

const uniqueLocators = (rows) => [...new Map(rows.map((row) => [locatorKey(row), row])).values()];

/**
 * Resolve a contextual source boundary without using array order.  Cross-activity mappings and
 * ambiguous same-owner atoms must be present in the reviewed mapping module.  A unique direct row
 * or a unique same-owner atom example is safe to reuse because it has no competing locator.
 */
const reviewedSourceFor = ({ owner, atomId, actionId, actionBasis, sourceGroup, ownerRows, examples }) => {
  const explicit = selectionFor({ owner, atomId, actionId, actionBasis });
  if (explicit.locator) {
    return {
      sourceTrace: explicit.locator,
      selectionMode: "reviewed-explicit",
      selectionKey: explicit.selectionKey,
    };
  }

  const directLocators = uniqueLocators(ownerRows);
  const sameOwnerDirect = directLocators.filter((row) => row.sourceFile === sourceGroup.sourceFile);
  if (sameOwnerDirect.length === 1) {
    return {
      sourceTrace: sameOwnerDirect[0],
      selectionMode: "owner-source-unique-direct",
      selectionKey: `${owner}|${atomId}|unique-direct`,
    };
  }

  const sameOwnerExamples = uniqueLocators(examples.filter((example) => example.sourceFile === sourceGroup.sourceFile));
  if (sameOwnerExamples.length === 1) {
    return {
      sourceTrace: sameOwnerExamples[0],
      selectionMode: "owner-source-unique-example",
      selectionKey: `${owner}|${atomId}|unique-example`,
    };
  }

  if (directLocators.length === 1) {
    return {
      sourceTrace: directLocators[0],
      selectionMode: "owner-direct-unique",
      selectionKey: `${owner}|${atomId}|unique-direct-cross-source`,
    };
  }

  throw new Error([
    "No reviewed deterministic source selection exists for",
    `${owner}/${atomId}/${actionBasis}.`,
    `direct=${directLocators.map(locatorKey).join(",") || "none"}`,
    `sameOwnerExamples=${sameOwnerExamples.map(locatorKey).join(",") || "none"}`,
  ].join(" "));
};

const actionContract = (action, actionBasis) => {
  const parameters = action.parameters ?? {};
  const keys = [
    "sourceDefinitionId",
    "targetDefinitionId",
    "sourceInstanceId",
    "targetInstanceId",
    "equipmentRoleBindings",
    "volumeMl",
    "unit",
    "tolerance",
    "configurationParameter",
    "inputRole",
    "inputKey",
    "inputMin",
    "inputMax",
    "inputMinExclusive",
    "inputRequired",
    "inputMode",
    "chromatographyOperation",
    "titrationOperation",
    "trialReferenceId",
    "trialReferenceIds",
    "calculationIds",
    "sourceInventory",
    "quantityKind",
  ];
  const configuration = Object.fromEntries(keys
    .filter((key) => parameters[key] !== undefined)
    .map((key) => [key, parameters[key]]));
  if (action.sourceInventory) configuration.sourceInventory = action.sourceInventory;
  return {
    actionId: action.id,
    label: action.label,
    verb: action.verb,
    atomId: action.atomId,
    actionBasis,
    configuration,
  };
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
    const actionBasis = actionBasisFor(action);
    let selection;
    try {
      selection = reviewedSourceFor({
        owner,
        atomId: action.atomId,
        actionId: action.id,
        actionBasis,
        sourceGroup,
        ownerRows,
        examples,
      });
    } catch (error) {
      if (ownerRows.length === 0 && examples.length === 0) {
        unresolved.push({ owner, actionId: action.id, atomId: action.atomId });
        continue;
      }
      throw error;
    }
    if (!selection?.sourceTrace) {
      unresolved.push({ owner, actionId: action.id, atomId: action.atomId });
      continue;
    }
    const key = groupKey(owner, action.atomId, selection.sourceTrace, actionBasis);
    const atom = atomById.get(action.atomId);
    const entry = groups.get(key) ?? {
      ownerType: owner.split(":")[0],
      ownerId: owner.split(":").slice(1).join(":"),
      actionIds: [],
      atomId: action.atomId,
      sourceFile: selection.sourceTrace.sourceFile,
      sourceTable: selection.sourceTrace.sourceTable,
      step: selection.sourceTrace.step,
      basis: selection.sourceTrace.basis,
      traceDisposition: "context",
      sourceBasis: selection.sourceTrace.basis,
      actionBasis,
      selectionKeys: new Set(),
      selectionModes: new Set(),
      memberContracts: [],
      ownerVersion: definition.metadata?.version ?? definition.version ?? null,
      atomDocumentationLabel: atom?.documentationLabel ?? action.atomId,
    };
    entry.actionIds.push(action.id);
    entry.selectionKeys.add(selection.selectionKey);
    entry.selectionModes.add(selection.selectionMode);
    entry.memberContracts.push(actionContract(action, actionBasis));
    groups.set(key, entry);
  }
}

const traceGroups = [...groups.entries()]
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([, group]) => {
    const actionIds = [...new Set(group.actionIds)].sort();
    const owner = `${group.ownerType}:${group.ownerId}`;
    const atom = atomById.get(group.atomId) ?? {
      id: group.atomId,
      documentationLabel: group.atomDocumentationLabel,
      proceduralConstraints: [],
    };
    const decision = reviewedDecisionFor({
      atom,
      owner,
      sourceTrace: {
        sourceFile: group.sourceFile,
        sourceTable: group.sourceTable,
        step: group.step,
        basis: group.basis,
      },
    });
    const selectionKeys = [...group.selectionKeys].sort();
    const selectionModes = [...group.selectionModes].sort();
    const sourceScope = sourceOwnerGroups.get(owner)?.sourceFile === group.sourceFile
      ? "owner-source-family"
      : "cross-activity-shared-operation";
    const reviewedMapping = {
      schema: "lab-studio/source-trace-reviewed-mapping@1",
      reviewStatus: decision.reviewStatus,
      decisionDisposition: decision.decisionDisposition,
      selectionMode: selectionModes.length === 1 ? selectionModes[0] : "mixed-selection-modes",
      selectionModes,
      selectionKeys,
      sourceScope,
      owner,
      ownerVersion: group.ownerVersion,
      atomId: group.atomId,
      atomDocumentationLabel: group.atomDocumentationLabel,
      memberActionIds: actionIds,
      memberActionContracts: group.memberContracts.sort((left, right) => left.actionId.localeCompare(right.actionId)),
      sourceSupports: decision.sourceSupports,
      transferValidity: decision.transferValidity,
      quantityAndConfigurationLimits: decision.quantityAndConfigurationLimits,
      notSupported: decision.notSupported,
      decisionId: decision.reviewId,
    };
    return {
      id: `context-${slug(owner)}-${slug(group.atomId)}-${slug(group.sourceFile)}-${slug(group.step)}-${slug(group.actionBasis)}`,
      ownerType: group.ownerType,
      ownerId: group.ownerId,
      actionIds,
      atomId: group.atomId,
      sourceFile: group.sourceFile,
      sourceTable: group.sourceTable,
      step: group.step,
      basis: group.basis,
      traceDisposition: group.traceDisposition,
      sourceBasis: group.sourceBasis,
      actionBasis: group.actionBasis,
      reviewedMapping,
      mappingRationale: [
        `${decision.reviewStatus === "reviewed-static-source-mapping" ? "Reviewed mapping" : "Unreviewed contextual boundary"} ${decision.reviewId} covers the exact owner-local members ${actionIds.join(", ")} for ${owner} (${group.ownerVersion ?? "version not declared"}) using ${group.atomId}.`,
        `Selected source boundary: ${group.sourceFile} ${group.sourceTable} ${group.step} basis=${group.basis}; selection scope=${sourceScope}.`,
        `Source supports: ${decision.sourceSupports}`,
        `Transfer validity: ${decision.transferValidity}`,
        `Quantity/configuration limits: ${decision.quantityAndConfigurationLimits}`,
        `Not supported: ${decision.notSupported}`,
        "The group is contextual provenance, not a claim that the source prescribed each generated action ID verbatim.",
      ].join(" "),
    };
  });

registry.contextTracePolicy = {
  ...(registry.contextTracePolicy ?? {}),
  reviewedMappingField: "reviewedMapping",
  reviewedMappingSchema: "lab-studio/source-trace-reviewed-mapping@1",
  reviewedSelectionPolicy: "Every action-specific, ambiguous or cross-activity source choice is recorded in scripts/generatorInputs/item2SourceTraceMappings.mjs. Unique same-owner locators may be reused only when no competing locator exists; array order is never a selection rule.",
  reviewedDecisionPolicy: "Each group records owner/version/member IDs, selection mode, review status, source support, transfer validity, quantity/configuration limits and unsupported claims. Unreviewed groups are explicit nonblocking boundaries and never turn generated actions into verbatim source prescriptions.",
};
registry.traceGroups = traceGroups;
writeJson(registryPath, registry);

console.log(JSON.stringify({
  missingActionCount,
  traceGroupCount: traceGroups.length,
  coveredActionCount: traceGroups.reduce((total, group) => total + group.actionIds.length, 0),
  unresolvedCount: unresolved.length,
  unresolved,
}, null, 2));
