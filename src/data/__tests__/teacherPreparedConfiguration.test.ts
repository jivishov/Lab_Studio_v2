import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { TechniqueDefinition } from "../../domain/types";
import { validateTechniqueDefinition } from "../../domain/validation";
import { actionInputField } from "../../runtime/actionInputs";
import { applyTechniqueConfiguration, configurationSlots, unresolvedConfigurationSlots } from "../techniqueConfiguration";

/**
 * Teacher-prepared values (decided 2026-09-25): amounts, a vessel's empty mass, a stock and a
 * sample's %T are set up before play, and setup refuses values the procedure cannot perform.
 */

const readTechnique = (id: string): TechniqueDefinition =>
  JSON.parse(readFileSync(join(process.cwd(), "public", "techniques", `${id}.json`), "utf8")) as TechniqueDefinition;
const fails = (fn: () => unknown): string => { try { fn(); return ""; } catch (e) { return e instanceof Error ? e.message : String(e); } };

describe("weighing's setup", () => {
  const weighing = readTechnique("weighing");

  it("finds the bottle's stock in the starting contents, as a teacher quantity with its default", () => {
    const stock = configurationSlots(weighing).find((s) => s.id === "reagentStockMassG");
    expect(stock).toMatchObject({ kind: "classroom-quantity", unit: "g", defaultValue: 10 });
    expect(unresolvedConfigurationSlots(weighing)).toContain("reagentStockMassG");
  });

  it("asks for the amount, which has no default", () => {
    expect(configurationSlots(weighing).find((s) => s.id === "solidMassG")).toMatchObject({ kind: "classroom-quantity", unit: "g" });
    expect(configurationSlots(weighing).find((s) => s.id === "solidMassG")?.defaultValue).toBeUndefined();
    expect(fails(() => applyTechniqueConfiguration(weighing, {}))).toMatch(/Supply the approved classroom value/);
  });

  it("refuses an amount above the stock, and a zero amount", () => {
    expect(fails(() => applyTechniqueConfiguration(weighing, { solidMassG: "12" }))).toMatch(/exceeds the reagent-bottle-1 starting mass of 10 g/);
    expect(fails(() => applyTechniqueConfiguration(weighing, { solidMassG: "0" }))).toMatch(/greater than zero/);
    expect(fails(() => applyTechniqueConfiguration(weighing, { solidMassG: "12", reagentStockMassG: "20" }))).toBe("");
  });

  it("writes the teacher's values where the procedure uses them, and states the amount in the instruction", () => {
    const configured = applyTechniqueConfiguration(weighing, { solidMassG: "2.037" });
    expect(configured.initialState.equipment.find((e) => e.id === "reagent-bottle-1")?.contents.massG).toBe(10);
    expect(configured.actions.find((a) => a.id === "transfer-sodium-carbonate-to-watch-glass")?.parameters.massG).toBe(2.037);
    expect(configured.actions.find((a) => a.id === "place-watch-glass")?.parameters.supportEmptyMassG).toBe(30);
    expect(configured.process.nodes.find((n) => n.id === "transfer-sodium-carbonate-node")?.description)
      .toBe("Transfer 2.037 g of sodium carbonate from the reagent bottle onto the watch glass.");
    expect(configured.process.nodes.map((n) => n.actionId)).toEqual([
      "place-watch-glass", "zero-balance", "transfer-sodium-carbonate-to-watch-glass", "weigh-solid", "record-solid-mass",
    ]);
  });
});

describe("transmittance-dilution's setup", () => {
  const technique = readTechnique("transmittance-dilution");
  const values = { stockConcentrationM: "0.2", wavelengthNm: "630", stockAliquotVolumeMl: "5", waterVolumeMl: "10", finalVolumeMl: "15", samplePercentTransmittance: "42.5" };

  it("validates as published, with the volumes still slot references", () => {
    const result = validateTechniqueDefinition(technique);
    expect(result.ok, result.errors.join("\n")).toBe(true);
  });

  it("sets the three volumes up in advance: no field asks for them during play", () => {
    const configured = applyTechniqueConfiguration(technique, values);
    for (const id of ["measure-stock-dye", "measure-water-volume", "add-water-below-mark"]) {
      const action = configured.actions.find((a) => a.id === `transmittance-dilution-${id}`)!;
      expect(action.volume?.source).toBe("literal");
      expect(actionInputField(action)).toBeFalsy();
    }
    expect(configured.actions.find((a) => a.id === "transmittance-dilution-read-percent-transmittance")?.parameters.teacherPreparedReading).toBe(42.5);
  });

  it("refuses volumes the dilution cannot perform, and %T outside (0, 100]", () => {
    expect(fails(() => applyTechniqueConfiguration(technique, { ...values, finalVolumeMl: "5" }))).toMatch(/greater than the stock aliquot/);
    expect(fails(() => applyTechniqueConfiguration(technique, { ...values, waterVolumeMl: "4" }))).toMatch(/waterVolumeMl must cover/);
    expect(fails(() => applyTechniqueConfiguration(technique, { ...values, finalVolumeMl: "25", waterVolumeMl: "30" }))).toMatch(/exceeds the test-tube capacity of 20 mL/);
    expect(fails(() => applyTechniqueConfiguration(technique, { ...values, samplePercentTransmittance: "0" }))).toMatch(/greater than zero/);
    expect(fails(() => applyTechniqueConfiguration(technique, { ...values, samplePercentTransmittance: "120" }))).toMatch(/at most 100 %T/);
    expect(fails(() => applyTechniqueConfiguration(technique, { ...values, samplePercentTransmittance: "100" }))).toBe("");
  });

  it("keeps the prepared %T out of every instruction", () => {
    const configured = applyTechniqueConfiguration(technique, values);
    expect(configured.process.nodes.some((n) => String(n.description).includes("42.5"))).toBe(false);
  });
});

describe("a literal volume may name a setup slot", () => {
  const base = readTechnique("transmittance-dilution");
  const withVolume = (valueMl: unknown) => ({
    ...base,
    actions: base.actions.map((a) => a.id === "transmittance-dilution-measure-stock-dye" ? { ...a, volume: { ...a.volume, source: "literal", valueMl } } : a),
  }) as unknown as TechniqueDefinition;

  it("accepts a slot reference and a positive number, and refuses any other string", () => {
    expect(validateTechniqueDefinition(withVolume("{{config.stockAliquotVolumeMl}}")).ok).toBe(true);
    expect(validateTechniqueDefinition(withVolume(5)).ok).toBe(true);
    expect(validateTechniqueDefinition(withVolume("five")).errors.join(" ")).toMatch(/valueMl must be a positive finite number or a/);
  });
});
