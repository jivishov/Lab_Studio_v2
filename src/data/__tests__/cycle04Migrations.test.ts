import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  ActionParameterValue,
  ActionDefinition,
  CompositionEndpoint,
  LabCompositionSourceDefinition,
  LabDefinition,
  TechniqueDefinition,
} from "../../domain/types";
import { validateLabDefinition } from "../../domain/validation";
import { applyLabSetup } from "../labSetup";
import { compileLabComposition } from "../compileLabComposition";
import { materializeOrderedProcedure } from "../materializeOrderedProcedure";
import {
  bundledLabSetupFixtures,
  createBundledLabHarness,
  type BundledLabHarness,
} from "../../test/bundledLabHarness";

/**
 * Cycle 04 sources are composition declarations, not the retired action-only `techniqueRefs`
 * contract. These checks deliberately exercise the production loader: exact pinned technique
 * versions, compiler-issued provenance, explicit graph connections, and concrete equipment
 * bindings must survive materialization without asserting a stale historical action count.
 *
 * Not executed under the AGENTS.md repository validation policy.
 */

let bundledLabHarness: BundledLabHarness | undefined;

const bundle = (): BundledLabHarness => {
  if (!bundledLabHarness) throw new Error("Bundled-lab harness is not initialized.");
  return bundledLabHarness;
};

const MIGRATED = [
  "intro-filtration-demo",
  "hard-water-demo",
  "quick-ache-relief-separation",
  "hard-water-analysis",
  "blue1-spectroscopy",
  "crystal-violet-rate-law",
  "equilibrium-rainbow-display",
  "hand-warmer-calorimetry",
] as const;

const readLabSource = (labId: string) =>
  bundle().readJson<LabCompositionSourceDefinition>(`labs/${labId}.json`);

const repeatCount = (source: LabCompositionSourceDefinition["techniqueInstances"][number]): number =>
  source.repeat ?? 1;

const scopeIdFor = (
  source: LabCompositionSourceDefinition["techniqueInstances"][number],
  repeatIndex: number,
): string => repeatCount(source) === 1 ? source.instanceId : `${source.instanceId}--${repeatIndex + 1}`;

const sourceInstanceForScope = (
  source: LabCompositionSourceDefinition,
  scopeId: string,
) => {
  for (const instance of source.techniqueInstances) {
    for (let repeatIndex = 0; repeatIndex < repeatCount(instance); repeatIndex += 1) {
      if (scopeIdFor(instance, repeatIndex) === scopeId) return { instance, repeatIndex };
    }
  }
  throw new Error(`No source technique instance emits the compiled scope "${scopeId}".`);
};

const publishedTechniquesFor = async (source: LabCompositionSourceDefinition) => {
  const configuredSource = applyLabSetup(source, bundledLabSetupFixtures[source.id]);
  const techniques = new Map<string, TechniqueDefinition>();
  const witness = configuredSource.reachabilityWitnesses[0];
  for (const instance of configuredSource.techniqueInstances) {
    const technique = await bundle().loadTechnique(instance.techniqueId);
    // Composition pins an exact published version, never a range or an implicit latest release.
    expect(technique.metadata.version).toBe(instance.version);
    const configuration = Object.fromEntries(
      (technique.composition?.configurationSlots ?? []).map((slot) => [
        slot.id,
        witness.configuration[`${instance.instanceId}.${slot.id}`] ??
          instance.bindings.configuration[slot.id] ??
          slot.defaultValue,
      ]),
    ) as Record<string, ActionParameterValue>;
    techniques.set(instance.instanceId, materializeOrderedProcedure(technique, configuration));
  }
  return techniques;
};

