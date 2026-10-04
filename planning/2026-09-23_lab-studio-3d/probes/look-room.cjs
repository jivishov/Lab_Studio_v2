// One visual spot check (G1) of the bench under the microarray lab's room and look (P1 of the
// adoption, 2026-10-04): headless Chromium with SwiftShader. Sets up Dilute a Stock Solution, puts
// four items on the bench from the tray and saves one screenshot per graphics tier given.
//   NODE_PATH=…/Lab_studio/node_modules node look-room.cjs <output-prefix> [quality …]
const { chromium } = require("playwright");
const out = process.argv[2];
const tiers = process.argv.slice(3).length ? process.argv.slice(3) : ["low"];
(async () => {
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  for (const quality of tiers) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    await page.addInitScript((q) => { try { localStorage.setItem("lab-studio:3d:v1:player-ui", JSON.stringify({ quality: q, beacon: true })); } catch {} }, quality);
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    await page.goto("http://localhost:5182/#/3d/technique/dilution");
    await page.waitForTimeout(4000);
    const result = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Next: setup").click(); await sleep(600);
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      for (const [k, v] of Object.entries({ aliquotVolumeMl: "5", stockConcentrationM: "0.2" })) {
        const el = document.getElementById("s3d-slot-" + k); setter.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true }));
      }
      await sleep(200);
      document.querySelector('input[type="checkbox"]').click(); await sleep(200);
      [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Save setup and start").click(); await sleep(6000);
      const dock = (name) => [...document.querySelectorAll("nav button")].find((b) => b.textContent.trim() === name);
      const r = [];
      for (const id of ["volumetric-flask", "sample-bottle", "beaker-150ml", "wash-bottle"]) {
        if (!document.querySelector(".s3d-tile")) { dock("Tray")?.click(); await sleep(400); }
        const t = document.querySelector('.s3d-tile[data-definition-id="' + id + '"]');
        if (!t) { r.push("no tile " + id); continue; }
        t.focus(); t.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); await sleep(1500);
        r.push("ok " + id);
      }
      return r.join(" | ");
    });
    await page.waitForTimeout(3000);
    await page.screenshot({ timeout: 180000, path: `${out}-${quality}.png` });
    console.log(quality, result, errors.length ? "ERRORS " + errors.join(" ; ") : "no errors");
    await page.close();
  }
  await browser.close();
})();
