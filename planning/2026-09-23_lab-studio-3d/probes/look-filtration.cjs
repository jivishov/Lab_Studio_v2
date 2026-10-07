// One G1 look at Filter a Precipitate's 3D practice (Pack 2): the stand and funnel, the paper weighed,
// folded and opened into the funnel, wetted, the flask under the stem, the pour down the rod in portions
// with the funnel draining between them, the beaker rinsed in and the solid washed.
const { openLook } = require("./look-common.cjs");
(async () => {
  const look = await openLook("filtration-practice", process.argv[2]);
  look.log(await look.run(() => window.__setup({ mixtureVolumeMl: "30", precipitateMassG: "0.15", paperMassG: "0.552" })));
  await look.shot("0-start");
  look.log(await look.run(async () => [await window.__tray("ring-stand-1"), await window.__tray("funnel-1"),
    await window.__carry(/^Glass funnel/, /^Release to seat/), window.__step()].join(" | ")));
  await look.page.waitForTimeout(2000);
  await look.shot("1-funnel-in-ring");
  look.log(await look.run(async () => [await window.__card("Tare"), await window.__tray("filter-paper-1"), await window.__carry(/^Filter paper/, /^Release to lay/), window.__step()].join(" | ")));
  await look.page.waitForTimeout(1500);
  await look.shot("2-paper-on-balance");
  look.log(await look.run(async () => [await window.__input("0.552"), await window.__card("Confirm"), await window.__card("Record"), window.__step()].join(" | ")));
  look.log(await look.run(async () => [await window.__carry(/^Filter paper/, /^Release to (set down|take it off)/), await window.__card("Fold"), window.__step()].join(" | ")));
  await look.page.waitForTimeout(1500);
  await look.shot("3-paper-folded");
  look.log(await look.run(async () => [await window.__carry(/^Filter paper/, /^Release to open/), window.__step()].join(" | ")));
  look.log(await look.run(async () => [await window.__tray("wash-bottle-1"), await window.__carry(/^Wash bottle/, /^Release to wet/), window.__step()].join(" | ")));
  await look.page.waitForTimeout(5000);
  await look.shot("4-paper-wet-in-funnel");
  look.log(await look.run(async () => [await window.__tray("erlenmeyer-flask-250ml-1"), await window.__carry(/^Receiving flask/, /^Release to put/), window.__step()].join(" | ")));
  await look.page.waitForTimeout(2000);
  await look.shot("5-flask-under-stem");
  for (let n = 1; n <= 4; n++) {
    look.log(await look.run(async () => [await window.__carry(/^Sample beaker/, /^Release to pour/), window.__step()].join(" | ")));
    if (n === 1) {
      for (let i = 0; i < 4; i++) { await look.shot(`6-pour-1-${i}`); await look.page.waitForTimeout(1500); }
      // Reaching for the beaker while the funnel drains is refused.
      look.log(await look.run(async () => { const r = await window.__carryOnce(/^Sample beaker/, /^Release to pour/, false);
        return "early: " + r + " | " + (document.querySelector(".s3d-correction")?.textContent ?? "no correction"); }));
    }
    await look.page.waitForTimeout(9000);
  }
  await look.shot("7-all-poured");
  look.log(await look.run(async () => [await window.__carry(/^Wash bottle/, /^Release to rinse the/), await window.__card("Rinse"), await window.__card("Rinse"), window.__step()].join(" | ")));
  await look.page.waitForTimeout(6000);
  look.log(await look.run(async () => [await window.__carry(/^Wash bottle/, /^Release to (wash|rinse)/), await window.__card("Rinse"), await window.__card("Rinse"), window.__step()].join(" | ")));
  await look.page.waitForTimeout(8000);
  await look.shot("8-results");
  await look.close();
})();
