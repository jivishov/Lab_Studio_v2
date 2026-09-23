import { describe, expect, it } from "vitest";
import type { ActionDefinition, ActionInteractionSpec, EquipmentInstance } from "../../domain/types";
import { resolveBenchOverlap } from "../../player/benchOverlap";
import { classifyOverlap, footprintOf, nearestFreeSpot, parkBeside, FREE_OVERLAP_RATIO } from "../adapters/footprints";
import {
  benchMoveRequest,
  intentTypeForInteraction,
  mergeActionInput,
  resolveRelease,
  resolveTrayDrop,
  type ReleaseContext,
} from "../adapters/sceneToIntent";
import { equipment3dEntry } from "../equipment3d/readiness";

const empty = { kind: "empty" as const, label: "empty", solutes: [], contamination: [], wetState: "dry" as const, visualState: "empty" };
const inst = (id: string, definitionId: string, label: string): EquipmentInstance =>
  ({ id, definitionId, label, location: "workbench", x: 0, y: 0, contents: empty });
const instances = [inst("bottle-1", "sample-bottle", "Sample bottle"), inst("cyl-1", "graduated-cylinder", "Graduated cylinder"),
  inst("flask-1", "volumetric-flask", "Volumetric flask"), inst("cuv-1", "cuvette", "Blank cuvette"),
  inst("spec-1", "spectrophotometer", "Spectrophotometer"), inst("glass-1", "watch-glass", "Watch glass"),
  inst("bal-1", "analytical-balance", "Analytical balance")];

const spec = (patch: Partial<ActionInteractionSpec>): ActionInteractionSpec => ({ type: "pourInto", accessibleLabel: "step", ...patch });
const context = (patch: Partial<ReleaseContext>): ReleaseContext => ({
  currentNodeId: "node-1",
  retryFeedback: "Try again.",
  carried: { instanceId: "bottle-1", definitionId: "sample-bottle", label: "Sample bottle", kind: "item" },
  overlap: { kind: "moveOnly", overlapRatio: 0 },
  instances,
  releasePoint: { x: 300, y: 120 },
  nextZIndex: 7,
  ...patch,
});
const target = (id: string, definitionId: string) => ({ id, definitionId, x: 0, y: 0, width: 10, height: 10 });

describe("intent types for Pack 1's six handlers", () => {
  it("matches the 2D player's mapping", () => {
    expect({
      dragToZone: intentTypeForInteraction.dragToZone,
      snapIntoTarget: intentTypeForInteraction.snapIntoTarget,
      pourInto: intentTypeForInteraction.pourInto,
      readInstrument: intentTypeForInteraction.readInstrument,
      recordNotebook: intentTypeForInteraction.recordNotebook,
      submitCalculation: intentTypeForInteraction.submitCalculation,
    }).toEqual({
      dragToZone: "placeIntent",
      snapIntoTarget: "snapIntent",
      pourInto: "pourIntent",
      readInstrument: "instrumentReadIntent",
      recordNotebook: "notebookRecordIntent",
      submitCalculation: "calculationSubmitIntent",
    });
  });
});

