import { useEffect, useState } from "react";
import { Icon } from "../ui/Icon";

const mmss = (minutes: number): string => {
  const seconds = Math.round(minutes * 60);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

/**
 * The fast step clock (Pack 2 decision 9, 2026-10-05): a timed stage's stated minutes run in a few
 * seconds, the clock face showing them, while the bench draws what happens in that time (the rod
 * stirring, a precipitate settling). It only shows time passing: the runtime has already recorded the
 * stage. Under reduced motion it shows the full time at once.
 */
export const StepClock = ({ label, minutes, seconds, reducedMotion, startedAt }: {
  label: string;
  minutes: number;
  /** How long the clock takes to run the stated minutes. */
  seconds: number;
  reducedMotion: boolean;
  /** Restarts the clock when it changes (one run per committed stage). */
  startedAt: number;
}) => {
  const [elapsed, setElapsed] = useState(reducedMotion ? 1 : 0);
  useEffect(() => {
    if (reducedMotion) { setElapsed(1); return undefined; }
    setElapsed(0);
    const start = performance.now();
    // A timer, not animation frames, so the clock runs while the tab is not drawing.
    const timer = window.setInterval(() => {
      const u = Math.min(1, (performance.now() - start) / (seconds * 1000));
      setElapsed(u);
      if (u >= 1) window.clearInterval(timer);
    }, 100);
    return () => window.clearInterval(timer);
  }, [reducedMotion, seconds, startedAt]);
  const shown = minutes * elapsed;
  return (
    <div className="s3d-clock" role="timer" aria-label={`${label}: ${mmss(minutes)}`}>
      <span className="s3d-clock__face" style={{ ["--s3d-clock-turn" as string]: `${elapsed * 360}deg` }} aria-hidden="true">
        <Icon name="clock" size={16} />
      </span>
      <span className="s3d-clock__label">{label}</span>
      <span className="s3d-clock__time">{mmss(shown)} <span className="s3d-clock__of">of {mmss(minutes)}</span></span>
    </div>
  );
};
