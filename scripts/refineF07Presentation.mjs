import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const applicationRoot = path.resolve(scriptDirectory, "..");
const decisionsOutputIndex = process.argv.indexOf("--decisions-out");
const decisionsOutputPath = decisionsOutputIndex >= 0 && process.argv[decisionsOutputIndex + 1]
  ? path.resolve(process.argv[decisionsOutputIndex + 1])
  : null;

const sourceFiles = Object.freeze({
  hand: "hand-warmer-design-challenge_2026-07-27.md",
  paper: "sticky-question-paper-chromatography_2026-07-27.md",
  quick: "quick-ache-relief-component-separation_2026-07-27.md",
  green: "purify-a-mixture-green-chemistry_2026-07-27.md",
  brass: "how-can-color-determine-copper-in-brass_2026-07-27.md",
});

const techniquePaths = Object.freeze({
  "hand-warmer-calorimetry": "public/techniques/hand-warmer-calorimetry.json",
  "paper-chromatography": "public/techniques/paper-chromatography.json",
  "quick-ache-extraction-recovery": "public/techniques/quick-ache-extraction-recovery.json",
  "quick-ache-property-evidence": "public/techniques/quick-ache-property-evidence.json",
  "thermal-decomposition-mass-loss": "public/techniques/thermal-decomposition-mass-loss.json",
  "brass-spectrophotometry": "public/techniques/brass-spectrophotometry.json",
});

const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(applicationRoot, relativePath), "utf8"));
const writeJson = (absolutePath, value) => {
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};
const sameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const sourcePath = (fileName) => fileName;

const ensureArrayIndex = (value, index, label) => {
  if (!Array.isArray(value) || typeof value[index] !== "string") {
    throw new Error(`Expected ${label}[${index}] to be a string.`);
  }
};

const ensureAction = (techniqueCache, ownerId, actionId, atomId) => {
  const technique = techniqueCache.get(ownerId);
  if (!technique) throw new Error(`No public technique is configured for ${ownerId}.`);
  const action = (technique.actions ?? []).find((candidate) => candidate.id === actionId);
  if (!action) throw new Error(`Expected ${ownerId} action ${actionId} is missing.`);
  if (atomId && action.atomId !== atomId) {
    throw new Error(`Expected ${ownerId} action ${actionId} to use ${atomId}; found ${action.atomId ?? "none"}.`);
  }
};

const ensureAtom = (atoms, atomId) => {
  const atom = atoms.find((candidate) => candidate.id === atomId);
  if (!atom) throw new Error(`Expected atom ${atomId} is missing.`);
  if (!Array.isArray(atom.sourceExamples)) throw new Error(`Atom ${atomId} has no sourceExamples array.`);
  return atom;
};

const sourceExample = (fileName, sourceTable, step, basis) => ({
  sourceFile: sourcePath(fileName),
  sourceTable,
  step,
  basis,
});

