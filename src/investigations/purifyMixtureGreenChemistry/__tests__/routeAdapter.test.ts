import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  GreenChemistryProductRecoveryRecord,
  LabDefinition,
  RouteTechniqueExecutionIntent,
} from "../../../domain/types";
import {
  GREEN_CHEMISTRY_INSTANCE_ID,
  GREEN_CHEMISTRY_LAB_ID,
  type GreenChemistryApprovedConfiguration,
} from "../../../data/greenChemistrySetup";
import {
  calculateAtomEconomyPercent,
  compositionFromMassLoss,
} from "../model";
import {
  bundledLabSetupFixtures,
  createBundledLabHarness,
  type BundledLabHarness,
} from "../../../test/bundledLabHarness";
import {
  createGreenChemistryRouteAdapter,
  createInitialGreenChemistryRouteState,
  GREEN_CHEMISTRY_LAB_ORCHESTRATION_INSTANCE_ID,
  greenChemistryClosedReplicateSetBinding,
  greenChemistryHoldersFromCompiled,
  greenChemistryRulesFromCompiled,
  validateGreenChemistryRouteManifest,
  type GreenChemistryRouteState,
} from "../routeAdapter";

const BASE_SETUP = bundledLabSetupFixtures[
  GREEN_CHEMISTRY_LAB_ID
] as GreenChemistryApprovedConfiguration;

const PLAN_FIELDS = [
  "rationale",
  "constantMassRule",
  "apparatusAndObservations",
  "calculations",
  "uncertainty",
  "safety",
  "recovery",
] as const;

const DISPLAYS = [
  { emptyG: 20, loadedG: 21.5, cycleG: [21.1, 21.097] },
  { emptyG: 20.001, loadedG: 21.504, cycleG: [21.11, 21.107] },
  { emptyG: 20.002, loadedG: 21.502, cycleG: [21.12, 21.117] },
] as const;

const approvalPayload = (
  setup: GreenChemistryApprovedConfiguration,
): RouteTechniqueExecutionIntent["payload"] => ({
  ...setup,
  ...Object.fromEntries(PLAN_FIELDS.map((field) => [field, `approved ${field}`])),
});

type GreenRouteResult = ReturnType<
  ReturnType<typeof createGreenChemistryRouteAdapter>["execute"]
>;

interface Driver {
  readonly adapter: ReturnType<typeof createGreenChemistryRouteAdapter>;
  state: GreenChemistryRouteState;
  attempt: (
    actionId: string,
    payload?: RouteTechniqueExecutionIntent["payload"],
  ) => GreenRouteResult;
  run: (
    actionId: string,
    payload?: RouteTechniqueExecutionIntent["payload"],
  ) => void;
  runLab: (
    actionId: string,
    payload?: RouteTechniqueExecutionIntent["payload"],
  ) => void;
  reset: () => void;
}

const makeDriver = (definition: LabDefinition, runId: string): Driver => {
  const adapter = createGreenChemistryRouteAdapter(definition);
  const driver: Driver = {
    adapter,
    state: createInitialGreenChemistryRouteState(runId),
    attempt: (actionId: string, payload: RouteTechniqueExecutionIntent["payload"] = {}) =>
      adapter.execute(driver.state, {
        instanceId: GREEN_CHEMISTRY_INSTANCE_ID,
        actionId,
        payload,
      }),
    run: (actionId: string, payload: RouteTechniqueExecutionIntent["payload"] = {}) => {
      const result = driver.attempt(actionId, payload);
      if (!result.ok) {
        throw new Error(
          `${actionId} rejected: ${result.rejection.code} - ${result.rejection.message}`,
        );
      }
      driver.state = result.state;
    },
    runLab: (actionId: string, payload: RouteTechniqueExecutionIntent["payload"] = {}) => {
      const result = adapter.execute(driver.state, {
        instanceId: GREEN_CHEMISTRY_LAB_ORCHESTRATION_INSTANCE_ID,
        actionId,
        payload,
      });
      if (!result.ok) {
        throw new Error(
          `${actionId} was rejected: ${result.rejection.code} - ${result.rejection.message}`,
        );
      }
      driver.state = result.state;
    },
    reset: () => {
      driver.state = adapter.reset(driver.state);
    },
  };
  return driver;
};

