import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { compileLabComposition } from "../../../data/compileLabComposition";
import type {
  LabDefinition,
  RouteTechniqueExecutionIntent,
  TechniqueDefinition,
} from "../../../domain/types";
import {
  createGreenChemistryRouteAdapter,
  createInitialGreenChemistryRouteState,
  GREEN_CHEMISTRY_LAB_ORCHESTRATION_INSTANCE_ID,
  greenChemistryClosedReplicateSetBinding,
  greenChemistryHoldersFromCompiled,
  type GreenChemistryRouteState,
} from "../routeAdapter";
import { GREEN_CHEMISTRY_INSTANCE_ID } from "../configuredComposition";

/**
 * Route-level material accounting for the green-chemistry recovery repair.
 *
 * Everything here is an ordinary traversal through the route's own intent API: the run is driven
 * with learner-entered balance displays and teacher setup values, and the assertions read the
 * material the adapter actually moved. No state is hand-built, so nothing here can pass by
 * constructing a situation the route would never produce.
 */

const INSTANCE_ID = GREEN_CHEMISTRY_INSTANCE_ID;

const APPROVED = {
  sampleMassG: 2,
  warmDurationMin: 2,
  heatingDurationMin: 6,
  heatingIntensity: "medium blue cone",
  constantMassToleranceG: 0.01,
  maximumHeatCycles: 5,
  coolingEndpointC: 22,
  coolingSurface: "wire gauze on the bench mat",
  tareConvention: "record-crucible-plus-lid" as const,
  minimumReplicates: 2,
};

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
  { emptyG: 20.0, loadedG: 22.0, cycleG: [21.4, 21.395] },
  { emptyG: 20.001, loadedG: 22.004, cycleG: [21.41, 21.404] },
  { emptyG: 20.002, loadedG: 22.001, cycleG: [21.42, 21.415] },
];

const readJson = async <T>(relativePath: string): Promise<T> =>
  JSON.parse(await readFile(join(process.cwd(), relativePath), "utf8")) as T;

let compiled: LabDefinition;

const compiledEvidenceOutputId = (actionId: string, sourceId: string): string => {
  const instance = compiled.compositionManifest?.instances.find(
    (candidate) => candidate.instanceId === INSTANCE_ID,
  );
  if (!instance) throw new Error("Expected the compiled thermal manifest instance.");
  const outputs = instance.evidenceOutputs.filter(
    (output) => output.actionId === actionId && output.sourceId === sourceId,
  );
  expect(outputs).toHaveLength(1);
  const id = outputs[0]?.id;
  if (!id) throw new Error(`Expected compiler output for ${actionId}/${sourceId}.`);
  return id;
};

type CompositionSource = Parameters<typeof compileLabComposition>[0];

beforeAll(async () => {
  const source = await readJson<CompositionSource>(
    "public/labs/green-chemistry-mixture-purification.json",
  );
  const index = await readJson<Array<{ id: string; file?: string }>>(
    "public/techniques/index.json",
  );
  const resolveTechnique = async (id: string): Promise<TechniqueDefinition> => {
    const entry = index.find((candidate) => candidate.id === id);
    if (!entry) throw new Error(`Technique ${id} is not indexed.`);
    return readJson<TechniqueDefinition>(`public/techniques/${entry.file ?? `${id}.json`}`);
  };
  const configured = structuredClone(source);
  const instance = configured.techniqueInstances.find(
    (candidate) => candidate.instanceId === INSTANCE_ID,
  );
  if (!instance) throw new Error("The green-chemistry lab lost its thermal technique instance.");
  // Teacher configuration is bound to the instance the same way the player binds it at approval.
  instance.bindings.configuration = { ...instance.bindings.configuration, ...APPROVED };
  compiled = await compileLabComposition(configured, resolveTechnique);
});

