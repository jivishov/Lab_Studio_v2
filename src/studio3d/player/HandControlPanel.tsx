import { statusLabelForGesture, type GestureCameraStatus, type GestureController } from "../../player/gesture/gestureTypes";
import { labelForGestureCursorSpeed } from "../../player/gesture/gestureMath";
import { Icon } from "../ui/Icon";
import { FloatPanel, type PanelControls } from "./panels";

/**
 * Hand control (handoff §5.15): a floating panel with the camera preview, the set-up state, gesture
 * cards and cursor response, the 2D player's existing control. Its wording is the 2D player's camera
 * help and privacy text, with only the control names changed to Player3D's (Hand control, Restart,
 * tray). Its behaviour comes entirely from the shared gesture bridge (plan D6): the panel presents
 * the engine's state and adds no gesture meaning of its own (G-10). It shows while hand control is on,
 * as the 2D camera status panel does, and stays mounted when collapsed so the camera keeps its video.
 */

/** The bridge's re-arm prompt, with Player3D's control name. */
export const HAND_CONTROL_REARM_MESSAGE = "Open your hand briefly to re-arm hand control.";
/** The dock button's title when the page cannot use the camera. */
export const HAND_CONTROL_UNSUPPORTED_TITLE = "Hand control requires localhost or HTTPS.";

export type SetupStepState = "done" | "now" | "problem" | "pending";

export interface SetupStep {
  key: string;
  text: string;
  state?: SetupStepState;
}

/**
 * The 2D requirements sentence ("Use localhost or HTTPS, allow webcam permission, keep one hand
 * visible, and use steady lighting with enough contrast."), one requirement per line, each marked
 * from the engine's own state. Lighting cannot be checked, so it carries no mark.
 */
export const handControlSetupSteps = (supported: boolean, status: GestureCameraStatus): SetupStep[] => {
  const tracking = status === "ready" || status === "noHand" || status === "unstable";
  return [
    { key: "secure", text: "Use localhost or HTTPS", state: supported ? "done" : "problem" },
    {
      key: "permission",
      text: "Allow webcam permission",
      state: tracking ? "done" : status === "starting" ? "now" : status === "permissionDenied" ? "problem" : "pending",
    },
    {
      key: "hand",
      text: "Keep one hand visible",
      state: status === "ready" ? "done" : status === "noHand" || status === "unstable" ? "now" : "pending",
    },
    { key: "light", text: "Use steady lighting with enough contrast" },
  ];
};

/** The 2D "Gestures" help, one card per gesture. */
const GESTURE_CARDS: Array<{ key: string; icon: "cursor" | "hand" | "move"; title: string; text: string }> = [
  { key: "steer", icon: "cursor", title: "Steer", text: "Steer with your index fingertip." },
  { key: "pinch", icon: "hand", title: "Pinch", text: "Pinch thumb and index finger to grab or activate, then release over the target." },
  { key: "scroll", icon: "move", title: "Scroll", text: "Hold four fingers extended together and wave over a panel to scroll it." },
];

const stepMark = (state: SetupStepState | undefined, index: number) => {
  if (state === "done") return <Icon name="check" size={12} />;
  if (state === "problem") return <Icon name="x" size={12} />;
  return state ? <span aria-hidden="true">{index + 1}</span> : <span aria-hidden="true">·</span>;
};

const stepStateLabel: Record<SetupStepState, string> = {
  done: "done",
  now: "now",
  pending: "not yet",
  problem: "needs attention",
};

export const HandControlPanel = ({ gesture, rearmRequired, controls }: {
  gesture: GestureController;
  /** The bridge is waiting for an open hand after a cancel. */
  rearmRequired: boolean;
  controls: PanelControls;
}) => {
  const collapsed = Boolean(controls.layout.hand?.collapsed);
  const status = statusLabelForGesture(gesture.status);
  const steps = handControlSetupSteps(gesture.supported, gesture.status);
  return (
    <FloatPanel id="hand" label="Hand control" className="s3d-hand" controls={controls} keepMounted
      head={<>
        <h2 className="s3d-float__title">Hand control</h2>
        <span className={`s3d-chip s3d-hand__state is-${gesture.status}`}>{status}</span>
      </>}>
      <div className="s3d-hand__body" hidden={collapsed} data-gesture-scroll-region="vertical">
        <div className="s3d-hand__video" aria-hidden="true">
          <video ref={gesture.videoRef} autoPlay muted playsInline />
        </div>

        <section className="s3d-hand__setup" aria-label="Set-up">
          <div className="s3d-hand__status" aria-live="polite">
            <span className="s3d-eyebrow">Tracking state</span>
            <strong>{status}</strong>
            <span className="s3d-small">{rearmRequired ? HAND_CONTROL_REARM_MESSAGE : gesture.message}</span>
          </div>
          <ol className="s3d-hand__steps">
            {steps.map((step, index) => (
              <li key={step.key} className={step.state ? `is-${step.state}` : "is-tip"}>
                <span className="s3d-hand__mark">{stepMark(step.state, index)}</span>
                <span>{step.text}</span>
                {step.state ? <span className="s3d-sr">, {stepStateLabel[step.state]}</span> : null}
              </li>
            ))}
          </ol>
        </section>

        <section aria-label="Gestures">
          <ul className="s3d-hand__gestures">
            {GESTURE_CARDS.map((card) => (
              <li key={card.key}>
                <Icon name={card.icon} size={20} />
                <b>{card.title}</b>
                <span>{card.text}</span>
              </li>
            ))}
          </ul>
          <p className="s3d-small s3d-hand__fallback">Edge-hover scrolling remains available as a fallback.</p>
        </section>

        <label className="s3d-hand__speed">
          <span>Cursor response</span>
          <input
            type="range"
            min="1"
            max="5"
            step="1"
            value={gesture.cursorSpeed}
            aria-label="Cursor response"
            aria-valuetext={labelForGestureCursorSpeed(gesture.cursorSpeed)}
            onChange={(event) => gesture.setCursorSpeed(Number(event.currentTarget.value))}
          />
          <strong>{labelForGestureCursorSpeed(gesture.cursorSpeed)}</strong>
        </label>

        <p className="s3d-note">
          <strong>Privacy.</strong> Frames are processed locally in the browser. They are not saved, exported, serialized to lab state, or sent to the backend.
        </p>

        <details className="s3d-about">
          <summary>More about hand control</summary>
          <p><strong>Controls.</strong> Click Hand control to start or stop. Use Cursor response to balance precision and speed. Restart and leaving the player both stop the camera tracks.</p>
          <p><strong>Where it works.</strong> Hand control is limited to tray placement, bench item movement or interactions, and whitelisted current-step controls.</p>
          <p><strong>Fallbacks.</strong> Mouse, touch, and keyboard stay available. No-hand and unstable-tracking frames do not count as assessment failures. Switching input modes safely cancels an unfinished camera gesture.</p>
        </details>
      </div>
    </FloatPanel>
  );
};
