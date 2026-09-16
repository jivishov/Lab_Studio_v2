import type { ActionInteractionSpec } from "../domain/types";

export interface BenchBounds {
  id: string;
  definitionId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  visualX?: number;
  visualY?: number;
  visualWidth?: number;
  visualHeight?: number;
}

export type BenchOverlapKind = "moveOnly" | "valid" | "invalid";

export interface BenchOverlapResult {
  kind: BenchOverlapKind;
  target?: BenchBounds;
  overlapRatio: number;
}

const area = (bounds: Pick<BenchBounds, "width" | "height">): number =>
  Math.max(0, bounds.width) * Math.max(0, bounds.height);

const intersectionArea = (a: BenchBounds, b: BenchBounds): number => {
  const left = Math.max(a.x, b.x);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const top = Math.max(a.y, b.y);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
};

const centerInside = (source: BenchBounds, target: BenchBounds): boolean => {
  const centerX = source.x + source.width / 2;
  const centerY = source.y + source.height / 2;
  return (
    centerX >= target.x &&
    centerX <= target.x + target.width &&
    centerY >= target.y &&
    centerY <= target.y + target.height
  );
};

const expectedTargetDefinition = (interaction?: ActionInteractionSpec): string | undefined =>
  interaction?.targetDefinitionId ??
  (interaction?.type === "readInstrument" ? interaction.stationId : undefined);

export const resolveBenchOverlap = (
  dragged: BenchBounds,
  candidates: BenchBounds[],
  interaction?: ActionInteractionSpec,
  threshold = 0.25,
): BenchOverlapResult => {
  let best: BenchOverlapResult = { kind: "moveOnly", overlapRatio: 0 };
  const draggedArea = area(dragged);
  const expectedTarget = expectedTargetDefinition(interaction);
  const expectedSource = interaction?.sourceDefinitionId;
  const draggedMatchesExpectedSource = Boolean(expectedSource && dragged.definitionId === expectedSource);

  for (const candidate of candidates) {
    const overlapArea = intersectionArea(dragged, candidate);
    const denominator = Math.min(draggedArea, area(candidate));
    const overlapRatio = denominator > 0 ? overlapArea / denominator : 0;
    const active = overlapArea > 0 && (centerInside(dragged, candidate) || overlapRatio >= threshold);
    const candidateMatchesExpected = Boolean(expectedTarget && candidate.definitionId === expectedTarget);
    const relevantToCurrentInteraction =
      !interaction || draggedMatchesExpectedSource || candidateMatchesExpected;
    const bestMatchesExpected = Boolean(expectedTarget && best.target?.definitionId === expectedTarget);
    const shouldReplace =
      !best.target ||
      (candidateMatchesExpected && !bestMatchesExpected) ||
      (candidateMatchesExpected === bestMatchesExpected && overlapRatio > best.overlapRatio);
    if (!active || !relevantToCurrentInteraction || !shouldReplace) {
      continue;
    }
    best = { kind: "invalid", target: candidate, overlapRatio };
  }

  if (!best.target) return best;
  if (!interaction) return { kind: "moveOnly", target: best.target, overlapRatio: best.overlapRatio };

  const sourceMatches = !expectedSource || dragged.definitionId === expectedSource;
  const targetMatches = Boolean(expectedTarget && best.target.definitionId === expectedTarget);

  return {
    ...best,
    kind: sourceMatches && targetMatches ? "valid" : "invalid",
  };
};
