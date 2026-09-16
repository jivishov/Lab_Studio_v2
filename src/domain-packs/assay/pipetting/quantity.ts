import {
  addDecimal,
  compareDecimal,
  formatDecimal,
  isNonNegativeDecimal,
  multiplyDecimalByInteger,
  multiplyDecimalByRatio,
  multiplyDecimal,
  parseDecimal,
  subtractDecimal,
  type ExactDecimal,
} from "../../../platform/planning/decimal";
import { convertQuantity } from "../../../platform/planning/units";
import type { AssayQuantity, WellComponentState, WellState } from "../types";

const alignCoefficient = (value: ExactDecimal, scale: number): bigint =>
  value.coefficient * (10n ** BigInt(scale - value.scale));

export const toMicroliters = (quantity: AssayQuantity): AssayQuantity => {
  const converted = convertQuantity(quantity, "uL");
  const value = parseDecimal(converted.value);
  if (!isNonNegativeDecimal(value)) throw new Error("Volume cannot be negative.");
  return converted;
};

export const addVolumes = (left: AssayQuantity, right: AssayQuantity): AssayQuantity => ({
  value: formatDecimal(addDecimal(parseDecimal(toMicroliters(left).value), parseDecimal(toMicroliters(right).value))),
  unit: "uL",
});

export const subtractVolumes = (left: AssayQuantity, right: AssayQuantity): AssayQuantity => {
  const result = subtractDecimal(parseDecimal(toMicroliters(left).value), parseDecimal(toMicroliters(right).value));
  if (!isNonNegativeDecimal(result)) throw new Error("Volume subtraction cannot produce a negative result.");
  return { value: formatDecimal(result), unit: "uL" };
};

export const multiplyVolume = (quantity: AssayQuantity, multiplier: number): AssayQuantity => ({
  value: formatDecimal(multiplyDecimalByInteger(parseDecimal(toMicroliters(quantity).value), multiplier)),
  unit: "uL",
});

export const compareVolumes = (left: AssayQuantity, right: AssayQuantity): -1 | 0 | 1 =>
  compareDecimal(parseDecimal(toMicroliters(left).value), parseDecimal(toMicroliters(right).value));

export const isVolumeIncrementAligned = (
  value: AssayQuantity,
  minimum: AssayQuantity,
  increment: AssayQuantity,
): boolean => {
  const parsedValue = parseDecimal(toMicroliters(value).value);
  const parsedMinimum = parseDecimal(toMicroliters(minimum).value);
  const parsedIncrement = parseDecimal(toMicroliters(increment).value);
  if (parsedIncrement.coefficient <= 0n) return false;
  const scale = Math.max(parsedValue.scale, parsedMinimum.scale, parsedIncrement.scale);
  const difference = alignCoefficient(parsedValue, scale) - alignCoefficient(parsedMinimum, scale);
  const step = alignCoefficient(parsedIncrement, scale);
  return difference >= 0n && difference % step === 0n;
};

export const scaleVolume = (
  quantity: AssayQuantity,
  numerator: AssayQuantity,
  denominator: AssayQuantity,
): AssayQuantity => {
  const numeratorDecimal = parseDecimal(toMicroliters(numerator).value);
  const denominatorDecimal = parseDecimal(toMicroliters(denominator).value);
  if (denominatorDecimal.coefficient === 0n) throw new Error("Cannot scale a volume from an empty source.");
  const ratioScale = Math.max(numeratorDecimal.scale, denominatorDecimal.scale);
  const ratioNumerator = alignCoefficient(numeratorDecimal, ratioScale);
  const ratioDenominator = alignCoefficient(denominatorDecimal, ratioScale);
  return {
    value: formatDecimal(multiplyDecimalByRatio(
      parseDecimal(toMicroliters(quantity).value),
      ratioNumerator,
      ratioDenominator,
    )),
    unit: "uL",
  };
};

export const scaleComponents = (
  components: readonly WellComponentState[],
  numerator: AssayQuantity,
  denominator: AssayQuantity,
): WellComponentState[] => components.map((component) => ({
  ...structuredClone(component),
  volume: scaleVolume(component.volume, numerator, denominator),
}));

const componentKey = (component: WellComponentState): string => JSON.stringify({
  resourceRef: component.resourceRef,
  concentration: component.concentration ?? null,
  sourceRefs: [...component.sourceRefs].sort(),
});

export const mergeComponents = (components: readonly WellComponentState[]): WellComponentState[] => {
  const merged = new Map<string, WellComponentState>();
  for (const component of components) {
    const normalized = { ...structuredClone(component), volume: toMicroliters(component.volume), sourceRefs: [...component.sourceRefs].sort() };
    const key = componentKey(normalized);
    const previous = merged.get(key);
    merged.set(key, previous
      ? { ...previous, volume: addVolumes(previous.volume, normalized.volume) }
      : normalized);
  }
  return [...merged.values()].sort((left, right) => componentKey(left).localeCompare(componentKey(right)));
};

/** Exact amount-weighted concentration projection; no rounding is applied. */
export const calculateWellResourceConcentration = (
  well: Pick<WellState, "volume" | "components">,
  resourceRef: string,
): AssayQuantity | null => {
  const totalVolume = parseDecimal(toMicroliters(well.volume).value);
  if (totalVolume.coefficient === 0n) return null;
  let weightedAmount = parseDecimal("0");
  let found = false;
  for (const component of well.components) {
    if (component.resourceRef !== resourceRef || !component.concentration) continue;
    const concentration = parseDecimal(convertQuantity(component.concentration, "uM").value);
    const componentVolume = parseDecimal(toMicroliters(component.volume).value);
    weightedAmount = addDecimal(weightedAmount, multiplyDecimal(concentration, componentVolume));
    found = true;
  }
  if (!found) return null;
  return {
    value: formatDecimal(multiplyDecimalByRatio(
      weightedAmount,
      10n ** BigInt(totalVolume.scale),
      totalVolume.coefficient,
    )),
    unit: "uM",
  };
};
