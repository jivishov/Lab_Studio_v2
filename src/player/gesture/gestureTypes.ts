import type { RefObject } from "react";
import type { GestureCursor, GestureCursorSpeed, GestureFrameStatus } from "./gestureMath";

export type GestureProviderId =
  | "mediapipe-hand-landmarker"
  | "mediapipe-gesture-recognizer"
  | "external-precision"
  | "unavailable";

export type GestureEngine =
  | "mediapipe-hand-landmarker"
  | "mediapipe-gesture-recognizer"
  | "none";

export type GestureDelegate = "GPU" | "CPU" | "none";

export type GestureCameraStatus =
  | "off"
  | "starting"
  | "ready"
  | "noHand"
  | "unstable"
  | "permissionDenied"
  | "unavailable";

export interface GestureFrameSnapshot {
  cursor?: GestureCursor;
  frameId: number;
  frameTimeMs: number;
  sampleStartedAtMs: number;
  status: GestureFrameStatus;
}

export type GestureFrameListener = (snapshot: GestureFrameSnapshot) => void;

export interface GestureFrameSource {
  getSnapshot: () => GestureFrameSnapshot;
  markCursorRendered: (frameId: number, renderedAtMs: number) => void;
  subscribe: (listener: GestureFrameListener) => () => void;
}

export interface GestureRuntimeMetrics {
  attemptedFrames: number;
  bitmapReadyMs: number;
  captureToCursorMs: number;
  captureToResultMs: number;
  inferenceMs: number;
  lastFrameId: number;
  processedFps: number;
  processedFrames: number;
  sampleAgeMs: number;
  skipRate: number;
  skippedFrames: number;
  submittedFrames: number;
}

export interface GestureController {
  cursorSpeed: GestureCursorSpeed;
  delegate: GestureDelegate;
  enabled: boolean;
  engine: GestureEngine;
  frames: GestureFrameSource;
  message: string;
  metrics: GestureRuntimeMetrics;
  providerId: GestureProviderId;
  providerLabel: string;
  setCursorSpeed: (speed: number) => void;
  start: () => Promise<void>;
  status: GestureCameraStatus;
  stop: () => void;
  supported: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
}

export const statusLabelForGesture = (status: GestureCameraStatus): string => {
  if (status === "off") return "Off";
  if (status === "starting") return "Starting";
  if (status === "ready") return "Ready";
  if (status === "noHand") return "No hand";
  if (status === "unstable") return "Unstable tracking";
  if (status === "permissionDenied") return "Permission denied";
  return "Unavailable";
};
