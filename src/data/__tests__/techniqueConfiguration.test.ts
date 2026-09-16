import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { deriveActionEffectContract } from "../../domain/atomRegistry";
import type { TechniqueDefinition } from "../../domain/types";
import { validateTechniqueDefinition } from "../../domain/validation";
import { auditStandaloneEvidence } from "../standaloneEvidenceAudit";
import {
  applyTechniqueConfiguration,
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

  it("surfaces required declared-but-unbound configuration instead of treating it as resolved", async () => {
    const weighing = await readTechnique("weighing");
    expect(hostLabsForTechnique(weighing.id)).toEqual([]);
    expect(unresolvedConfigurationSlots(weighing)).toContain("targetMassG");
    expect(slotById(weighing, "targetMassG")).toMatchObject({
      kind: "host-composition-only",
      required: true,
      valueType: "number",
    });
    expect(standaloneTechniqueConfigurationBlocker(weighing)).toMatch(/targetMassG/);
    expect(() => applyTechniqueConfiguration(weighing, {})).toThrow(TechniqueConfigurationError);
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
});

describe("standalone evidence is produced, not invented from identifiers", () => {
  it("identifies the three transmittance-dilution evidence defects from the shipped definition", async () => {
    const technique = await readTechnique("transmittance-dilution");
    const issues = auditStandaloneEvidence(technique);
    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "missing-measurement-producer",
      "misleading-final-volume-producer",
      "untyped-dilution-calculation",
    ]));
    expect(issues.some((issue) => issue.configurationSlot === "stockConcentrationMeasurementId"))
      .toBe(true);
    expect(issues.some((issue) => issue.configurationSlot === "finalVolumeMeasurementId"))
      .toBe(true);
    expect(issues.some((issue) => issue.actionId === "transmittance-dilution-calculate-diluted-concentration"))
      .toBe(true);

    const blocker = standaloneTechniqueConfigurationBlocker(technique);
    expect(blocker).toMatch(/standalone evidence path is incomplete/i);
    expect(blocker).toMatch(/identifier substitution alone cannot create/i);
    expect(() => applyTechniqueConfiguration(technique, {})).toThrow(TechniqueConfigurationError);
  });

  it("checks process and success-rule measurement ids, not only action parameters", async () => {
    const weighing = await readTechnique("weighing");
    const issues = auditStandaloneEvidence(weighing);
    const missingSolidMass = issues.find((issue) =>
      issue.code === "missing-measurement-producer" && issue.measurementId === "solid-mass");
    expect(missingSolidMass).toBeDefined();
    expect(missingSolidMass?.message).toMatch(/process validation|success criterion/i);
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
