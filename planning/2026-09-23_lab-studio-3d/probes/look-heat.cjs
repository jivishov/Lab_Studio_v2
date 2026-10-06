// One G1 look at Heat and Reweigh's 3D practice (Pack 2): the crucible weighed empty and loaded, the
// support built (ring stand, clay triangle, burner beneath), the lid set askew, the burner lit (yellow) and
// its collar opened (blue), the gentle warming and the strong heating on the step clock with the dull red
// glow, the burner off, the crucible moved with tongs to the pad, cooled and weighed once.
const { openLook } = require("./look-common.cjs");
(async () => {
  const look = await openLook("thermal-decomposition-mass-loss-practice", process.argv[2], { width: 1440, height: 900 });
  const step = (fn) => look.run(fn).then((r) => look.log(r));
  await step(() => window.__setup({}));
  await look.shot("0-start");
  await step(async () => [await window.__tray("crucible-with-lid-1"), await window.__carry(/^Crucible with lid/, /^Release/), window.__step()].join(" | "));
  await step(async () => [await window.__input("25.000"), await window.__card("Confirm"), await window.__card("Record"), window.__step()].join(" | "));
  await step(async () => [await window.__tray("working-sample-portion-1"), await window.__carry(/^Mixture portion/, /^Release/), window.__step()].join(" | "));
  await look.page.waitForTimeout(3000);
  await step(async () => [await window.__input("27.000"), await window.__card("Confirm"), await window.__card("Record"), window.__step()].join(" | "));
  // The ring stand is carried by the arrow keys to open bench left of the balance (] would aim it at the balance).
  await step(async () => {
    const tray = await window.__tray("ring-stand-1");
    window.__dock("Bench list")?.click(); await window.__sleep(400);
    const buttons = [...document.querySelectorAll("[data-panel] button")];
    const at = buttons.findIndex((b) => /^Ring stand/.test(b.textContent.trim()));
    buttons.slice(at).find((b) => b.textContent.trim() === "Move…")?.click(); await window.__sleep(400);
    [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Close Bench list")?.click(); await window.__sleep(200);
    const canvas = document.querySelector(".s3d-player canvas"); canvas.focus();
    for (const key of ["ArrowLeft", "ArrowLeft", "ArrowLeft", "ArrowLeft", "ArrowDown", "ArrowDown"]) {
      canvas.dispatchEvent(new KeyboardEvent("keydown", { key, shiftKey: true, bubbles: true })); await window.__sleep(320);
    }
    const callout = document.querySelector(".s3d-callout")?.textContent ?? "";
    canvas.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); await window.__sleep(900);
    return [tray, callout, window.__step()].join(" | ");
  });
  await step(async () => [await window.__tray("clay-triangle-1"), await window.__carry(/^Clay triangle/, /^Release/), window.__step()].join(" | "));
  await step(async () => [await window.__tray("bunsen-burner-1"), await window.__carry(/^Bunsen burner/, /^Release/), window.__step()].join(" | "));
  await step(async () => [await window.__carry(/^Crucible with lid/, /^Release/), window.__step()].join(" | "));
  await look.page.waitForTimeout(1500);
  await look.shot("1-assembly");
  await step(async () => [await window.__card("Set the lid askew"), window.__step()].join(" | "));
  await step(async () => [await window.__card("Light"), window.__step()].join(" | "));
  await look.page.waitForTimeout(1500);
  await look.shot("2-yellow-flame");
  await look.page.screenshot({ path: `${process.argv[2]}-2z-yellow-flame.png`, clip: { x: 300, y: 250, width: 700, height: 500 } });
  await step(async () => [await window.__card("Open the air collar"), window.__step()].join(" | "));
  await look.page.waitForTimeout(1500);
  await look.shot("3-blue-flame");
  await look.page.screenshot({ path: `${process.argv[2]}-3z-blue-flame.png`, clip: { x: 300, y: 250, width: 700, height: 500 } });
  await step(async () => [await window.__card("Heat"), window.__step()].join(" | "));
  await step(async () => { const r = await window.__card("Heat", 240000); await window.__sleep(4000); return r; });
  await look.page.screenshot({ path: `${process.argv[2]}-4z-heating.png`, clip: { x: 300, y: 250, width: 700, height: 500 } });
  await look.page.waitForTimeout(1500);
  await look.shot("4-strong-heat");
  await step(async () => [await window.__card("Turn off", 240000), window.__step()].join(" | "));
  await step(async () => [await window.__tray("crucible-tongs-1"), await window.__carry(/^Crucible tongs/, /^Release to/), window.__step()].join(" | "));
  await look.page.waitForTimeout(1500);
  await look.shot("5-on-pad");
  await step(async () => [await window.__card("Wait", 240000), window.__step()].join(" | "));
  await step(async () => [await window.__carry(/^Crucible with lid/, /^Release/), window.__step()].join(" | "));
  await look.page.waitForTimeout(1500);
  await look.shot("6-reweigh");
  await look.close();
})();
