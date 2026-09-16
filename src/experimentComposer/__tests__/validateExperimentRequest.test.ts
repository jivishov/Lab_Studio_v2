import { describe, expect, it } from "vitest";
import { defaultLabInventory } from "../catalogs";
import { composerSchemaCatalog } from "../schemas";
import {
  applyComposerPreviewOutcome,
  stageGuardIdentity,
  stageGuardsMatch,
  type ExperimentRequest,
  type StagedExperiment,
} from "../types";
import { validateExperimentRequest } from "../validateExperimentRequest";
import {
  REHEARSAL_TOOL_NAMES,
  STUDIO_TOOL_NAMES,
  rehearsalToolInputValidators,
  rehearsalToolInputSchemas,
  studioToolInputValidators,
  studioToolInputSchemas,
} from "../../webmcp/toolSchemas";
import {
  WEBMCP_NAME_BUDGET,
  WEBMCP_PARAMETER_DESCRIPTION_BUDGET,
} from "../../webmcp/registerToolSet";

export const validExperimentRequest = (
  overrides: Partial<ExperimentRequest> = {},
): ExperimentRequest => ({
  schemaVersion: "1",
  familyId: "acid_base_titration_v1",
  expectedInventoryRevision: 0,
  objective: "Estimate the molarity of a synthetic monoprotic-acid sample.",
  audience: "high_school",
  experience: "novice",
  durationMinutes: 45,
  deliveryContext: "virtual_training",
  aliquotVolumeMl: 25,
  endpointEvidence: "phenolphthalein",
  ...overrides,
});

const collectSchemaBudgetViolations = (value: unknown, path = "schema"): string[] => {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) {
    return value.flatMap((child, index) => collectSchemaBudgetViolations(child, `${path}[${index}]`));
  }
  return Object.entries(value).flatMap(([key, child]) => {
    const childPath = `${path}.${key}`;
    const violations: string[] = [];
    if (key === "properties" && child && typeof child === "object" && !Array.isArray(child)) {
      Object.keys(child).forEach((parameterName) => {
        if (parameterName.length > WEBMCP_NAME_BUDGET) violations.push(`${childPath}.${parameterName}`);
      });
    }
    if (
      key === "description"
      && typeof child === "string"
      && child.length > WEBMCP_PARAMETER_DESCRIPTION_BUDGET
    ) {
      violations.push(childPath);
    }
    return [...violations, ...collectSchemaBudgetViolations(child, childPath)];
  });
};