const buildSourceRows = (registry, atomsDocument, techniqueCache) => {
  const addedTraceRows = [];
  const draftRowsToReplace = new Set([
    "place-balance|EX-01",
    "place-empty-crucible|EX-03",
    "place-ring-stand|HEAT-00",
    "add-clay-triangle|HEAT-02",
    "place-bunsen-burner|HEAT-05",
    "place-crucible-on-support|HEAT-03",
    "cool-crucible|EX-12/EX-13",
  ]);
  registry.traces = registry.traces.filter((row) => {
    if (row.ownerId !== "thermal-decomposition-mass-loss" || row.sourceFile !== sourceFiles.green) return true;
    const key = `${row.actionId}|${row.step}`;
    return !draftRowsToReplace.has(key) || row.traceDisposition === "context";
  });
  const addTrace = ({
    ownerId,
    actionId,
    atomId,
    sourceFile,
    sourceTable,
    step,
    basis,
    traceDisposition,
    sourceBasis,
    actionBasis,
    mappingRationale,
  }) => {
    ensureAction(techniqueCache, ownerId, actionId, atomId);
    const row = {
      ownerType: "technique",
      ownerId,
      actionId,
      atomId,
      sourceFile: sourcePath(sourceFile),
      sourceTable,
      step,
      basis,
    };
    if (traceDisposition) {
      Object.assign(row, {
        traceDisposition,
        sourceBasis,
        actionBasis,
        mappingRationale,
      });
    }
    const existing = registry.traces.find((candidate) => (
      candidate.ownerId === row.ownerId
      && candidate.actionId === row.actionId
      && candidate.atomId === row.atomId
      && candidate.sourceFile === row.sourceFile
      && candidate.sourceTable === row.sourceTable
      && candidate.step === row.step
    ));
    if (existing) {
      if (!sameJson(existing, row)) {
        throw new Error(`Conflicting source trace already exists for ${ownerId}#${actionId}#${step}.`);
      }
      return;
    }
    registry.traces.push(row);
    addedTraceRows.push(row);
  };

  const addExample = (atomId, entry) => {
    const atom = ensureAtom(atomsDocument.atoms, atomId);
    const existing = atom.sourceExamples.find((candidate) => (
      candidate.sourceFile === entry.sourceFile
      && candidate.sourceTable === entry.sourceTable
      && candidate.step === entry.step
    ));
    if (existing) {
      if (!sameJson(existing, entry)) throw new Error(`Conflicting source example already exists for ${atomId}#${entry.step}.`);
      return;
    }
    atom.sourceExamples.push(entry);
  };
  const removeExample = (atomId, predicate) => {
    const atom = ensureAtom(atomsDocument.atoms, atomId);
    atom.sourceExamples = atom.sourceExamples.filter((entry) => !predicate(entry));
  };

  // Hand Warmer: one source locator per duplicated executable operation.
  for (const actionId of ["P1-13", "P1-14", "P1-13-T2", "P1-14-T2", "P1-13-R1", "P1-14-R1"]) {
    addTrace({ ownerId: "hand-warmer-calorimetry", actionId, atomId: "atom.observe.control-calorimetry-stirrer", sourceFile: sourceFiles.hand, sourceTable: "phase", step: "PR-06", basis: "M" });
  }
  for (const actionId of ["P1-26", "P1-26-T2", "P1-26-R1"]) {
    addTrace({ ownerId: "hand-warmer-calorimetry", actionId, atomId: "atom.observe.identify-temperature-peak", sourceFile: sourceFiles.hand, sourceTable: "phase", step: "PR-09", basis: "M" });
  }
  for (const actionId of ["P2-M13", "P2-M13-D2", "P2-M13-D3"]) {
    addTrace({ ownerId: "hand-warmer-calorimetry", actionId, atomId: "atom.observe.wait-calorimetry-interval", sourceFile: sourceFiles.hand, sourceTable: "phase", step: "CA-09", basis: "M" });
  }
  for (const actionId of ["P2-M14", "P2-M14-D2", "P2-M14-D3"]) {
    addTrace({ ownerId: "hand-warmer-calorimetry", actionId, atomId: "atom.observe.read-timed-temperature", sourceFile: sourceFiles.hand, sourceTable: "phase", step: "CA-10", basis: "M" });
  }
  for (const actionId of ["P2-H08-D1-READ-01", "P2-H08-D2-READ-01", "P2-H08-D3-READ-01"]) {
    addTrace({ ownerId: "hand-warmer-calorimetry", actionId, atomId: "atom.observe.read-immersed-probe", sourceFile: sourceFiles.hand, sourceTable: "phase", step: "CA-05", basis: "M" });
  }
  addExample("atom.observe.read-immersed-probe", sourceExample(sourceFiles.hand, "phase", "CA-05", "M"));

  // Paper chromatography: TR-12 is the front measurement; TR-14 and TR-16 are separate band reads.
  const chromatographySolvents = ["water", "propanol", "ethanol", "acetone", "chromatography-solvent"];
  const frontActions = ["measure-water-solvent-front", "measure-propanol-solvent-front"];
  for (const solvent of chromatographySolvents) {
    for (let trial = 1; trial <= 3; trial += 1) frontActions.push(`measure-choice-${solvent}-${trial}-solvent-front`);
  }
  for (const actionId of frontActions) {
    addTrace({ ownerId: "paper-chromatography", actionId, atomId: "atom.observe.measure-chromatography-distance", sourceFile: sourceFiles.paper, sourceTable: "phase", step: "TR-12", basis: "M" });
  }
  const bandActions = [
    ["measure-water-purple-overlap", "TR-14"],
    ["measure-water-yellow", "TR-16"],
    ["measure-propanol-blue", "TR-14"],
    ["measure-propanol-red", "TR-16"],
    ["measure-propanol-yellow", "TR-16"],
  ];
  for (const solvent of chromatographySolvents) {
    for (let trial = 1; trial <= 3; trial += 1) {
      bandActions.push([`measure-choice-${solvent}-${trial}-region-1`, "TR-14"]);
      if (trial >= 2) bandActions.push([`measure-choice-${solvent}-${trial}-region-2`, "TR-16"]);
      if (trial === 3) bandActions.push([`measure-choice-${solvent}-${trial}-region-3`, "TR-16"]);
    }
  }
  for (const [actionId, step] of bandActions) {
    addTrace({ ownerId: "paper-chromatography", actionId, atomId: "atom.observe.measure-chromatography-distance", sourceFile: sourceFiles.paper, sourceTable: "phase", step, basis: "M" });
  }
  const measurementAtom = ensureAtom(atomsDocument.atoms, "atom.observe.measure-chromatography-distance");
  measurementAtom.sourceExamples = measurementAtom.sourceExamples.filter((entry) => entry.step !== "TR-14/TR-16");
  addExample("atom.observe.measure-chromatography-distance", sourceExample(sourceFiles.paper, "phase", "TR-14", "M"));
  addExample("atom.observe.measure-chromatography-distance", sourceExample(sourceFiles.paper, "phase", "TR-16", "M"));

  // Quick Ache: direct observations plus the five executable plan-gravity aliases that reuse E-12 evidence.
  for (const actionId of [
    "qar-inspect-separated-layers",
    "plan-wash-2-qar-inspect-separated-layers",
    "plan-wash-3-qar-inspect-separated-layers",
    "plan-wash-4-qar-inspect-separated-layers",
    "plan-wash-5-qar-inspect-separated-layers",
  ]) {
    addTrace({ ownerId: "quick-ache-extraction-recovery", actionId, atomId: "atom.observe.extraction-layer-state", sourceFile: sourceFiles.quick, sourceTable: "phase", step: "E-05", basis: "R" });
  }
  for (const actionId of [
    "qar-identify-layer-from-evidence",
    "plan-wash-2-qar-identify-layer-from-evidence",
    "plan-wash-3-qar-identify-layer-from-evidence",
    "plan-wash-4-qar-identify-layer-from-evidence",
    "plan-wash-5-qar-identify-layer-from-evidence",
  ]) {
    addTrace({ ownerId: "quick-ache-extraction-recovery", actionId, atomId: "atom.observe.identify-extraction-layers-from-evidence", sourceFile: sourceFiles.quick, sourceTable: "phase", step: "E-06", basis: "M" });
  }
  for (const actionId of ["qar-read-recovery-ph", "plan-gravity-qar-read-recovery-ph"]) {
    addTrace({ ownerId: "quick-ache-extraction-recovery", actionId, atomId: "atom.observe.read-recovery-ph", sourceFile: sourceFiles.quick, sourceTable: "phase", step: "E-09", basis: "C" });
  }
  for (const actionId of [
    "qar-inspect-sucrose-property-result",
    "qar-inspect-acetaminophen-property-result",
    "qar-inspect-aspirin-property-result",
  ]) {
    addTrace({ ownerId: "quick-ache-property-evidence", actionId, atomId: "atom.observe.record-property-test-result", sourceFile: sourceFiles.quick, sourceTable: "phase", step: "P-04", basis: "M" });
  }
  const quickMassAliases = [
    ["plan-gravity-qar-weigh-filter-paper-tare", "atom.weigh.filter-medium-tare"],
    ["plan-gravity-qar-weigh-acidic-watch-glass-tare", "atom.weigh.tare-vessel"],
    ["plan-gravity-qar-weigh-acidic-solid", "atom.weigh.dry-assembly"],
    ["plan-gravity-qar-weigh-aqueous-watch-glass-tare", "atom.weigh.tare-vessel"],
    ["plan-gravity-qar-weigh-aqueous-solid", "atom.weigh.dry-assembly"],
  ];
  for (const [actionId, atomId] of quickMassAliases) {
    addTrace({
      ownerId: "quick-ache-extraction-recovery",
      actionId,
      atomId,
      sourceFile: sourceFiles.quick,
      sourceTable: "phase",
      step: "E-12",
      basis: "M",
      traceDisposition: "context",
      sourceBasis: "M",
      actionBasis: "R/C",
      mappingRationale: "The plan-gravity action is an executable compatibility alias for the canonical E-12 dry-mass evidence; it does not create a second source-stated operation.",
    });
  }
  const tareContextRationale = "E-12 states read and record dry mass; tare/placement support is runtime inference required to pair that recorded dry mass with its vessel, not a separately stated tare operation.";
  for (const actionId of [
    "qar-weigh-filter-paper-tare",
    "qar-weigh-acidic-watch-glass-tare",
    "qar-weigh-organic-watch-glass-tare",
    "qar-weigh-aqueous-watch-glass-tare",
  ]) {
    const row = registry.traces.find((candidate) => (
      candidate.ownerId === "quick-ache-extraction-recovery"
      && candidate.actionId === actionId
      && candidate.sourceFile === sourceFiles.quick
      && candidate.sourceTable === "phase"
      && candidate.step === "E-12"
    ));
    if (!row) throw new Error(`Expected canonical Quick E-12 tare row is missing: ${actionId}`);
    if (row.traceDisposition === "context") {
      if (row.sourceBasis !== "M" || row.actionBasis !== "R/C" || row.mappingRationale !== tareContextRationale) {
        throw new Error(`Canonical Quick E-12 tare context is inconsistent: ${actionId}`);
      }
    } else {
      row.traceDisposition = "context";
      row.sourceBasis = "M";
      row.actionBasis = "R/C";
      row.mappingRationale = tareContextRationale;
    }
  }
  // E-12 states the dry-mass read/record. It does not authorize separate direct
  // placement/tare source examples; compatibility aliases carry that inference in trace context.
  for (const atomId of ["atom.weigh.filter-medium-tare", "atom.weigh.tare-vessel"]) {
    removeExample(atomId, (entry) => entry.sourceFile === sourceFiles.quick && entry.sourceTable === "phase" && entry.step === "E-12");
  }

  // Green Chemistry: exact executable source rows; existing reads/recovery rows are deliberately untouched.
  const greenRows = [
    ["place-balance", "atom.place.balance-instrument", "phase", "EX-01", "M", "context", "M", "R/C", "EX-01 selects one balance for the run; physical placement is runtime setup inferred from that selection, not a separately stated source operation."],
    ["place-empty-crucible", "atom.place.weighed-vessel", "phase", "EX-03", "R/M", "context", "R/M", "R/C", "EX-03 checks a clean, cool crucible before reading; bench placement is runtime handling inferred from that check, not a separately stated source operation."],
    ["add-carbonate-sample", "atom.transfer.solid-portion", "phase", "EX-06", "M"],
    ["place-ring-stand", "atom.place.thermal-support", "apparatus", "HEAT-00", "F/R", "context", "F/R", "R/C", "HEAT-00 is an apparatus figure/table locator without a Basis column; F/R records the figure-supported support state, while placement is the runtime handling interpretation."],
    ["add-clay-triangle", "atom.place.thermal-support", "apparatus", "HEAT-02", "F/R", "context", "F/R", "R/C", "HEAT-02 is an apparatus figure/table locator without a Basis column; F/R records the figure-supported clay-triangle state, while seating it is the runtime handling interpretation."],
    ["place-bunsen-burner", "atom.place.thermal-heating-instrument", "apparatus", "HEAT-05", "F/R", "context", "F/R", "R/C", "HEAT-05 is an apparatus figure/table locator without a Basis column; F/R records the figure-supported burner state, while placement is the runtime handling interpretation."],
    ["place-crucible-on-support", "atom.place.thermal-crucible-assembly", "apparatus", "HEAT-03", "F/R", "context", "F/R", "R/C", "HEAT-03 is an apparatus figure/table locator without a Basis column; F/R records the figure-supported crucible-on-support state, while placement is the runtime handling interpretation."],
    ["set-crucible-lid", "atom.place.thermal-crucible-assembly", "phase", "EX-09", "M/F"],
    ["warm-gently", "atom.heat.thermal-decomposition-stage", "phase", "EX-10", "M/C"],
    ["heat-carbonate-mixture", "atom.heat.thermal-decomposition-stage", "phase", "EX-10", "M/C"],
    ["turn-off-burner", "atom.control.thermal-burner", "phase", "EX-11", "R"],
    ["cool-crucible", "atom.cool.before-weighing", "phase", "EX-12", "M/R"],
    ["cool-crucible", "atom.cool.before-weighing", "phase", "EX-13", "M"],
    ["repeat-heat-to-constant-mass", "atom.heat.thermal-decomposition-stage", "phase", "EX-16", "M/C"],
    ["cool-constant-mass-crucible", "atom.cool.before-weighing", "phase", "EX-16", "M/C"],
  ];
  for (const [actionId, atomId, sourceTable, step, basis, traceDisposition, sourceBasis, actionBasis, mappingRationale] of greenRows) {
    addTrace({ ownerId: "thermal-decomposition-mass-loss", actionId, atomId, sourceFile: sourceFiles.green, sourceTable, step, basis, traceDisposition, sourceBasis, actionBasis, mappingRationale });
  }
  for (const [atomId, sourceTable, step, basis] of [
    ["atom.transfer.solid-portion", "phase", "EX-06", "M"],
    ["atom.place.thermal-support", "apparatus", "HEAT-00", "F/R"],
    ["atom.place.thermal-support", "apparatus", "HEAT-02", "F/R"],
    ["atom.place.thermal-heating-instrument", "apparatus", "HEAT-05", "F/R"],
    ["atom.place.thermal-crucible-assembly", "apparatus", "HEAT-03", "F/R"],
    ["atom.place.thermal-crucible-assembly", "phase", "EX-09", "M/F"],
    ["atom.heat.thermal-decomposition-stage", "phase", "EX-10", "M/C"],
    ["atom.heat.thermal-decomposition-stage", "phase", "EX-16", "M/C"],
    ["atom.control.thermal-burner", "phase", "EX-11", "R"],
    ["atom.cool.before-weighing", "phase", "EX-12", "M/R"],
    ["atom.cool.before-weighing", "phase", "EX-13", "M"],
    ["atom.cool.before-weighing", "phase", "EX-16", "M/C"],
  ]) {
    addExample(atomId, sourceExample(sourceFiles.green, sourceTable, step, basis));
  }
  removeExample("atom.place.balance-instrument", (entry) => entry.sourceFile === sourceFiles.green && entry.sourceTable === "phase" && entry.step === "EX-01");
  removeExample("atom.place.weighed-vessel", (entry) => entry.sourceFile === sourceFiles.green && entry.sourceTable === "phase" && entry.step === "EX-03");
  removeExample("atom.cool.before-weighing", (entry) => entry.sourceFile === sourceFiles.green && entry.sourceTable === "phase" && entry.step === "EX-12/EX-13");
  addExample("atom.cool.before-weighing", sourceExample(sourceFiles.green, "phase", "EX-12", "M/R"));
  addExample("atom.cool.before-weighing", sourceExample(sourceFiles.green, "phase", "EX-13", "M"));

  // Brass: configured per-wavelength scan blank lifecycle is context, not a fabricated P-01-P-05 row.
  const scanRationale = "P-01-P-05 has no scan-blank row; this accepted per-wavelength distilled-water cycle is retained as configured runtime handling and is not attributed to S-03/S-04 calibration.";
  addTrace({
    ownerId: "brass-spectrophotometry",
    actionId: "scan-prepare-distilled-water-blank-action",
    atomId: "atom.transfer.prepare-photometric-blank",
    sourceFile: sourceFiles.brass,
    sourceTable: "phase",
    step: "P-03",
    basis: "M",
    traceDisposition: "context",
    sourceBasis: "M",
    actionBasis: "R/C",
    mappingRationale: scanRationale,
  });
  addTrace({
    ownerId: "brass-spectrophotometry",
    actionId: "scan-place-photometer-action",
    atomId: "atom.place.photometer",
    sourceFile: sourceFiles.brass,
    sourceTable: "phase",
    step: "P-03",
    basis: "M",
    traceDisposition: "context",
    sourceBasis: "M",
    actionBasis: "R/C",
    mappingRationale: "Photometer placement is runtime setup associated with the P-03 scan read; P-01-P-05 does not state it as a separate operation.",
  });
  for (const wavelength of Array.from({ length: 16 }, (_, index) => 400 + index * 20)) {
    addTrace({
      ownerId: "brass-spectrophotometry",
      actionId: `scan-insert-${wavelength}-blank-action`,
      atomId: "atom.place.insert-cuvette",
      sourceFile: sourceFiles.brass,
      sourceTable: "phase",
      step: "P-03",
      basis: "M",
      traceDisposition: "context",
      sourceBasis: "M",
      actionBasis: "R/C",
      mappingRationale: scanRationale,
    });
    addTrace({
      ownerId: "brass-spectrophotometry",
      actionId: `scan-blank-${wavelength}-action`,
      atomId: "atom.observe.blank-photometer",
      sourceFile: sourceFiles.brass,
      sourceTable: "phase",
      step: "P-03",
      basis: "M",
      traceDisposition: "context",
      sourceBasis: "M",
      actionBasis: "R/C",
      mappingRationale: scanRationale,
    });
    addTrace({
      ownerId: "brass-spectrophotometry",
      actionId: `scan-remove-${wavelength}-blank-action`,
      atomId: "atom.place.remove-cuvette",
      sourceFile: sourceFiles.brass,
      sourceTable: "phase",
      step: "P-05",
      basis: "M",
      traceDisposition: "context",
      sourceBasis: "M",
      actionBasis: "R/C",
      mappingRationale: scanRationale,
    });
  }

  return addedTraceRows;
};

