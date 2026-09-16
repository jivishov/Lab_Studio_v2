import { describe, expect, it } from "vitest";
import { getAssayLayoutGoldenArtifact } from "../../__fixtures__/assay-layout.v1";
import {
  cycle10AssayLensObservationPackage,
  cycle10AssayLensRequest,
  cycle10CommaDecimalLongCsv,
  cycle10LongCsv,
  cycle10MatrixCsv,
} from "../__fixtures__/cycle10IngestionFixture";
import {
  DisabledAssayLensNetworkBridge,
  acceptAllMappedObservations,
  commitObservationReview,
  createImageAttachmentDescriptor,
  createManualObservationImport,
  createObservationReview,
  fileAssayLensBridge,
  mapAssayCsv,
  parseDelimitedRows,
  parseAssayLensObservationRequest,
  projectIngestedObservationEvidence,
  reviewObservation,
  serializeAssayLensObservationPackage,
  validateAssayLensObservationPackage,
  validateAssayObservationImport,
  validateCsvFileBoundary,
} from "../index";

const longMapping = {
  format: "long" as const,
  delimiter: "," as const,
  decimalSeparator: "." as const,
  orientation: "A1-top-left" as const,
  plateIdColumn: "Plate",
  wellColumn: "Well",
  signalColumn: "Signal",
  unitColumn: "Unit",
  channelColumn: "Channel",
  capturedAtColumn: "CapturedAt",
};

const mapLong = (text = cycle10LongCsv) => mapAssayCsv(text, longMapping, {
  importId: "cycle10-csv-import",
  sourceName: "Synthetic CSV fixture",
  sourceVersion: "1.0",
  createdAt: "2026-07-26T12:01:00.000Z",
});

