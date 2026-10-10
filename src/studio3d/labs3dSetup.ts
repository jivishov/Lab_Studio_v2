import type { BundledLabSourceDefinition } from "../domain/types";

/**
 * A 3D lab's teacher values (D8, decided 2026-10-10; `proposals/D8_EXPERIMENT_ASSEMBLY.md`, "E0 design", §4).
 * `public/labs-3d/index.json` (written by `scripts/practice3d/build.mjs`) names each setup field and where
 * its value goes: a part's configuration slot, or a bench item's starting volume. The source carries the
 * defaults; the setup page's values replace them on a copy before compiling. 3D only: the 2D lab setups
 * (`src/data/labSetup.ts`) are not used.
 */
export type Lab3DSetupTarget = ({ instanceId: string; slotId: string } | { itemId: string; contents: "volumeMl" }) & {
  /** Added to a number field's value: Measure Liquid Volume's pour stops 1 mL under the sample's line. */
  offset?: number;
};

export interface Lab3DSetupField {
  id: string;
  label: string;
  unit?: string;
  kind: "number" | "text";
  defaultValue: number | string;
  min?: number;
  max?: number;
  help?: string;
  targets: Lab3DSetupTarget[];
}

/** The sum of `fields` plus `plus` may not exceed `atMost`: a number, or another field's value. */
export interface Lab3DRule {
  fields: string[];
  plus: number;
  atMost: number | string;
  message: string;
}

export interface Lab3DPart {
  instanceId: string;
  techniqueId: string;
  /** The part's short title (you, 2026-10-10: "Use short part title"), on the step card and the intro. */
  title: string;
  /** The composed technique's own title. */
  techniqueTitle?: string;
}

export interface Lab3DSummary {
  id: string;
  title: string;
  description: string;
  file: string;
  parts: Lab3DPart[];
  setup: Lab3DSetupField[];
  rules: Lab3DRule[];
}

const formatNumber = (value: number, unit?: string): string => `${value}${unit ? ` ${unit}` : ""}`;

/** A value as a target takes it: plus its offset, without float noise (20.3 - 1 is 19.299999999999997). */
const targetValue = (value: number | string, target: Lab3DSetupTarget): number | string =>
  target.offset && typeof value === "number" ? Math.round((value + target.offset) * 1e6) / 1e6 : value;

/** The page's values as the lab takes them; throws with a message for the teacher naming the field. */
export const parseLab3DValues = (summary: Lab3DSummary, values: Record<string, string>): Record<string, number | string> => {
  const parsed: Record<string, number | string> = {};
  for (const field of summary.setup) {
    const raw = (values[field.id] ?? "").trim();
    if (!raw) throw new Error(`Enter ${field.label.toLowerCase()}.`);
    if (field.kind === "text") { parsed[field.id] = raw; continue; }
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error(`${field.label} must be a number.`);
    if (field.min !== undefined && value < field.min) throw new Error(`${field.label} must be at least ${formatNumber(field.min, field.unit)}.`);
    if (field.max !== undefined && value > field.max) throw new Error(`${field.label} must be at most ${formatNumber(field.max, field.unit)}.`);
    parsed[field.id] = value;
  }
  for (const rule of summary.rules) {
    const total = rule.fields.reduce((sum, id) => sum + Number(parsed[id]), rule.plus);
    const limit = typeof rule.atMost === "number" ? rule.atMost : Number(parsed[rule.atMost]);
    if (total > limit + 1e-9) throw new Error(rule.message);
  }
  return parsed;
};

/** A copy of the source with the teacher's values in place of the defaults. */
export const applyLab3DSetup = <T extends BundledLabSourceDefinition>(source: T, summary: Lab3DSummary, values: Record<string, string>): T => {
  const parsed = parseLab3DValues(summary, values);
  const configured = structuredClone(source);
  for (const field of summary.setup) {
    for (const target of field.targets) {
      if ("slotId" in target) {
        const instance = configured.techniqueInstances?.find((entry) => entry.instanceId === target.instanceId);
        if (!instance) throw new Error(`The lab has no part "${target.instanceId}".`);
        instance.bindings.configuration[target.slotId] = targetValue(parsed[field.id], target);
      } else {
        const item = configured.initialState?.equipment.find((entry) => entry.id === target.itemId);
        if (!item) throw new Error(`The lab has no item "${target.itemId}".`);
        item.contents = { ...item.contents, volumeMl: Number(targetValue(parsed[field.id], target)) };
      }
    }
  }
  return configured;
};
