import { describe, expect, it } from "vitest";
import type { TechniqueDefinition } from "../../domain/types";
import { createRuntimeState, performRuntimeAction } from "../index";

const configurationTechnique = (unlocked: boolean): TechniqueDefinition => ({
  id: "configuration-gate-technique",
  title: "Configuration Gate Technique",
  learningGoal: "Proceed only after teacher configuration is approved.",
  requiredEquipment: [],
  initialState: { equipment: [] },
  actions: [
    {
      id: "teacher-configured-step",
      verb: "observe",
      label: "Use the teacher-configured method",
      parameters: {
        note: "Teacher-configured method acknowledged.",
        configurationRequired: true,
        unlocked,
      },
      interaction: {
        type: "recordNotebook",
        valueParameter: "note",
        accessibleLabel: "Record the teacher-configured method.",
      },
      prerequisites: [],
      stateChanges: ["The approved configuration is recorded."],
      invalidCases: [],
      feedback: {
        success: "Approved configuration recorded.",
        invalid: "Teacher approval is required.",
      },
      evidence: ["teacher-configuration"],
    },
  ],
  process: {
    startNodeId: "teacher-configured-node",
    nodes: [
      {
        id: "teacher-configured-node",
        type: "observation",
        title: "Teacher-configured method",
        description: "Use only the approved configuration.",
        actionId: "teacher-configured-step",
        config: {},
        validation: [
          {
            id: "teacher-configured-complete",
            type: "actionEvidence",
            label: "Teacher-configured step completed.",
            actionId: "teacher-configured-step",
          },
        ],
        hints: [],
        feedback: {
          success: "Teacher-configured step complete.",
          retry: "Wait for teacher approval.",
        },
      },
    ],
    edges: [],
  },
  successCriteria: [],
  commonMistakes: [],
  resetBehavior: "resetTechnique",
  metadata: {
    version: "1.0.0",
    author: "Lab Studio",
    updatedAt: "2026-07-28T00:00:00Z",
    tags: ["configuration-gate"],
  },
});

describe("runtime configuration gate", () => {
  it("rejects an explicitly locked teacher-configured action", () => {
    const definition = configurationTechnique(false);
    const next = performRuntimeAction(definition, createRuntimeState(definition), {
      actionId: "teacher-configured-step",
      verb: "observe",
    });

    expect(next.completedNodes).toEqual([]);
    expect(next.notebook).toEqual([]);
    expect(next.attemptHistory.at(-1)).toMatchObject({
      actionId: "teacher-configured-step",
      success: false,
      message: "Teacher configuration required.",
    });
    expect(next.feedbackQueue.at(-1)?.message).toContain("locked");
  });

  it("allows the same action after the authored configuration is unlocked", () => {
    const definition = configurationTechnique(true);
    const next = performRuntimeAction(definition, createRuntimeState(definition), {
      actionId: "teacher-configured-step",
      verb: "observe",
    });

    expect(next.completedNodes).toContain("teacher-configured-node");
    expect(next.notebook).toHaveLength(1);
    expect(next.attemptHistory.at(-1)?.success).toBe(true);
  });

  it("allows an explicitly locked action after session-only teacher approval", () => {
    const definition = configurationTechnique(false);
    const next = performRuntimeAction(definition, createRuntimeState(definition), {
      actionId: "teacher-configured-step",
      verb: "observe",
      note: "Teacher approved",
      parameters: { configurationApproved: true },
    });

    expect(next.completedNodes).toContain("teacher-configured-node");
    expect(next.attemptHistory.at(-1)?.success).toBe(true);
  });
});
