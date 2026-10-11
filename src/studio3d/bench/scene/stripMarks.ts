import * as THREE from "three";
import type { SceneStrip } from "../../adapters/runtimeToScene";
import type { Equipment3DEntry } from "../../equipment3d/types";

/**
 * What the viewer draws on a chromatography strip's face and on a developing chamber's label tape (Pack 3a,
 * decided 2026-10-10): the models carry nothing printed (`tools/blender/equipment/chromatography_paper.py`), so the
 * pencil baseline, the spot, the rising front, the bands, the front's pencil mark and the tape's writing come from
 * the runtime's state (G-3) through `SceneStrip` and `tapeLabel`. Presentation only.
 *
 * The bands and the spot are drawn a little stronger than the faint dyes of a real strip (the policy: modestly
 * boost faint visuals), so they read at bench distance.
 */
const MM = 0.001;
const PX_PER_MM = 12;
const GRAPHITE = "rgba(58, 60, 68, 0.9)";
/** The spot when the scene names no colour for it: the mixed food dyes, a dark violet-brown. */
const SPOT = "#3c2254";

export interface MarksLayer {
  mesh: THREE.Mesh;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  key: string;
}

type StripFace = NonNullable<Equipment3DEntry["stripFace"]>;

const layerMaterial = (texture: THREE.Texture): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({
  map: texture,
  transparent: true,
  roughness: 0.92,
  metalness: 0,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2,
});

const newLayer = (widthPx: number, heightPx: number, geometry: THREE.BufferGeometry): MarksLayer => {
  const canvas = document.createElement("canvas");
  canvas.width = widthPx;
  canvas.height = heightPx;
  const context = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const mesh = new THREE.Mesh(geometry, layerMaterial(texture));
  mesh.raycast = () => undefined;
  mesh.renderOrder = 2;
  return { mesh, canvas, context, texture, key: "" };
};

/** A layer lying just off the strip's face, in the model's frame (model mm x, y, z -> three x, z, -y). */
export const buildStripLayer = (face: StripFace): MarksLayer => {
  const layer = newLayer(Math.round(face.widthMm * PX_PER_MM), Math.round(face.lengthMm * PX_PER_MM),
    new THREE.PlaneGeometry(face.widthMm * MM, face.lengthMm * MM));
  const [nx, ny, nz] = face.normalMm;
  const normal = new THREE.Vector3(nx, nz, -ny).normalize();
  layer.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  const off = face.thicknessMm / 2 + 0.03;
  layer.mesh.position.set(nx * off * MM, (face.lengthMm / 2 + nz * off) * MM, -ny * off * MM);
  layer.mesh.name = "strip-marks";
  return layer;
};

/**
 * Draw the strip's marks. `progress` (0 to 1) is how far development has run: the front and the bands climb with it
 * while the step clock runs; 1 is the strip as the runtime has it.
 */
