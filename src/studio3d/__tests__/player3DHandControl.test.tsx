import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { filtrationTechnique } from "../../domain/fixtures";
import { HAND_DEFAULTS, setHandSettings } from "../hand/handTuning";
import type { HandControlState } from "../hand/useHandControl";
import { handBadge, handGuide, type HandGuideContext } from "../player/HandControlPanel";
import { Player3D } from "../player/Player3D";
import type { Player3DController } from "../player/usePlayer3D";

/**
 * Player3D's hand control panel after the microarray adoption (P4, decided 2026-10-04). jsdom has no
 * WebGL or camera, so the bench shows its fallback and the camera never starts: these cases cover
 * the dock button, the panel, its set-up tracker, settings and wording, and the guide line. Written,
 * not run.
 */

const player = (onPlayer?: (player: Player3DController) => void) => (
  <Player3D definition={filtrationTechnique} title="Filter a Precipitate" sourceTag="TECHNIQUE · PACK 1"
    fallbackHash="#/technique/filtration" backHref="#/3d" onPlayer={onPlayer} />
);

const base: HandControlState = {
  running: true, status: "", error: false, profiles: { rest: [0], press: [1] }, calibrated: true, homeSet: true, pinchSeen: true,
  seenAt: 1000, backend: "", settings: { ...HAND_DEFAULTS }, preference: "Auto",
};
const idle: HandGuideContext = { carrying: false, dropMode: false, invertHolding: false, locked: false, draw: false, squeeze: false, keyLocked: false };