describe("bounded Composer request and inventory validation", () => {
  it("accepts the default inventory and derives the current family model", () => {
    const result = validateExperimentRequest(validExperimentRequest(), defaultLabInventory());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.plan.analyteVolumeMl).toBe(25);
    expect(result.value.plan.titrantMolarityM).toBe(0.1);
  });

  it.each([
    ["burette-50ml", "MISSING_BURETTE"],
    ["ring-stand-clamp", "MISSING_BURETTE_SUPPORT"],
    ["graduated-cylinder", "MISSING_GRADUATED_CYLINDER"],
  ])("returns a recoverable code when %s is absent", (definitionId, code) => {
    const inventory = defaultLabInventory();
    inventory.equipment = inventory.equipment.filter((item) => item.definitionId !== definitionId);
    const result = validateExperimentRequest(validExperimentRequest(), inventory);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((item) => item.code)).toContain(code);
  });

  it("rejects stale inventory before role and quantity validation", () => {
    const inventory = defaultLabInventory();
    inventory.revision = 3;
    inventory.equipment = [];
    const result = validateExperimentRequest(validExperimentRequest(), inventory);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.code).toBe("SCHEMA_VALIDATION_FAILED");

    inventory.equipment = defaultLabInventory().equipment;
    const stale = validateExperimentRequest(validExperimentRequest(), inventory);
    expect(stale.ok).toBe(false);
    if (stale.ok) return;
    expect(stale.issues[0]?.code).toBe("STALE_INVENTORY_REVISION");
  });

  it("does not silently downgrade missing physical readiness declarations", () => {
    const inventory = defaultLabInventory();
    inventory.facilities.eyewash = false;
    const result = validateExperimentRequest(
      validExperimentRequest({ deliveryContext: "physical_procedure_rehearsal" }),
      inventory,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.code).toBe("MISSING_PHYSICAL_FACILITY");
  });

  it("rejects agent-supplied sample concentration and insufficient conserved NaOH", () => {
    const inventory = defaultLabInventory();
    inventory.chemicals.find((item) => item.chemicalId === "synthetic_unknown_acid_a")!.concentrationM = 0.2;
    let result = validateExperimentRequest(validExperimentRequest(), inventory);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0]?.code).toBe("COMPILER_OWNED_CHEMICAL_FIELD");

    delete inventory.chemicals.find((item) => item.chemicalId === "synthetic_unknown_acid_a")!.concentrationM;
    inventory.chemicals.find((item) => item.chemicalId === "standardized_naoh")!.quantityMl = 54;
    result = validateExperimentRequest(validExperimentRequest(), inventory);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0]?.code).toBe("INSUFFICIENT_NAOH_QUANTITY");
  });

  it("uses a specific duplicate-chemical code before capacity checks", () => {
    const inventory = defaultLabInventory();
    inventory.chemicals.push({ ...inventory.chemicals[0]! });
    const result = validateExperimentRequest(validExperimentRequest(), inventory);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.phase).toBe("chemicals");
    expect(result.issues[0]?.code).toBe("DUPLICATE_CHEMICAL_ID");
  });

  it("accepts the exact 0.05 M NaOH and 25 mL aliquot capacity boundary", () => {
    const inventory = defaultLabInventory();
    const titrant = inventory.chemicals.find((item) => item.chemicalId === "standardized_naoh")!;
    titrant.concentrationM = 0.05;
    titrant.quantityMl = 55;
    const result = validateExperimentRequest(validExperimentRequest({ aliquotVolumeMl: 25 }), inventory);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.plan.endpointDeliveredVolumeMl).toBeCloseTo(49.6, 10);
    expect(
      result.value.plan.endpointDeliveredVolumeMl
        + result.value.plan.maxExtraDrops * result.value.plan.dropVolumeMl,
    ).toBeCloseTo(49.85, 10);
  });
});

