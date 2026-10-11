import type { AttachmentRelation, RuntimeState } from "../../domain/types";

/**
 * Each child's own relation, one per child (2026-10-11). On every action the runtime merges into its attachments a
 * relation derived from the child's snap zone (`withResolvedAttachments`), naming the first instance of the zone's
 * parent definition, even for a child that already holds an explicit relation. With two chambers, the 2-propanol
 * strip was also listed in the water chamber while its own chamber was closed and opened, and drawn there. The
 * explicit relations come first, so the first relation listed for a child is its own.
 */
export const heldRelations = (state: Pick<RuntimeState, "attachments">): AttachmentRelation[] => {
  const seen = new Set<string>();
  return state.attachments.filter((relation) => !seen.has(relation.childInstanceId) && Boolean(seen.add(relation.childInstanceId)));
};
