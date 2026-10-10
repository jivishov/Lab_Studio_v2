// One G1 look at the D8 3D experiment `intro-filtration-demo` (E3): the intro by part, the setup page with
// the approved defaults, then the whole run of 31 steps: measure the sample, transfer it, precipitate
// calcium carbonate, and filter it. Each step logs the step card's eyebrow, so the part labels are checked.
//   node look-lab3d.cjs <out-prefix>
const { openLook } = require("./look-common.cjs");
(async () => {
  const look = await openLook("intro-filtration-demo", process.argv[2], { width: 1280, height: 800 }, "#/3d/play/intro-filtration-demo");
  const eyebrow = () => document.querySelector(".s3d-step .s3d-eyebrow")?.textContent;
  const step = async (fn) => look.log(await look.run(fn));
  const at = () => [document.querySelector(".s3d-step .s3d-eyebrow")?.textContent, window.__step()].join(" :: ");
  await look.page.waitForTimeout(4000);
  await look.shot("0-intro");
  await look.run(async () => { [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Next: setup")?.click(); await window.__sleep(800); });
  await look.shot("0b-setup");
  await step(() => window.__setup({}));
  await look.page.waitForTimeout(3000);
  await look.shot("1-start");
  look.log("eyebrow: " + await look.run(eyebrow));

  // Part 1 · Measure Liquid Volume
  await step(async () => [await window.__tray("graduated-cylinder-1"), window.__step()].join(" | "));
  await step(async () => [await window.__carry(/^Hard water sample/, /^Release to pour/), window.__step()].join(" | "));
  await look.page.waitForTimeout(4000);
  await look.shot("2-measured");
  await step(async () => [await window.__input("20"), await window.__card("Confirm"), await window.__card("Record"), window.__step()].join(" | "));
  look.log("at: " + await look.run(at));

  // Part 2 · Transfer Liquid
  await step(async () => [await window.__tray("beaker-250ml-1"), window.__step()].join(" | "));
  await step(async () => [await window.__carry(/^Graduated cylinder/, /^Release to pour/), window.__step()].join(" | "));
  await look.page.waitForTimeout(9000);
  await look.shot("3-transferred");
  await step(async () => [await window.__carry(/^Wash bottle/, /^Release to rinse/), await window.__card("Rinse"), await window.__card("Rinse"), window.__step()].join(" | "));
  await look.page.waitForTimeout(8000);
  await step(async () => [await window.__card("Record"), window.__step()].join(" | "));
  look.log("at: " + await look.run(at));

  // Part 3 · Hard-Water Calcium Carbonate Precipitation
  await step(async () => [await window.__tray("stirring-rod-1"), await window.__carry(/^Stirring rod/, /^Release to (stand|place)/i), window.__step()].join(" | "));
  await look.page.waitForTimeout(2000);
  await step(async () => [await window.__carry(/^Sodium carbonate solution/, /^Release to/), window.__step()].join(" | "));
  await look.page.waitForTimeout(6000);
  await look.shot("4-first-portion");
  await step(async () => [await window.__card("Record"), window.__step()].join(" | "));
  for (let n = 2; n <= 3; n++) {
    await step(async () => { await window.__sleep(3000); return [await window.__carry(/^Sodium carbonate solution/, /^Release to/), window.__step()].join(" | "); });
    await look.page.waitForTimeout(6000);
  }
  await step(async () => [await window.__card("Stir"), window.__step()].join(" | "));
  await look.page.waitForTimeout(1500);
  await look.shot("5-stirring-clock");
  await step(async () => { await window.__sleep(4000); return [await window.__carry(/^Wash bottle/, /^Release to rinse/), window.__step()].join(" | "); });
  await look.page.waitForTimeout(3000);
  await step(async () => [await window.__carry(/^Stirring rod/, /^Release to/), window.__step()].join(" | "));
  await look.page.waitForTimeout(2000);
  await step(async () => [await window.__card("Wait"), window.__step()].join(" | "));
  await look.page.waitForTimeout(6000);
  await step(async () => [await window.__tray("beral-pipette-1"), await window.__carry(/^Dropping pipette/, /^Release to draw/), window.__step()].join(" | "));
  await look.page.waitForTimeout(4000);
  await step(async () => [await window.__carry(/^Dropping pipette/, /^Release to add one drop/), window.__step()].join(" | "));
  await look.page.waitForTimeout(4000);
  await look.shot("6-drop-test");
  look.log("at: " + await look.run(at));

  // Part 4 · Filter a Precipitate
  await step(async () => [await window.__tray("ring-stand-1"), await window.__tray("funnel-1"),
    await window.__carry(/^Glass funnel/, /^Release to seat/), window.__step()].join(" | "));
  await look.page.waitForTimeout(2000);
  await step(async () => [await window.__card("Tare"), await window.__tray("filter-paper-1"), await window.__carry(/^Filter paper/, /^Release to lay/), window.__step()].join(" | "));
  await look.page.waitForTimeout(1500);
  await look.shot("7-paper-on-balance");
  await step(async () => [await window.__input("0.553"), await window.__card("Confirm"), await window.__card("Record"), window.__step()].join(" | "));
  await step(async () => [await window.__carry(/^Filter paper/, /^Release to (set down|take it off)/), await window.__card("Fold"), window.__step()].join(" | "));
  await step(async () => [await window.__carry(/^Filter paper/, /^Release to open/), window.__step()].join(" | "));
  await step(async () => [await window.__carry(/^Wash bottle/, /^Release to wet/), window.__step()].join(" | "));
  await look.page.waitForTimeout(5000);
  await step(async () => [await window.__tray("erlenmeyer-flask-250ml-1"), await window.__carry(/^Receiving flask/, /^Release to put/), window.__step()].join(" | "));
  await look.page.waitForTimeout(2000);
  await look.shot("8-ready-to-filter");
  for (let n = 1; n <= 10; n++) {
    await step(async () => [await window.__carry(/^Sample beaker/, /^Release to pour/), window.__step()].join(" | "));
    if (n === 1) await look.shot("9-pouring");
    await look.page.waitForTimeout(9000);
    if (!/Pour the mixture/.test(await look.run(() => window.__step()))) break;
  }
  await step(async () => [await window.__carry(/^Wash bottle/, /^Release to rinse the/), await window.__card("Rinse"), await window.__card("Rinse"), window.__step()].join(" | "));
  await look.page.waitForTimeout(6000);
  await step(async () => [await window.__carry(/^Wash bottle/, /^Release to (wash|rinse)/), await window.__card("Rinse"), await window.__card("Rinse"), window.__step()].join(" | "));
  await look.page.waitForTimeout(8000);
  await look.shot("10-results");
  look.log("at: " + await look.run(at));
  // Float noise (a 28.9999999999 mL beaker) must not reach the screen: scan the results, notebook and bench list.
  look.log("screen text: " + await look.run(async () => {
    const texts = [document.body.innerText];
    for (const name of ["Notebook", "Bench list"]) {
      [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === name)?.click(); await window.__sleep(800);
      texts.push(document.body.innerText);
    }
    const long = [...new Set(texts.join(" ").match(/\d+\.\d{5,}/g) ?? [])];
    return (long.length ? "LONG NUMBERS " + long.join(", ") : "no long numbers") + " || " + texts[0].replace(/\s+/g, " ").slice(0, 400);
  }));
  await look.shot("11-notebook-bench");
  await look.close();
})();
