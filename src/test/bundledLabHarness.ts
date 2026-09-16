import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { vi } from "vitest";
import type { LabSetup } from "../data/labSetup";
import type { BundleSummary } from "../data/loadBundledLabs";
import type { LabDefinition, TechniqueDefinition } from "../domain/types";

type PublicResponseResolver = (relativePath: string) => Response | undefined | Promise<Response | undefined>;

export interface BundledLabHarnessOptions {
  /**
   * Intercepts a normalized public resource path before the controlled fixture reader. Return
   * `undefined` to use the fixture bytes; throw to model an offline resource failure.
   */
  resolveResponse?: PublicResponseResolver;
}

export interface BundledLabHarness {
  readonly fetch: ReturnType<typeof vi.fn>;
  readonly BundleContentError: typeof import("../data/bundleErrors").BundleContentError;
  loadLab: (id: string, setup?: LabSetup) => Promise<LabDefinition>;
  loadLabWithoutSetup: (id: string) => Promise<LabDefinition>;
  loadLabSummaries: () => Promise<BundleSummary[]>;
  loadTechnique: (id: string) => Promise<TechniqueDefinition>;
  loadTechniqueSummaries: () => Promise<BundleSummary[]>;
  readJson: <T>(relativePath: string) => Promise<T>;
  setResponse: (relativePath: string, response: () => Response | Promise<Response>) => void;
  dispose: () => void;
}

/**
 * Explicit instructor-approved fixture setups for the bundled routes that reject an empty setup.
 * They are test-only inputs: they neither alter public JSON nor stand in for learner evidence.
 */
export const bundledLabSetupFixtures: Readonly<Record<string, LabSetup>> = {
  "paper-chromatography": {
    trials: [{ solvent: "water" }, { solvent: "propanol" }],
    baselineHeightMm: 15,
    solventDepthMm: 5,
    spotVolumeMl: 0.01,
    solventVolumeMl: 10,
    spotterLoadVolumeMl: 0.1,
    paperLengthMm: 120,
    stopFrontMm: 80,
  },
  "hard-water-analysis": {
    ovenTemperatureC: 115,
    firstDurationMinutes: 12,
    coolingTemperatureC: 25,
  },
  "bonding-unknown-solids": {
    selectedProcedure: "appearance,water,conductivity,ph,ethanol,hexanes,magnet,melting,hcl,naoh",
    knownCount: 4,
    blindCount: 4,
    conductivityThresholds: 10,
    phThresholds: 7,
    meltingApparatusLimits: 150,
  },
  "quick-ache-relief-separation": {
    extractionCount: 1,
    recoveryOrder: "acidic,organic,aqueous",
    filtrationMethod: "vacuum",
    organicRecoveryMethod: "external-unheated-evaporation",
    aqueousRecoveryMethod: "external-unheated-evaporation",
    drynessCriterion: "Instructor-approved observed dry endpoint",
    coolingLimitC: 25,
    acidEndpointPh: 3,
    organicDensity: 0.9,
    aqueousDensity: 1,
  },
  // Test-only canonical setup for the configured green composition. This is never a public lab
  // default and never substitutes for learner-entered measurements.
  "green-chemistry-mixture-purification": {
    sampleMassG: 1.5,
    warmDurationMin: 1,
    heatingDurationMin: 5,
    heatingIntensity: "gentle-blue-cone",
    constantMassToleranceG: 0.005,
    maximumHeatCycles: 4,
    coolingEndpointC: 25,
    coolingSurface: "wire-gauze-on-bench",
    tareConvention: "record-crucible-plus-lid",
    minimumReplicates: 2,
  },
  "acid-base-titration": {
    titrationSetup: true,
    endpointWindowMl: 0.05,
    persistenceSeconds: 5,
    maximumIncrementMl: 1,
    indicatorVolumeMl: 0.1,
    conditioningVolumeMl: 1,
    tipPurgeMl: 0.2,
    rinseVolumeMl: 2,
    wasteProtocol: "Instructor-defined waste route required before running",
    preparationProtocol: "Instructor-defined sample preparation required before running",
    indicatorStartPh: 8.2,
    indicatorStrongPh: 10,
    standardizationRangeM: 0.002,
    sampleAMolarityM: 0.1,
    sampleBMolarityM: 0.1,
    beverageAliquotMl: 5,
    naohMolarityM: 0.1,
  },
  "beverage-acidity": {
    titrationSetup: true,
    endpointWindowMl: 0.05,
    persistenceSeconds: 5,
    maximumIncrementMl: 1,
    indicatorVolumeMl: 0.1,
    conditioningVolumeMl: 1,
    tipPurgeMl: 0.2,
    rinseVolumeMl: 2,
    wasteProtocol: "Instructor-defined waste route required before running",
    preparationProtocol: "Instructor-defined sample preparation required before running",
    indicatorStartPh: 8.2,
    indicatorStrongPh: 10,
    standardizationRangeM: 0.002,
    sampleAMolarityM: 0.1,
    sampleBMolarityM: 0.1,
    beverageAliquotMl: 5,
    naohMolarityM: 0.1,
  },
  "hydrogen-peroxide-redox-titration": {
    titrationSetup: true,
    endpointWindowMl: 0.05,
    persistenceSeconds: 5,
    maximumIncrementMl: 1,
    indicatorVolumeMl: 0.1,
    conditioningVolumeMl: 1,
    tipPurgeMl: 0.2,
    rinseVolumeMl: 2,
    wasteProtocol: "Instructor-defined waste route required before running",
    preparationProtocol: "Instructor-defined sample preparation required before running",
    indicatorStartPh: 8.2,
    indicatorStrongPh: 10,
    standardizationRangeM: 0.002,
    sampleAMolarityM: 0.1,
    sampleBMolarityM: 0.1,
    beverageAliquotMl: 5,
    naohMolarityM: 0.1,
  },
};

