import * as THREE from "three";
import type { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { BENCH_MM } from "../adapters/benchCoordinates";
import { fillLevelMm, type SceneContents, type SceneDescription, type SceneItem } from "../adapters/runtimeToScene";
import { ModelLibrary } from "../equipment3d/loadModels";
import type { Equipment3DEntry } from "../equipment3d/types";
import {
  applyView, clampAt, clampManual, copyView, DEFAULT_VIEW, easeInOutCubic, FAR, fitBest, FOV, lerpView, MANUAL, NEAR,
  orbitBy, panTiltBy, PRESETS, safeRects, zoomBy, type OrbitView, type Rect,
} from "./camera/benchCamera";
import { makeComposer } from "./look/composer";
import { ContactShadows } from "./look/contactShadows";
import { labEnvironment } from "./look/environment";
import { applyRoomLighting } from "./look/roomLighting";
import { buildRoom, roomBackground, type Room } from "./look/room";
import { disposeTextures, makeTextures, type BenchTextures } from "./look/textures";
import { buildContents, buildTiltingLiquid, disposeObject, liquidOpacity3D, parseCssColour } from "./scene/contents";
import { buildDisplayFace, type DisplayFace } from "./scene/displays";
import { onsetTilt, pourGeometry, pourQuaternion, rootForLip, streamGeometry, surfaceHeight, UP, vesselSlices } from "./scene/pour";
import { seatPoint, setOnPosition } from "./scene/setOn";
import { Signals, TOKENS, type TargetRingKind } from "./scene/signals";

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
  /** Resting per `benchRest`: the origin's offset from the footprint centre on the bench, and its lift. */
  benchShift?: THREE.Vector3;
  benchLift?: number;
  /** The item's yaw on the bench, for carrying a `benchRest` item upright. */
  restYaw?: number;
  /** The form drawn and whether it is drawn wet (Pack 2), so they are applied only when they change. */
  formKey?: string;
  /** The model's own materials, kept while a wet look replaces them. */
  dryMaterials?: Map<THREE.Mesh, THREE.Material | THREE.Material[]>;
  /** Hinged doors (Pack 2: the drying oven's), each turned about its pivot toward its goal. */
  doors?: Array<{ id: string; pivot: THREE.Object3D; stateKey: string; openRad: number; angle: number; goal: number }>;
}

/** A committed pour being drawn: advanced by the render loop, cleaned up when it ends or is cut short. */
interface PourRun {
  tick: (dt: number) => boolean;
  cleanup: () => void;
  resolve: () => void;
}

/** A vessel shown on an instrument's seat for a committed reading; `finish` returns it to its rest. */
interface SetOnRun {
  tick: (dt: number) => boolean;
  finish: () => void;
}

const MM = 0.001;
export const toWorld = (xMm: number, yMm: number, zMm = 0): THREE.Vector3 => new THREE.Vector3(xMm * MM, zMm * MM, -yMm * MM);
const DEG = Math.PI / 180;
/** The Studio turntable's turn, rad/s (what OrbitControls' autoRotateSpeed 1.6 gave). */
const TURNTABLE_RAD_PER_S = ((2 * Math.PI) / 60) * 1.6;

/** A camera pose to come back to (Examine): the microarray lab's orbit view. */
export type CameraPose = OrbitView;

/** Show me's timeline (§5.9), seconds: pulse the source, carry the ghost, pulse the target. */
const DEMO = { source: 0.7, travel: 1.2, target: 0.8 };
/**
 * A slender item lying on the bench (a spatula, a stirring rod) is a few pixels tall on screen, so
 * an invisible box over it takes the pick: at least this tall and this wide, in millimetres.
 */
const PICK_PROXY = { belowHeightMm: 10, heightMm: 16, minWidthMm: 24 };
const PICK_PROXY_MATERIAL = new THREE.MeshBasicMaterial();

/**
 * Graphics tiers. Pixel-ratio cap, MSAA, key shadow map and bloom are the DNA microarray 3D lab's
 * (`3d-v3/renderer.js:114`, adopted 2026-10-03/04); contact shadows and texture sizes are Lab Studio's.
 */
