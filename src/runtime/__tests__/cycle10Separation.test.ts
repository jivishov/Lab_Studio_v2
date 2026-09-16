/**
 * Cycle 10 — Investigation 5 chromatography and Investigation 9 component separation.
 *
 * These cover the runtime behaviour Cycle 10 changed and could not execute under the repository's
 * validation policy (`AGENTS.md`): the chromatography chronology gates, the removal of the develop-time
 * measurement write that made Rf available before any ruler was touched, the student ruler reading
 * that replaced it, the recovered mass that now derives from a declared solute instead of a literal,
 * and the two composition templates that previously had no implementation.
 *
 * Authored, not executed. See `docs/step-and-image-consistency-audit.md` §23.
 */
import { describe, expect, it } from "vitest";
import { emptyContents } from "../../domain/types";
import type {
  ActionDefinition,
  ChromatographyModelDefinition,
  EquipmentInstance,
  ProcessNode,
  RuntimeState,
  TechniqueDefinition,
} from "../../domain/types";
import {
  calculateChromatographyRf,
  calculateComponentMassPercent,
  calculateTotalPercentRecovery,
  quantiseRulerReadingMm,
} from "../calculations";
import { createRuntimeState, performRuntimeAction } from "../index";

/* ------------------------------------------------------------------ *
 * Pure calculations
 * ------------------------------------------------------------------ */

describe("ruler readings are quantised to the modelled division", () => {
  it("rounds to the nearest whole millimetre by default", () => {
    expect(quantiseRulerReadingMm(58.6, 1)).toBe(59);
    expect(quantiseRulerReadingMm(59.4, 1)).toBe(59);
  });

  it("honours a coarser division when the strip length makes one appropriate", () => {
    expect(quantiseRulerReadingMm(58.6, 5)).toBe(60);
  });

  it("does not quantise when no division is declared", () => {
    expect(quantiseRulerReadingMm(58.6, 0)).toBe(58.6);
    expect(quantiseRulerReadingMm(58.6, -1)).toBe(58.6);
  });

  it("refuses a non-finite reading rather than rounding it to zero", () => {
    expect(() => quantiseRulerReadingMm(Number.NaN, 1)).toThrow(/finite/i);
  });
});

describe("Rf from student distances", () => {
  it("is the band distance over the solvent-front distance", () => {
    // Investigation 5's authored water trial: 59 mm and 66 mm against an 80 mm front.
    expect(calculateChromatographyRf(59, 80)).toBeCloseTo(0.7375, 4);
    expect(calculateChromatographyRf(66, 80)).toBeCloseTo(0.825, 4);
  });

  it("refuses a band that travelled past the front", () => {
    expect(() => calculateChromatographyRf(90, 80)).toThrow(/exceed/i);
  });

  it("refuses a front distance of zero rather than dividing by it", () => {
    expect(() => calculateChromatographyRf(59, 0)).toThrow(/greater than zero/i);
  });
});

describe("component composition and total recovery are separate figures", () => {
  it("computes one component as a percent of the recorded starting mass", () => {
    expect(calculateComponentMassPercent(0.45, 3)).toBeCloseTo(15, 2);
    expect(calculateComponentMassPercent(2.4, 3)).toBeCloseTo(80, 2);
  });

  it("treats a genuine non-detection as zero percent, not as a missing measurement", () => {
    expect(calculateComponentMassPercent(0, 3)).toBe(0);
  });

  it("sums every recovered fraction for total recovery", () => {
    expect(calculateTotalPercentRecovery([0.45, 2.4, 0.15], 3)).toBeCloseTo(100, 2);
  });

  it("keeps the two readings of the source sentence numerically distinct", () => {
    // Finding 3.7: the manual describes total recovery while asking for composition. One component's
    // percentage must never coincide with the recovery figure by construction.
    expect(calculateComponentMassPercent(0.45, 3)).not.toBeCloseTo(
      calculateTotalPercentRecovery([0.45, 2.4, 0.15], 3),
      2,
    );
  });

  it("refuses an empty recovered set rather than reporting nothing recovered", () => {
    expect(() => calculateTotalPercentRecovery([], 3)).toThrow(/at least one/i);
  });

  it("refuses a starting mass of zero rather than dividing by it", () => {
    expect(() => calculateComponentMassPercent(0.45, 0)).toThrow(/greater than zero/i);
    expect(() => calculateTotalPercentRecovery([0.45], 0)).toThrow(/greater than zero/i);
  });

  it("refuses a negative component mass", () => {
    expect(() => calculateComponentMassPercent(-0.1, 3)).toThrow(/non-negative/i);
  });
});

/* ------------------------------------------------------------------ *
 * Shared fixture helpers
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

const instance = (
  id: string,
  definitionId: string,
  contents: EquipmentInstance["contents"] = emptyContents(),
): EquipmentInstance => ({ id, definitionId, label: id, location: "workbench", contents });

const perform = (
  definition: TechniqueDefinition,
  state: RuntimeState,
  request: Parameters<typeof performRuntimeAction>[2],
) => performRuntimeAction(definition, state, request);

const findInstance = (state: RuntimeState, id: string) =>
  state.equipmentInstances.find((candidate) => candidate.id === id)!;

/**
 * These cases exercise one handler at a time. Make that isolation explicit: current runtime
 * rejects requests for a non-current node instead of silently running an out-of-order action.
 */
const atAction = (
  definition: TechniqueDefinition,
  actionId: string,
  state = createRuntimeState(definition),
): RuntimeState => {
  const processNode = definition.process.nodes.find((candidate) => candidate.actionId === actionId);
  if (!processNode) throw new Error(`Missing process node for ${actionId}.`);
  return {
    ...state,
    currentNodeId: processNode.id,
    completedNodes: state.completedNodes.filter((nodeId) => nodeId !== processNode.id),
  };
};

const failed = (state: RuntimeState) =>
  state.feedbackQueue.some((entry) => entry.severity === "error");

/* ------------------------------------------------------------------ *
 * Chromatography chronology
 * ------------------------------------------------------------------ */

const CHROMATOGRAPHY_MODEL: ChromatographyModelDefinition = {
  id: "fx-food-dyes",
  solventFrontMm: 80,
  bands: [
    { id: "purple-overlap", label: "Purple unresolved overlap", color: "#7e22ce", distanceMm: 59, expectedRf: 0.7375 },
    { id: "yellow", label: "Yellow", color: "#facc15", distanceMm: 66, expectedRf: 0.825 },
  ],
};

const BASELINE_MM = 15;
const DEPTH_MM = 5;

