import { describe, expect, it } from "vitest";
import { hardWaterDemoLab } from "../../../domain/fixtures";
import type {
  BundledLabSourceDefinition,
  LabDefinition,
  ProcessDefinition,
  TechniqueDefinition,
} from "../../../domain/types";
import { isCompositionSource } from "../../../domain/compositionValidation";
import { validateBundledLabSource } from "../../../domain/validation";
import { coreEvidenceRegistryFragment } from "../../../platform/evidence/coreRegistry";
import { createEvidenceRegistry } from "../../../platform/evidence/registry";
import { validateEvidenceBundle } from "../../../platform/evidence/validation";
import { validatePlatformProcessGraph } from "../../../platform/process/validation";
import { createRuntimeState } from "../../../runtime/createRuntime";
import { createBundledLabHarness, type BundledLabHarness } from "../../../test/bundledLabHarness";
import {
  projectChemistryRuntimeEvidence,
  projectDataSeriesRecordToEvidence,
  projectMeasurementRecordToEvidence,
  projectNotebookEntryToEvidence,
  projectValidationEvidenceToEvidence,
} from "../evidenceAdapter";
import { chemistryEvidenceRegistryFragment } from "../evidenceRegistry";
import { chemistryProcessReadAdapter } from "../processAdapter";

type IndexedSummary = { id: string; file?: string };

const sourcePath = (folder: "labs" | "techniques", summary: IndexedSummary): string =>
  `${folder}/${summary.file ?? `${summary.id}.json`}`;

const withBundledLabHarness = async (
  execute: (harness: BundledLabHarness) => Promise<void>,
): Promise<void> => {
  const harness = await createBundledLabHarness();
  try {
    await execute(harness);
  } finally {
    harness.dispose();
  }
};

