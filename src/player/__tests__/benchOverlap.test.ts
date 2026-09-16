import { describe, expect, it } from "vitest";
import { resolveBenchOverlap, type BenchBounds } from "../benchOverlap";
import type { ActionInteractionSpec } from "../../domain/types";

const dragged: BenchBounds = {
  id: "wash-bottle-1",
  definitionId: "wash-bottle",
  x: 60,
  y: 60,
  width: 120,
  height: 120,
};

const rinseInteraction: ActionInteractionSpec = {
  type: "rinseTarget",
  sourceDefinitionId: "wash-bottle",
  targetDefinitionId: "filter-paper",
  accessibleLabel: "Rinse the filter paper.",
};

const filterInteraction: ActionInteractionSpec = {
  type: "pourInto",
  sourceDefinitionId: "beaker-250ml",
  targetDefinitionId: "funnel-stand",
  accessibleLabel: "Pour the mixture into the funnel.",
};

describe("bench overlap helper", () => {
  it("returns moveOnly when there is no active overlap", () => {
    const result = resolveBenchOverlap(dragged, [
      { id: "filter-paper-1", definitionId: "filter-paper", x: 260, y: 260, width: 120, height: 120 },
    ], rinseInteraction);

    expect(result.kind).toBe("moveOnly");
    expect(result.target).toBeUndefined();
  });

  it("does not treat edge contact as an overlap", () => {
    const result = resolveBenchOverlap({
      ...dragged,
      x: 180,
      y: 60,
    }, [
      { id: "filter-paper-1", definitionId: "filter-paper", x: 60, y: 60, width: 120, height: 120 },
    ], rinseInteraction);

    expect(result.kind).toBe("moveOnly");
    expect(result.target).toBeUndefined();
  });

  it("marks an expected source and target overlap as valid", () => {
    const result = resolveBenchOverlap(dragged, [
      { id: "filter-paper-1", definitionId: "filter-paper", x: 92, y: 70, width: 120, height: 120 },
    ], rinseInteraction);

    expect(result.kind).toBe("valid");
    expect(result.target?.id).toBe("filter-paper-1");
  });

  it("marks a wrong target as invalid", () => {
    const result = resolveBenchOverlap(dragged, [
      { id: "beaker-250ml-1", definitionId: "beaker-250ml", x: 92, y: 70, width: 120, height: 120 },
    ], rinseInteraction);

    expect(result.kind).toBe("invalid");
    expect(result.target?.definitionId).toBe("beaker-250ml");
  });

  it("allows unrelated equipment to be moved over non-target equipment", () => {
    const result = resolveBenchOverlap({
      id: "erlenmeyer-flask-250ml-1",
      definitionId: "erlenmeyer-flask-250ml",
      x: 92,
      y: 70,
      width: 106,
      height: 140,
    }, [
      { id: "ring-stand-clamp-1", definitionId: "ring-stand-clamp", x: 60, y: 60, width: 300, height: 390 },
    ], rinseInteraction);

    expect(result.kind).toBe("moveOnly");
    expect(result.target).toBeUndefined();
  });

  it("selects the largest active overlap", () => {
    const result = resolveBenchOverlap(dragged, [
      { id: "beaker-250ml-1", definitionId: "beaker-250ml", x: 150, y: 130, width: 120, height: 120 },
      { id: "filter-paper-1", definitionId: "filter-paper", x: 70, y: 70, width: 120, height: 120 },
    ], rinseInteraction);

    expect(result.kind).toBe("valid");
    expect(result.target?.id).toBe("filter-paper-1");
  });

  it("prefers an active expected composite parent over an attached child layer", () => {
    const result = resolveBenchOverlap({
      id: "beaker-250ml-1",
      definitionId: "beaker-250ml",
      x: 20,
      y: 24,
      width: 102,
      height: 132,
    }, [
      { id: "funnel-stand-1", definitionId: "funnel-stand", x: 0, y: 0, width: 218, height: 246 },
      { id: "filter-paper-1", definitionId: "filter-paper", x: 22, y: 36, width: 86, height: 72 },
    ], filterInteraction);

    expect(result.kind).toBe("valid");
    expect(result.target?.id).toBe("funnel-stand-1");
  });

  it("still selects an expected attached child when the child is the current target", () => {
    const result = resolveBenchOverlap(dragged, [
      { id: "funnel-stand-1", definitionId: "funnel-stand", x: 0, y: 0, width: 218, height: 246 },
      { id: "filter-paper-1", definitionId: "filter-paper", x: 22, y: 36, width: 86, height: 72 },
    ], rinseInteraction);

    expect(result.kind).toBe("valid");
    expect(result.target?.id).toBe("filter-paper-1");
  });
});
