export const formatEvidenceValue = (value: number, unit: string): string => {
  if (!Number.isFinite(value)) return `${value} ${unit}`.trim();
  if (unit === "g") return `${value.toFixed(Math.abs(value) < 0.1 ? 4 : 3)} g`;
  if (unit === "mL") return `${value.toFixed(1)} mL`;
  if (unit === "mg/L as CaCO3") return `${value.toFixed(2)} mg/L as CaCO3`;
  if (unit === "x") return `${value.toFixed(2)}x`;
  if (unit === "%T") return `${value.toFixed(1)} %T`;
  if (unit === "A") return `${value.toFixed(4)} A`;
  if (unit === "uM") return `${value.toFixed(2)} uM`;
  if (unit === "") return value.toFixed(Math.abs(value) < 1 ? 4 : 2);
  return `${value} ${unit}`.trim();
};
