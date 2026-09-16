import type { MicropipetteDefinition, PipetteTipDefinition, TipReusePolicy } from "./types";

export const UNIVERSAL_200_UL_TIP: PipetteTipDefinition = Object.freeze<PipetteTipDefinition>({
  id: "assay.tip.universal-200uL",
  label: "Universal 200 uL tip",
  maximumVolume: { value: "200", unit: "uL" },
  compatiblePipetteIds: ["assay.pipette.single-p200", "assay.pipette.8-channel-p200"],
  sterile: false,
  limitations: ["Instructional runtime definition; no vendor accuracy, precision, or sterility claim."],
});

export const SINGLE_CHANNEL_P200: MicropipetteDefinition = Object.freeze<MicropipetteDefinition>({
  id: "assay.pipette.single-p200",
  label: "Single-channel 20-200 uL micropipette",
  channels: 1,
  minimumVolume: { value: "20", unit: "uL" },
  maximumVolume: { value: "200", unit: "uL" },
  increment: { value: "1", unit: "uL" },
  compatibleTipTypeIds: [UNIVERSAL_200_UL_TIP.id],
  limitations: ["Deterministic nominal-volume model only; no stochastic accuracy or carryover physics."],
});

export const EIGHT_CHANNEL_P200: MicropipetteDefinition = Object.freeze<MicropipetteDefinition>({
  id: "assay.pipette.8-channel-p200",
  label: "8-channel 20-200 uL micropipette",
  channels: 8,
  minimumVolume: { value: "20", unit: "uL" },
  maximumVolume: { value: "200", unit: "uL" },
  increment: { value: "1", unit: "uL" },
  compatibleTipTypeIds: [UNIVERSAL_200_UL_TIP.id],
  limitations: ["Deterministic nominal-volume model only; no stochastic accuracy or carryover physics."],
});

export const micropipetteDefinitions = Object.freeze([SINGLE_CHANNEL_P200, EIGHT_CHANNEL_P200]);
export const pipetteTipDefinitions = Object.freeze([UNIVERSAL_200_UL_TIP]);
export const DEFAULT_TIP_REUSE_POLICY: TipReusePolicy = Object.freeze({ mode: "single-aspiration" });
