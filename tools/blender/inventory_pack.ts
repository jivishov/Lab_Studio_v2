/**
 * Technique-pack inventory, evaluated with the real core functions rather than by reading JSON
 * (IMPLEMENTATION_PLAN.md §9, step 1).
 *
 * Run from the repository root:
 *   node --experimental-strip-types --experimental-loader ./scripts/tsCompositionLoader.mjs \
 *     tools/blender/inventory_pack.ts [--pack 1] [--json <out.json>] [--markdown <out.md>]
 *
 * It reports, per technique in the pack (catalog order from public/techniques/index.json, in
 * fives): the resolved interaction of each action (authored or derived from its verb), both
 * configuration blockers, the configuration slots, host labs, the value source of every input
 * (plan §2.4), the equipment definitions and the semantic zones they own, and the authored visual
 * states. It then recomputes which experiments have all their techniques delivered (plan §2.7);
 * that is necessary, never sufficient.
 *
 * It reads bundled content and writes only the files it is asked to write. Nothing is simulated.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hostLabsForTechnique } from "../../src/data/techniqueHosts.ts";
import {
  compositionTechniqueConfigurationBlocker,
  configurationSlots,
  standaloneTechniqueConfigurationBlocker,
} from "../../src/data/techniqueConfiguration.ts";
import { resolveActionInteraction } from "../../src/domain/interactions.ts";
import { v1InteractionZones } from "../../src/domain/interactionZones.ts";
import type { ActionDefinition, EquipmentInstance, LabDefinition, TechniqueDefinition } from "../../src/domain/types.ts";
import { validateTechniqueDefinition } from "../../src/domain/validation.ts";
import { equipmentById } from "../../src/equipment/catalog.ts";
import { actionInputField } from "../../src/runtime/actionInputs.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PACK_SIZE = 5;

/** Labs with a custom route in `src/App.tsx` (`customPlayerRoutes`); never flattened (plan E4). */
const CUSTOM_ROUTE_LABS = new Set(["acid-base-titration-curves", "green-chemistry-mixture-purification"]);

const readJson = <T>(relativePath: string): T =>
  JSON.parse(readFileSync(join(root, relativePath), "utf8")) as T;

const argValue = (flag: string): string | undefined => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

interface IndexEntry { id: string; file?: string }

type ValueSource =
  | "teacher-configuration"
  | "learner-observation"
  | "runtime-state"
  | "none";

interface ActionReport {
  actionId: string;
  verb: string;
  interaction: string | null;
  interactionOrigin: "authored" | "derived-from-verb" | "none";
  sourceDefinitionId?: string;
  targetDefinitionId?: string;
  snapZoneId?: string;
  stationId?: string;
  input?: { label: string; role: string; mode: string; unit?: string };
  valueSource: ValueSource;
  volumeContract?: string;
  massContract?: string;
}

const valueSourceFor = (action: ActionDefinition): ValueSource => {
  const field = actionInputField(action);
  if (field) return field.role === "teacherConfiguration" ? "teacher-configuration" : "learner-observation";
  // No input field: whatever the action records comes from runtime state or configured parameters.
  return action.volume || action.mass ? "runtime-state" : "none";
};

const actionReport = (action: ActionDefinition): ActionReport => {
  const interaction = resolveActionInteraction(action);
  const field = actionInputField(action);
  return {
    actionId: action.id,
    verb: action.verb,
    interaction: interaction?.type ?? null,
    interactionOrigin: action.interaction ? "authored" : interaction ? "derived-from-verb" : "none",
    ...(interaction?.sourceDefinitionId ? { sourceDefinitionId: interaction.sourceDefinitionId } : {}),
    ...(interaction?.targetDefinitionId ? { targetDefinitionId: interaction.targetDefinitionId } : {}),
    ...(interaction?.snapZoneId ? { snapZoneId: interaction.snapZoneId } : {}),
    ...(interaction?.stationId ? { stationId: interaction.stationId } : {}),
    ...(field
      ? { input: { label: field.label, role: field.role, mode: field.mode, ...(field.unit ? { unit: field.unit } : {}) } }
      : {}),
    valueSource: valueSourceFor(action),
    ...(action.volume ? { volumeContract: action.volume.source } : {}),
    ...(action.mass ? { massContract: action.mass.source } : {}),
  };
};

