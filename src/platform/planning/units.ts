import type { ControlledUnitId } from "../procedure-ir/types";
import {
  formatDecimal,
  multiplyDecimalByRatio,
  parseDecimal,
} from "./decimal";
import type { Quantity } from "./types";

type Dimension = "count" | "ratio" | "time" | "volume" | "mass" | "amount" | "concentration" | "temperature" | "speed" | "length" | "signal" | "acidity";

interface UnitDefinition {
  dimension: Dimension;
  canonical: ControlledUnitId;
  numerator: bigint;
  denominator: bigint;
}

const unit = (
  dimension: Dimension,
  canonical: ControlledUnitId,
  numerator = 1n,
  denominator = 1n,
): UnitDefinition => ({ dimension, canonical, numerator, denominator });

export const controlledUnitRegistry: Record<ControlledUnitId, UnitDefinition> = {
  "1": unit("count", "1"),
  "%": unit("ratio", "%"),
  s: unit("time", "s"),
  min: unit("time", "s", 60n),
  h: unit("time", "s", 3600n),
  uL: unit("volume", "uL"),
  mL: unit("volume", "uL", 1000n),
  L: unit("volume", "uL", 1_000_000n),
  ug: unit("mass", "ug"),
  mg: unit("mass", "ug", 1000n),
  g: unit("mass", "ug", 1_000_000n),
  kg: unit("mass", "ug", 1_000_000_000n),
  umol: unit("amount", "umol"),
  mmol: unit("amount", "umol", 1000n),
  mol: unit("amount", "umol", 1_000_000n),
  uM: unit("concentration", "uM"),
  mM: unit("concentration", "uM", 1000n),
  M: unit("concentration", "uM", 1_000_000n),
  degC: unit("temperature", "degC"),
  K: unit("temperature", "K"),
  rpm: unit("speed", "rpm"),
  nm: unit("length", "nm"),
  AU: unit("signal", "AU"),
  OD: unit("signal", "OD"),
  pH: unit("acidity", "pH"),
};

export const convertQuantity = (quantity: Quantity, targetUnit: ControlledUnitId): Quantity => {
  const source = controlledUnitRegistry[quantity.unit];
  const target = controlledUnitRegistry[targetUnit];
  if (source.dimension !== target.dimension || source.dimension === "temperature") {
    if (quantity.unit === targetUnit) return { value: formatDecimal(parseDecimal(quantity.value)), unit: targetUnit };
    throw new Error(`Units ${quantity.unit} and ${targetUnit} are not exactly convertible.`);
  }
  const converted = multiplyDecimalByRatio(
    parseDecimal(quantity.value),
    source.numerator * target.denominator,
    source.denominator * target.numerator,
  );
  return { value: formatDecimal(converted), unit: targetUnit };
};

export const normalizeQuantity = (quantity: Quantity): Quantity => convertQuantity(
  quantity,
  controlledUnitRegistry[quantity.unit].canonical,
);

export const quantitiesAreCompatible = (left: Quantity, right: Quantity): boolean =>
  controlledUnitRegistry[left.unit].dimension === controlledUnitRegistry[right.unit].dimension
  && (left.unit === right.unit || controlledUnitRegistry[left.unit].dimension !== "temperature");
