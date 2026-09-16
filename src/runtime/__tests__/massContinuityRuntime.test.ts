import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  emptyContents,
  type ContentState,
  type TechniqueDefinition,
} from "../../domain/types";
import { weighingTechnique } from "../../domain/fixtures";
import { createRuntimeState, performRuntimeAction } from "../index";
import { isWithinTolerance } from "../calculations";

/** The instrument step the authored hand-warmer boat reading uses, reused for residual assertions. */
const BALANCE_STEP_G = 0.001;

const solid = (massG: number): ContentState => ({
  ...emptyContents(),
  kind: "solid" as const,
  label: "Test solid",
  massG,
  solutes: [{ id: "test-solid", label: "Test solid", amount: massG, unit: "g" }],
  wetState: "dry" as const,
  visualState: "powder",
});

const action = (
  id: string,
  verb: TechniqueDefinition["actions"][number]["verb"],
  parameters: TechniqueDefinition["actions"][number]["parameters"],
): TechniqueDefinition["actions"][number] => ({
  id,
  verb,
  label: id,
  parameters,
  prerequisites: [],
  stateChanges: [],
  invalidCases: [],
  feedback: { success: `${id} complete`, invalid: `${id} invalid` },
  evidence: [verb],
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

const materialPortionDefinition = (sourceMassG = 3, allowEmptySource = false): TechniqueDefinition => ({
  id: "mass-continuity-runtime-test",
  title: "Mass continuity runtime test",
  learningGoal: "Exercise opt-in mass evidence continuity.",
  requiredEquipment: ["watch-glass", "beaker-250ml"],
  initialState: {
    equipment: [
      { id: "support", definitionId: "watch-glass", label: "Watch glass", location: "workbench", contents: emptyContents() },
      { id: "source", definitionId: "beaker-250ml", label: "Solid source", location: "workbench", contents: sourceMassG > 0 ? solid(sourceMassG) : emptyContents() },
      { id: "receiver", definitionId: "beaker-250ml", label: "Receiver", location: "workbench", contents: emptyContents() },
    ],
  },
  actions: [
    {
      ...action("weigh-portion", "weigh", {
        sourceInstanceId: "support",
        sourceDefinitionId: "watch-glass",
        targetDefinitionId: "analytical-balance",
        inputMode: "numeric",
        inputRole: "studentResponse",
        inputRequired: true,
        unit: "g",
      }),
      mass: {
        source: "action-input",
        outputMeasurementId: "portion-mass",
        continuity: {
          version: 1,
          quantityKind: "material-portion",
          measuredSupportInstanceId: "support",
          materialSourceInstanceId: "source",
        },
      },
    },
    {
      ...action("transfer-portion", "transfer", {
        sourceInstanceId: "source",
        sourceDefinitionId: "beaker-250ml",
        targetInstanceId: "receiver",
        targetDefinitionId: "beaker-250ml",
        allowEmptySource,
      }),
      mass: {
        source: "measurement",
        referenceId: "portion-mass",
        continuity: {
          version: 1,
          quantityKind: "material-portion",
          producerActionId: "weigh-portion",
          measuredSupportInstanceId: "support",
          materialSourceInstanceId: "source",
        },
      },
    },
  ],
  process: {
    startNodeId: "weigh-node",
    nodes: [node("weigh-node", "weigh-portion"), node("transfer-node", "transfer-portion")],
    edges: [{ from: "weigh-node", to: "transfer-node", label: "next", condition: { type: "always" } }],
  },
  successCriteria: [],
  commonMistakes: [],
  resetBehavior: "resetTechnique",
  metadata: { version: "1.0.0", author: "Lab Studio", updatedAt: "2026-09-08T00:00:00.000Z", tags: ["test"] },
});

const balanceDisplayTransferDefinition: TechniqueDefinition = {
  ...materialPortionDefinition(),
  id: "balance-display-transfer-runtime-test",
  actions: [
    {
      ...materialPortionDefinition().actions[0],
      mass: {
        source: "action-input",
        outputMeasurementId: "display-mass",
        continuity: {
          version: 1,
          quantityKind: "balance-display",
          measuredSupportInstanceId: "support",
        },
      },
    },
    {
      ...materialPortionDefinition().actions[1],
      mass: {
        source: "measurement",
        referenceId: "display-mass",
        continuity: {
          version: 1,
          quantityKind: "balance-display",
          producerActionId: "weigh-portion",
          measuredSupportInstanceId: "support",
        },
      },
    },
  ],
};

/**
 * The corrected hand-warmer Part 1 shape. PR-07 measures the prepared portion and PR-08 adds
 * *all* of it, so the learner's reading is whole-support evidence (`balance-display`) and the pour
 * empties the support instead of being sized by the reading. The evidence gate therefore lives on
 * the prerequisite rather than on a mass contract.
 *
 * The weighing boat and the poured container are one instance in the authored content
 * (`weigh-boat-1` produces the reading and `P1-22*` empties it), so this fixture reads and pours
 * the same instance. `pour-all` is the required first delivery and carries
 * `requireNonEmptySolidSource`; `empty-remainder` is the residual-completeness step and does not,
 * because it may truthfully complete after the delivery already emptied the support.
 * `handWarmerPartOneDeliveryShape` below asserts that this fixture still matches the generated
 * `P1-22*`/`P1-23*` actions.
 */
const wholeSupportDeliveryDefinition = (
  sourceMassG = 5,
  overrides: {
    readonly sourceContents?: TechniqueDefinition["initialState"]["equipment"][number]["contents"];
    readonly deliveryParameters?: TechniqueDefinition["actions"][number]["parameters"];
    readonly deliveryMass?: TechniqueDefinition["actions"][number]["mass"];
    /**
     * The instance the balance reading is recorded against, for both the producer contract and the
     * delivery's gate. It is the poured container in the authored content; pointing it elsewhere
     * models a reading that is internally valid but describes a different object.
     */
    readonly readSupportInstanceId?: string;
    readonly receiverContents?: TechniqueDefinition["initialState"]["equipment"][number]["contents"];
    /**
     * Gates the residual step on the first delivery the way the authored `P1-23*` steps do.
     * "qualified" adds `requireCurrentEvidenceScope`; "unqualified" is the legacy rule shape.
     */
    readonly residualEvidenceGate?: "qualified" | "unqualified";
  } = {},
): TechniqueDefinition => {
  const base = materialPortionDefinition(sourceMassG);
  const readSupportInstanceId = overrides.readSupportInstanceId ?? "source";
  return {
    ...base,
    id: "whole-support-delivery-runtime-test",
    initialState: {
      equipment: base.initialState.equipment.map((item) => {
        if (item.id === "source" && overrides.sourceContents) return { ...item, contents: overrides.sourceContents };
        if (item.id === "receiver" && overrides.receiverContents) return { ...item, contents: overrides.receiverContents };
        return item;
      }),
    },
    actions: [
      {
        ...action("weigh-portion", "weigh", {
          sourceInstanceId: readSupportInstanceId,
          sourceDefinitionId: readSupportInstanceId === "source" ? "beaker-250ml" : "watch-glass",
          targetDefinitionId: "analytical-balance",
          inputMode: "numeric",
          inputRole: "studentResponse",
          inputRequired: true,
          unit: "g",
        }),
        mass: {
          source: "action-input",
          outputMeasurementId: "boat-display-mass",
          continuity: {
            version: 1,
            quantityKind: "balance-display",
            measuredSupportInstanceId: readSupportInstanceId,
          },
        },
      },
      {
        ...action("pour-all", "transfer", {
          sourceInstanceId: "source",
          sourceDefinitionId: "beaker-250ml",
          targetInstanceId: "receiver",
          targetDefinitionId: "beaker-250ml",
          emptyRemainingSolid: true,
          requireNonEmptySolidSource: true,
          ...overrides.deliveryParameters,
        }),
        ...(overrides.deliveryMass ? { mass: overrides.deliveryMass } : {}),
        prerequisites: [
          {
            id: "pour-all-current-display-required",
            type: "measurementRecorded",
            label: "The current attempt's balance display is recorded.",
            measurementId: "boat-display-mass",
            measurementContinuity: {
              version: 1,
              quantityKind: "balance-display",
              producerActionId: "weigh-portion",
              measuredSupportInstanceId: readSupportInstanceId,
            },
          },
        ],
      },
      {
        ...action("empty-remainder", "transfer", {
          sourceInstanceId: "source",
          sourceDefinitionId: "beaker-250ml",
          targetInstanceId: "receiver",
          targetDefinitionId: "beaker-250ml",
          emptyRemainingSolid: true,
        }),
        ...(overrides.residualEvidenceGate
          ? {
              prerequisites: [
                {
                  id: "empty-remainder-initial-delivery-required",
                  type: "actionEvidence" as const,
                  label: "The measured portion has been delivered in this attempt.",
                  actionId: "pour-all",
                  ...(overrides.residualEvidenceGate === "qualified"
                    ? { requireCurrentEvidenceScope: true }
                    : {}),
                },
              ],
            }
          : {}),
      },
    ],
    process: {
      startNodeId: "weigh-node",
      nodes: [
        node("weigh-node", "weigh-portion"),
        node("pour-node", "pour-all"),
        node("remainder-node", "empty-remainder"),
      ],
      edges: [
        { from: "weigh-node", to: "pour-node", label: "next", condition: { type: "always" } },
        { from: "pour-node", to: "remainder-node", label: "next", condition: { type: "always" } },
      ],
    },
  };
};

/** Deliver into a receiver that already holds warm water, so the dissolution series is generated. */
const dissolutionReceiverContents = {
  ...emptyContents(),
  kind: "liquid" as const,
  label: "Water",
  volumeMl: 100,
  temperatureC: 21,
  wetState: "wet" as const,
  visualState: "liquid",
};

const dissolutionDeliveryParameters = {
  thermalResponseMode: "dissolution",
  idealPeakTemperatureC: 34,
  dataSeriesId: "dissolution-series",
  durationS: 30,
  sampleEveryS: 1,
} satisfies TechniqueDefinition["actions"][number]["parameters"];

/**
 * Reads the authored technique the generator actually publishes. A simplified runtime fixture can
 * drift from the shipped content silently; this keeps the two honest about each other.
 */
const handWarmerPartOneDeliveryShape = () => {
  const technique = JSON.parse(
    readFileSync(join(process.cwd(), "public/techniques/hand-warmer-calorimetry.json"), "utf8"),
  ) as {
    initialState: { equipment: Array<{ id: string; contents: { kind: string; massG?: number; solutes: unknown[] } }> };
    actions: Array<{ id: string; verb: string; atomId?: string; parameters: Record<string, unknown>; prerequisites: Array<Record<string, unknown>> }>;
  };
  const byId = new Map(technique.actions.map((entry) => [entry.id, entry]));
  return { technique, byId };
};

describe("opt-in mass continuity", () => {
  it("requires a new measurement on re-entry to the same authored scope label", () => {
    const base = materialPortionDefinition();
    // A physical reset preserves completed process nodes. A real re-entry therefore needs a new
    // authored node for the same weighing action rather than forcing the already-completed first
    // node to run again. Both nodes produce the same logical measurement under the same scope label.
    const definition: TechniqueDefinition = {
      ...base,
      process: {
        ...base.process,
        nodes: [...base.process.nodes, node("weigh-reentry-node", "weigh-portion")],
        edges: [
          ...base.process.edges,
          { from: "weigh-reentry-node", to: "transfer-node", label: "next", condition: { type: "always" } },
        ],
      },
    };
    const firstMeasurement = performRuntimeAction(definition, createRuntimeState(definition), {
      actionId: "weigh-portion", verb: "weigh", value: 2,
    });
    expect(firstMeasurement.measurements).toContainEqual(expect.objectContaining({
      id: "portion-mass", evidenceScopeId: "scope-1", evidenceScopeGeneration: 1,
    }));

    const sameLabelRetry = performRuntimeAction(definition, firstMeasurement, {
      verb: "reset",
      parameters: { scope: "physical", nextScopeId: "scope-1", resumeNodeId: "transfer-node" },
    });
    expect(sameLabelRetry.evidenceScopeGeneration).toBe(2);
    const staleTransfer = performRuntimeAction(definition, sameLabelRetry, {
      actionId: "transfer-portion",
      verb: "transfer",
      sourceInstanceId: "source",
      targetInstanceId: "receiver",
    });
    expect(staleTransfer.equipmentInstances.find((item) => item.id === "source")?.contents.massG).toBe(3);
    expect(staleTransfer.feedbackQueue.at(-1)?.message).toContain("positive solid-mass evidence");

    // Start a second valid retry from the same first-run state. The new authored node runs through
    // normal action validation; it is not an injected reopening of the completed first node.
    const remeasure = performRuntimeAction(definition, firstMeasurement, {
      verb: "reset",
      parameters: { scope: "physical", nextScopeId: "scope-1", resumeNodeId: "weigh-reentry-node" },
    });
    const currentMeasurement = performRuntimeAction(definition, remeasure, {
      actionId: "weigh-portion", verb: "weigh", value: 1.5,
    });
    expect(currentMeasurement.measurements).toContainEqual(expect.objectContaining({
      id: "portion-mass", value: 1.5, evidenceScopeId: "scope-1", evidenceScopeGeneration: 2,
    }));
    const transferred = performRuntimeAction(definition, currentMeasurement, {
      actionId: "transfer-portion",
      verb: "transfer",
      sourceInstanceId: "source",
      targetInstanceId: "receiver",
    });
    expect(transferred.equipmentInstances.find((item) => item.id === "source")?.contents.massG).toBe(1.5);
    expect(transferred.equipmentInstances.find((item) => item.id === "receiver")?.contents.massG).toBe(1.5);
  });

  it("never lets a balance display or allowEmptySource bypass authorize material transfer", () => {
    let displayState = createRuntimeState(balanceDisplayTransferDefinition);
    displayState = performRuntimeAction(balanceDisplayTransferDefinition, displayState, {
      actionId: "weigh-portion", verb: "weigh", value: 0,
    });
    expect(displayState.measurements).toContainEqual(expect.objectContaining({ id: "display-mass", value: 0 }));
    const rejectedDisplayTransfer = performRuntimeAction(balanceDisplayTransferDefinition, displayState, {
      actionId: "transfer-portion", verb: "transfer", sourceInstanceId: "source", targetInstanceId: "receiver",
    });
    expect(rejectedDisplayTransfer.equipmentInstances.find((item) => item.id === "source")?.contents.massG).toBe(3);
    expect(rejectedDisplayTransfer.feedbackQueue.at(-1)?.message).toContain("balance-display measurement cannot authorize");

    const emptyDefinition = materialPortionDefinition(0, true);
    const emptyState = createRuntimeState(emptyDefinition);
    const rejectedEmptyTransfer = performRuntimeAction(emptyDefinition, {
      ...emptyState,
      currentNodeId: "transfer-node",
    }, {
      actionId: "transfer-portion", verb: "transfer", sourceInstanceId: "source", targetInstanceId: "receiver",
    });
    expect(rejectedEmptyTransfer.completedNodes).toHaveLength(0);
    expect(rejectedEmptyTransfer.feedbackQueue.at(-1)?.message).toContain("positive solid-mass evidence");
  });

  it("keeps a whole-support delivery gated by its reading while moving the support's actual contents once", () => {
    const definition = wholeSupportDeliveryDefinition(5);
    const initial = createRuntimeState(definition);

    // The balance display is the only authorization, so the pour is refused before it is recorded.
    const withoutEvidence = performRuntimeAction(definition, { ...initial, currentNodeId: "pour-node" }, {
      actionId: "pour-all", verb: "transfer", sourceInstanceId: "source", targetInstanceId: "receiver",
    });
    expect(withoutEvidence.completedNodes).not.toContain("pour-node");
    expect(withoutEvidence.equipmentInstances.find((item) => item.id === "receiver")?.contents.kind).toBe("empty");

    // Reading the balance records evidence and must not move or create material.
    const afterRead = performRuntimeAction(definition, initial, {
      actionId: "weigh-portion", verb: "weigh", value: 4.995,
    });
    expect(afterRead.measurements).toContainEqual(expect.objectContaining({
      id: "boat-display-mass", quantityKind: "balance-display", value: 4.995,
    }));
    expect(afterRead.equipmentInstances.find((item) => item.id === "source")?.contents.massG).toBe(5);
    expect(afterRead.equipmentInstances.find((item) => item.id === "receiver")?.contents.kind).toBe("empty");

    // The pour delivers the support's actual contents, not the reading, and empties the support.
    const afterPour = performRuntimeAction(definition, afterRead, {
      actionId: "pour-all", verb: "transfer", sourceInstanceId: "source", targetInstanceId: "receiver",
    });
    const pouredSource = afterPour.equipmentInstances.find((item) => item.id === "source");
    const pouredReceiver = afterPour.equipmentInstances.find((item) => item.id === "receiver");
    expect(pouredSource?.contents.kind).toBe("empty");
    expect(isWithinTolerance(pouredReceiver?.contents.massG ?? Number.NaN, 5, BALANCE_STEP_G)).toBe(true);

    // The authored residual step then has nothing to move; it must not duplicate delivered stock.
    const afterRemainder = performRuntimeAction(definition, afterPour, {
      actionId: "empty-remainder", verb: "transfer", sourceInstanceId: "source", targetInstanceId: "receiver",
    });
    const finalReceiver = afterRemainder.equipmentInstances.find((item) => item.id === "receiver");
    expect(isWithinTolerance(finalReceiver?.contents.massG ?? Number.NaN, 5, BALANCE_STEP_G)).toBe(true);
    expect(afterRemainder.equipmentInstances.find((item) => item.id === "source")?.contents.kind).toBe("empty");
    expect(afterRemainder.completedNodes).toContain("remainder-node");
  });

  it("refuses a required first delivery from an empty support instead of completing it silently", () => {
    const definition = wholeSupportDeliveryDefinition(0);
    const initial = createRuntimeState(definition);
    const afterRead = performRuntimeAction(definition, initial, {
      actionId: "weigh-portion", verb: "weigh", value: 0,
    });
    const attempted = performRuntimeAction(definition, afterRead, {
      actionId: "pour-all", verb: "transfer", sourceInstanceId: "source", targetInstanceId: "receiver",
    });

    expect(attempted.completedNodes).not.toContain("pour-node");
    expect(attempted.feedbackQueue.at(-1)?.message).toContain("no solid to deliver");
    expect(attempted.equipmentInstances.find((item) => item.id === "receiver")?.contents.kind).toBe("empty");
    expect(attempted.dataSeries).toHaveLength(0);
  });

  it("still lets the residual step complete on an already emptied support", () => {
    const definition = wholeSupportDeliveryDefinition(5);
    let state = createRuntimeState(definition);
    state = performRuntimeAction(definition, state, { actionId: "weigh-portion", verb: "weigh", value: 5 });
    state = performRuntimeAction(definition, state, {
      actionId: "pour-all", verb: "transfer", sourceInstanceId: "source", targetInstanceId: "receiver",
    });
    expect(state.completedNodes).toContain("pour-node");

    const residual = performRuntimeAction(definition, state, {
      actionId: "empty-remainder", verb: "transfer", sourceInstanceId: "source", targetInstanceId: "receiver",
    });
    expect(residual.completedNodes).toContain("remainder-node");
    // Exact stock conservation: nothing was invented on the way out of an already empty support.
    expect(isWithinTolerance(
      residual.equipmentInstances.find((item) => item.id === "receiver")?.contents.massG ?? Number.NaN,
      5,
      BALANCE_STEP_G,
    )).toBe(true);
  });

  it("refuses malformed or incompatible whole-solid inventory in either delivery mode", () => {
    const cases = [
      {
        label: "solid that also carries a liquid phase",
        contents: { ...solid(5), volumeMl: 1 },
      },
      {
        label: "solid that also carries a precipitate",
        contents: {
          ...solid(5),
          precipitate: { substance: "Settled residue", massG: 1, rinsed: false, dryness: "wet" },
        },
      },
      {
        label: "solid with a negative solute amount",
        contents: {
          ...solid(5),
          solutes: [{ id: "invalid", label: "Invalid", amount: -0.5, unit: "g" }],
        },
      },
      {
        label: "solid with a negative liquid volume",
        contents: { ...solid(5), volumeMl: -1 },
      },
      {
        label: "empty kind with a positive declared mass",
        contents: { ...emptyContents(), massG: 5 },
      },
    ] satisfies Array<{
      label: string;
      contents: TechniqueDefinition["initialState"]["equipment"][number]["contents"];
    }>;

    for (const { label, contents } of cases) {
      const definition = wholeSupportDeliveryDefinition(5, { sourceContents: contents });
      let state = createRuntimeState(definition);
      state = performRuntimeAction(definition, state, {
        actionId: "weigh-portion", verb: "weigh", value: 5,
      });

      const required = performRuntimeAction(definition, state, {
        actionId: "pour-all", verb: "transfer", sourceInstanceId: "source", targetInstanceId: "receiver",
      });
      expect(required.completedNodes.includes("pour-node"), label).toBe(false);
      expect(required.feedbackQueue.at(-1)?.message, label).toContain("cannot safely handle");
      expect(required.equipmentInstances.find((item) => item.id === "source")?.contents, label).toEqual(contents);
      expect(required.equipmentInstances.find((item) => item.id === "receiver")?.contents.kind, label).toBe("empty");

      const residual = performRuntimeAction(definition, { ...state, currentNodeId: "remainder-node" }, {
        actionId: "empty-remainder", verb: "transfer", sourceInstanceId: "source", targetInstanceId: "receiver",
      });
      expect(residual.completedNodes.includes("remainder-node"), label).toBe(false);
      expect(residual.feedbackQueue.at(-1)?.message, label).toContain("cannot safely handle");
      expect(residual.equipmentInstances.find((item) => item.id === "source")?.contents, label).toEqual(contents);
      expect(residual.equipmentInstances.find((item) => item.id === "receiver")?.contents.kind, label).toBe("empty");
    }
  });

  it("completes a residual step only on a genuinely empty container, never on other zero-gram contents", () => {
    const liquid = {
      ...emptyContents(),
      kind: "liquid" as const,
      label: "Rinse water",
      volumeMl: 25,
      wetState: "wet" as const,
      visualState: "clear-liquid",
    };
    const cases = [
      {
        label: "genuinely empty",
        contents: emptyContents(),
        completes: true,
        message: "No visible solid remained",
      },
      {
        // No gram-valued solutes, so the old arithmetic read this as an empty container and
        // completed the solid-residual step over a quarter-full vessel of water.
        label: "liquid with no gram inventory",
        contents: liquid,
        completes: false,
        message: "Only a visible solid remainder",
      },
      {
        label: "empty kind still carrying gram-valued material",
        contents: { ...emptyContents(), solutes: [{ id: "residue", label: "Residue", amount: 0.4, unit: "g" as const }] },
        completes: false,
        // This is contradictory persisted inventory, not merely a wrong visible phase, so the
        // shared eligibility guard correctly reports it as unsafe rather than silently writing it off.
        message: "cannot safely handle",
      },
      {
        label: "solid declaring zero total over positive gram-valued solutes",
        contents: { ...solid(2), massG: 0 },
        completes: false,
        message: "no remaining solid mass while it still holds material",
      },
      {
        // A zero-gram object still presents as a solid rather than a genuinely empty support.
        // Completing it would treat a contradictory persisted material state as a delivered residue.
        label: "zero-gram solid object",
        contents: solid(0),
        completes: false,
        message: "no remaining solid mass while it still holds material",
      },
    ] satisfies Array<{
      label: string;
      contents: ContentState;
      completes: boolean;
      message: string;
    }>;

    for (const { label, contents, completes, message } of cases) {
      const definition = wholeSupportDeliveryDefinition(5, { sourceContents: contents });
      const state = createRuntimeState(definition);
      const residual = performRuntimeAction(definition, { ...state, currentNodeId: "remainder-node" }, {
        actionId: "empty-remainder", verb: "transfer", sourceInstanceId: "source", targetInstanceId: "receiver",
      });

      expect(residual.completedNodes.includes("remainder-node"), label).toBe(completes);
      expect(residual.feedbackQueue.at(-1)?.message, label).toContain(message);
      // Nothing moves in either outcome: a truthful completion has nothing to move, and a refusal
      // must leave the pre-action state exactly as it was.
      expect(residual.equipmentInstances.find((item) => item.id === "receiver")?.contents.kind, label).toBe("empty");
      expect(
        residual.equipmentInstances.find((item) => item.id === "source")?.contents,
        label,
      ).toEqual(contents);
    }
  });

  it("treats a negative or non-finite recorded solid mass as malformed rather than as an empty completion", () => {
    for (const [label, massG] of [["negative", -1], ["non-finite", Number.NaN]] as const) {
      const definition = wholeSupportDeliveryDefinition(5, {
        sourceContents: { ...solid(5), massG, solutes: [] },
      });
      let state = createRuntimeState(definition);
      state = performRuntimeAction(definition, state, { actionId: "weigh-portion", verb: "weigh", value: 5 });

      const required = performRuntimeAction(definition, state, {
        actionId: "pour-all", verb: "transfer", sourceInstanceId: "source", targetInstanceId: "receiver",
      });
      expect(required.completedNodes, label).not.toContain("pour-node");
      expect(required.feedbackQueue.at(-1)?.message, label).toContain("usable solid mass");

      // The residual step is permissive about an *empty* support, never about a malformed one.
      const residual = performRuntimeAction(definition, { ...state, currentNodeId: "remainder-node" }, {
        actionId: "empty-remainder", verb: "transfer", sourceInstanceId: "source", targetInstanceId: "receiver",
      });
      expect(residual.completedNodes, label).not.toContain("remainder-node");
      expect(residual.feedbackQueue.at(-1)?.message, label).toContain("usable solid mass");
      expect(residual.equipmentInstances.find((item) => item.id === "receiver")?.contents.kind, label).toBe("empty");
    }
  });

  it("requires usable numeric values for continuity-gated mass records", () => {
    // `0 g` remains a valid balance display (covered by the empty-support case above), but a
    // non-finite or negative persisted display must not satisfy the hand-warmer-style gate.
    for (const [label, value] of [["non-finite display", Number.NaN], ["negative display", -0.001]] as const) {
      const definition = wholeSupportDeliveryDefinition(5);
      let state = createRuntimeState(definition);
      state = performRuntimeAction(definition, state, {
        actionId: "weigh-portion", verb: "weigh", value: 5,
      });
      const malformed = {
        ...state,
        measurements: state.measurements.map((measurement) =>
          measurement.id === "boat-display-mass" ? { ...measurement, value } : measurement,
        ),
      };
      const rejected = performRuntimeAction(definition, malformed, {
        actionId: "pour-all", verb: "transfer", sourceInstanceId: "source", targetInstanceId: "receiver",
      });
      expect(rejected.completedNodes.includes("pour-node"), label).toBe(false);
      expect(rejected.equipmentInstances.find((item) => item.id === "source")?.contents.massG, label).toBe(5);
      expect(rejected.equipmentInstances.find((item) => item.id === "receiver")?.contents.kind, label).toBe("empty");
    }

    // Normal production replaces this composite identity. Imported state can still contain an
    // older valid record followed by a corrupt duplicate, which must not silently fall back.
    const duplicateDefinition = wholeSupportDeliveryDefinition(5);
    let duplicateState = createRuntimeState(duplicateDefinition);
    duplicateState = performRuntimeAction(duplicateDefinition, duplicateState, {
      actionId: "weigh-portion", verb: "weigh", value: 5,
    });
    const validDisplay = duplicateState.measurements.find((measurement) => measurement.id === "boat-display-mass");
    if (!validDisplay) throw new Error("Expected a current display measurement.");
    const latestInvalidDuplicate = {
      ...duplicateState,
      measurements: [...duplicateState.measurements, { ...validDisplay, value: Number.NaN }],
    };
    const duplicateRejected = performRuntimeAction(duplicateDefinition, latestInvalidDuplicate, {
      actionId: "pour-all", verb: "transfer", sourceInstanceId: "source", targetInstanceId: "receiver",
    });
    expect(duplicateRejected.completedNodes).not.toContain("pour-node");
    expect(duplicateRejected.equipmentInstances.find((item) => item.id === "source")?.contents.massG).toBe(5);

    const materialDefinition = materialPortionDefinition();
    const continuityGatedMaterial: TechniqueDefinition = {
      ...materialDefinition,
      actions: materialDefinition.actions.map((definitionAction) =>
        definitionAction.id === "transfer-portion"
          ? {
              ...definitionAction,
              prerequisites: [
                {
                  id: "current-material-portion-required",
                  type: "measurementRecorded",
                  label: "A current material portion is recorded.",
                  measurementId: "portion-mass",
                  measurementContinuity: {
                    version: 1,
                    quantityKind: "material-portion",
                    producerActionId: "weigh-portion",
                    measuredSupportInstanceId: "support",
                    materialSourceInstanceId: "source",
                  },
                },
              ],
            }
          : definitionAction,
      ),
    };
    for (const [label, value] of [["non-finite portion", Number.NaN], ["zero portion", 0], ["negative portion", -0.001]] as const) {
      let state = createRuntimeState(continuityGatedMaterial);
      state = performRuntimeAction(continuityGatedMaterial, state, {
        actionId: "weigh-portion", verb: "weigh", value: 2,
      });
      const malformed = {
        ...state,
        measurements: state.measurements.map((measurement) =>
          measurement.id === "portion-mass" ? { ...measurement, value } : measurement,
        ),
      };
      const rejected = performRuntimeAction(continuityGatedMaterial, malformed, {
        actionId: "transfer-portion", verb: "transfer", sourceInstanceId: "source", targetInstanceId: "receiver",
      });
      expect(rejected.completedNodes.includes("transfer-node"), label).toBe(false);
      expect(rejected.equipmentInstances.find((item) => item.id === "source")?.contents.massG, label).toBe(3);
      expect(rejected.equipmentInstances.find((item) => item.id === "receiver")?.contents.kind, label).toBe("empty");
    }
  });

  it("refuses a required delivery whose gating reading names a support other than the poured container", () => {
    // The reading is recorded on the watch glass and the gate names the watch glass, so the
    // prerequisite itself is satisfied. The delivery still empties the beaker, and a correct
    // reading on one object must not authorize emptying another.
    const definition = wholeSupportDeliveryDefinition(5, { readSupportInstanceId: "support" });
    let state = createRuntimeState(definition);
    state = performRuntimeAction(definition, state, { actionId: "weigh-portion", verb: "weigh", value: 5 });
    expect(state.measurements).toContainEqual(expect.objectContaining({
      id: "boat-display-mass", measuredSupportInstanceId: "support",
    }));

    const attempted = performRuntimeAction(definition, state, {
      actionId: "pour-all", verb: "transfer", sourceInstanceId: "source", targetInstanceId: "receiver",
    });
    expect(attempted.completedNodes).not.toContain("pour-node");
    expect(attempted.feedbackQueue.at(-1)?.message).toContain("names a different support");
    expect(attempted.equipmentInstances.find((item) => item.id === "source")?.contents.massG).toBe(5);
    expect(attempted.equipmentInstances.find((item) => item.id === "receiver")?.contents.kind).toBe("empty");
  });

  it("refuses a whole-solid delivery that also declares a measured mass contract", () => {
    const definition = wholeSupportDeliveryDefinition(5, {
      deliveryMass: {
        source: "action-input",
        outputMeasurementId: "contradictory-delivery-mass",
      },
    });
    let state = createRuntimeState(definition);
    state = performRuntimeAction(definition, state, { actionId: "weigh-portion", verb: "weigh", value: 5 });
    const attempted = performRuntimeAction(definition, state, {
      actionId: "pour-all", verb: "transfer", sourceInstanceId: "source", targetInstanceId: "receiver", value: 2,
    });

    expect(attempted.completedNodes).not.toContain("pour-node");
    expect(attempted.feedbackQueue.at(-1)?.message).toContain("delivered amount is ambiguous");
    expect(attempted.equipmentInstances.find((item) => item.id === "source")?.contents.massG).toBe(5);
    expect(attempted.measurements.some((entry) => entry.id === "contradictory-delivery-mass")).toBe(false);
  });

  it("generates the dissolution response once, on the delivery, and never on an empty support", () => {
    const loaded = wholeSupportDeliveryDefinition(5, {
      receiverContents: dissolutionReceiverContents,
      deliveryParameters: dissolutionDeliveryParameters,
    });
    let state = createRuntimeState(loaded);
    state = performRuntimeAction(loaded, state, { actionId: "weigh-portion", verb: "weigh", value: 5 });
    expect(state.dataSeries).toHaveLength(0);

    const delivered = performRuntimeAction(loaded, state, {
      actionId: "pour-all", verb: "transfer", sourceInstanceId: "source", targetInstanceId: "receiver",
    });
    expect(delivered.dataSeries.filter((series) => series.id === "dissolution-series")).toHaveLength(1);

    // The residual step carries no thermal mode, so it must not add or replace a response.
    const residual = performRuntimeAction(loaded, delivered, {
      actionId: "empty-remainder", verb: "transfer", sourceInstanceId: "source", targetInstanceId: "receiver",
    });
    expect(residual.dataSeries.filter((series) => series.id === "dissolution-series")).toHaveLength(1);

    // An empty support fails the required delivery, so no response is fabricated for it.
    const emptied = wholeSupportDeliveryDefinition(0, {
      receiverContents: dissolutionReceiverContents,
      deliveryParameters: dissolutionDeliveryParameters,
    });
    let emptyState = createRuntimeState(emptied);
    emptyState = performRuntimeAction(emptied, emptyState, { actionId: "weigh-portion", verb: "weigh", value: 0 });
    const refused = performRuntimeAction(emptied, emptyState, {
      actionId: "pour-all", verb: "transfer", sourceInstanceId: "source", targetInstanceId: "receiver",
    });
    expect(refused.dataSeries).toHaveLength(0);
  });
});

/**
 * A physical reset preserves `attemptHistory` and starts a new scope generation, so an unqualified
 * `actionEvidence` rule still reads a delivery the reset has already undone. These cover the opt-in
 * qualifier that separates "this attempt delivered" from "some attempt once delivered".
 */
describe("current-generation action evidence", () => {
  /** Weigh, deliver the whole support, then retry the physical setup under the same scope label. */
  const deliverThenPhysicalReset = (definition: TechniqueDefinition, resumeNodeId = "remainder-node") => {
    let state = createRuntimeState(definition);
    state = performRuntimeAction(definition, state, { actionId: "weigh-portion", verb: "weigh", value: 5 });
    state = performRuntimeAction(definition, state, {
      actionId: "pour-all", verb: "transfer", sourceInstanceId: "source", targetInstanceId: "receiver",
    });
    expect(state.completedNodes).toContain("pour-node");
    expect(state.attemptHistory).toContainEqual(expect.objectContaining({
      actionId: "pour-all", success: true, evidenceScopeId: "scope-1", evidenceScopeGeneration: 1,
    }));

    // Same authored scope label, fresh equipment, retained history: only the generation separates
    // the two attempts, which is the sharpest form of the stale-evidence case.
    const retry = performRuntimeAction(definition, state, {
      verb: "reset",
      parameters: { scope: "physical", nextScopeId: "scope-1", resumeNodeId },
    });
    expect(retry.evidenceScopeGeneration).toBe(2);
    expect(retry.attemptHistory.some((attempt) => attempt.actionId === "pour-all" && attempt.success)).toBe(true);
    expect(retry.equipmentInstances.find((item) => item.id === "source")?.contents.massG).toBe(5);
    return retry;
  };

  it("refuses a residual completion whose only delivery evidence belongs to an earlier generation", () => {
    const definition = wholeSupportDeliveryDefinition(5, { residualEvidenceGate: "qualified" });
    const retry = deliverThenPhysicalReset(definition);

    const stale = performRuntimeAction(definition, retry, {
      actionId: "empty-remainder", verb: "transfer", sourceInstanceId: "source", targetInstanceId: "receiver",
    });
    expect(stale.completedNodes).not.toContain("remainder-node");
    expect(stale.feedbackQueue.at(-1)?.message).toContain("delivered in this attempt");
    // The refill is still in the source: the stale record authorized nothing.
    expect(stale.equipmentInstances.find((item) => item.id === "source")?.contents.massG).toBe(5);
    expect(stale.equipmentInstances.find((item) => item.id === "receiver")?.contents.kind).toBe("empty");
  });

  it("accepts a residual completion once the delivery is repeated in the current generation", () => {
    const base = wholeSupportDeliveryDefinition(5, { residualEvidenceGate: "qualified" });
    // A reset intentionally retains completed-node history. Model a later authored repeat segment
    // with fresh nodes that invoke the same actions, instead of mutating the completed-node list.
    const definition: TechniqueDefinition = {
      ...base,
      process: {
        ...base.process,
        nodes: [
          ...base.process.nodes,
          node("weigh-repeat-node", "weigh-portion"),
          node("pour-repeat-node", "pour-all"),
        ],
        edges: [
          ...base.process.edges,
          { from: "weigh-repeat-node", to: "pour-repeat-node", label: "next", condition: { type: "always" } },
          { from: "pour-repeat-node", to: "remainder-node", label: "next", condition: { type: "always" } },
        ],
      },
    };
    let state = deliverThenPhysicalReset(definition, "weigh-repeat-node");
    expect(state.currentNodeId).toBe("weigh-repeat-node");

    state = performRuntimeAction(definition, state, {
      actionId: "weigh-portion", verb: "weigh", value: 5,
    });
    expect(state.currentNodeId).toBe("pour-repeat-node");
    state = performRuntimeAction(definition, state, {
      actionId: "pour-all", verb: "transfer", sourceInstanceId: "source", targetInstanceId: "receiver",
    });
    expect(state.attemptHistory).toContainEqual(expect.objectContaining({
      actionId: "pour-all", success: true, evidenceScopeGeneration: 2,
    }));

    const residual = performRuntimeAction(definition, state, {
      actionId: "empty-remainder", verb: "transfer", sourceInstanceId: "source", targetInstanceId: "receiver",
    });
    expect(residual.completedNodes).toContain("remainder-node");
    expect(isWithinTolerance(
      residual.equipmentInstances.find((item) => item.id === "receiver")?.contents.massG ?? Number.NaN,
      5,
      BALANCE_STEP_G,
    )).toBe(true);
  });

  it("leaves an unqualified actionEvidence rule satisfied by the retained earlier attempt", () => {
    // Legacy compatibility, stated as behaviour rather than as an aspiration: the same retry that
    // the qualified rule refuses still passes an unqualified rule, so nothing outside the opt-in
    // changed.
    const definition = wholeSupportDeliveryDefinition(5, { residualEvidenceGate: "unqualified" });
    const retry = deliverThenPhysicalReset(definition);

    const residual = performRuntimeAction(definition, retry, {
      actionId: "empty-remainder", verb: "transfer", sourceInstanceId: "source", targetInstanceId: "receiver",
    });
    expect(residual.completedNodes).toContain("remainder-node");
  });
});

/**
 * Source-level shape assertions. These read the published technique rather than a fixture, so a
 * simplified runtime fixture cannot quietly stop describing the content that actually ships.
 */
describe("published hand-warmer Part 1 delivery shape", () => {
  const deliveryIds = ["P1-22", "P1-22-T2", "P1-22-R1"] as const;
  const residualIds = ["P1-23", "P1-23-T2", "P1-23-R1"] as const;
  const producerIds = ["P1-19", "P1-19-T2", "P1-19-R1"] as const;

  it("marks every Part 1 delivery as a required non-empty whole-solid transfer with a matching gate", () => {
    const { byId } = handWarmerPartOneDeliveryShape();
    for (const id of deliveryIds) {
      const delivery = byId.get(id);
      expect(delivery, id).toBeDefined();
      expect(delivery!.verb, id).toBe("transfer");
      expect(delivery!.parameters.emptyRemainingSolid, id).toBe(true);
      expect(delivery!.parameters.requireNonEmptySolidSource, id).toBe(true);
      // The whole-solid amount comes from the support's own inventory; a second amount would be
      // ambiguous, and the reducer refuses that combination.
      expect(delivery!.parameters.massG, id).toBeUndefined();
      expect((delivery as { mass?: unknown }).mass, id).toBeUndefined();

      const gate = delivery!.prerequisites.find(
        (rule) => rule.type === "measurementRecorded" && rule.measurementContinuity !== undefined,
      ) as { measurementContinuity: { measuredSupportInstanceId: string; quantityKind: string; producerActionId: string } } | undefined;
      expect(gate, id).toBeDefined();
      expect(gate!.measurementContinuity.quantityKind, id).toBe("balance-display");
      // The gated support must be the very container this action empties.
      expect(gate!.measurementContinuity.measuredSupportInstanceId, id).toBe(delivery!.parameters.sourceInstanceId);
      // `requireNonEmptySolidSource` deliberately does not mean "must always have been weighed" —
      // other demonstrations legitimately empty an unmeasured prepared source. This delivery's
      // measurement gate is authored, not derived, so assert it is still here and still names a
      // producer, which is what makes the runtime match it to the current scope and generation.
      expect(gate!.measurementContinuity.producerActionId, id).toBe(`P1-19${id.slice("P1-22".length)}`);
    }
  });

  it("keeps the 5.00 g confirmation range symmetric without resizing the physical preparation", () => {
    const { technique, byId } = handWarmerPartOneDeliveryShape();
    for (const id of producerIds) {
      const producer = byId.get(id);
      expect(producer?.parameters.inputMin, id).toBe(4.99);
      expect(producer?.parameters.inputMax, id).toBe(5.01);
      expect(producer?.parameters.inputStep, id).toBe(BALANCE_STEP_G);
    }
    // PR-07/PR-08's 5.00 g physical preparation remains 4.5 g plus 0.5 g, and a balance-display
    // entry remains evidence only: it must not alter the whole-boat transfer at P1-22*.
    expect(byId.get("P1-17")?.parameters.massG).toBe(4.5);
    expect(byId.get("P1-18")?.parameters.massG).toBe(0.5);
    const boat = technique.initialState.equipment.find((item) => item.id === "weigh-boat-1");
    expect(boat?.contents).toMatchObject({ kind: "empty", solutes: [] });
    expect(boat?.contents.massG).toBeUndefined();
  });

  it("keeps every Part 1 residual step a permissive completion with its own identity", () => {
    const { byId } = handWarmerPartOneDeliveryShape();
    for (const [index, id] of residualIds.entries()) {
      const residual = byId.get(id);
      expect(residual, id).toBeDefined();
      expect(residual!.verb, id).toBe("transfer");
      expect(residual!.parameters.emptyRemainingSolid, id).toBe(true);
      expect(residual!.parameters.requireNonEmptySolidSource, id).toBeUndefined();
      expect(residual!.atomId, id).toBe("atom.transfer.residual-solid-completion");
      expect(residual!.parameters.sourceInstanceId, id).toBe(byId.get(deliveryIds[index]!)!.parameters.sourceInstanceId);
    }
  });

  it("gates every Part 1 residual step on this attempt's delivery, not on any earlier one", () => {
    const { byId } = handWarmerPartOneDeliveryShape();
    for (const [index, id] of residualIds.entries()) {
      const residual = byId.get(id);
      const gate = residual!.prerequisites.find((rule) => rule.type === "actionEvidence") as
        | { actionId: string; requireCurrentEvidenceScope?: boolean }
        | undefined;
      expect(gate, id).toBeDefined();
      expect(gate!.actionId, id).toBe(deliveryIds[index]);
      expect(gate!.requireCurrentEvidenceScope, id).toBe(true);
    }
  });
});

/**
 * The published mass-output surfaces. `bundled/mass-output` requires a weighing action with an
 * action-input mass contract to collect numeric student-response input, and these five declared
 * something else until this repair.
 */
describe("published mass-output input declarations", () => {
  const publishedTechnique = (file: string) =>
    JSON.parse(readFileSync(join(process.cwd(), "public/techniques", file), "utf8")) as {
      actions: Array<{ id: string; verb: string; parameters: Record<string, unknown>; mass?: { source?: string; outputMeasurementId?: string } }>;
    };

  const surfaces = [
    ["thermal-decomposition-mass-loss.json", "read-empty-crucible"],
    ["thermal-decomposition-mass-loss.json", "weigh-initial-crucible"],
    ["thermal-decomposition-mass-loss.json", "weigh-preliminary-final-mass"],
    ["thermal-decomposition-mass-loss.json", "weigh-final-crucible"],
    ["marble-gas-syringe-kinetics.json", "gas-technique-weigh-marble"],
  ] as const;

  it("declares numeric student-response input on every action-input mass output", () => {
    for (const [file, actionId] of surfaces) {
      const label = `${file}#${actionId}`;
      const technique = publishedTechnique(file);
      const target = technique.actions.find((entry) => entry.id === actionId);
      expect(target, label).toBeDefined();
      expect(target!.verb, label).toBe("weigh");
      expect(target!.mass?.source, label).toBe("action-input");
      expect(target!.parameters.inputMode, label).toBe("numeric");
      expect(target!.parameters.inputRole, label).toBe("studentResponse");

      // Exactly one producer per output is the rule's other half.
      const producers = technique.actions.filter(
        (entry) => entry.mass?.source === "action-input" &&
          entry.mass.outputMeasurementId === target!.mass!.outputMeasurementId,
      );
      expect(producers.map((entry) => entry.id), label).toEqual([actionId]);
    }
  });
});

/**
 * The weighing fixture used to read a balance display attributed to a watch glass nothing had ever
 * been put on. These assert the authored preparation step, and that it debits the bottle exactly
 * once rather than conjuring a second portion at weigh time.
 */
describe("weighing fixture preparation", () => {
  const instance = (state: ReturnType<typeof createRuntimeState>, id: string) =>
    state.equipmentInstances.find((item) => item.id === id);

  it("puts the authored portion on the watch glass before the balance is read", () => {
    let state = createRuntimeState(weighingTechnique);
    expect(instance(state, "reagent-bottle-1")?.contents.massG).toBe(2.5);
    expect(instance(state, "watch-glass-1")?.contents.kind).toBe("empty");

    state = performRuntimeAction(weighingTechnique, state, { actionId: "place-watch-glass", verb: "place" });
    state = performRuntimeAction(weighingTechnique, state, {
      actionId: "transfer-sodium-carbonate-to-watch-glass",
      verb: "transfer",
      sourceInstanceId: "reagent-bottle-1",
      targetInstanceId: "watch-glass-1",
    });

    expect(state.completedNodes).toContain("transfer-sodium-carbonate-node");
    // One debit, one credit: the stock leaves the bottle and the support holds it.
    expect(instance(state, "reagent-bottle-1")?.contents.kind).toBe("empty");
    expect(isWithinTolerance(instance(state, "watch-glass-1")?.contents.massG ?? Number.NaN, 2.5, BALANCE_STEP_G)).toBe(true);
    // Preparation is not measurement: no mass evidence exists until the balance is read.
    expect(state.measurements.some((entry) => entry.id === "solid-mass")).toBe(false);

    state = performRuntimeAction(weighingTechnique, state, {
      actionId: "weigh-solid", verb: "weigh", value: 2.5,
    });
    expect(state.measurements).toContainEqual(expect.objectContaining({
      id: "solid-mass", quantityKind: "balance-display", measuredSupportInstanceId: "watch-glass-1", value: 2.5,
    }));
    // Reading the balance records evidence and moves nothing, so the support still holds one
    // portion and the bottle is still empty.
    expect(isWithinTolerance(instance(state, "watch-glass-1")?.contents.massG ?? Number.NaN, 2.5, BALANCE_STEP_G)).toBe(true);
    expect(instance(state, "reagent-bottle-1")?.contents.kind).toBe("empty");
  });

  it("refuses the balance reading until the sodium carbonate has been transferred", () => {
    const state = createRuntimeState(weighingTechnique);
    const early = performRuntimeAction(weighingTechnique, { ...state, currentNodeId: "weigh-solid-node" }, {
      actionId: "weigh-solid", verb: "weigh", value: 2.5,
    });

    expect(early.completedNodes).not.toContain("weigh-solid-node");
    expect(early.measurements.some((entry) => entry.id === "solid-mass")).toBe(false);
    expect(instance(early, "reagent-bottle-1")?.contents.massG).toBe(2.5);
  });
});

/**
 * Labelled isolated handler tests for the solid-mass source-inventory contract added by F05-A.
 * These drive a synthetic technique fixture directly; they are not a claim that any published
 * lab route was traversed. In particular the fixture's measured `partial-transfer` exists to
 * exercise the shared contract's partial-consumption branch; the shipped brass route delivers the
 * whole vial and offers no such branch, so nothing here says the brass content can reach it.
 *
 * The fixture deliberately omits the `configurationRequired`/`unlocked` session gate so these cases
 * isolate the inventory contract itself. The published brass action does carry that gate, and its
 * enforcement is covered end-to-end in `cycle07Brass.test.ts`.
 *
 * Authored, not executed.
 */
const solidInventoryDefinition = (
  overrides: {
    sourceContents?: TechniqueDefinition["initialState"]["equipment"][number]["contents"];
    inputRole?: string;
    unit?: string;
    /**
     * Require a separate normal notebook assertion before setup can complete. The test first omits
     * it to exercise the post-action failure boundary, then records it before the valid first retry.
     */
    requireConfigureValidationWitness?: boolean;
  } = {},
): TechniqueDefinition => ({
  id: "solid-inventory-runtime-test",
  title: "Solid inventory runtime test",
  learningGoal: "Exercise the teacher-configured solid stock contract.",
  requiredEquipment: ["small-vial", "watch-glass", "beaker-250ml", "analytical-balance"],
  initialState: {
    equipment: [
      { id: "stock", definitionId: "small-vial", label: "Stock vial", location: "workbench", contents: overrides.sourceContents ?? emptyContents() },
      // A second vial of the same definition. Nothing distinguishes it but its identity, which is
      // the point: the contract names one instance and the lifecycle lock is keyed to that one.
      { id: "stock-alt", definitionId: "small-vial", label: "Other stock vial", location: "workbench", contents: emptyContents() },
      { id: "support", definitionId: "watch-glass", label: "Support", location: "workbench", contents: emptyContents() },
      { id: "receiver", definitionId: "beaker-250ml", label: "Receiver", location: "workbench", contents: emptyContents() },
      { id: "balance", definitionId: "analytical-balance", label: "Balance", location: "workbench", contents: emptyContents() },
    ],
  },
  actions: [
    {
      ...action("configure-stock", "observe", {
        sourceInstanceId: "stock",
        sourceDefinitionId: "small-vial",
        visualState: "brass-sample",
        inputMode: "numeric",
        inputRole: overrides.inputRole ?? "teacherConfiguration",
        inputRequired: true,
        unit: overrides.unit ?? "g",
      }),
      interaction: { type: "recordNotebook", valueParameter: "tag", accessibleLabel: "Configure the stock." },
      sourceInventory: {
        quantityKind: "solid-mass",
        sourceInstanceId: "stock",
        sourceDefinitionId: "small-vial",
        outputMeasurementId: "configured-stock",
        materialSoluteId: "configured-solid",
        materialLabel: "Configured solid",
      },
    },
    {
      ...action("record-configure-validation-witness", "observe", {
        tag: "configure-validation-witness",
      }),
      interaction: {
        type: "recordNotebook",
        valueParameter: "tag",
        accessibleLabel: "Record the fixture validation witness.",
      },
    },
    {
      ...action("load-support", "transfer", {
        sourceInstanceId: "stock",
        sourceDefinitionId: "small-vial",
        targetInstanceId: "support",
        targetDefinitionId: "watch-glass",
        emptyRemainingSolid: true,
        requireNonEmptySolidSource: true,
      }),
      prerequisites: [{
        id: "load-needs-stock", type: "measurementRecorded",
        label: "Configured stock exists", measurementId: "configured-stock",
      }],
    },
    {
      ...action("weigh-portion", "weigh", {
        sourceInstanceId: "support",
        sourceDefinitionId: "watch-glass",
        targetDefinitionId: "analytical-balance",
        inputMode: "numeric",
        inputRole: "studentResponse",
        inputRequired: true,
        unit: "g",
      }),
      mass: {
        source: "action-input",
        outputMeasurementId: "portion-mass",
        continuity: {
          version: 1, quantityKind: "material-portion",
          measuredSupportInstanceId: "support", materialSourceInstanceId: "stock",
        },
      },
    },
    {
      ...action("deliver-portion", "transfer", {
        sourceInstanceId: "support",
        sourceDefinitionId: "watch-glass",
        targetInstanceId: "receiver",
        targetDefinitionId: "beaker-250ml",
        emptyRemainingSolid: true,
        requireNonEmptySolidSource: true,
      }),
      prerequisites: [{
        id: "deliver-needs-portion-mass", type: "measurementRecorded",
        label: "Portion mass exists on this support", measurementId: "portion-mass",
        measurementContinuity: {
          version: 1, quantityKind: "material-portion",
          measuredSupportInstanceId: "support", materialSourceInstanceId: "stock",
          producerActionId: "weigh-portion",
        },
      }],
    },
    {
      // A second setup action, with its own id and its own output measurement, bound to the same
      // container. It exists so the lifecycle can be probed from a node that has never completed,
      // without reopening the first node, and so the "different action id" evasion is covered.
      ...action("configure-stock-alt", "observe", {
        sourceInstanceId: "stock",
        sourceDefinitionId: "small-vial",
        visualState: "brass-sample",
        inputMode: "numeric",
        inputRole: overrides.inputRole ?? "teacherConfiguration",
        inputRequired: true,
        unit: overrides.unit ?? "g",
      }),
      interaction: { type: "recordNotebook", valueParameter: "tag", accessibleLabel: "Configure the stock again." },
      sourceInventory: {
        quantityKind: "solid-mass",
        sourceInstanceId: "stock",
        sourceDefinitionId: "small-vial",
        outputMeasurementId: "configured-stock-alt",
        materialSoluteId: "configured-solid",
        materialLabel: "Configured solid",
      },
    },
    // A measured partial withdrawal, so the source keeps a positive remainder afterwards. This is
    // the state the previous guard mistook for an unused source.
    action("partial-transfer", "transfer", {
      sourceInstanceId: "stock",
      sourceDefinitionId: "small-vial",
      targetInstanceId: "receiver",
      targetDefinitionId: "beaker-250ml",
      massG: 0.5,
    }),
    action("reset-setup", "observe", {
      beginEvidenceScopeId: "scope-2",
      resetEquipmentInstanceIds: ["stock", "support", "receiver"],
    }),
    action("reset-source-only", "observe", {
      beginEvidenceScopeId: "scope-3",
      resetEquipmentInstanceIds: ["stock"],
    }),
    action("reset-unrelated", "observe", {
      beginEvidenceScopeId: "scope-4",
      resetEquipmentInstanceIds: ["support"],
    }),
    action("advance-scope", "observe", { beginEvidenceScopeId: "scope-5" }),
  ],
  process: {
    startNodeId: "configure-stock-node",
    nodes: [
      overrides.requireConfigureValidationWitness
        ? {
            ...node("configure-stock-node", "configure-stock"),
            validation: [{
              id: "configure-stock-node-needs-witness",
              type: "notebookEntry",
              label: "The fixture validation witness is recorded",
              notebookTag: "configure-validation-witness",
            }],
          }
        : node("configure-stock-node", "configure-stock"),
      node("record-configure-validation-witness-node", "record-configure-validation-witness"),
      node("load-support-node", "load-support"),
      node("weigh-portion-node", "weigh-portion"),
      node("deliver-portion-node", "deliver-portion"),
      node("configure-stock-alt-node", "configure-stock-alt"),
      node("partial-transfer-node", "partial-transfer"),
      node("reset-setup-node", "reset-setup"),
      node("reset-source-only-node", "reset-source-only"),
      node("reset-unrelated-node", "reset-unrelated"),
      node("advance-scope-node", "advance-scope"),
    ],
    edges: [],
  },
  successCriteria: [],
  commonMistakes: [],
  resetBehavior: "resetTechnique",
  metadata: { version: "1.0.0", author: "test", updatedAt: "2026-09-09T00:00:00.000Z", tags: ["test"] },
});

describe("teacher-configured solid stock inventory", () => {
  const instanceOf = (state: ReturnType<typeof createRuntimeState>, id: string) =>
    state.equipmentInstances.find((entry) => entry.id === id);
  const run = (
    definition: TechniqueDefinition,
    state: ReturnType<typeof createRuntimeState>,
    actionId: string,
    verb: TechniqueDefinition["actions"][number]["verb"],
    value?: number,
  ) => performRuntimeAction(definition, { ...state, currentNodeId: `${actionId}-node` }, {
    actionId, verb, ...(value === undefined ? {} : { value }),
  });

  it("writes one consistent gram total and never compares grams to the vial's mL capacity", () => {
    const definition = solidInventoryDefinition();
    // 25 g exceeds the 20 mL small-vial capacity. A gram inventory must not be range-checked
    // against a volume, and no density conversion may be inferred.
    const state = run(definition, createRuntimeState(definition), "configure-stock", "observe", 25);

    expect(state.completedNodes).toContain("configure-stock-node");
    expect(instanceOf(state, "stock")?.contents.kind).toBe("solid");
    expect(instanceOf(state, "stock")?.contents.massG).toBe(25);
    expect(instanceOf(state, "stock")?.contents.solutes).toEqual([
      { id: "configured-solid", label: "Configured solid", amount: 25, unit: "g" },
    ]);
    expect(instanceOf(state, "stock")?.contents.label).toBe("Configured solid");
    expect(instanceOf(state, "stock")?.contents.visualState).toBe("brass-sample");
    expect(state.measurements).toContainEqual(expect.objectContaining({
      id: "configured-stock", value: 25, unit: "g", equipmentInstanceId: "stock",
      sourceActionId: "configure-stock", evidenceScopeId: "scope-1", evidenceScopeGeneration: 1,
    }));
    // Setup evidence must not masquerade as balance evidence.
    expect(state.measurements.find((entry) => entry.id === "configured-stock")?.quantityKind).toBeUndefined();

    // The material and the lifecycle marker leave the handler together, keyed to the resolved
    // instance, and the marker lives in runtime state rather than in the container's contents.
    expect(state.solidStockInitializations).toEqual({
      stock: {
        actionId: "configure-stock",
        materialSoluteId: "configured-solid",
        configuredMassG: 25,
        evidenceScopeId: "scope-1",
        evidenceScopeGeneration: 1,
      },
    });
    expect(JSON.stringify(instanceOf(state, "stock")?.contents)).not.toContain("solidStockInitializations");
  });

  it("rejects a non-teacher role, a non-positive mass, and incompatible container contents", () => {
    const learnerOwned = solidInventoryDefinition({ inputRole: "studentResponse" });
    const asLearner = run(learnerOwned, createRuntimeState(learnerOwned), "configure-stock", "observe", 2);
    expect(asLearner.completedNodes).not.toContain("configure-stock-node");
    expect(instanceOf(asLearner, "stock")?.contents.kind).toBe("empty");

    const definition = solidInventoryDefinition();
    for (const value of [0, -1, Number.NaN]) {
      const rejected = run(definition, createRuntimeState(definition), "configure-stock", "observe", value);
      expect(rejected.completedNodes, String(value)).not.toContain("configure-stock-node");
      expect(instanceOf(rejected, "stock")?.contents.kind, String(value)).toBe("empty");
    }

    const withLiquid = solidInventoryDefinition({
      sourceContents: { ...emptyContents(), kind: "solution", label: "Solution", volumeMl: 5, wetState: "wet", visualState: "clear-liquid" },
    });
    const liquidRejected = run(withLiquid, createRuntimeState(withLiquid), "configure-stock", "observe", 2);
    expect(liquidRejected.completedNodes).not.toContain("configure-stock-node");
    expect(instanceOf(liquidRejected, "stock")?.contents.volumeMl).toBe(5);

    const multiComponent = solidInventoryDefinition({
      sourceContents: {
        ...emptyContents(), kind: "solid", label: "Two solids",
        solutes: [
          { id: "configured-solid", label: "A", amount: 1, unit: "g" },
          { id: "other-solid", label: "B", amount: 1, unit: "g" },
        ],
        massG: 2, visualState: "powder",
      },
    });
    const ambiguous = run(multiComponent, createRuntimeState(multiComponent), "configure-stock", "observe", 3);
    expect(ambiguous.completedNodes).not.toContain("configure-stock-node");
    expect(instanceOf(ambiguous, "stock")?.contents.massG).toBe(2);

    // A rejected initialization writes no marker, so nothing is half-initialized.
    for (const rejected of [asLearner, liquidRejected, ambiguous]) {
      expect(rejected.solidStockInitializations ?? {}).toEqual({});
      expect(rejected.measurements).toEqual([]);
      expect(rejected.attemptHistory.at(-1)).toMatchObject({ actionId: "configure-stock", success: false });
    }
  });

  it("refuses a same-definition substitute for the bound container, and still allows the real first attempt", () => {
    const definition = solidInventoryDefinition();
    // `stock-alt` is another small-vial. The contract names `stock`, so this is a substitution.
    const substituted = performRuntimeAction(definition, {
      ...createRuntimeState(definition), currentNodeId: "configure-stock-node",
    }, { actionId: "configure-stock", verb: "observe", value: 2, sourceInstanceId: "stock-alt" });

    expect(substituted.completedNodes).not.toContain("configure-stock-node");
    expect(substituted.attemptHistory.at(-1)).toMatchObject({ actionId: "configure-stock", success: false });
    expect(substituted.feedbackQueue.at(-1)?.message).toContain("bound to one named stock container");
    expect(instanceOf(substituted, "stock")?.contents.kind).toBe("empty");
    expect(instanceOf(substituted, "stock-alt")?.contents.kind).toBe("empty");
    expect(substituted.solidStockInitializations ?? {}).toEqual({});

    // A rejected first submission must not consume the one initialization the source is allowed.
    const accepted = run(definition, substituted, "configure-stock", "observe", 2);
    expect(accepted.completedNodes).toContain("configure-stock-node");
    expect(instanceOf(accepted, "stock")?.contents.massG).toBe(2);
    expect(Object.keys(accepted.solidStockInitializations ?? {})).toEqual(["stock"]);
  });

  it("rolls back a failed first solid initialization after node validation and permits a valid retry", () => {
    const definition = solidInventoryDefinition({ requireConfigureValidationWitness: true });
    const initial = createRuntimeState(definition);
    const failed = run(definition, initial, "configure-stock", "observe", 2);

    // The handler reached its success path, but the node did not validate. The first initialization
    // is rolled all the way back: physical contents, marker, setup measurement, node position and
    // completed history remain as they were before the request. The failed diagnostic is retained.
    expect(failed.currentNodeId).toBe(initial.currentNodeId);
    expect(failed.completedNodes).toEqual(initial.completedNodes);
    expect(instanceOf(failed, "stock")?.contents).toEqual(instanceOf(initial, "stock")?.contents);
    expect(failed.solidStockInitializations).toEqual(initial.solidStockInitializations);
    expect(failed.measurements).toEqual(initial.measurements);
    expect(failed.attemptHistory).toHaveLength(initial.attemptHistory.length + 1);
    expect(failed.attemptHistory.at(-1)).toMatchObject({
      actionId: "configure-stock",
      success: false,
      message: "Post-action validation failed; solid stock was not initialized.",
    });
    expect(failed.feedbackQueue.at(-1)?.message).toContain("no solid stock was initialized");
    expect(failed.validationEvidence).toContainEqual(expect.objectContaining({
      ruleId: "configure-stock-node-needs-witness", passed: false,
    }));

    // This is labelled isolated handler coverage: `run` directs each fixture action to its own
    // node. The real notebook-recording handler supplies the missing validation evidence; since
    // the failed attempt left no marker, material, or setup measurement behind, the next accepted
    // request is still the source's first initialization rather than a refill.
    const witnessed = run(definition, failed, "record-configure-validation-witness", "observe");
    expect(witnessed.notebook.some((entry) => entry.tags.includes("configure-validation-witness"))).toBe(true);
    const retry = run(definition, witnessed, "configure-stock", "observe", 2);
    expect(retry.completedNodes).toContain("configure-stock-node");
    expect(instanceOf(retry, "stock")?.contents.massG).toBe(2);
    expect(retry.solidStockInitializations).toEqual(expect.objectContaining({ stock: expect.any(Object) }));
    expect(retry.measurements).toContainEqual(expect.objectContaining({ id: "configured-stock", value: 2 }));
  });

  it("leaves legacy liquid source-inventory post-validation behavior unchanged", () => {
    const definition = solidInventoryDefinition({
      requireConfigureValidationWitness: true,
      sourceContents: {
        ...emptyContents(),
        kind: "solution",
        label: "Legacy liquid source",
        volumeMl: 5,
        wetState: "wet",
        visualState: "clear-liquid",
      },
    });
    const legacyConfigure = definition.actions.find((candidate) => candidate.id === "configure-stock");
    if (!legacyConfigure) throw new Error("Expected the fixture setup action.");
    legacyConfigure.parameters = { ...legacyConfigure.parameters, unit: "mL" };
    legacyConfigure.sourceInventory = {
      sourceInstanceId: "stock",
      sourceDefinitionId: "small-vial",
      outputMeasurementId: "configured-legacy-liquid",
    };

    const state = run(definition, createRuntimeState(definition), "configure-stock", "observe", 8);

    // The rollback is deliberately limited to the new solid-mass contract. This records the
    // legacy liquid branch's current behavior instead of silently changing its handler semantics.
    expect(state.completedNodes).not.toContain("configure-stock-node");
    expect(instanceOf(state, "stock")?.contents.volumeMl).toBe(8);
    expect(state.measurements).toContainEqual(expect.objectContaining({
      id: "configured-legacy-liquid", value: 8, unit: "mL",
    }));
    expect(state.solidStockInitializations).toEqual({});
    expect(state.attemptHistory.at(-1)).toMatchObject({ actionId: "configure-stock", success: true });
  });

  /**
   * One initialization per named source per physical setup.
   *
   * Repeating the *same* node never reaches this guard: `performRuntimeAction` answers an
   * already-completed node with its "already complete" notice before any handler runs, and appends
   * no attempt. Both facts are asserted below. The guard itself is reached two ways: through
   * `configure-stock-alt`, a second setup action with its own id and output bound to the same
   * container, whose node has never completed and which therefore needs no injection at all; and,
   * where the case is specifically about re-entering the first step, through `reopenNode` - a
   * labelled isolated injection that removes the node from `completedNodes` so the handler runs.
   */
  const reopenNode = (state: ReturnType<typeof createRuntimeState>, nodeId: string) => ({
    ...state,
    completedNodes: state.completedNodes.filter((id) => id !== nodeId),
  });
  const configuredStock = (massG = 2) => {
    const definition = solidInventoryDefinition();
    return { definition, state: run(definition, createRuntimeState(definition), "configure-stock", "observe", massG) };
  };

  it("answers a repeat of the setup step itself with the already-complete notice, not a refill", () => {
    const { definition, state } = configuredStock();
    const repeat = run(definition, state, "configure-stock", "observe", 2);

    expect(repeat.feedbackQueue.at(-1)?.message).toContain("already complete");
    expect(repeat.attemptHistory).toHaveLength(state.attemptHistory.length);
    expect(repeat.completedNodes).toEqual(state.completedNodes);
    expect(instanceOf(repeat, "stock")?.contents.massG).toBe(2);
    expect(repeat.solidStockInitializations).toEqual(state.solidStockInitializations);
  });

  it("refuses every repeat initialization of a configured source, whatever its state or value", () => {
    const { definition, state: configured } = configuredStock();

    const expectRefused = (before: ReturnType<typeof createRuntimeState>, value: number, label: string) => {
      const after = run(definition, before, "configure-stock-alt", "observe", value);
      expect(after.completedNodes, label).not.toContain("configure-stock-alt-node");
      expect(after.attemptHistory.at(-1), label).toMatchObject({ actionId: "configure-stock-alt", success: false });
      expect(after.feedbackQueue.at(-1)?.message, label).toContain("already configured for the current physical setup");
      // Handler rejections preserve an existing marker; the new post-validation rollback applies
      // only to a failed *first* solid initialization before any marker has been accepted.
      expect(after.solidStockInitializations, label).toEqual(before.solidStockInitializations);
      expect(after.measurements.some((entry) => entry.id === "configured-stock-alt"), label).toBe(false);
      // Whatever the source held going in, it holds afterwards.
      expect(instanceOf(after, "stock")?.contents, label).toEqual(instanceOf(before, "stock")?.contents);
      expect(instanceOf(after, "receiver")?.contents, label).toEqual(instanceOf(before, "receiver")?.contents);
      // A rejection preserves history it did not create.
      expect(after.completedNodes, label).toEqual(expect.arrayContaining(before.completedNodes));
      return after;
    };

    // Untouched source, unchanged value.
    expectRefused(configured, 2, "same value, unused");
    // Untouched source, different value: correcting an accepted stock is no longer allowed.
    expectRefused(configured, 1.9, "changed value, unused");

    // Partially consumed. This is the case the previous measurement-derived guard let through: it
    // read a positive remainder as "not yet used" and permitted a second full configuration.
    const partiallyUsed = run(definition, configured, "partial-transfer", "transfer");
    expect(instanceOf(partiallyUsed, "stock")?.contents.massG).toBeCloseTo(1.5, 6);
    expect(instanceOf(partiallyUsed, "receiver")?.contents.massG).toBeCloseTo(0.5, 6);
    const afterPartial = expectRefused(partiallyUsed, 2, "partially consumed");
    // Source plus receiver still account for exactly the configured total.
    expect((instanceOf(afterPartial, "stock")?.contents.massG ?? 0) +
      (instanceOf(afterPartial, "receiver")?.contents.massG ?? 0)).toBeCloseTo(2, 6);

    // Fully depleted.
    const depleted = run(definition, configured, "load-support", "transfer");
    expect(instanceOf(depleted, "stock")?.contents.kind).toBe("empty");
    expectRefused(depleted, 2, "fully depleted");

    // The configuration record is gone. Labelled isolated injection: removing evidence is not
    // permission to refill, so the marker rather than the record owns this decision.
    expectRefused({
      ...configured,
      measurements: configured.measurements.filter((entry) => entry.id !== "configured-stock"),
    }, 2, "configuration record removed");

    // The record was replaced with a different value by something outside this handler.
    expectRefused({
      ...configured,
      measurements: configured.measurements.map((entry) =>
        entry.id === "configured-stock" ? { ...entry, value: 99 } : entry),
    }, 2, "configuration record replaced");

    // A scope change is not proof that material was physically restored.
    const rescoped = run(definition, configured, "advance-scope", "observe");
    expect(rescoped.evidenceScopeId).toBe("scope-5");
    expect(rescoped.evidenceScopeGeneration).toBe(2);
    expectRefused(rescoped, 2, "evidence scope advanced");

    // Restoring the source container alone leaves the already-delivered material in the receiver,
    // so a scoped reset of the source is not a physical reset of the setup.
    const sourceOnly = run(definition, partiallyUsed, "reset-source-only", "observe");
    expect(instanceOf(sourceOnly, "stock")?.contents.kind).toBe("empty");
    expect(instanceOf(sourceOnly, "receiver")?.contents.massG).toBeCloseTo(0.5, 6);
    expectRefused(sourceOnly, 2, "source-only scoped reset");

    // A scoped reset of unrelated equipment changes nothing about this source.
    expectRefused(run(definition, configured, "reset-unrelated", "observe"), 2, "unrelated equipment reset");

    // The authored multi-instance scoped reset is still a scoped reset, so it too retains the lock.
    const scopedResetAll = run(definition, depleted, "reset-setup", "observe");
    expect(scopedResetAll.evidenceScopeGeneration).toBe(2);
    expect(instanceOf(scopedResetAll, "support")?.contents.kind).toBe("empty");
    expectRefused(scopedResetAll, 1.5, "authored scoped reset of source, support and receiver");

    // Re-entering the first setup step reaches the same guard once the already-complete notice is
    // out of the way. Labelled isolated injection of `completedNodes` only.
    const reopened = run(definition, reopenNode(depleted, "configure-stock-node"), "configure-stock", "observe", 2);
    expect(reopened.attemptHistory.at(-1)).toMatchObject({ actionId: "configure-stock", success: false });
    expect(reopened.feedbackQueue.at(-1)?.message).toContain("already configured for the current physical setup");
    expect(instanceOf(reopened, "stock")?.contents.kind).toBe("empty");
  });

  it("clears the lifecycle on a full physical reset and then permits exactly one new initialization", () => {
    const { definition, state: configured } = configuredStock();
    const used = run(definition, configured, "load-support", "transfer");

    const reset = performRuntimeAction(definition, used, {
      verb: "reset", parameters: { scope: "physical" },
    });

    // Fresh containers, cleared lifecycle, retained evidence and history.
    expect(reset.solidStockInitializations).toEqual({});
    expect(instanceOf(reset, "stock")?.contents.kind).toBe("empty");
    expect(instanceOf(reset, "support")?.contents.kind).toBe("empty");
    expect(instanceOf(reset, "receiver")?.contents.kind).toBe("empty");
    expect(reset.measurements.some((entry) => entry.id === "configured-stock")).toBe(true);
    expect(reset.completedNodes).toEqual(used.completedNodes);
    expect(reset.evidenceScopeGeneration).toBe(2);

    // The retained configuration record does not re-lock the source: the marker owns that.
    const reconfigured = run(definition, reset, "configure-stock-alt", "observe", 1.5);
    expect(reconfigured.completedNodes).toContain("configure-stock-alt-node");
    expect(instanceOf(reconfigured, "stock")?.contents.massG).toBe(1.5);
    expect(reconfigured.solidStockInitializations).toEqual({
      stock: {
        actionId: "configure-stock-alt",
        materialSoluteId: "configured-solid",
        configuredMassG: 1.5,
        evidenceScopeId: reset.evidenceScopeId,
        evidenceScopeGeneration: 2,
      },
    });

    // Exactly one: the other setup action is refused again in the new setup.
    const second = run(definition, reopenNode(reconfigured, "configure-stock-node"), "configure-stock", "observe", 1.5);
    expect(second.feedbackQueue.at(-1)?.message).toContain("already configured for the current physical setup");
    expect(instanceOf(second, "stock")?.contents.massG).toBe(1.5);

    // A wholly fresh runtime is likewise uninitialized.
    expect(createRuntimeState(definition).solidStockInitializations).toEqual({});
  });

  it("conserves the configured portion through the load, the reading and the delivery", () => {
    const definition = solidInventoryDefinition();
    let state = run(definition, createRuntimeState(definition), "configure-stock", "observe", 1.482);
    state = run(definition, state, "load-support", "transfer");
    state = run(definition, state, "weigh-portion", "weigh", 1.481);

    // The reading is evidence only: the support still holds the configured portion.
    expect(instanceOf(state, "support")?.contents.massG).toBe(1.482);
    expect(state.measurements).toContainEqual(expect.objectContaining({
      id: "portion-mass", value: 1.481, quantityKind: "material-portion",
      measuredSupportInstanceId: "support", materialSourceInstanceId: "stock",
    }));

    // Advancing the evidence scope leaves the physical portion in place but makes its old reading
    // stale. The uncompleted delivery node must refuse it rather than consuming the support.
    const rescoped = run(definition, state, "advance-scope", "observe");
    expect(rescoped.evidenceScopeGeneration).toBe(2);
    const staleDelivery = run(definition, rescoped, "deliver-portion", "transfer");
    expect(staleDelivery.completedNodes).not.toContain("deliver-portion-node");
    expect(staleDelivery.feedbackQueue.at(-1)?.message).toContain("Portion mass exists on this support");
    expect(instanceOf(staleDelivery, "support")?.contents.massG).toBe(1.482);
    expect(instanceOf(staleDelivery, "receiver")?.contents.kind).toBe("empty");
    expect(staleDelivery.attemptHistory.at(-1)).toMatchObject({
      actionId: "deliver-portion", success: false, evidenceScopeGeneration: 2,
    });

    state = run(definition, state, "deliver-portion", "transfer");
    // The receiver gets the actual portion, not the reading, and the support empties exactly once.
    expect(instanceOf(state, "receiver")?.contents.massG).toBe(1.482);
    expect(instanceOf(state, "support")?.contents.kind).toBe("empty");
    expect(isWithinTolerance(1.482 - 1.481, 0, BALANCE_STEP_G)).toBe(true);

    const again = run(definition, state, "deliver-portion", "transfer");
    expect(again.completedNodes).toEqual(state.completedNodes);
    expect(again.attemptHistory).toHaveLength(state.attemptHistory.length);
    expect(again.feedbackQueue.at(-1)?.message).toContain("already complete");
    expect(instanceOf(again, "receiver")?.contents.massG).toBe(1.482);
  });

  it("refuses the load before the stock is configured", () => {
    const definition = solidInventoryDefinition();
    const early = run(definition, createRuntimeState(definition), "load-support", "transfer");
    expect(early.completedNodes).not.toContain("load-support-node");
    expect(instanceOf(early, "support")?.contents.kind).toBe("empty");
    expect(instanceOf(early, "stock")?.contents.kind).toBe("empty");
  });
});
