import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  calculationTechnique,
  demoLab,
  dryingTechnique,
  filtrationTechnique,
  hardWaterDemoLab,
  measuringVolumeTechnique,
  thermalDecompositionTechnique,
  transferTechnique,
  weighingTechnique,
} from "../../domain/fixtures";
import type { LabCompositionSourceDefinition, LabDefinition, TechniqueDefinition } from "../../domain/types";
import { validateLabCompositionSource, validateTechniqueDefinition } from "../../domain/validation";
import { compileLabComposition } from "../../data/compileLabComposition";
import {
  createRuntimeState,
  getActions,
  getProcess,
  performRuntimeAction,
  resolveInteractionIntent,
} from "../index";

const expectRequest = (result: ReturnType<typeof resolveInteractionIntent>) => {
  expect(result.ok, result.ok ? undefined : JSON.stringify(result.feedback)).toBe(true);
  if (!result.ok) throw new Error(result.feedback.message);
  return result.request;
};

const assembleFiltrationApparatus = (state = createRuntimeState(filtrationTechnique)) =>
  performRuntimeAction(filtrationTechnique, state, {
    actionId: "assemble-funnel-stand",
    verb: "place",
  });

const loadPaperChromatographyTechnique = async (): Promise<TechniqueDefinition> => {
  const input = JSON.parse(
    await readFile(join(process.cwd(), "public", "techniques", "paper-chromatography.json"), "utf8"),
  ) as unknown;
  const validation = validateTechniqueDefinition(input);
  expect(validation.ok).toBe(true);
  if (!validation.ok || !validation.value) throw new Error(validation.errors.join("\n"));
  return validation.value;
};

const loadMarbleKineticsLab = async (): Promise<LabDefinition> => {
  const input = JSON.parse(
    await readFile(join(process.cwd(), "public", "labs", "marble-statue-kinetics.json"), "utf8"),
  ) as LabCompositionSourceDefinition;
  return compileLabComposition(input, async (techniqueId) => {
    const technique = await loadTechnique(`${techniqueId}.json`);
    if (technique.id !== techniqueId) {
      throw new Error(`Technique resolver returned ${technique.id} for ${techniqueId}.`);
    }
    return technique;
  });
};

const loadTechnique = async (file: string): Promise<TechniqueDefinition> => {
  const input = JSON.parse(
    await readFile(join(process.cwd(), "public", "techniques", file), "utf8"),
  ) as unknown;
  const validation = validateTechniqueDefinition(input);
  expect(validation.ok).toBe(true);
  if (!validation.ok || !validation.value) throw new Error(validation.errors.join("\n"));
  return validation.value;
};

const loadApChemChromatographySource = async (): Promise<LabCompositionSourceDefinition> => {
  const input = JSON.parse(
    await readFile(join(process.cwd(), "public", "labs", "paper-chromatography.json"), "utf8"),
  ) as unknown;
  const validation = validateLabCompositionSource(input);
  expect(validation.ok).toBe(true);
  if (!validation.ok || !validation.value) throw new Error(validation.errors.join("\n"));
  return validation.value;
};

const loadAcidBaseTitrationLab = async (): Promise<LabDefinition> => {
  const input = JSON.parse(
    await readFile(join(process.cwd(), "public", "labs", "acid-base-titration.json"), "utf8"),
  ) as unknown;
  const source = validateLabCompositionSource(input);
  expect(source.ok).toBe(true);
  if (!source.ok || !source.value) throw new Error(source.errors.join("\n"));

  const technique = await loadTechnique("titration-endpoint.json");
  return compileLabComposition(source.value, async (techniqueId) => {
    if (technique.id !== techniqueId) {
      throw new Error(`Technique resolver returned ${technique.id} for ${techniqueId}.`);
    }
    return technique;
  });
};

/**
 * Resolves the bridge at one real authored action without presenting this as route completion.
 * Only that action's workflow prerequisites are neutralized; input, equipment, and geometry
 * checks remain live. Workflow/gate behavior belongs in the dedicated procedure suites.
 */
const resolveAtAuthoredAction = (
  definition: TechniqueDefinition | LabDefinition,
  actionId: string,
  intent: Parameters<typeof resolveInteractionIntent>[2],
) => {
  const node = getProcess(definition).nodes.find((candidate) => candidate.actionId === actionId);
  const action = definition.actions.find((candidate) => candidate.id === actionId);
  if (!node || !action) throw new Error(`Missing authored action or process node for ${actionId}.`);

  const isolated = {
    ...definition,
    actions: definition.actions.map((candidate) =>
      candidate.id === actionId ? { ...candidate, prerequisites: [] } : candidate,
    ),
  } as typeof definition;
  return resolveInteractionIntent(isolated, {
    ...createRuntimeState(isolated),
    currentNodeId: node.id,
  }, intent);
};