export const publicJsonResponse = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });

const normalizeResourcePath = (input: RequestInfo | URL): string | undefined => {
  const relative = String(input)
    .replace(/^https?:\/\/[^/]+\//, "")
    .replace(/^\.?\//, "");
  if (!relative || relative.startsWith("../") || relative.includes("/../")) return undefined;
  return relative;
};

const publicRoot = fileURLToPath(new URL("../../public/", import.meta.url));

const readPublicResource = (relativePath: string): Promise<string> =>
  readFile(join(publicRoot, relativePath), "utf8");

const setupForLab = (id: string): LabSetup | undefined => {
  const fixture = bundledLabSetupFixtures[id];
  return fixture ? structuredClone(fixture) : undefined;
};

/**
 * Create an isolated production-loader harness. Its module reset happens before importing either
 * loader, so lab and technique memoization cannot leak between tests or hide a changed response.
 */
export const createBundledLabHarness = async (
  options: BundledLabHarnessOptions = {},
): Promise<BundledLabHarness> => {
  const responses = new Map<string, () => Response | Promise<Response>>();
  const fetch = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
    const relativePath = normalizeResourcePath(input);
    if (!relativePath) return new Response("", { status: 404 });

    const override = responses.get(relativePath);
    if (override) return override();
    const resolved = await options.resolveResponse?.(relativePath);
    if (resolved) return resolved;

    try {
      return new Response(await readPublicResource(relativePath), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    } catch {
      return new Response("", { status: 404 });
    }
  });

  vi.stubGlobal("fetch", fetch);
  vi.resetModules();
  const [labs, techniques, errors] = await Promise.all([
    import("../data/loadBundledLabs"),
    import("../data/loadBundledTechniques"),
    import("../data/bundleErrors"),
  ]);

  const readJson = async <T,>(relativePath: string): Promise<T> =>
    JSON.parse(await readPublicResource(relativePath)) as T;

  return {
    fetch,
    BundleContentError: errors.BundleContentError,
    loadLab: (id, setup = setupForLab(id)) => labs.loadBundledLab(id, setup ? structuredClone(setup) : undefined),
    loadLabWithoutSetup: (id) => labs.loadBundledLab(id),
    loadLabSummaries: labs.loadBundledLabSummaries,
    loadTechnique: techniques.loadBundledTechnique,
    loadTechniqueSummaries: techniques.loadBundledTechniqueSummaries,
    readJson,
    setResponse: (relativePath, response) => responses.set(relativePath, response),
    dispose: () => {
      vi.unstubAllGlobals();
      vi.resetModules();
    },
  };
};
