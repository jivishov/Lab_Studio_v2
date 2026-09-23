import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { BENCH_MM } from "../adapters/benchCoordinates";
import type { SceneDescription, SceneItem } from "../adapters/runtimeToScene";
import { ModelLibrary } from "../equipment3d/loadModels";
import type { Equipment3DEntry } from "../equipment3d/types";
import { makeComposer } from "./look/composer";
import { ContactShadows } from "./look/contactShadows";
import { labEnvironment } from "./look/environment";
import { disposeTextures, makeTextures, type BenchTextures } from "./look/textures";
import { buildContents, disposeObject } from "./scene/contents";
import { buildDisplayFace, type DisplayFace } from "./scene/displays";
import { Signals, type TargetRingKind } from "./scene/signals";

/**
 * The live 3D bench (plan D3, D5): an imperative three.js engine inside a thin React component,
 * synced from `runtimeToScene`. It renders on demand, and the resting scene always equals the
 * scene description it was last given (G-3). Carry previews move an item's drawing only and are
 * dropped by the next sync; nothing here commits runtime state (G-5).
 *
 * Coordinates: registry and bench millimetres are (x right, y away, z up); three.js is metres
 * (x right, y up, z toward the viewer), so (x, y, z) mm -> (x, z, -y) / 1000.
 */
export type GraphicsQuality = "high" | "balanced" | "low";

export interface BenchEngineOptions {
  quality: GraphicsQuality;
  reducedMotion: boolean;
}

interface ItemView {
  instanceId: string;
  definitionId: string;
  root: THREE.Group;
  model?: THREE.Object3D;
  contents?: THREE.Object3D;
  contentsKey: string;
  display?: DisplayFace;
  scenery?: THREE.Object3D;
  entry?: Equipment3DEntry;
}

const MM = 0.001;
export const toWorld = (xMm: number, yMm: number, zMm = 0): THREE.Vector3 => new THREE.Vector3(xMm * MM, zMm * MM, -yMm * MM);
const DEG = Math.PI / 180;

const QUALITY: Record<GraphicsQuality, { pixelRatio: number; samples: number; contact: number; keyShadow: boolean; textures: "full" | "reduced" }> = {
  high: { pixelRatio: 2, samples: 4, contact: 1024, keyShadow: true, textures: "full" },
  balanced: { pixelRatio: 1.5, samples: 2, contact: 512, keyShadow: true, textures: "full" },
  low: { pixelRatio: 1, samples: 0, contact: 256, keyShadow: false, textures: "reduced" },
};

export const webgl2Available = (): boolean => {
  try {
    return Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    return false;
  }
};

export class BenchEngine {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(32, 1, 0.02, 20);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly controls: OrbitControls;
  private composer: EffectComposer;
  private readonly textures: BenchTextures;
  private readonly models: ModelLibrary;
  private readonly contact: ContactShadows;
  private readonly signals = new Signals();
  private readonly items = new Map<string, ItemView>();
  private readonly itemLayer = new THREE.Group();
  private readonly raycaster = new THREE.Raycaster();
  private readonly benchPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private frame = 0;
  private dirty = true;
  private shadowsDirty = true;
  private lastTime = 0;
  private tween?: { from: THREE.Vector3; to: THREE.Vector3; fromTarget: THREE.Vector3; toTarget: THREE.Vector3; t: number; duration: number };
  private carried?: { instanceId: string; position: THREE.Vector3; lift: number };
  private syncGeneration = 0;
  private disposed = false;
  private readonly home = { position: new THREE.Vector3(0, 0.62, 1.05), target: new THREE.Vector3(0, 0.06, 0) };
  /** Called after a sync finishes loading, and when the camera moves, so overlays can re-project. */
  onChange?: () => void;
  onManualCamera?: () => void;

  constructor(private readonly canvas: HTMLCanvasElement, private options: BenchEngineOptions) {
    const q = QUALITY[options.quality];
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
    this.renderer.toneMapping = THREE.NeutralToneMapping; // Khronos PBR Neutral
    this.renderer.toneMappingExposure = 1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = q.keyShadow;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.textures = makeTextures(q.textures);
    this.models = new ModelLibrary(this.textures);
    const env = labEnvironment(this.renderer);
    this.scene.environment = env;
    this.scene.background = env;
    this.scene.backgroundBlurriness = 0.42; // a soft-focus room behind the bench (handoff §3.7)
    this.scene.backgroundIntensity = 1.25;

    this.addBench(q.keyShadow);
    this.contact = new ContactShadows({ width: BENCH_MM.width * MM, depth: BENCH_MM.depth * MM, resolution: q.contact, blur: 2.2, opacity: 0.72 });
    this.scene.add(this.contact.group, this.itemLayer, this.signals.group);

    this.camera.position.copy(this.home.position);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.copy(this.home.target);
    // Left button belongs to picking up items; right orbits, middle and Shift+right pan (handoff §5.9).
    this.controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
    this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    this.controls.minAzimuthAngle = -70 * DEG;
    this.controls.maxAzimuthAngle = 70 * DEG;
    this.controls.minPolarAngle = (90 - 70) * DEG;
    this.controls.maxPolarAngle = (90 - 12) * DEG;
    this.controls.minDistance = 0.22;
    this.controls.maxDistance = 2.4;
    this.controls.zoomToCursor = true;
    this.controls.enableDamping = false;
    this.controls.addEventListener("change", () => this.requestRender());
    this.controls.addEventListener("start", () => {
      this.tween = undefined;
      this.onManualCamera?.();
    });
    this.composer = makeComposer(this.renderer, this.scene, this.camera, q.samples);
    this.resize();
  }

