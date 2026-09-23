import * as THREE from "three";

/**
 * In-scene signals (handoff §3.7). None relies on colour alone: rings carry a ✓ or ✕ mark drawn
 * as strokes (the bundled font subset has neither glyph), the footprint is dashed, and the
 * beacon is a double ring. Colours are the design tokens, never liquid hues (G-9).
 */
const TOKENS = {
  guide: new THREE.Color("#197b7b"),
  brand: new THREE.Color("#2a5a49"),
  error: new THREE.Color("#9a4b37"),
  white: new THREE.Color("#ffffff"),
  ink: new THREE.Color("#233934"),
};

const ringMesh = (inner: number, outer: number, colour: THREE.Color, opacity = 1): THREE.Mesh => {
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(inner, outer, 72).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity, depthWrite: false, toneMapped: false }),
  );
  mesh.renderOrder = 5;
  mesh.raycast = () => undefined;
  return mesh;
};

const markSprite = (kind: "valid" | "invalid"): THREE.Sprite => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const g = canvas.getContext("2d")!;
  g.fillStyle = kind === "valid" ? "#197b7b" : "#9a4b37";
  g.beginPath();
  g.arc(32, 32, 30, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#ffffff";
  g.lineWidth = 7;
  g.lineCap = "round";
  g.lineJoin = "round";
  g.beginPath();
  if (kind === "valid") {
    g.moveTo(18, 33);
    g.lineTo(28, 43);
    g.lineTo(46, 22);
  } else {
    g.moveTo(21, 21);
    g.lineTo(43, 43);
    g.moveTo(43, 21);
    g.lineTo(21, 43);
  }
  g.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, toneMapped: false }));
  sprite.scale.set(0.022, 0.022, 1);
  sprite.renderOrder = 9;
  return sprite;
};

export type TargetRingKind = "valid" | "invalid" | "zone";

export class Signals {
  readonly group = new THREE.Group();
  private readonly beacon = new THREE.Group();
  private readonly selection: THREE.Mesh;
  private readonly target = new THREE.Group();
  private readonly footprint: THREE.LineLoop;
  private beaconPhase = 0;

  constructor() {
    this.group.name = "signals";
    const outer = ringMesh(0.98, 1, TOKENS.white, 0.9);
    const edge = ringMesh(0.94, 0.98, TOKENS.guide, 1);
    const halo = ringMesh(1.18, 1.22, TOKENS.white, 0.5);
    this.beacon.add(outer, edge, halo);
    this.beacon.visible = false;
    this.selection = ringMesh(0.95, 1, TOKENS.brand, 1);
    this.selection.visible = false;
    this.target.visible = false;
    const dashes = new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 64 }, (_, i) => new THREE.Vector3(Math.cos((i / 64) * Math.PI * 2), 0, Math.sin((i / 64) * Math.PI * 2))),
    );
    this.footprint = new THREE.LineLoop(dashes, new THREE.LineDashedMaterial({ color: TOKENS.ink, dashSize: 0.08, gapSize: 0.06, transparent: true, opacity: 0.7, depthWrite: false }));
    this.footprint.computeLineDistances();
    this.footprint.visible = false;
    this.footprint.raycast = () => undefined;
    this.group.add(this.beacon, this.selection, this.target, this.footprint);
  }

  /** Radius in metres; position is the item's base on the bench. */
  setBeacon(at: THREE.Vector3 | null, radius = 0.05): void {
    this.beacon.visible = Boolean(at);
    if (!at) return;
    this.beacon.position.set(at.x, 0.0012, at.z);
    this.beacon.scale.setScalar(radius + 0.012);
  }

  setSelected(at: THREE.Vector3 | null, radius = 0.05): void {
    this.selection.visible = Boolean(at);
    if (!at) return;
    this.selection.position.set(at.x, 0.001, at.z);
    this.selection.scale.setScalar(radius);
  }

  setTarget(at: THREE.Vector3 | null, kind: TargetRingKind = "valid", radius = 0.05): void {
    this.target.clear();
    this.target.visible = Boolean(at);
    if (!at) return;
    const colour = kind === "invalid" ? TOKENS.error : TOKENS.guide;
    const ring = ringMesh(0.9, 1, colour, 1);
    const fill = new THREE.Mesh(new THREE.CircleGeometry(0.9, 72).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.14, depthWrite: false, toneMapped: false }));
    fill.raycast = () => undefined;
    ring.scale.setScalar(1);
    this.target.add(fill, ring);
    this.target.position.set(at.x, Math.max(0.0015, at.y), at.z);
    this.target.scale.setScalar(radius + 0.008);
    if (kind !== "zone") {
      const mark = markSprite(kind);
      mark.position.set(1.05, 0.25, 0);
      mark.scale.set(0.022 / (radius + 0.008), 0.022 / (radius + 0.008), 1);
      this.target.add(mark);
    }
  }

  setFootprint(at: THREE.Vector3 | null, radius = 0.05): void {
    this.footprint.visible = Boolean(at);
    if (!at) return;
    this.footprint.position.set(at.x, 0.0014, at.z);
    this.footprint.scale.setScalar(radius);
  }

  /** Advances the beacon pulse; returns true while something is animating. */
  tick(dt: number, reducedMotion: boolean): boolean {
    if (!this.beacon.visible || reducedMotion) return false;
    this.beaconPhase = (this.beaconPhase + dt / 1.6) % 1;
    const s = 1 + 0.08 * Math.sin(this.beaconPhase * Math.PI * 2);
    this.beacon.children[2].scale.setScalar(s);
    return true;
  }
}
