import { useCallback, useMemo, useRef, useState } from "react";
import {
  advanceGestureTracking,
  coerceGestureCursorSpeed,
  defaultGestureCursorSpeed,
  gestureCursorSpeedStorageKey,
  resetFourFingerScrollState,
  resolveFourFingerScrollSignal,
  type FourFingerScrollTrackerState,
  type GestureCursor,
  type GestureCursorSpeed,
  type GestureFrameStatus,
  type GestureTrackingState,
  type NormalizedGestureLandmark,
} from "./gestureMath";
import { resolveGestureAssetUrl } from "./gestureAssets";
import type {
  GestureCameraStatus,
  GestureController,
  GestureDelegate,
  GestureEngine,
  GestureFrameListener,
  GestureFrameSnapshot,
  GestureFrameSource,
  GestureProviderId,
  GestureRuntimeMetrics,
} from "./gestureTypes";

type ActiveGestureEngine = Exclude<GestureEngine, "none">;

interface GestureWorkerStatusMessage {
  delegate?: GestureDelegate;
  engine?: ActiveGestureEngine;
  message?: string;
  status: "ready" | "error";
  type: "status";
}

interface GestureWorkerFrameMessage {
  bitmapReadyAtMs: number;
  delegate: GestureDelegate;
  engine: ActiveGestureEngine;
  frameId: number;
  frameTimeMs: number;
  gestureName?: string;
  gestureScore?: number;
  handednessName?: string;
  handednessScore?: number;
  inferenceMs: number;
  landmarks: NormalizedGestureLandmark[][];
  sampleStartedAtMs: number;
  sourceHeight: number;
  sourceWidth: number;
  type: "frame";
}

type GestureWorkerMessage = GestureWorkerFrameMessage | GestureWorkerStatusMessage;

interface GestureState {
  delegate: GestureDelegate;
  enabled: boolean;
  engine: GestureEngine;
  message: string;
  metrics: GestureRuntimeMetrics;
  providerId: GestureProviderId;
  providerLabel: string;
  status: GestureCameraStatus;
}

interface RuntimeSample {
  bitmapReadyMs: number;
  captureToCursorMs?: number;
  captureToResultMs: number;
  frameId: number;
  inferenceMs: number;
  processedAtMs: number;
  sampleStartedAtMs: number;
  sampleAgeMs: number;
}

interface RuntimeMetricState {
  attemptedFrames: number;
  lastPublishedAtMs: number;
  processedFrames: number;
  samples: RuntimeSample[];
  skippedFrames: number;
  submittedFrames: number;
}

interface FrameSourceControl {
  publish: (snapshot: GestureFrameSnapshot) => void;
  reset: () => void;
  setRenderListener: (listener: ((frameId: number, renderedAtMs: number) => void) | undefined) => void;
  source: GestureFrameSource;
}

const emptyRuntimeMetrics = (): GestureRuntimeMetrics => ({
  attemptedFrames: 0,
  bitmapReadyMs: 0,
  captureToCursorMs: 0,
  captureToResultMs: 0,
  inferenceMs: 0,
  lastFrameId: 0,
  processedFps: 0,
  processedFrames: 0,
  sampleAgeMs: 0,
  skipRate: 0,
  skippedFrames: 0,
  submittedFrames: 0,
});

const initialFrameSnapshot = (): GestureFrameSnapshot => ({
  frameId: 0,
  frameTimeMs: 0,
  sampleStartedAtMs: 0,
  status: "noHand",
});

const createFrameSource = (): FrameSourceControl => {
  let snapshot = initialFrameSnapshot();
  let renderListener: ((frameId: number, renderedAtMs: number) => void) | undefined;
  const listeners = new Set<GestureFrameListener>();
  const source: GestureFrameSource = {
    getSnapshot: () => snapshot,
    markCursorRendered: (frameId, renderedAtMs) => renderListener?.(frameId, renderedAtMs),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    publish: (next) => {
      snapshot = next;
      listeners.forEach((listener) => listener(next));
    },
    reset: () => {
      snapshot = initialFrameSnapshot();
      listeners.forEach((listener) => listener(snapshot));
    },
    setRenderListener: (listener) => {
      renderListener = listener;
    },
    source,
  };
};

const offState = (): GestureState => ({
  delegate: "none",
  enabled: false,
  engine: "none",
  message: "Camera control is off.",
  metrics: emptyRuntimeMetrics(),
  providerId: "unavailable",
  providerLabel: "Camera control",
  status: "off",
});

