import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyLabSetup } from "../../data/labSetup";
import { compileLabComposition } from "../../data/compileLabComposition";
import type {
  ContentState,
  LabCompositionSourceDefinition,
  LabDefinition,
  RuntimeState,
  TechniqueDefinition,
} from "../../domain/types";
import { validateLabCompositionSource, validateTechniqueDefinition } from "../../domain/validation";
import { createRuntimeState, getActions, getProcess, performRuntimeAction } from "../index";

/**
 * Regression coverage for the shipped `add-water-solvent` action.
 *
 * The cases are authored, not executed, under this repository's validation policy. They compile
 * the public lab with a concrete teacher setup and drive the real preconditions through the
 * reducer before exercising the charge. No prerequisite is stripped and no merge helper is called
 * directly.
 */

const readPublicJson = async <T>(...segments: string[]): Promise<T> =>
  JSON.parse(
    await readFile(join(process.cwd(), "public", ...segments), "utf8"),
  ) as T;

const loadConfiguredChromatographyLab = async (): Promise<LabDefinition> => {
  const sourceInput = await readPublicJson<LabCompositionSourceDefinition>("labs", "paper-chromatography.json");
  const sourceValidation = validateLabCompositionSource(sourceInput);
  if (!sourceValidation.ok || !sourceValidation.value) {
    throw new Error(sourceValidation.errors.join("\n"));
  }

  const configuredSource = applyLabSetup(sourceValidation.value, {
    trials: [{ solvent: "water" }, { solvent: "propanol" }],
    baselineHeightMm: 15,
    solventDepthMm: 5,
    spotVolumeMl: 0.01,
    solventVolumeMl: 10,
    spotterLoadVolumeMl: 0.1,
    paperLengthMm: 120,
    stopFrontMm: 80,
  });
  const techniqueInput = await readPublicJson<unknown>("techniques", "paper-chromatography.json");
  const techniqueValidation = validateTechniqueDefinition(techniqueInput);
  if (!techniqueValidation.ok || !techniqueValidation.value) {
    throw new Error(techniqueValidation.errors.join("\n"));
  }
  const technique: TechniqueDefinition = techniqueValidation.value;

  return compileLabComposition(configuredSource, async (techniqueId) => {
    if (techniqueId !== technique.id) {
      throw new Error(`Unexpected technique request ${techniqueId}.`);
    }
    return structuredClone(technique);
  });
};

const preChargeResponses: Readonly<Record<string, string>> = {
  "record-imf-hypothesis":
    "Distilled water should keep polar dye interactions with cellulose strong, while 2-propanol should change migration by competing through different hydrogen bonding and dispersion interactions.",
  "configure-repeatable-procedure":
    "Use 120 mm paper, a 15 mm graphite origin, a 5 mm water layer, 10 mL solvent, 0.1 mL loaded sample, 0.01 mL spot, and stop at an 80 mm front; keep the origin above solvent and use fresh labeled strips.",
  "design-data-table":
    "Record solvent identity and rationale, paper and solvent settings, solvent-front and band distances in millimetres, Rf, resolution, overlap, streaking, disposal stream, and notes.",
};

const advanceToAction = (
  definition: LabDefinition,
  startingState: RuntimeState,
  actionId: string,
): RuntimeState => {
  let state = startingState;
  for (let index = 0; index < getProcess(definition).nodes.length; index += 1) {
    const node = getProcess(definition).nodes.find((candidate) => candidate.id === state.currentNodeId);
    if (!node?.actionId) throw new Error(`Current node ${state.currentNodeId} has no action.`);
    const action = getActions(definition).find((candidate) => candidate.id === node.actionId);
    if (!action) throw new Error(`Missing action ${node.actionId}.`);
    if (action.id === actionId) return state;

    const note = preChargeResponses[action.id];
    const next = performRuntimeAction(definition, state, {
      actionId: action.id,
      verb: action.verb,
      ...(note === undefined ? {} : { note }),
    });
    if (next.currentNodeId === state.currentNodeId) {
      throw new Error(`Could not reach ${actionId}; ${action.id} did not advance the process.`);
    }
    state = next;
  }
  throw new Error(`Could not reach authored action ${actionId}.`);
};

const withChamberClosure = (
  state: RuntimeState,
  sourceClosure: boolean | undefined,
  receiverClosure: boolean | undefined,
): RuntimeState => {
  const equipmentInstances = state.equipmentInstances.map((instance) => {
    if (instance.id !== "water-solvent-bottle" && instance.id !== "water-chamber") return instance;
    const contents: ContentState = { ...instance.contents };
    const closure = instance.id === "water-solvent-bottle" ? sourceClosure : receiverClosure;
    if (closure === undefined) delete contents.developingChamberClosed;
    else contents.developingChamberClosed = closure;
    return { ...instance, contents };
  });
  return {
    ...state,
    equipmentInstances,
    contents: Object.fromEntries(equipmentInstances.map((instance) => [instance.id, instance.contents])),
  };
};

