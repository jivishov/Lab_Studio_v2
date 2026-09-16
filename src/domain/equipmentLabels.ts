export const sentenceEquipmentLabel = (label: string): string => {
  const trimmed = label.trim();
  if (!trimmed) return trimmed;
  return `${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`;
};

export const definiteEquipmentLabel = (label: string): string => {
  const naturalLabel = sentenceEquipmentLabel(label);
  return naturalLabel.toLowerCase().startsWith("the ") ? naturalLabel : `the ${naturalLabel}`;
};
