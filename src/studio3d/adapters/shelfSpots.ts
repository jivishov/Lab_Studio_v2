import { equipment3dEntry, equipment3dRegistry } from "../equipment3d/readiness";
import type { Equipment3DEntry } from "../equipment3d/types";
import type { BenchPointMm } from "./benchCoordinates";

/**
 * Where each item the runtime has on `shelf` is drawn in 3D (the shelf in place of the tray, option B, approved
 * 2026-10-11; `proposals/SHELF_INSTEAD_OF_TRAY.md`). Presentation only: the runtime location stays `shelf`, and 2D
 * draws it as its sidebar (G-3).
 *
 * - **The reagent shelf** (D9 scenery, `reagent-shelf`) stands behind the working area on two tiers. An item longer
 *   than the shelf is deep lies along the tier; one too tall for the gap under the upper tier stands on the upper
 *   tier. Each of the rest goes to the tier holding fewer, so the two hold their share. On each tier the items
 *   stand left to right in start order, spread evenly along it, as a stocked shelf is: apart enough to tell, tag and
 *   take one at the Home view (touch targets of at least 44 px where the count allows).
 * - **The side station** is the bench's continuation past its right end (decided 2026-10-11). The large stations
 *   (ring stand, analytical balance, Bunsen burner, spectrophotometer; decision 2 and its fidelity note) stand
 *   there in rows, back to front, in start order.
 *
 * As the bench's slots (stableBench.ts), every item that starts on the shelf owns its spot for the whole run, held
 * free while it is on the bench, so an item put back goes back to its own spot and nothing on the shelf moves when
 * another item leaves. An item that first reaches the shelf later takes the middle of the widest free gap left
 * between them, so nothing that started there moves for it either.
 *
 * Bench millimetres as everywhere in 3D: x to the right, y away from the viewer, z up, origin at the working
 * area's centre (benchCoordinates.ts). `point` is where the item's origin stands, as on the bench; `zMm` is the
 * height of the surface it stands on.
 */

/** The reagent shelf, as the Blender module builds it (`tools/blender/equipment/reagent_shelf.py`). */
export const SHELF = Object.freeze({
  id: "reagent-shelf",
  /** Its origin on the bench: the centre of its footprint. */
  centre: Object.freeze({ xMm: 0, yMm: 460 }),
  lengthMm: 1200,
  depthMm: 180,
  boardMm: 18,
  /** Each end upright's thickness. */
  uprightMm: 24,
  /** The tiers' top surfaces above the bench top, lower then upper. */
  tierTopsMm: Object.freeze([300, 520]),
});

/** The side station: the worktop past the working area's right end (bench mm). */
export const SIDE_STATION = Object.freeze({ xMinMm: 740, xMaxMm: 1300, yMinMm: -320, yMaxMm: 540 });

/** The large stations, which stand at the side station (decision 2, with the spectrophotometer). */
export const LARGE_STATION_IDS: ReadonlySet<string> = new Set(["analytical-balance", "bunsen-burner", "ring-stand", "spectrophotometer"]);

/** Clearance between items, and from the uprights and the shelf's edges. */
const GAP_MM = 22;
const EDGE_MM = 10;
/** Clearance kept above an item standing under the upper tier, so it lifts off without touching. */
const HEADROOM_MM = 12;

const tierXMin = SHELF.centre.xMm - SHELF.lengthMm / 2 + SHELF.uprightMm + EDGE_MM;
const tierXMax = SHELF.centre.xMm + SHELF.lengthMm / 2 - SHELF.uprightMm - EDGE_MM;
/** The free height between the lower tier and the board above it. */
export const LOWER_TIER_CLEAR_MM = SHELF.tierTopsMm[1] - SHELF.boardMm - SHELF.tierTopsMm[0];
/** Depth an item may take on a tier before it lies along it. */
const TIER_DEPTH_MM = SHELF.depthMm - 2 * EDGE_MM;

