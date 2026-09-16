import { describe, expect, it } from "vitest";
import validFixture from "../__fixtures__/valid-process-graph.v1.json";
import invalidFixture from "../__fixtures__/invalid-process-graph.v1.json";
import {
  getCompletionProcessNodes,
  getProcessBranchTargets,
  getReachableProcessNodeIds,
  topologicallySortProcessNodes,
} from "../graph";
import {
  parsePlatformProcessGraph,
  serializePlatformProcessGraph,
} from "../canonical";
import { platformProcessGraphSchema } from "../schema";
import { validatePlatformProcessGraph } from "../validation";
import type { PlatformProcessGraph } from "../types";

const validGraph = validFixture as unknown as PlatformProcessGraph;

describe("PlatformProcessGraph v1", () => {
  it("validates the golden branch/retry graph independently of chemistry execution", () => {
    expect(platformProcessGraphSchema.$id).toBe(
      "https://lab-studio.local/schemas/studio.process-graph/1.0",
    );
    const result = validatePlatformProcessGraph(validGraph);
    expect(result).toMatchObject({ ok: true, diagnostics: [] });
    expect([...getReachableProcessNodeIds(validGraph)].sort()).toEqual(
      ["prepare", "record-clear", "record-cloudy", "review"],
    );
    expect(getCompletionProcessNodes(validGraph).map(({ id }) => id)).toEqual([
      "record-clear",
      "record-cloudy",
    ]);
    expect([...getProcessBranchTargets(validGraph, "review")]).toEqual([
      ["clear", "record-clear"],
      ["cloudy", "record-cloudy"],
    ]);
    expect(topologicallySortProcessNodes(validGraph)).toHaveLength(validGraph.nodes.length);
  });

  it("reports invalid endpoints and missing operation references", () => {
    const result = validatePlatformProcessGraph(invalidFixture);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "process.edge.to-missing", path: "/edges/0/to" }),
      expect.objectContaining({ code: "process.operation.reference-required", path: "/nodes/0/operationRef" }),
    ]));
  });

  it("rejects unreachable nodes, non-retry cycles, invalid retry direction, and malformed branches", () => {
    const unreachable = structuredClone(validGraph);
    unreachable.nodes.push({
      id: "orphan",
      type: "reflection",
      title: "Orphan",
      description: "Not connected.",
      evidenceRequirementRefs: [],
      hints: [],
    });
    expect(validatePlatformProcessGraph(unreachable)).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: "process.node.unreachable" })]),
    });

    const cycle = structuredClone(validGraph);
    cycle.edges.push({
      id: "invalid-cycle",
      from: "record-clear",
      to: "prepare",
      label: "Invalid cycle",
      condition: { type: "always" },
    });
    expect(validatePlatformProcessGraph(cycle)).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: "process.cycle.requires-retry" })]),
    });

    const retry = structuredClone(validGraph);
    retry.edges.push({
      id: "forward-retry",
      from: "prepare",
      to: "record-clear",
      label: "Invalid forward retry",
      condition: { type: "retry" },
    });
    expect(validatePlatformProcessGraph(retry)).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: "process.retry.not-back-edge" })]),
    });

    const branch = structuredClone(validGraph);
    branch.edges[1].condition = { type: "always" };
    expect(validatePlatformProcessGraph(branch)).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: "process.branch.condition-required" })]),
    });
  });

  it("rejects schema version drift and round-trips canonical JSON deterministically", () => {
    const wrongVersion = { ...validGraph, schemaVersion: "2.0" };
    expect(validatePlatformProcessGraph(wrongVersion)).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ code: "schema.const", path: "/schemaVersion" }),
      ]),
    });
    const serialized = serializePlatformProcessGraph(validGraph);
    expect(parsePlatformProcessGraph(serialized)).toEqual(validGraph);
    expect(serializePlatformProcessGraph(parsePlatformProcessGraph(serialized))).toBe(serialized);
  });
});
