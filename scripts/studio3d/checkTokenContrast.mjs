/**
 * Computes the WCAG 2.2 contrast of every Lab Studio 3D token pair that carries text or a
 * meaningful UI edge (UI_UX_HANDOFF.md §3.1, §3.2, §8, and static design review item 1).
 *
 *   node scripts/studio3d/checkTokenContrast.mjs [--markdown <out.md>]
 *
 * Exits 1 if any pair falls below its threshold. Translucent tokens are composited over the
 * surface they actually sit on; for the 3D stage that is unknown, so they are checked over both a
 * light and a dark stage backdrop and the worse result counts.
 *
 * Two themes (you, 2026-10-12): the Light theme reads the `:root` block, the HUD theme the same tokens
 * as remapped in the `.s3d[data-theme="hud"]` block. Every theme pair is checked in both; over the
 * stage the HUD's glass is also checked over the window's white, and its tints over its own panels.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const css = readFileSync(join(root, "src/studio3d/styles/tokens.css"), "utf8");

const block = (selector) => {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`No ${selector} block in tokens.css`);
  return css.slice(start, css.indexOf("\n}", start));
};
const read = (text) => new Map([...text.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const LIGHT = read(block(":root"));
const HUD = new Map([...LIGHT, ...read(block('.s3d[data-theme="hud"]'))]);
let tokens = LIGHT;
// A token may name another (`var(--hud-ink)`); `transparent` lets the surface under it show.
const resolve = (name) => {
  const value = tokens.get(name);
  if (value === undefined) throw new Error(`Unknown token --${name}`);
  const alias = value.match(/^var\(--([a-z0-9-]+)\)$/);
  return alias ? resolve(alias[1]) : value === "transparent" ? "#00000000" : value;
};

const parseHex = (hex) => {
  const value = hex.replace("#", "");
  const full = value.length <= 4 ? [...value].map((c) => c + c).join("") : value;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  const a = full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
};
const colour = (ref) => parseHex(ref.startsWith("#") ? ref : resolve(ref));
const over = (top, bottom) => ({
  r: top.r * top.a + bottom.r * (1 - top.a),
  g: top.g * top.a + bottom.g * (1 - top.a),
  b: top.b * top.a + bottom.b * (1 - top.a),
  a: 1,
});
const luminance = ({ r, g, b }) => {
  const channel = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};
const ratio = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// Stage backdrops the translucent overlays can sit over: a pale bench and the dark room edge.
const STAGE_LIGHT = parseHex("#e6e4dc");
const STAGE_DARK = parseHex("#2b302c");
const WINDOW_WHITE = parseHex("#ffffff");

/** [label, foreground, background(s), threshold, kind, handoff claim]; a background "a+b@ctx" is a over b over ctx. */
const themePairs = [
  ["Ink on panel", "ink", ["panel"], 4.5, "text", "12.2:1"],
  ["Ink-2 on panel", "ink-2", ["panel"], 4.5, "text", "7.6:1"],
  ["Muted on panel", "muted", ["panel"], 4.5, "text", "5.5:1"],
  ["Muted on page background", "muted", ["bg"], 4.5, "text"],
  ["Muted on flow canvas", "muted", ["canvas"], 4.5, "text"],
  ["Ink on floating panel (over stage)", "ink", ["float@stage"], 4.5, "text"],
  ["Muted on floating panel (over stage)", "muted", ["float@stage"], 4.5, "text"],
  ["Ink on glass badge (over stage)", "ink", ["glass@stage"], 4.5, "text"],
  ["On-brand ink on brand (primary button; white in Light)", "on-brand", ["brand"], 4.5, "text", "7.9:1"],
  ["On-brand ink on brand hover", "on-brand", ["brand-hover"], 4.5, "text"],
  ["Brand on brand tint (selected text)", "brand", ["brand-tint"], 4.5, "text"],
  ["Brand outline on panel (selection)", "brand", ["panel"], 3, "ui"],
  ["Ink on next-action band", "ink", ["guide-band"], 4.5, "text"],
  ["Guide rule on next-action band", "guide", ["guide-band"], 3, "ui"],
  ["Guide text on panel (Show me)", "guide", ["panel"], 4.5, "text"],
  ["Guide strong on guide tint", "guide-strong", ["guide-tint"], 4.5, "text"],
  ["OK on panel", "ok", ["panel"], 4.5, "text"],
  ["OK on OK tint", "ok", ["ok-tint"], 4.5, "text"],
  ["Error on panel", "error", ["panel"], 4.5, "text", "5.4:1"],
  ["Error on error tint (correction block)", "error", ["error-tint"], 4.5, "text"],
  ["Ink on error tint", "ink", ["error-tint"], 4.5, "text"],
  ["Warn on panel", "warn", ["panel"], 4.5, "text", "5.7:1"],
  ["Warn on warn tint", "warn", ["warn-tint"], 4.5, "text"],
  ["Focus ring on panel", "focus", ["panel"], 3, "focus", "3.8:1"],
  ["Focus ring on page background", "focus", ["bg"], 3, "focus"],
  ["Focus ring on flow canvas", "focus", ["canvas"], 3, "focus"],
  ["Focus ring on dark toolbar", "focus", ["toolbar"], 3, "focus", "3.1–3.6:1"],
  ["Toolbar ink on dark toolbar", "toolbar-ink", ["toolbar"], 4.5, "text"],
  ["Label ink on scene label (over stage)", "label-ink", ["label-bg@stage"], 4.5, "text"],
  ["Teacher setting chip", "prov-teacher-ink", ["prov-teacher-bg"], 4.5, "text"],
  ["Your entry chip", "prov-entry-ink", ["prov-entry-bg"], 4.5, "text"],
  ["From the bench chip", "prov-bench-ink", ["prov-bench-bg"], 4.5, "text"],
  ["Simulated chip", "prov-sim-ink", ["prov-sim-bg"], 4.5, "text"],
  ["Calculated chip", "prov-calc-ink", ["prov-calc-bg"], 4.5, "text"],
  // Hand control (§5.15, M7): the set-up marks and the gesture cues on Player3D's own targets.
  ["On-accent ink on OK (set-up step done)", "on-accent", ["ok"], 4.5, "text"],
  ["On-accent ink on guide (set-up step now)", "on-accent", ["guide"], 4.5, "text"],
  ["On-accent ink on error (set-up step needs attention)", "on-accent", ["error"], 4.5, "text"],
  ["Guide cue on panel (gesture hover and armed)", "guide", ["panel"], 3, "ui"],
  ["Guide cue on floating panel (over stage)", "guide", ["float@stage"], 3, "ui"],
  // The two themes (you, 2026-10-12): the surfaces every 3D panel, menu and dialog uses.
  ["Ink on menu, dialog and sheet", "ink", ["panel-solid"], 4.5, "text"],
  ["Muted on menu, dialog and sheet", "muted", ["panel-solid"], 4.5, "text"],
  ["Ink on a row under the pointer", "ink", ["bg+panel-solid", "bg+float@stage"], 4.5, "text"],
  ["Ink on a selected row (Bench list)", "ink", ["brand-tint+float@stage"], 4.5, "text"],
  ["Brand text (links, chips) on panel", "brand", ["panel", "panel-solid"], 4.5, "text"],
  ["Brand on brand tint on a panel, menu or card (switcher, set-up numbers, Studio chips)", "brand", ["brand-tint+panel", "brand-tint+panel-solid", "brand-tint+float"], 4.5, "text"],
  ["Ink-2 on floating panel (over stage)", "ink-2", ["float@stage"], 4.5, "text"],
  ["Guide strong on guide tint over a floating panel", "guide-strong", ["guide-tint+float@stage"], 4.5, "text"],
  ["Ink on the hand guide band (over stage)", "ink", ["guide-band+float@stage"], 4.5, "text"],
  ["OK on OK tint over a floating panel (hand badge)", "ok", ["ok-tint+float@stage"], 4.5, "text"],
  ["Warn on warn tint over a floating panel", "warn", ["warn-tint+float@stage"], 4.5, "text"],
  ["Error on error tint over a floating panel", "error", ["error-tint+float@stage"], 4.5, "text"],
  ["Assessment ink on its tint", "assess-ink", ["assess-tint"], 4.5, "text"],
  ["Ink on the top bar (over stage)", "ink", ["bar-bg@stage"], 4.5, "text"],
  ["Ink-2 on the hint (over stage)", "ink-2", ["hint-bg@stage"], 4.5, "text"],
  ["Focus ring on floating panel (over stage)", "focus", ["float@stage"], 3, "focus"],
  ["Focus ring on menu, dialog and sheet", "focus", ["panel-solid"], 3, "focus"],
];

