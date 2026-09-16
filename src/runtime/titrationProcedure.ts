import { splitContentForVolume, mergeTransferredContents } from "./contentTransfer";
import type { ActionDefinition, RuntimeActionRequest, RuntimeState, TitrationTrialState } from "../domain/types";
import { calculateAcidBasePh, findTitrationModel } from "../domain/titrationModels";
import type { RuntimeDefinition } from "./createRuntime";
import { equipmentById } from "../equipment/catalog";

export type TitrationStepResult = { ok: true; state: RuntimeState; message: string; nextNodeId?: string } |
  { ok: false; state: RuntimeState; message: string; recovery: string };

const formalPhVolumeContexts: Record<string, {
  analyte: { formula: string; role: "acid" | "base"; strength: "strong" | "weak"; molarityM: number; equilibriumConstant?: number };
  titrant: { formula: string; role: "acid" | "base"; strength: "strong"; molarityM: number };
}> = {
  "strong-acid-strong-base": {
    analyte: { formula: "HCl", role: "acid", strength: "strong", molarityM: 0.1 },
    titrant: { formula: "NaOH", role: "base", strength: "strong", molarityM: 0.1 },
  },
  "weak-acid-strong-base": {
    analyte: { formula: "CH3COOH", role: "acid", strength: "weak", molarityM: 0.08, equilibriumConstant: 0.000018 },
    titrant: { formula: "NaOH", role: "base", strength: "strong", molarityM: 0.1 },
  },
  "weak-base-strong-acid": {
    analyte: { formula: "NH3", role: "base", strength: "weak", molarityM: 0.075, equilibriumConstant: 0.000018 },
    titrant: { formula: "HCl", role: "acid", strength: "strong", molarityM: 0.1 },
  },
};

