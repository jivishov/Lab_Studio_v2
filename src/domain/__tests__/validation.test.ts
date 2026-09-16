import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ActionDefinition, LabDefinition, TechniqueDefinition } from "../types";
import {
  bundledLabs,
  demoLab,
  dryingTechnique,
  filtrationTechnique,
  hardWaterDemoLab,
  standaloneTechniques,
  thermalDecompositionTechnique,
} from "../fixtures";
import { resolveActionInteraction } from "../interactions";
import { withGeneratedProcessLayouts } from "../processLayout";
import {
  validateActionDefinition,
  validateBundledLabSource,
  validateLabDefinition,
  validatePublicJsonForPublishing,
  validateTechniqueDefinition,
} from "../validation";
import { v1EquipmentCatalog } from "../../equipment/catalog";
import { validateEquipmentDefinition } from "../validation";

const loadPublicLab = (file: string): LabDefinition =>
  JSON.parse(readFileSync(join(process.cwd(), "public", "labs", file), "utf8")) as LabDefinition;

const loadPublicTechnique = (file: string): TechniqueDefinition =>
  JSON.parse(readFileSync(join(process.cwd(), "public", "techniques", file), "utf8")) as TechniqueDefinition;

const loadPublicIndex = (folder: "labs" | "techniques") =>
  JSON.parse(readFileSync(join(process.cwd(), "public", folder, "index.json"), "utf8")) as Array<{
    id: string;
    title: string;
    description: string;
    file: string;
  }>;