interface Driver {
  state: GreenChemistryRouteState;
  run: (actionId: string, payload?: RouteTechniqueExecutionIntent["payload"]) => void;
  attempt: (
    actionId: string,
    payload?: RouteTechniqueExecutionIntent["payload"],
  ) => ReturnType<ReturnType<typeof createGreenChemistryRouteAdapter>["execute"]>;
  reject: (actionId: string, payload?: RouteTechniqueExecutionIntent["payload"]) => string;
  reset: () => void;
}

const driver = (runId = "test-run"): Driver => {
  const adapter = createGreenChemistryRouteAdapter(compiled);
  const self: Driver = {
    state: createInitialGreenChemistryRouteState(runId),
    attempt: (actionId, payload = {}) =>
      adapter.execute(self.state, {
        instanceId:
          actionId.startsWith("review-")
          || actionId.startsWith("calculate-assigned")
          || actionId.startsWith("complete-green")
            ? GREEN_CHEMISTRY_LAB_ORCHESTRATION_INSTANCE_ID
            : INSTANCE_ID,
        actionId,
        payload,
      }),
    run: (actionId, payload = {}) => {
      const result = self.attempt(actionId, payload);
      if (!result.ok) {
        throw new Error(
          `${actionId} was rejected: ${result.rejection.code} - ${result.rejection.message}`,
        );
      }
      self.state = result.state;
    },
    reject: (actionId, payload = {}) => {
      const result = self.attempt(actionId, payload);
      if (result.ok) throw new Error(`${actionId} unexpectedly succeeded.`);
      return result.rejection.code;
    },
    reset: () => {
      self.state = adapter.reset(self.state);
    },
  };
  return self;
};

const approve = (d: Driver): void => {
  d.run("approve-thermal-decomposition-plan", {
    ...APPROVED,
    ...Object.fromEntries(PLAN_FIELDS.map((field) => [field, `approved ${field}`])),
  });
};

const configureStock = (d: Driver, stockMassG: number, workingPortionMassG: number): void => {
  d.run("configure-unheated-stock", { stockMassG, workingPortionMassG });
};

/** One full replicate, from the empty reading through completion. */
const walkReplicate = (d: Driver, index: number): void => {
  const entered = DISPLAYS[index];
  const balanceId = "balance-a";
  const ids = holders(d.state);
  if (index === 0) d.run("place-balance", { balanceId });
  d.run("place-empty-crucible");
  d.run("read-empty-crucible", { balanceId, valueG: entered.emptyG });
  d.run("record-empty-crucible");
  d.run("add-carbonate-sample", { massG: APPROVED.sampleMassG });
  d.run("weigh-initial-crucible", { balanceId, valueG: entered.loadedG });
  d.run("record-initial-crucible-mass");
  d.run("recover-unused-sample", {
    sourceInstanceId: ids.workingPortionInstanceId,
    targetInstanceId: ids.unusedRecoveryInstanceId,
  });
  if (index === 0) {
    d.run("place-ring-stand");
    d.run("add-clay-triangle");
    d.run("place-bunsen-burner");
  }
  d.run("place-crucible-on-support");
  d.run("set-crucible-lid", { position: "askew" });
  d.run("warm-gently", { durationMin: APPROVED.warmDurationMin });
  d.run("heat-carbonate-mixture", { durationMin: APPROVED.heatingDurationMin });
  d.run("turn-off-burner");
  d.run("cool-crucible");
  d.run("weigh-preliminary-final-mass", { balanceId, valueG: entered.cycleG[0] });
  d.run("record-cycle-mass");
  d.run("repeat-heat-to-constant-mass", { cycleIndex: 2 });
  d.run("turn-off-burner");
  d.run("cool-constant-mass-crucible");
  d.run("weigh-final-crucible", { balanceId, valueG: entered.cycleG[1] });
  d.run("record-cycle-mass");
  d.run("record-final-crucible-mass");
  d.run("recover-replicate-product", {
    sourceInstanceId: ids.crucibleInstanceId,
    targetInstanceId: ids.productRecoveryInstanceId,
  });
  d.run("complete-replicate", { replicateId: index + 1 });
};