describe("release order (Workbench.finishMove)", () => {
  it("1. places into the expected drag-to-zone station first", () => {
    const result = resolveRelease(context({
      expectedInteraction: spec({ type: "dragToZone", sourceDefinitionId: "sample-bottle", stationId: "workbench" }),
      releaseStation: "workbench",
      overlap: { kind: "valid", target: target("cyl-1", "graduated-cylinder"), overlapRatio: 0.9 },
    }));
    expect(result).toEqual({ kind: "dragToZone", intent: { type: "placeIntent", origin: "pointer", sourceInstanceId: "bottle-1", stationId: "workbench" } });
  });

  it("2. sends a pour over a valid target and parks the source afterwards", () => {
    const result = resolveRelease(context({
      expectedInteraction: spec({ type: "pourInto", sourceDefinitionId: "sample-bottle", targetDefinitionId: "graduated-cylinder" }),
      overlap: { kind: "valid", target: target("cyl-1", "graduated-cylinder"), overlapRatio: 0.6 },
    }));
    expect(result.kind).toBe("interaction");
    if (result.kind === "interaction") {
      expect(result.intent).toMatchObject({ type: "pourIntent", sourceInstanceId: "bottle-1", targetInstanceId: "cyl-1", x: 300, y: 120 });
      expect(result.intent.value).toBeUndefined();
      expect(result.parkAfter).toBe(true);
    }
  });

  it("2. aligns a snap to the anchor point and does not park it", () => {
    const result = resolveRelease(context({
      carried: { instanceId: "cuv-1", definitionId: "cuvette", label: "Blank cuvette", kind: "item" },
      expectedInteraction: spec({ type: "snapIntoTarget", sourceDefinitionId: "cuvette", targetDefinitionId: "spectrophotometer", snapZoneId: "spectrophotometer-cuvette-slot" }),
      overlap: { kind: "valid", target: target("spec-1", "spectrophotometer"), overlapRatio: 0.3 },
      snapPoint: { x: 410, y: 90 },
    }));
    expect(result).toMatchObject({ kind: "interaction", parkAfter: false,
      intent: { type: "snapIntent", snapZoneId: "spectrophotometer-cuvette-slot", x: 410, y: 90 } });
  });

  it("2. does not park after an instrument read", () => {
    const result = resolveRelease(context({
      carried: { instanceId: "glass-1", definitionId: "watch-glass", label: "Watch glass", kind: "item" },
      expectedInteraction: spec({ type: "readInstrument", sourceDefinitionId: "watch-glass", targetDefinitionId: "analytical-balance", stationId: "analytical-balance" }),
      overlap: { kind: "valid", target: target("bal-1", "analytical-balance"), overlapRatio: 0.5 },
    }));
    expect(result).toMatchObject({ kind: "interaction", parkAfter: false, intent: { type: "instrumentReadIntent" } });
  });

  it("3. refuses an invalid overlap with the 2D wording, and changes nothing", () => {
    const result = resolveRelease(context({
      expectedInteraction: spec({ type: "pourInto", sourceDefinitionId: "sample-bottle", targetDefinitionId: "graduated-cylinder" }),
      overlap: { kind: "invalid", target: target("flask-1", "volumetric-flask"), overlapRatio: 0.6 },
    }));
    expect(result).toEqual({ kind: "invalidOverlap", feedback: {
      reason: "invalidTarget",
      message: "Volumetric flask is not the correct target for this step.",
      recovery: "Try again.",
      nodeId: "node-1",
    } });
  });

  it("3. names the source when the target was right but the source was not", () => {
    const result = resolveRelease(context({
      carried: { instanceId: "flask-1", definitionId: "volumetric-flask", label: "Volumetric flask", kind: "item" },
      expectedInteraction: spec({ type: "pourInto", sourceDefinitionId: "sample-bottle", targetDefinitionId: "graduated-cylinder", invalidCue: "Use the sample bottle." }),
      overlap: { kind: "invalid", target: target("cyl-1", "graduated-cylinder"), overlapRatio: 0.6 },
    }));
    expect(result).toMatchObject({ kind: "invalidOverlap", feedback: {
      reason: "incompatibleEquipment", message: "Volumetric flask is not the expected source for this step.", recovery: "Use the sample bottle." } });
  });

  it("4. otherwise sends a free bench move, which is never an attempt", () => {
    expect(resolveRelease(context({}))).toEqual({ kind: "freeMove", request: benchMoveRequest("bottle-1", { x: 300, y: 120 }, 7) });
    expect(benchMoveRequest("bottle-1", { x: 1, y: 2 }, 3)).toEqual({
      verb: "place", sourceInstanceId: "bottle-1", location: "workbench", parameters: { benchMove: true, x: 1, y: 2, zIndex: 3 } });
  });

  it("never free-moves a probe", () => {
    expect(resolveRelease(context({ carried: { instanceId: "p", definitionId: "ph-probe", label: "Probe", kind: "probe" } }))).toEqual({ kind: "none" });
  });
});

