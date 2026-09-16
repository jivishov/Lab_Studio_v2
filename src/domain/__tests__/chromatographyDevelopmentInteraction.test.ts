import { describe, expect, it } from "vitest";
import type { ActionDefinition } from "../types";
import { deriveActionEffectContract } from "../atomRegistry";
import {
  compatibleInteractionVerbs,
  defaultInteractionForAction,
} from "../interactions";

/**
 * Source-level regression for the split between insertion and development.
 *
 * The strip is inserted by a separate `place`/`snapIntoTarget` action. Development is a process
 * control that mutates chromatogram/chamber/material state only after the reducer's attachment,
 * closure, wet-state and dataset gates pass. Authored here; not executed under the current
 * repository validation ceiling.
 */
describe("chromatography development interaction contract", () => {
  const action: ActionDefinition = {
    id: "develop-fixture-strip",
    verb: "developChromatogram",
    atomId: "atom.developChromatogram.develop-strip",
    label: "Develop the inserted strip",
    parameters: {
      paperInstanceId: "fixture-paper",
      chamberInstanceId: "fixture-chamber",
      datasetId: "fixture-dataset",
      stopCondition: "front-mm:80",
      chamberSealed: true,
      recordMeasurementsOnDevelop: false,
    },
    prerequisites: [],
    stateChanges: [],
    invalidCases: [],
    feedback: { success: "Developed.", invalid: "Cannot develop." },
    evidence: [],
  };

  it("keeps strip insertion on snapIntoTarget and development on recordNotebook", () => {
    expect(compatibleInteractionVerbs.snapIntoTarget).not.toContain("developChromatogram");
    expect(compatibleInteractionVerbs.recordNotebook).toContain("developChromatogram");

    const interaction = defaultInteractionForAction(action);
    expect(interaction).toMatchObject({ type: "recordNotebook", valueParameter: "note" });
    expect(interaction).not.toHaveProperty("sourceDefinitionId");
    expect(interaction).not.toHaveProperty("targetDefinitionId");
  });

  it("derives the development endpoint as physical state change, not notebook evidence", () => {
    const derived = deriveActionEffectContract({
      ...action,
      interaction: {
        type: "recordNotebook",
        valueParameter: "note",
        accessibleLabel: "Develop the inserted strip in the closed chamber.",
      },
    });

    expect(derived.errors).toEqual([]);
    expect(derived.contract?.classes).toContain("apparatus-material-instrument-state");
    expect(derived.contract?.classes).not.toContain("evidence-recording");
    expect(derived.contract?.classes).not.toContain("measurement-direct-observation-acquisition");
  });
});
