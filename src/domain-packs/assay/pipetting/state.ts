import type { AssayQuantity } from "../types";
import type { MicropipetteDefinition, PipetteRuntimeState } from "./types";

export const createPipetteRuntimeState = (
  definition: MicropipetteDefinition,
  initialVolume: AssayQuantity = definition.minimumVolume,
): PipetteRuntimeState => ({
  pipetteId: definition.id,
  setVolume: structuredClone(initialVolume),
  attachedTips: [],
  channelContents: [],
  contaminationTags: [],
  status: "idle",
});
