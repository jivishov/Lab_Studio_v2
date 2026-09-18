import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  atomById,
  atomFamilies,
  atomRegistry,
  deriveActionEffectContract,
  equipmentRoleById,
  equipmentRoleRegistry,
  missingRoleBindings,
  roleAcceptsEquipment,
} from "../atomRegistry";
import {
  validateInstanceBindings,
  validateTechniqueCompositionContract,
} from "../compositionValidation";
import { compatibleInteractionVerbs } from "../interactions";
import { actionVerbs, validateActionDefinition } from "../validation";
import { equipmentById } from "../../equipment/catalog";
import type {
  ActionDefinition,
  ActionSourceInventoryContract,
  LabCompositionSourceDefinition,
  TechniqueDefinition,
} from "../types";

const baseAction = (overrides: Partial<ActionDefinition> = {}): unknown => ({
  id: "weigh-sample",
  verb: "weigh",
  label: "Weigh the sample",
  parameters: {},
  prerequisites: [],
  stateChanges: [],
  invalidCases: [],
  feedback: { success: "ok", invalid: "no" },
  evidence: [],
  ...overrides,
});

describe("atom registry", () => {
  it("parses with unique atom ids and a known families set", () => {
    expect(atomRegistry.schema).toBe("lab-studio/atom-registry@2");
    expect(atomById.size).toBe(atomRegistry.atoms.length);
    expect(atomFamilies).toEqual([...atomFamilies].sort());
    expect(atomFamilies).toEqual(expect.arrayContaining([
      "calorimetry",
      "chromatography",
      "equilibrium",
      "filtration",
      "gravimetry",
      "kinetics",
      "measurement",
      "spectrophotometry",
      "titration",
      "weighing",
    ]));
  });

  it("declares only verbs and interaction types the runtime accepts together", () => {
    for (const atom of atomRegistry.atoms) {
      expect(actionVerbs).toContain(atom.verb);
      for (const type of atom.allowedInteractionTypes) {
        expect(compatibleInteractionVerbs[type]).toContain(atom.verb);
      }
    }
  });

  it("references only declared role slots", () => {
    for (const atom of atomRegistry.atoms) {
      for (const role of [...atom.requiredRoles, ...atom.optionalRoles]) {
        expect(equipmentRoleById.has(role)).toBe(true);
      }
    }
  });

  it("records an M/F/R/C basis on every source example", () => {
    for (const atom of atomRegistry.atoms) {
      for (const example of atom.sourceExamples) {
        expect(example.basis).toMatch(/^[MFRC](\/[MFRC])*$/);
        expect(example.sourceFile).toMatch(/_\d{4}-\d{2}-\d{2}\.md$/);
        // `safety` is the third table the registry legend, the `AtomSourceTable` type and
        // `scripts/checkContentConsistency.mjs` all recognise. Two waste-treatment atoms have cited
        // a numbered safety row since it was introduced, so omitting it here was a stale assertion.
        expect(["phase", "apparatus", "safety"]).toContain(example.sourceTable);
      }
    }
  });

  it("never cites an apparatus-assembly row as manual-stated", () => {
    // Apparatus tables have no Basis column, so an `M` there would be an invented claim. They are
    // table-supported: the basis must include `F`.
    for (const atom of atomRegistry.atoms) {
      for (const example of atom.sourceExamples) {
        if (example.sourceTable !== "apparatus") continue;
        expect(example.basis.split("/"), `${atom.id}/${example.step}`).toContain("F");
      }
    }
  });

  it("reports the role slots an action leaves unbound", () => {
    const atom = atomById.get("atom.rinse.quantitative-transfer");
    expect(atom).toBeDefined();
    expect(missingRoleBindings("atom.rinse.quantitative-transfer", undefined)).toEqual(
      atom?.requiredRoles,
    );
    expect(
      missingRoleBindings("atom.rinse.quantitative-transfer", {
        "rinse-water-source": "wash-bottle",
        "rinsed-vessel": "beaker-250ml",
      }),
    ).toEqual([]);
  });
});

