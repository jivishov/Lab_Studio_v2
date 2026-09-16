import { describe, expect, it } from "vitest";
import { addDecimal, formatDecimal, parseDecimal } from "../../../../platform/planning/decimal";
import { create96WellPlateDefinition, create96WellPlateState, updateWellState } from "../../plate";
import {
  EIGHT_CHANNEL_P200,
  SINGLE_CHANNEL_P200,
  UNIVERSAL_200_UL_TIP,
  calculateWellResourceConcentration,
  mapMultichannelSelection,
  type ExternalLiquidSourceState,
} from "../../pipetting";
import { executeComplete96WellSerialDilutionFixture } from "../__fixtures__/complete96WellSerialDilution";
import {
  createAssayRuntimeState,
  dispatchAssayRuntimeIntent,
  operationFromIntent,
  reduceAssayRuntime,
  replayAssayOperations,
  validateAssayOperation,
  type AssayOperation,
  type AssayRuntimeIntent,
  type AssayRuntimeState,
} from "..";

const source = (id: string, volume = "1000", mixed = true): ExternalLiquidSourceState => ({
  id,
  kind: "reservoir",
  volume: { value: volume, unit: "uL" },
  components: [{ resourceRef: id, volume: { value: volume, unit: "uL" }, sourceRefs: [id] }],
  mixed,
  contaminationTags: [],
});

const runtime = (options: {
  channels?: 1 | 8;
  sources?: ExternalLiquidSourceState[];
  policy?: Parameters<typeof createAssayRuntimeState>[0]["tipReusePolicy"];
  plateSetup?: (state: ReturnType<typeof create96WellPlateState>) => ReturnType<typeof create96WellPlateState>;
} = {}): AssayRuntimeState => {
  const definition = create96WellPlateDefinition({ id: "runtime-test-plate" });
  const plate = options.plateSetup?.(create96WellPlateState(definition)) ?? create96WellPlateState(definition);
  const pipette = options.channels === 8 ? EIGHT_CHANNEL_P200 : SINGLE_CHANNEL_P200;
  return createAssayRuntimeState({
    runId: "runtime-test",
    plate,
    pipetteDefinitions: [pipette],
    tipDefinitions: [UNIVERSAL_200_UL_TIP],
    liquidSources: options.sources ?? [source("source-a")],
    tipReusePolicy: options.policy,
    selectedPipetteId: pipette.id,
  });
};

const run = (
  state: AssayRuntimeState,
  intent: AssayRuntimeIntent,
  id: string,
): AssayRuntimeState => {
  const transition = dispatchAssayRuntimeIntent(state, intent, id);
  expect(transition.accepted, transition.diagnostics.map(({ message }) => message).join("; ")).toBe(true);
  return transition.state;
};