const instanceContents = (state: RuntimeState, id: string): ContentState => {
  const instance = state.equipmentInstances.find((candidate) => candidate.id === id);
  if (!instance) throw new Error(`Missing equipment instance ${id}.`);
  return instance.contents;
};

describe("authored chromatography chamber charge", () => {
  it("keeps receiver closure ownership through the shipped solvent charge path", async () => {
    const lab = await loadConfiguredChromatographyLab();
    const charge = getActions(lab).find((action) => action.id === "add-water-solvent");
    expect(charge).toMatchObject({
      id: "add-water-solvent",
      verb: "transfer",
      parameters: {
        sourceDefinitionId: "distilled-water-bottle",
        targetDefinitionId: "chromatography-chamber",
        sourceInstanceId: "water-solvent-bottle",
        targetInstanceId: "water-chamber",
        volumeMl: 10,
      },
    });

    const ready = advanceToAction(lab, createRuntimeState(lab), "add-water-solvent");
    expect(ready.currentNodeId).toBe("add-water-solvent-node");
    expect(ready.attemptHistory.at(-1)).toMatchObject({
      actionId: "place-water-chamber",
      success: true,
    });

    const cases: Array<{
      label: string;
      sourceClosure: boolean;
      receiverClosure: boolean | undefined;
      expectedSuccess: boolean;
      expectedReceiverClosure: boolean | undefined;
      receiverOwnsClosure: boolean;
    }> = [
      {
        label: "an explicitly open receiver",
        sourceClosure: true,
        receiverClosure: false,
        expectedSuccess: true,
        expectedReceiverClosure: false,
        receiverOwnsClosure: true,
      },
      {
        label: "an explicitly closed receiver",
        sourceClosure: false,
        receiverClosure: true,
        expectedSuccess: false,
        expectedReceiverClosure: true,
        receiverOwnsClosure: true,
      },
      {
        label: "a receiver with no lid state",
        sourceClosure: true,
        receiverClosure: undefined,
        expectedSuccess: true,
        expectedReceiverClosure: undefined,
        receiverOwnsClosure: false,
      },
    ];

    for (const testCase of cases) {
      const caseState = withChamberClosure(structuredClone(ready), testCase.sourceClosure, testCase.receiverClosure);
      const beforeReceiver = instanceContents(caseState, "water-chamber");
      const beforeSource = instanceContents(caseState, "water-solvent-bottle");
      const charged = performRuntimeAction(
        lab,
        caseState,
        { actionId: "add-water-solvent", verb: "transfer" },
      );
      const receiver = instanceContents(charged, "water-chamber");
      const source = instanceContents(charged, "water-solvent-bottle");

      if (!testCase.expectedSuccess) {
        expect(charged.attemptHistory.at(-1), testCase.label).toMatchObject({
          actionId: "add-water-solvent",
          success: false,
        });
        expect(charged.currentNodeId, testCase.label).toBe(caseState.currentNodeId);
        expect(receiver, testCase.label).toEqual(beforeReceiver);
        expect(source, testCase.label).toEqual(beforeSource);
        continue;
      }

      expect(charged.attemptHistory.at(-1), testCase.label).toMatchObject({
        actionId: "add-water-solvent",
        success: true,
      });
      expect(receiver.kind, testCase.label).toBe("liquid");
      expect(receiver.label, testCase.label).toBe("Distilled water");
      expect(receiver.volumeMl, testCase.label).toBe(10);
      expect(receiver.solutes, testCase.label).toEqual([]);
      expect(receiver.contamination, testCase.label).toEqual([]);
      expect(receiver.wetState, testCase.label).toBe("wet");
      expect(receiver.visualState, testCase.label).toBe("clear-liquid");
      expect(receiver.recoveryEvidence, testCase.label).toBeUndefined();
      expect(receiver.extractionState, testCase.label).toBeUndefined();
      expect(receiver.developingChamberClosed, testCase.label).toBe(testCase.expectedReceiverClosure);
      expect(
        Object.prototype.hasOwnProperty.call(receiver, "developingChamberClosed"),
        testCase.label,
      ).toBe(testCase.receiverOwnsClosure);
      expect(source.kind, testCase.label).toBe("liquid");
      expect(source.label, testCase.label).toBe("Distilled water");
      expect(source.volumeMl, testCase.label).toBe(20);
      expect(source.solutes, testCase.label).toEqual([]);
      expect(source.contamination, testCase.label).toEqual([]);
      expect(source.wetState, testCase.label).toBe("wet");
      expect(source.visualState, testCase.label).toBe("clear-liquid");
      expect(source.developingChamberClosed, testCase.label).toBe(testCase.sourceClosure);
    }
  });
});
