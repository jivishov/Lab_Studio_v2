import { afterEach, describe, expect, it } from "vitest";
import type { BundledLabSourceDefinition, LabDefinition } from "../../domain/types";
import {
  bindGreenChemistrySetup,
  GREEN_CHEMISTRY_APPROVAL_GATE_KEY,
  GREEN_CHEMISTRY_INSTANCE_ID,
  GREEN_CHEMISTRY_LAB_ID,
  GREEN_CHEMISTRY_TARE_CONVENTIONS,
  GREEN_CHEMISTRY_TARE_WITNESS_SLOT,
  GREEN_CHEMISTRY_TECHNIQUE_ID,
  GREEN_CHEMISTRY_TECHNIQUE_VERSION,
  GreenChemistrySetupValidationError,
  parseGreenChemistrySetup,
  UNCONFIGURED_TEXT,
  type GreenChemistryApprovedConfiguration,
} from "../greenChemistrySetup";
import { applyLabSetup } from "../labSetup";
import {
  GREEN_CHEMISTRY_LAB_NODE_ACTION_IDS,
  GREEN_CHEMISTRY_ROUTE_EXECUTION_TARGETS,
  greenChemistryHoldersFromCompiled,
  validateGreenChemistryRouteManifest,
} from "../../investigations/purifyMixtureGreenChemistry/routeAdapter";
import {
  bundledLabSetupFixtures,
  createBundledLabHarness,
  type BundledLabHarness,
} from "../../test/bundledLabHarness";

const validSetup = (): GreenChemistryApprovedConfiguration => ({
  sampleMassG: 1.5,
  warmDurationMin: 1,
  heatingDurationMin: 5,
  heatingIntensity: "gentle-blue-cone",
  constantMassToleranceG: 0.005,
  maximumHeatCycles: 4,
  coolingEndpointC: 25,
  coolingSurface: "wire-gauze-on-bench",
  tareConvention: "record-crucible-plus-lid",
  minimumReplicates: 2,
});

