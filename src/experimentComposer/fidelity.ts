import type { DeliveryContext, FidelityManifest } from "./types";

export const createFidelityManifest = (context: DeliveryContext): FidelityManifest => ({
  status: context === "virtual_training"
    ? "modeled_and_executable"
    : "procedurally_executable",
  modeled: [
    "A deterministic 1:1 synthetic monoprotic-acid/NaOH titration drop plan.",
    "Aliquot, initial/final burette evidence, indicator endpoint evidence, and molarity calculation prerequisites.",
  ],
  proceduralOnly: context === "physical_procedure_rehearsal"
    ? ["The virtual sequence rehearses handling steps but does not characterize an external physical sample."]
    : [],
  assumptions: [
    "The synthetic sample preset is internally fixed by Lab Studio.",
    "Standardized NaOH concentration is taken from the declared inventory.",
    "The reaction uses a verified 1:1 analyte-to-titrant stoichiometric ratio.",
  ],
  limitations: [
    "The analyte is a synthetic Lab Studio sample model.",
    "Aliquot precision is limited by the modeled graduated cylinder rather than a volumetric pipette.",
    "No full pH curve, acid-base equilibrium, or indicator-equilibrium behavior is modeled in this P0 sequence.",
    "The P0 sequence begins with a modeled prefilled burette and does not rehearse conditioning, filling, tip clearing, or funnel removal.",
    "The simulation does not characterize the concentration or identity of an external physical sample.",
    "Answer fields are omitted from learner UI and tool output but are not cryptographically secret from client-side source inspection.",
    "Declared equipment, PPE, facilities, and waste readiness are not a comprehensive safety review.",
    "Temperature, activity coefficients, glassware calibration uncertainty, and detailed parallax/meniscus error are excluded.",
  ],
  safetyDeclarations: context === "physical_procedure_rehearsal"
    ? [
        "Splash goggles, eyewash, spill-response materials, and a compatible base-waste container were declared available.",
      ]
    : ["The profile is a virtual simulation inventory, not proof of a physical room's contents or readiness."],
  warnings: context === "physical_procedure_rehearsal"
    ? ["Instructor and local safety procedures remain authoritative for physical work."]
    : [],
});
