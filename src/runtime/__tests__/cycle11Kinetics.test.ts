/**
 * Cycle 11 — Investigation 10 gas-syringe kinetics and Investigation 6 bonding in unknown solids.
 *
 * These cover the runtime behaviour Cycle 11 depends on and could not execute under the repository's
 * validation policy (`AGENTS.md`): the corrected apparatus chronology, the leak-and-baseline gate
 * before reactant contact, the solid transfer that finally gives the marble reaction a physical
 * start, the instrument-read evidence path that proves bonding apparatus is present without
 * inventing a reading, and the sample independence that keeps twelve blind vials from sharing
 * evidence.
 *
 * `performRuntimeAction` refuses any action that is not the current node's
 * (`reducer.ts`: "That action is not expected at this point in the process"), so a fixture that
 * declares more steps than a test drives would fail on the process gate rather than on the behaviour
 * under test. Every fixture here therefore contains **exactly the actions its test performs, in the
 * order it performs them**, and `drive` asserts that correspondence rather than trusting it. The first
 * draft of this file did not, and would have failed for the wrong reason in eight places.
 *
 * Authored, not executed. See `docs/_cycle-11-audit-section.md` § 24.
 */
import { describe, expect, it } from "vitest";
import { emptyContents } from "../../domain/types";
import type {
  ActionDefinition,
  ContentState,
  EquipmentInstance,
  ProcessNode,
  RuntimeActionRequest,
  RuntimeState,
  TechniqueDefinition,
} from "../../domain/types";
import { equipmentById } from "../../equipment/catalog";
import { createRuntimeState, performRuntimeAction } from "../index";

/* ------------------------------------------------------------------ *
 * Fixture plumbing.
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
  interaction,
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

type Bench = { id: string; definitionId: string; label: string; contents: ContentState };

/** A technique whose process is exactly `actions`, chained in array order. */
const bench = (id: string, actions: ActionDefinition[], equipment: Bench[]): TechniqueDefinition => ({
  id,
  title: id,
  learningGoal: id,
  requiredEquipment: [...new Set(equipment.map((item) => item.definitionId))],
  initialState: {
    equipment: equipment.map((item) => ({ ...item, location: "workbench" as const })),
  },
  actions,
  process: {
    startNodeId: `${actions[0].id}-node`,
    nodes: actions.map((entry) => node(entry.id)),
    edges: actions.slice(1).map((entry, index) => ({
      from: `${actions[index].id}-node`,
      to: `${entry.id}-node`,
      label: "Next",
      condition: { type: "validationPassed" as const },
    })),
  },
  successCriteria: [],
  commonMistakes: [],
  resetBehavior: "resetTechnique",
  metadata: { version: "1.0.0", author: "fixture", updatedAt: "2026-08-05T00:00:00.000Z", tags: [] },
});

const without = (definition: TechniqueDefinition, definitionId: string): TechniqueDefinition => ({
  ...definition,
  initialState: {
    equipment: definition.initialState.equipment.filter(
      (item) => item.definitionId !== definitionId,
    ),
  },
});

/**
 * Drive a fixture through its own process. Each request must name the action the fixture declares at
 * that position, so a reordered fixture is a test-authoring error rather than a silent wrong-order
 * failure inside the reducer.
 */
const drive = (
  definition: TechniqueDefinition,
  requests: RuntimeActionRequest[],
  from: RuntimeState = createRuntimeState(definition),
): RuntimeState => {
  requests.forEach((request, index) => {
    const declared = definition.actions[index]?.id;
    if (request.actionId !== declared) {
      throw new Error(
        `fixture ${definition.id} declares ${declared} at position ${index}, driven with ${request.actionId}`,
      );
    }
  });
  return requests.reduce((state, request) => performRuntimeAction(definition, state, request), from);
};

const instance = (state: RuntimeState, id: string): EquipmentInstance =>
  state.equipmentInstances.find((candidate) => candidate.id === id)!;

const lastMessage = (state: RuntimeState) =>
  state.feedbackQueue[state.feedbackQueue.length - 1]?.message ?? "";

const attached = (state: RuntimeState, parentInstanceId: string, childInstanceId: string) =>
  state.attachments.some(
    (attachment) =>
      attachment.parentInstanceId === parentInstanceId &&
      attachment.childInstanceId === childInstanceId,
  );

/* ------------------------------------------------------------------ *
 * Contents.
 * ------------------------------------------------------------------ */

