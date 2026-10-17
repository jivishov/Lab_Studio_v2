import { BENCH_MM } from "../../adapters/benchCoordinates";
import { SHELF, SIDE_STATION } from "../../adapters/shelfSpots";

/**
 * The open teaching hall around our bench (the lab room, phase 1: `proposals/LAB_ROOM_LAYOUT.md` revision 2, decided
 * 2026-10-16, from seven photos of a real teaching lab). Every place in it, in metres: the worktop's top at y = 0, x to
 * the right, z towards the viewer, the working area's centre at the origin (`toWorld`). The room, its occlusion, the
 * cutaway and the tests all read these numbers.
 *
 * - **Our island:** one long double-sided island with a centre spine. Our station is one section of it; the island
 *   runs on to the left as a neighbouring station, clean and empty, past Home's frame. Its right end is where the
 *   worktop ended before (the side station, its free end), and its front edge is unchanged. Behind the spine it has
 *   a far working side 700 mm deep.
 * - **Behind it:** a 1.5 m aisle, a second island of the same kind (empty), another aisle, and the back wall with a
 *   run of five windows.
 * - **The right end wall,** about 2 m past the island's free end: the fire hose cabinet, an alarm bell and a door (the
 *   photos), and tall storage cabinets and a fume cupboard (extrapolation from teaching labs, finding 14).
 * - **In front:** clear floor to the front wall, about 4 m out. Nothing stands there.
 *
 * Scenery only: nothing here is a runtime object or pickable (G-8, D9). Phase 1 moves no slot, shelf spot, the side
 * station, `BENCH_MM` or Home.
 */
const S = 1.4 / 15; // ROOM_SCALE (room.ts), repeated here so the layout has no import of the room
const mm = 0.001;

export type Box = { min: readonly [number, number, number]; max: readonly [number, number, number] };
const box = (min: [number, number, number], max: [number, number, number]): Box => Object.freeze({ min: Object.freeze(min), max: Object.freeze(max) });

/** The floor and the worktop's height: a 900 mm bench. */
export const FLOOR = -0.9;
/** 3.0 m above the floor, 2.1 m over the worktop (a real lab's height; the photos). */
export const CEILING = 2.1;

/** The shelf's band on the worktop (its 180 mm depth), z. */
const SPINE_FRONT = -(SHELF.centre.yMm - SHELF.depthMm / 2) * mm;
const SPINE_BACK = -(SHELF.centre.yMm + SHELF.depthMm / 2) * mm;
/** The spine's centre line on our island, z. */
export const SPINE_Z = -SHELF.centre.yMm * mm;

/** Our island: its worktop's edges. The front edge and right end are where the worktop ended before (`WORKTOP`). */
export const ISLAND = Object.freeze({
  left: -6.4,
  right: 14.25 * S,
  front: 5 * S,
  /** The far working side: 700 mm behind the spine's band. */
  back: SPINE_BACK - 0.7,
});
const ISLAND_DEPTH = ISLAND.front - ISLAND.back;

/** The aisle behind our island, then the far island of the same kind, facing the same way. */
export const AISLE = 1.5;
export const FAR_ISLAND = Object.freeze({
  left: ISLAND.left,
  right: ISLAND.right,
  front: ISLAND.back - AISLE,
  back: ISLAND.back - AISLE - ISLAND_DEPTH,
});
export const FAR_SPINE_Z = FAR_ISLAND.front - (ISLAND.front - SPINE_Z);

/** The hall's inside faces. */
export const HALL = Object.freeze({
  floor: FLOOR,
  ceiling: CEILING,
  /** About 2 m past the island's free end. */
  right: ISLAND.right + 2.02,
  /** A hall about 12 m wide. */
  left: ISLAND.right + 2.02 - 12,
  /** About 6 m behind our bench's front edge, past the far island and a second aisle. */
  back: -5.85,
  /** About 4 m out (decided); 4.3 m keeps 0.5 m beyond the fixed Home's eye on a portrait tablet. */
  front: 4.3,
  wallThickness: 0.2,
});

/** The windows along the back wall: five, 1.8 m wide, 0.9 to 2.4 m above the floor, spaced along the hall. */
export const WINDOWS = Object.freeze({
  centres: Object.freeze([-2, -1, 0, 1, 2].map((k) => (HALL.left + HALL.right) / 2 + k * 2.3)),
  width: 1.8,
  sill: 0,
  head: 1.5,
});

/** The spine: sections of the reagent shelf 1300 mm apart, each tap in its gap (reagent_shelf.py, SECTION_PITCH). */
export const SPINE = Object.freeze({
  pitch: 1.3,
  /** The sections over the neighbouring station, left of ours (centre x), carrying the lattice rods. */
  neighbour: Object.freeze([1, 2, 3, 4].map((k) => SHELF.centre.xMm * mm - k * 1.3)),
  /** The far island's sections, along its whole spine. */
  far: Object.freeze([0, 1, 2, 3, 4, 5].map((k) => SHELF.centre.xMm * mm - k * 1.3)),
});

