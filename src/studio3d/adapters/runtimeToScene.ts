import type { ActionDefinition, AttachmentRelation, ContentState, EquipmentInstance, RuntimeState } from "../../domain/types";
import { equipmentById } from "../../equipment/catalog";
import { resolveLiquidStyle } from "../../equipment/liquidRendering";
import type { LiquidRenderStyle } from "../../equipment/liquidRendering";
import { resolveSolidStyle, type SolidRenderStyle } from "../../equipment/solidRendering";
import { formatContentLabel, isVisibleLiquid, isVisibleSolidContent } from "../../player/contentDisplay";
import { equipment3dEntry, equipment3dRegistry } from "../equipment3d/readiness";
import type { Equipment3DEntry, Equipment3DFill } from "../equipment3d/types";
import { BENCH_MM, runtimeBenchPointsMm, toBench, type BenchPointMm } from "./benchCoordinates";
import { instrumentDisplay, type InstrumentDisplayModel } from "./instrumentDisplay";

/**
 * Runtime state -> a scene description the bench engine draws (plan §4.4). Pure: it reads runtime
 * state and the registry and changes neither. The resting scene equals runtime state (G-3):
 *
 * | Runtime fact                         | Scene result                                             |
 * |--------------------------------------|----------------------------------------------------------|
 * | location "shelf"                     | the tray, as the 2D shelf                                 |
 * | location "storage" or "oven"         | not drawn (oven arrives with Pack 2)                     |
 * | location "workbench"                 | on the bench through benchCoordinates                    |
 * | an AttachmentRelation (or snapZone)  | seated at the parent's anchor for that zone              |
 * | ContentState                         | level from the 3D fill profile; colour from the one      |
 * |                                      | liquid palette (resolveLiquidStyle); powder when solid   |
 * | an instrument                        | display lines from instrumentDisplay only                 |
 */

export type ScenePlacement =
  | { kind: "bench"; point: BenchPointMm }
  | {
      kind: "seated";
      parentInstanceId: string;
      zoneId: string;
      anchorMm: number[];
      yawDeg: number;
      relation: AttachmentRelation["relationType"];
      renderMode: AttachmentRelation["renderMode"];
      locked: boolean;
    };

export type SceneContents =
  | { kind: "none" }
  | { kind: "liquid"; volumeMl: number; levelMm: number; overfull: boolean; style: LiquidRenderStyle }
  | { kind: "solid"; massG?: number; restMm?: number[]; radiusMm?: number; style: SolidRenderStyle }
  | { kind: "wet" };

export interface SceneItem {
  instanceId: string;
  definitionId: string;
  label: string;
  placement: ScenePlacement;
  contents: SceneContents;
  /** The same contents text the 2D player shows (contentDisplay), for hover labels. */
  contentsText: string;
  /** Undefined when the definition has no 3D model yet (the view lists it; plan §4.6 readiness). */
  model?: Equipment3DEntry;
  display?: InstrumentDisplayModel;
  /** Visual-only scenery drawn with this item, never a runtime object (decision D9). */
  scenery?: { sceneryId: string; model: Equipment3DEntry; seatIndex: number };
}

export interface SceneTrayItem {
  instanceId: string;
  definitionId: string;
  label: string;
  model?: Equipment3DEntry;
}

export interface SceneDescription {
  bench: SceneItem[];
  tray: SceneTrayItem[];
  /** Instances in storage or an oven: not drawn. */
  hidden: string[];
  /** Definition ids in use that have no 3D model. */
  missingModels: string[];
}

export interface SceneDefinition {
  actions: ActionDefinition[];
  process?: { nodes: Array<{ id: string; actionId?: string }> };
}

