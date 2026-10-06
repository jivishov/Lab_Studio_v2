// One G1 look at Transfer Liquid's 3D practice (Pack 2): the beaker placed, the pour and drain, the
// three squirts rinsing the cylinder into the beaker, the observation and the results.
const { openLook } = require("./look-common.cjs");
(async () => {
  const look = await openLook("transfer-practice", process.argv[2]);
  look.log(await look.run(() => window.__setup({ transferVolumeMl: "20", transferObservation: "Clear, colourless sample in the beaker." })));
  await look.shot("0-start");
  look.log(await look.run(async () => [await window.__tray("beaker-250ml"), window.__step()].join(" | ")));
  look.log(await look.run(async () => [await window.__carry(/^Graduated cylinder/, /^Release to pour/), window.__step()].join(" | ")));
  for (let i = 0; i < 6; i++) { await look.shot("1-pour-drain-" + i); await look.page.waitForTimeout(1500); }
  await look.page.waitForTimeout(2000);
  look.log(await look.run(async () => [await window.__tray("wash-bottle"), await window.__carry(/^Wash bottle/, /^Release to rinse/), window.__step()].join(" | ")));
  for (let i = 0; i < 4; i++) { await look.shot("2-rinse-" + i); await look.page.waitForTimeout(1500); }
  look.log(await look.run(async () => {
    const r = [];
    for (let i = 0; i < 2; i++) r.push(await window.__card("Rinse"));
    await window.__sleep(8000);
    return r.join(" | ") + " || " + window.__step();
  }));
  await look.shot("3-rinsed");
  look.log(await look.run(async () => [await window.__card("Record"), window.__step()].join(" | ")));
  await look.page.waitForTimeout(2500);
  await look.shot("4-results");
  await look.close();
})();
