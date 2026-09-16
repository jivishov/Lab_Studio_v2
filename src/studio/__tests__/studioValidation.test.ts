import { describe, expect, it } from "vitest";
import { demoLab } from "../../domain/fixtures";
import { normalizeStudioLabDraft } from "../draftNormalizer";
import { collectStudioInteractionIssues } from "../studioValidation";

describe("studio interaction validation", () => {
  it("does not warn for defaultable actions after Studio draft normalization", () => {
    const normalized = normalizeStudioLabDraft(demoLab);
    const issues = collectStudioInteractionIssues(normalized);

    expect(issues).toEqual([]);
  });

  it("warns about broken interaction authoring fields", () => {
    const broken = {
      ...demoLab,
      actions: demoLab.actions.map((action) =>
        action.id === "place-filter-paper"
          ? {
              ...action,
              interaction: {
                ...action.interaction!,
                type: "submitCalculation" as const,
                sourceDefinitionId: "missing-equipment",
                accessibleLabel: "",
              },
            }
          : action,
      ),
    };
    const messages = collectStudioInteractionIssues(broken)
      .map((issue) => issue.message)
      .join(" ");
    expect(messages).toContain("not compatible");
    expect(messages).toContain("unknown sourceDefinitionId");
    expect(messages).toContain("accessible interaction label");
  });

  it("warns when a pour interaction uses a non-pourable source", () => {
    const broken = {
      ...demoLab,
      equipment: [...demoLab.equipment, "sample-rack"],
      actions: demoLab.actions.map((action) =>
        action.id === "measure-20ml"
          ? {
              ...action,
              parameters: {
                ...action.parameters,
                sourceDefinitionId: "sample-rack",
              },
              interaction: {
                ...action.interaction!,
                sourceDefinitionId: "sample-rack",
              },
            }
          : action,
      ),
    };

    const messages = collectStudioInteractionIssues(broken)
      .map((issue) => issue.message)
      .join(" ");
    expect(messages).toContain("not pourable");
  });

  it("warns when explicit drop settings conflict with a titration model", () => {
    const draft = {
      ...demoLab,
      equipment: [...demoLab.equipment, "burette-50ml", "erlenmeyer-flask-250ml"],
      titrationModels: [
        {
          id: "acid-base-model",
          type: "acidBase" as const,
          analyte: { formula: "HCl", role: "acid" as const, strength: "strong" as const },
          titrant: { formula: "NaOH", role: "base" as const, strength: "strong" as const },
          analyteMolarityM: 0.0992,
          analyteVolumeMl: 25,
          titrantMolarityM: 0.1,
          dropVolumeMl: 0.05,
          maxExtraDrops: 5,
          temperatureC: 25,
          waterIonProduct: 1e-14,
          phPrecision: 2,
        },
      ],
      actions: [
        {
          ...demoLab.actions[0],
          id: "dispense",
          verb: "transfer" as const,
          label: "Dispense titrant",
          parameters: {
            titrationModelId: "acid-base-model",
            sourceDefinitionId: "burette-50ml",
            targetDefinitionId: "erlenmeyer-flask-250ml",
            initialBuretteReadingMl: 0.2,
            endpointDropCount: 1,
            dropVolumeMl: 0.1,
          },
          interaction: {
            type: "dispenseDrops" as const,
            sourceDefinitionId: "burette-50ml",
            targetDefinitionId: "erlenmeyer-flask-250ml",
            accessibleLabel: "Dispense titrant.",
          },
        },
      ],
    };

    const messages = collectStudioInteractionIssues(draft)
      .map((issue) => issue.message)
      .join(" ");
    expect(messages).toContain("explicit drop settings differ");
  });

  it("warns when a backfilled pour interaction uses a non-pourable source", () => {
    const broken = {
      ...demoLab,
      equipment: [...demoLab.equipment, "filter-paper"],
      actions: demoLab.actions.map((action) =>
        action.id === "measure-20ml"
          ? {
              ...action,
              parameters: {
                ...action.parameters,
                sourceDefinitionId: "filter-paper",
              },
              interaction: undefined,
            }
          : action,
      ),
    };

    const normalized = normalizeStudioLabDraft(broken);
    const messages = collectStudioInteractionIssues(normalized)
      .map((issue) => issue.message)
      .join(" ");
    expect(messages).not.toContain("missing an explicit interaction spec");
    expect(messages).toContain("not pourable");
  });

  it("warns when no interaction spec can be inferred", () => {
    const unsupported = {
      ...demoLab,
      actions: [
        {
          ...demoLab.actions[0],
          id: "custom-action",
          verb: "customVerb",
          interaction: undefined,
        },
      ],
    } as unknown as typeof demoLab;

    const normalized = normalizeStudioLabDraft(unsupported);
    const messages = collectStudioInteractionIssues(normalized)
      .map((issue) => issue.message)
      .join(" ");

    expect(messages).toContain("missing an explicit interaction spec");
  });
});
