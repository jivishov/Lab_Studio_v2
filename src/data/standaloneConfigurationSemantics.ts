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

/** An instance's definition, from its id in the starting equipment. */
const initialDefinitionOf = (definition: TechniqueDefinition, instanceId: unknown): string | undefined =>
  typeof instanceId === "string"
    ? definition.initialState.equipment.find((instance) => instance.id === instanceId)?.definitionId
    : undefined;

/** The solid a named source starts with: an authored number, or a teacher-set slot. */
const initialAvailableMass = (
  definition: TechniqueDefinition,
  values: ReadonlyMap<string, TechniqueConfigurationValue>,
  params: Record<string, unknown>,
): number | undefined => {
  const instances = definition.initialState.equipment.filter((instance) =>
    typeof params.sourceInstanceId === "string"
      ? instance.id === params.sourceInstanceId
      : instance.definitionId === params.sourceDefinitionId);
  if (instances.length !== 1) return undefined;
  const massG: unknown = instances[0].contents.massG;
  if (typeof massG === "number" && Number.isFinite(massG)) return massG;
  const slotId = directConfigSlot(massG);
  return slotId ? numeric(values, slotId) : undefined;
};

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
    if (/(?:VolumeMl|MassG|DurationMinutes|Factor|WavelengthNm|PercentTransmittance)$/i.test(slotId) && value <= 0) {
      add([slotId], `${slotId} must be greater than zero.`);
    }
    // A prepared transmittance is a reading a photometer can show: greater than 0 and at most 100 %T.
    if (/PercentTransmittance$/i.test(slotId) && value > 100) {
      add([slotId], `${slotId} must be at most 100 %T.`);
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

    // A literal volume contract (a teacher-set volume) must fit its receiving container.
    const literalSlot = action.volume?.source === "literal" ? directConfigSlot(action.volume.valueMl) : undefined;
    const literalValue = literalSlot ? numeric(values, literalSlot) : undefined;
    if (literalSlot && literalValue !== undefined && literalValue > 0) {
      const targetDefinitionId = typeof params.targetDefinitionId === "string"
        ? params.targetDefinitionId
        : initialDefinitionOf(definition, params.targetInstanceId);
      const targetCapacity = targetDefinitionId ? equipmentById.get(targetDefinitionId)?.capacity : undefined;
      if (targetCapacity?.unit === "mL" && targetCapacity.amount > 0 && literalValue > targetCapacity.amount) {
        add(
          [literalSlot],
          `${literalSlot} (${literalValue} mL) exceeds the ${targetDefinitionId} capacity of ${targetCapacity.amount} mL.`,
        );
      }
    }

    // A teacher-set solid portion cannot exceed what its source starts with.
    const massSlot = action.verb === "transfer" ? directConfigSlot(params.massG) : undefined;
    const massValue = massSlot ? numeric(values, massSlot) : undefined;
    if (massSlot && massValue !== undefined && massValue > 0) {
      const available = initialAvailableMass(definition, values, params);
      if (available !== undefined && massValue > available) {
        add(
          [massSlot],
          `${massSlot} (${massValue} g) exceeds the ${String(params.sourceInstanceId ?? params.sourceDefinitionId)} starting mass of ${available} g.`,
        );
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

  if (definition.id === "transmittance-dilution") {
    const stockConcentration = numeric(values, "stockConcentrationM");
    if (stockConcentration !== undefined && stockConcentration <= 0) {
      add(
        ["stockConcentrationM"],
        "stockConcentrationM must be greater than zero so the instructor-approved concentration is usable in the dilution calculation.",
      );
    }
    // The dilution fills the receiver from the aliquot to the final volume with the measured water,
    // so the final volume must exceed the aliquot and the water must cover the difference.
    const aliquot = numeric(values, "stockAliquotVolumeMl");
    const water = numeric(values, "waterVolumeMl");
    const finalVolume = numeric(values, "finalVolumeMl");
    if (aliquot !== undefined && finalVolume !== undefined && finalVolume <= aliquot) {
      add(
        ["stockAliquotVolumeMl", "finalVolumeMl"],
        "finalVolumeMl must be greater than the stock aliquot volume.",
      );
    }
    if (aliquot !== undefined && water !== undefined && finalVolume !== undefined && finalVolume > aliquot + water) {
      add(
        ["stockAliquotVolumeMl", "waterVolumeMl", "finalVolumeMl"],
        `waterVolumeMl must cover the dilution from the aliquot to the final volume (at least ${finalVolume - aliquot} mL).`,
      );
    }
  }

  if (definition.id === "dilution") {
    // The aliquot is delivered from a 10 mL graduated pipette into a 100 mL volumetric flask
    // (decided 2026-10-02), so the final volume is the flask's and the factor is calculated.
    const aliquot = numeric(values, "aliquotVolumeMl");
    if (aliquot !== undefined && (aliquot <= 0 || aliquot > 10)) {
      add(["aliquotVolumeMl"], "aliquotVolumeMl must be greater than 0 and at most 10 mL, the graduated pipette's capacity.");
    }
    const stock = numeric(values, "stockConcentrationM");
    if (stock !== undefined && stock <= 0) {
      add(["stockConcentrationM"], "stockConcentrationM must be greater than zero.");
    }
  }

  if (definition.id === "making-solution") {
    // The weighed sodium carbonate is dissolved in the half-full 100 mL flask, then made up to the
    // mark (decided 2026-10-04), so the final volume is the flask's and the mass must dissolve in about
    // 50 mL: sodium carbonate dissolves to about 21 g per 100 mL of water at 20 °C.
    const mass = numeric(values, "soluteMassG");
    if (mass !== undefined && mass > 10) {
      add(["soluteMassG"], "soluteMassG must be at most 10 g, so it dissolves in the half-full 100 mL flask.");
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
