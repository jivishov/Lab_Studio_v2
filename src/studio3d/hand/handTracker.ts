import type { HandLandmarker } from "@mediapipe/tasks-vision";
import { clamp, HAND_GAP_MS, measureHand, norm, OneEuro, PressGate, sub, thumbDepth, type HandFrame, type HandMeasure, type Landmark } from "./handCore";
import { filterParams, handSettings } from "./handTuning";

/**
 * Webcam hand tracking for Player3D, transcribed from the DNA microarray 3D lab's `3d-v3/camera.js`
 * (`ClassroomWebcam`, decided 2026-10-03/04; `proposals/MICROARRAY_ADOPTION.md` §7). Frames stay in
 * this tab and its inference worker, and are never stored. 640 × 480 at up to 30 fps, at most one
 * frame every 31 ms; packets older than 400 ms are dropped.
 *
 * The cursor is the palm point (wrist and the index and pinky knuckles), mapped around a home
 * position (the median of the first 20 frames) with the settings' gain (×1.3 vertically) and One Euro
 * smoothing. The plunger is a calibrated thumb press (Rest and Press captured for about 3 s each;
 * a press counts at 55% of the travel, a release under 30%) or, in pinch mode, a thumb-to-index
 * pinch. Calibration is kept in memory only. Unlike the source, the worker is a module worker
 * (`handWorker.ts`) and MediaPipe is the bundled package, never a CDN.
 */

/** Debounce the pose classifiers: one misread frame must not drop the held item or cancel a stroke. */
const GRIP_RELEASE_MS = 220, OPEN_CONFIRM_MS = 150, THUMB_HOLD_MS = 200;
/** A quick real thumb press rarely reaches the depth held during calibration, so it counts from 55% of the calibrated travel. */
export const THUMB_BANDS = { rest: 0.3, press: 0.55 };
export const PINCH_BANDS = { rest: 0.28, press: 0.65 };

export type Handedness = "Auto" | "Right" | "Left";
export interface CalibrationProfiles { rest?: number[]; press?: number[] }
export interface HandStats { frames: number; inferenceMS: number; ageMS: number; lost: number; rejectedFrames: number }

export interface HandTrackerHooks {
  /** The bench canvas size the cursor maps onto. */
  bounds: () => { width: number; height: number };
  status: (message: string, error: boolean) => void;
  active: (on: boolean) => void;
  lost: () => void;
  home?: (home: { x: number; y: number }) => void;
  calibration?: (profiles: CalibrationProfiles) => void;
  frame: (f: HandFrame) => void;
  edge: (edge: "press" | "release", f: HandFrame) => void;
  meter?: (f: HandFrame, stats: HandStats, hand: string | null) => void;
}

interface ResultPacket {
  stamp: number;
  landmarks?: Landmark[][];
  worldLandmarks?: Landmark[][];
  handedness?: Array<Array<{ categoryName?: string; score?: number }>>;
  inferenceMS?: number;
}

const modelUrl = () => new URL(`${import.meta.env.BASE_URL ?? "/"}mediapipe/models/hand_landmarker.task`.replace(/\/{2,}/g, "/"), window.location.href).toString();

export class HandTracker {
  video?: HTMLVideoElement;
  overlay?: HTMLCanvasElement;
  running = false;
  modelReady = false;
  mode: "thumb" | "pinch";
  preference: Handedness = "Auto";
  profiles: CalibrationProfiles = {};
  home: { x: number; y: number } | null = null;
  backend = "";
  stats: HandStats = { frames: 0, inferenceMS: 0, ageMS: 0, lost: 0, rejectedFrames: 0 };
  gate: PressGate;
  private generation = 0;
  private worker: Worker | null = null;
  private detector: HandLandmarker | null = null;
  private stream: MediaStream | null = null;
  private calibrationHand: string | null = null;
  private homeSamples: Array<{ x: number; y: number }> = [];
  private readonly fx = new OneEuro();
  private readonly fy = new OneEuro();
  private lastSeen = 0;
  private lastSubmit = 0;
  private lastTime = -1;
  private lastPacket = -Infinity;
  private primary: string | null = null;
  private lastPoint: { x: number; y: number } | null = null;
  private lastRaw: { x: number; y: number } | null = null;
  private errors = 0;
  private busy = false;
  private vfc: number | null = null;
  private raf: number | null = null;
  private lostState = false;
  private captureTimer: ReturnType<typeof setTimeout> | null = null;
  private monitor: ReturnType<typeof setInterval> | null = null;
  private cancelInit: (() => void) | null = null;
  private handState: { grip: boolean; open: boolean; notGripSince: number | null; openSince: number | null; last: number } | null = null;
  private thumbHold: { depth: number; at: number } | null = null;
  captureState: { kind: "rest" | "press"; start: number; end: number; samples: number[][]; hand: string | null } | null = null;
  private lastStatus = "";
  private lastError = false;

