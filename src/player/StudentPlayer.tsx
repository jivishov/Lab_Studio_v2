import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Camera,
  CameraOff,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  FlaskConical,
  GripHorizontal,
  Info,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { definiteEquipmentLabel, sentenceEquipmentLabel } from "../domain/equipmentLabels";
import { isVisibleWorkbenchLocation } from "../domain/equipmentLocations";
import { resolveActionInteraction } from "../domain/interactions";
import type { ActionDefinition, ActionInteractionSpec, EquipmentDefinition } from "../domain/types";
import type { RehearsalController } from "../experimentComposer/types";
import { equipmentById } from "../equipment/catalog";
import { getBenchSize, getVisualProfile, type ProbePresentation } from "../equipment/visualCatalog";
import {
  actionInputField,
  resolveInteractionIntent,
  resolveActionInput,
  type InteractionInvalidFeedback,
  type RuntimeDefinition,
  type RuntimeInteractionIntent,
} from "../runtime";
import { EquipmentShelf } from "./EquipmentShelf";
import { FeedbackPanel } from "./FeedbackPanel";
import { resolveBenchOverlap, type BenchOverlapResult } from "./benchOverlap";
import {
  benchBoundsForInteractionSource,
  benchTargetBoundsForInteraction,
  benchTargetBoundsForNode,
  snapPointAligningSourceAnchor,
} from "./benchTargeting";
import { EquipmentView } from "./EquipmentView";
import { PhProbeArt, probeLeadPathData } from "./PhProbePresentation";
import { statusLabelForGesture, type GestureController } from "./gesture/gestureTypes";
import { useGestureRecognition } from "./gesture/useGestureRecognition";
import { labelForGestureCursorSpeed, type GestureCursor } from "./gesture/gestureMath";
import type { GestureGrabResolution } from "./gesture/bridge/gestureBridge";
import {
  attachedChildHandleSelector,
  createDomGestureTargetResolver,
  probeHandleSelector,
  shelfEquipmentSelector,
  studentPlayerHoverSelector,
  workbenchItemSelector,
} from "./gesture/bridge/domTargetResolver";
import { GestureCursorOverlay, useGestureBridge } from "./gesture/bridge/useGestureBridge";
import {
  GOBLIN_MODE_STEP_DELAY_MS,
  isGoblinModeComplete,
  isGoblinModeEligible,
  resolveGoblinModeStep,
} from "./goblinMode";
import { NotebookPanel } from "./NotebookPanel";
import { ProcessSidebar, type InspectorTab } from "./ProcessSidebar";
import { PlayerUtilityStrip, type EvidenceView } from "./PlayerUtilityStrip";
import { ResultsPanel } from "./ResultsPanel";
import {
  renderLayersForNode,
  resolveWorkbenchScene,
  type RenderNode,
} from "./resolveWorkbenchScene";
import { usePlayerRuntime } from "./usePlayerRuntime";
import { useGuidedRehearsalController } from "./useGuidedRehearsalController";
import { Workbench } from "./Workbench";
import {
  clientPointToWorkbench,
  defaultWorkbenchViewTransform,
  scaleWorkbenchPreviewSize,
  workbenchPointToClient,
  type WorkbenchViewTransform,
} from "./workbenchViewTransform";

interface StudentPlayerProps {
  definition: RuntimeDefinition;
  chrome?: "full" | "preview";
  compact?: boolean;
  focusNodeId?: string;
  focusVersion?: number;
  gestureController?: GestureController;
  guidedRehearsal?: {
    attemptId: string;
    onControllerChange: (controller: RehearsalController | undefined) => void;
  };
}

const intentTypeForInteraction = {
  dragToZone: "placeIntent",
  snapIntoTarget: "snapIntent",
  pourInto: "pourIntent",
  dispenseDrops: "dispenseDropIntent",
  spotOnto: "spotIntent",
  rinseTarget: "rinseIntent",
  placeInInstrument: "instrumentReadIntent",
  readInstrument: "instrumentReadIntent",
  recordNotebook: "notebookRecordIntent",
  recordTimeSeries: "timeSeriesRecordIntent",
  submitCalculation: "calculationSubmitIntent",
} as const;

const stationLocation = (zone: string) => {
  if (zone === "shelf") return "shelf";
  return zone === "heating" || zone === "oven" || zone === "drying-oven" ? "oven" : "workbench";
};

const benchPointForIndex = (index: number) => ({
  x: 34 + (index % 5) * 148,
  y: 86 + Math.floor(index / 5) * 160,
});

const benchPointForDefinition = (definitionId: string, index: number) => {
  if (definitionId === "ring-stand-clamp" || definitionId === "ring-stand") return { x: 270, y: 36 };
  return benchPointForIndex(index);
};

const placementOverlapRatio = (
  point: { x: number; y: number },
  size: { width: number; height: number },
  occupied: { x: number; y: number; width: number; height: number },
) => {
  const left = Math.max(point.x, occupied.x);
  const right = Math.min(point.x + size.width, occupied.x + occupied.width);
  const top = Math.max(point.y, occupied.y);
  const bottom = Math.min(point.y + size.height, occupied.y + occupied.height);
  const denominator = Math.min(size.width * size.height, occupied.width * occupied.height);
  return denominator > 0
    ? (Math.max(0, right - left) * Math.max(0, bottom - top)) / denominator
    : 0;
};

const equipmentLabel = (definitionId?: string): string | undefined =>
  definitionId ? equipmentById.get(definitionId)?.label : undefined;

const stationLabel = (stationId?: string): string =>
  equipmentLabel(stationId) ??
  (stationId === "shelf"
    ? "the equipment shelf"
    : stationId === "workbench"
      ? "the workbench"
      : "the target area");

const actionNumberParameter = (action: ActionDefinition, key: string): number | undefined => {
  const value = action.parameters[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

const previewInteractionHint = (
  action: ActionDefinition | undefined,
  interaction: ActionInteractionSpec | undefined,
): string | undefined => {
  if (!action || !interaction) return undefined;
  const source = equipmentLabel(interaction.sourceDefinitionId) ?? "the source item";
  const target = equipmentLabel(interaction.targetDefinitionId);
  if (interaction.type === "pourInto") {
    const volumeMl = actionNumberParameter(action, "volumeMl");
    const volumeLabel = volumeMl === undefined ? "the target volume" : `${volumeMl} mL`;
    if (action.verb === "measureVolume" && target) {
      return `Pour ${sentenceEquipmentLabel(source)} into ${sentenceEquipmentLabel(target)} until the meniscus reaches ${volumeLabel}.`;
    }
    if (action.verb === "transfer" && target) {
      return `Pour ${volumeLabel} from ${definiteEquipmentLabel(source)} into ${definiteEquipmentLabel(target)}.`;
    }
    return interaction.accessibleLabel;
  }
  if (interaction.type === "dispenseDrops") {
    const instruction = action.parameters.preEndpointInstruction;
    return typeof instruction === "string" && instruction.trim().length > 0
      ? instruction
      : "Use the burette stopcock to dispense one configured increment at a time.";
  }
  if (interaction.type === "spotOnto") {
    return `Drag ${source} onto ${target ?? "the chromatography paper"}.`;
  }
  if (interaction.type === "dragToZone") {
    return `Drag ${source} to ${stationLabel(interaction.stationId)}.`;
  }
  if (interaction.type === "snapIntoTarget") {
    return `Drag ${source} onto ${target ?? "the matching target"}.`;
  }
  if (interaction.type === "rinseTarget") {
    return `Drag ${source} onto ${target ?? "the item to rinse"}.`;
  }
  if (interaction.type === "placeInInstrument") {
    return `Drag ${source} into ${target ?? stationLabel(interaction.stationId)}.`;
  }
  if (interaction.type === "readInstrument") {
    return `Select ${source} and use ${target ?? stationLabel(interaction.stationId)}.`;
  }
  if (interaction.type === "recordNotebook") {
    return "Record the current evidence from the process sidebar.";
  }
  if (interaction.type === "recordTimeSeries") {
    return "Record the timed gas syringe data from the process sidebar.";
  }
  if (interaction.type === "submitCalculation") {
    return "Submit the calculation result from the process sidebar.";
  }
  return undefined;
};

const hasIncompleteInboundStep = (
  process: RuntimeDefinition["process"],
  nodeId: string,
  completedNodes: string[],
): boolean => {
  const completed = new Set(completedNodes);
  return process.edges.some(
    (edge) => edge.to === nodeId && edge.condition.type !== "retry" && !completed.has(edge.from),
  );
};

interface BenchPoint {
  x: number;
  y: number;
}

interface VisionEquipmentGrab {
  grabOffsetX: number;
  grabOffsetY: number;
  height: number;
  label: string;
  width: number;
}

type VisionEquipmentTarget =
  | ({
      definitionId: string;
      kind: "shelf";
    } & VisionEquipmentGrab)
  | ({
      instanceId: string;
      kind: "bench";
    } & VisionEquipmentGrab)
  | ({
      instanceId: string;
      kind: "attachedChild";
    } & VisionEquipmentGrab)
  | ({
      instanceId: string;
      kind: "probe";
      presentation: ProbePresentation;
    } & VisionEquipmentGrab);

interface VisionDragPreview extends VisionEquipmentGrab {
  benchPoint?: BenchPoint;
  definitionId?: string;
  instanceId?: string;
  kind: "shelf" | "bench" | "attachedChild" | "probe";
  presentation?: ProbePresentation;
  scale: number;
  overlap?: BenchOverlapResult;
  viewportPoint: BenchPoint;
}

const clampValue = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), Math.max(min, max));

type PlayerLayoutBand = "desktop" | "mobile" | "tablet";

interface CameraPanelPosition {
  left: number;
  top: number;
}

interface CameraPanelDragState {
  offsetX: number;
  offsetY: number;
  pointerId: number;
}

const playerLayoutBand = (width: number): PlayerLayoutBand =>
  width <= 720 ? "mobile" : width <= 1100 ? "tablet" : "desktop";

