// One visual spot check (G1) of the bench under the microarray lab's room and look (P1 of the
// adoption, 2026-10-04): headless Chromium with SwiftShader. Sets up Dilute a Stock Solution, puts
// four items on the bench from the tray and saves one screenshot per graphics tier given.
//   NODE_PATH=…/Lab_studio/node_modules node look-room.cjs <output-prefix> [quality …]
// Optional settings (the lab room, 2026-10-16), as environment variables:
//   LOOK_URL=http://…/#/3d/play/hard-water-demo   any 3D route instead of the dilution set-up: its start is clicked
//                                                 through and Home pressed (a route without a step card, such as
//                                                 #/3d/studio, is shot as it opens)
//   LOOK_VIEWPORT=1920x1080                       the page size (default 1280x800)
//   LOOK_THEME=light|hud                          the 3D theme (default: the app's)
//   LOOK_VIEWS="Whole bench,Overhead"             the camera menu's views to shoot after Home ("" for none)
//   LOOK_ORBITS="180,-90"                         orbits from Home, degrees of yaw (180 behind, -90 from the left
//                                                 end), each by a middle-button drag, one shot each
// Never read frame times from these shots: SwiftShader is a software renderer.
const { chromium } = require("playwright");
const out = process.argv[2];
const tiers = process.argv.slice(3).length ? process.argv.slice(3) : ["low"];
const url = process.env.LOOK_URL;
const [width, height] = (process.env.LOOK_VIEWPORT ?? "1280x800").split("x").map(Number);
const theme = process.env.LOOK_THEME;
const views = (process.env.LOOK_VIEWS ?? "Whole bench,Overhead").split(",").map((v) => v.trim()).filter(Boolean);
const orbits = (process.env.LOOK_ORBITS ?? "").split(",").map((v) => v.trim()).filter(Boolean).map(Number);
const YAW_PER_PX = 0.006; // MANUAL.yawPerPx (benchCamera.ts)
(async () => {
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  for (const quality of tiers) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.addInitScript(([q, t]) => {
      try {
        localStorage.setItem("lab-studio:3d:v1:player-ui", JSON.stringify({ quality: q, beacon: true }));
        if (t) localStorage.setItem("lab-studio:3d:v1:theme", t);
      } catch {}
    }, [quality, theme]);
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    let result = "";
    if (url) {
      await page.goto(url);
      await page.waitForTimeout(4000);
      const start = page.getByRole("button", { name: /Next: setup|Start/ });
      if (await start.count()) {
        await start.first().click();
        if (await page.getByText("I approve these values").count()) {
          await page.getByText("I approve these values").click();
          await page.getByRole("button", { name: "Save setup and start" }).click();
        }
        await page.waitForSelector(".s3d-step__title", { timeout: 60000 }).catch(() => {});
        await page.waitForTimeout(8000); // the shelf loads after the bench is shown
        await page.locator("canvas").first().focus();
        await page.keyboard.press("Home");
        result = "started, Home";
      } else result = "opened";
      await page.waitForTimeout(8000);
    } else {
      await page.goto("http://localhost:5182/#/3d/technique/dilution");
      await page.waitForTimeout(4000);
      result = await page.evaluate(async () => {
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
      await page.waitForTimeout(8000);
    }
    await page.screenshot({ timeout: 180000, path: `${out}-${quality}.png` });
    // The camera menu's views (the microarray lab's presets), one screenshot each.
    for (const view of url && result === "opened" ? [] : views) {
      await page.evaluate(async (label) => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        document.querySelector('[aria-label="Camera views"]')?.click(); await sleep(300);
        [...document.querySelectorAll('[role="menuitem"]')].find((b) => b.textContent.trim() === label)?.click(); await sleep(8000); // SwiftShader frames are slow; the 650 ms tween takes several
      }, view);
      await page.screenshot({ timeout: 180000, path: `${out}-${quality}-${view.replace(/ /g, "-").toLowerCase()}.png` });
    }
    // Orbits from Home: a middle-button drag across the canvas's middle, in steps.
    for (const degrees of orbits) {
      await page.locator("canvas").first().focus();
      await page.keyboard.press("Home");
      await page.waitForTimeout(6000);
      const px = -(degrees * Math.PI) / 180 / YAW_PER_PX;
      const box = await page.locator("canvas").first().boundingBox();
      const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
      const legs = Math.ceil(Math.abs(px) / (box.width * 0.4));
      for (let i = 0; i < legs; i += 1) {
        await page.mouse.move(cx - px / legs / 2, cy);
        await page.mouse.down({ button: "middle" });
        await page.mouse.move(cx + px / legs / 2, cy, { steps: 12 });
        await page.mouse.up({ button: "middle" });
      }
      await page.waitForTimeout(6000); // the cutaway's fade and SwiftShader's slow frames
      await page.screenshot({ timeout: 180000, path: `${out}-${quality}-orbit${degrees}.png` });
    }
    console.log(quality, result, errors.length ? "ERRORS " + errors.join(" ; ") : "no errors");
    await page.close();
  }
  await browser.close();
})();
