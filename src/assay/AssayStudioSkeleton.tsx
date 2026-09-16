import { ArrowLeft, CheckCircle2, Download, FileUp, FlaskConical } from "lucide-react";
import { useState } from "react";
import type { AssayRuntimeState } from "../domain-packs/assay/runtime";
import type { SerialDilutionPlan } from "../domain-packs/assay/dilution";
import type { AssayDefinition, PlateDefinition } from "../domain-packs/assay/types";
import { AssayPlateEditor } from "./AssayPlateEditor";
import { AssayControlReplicateEditor } from "./controls";
import { AssayObservationImportReview } from "./import";
import { AssayDilutionPlanSummary, AssayPipettingRehearsal } from "./player";
import { AssayRunPlanner } from "./planning";
import { AssayReleaseReview } from "./release";
import "./assay.css";

export type AssayStudioSkeletonProps = {
  assayTitle?: string;
  initialAssay: AssayDefinition;
  initialRuntimeState: AssayRuntimeState;
  dilutionPlan: SerialDilutionPlan;
  onBack?: () => void;
  onExport?: (assay: AssayDefinition) => void;
  onImport?: (file: File) => void;
  onAssayChange?: (assay: AssayDefinition) => void;
  onOpenResults?: () => void;
  candidateAssay?: AssayDefinition;
  onCandidateApplied?: () => void;
};

export const AssayStudioSkeleton = ({
  assayTitle = "Untitled 96-well assay",
  initialAssay,
  initialRuntimeState,
  dilutionPlan,
  onBack,
  onExport,
  onImport,
  onAssayChange,
  onOpenResults,
  candidateAssay,
  onCandidateApplied,
}: AssayStudioSkeletonProps) => {
  const [assay, setAssay] = useState(initialAssay);

  const updatePlate = (nextPlate: PlateDefinition) => {
    const nextAssay = { ...assay, plate: nextPlate };
    setAssay(nextAssay);
    onAssayChange?.(nextAssay);
  };

  const updateAssay = (nextAssay: AssayDefinition) => {
    setAssay(nextAssay);
    onAssayChange?.(nextAssay);
  };

  const scrollToStep = (stepId: string) => {
    document.getElementById(stepId)?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  };

  return (
    <main className="assay-studio-shell">
      <header className="assay-studio-header">
        <button aria-label="Back to assay library" onClick={onBack} type="button">
          <ArrowLeft aria-hidden="true" size={17} />
        </button>
        <div className="assay-studio-header__title">
          <span className="assay-eyebrow">Assay Studio</span>
          <h1>{assayTitle}</h1>
        </div>
        <span className="assay-draft-state">
          <CheckCircle2 aria-hidden="true" size={15} />
          Session draft
        </span>
        <div className="assay-studio-header__actions">
          <label className="file-button assay-file-button">
            <FileUp aria-hidden="true" size={16} />
            Import
            <input
              accept=".assay.json,application/json"
              aria-label="Import assay definition"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) onImport?.(file);
                event.currentTarget.value = "";
              }}
              type="file"
            />
          </label>
          <button disabled={!onExport} onClick={() => onExport?.(assay)} type="button">
            <Download aria-hidden="true" size={16} />
            Export .assay.json
          </button>
          <button disabled={!onOpenResults} onClick={onOpenResults} type="button">
            Review QC
          </button>
        </div>
      </header>

      <div className="assay-studio-body">
        <nav aria-label="Assay authoring steps" className="assay-studio-rail">
          <div className="assay-studio-rail__brand" aria-hidden="true">
            <FlaskConical size={21} />
          </div>
          <ol>
            <li className="is-active" aria-current="step">
              <button onClick={() => scrollToStep("assay-plate-map")} type="button">
                <span>01</span>
                <div>
                  <strong>Plate map</strong>
                  <small>Available</small>
                </div>
              </button>
            </li>
            <li>
              <button onClick={() => scrollToStep("assay-pipetting-plan")} type="button">
                <span>02</span>
                <div>
                  <strong>Pipetting plan</strong>
                  <small>Rehearsal available</small>
                </div>
              </button>
            </li>
            <li>
              <button onClick={() => scrollToStep("assay-controls-qc")} type="button">
                <span>03</span>
                <div>
                  <strong>Controls &amp; QC</strong>
                  <small>Explicit fixture available</small>
                </div>
              </button>
            </li>
            <li>
              <button onClick={() => scrollToStep("assay-materials-schedule")} type="button">
                <span>04</span>
                <div>
                  <strong>Materials &amp; schedule</strong>
                  <small>Explicit plan available</small>
                </div>
              </button>
            </li>
            <li>
              <button onClick={() => scrollToStep("assay-import-observations")} type="button">
                <span>05</span>
                <div>
                  <strong>Import observations</strong>
                  <small>Reviewed CSV / file bridge</small>
                </div>
              </button>
            </li>
            <li>
              <button onClick={() => scrollToStep("assay-release-review")} type="button">
                <span>06</span>
                <div>
                  <strong>Review results</strong>
                  <small>Validate and export</small>
                </div>
              </button>
            </li>
          </ol>
          <p>
            This editor assigns explicit metadata only. It does not infer controls, replicate
            membership, quantities, or biological meaning.
          </p>
        </nav>

        <div className="assay-studio-main">
          <div className="assay-studio-step" id="assay-plate-map">
            <AssayPlateEditor onPlateChange={updatePlate} plate={assay.plate} />
          </div>
          <div className="assay-studio-step" id="assay-controls-qc">
            <AssayControlReplicateEditor assay={assay} onChange={updateAssay} />
          </div>
          <div className="assay-studio-step" id="assay-pipetting-plan">
            <AssayPipettingRehearsal initialState={initialRuntimeState} />
            <AssayDilutionPlanSummary plan={dilutionPlan} />
          </div>
          <div className="assay-studio-step" id="assay-materials-schedule">
            <AssayRunPlanner />
          </div>
          <div className="assay-studio-step" id="assay-import-observations">
            <AssayObservationImportReview assay={assay} />
          </div>
          <div className="assay-studio-step" id="assay-release-review">
            <AssayReleaseReview
              assay={assay}
              candidate={candidateAssay}
              onApplyCandidate={(nextAssay) => {
                updateAssay(nextAssay);
                onCandidateApplied?.();
              }}
            />
          </div>
        </div>
      </div>
    </main>
  );
};
