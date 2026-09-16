import {
  GestureRecognizer,
  HandLandmarker,
  type Category,
  type GestureRecognizerResult,
  type HandLandmarkerResult,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import visionWasmLoaderUrl from "@mediapipe/tasks-vision/vision_wasm_module_internal.js?url";
import visionWasmBinaryUrl from "@mediapipe/tasks-vision/vision_wasm_module_internal.wasm?url";

type GestureWorkerEngine = "mediapipe-hand-landmarker" | "mediapipe-gesture-recognizer";
type GestureWorkerDelegate = "GPU" | "CPU";

interface InitMessage {
  gestureRecognizerModelUrl: string;
  handLandmarkerModelUrl: string;
  type: "init";
}

interface RecognizeMessage {
  bitmapReadyAtMs: number;
  frame: ImageBitmap;
  frameId: number;
  frameTimeMs: number;
  sampleStartedAtMs: number;
  type: "recognize";
}

interface CloseMessage {
  type: "close";
}

type WorkerRequest = CloseMessage | InitMessage | RecognizeMessage;

type WorkerResponse =
  | {
      delegate?: GestureWorkerDelegate;
      engine?: GestureWorkerEngine;
      message?: string;
      status: "ready" | "error";
      type: "status";
    }
  | {
      delegate: GestureWorkerDelegate;
      engine: GestureWorkerEngine;
      bitmapReadyAtMs: number;
      frameId: number;
      frameTimeMs: number;
      gestureName?: string;
      gestureScore?: number;
      handednessName?: string;
      handednessScore?: number;
      inferenceMs: number;
      landmarks: Array<Array<Pick<NormalizedLandmark, "x" | "y" | "z">>>;
      sampleStartedAtMs: number;
      sourceHeight: number;
      sourceWidth: number;
      type: "frame";
    };

let recognizer: GestureRecognizer | undefined;
let landmarker: HandLandmarker | undefined;
let activeDelegate: GestureWorkerDelegate | undefined;
let activeEngine: GestureWorkerEngine | undefined;

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: WorkerResponse) => void;
};

const topGesture = (result: GestureRecognizerResult): Category | undefined =>
  result.gestures[0]?.slice().sort((a, b) => b.score - a.score)[0];

const topHandedness = (result: GestureRecognizerResult | HandLandmarkerResult): Category | undefined =>
  result.handedness[0]?.slice().sort((a, b) => b.score - a.score)[0];

const serializeLandmarks = (
  landmarks: NormalizedLandmark[][],
): Array<Array<Pick<NormalizedLandmark, "x" | "y" | "z">>> =>
  landmarks.map((hand) => hand.map((landmark) => ({
    x: landmark.x,
    y: landmark.y,
    z: landmark.z,
  })));

const closeRecognizer = () => {
  recognizer?.close();
  landmarker?.close();
  recognizer = undefined;
  landmarker = undefined;
  activeDelegate = undefined;
  activeEngine = undefined;
};

const visionFileset = () => ({
  wasmBinaryPath: visionWasmBinaryUrl,
  wasmLoaderPath: visionWasmLoaderUrl,
});

const createHandLandmarker = async (
  modelUrl: string,
  delegate: GestureWorkerDelegate,
): Promise<void> => {
  landmarker = await HandLandmarker.createFromOptions(visionFileset(), {
    baseOptions: {
      delegate,
      modelAssetPath: modelUrl,
    },
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    numHands: 1,
    runningMode: "VIDEO",
  });
  activeDelegate = delegate;
  activeEngine = "mediapipe-hand-landmarker";
};

const createGestureRecognizer = async (
  modelUrl: string,
  delegate: GestureWorkerDelegate,
): Promise<void> => {
  recognizer = await GestureRecognizer.createFromOptions(visionFileset(), {
    baseOptions: {
      delegate,
      modelAssetPath: modelUrl,
    },
    cannedGesturesClassifierOptions: {
      scoreThreshold: 0.3,
    },
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    numHands: 1,
    runningMode: "VIDEO",
  });
  activeDelegate = delegate;
  activeEngine = "mediapipe-gesture-recognizer";
};

const createBestAvailableEngine = async (message: InitMessage): Promise<void> => {
  const attempts: Array<{
    create: () => Promise<void>;
    delegate: GestureWorkerDelegate;
    engine: GestureWorkerEngine;
  }> = [
    {
      create: () => createHandLandmarker(message.handLandmarkerModelUrl, "GPU"),
      delegate: "GPU",
      engine: "mediapipe-hand-landmarker",
    },
    {
      create: () => createHandLandmarker(message.handLandmarkerModelUrl, "CPU"),
      delegate: "CPU",
      engine: "mediapipe-hand-landmarker",
    },
    {
      create: () => createGestureRecognizer(message.gestureRecognizerModelUrl, "CPU"),
      delegate: "CPU",
      engine: "mediapipe-gesture-recognizer",
    },
  ];
  const errors: string[] = [];

  for (const attempt of attempts) {
    try {
      closeRecognizer();
      await attempt.create();
      return;
    } catch (error) {
      closeRecognizer();
      const message = error instanceof Error ? error.message : "Unknown engine initialization failure.";
      errors.push(`${attempt.engine}/${attempt.delegate}: ${message}`);
    }
  }

  throw new Error(errors.join(" | "));
};

workerScope.onmessage = (event) => {
  void (async () => {
    const message = event.data;
    if (message.type === "close") {
      closeRecognizer();
      return;
    }

    if (message.type === "init") {
      try {
        closeRecognizer();
        await createBestAvailableEngine(message);
        workerScope.postMessage({
          delegate: activeDelegate,
          engine: activeEngine,
          status: "ready",
          type: "status",
        });
      } catch (error) {
        closeRecognizer();
        workerScope.postMessage({
          message: error instanceof Error ? error.message : "Gesture recognizer failed to start.",
          status: "error",
          type: "status",
        });
      }
      return;
    }

    if (!recognizer && !landmarker) {
      message.frame.close();
      return;
    }

    try {
      const startedAt = performance.now();
      if (!activeDelegate || !activeEngine) return;
      const sourceWidth = message.frame.width;
      const sourceHeight = message.frame.height;
      const result = landmarker
        ? landmarker.detectForVideo(message.frame, message.frameTimeMs)
        : recognizer?.recognizeForVideo(message.frame, message.frameTimeMs);
      if (!result) return;
      const gesture = recognizer && !landmarker ? topGesture(result as GestureRecognizerResult) : undefined;
      const handedness = topHandedness(result);
      workerScope.postMessage({
        bitmapReadyAtMs: message.bitmapReadyAtMs,
        delegate: activeDelegate,
        engine: activeEngine,
        frameId: message.frameId,
        frameTimeMs: message.frameTimeMs,
        gestureName: gesture?.categoryName,
        gestureScore: gesture?.score,
        handednessName: handedness?.categoryName,
        handednessScore: handedness?.score,
        inferenceMs: Math.max(0, performance.now() - startedAt),
        landmarks: serializeLandmarks(result.landmarks),
        sampleStartedAtMs: message.sampleStartedAtMs,
        sourceHeight,
        sourceWidth,
        type: "frame",
      });
    } catch (error) {
      workerScope.postMessage({
        message: error instanceof Error ? error.message : "Gesture recognition failed.",
        status: "error",
        type: "status",
      });
    } finally {
      message.frame.close();
    }
  })();
};
