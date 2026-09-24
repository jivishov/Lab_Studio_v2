import { describe, expect, it } from "vitest";
import type { ActionDefinition, ActionInteractionSpec, EquipmentInstance } from "../../domain/types";
import { getBenchSize } from "../../equipment/visualCatalog";
import { resolveBenchOverlap } from "../../player/benchOverlap";
import { snapPointAligningSourceAnchor } from "../../player/benchTargeting";
import { classifyOverlap, footprintOf, nearestFreeSpot, snapClassification, snapZoneFootprint, FREE_OVERLAP_RATIO, SNAP_SOURCE_MM } from "../adapters/footprints";
import {
  benchMoveRequest,
  intentTypeForInteraction,
  mergeActionInput,
  resolveRelease,
  resolveTrayDrop,
  snapReleasePoint,
  type ReleaseContext,
} from "../adapters/sceneToIntent";
import { nextPlacementPoint, parkPointAfterInteraction } from "../adapters/twoDPlacement";
import { benchOccupiedBoundsFromNodes } from "../../player/benchTargeting";
import { resolveWorkbenchScene } from "../../player/resolveWorkbenchScene";
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

describe("snap release point (Workbench.snapPointForTarget)", () => {
  const photometer = { instanceId: "spec-1", definitionId: "spectrophotometer", x: 300, y: 120 };

  it("lines the carried item's anchor up with the zone anchor, exactly as the 2D helper does", () => {
    const size = getBenchSize("spectrophotometer");
    const twoD = snapPointAligningSourceAnchor({ id: "spec-1", definitionId: "spectrophotometer", x: 300, y: 120, width: size.width, height: size.height },
      "cuvette", "spectrophotometer-cuvette-slot");
    expect(twoD).toBeDefined();
    expect(snapReleasePoint(photometer, "cuvette", "spectrophotometer-cuvette-slot")).toEqual({ x: Math.max(0, twoD!.x), y: Math.max(0, twoD!.y) });
  });

  it("falls back to the target's own point without a zone, as in 2D", () => {
    expect(snapReleasePoint(photometer, "cuvette")).toEqual({ x: 300, y: 120 });
    expect(snapReleasePoint(photometer, "cuvette", "no-such-zone")).toEqual({ x: 300, y: 120 });
  });
});

