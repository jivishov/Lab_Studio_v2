import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { VignetteShader } from "three/addons/shaders/VignetteShader.js";

/**
 * Multisampled HDR render, Khronos PBR Neutral tone mapping (set on the renderer; true base
 * colours) and a light vignette. No bloom (plan §6.2, handoff §3.7).
 */
export const makeComposer = (renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, samples: number): EffectComposer => {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new OutputPass());
  const vignette = new ShaderPass(VignetteShader);
  vignette.uniforms.offset.value = 0.9;
  vignette.uniforms.darkness.value = 0.35;
  composer.addPass(vignette);
  return composer;
};
