import { describe, expect, it } from "vitest";
import { clickCallout, handCallout, STROKE, strokeDepth } from "../bench/input/useBenchCarry";

// The left button on the microarray lab's controller (adoption P3, 2026-10-04). Written, not run.

describe("press-and-drag-down strokes (hand-core.js:48, interaction.js:156-211)", () => {
  it("reaches full depth at 28 px and acts at 0.85", () => {
    expect(STROKE).toEqual({ fullPx: 28, act: 0.85, withdrawPx: 32 });
    expect(strokeDepth(0)).toBe(0);
    expect(strokeDepth(14)).toBeCloseTo(0.5, 9);
    expect(strokeDepth(28)).toBe(1);
    expect(strokeDepth(60)).toBe(1);
    expect(strokeDepth(23.8)).toBeGreaterThanOrEqual(STROKE.act);
  });

  it("never goes negative when the pointer moves up", () => {
    expect(strokeDepth(-10)).toBe(0);
  });
});

describe("click-carry callouts", () => {
  it("words a commit as a click", () => {
    expect(clickCallout("Release to set down", "commit")).toBe("Click to set down");
    expect(clickCallout("Release to place", "commit")).toBe("Click to place");
  });

  it("words a seat, pour or delivery as a stroke that acts when let go (G-5)", () => {
    expect(clickCallout("Release to pour into the beaker", "insert")).toBe("Press, drag down and let go to pour into the beaker");
  });

  it("words a draw as press, drag down and let go", () => {
    expect(clickCallout("Release to draw up from the beaker", "draw")).toBe("Press, drag down and let go to draw up from the beaker");
  });

  it("words a hand carry by the hand's own action (§8)", () => {
    const plain = { turn: false, squeeze: false };
    expect(handCallout("Release to set down", "commit", plain)).toBe("Open your palm to set down");
    expect(handCallout("Release to place the watch glass on the balance pan", "insert", plain)).toBe("Pause here, then lower your hand to place the watch glass on the balance pan");
    expect(handCallout("Release to pour into the beaker", "insert", { turn: true, squeeze: false })).toBe("Pause here, then turn your palm to pour into the beaker");
    expect(handCallout("Release to empty the pipette into the cuvette", "insert", { turn: false, squeeze: true })).toBe("Pause here, lower in and squeeze to empty the pipette into the cuvette");
    expect(handCallout("Release to draw up from the beaker", "draw", plain)).toBe("Squeeze above it, lower in and let go to draw up from the beaker");
  });

  it("words a rinse: a click with the mouse, a squeeze by hand (decided 2026-10-04)", () => {
    const text = "Release to rinse the weighing boat into the funnel";
    expect(clickCallout(text, "commit")).toBe("Click to rinse the weighing boat into the funnel");
    expect(handCallout(text, "commit", { turn: false, squeeze: false, rinse: true })).toBe("Pause here, then squeeze to rinse the weighing boat into the funnel");
  });

  it("leaves coaching and refusals as they are", () => {
    expect(clickCallout("Fill in the step card first", "commit")).toBe("Fill in the step card first");
    expect(clickCallout("Not the target for this step", "commit")).toBe("Not the target for this step");
  });
});
