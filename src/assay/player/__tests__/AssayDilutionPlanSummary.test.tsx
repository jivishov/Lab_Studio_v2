import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getComplete96WellSerialDilutionPlan } from "../../../domain-packs/assay/dilution/__fixtures__/complete96WellPlan";
import { AssayDilutionPlanSummary } from "../AssayDilutionPlanSummary";

describe("AssayDilutionPlanSummary", () => {
  it("renders the exact 96-well formula trace as an accessible table", () => {
    const plan = getComplete96WellSerialDilutionPlan();
    render(<AssayDilutionPlanSummary plan={plan} />);

    expect(screen.getByRole("heading", { name: "96-well serial-dilution formula trace" })).toBeVisible();
    const table = screen.getByRole("table", { name: "Per-column concentration and volume formula trace" });
    expect(within(table).getAllByRole("row")).toHaveLength(13);
    expect(within(table).getAllByText("5000 uM")).toHaveLength(2);
    expect(within(table).getByText("2.44140625 uM")).toBeVisible();
    expect(screen.getByText(/800 uL stock \+ 9600 uL diluent = 9600 uL retained \+ 800 uL discarded/)).toBeVisible();
  });
});