describe("Player3D hand control panel", () => {
  beforeEach(() => { localStorage.clear(); setHandSettings({ ...HAND_DEFAULTS }); });

  it("opens from the dock without starting the camera, shows the set-up tracker and privacy note, and closes", () => {
    render(player());
    const dock = screen.getByRole("button", { name: "Hand control" });
    expect(dock).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(dock);
    const panel = screen.getByRole("region", { name: "Hand control" });
    expect(panel).toHaveTextContent("Frames are processed locally in the browser. They are not saved, exported, serialized to lab state, or sent to the backend.");
    expect(within(panel).getByRole("button", { name: /Start camera/ })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Capture Rest" })).toBeDisabled();
    expect(within(panel).getByRole("button", { name: "Capture Press" })).toBeDisabled();
    expect(within(panel).getByRole("combobox", { name: "Hand" })).toHaveValue("Auto");
    expect(panel.querySelector("video")).not.toBeNull();
    expect(panel.querySelector("canvas")).not.toBeNull();
    fireEvent.click(within(panel).getByRole("button", { name: "Close hand control and stop the camera" }));
    expect(screen.queryByRole("region", { name: "Hand control" })).not.toBeInTheDocument();
  });

  it("disables Start camera where the camera cannot run (jsdom is not a secure context)", () => {
    render(player());
    fireEvent.click(screen.getByRole("button", { name: "Hand control" }));
    const start = within(screen.getByRole("region", { name: "Hand control" })).getByRole("button", { name: /Start camera/ });
    expect(start).toBeDisabled();
    expect(start).toHaveAttribute("title", "Hand control requires localhost or HTTPS.");
  });

  it("switches the set-up tracker to Set centre and a first pinch in pinch mode", () => {
    render(player());
    fireEvent.click(screen.getByRole("button", { name: "Hand control" }));
    const panel = screen.getByRole("region", { name: "Hand control" });
    act(() => setHandSettings({ mode: "pinch" }));
    expect(within(panel).getByRole("button", { name: "Set centre here" })).toBeInTheDocument();
    expect(panel).toHaveTextContent("Try a pinch");
    expect(within(panel).queryByRole("button", { name: "Capture Rest" })).not.toBeInTheDocument();
  });

  it("lists the gestures for Lab Studio's actions", () => {
    render(player());
    fireEvent.click(screen.getByRole("button", { name: "Hand control" }));
    const panel = screen.getByRole("region", { name: "Hand control" });
    for (const title of ["Pick up", "Set down", "Aim", "Seat", "Pour or tip", "Draw up", "Empty a pipette", "Rinse", "Drops", "Invert", "Swirl", "TARE", "Withdraw"]) {
      expect(within(panel).getByText(title)).toBeInTheDocument();
    }
  });

  it("keeps the camera video mounted while the panel is collapsed", () => {
    render(player());
    fireEvent.click(screen.getByRole("button", { name: "Hand control" }));
    const panel = screen.getByRole("region", { name: "Hand control" });
    const video = panel.querySelector("video");
    fireEvent.click(within(panel).getByRole("button", { name: "Collapse Hand control" }));
    expect(panel.querySelector("video")).toBe(video);
  });

  it("marks the step card's actions for a hand press", () => {
    render(player());
    expect(screen.getByRole("button", { name: "Confirm" })).toHaveAttribute("data-hand-press", "confirm-accessible-action");
  });
});

describe("the guide line and badge (app.js:378-421)", () => {
  it("leads through set-up, then names the next gesture", () => {
    expect(handGuide({ ...base, running: false }, idle, 1100).text).toMatch(/Start the camera/);
    expect(handGuide(base, idle, 2000)).toMatchObject({ warn: true });
    expect(handGuide({ ...base, profiles: {} }, idle, 1100).text).toMatch(/Capture Rest/);
    expect(handGuide({ ...base, profiles: { rest: [0] } }, idle, 1100).text).toMatch(/Capture Press/);
    expect(handGuide(base, idle, 1100)).toMatchObject({ gesture: "grab" });
    expect(handGuide(base, { ...idle, carrying: true }, 1100)).toMatchObject({ gesture: "put" });
    expect(handGuide(base, { ...idle, carrying: true, locked: true, stroke: "turn" }, 1100)).toMatchObject({ gesture: "turn" });
    expect(handGuide(base, { ...idle, carrying: true, locked: true, draw: true, armed: "bubbles" }, 1100)).toMatchObject({ gesture: "draw", warn: true });
    expect(handGuide(base, { ...idle, dropMode: true }, 1100)).toMatchObject({ gesture: "drops" });
    // Draw back is named only at a graduation, where the drop panel has it (decided 2026-10-10).
    expect(handGuide(base, { ...idle, dropMode: true }, 1100).text).not.toMatch(/Draw back/);
    expect(handGuide(base, { ...idle, dropMode: true, drawBack: true }, 1100).text).toMatch(/Past the line, grip over Draw back\./);
    expect(handGuide(base, { ...idle, invertHolding: true }, 1100)).toMatchObject({ gesture: "invert" });
    expect(handGuide(base, { ...idle, carrying: true, locked: true, squeeze: true }, 1100)).toMatchObject({ gesture: "deliver" });
    expect(handGuide(base, { ...idle, keyLocked: true }, 1100)).toMatchObject({ gesture: "key" });
    // Make a Solution (decided 2026-10-04): a gripped flask is swirled; a locked wash bottle is squeezed.
    expect(handGuide(base, { ...idle, swirlHolding: true }, 1100)).toMatchObject({ gesture: "swirl" });
    expect(handGuide(base, { ...idle, holdDone: true }, 1100).text).toMatch(/Open your hand to let go/);
    expect(handGuide(base, { ...idle, carrying: true, locked: true, rinse: true }, 1100)).toMatchObject({ gesture: "rinse" });
    expect(handGuide(base, { ...idle, carrying: true, locked: true, rinse: true }, 1100).text).toMatch(/squeeze the wash bottle/);
  });

  it("shows Off, Calibrate, No hand and On", () => {
    expect(handBadge({ ...base, running: false }, 1100).text).toBe("Off");
    expect(handBadge({ ...base, calibrated: false }, 1100).text).toBe("Calibrate");
    expect(handBadge(base, 2000).text).toBe("No hand");
    expect(handBadge(base, 1100).text).toBe("On");
  });
});
