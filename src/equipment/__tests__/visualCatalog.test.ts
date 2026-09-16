import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { v1EquipmentCatalog } from "../catalog";
import {
  validateVisualCatalog,
  v1VisualCatalog,
  type VisualCatalog,
} from "../visualCatalog";

const generatedChromatographyAssetIds = [
  "chromatography-paper",
  "chromatography-chamber",
  "capillary-spotter",
  "metric-ruler",
] as const;

const generatedSimulatorAssetIds = [
  "volumetric-flask",
  "pencil",
  "cuvette",
  "spectrophotometer",
  "chromatography-chamber-with-paper",
  "rubber-stopper-set",
  "volumetric-flask-stoppered",
  "spectrophotometer-cuvette-inserted",
  "ring-stand-clay-triangle",
  "ring-stand-clay-triangle-crucible-lid-ajar",
] as const;

const generatedEquilibriumAssetIds = [
  "small-vial",
  "reagent-tray",
  "luer-lock-syringe-locked",
] as const;

const generatedApChemAssetIds = [
  "foam-cup-calorimeter",
  "buchner-funnel",
  "side-arm-filter-flask",
  "vacuum-source",
  "conductivity-tester",
  "melting-point-apparatus",
  "ph-paper",
  "permanent-marker",
  "magnet",
  "data-collection-interface",
  "graduated-pipette-10ml",
  "beral-pipette",
  "pipette-pump",
] as const;

