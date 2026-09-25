import * as THREE from "three";
import { v1InteractionZones } from "../../../domain/interactionZones";
import type { AttachmentRelation } from "../../../domain/types";
import { localPoint } from "./pour";

/**
 * The weighing animation (handoff §5.7 and §6; plan §2.4, item 3): once the runtime has accepted a
 * reading, the vessel is shown set on the instrument's seat, rests there, and returns to where the
 * runtime keeps it. The runtime's `weigh` neither seats nor moves the vessel, so this is
 * presentation only: when it ends, the resting scene is the runtime's again (G-3). Pure path maths,
 * testable without WebGL. Three.js world metres, y up; the seat anchor in model-local millimetres.
 */

/** The instrument's "placed on" zone that accepts the vessel (src/domain/interactionZones.ts), if any. */
export const readingSeatZone = (sourceDefinitionId: string, targetDefinitionId: string): string | undefined =>
  v1InteractionZones.find((zone) => zone.ownerDefinitionId === targetDefinitionId && zone.relationType === "placedOn"
    && zone.accepts.includes(sourceDefinitionId))?.id;

/**
 * Whether the runtime already holds the vessel on that seat, as weighing's placement does (its
 * place step seats the watch glass on the pan). The resting scene then shows it there, so a
 * reading needs no set-on animation.
 */
export const heldOnSeat = (attachments: readonly AttachmentRelation[], sourceId: string, targetId: string, zoneId: string): boolean =>
  attachments.some((relation) => relation.childInstanceId === sourceId && relation.parentInstanceId === targetId
    && relation.zoneId === zoneId);

/**
 * Phase lengths in seconds. The vessel is lifted, carried level, and lowered onto the seat; it rests;
 * then it is lifted, carried back and lowered where the runtime keeps it. Carrying level just above
 * the seat takes it through the instrument's glass draft shield, as a hand reaches in through its
 * door, and never through the instrument's body.
 */
export const SET_ON_PHASES = Object.freeze({ lift: 0.2, carry: 0.35, lower: 0.2, rest: 0.9 });
export const SET_ON_SECONDS = 2 * (SET_ON_PHASES.lift + SET_ON_PHASES.carry + SET_ON_PHASES.lower) + SET_ON_PHASES.rest;

/** How far above the highest of start, seat and rest the vessel is carried, metres. */
export const SET_ON_CLEARANCE_M = 0.02;

const ease = (u: number): number => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);

/** The seat in world metres: the instrument's registry anchor for the zone, placed and turned with it. */
export const seatPoint = (anchorMm: number[], instrumentPosition: THREE.Vector3, instrumentRotation: THREE.Euler): THREE.Vector3 =>
  localPoint(anchorMm).applyEuler(instrumentRotation).add(instrumentPosition);

/** Where the vessel is `t` seconds in; `done` once it is back at `rest`, where the runtime keeps it. */
export const setOnPosition = (
  start: THREE.Vector3,
  seat: THREE.Vector3,
  rest: THREE.Vector3,
  t: number,
): { position: THREE.Vector3; done: boolean } => {
  const { lift, carry, lower, rest: hold } = SET_ON_PHASES;
  const height = Math.max(start.y, seat.y, rest.y) + SET_ON_CLEARANCE_M;
  const above = (point: THREE.Vector3) => new THREE.Vector3(point.x, height, point.z);
  // One lift, carry and set-down from `from` to `to`, `u` seconds in; undefined once it is over.
  const move = (from: THREE.Vector3, to: THREE.Vector3, u: number): THREE.Vector3 | undefined => {
    if (u < lift) return from.clone().lerp(above(from), ease(u / lift));
    if (u < lift + carry) return above(from).lerp(above(to), ease((u - lift) / carry));
    if (u < lift + carry + lower) return above(to).lerp(to, ease((u - lift - carry) / lower));
    return undefined;
  };
  const leg = lift + carry + lower;
  const elapsed = Math.max(0, t);
  if (elapsed < leg) return { position: move(start, seat, elapsed)!, done: false };
  if (elapsed < leg + hold) return { position: seat.clone(), done: false };
  const back = move(seat, rest, elapsed - leg - hold);
  return back ? { position: back, done: false } : { position: rest.clone(), done: true };
};
