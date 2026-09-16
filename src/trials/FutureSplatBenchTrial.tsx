import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Gauge,
  Image as ImageIcon,
  RotateCcw,
  ScanEye,
  TimerReset,
  ZoomIn,
} from "lucide-react";
import {
  loadSplatTrialManifest,
  resolveSplatTrialFrame,
  type SplatTrialFrame,
  type SplatTrialFrameId,
  type SplatTrialManifest,
} from "./futureSplatBenchManifest";

type RenderMetrics = {
  fps: number;
  frameMs: number;
  status: string;
};

type StageFrame = {
  id: SplatTrialFrameId;
  label: string;
  temperature: string;
};

const stageFrames: StageFrame[] = [
  { id: "setup", label: "Setup", temperature: "22 C" },
  { id: "heat", label: "Heating", temperature: "78 C" },
  { id: "cool", label: "Cooling", temperature: "36 C" },
];

const defaultMetrics: RenderMetrics = {
  fps: 0,
  frameMs: 0,
  status: "Initializing renderer",
};

const frameCopy: Record<SplatTrialFrameId, string> = {
  setup: "Cold apparatus placement with the burner, gauze, beaker, and thermometer aligned.",
  heat: "The v0 frame increases flame, steam, and thermometer indication to exercise temporal loading.",
  cool: "The cooling frame reduces flame and keeps residual vapor so the scrubber can test state changes.",
};

