import type { CSSProperties, ReactNode } from "react";
import { GoblinActor } from "./GoblinActor";
import {
  goblinAnimationPresets,
  type GoblinAnimationPreset,
  type GoblinBenchEffect,
  type GoblinMotionKind,
} from "./goblinAnimationPresets";
import "./goblinAnimation.css";

interface GoblinAnimationStageProps {
  className?: string;
  children?: ReactNode;
  preset: GoblinAnimationPreset | GoblinMotionKind;
}

const publicAssetPath = (path: string): string => `${import.meta.env.BASE_URL}${path}`;

const resolvePreset = (preset: GoblinAnimationPreset | GoblinMotionKind): GoblinAnimationPreset =>
  typeof preset === "string" ? goblinAnimationPresets[preset] : preset;

const effectStyle = (effect: GoblinBenchEffect): CSSProperties =>
  ({
    "--goblin-effect-x": `${effect.x}%`,
    "--goblin-effect-y": `${effect.y}%`,
    "--goblin-effect-width": `${effect.width ?? 16}%`,
    "--goblin-effect-rotation": `${effect.rotation ?? 0}deg`,
    "--goblin-effect-delay": `${effect.delayMs ?? 0}ms`,
  }) as CSSProperties;

export const GoblinAnimationStage = ({
  children,
  className,
  preset,
}: GoblinAnimationStageProps) => {
  const activePreset = resolvePreset(preset);

  return (
    <section
      aria-label={`${activePreset.label} goblin animation preview`}
      className={["goblin-animation-stage", className].filter(Boolean).join(" ")}
      data-preset-id={activePreset.id}
    >
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
      {activePreset.effects?.map((effect) => (
        <span
          aria-hidden="true"
          className={`goblin-animation-stage__effect is-${effect.kind}`}
          data-effect-kind={effect.kind}
          key={effect.id}
          style={effectStyle(effect)}
        />
      ))}
      {activePreset.actors.map((cue) => (
        <GoblinActor cue={cue} durationMs={activePreset.durationMs} key={cue.id} />
      ))}
      {children}
    </section>
  );
};
