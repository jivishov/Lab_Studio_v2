import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyTechniqueConfiguration } from "../../data/techniqueConfiguration";
import type { AttachmentRelation, EquipmentInstance, RuntimeState, TechniqueDefinition } from "../../domain/types";
import { createRuntimeState } from "../../runtime";
import { DEFAULT_EMPTY_MASS_G, displayedReading, instrumentDisplay, READOUT_KEY, readingShownFor } from "../adapters/instrumentDisplay";

/**
 * Teacher-prepared readings (decided 2026-09-25): the balance shows the mass on its pan from the
 * teacher's setup, and the photometer a sample's prepared %T once zeroed. Nothing is simulated, and
 * the learner's entry is never checked against the reading.
 */

const readTechnique = (id: string): TechniqueDefinition =>
  JSON.parse(readFileSync(join(process.cwd(), "public", "techniques", `${id}.json`), "utf8")) as TechniqueDefinition;
const T = " ";

const seat = (parent: string, child: string, zoneId: string): AttachmentRelation => ({
  id: `${child}-on-${parent}`, parentInstanceId: parent, childInstanceId: child, zoneId, relationType: "placedOn", renderMode: "independent",
});
const withInstance = (state: RuntimeState, id: string, change: (i: EquipmentInstance) => EquipmentInstance): RuntimeState => ({
  ...state, equipmentInstances: state.equipmentInstances.map((i) => (i.id === id ? change(i) : i)),
});

describe("the balance's reading", () => {
  const weighing = applyTechniqueConfiguration(readTechnique("weighing"), { solidMassG: "2.037", supportEmptyMassG: "31.4" });
  const balance = (state: RuntimeState) => state.equipmentInstances.find((i) => i.id === "analytical-balance-1")!;
  const lines = (state: RuntimeState) => instrumentDisplay("balance-status-and-entry", weighing, state, balance(state)).lines;
  const onPan = (state: RuntimeState): RuntimeState => ({ ...state, attachments: [seat("analytical-balance-1", "watch-glass-1", "analytical-balance-pan")] });
  const zeroed = (state: RuntimeState): RuntimeState => ({ ...state, completedNodes: [...state.completedNodes, "zero-balance-node"] });

  it("reads 0.000 g with nothing on the pan, at the weighing step's precision", () => {
    expect(lines(createRuntimeState(weighing))).toEqual([{ key: READOUT_KEY, text: `0.000${T}g`, source: "teacher" }]);
  });

  it("shows the technique's empty-vessel setting, then zero, then the solid", () => {
    const placed = onPan(createRuntimeState(weighing));
    expect(displayedReading({ instanceId: "", policy: "", lines: lines(placed) })).toBe(`31.400${T}g`);
    expect(displayedReading({ instanceId: "", policy: "", lines: lines(zeroed(placed)) })).toBe(`0.000${T}g`);
    const loaded = withInstance(zeroed(placed), "watch-glass-1", (i) => ({ ...i, contents: { ...i.contents, kind: "solid", massG: 2.037 } }));
    expect(displayedReading({ instanceId: "", policy: "", lines: lines(loaded) })).toBe(`2.037${T}g`);
  });

  it("goes negative when the zeroed glass is lifted off, as a real balance does", () => {
    const lifted = zeroed(createRuntimeState(weighing));
    expect(displayedReading({ instanceId: "", policy: "", lines: lines(lifted) })).toBe(`-31.400${T}g`);
  });

  it("uses the approved default for a vessel the technique sets no mass for", () => {
    expect(DEFAULT_EMPTY_MASS_G).toEqual({ "watch-glass": 30, "weigh-boat": 1.5, "beaker-250ml": 100, "crucible-with-lid": 25 });
    const plain = { ...weighing, actions: weighing.actions.map((a) => a.id === "place-watch-glass"
      ? { ...a, parameters: { ...a.parameters, supportEmptyMassG: undefined as unknown as string } } : a) };
    const state = onPan(createRuntimeState(plain));
    expect(instrumentDisplay("balance-status-and-entry", plain, state, balance(state)).lines[0]?.text).toBe(`30.000${T}g`);
  });

  it("shows no reading, only the learner's entry, when the load cannot be known (a liquid)", () => {
    const wet = withInstance(onPan(createRuntimeState(weighing)), "watch-glass-1", (i) => ({ ...i, contents: { ...i.contents, kind: "liquid", volumeMl: 5 } }));
    expect(lines(wet).some((line) => line.key === READOUT_KEY)).toBe(false);
  });

  it("remembers what the display showed for the reading step's measurement", () => {
    const loaded = withInstance(zeroed(onPan(createRuntimeState(weighing))), "watch-glass-1", (i) => ({ ...i, contents: { ...i.contents, kind: "solid", massG: 2.037 } }));
    const weigh = weighing.actions.find((a) => a.id === "weigh-solid")!;
    expect(readingShownFor(weighing, loaded, weigh, () => "balance-status-and-entry")).toEqual({ measurementId: "standalone-mass-measurement-id", text: `2.037${T}g` });
    const record = weighing.actions.find((a) => a.id === "record-solid-mass")!;
    expect(readingShownFor(weighing, loaded, record, () => "balance-status-and-entry")).toBeUndefined();
  });
});

describe("the photometer's reading", () => {
  const technique = applyTechniqueConfiguration(readTechnique("transmittance-dilution"), {
    stockConcentrationM: "0.2", wavelengthNm: "630", stockAliquotVolumeMl: "5", waterVolumeMl: "10", finalVolumeMl: "15", samplePercentTransmittance: "42.5",
  });
  const photometer = (state: RuntimeState) => state.equipmentInstances.find((i) => i.id === "spectrophotometer-1")!;
  const readout = (state: RuntimeState) => instrumentDisplay("photometer-settings-status-and-entry", technique, state, photometer(state)).lines.find((l) => l.key === READOUT_KEY);
  const blanked = (state: RuntimeState): RuntimeState => ({
    ...state,
    photometerCalibration: { "spectrophotometer-1": { configurationGeneration: 1, blankedGeneration: 1, configuredWavelengthNm: 630, blankedWavelengthNm: 630 } },
  } as unknown as RuntimeState);
  const inSlot = (state: RuntimeState, cuvette: string): RuntimeState => ({ ...state, attachments: [{ ...seat("spectrophotometer-1", cuvette, "spectrophotometer-cuvette-slot"), relationType: "inserted" } as AttachmentRelation] });

  it("shows no reading before it is zeroed", () => {
    expect(readout(inSlot(createRuntimeState(technique), "sample-cuvette-1"))).toBeUndefined();
  });

  it("reads 100 %T for the blank it was zeroed on", () => {
    expect(readout(inSlot(blanked(createRuntimeState(technique)), "blank-cuvette-1"))).toEqual({ key: READOUT_KEY, text: `100${T}%T`, source: "bench" });
  });

  it("reads the teacher's prepared %T for the sample", () => {
    expect(readout(inSlot(blanked(createRuntimeState(technique)), "sample-cuvette-1"))).toEqual({ key: READOUT_KEY, text: `42.5${T}%T`, source: "teacher" });
  });

  it("shows nothing with an empty slot", () => {
    expect(readout(blanked(createRuntimeState(technique)))).toBeUndefined();
  });
});
