import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  calculationTechnique,
  demoLab,
  dilutionTechnique,
  dryingTechnique,
  filtrationTechnique,
  hardWaterDemoLab,
  hardWaterSamples,
  measuringVolumeTechnique,
  solutionTechnique,
  thermalDecompositionTechnique,
  transmittanceDilutionTechnique,
  transferTechnique,
  weighingTechnique,
} from "../../domain/fixtures";
import { emptyContents } from "../../domain/types";
import type { ContentState, LabCompositionSourceDefinition, LabDefinition, RuntimeState, TechniqueDefinition } from "../../domain/types";
import { validateLabCompositionSource, validateLabDefinition, validateTechniqueDefinition } from "../../domain/validation";
import { compileLabComposition } from "../../data/compileLabComposition";
import { applyLabSetup } from "../../data/labSetup";
import { applyTechniqueConfiguration } from "../../data/techniqueConfiguration";
import { createEquipmentInstance } from "../../equipment/catalog";
import { appendTechniqueToDraft, createDraftFromDemo } from "../../studio/studioState";
import {
  calculateAbsorbanceFromPercentT,
  calculateChromatographyRf,
  calculateDecimalTransmittance,
  calculateDilutedConcentration,
  calculateHardnessMgLAsCaCO3,
  createRuntimeState,
  getActions,
  getProcess,
  performRuntimeAction,
} from "../index";
import type { RuntimeDefinition } from "../createRuntime";

const runCurrentAction = (definition: TechniqueDefinition, state = createRuntimeState(definition)) => {
  const current = getProcess(definition).nodes.find((node) => node.id === state.currentNodeId);
  const action = getActions(definition).find((candidate) => candidate.id === current?.actionId);
  if (!action) throw new Error("Missing action for current node.");
  return performRuntimeAction(definition, state, { actionId: action.id, verb: action.verb });
};

const completeTechnique = (
  definition: TechniqueDefinition,
  actionInputs: Readonly<Record<string, number>> = {},
) => {
  let state = createRuntimeState(definition);
  for (let index = 0; index < definition.process.nodes.length; index += 1) {
    const current = getProcess(definition).nodes.find((node) => node.id === state.currentNodeId);
    const action = getActions(definition).find((candidate) => candidate.id === current?.actionId);
    if (!action) throw new Error("Missing action for current node.");
    const value = actionInputs[action.id];
    state = performRuntimeAction(definition, state, {
      actionId: action.id,
      verb: action.verb,
      ...(value !== undefined ? { value } : {}),
    });
  }
  return state;
};

const runUntilStalled = (
  definition: TechniqueDefinition,
  actionInputs: Readonly<Record<string, number>> = {},
) => {
  let state = createRuntimeState(definition);
  for (let index = 0; index < getProcess(definition).nodes.length; index += 1) {
    const current = getProcess(definition).nodes.find((node) => node.id === state.currentNodeId);
    const action = getActions(definition).find((candidate) => candidate.id === current?.actionId);
    if (!action) throw new Error(`Missing action for node ${state.currentNodeId}.`);
    const value = actionInputs[action.id];
    const next = performRuntimeAction(definition, state, {
      actionId: action.id,
      verb: action.verb,
      ...(value !== undefined ? { value } : {}),
    });
    if (next.currentNodeId === state.currentNodeId && next.attemptHistory.at(-1)?.success === false) return next;
    state = next;
  }
  return state;
};

const stateAtCalculation = (
  definition: RuntimeDefinition,
  actionId: string,
  evidence?: { value: number; unit: string },
) => {
  const action = getActions(definition).find((candidate) => candidate.id === actionId);
  const node = getProcess(definition).nodes.find((candidate) => candidate.actionId === actionId);
  const sourceMeasurementId = action?.parameters.sourceMeasurementId;
  if (!action || !node || typeof sourceMeasurementId !== "string") {
    throw new Error(`Missing source-measurement calculation contract for ${actionId}.`);
  }
  const state = createRuntimeState(definition);
  return {
    ...state,
    currentNodeId: node.id,
    measurements: evidence
      ? [
          ...state.measurements,
          {
            id: sourceMeasurementId,
            label: "Synthetic percent-transmittance evidence",
            value: evidence.value,
            unit: evidence.unit,
            nodeId: node.id,
          },
        ]
      : state.measurements,
  };
};

const thermalResidue = (temperatureC: number, massG = 0.5): ContentState => ({
  ...emptyContents("Carbonate mixture residue"),
  kind: "solid",
  massG,
  solutes: [{ id: "sodium-bicarbonate", label: "Sodium bicarbonate", amount: massG, unit: "g" }],
  temperatureC,
  wetState: "dry",
  visualState: "solid-sample",
});

const thermalStateAt = (currentNodeId: string, contents: ContentState) => {
  const state = createRuntimeState(thermalDecompositionTechnique);
  const equipmentInstances = state.equipmentInstances.map((instance) =>
    instance.id === "crucible-with-lid-1"
      ? { ...instance, location: "workbench" as const, contents }
      : ["analytical-balance-a", "bunsen-burner-1", "crucible-tongs-1"].includes(instance.id)
        ? { ...instance, location: "workbench" as const }
        : instance,
  );
  return {
    ...state,
    currentNodeId,
    equipmentInstances,
    contents: Object.fromEntries(equipmentInstances.map((instance) => [instance.id, instance.contents])),
  };
};

const completeDefinition = (
  definition: RuntimeDefinition,
  actionInputs: Readonly<Record<string, number>> = {},
) => {
  let state = createRuntimeState(definition);
  for (let index = 0; index < getProcess(definition).nodes.length; index += 1) {
    const current = getProcess(definition).nodes.find((node) => node.id === state.currentNodeId);
    const action = getActions(definition).find((candidate) => candidate.id === current?.actionId);
    if (!action) throw new Error("Missing action for current node.");
    const value = actionInputs[action.id];
    state = performRuntimeAction(definition, state, {
      actionId: action.id,
      verb: action.verb,
      ...(value !== undefined ? { value } : {}),
    });
  }
  return state;
};

const assembleFiltrationApparatus = (state = createRuntimeState(filtrationTechnique)) =>
  performRuntimeAction(filtrationTechnique, state, {
    actionId: "assemble-funnel-stand",
    verb: "place",
    sourceInstanceId: "funnel-1",
    targetInstanceId: "ring-stand-1",
    equipmentDefinitionId: "funnel",
    location: "snapZone",
    parameters: { snapZoneId: "ring-stand-funnel-seat" },
  });

const precipitateMixture = (label: string, volumeMl: number, precipitateMassG: number): ContentState => ({
  kind: "mixture",
  label,
  volumeMl,
  solutes: [{ id: "calcium-carbonate", label: "Calcium carbonate", amount: precipitateMassG, unit: "g" }],
  precipitate: {
    substance: "Calcium carbonate",
    massG: precipitateMassG,
    rinsed: false,
    dryness: "wet",
  },
  contamination: [],
  wetState: "wet",
  visualState: "cloudy-precipitate",
});

const liquidContent = (label: string, volumeMl: number): ContentState => ({
  kind: "liquid",
  label,
  volumeMl,
  solutes: [],
  contamination: [],
  wetState: "wet",
  visualState: "clear-liquid",
});

const buchnerFiltrationTechnique: TechniqueDefinition = {
  ...filtrationTechnique,
  id: "buchner-filtration-test",
  title: "Buchner Filtration Test",
  requiredEquipment: ["beaker-250ml", "buchner-funnel", "filter-paper", "side-arm-filter-flask", "wash-bottle"],
  initialState: {
    equipment: [
      {
        ...createEquipmentInstance("beaker-250ml", "1", "workbench"),
        contents: precipitateMixture("Calcium carbonate precipitate mixture", 40, 0.12),
      },
      createEquipmentInstance("buchner-funnel", "1", "workbench"),
      createEquipmentInstance("filter-paper"),
      createEquipmentInstance("side-arm-filter-flask"),
      {
        ...createEquipmentInstance("wash-bottle"),
        contents: liquidContent("Deionized water", 500),
      },
    ],
  },
  actions: filtrationTechnique.actions
    .filter((actionDefinition) => actionDefinition.id !== "assemble-funnel-stand")
    .map((actionDefinition) => {
      if (actionDefinition.id === "place-filter-paper") {
        return {
          ...actionDefinition,
          parameters: {
            ...actionDefinition.parameters,
            targetDefinitionId: "buchner-funnel",
          },
          interaction: actionDefinition.interaction
            ? {
                ...actionDefinition.interaction,
                targetDefinitionId: "buchner-funnel",
                snapZoneId: "buchner-funnel-paper-seat",
              }
            : actionDefinition.interaction,
        };
      }
      if (actionDefinition.id === "place-filtration-receiver") {
        return {
          ...actionDefinition,
          parameters: {
            ...actionDefinition.parameters,
            equipmentDefinitionId: "side-arm-filter-flask",
            targetDefinitionId: "buchner-funnel",
            snapZoneId: "buchner-funnel-receiver-neck",
          },
          interaction: actionDefinition.interaction
            ? {
                ...actionDefinition.interaction,
                sourceDefinitionId: "side-arm-filter-flask",
                targetDefinitionId: "buchner-funnel",
                snapZoneId: "buchner-funnel-receiver-neck",
              }
            : actionDefinition.interaction,
        };
      }
      if (actionDefinition.id === "filter-mixture") {
        return {
          ...actionDefinition,
          parameters: {
            ...actionDefinition.parameters,
            targetDefinitionId: "buchner-funnel",
          },
          interaction: actionDefinition.interaction
            ? {
                ...actionDefinition.interaction,
                targetDefinitionId: "buchner-funnel",
              }
            : actionDefinition.interaction,
        };
      }
      return actionDefinition;
    }),
  process: {
    startNodeId: "place-filter-node",
    nodes: filtrationTechnique.process.nodes.filter((node) => node.id !== "assemble-funnel-stand-node"),
    edges: [
      { from: "place-filter-node", to: "wet-filter-node", label: "Next", condition: { type: "validationPassed" } },
      { from: "wet-filter-node", to: "place-receiver-node", label: "Next", condition: { type: "validationPassed" } },
      { from: "place-receiver-node", to: "filter-mixture-node", label: "Next", condition: { type: "validationPassed" } },
      { from: "filter-mixture-node", to: "rinse-precipitate-node", label: "Next", condition: { type: "validationPassed" } },
    ],
  },
};

