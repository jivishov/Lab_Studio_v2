import { item, setup } from "../common.mjs";
import { twin as drying } from "../dryingPractice.mjs";
import { twin as hardness } from "../hardWaterCalculationPractice.mjs";
import intro from "./introFiltrationDemo.mjs";

/**
 * Determine Water Hardness in 3D (Pack 3a, decided 2026-10-10; `proposals/PACK3_ATOMIZATION.md`, "Calculate Hardness"
 * and decision 9): the 2D lab's six parts in its order, as 3D twins, under the 2D lab's instance ids. The first four
 * are `intro-filtration-demo`'s, on its bench and with its setup fields; then Dry and Weigh (`drying-3d`) and Calculate
 * Hardness (`hard-water-calculation-3d`). The 2D lab of the same id is not read.
 *
 * The ids meet through plain configuration bindings (a config-bound string under a key ending in `MeasurementId` or
 * `CalculationId` passes through the compiler unscoped): Dry and Weigh reads Filtration's paper mass, and the hardness
 * reads Measure Liquid Volume's sample volume and Dry and Weigh's precipitate mass, a calculation. The analytical
 * balance reads to 0.0001 g from Filtration's paper on (decision 9), so the default run reaches 375 mg/L.
 */
export default {
  ...intro,
  id: "hard-water-demo",
  title: "Determine Water Hardness",
  description: "Measure a hard-water sample, precipitate its calcium as calcium carbonate, filter, dry and weigh the solid, and calculate the hardness in mg/L as CaCO3.",
  learningGoals: [
    ...intro.learningGoals,
    "Dry the precipitate and find its mass by difference",
    "Calculate the hardness in mg/L as CaCO3",
  ],
  safetyNotes: [
    ...intro.safetyNotes,
    "The oven and the hot watch glass burn: handle the glass with crucible tongs, and let it cool on the heat-safe pad.",
  ],
  bench: [
    ...intro.bench,
    item("drying-oven-1", "drying-oven", "Drying oven", undefined, "workbench"),
    item("heat-safe-pad-1", "heat-safe-pad", "Heat-safe pad", undefined, "workbench"),
    item("lab-sink-1", "lab-sink", "Sink", undefined, "workbench"),
    item("watch-glass-1", "watch-glass", "Labelled watch glass"),
    item("crucible-tongs-1", "crucible-tongs", "Crucible tongs"),
    item("scoopula-1", "scoopula", "Metal scoop"),
  ],
  parts: [
    ...intro.parts,
    {
      instanceId: "drying",
      title: "Dry and weigh the solid",
      technique: drying,
      items: {
        "drying-oven-1": "drying-oven-1",
        "funnel-stand-1": "funnel-stand-1",
        "filter-paper-1": "filter-paper-1",
        "erlenmeyer-flask-250ml-1": "erlenmeyer-flask-250ml-1",
        "analytical-balance-1": "analytical-balance-1",
        "heat-safe-pad-1": "heat-safe-pad-1",
        "lab-sink-1": "lab-sink-1",
        "watch-glass-1": "watch-glass-1",
        "crucible-tongs-1": "crucible-tongs-1",
        "scoopula-1": "scoopula-1",
      },
      configuration: {
        paperMassG: setup("paperMassG"),
        watchGlassMassG: setup("watchGlassMassG"),
        firstDryingMinutes: setup("firstDryingMinutes"),
        filterPaperMassMeasurementId: "filtration--filter-paper-mass",
      },
    },
    {
      instanceId: "hard-water-calculation",
      title: "Calculate the hardness",
      technique: hardness,
      items: {},
      configuration: {
        sampleVolumeMeasurementId: "measuring-volume--sample-volume",
        precipitateMassCalculationId: "drying--precipitate-mass",
        calculationTolerance: 0.5,
      },
    },
  ],
  setup: [
    ...intro.setup,
    { id: "watchGlassMassG", label: "Empty watch glass's mass", unit: "g", kind: "number", defaultValue: 30, min: 1, max: 100,
      help: "What the balance shows for the clean, dry, labelled watch glass." },
    { id: "firstDryingMinutes", label: "First drying stage", unit: "min", kind: "number", defaultValue: 12, min: 10, max: 15,
      help: "Investigation 3: dry within 10 to 15 minutes; the second stage is 5 minutes." },
  ],
};
