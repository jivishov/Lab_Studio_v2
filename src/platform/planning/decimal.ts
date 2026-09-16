export interface ExactDecimal {
  coefficient: bigint;
  scale: number;
}

const decimalPattern = /^([+-]?)(\d+)(?:\.(\d+))?$/;

const normalize = (value: ExactDecimal): ExactDecimal => {
  let { coefficient, scale } = value;
  while (scale > 0 && coefficient % 10n === 0n) {
    coefficient /= 10n;
    scale -= 1;
  }
  return { coefficient, scale };
};

export const parseDecimal = (value: string): ExactDecimal => {
  const match = decimalPattern.exec(value);
  if (!match) throw new Error(`Invalid decimal string: ${value}`);
  const [, sign, whole, fraction = ""] = match;
  const coefficient = BigInt(`${sign === "-" ? "-" : ""}${whole}${fraction}`);
  return normalize({ coefficient, scale: fraction.length });
};

export const formatDecimal = (input: ExactDecimal): string => {
  const { coefficient, scale } = normalize(input);
  const negative = coefficient < 0n;
  const digits = (negative ? -coefficient : coefficient).toString().padStart(scale + 1, "0");
  const body = scale === 0
    ? digits
    : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
  return `${negative ? "-" : ""}${body}`;
};

const align = (left: ExactDecimal, right: ExactDecimal): [bigint, bigint, number] => {
  const scale = Math.max(left.scale, right.scale);
  return [
    left.coefficient * (10n ** BigInt(scale - left.scale)),
    right.coefficient * (10n ** BigInt(scale - right.scale)),
    scale,
  ];
};

export const addDecimal = (left: ExactDecimal, right: ExactDecimal): ExactDecimal => {
  const [a, b, scale] = align(left, right);
  return normalize({ coefficient: a + b, scale });
};

export const subtractDecimal = (left: ExactDecimal, right: ExactDecimal): ExactDecimal => {
  const [a, b, scale] = align(left, right);
  return normalize({ coefficient: a - b, scale });
};

export const multiplyDecimal = (left: ExactDecimal, right: ExactDecimal): ExactDecimal => normalize({
  coefficient: left.coefficient * right.coefficient,
  scale: left.scale + right.scale,
});

export const multiplyDecimalByInteger = (value: ExactDecimal, multiplier: number): ExactDecimal => {
  if (!Number.isSafeInteger(multiplier)) throw new Error("Decimal multipliers must be safe integers.");
  return normalize({ coefficient: value.coefficient * BigInt(multiplier), scale: value.scale });
};

const gcd = (left: bigint, right: bigint): bigint => {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
};

export const multiplyDecimalByRatio = (
  value: ExactDecimal,
  numerator: bigint,
  denominator: bigint,
): ExactDecimal => {
  if (denominator === 0n) throw new Error("Decimal ratio denominator cannot be zero.");
  let coefficient = value.coefficient * numerator;
  let divisor = denominator;
  const common = gcd(coefficient, divisor);
  coefficient /= common;
  divisor /= common;
  let twos = 0;
  let fives = 0;
  while (divisor % 2n === 0n) {
    divisor /= 2n;
    twos += 1;
  }
  while (divisor % 5n === 0n) {
    divisor /= 5n;
    fives += 1;
  }
  if (divisor !== 1n) throw new Error("Conversion has no finite exact decimal representation.");
  const addedScale = Math.max(twos, fives);
  coefficient *= (2n ** BigInt(addedScale - twos)) * (5n ** BigInt(addedScale - fives));
  return normalize({ coefficient, scale: value.scale + addedScale });
};

export const compareDecimal = (left: ExactDecimal, right: ExactDecimal): -1 | 0 | 1 => {
  const [a, b] = align(left, right);
  return a < b ? -1 : a > b ? 1 : 0;
};

export const ceilDecimalToInteger = (value: ExactDecimal): number => {
  const divisor = 10n ** BigInt(value.scale);
  const quotient = value.coefficient / divisor;
  const remainder = value.coefficient % divisor;
  const result = quotient + (remainder > 0n ? 1n : 0n);
  const numeric = Number(result);
  if (!Number.isSafeInteger(numeric)) throw new Error("Decimal ceiling exceeds safe integer range.");
  return numeric;
};

export const isNonNegativeDecimal = (value: ExactDecimal): boolean => value.coefficient >= 0n;