/** The HUD's own tokens (the step card, the dock and the views menu); the same values in both themes. */
const hudPairs = [  // The step card's HUD (you, 2026-10-12): translucent glass over any part of the scene, both stops of its gradient.
  ["HUD ink on step card glass", "hud-ink", ["hud-glass@scene", "hud-glass-top@scene"], 4.5, "text"],
  ["HUD ink-2 on step card glass (title, About text)", "hud-ink-2", ["hud-glass@scene", "hud-glass-top@scene"], 4.5, "text"],
  ["HUD muted on step card glass (field labels)", "hud-muted", ["hud-glass@scene", "hud-glass-top@scene"], 4.5, "text"],
  ["HUD cyan on step card glass (eyebrow, units, Show me)", "hud-cyan", ["hud-glass@scene", "hud-glass-top@scene"], 4.5, "text"],
  ["HUD ink on the instruction band", "hud-ink", ["hud-band+hud-glass@scene", "hud-band+hud-glass-top@scene"], 4.5, "text"],
  ["HUD ink in a field", "hud-ink", ["hud-field+hud-glass@scene"], 4.5, "text"],
  ["HUD muted in a field (no choice yet)", "hud-muted", ["hud-field+hud-glass@scene"], 4.5, "text"],
  ["HUD field edge on glass", "hud-line-strong", ["hud-glass@scene", "hud-glass-top@scene"], 3, "ui"],
  ["HUD edge (rule, progress, ring) on glass", "hud-edge", ["hud-glass@scene", "hud-glass-top@scene"], 3, "ui"],
  ["HUD ink on the step ring's core", "hud-ink", ["hud-core"], 4.5, "text"],
  ["HUD primary ink on primary button", "hud-primary-ink", ["hud-primary", "hud-primary-hover"], 4.5, "text"],
  ["HUD primary button on glass", "hud-primary", ["hud-glass@scene", "hud-glass-top@scene"], 3, "ui"],
  ["HUD error on glass", "hud-error", ["hud-glass@scene"], 4.5, "text"],
  ["HUD error on the correction band", "hud-error", ["hud-error-band+hud-glass@scene"], 4.5, "text"],
  ["HUD ink on the correction band", "hud-ink", ["hud-error-band+hud-glass@scene"], 4.5, "text"],
  ["HUD focus ring on glass", "hud-focus", ["hud-glass@scene", "hud-glass-top@scene"], 3, "focus"],
  ["HUD assessment ring on glass", "hud-assess", ["hud-glass@scene"], 3, "ui"],
  ["HUD Teacher setting chip", "hud-prov-teacher", ["hud-glass@scene"], 4.5, "text"],
  ["HUD Your entry chip", "hud-prov-entry", ["hud-glass@scene"], 4.5, "text"],
  ["HUD From the bench chip", "hud-prov-bench", ["hud-glass@scene"], 4.5, "text"],
  ["HUD Simulated chip", "hud-prov-sim", ["hud-glass@scene"], 4.5, "text"],
  ["HUD Calculated chip", "hud-prov-calc", ["hud-glass@scene"], 4.5, "text"],
  // The dock and the hint over it (you, 2026-10-12): the same glass; an On button is lit from inside.
  ["HUD ink-2 on the dock (button labels, hint)", "hud-ink-2", ["hud-glass@scene", "hud-glass-top@scene"], 4.5, "text"],
  ["HUD cyan icons on the dock", "hud-cyan", ["hud-glass@scene", "hud-glass-top@scene"], 3, "ui"],
  ["HUD ink on a dock button under the pointer", "hud-ink", ["hud-hover+hud-glass@scene"], 4.5, "text"],
  ["HUD ink on an On dock button", "hud-ink", ["hud-band+hud-glass@scene", "hud-hover+hud-glass@scene"], 4.5, "text"],
  ["HUD cyan icon on an On dock button", "hud-cyan", ["hud-band+hud-glass@scene"], 3, "ui"],
  ["HUD On button's underline on glass", "hud-edge", ["hud-band+hud-glass@scene"], 3, "ui"],
  ["HUD ink in the camera views menu", "hud-ink", ["hud-core", "hud-hover+hud-core@scene"], 4.5, "text"],
  ["HUD focus ring on the camera views menu", "hud-focus", ["hud-core"], 3, "focus"],
  ["HUD ink on the view in use (Auto on)", "hud-ink", ["hud-band+hud-core@scene"], 4.5, "text"],
  ["HUD menu item brackets", "hud-edge", ["hud-core", "hud-hover+hud-core@scene", "hud-band+hud-core@scene"], 3, "ui"],
  // The HUD theme's menus, dialogs and panels (you, 2026-10-12): both stops of their near-solid fill.
  ["HUD cyan captions on menus and dialogs", "hud-cyan", ["hud-core", "hud-core-top"], 4.5, "text"],
  ["HUD brackets on menus and dialogs", "hud-edge", ["hud-core-top"], 3, "ui"],
  ["HUD ink on menus and dialogs", "hud-ink", ["hud-core-top"], 4.5, "text"],
];

