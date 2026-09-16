import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { emptyContents, type EquipmentInstance } from "../../domain/types";
import { equipmentById } from "../../equipment/catalog";
import { getVisualProfile } from "../../equipment/visualCatalog";
import { horizontalSpanAtHeight } from "../../equipment/liquidRendering";
import { EquipmentView } from "../EquipmentView";

const instance = (
  definitionId: string,
  volumeMl: number,
  visualState = "clear-liquid",
): EquipmentInstance => ({
  id: `${definitionId}-test`,
  definitionId,
  label: equipmentById.get(definitionId)?.label ?? definitionId,
  location: "workbench",
  contents: {
    ...emptyContents(),
    kind: "liquid",
    label: "Water",
    volumeMl,
    visualState,
  },
});

const emptyInstance = (definitionId: string): EquipmentInstance => ({
  id: `${definitionId}-test`,
  definitionId,
  label: equipmentById.get(definitionId)?.label ?? definitionId,
  location: "workbench",
  contents: emptyContents(),
});

const benchLayer = (item: EquipmentInstance, x = 0, y = 0, width?: number, height?: number) => {
  const profile = getVisualProfile(item.definitionId)!;
  return {
    id: item.id,
    definition: equipmentById.get(item.definitionId)!,
    instance: item,
    x,
    y,
    width: width ?? profile.benchSize.width,
    height: height ?? profile.benchSize.height,
  };
};

const pathPairs = (path: string | null | undefined): Array<{ x: number; y: number }> => {
  const numbers = path?.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const pairs: Array<{ x: number; y: number }> = [];
  for (let index = 0; index < numbers.length - 1; index += 2) {
    pairs.push({ x: numbers[index], y: numbers[index + 1] });
  }
  return pairs;
};

const pathBounds = (path: string | null | undefined) => {
  const pairs = pathPairs(path);
  return {
    left: Math.min(...pairs.map((point) => point.x)),
    right: Math.max(...pairs.map((point) => point.x)),
    top: Math.min(...pairs.map((point) => point.y)),
    bottom: Math.max(...pairs.map((point) => point.y)),
  };
};

const surfaceSpanFromBodyPath = (path: string | null | undefined) => {
  const pairs = pathPairs(path);
  const [left, right] = pairs;
  if (!left || !right) throw new Error(`Cannot resolve surface span from path: ${path}`);
  return { left, right, centerX: (left.x + right.x) / 2, width: right.x - left.x };
};

