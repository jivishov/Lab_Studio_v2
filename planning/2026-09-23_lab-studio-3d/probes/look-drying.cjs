// One G1 look at Dry and Weigh a Precipitate's 3D practice (Pack 2): the balance zeroed, the watch glass weighed, the paper
// lifted onto it, the filtrate down the sink, the oven set, opened, loaded and closed for the first stage
// on the step clock, the glass moved with tongs onto the pad and the door closed, the solid broken up, the second stage, cooling,
// the combined mass and the mass by difference.
const { openLook } = require("./look-common.cjs");
(async () => {
  const look = await openLook("drying-practice", process.argv[2], { width: 1440, height: 900 });
  const step = (fn) => look.run(fn).then((r) => look.log(r));
  await step(() => window.__setup({ precipitateMassG: "0.15", paperMassG: "0.552", watchGlassMassG: "30", firstDryingMinutes: "12" }));
  await look.shot("0-start");
  await step(async () => [await window.__card("Record"), await window.__card("Tare"), await window.__tray("watch-glass-1"),
    await window.__carry(/^Labelled watch glass/, /^Release to put the watch glass on the balance/), window.__step()].join(" | "));
  await step(async () => [await window.__input("30.000"), await window.__card("Confirm"), await window.__card("Record"), window.__step()].join(" | "));
  await step(async () => [await window.__carry(/^Labelled watch glass/, /^Release to (set down|take it off)/),
    await window.__carry(/^Filter paper/, /^Release to lift the paper/), window.__step()].join(" | "));
  await look.page.waitForTimeout(1500);
  await look.shot("1-paper-on-glass");
  await step(async () => [await window.__carry(/^Receiving flask/, /^Release to pour the filtrate/), window.__step()].join(" | "));
  for (let i = 0; i < 3; i++) { await look.shot("2-sink-" + i); await look.page.waitForTimeout(1500); }
  await step(async () => { await window.__sleep(3000); return [await window.__input("115"), await window.__card("Set"), await window.__card("Open the door"), window.__step()].join(" | "); });
  await look.page.waitForTimeout(1500);
  await look.shot("3-oven-open");
  await step(async () => [await window.__carry(/^Labelled watch glass/, /^Release to put the watch glass in the oven/), window.__step()].join(" | "));
  await look.page.waitForTimeout(1500);
  await look.shot("4-glass-in-oven");
  await step(async () => [await window.__card("Close and dry"), window.__step()].join(" | "));
  await look.page.waitForTimeout(1500);
  await look.shot("5-drying-clock");
  // Opening the oven before the clock has run is refused.
  await step(async () => {
    const oven = [...document.querySelectorAll("[data-panel] button")];
    const canvas = document.querySelector(".s3d-player canvas");
    const r = canvas.getBoundingClientRect();
    return "early door: " + (document.querySelector(".s3d-correction")?.textContent ?? "(no correction yet)");
  });
  await step(async () => [await window.__card("Open the door", 240000), window.__step()].join(" | "));
  await step(async () => [await window.__tray("crucible-tongs-1"), await window.__carry(/^Crucible tongs/, /^Release to lift the watch glass/), window.__step()].join(" | "));
  await step(async () => [await window.__card("Close the door"), window.__step()].join(" | "));
  await look.page.waitForTimeout(1500);
  await look.shot("6-on-pad");
  await step(async () => [await window.__tray("scoopula-1"), await window.__carry(/^Metal scoop/, /^Release to break up/), window.__step()].join(" | "));
  await look.page.waitForTimeout(2000);
  await step(async () => [await window.__card("Open the door"), await window.__carry(/^Crucible tongs/, /^Release to put it back/), await window.__card("Close and dry"), window.__step()].join(" | "));
  await step(async () => [await window.__card("Open the door", 240000), await window.__carry(/^Crucible tongs/, /^Release to lift the watch glass/), window.__step()].join(" | "));
  await step(async () => [await window.__card("Close the door"), await window.__card("Wait", 240000), window.__step()].join(" | "));
  await look.page.waitForTimeout(2000);
  await look.shot("7-cooling");
  await step(async () => [await (await window.__sleep(1), await window.__card("Confirm", 1), window.__carry(/^Labelled watch glass/, /^Release to put the watch glass on the balance/, true)), window.__step()].join(" | "));
  await look.page.waitForTimeout(2000);
  await look.shot("8-combined-on-balance");
  await step(async () => [await window.__input("30.702"), await window.__card("Confirm"), await window.__card("Record"), await window.__card("Submit"), window.__step()].join(" | "));
  await look.page.waitForTimeout(2500);
  await look.shot("9-results");
  await look.close();
})();