const held = (state: GreenChemistryRouteState, instanceId: string) => {
  const material = state.material;
  if (!material) throw new Error("The run has no material slice.");
  const instance = material.instances.find((candidate) => candidate.id === instanceId);
  if (!instance) throw new Error(`Expected instance ${instanceId}.`);
  return instance.contents;
};

const holders = (state: GreenChemistryRouteState) => {
  if (!state.material) throw new Error("The run has no material slice.");
  return state.material.holders;
};

const closedPayload = (d: Driver): RouteTechniqueExecutionIntent["payload"] => ({
  runId: d.state.runId,
  closedReplicateSet: greenChemistryClosedReplicateSetBinding(d.state) ?? "",
});

describe("compiled holders", () => {
  it("resolves every physical holder from the compiled instance", () => {
    const resolved = greenChemistryHoldersFromCompiled(compiled);
    expect(resolved.errors).toEqual([]);
    expect(resolved.holders).toMatchObject({
      masterStockInstanceId: "sample-bottle-1",
      workingPortionInstanceId: "working-sample-portion-1",
      crucibleInstanceId: "crucible-with-lid-1",
      unusedRecoveryInstanceId: "unused-sample-recovery-1",
      productRecoveryInstanceId: "heated-product-recovery-1",
    });
  });
});

describe("stock configuration feasibility", () => {
  it("refuses a working portion below the approved portion and a stock below the plan", () => {
    const d = driver();
    approve(d);
    expect(d.reject("configure-unheated-stock", { stockMassG: 12, workingPortionMassG: 1.5 })).toBe(
      "working-portion-too-small",
    );
    expect(d.reject("configure-unheated-stock", { stockMassG: 4, workingPortionMassG: 2.5 })).toBe(
      "stock-insufficient",
    );
    expect(d.state.material).toBeUndefined();
  });

  it("issues the configured total once and refuses a second configuration", () => {
    const d = driver();
    approve(d);
    configureStock(d, 12, 2.5);
    expect(held(d.state, holders(d.state).masterStockInstanceId).massG).toBe(12);
    expect(d.reject("configure-unheated-stock", { stockMassG: 8, workingPortionMassG: 2.5 })).toBe(
      "stock-already-configured",
    );
    expect(held(d.state, holders(d.state).masterStockInstanceId).massG).toBe(12);
  });
});

describe("the load is one transaction", () => {
  it("issues a working portion and loads the approved portion together", () => {
    const d = driver();
    approve(d);
    configureStock(d, 12, 2.5);
    d.run("place-balance", { balanceId: "balance-a" });
    d.run("place-empty-crucible");
    d.run("read-empty-crucible", { balanceId: "balance-a", valueG: 20 });
    d.run("record-empty-crucible");
    d.run("add-carbonate-sample", { massG: APPROVED.sampleMassG });
    const ids = holders(d.state);
    expect(held(d.state, ids.masterStockInstanceId).massG).toBe(9.5);
    expect(held(d.state, ids.workingPortionInstanceId).massG).toBe(0.5);
    expect(held(d.state, ids.crucibleInstanceId).massG).toBe(2);
    expect(d.state.material?.active).toMatchObject({
      replicate: 1,
      issuedWorkingMassG: 2.5,
      loadedPortionMassG: 2,
    });
  });

  it("refuses a second load while the replicate is open, and moves nothing", () => {
    const d = driver();
    approve(d);
    configureStock(d, 12, 2.5);
    d.run("place-balance", { balanceId: "balance-a" });
    d.run("place-empty-crucible");
    d.run("read-empty-crucible", { balanceId: "balance-a", valueG: 20 });
    d.run("record-empty-crucible");
    d.run("add-carbonate-sample", { massG: APPROVED.sampleMassG });
    expect(d.reject("add-carbonate-sample", { massG: APPROVED.sampleMassG })).toBe(
      "replicate-already-loaded",
    );
    expect(held(d.state, holders(d.state).masterStockInstanceId).massG).toBe(9.5);
  });

  it("refuses a load once the stock can no longer supply a full working portion", () => {
    // Exactly two working portions fit, so the third replicate has nothing to draw on.
    const d = driver();
    approve(d);
    configureStock(d, 5, 2.5);
    walkReplicate(d, 0);
    walkReplicate(d, 1);
    d.run("place-empty-crucible");
    d.run("read-empty-crucible", { balanceId: "balance-a", valueG: DISPLAYS[2].emptyG });
    d.run("record-empty-crucible");
    expect(d.reject("add-carbonate-sample", { massG: APPROVED.sampleMassG })).toBe(
      "stock-exhausted",
    );
  });
});

