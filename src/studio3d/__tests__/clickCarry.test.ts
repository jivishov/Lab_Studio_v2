import { describe, expect, it } from "vitest";
import { handCallout } from "../bench/input/useBenchCarry";

// A drag says "Release to …" as it stands (decided 2026-10-22: the mouse drags and drops; the click-carry model and
// its strokes are gone). The hand keeps its own wording.
describe("hand-carry callouts", () => {
  it("words a hand carry by the hand's own action (§8)", () => {
    const plain = { turn: false, squeeze: false };
    expect(handCallout("Release to set down", "commit", plain)).toBe("Open your palm to set down");
    expect(handCallout("Release to place the watch glass on the balance pan", "insert", plain)).toBe("Pause here, then lower your hand to place the watch glass on the balance pan");
    expect(handCallout("Release to pour into the beaker", "insert", { turn: true, squeeze: false })).toBe("Pause here, then turn your palm to pour into the beaker");
    expect(handCallout("Release to empty the pipette into the cuvette", "insert", { turn: false, squeeze: true })).toBe("Pause here, lower in and squeeze to empty the pipette into the cuvette");
    expect(handCallout("Release to draw up from the beaker", "draw", plain)).toBe("Squeeze above it, lower in and let go to draw up from the beaker");
  });

  it("words a rinse as a squeeze by hand (decided 2026-10-04)", () => {
    const text = "Release to rinse the weighing boat into the funnel";
    expect(handCallout(text, "commit", { turn: false, squeeze: false, rinse: true })).toBe("Pause here, then squeeze to rinse the weighing boat into the funnel");
  });

  it("leaves coaching and refusals as they are", () => {
    const plain = { turn: false, squeeze: false };
    expect(handCallout("Fill in the step card first", "commit", plain)).toBe("Fill in the step card first");
    expect(handCallout("Not the target for this step", "commit", plain)).toBe("Not the target for this step");
  });
});