describe("runtime interaction intent bridge", () => {
  it("resolves pointer, keyboard, and vision snap intents through the same request path", () => {
    const state = createRuntimeState(filtrationTechnique);
    const pointer = expectRequest(
      resolveInteractionIntent(filtrationTechnique, state, {
        type: "snapIntent",
        origin: "pointer",
        sourceDefinitionId: "funnel",
        targetDefinitionId: "ring-stand",
      }),
    );
    const keyboard = expectRequest(
      resolveInteractionIntent(filtrationTechnique, state, {
        type: "snapIntent",
        origin: "keyboard",
        sourceDefinitionId: "funnel",
        targetDefinitionId: "ring-stand",
      }),
    );
    const vision = expectRequest(
      resolveInteractionIntent(filtrationTechnique, state, {
        type: "snapIntent",
        origin: "vision",
        sourceDefinitionId: "funnel",
        targetDefinitionId: "ring-stand",
      }),
    );

    expect(pointer).toEqual(keyboard);
    expect(vision).toEqual(pointer);
    expect(pointer).toMatchObject({
      actionId: "assemble-funnel-stand",
      verb: "place",
      sourceInstanceId: "funnel-1",
      targetInstanceId: "ring-stand-1",
      equipmentDefinitionId: "funnel",
      location: "snapZone",
    });
    expect(pointer.parameters?.snapZoneId).toBe("ring-stand-funnel-seat");
  });

  it("produces reducer-equivalent requests for snap and pour interactions", () => {
    const filtrationState = createRuntimeState(filtrationTechnique);
    const snapRequest = expectRequest(
      resolveInteractionIntent(filtrationTechnique, filtrationState, { type: "snapIntent" }),
    );
    const snappedFromIntent = performRuntimeAction(filtrationTechnique, filtrationState, snapRequest);
    const snappedFromExplicit = performRuntimeAction(filtrationTechnique, filtrationState, {
      actionId: "assemble-funnel-stand",
      verb: "place",
      sourceInstanceId: "funnel-1",
      targetInstanceId: "ring-stand-1",
      equipmentDefinitionId: "funnel",
      location: "snapZone",
      parameters: { snapZoneId: "ring-stand-funnel-seat" },
    });

    expect(snappedFromIntent.currentNodeId).toBe(snappedFromExplicit.currentNodeId);
    expect(snappedFromIntent.completedNodes).toEqual(snappedFromExplicit.completedNodes);
    expect(snappedFromIntent.equipmentInstances.find((item) => item.id === "funnel-1")?.location)
      .toBe("storage");
    expect(snappedFromIntent.equipmentInstances.find((item) => item.id === "ring-stand-1")?.location)
      .toBe("storage");
    expect(snappedFromIntent.equipmentInstances.find((item) => item.id === "funnel-stand-1")?.location)
      .toBe("workbench");
    expect(snappedFromIntent.attachments).toEqual([]);

    const placed = performRuntimeAction(measuringVolumeTechnique, createRuntimeState(measuringVolumeTechnique), {
      actionId: "place-cylinder",
      verb: "place",
    });
    const pourRequest = expectRequest(
      resolveInteractionIntent(measuringVolumeTechnique, placed, { type: "pourIntent" }),
    );
    const pouredFromIntent = performRuntimeAction(measuringVolumeTechnique, placed, pourRequest);
    const pouredFromExplicit = performRuntimeAction(measuringVolumeTechnique, placed, {
      actionId: "measure-20ml",
      verb: "measureVolume",
    });

    expect(pouredFromIntent.currentNodeId).toBe(pouredFromExplicit.currentNodeId);
    expect(pouredFromIntent.measurements).toEqual(pouredFromExplicit.measurements);
  });

  it("resolves rinse, instrument, notebook, and calculation intents", () => {
    const withFilterPaper = performRuntimeAction(filtrationTechnique, assembleFiltrationApparatus(), {
      actionId: "place-filter-paper",
      verb: "place",
    });
    expectRequest(resolveInteractionIntent(filtrationTechnique, withFilterPaper, { type: "rinseIntent" }));

    const dryRequest = expectRequest(
      resolveInteractionIntent(dryingTechnique, createRuntimeState(dryingTechnique), {
        type: "instrumentReadIntent",
      }),
    );
    expect(dryRequest).toMatchObject({ actionId: "dry-precipitate", verb: "dry" });

    const placed = performRuntimeAction(measuringVolumeTechnique, createRuntimeState(measuringVolumeTechnique), {
      actionId: "place-cylinder",
      verb: "place",
    });
    const measured = performRuntimeAction(measuringVolumeTechnique, placed, {
      actionId: "measure-20ml",
      verb: "measureVolume",
    });
    const recordRequest = expectRequest(
      resolveInteractionIntent(measuringVolumeTechnique, measured, { type: "notebookRecordIntent" }),
    );
    expect(recordRequest).toMatchObject({
      actionId: "record-volume",
      verb: "record",
      measurementId: "sample-volume",
    });

    const calculationRequest = expectRequest(
      resolveInteractionIntent(calculationTechnique, createRuntimeState(calculationTechnique), {
        type: "calculationSubmitIntent",
      }),
    );
    expect(calculationRequest).toMatchObject({
      actionId: "calculate-hardness",
      verb: "calculate",
      calculationId: "hardness-mg-l",
    });
  });

  it("resolves kinetics time-series record intents", async () => {
    const lab = await loadMarbleKineticsLab();
    let state = createRuntimeState(lab);
    const process = getProcess(lab);
    const actions = getActions(lab);

    // The raw lab source contains only local nodes; technique-owned practice nodes exist only in
    // the compiled definition that Student Player consumes. Keep traversal bounded so a rejected
    // or disconnected transition reports the exact action and feedback instead of leaving Vitest
    // alive indefinitely.
    for (let transitionCount = 0;
      state.currentNodeId !== "record-practice-run-node" && transitionCount < process.nodes.length;
      transitionCount += 1) {
      const current = process.nodes.find((node) => node.id === state.currentNodeId);
      const action = actions.find((candidate) => candidate.id === current?.actionId);
      if (!action) throw new Error(`Missing action for node ${state.currentNodeId}.`);
      const feedbackCount = state.feedbackQueue.length;
      // These are the two explicit learner readings needed by the compiled, current-source
      // practice route. They exercise the same action-input gates as Student Player rather than
      // bypassing the reducer with a manufactured state.
      const request = action.id === "zero-gas-syringe"
        ? { actionId: action.id, verb: action.verb, value: 0, unit: "mL" }
        : action.id === "weigh-practice-marble"
          ? { actionId: action.id, verb: action.verb, value: 1.3, unit: "g" }
          : { actionId: action.id, verb: action.verb };
      const next = performRuntimeAction(lab, state, request);
      const attempt = next.attemptHistory.at(-1);
      const feedback = next.feedbackQueue.slice(feedbackCount).at(-1);
      const diagnostic = JSON.stringify({
        currentNodeId: state.currentNodeId,
        actionId: action.id,
        verb: action.verb,
        attempt,
        feedback,
        nextNodeId: next.currentNodeId,
      });
      expect(attempt?.success, diagnostic).toBe(true);
      expect(next.currentNodeId, diagnostic).not.toBe(state.currentNodeId);
      state = next;
    }

    expect(state.currentNodeId, `Failed to reach record-practice-run-node after ${process.nodes.length} transitions.`)
      .toBe("record-practice-run-node");

    const request = expectRequest(resolveInteractionIntent(lab, state, { type: "timeSeriesRecordIntent" }));
    expect(request).toMatchObject({
      actionId: "record-practice-run",
      verb: "record",
    });
    const recorded = performRuntimeAction(lab, state, request);
    expect(recorded.dataSeries.find((series) => series.id === "practice-gas-series")?.points).toHaveLength(10);
  });

  it("maps current paper-chromatography actions without claiming configured trial completion", async () => {
    const technique = await loadPaperChromatographyTechnique();

    expect(expectRequest(resolveAtAuthoredAction(technique, "label-water-trial", {
      type: "notebookRecordIntent",
      origin: "keyboard",
    }))).toMatchObject({ actionId: "label-water-trial", verb: "observe" });
    expect(expectRequest(resolveAtAuthoredAction(technique, "place-water-chamber", {
      type: "placeIntent",
      origin: "keyboard",
    }))).toMatchObject({
      actionId: "place-water-chamber",
      verb: "place",
      sourceInstanceId: "water-chamber",
    });
    expect(expectRequest(resolveAtAuthoredAction(technique, "add-water-solvent", {
      type: "pourIntent",
      origin: "keyboard",
    }))).toMatchObject({
      actionId: "add-water-solvent",
      verb: "transfer",
      sourceInstanceId: "water-solvent-bottle",
      targetInstanceId: "water-chamber",
    });
    expect(expectRequest(resolveAtAuthoredAction(technique, "draw-water-baseline", {
      type: "notebookRecordIntent",
      origin: "keyboard",
    }))).toMatchObject({ actionId: "draw-water-baseline", verb: "observe", sourceInstanceId: "water-paper" });
    expect(expectRequest(resolveAtAuthoredAction(technique, "load-water-capillary", {
      type: "pourIntent",
      origin: "keyboard",
    }))).toMatchObject({
      actionId: "load-water-capillary",
      verb: "transfer",
      sourceInstanceId: "food-dye-sample",
      targetInstanceId: "dye-spotter",
    });
    expect(expectRequest(resolveAtAuthoredAction(technique, "spot-water-sample", {
      type: "spotIntent",
      origin: "keyboard",
    }))).toMatchObject({
      actionId: "spot-water-sample",
      verb: "spotSample",
      sourceInstanceId: "dye-spotter",
      targetInstanceId: "water-paper",
    });
    // Insertion and closure are separate operations now, and both map through the same bridge as
    // everything else: closing the lid is a physical step the learner performs, not a control label.
    expect(expectRequest(resolveAtAuthoredAction(technique, "insert-water-paper", {
      type: "snapIntent",
      origin: "keyboard",
    }))).toMatchObject({
      actionId: "insert-water-paper",
      verb: "place",
      sourceInstanceId: "water-paper",
      targetInstanceId: "water-chamber",
      location: "snapZone",
    });
    expect(expectRequest(resolveAtAuthoredAction(technique, "close-water-chamber", {
      type: "notebookRecordIntent",
      origin: "keyboard",
    }))).toMatchObject({
      actionId: "close-water-chamber",
      verb: "observe",
      targetInstanceId: "water-chamber",
    });
    // Development is the one operation in this sequence that moves nothing: the strip is already
    // hanging inside and the lid is already on. It takes the process-control endpoint, like the two
    // lid operations either side of it, and still resolves to the same strip and chamber because the
    // instance ids live on the action's own parameters.
    expect(expectRequest(resolveAtAuthoredAction(technique, "develop-water-paper", {
      type: "notebookRecordIntent",
      origin: "keyboard",
    }))).toMatchObject({
      actionId: "develop-water-paper",
      verb: "developChromatogram",
      sourceInstanceId: "water-paper",
      targetInstanceId: "water-chamber",
    });
    expect(expectRequest(resolveAtAuthoredAction(technique, "open-water-chamber", {
      type: "notebookRecordIntent",
      origin: "keyboard",
    }))).toMatchObject({
      actionId: "open-water-chamber",
      verb: "observe",
      targetInstanceId: "water-chamber",
    });

    // A closed chamber refuses the snap before a request is built, so the pointer, keyboard and
    // gesture paths all report the lid rather than reaching the reducer with an impossible intent.
    const sealedNode = getProcess(technique).nodes.find((node) => node.actionId === "insert-water-paper")!;
    const sealedState = createRuntimeState(technique);
    const sealed = resolveInteractionIntent(
      {
        ...technique,
        actions: technique.actions.map((action) =>
          action.id === "insert-water-paper" ? { ...action, prerequisites: [] } : action,
        ),
      },
      {
        ...sealedState,
        currentNodeId: sealedNode.id,
        equipmentInstances: sealedState.equipmentInstances.map((instance) =>
          instance.id === "water-chamber"
            ? { ...instance, contents: { ...instance.contents, developingChamberClosed: true } }
            : instance,
        ),
      },
      { type: "snapIntent", origin: "pointer" },
    );
    expect(sealed.ok).toBe(false);
    if (!sealed.ok) {
      expect(sealed.feedback.reason).toBe("invalidTarget");
      expect(sealed.feedback.message).toMatch(/is closed/i);
    }

    // Development needs the lid on, and the closure preflight must not refuse it: that preflight
    // guards reaching into a sealed vessel, which development does not do.
    const developNode = getProcess(technique).nodes.find((node) => node.actionId === "develop-water-paper")!;
    const developingTechnique = {
      ...technique,
      actions: technique.actions.map((action) =>
        action.id === "develop-water-paper" ? { ...action, prerequisites: [] } : action,
      ),
    };
    const sealedChamberState = {
      ...sealedState,
      currentNodeId: developNode.id,
      equipmentInstances: sealedState.equipmentInstances.map((instance) =>
        instance.id === "water-chamber"
          ? { ...instance, contents: { ...instance.contents, developingChamberClosed: true } }
          : instance,
      ),
    };
    const developing = resolveInteractionIntent(
      developingTechnique,
      sealedChamberState,
      { type: "notebookRecordIntent", origin: "pointer" },
    );
    expect(expectRequest(developing)).toMatchObject({
      actionId: "develop-water-paper",
      verb: "developChromatogram",
      targetInstanceId: "water-chamber",
    });

    // And the strip drag is gone. Development used to accept a snap of the paper into the chamber,
    // which the player rendered as "Drag the chromatography paper onto the chromatography chamber"
    // — through a lid the learner had just closed, onto a strip already inside. The operation now
    // refuses that gesture outright rather than completing on it.
    const dragged = resolveInteractionIntent(
      developingTechnique,
      sealedChamberState,
      { type: "snapIntent", origin: "pointer" },
    );
    expect(dragged.ok).toBe(false);
    if (!dragged.ok) {
      expect(dragged.feedback.reason).toBe("incompatibleIntent");
      expect(dragged.feedback.recovery).toMatch(/already loaded and sealed/i);
    }
    expect(expectRequest(resolveAtAuthoredAction(technique, "calculate-water-rf", {
      type: "calculationSubmitIntent",
      origin: "keyboard",
    }))).toMatchObject({ actionId: "calculate-water-rf", calculationId: "water-rf" });

    // The drying step no longer carries a teacher-configuration field, so the keyboard intent has to
    // map to a plain observation. Mapping is not completion: the attempt below still fails, now on
    // the marked-solvent-front evidence rather than on an approval nobody could authenticate.
    const drying = resolveAtAuthoredAction(technique, "dry-water-chromatogram", {
      type: "notebookRecordIntent",
      origin: "keyboard",
    });
    expect(drying.ok).toBe(true);
    if (drying.ok) {
      expect(drying.request).toMatchObject({
        actionId: "dry-water-chromatogram",
        verb: "observe",
      });
      expect(drying.request.parameters?.configurationApproved).toBeUndefined();
      const dryingAttempt = performRuntimeAction(
        technique,
        {
          ...createRuntimeState(technique),
          currentNodeId: "dry-water-chromatogram-node",
        },
        drying.request,
      );
      expect(dryingAttempt.currentNodeId).toBe("dry-water-chromatogram-node");
      expect(dryingAttempt.attemptHistory.at(-1)).toMatchObject({
        actionId: "dry-water-chromatogram",
        success: false,
        message: "Prerequisite missing.",
      });
      expect(dryingAttempt.feedbackQueue.at(-1)?.message).toMatch(/solvent front/i);
      expect(dryingAttempt.feedbackQueue.at(-1)?.message).not.toMatch(/teacher|configuration/i);
    }
  });

  it("maps current dilution setup and preserves its explicit configuration inputs", async () => {
    const technique = await loadTechnique("transmittance-dilution.json");

    expect(expectRequest(resolveAtAuthoredAction(technique, "transmittance-dilution-place-volumetric-flask", {
      type: "placeIntent",
      origin: "vision",
    }))).toMatchObject({
      actionId: "transmittance-dilution-place-volumetric-flask",
      verb: "place",
      sourceInstanceId: "prepared-receiver-1",
    });
    expect(expectRequest(resolveAtAuthoredAction(technique, "transmittance-dilution-configure-photometer", {
      type: "instrumentReadIntent",
      origin: "vision",
    }))).toMatchObject({
      actionId: "transmittance-dilution-configure-photometer",
      verb: "observe",
      sourceInstanceId: "spectrophotometer-1",
    });

    for (const actionId of [
      "transmittance-dilution-measure-stock-dye",
      "transmittance-dilution-add-water-below-mark",
    ]) {
      const requiredConfiguration = resolveAtAuthoredAction(technique, actionId, {
        type: "pourIntent",
        origin: "vision",
      });
      expect(requiredConfiguration.ok).toBe(false);
      if (!requiredConfiguration.ok) expect(requiredConfiguration.feedback.reason).toBe("missingPrerequisite");
    }
  });

  it("maps current thermal actions while retaining the pre-lab configuration gate", () => {
    const initial = createRuntimeState(thermalDecompositionTechnique);
    const skippedPlan = resolveInteractionIntent(thermalDecompositionTechnique, initial, {
      type: "placeIntent",
      origin: "vision",
    });
    expect(skippedPlan.ok).toBe(false);
    if (!skippedPlan.ok) expect(skippedPlan.feedback.reason).toBe("incompatibleIntent");

    expect(expectRequest(resolveInteractionIntent(thermalDecompositionTechnique, initial, {
      type: "notebookRecordIntent",
      origin: "vision",
      note: "Teacher approved",
      configurationApproved: true,
    }))).toMatchObject({ actionId: "approve-thermal-decomposition-plan", verb: "record" });
    expect(expectRequest(resolveAtAuthoredAction(thermalDecompositionTechnique, "place-balance", {
      type: "placeIntent",
      origin: "vision",
    }))).toMatchObject({ actionId: "place-balance", sourceInstanceId: "analytical-balance-a" });
    expect(expectRequest(resolveAtAuthoredAction(thermalDecompositionTechnique, "add-clay-triangle", {
      type: "snapIntent",
      origin: "vision",
    }))).toMatchObject({
      actionId: "add-clay-triangle",
      sourceInstanceId: "clay-triangle-1",
      targetInstanceId: "ring-stand-1",
    });
    expect(expectRequest(resolveAtAuthoredAction(thermalDecompositionTechnique, "heat-carbonate-mixture", {
      type: "instrumentReadIntent",
      origin: "vision",
    }))).toMatchObject({
      actionId: "heat-carbonate-mixture",
      verb: "dry",
      sourceInstanceId: "crucible-with-lid-1",
      targetInstanceId: "bunsen-burner-1",
    });
    expect(expectRequest(resolveAtAuthoredAction(thermalDecompositionTechnique, "cool-crucible", {
      type: "instrumentReadIntent",
      origin: "vision",
    }))).toMatchObject({
      actionId: "cool-crucible",
      verb: "cool",
      sourceInstanceId: "crucible-with-lid-1",
      targetInstanceId: "crucible-tongs-1",
    });
  });

  it("seats the hand-warmer heater on the calorimeter stand base and advances CAL-01", async () => {
    const technique = await loadTechnique("hand-warmer-calorimetry.json");
    const initial = createRuntimeState(technique);
    const state = {
      ...initial,
      currentNodeId: "cal-01-node",
      completedNodes: [
        "saf-01-node",
        "saf-02-node",
        "saf-03-node",
        "saf-04-node",
        "saf-05-node",
        "saf-06-node",
        "saf-07-node",
      ],
    };

    const request = expectRequest(
      resolveInteractionIntent(technique, state, {
        type: "snapIntent",
        origin: "pointer",
        sourceInstanceId: "hot-plate-stirrer-1",
        targetInstanceId: "hand-warmer-calorimeter-1",
        sourceDefinitionId: "hot-plate-stirrer",
        targetDefinitionId: "hand-warmer-calorimeter",
        snapZoneId: "hand-warmer-stirrer-base",
        x: 235,
        y: 330,
      }),
    );
    expect(request.parameters?.snapZoneId).toBe("hand-warmer-stirrer-base");

    const next = performRuntimeAction(technique, state, request);
    expect(next.currentNodeId).toBe("cal-02-node");
    expect(next.completedNodes).toContain("cal-01-node");
    expect(next.equipmentInstances.find((item) => item.id === "hot-plate-stirrer-1")).toMatchObject({
      location: "snapZone",
      snapZoneId: "hand-warmer-stirrer-base",
    });
    expect(next.attachments).toContainEqual(expect.objectContaining({
      parentInstanceId: "hand-warmer-calorimeter-1",
      childInstanceId: "hot-plate-stirrer-1",
      zoneId: "hand-warmer-stirrer-base",
    }));
  });

  it("keeps every hand-warmer assembly snap locally owned and completable", async () => {
    const technique = await loadTechnique("hand-warmer-calorimetry.json");
    const actionIds = ["CAL-01", "CAL-02", "CAL-03", "CAL-04", "CAL-05", "P1-11", "P1-11-T2"];
    let calibrationAssemblyState = {
      ...createRuntimeState(technique),
      currentNodeId: "cal-01-node",
    };

    for (const actionId of actionIds) {
      const action = getActions(technique).find((candidate) => candidate.id === actionId);
      const node = getProcess(technique).nodes.find((candidate) => candidate.actionId === actionId);
      expect(action, actionId).toBeDefined();
      expect(node, actionId).toBeDefined();
      if (!action || !node || action.interaction?.type !== "snapIntoTarget") {
        throw new Error(`Expected ${actionId} to define a snap interaction.`);
      }

      const sourceInstanceId = action.parameters.equipmentInstanceId;
      const targetInstanceId = action.parameters.targetInstanceId;
      const snapZoneId = action.interaction.snapZoneId;
      expect(typeof sourceInstanceId, actionId).toBe("string");
      expect(typeof targetInstanceId, actionId).toBe("string");
      expect(typeof snapZoneId, actionId).toBe("string");
      if (
        typeof sourceInstanceId !== "string" ||
        typeof targetInstanceId !== "string" ||
        typeof snapZoneId !== "string"
      ) {
        throw new Error(`Expected ${actionId} to define source, target, and snap-zone identifiers.`);
      }

      const isCalibrationAssemblyStep = actionId.startsWith("CAL-");
      const state = isCalibrationAssemblyStep
        ? calibrationAssemblyState
        : { ...createRuntimeState(technique), currentNodeId: node.id };
      expect(state.currentNodeId, actionId).toBe(node.id);
      const request = expectRequest(
        resolveInteractionIntent(technique, state, {
          type: "snapIntent",
          origin: "pointer",
          sourceInstanceId,
          targetInstanceId,
          sourceDefinitionId: action.interaction.sourceDefinitionId,
          targetDefinitionId: action.interaction.targetDefinitionId,
          snapZoneId,
        }),
      );
      const next = performRuntimeAction(technique, state, request);

      expect(next.completedNodes, actionId).toContain(node.id);
      expect(next.currentNodeId, actionId).not.toBe(node.id);
      expect(next.attachments, actionId).toContainEqual(expect.objectContaining({
        parentInstanceId: targetInstanceId,
        childInstanceId: sourceInstanceId,
        zoneId: snapZoneId,
      }));
      if (isCalibrationAssemblyStep) calibrationAssemblyState = next;
    }
  });

  it("keeps the chromatography pre-lab source surface separate from compiled trial routing", async () => {
    const source = await loadApChemChromatographySource();
    const hypothesis = source.actions.find((action) => action.id === "record-imf-hypothesis");

    expect(hypothesis).toMatchObject({
      verb: "observe",
      interaction: { type: "recordNotebook" },
      parameters: {
        inputMode: "text",
        inputRole: "studentResponse",
        inputRequired: true,
      },
    });
    expect(source.techniqueInstances).toContainEqual(expect.objectContaining({
      instanceId: "chromatography-trials",
      techniqueId: "paper-chromatography",
    }));
    expect(source.compositionConnections).toContainEqual(expect.objectContaining({
      from: expect.objectContaining({ kind: "lab-node", nodeId: "submit-procedure-approval-node" }),
      to: expect.objectContaining({ kind: "technique-port", instanceId: "chromatography-trials" }),
    }));
  });

  it("reports wrong sequence and invalid target intents without mutating state", () => {
    const initial = createRuntimeState(measuringVolumeTechnique);
    const wrongSequence = resolveInteractionIntent(measuringVolumeTechnique, initial, {
      type: "pourIntent",
      actionId: "measure-20ml",
    });
    expect(wrongSequence.ok).toBe(false);
    if (!wrongSequence.ok) expect(wrongSequence.feedback.reason).toBe("wrongSequence");

    const placed = performRuntimeAction(measuringVolumeTechnique, initial, {
      actionId: "place-cylinder",
      verb: "place",
    });
    const before = JSON.stringify(placed);
    const invalidTarget = resolveInteractionIntent(measuringVolumeTechnique, placed, {
      type: "pourIntent",
      targetInstanceId: "sample-bottle-1",
    });
    expect(invalidTarget.ok).toBe(false);
    if (!invalidTarget.ok) expect(invalidTarget.feedback.reason).toBe("invalidTarget");
    expect(JSON.stringify(placed)).toBe(before);
  });

  it("preflights overflow and missing prerequisite failures", () => {
    const readyToTransfer = performRuntimeAction(transferTechnique, createRuntimeState(transferTechnique), {
      actionId: "place-beaker",
      verb: "place",
    });
    const overflow = resolveInteractionIntent(transferTechnique, readyToTransfer, {
      type: "pourIntent",
      value: 300,
    });
    expect(overflow.ok).toBe(false);
    if (!overflow.ok) expect(overflow.feedback.reason).toBe("overflowRisk");

    const gated: TechniqueDefinition = {
      ...weighingTechnique,
      actions: weighingTechnique.actions.map((action, index) =>
        index === 0
          ? {
              ...action,
              prerequisites: [
                {
                  id: "setup-mass-required",
                  type: "measurementRecorded",
                  label: "Setup mass is required.",
                  measurementId: "setup-mass",
                },
              ],
            }
          : action,
      ),
    };
    const missingPrerequisite = resolveInteractionIntent(gated, createRuntimeState(gated), {
      type: "placeIntent",
    });
    expect(missingPrerequisite.ok).toBe(false);
    if (!missingPrerequisite.ok) expect(missingPrerequisite.feedback.reason).toBe("missingPrerequisite");
  });

  it("lets filter pours reach filter-specific missing precipitate feedback", () => {
    const filterFocused = {
      ...createRuntimeState(demoLab),
      currentNodeId: "demo-filter-node",
    };
    const request = expectRequest(resolveInteractionIntent(demoLab, filterFocused, { type: "pourIntent" }));

    const result = performRuntimeAction(demoLab, filterFocused, request);
    const lastFeedback = result.feedbackQueue.at(-1);

    expect(lastFeedback?.message).toMatch(/does not contain a precipitate/i);
    expect(lastFeedback?.message).not.toMatch(/does not contain enough material/i);
  });

  it("records the current compiled acid-base delivery surface without claiming a stopcock route", async () => {
    const lab = await loadAcidBaseTitrationLab();
    const delivery = lab.actions.find((action) => action.id === "deliver-titrant");
    expect(delivery?.interaction?.type).toBe("recordNotebook");

    const drop = resolveAtAuthoredAction(lab, "deliver-titrant", { type: "dispenseDropIntent" });
    expect(drop.ok).toBe(false);
    if (!drop.ok) expect(drop.feedback.reason).toBe("incompatibleIntent");

    // 0.05 mL is the source-bound endpoint window, used only to satisfy the current input contract.
    expect(expectRequest(resolveAtAuthoredAction(lab, "deliver-titrant", {
      type: "notebookRecordIntent",
      value: 0.05,
      unit: "mL",
    }))).toMatchObject({
      actionId: "deliver-titrant",
      verb: "transfer",
      sourceInstanceId: "burette-50ml-1",
      targetInstanceId: "erlenmeyer-flask-250ml-1",
      value: 0.05,
      unit: "mL",
    });
  });

  it("rejects instrument placement intents that omit the sample source contract", () => {
    const missingSourceContract: TechniqueDefinition = {
      ...dryingTechnique,
      actions: dryingTechnique.actions.map((action) =>
        action.id === "dry-precipitate"
          ? {
              ...action,
              interaction: action.interaction
                ? {
                    ...action.interaction,
                    sourceDefinitionId: undefined,
                  }
                : action.interaction,
            }
          : action,
      ),
    };

    const result = resolveInteractionIntent(missingSourceContract, createRuntimeState(missingSourceContract), {
      type: "instrumentReadIntent",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.feedback.reason).toBe("missingSource");
  });

  it("runs hard-water physical, notebook, and calculation gestures through completion", () => {
    let state = createRuntimeState(hardWaterDemoLab);
    const run = (intent: Parameters<typeof resolveInteractionIntent>[2]) => {
      const request = expectRequest(resolveInteractionIntent(hardWaterDemoLab, state, intent));
      state = performRuntimeAction(hardWaterDemoLab, state, request);
    };

    run({
      type: "pourIntent",
      sourceInstanceId: "sample-bottle-1",
      targetInstanceId: "graduated-cylinder-1",
    });
    run({ type: "notebookRecordIntent" });
    run({
      type: "pourIntent",
      sourceInstanceId: "graduated-cylinder-1",
      targetInstanceId: "beaker-250ml-1",
    });
    run({
      type: "pourIntent",
      sourceInstanceId: "reagent-bottle-1",
      targetInstanceId: "beaker-250ml-1",
    });
    run({
      type: "snapIntent",
      sourceInstanceId: "funnel-1",
      targetInstanceId: "ring-stand-1",
      x: 170,
      y: 86,
    });
    run({
      type: "snapIntent",
      sourceInstanceId: "filter-paper-1",
      targetInstanceId: "funnel-stand-1",
      x: 170,
      y: 86,
    });
    run({
      type: "rinseIntent",
      sourceInstanceId: "wash-bottle-1",
      targetInstanceId: "filter-paper-1",
    });
    run({
      type: "snapIntent",
      sourceInstanceId: "erlenmeyer-flask-250ml-1",
      targetInstanceId: "funnel-stand-1",
      x: 190,
      y: 140,
    });
    run({
      type: "pourIntent",
      sourceInstanceId: "beaker-250ml-1",
      targetInstanceId: "funnel-stand-1",
    });
    run({
      type: "rinseIntent",
      sourceInstanceId: "wash-bottle-1",
      targetInstanceId: "filter-paper-1",
    });
    run({
      type: "instrumentReadIntent",
      sourceInstanceId: "watch-glass-1",
      targetInstanceId: "drying-oven-1",
    });
    run({
      type: "instrumentReadIntent",
      sourceInstanceId: "watch-glass-1",
      targetInstanceId: "analytical-balance-1",
      value: 0.0075,
      unit: "g",
    });
    run({ type: "notebookRecordIntent" });
    run({ type: "calculationSubmitIntent" });

    expect(state.completedNodes).toHaveLength(hardWaterDemoLab.process.nodes.length);
    expect(state.measurements.find((measurement) => measurement.id === "dry-precipitate-mass")?.value)
      .toBe(0.0075);
    expect(state.calculations.find((calculation) => calculation.id === "hardness-mg-l")?.value)
      .toBe(375);
  });
});
