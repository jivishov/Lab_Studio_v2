import { format96WellCoordinate, parse96WellCoordinate, WELL_COLUMNS_96, WELL_ROWS_96 } from "../plate";
import type { ChannelWellMapping, PipetteChannelCount, PipetteOrientation } from "./types";

export class PipetteMappingError extends Error {
  readonly code = "assay.pipetting.mapping.out-of-bounds" as const;

  constructor(message: string) {
    super(message);
    this.name = "PipetteMappingError";
  }
}

export const mapMultichannelSelection = (
  anchor: string,
  channels: PipetteChannelCount,
  orientation: PipetteOrientation,
): ChannelWellMapping[] => {
  const parsed = parse96WellCoordinate(anchor);
  if (!parsed) throw new PipetteMappingError(`Invalid 96-well anchor ${anchor}.`);
  if (channels === 1) return [{ channelIndex: 0, coordinate: anchor }];
  const mappings = Array.from({ length: channels }, (_, channelIndex) => {
    const row = WELL_ROWS_96[parsed.rowIndex + (orientation === "vertical" ? channelIndex : 0)];
    const column = WELL_COLUMNS_96[parsed.columnIndex + (orientation === "horizontal" ? channelIndex : 0)];
    if (!row || !column) {
      throw new PipetteMappingError(
        `${channels}-channel ${orientation} mapping from ${anchor} leaves the 96-well plate at channel ${channelIndex + 1}.`,
      );
    }
    return { channelIndex, coordinate: format96WellCoordinate(row, column) };
  });
  return mappings;
};
