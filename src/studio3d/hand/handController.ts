import { angle, Contact, HAND_GAP_MS, type HandFrame } from "./handCore";

/**
 * Hand control of Player3D's equipment: the DNA microarray 3D lab's controller
 * (`3d-v3/interaction.js`: aim, lock-on, sway, exits and the plunger; `app.js:23-45`: screen-space
 * picking and aim assist), adapted to Lab Studio's actions with the gesture table decided on
 * 2026-10-04 (`proposals/MICROARRAY_ADOPTION.md` §8):
 *
 * | Action | Hand |
 * |---|---|
 * | Pick up an item or a tray item | a closed grip held 350 ms over it |
 * | Set it down, place it, hold a pipette over a vessel | an open palm held 450 ms over the spot |
 * | Pour | lock on the target, then turn the palm past 60° |
 * | Seat | lock on the seat, then lower the palm (insertion depth 0.85) |
 * | Empty a pipette into a receiver | lock, lower in, and squeeze (the source's deliver: pressed at depth) |
 * | Draw into a pipette | squeeze above the liquid, lock and lower in, let go (the source's draw) |
 * | Spatula | lower into the solid to scoop; lock on the glass and turn the palm to tip it |
 * | Drops (drop mode) | each plunger press is a drop; a press held 300 ms runs |
 * | A panel button marked for the hand ("At the line") | a closed grip held 350 ms over it |
 * | Invert | grip the stoppered vessel, turn the palm over and back: one inversion |
 * | TARE | lock on the key (the aim settles on it), then press the plunger |
 *
 * As in the source, a hand that opens (or stops gripping) drops any lock, candidate or squeeze in
 * progress (`interaction.js:108`); before insertion, sliding onto a neighbour hands the lock over
 * (`slidOff`); and leaving a target with a stroke bound and the tip in cancels it with nothing
 * transferred. What each action does is still decided by the bench's carry and its release order
 * (`useBenchCarry`, `sceneToIntent`); the controller only says when. Aim assist (the step's next
 * target, within 76 px) is guidance, so it applies only in guided mode (G-7).
 */
export interface HandTarget {
  id: string;
  kind: "item" | "control" | "tile" | "button";
  /** Canvas pixels, and the pick radius before the hand's enlargement. */
  x: number;
  y: number;
  r: number;
  instanceId?: string;
  controlId?: string;
  definitionId?: string;
}

/** What the carried item would do here: the carry's own press action, and whether it is a pour or a loaded tool over its target. */
export interface CarryAction {
  action: "commit" | "insert" | "draw" | "dip";
  pour: boolean;
  /** A dipped tool over the target it tips onto. */
  tip: boolean;
  /** A pipette over the receiver it empties into: it delivers when squeezed at depth. */
  squeeze: boolean;
}

export interface HandApi {
  targets: () => HandTarget[];
  /** The step's next target (guided mode only), for aim assist. */
  expectedId: () => string | undefined;
  assist: () => boolean;
  carrying: () => boolean;
  pickUpItem: (instanceId: string) => boolean;
  pickUpTile: (definitionId: string) => boolean;
  /** Move the carried item to canvas point (x, y); returns what a press there would do. */
  aimCarry: (x: number, y: number) => CarryAction | undefined;
  /** Draw the carried item lowered by `depth` (0..1), or a pour source tipped further. */
  carryDepth: (depth: number) => void;
  commitCarry: () => void;
  cancelCarry: () => void;
  loadTool: () => void;
  pressControl: (target: HandTarget) => void;
  pressButton: (target: HandTarget) => void;
  invertTarget: (instanceId: string) => boolean;
  invert: () => void;
  dropMode: () => boolean;
  drop: () => void;
  runDrops: (on: boolean) => void;
  focus: (target: HandTarget | undefined, locked: boolean) => void;
  /** A message; an `error` is a technique correction, with what to do next as `recovery`. */
  say: (text: string, error?: boolean, recovery?: string) => void;
  /** The bench canvas size, for the cursor mapping (the tracker reads it). */
  bounds: () => { width: number; height: number };
  /** A blocking dialog is open: frames and edges are ignored. */
  blocked: () => boolean;
}