describe("unheated excess and heated product", () => {
  it("returns the actual excess, once, before any heating", () => {
    const d = driver();
    approve(d);
    configureStock(d, 12, 2.5);
    d.run("place-balance", { balanceId: "balance-a" });
    d.run("place-empty-crucible");
    d.run("read-empty-crucible", { balanceId: "balance-a", valueG: 20 });
    d.run("record-empty-crucible");
    d.run("add-carbonate-sample", { massG: APPROVED.sampleMassG });
    d.run("weigh-initial-crucible", { balanceId: "balance-a", valueG: 22 });
    d.run("record-initial-crucible-mass");
    expect(d.reject("recover-unused-sample", {
      targetInstanceId: holders(d.state).productRecoveryInstanceId,
    })).toBe(
      "wrong-recovery-target",
    );
    d.run("recover-unused-sample", {
      sourceInstanceId: holders(d.state).workingPortionInstanceId,
      targetInstanceId: holders(d.state).unusedRecoveryInstanceId,
    });
    expect(d.state.material?.active?.excessReturnedG).toBe(0.5);
    expect(held(d.state, holders(d.state).unusedRecoveryInstanceId).massG).toBe(0.5);
    expect(held(d.state, holders(d.state).workingPortionInstanceId).kind).toBe("empty");
    expect(d.reject("recover-unused-sample", {
      targetInstanceId: holders(d.state).unusedRecoveryInstanceId,
    })).toBe(
      "excess-already-recovered",
    );
  });

  it("blocks heating until this replicate's excess is actually out of the vial", () => {
    const d = driver();
    approve(d);
    configureStock(d, 12, 2.5);
    d.run("place-balance", { balanceId: "balance-a" });
    d.run("place-empty-crucible");
    d.run("read-empty-crucible", { balanceId: "balance-a", valueG: 20 });
    d.run("record-empty-crucible");
    d.run("add-carbonate-sample", { massG: APPROVED.sampleMassG });
    d.run("weigh-initial-crucible", { balanceId: "balance-a", valueG: 22 });
    d.run("record-initial-crucible-mass");
    d.run("place-ring-stand");
    d.run("add-clay-triangle");
    d.run("place-bunsen-burner");
    d.run("place-crucible-on-support");
    d.run("set-crucible-lid", { position: "askew" });
    expect(d.reject("warm-gently", { durationMin: APPROVED.warmDurationMin })).toBe(
      "heating-prerequisites",
    );
  });

  it("refuses the product recovery before the cooled constant-mass evidence", () => {
    const d = driver();
    approve(d);
    configureStock(d, 12, 2.5);
    d.run("place-balance", { balanceId: "balance-a" });
    d.run("place-empty-crucible");
    d.run("read-empty-crucible", { balanceId: "balance-a", valueG: 20 });
    d.run("record-empty-crucible");
    d.run("add-carbonate-sample", { massG: APPROVED.sampleMassG });
    expect(d.reject("recover-replicate-product", {
      targetInstanceId: holders(d.state).productRecoveryInstanceId,
    })).toBe(
      "replicate-not-complete",
    );
    expect(held(d.state, holders(d.state).crucibleInstanceId).massG).toBe(2);
  });

  it("records provenance for the product and assigns it no mass", () => {
    const d = driver();
    approve(d);
    configureStock(d, 12, 2.5);
    walkReplicate(d, 0);
    const product = held(d.state, holders(d.state).productRecoveryInstanceId);
    expect(product.massG).toBeUndefined();
    expect(product.solutes).toEqual([]);
    expect(product.qualitativeSolidProvenance).toHaveLength(1);
    const record = product.qualitativeSolidProvenance?.[0];
    expect(record).toMatchObject({
      runId: "test-run",
      replicate: 1,
      destinationPhysicalMassKnown: false,
      quantityBasis: "source-inventory-equivalent",
      sourceInventoryEquivalentMassG: 2,
    });
    // The cited evidence is this replicate's own, and none of it is a product mass.
    expect(record?.measurementEvidenceIds).toContain("replicate-1-loaded-mass");
    expect(record?.measurementEvidenceIds.every((id) => id.startsWith("replicate-1-"))).toBe(true);
    expect(record?.recoveryEvidenceIds).toEqual([
      compiledEvidenceOutputId("recover-replicate-product", "replicate-recovery"),
      compiledEvidenceOutputId("recover-unused-sample", "unused-sample-recovery"),
    ].sort());
    expect(held(d.state, holders(d.state).crucibleInstanceId).kind).toBe("empty");
  });

  it("accumulates a second replicate's product without merging the two into one pile", () => {
    const d = driver();
    approve(d);
    configureStock(d, 12, 2.5);
    walkReplicate(d, 0);
    walkReplicate(d, 1);
    const product = held(d.state, holders(d.state).productRecoveryInstanceId);
    expect(product.qualitativeSolidProvenance).toHaveLength(2);
    expect(product.massG).toBeUndefined();
    expect(
      product.qualitativeSolidProvenance?.map((record) => record.replicate),
    ).toEqual([1, 2]);
    expect(held(d.state, holders(d.state).unusedRecoveryInstanceId).massG).toBe(1);
  });
});

