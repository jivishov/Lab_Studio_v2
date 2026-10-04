import { describe, expect, it, vi } from "vitest";
import { Contact, HAND_EXIT, OneEuro, PressGate, thumbDepth, type HandFrame } from "../hand/handCore";
import { HAND_AIM, HAND_TIMING, HandController, IMMERSED, INVERT, pickTarget, TURN_RAD, type CarryAction, type HandApi, type HandTarget } from "../hand/handController";

/**
 * Player3D's hand control (adoption P4, decided 2026-10-04): the DNA microarray lab's hand core and
 * controller, adapted to Lab Studio's actions. Transcribed and adapted from the source's
 * `3d-v3/tests/hand-aim.test.cjs`; written, not run.
 */

// A screen-space bench: two beakers 60 px apart, a balance with its TARE key, and a tray tile.
const TARGETS: HandTarget[] = [
  { id: "beaker-a", kind: "item", instanceId: "beaker-a", x: 300, y: 300, r: 24 },
  { id: "beaker-b", kind: "item", instanceId: "beaker-b", x: 360, y: 300, r: 24 },
  { id: "control:balance:tare", kind: "control", instanceId: "balance", controlId: "tare", x: 600, y: 420, r: 5 },
  { id: "tile:flask", kind: "tile", definitionId: "flask", x: 80, y: 600, r: 26 },
];

interface Rig { c: HandController; api: HandApi; log: string[]; set: (patch: Partial<RigState>) => void }
interface RigState { carrying: boolean; action?: CarryAction; drop: boolean; invertable: string[]; expected?: string; assist: boolean }

const rig = (initial: Partial<RigState> = {}): Rig => {
  const state: RigState = { carrying: false, drop: false, invertable: [], assist: false, ...initial };
  const log: string[] = [];
  const api: HandApi = {
    targets: () => TARGETS,
    expectedId: () => state.expected,
    assist: () => state.assist,
    carrying: () => state.carrying,
    pickUpItem: (id) => { log.push(`pick:${id}`); state.carrying = true; return true; },
    pickUpTile: (id) => { log.push(`tile:${id}`); state.carrying = true; return true; },
    aimCarry: () => state.action,
    carryDepth: vi.fn(),
    commitCarry: () => { log.push("commit"); state.carrying = false; },
    cancelCarry: () => { log.push("cancel"); state.carrying = false; },
    loadTool: () => log.push("load"),
    pressControl: (t) => log.push(`control:${t.controlId}`),
    pressButton: (t) => log.push(`button:${t.id}`),
    invertTarget: (id) => state.invertable.includes(id),
    invert: () => log.push("invert"),
    dropMode: () => state.drop,
    drop: () => log.push("drop"),
    runDrops: (on) => log.push(on ? "run" : "stop"),
    focus: vi.fn(),
    say: (text, error) => log.push(`${error ? "error" : "say"}:${text}`),
    bounds: () => ({ width: 1000, height: 700 }),
    blocked: () => false,
  };
  return { c: new HandController(api), api, log, set: (patch) => Object.assign(state, patch) };
};

// Palm height drives insertion depth; the aim moves with the palm too, as on screen.
const hand = (now: number, x: number, y: number, palmY = 0.3, extra: Partial<HandFrame> = {}): HandFrame =>
  ({ x, y, rawX: x / 1400, palmY, now, source: "hand", ready: true, grip: true, hold: true, open: false, thumbDepth: 0, normal: [0, 0, 1], ...extra });
const still = (c: HandController, now: number, x: number, y: number, ms: number, palmY = 0.3, extra: Partial<HandFrame> = {}) => {
  let t = now;
  for (; t <= now + ms; t += 33) c.feed(hand(t, x, y, palmY, extra));
  return t;
};
const turned = (rad: number) => [Math.sin(rad), 0, Math.cos(rad)];

describe("hand core (hand-core.js)", () => {
  it("presses past the band and releases below it, with dwell debounces and a dead middle", () => {
    const gate = new PressGate({ rest: 0.3, press: 0.55 });
    expect(gate.update(0.1, 0)).toBeNull();
    expect(gate.update(0.1, 80)).toBeNull(); // armed at rest
    expect(gate.update(0.45, 100)).toBeNull(); // the middle never presses
    expect(gate.update(0.6, 120)).toBeNull();
    expect(gate.update(0.6, 190)).toBe("press");
    expect(gate.update(0.2, 200)).toBeNull();
    expect(gate.update(0.2, 280)).toBe("release");
  });

  it("measures the thumb between Rest and Press, and rejects poses off that line", () => {
    const rest = Array(7).fill(0), press = Array(7).fill(1);
    expect(thumbDepth(Array(7).fill(0.5), rest, press)).toEqual({ depth: 0.5, valid: true });
    expect(thumbDepth([3, 0, 0, 0, 0, 0, 0], rest, press).valid).toBe(false);
    expect(thumbDepth(Array(7).fill(0.5)).valid).toBe(false);
  });

  it("smooths the cursor and starts afresh after a gap", () => {
    const f = new OneEuro(1, 0);
    expect(f.update(0, 0)).toBe(0);
    expect(f.update(1, 33)).toBeLessThan(1);
    expect(f.update(5, 1000)).toBe(5);
  });

  it("measures insertion from the locked palm height and reports exits", () => {
    const t = TARGETS[0];
    const c = new Contact(t, hand(0, 300, 300, 0.3));
    c.update(hand(33, 300, 300, 0.3 + HAND_EXIT.travel));
    expect(c.depth).toBe(1);
    expect(c.inserted).toBe(true);
    c.update(hand(66, 300, 300, 0.3 + HAND_EXIT.lift * 1.5));
    expect(c.exit).toBe("withdrawal");
  });
});