export interface ShelfSpot {
  /** On a tier of the reagent shelf, or at the side station. */
  place: "tier" | "station";
  /** 0 the lower tier, 1 the upper; at the side station, undefined. */
  tier?: 0 | 1;
  /** Where the item's origin stands (benchRest items: their footprint centre, as on the bench). */
  point: BenchPointMm;
  /** The height of the surface it stands on: a tier's top, or 0 at the side station. */
  zMm: number;
  /** The centre of the space it takes (its tag sits under it). */
  centre: { xMm: number; yMm: number };
  /** The space it takes, as drawn there (after any turn). */
  widthMm: number;
  depthMm: number;
  heightMm: number;
  /** Placed past the end of the space (an item that does not fit); drawn, but reported. */
  overflow?: true;
}

export interface ShelfMember {
  instanceId: string;
  definitionId: string;
  /** Not among the run's start items: it takes a free gap and moves none of them (stableShelfOrder). */
  late?: true;
}

interface Extent {
  /** Model-local x and y ranges as drawn at yaw 0, relative to the bench point. */
  x: [number, number];
  y: [number, number];
  height: number;
}

const sceneryEntry = (id: string): Equipment3DEntry | undefined =>
  equipment3dRegistry.entries.find((entry) => entry.scenery && entry.definitionId === id);

/** The extent an item takes standing where its point is, at yaw 0: its model, or its support with it. */
export const drawnExtent = (entry: Equipment3DEntry | undefined): Extent => {
  const bounds = entry?.boundsMm;
  if (!entry || !bounds) {
    const fp = entry?.footprintMm;
    const w = fp?.shape === "rect" ? fp.width : fp?.shape === "circle" ? fp.radius * 2 : 80;
    const d = fp?.shape === "rect" ? fp.depth : fp?.shape === "circle" ? fp.radius * 2 : 80;
    return { x: [-w / 2, w / 2], y: [-d / 2, d / 2], height: Math.max(entry?.grip.heightMm ?? 0, 100) };
  }
  const [x0, y0, z0] = bounds.min;
  const [x1, y1, z1] = bounds.max;
  const rest = entry.benchRest;
  let extent: Extent;
  if (rest && Math.abs(Math.abs(rest.rollDeg) - 90) < 1) {
    // Lying flat: its length (model z) runs along bench y, centred on its point (benchRest's shift).
    const length = z1 - z0;
    extent = { x: [x0, x1], y: [-length / 2, length / 2], height: y1 - y0 };
  } else if (rest) {
    // Turned over (a funnel mouth-down): the same footprint, centred on its point.
    extent = { x: [-(x1 - x0) / 2, (x1 - x0) / 2], y: [-(y1 - y0) / 2, (y1 - y0) / 2], height: z1 - z0 };
  } else {
    extent = { x: [x0, x1], y: [y0, y1], height: z1 - z0 };
  }
  // An item that stands in its support (a test tube in its rack) takes the support's room as well.
  const support = entry.requiresSupport ? sceneryEntry(entry.requiresSupport) : undefined;
  const seat = support?.sceneryFor?.seatsMm[1];
  if (support?.boundsMm && seat) {
    const sx: [number, number] = [support.boundsMm.min[0] - seat[0], support.boundsMm.max[0] - seat[0]];
    const sy: [number, number] = [support.boundsMm.min[1] - seat[1], support.boundsMm.max[1] - seat[1]];
    extent = {
      x: [Math.min(extent.x[0], sx[0]), Math.max(extent.x[1], sx[1])],
      y: [Math.min(extent.y[0], sy[0]), Math.max(extent.y[1], sy[1])],
      height: Math.max(extent.height + seat[2], support.boundsMm.max[2] - support.boundsMm.min[2]),
    };
  }
  return extent;
};

/** Turned 90° about the vertical (three's +y, bench x toward bench +y): local x runs along bench y. */
const turned = (extent: Extent): Extent => ({ x: [-extent.y[1], -extent.y[0]], y: [extent.x[0], extent.x[1]], height: extent.height });

const round1 = (value: number): number => Math.round(value * 10) / 10;

export const isLargeStation = (definitionId: string, entry = equipment3dEntry(definitionId)): boolean => {
  if (LARGE_STATION_IDS.has(definitionId)) return true;
  // Anything too deep for a tier either way round goes to the side station too.
  const extent = drawnExtent(entry);
  return Math.min(extent.x[1] - extent.x[0], extent.y[1] - extent.y[0]) > TIER_DEPTH_MM;
};

