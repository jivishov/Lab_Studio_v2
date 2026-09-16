import { describe, expect, it } from "vitest";
import {
  emptyContents,
  type ContentState,
  type EquipmentInstance,
  type QualitativeSolidProvenanceRecord,
} from "../../domain/types";
import { equipmentById } from "../../equipment/catalog";
import {
  legacySolidInventoryMassG,
  resolvePhysicalSolidInventoryMassG,
  wholeRemainingSolidEligibility,
} from "../contentTransfer";
import {
  initializeConfiguredSolidStock,
  transferSolid,
  type SolidMaterialSlice,
  type SolidTransferIdentityConstraints,
} from "../solidMaterial";

/**
 * Invariant tests for the shared solid-material helpers.
 *
 * These are unit fixtures, not a traversal: several of them construct states no authored run can
 * reach, precisely because the helpers must refuse them rather than silently complete. Anything
 * that asserts learner-visible ordering belongs in the route and runtime suites instead.
 */

const instance = (
  id: string,
  definitionId: string,
  contents: ContentState = emptyContents(),
): EquipmentInstance => ({
  id,
  definitionId,
  label: id,
  location: "workbench",
  contents,
});

const solid = (massG: number, soluteId = "carbonate-mixture-undisclosed"): ContentState => ({
  ...emptyContents("NaHCO3 and Na2CO3 mixture; composition not disclosed"),
  kind: "solid",
  massG,
  solutes: [{
    id: soluteId,
    label: soluteId === "carbonate-mixture-undisclosed"
      ? "NaHCO3 and Na2CO3 mixture; composition not disclosed"
      : "Mixture",
    amount: massG,
    unit: "g",
  }],
  visualState: "powder",
});

/** A shipped legacy form: gram solutes and no declared `massG`. */
const legacySolid = (massG: number): ContentState => ({
  ...emptyContents("Legacy solid"),
  kind: "solid",
  solutes: [{ id: "legacy", label: "Legacy", amount: massG, unit: "g" }],
  visualState: "powder",
});

const slice = (...instances: EquipmentInstance[]): SolidMaterialSlice => ({
  instances,
  stockInitializations: {},
});