const publicAssetPaths = new Set(
  [
    ...v1EquipmentCatalog.map((definition) => definition.asset),
    ...Object.values(v1VisualCatalog).flatMap((profile) =>
      Object.values(profile.stateAssets ?? {}),
    ),
    ...Object.values(v1VisualCatalog).flatMap((profile) =>
      profile.probePresentation
        ? [profile.probePresentation.probeAsset, profile.probePresentation.detachedConsoleAsset]
        : [],
    ),
  ].filter((asset) =>
    existsSync(join(process.cwd(), "public", asset.replace(/^\//, ""))),
  ),
);

const realisticAssetDir = join(process.cwd(), "public", "assets", "equipment-realistic", "v1");

const publicPath = (assetPath: string): string => join(process.cwd(), "public", assetPath.replace(/^\//, ""));

const readPngDimensions = (assetPath: string): { width: number; height: number } => {
  const bytes = readFileSync(publicPath(assetPath));
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
};

const readEmbeddedPngSvg = (assetPath: string) => {
  const svg = readFileSync(publicPath(assetPath), "utf8");
  const svgDimensions = svg.match(/<svg[^>]*\bwidth="(\d+)"[^>]*\bheight="(\d+)"/);
  const viewBox = svg.match(/<svg[^>]*\bviewBox="([^"]+)"/);
  const imageDimensions = svg.match(/<image[^>]*\bwidth="(\d+)"[^>]*\bheight="(\d+)"/);
  const ariaLabel = svg.match(/<svg[^>]*\baria-label="([^"]+)"/);
  const embeddedPng = svg.match(/\bhref="data:image\/png;base64,([^"]+)"/);
  const preserveAspectRatio = svg.match(/<image[^>]*\bpreserveAspectRatio="([^"]+)"/);
  const imageElementCount = svg.match(/<image\b/g)?.length ?? 0;
  const embeddedPngCount = svg.match(/\bhref="data:image\/png;base64,/g)?.length ?? 0;

  if (!svgDimensions || !viewBox || !imageDimensions || !ariaLabel || !embeddedPng || !preserveAspectRatio) {
    throw new Error(`Expected ${assetPath} to be a PNG-backed SVG asset.`);
  }

  const viewBoxParts = viewBox[1].split(/\s+/).map(Number);
  if (viewBoxParts.length !== 4 || viewBoxParts.some((part) => Number.isNaN(part))) {
    throw new Error(`Expected ${assetPath} to have a numeric four-part viewBox.`);
  }

  return {
    ariaLabel: ariaLabel[1],
    embeddedPngBytes: Buffer.from(embeddedPng[1], "base64"),
    preserveAspectRatio: preserveAspectRatio[1],
    svg: {
      width: Number(svgDimensions[1]),
      height: Number(svgDimensions[2]),
    },
    viewBox: {
      x: viewBoxParts[0],
      y: viewBoxParts[1],
      width: viewBoxParts[2],
      height: viewBoxParts[3],
    },
    image: {
      width: Number(imageDimensions[1]),
      height: Number(imageDimensions[2]),
    },
    imageElementCount,
    embeddedPngCount,
  };
};

describe("visual catalog", () => {
  it("profiles every equipment definition with existing assets", () => {
    const errors = validateVisualCatalog(v1VisualCatalog, v1EquipmentCatalog, publicAssetPaths);
    expect(errors).toEqual([]);
  });

  it("keeps every realistic equipment SVG as a full-size PNG-backed wrapper", () => {
    const svgAssetNames = readdirSync(realisticAssetDir).filter((name) => name.endsWith(".svg"));

    expect(svgAssetNames.length).toBeGreaterThan(0);
    for (const assetName of svgAssetNames) {
      const assetPath = `/assets/equipment-realistic/v1/${assetName}`;
      const svgDimensions = readEmbeddedPngSvg(assetPath);
      const pngDimensions = readPngDimensions(assetPath.replace(/\.svg$/, ".png"));

      expect(svgDimensions.imageElementCount).toBe(1);
      expect(svgDimensions.embeddedPngCount).toBe(1);
      expect(svgDimensions.svg).toEqual(svgDimensions.image);
      expect(svgDimensions.svg).toEqual(pngDimensions);
      expect(svgDimensions.viewBox).toEqual({
        x: 0,
        y: 0,
        width: pngDimensions.width,
        height: pngDimensions.height,
      });
    }
  });

  it("keeps every realistic wrapper aspect-preserving and accurately labelled", () => {
    // The two halves of the AGENTS.md wrapper contract the dimension test above does not cover.
    // `npm run content:check` enforces the same two as asset/wrapper-preserve-aspect-ratio and
    // asset/wrapper-label; asserting them here keeps the Vitest and lint views in agreement.
    const svgAssetNames = readdirSync(realisticAssetDir).filter((name) => name.endsWith(".svg"));

    expect(svgAssetNames.length).toBeGreaterThan(0);
    for (const assetName of svgAssetNames) {
      const source = readFileSync(join(realisticAssetDir, assetName), "utf8");
      const rootTag = source.match(/<svg\b[^>]*>/s)?.[0] ?? "";
      const ariaLabel = rootTag.match(/aria-label="([^"]*)"/)?.[1];

      expect(rootTag.match(/role="([^"]*)"/)?.[1], assetName).toBe("img");
      expect(ariaLabel?.trim(), assetName).toBeTruthy();
      // preserveAspectRatio sits on the <image>, whose tag spans the base64 payload, so look at the
      // end of the file rather than matching the whole element.
      expect(source.slice(-400), assetName).toContain('preserveAspectRatio="xMidYMid meet"');
    }
  });

  it("rejects missing liquid profiles for core liquid equipment", () => {
    const broken: VisualCatalog = {
      ...v1VisualCatalog,
      "beaker-250ml": {
        ...v1VisualCatalog["beaker-250ml"],
        liquidVisualProfile: undefined,
      },
    };
    expect(validateVisualCatalog(broken).join(" ")).toContain("liquid visual profile");
  });

  it("rejects visual zones that do not map to interaction zones", () => {
    const broken: VisualCatalog = {
      ...v1VisualCatalog,
      "funnel-stand": {
        ...v1VisualCatalog["funnel-stand"],
        visualZones: [
          ...v1VisualCatalog["funnel-stand"].visualZones,
          { id: "paint-only-zone", bounds: { x: 0, y: 0, width: 10, height: 10 }, anchor: { x: 5, y: 5 } },
        ],
      },
    };
    expect(validateVisualCatalog(broken).join(" ")).toContain("paint-only-zone");
  });

  it("rejects invalid normalized interaction anchors", () => {
    const broken: VisualCatalog = {
      ...v1VisualCatalog,
      "burette-50ml": {
        ...v1VisualCatalog["burette-50ml"],
        interactionAnchors: {
          dispenseControl: { x: Number.NaN, y: 0.82 },
          dispenseOutlet: { x: 0.5, y: 1.01 },
        },
      },
    };
    const errors = validateVisualCatalog(broken).join(" ");

    expect(errors).toContain("interaction anchor dispenseControl");
    expect(errors).toContain("interaction anchor dispenseOutlet");
    expect(errors).toContain("finite normalized coordinates between 0 and 1");
  });

  it("rejects asset viewports outside normalized source bounds", () => {
    const broken: VisualCatalog = {
      ...v1VisualCatalog,
      "probe-thermometer": {
        ...v1VisualCatalog["probe-thermometer"],
        assetViewport: { x: 0.8, y: 0, width: 0.3, height: 1 },
      },
    };

    expect(validateVisualCatalog(broken).join(" ")).toContain(
      "assetViewport must be a finite positive rectangle within normalized source bounds",
    );
  });

  it("keeps the burette wrapper, proportions, and dispense anchors aligned", () => {
    const profile = v1VisualCatalog["burette-50ml"];
    const pngPath = profile.assetId.replace(/\.svg$/, ".png");
    const pngBytes = readFileSync(publicPath(pngPath));
    const pngDimensions = readPngDimensions(pngPath);
    const svgAsset = readEmbeddedPngSvg(profile.assetId);
    const assetAspectRatio = pngDimensions.width / pngDimensions.height;
    const profileAspectRatio = profile.benchSize.width / profile.benchSize.height;
    const mountedLayer = { x: 181, y: 28, width: 64, height: 250 };
    const control = profile.interactionAnchors?.dispenseControl;
    const outlet = profile.interactionAnchors?.dispenseOutlet;

    expect(svgAsset.ariaLabel).toBe("Realistic 50 mL burette");
    expect(svgAsset.imageElementCount).toBe(1);
    expect(svgAsset.embeddedPngCount).toBe(1);
    expect(svgAsset.preserveAspectRatio).toBe("xMidYMid meet");
    expect(svgAsset.svg).toEqual(svgAsset.image);
    expect(svgAsset.svg).toEqual(pngDimensions);
    expect(svgAsset.viewBox).toEqual({ x: 0, y: 0, ...pngDimensions });
    expect(svgAsset.embeddedPngBytes).toEqual(pngBytes);
    expect(assetAspectRatio).toBeCloseTo(profileAspectRatio, 1);
    expect(control).toEqual({ x: 0.64, y: 0.82 });
    expect(outlet).toEqual({ x: 0.5, y: 0.97 });
    expect((control?.x ?? 0) * mountedLayer.width).toBeCloseTo(40.96, 2);
    expect((control?.y ?? 0) * mountedLayer.height).toBeCloseTo(205, 2);
    expect((outlet?.x ?? 0) * mountedLayer.width).toBeCloseTo(32, 2);
    expect((outlet?.y ?? 0) * mountedLayer.height).toBeCloseTo(242.5, 2);
    const outletY = mountedLayer.y + (outlet?.y ?? 0) * mountedLayer.height;
    expect(310 - outletY).toBeGreaterThanOrEqual(20);
    expect(profile.visualZones.find((zone) => zone.id === "burette-funnel-seat")?.anchor).toEqual({
      x: 48.75,
      y: 23,
    });
  });

  it("keeps both titration stand composites aligned and accurately labelled", () => {
    const expectedLabels = new Map([
      ["ring-stand-burette", "ring stand and clamp with burette"],
      ["ring-stand-burette-funnel", "ring stand and clamp with burette and filling funnel"],
    ]);

    for (const [assetId, label] of expectedLabels) {
      const svgPath = `/assets/equipment-realistic/v1/${assetId}.svg`;
      const pngPath = `/assets/equipment-realistic/v1/${assetId}.png`;
      const svg = readEmbeddedPngSvg(svgPath);
      expect(svg.ariaLabel).toBe(label);
      expect(svg.svg).toEqual({ width: 1024, height: 1504 });
      expect(svg.svg).toEqual(readPngDimensions(pngPath));
      expect(svg.imageElementCount).toBe(1);
      expect(svg.embeddedPngCount).toBe(1);
      expect(svg.preserveAspectRatio).toBe("xMidYMid meet");
    }
  });

  it("renders capillary spotter as upright equipment", () => {
    const profile = v1VisualCatalog["capillary-spotter"];

    expect(profile.benchSize.height).toBeGreaterThan(profile.benchSize.width);
    expect(profile.shelfSize.height).toBeGreaterThan(profile.shelfSize.width);
  });

  it("keeps the chromatography chamber configured for an empty chamber and inserted paper state", () => {
    const profile = v1VisualCatalog["chromatography-chamber"];
    const paperSlot = profile.visualZones.find((zone) => zone.id === "chromatography-chamber-paper-slot");
    const solventRegion = profile.contentRegions[0];

    expect(profile.benchSize.height).toBeGreaterThan(profile.benchSize.width);
    expect(paperSlot).toBeDefined();
    expect(paperSlot?.bounds.height).toBeGreaterThan(paperSlot?.bounds.width ?? 0);
    expect(paperSlot?.bounds.y).toBeGreaterThanOrEqual(35);
    expect(profile.liquidVisualProfile).toMatchObject({
      profileId: "chromatography-chamber-v1",
      visualCapacityOverrideMl: 50,
      liquidLayerMode: "under-asset",
    });
    expect(solventRegion.bounds.y).toBeGreaterThan(130);
    expect(solventRegion.bounds.height).toBeLessThanOrEqual(24);
  });

  it("keeps the rubber stopper set represented as one compact stopper", () => {
    const profile = v1VisualCatalog["rubber-stopper-set"];
    const svgDimensions = readEmbeddedPngSvg(profile.assetId);
    const pngDimensions = readPngDimensions(profile.assetId.replace(/\.svg$/, ".png"));

    expect(svgDimensions.ariaLabel).toBe("rubber stopper");
    expect(svgDimensions.svg).toEqual(svgDimensions.image);
    expect(svgDimensions.svg).toEqual(pngDimensions);
    expect(profile.benchSize.height).toBeGreaterThan(profile.benchSize.width);
    expect(profile.shelfSize.height).toBeGreaterThan(profile.shelfSize.width);
    expect(profile.benchSize.width).toBeLessThanOrEqual(42);
    expect(profile.footprint.width).toBeLessThan(profile.benchSize.width);
  });

  it("keeps generated chromatography assets PNG-backed and aligned to visual profiles", () => {
    for (const equipmentId of generatedChromatographyAssetIds) {
      const profile = v1VisualCatalog[equipmentId];
      const svgDimensions = readEmbeddedPngSvg(profile.assetId);
      const pngDimensions = readPngDimensions(profile.assetId.replace(/\.svg$/, ".png"));
      const visualAspectRatio = profile.benchSize.width / profile.benchSize.height;
      const assetAspectRatio = svgDimensions.svg.width / svgDimensions.svg.height;

      expect(svgDimensions.svg).toEqual(svgDimensions.image);
      expect(svgDimensions.svg).toEqual(pngDimensions);
      expect(assetAspectRatio).toBeCloseTo(visualAspectRatio, 1);
    }
  });

  it("keeps generated simulator assets as PNG-backed SVG wrappers", () => {
    for (const assetId of generatedSimulatorAssetIds) {
      const assetPath = `/assets/equipment-realistic/v1/${assetId}.svg`;
      const svgDimensions = readEmbeddedPngSvg(assetPath);
      const pngDimensions = readPngDimensions(assetPath.replace(/\.svg$/, ".png"));

      expect(svgDimensions.svg).toEqual(svgDimensions.image);
      expect(svgDimensions.svg).toEqual(pngDimensions);
    }
  });

  it("keeps equilibrium-only assets realistic, PNG-backed, and profile-aligned", () => {
    for (const assetId of generatedEquilibriumAssetIds) {
      const profile = v1VisualCatalog[assetId];
      const svgDimensions = readEmbeddedPngSvg(profile.assetId);
      const pngDimensions = readPngDimensions(profile.assetId.replace(/\.svg$/, ".png"));
      const visualAspectRatio = profile.benchSize.width / profile.benchSize.height;
      const assetAspectRatio = svgDimensions.svg.width / svgDimensions.svg.height;

      expect(svgDimensions.svg).toEqual(svgDimensions.image);
      expect(svgDimensions.svg).toEqual(pngDimensions);
      expect(assetAspectRatio).toBeCloseTo(visualAspectRatio, 1);
      expect(readFileSync(publicPath(profile.assetId.replace(/\.svg$/, ".png"))).length).toBeGreaterThan(20_000);
    }
  });

  it("keeps generated Chemistry apparatus PNG-backed and profile-aligned", () => {
    for (const equipmentId of generatedApChemAssetIds) {
      const profile = v1VisualCatalog[equipmentId];
      const svgDimensions = readEmbeddedPngSvg(profile.assetId);
      const pngDimensions = readPngDimensions(profile.assetId.replace(/\.svg$/, ".png"));
      const visualAspectRatio = profile.benchSize.width / profile.benchSize.height;
      const assetAspectRatio = svgDimensions.svg.width / svgDimensions.svg.height;

      expect(svgDimensions.embeddedPngCount).toBe(1);
      expect(svgDimensions.svg).toEqual(svgDimensions.image);
      expect(svgDimensions.svg).toEqual(pngDimensions);
      expect(assetAspectRatio).toBeCloseTo(visualAspectRatio, 1);
      expect(readFileSync(publicPath(profile.assetId.replace(/\.svg$/, ".png"))).length).toBeGreaterThan(12_000);
    }
  });

  it("keeps the approved hand-warmer cup wrapper aligned with its PNG source", () => {
    const assetPath = "/assets/equipment-realistic/v1/polystyrene-cup-8oz.svg";
    const pngBytes = readFileSync(publicPath(assetPath.replace(/\.svg$/, ".png")));
    const svgAsset = readEmbeddedPngSvg(assetPath);
    const pngDimensions = readPngDimensions(assetPath.replace(/\.svg$/, ".png"));

    expect(svgAsset.ariaLabel).toBe("8 ounce polystyrene cup");
    expect(svgAsset.imageElementCount).toBe(1);
    expect(svgAsset.embeddedPngCount).toBe(1);
    expect(svgAsset.preserveAspectRatio).toBe("xMidYMid meet");
    expect(svgAsset.svg).toEqual(svgAsset.image);
    expect(svgAsset.svg).toEqual(pngDimensions);
    expect(svgAsset.viewBox).toEqual({
      x: 0,
      y: 0,
      width: pngDimensions.width,
      height: pngDimensions.height,
    });
    expect(svgAsset.embeddedPngBytes).toEqual(pngBytes);
  });

  it("keeps thermometer and equilibrium tray equipment proportional on the bench", () => {
    const thermometer = v1VisualCatalog.thermometer;
    const testTube = v1VisualCatalog["test-tube"];
    const rack = v1VisualCatalog["sample-rack"];
    const tray = v1VisualCatalog["reagent-tray"];
    const syringe = v1VisualCatalog["luer-lock-syringe-locked"];
    const vial = v1VisualCatalog["small-vial"];

    expect(thermometer.benchSize.width).toBeLessThan(testTube.benchSize.width);
    expect(thermometer.benchSize.height).toBeLessThan(testTube.benchSize.height);
    expect(thermometer.hitBox.width).toBeGreaterThanOrEqual(44);
    expect(tray.benchSize.width).toBeLessThanOrEqual(rack.benchSize.width + 10);
    expect(syringe.benchSize.width).toBeLessThanOrEqual(rack.benchSize.width + 30);
    expect(vial.benchSize.width).toBeLessThanOrEqual(testTube.benchSize.width);
  });

  it("keeps the standard thermometer tightly framed and the probe crop calibrated", () => {
    const assetPath = "/assets/equipment-realistic/v1/thermometer.svg";
    const pngPath = assetPath.replace(/\.svg$/, ".png");
    const pngBytes = readFileSync(publicPath(pngPath));
    const svgAsset = readEmbeddedPngSvg(assetPath);
    const standard = v1VisualCatalog.thermometer;
    const probe = v1VisualCatalog["probe-thermometer"];

    expect(readPngDimensions(pngPath)).toEqual({ width: 300, height: 1254 });
    expect(svgAsset.svg).toEqual({ width: 300, height: 1254 });
    expect(svgAsset.image).toEqual({ width: 300, height: 1254 });
    expect(svgAsset.viewBox).toEqual({ x: 0, y: 0, width: 300, height: 1254 });
    expect(svgAsset.imageElementCount).toBe(1);
    expect(svgAsset.embeddedPngCount).toBe(1);
    expect(svgAsset.preserveAspectRatio).toBe("xMidYMid meet");
    expect(svgAsset.embeddedPngBytes).toEqual(pngBytes);
    expect(standard.benchSize).toEqual({ x: 0, y: 0, width: 28, height: 118 });
    expect(standard.shelfSize).toEqual({ x: 0, y: 0, width: 24, height: 88 });
    expect(probe.benchSize).toEqual({ x: 0, y: 0, width: 52, height: 154 });
    expect(probe.shelfSize).toEqual({ x: 0, y: 0, width: 38, height: 112 });
    expect(probe.footprint).toEqual({ x: 20, y: 142, width: 12, height: 6 });
    expect(probe.hitBox).toEqual({ x: 0, y: 0, width: 52, height: 154 });
    expect(probe.assetViewport).toEqual({
      x: 498 / 1254,
      y: 49 / 1254,
      width: 256 / 1254,
      height: 1175 / 1254,
    });
    expect(probe.interactionAnchors?.snapAnchor).toEqual({ x: 129 / 256, y: 231 / 1175 });
  });
});
