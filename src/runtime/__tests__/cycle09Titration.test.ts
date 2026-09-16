/**
 * Cycle 09 — titration runtime.
 *
 * Authored under the repository's validation policy (AGENTS.md) and deliberately NOT executed in the
 * cycle that wrote them. They cover the behaviour the static checks cannot reach: the burette read,
 * the three dispense gates, the authored endpoint colours, and the three redox calculation
 * templates that had no implementation at all before this cycle.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  calculateHydrogenPeroxidePercent,
  calculateMeanOfValues,
  calculatePermanganateMolarityFromIron,
  HYDROGEN_PEROXIDE_MOLAR_MASS_G_MOL,
} from "../calculations";
import { deriveTitrationDropPlan } from "../../domain/titrationModels";
import { emptyContents } from "../../domain/types";
import type {
  ActionDefinition,
  ContentState,
  ProcessNode,
  RedoxTitrationModel,
  RuntimeState,
  TechniqueDefinition,
} from "../../domain/types";
import { createRuntimeState, makeAttachmentRelation, performRuntimeAction } from "../index";

const ironStandardization: RedoxTitrationModel = {
  id: "iron-standardization",
  type: "redox",
  analyteMolarityM: 0.1,
  analyteVolumeMl: 10,
  titrantMolarityM: 1 / 49,
  stoichiometricRatio: { analyte: 5, titrant: 1 },
  dropVolumeMl: 0.2,
  endpointOffsetDrops: 0,
  maxExtraDrops: 1,
};

const samplePeroxide: RedoxTitrationModel = {
  ...ironStandardization,
  id: "sample-a-peroxide",
  analyteMolarityM: 0.88,
  analyteVolumeMl: 1,
  stoichiometricRatio: { analyte: 5, titrant: 2 },
  analyteMolarMassGPerMol: HYDROGEN_PEROXIDE_MOLAR_MASS_G_MOL,
  sampleDensityGPerMl: 1,
};

describe("redox titration models", () => {
  it("derives a redox drop plan rather than requiring an authored drop count", () => {
    const plan = deriveTitrationDropPlan(ironStandardization);
    expect(plan.type).toBe("redox");
    expect(plan.theoreticalEquivalenceVolumeMl).toBeCloseTo(9.8, 6);
    expect(plan.endpointDropCount).toBe(49);
    expect(plan.endpointDeliveredVolumeMl).toBeCloseTo(9.8, 6);
  });

  it("reports a mass and a percent only when the model supplies the basis for them", () => {
    const withoutMass = deriveTitrationDropPlan(ironStandardization);
    expect(withoutMass.expectedAnalyteMassG).toBeUndefined();
    expect(withoutMass.expectedAnalytePercentByMass).toBeUndefined();

    const withMass = deriveTitrationDropPlan(samplePeroxide);
    expect(withMass.expectedAnalytePercentByMass).toBeGreaterThan(2.9);
    expect(withMass.expectedAnalytePercentByMass).toBeLessThan(3.1);
  });

  it("rejects a model type it cannot plan", () => {
    expect(() =>
      deriveTitrationDropPlan({ ...ironStandardization, type: "conductometric" } as never),
    ).toThrow(/acidBase or redox/);
  });
});

describe("permanganate standardization", () => {
  it("recovers the titrant molarity from the student's own aliquot and readings", () => {
    const value = calculatePermanganateMolarityFromIron(0.1, 10, 5, 14.8);
    expect(value).toBeCloseTo(1 / 49, 6);
  });

  it("refuses to report a value when the final reading is not greater than the initial one", () => {
    expect(() => calculatePermanganateMolarityFromIron(0.1, 10, 14.8, 5)).toThrow(
      /Final burette reading/,
    );
  });

  it("refuses a missing standard concentration rather than assuming one", () => {
    expect(() => calculatePermanganateMolarityFromIron(Number.NaN, 10, 5, 14.8)).toThrow(
      /Standard molarity/,
    );
  });
});

describe("percent hydrogen peroxide", () => {
  it("uses the 5:2 permanganate/peroxide ratio and the manual's stated density", () => {
    const value = calculateHydrogenPeroxidePercent(1 / 49, 5, 22.4, 1, 1);
    // 17.4 mL delivered -> 3.55e-4 mol MnO4- -> 8.88e-4 mol H2O2 -> 0.0302 g in a 1.00 g sample.
    expect(value).toBeCloseTo(3.02, 2);
  });

  it("scales with the density the teacher configured instead of hard-coding 1.00 g/mL", () => {
    const unit = calculateHydrogenPeroxidePercent(1 / 49, 5, 22.4, 1, 1);
    const denser = calculateHydrogenPeroxidePercent(1 / 49, 5, 22.4, 1, 1.1);
    expect(denser).toBeCloseTo(unit / 1.1, 4);
  });

  it("refuses a zero or missing sample aliquot", () => {
    expect(() => calculateHydrogenPeroxidePercent(1 / 49, 5, 22.4, 0, 1)).toThrow(
      /Sample aliquot volume/,
    );
  });
});

describe("replicate averaging", () => {
  it("averages the trial results it is given", () => {
    expect(calculateMeanOfValues([3.0, 3.1, 2.9])).toBeCloseTo(3, 6);
  });

  it("rejects a replicate spread wider than the configured acceptable range", () => {
    expect(() => calculateMeanOfValues([0.0204, 0.0219], { maximumRange: 0.0001 })).toThrow(
      /exceeds the configured acceptable range/,
    );
  });

  it("refuses to average nothing", () => {
    expect(() => calculateMeanOfValues([])).toThrow(/At least one trial result/);
  });

  it("refuses to average an unrecorded trial", () => {
    expect(() => calculateMeanOfValues([3.0, Number.NaN])).toThrow(/must be recorded/);
  });
});

/* ------------------------------------------------------------------ *
 * The reducer half of the same behaviour.
 *
 * One fixture technique carries the whole titration chain, because the chain is the thing under
 * test: before Cycle 09 the burette could not be read at all, a dispense counted from an authored
 * constant or a fabricated 0.00 mL, and the endpoint colours and prose were unconditional
 * acid-base wording that a redox flow inherited unchanged.
 * ------------------------------------------------------------------ */

