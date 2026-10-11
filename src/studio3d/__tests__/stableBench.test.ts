import { describe, expect, it } from "vitest";
import type { AttachmentRelation, EquipmentInstance } from "../../domain/types";
import { resolveWorkbenchScene } from "../../player/resolveWorkbenchScene";
import { runtimeBenchPoints } from "../adapters/benchCoordinates";
import { slotPoint, stablePlacementPoint, stableWorkbenchNodes } from "../adapters/stableBench";

const empty = { kind: "empty" as const, label: "empty", solutes: [], contamination: [], wetState: "dry" as const, visualState: "empty" };
const item = (id: string, definitionId: string, location: "workbench" | "shelf" = "workbench", at?: { x: number; y: number }): EquipmentInstance =>
  ({ id, definitionId, label: id, location, x: at?.x, y: at?.y, contents: empty });
const points = (instances: EquipmentInstance[], attachments: AttachmentRelation[] = []) =>
  runtimeBenchPoints({ equipmentInstances: instances, attachments });

describe("the 3D bench's stable layout (decided 2026-10-11)", () => {
  it("keeps an unplaced item in its own slot as others arrive and leave, where 2D shifts it", () => {
    const flask = item("flask-1", "volumetric-flask");
    const before = [item("bottle-1", "wash-bottle", "shelf"), flask, item("beaker-1", "beaker-250ml", "shelf")];
    // 2D stands the flask in the first slot while it is the only bench item.
    expect(resolveWorkbenchScene({ equipmentInstances: before, attachments: [] })[0].transform).toMatchObject(slotPoint(0));
    // The 3D bench stands it in the slot of its place in the run, from the start.
    expect(points(before).get("flask-1")).toEqual(slotPoint(1));
    // The bottle arrives without coordinates (a step's Confirm): it takes its own slot; the flask stays.
    const arrived = [item("bottle-1", "wash-bottle"), flask, item("beaker-1", "beaker-250ml")];
    expect(points(arrived).get("bottle-1")).toEqual(slotPoint(0));
    expect(points(arrived).get("flask-1")).toEqual(slotPoint(1));
    expect(points(arrived).get("beaker-1")).toEqual(slotPoint(2));
    // The bottle goes back to the shelf: nothing else moves.
    const left = [item("bottle-1", "wash-bottle", "shelf"), flask, item("beaker-1", "beaker-250ml")];
    expect(points(left).get("flask-1")).toEqual(slotPoint(1));
    expect(points(left).get("beaker-1")).toEqual(slotPoint(2));
  });

  it("keeps an item's own coordinates, and moves an item whose slot they cover to the first slot no item owns", () => {
    const moved = item("bottle-1", "wash-bottle", "workbench", { x: 190, y: 90 });
    const instances = [moved, item("flask-1", "volumetric-flask"), item("beaker-1", "beaker-250ml")];
    expect(points(instances).get("bottle-1")).toEqual({ x: 190, y: 90 });
    // The flask's slot (index 1) is under the bottle; slots 0–2 are owned, so it takes slot 3.
    expect(points(instances).get("flask-1")).toEqual(slotPoint(3));
    expect(points(instances).get("beaker-1")).toEqual(slotPoint(2));
  });

  it("gives the 16th item onward the first free slot", () => {
    const instances = Array.from({ length: 16 }, (_, index) => item(`beaker-${index}`, "beaker-250ml", index === 3 ? "shelf" : "workbench"));
    const at = points(instances);
    expect(at.get("beaker-14")).toEqual(slotPoint(14));
    // Every slot is owned; the only free one belongs to the beaker on the shelf.
    expect(at.get("beaker-15")).toEqual(slotPoint(3));
  });

  it("moves a receiving child with its parent", () => {
    const instances = [item("bottle-1", "wash-bottle", "shelf"), item("stand-1", "funnel-stand"), item("beaker-1", "beaker-250ml")];
    const attachments: AttachmentRelation[] = [{ id: "a1", parentInstanceId: "stand-1", childInstanceId: "beaker-1",
      relationType: "receiving", zoneId: "funnel-receiving-vessel-zone", renderMode: "independent" } as AttachmentRelation];
    const twoD = new Map(resolveWorkbenchScene({ equipmentInstances: instances, attachments }).map((node) => [node.primaryInstanceId, node.transform]));
    const stable = new Map(stableWorkbenchNodes({ equipmentInstances: instances, attachments }).map((node) => [node.primaryInstanceId, node.transform]));
    expect(stable.get("stand-1")).toMatchObject(slotPoint(1));
    const offset = (map: typeof twoD) => ({ x: map.get("beaker-1")!.x - map.get("stand-1")!.x, y: map.get("beaker-1")!.y - map.get("stand-1")!.y });
    expect(offset(stable)).toEqual(offset(twoD));
  });

  it("places a tray item in its own slot when clear, else the first clear slot", () => {
    const shelf = [item("bottle-1", "wash-bottle", "shelf"), item("flask-1", "volumetric-flask", "shelf"), item("beaker-1", "beaker-250ml", "shelf")];
    expect(stablePlacementPoint({ equipmentInstances: shelf, attachments: [] }, "beaker-250ml")).toEqual(slotPoint(2));
    expect(stablePlacementPoint({ equipmentInstances: shelf, attachments: [] }, "volumetric-flask", "flask-1")).toEqual(slotPoint(1));
    // A student's move covers the beaker's slot: it goes to the first slot no item owns.
    const covered = [item("bottle-1", "wash-bottle", "workbench", { x: slotPoint(2).x + 4, y: slotPoint(2).y }), ...shelf.slice(1)];
    expect(stablePlacementPoint({ equipmentInstances: covered, attachments: [] }, "beaker-250ml")).toEqual(slotPoint(3));
    expect(stablePlacementPoint({ equipmentInstances: [], attachments: [] }, "ring-stand")).toEqual({ x: 270, y: 36 });
  });

  it("leaves the runtime's state untouched", () => {
    const instances = [item("bottle-1", "wash-bottle", "shelf"), item("flask-1", "volumetric-flask")];
    const copy = structuredClone(instances);
    stableWorkbenchNodes({ equipmentInstances: instances, attachments: [] });
    expect(instances).toEqual(copy);
  });
});
