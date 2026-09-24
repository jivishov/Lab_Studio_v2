import { useEffect, useState } from "react";
import { loadBundledTechnique, loadBundledTechniqueSummaries } from "../../data/loadBundledTechniques";
import { configurationSlots } from "../../data/techniqueConfiguration";
import type { TechniqueDefinition } from "../../domain/types";
import { workflowConfigurationBlocker, workflowHostLabs, workflowNeedsConfiguration } from "../../studio/workflowConfiguration";
import { equipment3dEntry, equipment3dReadiness } from "../equipment3d/readiness";
import { packNumber } from "../packs";

/**
 * Published techniques as the library and the Open dialog show them (handoff §4.3, §4.8). A
 * status comes from the core's own checks, in this order: a composition blocker makes it
 * host-bound; a missing model makes it not yet in 3D; unresolved slots make it need setup.
 */
export type TechniqueStatus = "ready" | "setup" | "host" | "no3d";

export const TECHNIQUE_STATUS: Record<TechniqueStatus, { label: string; tone: "ok" | "warn" | "neutral"; icon: string }> = {
  ready: { label: "3D-ready", tone: "ok", icon: "check" },
  setup: { label: "Needs setup", tone: "warn", icon: "clip" },
  host: { label: "Host-bound", tone: "warn", icon: "lock" },
  no3d: { label: "Not yet in 3D", tone: "neutral", icon: "cube" },
};

export interface CatalogueTechnique {
  id: string;
  title: string;
  description: string;
  pack?: number;
  definition?: TechniqueDefinition;
  status?: TechniqueStatus;
  blocker?: string;
  hosts: Array<{ id: string; title: string; href: string }>;
  missingModels: string[];
  /** The first model in the technique, for small thumbnails. */
  thumbnailId?: string;
  /** Up to three modelled definitions, composed into the card image (§4.3 composite thumbnail). */
  compositeIds: string[];
  error?: string;
}

export const techniqueDefinitionIds = (technique: TechniqueDefinition): string[] =>
  [...new Set([...technique.requiredEquipment, ...technique.initialState.equipment.map((e) => e.definitionId)])];

/**
 * Whether a teacher has something to set: an unresolved classroom value. Internal record names are
 * derived, never asked for, as the 2D setup treats them (identifier-only techniques start directly).
 */
export const needsTeacherSetup = (technique: TechniqueDefinition): boolean =>
  workflowNeedsConfiguration(technique) && configurationSlots(technique).some((slot) => slot.kind === "classroom-quantity");

export const describeTechnique = (technique: TechniqueDefinition): Pick<CatalogueTechnique, "status" | "blocker" | "hosts" | "missingModels" | "thumbnailId" | "compositeIds"> => {
  const blocker = workflowConfigurationBlocker(technique);
  const readiness = equipment3dReadiness(techniqueDefinitionIds(technique));
  const status: TechniqueStatus = blocker ? "host" : !readiness.ready ? "no3d" : needsTeacherSetup(technique) ? "setup" : "ready";
  return {
    status,
    ...(blocker ? { blocker } : {}),
    hosts: workflowHostLabs(technique).map((host) => ({ id: host.id, title: host.title, href: host.href })),
    missingModels: readiness.missing,
    thumbnailId: technique.initialState.equipment[0]?.definitionId ?? technique.requiredEquipment[0],
    compositeIds: techniqueDefinitionIds(technique).filter((id) => equipment3dEntry(id)).slice(0, 3),
  };
};

let catalogue: Promise<CatalogueTechnique[]> | undefined;

const loadCatalogue = (): Promise<CatalogueTechnique[]> => {
  catalogue ??= loadBundledTechniqueSummaries().then(async (summaries) => {
    const ids = summaries.map((s) => s.id);
    return Promise.all(summaries.map(async (summary): Promise<CatalogueTechnique> => {
      const base = { id: summary.id, title: summary.title, description: summary.description, pack: packNumber(ids, summary.id), hosts: [], missingModels: [], compositeIds: [] };
      try {
        const definition = await loadBundledTechnique(summary.id);
        return { ...base, definition, ...describeTechnique(definition) };
      } catch (error) {
        return { ...base, error: error instanceof Error ? error.message : String(error) };
      }
    }));
  });
  return catalogue;
};

export const useTechniqueCatalogue = (): { techniques: CatalogueTechnique[]; loading: boolean } => {
  const [techniques, setTechniques] = useState<CatalogueTechnique[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    loadCatalogue().then((list) => { if (active) { setTechniques(list); setLoading(false); } },
      () => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return { techniques, loading };
};
