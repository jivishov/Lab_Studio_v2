import { describe, expect, it } from "vitest";
// @ts-expect-error -- the injected diagnostics adapter is intentionally an MJS script surface.
import { runCompiledContentDiagnostics } from "../../../scripts/compiledContentDiagnostics.mjs";
import {
  collectCompiledWitnesses,
  type CompiledWitnessCollection,
  type SuccessfulCompiledWitnessAttempt,
} from "../collectCompiledWitnesses";
import {
  evaluateCompiledWitnessDiagnostics,
  rawCompositionRoutingDisposition,
} from "../compiledWitnessDiagnostics";
import { syntheticComposableTechnique, syntheticCompositionSource } from "../compositionStaticFixtures";
import type {
  ActionDefinition,
  ActionInteractionSpec,
  CompositionBranchPredicate,
  LabCompositionSourceDefinition,
  TechniqueConfigurationSlot,
  TechniqueDefinition,
  TechniqueEquipmentRoleRequirement,
  TechniqueVariantDefinition,
} from "../../domain/types";

/**
 * Small authored F02 fixture: the only intended difference is whether the lab-local configuration
 * record writes the exact compiled wavelength identity consumed by two technique instances.
 */
const diagnosticFixture = (producerMeasurementId: string) => {
  const technique = structuredClone(syntheticComposableTechnique());
  technique.id = "f02-diagnostic-photometer-read";
  technique.title = "F02 diagnostic photometer read";
  technique.metadata.version = "1.0.0";
  technique.actions[0].parameters = {
    ...technique.actions[0].parameters,
    photometerOperation: "read",
    wavelengthMeasurementId: "{{config.mode}}",
    photometricQuantity: "absorbance",
  };
  const source = structuredClone(syntheticCompositionSource(["first-read", "second-read"]));
  source.id = "f02-diagnostic-lab";
  for (const instance of source.techniqueInstances) {
    instance.techniqueId = technique.id;
    instance.version = technique.metadata.version;
    instance.bindings.configuration.mode = "standard";
  }
  source.actions[0].verb = "record";
  source.actions[0].parameters = {
    ...source.actions[0].parameters,
    measurementId: producerMeasurementId,
  };
  return { source, technique };
};

const compileDiagnosticFixture = async (producerMeasurementId: string) => {
  const { source, technique } = diagnosticFixture(producerMeasurementId);
  const collection = await collectCompiledWitnesses({
    source,
    resolveTechnique: async (techniqueId: string): Promise<TechniqueDefinition> => {
      if (techniqueId !== technique.id) throw new Error(`Unknown fixture technique ${techniqueId}`);
      return structuredClone(technique);
    },
  });
  return evaluateCompiledWitnessDiagnostics({
    labs: [{ source, collection }],
    techniques: [technique],
    techniqueSurfaces: [{
      id: technique.id,
      version: technique.metadata.version,
      indexed: false,
      path: "fixture://f02-diagnostic-photometer-read.json",
      actionIds: technique.actions.map((action) => action.id),
    }],
  });
};

interface ProbeEquipmentBinding {
  roleId: string;
  definitionId: string;
  sourceInstanceId: string;
  labInstanceId: string;
}

const emptyContents = {
  kind: "empty" as const,
  label: "Empty",
  solutes: [],
  contamination: [],
  wetState: "dry" as const,
  visualState: "empty",
};

const authoredProbeAction = ({
  id,
  verb,
  atomId,
  parameters,
  interaction,
  equipmentRoleBindings,
  prerequisiteActionId,
}: {
  id: string;
  verb: ActionDefinition["verb"];
  atomId: string;
  parameters: ActionDefinition["parameters"];
  interaction: ActionInteractionSpec;
  equipmentRoleBindings: Record<string, string>;
  prerequisiteActionId?: string;
}): ActionDefinition => ({
  id,
  verb,
  label: id.replaceAll("-", " "),
  atomId,
  equipmentRoleBindings,
  parameters,
  interaction,
  prerequisites: prerequisiteActionId ? [{
    id: `${id}-requires-${prerequisiteActionId}`,
    type: "actionEvidence",
    label: `${prerequisiteActionId} is complete`,
    actionId: prerequisiteActionId,
  }] : [],
  stateChanges: [`${id} is complete.`],
  invalidCases: [],
  feedback: { success: `${id} complete.`, invalid: `Complete ${id}.` },
  evidence: [id],
});

const photometerAction = (
  id: string,
  operation: "zero" | "read",
  parameters: Record<string, string> = {},
): ActionDefinition => authoredProbeAction({
  id,
  verb: "observe",
  atomId: operation === "zero" ? "atom.observe.blank-photometer" : "atom.observe.read-photometer",
  equipmentRoleBindings: {
    "photometer-instrument": "spectrophotometer",
    "photometer-sample-holder": "cuvette",
  },
  parameters: {
    sourceDefinitionId: "cuvette",
    sourceInstanceId: "standalone-cuvette",
    targetDefinitionId: "spectrophotometer",
    targetInstanceId: "standalone-instrument",
    photometerOperation: operation,
    photometerInstanceId: "standalone-instrument",
    ...parameters,
  },
  interaction: {
    type: "readInstrument",
    sourceDefinitionId: "cuvette",
    targetDefinitionId: "spectrophotometer",
    stationId: "spectrophotometer",
    accessibleLabel: `${operation} the photometer.`,
  },
});