const chromatographyChain = (): TechniqueDefinition => ({
  id: "fx-chromatography",
  title: "fx",
  learningGoal: "fx",
  requiredEquipment: [],
  chromatographyModels: [CHROMATOGRAPHY_MODEL],
  initialState: {
    equipment: [
      instance("fx-chamber", "chromatography-chamber", {
        ...emptyContents(),
        kind: "liquid",
        label: "Mobile phase",
        volumeMl: 5,
        wetState: "wet",
        visualState: "clear-liquid",
      }),
      instance("fx-paper", "chromatography-paper", {
        ...emptyContents(),
        visualState: "paper-unspotted",
      }),
      instance("fx-spotter", "capillary-spotter", {
        ...emptyContents(),
        kind: "mixture",
        label: "Teacher-provided food dye mixture",
        volumeMl: 0.002,
        wetState: "wet",
        visualState: "blue-dye-solution",
      }),
      instance("fx-ruler", "metric-ruler"),
    ],
  },
  actions: [
    action("fx-mark-baseline", "observe", {
      sourceDefinitionId: "chromatography-paper",
      sourceInstanceId: "fx-paper",
      chromatographyOperation: "markBaseline",
      chromatographyModelId: CHROMATOGRAPHY_MODEL.id,
      baselineHeightMm: BASELINE_MM,
      tag: "fx-baseline",
    }),
    action(
      "fx-spot",
      "spotSample",
      {
        sourceDefinitionId: "capillary-spotter",
        sourceInstanceId: "fx-spotter",
        targetDefinitionId: "chromatography-paper",
        targetInstanceId: "fx-paper",
        chromatographyModelId: CHROMATOGRAPHY_MODEL.id,
        requiresBaselineMarked: true,
        requiresDrying: true,
        originDistanceMm: BASELINE_MM,
      },
      {
        type: "spotOnto",
        sourceDefinitionId: "capillary-spotter",
        targetDefinitionId: "chromatography-paper",
        accessibleLabel: "spot",
      },
    ),
    action("fx-dry-spot", "observe", {
      sourceDefinitionId: "chromatography-paper",
      sourceInstanceId: "fx-paper",
      chromatographyOperation: "drySpot",
      tag: "fx-spot-dry",
    }),
    action(
      "fx-develop",
      "developChromatogram",
      {
        sourceDefinitionId: "chromatography-paper",
        sourceInstanceId: "fx-paper",
        targetDefinitionId: "chromatography-chamber",
        targetInstanceId: "fx-chamber",
        snapZoneId: "chromatography-chamber-paper-slot",
        chromatographyModelId: CHROMATOGRAPHY_MODEL.id,
        measurementPrefix: "fx",
        baselineHeightMm: BASELINE_MM,
        solventDepthMm: DEPTH_MM,
        requireDrySpot: true,
        trackWetState: true,
        recordMeasurementsOnDevelop: false,
      },
      {
        type: "snapIntoTarget",
        sourceDefinitionId: "chromatography-paper",
        targetDefinitionId: "chromatography-chamber",
        snapZoneId: "chromatography-chamber-paper-slot",
        accessibleLabel: "develop",
      },
    ),
    action("fx-mark-front", "observe", {
      sourceDefinitionId: "chromatography-paper",
      sourceInstanceId: "fx-paper",
      chromatographyOperation: "markSolventFront",
      tag: "fx-front-marked",
    }),
    action("fx-dry-paper", "observe", {
      sourceDefinitionId: "chromatography-paper",
      sourceInstanceId: "fx-paper",
      chromatographyOperation: "dryDevelopedPaper",
      tag: "fx-paper-dry",
    }),
    action(
      "fx-read-front",
      "observe",
      {
        sourceDefinitionId: "chromatography-paper",
        sourceInstanceId: "fx-paper",
        targetDefinitionId: "metric-ruler",
        targetInstanceId: "fx-ruler",
        measurementId: "fx-solvent-front",
        chromatographyMeasurementType: "solventFront",
        rulerPrecisionMm: 1,
        measurementToleranceMm: 0.5,
      },
      {
        type: "readInstrument",
        sourceDefinitionId: "chromatography-paper",
        targetDefinitionId: "metric-ruler",
        stationId: "metric-ruler",
        accessibleLabel: "read the front",
      },
    ),
    action(
      "fx-read-band",
      "observe",
      {
        sourceDefinitionId: "chromatography-paper",
        sourceInstanceId: "fx-paper",
        targetDefinitionId: "metric-ruler",
        targetInstanceId: "fx-ruler",
        measurementId: "fx-band-purple-overlap",
        chromatographyMeasurementType: "band",
        chromatographyBandId: "purple-overlap",
        rulerPrecisionMm: 1,
        measurementToleranceMm: 0.5,
      },
      {
        type: "readInstrument",
        sourceDefinitionId: "chromatography-paper",
        targetDefinitionId: "metric-ruler",
        stationId: "metric-ruler",
        accessibleLabel: "read the band",
      },
    ),
    action(
      "fx-rf",
      "calculate",
      {
        calculationId: "fx-rf",
        template: "chromatographyRf",
        chromatographyModelId: CHROMATOGRAPHY_MODEL.id,
        measurementPrefix: "fx",
        bandIds: ["purple-overlap"],
        tolerance: 0.005,
        requireRecordedMeasurements: true,
      },
      { type: "submitCalculation", stationId: "calculator", valueParameter: "rf", accessibleLabel: "rf" },
    ),
  ],
  process: {
    startNodeId: "fx-mark-baseline-node",
    nodes: [
      "fx-mark-baseline",
      "fx-spot",
      "fx-dry-spot",
      "fx-develop",
      "fx-mark-front",
      "fx-dry-paper",
      "fx-read-front",
      "fx-read-band",
      "fx-rf",
    ].map(node),
    edges: [
      ["fx-mark-baseline", "fx-spot"],
      ["fx-spot", "fx-dry-spot"],
      ["fx-dry-spot", "fx-develop"],
      ["fx-develop", "fx-mark-front"],
      ["fx-mark-front", "fx-dry-paper"],
      ["fx-dry-paper", "fx-read-front"],
      ["fx-read-front", "fx-read-band"],
      ["fx-read-band", "fx-rf"],
    ].map(([from, to]) => ({
      from: `${from}-node`,
      to: `${to}-node`,
      label: "Next",
      condition: { type: "validationPassed" as const },
    })),
  },
  successCriteria: [],
  commonMistakes: [],
  resetBehavior: "resetTechnique",
  metadata: { version: "1.0.0", author: "fixture", updatedAt: "2026-08-05", tags: [] },
});