/** Shared atomic titration operations. Only authored graph edges can be selected by a decision. */
export function executeTitrationStep(definition: RuntimeDefinition, state: RuntimeState, action: ActionDefinition, request: RuntimeActionRequest, nodeId: string): TitrationStepResult {
  const p = action.parameters;
  const str = (key: string) => typeof p[key] === "string" ? p[key] as string : "";
  const num = (key: string) => typeof p[key] === "number" ? p[key] as number : NaN;
  const operation = str("titrationOperation").replace(/^practice-/, "");
  const practice = str("titrationOperation").startsWith("practice-");
  const endpointEvidenceMode = str("endpointEvidenceMode");
  const recordedCurveStability = endpointEvidenceMode === "recorded-ph-curve-stability";
  const id = str("trialReferenceId");
  const old = state.titrationTrials?.[id];
  const trial = old ? structuredClone(old) : undefined;
  const source = state.equipmentInstances.find(e => e.id === str("buretteInstanceId"));
  const receiver = state.equipmentInstances.find(e => e.id === str("receiverInstanceId"));
  const reject = (message: string): TitrationStepResult => ({ ok: false, state, message, recovery: "Use the approved configuration and this trial's current equipment and evidence. An overshot trial requires disposal and a fresh aliquot." });
  const finish = (next: RuntimeState, message = action.feedback.success, nextNodeId?: string): TitrationStepResult => ({ ok: true, state: next, message, nextNodeId });
  const save = (value: TitrationTrialState, next = state) => ({ ...next, titrationTrials: { ...next.titrationTrials, [id]: value } });
  const measurement = (key: string) => state.measurements.find(m => m.id === str(key));
  const acquire = (next: RuntimeState, measurementId: string, value: number, unit: string, equipmentInstanceId = source?.id) => ({ ...next, measurements: [...next.measurements.filter(m => m.id !== measurementId), { id: measurementId, label: action.label, value, unit, nodeId, equipmentInstanceId }] });
  const note = (next: RuntimeState, value: string) => ({ ...next, notebook: [...next.notebook, { id: `${nodeId}-${next.notebook.length + 1}`, nodeId, timestamp: new Date().toISOString(), label: action.label, value, tags: [id, operation, action.id], type: "observation" as const }] });
  if (!id || !source || !receiver || source.id === receiver.id) return reject("The trial must bind a distinct burette and receiving vessel.");
  const model = findTitrationModel(
    definition,
    recordedCurveStability ? (str("formalContextModelId") || str("titrationModelId")) : str("titrationModelId"),
  );
  if (!model) return reject("The approved chemistry model is missing.");
  if (endpointEvidenceMode && !recordedCurveStability) return reject("The selected endpoint-evidence mode is not supported.");
  if (recordedCurveStability) {
    const context = formalPhVolumeContexts[str("formalContextId")];
    const close = (actual: number | undefined, expected: number) =>
      Number.isFinite(actual) && Math.abs(actual! - expected) <= Math.max(1e-12, Math.abs(expected) * 1e-9);
    if (!context || str("indicatorPolicy") !== "indicator-free-formal") {
      return reject("Select one published indicator-free formal context without relabeling its materials.");
    }
    if (
      model.type !== "acidBase" ||
      model.analyte.formula !== context.analyte.formula ||
      model.analyte.role !== context.analyte.role ||
      model.analyte.strength !== context.analyte.strength ||
      model.titrant.formula !== context.titrant.formula ||
      model.titrant.role !== context.titrant.role ||
      model.titrant.strength !== context.titrant.strength ||
      !close(model.analyteMolarityM, context.analyte.molarityM) ||
      !close(model.titrantMolarityM, context.titrant.molarityM) ||
      (context.analyte.equilibriumConstant === undefined
        ? model.analyte.equilibriumConstant !== undefined
        : !close(model.analyte.equilibriumConstant, context.analyte.equilibriumConstant))
    ) {
      return reject("The bound chemistry model does not match the selected formal context identity, orientation, strength, or configured value.");
    }
  }
  if (operation === "review-standardization") {
    const ids = p.calculationIds as string[];
    const results = ids.map(key => state.calculations.find(c => c.id === key && c.passed));
    if (results.some(c => !c)) return reject("Validate every standardization calculation before reviewing precision.");
    const values = results.map(c => c!.expected ?? c!.value);
    if (request.note === "Accept concordance") {
      if (Math.max(...values) - Math.min(...values) > num("standardizationRangeM")) return reject("The recorded trials exceed the approved concordance range. Repeat standardization with fresh aliquots.");
      return finish(note(state, "Teacher accepted concordance of the evidence-derived standardization trials."));
    }
    if (request.note !== "Repeat standardization" || (receiver.contents.volumeMl ?? 0) > 0) return reject("Complete cleanup before repeating standardization.");
    const nodes = p.trialNodeIds as string[];
    const next = {...state, titrationTrials:{...state.titrationTrials}, titrationRejectedTrials:{...state.titrationRejectedTrials},repeatProgress:{...state.repeatProgress},
      measurements:state.measurements.filter(m=>!nodes.includes(m.nodeId)),
      calculations:state.calculations.filter(c=>!nodes.includes(c.nodeId)),
      completedNodes:state.completedNodes.filter(n=>!nodes.includes(n))};
    delete next.repeatProgress[str("repeatGroupId")];
    for (const key of p.trialReferenceIds as string[]) {
      const prior = next.titrationTrials[key];
      if (prior) next.titrationRejectedTrials[key] = [...(next.titrationRejectedTrials[key] ?? []), structuredClone(prior)];
      delete next.titrationTrials[key];
    }
    return finish(note(next, "Teacher requested fresh standardization; prior readings and calculations remain documented in notebook history."), "Prepare fresh aliquots and readings.", str("restartNodeId"));
  }
  const mounted = state.attachments.find(a => a.childInstanceId === source.id && a.relationType === "mounted");
  const positioned = mounted && state.attachments.some(a => a.childInstanceId === receiver.id && a.parentInstanceId === mounted.parentInstanceId && a.zoneId === "ring-stand-burette-receiver");
  if (operation === "read-initial") {
    // The authored workflow removes the filling funnel before reading the meniscus. Keep this a
    // live physical gate so a later reattachment cannot leave a blocked view looking complete.
    const fillingFunnelIsSeated = state.attachments.some((attachment) =>
      attachment.parentInstanceId === source.id &&
      attachment.zoneId === "burette-funnel-seat" &&
      state.equipmentInstances.some(
        (instance) => instance.id === attachment.childInstanceId && instance.definitionId === "funnel",
      ),
    );
    if (fillingFunnelIsSeated) {
      return reject("The filling funnel is still seated on the burette; remove it before reading the meniscus.");
    }
    if (old) return reject("This trial has already begun; preserve its readings or use the fresh-trial path.");
    const aliquot = measurement("aliquotMeasurementId");
    if ((!practice && !mounted) || !Number.isFinite(source.contents.volumeMl) || (source.contents.volumeMl ?? 0) <= 0) return reject("Prepare the delivery apparatus with the approved titrant before reading.");
    const initial = practice ? 0 : Number((50 - (source.contents.volumeMl ?? 0)).toFixed(2));
    const value: TitrationTrialState = { initial, delivered: 0, aliquot: aliquot?.value ?? 0, revision: 0, mixedRevision: 0, observedRevision: -1, recordedRevision: -1, color: "clear", accepted: false, points: [], readingsRecorded: practice ? [str("initialMeasurementId")] : [], attempt: (state.titrationRejectedTrials?.[id]?.length ?? 0) + 1 };
    return practice ? finish(save(value), "Fresh practice trial ready. Count drops; no drop-to-volume calibration is claimed.") : finish(acquire(save(value), str("measurementId"), initial, "mL"));
  }
  if (!trial) return reject("Read this trial's initial burette level first.");
  if (operation === "record-initial" || operation === "record-final") {
    const reading = measurement("measurementId");
    if (!reading || (operation === "record-final" && !trial.accepted && !trial.incompletePractice)) return reject("Acquire this trial's reading before recording it.");
    trial.readingsRecorded = [...new Set([...trial.readingsRecorded, reading.id])];
    return finish(note(save(trial), `${reading.value.toFixed(2)} ${reading.unit}`), undefined,
      operation === "record-final" && trial.incompletePractice ? str("incompleteDisposalNodeId") : undefined);
  }
  if (trial.aliquot <= 0) trial.aliquot = measurement("aliquotMeasurementId")?.value ?? 0;
  if (!Number.isFinite(trial.aliquot) || trial.aliquot <= 0) return reject("Measure the trial aliquot before titrating.");
  if (recordedCurveStability) {
    const minimumAliquot = num("minimumAliquotMl");
    const maximumAliquot = num("maximumAliquotMl");
    if (!Number.isFinite(minimumAliquot) || !Number.isFinite(maximumAliquot) || minimumAliquot !== 10 || maximumAliquot !== 25 || trial.aliquot < minimumAliquot || trial.aliquot > maximumAliquot) {
      return reject("The formal-trial aliquot must remain within the published 10-25 mL acquisition contract.");
    }
  }
  if (!model.stoichiometricRatio) return reject("An approved stoichiometric ratio is required.");
  const equivalent = model.analyteMolarityM * trial.aliquot * model.stoichiometricRatio.titrant / (model.titrantMolarityM * model.stoichiometricRatio.analyte);
  const tolerance = num("endpointWindowMl");
  if (!Number.isFinite(equivalent) || equivalent <= 0 || (!recordedCurveStability && (!Number.isFinite(tolerance) || tolerance <= 0))) return reject("A complete chemistry model and the selected evidence contract are required.");
  if (operation === "deliver") {
    const requested = practice ? model.dropVolumeMl : request.value;
    const available = source.contents.volumeMl ?? 0;
    const volume = requested !== undefined && Math.abs(requested - available) < 1e-8 ? available : requested;
    if ((!practice && !positioned) || (trial.accepted && p.allowPostEndpoint !== true) || !trial.readingsRecorded.includes(str("initialMeasurementId"))) return reject("Record the initial reading and position the receiver before delivery.");
    if (trial.revision > 0 && trial.recordedRevision !== trial.revision) return reject("Mix, observe, and record the last addition before delivering again.");
    const minimumIncrement = recordedCurveStability ? num("minimumIncrementMl") : 0;
    if (!Number.isFinite(volume) || volume! <= 0 || volume! > num("maximumIncrementMl") || (recordedCurveStability && (!Number.isFinite(minimumIncrement) || minimumIncrement !== 0.1 || volume! < minimumIncrement))) return reject(recordedCurveStability ? "Enter a titrant increment within the published 0.1-5 mL range." : "Enter a positive increment within the approved maximum; choose a smaller drop near the endpoint.");
    if (!practice && Math.abs(volume! * 100 - Math.round(volume! * 100)) > 1e-6) return reject("Enter the addition to this simulated burette's 0.01 mL reading resolution.");
    const allocation = num("maximumDeliveryMl");
    const capacity = equipmentById.get(receiver.definitionId)?.capacity.amount ?? 0;
    if (!Number.isFinite(allocation) || allocation <= 0 || !Number.isFinite(available) || (receiver.contents.volumeMl ?? 0) + 1e-8 < trial.aliquot + trial.delivered) return reject("Transfer the measured aliquot into this trial's receiver and preserve its contents before adding titrant.");
    if (volume! > (source.contents.volumeMl ?? 0) || volume! + (receiver.contents.volumeMl ?? 0) > capacity || trial.delivered + volume! > allocation) return reject("This addition exceeds the available titrant, receiver capacity, or approved allocation.");
    trial.delivered = Number((trial.delivered + volume!).toFixed(6));
    trial.revision += 1;
    trial.pendingPh = undefined;
    trial.color = "unmixed";
    const portion = splitContentForVolume(source.contents, volume!);
    const next = { ...state, equipmentInstances: state.equipmentInstances.map(e => e.id === source.id ? { ...e, contents: portion.remainingContents } : e.id === receiver.id ? { ...e, contents: { ...mergeTransferredContents(receiver.contents, portion.transferredContents), visualState: "clear-solution" } } : e.contents.probeImmersedInInstanceId === receiver.id ? { ...e, contents: {...e.contents, instrumentReadout: undefined} } : e) };
    return finish(save(trial, next), practice ? `Drop ${trial.revision} added. Mix and observe; drops are not a calibrated volume.` : `${volume!.toFixed(2)} mL delivered. Mix before interpreting the color.`);
  }
  if (operation === "mix") {
    if (!practice && !positioned) return reject("Return the receiver beneath the burette before mixing.");
    trial.mixedRevision = trial.revision;
    trial.color = recordedCurveStability ? "clear" : trial.delivered < equivalent - 1e-8 ? "clear" : trial.delivered <= equivalent + tolerance + 1e-8 ? "faint-pink" : "overshot";
    if (model.type === "acidBase") {
      if (recordedCurveStability) {
        trial.color = "clear";
      } else {
        const onset = num("indicatorStartPh"), strong = num("indicatorStrongPh");
        if (!Number.isFinite(onset) || !Number.isFinite(strong) || onset <= 7 || strong <= onset || strong > 14) return reject("Approve the indicator's pH-based color model before titration.");
        const ph = calculateAcidBasePh({...model,analyteVolumeMl:trial.aliquot},trial.delivered).ph;
        trial.color = ph < onset ? "clear" : practice
          ? trial.points.some(point=>point.color !== "clear") ? "overshot" : "faint-pink"
          : ph <= strong ? "faint-pink" : "overshot";
      }
    }
    const visualState = trial.color === "clear" ? (model.type === "redox" ? "redox-colorless-solution" : "clear-solution") : trial.color === "faint-pink" ? (model.type === "redox" ? "permanganate-faint-pink" : "titration-pale-pink") : (model.type === "redox" ? "permanganate-overshoot-purple" : "titration-dark-pink");
    return finish(save(trial, { ...state, equipmentInstances: state.equipmentInstances.map(e => e.id === receiver.id ? { ...e, contents: { ...e.contents, visualState } } : e) }));
  }
  if (operation === "observe") {
    if (trial.mixedRevision !== trial.revision) return reject("Mix the current addition before observing.");
    trial.observedRevision = trial.revision;
    trial.observedAt = Date.now();
    return finish(note(save(trial), recordedCurveStability ? "Indicator not used in this formal trial; preserve the mixed solution state and acquire pH separately." : trial.color === "overshot" ? (model.type === "redox" ? "Dark red-purple; permanganate excess." : "Further addition beyond the approved color-change criterion.") : trial.color === "faint-pink" ? practice ? "First observed indicator color change in drop-count practice; no quantitative endpoint precision is claimed." : "Faint pink; observe for the approved persistence period before accepting." : "No persistent endpoint color observed."));
  }
  if (operation === "read-ph") {
    const meter = state.equipmentInstances.find(e => e.id === str("meterInstanceId"));
    if (model.type !== "acidBase" || !meter || meter.contents.probeImmersedInInstanceId !== receiver.id || trial.mixedRevision !== trial.revision) return reject("Use a ready immersed pH probe in the mixed acid-base sample.");
    const readiness = str("readinessNotebookTag");
    if (!readiness || !state.notebook.some(e => e.tags.includes(readiness))) return reject("Confirm the teacher-approved calibration, rinse, and stability protocol first.");
    const predicted = calculateAcidBasePh({ ...model, analyteVolumeMl: trial.aliquot }, trial.delivered);
    trial.pendingPh = Number(predicted.ph.toFixed(model.phPrecision));
    const next = save(trial, { ...state, equipmentInstances: state.equipmentInstances.map(e => e.id === meter.id ? { ...e, contents: { ...e.contents, instrumentReadout: { quantity: "pH" as const, value: trial.pendingPh!, unit: "pH" as const, precision: model.phPrecision, provenance: "simulator-generated" as const } } } : e) });
    return finish(acquire(next, str("measurementId"), trial.pendingPh, "pH", meter.id), `${trial.pendingPh} pH (ideal configured model prediction).`);
  }
  if (operation === "record-point") {
    if (trial.observedRevision !== trial.revision || (p.requirePh === true && trial.pendingPh === undefined)) return reject("Observe this addition and acquire its pH before recording the row.");
    if (trial.recordedRevision === trial.revision) return reject("This point is already recorded; deliver a fresh increment.");
    trial.points.push({ volumeMl: trial.delivered, ph: trial.pendingPh, color: recordedCurveStability ? "indicator-not-used" : trial.color });
    trial.recordedRevision = trial.revision;
    return finish(note(save(trial), recordedCurveStability ? `${trial.delivered.toFixed(2)} mL; ${trial.pendingPh} pH; indicator not used. Trial ${id}, attempt ${trial.attempt}.` : `${practice ? `${trial.revision} uncalibrated drops` : `${trial.delivered.toFixed(2)} mL`}; ${trial.pendingPh === undefined ? "color observation" : `${trial.pendingPh} pH`}; ${trial.color}. Trial ${id}, attempt ${trial.attempt}.`));
  }
  if (operation === "decide" || operation === "decide-curve") {
    if (trial.recordedRevision !== trial.revision) return reject("Record the current observation before deciding.");
    const choice = request.note;
    if (choice === "Report incomplete practice" && p.boundedPractice === true) {
      trial.incompletePractice = true;
      return finish(note(save(trial), "Practice ended without an accepted endpoint. Record the actual final reading, dispose, and report why no valid concentration can be calculated."), "Preserve the unsuccessful practice evidence.");
    }
    if (choice === "Continue delivery") {
      if (trial.color === "overshot" && p.requirePh !== true) return reject("This endpoint trial is overshot. Dispose and restart with a fresh aliquot.");
      return finish({ ...state, completedNodes: state.completedNodes.filter(n => !(p.loopNodeIds as string[] ?? []).includes(n)) }, "Continue with a student-selected increment.", str("continueNodeId"));
    }
    if (choice === "Dispose and restart trial") return finish(note(state, recordedCurveStability ? `Rejected formal attempt ${trial.attempt}; ${trial.delivered} mL delivered with its recorded pH-volume rows preserved.` : `Rejected attempt ${trial.attempt}; ${practice ? `${trial.revision} drops` : `${trial.delivered} mL`}, ${trial.color}.`), "Preserve the rejected attempt and dispose before preparing a fresh trial.", str("retryNodeId"));
    if (operation === "decide-curve" && recordedCurveStability && choice === "Finish after stability review") {
      const points = trial.points.filter((point): point is typeof point & { ph: number } => Number.isFinite(point.ph));
      const stabilityDelta = num("stabilityDeltaPh");
      const stabilityCount = num("stabilityConsecutiveReadings");
      const minimumPostSteep = num("minimumPostSteepRegionMl");
      if (!Number.isFinite(stabilityDelta) || stabilityDelta <= 0 || !Number.isInteger(stabilityCount) || stabilityCount < 1 || !Number.isFinite(minimumPostSteep) || minimumPostSteep < 0 || points.length < stabilityCount + 2) {
        return reject("The configured stability review requires a valid threshold, consecutive-reading count, post-steep volume, and enough recorded pH points.");
      }
      const changes = points.slice(1).map((point, index) => ({
        index,
        deltaPh: Math.abs(point.ph - points[index].ph),
      }));
      const steepest = changes.reduce((current, candidate) => candidate.deltaPh > current.deltaPh ? candidate : current);
      const stableTail = changes.slice(-stabilityCount);
      const postSteepVolume = points.at(-1)!.volumeMl - points[steepest.index + 1].volumeMl;
      if (steepest.deltaPh <= stabilityDelta || stableTail.some(change => change.deltaPh > stabilityDelta) || postSteepVolume + 1e-8 < minimumPostSteep) {
        return reject("Continue recording: the observed curve must include a steeper change followed by the configured consecutive stable pH changes and post-steep volume.");
      }
      trial.accepted = true;
      return finish(note(save(trial), `Formal curve completed from recorded evidence: ${stabilityCount} consecutive pH changes at or below ${stabilityDelta}, ${postSteepVolume.toFixed(2)} mL recorded after the steepest observed interval. Equivalence is not selected by this trial contract.`));
    }
    if (operation === "decide-curve" && choice === "Finish curve") {
      if (!trial.accepted || trial.points.filter(point => point.volumeMl > trial.endpointVolumeMl!).length < 1) return reject("Record at least one approved point after the endpoint before completing the curve.");
      return finish(state);
    }
    if (choice !== "Accept endpoint") return reject("Choose a supported delivery, endpoint, or fresh-trial decision.");
    if (trial.color !== "faint-pink" || trial.observedRevision !== trial.revision) return reject("A mixed, observed faint-pink endpoint is required; an overshot result cannot be accepted.");
    const seconds = num("persistenceSeconds");
    if (!Number.isFinite(seconds) || seconds <= 0 || Date.now() - (trial.observedAt ?? Date.now()) < seconds * 1000) return reject("Observe the endpoint for the instructor-approved persistence time before accepting.");
    trial.accepted = true;
    trial.endpointVolumeMl = trial.delivered;
    return finish(save(trial));
  }
  if (operation === "read-final") {
    if (!trial.accepted && !trial.incompletePractice) return reject("Accept this trial's endpoint before reading the final level.");
    return finish(acquire(state, str("measurementId"), Number((50 - (source.contents.volumeMl ?? 0)).toFixed(2)), "mL"));
  }
  if (operation === "select-equivalence") {
    const volume = request.value;
    if (!trial.accepted || !trial.readingsRecorded.includes(str("initialMeasurementId")) || !trial.readingsRecorded.includes(str("finalMeasurementId")) || trial.points.filter(point=>point.ph !== undefined).length < 3 || !Number.isFinite(volume) || volume! <= 0 || !trial.points.some(point=>point.volumeMl < volume!) || !trial.points.some(point=>point.volumeMl > volume!)) return reject("Select a positive equivalence volume bracketed by this trial's recorded pH curve, including observations after endpoint.");
    trial.equivalenceVolumeMl = volume; trial.equivalenceApproved = false;
    return finish(note(save(trial), `Learner-selected equivalence: ${volume} mL. Unverified interpretation pending justification and instructor review.`));
  }
  if (operation === "approve-equivalence") {
    if (!trial.equivalenceVolumeMl || request.note !== "Approve justified inference") return reject("Review the learner's recorded curve selection and justification first.");
    trial.equivalenceApproved = true;
    return finish(note(save(trial), "Instructor approved the justified curve interpretation; this is not independent model verification."));
  }
  if (operation === "calculate-curve") {
    if (!trial.equivalenceApproved || !trial.equivalenceVolumeMl) return reject("Obtain approval for the justified curve interpretation first.");
    const expected = model.titrantMolarityM * trial.equivalenceVolumeMl * model.stoichiometricRatio.analyte / (trial.aliquot * model.stoichiometricRatio.titrant);
    const value = request.value;
    if (!Number.isFinite(value) || Math.abs(value! - expected) > Math.max(0.000001, Math.abs(expected) * 0.01)) return reject("The concentration arithmetic does not match the approved curve selection, aliquot and stoichiometry within the disclosed 1% arithmetic tolerance.");
    return finish(note({...state,calculations:[...state.calculations.filter(c=>c.id!==str("calculationId")),{id:str("calculationId"),label:action.label,value:value!,unit:'mol/L',passed:true,nodeId}]}, `${value} mol/L from the instructor-approved interpretation; equivalence remains model-dependent.`));
  }
  if (operation === "archive-retry") {
    if ((receiver.contents.volumeMl ?? 0) > 0) return reject("Dispose of the rejected mixture before resetting this trial.");
    const trialNodes = p.trialNodeIds as string[] ?? [];
    const next = { ...state, titrationTrials: { ...state.titrationTrials },
      measurements: state.measurements.filter(m => ![str("initialMeasurementId"), str("finalMeasurementId"), str("aliquotMeasurementId")].includes(m.id) && !trialNodes.includes(m.nodeId)),
      equipmentInstances:state.equipmentInstances.map(e=>e.contents.probeImmersedInInstanceId===receiver.id?{...e,contents:{...e.contents,instrumentReadout:undefined}}:e) };
    next.titrationRejectedTrials = { ...state.titrationRejectedTrials, [id]: [...(state.titrationRejectedTrials?.[id] ?? []), structuredClone(trial)] };
    delete next.titrationTrials[id];
    next.completedNodes = next.completedNodes.filter(n => !(p.trialNodeIds as string[] ?? []).includes(n));
    return finish(next, "The rejected attempt remains in the notebook. Prepare a fresh aliquot and readings.", str("restartNodeId"));
  }
  return reject(`Unsupported titration operation: ${operation}`);
}
