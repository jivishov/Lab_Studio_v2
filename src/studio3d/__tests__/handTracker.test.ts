import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HAND_GAP_MS, type HandFrame, type Landmark } from "../hand/handCore";
import { HandController, type HandApi } from "../hand/handController";
import { HandTracker, type HandTrackerHooks } from "../hand/handTracker";
import { HAND_DEFAULTS, setHandSettings } from "../hand/handTuning";

/**
 * The webcam pipeline (adoption P4, decided 2026-10-04), transcribed and adapted from the DNA
 * microarray lab's `3d-v3/tests/camera-lifecycle.test.cjs`: packets are fed straight into
 * `result`, so no camera or MediaPipe is needed. Written, not run.
 */

let now = 0;
beforeEach(() => {
  now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  setHandSettings({ ...HAND_DEFAULTS });
});
afterEach(() => vi.restoreAllMocks());

const fixture = (overrides: Partial<HandTrackerHooks> = {}) => {
  const events = { frames: [] as HandFrame[], edges: [] as string[], lost: 0, status: [] as string[] };
  const cam = new HandTracker({
    bounds: () => ({ width: 1000, height: 700 }),
    status: (s) => events.status.push(s),
    active: () => undefined,
    lost: () => { events.lost += 1; },
    frame: (f) => events.frames.push(f),
    edge: (e) => events.edges.push(e),
    ...overrides,
  });
  return { cam, events };
};

/** A right hand in metric world coordinates; `pressed` moves the thumb tip down. */
const skeleton = (pressed = false): Landmark[] => {
  const coords = [[0, 0, 0], [0.018, 0.008, 0], [0.037, 0.015, 0], [0.054, 0.013, 0], [0.066, 0.02, 0],
    [0.02, 0.045, 0], [0.02, 0.075, 0], [0.02, 0.063, -0.01], [0.02, 0.054, -0.012],
    [0, 0.047, 0], [0, 0.08, 0], [0, 0.065, -0.01], [0, 0.05, -0.01],
    [-0.016, 0.043, 0], [-0.016, 0.073, 0], [-0.016, 0.062, -0.01], [-0.016, 0.05, -0.01],
    [-0.031, 0.033, 0], [-0.031, 0.06, 0], [-0.031, 0.05, -0.01], [-0.031, 0.04, -0.01]];
  if (pressed) { coords[3] = [0.05, 0.03, 0]; coords[4] = [0.049, 0.047, 0.004]; }
  return coords.map(([x, y, z]) => ({ x, y, z }));
};
const packet = (stamp: number, { name = "Right", pressed = false, dy = 0, dx = 0, world = skeleton(pressed) as Landmark[] | null } = {}) => ({
  stamp, inferenceMS: 15,
  landmarks: [skeleton(pressed).map((p) => ({ x: 0.5 + p.x * 3 + dx, y: 0.45 - p.y * 3 + dy, z: p.z * 3 }))],
  worldLandmarks: world ? [world] : [],
  handedness: [[{ categoryName: name, score: 0.99 }]],
});

