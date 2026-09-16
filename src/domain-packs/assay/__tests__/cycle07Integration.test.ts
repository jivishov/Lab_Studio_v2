import { describe, expect, it } from "vitest";
import { getComplete96WellSerialDilutionPlan } from "../dilution/__fixtures__/complete96WellPlan";
import {
  executeComplete96WellSerialDilutionFixture,
} from "../runtime/__fixtures__/complete96WellSerialDilution";
import { calculateWellResourceConcentration } from "../pipetting";

describe("Cycle 07 runtime and dilution-plan agreement", () => {
  it("executes the checked 96-well plan through intents and reproduces every formula result", () => {
    const plan = getComplete96WellSerialDilutionPlan();
    const execution = executeComplete96WellSerialDilutionFixture();

    expect(execution.transitions).toHaveLength(137);
    expect(execution.transitions.every(({ accepted }) => accepted)).toBe(true);
    expect(plan.points.flatMap(({ targets }) => targets)).toHaveLength(96);

    for (const point of plan.points) {
      for (const target of point.targets) {
        const well = execution.state.plate.wells.find(
          ({ coordinate }) => coordinate === target.mapping.coordinate,
        );
        expect(well, target.mapping.coordinate).toBeDefined();
        if (!well) continue;
        expect(well.volume).toEqual(target.retainedVolume);
        expect(well.mixed).toBe(true);
        expect(calculateWellResourceConcentration(well, "compound-stock")).toEqual(
          target.achievedConcentration,
        );
      }
    }

    expect(execution.evidence).toHaveLength(137);
    expect(execution.evidence.every(({ typeId, typeVersion }) =>
      typeId === "assay.pipetting-operation" && typeVersion === "1.0.0")).toBe(true);
    expect(execution.evidence.at(-2)).toMatchObject({
      operationType: "discard",
      outcome: "accepted",
      data: { discardedVolume: "800", wasteRef: "liquid-waste" },
    });
  });
});
