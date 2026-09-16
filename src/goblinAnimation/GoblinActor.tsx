import type { CSSProperties } from "react";
import type { GoblinActorCue, GoblinCharacterId } from "./goblinAnimationPresets";

const goblinAssetPath = (characterId: GoblinCharacterId): string =>
  `${import.meta.env.BASE_URL}assets/goblin-mode/${characterId}.png`;

interface GoblinActorProps {
  cue: GoblinActorCue;
  durationMs: number;
}

export const GoblinActor = ({ cue, durationMs }: GoblinActorProps) => {
  const style = {
    "--goblin-actor-x": `${cue.x}%`,
    "--goblin-actor-y": `${cue.y}%`,
    "--goblin-actor-scale": cue.scale,
    "--goblin-actor-facing": cue.facing === "left" ? -1 : 1,
    "--goblin-actor-delay": `${cue.delayMs ?? 0}ms`,
    "--goblin-actor-duration": `${durationMs}ms`,
  } as CSSProperties;

  return (
    <span
      aria-hidden="true"
      className={[
        "goblin-actor",
        `is-${cue.characterId}`,
        `is-${cue.motion}`,
        `is-facing-${cue.facing}`,
        cue.effect ? `has-${cue.effect}-effect` : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-character-id={cue.characterId}
      data-effect={cue.effect}
      data-motion-kind={cue.motion}
      style={style}
    >
      <span className="goblin-actor__shadow" />
      <span className="goblin-actor__rig">
        <span className="goblin-actor__limb goblin-actor__limb--leg goblin-actor__limb--back" />
        <span className="goblin-actor__limb goblin-actor__limb--leg goblin-actor__limb--front" />
        <span className="goblin-actor__limb goblin-actor__limb--arm goblin-actor__limb--back" />
        <img alt="" className="goblin-actor__body" src={goblinAssetPath(cue.characterId)} />
        <span className="goblin-actor__limb goblin-actor__limb--arm goblin-actor__limb--front" />
        <span className="goblin-actor__effect" />
      </span>
    </span>
  );
};
