import { isVisibleWorkbenchLocation } from "../../domain/equipmentLocations";
import type { EquipmentInstance, RuntimeState } from "../../domain/types";
import { getVisualProfile } from "../../equipment/visualCatalog";
import { resolveWorkbenchScene, type RenderNode } from "../../player/resolveWorkbenchScene";
import { resolveAttachments } from "../../runtime/attachments";
import { equipment3dEntry } from "../equipment3d/readiness";
import { fromBench, toBench } from "./benchUnits";
import { benchFootprintOf, footprintsClash, nearestFreeSpot, type FootprintMm } from "./footprints";

/**
 * The 3D bench's own layout (decided 2026-10-11, "Yes, all 3D"): an item the runtime gives no position keeps one
 * spot for the whole run, so nothing on the bench jumps when another item arrives or leaves. 2D's resolver stands
 * such an item at the default slot of its index among the items on the bench at that moment, so items shifted as
 * others came and went (M3's known limit).
 *
 * The slots are 2D's default grid: five a row, 15 on the runtime's 760 × 520 bench. Each of a run's first 15 items,
 * in the runtime's order, owns the slot of its index, whether or not it is on the bench yet. Two kinds of item keep
 * the resolver's position:
 * - one with a position of its own (a student's move, a tray drop);
 * - one set down from another (a receiving attachment), which moves with its parent.
 *
 * Items are kept apart by their real 3D footprints, not the slots' picture sizes (decided 2026-10-22: a slot is about
 * 257 × 191 mm, and a balance, an oven or a sink spilled over its neighbours). So the run's spots are planned once, for
 * every item in the runtime's order whether or not it is on the bench (`runPlan`): its own slot when its footprint
 * clears every spot planned before it (largest items first), else the first clear slot no item owns, else the first
 * clear slot, else the nearest clear spot. An item on the bench stands at its planned spot unless an item with a position of its own is in
 * the way; then it takes the first clear slot no item owns, else the nearest clear spot. Only drawing positions
 * change, for items the runtime has none for: the runtime's state is untouched, so a saved run loads in either player
 * (G-3).
 */
export const SLOT_COUNT = 15;

/** A slot's top-left corner in runtime bench units (2D's `defaultPosition`). */
export const slotPoint = (index: number): { x: number; y: number } => ({ x: 34 + (index % 5) * 148, y: 86 + Math.floor(index / 5) * 160 });

interface Point {
  x: number;
  y: number;
}

/** The room an item of `definitionId` takes on the 3D bench when it stands at runtime point `at`. */
const footprintAt = (definitionId: string, at: Point): FootprintMm => {
  const mm = toBench(definitionId, at);
  return benchFootprintOf(equipment3dEntry(definitionId), mm.xMm, mm.yMm);
};

/** Whether a footprint stands clear of every one of `others`. */
const clearOf = (fp: FootprintMm, others: readonly FootprintMm[]): boolean => others.every((other) => !footprintsClash(fp, other));

/**
 * The runtime point nearest bench point `wanted` where an item of `definitionId` stands clear of every one of `others`
 * (decided 2026-10-22: let go where it would overlap, an item slides to the nearest clear spot). Each candidate is
 * tested where it would stand after conversion to runtime units, which keep an item's art on the bench and round it,
 * so the point is clear as drawn. With the bench full, the point nearest `wanted`.
 */
export const nearestClearPoint = (definitionId: string, wanted: { xMm: number; yMm: number }, others: readonly FootprintMm[]): Point => {
  const converted = (fp: FootprintMm): Point => fromBench(definitionId, fp.xMm, fp.yMm);
  const spot = nearestFreeSpot(benchFootprintOf(equipment3dEntry(definitionId), wanted.xMm, wanted.yMm), others, undefined, undefined,
    (fp) => clearOf(footprintAt(definitionId, converted(fp)), others));
  return converted(spot);
};

/**
 * Where an item goes when its spot is taken: the first clear slot of `slots`, else the nearest clear spot to `from`
 * (the bench full: `from` itself).
 */
const clearSpot = (definitionId: string, slots: readonly number[], from: Point, others: readonly FootprintMm[]): Point => {
  const slot = slots.find((index) => clearOf(footprintAt(definitionId, slotPoint(index)), others));
  return slot !== undefined ? slotPoint(slot) : nearestClearPoint(definitionId, toBench(definitionId, from), others);
};

