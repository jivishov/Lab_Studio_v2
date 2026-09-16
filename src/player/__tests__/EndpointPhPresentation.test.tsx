import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { demoLab } from "../../domain/fixtures";
import type { ActionDefinition, ProcessNode } from "../../domain/types";
import { createEquipmentInstance } from "../../equipment/catalog";
import { createRuntimeState } from "../../runtime";
import { ProcessSidebar } from "../ProcessSidebar";
import { Workbench } from "../Workbench";

const immersionAction: ActionDefinition = {
  id: "immerse-endpoint-ph-probe",
  verb: "place",
  label: "Immerse probe",
  parameters: {},
  interaction: {
    type: "snapIntoTarget",
    sourceDefinitionId: "ph-meter",
    targetDefinitionId: "erlenmeyer-flask-250ml",
    snapZoneId: "erlenmeyer-ph-probe-zone",
    accessibleLabel: "Select the pH meter, select the flask, then confirm Immerse probe.",
  },
  prerequisites: [],
  stateChanges: [],
  invalidCases: [],
  feedback: { success: "Immersed.", invalid: "Use the probe zone." },
  evidence: ["place"],
};

const nodeFor = (action: ActionDefinition): ProcessNode => ({
  id: `${action.id}-node`,
  type: "action",
  title: action.label,
  description: action.interaction?.accessibleLabel ?? action.label,
  actionId: action.id,
  config: {},
  validation: [],
  hints: [],
  feedback: { success: "Done.", retry: "Try again." },
});

const sidebarProps = (action: ActionDefinition) => {
  const currentNode = nodeFor(action);
  return {
    action,
    actionInputValue: "",
    currentNode,
    interaction: action.interaction,
    nodeCompleted: false,
    onAcceptDispenseEndpoint: vi.fn(),
    onActionInputChange: vi.fn(),
    onConfirmAccessibleAction: vi.fn(),
    onDispenseDrop: vi.fn(),
    onRecordEvidence: vi.fn(),
    onRecordTimeSeries: vi.fn(),
    onSubmitCalculation: vi.fn(),
    process: { startNodeId: currentNode.id, nodes: [currentNode], edges: [] },
    state: createRuntimeState(demoLab),
  };
};