const insertCuvetteAction = (): ActionDefinition => authoredProbeAction({
  id: "insert-cuvette",
  verb: "place",
  atomId: "atom.place.insert-cuvette",
  equipmentRoleBindings: {
    "photometer-instrument": "spectrophotometer",
    "photometer-sample-holder": "cuvette",
  },
  parameters: {
    equipmentDefinitionId: "cuvette",
    equipmentInstanceId: "standalone-cuvette",
    sourceDefinitionId: "cuvette",
    targetDefinitionId: "spectrophotometer",
    targetInstanceId: "standalone-instrument",
    snapZoneId: "spectrophotometer-cuvette-slot",
  },
  interaction: {
    type: "snapIntoTarget",
    sourceDefinitionId: "cuvette",
    targetDefinitionId: "spectrophotometer",
    snapZoneId: "spectrophotometer-cuvette-slot",
    accessibleLabel: "Insert the cuvette.",
  },
});

const removeCuvetteAction = (): ActionDefinition => authoredProbeAction({
  id: "remove-cuvette",
  verb: "place",
  atomId: "atom.place.remove-cuvette",
  equipmentRoleBindings: {
    "photometer-instrument": "spectrophotometer",
    "photometer-sample-holder": "cuvette",
  },
  parameters: {
    equipmentDefinitionId: "cuvette",
    equipmentInstanceId: "standalone-cuvette",
    location: "workbench",
  },
  interaction: {
    type: "dragToZone",
    sourceDefinitionId: "cuvette",
    stationId: "workbench",
    accessibleLabel: "Remove the cuvette.",
  },
});

const chargeChamberAction = (): ActionDefinition => authoredProbeAction({
  id: "charge-chamber",
  verb: "transfer",
  atomId: "atom.transfer.charge-developing-chamber",
  equipmentRoleBindings: {
    "liquid-source": "distilled-water-bottle",
    "developing-chamber": "chromatography-chamber",
  },
  parameters: {
    sourceDefinitionId: "distilled-water-bottle",
    sourceInstanceId: "standalone-solvent",
    targetDefinitionId: "chromatography-chamber",
    targetInstanceId: "standalone-chamber",
    volumeMl: 5,
  },
  interaction: {
    type: "pourInto",
    sourceDefinitionId: "distilled-water-bottle",
    targetDefinitionId: "chromatography-chamber",
    valueParameter: "volumeMl",
    accessibleLabel: "Charge the developing chamber.",
  },
});

const developStripAction = (): ActionDefinition => authoredProbeAction({
  id: "develop-strip",
  verb: "developChromatogram",
  atomId: "atom.developChromatogram.develop-strip",
  equipmentRoleBindings: {
    "stationary-phase": "chromatography-paper",
    "developing-chamber": "chromatography-chamber",
  },
  parameters: {
    sourceDefinitionId: "chromatography-paper",
    sourceInstanceId: "standalone-paper",
    targetDefinitionId: "chromatography-chamber",
    targetInstanceId: "standalone-chamber",
    snapZoneId: "chromatography-chamber-paper-slot",
    requireDrySpot: true,
    trackWetState: true,
    recordMeasurementsOnDevelop: false,
  },
  interaction: {
    type: "snapIntoTarget",
    sourceDefinitionId: "chromatography-paper",
    targetDefinitionId: "chromatography-chamber",
    snapZoneId: "chromatography-chamber-paper-slot",
    accessibleLabel: "Develop the strip.",
  },
  prerequisiteActionId: "charge-chamber",
});

const readChromatogramAction = (): ActionDefinition => authoredProbeAction({
  id: "read-chromatogram",
  verb: "observe",
  atomId: "atom.observe.mark-chromatography-solvent-front",
  equipmentRoleBindings: { "stationary-phase": "chromatography-paper" },
  parameters: {
    sourceDefinitionId: "chromatography-paper",
    sourceInstanceId: "standalone-paper",
    chromatographyMeasurementType: "solventFront",
    chromatographyOperation: "markSolventFront",
  },
  interaction: {
    type: "recordNotebook",
    stationId: "notebook",
    accessibleLabel: "Record the chromatogram reading.",
  },
  prerequisiteActionId: "develop-strip",
});

