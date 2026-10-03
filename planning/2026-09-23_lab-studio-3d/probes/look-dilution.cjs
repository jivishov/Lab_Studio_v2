// One visual spot check (G1) of the atomized Dilute a Stock Solution: headless Chromium, SwiftShader.
const { chromium } = require("playwright");
const out = process.argv[2];
(async () => {
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => { try { localStorage.setItem("lab-studio:3d:v1:player-ui", JSON.stringify({ quality: "low", beacon: true })); } catch {} });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("http://localhost:5182/#/3d/technique/dilution");
  await page.waitForTimeout(4000);
  const helpers = `
    window.__sleep = (ms) => new Promise(r => setTimeout(r, ms));
    window.__dock = (name) => [...document.querySelectorAll("nav button")].find(b => b.textContent.trim() === name);
    window.__tray = async (defId) => {
      if (!document.querySelector(".s3d-tile")) { window.__dock("Tray")?.click(); await window.__sleep(400); }
      const t = document.querySelector('.s3d-tile[data-definition-id="' + defId + '"]');
      if (!t) return "no tile " + defId;
      t.focus(); t.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); await window.__sleep(1200);
      return "ok";
    };
    window.__carry = async (rowRe, calloutRe, enter = true) => {
      window.__dock("Bench list")?.click(); await window.__sleep(400);
      if (![...document.querySelectorAll("[data-panel] button")].some(b => rowRe.test(b.textContent.trim()))) { window.__dock("Bench list")?.click(); await window.__sleep(400); }
      const buttons = [...document.querySelectorAll("[data-panel] button")];
      const at = buttons.findIndex(b => rowRe.test(b.textContent.trim()));
      if (at < 0) return "NO ROW";
      buttons.slice(at).find(b => b.textContent.trim() === "Move…")?.click(); await window.__sleep(400);
      [...document.querySelectorAll("button")].find(b => b.getAttribute("aria-label") === "Close Bench list")?.click(); await window.__sleep(200);
      const canvas = document.querySelector(".s3d-player canvas"); canvas.focus();
      let c = "";
      for (let k = 0; k < 16; k++) { canvas.dispatchEvent(new KeyboardEvent("keydown", { key: "]", bubbles: true })); await window.__sleep(320); c = document.querySelector(".s3d-callout")?.textContent ?? ""; if (calloutRe.test(c)) break; }
      if (enter) { canvas.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); await window.__sleep(3200); }
      return c;
    };
    window.__step = () => document.querySelector(".s3d-topbar__centre b")?.textContent + " " + document.querySelector(".s3d-step__title")?.textContent;`;
  await page.evaluate(helpers);
  const log = (x) => console.log(x);
  await page.evaluate(async () => {
    [...document.querySelectorAll("button")].find(x => x.textContent.trim() === "Next: setup").click(); await window.__sleep(600);
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    for (const [k, v] of Object.entries({ aliquotVolumeMl: "5", stockConcentrationM: "0.2" })) { const el = document.getElementById("s3d-slot-" + k); setter.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); }
    await window.__sleep(200);
    document.querySelector('input[type="checkbox"]').click(); await window.__sleep(200);
    [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Save setup and start").click(); await window.__sleep(6000);
  });
  log(await page.evaluate(async () => {
    const r = [];
    r.push(await window.__tray("volumetric-flask"));
    r.push(await window.__tray("sample-bottle")); r.push(await window.__tray("beaker-150ml"));
    r.push(await window.__carry(/^Blue dye stock/, /^Release to pour/));
    await window.__sleep(6000);
    r.push(await window.__tray("graduated-pipette-10ml")); r.push(await window.__tray("pipette-pump"));
    return r.join(" | ") + " || " + window.__step();
  }));
  await page.screenshot({ timeout: 120000, path: out + "-1-pipette-and-pump-at-rest.png" });
  log(await page.evaluate(async () => {
    const r = [];
    r.push(await window.__carry(/^Pipette pump/, /^Release to fit/));
    return r.join(" | ") + " || " + window.__step();
  }));
  await page.screenshot({ timeout: 120000, path: out + "-2-pump-fitted.png" });
  log(await page.evaluate(async () => {
    const r = [];
    r.push(await window.__carry(/^10 mL graduated pipette/, /^Release to draw/));
    r.push(await window.__carry(/^10 mL graduated pipette/, /^Release to hold/));
    await window.__sleep(1500);
    return r.join(" | ") + " || " + window.__step() + " panel " + !!document.querySelector(".s3d-drop");
  }));
  await page.screenshot({ timeout: 120000, path: out + "-3-held-eye-level.png" });
  log(await page.evaluate(async () => {
    const btn = (t) => [...document.querySelectorAll(".s3d-drop button")].find(b => b.textContent.trim() === t);
    for (let i = 0; i < 99; i++) { btn("One drop").click(); await window.__sleep(12); }
    await window.__sleep(800);
    return window.__step();
  }));
  await page.screenshot({ timeout: 120000, path: out + "-4-near-the-line.png" });
  log(await page.evaluate(async () => {
    const btn = (t) => [...document.querySelectorAll(".s3d-drop button")].find(b => b.textContent.trim() === t);
    btn("One drop").click(); await window.__sleep(300);
    btn("At the line").click(); await window.__sleep(2500);
    const r = [window.__step()];
    r.push(await window.__tray("wash-bottle"));
    r.push(await window.__carry(/^Wash bottle/, /^Release to fill/));
    await window.__sleep(9000);
    r.push(await window.__tray("beaker-150ml")); r.push(await window.__tray("beral-pipette"));
    r.push(await window.__carry(/^Water pipette/, /^Release to draw/));
    r.push(await window.__carry(/^Water pipette/, /^Release to hold/));
    await window.__sleep(1500);
    return r.join(" | ") + " || " + window.__step();
  }));
  await page.screenshot({ timeout: 120000, path: out + "-5-flask-mark-eye-level.png" });
  log(await page.evaluate(async () => {
    const btn = (t) => [...document.querySelectorAll(".s3d-drop button")].find(b => b.textContent.trim() === t);
    for (let i = 0; i < 20; i++) { btn("One drop").click(); await window.__sleep(40); }
    await window.__sleep(500);
    btn("At the line").click(); await window.__sleep(2500);
    const r = [window.__step()];
    r.push(await window.__tray("rubber-stopper-set"));
    r.push(await window.__carry(/^Flask stopper/, /^Release to stopper/));
    return r.join(" | ") + " || " + window.__step();
  }));
  await page.evaluate(() => document.querySelector('[data-gesture-action="record-evidence"]').click());
  for (let i = 0; i < 3; i++) await page.screenshot({ timeout: 120000, path: out + "-6-inverting-" + i + ".png" });
  console.log("errors: " + JSON.stringify(errors.slice(0, 8)));
  await browser.close();
})();