const spotted = (definition: TechniqueDefinition) => {
  let state = perform(definition, createRuntimeState(definition), {
    actionId: "fx-mark-baseline",
    verb: "observe",
    sourceInstanceId: "fx-paper",
  });
  state = perform(definition, state, {
    actionId: "fx-spot",
    verb: "spotSample",
    sourceInstanceId: "fx-spotter",
    targetInstanceId: "fx-paper",
  });
  return state;
};

const developed = (definition: TechniqueDefinition) => {
  let state = spotted(definition);
  state = perform(definition, state, {
    actionId: "fx-dry-spot",
    verb: "observe",
    sourceInstanceId: "fx-paper",
  });
  return perform(definition, state, {
    actionId: "fx-develop",
    verb: "developChromatogram",
    sourceInstanceId: "fx-paper",
    targetInstanceId: "fx-chamber",
  });
};

describe("the origin has to be drawn before the sample is applied", () => {
  it("refuses a spot on unmarked paper", () => {
    const definition = chromatographyChain();
    const state = perform(definition, createRuntimeState(definition), {
      actionId: "fx-spot",
      verb: "spotSample",
      sourceInstanceId: "fx-spotter",
      targetInstanceId: "fx-paper",
    });
    expect(failed(state)).toBe(true);
    expect(findInstance(state, "fx-paper").contents.chromatogram?.spotted).not.toBe(true);
  });

  it("records the origin height on the strip so the geometry is auditable", () => {
    const definition = chromatographyChain();
    const state = perform(definition, createRuntimeState(definition), {
      actionId: "fx-mark-baseline",
      verb: "observe",
      sourceInstanceId: "fx-paper",
    });
    const chromatogram = findInstance(state, "fx-paper").contents.chromatogram;
    expect(chromatogram?.baselineMarked).toBe(true);
    expect(chromatogram?.originDistanceMm).toBe(BASELINE_MM);
  });
});

describe("the spot goes on wet and has to dry", () => {
  it("leaves the strip wet when the action declares drying", () => {
    const definition = chromatographyChain();
    const state = spotted(definition);
    expect(findInstance(state, "fx-paper").contents.wetState).toBe("wet");
  });

  it("carries the sample provenance from the container it came from", () => {
    const definition = chromatographyChain();
    const state = spotted(definition);
    expect(findInstance(state, "fx-paper").contents.chromatogram?.sampleProvenance).toBe(
      "Teacher-provided food dye mixture",
    );
  });

  it("refuses to develop a wet spot", () => {
    const definition = chromatographyChain();
    const state = perform(definition, spotted(definition), {
      actionId: "fx-develop",
      verb: "developChromatogram",
      sourceInstanceId: "fx-paper",
      targetInstanceId: "fx-chamber",
    });
    expect(failed(state)).toBe(true);
    expect(findInstance(state, "fx-paper").contents.chromatogram?.solventFrontMm).toBeUndefined();
  });
});

describe("development supplies no distances of its own", () => {
  it("writes no measurement when the action says not to", () => {
    const definition = chromatographyChain();
    const state = developed(definition);
    expect(state.measurements).toHaveLength(0);
  });

  it("still keeps the model's bands on the strip as physical truth", () => {
    const definition = chromatographyChain();
    const chromatogram = findInstance(developed(definition), "fx-paper").contents.chromatogram;
    expect(chromatogram?.solventFrontMm).toBe(80);
    expect(chromatogram?.bands.map((band) => band.distanceMm)).toEqual([59, 66]);
  });

  it("leaves the strip wet with its front unmarked", () => {
    const definition = chromatographyChain();
    const contents = findInstance(developed(definition), "fx-paper").contents;
    expect(contents.wetState).toBe("wet");
    expect(contents.chromatogram?.solventFrontMarked).toBe(false);
  });

  it("refuses a submerged origin", () => {
    const definition = chromatographyChain();
    const develop = definition.actions.find((candidate) => candidate.id === "fx-develop")!;
    develop.parameters.solventDepthMm = BASELINE_MM;
    let state = spotted(definition);
    state = perform(definition, state, {
      actionId: "fx-dry-spot",
      verb: "observe",
      sourceInstanceId: "fx-paper",
    });
    state = perform(definition, state, {
      actionId: "fx-develop",
      verb: "developChromatogram",
      sourceInstanceId: "fx-paper",
      targetInstanceId: "fx-chamber",
    });
    expect(failed(state)).toBe(true);
  });
});

describe("the solvent front is marked while the paper is still wet", () => {
  it("marks the front on a wet strip", () => {
    const definition = chromatographyChain();
    const state = perform(definition, developed(definition), {
      actionId: "fx-mark-front",
      verb: "observe",
      sourceInstanceId: "fx-paper",
    });
    expect(findInstance(state, "fx-paper").contents.chromatogram?.solventFrontMarked).toBe(true);
  });

  it("refuses to dry the strip before the front is marked", () => {
    const definition = chromatographyChain();
    const state = perform(definition, developed(definition), {
      actionId: "fx-dry-paper",
      verb: "observe",
      sourceInstanceId: "fx-paper",
    });
    expect(failed(state)).toBe(true);
    expect(findInstance(state, "fx-paper").contents.wetState).toBe("wet");
  });

  it("refuses to mark a front that has already evaporated", () => {
    const definition = chromatographyChain();
    // Reaching a dry developed strip without marking is only possible by tampering, which is the
    // point: once the paper is dry the front is gone and the trial cannot be measured.
    let state = developed(definition);
    state = {
      ...state,
      equipmentInstances: state.equipmentInstances.map((candidate) =>
        candidate.id === "fx-paper"
          ? { ...candidate, contents: { ...candidate.contents, wetState: "dry" } }
          : candidate,
      ),
    };
    state = perform(definition, state, {
      actionId: "fx-mark-front",
      verb: "observe",
      sourceInstanceId: "fx-paper",
    });
    expect(failed(state)).toBe(true);
  });
});

const readyToMeasure = (definition: TechniqueDefinition) => {
  let state = perform(definition, developed(definition), {
    actionId: "fx-mark-front",
    verb: "observe",
    sourceInstanceId: "fx-paper",
  });
  return perform(definition, state, {
    actionId: "fx-dry-paper",
    verb: "observe",
    sourceInstanceId: "fx-paper",
  });
};