const makeProbeFixture = ({
  id,
  actions,
  equipment,
  wavelengthProducerId,
  referencePreserves,
}: {
  id: string;
  actions: ActionDefinition[];
  equipment: ProbeEquipmentBinding[];
  wavelengthProducerId?: string;
  referencePreserves?: Record<string, string>;
}): { source: LabCompositionSourceDefinition; technique: TechniqueDefinition } => {
  const technique = structuredClone(syntheticComposableTechnique());
  technique.id = `${id}-technique`;
  technique.title = `${id} technique`;
  technique.requiredEquipment = [...new Set(equipment.map((item) => item.definitionId))];
  technique.initialState.equipment = equipment.map((item) => ({
    id: item.sourceInstanceId,
    definitionId: item.definitionId,
    label: item.sourceInstanceId,
    location: "shelf" as const,
    contents: structuredClone(emptyContents),
  }));
  technique.chromatographyModels = undefined;
  technique.actions = actions;
  technique.process = {
    startNodeId: `${actions[0].id}-node`,
    nodes: actions.map((action) => ({
      id: `${action.id}-node`,
      type: "action" as const,
      title: action.label,
      description: action.label,
      actionId: action.id,
      config: {},
      validation: [],
      hints: [],
      feedback: { success: "Continue.", retry: "Try again." },
    })),
    edges: actions.slice(1).map((action, index) => ({
      from: `${actions[index].id}-node`,
      to: `${action.id}-node`,
      label: "Continue",
      condition: { type: "always" as const },
    })),
  };
  technique.composition = {
    schemaVersion: 1,
    ports: [
      { id: "entry", kind: "entry", nodeId: `${actions[0].id}-node`, label: "Entry" },
      { id: "exit", kind: "exit", nodeId: `${actions.at(-1)!.id}-node`, label: "Exit" },
    ],
    equipmentRoles: equipment.map((item): TechniqueEquipmentRoleRequirement => ({
      roleId: item.roleId,
      required: true,
      allowedDefinitionIds: [item.definitionId],
      sourceInstanceIds: [item.sourceInstanceId],
    })),
    modelSlots: [],
    configurationSlots: [],
    approvalGates: [],
    variants: [],
    evidenceOutputs: [],
    completion: { exitPortIds: ["exit"], requiredEvidenceOutputIds: [], requiredValidationRuleIds: [] },
    catalogDisposition: "composable",
  };

  const source = structuredClone(syntheticCompositionSource(["probe"]));
  source.id = `${id}-lab`;
  source.equipment = [...new Set(equipment.map((item) => item.definitionId))];
  source.initialState = {
    equipment: equipment.map((item) => ({
      id: item.labInstanceId,
      definitionId: item.definitionId,
      label: item.labInstanceId,
      location: "shelf" as const,
      contents: structuredClone(emptyContents),
    })),
  };
  source.chromatographyModels = undefined;
  source.techniqueInstances[0] = {
    instanceId: "probe",
    techniqueId: technique.id,
    version: technique.metadata.version,
    bindings: {
      equipment: Object.fromEntries(equipment.map((item) => [
        item.roleId,
        { definitionId: item.definitionId, instanceId: item.labInstanceId },
      ])),
      models: {},
      configuration: {},
    },
    ...(referencePreserves ? { preserveIds: { references: referencePreserves } } : {}),
  };
  if (wavelengthProducerId) {
    source.actions[0].verb = "record";
    source.actions[0].parameters = { ...source.actions[0].parameters, measurementId: wavelengthProducerId };
  }
  return { source, technique };
};

const evaluateProbeFixture = async ({
  source,
  technique,
}: {
  source: LabCompositionSourceDefinition;
  technique: TechniqueDefinition;
}, mutateCollection?: (collection: CompiledWitnessCollection) => void) => {
  const collection = await collectCompiledWitnesses({
    source,
    resolveTechnique: async (techniqueId: string): Promise<TechniqueDefinition> => {
      if (techniqueId !== technique.id) throw new Error(`Unknown fixture technique ${techniqueId}`);
      return structuredClone(technique);
    },
  });
  mutateCollection?.(collection);
  return evaluateCompiledWitnessDiagnostics({
    labs: [{ source, collection }],
    techniques: [technique],
    techniqueSurfaces: [{
      id: technique.id,
      version: technique.metadata.version,
      indexed: true,
      path: `fixture://${technique.id}.json`,
      actionIds: technique.actions.map((action) => action.id),
    }],
  });
};

const evaluateConfigurationCoverageFixture = async ({
  id,
  configurationSlots,
  variants,
  witnessConfigurations,
  instanceConfiguration = {},
  variantId,
  sourceId,
  techniqueId,
  hostConnectionEnabledWhen,
}: {
  id: string;
  configurationSlots: TechniqueConfigurationSlot[];
  variants: TechniqueVariantDefinition[];
  witnessConfigurations: Array<Record<string, string | number | boolean>>;
  instanceConfiguration?: Record<string, string | number | boolean>;
  variantId?: string;
  sourceId?: string;
  techniqueId?: string;
  hostConnectionEnabledWhen?: CompositionBranchPredicate;
}) => {
  const fixture = makeProbeFixture({
    id,
    actions: [photometerAction("coverage-read", "read")],
    equipment: photometerEquipment,
  });
  fixture.technique.composition!.configurationSlots = configurationSlots;
  fixture.technique.composition!.variants = variants;
  if (sourceId) fixture.source.id = sourceId;
  if (techniqueId) {
    fixture.technique.id = techniqueId;
    fixture.source.techniqueInstances[0].techniqueId = techniqueId;
  }
  fixture.source.techniqueInstances[0].bindings.configuration = {
    ...fixture.source.techniqueInstances[0].bindings.configuration,
    ...instanceConfiguration,
  };
  if (variantId) fixture.source.techniqueInstances[0].variantId = variantId;
  else delete fixture.source.techniqueInstances[0].variantId;
  if (hostConnectionEnabledWhen) {
    fixture.source.compositionConnections[0].enabledWhen = hostConnectionEnabledWhen;
  }
  fixture.source.reachabilityWitnesses = witnessConfigurations.map((configuration, index) => ({
    id: `coverage-${index + 1}`,
    configuration,
    approvalGates: {},
  }));
  return evaluateProbeFixture(fixture);
};

