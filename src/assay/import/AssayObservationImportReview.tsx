import { Download, FileImage, FileSpreadsheet, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AssayDefinition } from "../../domain-packs/assay/types";
import {
  acceptAllMappedObservations,
  commitObservationReview,
  createImageAttachmentDescriptor,
  createManualObservationImport,
  createObservationReview,
  fileAssayLensBridge,
  mapAssayCsv,
  reviewObservation,
  validateCsvFileBoundary,
  validateStructuredFileBoundary,
  type AssayCsvFormat,
  type AssayDecimalSeparator,
  type AssayImageAttachmentDescriptor,
  type AssayLensObservationRequest,
  type AssayObservationImport,
  type AssayObservationReview,
  type AssayObservationSet,
} from "../../domain-packs/assay/ingestion";
import { downloadJson } from "../../studio/importExport";

export interface AssayObservationImportReviewProps {
  assay: AssayDefinition;
  onCommit?: (observationSet: AssayObservationSet) => void;
}

const now = (): string => new Date().toISOString();
const transientId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}`;

export const AssayObservationImportReview = ({
  assay,
  onCommit,
}: AssayObservationImportReviewProps) => {
  const [format, setFormat] = useState<AssayCsvFormat>("long");
  const [delimiter, setDelimiter] = useState<"," | ";" | "\t">(",");
  const [decimalSeparator, setDecimalSeparator] = useState<AssayDecimalSeparator>(".");
  const [unit, setUnit] = useState("AU");
  const [channel, setChannel] = useState("primary");
  const [csvText, setCsvText] = useState("Plate,Well,Signal,Unit,Channel\n");
  const [review, setReview] = useState<AssayObservationReview>();
  const [committedSet, setCommittedSet] = useState<AssayObservationSet>();
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [message, setMessage] = useState(
    "Choose an explicit mapping. Imported observations remain unreviewed.",
  );
  const [manual, setManual] = useState({
    coordinate: "A1",
    value: "",
    unit: "AU",
    channel: "primary",
    sourceType: "manual" as "manual" | "image-derived",
  });
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>();
  const [imageAttachment, setImageAttachment] = useState<AssayImageAttachmentDescriptor>();

  useEffect(() => () => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
  }, [imagePreviewUrl]);

  const summary = useMemo(() => {
    const observations = review?.observations ?? [];
    return {
      mapped: observations.length,
      accepted: observations.filter(({ reviewStatus }) => reviewStatus === "accepted").length,
      corrected: observations.filter(({ reviewStatus }) => reviewStatus === "corrected").length,
      rejected: observations.filter(({ reviewStatus }) => reviewStatus === "rejected").length,
      unreviewed: observations.filter(({ reviewStatus }) => reviewStatus === "unreviewed").length,
      unmapped: review?.importCandidate.rows.filter(({ status }) => status !== "mapped").length ?? 0,
    };
  }, [review]);

  const loadCandidate = (candidate: AssayObservationImport) => {
    const nextReview = createObservationReview(candidate);
    setReview(nextReview);
    setCorrections({});
    setMessage(
      `Mapped ${nextReview.observations.length} observations; review each value before commit.`,
    );
  };

  const mapCsv = () => {
    const importId = transientId("csv-import");
    const common = {
      delimiter,
      decimalSeparator,
      orientation: "A1-top-left" as const,
    };
    const candidate = mapAssayCsv(
      csvText,
      format === "long" ? {
        ...common,
        format: "long",
        plateIdColumn: "Plate",
        wellColumn: "Well",
        signalColumn: "Signal",
        unitColumn: "Unit",
        channelColumn: "Channel",
        defaultPlateId: assay.plate.id,
        defaultUnit: unit,
        defaultChannel: channel,
      } : {
        ...common,
        format: "matrix",
        plateId: assay.plate.id,
        unit,
        channel,
        rowLabelColumn: "Row",
      },
      {
        importId,
        sourceName: "Browser CSV import",
        sourceVersion: "1.0",
        createdAt: now(),
      },
    );
    loadCandidate(candidate);
  };

  const importCsvFile = async (file: File) => {
    const boundary = validateCsvFileBoundary(file.size, file.type);
    if (boundary.length > 0) {
      setMessage(boundary.map(({ message: detail }) => detail).join(" "));
      return;
    }
    setCsvText(await file.text());
    setMessage("CSV loaded into the mapping preview. Confirm mapping, then select Preview mapping.");
  };

  const decide = (
    observationId: string,
    decision: "accepted" | "rejected" | "corrected",
  ) => {
    if (!review) return;
    try {
      setReview(reviewObservation(
        review,
        observationId,
        decision,
        decision === "corrected" ? {
          acceptedValue: corrections[observationId],
          reason: "Explicit correction during Assay Studio import review.",
          actorRole: "assay-reviewer",
          occurredAt: now(),
        } : undefined,
      ));
      setMessage(`Observation ${observationId} marked ${decision}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update observation review.");
    }
  };

  const commit = () => {
    if (!review) return;
    const result = commitObservationReview(review, assay);
    if (!result.ok || !result.observationSet) {
      setMessage(result.diagnostics.map(({ message: detail }) => detail).join(" "));
      return;
    }
    onCommit?.(result.observationSet);
    setCommittedSet(result.observationSet);
    setMessage(
      `Committed ${result.observationSet.observations.length} explicitly reviewed observations. Rejected values remain provenance records and are excluded from QC.`,
    );
  };

  const addManual = () => {
    const candidate = createManualObservationImport({
      importId: transientId("manual-import"),
      plateId: assay.plate.id,
      coordinate: manual.coordinate,
      rawValue: manual.value,
      unit: manual.unit,
      channel: manual.channel,
      createdAt: now(),
      sourceType: manual.sourceType,
      ...(manual.sourceType === "image-derived" && imageAttachment
        ? { attachmentId: imageAttachment.attachmentId }
        : {}),
    });
    loadCandidate(candidate);
  };

  const chooseImage = (file: File) => {
    const descriptor = createImageAttachmentDescriptor(
      transientId("image-attachment"),
      file.size,
      file.type,
      "manual-review",
    );
    if (!descriptor.ok) {
      setMessage(descriptor.diagnostics.map(({ message: detail }) => detail).join(" "));
      return;
    }
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl(URL.createObjectURL(file));
    setImageAttachment(descriptor.value);
    setMessage(
      "Image is available only in this browser preview. No path, EXIF, pixels, or image-derived value has been added to the assay.",
    );
  };

  const exportLensRequest = () => {
    if (!imageAttachment) return;
    const request: AssayLensObservationRequest = {
      schema: "assay-lens.observation-request",
      schemaVersion: "1.0",
      requestId: transientId("assay-lens-request"),
      plate: {
        id: assay.plate.id,
        format: 96,
        orientation: "A1-top-left",
      },
      requestedChannels: [{ id: channel, unit }],
      attachments: [{ ...imageAttachment, purpose: "assay-lens-analysis" }],
      createdAt: now(),
      limitations: [
        "The image file is transferred separately; this JSON contains no path, EXIF, pixels, hash, or provider handle.",
        "Returned image-derived signals require explicit Assay Studio review and are not equivalent to plate-reader absorbance.",
      ],
    };
    downloadJson(
      `${request.requestId}.assay-lens-request.json`,
      fileAssayLensBridge.exportRequest(request),
    );
    setMessage("Exported the file-based Assay Lens request. Network transport remains disabled.");
  };

  const importLensResult = async (file: File) => {
    const boundary = validateStructuredFileBoundary(file.size, file.type);
    if (boundary.length > 0) {
      setMessage(boundary.map(({ message: detail }) => detail).join(" "));
      return;
    }
    try {
      loadCandidate(fileAssayLensBridge.importPackage(await file.text(), {
        importId: transientId("assay-lens-import"),
        plateId: assay.plate.id,
        channel,
        unit,
        importedAt: now(),
        sourceDescription: "Reviewed Assay Lens v1 file package imported through the disabled-network bridge.",
      }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to import Assay Lens result.");
    }
  };

  return (
    <section className="assay-observation-import">
      <header>
        <div>
          <span className="assay-eyebrow">Cycle 10 · reviewed external data</span>
          <h2>Observation import &amp; review</h2>
          <p>
            Map CSV, enter a value manually, or exchange a versioned file package with Assay Lens.
            Nothing enters QC until its review state is explicit.
          </p>
        </div>
        <span className="assay-import-status">
          <ShieldCheck aria-hidden="true" size={15} />
          {summary.unreviewed > 0 ? `${summary.unreviewed} need review` : "Review gate clear"}
        </span>
      </header>

      <div className="assay-import-boundary">
        Plate format <strong>96 wells</strong> · orientation <strong>A1 top-left</strong> ·
        no automatic column, unit, channel, decimal-separator, or image interpretation.
      </div>

      <div className="assay-import-methods">
        <fieldset>
          <legend><FileSpreadsheet aria-hidden="true" size={15} /> CSV mapping</legend>
          <label>
            Shape
            <select value={format} onChange={(event) => setFormat(event.target.value as AssayCsvFormat)}>
              <option value="long">Long · one observation per row</option>
              <option value="matrix">Matrix · rows A–H, columns 1–12</option>
            </select>
          </label>
          <label>
            Field delimiter
            <select value={delimiter} onChange={(event) => setDelimiter(event.target.value as "," | ";" | "\t")}>
              <option value=",">Comma</option>
              <option value=";">Semicolon</option>
              <option value={"\t"}>Tab</option>
            </select>
          </label>
          <label>
            Decimal separator
            <select value={decimalSeparator} onChange={(event) => setDecimalSeparator(event.target.value as AssayDecimalSeparator)}>
              <option value=".">Period</option>
              <option value=",">Comma</option>
            </select>
          </label>
          <label>
            Signal unit
            <input value={unit} onChange={(event) => setUnit(event.target.value)} />
          </label>
          <label>
            Channel
            <input value={channel} onChange={(event) => setChannel(event.target.value)} />
          </label>
          <label className="file-button assay-import-file">
            Load CSV
            <input
              accept=".csv,text/csv,application/csv,text/plain"
              aria-label="Load assay CSV"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void importCsvFile(file);
                event.currentTarget.value = "";
              }}
              type="file"
            />
          </label>
          <label className="assay-import-text">
            CSV source preview
            <textarea
              aria-label="CSV source preview"
              onChange={(event) => setCsvText(event.target.value)}
              rows={5}
              value={csvText}
            />
          </label>
          <p>
            {format === "long"
              ? "Expected headers: Plate, Well, Signal, Unit, Channel. Blank plate/unit/channel cells use the explicit defaults above."
              : "Expected headers: Row, 1, 2, …, 12 with rows A through H."}
          </p>
          <button onClick={mapCsv} type="button">Preview mapping</button>
        </fieldset>

        <fieldset>
          <legend>Manual scalar entry</legend>
          <label>
            Well
            <input value={manual.coordinate} onChange={(event) => setManual({ ...manual, coordinate: event.target.value })} />
          </label>
          <label>
            Value
            <input inputMode="decimal" value={manual.value} onChange={(event) => setManual({ ...manual, value: event.target.value })} />
          </label>
          <label>
            Unit
            <input value={manual.unit} onChange={(event) => setManual({ ...manual, unit: event.target.value })} />
          </label>
          <label>
            Channel
            <input value={manual.channel} onChange={(event) => setManual({ ...manual, channel: event.target.value })} />
          </label>
          <label className="assay-import-text">
            Entry source
            <select
              value={manual.sourceType}
              onChange={(event) => setManual({
                ...manual,
                sourceType: event.target.value as "manual" | "image-derived",
              })}
            >
              <option value="manual">Direct manual entry</option>
              <option value="image-derived">Manual extraction from selected image</option>
            </select>
          </label>
          <button onClick={addManual} type="button">Add to review queue</button>
        </fieldset>

        <fieldset>
          <legend><FileImage aria-hidden="true" size={15} /> Image review &amp; Assay Lens</legend>
          <label className="file-button assay-import-file">
            Choose local image
            <input
              accept="image/jpeg,image/png,image/webp"
              aria-label="Choose image for manual review"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) chooseImage(file);
                event.currentTarget.value = "";
              }}
              type="file"
            />
          </label>
          {imagePreviewUrl ? (
            <img alt="Transient local plate image for manual review" src={imagePreviewUrl} />
          ) : (
            <p>No image selected. Assay Studio performs no built-in computer vision.</p>
          )}
          <button disabled={!imageAttachment} onClick={exportLensRequest} type="button">
            <Download aria-hidden="true" size={14} />
            Export Assay Lens request
          </button>
          <label className="file-button assay-import-file">
            Import reviewed Assay Lens result
            <input
              accept=".assay-observation.json,application/json"
              aria-label="Import reviewed Assay Lens result"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void importLensResult(file);
                event.currentTarget.value = "";
              }}
              type="file"
            />
          </label>
          <p>
            File bridge only. Arbitrary URLs and remote transport are disabled. Image-derived
            intensity remains visibly labeled and is not assumed equivalent to absorbance.
          </p>
        </fieldset>
      </div>

      <div className="assay-import-message" role="status">{message}</div>

      {review && (
        <div className="assay-import-review">
          <div className="assay-import-review__summary">
            <strong>{summary.mapped} mapped</strong>
            <span>{summary.unmapped} unmapped/error</span>
            <span>{summary.accepted} accepted</span>
            <span>{summary.corrected} corrected</span>
            <span>{summary.rejected} rejected</span>
            {committedSet && <span>{committedSet.observations.length} committed this session</span>}
            <button onClick={() => setReview(acceptAllMappedObservations(review))} type="button">
              Accept all mapped
            </button>
            <button disabled={summary.unreviewed > 0} onClick={commit} type="button">
              Commit reviewed set
            </button>
          </div>
          <div className="assay-import-table-scroll">
            <table>
              <caption>Mapped observations and explicit review state</caption>
              <thead>
                <tr>
                  <th>Source row</th>
                  <th>Plate / well</th>
                  <th>Value</th>
                  <th>Source / method</th>
                  <th>Review</th>
                </tr>
              </thead>
              <tbody>
                {review.importCandidate.rows.map((row, index) => {
                  const observation = row.observation
                    ? review.observations.find(({ id }) => id === row.observation!.id)
                    : undefined;
                  return (
                    <tr key={`${row.rowNumber}:${index}`}>
                      <th scope="row">{row.rowNumber}</th>
                      <td>{observation ? `${observation.plateId} / ${observation.wellId.split(":").at(-1)}` : "Unmapped"}</td>
                      <td>
                        {observation ? `${observation.rawValue} ${observation.unit}` : "—"}
                        {observation?.confidence && <small>Confidence {observation.confidence}</small>}
                        {row.sourceNormalizedValue && (
                          <small>Source normalized value {row.sourceNormalizedValue}</small>
                        )}
                      </td>
                      <td>
                        {observation ? (
                          <>
                            <strong>{observation.sourceType}</strong>
                            <small>{observation.provenance.methodId}@{observation.provenance.methodVersion}</small>
                            {row.sourceFlags && row.sourceFlags.length > 0 && (
                              <small>Flags: {row.sourceFlags.join(", ")}</small>
                            )}
                            {row.sourceCorrection && (
                              <small>
                                Upstream correction: {row.sourceCorrection.previousValue ?? "not supplied"}
                                {" → "}{row.sourceCorrection.acceptedValue}
                              </small>
                            )}
                          </>
                        ) : row.diagnostics.map(({ message: detail }) => detail).join(" ")}
                      </td>
                      <td>
                        {observation ? (
                          <div className="assay-import-review-actions">
                            <strong>{observation.reviewStatus}</strong>
                            <button onClick={() => decide(observation.id, "accepted")} type="button">Accept</button>
                            <button onClick={() => decide(observation.id, "rejected")} type="button">Reject</button>
                            <label>
                              Corrected value
                              <input
                                aria-label={`Corrected value for ${observation.wellId}`}
                                inputMode="decimal"
                                onChange={(event) => setCorrections({
                                  ...corrections,
                                  [observation.id]: event.target.value,
                                })}
                                value={corrections[observation.id] ?? ""}
                              />
                            </label>
                            <button onClick={() => decide(observation.id, "corrected")} type="button">Apply correction</button>
                          </div>
                        ) : "Resolve mapping errors before commit"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};
