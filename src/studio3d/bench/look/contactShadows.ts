import * as THREE from "three";
import { HorizontalBlurShader } from "three/addons/shaders/HorizontalBlurShader.js";
import { VerticalBlurShader } from "three/addons/shaders/VerticalBlurShader.js";

/**
 * Soft contact shadows under every item, glass included (ported from the prototype's look.js):
 * a depth render of the scene from just under the bench, looking up, blurred and laid back on
 * the worktop. Darkness falls off with height, so a lifted item's shadow softens and fades.
 */
export class ContactShadows {
  readonly group = new THREE.Group();
  private readonly rt: THREE.WebGLRenderTarget;
  private readonly rtBlur: THREE.WebGLRenderTarget;
  private readonly plane: THREE.Mesh;
  private readonly blurPlane: THREE.Mesh;
  private readonly camera: THREE.OrthographicCamera;
  private readonly depthMaterial: THREE.ShaderMaterial;
  private readonly hBlur: THREE.ShaderMaterial;
  private readonly vBlur: THREE.ShaderMaterial;

  constructor(
    private readonly options: { width: number; depth: number; far?: number; resolution?: number; blur?: number; opacity?: number },
  ) {
    const { width, depth, far = 0.09, resolution = 1024, opacity = 0.75 } = options;
    const targetOptions = { type: THREE.HalfFloatType };
    this.rt = new THREE.WebGLRenderTarget(resolution, resolution, targetOptions);
    this.rt.texture.generateMipmaps = false;
    this.rtBlur = new THREE.WebGLRenderTarget(resolution, resolution, targetOptions);
    this.rtBlur.texture.generateMipmaps = false;
    const geo = new THREE.PlaneGeometry(width, depth).rotateX(Math.PI / 2);
    this.group.rotation.x = Math.PI / 2;
    this.group.position.set(0, 0.0006, 0);
    this.plane = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: this.rt.texture, transparent: true, opacity, depthWrite: false, toneMapped: false }));
    this.plane.renderOrder = -1;
    this.plane.scale.y = -1;
    this.plane.rotation.x = -Math.PI / 2;
    this.plane.raycast = () => undefined;
    this.blurPlane = new THREE.Mesh(geo);
    this.blurPlane.visible = false;
    this.camera = new THREE.OrthographicCamera(-width / 2, width / 2, depth / 2, -depth / 2, 0, far);
    this.group.add(this.plane, this.blurPlane, this.camera);
    this.depthMaterial = new THREE.ShaderMaterial({
      vertexShader: "varying float vD; void main() { vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p; vD = p.z / p.w * 0.5 + 0.5; }",
      fragmentShader: "varying float vD; void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, pow(clamp(1.0 - vD, 0.0, 1.0), 1.6)); }",
      transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    });
    this.hBlur = new THREE.ShaderMaterial(HorizontalBlurShader);
    this.hBlur.depthTest = false;
    this.vBlur = new THREE.ShaderMaterial(VerticalBlurShader);
    this.vBlur.depthTest = false;
  }

  private blurPass(renderer: THREE.WebGLRenderer, amount: number): void {
    this.blurPlane.visible = true;
    this.blurPlane.material = this.hBlur;
    this.hBlur.uniforms.tDiffuse.value = this.rt.texture;
    this.hBlur.uniforms.h.value = amount / 256;
    renderer.setRenderTarget(this.rtBlur);
    renderer.render(this.blurPlane, this.camera);
    this.blurPlane.material = this.vBlur;
    this.vBlur.uniforms.tDiffuse.value = this.rtBlur.texture;
    this.vBlur.uniforms.v.value = amount / 256;
    renderer.setRenderTarget(this.rt);
    renderer.render(this.blurPlane, this.camera);
    this.blurPlane.visible = false;
  }

  update(renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
    const blur = this.options.blur ?? 2.2;
    const background = scene.background;
    const previousTarget = renderer.getRenderTarget();
    const clear = renderer.getClearColor(new THREE.Color());
    const clearAlpha = renderer.getClearAlpha();
    const autoShadows = renderer.shadowMap.autoUpdate;
    this.plane.visible = false;
    scene.background = null;
    scene.overrideMaterial = this.depthMaterial;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(this.rt);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, this.camera);
    scene.overrideMaterial = null;
    this.blurPass(renderer, blur);
    this.blurPass(renderer, blur * 0.4);
    renderer.setRenderTarget(previousTarget);
    renderer.setClearColor(clear, clearAlpha);
    renderer.shadowMap.autoUpdate = autoShadows;
    scene.background = background;
    this.plane.visible = true;
  }

  dispose(): void {
    this.rt.dispose();
    this.rtBlur.dispose();
    this.plane.geometry.dispose();
    (this.plane.material as THREE.Material).dispose();
    this.depthMaterial.dispose();
    this.hBlur.dispose();
    this.vBlur.dispose();
  }
}
