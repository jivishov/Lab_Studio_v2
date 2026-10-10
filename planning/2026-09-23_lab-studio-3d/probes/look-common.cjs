// Shared set-up for the Pack 2 headless looks (G1 spot checks): headless Chromium with SwiftShader, the
// player at Low quality, and in-page helpers for tray placements, keyboard carries and the step card.
// Needs the dev server on port 5182 and NODE_PATH pointing at Lab_studio/node_modules (see README.md).
const { chromium } = require("playwright");

const HELPERS = `
  window.__sleep = (ms) => new Promise(r => setTimeout(r, ms));
  window.__dock = (name) => [...document.querySelectorAll("nav button")].find(b => b.textContent.trim() === name);
  window.__tray = async (key) => {
    if (!document.querySelector(".s3d-tile")) { window.__dock("Tray")?.click(); await window.__sleep(400); }
    const t = document.querySelector('.s3d-tile[data-instance-id="' + key + '"]') ?? document.querySelector('.s3d-tile[data-definition-id="' + key + '"]');
    if (!t) return "no tile " + key;
    t.focus(); t.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); await window.__sleep(1500);
    return "ok " + key;
  };
  window.__carry = async (rowRe, calloutRe, enter = true) => {
    for (let attempt = 0; attempt < 12; attempt++) {
      const c = await window.__carryOnce(rowRe, calloutRe, enter);
      if (c !== "") return c;
      document.querySelector(".s3d-player canvas")?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await window.__sleep(3000);
    }
    return "NO CARRY " + rowRe;
  };
  window.__carryOnce = async (rowRe, calloutRe, enter = true) => {
    window.__dock("Bench list")?.click(); await window.__sleep(400);
    if (![...document.querySelectorAll("[data-panel] button")].some(b => rowRe.test(b.textContent.trim()))) { window.__dock("Bench list")?.click(); await window.__sleep(400); }
    const buttons = [...document.querySelectorAll("[data-panel] button")];
    const at = buttons.findIndex(b => rowRe.test(b.textContent.trim()));
    if (at < 0) return "NO ROW " + rowRe;
    buttons.slice(at).find(b => b.textContent.trim() === "Move…")?.click(); await window.__sleep(400);
    [...document.querySelectorAll("button")].find(b => b.getAttribute("aria-label") === "Close Bench list")?.click(); await window.__sleep(200);
    const canvas = document.querySelector(".s3d-player canvas"); canvas.focus();
    let c = "";
    for (let k = 0; k < 20; k++) { canvas.dispatchEvent(new KeyboardEvent("keydown", { key: "]", bubbles: true })); await window.__sleep(320); c = document.querySelector(".s3d-callout")?.textContent ?? ""; if (calloutRe.test(c)) break; }
    if (enter) { canvas.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); await window.__sleep(900); }
    return c;
  };
  // A step-card button is disabled while a committed animation is drawn; wait for it (SwiftShader is slow).
  window.__card = async (label, waitMs = 20000) => {
    for (let waited = 0; ; waited += 500) {
      const b = [...document.querySelectorAll(".s3d-step button")].find(x => x.textContent.trim().startsWith(label) && !x.disabled);
      if (b) { const text = b.textContent.trim(); b.click(); await window.__sleep(300); return "clicked " + text; }
      if (waited >= waitMs) return "no button " + label;
      await window.__sleep(500);
    }
  };
  window.__input = async (value) => {
    const el = document.querySelector(".s3d-step input, .s3d-step textarea, .s3d-step select"); if (!el) return "no input";
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true })); await window.__sleep(200); return "typed " + value;
  };
  window.__step = () => document.querySelector(".s3d-topbar__centre b")?.textContent + " " + document.querySelector(".s3d-step__title")?.textContent
    + (document.querySelector(".s3d-correction") ? " CORRECTION: " + document.querySelector(".s3d-correction").textContent : "");
  window.__setup = async (values) => {
    [...document.querySelectorAll("button")].find(x => /Next: setup|Start/.test(x.textContent.trim()))?.click(); await window.__sleep(600);
    for (const [id, v] of Object.entries(values)) {
      const el = document.getElementById("s3d-slot-" + id) ?? document.getElementById("s3d-lab-" + id); if (!el) continue;
      Object.getOwnPropertyDescriptor(el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value").set.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
    await window.__sleep(200);
    const box = document.querySelector('input[type="checkbox"]'); if (box && !box.checked) box.click(); await window.__sleep(200);
    [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Save setup and start")?.click(); await window.__sleep(6000);
    return document.querySelector(".s3d-field__error")?.textContent ?? "set up";
  };`;

/**
 * Opens the technique's 3D route (or `hash`, such as a 3D experiment's `#/3d/play/<labId>`) and returns
 * { page, shot, log, run, close, errors }.
 */
const openLook = async (techniqueId, out, viewport = { width: 1280, height: 800 }, hash = `#/3d/technique/${techniqueId}`) => {
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await page.addInitScript(() => { try { localStorage.setItem("lab-studio:3d:v1:player-ui", JSON.stringify({ quality: "low", beacon: true })); } catch {} });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(`http://localhost:5182/${hash}`);
  await page.waitForTimeout(4000);
  await page.evaluate(HELPERS);
  return {
    page,
    errors,
    log: (x) => console.log(x),
    shot: (name) => page.screenshot({ timeout: 120000, path: `${out}-${name}.png` }),
    run: (fn, arg) => page.evaluate(fn, arg),
    close: async () => { console.log("errors: " + JSON.stringify(errors.slice(0, 8))); await browser.close(); },
  };
};

module.exports = { openLook };
