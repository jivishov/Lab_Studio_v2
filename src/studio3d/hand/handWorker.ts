import type { HandLandmarker } from "@mediapipe/tasks-vision";
import { createHandDetector } from "./handDetector";

/**
 * Player3D's hand-tracking worker: the DNA microarray 3D lab's string-built worker
 * (`3d-v3/camera.js:24-37`, `workerEntry`) as a module worker (decided 2026-10-04). Frames stay in
 * this tab and this worker; each bitmap is closed once read.
 */
type Request =
  | { type: "init"; modelUrl: string }
  | { type: "frame"; bitmap: ImageBitmap; stamp: number };

let detector: HandLandmarker | undefined;
const scope = globalThis as unknown as { onmessage: ((e: MessageEvent<Request>) => void) | null; postMessage: (m: unknown) => void };

scope.onmessage = async (e: MessageEvent<Request>) => {
  const m = e.data;
  if (m.type === "init") {
    try {
      const out = await createHandDetector(m.modelUrl, true);
      detector = out.detector;
      scope.postMessage({ type: "ready", backend: `${out.backend} / worker` });
    } catch (error) {
      scope.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error) });
    }
  } else if (m.type === "frame") {
    const start = performance.now();
    try {
      if (!detector) throw new Error("Hand tracking is not ready.");
      const result = detector.detectForVideo(m.bitmap, m.stamp);
      scope.postMessage({ type: "result", stamp: m.stamp, landmarks: result.landmarks, worldLandmarks: result.worldLandmarks,
        handedness: result.handedness, inferenceMS: performance.now() - start });
    } catch (error) {
      scope.postMessage({ type: "frame-error", message: error instanceof Error ? error.message : String(error) });
    } finally {
      m.bitmap.close();
    }
  }
};
