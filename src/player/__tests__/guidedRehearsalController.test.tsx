/**
 * Focused Cycle 04 source. Repository policy intentionally leaves this test unexecuted until a
 * later prompt authorizes React/Vitest runtime checks.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import rawLab from "../../../public/labs/acid-base-titration.json";
import rawTechnique from "../../../public/techniques/titration-endpoint.json";
import { hydrateBundledLab } from "../../data/hydrateBundledLab";
import {
  validateBundledLabSource,
  validateTechniqueDefinition,
} from "../../domain/validation";
import { defaultLabInventory, FINE_WINDOW_DROPS } from "../../experimentComposer/catalogs";
import { compileAcidBaseTitration } from "../../experimentComposer/compileAcidBaseTitration";
import type { ExperimentRequest, RehearsalController } from "../../experimentComposer/types";
import { serializedResultLength, type WebMCPResult } from "../../webmcp/result";
import { StudentPlayer } from "../StudentPlayer";
import { planCoarseTitration } from "../useGuidedRehearsalController";

const loadVerifiedSource = async () => {
  const lab = validateBundledLabSource(rawLab);
  const technique = validateTechniqueDefinition(rawTechnique);
  if (!lab.ok || !lab.value) throw new Error(lab.errors.join("; "));
  if (!technique.ok || !technique.value) throw new Error(technique.errors.join("; "));
  return hydrateBundledLab(lab.value, async () => technique.value!);
};

const request: ExperimentRequest = {
  schemaVersion: "1",
  familyId: "acid_base_titration_v1",
  expectedInventoryRevision: 1,
  objective: "Estimate the molarity of a synthetic monoprotic acid.",
  audience: "high_school",
  experience: "novice",
  durationMinutes: 45,
  deliveryContext: "virtual_training",
  aliquotVolumeMl: 25,
  endpointEvidence: "phenolphthalein",
};

const resultData = (result: WebMCPResult) => result.data as Record<string, unknown> | undefined;

describe("guided rehearsal Player bridge", () => {
  it("keeps current state, rejection recovery, coarse/drop/accept, reset, and assessment exclusion coherent", async () => {
    const source = await loadVerifiedSource();
    const compiled = await compileAcidBaseTitration(
      request,
      defaultLabInventory(),
      source,
      { stageRevision: 1, loadSource: loadVerifiedSource },
    );
    if (!compiled.ok) throw new Error(compiled.issues.map((issue) => issue.message).join("; "));

    let controller: RehearsalController | undefined;
    const onControllerChange = (next: RehearsalController | undefined) => { controller = next; };
    const view = render(
      <StudentPlayer
        definition={compiled.stage.definition}
        guidedRehearsal={{
          attemptId: "stage-1-attempt-1",
          onControllerChange,
        }}
      />,
    );
    await waitFor(() => expect(controller).toBeDefined());
    expect(screen.queryByRole("button", { name: "Assessment" })).not.toBeInTheDocument();
    const bridgeStatus = screen.getByLabelText("Guided rehearsal bridge status");
    expect(bridgeStatus).toHaveClass("sr-only");
    expect(bridgeStatus).toHaveAttribute("aria-live", "polite");
    expect(bridgeStatus).toHaveTextContent("Revision 0");

    const invoke = async <T,>(call: () => Promise<T>): Promise<T> => {
      let value!: T;
      await act(async () => { value = await call(); });
      return value;
    };
    const current = () => {
      if (!controller) throw new Error("Missing rehearsal controller.");
      return controller;
    };
    const signal = () => new AbortController().signal;

    const wrongStep = await invoke(() => current().operateTitration({ mode: "drop" }, signal()));
    expect(wrongStep).toMatchObject({ ok: false, code: "NOT_TITRATION_STEP" });
    expect(wrongStep.state.revision).toBe(1);
    expect(screen.getByText(/current step is not the titration delivery step/i)).toBeInTheDocument();

    const wrongTarget = await invoke(() => current().act({ sourceInstanceId: "burette-50ml-1" }, signal()));
    expect(wrongTarget.ok).toBe(false);
    expect(wrongTarget.state.revision).toBe(2);
    expect(screen.getByText(/selected source does not match/i)).toBeInTheDocument();
    expect((current().inspect() as Record<string, unknown>).attemptId).toBe("stage-1-attempt-1");
    expect(current().getRevision()).toBe(2);

    // These calls prove each handler reads the stateRef updated by the preceding action rather than
    // a registration-time/current-render closure.
    expect((await invoke(() => current().act({}, signal()))).ok).toBe(true); // place support
    expect((await invoke(() => current().act({}, signal()))).ok).toBe(true); // mount burette
    expect((await invoke(() => current().act({}, signal()))).ok).toBe(true); // read initial
    const revisionBeforeInitialEvidence = current().getRevision();
    expect((await invoke(() => current().recordEvidence(signal()))).ok).toBe(true);
    expect(current().getRevision()).toBe(revisionBeforeInitialEvidence + 1);
    expect((await invoke(() => current().act({}, signal()))).ok).toBe(true); // measure aliquot
    expect((await invoke(() => current().act({}, signal()))).ok).toBe(true); // transfer aliquot
    expect((await invoke(() => current().act({}, signal()))).ok).toBe(true); // indicator
    expect((await invoke(() => current().act({}, signal()))).ok).toBe(true); // position flask

    const earlyAccept = await invoke(() => current().operateTitration({ mode: "accept" }, signal()));
    expect(earlyAccept.ok).toBe(false);
    expect(earlyAccept.message).toMatch(/endpoint has not been reached/i);

    const revisionBeforeCoarse = current().getRevision();
    const coarse = await invoke(() => current().operateTitration({ mode: "coarse" }, signal()));
    expect(coarse.ok).toBe(true);
    expect(Number(resultData(coarse)?.addedVolumeMl)).toBeGreaterThan(0);
    expect(resultData(coarse)?.operationsAttempted).toBe(486);
    expect(resultData(coarse)?.recommendedMode).toBe("drop");
    expect(coarse.state.revision).toBe(
      revisionBeforeCoarse + Number(resultData(coarse)?.operationsAttempted),
    );
    expect(serializedResultLength(coarse)).toBeLessThanOrEqual(1_500);
    expect(JSON.stringify(coarse)).not.toMatch(/endpointDropCount|analyteMolarity|groundTruth/i);
    const repeatedCoarse = await invoke(() => current().operateTitration({ mode: "coarse" }, signal()));
    expect(repeatedCoarse).toMatchObject({ ok: false, code: "USE_SINGLE_DROP_MODE" });
    expect(repeatedCoarse.state.revision).toBe(coarse.state.revision + 1);

    for (let index = 0; index < FINE_WINDOW_DROPS; index += 1) {
      const drop = await invoke(() => current().operateTitration({ mode: "drop" }, signal()));
      expect(drop.ok).toBe(true);
      expect(resultData(drop)?.operationsAttempted).toBe(1);
    }
    expect((await invoke(() => current().operateTitration({ mode: "accept" }, signal()))).ok).toBe(true);
    const revisionBeforeIndicatorEvidence = current().getRevision();
    expect((await invoke(() => current().recordEvidence(signal()))).ok).toBe(true); // indicator evidence
    expect(current().getRevision()).toBe(revisionBeforeIndicatorEvidence + 1);
    const revisionBeforeFinalEvidence = current().getRevision();
    expect((await invoke(() => current().recordEvidence(signal()))).ok).toBe(true); // final reading
    expect(current().getRevision()).toBe(revisionBeforeFinalEvidence + 1);
    const revisionBeforeRejectedCalculation = current().getRevision();
    const rejectedCalculation = await invoke(() => current().submitCalculation({ value: 0.5 }, signal()));
    expect(rejectedCalculation).toMatchObject({ ok: false, code: "CALCULATION_INPUT_NOT_ACCEPTED" });
    expect(rejectedCalculation.state.revision).toBe(revisionBeforeRejectedCalculation + 1);
    const revisionBeforeCalculation = current().getRevision();
    const calculation = await invoke(() => current().submitCalculation({}, signal()));
    expect(calculation.ok).toBe(true);
    expect(calculation.state.revision).toBe(revisionBeforeCalculation + 1);
    expect(serializedResultLength(calculation)).toBeLessThanOrEqual(1_500);
    expect(JSON.stringify(calculation)).not.toMatch(/expected|analyteMolarity|endpointDropCount/i);
    expect(resultData(calculation)?.calculation).not.toHaveProperty("value");
    expect(JSON.stringify(calculation)).not.toContain(String(compiled.stage.blueprint.model.analyteMolarityM));

    const inspection = {
      ok: true,
      code: "REHEARSAL_INSPECTED",
      message: "Current guided rehearsal state inspected.",
      data: current().inspect(),
      state: { surface: "rehearsal" as const, revision: current().getRevision() },
    };
    expect(serializedResultLength(inspection)).toBeLessThanOrEqual(1_500);
    expect(JSON.stringify(inspection)).not.toContain(String(compiled.stage.blueprint.model.analyteMolarityM));

    const revisionBeforeReset = current().getRevision();
    const reset = await invoke(() => current().reset(signal()));
    expect(reset.ok).toBe(true);
    expect(reset.state.revision).toBe(revisionBeforeReset + 1);
    expect(resultData(reset)?.currentNode).toMatchObject({ id: "place-ring-stand-node" });
    expect(resultData(reset)?.evidenceCount).toBe(0);
    expect(serializedResultLength(reset)).toBeLessThanOrEqual(1_500);

    view.rerender(
      <StudentPlayer
        definition={compiled.stage.definition}
        guidedRehearsal={{
          attemptId: "stage-1-attempt-2",
          onControllerChange,
        }}
      />,
    );
    await waitFor(() => expect(current().getRevision()).toBe(0));
    expect((current().inspect() as Record<string, unknown>).attemptId).toBe("stage-1-attempt-2");
    expect((current().inspect() as Record<string, unknown>).currentNode).toMatchObject({
      id: "place-ring-stand-node",
    });
  });

  it("plans the exact fine-window boundary and distinguishes a capped coarse batch", () => {
    expect(planCoarseTitration(496, 0)).toEqual({
      status: "ready",
      count: 486,
      reachedFineWindow: true,
      capped: false,
    });
    expect(planCoarseTitration(496, 486)).toMatchObject({
      status: "use_single_drop",
      count: 0,
    });
    expect(planCoarseTitration(2_000, 0)).toEqual({
      status: "ready",
      count: 1_000,
      reachedFineWindow: false,
      capped: true,
    });
  });
});
