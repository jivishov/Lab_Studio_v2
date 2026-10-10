import { assessBundledTechniqueCatalogPolicy, compileBundledLabCompositionWithPolicy } from "../data/bundledCatalogPolicyBoundary";
import { loadBundledTechnique } from "../data/loadBundledTechniques";
import { isCompositionSource } from "../domain/compositionValidation";
import type { LabCompositionSourceDefinition, LabDefinition, TechniqueDefinition } from "../domain/types";
import { validateBundledLabSource, validateTechniqueDefinition } from "../domain/validation";
import { applyLab3DSetup, type Lab3DSummary } from "./labs3dSetup";

export type { Lab3DSummary } from "./labs3dSetup";

/**
 * The 3D experiments (D8, decided 2026-10-10; `proposals/D8_EXPERIMENT_ASSEMBLY.md`, "E0 design" §3), as
 * `practice.ts` is for the practice versions.
 *
 * A 3D lab in `public/labs-3d/` composes twins (the practice versions' composable copies, listed in
 * `public/techniques-3d/twins.json`) and Pack 1 originals from `public/techniques/`. It compiles through the
 * bundled loader's own seam, `compileBundledLabCompositionWithPolicy`, with a resolver that takes a listed
 * twin from `techniques-3d/` and anything else from the bundled catalogue. The 2D labs are not read.
 */
interface TwinSummary {
  id: string;
  file: string;
  practiceId: string;
  basedOn: string;
}

/** Where a step of a compiled lab sits among the lab's parts, for the step card ("Part 2 of 4 · …"). */
export interface Lab3DPartLabel {
  index: number;
  count: number;
  title: string;
}

export interface Loaded3DLab {
  summary: Lab3DSummary;
  /** The compiled lab Player3D plays. */
  lab: LabDefinition;
  /**
   * The compiled lab with each action's parameters as its technique authored them, before configuration:
   * a compiled lab keeps no `{{config.*}}`, so this is what tells the provenance chips a teacher's value (§6).
   */
  authored: LabDefinition;
  /** Each compiled node's part. */
  parts: Map<string, Lab3DPartLabel>;
}

const publicPath = (folder: string, file: string): string => {
  const base = import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  return `${base}${folder}/${file}`;
};

const fetchJson = async (folder: string, file: string): Promise<unknown> => {
  const response = await fetch(publicPath(folder, file));
  if (!response.ok) throw new Error(`Unable to load ${publicPath(folder, file)}: ${response.status}`);
  return response.json();
};

/** A list that cannot be read rejects and is not kept, so the next call asks for it again. */
const cachedList = <T>(load: () => Promise<T>): (() => Promise<T>) => {
  let cached: Promise<T> | undefined;
  return () => {
    cached ??= load().catch((error: unknown) => {
      cached = undefined;
      throw error;
    });
    return cached;
  };
};

const isSummary = (entry: unknown): entry is Lab3DSummary => {
  const e = entry as Partial<Lab3DSummary> | null;
  return Boolean(e && typeof e.id === "string" && typeof e.title === "string" && typeof e.file === "string"
    && Array.isArray(e.parts) && Array.isArray(e.setup) && Array.isArray(e.rules));
};

/** The 3D labs, in the order the switcher's Experiments group shows them. */
export const loadLab3DSummaries = cachedList(async () => {
  const entries = await fetchJson("labs-3d", "index.json");
  return Array.isArray(entries) ? entries.filter(isSummary).map((e) => ({ ...e, description: e.description ?? "" })) : [];
});

const loadTwinSummaries = cachedList(async () => {
  const entries = await fetchJson("techniques-3d", "twins.json");
  return Array.isArray(entries) ? (entries as TwinSummary[]).filter((e) => typeof e?.id === "string" && typeof e.file === "string") : [];
});

const twinCache = new Map<string, Promise<TechniqueDefinition>>();

