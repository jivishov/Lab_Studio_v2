import { isVisibleWorkbenchLocation } from "../../domain/equipmentLocations";
import type { ActionDefinition, AttachmentRelation, ContentState, EquipmentInstance, RuntimeState } from "../../domain/types";
import { equipmentById } from "../../equipment/catalog";
import { resolveLiquidStyle } from "../../equipment/liquidRendering";
import type { LiquidRenderStyle } from "../../equipment/liquidRendering";
import { resolveSolidStyle, type SolidRenderStyle } from "../../equipment/solidRendering";
import { formatContentLabel, isVisibleLiquid, isVisibleSolidContent } from "../../player/contentDisplay";
import { getInitialEquipment, type RuntimeDefinition } from "../../runtime/createRuntime";
import { equipment3dEntry, equipment3dRegistry } from "../equipment3d/readiness";
import type { Equipment3DEntry, Equipment3DFill } from "../equipment3d/types";
import { runtimeBenchPointsMm, toBench, type BenchPointMm } from "./benchCoordinates";
import { heldRelations } from "./heldRelations";
import { instrumentDisplay, type InstrumentDisplayModel } from "./instrumentDisplay";
import { shelfSpots, stableShelfOrder, type ShelfSpot } from "./shelfSpots";
import { stableRestPoint } from "./stableBench";

/**
 * Runtime state -> a scene description the bench engine draws (plan §4.4). Pure: it reads runtime
 * state and the registry and changes neither. The resting scene equals runtime state (G-3):
 *
 * | Runtime fact                         | Scene result                                             |
 * |--------------------------------------|----------------------------------------------------------|
 * | location "shelf"                     | on its spot on the reagent shelf or the side station      |
 * |                                      | (shelfSpots.ts), drawn as on the bench but not on it      |
 * | location "storage" or "oven"         | not drawn (oven arrives with Pack 2)                     |
 * | location "workbench"                 | on the bench through benchCoordinates                    |
 * | an AttachmentRelation (or snapZone)  | seated at the parent's anchor for that zone              |
 * | ContentState                         | level from the 3D fill profile; colour from the one      |
 * |                                      | liquid palette (resolveLiquidStyle); powder when solid   |
 * | an instrument                        | display lines from instrumentDisplay only                 |
 * | an item that `restsOn` scenery       | the scenery drawn under it, or where it lay (D9)          |
 */

export type ScenePlacement =
  | { kind: "bench"; point: BenchPointMm }
  | {
      kind: "seated";
      parentInstanceId: string;
      zoneId: string;
      anchorMm: number[];
      yawDeg: number;
      /** The anchor's lean (Equipment3DAnchor.leanDeg), when it has one. */
      leanDeg?: number;
      relation: AttachmentRelation["relationType"];
      renderMode: AttachmentRelation["renderMode"];
      locked: boolean;
    };

/**
 * A solid lying under a liquid: a registered state with visible particles (an undissolved solid,
 * decided 2026-10-04) shows its solid at the model's solid rest, in the one solid palette (G-9).
 */
export interface SceneSediment {
  style: SolidRenderStyle;
  restMm?: number[];
  radiusMm?: number;
}

export type SceneContents =
  | { kind: "none" }
  | { kind: "liquid"; volumeMl: number; levelMm: number; overfull: boolean; style: LiquidRenderStyle; sediment?: SceneSediment }
  | { kind: "solid"; massG?: number; restMm?: number[]; radiusMm?: number; style: SolidRenderStyle }
  | { kind: "wet" };

/**
 * What is drawn on a chromatography strip's face (`stripFace`, Pack 3a), from the runtime's chromatogram:
 * the pencil baseline, the spot (larger with each touch), and once developed the bands and the solvent
 * front, a pencil line once it is marked. Distances are from the strip's lower edge (origin) or the baseline.
 */
