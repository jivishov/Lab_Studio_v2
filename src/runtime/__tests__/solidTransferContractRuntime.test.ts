import { describe, expect, it } from "vitest";
import {
  emptyContents,
  type ContentState,
  type QualitativeSolidProvenanceRecord,
  type TechniqueDefinition,
} from "../../domain/types";
import { createRuntimeState, performRuntimeAction } from "../index";

/**
 * Reducer behaviour around the typed `solidTransfer` contract.
 *
 * Two obligations are asserted here. First, extracting the solid branch into the shared helpers
 * must not change what the reducer already does for unrelated content - in particular the solid
 * addition into a liquid, which becomes a wet mixture and can drive a dissolution response.
 * Second, a qualitative destination must be refused outright in the generic runtime rather than
 * falling through to the physical merge, which would write the input mass onto the receiver as if
 * somebody had weighed the product.
 */

const solid = (massG: number): ContentState => ({
  ...emptyContents("Test solid"),
  kind: "solid",
  massG,
  solutes: [{ id: "test-solid", label: "Test solid", amount: massG, unit: "g" }],
  visualState: "powder",
});

const water = (volumeMl: number, temperatureC = 21): ContentState => ({
  ...emptyContents("Water"),
  kind: "liquid",
  volumeMl,
  temperatureC,
  wetState: "wet",
  visualState: "clear-liquid",
});

const qualitativeReceiver = (): ContentState => ({
  ...emptyContents("Recovered product"),
  kind: "solid",
  qualitativeSolidProvenance: [{
    recordId: "run-1--replicate-1--recover-replicate-product",
    runId: "run-1",
    replicate: 1,
    operationId: "recover-replicate-product",
    stream: "heated-product",
    sourceMaterialId: "test-solid",
    sourceMaterialLabel: "Test solid",
    sourceInstanceId: "source",
    destinationInstanceId: "target",
    sourceActionId: "recover-replicate-product",
    quantityBasis: "source-inventory-equivalent",
    sourceInventoryMassG: 2,
    sourceInventoryEquivalentMassG: 2,
    destinationPhysicalMassKnown: false,
    measurementEvidenceIds: ["replicate-1-loaded-mass"],
    recoveryEvidenceIds: ["product-recovery"],
    routeEvidenceIds: ["final-mass-record"],
  } satisfies QualitativeSolidProvenanceRecord],
});

const node = (id: string, actionId: string): TechniqueDefinition["process"]["nodes"][number] => ({
  id,
  type: "action",
  title: id,
  description: id,
  actionId,
  config: {},
  validation: [],
  hints: [],
  feedback: { success: `${id} complete`, retry: `${id} retry` },
});

const transferAction = (
  id: string,
  parameters: TechniqueDefinition["actions"][number]["parameters"],
  solidTransfer?: TechniqueDefinition["actions"][number]["solidTransfer"],
  prerequisites: TechniqueDefinition["actions"][number]["prerequisites"] = [],
): TechniqueDefinition["actions"][number] => ({
  id,
  verb: "transfer",
  label: id,
  parameters,
  ...(solidTransfer ? { solidTransfer } : {}),
  interaction: {
    type: "pourInto",
    accessibleLabel: id,
    successCue: `${id} complete.`,
    invalidCue: `${id} invalid.`,
  },
  prerequisites,
  stateChanges: [],
  invalidCases: [],
  feedback: { success: `${id} complete`, invalid: `${id} invalid` },
  evidence: ["transfer"],
});

const definitionWith = (
  action: TechniqueDefinition["actions"][number],
  equipment: TechniqueDefinition["initialState"]["equipment"],
): TechniqueDefinition => ({
  id: "solid-transfer-contract-runtime-test",
  title: "Solid transfer contract runtime test",
  learningGoal: "Exercise the typed solid transfer contract in the generic runtime.",
  requiredEquipment: [...new Set(equipment.map((instance) => instance.definitionId))],
  initialState: { equipment },
  actions: [action],
  process: {
    startNodeId: `${action.id}-node`,
    nodes: [node(`${action.id}-node`, action.id)],
    edges: [],
  },
  successCriteria: [],
  commonMistakes: [],
  resetBehavior: "resetTechnique",
  metadata: {
    version: "1.0.0",
    author: "Lab Studio",
    updatedAt: "2026-09-10T00:00:00.000Z",
    tags: ["test"],
  },
});

const bench = (
  sourceContents: ContentState,
  targetDefinitionId: string,
  targetContents: ContentState,
): TechniqueDefinition["initialState"]["equipment"] => [
  {
    id: "source",
    definitionId: "sample-bottle",
    label: "Source",
    location: "workbench",
    contents: sourceContents,
  },
  {
    id: "target",
    definitionId: targetDefinitionId,
    label: "Target",
    location: "workbench",
    contents: targetContents,
  },
];