const action = (
  id: string,
  verb: ActionDefinition["verb"],
  parameters: ActionDefinition["parameters"],
  interaction?: ActionDefinition["interaction"],
): ActionDefinition => ({
  id,
  verb,
  label: id,
  parameters,
  ...(interaction ? { interaction } : {}),
  prerequisites: [],
  stateChanges: [],
  invalidCases: [],
  feedback: { success: `${id} ok`, invalid: `${id} invalid` },
  evidence: [verb],
});

const node = (actionId: string): ProcessNode => ({
  id: `${actionId}-node`,
  type: "action",
  title: actionId,
  description: actionId,
  actionId,
  config: {},
  validation: [],
  hints: [],
  feedback: { success: "ok", retry: "retry" },
});

const titrantContents = (volumeMl: number): ContentState => ({
  ...emptyContents(),
  kind: "solution",
  label: "Permanganate titrant",
  volumeMl,
  solutes: [{ id: "kmno4", label: "Potassium permanganate", amount: 0.02, unit: "mol" }],
  wetState: "wet",
  visualState: "permanganate-solution",
});

const analyteContents = (volumeMl: number): ContentState => ({
  ...emptyContents(),
  kind: "solution",
  label: "Acidified analyte",
  volumeMl,
  wetState: "wet",
  visualState: "redox-colorless-solution",
});