const loadPaperChromatographyTechnique = async (): Promise<TechniqueDefinition> => {
  const input = JSON.parse(
    await readFile(join(process.cwd(), "public", "techniques", "paper-chromatography.json"), "utf8"),
  ) as unknown;
  const techniqueValidation = validateTechniqueDefinition(input);
  expect(techniqueValidation.ok).toBe(true);
  if (!techniqueValidation.ok || !techniqueValidation.value) {
    throw new Error(techniqueValidation.errors.join("\n"));
  }
  return techniqueValidation.value;
};

const loadAcidBaseTitrationLab = async (): Promise<LabDefinition> => {
  const input = JSON.parse(
    await readFile(join(process.cwd(), "public", "labs", "acid-base-titration.json"), "utf8"),
  ) as unknown as LabCompositionSourceDefinition;
  const source = validateLabCompositionSource(input);
  expect(source.ok).toBe(true);
  if (!source.ok || !source.value) throw new Error(source.errors.join("\n"));

  const techniqueInput = JSON.parse(
    await readFile(join(process.cwd(), "public", "techniques", "titration-endpoint.json"), "utf8"),
  ) as unknown;
  const techniqueValidation = validateTechniqueDefinition(techniqueInput);
  expect(techniqueValidation.ok).toBe(true);
  if (!techniqueValidation.ok || !techniqueValidation.value) {
    throw new Error(techniqueValidation.errors.join("\n"));
  }
  const technique = techniqueValidation.value;
  return compileLabComposition(source.value, async (techniqueId) => {
    if (technique.id !== techniqueId) {
      throw new Error(`Technique resolver returned ${technique.id} for ${techniqueId}.`);
    }
    return technique;
  });
};

/**
 * The chromatography lab as a learner receives it: teacher setup applied, then compiled.
 *
 * The technique's own JSON carries `{{config.*}}` templates, so the raw file is not a runnable
 * artifact — only a configured compilation resolves them. The setup values below are a named test
 * input, not a classroom dataset and not a published default.
 */
const compileConfiguredChromatographyLab = async (): Promise<LabDefinition> => {
  const input = JSON.parse(
    await readFile(join(process.cwd(), "public", "labs", "paper-chromatography.json"), "utf8"),
  ) as unknown;
  const source = validateLabCompositionSource(input);
  expect(source.ok).toBe(true);
  if (!source.ok || !source.value) throw new Error(source.errors.join("\n"));
  const configured = applyLabSetup(source.value, {
    trials: [{ solvent: "water" }, { solvent: "propanol" }],
    baselineHeightMm: 15,
    solventDepthMm: 5,
    spotVolumeMl: 0.01,
    solventVolumeMl: 10,
    spotterLoadVolumeMl: 0.1,
    paperLengthMm: 120,
    stopFrontMm: 80,
  });
  const technique = await loadPaperChromatographyTechnique();
  return compileLabComposition(configured, async (techniqueId) => {
    if (technique.id !== techniqueId) {
      throw new Error(`Technique resolver returned ${technique.id} for ${techniqueId}.`);
    }
    return technique;
  });
};

const loadApChemChromatographyLab = async (): Promise<LabDefinition> => {
  const input = JSON.parse(
    await readFile(join(process.cwd(), "public", "labs", "paper-chromatography.json"), "utf8"),
  ) as unknown;
  const validation = validateLabDefinition(input);
  expect(validation.ok).toBe(true);
  if (!validation.ok || !validation.value) {
    throw new Error(validation.errors.join("\n"));
  }
  return validation.value;
};

