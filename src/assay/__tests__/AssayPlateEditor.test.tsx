import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { create96WellPlateDefinition } from "../../domain-packs/assay/plate";
import type { PlateDefinition } from "../../domain-packs/assay/types";
import { AssayLibrary } from "../AssayLibrary";
import { AssayPlateEditor } from "../AssayPlateEditor";

const createPlate = () =>
  create96WellPlateDefinition({
    id: "plate-1",
    wellFactory: (coordinate) =>
      coordinate === "A1"
        ? {
            conditionRefs: ["untreated"],
            replicateGroupRefs: ["R1"],
            role: "sample",
          }
        : {},
  });

const PlateHarness = ({ onChange = vi.fn() }: { onChange?: (plate: PlateDefinition) => void }) => {
  const [plate, setPlate] = useState(createPlate);
  return (
    <AssayPlateEditor
      onPlateChange={(nextPlate) => {
        setPlate(nextPlate);
        onChange(nextPlate);
      }}
      plate={plate}
    />
  );
};

describe("AssayPlateEditor", () => {
  it("keeps orientation and every canonical coordinate visible in the semantic grid", () => {
    render(<PlateHarness />);

    expect(screen.getByLabelText(/plate orientation a1 at top left/i)).toBeInTheDocument();
    const grid = screen.getByRole("grid", { name: /96-well plate map/i });
    expect(within(grid).getAllByRole("gridcell")).toHaveLength(96);
    expect(within(grid).getByRole("button", { name: /well a1, sample, untreated, r1/i })).toBeInTheDocument();
    expect(within(grid).getByRole("button", { name: /well h12, unused/i })).toBeInTheDocument();
  });

  it("synchronizes selection between the grid and authoritative table", () => {
    render(<PlateHarness />);

    fireEvent.click(screen.getByRole("button", { name: /well b3, unused/i }));
    expect(screen.getByLabelText(/1 well selected: b3/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /accessible table/i }));

    const table = screen.getByRole("table", { name: /authoritative selection table/i });
    expect(within(table).getByRole("button", { name: /well b3, unused.*selected/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(table).getAllByRole("columnheader")).toHaveLength(13);
    expect(within(table).getAllByRole("rowheader")).toHaveLength(8);
  });

  it("supports arrow, Home, and End keyboard navigation with selection", () => {
    render(<PlateHarness />);

    const firstWell = screen.getByRole("button", { name: /well a1, sample/i });
    firstWell.focus();
    fireEvent.keyDown(firstWell, { key: "ArrowRight" });

    const secondWell = screen.getByRole("button", { name: /well a2, unused.*selected/i });
    expect(secondWell).toHaveAttribute("tabindex", "0");
    expect(screen.getByLabelText(/1 well selected: a2/i)).toBeInTheDocument();

    fireEvent.keyDown(secondWell, { key: "End" });
    const lastWell = screen.getByRole("button", { name: /well a12, unused.*selected/i });
    expect(lastWell).toHaveAttribute("tabindex", "0");

    fireEvent.keyDown(lastWell, { key: "Home" });
    expect(screen.getByRole("button", { name: /well a1, sample.*selected/i })).toHaveAttribute(
      "tabindex",
      "0",
    );
  });

  it("selects complete rows and columns from named bulk controls", () => {
    render(<PlateHarness />);

    fireEvent.click(screen.getByRole("button", { name: /select all wells in row b/i }));
    expect(screen.getByLabelText(/12 wells selected/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /well b1, unused.*selected/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /well b12, unused.*selected/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: /select all wells in column 4/i }));
    expect(screen.getByLabelText(/8 wells selected/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /well h4, unused.*selected/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("applies explicit role, condition, and replicate labels without inference", () => {
    const onChange = vi.fn();
    render(<PlateHarness onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /well c5, unused/i }));
    fireEvent.change(screen.getByRole("combobox", { name: /well role/i }), {
      target: { value: "positiveControl" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /condition label/i }), {
      target: { value: "dose-10" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /replicate group label/i }), {
      target: { value: "technical-2" },
    });
    fireEvent.click(screen.getByRole("button", { name: /apply to selected wells/i }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const changedWell = onChange.mock.calls[0][0].wells.find(
      (well: { coordinate: string }) => well.coordinate === "C5",
    );
    expect(changedWell).toMatchObject({
      role: "positiveControl",
      conditionRefs: ["dose-10"],
      replicateGroupRefs: ["technical-2"],
    });
    expect(screen.getByRole("button", { name: /well c5, positive control, dose-10, technical-2/i })).toBeInTheDocument();
  });
});

describe("AssayLibrary", () => {
  it("shows an honest empty state and accepts only assay definition scaffolding", () => {
    render(<AssayLibrary />);

    expect(screen.getByRole("heading", { name: /no assay definitions yet/i })).toBeInTheDocument();
    expect(screen.getByText(/explicit operational planning, reviewed/i)).toBeInTheDocument();
    expect(screen.getByText(/checked XTT metabolic-activity and educational broth-microdilution profiles/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/import assay definition/i)).toHaveAttribute(
      "accept",
      ".assay.json,application/json",
    );
    expect(screen.getByRole("heading", { name: /capability explorer/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/starting template/i)).toBeInTheDocument();
    expect(screen.queryByText(/run assay/i)).not.toBeInTheDocument();
  });
});