const updateLabPresentation = () => {
  const marbleLab = readJson("public/labs/marble-statue-kinetics.json");
  marbleLab.description = "An inquiry-centered kinetics lab that plans a controlled HCl and CaCO3 investigation, runs a teacher-approved gas-syringe configuration with teacher-approved acid concentration/volume and marble-mass choices, revises the procedure, compares time-series rates, and qualifies a marble-weathering model; generated gas-syringe series remain distinct from student measurement evidence.";
  ensureArrayIndex(marbleLab.learningGoals, 2, "marble learningGoals");
  marbleLab.learningGoals[2] = "Collect and distinguish simulator-generated CO2 volume-versus-time series from teacher configuration and student measurements.";
  writeJson(path.join(applicationRoot, "public/labs/marble-statue-kinetics.json"), marbleLab);

  const marbleTechnique = readJson("public/techniques/marble-gas-syringe-kinetics.json");
  marbleTechnique.learningGoal = "Assemble a safe expanding gas-collection path, use teacher-approved acid volume/concentration and marble-mass settings, collect a synchronized carbon-dioxide time series, distinguish simulator-generated series from student measurements, calculate an initial rate, and identify limits on the evidence.";
  writeJson(path.join(applicationRoot, "public/techniques/marble-gas-syringe-kinetics.json"), marbleTechnique);

  const greenLab = readJson("public/labs/green-chemistry-mixture-purification.json");
  greenLab.description = "Design and obtain approval for a selective thermal-decomposition method with no fixed source recipe, using configured sample mass, tare convention, heating/cooling limits, and replicate count; acquire same-balance constant-mass evidence, calculate composition from recorded measurements, recover unheated mixture and heated product separately, and review one teacher-assigned report.";
  ensureArrayIndex(greenLab.learningGoals, 0, "green learningGoals");
  greenLab.learningGoals[0] = "Design and justify a teacher-approved gravimetric method; the source does not prescribe a fixed recipe, so sample mass, tare convention, heating/cooling limits, and replicate count remain configured.";
  writeJson(path.join(applicationRoot, "public/labs/green-chemistry-mixture-purification.json"), greenLab);

  const brassLab = readJson("public/labs/brass-colorimetry.json");
  brassLab.description = "Chemistry Brass Colorimetry: use teacher-controlled brass digestion, quantitative dilution, a five-standard spectrophotometric calibration at an approved wavelength, and an independent color-depth comparison; keep the accepted teacher-configured per-wavelength distilled-water scan separate from the source-selected-wavelength calibration while determining copper mass percent.";
  ensureArrayIndex(brassLab.learningGoals, 1, "brass learningGoals");
  brassLab.learningGoals[1] = "Prepare quantitative transfers and a five-standard dilution series, then calibrate and use a spectrophotometer with defensible cuvette technique; keep the selected-wavelength calibration separate from teacher-configured per-wavelength scan settings.";
  writeJson(path.join(applicationRoot, "public/labs/brass-colorimetry.json"), brassLab);

  const paperLab = readJson("public/labs/paper-chromatography.json");
  paperLab.description = "An inquiry-centered Chemistry Paper Chromatography workflow that preserves five source-listed solvent choices while running one configured water/2-propanol comparison with traceable sample provenance, the sample origin/baseline above the solvent liquid level and the lower paper edge in solvent, measured Rf evidence, a teacher-approved post-development drying gate, solvent-specific disposal, and explicit interpretation limits.";
  ensureArrayIndex(paperLab.learningGoals, 1, "paper learningGoals");
  paperLab.learningGoals[1] = "Prepare, spot, dry the initial spot, seal, develop, mark, observe, and measure a paper chromatogram with the sample origin/baseline above the solvent liquid level and the lower paper edge in solvent; use the teacher-configuration gate for any post-development drying method.";
  const procedureAction = paperLab.actions?.find((action) => action.id === "configure-repeatable-procedure");
  if (!procedureAction) throw new Error("Expected paper configure-repeatable-procedure lab action is missing.");
  const procedureText = "Document the approved paper dimensions, pencil sample origin/baseline, solvent depth and volume, loaded sample and spot volume, and solvent-front stop distance from classroom setup. Keep the sample origin/baseline above the solvent liquid level and the lower paper edge in solvent; dry the initial spot, close the chamber, measure to the nearest millimetre, use fresh labeled paper and solvent for each selected trial, and record any post-development drying method only when teacher-approved.";
  procedureAction.parameters.prompt = procedureText;
  procedureAction.parameters.inputLabel = procedureText;
  procedureAction.interaction.accessibleLabel = procedureText;
  writeJson(path.join(applicationRoot, "public/labs/paper-chromatography.json"), paperLab);
};

