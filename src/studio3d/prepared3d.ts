import type { LabCompositionSourceDefinition, LabDefinition, TechniqueDefinition } from "../domain/types";
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
const SPOTTER = "capillary-spotter";

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
 * reach the strip or would cover its baseline, or when the capillary could not make every touch the steps make.
 */
export const withDerived3D = (definition: TechniqueDefinition, values: Record<string, string>): Record<string, string> => {
  checkSpotting(definition, values);
  if (!derivedSlots3D(definition).includes("solventDepthMm")) return values;
  return { ...values, solventDepthMm: String(checkedDepth(Number(values.solventVolumeMl), Number(values.baselineHeightMm))) };
};

const checkedDepth = (volumeMl: number, baselineMm: number): number => {
  const depth = solventDepthAboveStripMm(volumeMl);
  if (depth === undefined || depth <= 0) {
    throw new Error("Solvent volume: too little to reach the strip's lower edge in the chamber. Use more solvent.");
  }
  if (Number.isFinite(baselineMm) && depth >= baselineMm) {
    throw new Error(`Solvent volume: ${volumeMl} mL stands ${depth} mm up the strip, over its ${baselineMm} mm baseline. Use less solvent.`);
  }
  return depth;
};

const round4 = (value: number): number => Math.round(value * 1e4) / 1e4;

/**
 * The capillary must hold what the teacher has it draw up, and that must cover every touch the steps make (three,
 * decision 8): otherwise the run cannot finish. The lab's setup page checks the same with its rules.
 */
const checkSpotting = (definition: TechniqueDefinition, values: Record<string, string>): void => {
  if (!hasSlots(definition, "spotterLoadVolumeMl", "spotVolumeMl")) return;
  const load = Number(values.spotterLoadVolumeMl);
  const spot = Number(values.spotVolumeMl);
  // A missing or unreadable number is the setup page's own message.
  if (!(load > 0) || !(spot > 0)) return;
  const capacity = equipment3dEntry(SPOTTER)?.fill?.capacityMl;
  if (capacity !== undefined && load > capacity) {
    throw new Error(`Dye drawn into the capillary: the tube holds ${capacity} mL. Draw up less.`);
  }
  const touches = definition.actions.filter((action) => action.verb === "spotSample").length;
  if (touches * spot > load + 1e-9) {
    throw new Error(`Dye drawn into the capillary: ${touches} touches of ${spot} mL need ${round4(touches * spot)} mL. Draw up more, or leave less with each touch.`);
  }
};

/**
 * A 3D lab's configured source with its prepared values worked out (Pack 3a, decided 2026-10-11: "3D transform in
 * labs3d.ts"): each part that takes a solvent volume and depth gets the depth its volume gives, and each
 * chromatography model's expected Rf is its band's distance over the front, from the teacher's distances, as 2D's
 * `labSetup.ts` does for its own lab. Throws, for the setup page, when a volume misses the strip or covers its baseline.
 */
export const preparedLab3DSource = <T extends LabCompositionSourceDefinition>(configured: T): T => {
  const prepared = structuredClone(configured);
  for (const instance of prepared.techniqueInstances) {
    const configuration = instance.bindings.configuration;
    if (!("solventVolumeMl" in configuration) || !("solventDepthMm" in configuration)) continue;
    configuration.solventDepthMm = checkedDepth(Number(configuration.solventVolumeMl), Number(configuration.baselineHeightMm));
  }
  for (const model of prepared.chromatographyModels ?? []) {
    for (const band of model.bands) band.expectedRf = round4(band.distanceMm / model.solventFrontMm);
  }
  return prepared;
};

/**
 * The compiled lab with each development stopping at its model's front: the techniques write the practice
 * version's stop distance (`front-mm:80`) as a number, and the teacher's front replaces it.
 */
export const withLabStopDistances = (lab: LabDefinition): LabDefinition => {
  const fronts = new Map((lab.chromatographyModels ?? []).map((model) => [model.id, model.solventFrontMm]));
  return {
    ...lab,
    actions: lab.actions.map((action) => {
      const front = fronts.get(String(action.parameters.chromatographyModelId ?? ""));
      return action.verb === "developChromatogram" && front !== undefined && typeof action.parameters.stopCondition === "string"
        ? { ...action, parameters: { ...action.parameters, stopCondition: `front-mm:${front}` } } : action;
    }),
  };
};
