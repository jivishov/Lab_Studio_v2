import type { LabDefinition } from "../domain/types";
import { StudentPlayer } from "../player/StudentPlayer";
import type { StudioReadiness } from "./studioReadiness";

interface PreviewPanelProps {
  draft?: LabDefinition;
  isStale?: boolean;
  readiness: StudioReadiness;
  selectedNodeId?: string;
  selectedNodeFocusVersion?: number;
  variant?: "split" | "stage";
}

export const PreviewPanel = ({
  draft,
  isStale = false,
  readiness,
  selectedNodeFocusVersion = 0,
  selectedNodeId,
  variant = "stage",
}: PreviewPanelProps) => {
  return (
    <section className={`preview-panel is-${variant}-preview`}>
      {isStale ? (
        <div className="preview-stale-banner" role="status">
          Showing the last runnable preview while the current draft is {readiness.label.toLowerCase()}.
        </div>
      ) : null}
      {!draft ? (
        <>
          <div className="panel-heading">
            <h2>Live preview</h2>
            <span>No runnable preview yet. Complete the current draft's setup.</span>
          </div>
          <ul className="validation-errors">
            {readiness.diagnostics.map((diagnostic) => (
              <li key={diagnostic.id}>{diagnostic.message}</li>
            ))}
          </ul>
        </>
      ) : (
        <StudentPlayer
          definition={draft}
          chrome="preview"
          compact
          focusNodeId={selectedNodeId}
          focusVersion={selectedNodeFocusVersion}
        />
      )}
    </section>
  );
};
