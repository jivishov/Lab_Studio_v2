import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { transferTechnique } from "../../domain/fixtures";
import type {
  ContentState,
  EquipmentInstance,
  BundledLabSourceDefinition,
  LabDefinition,
  TechniqueDefinition,
} from "../../domain/types";
import { validateBundledLabSource, validateImportedDefinition } from "../../domain/validation";
import { createRuntimeState, performRuntimeAction } from "../../runtime";
import { formatContentLabel } from "../../player/contentDisplay";
import { equipmentById } from "../catalog";
import {
  computeLiquidRenderState,
  heightFractionForVolume,
  horizontalSpanAtHeight,
  resolveLiquidStyle,
  validateLiquidVisualProfile,
} from "../liquidRendering";
import { liquidStylesByState, solidStylesByState } from "../registries";
import { resolveSolidStyle } from "../solidRendering";
import { v1VisualCatalog } from "../visualCatalog";

const content = (overrides: Partial<ContentState>): ContentState => ({
  kind: "liquid",
  label: "Water",
  volumeMl: 0,
  solutes: [],
  contamination: [],
  wetState: "dry",
  visualState: "clear-liquid",
  ...overrides,
});

const renderFor = (definitionId: string, contents: ContentState) => {
  const definition = equipmentById.get(definitionId);
  const profile = v1VisualCatalog[definitionId]?.liquidVisualProfile;
  if (!definition || !profile) throw new Error(`Missing test fixture for ${definitionId}.`);
  return computeLiquidRenderState({ contents, definition, profile });
};

const liquidContentKinds = new Set<ContentState["kind"]>(["liquid", "solution", "mixture"]);

const publicDefinitionPaths = async (): Promise<string[]> => {
  const roots = [join(process.cwd(), "public", "labs"), join(process.cwd(), "public", "techniques")];
  const files = await Promise.all(roots.map(async (root) => {
    const index = JSON.parse(await readFile(join(root, "index.json"), "utf8")) as unknown;
    if (!Array.isArray(index)) throw new Error(`Expected ${root} index.json to be an array.`);
    return index.map((entry, indexPosition) => {
      const file =
        entry && typeof entry === "object" && "file" in entry ? (entry as { file?: unknown }).file : undefined;
      if (typeof file !== "string" || !file.endsWith(".json")) {
        throw new Error(`Expected ${root} index entry ${indexPosition} to name a JSON definition file.`);
      }
      return join(root, file);
    });
  }),
  );
  return files.flat().sort();
};

const collectInitialEquipment = (
  definition: BundledLabSourceDefinition | LabDefinition | TechniqueDefinition,
): Array<{ source: string; instance: EquipmentInstance }> => {
  if (!("techniques" in definition)) {
    return definition.initialState.equipment.map((instance) => ({
      source: `${definition.id}.initialState`,
      instance,
    }));
  }

  return [
    ...(definition.initialState?.equipment ?? []).map((instance) => ({
      source: `${definition.id}.initialState`,
      instance,
    })),
    ...definition.techniques.flatMap((technique) =>
      technique.initialState.equipment.map((instance) => ({
        source: `${definition.id}.${technique.id}.initialState`,
        instance,
      })),
    ),
  ];
};

const hasRenderableLiquid = (contents: ContentState): boolean =>
  liquidContentKinds.has(contents.kind) || typeof contents.volumeMl === "number";

const isBundledLabSource = (input: unknown): boolean =>
  Boolean(
    input &&
      typeof input === "object" &&
      ("techniqueRefs" in input || "techniqueInstances" in input),
  );

