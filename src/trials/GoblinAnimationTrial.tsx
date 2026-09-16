import { useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import {
  GoblinAnimationStage,
  GoblinSpriteStage,
  getGoblinSpriteDefinition,
  goblinAnimationPresetOrder,
  goblinAnimationPresets,
  spriteIdFor,
  type GoblinCharacterId,
  type GoblinMotionKind,
} from "../goblinAnimation";

type GoblinRenderMode = "sprite" | "rig";

const characterOptions: GoblinCharacterId[] = ["apparatus-helper", "notebook-helper"];
const motionOptions: GoblinMotionKind[] = ["idle", "carry", "work", "rinse", "pour"];
const fpsOptions = [6, 8, 10, 12];

export const GoblinAnimationTrial = () => {
  const [renderMode, setRenderMode] = useState<GoblinRenderMode>("sprite");
  const [spriteCharacterId, setSpriteCharacterId] = useState<GoblinCharacterId>("apparatus-helper");
  const [spriteMotion, setSpriteMotion] = useState<GoblinMotionKind>("pour");
  const [playing, setPlaying] = useState(true);
  const [frameIndex, setFrameIndex] = useState(15);
  const [fps, setFps] = useState(12);
  const [activePresetId, setActivePresetId] = useState<GoblinMotionKind>("idle");
  const [replayToken, setReplayToken] = useState(0);
  const activePreset = useMemo(() => goblinAnimationPresets[activePresetId], [activePresetId]);
  const spriteDefinition = getGoblinSpriteDefinition(spriteIdFor(spriteCharacterId, spriteMotion));
  const activeTitle =
    renderMode === "sprite" && spriteDefinition
      ? `${spriteDefinition.characterId} / ${spriteDefinition.motion}`
      : `${activePreset.label} rig`;
  const activeDescription =
    renderMode === "sprite"
      ? spriteDefinition
        ? "Sprite-sheet vertical slice with source frames, manifest metadata, and deterministic playback."
        : "No approved sprite sheet exists for this character and motion yet."
      : activePreset.description;
  const maxFrame = spriteDefinition ? spriteDefinition.frameCount - 1 : 0;
  const setStaticFrame = (nextFrame: number) => {
    if (!spriteDefinition) return;
    setPlaying(false);
    setFrameIndex(Math.min(Math.max(nextFrame, 0), maxFrame));
  };

  return (
    <main className="goblin-animation-trial" aria-labelledby="goblin-animation-title">
      <header className="surface-header realistic-trial-header">
        <div>
          <a className="trial-back-link" href="#/">
            <ArrowLeft size={16} aria-hidden="true" /> Home
          </a>
          <h1 id="goblin-animation-title">Goblin Animation Trial</h1>
          <p>Standalone rig test for animated helper characters before player integration.</p>
        </div>
        <p className="trial-note">
          Hidden prototype route. The live filtration Goblin mode still uses its current workbench
          animation while this module is evaluated.
        </p>
      </header>

      <section className="goblin-animation-trial__workspace" aria-label="Goblin animation prototype">
        <div className="goblin-animation-trial__stage-shell">
          <div className="goblin-animation-trial__toolbar">
            <div>
              <strong>{activeTitle}</strong>
              <span>{activeDescription}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setPlaying(true);
                setFrameIndex(0);
                setReplayToken((token) => token + 1);
              }}
            >
              <RotateCcw size={16} aria-hidden="true" /> Replay
            </button>
          </div>
          {renderMode === "sprite" && spriteDefinition ? (
            <GoblinSpriteStage
              definition={spriteDefinition}
              fps={fps}
              frameIndex={frameIndex}
              key={`${spriteDefinition.id}-${replayToken}`}
              playing={playing}
            />
          ) : renderMode === "sprite" ? (
            <section
              aria-label="Unavailable sprite animation preview"
              className="goblin-animation-stage goblin-sprite-stage is-unavailable"
              data-render-mode="sprite"
            >
              <div className="goblin-animation-stage__grid" aria-hidden="true" />
              <div className="goblin-animation-stage__bench" aria-hidden="true" />
              <p className="goblin-sprite-stage__empty">Sprite sheet not generated for this motion yet.</p>
            </section>
          ) : (
            <GoblinAnimationStage key={`${activePreset.id}-${replayToken}`} preset={activePreset} />
          )}
        </div>

        <aside className="goblin-animation-trial__controls" aria-labelledby="goblin-preset-title">
          <div className="panel-heading">
            <h2 id="goblin-preset-title">
              <Play size={16} aria-hidden="true" /> Animation Controls
            </h2>
            <span>{renderMode}</span>
          </div>
          <div className="goblin-animation-trial__mode-grid" role="group" aria-label="Render mode">
            <button
              aria-pressed={renderMode === "sprite"}
              onClick={() => setRenderMode("sprite")}
              type="button"
            >
              Sprite
            </button>
            <button
              aria-pressed={renderMode === "rig"}
              onClick={() => setRenderMode("rig")}
              type="button"
            >
              Rig comparison
            </button>
          </div>
          {renderMode === "sprite" ? (
            <>
              <label className="goblin-animation-trial__field">
                Character
                <select
                  onChange={(event) => {
                    const nextCharacter = event.currentTarget.value as GoblinCharacterId;
                    const nextMotion =
                      motionOptions.find((motion) =>
                        getGoblinSpriteDefinition(spriteIdFor(nextCharacter, motion)),
                      ) ?? spriteMotion;
                    const nextDefinition = getGoblinSpriteDefinition(spriteIdFor(nextCharacter, nextMotion));
                    setSpriteCharacterId(nextCharacter);
                    setSpriteMotion(nextMotion);
                    setFrameIndex(nextDefinition?.stillFrame ?? 0);
                    setPlaying(Boolean(nextDefinition));
                  }}
                  value={spriteCharacterId}
                >
                  {characterOptions.map((characterId) => (
                    <option key={characterId} value={characterId}>
                      {characterId}
                    </option>
                  ))}
                </select>
              </label>
              <label className="goblin-animation-trial__field">
                Motion
                <select
                  onChange={(event) => {
                    const nextMotion = event.currentTarget.value as GoblinMotionKind;
                    const nextDefinition = getGoblinSpriteDefinition(
                      spriteIdFor(spriteCharacterId, nextMotion),
                    );
                    setSpriteMotion(nextMotion);
                    setFrameIndex(nextDefinition?.stillFrame ?? 0);
                    setPlaying(Boolean(nextDefinition));
                  }}
                  value={spriteMotion}
                >
                  {motionOptions.map((motion) => {
                    const available = Boolean(getGoblinSpriteDefinition(spriteIdFor(spriteCharacterId, motion)));
                    return (
                      <option disabled={!available} key={motion} value={motion}>
                        {available ? motion : `${motion} (not generated)`}
                      </option>
                    );
                  })}
                </select>
              </label>
              <div className="goblin-animation-trial__mode-grid" role="group" aria-label="Playback">
                <button
                  aria-pressed={playing}
                  disabled={!spriteDefinition}
                  onClick={() => setPlaying((current) => !current)}
                  type="button"
                >
                  {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
                  {playing ? "Pause" : "Play"}
                </button>
                <label className="goblin-animation-trial__field is-inline">
                  FPS
                  <select onChange={(event) => setFps(Number(event.currentTarget.value))} value={fps}>
                    {fpsOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="goblin-animation-trial__field">
                Frame {frameIndex} / {maxFrame}
                <div className="goblin-animation-trial__frame-stepper">
                  <button
                    aria-label="Previous frame"
                    disabled={!spriteDefinition || frameIndex <= 0}
                    onClick={() => setStaticFrame(frameIndex - 1)}
                    type="button"
                  >
                    <ChevronLeft size={16} aria-hidden="true" />
                  </button>
                  <input
                    disabled={!spriteDefinition}
                    max={maxFrame}
                    min={0}
                    onChange={(event) => setStaticFrame(Number(event.currentTarget.value))}
                    type="range"
                    value={Math.min(frameIndex, maxFrame)}
                  />
                  <button
                    aria-label="Next frame"
                    disabled={!spriteDefinition || frameIndex >= maxFrame}
                    onClick={() => setStaticFrame(frameIndex + 1)}
                    type="button"
                  >
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                </div>
              </label>
            </>
          ) : (
            <div className="goblin-animation-trial__preset-grid" role="group" aria-label="Animation preset">
              {goblinAnimationPresetOrder.map((presetId) => {
                const preset = goblinAnimationPresets[presetId];
                return (
                  <button
                    aria-pressed={activePresetId === presetId}
                    key={preset.id}
                    onClick={() => setActivePresetId(preset.id)}
                    type="button"
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          )}
          <div className="goblin-animation-trial__details">
            <strong>{renderMode === "sprite" ? "Sprite vertical slice" : "Rig fallback"}</strong>
            <p>
              {renderMode === "sprite"
                ? "Only apparatus-helper / pour is generated. Other motions stay blocked until their source frames and sheets pass validation."
                : "The CSS-limb prototype remains here only for comparison while sprite quality is evaluated."}
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
};
