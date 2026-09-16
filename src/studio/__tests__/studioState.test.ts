import { describe, expect, it } from "vitest";
import { hardWaterDemoLab, transmittanceDilutionTechnique } from "../../domain/fixtures";
import type { TechniqueDefinition } from "../../domain/types";
import { validateLabDefinition } from "../../domain/validation";
import paperChromatographyTechniqueJson from "../../../public/techniques/paper-chromatography.json";
import {
  appendTechniqueToDraft,
  createActionFromTemplate,
  createDraftFromDemo,
  createNodeFromTemplate,
  insertTemplateStepIntoDraft,
  studioTemplates,
} from "../studioState";

const paperChromatographyTechnique = paperChromatographyTechniqueJson as unknown as TechniqueDefinition;

const expectUnique = (values: string[]) => {
  expect(new Set(values).size).toBe(values.length);
};

describe("studioState technique templates", () => {
  it("appends a bundled technique with deterministic ids and a connector edge", () => {
    const draft = createDraftFromDemo();
    const previousLastNode = draft.process.nodes.at(-1);

    const appended = appendTechniqueToDraft(draft, transmittanceDilutionTechnique);
    const lab = appended.lab;

    expect(appended.startNodeId).toBe(
      `transmittance-dilution-1-${transmittanceDilutionTechnique.process.startNodeId}`,
    );
    expect(lab.techniques.at(-1)?.id).toBe("transmittance-dilution-1");
    expect(lab.actions.some(
      (action) => action.id === `transmittance-dilution-1-${transmittanceDilutionTechnique.actions[0].id}`,
    )).toBe(true);
    expect(lab.equipment).toEqual(
      expect.arrayContaining(transmittanceDilutionTechnique.requiredEquipment),
    );
    expect(lab.process.edges).toContainEqual({
      from: previousLastNode?.id,
      to: appended.startNodeId,
      label: "Next",
      condition: { type: "validationPassed" },
    });

    expectUnique(lab.actions.map((action) => action.id));
    expectUnique(lab.process.nodes.map((node) => node.id));
    expectUnique(lab.initialState?.equipment.map((item) => item.id) ?? []);
    expect(validateLabDefinition(lab).errors).toEqual([]);
  });

  it("uses the next available prefix when the same technique is appended twice", () => {
    const first = appendTechniqueToDraft(createDraftFromDemo(), transmittanceDilutionTechnique);
    const second = appendTechniqueToDraft(first.lab, transmittanceDilutionTechnique);

    expect(first.lab.techniques.at(-1)?.id).toBe("transmittance-dilution-1");
    expect(second.lab.techniques.at(-1)?.id).toBe("transmittance-dilution-2");
    expect(second.startNodeId).toBe(
      `transmittance-dilution-2-${transmittanceDilutionTechnique.process.startNodeId}`,
    );
    expect(validateLabDefinition(second.lab).errors).toEqual([]);
  });

  it("keeps chromatography band ids local while prefixing the appended model id", () => {
    const appended = appendTechniqueToDraft(createDraftFromDemo(), paperChromatographyTechnique);
    const importedTechnique = appended.lab.techniques.find(
      (technique) => technique.id === "paper-chromatography-1",
    );
    const sourceModel = paperChromatographyTechnique.chromatographyModels?.[0];
    const sourceRfAction = paperChromatographyTechnique.actions.find(
      (action) => action.id === "calculate-water-rf",
    );
    if (!sourceModel || !sourceRfAction) throw new Error("Missing water chromatography source contract");
    const rfAction = importedTechnique?.actions.find(
      (action) => action.id === `paper-chromatography-1-${sourceRfAction.id}`,
    );

    expect(importedTechnique?.chromatographyModels?.[0]).toMatchObject({
      id: `paper-chromatography-1-${sourceModel.id}`,
      bands: sourceModel.bands.map((band) => ({ id: band.id })),
    });
    expect(rfAction?.parameters).toMatchObject({
      calculationId: `paper-chromatography-1-${String(sourceRfAction.parameters.calculationId)}`,
      chromatographyModelId: `paper-chromatography-1-${String(sourceRfAction.parameters.chromatographyModelId)}`,
      bandIds: sourceRfAction.parameters.bandIds,
    });
    expect(importedTechnique?.successCriteria).toEqual([]);
    expect(validateLabDefinition(appended.lab).errors).toEqual([]);
  });

  it("prefixes typed references without rewriting literal or configuration values", () => {
    const sourceAction = transmittanceDilutionTechnique.actions.find(
      (action) => action.parameters.sourceInstanceId !== undefined,
    );
    if (!sourceAction) throw new Error("Missing source-instance action");
    const literalValue = String(sourceAction.parameters.sourceInstanceId);
    const configurationValue = "{{config.stockVolumeMeasurementId}}";
    const technique = {
      ...transmittanceDilutionTechnique,
      actions: transmittanceDilutionTechnique.actions.map((action) =>
        action.id === sourceAction.id
          ? {
              ...action,
              parameters: {
                ...action.parameters,
                instruction: literalValue,
                concentrationMeasurementId: configurationValue,
              },
            }
          : action,
      ),
    };

    const appended = appendTechniqueToDraft(createDraftFromDemo(), technique);
    const importedAction = appended.lab.techniques.at(-1)?.actions.find(
      (action) => action.id === `transmittance-dilution-1-${sourceAction.id}`,
    );

    expect(importedAction?.parameters.instruction).toBe(literalValue);
    expect(importedAction?.parameters.sourceInstanceId).toBe(
      `transmittance-dilution-1-${literalValue}`,
    );
    expect(importedAction?.parameters.concentrationMeasurementId).toBe(configurationValue);
    expect(validateLabDefinition(appended.lab).errors).toEqual([]);
  });
});