describe("tray drops (placeShelfEquipment)", () => {
  const drag = spec({ type: "dragToZone", sourceDefinitionId: "watch-glass", stationId: "workbench" });
  it("places the item the current step expects", () => {
    expect(resolveTrayDrop(drag, false, undefined, "watch-glass", { x: 10, y: 20 }, 4)).toEqual({ kind: "intent",
      intent: { type: "placeIntent", origin: "pointer", sourceDefinitionId: "watch-glass", stationId: "workbench", x: 10, y: 20 } });
  });
  it("free-moves anything else from the shelf", () => {
    expect(resolveTrayDrop(drag, false, undefined, "spatula", { x: 10, y: 20 }, 4)).toEqual({ kind: "freeMove",
      request: { verb: "place", equipmentDefinitionId: "spatula", location: "workbench", parameters: { benchMove: true, x: 10, y: 20, zIndex: 4 } } });
    expect(resolveTrayDrop(drag, true, undefined, "watch-glass", { x: 10, y: 20 }, 4).kind).toBe("freeMove");
  });
});

describe("mergeActionInput mirrors runIntent", () => {
  const intent = { type: "pourIntent" as const, sourceInstanceId: "a", targetInstanceId: "b" };
  const field = (role: "teacherConfiguration" | "studentResponse") => ({
    key: "k", label: "L", mode: "numeric" as const, options: [], required: true, role, minExclusive: false, maxExclusive: false });
  const action = { id: "x", parameters: { configurationParameter: "volumeMl" } } as unknown as ActionDefinition;

  it("carries a value only from a valid input field", () => {
    expect(mergeActionInput(intent, { valid: false, field: field("studentResponse"), value: 5 }, action)).toBe(intent);
    expect(mergeActionInput(intent, { valid: true }, action)).toBe(intent);
  });

  it("approves teacher configuration and passes the configured parameter", () => {
    expect(mergeActionInput(intent, { valid: true, field: field("teacherConfiguration"), value: 25 }, action)).toEqual({
      ...intent, value: 25, note: undefined, configurationApproved: true, runtimeParameters: { volumeMl: 25 } });
  });

  it("keeps a learner value and note without approving configuration", () => {
    expect(mergeActionInput(intent, { valid: true, field: field("studentResponse"), value: 41.2, note: "n" }, action)).toEqual({
      ...intent, value: 41.2, note: "n", configurationApproved: undefined, runtimeParameters: {} });
  });
});

describe("footprints", () => {
  const bottle = equipment3dEntry("sample-bottle");
  const cylinder = equipment3dEntry("graduated-cylinder");

  it("classifies overlap with the shared 2D classifier", () => {
    const interaction = spec({ type: "pourInto", sourceDefinitionId: "sample-bottle", targetDefinitionId: "graduated-cylinder" });
    const carried = { instanceId: "bottle-1", definitionId: "sample-bottle", footprint: footprintOf(bottle, 0, 0) };
    const over = { instanceId: "cyl-1", definitionId: "graduated-cylinder", footprint: footprintOf(cylinder, 10, 0) };
    const far = { ...over, footprint: footprintOf(cylinder, 400, 0) };
    expect(classifyOverlap(carried, [over], interaction).kind).toBe("valid");
    expect(classifyOverlap(carried, [far], interaction).kind).toBe("moveOnly");
    expect(resolveBenchOverlap).toBeTypeOf("function");
  });

  it("slides a set-down to the nearest spot under 5 % overlap", () => {
    const occupied = [footprintOf(cylinder, 0, 0)];
    const wanted = footprintOf(bottle, 5, 0);
    const spot = nearestFreeSpot(wanted, occupied);
    const w = Math.max(0, Math.min(spot.xMm + spot.widthMm / 2, 38) - Math.max(spot.xMm - spot.widthMm / 2, -38));
    const d = Math.max(0, Math.min(spot.yMm + spot.depthMm / 2, 38) - Math.max(spot.yMm - spot.depthMm / 2, -38));
    expect((w * d) / Math.min(spot.widthMm * spot.depthMm, 76 * 76)).toBeLessThan(FREE_OVERLAP_RATIO);
    expect(Math.hypot(spot.xMm - 5, spot.yMm)).toBeGreaterThan(0);
  });

  it("parks a pour source beside its target, on the bench", () => {
    const parked = parkBeside(footprintOf(bottle, 0, 0), footprintOf(cylinder, 0, 0), [footprintOf(cylinder, 0, 0)]);
    expect(parked.xMm).toBeGreaterThan(0);
    expect(Math.abs(parked.xMm)).toBeLessThan(700);
  });
});
