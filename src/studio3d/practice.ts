import { loadBundledTechnique, loadBundledTechniqueSummaries } from "../data/loadBundledTechniques";
import { assessBundledTechniqueCatalogPolicy } from "../data/bundledCatalogPolicyBoundary";
import type { TechniqueDefinition } from "../domain/types";
import { validateTechniqueDefinition } from "../domain/validation";
import { packNumber } from "./packs";

/**
 * The 3D practice versions (Pack 2 decision 1A, 2026-10-05; `proposals/PACK2_ATOMIZATION.md`).
 *
 * Pack 2's techniques are composed into 2D labs and do not play alone, so each gets a 3D practice
 * version with its own id, steps, starting bench and teacher settings. They are listed in
 * `public/techniques-3d/index.json` (written by `scripts/practice3d/build.mjs`), never in
 * `public/techniques/index.json`: the 2D catalogue, its order (which counts Pack 1) and the three 2D
 * labs stay as they are. They are checked exactly as a bundled technique is: validation, then the
 * bundled catalogue policy.
 */
export interface PracticeSummary {
  id: string;
  title: string;
  description: string;
  file: string;
  pack: number;
  /** The lab-bound original this practices. Its 2D route names the labs that compose it. */
  basedOn: string;
}

export interface Simulation3D {
  id: string;
  title: string;
  description: string;
  pack: number;
}

const publicPath = (file: string): string => {
  const base = import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  return `${base}techniques-3d/${file}`;
};

const fetchJson = async (file: string): Promise<unknown> => {
  const response = await fetch(publicPath(file));
  if (!response.ok) throw new Error(`Unable to load ${publicPath(file)}: ${response.status}`);
  return response.json();
};

const isSummary = (entry: unknown): entry is PracticeSummary => {
  const e = entry as Partial<PracticeSummary> | null;
  return Boolean(e && typeof e.id === "string" && typeof e.title === "string" && typeof e.file === "string"
    && typeof e.pack === "number" && typeof e.basedOn === "string");
};

let summaries: Promise<PracticeSummary[]> | undefined;
const practiceCache = new Map<string, Promise<TechniqueDefinition>>();

/** The practice list, in the order it is shown. A list that cannot be read is an empty list. */
export const loadPracticeSummaries = (): Promise<PracticeSummary[]> => {
  summaries ??= fetchJson("index.json").then(
    (entries) => (Array.isArray(entries) ? entries.filter(isSummary).map((e) => ({ ...e, description: e.description ?? "" })) : []),
    () => [],
  );
  return summaries;
};

const loadPracticeTechnique = (summary: PracticeSummary): Promise<TechniqueDefinition> => {
  const cached = practiceCache.get(summary.id);
  if (cached) return cached;
  const load = (async () => {
    const raw = await fetchJson(summary.file);
    const validation = validateTechniqueDefinition(raw);
    if (!validation.ok || !validation.value) throw new Error(validation.errors.join("\n"));
    if (validation.value.id !== summary.id) throw new Error(`Practice technique id "${validation.value.id}" does not match its list id "${summary.id}".`);
    await assessBundledTechniqueCatalogPolicy("public-bundle", `public/techniques-3d/${summary.file}`, validation.value);
    return validation.value;
  })();
  practiceCache.set(summary.id, load);
  return load;
};

/** A technique for the 3D routes: a practice version by its id, else the bundled technique. */
export const load3DTechnique = async (id: string): Promise<TechniqueDefinition> => {
  const practice = (await loadPracticeSummaries()).find((entry) => entry.id === id);
  return practice ? loadPracticeTechnique(practice) : loadBundledTechnique(id);
};

/** The practice summary for an id, if it is one. */
export const practiceSummary = async (id: string): Promise<PracticeSummary | undefined> =>
  (await loadPracticeSummaries()).find((entry) => entry.id === id);

/**
 * The 3D simulations a learner can move between, in packs: Pack 1 is the 2D catalogue's first five
 * (catalogue order, Q4); later packs are the practice versions, in their list's order.
 */
export const loadSimulations3D = async (): Promise<Simulation3D[]> => {
  const [catalogue, practice] = await Promise.all([loadBundledTechniqueSummaries(), loadPracticeSummaries()]);
  const ids = catalogue.map((summary) => summary.id);
  return [
    ...catalogue.filter((summary) => packNumber(ids, summary.id) === 1)
      .map((summary) => ({ id: summary.id, title: summary.title, description: summary.description ?? "", pack: 1 })),
    ...practice.map((entry) => ({ id: entry.id, title: entry.title, description: entry.description, pack: entry.pack })),
  ];
};

/** The pack a 3D simulation belongs to: a practice version's own, else the catalogue's (Pack 1). */
export const pack3D = async (id: string): Promise<number | undefined> => {
  const practice = await practiceSummary(id);
  if (practice) return practice.pack;
  const catalogue = await loadBundledTechniqueSummaries();
  return packNumber(catalogue.map((summary) => summary.id), id);
};
