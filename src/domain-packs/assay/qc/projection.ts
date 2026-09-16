import type {
  AssayObservationSet,
  AssayQcChartProjection,
  AssayQcEvaluation,
  AssayQcTableProjection,
} from "./types";

export const createAssayQcTableProjection = (
  observationSet: AssayObservationSet,
  evaluation: AssayQcEvaluation,
): AssayQcTableProjection => {
  const observations = new Map(observationSet.observations.map((observation) => [
    observation.id,
    observation,
  ]));
  return {
    columns: [
      { id: "coordinate", label: "Well" },
      { id: "sourceType", label: "Source" },
      { id: "reviewStatus", label: "Review" },
      { id: "rawValue", label: "Raw" },
      { id: "correctedValue", label: "Corrected" },
      { id: "normalizedValue", label: "Normalized" },
      { id: "unit", label: "Unit" },
      { id: "flags", label: "Flags" },
    ],
    rows: evaluation.wellResults.map((result) => {
      const observation = observations.get(result.observationId);
      if (!observation) throw new Error(`Missing observation ${result.observationId} for QC table projection.`);
      return {
        wellId: result.wellId,
        coordinate: result.coordinate,
        sourceType: observation.sourceType,
        reviewStatus: observation.reviewStatus,
        rawValue: result.rawValue,
        correctedValue: result.correctedValue ?? "",
        normalizedValue: result.normalizedValue ?? "",
        unit: result.normalizedValue !== undefined ? "%" : result.unit,
        flags: [...result.flags],
      };
    }),
  };
};

export const createAssayQcChartProjection = (
  table: AssayQcTableProjection,
): AssayQcChartProjection => {
  const hasNormalized = table.rows.some(({ normalizedValue }) => normalizedValue !== "");
  const hasCorrected = table.rows.some(({ correctedValue }) => correctedValue !== "");
  const valueField = hasNormalized
    ? "normalizedValue"
    : hasCorrected
      ? "correctedValue"
      : "rawValue";
  return {
    title: valueField === "normalizedValue"
      ? "Normalized reviewed signal by well"
      : valueField === "correctedValue"
        ? "Background-corrected signal by well"
        : "Reviewed raw signal by well",
    valueField,
    points: table.rows.flatMap((row) => {
      const value = row[valueField];
      return value === ""
        ? []
        : [{
            wellId: row.wellId,
            coordinate: row.coordinate,
            value,
            unit: valueField === "normalizedValue" ? "%" : row.unit,
            flags: [...row.flags],
          }];
    }),
  };
};
