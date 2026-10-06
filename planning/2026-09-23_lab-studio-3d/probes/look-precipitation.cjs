// One G1 look at Hard-Water Precipitation's 3D practice (Pack 2): the rod stood in the beaker, the three
// portions poured while it stirs, the observation, two minutes' stirring on the step clock, the rod lifted
// out, the precipitate settling, the dropping pipette filled, and the drop test.
const { openLook } = require("./look-common.cjs");
(async () => {
  const look = await openLook("hard-water-precipitation-practice", process.argv[2]);
  look.log(await look.run(() => window.__setup({ sampleVolumeMl: "20", reagentStockVolumeMl: "50", reagentVolumeMl: "9", precipitateMassG: "0.15",
    precipitateObservation: "A white precipitate forms.", completenessObservation: "No new cloudiness: precipitation is complete." })));
  await look.shot("0-start");
  look.log(await look.run(async () => [await window.__tray("stirring-rod-1"), await window.__carry(/^Stirring rod/, /^Release to (stand|place)/i), window.__step()].join(" | ")));
  await look.page.waitForTimeout(2000);
  await look.shot("1-rod-in-beaker");
  look.log(await look.run(async () => [await window.__carry(/^Sodium carbonate solution/, /^Release to/), window.__step()].join(" | ")));
  for (let i = 0; i < 4; i++) { await look.shot("2-portion-1-" + i); await look.page.waitForTimeout(1500); }
  look.log(await look.run(async () => [await window.__card("Record"), window.__step()].join(" | ")));
  for (const n of [2, 3]) {
    look.log(await look.run(async () => { await window.__sleep(3000); return [await window.__carry(/^Sodium carbonate solution/, /^Release to/), window.__step()].join(" | "); }));
    await look.page.waitForTimeout(6000);
    await look.shot("3-portion-" + n);
  }
  look.log(await look.run(async () => [await window.__card("Stir"), window.__step()].join(" | ")));
  for (let i = 0; i < 3; i++) { await look.shot("4-stirring-clock-" + i); await look.page.waitForTimeout(1500); }
  look.log(await look.run(async () => { await window.__sleep(4000); return [await window.__carry(/^Stirring rod/, /^Release to/), window.__step()].join(" | "); }));
  await look.page.waitForTimeout(2000);
  look.log(await look.run(async () => [await window.__card("Wait"), window.__step()].join(" | ")));
  await look.shot("5-settling");
  await look.page.waitForTimeout(6000);
  await look.shot("6-settled");
  look.log(await look.run(async () => [await window.__tray("beral-pipette-1"), await window.__carry(/^Dropping pipette/, /^Release to draw/), window.__step()].join(" | ")));
  await look.page.waitForTimeout(4000);
  look.log(await look.run(async () => [await window.__carry(/^Dropping pipette/, /^Release to add one drop/), window.__step()].join(" | ")));
  await look.page.waitForTimeout(900);
  await look.shot("7-drop-test");
  await look.page.waitForTimeout(4000);
  await look.shot("8-results");
  await look.close();
})();
