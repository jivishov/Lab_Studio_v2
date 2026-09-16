import { Ban, Camera, Flame, Gauge, Image as ImageIcon, RotateCcw, Timer } from "lucide-react";
import { useState } from "react";

type BunsenFrameId = "off" | "low-flame" | "high-flame" | "cooldown";

type BunsenFrame = {
  id: BunsenFrameId;
  label: string;
  temperature: string;
  description: string;
  flameClass: string;
};

const publicAssetPath = (path: string): string => {
  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${base}${path.replace(/^\/+/, "")}`;
};

const TRAINED_MANIFEST_PATH = publicAssetPath(
  "assets/equipment-splats/bunsen-burner-v1/manifest.json",
);
const SVG_REFERENCE = publicAssetPath("assets/equipment-realistic/v1/bunsen-burner.svg");

const BUNSEN_FRAMES: BunsenFrame[] = [
  {
    id: "off",
    label: "Off",
    temperature: "22 C",
    description: "Static burner geometry with no flame.",
    flameClass: "is-off",
  },
  {
    id: "low-flame",
    label: "Low flame",
    temperature: "84 C",
    description: "Small stable flame; burner geometry stays fixed.",
    flameClass: "is-low-flame",
  },
  {
    id: "high-flame",
    label: "High flame",
    temperature: "148 C",
    description: "Tall flame state for the maximum temporal difference.",
    flameClass: "is-high-flame",
  },
  {
    id: "cooldown",
    label: "Cooldown",
    temperature: "39 C",
    description: "Residual low glow after the gas is turned down.",
    flameClass: "is-cooldown",
  },
];

const frameById = (id: BunsenFrameId) =>
  BUNSEN_FRAMES.find((frame) => frame.id === id) ?? BUNSEN_FRAMES[0];

const BunsenSvgReference = ({ frame }: { frame: BunsenFrame }) => (
  <div
    className={`future-splat-png-stage is-burner-trial ${frame.flameClass}`}
    data-testid="future-splat-png-fallback"
  >
    <div className="future-splat-bench-line" />
    <div className="future-splat-burner-shadow" />
    <img
      alt="Realistic Bunsen burner SVG reference"
      className="future-splat-png-burner-trial"
      draggable={false}
      src={SVG_REFERENCE}
    />
    <div aria-hidden="true" className="future-splat-burner-flame">
      <span />
    </div>
    <div aria-hidden="true" className="future-splat-heat-haze" />
  </div>
);

export const BunsenBurner4dgsTrial = () => {
  const [frameId, setFrameId] = useState<BunsenFrameId>("off");
  const [orbitEnabled, setOrbitEnabled] = useState(true);
  const [zoomEnabled, setZoomEnabled] = useState(true);

  const frame = frameById(frameId);
  const frameIndex = BUNSEN_FRAMES.findIndex((candidate) => candidate.id === frame.id);

  return (
    <main className="future-splat-trial">
      <header className="realistic-trial-header future-splat-header">
        <div>
          <a href="#/">Back to Lab Studio</a>
          <h1>Bunsen Burner 4DGS Trial</h1>
          <p>
            Standalone synthetic reconstruction trial. Browser splat rendering is held until
            trained assets pass visual QA.
          </p>
        </div>
        <div className="trial-note" role="status">
          The previous procedural blob impostor is quarantined. This page shows only the realistic
          SVG reference until a real Blender-trained PLY/SOG export is accepted.
        </div>
      </header>

      <section className="future-splat-workspace" aria-label="Bunsen burner 4DGS trial workspace">
        <div className="future-splat-stage-shell">
          <div className="future-splat-stage-toolbar">
            <div>
              <strong>{frame.label}</strong>
              <span>{frame.description}</span>
            </div>
            <div className="future-splat-stage-actions" aria-label="Camera controls">
              <button
                aria-pressed={orbitEnabled}
                onClick={() => setOrbitEnabled((enabled) => !enabled)}
                type="button"
              >
                <Camera size={16} aria-hidden="true" /> Orbit
              </button>
              <button
                aria-pressed={zoomEnabled}
                onClick={() => setZoomEnabled((enabled) => !enabled)}
                type="button"
              >
                <Gauge size={16} aria-hidden="true" /> Zoom
              </button>
              <button
                onClick={() => {
                  setFrameId("off");
                  setOrbitEnabled(true);
                  setZoomEnabled(true);
                }}
                type="button"
              >
                <RotateCcw size={16} aria-hidden="true" /> Reset
              </button>
            </div>
          </div>

          <div className="future-splat-stage-frame">
            <BunsenSvgReference frame={frame} />
          </div>
        </div>

        <aside className="future-splat-controls" aria-label="Trial controls">
          <section className="future-splat-control-panel" aria-label="Time scrubber">
            <div className="panel-heading compact">
              <h2>
                <Timer size={16} aria-hidden="true" /> Time Scrubber
              </h2>
              <span>{frame.temperature}</span>
            </div>
            <label className="future-splat-range-label">
              Flame sequence
              <input
                aria-label="Bunsen flame timeline"
                max={BUNSEN_FRAMES.length - 1}
                min={0}
                onChange={(event) => setFrameId(BUNSEN_FRAMES[Number(event.target.value)].id)}
                step={1}
                type="range"
                value={frameIndex}
              />
            </label>
            <div className="future-splat-segments">
              {BUNSEN_FRAMES.map((candidate) => (
                <button
                  className={candidate.id === frame.id ? "is-active" : undefined}
                  key={candidate.id}
                  onClick={() => setFrameId(candidate.id)}
                  type="button"
                >
                  {candidate.label}
                </button>
              ))}
            </div>
          </section>

          <section className="future-splat-control-panel" aria-label="Render mode">
            <div className="panel-heading compact">
              <h2>
                <ImageIcon size={16} aria-hidden="true" /> Render Mode
              </h2>
              <span>Pending QA</span>
            </div>
            <label className="future-splat-toggle">
              <input checked disabled readOnly type="checkbox" />
              SVG fallback
            </label>
            <label className="future-splat-toggle is-disabled">
              <input disabled readOnly type="checkbox" />
              Trained synthetic 4DGS
            </label>
            <dl className="future-splat-manifest-list">
              <div>
                <dt>Candidate manifest</dt>
                <dd>{TRAINED_MANIFEST_PATH}</dd>
              </div>
              <div>
                <dt>Fallback</dt>
                <dd>{SVG_REFERENCE}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>No accepted PLY/SOG export published.</dd>
              </div>
            </dl>
            <div className="future-splat-warning">
              Browser integration stays disabled until Blender renders, training output, held-out
              views, and PlayCanvas conversion all pass QA.
            </div>
          </section>

          <section className="future-splat-control-panel" aria-label="Experiment status">
            <div className="panel-heading compact">
              <h2>
                <Flame size={16} aria-hidden="true" /> 4DGS Status
              </h2>
              <span>Synthetic</span>
            </div>
            <div className="future-splat-stat-grid">
              <div>
                <strong>4</strong>
                <span>timesteps</span>
              </div>
              <div>
                <strong>48</strong>
                <span>views each</span>
              </div>
            </div>
            <div className="future-splat-status">
              <Ban size={14} aria-hidden="true" /> No trained asset is exposed to the browser yet.
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
};
