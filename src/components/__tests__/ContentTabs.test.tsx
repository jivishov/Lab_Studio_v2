import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContentTabs } from "../ContentTabs";

const renderTabs = () =>
  render(
    <ContentTabs
      ariaLabel="Content browser"
      tabs={[
        {
          content: <p>Lab list</p>,
          detail: "2 labs",
          id: "labs",
          label: "Labs",
        },
        {
          content: <p>Technique list</p>,
          detail: "4 techniques",
          id: "techniques",
          label: "Techniques",
        },
        {
          content: <p>Asset list</p>,
          detail: "2 trials",
          id: "assets",
          label: "Assets",
        },
      ]}
    />,
  );

describe("ContentTabs", () => {
  it("switches panels when a tab is clicked", () => {
    renderTabs();

    expect(screen.getByRole("tab", { name: /labs/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Lab list")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /assets/i }));

    expect(screen.getByRole("tab", { name: /assets/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByText("Lab list")).not.toBeInTheDocument();
    expect(screen.getByText("Asset list")).toBeInTheDocument();
  });

  it("supports arrow, home, and end keyboard navigation", () => {
    renderTabs();

    fireEvent.keyDown(screen.getByRole("tab", { name: /labs/i }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /techniques/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    fireEvent.keyDown(screen.getByRole("tab", { name: /techniques/i }), { key: "End" });
    expect(screen.getByRole("tab", { name: /assets/i })).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(screen.getByRole("tab", { name: /assets/i }), { key: "Home" });
    expect(screen.getByRole("tab", { name: /labs/i })).toHaveAttribute("aria-selected", "true");
  });
});