const resolveCompiledEndpoint = (
  endpoint: CompositionEndpoint,
  source: LabCompositionSourceDefinition,
  lab: LabDefinition,
  techniques: Map<string, TechniqueDefinition>,
): string => {
  if (endpoint.kind === "lab-node") return endpoint.nodeId;

  const declared = source.techniqueInstances.find(
    (candidate) => candidate.instanceId === endpoint.instanceId,
  );
  if (!declared) throw new Error(`Unknown technique instance "${endpoint.instanceId}".`);
  const { instance, repeatIndex } = sourceInstanceForScope(
    source,
    scopeIdFor(declared, endpoint.repeatIndex ?? 0),
  );
  const technique = techniques.get(instance.instanceId);
  expect(technique, `Published technique for ${instance.instanceId}`).toBeDefined();
  const port = technique?.composition?.ports.find((candidate) => candidate.id === endpoint.portId);
  expect(port, `${instance.techniqueId} port ${endpoint.portId}`).toBeDefined();

  const scopeId = scopeIdFor(instance, repeatIndex);
  const origin = lab.compositionManifest?.origins.find(
    (candidate) => candidate.instanceId === scopeId && candidate.sourceNodeId === port?.nodeId,
  );
  expect(origin, `Compiled origin for ${scopeId}:${endpoint.portId}`).toBeDefined();
  return origin?.nodeId ?? "";
};

const physicalEndpointIds = (action: ActionDefinition): string[] => {
  const ids = [action.interaction?.sourceDefinitionId, action.interaction?.targetDefinitionId];
  const instrumentDefinitionId = action.parameters.instrumentDefinitionId;
  if (typeof instrumentDefinitionId === "string") ids.push(instrumentDefinitionId);
  return ids.filter((id): id is string => typeof id === "string" && id.length > 0);
};

const concreteBindingIds = (
  source: LabCompositionSourceDefinition["techniqueInstances"][number],
): string[] =>
  Object.values(source.bindings.equipment).flatMap((binding) =>
    "sourceInstances" in binding
      ? (binding.sourceInstances ?? []).map((sourceInstance) => sourceInstance.definitionId)
      : [binding.definitionId],
  );

