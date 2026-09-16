import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { actionCatalog } from "../assistant/actionCatalog";
import { interactionOperationTypes } from "../domain/interactions";
import {
  actionVerbs,
  forbiddenPublicJsonFields,
  validationTypes,
} from "../domain/validation";
import { v1EquipmentCatalog } from "../equipment/catalog";
import { v1VisualCatalog } from "../equipment/visualCatalog";
import { parseHashRoute } from "../routes";
import { createRuntimeState } from "../runtime";
import { parseImportedJson, serializeLab, serializeTechnique } from "../studio/importExport";
import { runtimeOnlyJsonKeys } from "../studio/runtimeOnlyFields";
import {
  createBundledLabHarness,
  type BundledLabHarness,
} from "./bundledLabHarness";
import baseline from "./fixtures/compatibility-baseline.v1.json";

let bundledLabHarness: BundledLabHarness | undefined;

const bundle = (): BundledLabHarness => {
  if (!bundledLabHarness) throw new Error("Bundled-lab harness is not initialized.");
  return bundledLabHarness;
};

const currentPersistenceKeys = async (): Promise<string[]> => {
  const sourceRoot = join(process.cwd(), "src");
  const keys = new Set<string>();
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "__tests__" && entry.name !== "test") await visit(path);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name)) continue;
      const source = await readFile(path, "utf8");
      for (const match of source.matchAll(/lab-studio:v\d+:[a-z0-9-]+/g)) keys.add(match[0]);
    }
  };
  await visit(sourceRoot);
  return [...keys].sort();
};

beforeEach(async () => {
  bundledLabHarness = await createBundledLabHarness();
});

afterEach(() => {
  bundledLabHarness?.dispose();
  bundledLabHarness = undefined;
});

describe("Cycle 01 chemistry compatibility baseline", () => {
  it("keeps the current public route contract", () => {
    for (const route of baseline.routes) {
      const parsed = parseHashRoute(route.hash) as unknown as Record<string, string>;
      expect(parsed.name).toBe(route.name);
      if (route.idKey && route.id) expect(parsed[route.idKey]).toBe(route.id);
    }
    expect(parseHashRoute("#/assays")).toEqual({ name: "home" });
    expect(parseHashRoute("#/causalyst")).toEqual({ name: "home" });
  });

  it("enumerates every public definition through the app loaders and initializes runtime state", async () => {
    const labSummaries = await bundle().loadLabSummaries();
    const techniqueSummaries = await bundle().loadTechniqueSummaries();

    expect(labSummaries.map(({ id, file }) => ({ id, file }))).toEqual(
      baseline.bundledContent.labs,
    );
    expect(techniqueSummaries.map(({ id, file }) => ({ id, file }))).toEqual(
      baseline.bundledContent.techniques,
    );

    const definitions = [
      ...(await Promise.all(labSummaries.map(({ id }) => bundle().loadLab(id)))),
      ...(await Promise.all(techniqueSummaries.map(({ id }) => bundle().loadTechnique(id)))),
    ];
    const initializedIds = new Set<string>();
    for (const definition of definitions) {
      const state = createRuntimeState(definition);
      expect(state.currentNodeId).toBe(definition.process.startNodeId);
      expect(state.equipmentInstances.length).toBeGreaterThan(0);
      expect(state.completedNodes).toEqual([]);
      initializedIds.add(definition.id);
    }
    expect(baseline.bundledContent.representativeRuntimeIds.every((id) => initializedIds.has(id)))
      .toBe(true);
  }, 15_000);

  it("freezes catalog counts, assistant actions, interaction types, and persistence keys", async () => {
    expect(v1EquipmentCatalog).toHaveLength(baseline.catalogs.equipmentCount);
    expect(Object.keys(v1VisualCatalog)).toHaveLength(baseline.catalogs.visualProfileCount);
    expect(Object.keys(v1VisualCatalog).sort()).toEqual(
      v1EquipmentCatalog.map(({ id }) => id).sort(),
    );
    expect(interactionOperationTypes).toEqual(baseline.unions.interactionTypes);
    expect(actionVerbs).toEqual(baseline.unions.actionVerbs);
    expect(validationTypes).toEqual(baseline.unions.validationTypes);
    expect(actionCatalog.map(({ name }) => name)).toEqual(baseline.assistantActions);
    expect(await currentPersistenceKeys()).toEqual(baseline.persistenceKeys);
  });

  it("captures current discriminator rejection and canonical sanitized exports", async () => {
    for (const schema of baseline.artifactContracts.rejectedFutureDiscriminators) {
      const result = parseImportedJson(JSON.stringify({ schema, schemaVersion: "1.0" }));
      expect(result.ok).toBe(false);
      expect(result.errors[0]).toBe(
        "Imported JSON did not match LabDefinition or TechniqueDefinition.",
      );
    }

    const lab = await bundle().loadLab("intro-filtration-demo");
    const technique = await bundle().loadTechnique("filtration");
    const unsafeLab = {
      ...lab,
      metadata: { ...lab.metadata, fileId: "remote-file-id" },
      actions: lab.actions.map((action, index) => index === 0
        ? {
            ...action,
            parameters: {
              ...action.parameters,
              assetPath: "C:/private/runtime-only.png",
              safeValue: "preserved",
            },
          }
        : action),
    } as typeof lab;
    const labExport = serializeLab(unsafeLab);
    const techniqueExport = serializeTechnique(technique);

    expect(JSON.stringify(JSON.parse(labExport), null, baseline.exportContract.indentSpaces))
      .toBe(labExport);
    expect(JSON.stringify(JSON.parse(techniqueExport), null, baseline.exportContract.indentSpaces))
      .toBe(techniqueExport);
    expect(labExport.endsWith("\n")).toBe(baseline.exportContract.trailingNewline);
    expect(labExport).toContain('"safeValue": "preserved"');
    expect(labExport).not.toContain("remote-file-id");
    expect(labExport).not.toContain("runtime-only.png");
    expect([...runtimeOnlyJsonKeys]).toEqual(baseline.exportContract.runtimeOnlyKeys);
    expect(forbiddenPublicJsonFields).toEqual(baseline.exportContract.runtimeOnlyKeys);
  });
});