export interface SceneStrip {
  /** The baseline's height above the lower edge, in mm, once drawn. */
  baselineMm?: number;
  /** Touches of the capillary on the baseline (the spot grows with each). */
  spots: number;
  /** The spot's colour: the spotted liquid's, from the one palette (resolveLiquidStyle, G-9). */
  spotColor?: string;
  /** The front's distance from the baseline once developed, in mm. */
  frontMm?: number;
  frontMarked: boolean;
  /** Band centres from the baseline, in mm, once developed. */
  bands: Array<{ color: string; distanceMm: number }>;
}

export interface SceneItem {
  instanceId: string;
  definitionId: string;
  label: string;
  placement: ScenePlacement;
  /** The form drawn, for a model with forms (Equipment3DEntry.forms). */
  form?: string;
  /** Drawn wet (Equipment3DEntry.wetLook). */
  wet?: boolean;
  /** Apparatus state the runtime records for it (an oven's door, a burner's flame), for drawing. */
  apparatus?: Record<string, string | number | boolean>;
  /** A chromatography strip's marks (Pack 3a). */
  strip?: SceneStrip;
  /** What is written on the item's label tape (a developing chamber's solvent, Pack 3a). */
  tapeLabel?: string;
  contents: SceneContents;
  /** The same contents text the 2D player shows (contentDisplay), for hover labels. */
  contentsText: string;
  /** Undefined when the definition has no 3D model yet (the view lists it; plan §4.6 readiness). */
  model?: Equipment3DEntry;
  display?: InstrumentDisplayModel;
  /** Visual-only scenery drawn with this item, never a runtime object (decision D9). */
  scenery?: { sceneryId: string; model: Equipment3DEntry; seatIndex: number };
  /**
   * Visual-only scenery lying flat on the bench at `point` (`restsOn`; a strip's white tile, decided 2026-10-11):
   * under the item while it lies on the bench, and left where it lay while the item is held elsewhere on the bench.
   */
  benchScenery?: { sceneryId: string; model: Equipment3DEntry; point: BenchPointMm };
  /** The height of the scenery top this item lies on, mm (a strip or the ruler beside it on the tile). */
  restOnMm?: number;
}

/**
 * An item on the runtime's `shelf`, drawn on its spot (the shelf in place of the tray, decided 2026-10-11). Its
 * placement is the spot's point, standing on the tier or the side station at `spot.zMm`; it is never on the bench.
 */
