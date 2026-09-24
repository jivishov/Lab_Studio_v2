import { describe, expect, it } from "vitest";
import { stationLabel } from "../player/stepRules";

describe("stepRules keeps ProcessSidebar's wording", () => {
  it("labels an optional target by the step's station, as stationLabel does in 2D", () => {
    expect(stationLabel(undefined)).toBe("No target required");
    expect(stationLabel("shelf")).toBe("Equipment shelf");
    expect(stationLabel("workbench")).toBe("Workbench");
    expect(stationLabel("volumetric-flask")).toBe("Volumetric flask");
    expect(stationLabel("not-a-definition")).toBe("not-a-definition");
  });
});