describe("Cycle 07 operation contract and pipette definitions", () => {
  it("validates the discriminated operation union and rejects wrong versions/parameters", () => {
    const valid = operationFromIntent({ type: "setVolume", pipetteId: SINGLE_CHANNEL_P200.id, volume: { value: "100", unit: "uL" } }, "set-1");
    expect(validateAssayOperation(valid)).toEqual({ ok: true, value: valid, diagnostics: [] });
    const wrongVersion = { ...valid, schemaVersion: "2.0" };
    expect(validateAssayOperation(wrongVersion).ok).toBe(false);
    expect(validateAssayOperation({ ...valid, type: "mix", cycles: 0, target: { kind: "single", coordinate: "A1" } }).ok).toBe(false);
    expect(validateAssayOperation({ ...valid, type: "discard", wasteRef: "" }).ok).toBe(false);
  });

  it("enforces exact min/max/increment properties without mutating rejected state", () => {
    const initial = runtime();
    for (const accepted of ["20", "21", "100", "199", "200"]) {
      expect(dispatchAssayRuntimeIntent(initial, { type: "setVolume", pipetteId: SINGLE_CHANNEL_P200.id, volume: { value: accepted, unit: "uL" } }, `accepted-${accepted}`).accepted).toBe(true);
    }
    for (const rejected of ["19", "20.5", "201"]) {
      const transition = dispatchAssayRuntimeIntent(initial, { type: "setVolume", pipetteId: SINGLE_CHANNEL_P200.id, volume: { value: rejected, unit: "uL" } }, `rejected-${rejected}`);
      expect(transition.accepted).toBe(false);
      expect(transition.state).toBe(initial);
    }
  });

  it("maps channel order explicitly in both orientations and rejects plate overflow", () => {
    expect(mapMultichannelSelection("A3", 8, "vertical").map(({ coordinate }) => coordinate)).toEqual(["A3", "B3", "C3", "D3", "E3", "F3", "G3", "H3"]);
    expect(mapMultichannelSelection("C2", 8, "horizontal").map(({ coordinate }) => coordinate)).toEqual(["C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9"]);
    expect(() => mapMultichannelSelection("B1", 8, "vertical")).toThrow(/leaves the 96-well plate/);
    expect(() => mapMultichannelSelection("A6", 8, "horizontal")).toThrow(/leaves the 96-well plate/);
  });
});

