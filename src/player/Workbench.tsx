import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import { isVisibleWorkbenchLocation } from "../domain/equipmentLocations";
import type { ActionInteractionSpec, EquipmentInstance, RuntimeState } from "../domain/types";
import { equipmentById } from "../equipment/catalog";
import { getBenchSize, getVisualProfile, type ProbePresentation } from "../equipment/visualCatalog";
import { resolveBenchOverlap, type BenchBounds, type BenchOverlapResult } from "./benchOverlap";
import {
  benchBoundsForInteractionSource,
  benchOccupiedBoundsFromNodes,
  benchTargetBoundsForInteraction,
  benchTargetBoundsForNode,
  snapPointAligningSourceAnchor,
} from "./benchTargeting";
import { EquipmentView } from "./EquipmentView";
import {
  PhProbeArt,
  PhProbeLead,
  PhProbeUnderLiquidAccessory,
  type ProbePoint,
} from "./PhProbePresentation";
import {
  renderLayersForNode,
  resolveWorkbenchScene,
  type RenderLayer,
  type RenderNode,
} from "./resolveWorkbenchScene";
import {
  clampWorkbenchZoomPercent,
  clientPointToWorkbench,
  createWorkbenchViewTransform,
  fallbackWorkbenchSize,
  logicalPointAtViewportCenter,
  maximumWorkbenchZoomPercent,
  minimumWorkbenchZoomPercent,
  nearestNumericWorkbenchZoom,
  readWorkbenchZoomPreference,
  resolveEffectiveWorkbenchZoomPercent,
  resolveWorkbenchLogicalSize,
  scrollPositionForLogicalCenter,
  workbenchZoomStepPercent,
  writeWorkbenchZoomPreference,
  type WorkbenchSize,
  type WorkbenchViewTransform,
  type WorkbenchZoomPreference,
} from "./workbenchViewTransform";

interface BenchPoint {
  x: number;
  y: number;
}

interface WorkbenchProps {
  state: Pick<RuntimeState, "equipmentInstances" | "attachments">;
  expectedInteraction?: ActionInteractionSpec;
  gestureDrag?: {
    kind?: "equipment" | "attachedChild" | "probe";
    instanceId: string;
    point?: BenchPoint;
  };
  goblinMode?: {
    actionId?: string;
    enabled: boolean;
    interactionType?: ActionInteractionSpec["type"];
  };
  selectedSource?: string;
  selectedTarget?: string;
  showGuidance?: boolean;
  onDropEquipment: (definitionId: string, zone: string, point: BenchPoint) => void;
  onInvalidOverlap: (sourceInstanceId: string, targetInstanceId: string) => void;
  onDragToZone: (sourceInstanceId: string, stationId: string) => boolean;
  onMoveInstance: (instanceId: string, point: BenchPoint) => void;
  onDispenseDrop: () => boolean;
  onObjectInteraction: (
    sourceInstanceId: string,
    targetInstanceId: string,
    point: BenchPoint,
  ) => boolean;
  onSelectSource: (instanceId: string) => void;
  onSelectTarget: (instanceId: string) => void;
  onViewTransformChange?: (transform: WorkbenchViewTransform) => void;
}

const fallbackSurfaceWidth = fallbackWorkbenchSize.width;
const fallbackSurfaceHeight = fallbackWorkbenchSize.height;
const dragStartThreshold = 5;
const workbenchZoomMediaQuery = "(min-width: 721px)";

interface DragState {
  kind?: "equipment" | "probe";
  id: string;
  definitionId: string;
  node: RenderNode;
  label: string;
  offsetX: number;
  offsetY: number;
  point: BenchPoint;
  width: number;
  height: number;
  startClientX: number;
  startClientY: number;
  hasMoved: boolean;
}

interface SurfaceLimits {
  maxX: number;
  maxY: number;
}

const defaultPosition = (index: number): BenchPoint => ({
  x: 34 + (index % 5) * 148,
  y: 86 + Math.floor(index / 5) * 160,
});

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), Math.max(min, max));

const surfaceLimits = (
  logicalSize: { width: number; height: number },
  size: { width: number; height: number } = { width: 128, height: 128 },
): SurfaceLimits => {
  const width = logicalSize.width > 0 ? logicalSize.width : fallbackSurfaceWidth;
  const height = logicalSize.height > 0 ? logicalSize.height : fallbackSurfaceHeight;
  return {
    maxX: Math.max(8, width - size.width),
    maxY: Math.max(8, height - size.height),
  };
};

const clampPoint = (point: BenchPoint, limits: SurfaceLimits): BenchPoint => ({
  x: clamp(point.x, 8, limits.maxX),
  y: clamp(point.y, 8, limits.maxY),
});

const overlapRatio = (
  point: BenchPoint,
  size: { width: number; height: number },
  occupied: BenchBounds,
): number => {
  const left = Math.max(point.x, occupied.x);
  const right = Math.min(point.x + size.width, occupied.x + occupied.width);
  const top = Math.max(point.y, occupied.y);
  const bottom = Math.min(point.y + size.height, occupied.y + occupied.height);
  return (Math.max(0, right - left) * Math.max(0, bottom - top)) / (size.width * size.height);
};

const boundsFromPoint = (
  point: BenchPoint,
  size: { width: number; height: number },
): Pick<BenchBounds, "x" | "y" | "width" | "height"> => ({
  x: point.x,
  y: point.y,
  width: size.width,
  height: size.height,
});

const boundsCenter = (bounds: Pick<BenchBounds, "x" | "y" | "width" | "height">): BenchPoint => ({
  x: bounds.x + bounds.width / 2,
  y: bounds.y + bounds.height / 2,
});