describe("picking (app.js:23-45)", () => {
  it("enlarges hand hit areas, prefers the current target, and assists only when asked", () => {
    expect(pickTarget(TARGETS, 300 + 30, 300)?.id).toBe("beaker-a"); // inside 24 × 1.5
    expect(pickTarget(TARGETS, 330, 300, { prefer: "beaker-b" })?.id).toBe("beaker-b");
    expect(pickTarget(TARGETS, 600, 437)?.id).toBe("control:balance:tare"); // the 22 px minimum
    expect(pickTarget(TARGETS, 500, 300)).toBeUndefined();
    expect(pickTarget(TARGETS, 500, 300, { expected: "beaker-b", assist: true })).toBeUndefined(); // beyond 76 px
    expect(pickTarget(TARGETS, 430, 300, { expected: "beaker-b", assist: true })?.id).toBe("beaker-b");
    expect(pickTarget(TARGETS, 430, 300, { expected: "beaker-b", assist: false })).toBeUndefined();
  });
});

describe("taking and setting down", () => {
  it("picks an item up with a closed grip held 350 ms over it, not a shorter one", () => {
    const { c, log } = rig();
    still(c, 0, 300, 300, HAND_TIMING.gripMs - 60);
    expect(log).toEqual([]);
    still(c, 400, 300, 300, HAND_TIMING.gripMs + 40);
    expect(log).toEqual(["pick:beaker-a"]);
  });

  it("takes a tray item from its tile the same way", () => {
    const { c, log } = rig();
    still(c, 0, 80, 600, HAND_TIMING.gripMs + 40);
    expect(log).toEqual(["tile:flask"]);
  });

  it("sets an item down with an open palm held 450 ms, where a press would set it down", () => {
    const { c, log } = rig({ carrying: true, action: { action: "commit", pour: false, tip: false } });
    still(c, 0, 500, 500, HAND_TIMING.openMs - 60, 0.3, { open: true, grip: false, hold: false });
    expect(log).toEqual([]);
    still(c, 1000, 500, 500, HAND_TIMING.openMs + 40, 0.3, { open: true, grip: false, hold: false });
    expect(log).toEqual(["commit"]);
  });

  it("does not let go over a target that needs lowering or turning; it says what to do", () => {
    const { c, log } = rig({ carrying: true, action: { action: "insert", pour: false, tip: false } });
    still(c, 0, 300, 300, 900, 0.3, { open: true, grip: false, hold: false });
    expect(log.filter((l) => l === "commit")).toEqual([]);
    expect(log.some((l) => /Lower your hand/.test(l))).toBe(true);
  });
});