const titrationFixture = (options: {
  buretteMl: number;
  flaskMl: number;
  buretteMounted: boolean;
  receiverPositioned?: boolean;
  requireReceiverPosition?: boolean;
}): TechniqueDefinition => {
  const receiverPositioned = options.receiverPositioned ?? true;
  const actions = [
    action(
      "fx-read-initial",
      "measureVolume",
      {
        sourceDefinitionId: "burette-50ml",
        measurementId: "fx-initial",
        label: "Initial burette reading",
        readingPrecisionMl: 0.05,
        scaleReadsDownward: true,
      },
      {
        type: "readInstrument",
        sourceDefinitionId: "burette-50ml",
        accessibleLabel: "Read the burette scale.",
      },
    ),
    action(
      "fx-dispense",
      "transfer",
      {
        titrationModelId: "fx-model",
        sourceDefinitionId: "burette-50ml",
        targetDefinitionId: "erlenmeyer-flask-250ml",
        ...(options.requireReceiverPosition === false
          ? {}
          : { requiredTargetSnapZoneId: "ring-stand-burette-receiver" }),
        initialBuretteMeasurementId: "fx-initial",
        finalBuretteMeasurementId: "fx-final",
        preEndpointVisualState: "redox-colorless-solution",
        endpointVisualState: "permanganate-faint-pink",
        overshootVisualState: "permanganate-overshoot-purple",
        endpointLabel: "Persistent faint-pink endpoint",
        overshootLabel: "the dark red-purple shows the permanganate is now in excess",
        mixtureLabel: "Acidified redox reaction mixture",
      },
      {
        type: "dispenseDrops",
        sourceDefinitionId: "burette-50ml",
        targetDefinitionId: "erlenmeyer-flask-250ml",
        accessibleLabel: "Deliver titrant one drop at a time.",
      },
    ),
  ];

  return {
    id: "fx-titration",
    title: "Fixture titration",
    learningGoal: "Exercise the burette read and the dispense gates.",
    requiredEquipment: ["burette-50ml", "ring-stand-clamp", "erlenmeyer-flask-250ml"],
    titrationModels: [
      {
        id: "fx-model",
        type: "redox",
        analyteMolarityM: 0.1,
        analyteVolumeMl: 10,
        titrantMolarityM: 1 / 49,
        stoichiometricRatio: { analyte: 5, titrant: 1 },
        dropVolumeMl: 0.2,
        endpointOffsetDrops: 0,
        maxExtraDrops: 1,
      },
    ],
    initialState: {
      equipment: [
        {
          id: "fx-burette",
          definitionId: "burette-50ml",
          label: "Burette",
          location: options.buretteMounted ? "snapZone" : "workbench",
          ...(options.buretteMounted
            ? { parentInstanceId: "fx-stand", snapZoneId: "ring-stand-burette-clamp" }
            : {}),
          contents: options.buretteMl > 0 ? titrantContents(options.buretteMl) : emptyContents(),
        },
        {
          id: "fx-stand",
          definitionId: "ring-stand-clamp",
          label: "Ring stand and clamp",
          location: "workbench",
          contents: emptyContents(),
        },
        {
          id: "fx-flask",
          definitionId: "erlenmeyer-flask-250ml",
          label: "Titration flask",
          location: receiverPositioned ? "snapZone" : "workbench",
          ...(receiverPositioned
            ? { parentInstanceId: "fx-stand", snapZoneId: "ring-stand-burette-receiver" }
            : {}),
          contents: options.flaskMl > 0 ? analyteContents(options.flaskMl) : emptyContents(),
        },
      ],
    },
    actions,
    process: {
      startNodeId: "fx-read-initial-node",
      nodes: actions.map((entry) => node(entry.id)),
      edges: [
        {
          from: "fx-read-initial-node",
          to: "fx-dispense-node",
          label: "Next",
          condition: { type: "validationPassed" as const },
        },
      ],
    },
    successCriteria: [],
    commonMistakes: [],
    resetBehavior: "resetTechnique",
    metadata: { version: "1.0.0", author: "fixture", updatedAt: "2026-08-05T00:00:00.000Z", tags: [] },
  };
};

const lastMessage = (state: RuntimeState): string =>
  state.feedbackQueue[state.feedbackQueue.length - 1]?.message ?? "";

const atFixtureAction = (
  definition: TechniqueDefinition,
  state: RuntimeState,
  actionId: string,
): RuntimeState => {
  const processNode = definition.process.nodes.find((node) => node.actionId === actionId);
  if (!processNode) throw new Error(`Missing fixture process node for ${actionId}`);
  return {
    ...state,
    currentNodeId: processNode.id,
    completedNodes: state.completedNodes.filter((nodeId) => nodeId !== processNode.id),
  };
};