describe("distances come from a ruler reading", () => {
  it("produces the measurement the record step and the Rf calculation consume", () => {
    const definition = chromatographyChain();
    const state = perform(definition, readyToMeasure(definition), {
      actionId: "fx-read-front",
      verb: "observe",
      sourceInstanceId: "fx-paper",
      targetInstanceId: "fx-ruler",
    });
    expect(state.measurements.map((measurement) => measurement.id)).toContain("fx-solvent-front");
    expect(state.measurements[0].value).toBe(80);
    expect(state.measurements[0].unit).toBe("mm");
  });

  it("refuses a reading off a wet chromatogram", () => {
    const definition = chromatographyChain();
    const state = perform(definition, developed(definition), {
      actionId: "fx-read-front",
      verb: "observe",
      sourceInstanceId: "fx-paper",
      targetInstanceId: "fx-ruler",
    });
    expect(failed(state)).toBe(true);
    expect(state.measurements).toHaveLength(0);
  });

  it("refuses a reading whose value is not what the ruler shows", () => {
    const definition = chromatographyChain();
    const state = perform(definition, readyToMeasure(definition), {
      actionId: "fx-read-front",
      verb: "observe",
      sourceInstanceId: "fx-paper",
      targetInstanceId: "fx-ruler",
      value: 62,
    });
    expect(failed(state)).toBe(true);
    expect(state.measurements).toHaveLength(0);
  });

  it("refuses a band the trial did not resolve", () => {
    const definition = chromatographyChain();
    const read = definition.actions.find((candidate) => candidate.id === "fx-read-band")!;
    read.parameters.chromatographyBandId = "blue";
    const state = perform(definition, readyToMeasure(definition), {
      actionId: "fx-read-band",
      verb: "observe",
      sourceInstanceId: "fx-paper",
      targetInstanceId: "fx-ruler",
    });
    expect(failed(state)).toBe(true);
  });
});

describe("Rf cannot be reached before the evidence", () => {
  it("fails on a developed but unmeasured chromatogram", () => {
    const definition = chromatographyChain();
    const state = perform(definition, readyToMeasure(definition), {
      actionId: "fx-rf",
      verb: "calculate",
    });
    expect(failed(state)).toBe(true);
    expect(state.calculations).toHaveLength(0);
  });

  it("computes from the recorded distances once both are read", () => {
    const definition = chromatographyChain();
    let state = perform(definition, readyToMeasure(definition), {
      actionId: "fx-read-front",
      verb: "observe",
      sourceInstanceId: "fx-paper",
      targetInstanceId: "fx-ruler",
    });
    state = perform(definition, state, {
      actionId: "fx-read-band",
      verb: "observe",
      sourceInstanceId: "fx-paper",
      targetInstanceId: "fx-ruler",
    });
    state = perform(definition, state, { actionId: "fx-rf", verb: "calculate" });
    expect(failed(state)).toBe(false);
    const rf = state.calculations.find((candidate) => candidate.id === "fx-rf-purple-overlap");
    expect(rf?.value).toBeCloseTo(0.7375, 4);
    expect(rf?.passed).toBe(true);
  });

  it("keeps the legacy fallback for content that does not ask for recorded distances", () => {
    // Additive-only: an owner that declares nothing must behave exactly as it did before Cycle 10.
    const definition = chromatographyChain();
    const develop = definition.actions.find((candidate) => candidate.id === "fx-develop")!;
    delete develop.parameters.recordMeasurementsOnDevelop;
    const rf = definition.actions.find((candidate) => candidate.id === "fx-rf")!;
    delete rf.parameters.requireRecordedMeasurements;
    const state = perform(
      definition,
      atAction(definition, "fx-rf", developed(definition)),
      { actionId: "fx-rf", verb: "calculate" },
    );
    expect(state.calculations.find((candidate) => candidate.id === "fx-rf-purple-overlap")?.value).toBeCloseTo(
      0.7375,
      4,
    );
  });
});

/* ------------------------------------------------------------------ *
 * Chamber closure (Investigation 5, printed page 49)
 * ------------------------------------------------------------------ */

/**
 * Two independent trials sharing one bench, so per-chamber isolation can be asserted rather than
 * assumed. Each trial owns its chamber and its strip; `chamberSealed` is authored on both develop
 * actions, which is what asks the runtime for a sealed chamber.
 *
 * What this fixture bypasses: it is not the shipped lab. There is no procedure approval, no trial
 * labelling, no capillary loading and no waste routing, and the strips start already spotted and
 * dry so the cases below are about the lid and nothing else. Reachability of the shipped route is
 * asserted separately against the published technique, not here.
 */
