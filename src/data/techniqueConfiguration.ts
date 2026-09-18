import type {
  LabDefinition,
  TechniqueConfigurationSlot,
  TechniqueConfigurationValue,
  TechniqueDefinition,
} from "../domain/types";
import { validateTechniqueDefinition } from "../domain/validation";
import { validateStandaloneConfigurationSemantics } from "./standaloneConfigurationSemantics";
import { auditStandaloneEvidence } from "./standaloneEvidenceAudit";
import { hostLabsForTechnique } from "./techniqueHosts";

/**
 * Configuration slots a definition still asks for and nobody has filled.
 *
 * A composed lab resolves `{{config.*}}` against its instance bindings and the selected reachability
 * witness while it compiles, and the compiler refuses a binding it cannot find. The standalone
 * technique route has no such step: `loadBundledTechnique` validates a published technique and hands
 * it to the player exactly as authored. A technique whose procedure is written against teacher
 * configuration therefore reaches the runtime with template strings sitting in the parameters that
 * are supposed to hold values and refuses partway through with a message about the value rather than
 * about the missing configuration.
 *
 * While an authored definition still contains configuration templates, required composition
 * declarations that are not bound anywhere are unresolved too only when they have no declared
 * default. A required declaration with an approved default is metadata that can already resolve
 * deterministically; it must not force an otherwise template-free standalone route into setup.
 * Once substitution has produced a concrete definition, declarations alone do not make it unresolved.
 *
 * The current App route uses a non-empty result to enter `TechniqueSetupForm`. A hosted, ordered, or
 * evidence-incomplete technique must still enter that gate even when it has no surviving template,
 * otherwise it can bypass `standaloneTechniqueConfigurationBlocker` and mount Student Player
 * directly. The reserved route marker below is never shown as a teacher field; the setup form turns
 * it into the actionable blocker message/link.
 */
const CONFIGURATION_TEMPLATE = /\{\{config\.([A-Za-z0-9_-]+)\}\}/g;
const STANDALONE_ROUTE_BLOCKED = "__standalone-route-blocked__";

const collect = (value: unknown, found: Set<string>): void => {
  if (typeof value === "string") {
    for (const match of value.matchAll(CONFIGURATION_TEMPLATE)) found.add(match[1]);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collect(item, found);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) collect(item, found);
  }
};

export const unresolvedConfigurationSlots = (
  definition: TechniqueDefinition | LabDefinition,
): string[] => {
  const found = new Set<string>();
  collect(definition.actions, found);
  collect(definition.process, found);
  collect((definition as TechniqueDefinition).successCriteria, found);
  collect((definition as LabDefinition).assessments, found);

  // Declaration-only slots are unresolved only when they are required and have no approved default.
  // A bound template remains unresolved until substitution even when its declaration has a default;
  // the form/materializer will apply that default to the template itself.
  if (found.size > 0) {
    for (const declaration of (definition as TechniqueDefinition).composition?.configurationSlots ?? []) {
      if (
        declaration.required
        && declaration.defaultValue === undefined
        && !found.has(declaration.id)
      ) {
        found.add(declaration.id);
      }
    }
  }

  // Do not let the route skip the setup blocker just because no raw template remains. Keep this
  // deliberately narrower than the blocker itself so a successfully configured unhosted technique
  // does not become unresolved merely because its composition declarations remain as metadata.
  if (found.size === 0 && "successCriteria" in definition) {
    const technique = definition as TechniqueDefinition;
    if (
      hostLabsForTechnique(technique.id).length > 0
      || Boolean(technique.composition?.orderedProcedure)
      || auditStandaloneEvidence(technique).length > 0
    ) {
      found.add(STANDALONE_ROUTE_BLOCKED);
    }
  }

  return [...found].sort();
};

export const unresolvedConfigurationMessage = (slots: readonly string[]): string =>
  `This technique is written against teacher-approved configuration and cannot run as published. `
  + `It is still waiting for ${slots.length === 1 ? "the value" : "values"} for `
  + `${slots.join(", ")}. Hosted techniques must be started from their supported lab composition; `
  + `unhosted techniques may use the standalone setup only when their declared configuration `
  + `contract can be satisfied. No classroom value is invented here.`;

/** Parameter keys whose value names evidence plumbing rather than a classroom quantity. */
const isIdentifierBinding = (key: string): boolean => {
  const lower = key.toLowerCase();
  return lower.endsWith("measurementid")
    || lower.endsWith("calculationid")
    || lower === "referenceid"
    || lower === "tag";
};

const UNIT_BY_SUFFIX: ReadonlyArray<readonly [string, string]> = [
  ["Ml", "mL"],
  ["Mm", "mm"],
  ["Nm", "nm"],
  ["Minutes", "minutes"],
  ["Seconds", "s"],
  ["C", "°C"],
  ["G", "g"],
  ["M", "M"],
];

