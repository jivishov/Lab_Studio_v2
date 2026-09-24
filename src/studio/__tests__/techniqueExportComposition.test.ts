import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { TechniqueDefinition } from "../../domain/types";
import { parseImportedJson } from "../importExport";
import { DRAFT_STORAGE_KEY, clearDraft, loadDraftArtifact, saveDraft } from "../persistence";
import { deriveTechniqueFromLabDraft, labDraftFromTechnique, serializeStudioArtifact } from "../studioArtifact";
import { commitStudioTransaction, createInitialStudioRevision } from "../studioTransactions";

const readTechnique = (id: string): TechniqueDefinition =>
  JSON.parse(readFileSync(join(process.cwd(), "public", "techniques", `${id}.json`), "utf8")) as TechniqueDefinition;

describe("a technique exported from the Studio keeps its composition contract (plan D10)", () => {
  const technique = readTechnique("making-solution");

  it("carries the contract through open-for-editing and export", () => {
    expect(technique.composition).toBeDefined();
    const derived = deriveTechniqueFromLabDraft(labDraftFromTechnique(technique));
    expect(derived.composition).toEqual(technique.composition);
    const parsed = parseImportedJson(serializeStudioArtifact("technique", labDraftFromTechnique(technique)));
    expect(parsed.ok, parsed.errors.join("\n")).toBe(true);
    expect(parsed.value && !("audience" in parsed.value) ? parsed.value.composition : undefined).toEqual(technique.composition);
  });

  it("keeps the contract when technique settings are edited", () => {
    const revision = createInitialStudioRevision();
    const result = commitStudioTransaction(labDraftFromTechnique(technique), revision, {
      baseRevision: revision,
      idempotencyKey: "d10-settings",
      label: "Edit learning goal",
      operations: [{ type: "updateTechniqueSettings", patch: { learningGoal: "A revised goal." } }],
    });
    expect(result.ok, result.error).toBe(true);
    expect(result.draft.techniques[0].composition).toEqual(technique.composition);
    expect(deriveTechniqueFromLabDraft(result.draft).composition).toEqual(technique.composition);
  });

  it("adds nothing to a technique that has no contract", () => {
    const legacy: TechniqueDefinition = { ...technique };
    delete legacy.composition;
    expect("composition" in deriveTechniqueFromLabDraft(labDraftFromTechnique(legacy))).toBe(false);
  });
});

describe("draft persistence under a separate key", () => {
  it("keeps a second Studio's draft apart from the original Studio's", () => {
    const key = "lab-studio:3d:v1:draft";
    clearDraft();
    clearDraft(key);
    saveDraft(labDraftFromTechnique(readTechnique("weighing")), "technique", key);
    expect(window.localStorage.getItem(DRAFT_STORAGE_KEY)).toBeNull();
    expect(loadDraftArtifact()).toBeUndefined();
    expect(loadDraftArtifact(key)?.artifactKind).toBe("technique");
    expect(loadDraftArtifact(key)?.draft.id).toBe("weighing");
    clearDraft(key);
    expect(loadDraftArtifact(key)).toBeUndefined();
  });
});
