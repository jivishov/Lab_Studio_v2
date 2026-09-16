import { ArrowRight, FileUp, FlaskConical, Plus } from "lucide-react";
import { useState } from "react";
import type { AssayReleaseTemplateId } from "../domain-packs/assay/services";
import { AssayCapabilityExplorer } from "./release";
import "./assay.css";

export type AssayLibraryItem = {
  description: string;
  id: string;
  title: string;
  updatedAt: string;
  useBoundary: "education" | "research-planning";
  wellsConfigured: number;
};

export type AssayLibraryProps = {
  assays?: readonly AssayLibraryItem[];
  onCreate?: (templateId: AssayReleaseTemplateId) => void;
  onImport?: (file: File) => void;
  onOpen?: (assayId: string) => void;
};

const formatUseBoundary = (boundary: AssayLibraryItem["useBoundary"]) =>
  boundary === "education" ? "Education" : "Research planning";

export const AssayLibrary = ({
  assays = [],
  onCreate,
  onImport,
  onOpen,
}: AssayLibraryProps) => {
  const [templateId, setTemplateId] = useState<AssayReleaseTemplateId>("blank-96");
  return (
  <main className="assay-library">
    <header className="assay-library__hero">
      <div className="assay-library__hero-copy">
        <span className="assay-eyebrow">Assay Studio · bounded 96-well authoring</span>
        <h1>Design the plate before touching the bench.</h1>
        <p>
          Map samples, controls, conditions, and replicates on a canonical 96-well plate. This
          foundation supports planning and education; it does not make clinical decisions or
          control laboratory instruments.
        </p>
      </div>
      <div className="assay-library__actions">
        <label>
          Starting template
          <select
            onChange={(event) => setTemplateId(event.currentTarget.value as AssayReleaseTemplateId)}
            value={templateId}
          >
            <option value="blank-96">Blank 96-well layout</option>
            <option value="xtt-metabolic-activity">XTT metabolic-activity proxy</option>
            <option value="educational-broth-microdilution">Educational broth microdilution</option>
          </select>
        </label>
        <button className="assay-primary-action" onClick={() => onCreate?.(templateId)} type="button">
          <Plus aria-hidden="true" size={17} />
          New 96-well assay
        </button>
        <label className="file-button assay-file-button">
          <FileUp aria-hidden="true" size={17} />
          Import .assay.json
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
      </div>
      <div className="assay-library__boundary" role="note">
        <FlaskConical aria-hidden="true" size={18} />
        <p>
          <strong>Current release boundary</strong>
          Plate authoring, nominal pipetting/dilution rehearsal, explicit control/replicate
          assignment, source-controlled QC review, explicit operational planning, reviewed
          CSV/manual/Assay Lens file ingestion are available behind the build flag. Checked XTT
          metabolic-activity and educational broth-microdilution profiles are available as explicit
          synthetic examples. Six stateless assay MCP tools and validated release exports use the
          same pure services as this app. Remote Assay Lens transport remains unavailable.
        </p>
      </div>
    </header>

    <section className="assay-library__section" aria-labelledby="assay-library-title">
      <div className="assay-library__section-heading">
        <div>
          <span className="assay-eyebrow">Local assay artifacts</span>
          <h2 id="assay-library-title">Assay library</h2>
        </div>
        <span>{assays.length} saved</span>
      </div>

      {assays.length === 0 ? (
        <div className="assay-library__empty">
          <div aria-hidden="true" className="assay-library__empty-plate">
            {Array.from({ length: 24 }, (_, index) => (
              <i key={index} />
            ))}
          </div>
          <div>
            <h3>No assay definitions yet</h3>
            <p>
              Begin with a blank 96-well map or import a validated Assay Studio definition. Raw
              CSV and image observations are not accepted here.
            </p>
            <button onClick={() => onCreate?.(templateId)} type="button">
              Create the first plate map
              <ArrowRight aria-hidden="true" size={16} />
            </button>
          </div>
        </div>
      ) : (
        <div className="assay-library__grid">
          {assays.map((assay) => (
            <article className="assay-card" key={assay.id}>
              <div className="assay-card__plate" aria-hidden="true">
                {Array.from({ length: 24 }, (_, index) => (
                  <i className={index < Math.ceil(assay.wellsConfigured / 4) ? "is-filled" : ""} key={index} />
                ))}
              </div>
              <div className="assay-card__copy">
                <div>
                  <span>{formatUseBoundary(assay.useBoundary)}</span>
                  <span>{assay.wellsConfigured}/96 wells assigned</span>
                </div>
                <h3>{assay.title}</h3>
                <p>{assay.description}</p>
                <footer>
                  <small>Updated {assay.updatedAt}</small>
                  <button onClick={() => onOpen?.(assay.id)} type="button">
                    Open plate map
                    <ArrowRight aria-hidden="true" size={15} />
                  </button>
                </footer>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
    <AssayCapabilityExplorer />
  </main>
  );
};
