import type { FourFingerScrollAxis, FourFingerScrollSignal, GestureCursor } from "./gestureMath";

export type GestureScrollDirection = "up" | "down" | "left" | "right";
export type GestureScrollKind =
  | "document"
  | "equipmentRow"
  | "process"
  | "scrollRegion"
  | "shelf"
  | "status"
  | "studioPreview"
  | "workbench";

export interface GestureScrollTarget {
  axis: FourFingerScrollAxis;
  key: string;
  kind: GestureScrollKind;
  target: Element;
}

export interface GestureScrollIntent {
  className: string;
  deltaX: number;
  deltaY: number;
  direction: GestureScrollDirection;
  key: string;
  kind: GestureScrollKind;
  strength: number;
  target: Element;
}

interface GestureScrollResolverInput {
  cursor?: GestureCursor;
  dialogOpen?: boolean;
  documentRef?: Document;
  pinching?: boolean;
  root?: ParentNode | null;
  viewportHeight?: number;
  viewportWidth?: number;
}

interface GestureScrollTargetResolverInput extends GestureScrollResolverInput {
  axis?: FourFingerScrollAxis;
}

interface GestureScrollIntentFromSignalInput {
  signal: FourFingerScrollSignal;
  target: GestureScrollTarget;
}

const panelEdgeSize = 72;
const viewportEdgeSize = 88;
const minScrollDelta = 2;
const maxScrollDelta = 12;
const minWaveScrollDelta = 2;
const maxWaveScrollDelta = 34;
const waveScrollMultiplier = 1.1;

export const gestureScrollDwellMs = 300;
export const gestureScrollReleasePauseMs = 300;

export const gestureScrollClassNames = [
  "is-gesture-scrolling-up",
  "is-gesture-scrolling-down",
  "is-gesture-scrolling-left",
  "is-gesture-scrolling-right",
] as const;

export const gestureScrollClassForDirection = (direction: GestureScrollDirection): string =>
  `is-gesture-scrolling-${direction}`;

const isElement = (value: Element | null | undefined): value is Element => Boolean(value);

const containsPoint = (rect: DOMRect, cursor: GestureCursor): boolean =>
  cursor.clientX >= rect.left &&
  cursor.clientX <= rect.right &&
  cursor.clientY >= rect.top &&
  cursor.clientY <= rect.bottom;

const firstElementAtCursor = (
  root: ParentNode,
  selector: string,
  cursor: GestureCursor,
): Element | undefined =>
  Array.from(root.querySelectorAll(selector)).find((element) =>
    containsPoint(element.getBoundingClientRect(), cursor),
  );

const smallestElementAtCursor = (
  root: ParentNode,
  selector: string,
  cursor: GestureCursor,
): Element | undefined =>
  Array.from(root.querySelectorAll(selector))
    .filter((element) => containsPoint(element.getBoundingClientRect(), cursor))
    .sort((a, b) => {
      const first = a.getBoundingClientRect();
      const second = b.getBoundingClientRect();
      return first.width * first.height - second.width * second.height;
    })[0];

const clampScroll = (value: number, max: number): number => Math.min(Math.max(value, 0), Math.max(0, max));

const scrollRange = (target: Element, axis: "horizontal" | "vertical"): number =>
  axis === "horizontal"
    ? Math.max(0, target.scrollWidth - target.clientWidth)
    : Math.max(0, target.scrollHeight - target.clientHeight);

const canScroll = (
  target: Element,
  axis: "horizontal" | "vertical",
  direction: GestureScrollDirection,
): boolean => {
  const max = scrollRange(target, axis);
  if (max <= 1) return false;
  const current = axis === "horizontal" ? target.scrollLeft : target.scrollTop;
  if (direction === "left" || direction === "up") return current > 1;
  return current < max - 1;
};

const deltaForStrength = (strength: number): number =>
  Math.round(minScrollDelta + (maxScrollDelta - minScrollDelta) * Math.min(1, Math.max(0, strength)));

