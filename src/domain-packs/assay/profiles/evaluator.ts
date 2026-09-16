import {
  addRational,
  decimalToRational,
  divideRational,
  formatRational,
  multiplyRational,
  subtractRational,
  type Rational,
} from "../dilution/exact";
import type { AssayAnalysisExpression } from "./types";

export type AssayExpressionInputs = Record<"observed" | "blankMean" | "referenceMean", Rational>;

export const formatAnalysisValue = (
  value: Rational,
  decimalPlaces: number,
  tieBreaking: "half-up" | "half-even",
): string => formatRational(value, { mode: "decimal-places", decimalPlaces, tieBreaking }).value;

export const evaluateAssayExpression = (
  expression: AssayAnalysisExpression,
  inputs: AssayExpressionInputs,
): Rational => {
  if (expression.type === "input") return inputs[expression.input];
  if (expression.type === "constant") return decimalToRational(expression.value);
  const left = evaluateAssayExpression(expression.left, inputs);
  const right = evaluateAssayExpression(expression.right, inputs);
  if (expression.type === "add") return addRational(left, right);
  if (expression.type === "subtract") return subtractRational(left, right);
  if (expression.type === "multiply") return multiplyRational(left, right);
  return divideRational(left, right);
};

export const expressionFormula = (expression: AssayAnalysisExpression): string => {
  if (expression.type === "input") return expression.input;
  if (expression.type === "constant") return expression.value;
  const operator = { add: "+", subtract: "-", multiply: "×", divide: "÷" }[expression.type];
  return `(${expressionFormula(expression.left)} ${operator} ${expressionFormula(expression.right)})`;
};
