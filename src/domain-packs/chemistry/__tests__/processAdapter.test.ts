import { describe, expect, it } from "vitest";
import type { ProcessDefinition, ProcessEdge, ProcessNode, ProcessNodeType } from "../../../domain/types";
import { validatePlatformProcessGraph } from "../../../platform/process/validation";
import { chemistryProcessReadAdapter } from "../processAdapter";

const node = (
  id: string,
  type: ProcessNodeType = "action",
  actionId?: string,
): ProcessNode => ({
  id,
  type,
  title: id,
  description: `${id} description`,
  ...(actionId ? { actionId } : {}),
  config: {},
  validation: [],
  hints: [],
  feedback: {
    success: `${id} succeeded`,
    retry: `${id} can be retried`,
  },
});

const process = (nodes: ProcessNode[], edges: ProcessEdge[]): ProcessDefinition => ({
  startNodeId: nodes[0].id,
  nodes,
  edges,
});

const validationCodes = (source: ProcessDefinition) => {
  const projection = chemistryProcessReadAdapter.project(source);
  const validation = validatePlatformProcessGraph(projection.graph);
  return {
    projection,
    validation,
    codes: validation.ok ? [] : validation.diagnostics.map(({ code }) => code),
  };
};

describe("chemistry process read adapter", () => {
  it("projects an acyclic source graph with completed edges as an executable platform graph", () => {
    const source = process([
      node("start", "action", "start-action"),
      node("finish", "checkpoint"),
    ], [{
      from: "start",
      to: "finish",
      label: "Complete",
      condition: { type: "validationPassed" },
    }]);

    const { projection, validation } = validationCodes(source);

    expect(validation).toMatchObject({ ok: true });
    expect(projection.graph.edges[0].condition).toEqual({ type: "completed" });
    expect(projection.edges[0]).toMatchObject({
      platformEdgeId: "edge-1",
      chemistryEdgeIndex: 0,
      chemistryEdge: source.edges[0],
    });
  });

  it("preserves decision branches without turning them into a cycle", () => {
    const source = process([
      node("start", "action", "start-action"),
      node("choose", "decision"),
      node("accept", "checkpoint"),
      node("reject", "checkpoint"),
    ], [
      { from: "start", to: "choose", label: "Continue", condition: { type: "validationPassed" } },
      { from: "choose", to: "accept", label: "Accept", condition: { type: "validationPassed" } },
      { from: "choose", to: "reject", label: "Reject", condition: { type: "validationPassed" } },
    ]);

    const { projection, validation } = validationCodes(source);

    expect(validation).toMatchObject({ ok: true });
    expect(projection.graph.edges.map(({ condition }) => condition)).toEqual([
      { type: "completed" },
      { type: "branch", branchKey: "branch-2" },
      { type: "branch", branchKey: "branch-3" },
    ]);
  });

  it("preserves an explicit retry edge as retry semantics", () => {
    const source = process([
      node("start", "action", "start-action"),
      node("attempt", "action", "attempt-action"),
      node("finish", "checkpoint"),
    ], [
      { from: "start", to: "attempt", label: "Begin", condition: { type: "validationPassed" } },
      { from: "attempt", to: "attempt", label: "Try again", condition: { type: "retry" } },
      { from: "attempt", to: "finish", label: "Complete", condition: { type: "validationPassed" } },
    ]);

    const { projection, validation } = validationCodes(source);

    expect(validation).toMatchObject({ ok: true });
    expect(projection.graph.edges[1].condition).toEqual({ type: "retry" });
    expect(projection.edges[1].chemistryEdge.condition).toEqual({ type: "retry" });
  });

  it("keeps a procedural repeat visible instead of relabeling it as retry", () => {
    const source = process([
      node("start", "action", "start-action"),
      node("decide", "action", "deliver-titrant-decide"),
      node("measure", "action", "deliver-titrant"),
      node("finish", "checkpoint"),
    ], [
      { from: "start", to: "decide", label: "Begin", condition: { type: "validationPassed" } },
      { from: "decide", to: "measure", label: "Continue", condition: { type: "validationPassed" } },
      { from: "measure", to: "decide", label: "Repeat", condition: { type: "validationPassed" } },
      { from: "decide", to: "finish", label: "Finish", condition: { type: "validationPassed" } },
    ]);

    const { projection, validation, codes } = validationCodes(source);

    expect(validation).toMatchObject({ ok: false });
    expect(codes).toEqual(["process.cycle.requires-retry"]);
    expect(projection.graph.edges[2].condition).toEqual({ type: "completed" });
    expect(projection.edges[2].chemistryEdge).toEqual(source.edges[2]);
    expect(chemistryProcessReadAdapter.restore(projection)).toEqual(source);
  });

  it("does not hide malformed graph endpoints behind the projection contract", () => {
    const source = process([
      node("start", "action", "start-action"),
      node("finish", "checkpoint"),
    ], [{
      from: "start",
      to: "missing",
      label: "Broken endpoint",
      condition: { type: "validationPassed" },
    }]);

    const { validation, codes } = validationCodes(source);

    expect(validation).toMatchObject({ ok: false });
    expect(codes).toContain("process.edge.to-missing");
    expect(codes).not.toContain("process.cycle.requires-retry");
  });
});