const clampWaveDelta = (delta: number): number => {
  const scaled = delta * waveScrollMultiplier;
  if (Math.abs(scaled) < minWaveScrollDelta) return 0;
  return Math.sign(scaled) * Math.min(maxWaveScrollDelta, Math.abs(scaled));
};

const directionForAxisDelta = (
  axis: FourFingerScrollAxis,
  delta: number,
): GestureScrollDirection | undefined => {
  if (delta === 0) return undefined;
  if (axis === "horizontal") return delta < 0 ? "left" : "right";
  return delta < 0 ? "up" : "down";
};

const resolveEdge = (
  position: number,
  start: number,
  end: number,
  edgeSize: number,
  beforeDirection: GestureScrollDirection,
  afterDirection: GestureScrollDirection,
):
  | {
      direction: GestureScrollDirection;
      strength: number;
    }
  | undefined => {
  const beforeDistance = position - start;
  if (beforeDistance >= 0 && beforeDistance <= edgeSize) {
    return {
      direction: beforeDirection,
      strength: 1 - beforeDistance / edgeSize,
    };
  }
  const afterDistance = end - position;
  if (afterDistance >= 0 && afterDistance <= edgeSize) {
    return {
      direction: afterDirection,
      strength: 1 - afterDistance / edgeSize,
    };
  }
  return undefined;
};

const visibleAxisBounds = (
  start: number,
  end: number,
  viewportSize: number,
): { end: number; start: number } | undefined => {
  if (!Number.isFinite(viewportSize) || viewportSize <= 0) return { end, start };
  const visibleStart = Math.max(start, 0);
  const visibleEnd = Math.min(end, viewportSize);
  return visibleEnd > visibleStart ? { end: visibleEnd, start: visibleStart } : undefined;
};

const horizontalIntentForElement = (
  kind: GestureScrollKind,
  target: Element,
  cursor: GestureCursor,
  viewportWidth: number,
): GestureScrollIntent | undefined => {
  const rect = target.getBoundingClientRect();
  const visibleBounds = visibleAxisBounds(rect.left, rect.right, viewportWidth);
  if (!visibleBounds) return undefined;
  const edge = resolveEdge(
    cursor.clientX,
    visibleBounds.start,
    visibleBounds.end,
    panelEdgeSize,
    "left",
    "right",
  );
  if (!edge || !canScroll(target, "horizontal", edge.direction)) return undefined;
  const delta = deltaForStrength(edge.strength) * (edge.direction === "left" ? -1 : 1);
  return {
    className: gestureScrollClassForDirection(edge.direction),
    deltaX: delta,
    deltaY: 0,
    direction: edge.direction,
    key: `${kind}:${edge.direction}`,
    kind,
    strength: edge.strength,
    target,
  };
};

const verticalIntentForElement = (
  kind: GestureScrollKind,
  target: Element,
  cursor: GestureCursor,
  viewportHeight: number,
): GestureScrollIntent | undefined => {
  const rect = target.getBoundingClientRect();
  const visibleBounds = visibleAxisBounds(rect.top, rect.bottom, viewportHeight);
  if (!visibleBounds) return undefined;
  const edge = resolveEdge(
    cursor.clientY,
    visibleBounds.start,
    visibleBounds.end,
    panelEdgeSize,
    "up",
    "down",
  );
  if (!edge || !canScroll(target, "vertical", edge.direction)) return undefined;
  const delta = deltaForStrength(edge.strength) * (edge.direction === "up" ? -1 : 1);
  return {
    className: gestureScrollClassForDirection(edge.direction),
    deltaX: 0,
    deltaY: delta,
    direction: edge.direction,
    key: `${kind}:${edge.direction}`,
    kind,
    strength: edge.strength,
    target,
  };
};

