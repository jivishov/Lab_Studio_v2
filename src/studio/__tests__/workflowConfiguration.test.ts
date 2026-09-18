import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { TechniqueDefinition } from "../../domain/types";
import { validateLabDefinition } from "../../domain/validation";
import { getInitialEquipment } from "../../runtime/createRuntime";
import { createBlankStudioLab } from "../studioArtifact";
import { assessStudioReadiness, isRunnableReadiness } from "../studioReadiness";
import { appendTechniqueToDraft, createDraftFromDemo } from "../studioState";
import { commitStudioTransaction } from "../studioTransactions";
import { appendConfiguredWorkflow, configureWorkflowInDraft, workflowConfigurationBlocker } from "../workflowConfiguration";

// Authored regression scenarios only. These illustrative test inputs are never product defaults.
const readTechnique = async (id: string): Promise<TechniqueDefinition> =>
  JSON.parse(await readFile(join(process.cwd(), "public", "techniques", `${id}.json`), "utf8")) as TechniqueDefinition;
const teacherApprovedWavelengthNm = "600";
const transmittanceValues = { stockConcentrationM: "0.20", wavelengthNm: teacherApprovedWavelengthNm };
const secondTransmittanceValues = { stockConcentrationM: "0.10", wavelengthNm: teacherApprovedWavelengthNm };

