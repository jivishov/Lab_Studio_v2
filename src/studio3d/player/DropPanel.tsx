import { useEffect, useRef } from "react";
import { Icon } from "../ui/Icon";

/**
 * Drop mode (decided 2026-10-02): the pipette is held over the vessel and the camera is level with
 * the line. Tap for one drop, hold to let it run, and say when the bottom of the meniscus touches
 * the line; the runtime judges it within one drop. No volume is shown: the student reads the line.
 * Every control is a button, so the step can be done without the canvas (G-6).
 *
 * At a graduation (decided 2026-10-10), a level past the line is drawn back up into the pipette: Draw back
 * dips the tip just under the surface and eases the bulb, a drop's worth for a tap and more while it is held.
 * It is there at every such step, past the line or not, so it never tells where the level is.
 */
export const DropPanel = ({ title, onDrop, onRunStart, onRunEnd, onAccept, onPutDown, drawBack }: {
  title: string;
  onDrop: () => void;
  onRunStart: () => void;
  onRunEnd: () => void;
  onAccept: () => void;
  onPutDown: () => void;
  drawBack?: { onTap: () => void; onRunStart: () => void; onRunEnd: () => void };
}) => (
  <div className="s3d-drop" role="group" aria-label={title}>
    <p className="s3d-drop__title"><Icon name="pour" size={16} />{title}</p>
    <p className="s3d-drop__help">
      {`Tap for one drop, or hold to let it run.${drawBack ? " Past the line? Draw back takes the excess up into the pipette: tap for a drop's worth, hold for more." : ""}`}
      {" When the bottom of the meniscus touches the line, choose At the line."}
    </p>
    <div className="s3d-drop__actions">
      <button type="button" className="s3d-button" onClick={onDrop}>One drop</button>
      <button type="button" className="s3d-button" onPointerDown={(e) => { e.preventDefault(); onRunStart(); }}
        onPointerUp={onRunEnd} onPointerLeave={onRunEnd} onPointerCancel={onRunEnd}
        onKeyDown={(e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); onRunStart(); } }}
        onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onRunEnd(); } }}>Hold to run</button>
      {drawBack ? <TapOrHold label="Draw back" hand="draw-back" {...drawBack} /> : null}
      {/* data-hand-press: hand control presses these with a closed grip held over them (decided 2026-10-04). */}
      <button type="button" className="s3d-button s3d-button--primary" data-hand-press="at-the-line" onClick={onAccept}>At the line</button>
      <button type="button" className="s3d-link" data-hand-press="put-down" onClick={onPutDown}>Put the pipette down</button>
    </div>
    <p className="s3d-drop__keys">Space: tap for a drop, hold to run · Enter: at the line · Esc: put down</p>
  </div>
);

/**
 * One button that a tap presses once and a press held 300 ms runs until let go (decided 2026-10-10), by pointer or
 * by Space or Enter while it has focus. Hand control's grip clicks it, which is a tap.
 */
const TapOrHold = ({ label, hand, onTap, onRunStart, onRunEnd }: {
  label: string;
  hand: string;
  onTap: () => void;
  onRunStart: () => void;
  onRunEnd: () => void;
}) => {
  // Pending: the timer that starts the run; 0: running.
  const hold = useRef<number | undefined>(undefined);
  const press = () => {
    if (hold.current === undefined) hold.current = window.setTimeout(() => { hold.current = 0; onRunStart(); }, 300);
  };
  const release = (tap: boolean) => {
    const pending = hold.current;
    if (pending === undefined) return;
    hold.current = undefined;
    if (pending) {
      window.clearTimeout(pending);
      if (tap) onTap();
    } else onRunEnd();
  };
  useEffect(() => () => release(false), []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <button type="button" className="s3d-button" data-hand-press={hand}
      // A pointer or a key presses through its own events; a click with no press count is hand control's.
      onClick={(e) => { if (e.detail === 0) onTap(); }}
      onPointerDown={(e) => { if (e.button === 0) { e.preventDefault(); press(); } }}
      onPointerUp={() => release(true)} onPointerLeave={() => release(false)} onPointerCancel={() => release(false)}
      onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (!e.repeat) press(); } }}
      onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); release(true); } }}>{label}</button>
  );
};
