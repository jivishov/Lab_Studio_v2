import type { SceneItem } from "./runtimeToScene";

/**
 * Which drawn item guidance points at (the beacon, Show me and auto-framing; guided only, G-7). The instance a step
 * names when it is drawn (two strips, two chambers), else the first of its kind. A bench item comes before the
 * shelf's, so an item still on the shelf is marked only while none of its kind is out on the bench (the shelf in
 * place of the tray, decided 2026-10-11).
 */
export const guideItemId = (
  present: { bench: readonly SceneItem[]; tray: readonly SceneItem[] },
  definitionId: string | undefined,
  instanceId?: string,
  exclude?: string,
): string | undefined => {
  const all = [...present.bench, ...present.tray];
  if (instanceId && instanceId !== exclude && all.some((item) => item.instanceId === instanceId)) return instanceId;
  return definitionId ? all.find((item) => item.definitionId === definitionId && item.instanceId !== exclude)?.instanceId : undefined;
};
