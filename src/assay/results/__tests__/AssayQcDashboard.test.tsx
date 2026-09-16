import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  createAssayQcChartProjection,
  createAssayQcTableProjection,
} from "../../../domain-packs/assay/qc";
import { getCycle08QcGoldenFixture } from "../../../domain-packs/assay/qc/__fixtures__/cycle08QcFixture";
import { AssayQcDashboard } from "../AssayQcDashboard";

describe("AssayQcDashboard", () => {
  it("renders text status, policy boundary, chart/table parity, and formula traces", () => {
    const fixture = getCycle08QcGoldenFixture();
    const table = createAssayQcTableProjection(fixture.observationSet, fixture.evaluation);
    const chart = createAssayQcChartProjection(table);
    render(
      <AssayQcDashboard
        chart={chart}
        evaluation={fixture.evaluation}
        ruleSet={fixture.ruleSet}
        table={table}
      />,
    );
    expect(screen.getByText("Pass under this rule set")).toBeVisible();
    expect(screen.getByText(/not global assay constants/i)).toBeVisible();
    const dataTable = screen.getByRole("table", {
      name: /reviewed observation, correction, normalization, and flag data/i,
    });
    expect(within(dataTable).getAllByRole("row")).toHaveLength(table.rows.length + 1);
    expect(screen.getByText(/visual profile is supplementary/i)).toBeVisible();
    expect(screen.getByText(/Formula and evidence trace/)).toBeVisible();
  });
});
