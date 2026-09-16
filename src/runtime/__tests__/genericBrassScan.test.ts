/**
 * F05C — generic AP Chemistry brass wavelength-scan method.
 *
 * Authored, not executed under the F05C source/static-only boundary. The runtime cases below use
 * a deliberately small owner-action fixture so the shared photometer handler can be reviewed in
 * isolation. They are not a full Brass procedure traversal. The generated-graph cases inspect the
 * shipped Brass technique's real action ids, reachability edges, atom identities, and composition
 * role bindings without creating a whole-catalog baseline.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { emptyContents } from "../../domain/types";
import type {
  ActionDefinition,
  ContentState,
  ProcessNode,
  RuntimeState,
  TechniqueDefinition,
} from "../../domain/types";
import { createRuntimeState, performRuntimeAction } from "../index";

type BrassLabOwnerFixture = {
  actions: ActionDefinition[];
  process: {
    nodes: ProcessNode[];
    edges: Array<{ from: string; to: string; label: string; condition: { type: string } }>;
  };
  techniqueInstances: Array<{
    techniqueId: string;
    bindings: { configuration?: Record<string, unknown> };
  }>;
  compositionConnections?: Array<{
    id: string;
    from: Record<string, string>;
    to: Record<string, string>;
  }>;
};

const loadBrassTechnique = (): TechniqueDefinition =>
  JSON.parse(
    readFileSync(join(process.cwd(), "public", "techniques", "brass-spectrophotometry.json"), "utf8"),
  ) as TechniqueDefinition;

const loadBrassLab = (): BrassLabOwnerFixture =>
  JSON.parse(
    readFileSync(join(process.cwd(), "public", "labs", "brass-colorimetry.json"), "utf8"),
  ) as BrassLabOwnerFixture;

const content = (
  label: string,
  kind: ContentState["kind"] = "solution",
  volumeMl = 3,
): ContentState => ({
  ...emptyContents(label),
  kind,
  label,
  volumeMl,
  wetState: kind === "empty" ? "dry" : "wet",
  visualState: kind === "empty" ? "empty" : "clear-liquid",
});

const node = (actionId: string): ProcessNode => ({
  id: `${actionId}-node`,
  type: "action",
  title: actionId,
  description: actionId,
  actionId,
  config: {},
  validation: [],
  hints: [],
  feedback: { success: "ok", retry: "again" },
});

const action = (
  id: string,
  verb: ActionDefinition["verb"],
  parameters: ActionDefinition["parameters"],
  interaction?: ActionDefinition["interaction"],
): ActionDefinition => ({
  id,
  verb,
  label: id,
  parameters,
  prerequisites: [],
  stateChanges: [],
  invalidCases: [],
  feedback: { success: "ok", invalid: "no" },
  evidence: ["f05c"],
  interaction,
});

const genericReadParameters = (instrumentInstanceId: string, cuvetteInstanceId: string, measurementId: string, wavelengthMeasurementId: string) => ({
  photometerOperation: "read",
  photometricQuantity: "absorbance",
  photometerCalibrationMethod: "distilled-water-per-wavelength",
  photometerInstanceId: instrumentInstanceId,
  photometerDefinitionId: "spectrophotometer",
  wavelengthMeasurementId,
  cuvetteInstanceId,
  measurementId,
});

const selectedReadParameters = (instrumentInstanceId: string, cuvetteInstanceId: string, measurementId: string, wavelengthMeasurementId: string) => ({
  ...genericReadParameters(instrumentInstanceId, cuvetteInstanceId, measurementId, wavelengthMeasurementId),
  photometerCalibrationMethod: "selected-wavelength-pair",
  requiresZeroNotebookTag: "fx-legacy-blanked-420",
});

/** Isolated handler fixture; no claim of full Brass traversal is made here. */
const scanFixture = (blankContents = content("Distilled water")): TechniqueDefinition => {
  const actions: ActionDefinition[] = [
    action("fx-set-400", "observe", {
      photometerInstanceId: "fx-spec",
      photometerConfigurationMode: "wavelength-scan",
      configurationQuantity: "scan wavelength",
      configuredValue: 400,
      measurementId: "fx-wavelength-400",
      unit: "nm",
    }),
    action("fx-set-420", "observe", {
      photometerInstanceId: "fx-spec",
      photometerConfigurationMode: "wavelength-scan",
      configurationQuantity: "scan wavelength",
      configuredValue: 420,
      measurementId: "fx-wavelength-420",
      unit: "nm",
    }),
    action("fx-propose-selected-420", "observe", {
      photometerProposalMode: "selected-wavelength",
      photometerInstanceId: "fx-spec",
      inputMode: "numeric",
      measurementId: "fx-proposed-wavelength-420",
      unit: "nm",
    }),
    action("fx-approve-selected-420", "observe", {
      photometerApprovalMode: "selected-wavelength",
      photometerInstanceId: "fx-spec",
      proposalMeasurementId: "fx-proposed-wavelength-420",
      inputMode: "choice",
      inputOptions: ["Teacher approved wavelength"],
      tag: "fx-teacher-approved-420",
    }),
    action("fx-configure-selected-420", "observe", {
      photometerConfigurationMode: "approved-selected-wavelength",
      photometerInstanceId: "fx-spec",
      configurationQuantity: "approved wavelength",
      approvedWavelengthMeasurementId: "fx-proposed-wavelength-420",
      measurementId: "fx-configured-wavelength",
      unit: "nm",
    }),
    action("fx-insert-blank", "place", {
      equipmentDefinitionId: "cuvette",
      equipmentInstanceId: "fx-blank",
      targetInstanceId: "fx-spec",
      snapZoneId: "spectrophotometer-cuvette-slot",
    }, {
      type: "snapIntoTarget",
      sourceDefinitionId: "cuvette",
      targetDefinitionId: "spectrophotometer",
      snapZoneId: "spectrophotometer-cuvette-slot",
      accessibleLabel: "Insert the distilled-water blank.",
    }),
    action("fx-blank-400", "observe", {
      photometerOperation: "zero",
      photometerCalibrationMethod: "distilled-water-per-wavelength",
      photometerInstanceId: "fx-spec",
      cuvetteInstanceId: "fx-blank",
      wavelengthMeasurementId: "fx-wavelength-400",
      tag: "fx-blanked-400",
    }, {
      type: "readInstrument",
      sourceDefinitionId: "spectrophotometer",
      accessibleLabel: "Blank at 400 nm.",
    }),
    action("fx-blank-420", "observe", {
      photometerOperation: "zero",
      photometerCalibrationMethod: "distilled-water-per-wavelength",
      photometerInstanceId: "fx-spec",
      cuvetteInstanceId: "fx-blank",
      wavelengthMeasurementId: "fx-wavelength-420",
      tag: "fx-blanked-420-generic",
    }, {
      type: "readInstrument",
      sourceDefinitionId: "spectrophotometer",
      accessibleLabel: "Blank at 420 nm using the generic scan method.",
    }),
    action("fx-remove-blank", "place", {
      equipmentDefinitionId: "cuvette",
      equipmentInstanceId: "fx-blank",
    }, {
      type: "dragToZone",
      sourceDefinitionId: "spectrophotometer",
      stationId: "workbench",
      accessibleLabel: "Remove the blank.",
    }),
    action("fx-insert-a", "place", {
      equipmentDefinitionId: "cuvette",
      equipmentInstanceId: "fx-a",
      targetInstanceId: "fx-spec",
      snapZoneId: "spectrophotometer-cuvette-slot",
    }, {
      type: "snapIntoTarget",
      sourceDefinitionId: "cuvette",
      targetDefinitionId: "spectrophotometer",
      snapZoneId: "spectrophotometer-cuvette-slot",
      accessibleLabel: "Insert assigned salt A.",
    }),
    action("fx-read-a", "observe", genericReadParameters("fx-spec", "fx-a", "fx-a-absorbance", "fx-wavelength-400"), {
      type: "readInstrument",
      sourceDefinitionId: "spectrophotometer",
      accessibleLabel: "Read assigned salt A.",
    }),
    action("fx-remove-a", "place", {
      equipmentDefinitionId: "cuvette",
      equipmentInstanceId: "fx-a",
    }, {
      type: "dragToZone",
      sourceDefinitionId: "spectrophotometer",
      stationId: "workbench",
      accessibleLabel: "Remove assigned salt A.",
    }),
    action("fx-remove-b", "place", {
      equipmentDefinitionId: "cuvette",
      equipmentInstanceId: "fx-b",
    }, {
      type: "dragToZone",
      sourceDefinitionId: "spectrophotometer",
      stationId: "workbench",
      accessibleLabel: "Remove assigned salt B.",
    }),
    action("fx-insert-b", "place", {
      equipmentDefinitionId: "cuvette",
      equipmentInstanceId: "fx-b",
      targetInstanceId: "fx-spec",
      snapZoneId: "spectrophotometer-cuvette-slot",
    }, {
      type: "snapIntoTarget",
      sourceDefinitionId: "cuvette",
      targetDefinitionId: "spectrophotometer",
      snapZoneId: "spectrophotometer-cuvette-slot",
      accessibleLabel: "Insert assigned salt B.",
    }),
    action("fx-read-b", "observe", genericReadParameters("fx-spec", "fx-b", "fx-b-absorbance", "fx-wavelength-400"), {
      type: "readInstrument",
      sourceDefinitionId: "spectrophotometer",
      accessibleLabel: "Read assigned salt B.",
    }),
    action("fx-insert-other", "place", {
      equipmentDefinitionId: "cuvette",
      equipmentInstanceId: "fx-other-sample",
      targetInstanceId: "fx-other-spec",
      snapZoneId: "spectrophotometer-cuvette-slot",
    }, {
      type: "snapIntoTarget",
      sourceDefinitionId: "cuvette",
      targetDefinitionId: "spectrophotometer",
      snapZoneId: "spectrophotometer-cuvette-slot",
      accessibleLabel: "Insert the other instrument sample.",
    }),
    action("fx-read-other", "observe", genericReadParameters("fx-other-spec", "fx-other-sample", "fx-other-absorbance", "fx-wavelength-400"), {
      type: "readInstrument",
      sourceDefinitionId: "spectrophotometer",
      accessibleLabel: "Read the other instrument.",
    }),
    action("fx-read-b-at-420", "observe", genericReadParameters("fx-spec", "fx-b", "fx-b-420-absorbance", "fx-wavelength-420"), {
      type: "readInstrument",
      sourceDefinitionId: "spectrophotometer",
      accessibleLabel: "Read assigned salt B at 420 nm.",
    }),
    action("fx-dark-zero", "observe", {
      photometerOperation: "darkZero",
      photometerCalibrationMethod: "selected-wavelength-pair",
      photometerInstanceId: "fx-spec",
      wavelengthMeasurementId: "fx-configured-wavelength",
      tag: "fx-dark-zero-420",
    }, {
      type: "readInstrument",
      sourceDefinitionId: "spectrophotometer",
      accessibleLabel: "Set 0% transmittance.",
    }),
    action("fx-legacy-zero", "observe", {
      photometerOperation: "zero",
      photometerCalibrationMethod: "selected-wavelength-pair",
      photometerInstanceId: "fx-spec",
      cuvetteInstanceId: "fx-blank",
      wavelengthMeasurementId: "fx-configured-wavelength",
      requiresDarkZeroNotebookTag: "fx-dark-zero-420",
      tag: "fx-legacy-blanked-420",
    }, {
      type: "readInstrument",
      sourceDefinitionId: "spectrophotometer",
      accessibleLabel: "Set 100% transmittance.",
    }),
    action("fx-selected-read", "observe", selectedReadParameters("fx-spec", "fx-b", "fx-selected-absorbance", "fx-configured-wavelength"), {
      type: "readInstrument",
      sourceDefinitionId: "spectrophotometer",
      accessibleLabel: "Read the selected-wavelength sample.",
    }),
  ];
  const edges = actions.slice(1).map((entry, index) => ({
    from: `${actions[index].id}-node`,
    to: `${entry.id}-node`,
    label: "Next",
    condition: { type: "validationPassed" as const },
  }));
  return {
    id: "fx-generic-brass-scan",
    title: "Generic Brass Scan Fixture",
    learningGoal: "Exercise the bounded per-wavelength blank contract.",
    requiredEquipment: ["spectrophotometer", "cuvette"],
    initialState: {
      equipment: [
        {
          id: "fx-spec",
          definitionId: "spectrophotometer",
          label: "Fixture spectrophotometer",
          location: "workbench",
          contents: emptyContents(),
        },
        {
          id: "fx-blank",
          definitionId: "cuvette",
          label: "Fixture distilled-water blank",
          location: "workbench",
          contents: blankContents,
        },
        {
          id: "fx-other-spec",
          definitionId: "spectrophotometer",
          label: "Other fixture spectrophotometer",
          location: "workbench",
          contents: emptyContents(),
        },
        {
          id: "fx-a",
          definitionId: "cuvette",
          label: "Fixture assigned salt A",
          location: "workbench",
          contents: content("Assigned salt A"),
        },
        {
          id: "fx-b",
          definitionId: "cuvette",
          label: "Fixture assigned salt B",
          location: "workbench",
          contents: content("Assigned salt B"),
        },
        {
          id: "fx-other-sample",
          definitionId: "cuvette",
          label: "Other instrument sample",
          location: "workbench",
          contents: content("Other assigned sample"),
        },
      ],
    },
    actions,
    process: {
      startNodeId: "fx-set-400-node",
      nodes: actions.map((entry) => node(entry.id)),
      edges,
    },
    successCriteria: [],
    commonMistakes: [],
    resetBehavior: "resetTechnique",
    metadata: { version: "1.0.0", author: "F05C", updatedAt: "2026-09-09T00:00:00.000Z", tags: ["photometry"] },
  };
};

