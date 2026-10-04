import type { HandControl, HandControlState } from "../hand/useHandControl";
import { setHandSettings, smoothingLabel } from "../hand/handTuning";
import type { Handedness } from "../hand/handTracker";
import { Icon } from "../ui/Icon";
import { FloatPanel, type PanelControls } from "./panels";

/**
 * Hand control (handoff §5.15, superseded for Player3D on 2026-10-03/04): the DNA microarray 3D lab's
 * hand-control panel (`microarray-3d.html:156-189`, `3d-v3/app.js:370-427`) inside Lab Studio's
 * floating "hand" panel: the camera preview with the tracked hand drawn over it, a live "do this now"
 * line, the set-up tracker (Start camera, the working hand, then Capture Rest and Capture Press for
 * the thumb plunger, or Set centre and a first pinch in pinch mode), the plunger meter, the gesture
 * cards for Lab Studio's actions (§8 of the brief), and Hand settings. Lab Studio's privacy wording
 * is kept.
 *
 * The dock's Hand control button opens it; the camera starts only from Start camera, so the privacy
 * note and the set-up steps are read before the browser asks (decided 2026-09-24). Closing the panel
 * stops the camera, and it stays mounted when collapsed so the video keeps running.
 */

export const HAND_CONTROL_CLOSE_LABEL = "Close hand control and stop the camera";
export const HAND_CONTROL_UNSUPPORTED_TITLE = "Hand control requires localhost or HTTPS.";
export const HAND_PRIVACY = "Frames are processed locally in the browser. They are not saved, exported, serialized to lab state, or sent to the backend.";

/** What the controller is doing, for the "do this now" line. */
export interface HandGuideContext {
  carrying: boolean;
  dropMode: boolean;
  invertHolding: boolean;
  locked: boolean;
  stroke?: "lower" | "turn";
  draw: boolean;
  /** A pipette over the receiver it empties into: it delivers when squeezed at depth. */
  squeeze: boolean;
  armed?: "armed" | "bubbles";
  lockedLabel?: string;
  /** Not carrying, the aim has settled on an instrument key (TARE). */
  keyLocked: boolean;
}

export type GestureKey = "grab" | "put" | "lock" | "lower" | "turn" | "draw" | "deliver" | "drops" | "invert" | "key" | "leave";

export const handBadge = (s: HandControlState, now: number): { text: string; tone: "" | "on" | "warn" | "error" } => {
  if (s.error && !s.running) return { text: "Error", tone: "error" };
  if (!s.running) return { text: "Off", tone: "" };
  if (now - s.seenAt > 600) return { text: "No hand", tone: "warn" };
  if (s.settings.mode === "thumb" && !s.calibrated) return { text: "Calibrate", tone: "warn" };
  if (s.settings.mode === "pinch" && !s.homeSet) return { text: "Centring", tone: "" };
  return { text: "On", tone: "on" };
};