/**
 * One spot per member, in the order given (start order first, stableShelfOrder). Pure and deterministic: the same
 * members give the same spots. `entryFor` is the registry lookup, replaceable in tests.
 */
export const shelfSpots = (
  members: readonly ShelfMember[],
  entryFor: (definitionId: string) => Equipment3DEntry | undefined = equipment3dEntry,
): Map<string, ShelfSpot> => {
  const spots = new Map<string, ShelfSpot>();
  type TierItem = ShelfMember & { extent: Extent; yawDeg: number };
  const station: Array<ShelfMember & { extent: Extent }> = [];
  const items: TierItem[] = [];
  const late: TierItem[] = [];
  const width = (extent: Extent) => extent.x[1] - extent.x[0];
  const tierRoom = tierXMax - tierXMin;
  const isTall = (item: TierItem) => item.extent.height > LOWER_TIER_CLEAR_MM - HEADROOM_MM;

  for (const member of members) {
    const entry = entryFor(member.definitionId);
    const raw = drawnExtent(entry);
    if (isLargeStation(member.definitionId, entry)) {
      station.push({ ...member, extent: raw });
      continue;
    }
    // Longer than the shelf is deep: it lies along the tier.
    const along = raw.y[1] - raw.y[0] > TIER_DEPTH_MM && raw.y[1] - raw.y[0] > raw.x[1] - raw.x[0];
    const item = { ...member, extent: along ? turned(raw) : raw, yawDeg: along ? 90 : 0 };
    (member.late ? late : items).push(item);
  }

  // Tall items stand on the upper tier. Each of the rest, in start order, goes to the tier holding fewer (the one with
  // more room left on a tie, then the lower) if it fits there, else to the other: an even count keeps neighbours apart.
  const used: [number, number] = [0, 0];
  const count: [number, number] = [0, 0];
  const tierOf = new Map<string, 0 | 1>();
  for (const item of items.filter(isTall)) {
    tierOf.set(item.instanceId, 1);
    used[1] += width(item.extent) + GAP_MM;
    count[1] += 1;
  }
  for (const item of items) {
    if (tierOf.has(item.instanceId)) continue;
    const need = width(item.extent) + GAP_MM;
    const roomier: 0 | 1 = count[0] !== count[1] ? (count[0] < count[1] ? 0 : 1) : used[0] <= used[1] ? 0 : 1;
    const other: 0 | 1 = roomier === 0 ? 1 : 0;
    const tier = used[roomier] + need - GAP_MM <= tierRoom || used[other] + need - GAP_MM > tierRoom ? roomier : other;
    tierOf.set(item.instanceId, tier);
    used[tier] += need;
    count[tier] += 1;
  }

  const shelfY = SHELF.centre.yMm;
  const place = (item: TierItem, tier: 0 | 1, left: number, overflow: boolean) => {
    const w = width(item.extent);
    spots.set(item.instanceId, {
      place: "tier",
      tier,
      point: { xMm: round1(left - item.extent.x[0]), yMm: round1(shelfY - (item.extent.y[0] + item.extent.y[1]) / 2), yawDeg: item.yawDeg },
      zMm: SHELF.tierTopsMm[tier],
      centre: { xMm: round1(left + w / 2), yMm: round1(shelfY) },
      widthMm: round1(w),
      depthMm: round1(item.extent.y[1] - item.extent.y[0]),
      heightMm: round1(item.extent.height),
      ...(overflow ? { overflow: true as const } : {}),
    });
  };
  // Spread evenly: the centres an equal step apart along the tier, so neighbours stand as far apart as the count
  // allows on screen too, then pushed apart where two would come closer than the clearance (right, then back from the
  // far end). An item that still starts before the tier's start does not fit: it is packed and reported.
  for (const tier of [0, 1] as const) {
    const row = items.filter((item) => tierOf.get(item.instanceId) === tier);
    const half = row.map((item) => width(item.extent) / 2);
    const centres = row.map((_, i) => tierXMin + (tierRoom * (i + 0.5)) / row.length);
    centres.forEach((_, i) => {
      centres[i] = Math.max(centres[i], i === 0 ? tierXMin + half[0] : centres[i - 1] + half[i - 1] + GAP_MM + half[i]);
    });
    for (let i = row.length - 1; i >= 0; i--) {
      centres[i] = Math.min(centres[i], i === row.length - 1 ? tierXMax - half[i] : centres[i + 1] - half[i + 1] - GAP_MM - half[i]);
    }
    const fits = !row.length || centres[0] - half[0] >= tierXMin - 0.01;
    let cursor = tierXMin;
    row.forEach((item, i) => {
      const w = width(item.extent);
      if (fits) return place(item, tier, centres[i] - half[i], false);
      const overflow = cursor + w > tierXMax + 0.01;
      place(item, tier, overflow ? tierXMax - w : cursor, overflow);
      cursor += w + GAP_MM;
    });
  }

  // A late item: the middle of the widest gap it fits with clearance, on either tier (a tall one, the upper only).
  for (const item of late) {
    const w = width(item.extent);
    let best: { tier: 0 | 1; x0: number; x1: number } | undefined;
    for (const tier of isTall(item) ? [1 as const] : [0 as const, 1 as const]) {
      const taken = [...spots.values()].filter((s) => s.place === "tier" && s.tier === tier)
        .map((s) => [s.centre.xMm - s.widthMm / 2, s.centre.xMm + s.widthMm / 2]).sort((p, q) => p[0] - q[0]);
      let from = tierXMin - GAP_MM;
      for (const [x0, x1] of [...taken, [tierXMax + GAP_MM, tierXMax + GAP_MM]]) {
        if (x0 - from - 2 * GAP_MM >= w && (!best || x0 - from > best.x1 - best.x0)) best = { tier, x0: from, x1: x0 };
        from = Math.max(from, x1);
      }
    }
    if (best) place(item, best.tier, (best.x0 + best.x1) / 2 - w / 2, false);
    else place(item, isTall(item) ? 1 : 0, tierXMax - w, true);
  }

  // The side station: rows from the back, left to right.
  let rowTop = SIDE_STATION.yMaxMm;
  let rowDepth = 0;
  let cursor = SIDE_STATION.xMinMm;
  for (const item of station) {
    const w = width(item.extent);
    const d = item.extent.y[1] - item.extent.y[0];
    if (cursor > SIDE_STATION.xMinMm && cursor + w > SIDE_STATION.xMaxMm) {
      rowTop -= rowDepth + GAP_MM * 2;
      rowDepth = 0;
      cursor = SIDE_STATION.xMinMm;
    }
    const overflow = cursor + w > SIDE_STATION.xMaxMm + 0.01 || rowTop - d < SIDE_STATION.yMinMm - 0.01;
    spots.set(item.instanceId, {
      place: "station",
      point: { xMm: round1(cursor - item.extent.x[0]), yMm: round1(rowTop - item.extent.y[1]), yawDeg: 0 },
      zMm: 0,
      centre: { xMm: round1(cursor + w / 2), yMm: round1(rowTop - d / 2) },
      widthMm: round1(w),
      depthMm: round1(d),
      heightMm: round1(item.extent.height),
      ...(overflow ? { overflow: true as const } : {}),
    });
    rowDepth = Math.max(rowDepth, d);
    cursor += w + GAP_MM * 2;
  }
  return spots;
};

/**
 * The shelf's members in spot order: every item that starts on the shelf (`startShelf`, the run's start order),
 * whether or not it is there now, then any other item now on the shelf, in the runtime's order. So an item that
 * starts on the shelf keeps one spot for the whole run.
 */
export const stableShelfOrder = (
  instances: ReadonlyArray<{ id: string; definitionId: string; location: string }>,
  startShelf: readonly string[] | undefined,
): ShelfMember[] => {
  const byId = new Map(instances.map((instance) => [instance.id, instance]));
  const start = startShelf ?? instances.filter((instance) => instance.location === "shelf").map((instance) => instance.id);
  const members: ShelfMember[] = [];
  const seen = new Set<string>();
  for (const id of start) {
    const instance = byId.get(id);
    if (!instance || seen.has(id)) continue;
    seen.add(id);
    members.push({ instanceId: id, definitionId: instance.definitionId });
  }
  for (const instance of instances) {
    if (instance.location !== "shelf" || seen.has(instance.id)) continue;
    seen.add(instance.id);
    members.push({ instanceId: instance.id, definitionId: instance.definitionId, ...(startShelf ? { late: true as const } : {}) });
  }
  return members;
};