const approveAndConfigure = (
  driver: Driver,
  setup: GreenChemistryApprovedConfiguration,
  stockMassG: number,
): void => {
  driver.run("approve-thermal-decomposition-plan", approvalPayload(setup));
  driver.run("configure-unheated-stock", {
    stockMassG,
    workingPortionMassG: setup.sampleMassG,
  });
};

const walkReplicate = (
  driver: Driver,
  index: number,
  setup: GreenChemistryApprovedConfiguration,
): void => {
  const display = DISPLAYS[index];
  const holders = driver.state.material?.holders;
  if (!holders) throw new Error("Expected the stock configuration to create material holders.");
  const balanceId = "balance-a";
  if (index === 0) driver.run("place-balance", { balanceId });
  driver.run("place-empty-crucible");
  driver.run("read-empty-crucible", { balanceId, valueG: display.emptyG });
  driver.run("record-empty-crucible");
  driver.run("add-carbonate-sample", { massG: setup.sampleMassG });
  driver.run("weigh-initial-crucible", { balanceId, valueG: display.loadedG });
  driver.run("record-initial-crucible-mass");
  driver.run("recover-unused-sample", {
    sourceInstanceId: holders.workingPortionInstanceId,
    targetInstanceId: holders.unusedRecoveryInstanceId,
  });
  if (index === 0) {
    driver.run("place-ring-stand");
    driver.run("add-clay-triangle");
    driver.run("place-bunsen-burner");
  }
  driver.run("place-crucible-on-support");
  driver.run("set-crucible-lid", { position: "askew" });
  driver.run("warm-gently", { durationMin: setup.warmDurationMin });
  driver.run("heat-carbonate-mixture", { durationMin: setup.heatingDurationMin });
  driver.run("turn-off-burner");
  driver.run("cool-crucible");
  driver.run("weigh-preliminary-final-mass", {
    balanceId,
    valueG: display.cycleG[0],
  });
  driver.run("record-cycle-mass");
  driver.run("repeat-heat-to-constant-mass", { cycleIndex: 2 });
  driver.run("turn-off-burner");
  driver.run("cool-constant-mass-crucible");
  driver.run("weigh-final-crucible", { balanceId, valueG: display.cycleG[1] });
  driver.run("record-cycle-mass");
  driver.run("record-final-crucible-mass");
  driver.run("recover-replicate-product", {
    sourceInstanceId: holders.crucibleInstanceId,
    targetInstanceId: holders.productRecoveryInstanceId,
  });
  driver.run("complete-replicate", { replicateId: index + 1 });
};

let bundledLabHarness: BundledLabHarness | undefined;

const loadConfigured = async (
  overrides: Partial<GreenChemistryApprovedConfiguration> = {},
): Promise<{ definition: LabDefinition; setup: GreenChemistryApprovedConfiguration }> => {
  const setup = { ...BASE_SETUP, ...overrides };
  return { definition: await bundledLabHarness!.loadLab(GREEN_CHEMISTRY_LAB_ID, setup), setup };
};

