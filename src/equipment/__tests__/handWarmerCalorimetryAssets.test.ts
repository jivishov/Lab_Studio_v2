import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const assetDir = join(process.cwd(), "public", "assets", "equipment-realistic", "v1");

const productionStandaloneAssets = [
  ["ring-stand", "realistic ring stand with circular support ring clamp"],
  ["hot-plate-stirrer", "hot plate stirrer"],
  ["polystyrene-cup-8oz", "8 ounce polystyrene cup"],
  ["graduated-cylinder-100ml", "graduated cylinder 100ml"],
  ["analytical-balance", "analytical balance"],
  ["weigh-boat", "weigh boat"],
  ["spatula", "spatula"],
  ["stirring-rod", "stirring rod"],
  ["wash-bottle", "wash bottle"],
  ["reagent-bottle", "reagent bottle"],
  ["beaker-250ml", "beaker 250ml"],
  ["wooden-calorimeter-cover", "wooden calorimeter cover with centered probe hole"],
  ["probe-thermometer", "digital probe thermometer"],
  ["magnetic-stir-bar", "magnetic stir bar"],
  ["beaker-150ml", "150 milliliter borosilicate beaker"],
] as const;

const productionComposites = [
  ["hand-warmer-calorimeter-cal-00", "ring stand with empty support ring"],
  [
    "hand-warmer-calorimeter-cal-01",
    "ring stand and compact magnetic stirrer beneath the support ring",
  ],
  [
    "hand-warmer-calorimeter-cal-02",
    "outer polystyrene cup supported upright in the ring",
  ],
  [
    "hand-warmer-calorimeter-cal-03",
    "two nested polystyrene cups supported upright in the ring",
  ],
  [
    "hand-warmer-calorimeter-cal-04",
    "nested cup calorimeter with fitted wooden cover",
  ],
  [
    "hand-warmer-calorimeter-cal-05",
    "assembled calorimeter with probe thermometer through the cover",
  ],
  [
    "hand-warmer-calorimeter-cal-06",
    "water-filled covered calorimeter with probe thermometer",
  ],
  [
    "hand-warmer-calorimeter-cal-07",
    "water-filled calorimeter with magnetic stir bar",
  ],
  [
    "hand-warmer-calorimeter-cal-08",
    "covered calorimeter stirring without splashing",
  ],
  [
    "hand-warmer-calorimeter-cal-09",
    "open calorimeter with retained cover and probe beside weighed solid",
  ],
  [
    "hand-warmer-calorimeter-cal-10",
    "solid transferred into the open calorimeter",
  ],
  [
    "hand-warmer-calorimeter-cal-11",
    "covered calorimeter with reacting solution",
  ],
  [
    "hand-warmer-calorimeter-cal-12",
    "covered calorimeter with dissolved solution",
  ],
] as const;

const readPngDimensions = (png: Buffer) => ({
  width: png.readUInt32BE(16),
  height: png.readUInt32BE(20),
});

const readWrapper = (assetName: string) => {
  const png = readFileSync(join(assetDir, `${assetName}.png`));
  const svg = readFileSync(join(assetDir, `${assetName}.svg`), "utf8");
  const svgDimensions = svg.match(
    /<svg[^>]*\bwidth="(\d+)"[^>]*\bheight="(\d+)"[^>]*\bviewBox="0 0 (\d+) (\d+)"/,
  );
  const imageDimensions = svg.match(/<image[^>]*\bwidth="(\d+)"[^>]*\bheight="(\d+)"/);
  const ariaLabel = svg.match(/<svg[^>]*\baria-label="([^"]+)"/);
  const embeddedPng = svg.match(/\bhref="data:image\/png;base64,([^"]+)"/);

  if (!svgDimensions || !imageDimensions || !ariaLabel || !embeddedPng) {
    throw new Error(`${assetName}.svg is not a complete PNG-backed wrapper.`);
  }

  return {
    png,
    pngDimensions: readPngDimensions(png),
    svg,
    svgDimensions: svgDimensions.slice(1).map(Number),
    imageDimensions: imageDimensions.slice(1).map(Number),
    ariaLabel: ariaLabel[1],
    imageCount: svg.match(/<image\b/g)?.length ?? 0,
    embeddedPngCount: svg.match(/\bhref="data:image\/png;base64,/g)?.length ?? 0,
    embeddedPng: Buffer.from(embeddedPng[1], "base64"),
  };
};

const expectValidWrapper = (assetName: string, expectedLabel: string) => {
  const wrapper = readWrapper(assetName);
  const { width, height } = wrapper.pngDimensions;

  expect(wrapper.svgDimensions).toEqual([width, height, width, height]);
  expect(wrapper.imageDimensions).toEqual([width, height]);
  expect(wrapper.imageCount).toBe(1);
  expect(wrapper.embeddedPngCount).toBe(1);
  expect(wrapper.svg).toContain('preserveAspectRatio="xMidYMid meet"');
  expect(wrapper.ariaLabel).toBe(expectedLabel);
  expect(wrapper.embeddedPng.equals(wrapper.png)).toBe(true);
};

describe("hand-warmer calorimetry production assets", () => {
  it("keeps every installed standalone asset PNG-backed and byte-identical", () => {
    for (const [assetName, label] of productionStandaloneAssets) {
      expectValidWrapper(assetName, label);
    }
  });

  it("keeps every CAL-00 through CAL-12 composite at 1600 by 1600 with an exact wrapper", () => {
    for (const [assetName, label] of productionComposites) {
      expectValidWrapper(assetName, label);
      expect(readWrapper(assetName).pngDimensions).toEqual({ width: 1600, height: 1600 });
    }
  });

  it("uses one scene-driven compositor on every platform", () => {
    const installerSource = readFileSync(
      join(process.cwd(), "scripts", "installHandWarmerCalorimetryAssets.mjs"),
      "utf8",
    );
    const compositorSource = readFileSync(
      join(process.cwd(), "scripts", "scaleHandWarmerCompositeHeater.py"),
      "utf8",
    );

    expect(installerSource).toContain("runCanonicalCompositor");
    expect(installerSource).not.toContain("placeholderDefinitions");
    expect(compositorSource).toContain("calorimeter-scene.v1.json");
    expect(compositorSource).toContain("no CAL output");
  });

  it("checks transparent geometry, probe occlusion, and inherited heater pixels", () => {
    const result = spawnSync("python", ["scripts/verifyHandWarmerCalorimetryAssets.py"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("regression checks passed");
  });
});