const ownerCounts = (traces) => traces.reduce((counts, trace) => {
  counts[trace.ownerId] = (counts[trace.ownerId] ?? 0) + 1;
  return counts;
}, {});

const greenInventory = [
  ["place-balance", "EX-01", "new-atom-trace"],
  ["approve-thermal-decomposition-plan", "IQ-04", "atomless-or-not-registered"],
  ["place-empty-crucible", "EX-03", "new-atom-trace"],
  ["read-empty-crucible", "EX-04", "existing-source-trace"],
  ["record-empty-crucible", "EX-05", "atomless-or-not-registered"],
  ["add-carbonate-sample", "EX-06", "new-atom-trace"],
  ["weigh-initial-crucible", "EX-07", "existing-source-trace"],
  ["record-initial-crucible-mass", "EX-07", "atomless-or-not-registered"],
  ["recover-unused-sample", "EX-08", "existing-source-trace"],
  ["place-ring-stand", "HEAT-00", "new-atom-trace"],
  ["add-clay-triangle", "HEAT-02", "new-atom-trace"],
  ["place-crucible-on-support", "HEAT-03", "new-atom-trace"],
  ["place-bunsen-burner", "HEAT-05", "new-atom-trace"],
  ["set-crucible-lid", "EX-09", "new-atom-trace"],
  ["warm-gently", "EX-10", "new-atom-trace"],
  ["heat-carbonate-mixture", "EX-10", "new-atom-trace"],
  ["turn-off-burner", "EX-11", "new-atom-trace"],
  ["cool-crucible", ["EX-12", "EX-13"], "new-atom-trace"],
  ["weigh-preliminary-final-mass", "EX-14", "existing-source-trace"],
  ["record-cycle-mass", "EX-14/EX-15", "atomless-or-not-registered"],
  ["repeat-heat-to-constant-mass", "EX-16", "new-atom-trace"],
  ["cool-constant-mass-crucible", "EX-16", "new-atom-trace"],
  ["weigh-final-crucible", "EX-14/EX-16", "existing-source-trace"],
  ["record-final-crucible-mass", "EX-14/EX-16", "atomless-or-not-registered"],
  ["complete-replicate", "EX-16/EX-19", "atomless-or-not-registered"],
  ["calculate-carbonate-composition", "EX-17/EX-18", "atomless-or-not-registered"],
  ["record-composition-uncertainty", "11", "atomless-or-not-registered"],
  ["recover-replicate-product", "EX-19", "existing-source-trace"],
  ["recover-final-product", "EX-19", "atomless-or-not-registered"],
];

