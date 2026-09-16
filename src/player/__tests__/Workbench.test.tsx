import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ActionInteractionSpec, RuntimeState } from "../../domain/types";
import { createEquipmentInstance } from "../../equipment/catalog";
import { makeAttachmentRelation } from "../../runtime/attachments";
import { Workbench } from "../Workbench";

const rect = (x: number, y: number, width: number, height: number): DOMRect => ({
  bottom: y + height,
  height,
  left: x,
  right: x + width,
  top: y,
  width,
  x,
  y,
  toJSON: () => ({}),
});

describe("Workbench attached-child dragging", () => {
  it("drags the filling funnel independently and completes a workbench drop", () => {
    const stand = {
      ...createEquipmentInstance("ring-stand-clamp"),
      location: "workbench" as const,
      x: 60,
      y: 30,
    };
    const burette = {
      ...createEquipmentInstance("burette-50ml"),
      location: "snapZone" as const,
      snapZoneId: "ring-stand-burette-clamp",
      interactionStatus: "snapped" as const,
    };
    const funnel = {
      ...createEquipmentInstance("funnel"),
      location: "snapZone" as const,
      snapZoneId: "burette-funnel-seat",
      interactionStatus: "snapped" as const,
    };
    const standAttachment = makeAttachmentRelation(
      stand.id,
      burette.id,
      "ring-stand-burette-clamp",
    );
    const funnelAttachment = makeAttachmentRelation(
      burette.id,
      funnel.id,
      "burette-funnel-seat",
    );
    if (!standAttachment || !funnelAttachment) throw new Error("Missing attachment fixture.");
    const state: Pick<RuntimeState, "equipmentInstances" | "attachments"> = {
      equipmentInstances: [stand, burette, funnel],
      attachments: [standAttachment, funnelAttachment],
    };
    const interaction: ActionInteractionSpec = {
      type: "dragToZone",
      sourceDefinitionId: "funnel",
      stationId: "workbench",
      accessibleLabel: "Remove the filling funnel from the burette and place it on the workbench.",
    };
    const onDragToZone = vi.fn(() => true);
    const onMoveInstance = vi.fn();

    render(
      <>
        <Workbench
          expectedInteraction={interaction}
          state={state}
          onDropEquipment={vi.fn()}
          onDragToZone={onDragToZone}
          onInvalidOverlap={vi.fn()}
          onMoveInstance={onMoveInstance}
          onDispenseDrop={() => false}
          onObjectInteraction={() => false}
          onSelectSource={vi.fn()}
          onSelectTarget={vi.fn()}
        />
      </>,
    );

    const bench = screen.getByLabelText("Workbench").querySelector<HTMLElement>(".bench-surface");
    if (!bench) throw new Error("Missing bench fixture.");
    vi.spyOn(bench, "getBoundingClientRect").mockReturnValue(rect(240, 0, 760, 520));

    const funnelHandle = screen.getByRole("button", {
      name: /remove the filling funnel from the burette/i,
    });
    expect(funnelHandle).toHaveAttribute("data-instance-id", funnel.id);
    expect(funnelHandle).toHaveAttribute("data-gesture-drag-kind", "attached-child");
    expect(funnelHandle.closest(".bench-item")).toHaveAttribute("data-instance-id", stand.id);

    fireEvent.pointerDown(funnelHandle, { clientX: 485, clientY: 60, pointerId: 1 });
    fireEvent.pointerMove(funnelHandle, { clientX: 720, clientY: 180, pointerId: 1 });
    fireEvent.pointerUp(funnelHandle, { clientX: 720, clientY: 180, pointerId: 1 });

    expect(onDragToZone).toHaveBeenCalledWith(funnel.id, "workbench");
    expect(onMoveInstance).not.toHaveBeenCalled();
  });
});

describe("Workbench zoom controls", () => {
  it("restores the preference, exposes a two-axis viewport, and locks zoom during a gesture grab", () => {
    window.localStorage.setItem("lab-studio:v1:workbench-zoom", "130");
    render(
      <Workbench
        gestureDrag={{ instanceId: "gesture-fixture", point: { x: 40, y: 40 } }}
        state={{ equipmentInstances: [], attachments: [] }}
        onDropEquipment={vi.fn()}
        onDragToZone={() => false}
        onInvalidOverlap={vi.fn()}
        onMoveInstance={vi.fn()}
        onDispenseDrop={() => false}
        onObjectInteraction={() => false}
        onSelectSource={vi.fn()}
        onSelectTarget={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Workbench zoom level")).toHaveTextContent("130%");
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /fit workbench to view/i })).toBeDisabled();
    expect(
      screen.getByLabelText("Workbench").querySelector(".bench-viewport"),
    ).toHaveAttribute("data-gesture-scroll-region", "both");
  });
});
