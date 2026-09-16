import {
  absRational,
  addRational,
  compareRational,
  decimalToRational,
  divideRational,
  formatRational,
  multiplyRational,
  rational,
  subtractRational,
  type Rational,
} from "../dilution/exact";
import type { AssayQcRoundingPolicy } from "./types";

const absolute = (value: bigint): bigint => value < 0n ? -value : value;

const integerSquareRoot = (value: bigint): bigint => {
  if (value < 0n) throw new Error("Square root requires a non-negative value.");
  if (value < 2n) return value;
  let previous = value;
  let next = (previous + value / previous) / 2n;
  while (next < previous) {
    previous = next;
    next = (previous + value / previous) / 2n;
  }
  return previous;
};

const formatScaledInteger = (coefficient: bigint, scale: number): string => {
  const negative = coefficient < 0n;
  const digits = absolute(coefficient).toString().padStart(scale + 1, "0");
  const body = scale === 0 ? digits : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
  const normalized = scale === 0 ? body : body.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  return `${negative ? "-" : ""}${normalized}`;
};

export const formatQcRational = (
  value: Rational,
  policy: AssayQcRoundingPolicy,
): string => formatRational(value, {
  mode: "decimal-places",
  decimalPlaces: policy.decimalPlaces,
  tieBreaking: policy.tieBreaking,
}).value;

export const squareRootRational = (
  value: Rational,
  policy: AssayQcRoundingPolicy,
): string => {
  if (value.numerator < 0n) throw new Error("Square root requires a non-negative value.");
  const scale = policy.decimalPlaces;
  const scaleFactorSquared = 10n ** BigInt(scale * 2);
  const floorSquared = value.numerator * scaleFactorSquared / value.denominator;
  let root = integerSquareRoot(floorSquared);
  const midpointNumerator = value.denominator * ((2n * root + 1n) ** 2n);
  const exactScaledNumerator = 4n * value.numerator * scaleFactorSquared;
  const aboveMidpoint = exactScaledNumerator > midpointNumerator;
  const atMidpoint = exactScaledNumerator === midpointNumerator;
  if (aboveMidpoint || (atMidpoint && (
    policy.tieBreaking === "half-up" || root % 2n === 1n
  ))) root += 1n;
  return formatScaledInteger(root, scale);
};

export const meanRational = (values: readonly Rational[]): Rational => {
  if (values.length === 0) throw new Error("Mean requires at least one value.");
  return divideRational(
    values.reduce((total, value) => addRational(total, value), rational(0n)),
    rational(BigInt(values.length)),
  );
};

export const medianRational = (values: readonly Rational[]): Rational => {
  if (values.length === 0) throw new Error("Median requires at least one value.");
  const ordered = [...values].sort(compareRational);
  const midpoint = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 1
    ? ordered[midpoint]
    : divideRational(addRational(ordered[midpoint - 1], ordered[midpoint]), rational(2n));
};

export const rangeRational = (values: readonly Rational[]): Rational => {
  if (values.length === 0) throw new Error("Range requires at least one value.");
  const ordered = [...values].sort(compareRational);
  return subtractRational(ordered.at(-1)!, ordered[0]);
};

export const sampleVarianceRational = (values: readonly Rational[]): Rational => {
  if (values.length < 2) throw new Error("Sample variance requires at least two values.");
  const mean = meanRational(values);
  const squaredDifferences = values.map((value) => {
    const difference = subtractRational(value, mean);
    return multiplyRational(difference, difference);
  });
  return divideRational(
    squaredDifferences.reduce((total, value) => addRational(total, value), rational(0n)),
    rational(BigInt(values.length - 1)),
  );
};

export const standardDeviation = (
  values: readonly Rational[],
  policy: AssayQcRoundingPolicy,
): string => squareRootRational(sampleVarianceRational(values), policy);

export const coefficientOfVariation = (
  values: readonly Rational[],
  policy: AssayQcRoundingPolicy,
): string => {
  const mean = meanRational(values);
  if (mean.numerator === 0n) throw new Error("Coefficient of variation is indeterminate when the mean is zero.");
  const sd = decimalToRational(standardDeviation(values, policy));
  return formatQcRational(
    multiplyRational(divideRational(sd, absRational(mean)), rational(100n)),
    policy,
  );
};

export const linearRegressionSlope = (
  points: ReadonlyArray<{ x: Rational; y: Rational }>,
): Rational => {
  if (points.length < 2) throw new Error("Linear drift requires at least two points.");
  const meanX = meanRational(points.map(({ x }) => x));
  const meanY = meanRational(points.map(({ y }) => y));
  const numerator = points.reduce(
    (total, { x, y }) => addRational(
      total,
      multiplyRational(subtractRational(x, meanX), subtractRational(y, meanY)),
    ),
    rational(0n),
  );
  const denominator = points.reduce(
    (total, { x }) => {
      const difference = subtractRational(x, meanX);
      return addRational(total, multiplyRational(difference, difference));
    },
    rational(0n),
  );
  if (denominator.numerator === 0n) throw new Error("Linear drift is indeterminate when all axis positions are equal.");
  return divideRational(numerator, denominator);
};