const unitFor = (slot: string): string | undefined =>
  UNIT_BY_SUFFIX.find(([suffix]) => slot.endsWith(suffix) && slot !== suffix)?.[1];

const humanize = (slot: string, unit?: string): string => {
  const words = slot
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  const withoutUnit = unit
    ? words.replace(/\s+(ml|mm|nm|minutes|seconds|c|g|m)$/i, "")
    : words;
  const sentence = withoutUnit.charAt(0).toUpperCase() + withoutUnit.slice(1);
  return unit ? `${sentence} (${unit})` : sentence;
};

export type ConfigurationSlotKind =
  | "classroom-quantity"
  | "internal-identifier"
  | "host-composition-only";

export interface ConfigurationSlot {
  id: string;
  kind: ConfigurationSlotKind;
  /** Preserved from the technique's declared composition contract whenever one exists. */
  valueType: TechniqueConfigurationSlot["valueType"];
  mode: "numeric" | "text" | "boolean";
  required: boolean;
  allowedValues?: readonly TechniqueConfigurationValue[];
  defaultValue?: TechniqueConfigurationValue;
  unit?: string;
  label: string;
  /** Parameter keys this slot is bound into, so a teacher can see what the value drives. */
  boundTo: readonly string[];
  /** For an internal identifier, the stable name used when no host lab assigns one. */
  derivedValue?: string;
}

const CONFIGURATION_SLOT = /\{\{config\.([A-Za-z0-9_-]+)\}\}/;

const collectBindings = (value: unknown, key: string, found: Map<string, Set<string>>): void => {
  if (typeof value === "string") {
    for (const match of value.matchAll(new RegExp(CONFIGURATION_SLOT, "g"))) {
      const bindings = found.get(match[1]) ?? new Set<string>();
      bindings.add(key);
      found.set(match[1], bindings);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectBindings(item, key, found);
    return;
  }
  if (value && typeof value === "object") {
    for (const [childKey, item] of Object.entries(value as Record<string, unknown>)) {
      collectBindings(item, childKey, found);
    }
  }
};

const modeForValueType = (
  valueType: TechniqueConfigurationSlot["valueType"],
): ConfigurationSlot["mode"] => valueType === "number"
  ? "numeric"
  : valueType === "boolean"
    ? "boolean"
    : "text";

const declaredSlots = (
  definition: TechniqueDefinition | LabDefinition,
): ReadonlyMap<string, TechniqueConfigurationSlot> => new Map(
  ((definition as TechniqueDefinition).composition?.configurationSlots ?? [])
    .map((slot) => [slot.id, slot] as const),
);

/**
 * Every unresolved slot, classified in the order a teacher should meet them. The declared
 * composition contract is authoritative for value type, enum choices, required/default semantics;
 * parameter-name heuristics are used only for legacy definitions that have no declaration.
 */
export const configurationSlots = (
  definition: TechniqueDefinition | LabDefinition,
): ConfigurationSlot[] => {
  const found = new Map<string, Set<string>>();
  collectBindings(definition.actions, "actions", found);
  collectBindings(definition.process, "process", found);
  collectBindings((definition as TechniqueDefinition).successCriteria, "successCriteria", found);
  collectBindings((definition as LabDefinition).assessments, "assessments", found);

  const declarations = declaredSlots(definition);
  const slots = [...found].map(([id, bindings]): ConfigurationSlot => {
    const boundTo = [...bindings].sort();
    const declaration = declarations.get(id);
    const kind: ConfigurationSlotKind = boundTo.every(isIdentifierBinding)
      ? "internal-identifier"
      : "classroom-quantity";
    const valueType: TechniqueConfigurationSlot["valueType"] = declaration?.valueType
      ?? (kind === "internal-identifier" ? "string" : "number");
    const unit = kind === "classroom-quantity" && valueType === "number" ? unitFor(id) : undefined;
    const defaultIdentifier = kind === "internal-identifier" && typeof declaration?.defaultValue === "string"
      ? declaration.defaultValue
      : undefined;
    return {
      id,
      kind,
      valueType,
      mode: modeForValueType(valueType),
      required: declaration?.required ?? true,
      allowedValues: declaration?.allowedValues,
      defaultValue: declaration?.defaultValue,
      unit,
      label: humanize(id, unit),
      boundTo,
      derivedValue: kind === "internal-identifier"
        ? defaultIdentifier ?? derivedIdentifier(id)
        : undefined,
    };
  });

  for (const declaration of declarations.values()) {
    if (found.has(declaration.id)) continue;
    slots.push({
      id: declaration.id,
      kind: "host-composition-only",
      valueType: declaration.valueType,
      mode: modeForValueType(declaration.valueType),
      required: declaration.required,
      allowedValues: declaration.allowedValues,
      defaultValue: declaration.defaultValue,
      label: humanize(declaration.id),
      boundTo: [],
    });
  }

  const rank: Record<ConfigurationSlotKind, number> = {
    "classroom-quantity": 0,
    "internal-identifier": 1,
    "host-composition-only": 2,
  };
  return slots.sort((left, right) =>
    rank[left.kind] === rank[right.kind]
      ? left.id.localeCompare(right.id)
      : rank[left.kind] - rank[right.kind]);
};

export const derivedIdentifier = (slot: string): string =>
  `standalone-${slot.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()}`;

const substitute = (value: unknown, values: ReadonlyMap<string, TechniqueConfigurationValue>): unknown => {
  if (typeof value === "string") {
    const whole = value.match(new RegExp(`^${CONFIGURATION_SLOT.source}$`));
    if (whole) {
      const resolved = values.get(whole[1]);
      return resolved === undefined ? value : resolved;
    }
    return value.replace(new RegExp(CONFIGURATION_SLOT, "g"), (match, slot: string) => {
      const resolved = values.get(slot);
      return resolved === undefined ? match : String(resolved);
    });
  }
  if (Array.isArray(value)) return value.map((item) => substitute(item, values));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, substitute(item, values)]),
    );
  }
  return value;
};