const photometerEquipment: ProbeEquipmentBinding[] = [
  { roleId: "photometer-instrument", definitionId: "spectrophotometer", sourceInstanceId: "standalone-instrument", labInstanceId: "lab-instrument" },
  { roleId: "photometer-sample-holder", definitionId: "cuvette", sourceInstanceId: "standalone-cuvette", labInstanceId: "lab-cuvette" },
];

const balanceEquipment: ProbeEquipmentBinding[] = [
  { roleId: "balance-instrument", definitionId: "analytical-balance", sourceInstanceId: "standalone-balance", labInstanceId: "lab-balance" },
  { roleId: "weighed-vessel", definitionId: "watch-glass", sourceInstanceId: "standalone-watch-glass", labInstanceId: "lab-watch-glass" },
  { roleId: "photometer-instrument", definitionId: "spectrophotometer", sourceInstanceId: "standalone-recording-photometer", labInstanceId: "lab-recording-photometer" },
];

const typedMassAction = (id: string, measurementId: string): ActionDefinition => ({
  ...authoredProbeAction({
    id,
    verb: "weigh",
    atomId: "atom.weigh.solid-portion",
    equipmentRoleBindings: {
      "balance-instrument": "analytical-balance",
      "weighed-vessel": "watch-glass",
    },
    parameters: {
      sourceDefinitionId: "watch-glass",
    sourceInstanceId: "standalone-watch-glass",
    targetDefinitionId: "analytical-balance",
    targetInstanceId: "standalone-balance",
    inputMode: "numeric",
    },
    interaction: {
      type: "readInstrument",
      sourceDefinitionId: "watch-glass",
      targetDefinitionId: "analytical-balance",
      stationId: "analytical-balance",
      accessibleLabel: "Read the balance.",
    },
  }),
  mass: { source: "action-input", outputMeasurementId: measurementId },
});

const recordedMassAction = (id: string, readActionId: string, measurementId: string): ActionDefinition =>
  authoredProbeAction({
    id,
    verb: "record",
    atomId: "atom.record.photometer-reading",
    equipmentRoleBindings: { "photometer-instrument": "spectrophotometer" },
    parameters: { measurementId, readActionId, copyExistingMeasurementOnly: true },
    interaction: {
      type: "recordNotebook",
      valueParameter: "measurementId",
      accessibleLabel: "Record the acquired mass.",
    },
  });

const chromatographyEquipment: ProbeEquipmentBinding[] = [
  { roleId: "liquid-source", definitionId: "distilled-water-bottle", sourceInstanceId: "standalone-solvent", labInstanceId: "lab-solvent" },
  { roleId: "developing-chamber", definitionId: "chromatography-chamber", sourceInstanceId: "standalone-chamber", labInstanceId: "lab-chamber" },
  { roleId: "stationary-phase", definitionId: "chromatography-paper", sourceInstanceId: "standalone-paper", labInstanceId: "lab-paper" },
];

