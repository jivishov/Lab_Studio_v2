import { describe, expect, it } from "vitest";
import { measuringVolumeTechnique, transferTechnique } from "../../domain/fixtures";
import type { ContentState } from "../../domain/types";
import {
  mergeTransferredContents,
  normalizeSolidTransferContract,
  splitContentForVolume,
} from "../contentTransfer";
import { createRuntimeState } from "../createRuntime";
import { performRuntimeAction } from "../reducer";

const solution = (volumeMl: number, amount: number): ContentState => ({
  kind: "solution",
  label: "0.100 M sodium chloride",
  volumeMl,
  solutes: [{ id: "nacl", label: "Sodium chloride", amount, unit: "mol" }],
  concentration: { value: 0.1, unit: "M" },
  contamination: [],
  wetState: "wet",
  visualState: "clear-solution",
});

describe("ordinary solution content transfer", () => {
  it("partitions volume and solute proportionally while preserving concentration", () => {
    const split = splitContentForVolume(solution(100, 0.01), 25);
    expect(split.transferredContents.volumeMl).toBe(25);
    expect(split.transferredContents.solutes[0]?.amount).toBeCloseTo(0.0025, 12);
    expect(split.remainingContents.volumeMl).toBe(75);
    expect(split.remainingContents.solutes[0]?.amount).toBeCloseTo(0.0075, 12);
    expect(split.transferredContents.concentration).toEqual({ value: 0.1, unit: "M" });
  });

  it("returns empty source content after a full transfer", () => {
    const split = splitContentForVolume(solution(50, 0.005), 50);
    expect(split.remainingContents).toMatchObject({ kind: "empty", solutes: [] });
    expect(split.remainingContents.volumeMl).toBeUndefined();
  });

  it("treats a zero-volume transfer as a canonical no-op split", () => {
    const source = solution(50, 0.005);
    const split = splitContentForVolume(source, 0);
    expect(split.transferredContents).toMatchObject({ kind: "empty", solutes: [] });
    expect(split.remainingContents).toEqual(source);
    expect(split.remainingContents).not.toBe(source);
    expect(mergeTransferredContents(source, split.transferredContents)).toEqual(source);
  });

  it("keeps rounded transferred and remaining amounts conserved", () => {
    const split = splitContentForVolume(solution(3, 0.000000000001), 1);
    const total = (split.transferredContents.solutes[0]?.amount ?? 0)
      + (split.remainingContents.solutes[0]?.amount ?? 0);
    expect(total).toBeCloseTo(0.000000000001, 12);
  });

  it("merges matching solutes by id and unit without merging incompatible units", () => {
    const target: ContentState = {
      ...solution(10, 0.001),
      solutes: [
        { id: "nacl", label: "Sodium chloride", amount: 0.001, unit: "mol" },
        { id: "nacl", label: "Sodium chloride", amount: 0.2, unit: "g" },
      ],
    };
    const transferred = splitContentForVolume(solution(20, 0.002), 10).transferredContents;
    const merged = mergeTransferredContents(target, transferred);
    expect(merged.volumeMl).toBe(20);
    expect(merged.solutes.filter((solute) => solute.id === "nacl" && solute.unit === "mol"))
      .toEqual([expect.objectContaining({ amount: 0.002 })]);
    expect(merged.solutes.some((solute) => solute.unit === "g" && solute.amount === 0.2)).toBe(true);
  });

  it("retains equal concentration only for compatible solute identities", () => {
    const compatible = mergeTransferredContents(
      solution(10, 0.001),
      solution(20, 0.002),
    );
    expect(compatible.concentration).toEqual({ value: 0.1, unit: "M" });

    const differentSolute: ContentState = {
      ...solution(20, 0.002),
      label: "0.100 M hydrochloric acid",
      solutes: [{ id: "hcl", label: "Hydrochloric acid", amount: 0.002, unit: "mol" }],
    };
    const incompatible = mergeTransferredContents(solution(10, 0.001), differentSolute);
    expect(incompatible.concentration).toBeUndefined();

    const inconsistentAmount = mergeTransferredContents(
      solution(10, 0.001),
      solution(20, 0.001),
    );
    expect(inconsistentAmount.concentration).toBeUndefined();
  });

  it("conserves solute through ordinary measureVolume and transfer reducer boundaries", () => {
    const measuring = structuredClone(measuringVolumeTechnique);
    const sample = measuring.initialState.equipment.find((item) => item.id === "sample-bottle-1")!;
    sample.contents = solution(120, 0.012);
    let measuredState = createRuntimeState(measuring);
    measuredState = performRuntimeAction(measuring, measuredState, { actionId: "place-cylinder", verb: "place" });
    measuredState = performRuntimeAction(measuring, measuredState, { actionId: "measure-20ml", verb: "measureVolume" });
    expect(measuredState.equipmentInstances.find((item) => item.id === "sample-bottle-1")?.contents.solutes[0]?.amount)
      .toBeCloseTo(0.01, 12);
    expect(measuredState.equipmentInstances.find((item) => item.id === "graduated-cylinder-1")?.contents.solutes[0]?.amount)
      .toBeCloseTo(0.002, 12);

    const transfer = structuredClone(transferTechnique);
    const cylinder = transfer.initialState.equipment.find((item) => item.id === "graduated-cylinder-1")!;
    cylinder.contents = solution(20, 0.002);
    let transferState = createRuntimeState(transfer);
    transferState = performRuntimeAction(transfer, transferState, { actionId: "place-beaker", verb: "place" });
    transferState = performRuntimeAction(transfer, transferState, { actionId: "transfer-sample", verb: "transfer" });
    expect(transferState.equipmentInstances.find((item) => item.id === "graduated-cylinder-1")?.contents.kind)
      .toBe("empty");
    expect(transferState.equipmentInstances.find((item) => item.id === "beaker-250ml-1")?.contents.solutes[0]?.amount)
      .toBeCloseTo(0.002, 12);
  });

  it("strictly bypasses the pivot when action metadata declares a specialized filtration path", () => {
    const transfer = structuredClone(transferTechnique);
    const cylinder = transfer.initialState.equipment.find((item) => item.id === "graduated-cylinder-1")!;
    cylinder.contents = solution(40, 0.004);
    const action = transfer.actions.find((item) => item.id === "transfer-sample")!;
    action.atomId = "atom.transfer.filtration-liquid";
    action.parameters.contentMovementMode = undefined;
    let state = createRuntimeState(transfer);
    state = performRuntimeAction(transfer, state, { actionId: "place-beaker", verb: "place" });
    state = performRuntimeAction(transfer, state, { actionId: "transfer-sample", verb: "transfer" });

    expect(state.equipmentInstances.find((item) => item.id === "graduated-cylinder-1")?.contents.solutes[0]?.amount)
      .toBeCloseTo(0.004, 12);
    expect(state.equipmentInstances.find((item) => item.id === "beaker-250ml-1")?.contents.solutes[0]?.amount)
      .toBeCloseTo(0.004, 12);
  });
});

describe("solid transfer contract normalization", () => {
  it("rejects an omitted typed non-empty requirement when the legacy alias requires it", () => {
    const result = normalizeSolidTransferContract(
      { mode: "whole-remaining" },
      { emptyRemainingSolid: true, requireNonEmptySolidSource: true },
    );
    expect(result).toMatchObject({ ok: false });
    if (result?.ok === false) {
      expect(result.message).toContain("conflicts with legacy parameters.requireNonEmptySolidSource");
    }
  });

  it("accepts the explicit typed equivalent of a legacy whole-solid requirement", () => {
    expect(
      normalizeSolidTransferContract(
        { mode: "whole-remaining", requireNonEmptySource: true },
        { emptyRemainingSolid: true, requireNonEmptySolidSource: true },
      ),
    ).toEqual({
      ok: true,
      contract: {
        mode: "whole-remaining",
        destinationRepresentation: "physical",
        requireNonEmptySource: true,
      },
    });
  });
});