export interface SceneTrayItem extends SceneItem {
  placement: { kind: "bench"; point: BenchPointMm };
  spot: ShelfSpot;
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

const startShelfCache = new WeakMap<object, string[]>();
/**
 * The ids that start on the shelf, in the run's start order (the runtime's start state, `getInitialEquipment`), so
 * each keeps its shelf spot for the whole run. Undefined for a bare scene definition: the shelf is then laid out
 * from what is on it now.
 */
export const startShelfOf = (definition: SceneDefinition): string[] | undefined => {
  if (!("initialState" in definition) && !("techniques" in definition)) return undefined;
  let ids = startShelfCache.get(definition);
  if (!ids) {
    try {
      ids = getInitialEquipment(definition as unknown as RuntimeDefinition).filter((i) => i.location === "shelf").map((i) => i.id);
    } catch {
      return undefined;
    }
    startShelfCache.set(definition, ids);
  }
  return ids;
};

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

/** The form an item with forms is drawn in: its seat's, else the runtime's, else the default. */
export const sceneForm = (model: Equipment3DEntry | undefined, zoneId: string | undefined, recorded: unknown): string | undefined => {
  if (!model?.forms) return undefined;
  const bySeat = zoneId ? model.formBySeat?.[zoneId] : undefined;
  const form = bySeat ?? (typeof recorded === "string" ? recorded : undefined) ?? model.defaultForm;
  return form && model.forms[form] ? form : Object.keys(model.forms)[0];
};

export const sceneContents = (instance: EquipmentInstance, model?: Equipment3DEntry, form?: string): SceneContents => {
  const contents = instance.contents;
  const rest = (form ? model?.formSolidRest?.[form] : undefined) ?? model?.solidRest;
  const definition = equipmentById.get(instance.definitionId);
  if (isVisibleLiquid(contents)) {
    const volumeMl = volumeOf(contents);
    if (volumeMl !== undefined && volumeMl > 0 && model?.fill) {
      const style = resolveLiquidStyle(contents, definition);
      const sediment: SceneSediment | undefined = style.particles && model.solidRest
        ? { style: resolveSolidStyle(contents), restMm: model.solidRest.centreMm, radiusMm: model.solidRest.radiusMm * 0.8 }
        : undefined;
      return { kind: "liquid", volumeMl, ...fillLevelMm(model.fill, volumeMl), style, ...(sediment ? { sediment } : {}) };
    }
  }
  if (isVisibleSolidContent(contents)) {
    return {
      kind: "solid",
      ...(typeof contents.massG === "number" ? { massG: contents.massG } : {}),
      ...(rest ? { restMm: rest.centreMm, radiusMm: rest.radiusMm } : {}),
      style: resolveSolidStyle(contents),
    };
  }
  if (contents.kind !== "empty" && contents.wetState !== "dry") return { kind: "wet" };
  return { kind: "none" };
};

/**
 * The colour of what was spotted (G-9: one liquid palette): the spotter's liquid, or, once the spotter is empty, the
 * liquid it was last filled from.
 */
const spotColour = (state: RuntimeState, definition: SceneDefinition, spotterId: unknown): string | undefined => {
  const fillOf = (id: unknown): string | undefined => {
    const instance = typeof id === "string" ? state.equipmentInstances.find((candidate) => candidate.id === id) : undefined;
    return instance && isVisibleLiquid(instance.contents)
      ? resolveLiquidStyle(instance.contents, equipmentById.get(instance.definitionId)).fill : undefined;
  };
  if (typeof spotterId !== "string") return undefined;
  const own = fillOf(spotterId);
  if (own) return own;
  for (const attempt of [...state.attemptHistory].reverse()) {
    const parameters = attempt.success ? definition.actions.find((action) => action.id === attempt.actionId)?.parameters : undefined;
    if (parameters?.targetInstanceId !== spotterId) continue;
    const source = fillOf(parameters.sourceInstanceId);
    if (source) return source;
  }
  return undefined;
};

/** The strip's marks from its chromatogram and the spotting touches the runtime accepted (Pack 3a). */
const sceneStrip = (instance: EquipmentInstance, state: RuntimeState, definition: SceneDefinition): SceneStrip | undefined => {
  const chromatogram = instance.contents.chromatogram;
  if (!chromatogram) return undefined;
  const touches = state.attemptHistory
    .filter((attempt) => attempt.success && attempt.verb === "spotSample")
    .map((attempt) => definition.actions.find((action) => action.id === attempt.actionId))
    .filter((action) => action?.parameters.targetInstanceId === instance.id);
  const spotColor = chromatogram.spotted ? spotColour(state, definition, touches[0]?.parameters.sourceInstanceId) : undefined;
  const developed = chromatogram.solventFrontMm !== undefined;
  return {
    ...(chromatogram.baselineMarked && chromatogram.originDistanceMm !== undefined ? { baselineMm: chromatogram.originDistanceMm } : {}),
    spots: chromatogram.spotted ? Math.max(1, touches.length) : 0,
    ...(spotColor ? { spotColor } : {}),
    ...(developed ? { frontMm: chromatogram.solventFrontMm } : {}),
    frontMarked: Boolean(chromatogram.solventFrontMarked),
    bands: developed ? chromatogram.bands.map((band) => ({ color: band.color, distanceMm: band.distanceMm })) : [],
  };
};

/** The last label the runtime accepted for the item's tape (a step naming `tapeLabel`, Pack 3a). */
const tapeLabelFor = (instance: EquipmentInstance, state: RuntimeState, definition: SceneDefinition): string | undefined => {
  for (const attempt of [...state.attemptHistory].reverse()) {
    if (!attempt.success) continue;
    const parameters = definition.actions.find((action) => action.id === attempt.actionId)?.parameters;
    if (parameters?.targetInstanceId === instance.id && typeof parameters.tapeLabel === "string") return parameters.tapeLabel;
  }
  return undefined;
};

/**
 * A developing chamber's lid and strip (Pack 3a): the lid from the runtime's closure, the strip hung while one is
 * seated in the chamber's paper slot. With no lid modelled (`developingChamberClosed` absent), nothing.
 */
const chamberApparatus = (instance: EquipmentInstance, state: RuntimeState): Record<string, string> | undefined => {
  const closed = instance.contents.developingChamberClosed;
  if (closed === undefined) return undefined;
  const hung = heldRelations(state).some((relation) => relation.parentInstanceId === instance.id && relation.zoneId === "chromatography-chamber-paper-slot");
  return { lid: closed ? "closed" : "open", strip: hung ? "hung" : "" };
};

/**
 * A ruler laid along a strip (a place step naming `alignWithInstanceId`, Pack 3a): beside the flat strip's right
 * edge, its scale edge against the paper and its zero level with the pencil baseline, as a student lays it to read
 * distances from the baseline. Only while that step is the ruler's last move and the strip lies flat on the bench;
 * where the runtime put it otherwise. Presentation only: the reading is the student's (G-3).
 */
const alignedPoint = (
  instance: EquipmentInstance, state: RuntimeState, definition: SceneDefinition, points: Map<string, BenchPointMm>,
): (BenchPointMm & { restOnMm?: number }) | undefined => {
  const scale = equipment3dEntry(instance.definitionId)?.scaleMm;
  if (!scale) return undefined;
  let alignWith: unknown;
  for (const attempt of [...state.attemptHistory].reverse()) {
    if (!attempt.success) continue;
    const parameters = definition.actions.find((action) => action.id === attempt.actionId)?.parameters;
    if (parameters?.equipmentInstanceId !== instance.id) continue;
    alignWith = parameters.alignWithInstanceId;
    break;
  }
  const strip = typeof alignWith === "string" ? state.equipmentInstances.find((candidate) => candidate.id === alignWith) : undefined;
  const stripModel = strip ? equipment3dEntry(strip.definitionId) : undefined;
  const at = strip ? points.get(strip.id) : undefined;
  if (!strip || strip.location !== "workbench" || !stripModel?.stripFace || !stripModel.benchRest || !at) return undefined;
  // The flat strip's lower edge lies `shiftMm` from its point, its length running bench +y (benchRest -90 deg roll).
  const baselineMm = strip.contents.chromatogram?.originDistanceMm ?? 0;
  const halfWidth = stripModel.stripFace.widthMm / 2;
  const dx = halfWidth + 0.6 - scale.zeroMm[0];
  const dy = stripModel.benchRest.shiftMm[1] + baselineMm - scale.zeroMm[1];
  const yaw = at.yawDeg * (Math.PI / 180);
  // On the strip's tile, the ruler lies on the tile too.
  const tileTop = stripModel.restsOn ? sceneryEntry(stripModel.restsOn)?.sceneryFor?.seatsMm[0]?.[2] : undefined;
  return {
    xMm: at.xMm + dx * Math.cos(yaw) - dy * Math.sin(yaw),
    yMm: at.yMm + dx * Math.sin(yaw) + dy * Math.cos(yaw),
    yawDeg: at.yawDeg,
    ...(tileTop ? { restOnMm: tileTop } : {}),
  };
};

const sceneryEntry = (id: string): Equipment3DEntry | undefined =>
  equipment3dRegistry.entries.find((entry) => entry.scenery && entry.definitionId === id);

/**
 * The scenery an item lies on (`restsOn`; a chromatography strip's white tile, decided 2026-10-11) and where it
 * lies: under the item on the bench, and while the item is held elsewhere on the bench (a strip hanging in its
 * chamber) where it lay, which is the item's own position, else its slot (stableBench.ts). None while the item is
 * in the tray, in storage or in an instrument. Scenery only: never a runtime object (D9, G-8).
 */
export const sceneryUnder = (
  state: RuntimeState, instance: EquipmentInstance, points: Map<string, BenchPointMm>,
): { model: Equipment3DEntry; point: BenchPointMm } | undefined => {
  const restsOn = equipment3dEntry(instance.definitionId)?.restsOn;
  const model = restsOn ? sceneryEntry(restsOn) : undefined;
  if (!model || !isVisibleWorkbenchLocation(instance.location)) return undefined;
  const lay = points.get(instance.id) ?? stableRestPoint(state, instance.id);
  const point = lay && "xMm" in lay ? lay : lay ? toBench(instance.definitionId, lay) : undefined;
  return point ? { model, point } : undefined;
};

export const runtimeToScene = (state: RuntimeState, definition: SceneDefinition): SceneDescription => {
  const byId = new Map(state.equipmentInstances.map((instance) => [instance.id, instance]));
  const relationByChild = new Map(heldRelations(state).map((relation) => [relation.childInstanceId, relation]));
  const benchPoints = runtimeBenchPointsMm(state);
  const bench: SceneItem[] = [];
  const tray: SceneTrayItem[] = [];
  const hidden: string[] = [];
  const missing = new Set<string>();
  const spots = shelfSpots(stableShelfOrder(state.equipmentInstances, startShelfOf(definition)));

  for (const instance of state.equipmentInstances) {
    const model = equipment3dEntry(instance.definitionId);
    if (!model) missing.add(instance.definitionId);
    const spot = instance.location === "shelf" ? spots.get(instance.id) : undefined;
    if (spot) {
      tray.push(shelfItem(instance, model, spot));
      continue;
    }
    // Inside an instrument (Pack 2: a watch glass on the drying oven's shelf): drawn at the instrument's
    // anchor for that zone, as a seated item is; with no such instrument on the bench, not drawn.
    const oven = instance.location === "oven" && instance.snapZoneId
      ? state.equipmentInstances.find((candidate) => candidate.location === "workbench"
        && equipment3dEntry(candidate.definitionId)?.anchors[instance.snapZoneId!] !== undefined)
      : undefined;
    if (instance.location === "storage" || (instance.location === "oven" && !oven)) {
      hidden.push(instance.id);
      continue;
    }
    const relation = oven
      ? { parentInstanceId: oven.id, zoneId: instance.snapZoneId!, relationType: "placedOn" as const, renderMode: "independent" as const, locked: false }
      : relationByChild.get(instance.id);
    const parent = relation ? byId.get(relation.parentInstanceId) : undefined;
    const anchor = relation && parent ? equipment3dEntry(parent.definitionId)?.anchors[relation.zoneId] : undefined;
    // A strip on the hook of a lid held up (`liftedWithLidMm`): raised with the lid, its edge out of the solvent.
    const parentModel = parent ? equipment3dEntry(parent.definitionId) : undefined;
    const lifted = parent && parentModel?.liftedWithLidMm && parent.contents.developingChamberClosed === false ? parentModel.liftedWithLidMm : 0;
    const aligned = relation && anchor ? undefined : alignedPoint(instance, state, definition, benchPoints);
    const placement: ScenePlacement = relation && anchor
      ? {
          kind: "seated",
          parentInstanceId: relation.parentInstanceId,
          zoneId: relation.zoneId,
          anchorMm: lifted ? [anchor.positionMm[0], anchor.positionMm[1], anchor.positionMm[2] + lifted] : anchor.positionMm,
          yawDeg: anchor.yawDeg ?? 0,
          ...(anchor.leanDeg ? { leanDeg: anchor.leanDeg } : {}),
          relation: relation.relationType,
          renderMode: relation.renderMode,
          locked: Boolean(relation.locked),
        }
      : { kind: "bench", point: aligned ? { xMm: aligned.xMm, yMm: aligned.yMm, yawDeg: aligned.yawDeg } : benchPoints.get(instance.id) ?? toBench(instance.definitionId, instance) };
    const chamber = chamberApparatus(instance, state);
    const apparatus = chamber ? { ...state.apparatusStates?.[instance.id], ...chamber } : state.apparatusStates?.[instance.id];
    const strip = model?.stripFace ? sceneStrip(instance, state, definition) : undefined;
    const tapeLabel = chamber ? tapeLabelFor(instance, state, definition) : undefined;
    const form = sceneForm(model, placement.kind === "seated" ? placement.zoneId : undefined, apparatus?.form);
    const item: SceneItem = {
      instanceId: instance.id,
      definitionId: instance.definitionId,
      label: instance.label,
      placement,
      ...(form ? { form } : {}),
      ...(model?.wetLook && instance.contents.wetState !== "dry" ? { wet: true } : {}),
      ...(apparatus ? { apparatus } : {}),
      ...(strip ? { strip } : {}),
      ...(tapeLabel ? { tapeLabel } : {}),
      contents: sceneContents(instance, model, form),
      contentsText: formatContentLabel(instance.contents),
      ...(model ? { model } : {}),
    };
    const policy = model?.displays[0]?.policy;
    if (policy) item.display = instrumentDisplay(policy, definition, state, instance);
    if (model?.requiresSupport && placement.kind === "bench") {
      const scenery = sceneryEntry(model.requiresSupport);
      if (scenery) item.scenery = { sceneryId: scenery.definitionId, model: scenery, seatIndex: 1 };
    }
    const under = sceneryUnder(state, instance, benchPoints);
    if (under) {
      // Lying on the bench, the item lies on it; elsewhere, the scenery stays where the item lay.
      const point = placement.kind === "bench" ? placement.point : under.point;
      item.benchScenery = { sceneryId: under.model.definitionId, model: under.model, point };
      if (placement.kind === "bench") item.restOnMm = under.model.sceneryFor?.seatsMm[0]?.[2] ?? 0;
    }
    if (aligned?.restOnMm) item.restOnMm = aligned.restOnMm;
    bench.push(item);
  }
  return { bench, tray, hidden, missingModels: [...missing].sort() };
};

/** An item on its shelf spot: as it would stand on the bench (in its rack, if it needs one), its contents shown. */
const shelfItem = (instance: EquipmentInstance, model: Equipment3DEntry | undefined, spot: ShelfSpot): SceneTrayItem => {
  const form = sceneForm(model, undefined, undefined);
  const item: SceneTrayItem = {
    instanceId: instance.id,
    definitionId: instance.definitionId,
    label: instance.label,
    placement: { kind: "bench", point: spot.point },
    spot,
    ...(form ? { form } : {}),
    ...(model?.wetLook && instance.contents.wetState !== "dry" ? { wet: true } : {}),
    contents: sceneContents(instance, model, form),
    contentsText: formatContentLabel(instance.contents),
    ...(model ? { model } : {}),
  };
  const support = model?.requiresSupport ? sceneryEntry(model.requiresSupport) : undefined;
  if (support) item.scenery = { sceneryId: support.definitionId, model: support, seatIndex: 1 };
  return item;
};

/**
 * The bench a committed pour animates on (handoff §5.7): the committed layout, with the pour's
 * source and target still holding what they held before it. A pour often brings its source or
 * target off the shelf, so the scene from before the pour may not have them on the bench at all;
 * staging on the committed layout lets the animation run from where the runtime put them. Only
 * contents are taken from `before`; once the animation ends the bench syncs to `after` (G-3).
 *
 * A source the runtime pours from where it stands on the shelf (a wash bottle) stays on its shelf
 * spot: the animation lifts it from there to the target and sets it back on the spot (the shelf in
 * place of the tray, decided 2026-10-11). No runtime position is invented.
 */
export const pourStagingScene = (
  before: RuntimeState,
  after: RuntimeState,
  definition: SceneDefinition,
  pour: { sourceId: string; targetId: string },
): SceneDescription => {
  const scene = runtimeToScene(after, definition);
  const prior = new Map(before.equipmentInstances.map((instance) => [instance.id, instance]));
  const withBefore = <T extends SceneItem>(item: T): T => {
    const instance = item.instanceId === pour.sourceId || item.instanceId === pour.targetId ? prior.get(item.instanceId) : undefined;
    return instance
      ? { ...item, contents: sceneContents(instance, item.model, item.form), contentsText: formatContentLabel(instance.contents) }
      : item;
  };
  return { ...scene, bench: scene.bench.map(withBefore), tray: scene.tray.map(withBefore) };
};