  private addBench(keyShadow: boolean): void {
    const T = this.textures;
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(BENCH_MM.width * MM, 0.03, BENCH_MM.depth * MM),
      new THREE.MeshPhysicalMaterial({ name: "Bench worktop", map: T.benchC, roughnessMap: T.benchR, roughness: 1, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.35 }),
    );
    top.position.y = -0.015;
    top.receiveShadow = true;
    top.name = "bench";
    this.scene.add(top);
    const back = new THREE.Mesh(new THREE.BoxGeometry(BENCH_MM.width * MM, 0.06, 0.02),
      new THREE.MeshStandardMaterial({ color: 0xb4bab1, roughness: 0.7 }));
    back.position.set(0, 0.03, -(BENCH_MM.depth * MM) / 2 - 0.01);
    this.scene.add(back);
    const key = new THREE.DirectionalLight(0xfff8f0, keyShadow ? 1.1 : 0.8);
    key.position.set(-0.9, 1.6, 0.7);
    key.castShadow = keyShadow;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -0.8;
    key.shadow.camera.right = 0.8;
    key.shadow.camera.top = 0.5;
    key.shadow.camera.bottom = -0.5;
    key.shadow.radius = 6;
    key.shadow.bias = -0.0004;
    this.scene.add(key);
  }

  setOptions(options: Partial<BenchEngineOptions>): void {
    this.options = { ...this.options, ...options };
    this.requestRender();
  }

  resize(): void {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  requestRender(): void {
    this.dirty = true;
    if (!this.frame && !this.disposed) this.frame = requestAnimationFrame((t) => this.renderFrame(t));
  }

  private renderFrame(time: number): void {
    this.frame = 0;
    const dt = this.lastTime ? Math.min(0.1, (time - this.lastTime) / 1000) : 0;
    this.lastTime = time;
    let animating = this.signals.tick(dt, this.options.reducedMotion);
    if (this.tween) {
      const tw = this.tween;
      tw.t = Math.min(1, tw.t + (tw.duration > 0 ? dt / tw.duration : 1));
      const e = tw.t < 0.5 ? 2 * tw.t * tw.t : 1 - Math.pow(-2 * tw.t + 2, 2) / 2; // ease-in-out
      this.camera.position.lerpVectors(tw.from, tw.to, e);
      this.controls.target.lerpVectors(tw.fromTarget, tw.toTarget, e);
      this.controls.update();
      if (tw.t >= 1) this.tween = undefined;
      else animating = true;
      this.onChange?.();
    }
    if (this.shadowsDirty) {
      this.contact.update(this.renderer, this.scene);
      this.shadowsDirty = false;
    }
    this.composer.render();
    this.dirty = false;
    if (animating) this.requestRender();
    else this.lastTime = 0;
  }

  // ---------------------------------------------------------------- sync from runtime state

  /** Draw exactly this scene. Models load asynchronously; each item appears when its model is ready. */
  async sync(description: SceneDescription): Promise<void> {
    const generation = ++this.syncGeneration;
    this.carried = undefined;
    const wanted = new Set(description.bench.map((item) => item.instanceId));
    for (const [id, view] of this.items) {
      if (!wanted.has(id)) {
        this.itemLayer.remove(view.root);
        if (view.contents) disposeObject(view.contents);
        this.items.delete(id);
      }
    }
    await Promise.all(description.bench.map((item) => this.ensureItem(item)));
    if (generation !== this.syncGeneration || this.disposed) return;
    const byId = new Map(description.bench.map((item) => [item.instanceId, item]));
    const placed = new Set<string>();
    const place = (item: SceneItem, depth = 0): void => {
      if (placed.has(item.instanceId) || depth > 6) return;
      const view = this.items.get(item.instanceId);
      if (!view) return;
      if (item.placement.kind === "bench") {
        view.root.position.copy(toWorld(item.placement.point.xMm, item.placement.point.yMm));
        view.root.rotation.set(0, item.placement.point.yawDeg * DEG, 0);
        // An item standing in scenery (a tube in its rack) rests on the seat, above the bench.
        const seat = item.scenery?.model.sceneryFor?.seatsMm[item.scenery.seatIndex];
        if (seat) view.root.position.y = seat[2] * MM;
      } else {
        const parentItem = byId.get(item.placement.parentInstanceId);
        const parent = this.items.get(item.placement.parentInstanceId);
        if (parentItem) place(parentItem, depth + 1);
        if (parent) {
          const [ax, ay, az] = item.placement.anchorMm;
          const local = new THREE.Vector3(ax * MM, az * MM, -ay * MM).applyEuler(parent.root.rotation);
          view.root.position.copy(parent.root.position).add(local);
          view.root.rotation.set(0, parent.root.rotation.y + item.placement.yawDeg * DEG, 0);
        }
      }
      placed.add(item.instanceId);
    };
    description.bench.forEach((item) => place(item));
    for (const item of description.bench) this.updateItem(item);
    this.shadowsDirty = true;
    this.requestRender();
    this.onChange?.();
  }

  private async ensureItem(item: SceneItem): Promise<void> {
    let view = this.items.get(item.instanceId);
    if (!view) {
      const root = new THREE.Group();
      root.name = `item:${item.instanceId}`;
      root.userData.instanceId = item.instanceId;
      view = { instanceId: item.instanceId, definitionId: item.definitionId, root, contentsKey: "", entry: item.model };
      this.items.set(item.instanceId, view);
      this.itemLayer.add(root);
    }
    if (item.model && !view.model) {
      const model = await this.models.instance(item.model);
      if (this.disposed || this.items.get(item.instanceId) !== view) return;
      model.traverse((object) => { object.userData.instanceId = item.instanceId; });
      view.model = model;
      view.root.add(model);
    }
    if (item.scenery && !view.scenery) {
      const rack = await this.models.instance(item.scenery.model);
      if (this.disposed || this.items.get(item.instanceId) !== view) return;
      // Scenery is drawn with its item and never picked (decision D9).
      rack.traverse((object) => { (object as THREE.Mesh).raycast = () => undefined; });
      const seat = item.scenery.model.sceneryFor?.seatsMm[item.scenery.seatIndex] ?? [0, 0, 0];
      rack.position.set(-seat[0] * MM, -seat[2] * MM, seat[1] * MM);
      view.scenery = rack;
      view.root.add(rack);
    }
  }

  private updateItem(item: SceneItem): void {
    const view = this.items.get(item.instanceId);
    if (!view || !item.model) return;
    const key = JSON.stringify(item.contents);
    if (key !== view.contentsKey) {
      if (view.contents) {
        view.root.remove(view.contents);
        disposeObject(view.contents);
        view.contents = undefined;
      }
      const contents = buildContents(item.model, item.contents);
      if (contents) {
        view.contents = contents;
        view.root.add(contents);
      }
      view.contentsKey = key;
    }
    const display = item.model.displays[0];
    if (display && item.display) {
      if (!view.display) {
        view.display = buildDisplayFace(display, item.display);
        view.root.add(view.display.mesh);
      } else {
        view.display.update(item.display);
      }
    }
  }

  // ---------------------------------------------------------------- queries for input and overlays

  private ndc(clientX: number, clientY: number): THREE.Vector2 {
    const rect = this.canvas.getBoundingClientRect();
    return new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  }

  /** The instance under a client point, if any (scenery and signals are never picked). */
  pick(clientX: number, clientY: number): string | undefined {
    this.raycaster.setFromCamera(this.ndc(clientX, clientY), this.camera);
    const hit = this.raycaster.intersectObject(this.itemLayer, true).find((h) => h.object.userData.instanceId);
    return hit?.object.userData.instanceId as string | undefined;
  }

  /** The bench-plane point under a client point, in bench millimetres (at `heightMm` above it). */
  benchPointAt(clientX: number, clientY: number, heightMm = 0): { xMm: number; yMm: number } | undefined {
    this.raycaster.setFromCamera(this.ndc(clientX, clientY), this.camera);
    this.benchPlane.constant = -heightMm * MM;
    const hit = this.raycaster.ray.intersectPlane(this.benchPlane, new THREE.Vector3());
    return hit ? { xMm: hit.x / MM, yMm: -hit.z / MM } : undefined;
  }

  /** Where an item's top (or `fraction` of its height) appears on the canvas, for labels. */
  screenPoint(instanceId: string, fraction = 0): { x: number; y: number; visible: boolean } | undefined {
    const view = this.items.get(instanceId);
    if (!view) return undefined;
    const box = new THREE.Box3().setFromObject(view.model ?? view.root);
    if (box.isEmpty()) return undefined;
    const p = new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y + (box.max.y - box.min.y) * fraction, (box.min.z + box.max.z) / 2);
    p.project(this.camera);
    const rect = this.canvas.getBoundingClientRect();
    return { x: ((p.x + 1) / 2) * rect.width, y: ((1 - p.y) / 2) * rect.height, visible: p.z < 1 };
  }

  basePosition(instanceId: string): THREE.Vector3 | undefined {
    return this.items.get(instanceId)?.root.position.clone();
  }

  private footprintRadius(instanceId: string): number {
    const fp = this.items.get(instanceId)?.entry?.footprintMm;
    if (!fp) return 0.05;
    return (fp.shape === "circle" ? fp.radius : Math.hypot(fp.width, fp.depth) / 2) * MM;
  }

  // ---------------------------------------------------------------- signals and carry previews

  setBeacon(instanceId: string | null): void {
    const at = instanceId ? this.basePosition(instanceId) ?? null : null;
    this.signals.setBeacon(at, instanceId ? this.footprintRadius(instanceId) : 0.05);
    this.requestRender();
  }

  setSelected(instanceId: string | null): void {
    const at = instanceId ? this.basePosition(instanceId) ?? null : null;
    this.signals.setSelected(at, instanceId ? this.footprintRadius(instanceId) : 0.05);
    this.requestRender();
  }

  setTargetRing(instanceId: string | null, kind: TargetRingKind = "valid", anchorMm?: number[]): void {
    let at: THREE.Vector3 | null = instanceId ? this.basePosition(instanceId) ?? null : null;
    const view = instanceId ? this.items.get(instanceId) : undefined;
    if (at && anchorMm && view) {
      at = at.add(new THREE.Vector3(anchorMm[0] * MM, anchorMm[2] * MM, -anchorMm[1] * MM).applyEuler(view.root.rotation));
    }
    this.signals.setTarget(at, kind, anchorMm ? 0.02 : instanceId ? this.footprintRadius(instanceId) : 0.05);
    this.requestRender();
  }

  /** Draw a carried item at a bench point, lifted; the runtime is not touched (G-5). */
  previewCarry(instanceId: string, xMm: number, yMm: number, liftMm: number): void {
    const view = this.items.get(instanceId);
    if (!view) return;
    const base = toWorld(xMm, yMm);
    view.root.position.set(base.x, liftMm * MM, base.z);
    this.carried = { instanceId, position: base, lift: liftMm };
    this.signals.setFootprint(base, this.footprintRadius(instanceId));
    this.shadowsDirty = true;
    this.requestRender();
  }

  /** Drop a preview without committing: the caller re-syncs to the runtime's scene. */
  endCarryPreview(): void {
    this.carried = undefined;
    this.signals.setFootprint(null);
    this.signals.setTarget(null);
    this.requestRender();
  }

  // ---------------------------------------------------------------- camera

  /** Frame a set of items (or the whole bench) with a 650 ms tween, or a cut under reduced motion. */
  frameItems(instanceIds: string[] | "all", marginFactor = 1.25): void {
    const box = new THREE.Box3();
    const views = instanceIds === "all" ? [...this.items.values()] : instanceIds.map((id) => this.items.get(id)).filter(Boolean) as ItemView[];
    views.forEach((view) => box.expandByObject(view.root));
    if (box.isEmpty()) box.set(new THREE.Vector3(-0.5, 0, -0.3), new THREE.Vector3(0.5, 0.25, 0.3));
    const centre = box.getCenter(new THREE.Vector3());
    const radius = Math.max(0.12, box.getSize(new THREE.Vector3()).length() / 2) * marginFactor;
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    const distance = Math.min(this.controls.maxDistance, Math.max(this.controls.minDistance, radius / Math.sin((this.camera.fov * DEG) / 2)));
    this.tweenTo(centre.clone().addScaledVector(dir, distance), centre);
  }

  resetView(): void {
    this.tweenTo(this.home.position.clone(), this.home.target.clone());
  }

  private tweenTo(position: THREE.Vector3, target: THREE.Vector3): void {
    const duration = this.options.reducedMotion ? 0 : 0.65;
    this.tween = { from: this.camera.position.clone(), to: position, fromTarget: this.controls.target.clone(), toTarget: target, t: 0, duration };
    this.requestRender();
  }

  dispose(): void {
    this.disposed = true;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.controls.dispose();
    this.items.forEach((view) => { if (view.contents) disposeObject(view.contents); });
    this.items.clear();
    this.contact.dispose();
    this.models.dispose();
    disposeTextures(this.textures);
    (this.scene.environment as THREE.Texture | null)?.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}