const decisionPayload = (registry, addedTraceRows, status, extra = {}) => ({
  status,
  phase: "F07-P2",
  validationCeiling: "source-review-and-basic-static-only",
  traceSummary: {
    addedRows: addedTraceRows.length,
    finalRows: registry.traces.length,
    ownerCounts: ownerCounts(registry.traces),
    directRows: addedTraceRows.filter((row) => !row.traceDisposition).length,
    contextRows: addedTraceRows.filter((row) => row.traceDisposition === "context").length,
  },
  sourceDecisions: [
    {
      ownerId: "hand-warmer-calorimetry",
      sourceFile: sourceFiles.hand,
      decision: "Direct traces cover PR-06 stirrer control, PR-09 peak identification, CA-05 hot read, CA-09 wait, and CA-10 timed read, with one source locator per duplicated executable action.",
    },
    {
      ownerId: "paper-chromatography",
      sourceFile: sourceFiles.paper,
      decision: "TR-12 solvent-front measurements and TR-14/TR-16 band measurements are separate direct rows. The sample origin/baseline stays above the solvent liquid level and the lower paper edge stays in solvent. Post-development drying remains a teacher-configuration gate because the source names no method.",
    },
    {
      ownerId: "quick-ache-extraction-recovery",
      sourceFile: sourceFiles.quick,
      decision: "Direct E-05, E-06, E-09, and P-04 rows are added. Canonical tare-support rows and five plan-gravity compatibility aliases are context-mapped to E-12 dry-mass evidence without source-file-null rows; the canonical dry-solid rows remain direct.",
    },
    {
      ownerId: "thermal-decomposition-mass-loss",
      sourceFile: sourceFiles.green,
      decision: "Exact Green EX-01..EX-19 and HEAT apparatus boundaries are retained in a 29-row inventory. Fifteen new atom-bearing rows are registered, seven existing read/recovery rows are preserved, and eight atomless/not-registered rows are not promoted to fabricated direct traces. EX-01/EX-03 placement rows and all apparatus F/R rows carry explicit context rationales.",
    },
    {
      ownerId: "brass-spectrophotometry",
      sourceFile: sourceFiles.brass,
      decision: "Direct P-01..P-05 reads/records and S-03/S-04 calibration remain unchanged. The accepted configured per-wavelength distilled-water scan lifecycle is represented by 50 context rows; P-01..P-05 has no scan-blank row and the configured scan is not attributed to S-03/S-04.",
    },
  ],
  greenInventory: greenInventory.map(([actionId, step, traceStatus]) => ({
    actionId,
    sourceSteps: Array.isArray(step) ? step : [step],
    traceStatus,
  })),
  atomDecisions: [
    "Add CA-05 to the immersed-probe source examples.",
    "Replace the combined chromatography TR-14/TR-16 example with separate TR-14 and TR-16 examples.",
    "Keep Quick E-12 as direct source evidence only on the canonical dry-mass atom; the five plan-gravity tare aliases remain context-mapped because E-12 does not state a separate placement/tare operation.",
    "Add the exact Green atom source examples for transfer, apparatus context, lid, heating, burner control, and cooling; keep EX-01/EX-03 placement inference out of atom sourceExamples and keep the developed-strip drying atom sourceExamples empty.",
    "Do not add Brass scan context rows to atom sourceExamples; direct S-03/S-04 examples remain the source boundary.",
  ],
  presentationDecisions: [
    "Marble acid concentration/volume and marble-mass choices remain teacher-approved settings; generated gas-syringe series remain distinct from student readings.",
    "Green Chemistry states that the source supplies no fixed recipe and keeps mass, tare, heating/cooling, and replicate settings configured.",
    "Brass distinguishes the accepted configured per-wavelength distilled-water scan from source-selected-wavelength calibration and keeps configured scan copy concise.",
    "Paper copy uses the corrected geometry and distinguishes initial-spot drying from the teacher-configured post-development drying gate.",
    "No fixed recipe quantities/rates, expected results, rankings, or efficacy claims were introduced.",
  ],
  residuals: [
    "The seventeen generated dry-developed-chromatogram actions have no direct source method; the existing non-empty teacher-configuration lock remains in place.",
    "The Green 29-row inventory retains atomless/not-registered notebook and calculation rows as bounded presentation or evidence controls, not source-backed physical atoms.",
    "No runtime, browser, test, typecheck, build, policy/compiler, witness, audit, physical, classroom, safety, release, or deployment acceptance is claimed.",
  ],
  ...extra,
});

const applyChanges = () => {
  const registry = readJson("docs/architecture/source-trace-registry.json");
  const atomsDocument = readJson("src/domain/atomRegistry.json");
  const techniqueCache = new Map(Object.entries(techniquePaths).map(([ownerId, relativePath]) => [ownerId, readJson(relativePath)]));
  const addedTraceRows = buildSourceRows(registry, atomsDocument, techniqueCache);
  writeJson(path.join(applicationRoot, "docs/architecture/source-trace-registry.json"), registry);
  writeJson(path.join(applicationRoot, "src/domain/atomRegistry.json"), atomsDocument);
  updateLabPresentation();
  const interimDecisions = decisionPayload(registry, addedTraceRows, "source-registry-and-presentation-authored", {
    generatedAt: new Date().toISOString(),
    generatedOutputsPending: true,
  });
  if (decisionsOutputPath) writeJson(decisionsOutputPath, interimDecisions);
  return { registry, atomsDocument, addedTraceRows };
};

const { registry, addedTraceRows } = applyChanges();

console.log(JSON.stringify({
  status: "authored",
  addedTraceRows: addedTraceRows.length,
  finalTraceRows: registry.traces.length,
  ownerCounts: ownerCounts(registry.traces),
}));