const withFixtureAttachments = (
  state: RuntimeState,
  options: { buretteMounted: boolean; receiverPositioned?: boolean },
): RuntimeState => {
  const attachments = [
    options.buretteMounted
      ? makeAttachmentRelation("fx-stand", "fx-burette", "ring-stand-burette-clamp")
      : undefined,
    (options.receiverPositioned ?? true)
      ? makeAttachmentRelation("fx-stand", "fx-flask", "ring-stand-burette-receiver")
      : undefined,
  ].filter((attachment): attachment is NonNullable<typeof attachment> => attachment !== undefined);
  return { ...state, attachments };
};

const dispenseFixture = (definition: TechniqueDefinition, state: RuntimeState): RuntimeState =>
  performRuntimeAction(definition, atFixtureAction(definition, state, "fx-dispense"), {
    actionId: "fx-dispense",
    verb: "transfer",
    sourceInstanceId: "fx-burette",
    targetInstanceId: "fx-flask",
  });

describe("reading the burette", () => {
  it("derives the reading from the instrument rather than from an authored constant", () => {
    const definition = titrationFixture({ buretteMl: 45, flaskMl: 15, buretteMounted: true });
    const state = performRuntimeAction(definition, createRuntimeState(definition), {
      actionId: "fx-read-initial",
      verb: "measureVolume",
      sourceInstanceId: "fx-burette",
    });
    // A burette is graduated downwards: 45 mL of titrant in a 50 mL burette reads 5.00 mL.
    expect(state.measurements.find((entry) => entry.id === "fx-initial")?.value).toBeCloseTo(5, 2);
  });

  it("moves nothing: a reading is not a delivery", () => {
    const definition = titrationFixture({ buretteMl: 45, flaskMl: 15, buretteMounted: true });
    const state = performRuntimeAction(definition, createRuntimeState(definition), {
      actionId: "fx-read-initial",
      verb: "measureVolume",
      sourceInstanceId: "fx-burette",
    });
    expect(state.equipmentInstances.find((i) => i.id === "fx-burette")?.contents.volumeMl).toBe(45);
    expect(state.equipmentInstances.find((i) => i.id === "fx-flask")?.contents.volumeMl).toBe(15);
  });

  it("refuses to read an empty burette instead of reporting a full-scale value", () => {
    const definition = titrationFixture({ buretteMl: 0, flaskMl: 15, buretteMounted: true });
    const state = performRuntimeAction(definition, createRuntimeState(definition), {
      actionId: "fx-read-initial",
      verb: "measureVolume",
      sourceInstanceId: "fx-burette",
    });
    expect(state.measurements.find((entry) => entry.id === "fx-initial")).toBeUndefined();
    expect(lastMessage(state)).toMatch(/empty/i);
  });
});

describe("dispense gates", () => {
  const readyState = (options: {
    buretteMl: number;
    flaskMl: number;
    buretteMounted: boolean;
    receiverPositioned?: boolean;
    requireReceiverPosition?: boolean;
  }) => {
    const definition = titrationFixture(options);
    let state = withFixtureAttachments(createRuntimeState(definition), options);
    if (options.buretteMl > 0) {
      state = performRuntimeAction(definition, state, {
        actionId: "fx-read-initial",
        verb: "measureVolume",
        sourceInstanceId: "fx-burette",
      });
    }
    return { definition, state };
  };

  it("refuses to dispense from a burette that is not clamped", () => {
    const { definition, state } = readyState({
      buretteMl: 45,
      flaskMl: 15,
      buretteMounted: false,
      requireReceiverPosition: false,
    });
    // Receiver positioning is covered separately. Remove only that outer gate so this isolated
    // case reaches the clamp check without changing the production reducer's guard ordering.
    const next = dispenseFixture(definition, state);
    expect(lastMessage(next)).toMatch(/clamp/i);
    expect(next.dropDispenses["fx-dispense"]).toBeUndefined();
  });

  it("refuses to dispense into an empty receiver", () => {
    const { definition, state } = readyState({ buretteMl: 45, flaskMl: 0, buretteMounted: true });
    const next = dispenseFixture(definition, state);
    expect(lastMessage(next)).toMatch(/empty/i);
    expect(next.dropDispenses["fx-dispense"]).toBeUndefined();
  });

  it("refuses to dispense until the receiving flask is positioned below the mounted burette", () => {
    const { definition, state } = readyState({
      buretteMl: 45,
      flaskMl: 15,
      buretteMounted: true,
      receiverPositioned: false,
    });
    const next = dispenseFixture(definition, state);

    expect(lastMessage(next)).toMatch(/not positioned beneath the mounted burette/i);
    expect(next.dropDispenses["fx-dispense"]).toBeUndefined();
  });

  it("refuses to dispense before the initial reading has been taken", () => {
    const definition = titrationFixture({ buretteMl: 45, flaskMl: 15, buretteMounted: true });
    const next = dispenseFixture(definition, createRuntimeState(definition));
    expect(lastMessage(next)).toMatch(/initial burette reading/i);
    expect(next.dropDispenses["fx-dispense"]).toBeUndefined();
  });

  it("counts from the recorded reading, never from a fabricated zero", () => {
    const { definition, state } = readyState({ buretteMl: 45, flaskMl: 15, buretteMounted: true });
    const next = dispenseFixture(definition, state);
    expect(next.dropDispenses["fx-dispense"].initialBuretteReadingMl).toBeCloseTo(5, 2);
    expect(next.dropDispenses["fx-dispense"].currentBuretteReadingMl).toBeCloseTo(5.2, 2);
  });
});

