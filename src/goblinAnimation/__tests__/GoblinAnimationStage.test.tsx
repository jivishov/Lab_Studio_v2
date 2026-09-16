import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GoblinAnimationStage, goblinAnimationPresets } from "..";

describe("GoblinAnimationStage", () => {
  it("renders both current helper characters from a preset", () => {
    const { container } = render(<GoblinAnimationStage preset={goblinAnimationPresets.idle} />);

    const actors = Array.from(container.querySelectorAll(".goblin-actor"));
    expect(actors).toHaveLength(2);
    expect(actors.map((actor) => actor.getAttribute("data-character-id"))).toEqual([
      "apparatus-helper",
      "notebook-helper",
    ]);
    expect(container.querySelector("[src$='assets/goblin-mode/apparatus-helper.png']")).not.toBeNull();
    expect(container.querySelector("[src$='assets/goblin-mode/notebook-helper.png']")).not.toBeNull();
  });

  it("updates preset and actor motion attributes when the preset changes", () => {
    const { container, rerender } = render(<GoblinAnimationStage preset="idle" />);

    expect(container.querySelector(".goblin-animation-stage")).toHaveAttribute("data-preset-id", "idle");
    expect(container.querySelectorAll("[data-motion-kind='idle']")).toHaveLength(2);

    rerender(<GoblinAnimationStage preset="pour" />);

    expect(container.querySelector(".goblin-animation-stage")).toHaveAttribute("data-preset-id", "pour");
    expect(container.querySelectorAll("[data-motion-kind='pour']")).toHaveLength(2);
  });

  it("keeps animated actors decorative for assistive technology", () => {
    const { container } = render(<GoblinAnimationStage preset={goblinAnimationPresets.rinse} />);

    const actors = Array.from(container.querySelectorAll(".goblin-actor"));
    expect(actors.length).toBeGreaterThan(0);
    expect(actors.every((actor) => actor.getAttribute("aria-hidden") === "true")).toBe(true);
  });
});
