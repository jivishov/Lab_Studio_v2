import type { LabDefinition, TechniqueDefinition } from "../domain/types";

/**
 * Configuration slots a definition still asks for and nobody has filled.
 *
 * A composed lab resolves `{{config.*}}` against its instance bindings and the selected reachability
 * witness while it compiles, and the compiler refuses a binding it cannot find. The standalone
 * technique route has no such step: `loadBundledTechnique` validates a published technique and hands
 * it to the player exactly as authored. A technique whose procedure is written against teacher
 * configuration therefore reaches the runtime with template strings sitting in the parameters that
 * are supposed to hold numbers — a volume, a tolerance, a stop condition — and refuses partway
 * through with a message about the quantity rather than about the missing configuration.
 *
 * This reports what is unresolved so a caller can say so before a learner starts. It fills nothing
 * in: a technique that needs classroom values still needs them, and the host lab that supplies them
 * is the supported way to get them.
 */
const CONFIGURATION_TEMPLATE = /\{\{config\.([A-Za-z0-9_-]+)\}\}/g;

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
  // Labs carry assessments where techniques carry success criteria; both are walked when present.
  collect((definition as TechniqueDefinition).successCriteria, found);
  collect((definition as LabDefinition).assessments, found);
  return [...found].sort();
};

/**
 * Learner-facing explanation for a definition that cannot be started as it stands. It names the
 * exact fields rather than saying the activity is unavailable, so a teacher can tell at a glance
 * which classroom values the activity is waiting for.
 */
export const unresolvedConfigurationMessage = (slots: readonly string[]): string =>
  `This technique is written against teacher-approved configuration and cannot run on its own. `
  + `It is still waiting for ${slots.length === 1 ? "the value" : "values"} for `
  + `${slots.join(", ")}. Start it from a lab that hosts this technique and supplies that `
  + `configuration; no default is substituted here, because a substituted value would not be the `
  + `classroom's.`;

/*
 * ---------------------------------------------------------------------------------------------
 * Supplying the configuration, rather than only reporting that it is missing.
 *
 * Reporting the gap stopped a learner starting an activity that would refuse partway through, but
 * it left six indexed techniques with no way to start at all: no lab composes them, so the host
 * they were sent to does not exist. What follows is the supported path — a teacher supplies the
 * values, exactly as a host lab's compilation would, and nothing is defaulted on their behalf.
 *
 * The slots are not all the same kind of thing, and treating them alike is what would make this
 * dishonest. Two kinds:
 *
 *   - A classroom quantity is a real teaching decision — an aliquot volume, an oven temperature,
 *     a mass tolerance. Only a teacher can supply it, and this module never invents one.
 *   - An internal measurement identifier is evidence plumbing: the name one step files a reading
 *     under so a later step can cite it. A host lab assigns these to keep instances distinct; it
 *     is not a classroom decision and asking a teacher to name one would be asking them to guess
 *     at the runtime's bookkeeping. Standalone, each is bound to a stable derived name.
 *
 * Which kind a slot is comes from where it is bound, not from how its name reads: a slot bound
 * only into identifier-shaped parameters is plumbing, and a slot bound into anything else is a
 * quantity. Mixed bindings count as a quantity, so an unfamiliar binding is asked about rather
 * than filled in.
 * ---------------------------------------------------------------------------------------------
 */

/** Parameter keys whose value names a piece of evidence rather than a measured quantity. */
const isIdentifierBinding = (key: string): boolean => {
  const lower = key.toLowerCase();
  return lower.endsWith("measurementid")
    || lower === "referenceid"
    || lower === "calculationid"
    || lower === "tag";
};

const TEXT_BINDINGS = new Set(["note", "label", "instruction", "tag", "observation"]);

const UNIT_BY_SUFFIX: ReadonlyArray<readonly [string, string]> = [
  ["Ml", "mL"],
  ["Mm", "mm"],
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
    ? words.replace(/\s+(ml|mm|minutes|seconds|c|g|m)$/i, "")
    : words;
  const sentence = withoutUnit.charAt(0).toUpperCase() + withoutUnit.slice(1);
  return unit ? `${sentence} (${unit})` : sentence;
};

export type ConfigurationSlotKind =
  | "classroom-quantity"
  | "internal-identifier"
  /**
   * Declared in the technique's composition contract but bound into nothing the runtime reads.
   * Some are consumed at composition time rather than at play time — an ordered procedure's
   * selection slot is read by `materializeOrderedProcedure`, which only a lab compilation runs —
   * and some are simply declared ahead of use. Either way the standalone route neither needs one
   * nor may invent one, so they are reported rather than asked for.
   */
  | "host-composition-only";