/**
 * The run's planned spots, worked out once for the run's items whether or not they are on the bench, so no item's spot
 * depends on which others are there. Cached by the run's items. The largest footprints are planned first (in the
 * runtime's order among equals), so a balance, an oven or a sink is not left without room by small items spread over
 * the slots; small items then fill the gaps.
 */
const plans = new Map<string, Map<string, Point>>();
const runPlan = (instances: readonly EquipmentInstance[]): Map<string, Point> => {
  const key = instances.map((instance) => `${instance.id}:${instance.definitionId}`).join("|");
  const cached = plans.get(key);
  if (cached) return cached;
  const owned = Math.min(SLOT_COUNT, instances.length);
  const reserved: FootprintMm[] = [];
  const plan = new Map<string, Point>();
  const area = (instance: EquipmentInstance): number => {
    const fp = footprintAt(instance.definitionId, { x: 0, y: 0 });
    return fp.widthMm * fp.depthMm;
  };
  const order = instances.map((instance, index) => ({ instance, index, area: area(instance) }))
    .sort((a, b) => b.area - a.area || a.index - b.index);
  order.forEach(({ instance, index }) => {
    const own = index < SLOT_COUNT ? index : undefined;
    const from = slotPoint(own ?? index % SLOT_COUNT);
    const at = clearSpot(instance.definitionId, [...(own === undefined ? [] : [own]), ...fallbackOrder(owned)], from, reserved);
    reserved.push(footprintAt(instance.definitionId, at));
    plan.set(instance.id, at);
  });
  if (plans.size > 32) plans.clear();
  plans.set(key, plan);
  return plan;
};

const hasOwnPosition = (instance: EquipmentInstance): boolean => instance.x != null || instance.y != null;

/** The slot an item owns: its index in the runtime's order, among the first 15. */
export const ownedSlot = (state: Pick<RuntimeState, "equipmentInstances">, instanceId: string): number | undefined => {
  const index = state.equipmentInstances.findIndex((instance) => instance.id === instanceId);
  return index >= 0 && index < SLOT_COUNT ? index : undefined;
};

/** Slot order for an item that cannot have its own: unowned slots first, then the rest. */
const fallbackOrder = (owned: number): number[] => {
  const all = Array.from({ length: SLOT_COUNT }, (_, index) => index);
  return [...all.filter((index) => index >= owned), ...all.filter((index) => index < owned)];
};

/**
 * 2D's render nodes with the 3D layout's positions. The nodes are the resolver's (what stands on the bench, and how
 * attachments draw), so no rule of what is on the bench is copied; only where an unplaced item stands differs.
 */
export const stableWorkbenchNodes = (state: Pick<RuntimeState, "equipmentInstances" | "attachments">): RenderNode[] => {
  const nodes = resolveWorkbenchScene(state);
  const byId = new Map(state.equipmentInstances.map((instance) => [instance.id, instance]));
  // The resolver's own rule: an independent receiving child is set down from its parent's position, at the
  // parent's zone anchor (without one, the child stands on its own).
  const anchored = (parentId: string, zoneId: string): boolean => {
    const parent = byId.get(parentId);
    return Boolean(parent && getVisualProfile(parent.definitionId)?.visualZones.find((zone) => zone.id === zoneId)?.anchor);
  };
  const receivingParent = new Map(resolveAttachments(state)
    .filter((attachment) => attachment.renderMode === "independent" && attachment.relationType === "receiving"
      && anchored(attachment.parentInstanceId, attachment.zoneId))
    .map((attachment) => [attachment.childInstanceId, attachment.parentInstanceId]));
  const unplaced = (node: RenderNode): boolean => {
    const instance = byId.get(node.primaryInstanceId);
    return Boolean(instance && !hasOwnPosition(instance) && !receivingParent.has(instance.id));
  };
  const definitionOf = (node: RenderNode): string => byId.get(node.primaryInstanceId)?.definitionId ?? "";
  // Items standing where the runtime has them: obstacles the layout keeps clear of.
  const taken: FootprintMm[] = nodes.filter((node) => !unplaced(node) && !receivingParent.has(node.primaryInstanceId))
    .map((node) => footprintAt(definitionOf(node), node.transform));
  const plan = runPlan(state.equipmentInstances);
  const owned = Math.min(SLOT_COUNT, state.equipmentInstances.length);
  const moved = new Map<string, { x: number; y: number }>();
  const order = (node: RenderNode): number => state.equipmentInstances.findIndex((instance) => instance.id === node.primaryInstanceId);
  const waiting = nodes.filter(unplaced).sort((a, b) => order(a) - order(b));
  // First, every item whose planned spot is clear stands there; planned spots never clash with each other.
  const blocked = waiting.filter((node) => {
    const at = plan.get(node.primaryInstanceId);
    const fp = at && footprintAt(definitionOf(node), at);
    if (!at || !fp || !clearOf(fp, taken)) return true;
    taken.push(fp);
    moved.set(node.primaryInstanceId, at);
    return false;
  });
  // Then, in the runtime's order, an item a positioned item stands in the way of takes a clear slot or spot nearby.
  for (const node of blocked) {
    const definitionId = definitionOf(node);
    const at = clearSpot(definitionId, fallbackOrder(owned), plan.get(node.primaryInstanceId) ?? node.transform, taken);
    taken.push(footprintAt(definitionId, at));
    moved.set(node.primaryInstanceId, at);
  }
  const shift = new Map<string, { dx: number; dy: number }>();
  for (const node of nodes) {
    const at = moved.get(node.primaryInstanceId);
    if (at) shift.set(node.primaryInstanceId, { dx: at.x - node.transform.x, dy: at.y - node.transform.y });
  }
  return nodes.map((node) => {
    const at = moved.get(node.primaryInstanceId);
    if (at) return { ...node, transform: { ...node.transform, x: at.x, y: at.y } };
    // A receiving child moves with its parent.
    const parentShift = shift.get(receivingParent.get(node.primaryInstanceId) ?? "");
    return parentShift ? { ...node, transform: { ...node.transform, x: node.transform.x + parentShift.dx, y: node.transform.y + parentShift.dy } } : node;
  });
};

