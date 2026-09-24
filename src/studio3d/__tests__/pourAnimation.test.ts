import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { applyTechniqueConfiguration } from "../../data/techniqueConfiguration";
import type { TechniqueDefinition } from "../../domain/types";
import { createRuntimeState, performRuntimeAction } from "../../runtime";
import { resolveInteractionIntent } from "../../runtime/interactionIntents";
import { pourStagingScene, runtimeToScene } from "../adapters/runtimeToScene";
import { onsetTilt, pourGeometry, pourQuaternion, rootForLip, UP, volumeBelow, vesselSlices } from "../bench/scene/pour";
import { equipment3dEntry } from "../equipment3d/readiness";

const readTechnique = (id: string): TechniqueDefinition =>
  JSON.parse(readFileSync(join(process.cwd(), "public", "techniques", `${id}.json`), "utf8")) as TechniqueDefinition;

describe("a committed pour is staged on the committed layout (handoff §5.7, G-3)", () => {
  const making = applyTechniqueConfiguration(readTechnique("making-solution"), {
    initialSolventVolumeMl: "50", soluteMassG: "1.06", finalVolumeMl: "100", solutionObservation: "clear colourless solution",
  });
  const before = createRuntimeState(making);
  const result = resolveInteractionIntent(making, before, { type: "pourIntent", origin: "keyboard" });
  const after = result.ok ? performRuntimeAction(making, before, result.request) : before;
  const request = result.ok ? result.request : undefined;

  it("has both vessels on the bench, holding what they held before the pour", () => {
    expect(request?.sourceInstanceId && request.targetInstanceId).toBeTruthy();
    const staging = pourStagingScene(before, after, making, { sourceId: request!.sourceInstanceId!, targetId: request!.targetInstanceId! });
    const source = staging.bench.find((i) => i.instanceId === request!.sourceInstanceId);
    const target = staging.bench.find((i) => i.instanceId === request!.targetInstanceId);
    expect(target?.contents.kind).toBe("none");
    expect(source?.contents).toMatchObject({ kind: "liquid", volumeMl: 500 });
  });

  it("stands a shelf source beside the target for the animation only", () => {
    const sourceId = request!.sourceInstanceId!;
    // The runtime pours from the wash bottle where it stands: it stays on the shelf.
    expect(after.equipmentInstances.find((i) => i.id === sourceId)?.location).toBe("shelf");
    expect(runtimeToScene(after, making).bench.some((i) => i.instanceId === sourceId)).toBe(false);
    const staging = pourStagingScene(before, after, making, { sourceId, targetId: request!.targetInstanceId! });
    const target = staging.bench.find((i) => i.instanceId === request!.targetInstanceId)!;
    const source = staging.bench.find((i) => i.instanceId === sourceId)!;
    expect(source.placement.kind).toBe("bench");
    if (source.placement.kind === "bench" && target.placement.kind === "bench") {
      expect(source.placement.point.yMm).toBe(target.placement.point.yMm);
      expect(Math.abs(source.placement.point.xMm - target.placement.point.xMm)).toBeGreaterThan(80);
    }
    // Every other item is exactly as the committed scene has it.
    const committed = runtimeToScene(after, making);
    for (const item of committed.bench.filter((i) => i.instanceId !== request!.targetInstanceId)) {
      expect(staging.bench.find((i) => i.instanceId === item.instanceId)).toEqual(item);
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
