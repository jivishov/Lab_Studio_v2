import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { compileLabComposition } from "../src/data/compileLabComposition.ts";
import {
  validateBundledLabSource,
  validateLabDefinition,
  validateTechniqueDefinition,
} from "../src/domain/validation.ts";

const packageRoot = "planning/2026-08-30_lab-studio-technique-composition-remediation";
const pilots = [
  {
    labId: "equilibrium-rainbow-display",
    artifactSha256: "4380f2775862cdb4aa56ee892ee2639ceb1b085414311d554fb84bbdb085eeb8",
    canonicalSha256: "7a3aa5b55a25da6af2516be7f7e3f3791b15298614e7e26b7d044bf40fd0d49c",
    instances: [
      { instanceId: "equilibrium", techniqueId: "equilibrium-rainbow-inquiry", version: "2.2.0" },
    ],
    expectedSourceCounts: { actions: 0, nodes: 0, edges: 0, assessments: 0, connections: 0, edgeOrder: 161 },
  },
  {
    labId: "quick-ache-relief-separation",
    artifactSha256: "55775b64ca3ea09abce9f9a5c29474f57c6951a3f6d7d00406c265ddf7862657",
    canonicalSha256: "cbfdc1bf72910f436bbbccc8532c135214f9b54c77e27ad5e6336c2fa1f6f4e9",
    instances: [
      { instanceId: "property", techniqueId: "quick-ache-property-evidence", version: "1.1.0" },
      { instanceId: "approval", techniqueId: "quick-ache-design-approval", version: "1.1.0" },
      { instanceId: "extraction", techniqueId: "quick-ache-extraction-recovery", version: "1.1.0" },
      { instanceId: "analysis", techniqueId: "quick-ache-analysis-report", version: "1.1.0" },
    ],
    expectedSourceCounts: { actions: 0, nodes: 0, edges: 0, assessments: 3, connections: 3, edgeOrder: 68 },
  },
];

const cycleOneBaseline = JSON.parse(await readFile(`${packageRoot}/evidence/CYCLE_01_BASELINE.json`, "utf8"));
const implementationHead = cycleOneBaseline.scope?.head;
const repositoryRelativeRoot = cycleOneBaseline.scope?.repositoryRelativeRoot;
if (typeof implementationHead !== "string" || typeof repositoryRelativeRoot !== "string") {
  throw new Error("Cycle 01 baseline does not declare the immutable implementation head and repository root.");
}
const baselinePath = (relativePath) => `${repositoryRelativeRoot.replaceAll("\\", "/")}${relativePath}`;
const readBaselineText = (relativePath) => execFileSync(
  "git",
  ["show", `${implementationHead}:${baselinePath(relativePath)}`],
  { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
);

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const sortKeys = (value) => Array.isArray(value)
  ? value.map(sortKeys)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]))
    : value;
const canonical = (value) => JSON.stringify(sortKeys(value));
const valueType = (value) => value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
const pathFor = (base, key) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
  ? `${base}.${key}`
  : `${base}[${JSON.stringify(key)}]`;
const printable = (value) => value === undefined ? "<undefined>" : JSON.stringify(value);

const structuralDifferences = (expected, actual) => {
  const differences = [];
  const compare = (left, right, path) => {
    const leftType = valueType(left);
    const rightType = valueType(right);
    if (leftType !== rightType) {
      differences.push({ path, expected: printable(left), actual: printable(right), reason: `${leftType} != ${rightType}` });
      return;
    }
    if (leftType === "array") {
      if (left.length !== right.length) {
        differences.push({ path: `${path}.length`, expected: String(left.length), actual: String(right.length), reason: "array length" });
      }
      for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
        if (index >= left.length) {
          differences.push({ path: `${path}[${index}]`, expected: "<missing>", actual: printable(right[index]), reason: "unexpected array item" });
        } else if (index >= right.length) {
          differences.push({ path: `${path}[${index}]`, expected: printable(left[index]), actual: "<missing>", reason: "missing array item" });
        } else {
          compare(left[index], right[index], `${path}[${index}]`);
        }
      }
      return;
    }
    if (leftType === "object") {
      const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
      for (const key of keys) {
        const leftOwns = Object.prototype.hasOwnProperty.call(left, key);
        const rightOwns = Object.prototype.hasOwnProperty.call(right, key);
        const childPath = pathFor(path, key);
        if (!leftOwns) {
          differences.push({ path: childPath, expected: "<missing>", actual: printable(right[key]), reason: "unexpected key" });
        } else if (!rightOwns) {
          differences.push({ path: childPath, expected: printable(left[key]), actual: "<missing>", reason: "missing key" });
        } else {
          compare(left[key], right[key], childPath);
        }
      }
      return;
    }
    if (!Object.is(left, right)) {
      differences.push({ path, expected: printable(left), actual: printable(right), reason: "value" });
    }
  };
  compare(expected, actual, "$" );
  return differences;
};

const assertNoDifferences = (label, expected, actual) => {
  const differences = structuralDifferences(expected, actual);
  if (differences.length > 0) {
    throw new Error(`${label} failed with ${differences.length} difference(s):\n${
      differences.map((difference) => JSON.stringify(difference)).join("\n")
    }`);
  }
};

