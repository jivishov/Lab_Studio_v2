import * as THREE from "three";
import type { InstrumentDisplayModel } from "../../adapters/instrumentDisplay";
import type { Equipment3DDisplay } from "../../equipment3d/types";

/**
 * An instrument's display face, drawn only from `instrumentDisplay` lines (plan §2.4; G-1). An
 * empty model draws a dark, blank face. A learner's own value is labelled "Your entry" on the
 * face itself, so a recorded number never reads as a simulated reading.
 */
const MM = 0.001;
const PX_PER_MM = 6;

const drawFace = (canvas: HTMLCanvasElement, model: InstrumentDisplayModel): void => {
  const g = canvas.getContext("2d")!;
  const { width, height } = canvas;
  g.fillStyle = "#0b1110";
  g.fillRect(0, 0, width, height);
  const lines = model.lines;
  if (lines.length === 0) return;
  const settings = lines.filter((line) => line.source !== "entry");
  const entries = lines.filter((line) => line.source === "entry");
  const pad = height * 0.12;
  g.textBaseline = "middle";
  g.fillStyle = "#b8e3d4";
  g.font = `500 ${Math.round(height * 0.2)}px "IBM Plex Mono", ui-monospace, Consolas, monospace`;
  g.textAlign = "left";
  g.fillText(settings.map((line) => line.text).join("   "), pad, height * 0.28);
  if (entries.length > 0) {
    g.font = `500 ${Math.round(height * 0.14)}px "IBM Plex Sans", system-ui, sans-serif`;
    g.fillStyle = "#e8d9b0";
    g.fillText("Your entry", pad, height * 0.62);
    g.font = `500 ${Math.round(height * 0.26)}px "IBM Plex Mono", ui-monospace, Consolas, monospace`;
    g.textAlign = "right";
    g.fillText(entries.map((line) => line.text).join("  "), width - pad, height * 0.7);
  }
};

export interface DisplayFace {
  mesh: THREE.Mesh;
  update: (model: InstrumentDisplayModel) => void;
  key: string;
}

export const buildDisplayFace = (display: Equipment3DDisplay, model: InstrumentDisplayModel): DisplayFace => {
  const [w, h] = display.sizeMm;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(64, Math.round(w * PX_PER_MM));
  canvas.height = Math.max(32, Math.round(h * PX_PER_MM));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, transparent: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w * MM, h * MM), material);
  mesh.name = `display:${display.id}`;
  // Registry (x, y, z) mm -> model-local three.js (x, z, -y) m; face outward along the normal.
  const [cx, cy, cz] = display.centreMm;
  const [nx, ny, nz] = display.normalMm;
  const normal = new THREE.Vector3(nx, nz, -ny).normalize();
  mesh.position.set(cx * MM, cz * MM, -cy * MM).addScaledVector(normal, 0.0004);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  mesh.raycast = () => undefined;
  const face: DisplayFace = {
    mesh,
    key: "",
    update: (next) => {
      const key = JSON.stringify(next.lines);
      if (key === face.key) return;
      face.key = key;
      drawFace(canvas, next);
      texture.needsUpdate = true;
    },
  };
  face.update(model);
  return face;
};