// `hud`: the HUD theme, whose glass is checked over the window's white too and whose tints sit on its own panels.
const surfaces = (name, hud) => {
  // The toolbar is dark in both themes; its gradient's stops are read from --toolbar.
  if (name === "toolbar") return resolve("toolbar").match(/#[0-9a-f]{6,8}/gi).map((stop) => ({ label: stop, colour: over(parseHex(stop), STAGE_DARK) }));
  const [token, given] = name.split("@");
  const context = hud && given === "stage" ? "scene" : given;
  // "a+b@scene": a over b over each part of the scene, the window's white included (the HUD's glass).
  const backdrops = context === "scene" ? [["light stage", STAGE_LIGHT], ["dark stage", STAGE_DARK], ["window white", WINDOW_WHITE]]
    : context === "stage" ? [["light stage", STAGE_LIGHT], ["dark stage", STAGE_DARK]]
      : [[undefined, hud ? colour("panel-solid") : WINDOW_WHITE]];
  const layers = token.split("+").reverse();
  return backdrops.map(([where, backdrop]) => ({
    label: where ? `${token} over ${where}` : token,
    colour: layers.reduce((under, layer) => over(colour(layer), under), backdrop),
  }));
};

const check = (pairs, theme, hud) => {
  tokens = theme;
  return pairs.map(([label, fg, bgs, threshold, kind, claim]) => {
    const results = bgs.flatMap((bg) => surfaces(bg, hud)).map((surface) => {
      const foreground = over(colour(fg), surface.colour);
      return { surface: surface.label, value: ratio(foreground, surface.colour) };
    });
    const worst = results.reduce((a, b) => (b.value < a.value ? b : a));
    const range = results.length > 1
      ? `${Math.min(...results.map((r) => r.value)).toFixed(2)}–${Math.max(...results.map((r) => r.value)).toFixed(2)}`
      : worst.value.toFixed(2);
    return { label, fg, kind, threshold, range, worst: worst.value, claim: claim ?? "", pass: worst.value >= threshold };
  });
};
const lightRows = check(themePairs, LIGHT, false);
const hudRows = [...check(themePairs, HUD, true), ...check(hudPairs, HUD, true)];
const rows = [...lightRows, ...hudRows];
const table = (part) => [
  "| Pair | Kind | Computed | Needs | Handoff claim | Result |",
  "|---|---|---|---|---|---|",
  ...part.map((row) => `| ${row.label} | ${row.kind} | ${row.range}:1 | ${row.threshold}:1 | ${row.claim} | ${row.pass ? "pass" : "**FAIL**"} |`),
];

const lines = [
  "# Lab Studio 3D token contrast (computed)",
  "",
  "Generated by `scripts/studio3d/checkTokenContrast.mjs` from `src/studio3d/styles/tokens.css`.",
  "Thresholds: text 4.5:1; UI parts and focus indicators 3:1 (WCAG 2.2 AA). Translucent tokens are",
  `composited over a light (${"#e6e4dc"}) and a dark (${"#2b302c"}) stage, and the HUD's glass over the window's`,
  "white as well; the lowest ratio counts. Two themes: the Light theme's tokens are the `:root` block; the HUD",
  "theme's are the same tokens as remapped under `.s3d[data-theme=\"hud\"]`, with its tints over its own panels.",
  "",
  `## Light theme (${lightRows.filter((row) => row.pass).length} of ${lightRows.length} pass)`,
  "",
  ...table(lightRows),
  "",
  `## HUD theme (${hudRows.filter((row) => row.pass).length} of ${hudRows.length} pass)`,
  "",
  ...table(hudRows),
  "",
  `${rows.filter((row) => row.pass).length} of ${rows.length} pairs pass.`,
];
const markdown = `${lines.join("\n")}\n`;

const outIndex = process.argv.indexOf("--markdown");
if (outIndex >= 0) writeFileSync(process.argv[outIndex + 1], markdown);
else process.stdout.write(markdown);
if (rows.some((row) => !row.pass)) process.exitCode = 1;