export const HAND_TIMING = { gripMs: 350, openMs: 450, dropHoldMs: 300 };
/** The source's aim constants (`interaction.js:16`). Px are screen pixels; Raw are normalized camera units. */
export const HAND_AIM = { settleMS: 160, settleMinPx: 5, settleMaxPx: 8, descentPauseMS: 80, descentWindowMS: 300, descentRaw: 0.006, descentSideRadii: 0.8, shallow: 0.35, relockMS: 350, exitMS: 300, slideRaw: 0.012 };
/** Insertion counts at this depth (`interaction.js:9`). */
export const IMMERSED = 0.85;
/** A pour or a tip starts once the palm has turned this far from where it locked (about 60°). */
export const TURN_RAD = (60 * Math.PI) / 180;
/** Inverting (the ELISA port's strip, `elisa_assay/3d-classroom/interaction.js:177-180`): over past 1.92 rad, back below 1.05. */
export const INVERT = { over: 1.92, back: 1.05 };
/** Hand hit areas: ×1.5 with a 22 px minimum (`app.js:25`); aim assist reaches 76 px; the current target is preferred (×0.72). */
export const HAND_PICK = { scale: 1.5, minPx: 22, assistPx: 76, prefer: 0.72 };

/** Screen-space picking: the target under the cursor wins; the current one is kept until another is clearly nearer. */
export const pickTarget = (targets: readonly HandTarget[], x: number, y: number, opts: { prefer?: string; expected?: string; assist?: boolean } = {}): HandTarget | undefined => {
  const hits = targets.flatMap((t) => {
    const r = Math.max(HAND_PICK.minPx, t.r * HAND_PICK.scale);
    const d = Math.hypot(x - t.x, y - t.y) / r;
    return d < 1 ? [{ t, d: t.id === opts.prefer ? d * HAND_PICK.prefer : d }] : [];
  }).sort((a, b) => a.d - b.d);
  if (hits[0]) return hits[0].t;
  if (opts.assist && opts.expected) {
    const next = targets.find((t) => t.id === opts.expected);
    if (next && Math.hypot(x - next.x, y - next.y) < HAND_PICK.assistPx) return next;
  }
  return undefined;
};

type Stroke = "lower" | "turn";

export class HandController {
  target?: HandTarget;
  contact?: Contact<HandTarget>;
  /** How the locked contact acts: by lowering the palm, or by turning it. */
  stroke?: Stroke;
  private turnBase?: number[];
  private candidate?: { target: HandTarget; frame: HandFrame; since: number; lastStill: number; x: number; y: number };
  private cooldown?: { id: string; until: number };
  private lastFrame?: HandFrame;
  private gripSince?: number;
  private gripTarget?: string;
  private openSince?: number;
  private openHinted = false;
  /** The aim settling on an instrument key: it is locked once still for `settleMS`. */
  private keyAim?: { id: string; since: number; x: number; y: number };
  pressed = false;
  /** The plunger pressed before the tip reached its target (a draw or a delivery is armed), or a draw squeezed inside the liquid (bubbles). */
  armed: "armed" | "bubbles" | undefined;
  /** A stoppered vessel gripped for inverting: the palm's normal when gripped, and whether it is now over. */
  invertHold?: { id: string; base: number[]; over: boolean };
  private dropTimer?: ReturnType<typeof setTimeout>;
  private running = false;
  private carryAction?: CarryAction;

  constructor(private readonly a: HandApi) {}

  /** The target the cursor is locked on: a contact, or an instrument key the aim has settled on. */
  get lockedTarget(): HandTarget | undefined {
    if (this.contact) return this.contact.target;
    const k = this.keyAim, f = this.lastFrame;
    return k && f && this.target?.id === k.id && f.now - k.since >= HAND_AIM.settleMS ? this.target : undefined;
  }

  /** What the carried item would do where the hand is now (for the guide line). */
  get carrying(): CarryAction | undefined {
    return this.a.carrying() ? this.carryAction : undefined;
  }

  /** Drop any motion in progress; nothing is committed and a carried item stays held (`interaction.js:20-25`). */
  resetMotion(reason = ""): void {
    this.contact = undefined;
    this.stroke = undefined;
    this.turnBase = undefined;
    this.candidate = undefined;
    this.gripSince = undefined;
    this.gripTarget = undefined;
    this.openSince = undefined;
    this.keyAim = undefined;
    this.armed = undefined;
    this.pressed = false;
    this.invertHold = undefined;
    if (this.dropTimer) clearTimeout(this.dropTimer);
    this.dropTimer = undefined;
    if (this.running) { this.running = false; this.a.runDrops(false); }
    this.a.focus(this.target, false);
    if (reason) this.a.say(reason);
  }

  private needsLock(c: CarryAction | undefined): Stroke | undefined {
    if (!c) return undefined;
    if (c.pour || c.tip) return "turn";
    return c.action === "commit" ? undefined : "lower";
  }

