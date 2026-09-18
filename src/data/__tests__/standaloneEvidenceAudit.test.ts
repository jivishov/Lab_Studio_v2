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

const recordFixture = (withNumericInput: boolean): TechniqueDefinition => ({
  id: withNumericInput ? "record-with-input" : "record-without-input",
  title: "Record fixture",
  learningGoal: "Audit whether a record action can create its named evidence.",
  requiredEquipment: [],
  initialState: { equipment: [] },
  actions: [
    {
      id: "record-reading",
      verb: "record",
      label: "Record reading",
      parameters: {
        measurementId: "recorded-reading",
        ...(withNumericInput
          ? { inputMode: "numeric", inputRole: "studentResponse", unit: "g" }
          : {}),
      },
      prerequisites: [],
      stateChanges: [],
      invalidCases: [],
      feedback: { success: "Recorded.", invalid: "Retry." },
      evidence: [],
    },
  ],
  process: {
    startNodeId: "record-node",
    nodes: [],
    edges: [],
  },
  successCriteria: [
    {
      id: "reading-recorded",
      type: "measurementRecorded",
      label: "Reading recorded",
      measurementId: "recorded-reading",
    },
  ],
  commonMistakes: [],
  resetBehavior: "resetTechnique",
  metadata: {
    version: "test",
    author: "test",
    updatedAt: "2026-09-16T00:00:00.000Z",
    tags: ["test"],
  },
} as TechniqueDefinition);

const configuredRecordFixture = (
  valueType: "number" | "string",
  required = true,
): TechniqueDefinition => ({
  id: `configured-record-${valueType}`,
  title: "Configured record fixture",
  learningGoal: "Audit configured numeric record evidence.",
  requiredEquipment: [],
  initialState: { equipment: [] },
  actions: [
    {
      id: "record-configured-reading",
      verb: "record",
      label: "Record configured reading",
      parameters: {
        measurementId: "{{config.readingId}}",
        value: "{{config.readingValue}}",
      },
      prerequisites: [],
      stateChanges: [],
      invalidCases: [],
      feedback: { success: "Recorded.", invalid: "Retry." },
      evidence: [],
    },
  ],
  process: { startNodeId: "record-configured-node", nodes: [], edges: [] },
  successCriteria: [
    {
      id: "configured-reading-recorded",
      type: "measurementRecorded",
      label: "Configured reading recorded",
      measurementId: "{{config.readingId}}",
    },
  ],
  commonMistakes: [],
  resetBehavior: "resetTechnique",
  metadata: {
    version: "test",
    author: "test",
    updatedAt: "2026-09-16T00:00:00.000Z",
    tags: ["test"],
  },
  composition: {
    schemaVersion: 1,
    ports: [],
    equipmentRoles: [],
    modelSlots: [],
    configurationSlots: [
      { id: "readingId", valueType: "string", required: true },
      { id: "readingValue", valueType, required },
    ],
    approvalGates: [],
    variants: [],
    evidenceOutputs: [],
    completion: { exitPortIds: [], requiredEvidenceOutputIds: [], requiredValidationRuleIds: [] },
    catalogDisposition: "composable",
  },
} as TechniqueDefinition);

const diluteFixture = (): TechniqueDefinition => ({
  id: "dilute-measurement-parameter",
  title: "Dilute fixture",
  learningGoal: "Audit dilute evidence semantics.",
  requiredEquipment: [],
  initialState: { equipment: [] },
  actions: [
    {
      id: "dilute-sample",
      verb: "dilute",
      label: "Dilute sample",
      parameters: { measurementId: "claimed-dilution-reading" },
      prerequisites: [],
      stateChanges: [],
      invalidCases: [],
      feedback: { success: "Diluted.", invalid: "Retry." },
      evidence: [],
    },
  ],
  process: { startNodeId: "dilute-node", nodes: [], edges: [] },
  successCriteria: [
    {
      id: "claimed-reading-recorded",
      type: "measurementRecorded",
      label: "Claimed dilution reading recorded",
      measurementId: "claimed-dilution-reading",
    },
  ],
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
    const initialPh = technique.actions.find((action) => action.id === "record-initial-ph");
    const equivalenceVolume = technique.actions.find((action) => action.id === "record-equivalence-volume");

    expect(issues.some((issue) =>
      issue.code === "missing-measurement-producer"
      && issue.measurementId === "curve-final-burette"
    )).toBe(false);
    expect(initialPh).toMatchObject({
      parameters: {
        inputMode: "numeric",
        inputRole: "studentResponse",
        inputRequired: true,
        inputMin: 0,
        inputMax: 14,
        unit: "pH",
      },
    });
    expect(initialPh?.parameters.studentValueRequired).toBeUndefined();
    expect(equivalenceVolume).toMatchObject({
      parameters: {
        inputMode: "numeric",
        inputRole: "studentResponse",
        inputRequired: true,
        inputMin: 0,
        inputMinExclusive: true,
        unit: "mL",
      },
    });
    expect(equivalenceVolume?.parameters.studentValueRequired).toBeUndefined();
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

  it("does not let a plain record action satisfy its own missing measurement", () => {
    const withoutInput = auditStandaloneEvidence(recordFixture(false));
    expect(withoutInput).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "missing-measurement-producer",
        measurementId: "recorded-reading",
        actionId: "record-reading",
      }),
    ]));

    const withInput = auditStandaloneEvidence(recordFixture(true));
    expect(withInput.some((issue) =>
      issue.code === "missing-measurement-producer"
      && issue.measurementId === "recorded-reading"
    )).toBe(false);
  });

  it("credits only a declared numeric configuration binding as a record producer", () => {
    expect(auditStandaloneEvidence(configuredRecordFixture("number"))).toEqual([]);

    expect(auditStandaloneEvidence(configuredRecordFixture("number", false))).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "missing-measurement-producer",
        configurationSlot: "readingId",
        actionId: "record-configured-reading",
      }),
    ]));

    expect(auditStandaloneEvidence(configuredRecordFixture("string"))).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "missing-measurement-producer",
        configurationSlot: "readingId",
        actionId: "record-configured-reading",
      }),
    ]));
  });

  it("records the configured making-solution observation through the observe note path", async () => {
    const technique = await readTechnique("making-solution");
    const action = technique.actions.find((entry) => entry.id === "observe-solution");
    expect(action).toMatchObject({
      verb: "observe",
      parameters: { note: "{{config.solutionObservation}}" },
    });
    expect(auditStandaloneEvidence(technique)).toEqual([]);
  });

  it("does not credit dilute.parameters.measurementId as a runtime measurement output", () => {
    const issues = auditStandaloneEvidence(diluteFixture());
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "missing-measurement-producer",
        measurementId: "claimed-dilution-reading",
      }),
    ]));
  });

  it("keeps Beer's-law out of the dilution heuristic and types percent-T absorbance", async () => {
    const technique = await readTechnique("beers-law-calibration");
    const issues = auditStandaloneEvidence(technique);

    expect(issues.some((issue) => issue.code === "misleading-final-volume-producer")).toBe(false);
    expect(issues.some((issue) => issue.code === "untyped-photometric-calculation")).toBe(false);
    expect(standaloneTechniqueConfigurationBlocker(technique)).toBeNull();
  });
});
