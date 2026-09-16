import { describe, expect, it } from "vitest";
import rawTechnique from "../../../public/techniques/titration-endpoint.json";
import type { ActionDefinition, TechniqueDefinition } from "../../domain/types";
import { createRuntimeState } from "../createRuntime";
import { makeAttachmentRelation } from "../attachments";
import { executeTitrationStep } from "../titrationProcedure";

// Authored for the shared contract; intentionally not executed under the repository QA ceiling.
function fixture() {
  const definition = rawTechnique as unknown as TechniqueDefinition;
  const action = structuredClone(definition.actions.find(a => a.parameters.titrationOperation === "deliver")!);
  Object.assign(action.parameters, { maximumIncrementMl: 1, maximumDeliveryMl: 45, endpointWindowMl: 0.05, persistenceSeconds: 5 });
  const p = action.parameters;
  const state = createRuntimeState(definition);
  const source = state.equipmentInstances.find(e => e.id === p.buretteInstanceId)!;
  const receiver = state.equipmentInstances.find(e => e.id === p.receiverInstanceId)!;
  const stand = state.equipmentInstances.find(e => e.definitionId === "ring-stand-clamp")!;
  source.contents = { ...source.contents, kind: "liquid", volumeMl: 50 };
  receiver.contents = { ...receiver.contents, kind: "liquid", volumeMl: 25 };
  state.attachments = [makeAttachmentRelation(stand.id, source.id, "ring-stand-burette-clamp")!, makeAttachmentRelation(stand.id, receiver.id, "ring-stand-burette-receiver")!];
  state.titrationTrials = { [String(p.trialReferenceId)]: { initial: 0, delivered: 0, aliquot: 25, revision: 0, mixedRevision: 0, observedRevision: -1, recordedRevision: -1, color: "clear", accepted: false, points: [], readingsRecorded: [String(p.initialMeasurementId)], attempt: 1 } };
  return { definition, action, state, source, receiver };
}

describe("atomic titration evidence", () => {
  it("conserves the learner-selected delivery and rejects a second unrecorded addition", () => {
    const { definition, state, action, source, receiver } = fixture();
    const result = executeTitrationStep(definition, state, action, { verb: "transfer", value: 0.4 }, "delivery");
    expect(result.ok).toBe(true);
    expect(result.state.equipmentInstances.find(e => e.id === source.id)!.contents.volumeMl).toBeCloseTo(49.6);
    expect(result.state.equipmentInstances.find(e => e.id === receiver.id)!.contents.volumeMl).toBeCloseTo(25.4);
    expect(source.contents.volumeMl).toBe(50);
    expect(executeTitrationStep(definition, result.state, action, { verb: "transfer", value: 0.4 }, "delivery").ok).toBe(false);
  });

  it("cannot acquire a final reading or accept an overshot trial", () => {
    const { definition, state, action } = fixture();
    const trial = state.titrationTrials![String(action.parameters.trialReferenceId)];
    const read: ActionDefinition = { ...action, verb: "observe", parameters: { ...action.parameters, titrationOperation: "read-final", measurementId: "final" } };
    expect(executeTitrationStep(definition, state, read, { verb: "observe" }, "final").ok).toBe(false);
    Object.assign(trial, { color: "overshot", recordedRevision: 0, observedRevision: 0, observedAt: 0 });
    const decide: ActionDefinition = { ...read, parameters: { ...read.parameters, titrationOperation: "decide" } };
    expect(executeTitrationStep(definition, state, decide, { verb: "observe", note: "Accept endpoint" }, "decision").ok).toBe(false);
    expect(state.measurements).toHaveLength(0);
    expect(trial.accepted).toBe(false);
  });

  it("does not let request parameters relax the authored delivery limit", () => {
    const { definition, state, action } = fixture();
    const result = executeTitrationStep(definition, state, action, { verb: "transfer", value: 5, parameters: { maximumIncrementMl: 10 } }, "delivery");
    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
  });

  it("does not equate stoichiometric equivalence with the configured indicator color", () => {
    const { definition, state, action } = fixture();
    const trial = state.titrationTrials![String(action.parameters.trialReferenceId)];
    trial.delivered = 24.8;
    const mix: ActionDefinition = {...action,verb:"mix",parameters:{...action.parameters,titrationOperation:"mix",indicatorStartPh:10,indicatorStrongPh:12}};
    const result = executeTitrationStep(definition,state,mix,{verb:"mix"},"mix");
    expect(result.ok).toBe(true);
    expect(result.state.titrationTrials![String(action.parameters.trialReferenceId)].color).toBe("clear");
  });

  it("requires instructor interpretation approval and learner arithmetic after curve selection", () => {
    const { definition, state, action } = fixture();
    const trial = state.titrationTrials![String(action.parameters.trialReferenceId)];
    trial.accepted = true;
    trial.readingsRecorded.push(String(action.parameters.finalMeasurementId));
    trial.points = [{volumeMl:0,ph:3,color:"clear"},{volumeMl:24.8,ph:8.7,color:"faint-pink"},{volumeMl:25,ph:10.6,color:"overshot"}];
    const select: ActionDefinition = {...action,verb:"observe",parameters:{...action.parameters,titrationOperation:"select-equivalence",calculationId:"curve-result"}};
    const selected = executeTitrationStep(definition,state,select,{verb:"observe",value:24.8},"selection");
    expect(selected.ok).toBe(true);
    expect(selected.state.calculations).toHaveLength(0);
    const calculate: ActionDefinition = {...select,verb:"calculate",parameters:{...select.parameters,titrationOperation:"calculate-curve"}};
    expect(executeTitrationStep(definition,selected.state,calculate,{verb:"calculate",value:0.0992},"calculation").ok).toBe(false);
    const approve: ActionDefinition = {...select,parameters:{...select.parameters,titrationOperation:"approve-equivalence"}};
    const approved = executeTitrationStep(definition,selected.state,approve,{verb:"observe",note:"Approve justified inference"},"review");
    expect(executeTitrationStep(definition,approved.state,calculate,{verb:"calculate",value:1},"calculation").ok).toBe(false);
    expect(executeTitrationStep(definition,approved.state,calculate,{verb:"calculate",value:0.0992},"calculation").ok).toBe(true);
  });
});
