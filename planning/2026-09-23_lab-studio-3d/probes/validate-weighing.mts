// Narrow static validator for weighing's five-step, teacher-prepared content (one file). Not a test run.
import { readFile } from "node:fs/promises";
const root = "file:///C:/Users/EmilJivishov/Projects/Lab_studio/tmp/lab-studio-3d/";
const { validateTechniqueDefinition, validateLabDefinition } = await import(root + "src/domain/validation.ts");
const { applyTechniqueConfiguration, configurationSlots, standaloneTechniqueConfigurationBlocker, unresolvedConfigurationSlots } = await import(root + "src/data/techniqueConfiguration.ts");
const { auditStandaloneEvidence } = await import(root + "src/data/standaloneEvidenceAudit.ts");
const { atomById, deriveActionEffectContract, roleAcceptsEquipment } = await import(root + "src/domain/atomRegistry.ts");
const { resolveActionInteraction } = await import(root + "src/domain/interactions.ts");
const { appendTechniqueToDraft, createDraftFromDemo } = await import(root + "src/studio/studioState.ts");
const { configureWorkflowInDraft } = await import(root + "src/studio/workflowConfiguration.ts");
const { validateTechniqueCompositionContract: validateTechniqueComposition } = await import(root + "src/domain/compositionValidation.ts");

const raw = JSON.parse(await readFile(new URL(root + "public/techniques/weighing.json"), "utf8"));
const results: [string, boolean, string?][] = [];
const check = (name: string, ok: boolean, detail?: string) => results.push([name, ok, detail]);
const throws = (fn: () => unknown): string | undefined => { try { fn(); return undefined; } catch (e) { return e instanceof Error ? e.message : String(e); } };

const published = validateTechniqueDefinition(raw);
check("published weighing.json validates", published.ok, published.errors?.join("; "));
check("version unchanged 1.2.0", raw.metadata.version === "1.2.0");
check("five steps in order", JSON.stringify(raw.process.nodes.map((n: any) => n.actionId)) === JSON.stringify(["place-watch-glass", "zero-balance", "transfer-sodium-carbonate-to-watch-glass", "weigh-solid", "record-solid-mass"]));
check("standalone setup not blocked", standaloneTechniqueConfigurationBlocker(raw) === null, String(standaloneTechniqueConfigurationBlocker(raw)));

const slots = configurationSlots(raw);
const slot = (id: string) => slots.find((s: any) => s.id === id);
check("solidMassG: a teacher quantity with no default, in g", slot("solidMassG")?.kind === "classroom-quantity" && slot("solidMassG")?.defaultValue === undefined && slot("solidMassG")?.unit === "g");
check("supportEmptyMassG: a teacher quantity, default 30 g", slot("supportEmptyMassG")?.kind === "classroom-quantity" && slot("supportEmptyMassG")?.defaultValue === 30 && slot("supportEmptyMassG")?.unit === "g");
check("reagentStockMassG: found in the starting contents, default 10 g", slot("reagentStockMassG")?.kind === "classroom-quantity" && slot("reagentStockMassG")?.defaultValue === 10, JSON.stringify(slot("reagentStockMassG")));
check("unresolved before setup includes the stock", unresolvedConfigurationSlots(raw).includes("reagentStockMassG"));

check("setup refuses a missing amount", Boolean(throws(() => applyTechniqueConfiguration(raw, {}))), throws(() => applyTechniqueConfiguration(raw, {})));
check("setup refuses an amount above the stock", /exceeds/.test(throws(() => applyTechniqueConfiguration(raw, { solidMassG: "12" })) ?? ""), throws(() => applyTechniqueConfiguration(raw, { solidMassG: "12" })));
check("setup refuses a zero amount", /greater than zero/.test(throws(() => applyTechniqueConfiguration(raw, { solidMassG: "0" })) ?? ""));
check("setup accepts an amount within a raised stock", !throws(() => applyTechniqueConfiguration(raw, { solidMassG: "12", reagentStockMassG: "20" })));

