import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { TechniqueDefinition } from "../../domain/types";
import { demoLab } from "../../domain/fixtures";
import { applyTechniqueConfigurationForComposition } from "../../data/techniqueConfiguration";
import { appendTechniqueToDraft, createDraftFromDemo } from "../studioState";
import { assessStudioReadiness } from "../studioReadiness";

const readTechnique = async (id: string): Promise<TechniqueDefinition> =>
  JSON.parse(
    await readFile(join(process.cwd(), "public", "techniques", `${id}.json`), "utf8"),
  ) as TechniqueDefinition;

describe("studio readiness", () => {
  it("treats the demo draft as export ready", () => {
    const readiness = assessStudioReadiness(createDraftFromDemo());
    expect(readiness.level).toBe("exportReady");
    expect(readiness.categories.map((category) => category.label)).toEqual([
      "Draft structure",
      "References",
      "Student preview",
      "Export readiness",
    ]);
  });

  it("keeps incomplete drafts saveable while blocking preview and export readiness", () => {
    const draft = {
      ...demoLab,
      title: "",
      actions: [],
      process: {
        ...demoLab.process,
        startNodeId: "missing",
        nodes: [],
        edges: [],
      },
    };

    const readiness = assessStudioReadiness(draft);

    expect(readiness.level).toBe("incomplete");
    expect(readiness.diagnostics.map((diagnostic) => diagnostic.message).join(" ")).toContain(
      "Add a lab or technique title",
    );
    expect(readiness.categories.find((category) => category.id === "studentPreview")?.status).toBe("fail");
    expect(readiness.categories.find((category) => category.id === "exportReadiness")?.status).toBe("fail");
  });

  it("blocks preview/export for raw templates and resolves the diagnostic to the affected node", () => {
    const draft = createDraftFromDemo();
    const target = draft.actions[0];
    const targetNode = draft.process.nodes.find((node) => node.actionId === target.id);
    draft.actions = [
      {
        ...target,
        parameters: {
          ...target.parameters,
          studioTeacherBinding: "{{config.approvedClassroomValue}}",
        },
      },
      ...draft.actions.slice(1),
    ];

    const readiness = assessStudioReadiness(draft);
    const messages = readiness.diagnostics.map((diagnostic) => diagnostic.message).join(" ");
    const diagnostic = readiness.diagnostics.find((entry) =>
      entry.id.startsWith("unresolved-configuration-"));

    expect(readiness.level).toBe("structurallyValid");
    expect(messages).toContain("approvedClassroomValue");
    expect(messages).toContain("Saving this incomplete draft is still allowed");
    expect(readiness.categories.find((category) => category.id === "studentPreview")?.status).toBe("fail");
    expect(readiness.categories.find((category) => category.id === "exportReadiness")?.status).toBe("fail");
    expect(diagnostic?.anchor?.actionId).toBe(target.id);
    expect(diagnostic?.anchor?.nodeId).toBe(targetNode?.id);
  });

  it("can materialize a declared technique configuration before appending it to the current draft", async () => {
    const technique = await readTechnique("dilution");
    const configured = applyTechniqueConfigurationForComposition(technique, {
      aliquotVolumeMl: "5",
      finalVolumeMl: "50",
      dilutionFactor: "10",
    });
    const appended = appendTechniqueToDraft(createDraftFromDemo(), configured).lab;
    const readiness = assessStudioReadiness(appended);

    expect(JSON.stringify(appended)).not.toContain("{{config.");
    expect(readiness.diagnostics.some((diagnostic) =>
      diagnostic.id.startsWith("unresolved-configuration-")
    )).toBe(false);
    expect(readiness.categories.find((category) => category.id === "studentPreview")?.status)
      .not.toBe("fail");
  });
});
