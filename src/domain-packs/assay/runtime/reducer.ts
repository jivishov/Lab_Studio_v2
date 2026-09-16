import type { AssayQuantity, AssayRuntimeWarning, WellComponentState, WellState } from "../types";
import {
  DEFAULT_TIP_REUSE_POLICY,
  micropipetteDefinitions,
  pipetteTipDefinitions,
  addVolumes,
  compareVolumes,
  createPipetteRuntimeState,
  isVolumeIncrementAligned,
  mapMultichannelSelection,
  mergeComponents,
  multiplyVolume,
  scaleComponents,
  subtractVolumes,
  toMicroliters,
  type CreateAssayRuntimeStateOptions,
  type ExternalLiquidSourceState,
  type LiquidLocationRef,
  type LiquidSourceSelection,
  type MicropipetteDefinition,
  type PipetteRuntimeState,
  type PipetteTipDefinition,
  type PipetteTipState,
  type PlateTargetSelection,
} from "../pipetting";
import { projectAssayOperationEvidence } from "./evidence";
import type {
  AssayOperation,
  AssayReplayResult,
  AssayRuntimeDiagnostic,
  AssayRuntimeIntent,
  AssayRuntimeState,
  AssayRuntimeTransition,
} from "./types";
import { assayOperationSchemaId, assayOperationSchemaVersion } from "./types";
import { validateAssayOperation } from "./validation";

const uniqueSorted = (values: readonly string[]): string[] => [...new Set(values)].sort();
const zeroVolume = (): AssayQuantity => ({ value: "0", unit: "uL" });

class RuntimeOperationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly recovery: string,
    readonly objectRefs: string[] = [],
  ) {
    super(message);
    this.name = "RuntimeOperationError";
  }
}

interface AcceptedMutation {
  state: AssayRuntimeState;
  diagnostics?: AssayRuntimeDiagnostic[];
  summary: string;
  objectRefs: string[];
  data?: Record<string, string | number | boolean | string[]>;
}

const assertion: (
  condition: unknown,
  code: string,
  message: string,
  recovery: string,
  objectRefs?: string[],
) => asserts condition = (condition, code, message, recovery, objectRefs = []) => {
  if (!condition) throw new RuntimeOperationError(code, message, recovery, objectRefs);
};

const validateCatalog = (options: CreateAssayRuntimeStateOptions): {
  definitions: MicropipetteDefinition[];
  tips: PipetteTipDefinition[];
} => {
  const definitions = [...(options.pipetteDefinitions ?? micropipetteDefinitions)].map((definition) => structuredClone(definition));
  const tips = [...(options.tipDefinitions ?? pipetteTipDefinitions)].map((tip) => structuredClone(tip));
  assertion(options.runId.trim(), "assay.runtime.run-id", "runId must be non-empty.", "Supply a stable run identifier.");
  assertion(definitions.length > 0, "assay.runtime.pipette.none", "At least one pipette definition is required.", "Register a supported pipette definition.");
  assertion(tips.length > 0, "assay.runtime.tip.none", "At least one tip definition is required.", "Register a compatible tip definition.");
  assertion(new Set(definitions.map(({ id }) => id)).size === definitions.length, "assay.runtime.pipette.duplicate", "Pipette ids must be unique.", "Remove duplicate pipette definitions.");
  assertion(new Set(tips.map(({ id }) => id)).size === tips.length, "assay.runtime.tip.duplicate", "Tip ids must be unique.", "Remove duplicate tip definitions.");
  for (const definition of definitions) {
    toMicroliters(definition.minimumVolume);
    toMicroliters(definition.maximumVolume);
    toMicroliters(definition.increment);
    assertion(compareVolumes(definition.minimumVolume, definition.maximumVolume) <= 0, "assay.runtime.pipette.range", `Pipette ${definition.id} has an invalid range.`, "Correct the pipette definition.", [definition.id]);
    assertion(compareVolumes(definition.increment, zeroVolume()) > 0, "assay.runtime.pipette.increment", `Pipette ${definition.id} increment must be positive.`, "Correct the pipette definition.", [definition.id]);
  }
  return { definitions, tips };
};

