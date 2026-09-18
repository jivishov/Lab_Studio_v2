import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { deriveActionEffectContract } from "../../domain/atomRegistry";
import type { TechniqueDefinition } from "../../domain/types";
import { validateTechniqueDefinition } from "../../domain/validation";
import { auditStandaloneEvidence } from "../standaloneEvidenceAudit";
import {
  applyTechniqueConfiguration,
  applyTechniqueConfigurationForComposition,
  compositionTechniqueConfigurationBlocker,
  configurationSlots,
  standaloneTechniqueConfigurationBlocker,
  TechniqueConfigurationError,
  unresolvedConfigurationSlots,
} from "../techniqueConfiguration";
import { hostLabsForTechnique } from "../techniqueHosts";

/**
 * Item-1 setup/configuration regressions.
 *
 * These cases replace the former "feed every numeric-looking slot 1 and prove no template remains"
 * oracle. Removing braces is not evidence that a configured technique is scientifically runnable.
 * The repaired contract instead preserves declared slot types, leaves hosted procedure selection to
 * composition, audits identifier producers/consumers through completion rules, and passes a concrete
 * standalone definition through the same production validator used by the bundle loader.
 *
 * Authored, not executed, under the repository validation policy.
 */
const readTechnique = async (id: string): Promise<TechniqueDefinition> =>
  JSON.parse(
    await readFile(join(process.cwd(), "public", "techniques", `${id}.json`), "utf8"),
  ) as TechniqueDefinition;

const slotById = (definition: TechniqueDefinition, id: string) => {
  const slot = configurationSlots(definition).find((entry) => entry.id === id);
  if (!slot) throw new Error(`Missing configuration slot ${definition.id}.${id}.`);
  return slot;
};

describe("declared standalone configuration contracts", () => {
  it("preserves declared string choices instead of inferring numeric input from a slot name", async () => {
    const thermal = await readTechnique("thermal-decomposition-mass-loss");
    const tareConvention = slotById(thermal, "tareConvention");
    expect(tareConvention).toMatchObject({
      valueType: "string",
      mode: "text",
      kind: "classroom-quantity",
    });
    expect(tareConvention.allowedValues?.length).toBeGreaterThan(1);

    const chromatography = await readTechnique("paper-chromatography");
    const stopCondition = slotById(chromatography, "stopCondition");
    expect(stopCondition).toMatchObject({
      valueType: "string",
      mode: "text",
      defaultValue: "front-mm:80",
    });
  });

  it("keeps procedure selection and hosted data on the composition route", async () => {
    const chromatography = await readTechnique("paper-chromatography");
    const selectedProcedure = slotById(chromatography, "selectedProcedure");
    expect(selectedProcedure.kind).toBe("host-composition-only");
    expect(selectedProcedure.allowedValues?.length).toBeGreaterThan(0);

    const hosts = hostLabsForTechnique(chromatography.id);
    expect(hosts.map((host) => host.id)).toContain("paper-chromatography");
    expect(standaloneTechniqueConfigurationBlocker(chromatography)).toMatch(/supported composed lab route/i);
    expect(() => applyTechniqueConfiguration(chromatography, {})).toThrow(TechniqueConfigurationError);
  });

  it("keeps weighing bound to the actual acquired mass identifier without a stale target", async () => {
    const weighing = await readTechnique("weighing");
    expect(hostLabsForTechnique(weighing.id)).toEqual([]);
    expect(configurationSlots(weighing).map((slot) => slot.id)).toEqual(["massMeasurementId"]);
    expect(slotById(weighing, "massMeasurementId")).toMatchObject({
      kind: "internal-identifier",
      required: true,
      valueType: "string",
    });
    expect(standaloneTechniqueConfigurationBlocker(weighing)).toBeNull();
    const configured = applyTechniqueConfiguration(weighing, {});
    expect(unresolvedConfigurationSlots(configured)).toEqual([]);
    const mass = configured.actions.find((action) => action.id === "weigh-solid")?.mass;
    expect(mass?.source).toBe("action-input");
    expect(mass?.source === "action-input" ? mass.outputMeasurementId : undefined)
      .toBe("standalone-mass-measurement-id");
  });

  it("binds an unhosted standalone technique using declared values and validates the result", async () => {
    const dilution = await readTechnique("dilution");
    expect(hostLabsForTechnique(dilution.id)).toEqual([]);
    expect(standaloneTechniqueConfigurationBlocker(dilution)).toBeNull();

    const configured = applyTechniqueConfiguration(dilution, {
      aliquotVolumeMl: "5",
      finalVolumeMl: "50",
      dilutionFactor: "10",
    });
    expect(unresolvedConfigurationSlots(configured)).toEqual([]);

    // Production validation coverage, not merely string substitution.
    const validation = validateTechniqueDefinition(configured);
    expect(validation.ok, validation.errors.join("\n")).toBe(true);
    expect(validation.value?.id).toBe("dilution");
  });

  it("rejects a malformed declared number before configured-definition validation", async () => {
    const dilution = await readTechnique("dilution");
    expect(() => applyTechniqueConfiguration(dilution, {
      aliquotVolumeMl: "about five",
      finalVolumeMl: "50",
      dilutionFactor: "10",
    })).toThrow(/finite number/i);
  });

  it("guards generic Studio composition with the same structural blocker as the shared API", async () => {
    const chromatography = await readTechnique("paper-chromatography");
    expect(compositionTechniqueConfigurationBlocker(chromatography)).toMatch(/ordered[- ]procedure/i);
    expect(() => applyTechniqueConfigurationForComposition(chromatography, {}))
      .toThrow(TechniqueConfigurationError);

    const dilution = await readTechnique("dilution");
    expect(compositionTechniqueConfigurationBlocker(dilution)).toBeNull();
  });
});

