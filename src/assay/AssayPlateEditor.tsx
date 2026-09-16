import {
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Grid3X3, Table2 } from "lucide-react";
import type {
  PlateDefinition,
  WellDefinition,
  WellRole,
} from "../domain-packs/assay/types";
import {
  WELL_COLUMNS_96,
  WELL_COORDINATES_96,
  WELL_ROWS_96,
  isCanonical96WellCoordinate,
  move96WellCoordinate,
} from "../domain-packs/assay/plate";
import "./assay.css";

const WELL_ROLE_LABELS: Record<WellRole, string> = {
  sample: "Sample",
  standard: "Standard",
  blank: "Blank",
  negativeControl: "Negative control",
  positiveControl: "Positive control",
  vehicleControl: "Vehicle control",
  growthControl: "Growth control",
  sterilityControl: "Sterility control",
  qualityControl: "Quality control",
  edgeBuffer: "Edge buffer",
  unused: "Unused",
};

const WELL_ROLE_CODES: Record<WellRole, string> = {
  sample: "S",
  standard: "STD",
  blank: "BLK",
  negativeControl: "−C",
  positiveControl: "+C",
  vehicleControl: "VC",
  growthControl: "GC",
  sterilityControl: "SC",
  qualityControl: "QC",
  edgeBuffer: "EB",
  unused: "—",
};

const WELL_ROLES = Object.keys(WELL_ROLE_LABELS) as WellRole[];

export type PlateSelectionProps = {
  activeCoordinate: string;
  onBulkSelect: (coordinates: readonly string[]) => void;
  onNavigate: (coordinate: string, event: KeyboardEvent<HTMLButtonElement>) => void;
  onSelect: (coordinate: string, extendSelection: boolean) => void;
  plate: PlateDefinition;
  selectedCoordinates: ReadonlySet<string>;
  wellButtonRefs?: React.MutableRefObject<Map<string, HTMLButtonElement>>;
};

const summarizeReferences = (references: readonly string[], fallback: string) =>
  references.length > 0 ? references.join(", ") : fallback;

const describeWell = (well: WellDefinition, selected: boolean) => {
  const condition = summarizeReferences(well.conditionRefs, "no condition");
  const replicate = summarizeReferences(well.replicateGroupRefs, "no replicate group");
  return `Well ${well.coordinate}, ${WELL_ROLE_LABELS[well.role]}, ${condition}, ${replicate}${
    selected ? ", selected" : ""
  }`;
};

const WellContents = ({ well }: { well: WellDefinition }) => (
  <>
    <strong>{well.coordinate}</strong>
    <span className="assay-well__role" aria-hidden="true">
      {WELL_ROLE_CODES[well.role]}
    </span>
    <span className="assay-well__detail" aria-hidden="true">
      {well.conditionRefs[0] ?? "No condition"}
    </span>
    {well.replicateGroupRefs[0] && (
      <span className="assay-well__replicate" aria-hidden="true">
        {well.replicateGroupRefs[0]}
      </span>
    )}
  </>
);

const selectionIsComplete = (
  coordinates: readonly string[],
  selectedCoordinates: ReadonlySet<string>,
) => coordinates.every((coordinate) => selectedCoordinates.has(coordinate));

const getCoordinatesForRow = (row: string) =>
  WELL_COLUMNS_96.map((column) => `${row}${column}`);

const getCoordinatesForColumn = (column: number) =>
  WELL_ROWS_96.map((row) => `${row}${column}`);

