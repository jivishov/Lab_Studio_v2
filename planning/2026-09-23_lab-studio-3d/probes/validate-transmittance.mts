// Narrow static validator for transmittance-dilution's teacher-prepared values (one file). Not a test run.
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const root = "file:///C:/Users/EmilJivishov/Projects/Lab_studio/tmp/lab-studio-3d/";
const { validateTechniqueDefinition, validateLabDefinition } = await import(root + "src/domain/validation.ts");
const { applyTechniqueConfiguration, configurationSlots, standaloneTechniqueConfigurationBlocker, unresolvedConfigurationSlots } = await import(root + "src/data/techniqueConfiguration.ts");
const { auditStandaloneEvidence } = await import(root + "src/data/standaloneEvidenceAudit.ts");
const { atomById, deriveActionEffectContract } = await import(root + "src/domain/atomRegistry.ts");
const { resolveActionInteraction } = await import(root + "src/domain/interactions.ts");
const { actionInputField } = await import(root + "src/runtime/actionInputs.ts");
const { validateTechniqueCompositionContract } = await import(root + "src/domain/compositionValidation.ts");
const { appendTechniqueToDraft, createDraftFromDemo } = await import(root + "src/studio/studioState.ts");
const { configureWorkflowInDraft } = await import(root + "src/studio/workflowConfiguration.ts");

const raw = JSON.parse(await readFile(new URL(root + "public/techniques/transmittance-dilution.json"), "utf8"));
const results: [string, boolean, string?][] = [];
const check = (name: string, ok: boolean, detail?: string) => results.push([name, ok, detail]);
const throws = (fn: () => unknown): string | undefined => { try { fn(); return undefined; } catch (e) { return e instanceof Error ? e.message : String(e); } };

const published = validateTechniqueDefinition(raw);
check("published file validates", published.ok, published.errors?.join("; "));
check("composition contract validates", validateTechniqueCompositionContract(raw).ok, validateTechniqueCompositionContract(raw).errors?.join("; "));
check("standalone setup not blocked", standaloneTechniqueConfigurationBlocker(raw) === null, String(standaloneTechniqueConfigurationBlocker(raw)));
const slots = configurationSlots(raw);
const slot = (id: string) => slots.find((s: any) => s.id === id);
for (const [id, unit] of [["stockAliquotVolumeMl", "mL"], ["waterVolumeMl", "mL"], ["finalVolumeMl", "mL"], ["samplePercentTransmittance", "%T"]]) {
  check(`${id}: a teacher quantity in ${unit}, no default`, slot(id)?.kind === "classroom-quantity" && slot(id)?.unit === unit && slot(id)?.defaultValue === undefined, JSON.stringify(slot(id)));
}
const values = { stockConcentrationM: "0.2", wavelengthNm: "630", stockAliquotVolumeMl: "5", waterVolumeMl: "10", finalVolumeMl: "15", samplePercentTransmittance: "42.5" };
const configured = applyTechniqueConfiguration(raw, values);
const result = validateTechniqueDefinition(configured);
check("configured technique validates", result.ok, result.errors?.join("; "));
check("nothing left unresolved", unresolvedConfigurationSlots(configured).length === 0, unresolvedConfigurationSlots(configured).join(","));
check("standalone evidence audit clean", auditStandaloneEvidence(configured).length === 0, JSON.stringify(auditStandaloneEvidence(configured)));
const act = (id: string) => configured.actions.find((a: any) => a.id === `transmittance-dilution-${id}`);
check("aliquot, water and final volumes are literal numbers", act("measure-stock-dye").volume.valueMl === 5 && act("measure-water-volume").volume.valueMl === 10 && act("add-water-below-mark").volume.valueMl === 15);
check("no play-time field on the three volume steps", ["measure-stock-dye", "measure-water-volume", "add-water-below-mark"].every((id) => !actionInputField(act(id))));
check("read step carries the prepared %T", act("read-percent-transmittance").parameters.teacherPreparedReading === 42.5);
check("read step still asks the student", actionInputField(act("read-percent-transmittance"))?.role === "studentResponse");
const node = (id: string) => configured.process.nodes.find((n: any) => n.id === `transmittance-dilution-${id}-node`)?.description;
check("instructions state the amounts", node("measure-stock-dye") === "Pour 5 mL of the stock dye through the funnel into the graduated cylinder." && node("add-water-below-mark") === "Add the measured water to the test tube, to a final volume of 15 mL." && node("configure-photometer") === "Set the photometer to 630 nm in percent-transmittance mode.", `${node("measure-stock-dye")} | ${node("configure-photometer")}`);
// The test tube is stoppered, inverted ten times and opened before its sample is drawn (decided 2026-10-05).
const order = configured.process.nodes.map((n: any) => n.actionId.replace("transmittance-dilution-", ""));
check("stopper, invert and unstopper follow the water and precede the photometer",
  order.slice(order.indexOf("add-water-below-mark"), order.indexOf("place-spectrophotometer") + 1).join(",") ===
    "add-water-below-mark,stopper-test-tube,invert-test-tube,remove-test-tube-stopper,place-spectrophotometer", order.join(","));
