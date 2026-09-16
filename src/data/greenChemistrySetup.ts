/**
 * The single trusted boundary for the teacher-controlled green-chemistry setup.
 *
 * This module deliberately has no catalog, loader, route, player, or equipment dependencies. It
 * can therefore be used by both the production loader and the custom route without creating a
 * second validation or identity authority.
 */

import type { BundledLabSourceDefinition, TechniqueConfigurationValue } from "../domain/types";

export const GREEN_CHEMISTRY_LAB_ID = "green-chemistry-mixture-purification";
export const GREEN_CHEMISTRY_INSTANCE_ID = "thermal-decomposition";
export const GREEN_CHEMISTRY_TECHNIQUE_ID = "thermal-decomposition-mass-loss";
export const GREEN_CHEMISTRY_TECHNIQUE_VERSION = "2.0.1";

export const UNCONFIGURED_TEXT = "unconfigured-teacher-choice";

/**
 * Configuration-slot key the published lab's reachability witnesses pin, one witness per approved
 * tare convention. `configurationForWitness` in the compiler prefers a witness value over the
 * instance binding, so the selected witness — not the binding — is what a compiled action carries.
 */
export const GREEN_CHEMISTRY_TARE_WITNESS_SLOT = `${GREEN_CHEMISTRY_INSTANCE_ID}.tareConvention`;

/** Approval gate the same witnesses declare for this instance. */
export const GREEN_CHEMISTRY_APPROVAL_GATE_KEY = `${GREEN_CHEMISTRY_INSTANCE_ID}.teacher-approved-plan`;

export const GREEN_CHEMISTRY_TARE_CONVENTIONS = [
  "record-crucible-plus-lid",
  "tare-balance-with-crucible-plus-lid",
] as const;

export type GreenChemistryTareConvention =
  (typeof GREEN_CHEMISTRY_TARE_CONVENTIONS)[number];

export interface GreenChemistryApprovedConfiguration {
  sampleMassG: number;
  warmDurationMin: number;
  heatingDurationMin: number;
  heatingIntensity: string;
  constantMassToleranceG: number;
  maximumHeatCycles: number;
  coolingEndpointC: number;
  coolingSurface: string;
  tareConvention: GreenChemistryTareConvention;
  minimumReplicates: number;
}

export type GreenChemistrySetup = GreenChemistryApprovedConfiguration;

export const GREEN_CHEMISTRY_SETUP_KEYS = [
  "sampleMassG",
  "warmDurationMin",
  "heatingDurationMin",
  "heatingIntensity",
  "constantMassToleranceG",
  "maximumHeatCycles",
  "coolingEndpointC",
  "coolingSurface",
  "tareConvention",
  "minimumReplicates",
] as const satisfies readonly (keyof GreenChemistryApprovedConfiguration)[];

const POSITIVE_FINITE_KEYS = [
  "sampleMassG",
  "warmDurationMin",
  "heatingDurationMin",
  "constantMassToleranceG",
] as const;

const POSITIVE_SAFE_INTEGER_KEYS = ["maximumHeatCycles", "minimumReplicates"] as const;
const TEXT_KEYS = ["heatingIntensity", "coolingSurface"] as const;

type GreenChemistrySetupKey = (typeof GREEN_CHEMISTRY_SETUP_KEYS)[number];

export class GreenChemistrySetupValidationError extends Error {
  readonly errors: readonly string[];

  constructor(errors: readonly string[]) {
    super(errors.join(" "));
    this.name = "GreenChemistrySetupValidationError";
    this.errors = [...errors];
  }
}

const errorText = (error: unknown): string =>
  error instanceof Error && error.message ? error.message : "unknown inspection failure";

const isPlaceholderText = (value: string): boolean => {
  const normalized = value.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
  return (
    normalized.length === 0
    || normalized === UNCONFIGURED_TEXT
    || normalized === "unconfigured"
    || normalized === "placeholder"
    || normalized === "tbd"
    || normalized === "todo"
    || normalized === "n/a"
    || normalized === "na"
    || normalized === "none"
    || normalized === "select"
    || normalized === "select an option"
    || normalized === "choose"
    || normalized === "choose an option"
  );
};

const ownKeys = (value: object): (string | symbol)[] => Reflect.ownKeys(value);

const describeUnexpectedKey = (key: string | symbol): string =>
  typeof key === "symbol"
    ? "Green-chemistry setup cannot contain symbol-keyed properties."
    : `Green-chemistry setup contains unexpected field "${key}".`;

