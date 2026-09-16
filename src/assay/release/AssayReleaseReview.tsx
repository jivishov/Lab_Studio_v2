import { CheckCircle2, Download, ShieldAlert } from "lucide-react";
import { useMemo } from "react";
import type { AssayDefinition } from "../../domain-packs/assay/types";
import {
  applyAssayCandidateTransaction,
  compareAssayArtifacts,
  createAssayReleaseReport,
} from "../../domain-packs/assay/services";

export interface AssayReleaseReviewProps {
  assay: AssayDefinition;
  candidate?: AssayDefinition;
  onApplyCandidate?: (artifact: AssayDefinition) => void;
}

const downloadFile = (file: { fileName: string; mediaType: string; contents: string }) => {
  const url = URL.createObjectURL(new Blob([file.contents], { type: file.mediaType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const AssayReleaseReview = ({
  assay,
  candidate,
  onApplyCandidate,
}: AssayReleaseReviewProps) => {
  const report = useMemo(() => createAssayReleaseReport(assay, {
    packageId: `${assay.id}:direct-app-release-review`,
    createdAt: assay.metadata.updatedAt,
  }), [assay]);
  const comparison = useMemo(
    () => candidate ? compareAssayArtifacts(assay, candidate) : undefined,
    [assay, candidate],
  );

  const applyCandidate = () => {
    if (!candidate) return;
    const result = applyAssayCandidateTransaction({
      current: assay,
      candidate,
      expectedCurrentVersion: assay.metadata.version,
    });
    if (result.ok) onApplyCandidate?.(result.artifact);
  };

  return (
    <section aria-labelledby="assay-release-review-title" className="assay-panel assay-release-review">
      <div className="assay-panel__heading">
        <div>
          <span className="assay-eyebrow">Validate · compare · export</span>
          <h2 id="assay-release-review-title">Release review</h2>
        </div>
        <span className={report.validation.ok ? "assay-status is-ready" : "assay-status is-blocked"}>
          {report.validation.ok
            ? <CheckCircle2 aria-hidden="true" size={16} />
            : <ShieldAlert aria-hidden="true" size={16} />}
          {report.validation.ok ? "Valid 96-well artifact" : "Blocked"}
        </span>
      </div>

      <p>
        The release gate is limited: artifact, schema, output-boundary, and accessibility contracts
        are available, while detailed browser, conformance, and formative-review execution remains
        intentionally unrun under repository policy.
      </p>

      {report.validation.diagnostics.length > 0 && (
        <div aria-live="polite" className="assay-release-review__diagnostics">
          <h3>Validation diagnostics</h3>
          <ul>
            {report.validation.diagnostics.map((diagnostic) => (
              <li key={`${diagnostic.code}:${diagnostic.path}`}>
                <strong>{diagnostic.code}</strong> — {diagnostic.path}: {diagnostic.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {comparison && (
        <div className="assay-release-review__compare">
          <h3>Imported candidate comparison</h3>
          <p>
            {comparison.compatible
              ? `${comparison.changedSections.length} sections and ${comparison.changedWells.length} wells differ.`
              : "The candidate cannot be applied until blocking diagnostics are resolved."}
          </p>
          <table>
            <caption>Semantic comparison before apply</caption>
            <thead>
              <tr>
                <th scope="col">Area</th>
                <th scope="col">Changes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Sections</th>
                <td>{comparison.changedSections.join(", ") || "None"}</td>
              </tr>
              <tr>
                <th scope="row">Wells</th>
                <td>{comparison.changedWells.join(", ") || "None"}</td>
              </tr>
            </tbody>
          </table>
          <button disabled={!comparison.compatible || !onApplyCandidate} onClick={applyCandidate} type="button">
            Apply validated candidate
          </button>
        </div>
      )}

      <div className="assay-release-review__downloads">
        <h3>Downloadable review artifacts</h3>
        <p>All files are generated from the same validated artifact used by the direct app and MCP.</p>
        <div>
          {report.downloadableFiles.map((file) => (
            <button key={file.fileName} onClick={() => downloadFile(file)} type="button">
              <Download aria-hidden="true" size={15} />
              {file.fileName}
            </button>
          ))}
        </div>
      </div>

      <details>
        <summary>Scientific and operational limits</summary>
        <ul>
          {report.boundaries.map((boundary) => <li key={boundary}>{boundary}</li>)}
        </ul>
      </details>
    </section>
  );
};