describe("HandTracker (camera.js)", () => {
  it("leaves mouse mode, with no stream, when the camera is denied", async () => {
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => { throw Object.assign(new Error("denied"), { name: "NotAllowedError" }); } } });
    const { cam, events } = fixture();
    cam.video = { pause() {}, play: async () => undefined, srcObject: null } as unknown as HTMLVideoElement;
    await cam.start();
    expect(cam.running).toBe(false);
    expect(cam.video.srcObject).toBeNull();
    expect(events.status.at(-1)).toMatch(/permission was denied/);
  });

  it("rejects stale, repeated and out-of-order packets without any gesture edge", () => {
    now = 1000;
    const { cam, events } = fixture();
    cam.running = true;
    cam.result(packet(1000));
    expect(events.frames).toHaveLength(1);
    cam.result(packet(1000));
    cam.result(packet(999));
    cam.result(packet(1001));
    cam.result(packet(700));
    expect(events.frames).toHaveLength(1);
    expect(events.edges).toHaveLength(0);
    expect(cam.stats.rejectedFrames).toBe(4);
    cam.stop();
  });

  it("waits for a recently seen hand before calibrating", () => {
    const { cam, events } = fixture();
    cam.running = true;
    cam.modelReady = true;
    cam.capture("rest");
    expect(cam.captureState).toBeNull();
    expect(events.status.at(-1)).toMatch(/tracking is stable/);
    cam.result(packet(now));
    now = HAND_GAP_MS + 60;
    cam.capture("rest");
    expect(cam.captureState).toBeNull();
    cam.result(packet(now));
    cam.capture("rest");
    expect(cam.captureState).not.toBeNull();
    cam.stop();
  });

  it("calibrates one hand from world geometry, never from a packet without it", () => {
    const { cam } = fixture();
    cam.running = true;
    cam.modelReady = true;
    cam.result(packet(now));
    cam.capture("rest");
    now = 700; cam.result(packet(now));
    expect(cam.captureState?.samples).toHaveLength(1);
    now = 800; cam.result(packet(now, { name: "Left" }));
    expect(cam.captureState?.samples).toHaveLength(1);
    now = 1000; cam.result(packet(now, { world: null }));
    expect(cam.captureState?.samples).toHaveLength(1);
    for (now = 1100; now <= 1500; now += 100) cam.result(packet(now));
    cam.finishCapture();
    expect(cam.profiles.rest).toBeDefined();
    cam.stop();
  });

  it("presses and releases the plunger from a calibrated thumb, as edges", () => {
    const { cam, events } = fixture();
    cam.running = true;
    cam.modelReady = true;
    cam.result(packet(now));
    cam.capture("rest");
    for (now = 700; now <= 1300; now += 100) cam.result(packet(now));
    cam.finishCapture();
    now = 1500;
    cam.capture("press");
    for (now = 2200; now <= 2800; now += 100) cam.result(packet(now, { pressed: true }));
    cam.finishCapture();
    expect(cam.calibrated).toBe(true);
    for (const [t, pressed] of [[5000, false], [5100, false], [5230, false], [5300, true], [5370, true], [5450, false], [5530, false]] as const) {
      now = t;
      cam.result(packet(now, { pressed }));
    }
    expect(events.edges).toEqual(["press", "release"]);
    cam.stop();
  });

  it("feeds a draw through the controller: lock, squeeze, lower, let go", () => {
    const log: string[] = [];
    const target = { id: "beaker", kind: "item" as const, instanceId: "beaker", x: 500, y: 350, r: 400 };
    const api = {
      targets: () => [target], expectedId: () => undefined, assist: () => false, carrying: () => true,
      aimCarry: () => ({ action: "draw" as const, pour: false, tip: false }), carryDepth: () => undefined,
      commitCarry: () => log.push("commit"), say: (s: string) => log.push(s), focus: () => undefined, dropMode: () => false,
      bounds: () => ({ width: 1000, height: 700 }), blocked: () => false,
    } as unknown as HandApi;
    const c = new HandController(api);
    const { cam } = fixture({ frame: (f) => c.feed(f), edge: (e, f) => (e === "press" ? c.press(f) : c.release()), lost: () => c.resetMotion() });
    cam.running = true;
    cam.modelReady = true;
    cam.result(packet(now));
    cam.capture("rest");
    for (now = 700; now <= 1300; now += 100) cam.result(packet(now));
    cam.finishCapture();
    now = 1500;
    cam.capture("press");
    for (now = 2200; now <= 2800; now += 100) cam.result(packet(now, { pressed: true }));
    cam.finishCapture();
    const send = (t: number, pressed = false, dy = 0) => { now = t; cam.result(packet(now, { pressed, dy })); };
    send(5000); send(5100); send(5230); send(5300, true); send(5370, true); send(5450, true, 0.046); send(5520, false, 0.046); send(5610, false, 0.046);
    expect(log).toContain("commit");
    cam.stop();
  });

  it("does not let a calibrated hand hand control silently to the other hand", () => {
    now = 1000;
    const { cam, events } = fixture();
    cam.running = true;
    cam.modelReady = true;
    (cam as unknown as { calibrationHand: string }).calibrationHand = "Right";
    cam.result(packet(now, { name: "Left" }));
    expect(events.frames).toHaveLength(0);
    now = 1030;
    cam.result(packet(now));
    expect(events.frames).toHaveLength(1);
    cam.stop();
  });

  it("pinch mode needs no calibration, sets its home itself, and gain changes the cursor's travel, never the palm coordinates", () => {
    const { cam, events } = fixture();
    cam.setMode("pinch");
    cam.running = true;
    cam.modelReady = true;
    expect(cam.calibrated).toBe(true);
    for (let i = 0; i < 22; i += 1) { now = i * 40; cam.result(packet(now)); }
    expect(cam.home).not.toBeNull();
    const travel = (gain: number) => {
      setHandSettings({ gain, smoothing: 0 });
      now += 400; cam.result(packet(now, { dx: 0.05 }));
      now += 40; cam.result(packet(now, { dx: 0.05 }));
      const f = events.frames.at(-1)!;
      return { x: f.x, rawX: f.rawX, palmY: f.palmY };
    };
    const slow = travel(1.5), fast = travel(3);
    expect(Math.abs(fast.x - 500)).toBeGreaterThan(Math.abs(slow.x - 500) * 1.6);
    expect(slow.rawX).toBe(fast.rawX);
    expect(slow.palmY).toBe(fast.palmY);
    cam.stop();
  });
});