describe("compiled witness diagnostics", () => {
  it("accepts a compiled wavelength reference when the final lab-local producer matches it", async () => {
    const result = await compileDiagnosticFixture("standard");

    expect(result.coverage.byStatus.compiled).toBe(1);
    expect(result.findings.contexts.filter((finding) =>
      finding.rule === "cycle06/photometer-wavelength-unproduced",
    )).toEqual([]);
  });

  it("reports one authoring defect and two compiled node contexts when a shared source action lacks its final producer", async () => {
    const result = await compileDiagnosticFixture("different-wavelength");
    const findings = result.findings.contexts.filter((finding) =>
      finding.rule === "cycle06/photometer-wavelength-unproduced",
    );
    const authoring = result.findings.authoring.filter((finding) =>
      finding.rule === "cycle06/photometer-wavelength-unproduced",
    );

    expect(findings).toHaveLength(2);
    expect(authoring).toHaveLength(1);
    expect(authoring[0].affectedCompiledNodeIds).toHaveLength(2);
    expect(new Set(findings.map((finding) => finding.context.compiledActionOccurrenceKey)).size).toBe(2);
  });

  it("distinguishes a dominating calibration blank from a blank that occurs after the sample read", async () => {
    const zero = photometerAction("zero-photometer", "zero", {
      tag: "blank-complete",
      wavelengthMeasurementId: "probe-wavelength",
    });
    const read = photometerAction("read-sample", "read", {
      requiresZeroNotebookTag: "blank-complete",
      wavelengthMeasurementId: "probe-wavelength",
    });
    const passing = await evaluateProbeFixture(makeProbeFixture({
      id: "f02-blank-order-passing",
      actions: [zero, read],
      equipment: photometerEquipment,
      wavelengthProducerId: "probe-wavelength",
      referencePreserves: {
        "blank-complete": "blank-complete",
        "probe-wavelength": "probe-wavelength",
      },
    }));
    const failing = await evaluateProbeFixture(makeProbeFixture({
      id: "f02-blank-order-failing",
      actions: [read, zero],
      equipment: photometerEquipment,
      wavelengthProducerId: "probe-wavelength",
      referencePreserves: {
        "blank-complete": "blank-complete",
        "probe-wavelength": "probe-wavelength",
      },
    }));

    expect(passing.findings.contexts.some((finding) =>
      finding.rule.startsWith("compiled/calibration-blanking-"),
    )).toBe(false);
    expect(failing.findings.contexts.some((finding) =>
      finding.rule === "compiled/calibration-blanking-order-unproven",
    )).toBe(true);
  });

  it("uses selected-wavelength calibration identity and order instead of its legacy notebook tag", async () => {
    const selectedRead = photometerAction("selected-read", "read", {
      requiresZeroNotebookTag: "scoped-selected-blank-tag",
      wavelengthMeasurementId: "probe-wavelength",
      photometerCalibrationMethod: "selected-wavelength-pair",
    });
    const selectedZero = photometerAction("selected-zero", "zero", {
      tag: "unscoped-selected-blank-tag",
      wavelengthMeasurementId: "probe-wavelength",
      photometerCalibrationMethod: "selected-wavelength-pair",
    });
    const passing = await evaluateProbeFixture(makeProbeFixture({
      id: "f02-selected-blanking-passing",
      actions: [selectedZero, selectedRead],
      equipment: photometerEquipment,
      wavelengthProducerId: "probe-wavelength",
    }));
    const identityFailure = await evaluateProbeFixture(makeProbeFixture({
      id: "f02-selected-blanking-identity-failure",
      actions: [selectedZero, selectedRead],
      equipment: photometerEquipment,
      wavelengthProducerId: "probe-wavelength",
    }), (collection) => {
      const attempt = collection.attempts.find(
        (candidate): candidate is SuccessfulCompiledWitnessAttempt => candidate.status === "compiled",
      );
      const selectedZeroOrigin = attempt?.manifest.origins.find(
        (origin) => origin.sourceActionId === "selected-zero",
      );
      const compiledZero = selectedZeroOrigin?.actionId
        ? attempt?.compiled.actions.find((action) => action.id === selectedZeroOrigin.actionId)
        : undefined;
      if (!compiledZero) throw new Error("Expected the selected blanking fixture to compile its zero action.");
      compiledZero.parameters.photometerInstanceId = "different-photometer";
    });
    const orderFailure = await evaluateProbeFixture(makeProbeFixture({
      id: "f02-selected-blanking-order-failure",
      actions: [selectedRead, selectedZero],
      equipment: photometerEquipment,
      wavelengthProducerId: "probe-wavelength",
    }));

    expect(passing.findings.contexts.some((finding) =>
      finding.rule.startsWith("compiled/calibration-blanking-"),
    )).toBe(false);
    expect(identityFailure.findings.contexts.some((finding) =>
      finding.rule === "compiled/calibration-blanking-instrument-identity-mismatch",
    )).toBe(true);
    expect(orderFailure.findings.contexts.some((finding) =>
      finding.rule === "compiled/calibration-blanking-order-unproven",
    )).toBe(true);
  });

  it("keeps generic notebook-tag blanking strict when the compiled producer tag differs", async () => {
    const genericRead = photometerAction("generic-read", "read", {
      requiresZeroNotebookTag: "scoped-generic-blank-tag",
      wavelengthMeasurementId: "probe-wavelength",
    });
    const genericZero = photometerAction("generic-zero", "zero", {
      tag: "unscoped-generic-blank-tag",
      wavelengthMeasurementId: "probe-wavelength",
    });
    const result = await evaluateProbeFixture(makeProbeFixture({
      id: "f02-generic-blanking-tag-mismatch",
      actions: [genericZero, genericRead],
      equipment: photometerEquipment,
      wavelengthProducerId: "probe-wavelength",
    }));

    expect(result.findings.contexts.some((finding) =>
      finding.rule === "compiled/calibration-blanking-producer-missing",
    )).toBe(true);
  });

  it("recognizes typed mass outputs while retaining record identity and dominance checks", async () => {
    const mass = typedMassAction("typed-mass-read", "typed-mass");
    const record = recordedMassAction("typed-mass-record", mass.id, "typed-mass");
    const passing = await evaluateProbeFixture(makeProbeFixture({
      id: "f02-typed-mass-passing",
      actions: [mass, record],
      equipment: balanceEquipment,
    }));
    const identityFailure = await evaluateProbeFixture(makeProbeFixture({
      id: "f02-typed-mass-identity-failure",
      actions: [mass, record],
      equipment: balanceEquipment,
    }), (collection) => {
      const attempt = collection.attempts.find(
        (candidate): candidate is SuccessfulCompiledWitnessAttempt => candidate.status === "compiled",
      );
      const recordOrigin = attempt?.manifest.origins.find(
        (origin) => origin.sourceActionId === "typed-mass-record",
      );
      const compiledRecord = recordOrigin?.actionId
        ? attempt?.compiled.actions.find((action) => action.id === recordOrigin.actionId)
        : undefined;
      if (!compiledRecord) throw new Error("Expected the typed-mass fixture to compile its record action.");
      compiledRecord.parameters.readActionId = "other-mass-read";
    });
    const orderFailure = await evaluateProbeFixture(makeProbeFixture({
      id: "f02-typed-mass-order-failure",
      actions: [mass, record],
      equipment: balanceEquipment,
    }), (collection) => {
      const attempt = collection.attempts.find(
        (candidate): candidate is SuccessfulCompiledWitnessAttempt => candidate.status === "compiled",
      );
      const massOrigin = attempt?.manifest.origins.find(
        (origin) => origin.sourceActionId === "typed-mass-read",
      );
      const recordOrigin = attempt?.manifest.origins.find(
        (origin) => origin.sourceActionId === "typed-mass-record",
      );
      if (!attempt || !massOrigin || !recordOrigin) {
        throw new Error("Expected the typed-mass fixture to compile both the read and record actions.");
      }
      attempt.compiled.process.edges = attempt.compiled.process.edges.filter((edge) =>
        edge.from !== massOrigin.nodeId || edge.to !== recordOrigin.nodeId,
      );
    });

    expect(passing.findings.contexts.some((finding) =>
      finding.rule === "cycle10/recorded-distance-has-no-reading",
    )).toBe(false);
    expect(identityFailure.findings.contexts.some((finding) =>
      finding.rule === "cycle10/recorded-distance-has-no-reading",
    )).toBe(true);
    expect(orderFailure.findings.contexts.some((finding) =>
      finding.rule === "compiled/recorded-distance-order-unproven",
    )).toBe(true);
  });

  it("requires each concrete cuvette insertion to have a later removal", async () => {
    const read = photometerAction("read-cuvette", "read", { cuvetteInstanceId: "standalone-cuvette" });
    const passing = await evaluateProbeFixture(makeProbeFixture({
      id: "f02-cuvette-lifecycle-passing",
      actions: [insertCuvetteAction(), read, removeCuvetteAction()],
      equipment: photometerEquipment,
    }));
    const failing = await evaluateProbeFixture(makeProbeFixture({
      id: "f02-cuvette-lifecycle-failing",
      actions: [insertCuvetteAction(), read],
      equipment: photometerEquipment,
    }));

    expect(passing.findings.contexts.some((finding) =>
      finding.rule === "cycle06/cuvette-slot-unbalanced",
    )).toBe(false);
    expect(failing.findings.contexts.some((finding) =>
      finding.rule === "cycle06/cuvette-slot-unbalanced",
    )).toBe(true);
  });

  it("reports when a compiled graph loses required developing-chamber solvent dominance", async () => {
    const charge = chargeChamberAction();
    const develop = developStripAction();
    const read = readChromatogramAction();
    const passing = await evaluateProbeFixture(makeProbeFixture({
      id: "f02-solvent-order-passing",
      actions: [charge, develop, read],
      equipment: chromatographyEquipment,
    }));
    const failing = await evaluateProbeFixture(makeProbeFixture({
      id: "f02-solvent-order-failing",
      actions: [charge, develop, read],
      equipment: chromatographyEquipment,
    }), (collection) => {
      const attempt = collection.attempts.find(
        (candidate): candidate is SuccessfulCompiledWitnessAttempt => candidate.status === "compiled",
      );
      if (!attempt) throw new Error("Expected the solvent-order fixture to compile.");
      const chargeOrigin = attempt.manifest.origins.find((origin) => origin.sourceActionId === charge.id);
      const developOrigin = attempt.manifest.origins.find((origin) => origin.sourceActionId === develop.id);
      if (!chargeOrigin || !developOrigin) {
        throw new Error("Expected compiled origins for the chamber charge and development actions.");
      }
      attempt.compiled.process.edges = attempt.compiled.process.edges.filter((edge) =>
        edge.from !== chargeOrigin.nodeId || edge.to !== developOrigin.nodeId,
      );
    });

    expect(passing.findings.contexts.some((finding) =>
      finding.rule.startsWith("compiled/development-solvent-"),
    )).toBe(false);
    expect(failing.findings.contexts.some((finding) =>
      finding.rule === "compiled/development-solvent-order-unproven",
    )).toBe(true);
  });

  it("retains manifest ownership for a technique node that has no action", async () => {
    const fixture = makeProbeFixture({
      id: "f02-actionless-origin",
      actions: [photometerAction("read-sample", "read")],
      equipment: photometerEquipment,
    });
    fixture.technique.process.nodes.push({
      id: "actionless-exit",
      type: "teacherNote",
      title: "Technique-owned exit",
      description: "No action is attached to this technique-owned node.",
      config: {},
      validation: [],
      hints: [],
      feedback: { success: "Continue.", retry: "Continue." },
    });
    fixture.technique.process.edges = [{
      from: "read-sample-node",
      to: "actionless-exit",
      label: "Continue",
      condition: { type: "always" },
    }];
    fixture.technique.composition!.ports.find((port) => port.id === "exit")!.nodeId = "actionless-exit";

    const result = await evaluateProbeFixture(fixture);

    expect(result.statuses.some((status) => status.status === "unresolved-origin")).toBe(false);
    expect(result.contexts.some((context) =>
      context.originalNodeId === "actionless-exit" && context.compiledInstanceId === "probe",
    )).toBe(true);
  });

  it("reports an unused exact-version variant while retaining selected-variant true and false coverage", async () => {
    const result = await evaluateConfigurationCoverageFixture({
      id: "f02-variant-selection",
      configurationSlots: [{
        id: "contextId",
        valueType: "string",
        required: true,
        allowedValues: ["strong", "weak"],
        defaultValue: "strong",
      }],
      variants: [
        { id: "strong", label: "Strong route", enabledWhen: { kind: "configuration", slotId: "contextId", equals: "strong" } },
        { id: "weak", label: "Weak route", enabledWhen: { kind: "configuration", slotId: "contextId", equals: "weak" } },
      ],
      instanceConfiguration: { contextId: "strong" },
      variantId: "strong",
      witnessConfigurations: [
        { "probe.contextId": "strong" },
        { "probe.contextId": "weak" },
      ],
    });

    expect(result.coverage.unrepresentedConfigurations).toEqual(expect.arrayContaining([
      expect.objectContaining({ detail: expect.stringContaining(".weak has no exact lab instance") }),
    ]));
    expect(result.coverage.unrepresentedConfigurations.some((status) =>
      status.detail.includes(".strong has no exact lab instance") ||
      status.detail.includes("variant probe.strong predicate"),
    )).toBe(false);
  });

  it("does not treat matching configuration values as a selected variant", async () => {
    const result = await evaluateConfigurationCoverageFixture({
      id: "f02-variant-context-only",
      configurationSlots: [{
        id: "contextId",
        valueType: "string",
        required: true,
        allowedValues: ["strong", "weak"],
        defaultValue: "strong",
      }],
      variants: [
        { id: "strong", label: "Strong route", enabledWhen: { kind: "configuration", slotId: "contextId", equals: "strong" } },
        { id: "weak", label: "Weak route", enabledWhen: { kind: "configuration", slotId: "contextId", equals: "weak" } },
      ],
      instanceConfiguration: { contextId: "strong" },
      witnessConfigurations: [
        { "probe.contextId": "strong" },
        { "probe.contextId": "weak" },
      ],
    });

    expect(result.coverage.unrepresentedConfigurations.filter((status) =>
      status.detail.includes("has no exact lab instance"),
    )).toHaveLength(2);
  });

  it("recognizes a host connection predicate as the authored variant boundary", async () => {
    const result = await evaluateConfigurationCoverageFixture({
      id: "f02-host-connection-variant",
      configurationSlots: [{
        id: "contextId",
        valueType: "string",
        required: true,
        allowedValues: ["strong", "weak"],
        defaultValue: "strong",
      }],
      variants: [
        { id: "strong", label: "Strong route", enabledWhen: { kind: "configuration", slotId: "contextId", equals: "strong" } },
        { id: "weak", label: "Weak route", enabledWhen: { kind: "configuration", slotId: "contextId", equals: "weak" } },
      ],
      instanceConfiguration: { contextId: "strong" },
      witnessConfigurations: [
        { "probe.contextId": "strong" },
        { "probe.contextId": "weak" },
      ],
      hostConnectionEnabledWhen: { kind: "configuration", instanceId: "probe", slotId: "contextId", equals: "strong" },
    });

    expect(result.coverage.fixedRoleConfigurations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        status: "fixed-role-configuration",
        detail: expect.stringContaining("strong is represented by host connection predicates"),
      }),
    ]));
    expect(result.coverage.unrepresentedConfigurations).toEqual(expect.arrayContaining([
      expect.objectContaining({ detail: expect.stringContaining(".weak has no exact lab instance") }),
    ]));
  });

  it("records an allowlisted fixed host role without relaxing generic finite coverage", async () => {
    const fixedRole = await evaluateConfigurationCoverageFixture({
      id: "f02-fixed-host-role",
      sourceId: "bonding-unknown-solids",
      techniqueId: "bonding-solids-tests",
      configurationSlots: [{
        id: "sampleMode",
        valueType: "string",
        required: true,
        allowedValues: ["blind", "known"],
        defaultValue: "blind",
      }],
      variants: [],
      instanceConfiguration: { sampleMode: "blind" },
      witnessConfigurations: [{ "probe.sampleMode": "blind" }],
    });
    const generic = await evaluateConfigurationCoverageFixture({
      id: "f02-generic-finite-role",
      configurationSlots: [{
        id: "sampleMode",
        valueType: "string",
        required: true,
        allowedValues: ["blind", "known"],
        defaultValue: "blind",
      }],
      variants: [],
      instanceConfiguration: { sampleMode: "blind" },
      witnessConfigurations: [{ "probe.sampleMode": "blind" }],
    });

    expect(fixedRole.coverage.unrepresentedConfigurations).toEqual([]);
    expect(fixedRole.coverage.fixedRoleConfigurations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        status: "fixed-role-configuration",
        detail: expect.stringContaining("blind.sampleMode is authored as the fixed host role value"),
      }),
    ]));
    expect(generic.coverage.unrepresentedConfigurations).toEqual(expect.arrayContaining([
      expect.objectContaining({ detail: expect.stringContaining("[\"known\"]") }),
    ]));
  });

  it("labels finite continuous representatives as static-only while retaining missing numeric coverage as fatal", async () => {
    const representative = await evaluateConfigurationCoverageFixture({
      id: "f02-continuous-representative",
      configurationSlots: [{
        id: "temperatureC",
        valueType: "number",
        required: true,
        defaultValue: 20,
      }],
      variants: [],
      instanceConfiguration: { temperatureC: 20 },
      witnessConfigurations: [{ "probe.temperatureC": 24 }],
    });
    const noRepresentative = await evaluateConfigurationCoverageFixture({
      id: "f02-continuous-missing",
      configurationSlots: [{ id: "temperatureC", valueType: "number", required: false }],
      variants: [],
      witnessConfigurations: [{}],
    });
    const missingFiniteDeclaredValue = await evaluateConfigurationCoverageFixture({
      id: "f02-finite-value-missing",
      configurationSlots: [{
        id: "temperatureC",
        valueType: "number",
        required: true,
        allowedValues: [20, 24],
        defaultValue: 20,
      }],
      variants: [],
      instanceConfiguration: { temperatureC: 20 },
      witnessConfigurations: [{ "probe.temperatureC": 20 }],
    });

    expect(representative.coverage.representativeContinuousConfigurations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        status: "representative-continuous-configuration",
        detail: expect.stringContaining("non-exhaustive"),
      }),
    ]));
    expect(representative.coverage.unrepresentedConfigurations.some((status) =>
      status.detail.includes("Continuous numeric configuration"),
    )).toBe(false);
    expect(noRepresentative.coverage.unrepresentedConfigurations).toEqual(expect.arrayContaining([
      expect.objectContaining({ detail: expect.stringContaining("has no finite representative") }),
    ]));
    expect(rawCompositionRoutingDisposition({
      rule: "cycle06/photometer-wavelength-unproduced",
      scope: "lab:f02-continuous-missing-lab/probe",
    }, noRepresentative.routing)).toMatchObject({
      routeToCompiledContexts: false,
      evaluationScope: "raw-template-inconclusive-compiled-coverage",
    });
    expect(missingFiniteDeclaredValue.coverage.unrepresentedConfigurations).toEqual(expect.arrayContaining([
      expect.objectContaining({ detail: expect.stringContaining("[24]") }),
    ]));
  });

  it("rejects duplicate adapter lab-index identities before catalog compilation", async () => {
    const requestedPaths: string[] = [];
    const duplicateLabEntry = {
      id: "f02-duplicate-adapter-lab",
      title: "Duplicate adapter lab",
      description: "Duplicate identity fixture.",
    };

    await expect(runCompiledContentDiagnostics({
      readJson: async (path: string) => {
        requestedPaths.push(path);
        if (path === "public/labs/index.json") return [duplicateLabEntry, structuredClone(duplicateLabEntry)];
        if (path === "public/techniques/index.json") return [];
        throw new Error(`Unexpected adapter catalog read: ${path}`);
      },
      listFiles: async () => [],
    })).rejects.toThrow('public/labs/index.json repeats id "f02-duplicate-adapter-lab"');

    expect(requestedPaths.sort()).toEqual([
      "public/labs/index.json",
      "public/techniques/index.json",
    ]);
  });

  it("rejects an adapter lab index/file identity mismatch before catalog compilation", async () => {
    const requestedPaths: string[] = [];

    await expect(runCompiledContentDiagnostics({
      readJson: async (path: string) => {
        requestedPaths.push(path);
        if (path === "public/labs/index.json") {
          return [{
            id: "f02-indexed-adapter-lab",
            title: "Indexed adapter lab",
            description: "Index/file identity fixture.",
            file: "f02-indexed-adapter-lab.json",
          }];
        }
        if (path === "public/techniques/index.json") return [];
        if (path === "public/labs/f02-indexed-adapter-lab.json") {
          return { id: "f02-file-adapter-lab" };
        }
        throw new Error(`Unexpected adapter catalog read: ${path}`);
      },
      listFiles: async () => [],
    })).rejects.toThrow(
      "Lab index id f02-indexed-adapter-lab points to public/labs/f02-indexed-adapter-lab.json, whose definition id is f02-file-adapter-lab.",
    );

    expect(requestedPaths.sort()).toEqual([
      "public/labs/f02-indexed-adapter-lab.json",
      "public/labs/index.json",
      "public/techniques/index.json",
    ]);
  });
});