const acid = (volumeMl: number): ContentState => ({
  ...emptyContents(),
  kind: "solution",
  label: "Hydrochloric acid",
  volumeMl,
  solutes: [{ id: "hydrochloric-acid", label: "Hydrochloric acid", amount: 1, unit: "mol" }],
  concentration: { value: 4, unit: "M" },
  temperatureC: 25,
  wetState: "wet",
  visualState: "clear-solution",
});

const chips = (massG: number): ContentState => ({
  ...emptyContents(),
  kind: "solid",
  label: "Calcium carbonate marble chips",
  massG,
  solutes: [{ id: "calcium-carbonate", label: "Calcium carbonate", amount: massG, unit: "g" }],
  wetState: "dry",
  visualState: "solid",
});

const granular = (label: string, massG: number): ContentState => ({
  ...emptyContents(),
  kind: "solid",
  label,
  massG,
  solutes: [{ id: "unknown-solid", label, amount: massG, unit: "g" }],
  wetState: "dry",
  visualState: "granular-solid",
});

const water = (volumeMl: number): ContentState => ({
  ...emptyContents(),
  kind: "liquid",
  label: "Distilled water",
  volumeMl,
  wetState: "wet",
  visualState: "clear-liquid",
});

/* ------------------------------------------------------------------ *
 * Investigation 10 action factories and bench.
 * ------------------------------------------------------------------ */

const connectSyringe = () =>
  action(
    "fx-connect-syringe",
    "place",
    {
      equipmentDefinitionId: "gas-syringe",
      targetDefinitionId: "rubber-stopper-delivery-tube",
      snapZoneId: "delivery-tube-gas-syringe-port",
    },
    {
      type: "snapIntoTarget",
      sourceDefinitionId: "gas-syringe",
      targetDefinitionId: "rubber-stopper-delivery-tube",
      snapZoneId: "delivery-tube-gas-syringe-port",
      accessibleLabel: "Connect the gas syringe.",
    },
  );

const zeroSyringe = () =>
  action(
    "fx-zero-syringe",
    "observe",
    { sourceDefinitionId: "gas-syringe", note: "Baseline read.", tag: "fx-zero" },
    {
      type: "readInstrument",
      sourceDefinitionId: "gas-syringe",
      stationId: "gas-syringe",
      accessibleLabel: "Read the gas syringe.",
    },
  );

const transferAcid = () =>
  action(
    "fx-transfer-acid",
    "transfer",
    {
      sourceDefinitionId: "graduated-cylinder",
      targetDefinitionId: "erlenmeyer-flask-250ml",
      volumeMl: 50,
    },
    {
      type: "pourInto",
      sourceDefinitionId: "graduated-cylinder",
      targetDefinitionId: "erlenmeyer-flask-250ml",
      valueParameter: "volumeMl",
      accessibleLabel: "Pour the acid.",
    },
  );

const weighMarble = () =>
  action(
    "fx-weigh-marble",
    "weigh",
    {
      sourceDefinitionId: "marble-chips",
      measurementId: "fx-marble-mass",
      expectedMassG: 1.3,
      tolerance: 0.05,
    },
    {
      type: "readInstrument",
      sourceDefinitionId: "marble-chips",
      stationId: "analytical-balance",
      accessibleLabel: "Read the balance.",
    },
  );

const transferMarble = (massG = 1.3) =>
  action(
    "fx-transfer-marble",
    "transfer",
    { sourceDefinitionId: "marble-chips", targetDefinitionId: "erlenmeyer-flask-250ml", massG },
    {
      type: "pourInto",
      sourceDefinitionId: "marble-chips",
      targetDefinitionId: "erlenmeyer-flask-250ml",
      valueParameter: "massG",
      accessibleLabel: "Add the marble chips.",
    },
  );

const sealFlask = () =>
  action(
    "fx-seal-flask",
    "place",
    {
      equipmentDefinitionId: "rubber-stopper-delivery-tube",
      targetDefinitionId: "erlenmeyer-flask-250ml",
      snapZoneId: "erlenmeyer-stopper-neck",
    },
    {
      type: "snapIntoTarget",
      sourceDefinitionId: "rubber-stopper-delivery-tube",
      targetDefinitionId: "erlenmeyer-flask-250ml",
      snapZoneId: "erlenmeyer-stopper-neck",
      accessibleLabel: "Seal the flask.",
    },
  );