const unavailableState = (message: string): GestureState => ({
  delegate: "none",
  enabled: false,
  engine: "none",
  message,
  metrics: emptyRuntimeMetrics(),
  providerId: "unavailable",
  providerLabel: "Unavailable",
  status: "unavailable",
});

const providerLabelForEngine = (engine: ActiveGestureEngine): string =>
  engine === "mediapipe-hand-landmarker"
    ? "MediaPipe Hand Landmarker"
    : "MediaPipe Gesture Recognizer";

const activeProviderState = (engine: ActiveGestureEngine) => ({
  providerId: engine,
  providerLabel: providerLabelForEngine(engine),
});

interface VideoFrameMetadataLike {
  captureTime?: number;
  expectedDisplayTime?: number;
  mediaTime?: number;
  presentedFrames?: number;
}

type VideoFrameCallback = (now: number, metadata: VideoFrameMetadataLike) => void;

type VideoWithFrameCallback = HTMLVideoElement & {
  cancelVideoFrameCallback?: (handle: number) => void;
  requestVideoFrameCallback?: (callback: VideoFrameCallback) => number;
};

const isCameraSupported = (): boolean =>
  typeof window !== "undefined" &&
  typeof Worker !== "undefined" &&
  typeof createImageBitmap === "function" &&
  window.isSecureContext &&
  Boolean(navigator.mediaDevices?.getUserMedia);

const assetUrl = (path: string): string => resolveGestureAssetUrl(import.meta.env.BASE_URL, path);
const workerAssetUrl = (path: string): string => new URL(assetUrl(path), window.location.href).toString();

const preferredVideoConstraints: MediaTrackConstraints = {
  facingMode: "user",
  frameRate: { ideal: 60, min: 30 },
  height: { ideal: 480 },
  width: { ideal: 640 },
};

const fallbackVideoConstraints: MediaTrackConstraints = {
  facingMode: "user",
  height: { ideal: 480 },
  width: { ideal: 640 },
};

const requestGestureCameraStream = async (): Promise<MediaStream> => {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: preferredVideoConstraints,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotAllowedError") throw error;
    return navigator.mediaDevices.getUserMedia({
      audio: false,
      video: fallbackVideoConstraints,
    });
  }
};

const readStoredCursorSpeed = (): GestureCursorSpeed => {
  if (typeof window === "undefined") return defaultGestureCursorSpeed;
  try {
    return coerceGestureCursorSpeed(window.localStorage.getItem(gestureCursorSpeedStorageKey));
  } catch {
    return defaultGestureCursorSpeed;
  }
};

const median = (values: number[]): number => {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};

const freshMetricState = (): RuntimeMetricState => ({
  attemptedFrames: 0,
  lastPublishedAtMs: 0,
  processedFrames: 0,
  samples: [],
  skippedFrames: 0,
  submittedFrames: 0,
});

const metricsFromState = (state: RuntimeMetricState, now: number): GestureRuntimeMetrics => {
  const samples = state.samples;
  const recent = samples.filter((sample) => now - sample.processedAtMs <= 1_000);
  const rendered = samples
    .map((sample) => sample.captureToCursorMs)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const latest = samples.at(-1);
  return {
    attemptedFrames: state.attemptedFrames,
    bitmapReadyMs: median(samples.map((sample) => sample.bitmapReadyMs)),
    captureToCursorMs: median(rendered),
    captureToResultMs: median(samples.map((sample) => sample.captureToResultMs)),
    inferenceMs: median(samples.map((sample) => sample.inferenceMs)),
    lastFrameId: latest?.frameId ?? 0,
    processedFps: recent.length,
    processedFrames: state.processedFrames,
    sampleAgeMs: median(samples.map((sample) => sample.sampleAgeMs)),
    skipRate: state.attemptedFrames > 0 ? state.skippedFrames / state.attemptedFrames : 0,
    skippedFrames: state.skippedFrames,
    submittedFrames: state.submittedFrames,
  };
};