describe("closing the run", () => {
  const closedRun = (): Driver => {
    const d = driver();
    approve(d);
    configureStock(d, 12, 2.5);
    walkReplicate(d, 0);
    walkReplicate(d, 1);
    d.run("finalize-unused-master-stock", {
      sourceInstanceId: holders(d.state).masterStockInstanceId,
      targetInstanceId: holders(d.state).unusedRecoveryInstanceId,
    });
    return d;
  };

  const readyForConfirmation = (): Driver => {
    const d = closedRun();
    d.run("calculate-carbonate-composition", {
      ...closedPayload(d),
      calculationId: "composition-analysis",
      validated: true,
    });
    d.run("record-composition-uncertainty", {
      ...closedPayload(d),
      note: "Balance resolution dominates.",
    });
    return d;
  };

  it("refuses closure while a replicate is still open", () => {
    const d = driver();
    approve(d);
    configureStock(d, 12, 2.5);
    walkReplicate(d, 0);
    walkReplicate(d, 1);
    d.run("place-empty-crucible");
    d.run("read-empty-crucible", { balanceId: "balance-a", valueG: DISPLAYS[2].emptyG });
    d.run("record-empty-crucible");
    d.run("add-carbonate-sample", { massG: APPROVED.sampleMassG });
    expect(d.reject("finalize-unused-master-stock", {
      sourceInstanceId: holders(d.state).masterStockInstanceId,
      targetInstanceId: holders(d.state).unusedRecoveryInstanceId,
    })).toBe("replicate-still-open");
  });

  it("returns what the bottle actually still holds and freezes the completed set", () => {
    const d = closedRun();
    expect(d.state.runPhase).toBe("closed");
    expect(d.state.material?.closure).toMatchObject({
      masterRemainderReturnedG: 7,
      frozenReplicates: [1, 2],
    });
    expect(held(d.state, holders(d.state).unusedRecoveryInstanceId).massG).toBe(8);
    expect(held(d.state, holders(d.state).masterStockInstanceId).kind).toBe("empty");
  });

  it("rejects loading, recovery, completion and a second closure once closed", () => {
    const d = closedRun();
    for (const actionId of [
      "add-carbonate-sample",
      "recover-unused-sample",
      "recover-replicate-product",
      "complete-replicate",
      "finalize-unused-master-stock",
      "configure-unheated-stock",
    ]) {
      expect(d.reject(actionId, { massG: APPROVED.sampleMassG })).toBe(
        "run-closed",
      );
    }
  });

  it("rejects setup, reading and recording controls once closed", () => {
    const d = closedRun();
    for (const [actionId, payload] of [
      ["configure-unheated-stock", { stockMassG: 12, workingPortionMassG: 2.5 }],
      ["place-balance", { balanceId: "balance-a" }],
      ["read-empty-crucible", { balanceId: "balance-a", valueG: 20 }],
      ["record-empty-crucible", {}],
    ] as const) {
      expect(d.reject(actionId, payload)).toBe("run-closed");
    }
  });

  it("refuses closure when the next replicate has an unrecorded empty reading", () => {
    const d = driver();
    approve(d);
    configureStock(d, 12, 2.5);
    walkReplicate(d, 0);
    walkReplicate(d, 1);
    d.run("place-empty-crucible");
    d.run("read-empty-crucible", { balanceId: "balance-a", valueG: DISPLAYS[2].emptyG });
    expect(d.reject("finalize-unused-master-stock", {
      sourceInstanceId: holders(d.state).masterStockInstanceId,
      targetInstanceId: holders(d.state).unusedRecoveryInstanceId,
    })).toBe("pending-mass-reading");
  });

  it("binds the composition and the confirmation to the frozen set, and confirms only once", () => {
    const d = closedRun();
    d.run("calculate-carbonate-composition", {
      ...closedPayload(d),
      calculationId: "composition-analysis",
      validated: true,
    });
    d.run("record-composition-uncertainty", {
      ...closedPayload(d),
      note: "Balance resolution dominates.",
    });
    d.run("recover-final-product", closedPayload(d));
    expect(d.state.productRecovered).toBe(true);
    expect(d.reject("recover-final-product", closedPayload(d))).toBe("recoveries-already-confirmed");
  });

  it("rejects a stale closed-set binding without recording analysis", () => {
    const d = closedRun();
    const before = d.state;
    expect(
      d.reject("calculate-carbonate-composition", {
        runId: d.state.runId,
        closedReplicateSet: `${d.state.runId}::1`,
        calculationId: "composition-analysis",
        validated: true,
      }),
    ).toBe("closed-set-binding-mismatch");
    expect(d.state).toBe(before);
    expect(d.state.analysisCalculated).toBe(false);
  });

  it("refuses the composition before the run is closed", () => {
    const d = driver();
    approve(d);
    configureStock(d, 12, 2.5);
    walkReplicate(d, 0);
    walkReplicate(d, 1);
    expect(
      d.reject("calculate-carbonate-composition", {
        ...closedPayload(d),
        calculationId: "composition-analysis",
        validated: true,
      }),
    ).toBe("closed-run-required");
  });

  it("refuses the final confirmation when the recovered material contradicts the records", () => {
    const d = closedRun();
    d.run("calculate-carbonate-composition", {
      ...closedPayload(d),
      calculationId: "composition-analysis",
      validated: true,
    });
    d.run("record-composition-uncertainty", {
      ...closedPayload(d),
      note: "Balance resolution dominates.",
    });
    // Model material going missing between the recovery and the confirmation. The route never
    // produces this, which is the point: the confirmation must not rubber-stamp a mismatch.
    const material = d.state.material;
    if (!material) throw new Error("Expected a material slice.");
    d.state = {
      ...d.state,
      material: {
        ...material,
        instances: material.instances.map((instance) =>
          instance.id === material.holders.unusedRecoveryInstanceId
            ? { ...instance, contents: { ...instance.contents, massG: 3 } }
            : instance,
        ),
      },
    };
    expect(d.reject("recover-final-product", closedPayload(d))).toBe("recovery-reconciliation-failed");
  });

  it("refuses final confirmation when a product receiver provenance field is altered", () => {
    const d = closedRun();
    d.run("calculate-carbonate-composition", {
      ...closedPayload(d),
      calculationId: "composition-analysis",
      validated: true,
    });
    d.run("record-composition-uncertainty", {
      ...closedPayload(d),
      note: "Balance resolution dominates.",
    });
    const material = d.state.material;
    if (!material) throw new Error("Expected a material slice.");
    d.state = {
      ...d.state,
      material: {
        ...material,
        instances: material.instances.map((instance) =>
          instance.id === material.holders.productRecoveryInstanceId
            ? {
                ...instance,
                contents: {
                  ...instance.contents,
                  qualitativeSolidProvenance: instance.contents.qualitativeSolidProvenance?.map(
                    (record) => ({ ...record, sourceActionId: "altered-recovery" }),
                  ),
                },
              }
            : instance,
        ),
      },
    };
    expect(d.reject("recover-final-product", closedPayload(d))).toBe("recovery-reconciliation-failed");
  });

  it("binds product evidence and source quantities across every duplicate record copy", () => {
    for (const copy of ["route", "recovery-history", "receiver"] as const) {
      const d = readyForConfirmation();
      const material = d.state.material;
      if (!material) throw new Error("Expected a material slice.");
      d.state = {
        ...d.state,
        material: {
          ...material,
          productRecords: copy === "route"
            ? material.productRecords.map((record) => ({
                ...record,
                measurementEvidenceIds: [],
                routeEvidenceIds: [],
                recoveryEvidenceIds: [],
                sourceInventoryMassG: record.sourceInventoryMassG + 0.1,
                sourceInventoryEquivalentMassG: record.sourceInventoryEquivalentMassG + 0.1,
              }))
            : material.productRecords,
          recoveryRecords: copy === "recovery-history"
            ? material.recoveryRecords.map((record) =>
                record.stream === "heated-product"
                  ? {
                      ...record,
                      measurementEvidenceIds: [],
                      routeEvidenceIds: [],
                      recoveryEvidenceIds: [],
                      sourceInventoryMassG: record.sourceInventoryMassG + 0.1,
                      sourceInventoryEquivalentMassG: record.sourceInventoryEquivalentMassG + 0.1,
                    }
                  : record,
              )
            : material.recoveryRecords,
          instances: copy === "receiver"
            ? material.instances.map((instance) =>
                instance.id === material.holders.productRecoveryInstanceId
                  ? {
                      ...instance,
                      contents: {
                        ...instance.contents,
                        qualitativeSolidProvenance:
                          instance.contents.qualitativeSolidProvenance?.map((record) => ({
                            ...record,
                            measurementEvidenceIds: [],
                            routeEvidenceIds: [],
                            recoveryEvidenceIds: [],
                            sourceInventoryMassG: record.sourceInventoryMassG + 0.1,
                            sourceInventoryEquivalentMassG:
                              record.sourceInventoryEquivalentMassG + 0.1,
                          })),
                      },
                    }
                  : instance,
              )
            : material.instances,
        },
      };
      expect(d.reject("recover-final-product", closedPayload(d))).toBe(
        "recovery-reconciliation-failed",
      );
    }
  });

  it("binds each unheated evidence array to the actual replicate packet", () => {
    for (const field of [
      "measurementEvidenceIds",
      "routeEvidenceIds",
      "recoveryEvidenceIds",
    ] as const) {
      const d = readyForConfirmation();
      const material = d.state.material;
      if (!material) throw new Error("Expected a material slice.");
      d.state = {
        ...d.state,
        material: {
          ...material,
          recoveryRecords: material.recoveryRecords.map((record) =>
            record.stream === "unheated" && record.operationId === "recover-unused-sample"
              ? { ...record, [field]: [] }
              : record,
          ),
        },
      };
      expect(d.reject("recover-final-product", closedPayload(d))).toBe(
        "recovery-reconciliation-failed",
      );
    }
  });

  it("refuses an unheated receiver whose gram-solute total disagrees with returned mass", () => {
    const d = readyForConfirmation();
    const material = d.state.material;
    if (!material) throw new Error("Expected a material slice.");
    d.state = {
      ...d.state,
      material: {
        ...material,
        instances: material.instances.map((instance) =>
          instance.id === material.holders.unusedRecoveryInstanceId
            ? {
                ...instance,
                contents: {
                  ...instance.contents,
                  solutes: instance.contents.solutes.map((solute, index) =>
                    index === 0 ? { ...solute, amount: solute.amount + 0.1 } : solute,
                  ),
                },
              }
            : instance,
        ),
      },
    };
    expect(d.reject("recover-final-product", closedPayload(d))).toBe(
      "recovery-reconciliation-failed",
    );
  });

  it("binds the master closure record to its actual finalizer evidence", () => {
    const d = readyForConfirmation();
    const material = d.state.material;
    if (!material) throw new Error("Expected a material slice.");
    d.state = {
      ...d.state,
      material: {
        ...material,
        recoveryRecords: material.recoveryRecords.map((record) =>
          record.operationId === "finalize-unused-master-stock"
            ? { ...record, routeEvidenceIds: ["altered-closure-evidence"] }
            : record,
        ),
      },
    };
    expect(d.reject("recover-final-product", closedPayload(d))).toBe(
      "recovery-reconciliation-failed",
    );
  });
});