const contentsOf = (state: ReturnType<typeof createRuntimeState>, id: string): ContentState => {
  const found = state.equipmentInstances.find((instance) => instance.id === id);
  if (!found) throw new Error(`Expected instance ${id}.`);
  return found.contents;
};

describe("existing solid behaviour survives the shared-helper extraction", () => {
  it("still dissolves a solid portion into a liquid and produces the thermal response series", () => {
    const definition = definitionWith(
      transferAction("add-solid", {
        sourceInstanceId: "source",
        sourceDefinitionId: "sample-bottle",
        targetInstanceId: "target",
        targetDefinitionId: "beaker-250ml",
        massG: 4,
        thermalResponseMode: "dissolution",
        idealPeakTemperatureC: 28,
        dataSeriesId: "dissolution-response",
      }),
      bench(solid(10), "beaker-250ml", water(50)),
    );
    const next = performRuntimeAction(definition, createRuntimeState(definition), {
      actionId: "add-solid",
      verb: "transfer",
    });
    const target = contentsOf(next, "target");
    expect(target.kind).toBe("mixture");
    expect(target.wetState).toBe("wet");
    expect(target.visualState).toBe("dissolving-solid");
    expect(target.massG).toBe(4);
    expect(contentsOf(next, "source").massG).toBe(6);
    expect(next.dataSeries.some((series) => series.id.includes("dissolution-response"))).toBe(true);
  });

  it("reads a legacy gram-solute source that declares no massG", () => {
    const legacy: ContentState = {
      ...emptyContents("Legacy solid"),
      kind: "solid",
      solutes: [{ id: "legacy", label: "Legacy", amount: 6, unit: "g" }],
      visualState: "powder",
    };
    const definition = definitionWith(
      transferAction("add-legacy", {
        sourceInstanceId: "source",
        sourceDefinitionId: "sample-bottle",
        targetInstanceId: "target",
        targetDefinitionId: "beaker-250ml",
        massG: 2,
      }),
      bench(legacy, "beaker-250ml", emptyContents()),
    );
    const next = performRuntimeAction(definition, createRuntimeState(definition), {
      actionId: "add-legacy",
      verb: "transfer",
    });
    expect(contentsOf(next, "target").massG).toBe(2);
  });

  it("rejects the legacy physical transfer before it contaminates a qualitative receiver", () => {
    const definition = definitionWith(
      transferAction("legacy-into-qualitative", {
        sourceInstanceId: "source",
        sourceDefinitionId: "sample-bottle",
        targetInstanceId: "target",
        targetDefinitionId: "beaker-250ml",
        emptyRemainingSolid: true,
        requireNonEmptySolidSource: true,
      }),
      bench(solid(2), "beaker-250ml", qualitativeReceiver()),
    );
    const before = createRuntimeState(definition);
    const next = performRuntimeAction(definition, before, {
      actionId: "legacy-into-qualitative",
      verb: "transfer",
    });
    expect(next.attemptHistory.at(-1)?.success).toBe(false);
    expect(contentsOf(next, "source").massG).toBe(2);
    expect(contentsOf(next, "target").qualitativeSolidProvenance).toHaveLength(1);
  });

  it("rejects dissolution into a qualitative receiver before applying thermal or mass changes", () => {
    const definition = definitionWith(
      transferAction("dissolve-into-qualitative", {
        sourceInstanceId: "source",
        sourceDefinitionId: "sample-bottle",
        targetInstanceId: "target",
        targetDefinitionId: "beaker-250ml",
        massG: 2,
        thermalResponseMode: "dissolution",
        idealPeakTemperatureC: 28,
        dataSeriesId: "should-not-be-created",
      }),
      bench(solid(5), "beaker-250ml", qualitativeReceiver()),
    );
    const before = createRuntimeState(definition);
    const next = performRuntimeAction(definition, before, {
      actionId: "dissolve-into-qualitative",
      verb: "transfer",
    });
    expect(next.attemptHistory.at(-1)?.success).toBe(false);
    expect(contentsOf(next, "source").massG).toBe(5);
    expect(contentsOf(next, "target").qualitativeSolidProvenance).toHaveLength(1);
    expect(next.dataSeries.some((series) => series.id.includes("should-not-be-created"))).toBe(false);
  });
});