const definitionIdsUsed = (technique: TechniqueDefinition): string[] => {
  const ids = new Set<string>(technique.requiredEquipment);
  technique.initialState.equipment.forEach((item) => ids.add(item.definitionId));
  for (const action of technique.actions) {
    const interaction = resolveActionInteraction(action);
    if (interaction?.sourceDefinitionId) ids.add(interaction.sourceDefinitionId);
    if (interaction?.targetDefinitionId) ids.add(interaction.targetDefinitionId);
    Object.values(action.equipmentRoleBindings ?? {}).forEach((id) => ids.add(id));
  }
  return [...ids].sort();
};

const authoredVisualStates = (technique: TechniqueDefinition): string[] => {
  const states = new Set<string>();
  const fromContents = (item: EquipmentInstance) => {
    const state = (item.contents as { visualState?: string }).visualState;
    if (state) states.add(state);
  };
  technique.initialState.equipment.forEach(fromContents);
  technique.actions.forEach((action) => {
    if (action.materialTransition?.visualState) states.add(action.materialTransition.visualState);
  });
  return [...states].sort();
};

const loadTechnique = (entry: IndexEntry): TechniqueDefinition => {
  const raw = readJson<unknown>(`public/techniques/${entry.file ?? `${entry.id}.json`}`);
  const validation = validateTechniqueDefinition(raw);
  if (!validation.ok || !validation.value) {
    throw new Error(`Technique ${entry.id} fails validation:\n${validation.errors.join("\n")}`);
  }
  return validation.value;
};

const pack = Number(argValue("--pack") ?? "1");
if (!Number.isInteger(pack) || pack < 1) throw new Error("--pack must be a positive integer.");

const techniqueIndex = readJson<IndexEntry[]>("public/techniques/index.json");
const packOf = new Map(techniqueIndex.map((entry, index) => [entry.id, Math.floor(index / PACK_SIZE) + 1]));
const packEntries = techniqueIndex.slice((pack - 1) * PACK_SIZE, pack * PACK_SIZE);
const visualRegistry = readJson<{ states: Array<{ id: string; disposition: string; quantitativeClaim?: string }> }>(
  "src/equipment/visualStateRegistry.json",
);
const visualStateById = new Map(visualRegistry.states.map((state) => [state.id, state]));

const techniques = packEntries.map((entry) => {
  const technique = loadTechnique(entry);
  const slots = configurationSlots(technique);
  const slotCount = (kind: string) => slots.filter((slot) => slot.kind === kind).length;
  const actionsById = new Map(technique.actions.map((action) => [action.id, action]));
  const steps = technique.process.nodes.map((node) => ({
    nodeId: node.id,
    type: node.type,
    ...(node.actionId && actionsById.has(node.actionId) ? { action: actionReport(actionsById.get(node.actionId)!) } : {}),
  }));
  const interactionCounts: Record<string, number> = {};
  for (const step of steps) {
    const type = step.action?.interaction;
    if (type) interactionCounts[type] = (interactionCounts[type] ?? 0) + 1;
  }
  return {
    id: technique.id,
    title: technique.title,
    catalogPosition: techniqueIndex.findIndex((item) => item.id === technique.id) + 1,
    steps: steps.length,
    nodeTypes: [...new Set(technique.process.nodes.map((node) => node.type))].sort(),
    interactionCounts,
    standaloneBlocker: standaloneTechniqueConfigurationBlocker(technique),
    compositionBlocker: compositionTechniqueConfigurationBlocker(technique),
    hostLabs: hostLabsForTechnique(technique.id).map((host) => host.id),
    configurationSlots: {
      classroomQuantity: slotCount("classroom-quantity"),
      internalIdentifier: slotCount("internal-identifier"),
      hostCompositionOnly: slotCount("host-composition-only"),
      ids: slots.map((slot) => `${slot.id} (${slot.kind})`),
    },
    hasCompositionContract: technique.composition !== undefined,
    equipmentDefinitions: definitionIdsUsed(technique),
    visualStates: authoredVisualStates(technique).map((id) => ({
      id,
      disposition: visualStateById.get(id)?.disposition ?? "UNREGISTERED",
      quantitativeClaim: visualStateById.get(id)?.quantitativeClaim ?? null,
    })),
    stepDetail: steps,
  };
});