describe("immutable liquid handling reducer", () => {
  it("performs a single-channel transfer with exact component and volume conservation", () => {
    const initial = runtime({ sources: [source("reagent", "500")] });
    let state = run(initial, { type: "setVolume", pipetteId: SINGLE_CHANNEL_P200.id, volume: { value: "100", unit: "uL" } }, "1");
    state = run(state, { type: "attachTips", pipetteId: SINGLE_CHANNEL_P200.id, tipTypeId: UNIVERSAL_200_UL_TIP.id }, "2");
    state = run(state, { type: "aspirate", pipetteId: SINGLE_CHANNEL_P200.id, source: { kind: "shared-source", sourceId: "reagent" } }, "3");
    expect(initial.liquidSources[0].volume.value).toBe("500");
    expect(state.liquidSources[0].volume.value).toBe("400");
    expect(state.pipettes[0].channelContents[0].volume.value).toBe("100");
    state = run(state, { type: "dispense", pipetteId: SINGLE_CHANNEL_P200.id, target: { kind: "single", coordinate: "A1" } }, "4");
    expect(state.plate.wells[0].volume).toEqual({ value: "100", unit: "uL" });
    expect(state.plate.wells[0].components).toEqual([{ resourceRef: "reagent", volume: { value: "100", unit: "uL" }, sourceRefs: ["reagent"] }]);
    expect(state.pipettes[0].channelContents).toEqual([]);
  });

  it("atomically blocks missing tips, unmixed sources, insufficient volume, and overflow", () => {
    const unmixed = runtime({ sources: [source("unmixed", "500", false)] });
    const missingTip = dispatchAssayRuntimeIntent(unmixed, { type: "aspirate", pipetteId: SINGLE_CHANNEL_P200.id, source: { kind: "shared-source", sourceId: "unmixed" } }, "missing-tip");
    expect(missingTip.accepted).toBe(false);
    expect(missingTip.state).toBe(unmixed);
    let withTips = run(unmixed, { type: "attachTips", pipetteId: SINGLE_CHANNEL_P200.id, tipTypeId: UNIVERSAL_200_UL_TIP.id }, "attach");
    const blockedUnmixed = dispatchAssayRuntimeIntent(withTips, { type: "aspirate", pipetteId: SINGLE_CHANNEL_P200.id, source: { kind: "shared-source", sourceId: "unmixed" } }, "unmixed");
    expect(blockedUnmixed.accepted).toBe(false);
    expect(blockedUnmixed.state).toBe(withTips);

    let insufficient = runtime({ channels: 8, sources: [source("small", "799")] });
    insufficient = run(insufficient, { type: "setVolume", pipetteId: EIGHT_CHANNEL_P200.id, volume: { value: "100", unit: "uL" } }, "set");
    insufficient = run(insufficient, { type: "attachTips", pipetteId: EIGHT_CHANNEL_P200.id, tipTypeId: UNIVERSAL_200_UL_TIP.id }, "tips");
    const before = insufficient;
    const rejected = dispatchAssayRuntimeIntent(insufficient, { type: "aspirate", pipetteId: EIGHT_CHANNEL_P200.id, source: { kind: "shared-source", sourceId: "small" } }, "aspirate");
    expect(rejected.accepted).toBe(false);
    expect(rejected.state).toBe(before);
    expect(before.liquidSources[0].volume.value).toBe("799");

    let overflow = runtime({ sources: [source("reagent", "1000")], plateSetup: (plate) => updateWellState(plate, "A1", (well) => ({ ...well, volume: { value: "250", unit: "uL" }, components: [{ resourceRef: "existing", volume: { value: "250", unit: "uL" }, sourceRefs: ["existing"] }], mixed: true, status: "prepared" })) });
    overflow = run(overflow, { type: "setVolume", pipetteId: SINGLE_CHANNEL_P200.id, volume: { value: "100", unit: "uL" } }, "o1");
    overflow = run(overflow, { type: "attachTips", pipetteId: SINGLE_CHANNEL_P200.id, tipTypeId: UNIVERSAL_200_UL_TIP.id }, "o2");
    overflow = run(overflow, { type: "aspirate", pipetteId: SINGLE_CHANNEL_P200.id, source: { kind: "shared-source", sourceId: "reagent" } }, "o3");
    const overflowRejected = dispatchAssayRuntimeIntent(overflow, { type: "dispense", pipetteId: SINGLE_CHANNEL_P200.id, target: { kind: "single", coordinate: "A1" } }, "o4");
    expect(overflowRejected.accepted).toBe(false);
    expect(overflowRejected.state).toBe(overflow);
    expect(overflowRejected.state.plate.wells[0].volume.value).toBe("250");
  });

  it("executes an explicit 8-channel vertical transfer", () => {
    let state = runtime({ channels: 8, sources: [source("reservoir", "1000")] });
    state = run(state, { type: "setVolume", pipetteId: EIGHT_CHANNEL_P200.id, volume: { value: "100", unit: "uL" } }, "1");
    state = run(state, { type: "attachTips", pipetteId: EIGHT_CHANNEL_P200.id, tipTypeId: UNIVERSAL_200_UL_TIP.id }, "2");
    state = run(state, { type: "aspirate", pipetteId: EIGHT_CHANNEL_P200.id, source: { kind: "shared-source", sourceId: "reservoir" } }, "3");
    state = run(state, { type: "dispense", pipetteId: EIGHT_CHANNEL_P200.id, target: { kind: "multichannel", anchor: "A4", orientation: "vertical" } }, "4");
    expect(state.plate.wells.filter(({ coordinate }) => coordinate.endsWith("4")).map(({ volume }) => volume.value)).toEqual(Array(8).fill("100"));
    expect(state.liquidSources[0].volume.value).toBe("200");
  });

  it("enforces explicit tip reuse and emits deterministic contamination warnings/tags when allowed", () => {
    let blocked = runtime({ sources: [source("one"), source("two")], policy: { mode: "same-source", maximumAspirationsPerTip: 3 } });
    blocked = run(blocked, { type: "attachTips", pipetteId: SINGLE_CHANNEL_P200.id, tipTypeId: UNIVERSAL_200_UL_TIP.id }, "b1");
    blocked = run(blocked, { type: "aspirate", pipetteId: SINGLE_CHANNEL_P200.id, source: { kind: "shared-source", sourceId: "one" } }, "b2");
    blocked = run(blocked, { type: "dispense", pipetteId: SINGLE_CHANNEL_P200.id, target: { kind: "single", coordinate: "A1" } }, "b3");
    const sourceChange = dispatchAssayRuntimeIntent(blocked, { type: "aspirate", pipetteId: SINGLE_CHANNEL_P200.id, source: { kind: "shared-source", sourceId: "two" } }, "b4");
    expect(sourceChange.accepted).toBe(false);
    expect(sourceChange.state).toBe(blocked);

    let warned = runtime({ sources: [source("one"), source("two")], policy: { mode: "allow-with-contamination-warning", maximumAspirationsPerTip: 3 } });
    warned = run(warned, { type: "attachTips", pipetteId: SINGLE_CHANNEL_P200.id, tipTypeId: UNIVERSAL_200_UL_TIP.id }, "w1");
    warned = run(warned, { type: "aspirate", pipetteId: SINGLE_CHANNEL_P200.id, source: { kind: "shared-source", sourceId: "one" } }, "w2");
    warned = run(warned, { type: "dispense", pipetteId: SINGLE_CHANNEL_P200.id, target: { kind: "single", coordinate: "A1" } }, "w3");
    const warning = dispatchAssayRuntimeIntent(warned, { type: "aspirate", pipetteId: SINGLE_CHANNEL_P200.id, source: { kind: "shared-source", sourceId: "two" } }, "w4");
    expect(warning.accepted).toBe(true);
    expect(warning.diagnostics.map(({ code }) => code)).toContain("assay.pipetting.contamination.cross-source");
    expect(warning.state.pipettes[0].attachedTips[0].contaminationTags).toContain("cross-source-contact");
    const contaminated = dispatchAssayRuntimeIntent(warning.state, { type: "dispense", pipetteId: SINGLE_CHANNEL_P200.id, target: { kind: "single", coordinate: "A2" } }, "w5");
    expect(contaminated.state.plate.wells.find(({ coordinate }) => coordinate === "A2")?.contaminationTags).toContain("cross-source-contact");
    expect(contaminated.state.plate.wells.find(({ coordinate }) => coordinate === "A2")?.warnings[0].code).toBe("assay.pipetting.contamination-tag");
  });

  it("mixes without changing volume, blocks silent loaded-tip ejection, and supports explicit recovery", () => {
    let state = runtime({ plateSetup: (plate) => updateWellState(plate, "A1", (well) => ({ ...well, volume: { value: "200", unit: "uL" }, components: [{ resourceRef: "sample", volume: { value: "200", unit: "uL" }, sourceRefs: ["sample"] }], mixed: false, status: "prepared" })) });
    state = run(state, { type: "setVolume", pipetteId: SINGLE_CHANNEL_P200.id, volume: { value: "100", unit: "uL" } }, "m1");
    state = run(state, { type: "attachTips", pipetteId: SINGLE_CHANNEL_P200.id, tipTypeId: UNIVERSAL_200_UL_TIP.id }, "m2");
    state = run(state, { type: "mix", pipetteId: SINGLE_CHANNEL_P200.id, target: { kind: "single", coordinate: "A1" }, cycles: 3 }, "m3");
    expect(state.plate.wells[0].mixed).toBe(true);
    expect(state.plate.wells[0].volume.value).toBe("200");
    state = run(state, { type: "ejectTips", pipetteId: SINGLE_CHANNEL_P200.id }, "m4");
    state = run(state, { type: "attachTips", pipetteId: SINGLE_CHANNEL_P200.id, tipTypeId: UNIVERSAL_200_UL_TIP.id }, "m5");
    state = run(state, { type: "aspirate", pipetteId: SINGLE_CHANNEL_P200.id, source: { kind: "single", location: { kind: "well", coordinate: "A1" } } }, "m6");
    const loadedEject = dispatchAssayRuntimeIntent(state, { type: "ejectTips", pipetteId: SINGLE_CHANNEL_P200.id }, "m7");
    expect(loadedEject.accepted).toBe(false);
    expect(loadedEject.state).toBe(state);
    const noConfirmation = dispatchAssayRuntimeIntent(state, { type: "recoverInvalid", pipetteId: SINGLE_CHANNEL_P200.id, confirmDiscard: false }, "m8");
    expect(noConfirmation.accepted).toBe(false);
    const recovered = dispatchAssayRuntimeIntent(state, { type: "recoverInvalid", pipetteId: SINGLE_CHANNEL_P200.id, confirmDiscard: true }, "m9");
    expect(recovered.accepted).toBe(true);
    expect(recovered.state.pipettes[0].status).toBe("idle");
    expect(recovered.evidence.data.explicitConfirmation).toBe(true);
  });
});