describe("typed solid transfer contract in the generic runtime", () => {
  it("loads a plan-target portion with no mass contract, as the green load does", () => {
    const definition = definitionWith(
      transferAction(
        "load-plan-target",
        {
          sourceInstanceId: "source",
          sourceDefinitionId: "sample-bottle",
          targetInstanceId: "target",
          targetDefinitionId: "crucible-with-lid",
          massG: 2,
          massIsPlanTargetNotMeasurement: true,
        },
        { mode: "measured-portion", destinationRepresentation: "physical" },
      ),
      bench(solid(2.5), "crucible-with-lid", emptyContents()),
    );
    const next = performRuntimeAction(definition, createRuntimeState(definition), {
      actionId: "load-plan-target",
      verb: "transfer",
    });
    expect(contentsOf(next, "target").massG).toBe(2);
    expect(contentsOf(next, "source").massG).toBe(0.5);
  });

  it("empties a whole remaining solid declared by the typed contract", () => {
    const definition = definitionWith(
      transferAction(
        "return-remainder",
        {
          sourceInstanceId: "source",
          sourceDefinitionId: "sample-bottle",
          targetInstanceId: "target",
          targetDefinitionId: "beaker-250ml",
        },
        {
          mode: "whole-remaining",
          destinationRepresentation: "physical",
          requireNonEmptySource: false,
        },
      ),
      bench(solid(0.5), "beaker-250ml", emptyContents()),
    );
    const next = performRuntimeAction(definition, createRuntimeState(definition), {
      actionId: "return-remainder",
      verb: "transfer",
    });
    expect(contentsOf(next, "target").massG).toBe(0.5);
    expect(contentsOf(next, "source").kind).toBe("empty");
  });

  it("rejects a typed whole-solid delivery whose satisfied gate names another support", () => {
    const definition = definitionWith(
      transferAction(
        "return-remainder-wrong-support",
        {
          sourceInstanceId: "source",
          sourceDefinitionId: "sample-bottle",
          targetInstanceId: "target",
          targetDefinitionId: "beaker-250ml",
        },
        {
          mode: "whole-remaining",
          destinationRepresentation: "physical",
          requireNonEmptySource: true,
        },
        [{
          id: "display-from-other-support",
          type: "measurementRecorded",
          label: "A display reading from another support exists.",
          measurementId: "other-support-display",
          measurementContinuity: {
            version: 1,
            quantityKind: "balance-display",
            producerActionId: "weigh-other-support",
            measuredSupportInstanceId: "other-support",
          },
        }],
      ),
      bench(solid(0.5), "beaker-250ml", emptyContents()),
    );
    const initial = createRuntimeState(definition);
    const state = {
      ...initial,
      measurements: [{
        id: "other-support-display",
        label: "Other support display",
        value: 0.5,
        unit: "g",
        nodeId: "return-remainder-wrong-support-node",
        sourceActionId: "weigh-other-support",
        evidenceScopeId: initial.evidenceScopeId,
        evidenceScopeGeneration: initial.evidenceScopeGeneration,
        measuredSupportInstanceId: "other-support",
        quantityKind: "balance-display" as const,
      }],
    };
    const next = performRuntimeAction(definition, state, {
      actionId: "return-remainder-wrong-support",
      verb: "transfer",
    });

    expect(next.attemptHistory.at(-1)?.success).toBe(false);
    expect(next.attemptHistory.at(-1)?.message).toContain("names a different support");
    expect(contentsOf(next, "source").massG).toBe(0.5);
    expect(contentsOf(next, "target").kind).toBe("empty");
  });

  it("completes a zero return from a genuinely empty source without touching the receiver", () => {
    const definition = definitionWith(
      transferAction(
        "return-nothing",
        {
          sourceInstanceId: "source",
          sourceDefinitionId: "sample-bottle",
          targetInstanceId: "target",
          targetDefinitionId: "beaker-250ml",
        },
        {
          mode: "whole-remaining",
          destinationRepresentation: "physical",
          requireNonEmptySource: false,
        },
      ),
      bench(emptyContents(), "beaker-250ml", emptyContents()),
    );
    const next = performRuntimeAction(definition, createRuntimeState(definition), {
      actionId: "return-nothing",
      verb: "transfer",
    });
    expect(contentsOf(next, "target").kind).toBe("empty");
    expect(next.attemptHistory.at(-1)?.success).toBe(true);
  });

  it("refuses a qualitative destination outright instead of writing the input mass", () => {
    const definition = definitionWith(
      transferAction(
        "recover-product",
        {
          sourceInstanceId: "source",
          sourceDefinitionId: "sample-bottle",
          targetInstanceId: "target",
          targetDefinitionId: "beaker-250ml",
        },
        {
          mode: "whole-remaining",
          destinationRepresentation: "qualitative-unknown",
          requireNonEmptySource: true,
        },
      ),
      bench(solid(2), "beaker-250ml", emptyContents()),
    );
    const next = performRuntimeAction(definition, createRuntimeState(definition), {
      actionId: "recover-product",
      verb: "transfer",
    });
    expect(next.attemptHistory.at(-1)?.success).toBe(false);
    // Neither container moved, and above all the receiver did not acquire the source's mass.
    expect(contentsOf(next, "source").massG).toBe(2);
    expect(contentsOf(next, "target").kind).toBe("empty");
    expect(contentsOf(next, "target").massG).toBeUndefined();
    expect(contentsOf(next, "target").qualitativeSolidProvenance).toBeUndefined();
  });
});