/** A twin, checked as a practice version is: validation, then the bundled catalogue policy. */
const loadTwin = (twin: TwinSummary): Promise<TechniqueDefinition> => {
  const cached = twinCache.get(twin.id);
  if (cached) return cached;
  const load = (async () => {
    const raw = await fetchJson("techniques-3d", twin.file);
    const validation = validateTechniqueDefinition(raw);
    if (!validation.ok || !validation.value) throw new Error(validation.errors.join("\n"));
    if (validation.value.id !== twin.id) throw new Error(`Twin id "${validation.value.id}" does not match its list id "${twin.id}".`);
    await assessBundledTechniqueCatalogPolicy("public-bundle", `public/techniques-3d/${twin.file}`, validation.value);
    return validation.value;
  })();
  twinCache.set(twin.id, load);
  load.catch(() => { if (twinCache.get(twin.id) === load) twinCache.delete(twin.id); });
  return load;
};

/** The 3D resolver: a listed twin from `techniques-3d/`, anything else from `techniques/`. */
export const resolve3DTechnique = async (id: string): Promise<TechniqueDefinition> => {
  const twin = (await loadTwinSummaries()).find((entry) => entry.id === id);
  return twin ? loadTwin(twin) : loadBundledTechnique(id);
};

export const lab3DSummary = async (id: string): Promise<Lab3DSummary | undefined> =>
  (await loadLab3DSummaries()).find((entry) => entry.id === id);

/** The source as written, with the defaults the setup page offers. */
export const loadLab3DSource = async (summary: Lab3DSummary): Promise<LabCompositionSourceDefinition> => {
  const raw = await fetchJson("labs-3d", summary.file);
  const validation = validateBundledLabSource(raw);
  if (!validation.ok || !validation.value) throw new Error(validation.errors.join("\n"));
  if (validation.value.id !== summary.id) throw new Error(`3D lab id "${validation.value.id}" does not match its list id "${summary.id}".`);
  if (!isCompositionSource(validation.value)) throw new Error(`3D lab "${summary.id}" composes no techniques.`);
  return validation.value;
};

/** Compiled actions with the parameters their techniques authored, matched through the manifest's origins. */
export const authoredLabView = (lab: LabDefinition, techniques: ReadonlyMap<string, TechniqueDefinition>): LabDefinition => {
  const byActionId = new Map((lab.compositionManifest?.origins ?? []).filter((origin) => origin.actionId).map((origin) => [origin.actionId!, origin]));
  return {
    ...lab,
    actions: lab.actions.map((action) => {
      const origin = byActionId.get(action.id);
      const authored = origin && techniques.get(origin.techniqueId)?.actions.find((entry) => entry.id === origin.sourceActionId);
      return authored ? { ...action, parameters: structuredClone(authored.parameters) } : action;
    }),
  };
};

/** Each compiled node's part, in the order the parts run. */
export const labPartLabels = (lab: LabDefinition, summary: Lab3DSummary): Map<string, Lab3DPartLabel> => {
  const labels = new Map<string, Lab3DPartLabel>();
  for (const origin of lab.compositionManifest?.origins ?? []) {
    const index = summary.parts.findIndex((part) => part.instanceId === origin.instanceId);
    if (index >= 0) labels.set(origin.nodeId, { index: index + 1, count: summary.parts.length, title: summary.parts[index].title });
  }
  return labels;
};

/**
 * A 3D lab with the teacher's values (the setup page's strings, checked by `parseLab3DValues`): the values go
 * into a copy of the source, which compiles with the policy checked on the source as written.
 */
export const loadLab3D = async (summary: Lab3DSummary, values: Record<string, string>): Promise<Loaded3DLab> => {
  const source = await loadLab3DSource(summary);
  const configured = applyLab3DSetup(source, summary, values);
  const techniques = new Map<string, TechniqueDefinition>();
  const lab = await compileBundledLabCompositionWithPolicy({
    authority: "public-bundle",
    artifact: `public/labs-3d/${summary.file}`,
    catalogSource: source,
    compilationSource: configured,
    resolveTechnique: async (id: string) => {
      const technique = await resolve3DTechnique(id);
      techniques.set(technique.id, technique);
      return structuredClone(technique);
    },
  });
  return { summary, lab, authored: authoredLabView(lab, techniques), parts: labPartLabels(lab, summary) };
};