export const createAssayRuntimeState = (options: CreateAssayRuntimeStateOptions): AssayRuntimeState => {
  const { definitions, tips } = validateCatalog(options);
  const liquidSources = [...(options.liquidSources ?? [])].map((source) => structuredClone(source));
  assertion(new Set(liquidSources.map(({ id }) => id)).size === liquidSources.length, "assay.runtime.source.duplicate", "Liquid source ids must be unique.", "Remove duplicate liquid sources.");
  for (const source of liquidSources) toMicroliters(source.volume);
  const selectedPipetteId = options.selectedPipetteId ?? definitions[0].id;
  assertion(definitions.some(({ id }) => id === selectedPipetteId), "assay.runtime.pipette.unknown", `Unknown selected pipette ${selectedPipetteId}.`, "Select a registered pipette.", [selectedPipetteId]);
  const policy = structuredClone(options.tipReusePolicy ?? DEFAULT_TIP_REUSE_POLICY);
  if (policy.mode !== "single-aspiration") {
    assertion(Number.isInteger(policy.maximumAspirationsPerTip) && policy.maximumAspirationsPerTip > 0, "assay.runtime.tip-policy.maximum", "Tip reuse maximum must be a positive integer.", "Correct the explicit tip-reuse policy.");
  }
  return {
    schema: "assay-studio.runtime-state",
    schemaVersion: "1.0",
    runId: options.runId,
    plate: structuredClone(options.plate),
    pipetteDefinitions: definitions,
    tipDefinitions: structuredClone(tips),
    pipettes: definitions.map((definition) => createPipetteRuntimeState(definition)),
    liquidSources,
    tipReusePolicy: policy,
    selectedPipetteId,
    acceptedOperationIds: [],
  };
};

const pipetteContext = (state: AssayRuntimeState, pipetteId: string): {
  runtime: PipetteRuntimeState;
  definition: MicropipetteDefinition;
  index: number;
} => {
  const index = state.pipettes.findIndex(({ pipetteId: id }) => id === pipetteId);
  const definition = state.pipetteDefinitions.find(({ id }) => id === pipetteId);
  assertion(index >= 0 && definition, "assay.pipetting.pipette.unknown", `Unknown pipette ${pipetteId}.`, "Select a registered pipette.", [pipetteId]);
  return { runtime: state.pipettes[index], definition, index };
};

const findWell = (state: AssayRuntimeState, coordinate: string): WellState => {
  const well = state.plate.wells.find((candidate) => candidate.coordinate === coordinate);
  assertion(well, "assay.pipetting.well.unknown", `Unknown well ${coordinate}.`, "Choose a canonical well on the runtime plate.", [coordinate]);
  return well;
};

const findSource = (state: AssayRuntimeState, sourceId: string): ExternalLiquidSourceState => {
  const source = state.liquidSources.find(({ id }) => id === sourceId);
  assertion(source, "assay.pipetting.source.unknown", `Unknown liquid source ${sourceId}.`, "Choose a registered liquid source.", [sourceId]);
  return source;
};

const resolveSourceSelection = (
  state: AssayRuntimeState,
  definition: MicropipetteDefinition,
  selection: LiquidSourceSelection,
): Array<{ channelIndex: number; location: LiquidLocationRef }> => {
  if (selection.kind === "single") {
    assertion(definition.channels === 1, "assay.pipetting.mapping.channel-count", "A single source selection requires a single-channel pipette.", "Use an explicit multichannel source selection.", [definition.id]);
    return [{ channelIndex: 0, location: structuredClone(selection.location) }];
  }
  if (selection.kind === "shared-source") {
    return Array.from({ length: definition.channels }, (_, channelIndex) => ({
      channelIndex,
      location: { kind: "source", sourceId: selection.sourceId },
    }));
  }
  assertion(definition.channels === 8, "assay.pipetting.mapping.channel-count", "A plate multichannel selection requires an 8-channel pipette.", "Use the 8-channel pipette or a single-well source.", [definition.id]);
  return mapMultichannelSelection(selection.anchor, definition.channels, selection.orientation)
    .map(({ channelIndex, coordinate }) => ({ channelIndex, location: { kind: "well", coordinate } }));
};

