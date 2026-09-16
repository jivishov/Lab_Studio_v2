import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GoblinSpriteActor, getGoblinSpriteDefinition } from "..";

const definition = getGoblinSpriteDefinition("apparatus-helper/pour");

describe("GoblinSpriteActor", () => {
  it("renders the configured sprite sheet as a decorative actor", () => {
    if (!definition) throw new Error("Missing apparatus-helper/pour sprite definition.");

    const { container } = render(
      <GoblinSpriteActor
        cue={{ id: "test", spriteId: definition.id, x: 42, y: 77 }}
        definition={definition}
        fps={definition.fps}
        frameIndex={definition.stillFrame}
        playing
      />,
    );

    const actor = container.querySelector(".goblin-sprite-actor");
    expect(actor).toHaveAttribute("aria-hidden", "true");
    expect(actor).toHaveAttribute("data-sprite-id", "apparatus-helper/pour");
    expect(actor).toHaveAttribute("data-motion-kind", "pour");
    expect(actor).toHaveAttribute("data-playing", "true");
    expect(actor?.getAttribute("style")).toContain("apparatus-helper-pour.png");
    expect(actor?.getAttribute("style")).toContain("--goblin-sprite-width: 288px");
    expect(actor?.getAttribute("style")).toContain("--goblin-sprite-duration: 1333.3333333333333ms");
  });

  it("uses a static frame position when playback is paused", () => {
    if (!definition) throw new Error("Missing apparatus-helper/pour sprite definition.");

    const { container } = render(
      <GoblinSpriteActor
        cue={{ id: "test", spriteId: definition.id, x: 42, y: 77 }}
        definition={definition}
        fps={definition.fps}
        frameIndex={3}
        playing={false}
      />,
    );

    const actor = container.querySelector(".goblin-sprite-actor");
    expect(actor).toHaveAttribute("data-frame-index", "3");
    expect(actor).toHaveAttribute("data-playing", "false");
    expect(actor?.getAttribute("style")).toContain("background-position: -864px 0px");
  });
});