  /** A plunger stroke bound to the locked target (`interaction.js:65`, `holding`). */
  private holding(): boolean {
    return this.pressed && this.armed === "armed" && Boolean(this.carryAction && (this.carryAction.action === "draw" || this.carryAction.squeeze));
  }

  private lock(t: HandTarget, f: HandFrame, stroke: Stroke): void {
    this.contact = new Contact(t, f);
    this.stroke = stroke;
    this.turnBase = f.normal ? [...f.normal] : undefined;
    this.candidate = undefined;
    this.cooldown = undefined;
    this.a.focus(t, true);
  }

  /** Leave a lock before acting: nothing was done, so nothing is cancelled; a squeezed bulb returns to armed (`interaction.js:78`). */
  private unlock(f: HandFrame): void {
    const c = this.contact;
    this.contact = undefined;
    this.stroke = undefined;
    this.turnBase = undefined;
    this.candidate = undefined;
    if (c) this.cooldown = { id: c.target.id, until: f.now + HAND_AIM.relockMS };
    if (this.armed === "bubbles") this.armed = "armed";
    this.a.carryDepth(0);
    this.a.focus(this.target, false);
  }

  private cooling(t: HandTarget, f: HandFrame): boolean {
    return Boolean(this.cooldown && this.cooldown.id === t.id && f.now < this.cooldown.until);
  }

  /**
   * Before insertion, moving onto a neighbouring item hands the lock over (`interaction.js:71-77`).
   * It needs real hand travel (`slideRaw`, about 7 mm) as well as the aim being nearer the
   * neighbour, judged on the locked target's screen row because lowering the palm also moves the
   * aim down. Returns "far" for a clearly deliberate move.
   */
  private slidOff(c: Contact<HandTarget>, f: HandFrame): false | "near" | "far" {
    const travel = Math.abs((f.rawX ?? f.x) - c.x);
    if (!(travel >= HAND_AIM.slideRaw) || !Number.isFinite(f.x) || !Number.isFinite(c.target.y)) return false;
    const next = pickTarget(this.a.targets().filter((t) => t.kind === "item"), f.x, c.target.y, { prefer: c.target.id });
    return next && next.id !== c.target.id ? (travel >= 2 * HAND_AIM.slideRaw ? "far" : "near") : false;
  }

  /** A target locks once the aim has settled on it, or after a pause followed by the palm dropping (`interaction.js:79-103`). */
  private aim(t: HandTarget, f: HandFrame, stroke: Stroke): void {
    const c = this.candidate;
    if (c) {
      const r = Math.max(HAND_PICK.minPx, c.target.r * HAND_PICK.scale);
      const settle = Math.min(HAND_AIM.settleMaxPx, Math.max(HAND_AIM.settleMinPx, r * 0.45));
      if (Math.hypot(f.x - c.x, f.y - c.y) <= settle) {
        c.lastStill = f.now;
        if (c.target.id === t.id) {
          if (!this.cooling(t, f) && f.now - c.since >= HAND_AIM.settleMS) this.lockAim(c.target, c.frame, f, stroke);
          return;
        }
      } else if (c.lastStill - c.since >= HAND_AIM.descentPauseMS && f.y > c.y && Math.abs(f.x - c.x) <= Math.max(settle, r * HAND_AIM.descentSideRadii)
        && Math.hypot(c.x - c.target.x, c.y - c.target.y) <= r * 0.5 && !this.cooling(c.target, f)) {
        // Lowering the palm also moves the aim down; a straight drop right after a pause is the insertion itself.
        const drop = (f.palmY ?? f.y) - (c.frame.palmY ?? c.frame.y);
        if (drop >= HAND_AIM.descentRaw) { this.lockAim(c.target, c.frame, f, stroke); return; }
        if (drop >= HAND_AIM.descentRaw * 0.3 && f.now - c.lastStill <= HAND_AIM.descentWindowMS) return;
      }
    }
    this.candidate = { target: t, frame: { ...f }, since: f.now, lastStill: f.now, x: f.x, y: f.y };
  }

  private lockAim(t: HandTarget, base: HandFrame, f: HandFrame, stroke: Stroke): void {
    this.lock(t, base, stroke);
    this.contact?.update(f, false);
    if (!this.contact?.valid) { this.contact = undefined; this.stroke = undefined; }
  }

