import { describe, expect, it } from "vitest";
import {
  create96WellPlateState,
} from "../../plate";
import {
  SINGLE_CHANNEL_P200,
  UNIVERSAL_200_UL_TIP,
} from "../../pipetting";
import {
  createAssayRuntimeState,
  operationFromIntent,
} from "../../runtime";
import {
  createCycle09AssayPlanningRequest,
  createCycle09PlanningArtifact,
  getCycle09AssayPlanningFixture,
} from "../__fixtures__/cycle09PlanningFixture";
import { planAssayRun, projectAssayRunPlanEvidence } from "../planner";
import { validateAssayPlanningProfile } from "../validation";

const requirement = (
  resourceId: string,
  fixture = getCycle09AssayPlanningFixture(),
) => {
  const line = fixture.result.plan.requirements.find(
    (candidate) => candidate.resourceId === resourceId,
  );
  if (!line) throw new Error(`Missing requirement ${resourceId}.`);
  return line;
};

describe("Cycle 09 assay operational planning", () => {
  it("validates and versions the explicit planning profile", () => {
    const request = createCycle09AssayPlanningRequest();
    const roundTrip = validateAssayPlanningProfile(
      JSON.parse(JSON.stringify(request.profile)),
    );
    expect(roundTrip.ok).toBe(true);
    if (roundTrip.ok) expect(roundTrip.value).toEqual(request.profile);
    expect(validateAssayPlanningProfile({
      ...request.profile,
      schemaVersion: "2.0",
    }).ok).toBe(false);
    expect(validateAssayPlanningProfile({
      ...request.profile,
      providerFileId: "file-secret-handle",
    }).ok).toBe(false);
    expect(validateAssayPlanningProfile({
      ...request.profile,
      phases: [{
        id: "broken",
        label: "Broken",
        kind: "read",
        capacityResourceId: "missing-reader",
      }],
    }).ok).toBe(false);
  });

  it("derives multichannel tips and external liquid from the accepted operation graph", () => {
    const fixture = getCycle09AssayPlanningFixture();
    expect(fixture.result.status).toBe("complete");
    expect(fixture.result.operationSummary.operationCount).toBe(137);
    expect(fixture.result.operationSummary.plateRuns).toBe(6);
    expect(fixture.result.operationSummary.tipCountByType).toEqual([{
      tipTypeId: "assay.tip.universal-200uL",
      tipsPerPlate: 296,
      totalTips: 1776,
      boxCount: 19,
    }]);
    expect(fixture.result.operationSummary.externalLiquidBySource).toEqual([
      {
        sourceRef: "compound-stock",
        volumePerPlate: { value: "800", unit: "uL" },
      },
      {
        sourceRef: "diluent-reservoir",
        volumePerPlate: { value: "9600", unit: "uL" },
      },
    ]);
    expect(requirement("cycle09-200ul-tips", fixture).required.value).toBe("1776");
    expect(requirement("cycle09-200ul-tip-boxes", fixture).formulaTrace[0].expression)
      .toBe("ceil(1776 tips / 96 tips per box)");
  });

  it("counts a single-channel attachment as one tip rather than one well", () => {
    const artifact = createCycle09PlanningArtifact();
    const state = createAssayRuntimeState({
      runId: "cycle09-single-channel",
      plate: create96WellPlateState(artifact.plate),
      pipetteDefinitions: [SINGLE_CHANNEL_P200],
      tipDefinitions: [UNIVERSAL_200_UL_TIP],
      selectedPipetteId: SINGLE_CHANNEL_P200.id,
    });
    const request = createCycle09AssayPlanningRequest();
    request.initialRuntimeState = state;
    request.operations = [
      operationFromIntent(
        {
          type: "setVolume",
          pipetteId: SINGLE_CHANNEL_P200.id,
          volume: { value: "20", unit: "uL" },
        },
        "single:set",
      ),
      operationFromIntent(
        {
          type: "attachTips",
          pipetteId: SINGLE_CHANNEL_P200.id,
          tipTypeId: UNIVERSAL_200_UL_TIP.id,
        },
        "single:attach",
      ),
    ];
    request.resourceContext = {
      ...request.resourceContext,
      participants: 1,
      grouping: { kind: "group-size", groupSize: 1 },
      sections: [{ id: "single", participantCount: 1 }],
      availableInventory: [],
    };
    request.profile = {
      ...request.profile,
      operationLiquids: [],
      masterMixes: [],
    };
    const result = planAssayRun(artifact, request, "single-channel-plan");
    expect(result.operationSummary.tipCountByType[0]).toMatchObject({
      tipsPerPlate: 1,
      totalTips: 1,
      boxCount: 1,
    });
  });

  it("applies overage before per-batch dead volume exactly once", () => {
    const fixture = getCycle09AssayPlanningFixture();
    const diluent = requirement("cycle09-diluent", fixture);
    const stock = requirement("cycle09-stock", fixture);
    expect(diluent.required).toEqual({ value: "61480", unit: "uL" });
    expect(stock.required).toEqual({ value: "5680", unit: "uL" });
    expect(diluent.formulaTrace.map(({ label }) => label)).toEqual([
      "base requirement",
      "overage",
      "dead-volume",
    ]);
    expect(diluent.formulaTrace.filter(({ label }) => label === "overage")).toHaveLength(1);
    expect(diluent.formulaTrace.filter(({ label }) => label === "dead-volume")).toHaveLength(1);
  });

  it("splits master mix into explicit batches whose component totals match requirements", () => {
    const fixture = getCycle09AssayPlanningFixture();
    expect(fixture.result.masterMixBatches).toHaveLength(2);
    expect(fixture.result.masterMixBatches.map(({ plateCount }) => plateCount))
      .toEqual([3, 3]);
    expect(fixture.result.masterMixBatches.map((batch) =>
      batch.components.find(({ resourceId }) =>
        resourceId === "cycle09-master-mix-buffer")?.required.value))
      .toEqual(["24210", "24210"]);
    expect(requirement("cycle09-master-mix-buffer", fixture).required.value)
      .toBe("48420");
    expect(requirement("cycle09-master-mix-indicator", fixture).required.value)
      .toBe("5380");
  });

  it("counts plates and schedules durable instruments by capacity rather than consumption", () => {
    const fixture = getCycle09AssayPlanningFixture();
    expect(requirement("cycle09-96-well-plate", fixture).required.value).toBe("6");
    expect(requirement("cycle09-multichannel-pipette", fixture).required.value)
      .toBe("3");
    expect(requirement("cycle09-plate-reader", fixture).required.value).toBe("1");
    expect(fixture.result.plan.capacitySchedule).toEqual(expect.arrayContaining([
      expect.objectContaining({
        resourceId: "cycle09-multichannel-pipette",
        waves: 2,
        totalDuration: { value: "3300", unit: "s" },
      }),
      expect.objectContaining({
        resourceId: "cycle09-incubator",
        waves: 2,
        totalDuration: { value: "7500", unit: "s" },
      }),
      expect.objectContaining({
        resourceId: "cycle09-plate-reader",
        waves: 3,
        totalDuration: { value: "2040", unit: "s" },
      }),
    ]));
    expect(fixture.result.bottlenecks.map(({ resourceId }) => resourceId).sort()).toEqual([
      "cycle09-incubator",
      "cycle09-multichannel-pipette",
      "cycle09-plate-reader",
    ]);
    expect(fixture.result.phaseSchedule.at(-1)?.startsAfter.value).toBe("15240");

    const expandedRequest = createCycle09AssayPlanningRequest();
    expandedRequest.resourceContext = {
      ...expandedRequest.resourceContext,
      participants: 8,
      grouping: { kind: "group-size", groupSize: 2 },
      sections: [{ id: "expanded", participantCount: 8 }],
      repeats: 2,
      technicalReplicates: 2,
      availableInventory: [],
    };
    const expanded = planAssayRun(
      createCycle09PlanningArtifact(),
      expandedRequest,
      "expanded-plate-runs",
    );
    expect(expanded.operationSummary.plateRuns).toBe(16);
    expect(expanded.plan.requirements.find(
      ({ resourceId }) => resourceId === "cycle09-96-well-plate",
    )?.required.value).toBe("16");
  });

  it("reports shortages, incompatible units, and unresolved source metadata without guessing", () => {
    const artifact = createCycle09PlanningArtifact();
    const shortageRequest = createCycle09AssayPlanningRequest();
    const boxInventory = shortageRequest.resourceContext.availableInventory.find(
      ({ resourceId }) => resourceId === "cycle09-200ul-tip-boxes",
    );
    if (!boxInventory) throw new Error("Missing tip-box inventory fixture.");
    boxInventory.quantity.value = "18";
    const shortage = planAssayRun(artifact, shortageRequest, "shortage");
    expect(shortage.status).toBe("incomplete");
    expect(shortage.plan.shortages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        resourceId: "cycle09-200ul-tip-boxes",
        shortage: { value: "1", unit: "1" },
      }),
    ]));
    expect(shortage.inventoryComparison).toEqual(expect.arrayContaining([
      expect.objectContaining({
        resourceId: "cycle09-200ul-tip-boxes",
        status: "shortage",
        available: { value: "18", unit: "1" },
        shortage: { value: "1", unit: "1" },
      }),
    ]));

    const incompatibleRequest = createCycle09AssayPlanningRequest();
    const incompatible = incompatibleRequest.resourceContext.availableInventory.find(
      ({ resourceId }) => resourceId === "cycle09-200ul-tip-boxes",
    );
    if (!incompatible) throw new Error("Missing tip-box inventory fixture.");
    incompatible.quantity = { value: "18", unit: "uL" };
    expect(planAssayRun(artifact, incompatibleRequest, "incompatible").diagnostics)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ code: "planning.inventory.unit-incompatible" }),
      ]));

    const missingRequest = createCycle09AssayPlanningRequest();
    missingRequest.profile.operationLiquids =
      missingRequest.profile.operationLiquids.filter(
        ({ sourceRef }) => sourceRef !== "compound-stock",
      );
    expect(planAssayRun(artifact, missingRequest, "missing").diagnostics)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: "assay.planning.operation-liquid.metadata-missing",
        }),
      ]));
  });

  it("supports research-planning contexts and deterministic review-only exports", () => {
    const artifact = {
      ...createCycle09PlanningArtifact(),
      useBoundary: "research-planning" as const,
    };
    const request = createCycle09AssayPlanningRequest();
    const first = planAssayRun(artifact, request, "research-plan");
    const second = planAssayRun(artifact, request, "research-plan");
    expect(first).toEqual(second);
    expect(first.exports.requirementsCsv).toContain("resource_id,label");
    expect(first.exports.requirementsCsv).toContain("inventory_status");
    expect(first.exports.formulaTraceCsv).toContain("expression");
    expect(first.exports.scheduleCsv).toContain("phase_id,label,kind");
    expect(first.exports.checklistMarkdown).toContain(
      "No purchases, reservations, or inventory changes were performed.",
    );
    expect(projectAssayRunPlanEvidence(first)).toMatchObject({
      planId: "research-plan",
      status: "ready",
      requirementCount: first.plan.requirements.length,
    });
  });
});