describe("green-chemistry compiled route adapter", () => {
  beforeEach(async () => {
    bundledLabHarness = await createBundledLabHarness();
  });

  afterEach(() => {
    bundledLabHarness?.dispose();
    bundledLabHarness = undefined;
  });

  it("accepts the current compiled identity, all ten projections, balance continuity, and recovery contracts", async () => {
    const { definition, setup } = await loadConfigured();
    expect(validateGreenChemistryRouteManifest(definition)).toEqual([]);

    const rules = greenChemistryRulesFromCompiled(definition);
    expect(rules.errors).toEqual([]);
    expect(rules.rules).toMatchObject({
      sampleMassG: setup.sampleMassG,
      warmDurationMin: setup.warmDurationMin,
      heatingDurationMin: setup.heatingDurationMin,
      heatingIntensity: setup.heatingIntensity,
      constantMassToleranceG: setup.constantMassToleranceG,
      maximumHeatCycles: setup.maximumHeatCycles,
      coolingEndpointC: setup.coolingEndpointC,
      coolingSurface: setup.coolingSurface,
      tareConvention: setup.tareConvention,
      minimumReplicates: setup.minimumReplicates,
    });
    expect(greenChemistryHoldersFromCompiled(definition).errors).toEqual([]);

    for (const actionId of [
      "approve-thermal-decomposition-plan",
      "record-empty-crucible",
      "calculate-carbonate-composition",
    ]) {
      expect(
        definition.actions.find((action) => action.id === actionId)?.parameters?.tareConvention,
      ).toBe(setup.tareConvention);
    }
    for (const actionId of [
      "read-empty-crucible",
      "weigh-initial-crucible",
      "weigh-preliminary-final-mass",
      "weigh-final-crucible",
    ]) {
      const mass = definition.actions.find((action) => action.id === actionId)?.mass;
      if (!mass || (mass.source !== "action-input" && mass.source !== "measurement")) {
        throw new Error(`Expected ${actionId} to declare a continuity-capable mass contract.`);
      }
      expect(mass.continuity).toMatchObject({
        version: 1,
        quantityKind: "balance-display",
        measuredSupportInstanceId: "crucible-with-lid-1",
      });
    }
  });

  it("rejects approval when the payload tare differs from the compiled teacher choice", async () => {
    const { definition, setup } = await loadConfigured();
    const driver = makeDriver(definition, "tare-mismatch-run");
    const result = driver.attempt("approve-thermal-decomposition-plan", {
      ...approvalPayload(setup),
      tareConvention: "tare-balance-with-crucible-plus-lid",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejection.code).toBe("approval-configuration-mismatch");
    expect(driver.state).toEqual(createInitialGreenChemistryRouteState("tare-mismatch-run"));
  });

  it("requires the complete plan and a recorded baseline before continuing", async () => {
    const { definition, setup } = await loadConfigured();
    const driver = makeDriver(definition, "approval-gate-run");
    const incomplete = { ...approvalPayload(setup) };
    delete (incomplete as Partial<RouteTechniqueExecutionIntent["payload"]>).uncertainty;
    const approval = driver.attempt("approve-thermal-decomposition-plan", incomplete);
    expect(approval.ok).toBe(false);
    if (!approval.ok) expect(approval.rejection.code).toBe("approval-incomplete");
    expect(driver.state.approved).toBe(false);

    driver.run("approve-thermal-decomposition-plan", approvalPayload(setup));
    driver.run("place-balance", { balanceId: "balance-a" });
    driver.run("place-empty-crucible");
    const recordBeforeRead = driver.attempt("record-empty-crucible");
    expect(recordBeforeRead.ok).toBe(false);
    if (!recordBeforeRead.ok) expect(recordBeforeRead.rejection.code).toBe("empty-reading-required");
  });

  it("traverses from initial state through recovery, report completion, and reset", async () => {
    const { definition, setup } = await loadConfigured();
    const driver = makeDriver(definition, "ordinary-traversal-run");
    approveAndConfigure(driver, setup, setup.sampleMassG * setup.minimumReplicates);
    walkReplicate(driver, 0, setup);
    walkReplicate(driver, 1, setup);

    const holders = driver.state.material!.holders;
    driver.run("finalize-unused-master-stock", {
      sourceInstanceId: holders.masterStockInstanceId,
      targetInstanceId: holders.unusedRecoveryInstanceId,
    });
    expect(driver.state.runPhase).toBe("closed");
    expect(driver.state.material?.closure?.frozenReplicates).toEqual([1, 2]);
    expect(driver.state.material?.productRecords).toHaveLength(2);
    const recoveryRecords = driver.state.material?.recoveryRecords ?? [];
    expect(recoveryRecords).toHaveLength(5);
    expect(
      recoveryRecords.filter(
        (record) => record.stream === "unheated" && record.operationId === "recover-unused-sample",
      ),
    ).toHaveLength(2);
    expect(
      recoveryRecords.filter(
        (record) => record.stream === "heated-product" && record.operationId === "recover-replicate-product",
      ),
    ).toHaveLength(2);
    expect(
      recoveryRecords.filter(
        (record) => record.stream === "unheated" && record.operationId === "finalize-unused-master-stock",
      ),
    ).toHaveLength(1);
    const productRecords = recoveryRecords.filter(
      (record): record is GreenChemistryProductRecoveryRecord => record.stream === "heated-product",
    );
    expect(productRecords.map((record) => record.replicate)).toEqual([1, 2]);
    expect(productRecords.every((record) => record.destinationPhysicalMassKnown === false)).toBe(true);
    expect(productRecords.every((record) => record.sourceInventoryEquivalentMassG > 0)).toBe(true);
    const productReceiver = driver.state.material?.instances.find(
      (instance) => instance.id === driver.state.material?.holders.productRecoveryInstanceId,
    );
    expect(productReceiver?.contents.massG).toBeUndefined();
    expect(productReceiver?.contents.solutes).toEqual([]);
    expect(productReceiver?.contents.qualitativeSolidProvenance).toHaveLength(2);

    const measuredCompositions = driver.state.completedReplicates.map((replicate) => {
      const finalCycle = replicate.cycles[replicate.cycles.length - 1];
      if (!finalCycle) throw new Error("Expected a final recorded cycle for every completed replicate.");
      const composition = compositionFromMassLoss(
        replicate.loadedMassG - replicate.emptyMassG,
        replicate.loadedMassG - finalCycle.crucibleAndLidMassG,
      );
      for (const mass of [
        composition.sodiumBicarbonateMassG,
        composition.sodiumCarbonateMassG,
      ]) {
        expect(Number.isFinite(mass)).toBe(true);
        expect(mass).toBeGreaterThanOrEqual(0);
      }
      for (const percentage of [
        composition.sodiumBicarbonatePercent,
        composition.sodiumCarbonatePercent,
      ]) {
        expect(Number.isFinite(percentage)).toBe(true);
        expect(percentage).toBeGreaterThanOrEqual(0);
        expect(percentage).toBeLessThanOrEqual(100);
      }
      return composition;
    });
    expect(measuredCompositions).toHaveLength(2);

    driver.run("calculate-carbonate-composition", {
      runId: driver.state.runId,
      closedReplicateSet: greenChemistryClosedReplicateSetBinding(driver.state)!,
      validated: true,
    });
    expect(driver.state.analysisCalculated).toBe(true);
    driver.run("record-composition-uncertainty", {
      runId: driver.state.runId,
      closedReplicateSet: greenChemistryClosedReplicateSetBinding(driver.state)!,
      note: "Balance resolution and constant-mass tolerance limit the result.",
    });
    driver.run("recover-final-product", {
      runId: driver.state.runId,
      closedReplicateSet: greenChemistryClosedReplicateSetBinding(driver.state)!,
    });
    driver.runLab("review-assigned-green-chemistry-report", {
      runId: driver.state.runId,
      closedReplicateSet: greenChemistryClosedReplicateSetBinding(driver.state)!,
      assignedReport: "assigned report",
      review: "The assigned report supports the observed material-accounting limits.",
    });
    // These are explicit report-fixture stoichiometric contributions, not a fabricated physical
    // mass for the qualitative recovered product.
    const reportProductContributionG = 42;
    const reportReactantContributionG = 100;
    const atomEconomyPercent = calculateAtomEconomyPercent(
      reportProductContributionG,
      reportReactantContributionG,
    );
    driver.runLab("calculate-assigned-report-atom-economy", {
      runId: driver.state.runId,
      closedReplicateSet: greenChemistryClosedReplicateSetBinding(driver.state)!,
      atomEconomyPercent,
      validated: true,
    });
    driver.runLab("complete-green-chemistry-peer-review", {
      runId: driver.state.runId,
      closedReplicateSet: greenChemistryClosedReplicateSetBinding(driver.state)!,
      additionalGreenPrinciple: "Prevent waste at the source.",
      recommendations: "Track unheated and heated streams separately in the report.",
    });
    expect(driver.state).toMatchObject({
      uncertaintyRecorded: true,
      productRecovered: true,
      reportReviewed: true,
      atomEconomyRecorded: true,
      peerReviewComplete: true,
    });
    const previousRunId = driver.state.runId;
    driver.reset();
    expect(driver.state.runId).not.toBe(previousRunId);
    expect(driver.state.material).toBeUndefined();
    expect(driver.state).toMatchObject({
      runPhase: "open",
      approved: false,
      completedReplicates: [],
      evidence: [],
    });
  });

  it("enforces the learner-approved replicate count read from the compiled plan", async () => {
    const teacherMinimumReplicates = BASE_SETUP.minimumReplicates;
    const learnerReplicates = teacherMinimumReplicates + 1;
    const { definition, setup } = await loadConfigured({ minimumReplicates: learnerReplicates });
    expect(greenChemistryRulesFromCompiled(definition).rules?.minimumReplicates).toBe(learnerReplicates);
    const driver = makeDriver(definition, "learner-count-run");
    approveAndConfigure(driver, setup, setup.sampleMassG * learnerReplicates);
    walkReplicate(driver, 0, setup);
    walkReplicate(driver, 1, setup);

    const holders = driver.state.material!.holders;
    const result = driver.attempt("finalize-unused-master-stock", {
      sourceInstanceId: holders.masterStockInstanceId,
      targetInstanceId: holders.unusedRecoveryInstanceId,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejection.code).toBe("minimum-replicates-required");
  });

  it("refuses a compiled definition whose manifest action identity is altered", async () => {
    const { definition } = await loadConfigured();
    const altered = structuredClone(definition);
    const origin = altered.compositionManifest?.origins.find(
      (candidate) => candidate.instanceId === GREEN_CHEMISTRY_INSTANCE_ID,
    );
    if (!origin) throw new Error("Expected the compiled thermal origin.");
    origin.nodeId = "not-the-compiled-node";

    const errors = validateGreenChemistryRouteManifest(altered);
    expect(errors).toEqual(expect.arrayContaining([
      expect.stringMatching(/exact route target|matching origin/i),
    ]));
    const driver = makeDriver(altered, "altered-manifest-run");
    const result = driver.attempt("approve-thermal-decomposition-plan", approvalPayload(BASE_SETUP));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejection.code).toBe("manifest-target-mismatch");
  });

  it("refuses a manifest whose approval anchor no longer names the compiler-issued source", async () => {
    const { definition } = await loadConfigured();
    const altered = structuredClone(definition);
    const instance = altered.compositionManifest?.instances.find(
      (candidate) => candidate.instanceId === GREEN_CHEMISTRY_INSTANCE_ID,
    );
    const approvalAnchor = instance?.evidenceOutputs.find(
      (candidate) => candidate.actionId === "approve-thermal-decomposition-plan"
        && candidate.sourceId === "approval",
    );
    if (!approvalAnchor) throw new Error("Expected the compiled approval evidence anchor.");
    approvalAnchor.sourceId = "approval-anchor-removed";

    const errors = validateGreenChemistryRouteManifest(altered);
    expect(errors).toEqual(expect.arrayContaining([
      expect.stringMatching(/compiler-issued approval evidence output/i),
    ]));
    const driver = makeDriver(altered, "missing-approval-anchor-run");
    const result = driver.attempt("approve-thermal-decomposition-plan", approvalPayload(BASE_SETUP));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejection.code).toBe("manifest-target-mismatch");
  });
});
