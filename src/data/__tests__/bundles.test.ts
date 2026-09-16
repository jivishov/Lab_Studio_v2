import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { standaloneTechniques } from "../../domain/fixtures";
import {
  validatePublicJsonForPublishing,
} from "../../domain/validation";
import type { ActionDefinition, ValidationResult } from "../../domain/types";
import {
  createBundledLabHarness,
  type BundledLabHarness,
} from "../../test/bundledLabHarness";

let bundledLabHarness: BundledLabHarness | undefined;

const bundle = (): BundledLabHarness => {
  if (!bundledLabHarness) throw new Error("Bundled-lab harness is not initialized.");
  return bundledLabHarness;
};

const normalizeAuthoredContent = (value: unknown): unknown =>
  JSON.parse(
    JSON.stringify(value, (key, child) =>
      [
        "assetUrl",
        "resolvedAssetUrl",
        "assetHash",
        "fileId",
        "naturalWidth",
        "naturalHeight",
        "imageElement",
        "_runtime",
        "_resolved",
      ].includes(key)
        ? undefined
        : child,
    ),
  );

const actionSurface = (actions: ActionDefinition[]) =>
  actions.map((action) => ({
    id: action.id,
    verb: action.verb,
    parameters: action.parameters,
    prerequisites: action.prerequisites,
  }));

type PublishedTechniqueSource = {
  requiredEquipment?: string[];
  actions?: ActionDefinition[];
};

describe("public bundle loading", () => {
  beforeEach(async () => {
    bundledLabHarness = await createBundledLabHarness();
  });

  afterEach(() => {
    bundledLabHarness?.dispose();
    bundledLabHarness = undefined;
  });

  it("loads every public lab through the route loader path", async () => {
    const summaries = await bundle().loadLabSummaries();
    expect(summaries.length).toBeGreaterThan(0);
    for (const summary of summaries) {
      const lab = await bundle().loadLab(summary.id);
      expect(lab.id).toBe(summary.id);
    }
  });

  it("loads every public technique through the route loader path", async () => {
    const summaries = await bundle().loadTechniqueSummaries();
    expect(summaries.length).toBeGreaterThan(0);
    for (const summary of summaries) {
      const technique = await bundle().loadTechnique(summary.id);
      expect(technique.id).toBe(summary.id);
    }
  });

  it("keeps public JSON free of runtime-only fields", async () => {
    const labSummaries = await bundle().loadLabSummaries();
    const techniqueSummaries = await bundle().loadTechniqueSummaries();
    const validations: ValidationResult<unknown>[] = [];
    for (const summary of labSummaries) {
      validations.push(
        validatePublicJsonForPublishing(
          await bundle().readJson(`labs/${summary.file ?? `${summary.id}.json`}`),
        ),
      );
    }
    for (const summary of techniqueSummaries) {
      validations.push(
        validatePublicJsonForPublishing(
          await bundle().readJson(`techniques/${summary.file ?? `${summary.id}.json`}`),
        ),
      );
    }
    expect(validations.flatMap((result) => result.errors)).toEqual([]);
  });

  it("keeps the public-imported fixture sources in parity without treating legacy fallbacks as authoring sources", async () => {
    const publicImportedFixtureIds = new Set([
      "transmittance-dilution",
      "thermal-decomposition-mass-loss",
    ]);
    const publicTechniques = new Map(
      await Promise.all(
        standaloneTechniques
          .filter((fixture) => publicImportedFixtureIds.has(fixture.id))
          .map(async (fixture) => [
          fixture.id,
          await bundle().readJson<PublishedTechniqueSource>(`techniques/${fixture.id}.json`),
          ] as const),
      ),
    );
    for (const fixture of standaloneTechniques.filter((candidate) => publicImportedFixtureIds.has(candidate.id))) {
      const publicTechnique = publicTechniques.get(fixture.id);
      expect([...(publicTechnique?.requiredEquipment ?? [])].sort()).toEqual(
        [...fixture.requiredEquipment].sort(),
      );
      expect(publicTechnique?.actions?.map((action) => action.id)).toEqual(
        fixture.actions.map((action) => action.id),
      );
      expect(normalizeAuthoredContent(actionSurface(publicTechnique?.actions ?? []))).toEqual(
        normalizeAuthoredContent(actionSurface(fixture.actions)),
      );
    }
  });

  it("materializes the filtration composition instances through the public loader", async () => {
    const source = await bundle().readJson<{
      techniques: unknown[];
      techniqueInstances: { instanceId: string; techniqueId: string; version: string }[];
      actions: { id: string }[];
      process: { nodes: { id: string }[]; edges: unknown[] };
      initialState: { equipment: { id: string }[] };
    }>("labs/intro-filtration-demo.json");
    expect(source.techniques).toEqual([]);
    expect(source.techniqueInstances.map((instance) => instance.techniqueId)).toEqual([
      "measuring-volume",
      "transfer",
      "hard-water-precipitation",
      "filtration",
    ]);
    expect(source.actions).toEqual([]);
    expect(source.process.nodes).toEqual([]);

    const lab = await bundle().loadLab("intro-filtration-demo");
    expect([...lab.actions.map((action) => action.id)].sort()).toEqual([
      "assemble-funnel-stand",
      "filter-mixture",
      "measure-20ml",
      "observe-transfer",
      "place-cylinder",
      "place-beaker",
      "place-filter-paper",
      "place-filtration-receiver",
      "precipitate-caco3",
      "record-volume",
      "transfer-sample",
      "rinse-precipitate",
      "wet-filter-paper",
    ].sort());
    expect(lab.techniques).toEqual([]);
    expect(lab.process.nodes.map((node) => node.actionId).sort()).toEqual(
      lab.actions.map((action) => action.id).sort(),
    );
    expect(lab.initialState?.equipment.map((instance) => instance.id).sort()).toEqual(
      source.initialState.equipment.map((instance) => instance.id).sort(),
    );
  });

  it("loads the Quick Ache public technique when its mass producers are proved exclusive", async () => {
    const technique = await bundle().loadTechnique("quick-ache-extraction-recovery");
    const filterPaperMassProducers = technique.actions.filter(
      (action) => action.mass?.source === "action-input" &&
        action.mass.outputMeasurementId === "qar-filter-paper-mass",
    );

    expect(filterPaperMassProducers.map((action) => action.id).sort()).toEqual([
      "plan-gravity-qar-weigh-filter-paper-tare",
      "qar-weigh-filter-paper-tare",
    ]);
  });
});
