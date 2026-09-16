import { describe, expect, it, vi } from "vitest";
import type { RehearsalController } from "../../experimentComposer/types";
import { serializedResultLength, type WebMCPResult } from "../result";
import { createRehearsalToolSet } from "../rehearsalTools";
import { REHEARSAL_TOOL_NAMES } from "../toolSchemas";

const signal = new AbortController().signal;
const expectedRehearsalNames = [
  "inspect_rehearsal",
  "act_current_step",
  "operate_titration",
  "record_step_evidence",
  "submit_step_calculation",
  "reset_rehearsal",
] as const;
const ok = (message: string, revision: number): WebMCPResult => ({
  ok: true,
  code: "OK",
  message,
  state: { surface: "rehearsal", revision },
});

const controller = (): RehearsalController => ({
  getRevision: () => 7,
  inspect: () => ({
    attemptId: "attempt-1",
    currentNode: { id: "node-1", title: "Mount burette", expectedInteraction: "snapIntoTarget" },
    visibleEquipment: [{ id: "burette-1", label: "Burette", location: "shelf" }],
    evidence: [],
    recommendedNextOperation: "act_current_step",
  }),
  act: vi.fn(async () => ok("acted", 8)),
  operateTitration: vi.fn(async () => ok("dropped", 9)),
  recordEvidence: vi.fn(async () => ok("recorded", 10)),
  submitCalculation: vi.fn(async () => ok("submitted", 11)),
  reset: vi.fn(async () => ok("reset", 12)),
});

describe("rehearsal WebMCP descriptors", () => {
  it("emits exactly six AJV-validated tools only with a guided controller", () => {
    expect(createRehearsalToolSet(undefined)).toBeUndefined();
    const set = createRehearsalToolSet(controller());
    expect(REHEARSAL_TOOL_NAMES).toEqual(expectedRehearsalNames);
    expect(set?.tools.map((tool) => tool.name)).toEqual(REHEARSAL_TOOL_NAMES);
    expect(set?.tools.every((tool) => tool.validateInput({}).ok || tool.name === "operate_titration")).toBe(true);
  });

  it("rejects malformed input before invoking a controller", () => {
    const rehearsal = controller();
    const set = createRehearsalToolSet(rehearsal)!;
    const tool = set.tools.find((candidate) => candidate.name === "operate_titration")!;
    const invalid = tool.validateInput({ mode: "endpoint", endpointDropCount: 496 });
    expect(invalid.ok).toBe(false);
    expect(rehearsal.operateTitration).not.toHaveBeenCalled();
  });

  it("keeps inspection compact and free of hidden answer fields", async () => {
    const set = createRehearsalToolSet(controller())!;
    const tool = set.tools.find((candidate) => candidate.name === "inspect_rehearsal")!;
    const validation = tool.validateInput({});
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;
    const output = await tool.execute(validation.value, { signal });
    const serialized = JSON.stringify(output);
    expect(serializedResultLength(output)).toBeLessThanOrEqual(1_500);
    expect(serialized).not.toMatch(/endpointDropCount|analyteMolarity|expectedFinal|groundTruth/i);
  });
});
