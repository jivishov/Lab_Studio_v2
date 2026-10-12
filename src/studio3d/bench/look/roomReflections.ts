import * as THREE from "three";

/**
 * Reflections of the room itself (the natural room, you 2026-10-12): the built room, its lights and the reagent shelf
 * are rendered once into a cube from above the middle of the bench and prefiltered (PMREM), so glass and the worktop
 * reflect the window, the ceiling's panels and the shelf instead of the microarray lab's analytic room
 * (environment.ts, which lights the first capture's own reflections). As before, the map gives reflections only
 * (roomLighting.ts).
 *
 * A capture again (once the shelf has loaded) renders into the same target, so the texture materials already hold
 * stays theirs.
 */
export const REFLECTION_PROBE = Object.freeze({
  /** Above the middle of the working area, metres. */
  position: new THREE.Vector3(0.1, 0.32, 0),
  near: 0.02,
  far: 12,
});

export class RoomReflections {
  private readonly cube: THREE.WebGLCubeRenderTarget;
  private readonly camera: THREE.CubeCamera;
  private readonly pmrem: THREE.PMREMGenerator;
  private target?: THREE.WebGLRenderTarget;

  constructor(private readonly renderer: THREE.WebGLRenderer, size: number) {
    this.cube = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: false });
    this.camera = new THREE.CubeCamera(REFLECTION_PROBE.near, REFLECTION_PROBE.far, this.cube);
    this.camera.position.copy(REFLECTION_PROBE.position);
    this.pmrem = new THREE.PMREMGenerator(renderer);
  }

  /** The prefiltered map, once captured. */
  get texture(): THREE.Texture | undefined {
    return this.target?.texture;
  }

  /** Render `scene` with only `keep` (and its lights) visible, into the same map each time. */
  capture(scene: THREE.Scene, keep: ReadonlySet<THREE.Object3D>): THREE.Texture {
    const hidden: THREE.Object3D[] = [];
    for (const child of scene.children) {
      if (keep.has(child) || !child.visible) continue;
      child.visible = false;
      hidden.push(child);
    }
    try {
      this.camera.update(this.renderer, scene);
    } finally {
      hidden.forEach((child) => { child.visible = true; });
    }
    this.target = this.pmrem.fromCubemap(this.cube.texture, this.target ?? null);
    return this.target.texture;
  }

  dispose(): void {
    this.cube.dispose();
    this.pmrem.dispose();
    this.target?.dispose();
  }
}