describe("equipment role registry", () => {
  it("references only catalog equipment and matches each role kind to allowed categories", () => {
    for (const role of equipmentRoleRegistry.roles) {
      const allowedCategories = equipmentRoleRegistry.kindCategoryConstraints[role.kind];
      expect(allowedCategories).toBeDefined();
      for (const definitionId of role.allowedEquipmentIds) {
        const definition = equipmentById.get(definitionId);
        expect(definition, `${role.id} -> ${definitionId}`).toBeDefined();
        expect(allowedCategories).toContain(definition?.category);
      }
      for (const definitionId of role.prohibitedEquipmentIds ?? []) {
        expect(equipmentById.has(definitionId)).toBe(true);
        expect(role.allowedEquipmentIds).not.toContain(definitionId);
      }
    }
  });

  it("separates rinse-water delivery from measured solvent delivery", () => {
    expect(roleAcceptsEquipment("rinse-water-source", "wash-bottle")).toBe(true);
    expect(roleAcceptsEquipment("rinse-water-source", "burette-50ml")).toBe(false);
    expect(roleAcceptsEquipment("measured-solvent-source", "graduated-cylinder")).toBe(true);
    expect(roleAcceptsEquipment("measured-solvent-source", "wash-bottle")).toBe(false);
  });

  it("separates fixed-volume from variable-volume delivery", () => {
    expect(roleAcceptsEquipment("fixed-volume-delivery-device", "volumetric-flask")).toBe(true);
    expect(roleAcceptsEquipment("fixed-volume-delivery-device", "graduated-cylinder")).toBe(false);
    expect(roleAcceptsEquipment("variable-volume-measuring-device", "burette-50ml")).toBe(true);
    expect(roleAcceptsEquipment("variable-volume-measuring-device", "volumetric-flask")).toBe(false);
  });

  it("separates the analyte receiver from a vessel a probe is immersed in", () => {
    expect(roleAcceptsEquipment("analyte-receiver", "erlenmeyer-flask-250ml")).toBe(true);
    expect(roleAcceptsEquipment("analyte-receiver", "foam-cup-calorimeter")).toBe(false);
    expect(roleAcceptsEquipment("immersed-probe-vessel", "foam-cup-calorimeter")).toBe(true);
    expect(roleAcceptsEquipment("immersed-probe-instrument", "probe-thermometer")).toBe(true);
  });

  it("treats an unknown role as rejecting rather than permitting", () => {
    expect(roleAcceptsEquipment("no-such-role", "beaker-250ml")).toBe(false);
  });

  it("lets the shared sample-source role carry the approved liquid inventory containers", () => {
    expect(roleAcceptsEquipment("sample-source", "test-tube")).toBe(true);
    expect(roleAcceptsEquipment("sample-source", "sample-bottle")).toBe(true);
    expect(roleAcceptsEquipment("sample-source", "distilled-water-bottle")).toBe(true);
    expect(roleAcceptsEquipment("sample-source", "watch-glass")).toBe(false);
  });
});

