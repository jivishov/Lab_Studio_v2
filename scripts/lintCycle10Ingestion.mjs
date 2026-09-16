import { createServer } from "vite";

const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
});

try {
  const ingestion = await server.ssrLoadModule(
    "/src/domain-packs/assay/ingestion/index.ts",
  );
  const fixtures = await server.ssrLoadModule(
    "/src/domain-packs/assay/ingestion/__fixtures__/cycle10IngestionFixture.ts",
  );
  const assayFixture = await server.ssrLoadModule(
    "/src/domain-packs/assay/__fixtures__/assay-layout.v1.ts",
  );
  const imported = ingestion.mapAssayCsv(
    fixtures.cycle10LongCsv,
    {
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
    {
      importId: "cycle10-static-lint",
      sourceName: "Cycle 10 static lint",
      sourceVersion: "1.0",
      createdAt: "2026-07-26T12:01:00.000Z",
    },
  );
  const checks = [
    ingestion.validateAssayObservationImport(imported),
    ingestion.validateAssayLensObservationRequest(
      fixtures.cycle10AssayLensRequest,
    ),
    ingestion.validateAssayLensObservationPackage(
      fixtures.cycle10AssayLensObservationPackage,
    ),
  ];
  const failures = checks.filter((result) => !result.ok);
  if (failures.length > 0) {
    throw new Error(JSON.stringify(failures));
  }
  const requestBytes = ingestion.serializeAssayLensObservationRequest(
    fixtures.cycle10AssayLensRequest,
  );
  const requestRoundTrip = ingestion.serializeAssayLensObservationRequest(
    ingestion.parseAssayLensObservationRequest(requestBytes),
  );
  if (requestRoundTrip !== requestBytes) {
    throw new Error("Assay Lens request canonical round-trip drift.");
  }
  const resultBytes = ingestion.serializeAssayLensObservationPackage(
    fixtures.cycle10AssayLensObservationPackage,
  );
  const resultRoundTrip = ingestion.serializeAssayLensObservationPackage(
    JSON.parse(resultBytes),
  );
  if (resultRoundTrip !== resultBytes) {
    throw new Error("Assay Lens result canonical round-trip drift.");
  }
  const review = ingestion.acceptAllMappedObservations(
    ingestion.createObservationReview(imported),
  );
  const commit = ingestion.commitObservationReview(
    review,
    assayFixture.getAssayLayoutGoldenArtifact(),
  );
  if (!commit.ok) {
    throw new Error(JSON.stringify(commit.diagnostics));
  }
  console.log(
    `Cycle 10 schema/semantic lint passed: ${imported.rows.length} mapped; `
    + "bridge request/result v1 canonical round-trip valid; reviewed commit valid.",
  );
} finally {
  await server.close();
}
