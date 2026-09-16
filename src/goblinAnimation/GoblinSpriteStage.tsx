import type { CSSProperties, ReactNode } from "react";
import { goblinAnimationPresets, type GoblinBenchEffect } from "./goblinAnimationPresets";
import { GoblinSpriteActor } from "./GoblinSpriteActor";
import type { GoblinSpriteActorCue, GoblinSpriteDefinition } from "./goblinSpriteManifest";

const publicAssetPath = (path: string): string => `${import.meta.env.BASE_URL}${path}`;

interface GoblinSpriteStageProps {
  children?: ReactNode;
  definition: GoblinSpriteDefinition;
  frameIndex: number;
  fps: number;
  playing: boolean;
}

const spritePourEffect: GoblinBenchEffect = {
  id: "sprite-pour-stream",
  kind: "pour-stream",
  x: 61,
  y: 56,
  width: 18,
  rotation: -10,
};

const effectStyle = (effect: GoblinBenchEffect): CSSProperties =>
  ({
    "--goblin-effect-x": `${effect.x}%`,
    "--goblin-effect-y": `${effect.y}%`,
    "--goblin-effect-width": `${effect.width ?? 16}%`,
    "--goblin-effect-rotation": `${effect.rotation ?? 0}deg`,
    "--goblin-effect-delay": `${effect.delayMs ?? 0}ms`,
  }) as CSSProperties;

const sanitizeKeyframeName = (value: string): string => value.replace(/[^a-zA-Z0-9_-]/g, "-");

const framePercent = (frame: number, frameCount: number): number => (frame / frameCount) * 100;

const streamKeyframeNameFor = (definition: GoblinSpriteDefinition): string =>
  `goblin-sprite-stream-${sanitizeKeyframeName(definition.id)}`;

const streamKeyframesFor = (definition: GoblinSpriteDefinition): string | undefined => {
  const events = definition.eventFrames;
  if (events?.pourStart === undefined || events.pourEnd === undefined) return undefined;

  const name = streamKeyframeNameFor(definition);
  const start = framePercent(events.pourStart, definition.frameCount);
  const hold = framePercent(events.pourHoldStart ?? events.pourStart, definition.frameCount);
  const end = framePercent(events.pourEnd + 1, definition.frameCount);
  const before = Math.max(0, start - 7);
  const after = Math.min(100, end + 7);

  return `
@keyframes ${name} {
  0%, ${before.toFixed(2)}% {
    opacity: 0;
    transform: translate(-50%, -50%) rotate(var(--goblin-effect-rotation)) scaleX(0.16);
  }

  ${start.toFixed(2)}% {
    opacity: 0.84;
    transform: translate(-50%, -50%) rotate(var(--goblin-effect-rotation)) scaleX(0.82);
  }

  ${hold.toFixed(2)}%, ${end.toFixed(2)}% {
    opacity: 0.94;
    transform: translate(-50%, -50%) rotate(var(--goblin-effect-rotation)) scaleX(1);
  }

  ${after.toFixed(2)}%, 100% {
    opacity: 0;
    transform: translate(-50%, -50%) rotate(var(--goblin-effect-rotation)) scaleX(0.2);
  }
}`;
};

const isFrameInsidePourEvent = (definition: GoblinSpriteDefinition, frameIndex: number): boolean => {
  const events = definition.eventFrames;
  return Boolean(
    events?.pourStart !== undefined &&
      events.pourEnd !== undefined &&
      frameIndex >= events.pourStart &&
      frameIndex <= events.pourEnd,
  );
};

const spriteEffectStyle = (
  effect: GoblinBenchEffect,
  definition: GoblinSpriteDefinition,
  fps: number,
  frameIndex: number,
  playing: boolean,
): CSSProperties => {
  const durationMs = (definition.frameCount / Math.max(1, fps)) * 1000;
  const activeStaticFrame = isFrameInsidePourEvent(definition, frameIndex);
  return {
    ...effectStyle(effect),
    animationDuration: `${durationMs}ms`,
    animationName: playing ? streamKeyframeNameFor(definition) : "none",
    opacity: playing ? undefined : activeStaticFrame ? 0.92 : 0,
    transform: playing
      ? undefined
      : activeStaticFrame
        ? `translate(-50%, -50%) rotate(${effect.rotation ?? 0}deg) scaleX(1)`
        : `translate(-50%, -50%) rotate(${effect.rotation ?? 0}deg) scaleX(0.16)`,
  } as CSSProperties;
};

const effectsFor = (definition: GoblinSpriteDefinition): GoblinBenchEffect[] =>
  definition.motion === "pour" ? [spritePourEffect] : (goblinAnimationPresets[definition.motion].effects ?? []);

const cueFor = (definition: GoblinSpriteDefinition): GoblinSpriteActorCue => ({
  id: `${definition.id}-trial`,
  spriteId: definition.id,
  x: definition.stageCue?.x ?? 42,
  y: definition.stageCue?.y ?? 77,
  scale: definition.stageCue ? undefined : definition.scale,
  facing: definition.stageCue?.facing ?? "right",
});

const renderEffect = (
  effect: GoblinBenchEffect,
  definition: GoblinSpriteDefinition,
  fps: number,
  frameIndex: number,
  playing: boolean,
) => {
  const style =
    definition.motion === "pour" && effect.kind === "pour-stream"
      ? spriteEffectStyle(effect, definition, fps, frameIndex, playing)
      : effectStyle(effect);

  return (
    <span
      aria-hidden="true"
      className={`goblin-animation-stage__effect is-${effect.kind}`}
      data-effect-kind={effect.kind}
      key={effect.id}
      style={style}
    />
  );
};

export const GoblinSpriteStage = ({
  children,
  definition,
  frameIndex,
  fps,
  playing,
}: GoblinSpriteStageProps) => {
  const streamKeyframes = definition.motion === "pour" ? streamKeyframesFor(definition) : undefined;

  return (
    <section
      aria-label={`${definition.motion} sprite animation preview`}
      className="goblin-animation-stage goblin-sprite-stage"
      data-character-id={definition.characterId}
      data-motion-kind={definition.motion}
      data-pour-end-frame={definition.eventFrames?.pourEnd}
      data-pour-start-frame={definition.eventFrames?.pourStart}
      data-render-mode="sprite"
      data-sprite-id={definition.id}
      data-stage-cue-x={definition.stageCue?.x}
      data-stage-cue-y={definition.stageCue?.y}
    >
      {streamKeyframes ? <style>{streamKeyframes}</style> : null}
      <div className="goblin-animation-stage__grid" aria-hidden="true" />
      <div className="goblin-animation-stage__bench" aria-hidden="true" />
      <img
        alt=""
        aria-hidden="true"
        className="goblin-animation-stage__equipment is-stand"
        src={publicAssetPath("assets/equipment-realistic/v1/funnel-paper-stand.png")}
      />
      <img
        alt=""
        aria-hidden="true"
        className="goblin-animation-stage__equipment is-beaker"
        src={publicAssetPath("assets/equipment-realistic/v1/beaker-250ml.png")}
      />
      <img
        alt=""
        aria-hidden="true"
        className="goblin-animation-stage__equipment is-wash"
        src={publicAssetPath("assets/equipment-realistic/v1/wash-bottle.png")}
      />
      {effectsFor(definition).map((effect) => renderEffect(effect, definition, fps, frameIndex, playing))}
      <GoblinSpriteActor
        cue={cueFor(definition)}
        definition={definition}
        frameIndex={frameIndex}
        fps={fps}
        playing={playing}
      />
      {children}
    </section>
  );
};
