/**
 * Technique packs (plan §1, §9; decision Q4, provisional until confirmed): catalogue order from
 * `public/techniques/index.json`, in packs of five. `tools/blender/inventory_pack.ts` uses the same
 * constant, so the pack a badge names is the pack the inventory evaluated.
 */
export const PACK_SIZE = 5;

/** The pack a technique belongs to, or undefined when it is not in the catalogue. */
export const packNumber = (catalogueIds: readonly string[], techniqueId: string): number | undefined => {
  const index = catalogueIds.indexOf(techniqueId);
  return index < 0 ? undefined : Math.floor(index / PACK_SIZE) + 1;
};
