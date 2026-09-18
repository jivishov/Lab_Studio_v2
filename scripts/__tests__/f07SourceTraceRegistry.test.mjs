/**
 * F07 — source-trace registry coverage for Phase 2.
 *
 * This test intentionally lives under scripts because the architecture registry is build-time
 * data and application source must not import it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(readFileSync(join(root, relativePath), "utf8"));
const sourceTraceRegistry = readJson("docs/architecture/source-trace-registry.json");
const retirementLedger = readJson("docs/architecture/registry-metadata-retirement-ledger.json");
const atomRegistry = readJson("src/domain/atomRegistry.json");
const brassTechnique = readJson("public/techniques/brass-spectrophotometry.json");
const paperTechnique = readJson("public/techniques/paper-chromatography.json");
const indexedTechniqueActions = new Map(readJson("public/techniques/index.json").map(({ file }) => {
  const technique = readJson(`public/techniques/${file}`);
  return [technique.id, new Set(technique.actions.map((action) => action.id))];
}));
const indexedTechniqueActionRecords = new Map(readJson("public/techniques/index.json").map(({ file }) => {
  const technique = readJson(`public/techniques/${file}`);
  return [technique.id, new Map(technique.actions.map((action) => [action.id, action]))];
}));

const keyOf = (trace) => `${trace.ownerType}:${trace.ownerId}#${trace.actionId}`;
const ownerOf = (trace) => `${trace.ownerType}:${trace.ownerId}`;
const traceRows = new Map(sourceTraceRegistry.traces.map((trace) => [keyOf(trace), trace]));
const traceGroups = sourceTraceRegistry.traceGroups ?? [];
const groupedTraceRows = new Map();
for (const group of traceGroups) {
  for (const actionId of group.actionIds ?? []) {
    groupedTraceRows.set(`${group.ownerType}:${group.ownerId}#${actionId}`, group);
  }
}
const ownerRows = (ownerId) => sourceTraceRegistry.traces.filter(
  (trace) => trace.ownerType === "technique" && trace.ownerId === ownerId,
);
const brassTraceRows = ownerRows("brass-spectrophotometry");
const sourceDerivedOwners = new Set(sourceTraceRegistry.sourceDerivedOwners.flatMap(({ owners }) => owners));
const nonSourceDerivedOwners = new Set(sourceTraceRegistry.nonSourceDerivedOwners.map(({ owner }) => owner));
const sourceFile = "how-can-color-determine-copper-in-brass_2026-07-27.md";
const greenSourceFile = "purify-a-mixture-green-chemistry_2026-07-27.md";
const paperSourceFile = "sticky-question-paper-chromatography_2026-07-27.md";

const expectTrace = (ownerId, actionId, expected) => {
  const key = `technique:${ownerId}#${actionId}`;
  const matches = sourceTraceRegistry.traces.filter((trace) => keyOf(trace) === key);
  expect(matches, key).toHaveLength(1);
  expect(traceRows.get(key), key).toMatchObject(expected);
};

const expectSourceExample = (atomId, expected) => {
  const atom = atomRegistry.atoms.find((candidate) => candidate.id === atomId);
  expect(atom, atomId).toBeTruthy();
  expect(atom.sourceExamples).toContainEqual(expected);
};

describe("F07 Phase 2 source-row coverage", () => {
  it("keeps active source rows indexed and reviewed historical rows distinct", () => {
    expect(sourceTraceRegistry.traces.length).toBeGreaterThan(0);
    expect(traceGroups.length).toBeGreaterThan(0);
    expect(groupedTraceRows.size).toBe(882);
    expect(sourceTraceRegistry.inlineTraceDebt).toEqual([]);
    for (const trace of sourceTraceRegistry.traces) {
      const owner = ownerOf(trace);
      expect(sourceDerivedOwners.has(owner), owner).toBe(true);
      expect(nonSourceDerivedOwners.has(owner), owner).toBe(false);
      if (trace.ownerType === "technique") {
        expect(indexedTechniqueActions.has(trace.ownerId), owner).toBe(true);
        expect(indexedTechniqueActions.get(trace.ownerId)?.has(trace.actionId), keyOf(trace)).toBe(true);
      }
    }
    const groupedMembers = new Set();
    for (const group of traceGroups) {
      const owner = `${group.ownerType}:${group.ownerId}`;
      expect(sourceDerivedOwners.has(owner), owner).toBe(true);
      expect(nonSourceDerivedOwners.has(owner), owner).toBe(false);
      expect(group.traceDisposition, group.id).toBe("context");
      expect(group.sourceBasis, group.id).toBe(group.basis);
      expect(group.actionBasis, group.id).toEqual(expect.any(String));
      expect(group.mappingRationale, group.id).toEqual(expect.any(String));
      expect(group.sourceFile, group.id).toEqual(expect.any(String));
      for (const actionId of group.actionIds) {
        const key = `${owner}#${actionId}`;
        expect(groupedMembers.has(key), key).toBe(false);
        groupedMembers.add(key);
        expect(traceRows.has(key), key).toBe(false);
        const action = indexedTechniqueActionRecords.get(group.ownerId)?.get(actionId);
        expect(action, key).toBeTruthy();
        expect(action?.atomId, key).toBe(group.atomId);
      }
    }

    expect(retirementLedger.retiredSourceTraces.length).toBeGreaterThan(0);
    for (const entry of retirementLedger.retiredSourceTraces) {
      expect(traceRows.has(keyOf(entry.trace)), keyOf(entry.trace)).toBe(false);
    }
    expect(retirementLedger.retainedCompositionTraceExclusions.length).toBeGreaterThan(0);
    for (const entry of retirementLedger.retainedCompositionTraceExclusions) {
      expect(sourceTraceRegistry.traces, keyOf(entry.trace)).toContainEqual(entry.trace);
    }

    expectTrace("hand-warmer-calorimetry", "P1-13", {
      sourceFile: "hand-warmer-design-challenge_2026-07-27.md",
      atomId: "atom.observe.control-calorimetry-stirrer",
      sourceTable: "phase",
      step: "PR-06",
      basis: "M",
    });
    expectTrace("hand-warmer-calorimetry", "P1-26-R1", {
      sourceFile: "hand-warmer-design-challenge_2026-07-27.md",
      atomId: "atom.observe.identify-temperature-peak",
      sourceTable: "phase",
      step: "PR-09",
      basis: "M",
    });
    expectTrace("hand-warmer-calorimetry", "P2-H08-D3-READ-01", {
      sourceFile: "hand-warmer-design-challenge_2026-07-27.md",
      atomId: "atom.observe.read-immersed-probe",
      sourceTable: "phase",
      step: "CA-05",
      basis: "M",
    });
    expectTrace("paper-chromatography", "measure-water-solvent-front", {
      sourceFile: paperSourceFile,
      atomId: "atom.observe.measure-chromatography-distance",
      sourceTable: "phase",
      step: "TR-12",
      basis: "M",
    });
    expectTrace("paper-chromatography", "measure-water-purple-overlap", {
      sourceFile: paperSourceFile,
      atomId: "atom.observe.measure-chromatography-distance",
      sourceTable: "phase",
      step: "TR-14",
      basis: "M",
    });
    expectTrace("paper-chromatography", "measure-water-yellow", {
      sourceFile: paperSourceFile,
      atomId: "atom.observe.measure-chromatography-distance",
      sourceTable: "phase",
      step: "TR-16",
      basis: "M",
    });
    expectTrace("quick-ache-extraction-recovery", "qar-inspect-separated-layers", {
      sourceFile: "quick-ache-relief-component-separation_2026-07-27.md",
      atomId: "atom.observe.extraction-layer-state",
      sourceTable: "phase",
      step: "E-05",
      basis: "R",
    });
    expectTrace("quick-ache-property-evidence", "qar-inspect-sucrose-property-result", {
      sourceFile: "quick-ache-relief-component-separation_2026-07-27.md",
      atomId: "atom.observe.record-property-test-result",
      sourceTable: "phase",
      step: "P-04",
      basis: "M",
    });
    expectTrace("thermal-decomposition-mass-loss", "place-balance", {
      sourceFile: greenSourceFile,
      atomId: "atom.place.balance-instrument",
      sourceTable: "phase",
      step: "EX-01",
      basis: "M",
      traceDisposition: "context",
      sourceBasis: "M",
      actionBasis: "R/C",
      mappingRationale: expect.any(String),
    });
    const coolRows = ownerRows("thermal-decomposition-mass-loss").filter((trace) => trace.actionId === "cool-crucible");
    expect(coolRows).toHaveLength(2);
    expect(coolRows).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceFile: greenSourceFile, sourceTable: "phase", step: "EX-12", basis: "M/R" }),
      expect.objectContaining({ sourceFile: greenSourceFile, sourceTable: "phase", step: "EX-13", basis: "M" }),
    ]));
  });

  it("keeps the settled Phase 1 Brass and Green operation locators", () => {
    expectTrace("brass-spectrophotometry", "tare-empty-beaker-action", {
      sourceFile,
      atomId: "atom.weigh.tare-vessel",
      sourceTable: "apparatus",
      step: "BRASS-00",
      basis: "F/R",
    });
    expectTrace("brass-spectrophotometry", "measure-50ml-digest-water-action", {
      sourceFile,
      atomId: "atom.measure.variable-volume",
      sourceTable: "phase",
      step: "B-07",
      basis: "M",
      sourceBasis: "M",
      actionBasis: "M/R",
      traceDisposition: "context",
    });
    expectTrace("brass-spectrophotometry", "teacher-add-50ml-water-to-digest-action", {
      sourceFile,
      atomId: "atom.transfer.measured-liquid",
      sourceTable: "phase",
      step: "B-07",
      basis: "M",
    });
    expectTrace("brass-spectrophotometry", "confirm-diluted-digest-material-action", {
      sourceFile,
      atomId: "atom.observe.confirm-external-material-transition",
      sourceTable: "phase",
      step: "B-07",
      basis: "M",
    });
    expectTrace("brass-spectrophotometry", "fill-color-depth-unknown-action", {
      sourceFile,
      atomId: "atom.transfer.fill-color-depth-pair",
      sourceTable: "phase",
      step: "V-01",
      basis: "M",
    });
    expectTrace("brass-spectrophotometry", "fill-color-depth-standard-action", {
      sourceFile,
      atomId: "atom.transfer.fill-color-depth-pair",
      sourceTable: "phase",
      step: "V-01",
      basis: "M",
    });
    // Safety S-08 is one row with one basis. `basis`/`sourceBasis` copy that row verbatim (M/C:
    // the manual states the neutralisation, the instructor directs the disposal); the inferred
    // collection into the shared treatment vessel is carried by `actionBasis`, not folded into the
    // row. Every citation of this row -- these two, the six other collect actions, the three
    // treatment actions below, and the atom example -- must agree on M/C.
    for (const actionId of [
      "collect-0p0250-waste-action",
      "collect-0p0500-waste-action",
      "collect-0p100-waste-action",
      "collect-0p200-waste-action",
      "collect-0p400-waste-action",
      "collect-unknown-waste-action",
      "collect-color-depth-unknown-waste-action",
      "collect-color-depth-standard-waste-action",
    ]) {
      expectTrace("brass-spectrophotometry", actionId, {
        sourceFile,
        atomId: "atom.transfer.collect-sample-for-treatment",
        sourceTable: "safety",
        step: "S-08",
        basis: "M/C",
        traceDisposition: "context",
        sourceBasis: "M/C",
        actionBasis: "M/R/C",
        mappingRationale: expect.stringContaining("pooled neutralisation"),
      });
    }
    expectSourceExample("atom.transfer.collect-sample-for-treatment", {
      sourceFile,
      sourceTable: "safety",
      step: "S-08",
      basis: "M/C",
    });
    expectTrace("brass-spectrophotometry", "transfer-treated-waste-to-destination-action", {
      sourceFile,
      atomId: "atom.transfer.treated-waste-to-designated-destination",
      sourceTable: "safety",
      step: "S-08",
      basis: "M/C",
    });
    // Apparatus BRASS-01 is table-supported and carries no inline marker, unlike SPEC-01, which
    // carries C. Its basis is therefore F; the teacher-set inventory and the real-life placement
    // stay on the two actions' `actionBasis`.
    expectTrace("brass-spectrophotometry", "configure-brass-sample-inventory-action", {
      sourceFile,
      atomId: "atom.observe.configure-solid-stock-inventory",
      sourceTable: "apparatus",
      step: "BRASS-01",
      basis: "F",
      traceDisposition: "context",
      sourceBasis: "F",
      actionBasis: "F/C",
    });
    expectTrace("brass-spectrophotometry", "load-brass-onto-weighing-support-action", {
      sourceFile,
      atomId: "atom.transfer.load-solid-onto-weighing-support",
      sourceTable: "apparatus",
      step: "BRASS-01",
      basis: "F",
      traceDisposition: "context",
      sourceBasis: "F",
      actionBasis: "F/R/C",
    });
    expectSourceExample("atom.observe.configure-solid-stock-inventory", {
      sourceFile,
      sourceTable: "apparatus",
      step: "BRASS-01",
      basis: "F",
    });
    // Phase B-01 is the mass determination and states it plainly (M). The R that belongs to placing
    // the sample on the support is carried by the apparatus-row trace above, not by this example,
    // and the B-01 weighing trace itself is unchanged.
    expectSourceExample("atom.transfer.load-solid-onto-weighing-support", {
      sourceFile,
      sourceTable: "phase",
      step: "B-01",
      basis: "M",
    });
    expectTrace("brass-spectrophotometry", "weigh-brass-action", {
      sourceFile,
      atomId: "atom.weigh.solid-portion",
      sourceTable: "phase",
      step: "B-01",
      basis: "M",
    });
    expectTrace("thermal-decomposition-mass-loss", "finalize-unused-master-stock", {
      sourceFile: greenSourceFile,
      atomId: "atom.transfer.unheated-mixture-to-labeled-recovery",
      sourceTable: "phase",
      step: "EX-08",
      basis: "M",
    });
  });

  it("preserves paper drying residuals and separates the measurement source examples", () => {
    const measurementAtom = atomRegistry.atoms.find((atom) => atom.id === "atom.observe.measure-chromatography-distance");
    expect(measurementAtom.sourceExamples).toEqual(expect.arrayContaining([
      { sourceFile: paperSourceFile, sourceTable: "phase", step: "TR-12", basis: "M" },
      { sourceFile: paperSourceFile, sourceTable: "phase", step: "TR-14", basis: "M" },
      { sourceFile: paperSourceFile, sourceTable: "phase", step: "TR-16", basis: "M" },
    ]));
    expect(measurementAtom.sourceExamples.some((entry) => entry.step === "TR-14/TR-16")).toBe(false);

    const dryActions = paperTechnique.actions.filter(
      (action) => action.atomId === "atom.observe.dry-developed-chromatography-paper",
    );
    expect(dryActions).toHaveLength(17);
    for (const action of dryActions) {
      expect(traceRows.has(`technique:paper-chromatography#${action.id}`), action.id).toBe(false);
      expect(groupedTraceRows.has(`technique:paper-chromatography#${action.id}`), action.id).toBe(false);
    }
    const dryAtom = atomRegistry.atoms.find((atom) => atom.id === "atom.observe.dry-developed-chromatography-paper");
    expect(dryAtom.sourceExamples).toEqual([]);
  });

  it("keeps Quick E-12 direct evidence narrow and records Green apparatus inference", () => {
    expectSourceExample("atom.weigh.dry-assembly", {
      sourceFile: "quick-ache-relief-component-separation_2026-07-27.md",
      sourceTable: "phase",
      step: "E-12",
      basis: "M",
    });
    for (const actionId of [
      "qar-weigh-filter-paper-tare",
      "qar-weigh-acidic-watch-glass-tare",
      "qar-weigh-organic-watch-glass-tare",
      "qar-weigh-aqueous-watch-glass-tare",
    ]) {
      expectTrace("quick-ache-extraction-recovery", actionId, {
        sourceFile: "quick-ache-relief-component-separation_2026-07-27.md",
        sourceTable: "phase",
        step: "E-12",
        basis: "M",
        traceDisposition: "context",
        sourceBasis: "M",
        actionBasis: "R/C",
        mappingRationale: expect.stringContaining("tare/placement support"),
      });
    }
    for (const atomId of ["atom.weigh.filter-medium-tare", "atom.weigh.tare-vessel"]) {
      const atom = atomRegistry.atoms.find((candidate) => candidate.id === atomId);
      expect(atom.sourceExamples.some((entry) => entry.sourceFile === "quick-ache-relief-component-separation_2026-07-27.md" && entry.step === "E-12")).toBe(false);
    }

    for (const actionId of ["place-empty-crucible", "place-ring-stand", "add-clay-triangle", "place-bunsen-burner", "place-crucible-on-support"]) {
      const rows = ownerRows("thermal-decomposition-mass-loss").filter((trace) => trace.actionId === actionId);
      expect(rows, actionId).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        traceDisposition: "context",
        sourceBasis: expect.any(String),
        actionBasis: "R/C",
        mappingRationale: expect.any(String),
      });
    }
    expectSourceExample("atom.place.thermal-support", {
      sourceFile: greenSourceFile,
      sourceTable: "apparatus",
      step: "HEAT-00",
      basis: "F/R",
    });
    expectSourceExample("atom.place.thermal-support", {
      sourceFile: greenSourceFile,
      sourceTable: "apparatus",
      step: "HEAT-02",
      basis: "F/R",
    });
    const balanceAtom = atomRegistry.atoms.find((atom) => atom.id === "atom.place.balance-instrument");
    expect(balanceAtom.sourceExamples.some((entry) => entry.sourceFile === greenSourceFile)).toBe(false);
    const weighedVesselAtom = atomRegistry.atoms.find((atom) => atom.id === "atom.place.weighed-vessel");
    expect(weighedVesselAtom.sourceExamples.some((entry) => entry.sourceFile === greenSourceFile)).toBe(false);
  });
  it("keeps every Quick E-05 citation at the derived aid's R basis", () => {
    // `quick-ache-relief-component-separation_2026-07-27.md` classifies phase row E-05
    // ("Allow layers to separate.") as R. Every citation of that row — atom source examples and
    // trace rows alike — has to agree, or the checker's source-citation/basis-disagreement rule
    // fires on the shared key.
    const quickSourceFile = "quick-ache-relief-component-separation_2026-07-27.md";
    const e05Citations = [
      ...atomRegistry.atoms.flatMap((atom) => atom.sourceExamples
        .filter((entry) => entry.sourceFile === quickSourceFile && entry.step === "E-05")
        .map((entry) => ({ where: atom.id, ...entry }))),
      ...sourceTraceRegistry.traces
        .filter((trace) => trace.sourceFile === quickSourceFile && trace.step === "E-05")
        .map((trace) => ({ where: `${trace.ownerType}:${trace.ownerId}/${trace.actionId}`, ...trace })),
    ];
    expect(e05Citations.length).toBeGreaterThan(0);
    for (const citation of e05Citations) {
      expect(citation.sourceTable, citation.where).toBe("phase");
      expect(citation.basis, citation.where).toBe("R");
    }
    expectSourceExample("atom.settle.extraction-funnel", {
      sourceFile: quickSourceFile,
      sourceTable: "phase",
      step: "E-05",
      basis: "R",
    });
    // The settling action's approved controls are still declared — as operational configuration on
    // the atom, not as a claim that the E-05 row is C.
    const settleAtom = atomRegistry.atoms.find((atom) => atom.id === "atom.settle.extraction-funnel");
    expect(settleAtom.proceduralConstraints.some((entry) => entry.includes("acquired teacher configuration"))).toBe(true);
    expect(settleAtom.proceduralConstraints.some((entry) => entry.includes("simulator configuration held here"))).toBe(true);
  });
});

describe("F07 configured Brass scan context", () => {
  it("keeps direct reads/records manual-stated while retaining R/C context for handling", () => {
    expect(sourceTraceRegistry.contextTracePolicy).toMatchObject({
      dispositionField: "traceDisposition",
      contextValue: "context",
      sourceBasisField: "basis",
      explicitSourceBasisField: "sourceBasis",
      actionBasisField: "actionBasis",
      rationaleField: "mappingRationale",
    });
    const reads = brassTraceRows.filter((trace) => /^scan-read-\d+-salt-[ab]-action$/.test(trace.actionId));
    const records = brassTraceRows.filter((trace) => /^scan-record-\d+-salt-[ab]-action$/.test(trace.actionId));
    const preparation = brassTraceRows.filter((trace) => /^scan-(condition|fill|prepare)-salt-[ab]-once-action$/.test(trace.actionId));
    const insertions = brassTraceRows.filter((trace) => /^scan-insert-\d+-salt-[ab]-action$/.test(trace.actionId));
    const removals = brassTraceRows.filter((trace) => /^scan-remove-\d+-salt-[ab]-action$/.test(trace.actionId));
    const returns = brassTraceRows.filter((trace) => /^scan-return-salt-[ab]-after-series-action$/.test(trace.actionId));
    const repeatedSettings = brassTraceRows.filter((trace) => /^scan-set-(?!400-action$)\d+-action$/.test(trace.actionId));
    const scanBlankPreparation = brassTraceRows.filter((trace) => trace.actionId === "scan-prepare-distilled-water-blank-action");
    const scanPhotometerPlacement = brassTraceRows.filter((trace) => trace.actionId === "scan-place-photometer-action");
    const scanBlankInsertions = brassTraceRows.filter((trace) => /^scan-insert-\d+-blank-action$/.test(trace.actionId));
    const scanBlankApplications = brassTraceRows.filter((trace) => /^scan-blank-\d+-action$/.test(trace.actionId));
    const scanBlankRemovals = brassTraceRows.filter((trace) => /^scan-remove-\d+-blank-action$/.test(trace.actionId));

    expect(reads).toHaveLength(32);
    expect(records).toHaveLength(32);
    expect(preparation).toHaveLength(6);
    expect(insertions).toHaveLength(32);
    expect(removals).toHaveLength(32);
    expect(returns).toHaveLength(2);
    expect(repeatedSettings).toHaveLength(15);
    expect(scanBlankPreparation).toHaveLength(1);
    expect(scanPhotometerPlacement).toHaveLength(1);
    expect(scanBlankInsertions).toHaveLength(16);
    expect(scanBlankApplications).toHaveLength(16);
    expect(scanBlankRemovals).toHaveLength(16);

    for (const trace of reads) {
      expect(trace).toMatchObject({ sourceTable: "phase", step: "P-03", basis: "M" });
      expect(trace.traceDisposition).toBeUndefined();
      expect(trace.actionBasis).toBeUndefined();
    }
    for (const trace of records) {
      expect(trace).toMatchObject({ sourceTable: "phase", step: "P-04", basis: "M" });
      expect(trace.traceDisposition).toBeUndefined();
      expect(trace.actionBasis).toBeUndefined();
    }
    for (const trace of preparation) expect(trace).toMatchObject({ sourceTable: "phase", step: "P-03", basis: "M", sourceBasis: "M", actionBasis: "R/C", traceDisposition: "context" });
    for (const trace of insertions) expect(trace).toMatchObject({ sourceTable: "phase", step: "P-03", basis: "M", sourceBasis: "M", actionBasis: "R/C", traceDisposition: "context" });
    for (const trace of removals) expect(trace).toMatchObject({ sourceTable: "phase", step: "P-05", basis: "M", sourceBasis: "M", actionBasis: "R/C", traceDisposition: "context" });
    for (const trace of returns) expect(trace).toMatchObject({ sourceTable: "phase", step: "P-05", basis: "M", sourceBasis: "M", actionBasis: "R/C", traceDisposition: "context" });
    for (const trace of repeatedSettings) expect(trace).toMatchObject({ sourceTable: "phase", step: "P-05", basis: "M", sourceBasis: "M", actionBasis: "M/R", traceDisposition: "context" });
    for (const trace of scanBlankPreparation) expect(trace).toMatchObject({ sourceTable: "phase", step: "P-03", basis: "M", sourceBasis: "M", actionBasis: "R/C", traceDisposition: "context", mappingRationale: expect.any(String) });
    for (const trace of scanPhotometerPlacement) expect(trace).toMatchObject({ sourceTable: "phase", step: "P-03", basis: "M", sourceBasis: "M", actionBasis: "R/C", traceDisposition: "context", mappingRationale: expect.any(String) });
    for (const trace of scanBlankInsertions) expect(trace).toMatchObject({ sourceTable: "phase", step: "P-03", basis: "M", sourceBasis: "M", actionBasis: "R/C", traceDisposition: "context" });
    for (const trace of scanBlankApplications) expect(trace).toMatchObject({ sourceTable: "phase", step: "P-03", basis: "M", sourceBasis: "M", actionBasis: "R/C", traceDisposition: "context" });
    for (const trace of scanBlankRemovals) expect(trace).toMatchObject({ sourceTable: "phase", step: "P-05", basis: "M", sourceBasis: "M", actionBasis: "R/C", traceDisposition: "context" });

    expectTrace("brass-spectrophotometry", "measure-50ml-digest-water-action", {
      traceDisposition: "context",
      sourceBasis: "M",
      actionBasis: "M/R",
      mappingRationale: expect.any(String),
    });
    expectTrace("brass-spectrophotometry", "blank-wipe-orient-action", {
      traceDisposition: "context",
      sourceBasis: "M",
      actionBasis: "M/R",
      mappingRationale: expect.any(String),
    });

    expect(brassTraceRows.some((trace) => trace.actionId === "scan-condition-salt-a-once-action" && trace.basis === "M/R")).toBe(false);
    expect(brassTraceRows.some((trace) => /^scan-remove-\d+-salt-[ab]-action$/.test(trace.actionId) && trace.step === "P-04")).toBe(false);
  });

  it("records the bounded residual source-trace omissions without inventing citations", () => {
    const omitted = new Set([
      "technique:blue1-percent-transmittance#i1-configure-unknown-operational-inventory",
      "technique:blue1-percent-transmittance#i1-configure-unknown-dilution-water",
      "technique:brass-spectrophotometry#scan-configure-salt-a-inventory-action",
      "technique:brass-spectrophotometry#scan-configure-salt-b-inventory-action",
      ...paperTechnique.actions
        .filter((action) => action.atomId === "atom.observe.dry-developed-chromatography-paper")
        .map((action) => `technique:paper-chromatography#${action.id}`),
    ]);
    expect(omitted.size).toBe(21);
    for (const key of omitted) {
      expect(traceRows.has(key), key).toBe(false);
      expect(groupedTraceRows.has(key), key).toBe(false);
    }
    expect(traceRows.has("technique:brass-spectrophotometry#scan-place-photometer-action")).toBe(true);
  });
});