const resolveTargetSelection = (
  definition: MicropipetteDefinition,
  target: PlateTargetSelection,
): Array<{ channelIndex: number; coordinate: string }> => {
  if (target.kind === "single") {
    assertion(definition.channels === 1, "assay.pipetting.mapping.channel-count", "A single target requires a single-channel pipette.", "Use an explicit multichannel target selection.", [definition.id]);
    return [{ channelIndex: 0, coordinate: target.coordinate }];
  }
  assertion(definition.channels === 8, "assay.pipetting.mapping.channel-count", "A multichannel target requires an 8-channel pipette.", "Use the 8-channel pipette or a single-well target.", [definition.id]);
  return mapMultichannelSelection(target.anchor, definition.channels, target.orientation);
};

const locationKey = (location: LiquidLocationRef): string =>
  location.kind === "source" ? `source:${location.sourceId}` : `well:${location.coordinate}`;

const locationLiquid = (state: AssayRuntimeState, location: LiquidLocationRef): {
  volume: ExternalLiquidSourceState["volume"];
  components: WellComponentState[];
  mixed: boolean;
  contaminationTags: string[];
} => location.kind === "source" ? findSource(state, location.sourceId) : findWell(state, location.coordinate);

const setLocationLiquid = (
  state: AssayRuntimeState,
  location: LiquidLocationRef,
  volume: ExternalLiquidSourceState["volume"],
  components: WellComponentState[],
): void => {
  if (location.kind === "source") {
    const sourceIndex = state.liquidSources.findIndex(({ id }) => id === location.sourceId);
    state.liquidSources[sourceIndex] = { ...state.liquidSources[sourceIndex], volume, components };
    return;
  }
  const wellIndex = state.plate.wells.findIndex(({ coordinate }) => coordinate === location.coordinate);
  const current = state.plate.wells[wellIndex];
  state.plate.wells[wellIndex] = {
    ...current,
    volume,
    components,
    status: compareVolumes(volume, zeroVolume()) === 0 ? "empty" : current.status,
  };
};

const useTip = (
  state: AssayRuntimeState,
  operation: AssayOperation,
  tip: PipetteTipState,
  sourceRef: string,
  sourceTags: readonly string[],
): { tip: PipetteTipState; diagnostics: AssayRuntimeDiagnostic[] } => {
  const policy = state.tipReusePolicy;
  const priorSources = tip.contactedSourceRefs;
  if (policy.mode === "single-aspiration") {
    assertion(tip.aspirationCount === 0, "assay.pipetting.tip.reuse-blocked", "The explicit single-aspiration policy requires a fresh tip.", "Eject tips and attach fresh tips.", [tip.tipTypeId]);
  } else {
    assertion(tip.aspirationCount < policy.maximumAspirationsPerTip, "assay.pipetting.tip.maximum-uses", "The tip has reached the explicit reuse limit.", "Eject tips and attach fresh tips.", [tip.tipTypeId]);
    if (policy.mode === "same-source") {
      assertion(priorSources.length === 0 || priorSources.includes(sourceRef), "assay.pipetting.tip.source-change-blocked", "The explicit same-source policy blocks contact with a different source.", "Eject tips and attach fresh tips before changing sources.", [tip.tipTypeId, sourceRef]);
    }
  }
  const crossedSource = priorSources.length > 0 && !priorSources.includes(sourceRef);
  const contaminationTags = uniqueSorted([
    ...tip.contaminationTags,
    ...sourceTags,
    ...(crossedSource ? ["cross-source-contact"] : []),
  ]);
  const diagnostics: AssayRuntimeDiagnostic[] = crossedSource && policy.mode === "allow-with-contamination-warning"
    ? [{
        code: "assay.pipetting.contamination.cross-source",
        severity: "warning",
        message: `Tip channel ${tip.channelIndex + 1} contacted ${sourceRef} after ${priorSources.join(", ")}.`,
        operationId: operation.operationId,
        recovery: "Eject tips and attach fresh tips to avoid further cross-source contact.",
        objectRefs: [tip.tipTypeId, ...priorSources, sourceRef],
      }]
    : [];
  return {
    tip: {
      ...structuredClone(tip),
      aspirationCount: tip.aspirationCount + 1,
      contactedSourceRefs: uniqueSorted([...priorSources, sourceRef]),
      contaminationTags,
    },
    diagnostics,
  };
};