const at = (definition: TechniqueDefinition, state: RuntimeState, actionId: string): RuntimeState => {
  const target = definition.process.nodes.find((candidate) => candidate.actionId === actionId);
  if (!target) throw new Error(`Missing fixture node for ${actionId}`);
  return {
    ...state,
    currentNodeId: target.id,
    // This fixture selects one handler at a time; reopen only that selected node so a prior
    // successful invocation cannot mask the calibration behavior under examination.
    completedNodes: state.completedNodes.filter((nodeId) => nodeId !== target.id),
  };
};

const run = (
  definition: TechniqueDefinition,
  state: RuntimeState,
  actionId: string,
  value?: number,
  note?: string,
): RuntimeState => {
  const actionDefinition = definition.actions.find((candidate) => candidate.id === actionId);
  if (!actionDefinition) throw new Error(`Missing fixture action ${actionId}`);
  return performRuntimeAction(definition, at(definition, state, actionId), {
    actionId,
    verb: actionDefinition.verb,
    ...(value === undefined ? {} : { value }),
    ...(note === undefined ? {} : { note }),
  });
};

const lastMessage = (state: RuntimeState): string => state.feedbackQueue.at(-1)?.message ?? "";

const configuredAndBlankedAt400 = (definition: TechniqueDefinition): RuntimeState => {
  let state = createRuntimeState(definition);
  state = run(definition, state, "fx-set-400");
  state = run(definition, state, "fx-insert-blank");
  state = run(definition, state, "fx-blank-400");
  return state;
};