export interface ConfigurationSlot {
  id: string;
  kind: ConfigurationSlotKind;
  mode: "numeric" | "text";
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

/**
 * Every unresolved slot, classified, in the order a teacher should meet them: the values they have
 * to decide first, then the plumbing that is filled in for them.
 */
export const configurationSlots = (
  definition: TechniqueDefinition | LabDefinition,
): ConfigurationSlot[] => {
  const found = new Map<string, Set<string>>();
  collectBindings(definition.actions, "actions", found);
  collectBindings(definition.process, "process", found);
  collectBindings((definition as TechniqueDefinition).successCriteria, "successCriteria", found);
  collectBindings((definition as LabDefinition).assessments, "assessments", found);

  // A technique's composition contract is the declaration of what configuration it takes;
  // `compositionValidation` refuses an instance that binds a slot absent from it. Reading both the
  // declaration and the bindings is what makes the two visibly disagree instead of one silently
  // standing in for the other.
  const declared = ((definition as TechniqueDefinition).composition?.configurationSlots ?? [])
    .map((slot) => slot.id);

  const slots = [...found].map(([id, bindings]): ConfigurationSlot => {
    const boundTo = [...bindings].sort();
    const kind: ConfigurationSlotKind = boundTo.every(isIdentifierBinding)
      ? "internal-identifier"
      : "classroom-quantity";
    const unit = kind === "classroom-quantity" ? unitFor(id) : undefined;
    const mode = boundTo.every((key) => TEXT_BINDINGS.has(key.toLowerCase())) ? "text" : "numeric";
    return {
      id,
      kind,
      mode,
      unit,
      label: humanize(id, unit),
      boundTo,
      derivedValue: kind === "internal-identifier" ? derivedIdentifier(id) : undefined,
    };
  });

  for (const id of declared) {
    if (found.has(id)) continue;
    slots.push({
      id,
      kind: "host-composition-only",
      mode: "text",
      label: humanize(id),
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

/**
 * The name an evidence slot takes when no host lab assigns one.
 *
 * Stable and derived from the slot, so every reference to that slot resolves to the same name and
 * the citations between steps still line up. Prefixed so it can never be mistaken for, or collide
 * with, an identifier a lab composition assigned.
 */
export const derivedIdentifier = (slot: string): string =>
  `standalone-${slot.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()}`;

const substitute = (value: unknown, values: ReadonlyMap<string, string | number>): unknown => {
  if (typeof value === "string") {
    const whole = value.match(new RegExp(`^${CONFIGURATION_SLOT.source}$`));
    // A whole-string slot takes the value's own type, exactly as the composition compiler binds it:
    // that is what lets a slot carry a number into a parameter the runtime reads as a number.
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

/**
 * Bind a teacher's supplied configuration into a standalone technique.
 *
 * Refuses rather than guesses: a classroom quantity that is missing, non-numeric where the binding
 * is numeric, or blank where it is text, stops the activity starting and says which field it was.
 * Internal identifiers are bound from their derived names and are not asked for.
 */
export const applyTechniqueConfiguration = <T extends TechniqueDefinition | LabDefinition>(
  definition: T,
  supplied: Readonly<Record<string, string>>,
): T => {
  const values = new Map<string, string | number>();
  const missing: string[] = [];

  for (const slot of configurationSlots(definition)) {
    if (slot.kind === "host-composition-only") continue;
    if (slot.kind === "internal-identifier") {
      values.set(slot.id, slot.derivedValue!);
      continue;
    }
    const raw = supplied[slot.id]?.trim() ?? "";
    if (!raw) {
      missing.push(slot.label);
      continue;
    }
    if (slot.mode === "numeric") {
      const numeric = Number(raw);
      if (!Number.isFinite(numeric)) {
        throw new TechniqueConfigurationError(`${slot.label} must be a number.`);
      }
      values.set(slot.id, numeric);
      continue;
    }
    values.set(slot.id, raw);
  }

  if (missing.length > 0) {
    throw new TechniqueConfigurationError(
      `Supply the approved classroom ${missing.length === 1 ? "value" : "values"}: ${missing.join(", ")}.`,
    );
  }

  return substitute(definition, values) as T;
};