/** A column at our island's free end, beyond the side station, with a bench-number sign. */
export const COLUMN = box([ISLAND.right + 0.22, FLOOR, (ISLAND.front + ISLAND.back) / 2 - 0.2], [ISLAND.right + 0.62, CEILING, (ISLAND.front + ISLAND.back) / 2 + 0.2]);

/** On the right end wall. The fire hose cabinet, alarm bell and door are in the photos; the rest is extrapolation. */
export const END_WALL = Object.freeze({
  fireHose: box([HALL.right - 0.23, -0.05, -0.65], [HALL.right, 0.75, 0.15]),
  bell: Object.freeze({ centre: Object.freeze([HALL.right - 0.06, 1.42, -1.75] as const), radius: 0.1 }),
  door: box([HALL.right - 0.05, FLOOR, -2.25], [HALL.right, 1.2, -1.25]),
  tallCabinets: box([HALL.right - 0.5, FLOOR, -4.15], [HALL.right, 1.1, -2.35]),
  fumeCupboard: box([HALL.right - 0.85, FLOOR, -5.75], [HALL.right, 1.5, -4.25]),
});

/** A lab stool by the windows. */
export const STOOL = Object.freeze({ centre: Object.freeze([-1.6, -5.15] as const), radius: 0.19, seat: -0.25 });

/** The shelf's registry bounds (reagent_shelf.py), and the lattice rods' (spine_rods.py), model-local mm. */
const SHELF_BOUNDS = { xMin: -667, xMax: 624, top: 580 };
const RODS_TOP = 1180;

/**
 * The scenery the camera may come behind, each cut away while it is in the way (decision 6), by its box. Our island,
 * its bays over our station and the side station are never cut away.
 */
export const CUT_BOXES = Object.freeze({
  farIsland: box([FAR_ISLAND.left, FLOOR, FAR_ISLAND.back], [FAR_ISLAND.right, SHELF_BOUNDS.top * mm, FAR_ISLAND.front]),
  column: COLUMN,
  neighbourSpine: box(
    [Math.min(...SPINE.neighbour) + SHELF_BOUNDS.xMin * mm, 0, SPINE_BACK],
    [Math.max(...SPINE.neighbour) + SHELF_BOUNDS.xMax * mm, RODS_TOP * mm, SPINE_FRONT + 0.002],
  ),
  tallCabinets: END_WALL.tallCabinets,
  fumeCupboard: END_WALL.fumeCupboard,
  endWall: box([END_WALL.fireHose.min[0], FLOOR, END_WALL.door.min[2]], [HALL.right, 1.55, END_WALL.fireHose.max[2]]),
  stool: box([STOOL.centre[0] - STOOL.radius, FLOOR, STOOL.centre[1] - STOOL.radius], [STOOL.centre[0] + STOOL.radius, STOOL.seat + 0.03, STOOL.centre[1] + STOOL.radius]),
});
export type CutName = keyof typeof CUT_BOXES;

/** The free-standing blocks for the room's occlusion (roomOcclusion.ts): a fixed number, floor upwards. */
export const BLOCKS: readonly Box[] = Object.freeze([
  box([ISLAND.left, FLOOR, ISLAND.back], [ISLAND.right, 0, ISLAND.front]),
  box([FAR_ISLAND.left, FLOOR, FAR_ISLAND.back], [FAR_ISLAND.right, 0, FAR_ISLAND.front]),
  COLUMN,
  END_WALL.tallCabinets,
  box([END_WALL.fumeCupboard.min[0], FLOOR, END_WALL.fumeCupboard.min[2]], [HALL.right, 0, END_WALL.fumeCupboard.max[2]]),
]);

/** What scenery must keep clear (tests): over the working area, the side station and the shelf's band. */
export const KEEP_CLEAR: Readonly<Record<string, Box>> = Object.freeze({
  workingArea: box([-BENCH_MM.width / 2 * mm, 0.001, -BENCH_MM.depth / 2 * mm], [BENCH_MM.width / 2 * mm, 1.5, BENCH_MM.depth / 2 * mm]),
  sideStation: box([SIDE_STATION.xMinMm * mm, 0.001, -SIDE_STATION.yMaxMm * mm], [SIDE_STATION.xMaxMm * mm, 1.5, -SIDE_STATION.yMinMm * mm]),
  shelfBand: box([(SHELF.centre.xMm - SHELF.lengthMm / 2) * mm, 0.001, SPINE_BACK], [(SHELF.centre.xMm + SHELF.lengthMm / 2) * mm, 1.5, SPINE_FRONT]),
});
/** The front zone: the floor between our island and the front wall, where nothing stands. */
export const FRONT_ZONE = box([HALL.left, FLOOR, ISLAND.front + 0.001], [HALL.right, CEILING, HALL.front]);

/** On the working area and the shelf's top: where the cutaway's sight lines from the eye end (with the look-at point). */
export const SIGHT_TARGETS: readonly (readonly [number, number, number])[] = Object.freeze([
  ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * (BENCH_MM.width / 2) * mm, 0, sz * (BENCH_MM.depth / 2) * mm] as const)),
  ...[-1, 1].flatMap((sx) => [SPINE_FRONT, SPINE_BACK].map((z) => [(SHELF.centre.xMm + sx * SHELF.lengthMm / 2) * mm, SHELF.heightMm * mm, z] as const)),
]);