const contentsOf = (instances: readonly EquipmentInstance[], id: string): ContentState => {
  const found = instances.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Expected instance ${id}.`);
  return found.contents;
};

const provenance = (
  overrides: Partial<QualitativeSolidProvenanceRecord> = {},
): QualitativeSolidProvenanceRecord => ({
  recordId: "run-1--replicate-1--recover-replicate-product",
  runId: "run-1",
  replicate: 1,
  operationId: "recover-replicate-product",
  stream: "heated-product",
  sourceMaterialId: "carbonate-mixture-undisclosed",
  sourceMaterialLabel: "NaHCO3 and Na2CO3 mixture; composition not disclosed",
  sourceInstanceId: "crucible-with-lid-1",
  destinationInstanceId: "heated-product-recovery-1",
  sourceActionId: "recover-replicate-product",
  quantityBasis: "source-inventory-equivalent",
  sourceInventoryMassG: 2,
  sourceInventoryEquivalentMassG: 2,
  destinationPhysicalMassKnown: false,
  measurementEvidenceIds: ["replicate-1-loaded-mass"],
  recoveryEvidenceIds: ["thermal-decomposition--replicate-recovery"],
  routeEvidenceIds: ["thermal-decomposition--loaded-mass-record"],
  ...overrides,
});

const qualitativeConstraints: SolidTransferIdentityConstraints = {
  materialId: "carbonate-mixture-undisclosed",
  materialLabel: "NaHCO3 and Na2CO3 mixture; composition not disclosed",
  destinationStream: "heated-product",
  runId: "run-1",
  replicate: 1,
  sourceActionId: "recover-replicate-product",
};

const qualitativeSlice = () =>
  slice(
    instance("crucible-with-lid-1", "crucible-with-lid", solid(2)),
    instance("heated-product-recovery-1", "beaker-250ml"),
  );

const qualitativeRequest = (
  record: QualitativeSolidProvenanceRecord = provenance(),
  constraints: SolidTransferIdentityConstraints | undefined = qualitativeConstraints,
) =>
  ({
    mode: "whole-remaining",
    sourceInstanceId: "crucible-with-lid-1",
    targetInstanceId: "heated-product-recovery-1",
    requireNonEmptySource: true,
    destinationRepresentation: "qualitative-unknown",
    provenance: record,
    constraints,
  }) as const;

describe("shared solid inventory resolution", () => {
  it("keeps resolving a legacy gram-solute inventory that declares no massG", () => {
    // R-11: shipped content relies on both forms. A `massG`-presence test would strand the second.
    expect(legacySolidInventoryMassG(legacySolid(3))).toBe(3);
    expect(resolvePhysicalSolidInventoryMassG(legacySolid(3))).toBe(3);
  });

  it("refuses to read a recovered solid of unknown quantity as a physical inventory", () => {
    const receiver: ContentState = {
      ...emptyContents("Product Made from Heating Samples"),
      kind: "solid",
      qualitativeSolidProvenance: [provenance()],
    };
    expect(resolvePhysicalSolidInventoryMassG(receiver)).toBeUndefined();
    const eligibility = wholeRemainingSolidEligibility(receiver, { requireNonEmptySource: true });
    expect(eligibility.ok).toBe(false);
  });

  it("separates a genuinely empty container from a contradictory one", () => {
    const genuinelyEmpty = wholeRemainingSolidEligibility(emptyContents(), {
      requireNonEmptySource: false,
    });
    expect(genuinelyEmpty).toMatchObject({ ok: true, noOp: true, massG: 0 });

    // `empty` cannot truthfully coexist with material, and a residual step must not write it off.
    const contradictory = wholeRemainingSolidEligibility(
      { ...emptyContents(), solutes: [{ id: "x", label: "x", amount: 1, unit: "g" }] },
      { requireNonEmptySource: false },
    );
    expect(contradictory.ok).toBe(false);
  });

  it("refuses a solid that also carries a liquid phase or a precipitate", () => {
    const wet: ContentState = { ...solid(2), volumeMl: 5 };
    expect(wholeRemainingSolidEligibility(wet, { requireNonEmptySource: true }).ok).toBe(false);
    expect(resolvePhysicalSolidInventoryMassG(wet)).toBeUndefined();
  });
});

describe("transferSolid physical modes", () => {
  it("splits a measured portion at six decimals and leaves the rest on the source", () => {
    const outcome = transferSolid(
      slice(
        instance("sample-bottle-1", "sample-bottle", solid(12)),
        instance("working-sample-portion-1", "small-vial"),
      ),
      {
        mode: "measured-portion",
        sourceInstanceId: "sample-bottle-1",
        targetInstanceId: "working-sample-portion-1",
        massG: 2.5,
      },
      equipmentById,
    );
    expect(outcome.ok).toBe(true);
    expect(contentsOf(outcome.instances, "sample-bottle-1").massG).toBe(9.5);
    expect(contentsOf(outcome.instances, "working-sample-portion-1").massG).toBe(2.5);
    expect(outcome.movedSourceInventoryMassG).toBe(2.5);
    expect(outcome.destinationPhysicalMassKnown).toBe(true);
  });

  it("refuses a portion larger than the source without touching either container", () => {
    const before = slice(
      instance("sample-bottle-1", "sample-bottle", solid(1)),
      instance("working-sample-portion-1", "small-vial"),
    );
    const outcome = transferSolid(
      before,
      {
        mode: "measured-portion",
        sourceInstanceId: "sample-bottle-1",
        targetInstanceId: "working-sample-portion-1",
        massG: 2.5,
      },
      equipmentById,
    );
    expect(outcome.ok).toBe(false);
    expect(contentsOf(outcome.instances, "sample-bottle-1").massG).toBe(1);
    expect(contentsOf(outcome.instances, "working-sample-portion-1").kind).toBe("empty");
  });

  it("completes a whole-remaining transfer from a genuinely empty source as a zero no-op", () => {
    // R-05: when the issued portion equals the planned portion there is nothing to return, and the
    // labelled container must stay genuinely empty rather than gain an empty delivery.
    const outcome = transferSolid(
      slice(
        instance("working-sample-portion-1", "small-vial"),
        instance("unused-sample-recovery-1", "beaker-250ml"),
      ),
      {
        mode: "whole-remaining",
        sourceInstanceId: "working-sample-portion-1",
        targetInstanceId: "unused-sample-recovery-1",
        requireNonEmptySource: false,
        destinationRepresentation: "physical",
      },
      equipmentById,
    );
    expect(outcome).toMatchObject({ ok: true, noOp: true, movedSourceInventoryMassG: 0 });
    expect(contentsOf(outcome.instances, "unused-sample-recovery-1").kind).toBe("empty");
    expect(
      contentsOf(outcome.instances, "unused-sample-recovery-1").qualitativeSolidProvenance,
    ).toBeUndefined();
  });

  it("accumulates successive physical returns in the same labelled container", () => {
    const first = transferSolid(
      slice(
        instance("working-sample-portion-1", "small-vial", solid(0.5)),
        instance("unused-sample-recovery-1", "beaker-250ml"),
      ),
      {
        mode: "whole-remaining",
        sourceInstanceId: "working-sample-portion-1",
        targetInstanceId: "unused-sample-recovery-1",
        requireNonEmptySource: false,
        destinationRepresentation: "physical",
      },
      equipmentById,
    );
    expect(first.ok).toBe(true);
    const second = transferSolid(
      {
        instances: first.instances.map((candidate) =>
          candidate.id === "working-sample-portion-1"
            ? { ...candidate, contents: solid(0.5) }
            : candidate,
        ),
        stockInitializations: {},
      },
      {
        mode: "whole-remaining",
        sourceInstanceId: "working-sample-portion-1",
        targetInstanceId: "unused-sample-recovery-1",
        requireNonEmptySource: false,
        destinationRepresentation: "physical",
      },
      equipmentById,
    );
    expect(second.ok).toBe(true);
    expect(contentsOf(second.instances, "unused-sample-recovery-1").massG).toBe(1);
  });

  it("refuses a strict physical receiver with a different material identity", () => {
    const before = slice(
      instance("sample-bottle-1", "sample-bottle", solid(2)),
      instance("unused-sample-recovery-1", "beaker-250ml", solid(1, "different-solid")),
    );
    const outcome = transferSolid(
      before,
      {
        mode: "whole-remaining",
        sourceInstanceId: "sample-bottle-1",
        targetInstanceId: "unused-sample-recovery-1",
        requireNonEmptySource: true,
        destinationRepresentation: "physical",
        constraints: {
          materialId: "carbonate-mixture-undisclosed",
          materialLabel: "NaHCO3 and Na2CO3 mixture; composition not disclosed",
          destinationStream: "unheated",
          runId: "run-1",
          sourceActionId: "recover-unused-sample",
        },
      },
      equipmentById,
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain("different solid material");
    expect(outcome.instances).toEqual(before.instances);
  });

  it("refuses malformed qualitative provenance on a physical receiver atomically", () => {
    const malformedReceiver: ContentState = {
      ...emptyContents("Malformed receiver"),
      kind: "solid",
      qualitativeSolidProvenance: { malformed: true } as unknown as QualitativeSolidProvenanceRecord[],
    };
    const before = slice(
      instance("sample-bottle-1", "sample-bottle", solid(2)),
      instance("unused-sample-recovery-1", "beaker-250ml", malformedReceiver),
    );
    const outcome = transferSolid(
      before,
      {
        mode: "whole-remaining",
        sourceInstanceId: "sample-bottle-1",
        targetInstanceId: "unused-sample-recovery-1",
        requireNonEmptySource: true,
        destinationRepresentation: "physical",
      },
      equipmentById,
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain("malformed qualitative");
    expect(outcome.instances).toEqual(before.instances);
  });

});

describe("transferSolid qualitative destination", () => {
  it("records provenance and assigns the destination no mass", () => {
    const outcome = transferSolid(qualitativeSlice(), qualitativeRequest(), equipmentById);
    expect(outcome.ok).toBe(true);
    expect(outcome.destinationPhysicalMassKnown).toBe(false);
    const receiver = contentsOf(outcome.instances, "heated-product-recovery-1");
    expect(receiver.massG).toBeUndefined();
    expect(receiver.solutes).toEqual([]);
    expect(receiver.concentration).toBeUndefined();
    expect(receiver.qualitativeSolidProvenance).toHaveLength(1);
    expect(receiver.qualitativeSolidProvenance?.[0].sourceInventoryEquivalentMassG).toBe(2);
    expect(contentsOf(outcome.instances, "crucible-with-lid-1").kind).toBe("empty");
  });

  it("refuses qualitative recovery without complete trusted context atomically", () => {
    const before = qualitativeSlice();
    const requestWithoutContext = { ...qualitativeRequest(), constraints: undefined };
    expect(requestWithoutContext.constraints).toBeUndefined();
    const outcome = transferSolid(
      before,
      requestWithoutContext,
      equipmentById,
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain("complete trusted");
    expect(outcome.instances).toEqual(before.instances);
  });

  it("refuses each missing trusted context field atomically", () => {
    const missingFields: Array<Partial<SolidTransferIdentityConstraints>> = [
      { materialLabel: undefined },
      { destinationStream: undefined },
      { runId: undefined },
      { replicate: undefined },
      { sourceActionId: undefined },
    ];
    for (const missing of missingFields) {
      const before = qualitativeSlice();
      const outcome = transferSolid(
        before,
        qualitativeRequest(provenance(), { ...qualitativeConstraints, ...missing }),
        equipmentById,
      );
      expect(outcome.ok).toBe(false);
      expect(outcome.message).toContain("complete trusted");
      expect(outcome.instances).toEqual(before.instances);
    }
  });

  it("refuses a request bound to a different source container", () => {
    const before = qualitativeSlice();
    const outcome = transferSolid(
      before,
      { ...qualitativeRequest(), sourceInstanceId: "another-crucible" },
      equipmentById,
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain("not on the bench");
    expect(outcome.instances).toEqual(before.instances);
  });

  it("refuses a record bound to a different source container", () => {
    const before = qualitativeSlice();
    const outcome = transferSolid(
      before,
      qualitativeRequest(provenance({ sourceInstanceId: "another-crucible" })),
      equipmentById,
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain("named source and destination");
    expect(outcome.instances).toEqual(before.instances);
  });

  it("refuses a record bound to a different run", () => {
    const before = qualitativeSlice();
    const outcome = transferSolid(
      before,
      qualitativeRequest(provenance({ runId: "run-2" })),
      equipmentById,
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain("different run");
    expect(outcome.instances).toEqual(before.instances);
  });

  it("refuses a record bound to a different replicate", () => {
    const before = qualitativeSlice();
    const outcome = transferSolid(
      before,
      qualitativeRequest(provenance({ replicate: 2 })),
      equipmentById,
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain("different replicate");
    expect(outcome.instances).toEqual(before.instances);
  });

  it("refuses a source whose actual material identity differs from trusted context", () => {
    const before = slice(
      instance("crucible-with-lid-1", "crucible-with-lid", solid(2, "different-solid")),
      instance("heated-product-recovery-1", "beaker-250ml"),
    );
    const outcome = transferSolid(before, qualitativeRequest(), equipmentById);
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain("different solid material");
    expect(outcome.instances).toEqual(before.instances);
  });

  it("accumulates qualitative replicates while validating history against the route stream identity", () => {
    const first = transferSolid(qualitativeSlice(), qualitativeRequest(), equipmentById);
    expect(first.ok).toBe(true);

    const second = transferSolid(
      {
        instances: first.instances.map((candidate) =>
          candidate.id === "crucible-with-lid-1"
            ? { ...candidate, contents: solid(2) }
            : candidate,
        ),
        stockInitializations: {},
      },
      qualitativeRequest(
        provenance({
          recordId: "run-1--replicate-2--recover-replicate-product",
          replicate: 2,
        }),
        { ...qualitativeConstraints, replicate: 2 },
      ),
      equipmentById,
    );
    expect(second.ok).toBe(true);
    expect(contentsOf(second.instances, "heated-product-recovery-1").qualitativeSolidProvenance)
      .toHaveLength(2);
  });

  it("refuses malformed historical qualitative provenance before moving a later product", () => {
    const malformedHistory: ContentState = {
      ...emptyContents("Product Made from Heating Samples"),
      kind: "solid",
      qualitativeSolidProvenance: [
        provenance({ sourceMaterialLabel: "A different solid" }),
      ],
    };
    const before = slice(
      instance("crucible-with-lid-1", "crucible-with-lid", solid(2)),
      instance("heated-product-recovery-1", "beaker-250ml", malformedHistory),
    );
    const outcome = transferSolid(
      before,
      qualitativeRequest(
        provenance({
          recordId: "run-1--replicate-2--recover-replicate-product",
          replicate: 2,
        }),
        { ...qualitativeConstraints, replicate: 2 },
      ),
      equipmentById,
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.instances).toEqual(before.instances);
  });

  it("refuses a record whose stated quantity is not the resolved source inventory", () => {
    const outcome = transferSolid(
      qualitativeSlice(),
      qualitativeRequest(provenance({ sourceInventoryMassG: 5, sourceInventoryEquivalentMassG: 5 })),
      equipmentById,
    );
    expect(outcome.ok).toBe(false);
    expect(contentsOf(outcome.instances, "crucible-with-lid-1").massG).toBe(2);
  });

  it("refuses malformed evidence and a wrong route identity before moving material", () => {
    const before = qualitativeSlice();
    const malformed = transferSolid(
      before,
      qualitativeRequest(
        provenance({ measurementEvidenceIds: [""] }),
        {
          materialId: "carbonate-mixture-undisclosed",
          materialLabel: "NaHCO3 and Na2CO3 mixture; composition not disclosed",
          destinationStream: "heated-product",
          runId: "run-1",
          replicate: 1,
          sourceActionId: "recover-replicate-product",
        },
      ),
      equipmentById,
    );
    expect(malformed.ok).toBe(false);
    expect(malformed.instances).toEqual(before.instances);

    const wrongMaterial = transferSolid(
      before,
      qualitativeRequest(provenance(), {
        materialId: "different-solid",
        materialLabel: "Different solid",
        destinationStream: "heated-product",
        runId: "run-1",
        replicate: 1,
        sourceActionId: "recover-replicate-product",
      }),
      equipmentById,
    );
    expect(wrongMaterial.ok).toBe(false);
    expect(wrongMaterial.instances).toEqual(before.instances);
  });

  it("refuses a provenance record bound to another replicate or stream", () => {
    const outcome = transferSolid(
      qualitativeSlice(),
      qualitativeRequest(provenance(), {
        materialId: "carbonate-mixture-undisclosed",
        materialLabel: "NaHCO3 and Na2CO3 mixture; composition not disclosed",
        destinationStream: "unheated",
        runId: "run-1",
        replicate: 2,
        sourceActionId: "recover-replicate-product",
      }),
      equipmentById,
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain("recovery stream");
  });

  it("refuses a duplicate record and a foreign run in the same container", () => {
    const first = transferSolid(qualitativeSlice(), qualitativeRequest(), equipmentById);
    expect(first.ok).toBe(true);
    const occupied = {
      instances: first.instances.map((candidate) =>
        candidate.id === "crucible-with-lid-1"
          ? { ...candidate, contents: solid(2) }
          : candidate,
      ),
      stockInitializations: {},
    };
    const duplicate = transferSolid(occupied, qualitativeRequest(), equipmentById);
    expect(duplicate.ok).toBe(false);

    const foreignRun = transferSolid(
      occupied,
      qualitativeRequest(
        provenance({ recordId: "run-2--replicate-1--recover-replicate-product", runId: "run-2" }),
      ),
      equipmentById,
    );
    expect(foreignRun.ok).toBe(false);
  });

  it("refuses a compatible-looking record from another source container", () => {
    const foreignRecord = provenance({
      recordId: "run-1--replicate-9--recover-replicate-product",
      replicate: 9,
      sourceInstanceId: "another-crucible",
    });
    const before = slice(
      instance("crucible-with-lid-1", "crucible-with-lid", solid(2)),
      instance(
        "heated-product-recovery-1",
        "beaker-250ml",
        {
          ...emptyContents("Product Made from Heating Samples"),
          kind: "solid",
          qualitativeSolidProvenance: [foreignRecord],
        },
      ),
    );
    const outcome = transferSolid(before, qualitativeRequest(), equipmentById);
    expect(outcome.ok).toBe(false);
    expect(outcome.instances).toEqual(before.instances);
  });

  it("refuses an empty crucible, because a lost residue is an error and not a no-op", () => {
    const outcome = transferSolid(
      slice(
        instance("crucible-with-lid-1", "crucible-with-lid"),
        instance("heated-product-recovery-1", "beaker-250ml"),
      ),
      qualitativeRequest(provenance({ sourceInventoryMassG: 0, sourceInventoryEquivalentMassG: 0 })),
      equipmentById,
    );
    expect(outcome.ok).toBe(false);
  });

  it("refuses a container holding physical material as a qualitative receiver", () => {
    const outcome = transferSolid(
      slice(
        instance("crucible-with-lid-1", "crucible-with-lid", solid(2)),
        instance("heated-product-recovery-1", "beaker-250ml", solid(1)),
      ),
      qualitativeRequest(),
      equipmentById,
    );
    expect(outcome.ok).toBe(false);
    expect(contentsOf(outcome.instances, "crucible-with-lid-1").massG).toBe(2);
  });

  it("refuses a destination the catalog does not let hold a solid", () => {
    const outcome = transferSolid(
      slice(
        instance("crucible-with-lid-1", "crucible-with-lid", solid(2)),
        instance("volumetric-flask-1", "graduated-cylinder"),
      ),
      { ...qualitativeRequest(), targetInstanceId: "volumetric-flask-1" },
      equipmentById,
    );
    expect(outcome.ok).toBe(false);
  });

  it("never shares a writable provenance record between two states", () => {
    const first = transferSolid(qualitativeSlice(), qualitativeRequest(), equipmentById);
    const carried = {
      instances: first.instances.map((candidate) =>
        candidate.id === "crucible-with-lid-1"
          ? { ...candidate, contents: solid(2) }
          : candidate,
      ),
      stockInitializations: {},
    };
    const second = transferSolid(
      carried,
      qualitativeRequest(
        provenance({
          recordId: "run-1--replicate-2--recover-replicate-product",
          replicate: 2,
        }),
        { ...qualitativeConstraints, replicate: 2 },
      ),
      equipmentById,
    );
    expect(second.ok).toBe(true);
    const earlier = contentsOf(first.instances, "heated-product-recovery-1")
      .qualitativeSolidProvenance?.[0];
    const later = contentsOf(second.instances, "heated-product-recovery-1")
      .qualitativeSolidProvenance?.[0];
    expect(later).not.toBe(earlier);
    expect(later?.measurementEvidenceIds).not.toBe(earlier?.measurementEvidenceIds);
    later?.measurementEvidenceIds.push("mutated");
    expect(earlier?.measurementEvidenceIds).toEqual(["replicate-1-loaded-mass"]);
  });

  it("refuses to use a recovered qualitative solid as a source for a measured portion", () => {
    const first = transferSolid(qualitativeSlice(), qualitativeRequest(), equipmentById);
    const outcome = transferSolid(
      { instances: first.instances, stockInitializations: {} },
      {
        mode: "measured-portion",
        sourceInstanceId: "heated-product-recovery-1",
        targetInstanceId: "crucible-with-lid-1",
        massG: 1,
      },
      equipmentById,
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain("unknown physical quantity");
  });
});

describe("configured solid stock initialization", () => {
  const stockSlice = () => slice(instance("sample-bottle-1", "sample-bottle"));

  const request = {
    instanceId: "sample-bottle-1",
    massG: 12,
    materialSoluteId: "carbonate-mixture-undisclosed",
    materialLabel: "NaHCO3 and Na2CO3 mixture; composition not disclosed",
    outputMeasurementId: "thermal-decomposition--unheated-stock-configured-g",
  };

  it("issues the configured total once and records the ledger entry", () => {
    const outcome = initializeConfiguredSolidStock(stockSlice(), request, equipmentById);
    expect(outcome.ok).toBe(true);
    expect(contentsOf(outcome.slice.instances, "sample-bottle-1").massG).toBe(12);
    expect(outcome.slice.stockInitializations["sample-bottle-1"]).toMatchObject({
      massG: 12,
      materialSoluteId: "carbonate-mixture-undisclosed",
    });
  });

  it("refuses a second initialization, a non-positive total and a foreign component", () => {
    // The one-per-setup lock, not the remaining mass, is what refuses a second initialization -
    // the same rule the reducer's source-inventory branch enforces.
    const first = initializeConfiguredSolidStock(stockSlice(), request, equipmentById);
    expect(
      initializeConfiguredSolidStock(first.slice, request, equipmentById).ok,
    ).toBe(false);
    expect(
      initializeConfiguredSolidStock(stockSlice(), { ...request, massG: 0 }, equipmentById).ok,
    ).toBe(false);
    expect(
      initializeConfiguredSolidStock(
        slice(instance("sample-bottle-1", "sample-bottle", solid(1, "some-other-solid"))),
        request,
        equipmentById,
      ).ok,
    ).toBe(false);
  });

  it("refuses a container the catalog will not let deliver a solid", () => {
    expect(
      initializeConfiguredSolidStock(
        slice(instance("sample-bottle-1", "analytical-balance")),
        request,
        equipmentById,
      ).ok,
    ).toBe(false);
  });

  it("refuses to overwrite a qualitative recovery receiver", () => {
    const receiver: ContentState = {
      ...emptyContents("Recovered product"),
      kind: "solid",
      qualitativeSolidProvenance: [provenance()],
    };
    const before = slice(instance("sample-bottle-1", "sample-bottle", receiver));
    const outcome = initializeConfiguredSolidStock(before, request, equipmentById);
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain("holds material");
    expect(outcome.slice).toEqual(before);
  });
});