describe("aim and lock (interaction.js:93-127)", () => {
  it("never locks a target the hand only sweeps across; settling on one locks it", () => {
    const { c } = rig({ carrying: true, action: { action: "insert", pour: false, tip: false } });
    let now = 0;
    const locked = new Set<string>();
    for (let x = 250; x <= 420; x += 4) { c.feed(hand(now, x, 300)); if (c.contact) locked.add(c.contact.target.id); now += 33; }
    expect([...locked]).toEqual([]);
    still(c, now, 360, 300, HAND_AIM.settleMS + 40);
    expect(c.contact?.target.id).toBe("beaker-b");
  });

  it("seats by lowering the palm: the action commits at the insertion depth", () => {
    const { c, log } = rig({ carrying: true, action: { action: "insert", pour: false, tip: false } });
    let now = still(c, 0, 300, 300, 200);
    expect(c.contact?.target.id).toBe("beaker-a");
    for (let i = 1; i <= 10 && !log.includes("commit"); i += 1) { now += 33; c.feed(hand(now, 300, 300, 0.3 + i * 0.0046)); }
    expect(log).toEqual(["commit"]);
  });

  it("pours by turning the palm past 60°; lowering alone does not pour", () => {
    const { c, log } = rig({ carrying: true, action: { action: "insert", pour: true, tip: false } });
    let now = still(c, 0, 300, 300, 200);
    expect(c.stroke).toBe("turn");
    now = still(c, now, 300, 300, 200, 0.33);
    expect(log).toEqual([]);
    for (let deg = 10; deg <= 70 && !log.includes("commit"); deg += 10) { now += 33; c.feed(hand(now, 300, 300, 0.3, { normal: turned((deg * Math.PI) / 180) })); }
    expect(log).toEqual(["commit"]);
    expect(TURN_RAD).toBeCloseTo(Math.PI / 3, 9);
  });

  it("lifting releases a lock without acting, and the same target waits before re-locking", () => {
    const { c, log } = rig({ carrying: true, action: { action: "insert", pour: false, tip: false } });
    let now = still(c, 0, 300, 300, 200);
    expect(c.contact).toBeDefined();
    let released: number | undefined;
    for (let i = 0; i < 20 && released === undefined; i += 1) { c.feed(hand(now, 300, 300, 0.25)); if (!c.contact) released = now; now += 33; }
    expect(released).toBeDefined();
    expect(log).toEqual([]);
    for (; now < (released ?? 0) + HAND_AIM.relockMS - 40; now += 33) c.feed(hand(now, 300, 300, 0.25));
    expect(c.contact).toBeUndefined();
  });

  it("extended-arm sway and tremor keep the lock", () => {
    const { c } = rig({ carrying: true, action: { action: "insert", pour: false, tip: false } });
    let now = still(c, 0, 300, 300, 200);
    const start = now, lost: number[] = [];
    for (; now < start + 3000; now += 33) {
      const s = (now - start) / 1000;
      const x = 300 + 10 * Math.sin(2 * Math.PI * 0.8 * s) + 2 * Math.sin(2 * Math.PI * 9 * s), palmY = 0.3 + 0.008 * Math.sin(2 * Math.PI * 0.5 * s);
      c.feed(hand(now, x, 300, palmY));
      if (c.contact?.target.id !== "beaker-a") lost.push(Math.round(now - start));
    }
    expect(lost).toEqual([]);
  });
});

describe("drawing up (real bulb technique)", () => {
  const drawRig = () => rig({ carrying: true, action: { action: "draw", pour: false, tip: false } });

  it("squeeze above the liquid, lower in, let go: draws", () => {
    const { c, log } = drawRig();
    let now = still(c, 0, 300, 300, 200);
    c.press(hand(now, 300, 300));
    expect(c.armed).toBe("armed");
    now = still(c, now + 33, 300, 300, 150, 0.3 + IMMERSED * HAND_EXIT.travel + 0.002);
    c.release();
    expect(log).toEqual(["commit"]);
  });

  it("squeezing with the tip already in the liquid is bubbles; nothing is drawn", () => {
    const { c, log } = drawRig();
    let now = still(c, 0, 300, 300, 200);
    now = still(c, now, 300, 300, 150, 0.346);
    c.press(hand(now, 300, 300, 0.346));
    expect(c.armed).toBe("bubbles");
    expect(log.some((l) => l.startsWith("error:Bubbles"))).toBe(true);
    c.release();
    expect(log).not.toContain("commit");
  });

  it("after bubbles, lifting out with the bulb still squeezed, lowering back in and letting go draws", () => {
    const { c, log } = drawRig();
    let now = still(c, 0, 300, 300, 200);
    now = still(c, now, 300, 300, 150, 0.346);
    c.press(hand(now, 300, 300, 0.346));
    c.feed(hand(now += 33, 300, 300, 0.315));
    expect(c.armed).toBe("armed");
    c.feed(hand(now += 33, 300, 300, 0.346));
    c.release();
    expect(log).toContain("commit");
  });
});

describe("drops, inverting and keys", () => {
  it("each plunger press is one drop; a press held 300 ms lets the drops run", () => {
    vi.useFakeTimers();
    const { c, log } = rig({ drop: true });
    c.press(hand(0, 300, 300));
    c.release();
    expect(log).toEqual(["drop"]);
    c.press(hand(100, 300, 300));
    vi.advanceTimersByTime(HAND_TIMING.dropHoldMs + 10);
    c.release();
    expect(log).toEqual(["drop", "run", "stop"]);
    vi.useRealTimers();
  });

  it("grips a stoppered flask and counts one inversion for each turn over and back", () => {
    const { c, log } = rig({ invertable: ["beaker-a"] });
    let now = still(c, 0, 300, 300, HAND_TIMING.gripMs + 40);
    expect(c.invertHold?.id).toBe("beaker-a");
    for (const rad of [1, 2.2, 2.5, 0.8, 0.2, 2.1, 0.5]) c.feed(hand(now += 33, 300, 300, 0.3, { normal: turned(rad) }));
    expect(log.filter((l) => l === "invert")).toHaveLength(2);
    expect(INVERT).toEqual({ over: 1.92, back: 1.05 });
    c.feed(hand(now += 33, 300, 300, 0.3, { open: true, grip: false, hold: false }));
    expect(c.invertHold).toBeUndefined();
  });

  it("presses TARE when the plunger is pressed with the hand on the key", () => {
    const { c, log } = rig();
    c.feed(hand(0, 600, 420, 0.3, { grip: false, hold: false }));
    c.press(hand(10, 600, 420));
    expect(log).toEqual(["control:tare"]);
  });
});
