import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { solutionTechnique } from "../../domain/fixtures";
import { createRuntimeState, performRuntimeAction } from "../../runtime";
import { resolveInteractionIntent } from "../../runtime/interactionIntents";
import { drawnItem, pourStagingScene, runtimeToScene } from "../adapters/runtimeToScene";
import { onsetTilt, pourGeometry, pourQuaternion, rootForLip, UP, volumeBelow, vesselSlices } from "../bench/scene/pour";
import { equipment3dEntry } from "../equipment3d/readiness";

describe("a committed pour is staged on the committed layout (handoff §5.7, G-3)", () => {
  // The fixture keeps Make a Solution's first step from before its atomization (decided 2026-10-04): a
  // pour from the wash bottle on the shelf into the flask on the shelf, the case this is about.
  const making = solutionTechnique;
  const before = createRuntimeState(making);
  const result = resolveInteractionIntent(making, before, { type: "pourIntent", origin: "keyboard" });
  const after = result.ok ? performRuntimeAction(making, before, result.request) : before;
  const request = result.ok ? result.request : undefined;

  it("has both vessels drawn, holding what they held before the pour", () => {
    expect(request?.sourceInstanceId && request.targetInstanceId).toBeTruthy();
    const staging = pourStagingScene(before, after, making, { sourceId: request!.sourceInstanceId!, targetId: request!.targetInstanceId! });
    // Found where the Player looks for the pour's two vessels, the source on its shelf spot.
    const source = drawnItem(staging, request!.sourceInstanceId!);
    const target = drawnItem(staging, request!.targetInstanceId!);
    expect(target?.contents.kind).toBe("none");
    expect(source?.contents).toMatchObject({ kind: "liquid", volumeMl: 500 });
  });

  it("leaves a shelf source on its shelf spot, holding what it held, for the animation to lift from and return to", () => {
    const sourceId = request!.sourceInstanceId!;
    // The runtime pours from the wash bottle where it stands: it stays on the shelf.
    expect(after.equipmentInstances.find((i) => i.id === sourceId)?.location).toBe("shelf");
    const committed = runtimeToScene(after, making);
    expect(committed.bench.some((i) => i.instanceId === sourceId)).toBe(false);
    const staging = pourStagingScene(before, after, making, { sourceId, targetId: request!.targetInstanceId! });
    expect(staging.bench.some((i) => i.instanceId === sourceId)).toBe(false);
    const source = staging.tray.find((i) => i.instanceId === sourceId)!;
    // On its own spot, with its contents from before the pour.
    expect(source.spot).toEqual(committed.tray.find((i) => i.instanceId === sourceId)!.spot);
    expect(source.contents).toMatchObject({ kind: "liquid", volumeMl: 500 });
    // Every other item is exactly as the committed scene has it.
    for (const item of committed.bench.filter((i) => i.instanceId !== request!.targetInstanceId)) {
      expect(staging.bench.find((i) => i.instanceId === item.instanceId)).toEqual(item);
    }
    for (const item of committed.tray.filter((i) => i.instanceId !== sourceId)) {
      expect(staging.tray.find((i) => i.instanceId === item.instanceId)).toEqual(item);
    }
  });
});

describe("pour geometry", () => {
  const cylinder = equipment3dEntry("graduated-cylinder")!;
  const geometry = pourGeometry(cylinder);
  const vessel = vesselSlices(cylinder.fill)!;

  it("holds the whole volume below a plane above an upright vessel, and none below its floor", () => {
    const full = volumeBelow(vessel, new THREE.Vector3(), UP.clone(), 10);
    expect(full).toBeGreaterThanOrEqual(cylinder.fill!.capacityMl * 0.98);
    expect(volumeBelow(vessel, new THREE.Vector3(), UP.clone(), -1)).toBe(0);
  });

  it("keeps the volume when the vessel tilts (the surface moves, not the amount)", () => {
    const q = pourQuaternion(geometry, new THREE.Vector3(1, 0, 0), (40 * Math.PI) / 180);
    const axis = UP.clone().applyQuaternion(q);
    expect(volumeBelow(vessel, new THREE.Vector3(), axis, 10)).toBeCloseTo(volumeBelow(vessel, new THREE.Vector3(), UP.clone(), 10), 0);
  });

  it("tips the lip down, toward the target", () => {
    const toward = new THREE.Vector3(0, 0, -1);
    const q = pourQuaternion(geometry, toward, (60 * Math.PI) / 180);
    const upright = pourQuaternion(geometry, toward, 0);
    const lip = geometry.lip.clone().applyQuaternion(q);
    expect(lip.y).toBeLessThan(geometry.lip.clone().applyQuaternion(upright).y);
    expect(lip.clone().setY(0).normalize().dot(toward)).toBeGreaterThan(0.99);
    // rootForLip puts the lip exactly where asked.
    const at = new THREE.Vector3(0.1, 0.2, 0.3);
    expect(geometry.lip.clone().applyQuaternion(q).add(rootForLip(geometry, q, at)).distanceTo(at)).toBeLessThan(1e-9);
  });

  it("needs more tilt to pour from a vessel holding less", () => {
    const max = geometry.tiltMax;
    const fuller = onsetTilt(vessel, geometry, cylinder.fill!.capacityMl * 0.8, max);
    const emptier = onsetTilt(vessel, geometry, cylinder.fill!.capacityMl * 0.2, max);
    expect(emptier).toBeGreaterThan(fuller);
    expect(emptier).toBeLessThanOrEqual(max);
  });
});