const endpointTechnique = JSON.parse(
  readFileSync(join(process.cwd(), "public", "techniques", "titration-endpoint.json"), "utf8"),
) as TechniqueDefinition;

const atEndpointAction = (state: RuntimeState, actionId: string): RuntimeState => {
  const processNode = endpointTechnique.process.nodes.find((node) => node.actionId === actionId);
  if (!processNode) throw new Error(`Missing endpoint process node for ${actionId}`);
  return {
    ...state,
    currentNodeId: processNode.id,
    completedNodes: state.completedNodes.filter((nodeId) => nodeId !== processNode.id),
  };
};

const runEndpointAction = (state: RuntimeState, actionId: string): RuntimeState => {
  const actionDefinition = endpointTechnique.actions.find((action) => action.id === actionId);
  if (!actionDefinition) throw new Error(`Missing endpoint action for ${actionId}`);
  return performRuntimeAction(endpointTechnique, atEndpointAction(state, actionId), {
    actionId,
    verb: actionDefinition.verb,
  });
};

const endpointAttachment = (parentInstanceId: string, childInstanceId: string, zoneId: string) => {
  const attachment = makeAttachmentRelation(parentInstanceId, childInstanceId, zoneId);
  if (!attachment) throw new Error(`Missing endpoint attachment for ${zoneId}`);
  return attachment;
};

const preparedEndpointState = (): RuntimeState => {
  const state = createRuntimeState(endpointTechnique);
  return {
    ...state,
    equipmentInstances: state.equipmentInstances.map((instance) => {
      if (instance.id === "ring-stand-clamp-1") return { ...instance, location: "workbench" };
      if (instance.id === "burette-50ml-1") {
        return {
          ...instance,
          location: "snapZone",
          parentInstanceId: "ring-stand-clamp-1",
          snapZoneId: "ring-stand-burette-clamp",
          contents: titrantContents(45),
        };
      }
      if (instance.id === "funnel-1") {
        return {
          ...instance,
          location: "snapZone",
          parentInstanceId: "burette-50ml-1",
          snapZoneId: "burette-funnel-seat",
        };
      }
      return instance;
    }),
    attachments: [
      endpointAttachment("ring-stand-clamp-1", "burette-50ml-1", "ring-stand-burette-clamp"),
      endpointAttachment("burette-50ml-1", "funnel-1", "burette-funnel-seat"),
    ],
  };
};