const sealedTrialChain = (): TechniqueDefinition => {
  const trialActions = (trial: string) => [
    action(
      `${trial}-insert`,
      "place",
      {
        equipmentDefinitionId: "chromatography-paper",
        equipmentInstanceId: `${trial}-paper`,
        sourceDefinitionId: "chromatography-paper",
        sourceInstanceId: `${trial}-paper`,
        targetDefinitionId: "chromatography-chamber",
        targetInstanceId: `${trial}-chamber`,
        snapZoneId: "chromatography-chamber-paper-slot",
      },
      {
        type: "snapIntoTarget",
        sourceDefinitionId: "chromatography-paper",
        targetDefinitionId: "chromatography-chamber",
        snapZoneId: "chromatography-chamber-paper-slot",
        accessibleLabel: "insert",
      },
    ),
    action(`${trial}-close`, "observe", {
      targetDefinitionId: "chromatography-chamber",
      targetInstanceId: `${trial}-chamber`,
      chamberOperation: "closeChamber",
      tag: `${trial}-chamber-closed`,
    }),
    action(
      `${trial}-develop`,
      "developChromatogram",
      {
        sourceDefinitionId: "chromatography-paper",
        sourceInstanceId: `${trial}-paper`,
        targetDefinitionId: "chromatography-chamber",
        targetInstanceId: `${trial}-chamber`,
        snapZoneId: "chromatography-chamber-paper-slot",
        chromatographyModelId: CHROMATOGRAPHY_MODEL.id,
        measurementPrefix: trial,
        baselineHeightMm: BASELINE_MM,
        solventDepthMm: DEPTH_MM,
        chamberSealed: true,
        requireDrySpot: true,
        trackWetState: true,
        recordMeasurementsOnDevelop: false,
      },
      {
        type: "snapIntoTarget",
        sourceDefinitionId: "chromatography-paper",
        targetDefinitionId: "chromatography-chamber",
        snapZoneId: "chromatography-chamber-paper-slot",
        accessibleLabel: "develop",
      },
    ),
    action(`${trial}-open`, "observe", {
      targetDefinitionId: "chromatography-chamber",
      targetInstanceId: `${trial}-chamber`,
      chamberOperation: "openChamber",
      tag: `${trial}-chamber-opened`,
    }),
    action(
      `${trial}-remove`,
      "place",
      {
        equipmentDefinitionId: "chromatography-paper",
        equipmentInstanceId: `${trial}-paper`,
        location: "workbench",
      },
      {
        type: "dragToZone",
        sourceDefinitionId: "chromatography-paper",
        stationId: "workbench",
        accessibleLabel: "remove",
      },
    ),
    action(`${trial}-mark-front`, "observe", {
      sourceDefinitionId: "chromatography-paper",
      sourceInstanceId: `${trial}-paper`,
      chromatographyOperation: "markSolventFront",
      tag: `${trial}-front-marked`,
    }),
    action(`${trial}-dry-paper`, "observe", {
      sourceDefinitionId: "chromatography-paper",
      sourceInstanceId: `${trial}-paper`,
      chromatographyOperation: "dryDevelopedPaper",
      tag: `${trial}-paper-dry`,
    }),
  ];
  const trialEquipment = (trial: string) => [
    instance(`${trial}-chamber`, "chromatography-chamber", {
      ...emptyContents(),
      kind: "liquid",
      label: "Mobile phase",
      volumeMl: 5,
      wetState: "wet",
      visualState: "clear-liquid",
    }),
    instance(`${trial}-paper`, "chromatography-paper", {
      ...emptyContents(),
      wetState: "dry",
      visualState: "paper-spotted",
      chromatogram: {
        modelId: CHROMATOGRAPHY_MODEL.id,
        baselineMarked: true,
        spotted: true,
        originDistanceMm: BASELINE_MM,
        bands: [],
      },
    }),
  ];
  const actions = [...trialActions("a"), ...trialActions("b")];
  const solventBottle = instance("fx-solvent-bottle", "distilled-water-bottle", {
    ...emptyContents(),
    kind: "liquid",
    label: "Distilled water",
    volumeMl: 500,
    wetState: "wet",
    visualState: "clear-liquid",
  });
  actions.push(
    action("a-top-up", "transfer", {
      sourceDefinitionId: "distilled-water-bottle",
      sourceInstanceId: "fx-solvent-bottle",
      targetDefinitionId: "chromatography-chamber",
      targetInstanceId: "a-chamber",
      volumeMl: 1,
    }),
  );
  return {
    id: "fx-sealed-chromatography",
    title: "fx",
    learningGoal: "fx",
    requiredEquipment: [],
    chromatographyModels: [CHROMATOGRAPHY_MODEL],
    initialState: { equipment: [...trialEquipment("a"), ...trialEquipment("b"), solventBottle] },
    actions,
    process: {
      startNodeId: `${actions[0].id}-node`,
      nodes: actions.map((candidate) => node(candidate.id)),
      edges: actions.slice(1).map((candidate, index) => ({
        from: `${actions[index].id}-node`,
        to: `${candidate.id}-node`,
        label: "Next",
        condition: { type: "validationPassed" as const },
      })),
    },
    successCriteria: [],
    commonMistakes: [],
    resetBehavior: "resetTechnique",
    metadata: { version: "1.0.0", author: "fixture", updatedAt: "2026-09-15", tags: [] },
  };
};

const insertStrip = (definition: TechniqueDefinition, state: RuntimeState, trial: string) =>
  perform(definition, atAction(definition, `${trial}-insert`, state), {
    actionId: `${trial}-insert`,
    verb: "place",
    sourceInstanceId: `${trial}-paper`,
    targetInstanceId: `${trial}-chamber`,
    equipmentDefinitionId: "chromatography-paper",
    location: "snapZone",
    parameters: { snapZoneId: "chromatography-chamber-paper-slot" },
  });

const closeChamber = (definition: TechniqueDefinition, state: RuntimeState, trial: string) =>
  perform(definition, atAction(definition, `${trial}-close`, state), {
    actionId: `${trial}-close`,
    verb: "observe",
    targetInstanceId: `${trial}-chamber`,
  });

const developSealed = (definition: TechniqueDefinition, state: RuntimeState, trial: string) =>
  perform(definition, atAction(definition, `${trial}-develop`, state), {
    actionId: `${trial}-develop`,
    verb: "developChromatogram",
    sourceInstanceId: `${trial}-paper`,
    targetInstanceId: `${trial}-chamber`,
  });

const chamberOf = (state: RuntimeState, trial: string) =>
  findInstance(state, `${trial}-chamber`).contents.developingChamberClosed;

describe("the chamber is sealed by the learner, not by an authored constant", () => {
  it("starts open and closes only through the central action path", () => {
    const definition = sealedTrialChain();
    const fresh = createRuntimeState(definition);
    expect(chamberOf(fresh, "a")).toBeUndefined();

    const inserted = insertStrip(definition, fresh, "a");
    expect(failed(inserted)).toBe(false);
    const closed = closeChamber(definition, inserted, "a");
    expect(failed(closed)).toBe(false);
    expect(chamberOf(closed, "a")).toBe(true);
    expect(closed.notebook.some((entry) => entry.tags.includes("a-chamber-closed"))).toBe(true);
  });

  it("refuses development in an open chamber and writes nothing from the refusal", () => {
    const definition = sealedTrialChain();
    const inserted = insertStrip(definition, createRuntimeState(definition), "a");
    const refused = developSealed(definition, inserted, "a");

    expect(failed(refused)).toBe(true);
    expect(refused.feedbackQueue.at(-1)?.message).toMatch(/still open/i);
    // No development measurements, no successful-action evidence, no completed node.
    expect(findInstance(refused, "a-paper").contents.chromatogram?.solventFrontMm).toBeUndefined();
    expect(refused.measurements.filter((entry) => entry.id.startsWith("a-"))).toHaveLength(0);
    expect(refused.attemptHistory.some((entry) => entry.actionId === "a-develop" && entry.success)).toBe(false);
    expect(refused.completedNodes).not.toContain("a-develop-node");
  });

  it("develops once the same otherwise-valid state has a closed chamber", () => {
    const definition = sealedTrialChain();
    let state = insertStrip(definition, createRuntimeState(definition), "a");
    state = closeChamber(definition, state, "a");
    state = developSealed(definition, state, "a");

    expect(failed(state)).toBe(false);
    const chromatogram = findInstance(state, "a-paper").contents.chromatogram;
    expect(chromatogram?.solventFrontMm).toBe(CHROMATOGRAPHY_MODEL.solventFrontMm);
    expect(chromatogram?.solventFrontMarked).toBe(false);
    expect(findInstance(state, "a-paper").contents.wetState).toBe("wet");
  });

  it("refuses development when the strip was never suspended, instead of seating it", () => {
    const definition = sealedTrialChain();
    const closed = closeChamber(definition, createRuntimeState(definition), "a");
    const refused = developSealed(definition, closed, "a");

    expect(failed(refused)).toBe(true);
    expect(refused.feedbackQueue.at(-1)?.message).toMatch(/not suspended/i);
    expect(refused.attachments).toHaveLength(0);
    expect(findInstance(refused, "a-paper").contents.chromatogram?.solventFrontMm).toBeUndefined();
  });
});

