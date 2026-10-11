/**
 * Teacher-facing labels for configuration slots (decision U10). Presentation only: the core keeps
 * its slot ids, and the Studio shows the id beside the label for authors. Wording follows each
 * technique's own input labels and step text where they exist, so no new scientific meaning is
 * introduced; an unknown slot falls back to a readable form of its id.
 */
export interface SlotLabel {
  label: string;
  unit?: string;
  /** One neutral line of help, when the definition's own wording supplies one. */
  help?: string;
}

const LABELS: Record<string, SlotLabel> = {
  // weighing
  massMeasurementId: { label: "Mass record name", help: "The name the recorded mass is filed under." },
  solidMassG: { label: "Solid mass to weigh", unit: "g", help: "The portion the student transfers onto the weighing vessel. The balance shows this mass." },
  supportEmptyMassG: { label: "Empty weighing vessel mass", unit: "g", help: "What the balance shows with the empty vessel on the pan, before it is zeroed." },
  reagentStockMassG: { label: "Solid in the reagent bottle", unit: "g", help: "How much the stock bottle holds at the start." },
  // measuring-volume
  targetVolumeMl: { label: "Target volume", unit: "mL" },
  volumeToleranceMl: { label: "Volume tolerance", unit: "mL" },
  volumeMeasurementId: { label: "Volume record name", help: "The name the recorded volume is filed under." },
  // making-solution
  finalVolumeMl: { label: "Final solution volume", unit: "mL" },
  initialSolventVolumeMl: { label: "Initial solvent volume", unit: "mL", help: "Deionized water added from the wash bottle first." },
  soluteMassG: { label: "Sodium carbonate in the weighing boat", unit: "g", help: "The pre-weighed mass the student tips into the flask, at most 10 g so it dissolves in the half-full flask." },
  solutionObservation: { label: "Solution appearance to record", help: "The appearance evidence the notebook step records." },
  // dilution
  aliquotVolumeMl: { label: "Aliquot volume", unit: "mL" },
  dilutionFactor: { label: "Dilution factor" },
  dilutionEvidenceId: { label: "Dilution record name", help: "The name the dilution evidence is filed under." },
  // transmittance-dilution
  stockConcentrationM: { label: "Stock solution concentration", unit: "M", help: "The instructor-approved concentration." },
  wavelengthNm: { label: "Measurement wavelength", unit: "nm", help: "The approved wavelength the photometer is set to." },
  blankRuleNotebookTag: { label: "Blank optical-face record name" },
  finalVolumeMeasurementId: { label: "Final volume record name" },
  stockConcentrationMeasurementId: { label: "Stock concentration record name" },
  stockVolumeMeasurementId: { label: "Stock aliquot record name" },
  waterVolumeMeasurementId: { label: "Water volume record name" },
  wavelengthMeasurementId: { label: "Wavelength record name" },
  stockAliquotVolumeMl: { label: "Stock aliquot volume", unit: "mL" },
  waterVolumeMl: { label: "Water volume", unit: "mL" },
  samplePercentTransmittance: { label: "Sample transmittance", unit: "%T", help: "What the photometer shows for the diluted sample once it is zeroed on the blank." },
  // paper-chromatography (3D, Pack 3a)
  solventVolumeMl: { label: "Solvent in the chamber", unit: "mL", help: "Measured in the graduated cylinder and poured in. Its depth up the strip is worked out from the chamber's shape and must stay below the baseline." },
  baselineHeightMm: { label: "Baseline height", unit: "mm", help: "How far above the strip's lower edge the pencil baseline is drawn." },
  spotterLoadVolumeMl: { label: "Dye drawn into the capillary", unit: "mL" },
  spotVolumeMl: { label: "Dye left by each touch", unit: "mL" },
  spotDryMinutes: { label: "Time for a spot to dry", unit: "min", help: "Run fast on the step clock." },
  developMinutes: { label: "Development time", unit: "min", help: "Run fast on the step clock while the solvent rises." },
  stripDryMinutes: { label: "Time for the strip to dry", unit: "min", help: "Run fast on the step clock." },
};

const UNIT_SUFFIXES: Array<[RegExp, string]> = [[/PercentTransmittance$/, "%T"], [/Ml$/, "mL"], [/Nm$/, "nm"], [/G$/, "g"], [/M$/, "M"], [/C$/, "°C"], [/Min$/, "min"], [/S$/, "s"]];

/** Readable fallback: "rinseVolumeMl" -> "Rinse volume" with unit "mL"; "...Id" -> "... record name". */
export const fallbackSlotLabel = (slotId: string): SlotLabel => {
  let base = slotId;
  let unit: string | undefined;
  for (const [pattern, u] of UNIT_SUFFIXES) {
    if (pattern.test(base) && base.length > 2) {
      base = base.replace(pattern, "");
      unit = u;
      break;
    }
  }
  const idLike = /(MeasurementId|Id|Tag)$/.test(base);
  base = base.replace(/(MeasurementId|Id|Tag)$/, "");
  const words = base.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase().trim();
  const label = words.charAt(0).toUpperCase() + words.slice(1) + (idLike ? " record name" : "");
  return unit && !idLike ? { label, unit } : { label };
};

export const slotLabel = (slotId: string): SlotLabel => LABELS[slotId] ?? fallbackSlotLabel(slotId);

/** True when the slot has authored wording here rather than the readable fallback. */
export const hasExplicitSlotLabel = (slotId: string): boolean => Object.hasOwn(LABELS, slotId);
