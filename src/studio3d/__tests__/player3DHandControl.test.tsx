import { createRef } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { filtrationTechnique } from "../../domain/fixtures";
import type { GestureController } from "../../player/gesture/gestureTypes";
import { Player3D } from "../player/Player3D";

/**
 * Player3D's hand control (handoff §5.15) with a fake recognition engine, as the 2D player's tests
 * drive camera control. jsdom has no WebGL, so the bench shows its fallback: these cases cover the
 * dock button, the panel and its wording, and Restart, not carrying on the canvas.
 */

const gestureController = (overrides: Partial<GestureController> = {}): GestureController => {
  const snapshot = { frameId: 1, frameTimeMs: 0, sampleStartedAtMs: 0, status: "noHand" as const };
  return {
    cursorSpeed: 3,
    delegate: "CPU",
    enabled: true,
    engine: "mediapipe-hand-landmarker",
    frames: {
      getSnapshot: () => snapshot,
      markCursorRendered: vi.fn(),
      subscribe: () => () => undefined,
    },
    message: "Show one hand to steer with your index finger. Pinch to grab or activate.",
    metrics: {
      attemptedFrames: 60,
      bitmapReadyMs: 1.2,
      captureToCursorMs: 22.5,
      captureToResultMs: 14.4,
      inferenceMs: 6.4,
      lastFrameId: 60,
      processedFps: 60,
      processedFrames: 58,
      sampleAgeMs: 4,
      skipRate: 2 / 60,
      skippedFrames: 2,
      submittedFrames: 58,
    },
    providerId: "mediapipe-hand-landmarker",
    providerLabel: "MediaPipe Hand Landmarker",
    setCursorSpeed: vi.fn(),
    start: vi.fn(() => Promise.resolve()),
    status: "ready",
    stop: vi.fn(),
    supported: true,
    videoRef: createRef<HTMLVideoElement>(),
    ...overrides,
  };
};

const off = (overrides: Partial<GestureController> = {}) =>
  gestureController({ enabled: false, message: "Camera control is off.", status: "off", ...overrides });

const player = (controller: GestureController) => (
  <Player3D definition={filtrationTechnique} title="Filter a Precipitate" sourceTag="TECHNIQUE · PACK 1"
    fallbackHash="#/technique/filtration" backHref="#/3d" gestureController={controller} />
);

