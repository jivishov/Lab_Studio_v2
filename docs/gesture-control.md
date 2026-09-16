# Camera Gesture Control

Camera control is an opt-in Student Player input mode. It keeps camera frames and landmarks in runtime memory only, maps a landmark-derived pinch cursor into the existing lab interaction bridge, and never serializes frame, landmark, model, or provider details into lab JSON or localStorage.

## Tracking Engines

The default engine is MediaPipe Hand Landmarker in `VIDEO` mode. It provides the 21 hand landmarks needed for cursor and pinch math without running the canned gesture classifier. Startup tries GPU first, then CPU. If Hand Landmarker cannot initialize, the worker falls back to the existing MediaPipe Gesture Recognizer CPU path.

Frame processing follows `HTMLVideoElement.requestVideoFrameCallback()` when the browser supports it and falls back to `requestAnimationFrame()`. Camera frames larger than 640 x 480 are reduced without upscaling smaller inputs. The hook keeps one frame in flight and records new frames encountered during worker backpressure as intentionally skipped rather than queueing stale work.

An open-hand cursor uses landmark 8, the index fingertip. While pinching, the cursor uses the midpoint between landmarks 4 and 8 so the visible grab stays at the physical thumb-index contact point. The release sample stays at the last visible contact point before easing back to the index fingertip on the next open-hand frame. Pinch is scale-independent: thumb-to-index distance is divided by the median wrist-to-MCP span for landmarks 5, 9, 13, and 17 in source-pixel coordinates. Pinch begins at a ratio of 0.30 and releases at 0.50. Hands with fewer than 21 finite landmarks or less than 32 source pixels of palm span are reported as unstable.

Normalized cursor coordinates pass through a time-based One Euro filter. The persisted values 1 through 5 map to Precision, Smooth, Balanced, Responsive, and Direct response profiles; `lab-studio:v1:camera-cursor-speed` remains the only gesture preference stored in localStorage.

## Supported Gestures

- Move one open hand to steer the cursor with the index fingertip.
- Pinch thumb and index finger to grab shelf or workbench equipment, or to activate whitelisted `data-gesture-action` controls on release.
- Detachable children inside a rendered assembly opt in with `data-gesture-drag-kind="attached-child"`; the gesture bridge carries the child's instance identity and art into the preview, then commits its release through the current step's normal `dragToZone` intent.
- Hold index, middle, ring, and pinky extended close together, then wave the hand up or down to scroll the locked scroll region under the cursor. Vertical movement scrolls vertical regions; left/right movement scrolls horizontal-only regions such as the workbench.
- The scroll target locks when the four-finger wave activates and remains locked until the pose ends, even if the cursor drifts over another panel.
- Edge-hover scrolling remains available as a fallback while four-finger scrolling is validated.
- Hovering an exact eligible equipment or action target suppresses edge scrolling so target acquisition cannot move the target before pinch start.

When landmarks disappear during a pinch, the cursor and preview may remain held for at most 160 ms. A nearby returning pinch resumes the gesture; an open hand, large jump, timeout, stale sample, blocking dialog, camera stop/reset, unmount, or pointer/touch/keyboard takeover cancels without committing. Camera input re-arms only after an open hand has been continuously tracked for 120 ms.

Worker results publish through a subscription-backed frame source so cursor, equipment-preview, and live probe-lead motion use direct transform/path updates instead of rerendering the complete Student Player. React state changes only for semantic transitions such as pinch state, overlap-target validity, status, and the 500 ms metric refresh. A stale sample cancels and re-arms only when a pinch or grabbed target was active; an idle stale sample simply clears hover and scrolling cues.

The status panel reports processed FPS, inference time, capture-to-result, approximate capture-to-cursor, attempted/submitted/processed/skipped frames, skip rate, sample age, and frame ID. Capture-to-cursor is measured on the animation frame after the overlay update and is approximate when the browser does not expose capture time. Intentional skip rate alone is not a failure signal. All metrics are runtime-only diagnostics.

## Precision Hardware Path

For minimum-latency desktop or kiosk setups, Ultraleap Leap Motion Controller 2 with Hyperion is the recommended precision hardware path. That integration is not bundled in the static app until it can be verified on real hardware and the required local service/tooling is available.

## Manual QA

1. Run `npm run dev` and open `http://127.0.0.1:5175/#/technique/filtration`.
2. Click `Camera control` and grant camera permission.
3. Confirm the status changes to `Ready` when one hand is visible and the runtime metrics show an active engine. Move closer if the status reports `Unstable tracking`.
4. Pinch over a shelf item, move over the workbench, and release; the item should be placed without affecting lab JSON or localStorage.
5. Hold four extended fingers together over the shelf or page and wave down/up; the selected scroll region should scroll without moving the cursor to the edge.
6. Pinch a placed item, move over the valid target, and release; the current step should advance through the same feedback path used by pointer drag.
7. Switch to Assessment mode and try an invalid target; only resolved invalid lab interactions should count as failed attempts.
8. Start a pinch, open About or Camera Help, and confirm the preview clears without placement. Close the dialog, hold an open hand briefly, and confirm camera control re-arms.
9. Start a pinch, then use pointer, touch, or keyboard input. Confirm the unfinished camera action is canceled and does not commit.
10. Click `Reset` and confirm the browser camera indicator turns off and runtime metrics clear.
11. Repeat a short gesture smoke path on `#/technique/paper-chromatography`, `#/technique/transmittance-dilution`, and `#/technique/thermal-decomposition-mass-loss` to verify non-filtration technique specs remain bridge-compatible.

Real webcam behavior should be checked on localhost and on the HTTPS/GitHub Pages deployment because browser permission and secure-context behavior can differ.
