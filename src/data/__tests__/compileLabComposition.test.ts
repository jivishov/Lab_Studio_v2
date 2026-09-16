import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { emptyContents } from "../../domain/types";
import type {
  ActionDefinition,
  LabCompositionSourceDefinition,
  TechniqueDefinition,
} from "../../domain/types";
import { compileLabComposition } from "../compileLabComposition";
import { syntheticComposableTechnique, syntheticCompositionSource } from "../compositionStaticFixtures";

const feedback = { success: "ok", invalid: "no" };

const photometerAction = (
  id: string,
  operation: "zero" | "read",
): ActionDefinition => ({
  id,
  verb: "observe",
  label: `${operation} the photometer`,
  atomId: operation === "zero" ? "atom.observe.blank-photometer" : "atom.observe.read-photometer",
  equipmentRoleBindings: {
    "photometer-instrument": "spectrophotometer",
    "photometer-sample-holder": "cuvette",
  },
  parameters: {
    sourceDefinitionId: "cuvette",
    sourceInstanceId: "source-cuvette",
    targetDefinitionId: "spectrophotometer",
    targetInstanceId: "source-instrument",
    photometerOperation: operation,
    photometerInstanceId: "source-instrument",
    cuvetteInstanceId: "source-cuvette",
    wavelengthMeasurementId: "source-wavelength",
    ...(operation === "zero"
      ? { tag: "instrument-blanked" }
      : {
          requiresZeroNotebookTag: "instrument-blanked",
          measurementId: "source-percent-t",
          photometricQuantity: "percentTransmittance",
          unit: "%T",
        }),
  },
  interaction: {
    type: "readInstrument",
    sourceDefinitionId: "cuvette",
    targetDefinitionId: "spectrophotometer",
    stationId: "spectrophotometer",
    accessibleLabel: `${operation} the photometer.`,
  },
  prerequisites: [],
  stateChanges: [],
  invalidCases: [],
  feedback,
  evidence: [],
});

const tagContractTechnique = (): TechniqueDefinition => {
  const technique = structuredClone(syntheticComposableTechnique());
  technique.id = "tag-contract-technique";
  technique.title = "Tag-contract technique";
  technique.requiredEquipment = ["spectrophotometer", "cuvette"];
  technique.chromatographyModels = undefined;
  technique.initialState = {
    equipment: [
      {
        id: "source-instrument",
        definitionId: "spectrophotometer",
        label: "Source spectrophotometer",
        location: "shelf",
        contents: emptyContents(),
      },
      {
        id: "source-cuvette",
        definitionId: "cuvette",
        label: "Source cuvette",
        location: "shelf",
        contents: emptyContents(),
      },
    ],
  };
  technique.actions = [photometerAction("zero-photometer", "zero"), photometerAction("read-photometer", "read")];
  technique.process = {
    startNodeId: "zero-node",
    nodes: technique.actions.map((action) => ({
      id: action.id === "zero-photometer" ? "zero-node" : "read-node",
      type: "action",
      title: action.label,
      description: action.label,
      actionId: action.id,
      config: {},
      validation: [],
      hints: [],
      feedback: { success: "ok", retry: "again" },
    })),
    edges: [{
      from: "zero-node",
      to: "read-node",
      label: "Continue",
      condition: { type: "validationPassed" },
    }],
  };
  technique.composition = {
    schemaVersion: 1,
    ports: [
      { id: "entry", kind: "entry", nodeId: "zero-node", label: "Entry" },
      { id: "exit", kind: "exit", nodeId: "read-node", label: "Exit" },
    ],
    equipmentRoles: [
      {
        roleId: "photometer-instrument",
        required: true,
        allowedDefinitionIds: ["spectrophotometer"],
        sourceInstanceIds: ["source-instrument"],
      },
      {
        roleId: "photometer-sample-holder",
        required: true,
        allowedDefinitionIds: ["cuvette"],
        sourceInstanceIds: ["source-cuvette"],
      },
    ],
    modelSlots: [],
    configurationSlots: [],
    approvalGates: [],
    variants: [],
    evidenceOutputs: [],
    completion: {
      exitPortIds: ["exit"],
      requiredEvidenceOutputIds: [],
      requiredValidationRuleIds: [],
    },
    catalogDisposition: "composable",
  };
  return technique;
};