describe("Player3D hand control (handoff §5.15)", () => {
  // The panel layout (a collapse, say) is remembered under the player's UI key; start each case clean.
  beforeEach(() => localStorage.clear());

  it("starts and stops from the dock, as the 2D Camera control does, and shows the panel only while on", () => {
    const start = vi.fn(() => Promise.resolve());
    const { rerender } = render(player(off({ start })));
    const toggle = screen.getByRole("button", { name: "Hand control" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("region", { name: "Hand control" })).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(start).toHaveBeenCalledTimes(1);

    const stop = vi.fn();
    rerender(player(gestureController({ stop })));
    expect(screen.getByRole("button", { name: "Hand control" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("region", { name: "Hand control" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hand control" }));
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("is disabled, with the reason, where the camera cannot run", () => {
    render(player(off({ supported: false })));
    const toggle = screen.getByRole("button", { name: "Hand control" });
    expect(toggle).toBeDisabled();
    expect(toggle).toHaveAttribute("title", "Hand control requires localhost or HTTPS.");
  });

  it("holds the camera preview, the set-up state, gesture cards and cursor response, in the 2D wording", () => {
    const setCursorSpeed = vi.fn();
    const { container } = render(player(gestureController({ setCursorSpeed })));
    const panel = screen.getByRole("region", { name: "Hand control" });
    expect(panel.querySelector("video")).not.toBeNull();
    expect(within(panel).getByText("Tracking state")).toBeInTheDocument();
    expect(within(panel).getByText("Show one hand to steer with your index finger. Pinch to grab or activate.")).toBeInTheDocument();
    for (const line of ["Use localhost or HTTPS", "Allow webcam permission", "Keep one hand visible", "Use steady lighting with enough contrast"]) {
      expect(within(panel).getByText(line)).toBeInTheDocument();
    }
    expect(within(panel).getByText("Steer with your index fingertip.")).toBeInTheDocument();
    expect(within(panel).getByText("Pinch thumb and index finger to grab or activate, then release over the target.")).toBeInTheDocument();
    expect(within(panel).getByText("Hold four fingers extended together and wave over a panel to scroll it.")).toBeInTheDocument();
    expect(panel).toHaveTextContent("Frames are processed locally in the browser. They are not saved, exported, serialized to lab state, or sent to the backend.");
    expect(panel).toHaveTextContent("Click Hand control to start or stop. Use Cursor response to balance precision and speed. Restart and leaving the player both stop the camera tracks.");
    expect(panel).toHaveTextContent("Hand control is limited to tray placement, bench item movement or interactions, and whitelisted current-step controls.");
    expect(panel).toHaveTextContent("Mouse, touch, and keyboard stay available. No-hand and unstable-tracking frames do not count as assessment failures. Switching input modes safely cancels an unfinished camera gesture.");
    // Player3D has no edge-hover scrolling, so the 2D sentence claiming it is not shown.
    expect(panel).not.toHaveTextContent("Edge-hover scrolling");
    // Only the four items §5.15 lists: no runtime metrics.
    expect(panel).not.toHaveTextContent("FPS");
    expect(panel).not.toHaveTextContent("inference");

    const slider = within(panel).getByRole("slider", { name: "Cursor response" });
    expect(slider).toHaveAttribute("aria-valuetext", "Balanced");
    fireEvent.change(slider, { target: { value: "5" } });
    expect(setCursorSpeed).toHaveBeenCalledWith(5);
    // The shared cursor is drawn above the player.
    expect(container.querySelector(".gesture-cursor")).not.toBeNull();
  });

  it("keeps the camera video mounted while the panel is collapsed", () => {
    render(player(gestureController()));
    const panel = screen.getByRole("region", { name: "Hand control" });
    const video = panel.querySelector("video");
    fireEvent.click(within(panel).getByRole("button", { name: "Collapse Hand control" }));
    expect(panel.querySelector("video")).toBe(video);
    expect(panel.querySelector(".s3d-hand__body")).toHaveAttribute("hidden");
  });

  it("asks to re-arm when a blocking dialog opens", () => {
    render(player(gestureController()));
    fireEvent.click(screen.getByRole("button", { name: "Controls and model" }));
    expect(screen.getByRole("region", { name: "Hand control" })).toHaveTextContent("Open your hand briefly to re-arm hand control.");
  });

  it("stops the camera tracks on Restart, and leaves an engine that is already off alone", () => {
    const restart = () => {
      fireEvent.click(screen.getByRole("button", { name: "Menu" }));
      fireEvent.click(screen.getByRole("button", { name: "Restart" }));
      fireEvent.click(within(screen.getByRole("dialog", { name: "Confirm" })).getByRole("button", { name: "Restart" }));
    };
    const stop = vi.fn();
    const { unmount } = render(player(gestureController({ stop })));
    restart();
    expect(stop).toHaveBeenCalledTimes(1);
    unmount();
    // Leaving the player stops them too.
    expect(stop).toHaveBeenCalledTimes(2);

    const idleStop = vi.fn();
    render(player(off({ stop: idleStop, supported: false })));
    restart();
    expect(idleStop).not.toHaveBeenCalled();
    expect(screen.queryByRole("region", { name: "Hand control" })).not.toBeInTheDocument();
  });

  it("opts the step card's Confirm in to hand control, under the 2D ProcessSidebar name", () => {
    // Step 1 of the fixture is a snap, so the accessible action flow shows Confirm.
    render(player(off()));
    expect(screen.getByRole("button", { name: "Confirm" })).toHaveAttribute("data-gesture-action", "confirm-accessible-action");
  });
});