describe("studioState step insertion", () => {
  const stepTemplate = () => {
    const template = studioTemplates.find((candidate) => candidate.id === "template-weigh");
    if (!template) throw new Error("Missing weigh template");
    return template;
  };

  it("rewires a single outgoing linear edge when inserting after a selected node", () => {
    const draft = createDraftFromDemo();
    const anchor = draft.process.nodes[0];
    const originalEdge = draft.process.edges.find((edge) => edge.from === anchor.id);
    expect(originalEdge).toBeDefined();

    const inserted = insertTemplateStepIntoDraft(draft, stepTemplate(), {
      anchorNodeId: anchor.id,
      placement: "after",
    });

    expect(inserted.lab.process.nodes[1].id).toBe(inserted.nodeId);
    expect(inserted.lab.process.edges).toContainEqual({
      from: anchor.id,
      to: inserted.nodeId,
      label: "Next",
      condition: { type: "validationPassed" },
    });
    expect(inserted.lab.process.edges).toContainEqual({
      ...originalEdge!,
      from: inserted.nodeId,
    });
    expect(inserted.lab.process.edges).not.toContainEqual(originalEdge);
    expect(validateLabDefinition(inserted.lab).errors).toEqual([]);
  });

  it("preserves existing branches when inserting after a node with multiple outgoing edges", () => {
    const draft = createDraftFromDemo();
    const anchor = draft.process.nodes[0];
    const branchTarget = draft.process.nodes[2];
    const branchedDraft = {
      ...draft,
      process: {
        ...draft.process,
        edges: [
          ...draft.process.edges,
          {
            from: anchor.id,
            to: branchTarget.id,
            label: "Always",
            condition: { type: "always" as const },
          },
        ],
      },
    };

    const inserted = insertTemplateStepIntoDraft(branchedDraft, stepTemplate(), {
      anchorNodeId: anchor.id,
      placement: "after",
    });

    expect(inserted.lab.process.edges).toEqual(
      expect.arrayContaining(branchedDraft.process.edges),
    );
    expect(inserted.lab.process.edges).toContainEqual({
      from: anchor.id,
      to: inserted.nodeId,
      label: "Next",
      condition: { type: "validationPassed" },
    });
  });

  it("updates the start node when inserting before the current start", () => {
    const draft = createDraftFromDemo();
    const inserted = insertTemplateStepIntoDraft(draft, stepTemplate(), {
      anchorNodeId: draft.process.startNodeId,
      placement: "before",
    });

    expect(inserted.lab.process.startNodeId).toBe(inserted.nodeId);
    expect(inserted.lab.process.edges).toContainEqual({
      from: inserted.nodeId,
      to: draft.process.startNodeId,
      label: "Next",
      condition: { type: "validationPassed" },
    });
  });

  it("keeps single-step template contracts complete for guided authoring", () => {
    const stepTemplates = studioTemplates.filter((template) => template.nodeType && template.verb);

    stepTemplates.forEach((template, index) => {
      const action = createActionFromTemplate(template, index + 1);
      const node = createNodeFromTemplate(template, index + 1);

      expect(node.title).toBe(template.title);
      expect(node.description).toBe(template.description);
      expect(action.verb).toBe(template.verb);
      expect(Object.keys(action.parameters).length).toBeGreaterThan(0);
      expect(action.interaction?.accessibleLabel || action.label).toBeTruthy();
      expect(node.validation.length).toBeGreaterThan(0);
      expect(node.feedback.success).toContain(template.title);
    });
  });
});

describe("hard-water characterization", () => {
  it("uses a semantic precipitate verb for calcium carbonate precipitation", () => {
    const node = hardWaterDemoLab.process.nodes.find(
      (candidate) => candidate.title === "Precipitate calcium carbonate",
    );
    const action = hardWaterDemoLab.actions.find((candidate) => candidate.id === node?.actionId);

    expect(node?.actionId).toBe("precipitate-caco3");
    expect(action).toMatchObject({
      id: "precipitate-caco3",
      verb: "precipitate",
      label: "Precipitate calcium carbonate",
      parameters: {
        precipitateMassG: 0.0075,
        targetDefinitionId: "beaker-250ml",
      },
      interaction: {
        type: "pourInto",
        sourceDefinitionId: "reagent-bottle",
        targetDefinitionId: "beaker-250ml",
      },
    });
    expect(validateLabDefinition(hardWaterDemoLab).errors).toEqual([]);
  });
});