const KINETICS_BENCH: Bench[] = [
  { id: "fx-cylinder", definitionId: "graduated-cylinder", label: "Cylinder", contents: acid(50) },
  {
    id: "fx-flask",
    definitionId: "erlenmeyer-flask-250ml",
    label: "Flask",
    contents: emptyContents(),
  },
  {
    id: "fx-stopper",
    definitionId: "rubber-stopper-delivery-tube",
    label: "Stopper",
    contents: emptyContents(),
  },
  { id: "fx-syringe", definitionId: "gas-syringe", label: "Syringe", contents: emptyContents() },
  { id: "fx-chips", definitionId: "marble-chips", label: "Chips", contents: chips(10) },
  {
    id: "fx-balance",
    definitionId: "analytical-balance",
    label: "Balance",
    contents: emptyContents(),
  },
];

const kinetics = (id: string, actions: ActionDefinition[]) => bench(id, actions, KINETICS_BENCH);

const CONNECT: RuntimeActionRequest = {
  actionId: "fx-connect-syringe",
  verb: "place",
  sourceInstanceId: "fx-syringe",
  targetInstanceId: "fx-stopper",
};
const ZERO: RuntimeActionRequest = {
  actionId: "fx-zero-syringe",
  verb: "observe",
  sourceInstanceId: "fx-syringe",
};
const POUR_ACID: RuntimeActionRequest = {
  actionId: "fx-transfer-acid",
  verb: "transfer",
  sourceInstanceId: "fx-cylinder",
  targetInstanceId: "fx-flask",
};
const WEIGH: RuntimeActionRequest = {
  actionId: "fx-weigh-marble",
  verb: "weigh",
  sourceInstanceId: "fx-chips",
};
const ADD_CHIPS: RuntimeActionRequest = {
  actionId: "fx-transfer-marble",
  verb: "transfer",
  sourceInstanceId: "fx-chips",
  targetInstanceId: "fx-flask",
};
const SEAL: RuntimeActionRequest = {
  actionId: "fx-seal-flask",
  verb: "place",
  sourceInstanceId: "fx-stopper",
  targetInstanceId: "fx-flask",
};

/* ------------------------------------------------------------------ *
 * Equipment availability. The two catalog affordances Cycle 11 added are
 * why the marble and microsample transfers can execute at all.
 * ------------------------------------------------------------------ */

describe("equipment availability for the Cycle 11 transfers", () => {
  it("lets marble chips act as a pour source, because T-11 tips them into the acid", () => {
    expect(equipmentById.get("marble-chips")?.affordances).toContain("pourable");
  });

  it("lets a test tube hold a dry microsample, because K-02 precedes K-03", () => {
    expect(equipmentById.get("test-tube")?.allowedContents).toContain("solid");
  });

  it("keeps the gas syringe a readable instrument whose graduation the content can cite", () => {
    const syringe = equipmentById.get("gas-syringe");
    expect(syringe?.affordances).toContain("measurable");
    expect(syringe?.capacity).toEqual({ amount: 100, unit: "mL" });
    expect(syringe?.precision).toEqual({ amount: 1, unit: "mL" });
  });

  it("owns the two snap zones the collection train needs", () => {
    const zoneIds = (definitionId: string) =>
      (equipmentById.get(definitionId)?.snapZones ?? []).map((zone) => zone.id);
    expect(zoneIds("erlenmeyer-flask-250ml")).toContain("erlenmeyer-stopper-neck");
    expect(zoneIds("rubber-stopper-delivery-tube")).toContain("delivery-tube-gas-syringe-port");
  });
});

/* ------------------------------------------------------------------ *
 * Gas-path assembly and the baseline read.
 * ------------------------------------------------------------------ */