describe("Studio workflow configuration", () => {
  it("appends a configured published workflow into the same draft and recomputes readiness", async () => {
    const source = await readTechnique("transmittance-dilution");
    const draft = createDraftFromDemo();
    const original = structuredClone(draft);
    const result = commitStudioTransaction(draft, "r1", {
      baseRevision: "r1", idempotencyKey: "configured-append", label: "Configure and append",
      operations: [{ type: "appendConfiguredWorkflow", technique: source, values: transmittanceValues, approved: true }],
    });

    expect(result.ok, result.error).toBe(true);
    expect(draft).toEqual(original);
    expect(result.draft.id).toBe(draft.id);
    expect(result.draft.title).toBe(draft.title);
    expect(result.draft.actions.slice(0, draft.actions.length)).toEqual(draft.actions);
    expect(result.draft.actions.find((action) => action.id === "transmittance-dilution-1-transmittance-dilution-record-stock-concentration")
      ?.parameters.configuredValue).toBe(0.2);
    expect(JSON.stringify(result.draft)).not.toContain("{{config.");
    expect(validateLabDefinition(result.draft).errors).toEqual([]);
    expect(isRunnableReadiness(assessStudioReadiness(result.draft))).toBe(true);
  });

  it("keeps repeated raw instances isolated and preserves local edits and external connectors", async () => {
    const source = await readTechnique("transmittance-dilution");
    const first = appendTechniqueToDraft(createDraftFromDemo(), source);
    const second = appendTechniqueToDraft(first.lab, source);
    const firstInstance = first.lab.techniques.at(-1)!;
    const editedActionId = firstInstance.actions[0].id;
    const draft = {
      ...second.lab,
      actions: second.lab.actions.map((action) => action.id === editedActionId
        ? { ...action, label: "Aliquot for this class" } : action),
      process: { ...second.lab.process, nodes: second.lab.process.nodes.map((node) => node.id === first.startNodeId
        ? { ...node, description: "Teacher's retained instruction", layout: { x: 777, y: 222 } } : node) },
    };
    const untouchedSecond = draft.techniques.at(-1);
    const boundFirst = configureWorkflowInDraft(draft, "transmittance-dilution-1", transmittanceValues, true);
    expect(boundFirst.techniques.at(-1)).toBe(untouchedSecond);
    expect(boundFirst.process.edges).toEqual(draft.process.edges);
    expect(boundFirst.actions.find((action) => action.id === editedActionId)?.label).toBe("Aliquot for this class");
    expect(boundFirst.process.nodes.find((node) => node.id === first.startNodeId)).toMatchObject({
      description: "Teacher's retained instruction", layout: { x: 777, y: 222 },
    });
    expect(JSON.stringify(boundFirst.techniques.find((technique) => technique.id === "transmittance-dilution-1"))).not.toContain("{{config.");
    expect(JSON.stringify(untouchedSecond)).toContain("{{config.");
    const incompleteReadiness = assessStudioReadiness(boundFirst);
    expect(isRunnableReadiness(incompleteReadiness)).toBe(false);
    const incompleteDiagnostic = incompleteReadiness.diagnostics.find((diagnostic) =>
      diagnostic.id.startsWith("unresolved-configuration-")
      && diagnostic.anchor?.techniqueId === "transmittance-dilution-2");
    expect(incompleteDiagnostic?.anchor?.nodeId).toBe(second.startNodeId);

    const boundBoth = configureWorkflowInDraft(boundFirst, "transmittance-dilution-2", secondTransmittanceValues, true);
    expect(JSON.stringify(boundBoth)).not.toContain("{{config.");
    expect(validateLabDefinition(boundBoth).errors).toEqual([]);
    expect(isRunnableReadiness(assessStudioReadiness(boundBoth))).toBe(true);
    const firstBoundInstance = boundBoth.techniques.find((technique) => technique.id === "transmittance-dilution-1")!;
    const secondBoundInstance = boundBoth.techniques.find((technique) => technique.id === "transmittance-dilution-2")!;
    expect(JSON.stringify(firstBoundInstance)).not.toContain("transmittance-dilution-2-");
    expect(JSON.stringify(secondBoundInstance)).not.toContain("transmittance-dilution-1-");
    expect(firstBoundInstance.actions).toEqual(boundBoth.actions.filter((action) => action.id.startsWith("transmittance-dilution-1-")));
    for (const instance of [firstBoundInstance, secondBoundInstance]) {
      const measurementVolume = instance.actions.find((action) => action.volume?.source === "measurement");
      expect(measurementVolume?.volume?.source === "measurement" ? measurementVolume.volume.referenceId : undefined)
        .toMatch(new RegExp(`^${instance.id}-`));
      expect(instance.process.nodes.flatMap((node) => node.validation).filter((rule) => rule.actionId)
        .every((rule) => rule.actionId?.startsWith(`${instance.id}-`))).toBe(true);
    }
  });

  it("keeps typed mass output, notebook, node and success-rule references consistent in two instances", async () => {
    const source = await readTechnique("weighing");
    const once = appendTechniqueToDraft(createDraftFromDemo(), source).lab;
    const raw = appendTechniqueToDraft(once, source).lab;
    const configured = configureWorkflowInDraft(
      configureWorkflowInDraft(raw, "weighing-1", {}, true),
      "weighing-2", {}, true,
    );
    for (const id of ["weighing-1", "weighing-2"]) {
      const instance = configured.techniques.find((technique) => technique.id === id)!;
      const producer = instance.actions.find((action) => action.mass?.source === "action-input")!;
      const measurementId = producer.mass?.source === "action-input" ? producer.mass.outputMeasurementId : undefined;
      expect(measurementId).toMatch(new RegExp(`^${id}-`));
      expect(instance.actions.filter((action) => action.verb === "record").map((action) => action.parameters.measurementId)).toContain(measurementId);
      expect(instance.process.nodes.flatMap((node) => node.validation).filter((rule) => rule.type === "measurementRecorded")
        .map((rule) => rule.measurementId)).toContain(measurementId);
      expect(instance.successCriteria.filter((rule) => rule.type === "measurementRecorded").map((rule) => rule.measurementId)).toContain(measurementId);
      expect(configured.assessments.filter((rule) => rule.id.startsWith(`${id}-`))).toEqual(instance.successCriteria);
      expect(instance.actions).toEqual(configured.actions.filter((action) => action.id.startsWith(`${id}-`)));
      expect(producer.parameters.inputRole).toBe("studentResponse");
      expect(producer.parameters.configuredValue).toBeUndefined();
    }
    expect(validateLabDefinition(configured).errors).toEqual([]);
  });

  it("requires approval and declared finite, physically coherent values at the transaction boundary", async () => {
    const source = await readTechnique("transmittance-dilution");
    const draft = createDraftFromDemo();
    for (const [values, approved, message] of [
      [transmittanceValues, false, /approved/i],
      [{ ...transmittanceValues, stockConcentrationM: "not a number" }, true, /finite number/i],
      [{ ...transmittanceValues, stockConcentrationM: "0" }, true, /stockConcentrationM/],
    ] as const) {
      const result = commitStudioTransaction(draft, "r1", {
        baseRevision: "r1", idempotencyKey: "invalid-append", label: "Invalid configuration",
        operations: [{ type: "appendConfiguredWorkflow", technique: source, values, approved }],
      });
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(message);
      expect(result.draft).toBe(draft);
    }
    const raw = appendTechniqueToDraft(draft, source).lab;
    expect(() => configureWorkflowInDraft(raw, "transmittance-dilution-1", {
      stockConcentrationM: "0", wavelengthNm: teacherApprovedWavelengthNm,
    }, true))
      .toThrow(/stockConcentrationM/);
  });

  it("refuses ambiguous ownership or deleted steps without overwriting another workflow", async () => {
    const source = await readTechnique("transmittance-dilution");
    const raw = appendTechniqueToDraft(createDraftFromDemo(), source).lab;
    const instance = raw.techniques.at(-1)!;
    expect(() => configureWorkflowInDraft({ ...raw, techniques: [...raw.techniques, { ...instance, id: "duplicate" }] },
      instance.id, transmittanceValues, true)).toThrow(/shares editable content/);
    expect(() => configureWorkflowInDraft({ ...raw, process: { ...raw.process, nodes: raw.process.nodes.filter((node) =>
      node.id !== instance.process.startNodeId) } }, instance.id, transmittanceValues, true)).toThrow(/missing or ambiguous/);
  });

  it("sets the first workflow start in an empty draft and retains the runtime's nested equipment fallback", async () => {
    const source = await readTechnique("transmittance-dilution");
    const blank = { ...createBlankStudioLab(), initialState: undefined };
    const appended = appendConfiguredWorkflow(blank, source, transmittanceValues, true);
    expect(appended.lab.process.startNodeId).toBe(appended.startNodeId);
    const instance = appended.lab.techniques[0];
    expect(getInitialEquipment(appended.lab).map((item) => item.id)).toEqual(expect.arrayContaining(
      instance.initialState.equipment.map((item) => item.id),
    ));
    expect(instance.initialState.equipment.every((item) => item.id.startsWith(`${instance.id}-`))).toBe(true);
  });

  it("rejects generic materialization of ordered and specialized host workflows, including raw scoped instances", async () => {
    for (const id of ["paper-chromatography", "thermal-decomposition-mass-loss", "brass-spectrophotometry"]) {
      const source = await readTechnique(id);
      expect(workflowConfigurationBlocker(source)).not.toBeNull();
      expect(() => appendConfiguredWorkflow(createDraftFromDemo(), source, { selectedProcedure: "water" }, true)).toThrow();
      const raw = appendTechniqueToDraft(createDraftFromDemo(), source).lab;
      expect(workflowConfigurationBlocker(raw.techniques.at(-1)!)).not.toBeNull();
      expect(() => configureWorkflowInDraft(raw, `${id}-1`, { selectedProcedure: "water" }, true)).toThrow();
    }
  });
});