describe("endpoint pH player presentation", () => {
  it("keeps the pH meter on the shelf until its explicit placement step", () => {
    const definition = JSON.parse(
      readFileSync(resolve(process.cwd(), "public/labs/acid-base-titration.json"), "utf8"),
    ) as {
      initialState: { equipment: Array<{ id: string; location: string }> };
      techniques: Array<{ initialState: { equipment: Array<{ id: string; location: string }> } }>;
      process: {
        edges: Array<{ from: string; to: string }>;
      };
    };
    const initialStates = [
      definition.initialState,
      ...definition.techniques.map((technique) => technique.initialState),
    ];

    expect(
      initialStates.map((state) =>
        state.equipment.find((equipment) => equipment.id === "ph-meter-1")?.location,
      ),
    ).toEqual(initialStates.map(() => "shelf"));
    expect(definition.process.edges).toContainEqual({
      from: "confirm-endpoint-node",
      to: "place-ph-meter-on-workbench-node",
      label: "Next",
      condition: { type: "validationPassed" },
    });
  });

  it("provides the select-meter, select-flask, Immerse probe keyboard/touch path", () => {
    const props = sidebarProps(immersionAction);
    render(
      <ProcessSidebar
        {...props}
        selectedSource="ph-meter-1"
        selectedTarget="erlenmeyer-flask-250ml-1"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /immerse probe/i }));
    expect(props.onConfirmAccessibleAction).toHaveBeenCalledOnce();
  });

  it("renders a probe manipulation handle on the meter without turning the meter body into the probe", () => {
    const meter = { ...createEquipmentInstance("ph-meter", "1", "workbench"), x: 20, y: 20 };
    const flask = { ...createEquipmentInstance("erlenmeyer-flask-250ml", "1", "workbench"), x: 220, y: 40 };
    const selectSource = vi.fn();
    render(
      <Workbench
        state={{ equipmentInstances: [meter, flask], attachments: [] }}
        expectedInteraction={immersionAction.interaction}
        onDropEquipment={vi.fn()}
        onInvalidOverlap={vi.fn()}
        onDragToZone={vi.fn(() => false)}
        onMoveInstance={vi.fn()}
        onDispenseDrop={vi.fn(() => false)}
        onObjectInteraction={vi.fn(() => true)}
        onSelectSource={selectSource}
        onSelectTarget={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /pH probe handle/i }));
    expect(selectSource).toHaveBeenCalledWith("ph-meter-1");
  });

  it("exposes the live gesture probe lead for frame-loop path updates", () => {
    const meter = { ...createEquipmentInstance("ph-meter", "1", "workbench"), x: 20, y: 20 };
    const flask = { ...createEquipmentInstance("erlenmeyer-flask-250ml", "1", "workbench"), x: 220, y: 40 };
    const { container } = render(
      <Workbench
        state={{ equipmentInstances: [meter, flask], attachments: [] }}
        expectedInteraction={immersionAction.interaction}
        gestureDrag={{ kind: "probe", instanceId: "ph-meter-1", point: { x: 160, y: 120 } }}
        onDropEquipment={vi.fn()}
        onInvalidOverlap={vi.fn()}
        onDragToZone={vi.fn(() => false)}
        onMoveInstance={vi.fn()}
        onDispenseDrop={vi.fn(() => false)}
        onObjectInteraction={vi.fn(() => true)}
        onSelectSource={vi.fn()}
        onSelectTarget={vi.fn()}
      />,
    );

    const lead = container.querySelector<SVGSVGElement>(
      '.ph-probe-lead[data-probe-lead-instance-id="ph-meter-1"]',
    );
    expect(lead).not.toBeNull();
    expect(Number.isFinite(Number(lead?.dataset.probeLeadFromX))).toBe(true);
    expect(Number.isFinite(Number(lead?.dataset.probeLeadFromY))).toBe(true);
    expect(lead?.querySelectorAll("path")).toHaveLength(2);
  });

  it("keeps exactly one probe immersed after the step advances to Read pH", () => {
    const meter = {
      ...createEquipmentInstance("ph-meter", "1", "workbench"),
      x: 20,
      y: 20,
      contents: {
        ...createEquipmentInstance("ph-meter", "1", "workbench").contents,
        probeImmersedInInstanceId: "erlenmeyer-flask-250ml-1",
      },
    };
    const flask = { ...createEquipmentInstance("erlenmeyer-flask-250ml", "1", "workbench"), x: 220, y: 40 };
    const readInteraction = {
      type: "readInstrument" as const,
      sourceDefinitionId: "ph-meter",
      targetDefinitionId: "erlenmeyer-flask-250ml",
      stationId: "ph-meter",
      accessibleLabel: "Read pH.",
    };
    const { container } = render(
      <Workbench
        state={{ equipmentInstances: [meter, flask], attachments: [] }}
        expectedInteraction={readInteraction}
        onDropEquipment={vi.fn()}
        onInvalidOverlap={vi.fn()}
        onDragToZone={vi.fn(() => false)}
        onMoveInstance={vi.fn()}
        onDispenseDrop={vi.fn(() => false)}
        onObjectInteraction={vi.fn(() => true)}
        onSelectSource={vi.fn()}
        onSelectTarget={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /pH probe handle/i })).toBeNull();
    expect(container.querySelector('img[src*="ph-meter-probe-detached-console"]')).not.toBeNull();
    expect(container.querySelectorAll(".ph-probe-under-liquid")).toHaveLength(1);
    expect(container.querySelectorAll(".ph-probe-art")).toHaveLength(0);
  });

  it("announces accepted-endpoint and expected-equivalence predictions separately", () => {
    const readAction: ActionDefinition = {
      ...immersionAction,
      id: "read-endpoint-ph",
      verb: "observe",
      label: "Read accepted-endpoint pH",
      parameters: {
        measurementId: "endpoint-ph",
        phReadingMode: "acceptedEndpoint",
        phPrecision: 2,
        theoreticalEquivalenceVolumeMl: 24.8,
        idealEquivalencePh: 8.7267,
      },
      interaction: {
        type: "readInstrument",
        sourceDefinitionId: "ph-meter",
        targetDefinitionId: "erlenmeyer-flask-250ml",
        stationId: "ph-meter",
        accessibleLabel: "Read endpoint pH.",
      },
    };
    const props = sidebarProps(readAction);
    const state = {
      ...props.state,
      measurements: [
        { id: "endpoint-ph", label: "Accepted-endpoint pH", value: 8.73, unit: "pH", nodeId: "read-node" },
      ],
      equipmentInstances: props.state.equipmentInstances.map((instance) =>
        instance.definitionId === "ph-meter"
          ? {
              ...instance,
              contents: {
                ...instance.contents,
                instrumentReadout: {
                  quantity: "pH" as const,
                  value: 8.73,
                  unit: "pH" as const,
                  precision: 2,
                  provenance: "simulator-generated" as const,
                  acceptedTitrantVolumeMl: 24.8,
                  idealEquivalenceVolumeMl: 24.8,
                  idealEquivalencePh: 8.73,
                },
              },
            }
          : instance,
      ),
    };
    render(<ProcessSidebar {...props} state={state} />);

    const consoleReadout = screen.getByLabelText(/endpoint pH simulator readout/i);
    expect(consoleReadout).toHaveAttribute("aria-live", "polite");
    expect(consoleReadout).toHaveTextContent(/accepted endpoint/i);
    expect(consoleReadout).toHaveTextContent(/expected equivalence/i);
    expect(consoleReadout).toHaveTextContent(/8\.73/);
    expect(consoleReadout).toHaveTextContent(/not a real meter measurement/i);
  });

  it("keeps invalid-target recovery visible beside the immersion controls", () => {
    const props = sidebarProps(immersionAction);
    render(
      <ProcessSidebar
        {...props}
        invalidFeedback={{ reason: "invalidTarget", message: "That is not the flask probe zone.", recovery: "Select the endpoint flask and try again." }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/endpoint flask and try again/i);
  });
});
