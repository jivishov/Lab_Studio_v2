// Places tray tiles with Enter, in order, and screenshots after each. node place-from-tray.cjs <url> <outdir> <tile names, "|"-separated>
const { chromium } = require("playwright");
const fs = require("fs");
const [url, out, names] = process.argv.slice(2);
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
  await page.waitForTimeout(4000);
  let n = 0;
  for (const name of names.split("|")) {
    n += 1;
    const tile = page.locator(".s3d-tray button, .s3d-tray [role=button]").filter({ hasText: name }).first();
    await tile.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2500);
    const status = await page.locator("[role=status], .s3d-toast").allTextContents().catch(() => []);
    console.log(n, name, "|", status.join(" / ").slice(0, 200));
    await page.screenshot({ path: `${out}/tray${n}.png` });
  }
  if (process.env.EXAMINE) {
    await page.keyboard.press("Escape");
  }
  fs.writeFileSync(`${out}/log.txt`, "ERRORS\n" + errors.join("\n"));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
