import { useSyncExternalStore } from "react";
import { Icon } from "../ui/Icon";
import type { StepClockProgress } from "./usePlayer3D";

const mmss = (minutes: number): string => {
  const seconds = Math.round(minutes * 60);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

/**
 * The fast step clock (Pack 2 decision 9): a timed stage's stated minutes run in a few seconds, the
 * clock face showing them, while the bench draws what happens in that time (the rod stirring, a
 * precipitate settling). The runtime has already recorded the stage; the next action waits for the
 * clock. The face reads the progress the player's own timer sets (usePlayer3D), the same timer that
 * ends the wait, so the two always agree. Under reduced motion the numbers still count, but the face
 * does not sweep.
 */
export const StepClock = ({ label, minutes, progress, reducedMotion }: {
  label: string;
  minutes: number;
  progress: StepClockProgress;
  reducedMotion: boolean;
}) => {
  const elapsed = Math.min(1, Math.max(0, useSyncExternalStore(progress.subscribe, progress.get)));
  const shown = minutes * elapsed;
  return (
    <div className="s3d-clock" role="timer" aria-label={`${label}: ${mmss(minutes)}`}>
      <span className="s3d-clock__face" style={reducedMotion ? undefined : { ["--s3d-clock-turn" as string]: `${elapsed * 360}deg` }} aria-hidden="true">
        <Icon name="clock" size={16} />
      </span>
      <span className="s3d-clock__label">{label}</span>
      <span className="s3d-clock__time">{mmss(shown)} <span className="s3d-clock__of">of {mmss(minutes)}</span></span>
    </div>
  );
};
