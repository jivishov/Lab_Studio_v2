import type {
  TechniqueConfigurationValue,
  TechniqueDefinition,
} from "../domain/types";
import { equipmentById } from "../equipment/catalog";

const CONFIGURATION_TEMPLATE = /^\{\{config\.([A-Za-z0-9_-]+)\}\}$/;

export interface StandaloneConfigurationSemanticIssue {
  slotIds: readonly string[];
  message: string;
}

const numeric = (
  values: ReadonlyMap<string, TechniqueConfigurationValue>,
  slotId: string,
): number | undefined => {
  const value = values.get(slotId);
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

const directConfigSlot = (value: unknown): string | undefined =>
  typeof value === "string" ? value.match(CONFIGURATION_TEMPLATE)?.[1] : undefined;

const initialAvailableVolume = (
  definition: TechniqueDefinition,
  definitionId: string,
): number | undefined => {
  const volumes = definition.initialState.equipment
    .filter((instance) => instance.definitionId === definitionId)
    .map((instance) => instance.contents.volumeMl)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return volumes.length === 1 ? volumes[0] : undefined;
};

const sourceAuthoredRange = (
  value: unknown,
  unitToken: "C" | "minutes",
): readonly [number, number] | undefined => {
  if (typeof value !== "string") return undefined;
  const unit = unitToken === "C" ? "C" : "minutes?";
  const match = value.match(new RegExp(
    `within\\s+(-?\\d+(?:\\.\\d+)?)\\s*[-–]\\s*(-?\\d+(?:\\.\\d+)?)\\s*${unit}`,
    "i",
  ));
  if (!match) return undefined;
  const low = Number(match[1]);
  const high = Number(match[2]);
  return Number.isFinite(low) && Number.isFinite(high) && low <= high ? [low, high] : undefined;
};

/**
 * Validate only constraints supported by the authored definition/runtime model.
 *
 * This is intentionally not a generic chemistry oracle. It prevents the standalone form from
 * converting syntactically valid but physically impossible values into a runnable definition:
 * positive quantities remain positive, direct transfers respect the authored source inventory and
 * target capacity, source-authored numeric ranges are honored, and the two standalone workflows
 * with explicit cross-field meaning keep those relationships intact.
 */
export const validateStandaloneConfigurationSemantics = (
  definition: TechniqueDefinition,
  values: ReadonlyMap<string, TechniqueConfigurationValue>,
): StandaloneConfigurationSemanticIssue[] => {
  const issues: StandaloneConfigurationSemanticIssue[] = [];
  const seen = new Set<string>();
  const add = (slotIds: readonly string[], message: string) => {
    const key = `${slotIds.join("|")}\u0000${message}`;
    if (seen.has(key)) return;
    seen.add(key);
    issues.push({ slotIds, message });
  };

  for (const [slotId, value] of values) {
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    if (/(?:VolumeMl|MassG|DurationMinutes|Factor)$/i.test(slotId) && value <= 0) {
      add([slotId], `${slotId} must be greater than zero.`);
    }
  }

  for (const action of definition.actions) {
    const params = action.parameters;
    for (const parameterKey of ["volumeMl", "finalVolumeMl"] as const) {
      const slotId = directConfigSlot(params[parameterKey]);
      if (!slotId) continue;
      const value = numeric(values, slotId);
      if (value === undefined || value <= 0) continue;

      const targetDefinitionId = typeof params.targetDefinitionId === "string"
        ? params.targetDefinitionId
        : undefined;
      const targetCapacity = targetDefinitionId
        ? equipmentById.get(targetDefinitionId)?.capacity.amount
        : undefined;
      if (targetCapacity && targetCapacity > 0 && value > targetCapacity) {
        add(
          [slotId],
          `${slotId} (${value} mL) exceeds the ${targetDefinitionId} capacity of ${targetCapacity} mL.`,
        );
      }

      if (parameterKey === "volumeMl") {
        const sourceDefinitionId = typeof params.sourceDefinitionId === "string"
          ? params.sourceDefinitionId
          : undefined;
        const available = sourceDefinitionId
          ? initialAvailableVolume(definition, sourceDefinitionId)
          : undefined;
        if (available !== undefined && value > available) {
          add(
            [slotId],
            `${slotId} (${value} mL) exceeds the authored ${sourceDefinitionId} starting volume of ${available} mL.`,
          );
        }
      }
    }

    const temperatureSlot = directConfigSlot(params.temperatureC);
    const temperatureRange = sourceAuthoredRange(params.temperatureProvenance, "C");
    if (temperatureSlot && temperatureRange) {
      const value = numeric(values, temperatureSlot);
      if (value !== undefined && (value < temperatureRange[0] || value > temperatureRange[1])) {
        add(
          [temperatureSlot],
          `${temperatureSlot} must stay within the authored ${temperatureRange[0]}-${temperatureRange[1]} °C range.`,
        );
      }
    }

    const durationSlot = directConfigSlot(params.durationMinutes);
    const durationRange = sourceAuthoredRange(params.durationProvenance, "minutes");
    if (durationSlot && durationRange) {
      const value = numeric(values, durationSlot);
      if (value !== undefined && (value < durationRange[0] || value > durationRange[1])) {
        add(
          [durationSlot],
          `${durationSlot} must stay within the authored ${durationRange[0]}-${durationRange[1]} minute range.`,
        );
      }
    }
  }

  if (definition.id === "dilution") {
    const aliquot = numeric(values, "aliquotVolumeMl");
    const finalVolume = numeric(values, "finalVolumeMl");
    const factor = numeric(values, "dilutionFactor");
    if (aliquot !== undefined && finalVolume !== undefined && finalVolume < aliquot) {
      add(
        ["aliquotVolumeMl", "finalVolumeMl"],
        "finalVolumeMl must be at least the transferred aliquot volume.",
      );
    }
    if (aliquot && finalVolume && factor) {
      const expected = finalVolume / aliquot;
      const tolerance = Math.max(1e-9, Math.abs(expected) * 1e-9);
      if (Math.abs(factor - expected) > tolerance) {
        add(
          ["aliquotVolumeMl", "finalVolumeMl", "dilutionFactor"],
          `dilutionFactor must equal finalVolumeMl / aliquotVolumeMl (${expected}).`,
        );
      }
    }
  }

  if (definition.id === "making-solution") {
    const initial = numeric(values, "initialSolventVolumeMl");
    const finalVolume = numeric(values, "finalVolumeMl");
    if (initial !== undefined && finalVolume !== undefined && finalVolume < initial) {
      add(
        ["initialSolventVolumeMl", "finalVolumeMl"],
        "finalVolumeMl must be at least the initial solvent volume already placed in the flask.",
      );
    }
  }

  if (definition.id === "hard-water-gravimetry") {
    const oven = numeric(values, "ovenTemperatureC");
    const cooled = numeric(values, "coolingTemperatureC");
    if (oven !== undefined && cooled !== undefined && cooled >= oven) {
      add(
        ["ovenTemperatureC", "coolingTemperatureC"],
        "coolingTemperatureC must be below ovenTemperatureC so the configured cooling step represents cooling before weighing.",
      );
    }
  }

  return issues;
};
