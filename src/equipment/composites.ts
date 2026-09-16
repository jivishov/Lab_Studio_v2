import { equipmentAssetPath } from "./catalog";
import { compositeRegistry, type CompositeEntry } from "./registries";
import { getVisualStateAsset } from "./visualCatalog";

/**
 * The one composite evaluation path.
 *
 * Before Cycle 05 there were two: six hard-coded parent/child branches in
 * `src/player/EquipmentView.tsx`, and a separate assembled-instance swap in `src/runtime/reducer.ts`
 * keyed off an action parameter with funnel-specific recovery prose. Both now come through here, and
 * neither caller names an apparatus.
 *
 * `src/equipment/compositeRegistry.json` is the source. `rendererPrecedence` in that file is the
 * asset-selection order, including the two non-composite ends of the chain — a state asset wins over
 * every composite, and a plain definition asset loses to all of them.
 */

const STATE_ASSET_PRECEDENCE_TOKEN = "visualCatalog.stateAssets[instance.contents.visualState]";

/** True while the registry ranks a state asset above every composite, which it does today. */
const STATE_ASSET_FIRST =
  compositeRegistry.rendererPrecedence.indexOf(STATE_ASSET_PRECEDENCE_TOKEN) === 0;

/** A render layer, reduced to the fields composite recognition is allowed to look at. */
export interface CompositeSceneLayer {
  /** Stable key of this layer inside the render node. */
  id: string;
  definitionId: string;
  /** Present only for a real bench instance. A decorative preview layer has none. */
  instanceId?: string;
  snapZoneId?: string;
  visualState?: string;
  /**
   * True only for an apparatus that models a lid and currently has it off. Absent or false covers
   * both a sealed lid and an apparatus with no lid at all, which is why the caller passes the
   * closure flag rather than its own idea of which apparatus have lids.
   */
  lidOpen?: boolean;
}

export interface CompositeScene {
  composite?: CompositeEntry;
  /** Registry `extraOverlay` id, for the caller to resolve to an overlay component. */
  overlay?: string;
  parentLayerId?: string;
  /**
   * Every matched participant, parent included, keyed by its registry `role`. An overlay asks for
   * the slot it draws — `filter-medium` — rather than indexing a positional array, so adding a
   * participant or changing suppression cannot silently repoint it at the wrong apparatus.
   */
  layerIdByRole: ReadonlyMap<string, string>;
  assetOverrideByLayerId: ReadonlyMap<string, string>;
  suppressedLayerIds: ReadonlySet<string>;
}

const EMPTY_SCENE: CompositeScene = {
  layerIdByRole: new Map(),
  assetOverrideByLayerId: new Map(),
  suppressedLayerIds: new Set(),
};

export const compositeAssetPath = (assetId: string): string =>
  equipmentAssetPath(`assets/equipment-realistic/v1/${assetId}.svg`);

/**
 * Art for an apparatus whose lid the learner has taken off, keyed by the art it replaces.
 *
 * Closure is not a content visual state: the chamber holds the same solvent and the same strip
 * either way, and overloading `visualState` with it would put a lid into a table that decides how
 * liquids are coloured. So it resolves last, over whatever the state-asset and composite passes
 * settled on — which is what lets an open chamber with a strip in it keep its strip instead of
 * falling back to the empty open vessel.
 *
 * Keyed by asset id rather than by definition id, so the entries read as "this picture, but open".
 * A definition whose sealed art is its own id is covered by the same lookup.
 */
const OPEN_LID_ASSET_BY_SEALED_ASSET: Readonly<Record<string, string>> = {
  "chromatography-chamber": "chromatography-chamber-open",
  "chromatography-chamber-with-paper": "chromatography-chamber-with-paper-open",
};

const assetIdFromPath = (path: string): string =>
  path.slice(path.lastIndexOf("/") + 1).replace(/\.svg$/, "");

/**
 * Final asset pass: swap in open-lid art for every layer whose lid is off.
 *
 * Runs after the composite and state-asset passes so it can see their result. A layer with no
 * override yet is still drawing its definition's own asset, whose id is the definition id.
 */