describe("acid-base filling funnel gates", () => {
  it("keeps direct burette conditioning ahead of later funnel seating", () => {
    const nodes = new Map(endpointTechnique.process.nodes.map((node) => [node.actionId, node]));
    const edges = new Set(endpointTechnique.process.edges.map((edge) => `${edge.from}->${edge.to}`));
    const condition = endpointTechnique.actions.find((action) => action.id === "condition-burette");

    expect(condition?.parameters.requiredAttachmentState).toBeUndefined();
    expect(edges.has(`${nodes.get("condition-burette-discard-rinsate")?.id}->${nodes.get("seat-burette-funnel")?.id}`)).toBe(true);
    expect(edges.has(`${nodes.get("seat-burette-funnel")?.id}->${nodes.get("fill-burette")?.id}`)).toBe(true);
  });

  it("rejects fill when the filling funnel is not currently seated", () => {
    const state = createRuntimeState(endpointTechnique);
    const beforeVolume = state.equipmentInstances.find((instance) => instance.id === "burette-50ml-1")?.contents.volumeMl;

    const rejected = runEndpointAction(state, "fill-burette");

    expect(lastMessage(rejected)).toMatch(/funnel.*not seated/i);
    expect(rejected.equipmentInstances.find((instance) => instance.id === "burette-50ml-1")?.contents.volumeMl).toBe(beforeVolume);
  });

  it("removes the funnel to the workbench, gates the read against a live reattachment, and resets cleanly", () => {
    const state = runEndpointAction(preparedEndpointState(), "remove-burette-funnel");

    expect(state.equipmentInstances.find((instance) => instance.id === "funnel-1")?.location).toBe("workbench");
    expect(state.attachments.some((attachment) => attachment.childInstanceId === "funnel-1")).toBe(false);

    const blockedRead = runEndpointAction(
      {
        ...state,
        attachments: [...state.attachments, endpointAttachment("burette-50ml-1", "funnel-1", "burette-funnel-seat")],
      },
      "read-initial-burette",
    );
    expect(lastMessage(blockedRead)).toMatch(/still seated/i);
    expect(blockedRead.measurements.some((measurement) => measurement.id === "burette-initial-volume")).toBe(false);

    const reset = performRuntimeAction(endpointTechnique, state, { verb: "reset" });
    expect(reset.attachments).toEqual([]);
    expect(reset.equipmentInstances.find((instance) => instance.id === "funnel-1")?.location).toBe("shelf");
  });
});

describe("endpoint appearance and narration", () => {
  const runToEndpoint = () => {
    const definition = titrationFixture({ buretteMl: 45, flaskMl: 15, buretteMounted: true });
    let state = performRuntimeAction(definition, withFixtureAttachments(createRuntimeState(definition), { buretteMounted: true }), {
      actionId: "fx-read-initial",
      verb: "measureVolume",
      sourceInstanceId: "fx-burette",
    });
    for (let drop = 0; drop < 49; drop += 1) {
      state = dispenseFixture(definition, state);
    }
    return { definition, state };
  };

  it("reaches the model-derived endpoint after exactly its derived drop count", () => {
    const { state } = runToEndpoint();
    expect(state.dropDispenses["fx-dispense"].dropsDispensed).toBe(49);
    expect(state.dropDispenses["fx-dispense"].endpointDropCount).toBe(49);
  });

  it("uses the authored endpoint colour and label at the endpoint", () => {
    const { state } = runToEndpoint();
    expect(state.equipmentInstances.find((i) => i.id === "fx-flask")?.contents.visualState).toBe(
      "permanganate-faint-pink",
    );
    expect(lastMessage(state)).toMatch(/faint-pink/i);
    expect(lastMessage(state)).not.toMatch(/NaOH/);
  });

  it("uses the authored overshoot colour and never calls a redox overshoot alkaline", () => {
    const { definition, state } = runToEndpoint();
    const over = dispenseFixture(definition, state);
    expect(over.equipmentInstances.find((i) => i.id === "fx-flask")?.contents.visualState).toBe(
      "permanganate-overshoot-purple",
    );
    expect(lastMessage(over)).toMatch(/in excess/i);
    expect(lastMessage(over)).not.toMatch(/alkaline/i);
  });

  it("labels the titrand as the reaction mixture it is, not as an acid mixture", () => {
    const { state } = runToEndpoint();
    expect(state.equipmentInstances.find((i) => i.id === "fx-flask")?.contents.label).toBe(
      "Acidified redox reaction mixture",
    );
  });
});
