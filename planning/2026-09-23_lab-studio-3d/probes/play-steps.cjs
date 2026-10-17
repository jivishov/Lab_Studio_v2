// Plays a 3D technique through its step card and screenshots chosen steps.
// node play-steps.cjs <url> <outdir> [shotSteps comma list] [stopAfterStep]
// Optional (the lab room, 2026-10-16): PLAY_VIEWPORT=1920x1080 (default 1024x700), PLAY_THEME=light|hud,
// PLAY_QUALITY=low|balanced|high (default: the app's).
const { chromium } = require("playwright");
const fs = require("fs");
const [url, out, shotList = "", stopAfter = "999"] = process.argv.slice(2);
const shots = new Set(shotList.split(",").filter(Boolean).map(Number));
const INPUTS = {
  "Identify the bands": "Purple overlap, then yellow",
  "Read the front": "80",
  "Read the purple unresolved overlap band": "59",
  "Read the yellow band": ["66", "68"],
  "Read the blue band": "28",
  "Read the red band": "49",
  "Record the separation": ["Overlapping", "Resolved"],
};
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const [width, height] = (process.env.PLAY_VIEWPORT ?? "1024x700").split("x").map(Number);
  const page = await browser.newPage({ viewport: { width, height } });
  await page.addInitScript(([t, q]) => {
    try {
      if (t) localStorage.setItem("lab-studio:3d:v1:theme", t);
      if (q) localStorage.setItem("lab-studio:3d:v1:player-ui", JSON.stringify({ quality: q, beacon: true }));
    } catch {}
  }, [process.env.PLAY_THEME, process.env.PLAY_QUALITY]);
  const errors = [];
  page.on("pageerror", (e) => { errors.push(String(e)); console.log("PAGEERR", String(e).slice(0,300)); });
  page.on("console", (m) => { if (m.type() === "error") { errors.push(m.text()); console.log("CONSOLE", m.text().slice(0,300)); } });
  await page.goto(url);
  await page.waitForTimeout(3000);
  if (process.env.GATESHOTS) await page.screenshot({ path: `${out}/intro.png`, fullPage: true });
  await page.getByRole("button", { name: /Next: setup|Start/ }).click();
  if (process.env.GATESHOTS) { await page.waitForTimeout(800); await page.screenshot({ path: `${out}/setup.png`, fullPage: true }); }
  if (await page.getByText("I approve these values").count()) {
    await page.getByText("I approve these values").click();
    await page.getByRole("button", { name: "Save setup and start" }).click();
  }
  await page.waitForSelector(".s3d-step__title", { timeout: 30000 });
  await page.waitForTimeout(4000);
  const log = [];
  const used = {};
  for (let n = 1; n <= Number(stopAfter); n += 1) {
    const title = (await page.locator(".s3d-step__title").textContent()).trim();
    const stepText = await page.locator(".s3d-gatebar, header").first().textContent().catch(() => "");
    const input = page.locator("#s3d-step-input");
    if (await input.count()) {
      const entry = INPUTS[title];
      const value = Array.isArray(entry) ? entry[(used[title] = (used[title] ?? -1) + 1)] : entry ?? "My answer, written in full.";
      if ((await input.evaluate((el) => el.tagName)) === "SELECT") await input.selectOption({ label: value }).catch(async () => input.selectOption({ index: 1 }));
      else await input.fill(value);
    }
    const button = page.locator(".s3d-step__actions .s3d-button--primary");
    for (let i = 0; i < 60 && await button.isDisabled(); i += 1) await page.waitForTimeout(250);
    const label = (await button.textContent()).trim();
    await button.click();
    await page.waitForTimeout(shots.has(n) ? 4000 : 1600);
    if (shots.has(n)) await page.screenshot({ path: `${out}/step${String(n).padStart(2, "0")}.png`, timeout: 120000 }).catch((e) => console.log("shot fail", n));
    if ((process.env.HOMESHOT ?? "").split(",").includes(String(n))) {
      await page.locator("canvas").first().focus();
      await page.keyboard.press("Home");
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `${out}/step${String(n).padStart(2, "0")}-home.png`, timeout: 120000 }).catch(() => {});
    }
    if ((process.env.SEQSHOT ?? "").split(",").includes(String(n))) {
      if (!process.env.SEQNOHOME) { await page.locator("canvas").first().focus(); await page.keyboard.press("Home"); }
      for (const [i, wait] of [500, 2500, 5000, 10000].entries()) {
        await page.waitForTimeout(wait);
        await page.screenshot({ path: `${out}/seq${String(n).padStart(2, "0")}-${i}.png`, timeout: 120000 }).catch(() => {});
      }
    }
    const correction = await page.locator(".s3d-correction").first().textContent({ timeout: 500 }).catch(() => "");
    console.log(n, title, label, correction ? "!! " + correction.trim().slice(0, 160) : "");
    log.push(`${n} ${title} [${label}] ${correction ? "!! " + correction.trim().slice(0, 140) : ""}`);
    // Wait out any step clock.
    for (let i = 0; i < 60; i += 1) {
      const now = (await page.locator(".s3d-step__title").textContent().catch(() => "")).trim();
      if (now !== title || (await page.locator(".s3d-results, [aria-label*='Results']").count())) break;
      await page.waitForTimeout(300);
    }
  }
  await page.screenshot({ path: `${out}/final.png`, timeout: 120000 }).catch(() => {});
  fs.writeFileSync(`${out}/log.txt`, log.join("\n") + "\n\nERRORS\n" + errors.join("\n"));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