const hasNonRetryCycle = (process: ProcessDefinition): boolean => {
  const nodeIds = new Set(process.nodes.map(({ id }) => id));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (nodeId: string): boolean => {
    if (visiting.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visiting.add(nodeId);
    for (const edge of process.edges) {
      if (
        edge.from !== nodeId
        || edge.condition.type === "retry"
        || !nodeIds.has(edge.to)
      ) continue;
      if (visit(edge.to)) return true;
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  };

  return [...nodeIds].some(visit);
};

/**
 * These are reported, not accepted, as executable platform graphs. Keep the current
 * inventory explicit so a new artifact or diagnostic cannot be hidden by a broad allowlist.
 */
const expectedStrictPlatformDiagnosticInventory = [
  { id: "acid-base-titration", sourceHasNonRetryCycle: true, counts: { "process.cycle.requires-retry": 1 } },
  { id: "brass-colorimetry", sourceHasNonRetryCycle: true, counts: { "process.cycle.requires-retry": 1 } },
  { id: "beverage-acidity", sourceHasNonRetryCycle: true, counts: { "process.cycle.requires-retry": 1 } },
  { id: "bonding-unknown-solids", sourceHasNonRetryCycle: false, counts: { "process.branch.insufficient-options": 1 } },
  { id: "hydrogen-peroxide-redox-titration", sourceHasNonRetryCycle: true, counts: { "process.cycle.requires-retry": 1 } },
  { id: "quick-ache-relief-separation", sourceHasNonRetryCycle: false, counts: { "process.branch.insufficient-options": 5 } },
  { id: "acid-base-titration-curves", sourceHasNonRetryCycle: true, counts: { "process.cycle.requires-retry": 1 } },
  {
    id: "brass-spectrophotometry",
    sourceHasNonRetryCycle: true,
    counts: { "process.cycle.requires-retry": 1, "process.node.unreachable": 110 },
  },
  { id: "titration-endpoint", sourceHasNonRetryCycle: true, counts: { "process.cycle.requires-retry": 1 } },
  { id: "redox-titration", sourceHasNonRetryCycle: true, counts: { "process.cycle.requires-retry": 1 } },
  { id: "blue1-percent-transmittance", sourceHasNonRetryCycle: false, counts: { "process.node.unreachable": 30 } },
  { id: "beverage-ph-volume-titration", sourceHasNonRetryCycle: true, counts: { "process.cycle.requires-retry": 1 } },
  { id: "quick-ache-property-evidence", sourceHasNonRetryCycle: false, counts: { "process.branch.insufficient-options": 2 } },
  { id: "quick-ache-design-approval", sourceHasNonRetryCycle: false, counts: { "process.branch.insufficient-options": 1 } },
  { id: "quick-ache-extraction-recovery", sourceHasNonRetryCycle: false, counts: { "process.branch.insufficient-options": 1 } },
  { id: "quick-ache-analysis-report", sourceHasNonRetryCycle: false, counts: { "process.branch.insufficient-options": 1 } },
  { id: "ph-volume-formal-titration-trial", sourceHasNonRetryCycle: true, counts: { "process.cycle.requires-retry": 1 } },
] as const;

describe("chemistry process and evidence read projections", () => {
  it("projects current process graphs losslessly and accounts for strict platform-execution diagnostics", async () => {
    await withBundledLabHarness(async (harness) => {
      const [labSummaries, techniqueSummaries] = await Promise.all([
        harness.loadLabSummaries(),
        harness.loadTechniqueSummaries(),
      ]);
      expect(labSummaries.length).toBeGreaterThan(0);
      expect(techniqueSummaries.length).toBeGreaterThan(0);

      const rawLabSources = await Promise.all(labSummaries.map(async (summary) => {
        const validation = validateBundledLabSource(
          await harness.readJson<unknown>(sourcePath("labs", summary)),
        );
        expect(validation.ok, sourcePath("labs", summary)).toBe(true);
        if (!validation.ok || !validation.value) {
          throw new Error(`Public lab source ${summary.id} failed bundled-source validation.`);
        }
        expect(validation.value.id, sourcePath("labs", summary)).toBe(summary.id);
        return [summary, validation.value] as const;
      }));
      const compositionSourceIds = new Set(rawLabSources
        .filter(([, source]) => isCompositionSource(source))
        .map(([, source]) => source.id));
      expect(compositionSourceIds.size).toBeGreaterThan(0);
      for (const [summary, source] of rawLabSources) {
        if (isCompositionSource(source)) {
          expect(source.compositionManifest, sourcePath("labs", summary)).toBeUndefined();
        }
      }

      const labs: LabDefinition[] = [];
      for (const summary of labSummaries) labs.push(await harness.loadLab(summary.id));
      const techniques: TechniqueDefinition[] = [];
      for (const summary of techniqueSummaries) {
        techniques.push(await harness.loadTechnique(summary.id));
      }
      expect(labs.map(({ id }) => id)).toEqual(labSummaries.map(({ id }) => id));
      expect(techniques.map(({ id }) => id)).toEqual(techniqueSummaries.map(({ id }) => id));

      const sourceByLabId = new Map<string, BundledLabSourceDefinition>(
        rawLabSources.map(([, source]) => [source.id, source] as const),
      );
      for (const lab of labs) {
        const source = sourceByLabId.get(lab.id);
        expect(source, lab.id).toBeTruthy();
        expect("techniqueInstances" in lab, lab.id).toBe(false);
        if (source && isCompositionSource(source)) {
          expect(lab.compositionManifest, lab.id).toMatchObject({ status: "compiled" });
        }
      }

      const artifacts: Array<LabDefinition | TechniqueDefinition> = [...labs, ...techniques];
      const projectionChecks = artifacts.map((artifact) => {
        const before = structuredClone(artifact.process);
        const projection = chemistryProcessReadAdapter.project(artifact.process);
        const platformValidation = validatePlatformProcessGraph(projection.graph);
        expect(chemistryProcessReadAdapter.restore(projection), artifact.id).toEqual(before);
        expect(artifact.process, artifact.id).toEqual(before);
        expect(projection.nodes.map(({ platformNodeId }) => platformNodeId), artifact.id)
          .toEqual(artifact.process.nodes.map(({ id }) => id));
        expect(projection.edges.map(({ chemistryEdgeIndex }) => chemistryEdgeIndex), artifact.id)
          .toEqual(artifact.process.edges.map((_, index) => index));
        expect(projection.edges.map(({ chemistryEdge }) => chemistryEdge), artifact.id)
          .toEqual(before.edges);
        expect(projection.graph.edges.map(({ id, from, to, label }) => ({ id, from, to, label })), artifact.id)
          .toEqual(before.edges.map((edge, index) => ({
            id: `edge-${index + 1}`,
            from: edge.from,
            to: edge.to,
            label: edge.label,
          })));
        return {
          id: artifact.id,
          platformValidation,
          sourceHasNonRetryCycle: hasNonRetryCycle(before),
        };
      });

      const strictDiagnosticInventory = projectionChecks
        .filter(({ platformValidation }) => !platformValidation.ok)
        .map(({ id, platformValidation, sourceHasNonRetryCycle }) => ({
          id,
          sourceHasNonRetryCycle,
          counts: platformValidation.ok ? {} : platformValidation.diagnostics.reduce<Record<string, number>>(
            (counts, { code }) => ({ ...counts, [code]: (counts[code] ?? 0) + 1 }),
            {},
          ),
        }));
      const strictDiagnosticTotals = strictDiagnosticInventory.reduce<Record<string, number>>(
        (totals, { counts }) => Object.entries(counts).reduce(
          (nextTotals, [code, count]) => ({ ...nextTotals, [code]: (nextTotals[code] ?? 0) + count }),
          totals,
        ),
        {},
      );

      expect(artifacts).toHaveLength(59);
      expect(strictDiagnosticInventory).toEqual(expectedStrictPlatformDiagnosticInventory);
      expect(strictDiagnosticTotals).toEqual({
        "process.branch.insufficient-options": 11,
        "process.cycle.requires-retry": 10,
        "process.node.unreachable": 140,
      });
      expect(artifacts.length - strictDiagnosticInventory.length).toBe(42);
    });
  });

  it("projects every current runtime evidence collection through allowlisted shared records", () => {
    const state = createRuntimeState(hardWaterDemoLab);
    state.attemptHistory = [{
      id: "attempt-1",
      timestamp: "2026-07-18T04:00:00.000Z",
      nodeId: hardWaterDemoLab.process.startNodeId,
      actionId: hardWaterDemoLab.actions[0].id,
      verb: hardWaterDemoLab.actions[0].verb,
      mode: "guided",
      success: true,
      message: "Action accepted.",
    }];
    state.measurements = [{
      id: "sample-volume",
      label: "Sample volume",
      value: 100,
      unit: "mL",
      nodeId: hardWaterDemoLab.process.startNodeId,
    }];
    state.dataSeries = [{
      id: "mass-series",
      label: "Mass series",
      xUnit: "min",
      yUnit: "g",
      points: [{ x: 0, y: 1.2 }, { x: 5, y: 1.1 }],
      sourceActionId: hardWaterDemoLab.actions[0].id,
      nodeId: hardWaterDemoLab.process.startNodeId,
    }];
    state.calculations = [{
      id: "hardness-mg-l",
      label: "Hardness",
      value: 375,
      unit: "mg/L as CaCO3",
      expected: 375,
      tolerance: 0.5,
      passed: true,
      nodeId: hardWaterDemoLab.process.startNodeId,
    }];
    state.notebook = [{
      id: "note-1",
      timestamp: "2026-07-18T04:01:00.000Z",
      nodeId: hardWaterDemoLab.process.startNodeId,
      type: "observation",
      label: "Appearance",
      value: "A white precipitate was observed.",
      tags: ["observe", "precipitate"],
    }];
    state.validationEvidence = [{
      id: "validation-1",
      ruleId: "rule-1",
      nodeId: hardWaterDemoLab.process.startNodeId,
      passed: true,
      message: "Required evidence is present.",
    }];
    const before = JSON.stringify(state);
    const records = projectChemistryRuntimeEvidence(state, {
      occurredAt: "2026-07-18T04:02:00.000Z",
      artifact: hardWaterDemoLab,
    });

    expect(JSON.stringify(state)).toBe(before);
    expect(records.map(({ typeId }) => typeId)).toEqual([
      "action.completed",
      "measurement.scalar",
      "measurement.series",
      "calculation.result",
      "observation.text",
      "chemistry.validation.rule",
    ]);
    expect(records[1]).toEqual(projectMeasurementRecordToEvidence(
      state.measurements[0],
      "2026-07-18T04:02:00.000Z",
    ));
    expect(records[2]).toEqual(projectDataSeriesRecordToEvidence(
      state.dataSeries[0],
      "2026-07-18T04:02:00.000Z",
    ));
    expect(records[4]).toEqual(projectNotebookEntryToEvidence(state.notebook[0]));
    expect(records[5]).toEqual(projectValidationEvidenceToEvidence(
      state.validationEvidence[0],
      "2026-07-18T04:02:00.000Z",
    ));
    expect(records[3].payload).toMatchObject({
      calculationId: "hardness-mg-l",
      formula: "hardness_mg_L = precipitate_mass_g * 1000000 / sample_volume_mL",
    });

    const registry = createEvidenceRegistry([
      coreEvidenceRegistryFragment,
      chemistryEvidenceRegistryFragment,
    ]);
    const bundle = {
      schema: "studio.evidence-bundle" as const,
      schemaVersion: "1.0" as const,
      bundleId: "chemistry-projection-bundle",
      registryVersion: registry.registryDocument.version,
      createdAt: "2026-07-18T05:00:00.000Z",
      records,
    };
    expect(validateEvidenceBundle(bundle, registry)).toMatchObject({ ok: true });
  });

  it("validates the chemistry rule-evidence payload and rejects version, shape, and forbidden-data negatives", () => {
    const registry = createEvidenceRegistry([
      coreEvidenceRegistryFragment,
      chemistryEvidenceRegistryFragment,
    ]);
    const payload = {
      ruleId: "rule-1",
      nodeId: "node-1",
      passed: false,
      message: "The calculation is outside tolerance.",
    };
    expect(registry.validatePayload("chemistry.validation.rule", "1.0.0", payload))
      .toMatchObject({ ok: true });
    expect(registry.validatePayload("chemistry.validation.rule", "2.0.0", payload))
      .toMatchObject({
        ok: false,
        diagnostics: expect.arrayContaining([
          expect.objectContaining({ code: "evidence.type.version-mismatch", path: "/typeVersion" }),
        ]),
      });
    expect(registry.validatePayload("chemistry.validation.rule", "1.0.0", {
      ...payload,
      message: "",
    })).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ code: "schema.minLength", path: "/payload/message" }),
      ]),
    });
    expect(registry.validatePayload("chemistry.validation.rule", "1.0.0", {
      ...payload,
      localPath: "C:\\private\\evidence.json",
    })).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ code: "evidence.forbidden.local-paths" }),
      ]),
    });
  });
});