const publicAssetPath = (path: string): string => {
  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${base}${path.replace(/^\/+/, "")}`;
};

const useLatestRef = <Value,>(value: Value) => {
  const ref = useRef(value);
  ref.current = value;
  return ref;
};

const supportsSogGpuPreparation = () => {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2");
  if (!gl) return false;

  const texture = gl.createTexture();
  const framebuffer = gl.createFramebuffer();
  if (!texture || !framebuffer) return false;

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32UI, 1, 1, 0, gl.RGBA_INTEGER, gl.UNSIGNED_INT, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  const supported = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.deleteFramebuffer(framebuffer);
  gl.deleteTexture(texture);
  return supported;
};

const getSplatLoadCandidates = (frame: SplatTrialFrame) => {
  const candidates = [];
  const hashQuery = window.location.hash.split("?")[1] ?? "";
  const nativeSogRequested =
    new URLSearchParams(window.location.search).get("nativeSog") === "1" ||
    new URLSearchParams(hashQuery).get("nativeSog") === "1";
  if (frame.format === "sog" && nativeSogRequested && supportsSogGpuPreparation()) {
    candidates.push({
      data: { reorder: true },
      label: "SOG",
      url: frame.splatUrl,
    });
  }

  const plyUrl = frame.splatUrl.replace(/\.sog$/i, ".ply");
  if (plyUrl !== frame.splatUrl) {
    candidates.push({
      data: { reorder: true },
      label: frame.format === "sog" ? "PLY compatibility" : "PLY",
      url: plyUrl,
    });
  } else {
    candidates.push({
      data: { reorder: true },
      label: frame.format.toUpperCase(),
      url: frame.splatUrl,
    });
  }

  return candidates;
};

const PlayCanvasSplatStage = ({
  frame,
  orbitEnabled,
  resetToken,
  onFailure,
  onMetrics,
  zoomEnabled,
}: {
  frame: SplatTrialFrame;
  orbitEnabled: boolean;
  resetToken: number;
  zoomEnabled: boolean;
  onFailure: (message: string) => void;
  onMetrics: (metrics: RenderMetrics) => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<import("playcanvas").Application | null>(null);
  const assetRef = useRef<import("playcanvas").Asset | null>(null);
  const cameraRef = useRef<import("playcanvas").Entity | null>(null);
  const splatEntityRef = useRef<import("playcanvas").Entity | null>(null);
  const loadedFrameRef = useRef<SplatTrialFrameId | null>(null);
  const activeRenderLabelRef = useRef("");
  const yawRef = useRef(-0.42);
  const pitchRef = useRef(0.26);
  const distanceRef = useRef(4.25);
  const [appReady, setAppReady] = useState(0);
  const frameRef = useLatestRef(frame);
  const orbitEnabledRef = useLatestRef(orbitEnabled);
  const zoomEnabledRef = useLatestRef(zoomEnabled);
  const onFailureRef = useLatestRef(onFailure);
  const onMetricsRef = useLatestRef(onMetrics);

  useEffect(() => {
    let disposed = false;
    let resizeObserver: ResizeObserver | undefined;
    let cleanupPointer = () => {};
    let cleanupTicker = () => {};

    const run = async () => {
      const canvas = canvasRef.current;
      const host = hostRef.current;
      if (!canvas || !host) return;

      try {
        const pc = await import("playcanvas");
        if (disposed) return;

        const app = new pc.Application(canvas, {
          graphicsDeviceOptions: {
            antialias: false,
          },
        });
        appRef.current = app;
        app.graphicsDevice.on("devicelost", () => {
          onFailureRef.current("PlayCanvas WebGL context was lost; SVG fallback is active.");
        });
        app.scene.ambientLight = new pc.Color(0.72, 0.74, 0.7);
        app.setCanvasFillMode(pc.FILLMODE_NONE, host.clientWidth, host.clientHeight);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        const camera = new pc.Entity("future-splat-bench-camera");
        camera.addComponent("camera", {
          clearColor: new pc.Color(0.91, 0.94, 0.92),
          farClip: 100,
          fov: 45,
          nearClip: 0.05,
        });
        app.root.addChild(camera);
        cameraRef.current = camera;

        const light = new pc.Entity("future-splat-bench-light");
        light.addComponent("light", {
          color: new pc.Color(1, 0.94, 0.82),
          intensity: 1.2,
          type: "directional",
        });
        light.setEulerAngles(48, 36, 0);
        app.root.addChild(light);

        const resize = () => {
          const width = Math.max(320, Math.floor(host.clientWidth));
          const height = Math.max(260, Math.floor(host.clientHeight));
          app.resizeCanvas(width, height);
        };
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(host);
        resize();

        const target = new pc.Vec3(-0.12, 0.78, 0.03);
        const updateCamera = () => {
          const distance = distanceRef.current;
          const pitch = pitchRef.current;
          const yaw = yawRef.current;
          camera.setPosition(
            target.x + Math.sin(yaw) * Math.cos(pitch) * distance,
            target.y + Math.sin(pitch) * distance,
            target.z + Math.cos(yaw) * Math.cos(pitch) * distance,
          );
          camera.lookAt(target);
        };
        updateCamera();

        let dragging = false;
        let lastX = 0;
        let lastY = 0;
        const onPointerDown = (event: PointerEvent) => {
          if (!orbitEnabledRef.current) return;
          dragging = true;
          lastX = event.clientX;
          lastY = event.clientY;
          canvas.setPointerCapture(event.pointerId);
        };
        const onPointerMove = (event: PointerEvent) => {
          if (!dragging || !orbitEnabledRef.current) return;
          yawRef.current -= (event.clientX - lastX) * 0.008;
          pitchRef.current = Math.max(-0.18, Math.min(0.86, pitchRef.current + (event.clientY - lastY) * 0.006));
          lastX = event.clientX;
          lastY = event.clientY;
          updateCamera();
        };
        const onPointerUp = (event: PointerEvent) => {
          dragging = false;
          if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        };
        const onWheel = (event: WheelEvent) => {
          if (!zoomEnabledRef.current) return;
          event.preventDefault();
          distanceRef.current = Math.max(2.2, Math.min(7.8, distanceRef.current + event.deltaY * 0.004));
          updateCamera();
        };

        canvas.addEventListener("pointerdown", onPointerDown);
        canvas.addEventListener("pointermove", onPointerMove);
        canvas.addEventListener("pointerup", onPointerUp);
        canvas.addEventListener("pointercancel", onPointerUp);
        canvas.addEventListener("wheel", onWheel, { passive: false });
        cleanupPointer = () => {
          canvas.removeEventListener("pointerdown", onPointerDown);
          canvas.removeEventListener("pointermove", onPointerMove);
          canvas.removeEventListener("pointerup", onPointerUp);
          canvas.removeEventListener("pointercancel", onPointerUp);
          canvas.removeEventListener("wheel", onWheel);
        };

        let frames = 0;
        let elapsed = 0;
        const onUpdate = (dt: number) => {
          frames += 1;
          elapsed += dt;
          if (elapsed >= 0.5) {
            const fps = frames / elapsed;
            const loadedFrameId = loadedFrameRef.current;
            onMetricsRef.current({
              fps,
              frameMs: fps > 0 ? 1000 / fps : 0,
              status:
                loadedFrameId === frameRef.current.id
                  ? `PlayCanvas ${activeRenderLabelRef.current || frameRef.current.format.toUpperCase()} frame active`
                  : "PlayCanvas renderer ready",
            });
            frames = 0;
            elapsed = 0;
          }
        };
        app.on("update", onUpdate);
        cleanupTicker = () => app.off("update", onUpdate);
        app.start();
        setAppReady((value) => value + 1);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to initialize PlayCanvas.";
        onFailureRef.current(message);
      }
    };

    void run();

    return () => {
      disposed = true;
      cleanupTicker();
      cleanupPointer();
      resizeObserver?.disconnect();
      splatEntityRef.current?.destroy();
      assetRef.current?.unload();
      if (assetRef.current && appRef.current) appRef.current.assets.remove(assetRef.current);
      appRef.current?.destroy();
      appRef.current = null;
      assetRef.current = null;
      cameraRef.current = null;
      loadedFrameRef.current = null;
      activeRenderLabelRef.current = "";
      splatEntityRef.current = null;
    };
  }, [frameRef, onFailureRef, onMetricsRef, orbitEnabledRef, zoomEnabledRef]);

  useEffect(() => {
    const app = appRef.current;
    if (!app || appReady === 0) return;

    let cancelled = false;

    const load = async () => {
      try {
        const pc = await import("playcanvas");
        if (cancelled) return;

        splatEntityRef.current?.destroy();
        splatEntityRef.current = null;
        loadedFrameRef.current = null;
        activeRenderLabelRef.current = "";
        if (assetRef.current) {
          assetRef.current.unload();
          app.assets.remove(assetRef.current);
          assetRef.current = null;
        }

        let loadedAsset: import("playcanvas").Asset | null = null;
        let loadedLabel = "";
        let lastError = "";

        for (const candidate of getSplatLoadCandidates(frame)) {
          if (cancelled) return;

          onMetricsRef.current({
            fps: 0,
            frameMs: 0,
            status: `Loading ${frame.id} ${candidate.label} frame`,
          });

          const asset = new pc.Asset(
            `future-splat-bench-${frame.id}-${candidate.label.toLowerCase().replace(/\s+/g, "-")}`,
            "gsplat",
            { url: candidate.url },
            candidate.data,
          );
          assetRef.current = asset;
          app.assets.add(asset);

          asset.on("progress", (receivedBytes: number, totalBytes: number) => {
            const total = totalBytes > 0 ? ` / ${(totalBytes / 1024).toFixed(1)} KB` : "";
            onMetricsRef.current({
              fps: 0,
              frameMs: 0,
              status: `Loading ${candidate.label} ${(receivedBytes / 1024).toFixed(1)} KB${total}`,
            });
          });

          try {
            await new Promise<void>((resolve, reject) => {
              const loader = new pc.AssetListLoader([asset], app.assets);
              loader.load((error: unknown) => {
                loader.destroy();
                if (error) reject(error);
                else resolve();
              });
            });
            loadedAsset = asset;
            loadedLabel = candidate.label;
            break;
          } catch (error) {
            lastError = error instanceof Error ? error.message : String(error);
            asset.unload();
            app.assets.remove(asset);
            if (assetRef.current === asset) assetRef.current = null;
          }
        }

        if (cancelled) return;
        if (!loadedAsset) {
          onFailureRef.current(`Unable to load ${frame.id} splat frame: ${lastError || "No load candidates succeeded."}`);
          return;
        }

        const entity = new pc.Entity(`future-splat-bench-${frame.id}-splat`);
        entity.addComponent("gsplat", { asset: loadedAsset });
        entity.setEulerAngles(0, 0, 0);
        entity.setPosition(0, 0, 0);
        app.root.addChild(entity);
        splatEntityRef.current = entity;
        loadedFrameRef.current = frame.id;
        activeRenderLabelRef.current = loadedLabel;
        const resource = entity.gsplat?.resource;
        const splatCount = typeof resource?.numSplats === "number" ? resource.numSplats : 0;
        const bounds = resource?.aabb;
        const boundsLabel = bounds
          ? ` bounds ${bounds.center.x.toFixed(2)},${bounds.center.y.toFixed(2)},${bounds.center.z.toFixed(2)}`
          : "";
        onMetricsRef.current({
          fps: 0,
          frameMs: 0,
          status: `Loaded ${frame.id} ${loadedLabel} frame (${splatCount} splats${boundsLabel})`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load splat frame.";
        onFailureRef.current(message);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [appReady, frame, onFailureRef, onMetricsRef]);

  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera) return;
    yawRef.current = -0.42;
    pitchRef.current = 0.26;
    distanceRef.current = 4.25;
    camera.setPosition(-1.8, 1.88, 3.7);
    camera.lookAt(-0.12, 0.78, 0.03);
  }, [resetToken]);

  return (
    <div className="future-splat-canvas-host" ref={hostRef}>
      <canvas
        aria-label="PlayCanvas Gaussian splat heating bench preview"
        className="future-splat-canvas"
        data-testid="future-splat-canvas"
        ref={canvasRef}
      />
    </div>
  );
};

const SvgBenchFallback = ({ frame }: { frame: SplatTrialFrame }) => (
  <div className={`future-splat-png-stage is-${frame.id}`} data-testid="future-splat-png-fallback">
    <div className="future-splat-bench-line" aria-hidden="true" />
    <img
      alt=""
      aria-hidden="true"
      className="future-splat-png-burner"
      src={publicAssetPath("assets/equipment-realistic/v1/bunsen-burner.svg")}
    />
    <img
      alt=""
      aria-hidden="true"
      className="future-splat-png-gauze"
      src={publicAssetPath("assets/equipment-realistic/v1/wire-gauze.svg")}
    />
    <img
      alt=""
      aria-hidden="true"
      className="future-splat-png-beaker"
      src={publicAssetPath("assets/equipment-realistic/v1/beaker-250ml.svg")}
    />
    <img
      alt=""
      aria-hidden="true"
      className="future-splat-png-thermometer"
      src={publicAssetPath("assets/equipment-realistic/v1/thermometer.svg")}
    />
    <span className="future-splat-flame" aria-hidden="true" />
    <span className="future-splat-steam one" aria-hidden="true" />
    <span className="future-splat-steam two" aria-hidden="true" />
  </div>
);

const SplatTrialLoading = () => (
  <main className="future-splat-trial realistic-trial" aria-live="polite">
    <header className="surface-header realistic-trial-header">
      <div>
        <a className="trial-back-link" href="#/">
          <ArrowLeft size={16} aria-hidden="true" /> Home
        </a>
        <h1>Future Splat Bench</h1>
        <p>Loading standalone Gaussian splat trial manifest.</p>
      </div>
    </header>
  </main>
);

export const FutureSplatBenchTrial = () => {
  const [manifest, setManifest] = useState<SplatTrialManifest>();
  const [loadError, setLoadError] = useState<string>();
  const [frameId, setFrameId] = useState<SplatTrialFrameId>("setup");
  const [useSvgFallback, setUseSvgFallback] = useState(true);
  const [forcedFallbackReason, setForcedFallbackReason] = useState<string>();
  const [orbitEnabled, setOrbitEnabled] = useState(true);
  const [zoomEnabled, setZoomEnabled] = useState(true);
  const [resetToken, setResetToken] = useState(0);
  const [metrics, setMetrics] = useState<RenderMetrics>(defaultMetrics);

  useEffect(() => {
    let active = true;
    void loadSplatTrialManifest()
      .then((loaded) => {
        if (!active) return;
        setManifest(loaded);
        setFrameId(loaded.frames[0]?.id ?? "setup");
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "Unable to load splat manifest.");
      });
    return () => {
      active = false;
    };
  }, []);

  const frame = useMemo(
    () => (manifest ? resolveSplatTrialFrame(manifest, frameId) : undefined),
    [frameId, manifest],
  );
  const selectedFrameIndex = frame ? stageFrames.findIndex((item) => item.id === frame.id) : 0;
  const selectedFrameMeta = stageFrames[selectedFrameIndex] ?? stageFrames[0];
  const shouldShowSvgFallback = useSvgFallback || Boolean(forcedFallbackReason);

  if (loadError) {
    return (
      <main className="future-splat-trial realistic-trial" role="alert">
        <header className="surface-header realistic-trial-header">
          <div>
            <a className="trial-back-link" href="#/">
              <ArrowLeft size={16} aria-hidden="true" /> Home
            </a>
            <h1>Future Splat Bench</h1>
            <p>{loadError}</p>
          </div>
        </header>
      </main>
    );
  }

  if (!manifest || !frame) return <SplatTrialLoading />;

  return (
    <main className="future-splat-trial" aria-labelledby="future-splat-title">
      <header className="surface-header realistic-trial-header future-splat-header">
        <div>
          <a className="trial-back-link" href="#/">
            <ArrowLeft size={16} aria-hidden="true" /> Home
          </a>
          <h1 id="future-splat-title">{manifest.title}</h1>
          <p>Standalone proof-of-concept for a time-indexed Gaussian splat equipment bench.</p>
        </div>
        <p className="trial-note">
          Internal v0 trial only. These are lightweight generated splat impostors with SVG fallback
          references, not captured research-grade 4DGS assets.
        </p>
      </header>

      <section className="future-splat-workspace" aria-label="Future splat bench trial controls">
        <div className="future-splat-stage-shell">
          <div className="future-splat-stage-toolbar">
            <div>
              <strong>{selectedFrameMeta.label}</strong>
              <span>{frameCopy[frame.id]}</span>
            </div>
            <div className="future-splat-stage-actions">
              <button
                aria-pressed={orbitEnabled}
                onClick={() => setOrbitEnabled((enabled) => !enabled)}
                title="Toggle orbit controls"
                type="button"
              >
                <ScanEye size={16} aria-hidden="true" /> Orbit
              </button>
              <button
                aria-pressed={zoomEnabled}
                onClick={() => setZoomEnabled((enabled) => !enabled)}
                title="Toggle zoom controls"
                type="button"
              >
                <ZoomIn size={16} aria-hidden="true" /> Zoom
              </button>
              <button onClick={() => setResetToken((token) => token + 1)} type="button">
                <RotateCcw size={16} aria-hidden="true" /> Reset
              </button>
            </div>
          </div>

          <div className="future-splat-stage-frame">
            {shouldShowSvgFallback ? (
              <SvgBenchFallback frame={frame} />
            ) : (
              <PlayCanvasSplatStage
                frame={frame}
                onFailure={(message) => {
                  setForcedFallbackReason(message);
                  setUseSvgFallback(true);
                  setMetrics((current) => ({ ...current, status: "SVG fallback active" }));
                }}
                onMetrics={setMetrics}
                orbitEnabled={orbitEnabled}
                resetToken={resetToken}
                zoomEnabled={zoomEnabled}
              />
            )}
          </div>
        </div>

        <aside className="future-splat-controls">
          <section className="future-splat-control-panel" aria-labelledby="future-splat-time-title">
            <div className="panel-heading">
              <h2 id="future-splat-time-title">
                <TimerReset size={16} aria-hidden="true" /> Time Scrubber
              </h2>
              <span>{selectedFrameMeta.temperature}</span>
            </div>
            <label className="future-splat-range-label">
              Heating sequence
              <input
                aria-label="Heating sequence frame"
                max={stageFrames.length - 1}
                min={0}
                onChange={(event) => setFrameId(stageFrames[Number(event.currentTarget.value)].id)}
                step={1}
                type="range"
                value={selectedFrameIndex}
              />
            </label>
            <div className="future-splat-segments" role="group" aria-label="Bench frame selection">
              {stageFrames.map((item) => (
                <button
                  className={item.id === frame.id ? "is-active" : ""}
                  key={item.id}
                  onClick={() => setFrameId(item.id)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </section>

          <section className="future-splat-control-panel" aria-labelledby="future-splat-render-title">
            <div className="panel-heading">
              <h2 id="future-splat-render-title">
                <ImageIcon size={16} aria-hidden="true" /> Render Mode
              </h2>
              <span>{shouldShowSvgFallback ? "SVG" : frame.format}</span>
            </div>
            <label className="future-splat-toggle">
              <input
                checked={shouldShowSvgFallback}
                onChange={(event) => {
                  setUseSvgFallback(event.currentTarget.checked);
                  if (!event.currentTarget.checked) setForcedFallbackReason(undefined);
                }}
                type="checkbox"
              />
              SVG fallback
            </label>
            <dl className="future-splat-manifest-list">
              <div>
                <dt>Manifest</dt>
                <dd>{publicAssetPath("assets/equipment-splats/v0/manifest.json")}</dd>
              </div>
              <div>
                <dt>Splat frame</dt>
                <dd>{frame.splatUrl}</dd>
              </div>
              <div>
                <dt>Fallbacks</dt>
                <dd>{frame.fallbackImages.length} SVGs</dd>
              </div>
            </dl>
            {forcedFallbackReason ? (
              <p className="future-splat-warning">{forcedFallbackReason}</p>
            ) : !shouldShowSvgFallback ? (
              <p className="future-splat-warning">
                Experimental splat impostor mode is active. Use the SVG fallback for the realistic
                equipment reference.
              </p>
            ) : null}
          </section>

          <section className="future-splat-control-panel" aria-labelledby="future-splat-stats-title">
            <div className="panel-heading">
              <h2 id="future-splat-stats-title">
                <Gauge size={16} aria-hidden="true" /> Performance
              </h2>
              <span>{shouldShowSvgFallback ? "SVG" : manifest.renderer}</span>
            </div>
            <div className="future-splat-stat-grid">
              <div>
                <strong>{shouldShowSvgFallback ? "--" : Math.round(metrics.fps)}</strong>
                <span>FPS</span>
              </div>
              <div>
                <strong>{shouldShowSvgFallback ? "--" : metrics.frameMs.toFixed(1)}</strong>
                <span>ms/frame</span>
              </div>
            </div>
            <p className="future-splat-status" aria-live="polite">
              {shouldShowSvgFallback ? "SVG fallback active" : metrics.status}
            </p>
          </section>
        </aside>
      </section>
    </main>
  );
};
