import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { tuneMaterials } from "../bench/look/materials";
import type { BenchTextures } from "../bench/look/textures";
import { equipment3dAssetUrl } from "./readiness";
import type { Equipment3DEntry } from "./types";

/**
 * Loads equipment GLBs once per definition and hands out clones (plan §4.2). Models are
 * meshopt-compressed and decoded by three.js's bundled MeshoptDecoder, offline and without
 * workers (plan §6.3). Materials are tuned once per source material, by viewer role.
 */
export class ModelLibrary {
  private readonly loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  private readonly sources = new Map<string, Promise<THREE.Object3D>>();
  private readonly materialCache = new Map<THREE.Material, THREE.Material>();
  private readonly bytes = new Map<string, { loaded: number; total: number; done: boolean }>();
  /** Bytes of GLB downloaded so far across every model requested, for the loader (handoff §5.2). */
  onProgress?: (loaded: number, total: number, pending: number) => void;

  constructor(private readonly textures: BenchTextures) {}

  private report(definitionId: string, loaded: number, total: number, done = false): void {
    this.bytes.set(definitionId, { loaded, total: Math.max(total, loaded), done });
    let sumLoaded = 0;
    let sumTotal = 0;
    let pending = 0;
    this.bytes.forEach((entry) => {
      sumLoaded += entry.loaded;
      sumTotal += entry.total;
      if (!entry.done) pending += 1;
    });
    this.onProgress?.(sumLoaded, sumTotal, pending);
  }

  private source(entry: Equipment3DEntry): Promise<THREE.Object3D> {
    let pending = this.sources.get(entry.definitionId);
    if (!pending) {
      // The source hash versions the URL, so a regenerated model is never served from a stale cache.
      const url = `${equipment3dAssetUrl(entry.model)}?v=${entry.provenance.sourceHash.slice(0, 12)}`;
      this.report(entry.definitionId, 0, 0);
      pending = this.loader.loadAsync(url, (event) => this.report(entry.definitionId, event.loaded, event.lengthComputable ? event.total : event.loaded))
        .then((gltf) => {
          const root = gltf.scene;
          tuneMaterials(root, this.textures, this.materialCache);
          const seen = this.bytes.get(entry.definitionId);
          this.report(entry.definitionId, seen?.total ?? 0, seen?.total ?? 0, true);
          return root;
        }, (failure: unknown) => {
          this.report(entry.definitionId, 0, 0, true);
          throw failure;
        });
      this.sources.set(entry.definitionId, pending);
    }
    return pending;
  }

  /** A clone sharing geometry and tuned materials with the loaded source. */
  async instance(entry: Equipment3DEntry): Promise<THREE.Object3D> {
    const root = (await this.source(entry)).clone(true);
    root.name = `model:${entry.definitionId}`;
    return root;
  }

  dispose(): void {
    const geometries = new Set<THREE.BufferGeometry>();
    void Promise.all([...this.sources.values()]).then((roots) => {
      roots.forEach((root) => root.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.isMesh) geometries.add(mesh.geometry);
      }));
      geometries.forEach((g) => g.dispose());
    });
    this.materialCache.forEach((m) => m.dispose());
    this.materialCache.clear();
    this.sources.clear();
  }
}