describe("a closed chamber refuses every route into and out of itself", () => {
  const sealedWithStrip = () => {
    const definition = sealedTrialChain();
    let state = insertStrip(definition, createRuntimeState(definition), "a");
    state = closeChamber(definition, state, "a");
    return { definition, state };
  };

  it("refuses to seat a strip through the snap path", () => {
    const definition = sealedTrialChain();
    const closed = closeChamber(definition, createRuntimeState(definition), "a");
    const refused = insertStrip(definition, closed, "a");

    expect(failed(refused)).toBe(true);
    expect(refused.feedbackQueue.at(-1)?.message).toMatch(/is closed/i);
    expect(refused.attachments).toHaveLength(0);
  });

  it("refuses a solvent pour into a sealed chamber", () => {
    const { definition, state } = sealedWithStrip();
    const refused = perform(definition, atAction(definition, "a-top-up", state), {
      actionId: "a-top-up",
      verb: "transfer",
      sourceInstanceId: "fx-solvent-bottle",
      targetInstanceId: "a-chamber",
      value: 1,
    });

    expect(failed(refused)).toBe(true);
    expect(refused.feedbackQueue.at(-1)?.message).toMatch(/is closed/i);
    expect(findInstance(refused, "a-chamber").contents.volumeMl).toBe(5);
  });

  it("refuses removal while sealed, and allows it after reopening", () => {
    const { definition, state } = sealedWithStrip();
    const developed = developSealed(definition, state, "a");
    const blocked = perform(definition, atAction(definition, "a-remove", developed), {
      actionId: "a-remove",
      verb: "place",
      sourceInstanceId: "a-paper",
      equipmentDefinitionId: "chromatography-paper",
      location: "workbench",
    });
    expect(failed(blocked)).toBe(true);
    expect(blocked.attachments).toHaveLength(1);

    const reopened = perform(definition, atAction(definition, "a-open", developed), {
      actionId: "a-open",
      verb: "observe",
      targetInstanceId: "a-chamber",
    });
    expect(failed(reopened)).toBe(false);
    expect(chamberOf(reopened, "a")).toBe(false);

    const removed = perform(definition, atAction(definition, "a-remove", reopened), {
      actionId: "a-remove",
      verb: "place",
      sourceInstanceId: "a-paper",
      equipmentDefinitionId: "chromatography-paper",
      location: "workbench",
    });
    expect(failed(removed)).toBe(false);
    expect(removed.attachments).toHaveLength(0);
  });

  it("refuses a free bench move out of a sealed chamber", () => {
    const { definition, state } = sealedWithStrip();
    const moved = performRuntimeAction(definition, state, {
      actionId: "a-remove",
      verb: "place",
      sourceInstanceId: "a-paper",
      equipmentDefinitionId: "chromatography-paper",
      location: "workbench",
      parameters: { benchMove: true, x: 10, y: 10 },
    });

    expect(failed(moved)).toBe(true);
    expect(moved.feedbackQueue.at(-1)?.message).toMatch(/is closed/i);
    expect(moved.attachments).toHaveLength(1);
  });
});

describe("opening a developed chamber preserves the trial", () => {
  it("keeps the chromatogram, its wet front and the measurement chain intact", () => {
    const definition = sealedTrialChain();
    let state = insertStrip(definition, createRuntimeState(definition), "a");
    state = closeChamber(definition, state, "a");
    state = developSealed(definition, state, "a");
    state = perform(definition, atAction(definition, "a-open", state), {
      actionId: "a-open",
      verb: "observe",
      targetInstanceId: "a-chamber",
    });

    // No evaporation, pressure, timed-development or pause/resume model: the strip is untouched.
    const afterOpen = findInstance(state, "a-paper").contents;
    expect(afterOpen.chromatogram?.solventFrontMm).toBe(CHROMATOGRAPHY_MODEL.solventFrontMm);
    expect(afterOpen.wetState).toBe("wet");

    state = perform(definition, atAction(definition, "a-remove", state), {
      actionId: "a-remove",
      verb: "place",
      sourceInstanceId: "a-paper",
      equipmentDefinitionId: "chromatography-paper",
      location: "workbench",
    });
    state = perform(definition, atAction(definition, "a-mark-front", state), {
      actionId: "a-mark-front",
      verb: "observe",
      sourceInstanceId: "a-paper",
    });
    expect(failed(state)).toBe(false);
    expect(findInstance(state, "a-paper").contents.chromatogram?.solventFrontMarked).toBe(true);

    state = perform(definition, atAction(definition, "a-dry-paper", state), {
      actionId: "a-dry-paper",
      verb: "observe",
      sourceInstanceId: "a-paper",
    });
    expect(failed(state)).toBe(false);
    expect(findInstance(state, "a-paper").contents.wetState).toBe("dry");
  });

  it("refuses a second close and a second open rather than recording a fresh operation", () => {
    const definition = sealedTrialChain();
    let state = insertStrip(definition, createRuntimeState(definition), "a");
    state = closeChamber(definition, state, "a");
    const closedTwice = closeChamber(definition, state, "a");
    expect(failed(closedTwice)).toBe(true);
    expect(closedTwice.notebook.filter((entry) => entry.tags.includes("a-chamber-closed"))).toHaveLength(1);

    const openedWhenOpen = perform(definition, atAction(definition, "b-open", createRuntimeState(definition)), {
      actionId: "b-open",
      verb: "observe",
      targetInstanceId: "b-chamber",
    });
    expect(failed(openedWhenOpen)).toBe(true);
    expect(chamberOf(openedWhenOpen, "b")).toBeUndefined();
  });
});

