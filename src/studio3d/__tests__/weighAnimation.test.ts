import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { acceptedDropCallout } from "../bench/input/useBenchCarry";
import type { AttachmentRelation } from "../../domain/types";
import { tuneMaterials } from "../bench/look/materials";
import type { BenchTextures } from "../bench/look/textures";
import { heldOnSeat, readingSeatZone, seatPoint, SET_ON_CLEARANCE_M, SET_ON_PHASES, SET_ON_SECONDS, setOnPosition } from "../bench/scene/setOn";
import { equipment3dEntry } from "../equipment3d/readiness";

/**
 * The weighing animation (handoff §5.7, §6; plan §2.4): presentation only, it shows the vessel on
 * the pan and returns it where the runtime keeps it. And the callout that asks for the step card's
 * entry before a drop the runtime would refuse (G-2).
 */

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const close = (a: THREE.Vector3, b: THREE.Vector3) => {
  expect(a.x).toBeCloseTo(b.x, 6);
  expect(a.y).toBeCloseTo(b.y, 6);
  expect(a.z).toBeCloseTo(b.z, 6);
};

describe("where a reading's vessel is shown (the semantic zone registry)", () => {
  it("finds the balance's pan for a watch glass, and nothing for items the pan does not accept", () => {
    expect(readingSeatZone("watch-glass", "analytical-balance")).toBe("analytical-balance-pan");
    expect(readingSeatZone("spatula", "analytical-balance")).toBeUndefined();
    expect(readingSeatZone("watch-glass", "volumetric-flask")).toBeUndefined();
  });

  it("animates nothing when the runtime already holds the vessel on that seat, as weighing's placement does", () => {
    const onPan: AttachmentRelation = {
      id: "watch-glass-1-on-pan", parentInstanceId: "analytical-balance-1", childInstanceId: "watch-glass-1",
      zoneId: "analytical-balance-pan", relationType: "placedOn", renderMode: "independent",
    };
    expect(heldOnSeat([onPan], "watch-glass-1", "analytical-balance-1", "analytical-balance-pan")).toBe(true);
    expect(heldOnSeat([], "watch-glass-1", "analytical-balance-1", "analytical-balance-pan")).toBe(false);
    expect(heldOnSeat([onPan], "watch-glass-2", "analytical-balance-1", "analytical-balance-pan")).toBe(false);
    expect(heldOnSeat([{ ...onPan, parentInstanceId: "analytical-balance-2" }], "watch-glass-1", "analytical-balance-1", "analytical-balance-pan")).toBe(false);
  });

  it("places the seat at the balance's registry anchor, turned with the balance", () => {
    const anchor = equipment3dEntry("analytical-balance")?.anchors["analytical-balance-pan"]?.positionMm;
    expect(anchor).toBeDefined();
    close(seatPoint([0, 40, 90], v(-0.214, 0, -0.074), new THREE.Euler(0, 0, 0)), v(-0.214, 0.09, -0.114));
    // Turned half a turn, "away" becomes toward the viewer.
    close(seatPoint([0, 40, 90], v(0, 0, 0), new THREE.Euler(0, Math.PI, 0)), v(0, 0.09, 0.04));
  });
});

describe("the set-on path", () => {
  const start = v(-0.5, 0, -0.13);
  const seat = v(-0.21, 0.09, -0.11);
  const rest = v(-0.5, 0, -0.13);
  const { lift, carry, lower, rest: hold } = SET_ON_PHASES;
  const leg = lift + carry + lower;

  it("lasts the two legs and the rest", () => {
    expect(SET_ON_SECONDS).toBeCloseTo(2 * leg + hold, 9);
  });

  it("starts where the vessel is and lifts it straight up before carrying it", () => {
    close(setOnPosition(start, seat, rest, 0).position, start);
    const lifted = setOnPosition(start, seat, rest, lift).position;
    expect(lifted.x).toBeCloseTo(start.x, 6);
    expect(lifted.z).toBeCloseTo(start.z, 6);
    expect(lifted.y).toBeCloseTo(seat.y + SET_ON_CLEARANCE_M, 6);
  });

  it("carries it level, above everything it passes between", () => {
    const mid = setOnPosition(start, seat, rest, lift + carry / 2).position;
    expect(mid.y).toBeCloseTo(Math.max(start.y, seat.y, rest.y) + SET_ON_CLEARANCE_M, 6);
  });

  it("sets it on the seat and holds it there, then returns it to its rest and ends", () => {
    close(setOnPosition(start, seat, rest, leg).position, seat);
    close(setOnPosition(start, seat, rest, leg + hold / 2).position, seat);
    expect(setOnPosition(start, seat, rest, leg + hold / 2).done).toBe(false);
    const end = setOnPosition(start, seat, rest, SET_ON_SECONDS + 0.01);
    close(end.position, rest);
    expect(end.done).toBe(true);
  });

  it("returns to the latest rest, not the start, when a drag released it elsewhere", () => {
    const released = v(-0.21, 0.016, -0.23);
    const end = setOnPosition(released, seat, rest, SET_ON_SECONDS + 0.01);
    close(end.position, rest);
  });
});

describe("a vessel on the pan is seen through the draft shield", () => {
  const glassPane = () => new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1), new THREE.MeshStandardMaterial({ name: "Borosilicate glass" }));
  const textures = {} as BenchTextures;

  it("blends an instrument's glass, so transmissive glassware inside it still draws", () => {
    const pane = glassPane();
    tuneMaterials(pane, textures, new Map(), { enclosureGlass: true });
    const m = pane.material as THREE.MeshPhysicalMaterial;
    expect(m.transmission).toBe(0);
    expect(m.transparent).toBe(true);
    expect(m.opacity).toBeLessThan(0.2);
    expect(m.depthWrite).toBe(false);
    expect(pane.castShadow).toBe(false);
    // Picking sees through it to an item seated inside (BenchEngine.pick).
    expect(pane.userData.enclosureGlass).toBe(true);
  });

  it("keeps glassware itself transmissive", () => {
    const vessel = glassPane();
    tuneMaterials(vessel, textures, new Map());
    const m = vessel.material as THREE.MeshPhysicalMaterial;
    expect(m.transmission).toBe(1);
    expect(m.transparent).toBe(false);
    expect(vessel.userData.enclosureGlass).toBeUndefined();
  });
});

describe("the callout over a target the step accepts", () => {
  it("asks for the step card's entry first in guided mode, when it is missing", () => {
    expect(acceptedDropCallout(true, false, "Release to read the balance")).toEqual({ text: "Fill in the step card first", kind: "input" });
    expect(acceptedDropCallout(true, true, "Release to read the balance")).toEqual({ text: "Release to read the balance", kind: "valid" });
  });

  it("stays neutral in assessment mode either way", () => {
    expect(acceptedDropCallout(false, false, "Release to read the balance")).toEqual({ text: "Release to try this", kind: "valid" });
    expect(acceptedDropCallout(false, true, "Release to read the balance")).toEqual({ text: "Release to try this", kind: "valid" });
  });
});