describe("tray click placement (StudentPlayer.nextPlacementPoint)", () => {
  const onShelf = (id: string, definitionId: string): EquipmentInstance => ({ ...inst(id, definitionId, id), location: "shelf", x: undefined, y: undefined });

  it("takes the first default slot on an empty bench", () => {
    expect(nextPlacementPoint([onShelf("a", "wash-bottle")], "wash-bottle")).toEqual({ x: 34, y: 86 });
  });

  it("skips a slot an item already stands in, counting an unplaced bench item at its default slot", () => {
    const standing = { ...onShelf("flask-1", "volumetric-flask"), location: "workbench" as const };
    expect(nextPlacementPoint([standing], "wash-bottle")).toEqual({ x: 182, y: 86 });
  });

  it("stands a ring stand at its own spot", () => {
    expect(nextPlacementPoint([], "ring-stand")).toEqual({ x: 270, y: 36 });
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

describe("hand-control releases (plan D6)", () => {
  it("carry origin \"vision\", as the 2D player tags its camera releases, and default to \"pointer\"", () => {
    const zone = spec({ type: "dragToZone", sourceDefinitionId: "sample-bottle", stationId: "workbench" });
    expect(resolveRelease(context({ expectedInteraction: zone, releaseStation: "workbench", origin: "vision" })))
      .toEqual({ kind: "dragToZone", intent: { type: "placeIntent", origin: "vision", sourceInstanceId: "bottle-1", stationId: "workbench" } });
    const pour = resolveRelease(context({
      expectedInteraction: spec({ type: "pourInto", sourceDefinitionId: "sample-bottle", targetDefinitionId: "graduated-cylinder" }),
      overlap: { kind: "valid", target: target("cyl-1", "graduated-cylinder"), overlapRatio: 0.5 },
      origin: "vision",
    }));
    expect(pour.kind === "interaction" && pour.intent.origin).toBe("vision");
    const pointer = resolveRelease(context({
      expectedInteraction: spec({ type: "pourInto", sourceDefinitionId: "sample-bottle", targetDefinitionId: "graduated-cylinder" }),
      overlap: { kind: "valid", target: target("cyl-1", "graduated-cylinder"), overlapRatio: 0.5 },
    }));
    expect(pointer.kind === "interaction" && pointer.intent.origin).toBe("pointer");
  });

  it("tag a tray drop the step expects the same way", () => {
    const drag = spec({ type: "dragToZone", sourceDefinitionId: "watch-glass", stationId: "workbench" });
    const result = resolveTrayDrop(drag, false, undefined, "watch-glass", { x: 10, y: 20 }, 4, "vision");
    expect(result.kind === "intent" && result.intent.origin).toBe("vision");
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

});

describe("snaps are judged at the zone, as in 2D (benchTargeting)", () => {
  const snapSpec = (snapZoneId?: string): ActionInteractionSpec =>
    ({ type: "snapIntoTarget", accessibleLabel: "seat", sourceDefinitionId: "rubber-stopper-set", targetDefinitionId: "volumetric-flask", ...(snapZoneId ? { snapZoneId } : {}) });
  const flaskEntry = equipment3dEntry("volumetric-flask");
  const flaskAt = { instanceId: "flask-1", definitionId: "volumetric-flask", entry: flaskEntry, xMm: 100, yMm: 50, yawDeg: 0 };

  it("is not a snap rule for other steps", () => {
    expect(snapClassification(spec({}), "sample-bottle", [flaskAt])).toBeUndefined();
  });

  it("puts the zone on the model's anchor, turned with the target", () => {
    const [ax, ay] = flaskEntry!.anchors["volumetric-flask-stopper-seat"].positionMm;
    const zone = snapZoneFootprint(flaskEntry, "volumetric-flask", "volumetric-flask-stopper-seat", flaskAt)!;
    expect(zone.xMm).toBeCloseTo(100 + ax, 6);
    expect(zone.yMm).toBeCloseTo(50 + ay, 6);
    const turned = snapZoneFootprint(flaskEntry, "volumetric-flask", "volumetric-flask-stopper-seat", { ...flaskAt, yawDeg: 90 })!;
    expect(turned.xMm).toBeCloseTo(100 - ay, 6);
    expect(turned.yMm).toBeCloseTo(50 + ax, 6);
    expect(snapZoneFootprint(flaskEntry, "volumetric-flask", "no-such-zone", flaskAt)).toBeUndefined();
  });

  it("with a zone, counts only the zone of the expected target", () => {
    const interaction = snapSpec("volumetric-flask-stopper-seat");
    const snap = snapClassification(interaction, "rubber-stopper-set", [flaskAt])!;
    expect(snap.zones.has("flask-1")).toBe(true);
    const flask = { instanceId: "flask-1", definitionId: "volumetric-flask", footprint: footprintOf(flaskEntry, 100, 50) };
    const zone = snap.zones.get("flask-1")!;
    const width = snap.sourceAsPoint ? SNAP_SOURCE_MM : footprintOf(equipment3dEntry("rubber-stopper-set"), 0, 0).widthMm;
    const carriedAt = (xMm: number, yMm: number) => ({ instanceId: "stopper-1", definitionId: "rubber-stopper-set",
      footprint: { ...footprintOf(equipment3dEntry("rubber-stopper-set"), xMm, yMm), widthMm: width, depthMm: width } });
    expect(classifyOverlap(carriedAt(zone.xMm, zone.yMm), [flask], interaction, snap).kind).toBe("valid");
    // Over the flask's body but well away from its seat is no longer over the target.
    const offSeat = carriedAt(zone.xMm + zone.widthMm + 30, zone.yMm);
    expect(classifyOverlap(offSeat, [flask], interaction, snap).kind).not.toBe("valid");
  });

  it("without a zone (every Pack 1 snap), keeps the full bounds, as 2D does", () => {
    const snap = snapClassification(snapSpec(), "cuvette", [flaskAt])!;
    expect(snap.sourceAsPoint).toBe(false);
    expect(snap.zones.size).toBe(0);
  });
});

describe("2D placement rules (twoDPlacement)", () => {
  const flaskAt = (x: number, y: number): EquipmentInstance => ({ ...inst("flask-1", "volumetric-flask", "Volumetric flask"), x, y });

  it("parks a pour source clear of every other item's hit box, near the release point", () => {
    const state = { equipmentInstances: [inst("bottle-1", "sample-bottle", "Sample bottle"), flaskAt(300, 60)], attachments: [] };
    const parked = parkPointAfterInteraction(state, "bottle-1", { x: 320, y: 40 });
    const size = getBenchSize("sample-bottle");
    const [flask] = benchOccupiedBoundsFromNodes(resolveWorkbenchScene(state), new Map(), "bottle-1", state.equipmentInstances);
    const w = Math.max(0, Math.min(parked.x + size.width, flask.x + flask.width) - Math.max(parked.x, flask.x));
    const h = Math.max(0, Math.min(parked.y + size.height, flask.y + flask.height) - Math.max(parked.y, flask.y));
    expect((w * h) / (size.width * size.height)).toBeLessThan(0.05);
    expect(parked).not.toEqual({ x: 320, y: 40 });
  });

  it("keeps a parked item on the 2D bench surface", () => {
    const state = { equipmentInstances: [inst("bottle-1", "sample-bottle", "Sample bottle")], attachments: [] };
    const parked = parkPointAfterInteraction(state, "bottle-1", { x: 740, y: 500 });
    expect(parked.x).toBeGreaterThanOrEqual(8);
    expect(parked.y).toBeGreaterThanOrEqual(8);
    expect(parked.x).toBeLessThanOrEqual(760);
    expect(parked.y).toBeLessThanOrEqual(520);
  });
});