const bitmapForVideo = async (video: HTMLVideoElement): Promise<ImageBitmap> => {
  const sourceWidth = Math.max(1, video.videoWidth || 640);
  const sourceHeight = Math.max(1, video.videoHeight || 480);
  if (sourceWidth <= 640 && sourceHeight <= 480) return createImageBitmap(video);
  const scale = Math.min(640 / sourceWidth, 480 / sourceHeight);
  return createImageBitmap(video, 0, 0, sourceWidth, sourceHeight, {
    resizeHeight: Math.max(1, Math.round(sourceHeight * scale)),
    resizeQuality: "low",
    resizeWidth: Math.max(1, Math.round(sourceWidth * scale)),
  });
};

const cameraMessageForFrame = (
  status: GestureFrameStatus,
  cursor: GestureCursor | undefined,
): string => {
  if (cursor?.tracking === "held") return "Tracking briefly interrupted; keeping the grab held.";
  if (status === "noHand") return "No hand is visible to the camera.";
  if (status === "unstable") return "Keep your whole hand in frame and move slightly closer to the camera.";
  if (cursor?.pinching) return "Pinch held. Move to a lab target and release.";
  if (cursor?.fourFingerScroll?.active) return "Four-finger scroll active.";
  return "Camera cursor ready.";
};

