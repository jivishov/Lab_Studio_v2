import { useRef, useState } from "react";
import type { LabDefinition } from "../../domain/types";
import { equipmentById } from "../../equipment/catalog";
import { isRunnableReadiness } from "../../studio/studioReadiness";
import { collectStudioEquipmentIds } from "../../studio/studioValidation";
import { equipment3dReadiness } from "../equipment3d/readiness";
import { Player3D } from "../player/Player3D";
import type { Player3DController } from "../player/usePlayer3D";
import { Icon } from "../ui/Icon";
import type { Studio3DController } from "./useStudio3DDraft";

/**
 * Stage: Preview (handoff §4.6): Player3D runs the draft in preview chrome, starting at the
 * selected step (`focusNodeId` / `focusVersion`). Preview runs are never saved. A draft that is
 * not runnable, or not 3D-ready, says so and links to the original Studio's 2D preview.
 */

/** StudentPlayer's preview-notice rule (a copy: the 2D helper is private to StudentPlayer.tsx). */
export const hasIncompleteInboundStep = (process: LabDefinition["process"], nodeId: string, completedNodes: string[]): boolean => {
  const completed = new Set(completedNodes);
  return process.edges.some((edge) => edge.to === nodeId && edge.condition.type !== "retry" && !completed.has(edge.from));
};

export const PreviewView = ({ studio, lastRunnable, focusNodeId, focusVersion, onFocus, expanded, onExpand }: {
  studio: Studio3DController;
  /** The last runnable draft, shown while the current one is not runnable (2D PreviewPanel parity). */
  lastRunnable?: LabDefinition;
  focusNodeId?: string;
  focusVersion: number;
  onFocus: (nodeId: string) => void;
  expanded: boolean;
  onExpand: (expanded: boolean) => void;
}) => {
  const { readiness } = studio;
  const runnable = isRunnableReadiness(readiness);
  const draft = runnable ? studio.draft : lastRunnable;
  const stale = !runnable && Boolean(lastRunnable);
  // The controller is a new object on every render, so it is kept in a ref; the toolbar re-renders
  // only when the step, the mode or the progress changes.
  const playerRef = useRef<Player3DController | undefined>(undefined);
  const keyRef = useRef("");
  const [, setTick] = useState(0);
  const player = playerRef.current;
  const onPlayer = (p: Player3DController) => {
    playerRef.current = p;
    const key = `${p.runtime.currentNode.id}|${p.showGuidance}|${p.runtime.state.completedNodes.length}`;
    if (key !== keyRef.current) { keyRef.current = key; setTick((t) => t + 1); }
  };
  const models = equipment3dReadiness(draft ? collectStudioEquipmentIds(draft) : []);
  if (!draft) {
    return (
      <div className="s3d-stage-empty">
        <div className="s3d-glass-card">
          <div className="s3d-eyebrow">Preview</div>
          <p><b>No runnable preview yet.</b> Complete the draft's setup first.</p>
          <ul className="s3d-errors">{readiness.diagnostics.filter((d) => d.severity === "fail").slice(0, 6).map((d) => <li key={d.id}>{d.message}</li>)}</ul>
        </div>
      </div>
    );
  }
  if (!models.ready) {
    return (
      <div className="s3d-stage-empty">
        <div className="s3d-glass-card">
          <div className="s3d-eyebrow">Preview</div>
          <p><b>Not yet in 3D.</b> Missing models: {models.missing.map((id) => equipmentById.get(id)?.label ?? id).join(", ")}.</p>
          <a className="s3d-button s3d-button--primary" href="#/studio">Preview in the original Studio (2D)</a>
        </div>
      </div>
    );
  }
  const nodes = draft.process.nodes;
  const currentId = player?.runtime.currentNode.id;
  const index = Math.max(0, nodes.findIndex((n) => n.id === currentId));
  const notice = player && hasIncompleteInboundStep(draft.process, player.runtime.currentNode.id, player.runtime.state.completedNodes)
    ? "Preview uses current bench state; complete prior steps to supply this source."
    : undefined;
  return (
    <div className="s3d-preview">
      {stale ? <div className="s3d-preview__notice s3d-preview__notice--stale" role="status"><Icon name="warn" />Showing the last runnable preview while the current draft is {readiness.label.toLowerCase()}.</div> : null}
      <Player3D definition={draft} title={draft.title} sourceTag="PREVIEW" fallbackHash="#/studio" backHref="#/3d/studio"
        variant="preview" focusNodeId={focusNodeId} focusVersion={focusVersion} onPlayer={onPlayer} />
      {notice ? <div className="s3d-preview__notice" role="status"><Icon name="info" />{notice}</div> : null}
      <div className="s3d-tbar s3d-tbar--stage s3d-tbar--preview" role="toolbar" aria-label="Preview tools">
        <button type="button" onClick={() => player?.restart()}><Icon name="reset" />Restart</button>
        <i />
        <button type="button" className={player?.showGuidance ? "is-on" : ""} aria-pressed={Boolean(player?.showGuidance)} onClick={() => player?.runtime.setMode("guided")}>Guided</button>
        <button type="button" className={player && !player.showGuidance ? "is-on" : ""} aria-pressed={Boolean(player && !player.showGuidance)} onClick={() => player?.runtime.setMode("assessment")}>Assessment</button>
        <i />
        <button type="button" aria-label="Previous step" disabled={index <= 0} onClick={() => onFocus(nodes[index - 1].id)}>◂</button>
        <span className="s3d-tbar__text">Step {index + 1} of {nodes.length}</span>
        <button type="button" aria-label="Next step" disabled={index >= nodes.length - 1} onClick={() => onFocus(nodes[index + 1].id)}>▸</button>
        <i />
        <button type="button" onClick={() => onExpand(!expanded)}><Icon name="expand" />{expanded ? "Back to the Studio" : "Open full player"}</button>
      </div>
    </div>
  );
};