const tagContractSource = (): LabCompositionSourceDefinition => {
  const source = structuredClone(syntheticCompositionSource(["repeated", "independent"]));
  source.id = "tag-contract-lab";
  source.equipment = ["spectrophotometer", "cuvette"];
  source.chromatographyModels = undefined;
  source.initialState = {
    equipment: [
      {
        id: "lab-instrument",
        definitionId: "spectrophotometer",
        label: "Lab spectrophotometer",
        location: "workbench",
        contents: emptyContents(),
      },
      {
        id: "lab-cuvette",
        definitionId: "cuvette",
        label: "Lab cuvette",
        location: "workbench",
        contents: emptyContents(),
      },
    ],
  };
  source.techniqueInstances = [
    {
      instanceId: "repeated",
      techniqueId: "tag-contract-technique",
      version: "1.0.0",
      repeat: 2,
      bindings: {
        equipment: {
          "photometer-instrument": { definitionId: "spectrophotometer", instanceId: "lab-instrument" },
          "photometer-sample-holder": { definitionId: "cuvette", instanceId: "lab-cuvette" },
        },
        models: {},
        configuration: {},
      },
    },
    {
      instanceId: "independent",
      techniqueId: "tag-contract-technique",
      version: "1.0.0",
      bindings: {
        equipment: {
          "photometer-instrument": { definitionId: "spectrophotometer", instanceId: "lab-instrument" },
          "photometer-sample-holder": { definitionId: "cuvette", instanceId: "lab-cuvette" },
        },
        models: {},
        configuration: {},
      },
    },
  ];
  source.compositionConnections = [
    {
      from: { kind: "lab-node", nodeId: "lab-entry" },
      to: { kind: "technique-port", instanceId: "repeated", repeatIndex: 0, portId: "entry" },
      label: "Start",
    },
    {
      from: { kind: "technique-port", instanceId: "repeated", repeatIndex: 0, portId: "exit" },
      to: { kind: "technique-port", instanceId: "repeated", repeatIndex: 1, portId: "entry" },
      label: "Repeat",
    },
    {
      from: { kind: "technique-port", instanceId: "repeated", repeatIndex: 1, portId: "exit" },
      to: { kind: "technique-port", instanceId: "independent", portId: "entry" },
      label: "Continue",
    },
  ];
  return source;
};

