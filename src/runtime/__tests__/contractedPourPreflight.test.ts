import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyTechniqueConfiguration } from "../../data/techniqueConfiguration";
import type { RuntimeState, TechniqueDefinition } from "../../domain/types";
import { createRuntimeState } from "../index";
import { resolveInteractionIntent } from "../interactionIntents";

/**
 * The pour pre-check reads a typed volume contract as the reducer does, instead of the whole
 * source: a teacher-set aliquot (literal) and a cuvette filled to a fraction of its capacity are
 * no longer refused as overflows before the reducer can perform them.
 */

const technique = applyTechniqueConfiguration(
  JSON.parse(readFileSync(join(process.cwd(), "public", "techniques", "transmittance-dilution.json"), "utf8")) as TechniqueDefinition,
  { stockConcentrationM: "0.2", wavelengthNm: "630", stockAliquotVolumeMl: "5", waterVolumeMl: "10", finalVolumeMl: "15", samplePercentTransmittance: "42.5" },
);
const atNode = (nodeSuffix: string): RuntimeState => {
  const state = createRuntimeState(technique);
  const node = technique.process.nodes.find((n) => n.id === `transmittance-dilution-${nodeSuffix}-node`)!;
  return {
    ...state,
    currentNodeId: node.id,
    completedNodes: technique.process.nodes.slice(0, technique.process.nodes.indexOf(node)).map((n) => n.id),
    equipmentInstances: state.equipmentInstances.map((i) => ({ ...i, location: "workbench" })),
  };
};

describe("the pour pre-check for contracted volumes", () => {
  it("lets a teacher-set 5 mL aliquot into the 100 mL cylinder (it used to judge the 1 L stock)", () => {
    const result = resolveInteractionIntent(technique, atNode("measure-stock-dye"), {
      type: "pourIntent", sourceInstanceId: "sample-bottle-1", targetInstanceId: "graduated-cylinder-1",
    });
    expect(result.ok, result.ok ? "" : result.feedback.message).toBe(true);
  });

  it("lets a 4 mL cuvette be filled to 75 % from a 1 L bottle", () => {
    const result = resolveInteractionIntent(technique, atNode("fill-blank-cuvette"), {
      type: "pourIntent", sourceInstanceId: "blank-source-1", targetInstanceId: "blank-cuvette-1",
    });
    if (!result.ok) expect(result.feedback.reason).not.toBe("overflowRisk");
  });

  it("says a teacher-set volume is missing when the technique runs without its setup", () => {
    const raw = JSON.parse(readFileSync(join(process.cwd(), "public", "techniques", "transmittance-dilution.json"), "utf8")) as TechniqueDefinition;
    const node = raw.process.nodes.find((n) => n.id === "transmittance-dilution-measure-stock-dye-node")!;
    const base = createRuntimeState(raw);
    const state: RuntimeState = {
      ...base,
      currentNodeId: node.id,
      completedNodes: raw.process.nodes.slice(0, raw.process.nodes.indexOf(node)).map((n) => n.id),
      equipmentInstances: base.equipmentInstances.map((i) => ({ ...i, location: "workbench" })),
    };
    const result = resolveInteractionIntent(raw, state, { type: "pourIntent", sourceInstanceId: "sample-bottle-1", targetInstanceId: "graduated-cylinder-1" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.feedback.reason).toBe("missingPrerequisite");
      expect(result.feedback.message).toMatch(/teacher setting that has not been set up/);
    }
  });

  it("still refuses a typed value that would overflow", () => {
    const state = atNode("measure-stock-dye");
    const overflow = resolveInteractionIntent({
      ...technique,
      actions: technique.actions.map((a) => a.id === "transmittance-dilution-measure-stock-dye"
        ? { ...a, volume: { source: "literal" as const, valueMl: 500, outputMeasurementId: "stock-volume" } } : a),
    }, state, { type: "pourIntent", sourceInstanceId: "sample-bottle-1", targetInstanceId: "graduated-cylinder-1" });
    expect(overflow.ok).toBe(false);
    if (!overflow.ok) expect(overflow.feedback.reason).toBe("overflowRisk");
  });
});
