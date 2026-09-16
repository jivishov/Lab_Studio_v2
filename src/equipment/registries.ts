import rawAssetDispositionRegistry from "./assetDispositionRegistry.json";
import rawCompositeRegistry from "./compositeRegistry.json";
import rawImageAliasRegistry from "./imageAliasRegistry.json";
import rawVisualStateRegistry from "./visualStateRegistry.json";

/**
 * Typed readers for the visual, composite, asset, and alias contracts.
 *
 * Cycle 02 defined the schemas and recorded the behaviour that existed then. Cycle 05 made the
 * runtime read them: `liquidRendering/styles.ts` and `solidRendering.ts` resolve appearance from the
 * visual-state registry, and `equipment/composites.ts` is the one composite evaluation path for both
 * the renderer and the reducer. `scripts/checkContentConsistency.mjs` holds every entry against the
 * source it describes.
 */

import type { LiquidRenderStyle } from "./liquidRendering/types";

export type VisualStateDisposition =
  | "liquid-style"
  | "solid-style"
  | "state-asset"
  | "nonvisual"
  | "unresolved";

/**
 * `ordinal` allows a perceptually ordered series such as the Blue #1 dilutions or the precipitate
 * dryness stages. `absolute` is not a legal value: appearance alone must never stand in for a
 * measured quantity.
 */
export type VisualStateQuantitativeClaim = "none" | "ordinal";

/** What kind of evidence stands behind the appearance. See the registry's `evidenceKinds` block. */
export type VisualStateEvidenceKind =
  | "source-observed"
  | "measurement-derived"
  | "simulator-configured"
  | "qualitative"
  | "presentation-only";

/** How a state can be reached. An entry no selector reaches is debt with an owning cycle. */
export type VisualStateSelector =
  | "authored"
  | "definition-id"
  | "reagent-heuristic"
  | "runtime-assigned";

export interface SolidRenderStyle {
  fill: string;
  stroke: string;
  highlight: string;
}

export interface VisualStateEntry {
  id: string;
  disposition: VisualStateDisposition;
  evidenceKind: VisualStateEvidenceKind;
  quantitativeClaim: VisualStateQuantitativeClaim;
  authoredToday: boolean;
  selectors: VisualStateSelector[];
  provenance: string;
  owners: string[];
  renderStyleKey?: string;
  renderStyle?: LiquidRenderStyle;
  solidStyle?: SolidRenderStyle;
  stateAssetEquipmentIds?: string[];
  /** Declared when two distinct states render identically, so it cannot read as an accident. */
  sharesAppearanceWith?: string[];
  ownerCycle?: string;
}

export interface CompositeBehaviorMechanism {
  mechanism: string;
  evidence: string;
  compositeAware: boolean;
}

/**
 * `visual` leaves runtime state alone and only changes what is drawn. `instance-swap` is the only
 * kind that mutates state: the participants leave the bench and an assembled instance replaces them.
 */
export type CompositeKind = "visual" | "instance-swap";

/** Shared with `src/domain/equipmentRoleRegistry.json`'s `kind` vocabulary. */
export type CompositeParticipantRoleKind =
  | "instrument"
  | "vessel"
  | "delivery"
  | "consumable"
  | "tool"
  | "support";

export interface CompositeParticipant {
  /** Slot name inside this composite, e.g. `filter-medium`. */
  role: string;
  roleKind: CompositeParticipantRoleKind;
  /** Role in `src/domain/equipmentRoleRegistry.json`, or `null` when no existing role fits. */
  equipmentRoleId: string | null;
  definitionId: string;
  /** The zone this participant must occupy. `null` only on the parent, which occupies none. */
  snapZoneId: string | null;
  /**
   * Role of the participant that owns this participant's snap zone. Omit for a direct child of the
   * composite root; name another participant role for a nested attachment.
   */
  attachmentParentRole?: string | null;
  parent: boolean;
  suppressed: boolean;
}

export interface CompositeInvalidFeedback {
  message: string;
  recovery: string;
}

export interface CompositeEntry {
  id: string;
  kind: CompositeKind;
  parentDefinitionId: string;
  participants: CompositeParticipant[];
  /** A contents state the assembly requires. `null` when appearance alone decides. */
  requiredContentsVisualState: string | null;
  resultAsset: string;
  /** Set only on `instance-swap`: the definition the assembled instance uses. */
  resultInstanceDefinitionId: string | null;
  extraOverlay: string | null;
  /** Required on `instance-swap`, `null` on `visual`, whose recognition has no invalid path. */
  invalidFeedback: CompositeInvalidFeedback | null;
  detach: CompositeBehaviorMechanism;
  recovery: CompositeBehaviorMechanism;
  reset: CompositeBehaviorMechanism;
  deviations: string[];
  ownerCycle: string;
  note?: string;
}

export type AssetDisposition =
  | "player-active"
  | "accessory-active"
  | "state-active"
  | "composite-active"
  | "custom-route-active"
  | "gallery-only"
  | "intentionally-unused"
  | "remediation-candidate";

