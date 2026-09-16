import type { AssayQuantity, PlateRuntimeState, WellComponentState } from "../types";

export type PipetteChannelCount = 1 | 8;
export type PipetteOrientation = "vertical" | "horizontal";

export interface MicropipetteDefinition {
  id: string;
  label: string;
  channels: PipetteChannelCount;
  minimumVolume: AssayQuantity;
  maximumVolume: AssayQuantity;
  increment: AssayQuantity;
  compatibleTipTypeIds: string[];
  limitations: string[];
}

export interface PipetteTipDefinition {
  id: string;
  label: string;
  maximumVolume: AssayQuantity;
  compatiblePipetteIds: string[];
  sterile: boolean;
  limitations: string[];
}

export type TipReusePolicy =
  | { mode: "single-aspiration" }
  | { mode: "same-source"; maximumAspirationsPerTip: number }
  | { mode: "allow-with-contamination-warning"; maximumAspirationsPerTip: number };

export interface PipetteTipState {
  channelIndex: number;
  tipTypeId: string;
  aspirationCount: number;
  contactedSourceRefs: string[];
  contaminationTags: string[];
}

export interface PipetteChannelContent {
  channelIndex: number;
  volume: AssayQuantity;
  components: WellComponentState[];
  sourceRefs: string[];
  contaminationTags: string[];
}

export interface PipetteRuntimeState {
  pipetteId: string;
  setVolume: AssayQuantity;
  attachedTips: PipetteTipState[];
  channelContents: PipetteChannelContent[];
  contaminationTags: string[];
  status: "idle" | "tips-attached" | "aspirated" | "invalid";
}

export interface ExternalLiquidSourceState {
  id: string;
  kind: "reagent" | "reservoir" | "tube" | "sample";
  volume: AssayQuantity;
  components: WellComponentState[];
  mixed: boolean;
  contaminationTags: string[];
}

export type LiquidLocationRef =
  | { kind: "well"; coordinate: string }
  | { kind: "source"; sourceId: string };

export type LiquidSourceSelection =
  | { kind: "single"; location: LiquidLocationRef }
  | { kind: "shared-source"; sourceId: string }
  | { kind: "plate-multichannel"; anchor: string; orientation: PipetteOrientation };

export type PlateTargetSelection =
  | { kind: "single"; coordinate: string }
  | { kind: "multichannel"; anchor: string; orientation: PipetteOrientation };

export interface ChannelWellMapping {
  channelIndex: number;
  coordinate: string;
}

export interface CreateAssayRuntimeStateOptions {
  runId: string;
  plate: PlateRuntimeState;
  pipetteDefinitions?: readonly MicropipetteDefinition[];
  tipDefinitions?: readonly PipetteTipDefinition[];
  liquidSources?: readonly ExternalLiquidSourceState[];
  tipReusePolicy?: TipReusePolicy;
  selectedPipetteId?: string;
}
