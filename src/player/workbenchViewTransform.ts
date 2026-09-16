export const workbenchZoomStorageKey = "lab-studio:v1:workbench-zoom";
export const minimumWorkbenchZoomPercent = 60;
export const maximumWorkbenchZoomPercent = 160;
export const workbenchZoomStepPercent = 10;
export const fallbackWorkbenchSize = { width: 760, height: 520 } as const;
export const workbenchSceneSafetyInset = 24;

export interface WorkbenchPoint {
  x: number;
  y: number;
}

export interface WorkbenchSize {
  width: number;
  height: number;
}

export interface WorkbenchBounds extends WorkbenchPoint, WorkbenchSize {}

export type WorkbenchZoomPreference = "fit" | number;

export interface WorkbenchViewTransform {
  logicalHeight: number;
  logicalWidth: number;
  offsetX: number;
  offsetY: number;
  zoom: number;
  zoomPercent: number;
}

export interface WorkbenchScrollSnapshot {
  clientHeight: number;
  clientWidth: number;
  scrollLeft: number;
  scrollTop: number;
}

export const defaultWorkbenchViewTransform: WorkbenchViewTransform = {
  logicalHeight: fallbackWorkbenchSize.height,
  logicalWidth: fallbackWorkbenchSize.width,
  offsetX: 0,
  offsetY: 0,
  zoom: 1,
  zoomPercent: 100,
};

const finitePositive = (value: number, fallback: number): number =>
  Number.isFinite(value) && value > 0 ? value : fallback;

export const clampWorkbenchZoomPercent = (value: number): number =>
  Math.min(maximumWorkbenchZoomPercent, Math.max(minimumWorkbenchZoomPercent, value));

export const parseWorkbenchZoomPreference = (
  value: string | null | undefined,
): WorkbenchZoomPreference => {
  if (value === "fit") return "fit";
  if (value === null || value === undefined || value.trim() === "") return 100;
  const numeric = Number(value);
  if (
    !Number.isInteger(numeric) ||
    numeric < minimumWorkbenchZoomPercent ||
    numeric > maximumWorkbenchZoomPercent ||
    numeric % workbenchZoomStepPercent !== 0
  ) {
    return 100;
  }
  return numeric;
};

export const readWorkbenchZoomPreference = (
  storage?: Pick<Storage, "getItem">,
): WorkbenchZoomPreference => {
  try {
    const availableStorage = storage ?? (typeof window === "undefined" ? undefined : window.localStorage);
    return availableStorage
      ? parseWorkbenchZoomPreference(availableStorage.getItem(workbenchZoomStorageKey))
      : 100;
  } catch {
    return 100;
  }
};

export const writeWorkbenchZoomPreference = (
  preference: WorkbenchZoomPreference,
  storage?: Pick<Storage, "setItem">,
): void => {
  try {
    const availableStorage = storage ?? (typeof window === "undefined" ? undefined : window.localStorage);
    availableStorage?.setItem(workbenchZoomStorageKey, String(preference));
  } catch {
    // A private or quota-limited storage context must not disable the workbench.
  }
};

export const resolveWorkbenchLogicalSize = (
  viewport: WorkbenchSize,
  occupiedBounds: WorkbenchBounds[],
  fallback: WorkbenchSize = fallbackWorkbenchSize,
  safetyInset = workbenchSceneSafetyInset,
): WorkbenchSize => {
  const viewportWidth = finitePositive(viewport.width, fallback.width);
  const viewportHeight = finitePositive(viewport.height, fallback.height);
  const occupiedWidth = occupiedBounds.reduce(
    (maximum, bounds) => Math.max(maximum, bounds.x + bounds.width + safetyInset),
    0,
  );
  const occupiedHeight = occupiedBounds.reduce(
    (maximum, bounds) => Math.max(maximum, bounds.y + bounds.height + safetyInset),
    0,
  );
  return {
    height: Math.max(fallback.height, viewportHeight, occupiedHeight),
    width: Math.max(fallback.width, viewportWidth, occupiedWidth),
  };
};

