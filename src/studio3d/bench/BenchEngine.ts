import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { BENCH_MM } from "../adapters/benchCoordinates";
import { fillLevelMm, type SceneContents, type SceneDescription, type SceneItem } from "../adapters/runtimeToScene";
import { ModelLibrary } from "../equipment3d/loadModels";
import type { Equipment3DEntry } from "../equipment3d/types";
import { makeComposer } from "./look/composer";
import { ContactShadows } from "./look/contactShadows";
import { labEnvironment } from "./look/environment";
import { disposeTextures, makeTextures, type BenchTextures } from "./look/textures";
import { buildContents, buildTiltingLiquid, disposeObject, liquidOpacity3D, parseCssColour } from "./scene/contents";
import { buildDisplayFace, type DisplayFace } from "./scene/displays";
import { onsetTilt, pourGeometry, pourQuaternion, rootForLip, streamGeometry, surfaceHeight, UP, vesselSlices } from "./scene/pour";
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

/** A committed pour being drawn: advanced by the render loop, cleaned up when it ends or is cut short. */
interface PourRun {
  tick: (dt: number) => boolean;
  cleanup: () => void;
  resolve: () => void;
}

const MM = 0.001;
export const toWorld = (xMm: number, yMm: number, zMm = 0): THREE.Vector3 => new THREE.Vector3(xMm * MM, zMm * MM, -yMm * MM);
const DEG = Math.PI / 180;
/** Orbit limits (handoff §5.9): elevation 12–70°, as polar angles from straight up. */
const MIN_POLAR = (90 - 70) * DEG;
const MAX_POLAR = (90 - 12) * DEG;

export interface CameraPose {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

/** Show me's timeline (§5.9), seconds: pulse the source, carry the ghost, pulse the target. */
const DEMO = { source: 0.7, travel: 1.2, target: 0.8 };

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
  private beaconId: string | null = null;
  private demo?: { sourceId: string; targetId?: string; t: number; ghost?: THREE.Object3D; material?: THREE.Material; from?: THREE.Vector3; to?: THREE.Vector3 };
  private syncGeneration = 0;
  private syncing: Promise<void> = Promise.resolve();
  /** The last scene drawn, and where each item rests in it, for carry previews. */
  private lastScene?: SceneDescription;
  private readonly restPositions = new Map<string, THREE.Vector3>();
  private readonly restQuaternions = new Map<string, THREE.Quaternion>();
  private pour?: PourRun;
  /** Where a carried item was drawn when it was released, so a pour it starts carries on from there. */
  private releasedCarry?: { instanceId: string; position: THREE.Vector3; quaternion: THREE.Quaternion; at: number };
  private disposed = false;
  private readonly home = { position: new THREE.Vector3(0, 0.62, 1.05), target: new THREE.Vector3(0, 0.06, 0) };
  /** Called after a sync finishes loading, and when the camera moves, so overlays can re-project. */
  onChange?: () => void;
  onManualCamera?: () => void;
  /** GLB bytes downloaded of those requested, and how many models are still loading (§5.2). */
  onLoadProgress?: (loadedBytes: number, totalBytes: number, pending: number) => void;
  /** Canvas pixels covered by floating panels on each side; framing avoids them. */
  panelInsets: { left?: number; right?: number } = {};

