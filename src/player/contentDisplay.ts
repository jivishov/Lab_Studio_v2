import type { ContentState, EquipmentDefinition } from "../domain/types";

const formatNumber = (value: number, digits = 1): string =>
  Number.isInteger(value) ? value.toFixed(0) : value.toFixed(digits);

export const formatRecordedTemperature = (
  recorded: NonNullable<ContentState["recordedTemperature"]>,
): string => `${recorded.valueC.toFixed(recorded.precision)} °C`;

const lowerFirst = (value = ""): string =>
  value.length === 0 ? value : `${value[0].toLowerCase()}${value.slice(1)}`;

const displayVolumeMl = (contents: ContentState): number | undefined =>
  typeof contents.volumeMl === "number"
    ? contents.volumeMl
    : typeof contents.finalVolumeMl === "number"
      ? contents.finalVolumeMl
      : undefined;

/**
 * Lid state for apparatus that models one. `EquipmentView` feeds this same string to the visible
 * bench caption and to the button's accessible name, so the closure is announced and readable from
 * one place rather than only through the label of whichever control happens to be on screen.
 */
export const formatClosureLabel = (contents: ContentState): string | undefined =>
  contents.developingChamberClosed === undefined
    ? undefined
    : contents.developingChamberClosed
      ? "closed (sealed)"
      : "open";

const withClosure = (contents: ContentState, base: string): string => {
  const closure = formatClosureLabel(contents);
  return closure ? `${base}, ${closure}` : base;
};

export const formatContentLabel = (contents: ContentState): string => {
  if (contents.kind === "empty") return withClosure(contents, "empty");
  if (contents.chromatogram?.solventFrontMm) return withClosure(contents, "developed chromatogram");
  if (contents.chromatogram?.spotted) return withClosure(contents, "spotted sample");
  const volumeMl = displayVolumeMl(contents);
  if (typeof volumeMl === "number") {
    const label = lowerFirst(contents.label);
    return withClosure(
      contents,
      label ? `${formatNumber(volumeMl)} mL ${label}` : `${formatNumber(volumeMl)} mL`,
    );
  }
  return withClosure(contents, contents.label ?? contents.kind);
};

export const contentFillPercent = (
  contents: ContentState,
  definition: EquipmentDefinition,
): number | undefined => {
  const volumeMl = displayVolumeMl(contents);
  if (typeof volumeMl !== "number" || definition.capacity.unit !== "mL") {
    return undefined;
  }
  if (definition.capacity.amount <= 0) return undefined;
  return Math.min(100, Math.max(0, (volumeMl / definition.capacity.amount) * 100));
};

export const contentFillFraction = (
  contents: ContentState,
  definition: EquipmentDefinition,
): number | undefined => {
  const volumeMl = displayVolumeMl(contents);
  if (typeof volumeMl !== "number" || definition.capacity.unit !== "mL") {
    return undefined;
  }
  if (definition.capacity.amount <= 0) return undefined;
  return Math.max(0, volumeMl / definition.capacity.amount);
};

export const isOverCapacity = (
  contents: ContentState,
  definition: EquipmentDefinition,
): boolean =>
  typeof displayVolumeMl(contents) === "number" &&
  definition.capacity.unit === "mL" &&
  definition.capacity.amount > 0 &&
  (displayVolumeMl(contents) ?? 0) > definition.capacity.amount;

export const isVisibleLiquid = (contents: ContentState): boolean =>
  contents.kind === "liquid" || contents.kind === "solution" || contents.kind === "mixture";

export const isVisiblePrecipitate = (contents: ContentState): boolean =>
  contents.kind === "precipitate" || Boolean(contents.precipitate);

export const isVisibleSolidContent = (contents: ContentState): boolean =>
  contents.kind === "solid" || isVisiblePrecipitate(contents);