  /** One hand frame. */
  feed(f: HandFrame): void {
    if (!Number.isFinite(f.now)) return;
    const last = this.lastFrame;
    if (!f.ready || (last && (f.now - last.now > HAND_GAP_MS || f.now < last.now))) {
      this.resetMotion();
      if (!f.ready) { this.lastFrame = f; return; }
    }
    // An open hand, or one no longer gripping, drops a lock or a squeeze in progress (`interaction.js:108`).
    if ((!f.grip || f.open) && (this.contact || this.candidate || this.armed)) this.resetMotion();
    this.lastFrame = f;
    const expected = this.a.expectedId();
    const t = pickTarget(this.a.targets(), f.x, f.y, { prefer: this.target?.id, expected, assist: this.a.assist() });

    if (this.a.dropMode()) {
      this.target = t;
      this.a.focus(t, false);
      return;
    }

    if (this.invertHold) {
      const hold = this.invertHold;
      if (f.open) { this.invertHold = undefined; return; }
      if (f.normal) {
        const turn = angle(f.normal, hold.base);
        if (!hold.over && turn > INVERT.over) hold.over = true;
        else if (hold.over && turn < INVERT.back) { hold.over = false; this.a.invert(); }
      }
      return;
    }

    if (this.a.carrying()) {
      if (this.contact) {
        const c = this.contact, before = c.depth;
        c.update(f, this.holding());
        if (c.valid) {
          // An exit counts once it has lasted exitMS, or at once when it is clearly deliberate, so arm sway never knocks the lock off.
          let exit = c.exit, far = c.far;
          if (!exit && before < HAND_AIM.shallow) {
            const slid = this.slidOff(c, f);
            if (slid) { exit = "slide"; far = slid === "far"; }
          }
          if (exit) {
            if (c.exitSince === null) { c.exitSince = f.now; c.exitDepth = before; }
            if (far || f.now - c.exitSince >= HAND_AIM.exitMS) { c.valid = false; c.reason = exit; }
          } else { c.exitSince = null; c.exitDepth = null; }
        }
        if (!c.valid) {
          const depth = c.exitDepth ?? before;
          if (c.reason !== "tracking" && !(this.holding() && depth >= HAND_AIM.shallow)) this.unlock(f);
          else {
            // A stroke bound with the tip in its target is cancelled when the tip leaves it (`interaction.js:122-127`).
            const stroke = this.holding();
            this.resetMotion();
            this.a.carryDepth(0);
            if (stroke) this.a.say("Stroke cancelled: the tip left its target. Nothing was transferred.", true, "Lock on the target again, then lower and finish the stroke there.");
            return;
          }
        } else if (this.stroke === "turn") {
          const turn = f.normal && this.turnBase ? angle(f.normal, this.turnBase) : 0;
          this.a.carryDepth(Math.min(1, turn / TURN_RAD));
          if (turn >= TURN_RAD) { this.finishStroke(); this.a.commitCarry(); return; }
        } else {
          this.a.carryDepth(c.depth);
          const action = this.carryAction;
          if (c.depth >= IMMERSED && action) {
            // A seat acts on reaching depth; a pipette delivers there only with the bulb squeezed (`interaction.js:159`).
            if (action.action === "insert" && (!action.squeeze || (this.pressed && this.armed === "armed"))) { this.finishStroke(); this.a.commitCarry(); return; }
            if (action.action === "dip") { this.a.loadTool(); this.finishStroke(); this.a.carryDepth(0); return; }
          }
          // After bubbles, lifting the tip out with the bulb still squeezed makes the stroke valid again (`interaction.js:158`).
          if (this.armed === "bubbles" && this.pressed && c.depth < IMMERSED - 0.25) this.armed = "armed";
        }
        if (this.contact) { this.target = this.contact.target; this.a.focus(this.contact.target, true); return; }
      }
      this.carryAction = this.a.aimCarry(f.x, f.y);
      const stroke = this.needsLock(this.carryAction);
      if (stroke && f.grip && !f.open) {
        const aimAt: HandTarget = t ?? { id: "bench", kind: "item", x: f.x, y: f.y, r: 14 };
        this.aim(aimAt, f, stroke);
      } else this.candidate = undefined;
      this.target = t;
      this.a.focus(t, false);
      // An open palm held over the spot sets the item down (or places it, or holds a pipette over a
      // vessel), as the source hangs the pipette on its stand (`interaction.js:142-153`).
      if (f.open) {
        this.openSince ??= f.now;
        if (stroke) {
          if (!this.openHinted && f.now - this.openSince > 700) {
            this.openHinted = true;
            this.a.say(stroke === "turn" ? "Turn your palm to pour or tip it here, or move away to set it down." : "Lower your hand to do this here, or move away to set it down.");
          }
        } else if (f.now - this.openSince >= HAND_TIMING.openMs) {
          this.openSince = undefined;
          this.a.commitCarry();
        }
      } else { this.openSince = undefined; this.openHinted = false; }
      return;
    }

    // Nothing held: a closed grip held over an item (or a tray tile, or a hand button) takes it; the
    // aim settling on an instrument key locks it for a plunger press.
    this.target = t;
    if (t?.kind === "control") {
      const k = this.keyAim;
      if (!k || k.id !== t.id || Math.hypot(f.x - k.x, f.y - k.y) > HAND_AIM.settleMaxPx) this.keyAim = { id: t.id, since: f.now, x: f.x, y: f.y };
    } else this.keyAim = undefined;
    this.a.focus(t, Boolean(this.lockedTarget));
    if ((f.hold ?? f.grip) && !f.open && t && t.kind !== "control") {
      if (this.gripSince === undefined || this.gripTarget !== t.id) { this.gripSince = f.now; this.gripTarget = t.id; }
      if (f.now - this.gripSince > HAND_TIMING.gripMs) {
        this.gripSince = undefined;
        this.gripTarget = undefined;
        this.take(t, f);
      }
    } else { this.gripSince = undefined; this.gripTarget = undefined; }
  }