describe("liquid rendering", () => {
  it("interpolates calibrated stops and clamps invalid fractions", () => {
    expect(heightFractionForVolume([
      { volumeFraction: 0, heightFraction: 0 },
      { volumeFraction: 0.5, heightFraction: 0.25 },
      { volumeFraction: 1, heightFraction: 1 },
    ], 0.25)).toBeCloseTo(0.125);
    expect(heightFractionForVolume([
      { volumeFraction: 0, heightFraction: 0 },
      { volumeFraction: 1, heightFraction: 1 },
    ], 1.5)).toBe(1);
  });

  it("keeps graduated cylinders linear while flasks use nonlinear calibration", () => {
    const cylinder = renderFor("graduated-cylinder", content({ volumeMl: 20 }));
    const flask = renderFor("erlenmeyer-flask-250ml", content({ volumeMl: 50 }));

    expect(cylinder?.heightFraction).toBeCloseTo(0.2);
    expect(cylinder?.profile.liquidLayerMode).toBe("over-asset");
    expect(cylinder?.profile.region.width).toBeGreaterThanOrEqual(18);
    expect(cylinder?.meniscus?.rx).toBeGreaterThan(8);
    expect(flask?.profile.liquidLayerMode).toBe("over-asset");
    expect(flask?.profile.overlayViability).toMatchObject({
      interior: "opaque",
      strategy: "over-asset",
    });
    expect(flask?.heightFraction).not.toBeCloseTo(0.2);
    expect(flask?.heightFraction).toBeLessThan(0.2);
  });

  it("centers meniscus on the profiled surface span instead of the rectangular region", () => {
    const washBottle = renderFor("wash-bottle", content({ volumeMl: 500 }));
    if (!washBottle?.meniscus) throw new Error("Expected rendered wash bottle meniscus.");
    const span = horizontalSpanAtHeight(washBottle.profile, washBottle.surface.heightFraction);

    expect(washBottle.surface).toMatchObject(span);
    expect(washBottle.meniscus.cx).toBeCloseTo(span.centerX);
    expect(washBottle.meniscus.cx).toBeGreaterThan(
      washBottle.profile.region.x + washBottle.profile.region.width / 2,
    );
    expect(washBottle.meniscus.rx).toBeLessThan(washBottle.profile.region.width / 2);
  });

  it("renders volumetric flask liquid through a visible masked overlay", () => {
    const flask = renderFor("volumetric-flask", content({ volumeMl: 80 }));
    const full = renderFor("volumetric-flask", content({ volumeMl: 100 }));
    if (!flask?.meniscus) throw new Error("Expected rendered volumetric flask meniscus.");
    if (!full) throw new Error("Expected rendered full volumetric flask.");
    const profileErrors = validateLiquidVisualProfile(flask.profile);
    const span = horizontalSpanAtHeight(flask.profile, flask.surface.heightFraction);
    const fullSpan = horizontalSpanAtHeight(full.profile, full.surface.heightFraction);

    expect(profileErrors).toEqual([]);
    expect(flask.profile.liquidLayerMode).toBe("within-svg-mask");
    expect(flask.profile.overlayViability).toMatchObject({
      interior: "opaque",
      strategy: "within-svg-mask",
    });
    expect(flask.clipPath).toContain("C");
    expect(flask.bodyPath).not.toBe(flask.clipPath);
    expect(flask.heightFraction).toBeCloseTo(0.59);
    expect(flask.surface.y).toBeCloseTo(78.6);
    expect(full.surface.y).toBeCloseTo(full.profile.calibrationMarkY ?? 0);
    expect(span.width).toBeGreaterThan(fullSpan.width);
    expect(span.width).toBeGreaterThan(12);
    expect(span.width).toBeLessThan(16);
    expect(flask.meniscus.cx).toBeCloseTo(span.centerX);
    expect(flask.meniscus.cx - flask.meniscus.rx).toBeGreaterThan(span.leftX);
    expect(flask.meniscus.cx + flask.meniscus.rx).toBeLessThan(span.rightX);
  });

  it("renders final-volume volumetric dilutions at the calibration mark", () => {
    const partial = renderFor("volumetric-flask", content({ volumeMl: 9.5 }));
    const final = renderFor("volumetric-flask", content({ volumeMl: 10, finalVolumeMl: 10 }));
    const invalidFinalVolume = renderFor("volumetric-flask", content({ volumeMl: 10, finalVolumeMl: 0 }));
    const definition = equipmentById.get("volumetric-flask")!;
    const profile = v1VisualCatalog["volumetric-flask"].liquidVisualProfile!;
    const explicitOverride = computeLiquidRenderState({
      contents: content({ volumeMl: 10, finalVolumeMl: 10 }),
      definition,
      profile: { ...profile, visualCapacityOverrideMl: 20 },
    });

    expect(partial?.capacityMl).toBe(100);
    expect(partial?.heightFraction).toBeLessThan(1);
    expect(partial?.surface.y ?? 0).toBeGreaterThan(partial?.profile.calibrationMarkY ?? 0);
    expect(final?.capacityMl).toBe(10);
    expect(final?.volumeFraction).toBe(1);
    expect(final?.heightFraction).toBe(1);
    expect(final?.surface.y).toBeCloseTo(final?.profile.calibrationMarkY ?? 0);
    expect(invalidFinalVolume?.capacityMl).toBe(100);
    expect(explicitOverride?.capacityMl).toBe(20);
    expect(explicitOverride?.volumeFraction).toBe(0.5);
  });

  it("renders burette remaining volume bottom-up", () => {
    const full = renderFor("burette-50ml", content({ volumeMl: 50 }));
    const half = renderFor("burette-50ml", content({ volumeMl: 25 }));
    const low = renderFor("burette-50ml", content({ volumeMl: 5 }));

    expect(full?.surfaceY).toBeLessThan(half?.surfaceY ?? 0);
    expect(half?.surfaceY).toBeLessThan(low?.surfaceY ?? 0);
    expect(low?.bottomY).toBe(full?.bottomY);
  });

  it("lets an authored visual state beat the definition-id and reagent fallbacks", () => {
    // Cycle 05 inverted this. Before, the phenolphthalein definition-id override won and the
    // authored clear-liquid state was discarded — the defect that drew three dye and analyte samples
    // as plain water.
    const style = resolveLiquidStyle(
      content({ label: "Phenolphthalein", visualState: "clear-liquid", volumeMl: 10 }),
      equipmentById.get("phenolphthalein-dropper"),
    );

    expect(style.fill).toBe(liquidStylesByState.get("clear-liquid")?.fill);
  });

  it("applies the definition-id fallback only when no state is authored", () => {
    const dropper = equipmentById.get("phenolphthalein-dropper");
    const unstated = resolveLiquidStyle(
      content({ label: "Phenolphthalein", visualState: undefined, volumeMl: 10 }),
      dropper,
    );

    expect(unstated.fill).toBe(liquidStylesByState.get("phenolphthalein")?.fill);
  });

  it("applies the reagent-keyword fallback only when no state is authored", () => {
    const bottle = equipmentById.get("reagent-bottle");
    const unstated = resolveLiquidStyle(
      content({ label: "0.100 M NaOH", visualState: undefined, volumeMl: 25 }),
      bottle,
    );

    expect(unstated.fill).toBe(liquidStylesByState.get("naoh")?.fill);
  });

  it("resolves an authored liquid state before consulting container heuristics", () => {
    const sampleBottle = equipmentById.get("sample-bottle");
    const style = resolveLiquidStyle(
      content({ label: "Crystal violet stock", visualState: "purple-solution", volumeMl: 20 }),
      sampleBottle,
    );

    expect(style.fill).toBe(liquidStylesByState.get("purple-solution")?.fill);
    expect(style.fill).not.toBe(liquidStylesByState.get("sample-bottle-water")?.fill);
  });

  it("resolves solid states through the registry", () => {
    const damp = resolveSolidStyle(content({ kind: "precipitate", visualState: "damp-precipitate" }));
    const brass = resolveSolidStyle(content({ kind: "solid", visualState: "brass-sample" }));

    expect(damp).toEqual(solidStylesByState.get("damp-precipitate"));
    expect(brass).toEqual(solidStylesByState.get("brass-sample"));
    // The dryness stages must stay perceptually ordered without becoming a mass readout.
    expect(damp.fill).not.toBe(solidStylesByState.get("broken-dry-precipitate")?.fill);
  });

  it("handles imported content states that omit optional display labels", () => {
    const unlabeledEmpty = {
      kind: "empty",
      solutes: [],
      contamination: [],
      wetState: "dry",
      visualState: "empty",
    } as unknown as ContentState;
    const unlabeledLiquid = {
      ...unlabeledEmpty,
      kind: "liquid",
      volumeMl: 5,
      visualState: "clear-liquid",
    } as ContentState;

    expect(() =>
      resolveLiquidStyle(unlabeledEmpty, equipmentById.get("chromatography-chamber")),
    ).not.toThrow();
    expect(() => resolveLiquidStyle(unlabeledLiquid)).not.toThrow();
    expect(formatContentLabel(unlabeledEmpty)).toBe("empty");
    expect(formatContentLabel(unlabeledLiquid)).toBe("5 mL");
  });

  it("keeps titration mixtures clear until endpoint visual state changes", () => {
    const style = resolveLiquidStyle(
      content({
        label: "Unknown acid + Phenolphthalein indicator",
        visualState: "titration-clear",
        volumeMl: 25.2,
      }),
      equipmentById.get("erlenmeyer-flask-250ml"),
    );

    expect(style.fill).toContain("86, 174, 206");
  });

  it("exposes overcapacity without exceeding the visual fill", () => {
    const state = renderFor("graduated-cylinder", content({ volumeMl: 120 }));

    expect(state?.heightFraction).toBe(1);
    expect(state?.overCapacity).toMatchObject({
      show: true,
      amountMl: 20,
      severity: "major",
    });
  });

  it("renders finalVolumeMl when volumeMl is absent", () => {
    const state = renderFor("volumetric-flask", {
      kind: "solution",
      label: "Diluted solution",
      finalVolumeMl: 100,
      solutes: [],
      contamination: [],
      wetState: "wet",
      visualState: "clear-solution",
    });

    expect(state?.volumeMl).toBe(100);
    expect(state?.heightFraction).toBe(1);
    expect(state?.surface.y).toBeCloseTo(state?.profile.calibrationMarkY ?? 0);
  });

  it("renders 120 mL in a 125 mL sample bottle as nearly full", () => {
    const state = renderFor("sample-bottle", content({ label: "Hard water sample", volumeMl: 120 }));

    expect(state?.capacityMl).toBe(125);
    expect(state?.volumeFraction).toBeCloseTo(0.96);
    expect(state?.heightFraction).toBeGreaterThan(0.9);
  });

  it("returns non-renderable state instead of crashing without mL capacity", () => {
    const definition = equipmentById.get("watch-glass")!;
    const profile = v1VisualCatalog["graduated-cylinder"].liquidVisualProfile!;
    const state = computeLiquidRenderState({
      contents: content({ volumeMl: 5 }),
      definition,
      profile,
    });

    expect(state?.isRenderable).toBe(false);
    expect(state?.reason).toBe("missing-capacity");
  });

  it("rejects invalid liquid profile calibration", () => {
    const base = v1VisualCatalog["graduated-cylinder"].liquidVisualProfile!;
    const errors = validateLiquidVisualProfile({
      ...base,
      calibrationStops: [
        { volumeFraction: 0, heightFraction: 0 },
        { volumeFraction: 0.6, heightFraction: 0.4 },
        { volumeFraction: 0.5, heightFraction: 0.5 },
        { volumeFraction: 1, heightFraction: 1 },
      ],
    });

    expect(errors.join(" ")).toContain("volume stops must increase");
  });

  it("connects runtime transfer volume changes to render state", () => {
    const placed = performRuntimeAction(transferTechnique, createRuntimeState(transferTechnique), {
      actionId: "place-beaker",
      verb: "place",
    });
    const transferred = performRuntimeAction(transferTechnique, placed, {
      actionId: "transfer-sample",
      verb: "transfer",
      sourceInstanceId: "graduated-cylinder-1",
      targetInstanceId: "beaker-250ml-1",
    });

    const source = renderFor("graduated-cylinder", transferred.contents["graduated-cylinder-1"]);
    const target = renderFor("beaker-250ml", transferred.contents["beaker-250ml-1"]);

    expect(source?.isRenderable).toBe(false);
    expect(source?.volumeMl).toBe(0);
    expect(target?.isRenderable).toBe(true);
    expect(target?.volumeMl).toBe(20);
  });

  it("renders a synthetic post-drop titration state through the existing visual profiles", () => {
    // The bundled route now keeps delivery behind configured notebook steps. This is intentionally
    // a renderer-only state fixture, not an attempt to bypass that route's approval gates.
    const source = renderFor("burette-50ml", content({ label: "Titrant", volumeMl: 49.95 }));
    const target = renderFor(
      "erlenmeyer-flask-250ml",
      content({
        label: "Unknown acid + Phenolphthalein indicator",
        visualState: "titration-clear",
        volumeMl: 25.25,
      }),
    );

    expect(source?.isRenderable).toBe(true);
    expect(source?.volumeMl).toBe(49.95);
    expect(target?.isRenderable).toBe(true);
    expect(target?.volumeMl).toBe(25.25);
  });

  it("keeps bundled liquid-bearing template states backed by clipped visual profiles", async () => {
    const checked: string[] = [];

    for (const filePath of await publicDefinitionPaths()) {
      const input = JSON.parse(await readFile(filePath, "utf8")) as unknown;
      const validation = isBundledLabSource(input)
        ? validateBundledLabSource(input)
        : validateImportedDefinition(input);
      expect(validation.ok, validation.errors.join("\n")).toBe(true);
      if (!validation.ok || !validation.value) throw new Error(validation.errors.join("\n"));

      for (const { source, instance } of collectInitialEquipment(validation.value)) {
        if (!hasRenderableLiquid(instance.contents)) continue;

        const prefix = `${filePath} ${source} ${instance.id}`;
        expect(instance.contents.kind, `${prefix} contents.kind`).toSatisfy((kind: string) =>
          liquidContentKinds.has(kind as ContentState["kind"]),
        );
        expect(instance.contents.volumeMl, `${prefix} contents.volumeMl`).toEqual(expect.any(Number));
        expect(instance.contents.visualState, `${prefix} contents.visualState`).toEqual(expect.any(String));

        const definition = equipmentById.get(instance.definitionId);
        const visualProfile = v1VisualCatalog[instance.definitionId];
        if (visualProfile?.noLiquidRender) continue;
        const profile = visualProfile?.liquidVisualProfile;
        expect(definition, `${prefix} equipment definition`).toBeDefined();
        expect(profile, `${prefix} liquid visual profile`).toBeDefined();
        if (!definition || !profile) continue;
        if (definition.capacity.unit === "mL") {
          expect(instance.contents.volumeMl, `${prefix} initial volume fits container`).toBeLessThanOrEqual(
            definition.capacity.amount,
          );
        }

        const state = computeLiquidRenderState({
          contents: instance.contents,
          definition,
          profile,
        });
        expect(state?.isRenderable, `${prefix} renderable liquid`).toBe(true);
        expect(state?.bodyPath, `${prefix} body path`).toMatch(/^M/);
        expect(state?.clipPath, `${prefix} clip path`).toMatch(/^M/);
        expect(state?.surface.leftX, `${prefix} surface left`).toBeGreaterThanOrEqual(profile.region.x);
        expect(state?.surface.rightX, `${prefix} surface right`).toBeLessThanOrEqual(
          profile.region.x + profile.region.width,
        );
        if (state?.meniscus) {
          expect(state.meniscus.cx - state.meniscus.rx, `${prefix} meniscus left`).toBeGreaterThanOrEqual(
            state.surface.leftX - 0.001,
          );
          expect(state.meniscus.cx + state.meniscus.rx, `${prefix} meniscus right`).toBeLessThanOrEqual(
            state.surface.rightX + 0.001,
          );
        }
        checked.push(`${source}:${instance.definitionId}`);
      }
    }

    // The loader consumes these indexes, so the loop above checks every canonical bundled source;
    // keep representative entries to catch an accidentally empty traversal without duplicating a
    // second, stale inventory of author-controlled catalog files.
    expect(checked).toEqual(
      expect.arrayContaining([
        "acid-base-titration.initialState:unknown-acid-bottle",
        "paper-chromatography.initialState:distilled-water-bottle",
        "dilution.initialState:graduated-cylinder",
      ]),
    );
  });
});
