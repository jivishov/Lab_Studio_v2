import { isVisibleWorkbenchLocation } from "../../domain/equipmentLocations";
import type { EquipmentInstance, RuntimeState } from "../../domain/types";
import { getBenchSize, getVisualProfile } from "../../equipment/visualCatalog";
import { resolveWorkbenchScene, type RenderNode } from "../../player/resolveWorkbenchScene";
import { resolveAttachments } from "../../runtime/attachments";

/**
 * The 3D bench's own layout (decided 2026-10-11, "Yes, all 3D"): an item the runtime gives no position keeps one
 * slot for the whole run, so nothing on the bench jumps when another item arrives or leaves. 2D's resolver stands
 * such an item at the default slot of its index among the items on the bench at that moment, so items shifted as
 * others came and went (M3's known limit).
 *
 * The slots are 2D's default grid: five a row, 15 on the runtime's 760 × 520 bench. Each of a run's first 15 items,
 * in the runtime's order, owns the slot of its index, whether or not it is on the bench yet. Two kinds of item keep
 * the resolver's position:
 * - one with a position of its own (a student's move, a tray drop);
 * - one set down from another (a receiving attachment), which moves with its parent.
 * An item whose slot such an item covers, or that owns none (the 16th onward), takes the first free slot no item
 * owns, else the first free slot. Only drawing positions change, for items the runtime has none for: the runtime's
 * state is untouched, so a saved run loads in either player (G-3).
 */
export const SLOT_COUNT = 15;

/** A slot's top-left corner in runtime bench units (2D's `defaultPosition`). */
export const slotPoint = (index: number): { x: number; y: number } => ({ x: 34 + (index % 5) * 148, y: 86 + Math.floor(index / 5) * 160 });

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 2D's placement test (`nextPlacementPoint`): two boxes clash when they share 5 % of the smaller. */
export const clash = (a: Box, b: Box): boolean => {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  const smaller = Math.min(a.width * a.height, b.width * b.height);
  return smaller > 0 && width > 0 && height > 0 && (width * height) / smaller >= 0.05;
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
  const box = (node: RenderNode, at: { x: number; y: number }): Box =>
    ({ x: at.x + node.bounds.x, y: at.y + node.bounds.y, width: node.bounds.width, height: node.bounds.height });
  const fixed = nodes.filter((node) => !unplaced(node) && !receivingParent.has(node.primaryInstanceId))
    .map((node) => box(node, node.transform));
  const owned = Math.min(SLOT_COUNT, state.equipmentInstances.length);
  const taken = new Set<number>();
  const moved = new Map<string, { x: number; y: number }>();
  const free = (node: RenderNode, slot: number): boolean =>
    !taken.has(slot) && fixed.every((other) => !clash(box(node, slotPoint(slot)), other));
  const order = (node: RenderNode): number => state.equipmentInstances.findIndex((instance) => instance.id === node.primaryInstanceId);
  // Owners first, in the runtime's order, so an item's own slot never goes to an item placed after it.
  for (const node of nodes.filter(unplaced).sort((a, b) => order(a) - order(b))) {
    const own = ownedSlot(state, node.primaryInstanceId);
    const slot = own !== undefined && free(node, own) ? own : fallbackOrder(owned).find((index) => free(node, index));
    if (slot === undefined) continue;
    taken.add(slot);
    moved.set(node.primaryInstanceId, slotPoint(slot));
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

/** 2D's tray rule stands a ring stand at its own spot at the back (`StudentPlayer.nextPlacementPoint`). */
const RING_STAND_POINT = { x: 270, y: 36 };

/**
 * Where a tray item goes on click or Enter: the slot it owns when that is clear, so it stands where it will stay;
 * else the first clear slot (unowned ones first). Occupancy is the 3D layout's, so nothing it counts stands
 * elsewhere on the bench. With no clear slot, the slot after the last bench item, as in 2D.
 */
export const stablePlacementPoint = (
  state: Pick<RuntimeState, "equipmentInstances" | "attachments">,
  definitionId: string,
  instanceId?: string,
): { x: number; y: number } => {
  const id = instanceId ?? state.equipmentInstances.find((instance) => instance.definitionId === definitionId && instance.location === "shelf")?.id;
  const occupied = stableWorkbenchNodes(state)
    .filter((node) => node.primaryInstanceId !== id)
    .map((node) => ({ x: node.transform.x + node.bounds.x, y: node.transform.y + node.bounds.y, width: node.bounds.width, height: node.bounds.height }));
  const size = getBenchSize(definitionId);
  const clear = (point: { x: number; y: number }): boolean =>
    occupied.every((other) => !clash({ x: point.x, y: point.y, width: size.width, height: size.height }, other));
  const own = id === undefined ? undefined : ownedSlot(state, id);
  const candidates = [
    ...(definitionId === "ring-stand" || definitionId === "ring-stand-clamp" ? [RING_STAND_POINT] : []),
    ...(own === undefined ? [] : [slotPoint(own)]),
    ...fallbackOrder(Math.min(SLOT_COUNT, state.equipmentInstances.length)).map(slotPoint),
  ];
  return candidates.find(clear)
    ?? slotPoint(state.equipmentInstances.filter((instance) => isVisibleWorkbenchLocation(instance.location)).length);
};