describe("frozen WebMCP schema boundary", () => {
  it("contains exactly seven Studio and six non-overlapping rehearsal names", () => {
    expect(STUDIO_TOOL_NAMES).toHaveLength(7);
    expect(REHEARSAL_TOOL_NAMES).toHaveLength(6);
    expect(STUDIO_TOOL_NAMES.filter((name) => REHEARSAL_TOOL_NAMES.includes(name as never))).toEqual([]);
    expect([...STUDIO_TOOL_NAMES, ...REHEARSAL_TOOL_NAMES]).not.toContain("apply_lab_preview");
  });

  it("keeps all 11 Composer contracts and all 13 tool schemas strict and within parameter budgets", () => {
    expect(Object.keys(composerSchemaCatalog)).toHaveLength(11);
    Object.values(composerSchemaCatalog).forEach((schema) => {
      expect((schema as { additionalProperties?: unknown }).additionalProperties).toBe(false);
    });
    const allToolSchemas = { ...studioToolInputSchemas, ...rehearsalToolInputSchemas };
    expect(Object.keys(allToolSchemas)).toHaveLength(13);
    expect(collectSchemaBudgetViolations(allToolSchemas)).toEqual([]);
    expect(Object.isFrozen(studioToolInputSchemas)).toBe(true);
    expect(Object.isFrozen(rehearsalToolInputSchemas)).toBe(true);
  });

  it("rejects unknown fields through every no-input schema", () => {
    const validators = [
      studioToolInputValidators.inspect_lab_capabilities,
      studioToolInputValidators.inspect_lab_inventory,
      studioToolInputValidators.inspect_lab_preview,
      rehearsalToolInputValidators.inspect_rehearsal,
      rehearsalToolInputValidators.record_step_evidence,
      rehearsalToolInputValidators.reset_rehearsal,
    ];
    validators.forEach((validator) => expect(validator({ unexpected: true })).toBe(false));
  });

  it("rejects invalid bounds and unknown fields in mutation schemas", () => {
    const inventory = defaultLabInventory();
    const replacement = {
      expectedRevision: inventory.revision,
      equipment: inventory.equipment,
      chemicals: inventory.chemicals,
      facilities: inventory.facilities,
    };
    expect(studioToolInputValidators.replace_lab_inventory({ ...replacement, unexpected: true })).toBe(false);
    expect(studioToolInputValidators.preview_lab_experiment({
      ...validExperimentRequest(),
      analyteMolarityM: 0.2,
    })).toBe(false);
    expect(studioToolInputValidators.start_lab_rehearsal({ stageId: "stage-a", unexpected: true })).toBe(false);
    expect(studioToolInputValidators.run_lab_protocol_check({ stageId: "stage-a", unexpected: true })).toBe(false);
    expect(rehearsalToolInputValidators.act_current_step({ sourceInstanceId: "source-a", unexpected: true })).toBe(false);
    expect(rehearsalToolInputValidators.operate_titration({ mode: "jump_to_endpoint" })).toBe(false);
    expect(rehearsalToolInputValidators.operate_titration({ mode: "drop", unexpected: true })).toBe(false);
    expect(rehearsalToolInputValidators.submit_step_calculation({ value: Number.POSITIVE_INFINITY })).toBe(false);
    expect(rehearsalToolInputValidators.submit_step_calculation({ value: 0.1, unexpected: true })).toBe(false);
  });
});

describe("stage/report preservation contract", () => {
  it("preserves the last valid stage and report after a failed preview", () => {
    const stage = {
      stageId: "stage-a",
      stageRevision: 2,
      sourceInventoryRevision: 1,
      sourceDraftFingerprint: "draft-a",
    } as StagedExperiment;
    const report = { reportId: "report-a", stage: stageGuardIdentity(stage), passed: true };
    const next = applyComposerPreviewOutcome(
      { stage, protocolReport: report },
      { ok: false, issues: [] },
    );
    expect(next).toEqual({ stage, protocolReport: report });
    expect(stageGuardsMatch(report.stage, stageGuardIdentity(stage))).toBe(true);
  });

  it("invalidates the prior report after a successful stage and compares every guard field", () => {
    const previousStage = {
      stageId: "stage-a",
      stageRevision: 2,
      sourceInventoryRevision: 1,
      sourceDraftFingerprint: "draft-a",
    } as StagedExperiment;
    const nextStage = {
      ...previousStage,
      stageId: "stage-b",
      stageRevision: 3,
    } as StagedExperiment;
    const previousGuard = stageGuardIdentity(previousStage);
    expect(applyComposerPreviewOutcome(
      {
        stage: previousStage,
        protocolReport: { reportId: "report-a", stage: previousGuard, passed: true },
      },
      { ok: true, stage: nextStage, summary: {} as never },
    )).toEqual({ stage: nextStage, protocolReport: undefined });
    expect(stageGuardsMatch(previousGuard, { ...previousGuard, stageId: "other" })).toBe(false);
    expect(stageGuardsMatch(previousGuard, { ...previousGuard, stageRevision: 3 })).toBe(false);
    expect(stageGuardsMatch(previousGuard, { ...previousGuard, sourceInventoryRevision: 2 })).toBe(false);
    expect(stageGuardsMatch(previousGuard, { ...previousGuard, sourceDraftFingerprint: "other" })).toBe(false);
  });
});
