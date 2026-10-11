import type { TechniqueDefinition } from "../domain/types";
import { fillLevelMm } from "./adapters/runtimeToScene";
import { equipment3dEntry } from "./equipment3d/readiness";

/**
 * Classroom values the 3D version works out rather than asks for (Pack 3a, decided 2026-10-11): Paper
 * Chromatography's solvent depth follows from the volume poured and the chamber's shape, so the teacher sets the
 * volume and the depth the runtime checks (the strip's foot in the solvent, its baseline above it) is never set
 * apart from it. 3D only: the 2D content and the shared configuration code are unchanged.
 */
const CHAMBER = "chromatography-chamber";
const PAPER_SLOT = "chromatography-chamber-paper-slot";

const hasSlots = (definition: TechniqueDefinition, ...ids: string[]): boolean => {
  const declared = new Set((definition.composition?.configurationSlots ?? []).map((slot) => slot.id));
  return ids.every((id) => declared.has(id));
};

/** The slots the 3D version fills itself, never shown on the setup page. */
export const derivedSlots3D = (definition: TechniqueDefinition): string[] =>
  hasSlots(definition, "solventVolumeMl", "solventDepthMm") && definition.initialState.equipment.some((item) => item.definitionId === CHAMBER)
    ? ["solventDepthMm"] : [];

/**
 * The solvent's depth above a hung strip's lower edge, in mm (one decimal): the level `volumeMl` reaches in the
 * chamber's fill profile, less the height of the paper slot's anchor, where the strip's foot hangs.
 */
export const solventDepthAboveStripMm = (volumeMl: number): number | undefined => {
  const entry = equipment3dEntry(CHAMBER);
  const anchor = entry?.anchors[PAPER_SLOT]?.positionMm;
  if (!entry?.fill || !anchor || !(volumeMl > 0)) return undefined;
  return Math.round((fillLevelMm(entry.fill, volumeMl).levelMm - anchor[2]) * 10) / 10;
};

/**
 * The teacher's values with the derived ones added. Throws, naming the value to change, when the solvent would not
 * reach the strip or would cover its baseline.
 */
export const withDerived3D = (definition: TechniqueDefinition, values: Record<string, string>): Record<string, string> => {
  if (!derivedSlots3D(definition).includes("solventDepthMm")) return values;
  const volumeMl = Number(values.solventVolumeMl);
  const depth = solventDepthAboveStripMm(volumeMl);
  if (depth === undefined || depth <= 0) {
    throw new Error("Solvent volume: too little to reach the strip's lower edge in the chamber. Use more solvent.");
  }
  const baseline = Number(values.baselineHeightMm);
  if (Number.isFinite(baseline) && depth >= baseline) {
    throw new Error(`Solvent volume: ${volumeMl} mL stands ${depth} mm up the strip, over its ${baseline} mm baseline. Use less solvent.`);
  }
  return { ...values, solventDepthMm: String(depth) };
};