export const AssayPlateGrid = ({
  activeCoordinate,
  onBulkSelect,
  onNavigate,
  onSelect,
  plate,
  selectedCoordinates,
  wellButtonRefs,
}: PlateSelectionProps) => {
  const wells = useMemo(
    () => new Map(plate.wells.map((well) => [well.coordinate, well])),
    [plate.wells],
  );

  return (
    <div
      aria-label="96-well plate map"
      aria-multiselectable="true"
      className="assay-plate-grid"
      role="grid"
    >
      <div className="assay-plate-grid__header-row" role="row">
        <div className="assay-plate-grid__corner" role="columnheader">
          <span>A1</span>
          <span aria-hidden="true">↘</span>
        </div>
        {WELL_COLUMNS_96.map((column) => {
          const coordinates = getCoordinatesForColumn(column);
          const isSelected = selectionIsComplete(coordinates, selectedCoordinates);
          return (
            <div className="assay-plate-grid__column-header" key={column} role="columnheader">
              <button
                aria-label={`Select all wells in column ${column}`}
                aria-pressed={isSelected}
                onClick={() => onBulkSelect(coordinates)}
                type="button"
              >
                {column}
              </button>
            </div>
          );
        })}
      </div>

      {WELL_ROWS_96.map((row) => {
        const coordinates = getCoordinatesForRow(row);
        const isSelected = selectionIsComplete(coordinates, selectedCoordinates);
        return (
          <div className="assay-plate-grid__row" key={row} role="row">
            <div className="assay-plate-grid__row-header" role="rowheader">
              <button
                aria-label={`Select all wells in row ${row}`}
                aria-pressed={isSelected}
                onClick={() => onBulkSelect(coordinates)}
                type="button"
              >
                {row}
              </button>
            </div>
            {coordinates.map((coordinate) => {
              const well = wells.get(coordinate);
              if (!well) return null;
              const isSelected = selectedCoordinates.has(coordinate);
              return (
                <div
                  aria-colindex={Number.parseInt(coordinate.slice(1), 10) + 1}
                  aria-selected={isSelected}
                  className="assay-plate-grid__cell"
                  key={coordinate}
                  role="gridcell"
                >
                  <button
                    aria-label={describeWell(well, isSelected)}
                    aria-pressed={isSelected}
                    className="assay-well assay-well--grid"
                    data-role={well.role}
                    data-well-coordinate={coordinate}
                    onClick={(event: MouseEvent<HTMLButtonElement>) =>
                      onSelect(coordinate, event.ctrlKey || event.metaKey || event.shiftKey)
                    }
                    onKeyDown={(event) => onNavigate(coordinate, event)}
                    ref={(node) => {
                      if (!wellButtonRefs) return;
                      if (node) wellButtonRefs.current.set(coordinate, node);
                      else wellButtonRefs.current.delete(coordinate);
                    }}
                    tabIndex={coordinate === activeCoordinate ? 0 : -1}
                    title={describeWell(well, isSelected)}
                    type="button"
                  >
                    <WellContents well={well} />
                  </button>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export const AssayPlateTable = ({
  activeCoordinate,
  onBulkSelect,
  onNavigate,
  onSelect,
  plate,
  selectedCoordinates,
  wellButtonRefs,
}: PlateSelectionProps) => {
  const wells = useMemo(
    () => new Map(plate.wells.map((well) => [well.coordinate, well])),
    [plate.wells],
  );

  return (
    <div className="assay-plate-table-scroll">
      <table className="assay-plate-table">
        <caption>
          Authoritative selection table for the 96-well plate. Orientation A1 at top left.
        </caption>
        <thead>
          <tr>
            <th scope="col">Row</th>
            {WELL_COLUMNS_96.map((column) => {
              const coordinates = getCoordinatesForColumn(column);
              return (
                <th key={column} scope="col">
                  <button
                    aria-label={`Select all wells in column ${column}`}
                    aria-pressed={selectionIsComplete(coordinates, selectedCoordinates)}
                    onClick={() => onBulkSelect(coordinates)}
                    type="button"
                  >
                    {column}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {WELL_ROWS_96.map((row) => {
            const coordinates = getCoordinatesForRow(row);
            return (
              <tr key={row}>
                <th scope="row">
                  <button
                    aria-label={`Select all wells in row ${row}`}
                    aria-pressed={selectionIsComplete(coordinates, selectedCoordinates)}
                    onClick={() => onBulkSelect(coordinates)}
                    type="button"
                  >
                    {row}
                  </button>
                </th>
                {coordinates.map((coordinate) => {
                  const well = wells.get(coordinate);
                  if (!well) return null;
                  const isSelected = selectedCoordinates.has(coordinate);
                  return (
                    <td key={coordinate}>
                      <button
                        aria-label={describeWell(well, isSelected)}
                        aria-pressed={isSelected}
                        className="assay-well assay-well--table"
                        data-role={well.role}
                        data-well-coordinate={coordinate}
                        onClick={(event: MouseEvent<HTMLButtonElement>) =>
                          onSelect(coordinate, event.ctrlKey || event.metaKey || event.shiftKey)
                        }
                        onKeyDown={(event) => onNavigate(coordinate, event)}
                        ref={(node) => {
                          if (!wellButtonRefs) return;
                          if (node) wellButtonRefs.current.set(coordinate, node);
                          else wellButtonRefs.current.delete(coordinate);
                        }}
                        tabIndex={coordinate === activeCoordinate ? 0 : -1}
                        type="button"
                      >
                        <WellContents well={well} />
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export type AssayPlateEditorProps = {
  onPlateChange: (plate: PlateDefinition) => void;
  plate: PlateDefinition;
};

type PlateView = "grid" | "table";

export const AssayPlateEditor = ({ onPlateChange, plate }: AssayPlateEditorProps) => {
  const firstCoordinate = plate.wells[0]?.coordinate ?? WELL_COORDINATES_96[0];
  const [activeCoordinate, setActiveCoordinate] = useState(firstCoordinate);
  const [selectedCoordinates, setSelectedCoordinates] = useState<Set<string>>(
    () => new Set([firstCoordinate]),
  );
  const [view, setView] = useState<PlateView>("grid");
  const wellButtonRefs = useRef(new Map<string, HTMLButtonElement>());

  const orderedSelection = WELL_COORDINATES_96.filter((coordinate) =>
    selectedCoordinates.has(coordinate),
  );
  const referenceWell = plate.wells.find(
    (well) => well.coordinate === orderedSelection[0],
  );
  const [role, setRole] = useState<WellRole>(referenceWell?.role ?? "unused");
  const [conditionLabel, setConditionLabel] = useState(
    referenceWell?.conditionRefs.join(", ") ?? "",
  );
  const [replicateLabel, setReplicateLabel] = useState(
    referenceWell?.replicateGroupRefs.join(", ") ?? "",
  );

  useEffect(() => {
    if (!referenceWell) return;
    setRole(referenceWell.role);
    setConditionLabel(referenceWell.conditionRefs.join(", "));
    setReplicateLabel(referenceWell.replicateGroupRefs.join(", "));
  }, [referenceWell?.coordinate, referenceWell?.role]);

  const selectCoordinate = (coordinate: string, extendSelection: boolean) => {
    setActiveCoordinate(coordinate);
    setSelectedCoordinates((current) => {
      if (!extendSelection) return new Set([coordinate]);
      const next = new Set(current);
      if (next.has(coordinate) && next.size > 1) next.delete(coordinate);
      else next.add(coordinate);
      return next;
    });
  };

  const toggleBulkSelection = (coordinates: readonly string[]) => {
    setSelectedCoordinates((current) => {
      if (selectionIsComplete(coordinates, current)) {
        const next = new Set(current);
        coordinates.forEach((coordinate) => next.delete(coordinate));
        return next.size > 0 ? next : new Set([activeCoordinate]);
      }
      return new Set(coordinates);
    });
    setActiveCoordinate(coordinates[0] ?? activeCoordinate);
  };

  const navigate = (coordinate: string, event: KeyboardEvent<HTMLButtonElement>) => {
    if (!isCanonical96WellCoordinate(coordinate)) return;
    let destination: string | null = null;
    if (event.key === "ArrowUp") destination = move96WellCoordinate(coordinate, -1, 0);
    if (event.key === "ArrowDown") destination = move96WellCoordinate(coordinate, 1, 0);
    if (event.key === "ArrowLeft") destination = move96WellCoordinate(coordinate, 0, -1);
    if (event.key === "ArrowRight") destination = move96WellCoordinate(coordinate, 0, 1);
    if (event.key === "Home") destination = `${coordinate[0]}1`;
    if (event.key === "End") destination = `${coordinate[0]}12`;
    if (!destination) return;
    event.preventDefault();
    selectCoordinate(destination, event.shiftKey);
    const focusDestination = () => wellButtonRefs.current.get(destination)?.focus();
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(focusDestination);
    } else {
      focusDestination();
    }
  };

  const applyLabels = () => {
    const conditionRefs = conditionLabel
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const replicateGroupRefs = replicateLabel
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    onPlateChange({
      ...plate,
      wells: plate.wells.map((well) =>
        selectedCoordinates.has(well.coordinate)
          ? { ...well, conditionRefs, replicateGroupRefs, role }
          : well,
      ),
    });
  };

  const selectionProps: PlateSelectionProps = {
    activeCoordinate,
    onBulkSelect: toggleBulkSelection,
    onNavigate: navigate,
    onSelect: selectCoordinate,
    plate,
    selectedCoordinates,
    wellButtonRefs,
  };

  return (
    <section className="assay-plate-editor" aria-labelledby="assay-plate-editor-title">
      <header className="assay-plate-editor__header">
        <div>
          <span className="assay-eyebrow">Plate map · 96 wells</span>
          <h2 id="assay-plate-editor-title">Define the experimental layout</h2>
          <p>
            Select a well or use a row/column header for bulk assignment. Hold Shift, Control,
            or Command to extend a selection.
          </p>
        </div>
        <div className="assay-orientation" aria-label="Plate orientation A1 at top left">
          <span aria-hidden="true">A1</span>
          <strong>A1 top left</strong>
          <small>rows A–H · columns 1–12</small>
        </div>
      </header>

      <div className="assay-plate-editor__toolbar">
        <div aria-label="Plate view" className="assay-view-toggle" role="group">
          <button
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
            type="button"
          >
            <Grid3X3 aria-hidden="true" size={16} />
            Plate grid
          </button>
          <button
            aria-pressed={view === "table"}
            onClick={() => setView("table")}
            type="button"
          >
            <Table2 aria-hidden="true" size={16} />
            Accessible table
          </button>
        </div>
        <p
          aria-label={`${selectedCoordinates.size} ${selectedCoordinates.size === 1 ? "well" : "wells"} selected${
            orderedSelection.length > 0 ? `: ${orderedSelection.join(", ")}` : ""
          }`}
          aria-live="polite"
          className="assay-selection-summary"
        >
          <strong>{selectedCoordinates.size}</strong>{" "}
          {selectedCoordinates.size === 1 ? "well" : "wells"} selected
          {orderedSelection.length > 0 && <span> · {orderedSelection.join(", ")}</span>}
        </p>
      </div>

      <div className="assay-plate-editor__workspace">
        <div className="assay-plate-canvas">
          {view === "grid" ? (
            <AssayPlateGrid {...selectionProps} />
          ) : (
            <AssayPlateTable {...selectionProps} />
          )}
          <div className="assay-role-legend" aria-label="Well role legend">
            {WELL_ROLES.filter((candidate) => candidate !== "unused").map((candidate) => (
              <span data-role={candidate} key={candidate}>
                <i aria-hidden="true" />
                {WELL_ROLE_LABELS[candidate]}
              </span>
            ))}
          </div>
        </div>

        <aside className="assay-well-inspector" aria-labelledby="assay-well-inspector-title">
          <div className="assay-well-inspector__heading">
            <span className="assay-eyebrow">Selection inspector</span>
            <h3 id="assay-well-inspector-title">
              {orderedSelection.length === 1 ? orderedSelection[0] : `${orderedSelection.length} wells`}
            </h3>
            <p>Assignments apply to every selected well.</p>
          </div>

          <label>
            Well role
            <select value={role} onChange={(event) => setRole(event.target.value as WellRole)}>
              {WELL_ROLES.map((candidate) => (
                <option key={candidate} value={candidate}>
                  {WELL_ROLE_LABELS[candidate]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Condition label or reference
            <input
              onChange={(event) => setConditionLabel(event.target.value)}
              placeholder="e.g. untreated"
              type="text"
              value={conditionLabel}
            />
            <small>Separate multiple references with commas.</small>
          </label>
          <label>
            Replicate group label or reference
            <input
              onChange={(event) => setReplicateLabel(event.target.value)}
              placeholder="e.g. R1"
              type="text"
              value={replicateLabel}
            />
            <small>Labels remain explicit; the editor does not infer membership.</small>
          </label>
          <button
            className="assay-primary-action"
            disabled={selectedCoordinates.size === 0}
            onClick={applyLabels}
            type="button"
          >
            Apply to selected wells
          </button>
        </aside>
      </div>
    </section>
  );
};