export const useGestureRecognition = (): GestureController => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const workerRef = useRef<Worker | undefined>(undefined);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const animationRef = useRef<number | undefined>(undefined);
  const videoFrameRef = useRef<number | undefined>(undefined);
  const pendingFrameRef = useRef(false);
  const frameIdRef = useRef(0);
  const metricStateRef = useRef<RuntimeMetricState>(freshMetricState());
  const trackingStateRef = useRef<GestureTrackingState | undefined>(undefined);
  const fourFingerScrollRef = useRef<FourFingerScrollTrackerState | undefined>(undefined);
  const sessionRef = useRef(0);
  const stateRef = useRef<GestureState>(offState());
  const cursorSpeedRef = useRef<GestureCursorSpeed>(defaultGestureCursorSpeed);
  const frameControlRef = useRef<FrameSourceControl | undefined>(undefined);
  if (!frameControlRef.current) frameControlRef.current = createFrameSource();
  const frames = frameControlRef.current.source;
  const supported = useMemo(() => isCameraSupported(), []);
  const [state, setState] = useState<GestureState>(() => offState());
  const [cursorSpeed, setCursorSpeedState] = useState<GestureCursorSpeed>(() => {
    const stored = readStoredCursorSpeed();
    cursorSpeedRef.current = stored;
    return stored;
  });

  const updateState = useCallback((next: GestureState | ((current: GestureState) => GestureState)) => {
    setState((current) => {
      const resolved = typeof next === "function" ? next(current) : next;
      stateRef.current = resolved;
      return resolved;
    });
  }, []);

  const publishMetrics = useCallback((force = false) => {
    const now = performance.now();
    const metricState = metricStateRef.current;
    if (!force && now - metricState.lastPublishedAtMs < 500) return;
    metricState.lastPublishedAtMs = now;
    const metrics = metricsFromState(metricState, now);
    updateState((current) => ({ ...current, metrics }));
  }, [updateState]);

  frameControlRef.current.setRenderListener((frameId, renderedAtMs) => {
    const sample = metricStateRef.current.samples.find((candidate) => candidate.frameId === frameId);
    if (sample) {
      sample.captureToCursorMs = Math.max(0, renderedAtMs - sample.sampleStartedAtMs);
      publishMetrics();
    }
  });

  const cleanupRuntime = useCallback(() => {
    if (animationRef.current !== undefined) {
      window.cancelAnimationFrame(animationRef.current);
      animationRef.current = undefined;
    }
    const video = videoRef.current as VideoWithFrameCallback | null;
    if (videoFrameRef.current !== undefined) {
      video?.cancelVideoFrameCallback?.(videoFrameRef.current);
      videoFrameRef.current = undefined;
    }
    workerRef.current?.postMessage({ type: "close" });
    workerRef.current?.terminate();
    workerRef.current = undefined;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = undefined;
    pendingFrameRef.current = false;
    metricStateRef.current = freshMetricState();
    trackingStateRef.current = undefined;
    fourFingerScrollRef.current = resetFourFingerScrollState();
    frameControlRef.current?.reset();
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const stop = useCallback(() => {
    sessionRef.current += 1;
    cleanupRuntime();
    updateState(supported ? offState() : unavailableState("Camera control is unavailable in this browser context."));
  }, [cleanupRuntime, supported, updateState]);

  const setCursorSpeed = useCallback((speed: number) => {
    const nextSpeed = coerceGestureCursorSpeed(speed);
    cursorSpeedRef.current = nextSpeed;
    setCursorSpeedState(nextSpeed);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(gestureCursorSpeedStorageKey, String(nextSpeed));
    } catch {
      // Cursor response is the only persisted gesture preference.
    }
  }, []);

  const scheduleRecognition = useCallback((session: number) => {
    const submitFrame = async (frameTimeMs: number, metadata?: VideoFrameMetadataLike) => {
      if (sessionRef.current !== session) return;
      const video = videoRef.current;
      if (!video || !workerRef.current || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      const metricState = metricStateRef.current;
      metricState.attemptedFrames += 1;
      if (pendingFrameRef.current) {
        metricState.skippedFrames += 1;
        publishMetrics();
        return;
      }
      pendingFrameRef.current = true;
      const sampleStartedAtMs =
        typeof metadata?.captureTime === "number" && Number.isFinite(metadata.captureTime)
          ? metadata.captureTime
          : frameTimeMs;
      let frame: ImageBitmap | undefined;
      try {
        frame = await bitmapForVideo(video);
        const bitmapReadyAtMs = performance.now();
        const worker = workerRef.current;
        if (sessionRef.current !== session || !worker) {
          frame.close();
          pendingFrameRef.current = false;
          return;
        }
        const frameId = frameIdRef.current + 1;
        frameIdRef.current = frameId;
        metricState.submittedFrames += 1;
        worker.postMessage(
          {
            bitmapReadyAtMs,
            frame,
            frameId,
            frameTimeMs,
            sampleStartedAtMs,
            type: "recognize",
          },
          [frame],
        );
        frame = undefined;
      } catch {
        frame?.close();
        sessionRef.current += 1;
        cleanupRuntime();
        pendingFrameRef.current = false;
        updateState(unavailableState("Camera frames could not be prepared for gesture recognition."));
      }
    };
    const scheduleWithAnimationFrame = () => {
      const recognizeFrame = (time: number) => {
        if (sessionRef.current !== session) return;
        animationRef.current = window.requestAnimationFrame(recognizeFrame);
        void submitFrame(time);
      };
      animationRef.current = window.requestAnimationFrame(recognizeFrame);
    };
    const video = videoRef.current as VideoWithFrameCallback | null;
    if (!video?.requestVideoFrameCallback) {
      scheduleWithAnimationFrame();
      return;
    }
    const recognizeVideoFrame: VideoFrameCallback = (time, metadata) => {
      videoFrameRef.current = undefined;
      if (sessionRef.current !== session) return;
      videoFrameRef.current = video.requestVideoFrameCallback?.(recognizeVideoFrame);
      void submitFrame(time, metadata);
    };
    videoFrameRef.current = video.requestVideoFrameCallback(recognizeVideoFrame);
  }, [cleanupRuntime, publishMetrics, updateState]);

  const start = useCallback(async () => {
    if (!supported) {
      updateState(unavailableState("Camera control requires localhost or HTTPS, webcam access, and worker support."));
      return;
    }
    if (stateRef.current.enabled || stateRef.current.status === "starting") return;

    const session = sessionRef.current + 1;
    sessionRef.current = session;
    cleanupRuntime();
    updateState({
      delegate: "none",
      enabled: true,
      engine: "none",
      message: "Requesting camera permission.",
      metrics: emptyRuntimeMetrics(),
      providerId: "unavailable",
      providerLabel: "Camera control",
      status: "starting",
    });

    try {
      const stream = await requestGestureCameraStream();
      if (sessionRef.current !== session) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        void videoRef.current.play().catch(() => undefined);
      }

      const worker = new Worker(new URL("./gestureWorker.ts", import.meta.url), { type: "module" });
      if (sessionRef.current !== session) {
        worker.terminate();
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      workerRef.current = worker;
      const handleWorkerFailure = (message: string) => {
        if (sessionRef.current !== session) return;
        sessionRef.current += 1;
        cleanupRuntime();
        updateState(unavailableState(message));
      };
      worker.onerror = () => handleWorkerFailure("Gesture recognition worker failed to load.");
      worker.onmessageerror = () => handleWorkerFailure("Gesture recognition worker sent an unreadable message.");
      worker.onmessage = (event: MessageEvent<GestureWorkerMessage>) => {
        if (sessionRef.current !== session) return;
        const message = event.data;
        if (message.type === "status") {
          if (message.status === "ready") {
            const engine = message.engine ?? "mediapipe-gesture-recognizer";
            const delegate = message.delegate ?? "CPU";
            updateState((current) => ({
              ...current,
              delegate,
              enabled: true,
              engine,
              message: "Show one hand to steer with your index finger. Pinch to grab or activate.",
              ...activeProviderState(engine),
              status: "ready",
            }));
            scheduleRecognition(session);
            return;
          }
          handleWorkerFailure(message.message ?? "Gesture recognition failed to start.");
          return;
        }

        pendingFrameRef.current = false;
        const receivedAtMs = performance.now();
        const metricState = metricStateRef.current;
        metricState.processedFrames += 1;
        const trackingResult = advanceGestureTracking({
          cursorSpeed: cursorSpeedRef.current,
          frameTimeMs: message.frameTimeMs,
          landmarks: message.landmarks[0] ?? [],
          previous: trackingStateRef.current,
          sourceHeight: message.sourceHeight,
          sourceWidth: message.sourceWidth,
          viewportHeight: window.innerHeight,
          viewportWidth: window.innerWidth,
        });
        trackingStateRef.current = trackingResult.state;
        let cursor = trackingResult.cursor;
        if (!cursor || cursor.tracking === "held" || cursor.pinching) {
          fourFingerScrollRef.current = resetFourFingerScrollState();
        } else {
          const scrollResult = resolveFourFingerScrollSignal({
            landmarks: message.landmarks[0] ?? [],
            now: message.frameTimeMs,
            previous: fourFingerScrollRef.current,
            viewportHeight: window.innerHeight,
            viewportWidth: window.innerWidth,
          });
          fourFingerScrollRef.current = scrollResult.state;
          if (scrollResult.signal) cursor = { ...cursor, fourFingerScroll: scrollResult.signal };
        }
        const sample: RuntimeSample = {
          bitmapReadyMs: Math.max(0, message.bitmapReadyAtMs - message.sampleStartedAtMs),
          captureToResultMs: Math.max(0, receivedAtMs - message.sampleStartedAtMs),
          frameId: message.frameId,
          inferenceMs: message.inferenceMs,
          processedAtMs: receivedAtMs,
          sampleStartedAtMs: message.sampleStartedAtMs,
          sampleAgeMs: Math.max(0, receivedAtMs - message.frameTimeMs),
        };
        metricState.samples.push(sample);
        if (metricState.samples.length > 120) metricState.samples.splice(0, metricState.samples.length - 120);
        frameControlRef.current?.publish({
          cursor,
          frameId: message.frameId,
          frameTimeMs: message.frameTimeMs,
          sampleStartedAtMs: message.sampleStartedAtMs,
          status: trackingResult.status,
        });
        const nextStatus = trackingResult.status as GestureCameraStatus;
        const nextMessage = cameraMessageForFrame(trackingResult.status, cursor);
        const currentState = stateRef.current;
        if (
          currentState.status !== nextStatus ||
          currentState.message !== nextMessage ||
          currentState.delegate !== message.delegate ||
          currentState.engine !== message.engine
        ) {
          updateState((current) => ({
            ...current,
            delegate: message.delegate,
            enabled: true,
            engine: message.engine,
            message: nextMessage,
            ...activeProviderState(message.engine),
            status: nextStatus,
          }));
        }
        publishMetrics();
      };
      worker.postMessage({
        gestureRecognizerModelUrl: workerAssetUrl("mediapipe/models/gesture_recognizer.task"),
        handLandmarkerModelUrl: workerAssetUrl("mediapipe/models/hand_landmarker.task"),
        type: "init",
      });
    } catch (error) {
      if (sessionRef.current !== session) return;
      cleanupRuntime();
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        updateState({
          ...unavailableState("Camera permission was denied. Use browser site controls to allow the webcam."),
          status: "permissionDenied",
        });
        return;
      }
      updateState(unavailableState("Camera control could not start in this browser."));
    }
  }, [cleanupRuntime, publishMetrics, scheduleRecognition, supported, updateState]);

  return {
    cursorSpeed,
    delegate: state.delegate,
    enabled: state.enabled,
    engine: state.engine,
    frames,
    message: state.message,
    metrics: state.metrics,
    providerId: state.providerId,
    providerLabel: state.providerLabel,
    setCursorSpeed,
    start,
    status: state.status,
    stop,
    supported,
    videoRef,
  };
};