describe("a run where every return is a truthful zero", () => {
  it("completes with the Unused Sample container genuinely empty", () => {
    const d = driver("zero-run");
    approve(d);
    // The working portion is exactly the approved portion, so no replicate has anything to return
    // and the stock is issued down to nothing.
    configureStock(d, 4, 2);
    walkReplicate(d, 0);
    walkReplicate(d, 1);
    expect(d.state.material?.completed.every((entry) => entry.excessReturnedG === 0)).toBe(true);
    d.run("finalize-unused-master-stock", {
      sourceInstanceId: holders(d.state).masterStockInstanceId,
      targetInstanceId: holders(d.state).unusedRecoveryInstanceId,
    });
    expect(d.state.material?.closure?.masterRemainderReturnedG).toBe(0);
    const unused = held(d.state, holders(d.state).unusedRecoveryInstanceId);
    expect(unused.kind).toBe("empty");
    expect(unused.massG ?? 0).toBe(0);
    expect(unused.qualitativeSolidProvenance).toBeUndefined();
    d.run("calculate-carbonate-composition", {
      ...closedPayload(d),
      calculationId: "composition-analysis",
      validated: true,
    });
    d.run("record-composition-uncertainty", {
      ...closedPayload(d),
      note: "Balance resolution dominates.",
    });
    d.run("recover-final-product", closedPayload(d));
    expect(d.state.productRecovered).toBe(true);
  });
});

