import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StudioResizeHandle } from "../StudioResizeHandle";
import { TeacherStudio } from "../TeacherStudio";

describe("Studio stage workbenches", () => {
  it("keeps Setup and Preview stage ownership explicit", () => {
    window.localStorage.clear();
    render(<TeacherStudio />);

    fireEvent.click(within(screen.getByLabelText("Studio stages")).getByRole("tab", { name: "Setup" }));
    const setupRail = screen.getByLabelText("Draft setup and readiness");
    const equipmentRegion = screen.getByLabelText("Required equipment");
    expect(setupRail).toBeInTheDocument();
    expect(equipmentRegion).toBeInTheDocument();
    expect(within(equipmentRegion).getByRole("button", { name: "Remove Sample bottle" })).toHaveClass(
      "equipment-card__remove",
    );
    expect(within(equipmentRegion).getAllByRole("button", { name: "Add starting item" })[0]).toHaveClass(
      "equipment-card__add-starting",
    );
    expect(screen.getByRole("separator", { name: "Resize Setup configuration" })).toHaveAttribute(
      "aria-valuenow",
      "396",
    );

    fireEvent.click(within(screen.getByLabelText("Studio stages")).getByRole("tab", { name: "Preview & validate" }));
    expect(screen.getByLabelText("Preview readiness and validation")).toBeInTheDocument();
    expect(screen.getByLabelText("Preview and validation workbench")).not.toHaveAttribute("hidden");
    expect(screen.getByLabelText("Studio authoring")).toHaveAttribute("hidden");
    expect(screen.getByRole("separator", { name: "Resize preview validation" })).toBeInTheDocument();
    expect(screen.getByLabelText("Experiment workspace")).toHaveClass("player-workbench-shell");
    expect(screen.getByLabelText("Current action inspector")).toHaveClass("player-inspector-shell");
  });

  it("distinguishes the optional in-context split from the dedicated Preview stage", () => {
    window.localStorage.clear();
    render(<TeacherStudio />);

    const toggle = screen.getByRole("button", { name: "Open in-context split preview" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(toggle);

    expect(screen.getByRole("button", { name: "Close in-context split preview" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const split = screen.getByRole("separator", { name: "Resize authoring and in-context preview" });
    expect(split).toHaveAttribute("aria-valuemin", "56");
    expect(split).toHaveAttribute("aria-valuemax", "68");
    expect(screen.getByLabelText("In-context live preview")).not.toHaveAttribute("hidden");
  });

  it("resizes the Process outline and right step editor without losing collapse recovery", () => {
    window.localStorage.clear();
    render(<TeacherStudio />);

    const outlineResize = screen.getByRole("separator", { name: "Resize Process outline" });
    fireEvent.keyDown(outlineResize, { key: "ArrowRight" });
    expect(outlineResize).toHaveAttribute("aria-valuenow", "408");
    fireEvent.keyDown(outlineResize, { key: "Home" });
    expect(outlineResize).toHaveAttribute("aria-valuenow", "300");
    fireEvent.keyDown(outlineResize, { key: "End" });
    expect(outlineResize).toHaveAttribute("aria-valuenow", "480");

    const dockResize = screen.getByRole("separator", { name: "Resize process canvas and step editor sidebar" });
    fireEvent.keyDown(dockResize, { key: "ArrowLeft" });
    expect(dockResize).toHaveAttribute("aria-valuenow", "376");
    fireEvent.keyDown(dockResize, { key: "Home" });
    expect(dockResize).toHaveAttribute("aria-valuenow", "320");
    fireEvent.keyDown(dockResize, { key: "End" });
    expect(dockResize).toHaveAttribute("aria-valuenow", "520");

    fireEvent.click(screen.getByRole("button", { name: "Collapse step editor" }));
    expect(screen.queryByRole("separator", { name: "Resize process canvas and step editor sidebar" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand editor" })).toBeInTheDocument();
  });
});

describe("StudioResizeHandle", () => {
  it("exposes native separator semantics, keyboard limits, and authored reset", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <StudioResizeHandle
        defaultValue={396}
        label="Resize test rail"
        max={480}
        min={300}
        onChange={onChange}
        orientation="vertical"
        value={396}
      />,
    );
    const separator = screen.getByRole("separator", { name: "Resize test rail" });
    expect(separator).toHaveAttribute("aria-orientation", "vertical");
    fireEvent.keyDown(separator, { key: "Home" });
    expect(onChange).toHaveBeenLastCalledWith(300);
    fireEvent.keyDown(separator, { key: "End" });
    expect(onChange).toHaveBeenLastCalledWith(480);

    rerender(
      <StudioResizeHandle
        defaultValue={396}
        label="Resize test rail"
        max={480}
        min={300}
        onChange={onChange}
        orientation="vertical"
        value={480}
      />,
    );
    fireEvent.doubleClick(screen.getByRole("separator", { name: "Resize test rail" }));
    expect(onChange).toHaveBeenLastCalledWith(396);
  });
});