describe("closure is per chamber and does not survive a reset", () => {
  it("does not let one trial's closed lid authorize another trial's development", () => {
    const definition = sealedTrialChain();
    let state = insertStrip(definition, createRuntimeState(definition), "a");
    state = closeChamber(definition, state, "a");
    state = insertStrip(definition, state, "b");

    expect(chamberOf(state, "a")).toBe(true);
    expect(chamberOf(state, "b")).toBeUndefined();

    const refused = developSealed(definition, state, "b");
    expect(failed(refused)).toBe(true);
    expect(refused.feedbackQueue.at(-1)?.message).toMatch(/still open/i);
    expect(findInstance(refused, "b-paper").contents.chromatogram?.solventFrontMm).toBeUndefined();

    const allowed = developSealed(definition, state, "a");
    expect(failed(allowed)).toBe(false);
  });

  it("restores open chambers and drops stale closure evidence on reset", () => {
    const definition = sealedTrialChain();
    let state = insertStrip(definition, createRuntimeState(definition), "a");
    state = closeChamber(definition, state, "a");
    expect(chamberOf(state, "a")).toBe(true);

    const physical = performRuntimeAction(definition, state, {
      actionId: "reset",
      verb: "reset",
      parameters: { scope: "physical" },
    });
    // The lid is apparatus state rebuilt from the authored contents, so it reopens even though a
    // physical reset deliberately preserves accepted evidence from earlier trials.
    expect(chamberOf(physical, "a")).toBeUndefined();
    expect(physical.attachments).toHaveLength(0);

    const full = performRuntimeAction(definition, state, { actionId: "reset", verb: "reset" });
    expect(chamberOf(full, "a")).toBeUndefined();
    expect(full.notebook).toHaveLength(0);
  });
});

