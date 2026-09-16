import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { TechniqueDefinition } from "../../domain/types";
import { auditStandaloneEvidence } from "../standaloneEvidenceAudit";
import {
  configurationSlots,
  standaloneTechniqueConfigurationBlocker,
  unresolvedConfigurationSlots,
} from "../techniqueConfiguration";

/** Authored regressions for R1; intentionally not executed under the current verification ceiling. */
const readTechnique = async (id: string): Promise<TechniqueDefinition> =>
  JSON.parse(
    await readFile(join(process.cwd(), "public", "techniques", `${id}.json`), "utf8"),
  ) as TechniqueDefinition;

const copyFixture = (withProducer: boolean): TechniqueDefinition => ({
  id: withProducer ? "copy-with-source" : "copy-without-source",
  title: "Copy fixture",
  learningGoal: "Audit copy-only evidence semantics.",
  requiredEquipment: [],
  initialState: { equipment: [] },
  actions: [
    ...(withProducer
      ? [{
          id: "acquire-source",
          verb: "observe" as const,
          label: "Acquire source",
          parameters: {
            measurementId: "source-reading",
            configurationQuantity: "fixture source reading",
          },
          prerequisites: [],
          stateChanges: [],
          invalidCases: [],
          feedback: { success: "Recorded.", invalid: "Retry." },
          evidence: [],
        }]
      : []),
    {
      id: "copy-source",
      verb: "record",
      label: "Copy source",
      parameters: {
        measurementId: "source-reading",
        copyExistingMeasurementOnly: true,
      },
      prerequisites: [],
      stateChanges: [],
      invalidCases: [],
      feedback: { success: "Copied.", invalid: "Retry." },
      evidence: [],
    },
  ],
  process: {
    startNodeId: "copy-node",
    nodes: [],
    edges: [],
  },
  successCriteria: [],
  commonMistakes: [],
  resetBehavior: "resetTechnique",
  metadata: {
    version: "test",
    author: "test",
    updatedAt: "2026-09-16T00:00:00.000Z",
    tags: ["test"],
  },
} as TechniqueDefinition);

describe("standalone evidence producer/consumer semantics", () => {
  it("treats the titration-curve drop-dispense final burette reading as an output", async () => {
    const technique = await readTechnique("titration-curve-analysis");
    const issues = auditStandaloneEvidence(technique);

    expect(issues.some((issue) =>
      issue.code === "missing-measurement-producer"
      && issue.measurementId === "curve-final-burette"
    )).toBe(false);
    expect(standaloneTechniqueConfigurationBlocker(technique)).toBeNull();
    expect(unresolvedConfigurationSlots(technique)).toEqual([]);

    const analysisMode = configurationSlots(technique).find((slot) => slot.id === "analysisMode");
    expect(analysisMode).toMatchObject({
      kind: "host-composition-only",
      required: true,
      defaultValue: "recorded-evidence-only",
    });
  });

  it("requires an upstream acquisition for a copyExistingMeasurementOnly action", () => {
    const withoutProducer = auditStandaloneEvidence(copyFixture(false));
    expect(withoutProducer).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "missing-measurement-producer",
        measurementId: "source-reading",
        actionId: "copy-source",
      }),
    ]));

    const withProducer = auditStandaloneEvidence(copyFixture(true));
    expect(withProducer.some((issue) =>
      issue.code === "missing-measurement-producer"
      && issue.measurementId === "source-reading"
    )).toBe(false);
  });

  it("does not apply the dilution final-volume heuristic to Beer's-law calibration", async () => {
    const technique = await readTechnique("beers-law-calibration");
    const issues = auditStandaloneEvidence(technique);

    expect(issues.some((issue) => issue.code === "misleading-final-volume-producer")).toBe(false);
  });
});
