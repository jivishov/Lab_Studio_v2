import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AssayRunPlanner } from "../AssayRunPlanner";

describe("AssayRunPlanner", () => {
  it("renders textual status, exact tables, editable assumptions, and bottlenecks", () => {
    render(<AssayRunPlanner />);
    expect(screen.getByText("Complete plan")).toBeInTheDocument();
    expect(screen.getByText("1776 1")).toBeInTheDocument();
    expect(screen.getByText(/Plate reader requires 3 waves/)).toBeInTheDocument();
    expect(screen.getByRole("table", {
      name: /Exact requirements and inventory comparison/i,
    })).toBeInTheDocument();
    expect(screen.getByRole("table", {
      name: /Sequential operational phases/i,
    })).toBeInTheDocument();
    const note = screen.getByLabelText("User-declared planning note");
    fireEvent.change(note, { target: { value: "Teacher-reviewed local grouping." } });
    expect(note).toHaveValue("Teacher-reviewed local grouping.");
  });

  it("recalculates plate and tip requirements from declared grouping", () => {
    render(<AssayRunPlanner />);
    fireEvent.change(screen.getByLabelText("Participants"), {
      target: { value: "8" },
    });
    const table = screen.getByRole("table", {
      name: /Exact requirements and inventory comparison/i,
    });
    const plateRow = within(table).getByRole("row", {
      name: /96-well microplate/,
    });
    expect(within(plateRow).getByText("2 1")).toBeInTheDocument();
    const tipRow = within(table).getByRole("row", {
      name: /Universal 200 uL tips/,
    });
    expect(within(tipRow).getByText("592 1")).toBeInTheDocument();
  });

  it("offers review-only deterministic downloads", () => {
    const createObjectURL = vi.fn(() => "blob:cycle09");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    render(<AssayRunPlanner />);
    fireEvent.click(screen.getByRole("button", { name: "Requirements CSV" }));
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:cycle09");
    click.mockRestore();
  });
});