  constructor(private readonly o: HandTrackerHooks, mode: "thumb" | "pinch" = handSettings().mode) {
    this.mode = mode;
    this.gate = new PressGate(mode === "pinch" ? PINCH_BANDS : THUMB_BANDS);
  }

  get calibrated(): boolean { return this.mode === "pinch" || Boolean(this.profiles.rest && this.profiles.press); }

  setMode(mode: "thumb" | "pinch"): void {
    this.mode = mode;
    this.gate = new PressGate(mode === "pinch" ? PINCH_BANDS : THUMB_BANDS);
    this.cancelCapture();
    this.gate.reset();
    this.o.lost();
    this.lost();
    this.o.calibration?.(this.profiles);
    this.status(mode === "pinch" ? "Pinch mode: touch thumb to index finger to press the plunger."
      : this.calibrated ? "Thumb mode: calibration kept." : "Thumb mode: capture Rest, then Press.");
  }

  /** The comfortable hand position becomes the centre of the bench view. */
  setHome(): boolean {
    if (!this.lastRaw || performance.now() - this.lastSeen > HAND_GAP_MS) { this.status("Show your hand, then set the centre.", true); return false; }
    this.home = { ...this.lastRaw };
    this.homeSamples = [];
    this.fx.reset();
    this.fy.reset();
    this.o.home?.(this.home);
    this.status("Centre set where your hand is now.");
    return true;
  }

