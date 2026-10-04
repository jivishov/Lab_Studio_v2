import { describe, expect, it } from "vitest";
import { clickCallout, STROKE, strokeDepth } from "../bench/input/useBenchCarry";

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

  it("words a seat, pour or delivery as a stroke", () => {
    expect(clickCallout("Release to pour into the beaker", "insert")).toBe("Press and drag down to pour into the beaker");
  });

  it("words a draw as press, drag down and let go", () => {
    expect(clickCallout("Release to draw up from the beaker", "draw")).toBe("Press, drag down and let go to draw up from the beaker");
  });

  it("leaves coaching and refusals as they are", () => {
    expect(clickCallout("Fill in the step card first", "commit")).toBe("Fill in the step card first");
    expect(clickCallout("Not the target for this step", "commit")).toBe("Not the target for this step");
  });
});