const protectedPaths = [
  "public/labs/index.json",
  "public/techniques/index.json",
  "docs/architecture/source-trace-registry.json",
];
for (const protectedPath of protectedPaths) {
  const currentText = await readFile(protectedPath, "utf8");
  const baselineText = readBaselineText(protectedPath);
  if (currentText !== baselineText) {
    throw new Error(`${protectedPath} differs from immutable implementation head ${implementationHead}.`);
  }
}

const summaries = [];
let failed = false;

for (const pilot of pilots) {
  const artifactPath = `${packageRoot}/evidence/parity-baselines/${pilot.labId}.resolved.json`;
  const artifactText = await readFile(artifactPath, "utf8");
  const artifact = JSON.parse(artifactText);
  const artifactHash = sha256(artifactText);
  const baselineCanonicalHash = sha256(canonical(artifact.resolvedDefinition));
  if (artifactHash !== pilot.artifactSha256 || artifact.canonicalSha256 !== pilot.canonicalSha256 ||
    baselineCanonicalHash !== pilot.canonicalSha256) {
    throw new Error(`${pilot.labId} immutable baseline identity failed before compilation.`);
  }

  const source = JSON.parse(await readFile(`public/labs/${pilot.labId}.json`, "utf8"));
  const sourceValidation = validateBundledLabSource(source);
  if (!sourceValidation.ok || !sourceValidation.value) {
    throw new Error(`${pilot.labId} source validation failed:\n${sourceValidation.errors.join("\n")}`);
  }
  assertNoDifferences(
    `${pilot.labId} exact technique instance identity/order`,
    pilot.instances,
    source.techniqueInstances.map(({ instanceId, techniqueId, version }) => ({ instanceId, techniqueId, version })),
  );
  assertNoDifferences(`${pilot.labId} composition-owned source counts`, pilot.expectedSourceCounts, {
    actions: source.actions.length,
    nodes: source.process.nodes.length,
    edges: source.process.edges.length,
    assessments: source.assessments.length,
    connections: source.compositionConnections?.length ?? 0,
    edgeOrder: source.compositionEdgeOrder?.length ?? 0,
  });
  if (Object.prototype.hasOwnProperty.call(source, "techniqueRefs")) {
    throw new Error(`${pilot.labId} retains forbidden legacy techniqueRefs.`);
  }
  const techniques = new Map();
  for (const expectedInstance of pilot.instances) {
    const techniqueId = expectedInstance.techniqueId;
    const technique = JSON.parse(await readFile(`public/techniques/${techniqueId}.json`, "utf8"));
    const validation = validateTechniqueDefinition(technique);
    if (!validation.ok || !validation.value) {
      throw new Error(`${techniqueId} validation failed:\n${validation.errors.join("\n")}`);
    }
    if (technique.id !== techniqueId || technique.metadata.version !== expectedInstance.version) {
      throw new Error(`${techniqueId} does not retain expected identity/version ${expectedInstance.version}.`);
    }
    const trackedTechnique = JSON.parse(readBaselineText(`public/techniques/${techniqueId}.json`));
    const compositionOnlyTechnique = structuredClone(technique);
    delete compositionOnlyTechnique.composition;
    assertNoDifferences(`${techniqueId} composition-only source change`, trackedTechnique, compositionOnlyTechnique);
    techniques.set(techniqueId, validation.value);
  }
  const compiled = await compileLabComposition(sourceValidation.value, async (techniqueId) => {
    const technique = techniques.get(techniqueId);
    if (!technique) throw new Error(`${pilot.labId} requested unexpected technique ${techniqueId}.`);
    return structuredClone(technique);
  });
  const compiledValidation = validateLabDefinition(compiled);
  if (!compiledValidation.ok || !compiledValidation.value) {
    throw new Error(`${pilot.labId} compiled validation failed:\n${compiledValidation.errors.join("\n")}`);
  }
  if (compiled.compositionManifest?.schemaVersion !== 1 ||
    compiled.compositionManifest.compilerContractVersion !== "1.2" ||
    compiled.compositionManifest.status !== "compiled") {
    throw new Error(`${pilot.labId} did not emit a compiled schema-1 contract-1.2 manifest.`);
  }
  assertNoDifferences(
    `${pilot.labId} exact manifest instance identity/order`,
    pilot.instances.map((instance) => ({ ...instance, repeatIndex: 0 })),
    compiled.compositionManifest.instances.map(({ instanceId, techniqueId, version, repeatIndex }) =>
      ({ instanceId, techniqueId, version, repeatIndex })),
  );
  const expectedOriginCount = pilot.instances.reduce(
    (count, instance) => count + techniques.get(instance.techniqueId).process.nodes.length,
    0,
  );
  if (compiled.compositionManifest.origins.length !== expectedOriginCount) {
    throw new Error(`${pilot.labId} manifest origin count ${compiled.compositionManifest.origins.length} != ${expectedOriginCount}.`);
  }
  const expectedSourceOrigins = pilot.instances.flatMap((instance) =>
    techniques.get(instance.techniqueId).process.nodes.map((node) => ({
      instanceId: instance.instanceId,
      techniqueId: instance.techniqueId,
      techniqueVersion: instance.version,
      sourceNodeId: node.id,
      sourceActionId: node.actionId,
    })));
  assertNoDifferences(
    `${pilot.labId} complete source origin ownership`,
    expectedSourceOrigins,
    compiled.compositionManifest.origins.map((origin) => ({
      instanceId: origin.instanceId,
      techniqueId: origin.techniqueId,
      techniqueVersion: origin.techniqueVersion,
      sourceNodeId: origin.sourceNodeId,
      sourceActionId: origin.sourceActionId,
    })),
  );
  const manifestInstanceById = new Map(pilot.instances.map((instance) => [instance.instanceId, instance]));
  for (const origin of compiled.compositionManifest.origins) {
    const instance = manifestInstanceById.get(origin.instanceId);
    const technique = instance ? techniques.get(instance.techniqueId) : undefined;
    const sourceNode = technique?.process.nodes.find((node) => node.id === origin.sourceNodeId);
    if (!instance || !technique || origin.techniqueId !== instance.techniqueId ||
      origin.techniqueVersion !== instance.version || !sourceNode || sourceNode.actionId !== origin.sourceActionId) {
      throw new Error(`${pilot.labId} has an invalid manifest origin: ${JSON.stringify(origin)}.`);
    }
  }
  const privateLocatorPattern = /[A-Za-z]:[\\/]|file:|sha-?256|file_?id|provider|runtime(?:Only|Handle|Id)|local(?:File)?Path|remote(?:File)?Id/i;
  const privateLocatorMatches = JSON.stringify(compiled.compositionManifest).match(privateLocatorPattern) ?? [];
  if (privateLocatorMatches.length > 0) {
    throw new Error(`${pilot.labId} manifest exposes a private locator token: ${privateLocatorMatches[0]}.`);
  }
  const sourceOnlyFields = [
    "techniqueRefs",
    "techniqueInstances",
    "compositionConnections",
    "reachabilityWitnesses",
    "compositionAssessmentOrder",
    "compositionStart",
    "compositionEdgeOrder",
  ];
  const leakedSourceFields = sourceOnlyFields.filter((field) => Object.prototype.hasOwnProperty.call(compiled, field));
  if (leakedSourceFields.length > 0) {
    throw new Error(`${pilot.labId} compiled output leaks source-only fields: ${leakedSourceFields.join(", ")}.`);
  }
  assertNoDifferences(`${pilot.labId} lab-owned initial state`, source.initialState, compiled.initialState);
  for (const modelField of ["titrationModels", "chromatographyModels", "kineticsModels"]) {
    assertNoDifferences(`${pilot.labId} lab-owned ${modelField}`, source[modelField], compiled[modelField]);
  }
  const referencedActionIds = new Set(compiled.process.nodes.map((node) => node.actionId).filter(Boolean));
  const unusedActionIds = compiled.actions.map((action) => action.id).filter((actionId) => !referencedActionIds.has(actionId));
  if (unusedActionIds.length > 0) {
    throw new Error(`${pilot.labId} compiled output has unused actions: ${unusedActionIds.join(", ")}.`);
  }

  const compared = structuredClone(compiled);
  delete compared.compositionManifest;
  const differences = structuralDifferences(artifact.resolvedDefinition, compared);
  const comparedCanonicalHash = sha256(canonical(compared));
  const equal = differences.length === 0 && comparedCanonicalHash === pilot.canonicalSha256;
  summaries.push({
    labId: pilot.labId,
    exactVersionInstances: source.techniqueInstances.map((instance) =>
      `${instance.techniqueId}@${instance.version}`),
    immutableArtifactSha256: artifactHash,
    immutableCanonicalSha256: pilot.canonicalSha256,
    compiledCanonicalSha256AfterExclusions: comparedCanonicalHash,
    exclusions: ["$.compositionManifest"],
    exactInstanceCount: pilot.instances.length,
    manifestOriginCount: compiled.compositionManifest.origins.length,
    techniqueSourceCompositionOnly: true,
    labOwnedInitialStateDifferenceCount: 0,
    labOwnedModelDifferenceCount: 0,
    unusedActionCount: 0,
    privateManifestLocatorMatchCount: 0,
    sourceOnlyFieldLeakCount: 0,
    differenceCount: differences.length,
    equal,
  });
  if (!equal) {
    failed = true;
    console.error(`${pilot.labId}: ${differences.length} structural difference(s)`);
    differences.forEach((difference) => console.error(JSON.stringify(difference)));
  }
}

console.log(JSON.stringify({
  schema: "lab-studio/cycle-03-pilot-parity@1",
  comparison: "recursive key-sorted object traversal; arrays and optional-key presence remain exact",
  approvedExclusions: ["$.compositionManifest"],
  immutableImplementationHead: implementationHead,
  protectedFilesUnchanged: protectedPaths,
  pilots: summaries,
  equal: summaries.every((summary) => summary.equal),
}, null, 2));

if (failed) process.exitCode = 1;