describe("EquipmentView liquid rendering", () => {
  it("keeps loaded capillary contents available without drawing the bench content badge", () => {
    const definition = equipmentById.get("capillary-spotter")!;
    const loadedCapillary: EquipmentInstance = {
      id: "capillary-loaded-test",
      definitionId: "capillary-spotter",
      label: definition.label,
      location: "workbench",
      contents: {
        ...emptyContents(),
        kind: "mixture",
        label: "Food dye mixture",
        volumeMl: 0.1,
        visualState: "food-dye-mixture",
      },
    };

    const { container, getByRole } = render(
      <EquipmentView definition={definition} instance={loadedCapillary} variant="bench" />,
    );

    expect(container.querySelector(".equipment-content-badge")).toBeNull();
    expect(container.querySelector(".equipment-liquid-fill")).toBeNull();
    expect(getByRole("button").getAttribute("aria-label")).toContain("0.1 mL food dye mixture");
  });

  it("renders chromatography chamber solvent inside the glass basin without fallback liquid", () => {
    const definition = equipmentById.get("chromatography-chamber")!;
    const { container } = render(
      <EquipmentView definition={definition} instance={instance("chromatography-chamber", 10)} variant="bench" />,
    );

    const svg = container.querySelector(".equipment-layer-svg");
    const liquidLayer = container.querySelector("[data-liquid-layer]");
    const body = container.querySelector("[data-liquid-body]");
    const assetImage = container.querySelector("image");
    const bodyPath = body?.getAttribute("d") ?? "";

    expect(svg).not.toBeNull();
    expect(liquidLayer).not.toBeNull();
    expect(body).not.toBeNull();
    expect(assetImage).not.toBeNull();
    expect(container.querySelector(".equipment-liquid-fill")).toBeNull();
    expect(bodyPath).toContain("M35 153.6");
    expect(bodyPath).toContain("H121");
    expect(bodyPath).toContain("V156");
    expect(bodyPath).toContain("H35");
    expect(Array.from(svg?.children ?? []).indexOf(liquidLayer as Element)).toBeLessThan(
      Array.from(svg?.children ?? []).indexOf(assetImage as Element),
    );
  });

  it("renders profiled liquid inside the equipment SVG coordinate system", () => {
    const definition = equipmentById.get("graduated-cylinder")!;
    const { container } = render(
      <EquipmentView definition={definition} instance={instance("graduated-cylinder", 20, "measured-liquid")} variant="bench" />,
    );

    const svg = container.querySelector(".equipment-layer-svg");
    const liquidLayer = container.querySelector("[data-liquid-layer]");
    const body = container.querySelector("[data-liquid-body]");
    const meniscus = container.querySelector("[data-meniscus]");
    const assetImage = container.querySelector("image");

    expect(svg).not.toBeNull();
    expect(liquidLayer).not.toBeNull();
    expect(body).not.toBeNull();
    expect(meniscus).not.toBeNull();
    expect(assetImage).not.toBeNull();
    expect(body?.getAttribute("stroke")).toContain("37, 104, 136");
    expect(Number(meniscus?.getAttribute("cx"))).toBeCloseTo(54);
    expect(Number(meniscus?.getAttribute("cy"))).toBeCloseTo(110.2);
    expect(Number(meniscus?.getAttribute("rx"))).toBeGreaterThan(8);
    expect(Array.from(svg?.children ?? []).indexOf(assetImage as Element)).toBeLessThan(
      Array.from(svg?.children ?? []).indexOf(liquidLayer as Element),
    );
  });

  it("raises the graduated-cylinder meniscus for a fine-pour top-up", () => {
    const definition = equipmentById.get("graduated-cylinder")!;
    const { container, rerender } = render(
      <EquipmentView definition={definition} instance={instance("graduated-cylinder", 95)} variant="bench" />,
    );
    const approachMeniscusY = Number(container.querySelector("[data-meniscus]")?.getAttribute("cy"));

    rerender(
      <EquipmentView definition={definition} instance={instance("graduated-cylinder", 99)} variant="bench" />,
    );
    const finePourMeniscusY = Number(container.querySelector("[data-meniscus]")?.getAttribute("cy"));

    expect(finePourMeniscusY).toBeLessThan(approachMeniscusY);
    expect(approachMeniscusY - finePourMeniscusY).toBeGreaterThan(3);
  });

  it("fits sample bottle liquid behind the realistic glass asset", () => {
    const definition = equipmentById.get("sample-bottle")!;
    const { container } = render(
      <EquipmentView definition={definition} instance={instance("sample-bottle", 120)} variant="bench" />,
    );

    const svg = container.querySelector(".equipment-layer-svg");
    const liquidLayer = container.querySelector("[data-liquid-layer]");
    const body = container.querySelector("[data-liquid-body]");
    const meniscus = container.querySelector("[data-meniscus]");
    const assetImage = container.querySelector("image");
    const clipPath = container.querySelector("clipPath path");
    const profile = getVisualProfile("sample-bottle")!.liquidVisualProfile!;
    const bounds = pathBounds(body?.getAttribute("d"));
    const clipBounds = pathBounds(clipPath?.getAttribute("d"));

    expect(svg).not.toBeNull();
    expect(liquidLayer).not.toBeNull();
    expect(body).not.toBeNull();
    expect(meniscus).not.toBeNull();
    expect(assetImage).not.toBeNull();
    expect(body?.getAttribute("stroke")).toContain("15, 91, 132");
    expect(body?.getAttribute("opacity")).toBe("1");
    expect(bounds.left).toBeGreaterThanOrEqual(profile.region.x);
    expect(bounds.right).toBeLessThanOrEqual(profile.region.x + profile.region.width);
    expect(bounds.bottom).toBeCloseTo(profile.region.y + profile.region.height);
    expect(clipBounds.bottom).toBeCloseTo(profile.region.y + profile.region.height);
    expect(clipPath?.getAttribute("d")).toContain("L");
    const surface = surfaceSpanFromBodyPath(body?.getAttribute("d"));
    expect(Number(meniscus?.getAttribute("cx"))).toBeCloseTo(surface.centerX);
    expect(Number(meniscus?.getAttribute("cy"))).toBeGreaterThan(profile.region.y);
    expect(Number(meniscus?.getAttribute("cy"))).toBeLessThan(profile.region.y + profile.region.height);
    expect(Number(meniscus?.getAttribute("rx"))).toBeLessThan(profile.region.width / 2);
    expect(Array.from(svg?.children ?? []).indexOf(liquidLayer as Element)).toBeLessThan(
      Array.from(svg?.children ?? []).indexOf(assetImage as Element),
    );
  });

  it("keeps low-volume beaker liquid inside the glass walls", () => {
    const definition = equipmentById.get("beaker-250ml")!;
    const { container } = render(
      <EquipmentView definition={definition} instance={instance("beaker-250ml", 20, "measured-liquid")} variant="bench" />,
    );

    const svg = container.querySelector(".equipment-layer-svg");
    const liquidLayer = container.querySelector("[data-liquid-layer]");
    const body = container.querySelector("[data-liquid-body]");
    const meniscus = container.querySelector("[data-meniscus]");
    const assetImage = container.querySelector("image");
    const profile = getVisualProfile("beaker-250ml")!.liquidVisualProfile!;
    const bounds = pathBounds(body?.getAttribute("d"));

    expect(svg).not.toBeNull();
    expect(liquidLayer).not.toBeNull();
    expect(body).not.toBeNull();
    expect(meniscus).not.toBeNull();
    expect(assetImage).not.toBeNull();
    expect(bounds.left).toBeGreaterThan(26);
    expect(bounds.right).toBeLessThan(76);
    expect(bounds.bottom).toBeCloseTo(profile.region.y + profile.region.height);
    expect(bounds.bottom).toBeLessThan(102);
    expect(Number(meniscus?.getAttribute("cy"))).toBeGreaterThan(90);
    expect(Number(meniscus?.getAttribute("cy"))).toBeLessThan(profile.region.y + profile.region.height);
    expect(Number(meniscus?.getAttribute("rx"))).toBeLessThan(23);
    expect(Array.from(svg?.children ?? []).indexOf(liquidLayer as Element)).toBeLessThan(
      Array.from(svg?.children ?? []).indexOf(assetImage as Element),
    );
  });

  it("clips precipitate mixture contents to the beaker SVG profile", () => {
    const definition = equipmentById.get("beaker-250ml")!;
    const precipitateInstance: EquipmentInstance = {
      ...instance("beaker-250ml", 40, "cloudy-precipitate"),
      contents: {
        ...emptyContents(),
        kind: "mixture",
        label: "Calcium carbonate precipitate mixture",
        volumeMl: 40,
        solutes: [{ id: "calcium-carbonate", label: "Calcium carbonate", amount: 0.0075, unit: "g" }],
        precipitate: {
          substance: "Calcium carbonate",
          massG: 0.0075,
          rinsed: false,
          dryness: "wet",
        },
        visualState: "cloudy-precipitate",
      },
    };
    const { container } = render(
      <EquipmentView definition={definition} instance={precipitateInstance} variant="bench" />,
    );

    const svg = container.querySelector(".equipment-layer-svg");
    const liquidLayer = container.querySelector("[data-liquid-layer]");
    const solidLayer = container.querySelector("[data-solid-layer]");
    const solidRegion = container.querySelector("[data-solid-region] ellipse");
    const body = container.querySelector("[data-liquid-body]");
    const assetImage = container.querySelector("image");
    const bounds = pathBounds(body?.getAttribute("d"));

    expect(solidLayer).not.toBeNull();
    expect(solidRegion).not.toBeNull();
    expect(container.querySelector(".equipment-solid-region-layer")).toBeNull();
    expect(liquidLayer?.getAttribute("clip-path")).toBe(solidLayer?.getAttribute("clip-path"));
    expect(bounds.bottom).toBeLessThan(102);
    expect(Number(solidRegion?.getAttribute("cx"))).toBeCloseTo(51);
    expect(Number(solidRegion?.getAttribute("cy"))).toBeCloseTo(96.1);
    expect(Number(solidRegion?.getAttribute("rx"))).toBeCloseTo(17);
    expect(Number(solidRegion?.getAttribute("ry"))).toBeCloseTo(1.9);
    expect(Array.from(svg?.children ?? []).indexOf(liquidLayer as Element)).toBeLessThan(
      Array.from(svg?.children ?? []).indexOf(solidLayer as Element),
    );
    expect(Array.from(svg?.children ?? []).indexOf(solidLayer as Element)).toBeLessThan(
      Array.from(svg?.children ?? []).indexOf(assetImage as Element),
    );
  });

  it("uses pink endpoint liquid styling for titration states", () => {
    const definition = equipmentById.get("erlenmeyer-flask-250ml")!;
    const { container } = render(
      <EquipmentView
        definition={definition}
        instance={instance("erlenmeyer-flask-250ml", 45, "titration-pale-pink")}
        variant="bench"
      />,
    );

    const gradientStop = container.querySelector("linearGradient stop:nth-child(2)");
    const body = container.querySelector("[data-liquid-body]");
    const liquidLayer = container.querySelector("[data-liquid-layer]");
    const assetImage = container.querySelector("image");
    const svg = container.querySelector(".equipment-layer-svg");
    const profile = getVisualProfile("erlenmeyer-flask-250ml")!.liquidVisualProfile!;
    const bounds = pathBounds(body?.getAttribute("d"));

    expect(gradientStop?.getAttribute("stop-color")).toContain("236, 126, 190");
    expect(Array.from(svg?.children ?? []).indexOf(liquidLayer as Element)).toBeGreaterThan(
      Array.from(svg?.children ?? []).indexOf(assetImage as Element),
    );
    expect(bounds.bottom).toBeCloseTo(profile.region.y + profile.region.height);
    expect(bounds.bottom).toBeLessThan(106);
    expect(bounds.right - bounds.left).toBeLessThan(profile.region.width);
  });

  it("renders 80 mL volumetric flask liquid in the bulb shoulder below the calibration mark", () => {
    const definition = equipmentById.get("volumetric-flask")!;
    const { container } = render(
      <EquipmentView definition={definition} instance={instance("volumetric-flask", 80)} variant="bench" />,
    );

    const svg = container.querySelector(".equipment-layer-svg");
    const liquidLayer = container.querySelector("[data-liquid-layer]");
    const body = container.querySelector("[data-liquid-body]");
    const meniscus = container.querySelector("[data-meniscus]");
    const assetImage = container.querySelector("image");
    const profile = getVisualProfile("volumetric-flask")!.liquidVisualProfile!;
    const bounds = pathBounds(body?.getAttribute("d"));
    const clipPath = container.querySelector("clipPath path");
    const surface = horizontalSpanAtHeight(profile, 0.59);
    const meniscusCx = Number(meniscus?.getAttribute("cx"));
    const meniscusRx = Number(meniscus?.getAttribute("rx"));

    expect(svg?.getAttribute("viewBox")).toBe("0 0 98 142");
    expect(assetImage?.getAttribute("href")).toContain("volumetric-flask.svg");
    expect(assetImage?.getAttribute("width")).toBe("98");
    expect(assetImage?.getAttribute("height")).toBe("142");
    expect(liquidLayer).not.toBeNull();
    expect(body).not.toBeNull();
    expect(meniscus).not.toBeNull();
    expect(profile.liquidLayerMode).toBe("within-svg-mask");
    expect(clipPath?.getAttribute("d")).toContain("C");
    expect(clipPath?.getAttribute("d")).not.toBe(body?.getAttribute("d"));
    expect(Array.from(svg?.children ?? []).indexOf(assetImage as Element)).toBeLessThan(
      Array.from(svg?.children ?? []).indexOf(liquidLayer as Element),
    );
    expect(bounds.left).toBeGreaterThanOrEqual(profile.region.x);
    expect(bounds.right).toBeLessThanOrEqual(profile.region.x + profile.region.width);
    expect(bounds.top).toBeCloseTo(78.6);
    expect(bounds.bottom).toBeCloseTo(114);
    expect(bounds.top).toBeGreaterThan(profile.calibrationMarkY ?? 0);
    expect(surface.width).toBeGreaterThan(12);
    expect(surface.width).toBeLessThan(16);
    expect(meniscusCx).toBeCloseTo(surface.centerX);
    expect(meniscusCx - meniscusRx).toBeGreaterThan(surface.leftX);
    expect(meniscusCx + meniscusRx).toBeLessThan(surface.rightX);
  });

  it("generates unique liquid clip ids for repeated equipment instances", () => {
    const definition = equipmentById.get("beaker-250ml")!;
    const beakerA = { ...instance("beaker-250ml", 20), id: "beaker-a" };
    const beakerB = { ...instance("beaker-250ml", 40), id: "beaker-b" };

    const { container } = render(
      <>
        <EquipmentView definition={definition} instance={beakerA} variant="bench" />
        <EquipmentView definition={definition} instance={beakerB} variant="bench" />
      </>,
    );

    const ids = Array.from(container.querySelectorAll("clipPath[id]")).map((node) =>
      node.getAttribute("id"),
    );

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("renders dry solid in a reagent bottle through the profiled SVG solid layer", () => {
    const definition = equipmentById.get("reagent-bottle")!;
    const solidInstance: EquipmentInstance = {
      id: "reagent-bottle-solid-test",
      definitionId: "reagent-bottle",
      label: definition.label,
      location: "workbench",
      contents: {
        ...emptyContents(),
        kind: "solid",
        label: "Sodium carbonate",
        massG: 1.2,
        visualState: "dry-solid",
      },
    };
    const { container } = render(
      <EquipmentView definition={definition} instance={solidInstance} variant="bench" />,
    );

    const svg = container.querySelector(".equipment-layer-svg");
    const liquidLayer = container.querySelector("[data-liquid-layer]");
    const solidLayer = container.querySelector("[data-solid-layer]");
    const solidRegion = container.querySelector("[data-solid-region] ellipse");
    const assetImage = container.querySelector("image");

    expect(svg).not.toBeNull();
    expect(liquidLayer).toBeNull();
    expect(solidLayer).not.toBeNull();
    expect(solidRegion).not.toBeNull();
    expect(container.querySelector(".equipment-solid-region-layer")).toBeNull();
    expect(solidLayer?.getAttribute("clip-path")).toContain("clip");
    expect(Number(solidRegion?.getAttribute("cy"))).toBeLessThan(96);
    expect(Array.from(svg?.children ?? []).indexOf(solidLayer as Element)).toBeLessThan(
      Array.from(svg?.children ?? []).indexOf(assetImage as Element),
    );
  });

  it("keeps narrow burette liquid and meniscus inside the tube profile", () => {
    const definition = equipmentById.get("burette-50ml")!;
    const { container } = render(
      <EquipmentView definition={definition} instance={instance("burette-50ml", 5, "clear-solution")} variant="bench" />,
    );

    const svg = container.querySelector(".equipment-layer-svg");
    const liquidLayer = container.querySelector("[data-liquid-layer]");
    const body = container.querySelector("[data-liquid-body]");
    const meniscus = container.querySelector("[data-meniscus]");
    const assetImage = container.querySelector("image");
    const profile = getVisualProfile("burette-50ml")!.liquidVisualProfile!;
    const bounds = pathBounds(body?.getAttribute("d"));
    const surface = surfaceSpanFromBodyPath(body?.getAttribute("d"));

    expect(svg?.getAttribute("viewBox")).toBe("0 0 96 360");
    expect(liquidLayer).not.toBeNull();
    expect(body).not.toBeNull();
    expect(meniscus).not.toBeNull();
    expect(bounds.left).toBeGreaterThanOrEqual(profile.region.x);
    expect(bounds.right).toBeLessThanOrEqual(profile.region.x + profile.region.width);
    expect(bounds.bottom).toBeCloseTo(profile.region.y + profile.region.height);
    expect(Number(meniscus?.getAttribute("cx"))).toBeCloseTo(surface.centerX);
    expect(Number(meniscus?.getAttribute("rx"))).toBeLessThan(surface.width / 2);
    expect(Array.from(svg?.children ?? []).indexOf(liquidLayer as Element)).toBeLessThan(
      Array.from(svg?.children ?? []).indexOf(assetImage as Element),
    );
  });

  it("renders the empty funnel stand without a filter-paper overlay", () => {
    const definition = equipmentById.get("funnel-stand")!;
    const { container } = render(
      <EquipmentView definition={definition} instance={emptyInstance("funnel-stand")} variant="bench" />,
    );

    expect(container.querySelector(".funnel-composite-overlay")).toBeNull();
    expect(container.querySelector('image[href*="funnel-stand.svg"]')).not.toBeNull();
  });

  it("renders inserted filter paper with the paper composite asset after attachment", () => {
    const funnel = emptyInstance("funnel-stand");
    const paper = {
      ...emptyInstance("filter-paper"),
      location: "snapZone" as const,
      snapZoneId: "funnel-stand-paper-seat",
      interactionStatus: "snapped" as const,
      contents: { ...emptyContents(), wetState: "wet" as const, visualState: "wet-equipment" },
    };
    const funnelDefinition = equipmentById.get("funnel-stand")!;
    const paperDefinition = equipmentById.get("filter-paper")!;
    const funnelProfile = getVisualProfile("funnel-stand")!;
    const paperSeat = funnelProfile.visualZones.find((zone) => zone.id === "funnel-stand-paper-seat")!;

    const { container } = render(
      <EquipmentView
        instance={funnel}
        layers={[
          {
            id: funnel.id,
            definition: funnelDefinition,
            instance: funnel,
            x: 0,
            y: 0,
            width: funnelProfile.benchSize.width,
            height: funnelProfile.benchSize.height,
          },
          {
            id: paper.id,
            definition: paperDefinition,
            instance: paper,
            x: paperSeat.bounds.x,
            y: paperSeat.bounds.y,
            width: paperSeat.bounds.width,
            height: paperSeat.bounds.height,
            zIndex: 2,
          },
        ]}
        variant="bench"
      />,
    );

    expect(container.querySelector('image[href*="funnel-paper-stand.svg"]')).not.toBeNull();
    expect(container.querySelector(".funnel-composite-overlay path")).not.toBeNull();
    expect(container.querySelector('img[src*="filter-paper.svg"]')).toBeNull();
  });

  it("renders inserted chromatography paper with the chamber composite asset", () => {
    const chamber = emptyInstance("chromatography-chamber");
    const paper = {
      ...emptyInstance("chromatography-paper"),
      location: "snapZone" as const,
      snapZoneId: "chromatography-chamber-paper-slot",
      interactionStatus: "snapped" as const,
      contents: {
        ...emptyContents(),
        chromatogram: { modelId: "food-dyes-paper", baselineMarked: true, spotted: true, bands: [] },
      },
    };
    const chamberProfile = getVisualProfile("chromatography-chamber")!;
    const paperSlot = chamberProfile.visualZones.find((zone) => zone.id === "chromatography-chamber-paper-slot")!;

    const { container } = render(
      <EquipmentView
        instance={chamber}
        layers={[
          benchLayer(chamber),
          benchLayer(paper, paperSlot.bounds.x, paperSlot.bounds.y, paperSlot.bounds.width, paperSlot.bounds.height),
        ]}
        variant="bench"
      />,
    );

    expect(container.querySelector('image[href*="chromatography-chamber-with-paper.svg"]')).not.toBeNull();
    expect(container.querySelector('img[src*="chromatography-paper.svg"]')).toBeNull();
    expect(container.querySelector(".chromatogram-overlay")).not.toBeNull();
  });

  it("renders a stoppered volumetric flask with the stoppered composite asset", () => {
    const flask = emptyInstance("volumetric-flask");
    const stopper = {
      ...emptyInstance("rubber-stopper-set"),
      location: "snapZone" as const,
      snapZoneId: "volumetric-flask-stopper-seat",
      interactionStatus: "snapped" as const,
    };
    const flaskProfile = getVisualProfile("volumetric-flask")!;
    const stopperSeat = flaskProfile.visualZones.find((zone) => zone.id === "volumetric-flask-stopper-seat")!;

    const { container } = render(
      <EquipmentView
        instance={flask}
        layers={[
          benchLayer(flask),
          benchLayer(stopper, stopperSeat.bounds.x, stopperSeat.bounds.y, stopperSeat.bounds.width, stopperSeat.bounds.height),
        ]}
        variant="bench"
      />,
    );

    expect(container.querySelector('image[href*="volumetric-flask-stoppered.svg"]')).not.toBeNull();
    expect(container.querySelector('img[src*="rubber-stopper-set.svg"]')).toBeNull();
    expect(container.querySelector('image[href*="rubber-stopper-set.svg"]')).toBeNull();
  });

  it("renders an inserted cuvette with the spectrophotometer composite asset", () => {
    const instrument = emptyInstance("spectrophotometer");
    const cuvette = {
      ...emptyInstance("cuvette"),
      location: "snapZone" as const,
      snapZoneId: "spectrophotometer-cuvette-slot",
      interactionStatus: "snapped" as const,
    };
    const instrumentProfile = getVisualProfile("spectrophotometer")!;
    const cuvetteSlot = instrumentProfile.visualZones.find((zone) => zone.id === "spectrophotometer-cuvette-slot")!;

    const { container } = render(
      <EquipmentView
        instance={instrument}
        layers={[
          benchLayer(instrument),
          benchLayer(cuvette, cuvetteSlot.bounds.x, cuvetteSlot.bounds.y, cuvetteSlot.bounds.width, cuvetteSlot.bounds.height),
        ]}
        variant="bench"
      />,
    );

    expect(container.querySelector('img[src*="spectrophotometer-cuvette-inserted.svg"]')).not.toBeNull();
    expect(container.querySelector('img[src*="cuvette.svg"]')).toBeNull();
    expect(container.querySelector('image[href*="cuvette.svg"]')).toBeNull();
  });

  it("renders the ring stand, clay triangle, and ajar crucible with one support composite asset", () => {
    const stand = emptyInstance("ring-stand");
    const clayTriangle = {
      ...emptyInstance("clay-triangle"),
      location: "snapZone" as const,
      snapZoneId: "ring-stand-clay-triangle-seat",
      interactionStatus: "snapped" as const,
    };
    const crucible = {
      ...emptyInstance("crucible-with-lid"),
      location: "snapZone" as const,
      snapZoneId: "ring-stand-crucible-seat",
      interactionStatus: "snapped" as const,
    };
    const standProfile = getVisualProfile("ring-stand")!;
    const claySeat = standProfile.visualZones.find((zone) => zone.id === "ring-stand-clay-triangle-seat")!;
    const crucibleSeat = standProfile.visualZones.find((zone) => zone.id === "ring-stand-crucible-seat")!;

    const { container } = render(
      <EquipmentView
        instance={stand}
        layers={[
          benchLayer(stand),
          benchLayer(clayTriangle, claySeat.bounds.x, claySeat.bounds.y, claySeat.bounds.width, claySeat.bounds.height),
          benchLayer(crucible, crucibleSeat.bounds.x, crucibleSeat.bounds.y, crucibleSeat.bounds.width, crucibleSeat.bounds.height),
        ]}
        variant="bench"
      />,
    );

    expect(container.querySelector('img[src*="ring-stand-clay-triangle-crucible-lid-ajar.svg"]')).not.toBeNull();
    expect(container.querySelector('img[src*="clay-triangle.svg"]')).toBeNull();
    expect(container.querySelector('img[src*="crucible-with-lid.svg"]')).toBeNull();
  });

  it("renders the hand-warmer composite asset selected by visual state", () => {
    const calorimeter = {
      ...emptyInstance("hand-warmer-calorimeter"),
      contents: {
        ...emptyContents(),
        visualState: "CAL-12",
      },
    };

    const { container } = render(
      <EquipmentView
        definition={equipmentById.get("hand-warmer-calorimeter")}
        instance={calorimeter}
        variant="bench"
      />,
    );

    expect(
      container.querySelector(
        'image[href*="hand-warmer-calorimeter-cal-12.svg"], img[src*="hand-warmer-calorimeter-cal-12.svg"]',
      ),
    ).not.toBeNull();
    expect(
      container.querySelector(
        'image[href*="hand-warmer-calorimeter-cal-00.svg"], img[src*="hand-warmer-calorimeter-cal-00.svg"]',
      ),
    ).toBeNull();
  });

  it("imprints a submitted initial temperature above the calorimeter thermometer", () => {
    const calorimeter = {
      ...emptyInstance("hand-warmer-calorimeter"),
      contents: {
        ...emptyContents(),
        visualState: "CAL-06",
        recordedTemperature: {
          label: "Recorded initial temperature",
          valueC: 20,
          precision: 1,
          provenance: "student-recorded" as const,
        },
      },
    };

    const { container, getByRole } = render(
      <EquipmentView
        definition={equipmentById.get("hand-warmer-calorimeter")}
        instance={calorimeter}
        variant="bench"
      />,
    );

    expect(container.querySelector("[data-recorded-temperature-imprint]")).toHaveTextContent(
      "Recorded initial temperature20.0 °C",
    );
    expect(getByRole("button")).toHaveAccessibleName(
      /Recorded initial temperature: 20\.0 °C/,
    );
  });
});

describe("EquipmentView shelf fitting and padded assets", () => {
  it("proportionally fits wide shelf scenes to the full-player art limit", () => {
    const definition = equipmentById.get("ph-paper")!;
    const profile = getVisualProfile(definition.id)!;
    const { container, getByRole } = render(
      <EquipmentView definition={definition} shelfFitMaxWidth={80} />,
    );
    const layer = container.querySelector<HTMLElement>(".equipment-layer")!;
    const button = getByRole("button");

    expect(Number.parseFloat(button.style.getPropertyValue("--equipment-width"))).toBe(80);
    expect(Number.parseFloat(layer.style.width)).toBe(80);
    expect(Number.parseFloat(layer.style.height)).toBeCloseTo(
      profile.shelfSize.height * (80 / profile.shelfSize.width),
      5,
    );
  });

  it("leaves below-limit shelf art, unconstrained row art, and bench art unchanged", () => {
    const magnet = equipmentById.get("magnet")!;
    const phPaper = equipmentById.get("ph-paper")!;
    const magnetProfile = getVisualProfile(magnet.id)!;
    const phPaperProfile = getVisualProfile(phPaper.id)!;
    const fittedShelf = render(<EquipmentView definition={magnet} shelfFitMaxWidth={80} />);
    const unconstrainedShelf = render(<EquipmentView definition={phPaper} />);
    const bench = render(
      <EquipmentView definition={phPaper} shelfFitMaxWidth={80} variant="bench" />,
    );

    expect(
      Number.parseFloat(fittedShelf.getByRole("button").style.getPropertyValue("--equipment-width")),
    ).toBe(magnetProfile.shelfSize.width);
    expect(
      Number.parseFloat(
        unconstrainedShelf.getByRole("button").style.getPropertyValue("--equipment-width"),
      ),
    ).toBe(phPaperProfile.shelfSize.width);
    expect(Number.parseFloat(bench.getByRole("button").style.getPropertyValue("--equipment-width"))).toBe(
      phPaperProfile.benchSize.width,
    );
  });

  it("renders the probe thermometer through its normalized source viewport", () => {
    const definition = equipmentById.get("probe-thermometer")!;
    const profile = getVisualProfile(definition.id)!;
    const { container, getByRole } = render(
      <EquipmentView definition={definition} variant="bench" />,
    );
    const viewport = container.querySelector("[data-asset-viewport]");
    const image = viewport?.querySelector("image");

    expect(viewport?.getAttribute("viewBox")).toBe(
      `${498 / 1254} ${49 / 1254} ${256 / 1254} ${1175 / 1254}`,
    );
    expect(image?.getAttribute("width")).toBe("1");
    expect(image?.getAttribute("height")).toBe("1");
    expect(Number.parseFloat(getByRole("button").style.getPropertyValue("--equipment-width"))).toBe(
      profile.benchSize.width,
    );
  });
});
