// Left-drag on empty bench slides the view: screenshots before and after a drag up, then a drag far down.
// node slide-bench.cjs <url> <outdir>
const { chromium } = require("playwright");
const fs = require("fs");
const [url, out] = process.argv.slice(2);
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 1024, height: 700 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(url);
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: /Next: setup|Start/ }).click();
  if (await page.getByText("I approve these values").count()) {
    await page.getByText("I approve these values").click();
    await page.getByRole("button", { name: "Save setup and start" }).click();
  }
  await page.waitForSelector(".s3d-step__title", { timeout: 30000 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${out}/slide0.png` });
  const drag = async (x, y, dx, dy, name) => {
    await page.mouse.move(x, y);
    await page.mouse.down({ button: "left" });
    for (let i = 1; i <= 12; i += 1) { await page.mouse.move(x + (dx * i) / 12, y + (dy * i) / 12); await page.waitForTimeout(30); }
    await page.mouse.up({ button: "left" });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${out}/${name}.png` });
  };
  const [x, y] = (process.env.AT ?? "640,560").split(",").map(Number);
  await drag(x, y, 0, -160, "slide1-up");
  await drag(x, y - 160, 0, 300, "slide2-down");
  await drag(x, y, 0, 300, "slide3-down-more");
  await drag(x, y, -200, 0, "slide4-left");
  fs.writeFileSync(`${out}/log.txt`, "ERRORS\n" + errors.join("\n"));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