const inspectSetup = (input: unknown): {
  values?: Partial<Record<GreenChemistrySetupKey, unknown>>;
  errors: string[];
} => {
  if (typeof input !== "object" || input === null) {
    return { errors: ["Green-chemistry setup must be a non-null plain object."] };
  }
  if (Array.isArray(input)) {
    return { errors: ["Green-chemistry setup must be a plain object, not an array."] };
  }

  try {
    const prototype = Object.getPrototypeOf(input);
    const errors: string[] = [];
    if (prototype !== Object.prototype && prototype !== null) {
      errors.push("Green-chemistry setup must use Object.prototype or a null prototype.");
    }

    const keys = ownKeys(input);
    const expected = new Set<string>(GREEN_CHEMISTRY_SETUP_KEYS);
    for (const key of keys) {
      if (typeof key === "symbol" || !expected.has(key)) errors.push(describeUnexpectedKey(key));
    }
    for (const key of GREEN_CHEMISTRY_SETUP_KEYS) {
      if (!keys.includes(key)) errors.push(`Green-chemistry setup is missing field "${key}".`);
    }

    const values: Partial<Record<GreenChemistrySetupKey, unknown>> = {};
    for (const key of GREEN_CHEMISTRY_SETUP_KEYS) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (!descriptor) continue;
      if (!("value" in descriptor)) {
        errors.push(`Green-chemistry setup field "${key}" must be a data property, not an accessor.`);
        continue;
      }
      values[key] = descriptor.value;
    }
    return { values, errors };
  } catch (error) {
    return {
      errors: [`Green-chemistry setup could not be inspected safely: ${errorText(error)}.`],
    };
  }
};

const validateValues = (
  values: Partial<Record<GreenChemistrySetupKey, unknown>>,
  errors: string[],
): GreenChemistryApprovedConfiguration | undefined => {
  const validated: Partial<GreenChemistryApprovedConfiguration> = {};

  for (const key of POSITIVE_FINITE_KEYS) {
    const value = values[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      errors.push(`Green-chemistry setup "${key}" must be a positive finite number.`);
      continue;
    }
    validated[key] = value;
  }

  for (const key of POSITIVE_SAFE_INTEGER_KEYS) {
    const value = values[key];
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
      errors.push(`Green-chemistry setup "${key}" must be a positive safe integer.`);
      continue;
    }
    validated[key] = value;
  }

  const coolingEndpointC = values.coolingEndpointC;
  if (typeof coolingEndpointC !== "number" || !Number.isFinite(coolingEndpointC)) {
    errors.push("Green-chemistry setup \"coolingEndpointC\" must be a finite number.");
  } else {
    validated.coolingEndpointC = coolingEndpointC;
  }

  for (const key of TEXT_KEYS) {
    const value = values[key];
    if (typeof value !== "string") {
      errors.push(`Green-chemistry setup "${key}" must be a nonblank string.`);
      continue;
    }
    const trimmed = value.trim();
    if (isPlaceholderText(trimmed)) {
      errors.push(`Green-chemistry setup "${key}" must not be blank or a placeholder.`);
      continue;
    }
    validated[key] = trimmed;
  }

  const tareConvention = values.tareConvention;
  if (
    typeof tareConvention !== "string"
    || !GREEN_CHEMISTRY_TARE_CONVENTIONS.includes(tareConvention as GreenChemistryTareConvention)
  ) {
    errors.push(
      `Green-chemistry setup "tareConvention" must be "${GREEN_CHEMISTRY_TARE_CONVENTIONS[0]}" or "${GREEN_CHEMISTRY_TARE_CONVENTIONS[1]}".`,
    );
  } else {
    validated.tareConvention = tareConvention as GreenChemistryTareConvention;
  }

  if (errors.length > 0) return undefined;
  return {
    sampleMassG: validated.sampleMassG!,
    warmDurationMin: validated.warmDurationMin!,
    heatingDurationMin: validated.heatingDurationMin!,
    heatingIntensity: validated.heatingIntensity!,
    constantMassToleranceG: validated.constantMassToleranceG!,
    maximumHeatCycles: validated.maximumHeatCycles!,
    coolingEndpointC: validated.coolingEndpointC!,
    coolingSurface: validated.coolingSurface!,
    tareConvention: validated.tareConvention!,
    minimumReplicates: validated.minimumReplicates!,
  };
};

/** Parse, validate, trim, and canonicalize an untrusted teacher setup. */
export const parseGreenChemistrySetup = (
  input: unknown,
): GreenChemistryApprovedConfiguration => {
  const inspected = inspectSetup(input);
  const errors = [...inspected.errors];
  const configuration = inspected.values ? validateValues(inspected.values, errors) : undefined;
  if (errors.length > 0 || !configuration) throw new GreenChemistrySetupValidationError(errors);
  return configuration;
};

export const canonicalizeGreenChemistrySetup = parseGreenChemistrySetup;
export const parseGreenChemistryConfiguration = parseGreenChemistrySetup;

/** Compatibility diagnostic for existing static route checks. */
export const assertConfigured = (input: unknown): string[] => {
  try {
    parseGreenChemistrySetup(input);
    return [];
  } catch (error) {
    if (error instanceof GreenChemistrySetupValidationError) return [...error.errors];
    return [`Green-chemistry setup is invalid: ${errorText(error)}.`];
  }
};