export const fitWorkbenchZoomPercent = (
  viewport: WorkbenchSize,
  logical: WorkbenchSize,
): number => {
  const logicalWidth = finitePositive(logical.width, fallbackWorkbenchSize.width);
  const logicalHeight = finitePositive(logical.height, fallbackWorkbenchSize.height);
  const viewportWidth = finitePositive(viewport.width, logicalWidth);
  const viewportHeight = finitePositive(viewport.height, logicalHeight);
  return clampWorkbenchZoomPercent(
    Math.min(viewportWidth / logicalWidth, viewportHeight / logicalHeight) * 100,
  );
};

export const resolveEffectiveWorkbenchZoomPercent = (
  preference: WorkbenchZoomPreference,
  viewport: WorkbenchSize,
  logical: WorkbenchSize,
): number =>
  preference === "fit"
    ? fitWorkbenchZoomPercent(viewport, logical)
    : clampWorkbenchZoomPercent(preference);

export const createWorkbenchViewTransform = (
  logical: WorkbenchSize,
  viewport: WorkbenchSize,
  zoomPercent: number,
): WorkbenchViewTransform => {
  const safePercent = clampWorkbenchZoomPercent(zoomPercent);
  const zoom = safePercent / 100;
  const logicalWidth = finitePositive(logical.width, fallbackWorkbenchSize.width);
  const logicalHeight = finitePositive(logical.height, fallbackWorkbenchSize.height);
  const scaledWidth = logicalWidth * zoom;
  const scaledHeight = logicalHeight * zoom;
  return {
    logicalHeight,
    logicalWidth,
    offsetX: Math.max(0, (finitePositive(viewport.width, scaledWidth) - scaledWidth) / 2),
    offsetY: Math.max(0, (finitePositive(viewport.height, scaledHeight) - scaledHeight) / 2),
    zoom,
    zoomPercent: safePercent,
  };
};

export const clientPointToWorkbench = (
  point: WorkbenchPoint,
  sceneRect: Pick<DOMRect, "left" | "top">,
  zoom: number,
): WorkbenchPoint => {
  const safeZoom = finitePositive(zoom, 1);
  return {
    x: (point.x - sceneRect.left) / safeZoom,
    y: (point.y - sceneRect.top) / safeZoom,
  };
};

export const workbenchPointToClient = (
  point: WorkbenchPoint,
  sceneRect: Pick<DOMRect, "left" | "top">,
  zoom: number,
): WorkbenchPoint => ({
  x: sceneRect.left + point.x * finitePositive(zoom, 1),
  y: sceneRect.top + point.y * finitePositive(zoom, 1),
});

export const scaleWorkbenchPreviewSize = (
  size: WorkbenchSize,
  zoom: number,
): WorkbenchSize => {
  const safeZoom = finitePositive(zoom, 1);
  return {
    height: size.height * safeZoom,
    width: size.width * safeZoom,
  };
};

export const logicalPointAtViewportCenter = (
  viewport: WorkbenchScrollSnapshot,
  transform: WorkbenchViewTransform,
): WorkbenchPoint => ({
  x:
    (viewport.scrollLeft + viewport.clientWidth / 2 - transform.offsetX) /
    finitePositive(transform.zoom, 1),
  y:
    (viewport.scrollTop + viewport.clientHeight / 2 - transform.offsetY) /
    finitePositive(transform.zoom, 1),
});

export const scrollPositionForLogicalCenter = (
  center: WorkbenchPoint,
  viewport: Pick<WorkbenchScrollSnapshot, "clientHeight" | "clientWidth">,
  transform: WorkbenchViewTransform,
): WorkbenchPoint => ({
  x: Math.max(
    0,
    transform.offsetX + center.x * transform.zoom - viewport.clientWidth / 2,
  ),
  y: Math.max(
    0,
    transform.offsetY + center.y * transform.zoom - viewport.clientHeight / 2,
  ),
});

export const nearestNumericWorkbenchZoom = (
  effectivePercent: number,
  direction: -1 | 1,
): number => {
  const stepped =
    direction > 0
      ? Math.ceil(effectivePercent / workbenchZoomStepPercent) * workbenchZoomStepPercent
      : Math.floor(effectivePercent / workbenchZoomStepPercent) * workbenchZoomStepPercent;
  const alreadyOnStep = Math.abs(stepped - effectivePercent) < 0.001;
  const next = alreadyOnStep ? stepped + direction * workbenchZoomStepPercent : stepped;
  return clampWorkbenchZoomPercent(next);
};