const packDefinitionIds = [...new Set(techniques.flatMap((technique) => technique.equipmentDefinitions))].sort();
const equipment = packDefinitionIds.map((definitionId) => {
  const definition = equipmentById.get(definitionId);
  return {
    definitionId,
    inCatalog: definition !== undefined,
    label: definition?.label ?? null,
    category: definition?.category ?? null,
    capacity: definition ? `${definition.capacity.amount} ${definition.capacity.unit}` : null,
    precision: definition ? `${definition.precision.amount} ${definition.precision.unit}` : null,
    catalogSnapZones: definition?.snapZones.map((zone) => zone.id) ?? [],
    semanticZonesOwned: v1InteractionZones
      .filter((zone) => zone.ownerDefinitionId === definitionId)
      .map((zone) => ({ id: zone.id, relationType: zone.relationType, accepts: zone.accepts, maxOccupancy: zone.maxOccupancy })),
    usedBy: techniques.filter((technique) => technique.equipmentDefinitions.includes(definitionId)).map((technique) => technique.id),
  };
});

const labIndex = readJson<IndexEntry[]>("public/labs/index.json");
const experiments = labIndex.map((entry) => {
  const lab = readJson<LabDefinition>(`public/labs/${entry.file ?? `${entry.id}.json`}`);
  const techniqueIds = [...new Set((lab.techniqueInstances ?? []).map((instance) => instance.techniqueId))];
  const unknown = techniqueIds.filter((id) => !packOf.has(id));
  const packsNeeded = techniqueIds.map((id) => packOf.get(id) ?? Number.POSITIVE_INFINITY);
  const unlockedAtPack = techniqueIds.length === 0 || unknown.length > 0 ? null : Math.max(...packsNeeded);
  return {
    id: lab.id,
    composed: techniqueIds.length > 0,
    techniques: techniqueIds.length,
    allTechniquesDeliveredAtPack: unlockedAtPack,
    notInTechniqueCatalog: unknown,
    customRoute: CUSTOM_ROUTE_LABS.has(lab.id),
  };
});

const report = {
  schema: "lab-studio-3d/pack-inventory@1",
  pack,
  techniqueCatalogSize: techniqueIndex.length,
  techniques,
  equipment,
  interactionHandlersNeeded: [...new Set(techniques.flatMap((technique) => Object.keys(technique.interactionCounts)))].sort(),
  experimentsWithAllTechniquesDelivered: experiments
    .filter((experiment) => experiment.allTechniquesDeliveredAtPack !== null && experiment.allTechniquesDeliveredAtPack <= pack)
    .map((experiment) => experiment.id),
  experiments,
};