/**
 * Move the witness that pins the approved tare convention to the front of the witness list.
 *
 * The production loader compiles `reachabilityWitnesses[0]`, and the compiler resolves a
 * configuration slot from the selected witness before the instance binding. Without this the
 * teacher could approve `tare-balance-with-crucible-plus-lid` and still be handed a route compiled
 * against the other convention, because the first witness pins its own value. Selecting here keeps
 * the approved choice and the compiled parameter the same value by construction.
 *
 * Only witnesses whose approval gate for this instance is `true` are eligible: the approval-locked
 * witness is static evidence that the route still compiles with the plan gate false, and it must
 * never become the route a learner is given.
 */
const selectTareConventionWitness = (
  configured: BundledLabSourceDefinition,
  tareConvention: GreenChemistryTareConvention,
): void => {
  const witnesses = configured.reachabilityWitnesses;
  if (!Array.isArray(witnesses) || witnesses.length === 0) {
    throw new Error(
      `Lab "${GREEN_CHEMISTRY_LAB_ID}" must declare reachability witnesses for its approved tare conventions.`,
    );
  }
  for (const convention of GREEN_CHEMISTRY_TARE_CONVENTIONS) {
    const covered = witnesses.some(
      (witness) =>
        witness.configuration[GREEN_CHEMISTRY_TARE_WITNESS_SLOT] === convention
        && witness.approvalGates[GREEN_CHEMISTRY_APPROVAL_GATE_KEY] === true,
    );
    if (!covered) {
      throw new Error(
        `Lab "${GREEN_CHEMISTRY_LAB_ID}" declares no approved reachability witness for tare convention "${convention}".`,
      );
    }
  }
  const selectedIndex = witnesses.findIndex(
    (witness) =>
      witness.configuration[GREEN_CHEMISTRY_TARE_WITNESS_SLOT] === tareConvention
      && witness.approvalGates[GREEN_CHEMISTRY_APPROVAL_GATE_KEY] === true,
  );
  const [selected] = witnesses.splice(selectedIndex, 1);
  witnesses.unshift(selected);
};

/**
 * Bind one canonical setup to the one owned thermal instance. Identity is checked before the
 * clone/overlay so a malformed or mispinned source cannot silently take a legacy path.
 */
export const bindGreenChemistrySetup = <T extends BundledLabSourceDefinition>(
  source: T,
  input: unknown,
): T => {
  const configuration = parseGreenChemistrySetup(input);
  if (source.id !== GREEN_CHEMISTRY_LAB_ID) {
    throw new Error(
      `Green-chemistry setup cannot bind lab "${source.id}"; expected "${GREEN_CHEMISTRY_LAB_ID}".`,
    );
  }
  const instances = source.techniqueInstances;
  if (!Array.isArray(instances)) {
    throw new Error(`Lab "${GREEN_CHEMISTRY_LAB_ID}" is not a composition source.`);
  }
  const matches = instances.filter(
    (instance) => instance.instanceId === GREEN_CHEMISTRY_INSTANCE_ID,
  );
  if (matches.length !== 1) {
    throw new Error(
      `Lab "${GREEN_CHEMISTRY_LAB_ID}" must declare exactly one "${GREEN_CHEMISTRY_INSTANCE_ID}" instance.`,
    );
  }
  const instance = matches[0];
  if (instance.techniqueId !== GREEN_CHEMISTRY_TECHNIQUE_ID) {
    throw new Error(
      `Green-chemistry instance "${GREEN_CHEMISTRY_INSTANCE_ID}" must use technique "${GREEN_CHEMISTRY_TECHNIQUE_ID}".`,
    );
  }
  if (instance.version !== GREEN_CHEMISTRY_TECHNIQUE_VERSION) {
    throw new Error(
      `Green-chemistry instance "${GREEN_CHEMISTRY_INSTANCE_ID}" must pin technique version "${GREEN_CHEMISTRY_TECHNIQUE_VERSION}".`,
    );
  }

  const configured = structuredClone(source);
  const configuredInstance = configured.techniqueInstances?.find(
    (candidate) => candidate.instanceId === GREEN_CHEMISTRY_INSTANCE_ID,
  );
  if (!configuredInstance) {
    throw new Error(
      `Lab "${GREEN_CHEMISTRY_LAB_ID}" lost instance "${GREEN_CHEMISTRY_INSTANCE_ID}" while cloning.`,
    );
  }
  configuredInstance.bindings.configuration = {
    ...configuredInstance.bindings.configuration,
    ...(
      configuration as unknown as Record<string, TechniqueConfigurationValue>
    ),
  };
  selectTareConventionWitness(configured, configuration.tareConvention);
  return configured;
};