export const drawStrip = (layer: MarksLayer, face: StripFace, strip: SceneStrip | undefined, wet: boolean, progress = 1): void => {
  const key = JSON.stringify([strip ?? null, wet, Math.round(progress * 200)]);
  if (layer.key === key) return;
  layer.key = key;
  const { context: g, canvas } = layer;
  g.clearRect(0, 0, canvas.width, canvas.height);
  if (!strip) { layer.texture.needsUpdate = true; return; }
  const W = canvas.width;
  const y = (zMm: number) => (face.lengthMm - zMm) * PX_PER_MM;
  const px = (mm: number) => mm * PX_PER_MM;
  const base = strip.baselineMm;
  const developed = strip.frontMm !== undefined && base !== undefined;
  const p = developed ? Math.max(0, Math.min(1, progress)) : 0;

  if (developed) {
    // The solvent's reach: the paper below the front a shade darker while wet, its edge a little darker still.
    const front = base! + strip.frontMm! * p;
    if (wet) {
      g.fillStyle = "rgba(96, 112, 132, 0.12)";
      g.fillRect(0, y(front), W, canvas.height - y(front));
      g.fillStyle = "rgba(90, 104, 124, 0.32)";
      g.fillRect(0, y(front) - px(0.25), W, px(0.5));
    }
    for (const band of strip.bands) {
      const centre = y(base! + band.distanceMm * p);
      const gradient = g.createRadialGradient(W / 2, centre, 0, W / 2, centre, px(3.2));
      gradient.addColorStop(0, withAlpha(band.color, 0.9));
      gradient.addColorStop(0.55, withAlpha(band.color, 0.62));
      gradient.addColorStop(1, withAlpha(band.color, 0));
      g.save();
      g.translate(W / 2, centre);
      g.scale(1, 0.62);
      g.translate(-W / 2, -centre);
      g.fillStyle = gradient;
      g.beginPath();
      g.arc(W / 2, centre, px(4.6), 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }
  if (base !== undefined) {
    g.strokeStyle = GRAPHITE;
    g.lineWidth = px(0.3);
    g.beginPath();
    g.moveTo(px(0.9), y(base));
    g.lineTo(W - px(0.9), y(base));
    g.stroke();
  }
  if (strip.spots > 0 && base !== undefined) {
    // Each touch spreads the spot a little; once developed only a faint trace stays at the origin. The colour is the
    // spotted liquid's (G-9), drawn denser than the liquid in its vial, as a dried spot reads.
    const radius = [0.95, 1.25, 1.5][Math.min(strip.spots, 3) - 1];
    const colour = strip.spotColor ?? SPOT;
    g.fillStyle = withAlpha(colour, developed ? 0.9 * (1 - 0.75 * p) : 0.92);
    g.beginPath();
    g.arc(W / 2, y(base), px(radius), 0, Math.PI * 2);
    g.fill();
  }
  if (developed && strip.frontMarked) {
    g.strokeStyle = GRAPHITE;
    g.lineWidth = px(0.3);
    g.beginPath();
    g.moveTo(px(0.9), y(base! + strip.frontMm!));
    g.lineTo(W - px(0.9), y(base! + strip.frontMm!));
    g.stroke();
  }
  layer.texture.needsUpdate = true;
};

/**
 * The developing chamber's label tape (`chromatography_chamber.py`: masking tape wrapped on the front, 68 to 86 mm
 * up, outside the 15 mm glass). The writing is a strip of cylinder just outside the tape.
 */
const TAPE = { radiusMm: 15.0 + 0.12 + 0.08, z0Mm: 68, z1Mm: 86, halfArcMm: 13 };

export const buildTapeLayer = (): MarksLayer => {
  const arc = TAPE.halfArcMm / TAPE.radiusMm;
  const height = TAPE.z1Mm - TAPE.z0Mm;
  const layer = newLayer(Math.round(TAPE.halfArcMm * 2 * PX_PER_MM), Math.round(height * PX_PER_MM),
    new THREE.CylinderGeometry(TAPE.radiusMm * MM, TAPE.radiusMm * MM, height * MM, 24, 1, true, -arc, arc * 2));
  layer.mesh.position.set(0, ((TAPE.z0Mm + TAPE.z1Mm) / 2) * MM, 0);
  layer.mesh.name = "tape-label";
  return layer;
};

/** Write the label in pencil on the tape. */
export const drawTape = (layer: MarksLayer, label: string | undefined): void => {
  const key = label ?? "";
  if (layer.key === key) return;
  layer.key = key;
  const { context: g, canvas } = layer;
  g.clearRect(0, 0, canvas.width, canvas.height);
  if (label) {
    g.fillStyle = GRAPHITE;
    g.textAlign = "center";
    g.textBaseline = "middle";
    let size = canvas.height * 0.5;
    const font = (s: number) => `italic 600 ${s}px "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive`;
    g.font = font(size);
    while (g.measureText(label).width > canvas.width * 0.9 && size > 8) { size -= 2; g.font = font(size); }
    g.fillText(label, canvas.width / 2, canvas.height / 2);
  }
  layer.texture.needsUpdate = true;
};

/** A CSS colour (#rgb, #rrggbb, or rgb()/rgba() as the palette writes them) at an alpha. */
const withAlpha = (colour: string, alpha: number): string => {
  const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i.exec(colour);
  if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`;
  const h = colour.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = Number.parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};
