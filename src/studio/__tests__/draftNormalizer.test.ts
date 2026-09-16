import { describe, expect, it } from "vitest";
import { demoLab } from "../../domain/fixtures";
import type { LabDefinition } from "../../domain/types";
import { validateLabDefinition } from "../../domain/validation";
import { createLegacySampleRackDraft } from "../../test/legacyDrafts";
import { normalizeStudioLabDraft } from "../draftNormalizer";

describe("studio draft normalizer", () => {
  const removeInteractionSpecs = (draft: LabDefinition): LabDefinition => ({
    ...draft,
    actions: draft.actions.map((action) => ({
      ...action,
      interaction: undefined,
    })),
    techniques: draft.techniques.map((technique) => ({
      ...technique,
      actions: technique.actions.map((action) => ({
        ...action,
        interaction: undefined,
      })),
    })),
  });

  it("backfills missing interaction specs for defaultable draft actions", () => {
    const normalized = normalizeStudioLabDraft(removeInteractionSpecs(demoLab));

    expect(normalized.actions.find((action) => action.id === "place-cylinder")?.interaction)
      .toMatchObject({
        type: "dragToZone",
        sourceDefinitionId: "graduated-cylinder",
        stationId: "workbench",
      });
    expect(normalized.actions.find((action) => action.id === "record-volume")?.interaction)
      .toMatchObject({
        type: "recordNotebook",
        valueParameter: "measurementId",
      });
    expect(normalized.actions.find((action) => action.id === "filter-mixture")?.interaction)
      .toMatchObject({
        type: "pourInto",
        sourceDefinitionId: "beaker-250ml",
        targetDefinitionId: "funnel-stand",
      });
    expect(
      normalized.techniques
        .find((technique) => technique.id === "measuring-volume")
        ?.actions.find((action) => action.id === "record-volume")
        ?.interaction,
    ).toMatchObject({
      type: "recordNotebook",
      valueParameter: "measurementId",
    });
    expect(validateLabDefinition(normalized).ok).toBe(true);
  });

  it("preserves existing authored interaction specs", () => {
    const authoredAccessibleLabel = "Custom authored transfer interaction.";
    const authored = {
      ...demoLab,
      actions: demoLab.actions.map((action) =>
        action.id === "transfer-sample" && action.interaction
          ? {
              ...action,
              interaction: {
                ...action.interaction,
                accessibleLabel: authoredAccessibleLabel,
              },
            }
          : action,
      ),
    };

    const normalized = normalizeStudioLabDraft(authored);

    expect(
      normalized.actions.find((action) => action.id === "transfer-sample")?.interaction
        ?.accessibleLabel,
    ).toBe(authoredAccessibleLabel);
  });

  it("repairs legacy sample rack volume sources across draft actions and equipment", () => {
    const legacyDraft = createLegacySampleRackDraft();
    const legacyWithExplicitInteraction = {
      ...legacyDraft,
      actions: legacyDraft.actions.map((action) =>
        action.id === "measure-20ml"
          ? {
              ...action,
              interaction: {
                type: "pourInto" as const,
                sourceDefinitionId: "sample-rack",
                targetDefinitionId: "graduated-cylinder",
                valueParameter: "volumeMl",
                accessibleLabel:
                  "Pour sample rack into graduated cylinder until the meniscus reaches 20 mL.",
                successCue: "The sample rack was measured.",
                invalidCue: "Use the sample rack as the source.",
              },
            }
          : action,
      ),
    };

    const normalized = normalizeStudioLabDraft(legacyWithExplicitInteraction);
    const measureAction = normalized.actions.find((action) => action.id === "measure-20ml");
    const measuringTechnique = normalized.techniques.find(
      (technique) => technique.id === "measuring-volume",
    );
    const sampleInstance = measuringTechnique?.initialState.equipment.find(
      (instance) => instance.definitionId === "sample-bottle",
    );

    expect(normalized.equipment).toContain("sample-bottle");
    expect(normalized.equipment).not.toContain("sample-rack");
    expect(measureAction?.parameters.sourceDefinitionId).toBe("sample-bottle");
    expect(measureAction?.interaction?.sourceDefinitionId).toBe("sample-bottle");
    expect(measureAction?.interaction?.accessibleLabel).toContain("sample bottle");
    expect(measureAction?.interaction?.accessibleLabel).not.toContain("sample rack");
    expect(measuringTechnique?.requiredEquipment).toContain("sample-bottle");
    expect(measuringTechnique?.requiredEquipment).not.toContain("sample-rack");
    expect(sampleInstance).toMatchObject({
      id: "sample-bottle-1",
      label: "Sample bottle",
      contents: {
        label: "Hard water sample",
        volumeMl: 120,
      },
    });
    expect(validateLabDefinition(normalized).ok).toBe(true);
  });
});
