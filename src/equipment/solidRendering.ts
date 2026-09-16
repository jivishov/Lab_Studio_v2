import type { CSSProperties } from "react";
import type { ContentState } from "../domain/types";
import {
  solidStylesByState,
  visualStateById,
  visualStateFallbacks,
  type SolidRenderStyle,
} from "./registries";

/**
 * Solid and precipitate appearance resolution, the counterpart to `liquidRendering/styles.ts`.
 *
 * Before Cycle 05 a solid had exactly one appearance, hard-coded three times: in `SolidLayer`'s SVG
 * fills, in `.equipment-region-solid`, and in `.equipment-precipitate`. Ten authored states —
 * `powder`, `solid`, `granular-solid`, `white-solid`, `dry-solid`, `filter-cake`, and the four Inv. 4
 * dryness stages — all drew the same beige ellipse, which is why the audit recorded them as
 * unresolved. They are now registry entries with a `solid-style` disposition, and the entry for
 * `powder` carries the previously hard-coded values verbatim so nothing authored changed appearance.
 *
 * There are no label heuristics here, and there never were: an authored state wins, and anything
 * else takes `fallbacks.defaultSolidState`.
 */

const DEFAULT_SOLID_STYLE = solidStylesByState.get(visualStateFallbacks.defaultSolidState);
if (!DEFAULT_SOLID_STYLE) {
  // Same reasoning as styles.ts: a literal fallback would be a second palette that drifts silently.
  throw new Error(
    `visualStateRegistry.fallbacks.defaultSolidState "${visualStateFallbacks.defaultSolidState}" has no solid-style entry`,
  );
}

export const solidStyleKeys = (): readonly string[] => [...solidStylesByState.keys()];

export const resolveSolidStyle = (contents: ContentState): SolidRenderStyle => {
  const visualState = contents.visualState;
  if (!visualState) return DEFAULT_SOLID_STYLE;
  const entry = visualStateById.get(visualState);
  if (!entry || entry.disposition !== "solid-style") return DEFAULT_SOLID_STYLE;
  return solidStylesByState.get(entry.id) ?? DEFAULT_SOLID_STYLE;
};

/**
 * The same resolved style as CSS custom properties, for the two HTML fallback layers that draw a
 * solid without an SVG region. The stylesheet reads these with the previous literals as defaults, so
 * a definition with no solid profile is unaffected.
 */
export const solidStyleVariables = (contents: ContentState): CSSProperties => {
  const style = resolveSolidStyle(contents);
  return {
    "--solid-fill": style.fill,
    "--solid-stroke": style.stroke,
    "--solid-highlight": style.highlight,
  } as CSSProperties;
};

export type { SolidRenderStyle };
