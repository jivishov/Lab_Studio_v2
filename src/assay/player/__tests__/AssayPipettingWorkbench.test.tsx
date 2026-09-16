import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_TIP_REUSE_POLICY,
  EIGHT_CHANNEL_P200,
  micropipetteDefinitions,
  pipetteTipDefinitions,
  SINGLE_CHANNEL_P200,
  createPipetteRuntimeState,
} from "../../../domain-packs/assay/pipetting";
import { create96WellPlateDefinition, create96WellPlateState } from "../../../domain-packs/assay/plate";
import type {
  AssayRuntimeState,
  AssayRuntimeTransition,
} from "../../../domain-packs/assay/runtime";
import {
  AssayPipettingRehearsal,
  AssayPipettingWorkbench,
} from "../AssayPipettingRehearsal";

const createState = (selectedPipetteId = SINGLE_CHANNEL_P200.id): AssayRuntimeState => ({
  schema: "assay-studio.runtime-state",
  schemaVersion: "1.0",
  runId: "ui-rehearsal-test",
  plate: create96WellPlateState(create96WellPlateDefinition({ id: "ui-test-plate" })),
  pipetteDefinitions: structuredClone([...micropipetteDefinitions]),
  tipDefinitions: structuredClone([...pipetteTipDefinitions]),
  pipettes: micropipetteDefinitions.map((definition) => createPipetteRuntimeState(definition)),
  liquidSources: [{
    id: "stock-source",
    kind: "reservoir",
    volume: { value: "1000", unit: "uL" },
    components: [{
      resourceRef: "stock",
      volume: { value: "1000", unit: "uL" },
      concentration: { value: "10", unit: "umol" },
      sourceRefs: ["stock-source"],
    }],
    mixed: true,
    contaminationTags: [],
  }],
  tipReusePolicy: structuredClone(DEFAULT_TIP_REUSE_POLICY),
  selectedPipetteId,
  acceptedOperationIds: [],
});

const transition = (
  state: AssayRuntimeState,
  accepted: boolean,
  message: string,
): AssayRuntimeTransition => ({
  state,
  accepted,
  diagnostics: accepted ? [] : [{
    code: "assay.pipette.volume.out-of-range",
    severity: "error",
    message,
    operationId: "operation-invalid",
    recovery: "Choose a volume within the selected pipette range.",
    objectRefs: [state.selectedPipetteId],
  }],
  evidence: {
    typeId: "assay.pipetting-operation",
    typeVersion: "1.0.0",
    operationId: accepted ? "operation-accepted" : "operation-invalid",
    operationType: "setVolume",
    outcome: accepted ? "accepted" : "rejected",
    summary: accepted ? "Pipette volume set." : "Pipette volume was rejected.",
    objectRefs: [state.selectedPipetteId],
    data: { volume: accepted ? "50 uL" : "500 uL" },
  },
});

