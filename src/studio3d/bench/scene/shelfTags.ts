import * as THREE from "three";
import type { SceneTrayItem } from "../../adapters/runtimeToScene";
import { SHELF } from "../../adapters/shelfSpots";

/**
 * The shelf's tags (the shelf in place of the tray, decided 2026-10-11): a paper tag on the label rail under each
 * item on a tier, as real reagent shelves carry, and a folded card on the worktop in front of each item at the side
 * station. Each names the item as the runtime does. Under a slender item (a capillary, a pencil, a strip) the tier
 * also gets a pale liner, the modest boost the policy allows, so it reads against the board at a distance. Scenery
 * only: never picked, never a runtime object (D9, G-8).
 */

const MM = 0.001;
const TAG = { heightMm: 16, minWidthMm: 44, maxWidthMm: 120, padMm: 6 };
const CARD = { widthMm: 96, heightMm: 22, tiltDeg: 62 };
/** The label rail's front face, bench mm (reagent_shelf.py: the rail stands 2 mm proud of the board). */
const RAIL_FRONT_Y = SHELF.centre.yMm - SHELF.depthMm / 2 - 2;
const RAIL_CENTRE_BELOW_TOP = SHELF.boardMm / 2;
/** A slender item: under this height or width it gets a liner. */
const SLENDER_MM = 12;
const FONT = '600 {px}px "IBM Plex Sans", Arial, sans-serif';

const toWorld = (xMm: number, yMm: number, zMm: number) => new THREE.Vector3(xMm * MM, zMm * MM, -yMm * MM);

const tagTexture = (text: string, widthMm: number, heightMm: number): THREE.CanvasTexture => {
  const canvas = document.createElement("canvas");
  const pxPerMm = 8;
  canvas.width = Math.max(64, Math.round(widthMm * pxPerMm));
  canvas.height = Math.max(32, Math.round(heightMm * pxPerMm));
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#f6f3ea";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#b9b2a2";
    ctx.lineWidth = Math.max(2, canvas.height * 0.05);
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, canvas.width - ctx.lineWidth, canvas.height - ctx.lineWidth);
    ctx.fillStyle = "#1d2a2a";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let size = canvas.height * 0.62;
    ctx.font = FONT.replace("{px}", String(size));
    const room = canvas.width * 0.9;
    const measured = ctx.measureText(text).width;
    if (measured > room) {
      size = Math.max(canvas.height * 0.34, size * (room / measured));
      ctx.font = FONT.replace("{px}", String(size));
    }
    ctx.fillText(text, canvas.width / 2, canvas.height / 2, room);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
};

const noPick = (object: THREE.Object3D) => object.traverse((child) => { (child as THREE.Mesh).raycast = () => undefined; });

export class ShelfTags {
  readonly group = new THREE.Group();
  private key = "";
  private readonly disposables: Array<{ dispose: () => void }> = [];

  constructor() {
    this.group.name = "shelf tags (scenery)";
  }

  /** Draw the tags for these shelf items; nothing changes when the items, their names and spots have not. */
  update(items: readonly SceneTrayItem[]): void {
    const key = JSON.stringify(items.map((item) => [item.instanceId, item.label, item.spot.place, item.spot.tier, item.spot.centre, item.spot.widthMm]));
    if (key === this.key) return;
    this.key = key;
    this.clear();
    for (const item of items) {
      const spot = item.spot;
      if (spot.place === "tier") {
        const width = Math.min(TAG.maxWidthMm, Math.max(TAG.minWidthMm, spot.widthMm + TAG.padMm));
        const tag = this.plane(item.label, width, TAG.heightMm);
        tag.position.copy(toWorld(spot.centre.xMm, RAIL_FRONT_Y - 0.3, spot.zMm - RAIL_CENTRE_BELOW_TOP));
        tag.name = `tag:${item.instanceId}`;
        this.group.add(tag);
        if (spot.heightMm < SLENDER_MM || Math.min(spot.widthMm, spot.depthMm) < SLENDER_MM) {
          const liner = this.liner(spot.widthMm + 16, Math.min(SHELF.depthMm - 20, spot.depthMm + 16));
          liner.position.copy(toWorld(spot.centre.xMm, spot.centre.yMm, spot.zMm + 0.3));
          liner.name = `liner:${item.instanceId}`;
          this.group.add(liner);
        }
      } else {
        // A folded card on the worktop in front of the item, leaning back toward the wall.
        const card = this.plane(item.label, CARD.widthMm, CARD.heightMm);
        card.rotation.x = -CARD.tiltDeg * (Math.PI / 180);
        const front = spot.centre.yMm - spot.depthMm / 2 - 26;
        card.position.copy(toWorld(spot.centre.xMm, front, (CARD.heightMm / 2) * Math.sin((90 - CARD.tiltDeg) * (Math.PI / 180)) + 0.5));
        card.name = `tag:${item.instanceId}`;
        this.group.add(card);
      }
    }
  }

  private plane(text: string, widthMm: number, heightMm: number): THREE.Mesh {
    const map = tagTexture(text, widthMm, heightMm);
    const material = new THREE.MeshStandardMaterial({ map, roughness: 0.85, metalness: 0 });
    const geometry = new THREE.PlaneGeometry(widthMm * MM, heightMm * MM);
    this.disposables.push(map, material, geometry);
    const mesh = new THREE.Mesh(geometry, material);
    noPick(mesh);
    return mesh;
  }

  private liner(widthMm: number, depthMm: number): THREE.Mesh {
    const material = new THREE.MeshStandardMaterial({ color: "#ece8de", roughness: 0.9, metalness: 0 });
    const geometry = new THREE.PlaneGeometry(widthMm * MM, depthMm * MM);
    geometry.rotateX(-Math.PI / 2);
    this.disposables.push(material, geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    noPick(mesh);
    return mesh;
  }

  private clear(): void {
    this.group.clear();
    this.disposables.splice(0).forEach((d) => d.dispose());
  }

  dispose(): void {
    this.clear();
    this.key = "";
  }
}