describe("domain validation", () => {
  it("validates the equipment catalog", () => {
    const results = v1EquipmentCatalog.map(validateEquipmentDefinition);
    expect(results.every((result) => result.ok)).toBe(true);
  });

  it("validates standalone technique fixtures", () => {
    const results = standaloneTechniques.map(validateTechniqueDefinition);
    expect(results.every((result) => result.ok)).toBe(true);
  });

  it("validates bundled lab fixtures", () => {
    const results = bundledLabs.map((lab) => validateLabDefinition(lab));
    expect(results.every((result) => result.ok)).toBe(true);
  });

  it("validates every public JSON artifact referenced by the published indexes", () => {
    const labs = loadPublicIndex("labs").map((entry) => loadPublicLab(entry.file));
    const techniques = loadPublicIndex("techniques").map((entry) => loadPublicTechnique(entry.file));

    // Public lab files are *bundled sources*: they may pin technique action references whose ids
    // only resolve after hydration, so the raw contract is the one that applies on disk.
    expect(labs.map((lab) => validateBundledLabSource(lab).errors)).toEqual(labs.map(() => []));
    expect(techniques.map((technique) => validateTechniqueDefinition(technique).errors)).toEqual(
      techniques.map(() => []),
    );
    expect([...labs, ...techniques].map((artifact) => validatePublicJsonForPublishing(artifact).errors)).toEqual(
      [...labs, ...techniques].map(() => []),
    );
  });

  it("accepts Quick Ache mass aliases only while their structural exclusivity proof remains intact", () => {
    const quickAche = loadPublicTechnique("quick-ache-extraction-recovery.json");
    expect(validateTechniqueDefinition(quickAche).errors).toEqual([]);

    const brokenAliasContract = structuredClone(quickAche);
    const acidicGravity = brokenAliasContract.composition?.orderedProcedure?.groups.find(
      (group) => group.id === "acidic-gravity",
    );
    if (!acidicGravity?.actionAliases) {
      throw new Error("Quick Ache acidic-gravity aliases are required for this regression fixture.");
    }
    delete acidicGravity.actionAliases["qar-weigh-filter-paper-tare"];

    const result = validateTechniqueDefinition(brokenAliasContract);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain('repeats structured output "qar-filter-paper-mass"');

    const thirdProducerContract = structuredClone(quickAche);
    const thirdProducer = thirdProducerContract.actions.find(
      (action) => action.id === "qar-weigh-acidic-watch-glass-tare",
    );
    if (!thirdProducer?.mass || thirdProducer.mass.source !== "action-input") {
      throw new Error("Quick Ache acidic tare must remain an action-input mass producer.");
    }
    thirdProducer.mass.outputMeasurementId = "qar-filter-paper-mass";

    const thirdProducerResult = validateTechniqueDefinition(thirdProducerContract);
    expect(thirdProducerResult.ok).toBe(false);
    expect(thirdProducerResult.errors.join(" ")).toContain('repeats structured output "qar-filter-paper-mass"');
  });

  it("keeps hard-water precipitation authored with the semantic precipitate verb", () => {
    // Published lab JSON is a composition source: its imported `actions` array is intentionally
    // empty until hydration. The semantic action remains owned by the bundled fixture inputs.
    const precipitateActions = [demoLab, hardWaterDemoLab]
      .flatMap((lab) => lab.actions)
      .filter((action) => action.id === "precipitate-caco3");

    expect(precipitateActions.length).toBeGreaterThan(0);
    expect(precipitateActions.every((action) => action.verb === "precipitate")).toBe(true);
    expect(precipitateActions.every((action) => action.label === "Precipitate calcium carbonate")).toBe(true);
  });

  it("validates explicit physical interaction specs", () => {
    const action = filtrationTechnique.actions.find((candidate) => candidate.id === "place-filter-paper");
    expect(action?.interaction).toMatchObject({
      type: "snapIntoTarget",
      sourceDefinitionId: "filter-paper",
      targetDefinitionId: "funnel-stand",
      snapZoneId: "funnel-stand-paper-seat",
    });
    const result = validateTechniqueDefinition(filtrationTechnique);
    expect(result.ok).toBe(true);
  });

  it("rejects broken interaction references", () => {
    const broken = {
      ...filtrationTechnique,
      actions: filtrationTechnique.actions.map((action) =>
        action.id === "place-filter-paper"
          ? {
              ...action,
              interaction: {
                type: "snapIntoTarget",
                sourceDefinitionId: "wash-bottle",
                targetDefinitionId: "funnel-stand",
                snapZoneId: "funnel-stand-paper-seat",
                accessibleLabel: "",
              },
            }
          : action,
      ),
    };
    const result = validateTechniqueDefinition(broken);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("does not accept source equipment");
    expect(result.errors.join(" ")).toContain("accessibleLabel");
  });

  it("rejects non-pourable equipment as a pour source", () => {
    const measureAction = standaloneTechniques
      .find((technique) => technique.id === "measuring-volume")
      ?.actions.find((action) => action.id === "measure-20ml");
    if (!measureAction) throw new Error("Missing measure action.");

    const broken = {
      ...measureAction,
      parameters: {
        ...measureAction.parameters,
        sourceDefinitionId: "sample-rack",
      },
      interaction: {
        ...measureAction.interaction!,
        sourceDefinitionId: "sample-rack",
      },
    };

    const result = validateActionDefinition(broken, "action", {
      equipmentIds: new Set(["sample-rack", "graduated-cylinder"]),
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("pourable equipment");
  });

  it("rejects authored physical actions that are missing source or target endpoints", () => {
    const rinseAction = filtrationTechnique.actions.find((action) => action.id === "wet-filter-paper");
    if (!rinseAction) throw new Error("Missing rinse action.");

    const result = validateActionDefinition(
      {
        ...rinseAction,
        parameters: {
          ...rinseAction.parameters,
          sourceDefinitionId: undefined,
        },
        interaction: undefined,
      },
      "action",
      { equipmentIds: new Set(filtrationTechnique.requiredEquipment) },
    );

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("requires sourceDefinitionId and targetDefinitionId");
  });

  it("rejects malformed thermal action shapes", () => {
    const heatAction = thermalDecompositionTechnique.actions.find(
      (action) =>
        action.id === "heat-carbonate-mixture" &&
        action.atomId === "atom.heat.thermal-decomposition-stage",
    );
    const coolAction = thermalDecompositionTechnique.actions.find((action) => action.id === "cool-crucible");
    if (!heatAction || !coolAction) throw new Error("Missing thermal decomposition actions.");

    const brokenHeat = validateActionDefinition(
      {
        ...heatAction,
        // The current authored stage is represented as a dry operation for runtime routing, but
        // the validator's heat-shape contract is still exercised by its atomic heating identity.
        verb: "heat",
        parameters: {
          ...heatAction.parameters,
          targetDefinitionId: undefined,
          heatedMassG: undefined,
          productMassG: undefined,
        },
        interaction: undefined,
      },
      "action",
      { equipmentIds: new Set(thermalDecompositionTechnique.requiredEquipment) },
    );

    expect(brokenHeat.ok).toBe(false);
    expect(brokenHeat.errors.join(" ")).toContain("requires sourceDefinitionId and targetDefinitionId");
    expect(brokenHeat.errors.join(" ")).toContain("heatedMassG");
    expect(brokenHeat.errors.join(" ")).toContain("productMassG");

    const impossibleHeat = validateActionDefinition(
      {
        ...heatAction,
        verb: "heat",
        parameters: {
          ...heatAction.parameters,
          heatedMassG: 1,
          productMassG: 2,
          heatedTemperatureC: 25,
        },
      },
      "action",
      { equipmentIds: new Set(thermalDecompositionTechnique.requiredEquipment) },
    );

    expect(impossibleHeat.ok).toBe(false);
    expect(impossibleHeat.errors.join(" ")).toContain("productMassG");
    expect(impossibleHeat.errors.join(" ")).toContain("heatedTemperatureC");

    const brokenCool = validateActionDefinition(
      {
        ...coolAction,
        parameters: {
          ...coolAction.parameters,
          sourceDefinitionId: undefined,
          cooledTemperatureC: -1,
        },
        interaction: undefined,
      },
      "action",
      { equipmentIds: new Set(thermalDecompositionTechnique.requiredEquipment) },
    );

    expect(brokenCool.ok).toBe(false);
    expect(brokenCool.errors.join(" ")).toContain("requires sourceDefinitionId and targetDefinitionId");
    expect(brokenCool.errors.join(" ")).toContain("cooledTemperatureC");
  });

  // Both bases are shipped transfer/pourInto solid actions from one technique: `add-carbonate-sample`
  // carries the single plan-target `parameters.massG` reference and no mass contract, and
  // `recover-unused-sample` carries no amount at all. Their role bindings predate `atomId`, so the
  // technique's own legacy-effect declaration is supplied the way `validateTechniqueDefinition`
  // builds it. Every accepted case is asserted as a delta against the same action without the
  // contract, because the contract is optional and must not change how existing content validates.
  const solidTransferAction = (id: string): ActionDefinition => {
    const action = thermalDecompositionTechnique.actions.find((candidate) => candidate.id === id);
    if (!action) throw new Error(`Missing ${id} action.`);
    return action;
  };

  const solidTransferContext = {
    equipmentIds: new Set(thermalDecompositionTechnique.requiredEquipment),
    compositionOwnedLegacyActionIds: new Set(["add-carbonate-sample", "recover-unused-sample"]),
  };

  it("accepts authored solid transfer contracts without changing existing action validation", () => {
    const measuredPortion = solidTransferAction("add-carbonate-sample");
    const wholeRemaining = solidTransferAction("recover-unused-sample");

    expect(validateActionDefinition(measuredPortion, "action", solidTransferContext).ok).toBe(true);
    expect(validateActionDefinition(wholeRemaining, "action", solidTransferContext).ok).toBe(true);

    const accepted: Array<{ action: ActionDefinition; solidTransfer: Record<string, unknown> }> = [
      { action: measuredPortion, solidTransfer: { mode: "measured-portion" } },
      { action: measuredPortion, solidTransfer: { mode: "measured-portion", destinationRepresentation: "physical" } },
      { action: wholeRemaining, solidTransfer: { mode: "whole-remaining" } },
      { action: wholeRemaining, solidTransfer: { mode: "whole-remaining", requireNonEmptySource: false } },
      {
        action: wholeRemaining,
        solidTransfer: { mode: "whole-remaining", destinationRepresentation: "qualitative-unknown", requireNonEmptySource: true },
      },
    ];

    for (const { action, solidTransfer } of accepted) {
      const baseline = validateActionDefinition(action, "action", solidTransferContext);
      const contracted = validateActionDefinition({ ...action, solidTransfer }, "action", solidTransferContext);
      expect(contracted.errors, JSON.stringify(solidTransfer)).toEqual(baseline.errors);
      expect(contracted.ok, JSON.stringify(solidTransfer)).toBe(baseline.ok);
    }

    for (const massIsPlanTargetNotMeasurement of [true, false]) {
      const measuredFlag = validateActionDefinition(
        {
          ...measuredPortion,
          parameters: { ...measuredPortion.parameters, massIsPlanTargetNotMeasurement },
          solidTransfer: { mode: "measured-portion", destinationRepresentation: "physical" },
        },
        "action",
        solidTransferContext,
      );
      expect(measuredFlag.ok, String(massIsPlanTargetNotMeasurement)).toBe(true);
    }
  });

  it("rejects malformed authored solid transfer contracts", () => {
    const action = solidTransferAction("recover-unused-sample");

    const unknownMode = validateActionDefinition(
      { ...action, solidTransfer: { mode: "empty-the-source" } },
      "action",
      solidTransferContext,
    );
    expect(unknownMode.ok).toBe(false);
    expect(unknownMode.errors.join(" ")).toContain("mode must be measured-portion or whole-remaining");

    const unknownRepresentation = validateActionDefinition(
      { ...action, solidTransfer: { mode: "whole-remaining", destinationRepresentation: "unmeasured" } },
      "action",
      solidTransferContext,
    );
    expect(unknownRepresentation.ok).toBe(false);
    expect(unknownRepresentation.errors.join(" ")).toContain("destinationRepresentation must be physical or qualitative-unknown");

    const nonBooleanRequirement = validateActionDefinition(
      { ...action, solidTransfer: { mode: "whole-remaining", requireNonEmptySource: "true" } },
      "action",
      solidTransferContext,
    );
    expect(nonBooleanRequirement.ok).toBe(false);
    expect(nonBooleanRequirement.errors.join(" ")).toContain("requireNonEmptySource must be boolean");

    // Provenance is the authoring mistake this closed allowlist exists to stop: `provenance` is a field
    // of the runtime `SolidTransferRequest`, and it can never be authored content.
    const authoredProvenance = validateActionDefinition(
      {
        ...action,
        solidTransfer: {
          mode: "whole-remaining",
          requireNonEmptySource: true,
          destinationRepresentation: "qualitative-unknown",
          provenance: { recordId: "recover-replicate-product-1" },
        },
      },
      "action",
      solidTransferContext,
    );
    expect(authoredProvenance.ok).toBe(false);
    expect(authoredProvenance.errors.join(" ")).toContain('contains unsupported field "provenance"');
  });

  it("rejects a qualitative-unknown destination outside a required non-empty whole-remaining transfer", () => {
    const measuredPortion = solidTransferAction("add-carbonate-sample");
    const wholeRemaining = solidTransferAction("recover-unused-sample");

    const optionallyEmptySource = validateActionDefinition(
      { ...wholeRemaining, solidTransfer: { mode: "whole-remaining", destinationRepresentation: "qualitative-unknown" } },
      "action",
      solidTransferContext,
    );
    expect(optionallyEmptySource.ok).toBe(false);
    expect(optionallyEmptySource.errors.join(" ")).toContain("qualitative-unknown requires a whole-remaining transfer with requireNonEmptySource true");

    const measuredAmount = validateActionDefinition(
      {
        ...measuredPortion,
        solidTransfer: { mode: "measured-portion", destinationRepresentation: "qualitative-unknown", requireNonEmptySource: true },
      },
      "action",
      solidTransferContext,
    );
    expect(measuredAmount.ok).toBe(false);
    expect(measuredAmount.errors.join(" ")).toContain("qualitative-unknown requires a whole-remaining transfer with requireNonEmptySource true");
  });

  it("requires exactly one amount authority for a measured-portion solid transfer", () => {
    const measuredPortion = solidTransferAction("add-carbonate-sample");
    const wholeRemaining = solidTransferAction("recover-unused-sample");

    const noAuthority = validateActionDefinition(
      { ...wholeRemaining, solidTransfer: { mode: "measured-portion" } },
      "action",
      solidTransferContext,
    );
    expect(noAuthority.ok).toBe(false);
    expect(noAuthority.errors.join(" ")).toContain("measured-portion requires a mass contract or a parameters.massG amount");

    const competingAuthorities = validateActionDefinition(
      {
        ...measuredPortion,
        mass: { source: "measurement", referenceId: "planned-sample-mass-g" },
        solidTransfer: { mode: "measured-portion" },
      },
      "action",
      solidTransferContext,
    );
    expect(competingAuthorities.ok).toBe(false);
    expect(competingAuthorities.errors.join(" ")).toContain("cannot take its amount from both a mass contract and parameters.massG");

    // A literal gram amount is an amount authority; the configured-slot reference the shipped action
    // already carries is checked for shape only, because the lab binds the slot at compile time.
    const literalParameters = { ...measuredPortion.parameters, massG: 2.5 };
    const literalBaseline = validateActionDefinition({ ...measuredPortion, parameters: literalParameters }, "action", solidTransferContext);
    const literalAmount = validateActionDefinition(
      { ...measuredPortion, parameters: literalParameters, solidTransfer: { mode: "measured-portion" } },
      "action",
      solidTransferContext,
    );
    expect(literalAmount.errors).toEqual(literalBaseline.errors);

    for (const massG of [0, -1, "{{config.sampleMassG", "sampleMassG"]) {
      const unusableAmount = validateActionDefinition(
        {
          ...measuredPortion,
          parameters: { ...measuredPortion.parameters, massG },
          solidTransfer: { mode: "measured-portion" },
        },
        "action",
        solidTransferContext,
      );
      expect(unusableAmount.ok, String(massG)).toBe(false);
      expect(unusableAmount.errors.join(" "), String(massG)).toContain("parameters.massG must be a positive finite number");
    }
  });

  it("rejects a second declared amount on a whole-remaining solid transfer", () => {
    const measuredPortion = solidTransferAction("add-carbonate-sample");
    const wholeRemaining = solidTransferAction("recover-unused-sample");

    const parameterAmount = validateActionDefinition(
      { ...measuredPortion, solidTransfer: { mode: "whole-remaining" } },
      "action",
      solidTransferContext,
    );
    expect(parameterAmount.ok).toBe(false);
    expect(parameterAmount.errors.join(" ")).toContain("whole-remaining cannot also declare parameters.massG");

    const massContract = validateActionDefinition(
      {
        ...wholeRemaining,
        mass: { source: "measurement", referenceId: "initial-crucible-mass-g" },
        solidTransfer: { mode: "whole-remaining" },
      },
      "action",
      solidTransferContext,
    );
    expect(massContract.ok).toBe(false);
    expect(massContract.errors.join(" ")).toContain("whole-remaining cannot also declare a mass contract");
  });

  it("restricts the solid transfer contract to transfer actions with a pourInto interaction", () => {
    const wholeRemaining = solidTransferAction("recover-unused-sample");

    const notebookEndpoint = validateActionDefinition(
      {
        ...wholeRemaining,
        interaction: { ...wholeRemaining.interaction!, type: "recordNotebook" },
        solidTransfer: { mode: "whole-remaining" },
      },
      "action",
      solidTransferContext,
    );
    expect(notebookEndpoint.ok).toBe(false);
    expect(notebookEndpoint.errors.join(" ")).toContain("legal only on transfer actions with a pourInto interaction");

    const observation = validateActionDefinition(
      { ...wholeRemaining, verb: "observe", solidTransfer: { mode: "whole-remaining" } },
      "action",
      solidTransferContext,
    );
    expect(observation.ok).toBe(false);
    expect(observation.errors.join(" ")).toContain("legal only on transfer actions with a pourInto interaction");
  });

  it("rejects a solid transfer contract beside a fraction handling contract", () => {
    const wholeRemaining = solidTransferAction("recover-unused-sample");

    // `collect-residue` is a fraction operation whose authored verb is `transfer`, so the verb alone
    // cannot separate the two contracts.
    const collectResidue = validateActionDefinition(
      {
        ...wholeRemaining,
        fractionHandling: {
          operation: "collect-residue",
          sourceInstanceId: "unused-sample-recovery-1",
          targetInstanceId: "crucible-with-lid-1",
          fractionId: "unused-mixture",
        },
        solidTransfer: { mode: "whole-remaining" },
      },
      "action",
      solidTransferContext,
    );
    expect(collectResidue.ok).toBe(false);
    expect(collectResidue.errors.join(" ")).toContain("fractionHandling cannot compete with solidTransfer");
  });

  it("accepts a compatible legacy solid-transfer parameter pair and rejects a competing one", () => {
    const wholeRemaining = solidTransferAction("recover-unused-sample");
    const legacyParameters = {
      ...wholeRemaining.parameters,
      emptyRemainingSolid: true,
      requireNonEmptySolidSource: true,
    };

    // The migration input: shipped content keeps the legacy pair while the typed contract states the
    // same mode and the same obligation, so nothing about it may become invalid.
    const legacyOnly = structuredClone(wholeRemaining);
    delete legacyOnly.solidTransfer;
    const compatibleBaseline = validateActionDefinition({ ...legacyOnly, parameters: legacyParameters }, "action", solidTransferContext);
    const compatiblePair = validateActionDefinition(
      {
        ...wholeRemaining,
        parameters: legacyParameters,
        solidTransfer: { mode: "whole-remaining", requireNonEmptySource: true },
      },
      "action",
      solidTransferContext,
    );
    expect(compatibleBaseline.ok).toBe(true);
    expect(compatiblePair.ok).toBe(true);
    expect(compatiblePair.errors).toEqual(compatibleBaseline.errors);

    const competingMode = validateActionDefinition(
      { ...wholeRemaining, parameters: legacyParameters, solidTransfer: { mode: "measured-portion" } },
      "action",
      solidTransferContext,
    );
    expect(competingMode.ok).toBe(false);
    expect(competingMode.errors.join(" ")).toContain("measured-portion competes with legacy parameters");

    const deniedObligation = validateActionDefinition(
      {
        ...wholeRemaining,
        parameters: legacyParameters,
        solidTransfer: { mode: "whole-remaining", requireNonEmptySource: false },
      },
      "action",
      solidTransferContext,
    );
    expect(deniedObligation.ok).toBe(false);
    expect(deniedObligation.errors.join(" ")).toContain("requireNonEmptySource must be true when legacy parameters.requireNonEmptySolidSource is true");

    const omittedObligation = validateActionDefinition(
      {
        ...wholeRemaining,
        parameters: legacyParameters,
        solidTransfer: { mode: "whole-remaining" },
      },
      "action",
      solidTransferContext,
    );
    expect(omittedObligation.ok).toBe(false);
    expect(omittedObligation.errors.join(" ")).toContain("requireNonEmptySource must be true when legacy parameters.requireNonEmptySolidSource is true");

    // The reducer refuses `requireNonEmptySolidSource` without `emptyRemainingSolid`, so the typed
    // contract cannot be authored on top of that half-declared legacy pair either.
    const halfDeclaredLegacyPair = validateActionDefinition(
      {
        ...wholeRemaining,
        parameters: { ...wholeRemaining.parameters, requireNonEmptySolidSource: true },
        solidTransfer: { mode: "whole-remaining", requireNonEmptySource: true },
      },
      "action",
      solidTransferContext,
    );
    expect(halfDeclaredLegacyPair.ok).toBe(false);
    expect(halfDeclaredLegacyPair.errors.join(" ")).toContain("requireNonEmptySolidSource requires the legacy emptyRemainingSolid delivery");

    const legacyWholeSolidWithAmount = validateActionDefinition(
      {
        ...wholeRemaining,
        parameters: { ...legacyParameters, massG: 2.5 },
        solidTransfer: { mode: "whole-remaining", requireNonEmptySource: true },
      },
      "action",
      solidTransferContext,
    );
    expect(legacyWholeSolidWithAmount.ok).toBe(false);
    expect(legacyWholeSolidWithAmount.errors.join(" ")).toContain("parameters.massG cannot accompany a legacy whole-solid transfer");
  });

  it("validates titration models and authored model references", () => {
    const valid = {
      ...demoLab,
      titrationModels: [
        {
          id: "acid-base-model",
          type: "acidBase",
          analyte: { formula: "HCl", role: "acid", strength: "strong" },
          titrant: { formula: "NaOH", role: "base", strength: "strong" },
          analyteMolarityM: 0.1,
          analyteVolumeMl: 25,
          titrantMolarityM: 0.1,
          dropVolumeMl: 0.05,
          endpointOffsetDrops: 0,
          maxExtraDrops: 5,
          temperatureC: 25,
          waterIonProduct: 1e-14,
          phPrecision: 2,
        },
      ],
      actions: demoLab.actions.map((action, index) =>
        index === 0
          ? {
              ...action,
              parameters: {
                ...action.parameters,
                titrationModelId: "acid-base-model",
              },
            }
          : action,
      ),
    };

    expect(validateLabDefinition(valid).ok).toBe(true);

    const broken = {
      ...valid,
      titrationModels: [
        {
          ...valid.titrationModels[0],
          analyteVolumeMl: 0,
          endpointOffsetDrops: 0.5,
        },
      ],
      actions: valid.actions.map((action, index) =>
        index === 0
          ? {
              ...action,
              parameters: {
                ...action.parameters,
                titrationModelId: "missing-model",
              },
            }
          : action,
      ),
    };
    const result = validateLabDefinition(broken);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("analyteVolumeMl");
    expect(result.errors.join(" ")).toContain("endpointOffsetDrops");
    expect(result.errors.join(" ")).toContain("titrationModelId");

    const weakWithoutConstant = {
      ...valid,
      titrationModels: [
        {
          ...valid.titrationModels[0],
          analyte: { formula: "CH3COOH", role: "acid", strength: "weak" },
        },
      ],
    };
    expect(validateLabDefinition(weakWithoutConstant).errors.join(" ")).toContain("equilibriumConstant");
  });

  it("validates chromatography models and authored model references", () => {
    const valid = {
      ...filtrationTechnique,
      chromatographyModels: [
        {
          id: "food-dyes-paper",
          solventFrontMm: 80,
          bands: [
            {
              id: "blue",
              label: "Blue",
              color: "#2563eb",
              distanceMm: 64,
              expectedRf: 0.8,
            },
          ],
        },
      ],
      actions: filtrationTechnique.actions.map((action, index) =>
        index === 0
          ? {
              ...action,
              parameters: {
                ...action.parameters,
                chromatographyModelId: "food-dyes-paper",
              },
            }
          : action,
      ),
    };

    expect(validateTechniqueDefinition(valid).ok).toBe(true);

    const broken = {
      ...valid,
      chromatographyModels: [
        {
          ...valid.chromatographyModels[0],
          bands: [
            {
              ...valid.chromatographyModels[0].bands[0],
              expectedRf: 0.7,
            },
          ],
        },
      ],
      actions: valid.actions.map((action, index) =>
        index === 0
          ? {
              ...action,
              parameters: {
                ...action.parameters,
                chromatographyModelId: "missing-model",
              },
            }
          : action,
      ),
    };
    const result = validateTechniqueDefinition(broken);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("expectedRf");
    expect(result.errors.join(" ")).toContain("chromatographyModelId");
  });

  it("validates kinetics models and authored data-series references", () => {
    const valid = loadPublicLab("marble-statue-kinetics.json");
    expect(validateLabDefinition(valid).ok).toBe(true);

    const conditionModel = valid.kineticsModels?.find((model) => model.id === "marble-model-acid-2m");
    const condition = conditionModel?.conditions.find((candidate) => candidate.id === "guided-configuration");
    const recordAction = valid.actions.find((action) => action.id === "record-run-provenance-and-replicates");
    const calculateAction = valid.actions.find((action) => action.id === "create-kinetics-graph");
    if (!conditionModel || !condition || !recordAction || !calculateAction) {
      throw new Error("Missing current kinetics model, condition, record action, or calculation action.");
    }

    const authoredSeriesId = "student-co2-series";
    const authoredKinetics = {
      ...valid,
      actions: valid.actions.map((action) =>
        action.id === recordAction.id
          ? {
              ...action,
              verb: "record" as const,
              parameters: {
                ...action.parameters,
                kineticsModelId: conditionModel.id,
                conditionId: condition.id,
                dataSeriesId: authoredSeriesId,
              },
            }
          : action.id === calculateAction.id
            ? {
                ...action,
                verb: "calculate" as const,
                parameters: {
                  ...action.parameters,
                  template: "initialRateMlPerS",
                  dataSeriesId: authoredSeriesId,
                },
              }
            : action,
      ),
    };
    expect(validateLabDefinition(authoredKinetics).ok).toBe(true);

    const brokenCondition = {
      ...authoredKinetics,
      actions: authoredKinetics.actions.map((action) =>
        action.id === recordAction.id
          ? {
              ...action,
              parameters: {
                ...action.parameters,
                conditionId: "missing-condition",
              },
            }
          : action,
      ),
    };
    const conditionResult = validateLabDefinition(brokenCondition);
    expect(conditionResult.ok).toBe(false);
    expect(conditionResult.errors.join(" ")).toContain("conditionId");

    const brokenSeries = {
      ...authoredKinetics,
      actions: authoredKinetics.actions.map((action) =>
        action.id === calculateAction.id
          ? {
              ...action,
              parameters: {
                ...action.parameters,
                dataSeriesId: "missing-series",
              },
            }
          : action,
      ),
    };
    const seriesResult = validateLabDefinition(brokenSeries);
    expect(seriesResult.ok).toBe(false);
    expect(seriesResult.errors.join(" ")).toContain("dataSeriesId");

    const brokenTimepoints = {
      ...authoredKinetics,
      kineticsModels: valid.kineticsModels?.map((model) =>
        model.id === conditionModel.id
          ? {
              ...model,
              timepointsS: [5, 0, 15],
            }
          : model,
      ),
    };
    const timepointsResult = validateLabDefinition(brokenTimepoints);
    expect(timepointsResult.ok).toBe(false);
    expect(timepointsResult.errors.join(" ")).toContain("timepointsS");
  });

  it("requires a sample source for instrument placement interactions", () => {
    const broken = {
      ...dryingTechnique,
      actions: dryingTechnique.actions.map((action) =>
        action.id === "dry-precipitate"
          ? {
              ...action,
              interaction: action.interaction
                ? {
                    ...action.interaction,
                    sourceDefinitionId: undefined,
                  }
                : action.interaction,
            }
          : action,
      ),
    };

    const result = validateTechniqueDefinition(broken);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("sourceDefinitionId is required for placeInInstrument");
  });

  it("infers conservative interactions for legacy actions", () => {
    const explicit = filtrationTechnique.actions.find((candidate) => candidate.id === "place-filter-paper");
    if (!explicit) throw new Error("Missing fixture action.");
    const legacyAction = { ...explicit, interaction: undefined };
    const result = validateActionDefinition(legacyAction, "action", {
      equipmentIds: new Set(filtrationTechnique.requiredEquipment),
    });
    expect(result.ok).toBe(true);

    const interaction = resolveActionInteraction(legacyAction);
    expect(interaction).toMatchObject({
      type: "snapIntoTarget",
      sourceDefinitionId: "filter-paper",
      targetDefinitionId: "funnel-stand",
    });
    expect(interaction?.accessibleLabel).toContain("Place filter paper");

    const dryAction = { ...dryingTechnique.actions[0], interaction: undefined };
    expect(resolveActionInteraction(dryAction)).toMatchObject({
      type: "placeInInstrument",
      sourceDefinitionId: "watch-glass",
      targetDefinitionId: "drying-oven",
      stationId: "drying-oven",
    });
  });

  it("returns useful errors for invalid lab JSON", () => {
    const result = validateLabDefinition({ id: "broken" });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("lab.title");
    expect(result.errors.join(" ")).toContain("lab.process");
  });

  it("rejects malformed process references", () => {
    const broken = {
      ...bundledLabs[0],
      process: {
        ...bundledLabs[0].process,
        startNodeId: "missing-node",
        edges: [
          {
            from: "missing-source",
            to: bundledLabs[0].process.nodes[0].id,
            label: "Broken",
            condition: { type: "not-supported" },
          },
        ],
      },
    };
    const result = validateLabDefinition(broken);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("startNodeId");
    expect(result.errors.join(" ")).toContain("condition.type");
  });

  it("accepts optional process node layout metadata and generates deterministic legacy layout", () => {
    const withLayout = {
      ...bundledLabs[0],
      process: {
        ...bundledLabs[0].process,
        nodes: bundledLabs[0].process.nodes.map((node, index) => ({
          ...node,
          layout: {
            x: 120 + index * 180,
            y: 80,
            lane: "procedure",
            display: "expanded",
          },
        })),
      },
    };

    expect(validateLabDefinition(withLayout).ok).toBe(true);
    expect(withGeneratedProcessLayouts(bundledLabs[0].process)).toEqual(
      withGeneratedProcessLayouts(bundledLabs[0].process),
    );
  });

  it("rejects malformed process node layout metadata", () => {
    const broken = {
      ...bundledLabs[0],
      process: {
        ...bundledLabs[0].process,
        nodes: bundledLabs[0].process.nodes.map((node, index) =>
          index === 0
            ? {
                ...node,
                layout: {
                  x: "left",
                  y: 40,
                  display: "maximized",
                },
              }
            : node,
        ),
      },
    };

    const result = validateLabDefinition(broken);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("layout.x");
    expect(result.errors.join(" ")).toContain("layout.display");
  });
});
