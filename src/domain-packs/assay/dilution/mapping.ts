import type { DilutionTargetGroup } from "./types";

const rows = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;

/** Creates 12 column-oriented 8-channel groups covering a canonical 96-well plate. */
export const createCanonical96WellDilutionTargets = (plateId: string): DilutionTargetGroup[] =>
  Array.from({ length: 12 }, (_, columnIndex) => ({
    id: `${plateId}:column-${columnIndex + 1}`,
    targets: rows.map((row, channelIndex) => ({
      targetId: `${plateId}:${row}${columnIndex + 1}`,
      plateId,
      coordinate: `${row}${columnIndex + 1}`,
      channelIndex,
      channelCount: 8 as const,
      orientation: "column" as const,
    })),
  }));

