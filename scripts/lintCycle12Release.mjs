import { createServer } from "vite";

const server = await createServer({
  root: process.cwd(),
  configFile: false,
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true },
});

try {
  const release = await server.ssrLoadModule(
    "/src/domain-packs/assay/services/releaseServices.ts",
  );
  const mcp = await server.ssrLoadModule("/server/mcp/assayServices.ts");
  const mcpRegistration = await server.ssrLoadModule("/server/mcp/domainRegistration.ts");
  const planningFixture = await server.ssrLoadModule(
    "/src/domain-packs/assay/planning/__fixtures__/cycle09PlanningFixture.ts",
  );
  const ingestionFixture = await server.ssrLoadModule(
    "/src/domain-packs/assay/ingestion/__fixtures__/cycle10IngestionFixture.ts",
  );
  const procedureFixture = await server.ssrLoadModule(
    "/src/domain-packs/chemistry/__fixtures__/chemistry-compose-procedure.v1.json",
  );
  const templates = [
    "blank-96",
    "xtt-metabolic-activity",
    "educational-broth-microdilution",
  ];
  const artifacts = [];
  for (const [index, templateId] of templates.entries()) {
    const composition = release.assayReleaseServices.composeAssay({
      templateId,
      id: `cycle12-${templateId}`,
      title: `Cycle 12 ${templateId} release lint`,
      updatedAt: "2026-07-26T23:45:00.000Z",
      package: {
        packageId: `cycle12-${templateId}-package`,
        createdAt: "2026-07-26T23:45:00.000Z",
      },
    });
    if (!composition.ok) throw new Error(JSON.stringify(composition.diagnostics));
    const report = release.createAssayReleaseReport(composition.artifact, {
      packageId: `cycle12-report-${index}`,
      createdAt: "2026-07-26T23:45:00.000Z",
    });
    if (!report.validation.ok || report.downloadableFiles.length !== 4) {
      throw new Error(`Incomplete release report for ${templateId}.`);
    }
    const serialized = JSON.stringify({ composition, report });
    if (/clinicalBreakpoint|susceptibilityCategory|treatmentAdvice|providerFileId|localFilePath/.test(serialized)) {
      throw new Error(`Forbidden release field found for ${templateId}.`);
    }
    artifacts.push(composition.artifact);
  }
  const candidate = structuredClone(artifacts[0]);
  candidate.title = "Cycle 12 reviewed candidate";
  const comparison = release.compareAssayArtifacts(artifacts[0], candidate);
  if (!comparison.compatible || !comparison.changedSections.includes("title")) {
    throw new Error("Semantic compare did not report a compatible title change.");
  }
  const applied = release.applyAssayCandidateTransaction({
    current: artifacts[0],
    candidate,
    expectedCurrentVersion: artifacts[0].metadata.version,
  });
  if (!applied.ok || applied.artifact.title !== candidate.title) {
    throw new Error("Validated candidate transaction did not apply atomically.");
  }
  const toolNames = mcp.assayToolContracts.map(({ suffix }) => `assaystudio.${suffix}`).sort();
  const expectedTools = [
    "assaystudio.assess_protocol",
    "assaystudio.compose_assay",
    "assaystudio.ingest_observations",
    "assaystudio.plan_run",
    "assaystudio.search_capabilities",
    "assaystudio.validate_assay",
  ];
  if (JSON.stringify(toolNames) !== JSON.stringify(expectedTools)) {
    throw new Error(`Unexpected assay MCP registration: ${JSON.stringify(toolNames)}`);
  }
  for (const contract of mcp.assayToolContracts) {
    if (
      contract.inputSchema.type !== "object"
      || contract.inputSchema.additionalProperties !== false
      || contract.outputSchema.additionalProperties !== false
    ) {
      throw new Error(`Tool ${contract.suffix} does not publish strict top-level schemas.`);
    }
  }
  const registered = mcpRegistration.registerDomainTools(mcp.assayMcpDomainRegistration);
  const byName = new Map(registered.map((tool) => [tool.name, tool]));
  const planningArtifact = planningFixture.createCycle09PlanningArtifact();
  const calls = [
    ["assaystudio.search_capabilities", {
      requestId: "cycle12-lint-search",
      query: "assay",
      limit: 10,
    }],
    ["assaystudio.assess_protocol", {
      requestId: "cycle12-lint-assess",
      procedure: procedureFixture.default,
      constraints: { requiredOperationRefs: [] },
    }],
    ["assaystudio.compose_assay", {
      requestId: "cycle12-lint-compose",
      templateId: "xtt-metabolic-activity",
      id: "cycle12-lint-mcp-xtt",
      title: "Cycle 12 lint MCP XTT",
      updatedAt: "2026-07-26T23:45:00.000Z",
    }],
    ["assaystudio.validate_assay", {
      requestId: "cycle12-lint-validate",
      artifact: artifacts[0],
    }],
    ["assaystudio.plan_run", {
      requestId: "cycle12-lint-plan",
      artifact: planningArtifact,
      planningRequest: planningFixture.createCycle09AssayPlanningRequest(),
    }],
    ["assaystudio.ingest_observations", {
      requestId: "cycle12-lint-ingest",
      kind: "csv",
      contents: ingestionFixture.cycle10LongCsv,
      mapping: {
        format: "long",
        delimiter: ",",
        decimalSeparator: ".",
        orientation: "A1-top-left",
        plateIdColumn: "Plate",
        wellColumn: "Well",
        signalColumn: "Signal",
        unitColumn: "Unit",
        channelColumn: "Channel",
        capturedAtColumn: "CapturedAt",
      },
      importId: "cycle12-lint-ingest",
      sourceName: "Cycle 12 lint",
      sourceVersion: "1.0.0",
      createdAt: "2026-07-26T23:45:00.000Z",
    }],
  ];
  for (const [name, input] of calls) {
    const tool = byName.get(name);
    if (!tool) throw new Error(`Missing registered tool ${name}.`);
    await tool.invoke(input);
  }
  console.log(
    "Cycle 12 release lint passed: 3 bounded templates validated and packaged; "
    + "semantic compare/apply valid; 4 review files per artifact; "
    + "6 strict assay MCP contracts registered and schema-invoked.",
  );
} finally {
  await server.close();
}