describe("Cycle 04 composition migrations", () => {
  beforeEach(async () => {
    bundledLabHarness = await createBundledLabHarness();
  });

  afterEach(() => {
    bundledLabHarness?.dispose();
    bundledLabHarness = undefined;
  });

  it.each(MIGRATED)(
    "$labId compiles pinned instances into validated provenance-bearing runtime data",
    async (labId) => {
      const source = await readLabSource(labId);
      const techniques = await publishedTechniquesFor(source);
      const lab = await bundle().loadLab(labId);

      expect("techniqueRefs" in source).toBe(false);
      expect(source.techniqueInstances).not.toHaveLength(0);
      expect(source.compositionConnections).toEqual(expect.any(Array));
      expect(source.reachabilityWitnesses).toEqual(expect.any(Array));
      expect("techniqueInstances" in lab).toBe(false);
      expect("compositionConnections" in lab).toBe(false);
      expect("reachabilityWitnesses" in lab).toBe(false);
      expect(lab.techniques.map((technique) => technique.id)).toEqual(
        source.techniques.map((technique) => technique.id),
      );
      expect(lab.compositionManifest).toMatchObject({ schemaVersion: 1, status: "compiled" });

      const validation = validateLabDefinition(lab);
      expect(validation.errors, `${labId}: ${validation.errors.join(" | ")}`).toEqual([]);
      expect(validation.value).toBeDefined();

      const manifest = lab.compositionManifest;
      expect(manifest?.instances).not.toHaveLength(0);
      expect(manifest?.origins).not.toHaveLength(0);

      for (const compiledInstance of manifest?.instances ?? []) {
        const { instance, repeatIndex } = sourceInstanceForScope(source, compiledInstance.instanceId);
        expect(compiledInstance).toMatchObject({
          techniqueId: instance.techniqueId,
          version: instance.version,
          repeatIndex,
        });

        const technique = techniques.get(instance.instanceId);
        expect(technique).toBeDefined();
        const origins = (manifest?.origins ?? []).filter(
          (origin) => origin.instanceId === compiledInstance.instanceId,
        );
        expect(origins, `${labId}:${compiledInstance.instanceId} has compiled origins`).not.toHaveLength(0);

        for (const origin of origins) {
          const sourceNode = technique?.process.nodes.find((node) => node.id === origin.sourceNodeId);
          expect(sourceNode, `${origin.sourceNodeId} is published`).toBeDefined();
          expect(origin).toMatchObject({
            techniqueId: instance.techniqueId,
            techniqueVersion: instance.version,
            sourceActionId: sourceNode?.actionId,
          });
          expect(lab.process.nodes.find((node) => node.id === origin.nodeId)?.actionId).toBe(origin.actionId);
          if (!origin.actionId) continue;
          const sourceAction = technique?.actions.find((action) => action.id === origin.sourceActionId);
          const compiledAction = lab.actions.find((action) => action.id === origin.actionId);
          expect(sourceAction, `${origin.sourceActionId} is published`).toBeDefined();
          expect(compiledAction, `${origin.actionId} is emitted`).toBeDefined();
          expect(compiledAction?.verb).toBe(sourceAction?.verb);
          expect(compiledAction?.interaction?.type).toBe(sourceAction?.interaction?.type);
        }
      }

      const actionIds = new Set(lab.actions.map((action) => action.id));
      for (const node of source.process.nodes) {
        if (node.actionId) expect(actionIds, `${labId} resolves local ${node.actionId}`).toContain(node.actionId);
      }
      for (const initialEquipment of lab.initialState?.equipment ?? []) {
        expect(lab.equipment, `${labId} declares ${initialEquipment.definitionId}`).toContain(
          initialEquipment.definitionId,
        );
      }
      for (const instance of source.techniqueInstances) {
        for (const definitionId of concreteBindingIds(instance)) {
          expect(lab.equipment, `${labId} carries bound ${definitionId}`).toContain(definitionId);
        }
      }
      for (const action of lab.actions) {
        for (const definitionId of physicalEndpointIds(action)) {
          expect(lab.equipment, `${action.id} points at declared ${definitionId}`).toContain(definitionId);
        }
      }
    },
  );

  it.each(MIGRATED)("$labId materializes every unconditional declared connection", async (labId) => {
    const source = await readLabSource(labId);
    const techniques = await publishedTechniquesFor(source);
    const lab = await bundle().loadLab(labId);

    for (const connection of source.compositionConnections.filter(
      (candidate) => candidate.enabledWhen === undefined,
    )) {
      const from = resolveCompiledEndpoint(connection.from, source, lab, techniques);
      const to = resolveCompiledEndpoint(connection.to, source, lab, techniques);
      expect(lab.process.edges).toContainEqual(
        expect.objectContaining({ from, to, label: connection.label, condition: connection.condition }),
      );
    }
  });

  it("keeps repeated crystal-violet comparison instances separately traceable", async () => {
    const source = await readLabSource("crystal-violet-rate-law");
    const repeated = source.techniqueInstances.filter(
      (instance) => instance.techniqueId === "crystal-violet-integrated-rate-law-comparison",
    );
    expect(repeated.map((instance) => instance.instanceId)).toEqual([
      "rate-law-analysis",
      "analysis-extension",
    ]);

    const mandatoryLab = await bundle().loadLab("crystal-violet-rate-law");
    const mandatoryScopes = (mandatoryLab.compositionManifest?.instances ?? []).filter(
      (instance) => repeated.some((sourceInstance) => sourceInstance.instanceId === instance.instanceId),
    );
    expect(mandatoryScopes.map((instance) => instance.instanceId)).toEqual(["rate-law-analysis"]);

    const lab = await compileLabComposition(source, bundle().loadTechnique, {
      witnessId: "teacher-approved-extension",
    });
    const scopes = (lab.compositionManifest?.instances ?? []).filter(
      (instance) => repeated.some((sourceInstance) => sourceInstance.instanceId === instance.instanceId),
    );
    expect(scopes.map((instance) => instance.instanceId)).toEqual([
      "rate-law-analysis",
      "analysis-extension",
    ]);

    const originSets = scopes.map(
      (scope) =>
        new Set(
          (lab.compositionManifest?.origins ?? [])
            .filter((origin) => origin.instanceId === scope.instanceId)
            .map((origin) => origin.nodeId),
        ),
    );
    expect([...originSets[0]].filter((nodeId) => originSets[1].has(nodeId))).toEqual([]);
  });
});