const expectInvalid = (value: unknown, message: RegExp): void => {
  try {
    parseGreenChemistrySetup(value);
    throw new Error("Expected setup validation to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(GreenChemistrySetupValidationError);
    expect(error).toMatchObject({ message: expect.stringMatching(message) });
  }
};

const compiledParameter = (
  definition: LabDefinition,
  actionId: string,
  key: string,
): unknown => definition.actions.find((action) => action.id === actionId)?.parameters[key];

const expectCompiledGreenContract = (
  definition: LabDefinition,
  setup: GreenChemistryApprovedConfiguration,
): void => {
  expect(definition.id).toBe(GREEN_CHEMISTRY_LAB_ID);
  expect(definition.compositionManifest?.status).toBe("compiled");
  expect(validateGreenChemistryRouteManifest(definition)).toEqual([]);

  const projectionRows: ReadonlyArray<
    readonly [keyof GreenChemistryApprovedConfiguration, string, string]
  > = [
    ["sampleMassG", "add-carbonate-sample", "massG"],
    ["warmDurationMin", "warm-gently", "durationMin"],
    ["heatingDurationMin", "heat-carbonate-mixture", "durationMin"],
    ["heatingIntensity", "heat-carbonate-mixture", "intensity"],
    ["constantMassToleranceG", "record-cycle-mass", "constantMassToleranceG"],
    ["maximumHeatCycles", "repeat-heat-to-constant-mass", "maximumHeatCycles"],
    ["coolingEndpointC", "cool-constant-mass-crucible", "coolingEndpointC"],
    ["coolingSurface", "cool-constant-mass-crucible", "coolingSurface"],
    ["tareConvention", "approve-thermal-decomposition-plan", "tareConvention"],
    ["minimumReplicates", "complete-replicate", "minimumReplicates"],
  ];
  for (const [configurationKey, actionId, parameterKey] of projectionRows) {
    expect(compiledParameter(definition, actionId, parameterKey)).toBe(setup[configurationKey]);
  }
  for (const [actionId, parameterKey] of [
    ["repeat-heat-to-constant-mass", "durationMin"],
    ["repeat-heat-to-constant-mass", "intensity"],
    ["record-final-crucible-mass", "constantMassToleranceG"],
    ["finalize-unused-master-stock", "minimumReplicates"],
    ["record-empty-crucible", "tareConvention"],
    ["calculate-carbonate-composition", "tareConvention"],
  ] as const) {
    const configurationKey = parameterKey === "durationMin"
      ? "heatingDurationMin"
      : parameterKey === "intensity"
        ? "heatingIntensity"
        : parameterKey === "constantMassToleranceG"
          ? "constantMassToleranceG"
          : parameterKey === "minimumReplicates"
            ? "minimumReplicates"
            : "tareConvention";
    expect(compiledParameter(definition, actionId, parameterKey)).toBe(setup[configurationKey]);
  }
  for (const actionId of [
    "read-empty-crucible",
    "weigh-initial-crucible",
    "weigh-preliminary-final-mass",
    "weigh-final-crucible",
  ] as const) {
    expect(compiledParameter(definition, actionId, "maxSafeTemperatureC")).toBe(
      setup.coolingEndpointC,
    );
  }
  for (const actionId of ["cool-crucible", "cool-constant-mass-crucible"] as const) {
    expect(compiledParameter(definition, actionId, "coolingEndpointC")).toBe(
      setup.coolingEndpointC,
    );
    expect(compiledParameter(definition, actionId, "coolingSurface")).toBe(
      setup.coolingSurface,
    );
  }

  const manifest = definition.compositionManifest;
  const instance = manifest?.instances.find(
    (candidate) => candidate.instanceId === GREEN_CHEMISTRY_INSTANCE_ID,
  );
  expect(instance).toMatchObject({
    instanceId: GREEN_CHEMISTRY_INSTANCE_ID,
    techniqueId: GREEN_CHEMISTRY_TECHNIQUE_ID,
    version: GREEN_CHEMISTRY_TECHNIQUE_VERSION,
  });
  if (!manifest || !instance) return;

  const compiledReferenceId = (actionId: string, sourceId: string): string => {
    const outputs = instance.evidenceOutputs.filter(
      (output) => output.actionId === actionId && output.sourceId === sourceId,
    );
    expect(outputs).toHaveLength(1);
    const referenceId = outputs[0]?.referenceId;
    if (!referenceId) {
      throw new Error(`Expected compiler reference for ${actionId}/${sourceId}.`);
    }
    return referenceId;
  };

  const thermalOrigins = manifest.origins.filter(
    (origin) => origin.instanceId === GREEN_CHEMISTRY_INSTANCE_ID,
  );
  expect(thermalOrigins.map((origin) => origin.actionId)).toEqual(
    GREEN_CHEMISTRY_ROUTE_EXECUTION_TARGETS.map((target) => target.actionId),
  );
  for (const target of GREEN_CHEMISTRY_ROUTE_EXECUTION_TARGETS) {
    expect(definition.actions.some((action) => action.id === target.actionId)).toBe(true);
    expect(definition.process.nodes.find((node) => node.id === target.nodeId)).toMatchObject({
      actionId: target.actionId,
    });
    expect(thermalOrigins.filter((origin) => origin.actionId === target.actionId)).toEqual([
      expect.objectContaining({
        actionId: target.actionId,
        nodeId: target.nodeId,
        techniqueId: target.techniqueId,
        techniqueVersion: target.techniqueVersion,
        instanceId: target.instanceId,
      }),
    ]);
    for (const outputId of target.evidenceOutputIds) {
      expect(instance.evidenceOutputs).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: outputId, actionId: target.actionId }),
      ]));
    }
  }
  for (const actionId of GREEN_CHEMISTRY_LAB_NODE_ACTION_IDS) {
    expect(definition.actions.some((action) => action.id === actionId)).toBe(true);
    expect(definition.process.nodes.find((node) => node.actionId === actionId)).toMatchObject({
      id: `${actionId}-node`,
      actionId,
    });
  }

  const balanceRows = [
    ["read-empty-crucible", "empty-mass"],
    ["weigh-initial-crucible", "loaded-mass"],
    ["weigh-preliminary-final-mass", "cycle-mass"],
    ["weigh-final-crucible", "final-mass"],
  ] as const;
  for (const [actionId, sourceOutputId] of balanceRows) {
    expect(definition.actions.find((action) => action.id === actionId)?.mass).toMatchObject({
      source: "action-input",
      outputMeasurementId: compiledReferenceId(actionId, sourceOutputId),
      continuity: {
        version: 1,
        quantityKind: "balance-display",
        measuredSupportInstanceId: "crucible-with-lid-1",
      },
    });
  }

  expect(definition.actions.find((action) => action.id === "configure-unheated-stock")?.sourceInventory)
    .toMatchObject({
      quantityKind: "solid-mass",
      sourceInstanceId: "sample-bottle-1",
      outputMeasurementId: compiledReferenceId(
        "configure-unheated-stock",
        "unheated-stock-configured",
      ),
      materialSoluteId: "carbonate-mixture-undisclosed",
      materialLabel: "NaHCO3 and Na2CO3 mixture; composition not disclosed",
    });
  for (const [actionId, sourceInstanceId, targetInstanceId, destinationRepresentation] of [
    ["recover-unused-sample", "working-sample-portion-1", "unused-sample-recovery-1", "physical"],
    ["recover-replicate-product", "crucible-with-lid-1", "heated-product-recovery-1", "qualitative-unknown"],
    ["finalize-unused-master-stock", "sample-bottle-1", "unused-sample-recovery-1", "physical"],
  ] as const) {
    const action = definition.actions.find((candidate) => candidate.id === actionId);
    expect(action?.parameters).toMatchObject({ sourceInstanceId, targetInstanceId });
    expect(action?.solidTransfer).toMatchObject({
      mode: "whole-remaining",
      destinationRepresentation,
      requireNonEmptySource: actionId === "recover-replicate-product" ? true : false,
    });
  }
  expect(greenChemistryHoldersFromCompiled(definition).errors).toEqual([]);
};

