// One run of Weigh a Solid with real mouse events, after the left button moved to the microarray
// lab's controller (adoption P3, 2026-10-04): tray tiles clicked and their items clicked onto the
// bench; the watch glass picked up and pressed down onto the balance pan; TARE clicked; the spatula
// picked up, pressed down into the reagent bottle and clicked onto the glass; a right click and a
// double-click checked. Headless Chromium with SwiftShader, graphics Low, reduced motion on.
// Item positions are found by sweeping the pointer over the canvas and reading the hover label.
//   NODE_PATH=…/Lab_studio/node_modules node run-weighing-mouse.cjs <output-prefix>
const { chromium } = require("playwright");
const out = process.argv[2];
(async () => {
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => {
    try { localStorage.setItem("lab-studio:3d:v1:player-ui", JSON.stringify({ quality: "low", beacon: true, reducedMotion: "on" })); } catch {}
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  const log = (...x) => console.log(...x);
  const wait = (ms) => page.waitForTimeout(ms);
  await page.goto("http://localhost:5182/#/3d/technique/weighing");
  await wait(4000);
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Next: setup").click(); await sleep(600);
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    const el = document.getElementById("s3d-slot-solidMassG"); setter.call(el, "2.037"); el.dispatchEvent(new Event("input", { bubbles: true }));
    await sleep(200);
    document.querySelector('input[type="checkbox"]').click(); await sleep(200);
    [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Save setup and start").click(); await sleep(6000);
  });
  const state = () => page.evaluate(() => ({
    step: document.querySelector(".s3d-topbar__centre b")?.textContent + " " + (document.querySelector(".s3d-step__title")?.textContent ?? ""),
    callout: document.querySelector(".s3d-callout")?.textContent ?? "",
    hint: document.querySelector(".s3d-hint")?.textContent ?? "",
    correction: document.querySelector(".s3d-correction")?.textContent ?? "",
    toast: document.querySelector(".s3d-toast")?.textContent ?? "",
    tray: [...document.querySelectorAll(".s3d-tile")].map((t) => t.dataset.definitionId).join(","),
  }));
  // Sweep the canvas: hover labels name the item under the pointer; a pointer cursor marks a control.
  const scan = async (box) => page.evaluate(async (box) => {
    const canvas = document.querySelector(".s3d-player canvas");
    const r = canvas.getBoundingClientRect();
    const b = box ?? { left: r.left + 400, top: r.top + 120, right: r.right - 10, bottom: r.bottom - 90, step: 14 };
    const hits = {};
    for (let y = b.top; y < b.bottom; y += b.step) for (let x = b.left; x < b.right; x += b.step) {
      window.dispatchEvent(new PointerEvent("pointermove", { clientX: x, clientY: y, pointerType: "mouse", bubbles: true }));
      await new Promise((res) => requestAnimationFrame(() => res()));
      const label = document.querySelector(".s3d-label")?.textContent?.split(" · ")[0];
      const key = canvas.style.cursor === "pointer" ? "CONTROL" : label;
      if (key) (hits[key] ??= []).push([x, y]);
    }
    const centre = {};
    for (const [k, pts] of Object.entries(hits)) centre[k] = { x: pts.reduce((s, p) => s + p[0], 0) / pts.length, y: pts.reduce((s, p) => s + p[1], 0) / pts.length, n: pts.length };
    return centre;
  }, box);
  const tileAt = (def) => page.evaluate((d) => {
    const dock = [...document.querySelectorAll("nav button")].find((b) => b.textContent.trim() === "Tray");
    if (!document.querySelector(".s3d-tile")) dock?.click();
    const t = document.querySelector('.s3d-tile[data-definition-id="' + d + '"]');
    if (!t) return null;
    const b = t.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  }, def);

  // 1. Tray: a click on a tile picks the item up; a click on the bench sets it down.
  for (const [def, x, y] of [["analytical-balance", 640, 330], ["reagent-bottle", 930, 320], ["spatula", 780, 470], ["watch-glass", 1010, 480]]) {
    await wait(300);
    const tile = await tileAt(def);
    if (!tile) { log("no tile", def); continue; }
    await page.mouse.click(tile.x, tile.y);
    await wait(200);
    await page.mouse.move(x, y, { steps: 6 });
    await wait(400);
    const over = await state();
    await page.mouse.click(x, y);
    await wait(1500);
    log("tray", def, "| callout before click:", over.callout, "| hint:", over.hint, "| after: tray", (await state()).tray);
  }
  let at = await scan();
  log("scan", JSON.stringify(at));
  const find = (re) => Object.entries(at).find(([k]) => re.test(k))?.[1];

  // 2. A right click puts a held item back; nothing moves.
  const bottle = find(/reagent bottle/i);
  if (bottle) {
    await page.mouse.click(bottle.x, bottle.y);
    await wait(300);
    await page.mouse.move(bottle.x - 120, bottle.y + 40, { steps: 5 });
    await wait(300);
    const held = await state();
    await page.mouse.click(bottle.x - 120, bottle.y + 40, { button: "right" });
    await wait(800);
    log("right click | while held:", held.hint, "| after:", (await state()).hint);
  }

  // 3. Step 1: pick up the watch glass, then press on the balance and drag down to seat it on the pan.
  const glass = find(/watch glass/i), balance = find(/balance/i);
  if (glass && balance) {
    await page.mouse.click(glass.x, glass.y);
    await wait(300);
    await page.mouse.move(balance.x, balance.y, { steps: 8 });
    await wait(600);
    log("glass over balance | callout:", (await state()).callout);
    await page.mouse.down();
    for (let i = 1; i <= 8; i += 1) { await page.mouse.move(balance.x, balance.y + i * 4); await wait(120); }
    await page.mouse.up();
    await wait(2500);
    log("after seat stroke |", JSON.stringify(await state()));
  }
  await page.screenshot({ timeout: 180000, path: out + "-1-glass-seated.png" });

  // 4. Step 2: TARE on the balance.
  // The camera reframed for the new step. The key is small: a fine sweep over the balance's front.
  at = await scan();
  const bal0 = find(/balance/i);
  at = bal0 ? await scan({ left: bal0.x - 160, top: bal0.y, right: bal0.x + 200, bottom: bal0.y + 260, step: 4 }) : {};
  const key = find(/^CONTROL$/);
  log("TARE key", JSON.stringify(key));
  if (key) { await page.mouse.click(key.x, key.y); await wait(2000); log("after TARE |", JSON.stringify(await state())); }

  // 5. Step 3: the spatula, dipped by a press dragged down into the bottle, then clicked onto the glass.
  at = await scan();
  log("scan", JSON.stringify(at));
  const spatula = find(/spatula/i), bottle2 = find(/reagent bottle/i), glass2 = find(/watch glass/i) ?? find(/balance/i);
  if (spatula && bottle2 && glass2) {
    await page.mouse.click(spatula.x, spatula.y);
    await wait(300);
    await page.mouse.move(bottle2.x, bottle2.y, { steps: 8 });
    await wait(600);
    log("spatula over bottle | callout:", (await state()).callout);
    await page.mouse.down();
    for (let i = 1; i <= 8; i += 1) { await page.mouse.move(bottle2.x, bottle2.y + i * 4); await wait(120); }
    await page.mouse.up();
    await wait(600);
    log("after dip | callout:", (await state()).callout);
    await page.mouse.move(glass2.x, glass2.y, { steps: 8 });
    await wait(800);
    log("spatula over glass | callout:", (await state()).callout);
    await page.screenshot({ timeout: 180000, path: out + "-2-scoop-over-glass.png" });
    await page.mouse.click(glass2.x, glass2.y);
    await wait(3000);
    log("after tip |", JSON.stringify(await state()));
  }

  // 6. A double-click on an item examines it; nothing moves.
  at = await scan();
  const bal = find(/balance/i);
  if (bal) {
    await page.mouse.dblclick(bal.x, bal.y);
    await wait(1500);
    log("double-click | examine open:", await page.evaluate(() => Boolean(document.querySelector(".s3d-examine"))), "|", JSON.stringify(await state()));
    await page.keyboard.press("Escape");
  }
  await page.screenshot({ timeout: 180000, path: out + "-3-end.png" });
  log(errors.length ? "ERRORS " + errors.join(" ; ") : "no errors");
  await browser.close();
})();