const containsPoint = (
  bounds: Pick<BenchBounds, "x" | "y" | "width" | "height">,
  point: BenchPoint,
): boolean =>
  point.x > bounds.x &&
  point.x < bounds.x + bounds.width &&
  point.y > bounds.y &&
  point.y < bounds.y + bounds.height;

const parkingConflictScore = (
  point: BenchPoint,
  occupied: BenchBounds[],
  size: { width: number; height: number },
): number => {
  const candidate = boundsFromPoint(point, size);
  const candidateCenter = boundsCenter(candidate);
  return occupied.reduce((score, bounds) => {
    const ratio = overlapRatio(point, size, bounds);
    const coversOccupiedCenter = containsPoint(candidate, boundsCenter(bounds));
    const centerInsideOccupied = containsPoint(bounds, candidateCenter);
    return score + ratio + (coversOccupiedCenter ? 2 : 0) + (centerInsideOccupied ? 1 : 0);
  }, 0);
};

const isClearParkingSpot = (
  point: BenchPoint,
  occupied: BenchBounds[],
  size: { width: number; height: number },
): boolean => {
  const candidate = boundsFromPoint(point, size);
  const candidateCenter = boundsCenter(candidate);
  return occupied.every((bounds) => {
    if (overlapRatio(point, size, bounds) >= 0.05) return false;
    return !containsPoint(candidate, boundsCenter(bounds)) && !containsPoint(bounds, candidateCenter);
  });
};