const selectPipette = (state: AssayRuntimeState, operation: Extract<AssayOperation, { type: "selectPipette" }>): AcceptedMutation => {
  pipetteContext(state, operation.pipetteId);
  return { state: { ...structuredClone(state), selectedPipetteId: operation.pipetteId }, summary: `Selected ${operation.pipetteId}.`, objectRefs: [operation.pipetteId] };
};

const setVolume = (state: AssayRuntimeState, operation: Extract<AssayOperation, { type: "setVolume" }>): AcceptedMutation => {
  const { runtime, definition, index } = pipetteContext(state, operation.pipetteId);
  assertion(runtime.channelContents.length === 0, "assay.pipetting.volume.loaded", "Volume cannot change while liquid is loaded.", "Dispense or explicitly discard the loaded liquid first.", [operation.pipetteId]);
  const volume = toMicroliters(operation.volume);
  assertion(compareVolumes(volume, definition.minimumVolume) >= 0 && compareVolumes(volume, definition.maximumVolume) <= 0, "assay.pipetting.volume.range", `Volume must be within ${definition.minimumVolume.value}-${definition.maximumVolume.value} ${definition.maximumVolume.unit}.`, "Choose a volume within the registered pipette range.", [operation.pipetteId]);
  assertion(isVolumeIncrementAligned(volume, definition.minimumVolume, definition.increment), "assay.pipetting.volume.increment", `Volume must align to the ${definition.increment.value} ${definition.increment.unit} increment.`, "Choose an aligned volume.", [operation.pipetteId]);
  const next = structuredClone(state);
  next.pipettes[index].setVolume = volume;
  return { state: next, summary: `Set ${operation.pipetteId} to ${volume.value} ${volume.unit}.`, objectRefs: [operation.pipetteId], data: { volume: volume.value, unit: volume.unit } };
};

const attachTips = (state: AssayRuntimeState, operation: Extract<AssayOperation, { type: "attachTips" }>): AcceptedMutation => {
  const { runtime, definition, index } = pipetteContext(state, operation.pipetteId);
  assertion(runtime.attachedTips.length === 0 && runtime.channelContents.length === 0, "assay.pipetting.tip.already-attached", "Tips are already attached or the pipette contains liquid.", "Eject or recover before attaching tips.", [operation.pipetteId]);
  const tipDefinition = state.tipDefinitions.find(({ id }) => id === operation.tipTypeId);
  assertion(tipDefinition, "assay.pipetting.tip.unknown", `Unknown tip type ${operation.tipTypeId}.`, "Choose a registered tip type.", [operation.tipTypeId]);
  assertion(definition.compatibleTipTypeIds.includes(tipDefinition.id) && tipDefinition.compatiblePipetteIds.includes(definition.id), "assay.pipetting.tip.incompatible", `${tipDefinition.id} is not compatible with ${definition.id}.`, "Attach a mutually compatible tip type.", [definition.id, tipDefinition.id]);
  assertion(compareVolumes(runtime.setVolume, tipDefinition.maximumVolume) <= 0, "assay.pipetting.tip.capacity", "Set volume exceeds tip capacity.", "Use a larger compatible tip or reduce the set volume.", [tipDefinition.id]);
  const next = structuredClone(state);
  next.pipettes[index].attachedTips = Array.from({ length: definition.channels }, (_, channelIndex) => ({
    channelIndex,
    tipTypeId: tipDefinition.id,
    aspirationCount: 0,
    contactedSourceRefs: [],
    contaminationTags: [],
  }));
  next.pipettes[index].status = "tips-attached";
  return { state: next, summary: `Attached ${definition.channels} ${tipDefinition.label}${definition.channels === 1 ? "" : "s"}.`, objectRefs: [definition.id, tipDefinition.id], data: { channelCount: definition.channels } };
};