export class TechniqueConfigurationError extends Error {}

const parseDeclaredValue = (slot: ConfigurationSlot, raw: string): TechniqueConfigurationValue => {
  let value: TechniqueConfigurationValue;
  if (slot.valueType === "number") {
    const numeric = Number(raw);
    if (!Number.isFinite(numeric)) {
      throw new TechniqueConfigurationError(`${slot.label} must be a finite number.`);
    }
    value = numeric;
  } else if (slot.valueType === "boolean") {
    if (raw !== "true" && raw !== "false") {
      throw new TechniqueConfigurationError(`${slot.label} must be true or false.`);
    }
    value = raw === "true";
  } else {
    value = raw;
  }

  if (slot.allowedValues && !slot.allowedValues.some((allowed) => Object.is(allowed, value))) {
    throw new TechniqueConfigurationError(
      `${slot.label} must be one of: ${slot.allowedValues.map(String).join(", ")}.`,
    );
  }
  return value;
};

/**
 * Guard the generic Studio composition path before it appends a configured technique to a lab.
 *
 * Studio can materialize ordinary declaration values, but it must not flatten a technique whose
 * procedure/data selection belongs to a supported lab, nor clear a source-level evidence audit by
 * substituting identifier strings. Keep this policy beside the standalone blocker so both entry
 * points share the same structural and evidence boundary.
 */
export const compositionTechniqueConfigurationBlocker = (
  definition: TechniqueDefinition,
): string | null => {
  if (definition.composition?.orderedProcedure) {
    return "This technique uses an ordered-procedure composition contract and cannot be materialized by the generic workflow configuration.";
  }
  if (definition.composition?.catalogDisposition === "lab-scoped") {
    return "This technique is lab-scoped and must be configured by its supported lab composition.";
  }
  if (
    (definition.composition?.variants?.length ?? 0) > 0
    || (definition.composition?.approvalGates?.length ?? 0) > 0
  ) {
    return "This technique has variants or approval gates that require its supported lab composition.";
  }
  const hosts = hostLabsForTechnique(definition.id);
  if (hosts.length > 0) {
    return `This technique has a supported composed lab route (${hosts.map((host) => host.title).join(", ")}); use that route so procedure selection and evidence bindings are materialized together.`;
  }
  const compositionOnly = configurationSlots(definition)
    .filter((slot) =>
      slot.kind === "host-composition-only"
      && slot.required
      && slot.defaultValue === undefined);
  if (compositionOnly.length > 0) {
    return `This technique has required composition-only configuration that the generic workflow configuration cannot materialize: `
      + `${compositionOnly.map((slot) => slot.id).join(", ")}.`;
  }
  const evidenceIssues = auditStandaloneEvidence(definition);
  if (evidenceIssues.length > 0) {
    return `This technique's composition evidence path is incomplete: ${evidenceIssues.map((entry) => entry.message).join(" ")} `
      + `Identifier substitution alone cannot create the missing scientific evidence.`;
  }
  return null;
};

