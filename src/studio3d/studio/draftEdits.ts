import type { LabDefinition } from "../../domain/types";
import { markCompositionDetached } from "../../studio/studioTransactions";
import type { Studio3DController } from "./useStudio3DDraft";

/**
 * Edits the Studio has no dedicated operation for, made the way the original Studio makes them:
 * a wholesale `replaceDraft` from its draft updater (`TeacherStudio.commitDraftUpdater`). A
 * `replaceDraft` detaches a compiled manifest only when the nodes change, so these mark the
 * edited graph detached themselves (handoff §4.4, detached state).
 */
export const removeConnection = (studio: Studio3DController, index: number): boolean => {
  const { draft } = studio;
  const edge = draft.process.edges[index];
  if (!edge) return false;
  const titleOf = (id: string) => draft.process.nodes.find((n) => n.id === id)?.title ?? id;
  const next: LabDefinition = markCompositionDetached({
    ...draft,
    process: { ...draft.process, edges: draft.process.edges.filter((_, i) => i !== index) },
  });
  return studio.commit(`Delete connection: ${titleOf(edge.from)} → ${titleOf(edge.to)}`, [{ type: "replaceDraft", draft: next }], { selection: undefined }).ok;
};