describe("Cycle 10 assay observation ingestion", () => {
  it("maps long CSV deterministically and preserves explicit plate/channel/unit/timestamp fields", () => {
    expect(mapLong()).toEqual(mapLong());
    const imported = mapLong();
    expect(validateAssayObservationImport(imported).ok).toBe(true);
    expect(imported.rows).toHaveLength(3);
    expect(imported.rows[1].observation).toMatchObject({
      plateId: "assay-cycle06-plate",
      wellId: "assay-cycle06-plate:A2",
      rawValue: "0.875",
      unit: "AU",
      channel: "primary",
      reviewStatus: "unreviewed",
    });
    expect(imported.rows[0].sourceNormalizedValue).toBe("0.14");
  });

  it("rejects observation-import schema version drift and mapped rows without candidates", () => {
    const wrongVersion = structuredClone(mapLong()) as unknown as Record<string, unknown>;
    wrongVersion.schemaVersion = "2.0";
    expect(validateAssayObservationImport(wrongVersion).ok).toBe(false);
    const missingCandidate = structuredClone(mapLong());
    delete missingCandidate.rows[0].observation;
    expect(validateAssayObservationImport(missingCandidate).ok).toBe(false);
  });

  it("requires an explicit semicolon delimiter for comma decimal input", () => {
    const imported = mapAssayCsv(cycle10CommaDecimalLongCsv, {
      ...longMapping,
      delimiter: ";",
      decimalSeparator: ",",
      capturedAtColumn: undefined,
    }, {
      importId: "comma-decimal",
      sourceName: "Synthetic comma decimal fixture",
      sourceVersion: "1.0",
      createdAt: "2026-07-26T12:01:00.000Z",
    });
    expect(imported.rows.map(({ rawValue }) => rawValue)).toEqual(["0.120", "0.875"]);
    expect(mapAssayCsv(cycle10CommaDecimalLongCsv, {
      ...longMapping,
      decimalSeparator: ",",
    }, {
      importId: "ambiguous",
      sourceName: "Synthetic ambiguity fixture",
      sourceVersion: "1.0",
      createdAt: "2026-07-26T12:01:00.000Z",
    }).diagnostics).toContainEqual(expect.objectContaining({
      code: "assay.ingestion.separator-ambiguous",
    }));
  });

  it("maps matrix rows through explicit A-H and 1-12 headers", () => {
    const imported = mapAssayCsv(cycle10MatrixCsv, {
      format: "matrix",
      delimiter: ",",
      decimalSeparator: ".",
      orientation: "A1-top-left",
      plateId: "assay-cycle06-plate",
      unit: "AU",
      channel: "primary",
      rowLabelColumn: "Row",
    }, {
      importId: "cycle10-matrix-import",
      sourceName: "Synthetic matrix fixture",
      sourceVersion: "1.0",
      createdAt: "2026-07-26T12:01:00.000Z",
    });
    expect(imported.rows).toHaveLength(24);
    expect(imported.rows.at(-1)?.observation?.wellId).toBe("assay-cycle06-plate:B12");
  });

  it("reports missing, duplicate, malformed, and multi-plate/channel mappings without guessing", () => {
    const duplicate = mapLong([
      "Plate,Well,Signal,Unit,Channel,CapturedAt",
      "plate-one,A1,1,AU,primary,2026-07-26T12:00:00.000Z",
      "plate-one,A1,2,AU,primary,2026-07-26T12:00:00.000Z",
      "plate-two,A1,3,AU,secondary,2026-07-26T12:00:00.000Z",
      "plate-two,Z99,nope,,secondary,not-a-time",
    ].join("\n"));
    expect(duplicate.rows[1]).toMatchObject({ status: "error" });
    expect(duplicate.rows[2].observation).toMatchObject({
      plateId: "plate-two",
      channel: "secondary",
    });
    expect(duplicate.rows[3].diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining([
      "assay.ingestion.coordinate-invalid",
      "assay.ingestion.signal-invalid",
      "assay.ingestion.unit-missing",
      "assay.ingestion.timestamp-invalid",
    ]));
  });

  it("enforces bounded parser, MIME, image, and malformed-quote handling", () => {
    expect(validateCsvFileBoundary(1_048_577, "text/csv")).toContainEqual(
      expect.objectContaining({ code: "assay.ingestion.file-size" }),
    );
    expect(validateCsvFileBoundary(100, "application/octet-stream")).toContainEqual(
      expect.objectContaining({ code: "assay.ingestion.mime" }),
    );
    expect(createImageAttachmentDescriptor(
      "fixture-image",
      12_582_913,
      "image/png",
      "manual-review",
    )).toMatchObject({ ok: false });
    expect(parseDelimitedRows("Well,Signal\nA1,\"0.1", ",").diagnostics).toContainEqual(
      expect.objectContaining({ code: "assay.ingestion.csv-unclosed-quote" }),
    );
  });

  it("round-trips bridge request/results and rejects versions, paths, EXIF, and invalid confidence", () => {
    expect(JSON.parse(fileAssayLensBridge.exportRequest(cycle10AssayLensRequest))).toEqual(
      cycle10AssayLensRequest,
    );
    expect(parseAssayLensObservationRequest(
      fileAssayLensBridge.exportRequest(cycle10AssayLensRequest),
    )).toEqual(cycle10AssayLensRequest);
    expect(JSON.parse(serializeAssayLensObservationPackage(
      cycle10AssayLensObservationPackage,
    ))).toEqual(cycle10AssayLensObservationPackage);
    const imported = fileAssayLensBridge.importPackage(
      JSON.stringify(cycle10AssayLensObservationPackage),
      {
        importId: "cycle10-assay-lens-import",
        plateId: "assay-cycle06-plate",
        unit: "relative-intensity",
        channel: "primary",
        importedAt: "2026-07-26T12:02:00.000Z",
        sourceDescription: "Synthetic Assay Lens interoperability fixture.",
      },
    );
    expect(imported.sourceType).toBe("image-derived");
    expect(imported.rows.every(({ observation }) => observation?.reviewStatus === "unreviewed")).toBe(true);
    expect(imported.rows[1].observation).toMatchObject({
      rawValue: "0.82",
      confidence: "0.91",
      provenance: {
        methodId: "synthetic-intensity-fixture",
        methodVersion: "1.0.0",
      },
    });

    const invalidVersion = structuredClone(cycle10AssayLensObservationPackage) as unknown as Record<string, unknown>;
    invalidVersion.schemaVersion = "2.0";
    expect(validateAssayLensObservationPackage(invalidVersion).ok).toBe(false);
    const invalidExif = structuredClone(cycle10AssayLensObservationPackage) as unknown as {
      exif?: unknown;
    };
    invalidExif.exif = { camera: "forbidden" };
    expect(validateAssayLensObservationPackage(invalidExif).ok).toBe(false);
    const invalidPath = structuredClone(cycle10AssayLensObservationPackage);
    invalidPath.analysis.settings.source = "C:\\Users\\example\\plate.png";
    expect(validateAssayLensObservationPackage(invalidPath).ok).toBe(false);
    const invalidConfidence = structuredClone(cycle10AssayLensObservationPackage);
    invalidConfidence.observations[0].confidence = "1.1";
    expect(validateAssayLensObservationPackage(invalidConfidence).ok).toBe(false);
  });

  it("labels manual image extraction without retaining image bytes, paths, or EXIF", () => {
    const missingAttachment = createManualObservationImport({
      importId: "manual-image",
      plateId: "assay-cycle06-plate",
      coordinate: "A1",
      rawValue: "0.5",
      unit: "relative-intensity",
      sourceType: "image-derived",
      createdAt: "2026-07-26T12:01:00.000Z",
    });
    expect(missingAttachment.rows[0].status).toBe("error");
    const imported = createManualObservationImport({
      importId: "manual-image",
      plateId: "assay-cycle06-plate",
      coordinate: "A1",
      rawValue: "0.5",
      unit: "relative-intensity",
      sourceType: "image-derived",
      attachmentId: "transient-image-1",
      createdAt: "2026-07-26T12:01:00.000Z",
    });
    expect(imported.rows[0]).toMatchObject({
      sourceFlags: ["manual-image-extraction", "no-built-in-cv"],
      observation: {
        sourceType: "image-derived",
        provenance: {
          sourceId: "transient-image-1",
          methodId: "assay-studio-manual-image-review",
        },
      },
    });
    expect(JSON.stringify(imported)).not.toMatch(/(?:"localPath"|"filePath"|image\/png|data:image)/i);
  });

  it("blocks unreviewed values, commits explicit decisions, and preserves correction evidence", () => {
    const assay = getAssayLayoutGoldenArtifact();
    const imported = fileAssayLensBridge.importPackage(
      JSON.stringify(cycle10AssayLensObservationPackage),
      {
        importId: "cycle10-assay-lens-import",
        plateId: assay.plate.id,
        unit: "relative-intensity",
        importedAt: "2026-07-26T12:02:00.000Z",
        sourceDescription: "Synthetic Assay Lens interoperability fixture.",
      },
    );
    const initial = createObservationReview(imported);
    expect(commitObservationReview(initial, assay)).toMatchObject({ ok: false });
    const accepted = reviewObservation(initial, initial.observations[0].id, "accepted");
    const corrected = reviewObservation(accepted, accepted.observations[1].id, "corrected", {
      acceptedValue: "0.81",
      reason: "Explicit synthetic correction.",
      actorRole: "reviewer",
      occurredAt: "2026-07-26T12:03:00.000Z",
    });
    const committed = commitObservationReview(corrected, assay);
    expect(committed).toMatchObject({ ok: true });
    expect(committed.observationSet?.manualCorrections[0]).toMatchObject({
      previousValue: "0.82",
      acceptedValue: "0.81",
    });
    expect(projectIngestedObservationEvidence(corrected)[1]).toMatchObject({
      sourceType: "image-derived",
      value: "0.81",
      reviewStatus: "corrected",
      correctionRef: expect.any(String),
      flags: expect.arrayContaining(["manual-boundary-review", "assay-lens-manual-correction"]),
      upstreamCorrection: {
        previousValue: "0.80",
        acceptedValue: "0.82",
        reason: "Synthetic fixture correction for provenance coverage.",
      },
    });
  });

  it("keeps the optional network port disabled without blocking file interoperability", async () => {
    const bridge = new DisabledAssayLensNetworkBridge();
    expect(bridge.mode).toBe("network-disabled");
    expect(() => bridge.importPackage(
      JSON.stringify(cycle10AssayLensObservationPackage),
      {
        importId: "file-still-works",
        plateId: "assay-cycle06-plate",
        unit: "relative-intensity",
        importedAt: "2026-07-26T12:02:00.000Z",
        sourceDescription: "Synthetic fixture.",
      },
    )).not.toThrow();
    await expect(bridge.send()).rejects.toThrow("network transport is disabled");
  });

  it("can accept every mapped row without changing malformed/unmapped rows", () => {
    const review = acceptAllMappedObservations(createObservationReview(mapLong()));
    expect(review.observations.every(({ reviewStatus }) => reviewStatus === "accepted")).toBe(true);
  });
});
