import { create96WellPlateDefinition, create96WellPlateState } from "../../plate";
import { EIGHT_CHANNEL_P200, UNIVERSAL_200_UL_TIP, type ExternalLiquidSourceState } from "../../pipetting";
import {
  createAssayRuntimeState,
  dispatchAssayRuntimeIntent,
  operationFromIntent,
  type AssayOperation,
  type AssayOperationEvidence,
  type AssayRuntimeIntent,
  type AssayRuntimeState,
  type AssayRuntimeTransition,
} from "..";

export interface Complete96WellSerialDilutionFixtureResult {
  initialState: AssayRuntimeState;
  state: AssayRuntimeState;
  operations: AssayOperation[];
  transitions: AssayRuntimeTransition[];
  evidence: AssayOperationEvidence[];
}

export const createComplete96WellSerialDilutionInitialState = (): AssayRuntimeState => {
  const definition = create96WellPlateDefinition({ id: "cycle07-complete-plate" });
  const plate = create96WellPlateState(definition);
  const diluent: ExternalLiquidSourceState = {
    id: "diluent-reservoir",
    kind: "reservoir",
    volume: { value: "10000", unit: "uL" },
    components: [{
      resourceRef: "diluent",
      volume: { value: "10000", unit: "uL" },
      sourceRefs: ["diluent-reservoir"],
    }],
    mixed: true,
    contaminationTags: [],
  };
  const compoundStock: ExternalLiquidSourceState = {
    id: "compound-stock",
    kind: "reservoir",
    volume: { value: "800", unit: "uL" },
    components: [{
      resourceRef: "compound-stock",
      volume: { value: "800", unit: "uL" },
      concentration: { value: "10000", unit: "uM" },
      sourceRefs: ["compound-stock"],
    }],
    mixed: true,
    contaminationTags: [],
  };
  return createAssayRuntimeState({
    runId: "cycle07-complete-96-well",
    plate,
    pipetteDefinitions: [EIGHT_CHANNEL_P200],
    tipDefinitions: [UNIVERSAL_200_UL_TIP],
    liquidSources: [diluent, compoundStock],
    tipReusePolicy: { mode: "single-aspiration" },
    selectedPipetteId: EIGHT_CHANNEL_P200.id,
  });
};

export const executeComplete96WellSerialDilutionFixture = (): Complete96WellSerialDilutionFixtureResult => {
  const initialState = createComplete96WellSerialDilutionInitialState();
  let state = initialState;
  const operations: AssayOperation[] = [];
  const transitions: AssayRuntimeTransition[] = [];
  let sequence = 0;
  const execute = (intent: AssayRuntimeIntent): void => {
    sequence += 1;
    const operation = operationFromIntent(
      intent,
      `cycle07-golden:${String(sequence).padStart(3, "0")}`,
    );
    const transition = dispatchAssayRuntimeIntent(
      state,
      intent,
      operation.operationId,
    );
    if (!transition.accepted) {
      throw new Error(`Golden operation ${sequence} failed: ${transition.diagnostics.map(({ code, message }) => `${code}: ${message}`).join("; ")}`);
    }
    operations.push(operation);
    transitions.push(transition);
    state = transition.state;
  };
  const pipetteId = EIGHT_CHANNEL_P200.id;
  const tipTypeId = UNIVERSAL_200_UL_TIP.id;
  execute({ type: "setVolume", pipetteId, volume: { value: "100", unit: "uL" } });

  for (let column = 1; column <= 12; column += 1) {
    execute({ type: "attachTips", pipetteId, tipTypeId });
    execute({ type: "aspirate", pipetteId, source: { kind: "shared-source", sourceId: "diluent-reservoir" } });
    execute({ type: "dispense", pipetteId, target: { kind: "multichannel", anchor: `A${column}`, orientation: "vertical" } });
    execute({ type: "ejectTips", pipetteId });
  }

  execute({ type: "attachTips", pipetteId, tipTypeId });
  execute({ type: "aspirate", pipetteId, source: { kind: "shared-source", sourceId: "compound-stock" } });
  execute({ type: "dispense", pipetteId, target: { kind: "multichannel", anchor: "A1", orientation: "vertical" } });
  execute({ type: "ejectTips", pipetteId });
  execute({ type: "attachTips", pipetteId, tipTypeId });
  execute({ type: "mix", pipetteId, target: { kind: "multichannel", anchor: "A1", orientation: "vertical" }, cycles: 3 });
  execute({ type: "ejectTips", pipetteId });

  for (let column = 1; column < 12; column += 1) {
    execute({ type: "attachTips", pipetteId, tipTypeId });
    execute({ type: "aspirate", pipetteId, source: { kind: "plate-multichannel", anchor: `A${column}`, orientation: "vertical" } });
    execute({ type: "dispense", pipetteId, target: { kind: "multichannel", anchor: `A${column + 1}`, orientation: "vertical" } });
    execute({ type: "ejectTips", pipetteId });
    execute({ type: "attachTips", pipetteId, tipTypeId });
    execute({ type: "mix", pipetteId, target: { kind: "multichannel", anchor: `A${column + 1}`, orientation: "vertical" }, cycles: 3 });
    execute({ type: "ejectTips", pipetteId });
  }

  execute({ type: "attachTips", pipetteId, tipTypeId });
  execute({ type: "aspirate", pipetteId, source: { kind: "plate-multichannel", anchor: "A12", orientation: "vertical" } });
  execute({ type: "discard", pipetteId, wasteRef: "liquid-waste" });
  execute({ type: "ejectTips", pipetteId });
  return {
    initialState,
    state,
    operations,
    transitions,
    evidence: transitions.map(({ evidence }) => evidence),
  };
};
