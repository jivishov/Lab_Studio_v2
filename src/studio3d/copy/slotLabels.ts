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
  // measuring-volume
  targetVolumeMl: { label: "Target volume", unit: "mL" },
  volumeToleranceMl: { label: "Volume tolerance", unit: "mL" },
  volumeMeasurementId: { label: "Volume record name", help: "The name the recorded volume is filed under." },
  // making-solution
  finalVolumeMl: { label: "Final solution volume", unit: "mL" },
  initialSolventVolumeMl: { label: "Initial solvent volume", unit: "mL", help: "Deionized water added from the wash bottle first." },
  soluteMassG: { label: "Solute mass", unit: "g" },
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
};

const UNIT_SUFFIXES: Array<[RegExp, string]> = [[/Ml$/, "mL"], [/Nm$/, "nm"], [/G$/, "g"], [/M$/, "M"], [/C$/, "°C"], [/Min$/, "min"], [/S$/, "s"]];

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