describe("F05C generated Brass scan graph", () => {
  it("contains the selected generic method without changing the later AP technique contract", () => {
    const definition = loadBrassTechnique();
    const actions = new Map(definition.actions.map((entry) => [entry.id, entry]));
    const nodes = new Map(definition.process.nodes.map((entry) => [entry.actionId, entry]));
    const edges = new Set(definition.process.edges.map((edge) => `${edge.from}->${edge.to}`));
    expect(definition.metadata.version).toBe("2.0.0");
    expect(definition.actions).toHaveLength(314);
    expect(definition.process.nodes).toHaveLength(314);
    expect(actions.get("scan-prepare-distilled-water-blank-action")).toBeDefined();
    expect(definition.initialState.equipment.some((entry) => entry.id === "scan-blank-cuvette")).toBe(true);
    expect(actions.get("calibrate-zero-percent-t-action")?.parameters.photometerOperation).toBe("darkZero");
    expect(actions.get("calibrate-hundred-percent-t-action")?.parameters.photometerOperation).toBe("zero");
    expect(actions.get("calibrate-zero-percent-t-action")?.parameters.photometerCalibrationMethod).toBe("selected-wavelength-pair");
    expect(actions.get("calibrate-hundred-percent-t-action")?.parameters.photometerCalibrationMethod).toBe("selected-wavelength-pair");
    for (const actionId of [
      "read-unknown-absorbance-action",
      "read-0p0250-absorbance-action",
      "read-0p0500-absorbance-action",
      "read-0p100-absorbance-action",
      "read-0p200-absorbance-action",
      "read-0p400-absorbance-action",
    ]) {
      expect(actions.get(actionId)?.parameters.photometerCalibrationMethod).toBe("selected-wavelength-pair");
    }
    const sampleHolderRole = definition.composition?.equipmentRoles.find((role) => role.roleId === "photometer-sample-holder");
    expect(sampleHolderRole?.sourceInstanceIds).toContain("scan-blank-cuvette");

    for (const wavelength of Array.from({ length: 16 }, (_, index) => 400 + index * 20)) {
      const setId = `scan-set-${wavelength}-action`;
      const insertId = `scan-insert-${wavelength}-blank-action`;
      const blankId = `scan-blank-${wavelength}-action`;
      const removeId = `scan-remove-${wavelength}-blank-action`;
      expect(actions.get(setId)?.parameters.photometerConfigurationMode).toBe("wavelength-scan");
      expect(actions.get(blankId)?.parameters.photometerCalibrationMethod).toBe("distilled-water-per-wavelength");
      expect(actions.get(`scan-read-${wavelength}-salt-a-action`)?.parameters.photometerCalibrationMethod).toBe("distilled-water-per-wavelength");
      expect(actions.get(`scan-read-${wavelength}-salt-b-action`)?.parameters.photometerCalibrationMethod).toBe("distilled-water-per-wavelength");
      expect(nodes.get(insertId)?.actionId).toBe(insertId);
      expect(nodes.get(blankId)?.actionId).toBe(blankId);
      expect(nodes.get(removeId)?.actionId).toBe(removeId);
      expect(edges.has(`${nodes.get(setId)?.id}->${nodes.get(insertId)?.id}`)).toBe(true);
      expect(edges.has(`${nodes.get(insertId)?.id}->${nodes.get(blankId)?.id}`)).toBe(true);
      expect(edges.has(`${nodes.get(blankId)?.id}->${nodes.get(removeId)?.id}`)).toBe(true);
      expect(edges.has(`${nodes.get(removeId)?.id}->${nodes.get(`scan-insert-${wavelength}-salt-a-action`)?.id}`)).toBe(true);
    }

    expect(actions.get("scan-insert-400-blank-action")?.atomId).toBe("atom.place.insert-cuvette");
    expect(actions.get("scan-blank-400-action")?.atomId).toBe("atom.observe.blank-photometer");
    expect(actions.get("scan-remove-400-blank-action")?.atomId).toBe("atom.place.remove-cuvette");
    expect(actions.get("scan-blank-400-action")?.equipmentRoleBindings?.["photometer-instrument"]).toBe("spectrophotometer");
  });
});