describe("runtime reducer", () => {
  it("runs a minimal weighing technique and records notebook evidence", () => {
    const state = completeTechnique(weighingTechnique, { "weigh-solid": 2.5 });
    expect(state.completedNodes).toHaveLength(weighingTechnique.process.nodes.length);
    expect(state.measurements.some((measurement) => measurement.id === "solid-mass")).toBe(true);
    expect(state.notebook.some((entry) => entry.tags.includes("solid-mass"))).toBe(true);
  });

  it("rejects wrong order without corrupting runtime state", () => {
    const state = createRuntimeState(weighingTechnique);
    const next = performRuntimeAction(weighingTechnique, state, {
      actionId: "weigh-solid",
      verb: "weigh",
    });
    expect(next.currentNodeId).toBe(state.currentNodeId);
    expect(next.completedNodes).toHaveLength(0);
    expect(next.feedbackQueue.at(-1)?.severity).toBe("error");
  });

  it("completes ungated techniques and preserves current configuration gates", () => {
    for (const technique of [
      transferTechnique,
      solutionTechnique,
      dilutionTechnique,
      filtrationTechnique,
      dryingTechnique,
      calculationTechnique,
    ]) {
      const state = completeTechnique(
        technique,
        technique === dryingTechnique ? { "weigh-dry-precipitate": 0.0075 } : {},
      );
      expect(state.completedNodes).toHaveLength(technique.process.nodes.length);
    }

    const transmittance = runUntilStalled(transmittanceDilutionTechnique);
    expect(transmittance.completedNodes).toEqual(
      transmittanceDilutionTechnique.process.nodes.slice(0, 2).map((node) => node.id),
    );
    expect(transmittance.currentNodeId).toBe("transmittance-dilution-measure-stock-dye-node");
    expect(transmittance.attemptHistory.at(-1)).toMatchObject({
      actionId: "transmittance-dilution-measure-stock-dye",
      success: false,
    });
    expect(transmittance.feedbackQueue.at(-1)?.message).toMatch(/configuration|required|stock-dye aliquot/i);

    const thermal = runUntilStalled(thermalDecompositionTechnique);
    expect(thermal.completedNodes).toHaveLength(0);
    expect(thermal.currentNodeId).toBe("approve-thermal-decomposition-plan-node");
    expect(thermal.attemptHistory.at(-1)).toMatchObject({
      actionId: "approve-thermal-decomposition-plan",
      success: false,
    });
    expect(thermal.feedbackQueue.at(-1)?.message).toMatch(/configuration|approved|required/i);
  });

  it("measures 20 mL from a sample bottle into the graduated cylinder", () => {
    const measureAction = measuringVolumeTechnique.actions.find((action) => action.id === "measure-20ml");
    expect(measureAction?.parameters.sourceDefinitionId).toBe("sample-bottle");
    expect(measureAction?.interaction?.sourceDefinitionId).toBe("sample-bottle");
    expect(measureAction?.parameters.sourceDefinitionId).not.toBe("sample-rack");

    const placed = performRuntimeAction(measuringVolumeTechnique, createRuntimeState(measuringVolumeTechnique), {
      actionId: "place-cylinder",
      verb: "place",
    });
    const measured = performRuntimeAction(measuringVolumeTechnique, placed, {
      actionId: "measure-20ml",
      verb: "measureVolume",
      sourceInstanceId: "sample-bottle-1",
      targetInstanceId: "graduated-cylinder-1",
    });

    expect(measured.contents["graduated-cylinder-1"]).toMatchObject({
      label: "Hard water sample",
      volumeMl: 20,
      visualState: "clear-liquid",
    });
    expect(measured.contents["sample-bottle-1"]).toMatchObject({
      label: "Hard water sample",
      volumeMl: 100,
    });
    expect(measured.measurements.find((measurement) => measurement.id === "sample-volume")?.value)
      .toBe(20);
  });

  it("transfers the measured cylinder contents into the beaker", () => {
    const placed = performRuntimeAction(transferTechnique, createRuntimeState(transferTechnique), {
      actionId: "place-beaker",
      verb: "place",
    });
    const transferred = performRuntimeAction(transferTechnique, placed, {
      actionId: "transfer-sample",
      verb: "transfer",
      sourceInstanceId: "graduated-cylinder-1",
      targetInstanceId: "beaker-250ml-1",
    });

    expect(transferred.contents["graduated-cylinder-1"]).toMatchObject({
      kind: "empty",
      visualState: "empty",
    });
    expect(transferred.contents["graduated-cylinder-1"].volumeMl).toBeUndefined();
    expect(transferred.contents["beaker-250ml-1"]).toMatchObject({
      label: "Measured water sample",
      volumeMl: 20,
    });
  });

  it("rejects generic liquid transfer into the funnel stand", () => {
    const placed = performRuntimeAction(transferTechnique, createRuntimeState(transferTechnique), {
      actionId: "place-beaker",
      verb: "place",
    });
    const funnel = createEquipmentInstance("funnel-stand");
    const equipmentInstances = [...placed.equipmentInstances, funnel];
    const withFunnel = {
      ...placed,
      equipmentInstances,
      contents: Object.fromEntries(equipmentInstances.map((instance) => [instance.id, instance.contents])),
    };

    const rejected = performRuntimeAction(transferTechnique, withFunnel, {
      actionId: "transfer-sample",
      verb: "transfer",
      sourceInstanceId: "graduated-cylinder-1",
      targetInstanceId: "funnel-stand-1",
    });

    expect(rejected.feedbackQueue.at(-1)?.message).toContain("funnel cannot hold");
    expect(rejected.contents["funnel-stand-1"].kind).toBe("empty");
    expect(rejected.contents["graduated-cylinder-1"].volumeMl).toBe(20);
  });

  it("dilutes the volumetric flask to the final rendered volume", () => {
    let state = createRuntimeState(dilutionTechnique);
    state = performRuntimeAction(dilutionTechnique, state, {
      actionId: "transfer-aliquot",
      verb: "transfer",
      sourceInstanceId: "graduated-cylinder-1",
      targetInstanceId: "volumetric-flask-1",
    });
    state = performRuntimeAction(dilutionTechnique, state, {
      actionId: "dilute-to-mark",
      verb: "dilute",
      sourceInstanceId: "wash-bottle-1",
      targetInstanceId: "volumetric-flask-1",
    });

    expect(state.contents["volumetric-flask-1"]).toMatchObject({
      kind: "solution",
      volumeMl: 100,
      finalVolumeMl: 100,
      visualState: "clear-solution",
    });
  });

  it("records the shipped opt-in dilution final-volume evidence after conserving added diluent", () => {
    const configured = applyTechniqueConfiguration(transmittanceDilutionTechnique, {
      stockConcentrationM: "0.25",
      wavelengthNm: "600",
    });
    const finalVolumeAction = configured.actions.find(
      (candidate) => candidate.id === "transmittance-dilution-add-water-below-mark",
    );
    if (!finalVolumeAction || finalVolumeAction.volume?.source !== "action-input") {
      throw new Error("Missing shipped transmittance final-volume action contract.");
    }
    const finalVolumeMeasurementId = finalVolumeAction.volume.outputMeasurementId;
    let state = createRuntimeState(configured);
    state = performRuntimeAction(configured, state, {
      actionId: "transmittance-dilution-record-stock-concentration",
      verb: "observe",
    });
    state = performRuntimeAction(configured, state, {
      actionId: "transmittance-dilution-place-volumetric-flask",
      verb: "place",
    });
    state = performRuntimeAction(configured, state, {
      actionId: "transmittance-dilution-place-graduated-cylinder",
      verb: "place",
    });
    state = performRuntimeAction(configured, state, {
      actionId: "transmittance-dilution-measure-stock-dye",
      verb: "measureVolume",
      value: 5,
    });
    state = performRuntimeAction(configured, state, {
      actionId: "transmittance-dilution-transfer-dye-aliquot",
      verb: "transfer",
    });
    state = performRuntimeAction(configured, state, {
      actionId: "transmittance-dilution-measure-water-volume",
      verb: "measureVolume",
      value: 5,
    });
    state = performRuntimeAction(configured, state, {
      actionId: finalVolumeAction.id,
      verb: finalVolumeAction.verb,
      value: 10,
    });

    expect(state.contents["prepared-receiver-1"]).toMatchObject({ volumeMl: 10, finalVolumeMl: 10 });
    expect(state.contents["graduated-cylinder-1"]).toMatchObject({ kind: "empty", volumeMl: undefined });
    expect(state.measurements).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: finalVolumeMeasurementId,
        value: 10,
        unit: "mL",
        equipmentInstanceId: "prepared-receiver-1",
        nodeId: "transmittance-dilution-add-water-below-mark-node",
      }),
    ]));
  });

  it("records the configured stock concentration through the optional teacher-input path", () => {
    const configured = applyTechniqueConfiguration(transmittanceDilutionTechnique, {
      stockConcentrationM: "0.25",
      wavelengthNm: "600",
    });
    const action = configured.actions.find(
      (candidate) => candidate.id === "transmittance-dilution-record-stock-concentration",
    );
    if (!action) throw new Error("Missing stock concentration acquisition action.");

    const state = performRuntimeAction(configured, createRuntimeState(configured), {
      actionId: action.id,
      verb: action.verb,
    });

    expect(state.measurements).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: action.parameters.measurementId,
        value: 0.25,
        unit: "M",
      }),
    ]));
  });

  it("calculates spectrophotometry formulas and preserves the current dilution input gate", () => {
    expect(calculateDilutedConcentration(10, 8, 10)).toBe(8);
    expect(calculateDilutedConcentration(10, 0, 10)).toBe(0);
    expect(calculateDecimalTransmittance(42)).toBe(0.42);
    expect(calculateAbsorbanceFromPercentT(42)).toBe(0.3768);

    const state = runUntilStalled(transmittanceDilutionTechnique);
    expect(state.currentNodeId).toBe("transmittance-dilution-record-stock-concentration-node");
    expect(state.attemptHistory.at(-1)).toMatchObject({
      actionId: "transmittance-dilution-record-stock-concentration",
      success: false,
    });
    expect(state.measurements).toEqual([]);
    expect(state.calculations).toEqual([]);
  });

  it("derives both photometric results from explicit percent-transmittance evidence", () => {
    const decimalActionId = "transmittance-dilution-calculate-decimal-transmittance";
    const absorbanceActionId = "transmittance-dilution-calculate-absorbance";
    const decimal = performRuntimeAction(
      transmittanceDilutionTechnique,
      stateAtCalculation(transmittanceDilutionTechnique, decimalActionId, { value: 42, unit: "%T" }),
      { actionId: decimalActionId, verb: "calculate" },
    );
    const absorbance = performRuntimeAction(
      transmittanceDilutionTechnique,
      stateAtCalculation(transmittanceDilutionTechnique, absorbanceActionId, { value: 42, unit: "%T" }),
      { actionId: absorbanceActionId, verb: "calculate" },
    );

    expect(decimal.calculations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "decimal-transmittance",
          value: 0.42,
          unit: "T",
          passed: true,
        }),
      ]),
    );
    expect(absorbance.calculations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "absorbance",
          value: calculateAbsorbanceFromPercentT(42),
          unit: "absorbance",
          passed: true,
        }),
      ]),
    );

    const changedInput = performRuntimeAction(
      transmittanceDilutionTechnique,
      stateAtCalculation(transmittanceDilutionTechnique, decimalActionId, { value: 50, unit: "%T" }),
      { actionId: decimalActionId, verb: "calculate" },
    );
    expect(changedInput.calculations.find((calculation) => calculation.id === "decimal-transmittance")?.value)
      .toBe(0.5);
  });

  it("records the current paper trial and stops at its approved-procedure gate", async () => {
    expect(calculateChromatographyRf(64, 80)).toBe(0.8);

    const technique = await loadPaperChromatographyTechnique();
    let state = performRuntimeAction(technique, createRuntimeState(technique), {
      actionId: "label-water-trial",
      verb: "observe",
    });
    expect(state.completedNodes).toContain("label-water-trial-node");
    expect(state.notebook.some((entry) => entry.tags.includes("water-trial-labeled"))).toBe(true);

    const blocked = performRuntimeAction(technique, state, {
      actionId: "place-water-chamber",
      verb: "place",
      sourceInstanceId: "water-chamber",
    });
    expect(blocked.currentNodeId).toBe("place-water-chamber-node");
    expect(blocked.attemptHistory.at(-1)).toMatchObject({
      actionId: "place-water-chamber",
      success: false,
    });
    expect(blocked.feedbackQueue.at(-1)?.message).toMatch(/procedure.*approved|approved.*procedure/i);

    const drying = technique.actions.find((action) => action.id === "dry-water-chromatogram");
    // Investigation 5 prescribes no post-development drying method -- no method, duration, device or
    // ventilation requirement appears in the chapter -- so this step carries no approval field to
    // authenticate. What it does carry is the trial-specific evidence its own measurements consume.
    expect(drying?.parameters.tag).toBe("water-chromatogram-dry");
    expect(drying?.parameters.configurationRequired).toBeUndefined();
    expect(drying?.parameters.unlocked).toBeUndefined();
    expect(drying?.parameters.inputRole).toBeUndefined();
    expect(drying?.parameters.inputKey).toBeUndefined();
    expect(drying?.parameters.sourceAuthorityStatus).toBeUndefined();
    expect(drying?.invalidCases.map((entry) => entry.id)).not.toContain(
      "missing-post-development-drying-method-approval",
    );
  });

  it("runs the authored chromatography inquiry until its learner hypothesis gate", async () => {
    const lab = await loadApChemChromatographyLab();
    let state = createRuntimeState(lab);
    for (const [actionId, verb] of [
      ["review-challenge-safety", "observe"],
      ["review-molecular-structures", "observe"],
    ] as const) {
      state = performRuntimeAction(lab, state, { actionId, verb });
    }

    expect(state.completedNodes).toEqual([
      "review-challenge-safety-node",
      "review-molecular-structures-node",
    ]);
    expect(state.notebook.map((entry) => entry.tags).flat()).toEqual(
      expect.arrayContaining(["chromatography-safety", "structure-evidence"]),
    );

    const hypothesis = performRuntimeAction(lab, state, {
      actionId: "record-imf-hypothesis",
      verb: "observe",
    });
    expect(hypothesis.currentNodeId).toBe("record-imf-hypothesis-node");
    expect(hypothesis.attemptHistory.at(-1)).toMatchObject({
      actionId: "record-imf-hypothesis",
      success: false,
    });
    expect(hypothesis.feedbackQueue.at(-1)?.message).toMatch(/required|hypothesis/i);
  });

  it("refuses the paper drying step on its physical evidence, not on a teacher configuration", async () => {
    const technique = await loadPaperChromatographyTechnique();
    const initial = createRuntimeState(technique);

    // Unit fixture: the drying node is entered directly so the drying gate can be exercised on its
    // own. Nothing is marked complete and no success evidence is seeded, so the two failure cases
    // below are the whole point -- entering the node buys no progress it has not earned.
    const drying = performRuntimeAction(technique, {
      ...initial,
      currentNodeId: "dry-water-chromatogram-node",
    }, {
      actionId: "dry-water-chromatogram",
      verb: "observe",
    });
    expect(drying.currentNodeId).toBe("dry-water-chromatogram-node");
    expect(drying.attemptHistory.at(-1)).toMatchObject({
      actionId: "dry-water-chromatogram",
      success: false,
      message: "Prerequisite missing.",
    });
    expect(drying.feedbackQueue.at(-1)?.message).toMatch(/solvent front/i);
    expect(drying.feedbackQueue.at(-1)?.message).not.toMatch(/teacher|configuration/i);
    expect(drying.completedNodes).not.toContain("dry-water-chromatogram-node");

    // The notebook prerequisite is evidence bookkeeping, not physics. Satisfying it while the strip
    // is still undeveloped must still be refused by the chromatography handler, or the repair would
    // have traded one unsatisfiable gate for no gate at all.
    const frontMarkedOnly = performRuntimeAction(technique, {
      ...initial,
      currentNodeId: "dry-water-chromatogram-node",
      notebook: [{
        id: "fixture-front-marked",
        timestamp: "2026-01-01T00:00:00.000Z",
        nodeId: "mark-water-front-node",
        type: "observation" as const,
        label: "Mark distilled water solvent front",
        value: "Front marked in pencil.",
        tags: ["observe", "water-front-marked"],
      }],
    }, {
      actionId: "dry-water-chromatogram",
      verb: "observe",
    });
    expect(frontMarkedOnly.attemptHistory.at(-1)).toMatchObject({
      actionId: "dry-water-chromatogram",
      success: false,
    });
    expect(frontMarkedOnly.feedbackQueue.at(-1)?.message).toMatch(/has not been developed/i);
    expect(frontMarkedOnly.notebook.some((entry) => entry.tags.includes("water-chromatogram-dry"))).toBe(false);
  });

  // The success side of the same gate, and the reason the repair is per trial rather than shared.
  //
  // PREPARED STATE, and what it bypasses: the distilled-water strip is handed to the reducer already
  // developed (`solventFrontMm`) with its front marked, and the `water-front-marked` notebook entry
  // is seeded. That skips the authored route -- procedure approval, chamber placement, spotting,
  // development and front marking -- so this case proves nothing about learner reachability. It is
  // deliberately the narrowest fixture that can show what the drying step *writes*. The physical
  // chain those bypassed steps enforce is covered generically in
  // `src/runtime/__tests__/cycle10Separation.test.ts` (develop refuses a wet spot, the front cannot
  // be marked on a dry strip, drying refuses an unmarked front), and the two refusal cases above
  // cover this technique's own unprepared paths.
  it("writes only this trial's dry evidence and leaves another trial blocked", async () => {
    const technique = await loadPaperChromatographyTechnique();
    const initial = createRuntimeState(technique);
    const developedPaperContents: ContentState = {
      ...(initial.equipmentInstances.find((instance) => instance.id === "water-paper")?.contents ??
        emptyContents()),
      wetState: "wet",
      chromatogram: {
        modelId: "chromatography-water-food-dyes-paper",
        baselineMarked: true,
        spotted: true,
        solventFrontMm: 80,
        solventFrontMarked: true,
        bands: [],
      },
    };
    const prepared = {
      ...initial,
      currentNodeId: "dry-water-chromatogram-node",
      equipmentInstances: initial.equipmentInstances.map((instance) =>
        instance.id === "water-paper" ? { ...instance, contents: developedPaperContents } : instance,
      ),
      contents: { ...initial.contents, "water-paper": developedPaperContents },
      notebook: [{
        id: "fixture-front-marked",
        timestamp: "2026-01-01T00:00:00.000Z",
        nodeId: "mark-water-front-node",
        type: "observation" as const,
        label: "Mark distilled water solvent front",
        value: "Front marked in pencil.",
        tags: ["observe", "water-front-marked"],
      }],
    };

    const dried = performRuntimeAction(technique, prepared, {
      actionId: "dry-water-chromatogram",
      verb: "observe",
    });
    expect(dried.attemptHistory.at(-1)).toMatchObject({
      actionId: "dry-water-chromatogram",
      success: true,
    });
    expect(dried.notebook.some((entry) => entry.tags.includes("water-chromatogram-dry"))).toBe(true);
    expect(dried.notebook.some((entry) => entry.tags.includes("post-development-drying-method-approved")))
      .toBe(false);
    expect(dried.equipmentInstances.find((instance) => instance.id === "water-paper")?.contents.wetState)
      .toBe("dry");

    // The 2-propanol trial reads its own evidence, so drying the water strip must not release it.
    const otherTrial = performRuntimeAction(technique, {
      ...dried,
      currentNodeId: "identify-propanol-bands-node",
    }, {
      actionId: "identify-propanol-bands",
      verb: "observe",
    });
    expect(otherTrial.attemptHistory.at(-1)).toMatchObject({
      actionId: "identify-propanol-bands",
      success: false,
      message: "Prerequisite missing.",
    });
    expect(otherTrial.notebook.some((entry) => entry.tags.includes("propanol-bands-identified"))).toBe(false);
  });

  // Investigation 5, printed page 49, requires the container to be sealed during development. The
  // authored `chamberSealed: true` used to have no reader; this checks that the shipped technique's
  // own develop action now refuses an open chamber and accepts the same state once it is closed.
  //
  // PREPARED STATE, and what it bypasses: the distilled-water strip is handed to the reducer already
  // spotted and dry, and the action is dispatched at its own node. That skips procedure approval,
  // trial labelling, baseline marking, spotting and drying, so this proves nothing about learner
  // reachability of the authored route -- only that the shipped develop action reads the lid.
  it("refuses the shipped development in an open chamber and allows it once sealed", async () => {
    // The compiled lab, not the raw technique: this technique's development reads
    // `{{config.stopCondition}}`, which only a configured compilation resolves. Driving the raw file
    // would refuse on the unresolved template long before reaching the lid and would say nothing
    // about closure.
    const technique = await compileConfiguredChromatographyLab();
    const initial = createRuntimeState(technique);
    const paperContents: ContentState = {
      ...(initial.equipmentInstances.find((instance) => instance.id === "water-paper")?.contents ??
        emptyContents()),
      wetState: "dry",
      chromatogram: {
        modelId: "water-food-dyes-paper",
        baselineMarked: true,
        spotted: true,
        originDistanceMm: 15,
        bands: [],
      },
    };
    const withPaper = (state: RuntimeState, closed: boolean): RuntimeState => ({
      ...state,
      currentNodeId: "develop-water-paper-node",
      equipmentInstances: state.equipmentInstances.map((instance) => {
        if (instance.id === "water-paper") {
          return {
            ...instance,
            location: "snapZone" as const,
            snapZoneId: "chromatography-chamber-paper-slot",
            interactionStatus: "snapped" as const,
            contents: paperContents,
          };
        }
        if (instance.id === "water-chamber") {
          return {
            ...instance,
            contents: {
              ...instance.contents,
              kind: "liquid" as const,
              label: "Distilled water",
              volumeMl: 10,
              ...(closed ? { developingChamberClosed: true } : {}),
            },
          };
        }
        return instance;
      }),
      attachments: [{
        id: "water-chamber:chromatography-chamber-paper-slot:water-paper",
        parentInstanceId: "water-chamber",
        childInstanceId: "water-paper",
        zoneId: "chromatography-chamber-paper-slot",
        relationType: "inserted" as const,
        renderMode: "delegated" as const,
        locked: true,
      }],
    });

    const open = performRuntimeAction(technique, withPaper(initial, false), {
      actionId: "develop-water-paper",
      verb: "developChromatogram",
      sourceInstanceId: "water-paper",
      targetInstanceId: "water-chamber",
    });
    expect(open.attemptHistory.at(-1)).toMatchObject({ actionId: "develop-water-paper", success: false });
    expect(open.feedbackQueue.at(-1)?.message).toMatch(/still open/i);
    expect(open.completedNodes).not.toContain("develop-water-paper-node");
    expect(
      open.equipmentInstances.find((instance) => instance.id === "water-paper")?.contents.chromatogram?.solventFrontMm,
    ).toBeUndefined();
    expect(open.measurements.filter((entry) => entry.id.startsWith("water-"))).toHaveLength(0);

    const sealed = performRuntimeAction(technique, withPaper(initial, true), {
      actionId: "develop-water-paper",
      verb: "developChromatogram",
      sourceInstanceId: "water-paper",
      targetInstanceId: "water-chamber",
    });
    expect(sealed.attemptHistory.at(-1)).toMatchObject({ actionId: "develop-water-paper", success: true });
    const developed = sealed.equipmentInstances.find((instance) => instance.id === "water-paper")?.contents;
    expect(developed?.chromatogram?.solventFrontMm).toBe(80);
    // `recordMeasurementsOnDevelop: false` is preserved: the ruler still has to be read.
    expect(sealed.measurements.filter((entry) => entry.id.startsWith("water-"))).toHaveLength(0);
    expect(developed?.chromatogram?.solventFrontMarked).toBe(false);
    expect(developed?.wetState).toBe("wet");
  });

  it("blocks absorbance calculation until percent transmittance evidence exists", () => {
    const ungated: TechniqueDefinition = {
      ...transmittanceDilutionTechnique,
      actions: transmittanceDilutionTechnique.actions.map((action) =>
        action.id === "transmittance-dilution-calculate-absorbance" ? { ...action, prerequisites: [] } : action,
      ),
    };
    const state = createRuntimeState(ungated);
    const blocked = performRuntimeAction(ungated, {
      ...state,
      currentNodeId: "transmittance-dilution-calculate-absorbance-node",
    }, {
      actionId: "transmittance-dilution-calculate-absorbance",
      verb: "calculate",
    });

    expect(blocked.completedNodes).toHaveLength(0);
    expect(blocked.feedbackQueue.at(-1)?.message).toContain("transmittance evidence");
  });

  it("rejects missing, mislabelled, and out-of-range percent-transmittance evidence", () => {
    const actionIds = [
      "transmittance-dilution-calculate-decimal-transmittance",
      "transmittance-dilution-calculate-absorbance",
    ] as const;
    const cases = [
      undefined,
      { value: 42, unit: "T" },
      { value: 0, unit: "%T" },
      { value: 101, unit: "%T" },
    ] as const;

    for (const actionId of actionIds) {
      for (const evidence of cases) {
        const rejected = performRuntimeAction(
          transmittanceDilutionTechnique,
          stateAtCalculation(transmittanceDilutionTechnique, actionId, evidence),
          { actionId, verb: "calculate" },
        );
        expect(rejected.calculations).toEqual([]);
        expect(rejected.completedNodes).not.toContain(`${actionId}-node`);
        expect(rejected.attemptHistory.at(-1)).toMatchObject({ actionId, success: false });
        expect(rejected.feedbackQueue.at(-1)?.message).toContain("transmittance evidence");
      }
    }
  });

  it("preserves declared photometric operations after Studio prefixes identities", () => {
    const appended = appendTechniqueToDraft(createDraftFromDemo(), transmittanceDilutionTechnique).lab;
    const importedTechnique = appended.techniques.at(-1);
    if (!importedTechnique) throw new Error("Expected the appended transmittance technique.");
    const importedActions = importedTechnique.actions.filter(
      (action) => action.parameters.template === "decimalTransmittance" ||
        action.parameters.template === "absorbanceFromPercentT",
    );
    expect(importedActions).toHaveLength(2);

    for (const action of importedActions) {
      const result = performRuntimeAction(
        appended,
        stateAtCalculation(appended, action.id, { value: 42, unit: "%T" }),
        { actionId: action.id, verb: "calculate" },
      );
      const calculationId = String(action.parameters.calculationId);
      const calculation = result.calculations.find((entry) => entry.id === calculationId);
      expect(calculationId).toMatch(/^transmittance-dilution-1-/);
      expect(calculation).toMatchObject({
        id: calculationId,
        passed: true,
        unit: action.parameters.template === "decimalTransmittance" ? "T" : "absorbance",
      });
      expect(calculation?.value).toBe(
        action.parameters.template === "decimalTransmittance"
          ? 0.42
          : calculateAbsorbanceFromPercentT(42),
      );
    }
  });

  it("does not let a legacy absorbance output label override structured analysis", () => {
    const structuredDefinition: TechniqueDefinition = {
      ...transmittanceDilutionTechnique,
      id: "structured-analysis-transmittance",
      actions: transmittanceDilutionTechnique.actions.map((action) =>
        action.id === "transmittance-dilution-calculate-absorbance"
          ? {
              ...action,
              parameters: {
                ...action.parameters,
                template: undefined,
                calculationId: "absorbance",
                sourceMeasurementId: "analysis-input",
              },
              analysis: {
                type: "unaryEvidenceTransform" as const,
                input: { source: "measurement" as const, referenceId: "analysis-input" },
                operation: "reciprocal" as const,
                outputUnit: "ratio",
                outputCalculationId: "structured-absorbance",
              },
            }
          : action,
      ),
    };
    const appended = appendTechniqueToDraft(createDraftFromDemo(), structuredDefinition).lab;
    const importedTechnique = appended.techniques.at(-1);
    const action = importedTechnique?.actions.find(
      (candidate) => candidate.analysis?.type === "unaryEvidenceTransform",
    );
    if (!action) throw new Error("Expected the structured analysis action.");

    const result = performRuntimeAction(
      appended,
      stateAtCalculation(appended, action.id, { value: 50, unit: "%T" }),
      { actionId: action.id, verb: "calculate" },
    );
    const outputId = String(action.analysis?.outputCalculationId);
    expect(result.calculations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: outputId, value: 0.02, unit: "ratio", passed: true }),
      ]),
    );
    const legacyCalculationId = String(action.parameters.calculationId);
    expect(result.calculations.some((calculation) => calculation.id === legacyCalculationId)).toBe(false);
  });

  it("resets a technique", () => {
    const completed = completeTechnique(weighingTechnique, { "weigh-solid": 2.5 });
    const reset = performRuntimeAction(weighingTechnique, completed, { verb: "reset" });
    expect(reset.completedNodes).toHaveLength(0);
    expect(reset.currentNodeId).toBe(weighingTechnique.process.startNodeId);
  });

  it("blocks actions when configured prerequisites are unmet", () => {
    const gated: TechniqueDefinition = {
      ...weighingTechnique,
      actions: weighingTechnique.actions.map((action, index) =>
        index === 0
          ? {
              ...action,
              prerequisites: [
                {
                  id: "missing-prerequisite",
                  type: "measurementRecorded",
                  label: "A setup measurement is required.",
                  measurementId: "setup-mass",
                },
              ],
            }
          : action,
      ),
    };
    const state = runCurrentAction(gated);
    expect(state.completedNodes).toHaveLength(0);
    expect(state.feedbackQueue.at(-1)?.severity).toBe("error");
    expect(state.feedbackQueue.at(-1)?.message).toContain("setup measurement");
  });

  it("uses retry edges after failed node validation", () => {
    const retrying: TechniqueDefinition = {
      ...weighingTechnique,
      process: {
        ...weighingTechnique.process,
        nodes: weighingTechnique.process.nodes.map((node, index) =>
          index === 0
            ? {
                ...node,
                validation: [
                  {
                    id: "missing-measurement",
                    type: "measurementRecorded",
                    label: "Retry measurement required.",
                    measurementId: "not-yet-recorded",
                  },
                ],
              }
            : node,
        ),
        edges: [
          {
            from: weighingTechnique.process.nodes[0].id,
            to: weighingTechnique.process.nodes[1].id,
            label: "Next",
            condition: { type: "validationPassed" },
          },
          {
            from: weighingTechnique.process.nodes[0].id,
            to: weighingTechnique.process.nodes[0].id,
            label: "Retry",
            condition: { type: "retry" },
          },
        ],
      },
    };
    const state = runCurrentAction(retrying);
    expect(state.currentNodeId).toBe(retrying.process.nodes[0].id);
    expect(state.completedNodes).toHaveLength(0);
    expect(state.feedbackQueue.at(-1)?.severity).toBe("warning");
  });

  it("prevents transfer overflow without mutating source or target contents", () => {
    const state = runCurrentAction(transferTechnique);
    const sourceWithEnoughVolumeInstances = state.equipmentInstances.map((instance) =>
      instance.id === "graduated-cylinder-1"
        ? { ...instance, contents: { ...instance.contents, volumeMl: 300 } }
        : instance,
    );
    const sourceWithEnoughVolume = {
      ...state,
      equipmentInstances: sourceWithEnoughVolumeInstances,
      contents: Object.fromEntries(sourceWithEnoughVolumeInstances.map((instance) => [instance.id, instance.contents])),
    };
    const overflow = performRuntimeAction(transferTechnique, sourceWithEnoughVolume, {
      actionId: "transfer-sample",
      verb: "transfer",
      sourceInstanceId: "graduated-cylinder-1",
      targetInstanceId: "beaker-250ml-1",
      value: 300,
    });
    expect(overflow.feedbackQueue.at(-1)?.message).toContain("overflow");
    expect(overflow.contents["graduated-cylinder-1"].volumeMl).toBe(300);
    expect(overflow.contents["beaker-250ml-1"].kind).toBe("empty");
  });

  it("rejects common invalid hard-water physical states", () => {
    const seatedPaper = performRuntimeAction(filtrationTechnique, assembleFiltrationApparatus(), {
      actionId: "place-filter-paper",
      verb: "place",
    });
    expect(seatedPaper.attachments).toEqual([
      expect.objectContaining({
        parentInstanceId: "funnel-stand-1",
        childInstanceId: "filter-paper-1",
        relationType: "inserted",
        zoneId: "funnel-stand-paper-seat",
      }),
    ]);
    const dryPaperFilter = performRuntimeAction(filtrationTechnique, {
      ...seatedPaper,
      currentNodeId: "filter-mixture-node",
    }, {
      actionId: "filter-mixture",
      verb: "filter",
      sourceInstanceId: "beaker-250ml-1",
      targetInstanceId: "funnel-stand-1",
    });
    expect(dryPaperFilter.feedbackQueue.at(-1)?.message).toContain("wetted");

    const wettedPaper = performRuntimeAction(filtrationTechnique, seatedPaper, {
      actionId: "wet-filter-paper",
      verb: "rinse",
      targetInstanceId: "filter-paper-1",
    });
    const withoutPrecipitateInstances = wettedPaper.equipmentInstances.map((instance) =>
      instance.id === "beaker-250ml-1" ? { ...instance, contents: emptyContents() } : instance,
    );
    const withoutPrecipitate = {
      ...wettedPaper,
      currentNodeId: "filter-mixture-node",
      equipmentInstances: withoutPrecipitateInstances,
      contents: Object.fromEntries(withoutPrecipitateInstances.map((instance) => [instance.id, instance.contents])),
    };
    const noPrecipitateFilter = performRuntimeAction(filtrationTechnique, withoutPrecipitate, {
      actionId: "filter-mixture",
      verb: "filter",
      sourceInstanceId: "beaker-250ml-1",
      targetInstanceId: "funnel-stand-1",
    });
    expect(noPrecipitateFilter.feedbackQueue.at(-1)?.message).toContain("precipitate");

    const noReceiverFilter = performRuntimeAction(filtrationTechnique, {
      ...wettedPaper,
      currentNodeId: "filter-mixture-node",
    }, {
      actionId: "filter-mixture",
      verb: "filter",
      sourceInstanceId: "beaker-250ml-1",
      targetInstanceId: "funnel-stand-1",
    });
    expect(noReceiverFilter.feedbackQueue.at(-1)?.message).toContain("receiving vessel");

    const wrongRinseTarget = performRuntimeAction(filtrationTechnique, {
      ...wettedPaper,
      currentNodeId: "rinse-precipitate-node",
    }, {
      actionId: "rinse-precipitate",
      verb: "rinse",
      targetInstanceId: "filter-paper-1",
    });
    expect(wrongRinseTarget.feedbackQueue.at(-1)?.message).toContain("no collected precipitate");

    const unrinsedDrying: TechniqueDefinition = {
      ...dryingTechnique,
      initialState: {
        equipment: dryingTechnique.initialState.equipment.map((instance) =>
          instance.id === "watch-glass-1" && instance.contents.precipitate
            ? {
                ...instance,
                contents: {
                  ...instance.contents,
                  precipitate: { ...instance.contents.precipitate, rinsed: false },
                },
              }
            : instance,
        ),
      },
    };
    const dryingBeforeRinse = performRuntimeAction(unrinsedDrying, createRuntimeState(unrinsedDrying), {
      actionId: "dry-precipitate",
      verb: "dry",
      sourceInstanceId: "watch-glass-1",
      targetInstanceId: "drying-oven-1",
    });
    expect(dryingBeforeRinse.feedbackQueue.at(-1)?.message).toContain("rinsed");

    const wetWeighing = performRuntimeAction(dryingTechnique, {
      ...createRuntimeState(dryingTechnique),
      currentNodeId: "weigh-dry-node",
    }, {
      actionId: "weigh-dry-precipitate",
      verb: "weigh",
      sourceInstanceId: "watch-glass-1",
      value: 0.0075,
    });
    expect(wetWeighing.feedbackQueue.at(-1)?.message).toContain("still wet");
  });

  it("assembles funnel and ring stand into a hidden source pair and visible composite", () => {
    const assembled = assembleFiltrationApparatus();

    expect(assembled.currentNodeId).toBe("place-filter-node");
    expect(assembled.equipmentInstances.find((instance) => instance.id === "ring-stand-1")).toMatchObject({
      location: "storage",
      snapZoneId: undefined,
    });
    expect(assembled.equipmentInstances.find((instance) => instance.id === "funnel-1")).toMatchObject({
      location: "storage",
      snapZoneId: undefined,
    });
    expect(assembled.equipmentInstances.find((instance) => instance.id === "funnel-stand-1")).toMatchObject({
      definitionId: "funnel-stand",
      location: "workbench",
    });
    expect(assembled.attachments).toEqual([]);
  });

  it("refuses an assembly the composite registry does not declare", () => {
    // Cycle 05 made the registry, not the action's compositeDefinitionId parameter, decide what a
    // seating assembles into. An unregistered pair now fails instead of swapping in whatever the
    // parameter named.
    const unregistered = performRuntimeAction(filtrationTechnique, createRuntimeState(filtrationTechnique), {
      actionId: "assemble-funnel-stand",
      verb: "place",
      sourceInstanceId: "funnel-1",
      targetInstanceId: "ring-stand-1",
      equipmentDefinitionId: "funnel",
      location: "snapZone",
      parameters: {
        snapZoneId: "ring-stand-funnel-seat",
        compositeDefinitionId: "beaker-250ml",
      },
    });

    expect(unregistered.feedbackQueue.at(-1)?.severity).toBe("error");
    expect(unregistered.feedbackQueue.at(-1)?.message).toContain("registered assembly");
    expect(
      unregistered.equipmentInstances.find((instance) => instance.id === "funnel-stand-1")?.location,
    ).not.toBe("workbench");
  });

  it("restores both participants and parks the assembly on a physical reset", () => {
    // The reset behaviour the composite registry declares for funnel-stand-assembly.
    const assembled = assembleFiltrationApparatus();
    const reset = performRuntimeAction(filtrationTechnique, assembled, {
      actionId: "reset-apparatus",
      verb: "reset",
      parameters: { scope: "physical" },
    });
    const fresh = createRuntimeState(filtrationTechnique);
    const locationOf = (state: typeof fresh, id: string) =>
      state.equipmentInstances.find((instance) => instance.id === id)?.location;

    for (const id of ["funnel-1", "ring-stand-1", "funnel-stand-1"]) {
      expect(locationOf(reset, id), id).toBe(locationOf(fresh, id));
    }
    expect(reset.attachments).toEqual([]);
  });

  it("starts the hard-water workflow with empty process containers", () => {
    const state = createRuntimeState(hardWaterDemoLab);

    expect(state.contents["sample-bottle-1"]).toMatchObject({
      kind: "liquid",
      label: "Hard water sample",
      volumeMl: 120,
    });
    expect(state.contents["reagent-bottle-1"]).toMatchObject({
      kind: "liquid",
      label: "Carbonate reagent",
      volumeMl: 20,
    });
    expect(state.contents["beaker-250ml-1"].kind).toBe("empty");
    expect(state.contents["watch-glass-1"].kind).toBe("empty");
  });

  it("uses the measured hard-water sample before precipitation", () => {
    const measured = performRuntimeAction(hardWaterDemoLab, createRuntimeState(hardWaterDemoLab), {
      actionId: "measure-20ml",
      verb: "measureVolume",
      sourceInstanceId: "sample-bottle-1",
      targetInstanceId: "graduated-cylinder-1",
    });
    const recorded = performRuntimeAction(hardWaterDemoLab, measured, {
      actionId: "record-volume",
      verb: "record",
    });
    const prematurePrecipitation = performRuntimeAction(hardWaterDemoLab, {
      ...recorded,
      currentNodeId: "precipitate-node",
    }, {
      actionId: "precipitate-caco3",
      verb: "precipitate",
      sourceInstanceId: "reagent-bottle-1",
      targetInstanceId: "beaker-250ml-1",
    });
    expect(prematurePrecipitation.feedbackQueue.at(-1)?.message).toContain("measured sample");

    const transferred = performRuntimeAction(hardWaterDemoLab, recorded, {
      actionId: "transfer-sample",
      verb: "transfer",
      sourceInstanceId: "graduated-cylinder-1",
      targetInstanceId: "beaker-250ml-1",
    });
    expect(transferred.contents["graduated-cylinder-1"].kind).toBe("empty");
    expect(transferred.contents["beaker-250ml-1"]).toMatchObject({
      kind: "liquid",
      label: "Hard water sample",
      volumeMl: 20,
    });

    const precipitated = performRuntimeAction(hardWaterDemoLab, transferred, {
      actionId: "precipitate-caco3",
      verb: "precipitate",
      sourceInstanceId: "reagent-bottle-1",
      targetInstanceId: "beaker-250ml-1",
    });
    expect(precipitated.contents["beaker-250ml-1"]).toMatchObject({
      kind: "mixture",
      label: "Calcium carbonate precipitate mixture",
      volumeMl: 40,
    });
  });

  it("rejects occupied attachment zones and moves locked children with parents", () => {
    const initial = assembleFiltrationApparatus();
    const seatedPaper = performRuntimeAction(filtrationTechnique, initial, {
      actionId: "place-filter-paper",
      verb: "place",
    });
    const secondPaperInstances = [
      ...seatedPaper.equipmentInstances,
      {
        ...seatedPaper.equipmentInstances.find((instance) => instance.id === "filter-paper-1")!,
        id: "filter-paper-2",
      },
    ];
    const duplicatePaper = {
      ...seatedPaper,
      currentNodeId: "place-filter-node",
      completedNodes: [],
      equipmentInstances: secondPaperInstances,
      contents: Object.fromEntries(secondPaperInstances.map((instance) => [instance.id, instance.contents])),
    };
    const occupied = performRuntimeAction(filtrationTechnique, duplicatePaper, {
      actionId: "place-filter-paper",
      verb: "place",
      sourceInstanceId: "filter-paper-2",
      targetInstanceId: "funnel-stand-1",
      equipmentDefinitionId: "filter-paper",
      location: "snapZone",
      parameters: { snapZoneId: "funnel-stand-paper-seat" },
    });
    expect(occupied.feedbackQueue.at(-1)?.message).toContain("occupied");

    const movedParent = performRuntimeAction(filtrationTechnique, {
      ...seatedPaper,
      equipmentInstances: seatedPaper.equipmentInstances.map((instance) =>
        instance.id === "funnel-stand-1" ? { ...instance, x: 20, y: 20 } : instance,
      ),
    }, {
      verb: "place",
      sourceInstanceId: "funnel-stand-1",
      location: "workbench",
      parameters: { benchMove: true, x: 80, y: 90 },
    });
    const movedPaper = movedParent.equipmentInstances.find((instance) => instance.id === "filter-paper-1");
    expect(movedPaper?.x).toBe(80);
    expect(movedPaper?.y).toBe(90);
  });

  it("sends filtrate to the receiver and filter cake to the paper", () => {
    let state = createRuntimeState(filtrationTechnique);
    for (const [actionId, verb] of [
      ["assemble-funnel-stand", "place"],
      ["place-filter-paper", "place"],
      ["wet-filter-paper", "rinse"],
      ["place-filtration-receiver", "place"],
      ["filter-mixture", "filter"],
    ] as const) {
      state = performRuntimeAction(filtrationTechnique, state, { actionId, verb });
    }

    expect(state.contents["funnel-stand-1"].kind).toBe("empty");
    expect(state.contents["filter-paper-1"]).toMatchObject({
      kind: "precipitate",
      visualState: "filter-cake",
    });
    expect(state.contents["erlenmeyer-flask-250ml-1"]).toMatchObject({
      kind: "liquid",
      label: "Filtrate",
      volumeMl: 40,
    });
    expect(state.contents["erlenmeyer-flask-250ml-1"].solutes).toEqual([]);
    expect(state.contents["beaker-250ml-1"].kind).toBe("empty");
  });

  it("uses Buchner funnel filter-target zones for wetting and filtration", () => {
    let state = createRuntimeState(buchnerFiltrationTechnique);
    for (const [actionId, verb] of [
      ["place-filter-paper", "place"],
      ["wet-filter-paper", "rinse"],
      ["place-filtration-receiver", "place"],
      ["filter-mixture", "filter"],
    ] as const) {
      state = performRuntimeAction(buchnerFiltrationTechnique, state, { actionId, verb });
    }

    expect(state.attachments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parentInstanceId: "buchner-funnel-1",
          childInstanceId: "filter-paper-1",
          relationType: "inserted",
          zoneId: "buchner-funnel-paper-seat",
        }),
        expect.objectContaining({
          parentInstanceId: "buchner-funnel-1",
          childInstanceId: "side-arm-filter-flask-1",
          relationType: "receiving",
          zoneId: "buchner-funnel-receiver-neck",
        }),
      ]),
    );
    expect(state.contents["filter-paper-1"]).toMatchObject({
      kind: "precipitate",
      visualState: "filter-cake",
    });
    expect(state.contents["side-arm-filter-flask-1"]).toMatchObject({
      kind: "liquid",
      label: "Filtrate",
      volumeMl: 40,
    });
    expect(state.contents["beaker-250ml-1"].kind).toBe("empty");
  });

  it("decrements the visible wash bottle during rinse actions", () => {
    let state = createRuntimeState(filtrationTechnique);
    state = performRuntimeAction(filtrationTechnique, state, {
      actionId: "assemble-funnel-stand",
      verb: "place",
    });
    state = performRuntimeAction(filtrationTechnique, state, {
      actionId: "place-filter-paper",
      verb: "place",
    });
    state = performRuntimeAction(filtrationTechnique, state, {
      actionId: "wet-filter-paper",
      verb: "rinse",
      sourceInstanceId: "wash-bottle-1",
      targetInstanceId: "filter-paper-1",
    });

    expect(state.contents["wash-bottle-1"].volumeMl).toBe(495);

    for (const [actionId, verb] of [
      ["place-filtration-receiver", "place"],
      ["filter-mixture", "filter"],
      ["rinse-precipitate", "rinse"],
    ] as const) {
      state = performRuntimeAction(filtrationTechnique, state, {
        actionId,
        verb,
        sourceInstanceId: actionId === "rinse-precipitate" ? "wash-bottle-1" : undefined,
        targetInstanceId: actionId === "rinse-precipitate" ? "filter-paper-1" : undefined,
      });
    }

    expect(state.contents["wash-bottle-1"].volumeMl).toBe(490);
    expect(state.contents["filter-paper-1"].visualState).toBe("rinsed-precipitate");
  });

  it("resolves simple calculation result branches", () => {
    const branched: LabDefinition = {
      ...hardWaterDemoLab,
      process: {
        ...hardWaterDemoLab.process,
        nodes: [
          ...hardWaterDemoLab.process.nodes,
          {
            id: "branch-pass",
            type: "teacherNote",
            title: "Expected range",
            description: "Calculation was in expected range.",
            config: {},
            validation: [],
            hints: [],
            feedback: { success: "In range.", retry: "Review result." },
          },
        ],
        edges: [
          ...hardWaterDemoLab.process.edges.filter((edge) => edge.from !== "calculate-node"),
          {
            from: "calculate-node",
            to: "branch-pass",
            label: "Expected",
            condition: {
              type: "calculationResult",
              calculationId: "hardness-mg-l",
              min: 300,
              max: 400,
            },
          },
        ],
      },
    };
    let state = createRuntimeState(branched);
    for (let index = 0; index < hardWaterDemoLab.process.nodes.length; index += 1) {
      const current = getProcess(branched).nodes.find((node) => node.id === state.currentNodeId);
      const action = getActions(branched).find((candidate) => candidate.id === current?.actionId);
      if (!action) throw new Error("Missing action for current branch node.");
      state = performRuntimeAction(branched, state, {
        actionId: action.id,
        verb: action.verb,
        ...(action.id === "weigh-dry-precipitate" ? { value: 0.0075 } : {}),
      });
    }
    expect(state.currentNodeId).toBe("branch-pass");
  });

  it("matches hard-water reference regression values for 20 mL samples", () => {
    for (const sample of hardWaterSamples) {
      expect(calculateHardnessMgLAsCaCO3(sample.precipitateMassG, 20)).toBe(sample.hardnessMgL);
    }
  });

  it("calculates hard-water hardness from recorded evidence instead of action constants", () => {
    let state = createRuntimeState(hardWaterDemoLab);
    const process = getProcess(hardWaterDemoLab);
    const actions = getActions(hardWaterDemoLab);
    for (
      let transitionCount = 0;
      state.currentNodeId !== "calculate-node" && transitionCount < process.nodes.length;
      transitionCount += 1
    ) {
      const current = process.nodes.find((node) => node.id === state.currentNodeId);
      const action = actions.find((candidate) => candidate.id === current?.actionId);
      if (!action) throw new Error(`Missing action before calculation node at ${state.currentNodeId}.`);
      const input = action.id === "weigh-dry-precipitate"
        ? { value: 0.0075, unit: "g" }
        : {};
      const next = performRuntimeAction(hardWaterDemoLab, state, {
        actionId: action.id,
        verb: action.verb,
        ...input,
      });
      const diagnostic = JSON.stringify({
        currentNodeId: state.currentNodeId,
        actionId: action.id,
        attempt: next.attemptHistory.at(-1),
        feedback: next.feedbackQueue.at(-1),
        nextNodeId: next.currentNodeId,
      });
      expect(next.attemptHistory.at(-1)?.success, diagnostic).toBe(true);
      expect(next.currentNodeId, diagnostic).not.toBe(state.currentNodeId);
      state = next;
    }
    expect(state.currentNodeId).toBe("calculate-node");
    const alteredEvidence = {
      ...state,
      measurements: state.measurements.map((measurement) =>
        measurement.id === "dry-precipitate-mass"
          ? { ...measurement, value: 0.009 }
          : measurement,
      ),
    };
    const calculated = performRuntimeAction(hardWaterDemoLab, alteredEvidence, {
      actionId: "calculate-hardness",
      verb: "calculate",
    });
    expect(calculated.calculations.find((calculation) => calculation.id === "hardness-mg-l")?.value)
      .toBe(450);
  });

  it("holds a subsequent thermal mass reading at its authored cooling prerequisite", () => {
    const state = thermalStateAt("weigh-final-crucible-node", thermalResidue(650));
    const attempt = performRuntimeAction(thermalDecompositionTechnique, state, {
      actionId: "weigh-final-crucible",
      verb: "weigh",
      sourceInstanceId: "crucible-with-lid-1",
      value: 0.5,
    });

    expect(attempt.currentNodeId).toBe("weigh-final-crucible-node");
    expect(attempt.feedbackQueue.at(-1)?.message).toMatch(/Move with tongs and cool after repeat heating/i);
    expect(attempt.attemptHistory.at(-1)).toMatchObject({
      actionId: "weigh-final-crucible",
      success: false,
    });
    expect(attempt.measurements).toEqual([]);
  });

  it("holds the current thermal cooling step at its burner-shutdown prerequisite", () => {
    const rejected = performRuntimeAction(thermalDecompositionTechnique, thermalStateAt(
      "cool-crucible-node",
      thermalResidue(650),
    ), {
      actionId: "cool-crucible",
      verb: "cool",
      sourceInstanceId: "crucible-with-lid-1",
      targetInstanceId: "crucible-tongs-1",
    });

    expect(rejected.currentNodeId).toBe("cool-crucible-node");
    expect(rejected.attemptHistory.at(-1)).toMatchObject({
      actionId: "cool-crucible",
      success: false,
    });
    expect(rejected.feedbackQueue.at(-1)?.message).toMatch(/Turn off the burner before moving/i);
  });

  it("holds the current thermal heating action at its authored warm-up prerequisite", () => {
    const rejected = performRuntimeAction(
      thermalDecompositionTechnique,
      thermalStateAt("heat-carbonate-mixture-node", thermalResidue(25)),
      {
        actionId: "heat-carbonate-mixture",
        verb: "dry",
        sourceInstanceId: "crucible-with-lid-1",
        targetInstanceId: "bunsen-burner-1",
      },
    );

    expect(rejected.currentNodeId).toBe("heat-carbonate-mixture-node");
    expect(rejected.attemptHistory.at(-1)).toMatchObject({
      actionId: "heat-carbonate-mixture",
      success: false,
    });
    expect(rejected.feedbackQueue.at(-1)?.message).toMatch(/Warm the covered mixture gently is complete/i);
  });

  it("calculates carbonate composition from explicit synthetic mass evidence", () => {
    // The published action deliberately has no sample-mass answer key. Add only the required
    // synthetic configuration slot so the reducer calculation path can be exercised honestly.
    const configured: TechniqueDefinition = {
      ...thermalDecompositionTechnique,
      actions: thermalDecompositionTechnique.actions.map((action) =>
        action.id === "calculate-carbonate-composition"
          ? {
              ...action,
              prerequisites: [],
              parameters: { ...action.parameters, sampleMassG: 1.5 },
            }
          : action,
      ),
    };
    const evidence = {
      ...createRuntimeState(configured),
      currentNodeId: "calculate-carbonate-composition-node",
      measurements: [
        {
          id: "loaded-crucible-mass",
          label: "Loaded crucible mass",
          value: 24.5,
          unit: "g",
          nodeId: "synthetic-evidence",
        },
        {
          id: "final-cooled-crucible-mass",
          label: "Final cooled crucible mass",
          value: 24.1899,
          unit: "g",
          nodeId: "synthetic-evidence",
        },
      ],
    };
    const calculated = performRuntimeAction(configured, evidence, {
      actionId: "calculate-carbonate-composition",
      verb: "calculate",
      value: 0.3101,
    });
    expect(calculated.calculations.find((calculation) => calculation.id === "composition-analysis"))
      .toMatchObject({ value: 0.3101, unit: "g", passed: true });
    expect(calculated.calculations.find((calculation) => calculation.id === "composition-analysis-nahco3-percent"))
      .toMatchObject({ value: 56, unit: "%", passed: true });
    expect(calculated.notebook.some((entry) => entry.tags.includes("composition-analysis"))).toBe(true);

    const alteredEvidence = {
      ...evidence,
      measurements: evidence.measurements.map((measurement) =>
        measurement.id === "final-cooled-crucible-mass" ? { ...measurement, value: 24.2 } : measurement,
      ),
    };
    const recalculated = performRuntimeAction(configured, alteredEvidence, {
      actionId: "calculate-carbonate-composition",
      verb: "calculate",
      value: 0.3,
    });
    expect(recalculated.calculations.find((calculation) => calculation.id === "composition-analysis")?.value)
      .toBe(0.3);
  });

  it("rejects synthetic carbonate composition evidence that exceeds its configured sample mass", () => {
    const configured: TechniqueDefinition = {
      ...thermalDecompositionTechnique,
      actions: thermalDecompositionTechnique.actions.map((action) =>
        action.id === "calculate-carbonate-composition"
          ? {
              ...action,
              prerequisites: [],
              parameters: { ...action.parameters, sampleMassG: 0.5 },
            }
          : action,
      ),
    };
    const impossibleEvidence = {
      ...createRuntimeState(configured),
      currentNodeId: "calculate-carbonate-composition-node",
      measurements: [
        {
          id: "loaded-crucible-mass",
          label: "Loaded crucible mass",
          value: 24.5,
          unit: "g",
          nodeId: "synthetic-evidence",
        },
        {
          id: "final-cooled-crucible-mass",
          label: "Final cooled crucible mass",
          value: 23.8,
          unit: "g",
          nodeId: "synthetic-evidence",
        },
      ],
    };

    const rejected = performRuntimeAction(configured, impossibleEvidence, {
      actionId: "calculate-carbonate-composition",
      verb: "calculate",
      value: 0.7,
    });

    expect(rejected.feedbackQueue.at(-1)?.message).toContain("exceeds the amount possible");
    expect(rejected.calculations.find((calculation) => calculation.id === "composition-analysis")).toBeUndefined();
  });

  it("initializes the hard-water demo as a general schema-authored lab", () => {
    const state = completeDefinition(hardWaterDemoLab, { "weigh-dry-precipitate": 0.0075 });
    expect(state.completedNodes).toHaveLength(hardWaterDemoLab.process.nodes.length);
    expect(state.calculations.find((calculation) => calculation.id === "hardness-mg-l")?.value).toBe(375);
    expect(hardWaterDemoLab.metadata.tags).toContain("hard-water-reference");
  });

  it("runs the intro filtration demo through the realistic setup sequence", () => {
    const state = completeDefinition(demoLab);
    expect(state.completedNodes).toHaveLength(demoLab.process.nodes.length);
    expect(state.contents["filter-paper-1"]).toMatchObject({
      kind: "precipitate",
      visualState: "rinsed-precipitate",
    });
    expect(state.contents["erlenmeyer-flask-250ml-1"]).toMatchObject({
      kind: "liquid",
      label: "Filtrate",
      volumeMl: 40,
    });
  });

  it("loads the public acid-base composition and preserves its current delivery contract", async () => {
    const lab = await loadAcidBaseTitrationLab();
    const deliveryAction = getActions(lab).find((candidate) => candidate.id === "deliver-titrant");
    expect(deliveryAction?.parameters).toMatchObject({
      titrationModelId: "unknown-acid-naoh",
      inputMode: "numeric",
      inputRole: "studentResponse",
      inputMinExclusive: true,
      maximumIncrementMl: 1,
      endpointWindowMl: 0.05,
    });
    expect(deliveryAction?.interaction?.type).toBe("recordNotebook");

    const initial = createRuntimeState(lab);
    const approval = performRuntimeAction(lab, initial, {
      actionId: "approve-reference-configuration",
      verb: "observe",
    });
    expect(approval.currentNodeId).toBe("approve-reference-configuration-node");
    expect(approval.attemptHistory.at(-1)).toMatchObject({
      actionId: "approve-reference-configuration",
      success: false,
    });
    expect(approval.feedbackQueue.at(-1)?.message).toMatch(/teacher configuration|required|approval/i);

    const deliveryAttempt = performRuntimeAction(lab, {
      ...initial,
      currentNodeId: "deliver-titrant-node",
    }, {
      actionId: "deliver-titrant",
      verb: "transfer",
      sourceInstanceId: "burette-50ml-1",
      targetInstanceId: "erlenmeyer-flask-250ml-1",
      value: 0.05,
    });
    expect(deliveryAttempt.currentNodeId).toBe("deliver-titrant-node");
    expect(deliveryAttempt.attemptHistory.at(-1)).toMatchObject({
      actionId: "deliver-titrant",
      success: false,
    });
    expect(deliveryAttempt.dropDispenses["deliver-titrant"]).toBeUndefined();
    expect(deliveryAttempt.feedbackQueue.at(-1)?.message).toMatch(/initial|setup|burette|titration|ready/i);
  });

  it("does not interpret the current numeric titrant action as the retired drop endpoint loop", async () => {
    const lab = await loadAcidBaseTitrationLab();
    const initial = createRuntimeState(lab);
    const attemptedDrop = performRuntimeAction(lab, {
      ...initial,
      currentNodeId: "deliver-titrant-node",
    }, {
      actionId: "deliver-titrant",
      verb: "transfer",
      sourceInstanceId: "burette-50ml-1",
      targetInstanceId: "erlenmeyer-flask-250ml-1",
      value: 0.05,
      parameters: { dispenseMode: "drop" },
    });

    expect(attemptedDrop.currentNodeId).toBe("deliver-titrant-node");
    expect(attemptedDrop.dropDispenses["deliver-titrant"]).toBeUndefined();
    expect(attemptedDrop.contents["erlenmeyer-flask-250ml-1"].visualState).not.toBe("titration-pale-pink");
    expect(attemptedDrop.feedbackQueue.at(-1)?.message).toMatch(/initial|setup|burette|titration|ready/i);
  });

  it("does not rerun a completed final process node", () => {
    const completed = completeDefinition(hardWaterDemoLab, { "weigh-dry-precipitate": 0.0075 });
    const rerun = performRuntimeAction(hardWaterDemoLab, completed, {
      actionId: "calculate-hardness",
      verb: "calculate",
    });
    expect(rerun.notebook).toHaveLength(completed.notebook.length);
    expect(rerun.calculations).toEqual(completed.calculations);
    expect(rerun.feedbackQueue.at(-1)?.message).toContain("already complete");
  });
});