  private status(s: string, error = false): void {
    if (this.lastStatus === s && this.lastError === error) return;
    this.lastStatus = s;
    this.lastError = error;
    this.o.status(s, error);
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    const gen = ++this.generation;
    this.status("Opening camera…");
    this.o.active(true);
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error("Camera requires HTTPS or localhost.");
      const video = this.video;
      if (!video) throw new Error("The camera preview is not ready.");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, max: 30 }, facingMode: "user" }, audio: false });
      if (gen !== this.generation) { stream.getTracks().forEach((t) => t.stop()); return; }
      this.stream = stream;
      video.srcObject = stream;
      await video.play();
      if (gen !== this.generation) return;
      for (const track of stream.getVideoTracks()) track.addEventListener("ended", () => {
        if (gen === this.generation) { this.stop(); this.status("Camera disconnected. Mouse controls are available.", true); }
      });
      this.status("Loading on-device hand tracking…");
      if (typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined" && typeof createImageBitmap !== "undefined") {
        try { await this.startWorker(gen); } catch { /* the main-thread fallback follows */ }
        if (gen !== this.generation) return;
      }
      if (!this.worker) {
        const { createHandDetector } = await import("./handDetector");
        const out = await createHandDetector(modelUrl(), false);
        if (gen !== this.generation) { out.detector.close(); return; }
        this.detector = out.detector;
        this.backend = `${out.backend} / main-thread fallback`;
      }
      if (gen !== this.generation) return;
      this.modelReady = true;
      this.primary = null;
      this.lastPoint = null;
      this.lastSeen = performance.now();
      this.lastTime = -1;
      this.lastSubmit = 0;
      this.lastPacket = -Infinity;
      this.errors = 0;
      this.lostState = false;
      this.gate.reset();
      this.fx.reset();
      this.fy.reset();
      this.home = null;
      this.homeSamples = [];
      this.status(this.mode === "pinch" ? "Camera ready. Hold your hand where it is comfortable; the centre is set automatically."
        : this.calibrated ? "Camera ready. Relax the thumb to arm." : "Camera ready. Capture Rest, then Press.");
      this.o.calibration?.(this.profiles);
      this.monitor = setInterval(() => { if (this.running && performance.now() - this.lastSeen > HAND_GAP_MS) this.lost(); }, 80);
      this.schedule(gen);
    } catch (e) {
      if (gen !== this.generation) return;
      this.stop();
      const error = e as { name?: string; message?: string };
      const messages: Record<string, string> = {
        NotAllowedError: "Camera permission was denied. Allow camera access for this page, or continue with the mouse.",
        NotFoundError: "No camera was found. Mouse controls are available.",
        NotReadableError: "The camera is busy. Close other camera apps and try again.",
      };
      this.status(messages[error.name ?? ""] ?? String(error.message ?? e).slice(0, 600), true);
    }
  }

  private async startWorker(gen: number): Promise<void> {
    const w = new Worker(new URL("./handWorker.ts", import.meta.url), { type: "module" });
    this.worker = w;
    let cancel: (() => void) | undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (error?: Error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          if (this.cancelInit === cancel) this.cancelInit = null;
          if (error) reject(error); else resolve();
        };
        const timeout = setTimeout(() => finish(new Error("Worker initialization timeout")), 18000);
        cancel = () => finish(new Error("Cancelled"));
        this.cancelInit = cancel;
        w.onerror = (e) => finish(new Error(e.message));
        w.onmessage = (e: MessageEvent<{ type: string; backend?: string; message?: string }>) => {
          if (gen !== this.generation) return;
          if (e.data.type === "ready") { this.backend = e.data.backend ?? "worker"; finish(); }
          else if (e.data.type === "error") finish(new Error(e.data.message));
        };
        try { w.postMessage({ type: "init", modelUrl: modelUrl() }); } catch (error) { finish(error as Error); }
      });
      if (gen !== this.generation) { w.terminate(); return; }
      w.onmessage = (e: MessageEvent<ResultPacket & { type: string; message?: string }>) => {
        if (gen !== this.generation || this.worker !== w) return;
        this.busy = false;
        if (e.data.type === "result") { this.errors = 0; this.result(e.data); }
        else this.processingError(new Error(e.data.message), gen);
      };
      w.onerror = (e) => { if (gen === this.generation && this.worker === w) { this.stop(); this.status(`Hand worker stopped: ${e.message}`, true); } };
    } catch (e) {
      w.terminate();
      if (this.worker === w) this.worker = null;
      if (this.cancelInit === cancel) this.cancelInit = null;
      throw e;
    }
  }

  private schedule(gen: number): void {
    const video = this.video;
    if (!this.running || gen !== this.generation || !video) return;
    const cb = () => { this.schedule(gen); void this.frame(gen); };
    if (video.requestVideoFrameCallback) this.vfc = video.requestVideoFrameCallback(cb);
    else this.raf = requestAnimationFrame(cb);
  }

  private processingError(error: Error, gen: number): void {
    if (gen !== this.generation || !this.running) return;
    this.busy = false;
    this.lost();
    this.errors += 1;
    if (this.errors > 3) { this.stop(); this.status(`Camera processing failed: ${error.message}`, true); }
  }

  private async frame(gen: number): Promise<void> {
    const now = performance.now(), video = this.video;
    if (!video || !this.running || gen !== this.generation || this.busy || video.readyState < 2 || video.currentTime === this.lastTime || now - this.lastSubmit < 31) return;
    this.lastTime = video.currentTime;
    this.lastSubmit = now;
    this.busy = true;
    const worker = this.worker;
    try {
      if (worker) {
        const bitmap = await createImageBitmap(video);
        if (gen !== this.generation || worker !== this.worker) { bitmap.close(); return; }
        try { worker.postMessage({ type: "frame", bitmap, stamp: now }, [bitmap]); } catch (e) { bitmap.close(); throw e; }
      } else if (this.detector) {
        const start = performance.now(), out = this.detector.detectForVideo(video, now);
        this.busy = false;
        this.errors = 0;
        this.result({ ...out, stamp: now, inferenceMS: performance.now() - start } as ResultPacket);
      }
    } catch (e) {
      this.processingError(e as Error, gen);
    }
  }

  stop(): void {
    this.running = false;
    this.modelReady = false;
    this.generation += 1;
    this.cancelInit?.();
    this.cancelInit = null;
    if (this.monitor) clearInterval(this.monitor);
    this.monitor = null;
    if (this.vfc !== null) this.video?.cancelVideoFrameCallback?.(this.vfc);
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.vfc = this.raf = null;
    this.worker?.terminate();
    this.worker = null;
    this.detector?.close();
    this.detector = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.video) { this.video.pause?.(); this.video.srcObject = null; }
    this.clearOverlay();
    this.busy = false;
    this.cancelCapture();
    this.gate.reset();
    this.fx.reset();
    this.fy.reset();
    this.handState = null;
    this.thumbHold = null;
    this.primary = null;
    this.lastPoint = null;
    this.lastPacket = -Infinity;
    this.lostState = true;
    this.o.lost();
    this.o.active(false);
    this.status("Camera off · mouse control");
  }

  private clearOverlay(): void { this.overlay?.getContext("2d")?.clearRect(0, 0, this.overlay.width, this.overlay.height); }

  private miss(): void { if (performance.now() - this.lastSeen > HAND_GAP_MS) this.lost(); }

  private lost(): void {
    if (!this.lostState) { this.stats.lost += 1; this.o.lost(); this.lostState = true; this.clearOverlay(); }
    this.gate.reset();
    this.fx.reset();
    this.fy.reset();
    this.handState = null;
    this.thumbHold = null;
    if (this.running) {
      this.status(this.captureState ? "Tracking interrupted. Keep the same hand centred for calibration."
        : this.mode === "pinch" ? "Tracking paused. Show your hand again; open the pinch to re-arm."
          : this.calibrated ? "Tracking paused. Relax the thumb to re-arm; nothing pending will complete."
            : "Show your whole working hand, then capture Rest and Press.");
    }
  }

  private cancelCapture(): void {
    if (this.captureTimer) clearTimeout(this.captureTimer);
    this.captureTimer = null;
    this.captureState = null;
  }

  setPreference(value: Handedness): void {
    this.preference = value;
    this.primary = null;
    this.lastPoint = null;
    this.profiles = {};
    this.calibrationHand = null;
    this.cancelCapture();
    this.o.lost();
    this.lost();
    this.o.calibration?.(this.profiles);
    this.status("Working hand changed. Capture Rest and Press again.");
  }

  capture(kind: "rest" | "press"): void {
    if (this.mode === "pinch") { this.status("Pinch mode needs no calibration. Switch to Thumb press in Hand settings to calibrate."); return; }
    if (!this.running) { this.status("Start the camera first.", true); return; }
    if (!this.modelReady) { this.status("Wait for the hand model to finish loading, then calibrate.", true); return; }
    if (kind === "press" && !this.profiles.rest) { this.status("Capture Rest first.", true); return; }
    if (!this.primary || performance.now() - this.lastSeen > HAND_GAP_MS) {
      this.status(`Show your whole working hand until tracking is stable, then capture ${kind === "rest" ? "Rest" : "Press"}.`, true);
      return;
    }
    this.cancelCapture();
    this.gate.reset();
    this.o.lost();
    if (kind === "rest") { this.profiles = {}; this.calibrationHand = null; this.o.calibration?.(this.profiles); }
    const now = performance.now();
    this.captureState = { kind, start: now + 650, end: now + 3850, samples: [], hand: kind === "press" ? this.calibrationHand : null };
    this.status(`Hold a comfortable grip with the thumb ${kind === "rest" ? "relaxed" : "pressed down"}. Keep the same whole hand centred.`);
    this.captureTimer = setTimeout(() => this.finishCapture(), 4050);
  }

  finishCapture(): void {
    const c = this.captureState;
    if (!c) return;
    this.cancelCapture();
    const samples = c.samples;
    if (samples.length < 5) { this.status(`Not enough stable hand frames. Keep the same hand centred and retry ${c.kind === "rest" ? "Rest" : "Press"}.`, true); return; }
    const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
    const profile = Array.from({ length: 7 }, (_, i) => median(samples.map((s) => s[i])));
    const noise = median(samples.map((v) => norm(sub(v, profile)) / Math.sqrt(7)));
    if (noise > 0.14) { this.status("Pose varied too much. Hold one thumb position and retry.", true); return; }
    if (c.kind === "press" && (!this.profiles.rest || c.hand !== this.calibrationHand || norm(sub(profile, this.profiles.rest)) / Math.sqrt(7) < 0.025)) {
      this.status("Press must be distinct from Rest and use the same hand. Retry calibration.", true);
      return;
    }
    if (c.kind === "rest") this.calibrationHand = c.hand;
    this.profiles = { ...this.profiles, [c.kind]: profile };
    this.gate.reset();
    this.o.calibration?.(this.profiles);
    this.status(this.calibrated ? "Calibrated. Relax the thumb; then close your grip over an item." : "Rest saved. Now capture Press.");
  }

  /** One packet from the detector: pick the working hand, measure it, and emit a frame and any plunger edge. */
  result(data: ResultPacket): void {
    if (!this.running) return;
    const now = performance.now(), age = Number.isFinite(data.stamp) ? now - data.stamp : Infinity;
    // A rejected packet is a missed detection: the gesture survives unless no usable frame arrives within the gap limit.
    if (!Number.isFinite(data.stamp) || age < 0 || age > HAND_GAP_MS || data.stamp <= this.lastPacket) { this.stats.rejectedFrames += 1; this.miss(); return; }
    this.lastPacket = data.stamp;
    const lockedHand = this.captureState?.hand || this.calibrationHand;
    const finite = (lm: Landmark[] | undefined) => Array.isArray(lm) && lm.length === 21 && lm.every((v) => v && [v.x, v.y, v.z].every(Number.isFinite));
    let hands = (data.landmarks ?? []).map((lm, i) => ({
      lm, world: data.worldLandmarks?.[i], name: data.handedness?.[i]?.[0]?.categoryName ?? "", score: data.handedness?.[i]?.[0]?.score ?? 0,
    }));
    hands = hands.filter((h) => h.score >= 0.5 && ["Left", "Right"].includes(h.name) && finite(h.lm) && finite(h.world)
      && (this.preference === "Auto" || h.name === this.preference) && (!lockedHand || h.name === lockedHand));
    const lastPoint = this.lastPoint;
    if (lastPoint) hands.sort((a, b) => Math.hypot(a.lm[0].x - lastPoint.x, a.lm[0].y - lastPoint.y) - Math.hypot(b.lm[0].x - lastPoint.x, b.lm[0].y - lastPoint.y));
    const h = hands[0];
    if (!h) { this.miss(); return; }
    if (lastPoint && now - this.lastSeen < 900 && Math.hypot(h.lm[0].x - lastPoint.x, h.lm[0].y - lastPoint.y) > 0.42) { this.miss(); return; }
    // Calibration uses metric world geometry only; never mix image-space fallback poses.
    const m = measureHand(h.world, h.lm);
    if (!m) { this.miss(); return; }
    if (now - this.lastSeen > HAND_GAP_MS) this.lost();
    this.primary = h.name;
    this.lastPoint = { x: h.lm[0].x, y: h.lm[0].y };
    this.lastSeen = now;
    this.lostState = false;
    this.stats.frames += 1;
    this.stats.inferenceMS = data.inferenceMS ?? 0;
    this.stats.ageMS = age;
    this.draw(h.lm);
    if (this.captureState) {
      const c = this.captureState;
      if (!c.hand) c.hand = h.name;
      // Any hand that is not spread open counts: the thumb features do not depend on how tightly the fingers curl.
      if (!m.open && now >= c.start && now <= c.end) {
        c.samples.push(m.features);
        if (c.samples.length === 1 || c.samples.length % 6 === 0) this.status(`Capturing ${c.kind === "rest" ? "Rest" : "Press"}… ${c.samples.length} stable frames`);
      }
      if (now > c.end) this.finishCapture();
      return;
    }
    // Home position: the median palm point over the first steady second of tracking.
    const rawX = 1 - m.palmX, rawY = m.palmY;
    this.lastRaw = { x: rawX, y: rawY };
    if (!this.home) {
      this.homeSamples.push({ x: rawX, y: rawY });
      if (this.homeSamples.length >= 20) {
        const med = (k: "x" | "y") => [...this.homeSamples.map((v) => v[k])].sort((a, b) => a - b)[10];
        this.home = { x: med("x"), y: med("y") };
        this.homeSamples = [];
        this.o.home?.(this.home);
      }
    }
    const tuning = handSettings(), params = filterParams(tuning.smoothing);
    for (const f of [this.fx, this.fy]) { f.minCutoff = params.minCutoff; f.beta = params.beta; }
    const home = this.home ?? { x: 0.5, y: 0.45 }, sx = this.fx.update(rawX, now) ?? rawX, sy = this.fy.update(rawY, now) ?? rawY, bounds = this.o.bounds();
    const nx = clamp(0.5 + (sx - home.x) * tuning.gain), ny = clamp(0.5 + (sy - home.y) * tuning.gain * 1.3);
    const base: HandFrame = { x: nx * bounds.width, y: ny * bounds.height, rawX, palmY: rawY, now, source: "hand", normal: m.normal };
    if (this.mode === "pinch") {
      // Pinch = plunger. Thumb-to-index distance over palm width: about 1 when open, under .4 when pinched.
      const depth = clamp((0.75 - m.pinchRatio) / 0.5), spread = m.extended >= 4 && m.pinchRatio > 0.9;
      const hand = this.stabilize({ grip: !spread, open: spread }, now);
      const edge = this.gate.update(depth, now, true);
      const frame: HandFrame = { ...base, ready: true, thumbDepth: depth, thumbDown: this.gate.active, grip: hand.grip, open: hand.open, hold: this.gate.active, pinch: true };
      this.o.frame(frame);
      this.o.meter?.(frame, this.stats, this.primary);
      if (edge) this.o.edge(edge, frame);
      this.status(`${hand.open ? "Hand spread" : this.gate.active ? "Pinched · plunger pressed" : this.gate.armed ? "Ready · pinch to press" : "Open the pinch to arm"} · ${this.primary} hand`);
      return;
    }
    const hand = this.stabilize(m, now), measured = thumbDepth(m.features, this.profiles.rest, this.profiles.press), valid = this.calibrated && measured.valid;
    // A briefly uncertain thumb keeps its last reading; no press or release edge can occur until it is measured again.
    if (valid) this.thumbHold = { depth: measured.depth, at: now };
    const held = !valid && this.calibrated && Boolean(this.thumbHold) && now - (this.thumbHold?.at ?? 0) <= THUMB_HOLD_MS;
    const depth = valid ? measured.depth : held ? this.thumbHold?.depth ?? 0 : 0;
    const ready = valid || held;
    // Holding an item only needs a hand that is not spread open; picking one up still needs a closed grip.
    const edge = held ? null : this.gate.update(depth, now, valid && !hand.open);
    const frame: HandFrame = { ...base, ready: this.calibrated && (ready || hand.open), thumbDepth: clamp(depth), thumbDown: ready && this.gate.active,
      grip: !hand.open, open: hand.open, hold: hand.grip };
    this.o.frame(frame);
    this.o.meter?.(frame, this.stats, this.primary);
    if (edge) this.o.edge(edge, frame);
    if (ready) this.status(`${hand.open ? "Curl your fingers into a grip" : this.gate.active ? "Thumb pressed" : this.gate.armed ? "Thumb resting · ready" : "Relax thumb to arm"} · ${this.primary} hand`);
    else this.status(this.calibrated ? "Thumb pose uncertain. Relax the thumb and keep the hand visible." : "Tracking is working. Capture Rest and Press to enable actions.");
  }

  /** Grip latches at once and drops only after GRIP_RELEASE_MS without it; an open hand must persist for OPEN_CONFIRM_MS. */
  private stabilize(m: Pick<HandMeasure, "grip" | "open">, now: number) {
    const s = this.handState, grip = m.grip && !m.open;
    if (!s || now - s.last > HAND_GAP_MS || now < s.last) {
      this.handState = { grip, open: m.open, notGripSince: null, openSince: m.open ? now : null, last: now };
      return this.handState;
    }
    s.last = now;
    if (m.open) { s.openSince ??= now; if (now - s.openSince >= OPEN_CONFIRM_MS) { s.open = true; s.grip = false; } }
    else { s.openSince = null; s.open = false; }
    if (grip) { s.grip = true; s.notGripSince = null; }
    else if (!s.open) { s.notGripSince ??= now; if (now - s.notGripSince >= GRIP_RELEASE_MS) s.grip = false; }
    return s;
  }

  private draw(lm: Landmark[]): void {
    const c = this.overlay, ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "#73e0d0";
    ctx.fillStyle = "#f6fffd";
    ctx.lineWidth = 2;
    for (const path of [[0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [5, 9, 10, 11, 12], [9, 13, 14, 15, 16], [13, 17, 18, 19, 20], [0, 17]]) {
      ctx.beginPath();
      path.forEach((i, j) => { const x = (1 - lm[i].x) * c.width, y = lm[i].y * c.height; if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.stroke();
    }
    for (const i of [0, 4, 8]) { ctx.beginPath(); ctx.arc((1 - lm[i].x) * c.width, lm[i].y * c.height, 4, 0, Math.PI * 2); ctx.fill(); }
  }
}