/** The live guide line, after the source's `renderCamGuide` (`app.js:378-421`), worded for Lab Studio's actions. */
export const handGuide = (s: HandControlState, g: HandGuideContext, now: number): { text: string; gesture?: GestureKey; warn: boolean } => {
  const pinch = s.settings.mode === "pinch";
  const press = pinch ? "pinch" : "press your thumb";
  if (s.error && !s.running) return { text: s.status || "The camera could not start. Mouse controls still work.", warn: true };
  if (!s.running) return { text: "Start the camera. Keep your whole hand in view, about an arm's length from the screen.", warn: false };
  if (now - s.seenAt > 600) return { text: "Show your working hand to the camera, palm facing the screen.", warn: true };
  if (!pinch && !s.profiles.rest) return { text: "Hold a relaxed grip, thumb resting, then press Capture Rest.", warn: false };
  if (!pinch && !s.profiles.press) return { text: "Keep the grip, press your thumb fully down, then press Capture Press.", warn: false };
  if (pinch && !s.homeSet) return { text: "Hold your hand where it feels comfortable. That spot becomes the centre of the bench.", warn: false };
  if (g.dropMode) return { text: `Each ${pinch ? "pinch" : "thumb press"} adds one drop; hold it to let the drops run. Grip over At the line when the meniscus meets it.`, gesture: "drops", warn: false };
  if (g.invertHolding) return { text: "Turn your palm over and back to invert the flask once. Open your hand to let go.", gesture: "invert", warn: false };
  if (g.armed === "bubbles") return { text: `Bubbles! ${pinch ? "Keep pinching" : "Keep the thumb pressed"}, lift the tip out of the liquid, lower back in, then ${pinch ? "let go" : "release"} to draw.`, gesture: "draw", warn: true };
  if (g.locked && g.stroke === "turn") return { text: `Locked on ${g.lockedLabel ?? "the target"}. Turn your palm to pour or tip it; lift away to leave.`, gesture: "turn", warn: false };
  if (g.locked && g.draw) {
    return g.armed === "armed"
      ? { text: `${pinch ? "Keep pinching" : "Keep the thumb pressed"} and lower your hand into the liquid, then ${pinch ? "let go" : "release"} to draw.`, gesture: "draw", warn: false }
      : { text: `Locked on ${g.lockedLabel ?? "the liquid"}. Lift away, ${press} above the liquid, then lower in.`, gesture: "draw", warn: false };
  }
  if (g.locked && g.squeeze) {
    return g.armed === "armed"
      ? { text: `${pinch ? "Keep pinching" : "Keep the thumb pressed"} and lower the tip into ${g.lockedLabel ?? "the receiver"}; it empties there.`, gesture: "deliver", warn: false }
      : { text: `Locked on ${g.lockedLabel ?? "the receiver"}. Lower the tip in, then ${press} to empty the pipette.`, gesture: "deliver", warn: false };
  }
  if (g.locked) return { text: `Locked on ${g.lockedLabel ?? "the target"}. Lower your hand, or slide sideways to leave.`, gesture: "lower", warn: false };
  if (g.carrying) return { text: "Move it where it goes and show an open palm to set it down. Over a target, pause until it locks, then lower your hand or turn your palm.", gesture: "put", warn: false };
  if (g.keyLocked) return { text: `Locked on the key. ${pinch ? "Pinch" : "Press your thumb"} to press it.`, gesture: "key", warn: false };
  return { text: `Close your grip over an item and hold to pick it up. To press TARE, pause on the key until it locks, then ${press}.`, gesture: "grab", warn: false };
};

const GESTURES: Array<{ key: GestureKey; icon: "grip" | "hand" | "lock" | "seat" | "pour" | "pencil" | "flask" | "retry" | "gauge" | "up" | "beaker"; title: string; thumb: string; pinch: string }> = [
  { key: "grab", icon: "grip", title: "Pick up", thumb: "Close your grip over an item or a tray item and hold", pinch: "Close your grip over an item or a tray item and hold" },
  { key: "put", icon: "hand", title: "Set down", thumb: "Show your open palm over the spot and hold", pinch: "Show your open palm over the spot and hold" },
  { key: "lock", icon: "lock", title: "Aim", thumb: "Pause over the target until it locks", pinch: "Pause over the target until it locks" },
  { key: "lower", icon: "seat", title: "Seat", thumb: "Lower your hand", pinch: "Lower your hand" },
  { key: "turn", icon: "pour", title: "Pour or tip", thumb: "Turn your palm, like tipping a beaker", pinch: "Turn your palm, like tipping a beaker" },
  { key: "draw", icon: "pencil", title: "Draw up", thumb: "Press your thumb above the liquid, lower in, then release", pinch: "Pinch above the liquid, lower in, then let go" },
  { key: "deliver", icon: "beaker", title: "Empty a pipette", thumb: "Lower the tip into the receiver, then press your thumb", pinch: "Lower the tip into the receiver, then pinch" },
  { key: "drops", icon: "flask", title: "Drops", thumb: "Each thumb press is a drop; hold it to run", pinch: "Each pinch is a drop; hold it to run" },
  { key: "invert", icon: "retry", title: "Invert", thumb: "Grip the stoppered flask; turn your palm over and back", pinch: "Grip the stoppered flask; turn your palm over and back" },
  { key: "key", icon: "gauge", title: "TARE", thumb: "Pause on the key until it locks, then press your thumb", pinch: "Pause on the key until it locks, then pinch" },
  { key: "leave", icon: "up", title: "Withdraw", thumb: "Lift your hand or move sideways", pinch: "Lift your hand or move sideways" },
];