describe("standalone evidence is produced, not invented from identifiers", () => {
  it("keeps transmittance dilution tied to real configuration and final-volume evidence", async () => {
    const technique = await readTechnique("transmittance-dilution");
    const issues = auditStandaloneEvidence(technique);
    expect(issues).toEqual([]);
    expect(technique.actions.find((action) => action.id === "transmittance-dilution-record-stock-concentration"))
      .toMatchObject({
        verb: "observe",
        parameters: {
          configurationQuantity: "stock solution concentration",
          inputMode: "numeric",
          inputRole: "teacherConfiguration",
          inputRequired: false,
          configuredValue: "{{config.stockConcentrationM}}",
          unit: "M",
        },
      });
    expect(technique.actions.find((action) => action.id === "transmittance-dilution-wipe-blank-cuvette"))
      .toMatchObject({
        parameters: {
          requiresStudentNote: true,
          inputMode: "text",
          inputRole: "studentResponse",
          inputRequired: true,
        },
      });
    expect(technique.actions.find((action) => action.id === "transmittance-dilution-configure-photometer"))
      .toMatchObject({
        parameters: {
          configurationQuantity: "measurement wavelength",
          inputMode: "numeric",
          inputRole: "teacherConfiguration",
          inputRequired: false,
          configuredValue: "{{config.wavelengthNm}}",
          inputMin: 0,
          inputMinExclusive: true,
          unit: "nm",
        },
      });
    expect(technique.actions.find((action) => action.id === "transmittance-dilution-wipe-orient-sample-cuvette"))
      .toMatchObject({
        parameters: {
          requiresStudentNote: true,
          inputMode: "text",
          inputRole: "studentResponse",
          inputRequired: true,
        },
      });
    expect(technique.actions.find((action) => action.id === "transmittance-dilution-read-percent-transmittance"))
      .toMatchObject({
        parameters: {
          inputMode: "numeric",
          inputRole: "studentResponse",
          inputRequired: true,
          inputMin: 0,
          inputMinExclusive: true,
          inputMax: 100,
          unit: "%T",
        },
      });
    expect(technique.actions.find((action) => action.id === "transmittance-dilution-add-water-below-mark"))
      .toMatchObject({
        atomId: "atom.dilute.record-resulting-final-volume",
        volume: { outputMeasurementId: "{{config.finalVolumeMeasurementId}}" },
      });
    expect(technique.actions.find((action) => action.id === "transmittance-dilution-calculate-diluted-concentration"))
      .toMatchObject({ parameters: { template: "dilutedConcentration", unit: "M" } });

    const blocker = standaloneTechniqueConfigurationBlocker(technique);
    expect(blocker).toBeNull();
    expect(slotById(technique, "wavelengthNm")).toMatchObject({
      valueType: "number",
      required: true,
      unit: "nm",
    });

    const beersLaw = await readTechnique("beers-law-calibration");
    expect(beersLaw.actions.find((action) => action.id === "beers-law-calibration-configure-photometer"))
      .toMatchObject({
        parameters: {
          configurationQuantity: "measurement wavelength",
          inputMode: "numeric",
          inputRole: "teacherConfiguration",
          inputRequired: false,
          configuredValue: "{{config.wavelengthNm}}",
          unit: "nm",
        },
      });
    expect(beersLaw.actions.find((action) => action.id === "beers-law-calibration-prepare-calibration-blank-optical-faces"))
      .toMatchObject({ parameters: { requiresStudentNote: true, inputMode: "text", inputRequired: true } });
    expect(beersLaw.actions.find((action) => action.id === "beers-law-calibration-prepare-standard-optical-faces"))
      .toMatchObject({ parameters: { requiresStudentNote: true, inputMode: "text", inputRequired: true } });
    expect(beersLaw.actions.find((action) => action.id === "beers-law-calibration-read-percent-transmittance"))
      .toMatchObject({
        parameters: {
          inputMode: "numeric",
          inputRole: "studentResponse",
          inputRequired: true,
          inputMin: 0,
          inputMinExclusive: true,
          inputMax: 100,
          unit: "%T",
        },
      });
    expect(slotById(beersLaw, "wavelengthNm")).toMatchObject({
      valueType: "number",
      required: true,
      unit: "nm",
    });
  });

  it("rejects a non-positive teacher-approved wavelength instead of inventing one", async () => {
    const technique = await readTechnique("transmittance-dilution");
    expect(() => applyTechniqueConfiguration(technique, {
      stockConcentrationM: "0.25",
      wavelengthNm: "0",
    })).toThrow(/wavelengthNm.*greater than zero/i);
  });

  it("checks process and success-rule measurement ids, not only action parameters", async () => {
    const weighing = await readTechnique("weighing");
    const issues = auditStandaloneEvidence(weighing);
    const missingSolidMass = issues.find((issue) =>
      issue.code === "missing-measurement-producer" && issue.measurementId === "solid-mass");
    expect(missingSolidMass).toBeUndefined();
  });
});

describe("paper chromatography production definition contract", () => {
  it("derives development as a physical process effect and validates the shipped definition", async () => {
    const technique = await readTechnique("paper-chromatography");
    const developActions = technique.actions.filter((action) =>
      action.atomId === "atom.developChromatogram.develop-strip");
    expect(developActions.length).toBeGreaterThan(0);

    for (const action of developActions) {
      expect(action.interaction?.type).toBe("recordNotebook");
      const derived = deriveActionEffectContract(action);
      expect(derived.errors, `${action.id}: ${derived.errors.join(" ")}`).toEqual([]);
      expect(derived.contract?.classes).toContain("apparatus-material-instrument-state");
      expect(derived.contract?.classes).not.toContain("measurement-direct-observation-acquisition");
    }

    // This is the validator on loadBundledTechnique's real path, not a prerequisite-stripped intent.
    const validation = validateTechniqueDefinition(technique);
    expect(validation.ok, validation.errors.join("\n")).toBe(true);
  });
});
