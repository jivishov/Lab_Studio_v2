import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GoblinSpriteStage, getGoblinSpriteDefinition } from "..";

const definition = getGoblinSpriteDefinition("apparatus-helper/pour");

describe("GoblinSpriteStage", () => {
  it("uses manifest placement and event frames for the pour stage", () => {
    if (!definition) throw new Error("Missing apparatus-helper/pour sprite definition.");

    const { container } = render(
      <GoblinSpriteStage definition={definition} fps={definition.fps} frameIndex={definition.stillFrame} playing />,
    );

    const stage = container.querySelector(".goblin-sprite-stage");
    const actor = container.querySelector(".goblin-sprite-actor");
    const effect = container.querySelector(".goblin-animation-stage__effect.is-pour-stream");
    const keyframes = container.querySelector("style");

    expect(stage).toHaveAttribute("data-stage-cue-x", "56");
    expect(stage).toHaveAttribute("data-pour-start-frame", "9");
    expect(stage).toHaveAttribute("data-pour-end-frame", "11");
    expect(actor?.getAttribute("style")).toContain("--goblin-sprite-x: 56%");
    expect(actor?.getAttribute("style")).toContain("--goblin-sprite-width: 288px");
    expect(effect?.getAttribute("style")).toContain("animation-name: goblin-sprite-stream-apparatus-helper-pour");
    expect(keyframes?.textContent).toContain("@keyframes goblin-sprite-stream-apparatus-helper-pour");
    expect(keyframes?.textContent).toContain("56.25%");
  });

  it("shows the stream only on active event frames when paused", () => {
    if (!definition) throw new Error("Missing apparatus-helper/pour sprite definition.");

    const active = render(
      <GoblinSpriteStage definition={definition} fps={definition.fps} frameIndex={10} playing={false} />,
    );
    expect(active.container.querySelector(".is-pour-stream")?.getAttribute("style")).toContain("opacity: 0.92");

    const inactive = render(
      <GoblinSpriteStage definition={definition} fps={definition.fps} frameIndex={3} playing={false} />,
    );
    expect(inactive.container.querySelector(".is-pour-stream")?.getAttribute("style")).toContain("opacity: 0");
  });
});