const clampCameraPanelPosition = (
  position: CameraPanelPosition,
  rootRect: DOMRect,
  panelRect: DOMRect,
): CameraPanelPosition => {
  const inset = 8;
  return {
    left: Math.min(Math.max(inset, position.left), Math.max(inset, rootRect.width - panelRect.width - inset)),
    top: Math.min(Math.max(inset, position.top), Math.max(inset, rootRect.height - panelRect.height - inset)),
  };
};

export const StudentPlayer = ({
  definition,
  chrome = "full",
  compact = false,
  focusNodeId,
  focusVersion = 0,
  gestureController,
  guidedRehearsal,
}: StudentPlayerProps) => {
  const playerRootRef = useRef<HTMLElement | null>(null);
  const workbenchViewTransformRef = useRef<WorkbenchViewTransform>(
    defaultWorkbenchViewTransform,
  );
  const cameraPanelRef = useRef<HTMLElement | null>(null);
  const cameraPanelDragRef = useRef<CameraPanelDragState | undefined>(undefined);
  const gesturePreviewElementRef = useRef<HTMLSpanElement | null>(null);
  const gestureProbeLeadElementRef = useRef<SVGSVGElement | undefined>(undefined);
  const visionDragPreviewRef = useRef<VisionDragPreview | undefined>(undefined);
  const lastActionSurfaceRef = useRef<"inspector" | "workbench" | undefined>(undefined);
  const previousNodeIdRef = useRef<string | undefined>(undefined);
  const aboutButtonRef = useRef<HTMLButtonElement | null>(null);
  const aboutCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const cameraHelpButtonRef = useRef<HTMLButtonElement | null>(null);
  const cameraHelpCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const realGestureController = useGestureRecognition();
  const gesture = gestureController ?? realGestureController;
  const gestureBridge = useGestureBridge<VisionEquipmentTarget>({
    enabled: gesture.enabled,
    root: playerRootRef,
    stop: gesture.stop,
  });
  const runtime = usePlayerRuntime(definition, "guided", focusNodeId, focusVersion);
  const onRehearsalControllerChange = guidedRehearsal?.onControllerChange;
  const renderNodes = useMemo(() => resolveWorkbenchScene(runtime.state), [runtime.state]);
  const placedPositions = useMemo(
    () =>
      new Map(
        renderNodes.map((node) => [node.primaryInstanceId, { x: node.transform.x, y: node.transform.y }]),
      ),
    [renderNodes],
  );
  const [selectedSource, setSelectedSource] = useState<string>();
  const [selectedTarget, setSelectedTarget] = useState<string>();
  const [interactionFeedback, setInteractionFeedback] = useState<InteractionInvalidFeedback>();
  const rehearsalBridge = useGuidedRehearsalController({
    attemptId: guidedRehearsal?.attemptId ?? "ordinary-player",
    definition,
    enabled: Boolean(guidedRehearsal) && runtime.mode === "guided",
    runtime,
    setInteractionFeedback,
  });
  useLayoutEffect(() => {
    if (guidedRehearsal && runtime.getState().mode !== "guided") {
      runtime.setMode("guided");
    }
  }, [guidedRehearsal, runtime.getState, runtime.setMode]);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [cameraHelpOpen, setCameraHelpOpen] = useState(false);
  const [cameraPanelCollapsed, setCameraPanelCollapsed] = useState(false);
  const [cameraPanelDragging, setCameraPanelDragging] = useState(false);
  const [cameraPanelPosition, setCameraPanelPosition] = useState<CameraPanelPosition>();
  const [gestureArbitrationMessage, setGestureArbitrationMessage] = useState<string>();
  const [goblinModeEnabled, setGoblinModeEnabled] = useState(false);
  const [goblinModeStatus, setGoblinModeStatus] = useState<string>();
  const [visionDragPreview, setVisionDragPreviewState] = useState<VisionDragPreview>();
  const [actionInputValues, setActionInputValues] = useState<Record<string, string>>({});
  const [layoutBand, setLayoutBand] = useState<PlayerLayoutBand>(() =>
    typeof window === "undefined" ? "desktop" : playerLayoutBand(window.innerWidth),
  );
  const [equipmentCollapsed, setEquipmentCollapsed] = useState(() =>
    typeof window !== "undefined" && playerLayoutBand(window.innerWidth) === "tablet",
  );
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("now");
  const [evidenceView, setEvidenceView] = useState<EvidenceView>("feedback");
  const aboutTitleId = useId();
  const aboutDescriptionId = useId();
  const cameraHelpTitleId = useId();
  const cameraHelpDescriptionId = useId();
  const cameraPanelBodyId = useId();
  const setVisionDragPreview = (preview: VisionDragPreview | undefined) => {
    visionDragPreviewRef.current = preview;
    if (!preview) gestureProbeLeadElementRef.current = undefined;
    setVisionDragPreviewState(preview);
  };
  const isPreviewChrome = chrome === "preview";
  const goblinModeEligible = !guidedRehearsal && isGoblinModeEligible(definition, isPreviewChrome);
  const showGuidance = runtime.mode === "guided";
  const PlayerRoot = compact || isPreviewChrome ? "section" : "main";
  const definitionDescription =
    "learningGoal" in definition ? definition.learningGoal : definition.description;
  const expectedInteraction = runtime.expectedAction
    ? resolveActionInteraction(runtime.expectedAction)
    : undefined;
  const currentActionInputField = actionInputField(runtime.expectedAction);
  const currentActionInputValue = currentActionInputField
    ? actionInputValues[currentActionInputField.key] ?? ""
    : "";
  const currentActionInput = resolveActionInput(runtime.expectedAction, currentActionInputValue);
  const currentStepEquipmentIds = useMemo(
    () => [
      expectedInteraction?.sourceDefinitionId,
      expectedInteraction?.targetDefinitionId,
      expectedInteraction?.stationId,
    ].filter((definitionId): definitionId is string =>
      Boolean(definitionId && equipmentById.has(definitionId)),
    ),
    [expectedInteraction],
  );
  const availableIds = useMemo(
    () => {
      const baseIds =
        "requiredEquipment" in definition ? definition.requiredEquipment : definition.equipment;
      const fallbackIds = baseIds.filter((definitionId) => equipmentById.has(definitionId));
      return [...new Set([...currentStepEquipmentIds, ...fallbackIds])];
    },
    [definition, currentStepEquipmentIds],
  );
  const previewHint = isPreviewChrome && showGuidance
    ? previewInteractionHint(runtime.expectedAction, expectedInteraction)
    : undefined;
  const currentNodeCompleted = runtime.state.completedNodes.includes(runtime.currentNode.id);
  const goblinModeComplete = isGoblinModeComplete(definition, runtime.state);
  const activeExpectedInteraction = currentNodeCompleted ? undefined : expectedInteraction;
  const placedDefinitionCounts = useMemo(
    () =>
      runtime.state.equipmentInstances.reduce<Record<string, number>>((counts, instance) => {
        if (!isVisibleWorkbenchLocation(instance.location)) return counts;
        counts[instance.definitionId] = (counts[instance.definitionId] ?? 0) + 1;
        return counts;
      }, {}),
    [runtime.state.equipmentInstances],
  );
  const shelfDefinitionCounts = useMemo(
    () =>
      runtime.state.equipmentInstances.reduce<Record<string, number>>((counts, instance) => {
        if (instance.location !== "shelf") return counts;
        counts[instance.definitionId] = (counts[instance.definitionId] ?? 0) + 1;
        return counts;
      }, {}),
    [runtime.state.equipmentInstances],
  );
  const previewNotice =
    isPreviewChrome && hasIncompleteInboundStep(runtime.process, runtime.currentNode.id, runtime.state.completedNodes)
      ? "Preview uses current bench state; complete prior steps to supply this source."
      : undefined;
  const isLegacyMobile = layoutBand === "mobile" && !isPreviewChrome;
  const resultsCount =
    runtime.state.measurements.length + runtime.state.dataSeries.length + runtime.state.calculations.length;
  const evidenceCount = runtime.state.feedbackQueue.length + runtime.state.notebook.length + resultsCount;
  const placedEquipmentCount = Object.values(placedDefinitionCounts).reduce((sum, count) => sum + count, 0);
  const currentStepIndex = Math.max(
    0,
    runtime.process.nodes.findIndex((node) => node.id === runtime.state.currentNodeId),
  );
  const currentNeedsSource = Boolean(
    expectedInteraction?.sourceDefinitionId ||
      (expectedInteraction && ["dragToZone", "snapIntoTarget", "pourInto", "dispenseDrops", "spotOnto", "rinseTarget", "placeInInstrument", "readInstrument"].includes(expectedInteraction.type)),
  );
  const currentNeedsTarget = Boolean(
    expectedInteraction &&
      (["snapIntoTarget", "pourInto", "dispenseDrops", "spotOnto", "rinseTarget", "placeInInstrument"].includes(expectedInteraction.type) ||
        (expectedInteraction.type === "readInstrument" && expectedInteraction.targetDefinitionId)),
  );
  const utilityStatus = currentNodeCompleted
    ? { detail: "Step complete", state: "complete" as const }
    : interactionFeedback
      ? { detail: "Review the recovery guidance", state: "blocked" as const }
      : runtime.mode === "assessment" &&
          ((currentNeedsSource && !selectedSource) || (currentNeedsTarget && !selectedTarget))
        ? { detail: "Select the required equipment", state: "blocked" as const }
        : { detail: "Ready for the current action", state: "ready" as const };

  const currentCameraPanelPosition = (): CameraPanelPosition | undefined => {
    const rootRect = playerRootRef.current?.getBoundingClientRect();
    const panelRect = cameraPanelRef.current?.getBoundingClientRect();
    if (!rootRect || !panelRect) return undefined;
    return {
      left: panelRect.left - rootRect.left,
      top: panelRect.top - rootRect.top,
    };
  };

  const updateCameraPanelPosition = (position: CameraPanelPosition) => {
    const rootRect = playerRootRef.current?.getBoundingClientRect();
    const panelRect = cameraPanelRef.current?.getBoundingClientRect();
    if (!rootRect || !panelRect) return;
    setCameraPanelPosition(clampCameraPanelPosition(position, rootRect, panelRect));
  };

  const beginCameraPanelDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || isPreviewChrome || layoutBand === "mobile") return;
    const panelPosition = currentCameraPanelPosition();
    const panelRect = cameraPanelRef.current?.getBoundingClientRect();
    if (!panelPosition || !panelRect) return;
    cameraPanelDragRef.current = {
      offsetX: event.clientX - panelRect.left,
      offsetY: event.clientY - panelRect.top,
      pointerId: event.pointerId,
    };
    setCameraPanelPosition(panelPosition);
    setCameraPanelDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  const moveCameraPanel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = cameraPanelDragRef.current;
    const rootRect = playerRootRef.current?.getBoundingClientRect();
    if (!drag || drag.pointerId !== event.pointerId || !rootRect) return;
    updateCameraPanelPosition({
      left: event.clientX - rootRect.left - drag.offsetX,
      top: event.clientY - rootRect.top - drag.offsetY,
    });
  };

  const endCameraPanelDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (cameraPanelDragRef.current?.pointerId !== event.pointerId) return;
    cameraPanelDragRef.current = undefined;
    setCameraPanelDragging(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const moveCameraPanelWithKeyboard = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Home") {
      event.preventDefault();
      setCameraPanelPosition(undefined);
      return;
    }
    let direction: CameraPanelPosition | undefined;
    if (event.key === "ArrowDown") direction = { left: 0, top: 1 };
    if (event.key === "ArrowLeft") direction = { left: -1, top: 0 };
    if (event.key === "ArrowRight") direction = { left: 1, top: 0 };
    if (event.key === "ArrowUp") direction = { left: 0, top: -1 };
    if (!direction || isPreviewChrome || layoutBand === "mobile") return;
    const position = cameraPanelPosition ?? currentCameraPanelPosition();
    if (!position) return;
    event.preventDefault();
    const distance = event.shiftKey ? 48 : 16;
    updateCameraPanelPosition({
      left: position.left + direction.left * distance,
      top: position.top + direction.top * distance,
    });
  };

  useEffect(() => {
    const updateLayoutBand = () => setLayoutBand(playerLayoutBand(window.innerWidth));
    window.addEventListener("resize", updateLayoutBand);
    return () => window.removeEventListener("resize", updateLayoutBand);
  }, []);

  useEffect(() => {
    if (gesture.status === "off") return undefined;
    const keepCameraPanelInBounds = () => {
      setCameraPanelPosition((position) => {
        const rootRect = playerRootRef.current?.getBoundingClientRect();
        const panelRect = cameraPanelRef.current?.getBoundingClientRect();
        if (!position || !rootRect || !panelRect) return position;
        return clampCameraPanelPosition(position, rootRect, panelRect);
      });
    };
    const frame = window.requestAnimationFrame(keepCameraPanelInBounds);
    window.addEventListener("resize", keepCameraPanelInBounds);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", keepCameraPanelInBounds);
    };
  }, [cameraPanelCollapsed, gesture.status]);

  useEffect(() => {
    setEquipmentCollapsed(layoutBand === "tablet");
    setInspectorCollapsed(false);
    setInspectorTab("now");
    setEvidenceView("feedback");
  }, [definition.id, layoutBand]);

  useEffect(() => {
    if (layoutBand !== "tablet" || (equipmentCollapsed && inspectorTab === "now")) return;
    const closeDrawer = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (!equipmentCollapsed) {
        setEquipmentCollapsed(true);
        requestAnimationFrame(() => {
          document.querySelector<HTMLButtonElement>('[aria-controls="student-player-equipment-content"]')?.focus();
        });
        return;
      }
      setInspectorTab("now");
      requestAnimationFrame(() => document.getElementById("student-player-process-tab")?.focus());
    };
    document.addEventListener("keydown", closeDrawer);
    return () => document.removeEventListener("keydown", closeDrawer);
  }, [equipmentCollapsed, inspectorTab, layoutBand]);

  useEffect(() => {
    const previousNodeId = previousNodeIdRef.current;
    previousNodeIdRef.current = runtime.state.currentNodeId;
    if (!previousNodeId || previousNodeId === runtime.state.currentNodeId) return;
    setInspectorTab("now");
    if (lastActionSurfaceRef.current !== "inspector") return;
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(".process-sidebar.is-now-tab .atomic-step-header h3")?.focus();
    });
  }, [runtime.state.currentNodeId]);

  useEffect(() => {
    setInteractionFeedback(undefined);
    setSelectedSource(undefined);
    setSelectedTarget(undefined);
  }, [runtime.currentNode.id, runtime.expectedAction?.id]);

  useEffect(() => {
    setGoblinModeEnabled(false);
    setGoblinModeStatus(undefined);
    setActionInputValues({});
  }, [definition.id, isPreviewChrome]);

  useEffect(() => {
    if (!onRehearsalControllerChange) return undefined;
    onRehearsalControllerChange(rehearsalBridge.controller);
    return () => onRehearsalControllerChange(undefined);
  }, [onRehearsalControllerChange, rehearsalBridge.controller]);

  useEffect(() => {
    if (!goblinModeEnabled) return undefined;
    if (!goblinModeEligible || goblinModeComplete) {
      setGoblinModeEnabled(false);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      const resolved = resolveGoblinModeStep(definition, runtime.state);
      if (!resolved.ok) {
        setGoblinModeStatus(resolved.feedback.message);
        setInteractionFeedback(resolved.feedback);
        setGoblinModeEnabled(false);
        return;
      }

      setGoblinModeStatus(`${resolved.action.label} complete. Checking the next lab step.`);
      setInteractionFeedback(undefined);
      runtime.performAction(resolved.request);
    }, GOBLIN_MODE_STEP_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [
    definition,
    goblinModeComplete,
    goblinModeEligible,
    goblinModeEnabled,
    runtime.performAction,
    runtime.state,
  ]);

  useEffect(() => {
    if (!aboutOpen) return undefined;
    gestureBridge.cancel(true);
    gestureBridge.cancelScroll();
    const focusFrame = window.requestAnimationFrame(() => aboutCloseButtonRef.current?.focus());
    const handleDialogKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setAboutOpen(false);
      } else if (event.key === "Tab") {
        event.preventDefault();
        aboutCloseButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleDialogKey);
    return () => {
      document.removeEventListener("keydown", handleDialogKey);
      window.cancelAnimationFrame(focusFrame);
      aboutButtonRef.current?.focus();
    };
  }, [aboutOpen]);

  useEffect(() => {
    if (!cameraHelpOpen) return undefined;
    gestureBridge.cancel(true);
    gestureBridge.cancelScroll();
    const focusFrame = window.requestAnimationFrame(() => cameraHelpCloseButtonRef.current?.focus());
    const handleDialogKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setCameraHelpOpen(false);
      } else if (event.key === "Tab") {
        event.preventDefault();
        cameraHelpCloseButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleDialogKey);
    return () => {
      document.removeEventListener("keydown", handleDialogKey);
      window.cancelAnimationFrame(focusFrame);
      cameraHelpButtonRef.current?.focus();
    };
  }, [cameraHelpOpen]);

  const nextZIndex = () =>
    Math.max(0, ...runtime.state.equipmentInstances.map((instance) => instance.zIndex ?? 0)) + 1;
  const nextPlacementPoint = (definitionId: string) => {
    const placed = runtime.state.equipmentInstances.filter((item) =>
      isVisibleWorkbenchLocation(item.location),
    );
    const occupied = placed.map((item, index) => ({
      x: item.x ?? benchPointForIndex(index).x,
      y: item.y ?? benchPointForIndex(index).y,
      width: getBenchSize(item.definitionId).width,
      height: getBenchSize(item.definitionId).height,
    }));
    const size = getBenchSize(definitionId);
    for (let index = 0; index < 18; index += 1) {
      const point = benchPointForDefinition(definitionId, index);
      if (occupied.every((bounds) => placementOverlapRatio(point, size, bounds) < 0.05)) return point;
    }
    return benchPointForIndex(placed.length);
  };

  const runIntent = (intent: RuntimeInteractionIntent): boolean => {
    const configurationParameter = runtime.expectedAction?.parameters.configurationParameter;
    const configuredRuntimeParameters =
      currentActionInput.field?.role === "teacherConfiguration" &&
      typeof configurationParameter === "string" &&
      currentActionInput.value !== undefined
        ? { [configurationParameter]: currentActionInput.value }
        : undefined;
    const intentWithInput = currentActionInput.field && currentActionInput.valid
      ? {
          ...intent,
          value: currentActionInput.value ?? intent.value,
          note: currentActionInput.note ?? intent.note,
          configurationApproved:
            currentActionInput.field.role === "teacherConfiguration" || intent.configurationApproved,
          runtimeParameters: {
            ...intent.runtimeParameters,
            ...configuredRuntimeParameters,
          },
        } as RuntimeInteractionIntent
      : intent;
    if (guidedRehearsal) {
      const accepted = rehearsalBridge.performVisibleIntent(intentWithInput);
      if (accepted) {
        setSelectedSource(undefined);
        setSelectedTarget(undefined);
      }
      return accepted;
    }
    const result = resolveInteractionIntent(definition, runtime.state, intentWithInput);
    if (!result.ok) {
      setInteractionFeedback(result.feedback);
      runtime.recordAssessmentFailure(result.feedback.message);
      return false;
    }
    setInteractionFeedback(undefined);
    setSelectedSource(undefined);
    setSelectedTarget(undefined);
    runtime.performAction(result.request);
    return true;
  };

  const moveEquipmentToBench = (
    definitionId: string,
    zone: string,
    point: { x: number; y: number },
  ) => {
    setInteractionFeedback(undefined);
    runtime.performAction({
      verb: "place",
      equipmentDefinitionId: definitionId,
      location: stationLocation(zone),
      parameters: {
        benchMove: true,
        x: point.x,
        y: point.y,
        zIndex: nextZIndex(),
      },
    });
  };

  const expectedPlacementSourceDefinitionId = () => {
    const actionEquipmentDefinitionId = runtime.expectedAction?.parameters.equipmentDefinitionId;
    return expectedInteraction?.sourceDefinitionId ??
      (typeof actionEquipmentDefinitionId === "string" ? actionEquipmentDefinitionId : undefined);
  };

  const placementMatchesCurrentStep = (definitionId: string, zone: string): boolean => {
    if (currentNodeCompleted || expectedInteraction?.type !== "dragToZone") return false;
    if (expectedPlacementSourceDefinitionId() !== definitionId) return false;
    const expectedStation = expectedInteraction.stationId ?? "workbench";
    return stationLocation(zone) === stationLocation(expectedStation);
  };

  const placeShelfEquipment = (
    definitionId: string,
    zone: string,
    point: { x: number; y: number },
    origin: "pointer" | "vision" = "pointer",
  ) => {
    if (placementMatchesCurrentStep(definitionId, zone)) {
      return runIntent({
        type: "placeIntent",
        origin,
        sourceDefinitionId: definitionId,
        stationId: expectedInteraction?.stationId ?? zone,
        x: point.x,
        y: point.y,
      });
    }
    moveEquipmentToBench(definitionId, zone, point);
    return true;
  };

  const placeEquipment = (definitionItem: EquipmentDefinition) => {
    placeShelfEquipment(definitionItem.id, "workbench", nextPlacementPoint(definitionItem.id));
  };

  const dropEquipment = (
    definitionId: string,
    zone: string,
    point: { x: number; y: number },
    origin: "pointer" | "vision" = "pointer",
  ) => {
    placeShelfEquipment(definitionId, zone, point, origin);
  };

  const movePlacedEquipment = (instanceId: string, point: { x: number; y: number }) => {
    setInteractionFeedback(undefined);
    runtime.performAction({
      verb: "place",
      sourceInstanceId: instanceId,
      location: "workbench",
      parameters: {
        benchMove: true,
        x: point.x,
        y: point.y,
        zIndex: nextZIndex(),
      },
    });
  };

  const dragPlacedEquipmentToZone = (
    instanceId: string,
    stationId: string,
    origin: "pointer" | "vision" = "pointer",
  ): boolean =>
    runIntent({
      type: "placeIntent",
      origin,
      sourceInstanceId: instanceId,
      stationId,
    });

  const expectedTargetDefinition = () =>
    expectedInteraction?.targetDefinitionId ??
    (expectedInteraction?.type === "readInstrument" ? expectedInteraction.stationId : undefined);

  const runObjectInteraction = (
    sourceInstanceId: string,
    targetInstanceId: string,
    point: { x: number; y: number },
    origin: "pointer" | "vision" = "pointer",
  ): boolean => {
    if (!expectedInteraction) return false;
    const source = runtime.state.equipmentInstances.find((instance) => instance.id === sourceInstanceId);
    const target = runtime.state.equipmentInstances.find((instance) => instance.id === targetInstanceId);
    return runIntent({
      type: intentTypeForInteraction[expectedInteraction.type],
      origin,
      sourceInstanceId,
      targetInstanceId,
      sourceDefinitionId: source?.definitionId,
      targetDefinitionId: target?.definitionId,
      stationId: target?.definitionId,
      snapZoneId: expectedInteraction.snapZoneId,
      x: point.x,
      y: point.y,
    } as RuntimeInteractionIntent);
  };

  const reportInvalidOverlap = (sourceInstanceId: string, targetInstanceId: string) => {
    const source = runtime.state.equipmentInstances.find((instance) => instance.id === sourceInstanceId);
    const target = runtime.state.equipmentInstances.find((instance) => instance.id === targetInstanceId);
    const targetMatches = target?.definitionId === expectedTargetDefinition();
    const message = targetMatches
      ? `${source?.label ?? "That item"} is not the expected source for this step.`
      : `${target?.label ?? "That target"} is not the correct target for this step.`;
    setInteractionFeedback({
      reason: targetMatches ? "incompatibleEquipment" : "invalidTarget",
      message,
      recovery: expectedInteraction?.invalidCue ?? runtime.currentNode.feedback.retry,
      nodeId: runtime.currentNode.id,
      actionId: runtime.expectedAction?.id,
    });
    runtime.recordAssessmentFailure(message);
  };

  const runKeyboardFlow = () => {
    if (!expectedInteraction || currentNodeCompleted) return;
    if (expectedInteraction.type === "dispenseDrops") {
      runIntent({
        type: "dispenseDropIntent",
        origin: "keyboard",
      });
      return;
    }
    runIntent({
      type: intentTypeForInteraction[expectedInteraction.type],
      origin: "keyboard",
      sourceInstanceId: selectedSource,
      targetInstanceId: selectedTarget,
    } as RuntimeInteractionIntent);
  };

  const dispenseDrop = (): boolean => {
    if (currentNodeCompleted) return false;
    return runIntent({
      type: "dispenseDropIntent",
      origin: "programmatic",
    });
  };

  const acceptDispenseEndpoint = () => {
    if (currentNodeCompleted) return;
    runIntent({
      type: "dispenseCompleteIntent",
      origin: "programmatic",
    });
  };

  const recordEvidence = () => {
    if (currentNodeCompleted) return;
    runIntent({
      type: "notebookRecordIntent",
      origin: "programmatic",
    });
  };

  const recordTimeSeries = () => {
    if (currentNodeCompleted) return;
    runIntent({
      type: "timeSeriesRecordIntent",
      origin: "programmatic",
    });
  };

  const submitCalculation = () => {
    if (currentNodeCompleted) return;
    runIntent({
      type: "calculationSubmitIntent",
      origin: "programmatic",
    });
  };

  const toggleGoblinMode = () => {
    setGoblinModeStatus(undefined);
    setGoblinModeEnabled((current) => !current);
  };

  const benchSurfaceRect = (): DOMRect | undefined => {
    const surface = playerRootRef.current?.querySelector<HTMLElement>(".bench-surface");
    const rect = surface?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return undefined;
    return rect;
  };

  const benchPointFromGestureCursor = (cursor: GestureCursor): { x: number; y: number } | undefined => {
    const rect = benchSurfaceRect();
    if (!rect) return undefined;
    if (
      cursor.clientX < rect.left ||
      cursor.clientX > rect.right ||
      cursor.clientY < rect.top ||
      cursor.clientY > rect.bottom
    ) {
      return undefined;
    }
    return clientPointToWorkbench(
      { x: cursor.clientX, y: cursor.clientY },
      rect,
      workbenchViewTransformRef.current.zoom,
    );
  };

  const gestureCursorIsInsideStation = (cursor: GestureCursor, stationId: string): boolean => {
    const selector = stationId === "shelf" ? ".equipment-shelf" : `[data-station-id="${stationId}"]`;
    const station = playerRootRef.current?.querySelector<HTMLElement>(selector);
    const rect = station?.getBoundingClientRect();
    return Boolean(
      rect &&
        cursor.clientX >= rect.left &&
        cursor.clientX <= rect.right &&
        cursor.clientY >= rect.top &&
        cursor.clientY <= rect.bottom,
    );
  };

  const clampBenchDragPoint = (
    point: BenchPoint,
    size: Pick<VisionEquipmentGrab, "height" | "width">,
  ): BenchPoint => {
    const rect = benchSurfaceRect();
    if (!rect) return point;
    const transform = workbenchViewTransformRef.current;
    return {
      x: clampValue(point.x, 8, transform.logicalWidth - size.width),
      y: clampValue(point.y, 8, transform.logicalHeight - size.height),
    };
  };

  const benchDragPointForVisionTarget = (
    active: VisionEquipmentTarget,
    cursor: GestureCursor,
  ): BenchPoint | undefined => {
    const point = benchPointFromGestureCursor(cursor);
    if (!point) return undefined;
    return clampBenchDragPoint(
      {
        x: point.x - active.grabOffsetX,
        y: point.y - active.grabOffsetY,
      },
      active,
    );
  };

  const nodeForBenchInstance = (instanceId: string) =>
    renderNodes.find(
      (node) => node.primaryInstanceId === instanceId || node.representedInstanceIds.includes(instanceId),
    );

  const nodeForAttachedChildInstance = (instanceId: string): RenderNode | undefined => {
    const node = nodeForBenchInstance(instanceId);
    const layer = node?.layers.find((candidate) => candidate.instanceId === instanceId);
    const instance = runtime.state.equipmentInstances.find((candidate) => candidate.id === instanceId);
    if (!node || !layer || node.primaryInstanceId === instanceId) return undefined;
    return {
      id: `${instanceId}-attached-child-gesture`,
      representedInstanceIds: [instanceId],
      primaryInstanceId: instanceId,
      layers: [{ ...layer, id: `${layer.id}-attached-child-gesture`, x: 0, y: 0 }],
      transform: { x: 0, y: 0, zIndex: layer.zIndex },
      bounds: { x: 0, y: 0, width: layer.width, height: layer.height },
      footprint: { x: 0, y: 0, width: layer.width, height: layer.height },
      hitBox: { x: 0, y: 0, width: layer.width, height: layer.height },
      accessibleLabel: instance?.label ?? node.accessibleLabel,
      selectionTargetId: instanceId,
    };
  };

  const nodeForProbeInstance = (instanceId: string) => {
    const node = nodeForBenchInstance(instanceId);
    const layer = node?.layers.find((candidate) => candidate.instanceId === instanceId);
    const presentation = layer ? getVisualProfile(layer.definitionId)?.probePresentation : undefined;
    if (!node || !layer || !presentation) return undefined;
    return {
      ...node,
      id: `${instanceId}-probe-gesture`,
      layers: [{
        ...layer,
        id: `${layer.id}-probe-gesture`,
        x: 0,
        y: 0,
        width: presentation.probeSize.width,
        height: presentation.probeSize.height,
      }],
      bounds: { x: 0, y: 0, width: presentation.probeSize.width, height: presentation.probeSize.height },
      footprint: { x: 0, y: 0, width: presentation.probeSize.width, height: presentation.probeSize.height },
      hitBox: { x: 0, y: 0, width: presentation.probeSize.width, height: presentation.probeSize.height },
    };
  };

  const resolveVisionBenchOverlapAtPoint = (
    active: Extract<VisionEquipmentTarget, { kind: "bench" | "attachedChild" | "probe" }>,
    dragPoint: BenchPoint,
  ): BenchOverlapResult | undefined => {
    const sourceNode = nodeForBenchInstance(active.instanceId);
    const draggedNode =
      active.kind === "probe"
        ? nodeForProbeInstance(active.instanceId)
        : active.kind === "attachedChild"
          ? nodeForAttachedChildInstance(active.instanceId)
          : sourceNode;
    if (!sourceNode || !draggedNode) return undefined;
    return resolveBenchOverlap(
      benchBoundsForInteractionSource(
        draggedNode,
        dragPoint,
        runtime.state.equipmentInstances,
        expectedInteraction,
      ),
      renderNodes
        .filter((node) => node.primaryInstanceId !== sourceNode.primaryInstanceId)
        .flatMap((node) =>
          benchTargetBoundsForNode(
            node,
            placedPositions.get(node.primaryInstanceId) ?? node.transform,
            runtime.state.equipmentInstances,
          ),
        )
        .map((bounds) => benchTargetBoundsForInteraction(bounds, expectedInteraction)),
      expectedInteraction,
    );
  };

  const buildVisionDragPreview = (
    active: VisionEquipmentTarget | undefined,
    cursor: GestureCursor,
  ): VisionDragPreview | undefined => {
    if (!active) return undefined;
    const benchPoint = benchDragPointForVisionTarget(active, cursor);
    const rect = benchPoint ? benchSurfaceRect() : undefined;
    const transform = workbenchViewTransformRef.current;
    const previewSize = benchPoint
      ? scaleWorkbenchPreviewSize(active, transform.zoom)
      : active;
    const overlap =
      (active.kind === "bench" || active.kind === "attachedChild" || active.kind === "probe") && benchPoint
        ? resolveVisionBenchOverlapAtPoint(active, benchPoint)
        : undefined;
    return {
      benchPoint,
      definitionId: active.kind === "shelf" ? active.definitionId : undefined,
      grabOffsetX: active.grabOffsetX,
      grabOffsetY: active.grabOffsetY,
      instanceId:
        active.kind === "bench" || active.kind === "attachedChild" || active.kind === "probe"
          ? active.instanceId
          : undefined,
      kind: active.kind,
      label: active.label,
      overlap,
      presentation: active.kind === "probe" ? active.presentation : undefined,
      scale: benchPoint ? transform.zoom : 1,
      viewportPoint:
        benchPoint && rect
          ? workbenchPointToClient(benchPoint, rect, transform.zoom)
          : {
              x: cursor.clientX - active.grabOffsetX,
              y: cursor.clientY - active.grabOffsetY,
            },
      height: previewSize.height,
      width: previewSize.width,
    };
  };

  const resolveVisionBenchOverlap = (
    active: Extract<VisionEquipmentTarget, { kind: "bench" | "attachedChild" | "probe" }>,
    cursor: GestureCursor,
  ):
    | {
        dragPoint: { x: number; y: number };
        overlap: BenchOverlapResult;
      }
    | undefined => {
    const releasePoint = benchDragPointForVisionTarget(active, cursor);
    if (!releasePoint) return undefined;
    const dragPoint = releasePoint;
    const overlap = resolveVisionBenchOverlapAtPoint(active, dragPoint);
    if (!overlap) return undefined;
    return {
      dragPoint,
      overlap,
    };
  };

  const resolveVisionGrab = (
    element: Element,
    cursor: GestureCursor,
  ): GestureGrabResolution<VisionEquipmentTarget> | undefined => {
    const shelfButton = element.closest<HTMLButtonElement>(shelfEquipmentSelector);
    if (shelfButton && !shelfButton.disabled) {
      const definitionId = shelfButton.dataset.definitionId;
      const definition = definitionId ? equipmentById.get(definitionId) : undefined;
      const rect = shelfButton.getBoundingClientRect();
      if (!definitionId || !definition) return { kind: "blocked" };
      const size = getBenchSize(definitionId);
      const grabRatioX =
        rect.width > 0 ? clampValue((cursor.clientX - rect.left) / rect.width, 0, 1) : 0.5;
      const grabRatioY =
        rect.height > 0 ? clampValue((cursor.clientY - rect.top) / rect.height, 0, 1) : 0.5;
      const active: VisionEquipmentTarget = {
        definitionId,
        grabOffsetX: grabRatioX * size.width,
        grabOffsetY: grabRatioY * size.height,
        height: size.height,
        kind: "shelf",
        label: definition.label,
        width: size.width,
      };
      return { grab: active, kind: "grab" };
    }

    const probeHandle = element.closest<HTMLElement>(probeHandleSelector);
    const probeInstanceId = probeHandle?.dataset.instanceId;
    if (probeHandle && probeInstanceId) {
      const presentation = getVisualProfile(probeHandle.dataset.definitionId)?.probePresentation;
      const point = benchPointFromGestureCursor(cursor);
      const node = nodeForBenchInstance(probeInstanceId);
      const layer = node
        ? renderLayersForNode(node, runtime.state.equipmentInstances).find(
            (candidate) => candidate.instance?.id === probeInstanceId,
          )
        : undefined;
      const position = node ? (placedPositions.get(node.primaryInstanceId) ?? node.transform) : undefined;
      if (!presentation || !point || !node || !layer || !position) return { kind: "blocked" };
      const sourceTop = {
        x: position.x + layer.x + layer.width * presentation.sourceGripAnchor.x - presentation.probeSize.width * presentation.probeLeadPort.x,
        y: position.y + layer.y + layer.height * presentation.sourceGripAnchor.y - presentation.probeSize.height * presentation.probeLeadPort.y,
      };
      const active: VisionEquipmentTarget = {
        grabOffsetX: point.x - sourceTop.x,
        grabOffsetY: point.y - sourceTop.y,
        height: presentation.probeSize.height,
        instanceId: probeInstanceId,
        kind: "probe",
        label: "pH probe",
        presentation,
        width: presentation.probeSize.width,
      };
      return { grab: active, kind: "grab" };
    }

    const attachedChildHandle = element.closest<HTMLElement>(attachedChildHandleSelector);
    const attachedChildInstanceId = attachedChildHandle?.dataset.instanceId;
    if (attachedChildHandle && attachedChildInstanceId) {
      const point = benchPointFromGestureCursor(cursor);
      const node = nodeForBenchInstance(attachedChildInstanceId);
      const layer = node?.layers.find((candidate) => candidate.instanceId === attachedChildInstanceId);
      const position = node ? (placedPositions.get(node.primaryInstanceId) ?? node.transform) : undefined;
      const instance = runtime.state.equipmentInstances.find(
        (candidate) => candidate.id === attachedChildInstanceId,
      );
      if (!point || !node || !layer || !position || node.primaryInstanceId === attachedChildInstanceId) {
        return { kind: "blocked" };
      }
      const sourceTop = {
        x: position.x + layer.x,
        y: position.y + layer.y,
      };
      const active: VisionEquipmentTarget = {
        grabOffsetX: point.x - sourceTop.x,
        grabOffsetY: point.y - sourceTop.y,
        height: layer.height,
        instanceId: attachedChildInstanceId,
        kind: "attachedChild",
        label: instance?.label ?? attachedChildHandle.getAttribute("aria-label") ?? node.accessibleLabel,
        width: layer.width,
      };
      return { grab: active, kind: "grab" };
    }

    const benchItem = element.closest<HTMLElement>(workbenchItemSelector);
    const instanceId = benchItem?.dataset.instanceId;
    if (instanceId) {
      const point = benchPointFromGestureCursor(cursor);
      const node = nodeForBenchInstance(instanceId);
      const position = node ? (placedPositions.get(node.primaryInstanceId) ?? node.transform) : undefined;
      if (!point || !node || !position) return { kind: "blocked" };
      const active: VisionEquipmentTarget = {
        grabOffsetX: point.x - position.x,
        grabOffsetY: point.y - position.y,
        height: node.bounds.height,
        instanceId,
        kind: "bench",
        label: node.accessibleLabel,
        width: node.bounds.width,
      };
      return { grab: active, kind: "grab" };
    }

    return undefined;
  };

  const releaseVisionGrab = (active: VisionEquipmentTarget, cursor: GestureCursor) => {
    setVisionDragPreview(undefined);

    if (active.kind === "shelf") {
      const point = benchDragPointForVisionTarget(active, cursor);
      if (point) {
        dropEquipment(active.definitionId, "workbench", point, "vision");
      }
      return;
    }

    if (active.kind === "bench" || active.kind === "attachedChild" || active.kind === "probe") {
      const resolved = resolveVisionBenchOverlap(active, cursor);
      const sourceDefinitionId = runtime.state.equipmentInstances.find(
        (instance) => instance.id === active.instanceId,
      )?.definitionId;
      const expectedDragToZone =
        expectedInteraction?.type === "dragToZone" &&
        expectedInteraction.sourceDefinitionId === sourceDefinitionId
          ? expectedInteraction.stationId
          : undefined;
      if (
        expectedDragToZone &&
        gestureCursorIsInsideStation(cursor, expectedDragToZone) &&
        dragPlacedEquipmentToZone(active.instanceId, expectedDragToZone, "vision")
      ) {
        return;
      }
      if (resolved?.overlap.kind === "valid" && resolved.overlap.target) {
        const snapPoint =
          expectedInteraction?.type === "snapIntoTarget" &&
          expectedInteraction.snapZoneId &&
          sourceDefinitionId
            ? snapPointAligningSourceAnchor(
                resolved.overlap.target,
                sourceDefinitionId,
                expectedInteraction.snapZoneId,
              )
            : undefined;
        runObjectInteraction(
          active.instanceId,
          resolved.overlap.target.id,
          snapPoint ?? resolved.dragPoint,
          "vision",
        );
        return;
      }
      if (resolved?.overlap.kind === "invalid" && resolved.overlap.target) {
        reportInvalidOverlap(active.instanceId, resolved.overlap.target.id);
        return;
      }
      if (resolved && active.kind !== "probe") movePlacedEquipment(active.instanceId, resolved.dragPoint);
    }
  };

  const updateVisionProbeLead = (
    active: Extract<VisionEquipmentTarget, { kind: "probe" }>,
    preview: VisionDragPreview,
  ) => {
    if (!preview.benchPoint) return;
    let lead = gestureProbeLeadElementRef.current;
    if (!lead?.isConnected || lead.dataset.probeLeadInstanceId !== active.instanceId) {
      lead = Array.from(
        playerRootRef.current?.querySelectorAll<SVGSVGElement>(
          ".ph-probe-lead[data-probe-lead-instance-id]",
        ) ?? [],
      ).find((candidate) => candidate.dataset.probeLeadInstanceId === active.instanceId);
      gestureProbeLeadElementRef.current = lead;
    }
    if (!lead) return;
    const from = {
      x: Number(lead.dataset.probeLeadFromX),
      y: Number(lead.dataset.probeLeadFromY),
    };
    if (!Number.isFinite(from.x) || !Number.isFinite(from.y)) return;
    const to = {
      x: preview.benchPoint.x + active.presentation.probeSize.width * active.presentation.probeLeadPort.x,
      y: preview.benchPoint.y + active.presentation.probeSize.height * active.presentation.probeLeadPort.y,
    };
    const pathData = probeLeadPathData(from, to);
    lead.querySelectorAll<SVGPathElement>("path").forEach((path) => path.setAttribute("d", pathData));
  };

  const moveVisionGrab = (active: VisionEquipmentTarget, cursor: GestureCursor) => {
    const preview = buildVisionDragPreview(active, cursor);
    const element = gesturePreviewElementRef.current;
    if (!preview || !element) return;
    element.style.transform = `translate3d(${preview.viewportPoint.x}px, ${preview.viewportPoint.y}px, 0)`;
    element.classList.toggle("is-overlap-valid", preview.overlap?.kind === "valid");
    element.classList.toggle("is-overlap-invalid", preview.overlap?.kind === "invalid");
    const previousPreview = visionDragPreviewRef.current;
    const semanticTargetChanged =
      preview.overlap?.kind !== previousPreview?.overlap?.kind ||
      preview.overlap?.target?.id !== previousPreview?.overlap?.target?.id;
    visionDragPreviewRef.current = preview;
    if (active.kind === "probe") updateVisionProbeLead(active, preview);
    // Continuous cursor, equipment, and probe-lead motion stays on direct DOM transforms. React
    // only needs to reconcile when the overlap target changes and its semantic cue must update.
    if (semanticTargetChanged) setVisionDragPreviewState(preview);
  };

  const gestureEngineDetail =
    gesture.delegate === "none" ? "Starting" : `${gesture.engine} / ${gesture.delegate}`;
  const gestureMetrics = gesture.metrics;
  const gestureRuntimeDetail = [
    gestureMetrics.processedFps > 0 ? `${gestureMetrics.processedFps} FPS` : "FPS pending",
    gestureMetrics.inferenceMs > 0 ? `${gestureMetrics.inferenceMs.toFixed(1)} ms inference` : "inference pending",
    gestureMetrics.captureToCursorMs > 0
      ? `${gestureMetrics.captureToCursorMs.toFixed(1)} ms capture-to-cursor`
      : "capture-to-cursor pending",
    `${Math.round(gestureMetrics.skipRate * 100)}% skipped`,
  ].join(" | ");

  const resetPlayer = () => {
    gestureBridge.cancelScroll();
    gestureBridge.cancel(true);
    gesture.stop();
    setGoblinModeEnabled(false);
    setGoblinModeStatus(undefined);
    setActionInputValues({});
    if (rehearsalBridge.controller) {
      void rehearsalBridge.controller.reset(new AbortController().signal);
    } else {
      runtime.reset();
    }
  };

  const toggleGestureControl = () => {
    if (gesture.enabled) {
      gestureBridge.cancelScroll();
      gestureBridge.cancel(true);
      gesture.stop();
      return;
    }
    gestureBridge.resetRearm();
    void gesture.start();
  };

  gestureBridge.host = {
    blocked: aboutOpen || cameraHelpOpen,
    grabs: {
      begin: (active, cursor) => setVisionDragPreview(buildVisionDragPreview(active, cursor)),
      clear: () => setVisionDragPreview(undefined),
      move: moveVisionGrab,
      release: releaseVisionGrab,
    },
    onRearmChange: (required) =>
      setGestureArbitrationMessage(required ? "Open your hand briefly to re-arm camera control." : undefined),
    resolver: createDomGestureTargetResolver({
      grabAt: resolveVisionGrab,
      hoverSelector: studentPlayerHoverSelector,
      root: () => playerRootRef.current,
    }),
    scrollRoot: () => playerRootRef.current,
  };

  const renderedVisionDragPreview = visionDragPreview
    ? visionDragPreviewRef.current ?? visionDragPreview
    : undefined;
  const visionPreviewDefinition = renderedVisionDragPreview?.definitionId
    ? equipmentById.get(renderedVisionDragPreview.definitionId)
    : undefined;
  const visionPreviewNode = renderedVisionDragPreview?.instanceId
    ? renderedVisionDragPreview.kind === "attachedChild"
      ? nodeForAttachedChildInstance(renderedVisionDragPreview.instanceId)
      : nodeForBenchInstance(renderedVisionDragPreview.instanceId)
    : undefined;
  const visionPreviewInstance = visionPreviewNode
    ? runtime.state.equipmentInstances.find((instance) => instance.id === visionPreviewNode.primaryInstanceId)
    : undefined;
  const visionPreviewOverlapClass =
    renderedVisionDragPreview?.overlap?.kind === "valid"
      ? "is-overlap-valid"
      : renderedVisionDragPreview?.overlap?.kind === "invalid"
        ? "is-overlap-invalid"
        : "";
  const gestureGrabbedShelfDefinitionId =
    renderedVisionDragPreview?.kind === "shelf" ? renderedVisionDragPreview.definitionId : undefined;

  return (
    <PlayerRoot
      ref={(element) => {
        playerRootRef.current = element;
      }}
      className={[
        "student-player",
        compact ? "is-compact" : "",
        isPreviewChrome ? "is-preview-chrome" : "",
        `is-${layoutBand}-layout`,
        equipmentCollapsed ? "is-equipment-collapsed" : "",
        inspectorCollapsed ? "is-inspector-collapsed" : "",
        `is-${inspectorTab}-inspector`,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={compact || isPreviewChrome ? "Student Player preview" : undefined}
    >
      <header className="surface-header">
        <div className="surface-header-copy">
          <div className="surface-title-row">
            <h1>
              {isPreviewChrome ? (
                "Live preview"
              ) : (
                <>
                  <FlaskConical size={22} aria-hidden="true" /> {definition.title}
                </>
              )}
            </h1>
            {!isPreviewChrome ? (
              <button
                ref={aboutButtonRef}
                className="about-button"
                type="button"
                aria-haspopup="dialog"
                aria-expanded={aboutOpen}
                onClick={() => setAboutOpen(true)}
              >
                <Info size={15} aria-hidden="true" /> About
              </button>
            ) : null}
          </div>
          {isPreviewChrome ? (
            <span className="preview-step-label">Step: {runtime.currentNode.title}</span>
          ) : null}
          {previewHint ? <span className="preview-interaction-hint">{previewHint}</span> : null}
        </div>
        <div className="mode-toggle" role="group" aria-label="Player controls">
          {guidedRehearsal ? (
            <span className="player-mode-button is-active" aria-label="Guided rehearsal mode">
              Guided rehearsal
            </span>
          ) : (
            <>
              <button
                aria-pressed={runtime.mode === "guided"}
                className={runtime.mode === "guided" ? "player-mode-button is-active" : "player-mode-button"}
                type="button"
                onClick={() => runtime.setMode("guided")}
              >
                Guided
              </button>
              <button
                aria-pressed={runtime.mode === "assessment"}
                className={runtime.mode === "assessment" ? "player-mode-button is-active" : "player-mode-button"}
                type="button"
                onClick={() => runtime.setMode("assessment")}
              >
                Assessment
              </button>
            </>
          )}
          {goblinModeEligible ? (
            <button
              aria-pressed={goblinModeEnabled}
              className={goblinModeEnabled ? "goblin-mode-toggle is-active" : "goblin-mode-toggle"}
              type="button"
              onClick={toggleGoblinMode}
            >
              <Sparkles size={16} aria-hidden="true" /> Goblin mode
            </button>
          ) : null}
          <button
            type="button"
            className={gesture.enabled ? "camera-control-toggle is-active" : "camera-control-toggle"}
            aria-label="Camera control"
            aria-pressed={gesture.enabled}
            disabled={!gesture.supported}
            onClick={toggleGestureControl}
            title={gesture.supported ? gesture.message : "Camera control requires localhost or HTTPS."}
          >
            {gesture.enabled ? <CameraOff size={16} aria-hidden="true" /> : <Camera size={16} aria-hidden="true" />}
            <span className="camera-control-label-full">Camera</span>
            <span className="camera-control-label-legacy">Camera control</span>
          </button>
          <button
            ref={cameraHelpButtonRef}
            type="button"
            className="camera-help-button"
            aria-label="Camera control help"
            aria-haspopup="dialog"
            aria-expanded={cameraHelpOpen}
            aria-controls={cameraHelpDescriptionId}
            title="How camera control works"
            onClick={() => setCameraHelpOpen(true)}
          >
            <CircleHelp size={16} aria-hidden="true" />
            <span className="camera-help-label">Help</span>
          </button>
          <button className="player-reset-button" type="button" data-gesture-action="reset" onClick={resetPlayer}>
            <RotateCcw size={16} aria-hidden="true" /> Reset
          </button>
        </div>
        {!isPreviewChrome ? (
          <div className="player-header-progress" aria-label="Lab progress">
            <span>Step {currentStepIndex + 1} of {runtime.process.nodes.length}</span>
            <strong>{runtime.state.completedNodes.length} completed</strong>
            <span
              aria-hidden="true"
              className="player-header-progress-track"
              style={{ "--player-progress": `${(runtime.state.completedNodes.length / runtime.process.nodes.length) * 100}%` } as CSSProperties}
            />
          </div>
        ) : null}
      </header>
      {guidedRehearsal ? (
        <section
          className="sr-only"
          aria-label="Guided rehearsal bridge status"
          aria-live="polite"
        >
          <strong>Current-state rehearsal bridge</strong>
          <span>Attempt {guidedRehearsal.attemptId}</span>
          <span>Revision {rehearsalBridge.visibleRevision}</span>
          <span>Assessment actions unavailable</span>
        </section>
      ) : null}
      {gesture.status !== "off" ? (
        <section
          ref={cameraPanelRef}
          className={[
            "gesture-status-panel",
            `is-${gesture.status}`,
            cameraPanelCollapsed ? "is-collapsed" : "",
            cameraPanelDragging ? "is-dragging" : "",
          ].filter(Boolean).join(" ")}
          aria-label="Camera gesture control status"
          style={cameraPanelPosition
            ? {
                left: `${cameraPanelPosition.left}px`,
                right: "auto",
                top: `${cameraPanelPosition.top}px`,
              }
            : undefined}
        >
          <div className="gesture-status-panel__toolbar">
            <button
              aria-label={isPreviewChrome || layoutBand === "mobile"
                ? "Camera control status"
                : "Move camera status panel. Drag or use arrow keys; press Home to restore its default position."}
              className="gesture-status-panel__drag-handle"
              type="button"
              onKeyDown={moveCameraPanelWithKeyboard}
              onLostPointerCapture={() => {
                cameraPanelDragRef.current = undefined;
                setCameraPanelDragging(false);
              }}
              onPointerDown={beginCameraPanelDrag}
              onPointerMove={moveCameraPanel}
              onPointerUp={endCameraPanelDrag}
            >
              <GripHorizontal size={16} aria-hidden="true" />
              <span>Camera control</span>
              <strong>{statusLabelForGesture(gesture.status)}</strong>
            </button>
            <div className="gesture-status-panel__actions">
              {cameraPanelPosition ? (
                <button
                  aria-label="Restore default camera panel position"
                  title="Restore default position"
                  type="button"
                  onClick={() => setCameraPanelPosition(undefined)}
                >
                  <RotateCcw size={14} aria-hidden="true" />
                </button>
              ) : null}
              <button
                aria-controls={cameraPanelBodyId}
                aria-expanded={!cameraPanelCollapsed}
                aria-label={cameraPanelCollapsed ? "Expand camera status panel" : "Collapse camera status panel"}
                title={cameraPanelCollapsed ? "Expand camera panel" : "Collapse camera panel"}
                type="button"
                onClick={() => setCameraPanelCollapsed((collapsed) => !collapsed)}
              >
                {cameraPanelCollapsed
                  ? <ChevronDown size={16} aria-hidden="true" />
                  : <ChevronUp size={16} aria-hidden="true" />}
              </button>
            </div>
          </div>
          <div
            className="gesture-status-panel__body"
            hidden={cameraPanelCollapsed}
            id={cameraPanelBodyId}
          >
            <div className="gesture-status-copy" aria-live="polite">
              <span>Tracking state</span>
              <strong>{statusLabelForGesture(gesture.status)}</strong>
              <small>{gestureArbitrationMessage ?? gesture.message}</small>
            </div>
            <div className="gesture-runtime-metrics" aria-label="Camera tracking runtime">
              <span>{gesture.providerLabel}</span>
              <strong>{gestureEngineDetail}</strong>
              <small>{gestureRuntimeDetail}</small>
            </div>
            <label className="gesture-speed-control">
              <span>Cursor response</span>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={gesture.cursorSpeed}
                aria-label="Cursor response"
                aria-valuetext={labelForGestureCursorSpeed(gesture.cursorSpeed)}
                onChange={(event) => gesture.setCursorSpeed(Number(event.currentTarget.value))}
              />
              <strong>{labelForGestureCursorSpeed(gesture.cursorSpeed)}</strong>
            </label>
            <div className="gesture-preview" aria-hidden="true">
              <video ref={gesture.videoRef} autoPlay muted playsInline />
            </div>
          </div>
        </section>
      ) : null}
      {aboutOpen ? (
        <div
          className="about-dialog-backdrop"
          role="presentation"
          onMouseDown={() => setAboutOpen(false)}
        >
          <section
            className="about-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={aboutTitleId}
            aria-describedby={aboutDescriptionId}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="about-dialog__eyebrow">
              <span>About this lab</span>
              <button
                ref={aboutCloseButtonRef}
                className="about-dialog__close"
                type="button"
                onClick={() => setAboutOpen(false)}
              >
                <X size={16} aria-hidden="true" />
                <span className="sr-only">Close about dialog</span>
              </button>
            </div>
            <h2 id={aboutTitleId}>{definition.title}</h2>
            <p id={aboutDescriptionId}>{definitionDescription}</p>
          </section>
        </div>
      ) : null}
      {cameraHelpOpen ? (
        <div
          className="about-dialog-backdrop"
          role="presentation"
          onMouseDown={() => setCameraHelpOpen(false)}
        >
          <section
            className="about-dialog camera-help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={cameraHelpTitleId}
            aria-describedby={cameraHelpDescriptionId}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="about-dialog__eyebrow">
              <span>Camera control</span>
              <button
                ref={cameraHelpCloseButtonRef}
                className="about-dialog__close"
                type="button"
                onClick={() => setCameraHelpOpen(false)}
              >
                <X size={16} aria-hidden="true" />
                <span className="sr-only">Close camera control help</span>
              </button>
            </div>
            <h2 id={cameraHelpTitleId}>Using camera control</h2>
            <div id={cameraHelpDescriptionId} className="camera-help-dialog__content">
              <section>
                <h3>Requirements</h3>
                <p>Use localhost or HTTPS, allow webcam permission, keep one hand visible, and use steady lighting with enough contrast.</p>
              </section>
              <section>
                <h3>Controls</h3>
                <p>Click Camera control to start or stop. Use Cursor response to balance precision and speed. Reset and leaving the player both stop the camera tracks.</p>
              </section>
              <section>
                <h3>Gestures</h3>
                <p>Steer with your index fingertip. Pinch thumb and index finger to grab or activate, then release over the target. Hold four fingers extended together and wave over a panel to scroll it. Edge-hover scrolling remains available as a fallback.</p>
              </section>
              <section>
                <h3>Where it works</h3>
                <p>Camera control is limited to shelf placement, bench item movement or interactions, and whitelisted current-step controls.</p>
              </section>
              <section>
                <h3>Privacy</h3>
                <p>Frames are processed locally in the browser. They are not saved, exported, serialized to lab state, or sent to the backend.</p>
              </section>
              <section>
                <h3>Fallbacks</h3>
                <p>Mouse, touch, and keyboard stay available. No-hand and unstable-tracking frames do not count as assessment failures. Switching input modes safely cancels an unfinished camera gesture.</p>
              </section>
            </div>
          </section>
        </div>
      ) : null}
      {goblinModeEligible && goblinModeEnabled ? (
        <section className="goblin-mode-panel" aria-label="Goblin mode status" aria-live="polite">
          <div className="goblin-mode-panel__copy">
            <span className="goblin-mode-panel__kicker">Goblin mode</span>
            <strong>Watch the workbench. Goblin mode is handling the next lab step.</strong>
            <span>
              {goblinModeStatus ??
                "The helpers use the same validated lab interactions a student would use."}
            </span>
          </div>
        </section>
      ) : null}
      <GestureCursorOverlay
        blocked={aboutOpen || cameraHelpOpen}
        bridge={gestureBridge}
        enabled={gesture.enabled}
        frames={gesture.frames}
      />
      {renderedVisionDragPreview ? (
        <span
          ref={gesturePreviewElementRef}
          aria-hidden="true"
          className={["gesture-drag-preview", visionPreviewOverlapClass].filter(Boolean).join(" ")}
          data-gesture-drag-preview="true"
          style={{
            left: 0,
            top: 0,
            transform: `translate3d(${renderedVisionDragPreview.viewportPoint.x}px, ${renderedVisionDragPreview.viewportPoint.y}px, 0)`,
            width: renderedVisionDragPreview.width,
            height: renderedVisionDragPreview.height,
          }}
        >
          <span
            className="gesture-drag-preview-visual"
            style={{
              height: renderedVisionDragPreview.height / renderedVisionDragPreview.scale,
              transform: `scale(${renderedVisionDragPreview.scale})`,
              width: renderedVisionDragPreview.width / renderedVisionDragPreview.scale,
            }}
          >
            {renderedVisionDragPreview.kind === "shelf" && visionPreviewDefinition ? (
              <EquipmentView
                definition={visionPreviewDefinition}
                variant="bench"
                decorative
                gestureGrabbed
              />
            ) : renderedVisionDragPreview.kind === "probe" && renderedVisionDragPreview.presentation ? (
              <PhProbeArt presentation={renderedVisionDragPreview.presentation} />
            ) : visionPreviewInstance && visionPreviewNode ? (
              <EquipmentView
                instance={visionPreviewInstance}
                layers={renderLayersForNode(visionPreviewNode, runtime.state.equipmentInstances)}
                variant="bench"
                attachedSummary={visionPreviewNode.attachedSummary}
                decorative
                gestureGrabbed
              />
            ) : (
              <span className="gesture-drag-preview-label">{renderedVisionDragPreview.label}</span>
            )}
          </span>
        </span>
      ) : null}
      <div
        className={`player-grid ${isPreviewChrome ? "is-preview-layout" : ""}`}
        data-gesture-scroll-kind={isPreviewChrome ? "studioPreview" : undefined}
        data-gesture-scroll-region={isPreviewChrome ? "vertical" : undefined}
      >
        <section
          aria-label="Equipment region"
          className="player-equipment-shell"
          id="student-player-equipment-region"
          role={layoutBand === "tablet" && !equipmentCollapsed ? "dialog" : undefined}
        >
          {!isPreviewChrome && !isLegacyMobile ? (
            <button
              aria-controls="student-player-equipment-content"
              aria-expanded={!equipmentCollapsed}
              aria-label={equipmentCollapsed ? "Expand equipment" : "Collapse equipment"}
              className="player-panel-toggle player-equipment-toggle"
              onClick={() => setEquipmentCollapsed((collapsed) => !collapsed)}
              title={equipmentCollapsed ? "Expand equipment" : "Collapse equipment"}
              type="button"
            >
              {equipmentCollapsed ? <PanelLeftOpen size={20} aria-hidden="true" /> : <PanelLeftClose size={20} aria-hidden="true" />}
              <span className="sr-only">{equipmentCollapsed ? "Expand equipment" : "Collapse equipment"}</span>
              <span className="player-panel-tooltip" role="tooltip">
                {equipmentCollapsed ? "Expand equipment" : "Collapse equipment"}
              </span>
            </button>
          ) : null}
          {equipmentCollapsed && !isPreviewChrome && !isLegacyMobile ? (
            <div className="player-collapsed-rail player-equipment-rail" aria-label="Collapsed equipment status">
              <FlaskConical size={19} aria-hidden="true" />
              <span>Equipment</span>
              <strong>
                {showGuidance
                  ? currentStepEquipmentIds.filter((id) => (placedDefinitionCounts[id] ?? 0) === 0).length
                  : placedEquipmentCount}
              </strong>
            </div>
          ) : null}
          <div id="student-player-equipment-content" hidden={equipmentCollapsed && !isPreviewChrome && !isLegacyMobile}>
            <EquipmentShelf
              availableIds={availableIds}
              currentStepEquipmentIds={currentStepEquipmentIds}
              gestureGrabbedDefinitionId={gestureGrabbedShelfDefinitionId}
              hybridPresentation={!isLegacyMobile}
              onPlace={placeEquipment}
              placedCounts={placedDefinitionCounts}
              shelfCounts={shelfDefinitionCounts}
              shelfFitMaxWidth={isPreviewChrome ? undefined : 80}
              showGuidance={showGuidance}
              variant={isPreviewChrome ? "row" : "grid"}
            />
          </div>
        </section>
        <section
          className="player-workbench-shell"
          aria-label="Experiment workspace"
          onPointerDownCapture={() => {
            lastActionSurfaceRef.current = "workbench";
          }}
        >
          <Workbench
            expectedInteraction={activeExpectedInteraction}
            gestureDrag={
              (renderedVisionDragPreview?.kind === "bench" ||
                renderedVisionDragPreview?.kind === "attachedChild" ||
                renderedVisionDragPreview?.kind === "probe") && renderedVisionDragPreview.instanceId
                ? {
                    kind:
                      renderedVisionDragPreview.kind === "probe"
                        ? "probe"
                        : renderedVisionDragPreview.kind === "attachedChild"
                          ? "attachedChild"
                          : "equipment",
                    instanceId: renderedVisionDragPreview.instanceId,
                    point: renderedVisionDragPreview.benchPoint,
                  }
                : undefined
            }
            goblinMode={{
              actionId: runtime.expectedAction?.id,
              enabled: goblinModeEnabled && !goblinModeComplete,
              interactionType: expectedInteraction?.type,
            }}
            state={runtime.state}
            selectedSource={selectedSource}
            selectedTarget={selectedTarget}
            onDropEquipment={dropEquipment}
            onDragToZone={dragPlacedEquipmentToZone}
            onInvalidOverlap={reportInvalidOverlap}
            onMoveInstance={movePlacedEquipment}
            onObjectInteraction={runObjectInteraction}
            onDispenseDrop={dispenseDrop}
            onSelectSource={setSelectedSource}
            onSelectTarget={setSelectedTarget}
            onViewTransformChange={(transform) => {
              workbenchViewTransformRef.current = transform;
            }}
            showGuidance={showGuidance}
          />
          {!isLegacyMobile ? (
            <PlayerUtilityStrip
              activeView={evidenceView}
              feedbackCount={runtime.state.feedbackQueue.length}
              notebookCount={runtime.state.notebook.length}
              onSelect={(view) => {
                setEvidenceView(view);
                setInspectorTab("evidence");
                setInspectorCollapsed(false);
              }}
              resultsCount={resultsCount}
              status={utilityStatus.state}
              statusDetail={utilityStatus.detail}
            />
          ) : null}
        </section>
        <section
          aria-label="Current action inspector"
          className="player-inspector-shell"
          id="student-player-inspector-region"
          onClickCapture={() => {
            lastActionSurfaceRef.current = "inspector";
          }}
          onKeyDownCapture={() => {
            lastActionSurfaceRef.current = "inspector";
          }}
          role={layoutBand === "tablet" && inspectorTab !== "now" ? "dialog" : undefined}
        >
          {!isPreviewChrome && !isLegacyMobile ? (
            <button
              aria-controls="student-player-inspector-content"
              aria-expanded={!inspectorCollapsed}
              aria-label={inspectorCollapsed ? "Expand inspector" : "Collapse inspector"}
              className="player-panel-toggle player-inspector-toggle"
              onClick={() => setInspectorCollapsed((collapsed) => !collapsed)}
              title={inspectorCollapsed ? "Expand inspector" : "Collapse inspector"}
              type="button"
            >
              {inspectorCollapsed ? <PanelRightOpen size={20} aria-hidden="true" /> : <PanelRightClose size={20} aria-hidden="true" />}
              <span className="sr-only">{inspectorCollapsed ? "Expand inspector" : "Collapse inspector"}</span>
              <span className="player-panel-tooltip" role="tooltip">
                {inspectorCollapsed ? "Expand inspector" : "Collapse inspector"}
              </span>
            </button>
          ) : null}
          {inspectorCollapsed && !isPreviewChrome && !isLegacyMobile ? (
            <nav className="player-collapsed-rail player-inspector-rail" aria-label="Collapsed inspector sections">
              {(["now", "process", "evidence"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setInspectorTab(tab);
                    setInspectorCollapsed(false);
                  }}
                  title={`Open ${tab}`}
                  type="button"
                >
                  {tab === "now" ? <CheckCircle2 size={18} aria-hidden="true" /> : <span aria-hidden="true">{tab === "process" ? "P" : "E"}</span>}
                  <span className="sr-only">Open {tab}</span>
                  <strong>{tab === "now" ? currentStepIndex + 1 : tab === "process" ? runtime.state.completedNodes.length : evidenceCount}</strong>
                </button>
              ))}
            </nav>
          ) : null}
          <div id="student-player-inspector-content" hidden={inspectorCollapsed && !isPreviewChrome && !isLegacyMobile}>
            <ProcessSidebar
              activeTab={inspectorTab}
              action={runtime.expectedAction}
              actionInputValue={currentActionInputValue}
              currentNode={runtime.currentNode}
              evidenceCount={evidenceCount}
              evidenceContent={
                <div
                  className="inspector-evidence-content"
                  data-gesture-scroll-kind="status"
                  data-gesture-scroll-region="vertical"
                >
                  <div className="evidence-view-tabs" role="tablist" aria-label="Evidence type">
                    {(["feedback", "notebook", "results"] as const).map((view) => (
                      <button
                        aria-selected={evidenceView === view}
                        className={evidenceView === view ? "is-active" : undefined}
                        key={view}
                        onClick={() => setEvidenceView(view)}
                        role="tab"
                        type="button"
                      >
                        {view === "feedback" ? "Feedback" : view === "notebook" ? "Notebook" : "Results"}
                        <strong>
                          {view === "feedback"
                            ? runtime.state.feedbackQueue.length
                            : view === "notebook"
                              ? runtime.state.notebook.length
                              : resultsCount}
                        </strong>
                      </button>
                    ))}
                  </div>
                  <div className="evidence-view-panel" role="tabpanel">
                    {evidenceView === "feedback" ? <FeedbackPanel announce={false} state={runtime.state} /> : null}
                    {evidenceView === "notebook" ? <NotebookPanel state={runtime.state} /> : null}
                    {evidenceView === "results" ? <ResultsPanel state={runtime.state} /> : null}
                  </div>
                </div>
              }
              hybrid={!isLegacyMobile}
              interaction={expectedInteraction}
              invalidFeedback={interactionFeedback}
              nodeCompleted={currentNodeCompleted}
              onAcceptDispenseEndpoint={acceptDispenseEndpoint}
              onActionInputChange={(value) => {
                if (!currentActionInputField) return;
                setActionInputValues((current) => ({
                  ...current,
                  [currentActionInputField.key]: value,
                }));
                setInteractionFeedback(undefined);
              }}
              onConfirmAccessibleAction={runKeyboardFlow}
              onDispenseDrop={dispenseDrop}
              onRecordEvidence={recordEvidence}
              onRecordTimeSeries={recordTimeSeries}
              onSubmitCalculation={submitCalculation}
              onTabChange={(tab) => {
                setInspectorTab(tab);
                setInspectorCollapsed(false);
              }}
              previewNotice={previewNotice}
              process={runtime.process}
              selectedSource={selectedSource}
              selectedTarget={selectedTarget}
              showGuidance={showGuidance}
              state={runtime.state}
            />
          </div>
        </section>
        {isLegacyMobile ? (
          <section
            className="status-panels"
            aria-label="Lab evidence and status"
            data-gesture-scroll-kind="status"
            data-gesture-scroll-region="vertical"
          >
            <FeedbackPanel state={runtime.state} />
            <NotebookPanel state={runtime.state} />
            <ResultsPanel state={runtime.state} />
          </section>
        ) : null}
      </div>
    </PlayerRoot>
  );
};
