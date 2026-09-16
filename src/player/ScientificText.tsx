import { Fragment, type ReactNode } from "react";

type ScientificPart = {
  kind: "text" | "subscript" | "superscript";
  value: string;
};

type ParsedFormula = {
  parts: ScientificPart[];
  hasSubscript: boolean;
};

const candidatePattern = /[A-Z][A-Za-z0-9()[\]^+-]*/g;
const formulaPartPattern = /[A-Z][a-z]?|\d+|[()[\]]/y;

const parseFormulaBase = (value: string): ParsedFormula | undefined => {
  const parts: ScientificPart[] = [];
  let elementCount = 0;
  let hasSubscript = false;
  let index = 0;

  while (index < value.length) {
    formulaPartPattern.lastIndex = index;
    const match = formulaPartPattern.exec(value);
    if (!match) return undefined;

    const token = match[0];
    if (/^\d/.test(token)) {
      parts.push({ kind: "subscript", value: token });
      hasSubscript = true;
    } else {
      parts.push({ kind: "text", value: token });
      if (/^[A-Z]/.test(token)) elementCount += 1;
    }
    index += token.length;
  }

  return elementCount > 0 ? { parts, hasSubscript } : undefined;
};

const splitCharge = (value: string): { base: string; charge?: string } => {
  const explicitCharge = value.match(/^(.*)\^(\d*[+-])$/);
  if (explicitCharge) return { base: explicitCharge[1], charge: explicitCharge[2] };

  const signMatch = value.match(/^(.*)([+-])$/);
  if (!signMatch) return { base: value };

  const [, baseWithDigits, sign] = signMatch;
  const singleElementCharge = baseWithDigits.match(/^([A-Z][a-z]?)(\d+)$/);
  if (singleElementCharge) {
    return { base: singleElementCharge[1], charge: `${singleElementCharge[2]}${sign}` };
  }

  const condensedPolyatomicCharge = baseWithDigits.match(/^(.*\d)(\d)$/);
  if (condensedPolyatomicCharge) {
    return { base: condensedPolyatomicCharge[1], charge: `${condensedPolyatomicCharge[2]}${sign}` };
  }

  return { base: baseWithDigits, charge: sign };
};

const parseScientificNotation = (value: string): ScientificPart[] | undefined => {
  const { base, charge } = splitCharge(value);
  const parsed = parseFormulaBase(base);
  if (!parsed || (!parsed.hasSubscript && !charge)) return undefined;

  return charge
    ? [...parsed.parts, { kind: "superscript", value: charge }]
    : parsed.parts;
};

const notationPart = (part: ScientificPart, key: number): ReactNode => {
  if (part.kind === "subscript") {
    return <sub className="scientific-notation__sub" key={key}>{part.value}</sub>;
  }
  if (part.kind === "superscript") {
    return <sup className="scientific-notation__sup" key={key}>{part.value}</sup>;
  }
  return <Fragment key={key}>{part.value}</Fragment>;
};

export const formatScientificText = (text: string): ReactNode => {
  const rendered: ReactNode[] = [];
  let previousIndex = 0;
  let formulaIndex = 0;

  for (const match of text.matchAll(candidatePattern)) {
    const candidate = match[0];
    const start = match.index ?? 0;
    const end = start + candidate.length;
    const trailingHyphen = candidate.endsWith("-") && /[A-Za-z]/.test(text[end] ?? "");
    const notationCandidate = trailingHyphen ? candidate.slice(0, -1) : candidate;
    const notation = parseScientificNotation(notationCandidate);
    if (!notation) continue;

    if (start > previousIndex) rendered.push(text.slice(previousIndex, start));
    rendered.push(
      <Fragment key={`${candidate}-${formulaIndex}`}>
        {notation.map(notationPart)}
        {trailingHyphen ? "-" : null}
      </Fragment>,
    );
    previousIndex = end;
    formulaIndex += 1;
  }

  if (rendered.length === 0) return text;
  if (previousIndex < text.length) rendered.push(text.slice(previousIndex));
  return <>{rendered}</>;
};

export const ScientificText = ({ text }: { text: string }) => <>{formatScientificText(text)}</>;