/** Height (mm) at which a fill profile holds `ml`; the brim when it cannot. */
export const fillLevelMm = (fill: Equipment3DFill, ml: number): { levelMm: number; overfull: boolean } => {
  if (fill.innerBoxMm) {
    const { width, depth, floorZ, topZ } = fill.innerBoxMm;
    const level = floorZ + (ml * 1000) / (width * depth);
    return { levelMm: Math.min(level, topZ), overfull: level > topZ };
  }
  const profile = fill.innerProfileMm ?? [];
  let volume = 0;
  const target = ml * 1000;
  for (let i = 0; i + 1 < profile.length; i += 1) {
    const [r0, z0] = profile[i];
    const [r1, z1] = profile[i + 1];
    const h = z1 - z0;
    if (h <= 0) continue;
    const segment = (Math.PI * h * (r0 * r0 + r0 * r1 + r1 * r1)) / 3;
    if (volume + segment >= target) {
      let lo = 0;
      let hi = h;
      for (let k = 0; k < 50; k += 1) {
        const mid = (lo + hi) / 2;
        const rm = r0 + ((r1 - r0) * mid) / h;
        const part = (Math.PI * mid * (r0 * r0 + r0 * rm + rm * rm)) / 3;
        if (volume + part < target) lo = mid;
        else hi = mid;
      }
      return { levelMm: z0 + lo, overfull: false };
    }
    volume += segment;
  }
  return { levelMm: profile.length ? profile[profile.length - 1][1] : 0, overfull: ml > 0 };
};

const volumeOf = (contents: ContentState): number | undefined =>
  typeof contents.volumeMl === "number" ? contents.volumeMl
    : typeof contents.finalVolumeMl === "number" ? contents.finalVolumeMl : undefined;

export const sceneContents = (instance: EquipmentInstance, model?: Equipment3DEntry): SceneContents => {
  const contents = instance.contents;
  const definition = equipmentById.get(instance.definitionId);
  if (isVisibleLiquid(contents)) {
    const volumeMl = volumeOf(contents);
    if (volumeMl !== undefined && volumeMl > 0 && model?.fill) {
      return { kind: "liquid", volumeMl, ...fillLevelMm(model.fill, volumeMl), style: resolveLiquidStyle(contents, definition) };
    }
  }
  if (isVisibleSolidContent(contents)) {
    return {
      kind: "solid",
      ...(typeof contents.massG === "number" ? { massG: contents.massG } : {}),
      ...(model?.solidRest ? { restMm: model.solidRest.centreMm, radiusMm: model.solidRest.radiusMm } : {}),
      style: resolveSolidStyle(contents),
    };
  }
  if (contents.kind !== "empty" && contents.wetState !== "dry") return { kind: "wet" };
  return { kind: "none" };
};

const sceneryEntry = (id: string): Equipment3DEntry | undefined =>
  equipment3dRegistry.entries.find((entry) => entry.scenery && entry.definitionId === id);

export const runtimeToScene = (state: RuntimeState, definition: SceneDefinition): SceneDescription => {
  const byId = new Map(state.equipmentInstances.map((instance) => [instance.id, instance]));
  const relationByChild = new Map(state.attachments.map((relation) => [relation.childInstanceId, relation]));
  const benchPoints = runtimeBenchPointsMm(state);
  const bench: SceneItem[] = [];
  const tray: SceneTrayItem[] = [];
  const hidden: string[] = [];
  const missing = new Set<string>();

  for (const instance of state.equipmentInstances) {
    const model = equipment3dEntry(instance.definitionId);
    if (!model) missing.add(instance.definitionId);
    if (instance.location === "shelf") {
      tray.push({ instanceId: instance.id, definitionId: instance.definitionId, label: instance.label, ...(model ? { model } : {}) });
      continue;
    }
    if (instance.location === "storage" || instance.location === "oven") {
      hidden.push(instance.id);
      continue;
    }
    const relation = relationByChild.get(instance.id);
    const parent = relation ? byId.get(relation.parentInstanceId) : undefined;
    const anchor = relation && parent ? equipment3dEntry(parent.definitionId)?.anchors[relation.zoneId] : undefined;
    const placement: ScenePlacement = relation && anchor
      ? {
          kind: "seated",
          parentInstanceId: relation.parentInstanceId,
          zoneId: relation.zoneId,
          anchorMm: anchor.positionMm,
          yawDeg: anchor.yawDeg ?? 0,
          relation: relation.relationType,
          renderMode: relation.renderMode,
          locked: Boolean(relation.locked),
        }
      : { kind: "bench", point: benchPoints.get(instance.id) ?? toBench(instance.definitionId, instance) };
    const item: SceneItem = {
      instanceId: instance.id,
      definitionId: instance.definitionId,
      label: instance.label,
      placement,
      contents: sceneContents(instance, model),
      contentsText: formatContentLabel(instance.contents),
      ...(model ? { model } : {}),
    };
    const policy = model?.displays[0]?.policy;
    if (policy) item.display = instrumentDisplay(policy, definition, state, instance);
    if (model?.requiresSupport && placement.kind === "bench") {
      const scenery = sceneryEntry(model.requiresSupport);
      if (scenery) item.scenery = { sceneryId: scenery.definitionId, model: scenery, seatIndex: 1 };
    }
    bench.push(item);
  }
  return { bench, tray, hidden, missingModels: [...missing].sort() };
};