type StepKey = "start" | "hand" | "rest" | "press" | "centre" | "pinch";

export const HandControlPanel = ({ hand, guide, controls, onClose }: {
  hand: HandControl;
  guide: HandGuideContext;
  controls: PanelControls;
  /** Close the panel, stopping the camera. */
  onClose: () => void;
}) => {
  const s = hand.state;
  const now = performance.now();
  const collapsed = Boolean(controls.layout.hand?.collapsed);
  const pinch = s.settings.mode === "pinch";
  const supported = typeof window !== "undefined" && window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia);
  const badge = handBadge(s, now);
  const line = handGuide(s, guide, now);
  const done: Record<StepKey, boolean> = { start: s.running, hand: s.running, rest: Boolean(s.profiles.rest), press: Boolean(s.profiles.press), centre: s.homeSet, pinch: s.pinchSeen };
  const order: StepKey[] = pinch ? ["start", "centre", "pinch"] : ["start", "rest", "press"];
  const current = order.find((k) => !done[k]);
  const stepClass = (k: StepKey) => [done[k] ? "is-done" : "", k === current ? "is-now" : ""].join(" ").trim() || "is-pending";
  const n = (k: StepKey, i: number) => <span className="s3d-hand__mark">{done[k] ? <Icon name="check" size={12} /> : i}</span>;
  return (
    <FloatPanel id="hand" label="Hand control" className="s3d-hand" controls={controls} keepMounted
      onClose={onClose} closeLabel={HAND_CONTROL_CLOSE_LABEL}
      head={<>
        <h2 className="s3d-float__title">Hand control</h2>
        <span className={`s3d-chip s3d-hand__badge${badge.tone ? ` is-${badge.tone}` : ""}`}>{badge.text}</span>
      </>}>
      <div className="s3d-hand__body" hidden={collapsed}>
        <div className="s3d-hand__video" aria-hidden="true">
          <video ref={hand.videoRef} autoPlay muted playsInline />
          <canvas ref={hand.overlayRef} width={640} height={480} />
        </div>
        <p className={`s3d-hand__guide${line.warn ? " is-warn" : ""}`} role="status" aria-live="polite">{line.text}</p>

        <ol className="s3d-hand__steps" aria-label="Set-up">
          <li className={stepClass("start")}>{n("start", 1)}
            {s.running
              ? <button type="button" className="s3d-button" onClick={hand.stop}><Icon name="x" />Stop camera</button>
              : <button type="button" className="s3d-button s3d-button--primary" disabled={!supported} title={supported ? undefined : HAND_CONTROL_UNSUPPORTED_TITLE} onClick={hand.start}><Icon name="camera" />Start camera</button>}
          </li>
          <li className={stepClass("hand")}>{n("hand", 2)}
            <label className="s3d-hand__select">Hand
              <select value={s.preference} onChange={(e) => hand.setPreference(e.currentTarget.value as Handedness)}>
                <option>Auto</option><option>Right</option><option>Left</option>
              </select>
            </label>
          </li>
          {pinch ? <>
            <li className={stepClass("centre")}>{n("centre", 3)}
              <button type="button" className="s3d-button" disabled={!s.running} title="Your hand position now becomes the centre of the bench view" onClick={hand.setHome}>Set centre here</button>
            </li>
            <li className={stepClass("pinch")}>{n("pinch", 4)}<span>{s.pinchSeen ? "Pinch detected" : "Try a pinch"}</span></li>
          </> : <>
            <li className={stepClass("rest")}>{n("rest", 3)}
              <button type="button" className="s3d-button" disabled={!s.running} title="Hold a relaxed grip with your thumb resting" onClick={() => hand.capture("rest")}>{s.profiles.rest ? "Rest saved" : "Capture Rest"}</button>
            </li>
            <li className={stepClass("press")}>{n("press", 4)}
              <button type="button" className="s3d-button" disabled={!s.running || !s.profiles.rest} title="Keep the grip and press your thumb fully down" onClick={() => hand.capture("press")}>{s.profiles.press ? "Press saved" : "Capture Press"}</button>
            </li>
          </>}
        </ol>
        {!supported ? <span className="s3d-small">{HAND_CONTROL_UNSUPPORTED_TITLE}</span> : null}

        <div className="s3d-hand__meter"><span>{pinch ? "Pinch" : "Thumb"}</span><div aria-hidden="true"><i ref={hand.meterRef} style={{ width: "0%" }} /></div></div>

        <section aria-label="Gestures">
          <ul className="s3d-hand__gestures">
            {GESTURES.map((card) => (
              <li key={card.key} className={line.gesture === card.key ? "is-now" : undefined}>
                <Icon name={card.icon} size={20} />
                <b>{card.title}</b>
                <span>{pinch ? card.pinch : card.thumb}</span>
              </li>
            ))}
          </ul>
        </section>

        <details className="s3d-hand__tuning">
          <summary>Hand settings</summary>
          <label>Plunger gesture
            <select value={s.settings.mode} onChange={(e) => setHandSettings({ mode: e.currentTarget.value === "pinch" ? "pinch" : "thumb" })}>
              <option value="thumb">Thumb press, like a real pipette bulb (recommended)</option>
              <option value="pinch">Pinch thumb and index finger (no calibration)</option>
            </select>
          </label>
          <label className="s3d-hand__speed"><span>Cursor speed</span>
            <input type="range" min="100" max="400" step="10" value={Math.round(s.settings.gain * 100)} onChange={(e) => setHandSettings({ gain: Number(e.currentTarget.value) / 100 })} />
            <strong>{s.settings.gain.toFixed(1)}×</strong>
          </label>
          <label className="s3d-hand__speed"><span>Smoothing</span>
            <input type="range" min="0" max="100" step="5" value={Math.round(s.settings.smoothing * 100)} onChange={(e) => setHandSettings({ smoothing: Number(e.currentTarget.value) / 100 })} />
            <strong>{smoothingLabel(s.settings.smoothing)}</strong>
          </label>
          <label className="s3d-hand__switch">
            <input type="checkbox" checked={s.settings.assist} onChange={(e) => setHandSettings({ assist: e.currentTarget.checked })} />
            <span>Aim assist: bigger targets and snapping to the next one (guided mode)</span>
          </label>
          <p className="s3d-small">Higher speed means smaller hand movements. More smoothing steadies the cursor but reacts later.</p>
        </details>

        <p className={`s3d-small${s.error ? " s3d-hand__error" : ""}`} role="status">{s.status}</p>
        {s.running && s.stats ? <p className="s3d-small">{s.handName ?? "—"} · {Math.round(s.stats.inferenceMS)} ms inference · {Math.round(s.stats.ageMS)} ms frame age</p> : null}
        <p className="s3d-note"><strong>Privacy.</strong> {HAND_PRIVACY}</p>
      </div>
    </FloatPanel>
  );
};

/**
 * The hand cursor over the bench (`app.js:361-367`): a ring, teal while aiming, gold and filling
 * with the insertion depth when locked. `useHandControl` moves it on every frame.
 */
export const HandCursorRing = ({ hand }: { hand: HandControl }) => (
  <span ref={hand.cursorRef} aria-hidden="true" className="s3d-handcursor" hidden />
);