export interface AssetDispositionEntry {
  id: string;
  file: string;
  disposition: AssetDisposition;
  reachabilityTags: string[];
  rationale: string;
  ownerCycle?: string;
  matchingVisualState?: string;
  note?: string;
}

export interface ImageAliasEntry {
  asset: string;
  equipmentIds: string[];
  rationale: string;
  labelsMustStayDistinct: boolean;
}

interface RegistryEnvelope {
  schema: string;
  cycle: string;
  consumedBy: string[];
  policy: string;
}

/**
 * The container and reagent-label heuristics, as data. They are consulted only where no explicit
 * state exists, which is what makes an authored state authoritative.
 */
export interface VisualStateFallbacks {
  policy: string;
  definitionIdStates: Array<{ definitionId: string; state: string }>;
  reagentKeywordStates: Array<{ keywords: string[]; state: string }>;
  reagentKeywordSource: string;
  defaultLiquidState: string;
  defaultSolidState: string;
}

export interface VisualStateRegistry extends RegistryEnvelope {
  dispositions: Record<VisualStateDisposition, string>;
  evidenceKinds: Record<VisualStateEvidenceKind, string>;
  selectors: Record<VisualStateSelector, string>;
  fallbacks: VisualStateFallbacks;
  counts: { total: number; byDisposition: Record<string, number> };
  states: VisualStateEntry[];
}

export interface CompositeRegistry extends RegistryEnvelope {
  invariants: string[];
  kinds: Record<CompositeKind, string>;
  participantRoleKinds: CompositeParticipantRoleKind[];
  rendererPrecedence: string[];
  composites: CompositeEntry[];
}

/** A directory or non-image file living beside the assets, documented so it cannot hide one. */
export interface NonAssetEntry {
  name: string;
  kind: string;
  rationale: string;
}

export interface AssetDispositionRegistry extends RegistryEnvelope {
  directory: string;
  dispositions: Record<AssetDisposition, string>;
  nonAssetEntries: NonAssetEntry[];
  counts: { total: number; byDisposition: Record<string, number> };
  assets: AssetDispositionEntry[];
}

export interface ImageAliasRegistry extends RegistryEnvelope {
  aliases: ImageAliasEntry[];
}

export const visualStateRegistry = rawVisualStateRegistry as unknown as VisualStateRegistry;
export const compositeRegistry = rawCompositeRegistry as unknown as CompositeRegistry;
export const assetDispositionRegistry =
  rawAssetDispositionRegistry as unknown as AssetDispositionRegistry;
export const imageAliasRegistry = rawImageAliasRegistry as unknown as ImageAliasRegistry;

export const visualStateById: ReadonlyMap<string, VisualStateEntry> = new Map(
  visualStateRegistry.states.map((state) => [state.id, state]),
);

export const compositeById: ReadonlyMap<string, CompositeEntry> = new Map(
  compositeRegistry.composites.map((composite) => [composite.id, composite]),
);

export const assetDispositionById: ReadonlyMap<string, AssetDispositionEntry> = new Map(
  assetDispositionRegistry.assets.map((asset) => [asset.id, asset]),
);

/** Equipment definition ids that legitimately share a realistic asset, keyed by definition id. */
export const aliasedEquipmentIds: ReadonlyMap<string, ImageAliasEntry> = new Map(
  imageAliasRegistry.aliases.flatMap((alias) =>
    alias.equipmentIds.map((id) => [id, alias] as const),
  ),
);

/**
 * An authored state is authoritative when the registry can render it. An `unresolved` state renders
 * the registry default and is reported by lint; it is never quietly replaced by a label heuristic.
 */
export const visualStateResolves = (stateId: string): boolean => {
  const entry = visualStateById.get(stateId);
  if (!entry) return false;
  return (
    entry.disposition === "liquid-style" ||
    entry.disposition === "solid-style" ||
    entry.disposition === "state-asset"
  );
};

/** Composites whose parent equipment matches, in renderer precedence order. */
export const compositesForParent = (parentDefinitionId: string): readonly CompositeEntry[] =>
  compositeRegistry.rendererPrecedence
    .map((id) => compositeById.get(id))
    .filter(
      (composite): composite is CompositeEntry =>
        composite !== undefined && composite.parentDefinitionId === parentDefinitionId,
    );

/**
 * The liquid palette, keyed by visual state. `src/equipment/liquidRendering/styles.ts` builds
 * `LIQUID_STYLES` from this and holds no palette of its own, so a colour cannot be defined in one
 * place and documented in another.
 */
export const liquidStylesByState: ReadonlyMap<string, LiquidRenderStyle> = new Map(
  visualStateRegistry.states
    .filter((state) => state.disposition === "liquid-style" && state.renderStyle)
    .map((state) => [state.renderStyleKey ?? state.id, state.renderStyle as LiquidRenderStyle]),
);

/** The solid and precipitate palette, keyed by visual state. */
export const solidStylesByState: ReadonlyMap<string, SolidRenderStyle> = new Map(
  visualStateRegistry.states
    .filter((state) => state.disposition === "solid-style" && state.solidStyle)
    .map((state) => [state.id, state.solidStyle as SolidRenderStyle]),
);

export const visualStateFallbacks = visualStateRegistry.fallbacks;