describe("action atomic identity contract", () => {
  it("accepts an action with no atom identity so legacy content stays valid", () => {
    expect(validateActionDefinition(baseAction()).ok).toBe(true);
  });

  it("accepts an atom identity with resolvable role bindings", () => {
    const result = validateActionDefinition(
      baseAction({
        atomId: "atom.weigh.solid-portion",
        equipmentRoleBindings: {
          "balance-instrument": "analytical-balance",
          "weighed-vessel": "beaker-250ml",
        },
      }),
    );
    expect(result.errors).toEqual([]);
  });

  it("rejects role bindings that name unknown equipment", () => {
    const result = validateActionDefinition(
      baseAction({
        atomId: "atom.weigh.solid-portion",
        equipmentRoleBindings: { "balance-instrument": "not-real-equipment" },
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("not-real-equipment");
  });

  it("rejects role bindings that do not name an atom", () => {
    const result = validateActionDefinition(
      baseAction({ equipmentRoleBindings: { "balance-instrument": "analytical-balance" } }),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("atomId");
  });

  it("rejects a blank atom id", () => {
    const result = validateActionDefinition(baseAction({ atomId: "   " }));
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("atomId");
  });
});

describe("dilution final-volume evidence contract", () => {
  const finalVolumeAction = (overrides: Partial<ActionDefinition> = {}): ActionDefinition => baseAction({
    id: "record-final-volume",
    verb: "dilute",
    label: "Add solvent to the final volume",
    atomId: "atom.dilute.record-resulting-final-volume",
    parameters: { inputMode: "numeric" },
    equipmentRoleBindings: {
      "measured-solvent-source": "graduated-cylinder",
      "receiving-vessel": "volumetric-flask",
    },
    interaction: {
      type: "pourInto",
      sourceDefinitionId: "graduated-cylinder",
      targetDefinitionId: "volumetric-flask",
      accessibleLabel: "Add the measured solvent to the receiving vessel.",
    },
    volume: { source: "action-input", outputMeasurementId: "final-volume" },
    ...overrides,
  }) as ActionDefinition;

  it("derives measurement and evidence effects only for the paired opt-in atom", () => {
    const valid = deriveActionEffectContract(finalVolumeAction());
    expect(valid.errors).toEqual([]);
    expect(valid.contract?.classes).toEqual([
      "apparatus-material-instrument-state",
      "measurement-direct-observation-acquisition",
      "evidence-recording",
    ]);
    expect(valid.contract?.targets).toEqual([
      { domain: "equipment" },
      { domain: "material" },
      { domain: "measurement-observation" },
      { domain: "evidence" },
    ]);

    const physicalOnly = deriveActionEffectContract(finalVolumeAction({
      atomId: "atom.dilute.to-final-volume",
    }));
    expect(physicalOnly.errors.join(" ")).toContain("record-resulting-final-volume");

    const missingOutput = deriveActionEffectContract(finalVolumeAction({
      volume: { source: "action-input" },
    }));
    expect(missingOutput.errors.join(" ")).toContain("volume.outputMeasurementId");
  });
});

describe("observe handler effect derivation", () => {
  const configurationAction = (
    parameters: ActionDefinition["parameters"],
    overrides: Partial<ActionDefinition> = {},
  ): ActionDefinition => baseAction({
    id: "configure-photometer",
    verb: "observe",
    interaction: {
      type: "recordNotebook",
      valueParameter: "note",
      accessibleLabel: "Configure the photometer.",
    },
    parameters,
    ...overrides,
  }) as ActionDefinition;

  it("derives the active configuration mutation for a recordNotebook observe action", () => {
    const result = deriveActionEffectContract(configurationAction({
      configurationQuantity: "scan wavelength",
      photometerConfigurationMode: "wavelength-scan",
      photometerInstanceId: "fixture-photometer",
      configuredValue: 400,
      measurementId: "fixture-wavelength",
      unit: "nm",
    }));

    expect(result.errors).toEqual([]);
    expect(result.contract?.classes).toEqual([
      "apparatus-material-instrument-state",
      "evidence-recording",
    ]);
    expect(result.contract?.targets).toEqual([
      { domain: "instrument" },
      { domain: "measurement-observation" },
      { domain: "evidence" },
    ]);
  });

  it("uses the ordinary configuration branch when no active photometer state can be selected", () => {
    const result = deriveActionEffectContract(configurationAction({
      configurationQuantity: "measurement wavelength",
      configuredValue: 630,
      measurementId: "fixture-wavelength",
      unit: "nm",
    }, {
      atomId: "atom.observe.configure-photometer",
      equipmentRoleBindings: { "photometer-instrument": "spectrophotometer" },
    }));

    expect(result.errors).toEqual([]);
    expect(result.contract?.classes).toEqual([
      "measurement-direct-observation-acquisition",
      "evidence-recording",
    ]);
    expect(result.contract?.classes).not.toContain("apparatus-material-instrument-state");

    const missingInstrument = deriveActionEffectContract(configurationAction({
      configurationQuantity: "scan wavelength",
      photometerConfigurationMode: "wavelength-scan",
      configuredValue: 400,
      measurementId: "fixture-wavelength",
      unit: "nm",
    }, {
      atomId: "atom.observe.configure-photometer",
      equipmentRoleBindings: { "photometer-instrument": "spectrophotometer" },
    }));
    expect(missingInstrument.errors).toEqual([]);
    expect(missingInstrument.contract?.classes).toEqual([
      "measurement-direct-observation-acquisition",
      "evidence-recording",
    ]);
  });

  it("gives earlier observe and typed read handlers precedence over an active configuration claim", () => {
    const earlierTemperature = deriveActionEffectContract(configurationAction({
      configurationQuantity: "scan wavelength",
      photometerConfigurationMode: "wavelength-scan",
      photometerInstanceId: "fixture-photometer",
      temperatureEvidenceKind: "live",
      measurementId: "fixture-temperature",
    }));
    expect(earlierTemperature.errors).toEqual([]);
    expect(earlierTemperature.contract?.classes).toEqual([
      "measurement-direct-observation-acquisition",
    ]);

    const typedRead = deriveActionEffectContract(configurationAction({
      configurationQuantity: "scan wavelength",
      photometerConfigurationMode: "wavelength-scan",
      photometerInstanceId: "fixture-photometer",
      photometerOperation: "read",
      measurementId: "fixture-reading",
    }, {
      interaction: {
        type: "readInstrument",
        sourceDefinitionId: "cuvette",
        targetDefinitionId: "spectrophotometer",
        accessibleLabel: "Read the photometer.",
      },
    }));
    expect(typedRead.errors).toEqual([]);
    expect(typedRead.contract?.classes).toEqual([
      "measurement-direct-observation-acquisition",
    ]);
  });

  it("retains atom compatibility errors when an ordinary configuration claims the active-state atom", () => {
    const result = deriveActionEffectContract(configurationAction({
      configurationQuantity: "measurement wavelength",
      photometerInstanceId: "fixture-photometer",
      configuredValue: 630,
      measurementId: "fixture-wavelength",
      unit: "nm",
    }, {
      atomId: "atom.observe.set-active-photometer-wavelength",
      equipmentRoleBindings: { "photometer-instrument": "spectrophotometer" },
    }));

    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining("requires an active photometer configuration mode"),
      expect.stringContaining('derives effect class "measurement-direct-observation-acquisition"'),
    ]));
  });

  it("does not let a typed photometer read borrow the role-free numeric configuration atom", () => {
    const ordinaryConfiguration = deriveActionEffectContract(configurationAction({
      configurationQuantity: "teacher-approved numeric value",
      measurementId: "fixture-configuration",
      inputMode: "numeric",
      inputRole: "teacherConfiguration",
      unit: "mL",
    }, {
      atomId: "atom.observe.record-teacher-configured-numeric-value",
    }));
    expect(ordinaryConfiguration.errors).toEqual([]);

    const typedRead = deriveActionEffectContract(configurationAction({
      configurationQuantity: "spoofed reading",
      measurementId: "fixture-reading",
      inputMode: "numeric",
      inputRole: "teacherConfiguration",
      photometerOperation: "read",
      photometerInstanceId: "fixture-photometer",
    }, {
      atomId: "atom.observe.record-teacher-configured-numeric-value",
      equipmentRoleBindings: {},
      interaction: {
        type: "readInstrument",
        sourceDefinitionId: "cuvette",
        targetDefinitionId: "spectrophotometer",
        accessibleLabel: "Read the photometer.",
      },
    }));

    expect(typedRead.errors).toEqual(expect.arrayContaining([
      expect.stringContaining("ordinary teacher-configured numeric observe branch"),
    ]));
  });

  it("does not let a typed titration endpoint borrow the role-free numeric configuration atom", () => {
    const typedTitration = deriveActionEffectContract(configurationAction({
      configurationQuantity: "spoofed titration observation",
      inputMode: "numeric",
      inputRole: "teacherConfiguration",
      titrationOperation: "observe",
      trialReferenceId: "fixture-trial",
      buretteInstanceId: "fixture-burette",
      receiverInstanceId: "fixture-receiver",
      titrationModelId: "fixture-model",
    }, {
      atomId: "atom.observe.record-teacher-configured-numeric-value",
    }));

    expect(typedTitration.errors).toEqual(expect.arrayContaining([
      expect.stringContaining("requires a matching registered titration operation"),
      expect.stringContaining("ordinary teacher-configured numeric observe branch"),
    ]));
  });
});

/** Authored, not executed: F05B's verification boundary is source review only. */
describe("typed setup and external-transition contracts", () => {
  const inventoryAction = (
    sourceInventory: unknown,
    parameters: Record<string, unknown> = {},
  ): Record<string, unknown> => ({
    id: "configure-stock",
    verb: "observe",
    label: "Configure the stock",
    interaction: { type: "recordNotebook", valueParameter: "tag", accessibleLabel: "Configure the stock." },
    parameters: { inputMode: "numeric", inputRole: "teacherConfiguration", unit: "g", ...parameters },
    prerequisites: [],
    stateChanges: [],
    invalidCases: [],
    feedback: { success: "ok", invalid: "no" },
    evidence: [],
    // Keep this raw at the validation boundary: several cases deliberately exercise malformed
    // content as it would arrive from JSON, rather than claiming it already satisfies the schema.
    sourceInventory,
  });
  const solidInventory = {
    quantityKind: "solid-mass",
    sourceInstanceId: "stock",
    sourceDefinitionId: "small-vial",
    outputMeasurementId: "configured-stock",
    materialSoluteId: "configured-solid",
    materialLabel: "Configured solid",
  } satisfies ActionSourceInventoryContract;

  it("accepts a solid-mass inventory on a pourable solid container in grams", () => {
    expect(validateActionDefinition(inventoryAction(solidInventory)).errors).toEqual([]);
  });

  it("keeps the omitted-discriminator liquid form as the legacy mL contract", () => {
    const legacy = validateActionDefinition(inventoryAction(
      { sourceInstanceId: "stock", sourceDefinitionId: "sample-bottle", outputMeasurementId: "inventory" },
      { unit: "mL" },
    ));
    expect(legacy.errors).toEqual([]);
    // A capacityless container is still rejected by the liquid form, and grams are not its unit.
    const noCapacity = validateActionDefinition(inventoryAction(
      { sourceDefinitionId: "watch-glass", outputMeasurementId: "inventory" },
      { unit: "mL" },
    ));
    expect(noCapacity.ok).toBe(false);
    expect(noCapacity.errors.join(" ")).toContain("positive mL capacity");
  });

  it("rejects a solid inventory that omits its single component, its unit, or its teacher role", () => {
    // The runtime keys its one-initialization-per-physical-setup lifecycle marker to the resolved
    // source instance, so the solid form has to name that instance rather than letting the reducer
    // take the first container of the definition. The liquid form above still may omit it.
    const noInstance = validateActionDefinition(inventoryAction({ ...solidInventory, sourceInstanceId: undefined }));
    expect(noInstance.ok).toBe(false);
    expect(noInstance.errors.join(" ")).toContain("sourceInstanceId");

    const noSolute = validateActionDefinition(inventoryAction({ ...solidInventory, materialSoluteId: undefined }));
    expect(noSolute.ok).toBe(false);
    expect(noSolute.errors.join(" ")).toContain("materialSoluteId");

    const noLabel = validateActionDefinition(inventoryAction({ ...solidInventory, materialLabel: undefined }));
    expect(noLabel.ok).toBe(false);
    expect(noLabel.errors.join(" ")).toContain("materialLabel");

    const wrongUnit = validateActionDefinition(inventoryAction(solidInventory, { unit: "mL" }));
    expect(wrongUnit.ok).toBe(false);
    expect(wrongUnit.errors.join(" ")).toContain('parameters.unit "g"');

    const learnerOwned = validateActionDefinition(inventoryAction(solidInventory, { inputRole: "studentResponse" }));
    expect(learnerOwned.ok).toBe(false);
    expect(learnerOwned.errors.join(" ")).toContain("teacherConfiguration");
  });

  it("refuses to carry solid-mass fields on the liquid form or a mass contract on the solid form", () => {
    const strayFields = validateActionDefinition(inventoryAction(
      { sourceDefinitionId: "sample-bottle", outputMeasurementId: "inventory", materialSoluteId: "x" },
      { unit: "mL" },
    ));
    expect(strayFields.ok).toBe(false);
    expect(strayFields.errors.join(" ")).toContain("materialSoluteId is legal only");

    const withMass = validateActionDefinition({
      ...inventoryAction(solidInventory),
      mass: { source: "action-input", outputMeasurementId: "stock-mass" },
    });
    expect(withMass.ok).toBe(false);
    expect(withMass.errors.join(" ")).toContain("cannot be combined with a mass contract");
  });

  it("accepts the external-transition confirmation form and keeps dissolve behaviour", () => {
    const external = validateActionDefinition(baseAction({
      id: "confirm-external",
      verb: "observe",
      atomId: "atom.observe.confirm-external-material-transition",
      equipmentRoleBindings: { "receiving-vessel": "beaker-250ml" },
      interaction: { type: "recordNotebook", valueParameter: "tag", accessibleLabel: "Confirm the external operation." },
      parameters: { targetInstanceId: "vessel", targetDefinitionId: "beaker-250ml", externalOperationActor: "teacher", tag: "done" },
      materialTransition: { kind: "solution", label: "Diluted", wetState: "wet", visualState: "clear-solution" },
    }));
    expect(external.errors).toEqual([]);

    const dissolve = validateActionDefinition(baseAction({
      id: "dissolve-solid",
      verb: "dissolve",
      interaction: { type: "pourInto", sourceDefinitionId: "small-vial", targetDefinitionId: "beaker-250ml", accessibleLabel: "Dissolve." },
      parameters: { sourceDefinitionId: "small-vial", targetDefinitionId: "beaker-250ml" },
      materialTransition: { kind: "solution", visualState: "clear-solution" },
    }));
    expect(dissolve.errors).toEqual([]);
  });

  it("rejects an external transition that omits its actor, its target, or smuggles a quantity", () => {
    const externalBase = {
      id: "confirm-external",
      verb: "observe" as const,
      interaction: { type: "recordNotebook" as const, valueParameter: "tag", accessibleLabel: "Confirm." },
      parameters: { targetInstanceId: "vessel", targetDefinitionId: "beaker-250ml", externalOperationActor: "teacher" },
      materialTransition: { kind: "solution" as const, visualState: "clear-solution" },
    };
    const noActor = validateActionDefinition(baseAction({
      ...externalBase,
      parameters: { targetInstanceId: "vessel", targetDefinitionId: "beaker-250ml" },
    }));
    expect(noActor.ok).toBe(false);
    expect(noActor.errors.join(" ")).toContain("externalOperationActor");

    const noTarget = validateActionDefinition(baseAction({ ...externalBase, parameters: { externalOperationActor: "teacher" } }));
    expect(noTarget.ok).toBe(false);
    expect(noTarget.errors.join(" ")).toContain("targetInstanceId");

    const withVolume = validateActionDefinition(baseAction({
      ...externalBase,
      volume: { source: "action-input" },
    }));
    expect(withVolume.ok).toBe(false);
    expect(withVolume.errors.join(" ")).toContain("cannot declare a volume contract");

    // A physical transition still needs a supported endpoint: an observe action that only reads an
    // instrument is not the external confirmation form.
    const wrongEndpoint = validateActionDefinition(baseAction({
      ...externalBase,
      interaction: { type: "readInstrument", sourceDefinitionId: "beaker-250ml", targetDefinitionId: "analytical-balance", accessibleLabel: "Read." },
    }));
    expect(wrongEndpoint.ok).toBe(false);
    expect(wrongEndpoint.errors.join(" ")).toContain("external-transition confirmation");
  });

  it("derives the physical and evidence effects for omitted and explicit liquid inventories", () => {
    const expectedClasses = ["apparatus-material-instrument-state", "evidence-recording"];
    const expectedTargets = [{ domain: "equipment" }, { domain: "material" }, { domain: "evidence" }];
    const derive = (sourceInventory: NonNullable<ActionDefinition["sourceInventory"]>, unit = "mL") => deriveActionEffectContract(baseAction({
      id: "configure-stock",
      verb: "observe",
      atomId: "atom.observe.configure-liquid-stock-inventory",
      equipmentRoleBindings: { "sample-source": String(sourceInventory.sourceDefinitionId) },
      interaction: { type: "recordNotebook", valueParameter: "tag", accessibleLabel: "Configure." },
      parameters: { inputMode: "numeric", inputRole: "teacherConfiguration", unit },
      sourceInventory,
    }) as ActionDefinition);

    const omittedLiquid = derive({
      sourceInstanceId: "stock",
      sourceDefinitionId: "sample-bottle",
      outputMeasurementId: "inventory",
    });
    expect(omittedLiquid.errors).toEqual([]);
    expect(omittedLiquid.contract?.classes).toEqual(expectedClasses);
    expect(omittedLiquid.contract?.targets).toEqual(expectedTargets);

    const explicitLiquid = derive({
      quantityKind: "liquid-volume",
      sourceInstanceId: "stock",
      sourceDefinitionId: "distilled-water-bottle",
      outputMeasurementId: "inventory",
    });
    expect(explicitLiquid.errors).toEqual([]);
    expect(explicitLiquid.contract?.classes).toEqual(expectedClasses);
    expect(explicitLiquid.contract?.targets).toEqual(expectedTargets);

    const solidSetup = deriveActionEffectContract(baseAction({
      id: "configure-stock",
      verb: "observe",
      atomId: "atom.observe.configure-solid-stock-inventory",
      equipmentRoleBindings: { "solid-reagent-source": "small-vial" },
      interaction: { type: "recordNotebook", valueParameter: "tag", accessibleLabel: "Configure." },
      parameters: { inputMode: "numeric", inputRole: "teacherConfiguration", unit: "g" },
      sourceInventory: solidInventory,
    }) as ActionDefinition);
    expect(solidSetup.errors).toEqual([]);
    expect(solidSetup.contract?.classes).toEqual(expectedClasses);
    expect(solidSetup.contract?.targets).toEqual(expectedTargets);

    const externalTransition = deriveActionEffectContract(baseAction({
      id: "confirm-external",
      verb: "observe",
      atomId: "atom.observe.confirm-external-material-transition",
      equipmentRoleBindings: { "receiving-vessel": "beaker-250ml" },
      interaction: { type: "recordNotebook", valueParameter: "tag", accessibleLabel: "Confirm." },
      parameters: { targetInstanceId: "vessel", targetDefinitionId: "beaker-250ml", externalOperationActor: "teacher" },
      materialTransition: { kind: "solution", visualState: "clear-solution" },
    }) as ActionDefinition);
    expect(externalTransition.errors).toEqual([]);
    expect(externalTransition.contract?.classes).toContain("apparatus-material-instrument-state");

  });

  it("wires every current liquid-inventory owner to the typed atom and removes its legacy effect", () => {
    const owners: Array<[string, string, string]> = [
      ["techniques/brass-spectrophotometry.json", "scan-configure-salt-a-inventory-action", "test-tube"],
      ["techniques/brass-spectrophotometry.json", "scan-configure-salt-b-inventory-action", "test-tube"],
      ["techniques/blue1-percent-transmittance.json", "i1-configure-unknown-operational-inventory", "sample-bottle"],
      ["techniques/blue1-percent-transmittance.json", "i1-configure-unknown-dilution-water", "distilled-water-bottle"],
    ];
    for (const [relativeFile, actionId, sourceDefinitionId] of owners) {
      const technique = JSON.parse(readFileSync(join(process.cwd(), "public", relativeFile), "utf8")) as TechniqueDefinition;
      const action = technique.actions.find((candidate) => candidate.id === actionId);
      expect(action, `${technique.id}/${actionId}`).toBeDefined();
      expect(action?.atomId).toBe("atom.observe.configure-liquid-stock-inventory");
      expect(action?.equipmentRoleBindings).toEqual({ "sample-source": sourceDefinitionId });
      expect(deriveActionEffectContract(action as ActionDefinition).errors).toEqual([]);
      expect(technique.composition?.legacyActionEffects?.some((entry) => entry.actionId === actionId)).toBe(false);
    }
  });

  it("rejects an incompatible source-role declaration through composition validation", () => {
    const technique = JSON.parse(readFileSync(
      join(process.cwd(), "public", "techniques", "blue1-percent-transmittance.json"),
      "utf8",
    )) as TechniqueDefinition;
    const lab = JSON.parse(readFileSync(
      join(process.cwd(), "public", "labs", "blue1-spectroscopy.json"),
      "utf8",
    )) as LabCompositionSourceDefinition;
    const instance = lab.techniqueInstances.find((candidate) => candidate.techniqueId === technique.id);
    if (!instance) throw new Error("Expected the repaired Blue1 technique instance.");
    const invalidInstance = structuredClone(instance);
    const sampleBinding = invalidInstance.bindings.equipment["sample-source"];
    if (!sampleBinding || !("sourceInstances" in sampleBinding) || !sampleBinding.sourceInstances) {
      throw new Error("Expected explicit Blue1 sample-source mappings.");
    }
    sampleBinding.sourceInstances = sampleBinding.sourceInstances.map((mapping) =>
      mapping.sourceInstanceId === "i1-unknown-sample"
        ? { ...mapping, definitionId: "watch-glass" }
        : mapping,
    );
    const errors = validateInstanceBindings(lab, invalidInstance, technique);
    expect(errors.some((error) => error.includes("sample-source") && error.includes("watch-glass"))).toBe(true);
  });

  it("keeps the repaired Blue1 composition consumer and version pin aligned", () => {
    const technique = JSON.parse(readFileSync(
      join(process.cwd(), "public", "techniques", "blue1-percent-transmittance.json"),
      "utf8",
    )) as TechniqueDefinition;
    const lab = JSON.parse(readFileSync(
      join(process.cwd(), "public", "labs", "blue1-spectroscopy.json"),
      "utf8",
    )) as LabCompositionSourceDefinition;
    const instance = lab.techniqueInstances.find((candidate) => candidate.techniqueId === technique.id);
    if (!instance) throw new Error("Expected the repaired Blue1 technique instance.");

    expect(instance.version).toBe(technique.metadata.version);
    expect(validateTechniqueCompositionContract(technique).errors).toEqual([]);
    expect(validateInstanceBindings(lab, instance, technique)).toEqual([]);
    const sampleRole = technique.composition?.equipmentRoles.find((role) => role.roleId === "sample-source");
    expect(sampleRole?.sourceInstanceIds).toEqual(expect.arrayContaining([
      "i1-unknown-sample",
      "i1-unknown-dilution-water",
    ]));
    const sampleBinding = instance.bindings.equipment["sample-source"];
    if (!sampleBinding || !("sourceInstances" in sampleBinding) || !sampleBinding.sourceInstances) {
      throw new Error("Expected explicit Blue1 sample-source mappings.");
    }
    expect(sampleBinding.sourceInstances.map((mapping) => mapping.sourceInstanceId)).toEqual(
      expect.arrayContaining(["i1-unknown-sample", "i1-unknown-dilution-water"]),
    );
  });
});
