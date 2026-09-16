import { describe, expect, it, vi } from "vitest";
import { demoLab, filtrationTechnique } from "../../domain/fixtures";
import { parseImportedJson, serializeLab, serializeTechnique } from "../importExport";
import { DRAFT_STORAGE_KEY, clearDraft, loadDraft, loadDraftArtifact, saveDraft } from "../persistence";
import { collectStudioInteractionIssues } from "../studioValidation";

describe("studio import/export and draft persistence", () => {
  it("round trips exported lab JSON", () => {
    const serialized = serializeLab(demoLab);
    const parsed = parseImportedJson(serialized);
    expect(parsed.ok).toBe(true);
    expect(parsed.value && "audience" in parsed.value ? parsed.value.id : "").toBe(demoLab.id);
  });

  it("round trips exported technique JSON", () => {
    const serialized = serializeTechnique(filtrationTechnique);
    const parsed = parseImportedJson(serialized);
    expect(parsed.ok).toBe(true);
    expect(parsed.value && !("audience" in parsed.value) ? parsed.value.id : "").toBe(filtrationTechnique.id);
  });

  it("preserves interaction specs across lab import and export", () => {
    const serialized = serializeLab(demoLab);
    const parsed = parseImportedJson(serialized);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok || !parsed.value || !("audience" in parsed.value)) {
      throw new Error("Expected a parsed lab definition.");
    }
    const action = parsed.value.actions.find((candidate) => candidate.id === "place-filter-paper");
    expect(action?.interaction).toMatchObject({
      type: "snapIntoTarget",
      sourceDefinitionId: "filter-paper",
      targetDefinitionId: "funnel-stand",
      snapZoneId: "funnel-stand-paper-seat",
    });
  });

  it("backfills missing interaction specs when importing older lab JSON", () => {
    const olderDraft = {
      ...demoLab,
      actions: demoLab.actions.map((action) => ({
        ...action,
        interaction: undefined,
      })),
    };

    const parsed = parseImportedJson(JSON.stringify(olderDraft));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok || !parsed.value || !("audience" in parsed.value)) {
      throw new Error("Expected a parsed lab definition.");
    }
    expect(parsed.value.actions.find((action) => action.id === "place-cylinder")?.interaction)
      .toMatchObject({
        type: "dragToZone",
        sourceDefinitionId: "graduated-cylinder",
      });
    expect(collectStudioInteractionIssues(parsed.value)).toEqual([]);
  });

  it("preserves authored process layout metadata across lab import and export", () => {
    const authored = {
      ...demoLab,
      process: {
        ...demoLab.process,
        nodes: demoLab.process.nodes.map((node, index) => ({
          ...node,
          layout: {
            x: 80 + index * 220,
            y: 120,
            lane: "procedure",
            display: "expanded" as const,
          },
        })),
      },
    };

    const parsed = parseImportedJson(serializeLab(authored));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok || !parsed.value || !("audience" in parsed.value)) {
      throw new Error("Expected a parsed lab definition.");
    }
    expect(parsed.value.process.nodes[0].layout).toEqual(authored.process.nodes[0].layout);
  });

  it("strips runtime-only attachment and provider fields from public lab JSON", () => {
    const authored = {
      ...demoLab,
      metadata: {
        ...demoLab.metadata,
        fileId: "file-provider-leak",
        generatedAssetPath: "C:/tmp/generated.png",
      },
      actions: demoLab.actions.map((action, index) =>
        index === 0
          ? {
              ...action,
              parameters: {
                ...action.parameters,
                fileId: "file-action-leak",
                assetPath: "C:/Users/Emil/local.png",
                safeValue: "keep-me",
              },
            }
          : action,
      ),
    } as typeof demoLab;

    const serialized = serializeLab(authored);

    expect(serialized).toContain("safeValue");
    expect(serialized).not.toContain("file-provider-leak");
    expect(serialized).not.toContain("file-action-leak");
    expect(serialized).not.toContain("C:/Users/Emil/local.png");
    expect(serialized).not.toContain("generated.png");
  });

  it("reports invalid imported JSON", () => {
    const parsed = parseImportedJson("{");
    expect(parsed.ok).toBe(false);
    expect(parsed.errors[0]).toContain("JSON");
  });

  it("rejects assay artifacts with guidance to use Assay Studio", () => {
    const parsed = parseImportedJson(JSON.stringify({
      schema: "assay-studio.assay-definition",
      schemaVersion: "1.0",
      id: "assay-demo",
    }));

    expect(parsed).toEqual({
      ok: false,
      errors: [
        "Imported JSON did not match LabDefinition or TechniqueDefinition.",
        "This is an Assay Studio artifact. Open Assay Studio to import .assay.json files; the chemistry Studio accepts only LabDefinition or TechniqueDefinition JSON.",
      ],
    });
  });

  it("exports a self-contained lab with no unresolved bundled reference", () => {
    const withReference = {
      ...demoLab,
      techniqueRefs: [{ techniqueId: "filtration", version: "1.0.0", actionIds: "all" }],
    };

    const serialized = JSON.parse(serializeLab(withReference));

    expect("techniqueRefs" in serialized).toBe(false);
    expect(serialized.actions.map((action: { id: string }) => action.id)).toEqual(
      demoLab.actions.map((action) => action.id),
    );
  });

  it("rejects a raw bundled lab source rather than importing it without its actions", () => {
    const parsed = parseImportedJson(
      JSON.stringify({
        ...demoLab,
        actions: [],
        techniqueRefs: [{ techniqueId: "filtration", version: "1.0.0", actionIds: "all" }],
      }),
    );

    expect(parsed.ok).toBe(false);
    expect(parsed.errors[0]).toContain("unresolved techniqueRefs");
  });

  it("persists a versioned local draft", () => {
    vi.useFakeTimers();
    clearDraft();
    saveDraft(demoLab, "technique");
    expect(loadDraft()?.id).toBe(demoLab.id);
    expect(loadDraftArtifact()?.artifactKind).toBe("technique");
    clearDraft();
    expect(loadDraft()).toBeUndefined();
    vi.useRealTimers();
  });

  it("strips runtime-only fields from local draft persistence", () => {
    clearDraft();
    const unsafe = {
      ...demoLab,
      metadata: {
        ...demoLab.metadata,
        fileId: "file-provider-leak",
      },
      actions: demoLab.actions.map((action, index) =>
        index === 0
          ? {
              ...action,
              parameters: {
                ...action.parameters,
                assetPath: "C:/Users/Emil/local.png",
                safeValue: "keep-me",
              },
            }
          : action,
      ),
    } as typeof demoLab;

    saveDraft(unsafe);
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY) ?? "";

    expect(raw).toContain("keep-me");
    expect(raw).not.toContain("file-provider-leak");
    expect(raw).not.toContain("C:/Users/Emil/local.png");
    clearDraft();
  });

  it("ignores corrupt local draft JSON instead of crashing startup", () => {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, "{");

    expect(loadDraft()).toBeUndefined();

    clearDraft();
  });

  it("backfills missing interaction specs when loading an older local draft", () => {
    clearDraft();
    const olderDraft = {
      ...demoLab,
      actions: demoLab.actions.map((action) => ({
        ...action,
        interaction: undefined,
      })),
    };
    window.localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        savedAt: "2026-05-14T00:00:00.000Z",
        draft: olderDraft,
      }),
    );

    const loaded = loadDraft();

    expect(loaded?.actions.find((action) => action.id === "record-volume")?.interaction)
      .toMatchObject({
        type: "recordNotebook",
        valueParameter: "measurementId",
      });
    expect(loaded ? collectStudioInteractionIssues(loaded) : []).toEqual([]);
    clearDraft();
  });
});