check("the inversion needs the stopper seated", act("invert-test-tube").parameters.requiredAttachmentState === "attached" && act("invert-test-tube").parameters.inversions === 10);
check("the prepared %T is not in any instruction", !configured.process.nodes.some((n: any) => String(n.description).includes("42.5")));

const refuse = (patch: Record<string, string>, pattern: RegExp) => pattern.test(throws(() => applyTechniqueConfiguration(raw, { ...values, ...patch })) ?? "");
check("refuses a final volume not above the aliquot", refuse({ finalVolumeMl: "5" }, /greater than the stock aliquot/));
check("refuses too little water for the final volume", refuse({ waterVolumeMl: "4" }, /waterVolumeMl must cover/));
check("refuses a final volume above the test tube", refuse({ finalVolumeMl: "25", waterVolumeMl: "30" }, /exceeds the test-tube capacity/));
check("refuses 0 %T", refuse({ samplePercentTransmittance: "0" }, /greater than zero/));
check("refuses 120 %T", refuse({ samplePercentTransmittance: "120" }, /at most 100/));
check("accepts 100 %T", !throws(() => applyTechniqueConfiguration(raw, { ...values, samplePercentTransmittance: "100" })));

for (const id of ["measure-stock-dye", "measure-water-volume", "add-water-below-mark", "read-percent-transmittance"]) {
  const action = raw.actions.find((a: any) => a.id === `transmittance-dilution-${id}`);
  const effect = deriveActionEffectContract(action);
  const atom = atomById.get(action.atomId);
  check(`${id}: effect contract and atom interaction`, effect.errors.length === 0 && atom.allowedInteractionTypes.includes(resolveActionInteraction(action)?.type), effect.errors.join("; "));
}

const draft = appendTechniqueToDraft(createDraftFromDemo(), raw).lab;
const workflow = configureWorkflowInDraft(draft, "transmittance-dilution-1", values, true);
const labErrors = validateLabDefinition(workflow).errors;
check("configured Studio workflow validates", labErrors.length === 0, labErrors.join("; "));

// Byte parity: the generator reproduces the committed output from its input.
const before = await readFile(new URL(root + "public/techniques/transmittance-dilution.json"), "utf8");
execFileSync(process.execPath, ["scripts/generateSimulatorTechniqueDefinitions.mjs", "--only", "transmittance-dilution"], { cwd: new URL(root).pathname.slice(1) });
const after = await readFile(new URL(root + "public/techniques/transmittance-dilution.json"), "utf8");
check("generator output is byte-identical", before === after);

let failed = 0;
for (const [name, ok, detail] of results) { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? `  (${detail})` : ""}`); }
console.log(`${results.length - failed}/${results.length} passed`);
