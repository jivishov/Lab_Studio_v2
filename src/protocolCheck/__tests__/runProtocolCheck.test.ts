import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  bundledLabSetupFixtures,
  createBundledLabHarness,
  type BundledLabHarness,
} from "../../test/bundledLabHarness";
import { defaultLabInventory } from "../../experimentComposer/catalogs";
import { compileAcidBaseTitration } from "../../experimentComposer/compileAcidBaseTitration";
import type { ExperimentRequest, StagedExperiment } from "../../experimentComposer/types";
import {
  hasRequiredProtocolLimitationCategories,
  protocolCheckLimitations,
  runProtocolCheck,
} from "../runProtocolCheck";
import {
  PROTOCOL_CHECK_NAMES,
  type ProtocolCheckLimitations,
} from "../types";

let bundledLabHarness: BundledLabHarness | undefined;

const loadVerifiedSource = async () => {
  if (!bundledLabHarness) throw new Error("Bundled-lab harness is not initialized.");
  return bundledLabHarness.loadLab(
    "acid-base-titration",
    bundledLabSetupFixtures["acid-base-titration"],
  );
};

const request: ExperimentRequest = {
  schemaVersion: "1",
  familyId: "acid_base_titration_v1",
  expectedInventoryRevision: 0,
  objective: "Estimate a synthetic monoprotic-acid molarity through a guided titration rehearsal.",
  title: "Protocol Check fixture",
  audience: "high_school",
  experience: "novice",
  durationMinutes: 45,
  deliveryContext: "virtual_training",
  aliquotVolumeMl: 20,
  endpointEvidence: "phenolphthalein",
};

const compileStage = async (
  overrides: Partial<ExperimentRequest> = {},
): Promise<StagedExperiment> => {
  const source = await loadVerifiedSource();
  const outcome = await compileAcidBaseTitration(
    { ...request, ...overrides },
    defaultLabInventory(),
    source,
    {
      stageRevision: 1,
      createdAt: "2026-08-29T20:00:00.000Z",
      loadSource: loadVerifiedSource,
    },
  );
  if (!outcome.ok) throw new Error(outcome.issues.map((issue) => issue.message).join("; "));
  return outcome.stage;
};

const completeLimitations: ProtocolCheckLimitations = {
  scientific: ["Scientific model limitation."],
  safety: ["Declared-safety limitation."],
  physical: ["Physical-transfer limitation."],
};

describe("Cycle 05 deterministic Protocol Check", () => {
  beforeEach(async () => {
    bundledLabHarness = await createBundledLabHarness();
  });

  afterEach(() => {
    bundledLabHarness?.dispose();
    bundledLabHarness = undefined;
  });

  it("accepts the report contract when all three required categories are non-empty", () => {
    expect(hasRequiredProtocolLimitationCategories(completeLimitations)).toBe(true);
  });

  it.each(["scientific", "safety", "physical"] as const)(
    "fails closed when the %s limitation category is missing, empty, malformed, or blank",
    (category) => {
      const missing: Partial<ProtocolCheckLimitations> = structuredClone(completeLimitations);
      delete missing[category];
      expect(hasRequiredProtocolLimitationCategories(missing)).toBe(false);
      expect(hasRequiredProtocolLimitationCategories({
        ...completeLimitations,
        [category]: [],
      })).toBe(false);
      expect(hasRequiredProtocolLimitationCategories({
        ...completeLimitations,
        [category]: ["   "],
      })).toBe(false);
      expect(hasRequiredProtocolLimitationCategories({
        ...completeLimitations,
        [category]: "Not an array.",
      })).toBe(false);
      expect(hasRequiredProtocolLimitationCategories({
        ...completeLimitations,
        [category]: ["Valid limitation.", 42],
      })).toBe(false);
      expect(hasRequiredProtocolLimitationCategories({
        ...completeLimitations,
        [category]: Array(1),
      })).toBe(false);
    },
  );

  it("matches the report contract for the reproduced virtual-training compiler output", async () => {
    const stage = await compileStage({ aliquotVolumeMl: 25 });
    const limitations = protocolCheckLimitations(stage);

    expect(stage.request.deliveryContext).toBe("virtual_training");
    expect(stage.blueprint.fidelity.proceduralOnly).toEqual([]);
    expect({
      scientific: limitations.scientific.length,
      safety: limitations.safety.length,
      physical: limitations.physical.length,
    }).toEqual({ scientific: 8, safety: 3, physical: 1 });
    expect(hasRequiredProtocolLimitationCategories(limitations)).toBe(true);
  });

  it("executes exactly the ten named cases against isolated ordinary runtimes", async () => {
    const stage = await compileStage();
    const before = structuredClone(stage);
    const outcome = await runProtocolCheck(stage, new AbortController().signal);

    expect(outcome.status).toBe("completed");
    if (outcome.status !== "completed") return;
    expect(outcome.report.checks.map((check) => check.name)).toEqual(PROTOCOL_CHECK_NAMES);
    expect(outcome.report.checks).toHaveLength(10);
    expect(outcome.report.passed).toBe(true);
    expect(stage).toEqual(before);
  });

  it("does not return or store a partial report when cancellation is already requested", async () => {
    const stage = await compileStage();
    const abortController = new AbortController();
    abortController.abort("cancelled by fixture");

    const outcome = await runProtocolCheck(stage, abortController.signal);

    expect(outcome).toMatchObject({ status: "aborted", stage: { stageId: stage.stageId } });
    expect(outcome).not.toHaveProperty("report");
  });

  it("stops a long sequence when cancellation arrives between ordinary intents", async () => {
    const stage = await compileStage();
    let reads = 0;
    const signal = {
      get aborted() {
        reads += 1;
        return reads > 40;
      },
    } as AbortSignal;

    const outcome = await runProtocolCheck(stage, signal);

    expect(outcome).toMatchObject({ status: "aborted", stage: { stageId: stage.stageId } });
    expect(outcome).not.toHaveProperty("report");
  });

  it("fails the inventory case when staged source quantity cannot support the plan", async () => {
    const stage = await compileStage();
    const analyteSource = stage.definition.initialState?.equipment.find(
      (item) => item.definitionId === "unknown-acid-bottle",
    );
    if (!analyteSource) throw new Error("Expected the staged analyte source fixture.");
    analyteSource.contents.volumeMl = 0;

    const outcome = await runProtocolCheck(stage, new AbortController().signal);

    expect(outcome.status).toBe("completed");
    if (outcome.status !== "completed") return;
    expect(outcome.report.passed).toBe(false);
    expect(outcome.report.checks.find((check) => check.name === "inventory_roles_resolved"))
      .toMatchObject({ status: "failed" });
  });

  it("keeps hidden expected values out of the completed visible report", async () => {
    const stage = await compileStage();
    const outcome = await runProtocolCheck(stage, new AbortController().signal);
    expect(outcome.status).toBe("completed");
    if (outcome.status !== "completed") return;

    const visibleReport = JSON.stringify({
      reportId: outcome.report.reportId,
      passed: outcome.report.passed,
      checks: outcome.report.checks,
      limitations: outcome.report.limitations,
    });
    expect(visibleReport).not.toMatch(/analyteMolarity|endpointDropCount|expectedResult|sourceDraftFingerprint/i);
    expect(outcome.report.limitations.scientific.length).toBeGreaterThan(0);
    expect(outcome.report.limitations.safety.join(" ")).toMatch(/not a comprehensive safety review/i);
    expect(outcome.report.limitations.physical.join(" ")).toMatch(/does not characterize/i);
  });
});