const distanceSquared = (a: BenchPoint, b: BenchPoint): number =>
  (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

const parkAfterInteraction = (
  point: BenchPoint,
  occupied: BenchBounds[],
  limits: SurfaceLimits,
  size: { width: number; height: number },
): BenchPoint => {
  const seen = new Set<string>();
  const candidates: BenchPoint[] = [];
  const addCandidate = (candidate: BenchPoint) => {
    const clamped = clampPoint(candidate, limits);
    const key = `${Math.round(clamped.x)}:${Math.round(clamped.y)}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(clamped);
  };
  const offsets = [
    { x: -136, y: 264 },
    { x: 0, y: 264 },
    { x: 136, y: 264 },
    { x: 264, y: 132 },
    { x: -264, y: 132 },
    { x: 264, y: 264 },
    { x: -264, y: 264 },
    { x: 0, y: -180 },
    { x: 84, y: 156 },
    { x: 156, y: 42 },
    { x: -132, y: 42 },
  ];
  for (const offset of offsets) {
    addCandidate({ x: point.x + offset.x, y: point.y + offset.y });
  }

  const strideX = Math.max(28, Math.min(72, size.width * 0.5));
  const strideY = Math.max(28, Math.min(72, size.height * 0.5));
  for (let y = 8; y <= limits.maxY; y += strideY) {
    for (let x = 8; x <= limits.maxX; x += strideX) {
      addCandidate({ x, y });
    }
    addCandidate({ x: limits.maxX, y });
  }
  for (let x = 8; x <= limits.maxX; x += strideX) {
    addCandidate({ x, y: limits.maxY });
  }
  addCandidate({ x: limits.maxX, y: limits.maxY });

  const clearCandidate = candidates
    .filter((candidate) => isClearParkingSpot(candidate, occupied, size))
    .sort((a, b) => distanceSquared(a, point) - distanceSquared(b, point))[0];
  if (clearCandidate) return clearCandidate;

  return candidates
    .slice()
    .sort((a, b) => {
      const conflictDelta =
        parkingConflictScore(a, occupied, size) - parkingConflictScore(b, occupied, size);
      if (Math.abs(conflictDelta) > 0.001) return conflictDelta;
      return distanceSquared(a, point) - distanceSquared(b, point);
    })[0] ?? clampPoint({ x: point.x - 136, y: point.y + 264 }, limits);
};

const probeProxyLayer = (
  sourceLayer: RenderLayer,
  presentation: ProbePresentation,
): RenderLayer => ({
  ...sourceLayer,
  id: `${sourceLayer.id}-probe-proxy`,
  x: 0,
  y: 0,
  width: presentation.probeSize.width,
  height: presentation.probeSize.height,
});

const probeProxyNode = (
  node: RenderNode,
  sourceLayer: RenderLayer,
  presentation: ProbePresentation,
): RenderNode => {
  const layer = probeProxyLayer(sourceLayer, presentation);
  return {
    ...node,
    id: `${sourceLayer.instanceId}-probe-drag`,
    layers: [layer],
    bounds: { x: 0, y: 0, width: layer.width, height: layer.height },
    footprint: { x: 0, y: 0, width: layer.width, height: layer.height },
    hitBox: { x: 0, y: 0, width: layer.width, height: layer.height },
  };
};

const pointForProbeSource = (
  meterPoint: BenchPoint,
  layer: RenderLayer,
  presentation: ProbePresentation,
): BenchPoint => ({
  x:
    meterPoint.x +
    layer.x +
    layer.width * presentation.sourceGripAnchor.x -
    presentation.probeSize.width * presentation.probeLeadPort.x,
  y:
    meterPoint.y +
    layer.y +
    layer.height * presentation.sourceGripAnchor.y -
    presentation.probeSize.height * presentation.probeLeadPort.y,
});

export const Workbench = ({
  expectedInteraction,
  gestureDrag,
  goblinMode,
  state,
  onDropEquipment,
  onInvalidOverlap,
  onDragToZone,
  onMoveInstance,
  onDispenseDrop,
  onObjectInteraction,
  onSelectSource,
  onSelectTarget,
  onViewTransformChange,
  selectedSource,
  selectedTarget,
  showGuidance = true,
}: WorkbenchProps) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<DragState | undefined>(undefined);
  const draggingPointRef = useRef<BenchPoint | undefined>(undefined);
  const previousViewTransformRef = useRef<WorkbenchViewTransform | undefined>(undefined);
  const [dragging, setDragging] = useState<DragState>();
  const [dropPulse, setDropPulse] = useState(0);
  const [viewportSize, setViewportSize] = useState<WorkbenchSize>(() => ({
    ...fallbackWorkbenchSize,
  }));
  const [zoomEnabled, setZoomEnabled] = useState(() =>
    typeof window === "undefined" || typeof window.matchMedia !== "function"
      ? true
      : window.matchMedia(workbenchZoomMediaQuery).matches,
  );
  const [zoomPreference, setZoomPreference] = useState<WorkbenchZoomPreference>(() =>
    readWorkbenchZoomPreference(),
  );
  const placed = state.equipmentInstances.filter((instance) =>
    isVisibleWorkbenchLocation(instance.location),
  );
  const renderNodes = useMemo(() => resolveWorkbenchScene(state), [state]);
  const placedPositions = useMemo(
    () =>
      new Map(
        renderNodes.map((node) => [node.primaryInstanceId, { x: node.transform.x, y: node.transform.y }]),
      ),
    [renderNodes],
  );
  const logicalSize = useMemo(
    () =>
      resolveWorkbenchLogicalSize(
        viewportSize,
        renderNodes.map((node) => ({
          height: node.bounds.height,
          width: node.bounds.width,
          x: node.transform.x + node.bounds.x,
          y: node.transform.y + node.bounds.y,
        })),
      ),
    [renderNodes, viewportSize],
  );
  const effectiveZoomPercent = zoomEnabled
    ? resolveEffectiveWorkbenchZoomPercent(zoomPreference, viewportSize, logicalSize)
    : 100;
  const viewTransform = useMemo(
    () => createWorkbenchViewTransform(logicalSize, viewportSize, effectiveZoomPercent),
    [effectiveZoomPercent, logicalSize, viewportSize],
  );
  const scaledSceneSize = {
    height: logicalSize.height * viewTransform.zoom,
    width: logicalSize.width * viewTransform.zoom,
  };
  const zoomLocked = Boolean(dragging || gestureDrag);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const measure = () => {
      const width = viewport.clientWidth;
      const height = viewport.clientHeight;
      if (width <= 0 || height <= 0) return;
      setViewportSize((current) =>
        current.width === width && current.height === height ? current : { width, height },
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    writeWorkbenchZoomPreference(zoomPreference);
  }, [zoomPreference]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(workbenchZoomMediaQuery);
    const update = () => setZoomEnabled(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const previous = previousViewTransformRef.current;
    if (viewport && previous) {
      const center = logicalPointAtViewportCenter(
        {
          clientHeight: viewport.clientHeight,
          clientWidth: viewport.clientWidth,
          scrollLeft: viewport.scrollLeft,
          scrollTop: viewport.scrollTop,
        },
        previous,
      );
      const nextScroll = scrollPositionForLogicalCenter(
        center,
        { clientHeight: viewport.clientHeight, clientWidth: viewport.clientWidth },
        viewTransform,
      );
      viewport.scrollLeft = nextScroll.x;
      viewport.scrollTop = nextScroll.y;
    }
    previousViewTransformRef.current = viewTransform;
    onViewTransformChange?.(viewTransform);
  }, [onViewTransformChange, viewTransform]);

  const changeNumericZoom = (direction: -1 | 1) => {
    if (zoomLocked) return;
    setZoomPreference((current) =>
      current === "fit"
        ? nearestNumericWorkbenchZoom(effectiveZoomPercent, direction)
        : clampWorkbenchZoomPercent(current + direction * workbenchZoomStepPercent),
    );
  };

  const toggleFit = () => {
    if (zoomLocked) return;
    setZoomPreference((current) =>
      current === "fit"
        ? clampWorkbenchZoomPercent(
            Math.round(effectiveZoomPercent / workbenchZoomStepPercent) * workbenchZoomStepPercent,
          )
        : "fit",
    );
  };

  const localPointFromClient = (clientX: number, clientY: number): BenchPoint => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return { x: 0, y: 0 };
    }
    const point = clientPointToWorkbench(
      { x: clientX, y: clientY },
      rect,
      viewTransform.zoom,
    );
    return {
      x: clamp(point.x, 0, logicalSize.width),
      y: clamp(point.y, 0, logicalSize.height),
    };
  };

  const pointFromClient = (clientX: number, clientY: number): BenchPoint =>
    clampPoint(localPointFromClient(clientX, clientY), surfaceLimits(logicalSize));

  const handleDrop = (event: DragEvent<HTMLElement>, zone: string) => {
    event.preventDefault();
    const definitionId = event.dataTransfer.getData("application/x-lab-equipment");
    if (definitionId) onDropEquipment(definitionId, zone, pointFromClient(event.clientX, event.clientY));
  };

  const startMove = (
    event: PointerEvent<HTMLElement>,
    node: RenderNode,
    draggedLayer = node.layers.find((layer) => layer.instanceId === node.primaryInstanceId),
    startPoint?: BenchPoint,
    kind: DragState["kind"] = "equipment",
  ) => {
    if (!draggedLayer) return;
    const nodePosition = placedPositions.get(node.primaryInstanceId) ?? defaultPosition(0);
    const draggingAttachedChild = draggedLayer.instanceId !== node.primaryInstanceId;
    const current = startPoint ?? (draggingAttachedChild
      ? { x: nodePosition.x + draggedLayer.x, y: nodePosition.y + draggedLayer.y }
      : nodePosition);
    const draggedNode: RenderNode = draggingAttachedChild
      ? {
          id: `${draggedLayer.instanceId}-drag`,
          representedInstanceIds: [draggedLayer.instanceId],
          primaryInstanceId: draggedLayer.instanceId,
          layers: [{ ...draggedLayer, x: 0, y: 0 }],
          transform: { x: current.x, y: current.y, zIndex: draggedLayer.zIndex },
          bounds: { x: 0, y: 0, width: draggedLayer.width, height: draggedLayer.height },
          footprint: { x: 0, y: 0, width: draggedLayer.width, height: draggedLayer.height },
          hitBox: { x: 0, y: 0, width: draggedLayer.width, height: draggedLayer.height },
          accessibleLabel:
            state.equipmentInstances.find((instance) => instance.id === draggedLayer.instanceId)?.label ??
            node.accessibleLabel,
          selectionTargetId: draggedLayer.instanceId,
        }
      : node;
    const point = localPointFromClient(event.clientX, event.clientY);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    draggingPointRef.current = current;
    const nextDragging = {
      kind,
      definitionId: draggedLayer.definitionId,
      id: draggedLayer.instanceId,
      label: draggedNode.accessibleLabel,
      node: draggedNode,
      offsetX: point.x - current.x,
      offsetY: point.y - current.y,
      point: current,
      width: draggedNode.bounds.width,
      height: draggedNode.bounds.height,
      startClientX: event.clientX,
      startClientY: event.clientY,
      hasMoved: false,
    };
    draggingRef.current = nextDragging;
    setDragging(nextDragging);
  };

  const continueMove = (event: PointerEvent<HTMLElement>) => {
    const activeDragging = draggingRef.current;
    if (!activeDragging) return;
    const point = localPointFromClient(event.clientX, event.clientY);
    const hasMoved =
      activeDragging.hasMoved ||
      Math.hypot(event.clientX - activeDragging.startClientX, event.clientY - activeDragging.startClientY) >=
        dragStartThreshold;
    const nextPoint = hasMoved
      ? clampPoint(
          {
            x: point.x - activeDragging.offsetX,
            y: point.y - activeDragging.offsetY,
          },
          surfaceLimits(logicalSize, activeDragging),
        )
      : activeDragging.point;
    draggingPointRef.current = nextPoint;
    const nextDragging = {
      ...activeDragging,
      point: nextPoint,
      hasMoved,
    };
    draggingRef.current = nextDragging;
    setDragging(nextDragging);
  };

  const snapPointForTarget = (target: BenchBounds, draggedDefinitionId: string): BenchPoint => {
    if (expectedInteraction?.type !== "snapIntoTarget") return { x: target.x, y: target.y };
    if (!expectedInteraction.snapZoneId) {
      return clampPoint({ x: target.x, y: target.y }, surfaceLimits(logicalSize));
    }
    const point = snapPointAligningSourceAnchor(
      target,
      draggedDefinitionId,
      expectedInteraction.snapZoneId,
    );
    if (!point) {
      return clampPoint({ x: target.x, y: target.y }, surfaceLimits(logicalSize));
    }
    const draggedSize = getBenchSize(draggedDefinitionId);
    return clampPoint(point, surfaceLimits(logicalSize, draggedSize));
  };

  const overlapForDragging = (
    currentDragging: NonNullable<typeof dragging>,
  ): BenchOverlapResult => {
    const targetBounds = renderNodes
      .filter((node) => !node.representedInstanceIds.includes(currentDragging.id))
      .flatMap((node) =>
        benchTargetBoundsForNode(
          node,
          placedPositions.get(node.primaryInstanceId) ?? node.transform,
          state.equipmentInstances,
        ),
      )
      .map((bounds) => benchTargetBoundsForInteraction(bounds, expectedInteraction));
    return resolveBenchOverlap(
      benchBoundsForInteractionSource(
        currentDragging.node,
        currentDragging.point,
        state.equipmentInstances,
        expectedInteraction,
      ),
      targetBounds,
      expectedInteraction,
    );
  };

  const overlapForGestureDrag = (): BenchOverlapResult | undefined => {
    if (!gestureDrag?.point) return undefined;
    const sourceNode = renderNodes.find(
      (node) =>
        node.primaryInstanceId === gestureDrag.instanceId ||
        node.representedInstanceIds.includes(gestureDrag.instanceId),
    );
    if (!sourceNode) return undefined;
    const sourceLayer = sourceNode.layers.find((layer) => layer.instanceId === gestureDrag.instanceId);
    const presentation = sourceLayer ? getVisualProfile(sourceLayer.definitionId)?.probePresentation : undefined;
    const draggedNode =
      gestureDrag.kind === "probe" && sourceLayer && presentation
        ? probeProxyNode(sourceNode, sourceLayer, presentation)
        : gestureDrag.kind === "attachedChild" && sourceLayer
          ? {
              ...sourceNode,
              id: `${sourceLayer.instanceId}-attached-child-gesture`,
              representedInstanceIds: [sourceLayer.instanceId],
              primaryInstanceId: sourceLayer.instanceId,
              layers: [{ ...sourceLayer, x: 0, y: 0 }],
              bounds: { x: 0, y: 0, width: sourceLayer.width, height: sourceLayer.height },
              footprint: { x: 0, y: 0, width: sourceLayer.width, height: sourceLayer.height },
              hitBox: { x: 0, y: 0, width: sourceLayer.width, height: sourceLayer.height },
            }
          : sourceNode;

    const targetBounds = renderNodes
      .filter((node) => node.primaryInstanceId !== sourceNode.primaryInstanceId)
      .flatMap((node) =>
        benchTargetBoundsForNode(
          node,
          placedPositions.get(node.primaryInstanceId) ?? node.transform,
          state.equipmentInstances,
        ),
      )
      .map((bounds) => benchTargetBoundsForInteraction(bounds, expectedInteraction));

    return resolveBenchOverlap(
      benchBoundsForInteractionSource(
        draggedNode,
        gestureDrag.point,
        state.equipmentInstances,
        expectedInteraction,
      ),
      targetBounds,
      expectedInteraction,
    );
  };

  const pointIsInsideStation = (clientX: number, clientY: number, stationId: string): boolean => {
    const selector = stationId === "shelf" ? ".equipment-shelf" : `[data-station-id="${stationId}"]`;
    const station = document.querySelector<HTMLElement>(selector);
    const rect = station?.getBoundingClientRect();
    return Boolean(
      rect &&
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom,
    );
  };

  const finishMove = (event?: PointerEvent<HTMLElement>) => {
    const activeDragging = draggingRef.current;
    if (!activeDragging) return;
    if (!activeDragging.hasMoved) {
      draggingRef.current = undefined;
      draggingPointRef.current = undefined;
      setDragging(undefined);
      return;
    }
    const finalDragging = {
      ...activeDragging,
      point: draggingPointRef.current ?? activeDragging.point,
    };
    const expectedDragToZone =
      expectedInteraction?.type === "dragToZone" &&
      expectedInteraction.sourceDefinitionId === finalDragging.definitionId
        ? expectedInteraction.stationId
        : undefined;
    if (
      event &&
      expectedDragToZone &&
      pointIsInsideStation(event.clientX, event.clientY, expectedDragToZone) &&
      onDragToZone(finalDragging.id, expectedDragToZone)
    ) {
      draggingRef.current = undefined;
      draggingPointRef.current = undefined;
      setDragging(undefined);
      return;
    }
    const overlap = overlapForDragging(finalDragging);
    if (overlap.kind === "valid" && overlap.target) {
      const interactionPoint =
        expectedInteraction?.type === "snapIntoTarget"
          ? snapPointForTarget(
              overlap.target,
              placed.find((instance) => instance.id === finalDragging.id)?.definitionId ?? "",
            )
          : finalDragging.point;
      const completed = onObjectInteraction(finalDragging.id, overlap.target.id, interactionPoint);
      if (
        completed &&
        expectedInteraction?.type !== "snapIntoTarget" &&
        expectedInteraction?.type !== "readInstrument" &&
        finalDragging.kind !== "probe"
      ) {
        const limits = surfaceLimits(logicalSize, finalDragging);
        const occupied = benchOccupiedBoundsFromNodes(
          renderNodes,
          placedPositions,
          finalDragging.id,
          state.equipmentInstances,
        );
        onMoveInstance(
          finalDragging.id,
          parkAfterInteraction(finalDragging.point, occupied, limits, finalDragging),
        );
      }
    } else if (overlap.kind === "invalid" && overlap.target) {
      onInvalidOverlap(finalDragging.id, overlap.target.id);
    } else if (finalDragging.kind !== "probe") {
      onMoveInstance(finalDragging.id, finalDragging.point);
    }
    draggingRef.current = undefined;
    draggingPointRef.current = undefined;
    setDragging(undefined);
  };

  const expectedStation = expectedInteraction?.stationId;
  const expectedSource = expectedInteraction?.sourceDefinitionId;
  const expectedTarget = expectedInteraction?.targetDefinitionId;
  const nodeHasDefinition = (node: RenderNode, definitionId: string | undefined): boolean =>
    Boolean(definitionId && node.layers.some((layer) => layer.definitionId === definitionId));
  const instanceIdForDefinition = (
    node: RenderNode,
    definitionId: string | undefined,
    fallbackId: string,
  ): string =>
    node.layers.find((layer) => definitionId && layer.definitionId === definitionId)?.instanceId ?? fallbackId;
  const activeOverlap = dragging?.hasMoved ? overlapForDragging(dragging) : overlapForGestureDrag();
  const showPourCue =
    activeOverlap?.kind === "valid" &&
    (expectedInteraction?.type === "pourInto" || expectedInteraction?.type === "rinseTarget");
  const goblinModeWorkClass =
    goblinMode?.interactionType === "rinseTarget"
      ? "is-rinsing"
      : goblinMode?.interactionType === "pourInto"
        ? "is-pouring"
        : "is-setting-up";
  const ghostInstance = dragging
    ? placed.find((instance) => instance.id === dragging.id)
    : undefined;
  const probeLeads = placed.flatMap((meter) => {
    const presentation = getVisualProfile(meter.definitionId)?.probePresentation;
    const sourceNode = renderNodes.find((node) => node.representedInstanceIds.includes(meter.id));
    const sourceLayer = sourceNode?.layers.find((layer) => layer.instanceId === meter.id);
    if (!presentation || !sourceNode || !sourceLayer) return [];
    const sourcePoint = placedPositions.get(sourceNode.primaryInstanceId) ?? sourceNode.transform;
    const from: ProbePoint = {
      x: sourcePoint.x + sourceLayer.x + sourceLayer.width * presentation.consoleLeadPort.x,
      y: sourcePoint.y + sourceLayer.y + sourceLayer.height * presentation.consoleLeadPort.y,
    };
    if (dragging?.kind === "probe" && dragging.id === meter.id) {
      return [{ id: meter.id, from, to: {
        x: dragging.point.x + presentation.probeSize.width * presentation.probeLeadPort.x,
        y: dragging.point.y + presentation.probeSize.height * presentation.probeLeadPort.y,
      } }];
    }
    if (gestureDrag?.kind === "probe" && gestureDrag.instanceId === meter.id && gestureDrag.point) {
      return [{ id: meter.id, from, to: {
        x: gestureDrag.point.x + presentation.probeSize.width * presentation.probeLeadPort.x,
        y: gestureDrag.point.y + presentation.probeSize.height * presentation.probeLeadPort.y,
      } }];
    }
    const targetId = meter.contents.probeImmersedInInstanceId;
    const targetNode = targetId
      ? renderNodes.find((node) => node.representedInstanceIds.includes(targetId))
      : undefined;
    const targetInstance = targetId ? placed.find((candidate) => candidate.id === targetId) : undefined;
    const zoneId = targetInstance
      ? equipmentById
          .get(targetInstance.definitionId)
          ?.snapZones.find((zone) => zone.accepts.includes(meter.definitionId))?.id
      : undefined;
    const zone = targetInstance && zoneId
      ? getVisualProfile(targetInstance.definitionId)?.visualZones.find((candidate) => candidate.id === zoneId)
      : undefined;
    if (!targetNode || !zone) return [];
    const targetPoint = placedPositions.get(targetNode.primaryInstanceId) ?? targetNode.transform;
    const targetLayer = targetNode.layers.find((layer) => layer.instanceId === targetId);
    if (!targetLayer) return [];
    const probeTop = {
      x: targetPoint.x + targetLayer.x + zone.anchor.x - presentation.probeSize.width * presentation.probeTipAnchor.x,
      y: targetPoint.y + targetLayer.y + zone.anchor.y - presentation.probeSize.height * presentation.probeTipAnchor.y,
    };
    return [{
      id: meter.id,
      from,
      to: {
        x: probeTop.x + presentation.probeSize.width * presentation.probeLeadPort.x,
        y: probeTop.y + presentation.probeSize.height * presentation.probeLeadPort.y,
      },
    }];
  });
  const handleStopcockClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (onDispenseDrop()) {
      setDropPulse((pulse) => pulse + 1);
    }
  };

  return (
    <section
      className="workbench"
      aria-label="Workbench"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => handleDrop(event, "workbench")}
    >
      <div className="panel-heading workbench-heading">
        <div className="workbench-heading-copy">
          <h2>Workbench</h2>
          <span>{placed.length} placed</span>
        </div>
        <div className="workbench-zoom-controls" role="group" aria-label="Workbench zoom">
          <button
            aria-label="Zoom out"
            data-gesture-action="workbench-zoom-out"
            disabled={zoomLocked || effectiveZoomPercent <= minimumWorkbenchZoomPercent}
            onClick={() => changeNumericZoom(-1)}
            title="Zoom out"
            type="button"
          >
            <Minus aria-hidden="true" size={18} />
          </button>
          <output aria-label="Workbench zoom level" aria-live="polite">
            {Math.round(effectiveZoomPercent)}%
          </output>
          <button
            aria-label="Zoom in"
            data-gesture-action="workbench-zoom-in"
            disabled={zoomLocked || effectiveZoomPercent >= maximumWorkbenchZoomPercent}
            onClick={() => changeNumericZoom(1)}
            title="Zoom in"
            type="button"
          >
            <Plus aria-hidden="true" size={18} />
          </button>
          <button
            aria-label={zoomPreference === "fit" ? "Use numeric workbench zoom" : "Fit workbench to view"}
            aria-pressed={zoomPreference === "fit"}
            className="workbench-fit-control"
            data-gesture-action="workbench-zoom-fit"
            disabled={zoomLocked}
            onClick={toggleFit}
            title={zoomPreference === "fit" ? "Leave fit mode" : "Fit workbench to view"}
            type="button"
          >
            <Maximize2 aria-hidden="true" size={17} />
            <span>Fit</span>
          </button>
        </div>
      </div>
      <div
        className="bench-viewport"
        data-gesture-scroll-kind="workbench"
        data-gesture-scroll-region="both"
        ref={viewportRef}
      >
        <div
          className="bench-scroll-content"
          style={{
            height: Math.max(viewportSize.height, scaledSceneSize.height),
            width: Math.max(viewportSize.width, scaledSceneSize.width),
          }}
        >
          <div
            className="bench-surface"
            data-station-id="workbench"
            ref={surfaceRef}
            style={{
              height: logicalSize.height,
              transform: `translate3d(${viewTransform.offsetX}px, ${viewTransform.offsetY}px, 0) scale(${viewTransform.zoom})`,
              transformOrigin: "0 0",
              width: logicalSize.width,
              "--workbench-inverse-zoom": 1 / viewTransform.zoom,
            } as CSSProperties}
            onPointerMove={continueMove}
            onPointerUp={(event) => finishMove(event)}
            onPointerCancel={() => {
              draggingRef.current = undefined;
              draggingPointRef.current = undefined;
              setDragging(undefined);
            }}
          >
            <div className="bench-grid-lines" aria-hidden="true" />
            {renderNodes.length === 0 ? (
              <p className="empty-state">Place equipment from the shelf to begin the current step.</p>
            ) : null}
            {goblinMode?.enabled ? (
              <div
                className={`workbench-goblin-action ${goblinModeWorkClass}`}
                key={`${goblinMode.actionId ?? "idle"}-${goblinMode.interactionType ?? "setup"}`}
                aria-hidden="true"
              >
                <span className="workbench-goblin-track is-apparatus">
                  <img
                    alt=""
                    className="workbench-goblin-sprite"
                    src={`${import.meta.env.BASE_URL}assets/goblin-mode/apparatus-helper.png`}
                  />
                </span>
                <span className="workbench-goblin-track is-notebook">
                  <img
                    alt=""
                    className="workbench-goblin-sprite"
                    src={`${import.meta.env.BASE_URL}assets/goblin-mode/notebook-helper.png`}
                  />
                </span>
                <span className="workbench-goblin-effect" />
              </div>
            ) : null}
        {probeLeads.map((lead) => (
          <PhProbeLead
            key={lead.id}
            from={lead.from}
            instanceId={lead.id}
            to={lead.to}
            surfaceWidth={logicalSize.width}
            surfaceHeight={logicalSize.height}
          />
        ))}
        {renderNodes.map((node, index) => {
          const instance = placed.find((candidate) => candidate.id === node.primaryInstanceId);
          if (!instance) return null;
          const point = placedPositions.get(node.primaryInstanceId) ?? defaultPosition(index);
          const isSource = nodeHasDefinition(node, expectedSource);
          const isTarget =
            nodeHasDefinition(node, expectedTarget) ||
            (expectedInteraction?.type === "readInstrument" && nodeHasDefinition(node, expectedStation));
          const isOverlapTarget = activeOverlap?.target
            ? node.representedInstanceIds.includes(activeOverlap.target.id)
            : false;
          const isActiveDrag =
            (dragging?.id === instance.id && dragging.hasMoved && dragging.kind !== "probe") ||
              Boolean(
                gestureDrag?.instanceId &&
                gestureDrag.kind === "equipment" &&
                node.representedInstanceIds.includes(gestureDrag.instanceId),
            );
          const sourceSelectionId = instanceIdForDefinition(node, expectedSource, instance.id);
          const targetSelectionId = instanceIdForDefinition(
            node,
            expectedInteraction?.type === "readInstrument" ? expectedTarget ?? expectedStation : expectedTarget,
            instance.id,
          );
          const probeSourceLayer =
            expectedInteraction?.type === "snapIntoTarget" &&
            nodeHasDefinition(node, expectedInteraction.sourceDefinitionId)
              ? node.layers.find(
                  (layer) =>
                    layer.definitionId === expectedInteraction.sourceDefinitionId &&
                    Boolean(getVisualProfile(layer.definitionId)?.probePresentation),
                )
              : undefined;
          const probePresentation = probeSourceLayer
            ? getVisualProfile(probeSourceLayer.definitionId)?.probePresentation
            : undefined;
          const dispenseLayer =
            expectedInteraction?.type === "dispenseDrops"
              ? node.layers.find((layer) => layer.definitionId === expectedSource)
              : undefined;
          const detachableSourceLayer =
            expectedInteraction?.type === "dragToZone"
              ? node.layers.find(
                  (layer) =>
                    layer.instanceId !== node.primaryInstanceId &&
                    layer.definitionId === expectedInteraction.sourceDefinitionId,
                )
              : undefined;
          const detachableSourceLabel =
            expectedInteraction?.type === "dragToZone"
              ? expectedInteraction.accessibleLabel
              : undefined;
          const renderedLayers = renderLayersForNode(node, state.equipmentInstances)
            .filter(
              (layer) =>
                !(dragging?.hasMoved && dragging.kind !== "probe" && layer.instance?.id === dragging.id) &&
                !(
                  gestureDrag?.kind === "attachedChild" &&
                  layer.instance?.id === gestureDrag.instanceId
                ),
            )
            .map((layer) => {
              const presentation = getVisualProfile(layer.definition.id)?.probePresentation;
              const isDetached =
                Boolean(presentation) &&
                (layer.instance?.contents.probeImmersedInInstanceId !== undefined ||
                  (dragging?.kind === "probe" && dragging.id === layer.instance?.id) ||
                  (gestureDrag?.kind === "probe" && gestureDrag.instanceId === layer.instance?.id));
              return isDetached && presentation
                ? { ...layer, assetOverride: presentation.detachedConsoleAsset }
                : layer;
            });
          const immersedMeter = placed.find(
            (candidate) => candidate.contents.probeImmersedInInstanceId === instance.id,
          );
          const immersedPresentation = immersedMeter
            ? getVisualProfile(immersedMeter.definitionId)?.probePresentation
            : undefined;
          const immersedZoneId = immersedMeter
            ? equipmentById
                .get(instance.definitionId)
                ?.snapZones.find((zone) => zone.accepts.includes(immersedMeter.definitionId))?.id
            : undefined;
          const immersedZone = immersedZoneId
            ? getVisualProfile(instance.definitionId)?.visualZones.find((zone) => zone.id === immersedZoneId)
            : undefined;
          const underLiquidAccessory =
            immersedPresentation && immersedZone ? (
              <PhProbeUnderLiquidAccessory
                presentation={immersedPresentation}
                zoneAnchor={immersedZone.anchor}
              />
            ) : undefined;
          const renderedLayersWithAccessory = underLiquidAccessory
            ? renderedLayers.map((layer) =>
                layer.instance?.id === instance.id ? { ...layer, underLiquidAccessory } : layer,
              )
            : renderedLayers;
          const isDispenseSource = Boolean(isSource && dispenseLayer);
          const dispenseProfile = dispenseLayer
            ? getVisualProfile(dispenseLayer.definitionId)
            : undefined;
          const dispenseControlAnchor = dispenseProfile?.interactionAnchors?.dispenseControl ?? {
            x: 0.64,
            y: 0.62,
          };
          const dispenseOutletAnchor = dispenseProfile?.interactionAnchors?.dispenseOutlet ?? {
            x: 0.5,
            y: 0.78,
          };
          const stopcockStyle = dispenseLayer
            ? ({
                left:
                  dispenseLayer.x - node.bounds.x + dispenseLayer.width * dispenseControlAnchor.x,
                top:
                  dispenseLayer.y - node.bounds.y + dispenseLayer.height * dispenseControlAnchor.y,
              } as CSSProperties)
            : undefined;
          const dropStyle = dispenseLayer
            ? ({
                left:
                  dispenseLayer.x - node.bounds.x + dispenseLayer.width * dispenseOutletAnchor.x,
                top:
                  dispenseLayer.y - node.bounds.y + dispenseLayer.height * dispenseOutletAnchor.y,
              } as CSSProperties)
            : undefined;
          return (
            <div
              className={[
                "bench-item",
                showGuidance && isSource ? "is-expected-source" : "",
                showGuidance && isTarget ? "is-expected-target" : "",
                isActiveDrag ? "is-dragging" : "",
                isOverlapTarget ? "is-overlap-target" : "",
                isOverlapTarget && activeOverlap?.kind === "valid" ? "is-overlap-valid" : "",
                isOverlapTarget && activeOverlap?.kind === "invalid" ? "is-overlap-invalid" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              key={node.id}
              data-definition-id={instance.definitionId}
              data-instance-id={instance.id}
              data-step-role={showGuidance ? (isSource ? "SOURCE" : isTarget ? "TARGET" : undefined) : undefined}
              style={{
                left: point.x + node.bounds.x,
                top: point.y + node.bounds.y,
                width: node.bounds.width,
                minWidth: Math.max(44 / viewTransform.zoom, node.hitBox.width),
                height: node.bounds.height,
                minHeight: Math.max(44 / viewTransform.zoom, node.hitBox.height),
                zIndex: instance.zIndex ?? index + 1,
              }}
              onPointerDown={(event) => {
                if (
                  expectedInteraction?.type === "readInstrument" &&
                  isSource &&
                  expectedSource === "ph-meter"
                ) {
                  return;
                }
                startMove(event, node);
              }}
              onPointerMove={continueMove}
              onPointerUp={(event) => finishMove(event)}
            >
              <EquipmentView
                instance={instance}
                layers={renderedLayersWithAccessory}
                variant="bench"
                attachedSummary={node.attachedSummary}
                gestureGrabbed={isActiveDrag}
                selected={node.representedInstanceIds.some(
                  (instanceId) => selectedSource === instanceId || selectedTarget === instanceId,
                )}
                onSelect={() =>
                  selectedSource ? onSelectTarget(targetSelectionId) : onSelectSource(sourceSelectionId)
                }
              />
              {probeSourceLayer && probePresentation ? (
                <button
                  className="ph-probe-handle"
                  type="button"
                  data-definition-id={probeSourceLayer.definitionId}
                  data-instance-id={probeSourceLayer.instanceId}
                  data-gesture-drag-kind="probe"
                  aria-label="pH probe handle; drag the probe into the flask"
                  style={{
                    left:
                      probeSourceLayer.x - node.bounds.x +
                      probeSourceLayer.width * probePresentation.sourceGripAnchor.x,
                    top:
                      probeSourceLayer.y - node.bounds.y +
                      probeSourceLayer.height * probePresentation.sourceGripAnchor.y,
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectSource(probeSourceLayer.instanceId);
                  }}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const meterPoint = placedPositions.get(node.primaryInstanceId) ?? point;
                    const proxyLayer = probeProxyLayer(probeSourceLayer, probePresentation);
                    startMove(
                      event,
                      probeProxyNode(node, probeSourceLayer, probePresentation),
                      proxyLayer,
                      pointForProbeSource(meterPoint, probeSourceLayer, probePresentation),
                      "probe",
                    );
                  }}
                  onPointerMove={continueMove}
                  onPointerUp={(event) => finishMove(event)}
                >
                  {dragging?.kind === "probe" &&
                  dragging.id === probeSourceLayer.instanceId &&
                  !dragging.hasMoved ? (
                    <PhProbeArt presentation={probePresentation} />
                  ) : null}
                </button>
              ) : null}
              {detachableSourceLayer ? (
                <button
                  className="bench-attached-child-handle"
                  type="button"
                  data-definition-id={detachableSourceLayer.definitionId}
                  data-instance-id={detachableSourceLayer.instanceId}
                  data-gesture-drag-kind="attached-child"
                  aria-label={detachableSourceLabel}
                  style={{
                    left: detachableSourceLayer.x - node.bounds.x,
                    top: detachableSourceLayer.y - node.bounds.y,
                    width: detachableSourceLayer.width,
                    height: detachableSourceLayer.height,
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectSource(detachableSourceLayer.instanceId);
                  }}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    startMove(event, node, detachableSourceLayer);
                  }}
                  onPointerMove={continueMove}
                  onPointerUp={(event) => finishMove(event)}
                />
              ) : null}
              {isDispenseSource && stopcockStyle ? (
                <button
                  className="stopcock-button"
                  type="button"
                  data-gesture-action="dispense-drop"
                  style={stopcockStyle}
                  aria-label="Dispense one drop from burette stopcock"
                  onClick={handleStopcockClick}
                  onPointerDown={(event) => event.stopPropagation()}
                  title="Dispense one drop"
                >
                  <span aria-hidden="true" />
                </button>
              ) : null}
              {isDispenseSource && dropStyle && dropPulse > 0 ? (
                <span
                  className="titration-falling-drop"
                  key={dropPulse}
                  style={dropStyle}
                  aria-hidden="true"
                />
              ) : null}
            </div>
          );
        })}
        {dragging?.hasMoved ? (
          <div
            className={[
              "bench-ghost",
              activeOverlap?.kind === "valid" ? "is-overlap-valid" : "",
              activeOverlap?.kind === "invalid" ? "is-overlap-invalid" : "",
              showPourCue ? "is-pour-cue" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ left: dragging.point.x, top: dragging.point.y }}
            aria-hidden="true"
          >
            {dragging.kind === "probe" ? (
              <PhProbeArt
                presentation={getVisualProfile(dragging.definitionId)?.probePresentation!}
              />
            ) : ghostInstance ? (
              <EquipmentView instance={ghostInstance} variant="bench" decorative />
            ) : (
              dragging.label
            )}
          </div>
        ) : null}
          </div>
        </div>
      </div>
    </section>
  );
};