describe("AssayPipettingWorkbench", () => {
  it("shows explicit orientation, pipette state, native controls, and an empty trace", () => {
    render(<AssayPipettingWorkbench state={createState()} onIntent={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Pipetting rehearsal" })).toBeInTheDocument();
    expect(screen.getByLabelText("Plate orientation A1 top-left")).toHaveTextContent("A1 top-left");
    expect(screen.getByLabelText("Selected pipette")).toHaveValue(SINGLE_CHANNEL_P200.id);
    expect(screen.getByLabelText("Volume in microliters")).toHaveValue("20");
    expect(screen.getByLabelText("Channel orientation")).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Ready");
    expect(screen.getByText("No liquid-handling operations have been attempted.")).toBeInTheDocument();
  });

  it("dispatches the identical attach-tip intent for pointer and native keyboard activation", () => {
    const onIntent = vi.fn();
    render(<AssayPipettingWorkbench state={createState()} onIntent={onIntent} />);
    const button = screen.getByRole("button", { name: "Attach tip" });

    fireEvent.click(button, { detail: 1 });
    const pointerIntent = onIntent.mock.calls.at(-1)?.[0];
    onIntent.mockClear();

    button.focus();
    fireEvent.keyDown(button, { key: "Enter" });
    fireEvent.click(button, { detail: 0 });
    fireEvent.keyUp(button, { key: "Enter" });
    const keyboardIntent = onIntent.mock.calls.at(-1)?.[0];

    expect(keyboardIntent).toEqual(pointerIntent);
    expect(keyboardIntent).toEqual({
      type: "attachTips",
      pipetteId: SINGLE_CHANNEL_P200.id,
      tipTypeId: pipetteTipDefinitions[0].id,
    });
  });

  it("sends exact single-channel setup and transfer selections without editing scientific state", () => {
    const state = createState();
    const onIntent = vi.fn();
    render(<AssayPipettingWorkbench state={state} onIntent={onIntent} />);

    fireEvent.change(screen.getByLabelText("Volume in microliters"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "Set volume" }));
    fireEvent.change(screen.getByLabelText("Transfer source"), { target: { value: "source:stock-source" } });
    fireEvent.change(screen.getByLabelText("Target well or anchor"), { target: { value: "B2" } });
    fireEvent.click(screen.getByRole("button", { name: "Aspirate" }));
    fireEvent.click(screen.getByRole("button", { name: "Dispense" }));
    fireEvent.click(screen.getByRole("button", { name: "Mix 3 cycles" }));

    expect(onIntent.mock.calls.map(([intent]) => intent)).toEqual([
      { type: "setVolume", pipetteId: SINGLE_CHANNEL_P200.id, volume: { value: "50", unit: "uL" } },
      {
        type: "aspirate",
        pipetteId: SINGLE_CHANNEL_P200.id,
        source: { kind: "single", location: { kind: "source", sourceId: "stock-source" } },
      },
      {
        type: "dispense",
        pipetteId: SINGLE_CHANNEL_P200.id,
        target: { kind: "single", coordinate: "B2" },
      },
      {
        type: "mix",
        pipetteId: SINGLE_CHANNEL_P200.id,
        target: { kind: "single", coordinate: "B2" },
        cycles: 3,
      },
    ]);
    expect(state.pipettes[0].setVolume.value).toBe("20");
    expect(state.plate.wells.find(({ coordinate }) => coordinate === "B2")?.volume.value).toBe("0");
  });

  it("makes 8-channel orientation and anchored mapping explicit in intents", () => {
    const state = createState(EIGHT_CHANNEL_P200.id);
    const onIntent = vi.fn();
    render(<AssayPipettingWorkbench state={state} onIntent={onIntent} />);

    fireEvent.change(screen.getByLabelText("Transfer source"), { target: { value: "well:A1" } });
    fireEvent.change(screen.getByLabelText("Target well or anchor"), { target: { value: "B2" } });
    fireEvent.change(screen.getByLabelText("Channel orientation"), { target: { value: "horizontal" } });
    fireEvent.click(screen.getByRole("button", { name: "Aspirate" }));
    fireEvent.click(screen.getByRole("button", { name: "Dispense" }));

    expect(onIntent.mock.calls.map(([intent]) => intent)).toEqual([
      {
        type: "aspirate",
        pipetteId: EIGHT_CHANNEL_P200.id,
        source: { kind: "plate-multichannel", anchor: "A1", orientation: "horizontal" },
      },
      {
        type: "dispense",
        pipetteId: EIGHT_CHANNEL_P200.id,
        target: { kind: "multichannel", anchor: "B2", orientation: "horizontal" },
      },
    ]);
    expect(screen.getByText("Channel 1 begins at B2; mapping is horizontal.")).toBeInTheDocument();
  });

  it("announces rejected runtime feedback and exposes the exact evidence trace as a table", () => {
    const state = createState();
    const rejected = transition(state, false, "500 uL exceeds the selected pipette maximum.");
    render(
      <AssayPipettingWorkbench
        lastTransition={rejected}
        onIntent={vi.fn()}
        state={state}
        transitions={[transition(state, true, ""), rejected]}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("500 uL exceeds the selected pipette maximum.");
    const trace = screen.getByRole("table", {
      name: "Accepted and rejected runtime operations in attempted order",
    });
    expect(trace).toHaveTextContent("accepted");
    expect(trace).toHaveTextContent("rejected");
    expect(trace).toHaveTextContent("volume: 500 uL");
  });

  it("routes pointer and native keyboard activation through the same runtime transition", () => {
    const pointerTransition = vi.fn();
    const pointer = render(
      <AssayPipettingRehearsal
        initialState={createState()}
        onTransition={pointerTransition}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Attach tip" }), { detail: 1 });
    const pointerResult = pointerTransition.mock.calls[0]?.[0] as AssayRuntimeTransition;
    pointer.unmount();

    const keyboardTransition = vi.fn();
    render(
      <AssayPipettingRehearsal
        initialState={createState()}
        onTransition={keyboardTransition}
      />,
    );
    const keyboardButton = screen.getByRole("button", { name: "Attach tip" });
    keyboardButton.focus();
    fireEvent.keyDown(keyboardButton, { key: "Enter" });
    fireEvent.click(keyboardButton, { detail: 0 });
    fireEvent.keyUp(keyboardButton, { key: "Enter" });
    const keyboardResult = keyboardTransition.mock.calls[0]?.[0] as AssayRuntimeTransition;

    expect(pointerResult.accepted).toBe(true);
    expect(keyboardResult).toEqual(pointerResult);
    expect(screen.getByLabelText("Pipette runtime state")).toHaveTextContent("1 tip");
  });

  it("announces an invalid volume from the reducer without partially changing pipette state", () => {
    const onTransition = vi.fn();
    render(
      <AssayPipettingRehearsal
        initialState={createState()}
        onTransition={onTransition}
      />,
    );

    fireEvent.change(screen.getByLabelText("Volume in microliters"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: "Set volume" }));

    const result = onTransition.mock.calls[0]?.[0] as AssayRuntimeTransition;
    expect(result.accepted).toBe(false);
    expect(result.state.pipettes[0].setVolume.value).toBe("20");
    expect(screen.getByRole("alert")).toHaveTextContent("Volume must be within 20-200 uL.");
    expect(screen.getByLabelText("Pipette runtime state")).toHaveTextContent("20 uL");
    expect(screen.getByRole("table", {
      name: "Accepted and rejected runtime operations in attempted order",
    })).toHaveTextContent("rejected");
  });

  it("serializes rapid sequential intents against the latest accepted runtime state", () => {
    const onTransition = vi.fn();
    render(
      <AssayPipettingRehearsal
        initialState={createState()}
        onTransition={onTransition}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Attach tip" }));
    fireEvent.click(screen.getByRole("button", { name: "Aspirate" }));
    fireEvent.click(screen.getByRole("button", { name: "Dispense" }));
    fireEvent.click(screen.getByRole("button", { name: "Eject tip" }));
    fireEvent.click(screen.getByRole("button", { name: "Attach tip" }));
    fireEvent.click(screen.getByRole("button", { name: "Mix 3 cycles" }));

    const transitions = onTransition.mock.calls.map(([result]) => result as AssayRuntimeTransition);
    expect(transitions).toHaveLength(6);
    expect(transitions.every(({ accepted }) => accepted)).toBe(true);
    expect(transitions.at(-1)?.state.plate.wells[0]).toMatchObject({
      coordinate: "A1",
      mixed: true,
      volume: { value: "20", unit: "uL" },
    });
  });
});