  constructor(private readonly canvas: HTMLCanvasElement, private options: BenchEngineOptions) {
    const q = QUALITY[options.quality];
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
    this.renderer.toneMapping = THREE.NeutralToneMapping; // Khronos PBR Neutral
    this.renderer.toneMappingExposure = 1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = q.keyShadow;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.localClippingEnabled = true; // a tilting source's liquid is cut level (pour.ts)

    this.textures = makeTextures(q.textures);
    this.models = new ModelLibrary(this.textures);
    this.models.onProgress = (loaded, total, pending) => this.onLoadProgress?.(loaded, total, pending);
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
    this.controls.minPolarAngle = MIN_POLAR;
    this.controls.maxPolarAngle = MAX_POLAR;
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

  get canvasElement(): HTMLCanvasElement {
    return this.canvas;
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
    if (this.demo) animating = this.tickDemo(dt) || animating;
    if (this.pour) {
      if (this.pour.tick(dt)) animating = true;
      else this.stopPour();
    }
    if (this.controls.autoRotate) {
      this.controls.update(dt);
      animating = true;
    }
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
  sync(description: SceneDescription): Promise<void> {
    const run = this.runSync(description);
    this.syncing = run;
    return run;
  }

  /** Resolves once the latest sync has drawn every item, so bounds used for framing are real. */
  async settled(): Promise<void> {
    let pending: Promise<void>;
    do {
      pending = this.syncing;
      await pending;
    } while (pending !== this.syncing && !this.disposed);
  }

  private async runSync(description: SceneDescription): Promise<void> {
    const generation = ++this.syncGeneration;
    this.stopPour();
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
    // World matrices normally refresh at the next render; picking, labels and framing can run
    // before it, so they are brought up to date with the scene now.
    this.itemLayer.updateMatrixWorld(true);
    this.lastScene = description;
    this.restPositions.clear();
    this.restQuaternions.clear();
    this.items.forEach((view, id) => {
      this.restPositions.set(id, view.root.position.clone());
      this.restQuaternions.set(id, view.root.quaternion.clone());
    });
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
    view.root.updateWorldMatrix(true, true);
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
    this.beaconId = instanceId;
    if (!this.demo) this.placeBeacon(instanceId);
  }

  private placeBeacon(instanceId: string | null): void {
    const at = instanceId ? this.basePosition(instanceId) ?? null : null;
    this.signals.setBeacon(at, instanceId ? this.footprintRadius(instanceId) : 0.05);
    this.requestRender();
  }

  /**
   * Show me (handoff §5.9): the source pulses, a translucent copy of it travels to the target along
   * a lifted carry path and fades, then the target pulses. The ghost is decorative and commits
   * nothing; the source itself never moves (G-3). Under reduced motion only the pulses play.
   */
  showMe(sourceId: string | undefined, targetId: string | undefined): void {
    this.endDemo();
    const source = sourceId ? this.items.get(sourceId) : undefined;
    const target = targetId ? this.items.get(targetId) : undefined;
    if (!source && !target) return;
    // With no source on the bench (it is still in the tray), only the target pulses.
    const demo: NonNullable<BenchEngine["demo"]> = source
      ? { sourceId: source.instanceId, targetId: target?.instanceId, t: 0 }
      : { sourceId: target!.instanceId, t: 0 };
    if (source?.model && target && !this.options.reducedMotion) {
      const material = new THREE.MeshBasicMaterial({ color: "#197b7b", transparent: true, opacity: 0.32, depthWrite: false, toneMapped: false });
      const ghost = source.model.clone(true);
      ghost.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.isMesh) mesh.material = material;
        object.raycast = () => undefined;
      });
      ghost.visible = false;
      ghost.rotation.copy(source.root.rotation);
      this.scene.add(ghost);
      Object.assign(demo, { ghost, material, from: source.root.position.clone(), to: target.root.position.clone() });
    }
    this.demo = demo;
    this.placeBeacon(demo.sourceId);
    this.requestRender();
  }

  private tickDemo(dt: number): boolean {
    const demo = this.demo!;
    demo.t += dt;
    const travelEnd = DEMO.source + (demo.ghost ? DEMO.travel : 0);
    if (demo.ghost && demo.from && demo.to) {
      const u = Math.min(1, Math.max(0, (demo.t - DEMO.source) / DEMO.travel));
      const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      demo.ghost.visible = demo.t >= DEMO.source && u < 1;
      demo.ghost.position.lerpVectors(demo.from, demo.to, e);
      demo.ghost.position.y += Math.sin(u * Math.PI) * 0.06;
      (demo.material as THREE.MeshBasicMaterial).opacity = 0.32 * (u < 0.8 ? 1 : (1 - u) / 0.2);
    }
    if (demo.targetId && demo.t >= travelEnd) this.placeBeacon(demo.targetId);
    if (demo.t < travelEnd + (demo.targetId ? DEMO.target : 0)) return true;
    this.endDemo();
    return false;
  }

  private endDemo(): void {
    const demo = this.demo;
    if (!demo) return;
    this.demo = undefined;
    if (demo.ghost) this.scene.remove(demo.ghost);
    demo.material?.dispose();
    this.placeBeacon(this.beaconId);
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

  /** Items seated on `instanceId` and locked to it, and theirs in turn (the runtime's moveLockedChildren). */
  private lockedDescendants(instanceId: string, seen = new Set<string>()): string[] {
    const children = (this.lastScene?.bench ?? []).filter((item) => item.placement.kind === "seated"
      && item.placement.parentInstanceId === instanceId && item.placement.locked && !seen.has(item.instanceId));
    return children.flatMap((child) => {
      seen.add(child.instanceId);
      return [child.instanceId, ...this.lockedDescendants(child.instanceId, seen)];
    });
  }

  /**
   * Draw a carried item at a bench point, lifted, with whatever is locked to it following along
   * (handoff §5.6); unlocked items stay where the runtime keeps them. The runtime is not touched
   * (G-5): the next sync puts everything back where the runtime has it.
   */
  previewCarry(instanceId: string, xMm: number, yMm: number, liftMm: number, pourToward?: string): void {
    const view = this.items.get(instanceId);
    if (!view) return;
    const base = toWorld(xMm, yMm);
    const rest = this.restPositions.get(instanceId);
    view.root.position.set(base.x, liftMm * MM, base.z);
    // Pour cue (handoff §3.7): over a pour target the source turns its lip to it and tilts about
    // 30° at the lip. No stream; nothing is poured until the runtime accepts the release.
    const towardView = pourToward ? this.items.get(pourToward) : undefined;
    const toward = towardView ? towardView.root.position.clone().sub(view.root.position).setY(0) : undefined;
    if (view.entry && toward && toward.lengthSq() > 1e-8) {
      const geometry = pourGeometry(view.entry);
      const upright = pourQuaternion(geometry, toward.normalize(), 0);
      const tilted = pourQuaternion(geometry, toward, 30 * DEG);
      const lip = geometry.lip.clone().applyQuaternion(upright).add(view.root.position);
      view.root.quaternion.copy(tilted);
      view.root.position.copy(rootForLip(geometry, tilted, lip));
    } else {
      view.root.quaternion.copy(this.restQuaternions.get(instanceId) ?? view.root.quaternion);
    }
    if (rest) {
      const delta = view.root.position.clone().sub(rest);
      for (const id of this.lockedDescendants(instanceId)) {
        const child = this.items.get(id);
        const childRest = this.restPositions.get(id);
        if (child && childRest) child.root.position.copy(childRest).add(delta);
      }
    }
    this.itemLayer.updateMatrixWorld(true);
    this.carried = { instanceId, position: base, lift: liftMm };
    this.signals.setFootprint(base, this.footprintRadius(instanceId));
    this.shadowsDirty = true;
    this.requestRender();
  }

  /**
   * While an item is held, a one-finger touch drag must carry it, not orbit the camera; mouse
   * orbiting is on the right button and unaffected (handoff §5.9, §5.19).
   */
  holdCameraInput(held: boolean): void {
    this.controls.enabled = !held;
  }

  /**
   * Drop a preview without committing: the caller re-syncs to the runtime's scene. On a release,
   * `released` keeps where the item was drawn, so a pour the release commits starts from there.
   */
  endCarryPreview(released = false): void {
    const carried = this.carried ? this.items.get(this.carried.instanceId) : undefined;
    this.releasedCarry = released && carried
      ? { instanceId: carried.instanceId, position: carried.root.position.clone(), quaternion: carried.root.quaternion.clone(), at: performance.now() }
      : undefined;
    this.carried = undefined;
    this.signals.setFootprint(null);
    this.signals.setTarget(null);
    this.requestRender();
  }

  // ---------------------------------------------------------------- committed-action animation

  /**
   * Animate a pour the runtime has already accepted (handoff §5.7; G-3). The source is carried
   * beside the target, turns its lip toward it and tips about the lip until its liquid reaches the
   * lip, just over the target's mouth. It pours for 600–1400 ms scaled by the volume moved (§3.5):
   * a stream in the source's own colour (resolveLiquidStyle), or powder for a solid being dissolved
   * (resolveSolidStyle), falls while the target's level rises and the source's falls between the
   * runtime's before and after volumes, through each fill profile. The source's liquid stays level
   * as it tips. Then it rights itself and is set down where the runtime has it (`returnTo`, the
   * parked spot after a drag). Resolves when done, or at once under reduced motion; the caller then
   * syncs the committed scene, which a new sync also forces early.
   */
  animatePour(args: {
    sourceId: string;
    targetId: string;
    sourceBefore: SceneContents;
    sourceAfter: SceneContents;
    targetBefore: SceneContents;
    targetAfter: SceneContents;
    returnTo?: { xMm: number; yMm: number; yawDeg: number };
  }): Promise<void> {
    this.stopPour();
    const released = this.releasedCarry?.instanceId === args.sourceId && performance.now() - this.releasedCarry.at < 2000
      ? this.releasedCarry : undefined;
    this.releasedCarry = undefined;
    const source = this.items.get(args.sourceId);
    const target = this.items.get(args.targetId);
    if (this.options.reducedMotion || !source?.entry || !target?.entry || source === target) return Promise.resolve();
    const run = this.planPour(source, source.entry, target, target.entry, args, released);
    return new Promise((resolve) => {
      this.pour = { ...run, resolve };
      this.requestRender();
    });
  }

  private planPour(
    source: ItemView,
    sourceEntry: Equipment3DEntry,
    target: ItemView,
    targetEntry: Equipment3DEntry,
    args: Parameters<BenchEngine["animatePour"]>[0],
    released?: { position: THREE.Vector3; quaternion: THREE.Quaternion },
  ): Omit<PourRun, "resolve"> {
    this.itemLayer.updateMatrixWorld(true);
    const geometry = pourGeometry(sourceEntry);
    const jet = geometry.style === "squeeze-jet";
    const solid = args.sourceBefore.kind === "solid";
    const liquidOf = (c: SceneContents) => (c.kind === "liquid" ? c.volumeMl : 0);

    // Where the source starts (the drop point after a drag), rests now, and is set down afterwards.
    const restPos = source.root.position.clone();
    const startPos = released?.position.clone() ?? restPos.clone();
    const startQuat = released?.quaternion.clone() ?? source.root.quaternion.clone();
    const endPos = args.returnTo ? toWorld(args.returnTo.xMm, args.returnTo.yMm).setY(restPos.y) : restPos.clone();
    const endQuat = args.returnTo ? new THREE.Quaternion().setFromAxisAngle(UP, args.returnTo.yawDeg * DEG) : source.root.quaternion.clone();

    // The target's mouth: the top of its fill profile, on its axis.
    const tFill = targetEntry.fill;
    const box = new THREE.Box3().setFromObject(target.model ?? target.root);
    const targetBase = target.root.getWorldPosition(new THREE.Vector3());
    const mouthZ = tFill?.innerBoxMm?.topZ ?? tFill?.innerProfileMm?.at(-1)?.[1] ?? (box.max.y - targetBase.y) / MM;
    const mouthR = (tFill?.innerBoxMm ? Math.min(tFill.innerBoxMm.width, tFill.innerBoxMm.depth) / 2 : tFill?.innerProfileMm?.at(-1)?.[0] ?? 10) * MM;
    const mouth = targetBase.clone().add(new THREE.Vector3(0, mouthZ * MM, 0));

    // Pour from the target's left or right as the camera sees it, the side the source is on, so the
    // stream is not hidden behind either vessel.
    const camRight = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0).setY(0).normalize();
    const sideOf = [endPos, restPos, startPos].map((p) => p.clone().sub(mouth).setY(0)).find((d) => d.length() > 0.03);
    const away = camRight.clone().multiplyScalar(sideOf && sideOf.dot(camRight) > 0 ? 1 : -1);
    const toward = away.clone().negate();

    // The lip's pouring point: just over the mouth (a jet stands off to the side, above it).
    const lipAt = jet
      ? mouth.clone().addScaledVector(away, 0.045).add(new THREE.Vector3(0, 0.055, 0))
      : mouth.clone().addScaledVector(away, mouthR * 0.4).add(new THREE.Vector3(0, 0.004, 0));

    // Tilts: where the liquid first reaches the lip, and where it is when the runtime's volume has
    // left, up to the registry's `pour.tiltDeg` (§5.7), which a source emptied by the pour reaches.
    // Tipping further while liquid remains would show it gone before the runtime says so. Never so
    // upright that the source's body would stand over the target.
    const vessel = vesselSlices(sourceEntry.fill);
    const vBefore = liquidOf(args.sourceBefore);
    const vAfter = liquidOf(args.sourceAfter);
    const minTilt = Math.min(geometry.tiltMax, 55 * DEG);
    let tiltStart = geometry.tiltMax;
    let tiltEnd = geometry.tiltMax;
    if (jet) tiltStart = tiltEnd = geometry.tiltMax;
    else if (solid) tiltStart = Math.max(minTilt, geometry.tiltMax * 0.75);
    else if (vessel && vBefore > 0) {
      tiltStart = Math.max(minTilt, onsetTilt(vessel, geometry, vBefore, geometry.tiltMax));
      tiltEnd = vAfter > 0.05 ? Math.max(tiltStart, onsetTilt(vessel, geometry, vAfter, geometry.tiltMax)) : geometry.tiltMax;
    }
    // Keep the source's base clear of the target when it is short and wide.
    const pourQ = pourQuaternion(geometry, toward, tiltStart);
    const baseEdge = rootForLip(geometry, pourQ, lipAt).add(geometry.lipDir.clone().multiplyScalar(this.footprintRadius(source.instanceId)).applyQuaternion(pourQ));
    const targetR = this.footprintRadius(target.instanceId);
    if (baseEdge.clone().sub(mouth).setY(0).length() < targetR + 0.004 && baseEdge.y < mouth.y + 0.005) lipAt.y += mouth.y + 0.005 - baseEdge.y;

    // Standing beside the target, upright and lifted, before tipping.
    const upright = pourQuaternion(geometry, toward, 0);
    const clear = Math.max(0, targetR + this.footprintRadius(source.instanceId) + 0.01 - geometry.lip.clone().setY(0).length() - lipAt.clone().sub(mouth).setY(0).length());
    const standLip = lipAt.clone().addScaledVector(away, clear);
    standLip.y = Math.max(lipAt.y + 0.015, geometry.lip.y + 0.005);
    const standPos = rootForLip(geometry, upright, standLip);

    // Durations, seconds: the pour itself is 600–1400 ms scaled by the volume moved (§3.5).
    const moved = Math.max(Math.abs(liquidOf(args.targetAfter) - liquidOf(args.targetBefore)), Math.abs(vBefore - vAfter));
    const flow = Math.min(1.4, Math.max(0.6, 0.6 + moved / 125));
    // The carry in and out stays short, so the pour itself keeps most of the time: from a drag's drop
    // point the source is already over the target.
    const T = { approach: released ? 0.3 : 0.45, tilt: 0.35, flow, untilt: 0.3, back: 0.45 };
    const at = { tilt: T.approach, flow: T.approach + T.tilt, untilt: T.approach + T.tilt + flow, back: T.approach + T.tilt + flow + T.untilt };
    const total = at.back + T.back;

    // What falls: the source's own colour, a liquid or a powder.
    const falling = args.sourceBefore;
    let material: THREE.Material | undefined;
    if (falling.kind === "liquid") {
      const { colour, alpha } = parseCssColour(falling.style.fill);
      material = new THREE.MeshPhysicalMaterial({ name: "Pour stream", color: colour, roughness: 0.05, transparent: true,
        opacity: Math.max(0.6, liquidOpacity3D(alpha, falling.style.opacity)), depthWrite: false, envMapIntensity: 1.3 });
    } else if (falling.kind === "solid") {
      material = new THREE.MeshStandardMaterial({ name: "Pour powder", color: parseCssColour(falling.style.fill).colour, roughness: 0.95,
        transparent: true, opacity: 0.85, depthWrite: false });
    }
    const stream = material ? new THREE.Mesh(new THREE.BufferGeometry(), material) : undefined;
    if (stream) {
      stream.visible = false;
      stream.renderOrder = 4;
      stream.raycast = () => undefined;
      this.scene.add(stream);
    }
    const streamRadius = solid ? 0.0022 : jet ? 0.0011 : Math.min(0.0019, Math.max(0.0008, mouthR * 0.3));

    // The source's liquid, cut level by a world-horizontal plane while it tips.
    const surface = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    if (args.sourceBefore.kind === "liquid" && vessel) {
      const tilting = buildTiltingLiquid(sourceEntry, args.sourceBefore, surface);
      if (tilting) this.replaceContents(source, tilting);
    }
    // A racked tube leaves its rack behind (scenery never moves; D9).
    const rack = source.scenery ? { object: source.scenery, position: source.scenery.position.clone(), quaternion: source.scenery.quaternion.clone() } : undefined;
    if (rack) this.itemLayer.attach(rack.object);

    const ease = (u: number) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
    const span = (t: number, from: number, length: number) => Math.min(1, Math.max(0, (t - from) / length));
    const targetLevel = (ml: number) => (tFill ? fillLevelMm(tFill, ml).levelMm : 0);
    let t = 0;
    let lastTarget = Number.NaN;

    const tick = (dt: number): boolean => {
      t = Math.min(total, t + dt);
      const lip = new THREE.Vector3();
      let q: THREE.Quaternion;
      let pos: THREE.Vector3;
      if (t < at.tilt) {
        const u = ease(span(t, 0, T.approach));
        q = startQuat.clone().slerp(upright, u);
        pos = startPos.clone().lerp(standPos, u);
        pos.y += Math.sin(u * Math.PI) * 0.03;
      } else if (t < at.untilt + T.untilt) {
        const tipping = t < at.flow;
        const u = tipping ? span(t, at.tilt, T.tilt) : t < at.untilt ? span(t, at.flow, flow) : span(t, at.untilt, T.untilt);
        // The tilt leads the lip's travel on the way in, so the body swings up and away first.
        const tilt = tipping ? tiltStart * (1 - Math.pow(1 - u, 2)) : t < at.untilt ? tiltStart + (tiltEnd - tiltStart) * ease(u) : tiltEnd * (1 - ease(u));
        const lipU = tipping ? ease(u) : t < at.untilt ? 1 : 1 - ease(u);
        q = pourQuaternion(geometry, toward, tilt);
        pos = rootForLip(geometry, q, standLip.clone().lerp(lipAt, lipU));
      } else {
        const u = ease(span(t, at.back, T.back));
        q = upright.clone().slerp(endQuat, u);
        pos = standPos.clone().lerp(endPos, u);
        pos.y += Math.sin(u * Math.PI) * 0.03;
      }
      source.root.position.copy(pos);
      source.root.quaternion.copy(q);
      source.root.updateMatrixWorld(true);
      lip.copy(geometry.lip).applyQuaternion(q).add(pos);

      // Volumes: the source's leaves as the pour runs; the target's follows once the stream lands.
      const flowT = t - at.flow;
      // The pour eases in and out (§3.5), and so do the levels it moves.
      const sourceU = ease(span(flowT, 0, flow));
      const targetU = ease(span(flowT, Math.min(0.12, flow * 0.2), flow - Math.min(0.12, flow * 0.2)));
      const axis = UP.clone().applyQuaternion(q);
      if (vessel && args.sourceBefore.kind === "liquid") {
        const ml = vBefore + (vAfter - vBefore) * sourceU;
        let h = surfaceHeight(vessel, pos, axis, ml);
        if (!jet && flowT > 0 && flowT < flow) h = Math.min(h, lip.y);
        surface.constant = ml > 0.05 ? h : -1;
      }
      if (solid && args.sourceAfter.kind === "none" && sourceU > 0.35 && source.contents) this.replaceContents(source, undefined);
      if (args.targetAfter.kind === "liquid") {
        const ml = Math.round((liquidOf(args.targetBefore) + (args.targetAfter.volumeMl - liquidOf(args.targetBefore)) * targetU) * 10) / 10;
        const style = args.targetBefore.kind === "liquid" && targetU < 0.5 ? args.targetBefore.style : args.targetAfter.style;
        const key = ml + (style === args.targetAfter.style ? 1e6 : 0);
        if (key !== lastTarget) {
          lastTarget = key;
          this.replaceContents(target, ml > 0 ? buildContents(targetEntry, { ...args.targetAfter, style, volumeMl: ml, ...fillLevelMm(tFill!, ml) }) : undefined);
        }
      }

      // The stream: its leading edge falls from the lip, its trailing edge follows it down.
      if (stream) {
        const s1 = span(flowT, 0, 0.12);
        const s0 = span(flowT, flow - 0.15, 0.15);
        stream.visible = flowT > 0 && s1 > s0 + 0.01;
        if (stream.visible) {
          const landMl = liquidOf(args.targetBefore) + (liquidOf(args.targetAfter) - liquidOf(args.targetBefore)) * targetU;
          const land = targetBase.clone().addScaledVector(away, mouthR * 0.15);
          land.y = targetBase.y + Math.max(targetLevel(landMl), tFill?.innerProfileMm?.[0]?.[1] ?? tFill?.innerBoxMm?.floorZ ?? 0) * MM;
          stream.geometry.dispose();
          stream.geometry = streamGeometry(lip, land, streamRadius, s0, s1, jet && geometry.tipDir ? geometry.tipDir.clone().applyQuaternion(q) : undefined);
        }
      }
      this.shadowsDirty = true;
      this.onChange?.();
      return t < total;
    };

    const cleanup = () => {
      if (stream) {
        this.scene.remove(stream);
        stream.geometry.dispose();
        material?.dispose();
      }
      if (rack) {
        source.root.add(rack.object);
        rack.object.position.copy(rack.position);
        rack.object.quaternion.copy(rack.quaternion);
      }
      // Contents drawn during the pour are rebuilt by the next sync.
      source.contentsKey = "animating";
      target.contentsKey = "animating";
    };
    return { tick, cleanup };
  }

  /** End a running pour now (a new sync, or disposal): nothing it drew is kept. */
  private stopPour(): void {
    const run = this.pour;
    if (!run) return;
    this.pour = undefined;
    run.cleanup();
    run.resolve();
  }

  private replaceContents(view: ItemView, contents: THREE.Object3D | undefined): void {
    if (view.contents) {
      view.root.remove(view.contents);
      disposeObject(view.contents);
      view.contents = undefined;
    }
    if (contents) {
      view.contents = contents;
      view.root.add(contents);
    }
    view.contentsKey = "animating";
  }

  // ---------------------------------------------------------------- camera

  /**
   * Frame a set of items (or the whole bench) with a 650 ms tween, or a cut under reduced motion.
   * `insets` (canvas pixels) are covered by panels; the working set is centred in what remains
   * (handoff §5.9: "fits the working set into the free area around open panels").
   */
  frameItems(instanceIds: string[] | "all", marginFactor = 1.25, insets: { left?: number; right?: number } = this.panelInsets): void {
    const box = new THREE.Box3();
    const views = instanceIds === "all" ? [...this.items.values()] : instanceIds.map((id) => this.items.get(id)).filter(Boolean) as ItemView[];
    views.forEach((view) => box.expandByObject(view.root));
    if (box.isEmpty()) box.set(new THREE.Vector3(-0.5, 0, -0.3), new THREE.Vector3(0.5, 0.25, 0.3));
    this.frameBox(box, marginFactor, insets);
  }

  /**
   * "Whole bench" (§5.9): the bench surface itself, not only what stands on it. `fromFront` looks
   * from the default front direction, whatever the camera is doing (the Studio's Front and Reset).
   */
  frameBench(insets: { left?: number; right?: number } = this.panelInsets, fromFront = false): void {
    const w = (BENCH_MM.width * MM) / 2;
    const d = (BENCH_MM.depth * MM) / 2;
    const front = fromFront ? this.home.position.clone().sub(this.home.target).normalize() : undefined;
    this.frameBox(new THREE.Box3(new THREE.Vector3(-w, 0, -d), new THREE.Vector3(w, 0.12, d)), 0.9, insets, front);
  }

  /** "Overhead" (§5.9): the steepest view the orbit limits allow, over the bench centre. */
  overhead(): void {
    this.controls.maxPolarAngle = MAX_POLAR;
    const distance = 1.7;
    const target = new THREE.Vector3(0, 0, 0);
    this.tweenTo(new THREE.Vector3(0, distance * Math.cos(MIN_POLAR), distance * Math.sin(MIN_POLAR)), target);
  }

  /** The current camera pose, so Examine can return to it (§5.8). */
  pose(): CameraPose {
    return { position: this.camera.position.clone(), target: this.controls.target.clone() };
  }

  /** Back to a saved pose, with the normal orbit limits (Examine's Eye level relaxes them). */
  restorePose(pose: CameraPose): void {
    this.controls.maxPolarAngle = MAX_POLAR;
    this.tweenTo(pose.position.clone(), pose.target.clone());
  }

  /**
   * Examine's Eye level (§5.8): the camera level with the liquid surface, looking straight at it,
   * the correct way to read a meniscus. The level comes from the runtime contents through the fill
   * profile; the item does not move. Level views sit below the normal 12° floor, so the limit is
   * relaxed until `restorePose`.
   */
  eyeLevel(instanceId: string, levelMm: number): void {
    const view = this.items.get(instanceId);
    if (!view) return;
    const target = view.root.position.clone();
    target.y += levelMm * MM;
    const across = this.camera.position.clone().sub(this.controls.target).setY(0);
    if (across.lengthSq() < 1e-6) across.set(0, 0, 1);
    across.normalize().multiplyScalar(0.32);
    this.controls.maxPolarAngle = 90 * DEG;
    this.tweenTo(target.clone().add(across), target);
  }

  private frameBox(box: THREE.Box3, marginFactor: number, insets: { left?: number; right?: number }, direction?: THREE.Vector3): void {
    this.controls.maxPolarAngle = MAX_POLAR;
    const centre = box.getCenter(new THREE.Vector3());
    const radius = Math.max(0.12, box.getSize(new THREE.Vector3()).length() / 2) * marginFactor;
    const dir = direction ?? this.camera.position.clone().sub(this.controls.target).normalize();
    const width = Math.max(1, this.canvas.clientWidth);
    const free = Math.max(0.3, 1 - ((insets.left ?? 0) + (insets.right ?? 0)) / width);
    const distance = Math.min(this.controls.maxDistance, Math.max(this.controls.minDistance, radius / Math.sin((this.camera.fov * DEG) / 2) / Math.sqrt(free)));
    // Shift the look-at point so the set sits in the middle of the uncovered part of the canvas.
    const halfWidthWorld = Math.tan((this.camera.fov * DEG) / 2) * distance * this.camera.aspect;
    const shiftPx = ((insets.left ?? 0) - (insets.right ?? 0)) / 2;
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize().negate();
    const target = centre.clone().addScaledVector(right, -(shiftPx / (width / 2)) * halfWidthWorld);
    this.tweenTo(target.clone().addScaledVector(dir, distance), target);
  }

  /**
   * The Studio's equipment inspection (handoff §4.8): the camera turns slowly around what it
   * frames, all the way round (the ±70° azimuth limit is lifted while it turns). Under reduced
   * motion it does not turn; the item can still be orbited by hand.
   */
  setTurntable(on: boolean): void {
    this.controls.minAzimuthAngle = on ? -Infinity : -70 * DEG;
    this.controls.maxAzimuthAngle = on ? Infinity : 70 * DEG;
    this.controls.autoRotate = on && !this.options.reducedMotion;
    this.controls.autoRotateSpeed = 1.6;
    this.requestRender();
  }

  resetView(): void {
    this.controls.maxPolarAngle = MAX_POLAR;
    this.tweenTo(this.home.position.clone(), this.home.target.clone());
  }

  private tweenTo(position: THREE.Vector3, target: THREE.Vector3): void {
    const duration = this.options.reducedMotion ? 0 : 0.65;
    this.tween = { from: this.camera.position.clone(), to: position, fromTarget: this.controls.target.clone(), toTarget: target, t: 0, duration };
    this.requestRender();
  }

  dispose(): void {
    this.endDemo();
    this.stopPour();
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
