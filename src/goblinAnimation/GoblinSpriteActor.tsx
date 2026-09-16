import type { CSSProperties } from "react";
import type { GoblinSpriteActorCue, GoblinSpriteDefinition } from "./goblinSpriteManifest";

const publicAssetPath = (path: string): string => `${import.meta.env.BASE_URL}${path}`;

interface GoblinSpriteActorProps {
  cue: GoblinSpriteActorCue;
  definition: GoblinSpriteDefinition;
  frameIndex: number;
  fps: number;
  playing: boolean;
}

const clampFrame = (frameIndex: number, frameCount: number): number =>
  Math.min(Math.max(Math.round(frameIndex), 0), frameCount - 1);

export const GoblinSpriteActor = ({
  cue,
  definition,
  frameIndex,
  fps,
  playing,
}: GoblinSpriteActorProps) => {
  const displayWidth = definition.display?.width ?? 218;
  const displayHeight = definition.display?.height ?? 218;
  const activeFrame = clampFrame(frameIndex, definition.frameCount);
  const frameOffset = -(displayWidth * activeFrame);
  const endOffset = -(displayWidth * (definition.frameCount - 1));
  const durationMs = (definition.frameCount / Math.max(1, fps)) * 1000;
  const facing = cue.facing === "left" ? -1 : 1;
  const scale = cue.scale ?? definition.display?.scale ?? definition.scale;

  const style = {
    "--goblin-sprite-x": `${cue.x}%`,
    "--goblin-sprite-y": `${cue.y}%`,
    "--goblin-sprite-facing": facing,
    "--goblin-sprite-scale": scale,
    "--goblin-sprite-width": `${displayWidth}px`,
    "--goblin-sprite-height": `${displayHeight}px`,
    "--goblin-sprite-sheet-width": `${displayWidth * definition.frameCount}px`,
    "--goblin-sprite-end-position": `${endOffset}px`,
    "--goblin-sprite-static-position": `${frameOffset}px`,
    "--goblin-sprite-duration": `${durationMs}ms`,
    "--goblin-sprite-frame-steps": `steps(${definition.frameCount - 1}, end)`,
    backgroundImage: `url("${publicAssetPath(definition.sheetUrl)}")`,
    backgroundPosition: playing ? undefined : `${frameOffset}px 0`,
  } as CSSProperties;

  return (
    <span
      aria-hidden="true"
      className="goblin-sprite-actor"
      data-character-id={definition.characterId}
      data-frame-index={activeFrame}
      data-motion-kind={definition.motion}
      data-playing={playing ? "true" : "false"}
      data-sprite-id={definition.id}
      style={style}
    />
  );
};