describe("an extra replicate beyond the approved minimum", () => {
  it("draws another full working portion and is frozen into the closed set", () => {
    const d = driver();
    approve(d);
    configureStock(d, 12, 2.5);
    walkReplicate(d, 0);
    walkReplicate(d, 1);
    walkReplicate(d, 2);
    expect(d.state.completedReplicates).toHaveLength(3);
    d.run("finalize-unused-master-stock", {
      sourceInstanceId: holders(d.state).masterStockInstanceId,
      targetInstanceId: holders(d.state).unusedRecoveryInstanceId,
    });
    expect(d.state.material?.closure?.frozenReplicates).toEqual([1, 2, 3]);
    expect(d.state.material?.closure?.masterRemainderReturnedG).toBe(4.5);
    expect(held(d.state, holders(d.state).unusedRecoveryInstanceId).massG).toBe(6);
  });
});

describe("reset", () => {
  it("starts a fresh open run with a new id and no inherited material", () => {
    const d = driver();
    approve(d);
    configureStock(d, 12, 2.5);
    walkReplicate(d, 0);
    const previousRunId = d.state.runId;
    d.reset();
    expect(d.state.runId).not.toBe(previousRunId);
    expect(d.state.runPhase).toBe("open");
    expect(d.state.material).toBeUndefined();
    expect(d.state.completedReplicates).toHaveLength(0);
    expect(d.state.evidence).toHaveLength(0);
  });
});
