import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

/**
 * The DNA microarray 3D lab's frame (`virtual_lab/experiments/dnamicroarray_v2/3d-v3/renderer.js:
 * 94-112, 193-197`), decided 2026-10-03/04: a multisampled linear HDR render; bloom above 1.05 with
 * a 0.5 knee at strength 0.45 (the source's `bloom .9 × .5`); then the source's composite pass,
 * ported as written: Narkowicz ACES at exposure 1, its vignette, output gamma 1/2.2 and a dither.
 * three's own ACES and sRGB output differ from it, so the renderer itself does no tone mapping.
 *
 * three.js's UnrealBloomPass stands in for the source's six-level tent-filtered chain; its high-pass
 * smooth width plays the knee, and it thresholds on luminance where the source uses the brightest
 * channel. On the Low tier the source renders without HDR targets and tone-maps each fragment
 * (`renderer.js:46-50`, `finish`): no bloom, no vignette and no dither, as here.
 */
const MicroarrayOutputShader = {
  name: "MicroarrayOutputShader",
  uniforms: { tDiffuse: { value: null as THREE.Texture | null }, exposure: { value: 1 }, finishing: { value: 1 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float exposure;
    uniform float finishing; // 1: the HDR composite's vignette and dither; 0: the Low tier's plain finish
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0);
      c = clamp(c, 0.0, 64.0);
      c = aces(c * exposure);
      float vig = smoothstep(1.3, 0.3, length((vUv - 0.5) * vec2(1.0, 0.82) * 1.55));
      c *= mix(1.0, mix(0.88, 1.0, vig), finishing);
      c = pow(c, vec3(1.0 / 2.2));
      c += finishing * (hash(gl_FragCoord.xy) - 0.5) / 255.0;
      gl_FragColor = vec4(c, 1.0);
    }`,
};

export const BLOOM = { threshold: 1.05, knee: 0.5, strength: 0.45, radius: 0.55 };

/**
 * Live ambient occlusion on the High and Balanced tiers (the natural room, you 2026-10-12): three.js's GTAO, sized for
 * bench equipment, darkens where things meet, such as a bottle's foot on its shelf or a cuvette in its holder. The room's
 * own corners are darkened on every tier (roomOcclusion.ts).
 */
export const AO = Object.freeze({ radius: 0.07, thickness: 0.04, distanceExponent: 1.4, scale: 1, samples: 16, blend: 0.85 });

/**
 * See-through things are left out of the AO's depth and normals: glass, clear plastic, liquids drawn behind glass,
 * labels and markers. three's pass leaves out only points and lines, and a beaker would otherwise shade what stands
 * behind it.
 */
const seeThrough = (object: THREE.Object3D): boolean => {
  if ((object as THREE.Sprite).isSprite) return true;
  const mesh = object as THREE.Mesh;
  if (!mesh.isMesh) return false;
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return materials.some((m) => m.transparent || ((m as THREE.MeshPhysicalMaterial).transmission ?? 0) > 0);
};

class BenchAOPass extends GTAOPass {
  private readonly hidden: THREE.Object3D[] = [];

  override render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget, deltaTime: number, maskActive: boolean): void {
    this.scene.traverseVisible((object) => { if (seeThrough(object)) this.hidden.push(object); });
    this.hidden.forEach((object) => { object.visible = false; });
    try {
      super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
    } finally {
      this.hidden.forEach((object) => { object.visible = true; });
      this.hidden.length = 0;
    }
  }
}

export const makeComposer = (renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera,
  options: { samples: number; bloom: boolean; ao: boolean }): EffectComposer => {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: options.samples });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  if (options.ao) {
    const ao = new BenchAOPass(scene, camera, size.x, size.y);
    ao.updateGtaoMaterial({ radius: AO.radius, thickness: AO.thickness, distanceExponent: AO.distanceExponent, scale: AO.scale, samples: AO.samples });
    ao.blendIntensity = AO.blend;
    composer.addPass(ao);
  }
  if (options.bloom) {
    const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), BLOOM.strength, BLOOM.radius, BLOOM.threshold);
    (bloom.highPassUniforms as Record<string, THREE.IUniform<number>>).smoothWidth.value = BLOOM.knee;
    composer.addPass(bloom);
  }
  const output = new ShaderPass(MicroarrayOutputShader);
  output.uniforms.finishing.value = options.bloom ? 1 : 0;
  composer.addPass(output);
  return composer;
};