describe("compileLabComposition notebook-tag namespace", () => {
  it("keeps zero producers and readers paired within repeated and independent instances", async () => {
    const technique = tagContractTechnique();
    const compiled = await compileLabComposition(
      tagContractSource(),
      async (id) => {
        expect(id).toBe(technique.id);
        return structuredClone(technique);
      },
    );

    const zeroTags = compiled.actions
      .filter((action) => action.parameters.photometerOperation === "zero")
      .map((action) => action.parameters.tag);
    const requiredZeroTags = compiled.actions
      .filter((action) => action.parameters.photometerOperation === "read")
      .map((action) => action.parameters.requiresZeroNotebookTag);

    expect(zeroTags).toEqual([
      "repeated--1--instrument-blanked",
      "repeated--2--instrument-blanked",
      "independent--instrument-blanked",
    ]);
    expect(requiredZeroTags).toEqual(zeroTags);
    expect(new Set(zeroTags).size).toBe(3);
    expect(zeroTags).not.toContain("instrument-blanked");
  });

  // A technique step may depend on evidence the *lab* writes -- a procedure the teacher approved
  // once, before any instance runs. That tag has no instance to be scoped to, so unless the
  // instance preserves it the prerequisite compiles to a scoped identifier nothing in the lab
  // writes: a gate no learner can satisfy. Both halves are asserted here, because the failure is
  // invisible in the technique file and in the lab file read separately.
  it("preserves a declared lab-level reference and scopes an undeclared one", async () => {
    const technique = tagContractTechnique();
    technique.actions[0].prerequisites = [{
      id: "zero-photometer--procedure-approved-required",
      type: "notebookEntry",
      label: "The teacher approved the written procedure.",
      notebookTag: "procedure-approved",
    }];

    const source = tagContractSource();
    const independent = source.techniqueInstances.find((instance) => instance.instanceId === "independent");
    if (!independent) throw new Error("Expected the independent instance.");
    independent.preserveIds = { references: { "procedure-approved": "procedure-approved" } };

    const compiled = await compileLabComposition(source, async () => structuredClone(technique));
    const required = compiled.actions
      .filter((action) => action.parameters.photometerOperation === "zero")
      .map((action) => action.prerequisites[0]?.notebookTag);

    expect(required).toEqual([
      "repeated--1--procedure-approved",
      "repeated--2--procedure-approved",
      "procedure-approved",
    ]);
  });

  // The synthetic case above proves the compiler's reference-preservation behaviour on a fixture.
  // It cannot prove that the shipped lab and the shipped technique agree, because the declaration
  // that makes them agree lives in the lab file and the prerequisites live in the technique file.
  // This case compiles the actual paper-chromatography lab against the actual technique it pins and
  // inspects the two bindings this repair changes.
  //
  // Scope, stated so a green run is not over-read: this asserts compiled *identifiers*. It runs no
  // reducer, seeds no state, and therefore says nothing about whether a learner can reach any of
  // these steps. Runtime behaviour is covered by `src/runtime/__tests__/runtime.test.ts` and, for
  // the develop/mark/dry physical chain, by `src/runtime/__tests__/cycle10Separation.test.ts`.
  it("compiles the shipped paper-chromatography lab with agreeing approval and per-trial dry tags", async () => {
    const readPublic = (...segments: string[]): unknown =>
      JSON.parse(readFileSync(join(process.cwd(), "public", ...segments), "utf8")) as unknown;
    const labSource = readPublic("labs", "paper-chromatography.json") as LabCompositionSourceDefinition;
    const technique = readPublic("techniques", "paper-chromatography.json") as TechniqueDefinition;

    const resolved: string[] = [];
    const compiled = await compileLabComposition(labSource, async (techniqueId) => {
      resolved.push(techniqueId);
      if (techniqueId !== technique.id) throw new Error(`Unexpected technique request ${techniqueId}`);
      return structuredClone(technique);
    });
    expect(resolved).toEqual(["paper-chromatography"]);

    const instanceId = labSource.techniqueInstances[0]?.instanceId;
    expect(instanceId).toBe("chromatography-trials");

    // 1. The approval the trials wait on is written by the lab and read, unscoped, by the technique.
    const approvalProducers = compiled.actions.filter((action) => action.parameters.tag === "procedure-approved");
    expect(approvalProducers.map((action) => action.id)).toEqual(["submit-procedure-approval"]);

    const approvalConsumers = compiled.actions.filter((action) =>
      action.prerequisites.some((rule) => rule.notebookTag === "procedure-approved"),
    );
    const techniqueApprovalConsumers = technique.actions.filter((action) =>
      action.prerequisites.some((rule) => rule.notebookTag === "procedure-approved"),
    );
    expect(approvalConsumers).toHaveLength(techniqueApprovalConsumers.length);
    expect(approvalConsumers.map((action) => action.id)).toEqual(
      techniqueApprovalConsumers.map((action) => `${instanceId}--${action.id}`),
    );
    // No consumer is left asking for a scoped copy nothing writes.
    for (const action of compiled.actions) {
      for (const rule of action.prerequisites) {
        expect(rule.notebookTag, `${action.id}/${rule.id}`).not.toBe(`${instanceId}--procedure-approved`);
      }
    }

    // 2. The dry evidence stays scoped to the instance *and* to the trial. Producers and consumers
    //    are collected by role and joined on the compiled paper instance, never on the tag text.
    const dryProducers = new Map<string, string>();
    for (const action of compiled.actions) {
      if (action.parameters.chromatographyOperation !== "dryDevelopedPaper") continue;
      const paperInstanceId = String(action.parameters.sourceInstanceId);
      expect(dryProducers.has(paperInstanceId), paperInstanceId).toBe(false);
      dryProducers.set(paperInstanceId, String(action.parameters.tag));
    }
    expect(dryProducers.size).toBe(
      technique.actions.filter((action) => action.parameters.chromatographyOperation === "dryDevelopedPaper").length,
    );
    expect(new Set(dryProducers.values()).size).toBe(dryProducers.size);
    for (const [paperInstanceId, tag] of dryProducers) {
      expect(tag, paperInstanceId).toBe(`${instanceId}--${paperInstanceId.replace(/-paper$/, "")}-chromatogram-dry`);
    }

    // A consumer is anything whose role is to read a dried chromatogram: the ruler readings, and
    // the band identification that precedes them. Both are identified without consulting a tag.
    const dryConsumers = compiled.actions.filter((action) =>
      action.atomId === "atom.observe.measure-chromatography-distance" ||
      action.parameters.overlapPolicy !== undefined,
    );
    expect(dryConsumers.length).toBeGreaterThan(dryProducers.size);
    for (const action of dryConsumers) {
      const expectedTag = dryProducers.get(String(action.parameters.sourceInstanceId));
      expect(expectedTag, action.id).toBeDefined();
      const dryRules = action.prerequisites.filter((rule) => rule.notebookTag === expectedTag);
      expect(dryRules, action.id).toHaveLength(1);
    }

    // 3. Every compiled node rule that validates a drying step names that step's own tag. Only two
    //    of the drying nodes carry such a rule today; the count is asserted as "at least one" so
    //    this stays a correctness check rather than a census of the authored content.
    const compiledById = new Map(compiled.actions.map((action) => [action.id, action]));
    let checkedDryNodeRules = 0;
    for (const node of compiled.process.nodes) {
      const producer = node.actionId === undefined ? undefined : compiledById.get(node.actionId);
      if (!producer || producer.parameters.chromatographyOperation !== "dryDevelopedPaper") continue;
      for (const rule of node.validation) {
        if (rule.type !== "notebookEntry") continue;
        checkedDryNodeRules += 1;
        expect(rule.notebookTag, `${node.id}/${rule.id}`).toBe(producer.parameters.tag);
      }
    }
    expect(checkedDryNodeRules).toBeGreaterThan(0);

    // 4. Only the declared reference is preserved: unrelated technique tags are still scoped, so
    //    the one added entry did not open the namespace.
    const frontMarked = compiled.actions.filter((action) =>
      String(action.parameters.tag ?? "").endsWith("-front-marked"),
    );
    expect(frontMarked.length).toBeGreaterThan(0);
    for (const action of frontMarked) {
      expect(String(action.parameters.tag), action.id).toMatch(new RegExp(`^${instanceId}--`));
    }
  });
});