const aspirate = (state: AssayRuntimeState, operation: Extract<AssayOperation, { type: "aspirate" }>): AcceptedMutation => {
  const { runtime, definition, index } = pipetteContext(state, operation.pipetteId);
  assertion(runtime.attachedTips.length === definition.channels, "assay.pipetting.tip.missing", "Every channel requires an attached compatible tip.", "Attach tips before aspirating.", [operation.pipetteId]);
  assertion(runtime.channelContents.length === 0, "assay.pipetting.channel.not-empty", "Pipette channels already contain liquid.", "Dispense or explicitly discard loaded liquid first.", [operation.pipetteId]);
  const mappings = resolveSourceSelection(state, definition, operation.source);
  const groups = new Map<string, { location: LiquidLocationRef; count: number }>();
  for (const mapping of mappings) {
    const key = locationKey(mapping.location);
    const current = groups.get(key);
    groups.set(key, { location: mapping.location, count: (current?.count ?? 0) + 1 });
  }
  for (const [key, group] of groups) {
    const liquid = locationLiquid(state, group.location);
    assertion(liquid.mixed, "assay.pipetting.source.unmixed", `${key} must be mixed before quantitative transfer-out.`, "Mix the source with fresh or policy-compatible tips.", [key]);
    const required = multiplyVolume(runtime.setVolume, group.count);
    assertion(compareVolumes(liquid.volume, required) >= 0, "assay.pipetting.source.insufficient", `${key} has insufficient volume for ${group.count} channel(s).`, "Reduce the volume or replenish the source.", [key]);
  }
  const diagnostics: AssayRuntimeDiagnostic[] = [];
  const nextTips: PipetteTipState[] = [];
  const contents = mappings.map((mapping) => {
    const liquid = locationLiquid(state, mapping.location);
    const sourceRef = locationKey(mapping.location);
    const used = useTip(state, operation, runtime.attachedTips[mapping.channelIndex], sourceRef, liquid.contaminationTags);
    nextTips[mapping.channelIndex] = used.tip;
    diagnostics.push(...used.diagnostics);
    return {
      channelIndex: mapping.channelIndex,
      volume: toMicroliters(runtime.setVolume),
      components: scaleComponents(liquid.components, runtime.setVolume, liquid.volume),
      sourceRefs: [sourceRef],
      contaminationTags: [...used.tip.contaminationTags],
    };
  });
  const next = structuredClone(state);
  for (const group of groups.values()) {
    const original = locationLiquid(state, group.location);
    const drawn = multiplyVolume(runtime.setVolume, group.count);
    const remaining = subtractVolumes(original.volume, drawn);
    setLocationLiquid(next, group.location, remaining, scaleComponents(original.components, remaining, original.volume));
  }
  next.pipettes[index].attachedTips = nextTips;
  next.pipettes[index].channelContents = contents;
  next.pipettes[index].contaminationTags = uniqueSorted(contents.flatMap(({ contaminationTags }) => contaminationTags));
  next.pipettes[index].status = "aspirated";
  const refs = mappings.map(({ location }) => locationKey(location));
  return { state: next, diagnostics, summary: `Aspirated ${runtime.setVolume.value} ${runtime.setVolume.unit} into ${definition.channels} channel(s).`, objectRefs: [definition.id, ...uniqueSorted(refs)], data: { volumePerChannel: toMicroliters(runtime.setVolume).value, unit: "uL", channelCount: definition.channels, sourceRefs: uniqueSorted(refs) } };
};

const contaminationWarning = (tags: readonly string[]): AssayRuntimeWarning => ({
  code: "assay.pipetting.contamination-tag",
  severity: "warning",
  message: `Transferred liquid carries contamination tag(s): ${uniqueSorted(tags).join(", ")}.`,
});

