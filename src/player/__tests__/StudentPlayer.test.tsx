import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createRef } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { demoLab, filtrationTechnique, hardWaterDemoLab } from "../../domain/fixtures";
import type { LabDefinition, TechniqueDefinition } from "../../domain/types";
import { getBenchSize, getHitBox, getVisualProfile } from "../../equipment/visualCatalog";
import { normalizeStudioLabDraft } from "../../studio/draftNormalizer";
import { createLegacySampleRackDraft } from "../../test/legacyDrafts";
import type { GestureController } from "../gesture/gestureTypes";
import type { GestureCursor } from "../gesture/gestureMath";
import { StudentPlayer } from "../StudentPlayer";

describe("StudentPlayer", () => {
  const readPublicLab = (file: string): LabDefinition =>
    JSON.parse(readFileSync(join(process.cwd(), "public", "labs", file), "utf8")) as LabDefinition;

  const readPublicTechnique = (file: string): TechniqueDefinition =>
    JSON.parse(readFileSync(join(process.cwd(), "public", "techniques", file), "utf8")) as TechniqueDefinition;

  const readAcidBaseTitrationLab = (): LabDefinition => readPublicLab("acid-base-titration.json");
  const readTransmittanceDilutionTechnique = (): TechniqueDefinition =>
    readPublicTechnique("transmittance-dilution.json");

  const suppliedRecordLab = {
    ...demoLab,
    id: "supplied-record-lab",
    title: "Supplied Record Lab",
    description: "Record schema-provided measurement evidence.",
    actions: [
      {
        id: "record-initial-burette",
        verb: "record",
        label: "Record initial burette reading",
        parameters: {
          measurementId: "burette-initial-volume",
          label: "Initial burette reading",
          value: 0.2,
          unit: "mL",
        },
        interaction: {
          type: "recordNotebook",
          valueParameter: "measurementId",
          accessibleLabel: "Record the initial burette reading.",
        },
        prerequisites: [],
        stateChanges: ["Record schema-provided measurement evidence."],
        invalidCases: [],
        feedback: {
          success: "Initial burette reading recorded.",
          invalid: "Record the initial burette reading.",
        },
        evidence: ["record", "notebook"],
      },
    ],
    process: {
      startNodeId: "record-initial-burette-node",
      nodes: [
        {
          id: "record-initial-burette-node",
          type: "action",
          title: "Record initial burette",
          description: "Record the initial burette reading before dispensing NaOH.",
          actionId: "record-initial-burette",
          config: {},
          validation: [
            {
              id: "initial-burette-recorded",
              type: "measurementRecorded",
              label: "Initial burette reading recorded.",
              measurementId: "burette-initial-volume",
            },
          ],
          hints: ["Record the starting meniscus reading before titrant is delivered."],
          feedback: {
            success: "Record initial burette complete.",
            retry: "Record the initial burette reading.",
          },
        },
      ],
      edges: [],
    },
  } satisfies LabDefinition;

  const expandShelfCategory = (category: string) => {
    const shelf = screen.getByLabelText(/equipment shelf/i);
    const toggle = within(shelf)
      .getAllByRole("button")
      .find(
        (button) =>
          button.classList.contains("shelf-toggle") &&
          (button.textContent ?? "").trim().toLowerCase().startsWith(category.toLowerCase()),
      );
    if (!toggle) throw new Error(`Missing equipment shelf category: ${category}`);
    if (toggle.getAttribute("aria-expanded") === "false") {
      fireEvent.click(toggle);
    }
    return toggle;
  };

  const currentStepControl = (root: ParentNode = document.body): HTMLButtonElement => {
    const button = root.querySelector(".step-control button");
    if (!(button instanceof HTMLButtonElement)) throw new Error("Missing current step control.");
    return button;
  };

  const clickCurrentStepControl = (root?: ParentNode) => {
    fireEvent.click(currentStepControl(root));
  };

  const expectSingleActiveInstruction = (expected: string): HTMLElement => {
    const process = screen.getByLabelText(/process and current step/i);
    const currentStep = process.querySelector("[aria-current='step']");
    if (!(currentStep instanceof HTMLElement)) throw new Error("Missing current process step.");

    const instruction = within(currentStep).getByText(expected);
    expect(instruction.closest(".step-affordance")).not.toBeNull();
    expect(within(currentStep).getAllByText(expected)).toHaveLength(1);
    return currentStep;
  };

  const expectStepText = (name: RegExp) => {
    expect(screen.getAllByText(name).length).toBeGreaterThan(0);
  };

  const benchPointFor = (button: HTMLElement) => {
    const item = button.closest<HTMLElement>(".bench-item");
    if (!item) throw new Error("Missing bench item for placed equipment.");
    return {
      x: Number.parseFloat(item.style.left || "0"),
      y: Number.parseFloat(item.style.top || "0"),
    };
  };

  const overlapPointForZone = (
    targetButton: HTMLElement,
    sourceDefinitionId: string,
    targetDefinitionId: string,
    zoneId: string,
  ) => {
    const target = benchPointFor(targetButton);
    const zone = getVisualProfile(targetDefinitionId)?.visualZones.find((candidate) => candidate.id === zoneId);
    const sourceHitBox = getHitBox(sourceDefinitionId);
    if (!zone) throw new Error(`Missing visual zone: ${zoneId}`);
    return {
      x: target.x + zone.bounds.x + zone.bounds.width / 2 - sourceHitBox.x - sourceHitBox.width / 2,
      y: target.y + zone.bounds.y + zone.bounds.height / 2 - sourceHitBox.y - sourceHitBox.height / 2,
    };
  };

  const dragPlacedEquipmentTo = (
    source: HTMLElement,
    benchSurface: Element,
    point: { x: number; y: number },
    pointerId: number,
  ) => {
    const start = benchPointFor(source);
    const offset = { x: 12, y: 12 };
    fireEvent.pointerDown(source, {
      clientX: start.x + offset.x,
      clientY: start.y + offset.y,
      pointerId,
    });
    fireEvent.pointerMove(benchSurface, {
      clientX: point.x + offset.x,
      clientY: point.y + offset.y,
      pointerId,
    });
    fireEvent.pointerUp(benchSurface, {
      clientX: point.x + offset.x,
      clientY: point.y + offset.y,
      pointerId,
    });
  };

  const viewportRect = {
    bottom: 800,
    height: 800,
    left: 0,
    right: 1000,
    toJSON: () => ({}),
    top: 0,
    width: 1000,
    x: 0,
    y: 0,
  } satisfies DOMRect;

  const domRect = (left: number, top: number, width: number, height: number): DOMRect => ({
    bottom: top + height,
    height,
    left,
    right: left + width,
    toJSON: () => ({}),
    top,
    width,
    x: left,
    y: top,
  });

  const mockScrollableElement = (
    element: HTMLElement,
    box: DOMRect,
    options: {
      clientHeight?: number;
      clientWidth?: number;
      scrollHeight?: number;
      scrollWidth?: number;
    },
  ) => {
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue(box);
    Object.defineProperty(element, "clientHeight", {
      configurable: true,
      value: options.clientHeight ?? box.height,
    });
    Object.defineProperty(element, "clientWidth", {
      configurable: true,
      value: options.clientWidth ?? box.width,
    });
    Object.defineProperty(element, "scrollHeight", {
      configurable: true,
      value: options.scrollHeight ?? options.clientHeight ?? box.height,
    });
    Object.defineProperty(element, "scrollWidth", {
      configurable: true,
      value: options.scrollWidth ?? options.clientWidth ?? box.width,
    });
    element.scrollLeft = 0;
    element.scrollTop = 0;
  };

  const gestureController = (
    cursor?: GestureCursor,
    overrides: Partial<GestureController> = {},
  ): GestureController => {
    const sampleStartedAtMs = performance.now();
    const snapshot = {
      cursor,
      frameId: 1,
      frameTimeMs: sampleStartedAtMs,
      sampleStartedAtMs,
      status: cursor ? ("ready" as const) : ("noHand" as const),
    };
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
      message: "Fake gesture controller ready.",
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
      start: vi.fn(),
      status: "ready",
      stop: vi.fn(),
      supported: true,
      videoRef: createRef<HTMLVideoElement>(),
      ...overrides,
    };
  };

  const gestureCursor = (pinching: boolean, clientX = 120, clientY = 120): GestureCursor => ({
    clientX,
    clientY,
    normalizedX: clientX / 1000,
    normalizedY: clientY / 800,
    pinching,
    pinchRatio: pinching ? 0.25 : 0.7,
    tracking: "tracked",
  });

  const fourFingerScrollCursor = ({
    axis = "vertical",
    active = true,
    clientX = 120,
    clientY = 120,
    deltaX = 0,
    deltaY = 24,
    pose = true,
  }: {
    axis?: "horizontal" | "vertical";
    active?: boolean;
    clientX?: number;
    clientY?: number;
    deltaX?: number;
    deltaY?: number;
    pose?: boolean;
  }): GestureCursor => ({
    ...gestureCursor(false, clientX, clientY),
    fourFingerScroll: {
      active,
      axis,
      centroid: {
        clientX,
        clientY,
        normalizedX: clientX / 1000,
        normalizedY: clientY / 800,
      },
      deltaX,
      deltaY,
      direction: axis === "horizontal" ? (deltaX < 0 ? "left" : "right") : deltaY < 0 ? "up" : "down",
      pose,
      stableMs: 180,
      strength: 0.8,
      velocityX: deltaX * 25,
      velocityY: deltaY * 25,
    },
  });

  const withElementFromPoint = (initialElement: Element | null) => {
    let currentElement = initialElement;
    const original = document.elementFromPoint;
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: vi.fn(() => currentElement),
    });
    return {
      restore: () => {
        Object.defineProperty(document, "elementFromPoint", {
          configurable: true,
          value: original,
        });
      },
      setElement: (element: Element | null) => {
        currentElement = element;
      },
    };
  };

  const gestureDragPreview = (): HTMLElement | null =>
    document.querySelector('[data-gesture-drag-preview="true"]');

  it("renders technique player with accessible action flow", () => {
    render(<StudentPlayer definition={filtrationTechnique} />);
    expect(screen.getByRole("heading", { name: /filter a precipitate/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /live preview/i })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /current step/i })).toBeInTheDocument();
    const process = screen.getByLabelText(/process and current step/i);
    expect(within(process).getByRole("heading", { name: /current step/i })).toBeInTheDocument();
    expect(within(process).getByRole("button", { name: /assemble funnel stand/i })).toBeInTheDocument();
    expect(process.querySelector("[aria-current='step']")).not.toBeNull();
    expect(screen.getByLabelText(/equipment shelf/i)).toBeInTheDocument();
    const status = screen.getByLabelText(/lab evidence and status/i);
    expect(within(status).getByRole("heading", { name: /feedback/i })).toBeInTheDocument();
    expect(within(status).getByRole("heading", { name: /notebook/i })).toBeInTheDocument();
    expect(within(status).getByRole("heading", { name: /results/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /perform step/i })).not.toBeInTheDocument();
  });

  it("keeps camera control explicit and reversible", () => {
    const start = vi.fn(() => Promise.resolve());
    render(
      <StudentPlayer
        definition={filtrationTechnique}
        gestureController={gestureController(undefined, {
          enabled: false,
          message: "Camera control is off.",
          start,
          status: "off",
        })}
      />,
    );

    const toggle = screen.getByRole("button", { name: /^camera control$/i });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(toggle);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("renders and updates camera cursor speed", () => {
    const setCursorSpeed = vi.fn();
    render(
      <StudentPlayer
        definition={filtrationTechnique}
        gestureController={gestureController(undefined, {
          cursorSpeed: 2,
          setCursorSpeed,
        })}
      />,
    );

    const slider = screen.getByRole("slider", { name: /cursor response/i });
    expect(slider).toHaveValue("2");
    expect(slider).toHaveAttribute("aria-valuetext", "Smooth");
    const statusPanel = screen.getByLabelText(/camera gesture control status/i);
    const statusCopy = statusPanel.querySelector(".gesture-status-copy");
    const runtimeMetrics = screen.getByLabelText(/camera tracking runtime/i);
    if (!(statusCopy instanceof HTMLElement)) throw new Error("Missing camera status copy.");
    expect(statusPanel).not.toHaveAttribute("aria-live");
    expect(statusCopy).toHaveAttribute("aria-live", "polite");
    expect(runtimeMetrics).toHaveTextContent(/MediaPipe Hand Landmarker/i);
    expect(runtimeMetrics).toHaveTextContent(/mediapipe-hand-landmarker \/ CPU/i);
    expect(runtimeMetrics).toHaveTextContent(/60 FPS \| 6\.4 ms inference \| 22\.5 ms capture-to-cursor \| 3% skipped/i);
    fireEvent.change(slider, { target: { value: "5" } });
    expect(setCursorSpeed).toHaveBeenCalledWith(5);
  });

  it("collapses and restores the camera status panel without stopping camera control", () => {
    const stop = vi.fn();
    render(
      <StudentPlayer
        definition={filtrationTechnique}
        gestureController={gestureController(undefined, { stop })}
      />,
    );

    const panel = screen.getByLabelText(/camera gesture control status/i);
    const collapse = screen.getByRole("button", { name: /collapse camera status panel/i });
    const bodyId = collapse.getAttribute("aria-controls");
    const body = bodyId ? document.getElementById(bodyId) : null;
    if (!(body instanceof HTMLElement)) throw new Error("Missing camera status panel body.");

    expect(collapse).toHaveAttribute("aria-expanded", "true");
    expect(body).not.toHaveAttribute("hidden");
    fireEvent.click(collapse);
    expect(panel).toHaveClass("is-collapsed");
    expect(body).toHaveAttribute("hidden");
    expect(stop).not.toHaveBeenCalled();

    const expand = screen.getByRole("button", { name: /expand camera status panel/i });
    expect(expand).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(expand);
    expect(panel).not.toHaveClass("is-collapsed");
    expect(body).not.toHaveAttribute("hidden");
  });

  it("moves the camera status panel with its drag handle and keeps it recoverable", () => {
    render(
      <StudentPlayer definition={filtrationTechnique} gestureController={gestureController(undefined)} />,
    );

    const panel = screen.getByLabelText(/camera gesture control status/i);
    const root = panel.closest(".student-player");
    const handle = screen.getByRole("button", { name: /move camera status panel/i });
    if (!(root instanceof HTMLElement) || !(panel instanceof HTMLElement)) {
      throw new Error("Missing camera panel geometry target.");
    }
    vi.spyOn(root, "getBoundingClientRect").mockReturnValue(domRect(0, 0, 1000, 800));
    vi.spyOn(panel, "getBoundingClientRect").mockReturnValue(domRect(600, 100, 360, 120));
    Object.defineProperty(handle, "setPointerCapture", { configurable: true, value: vi.fn() });
    Object.defineProperty(handle, "releasePointerCapture", { configurable: true, value: vi.fn() });

    fireEvent.pointerDown(handle, { button: 0, clientX: 640, clientY: 112, pointerId: 7 });
    expect(panel).toHaveClass("is-dragging");
    fireEvent.pointerMove(handle, { clientX: 340, clientY: 300, pointerId: 7 });
    expect(panel).toHaveStyle({ left: "300px", top: "288px" });
    fireEvent.pointerUp(handle, { clientX: 340, clientY: 300, pointerId: 7 });
    expect(panel).not.toHaveClass("is-dragging");

    fireEvent.click(screen.getByRole("button", { name: /restore default camera panel position/i }));
    expect(panel.style.left).toBe("");
    expect(panel.style.top).toBe("");
  });

  it("opens camera control help without starting the camera or changing progress", () => {
    const start = vi.fn(() => Promise.resolve());
    render(
      <StudentPlayer
        definition={suppliedRecordLab}
        gestureController={gestureController(undefined, {
          enabled: false,
          message: "Camera control is off.",
          start,
          status: "off",
        })}
      />,
    );

    expect(screen.getByText("Progress: 0 completed / 1 total")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /camera control help/i }));

    const dialog = screen.getByRole("dialog", { name: /using camera control/i });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByText(/frames are processed locally in the browser/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/mouse, touch, and keyboard stay available/i)).toBeInTheDocument();
    expect(start).not.toHaveBeenCalled();
    expect(screen.getByText("Progress: 0 completed / 1 total")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: /close camera control help/i }));
    expect(screen.queryByRole("dialog", { name: /using camera control/i })).not.toBeInTheDocument();
  });

  it("places shelf equipment with a camera pinch release over the workbench", () => {
    const { rerender } = render(
      <StudentPlayer definition={filtrationTechnique} gestureController={gestureController(undefined)} />,
    );
    expandShelfCategory("Filtration");

    const benchSurface = screen.getByLabelText(/^workbench$/i).querySelector(".bench-surface");
    if (!(benchSurface instanceof HTMLElement)) throw new Error("Missing bench surface.");
    vi.spyOn(benchSurface, "getBoundingClientRect").mockReturnValue(viewportRect);
    const shelfScroll = screen.getByLabelText(/equipment shelf/i).querySelector(".equipment-shelf-scroll");
    if (!(shelfScroll instanceof HTMLElement)) throw new Error("Missing equipment shelf scroll region.");
    mockScrollableElement(shelfScroll, domRect(0, 560, 240, 120), {
      clientHeight: 120,
      scrollHeight: 420,
    });

    const glassFunnel = screen.getByRole("button", { name: /glass funnel, available/i });
    const hitTest = withElementFromPoint(glassFunnel);
    try {
      rerender(
        <StudentPlayer
          definition={filtrationTechnique}
          gestureController={gestureController(gestureCursor(true, 120, 640))}
        />,
      );
      const cursor = document.querySelector(".gesture-cursor") as HTMLElement | null;
      expect(cursor).toBeInTheDocument();
      expect(cursor).toHaveClass("is-pinching");
      expect(cursor).toHaveClass("is-grabbing");
      expect(cursor).toHaveStyle({
        transform: "translate3d(120px, 640px, 0) translate(-50%, -50%)",
      });
      expect(cursor?.closest(".bench-surface")).toBeNull();
      expect(glassFunnel).toHaveClass("is-gesture-grabbed");
      const preview = gestureDragPreview();
      expect(preview).not.toBeNull();
      if (!preview) throw new Error("Missing gesture drag preview.");
      const funnelSize = getBenchSize("funnel");
      expect(preview).toHaveStyle({
        transform: `translate3d(${120 - funnelSize.width / 2}px, ${640 - funnelSize.height / 2}px, 0)`,
      });
      expect(preview.querySelector('[data-definition-id="funnel"]')).not.toBeNull();
      expect(screen.queryByRole("button", { name: /glass funnel, empty/i })).not.toBeInTheDocument();

      hitTest.setElement(benchSurface);
      rerender(
        <StudentPlayer
          definition={filtrationTechnique}
          gestureController={gestureController(gestureCursor(false, 280, 180))}
        />,
      );
    } finally {
      hitTest.restore();
    }

    expect(screen.getByRole("button", { name: /glass funnel, empty/i })).toBeInTheDocument();
    expect(gestureDragPreview()).not.toBeInTheDocument();
    expect(shelfScroll.scrollTop).toBe(0);
  });

  it("holds brief tracking loss and cancels safely when camera help takes focus", async () => {
    const { rerender } = render(
      <StudentPlayer definition={filtrationTechnique} gestureController={gestureController(undefined)} />,
    );
    expandShelfCategory("Filtration");
    const benchSurface = screen.getByLabelText(/^workbench$/i).querySelector(".bench-surface");
    if (!(benchSurface instanceof HTMLElement)) throw new Error("Missing bench surface.");
    vi.spyOn(benchSurface, "getBoundingClientRect").mockReturnValue(viewportRect);
    const glassFunnel = screen.getByRole("button", { name: /glass funnel, available/i });
    const hitTest = withElementFromPoint(glassFunnel);
    try {
      rerender(
        <StudentPlayer
          definition={filtrationTechnique}
          gestureController={gestureController(gestureCursor(true, 120, 640))}
        />,
      );
      expect(gestureDragPreview()).toBeInTheDocument();

      rerender(
        <StudentPlayer
          definition={filtrationTechnique}
          gestureController={gestureController({
            ...gestureCursor(true, 120, 640),
            tracking: "held",
          })}
        />,
      );
      expect(document.querySelector(".gesture-cursor")).toHaveClass("is-tracking-held");
      expect(gestureDragPreview()).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /camera control help/i }));
      await waitFor(() => expect(gestureDragPreview()).not.toBeInTheDocument());
      expect(screen.getByText(/open your hand briefly to re-arm camera control/i)).toBeInTheDocument();

      hitTest.setElement(benchSurface);
      rerender(
        <StudentPlayer
          definition={filtrationTechnique}
          gestureController={gestureController(gestureCursor(false, 280, 180))}
        />,
      );
      expect(screen.queryByRole("button", { name: /glass funnel, empty/i })).not.toBeInTheDocument();
    } finally {
      hitTest.restore();
    }
  });

  it("scrolls shelf and workbench with an open hand near their edges", async () => {
    const { rerender } = render(
      <StudentPlayer definition={filtrationTechnique} gestureController={gestureController(undefined)} />,
    );
    expandShelfCategory("Filtration");

    const shelfScroll = screen.getByLabelText(/equipment shelf/i).querySelector(".equipment-shelf-scroll");
    const workbench = screen.getByLabelText(/^workbench$/i);
    if (!(shelfScroll instanceof HTMLElement)) throw new Error("Missing equipment shelf scroll region.");
    if (!(workbench instanceof HTMLElement)) throw new Error("Missing workbench.");
    mockScrollableElement(shelfScroll, domRect(0, 100, 240, 260), {
      clientHeight: 260,
      scrollHeight: 720,
    });
    mockScrollableElement(workbench, domRect(280, 100, 320, 260), {
      clientWidth: 320,
      scrollWidth: 820,
    });

    rerender(
      <StudentPlayer
        definition={filtrationTechnique}
        gestureController={gestureController(gestureCursor(false, 120, 356))}
      />,
    );
    await waitFor(() => expect(shelfScroll.scrollTop).toBeGreaterThan(0), { timeout: 1_200 });
    expect(shelfScroll).toHaveClass("is-gesture-scrolling-down");

    rerender(
      <StudentPlayer
        definition={filtrationTechnique}
        gestureController={gestureController(gestureCursor(false, 596, 180))}
      />,
    );
    await waitFor(() => expect(workbench.scrollLeft).toBeGreaterThan(0), { timeout: 1_200 });
    expect(workbench).toHaveClass("is-gesture-scrolling-right");

    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    expect(workbench).not.toHaveClass("is-gesture-scrolling-right");
    expect(shelfScroll).not.toHaveClass("is-gesture-scrolling-down");
  });

  it("locks four-finger wave scrolling to the initial target", async () => {
    const { rerender } = render(
      <StudentPlayer definition={filtrationTechnique} gestureController={gestureController(undefined)} />,
    );
    expandShelfCategory("Filtration");

    const shelfScroll = screen.getByLabelText(/equipment shelf/i).querySelector(".equipment-shelf-scroll");
    const process = screen.getByLabelText(/process and current step/i);
    if (!(shelfScroll instanceof HTMLElement)) throw new Error("Missing equipment shelf scroll region.");
    if (!(process instanceof HTMLElement)) throw new Error("Missing process scroll region.");
    mockScrollableElement(shelfScroll, domRect(0, 100, 240, 260), {
      clientHeight: 260,
      scrollHeight: 720,
    });
    mockScrollableElement(process, domRect(280, 100, 320, 260), {
      clientHeight: 260,
      scrollHeight: 720,
    });

    rerender(
      <StudentPlayer
        definition={filtrationTechnique}
        gestureController={gestureController(
          fourFingerScrollCursor({ clientX: 120, clientY: 220, deltaY: 26 }),
        )}
      />,
    );
    await waitFor(() => expect(shelfScroll.scrollTop).toBeGreaterThan(0));
    const shelfAfterFirstWave = shelfScroll.scrollTop;

    rerender(
      <StudentPlayer
        definition={filtrationTechnique}
        gestureController={gestureController(
          fourFingerScrollCursor({ clientX: 420, clientY: 220, deltaY: 0, pose: false }),
        )}
      />,
    );
    expect(process.scrollTop).toBe(0);

    rerender(
      <StudentPlayer
        definition={filtrationTechnique}
        gestureController={gestureController(
          fourFingerScrollCursor({ clientX: 420, clientY: 220, deltaY: 24 }),
        )}
      />,
    );

    await waitFor(() => expect(shelfScroll.scrollTop).toBeGreaterThan(shelfAfterFirstWave));
    expect(process.scrollTop).toBe(0);
    expect(shelfScroll).toHaveClass("is-gesture-scrolling-down");
    expect(process).not.toHaveClass("is-gesture-scrolling-down");
  });

  it("arms open-hand scrolling without waiting for an initial pinch cooldown", () => {
    const nowSpy = vi.spyOn(performance, "now").mockReturnValue(100);
    const { rerender } = render(
      <StudentPlayer definition={filtrationTechnique} gestureController={gestureController(undefined)} />,
    );
    expandShelfCategory("Filtration");

    const shelfScroll = screen.getByLabelText(/equipment shelf/i).querySelector(".equipment-shelf-scroll");
    if (!(shelfScroll instanceof HTMLElement)) throw new Error("Missing equipment shelf scroll region.");
    mockScrollableElement(shelfScroll, domRect(0, 100, 240, 260), {
      clientHeight: 260,
      scrollHeight: 720,
    });

    try {
      rerender(
        <StudentPlayer
          definition={filtrationTechnique}
          gestureController={gestureController(gestureCursor(false, 120, 356))}
        />,
      );
      expect(shelfScroll).toHaveClass("is-gesture-scrolling-down");
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("resolves camera bench drag releases through the same interaction path", async () => {
    const { rerender } = render(
      <StudentPlayer definition={filtrationTechnique} gestureController={gestureController(undefined)} />,
    );
    expandShelfCategory("Filtration");
    fireEvent.click(screen.getByRole("button", { name: /glass funnel, available/i }));
    fireEvent.click(screen.getByRole("button", { name: /ring stand, available/i }));

    const benchSurface = screen.getByLabelText(/^workbench$/i).querySelector(".bench-surface");
    if (!(benchSurface instanceof HTMLElement)) throw new Error("Missing bench surface.");
    vi.spyOn(benchSurface, "getBoundingClientRect").mockReturnValue(viewportRect);

    const funnel = screen.getByRole("button", { name: /glass funnel, empty/i });
    const ringStand = screen.getByRole("button", { name: /ring stand, empty/i });
    const sourcePoint = benchPointFor(funnel);
    const targetPoint = benchPointFor(ringStand);
    const grabOffset = { x: 24, y: 24 };
    const sourceCursor = { x: sourcePoint.x + grabOffset.x, y: sourcePoint.y + grabOffset.y };
    const targetCursor = { x: targetPoint.x + grabOffset.x, y: targetPoint.y + grabOffset.y };
    const hitTest = withElementFromPoint(funnel);
    try {
      rerender(
        <StudentPlayer
          definition={filtrationTechnique}
          gestureController={gestureController(gestureCursor(true, sourceCursor.x, sourceCursor.y))}
        />,
      );
      expect(funnel).toHaveClass("is-gesture-grabbed");
      expect(gestureDragPreview()).toBeInTheDocument();
      hitTest.setElement(ringStand);
      rerender(
        <StudentPlayer
          definition={filtrationTechnique}
          gestureController={gestureController(gestureCursor(true, targetCursor.x, targetCursor.y))}
        />,
      );
      const targetItem = ringStand.closest(".bench-item");
      if (!(targetItem instanceof HTMLElement)) throw new Error("Missing target bench item.");
      expect(targetItem).toHaveClass("is-overlap-target");
      rerender(
        <StudentPlayer
          definition={filtrationTechnique}
          gestureController={gestureController(gestureCursor(false, targetCursor.x, targetCursor.y))}
        />,
      );
    } finally {
      hitTest.restore();
    }

    await waitFor(() => expectStepText(/place filter paper/i));
  });

  it("moves bench equipment with the camera preview attached to the pinch point", () => {
    const { rerender } = render(
      <StudentPlayer definition={filtrationTechnique} gestureController={gestureController(undefined)} />,
    );
    expandShelfCategory("Filtration");
    fireEvent.click(screen.getByRole("button", { name: /glass funnel, available/i }));

    const benchSurface = screen.getByLabelText(/^workbench$/i).querySelector(".bench-surface");
    if (!(benchSurface instanceof HTMLElement)) throw new Error("Missing bench surface.");
    vi.spyOn(benchSurface, "getBoundingClientRect").mockReturnValue(viewportRect);

    const funnel = screen.getByRole("button", { name: /glass funnel, empty/i });
    const start = benchPointFor(funnel);
    const grabOffset = { x: 18, y: 22 };
    const startCursor = { x: start.x + grabOffset.x, y: start.y + grabOffset.y };
    const movedCursor = { x: start.x + 180, y: start.y + 70 };
    const hitTest = withElementFromPoint(funnel);
    try {
      rerender(
        <StudentPlayer
          definition={filtrationTechnique}
          gestureController={gestureController(gestureCursor(true, startCursor.x, startCursor.y))}
        />,
      );

      const originalItem = funnel.closest(".bench-item");
      if (!(originalItem instanceof HTMLElement)) throw new Error("Missing dragged bench item.");
      expect(originalItem).toHaveClass("is-dragging");
      expect(funnel).toHaveClass("is-gesture-grabbed");
      expect(gestureDragPreview()).toHaveStyle({
        transform: `translate3d(${start.x}px, ${start.y}px, 0)`,
      });

      rerender(
        <StudentPlayer
          definition={filtrationTechnique}
          gestureController={gestureController(gestureCursor(true, movedCursor.x, movedCursor.y))}
        />,
      );
      expect(gestureDragPreview()).toHaveStyle({
        transform: `translate3d(${movedCursor.x - grabOffset.x}px, ${movedCursor.y - grabOffset.y}px, 0)`,
      });

      rerender(
        <StudentPlayer
          definition={filtrationTechnique}
          gestureController={gestureController(gestureCursor(false, movedCursor.x, movedCursor.y))}
        />,
      );
    } finally {
      hitTest.restore();
    }

    const movedFunnel = screen.getByRole("button", { name: /glass funnel, empty/i });
    expect(benchPointFor(movedFunnel)).toEqual({
      x: movedCursor.x - grabOffset.x,
      y: movedCursor.y - grabOffset.y,
    });
    expect(gestureDragPreview()).not.toBeInTheDocument();
  });

  it("accepts camera release over layered filter paper targets", async () => {
    const { rerender } = render(
      <StudentPlayer definition={filtrationTechnique} gestureController={gestureController(undefined)} />,
    );
    expandShelfCategory("Filtration");

    fireEvent.click(screen.getByRole("button", { name: /ring stand, available/i }));
    fireEvent.click(screen.getByRole("button", { name: /glass funnel, available/i }));
    fireEvent.click(currentStepControl());
    await waitFor(() => expectStepText(/place filter paper/i));

    fireEvent.click(screen.getByRole("button", { name: /filter paper, available/i }));
    fireEvent.click(currentStepControl());
    await waitFor(() => expectStepText(/wet filter paper/i));

    expandShelfCategory("Reagent");
    fireEvent.click(screen.getByRole("button", { name: /wash bottle, available/i }));

    const benchSurface = screen.getByLabelText(/^workbench$/i).querySelector(".bench-surface");
    if (!(benchSurface instanceof HTMLElement)) throw new Error("Missing bench surface.");
    vi.spyOn(benchSurface, "getBoundingClientRect").mockReturnValue(viewportRect);

    const washBottle = screen.getByRole("button", { name: /wash bottle, 500 ml deionized water/i });
    const layeredTarget = screen.getByLabelText(/^workbench$/i).querySelector(".bench-item.is-expected-target");
    if (!(layeredTarget instanceof HTMLElement)) throw new Error("Missing layered filter paper target.");
    const targetButton = within(layeredTarget).getByRole("button");
    const dropPoint = overlapPointForZone(
      targetButton,
      "wash-bottle",
      "funnel-stand",
      "funnel-stand-paper-seat",
    );
    const sourcePoint = benchPointFor(washBottle);
    const offset = { x: 24, y: 24 };
    const hitTest = withElementFromPoint(washBottle);

    try {
      rerender(
        <StudentPlayer
          definition={filtrationTechnique}
          gestureController={gestureController(
            gestureCursor(true, sourcePoint.x + offset.x, sourcePoint.y + offset.y),
          )}
        />,
      );
      hitTest.setElement(targetButton);
      rerender(
        <StudentPlayer
          definition={filtrationTechnique}
          gestureController={gestureController(
            gestureCursor(false, dropPoint.x + offset.x, dropPoint.y + offset.y),
          )}
        />,
      );
    } finally {
      hitTest.restore();
    }

    await waitFor(() => expectStepText(/place receiver/i));
    expect(screen.queryByText(/selected target does not match/i)).not.toBeInTheDocument();
  });

  it("activates only whitelisted process controls from camera release gestures", () => {
    const { rerender } = render(
      <StudentPlayer definition={suppliedRecordLab} gestureController={gestureController(undefined)} />,
    );
    const recordButton = screen.getByRole("button", { name: /record initial burette reading/i });
    const hitTest = withElementFromPoint(recordButton);
    try {
      rerender(
        <StudentPlayer
          definition={suppliedRecordLab}
          gestureController={gestureController(gestureCursor(true, 600, 180))}
        />,
      );
      expect(gestureDragPreview()).not.toBeInTheDocument();
      expect(recordButton).toHaveClass("is-gesture-armed");
      rerender(
        <StudentPlayer
          definition={suppliedRecordLab}
          gestureController={gestureController(gestureCursor(false, 600, 180))}
        />,
      );
    } finally {
      hitTest.restore();
    }

    expect(screen.getByText("Progress: 1 completed / 1 total")).toBeInTheDocument();
    expect(recordButton).not.toHaveClass("is-gesture-armed");
  });

  it("does not activate process controls when a camera pinch starts outside a whitelisted control", () => {
    const { rerender } = render(
      <StudentPlayer definition={suppliedRecordLab} gestureController={gestureController(undefined)} />,
    );
    const recordButton = screen.getByRole("button", { name: /record initial burette reading/i });
    const hitTest = withElementFromPoint(document.body);
    try {
      rerender(
        <StudentPlayer
          definition={suppliedRecordLab}
          gestureController={gestureController(gestureCursor(true, 600, 180))}
        />,
      );
      hitTest.setElement(recordButton);
      rerender(
        <StudentPlayer
          definition={suppliedRecordLab}
          gestureController={gestureController(gestureCursor(false, 600, 180))}
        />,
      );
    } finally {
      hitTest.restore();
    }

    expect(screen.getByText("Progress: 0 completed / 1 total")).toBeInTheDocument();
  });

  it("does not activate a different whitelisted button on camera release", () => {
    const stop = vi.fn();
    const { rerender } = render(
      <StudentPlayer
        definition={suppliedRecordLab}
        gestureController={gestureController(undefined, { stop })}
      />,
    );
    const recordButton = screen.getByRole("button", { name: /record initial burette reading/i });
    const resetButton = screen.getByRole("button", { name: /reset/i });
    const hitTest = withElementFromPoint(recordButton);
    try {
      rerender(
        <StudentPlayer
          definition={suppliedRecordLab}
          gestureController={gestureController(gestureCursor(true, 600, 180), { stop })}
        />,
      );
      expect(recordButton).toHaveClass("is-gesture-armed");
      hitTest.setElement(resetButton);
      rerender(
        <StudentPlayer
          definition={suppliedRecordLab}
          gestureController={gestureController(gestureCursor(false, 600, 180), { stop })}
        />,
      );
    } finally {
      hitTest.restore();
    }

    expect(screen.getByText("Progress: 0 completed / 1 total")).toBeInTheDocument();
    expect(recordButton).not.toHaveClass("is-gesture-armed");
    expect(stop).not.toHaveBeenCalled();
  });

  it("stops camera control on reset and unmount", () => {
    const stop = vi.fn();
    const { unmount } = render(
      <StudentPlayer
        definition={filtrationTechnique}
        gestureController={gestureController(undefined, { stop })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    expect(stop).toHaveBeenCalledTimes(1);
    unmount();
    expect(stop).toHaveBeenCalledTimes(2);
  });

  it("shows Goblin mode only for the standalone filtration technique", () => {
    const { rerender } = render(<StudentPlayer definition={filtrationTechnique} />);
    expect(screen.getByRole("button", { name: /goblin mode/i })).toHaveAttribute("aria-pressed", "false");

    rerender(<StudentPlayer definition={demoLab} />);
    expect(screen.queryByRole("button", { name: /goblin mode/i })).not.toBeInTheDocument();
  });

  it("lets Goblin mode advance the current filtration step and reset cleanly", async () => {
    render(<StudentPlayer definition={filtrationTechnique} />);
    fireEvent.click(screen.getByRole("button", { name: /goblin mode/i }));
    expect(screen.getByRole("button", { name: /goblin mode/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText(/goblin mode status/i)).toHaveTextContent(/handling the next lab step/i);
    expect(screen.getByLabelText(/^workbench$/i).querySelector(".workbench-goblin-action")).not.toBeNull();

    const process = screen.getByLabelText(/process and current step/i);
    await waitFor(
      () => {
        const firstStep = process.querySelector(".process-list .process-step");
        expect(firstStep).toHaveAttribute("aria-current", "step");
        expect(firstStep).toHaveTextContent(/place filter paper/i);
      },
      { timeout: 2_600 },
    );

    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    expect(screen.getByRole("button", { name: /goblin mode/i })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByLabelText(/goblin mode status/i)).not.toBeInTheDocument();
  });

  it("moves the active process step to the top of the sidebar", () => {
    render(<StudentPlayer definition={filtrationTechnique} />);
    clickCurrentStepControl();
    clickCurrentStepControl();

    const process = screen.getByLabelText(/process and current step/i);
    const firstStep = process.querySelector(".process-list .process-step");
    expect(firstStep).toHaveAttribute("aria-current", "step");
    expect(firstStep).toHaveTextContent(/wet filter paper/i);
  });

  it("keeps the current step card compact and action-forward", () => {
    render(<StudentPlayer definition={filtrationTechnique} />);
    const process = screen.getByLabelText(/process and current step/i);
    const currentStep = process.querySelector("[aria-current='step']");
    if (!(currentStep instanceof HTMLElement)) throw new Error("Missing current process step.");

    expect(currentStep.querySelector(".current-step-detail h4")).toBeNull();
    expect(currentStep.querySelector(".step-procedure")).toBeNull();
    expect(currentStep.querySelector(".step-affordance")).toHaveTextContent(/do this/i);
    expect(currentStep.querySelector(".step-affordance")).toHaveTextContent(/seat the glass funnel in the circular support ring on the stand/i);
    expect(currentStep.querySelector(".step-affordance")).not.toHaveTextContent(/put filter paper in the funnel/i);
    expect(currentStep.querySelector(".current-step-detail")?.lastElementChild).toHaveClass("step-evidence");
    expect(screen.getByRole("tab", { name: /^now$/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /^process$/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /evidence/i })).toBeInTheDocument();
    expect(within(currentStep).getByRole("progressbar")).toHaveAttribute("value", "0");
    expect(currentStep.querySelector(".step-selection-direction")).not.toBeNull();
    expect(screen.getByText(/action details/i).closest("details")).not.toHaveAttribute("open");
    expect(screen.getByRole("button", { name: /collapse equipment/i })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /collapse inspector/i })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /^guided$/i })).toHaveClass("player-mode-button", "is-active");
  });

  it("shows a changed public hard-water lab active card as one Do this instruction", () => {
    render(<StudentPlayer definition={readPublicLab("hard-water-demo.json")} />);

    const expected =
      "Pour water sample from the sample bottle into the graduated cylinder until the meniscus reaches 20 mL.";
    const currentStep = expectSingleActiveInstruction(expected);
    expect(currentStep.querySelector(".step-hints")).toBeNull();
    expect(currentStep).not.toHaveTextContent(/Use the equipment and action configured/i);
    expect(currentStep).not.toHaveTextContent(/Pour sample bottle into graduated cylinder/i);
    expect(currentStep.querySelector(".current-step-detail")?.lastElementChild).toHaveClass("step-evidence");
  });

  it("shows source and target equipment in a guided measurement action", () => {
    render(<StudentPlayer definition={readPublicLab("hard-water-demo.json")} />);

    const currentStep = screen.getByLabelText(/process and current step/i).querySelector("[aria-current='step']");
    if (!(currentStep instanceof HTMLElement)) throw new Error("Missing current process step.");

    const endpointControl = currentStep.querySelector(".step-endpoint-control");
    if (!(endpointControl instanceof HTMLElement)) throw new Error("Missing endpoint action control.");
    expect(endpointControl).not.toHaveTextContent(/pour into/i);
    expect(endpointControl.querySelectorAll(".step-selection-endpoint img")).toHaveLength(2);
    expect(endpointControl.querySelector(".step-selection-endpoint img")).toHaveAttribute(
      "src",
      expect.stringContaining("sample-bottle"),
    );
    expect(endpointControl.querySelector(".step-control-status")).toHaveTextContent(/ready to measure/i);
  });

  it("keeps the current drag action source-backed and adjacent to its readiness cue", () => {
    render(<StudentPlayer definition={readAcidBaseTitrationLab()} />);

    const process = screen.getByLabelText(/process and current step/i);
    const currentStep = process.querySelector("[aria-current='step']");
    if (!(currentStep instanceof HTMLElement)) throw new Error("Missing current process step.");

    const dragControl = currentStep.querySelector(".step-drag-control");
    if (!(dragControl instanceof HTMLElement)) throw new Error("Missing current drag action.");
    expect(dragControl.querySelectorAll("button[data-gesture-action='confirm-accessible-action']")).toHaveLength(1);
    expect(dragControl.querySelector(".step-selection-endpoint img")).toHaveAttribute(
      "src",
      expect.stringContaining("ring-stand-clamp"),
    );
    expect(dragControl.querySelector(".step-endpoint-art.is-zone")).not.toBeNull();
    expect(dragControl.querySelector(".step-control-status")).toHaveTextContent(/ready for the current action/i);
    expect(dragControl).not.toHaveTextContent(/drag to zone/i);
  });

  it("keeps useful non-redundant public technique hints below one primary instruction", () => {
    render(<StudentPlayer definition={readPublicTechnique("filtration.json")} />);
    clickCurrentStepControl();
    clickCurrentStepControl();
    clickCurrentStepControl();

    const currentStep = expectSingleActiveInstruction("Place the receiving flask under the funnel.");
    const hints = currentStep.querySelector(".step-hints");
    expect(hints).toHaveTextContent(/receiving vessel zone below the funnel/i);
    expect(hints).not.toHaveTextContent(/Use the equipment and action configured/i);
  });

  it("switches Assessment mode to low-scaffold practice", () => {
    render(<StudentPlayer definition={hardWaterDemoLab} />);
    const process = screen.getByLabelText(/process and current step/i);

    expect(process.querySelector(".step-affordance")).not.toBeNull();
    expect(process.querySelector(".step-evidence")).not.toBeNull();
    expect(screen.queryAllByText(/needed now/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /assessment/i }));

    expect(process).toHaveTextContent(/measure sample/i);
    expect(process.querySelector(".step-affordance")).toBeNull();
    expect(process.querySelector(".step-hints")).toBeNull();
    expect(process.querySelector(".step-evidence")).toBeNull();
    expect(screen.queryAllByText(/needed now/i)).toHaveLength(0);
    expect(screen.getByText(/assessment - 0 failed attempts/i)).toBeInTheDocument();
  });

  it("shows the acid-base indicator step as one primary instruction", () => {
    render(<StudentPlayer definition={readAcidBaseTitrationLab()} />);
    clickCurrentStepControl();
    clickCurrentStepControl();
    clickCurrentStepControl();

    const process = screen.getByLabelText(/process and current step/i);
    const currentStep = process.querySelector("[aria-current='step']");
    if (!(currentStep instanceof HTMLElement)) throw new Error("Missing current process step.");

    const expected = "Add 1-2 drops of phenolphthalein indicator to the acid in the Erlenmeyer flask.";
    const instruction = within(currentStep).getByText(expected);
    expect(instruction.closest(".step-affordance")).not.toBeNull();
    expect(within(currentStep).getAllByText(expected)).toHaveLength(1);
    expect(currentStep.querySelector(".step-procedure")).toBeNull();
    expect(currentStep.querySelector(".step-hints")).toBeNull();
    expect(currentStep).not.toHaveTextContent(/Add indicator drops to the Erlenmeyer flask/i);
    expect(currentStep).not.toHaveTextContent(/Add indicator after the acid is in the flask/i);
    expect(currentStep.querySelector(".current-step-detail")?.lastElementChild).toHaveClass("step-evidence");
  });

  it("exposes the filling-funnel placement and removal through the shared accessible gesture action", () => {
    const technique = readPublicTechnique("titration-endpoint.json");
    const lab = readAcidBaseTitrationLab();
    expect(technique.process.nodes).toHaveLength(14);
    expect(lab.process.nodes).toHaveLength(15);

    const { rerender } = render(
      <StudentPlayer definition={technique} focusNodeId="seat-burette-funnel-node" />,
    );
    let process = screen.getByLabelText(/process and current step/i);
    let currentStep = process.querySelector("[aria-current='step']");
    if (!(currentStep instanceof HTMLElement)) throw new Error("Missing funnel placement step.");
    expect(currentStep).toHaveTextContent(/place the glass filling funnel upright/i);
    expect(within(currentStep).getByRole("button", { name: /seat the filling funnel/i })).toHaveAttribute(
      "data-gesture-action",
      "confirm-accessible-action",
    );

    rerender(<StudentPlayer definition={technique} focusNodeId="remove-burette-funnel-node" focusVersion={1} />);
    process = screen.getByLabelText(/process and current step/i);
    currentStep = process.querySelector("[aria-current='step']");
    if (!(currentStep instanceof HTMLElement)) throw new Error("Missing funnel removal step.");
    expect(currentStep).toHaveTextContent(/place it on the workbench/i);
    expect(within(currentStep).getByRole("button", { name: /remove the filling funnel/i })).toHaveAttribute(
      "data-gesture-action",
      "confirm-accessible-action",
    );
  });

  it("grabs and removes the attached filling funnel with a camera pinch", () => {
    const technique = readPublicTechnique("titration-endpoint.json");
    const { rerender } = render(
      <StudentPlayer definition={technique} gestureController={gestureController(undefined)} />,
    );
    for (let index = 0; index < 5; index += 1) clickCurrentStepControl();

    const benchSurface = screen.getByLabelText(/^workbench$/i).querySelector(".bench-surface");
    if (!(benchSurface instanceof HTMLElement)) throw new Error("Missing bench surface.");
    vi.spyOn(benchSurface, "getBoundingClientRect").mockReturnValue(viewportRect);
    const funnelHandle = screen.getByRole("button", {
      name: /remove the filling funnel from the burette/i,
    });
    expect(funnelHandle).toHaveAttribute("data-gesture-drag-kind", "attached-child");
    const sourceItem = funnelHandle.closest<HTMLElement>(".bench-item");
    if (!sourceItem) throw new Error("Missing mounted burette assembly.");
    const startCursor = {
      x: Number.parseFloat(sourceItem.style.left) + Number.parseFloat(funnelHandle.style.left) + 12,
      y: Number.parseFloat(sourceItem.style.top) + Number.parseFloat(funnelHandle.style.top) + 12,
    };
    const releaseCursor = { x: 820, y: 300 };
    const hitTest = withElementFromPoint(funnelHandle);
    try {
      rerender(
        <StudentPlayer
          definition={technique}
          gestureController={gestureController(gestureCursor(true, startCursor.x, startCursor.y))}
        />,
      );

      const preview = gestureDragPreview();
      expect(preview).toBeInTheDocument();
      expect(preview?.querySelector('[data-definition-id="funnel"]')).not.toBeNull();
      expect(preview?.querySelector('[data-definition-id="burette-50ml"]')).toBeNull();
      expect(sourceItem).not.toHaveClass("is-dragging");

      hitTest.setElement(benchSurface);
      rerender(
        <StudentPlayer
          definition={technique}
          gestureController={gestureController(gestureCursor(false, releaseCursor.x, releaseCursor.y))}
        />,
      );
    } finally {
      hitTest.restore();
    }

    expectStepText(/read the initial burette level/i);
    expect(gestureDragPreview()).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove the filling funnel from the burette/i })).not.toBeInTheDocument();
  });

  it("tells students to place the acid flask under the burette before dispensing", () => {
    render(<StudentPlayer definition={readAcidBaseTitrationLab()} />);
    for (let index = 0; index < 5; index += 1) {
      clickCurrentStepControl();
    }

    const process = screen.getByLabelText(/process and current step/i);
    const currentStep = process.querySelector("[aria-current='step']");
    if (!(currentStep instanceof HTMLElement)) throw new Error("Missing current process step.");

    const expected =
      "Place the Erlenmeyer flask containing the acid under the burette, then click the stopcock 496 times to add 24.80 mL of NaOH drop by drop until the solution turns pale pink.";
    expect(currentStep).toHaveTextContent(/dispense titrant/i);
    const instruction = within(currentStep).getByText(expected);
    expect(instruction.closest(".step-affordance")).not.toBeNull();
    expect(within(currentStep).getAllByText(expected)).toHaveLength(1);
    expect(within(currentStep).getByRole("button", { name: /dispense one drop/i })).toBeInTheDocument();
    expect(within(currentStep).getByRole("button", { name: /accept endpoint/i })).toBeDisabled();
  });

  it("dispenses titrant by exact stopcock clicks and shows over-titration", () => {
    render(<StudentPlayer definition={readAcidBaseTitrationLab()} />);
    for (let index = 0; index < 5; index += 1) {
      clickCurrentStepControl();
    }

    const process = screen.getByLabelText(/process and current step/i);
    const dropButton = () => within(process).getByRole("button", { name: /dispense one drop/i });
    const acceptButton = () => within(process).getByRole("button", { name: /accept endpoint/i });
    const dispenseDrop = dropButton();

    fireEvent.click(dispenseDrop);
    expect(process).toHaveTextContent(/1 \/ 496 drops/);
    expect(process).toHaveTextContent(/0\.05 mL delivered/);
    expect(acceptButton()).toBeDisabled();

    for (let index = 1; index < 496; index += 1) {
      fireEvent.click(dispenseDrop);
    }
    expect(process).toHaveTextContent(/496 \/ 496 drops/);
    expect(process).toHaveTextContent(/24\.80 mL delivered/);
    expect(process).toHaveTextContent(/burette 25\.00 mL/);
    expect(acceptButton()).toBeEnabled();

    fireEvent.click(dispenseDrop);
    expect(process).toHaveTextContent(/497 \/ 496 drops/);
    expect(process).toHaveTextContent(/1 extra drop added/i);
    expect(process).toHaveTextContent(/alkaline solution/i);

    fireEvent.click(acceptButton());
    expectStepText(/confirm endpoint/i);
  }, 120_000);

  it("opens lab description from the header About dialog", () => {
    render(<StudentPlayer definition={filtrationTechnique} />);

    expect(screen.queryByText(filtrationTechnique.learningGoal)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /about/i }));

    const dialog = screen.getByRole("dialog", { name: /filter a precipitate/i });
    expect(within(dialog).getByText(filtrationTechnique.learningGoal)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: /close about dialog/i }));
    expect(screen.queryByRole("dialog", { name: /filter a precipitate/i })).not.toBeInTheDocument();
  });

  it("auto-expands the equipment shelf category needed for the current step", () => {
    render(<StudentPlayer definition={filtrationTechnique} />);
    const shelf = screen.getByLabelText(/equipment shelf/i);
    const filtration = within(shelf).getByRole("button", { name: /^filtration/i });

    expect(filtration).toHaveAttribute("aria-expanded", "true");
    expect(filtration).toHaveTextContent(/needed now/i);
    expect(filtration).toHaveTextContent(/collapse/i);
    expect(screen.getByRole("button", { name: /glass funnel, available/i })).toBeInTheDocument();

    fireEvent.click(filtration);
    expect(filtration).toHaveAttribute("aria-expanded", "false");
    expect(filtration).toHaveTextContent(/expand/i);
    expect(filtration).toHaveTextContent(/needed now/i);
    expect(filtration).not.toHaveTextContent(/filter paper/i);
    expect(screen.queryByRole("button", { name: /filter paper, available/i })).not.toBeInTheDocument();
  });

  it("renders compact preview chrome without the lab title", () => {
    render(<StudentPlayer definition={filtrationTechnique} chrome="preview" compact />);
    expect(screen.getByRole("heading", { name: /live preview/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /filter a precipitate/i })).not.toBeInTheDocument();
    expect(screen.getByText("Step: Assemble funnel stand")).toBeInTheDocument();
    expect(screen.getByText(/drag glass funnel onto ring stand/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /guided/i })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /assessment/i }));
    expect(screen.getByRole("button", { name: /assessment/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText(/drag glass funnel onto ring stand/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
  });

  it("can focus preview chrome on a process map node", () => {
    render(<StudentPlayer definition={filtrationTechnique} chrome="preview" compact focusNodeId="wet-filter-node" />);
    expect(screen.getByText("Step: Wet filter paper")).toBeInTheDocument();
    expectStepText(/wet filter paper/i);
  });

  it("preserves bench equipment when preview focus changes", () => {
    const { rerender } = render(
      <StudentPlayer definition={demoLab} chrome="preview" compact focusNodeId="demo-measure-node" />,
    );
    fireEvent.click(screen.getByRole("button", { name: /sample bottle, available/i }));
    fireEvent.click(screen.getByRole("button", { name: /graduated cylinder, available/i }));
    expect(screen.getByText(/2 placed/i)).toBeInTheDocument();

    rerender(<StudentPlayer definition={demoLab} chrome="preview" compact focusNodeId="demo-transfer-node" />);

    expect(screen.getByText("Step: Transfer sample")).toBeInTheDocument();
    expect(screen.getByText(/2 placed/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sample bottle, 120 ml hard water sample/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /graduated cylinder, empty/i })).toBeInTheDocument();
  });

  it("keeps measured history when focusing completed and downstream preview nodes", () => {
    const { rerender } = render(
      <StudentPlayer definition={demoLab} chrome="preview" compact focusNodeId="demo-measure-node" />,
    );
    fireEvent.click(screen.getByRole("button", { name: /sample bottle, available/i }));
    fireEvent.click(screen.getByRole("button", { name: /graduated cylinder, available/i }));
    fireEvent.click(screen.getByRole("button", { name: /sample bottle, 120 ml hard water sample/i }));
    fireEvent.click(screen.getByRole("button", { name: /graduated cylinder, empty/i }));
    clickCurrentStepControl();
    expect(screen.getByText("Step: Transfer sample")).toBeInTheDocument();

    rerender(
      <StudentPlayer
        definition={demoLab}
        chrome="preview"
        compact
        focusNodeId="demo-measure-node"
        focusVersion={1}
      />,
    );

    const preview = screen.getByLabelText(/student player preview/i);
    expect(within(preview).getByText("Step: Measure sample")).toBeInTheDocument();
    expect(within(preview).getByRole("button", { name: /sample bottle, 100 ml hard water sample/i })).toBeInTheDocument();
    expect(within(preview).getByRole("button", { name: /graduated cylinder, 20 ml hard water sample/i })).toBeInTheDocument();
    expect(currentStepControl(preview)).toBeDisabled();

    rerender(
      <StudentPlayer
        definition={demoLab}
        chrome="preview"
        compact
        focusNodeId="demo-filter-node"
        focusVersion={2}
      />,
    );

    expect(within(preview).getByText("Step: Filter mixture")).toBeInTheDocument();
    expect(within(preview).getByText(/preview uses current bench state/i)).toBeInTheDocument();
    expect(within(preview).getByRole("button", { name: /sample bottle, 100 ml hard water sample/i })).toBeInTheDocument();
    expect(within(preview).getByRole("button", { name: /graduated cylinder, 20 ml hard water sample/i })).toBeInTheDocument();
  });

  it("runs a normalized legacy sample rack draft through accessible volume confirmation", () => {
    const legacyDraft = normalizeStudioLabDraft(createLegacySampleRackDraft());
    render(
      <StudentPlayer
        definition={legacyDraft}
        chrome="preview"
        compact
        focusNodeId="demo-measure-node"
      />,
    );

    clickCurrentStepControl();

    const preview = screen.getByLabelText(/student player preview/i);
    expect(within(preview).getByText("Step: Transfer sample")).toBeInTheDocument();
    expect(within(preview).queryByText(/not a realistic pour source/i)).not.toBeInTheDocument();
  });

  it("keeps focused preview node when reset clears runtime state", () => {
    render(<StudentPlayer definition={demoLab} chrome="preview" compact focusNodeId="demo-transfer-node" />);
    fireEvent.click(screen.getByRole("button", { name: /250 ml beaker, available/i }));
    expect(screen.getByText(/1 placed/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /reset/i }));

    expect(screen.getByText("Step: Transfer sample")).toBeInTheDocument();
    expect(screen.getByText(/0 placed/i)).toBeInTheDocument();
    expect(screen.getByText(/preview uses current bench state/i)).toBeInTheDocument();
  });

  it("shows filter-specific feedback when a downstream filter node has no precipitate source", () => {
    render(<StudentPlayer definition={demoLab} chrome="preview" compact focusNodeId="demo-filter-node" />);
    expect(screen.getByText(/preview uses current bench state/i)).toBeInTheDocument();

    clickCurrentStepControl();

    expect(screen.getByText(/the source does not contain a precipitate/i)).toBeInTheDocument();
    expect(screen.queryByText(/does not contain enough material/i)).not.toBeInTheDocument();
  });

  it("keeps compact equipment row placement wired to the workbench", () => {
    render(<StudentPlayer definition={filtrationTechnique} chrome="preview" compact />);
    fireEvent.click(screen.getByRole("button", { name: /filter paper, available/i }));
    expect(screen.getByText(/1 placed/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /filter paper, empty/i })).toBeInTheDocument();
  });

  it("supports pointer-style placement through the shelf and workbench", () => {
    render(<StudentPlayer definition={filtrationTechnique} />);
    expandShelfCategory("Filtration");
    const data = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: "copy",
      getData: (key: string) => data.get(key) ?? "",
      setData: (key: string, value: string) => data.set(key, value),
    };
    fireEvent.dragStart(screen.getByRole("button", { name: /filter paper, available/i }), {
      dataTransfer,
    });
    fireEvent.drop(screen.getByLabelText(/^workbench$/i), {
      clientX: 180,
      clientY: 220,
      dataTransfer,
    });
    expect(screen.getByText(/1 placed/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /filter paper, empty/i })).toBeInTheDocument();
  });

  it("advances the current placement step when the expected shelf item is clicked", () => {
    render(<StudentPlayer definition={readTransmittanceDilutionTechnique()} />);
    expandShelfCategory("Container");

    fireEvent.click(screen.getByRole("button", { name: /volumetric flask, available/i }));

    expect(screen.getByRole("button", { name: /volumetric flask, empty/i })).toBeInTheDocument();
    expect(screen.getByText(/the volumetric flask is upright on the bench\./i)).toBeInTheDocument();
    expectStepText(/place cylinder/i);
    expect(screen.getByText("Progress: 1 completed / 20 total")).toBeInTheDocument();
  });

  it("advances the current placement step when the expected shelf item is dropped on the workbench", () => {
    render(<StudentPlayer definition={readTransmittanceDilutionTechnique()} />);
    expandShelfCategory("Container");
    const data = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: "copy",
      getData: (key: string) => data.get(key) ?? "",
      setData: (key: string, value: string) => data.set(key, value),
    };

    fireEvent.dragStart(screen.getByRole("button", { name: /volumetric flask, available/i }), {
      dataTransfer,
    });
    fireEvent.drop(screen.getByLabelText(/^workbench$/i), {
      clientX: 700,
      clientY: 320,
      dataTransfer,
    });

    expect(screen.getByRole("button", { name: /volumetric flask, empty/i })).toBeInTheDocument();
    expectStepText(/place cylinder/i);
    expect(screen.getByText("Progress: 1 completed / 20 total")).toBeInTheDocument();
  });

  it("keeps non-current shelf placement layout-only", () => {
    render(<StudentPlayer definition={readTransmittanceDilutionTechnique()} />);
    expandShelfCategory("Reagent");

    fireEvent.click(screen.getByRole("button", { name: /wash bottle, available/i }));

    expect(screen.getByRole("button", { name: /wash bottle, 500 ml deionized water/i })).toBeInTheDocument();
    expectStepText(/place flask/i);
    expect(screen.getByText("Progress: 0 completed / 20 total")).toBeInTheDocument();
  });

  it("runs keyboard fallback through the interaction bridge", () => {
    render(<StudentPlayer definition={filtrationTechnique} />);
    clickCurrentStepControl();
    clickCurrentStepControl();
    expectStepText(/wet filter paper/i);
  });

  it("shows notebook record controls only after measurement evidence exists", () => {
    render(<StudentPlayer definition={hardWaterDemoLab} />);
    expect(screen.queryByRole("button", { name: /record sample volume/i })).not.toBeInTheDocument();
    expandShelfCategory("Sample");
    expandShelfCategory("Measurement");
    fireEvent.click(screen.getByRole("button", { name: /sample bottle, available/i }));
    fireEvent.click(screen.getByRole("button", { name: /graduated cylinder, available/i }));
    fireEvent.click(screen.getByRole("button", { name: /sample bottle, 120 ml hard water sample/i }));
    fireEvent.click(screen.getByRole("button", { name: /graduated cylinder, empty/i }));
    clickCurrentStepControl();
    const process = screen.getByLabelText(/process and current step/i);
    fireEvent.click(within(process).getByRole("button", { name: /record sample volume/i }));
    expectStepText(/transfer sample/i);
  });

  it("shows notebook record controls when the action supplies measurement evidence", () => {
    render(<StudentPlayer definition={suppliedRecordLab} />);
    const process = screen.getByLabelText(/process and current step/i);

    expect(within(process).getByText("0.2 mL")).toBeInTheDocument();
    fireEvent.click(within(process).getByRole("button", { name: /record initial burette reading/i }));

    expect(screen.getByText("Progress: 1 completed / 1 total")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /record initial burette reading/i })).not.toBeInTheDocument();
    expect(screen.getAllByText("0.2 mL").length).toBeGreaterThan(0);
  });

  it("disables interaction controls after hard-water completion", () => {
    render(<StudentPlayer definition={hardWaterDemoLab} />);
    clickCurrentStepControl();
    fireEvent.click(screen.getByRole("button", { name: /record sample volume/i }));
    for (let index = 0; index < 10; index += 1) {
      clickCurrentStepControl();
    }
    fireEvent.click(screen.getByRole("button", { name: /record dry mass/i }));
    fireEvent.click(screen.getByRole("button", { name: /submit hardness calculation/i }));

    expect(screen.getByText(/375\.00 mg\/L as CaCO3/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /submit hardness calculation/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /confirm accessible action/i })).not.toBeInTheDocument();
  }, 15000);

  it("executes the current action when a dragged object is released over the valid target", async () => {
    render(<StudentPlayer definition={filtrationTechnique} />);
    expandShelfCategory("Filtration");
    clickCurrentStepControl();
    await waitFor(() => expectStepText(/place filter paper/i));
    fireEvent.click(screen.getByRole("button", { name: /filter paper, available/i }));

    const filterPaper = screen.getByRole("button", { name: /filter paper, empty/i });
    const benchSurface = screen.getByLabelText(/^workbench$/i).querySelector(".bench-surface");
    if (!benchSurface) throw new Error("Missing bench surface.");

    const target = screen.getByRole("button", { name: /funnel and stand, empty/i });
    dragPlacedEquipmentTo(
      filterPaper,
      benchSurface,
      overlapPointForZone(target, "filter-paper", "funnel-stand", "funnel-stand-paper-seat"),
      1,
    );

    await waitFor(() => expectStepText(/wet filter paper/i));
  });

  it("keeps Assessment direct manipulation wired while hiding bench guidance", async () => {
    render(<StudentPlayer definition={filtrationTechnique} />);
    fireEvent.click(screen.getByRole("button", { name: /assessment/i }));
    expandShelfCategory("Filtration");
    fireEvent.click(screen.getByRole("button", { name: /glass funnel, available/i }));
    fireEvent.click(screen.getByRole("button", { name: /ring stand, available/i }));

    const workbench = screen.getByLabelText(/^workbench$/i);
    const benchSurface = workbench.querySelector(".bench-surface");
    if (!benchSurface) throw new Error("Missing bench surface.");
    expect(workbench.querySelector(".is-expected-source")).toBeNull();
    expect(workbench.querySelector(".is-expected-target")).toBeNull();

    const ringStand = screen.getByRole("button", { name: /ring stand, empty/i });
    dragPlacedEquipmentTo(
      screen.getByRole("button", { name: /glass funnel, empty/i }),
      benchSurface,
      overlapPointForZone(ringStand, "funnel", "ring-stand", "ring-stand-funnel-seat"),
      1,
    );

    await waitFor(() => expectStepText(/place filter paper/i));
  });

  it("records invalid Assessment overlap attempts as failed evidence", async () => {
    render(<StudentPlayer definition={filtrationTechnique} />);
    fireEvent.click(screen.getByRole("button", { name: /assessment/i }));
    expandShelfCategory("Filtration");
    fireEvent.click(screen.getByRole("button", { name: /glass funnel, available/i }));
    fireEvent.click(screen.getByRole("button", { name: /filter paper, available/i }));

    const benchSurface = screen.getByLabelText(/^workbench$/i).querySelector(".bench-surface");
    if (!benchSurface) throw new Error("Missing bench surface.");
    const filterPaper = screen.getByRole("button", { name: /filter paper, empty/i });
    dragPlacedEquipmentTo(
      screen.getByRole("button", { name: /glass funnel, empty/i }),
      benchSurface,
      benchPointFor(filterPaper),
      1,
    );

    await waitFor(() => expect(screen.getByText(/not the correct target/i)).toBeInTheDocument());
    expect(screen.getByText(/assessment - 1 failed attempts/i)).toBeInTheDocument();
    expectStepText(/assemble funnel stand/i);
  });

  it("requires explicit Assessment source and target selection for accessible fallback", async () => {
    render(<StudentPlayer definition={filtrationTechnique} />);
    fireEvent.click(screen.getByRole("button", { name: /assessment/i }));
    expandShelfCategory("Filtration");
    fireEvent.click(screen.getByRole("button", { name: /glass funnel, available/i }));
    fireEvent.click(screen.getByRole("button", { name: /ring stand, available/i }));

    const process = screen.getByLabelText(/process and current step/i);
    expect(within(process).getAllByText(/not selected/i)).toHaveLength(2);
    expect(currentStepControl(process)).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /glass funnel, empty/i }));
    expect(currentStepControl(process)).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /ring stand, empty/i }));
    expect(currentStepControl(process)).toBeEnabled();
    clickCurrentStepControl(process);

    await waitFor(() => expectStepText(/place filter paper/i));
  });

  it("targets seated filter paper through the funnel composite", async () => {
    render(<StudentPlayer definition={filtrationTechnique} />);
    expandShelfCategory("Filtration");
    expandShelfCategory("Reagent");
    clickCurrentStepControl();
    await waitFor(() => expectStepText(/place filter paper/i));
    fireEvent.click(screen.getByRole("button", { name: /filter paper, available/i }));
    fireEvent.click(screen.getByRole("button", { name: /wash bottle, available/i }));

    const benchSurface = screen.getByLabelText(/^workbench$/i).querySelector(".bench-surface");
    if (!benchSurface) throw new Error("Missing bench surface.");

    const emptyFunnel = screen.getByRole("button", { name: /funnel and stand, empty/i });
    dragPlacedEquipmentTo(
      screen.getByRole("button", { name: /filter paper, empty/i }),
      benchSurface,
      overlapPointForZone(emptyFunnel, "filter-paper", "funnel-stand", "funnel-stand-paper-seat"),
      1,
    );
    await waitFor(() => expectStepText(/wet filter paper/i));

    const preparedFunnel = screen.getByRole("button", { name: /funnel and stand, empty/i });
    dragPlacedEquipmentTo(
      screen.getByRole("button", { name: /wash bottle, 500 ml deionized water/i }),
      benchSurface,
      overlapPointForZone(preparedFunnel, "wash-bottle", "funnel-stand", "funnel-stand-paper-seat"),
      2,
    );

    await waitFor(() => expectStepText(/place receiver/i));
  });

  it("does not execute overlap logic for a click without drag movement", () => {
    render(<StudentPlayer definition={filtrationTechnique} />);
    expandShelfCategory("Filtration");
    clickCurrentStepControl();
    fireEvent.click(screen.getByRole("button", { name: /filter paper, available/i }));

    const filterPaper = screen.getByRole("button", { name: /filter paper, empty/i });
    const benchSurface = screen.getByLabelText(/^workbench$/i).querySelector(".bench-surface");
    if (!benchSurface) throw new Error("Missing bench surface.");

    const target = screen.getByRole("button", { name: /funnel and stand, empty/i });
    dragPlacedEquipmentTo(
      filterPaper,
      benchSurface,
      overlapPointForZone(target, "filter-paper", "funnel-stand", "funnel-stand-paper-seat"),
      1,
    );
    expectStepText(/wet filter paper/i);

    const preparedFunnel = screen.getByRole("button", { name: /funnel and stand, empty/i });
    fireEvent.pointerDown(preparedFunnel, { clientX: 180, clientY: 88, pointerId: 2 });
    fireEvent.pointerUp(preparedFunnel, { clientX: 180, clientY: 88, pointerId: 2 });

    expect(screen.queryByText(/not the correct target/i)).not.toBeInTheDocument();
    expectStepText(/wet filter paper/i);
  });

  it("loads the complete hand-warmer lab with an accessible SAF-01 action", async () => {
    const handWarmer = readPublicLab("hand-warmer-calorimetry.json");
    render(<StudentPlayer definition={handWarmer} />);

    expect(screen.getByRole("heading", { name: "Designing an Effective Hand Warmer" })).toBeInTheDocument();
    const currentStep = expectSingleActiveInstruction("Put on splash-proof safety goggles.");
    const action = within(currentStep).getByRole("button", {
      name: "Put on splash-proof safety goggles",
    });
    expect(action).toHaveAttribute("data-gesture-action", "record-evidence");
    fireEvent.click(action);

    await waitFor(() => {
      expectSingleActiveInstruction("Put on protective gloves.");
    });
    expect(screen.getByText("SAF-01 complete.")).toBeInTheDocument();
  });

  it("completes CAL-05 through the equivalent accessible process button", async () => {
    const handWarmer = readPublicTechnique("hand-warmer-calorimetry.json");
    const cal05 = handWarmer.actions.find((action) => action.id === "CAL-05");
    const cal05Node = handWarmer.process.nodes.find((node) => node.actionId === "CAL-05");
    if (!cal05 || !cal05Node) throw new Error("Missing CAL-05 fixture.");
    const focusedTechnique: TechniqueDefinition = {
      ...handWarmer,
      id: "hand-warmer-cal-05-button-regression",
      actions: [{ ...cal05, prerequisites: [] }],
      process: {
        startNodeId: cal05Node.id,
        nodes: [cal05Node],
        edges: [],
      },
    };

    render(<StudentPlayer definition={focusedTechnique} />);
    const currentStep = expectSingleActiveInstruction("Insert the thermometer through the cover hole.");
    fireEvent.click(within(currentStep).getByRole("button", {
      name: "Insert the thermometer through the cover hole",
    }));

    await waitFor(() => expect(screen.getByText("CAL-05 complete.")).toBeInTheDocument());
  });
});