/**
 * Where an item held by another (a strip hanging in its chamber) would lie if it were loose on the bench now: its own
 * position, else its slot. Scenery it lies on stays there meanwhile (a strip's white tile, decided 2026-10-11).
 */
export const stableRestPoint = (
  state: Pick<RuntimeState, "equipmentInstances" | "attachments">,
  instanceId: string,
): { x: number; y: number } | undefined => {
  const loose = {
    equipmentInstances: state.equipmentInstances.map((instance) =>
      instance.id === instanceId ? { ...instance, location: "workbench" as const, snapZoneId: undefined } : instance),
    attachments: state.attachments.filter((attachment) => attachment.childInstanceId !== instanceId),
  };
  const node = stableWorkbenchNodes(loose).find((candidate) => candidate.primaryInstanceId === instanceId);
  return node ? { x: node.transform.x, y: node.transform.y } : undefined;
};

/** 2D's tray rule stands a ring stand at its own spot at the back (`StudentPlayer.nextPlacementPoint`). */
const RING_STAND_POINT = { x: 270, y: 36 };

/**
 * Where a tray item goes on click or Enter: its planned spot when that is clear, so it stands where it will stay;
 * else the first clear slot (unowned ones first), else the nearest clear spot. Occupancy is the 3D layout's, by real
 * footprints, so nothing it counts stands elsewhere on the bench. A ring stand tries 2D's own spot at the back first.
 */
export const stablePlacementPoint = (
  state: Pick<RuntimeState, "equipmentInstances" | "attachments">,
  definitionId: string,
  instanceId?: string,
): { x: number; y: number } => {
  const id = instanceId ?? state.equipmentInstances.find((instance) => instance.definitionId === definitionId && instance.location === "shelf")?.id;
  const byId = new Map(state.equipmentInstances.map((instance) => [instance.id, instance]));
  const occupied = stableWorkbenchNodes(state)
    .filter((node) => node.primaryInstanceId !== id)
    .map((node) => footprintAt(byId.get(node.primaryInstanceId)?.definitionId ?? "", node.transform));
  const planned = id === undefined ? undefined : runPlan(state.equipmentInstances).get(id);
  const ringStand = definitionId === "ring-stand" || definitionId === "ring-stand-clamp";
  const first = [...(ringStand ? [RING_STAND_POINT] : []), ...(planned ? [planned] : [])]
    .find((point) => clearOf(footprintAt(definitionId, point), occupied));
  if (first) return first;
  const own = id === undefined ? undefined : ownedSlot(state, id);
  const from = planned ?? slotPoint(own ?? state.equipmentInstances.filter((instance) => isVisibleWorkbenchLocation(instance.location)).length % SLOT_COUNT);
  return clearSpot(definitionId, [...(own === undefined ? [] : [own]), ...fallbackOrder(Math.min(SLOT_COUNT, state.equipmentInstances.length))], from, occupied);
};