const dispense = (state: AssayRuntimeState, operation: Extract<AssayOperation, { type: "dispense" }>): AcceptedMutation => {
  const { runtime, definition, index } = pipetteContext(state, operation.pipetteId);
  assertion(runtime.channelContents.length === definition.channels, "assay.pipetting.channel.empty", "Every channel must contain aspirated liquid before dispensing.", "Aspirate with all channels first.", [operation.pipetteId]);
  const mappings = resolveTargetSelection(definition, operation.target);
  for (const mapping of mappings) {
    const well = findWell(state, mapping.coordinate);
    const content = runtime.channelContents.find(({ channelIndex }) => channelIndex === mapping.channelIndex);
    assertion(content, "assay.pipetting.channel.missing", `Channel ${mapping.channelIndex + 1} has no content.`, "Recover the invalid pipette state.", [operation.pipetteId]);
    assertion(compareVolumes(addVolumes(well.volume, content.volume), state.plate.maxWellVolume) <= 0, "assay.pipetting.destination.overflow", `Dispensing would exceed ${mapping.coordinate} capacity.`, "Choose a destination with enough capacity or reduce the transfer volume.", [mapping.coordinate]);
  }
  const next = structuredClone(state);
  for (const mapping of mappings) {
    const wellIndex = next.plate.wells.findIndex(({ coordinate }) => coordinate === mapping.coordinate);
    const well = next.plate.wells[wellIndex];
    const content = runtime.channelContents.find(({ channelIndex }) => channelIndex === mapping.channelIndex)!;
    const tags = uniqueSorted([...well.contaminationTags, ...content.contaminationTags]);
    const destinationWasEmpty = compareVolumes(well.volume, zeroVolume()) === 0;
    next.plate.wells[wellIndex] = {
      ...well,
      volume: addVolumes(well.volume, content.volume),
      components: mergeComponents([...well.components, ...content.components]),
      // An aliquot from a validated mixed source remains homogeneous in an empty
      // destination. Adding it to existing liquid requires an explicit mix.
      mixed: destinationWasEmpty,
      contaminationTags: tags,
      status: "prepared",
      warnings: tags.length > 0
        ? [...well.warnings.filter(({ code }) => code !== "assay.pipetting.contamination-tag"), contaminationWarning(tags)]
        : well.warnings,
    };
  }
  next.pipettes[index].channelContents = [];
  next.pipettes[index].status = "tips-attached";
  const refs = mappings.map(({ coordinate }) => `well:${coordinate}`);
  return { state: next, summary: `Dispensed into ${mappings.length} well(s).`, objectRefs: [definition.id, ...refs], data: { volumePerChannel: toMicroliters(runtime.setVolume).value, unit: "uL", channelCount: definition.channels, destinationRefs: refs, componentVolumes: runtime.channelContents.flatMap(({ channelIndex, components }) => components.map((component) => `${channelIndex}:${component.resourceRef}:${toMicroliters(component.volume).value}:uL`)) } };
};

const discard = (state: AssayRuntimeState, operation: Extract<AssayOperation, { type: "discard" }>): AcceptedMutation => {
  const { runtime, definition, index } = pipetteContext(state, operation.pipetteId);
  assertion(runtime.channelContents.length === definition.channels, "assay.pipetting.channel.empty", "There is no complete loaded volume to discard.", "Aspirate before using the explicit discard operation.", [operation.pipetteId]);
  const discarded = runtime.channelContents.reduce<AssayQuantity>((total, content) => addVolumes(total, content.volume), zeroVolume());
  const next = structuredClone(state);
  next.pipettes[index].channelContents = [];
  next.pipettes[index].status = "tips-attached";
  return { state: next, summary: `Discarded ${discarded.value} ${discarded.unit} to ${operation.wasteRef}.`, objectRefs: [definition.id, operation.wasteRef], data: { discardedVolume: discarded.value, unit: discarded.unit, wasteRef: operation.wasteRef, channelCount: definition.channels, componentVolumes: runtime.channelContents.flatMap(({ channelIndex, components }) => components.map((component) => `${channelIndex}:${component.resourceRef}:${toMicroliters(component.volume).value}:uL`)) } };
};

