import type { ActionDefinition, RuntimeActionRequest } from "../domain/types";

export type ActionInputRole = "studentResponse" | "teacherConfiguration";
export type ActionInputMode = "numeric" | "text" | "choice";

export interface ActionInputField {
  key: string;
  label: string;
  mode: ActionInputMode;
  options: string[];
  required: boolean;
  role: ActionInputRole;
  min?: number;
  max?: number;
  minExclusive: boolean;
  maxExclusive: boolean;
  step?: number;
  unit?: string;
}

export interface ActionInputResolution {
  field?: ActionInputField;
  valid: boolean;
  error?: string;
  note?: string;
  value?: number;
}

const stringParameter = (action: ActionDefinition, key: string): string | undefined => {
  const value = action.parameters[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
};

const numberParameter = (action: ActionDefinition, key: string): number | undefined => {
  const value = action.parameters[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

const inputModeFor = (action: ActionDefinition): ActionInputMode | undefined => {
  const mode = stringParameter(action, "inputMode");
  if (mode === "numeric" || mode === "text" || mode === "choice") return mode;
  // Source-authored inquiry steps use this marker for learner-entered notebook evidence.
  if (action.parameters.requiresStudentNote === true) return "text";
  if (action.parameters.requireStudentValue === true) return "numeric";
  if (action.parameters.configurationRequired === true && action.parameters.unlocked === false) {
    return "choice";
  }
  return undefined;
};

const inputRoleFor = (action: ActionDefinition): ActionInputRole => {
  const role = stringParameter(action, "inputRole");
  if (role === "teacherConfiguration" || role === "studentResponse") return role;
  if (action.parameters.requiresStudentNote === true) return "studentResponse";
  if (action.parameters.requireStudentValue === true || action.parameters.studentResponseRequired === true) {
    return "studentResponse";
  }
  const label = stringParameter(action, "inputLabel")?.toLowerCase() ?? "";
  if (
    action.parameters.configurationRequired === true ||
    label.includes("teacher") ||
    label.includes("instructor")
  ) {
    return "teacherConfiguration";
  }
  return "studentResponse";
};

/**
 * Resolve a configuration slot named inside a label sentence.
 *
 * The composition compiler binds a parameter only when its whole value is `{{config.slot}}`. That
 * exact match is deliberate: it is what lets a slot carry a number or a boolean, and what keeps
 * identity scoping from rewriting a reference it should not touch. The cost is that a slot named
 * inside a longer sentence survives compilation untouched, and the learner is shown the braces.
 *
 * An action that names a slot in its label also carries that slot as one of its own parameters —
 * that is what the runtime gates on — so the approved value is already here. Substitute it when it
 * resolves to a printable scalar, and drop the fragment when it does not, because showing template
 * syntax to a learner is worse than showing the sentence without it. Nothing is invented: an
 * unresolvable slot produces no text at all.
 */
/*
 * Two matchers, deliberately. A `/g` regular expression carries `lastIndex` between calls, and
 * `.test()` advances it, so a single shared instance used for both detection and replacement makes
 * the resolver answer differently on identical input: the call after one that left `lastIndex` past
 * a placeholder starts searching from that offset, misses the placeholder, and returns the raw
 * `{{config.…}}` template to the learner. `String.replace` does not reset `lastIndex` afterwards
 * either, so the fallback probe inside the replacer leaks its position into the next entry test.
 *
 * `CONFIGURATION_SLOT` is stateless and is the only thing ever asked a yes/no question.
 * `configurationMatcher()` hands out a fresh `/g` instance per replacement, so no call can observe
 * where another one stopped.
 */
const CONFIGURATION_SLOT = /\{\{config\.([A-Za-z0-9_-]+)\}\}/;
const configurationMatcher = (): RegExp => /\{\{config\.([A-Za-z0-9_-]+)\}\}/g;

const resolveLabelConfiguration = (action: ActionDefinition, label: string): string => {
  if (!CONFIGURATION_SLOT.test(label)) return label;
  const resolved = label.replace(configurationMatcher(), (_match, slot: string) => {
    const value = action.parameters[slot];
    if (typeof value === "string") {
      return CONFIGURATION_SLOT.test(value) ? "" : value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "boolean") return String(value);
    return "";
  });
  // An emptied trailing fragment leaves "…criterion: " behind; tidy the separator rather than the
  // sentence, so a label that resolved normally is untouched.
  return resolved.replace(/[\s:;,\u2014-]+$/, "").trim();
};

export const actionInputField = (
  action: ActionDefinition | undefined,
): ActionInputField | undefined => {
  if (!action) return undefined;
  const mode = inputModeFor(action);
  if (!mode) return undefined;
  const options = action.choiceObservation
    ? action.choiceObservation.options.map((option) => option.label)
    : Array.isArray(action.parameters.inputOptions)
    ? action.parameters.inputOptions.filter((option): option is string => typeof option === "string")
    : mode === "choice" && action.parameters.configurationRequired === true
      ? ["Teacher approved"]
      : [];
  return {
    key: stringParameter(action, "inputKey") ?? action.id,
    label: resolveLabelConfiguration(
      action,
      stringParameter(action, "inputLabel") ??
        (inputRoleFor(action) === "teacherConfiguration" ? "Teacher configuration" : action.label),
    ),
    mode,
    options,
    required: action.parameters.requiresStudentNote === true || action.parameters.inputRequired !== false,
    role: inputRoleFor(action),
    min: numberParameter(action, "inputMin"),
    max: numberParameter(action, "inputMax"),
    minExclusive: action.parameters.inputMinExclusive === true,
    maxExclusive: action.parameters.inputMaxExclusive === true,
    step: numberParameter(action, "inputStep"),
    unit: stringParameter(action, "unit"),
  };
};

export const resolveActionInput = (
  action: ActionDefinition | undefined,
  rawValue: string | undefined,
): ActionInputResolution => {
  const field = actionInputField(action);
  if (!field) return { valid: true };
  const normalized = rawValue?.trim() ?? "";
  if (!normalized) {
    return field.required
      ? { field, valid: false, error: `${field.label} is required.` }
      : { field, valid: true };
  }
  if (field.mode === "choice" && field.options.length > 0 && !field.options.includes(normalized)) {
    return { field, valid: false, error: `Choose one of the configured options for ${field.label}.` };
  }
  if (field.mode !== "numeric") return { field, valid: true, note: normalized };

  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    return { field, valid: false, error: `${field.label} must be a number.` };
  }
  if (field.min !== undefined && (field.minExclusive ? value <= field.min : value < field.min)) {
    return {
      field,
      valid: false,
      error: `${field.label} must be ${field.minExclusive ? "greater than" : "at least"} ${field.min}.`,
    };
  }
  if (field.max !== undefined && (field.maxExclusive ? value >= field.max : value > field.max)) {
    return {
      field,
      valid: false,
      error: `${field.label} must be ${field.maxExclusive ? "less than" : "at most"} ${field.max}.`,
    };
  }
  return { field, valid: true, value };
};

export const actionInputRequestError = (
  action: ActionDefinition,
  request: RuntimeActionRequest,
): string | undefined => {
  const field = actionInputField(action);
  if (!field || !field.required) return undefined;
  if (action.sourceInventory && typeof action.parameters.configuredValue === "number") return undefined;
  // Configuration measurements have a dedicated reducer path that either consumes the session
  // value or names the missing classroom quantity. Let that more specific gate own its feedback.
  if (typeof action.parameters.configurationQuantity === "string") return undefined;
  const rawValue = field.mode === "numeric"
    ? typeof request.value === "number" ? String(request.value) : undefined
    : request.note;
  const resolution = resolveActionInput(action, rawValue);
  return resolution.valid ? undefined : resolution.error;
};
