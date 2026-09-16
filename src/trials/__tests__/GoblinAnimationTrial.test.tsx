import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GoblinAnimationTrial } from "../GoblinAnimationTrial";

describe("GoblinAnimationTrial", () => {
  it("starts in sprite mode and exposes frame controls for the vertical slice", () => {
    const { container } = render(<GoblinAnimationTrial />);

    expect(screen.getByRole("heading", { name: /goblin animation trial/i })).toBeInTheDocument();
    expect(container.querySelector(".goblin-animation-stage")).toHaveAttribute("data-render-mode", "sprite");
    expect(container.querySelector(".goblin-sprite-actor")).toHaveAttribute("data-sprite-id", "apparatus-helper/pour");

    fireEvent.change(screen.getByRole("slider"), { target: { value: "3" } });

    expect(container.querySelector(".goblin-sprite-actor")).toHaveAttribute("data-frame-index", "3");
    expect(container.querySelector(".goblin-sprite-actor")).toHaveAttribute("data-playing", "false");

    fireEvent.click(screen.getByRole("button", { name: /next frame/i }));

    expect(container.querySelector(".goblin-sprite-actor")).toHaveAttribute("data-frame-index", "4");
  });

  it("switches back to the CSS rig comparison mode", () => {
    const { container } = render(<GoblinAnimationTrial />);

    fireEvent.click(screen.getByRole("button", { name: /rig comparison/i }));
    fireEvent.click(screen.getByRole("button", { name: /^pour$/i }));

    expect(container.querySelector(".goblin-animation-stage")).toHaveAttribute("data-preset-id", "pour");
    expect(container.querySelector(".goblin-sprite-actor")).toBeNull();
  });
});