const mix = (state: AssayRuntimeState, operation: Extract<AssayOperation, { type: "mix" }>): AcceptedMutation => {
  const { runtime, definition, index } = pipetteContext(state, operation.pipetteId);
  assertion(runtime.attachedTips.length === definition.channels, "assay.pipetting.tip.missing", "Every channel requires an attached compatible tip.", "Attach tips before mixing.", [operation.pipetteId]);
  assertion(runtime.channelContents.length === 0, "assay.pipetting.channel.not-empty", "Mixing requires empty pipette channels.", "Dispense or explicitly discard loaded liquid first.", [operation.pipetteId]);
  const mappings = resolveTargetSelection(definition, operation.target);
  const diagnostics: AssayRuntimeDiagnostic[] = [];
  const nextTips: PipetteTipState[] = [];
  for (const mapping of mappings) {
    const well = findWell(state, mapping.coordinate);
    assertion(compareVolumes(well.volume, runtime.setVolume) >= 0, "assay.pipetting.mix.insufficient", `${mapping.coordinate} has insufficient volume for the selected mix volume.`, "Reduce the pipette volume or add liquid.", [mapping.coordinate]);
    const used = useTip(state, operation, runtime.attachedTips[mapping.channelIndex], `well:${mapping.coordinate}`, well.contaminationTags);
    nextTips[mapping.channelIndex] = used.tip;
    diagnostics.push(...used.diagnostics);
  }
  const next = structuredClone(state);
  for (const mapping of mappings) {
    const wellIndex = next.plate.wells.findIndex(({ coordinate }) => coordinate === mapping.coordinate);
    next.plate.wells[wellIndex] = { ...next.plate.wells[wellIndex], mixed: true };
  }
  next.pipettes[index].attachedTips = nextTips;
  next.pipettes[index].contaminationTags = uniqueSorted(nextTips.flatMap(({ contaminationTags }) => contaminationTags));
  next.pipettes[index].status = "tips-attached";
  const refs = mappings.map(({ coordinate }) => `well:${coordinate}`);
  return { state: next, diagnostics, summary: `Mixed ${mappings.length} well(s) for ${operation.cycles} cycle(s).`, objectRefs: [definition.id, ...refs], data: { cycles: operation.cycles, volumePerCycle: toMicroliters(runtime.setVolume).value, unit: "uL", destinationRefs: refs } };
};

const ejectTips = (state: AssayRuntimeState, operation: Extract<AssayOperation, { type: "ejectTips" }>): AcceptedMutation => {
  const { runtime, index } = pipetteContext(state, operation.pipetteId);
  assertion(runtime.attachedTips.length > 0, "assay.pipetting.tip.none", "No tips are attached.", "Attach tips before attempting ejection.", [operation.pipetteId]);
  assertion(runtime.channelContents.length === 0, "assay.pipetting.tip.loaded", "Loaded tips cannot be silently ejected.", "Dispense or use the explicit discard operation before ejection.", [operation.pipetteId]);
  const count = runtime.attachedTips.length;
  const next = structuredClone(state);
  next.pipettes[index] = createPipetteRuntimeState(state.pipetteDefinitions.find(({ id }) => id === operation.pipetteId)!, runtime.setVolume);
  return { state: next, summary: `Ejected ${count} tip(s).`, objectRefs: [operation.pipetteId], data: { tipCount: count } };
};

const recoverInvalid = (state: AssayRuntimeState, operation: Extract<AssayOperation, { type: "recoverInvalid" }>): AcceptedMutation => {
  const { runtime, definition, index } = pipetteContext(state, operation.pipetteId);
  assertion(operation.confirmDiscard, "assay.pipetting.recovery.confirmation-required", "Recovery may discard loaded liquid and tips and therefore requires explicit confirmation.", "Confirm discard or manually dispense/discard and eject.", [operation.pipetteId]);
  const discarded = runtime.channelContents.reduce<AssayQuantity>((total, content) => addVolumes(total, content.volume), zeroVolume());
  const next = structuredClone(state);
  next.pipettes[index] = createPipetteRuntimeState(definition, runtime.setVolume);
  return { state: next, summary: `Recovered ${operation.pipetteId}; discarded ${discarded.value} ${discarded.unit} and ${runtime.attachedTips.length} tip(s).`, objectRefs: [operation.pipetteId], data: { discardedVolume: discarded.value, unit: discarded.unit, discardedTipCount: runtime.attachedTips.length, explicitConfirmation: true } };
};

