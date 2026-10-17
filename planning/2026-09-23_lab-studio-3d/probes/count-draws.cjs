// Draw calls per frame at Home (the lab room, 2026-10-16): opens a 3D lab, starts it, presses Home and counts the
// renderer's draw calls over 30 frames, with renderer.info.autoReset off and reset() before counting. The renderer and
// scene come from three's devtools hook. Counts are the same under SwiftShader; frame times from here are not.
//   NODE_PATH=…/Lab_studio/node_modules node count-draws.cjs <base url> [lab id] [quality] [WxH]
const { chromium } = require("playwright");
const [base, lab = "hard-water-demo", quality = "balanced", size = "1024x700"] = process.argv.slice(2);
const [width, height] = size.split("x").map(Number);
(async () => {
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.addInitScript((q) => {
    try { localStorage.setItem("lab-studio:3d:v1:player-ui", JSON.stringify({ quality: q, beacon: true })); } catch {}
    window.__seen = [];
    window.__THREE_DEVTOOLS__ = new EventTarget();
    window.__THREE_DEVTOOLS__.addEventListener("observe", (e) => window.__seen.push(e.detail));
  }, quality);
  await page.goto(`${base}/#/3d/play/${lab}`);
  await page.waitForTimeout(4000);
  await page.getByRole("button", { name: /Next: setup|Start/ }).first().click();
  if (await page.getByText("I approve these values").count()) {
    await page.getByText("I approve these values").click();
    await page.getByRole("button", { name: "Save setup and start" }).click();
  }
  await page.waitForSelector(".s3d-step__title", { timeout: 60000 });
  await page.waitForTimeout(20000); // the shelf and spines load after the bench is shown
  await page.locator("canvas").first().focus();
  await page.keyboard.press("Home");
  await page.waitForTimeout(8000);
  const result = await page.evaluate(async () => {
    const r = window.__seen.filter((o) => o && o.isWebGLRenderer).at(-1);
    const scene = window.__seen.filter((o) => o && o.isScene).at(-1);
    const orig = r.render;
    let frames = 0;
    const perScene = [];
    r.render = function (s, c) { const b = r.info.render.calls; orig.call(this, s, c); if (s.isScene) perScene.push(r.info.render.calls - b); };
    r.info.autoReset = false;
    r.info.reset();
    await new Promise((res) => { const tick = () => { frames += 1; if (frames <= 30) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); setTimeout(res, 120000); });
    const calls = r.info.render.calls;
    r.render = orig;
    r.info.autoReset = true;
    const meshes = (name) => { let n = 0; scene.children.find((c) => c.name.startsWith(name))?.traverse((o) => { if (o.isMesh) n += 1; }); return n; };
    return { frames: frames - 1, callsPerFrame: Math.round(calls / Math.max(1, frames - 1)), sceneRenders: [...new Set(perScene)], roomMeshes: meshes("room"), furnitureMeshes: meshes("bench furniture") };
  });
  console.log(JSON.stringify({ base, lab, quality, size, ...result }));
  await browser.close();
})();
