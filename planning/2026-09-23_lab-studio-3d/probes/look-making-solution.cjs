// One visual spot check (G1) of the atomized Make a Solution (decided 2026-10-04): headless Chromium,
// SwiftShader. Every step by keyboard carries and the step card; screenshots at the tip, both rinses,
// the half-full flask, the swirl, the mark, the inversion and the results.
const { chromium } = require("playwright");
const out = process.argv[2];
(async () => {
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => { try { localStorage.setItem("lab-studio:3d:v1:player-ui", JSON.stringify({ quality: "low", beacon: true })); } catch {} });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("http://localhost:5182/#/3d/technique/making-solution");
  await page.waitForTimeout(4000);
  const helpers = `
    window.__sleep = (ms) => new Promise(r => setTimeout(r, ms));
    window.__dock = (name) => [...document.querySelectorAll("nav button")].find(b => b.textContent.trim() === name);
    window.__tray = async (defId) => {
      if (!document.querySelector(".s3d-tile")) { window.__dock("Tray")?.click(); await window.__sleep(400); }
      const t = document.querySelector('.s3d-tile[data-definition-id="' + defId + '"]');
      if (!t) return "no tile " + defId;
      t.focus(); t.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); await window.__sleep(1500);
      return "ok " + defId;
    };
    // A carry cannot start while a committed pour or swirl is still being drawn (SwiftShader frames are
    // slow), so a carry that shows no callout is tried again a few seconds later.
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
      for (let k = 0; k < 16; k++) { canvas.dispatchEvent(new KeyboardEvent("keydown", { key: "]", bubbles: true })); await window.__sleep(320); c = document.querySelector(".s3d-callout")?.textContent ?? ""; if (calloutRe.test(c)) break; }
      if (enter) { canvas.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); await window.__sleep(900); }
      return c;
    };
    window.__card = async (label) => { const b = [...document.querySelectorAll(".s3d-step button")].find(x => x.textContent.trim().startsWith(label)); if (!b) return "no button " + label; b.click(); await window.__sleep(300); return "clicked " + b.textContent.trim(); };
    window.__step = () => document.querySelector(".s3d-topbar__centre b")?.textContent + " " + document.querySelector(".s3d-step__title")?.textContent
      + (document.querySelector(".s3d-correction") ? " CORRECTION: " + document.querySelector(".s3d-correction").textContent : "");`;
  await page.evaluate(helpers);
  const log = (x) => console.log(x);
  const shot = (name) => page.screenshot({ timeout: 120000, path: out + "-" + name + ".png" });
  await page.evaluate(async () => {
    [...document.querySelectorAll("button")].find(x => x.textContent.trim() === "Next: setup").click(); await window.__sleep(600);
    const set = (el, v) => {
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    set(document.getElementById("s3d-slot-soluteMassG"), "2.5");
    set(document.getElementById("s3d-slot-solutionObservation"), "Clear and colourless; no solid left");
    await window.__sleep(200);
    document.querySelector('input[type="checkbox"]')?.click(); await window.__sleep(200);
    [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Save setup and start").click(); await window.__sleep(6000);
  });
  log(await page.evaluate(async () => {
    const r = [];
    r.push(await window.__tray("volumetric-flask"));
    r.push(await window.__tray("funnel"));
    r.push(await window.__carry(/^Filling funnel/, /^Release to seat/));
    await window.__sleep(1500);
    r.push(await window.__tray("weigh-boat"));
    return r.join(" | ") + " || " + window.__step();
  }));
  await shot("1-funnel-seated-boat-on-bench");
  log(await page.evaluate(async () => {
    const r = [await window.__carry(/^Weighing boat/, /^Release to tip/)];
    await window.__sleep(600);
    return r.join(" | ") + " || " + window.__step();
  }));
  // The tip and the rinse are drawn slowly under SwiftShader: a frame every 1.5 s.
  for (let i = 0; i < 5; i++) { await shot("2-tipping-" + i); await page.waitForTimeout(1500); }
  await page.waitForTimeout(2000);
  await shot("3-solid-in-flask");
  log(await page.evaluate(async () => {
    const r = [await window.__tray("wash-bottle")];
    r.push(await window.__carry(/^Wash bottle/, /^Release to rinse the weighing boat/));
    await window.__sleep(900);
    return r.join(" | ") + " || " + window.__step();
  }));
  for (let i = 0; i < 6; i++) { await shot("4-rinsing-the-boat-" + i); await page.waitForTimeout(1500); }
  await page.waitForTimeout(2000);
  log(await page.evaluate(async () => {
    const r = [await window.__carry(/^Wash bottle/, /^Release to rinse the funnel/)];
    await window.__sleep(9000);
    r.push(await window.__carry(/^Filling funnel/, /^Release to (place|remove)/i));
    await window.__sleep(2000);
    r.push(await window.__carry(/^Wash bottle/, /^Release to fill the flask about half/));
    await window.__sleep(10000);
    return r.join(" | ") + " || " + window.__step();
  }));
  await shot("5-half-full-solid-under-water");
  log(await page.evaluate(async () => window.__card("Swirl")));
  await page.waitForTimeout(700);
  await shot("6-swirling");
  await page.waitForTimeout(6000);
  await shot("7-dissolved");
  log(await page.evaluate(async () => {
    const r = [window.__step()];
    r.push(await window.__carry(/^Wash bottle/, /^Release to fill with water/));
    await window.__sleep(10000);
    r.push(await window.__tray("beaker-150ml")); r.push(await window.__tray("beral-pipette"));
    r.push(await window.__carry(/^Water pipette/, /^Release to draw/));
    await window.__sleep(3000);
    r.push(await window.__carry(/^Water pipette/, /^Release to hold/));
    await window.__sleep(1500);
    const btn = (t) => [...document.querySelectorAll(".s3d-drop button")].find(b => b.textContent.trim() === t);
    for (let i = 0; i < 20; i++) { btn("One drop")?.click(); await window.__sleep(40); }
    await window.__sleep(800);
    return r.join(" | ") + " || " + window.__step();
  }));
  await shot("8-at-the-mark");
  log(await page.evaluate(async () => {
    const btn = (t) => [...document.querySelectorAll(".s3d-drop button")].find(b => b.textContent.trim() === t);
    btn("At the line")?.click(); await window.__sleep(2500);
    const r = [window.__step()];
    r.push(await window.__tray("rubber-stopper-set"));
    r.push(await window.__carry(/^Flask stopper/, /^Release to stopper/));
    await window.__sleep(1500);
    r.push(await window.__card("Invert"));
    return r.join(" | ") + " || " + window.__step();
  }));
  await shot("9-inverting");
  log(await page.evaluate(async () => {
    for (let i = 0; i < 9; i++) { await window.__card("Invert"); await window.__sleep(1800); }
    await window.__sleep(1500);
    const r = [window.__step(), await window.__card("Record")];
    await window.__sleep(2500);
    return r.join(" | ") + " || results " + Boolean(document.querySelector(".s3d-sheet, .s3d-results"));
  }));
  await shot("10-results");
  console.log("errors: " + JSON.stringify(errors.slice(0, 8)));
  await browser.close();
})();
