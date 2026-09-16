import { parseDecimal } from "../../../platform/planning/decimal";
import type { DilutionRoundingPolicy } from "./types";

export interface Rational {
  numerator: bigint;
  denominator: bigint;
}

const abs = (value: bigint): bigint => value < 0n ? -value : value;

const gcd = (left: bigint, right: bigint): bigint => {
  let a = abs(left);
  let b = abs(right);
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
};

export const rational = (numerator: bigint, denominator = 1n): Rational => {
  if (denominator === 0n) throw new Error("Division by zero.");
  const sign = denominator < 0n ? -1n : 1n;
  const divisor = gcd(numerator, denominator);
  return {
    numerator: sign * numerator / divisor,
    denominator: sign * denominator / divisor,
  };
};

export const decimalToRational = (value: string): Rational => {
  const parsed = parseDecimal(value);
  return rational(parsed.coefficient, 10n ** BigInt(parsed.scale));
};

export const addRational = (left: Rational, right: Rational): Rational => rational(
  left.numerator * right.denominator + right.numerator * left.denominator,
  left.denominator * right.denominator,
);

export const subtractRational = (left: Rational, right: Rational): Rational => rational(
  left.numerator * right.denominator - right.numerator * left.denominator,
  left.denominator * right.denominator,
);

export const multiplyRational = (left: Rational, right: Rational): Rational => rational(
  left.numerator * right.numerator,
  left.denominator * right.denominator,
);

export const divideRational = (left: Rational, right: Rational): Rational => rational(
  left.numerator * right.denominator,
  left.denominator * right.numerator,
);

export const compareRational = (left: Rational, right: Rational): -1 | 0 | 1 => {
  const difference = left.numerator * right.denominator - right.numerator * left.denominator;
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
};

export const absRational = (value: Rational): Rational => rational(abs(value.numerator), value.denominator);

export interface FormattedRational {
  value: string;
  rounded: boolean;
}

const finiteDecimalPlaces = (value: Rational): number | null => {
  let denominator = value.denominator;
  let twos = 0;
  let fives = 0;
  while (denominator % 2n === 0n) {
    denominator /= 2n;
    twos += 1;
  }
  while (denominator % 5n === 0n) {
    denominator /= 5n;
    fives += 1;
  }
  return denominator === 1n ? Math.max(twos, fives) : null;
};

const formatScaledInteger = (coefficient: bigint, scale: number): string => {
  const negative = coefficient < 0n;
  const digits = abs(coefficient).toString().padStart(scale + 1, "0");
  const body = scale === 0 ? digits : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
  const normalized = scale === 0 ? body : body.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  return `${negative ? "-" : ""}${normalized}`;
};

export const formatRational = (
  value: Rational,
  policy: DilutionRoundingPolicy,
): FormattedRational => {
  const finitePlaces = finiteDecimalPlaces(value);
  if (finitePlaces !== null
    && (policy.mode === "reject-non-terminating" || finitePlaces <= policy.decimalPlaces)) {
    const scaled = value.numerator * (10n ** BigInt(finitePlaces)) / value.denominator;
    return { value: formatScaledInteger(scaled, finitePlaces), rounded: false };
  }
  if (policy.mode === "reject-non-terminating") {
    throw new Error("Exact result has no finite decimal representation; an explicit rounding policy is required.");
  }
  const scale = policy.decimalPlaces;
  const multiplier = 10n ** BigInt(scale);
  const scaledNumerator = value.numerator * multiplier;
  let quotient = scaledNumerator / value.denominator;
  const remainder = abs(scaledNumerator % value.denominator);
  const comparison = remainder * 2n - value.denominator;
  const roundAway = comparison > 0n
    || (comparison === 0n && (
      policy.tieBreaking === "half-up" || abs(quotient) % 2n === 1n
    ));
  if (roundAway) quotient += value.numerator < 0n ? -1n : 1n;
  return { value: formatScaledInteger(quotient, scale), rounded: true };
};
