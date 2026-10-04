import { HandLandmarker } from "@mediapipe/tasks-vision";
import visionWasmLoaderUrl from "@mediapipe/tasks-vision/vision_wasm_module_internal.js?url";
import visionWasmBinaryUrl from "@mediapipe/tasks-vision/vision_wasm_module_internal.wasm?url";

/**
 * The DNA microarray 3D lab's `makeDetector` (`3d-v3/camera.js:12-23`), decided 2026-10-04: MediaPipe
 * Tasks HandLandmarker in VIDEO mode, two hands, every confidence 0.5, GPU first and then CPU. The
 * installed `@mediapipe/tasks-vision` (1.0.1) is used, as decided; the source was tuned on 0.10.17.
 * The model is the bundled `public/mediapipe/models/hand_landmarker.task` (byte-identical to the
 * source's). Used by the worker and by the main-thread fallback.
 */
export const handLandmarkerOptions = (modelUrl: string, delegate: "GPU" | "CPU", canvas?: OffscreenCanvas) => ({
  baseOptions: { modelAssetPath: modelUrl, delegate },
  runningMode: "VIDEO" as const,
  numHands: 2,
  minHandDetectionConfidence: 0.5,
  minHandPresenceConfidence: 0.5,
  minTrackingConfidence: 0.5,
  ...(canvas ? { canvas } : {}),
});

export const createHandDetector = async (modelUrl: string, offscreen: boolean): Promise<{ detector: HandLandmarker; backend: string }> => {
  const errors: string[] = [];
  for (const delegate of ["GPU", "CPU"] as const) {
    try {
      const fileset = { wasmBinaryPath: visionWasmBinaryUrl, wasmLoaderPath: visionWasmLoaderUrl };
      const detector = await HandLandmarker.createFromOptions(fileset,
        handLandmarkerOptions(modelUrl, delegate, offscreen && typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(640, 480) : undefined));
      return { detector, backend: `MediaPipe ${delegate}` };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  throw new Error(errors.join(" | "));
};