describe("gas-path assembly", () => {
  it("connects the syringe to the delivery tube while the tube is off the flask", () => {
    const definition = kinetics("fx-connect-only", [connectSyringe()]);
    const after = drive(definition, [CONNECT]);
    expect(attached(after, "fx-stopper", "fx-syringe")).toBe(true);
    // Nothing parents the stopper, so the flask is still open and can still be charged.
    expect(after.attachments.some((a) => a.childInstanceId === "fx-stopper")).toBe(false);
  });

  it("still seals the flask with a stopper that already carries the syringe", () => {
    const definition = kinetics("fx-connect-then-seal", [connectSyringe(), sealFlask()]);
    const after = drive(definition, [CONNECT, SEAL]);
    expect(attached(after, "fx-flask", "fx-stopper")).toBe(true);
    expect(attached(after, "fx-stopper", "fx-syringe")).toBe(true);
  });

  it("requires the named instrument to be present before a baseline read is accepted", () => {
    const definition = without(kinetics("fx-zero-only", [zeroSyringe()]), "gas-syringe");
    const after = drive(definition, [ZERO]);
    expect(lastMessage(after)).toMatch(/instrument reading source is missing/i);
  });

  it("records the baseline as a notebook entry and invents no starting volume", () => {
    const definition = kinetics("fx-zero-only", [zeroSyringe()]);
    const after = drive(definition, [ZERO]);
    expect(after.notebook.some((entry) => entry.tags.includes("fx-zero"))).toBe(true);
    expect(after.measurements).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ *
 * The process gate itself. This is the mechanism the content's corrected
 * chronology relies on, so it is asserted rather than assumed.
 * ------------------------------------------------------------------ */

describe("the process gate that carries the chronology", () => {
  it("refuses the seal while the flask is still the current step's business", () => {
    const definition = kinetics("fx-ordered", [transferMarble(), sealFlask()]);
    const after = performRuntimeAction(definition, createRuntimeState(definition), SEAL);
    expect(lastMessage(after)).toMatch(/not expected at this point/i);
    expect(attached(after, "fx-flask", "fx-stopper")).toBe(false);
    expect(after.attemptHistory.at(-1)?.success).toBe(false);
  });

  it("records a rejected out-of-order attempt rather than discarding it", () => {
    const definition = kinetics("fx-ordered", [transferMarble(), sealFlask()]);
    const after = performRuntimeAction(definition, createRuntimeState(definition), SEAL);
    expect(after.attemptHistory).toHaveLength(1);
    expect(after.attemptHistory[0].actionId).toBe("fx-seal-flask");
    expect(after.completedNodes).toHaveLength(0);
  });

  it("blocks an action whose declared prerequisite is unmet", () => {
    const gated = transferMarble();
    gated.prerequisites = [
      {
        id: "fx-needs-baseline",
        type: "notebookEntry",
        label: "The baseline is recorded.",
        notebookTag: "fx-zero",
      },
    ];
    const definition = kinetics("fx-gated", [gated]);
    const after = drive(definition, [ADD_CHIPS]);
    expect(lastMessage(after)).toMatch(/baseline is recorded/i);
    expect(instance(after, "fx-flask").contents.kind).toBe("empty");
  });
});

/* ------------------------------------------------------------------ *
 * Reactant contact: the reaction now has a physical start.
 * ------------------------------------------------------------------ */

describe("reactant contact and time zero", () => {
  const charged = () => {
    const definition = kinetics("fx-charge", [transferAcid(), weighMarble(), transferMarble()]);
    return { definition, state: drive(definition, [POUR_ACID, WEIGH, ADD_CHIPS]) };
  };

  it("moves the weighed mass into the acid and leaves a mixture behind", () => {
    const { state } = charged();
    const flask = instance(state, "fx-flask").contents;
    expect(flask.kind).toBe("mixture");
    expect(flask.massG).toBeCloseTo(1.3, 6);
    expect(flask.volumeMl).toBeCloseTo(50, 6);
    expect(flask.solutes.some((solute) => solute.id === "calcium-carbonate")).toBe(true);
  });

  it("decrements the chip stock, so a repeat trial cannot reuse the same portion", () => {
    const { state } = charged();
    expect(instance(state, "fx-chips").contents.massG).toBeCloseTo(8.7, 6);
  });

  it("reads the balance rather than moving the sample into an instrument", () => {
    const definition = kinetics("fx-weigh-only", [transferAcid(), weighMarble()]);
    const state = drive(definition, [POUR_ACID, WEIGH]);
    const mass = state.measurements.find((entry) => entry.id === "fx-marble-mass");
    expect(mass?.unit).toBe("g");
    expect(mass?.value).toBeCloseTo(1.3, 6);
    expect(mass?.equipmentInstanceId).toBe("fx-chips");
    // A readInstrument weigh moves nothing; the stock is untouched until T-11.
    expect(instance(state, "fx-chips").contents.massG).toBeCloseTo(10, 6);
  });

  it("refuses a transfer larger than the stock rather than inventing solid", () => {
    const definition = kinetics("fx-greedy", [transferMarble(40)]);
    const after = drive(definition, [ADD_CHIPS]);
    expect(lastMessage(after)).toMatch(/does not contain enough solid/i);
    expect(instance(after, "fx-chips").contents.massG).toBeCloseTo(10, 6);
  });
});

/* ------------------------------------------------------------------ *
 * Investigation 6 factories and bench.
 * ------------------------------------------------------------------ */

const dispenseAqueous = () =>
  action(
    "fx-dispense-aqueous",
    "transfer",
    {
      sourceDefinitionId: "small-vial",
      sourceInstanceId: "fx-vial-u1",
      targetDefinitionId: "test-tube",
      targetInstanceId: "fx-tube-aqueous",
      massG: 0.05,
      visualState: "granular-solid",
    },
    {
      type: "pourInto",
      sourceDefinitionId: "small-vial",
      targetDefinitionId: "test-tube",
      valueParameter: "massG",
      accessibleLabel: "Dispense a microsample.",
    },
  );

const addWater = () =>
  action(
    "fx-add-water",
    "transfer",
    {
      sourceDefinitionId: "distilled-water-bottle",
      sourceInstanceId: "fx-water",
      targetDefinitionId: "test-tube",
      targetInstanceId: "fx-tube-aqueous",
      volumeMl: 2,
    },
    {
      type: "pourInto",
      sourceDefinitionId: "distilled-water-bottle",
      targetDefinitionId: "test-tube",
      valueParameter: "volumeMl",
      accessibleLabel: "Add distilled water.",
    },
  );

const readConductivity = () =>
  action(
    "fx-read-conductivity",
    "observe",
    {
      sourceDefinitionId: "test-tube",
      sourceInstanceId: "fx-tube-aqueous",
      targetDefinitionId: "conductivity-tester",
      targetInstanceId: "fx-tester",
      note: "Student reading.",
      tag: "fx-conductivity",
    },
    {
      type: "readInstrument",
      sourceDefinitionId: "test-tube",
      targetDefinitionId: "conductivity-tester",
      stationId: "conductivity-tester",
      accessibleLabel: "Read the conductivity tester.",
    },
  );

const disposeAqueous = () =>
  action(
    "fx-dispose-aqueous",
    "transfer",
    {
      sourceDefinitionId: "test-tube",
      sourceInstanceId: "fx-tube-aqueous",
      targetDefinitionId: "waste-beaker",
      targetInstanceId: "fx-waste-aqueous",
    },
    {
      type: "pourInto",
      sourceDefinitionId: "test-tube",
      targetDefinitionId: "waste-beaker",
      accessibleLabel: "Dispose of the mixture.",
    },
  );

const BONDING_BENCH: Bench[] = [
  {
    id: "fx-vial-u1",
    definitionId: "small-vial",
    label: "Blind unknown U1",
    contents: granular("Blind unknown U1", 2),
  },
  {
    id: "fx-vial-u2",
    definitionId: "small-vial",
    label: "Blind unknown U2",
    contents: granular("Blind unknown U2", 2),
  },
  { id: "fx-tube-aqueous", definitionId: "test-tube", label: "Tube 1", contents: emptyContents() },
  { id: "fx-tube-organic", definitionId: "test-tube", label: "Tube 2", contents: emptyContents() },
  {
    id: "fx-water",
    definitionId: "distilled-water-bottle",
    label: "Distilled water",
    contents: water(500),
  },
  {
    id: "fx-tester",
    definitionId: "conductivity-tester",
    label: "Conductivity tester",
    contents: emptyContents(),
  },
  {
    id: "fx-waste-aqueous",
    definitionId: "waste-beaker",
    label: "Aqueous waste",
    contents: emptyContents(),
  },
];

const bonding = (id: string, actions: ActionDefinition[]) => bench(id, actions, BONDING_BENCH);

const DISPENSE: RuntimeActionRequest = { actionId: "fx-dispense-aqueous", verb: "transfer" };
const ADD_WATER: RuntimeActionRequest = { actionId: "fx-add-water", verb: "transfer" };
const READ: RuntimeActionRequest = { actionId: "fx-read-conductivity", verb: "observe" };
const DISPOSE: RuntimeActionRequest = { actionId: "fx-dispose-aqueous", verb: "transfer" };

describe("bonding microsample and control state", () => {
  it("takes the named vial, not the first vial on the bench", () => {
    const definition = bonding("fx-dispense-only", [dispenseAqueous()]);
    const after = drive(definition, [DISPENSE]);
    expect(instance(after, "fx-vial-u1").contents.massG).toBeCloseTo(1.95, 6);
    // U2 is untouched: naming the instance is what keeps two blind samples independent, and both
    // vials share one definition id.
    expect(instance(after, "fx-vial-u2").contents.massG).toBeCloseTo(2, 6);
  });

  it("leaves the second test tube empty, so two test lines cannot share evidence", () => {
    const definition = bonding("fx-dispense-only", [dispenseAqueous()]);
    const after = drive(definition, [DISPENSE]);
    expect(instance(after, "fx-tube-organic").contents.kind).toBe("empty");
    expect(instance(after, "fx-tube-aqueous").contents.kind).toBe("solid");
  });

  it("makes an aqueous test mixture when the solvent is applied", () => {
    const definition = bonding("fx-aqueous-line", [dispenseAqueous(), addWater()]);
    const state = drive(definition, [DISPENSE, ADD_WATER]);
    const tube = instance(state, "fx-tube-aqueous").contents;
    expect(tube.volumeMl).toBeCloseTo(2, 6);
    expect(tube.solutes.some((solute) => solute.id === "unknown-solid")).toBe(true);
  });

  it("accepts an instrument read only when the instrument is present", () => {
    const definition = without(
      bonding("fx-read-only", [readConductivity()]),
      "conductivity-tester",
    );
    const after = drive(definition, [READ]);
    expect(lastMessage(after)).toMatch(/instrument station is missing/i);
  });

  it("accepts an instrument read only when the named sample is present", () => {
    const definition = without(bonding("fx-read-only", [readConductivity()]), "test-tube");
    const after = drive(definition, [READ]);
    expect(lastMessage(after)).toMatch(/instrument reading source is missing/i);
  });

  it("records the student's own note and produces no conductivity value", () => {
    const definition = bonding("fx-read-only", [readConductivity()]);
    const after = drive(definition, [READ]);
    expect(after.notebook.some((entry) => entry.tags.includes("fx-conductivity"))).toBe(true);
    expect(after.measurements).toHaveLength(0);
    expect(after.calculations).toHaveLength(0);
  });

  it("routes the spent mixture into the named waste container and empties the tube", () => {
    const definition = bonding("fx-aqueous-cleanup", [
      dispenseAqueous(),
      addWater(),
      disposeAqueous(),
    ]);
    const state = drive(definition, [DISPENSE, ADD_WATER, DISPOSE]);
    expect(instance(state, "fx-waste-aqueous").contents.volumeMl).toBeCloseTo(2, 6);
    expect(instance(state, "fx-tube-aqueous").contents.kind).toBe("empty");
  });
});

/* ------------------------------------------------------------------ *
 * Reset. A failed trial must be repeatable from a clean bench, and the
 * physical-scope reset must keep the evidence a failed run produced.
 * ------------------------------------------------------------------ */

describe("reset after a run", () => {
  const afterCharging = () => {
    const definition = kinetics("fx-reset", [transferAcid(), weighMarble(), transferMarble()]);
    return { definition, state: drive(definition, [POUR_ACID, WEIGH, ADD_CHIPS]) };
  };

  it("returns the flask and the chip stock to their starting contents", () => {
    const { definition, state } = afterCharging();
    const reset = performRuntimeAction(definition, state, { actionId: "reset", verb: "reset" });
    expect(instance(reset, "fx-flask").contents.kind).toBe("empty");
    expect(instance(reset, "fx-chips").contents.massG).toBeCloseTo(10, 6);
    expect(reset.attachments).toHaveLength(0);
    expect(reset.measurements).toHaveLength(0);
    expect(reset.currentNodeId).toBe(definition.process.startNodeId);
  });

  it("keeps the failed run's evidence when only the physical bench is reset", () => {
    const { definition, state } = afterCharging();
    const reset = performRuntimeAction(definition, state, {
      actionId: "reset",
      verb: "reset",
      parameters: { scope: "physical" },
    });
    expect(instance(reset, "fx-flask").contents.kind).toBe("empty");
    expect(instance(reset, "fx-chips").contents.massG).toBeCloseTo(10, 6);
    // §9 of the source: a trial that fails before useful data retains the failed-run record.
    expect(reset.measurements.some((entry) => entry.id === "fx-marble-mass")).toBe(true);
    expect(reset.attemptHistory.length).toBe(state.attemptHistory.length);
    expect(reset.evidenceScopeId).not.toBe(state.evidenceScopeId);
  });
});