/** Hosted or ordered techniques must stay on the composition path that selects procedure/data. */
export const standaloneTechniqueConfigurationBlocker = (
  definition: TechniqueDefinition,
): string | null => {
  const hosts = hostLabsForTechnique(definition.id);
  if (hosts.length > 0) {
    return `This technique has a supported composed lab route (${hosts.map((host) => host.title).join(", ")}). `
      + `Use that route so procedure selection, datasets, validation and evidence bindings are materialized together.`;
  }
  if (definition.composition?.orderedProcedure) {
    return "This technique uses an ordered-procedure composition contract and cannot be materialized by the standalone setup form.";
  }
  const compositionOnly = configurationSlots(definition)
    .filter((slot) =>
      slot.kind === "host-composition-only"
      && slot.required
      && slot.defaultValue === undefined);
  if (compositionOnly.length > 0) {
    return `This technique has required composition-only configuration that the standalone route cannot materialize: `
      + `${compositionOnly.map((slot) => slot.id).join(", ")}.`;
  }
  const evidenceIssues = auditStandaloneEvidence(definition);
  if (evidenceIssues.length > 0) {
    return `This technique's standalone evidence path is incomplete: ${evidenceIssues.map((entry) => entry.message).join(" ")} `
      + `Identifier substitution alone cannot create the missing scientific evidence.`;
  }
  return null;
};

export const supportsStandaloneTechniqueConfiguration = (
  definition: TechniqueDefinition,
): boolean => standaloneTechniqueConfigurationBlocker(definition) === null;

interface MaterializeConfigurationOptions {
  enforceStandaloneRoute: boolean;
}

const materializeTechniqueConfiguration = <T extends TechniqueDefinition | LabDefinition>(
  definition: T,
  supplied: Readonly<Record<string, string>>,
  options: MaterializeConfigurationOptions,
): T => {
  if (options.enforceStandaloneRoute && "successCriteria" in definition) {
    const blocker = standaloneTechniqueConfigurationBlocker(definition as TechniqueDefinition);
    if (blocker) throw new TechniqueConfigurationError(blocker);
  }

  const values = new Map<string, TechniqueConfigurationValue>();
  const missing: string[] = [];

  for (const slot of configurationSlots(definition)) {
    if (slot.kind === "internal-identifier") {
      values.set(slot.id, slot.derivedValue!);
      continue;
    }

    const raw = supplied[slot.id]?.trim() ?? "";
    if (!raw) {
      if (slot.defaultValue !== undefined) {
        values.set(slot.id, slot.defaultValue);
        continue;
      }
      if (slot.required) missing.push(slot.label);
      continue;
    }
    values.set(slot.id, parseDeclaredValue(slot, raw));
  }

  if (missing.length > 0) {
    throw new TechniqueConfigurationError(
      `Supply the approved classroom ${missing.length === 1 ? "value" : "values"}: ${missing.join(", ")}.`,
    );
  }

  if ("successCriteria" in definition) {
    const semanticIssues = validateStandaloneConfigurationSemantics(
      definition as TechniqueDefinition,
      values,
    );
    if (semanticIssues.length > 0) {
      throw new TechniqueConfigurationError(
        `Configured technique is not physically consistent: ${semanticIssues.map((entry) => entry.message).join(" ")}`,
      );
    }
  }

  const configured = substitute(definition, values) as T;
  if ("successCriteria" in configured) {
    const validation = validateTechniqueDefinition(configured as TechniqueDefinition);
    if (!validation.ok) {
      throw new TechniqueConfigurationError(
        `Configured technique is not valid: ${validation.errors.join(" ")}`,
      );
    }
  }
  return configured;
};

/**
 * Bind a teacher's supplied configuration into an unhosted standalone technique.
 *
 * The composition declaration controls parsing and enum acceptance. Internal identifiers receive
 * stable standalone names (or their declared stable default) but never create the measurements or
 * approved values those names refer to. Hosted/ordered techniques are refused here rather than being
 * flattened into a different procedure. The concrete definition is passed through the shipped
 * technique validator before it can start.
 */
export const applyTechniqueConfiguration = <T extends TechniqueDefinition | LabDefinition>(
  definition: T,
  supplied: Readonly<Record<string, string>>,
): T => materializeTechniqueConfiguration(definition, supplied, { enforceStandaloneRoute: true });

/**
 * Materialize declared slots for Studio composition before ids are prefixed and appended to a draft.
 * Studio is itself a composition surface, but this generic path still refuses hosted, ordered,
 * variant-gated, and evidence-incomplete definitions before materialization. Required declaration-
 * only values must also be supplied (or have an authored default), and the same type/choice/
 * physical/production validation is applied.
 */
export const applyTechniqueConfigurationForComposition = (
  definition: TechniqueDefinition,
  supplied: Readonly<Record<string, string>>,
): TechniqueDefinition => {
  const blocker = compositionTechniqueConfigurationBlocker(definition);
  if (blocker) throw new TechniqueConfigurationError(blocker);
  return materializeTechniqueConfiguration(
    definition,
    supplied,
    { enforceStandaloneRoute: false },
  );
};