let bundledLabHarness: BundledLabHarness | undefined;

describe("green-chemistry setup boundary", () => {
  afterEach(() => {
    bundledLabHarness?.dispose();
    bundledLabHarness = undefined;
  });

  it("accepts both tare conventions and canonicalizes only the method text", () => {
    const first = parseGreenChemistrySetup({
      ...validSetup(),
      heatingIntensity: "  gentle-blue-cone  ",
      coolingSurface: "  wire-gauze-on-bench  ",
      tareConvention: "record-crucible-plus-lid",
    });
    const second = parseGreenChemistrySetup({
      ...validSetup(),
      tareConvention: "tare-balance-with-crucible-plus-lid",
    });

    expect(first).toMatchObject({
      heatingIntensity: "gentle-blue-cone",
      coolingSurface: "wire-gauze-on-bench",
      tareConvention: "record-crucible-plus-lid",
    });
    expect(second.tareConvention).toBe("tare-balance-with-crucible-plus-lid");
    expect(first).not.toBe(second);
  });

  it("accepts a null-prototype record and returns a fresh canonical object", () => {
    const input = Object.create(null) as Record<string, unknown>;
    Object.assign(input, validSetup());
    const parsed = parseGreenChemistrySetup(input);

    expect(parsed).toEqual(validSetup());
    expect(parsed).not.toBe(input);
  });

  it.each([
    ["null", null],
    ["array", Object.values(validSetup())],
    ["missing field", (() => { const value = validSetup(); delete (value as Partial<GreenChemistryApprovedConfiguration>).coolingSurface; return value; })()],
    ["extra field", { ...validSetup(), unexpected: true }],
    ["numeric string", { ...validSetup(), sampleMassG: "1.5" }],
    ["boolean", { ...validSetup(), maximumHeatCycles: true }],
    ["NaN", { ...validSetup(), sampleMassG: Number.NaN }],
    ["infinity", { ...validSetup(), warmDurationMin: Number.POSITIVE_INFINITY }],
    ["nonpositive mass", { ...validSetup(), sampleMassG: 0 }],
    ["fractional cycle count", { ...validSetup(), maximumHeatCycles: 2.5 }],
    ["nonpositive teacher minimum", { ...validSetup(), minimumReplicates: 0 }],
    ["fractional teacher minimum", { ...validSetup(), minimumReplicates: 2.5 }],
    ["unsafe replicate count", { ...validSetup(), minimumReplicates: Number.MAX_SAFE_INTEGER + 1 }],
    ["blank method text", { ...validSetup(), heatingIntensity: "   " }],
    ["placeholder method text", { ...validSetup(), coolingSurface: "TBD" }],
    ["padded tare token", { ...validSetup(), tareConvention: " record-crucible-plus-lid " }],
    ["third tare token", { ...validSetup(), tareConvention: "weigh-empty-vessel" }],
  ] as const)("rejects %s", (_label, value) => {
    expectInvalid(value, /green-chemistry setup/i);
  });

  it("accepts finite cooling endpoints including zero and negative values", () => {
    expect(parseGreenChemistrySetup({ ...validSetup(), coolingEndpointC: 0 }).coolingEndpointC).toBe(0);
    expect(parseGreenChemistrySetup({ ...validSetup(), coolingEndpointC: -10 }).coolingEndpointC).toBe(-10);
    expectInvalid({ ...validSetup(), coolingEndpointC: Number.NaN }, /coolingEndpointC.*finite/i);
  });

  it("rejects inherited/custom-prototype records and symbol keys", () => {
    const inherited = Object.create({ inherited: true }) as Record<string, unknown>;
    Object.assign(inherited, validSetup());
    expectInvalid(inherited, /Object\.prototype or a null prototype/i);

    const symbolKey = Symbol("runtime-only");
    const withSymbol = { ...validSetup(), [symbolKey]: "do not serialize" };
    expectInvalid(withSymbol, /symbol-keyed/i);
  });

  it("rejects accessors without invoking them", () => {
    let invoked = false;
    const accessor = validSetup() as unknown as Record<string, unknown>;
    Object.defineProperty(accessor, "sampleMassG", {
      configurable: true,
      enumerable: true,
      get: () => {
        invoked = true;
        throw new Error("accessor was invoked");
      },
    });

    expectInvalid(accessor, /data property.*accessor/i);
    expect(invoked).toBe(false);
  });

  it("rejects cyclic and BigInt inputs before the loader can serialize a cache key", async () => {
    bundledLabHarness = await createBundledLabHarness();
    const cyclic = { ...validSetup() } as Record<string, unknown>;
    cyclic.self = cyclic;
    await expect(
      bundledLabHarness.loadLab(GREEN_CHEMISTRY_LAB_ID, cyclic as never),
    ).rejects.toThrow(/unexpected field|setup/i);

    const bigint = { ...validSetup(), sampleMassG: 1n };
    await expect(
      bundledLabHarness.loadLab(GREEN_CHEMISTRY_LAB_ID, bigint as never),
    ).rejects.toThrow(/sampleMassG|setup/i);
    expect(bundledLabHarness.fetch).not.toHaveBeenCalled();
  });

  it("canonicalizes equivalent insertion orders into one loader cache entry", async () => {
    bundledLabHarness = await createBundledLabHarness();
    const setup = validSetup();
    const reordered: GreenChemistryApprovedConfiguration = {
      minimumReplicates: setup.minimumReplicates,
      tareConvention: setup.tareConvention,
      coolingSurface: setup.coolingSurface,
      coolingEndpointC: setup.coolingEndpointC,
      maximumHeatCycles: setup.maximumHeatCycles,
      constantMassToleranceG: setup.constantMassToleranceG,
      heatingIntensity: setup.heatingIntensity,
      heatingDurationMin: setup.heatingDurationMin,
      warmDurationMin: setup.warmDurationMin,
      sampleMassG: setup.sampleMassG,
    };

    const first = bundledLabHarness.loadLab(GREEN_CHEMISTRY_LAB_ID, setup);
    const second = bundledLabHarness.loadLab(GREEN_CHEMISTRY_LAB_ID, reordered);
    const [firstDefinition, secondDefinition] = await Promise.all([first, second]);
    expect(secondDefinition).toEqual(firstDefinition);
    expectCompiledGreenContract(firstDefinition, setup);
    expectCompiledGreenContract(secondDefinition, setup);
    expect(bundledLabHarness.fetch.mock.calls.filter(([input]) => String(input).includes("labs/green-chemistry-mixture-purification.json")).length).toBe(1);
    expect(bundledLabHarness.fetch.mock.calls.filter(([input]) => String(input).includes("techniques/thermal-decomposition-mass-loss.json")).length).toBe(1);
  });

  it("requires setup and never falls back to an unconfigured green fixture", async () => {
    bundledLabHarness = await createBundledLabHarness({
      resolveResponse: () => {
        throw new TypeError("offline");
      },
    });

    await expect(
      bundledLabHarness.loadLabWithoutSetup(GREEN_CHEMISTRY_LAB_ID),
    ).rejects.toThrow(/instructor-approved investigation setup/i);
    await expect(
      bundledLabHarness.loadLab(GREEN_CHEMISTRY_LAB_ID, bundledLabSetupFixtures[GREEN_CHEMISTRY_LAB_ID]),
    ).rejects.toThrow(/offline|resource|fetch|unable to reach/i);
  });

  it("rejects the actual public placeholder configuration before fetch or compilation", async () => {
    bundledLabHarness = await createBundledLabHarness();
    const source = await bundledLabHarness.readJson<BundledLabSourceDefinition>(
      "labs/green-chemistry-mixture-purification.json",
    );
    const publicConfiguration = source.techniqueInstances?.find(
      (instance) => instance.instanceId === GREEN_CHEMISTRY_INSTANCE_ID,
    )?.bindings.configuration;
    expect(publicConfiguration).toBeDefined();
    await expect(
      bundledLabHarness.loadLab(GREEN_CHEMISTRY_LAB_ID, publicConfiguration as never),
    ).rejects.toThrow(/green-chemistry setup/i);
    expect(bundledLabHarness.fetch).not.toHaveBeenCalled();
  });

  it("binds only the exact green identity and pins the reconciled thermal version", async () => {
    bundledLabHarness = await createBundledLabHarness();
    const source = await bundledLabHarness.readJson<BundledLabSourceDefinition>(
      "labs/green-chemistry-mixture-purification.json",
    );
    if (!source.techniqueInstances?.[0]) {
      throw new Error("Expected the green lab's thermal technique instance.");
    }
    const setup = validSetup();
    const sourceWithWrongLab = { ...source, id: "not-green" };
    expect(() => bindGreenChemistrySetup(sourceWithWrongLab, setup)).toThrow(GREEN_CHEMISTRY_LAB_ID);
    expect(applyLabSetup(sourceWithWrongLab, setup)).toBe(sourceWithWrongLab);

    const wrongInstance = structuredClone(source);
    wrongInstance.techniqueInstances![0].instanceId = "other-instance";
    expect(() => applyLabSetup(wrongInstance, setup)).toThrow(GREEN_CHEMISTRY_INSTANCE_ID);

    const wrongTechnique = structuredClone(source);
    wrongTechnique.techniqueInstances![0].techniqueId = "other-technique";
    expect(() => applyLabSetup(wrongTechnique, setup)).toThrow(GREEN_CHEMISTRY_TECHNIQUE_ID);

    const wrongVersion = structuredClone(source);
    wrongVersion.techniqueInstances![0].version = "1.0.0";
    expect(() => applyLabSetup(wrongVersion, setup)).toThrow(GREEN_CHEMISTRY_TECHNIQUE_VERSION);
  });

  // --- Both approved tare conventions, the locked witness, and invalid/missing setup. ---

  it("declares one approved witness per tare convention and keeps the locked one last", async () => {
    bundledLabHarness = await createBundledLabHarness();
    const source = await bundledLabHarness.readJson<BundledLabSourceDefinition>(
      "labs/green-chemistry-mixture-purification.json",
    );
    const witnesses = source.reachabilityWitnesses ?? [];

    for (const convention of GREEN_CHEMISTRY_TARE_CONVENTIONS) {
      const approved = witnesses.filter(
        (witness) =>
          witness.configuration[GREEN_CHEMISTRY_TARE_WITNESS_SLOT] === convention
          && witness.approvalGates[GREEN_CHEMISTRY_APPROVAL_GATE_KEY] === true,
      );
      expect(approved, convention).toHaveLength(1);
    }
    const locked = witnesses.filter(
      (witness) => witness.approvalGates[GREEN_CHEMISTRY_APPROVAL_GATE_KEY] === false,
    );
    expect(locked).toHaveLength(1);
    expect(locked[0]?.id).toBe("approval-locked-static-witness");
    expect(witnesses[witnesses.length - 1]?.id).toBe("approval-locked-static-witness");

    // The published instance binding stays unconfigured, so teacher setup is still required even
    // though every witness now pins a legal tare value.
    const binding = source.techniqueInstances?.find(
      (instance) => instance.instanceId === GREEN_CHEMISTRY_INSTANCE_ID,
    )?.bindings.configuration;
    expect(binding?.tareConvention).toBe(UNCONFIGURED_TEXT);
  });

  it("selects the witness matching the approved tare convention", async () => {
    bundledLabHarness = await createBundledLabHarness();
    const source = await bundledLabHarness.readJson<BundledLabSourceDefinition>(
      "labs/green-chemistry-mixture-purification.json",
    );

    for (const convention of GREEN_CHEMISTRY_TARE_CONVENTIONS) {
      const bound = bindGreenChemistrySetup(source, { ...validSetup(), tareConvention: convention });
      const selected = bound.reachabilityWitnesses?.[0];
      // The production loader compiles witness[0]; the compiler prefers the witness value over the
      // instance binding, so the selected witness has to carry the approved convention itself.
      expect(selected?.configuration[GREEN_CHEMISTRY_TARE_WITNESS_SLOT], convention).toBe(convention);
      expect(selected?.approvalGates[GREEN_CHEMISTRY_APPROVAL_GATE_KEY], convention).toBe(true);
      expect(bound.reachabilityWitnesses).toHaveLength(source.reachabilityWitnesses?.length ?? 0);
      // Binding never mutates the caller's source.
      expect(source.reachabilityWitnesses?.[0]?.id).toBe("teacher-approved-route");
    }
  });

  it("refuses to bind when a supported convention has no approved witness", async () => {
    bundledLabHarness = await createBundledLabHarness();
    const source = await bundledLabHarness.readJson<BundledLabSourceDefinition>(
      "labs/green-chemistry-mixture-purification.json",
    );

    const missingWitness = structuredClone(source);
    missingWitness.reachabilityWitnesses = (missingWitness.reachabilityWitnesses ?? []).filter(
      (witness) => witness.configuration[GREEN_CHEMISTRY_TARE_WITNESS_SLOT] !== GREEN_CHEMISTRY_TARE_CONVENTIONS[1],
    );
    expect(() => bindGreenChemistrySetup(missingWitness, validSetup())).toThrow(
      /no approved reachability witness for tare convention/i,
    );

    // A convention that only the approval-locked witness carries is not a route a learner may run.
    const lockedOnly = structuredClone(source);
    for (const witness of lockedOnly.reachabilityWitnesses ?? []) {
      if (witness.configuration[GREEN_CHEMISTRY_TARE_WITNESS_SLOT] === GREEN_CHEMISTRY_TARE_CONVENTIONS[1]) {
        witness.approvalGates[GREEN_CHEMISTRY_APPROVAL_GATE_KEY] = false;
      }
    }
    expect(() => bindGreenChemistrySetup(lockedOnly, validSetup())).toThrow(
      /no approved reachability witness for tare convention/i,
    );

    const noWitnesses = structuredClone(source);
    noWitnesses.reachabilityWitnesses = [];
    expect(() => bindGreenChemistrySetup(noWitnesses, validSetup())).toThrow(
      /must declare reachability witnesses/i,
    );
  });

  it("compiles each approved tare convention into its own evidence-bearing parameters", async () => {
    bundledLabHarness = await createBundledLabHarness();
    const compiled = await Promise.all(
      GREEN_CHEMISTRY_TARE_CONVENTIONS.map(async (convention) => {
        const setup = { ...validSetup(), tareConvention: convention };
        const definition = await bundledLabHarness!.loadLab(GREEN_CHEMISTRY_LAB_ID, setup);
        expectCompiledGreenContract(definition, setup);
        return { convention, definition };
      }),
    );

    for (const { convention, definition } of compiled) {
      // Not a witness count: the branch has to reach every action that consumes the convention,
      // including the two the route adapter mirrors for mass evidence and the final calculation.
      for (const actionId of [
        "approve-thermal-decomposition-plan",
        "record-empty-crucible",
        "calculate-carbonate-composition",
      ] as const) {
        expect(compiledParameter(definition, actionId, "tareConvention"), `${convention}/${actionId}`)
          .toBe(convention);
      }
      expect(validateGreenChemistryRouteManifest(definition)).toEqual([]);
    }
    expect(compiled[0].definition).not.toEqual(compiled[1].definition);
  });

  it("still refuses an unconfigured or third-token tare choice", async () => {
    bundledLabHarness = await createBundledLabHarness();
    await expect(
      bundledLabHarness.loadLab(GREEN_CHEMISTRY_LAB_ID, {
        ...validSetup(),
        tareConvention: UNCONFIGURED_TEXT,
      } as never),
    ).rejects.toThrow(/tareConvention/i);
    await expect(
      bundledLabHarness.loadLabWithoutSetup(GREEN_CHEMISTRY_LAB_ID),
    ).rejects.toThrow(/instructor-approved investigation setup/i);
  });

  it("uses the configured loader wrapper as the same binding authority", async () => {
    bundledLabHarness = await createBundledLabHarness();
    const { compileConfiguredGreenChemistry } = await import(
      "../../investigations/purifyMixtureGreenChemistry/configuredComposition"
    );
    const setup = validSetup();
    const loaderDefinition = await bundledLabHarness.loadLab(GREEN_CHEMISTRY_LAB_ID, setup);
    const wrapperDefinition = await compileConfiguredGreenChemistry(setup);
    expect(wrapperDefinition).toEqual(loaderDefinition);
    expectCompiledGreenContract(loaderDefinition, setup);
    expectCompiledGreenContract(wrapperDefinition, setup);

    // The custom route is the path a learner actually takes, so the alternate convention has to
    // survive it as well as the generic loader.
    const taredSetup: GreenChemistryApprovedConfiguration = {
      ...validSetup(),
      tareConvention: "tare-balance-with-crucible-plus-lid",
    };
    const taredLoader = await bundledLabHarness.loadLab(GREEN_CHEMISTRY_LAB_ID, taredSetup);
    const taredWrapper = await compileConfiguredGreenChemistry(taredSetup);
    expect(taredWrapper).toEqual(taredLoader);
    expectCompiledGreenContract(taredWrapper, taredSetup);
    expect(compiledParameter(taredWrapper, "record-empty-crucible", "tareConvention"))
      .toBe("tare-balance-with-crucible-plus-lid");
  });
});