const edgeIntentForExplicitElement = (
  element: Element,
  cursor: GestureCursor,
  viewportHeight: number,
  viewportWidth: number,
): GestureScrollIntent | undefined => {
  const declared = element.getAttribute("data-gesture-scroll-region");
  const kind = kindForExplicitScrollRegion(element);
  const intents = [
    declared === "horizontal" || declared === "both"
      ? horizontalIntentForElement(kind, element, cursor, viewportWidth)
      : undefined,
    declared === "vertical" || declared === "both"
      ? verticalIntentForElement(kind, element, cursor, viewportHeight)
      : undefined,
  ].filter((intent): intent is GestureScrollIntent => Boolean(intent));
  return intents.sort((first, second) => second.strength - first.strength)[0];
};

const kindForExplicitScrollRegion = (element: Element): GestureScrollKind => {
  const role = element.getAttribute("data-gesture-scroll-kind");
  if (
    role === "equipmentRow" ||
    role === "process" ||
    role === "shelf" ||
    role === "status" ||
    role === "studioPreview" ||
    role === "workbench"
  ) {
    return role;
  }
  return "scrollRegion";
};

const axisAllowedForElement = (element: Element, requested: FourFingerScrollAxis): FourFingerScrollAxis[] => {
  const declared = element.getAttribute("data-gesture-scroll-region");
  if (declared === "vertical") return requested === "vertical" ? ["vertical"] : [];
  if (declared === "horizontal") return requested === "horizontal" ? ["horizontal"] : [];
  if (declared === "both") return [requested, requested === "vertical" ? "horizontal" : "vertical"];
  return [requested];
};

const elementTargetForAxis = (
  kind: GestureScrollKind,
  target: Element,
  axis: FourFingerScrollAxis,
): GestureScrollTarget | undefined => {
  const directions: GestureScrollDirection[] = axis === "horizontal" ? ["left", "right"] : ["up", "down"];
  if (!directions.some((direction) => canScroll(target, axis, direction))) return undefined;
  return {
    axis,
    key: `${kind}:${axis}`,
    kind,
    target,
  };
};

const explicitTargetAtCursor = (
  root: ParentNode,
  cursor: GestureCursor,
  requestedAxis: FourFingerScrollAxis,
): GestureScrollTarget | undefined => {
  const element = smallestElementAtCursor(root, "[data-gesture-scroll-region]", cursor);
  if (!element) return undefined;
  const kind = kindForExplicitScrollRegion(element);
  for (const axis of axisAllowedForElement(element, requestedAxis)) {
    const target = elementTargetForAxis(kind, element, axis);
    if (target) return target;
  }
  return undefined;
};

const targetAtCursor = (
  root: ParentNode,
  selector: string,
  kind: GestureScrollKind,
  axis: FourFingerScrollAxis,
  cursor: GestureCursor,
): GestureScrollTarget | undefined => {
  const element = smallestElementAtCursor(root, selector, cursor);
  return element ? elementTargetForAxis(kind, element, axis) : undefined;
};

export const resolveGestureScrollTarget = ({
  axis = "vertical",
  cursor,
  dialogOpen = false,
  documentRef = document,
  pinching = false,
  root,
}: GestureScrollTargetResolverInput): GestureScrollTarget | undefined => {
  if (!cursor || cursor.pinching || pinching || dialogOpen) return undefined;
  const rootNode = root ?? documentRef;
  const explicit = explicitTargetAtCursor(rootNode, cursor, axis);
  if (explicit) return explicit;

  const candidates = [
    targetAtCursor(rootNode, ".equipment-shelf-scroll", "shelf", axis, cursor),
    targetAtCursor(rootNode, ".equipment-row", "equipmentRow", axis, cursor),
    targetAtCursor(rootNode, ".process-sidebar", "process", axis, cursor),
    targetAtCursor(rootNode, ".status-panels", "status", axis, cursor),
    targetAtCursor(rootNode, ".workbench", "workbench", axis, cursor),
    targetAtCursor(rootNode, ".studio-pane", "studioPreview", axis, cursor),
    targetAtCursor(rootNode, ".player-grid.is-preview-layout", "studioPreview", axis, cursor),
  ].filter((target): target is GestureScrollTarget => Boolean(target));
  if (candidates.length) return candidates[0];

  const scrollElement = documentRef.scrollingElement ?? documentRef.documentElement;
  if (!isElement(scrollElement)) return undefined;
  return elementTargetForAxis("document", scrollElement, axis);
};