const withOpenLidAssets = (
  scene: CompositeScene,
  layers: readonly CompositeSceneLayer[],
): CompositeScene => {
  const overrides = new Map(scene.assetOverrideByLayerId);
  let changed = false;
  for (const layer of layers) {
    if (layer.lidOpen !== true) continue;
    const current = overrides.get(layer.id);
    const sealedAssetId = current ? assetIdFromPath(current) : layer.definitionId;
    const openAssetId = OPEN_LID_ASSET_BY_SEALED_ASSET[sealedAssetId];
    if (!openAssetId) continue;
    overrides.set(layer.id, compositeAssetPath(openAssetId));
    changed = true;
  }
  return changed ? { ...scene, assetOverrideByLayerId: overrides } : scene;
};

const VISUAL_COMPOSITES_IN_PRECEDENCE_ORDER: readonly CompositeEntry[] =
  compositeRegistry.rendererPrecedence
    .map((token) => compositeRegistry.composites.find((composite) => composite.id === token))
    .filter(
      (composite): composite is CompositeEntry =>
        composite !== undefined && composite.kind === "visual",
    );

/** Composites in `rendererPrecedence` order. Entries not in that list are not renderer paths. */
export const visualCompositesInPrecedenceOrder = (): readonly CompositeEntry[] =>
  VISUAL_COMPOSITES_IN_PRECEDENCE_ORDER;

export const compositeParent = (composite: CompositeEntry) =>
  composite.participants.find((participant) => participant.parent);

export const compositeChildren = (composite: CompositeEntry) =>
  composite.participants.filter((participant) => !participant.parent);

/** The declared slot, for a caller that needs a participant's own registry facts (its snap zone). */
export const compositeParticipantByRole = (composite: CompositeEntry, role: string) =>
  composite.participants.find((participant) => participant.role === role);

/**
 * Applied to every participant, the parent included. The parent declares `snapZoneId: null` and so
 * skips the zone test, but it must still be a real bench instance: a decorative parent would
 * otherwise let a shelf silhouette assemble around a seated child.
 */
const layerSatisfies = (
  layer: CompositeSceneLayer,
  participant: CompositeEntry["participants"][number],
  composite: CompositeEntry,
): boolean => {
  if (layer.definitionId !== participant.definitionId) return false;
  // A layer with no instance is a decorative preview or a shelf silhouette. Recognising one would
  // let a drag preview assemble an apparatus that is not on the bench.
  if (!layer.instanceId) return false;
  if (participant.snapZoneId && layer.snapZoneId !== participant.snapZoneId) return false;
  if (
    composite.requiredContentsVisualState &&
    layer.visualState !== composite.requiredContentsVisualState
  ) {
    return false;
  }
  return true;
};

interface CompositeMatch {
  composite: CompositeEntry;
  parentLayer: CompositeSceneLayer;
  childLayers: CompositeSceneLayer[];
  /** Matched layer per registry `role`, parent included. */
  layerIdByRole: Map<string, string>;
}

const matchVisualComposite = (
  layers: readonly CompositeSceneLayer[],
): CompositeMatch | undefined => {
  for (const composite of visualCompositesInPrecedenceOrder()) {
    const parent = compositeParent(composite);
    if (!parent) continue;
    const parentLayer = layers.find((layer) => layerSatisfies(layer, parent, composite));
    if (!parentLayer) continue;
    const layerIdByRole = new Map<string, string>([[parent.role, parentLayer.id]]);
    const childLayers: CompositeSceneLayer[] = [];
    let complete = true;
    for (const participant of compositeChildren(composite)) {
      const layer = layers.find((candidate) => layerSatisfies(candidate, participant, composite));
      if (!layer) {
        complete = false;
        break;
      }
      childLayers.push(layer);
      layerIdByRole.set(participant.role, layer.id);
    }
    if (complete) return { composite, parentLayer, childLayers, layerIdByRole };
  }
  return undefined;
};

