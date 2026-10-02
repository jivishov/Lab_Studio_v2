import { Icon } from "../ui/Icon";

/**
 * Drop mode (decided 2026-10-02): the pipette is held over the vessel and the camera is level with
 * the line. Tap for one drop, hold to let it run, and say when the bottom of the meniscus touches
 * the line; the runtime judges it within one drop. No volume is shown: the student reads the line.
 * Every control is a button, so the step can be done without the canvas (G-6).
 */
export const DropPanel = ({ title, onDrop, onRunStart, onRunEnd, onAccept, onPutDown }: {
  title: string;
  onDrop: () => void;
  onRunStart: () => void;
  onRunEnd: () => void;
  onAccept: () => void;
  onPutDown: () => void;
}) => (
  <div className="s3d-drop" role="group" aria-label={title}>
    <p className="s3d-drop__title"><Icon name="pour" size={16} />{title}</p>
    <p className="s3d-drop__help">Tap for one drop, or hold to let it run. When the bottom of the meniscus touches the line, choose At the line.</p>
    <div className="s3d-drop__actions">
      <button type="button" className="s3d-button" onClick={onDrop}>One drop</button>
      <button type="button" className="s3d-button" onPointerDown={(e) => { e.preventDefault(); onRunStart(); }}
        onPointerUp={onRunEnd} onPointerLeave={onRunEnd} onPointerCancel={onRunEnd}
        onKeyDown={(e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); onRunStart(); } }}
        onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onRunEnd(); } }}>Hold to run</button>
      <button type="button" className="s3d-button s3d-button--primary" onClick={onAccept}>At the line</button>
      <button type="button" className="s3d-link" onClick={onPutDown}>Put the pipette down</button>
    </div>
    <p className="s3d-drop__keys">Space: tap for a drop, hold to run · Enter: at the line · Esc: put down</p>
  </div>
);