describe("F05C real Brass owner wavelength contract", () => {
  it("keeps proposal evidence separate from canonical instrument configuration", () => {
    const lab = loadBrassLab();
    const technique = loadBrassTechnique();
    const actions = new Map(lab.actions.map((entry) => [entry.id, entry]));
    const techniqueActions = new Map(technique.actions.map((entry) => [entry.id, entry]));
    const proposal = actions.get("approved-wavelength-nm-action");
    const configure = techniqueActions.get("configure-approved-wavelength-action");
    expect(proposal?.parameters.photometerProposalMode).toBe("selected-wavelength");
    expect(proposal?.parameters.photometerInstanceId).toBe("spectrophotometer");
    expect(proposal?.parameters.measurementId).toBe("brass-spectrophotometry--approved-wavelength-nm");
    expect(configure?.atomId).toBe("atom.observe.set-active-photometer-wavelength");
    expect(configure?.equipmentRoleBindings).toEqual({ "photometer-instrument": "spectrophotometer" });
    expect(configure?.parameters.photometerConfigurationMode).toBe("approved-selected-wavelength");
    expect(configure?.parameters.photometricMode).toBe("absorbance");
    expect(configure?.parameters.measurementId).toBe("brass-spectrophotometry--configured-wavelength-nm");
    expect(configure?.interaction).toMatchObject({
      type: "readInstrument",
      sourceDefinitionId: "spectrophotometer",
      stationId: "spectrophotometer",
    });
    expect(lab.process.nodes.find((node) => node.id === "configure-approved-wavelength")).toBeUndefined();
    expect(technique.process.nodes.find((node) => node.id === "configure-approved-wavelength")).toMatchObject({
      type: "observation",
      actionId: "configure-approved-wavelength-action",
    });
    expect(lab.compositionConnections).toContainEqual({
      id: "brass-cross-3",
      from: { kind: "lab-node", nodeId: "teacher-wavelength-approval" },
      to: {
        kind: "technique-port",
        instanceId: "brass-spectrophotometry",
        portId: "entry-configure-approved-wavelength",
      },
      label: "Continue after required evidence",
      condition: { type: "validationPassed" },
    });
    expect(lab.techniqueInstances.find((instance) => instance.techniqueId === "brass-spectrophotometry")?.bindings.configuration)
      .toMatchObject({ wavelengthMeasurementId: "brass-spectrophotometry--configured-wavelength-nm" });
  });
});

