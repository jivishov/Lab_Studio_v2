import { describe, expect, it } from "vitest";
import { measuringVolumeTechnique } from "../../domain/fixtures";
import { createRuntimeState } from "../createRuntime";
import { runInteractionSequence } from "../interactionSequence";

describe("runInteractionSequence", () => {
  it("resolves every intent against the evolving reducer state", () => {
    const result = runInteractionSequence(
      measuringVolumeTechnique,
      createRuntimeState(measuringVolumeTechnique),
      [
        { type: "placeIntent", origin: "programmatic" },
        { type: "pourIntent", origin: "programmatic" },
        { type: "notebookRecordIntent", origin: "programmatic" },
      ],
    );

    expect(result.status).toBe("completed");
    expect(result.steps.map((step) => step.status)).toEqual(["accepted", "accepted", "accepted"]);
    expect(result.state.completedNodes).toEqual([
      "place-cylinder-node",
      "measure-sample-node",
      "record-volume-node",
    ]);
  });

  it("stops on the first resolver rejection and preserves recovery feedback", () => {
    const initial = createRuntimeState(measuringVolumeTechnique);
    const result = runInteractionSequence(measuringVolumeTechnique, initial, [
      {
        type: "placeIntent",
        origin: "programmatic",
        sourceInstanceId: "sample-bottle-1",
      },
      { type: "pourIntent", origin: "programmatic" },
    ]);

    expect(result.status).toBe("rejected");
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]).toMatchObject({ status: "rejected", nodeIdBefore: initial.currentNodeId });
    expect(result.feedback?.recovery).toBeTruthy();
    expect(result.state).toBe(initial);
  });

  it("stops on the first reducer rejection after resolution succeeds", () => {
    const definition = structuredClone(measuringVolumeTechnique);
    const recordAction = definition.actions.find((action) => action.id === "record-volume")!;
    recordAction.parameters.copyExistingMeasurementOnly = true;
    recordAction.prerequisites = [];
    const initial = {
      ...createRuntimeState(definition),
      currentNodeId: "record-volume-node",
    };
    const result = runInteractionSequence(definition, initial, [
      { type: "notebookRecordIntent", actionId: recordAction.id, origin: "programmatic" },
      { type: "notebookRecordIntent", actionId: recordAction.id, origin: "programmatic" },
    ]);

    expect(result.status).toBe("rejected");
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]).toMatchObject({
      status: "rejected",
      message: "No instrument reading is available to copy.",
    });
    expect(result.state.attemptHistory.at(-1)?.success).toBe(false);
  });

  it("stops before the next operation when aborted", () => {
    const controller = new AbortController();
    controller.abort("cancelled by test");
    const initial = createRuntimeState(measuringVolumeTechnique);
    const result = runInteractionSequence(
      measuringVolumeTechnique,
      initial,
      [{ type: "placeIntent", origin: "programmatic" }],
      controller.signal,
    );

    expect(result.status).toBe("aborted");
    expect(result.steps).toEqual([]);
    expect(result.state).toBe(initial);
  });

  it("publishes partial progress when cancellation is observed between operations", () => {
    let abortChecks = 0;
    const signal = {
      get aborted() {
        abortChecks += 1;
        return abortChecks >= 2;
      },
    } as AbortSignal;
    const initial = createRuntimeState(measuringVolumeTechnique);
    const result = runInteractionSequence(
      measuringVolumeTechnique,
      initial,
      [
        { type: "placeIntent", origin: "programmatic" },
        { type: "pourIntent", origin: "programmatic" },
      ],
      signal,
    );

    expect(result.status).toBe("aborted");
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]).toMatchObject({ status: "accepted", intentType: "placeIntent" });
    expect(result.state.completedNodes).toEqual(["place-cylinder-node"]);
  });
});