describe("deterministic replay and complete 96-well golden execution", () => {
  it("replays the same operation sequence byte-for-byte", () => {
    const initial = runtime({ sources: [source("reagent", "500")] });
    const intents: AssayRuntimeIntent[] = [
      { type: "setVolume", pipetteId: SINGLE_CHANNEL_P200.id, volume: { value: "100", unit: "uL" } },
      { type: "attachTips", pipetteId: SINGLE_CHANNEL_P200.id, tipTypeId: UNIVERSAL_200_UL_TIP.id },
      { type: "aspirate", pipetteId: SINGLE_CHANNEL_P200.id, source: { kind: "shared-source", sourceId: "reagent" } },
      { type: "dispense", pipetteId: SINGLE_CHANNEL_P200.id, target: { kind: "single", coordinate: "A1" } },
      { type: "ejectTips", pipetteId: SINGLE_CHANNEL_P200.id },
    ];
    const operations = intents.map((intent, index) => operationFromIntent(intent, `replay-${index}`));
    const first = replayAssayOperations(initial, operations);
    const second = replayAssayOperations(initial, structuredClone(operations) as AssayOperation[]);
    expect(second).toEqual(first);
    expect(initial.acceptedOperationIds).toEqual([]);
  });

  it("executes all 96 wells through public intents with final discard and exact conservation", () => {
    const result = executeComplete96WellSerialDilutionFixture();
    expect(result.transitions).toHaveLength(137);
    expect(result.transitions.every(({ accepted }) => accepted)).toBe(true);
    expect(result.state.plate.wells).toHaveLength(96);
    expect(result.state.plate.wells.every(({ volume, mixed }) => volume.value === "100" && mixed)).toBe(true);
    expect(result.state.liquidSources[0].volume.value).toBe("400");
    expect(result.state.liquidSources[1].volume.value).toBe("0");
    expect(result.evidence.at(-2)?.operationType).toBe("discard");
    expect(result.evidence.at(-2)?.data.discardedVolume).toBe("800");
    expect(result.state.pipettes[0].status).toBe("idle");

    const plateVolume = result.state.plate.wells.reduce((total, well) => addDecimal(total, parseDecimal(well.volume.value)), parseDecimal("0"));
    const remainingSources = result.state.liquidSources.reduce((total, liquidSource) => addDecimal(total, parseDecimal(liquidSource.volume.value)), parseDecimal("0"));
    const discarded = parseDecimal(String(result.evidence.at(-2)?.data.discardedVolume));
    expect(formatDecimal(addDecimal(addDecimal(plateVolume, remainingSources), discarded))).toBe("10800");
    expect(result.initialState.plate.wells.every(({ status, volume }) => status === "empty" && volume.value === "0")).toBe(true);
    expect(result.initialState.acceptedOperationIds).toEqual([]);

    const expectedConcentrations = [
      "5000", "2500", "1250", "625", "312.5", "156.25",
      "78.125", "39.0625", "19.53125", "9.765625", "4.8828125", "2.44140625",
    ];
    for (const well of result.state.plate.wells) {
      const column = Number(well.coordinate.slice(1));
      expect(calculateWellResourceConcentration(well, "compound-stock")).toEqual({
        value: expectedConcentrations[column - 1],
        unit: "uM",
      });
    }
  });
});