describe("F05C shared generic photometer calibration handler", () => {
  it("rejects an initial generic read before a valid blank", () => {
    const definition = scanFixture();
    let state = run(definition, createRuntimeState(definition), "fx-set-400");
    state = run(definition, state, "fx-insert-a");
    state = run(definition, state, "fx-read-a", 0.24);
    expect(lastMessage(state)).toMatch(/not been blanked/i);
    expect(state.measurements.some((entry) => entry.id === "fx-a-absorbance")).toBe(false);
  });

  it("keeps one valid blank usable for both same-wavelength samples", () => {
    const definition = scanFixture();
    let state = configuredAndBlankedAt400(definition);
    state = run(definition, state, "fx-remove-blank");
    state = run(definition, state, "fx-insert-a");
    state = run(definition, state, "fx-read-a", 0.24);
    state = run(definition, state, "fx-remove-a");
    state = run(definition, state, "fx-insert-b");
    state = run(definition, state, "fx-read-b", 0.41);
    expect(state.measurements.find((entry) => entry.id === "fx-a-absorbance")?.value).toBe(0.24);
    expect(state.measurements.find((entry) => entry.id === "fx-b-absorbance")?.value).toBe(0.41);
    expect(state.photometerCalibration?.["fx-spec"]).toMatchObject({ configuredWavelengthNm: 400, blankedWavelengthNm: 400 });
  });

  it("invalidates on a wavelength change and does not revive when returning", () => {
    const definition = scanFixture();
    let state = configuredAndBlankedAt400(definition);
    state = run(definition, state, "fx-set-420");
    expect(state.photometerCalibration?.["fx-spec"]).toMatchObject({ configuredWavelengthNm: 420 });
    state = run(definition, state, "fx-blank-400");
    expect(lastMessage(state)).toMatch(/not configured at this scan wavelength/i);
    state = run(definition, state, "fx-set-400");
    expect(state.photometerCalibration?.["fx-spec"]).toMatchObject({ configuredWavelengthNm: 400 });
    state = run(definition, state, "fx-remove-blank");
    state = run(definition, state, "fx-insert-b");
    state = run(definition, state, "fx-read-b", 0.41);
    expect(lastMessage(state)).toMatch(/not been blanked/i);
    expect(state.measurements.some((entry) => entry.id === "fx-b-absorbance")).toBe(false);
  });

  it("isolates calibration by photometer identity and clears it on physical reset", () => {
    const definition = scanFixture();
    let state = configuredAndBlankedAt400(definition);
    const calibrated = state.photometerCalibration?.["fx-spec"];
    expect(calibrated?.epoch).toBe(state.photometerCalibrationEpoch);
    state = run(definition, state, "fx-remove-blank");
    state = run(definition, state, "fx-insert-other");
    state = run(definition, state, "fx-read-other", 0.31);
    expect(lastMessage(state)).toMatch(/not been blanked/i);
    expect(state.measurements.some((entry) => entry.id === "fx-other-absorbance")).toBe(false);
    const reset = performRuntimeAction(definition, state, { verb: "reset", parameters: { scope: "physical" } });
    expect(reset.photometerCalibration).toEqual({});
    expect(reset.photometerCalibrationEpoch).toBeGreaterThan(state.photometerCalibrationEpoch ?? 0);
  });

  it.each([
    ["wrong liquid", content("Tap water"), /generic scan blank must be clean distilled water/i],
    ["empty cuvette", content("empty", "empty", 0), /is empty/i],
    ["sample-filled cuvette", content("Assigned salt A"), /generic scan blank must be clean distilled water/i],
  ])("does not grant readiness for a %s blank", (_label, blankContents, expectedMessage) => {
    const definition = scanFixture(blankContents);
    let state = run(definition, createRuntimeState(definition), "fx-set-400");
    state = run(definition, state, "fx-insert-blank");
    state = run(definition, state, "fx-blank-400");
    expect(state.photometerCalibration?.["fx-spec"]).toMatchObject({
      configuredWavelengthNm: 400,
      configurationMode: "wavelength-scan",
    });
    expect(state.photometerCalibration?.["fx-spec"]?.blankedWavelengthNm).toBeUndefined();
    expect(lastMessage(state)).toMatch(expectedMessage);
  });

  it("keeps proposal and teacher approval distinct from the actual setting", () => {
    const definition = scanFixture();
    let state = run(definition, createRuntimeState(definition), "fx-propose-selected-420", 420);
    expect(state.photometerCalibration?.["fx-spec"]).toMatchObject({ proposedWavelengthNm: 420 });
    expect(state.photometerCalibration?.["fx-spec"]?.configuredWavelengthNm).toBeUndefined();
    state = run(definition, state, "fx-approve-selected-420", undefined, "Teacher approved wavelength");
    expect(state.photometerCalibration?.["fx-spec"]).toMatchObject({
      proposedWavelengthNm: 420,
      approvedWavelengthNm: 420,
    });
    expect(state.photometerCalibration?.["fx-spec"]?.configuredWavelengthNm).toBeUndefined();
    state = run(definition, state, "fx-configure-selected-420");
    expect(state.photometerCalibration?.["fx-spec"]).toMatchObject({
      approvedWavelengthNm: 420,
      configuredWavelengthNm: 420,
      configurationMode: "approved-selected-wavelength",
      configurationGeneration: 1,
    });
  });

  it("preserves the later selected-wavelength dark-zero then 100%T order", () => {
    const definition = scanFixture();
    let state = run(definition, createRuntimeState(definition), "fx-propose-selected-420", 420);
    state = run(definition, state, "fx-approve-selected-420", undefined, "Teacher approved wavelength");
    state = run(definition, state, "fx-configure-selected-420");
    state = run(definition, state, "fx-dark-zero");
    expect(state.notebook.at(-1)?.tags).toContain("fx-dark-zero-420");
    state = run(definition, state, "fx-insert-blank");
    state = run(definition, state, "fx-legacy-zero");
    expect(state.notebook.at(-1)?.tags).toContain("fx-legacy-blanked-420");
    expect(state.photometerCalibration?.["fx-spec"]).toMatchObject({
      configuredWavelengthNm: 420,
      darkZeroedWavelengthNm: 420,
      blankedWavelengthNm: 420,
    });
    state = run(definition, state, "fx-remove-blank");
    state = run(definition, state, "fx-insert-b");
    state = run(definition, state, "fx-selected-read", 0.41);
    expect(state.measurements.find((entry) => entry.id === "fx-selected-absorbance")?.value).toBe(0.41);
    state = run(definition, state, "fx-set-420");
    state = run(definition, state, "fx-remove-b");
    state = run(definition, state, "fx-insert-blank");
    state = run(definition, state, "fx-blank-420");
    state = run(definition, state, "fx-remove-blank");
    state = run(definition, state, "fx-insert-b");
    state = run(definition, state, "fx-selected-read", 0.41);
    expect(lastMessage(state)).toMatch(/not been blanked at the approved wavelength/i);
    expect(state.measurements.filter((entry) => entry.id === "fx-selected-absorbance")).toHaveLength(1);
  });
});