describe("content that declares no seal keeps its previous handling", () => {
  it("still seats the strip on develop when chamberSealed is absent", () => {
    const definition = chromatographyChain();
    const state = developed(definition);
    expect(failed(state)).toBe(false);
    expect(state.attachments).toHaveLength(1);
    expect(findInstance(state, "fx-paper").contents.chromatogram?.solventFrontMm).toBe(
      CHROMATOGRAPHY_MODEL.solventFrontMm,
    );
    expect(findInstance(state, "fx-chamber").contents.developingChamberClosed).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ *
 * Component separation
 * ------------------------------------------------------------------ */

const SEPARATION_COMPOSITION = [
  { id: "fx-binder", label: "Sucrose binder", amount: 0.45, unit: "g" as const },
  { id: "fx-active", label: "Acetaminophen", amount: 2.4, unit: "g" as const },
  { id: "fx-acidic", label: "Unidentified acidic component", amount: 0.15, unit: "g" as const },
];

const separationChain = (): TechniqueDefinition => ({
  id: "fx-separation",
  title: "fx",
  learningGoal: "fx",
  requiredEquipment: [],
  initialState: {
    equipment: [
      instance("fx-unknown", "watch-glass", {
        ...emptyContents(),
        kind: "solid",
        label: "Unknown powder",
        massG: 3,
        solutes: SEPARATION_COMPOSITION.map((solute) => ({ ...solute })),
        visualState: "powder",
      }),
      instance("fx-balance", "analytical-balance"),
      instance("fx-fraction", "erlenmeyer-flask-250ml", {
        ...emptyContents(),
        kind: "solution",
        label: "Acidified fraction",
        volumeMl: 40,
        solutes: [{ ...SEPARATION_COMPOSITION[2] }],
        wetState: "wet",
        visualState: "clear-liquid",
      }),
      instance("fx-acid", "reagent-bottle", {
        ...emptyContents(),
        kind: "liquid",
        label: "6 M HCl",
        volumeMl: 250,
        wetState: "wet",
        visualState: "clear-liquid",
      }),
    ],
  },
  actions: [
    action(
      "fx-starting-mass",
      "weigh",
      {
        sourceDefinitionId: "watch-glass",
        sourceInstanceId: "fx-unknown",
        targetDefinitionId: "analytical-balance",
        targetInstanceId: "fx-balance",
        measurementId: "fx-starting-mass",
        tolerance: 0.001,
      },
      {
        type: "readInstrument",
        sourceDefinitionId: "watch-glass",
        targetDefinitionId: "analytical-balance",
        stationId: "analytical-balance",
        accessibleLabel: "weigh",
      },
    ),
    action("fx-recover", "precipitate", {
      sourceDefinitionId: "reagent-bottle",
      sourceInstanceId: "fx-acid",
      targetDefinitionId: "erlenmeyer-flask-250ml",
      targetInstanceId: "fx-fraction",
      finalVolumeMl: 45,
      precipitateSoluteSourceId: "fx-acidic",
      precipitateSubstance: "Recovered acidic component",
      precipitateSoluteId: "fx-recovered-acidic",
    }),
    action("fx-recover-absent", "precipitate", {
      sourceDefinitionId: "reagent-bottle",
      sourceInstanceId: "fx-acid",
      targetDefinitionId: "erlenmeyer-flask-250ml",
      targetInstanceId: "fx-fraction",
      finalVolumeMl: 45,
      precipitateSoluteSourceId: "fx-not-in-this-sample",
      precipitateSubstance: "Recovered acidic component",
      precipitateSoluteId: "fx-recovered-acidic",
    }),
    action(
      "fx-component-percent",
      "calculate",
      {
        calculationId: "fx-component-percent",
        template: "componentMassPercent",
        compositionFormulaConfirmation: "component-mass-over-starting-mass",
        startingMassMeasurementId: "fx-starting-mass",
        componentMassMeasurementId: "fx-component-mass",
        studentValueRequired: true,
        tolerance: 0.5,
        unit: "%",
      },
      { type: "submitCalculation", stationId: "calculator", valueParameter: "percent", accessibleLabel: "percent" },
    ),
    action(
      "fx-component-percent-unconfirmed",
      "calculate",
      {
        calculationId: "fx-component-percent-unconfirmed",
        template: "componentMassPercent",
        startingMassMeasurementId: "fx-starting-mass",
        componentMassMeasurementId: "fx-component-mass",
        studentValueRequired: true,
      },
      { type: "submitCalculation", stationId: "calculator", valueParameter: "percent", accessibleLabel: "percent" },
    ),
  ],
  process: {
    startNodeId: "fx-starting-mass-node",
    nodes: [
      "fx-starting-mass",
      "fx-recover",
      "fx-recover-absent",
      "fx-component-percent",
      "fx-component-percent-unconfirmed",
    ].map(node),
    edges: [],
  },
  successCriteria: [],
  commonMistakes: [],
  resetBehavior: "resetTechnique",
  metadata: { version: "1.0.0", author: "fixture", updatedAt: "2026-08-05", tags: [] },
});

describe("the starting mass is the sample's declared mass", () => {
  it("reads 3.000 g from the sample rather than 0 from an absent expectation", () => {
    const definition = separationChain();
    const state = perform(definition, atAction(definition, "fx-starting-mass"), {
      actionId: "fx-starting-mass",
      verb: "weigh",
      sourceInstanceId: "fx-unknown",
      targetInstanceId: "fx-balance",
    });
    expect(
      state.measurements.find((measurement) => measurement.id === "fx-starting-mass")?.value,
      JSON.stringify({ attempt: state.attemptHistory.at(-1), feedback: state.feedbackQueue.at(-1) }),
    ).toBeCloseTo(
      3,
      3,
    );
  });
});

describe("a recovered mass comes from a declared component", () => {
  it("recovers exactly what the fraction carried", () => {
    const definition = separationChain();
    const state = perform(definition, atAction(definition, "fx-recover"), {
      actionId: "fx-recover",
      verb: "precipitate",
      targetInstanceId: "fx-fraction",
    });
    const contents = findInstance(state, "fx-fraction").contents;
    expect(
      contents.precipitate?.massG,
      JSON.stringify({ attempt: state.attemptHistory.at(-1), feedback: state.feedbackQueue.at(-1) }),
    ).toBeCloseTo(0.15, 4);
    expect(contents.precipitate?.substance).toBe("Recovered acidic component");
    expect(contents.solutes[0].id).toBe("fx-recovered-acidic");
  });

  it("yields no solid when the named component is not in the sample", () => {
    // A genuine non-detection: the Team A case must not fabricate a recovery.
    const definition = separationChain();
    const state = perform(definition, atAction(definition, "fx-recover-absent"), {
      actionId: "fx-recover-absent",
      verb: "precipitate",
      targetInstanceId: "fx-fraction",
    });
    expect(findInstance(state, "fx-fraction").contents.precipitate).toBeUndefined();
  });

  it("leaves the components it did not precipitate in solution", () => {
    // Replacing the whole solute list is right for a single-product preparation and wrong for a
    // multistage separation: it wiped the later stages' components out of the fraction, so the next
    // recovery found nothing and the investigation could not be completed.
    const definition = separationChain();
    const fraction = definition.initialState.equipment.find((item) => item.id === "fx-fraction")!;
    fraction.contents.solutes = SEPARATION_COMPOSITION.map((solute) => ({ ...solute }));
    const state = perform(definition, atAction(definition, "fx-recover"), {
      actionId: "fx-recover",
      verb: "precipitate",
      targetInstanceId: "fx-fraction",
    });
    const soluteIds = findInstance(state, "fx-fraction").contents.solutes.map((solute) => solute.id);
    expect(soluteIds).toContain("fx-binder");
    expect(soluteIds).toContain("fx-active");
    expect(soluteIds).toContain("fx-recovered-acidic");
    expect(soluteIds).not.toContain("fx-acidic");
  });

  it("keeps Investigation 3's substance for content that names none", () => {
    const definition = separationChain();
    const recover = definition.actions.find((candidate) => candidate.id === "fx-recover")!;
    delete recover.parameters.precipitateSoluteSourceId;
    delete recover.parameters.precipitateSubstance;
    delete recover.parameters.precipitateSoluteId;
    recover.parameters.precipitateMassG = 1.71;
    const state = perform(definition, atAction(definition, "fx-recover"), {
      actionId: "fx-recover",
      verb: "precipitate",
      targetInstanceId: "fx-fraction",
    });
    const contents = findInstance(state, "fx-fraction").contents;
    expect(
      contents.label,
      JSON.stringify({ attempt: state.attemptHistory.at(-1), feedback: state.feedbackQueue.at(-1) }),
    ).toBe("Calcium carbonate precipitate mixture");
    expect(contents.precipitate?.substance).toBe("Calcium carbonate");
  });
});

describe("composition figures need the student's own value and a confirmed formula", () => {
  const withMasses = (definition: TechniqueDefinition, actionId = "fx-component-percent") => {
    const state = atAction(definition, actionId);
    return {
      ...state,
      measurements: [
        { id: "fx-starting-mass", label: "starting", value: 3, unit: "g", nodeId: "n" },
        { id: "fx-component-mass", label: "component", value: 0.45, unit: "g", nodeId: "n" },
      ],
    };
  };

  it("derives the figure from the recorded masses when no input path supplies one", () => {
    // `StudentPlayer.submitCalculation` sends no value, so the derivation is what makes the figure
    // real. What must never happen again is the pre-Cycle-10 behaviour: value 0 against expected 0,
    // tolerance 0.5, passed.
    const definition = separationChain();
    const state = perform(definition, withMasses(definition), {
      actionId: "fx-component-percent",
      verb: "calculate",
    });
    const calculation = state.calculations.find((candidate) => candidate.id === "fx-component-percent");
    expect(failed(state)).toBe(false);
    expect(calculation?.value).toBeCloseTo(15, 2);
    expect(calculation?.value).not.toBe(0);
    expect(calculation?.passed).toBe(true);
  });

  it("checks the submitted figure against the recorded masses", () => {
    const definition = separationChain();
    const state = perform(definition, withMasses(definition), {
      actionId: "fx-component-percent",
      verb: "calculate",
      value: 15,
    });
    const calculation = state.calculations.find((candidate) => candidate.id === "fx-component-percent");
    expect(calculation?.value).toBeCloseTo(15, 2);
    expect(calculation?.expected).toBeCloseTo(15, 2);
    expect(calculation?.passed).toBe(true);
  });

  it("fails a figure that does not follow from the recorded masses", () => {
    const definition = separationChain();
    const state = perform(definition, withMasses(definition), {
      actionId: "fx-component-percent",
      verb: "calculate",
      value: 85,
    });
    expect(state.calculations.find((candidate) => candidate.id === "fx-component-percent")?.passed).toBe(
      false,
    );
  });

  it("refuses to run at all until the formula convention is confirmed", () => {
    const definition = separationChain();
    const state = perform(definition, withMasses(definition, "fx-component-percent-unconfirmed"), {
      actionId: "fx-component-percent-unconfirmed",
      verb: "calculate",
      value: 15,
    });
    expect(failed(state)).toBe(true);
    expect(state.calculations).toHaveLength(0);
  });

  it("refuses to run when a named mass was never recorded", () => {
    const definition = separationChain();
    const state = perform(definition, atAction(definition, "fx-component-percent"), {
      actionId: "fx-component-percent",
      verb: "calculate",
      value: 15,
    });
    expect(failed(state)).toBe(true);
  });
});