const applyOperation = (state: AssayRuntimeState, operation: AssayOperation): AcceptedMutation => {
  switch (operation.type) {
    case "selectPipette": return selectPipette(state, operation);
    case "setVolume": return setVolume(state, operation);
    case "attachTips": return attachTips(state, operation);
    case "aspirate": return aspirate(state, operation);
    case "dispense": return dispense(state, operation);
    case "discard": return discard(state, operation);
    case "mix": return mix(state, operation);
    case "ejectTips": return ejectTips(state, operation);
    case "recoverInvalid": return recoverInvalid(state, operation);
  }
};

export const reduceAssayRuntime = (
  state: AssayRuntimeState,
  input: unknown,
): AssayRuntimeTransition => {
  const validation = validateAssayOperation(input);
  if (!validation.ok) {
    const diagnostics: AssayRuntimeDiagnostic[] = validation.diagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      severity: "error",
      message: `${diagnostic.path}: ${diagnostic.message}`,
      operationId: typeof input === "object" && input !== null && "operationId" in input && typeof input.operationId === "string" ? input.operationId : "invalid-operation",
      recovery: "Correct the operation contract and retry.",
      objectRefs: [],
    }));
    return { state, accepted: false, diagnostics, evidence: projectAssayOperationEvidence(null, false, "Rejected invalid assay operation contract.", [], { diagnosticCodes: diagnostics.map(({ code }) => code) }) };
  }
  const operation = validation.value;
  if (state.acceptedOperationIds.includes(operation.operationId)) {
    const diagnostics: AssayRuntimeDiagnostic[] = [{ code: "assay.runtime.operation.duplicate", severity: "error", message: `Operation id ${operation.operationId} was already accepted.`, operationId: operation.operationId, recovery: "Supply a unique operation id.", objectRefs: [operation.operationId] }];
    return { state, accepted: false, diagnostics, evidence: projectAssayOperationEvidence(operation, false, diagnostics[0].message, diagnostics[0].objectRefs, { diagnosticCodes: diagnostics.map(({ code }) => code) }) };
  }
  try {
    const mutation = applyOperation(state, operation);
    mutation.state.acceptedOperationIds = [...state.acceptedOperationIds, operation.operationId];
    return {
      state: mutation.state,
      accepted: true,
      diagnostics: mutation.diagnostics ?? [],
      evidence: projectAssayOperationEvidence(operation, true, mutation.summary, mutation.objectRefs, mutation.data),
    };
  } catch (caught) {
    const diagnosed = caught instanceof RuntimeOperationError
      ? caught
      : new RuntimeOperationError(
          "assay.runtime.exact-calculation",
          caught instanceof Error ? caught.message : "Exact assay runtime calculation failed.",
          "Choose quantities whose exact decimal result is representable or revise the operation.",
        );
    const diagnostic: AssayRuntimeDiagnostic = { code: diagnosed.code, severity: "error", message: diagnosed.message, operationId: operation.operationId, recovery: diagnosed.recovery, objectRefs: diagnosed.objectRefs };
    return { state, accepted: false, diagnostics: [diagnostic], evidence: projectAssayOperationEvidence(operation, false, diagnostic.message, diagnostic.objectRefs, { diagnosticCodes: [diagnostic.code] }) };
  }
};

export const operationFromIntent = (
  intent: AssayRuntimeIntent,
  operationId: string,
): AssayOperation => ({
  schema: assayOperationSchemaId,
  schemaVersion: assayOperationSchemaVersion,
  operationId,
  ...structuredClone(intent),
} as AssayOperation);

export const dispatchAssayRuntimeIntent = (
  state: AssayRuntimeState,
  intent: AssayRuntimeIntent,
  operationId = `${state.runId}:operation:${state.acceptedOperationIds.length + 1}`,
): AssayRuntimeTransition => reduceAssayRuntime(state, operationFromIntent(intent, operationId));

export const replayAssayOperations = (
  initialState: AssayRuntimeState,
  operations: readonly AssayOperation[],
): AssayReplayResult => {
  let state = initialState;
  const transitions: AssayRuntimeTransition[] = [];
  for (const operation of operations) {
    const transition = reduceAssayRuntime(state, operation);
    transitions.push(transition);
    state = transition.state;
  }
  return { state, transitions, evidence: transitions.map(({ evidence }) => evidence) };
};