/**
 * The bench a committed pour animates on (handoff §5.7): the committed layout, with the pour's
 * source and target still holding what they held before it. A pour often brings its source or
 * target off the tray, so the scene from before the pour may not have them on the bench at all;
 * staging on the committed layout lets the animation run from where the runtime put them. Only
 * contents are taken from `before`; once the animation ends the bench syncs to `after` (G-3).
 *
 * A source the runtime pours from where it stands on the shelf (a wash bottle) stays in the tray.
 * For the animation only, it is stood beside the target, and the sync after the animation takes it
 * away again. No runtime position is invented: the placement exists in this description alone.
 */
export const pourStagingScene = (
  before: RuntimeState,
  after: RuntimeState,
  definition: SceneDefinition,
  pour: { sourceId: string; targetId: string },
): SceneDescription => {
  const scene = runtimeToScene(after, definition);
  const prior = new Map(before.equipmentInstances.map((instance) => [instance.id, instance]));
  const bench = scene.bench.map((item) => {
    const instance = item.instanceId === pour.sourceId || item.instanceId === pour.targetId ? prior.get(item.instanceId) : undefined;
    return instance
      ? { ...item, contents: sceneContents(instance, item.model), contentsText: formatContentLabel(instance.contents) }
      : item;
  });
  const source = prior.get(pour.sourceId);
  const standing = benchStandPoint(bench, pour.targetId);
  const model = source ? equipment3dEntry(source.definitionId) : undefined;
  if (source && model && standing && !bench.some((item) => item.instanceId === pour.sourceId)) {
    const offset = standing.halfWidthMm + halfWidthMm(model) + 40;
    const leftX = standing.point.xMm - offset;
    const xMm = leftX - halfWidthMm(model) >= -BENCH_MM.width / 2 + BENCH_MM.edgeMargin ? leftX : standing.point.xMm + offset;
    bench.push({
      instanceId: source.id,
      definitionId: source.definitionId,
      label: source.label,
      placement: { kind: "bench", point: { xMm, yMm: standing.point.yMm, yawDeg: 0 } },
      contents: sceneContents(source, model),
      contentsText: formatContentLabel(source.contents),
      model,
    });
  }
  return { ...scene, bench };
};

const halfWidthMm = (entry: Equipment3DEntry | undefined): number =>
  entry?.footprintMm.shape === "rect" ? entry.footprintMm.width / 2 : entry?.footprintMm.shape === "circle" ? entry.footprintMm.radius : 40;

/** Where an item stands on the bench: its own point, or that of what it is seated in. */
const benchStandPoint = (bench: SceneItem[], instanceId: string, depth = 0): { point: BenchPointMm; halfWidthMm: number } | undefined => {
  const item = bench.find((i) => i.instanceId === instanceId);
  if (!item || depth > 6) return undefined;
  if (item.placement.kind === "bench") return { point: item.placement.point, halfWidthMm: halfWidthMm(item.model) };
  return benchStandPoint(bench, item.placement.parentInstanceId, depth + 1);
};
