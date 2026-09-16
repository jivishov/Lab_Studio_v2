import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SortToggle } from "../SortToggle";

describe("SortToggle", () => {
  it("marks the active direction and reports direction changes", () => {
    const onDirectionChange = vi.fn();

    render(
      <SortToggle
        ariaLabel="Sort assets"
        direction="asc"
        onDirectionChange={onDirectionChange}
      />,
    );

    expect(screen.getByRole("button", { name: "A-Z" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Z-A" })).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: "Z-A" }));

    expect(onDirectionChange).toHaveBeenCalledWith("desc");
  });
});
