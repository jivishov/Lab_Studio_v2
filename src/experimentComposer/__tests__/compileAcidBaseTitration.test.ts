import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { validateLabDefinition } from "../../domain/validation";
import {
  bundledLabSetupFixtures,
  createBundledLabHarness,
  type BundledLabHarness,
} from "../../test/bundledLabHarness";
import { acidBaseTitrationFamily, defaultLabInventory } from "../catalogs";
import {
  compileAcidBaseTitration,
  P0_ACTION_IDS,
  P0_NODE_IDS,
} from "../compileAcidBaseTitration";
import { stableDraftFingerprint } from "../fingerprint";
import { validExperimentRequest } from "./validateExperimentRequest.test";

let bundledLabHarness: BundledLabHarness | undefined;

const loadVerifiedSource = async () => {
  if (!bundledLabHarness) throw new Error("Bundled-lab harness is not initialized.");
  return bundledLabHarness.loadLab(
    "acid-base-titration",
    bundledLabSetupFixtures["acid-base-titration"],
  );
};

describe("verified acid-base P0 compiler", () => {
  beforeEach(async () => {
    bundledLabHarness = await createBundledLabHarness();
  });

  afterEach(() => {
    bundledLabHarness?.dispose();
    bundledLabHarness = undefined;
  });

  it("compiles the deterministic indicator-only graph and passes current validators", async () => {
    const currentDraft = await loadVerifiedSource();
    const provenance = currentDraft.compositionManifest?.origins.filter((origin) =>
      P0_ACTION_IDS.includes(origin.actionId as (typeof P0_ACTION_IDS)[number]),
    );
    expect(currentDraft.metadata.version).toBe(acidBaseTitrationFamily.sourceLabVersion);
    expect(provenance).toHaveLength(P0_ACTION_IDS.length);
    expect(provenance).toEqual(P0_ACTION_IDS.map((actionId, index) => expect.objectContaining({
      actionId,
      nodeId: P0_NODE_IDS[index],
      sourceActionId: actionId,
      sourceNodeId: P0_NODE_IDS[index],
      techniqueId: acidBaseTitrationFamily.sourceTechniqueId,
      techniqueVersion: acidBaseTitrationFamily.sourceTechniqueVersion,
    })));
    const result = await compileAcidBaseTitration(
      validExperimentRequest(),
      defaultLabInventory(),
      currentDraft,
      { stageRevision: 1, createdAt: "2026-08-29T18:00:00.000Z", loadSource: loadVerifiedSource },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.stage.definition.actions.map((action) => action.id)).toEqual(P0_ACTION_IDS);
    expect(result.stage.definition.process.nodes.map((node) => node.id)).toEqual(P0_NODE_IDS);
    expect(result.stage.definition.process.nodes.map((node) => node.actionId)).toEqual(P0_ACTION_IDS);
    expect(result.stage.definition.actions.some((action) => action.id.includes("ph"))).toBe(false);
    expect(result.stage.definition.equipment).not.toContain("ph-meter");
    expect(JSON.stringify(result.stage.definition)).not.toContain("ph-meter");
    expect(JSON.stringify(result.stage.definition)).not.toContain("funnel");
    expect(result.stage.definition.compositionManifest).toBeUndefined();
    const initialRead = result.stage.definition.actions.find((action) => action.id === "read-initial-burette")!;
    expect(initialRead).toMatchObject({
      verb: "measureVolume",
      atomId: "atom.measure.read-burette",
      interaction: { type: "readInstrument", sourceDefinitionId: "burette-50ml" },
    });
    expect(initialRead.parameters).toMatchObject({
      measurementId: "burette-initial-volume",
      readingPrecisionMl: 0.05,
      scaleReadsDownward: true,
    });
    expect(initialRead.prerequisites).toEqual([expect.objectContaining({ actionId: "mount-burette" })]);
    expect(initialRead.parameters).not.toHaveProperty("requiredAttachmentState");
    expect(initialRead.invalidCases.map((invalidCase) => invalidCase.id)).not.toContain("funnel-still-present");
    const initialRecord = result.stage.definition.actions.find((action) => action.id === "record-initial-burette")!;
    expect(initialRecord.parameters.copyExistingMeasurementOnly).toBe(true);
    const deliver = result.stage.definition.actions.find((action) => action.id === "deliver-titrant")!;
    expect(deliver).toMatchObject({
      interaction: {
        type: "dispenseDrops",
        sourceDefinitionId: "burette-50ml",
        targetDefinitionId: "erlenmeyer-flask-250ml",
      },
      parameters: {
        initialBuretteMeasurementId: "burette-initial-volume",
        finalBuretteMeasurementId: "burette-final-volume",
      },
    });
    ["titrationOperation", "meterInstanceId", "readinessNotebookTag", "inputRequired"].forEach(
      (parameter) => expect(deliver.parameters).not.toHaveProperty(parameter),
    );
    expect(result.stage.definition.process.nodes.find((node) => node.id === "deliver-titrant-node")?.validation)
      .toEqual([expect.objectContaining({
        type: "statePath",
        path: "dropDispenses.deliver-titrant.accepted",
        equals: true,
      })]);
    expect(deliver.feedback.invalid.toLowerCase()).not.toContain("fill the burette");
    expect(validateLabDefinition(result.stage.definition).ok).toBe(true);
  });

  it("rejects source graph drift instead of silently changing action/node provenance", async () => {
    const currentDraft = await loadVerifiedSource();
    const driftedSource = structuredClone(currentDraft);
    driftedSource.process.nodes.find((node) => node.id === "measure-acid-node")!.actionId = "add-indicator";
    const result = await compileAcidBaseTitration(
      validExperimentRequest(),
      defaultLabInventory(),
      currentDraft,
      { stageRevision: 1, loadSource: async () => driftedSource },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.code).toBe("COMPILED_DEFINITION_INVALID");
    expect(result.issues[0]?.message).toContain("measure-acid-node");
  });

  it("rejects a composition origin from a different pinned technique revision", async () => {
    const currentDraft = await loadVerifiedSource();
    const driftedSource = structuredClone(currentDraft);
    const origin = driftedSource.compositionManifest?.origins.find(
      (candidate) => candidate.actionId === "mount-burette" && candidate.nodeId === "mount-burette-node",
    );
    if (!origin) throw new Error("Expected the mounted-burette composition origin.");
    origin.techniqueVersion = "3.0.0";

    const result = await compileAcidBaseTitration(
      validExperimentRequest(),
      defaultLabInventory(),
      currentDraft,
      { stageRevision: 1, loadSource: async () => driftedSource },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]).toMatchObject({ code: "COMPILED_DEFINITION_INVALID" });
    expect(result.issues[0]?.message).toContain("mount-burette");
    expect(result.issues[0]?.message).toContain("titration-endpoint@3.0.1");
  });

  it("clones a cached hydrated source before every compiler rewrite", async () => {
    const cachedSource = await loadVerifiedSource();
    const before = structuredClone(cachedSource);
    const result = await compileAcidBaseTitration(
      validExperimentRequest({ aliquotVolumeMl: 10 }),
      defaultLabInventory(),
      cachedSource,
      { stageRevision: 1, loadSource: async () => cachedSource },
    );
    expect(result.ok).toBe(true);
    expect(cachedSource).toEqual(before);
    if (!result.ok) return;
    expect(result.stage.definition).not.toBe(cachedSource);
    expect(result.stage.definition.actions[0]).not.toBe(cachedSource.actions[0]);
  });

  it("computes dimensionally correct solute moles and conserves NaOH allocation", async () => {
    const currentDraft = await loadVerifiedSource();
    const inventory = defaultLabInventory();
    const result = await compileAcidBaseTitration(
      validExperimentRequest(),
      inventory,
      currentDraft,
      { stageRevision: 1, loadSource: loadVerifiedSource },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const instances = result.stage.definition.initialState!.equipment;
    const acid = instances.find((item) => item.definitionId === "unknown-acid-bottle")!;
    expect(acid.contents.solutes[0]?.amount).toBeCloseTo(0.0992 * 0.12, 12);
    const naohMoles = instances
      .filter((item) => item.definitionId === "naoh-bottle" || item.definitionId === "burette-50ml")
      .flatMap((item) => item.contents.solutes)
      .reduce((sum, solute) => sum + solute.amount, 0);
    expect(naohMoles).toBeCloseTo(0.1 * 0.12, 12);
  });

  it("materially changes working state for a supported aliquot variant", async () => {
    const currentDraft = await loadVerifiedSource();
    const inventory = defaultLabInventory();
    const small = await compileAcidBaseTitration(
      validExperimentRequest({ aliquotVolumeMl: 10 }),
      inventory,
      currentDraft,
      { stageRevision: 1, loadSource: loadVerifiedSource },
    );
    const large = await compileAcidBaseTitration(
      validExperimentRequest({ aliquotVolumeMl: 25 }),
      inventory,
      currentDraft,
      { stageRevision: 1, loadSource: loadVerifiedSource },
    );
    expect(small.ok && large.ok).toBe(true);
    if (!small.ok || !large.ok) return;
    const smallModel = small.stage.definition.titrationModels![0];
    const largeModel = large.stage.definition.titrationModels![0];
    expect(smallModel.analyteVolumeMl).toBe(10);
    expect(largeModel.analyteVolumeMl).toBe(25);
    expect(small.stage.stageId).not.toBe(large.stage.stageId);
  });

  it("materially changes the derived drop plan and initial state for supported NaOH variants", async () => {
    const currentDraft = await loadVerifiedSource();
    const diluteInventory = defaultLabInventory();
    diluteInventory.chemicals.find((item) => item.chemicalId === "standardized_naoh")!.concentrationM = 0.05;
    const concentratedInventory = defaultLabInventory();
    concentratedInventory.chemicals.find((item) => item.chemicalId === "standardized_naoh")!.concentrationM = 0.2;
    const dilute = await compileAcidBaseTitration(
      validExperimentRequest(),
      diluteInventory,
      currentDraft,
      { stageRevision: 1, loadSource: loadVerifiedSource },
    );
    const concentrated = await compileAcidBaseTitration(
      validExperimentRequest(),
      concentratedInventory,
      currentDraft,
      { stageRevision: 1, loadSource: loadVerifiedSource },
    );
    expect(dilute.ok && concentrated.ok).toBe(true);
    if (!dilute.ok || !concentrated.ok) return;
    const diluteDispense = dilute.stage.definition.actions.find((action) => action.id === "deliver-titrant")!;
    const concentratedDispense = concentrated.stage.definition.actions.find((action) => action.id === "deliver-titrant")!;
    expect(diluteDispense.parameters.endpointDropCount)
      .not.toBe(concentratedDispense.parameters.endpointDropCount);
    const diluteBurette = dilute.stage.definition.initialState!.equipment
      .find((item) => item.definitionId === "burette-50ml")!;
    const concentratedBurette = concentrated.stage.definition.initialState!.equipment
      .find((item) => item.definitionId === "burette-50ml")!;
    expect(diluteBurette.contents.solutes[0]?.amount)
      .not.toBe(concentratedBurette.contents.solutes[0]?.amount);
  });

  it("sanitizes public output and stabilizes stripped/key-sorted fingerprints", async () => {
    const currentDraft = await loadVerifiedSource();
    expect(stableDraftFingerprint({ b: 2, a: 1, runtimeId: "hidden" }))
      .toBe(stableDraftFingerprint({ a: 1, b: 2 }));
    const result = await compileAcidBaseTitration(
      validExperimentRequest(),
      defaultLabInventory(),
      currentDraft,
      { stageRevision: 1, loadSource: loadVerifiedSource },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const publicJson = JSON.stringify(result.summary);
    [
      "analyteMolarityM",
      "endpointDropCount",
      "expectedAnalyteMolarityM",
      "sourceDraftFingerprint",
      "definition",
      "fnv1a",
    ].forEach((hiddenKey) => expect(publicJson).not.toContain(hiddenKey));
    expect(result.stage.stageId).toMatch(/^stage-v1-r1-[0-9a-f]{8}$/);
    expect(result.stage.sourceDraftFingerprint).toMatch(/^draft-fnv1a-[0-9a-f]{8}$/);
    expect(result.summary.fidelity.limitations.some((limitation) =>
      limitation.includes("prefilled burette"),
    )).toBe(true);
  });

  it("keeps generated IDs deterministic without deriving the public stage ID from the draft fingerprint", async () => {
    const currentDraft = await loadVerifiedSource();
    const options = {
      stageRevision: 4,
      createdAt: "2026-08-29T18:00:00.000Z",
      loadSource: loadVerifiedSource,
    };
    const first = await compileAcidBaseTitration(
      validExperimentRequest(),
      defaultLabInventory(),
      currentDraft,
      options,
    );
    const second = await compileAcidBaseTitration(
      validExperimentRequest(),
      defaultLabInventory(),
      currentDraft,
      options,
    );
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.stage.stageId).toBe(second.stage.stageId);
    expect(first.stage.definition.id).toBe(second.stage.definition.id);
    expect(first.stage.blueprint.id).toBe(second.stage.blueprint.id);
    expect(first.stage.stageId).not.toContain(first.stage.sourceDraftFingerprint);
  });
});