export const gestureScrollIntentFromSignal = ({
  signal,
  target,
}: GestureScrollIntentFromSignalInput): GestureScrollIntent | undefined => {
  const rawDelta = target.axis === "horizontal" ? signal.deltaX : signal.deltaY;
  const delta = clampWaveDelta(rawDelta);
  const direction = directionForAxisDelta(target.axis, delta);
  if (!direction || !canScroll(target.target, target.axis, direction)) return undefined;
  return {
    className: gestureScrollClassForDirection(direction),
    deltaX: target.axis === "horizontal" ? delta : 0,
    deltaY: target.axis === "vertical" ? delta : 0,
    direction,
    key: `${target.key}:${direction}`,
    kind: target.kind,
    strength: signal.strength,
    target: target.target,
  };
};

export const resolveGestureScrollIntent = ({
  cursor,
  dialogOpen = false,
  documentRef = document,
  pinching = false,
  root,
  viewportHeight = documentRef.defaultView?.innerHeight ?? 0,
  viewportWidth = documentRef.defaultView?.innerWidth ?? 0,
}: GestureScrollResolverInput): GestureScrollIntent | undefined => {
  if (!cursor || cursor.pinching || pinching || dialogOpen) return undefined;
  const rootNode = root ?? documentRef;

  const workbench = firstElementAtCursor(
    rootNode,
    '.bench-viewport[data-gesture-scroll-region="both"]',
    cursor,
  );
  if (workbench) {
    const intent = edgeIntentForExplicitElement(
      workbench,
      cursor,
      viewportHeight,
      viewportWidth,
    );
    if (intent) return intent;
  }

  const legacyWorkbench = firstElementAtCursor(rootNode, ".workbench", cursor);
  if (legacyWorkbench) {
    const intent = horizontalIntentForElement(
      "workbench",
      legacyWorkbench,
      cursor,
      viewportWidth,
    );
    if (intent) return intent;
  }

  const shelf = firstElementAtCursor(rootNode, ".equipment-shelf-scroll", cursor);
  if (shelf) {
    const intent = verticalIntentForElement("shelf", shelf, cursor, viewportHeight);
    if (intent) return intent;
  }

  const scrollElement = documentRef.scrollingElement ?? documentRef.documentElement;
  if (!isElement(scrollElement) || viewportHeight <= 0) return undefined;
  const edge = resolveEdge(cursor.clientY, 0, viewportHeight, viewportEdgeSize, "up", "down");
  if (!edge || !canScroll(scrollElement, "vertical", edge.direction)) return undefined;
  const delta = deltaForStrength(edge.strength) * (edge.direction === "up" ? -1 : 1);
  return {
    className: gestureScrollClassForDirection(edge.direction),
    deltaX: 0,
    deltaY: delta,
    direction: edge.direction,
    key: `document:${edge.direction}`,
    kind: "document",
    strength: edge.strength,
    target: scrollElement,
  };
};

export const applyGestureScrollIntent = (intent: GestureScrollIntent): boolean => {
  const previousLeft = intent.target.scrollLeft;
  const previousTop = intent.target.scrollTop;
  if (intent.deltaX !== 0) {
    intent.target.scrollLeft = clampScroll(
      intent.target.scrollLeft + intent.deltaX,
      scrollRange(intent.target, "horizontal"),
    );
  }
  if (intent.deltaY !== 0) {
    intent.target.scrollTop = clampScroll(
      intent.target.scrollTop + intent.deltaY,
      scrollRange(intent.target, "vertical"),
    );
  }
  return previousLeft !== intent.target.scrollLeft || previousTop !== intent.target.scrollTop;
};