/**
 * Resolve every layer's asset override and suppression for one render node, in the precedence the
 * registry declares.
 *
 * `compositesEnabled` is false on the shelf, where a single definition is drawn with no bench
 * instances and there is nothing to assemble.
 */
export const evaluateCompositeScene = (
  layers: readonly CompositeSceneLayer[],
  options: { compositesEnabled: boolean },
): CompositeScene => withOpenLidAssets(resolveSealedScene(layers, options), layers);

const resolveSealedScene = (
  layers: readonly CompositeSceneLayer[],
  { compositesEnabled }: { compositesEnabled: boolean },
): CompositeScene => {
  const assetOverrideByLayerId = new Map<string, string>();
  const stateAssetLayerIds = new Set<string>();
  for (const layer of layers) {
    const stateAsset = getVisualStateAsset(layer.definitionId, layer.visualState);
    if (!stateAsset) continue;
    assetOverrideByLayerId.set(layer.id, stateAsset);
    stateAssetLayerIds.add(layer.id);
  }
  if (!compositesEnabled) {
    return { ...EMPTY_SCENE, assetOverrideByLayerId };
  }

  // A state asset on the render node's primary layer is already a complete picture of that
  // apparatus state. Attached layers remain real runtime participants and hit-test evidence, but
  // drawing them again would duplicate the cups, cover, probe, or other parts already present in
  // the state art. This is distinct from a registered visual composite: no recognition heuristic is
  // involved, and a state asset on a child never hides its parent.
  const primaryLayer = layers[0];
  if (primaryLayer && STATE_ASSET_FIRST && stateAssetLayerIds.has(primaryLayer.id)) {
    return {
      ...EMPTY_SCENE,
      parentLayerId: primaryLayer.id,
      assetOverrideByLayerId,
      suppressedLayerIds: new Set(layers.slice(1).map((layer) => layer.id)),
    };
  }

  const match = matchVisualComposite(layers);
  if (!match) return { ...EMPTY_SCENE, assetOverrideByLayerId };

  const { composite, parentLayer, childLayers, layerIdByRole } = match;
  // The registry invariant forbids a composite parent from owning state assets. Honouring the
  // declared precedence here means that if one is ever added, the parent keeps its state art and the
  // participants keep theirs — an incomplete assembly is never drawn.
  const stateAssetWins = STATE_ASSET_FIRST && stateAssetLayerIds.has(parentLayer.id);
  if (stateAssetWins) {
    return { ...EMPTY_SCENE, assetOverrideByLayerId };
  }
  assetOverrideByLayerId.set(parentLayer.id, compositeAssetPath(composite.resultAsset));

  const suppressedDefinitionIds = new Set(
    compositeChildren(composite)
      .filter((participant) => participant.suppressed)
      .map((participant) => participant.definitionId),
  );
  const suppressedLayerIds = new Set(
    childLayers
      .filter((layer) => suppressedDefinitionIds.has(layer.definitionId))
      .map((layer) => layer.id),
  );

  return {
    composite,
    overlay: composite.extraOverlay ?? undefined,
    parentLayerId: parentLayer.id,
    layerIdByRole,
    assetOverrideByLayerId,
    suppressedLayerIds,
  };
};

/**
 * Resolve the assembled-instance swap for a `place` that seats `childDefinitionId` into
 * `snapZoneId` on `parentDefinitionId`. The reducer calls this instead of trusting an action
 * parameter, so the assembled definition and the learner-facing invalid text both come from the
 * registry.
 */
export const instanceSwapCompositeFor = ({
  parentDefinitionId,
  childDefinitionId,
  snapZoneId,
}: {
  parentDefinitionId: string;
  childDefinitionId: string;
  snapZoneId: string;
}): CompositeEntry | undefined =>
  compositeRegistry.composites.find((composite) => {
    if (composite.kind !== "instance-swap") return false;
    const parent = compositeParent(composite);
    if (parent?.definitionId !== parentDefinitionId) return false;
    return compositeChildren(composite).some(
      (participant) =>
        participant.definitionId === childDefinitionId && participant.snapZoneId === snapZoneId,
    );
  });