  private take(t: HandTarget, f: HandFrame): void {
    if (t.kind === "button") { this.a.pressButton(t); return; }
    if (t.kind === "tile" && t.definitionId) { this.a.pickUpTile(t.definitionId); return; }
    if (t.kind === "item" && t.instanceId) {
      if (this.a.invertTarget(t.instanceId)) {
        this.invertHold = { id: t.instanceId, base: f.normal ? [...f.normal] : [0, 0, 1], over: false };
        return;
      }
      this.a.pickUpItem(t.instanceId);
    }
  }

  private finishStroke(): void {
    this.contact = undefined;
    this.stroke = undefined;
    this.turnBase = undefined;
    this.candidate = undefined;
    this.armed = undefined;
  }

  private bubbles(): void {
    this.armed = "bubbles";
    this.a.say("Bubbles! The bulb was squeezed with the tip already in the liquid, which blows air into it.", true,
      "Keep it squeezed, lift the tip out of the liquid, lower back in, then let go slowly to draw.");
  }

  /** A plunger press (a calibrated thumb press, or a pinch; `interaction.js:163-177`). */
  press(f: HandFrame): void {
    if (this.pressed || !f.ready || !f.grip || f.open) return;
    if (this.a.dropMode()) {
      this.pressed = true;
      this.dropTimer = setTimeout(() => { this.dropTimer = undefined; this.running = true; this.a.runDrops(true); }, HAND_TIMING.dropHoldMs);
      return;
    }
    if (!this.a.carrying()) {
      const key = this.lockedTarget;
      if (key?.kind === "control") { this.pressed = true; this.a.pressControl(key); }
      return;
    }
    const action = this.carryAction;
    if (!action || (action.action !== "draw" && !action.squeeze)) return;
    this.pressed = true;
    if (action.action === "draw") {
      // Real technique: squeeze the bulb before the tip enters the liquid; squeezing inside blows air in.
      if (this.contact && this.contact.depth >= IMMERSED) this.bubbles();
      else this.armed = "armed";
      return;
    }
    // A pipette over its receiver: squeezed at depth it delivers; squeezed before, it is armed until it gets there.
    if (this.contact && this.contact.depth >= IMMERSED) { this.finishStroke(); this.a.commitCarry(); return; }
    this.armed = "armed";
  }

  /** The plunger let go (`interaction.js:197-209`). */
  release(): void {
    const wasPressed = this.pressed;
    this.pressed = false;
    if (this.a.dropMode()) {
      if (this.dropTimer) { clearTimeout(this.dropTimer); this.dropTimer = undefined; if (wasPressed) this.a.drop(); }
      else if (this.running) { this.running = false; this.a.runDrops(false); }
      return;
    }
    const action = this.carryAction;
    if (!this.a.carrying() || !action || (action.action !== "draw" && !action.squeeze)) { this.armed = undefined; return; }
    if (action.action === "draw" && this.armed === "armed" && this.contact?.valid && this.contact.depth >= IMMERSED) {
      this.finishStroke();
      this.a.commitCarry();
      return;
    }
    if (this.armed === "armed" && wasPressed) {
      this.a.say(action.action === "draw" ? "Nothing drawn." : "Nothing delivered.", true,
        action.action === "draw" ? "Squeeze the bulb above the liquid, lock on it and lower in, then let go." : "Lower the tip into the receiver before squeezing the bulb.");
    }
    this.armed = undefined;
  }
}
