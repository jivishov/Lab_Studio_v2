import type { ContentState, EquipmentDefinition } from "../../domain/types";
import {
  liquidStylesByState,
  visualStateById,
  visualStateFallbacks,
} from "../registries";
import type { LiquidRenderStyle, RenderableLiquid } from "./types";

/**
 * Liquid appearance resolution.
 *
 * The palette lives in `src/equipment/visualStateRegistry.json`, not here: every colour is one
 * registry entry with a disposition, an evidence kind, and a provenance sentence. This module owns
 * only the precedence, and Cycle 05 inverted it. Before, an explicit authored `visualState` was
 * honoured only when it began with `titration-` or the content label contained `+`; three
 * definition-id overrides and a reagent-name heuristic beat it otherwise, which cost 65 authored
 * instances their state and drew three dye and analyte samples as plain water. Now:
 *
 *   1. an authored or runtime-assigned `visualState` that the registry can render wins outright;
 *   2. the `fallbacks.definitionIdStates` table applies only when no state is in play;
 *   3. the `fallbacks.reagentKeywordStates` table applies only after that;
 *   4. otherwise `fallbacks.defaultLiquidState`.
 *
 * An explicit state the registry cannot render falls to step 4, never to a heuristic, and
 * `npm run content:check` reports it as `visual-state/unresolved` or `visual-state/unregistered`.
 * That is the difference between debt that is visible and debt that is papered over.
 */

const LIQUID_STYLES: Record<string, LiquidRenderStyle> = Object.fromEntries(liquidStylesByState);

const DEFAULT_STYLE = LIQUID_STYLES[visualStateFallbacks.defaultLiquidState];
if (!DEFAULT_STYLE) {
  // Deliberately loud. A silent literal fallback here would be a second palette, which is the exact
  // thing this module stopped owning, and it would drift from the registry unnoticed.
  throw new Error(
    `visualStateRegistry.fallbacks.defaultLiquidState "${visualStateFallbacks.defaultLiquidState}" has no liquid-style entry`,
  );
}

export const liquidStyleKeys = (): readonly string[] => Object.keys(LIQUID_STYLES);

const normalize = (value?: string): string =>
  (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export const normalizeReagentKey = (label?: string): string | undefined => {
  const value = normalize(label);
  if (!value) return undefined;
  for (const entry of visualStateFallbacks.reagentKeywordStates) {
    if (entry.keywords.some((keyword) => value.includes(keyword))) return entry.state;
  }
  return undefined;
};

/**
 * True when the instance authors a state the registry can render as a liquid. A `nonvisual` state
 * such as `empty` is deliberately not authoritative: it says the contents have no appearance, so the
 * container fallbacks are still allowed to describe the vessel.
 */
const authoritativeLiquidState = (visualState?: string): string | undefined => {
  if (!visualState) return undefined;
  const entry = visualStateById.get(visualState);
  if (!entry || entry.disposition !== "liquid-style") return undefined;
  return entry.renderStyleKey ?? entry.id;
};

/** True when an authored state exists and must not be replaced by a container heuristic. */
const suppressesFallbacks = (visualState?: string): boolean => {
  if (!visualState) return false;
  const entry = visualStateById.get(visualState);
  return entry ? entry.disposition !== "nonvisual" : true;
};

export const deriveRenderableLiquid = (contents: ContentState): RenderableLiquid => {
  const isVisibleLiquid =
    contents.kind === "liquid" || contents.kind === "solution" || contents.kind === "mixture";
  const volumeMl =
    typeof contents.volumeMl === "number"
      ? contents.volumeMl
      : typeof contents.finalVolumeMl === "number"
        ? contents.finalVolumeMl
        : undefined;
  return {
    volumeMl,
    visualState: contents.visualState,
    reagentKey: normalizeReagentKey(contents.label),
    hasPrecipitate: contents.kind === "precipitate" || Boolean(contents.precipitate),
    hasPowder: contents.kind === "solid",
    isWetOnly: !isVisibleLiquid && contents.wetState !== "dry",
    isVisibleLiquid,
  };
};

export const resolveLiquidStyle = (
  contents: ContentState,
  definition?: EquipmentDefinition,
): LiquidRenderStyle => {
  const authored = authoritativeLiquidState(contents.visualState);
  if (authored) return LIQUID_STYLES[authored] ?? DEFAULT_STYLE;
  if (suppressesFallbacks(contents.visualState)) return DEFAULT_STYLE;

  const byDefinitionId = definition
    ? visualStateFallbacks.definitionIdStates.find(
        (entry) => entry.definitionId === definition.id,
      )?.state
    : undefined;
  if (byDefinitionId && LIQUID_STYLES[byDefinitionId]) return LIQUID_STYLES[byDefinitionId];

  const reagentKey = normalizeReagentKey(`${definition?.label ?? ""} ${contents.label ?? ""}`);
  if (reagentKey && LIQUID_STYLES[reagentKey]) return LIQUID_STYLES[reagentKey];

  return DEFAULT_STYLE;
};