const configured = applyTechniqueConfiguration(raw, { solidMassG: "2.037" });
const configuredResult = validateTechniqueDefinition(configured);
check("configured weighing validates", configuredResult.ok, configuredResult.errors?.join("; "));
check("nothing left unresolved after setup", unresolvedConfigurationSlots(configured).length === 0, unresolvedConfigurationSlots(configured).join(","));
const bottle = configured.initialState.equipment.find((e: any) => e.id === "reagent-bottle-1");
check("bottle starts with 10 g (number)", bottle.contents.massG === 10 && bottle.contents.solutes[0].amount === 10);
const cAction = (id: string) => configured.actions.find((a: any) => a.id === id);
check("transfer moves 2.037 g", cAction("transfer-sodium-carbonate-to-watch-glass").parameters.massG === 2.037);
check("glass empty mass 30 g on the seat step", cAction("place-watch-glass").parameters.supportEmptyMassG === 30);
check("transfer instruction names the amount", configured.process.nodes.find((n: any) => n.id === "transfer-sodium-carbonate-node").description === "Use the spatula to transfer 2.037 g of sodium carbonate from the reagent bottle onto the watch glass.");
check("standalone evidence audit clean", auditStandaloneEvidence(configured).length === 0, JSON.stringify(auditStandaloneEvidence(configured)));

for (const action of raw.actions) {
  const effect = deriveActionEffectContract(action);
  check(`${action.id}: effect contract`, effect.errors.length === 0, effect.errors.join("; "));
  if (!action.atomId) continue;
  const atom = atomById.get(action.atomId);
  const type = resolveActionInteraction(action)?.type;
  check(`${action.id}: atom ${action.atomId} verb, interaction and roles`, Boolean(atom) && atom.verb === action.verb && atom.allowedInteractionTypes.includes(type)
    && atom.requiredRoles.every((r: string) => action.equipmentRoleBindings?.[r])
    && Object.entries(action.equipmentRoleBindings ?? {}).every(([r, def]) => [...atom.requiredRoles, ...atom.optionalRoles].includes(r) && roleAcceptsEquipment(r, def as string)), `type=${type}`);
}
const legacy = new Set(raw.composition.legacyActionEffects.map((e: any) => e.actionId));
check("every action is atom-backed or has a legacy effect", raw.actions.every((a: any) => a.atomId ? !legacy.has(a.id) : legacy.has(a.id)));
if (validateTechniqueComposition) {
  const composition = validateTechniqueComposition(raw);
  check("composition contract validates", composition.ok, composition.errors?.join("; "));
}

const once = appendTechniqueToDraft(createDraftFromDemo(), raw).lab;
const twice = appendTechniqueToDraft(once, raw).lab;
const workflows = configureWorkflowInDraft(configureWorkflowInDraft(twice, "weighing-1", { solidMassG: "2.037" }, true), "weighing-2", { solidMassG: "1.5", reagentStockMassG: "5" }, true);
const labErrors = validateLabDefinition(workflows).errors;
check("two configured Studio workflows validate", labErrors.length === 0, labErrors.join("; "));
const stock = (id: string) => [...(workflows.initialState?.equipment ?? []), ...workflows.techniques.flatMap((tq: any) => tq.initialState.equipment)].find((e: any) => e.id === id)?.contents.massG;
check("each workflow's stock is its own", stock("weighing-1-reagent-bottle-1") === 10 && stock("weighing-2-reagent-bottle-1") === 5, `${stock("weighing-1-reagent-bottle-1")} ${stock("weighing-2-reagent-bottle-1")}`);
check("no template left in the draft", !JSON.stringify(workflows).includes("{{config."));

let failed = 0;
for (const [name, ok, detail] of results) { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? `  (${detail})` : ""}`); }
console.log(`${results.length - failed}/${results.length} passed`);
