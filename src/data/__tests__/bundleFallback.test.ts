import { afterEach, describe, expect, it } from "vitest";
import { demoLab } from "../../domain/fixtures";
import {
  bundledLabSetupFixtures,
  createBundledLabHarness,
  publicJsonResponse,
  type BundledLabHarness,
} from "../../test/bundledLabHarness";

let bundledLabHarness: BundledLabHarness | undefined;

describe("bundled content fallback boundary", () => {
  afterEach(() => {
    bundledLabHarness?.dispose();
    bundledLabHarness = undefined;
  });

  it("falls back to the fixture when the public bundle is unreachable", async () => {
    bundledLabHarness = await createBundledLabHarness({
      resolveResponse: () => {
        throw new TypeError("Failed to fetch");
      },
    });

    const lab = await bundledLabHarness.loadLab("intro-filtration-demo");

    // The fixture, not the migrated public file: it still carries its three embedded techniques.
    expect(lab.id).toBe(demoLab.id);
    expect(lab.actions.map((action) => action.id)).toEqual(
      demoLab.actions.map((action) => action.id),
    );
    expect(lab.techniques.map((technique) => technique.id)).toEqual([
      "measuring-volume",
      "transfer",
      "filtration",
    ]);
  });

  it("rejects a material public legacy mutation without falling back", async () => {
    bundledLabHarness = await createBundledLabHarness();
    const source = await bundledLabHarness.readJson<Record<string, unknown> & {
      actions: Array<{ id: string; atomId?: string; parameters: Record<string, unknown> }>;
    }>("techniques/paper-chromatography.json");
    const action = source.actions.find((candidate) => candidate.id === "measure-choice-acetone-1-region-1");
    if (!action) throw new Error("Expected the frozen paper-chromatography transition action.");
    delete action.atomId;
    action.parameters = {
      ...action.parameters,
      evidenceScopeId: "f03-material-change",
      bundledCatalogPolicyMode: "diagnostic",
    };
    bundledLabHarness.setResponse(
      "techniques/paper-chromatography.json",
      () => publicJsonResponse(source),
    );

    await expect(bundledLabHarness.loadTechnique("paper-chromatography")).rejects.toThrow(
      /atomId to name the atom|requires composition-owned legacyActionEffects/,
    );
  });

  it("preserves the production teacher-setup gate and rejects invalid explicit setup", async () => {
    bundledLabHarness = await createBundledLabHarness();

    await expect(
      bundledLabHarness.loadLabWithoutSetup("acid-base-titration"),
    ).rejects.toThrow("Enter the instructor-approved investigation setup before starting.");

    const invalidSetup = {
      ...bundledLabSetupFixtures["acid-base-titration"],
      endpointWindowMl: 0,
    };
    await expect(
      bundledLabHarness.loadLab("acid-base-titration", invalidSetup),
    ).rejects.toThrow(/positive instructor-approved titration settings/);
  });

  it("surfaces invalid public lab content instead of serving the fixture", async () => {
    bundledLabHarness = await createBundledLabHarness();
    bundledLabHarness.setResponse(
      "labs/intro-filtration-demo.json",
      () => publicJsonResponse({ id: "intro-filtration-demo" }),
    );

    await expect(bundledLabHarness.loadLab("intro-filtration-demo")).rejects.toBeInstanceOf(
      bundledLabHarness.BundleContentError,
    );
  });

  it("rejects duplicate public lab index identities without serving a fixture", async () => {
    bundledLabHarness = await createBundledLabHarness();
    const index = await bundledLabHarness.readJson<Array<{
      id: string;
      title: string;
      description: string;
      file?: string;
      tags?: string[];
    }>>("labs/index.json");
    const entry = index.find((candidate) => candidate.id === "intro-filtration-demo");
    if (!entry) throw new Error("Expected intro-filtration-demo in the public lab index.");
    index.push(structuredClone(entry));
    bundledLabHarness.setResponse("labs/index.json", () => publicJsonResponse(index));

    await expect(bundledLabHarness.loadLab("intro-filtration-demo")).rejects.toBeInstanceOf(
      bundledLabHarness.BundleContentError,
    );
  });

  it("rejects a non-string public technique index identity without serving a fixture", async () => {
    bundledLabHarness = await createBundledLabHarness();
    const index = await bundledLabHarness.readJson<Array<Record<string, unknown>>>("techniques/index.json");
    const entry = index.find((candidate) => candidate.id === "paper-chromatography");
    if (!entry) throw new Error("Expected paper-chromatography in the public technique index.");
    entry.id = { malformed: "paper-chromatography" };
    bundledLabHarness.setResponse("techniques/index.json", () => publicJsonResponse(index));

    await expect(bundledLabHarness.loadTechnique("paper-chromatography")).rejects.toBeInstanceOf(
      bundledLabHarness.BundleContentError,
    );
  });

  it("rejects an index-to-file lab identity mismatch without serving a fixture", async () => {
    bundledLabHarness = await createBundledLabHarness();
    const index = await bundledLabHarness.readJson<Array<{
      id: string;
      title: string;
      description: string;
      file?: string;
      tags?: string[];
    }>>("labs/index.json");
    const entry = index.find((candidate) => candidate.id === "intro-filtration-demo");
    if (!entry) throw new Error("Expected intro-filtration-demo in the public lab index.");
    entry.id = "f03-misindexed-lab";
    bundledLabHarness.setResponse("labs/index.json", () => publicJsonResponse(index));

    await expect(bundledLabHarness.loadLab("f03-misindexed-lab")).rejects.toBeInstanceOf(
      bundledLabHarness.BundleContentError,
    );
  });

  it("surfaces a mispinned technique version instead of serving the fixture", async () => {
    bundledLabHarness = await createBundledLabHarness();
    const source = await bundledLabHarness.readJson<Record<string, unknown> & {
      techniqueInstances: Array<{ techniqueId: string; version: string }>;
    }>("labs/intro-filtration-demo.json");
    source.techniqueInstances = source.techniqueInstances.map(
      (instance) => ({ ...instance, version: "9.9.9" }),
    );
    bundledLabHarness.setResponse(
      "labs/intro-filtration-demo.json",
      () => publicJsonResponse(source),
    );

    await expect(bundledLabHarness.loadLab("intro-filtration-demo")).rejects.toThrow(/pins measuring-volume@9\.9\.9/);
  });

  it("surfaces a missing referenced technique instead of serving the fixture", async () => {
    bundledLabHarness = await createBundledLabHarness();
    const source = await bundledLabHarness.readJson<Record<string, unknown> & {
      techniqueInstances: Array<{ techniqueId: string }>;
    }>("labs/intro-filtration-demo.json");
    source.techniqueInstances[0].techniqueId = "no-such-technique";
    bundledLabHarness.setResponse(
      "labs/intro-filtration-demo.json",
      () => publicJsonResponse(source),
    );

    await expect(bundledLabHarness.loadLab("intro-filtration-demo")).rejects.toBeInstanceOf(
      bundledLabHarness.BundleContentError,
    );
  });
});