const markdown = (): string => {
  const lines: string[] = [
    `# Pack ${pack} inventory (evaluated)`,
    "",
    "Generated by `tools/blender/inventory_pack.ts` from bundled content with the real core functions.",
    "Delivered techniques are necessary, not sufficient, for an experiment (plan §2.7).",
    "",
    "| # | Technique | Steps | Interactions | Standalone | Composition | Slots (quantity / identifier / host-only) | Host labs |",
    "|---|---|---|---|---|---|---|---|",
  ];
  for (const technique of techniques) {
    const interactions = Object.entries(technique.interactionCounts).map(([type, count]) => `${type} ×${count}`).join(", ");
    lines.push(
      `| ${technique.catalogPosition} | \`${technique.id}\` | ${technique.steps} | ${interactions || "—"} | `
      + `${technique.standaloneBlocker ? "**blocked**" : "allowed"} | ${technique.compositionBlocker ? "**blocked**" : "allowed"} | `
      + `${technique.configurationSlots.classroomQuantity} / ${technique.configurationSlots.internalIdentifier} / ${technique.configurationSlots.hostCompositionOnly} | `
      + `${technique.hostLabs.join(", ") || "—"} |`,
    );
  }
  lines.push("", "## Blocker messages", "");
  for (const technique of techniques) {
    if (technique.standaloneBlocker) lines.push(`- \`${technique.id}\` standalone: ${technique.standaloneBlocker}`);
    if (technique.compositionBlocker) lines.push(`- \`${technique.id}\` composition: ${technique.compositionBlocker}`);
  }
  lines.push("", "## Value sources (plan §2.4)", "", "| Technique | Action | Interaction | Input label | Source |", "|---|---|---|---|---|");
  for (const technique of techniques) {
    for (const step of technique.stepDetail) {
      if (!step.action || step.action.valueSource === "none") continue;
      lines.push(`| \`${technique.id}\` | \`${step.action.actionId}\` | ${step.action.interaction ?? "—"} | ${step.action.input?.label ?? "—"} | ${step.action.valueSource} |`);
    }
  }
  lines.push("", `## Equipment definitions (${equipment.length})`, "", "| Definition | Capacity | Precision | Semantic zones owned | Used by |", "|---|---|---|---|---|");
  for (const item of equipment) {
    const zones = item.semanticZonesOwned.map((zone) => `\`${zone.id}\` (${zone.relationType})`).join(", ");
    lines.push(`| \`${item.definitionId}\`${item.inCatalog ? "" : " **not in catalog**"} | ${item.capacity ?? "—"} | ${item.precision ?? "—"} | ${zones || "—"} | ${item.usedBy.join(", ")} |`);
  }
  lines.push("", `## Interaction handlers needed (${report.interactionHandlersNeeded.length})`, "", report.interactionHandlersNeeded.map((type) => `\`${type}\``).join(", "));
  lines.push("", "## Authored visual states", "");
  for (const technique of techniques) {
    const states = technique.visualStates.map((state) => `\`${state.id}\` (${state.disposition})`).join(", ");
    lines.push(`- \`${technique.id}\`: ${states || "none authored"}`);
  }
  lines.push("", "## Experiments with every technique delivered by this pack", "");
  lines.push(report.experimentsWithAllTechniquesDelivered.length ? report.experimentsWithAllTechniquesDelivered.map((id) => `- \`${id}\``).join("\n") : "None.");
  lines.push("", "## Experiments by the pack that delivers their last technique", "", "| Experiment | Techniques | Pack | Custom route | Not in technique catalog |", "|---|---|---|---|---|");
  for (const experiment of [...experiments].sort((a, b) => (a.allTechniquesDeliveredAtPack ?? 99) - (b.allTechniquesDeliveredAtPack ?? 99))) {
    lines.push(`| \`${experiment.id}\` | ${experiment.techniques} | ${experiment.allTechniquesDeliveredAtPack ?? "—"} | ${experiment.customRoute ? "yes" : ""} | ${experiment.notInTechniqueCatalog.join(", ")} |`);
  }
  return `${lines.join("\n")}\n`;
};

const jsonOut = argValue("--json");
const markdownOut = argValue("--markdown");
if (jsonOut) writeFileSync(jsonOut, `${JSON.stringify(report, null, 2)}\n`);
if (markdownOut) writeFileSync(markdownOut, markdown());
if (!jsonOut && !markdownOut) process.stdout.write(markdown());