const QUALITY: Record<GraphicsQuality, { pixelRatio: number; samples: number; shadowMap: number; bloom: boolean; contact: number; textures: "full" | "reduced" }> = {
  high: { pixelRatio: 1.6, samples: 4, shadowMap: 2048, bloom: true, contact: 1024, textures: "full" },
  balanced: { pixelRatio: 1.25, samples: 4, shadowMap: 2048, bloom: true, contact: 512, textures: "full" },
  low: { pixelRatio: 1, samples: 0, shadowMap: 1024, bloom: false, contact: 256, textures: "reduced" },
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
  readonly camera = new THREE.PerspectiveCamera(FOV, 1, NEAR, FAR);
  private readonly renderer: THREE.WebGLRenderer;
  /** The microarray lab's bench view (camera/benchCamera.ts), decided 2026-10-03/04. */
  private view: OrbitView = DEFAULT_VIEW();
  /** Set while an item is held, so a touch drag carries it instead of moving the camera. */
  private cameraHeld = false;
  private turntable = false;
  private camDrag?: { id: number; button: number; mode: "orbit" | "pan"; x: number; y: number; startX: number; startY: number; drag: boolean };
  private readonly touches = new Map<number, { x: number; y: number }>();
  private touchGesture?: { startX: number; startY: number; x: number; y: number; drag: boolean; span?: number; manual: boolean };
  private detachCameraInput?: () => void;
  private composer: EffectComposer;
  private readonly textures: BenchTextures;
  private readonly models: ModelLibrary;
  private readonly contact: ContactShadows;
  /** The teaching-lab room and its lights (scenery, G-8). */
  private readonly room: Room;
  private readonly signals = new Signals();
  private readonly items = new Map<string, ItemView>();
  private readonly itemLayer = new THREE.Group();
  private readonly raycaster = new THREE.Raycaster();
  private readonly benchPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private frame = 0;
  private dirty = true;
  private shadowsDirty = true;
  private lastTime = 0;
  private tween?: { from: OrbitView; to: OrbitView; t: number; duration: number };
  private carried?: { instanceId: string; position: THREE.Vector3; lift: number };
  private beaconId: string | null = null;
  private demo?: { sourceId: string; targetId?: string; viaId?: string; t: number; ghost?: THREE.Object3D; material?: THREE.Material;
    from?: THREE.Vector3; via?: THREE.Vector3; to?: THREE.Vector3 };
  private syncGeneration = 0;
  private syncing: Promise<void> = Promise.resolve();
  /** The last scene drawn, and where each item rests in it, for carry previews. */
  private lastScene?: SceneDescription;
  private readonly restPositions = new Map<string, THREE.Vector3>();
  private readonly restQuaternions = new Map<string, THREE.Quaternion>();
  private pour?: PourRun;
  private setOn?: SetOnRun;
  /** A control being pressed: its objects move into the panel and back (presentation only). */
  private controlPress?: { objects: THREE.Object3D[]; rest: THREE.Vector3[]; offset: THREE.Vector3; t: number };
  /** The control the guided cue lights, if any. */
  private controlCue?: { instanceId: string; controlId: string };
  /** A scoop drawn on a carried tool (a spatula dipped into a solid): a carry cue only (G-3). */
  private toolLoad?: { instanceId: string; object: THREE.Object3D };
  /** A committed tool transfer being drawn: the tool tips its scoop onto the target. */
  private toolRun?: SetOnRun;
  /** A pipette held over a vessel while liquid is added a drop at a time (decided 2026-10-02). */
  private held?: { itemId: string; overId: string };
  /**
   * A wash bottle held over what it rinses between the squirts of a counted rinse (decided
   * 2026-10-05), with the boat it rinses held tipped over the funnel, and where each goes back to
   * after the last squirt. Like a held pipette, the hold outlasts each sync. `away` keeps every
   * squirt on the same side, so nothing jumps between them.
   */
  private squirtHold?: {
    sourceId: string;
    away: THREE.Vector3;
    source: { pos: THREE.Vector3; quat: THREE.Quaternion };
    sourceRest: { pos: THREE.Vector3; quat: THREE.Quaternion };
    viaId?: string;
    via?: { pos: THREE.Vector3; quat: THREE.Quaternion };
    viaRest?: { pos: THREE.Vector3; quat: THREE.Quaternion };
  };
  /** Drops falling from a held pipette: presentation only. */
  private droplets: Array<{ mesh: THREE.Mesh; from: number; to: number; t: number }> = [];
  /** A stoppered vessel being drawn inverted to mix, after the runtime has counted the inversion. */
  private mixRun?: SetOnRun;
  /** Where a carried item was drawn when it was released, so a pour it starts carries on from there. */
  private releasedCarry?: { instanceId: string; position: THREE.Vector3; quaternion: THREE.Quaternion; at: number };
  private disposed = false;
  /** Called after a sync finishes loading, and when the camera moves, so overlays can re-project. */
  onChange?: () => void;
  onManualCamera?: () => void;
  /** A right click without a drag (the microarray lab cancels the motion in progress with it). */
  onCameraClick?: () => void;
  /** Any mouse press or wheel on the bench: mouse and hand control exclude each other (`app.js:78`). */
  onMouseInput?: () => void;
  /** GLB bytes downloaded of those requested, and how many models are still loading (§5.2). */
  onLoadProgress?: (loadedBytes: number, totalBytes: number, pending: number) => void;
  /** The free rectangles of the canvas around open panels (`safeRects`); framing fits into them. */
  safeAreas?: Rect[];

  constructor(private readonly canvas: HTMLCanvasElement, private options: BenchEngineOptions) {
    const q = QUALITY[options.quality];
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
    // Linear HDR into the composer; its last pass tone-maps and encodes (look/composer.ts).
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.localClippingEnabled = true; // a tilting source's liquid is cut level (pour.ts)

    this.textures = makeTextures(q.textures);
    // The microarray lab's room, lights and reflections (decided 2026-10-03/04); its clear colour behind.
    // The map gives reflections only; the hemisphere light is the ambient (look/roomLighting.ts).
    const environment = labEnvironment(this.renderer);
    this.scene.environment = environment;
    this.scene.background = roomBackground();
    this.models = new ModelLibrary(this.textures);
    this.models.environment = environment;
    this.models.onProgress = (loaded, total, pending) => this.onLoadProgress?.(loaded, total, pending);
    this.room = buildRoom({ textures: this.textures, shadowMapSize: q.shadowMap, onTextureChange: () => this.requestRender(), environment });
    this.scene.add(this.room.group, this.room.lights);
    this.contact = new ContactShadows({ width: BENCH_MM.width * MM, depth: BENCH_MM.depth * MM, resolution: q.contact, blur: 2.2, opacity: 0.72 });
    this.scene.add(this.contact.group, this.itemLayer, this.signals.group);

    this.detachCameraInput = this.attachCameraInput();
    this.composer = makeComposer(this.renderer, this.scene, this.camera, { samples: q.samples, bloom: q.bloom });
    this.resize();
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
    this.updateCamera();
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
    if (this.setOn) {
      if (this.setOn.tick(dt)) animating = true;
      else this.stopSetOn();
    }
    if (this.toolRun) {
      if (this.toolRun.tick(dt)) animating = true;
      else this.stopToolRun();
    }
    if (this.mixRun) {
      if (this.mixRun.tick(dt)) animating = true;
      else this.stopMixRun();
    }
    if (this.drainRun) {
      if (this.drainRun.tick(dt)) animating = true;
      else this.stopDrainRun();
    }
    if (this.tickDoors(dt)) animating = true;
    if (this.droplets.length) {
      for (const drop of this.droplets) {
        drop.t = Math.min(1, drop.t + dt / 0.22);
        drop.mesh.position.y = drop.from + (drop.to - drop.from) * drop.t * drop.t;
      }
      for (const drop of this.droplets.filter((d) => d.t >= 1)) {
        this.scene.remove(drop.mesh);
        drop.mesh.geometry.dispose();
      }
      this.droplets = this.droplets.filter((d) => d.t < 1);
      animating = true;
    }
    if (this.controlPress) {
      const press = this.controlPress;
      press.t += dt;
      // In over 80 ms, back over 80 ms.
      const depth = press.t < 0.08 ? press.t / 0.08 : Math.max(0, 1 - (press.t - 0.08) / 0.08);
      press.objects.forEach((object, i) => object.position.copy(press.rest[i]).addScaledVector(press.offset, depth));
      if (press.t >= 0.16) this.controlPress = undefined;
      animating = true;
    }
    if (this.turntable && !this.options.reducedMotion && !this.tween) {
      this.view.yaw += TURNTABLE_RAD_PER_S * dt;
      this.updateCamera();
      animating = true;
    }
    if (this.tween) {
      const tw = this.tween;
      tw.t = Math.min(1, tw.t + (tw.duration > 0 ? dt / tw.duration : 1));
      this.view = lerpView(tw.from, tw.to, easeInOutCubic(tw.t));
      this.updateCamera();
      if (tw.t >= 1) this.tween = undefined;
      else animating = true;
      this.onChange?.();
    }
    // Every material is lit as the microarray lab lights its surfaces (patched once, when first drawn).
    applyRoomLighting(this.scene);
    if (this.shadowsDirty) {
      // Contact shadows are cast by equipment only, never by the room.
      this.room.group.visible = false;
      this.contact.update(this.renderer, this.scene);
      this.room.group.visible = true;
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
      view.benchShift = undefined;
      view.benchLift = undefined;
      if (item.placement.kind === "bench") {
        const yaw = item.placement.point.yawDeg * DEG;
        view.root.position.copy(toWorld(item.placement.point.xMm, item.placement.point.yMm));
        view.root.rotation.set(0, yaw, 0);
        view.restYaw = yaw;
        // A model authored in its working pose rests as the real object does (a funnel mouth-down,
        // a pipette lying flat): turned, lifted, and moved so its footprint centres on its point.
        const rest = item.model?.benchRest;
        if (rest) {
          view.root.rotation.set(rest.rollDeg * DEG, yaw, 0, "YXZ");
          const shift = new THREE.Vector3(rest.shiftMm[0] * MM, 0, -rest.shiftMm[1] * MM).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
          view.root.position.add(shift);
          view.root.position.y = rest.liftMm * MM;
          view.benchShift = shift;
          view.benchLift = rest.liftMm * MM;
        }
        // An item standing in scenery (a tube in its rack) rests on the seat, above the bench.
        const seat = item.scenery?.model.sceneryFor?.seatsMm[item.scenery.seatIndex];
        if (seat) view.root.position.y = seat[2] * MM;
      } else {
        const parentItem = byId.get(item.placement.parentInstanceId);
        const parent = this.items.get(item.placement.parentInstanceId);
        if (parentItem) place(parentItem, depth + 1);
        if (parent) {
          // The parent's whole orientation, so a pump on a pipette lying on the bench lies with it.
          this.poseOnParent(view, parent, item.placement.anchorMm, item.placement.yawDeg, item.placement.leanDeg);
        }
      }
      placed.add(item.instanceId);
    };
    description.bench.forEach((item) => place(item));
    if (this.held) this.poseHeld();
    if (this.squirtHold) this.poseSquirtHold();
    if (this.toolHeld) this.poseToolHeld();
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
    // The beacon follows its item to where this sync put it: an item that has just arrived is
    // placed only now, after the beacon was set for it.
    if (!this.demo) this.placeBeacon(this.beaconId);
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
      // An instrument's controls (a TARE key): tagged for picking, each mesh with its own material
      // so a press or a cue on this key never changes another part or another instance.
      for (const control of item.model.controls ?? []) {
        model.traverse((object) => {
          if (!control.objects.includes(object.name)) return;
          object.userData.controlId = control.id;
          const mesh = object as THREE.Mesh;
          if (mesh.isMesh) mesh.material = (mesh.material as THREE.Material).clone();
        });
      }
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      if (!bounds.isEmpty() && size.y < PICK_PROXY.belowHeightMm * MM) {
        // Never drawn (raycasts do not check visibility), and not a shadow caster.
        const proxy = new THREE.Mesh(new THREE.BoxGeometry(Math.max(size.x, PICK_PROXY.minWidthMm * MM), PICK_PROXY.heightMm * MM,
          Math.max(size.z, PICK_PROXY.minWidthMm * MM)), PICK_PROXY_MATERIAL);
        const centre = bounds.getCenter(new THREE.Vector3());
        proxy.position.set(centre.x, bounds.min.y + (PICK_PROXY.heightMm * MM) / 2, centre.z);
        proxy.visible = false;
        proxy.name = "pick-proxy";
        proxy.userData.instanceId = item.instanceId;
        model.add(proxy);
      }
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

  /**
   * Show the item's form (a filter paper flat, folded or as a cone) and its wet look (Pack 2, decided
   * 2026-10-05): presentation only, from the scene the runtime state gives (G-3).
   */
  private applyForm(view: ItemView, item: SceneItem): void {
    const model = view.model;
    const doorKey = (item.model?.doors ?? []).map((door) => item.apparatus?.[door.stateKey] ?? "").join(",");
    const key = `${item.form ?? ""}|${item.wet ? "wet" : "dry"}|${doorKey}`;
    if (!model || view.formKey === key) return;
    view.formKey = key;
    this.applyDoors(view, item);
    const forms = item.model?.forms;
    if (forms) {
      const shown = new Set(forms[item.form ?? ""] ?? []);
      const formed = new Set(Object.values(forms).flat());
      model.traverse((object) => { if (formed.has(object.name)) object.visible = shown.has(object.name); });
    }
    if (!item.model?.wetLook) return;
    view.dryMaterials ??= new Map();
    model.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || object.name === "pick-proxy") return;
      if (!view.dryMaterials!.has(mesh)) view.dryMaterials!.set(mesh, mesh.material);
      const dry = view.dryMaterials!.get(mesh)!;
      if (!item.wet) { mesh.material = dry; return; }
      // Wet paper: greyer and translucent, as water fills its pores.
      const wet = (Array.isArray(dry) ? dry[0] : dry).clone() as THREE.MeshStandardMaterial;
      wet.color?.multiplyScalar(0.78);
      wet.roughness = 0.55;
      wet.transparent = true;
      wet.opacity = 0.86;
      mesh.material = wet;
    });
  }

  /**
   * Hinged doors (Pack 2: the drying oven's): each door's parts are gathered once under a pivot on its
   * hinge, then swung out toward the viewer while the runtime records it open, over 0.45 s (at once under
   * reduced motion). Presentation only (G-3).
   */
  private applyDoors(view: ItemView, item: SceneItem): void {
    const model = view.model;
    const doors = item.model?.doors;
    if (!model || !doors?.length) return;
    if (!view.doors) {
      model.updateMatrixWorld(true);
      view.doors = doors.map((door) => {
        const pivot = new THREE.Group();
        pivot.name = `door-pivot:${door.id}`;
        pivot.position.set(door.hingeMm[0] * MM, 0, -door.hingeMm[1] * MM);
        model.add(pivot);
        pivot.updateMatrixWorld(true);
        const parts: THREE.Object3D[] = [];
        model.traverse((object) => { if (door.objects.includes(object.name)) parts.push(object); });
        for (const part of parts) pivot.attach(part);
        return { id: door.id, pivot, stateKey: door.stateKey, openRad: -door.openDeg * DEG, angle: 0, goal: 0 };
      });
    }
    for (const door of view.doors) {
      door.goal = item.apparatus?.[door.stateKey] === "open" ? door.openRad : 0;
      if (this.options.reducedMotion) { door.angle = door.goal; door.pivot.rotation.y = door.angle; }
    }
    this.requestRender();
  }

  /** Turns doors toward their goals; returns whether any is still moving. */
  private tickDoors(dt: number): boolean {
    let moving = false;
    for (const view of this.items.values()) {
      for (const door of view.doors ?? []) {
        if (door.angle === door.goal) continue;
        const step = (Math.abs(door.openRad) / 0.45) * dt;
        door.angle = Math.abs(door.goal - door.angle) <= step ? door.goal : door.angle + Math.sign(door.goal - door.angle) * step;
        door.pivot.rotation.y = door.angle;
        this.shadowsDirty = true;
        moving = moving || door.angle !== door.goal;
      }
    }
    return moving;
  }

  private updateItem(item: SceneItem): void {
    const view = this.items.get(item.instanceId);
    if (!view || !item.model) return;
    this.applyForm(view, item);
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

  /**
   * The instance under a client point, if any (scenery and signals are never picked). An
   * instrument's enclosure glass is seen through: an item seated inside it, such as a watch glass on
   * a balance's pan behind the draft shield, is picked; the instrument is picked when nothing is.
   */
  pick(clientX: number, clientY: number): string | undefined {
    this.raycaster.setFromCamera(this.ndc(clientX, clientY), this.camera);
    const hit = this.firstItemHit(this.raycaster.intersectObject(this.itemLayer, true));
    return hit?.object.userData.instanceId as string | undefined;
  }

  /**
   * The first item surface a ray meets, seeing through an instrument's enclosure glass to an item
   * seated inside it (or to the instrument's own parts behind the pane). `skip` names items the ray
   * passes through, such as the one being carried.
   */
  private firstItemHit(intersections: THREE.Intersection[], skip: ReadonlySet<string> = new Set()): THREE.Intersection | undefined {
    const idOf = (hit: THREE.Intersection) => hit.object.userData.instanceId as string;
    const hits = intersections.filter((h) => h.object.userData.instanceId && !skip.has(idOf(h)));
    const first = hits[0];
    if (!first || !first.object.userData.enclosureGlass) return first;
    const owner = idOf(first);
    return hits.find((h) => !h.object.userData.enclosureGlass && (idOf(h) === owner || this.seatedWithin(idOf(h), owner))) ?? first;
  }

  /** Whether `instanceId` is seated on `holderId`, directly or through other seated items. */
  private seatedWithin(instanceId: string, holderId: string): boolean {
    const seen = new Set<string>();
    let current = this.lastScene?.bench.find((item) => item.instanceId === instanceId);
    while (current && current.placement.kind === "seated" && !seen.has(current.instanceId)) {
      seen.add(current.instanceId);
      const parentId = current.placement.parentInstanceId;
      if (parentId === holderId) return true;
      current = this.lastScene?.bench.find((item) => item.instanceId === parentId);
    }
    return false;
  }

  /**
   * Where a tool's solid rest (a spatula's spoon) lies from the tool's centre, in bench millimetres,
   * as the tool lies now; undefined for an item without one.
   */
  solidRestOffsetMm(instanceId: string): { xMm: number; yMm: number } | undefined {
    const view = this.items.get(instanceId);
    const rest = view?.entry?.solidRest?.centreMm;
    if (!view || !rest) return undefined;
    const offset = new THREE.Vector3(rest[0] * MM, 0, -rest[1] * MM).applyEuler(view.root.rotation);
    return { xMm: offset.x / MM, yMm: -offset.z / MM };
  }

  /** A tool's working end (`tipMm`: tongs' jaws, a scoop's end) from its centre, in bench mm, as it lies now. */
  tipOffsetMm(instanceId: string): { xMm: number; yMm: number } | undefined {
    const view = this.items.get(instanceId);
    const tip = view?.entry?.tipMm;
    if (!view || !tip) return undefined;
    const offset = new THREE.Vector3(tip[0] * MM, 0, -tip[1] * MM).applyEuler(view.root.rotation);
    return { xMm: offset.x / MM, yMm: -offset.z / MM };
  }

  /**
   * An item held in a carried tool's jaws (Pack 2: a hot watch glass in the crucible tongs), or none.
   * While the tool is carried the item hangs from its working end; it goes back where the runtime has it
   * when let go.
   */
  setToolHeld(toolId: string | null, heldId?: string): void {
    const before = this.toolHeld;
    this.toolHeld = toolId && heldId ? { toolId, heldId } : undefined;
    if (before && !this.toolHeld && this.lastScene) void this.sync(this.lastScene);
    this.poseToolHeld();
    this.requestRender();
  }

  private toolHeld?: { toolId: string; heldId: string };

  private poseToolHeld(): void {
    const held = this.toolHeld;
    const tool = held ? this.items.get(held.toolId) : undefined;
    const item = held ? this.items.get(held.heldId) : undefined;
    const tip = tool?.entry?.tipMm;
    if (!held || !tool || !item || !tip) return;
    tool.root.updateMatrixWorld(true);
    const tipWorld = new THREE.Vector3(tip[0] * MM, tip[2] * MM, -tip[1] * MM).applyMatrix4(tool.root.matrixWorld);
    const forward = new THREE.Vector3(1, 0, 0).applyQuaternion(tool.root.quaternion).setY(0).normalize();
    // Gripped at its rim: its centre lies one radius beyond the jaws, a little below them.
    item.root.position.copy(tipWorld).addScaledVector(forward, this.footprintRadius(held.heldId) * 0.85);
    item.root.position.y = Math.max(0, tipWorld.y - 6 * MM);
    item.root.quaternion.copy(this.restQuaternions.get(held.heldId) ?? item.root.quaternion);
    item.benchShift = undefined;
    item.benchLift = undefined;
    this.poseSeatedChildren(held.heldId);
    this.itemLayer.updateMatrixWorld(true);
    this.shadowsDirty = true;
  }

  /** The control (a TARE key) under a client point, if the first item surface there is one. */
  pickControl(clientX: number, clientY: number): { instanceId: string; controlId: string } | undefined {
    this.raycaster.setFromCamera(this.ndc(clientX, clientY), this.camera);
    const hit = this.firstItemHit(this.raycaster.intersectObject(this.itemLayer, true));
    const controlId = hit?.object.userData.controlId as string | undefined;
    return hit && controlId ? { instanceId: hit.object.userData.instanceId as string, controlId } : undefined;
  }

  /**
   * Hand-control targets in canvas pixels (the microarray lab's screen-space picking, `app.js:23-26`):
   * each item's centre and its footprint's projected radius, and each instrument control (the TARE
   * key) with its own projected size. Items hidden behind the camera are left out.
   */
  screenTargets(): Array<{ instanceId: string; controlId?: string; x: number; y: number; r: number }> {
    const rect = this.canvas.getBoundingClientRect();
    const toScreen = (p: THREE.Vector3) => {
      const q = p.clone().project(this.camera);
      return { x: ((q.x + 1) / 2) * rect.width, y: ((1 - q.y) / 2) * rect.height, z: q.z };
    };
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0).normalize();
    const out: Array<{ instanceId: string; controlId?: string; x: number; y: number; r: number }> = [];
    for (const view of this.items.values()) {
      if (!view.model) continue;
      view.root.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(view.model);
      if (box.isEmpty()) continue;
      const centre = box.getCenter(new THREE.Vector3());
      const c = toScreen(centre);
      if (c.z < -1 || c.z > 1) continue;
      const edge = toScreen(centre.clone().addScaledVector(right, this.footprintRadius(view.instanceId)));
      out.push({ instanceId: view.instanceId, x: c.x, y: c.y, r: Math.hypot(edge.x - c.x, edge.y - c.y) });
      for (const control of view.entry?.controls ?? []) {
        const objects = this.controlObjects(view.instanceId, control.id);
        if (!objects.length) continue;
        const keyBox = new THREE.Box3();
        objects.forEach((object) => keyBox.expandByObject(object));
        const k = toScreen(keyBox.getCenter(new THREE.Vector3()));
        const size = keyBox.getSize(new THREE.Vector3());
        const kEdge = toScreen(keyBox.getCenter(new THREE.Vector3()).addScaledVector(right, Math.max(size.x, size.z) / 2));
        out.push({ instanceId: view.instanceId, controlId: control.id, x: k.x, y: k.y, r: Math.hypot(kEdge.x - k.x, kEdge.y - k.y) });
      }
    }
    return out;
  }

  private controlObjects(instanceId: string, controlId: string): THREE.Object3D[] {
    const found: THREE.Object3D[] = [];
    this.items.get(instanceId)?.model?.traverse((object) => { if (object.userData.controlId === controlId) found.push(object); });
    return found;
  }

  /** Show a control pressed: it moves 1.2 mm into the panel and back. Nothing under reduced motion. */
  pressControl(instanceId: string, controlId: string): void {
    const view = this.items.get(instanceId);
    const control = view?.entry?.controls?.find((candidate) => candidate.id === controlId);
    const objects = this.controlObjects(instanceId, controlId);
    if (!control || objects.length === 0 || this.options.reducedMotion || this.controlPress) return;
    const [nx, ny, nz] = control.normalMm;
    const offset = new THREE.Vector3(nx, nz, -ny).normalize().multiplyScalar(-1.2 * MM);
    this.controlPress = { objects, rest: objects.map((object) => object.position.clone()), offset, t: 0 };
    this.requestRender();
  }

  /** Light one control for the guided cue (G-7), or none; a static tint, so no motion to reduce. */
  setControlCue(cue: { instanceId: string; controlId: string } | null): void {
    const tint = (target: { instanceId: string; controlId: string }, on: boolean) => {
      for (const object of this.controlObjects(target.instanceId, target.controlId)) {
        const material = (object as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (!material?.emissive) continue;
        material.emissive.copy(on ? TOKENS.guide : new THREE.Color(0, 0, 0));
        material.emissiveIntensity = on ? 0.55 : 1;
      }
    };
    if (this.controlCue) tint(this.controlCue, false);
    this.controlCue = cue ?? undefined;
    if (cue) tint(cue, true);
    this.requestRender();
  }

  /**
   * Draw a scoop on a carried tool (the solid's own colour, at the tool's `solidRest`), or clear
   * it. A carry cue: the runtime records the transfer only when the tool is released over its
   * target, and the scoop is gone once the carry ends (G-3).
   */
  setToolLoad(instanceId: string | null, contents?: SceneContents): void {
    if (this.toolLoad) {
      this.toolLoad.object.parent?.remove(this.toolLoad.object);
      disposeObject(this.toolLoad.object);
      this.toolLoad = undefined;
    }
    const view = instanceId ? this.items.get(instanceId) : undefined;
    const scoop = view?.entry && contents ? buildContents(view.entry, contents) : undefined;
    if (view && scoop) {
      view.root.add(scoop);
      this.toolLoad = { instanceId: view.instanceId, object: scoop };
    }
    this.requestRender();
  }

  /**
   * Draw a committed tool transfer (decided 2026-09-25): where the carry was released, the tool
   * rolls about its length so the scoop drops onto the target, then returns to where the runtime
   * keeps it. Presentation only; the target already holds the solid, and a target that was empty
   * (`revealIn`) shows it only as the scoop lands. Resolves at once under reduced motion or when
   * the release is not known.
   */
  animateToolDeposit(args: { toolId: string; scoop?: SceneContents; revealIn?: string; motion?: "roll" | "dip" }): Promise<void> {
    this.stopToolRun();
    const tool = this.items.get(args.toolId);
    const released = this.releasedCarry?.instanceId === args.toolId && performance.now() - this.releasedCarry.at < 2000
      ? this.releasedCarry : undefined;
    this.releasedCarry = undefined;
    if (this.options.reducedMotion || !tool || !released) return Promise.resolve();
    const start = released.position.clone();
    const startQuaternion = released.quaternion.clone();
    const scoop = args.scoop && tool.entry ? buildContents(tool.entry, args.scoop) : undefined;
    if (scoop) tool.root.add(scoop);
    const TIP = 0.28, HOLD = 0.18, BACK = 0.22, ROLL = 1.35;
    // The target's contents may be built by a sync after this starts, so they are hidden each frame.
    const reveal = (shown: boolean) => {
      const target = args.revealIn ? this.items.get(args.revealIn) : undefined;
      if (target?.contents) target.contents.visible = shown;
    };
    const ease = (u: number): number => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
    const roll = new THREE.Quaternion();
    let elapsed = 0;
    return new Promise((resolve) => {
      const finish = () => {
        if (scoop) { tool.root.remove(scoop); disposeObject(scoop); }
        reveal(true);
        const rest = this.restPositions.get(args.toolId);
        const restQuaternion = this.restQuaternions.get(args.toolId);
        if (rest) tool.root.position.copy(rest);
        if (restQuaternion) tool.root.quaternion.copy(restQuaternion);
        // What is seated on the tool (a pump on a pipette) goes back with it.
        this.poseSeatedChildren(args.toolId);
        this.shadowsDirty = true;
        this.requestRender();
        resolve();
      };
      const tick = (dt: number): boolean => {
        if (this.items.get(args.toolId) !== tool) return false;
        elapsed += dt;
        const u = elapsed < TIP ? ease(elapsed / TIP)
          : elapsed < TIP + HOLD ? 1
            : Math.max(0, 1 - ease((elapsed - TIP - HOLD) / BACK));
        tool.root.position.copy(start);
        if (args.motion === "dip") {
          // A pipette: its tip goes 12 mm down into the liquid (or the cuvette) and back, upright.
          tool.root.position.y -= u * 12 * MM;
          tool.root.quaternion.copy(startQuaternion);
          this.poseSeatedChildren(args.toolId);
        } else {
          tool.root.quaternion.copy(startQuaternion).multiply(roll.setFromAxisAngle(new THREE.Vector3(1, 0, 0), u * ROLL));
        }
        if (scoop && elapsed > TIP * 0.7) scoop.visible = false;
        reveal(elapsed > TIP * 0.7);
        this.shadowsDirty = true;
        return elapsed < TIP + HOLD + BACK;
      };
      this.toolRun = { tick, finish };
      this.requestRender();
    });
  }

  /** Pose an item on its parent's anchor, in the parent's whole orientation. */
  private poseOnParent(view: ItemView, parent: ItemView, anchorMm: number[], yawDeg: number, leanDeg = 0): void {
    const [ax, ay, az] = anchorMm;
    const local = new THREE.Vector3(ax * MM, az * MM, -ay * MM).applyQuaternion(parent.root.quaternion);
    view.root.position.copy(parent.root.position).add(local);
    view.root.quaternion.copy(parent.root.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawDeg * DEG));
    // A lean tips the child's top toward its own +y before the yaw turns it (a rod resting on a rim).
    if (leanDeg) view.root.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -leanDeg * DEG));
  }

  /** Re-pose what is seated on `parentId` (and on that, in turn) from where the parent is now. */
  private poseSeatedChildren(parentId: string, depth = 0): void {
    const parent = this.items.get(parentId);
    if (!parent || depth > 6) return;
    for (const item of this.lastScene?.bench ?? []) {
      if (item.placement.kind !== "seated" || item.placement.parentInstanceId !== parentId) continue;
      const child = this.items.get(item.instanceId);
      if (!child) continue;
      this.poseOnParent(child, parent, item.placement.anchorMm, item.placement.yawDeg, item.placement.leanDeg);
      this.poseSeatedChildren(item.instanceId, depth + 1);
    }
  }

  /**
   * Hold a pipette upright over a vessel's mouth while liquid is added a drop at a time (decided
   * 2026-10-02), or let it go (null). The hold outlasts each sync, since every drop changes the
   * runtime; the pipette's place on the bench is unchanged, and it returns there when let go.
   */
  holdOver(itemId: string | null, overId?: string): void {
    this.held = itemId && overId ? { itemId, overId } : undefined;
    if (this.held) this.poseHeld();
    else if (this.lastScene) void this.sync(this.lastScene);
    this.requestRender();
  }

  /** The wash bottle held over what it rinses between squirts, if any (decided 2026-10-05). */
  squirtHolding(): string | undefined {
    return this.squirtHold?.sourceId;
  }

  /** Set a wash bottle held between squirts (and the boat it rinses) back where they rest. */
  releaseSquirtHold(): void {
    if (!this.squirtHold) return;
    this.squirtHold = undefined;
    if (this.lastScene) void this.sync(this.lastScene);
    this.requestRender();
  }

  private poseSquirtHold(): void {
    const hold = this.squirtHold;
    if (!hold) return;
    const pose = (id: string | undefined, at?: { pos: THREE.Vector3; quat: THREE.Quaternion }) => {
      const view = id ? this.items.get(id) : undefined;
      if (!view || !at) return;
      view.root.position.copy(at.pos);
      view.root.quaternion.copy(at.quat);
      view.benchShift = undefined;
      view.benchLift = undefined;
      this.poseSeatedChildren(view.instanceId);
    };
    pose(hold.sourceId, hold.source);
    pose(hold.viaId, hold.via);
    this.itemLayer.updateMatrixWorld(true);
    this.shadowsDirty = true;
  }

  private poseHeld(): void {
    const held = this.held;
    const view = held ? this.items.get(held.itemId) : undefined;
    const over = held ? this.items.get(held.overId) : undefined;
    if (!view || !over) return;
    over.root.updateWorldMatrix(true, true);
    const top = new THREE.Box3().setFromObject(over.model ?? over.root).max.y;
    view.root.position.set(over.root.position.x, top + 6 * MM, over.root.position.z);
    view.root.quaternion.setFromEuler(new THREE.Euler(0, view.restYaw ?? 0, 0));
    view.benchShift = undefined;
    view.benchLift = undefined;
    this.poseSeatedChildren(view.instanceId);
    this.itemLayer.updateMatrixWorld(true);
    this.shadowsDirty = true;
  }

  /**
   * One drop falling from the held pipette's tip to the liquid in the vessel below: presentation
   * only, after the runtime has moved the drop. Nothing under reduced motion.
   */
  dropFromHeld(color = "#9cc6e0"): void {
    const held = this.held;
    const view = held ? this.items.get(held.itemId) : undefined;
    const over = held ? this.items.get(held.overId) : undefined;
    if (!view || !over || this.options.reducedMotion) return;
    const contents = this.lastScene?.bench.find((item) => item.instanceId === over.instanceId)?.contents;
    const surface = over.root.position.y + (contents?.kind === "liquid" ? contents.levelMm * MM : 0);
    const material = this.dropMaterial ??= new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1.6 * MM, 10, 8), material);
    mesh.position.copy(view.root.position);
    this.scene.add(mesh);
    this.droplets.push({ mesh, from: view.root.position.y - 1.5 * MM, to: Math.min(view.root.position.y - 2 * MM, surface), t: 0 });
    this.requestRender();
  }
  private dropMaterial?: THREE.MeshBasicMaterial;

  /**
   * A stoppered vessel turned over and back once, its stopper with it: presentation only, after
   * the runtime has counted the inversion. Resolves at once under reduced motion.
   */
  animateInversion(vesselId: string): Promise<void> {
    this.stopMixRun();
    const view = this.items.get(vesselId);
    if (!view || this.options.reducedMotion) return Promise.resolve();
    const start = view.root.position.clone();
    const startQuaternion = view.root.quaternion.clone();
    const height = new THREE.Box3().setFromObject(view.model ?? view.root).getSize(new THREE.Vector3()).y;
    // A racked tube leaves its rack on the bench while it is turned over (scenery never moves; D9).
    const rack = this.detachRack(view);
    const LIFT = 0.18, TURN = 0.32, BACK = 0.32, DOWN = 0.18;
    const ease = (u: number): number => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
    let elapsed = 0;
    return new Promise((resolve) => {
      const finish = () => {
        const rest = this.restPositions.get(vesselId);
        const restQuaternion = this.restQuaternions.get(vesselId);
        view.root.position.copy(rest ?? start);
        view.root.quaternion.copy(restQuaternion ?? startQuaternion);
        rack?.();
        this.poseSeatedChildren(vesselId);
        this.shadowsDirty = true;
        this.requestRender();
        resolve();
      };
      const tick = (dt: number): boolean => {
        if (this.items.get(vesselId) !== view) return false;
        elapsed += dt;
        const lift = elapsed < LIFT ? ease(elapsed / LIFT)
          : elapsed < LIFT + TURN + BACK ? 1 : Math.max(0, 1 - ease((elapsed - LIFT - TURN - BACK) / DOWN));
        const turn = elapsed < LIFT ? 0 : elapsed < LIFT + TURN ? ease((elapsed - LIFT) / TURN)
          : elapsed < LIFT + TURN + BACK ? 1 - ease((elapsed - LIFT - TURN) / BACK) : 0;
        // Turned about its own middle, held well clear of the bench.
        const pivot = start.clone().add(new THREE.Vector3(0, height / 2 + lift * (height / 2 + 30 * MM), 0));
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), turn * Math.PI);
        view.root.quaternion.copy(q).multiply(startQuaternion);
        view.root.position.copy(pivot).add(new THREE.Vector3(0, -height / 2, 0).applyQuaternion(q));
        this.poseSeatedChildren(vesselId);
        this.shadowsDirty = true;
        return elapsed < LIFT + TURN + BACK + DOWN;
      };
      this.mixRun = { tick, finish };
      this.requestRender();
    });
  }

  /**
   * A flask swirled until the solid in it dissolves (decided 2026-10-04): lifted a little and, held by
   * its neck, its bulb moved in small circles three times round, leaning up to 8° about the hand, then
   * set down; presentation only, after the runtime has dissolved the solid. Its contents are drawn as they were until the last turn, then as
   * the runtime has them. Resolves at once under reduced motion.
   */
  animateSwirl(vesselId: string, contents?: { before: SceneContents; after: SceneContents }): Promise<void> {
    this.stopMixRun();
    const view = this.items.get(vesselId);
    if (!view || this.options.reducedMotion) return Promise.resolve();
    const start = view.root.position.clone();
    const startQuaternion = view.root.quaternion.clone();
    const LIFT = 0.2, SWIRL = 1.5, DOWN = 0.2, TURNS = 3, LEAN = 8 * DEG, RAISE = 18 * MM;
    // Held by the neck, about three quarters of the way up: the bulb circles, the neck barely moves.
    const grip = new THREE.Box3().setFromObject(view.model ?? view.root).getSize(new THREE.Vector3()).y * 0.72;
    const ease = (u: number): number => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
    const entry = view.entry;
    const rack = this.detachRack(view);
    if (contents && entry) this.replaceContents(view, buildContents(entry, contents.before));
    let swapped = false;
    let elapsed = 0;
    return new Promise((resolve) => {
      const finish = () => {
        if (contents && entry && !swapped && this.items.get(vesselId) === view) this.replaceContents(view, buildContents(entry, contents.after));
        const rest = this.restPositions.get(vesselId);
        const restQuaternion = this.restQuaternions.get(vesselId);
        view.root.position.copy(rest ?? start);
        view.root.quaternion.copy(restQuaternion ?? startQuaternion);
        rack?.();
        this.poseSeatedChildren(vesselId);
        this.shadowsDirty = true;
        this.requestRender();
        resolve();
      };
      const tick = (dt: number): boolean => {
        if (this.items.get(vesselId) !== view) return false;
        elapsed += dt;
        const lift = elapsed < LIFT ? ease(elapsed / LIFT)
          : elapsed < LIFT + SWIRL ? 1 : Math.max(0, 1 - ease((elapsed - LIFT - SWIRL) / DOWN));
        const u = Math.min(1, Math.max(0, (elapsed - LIFT) / SWIRL));
        // The circles grow and settle, so the liquid is set going and comes to rest.
        const amplitude = Math.sin(Math.PI * u);
        const phase = 2 * Math.PI * TURNS * u;
        const lean = new THREE.Vector3(Math.cos(phase), 0, Math.sin(phase));
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3().crossVectors(lean, UP).normalize(), LEAN * amplitude);
        const hand = start.clone().add(new THREE.Vector3(0, grip + lift * RAISE, 0));
        view.root.quaternion.copy(q).multiply(startQuaternion);
        view.root.position.copy(hand).add(new THREE.Vector3(0, -grip, 0).applyQuaternion(q));
        if (contents && entry && !swapped && u > 0.75) {
          swapped = true;
          this.replaceContents(view, buildContents(entry, contents.after));
        }
        this.poseSeatedChildren(vesselId);
        this.shadowsDirty = true;
        return elapsed < LIFT + SWIRL + DOWN;
      };
      this.mixRun = { tick, finish };
      this.requestRender();
    });
  }

  /**
   * A stirring rod standing in a vessel stirs it (Pack 2, decided 2026-10-05): its tip sweeps round the
   * floor of the vessel while its top circles near the rim, `turns` times in `seconds`; presentation
   * only, after the runtime has recorded the stir, or while a portion is poured in. Resolves at once
   * under reduced motion or when nothing stands in the vessel to stir with.
   */
  animateStir(vesselId: string, seconds: number, turns = Math.max(2, Math.round(seconds * 1.2))): Promise<void> {
    this.stopMixRun();
    const vessel = this.items.get(vesselId);
    const rods = (this.lastScene?.bench ?? []).filter((item) => item.placement.kind === "seated"
      && item.placement.parentInstanceId === vesselId && item.definitionId === "stirring-rod");
    const views = rods.map((item) => this.items.get(item.instanceId)).filter((view): view is ItemView => Boolean(view));
    if (!vessel || !views.length || this.options.reducedMotion || seconds <= 0) return Promise.resolve();
    const axis = vessel.root.position.clone();
    const ease = (u: number): number => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
    let elapsed = 0;
    return new Promise((resolve) => {
      const finish = () => {
        this.poseSeatedChildren(vesselId);
        this.shadowsDirty = true;
        this.requestRender();
        resolve();
      };
      const tick = (dt: number): boolean => {
        if (this.items.get(vesselId) !== vessel) return false;
        elapsed += dt;
        const u = Math.min(1, elapsed / seconds);
        // Starts and ends where it rests; the sweep eases in and out.
        const angle = 2 * Math.PI * turns * ease(u);
        const turn = new THREE.Quaternion().setFromAxisAngle(UP, angle);
        this.poseSeatedChildren(vesselId);
        for (const view of views) {
          view.root.position.sub(axis).applyQuaternion(turn).add(axis);
          view.root.quaternion.premultiply(turn);
        }
        this.shadowsDirty = true;
        return elapsed < seconds;
      };
      this.mixRun = { tick, finish };
      this.requestRender();
    });
  }

  /**
   * A filter draining (Pack 2's filtration): the liquid just poured into the paper cone falls as the flask
   * under the funnel fills, over `seconds`. Presentation only: the runtime has already moved it.
   */
  animateDrain(args: { funnelId: string; cone: SceneContents; receiverId: string; receiverBefore: SceneContents; receiverAfter: SceneContents },
    seconds = 2.6): Promise<void> {
    this.stopDrainRun();
    const funnel = this.items.get(args.funnelId);
    const receiver = this.items.get(args.receiverId);
    if (!funnel?.entry?.fill || !receiver?.entry || args.cone.kind !== "liquid" || this.options.reducedMotion) return Promise.resolve();
    const funnelEntry = funnel.entry;
    const funnelFill = funnelEntry.fill!;
    const receiverEntry = receiver.entry;
    const cone = args.cone;
    const startMl = cone.volumeMl;
    const liquidOf = (c: SceneContents) => (c.kind === "liquid" ? c.volumeMl : 0);
    const fromMl = liquidOf(args.receiverBefore);
    const toMl = liquidOf(args.receiverAfter);
    const ease = (u: number): number => 1 - (1 - u) * (1 - u);
    let elapsed = 0;
    let lastKey = "";
    return new Promise((resolve) => {
      const finish = () => {
        funnel.contentsKey = "animating";
        receiver.contentsKey = "animating";
        if (this.lastScene) void this.sync(this.lastScene);
        resolve();
      };
      const tick = (dt: number): boolean => {
        if (this.items.get(args.funnelId) !== funnel) return false;
        elapsed += dt;
        const u = ease(Math.min(1, elapsed / seconds));
        const inCone = Math.round(startMl * (1 - u) * 10) / 10;
        const inFlask = Math.round((fromMl + (toMl - fromMl) * u) * 10) / 10;
        const key = `${inCone}|${inFlask}`;
        if (key !== lastKey) {
          lastKey = key;
          this.replaceContents(funnel, inCone > 0.05 ? buildContents(funnelEntry, { ...cone, volumeMl: inCone, ...fillLevelMm(funnelFill, inCone) }) : undefined);
          if (args.receiverAfter.kind === "liquid" && receiverEntry.fill) {
            this.replaceContents(receiver, inFlask > 0.05
              ? buildContents(receiverEntry, { ...args.receiverAfter, volumeMl: inFlask, ...fillLevelMm(receiverEntry.fill, inFlask) })
              : buildContents(receiverEntry, args.receiverBefore));
          }
          this.shadowsDirty = true;
        }
        return elapsed < seconds;
      };
      this.drainRun = { tick, finish };
      this.requestRender();
    });
  }

  private drainRun?: SetOnRun;

  private stopDrainRun(): void {
    const run = this.drainRun;
    if (!run) return;
    this.drainRun = undefined;
    run.finish();
  }

  /**
   * A vessel's contents changing while time passes on the step clock (a precipitate settling): drawn as
   * they were, then as the runtime has them once `seconds` have passed. Presentation only.
   */
  animateContentsChange(vesselId: string, contents: { before: SceneContents; after: SceneContents }, seconds: number): Promise<void> {
    this.stopMixRun();
    const view = this.items.get(vesselId);
    const entry = view?.entry;
    if (!view || !entry || this.options.reducedMotion || seconds <= 0) return Promise.resolve();
    this.replaceContents(view, buildContents(entry, contents.before));
    let elapsed = 0;
    return new Promise((resolve) => {
      const finish = () => {
        if (this.items.get(vesselId) === view) this.replaceContents(view, buildContents(entry, contents.after));
        view.contentsKey = "animating";
        this.shadowsDirty = true;
        this.requestRender();
        resolve();
      };
      const tick = (dt: number): boolean => {
        if (this.items.get(vesselId) !== view) return false;
        elapsed += dt;
        return elapsed < seconds;
      };
      this.mixRun = { tick, finish };
      this.requestRender();
    });
  }

  /**
   * Leave an item's rack scenery standing on the bench while the item moves (the pour does this
   * too); returns how to put it back on the item.
   */
  private detachRack(view: ItemView): (() => void) | undefined {
    const object = view.scenery;
    if (!object) return undefined;
    const position = object.position.clone();
    const quaternion = object.quaternion.clone();
    this.itemLayer.attach(object);
    return () => {
      view.root.add(object);
      object.position.copy(position);
      object.quaternion.copy(quaternion);
    };
  }

  private stopMixRun(): void {
    const run = this.mixRun;
    if (!run) return;
    this.mixRun = undefined;
    run.finish();
  }

  private stopToolRun(): void {
    const run = this.toolRun;
    if (!run) return;
    this.toolRun = undefined;
    run.finish();
  }

  /** The bench-plane point under a client point, in bench millimetres (at `heightMm` above it). */
  benchPointAt(clientX: number, clientY: number, heightMm = 0): { xMm: number; yMm: number } | undefined {
    this.raycaster.setFromCamera(this.ndc(clientX, clientY), this.camera);
    this.benchPlane.constant = -heightMm * MM;
    const hit = this.raycaster.ray.intersectPlane(this.benchPlane, new THREE.Vector3());
    return hit ? { xMm: hit.x / MM, yMm: -hit.z / MM } : undefined;
  }

  /**
   * Where a carry is aimed (handoff §5.6: the bench plane, plus a lift for targets above bench
   * height). The pointer's ray first meeting another item gives the point straight below the hit,
   * with the height of the surface it met, so pointing at a raised target such as a balance's pan
   * aims at that target, not at the bench behind it; targets are still resolved by footprints
   * (plan §4.1). Otherwise it is the bench-plane point, at height 0. The carried item and whatever
   * is locked to it are never aimed at. `instanceId` names the item met, if any.
   */
  carryPointAt(clientX: number, clientY: number, carriedId?: string): { xMm: number; yMm: number; surfaceMm: number; instanceId?: string } | undefined {
    this.raycaster.setFromCamera(this.ndc(clientX, clientY), this.camera);
    const skip = new Set(carriedId ? [carriedId, ...this.lockedDescendants(carriedId)] : []);
    const hit = this.firstItemHit(this.raycaster.intersectObject(this.itemLayer, true), skip);
    if (hit) {
      return { xMm: hit.point.x / MM, yMm: -hit.point.z / MM, surfaceMm: Math.max(0, hit.point.y / MM),
        instanceId: hit.object.userData.instanceId as string };
    }
    const bench = this.benchPointAt(clientX, clientY);
    return bench ? { ...bench, surfaceMm: 0 } : undefined;
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

  /**
   * Where an item's hover label goes: centred under the item, below the lowest point on screen of
   * its bottom edge, so the label never covers the item's front (a balance's TARE key).
   */
  labelPoint(instanceId: string): { x: number; y: number; visible: boolean } | undefined {
    const view = this.items.get(instanceId);
    if (!view) return undefined;
    view.root.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(view.model ?? view.root);
    if (box.isEmpty()) return undefined;
    const rect = this.canvas.getBoundingClientRect();
    const centre = new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2).project(this.camera);
    let bottom = -Infinity;
    for (const x of [box.min.x, box.max.x]) {
      for (const z of [box.min.z, box.max.z]) {
        const p = new THREE.Vector3(x, box.min.y, z).project(this.camera);
        bottom = Math.max(bottom, ((1 - p.y) / 2) * rect.height);
      }
    }
    return { x: ((centre.x + 1) / 2) * rect.width, y: bottom, visible: centre.z < 1 };
  }

  /** Where an item stands: its root, or for a `benchRest` item at rest its footprint centre on the bench. */
  basePosition(instanceId: string): THREE.Vector3 | undefined {
    const view = this.items.get(instanceId);
    if (!view) return undefined;
    const at = view.root.position.clone();
    if (view.benchShift) {
      at.sub(view.benchShift);
      at.y -= view.benchLift ?? 0;
    }
    return at;
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
   * With `viaId` (a tool, decided 2026-09-25) the ghost first goes to the top of that item (the
   * solid's source, which pulses), then on to the target.
   */
  showMe(sourceId: string | undefined, targetId: string | undefined, viaId?: string): void {
    this.endDemo();
    const source = sourceId ? this.items.get(sourceId) : undefined;
    const target = targetId ? this.items.get(targetId) : undefined;
    const via = viaId && source ? this.items.get(viaId) : undefined;
    if (!source && !target) return;
    // With no source on the bench (it is still in the tray), only the target pulses.
    const demo: NonNullable<BenchEngine["demo"]> = source
      ? { sourceId: source.instanceId, targetId: target?.instanceId, viaId: via?.instanceId, t: 0 }
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
      const viaTop = via ? via.root.position.clone().setY(new THREE.Box3().setFromObject(via.root).max.y) : undefined;
      Object.assign(demo, { ghost, material, from: source.root.position.clone(), via: viaTop, to: target.root.position.clone() });
    }
    this.demo = demo;
    this.placeBeacon(demo.sourceId);
    this.requestRender();
  }

  private tickDemo(dt: number): boolean {
    const demo = this.demo!;
    demo.t += dt;
    const legs = demo.ghost ? (demo.via ? 2 : 1) : 0;
    const travelEnd = DEMO.source + legs * DEMO.travel;
    if (demo.ghost && demo.from && demo.to) {
      // Leg 0 runs from the source (to the via point, if any), the last leg to the target.
      const s = (demo.t - DEMO.source) / DEMO.travel;
      const leg = Math.min(legs - 1, Math.max(0, Math.floor(s)));
      const u = Math.min(1, Math.max(0, s - leg));
      const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      const from = leg === 1 && demo.via ? demo.via : demo.from;
      const to = leg === 0 && demo.via ? demo.via : demo.to;
      const last = leg === legs - 1;
      demo.ghost.visible = demo.t >= DEMO.source && !(last && u >= 1);
      demo.ghost.position.lerpVectors(from, to, e);
      demo.ghost.position.y += Math.sin(u * Math.PI) * 0.06;
      (demo.material as THREE.MeshBasicMaterial).opacity = 0.32 * (!last || u < 0.8 ? 1 : (1 - u) / 0.2);
    }
    if (demo.viaId && demo.t >= DEMO.source + DEMO.travel && demo.t < travelEnd) this.placeBeacon(demo.viaId);
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
   * (G-5): the next sync puts everything back where the runtime has it. `pourTiltDeg` is the cue's
   * tilt (30°), deeper while a mouse pour stroke is dragged down.
   */
  previewCarry(instanceId: string, xMm: number, yMm: number, liftMm: number, pourToward?: string, pourTiltDeg = 30): void {
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
      const tilted = pourQuaternion(geometry, toward, pourTiltDeg * DEG);
      const lip = geometry.lip.clone().applyQuaternion(upright).add(view.root.position);
      view.root.quaternion.copy(tilted);
      view.root.position.copy(rootForLip(geometry, tilted, lip));
    } else if (view.entry?.benchRest) {
      // Carried in its working pose: a funnel upright, a pipette tip-down.
      view.root.quaternion.setFromEuler(new THREE.Euler(0, view.restYaw ?? 0, 0));
    } else {
      view.root.quaternion.copy(this.restQuaternions.get(instanceId) ?? view.root.quaternion);
    }
    if (view.benchShift) {
      view.benchShift = undefined;
      view.benchLift = undefined;
    }
    if (view.entry?.benchRest) {
      // Turned upright from its rest pose, so what is seated on it is re-posed, not just moved.
      this.poseSeatedChildren(instanceId);
    } else if (rest) {
      const delta = view.root.position.clone().sub(rest);
      for (const id of this.lockedDescendants(instanceId)) {
        const child = this.items.get(id);
        const childRest = this.restPositions.get(id);
        if (child && childRest) child.root.position.copy(childRest).add(delta);
      }
    }
    this.itemLayer.updateMatrixWorld(true);
    if (this.toolHeld?.toolId === instanceId) this.poseToolHeld();
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
    this.cameraHeld = held;
    if (held) this.touchGesture = undefined;
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
    /** An item held tipped over the target's mouth while the source pours into it: a weighing boat being rinsed. */
    via?: string;
    /**
     * A squirt short of a counted rinse's count (decided 2026-10-05): the wash bottle stays held over
     * what it rinses, and the boat over the funnel, for the next squirt; only the last sets them down.
     */
    holdAfter?: boolean;
    /**
     * Seconds a measuring vessel is held tipped over the target once it is empty, so it drains (Pack 2's
     * Transfer Liquid, decided 2026-10-05): the last drops fall from its lip before it is set upright.
     */
    drainS?: number;
    /**
     * A stirring rod held against the source's lip with its lower end in the target, so the pour runs down
     * it (Pack 2's filtration, decision 4); it goes back where it rests when the pour ends.
     */
    guideRodId?: string;
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

    // A squirt after the first of a counted rinse starts where the bottle is held and ends, after the
    // last, where it rested before the first.
    const holding = this.squirtHold?.sourceId === args.sourceId ? this.squirtHold : undefined;
    // Where the source starts (the drop point after a drag), rests now, and is set down afterwards.
    const restPos = holding ? holding.sourceRest.pos.clone() : source.root.position.clone();
    const startPos = released?.position.clone() ?? (holding ? source.root.position.clone() : restPos.clone());
    const startQuat = released?.quaternion.clone() ?? source.root.quaternion.clone();
    const endPos = holding ? holding.sourceRest.pos.clone()
      : args.returnTo ? toWorld(args.returnTo.xMm, args.returnTo.yMm).setY(restPos.y) : restPos.clone();
    const endQuat = holding ? holding.sourceRest.quat.clone()
      : args.returnTo ? new THREE.Quaternion().setFromAxisAngle(UP, args.returnTo.yawDeg * DEG) : source.root.quaternion.clone();

    // The target's mouth: the top of its fill profile, on its axis; or the rim of a filling funnel
    // seated in it (a zone ending "funnel-seat"), which is where a pour or a rinse goes in (decided 2026-10-04).
    const tFill = targetEntry.fill;
    const box = new THREE.Box3().setFromObject(target.model ?? target.root);
    const targetBase = target.root.getWorldPosition(new THREE.Vector3());
    const funnelItem = this.lastScene?.bench.find((item) => item.placement.kind === "seated"
      && item.placement.parentInstanceId === target.instanceId && /funnel-seat$/.test(item.placement.zoneId));
    const funnel = funnelItem ? this.items.get(funnelItem.instanceId) : undefined;
    const funnelBox = funnel ? new THREE.Box3().setFromObject(funnel.model ?? funnel.root) : undefined;
    const mouthZ = funnelBox ? (funnelBox.max.y - targetBase.y) / MM
      : tFill?.innerBoxMm?.topZ ?? tFill?.innerProfileMm?.at(-1)?.[1] ?? (box.max.y - targetBase.y) / MM;
    const mouthR = funnelBox ? ((funnelBox.max.x - funnelBox.min.x) / 2) * 0.8
      : (tFill?.innerBoxMm ? Math.min(tFill.innerBoxMm.width, tFill.innerBoxMm.depth) / 2 : tFill?.innerProfileMm?.at(-1)?.[0] ?? 10) * MM;
    const mouth = targetBase.clone().add(new THREE.Vector3(0, mouthZ * MM, 0));

    // Pour from the target's left or right as the camera sees it, the side the source is on, so the
    // stream is not hidden behind either vessel.
    const camRight = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0).setY(0).normalize();
    const sideOf = [endPos, restPos, startPos].map((p) => p.clone().sub(mouth).setY(0)).find((d) => d.length() > 0.03);
    const away = holding ? holding.away.clone() : camRight.clone().multiplyScalar(sideOf && sideOf.dot(camRight) > 0 ? 1 : -1);
    const toward = away.clone().negate();

    // An item rinsed into the target (decided 2026-10-04): a weighing boat is lifted from where it rests
    // and held tipped toward the funnel, just above its rim. The wash bottle's jet goes into it, and the
    // washings spill from its low rim down into the target.
    const viaView = args.via && args.via !== args.sourceId && args.via !== args.targetId ? this.items.get(args.via) : undefined;
    // A boat already held over the funnel from the last squirt stays there; it rests where it rested before.
    const viaHeld = Boolean(viaView && holding && holding.viaId === args.via && holding.via && holding.viaRest);
    const heldRest = viaHeld ? holding?.viaRest : undefined;
    const viaRest = viaView ? (heldRest ? { pos: heldRest.pos.clone(), quat: heldRest.quat.clone() }
      : { pos: viaView.root.position.clone(), quat: viaView.root.quaternion.clone() }) : undefined;
    let viaHold: { pos: THREE.Vector3; quat: THREE.Quaternion; spill: THREE.Vector3; inside: THREE.Vector3 } | undefined;
    if (viaView && viaRest && viaView.entry?.pour) {
      // Tipped the way it is poured from (its registered lip and tilt, past its walls' slope so the
      // washings run out), with its lip just inside the funnel's rim, where they spill.
      const viaGeometry = pourGeometry(viaView.entry);
      const quat = pourQuaternion(viaGeometry, toward, viaGeometry.tiltMax);
      const spill = mouth.clone().addScaledVector(away, mouthR * 0.4).add(new THREE.Vector3(0, 0.004, 0));
      const pos = rootForLip(viaGeometry, quat, spill);
      viaHold = { pos, quat, spill, inside: pos.clone().add(new THREE.Vector3(0, 0.012, 0).applyQuaternion(quat)) };
    }
    // What a jet is aimed at: inside a held item, or the mouth.
    const aimAt = viaHold ? viaHold.inside : mouth;

    // The lip's pouring point: just over the mouth. A jet's nozzle stands back along its own direction
    // from the point it is aimed at, so the jet goes there.
    const jetDir = jet && geometry.tipDir ? geometry.tipDir.clone().applyQuaternion(pourQuaternion(geometry, toward, geometry.tiltMax)).normalize() : undefined;
    const lipAt = jet
      ? jetDir ? aimAt.clone().addScaledVector(jetDir, -0.06) : aimAt.clone().addScaledVector(away, 0.045).add(new THREE.Vector3(0, 0.055, 0))
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
    const drain = Math.max(0, args.drainS ?? 0);
    const T = { approach: holding ? 0.2 : (released ? 0.3 : 0.45) + (viaHold && !viaHeld ? 0.45 : 0), tilt: 0.35, flow, drain, untilt: 0.3,
      back: 0.45 + (viaHold ? 0.45 : 0) };
    // Draining holds the emptied vessel at its last tilt between the pour and the untilt.
    const at = { tilt: T.approach, flow: T.approach + T.tilt, drain: T.approach + T.tilt + flow, untilt: T.approach + T.tilt + flow + drain,
      back: T.approach + T.tilt + flow + drain + T.untilt };
    // A squirt short of the count ends with the bottle upright beside what it rinses, still held.
    const total = args.holdAfter ? at.back : at.back + T.back;

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
    // With an item held over the mouth, a second stream: its washings running down into the target.
    const runoff = material && viaHold ? new THREE.Mesh(new THREE.BufferGeometry(), material) : undefined;
    // A pour down a stirring rod: its lower end inside the target's mouth, leaning on the source's lip.
    const guideRod = args.guideRodId && args.guideRodId !== args.sourceId ? this.items.get(args.guideRodId) : undefined;
    const rodFoot = mouth.clone().addScaledVector(away, mouthR * 0.35).add(new THREE.Vector3(0, -0.012, 0));
    // While a measuring vessel drains, single drops fall from its lip.
    const drip = material && drain > 0 && !solid ? new THREE.Mesh(new THREE.BufferGeometry(), material) : undefined;
    for (const mesh of [stream, runoff, drip]) {
      if (!mesh) continue;
      mesh.visible = false;
      mesh.renderOrder = 4;
      mesh.raycast = () => undefined;
      this.scene.add(mesh);
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
    let solidLanded = false;

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
        // Draining tips the emptied vessel on toward upside down (to 150°), so its last drops run to the lip.
        const drained = drain > 0 ? Math.max(tiltEnd, 150 * DEG) : tiltEnd;
        const dU = drain > 0 ? ease(span(t, at.drain, Math.min(0.6, drain))) : 0;
        const held = tiltEnd + (drained - tiltEnd) * dU;
        const tilt = tipping ? tiltStart * (1 - Math.pow(1 - u, 2)) : t < at.drain ? tiltStart + (tiltEnd - tiltStart) * ease(u)
          : t < at.untilt ? held : drained * (1 - ease(u));
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
      if (guideRod) {
        // Held from the start of the tilt until the source is upright again.
        const holding = t >= at.tilt && t < at.untilt + T.untilt;
        guideRod.root.visible = true;
        if (holding) {
          const along = lip.clone().add(new THREE.Vector3(0, 0.004, 0)).sub(rodFoot).normalize();
          guideRod.root.position.copy(rodFoot);
          guideRod.root.quaternion.setFromUnitVectors(UP, along);
          guideRod.benchShift = undefined;
          guideRod.benchLift = undefined;
          guideRod.root.updateMatrixWorld(true);
        }
      }
      if (viaView && viaRest && viaHold) {
        // Held over the mouth from the approach until the source is back upright, then set down again:
        // lifted clear of the funnel, carried across, lowered onto its hold, and back the same way.
        const moving = viaHeld && t < at.back ? 1 : t < at.tilt ? span(t, 0, T.approach) : t < at.back ? 1 : 1 - span(t, at.back, T.back);
        const clearY = Math.max(viaRest.pos.y, viaHold.pos.y, mouth.y + 0.05);
        const up = viaRest.pos.clone().setY(clearY), over = viaHold.pos.clone().setY(clearY);
        const leg = (u: number) => ease(Math.min(1, Math.max(0, u)));
        viaView.root.position.copy(moving < 1 / 3 ? viaRest.pos.clone().lerp(up, leg(moving * 3))
          : moving < 2 / 3 ? up.lerp(over, leg(moving * 3 - 1)) : over.lerp(viaHold.pos, leg(moving * 3 - 2)));
        viaView.root.quaternion.copy(viaRest.quat).slerp(viaHold.quat, leg(moving * 1.5));
        viaView.root.updateMatrixWorld(true);
      }

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
          this.replaceContents(target, ml > 0 ? buildContents(targetEntry, { ...args.targetAfter, style, volumeMl: ml, ...fillLevelMm(tFill!, ml) })
            : buildContents(targetEntry, args.targetBefore));
        }
      } else if (args.targetAfter.kind === "solid" && !solidLanded && targetU > 0.15) {
        // A solid poured in (a weighing boat tipped into a flask) shows in the target as it lands.
        solidLanded = true;
        this.replaceContents(target, buildContents(targetEntry, args.targetAfter));
      }

      // The stream: its leading edge falls from the lip, its trailing edge follows it down. With an item
      // held over the mouth, the jet goes into the item, and the washings spill from its rim a moment later.
      if (stream) {
        const s1 = span(flowT, 0, 0.12);
        const s0 = span(flowT, flow - 0.15, 0.15);
        stream.visible = flowT > 0 && s1 > s0 + 0.01;
        const landMl = liquidOf(args.targetBefore) + (liquidOf(args.targetAfter) - liquidOf(args.targetBefore)) * targetU;
        const land = targetBase.clone().addScaledVector(away, mouthR * 0.15);
        land.y = targetBase.y + Math.max(targetLevel(landMl), tFill?.innerProfileMm?.[0]?.[1] ?? tFill?.innerBoxMm?.floorZ ?? 0) * MM;
        if (stream.visible) {
          stream.geometry.dispose();
          stream.geometry = streamGeometry(lip, viaHold ? aimAt : land, streamRadius, s0, s1,
            jet && geometry.tipDir ? geometry.tipDir.clone().applyQuaternion(q) : undefined, jet && !viaHold ? aimAt : undefined);
        }
        if (drip) {
          const dripT = t - at.drain;
          const phase = (dripT * 1.6) % 1;
          drip.visible = dripT > 0.15 && t < at.untilt - 0.1 && phase < 0.7;
          if (drip.visible) {
            const landMl = liquidOf(args.targetAfter);
            const land = targetBase.clone().addScaledVector(away, mouthR * 0.15);
            land.y = targetBase.y + Math.max(targetLevel(landMl), tFill?.innerProfileMm?.[0]?.[1] ?? tFill?.innerBoxMm?.floorZ ?? 0) * MM;
            const head = Math.min(1, phase / 0.7);
            drip.geometry.dispose();
            drip.geometry = streamGeometry(lip, land, streamRadius * 0.9, Math.max(0, head - 0.06), head);
          }
        }
        if (runoff && viaHold) {
          const r1 = span(flowT, 0.18, 0.12);
          const r0 = span(flowT, flow - 0.02, 0.2);
          runoff.visible = flowT > 0.18 && r1 > r0 + 0.01;
          if (runoff.visible) {
            runoff.geometry.dispose();
            runoff.geometry = streamGeometry(viaHold.spill, land, streamRadius * 1.4, r0, r1);
          }
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
      if (runoff) {
        this.scene.remove(runoff);
        runoff.geometry.dispose();
      }
      if (drip) {
        this.scene.remove(drip);
        drip.geometry.dispose();
      }
      if (rack) {
        source.root.add(rack.object);
        rack.object.position.copy(rack.position);
        rack.object.quaternion.copy(rack.quaternion);
      }
      if (args.holdAfter) {
        // Held for the next squirt: the bottle upright beside what it rinses, the boat over the funnel.
        this.squirtHold = {
          sourceId: args.sourceId, away: away.clone(),
          source: { pos: standPos.clone(), quat: upright.clone() },
          sourceRest: { pos: endPos.clone(), quat: endQuat.clone() },
          ...(viaView && viaRest && viaHold ? {
            viaId: viaView.instanceId,
            via: { pos: viaHold.pos.clone(), quat: viaHold.quat.clone() },
            viaRest: { pos: viaRest.pos.clone(), quat: viaRest.quat.clone() },
          } : {}),
        };
      } else {
        if (holding) this.squirtHold = undefined;
        if (viaView && viaRest) {
          viaView.root.position.copy(viaRest.pos);
          viaView.root.quaternion.copy(viaRest.quat);
        }
      }
      // Contents drawn during the pour are rebuilt by the next sync.
      source.contentsKey = "animating";
      target.contentsKey = "animating";
    };
    return { tick, cleanup };
  }

  /**
   * Show a vessel set on an instrument's seat for a reading the runtime has accepted (handoff §5.7:
   * "The weighing animation may set the vessel on the pan", then return it where the runtime keeps
   * it; plan §2.4). It is lifted from where it stands, or from where a drag released it, carried
   * level onto the seat, rests, and is carried back to its rest position (setOn.ts). The runtime
   * never moves it, so the resting scene is unchanged (G-3). A sync does not cut it short: the
   * sync's new rest position is where it returns. Resolves when done, or at once under reduced
   * motion or when the instrument has no anchor for the zone.
   */
  animateSetOn(args: { sourceId: string; targetId: string; zoneId: string }): Promise<void> {
    this.stopSetOn();
    const released = this.releasedCarry?.instanceId === args.sourceId && performance.now() - this.releasedCarry.at < 2000
      ? this.releasedCarry : undefined;
    this.releasedCarry = undefined;
    const source = this.items.get(args.sourceId);
    const target = this.items.get(args.targetId);
    const anchor = target?.entry?.anchors[args.zoneId]?.positionMm;
    if (this.options.reducedMotion || !source || !target || !anchor || source === target) return Promise.resolve();
    const start = (released?.position ?? source.root.position).clone();
    let elapsed = 0;
    return new Promise((resolve) => {
      const finish = () => {
        const rest = this.restPositions.get(args.sourceId);
        const restQuaternion = this.restQuaternions.get(args.sourceId);
        if (rest) source.root.position.copy(rest);
        if (restQuaternion) source.root.quaternion.copy(restQuaternion);
        this.poseSeatedChildren(args.sourceId);
        this.shadowsDirty = true;
        this.requestRender();
        resolve();
      };
      const tick = (dt: number): boolean => {
        // A sync that took either item off the bench ends it.
        if (this.items.get(args.sourceId) !== source || this.items.get(args.targetId) !== target) return false;
        elapsed += dt;
        const seat = seatPoint(anchor, target.root.position, target.root.rotation);
        const rest = this.restPositions.get(args.sourceId) ?? start;
        const { position, done } = setOnPosition(start, seat, rest, elapsed);
        source.root.position.copy(position);
        const restQuaternion = this.restQuaternions.get(args.sourceId);
        if (restQuaternion) source.root.quaternion.copy(restQuaternion);
        this.shadowsDirty = true;
        return !done;
      };
      this.setOn = { tick, finish };
      this.requestRender();
    });
  }

  /** End a running set-on now (a new one, or disposal): the vessel goes back to its rest. */
  private stopSetOn(): void {
    const run = this.setOn;
    if (!run) return;
    this.setOn = undefined;
    run.finish();
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
   * The microarray lab's mouse camera (`3d-v3/app.js:111-151`), decided 2026-10-03/04: right-drag
   * pans sideways (the bench point under the pointer stays under it) and tilts with up/down; Shift
   * or Alt + right-drag, or middle-drag, orbits; the wheel zooms toward the bench point under the
   * pointer. Drags start after 3 px; a right click without a drag calls `onCameraClick`. The left
   * button is never the camera's. Touch (choice 5, tablets): one finger on empty bench pans and
   * tilts like a right-drag, a pinch zooms and a two-finger drag orbits; a touch that picks up an
   * item holds the camera (`holdCameraInput`).
   */
  private attachCameraInput(): () => void {
    const canvas = this.canvas;
    const point = (e: { clientX: number; clientY: number }) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType === "mouse") this.onMouseInput?.();
      if (e.pointerType === "touch") {
        const p = point(e);
        this.touches.set(e.pointerId, p);
        // Captured, so a finger that slides over a panel or lifts there still ends its gesture here.
        canvas.setPointerCapture(e.pointerId);
        if (this.cameraHeld) return;
        this.startTouchGesture();
        return;
      }
      if (e.button !== 1 && e.button !== 2) return;
      const p = point(e);
      const mode = e.button === 1 || e.shiftKey || e.altKey ? "orbit" : "pan";
      this.camDrag = { id: e.pointerId, button: e.button, mode, x: p.x, y: p.y, startX: p.x, startY: p.y, drag: false };
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch") {
        if (!this.touches.has(e.pointerId)) return;
        this.touches.set(e.pointerId, point(e));
        if (!this.cameraHeld) this.moveTouchGesture();
        return;
      }
      const d = this.camDrag;
      if (!d || d.id !== e.pointerId) return;
      const p = point(e);
      if (!d.drag && Math.hypot(p.x - d.startX, p.y - d.startY) > MANUAL.dragPx) {
        d.drag = true;
        this.beginManualCamera();
      }
      if (d.drag) {
        if (d.mode === "orbit") this.setView(orbitBy(this.view, p.x - d.x, p.y - d.y));
        else this.setView(panTiltBy(this.view, this.onBench(d.x, d.y), this.onBench(p.x, d.y), p.y - d.y));
      }
      d.x = p.x;
      d.y = p.y;
    };
    const up = (e: PointerEvent) => {
      if (e.pointerType === "touch") {
        this.touches.delete(e.pointerId);
        if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
        if (!this.cameraHeld && this.touches.size) this.startTouchGesture();
        else if (!this.touches.size) this.touchGesture = undefined;
        return;
      }
      const d = this.camDrag;
      if (!d || d.id !== e.pointerId) return;
      this.camDrag = undefined;
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      if (!d.drag && d.button === 2 && e.type === "pointerup") this.onCameraClick?.();
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      this.onMouseInput?.();
      const p = point(e);
      this.beginManualCamera();
      this.zoomAt(p.x, p.y, e.deltaY);
    };
    const noMenu = (e: Event) => e.preventDefault();
    const noMiddle = (e: MouseEvent) => { if (e.button === 1) e.preventDefault(); };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("wheel", wheel, { passive: false });
    canvas.addEventListener("contextmenu", noMenu);
    canvas.addEventListener("auxclick", noMiddle);
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("wheel", wheel);
      canvas.removeEventListener("contextmenu", noMenu);
      canvas.removeEventListener("auxclick", noMiddle);
    };
  }

  /** A new touch baseline: one finger pans and tilts; two fingers pinch-zoom and orbit about their midpoint. */
  private startTouchGesture(): void {
    const pts = [...this.touches.values()];
    if (!pts.length) return;
    const x = pts.length > 1 ? (pts[0].x + pts[1].x) / 2 : pts[0].x;
    const y = pts.length > 1 ? (pts[0].y + pts[1].y) / 2 : pts[0].y;
    const span = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : undefined;
    this.touchGesture = { startX: x, startY: y, x, y, drag: Boolean(span), span, manual: this.touchGesture?.manual ?? false };
  }

  private moveTouchGesture(): void {
    const g = this.touchGesture;
    const pts = [...this.touches.values()];
    if (!g || !pts.length) return;
    if (pts.length > 1 && g.span !== undefined) {
      const x = (pts[0].x + pts[1].x) / 2, y = (pts[0].y + pts[1].y) / 2;
      const span = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (!g.manual) { g.manual = true; this.beginManualCamera(); }
      if (span > 1 && g.span > 1) this.zoomAt(x, y, Math.log(g.span / span) / MANUAL.zoomPerDelta);
      this.setView(orbitBy(this.view, x - g.x, y - g.y));
      Object.assign(g, { x, y, span });
      return;
    }
    const p = pts[0];
    if (!g.drag && Math.hypot(p.x - g.startX, p.y - g.startY) > MANUAL.dragPx) g.drag = true;
    if (g.drag) {
      if (!g.manual) { g.manual = true; this.beginManualCamera(); }
      this.setView(panTiltBy(this.view, this.onBench(g.x, g.y), this.onBench(p.x, g.y), p.y - g.y));
    }
    g.x = p.x;
    g.y = p.y;
  }

  /** Zoom keeping the bench point under (x, y) fixed (`app.js:146-151`). */
  private zoomAt(x: number, y: number, deltaY: number): void {
    const before = this.onBench(x, y);
    this.view = zoomBy(this.view, deltaY);
    this.updateCamera();
    const after = this.onBench(x, y);
    if (before && after) this.setView({ ...this.view, at: clampAt(this.view.at.clone().add(before.sub(after))) });
    else this.setView(this.view);
  }

  /** The bench-plane point under canvas pixel (x, y), or null when the ray misses it (`renderer.js` `onPlane`). */
  private onBench(x: number, y: number): THREE.Vector3 | null {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return null;
    this.raycaster.setFromCamera(new THREE.Vector2((x / w) * 2 - 1, 1 - (y / h) * 2), this.camera);
    const ray = this.raycaster.ray;
    if (Math.abs(ray.direction.y) < 0.001) return null;
    const t = -ray.origin.y / ray.direction.y;
    return t > 0 ? ray.at(t, new THREE.Vector3()) : null;
  }

  /** A manual move cancels any framing tween and suspends auto-framing (`framing.js:84`). */
  private beginManualCamera(): void {
    this.tween = undefined;
    this.onManualCamera?.();
  }

  private setView(view: OrbitView): void {
    this.view = view;
    this.updateCamera();
    this.requestRender();
    this.onChange?.();
  }

  private updateCamera(): void {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    applyView(this.camera, this.view, w > 0 && h > 0 ? w / h : this.camera.aspect || 1);
  }

  private canvasSize(): { w: number; h: number } {
    return { w: Math.max(1, this.canvas.clientWidth), h: Math.max(1, this.canvas.clientHeight) };
  }

  /**
   * Frame a set of items (or every item) into the free area around open panels, with the
   * microarray lab's `fit` (camera/benchCamera.ts), keeping the angle the learner looks from (its
   * yaw, and its pitch within the manual limits; decided 2026-10-05), a 650 ms tween, or a cut under
   * reduced motion. `marginFactor` grows the items' bounds about
   * their centre; `safe` are the free canvas rectangles (default `safeAreas`). "all" also takes in
   * the runtime bench, as the microarray's framing keeps its bench outline in view, so one item
   * alone on the bench is not framed as a close-up.
   */
  frameItems(instanceIds: string[] | "all", marginFactor = 1.1, safe: Rect[] | undefined = this.safeAreas): void {
    const box = new THREE.Box3();
    const views = instanceIds === "all" ? [...this.items.values()] : instanceIds.map((id) => this.items.get(id)).filter(Boolean) as ItemView[];
    views.forEach((view) => box.expandByObject(view.root));
    if (instanceIds === "all") {
      const w = (BENCH_MM.width * MM) / 2, d = (BENCH_MM.depth * MM) / 2;
      box.expandByPoint(new THREE.Vector3(-w, 0, -d)).expandByPoint(new THREE.Vector3(w, 0, d));
    }
    if (box.isEmpty()) box.set(new THREE.Vector3(-0.5, 0, -0.3), new THREE.Vector3(0.5, 0.25, 0.3));
    this.frameBox(box, marginFactor, safe);
  }

  /** "Whole bench": the microarray lab's preset (`app.js:108`). */
  frameBench(): void {
    this.tweenTo(PRESETS.bench());
  }

  /** "Overhead": the microarray lab's Top preset (`app.js:108`). */
  overhead(): void {
    this.tweenTo(PRESETS.top());
  }

  /** The current camera pose, so Examine can return to it (§5.8). */
  pose(): CameraPose {
    // Mid-tween, the view it is going to: Examine or drop mode returns there, not half-way.
    return copyView(this.tween ? this.tween.to : this.view);
  }

  /** Back to a saved pose. */
  restorePose(pose: CameraPose): void {
    this.tweenTo(copyView(pose));
  }

  /**
   * Examine's Eye level (§5.8): the camera level with the liquid surface, looking straight at it,
   * the correct way to read a meniscus. The level comes from the runtime contents through the fill
   * profile; the item does not move. A programmatic view, so it sits outside the manual limits
   * (pitch 0 and a short distance) until the camera is next moved by hand.
   */
  eyeLevel(instanceId: string, levelMm: number, distanceM = 0.32, seeThrough: string[] = []): void {
    const view = this.items.get(instanceId);
    if (!view) return;
    const target = view.root.position.clone();
    target.y += levelMm * MM;
    const current = new THREE.Vector3(Math.sin(this.view.yaw), 0, Math.cos(this.view.yaw));
    // The first direction, from the current one outward, with nothing else between the eye and the
    // line: another item standing in front (a wash bottle beside the flask) would hide the meniscus.
    const own = new Set([instanceId, ...seeThrough, ...this.lockedDescendants(instanceId)]);
    const blocked = (dir: THREE.Vector3): boolean => {
      this.raycaster.set(target, dir.clone().normalize());
      this.raycaster.far = distanceM;
      const hits = this.raycaster.intersectObject(this.itemLayer, true);
      this.raycaster.far = Infinity;
      return hits.some((hit) => !own.has(hit.object.userData.instanceId as string));
    };
    // Best, the middle of the view is clear too: an item beside the line of sight close to the eye (a
    // parked wash bottle) would fill half the view without hiding the line (found 2026-10-04).
    const fan = (dir: THREE.Vector3): THREE.Vector3[] => {
      const side = new THREE.Vector3().crossVectors(UP, dir).normalize();
      return [[10, 0], [-10, 0], [0, 6], [0, -6]].map(([yawDeg, pitchDeg]) =>
        dir.clone().applyAxisAngle(UP, yawDeg * DEG).applyAxisAngle(side, pitchDeg * DEG));
    };
    const turns = [0, 35, -35, 70, -70, 110, -110, 180].map((deg) => current.clone().applyAxisAngle(UP, deg * DEG));
    const chosen = turns.find((dir) => !blocked(dir) && !fan(dir).some(blocked)) ?? turns.find((dir) => !blocked(dir)) ?? current;
    const yaw = this.view.yaw + Math.atan2(Math.sin(Math.atan2(chosen.x, chosen.z) - this.view.yaw), Math.cos(Math.atan2(chosen.x, chosen.z) - this.view.yaw));
    this.tweenTo({ at: target, yaw, pitch: 0, distance: distanceM });
  }

  private frameBox(box: THREE.Box3, marginFactor: number, safe: Rect[] | undefined): void {
    const centre = box.getCenter(new THREE.Vector3());
    const half = box.getSize(new THREE.Vector3()).multiplyScalar(marginFactor / 2);
    const points: THREE.Vector3[] = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      points.push(new THREE.Vector3(centre.x + sx * half.x, Math.max(0, centre.y + sy * half.y), centre.z + sz * half.z));
    }
    const size = this.canvasSize();
    const rects = safe?.length ? safe : safeRects(size, []);
    // The angle the learner is looking from is kept (decided 2026-10-05, replacing choice 11's turn
    // back to the front at a fixed pitch): framing moves only the look-at point and the distance.
    const base: OrbitView = { ...copyView(this.view), pitch: clampManual(this.view).pitch };
    const goal = fitBest(points, base, size, rects);
    if (goal) this.tweenTo(goal);
  }

  /**
   * The Studio's equipment inspection (handoff §4.8): the camera turns slowly around what it
   * frames, all the way round. Under reduced motion it does not turn; the item can still be
   * orbited by hand.
   */
  setTurntable(on: boolean): void {
    this.turntable = on;
    this.requestRender();
  }

  /** Home: the microarray lab's starting view (`renderer.js:119`). */
  resetView(): void {
    this.tweenTo(DEFAULT_VIEW());
  }

  private tweenTo(goal: OrbitView): void {
    const duration = this.options.reducedMotion ? 0 : 0.65;
    this.tween = { from: copyView(this.view), to: goal, t: 0, duration };
    this.requestRender();
  }

  dispose(): void {
    this.endDemo();
    this.stopPour();
    this.stopSetOn();
    this.stopToolRun();
    this.stopMixRun();
    this.setToolLoad(null);
    for (const drop of this.droplets) { this.scene.remove(drop.mesh); drop.mesh.geometry.dispose(); }
    this.droplets = [];
    this.dropMaterial?.dispose();
    this.disposed = true;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.detachCameraInput?.();
    this.items.forEach((view) => { if (view.contents) disposeObject(view.contents); });
    this.items.clear();
    this.contact.dispose();
    this.models.dispose();
    disposeTextures(this.textures);
    (this.scene.environment as THREE.Texture | null)?.dispose();
    this.room.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}
