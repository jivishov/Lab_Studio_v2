import { describe, expect, it } from "vitest";
import { demoLab } from "../../domain/fixtures";
import { createDraftFromDemo } from "../studioState";
import { assessStudioReadiness } from "../studioReadiness";

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

  it("blocks preview and export when an otherwise valid draft still carries teacher config templates", () => {
    const draft = createDraftFromDemo();
    const target = draft.actions[0];
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

    expect(readiness.level).toBe("structurallyValid");
    expect(messages).toContain("approvedClassroomValue");
    expect(messages).toContain("Saving this incomplete draft is still allowed");
    expect(readiness.categories.find((category) => category.id === "studentPreview")?.status).toBe("fail");
    expect(readiness.categories.find((category) => category.id === "exportReadiness")?.status).toBe("fail");
    expect(readiness.diagnostics.find((diagnostic) =>
      diagnostic.id.startsWith("unresolved-configuration-")
    )?.anchor?.actionId).toBe(target.id);
  });
});
