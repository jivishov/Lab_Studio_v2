import {
  type CSSProperties,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { GitBranch, PanelRightClose, PanelRightOpen, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { createStudioAssistantAdapter } from "../assistant/studioPageAdapter";
import { loadBundledLab } from "../data/loadBundledLabs";
import { loadBundledTechnique } from "../data/loadBundledTechniques";
import { configurationSlots } from "../data/techniqueConfiguration";
import type {
  ActionDefinition,
  ContentState,
  EquipmentInstance,
  LabDefinition,
  ProcessEdge,
  ProcessNode,
  RuntimeInvalidCase,
} from "../domain/types";
import { emptyContents } from "../domain/types";
import { createEquipmentInstance, equipmentById, v1EquipmentCatalog } from "../equipment/catalog";
import { defaultLabInventory } from "../experimentComposer/catalogs";
import { useComposerSession } from "../experimentComposer/useComposerSession";
import {
  stageGuardIdentity,
  stageGuardsMatch,
  type ExperimentRequest,
  type RehearsalController,
  type StagedExperiment,
} from "../experimentComposer/types";
import { GuidedRehearsalOverlay } from "../player/GuidedRehearsalOverlay";
import { runProtocolCheck } from "../protocolCheck/runProtocolCheck";
import { createStudioToolSet } from "../webmcp/studioTools";
import { createRehearsalToolSet } from "../webmcp/rehearsalTools";
import type { JsonValue, WebMCPResult } from "../webmcp/result";
import {
  useWebMCPRegistry,
  type WebMCPRegistryHandle,
} from "../webmcp/useWebMCPRegistry";
import { autoLayoutProcessMap } from "./autoLayoutProcessMap";
import { normalizeStudioLabDraft } from "./draftNormalizer";
import { downloadJson, parseImportedJson } from "./importExport";
import { ExperimentComposerDrawer } from "./ExperimentComposerDrawer";
import { NodeInspector } from "./NodeInspector";
import { NodePalette } from "./NodePalette";
import { ProcessOutline } from "./ProcessOutline";
import { PreviewPanel } from "./PreviewPanel";
import { ProcessMap } from "./ProcessMap";
import { StudioCommandHeader, type StudioStage } from "./StudioCommandHeader";
import { StudioResizeHandle } from "./StudioResizeHandle";
import { loadDraftArtifact, saveDraft } from "./persistence";
import {
  artifactKindLabels,
  createBlankStudioLab,
  createBlankStudioTechniqueLab,
  labDraftFromTechnique,
  serializeStudioArtifact,
  studioArtifactFilename,
  type StudioArtifactKind,
} from "./studioArtifact";
import {
  assessStudioReadiness,
  isExportReadyReadiness,
  isRunnableReadiness,
} from "./studioReadiness";
import {
  commitStudioTransaction,
  createInitialStudioRevision,
  createStudioIdAllocator,
  type StudioTransaction,
  type StudioTransactionResult,
  type StudioOperation,
} from "./studioTransactions";
import { collectStudioInteractionIssues } from "./studioValidation";
import "../styles/studio-process.css";
import {
  appendTechniqueToDraft,
  createDraftFromDemo,
  studioTemplates,
  type InsertTemplateStepOptions,
  type StudioTemplate,
} from "./studioState";

type WorkspaceLayout = "split" | "tabs";

const StudioAssistantPanel = lazy(() =>
  import("../assistant/StudioAssistant").then(({ StudioAssistant }) => ({
    default: StudioAssistant,
  })),
);

const STUDIO_LAYOUT_STORAGE_KEY = "lab-studio:v1:studio-layout";
const STUDIO_SPLIT_STORAGE_KEY = "lab-studio:v2:studio-split";
const STUDIO_INSPECTOR_WIDTH_STORAGE_KEY = "lab-studio:v1:inspector-width";
const DEFAULT_SPLIT_PERCENT = 60;
const MIN_SPLIT_PERCENT = 56;
const MAX_SPLIT_PERCENT = 68;
const MIN_PERSISTED_SPLIT_PERCENT = 56;
const DEFAULT_INSPECTOR_WIDTH = 360;
const MIN_INSPECTOR_WIDTH = 320;
const MAX_INSPECTOR_WIDTH = 520;
const DEFAULT_STAGE_SIDEBAR_WIDTH = 396;
const MIN_STAGE_SIDEBAR_WIDTH = 300;
const MAX_STAGE_SIDEBAR_WIDTH = 480;
const MAX_SPLIT_STAGE_SIDEBAR_WIDTH = 300;

const isWorkspaceLayout = (value: string | null): value is WorkspaceLayout =>
  value === "split" || value === "tabs";

const clampSplitPercent = (value: number) =>
  Math.min(MAX_SPLIT_PERCENT, Math.max(MIN_SPLIT_PERCENT, value));

const clampStageSidebarWidth = (value: number, max = MAX_STAGE_SIDEBAR_WIDTH) =>
  Math.min(max, Math.max(MIN_STAGE_SIDEBAR_WIDTH, value));

const loadWorkspaceLayout = (): WorkspaceLayout => {
  try {
    const savedLayout = window.localStorage.getItem(STUDIO_LAYOUT_STORAGE_KEY);
    return isWorkspaceLayout(savedLayout) ? savedLayout : "tabs";
  } catch {
    return "tabs";
  }
};

const saveWorkspaceLayout = (layout: WorkspaceLayout) => {
  try {
    window.localStorage.setItem(STUDIO_LAYOUT_STORAGE_KEY, layout);
  } catch {
    // The view preference is non-essential; authoring should keep working without storage.
  }
};

const loadSplitPercent = () => {
  try {
    const savedRawValue = window.localStorage.getItem(STUDIO_SPLIT_STORAGE_KEY);
    if (!savedRawValue) return DEFAULT_SPLIT_PERCENT;
    const savedValue = Number(savedRawValue);
    if (!Number.isFinite(savedValue)) return DEFAULT_SPLIT_PERCENT;
    const clampedValue = clampSplitPercent(savedValue);
    return clampedValue < MIN_PERSISTED_SPLIT_PERCENT ? DEFAULT_SPLIT_PERCENT : clampedValue;
  } catch {
    return DEFAULT_SPLIT_PERCENT;
  }
};

const saveSplitPercent = (value: number) => {
  try {
    if (value < MIN_PERSISTED_SPLIT_PERCENT) {
      window.localStorage.removeItem(STUDIO_SPLIT_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STUDIO_SPLIT_STORAGE_KEY, String(Math.round(value)));
  } catch {
    // The view preference is non-essential; authoring should keep working without storage.
  }
};

const clampInspectorWidth = (value: number) =>
  Math.min(MAX_INSPECTOR_WIDTH, Math.max(MIN_INSPECTOR_WIDTH, value));

const loadInspectorWidth = () => {
  try {
    const savedRawValue = window.localStorage.getItem(STUDIO_INSPECTOR_WIDTH_STORAGE_KEY);
    if (!savedRawValue) return DEFAULT_INSPECTOR_WIDTH;
    const savedValue = Number(savedRawValue);
    return Number.isFinite(savedValue) ? clampInspectorWidth(savedValue) : DEFAULT_INSPECTOR_WIDTH;
  } catch {
    return DEFAULT_INSPECTOR_WIDTH;
  }
};

const saveInspectorWidth = (value: number) => {
  try {
    window.localStorage.setItem(STUDIO_INSPECTOR_WIDTH_STORAGE_KEY, String(Math.round(value)));
  } catch {
    // The view preference is non-essential; authoring should keep working without storage.
  }
};

const useNarrowStudioWorkspace = () => {
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window.matchMedia === "function"
      ? window.matchMedia("(max-width: 1100px)").matches
      : false,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(max-width: 1100px)");
    const updateNarrowState = () => setIsNarrow(query.matches);
    updateNarrowState();
    query.addEventListener("change", updateNarrowState);
    return () => query.removeEventListener("change", updateNarrowState);
  }, []);

  return isNarrow;
};

interface StudioHistoryEntry {
  draft: LabDefinition;
  label: string;
  revision: string;
  selectedNodeId: string;
  artifactKind: StudioArtifactKind;
}

interface GuidedRehearsalSession {
  attemptId: string;
  stageId: string;
  definition: LabDefinition;
}

interface PendingRehearsalController {
  attemptId: string;
  resolve: (controller: RehearsalController) => void;
}

const waitForSignal = async <T,>(promise: Promise<T>, signal: AbortSignal): Promise<T> => {
  if (signal.aborted) throw signal.reason;
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    void promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
};

const listFromText = (value: string): string[] =>
  value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

const contentKinds: ContentState["kind"][] = [
  "empty",
  "liquid",
  "solid",
  "solution",
  "mixture",
  "precipitate",
];

const equipmentLocations: EquipmentInstance["location"][] = [
  "shelf",
  "workbench",
  "snapZone",
  "oven",
  "storage",
];

const firstTechniqueSettings = (draft: LabDefinition) => draft.techniques[0];

const techniqueGoal = (draft: LabDefinition): string =>
  firstTechniqueSettings(draft)?.learningGoal ?? draft.learningGoals[0] ?? draft.description;

const commonMistakesText = (draft: LabDefinition): string =>
  (firstTechniqueSettings(draft)?.commonMistakes ?? [])
    .map((mistake) => `${mistake.when} | ${mistake.message} | ${mistake.recovery}`)
    .join("\n");

const commonMistakesFromText = (value: string): RuntimeInvalidCase[] =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [when, message, recovery] = line.split("|").map((part) => part.trim());
      return {
        id: `mistake-${index + 1}`,
        when: when || message || line,
        message: message || when || line,
        recovery: recovery || "Review the technique instructions, then retry the step.",
      };
    });

const optionalNumber = (value: string): number | undefined => {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const updateContents = (
  contents: ContentState,
  patch: Partial<Pick<ContentState, "kind" | "label" | "volumeMl" | "massG" | "temperatureC" | "wetState">>,
): ContentState => ({
  ...contents,
  ...patch,
  label: patch.label ?? contents.label,
  solutes: contents.solutes ?? [],
  contamination: contents.contamination ?? [],
});

export const TeacherStudio = () => {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const selectedStepPanelRef = useRef<HTMLElement>(null);
  const collapsedInspectorButtonRef = useRef<HTMLButtonElement>(null);
  const initialRevisionRef = useRef(createInitialStudioRevision());
  const committedIdempotencyKeysRef = useRef(new Set<string>());
  const initialSavedDraft = useMemo(() => loadDraftArtifact(), []);
  const [draft, setDraft] = useState<LabDefinition>(() => initialSavedDraft?.draft ?? createDraftFromDemo());
  const [selectedNodeId, setSelectedNodeId] = useState<string>(draft.process.startNodeId);
  const [selectedNodeFocusVersion, setSelectedNodeFocusVersion] = useState(0);
  const [importMessage, setImportMessage] = useState<string>("");
  const [importRepairErrors, setImportRepairErrors] = useState<string[]>([]);
  const [artifactKind, setArtifactKind] = useState<StudioArtifactKind>(initialSavedDraft?.artifactKind ?? "lab");
  const [revision, setRevision] = useState(initialRevisionRef.current);
  const [savedRevision, setSavedRevision] = useState(initialRevisionRef.current);
  const [undoStack, setUndoStack] = useState<StudioHistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<StudioHistoryEntry[]>([]);
  const [detailsViewVersion, setDetailsViewVersion] = useState(0);
  const [activeStage, setActiveStage] = useState<StudioStage>("process");
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const [inspectorLibraryOptions, setInspectorLibraryOptions] = useState<InsertTemplateStepOptions | null>(null);
  const [setupOpen, setSetupOpen] = useState(true);
  const [advancedSetupOpen, setAdvancedSetupOpen] = useState(false);
  const [workspaceLayout, setWorkspaceLayout] = useState<WorkspaceLayout>(loadWorkspaceLayout);
  const [splitPanePercent, setSplitPanePercent] = useState(loadSplitPercent);
  const [inspectorWidth, setInspectorWidth] = useState(loadInspectorWidth);
  const [stageSidebarWidth, setStageSidebarWidth] = useState(DEFAULT_STAGE_SIDEBAR_WIDTH);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [isInspectorPinned, setIsInspectorPinned] = useState(true);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [equipmentToAdd, setEquipmentToAdd] = useState(v1EquipmentCatalog[0]?.id ?? "");
  const [pendingEntryTemplate, setPendingEntryTemplate] = useState<StudioTemplate | null>(null);
  const aboutTitleId = useId();
  const aboutDescriptionId = useId();
  const selectedStepEditorBodyId = useId();
  const isNarrowWorkspace = useNarrowStudioWorkspace();
  const selectedNode = useMemo(
    () => draft.process.nodes.find((node) => node.id === selectedNodeId),
    [draft.process.nodes, selectedNodeId],
  );
  const readiness = useMemo(() => assessStudioReadiness(draft), [draft]);
  const canPreview = isRunnableReadiness(readiness);
  const canExport = isExportReadyReadiness(readiness);
  const [lastRunnableDraft, setLastRunnableDraft] = useState<LabDefinition>(draft);
  const interactionIssues = useMemo(() => collectStudioInteractionIssues(draft), [draft]);
  const hasUnsavedChanges = savedRevision !== revision;
  const isSplitVisible = activeStage === "process" && workspaceLayout === "split" && !isNarrowWorkspace;
  const previewPaneLabel = activeStage === "preview" ? "Preview and validation workbench" : "In-context live preview";
  const showStudioPane = activeStage !== "preview";
  const showDraftPane = activeStage === "preview" || isSplitVisible;
  const appliedStageSidebarWidth = clampStageSidebarWidth(
    stageSidebarWidth,
    isSplitVisible ? MAX_SPLIT_STAGE_SIDEBAR_WIDTH : MAX_STAGE_SIDEBAR_WIDTH,
  );

  const focusNodeInPreview = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setIsInspectorOpen(true);
    setSelectedNodeFocusVersion((current) => current + 1);
  };

  const commitTransaction = (
    label: string,
    operations: StudioOperation[],
    options: { message?: string; selectedNodeId?: string; artifactKind?: StudioArtifactKind } = {},
  ) => {
    const result = commitStudioTransaction(
      draft,
      revision,
      {
        baseRevision: revision,
        idempotencyKey: `${label}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
        label,
        operations,
      },
      committedIdempotencyKeysRef.current,
    );

    if (!result.ok) {
      setImportMessage(result.error ?? `Unable to ${label.toLowerCase()}.`);
      return result;
    }

    if (!result.idempotent) {
      setUndoStack((current) => [
        ...current,
        { draft, label, revision, selectedNodeId, artifactKind },
      ]);
      setRedoStack([]);
      setDraft(result.draft);
      setRevision(result.revision);
    }
    if (options.selectedNodeId !== undefined) {
      setSelectedNodeId(options.selectedNodeId);
    } else if (!result.draft.process.nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(result.draft.process.startNodeId || result.draft.process.nodes[0]?.id || "");
    }
    if (options.artifactKind) setArtifactKind(options.artifactKind);
    if (options.message) setImportMessage(options.message);
    return result;
  };

  const commitAssistantTransaction = (transaction: StudioTransaction): StudioTransactionResult => {
    const result = commitStudioTransaction(draft, revision, transaction, committedIdempotencyKeysRef.current);

    if (!result.ok) {
      setImportMessage(result.error ?? `Unable to ${transaction.label.toLowerCase()}.`);
      return result;
    }

    if (!result.idempotent) {
      setUndoStack((current) => [
        ...current,
        { draft, label: transaction.label, revision, selectedNodeId, artifactKind },
      ]);
      setRedoStack([]);
      setDraft(result.draft);
      setRevision(result.revision);
    }
    if (!result.draft.process.nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(result.draft.process.startNodeId || result.draft.process.nodes[0]?.id || "");
    }
    setImportMessage(`${transaction.label} committed by assistant.`);
    return result;
  };

  const commitDraftUpdater = (
    label: string,
    updater: (current: LabDefinition) => LabDefinition,
    message?: string,
  ) => commitTransaction(label, [{ type: "replaceDraft", draft: updater(draft) }], { message });

  const [rehearsalSession, setRehearsalSession] = useState<GuidedRehearsalSession>();
  const rehearsalSessionRef = useRef<GuidedRehearsalSession | undefined>(undefined);
  rehearsalSessionRef.current = rehearsalSession;
  const rehearsalOpeningRef = useRef(false);
  const rehearsalAttemptRef = useRef(0);
  const protocolRunRef = useRef(0);
  const rehearsalControllerRef = useRef<RehearsalController | undefined>(undefined);
  const pendingRehearsalControllerRef = useRef<PendingRehearsalController | undefined>(undefined);
  const registryRef = useRef<WebMCPRegistryHandle | undefined>(undefined);
  const studioToolSetRef = useRef<ReturnType<typeof createStudioToolSet> | undefined>(undefined);
  const composerControllerRef = useRef<ReturnType<typeof useComposerSession>["controller"] | undefined>(undefined);
  const setProtocolReportRef = useRef<ReturnType<typeof useComposerSession>["setProtocolReport"] | undefined>(undefined);

  const onRehearsalControllerChange = useCallback((controller: RehearsalController | undefined) => {
    rehearsalControllerRef.current = controller;
    const pending = pendingRehearsalControllerRef.current;
    if (!controller || !pending || pending.attemptId !== rehearsalSession?.attemptId) return;
    pendingRehearsalControllerRef.current = undefined;
    pending.resolve(controller);
  }, [rehearsalSession?.attemptId]);

  const clearRehearsalSession = useCallback((attemptId?: string) => {
    if (attemptId && rehearsalSessionRef.current?.attemptId !== attemptId) return;
    if (!attemptId || pendingRehearsalControllerRef.current?.attemptId === attemptId) {
      pendingRehearsalControllerRef.current = undefined;
    }
    rehearsalControllerRef.current = undefined;
    rehearsalSessionRef.current = undefined;
    setRehearsalSession((current) => !attemptId || current?.attemptId === attemptId ? undefined : current);
  }, []);

  const exactCurrentStage = useCallback((stage: StagedExperiment): boolean => {
    const current = composerControllerRef.current?.getStage();
    return Boolean(
      current
      && current.staleReasons.length === 0
      && stageGuardsMatch(stageGuardIdentity(current), stageGuardIdentity(stage)),
    );
  }, []);

  const restoreStudioSurface = useCallback(async (
    attemptId?: string,
  ): Promise<{ ok: boolean; message: string }> => {
    const registry = registryRef.current;
    const destination = studioToolSetRef.current;
    if (registry && destination) {
      const registration = await registry.activate(destination);
      if (registration.status === "error") {
        return {
          ok: false,
          message: `Studio tools could not be restored${registration.error ? `: ${registration.error}` : "."} Rehearsal remains open; retry Close rehearsal.`,
        };
      }
    }
    clearRehearsalSession(attemptId);
    return { ok: true, message: "Studio tools are ready and the transient rehearsal is closed." };
  }, [clearRehearsalSession]);

  const startRehearsalDelegate = useCallback(async (
    stage: StagedExperiment,
    signal: AbortSignal,
  ): Promise<WebMCPResult<JsonValue>> => {
    const revision = composerControllerRef.current?.getRevision() ?? 0;
    if (signal.aborted) {
      return {
        ok: false,
        code: "ABORTED",
        message: "Rehearsal opening was cancelled before the visible overlay changed.",
        state: { surface: "studio", revision },
      };
    }
    if (rehearsalOpeningRef.current || rehearsalSessionRef.current) {
      return {
        ok: false,
        code: "REHEARSAL_ALREADY_OPEN",
        message: "A guided rehearsal is already opening or visible. Inspect or close that attempt instead of replaying the start call.",
        state: { surface: "studio", revision },
      };
    }
    rehearsalOpeningRef.current = true;
    try {
    const attemptId = `stage-${stage.stageRevision}-attempt-${rehearsalAttemptRef.current + 1}`;
    rehearsalAttemptRef.current += 1;
    let resolveController: (controller: RehearsalController) => void = () => undefined;
    const controllerReady = new Promise<RehearsalController>((resolve) => {
      resolveController = resolve;
    });
    pendingRehearsalControllerRef.current = { attemptId, resolve: resolveController };
    const nextSession = {
      attemptId,
      stageId: stage.stageId,
      definition: structuredClone(stage.definition),
    };
    rehearsalSessionRef.current = nextSession;
    setRehearsalSession(nextSession);

    let controller: RehearsalController;
    try {
      controller = await waitForSignal(controllerReady, signal);
    } catch {
      clearRehearsalSession(attemptId);
      return {
        ok: false,
        code: "ABORTED",
        message: "Rehearsal opening was cancelled before the Player bridge became visible.",
        state: { surface: "studio", revision: composerControllerRef.current?.getRevision() ?? revision },
      };
    }

    if (!exactCurrentStage(stage)) {
      clearRehearsalSession(attemptId);
      return {
        ok: false,
        code: "REHEARSAL_STAGE_INVALIDATED",
        message: "The stage changed while the Player bridge was opening. Rehearsal was closed before destination tools were registered; inspect and restage.",
        state: { surface: "studio", revision: composerControllerRef.current?.getRevision() ?? revision },
      };
    }

    const rehearsalToolSet = createRehearsalToolSet(controller);
    const registry = registryRef.current;
    if (!rehearsalToolSet || !registry) {
      clearRehearsalSession(attemptId);
      return {
        ok: false,
        code: "REHEARSAL_BRIDGE_UNAVAILABLE",
        message: "The guided Player bridge did not expose the complete rehearsal surface; Studio remained active.",
        state: { surface: "studio", revision: composerControllerRef.current?.getRevision() ?? revision },
      };
    }

    const registration = await registry.activate(rehearsalToolSet);
    if (registration.status === "error") {
      clearRehearsalSession(attemptId);
      return {
        ok: false,
        code: "REHEARSAL_REGISTRATION_FAILED",
        message: registration.error ?? "Rehearsal tools could not be registered; the visible surface rolled back to Studio.",
        state: { surface: "studio", revision: composerControllerRef.current?.getRevision() ?? revision },
      };
    }
    if (registration.status === "unsupported") {
      if (!exactCurrentStage(stage)) {
        clearRehearsalSession(attemptId);
        return {
          ok: false,
          code: "REHEARSAL_STAGE_INVALIDATED",
          message: "The stage changed while the visible human-only rehearsal was opening. Rehearsal was closed; inspect and restage.",
          state: { surface: "studio", revision: composerControllerRef.current?.getRevision() ?? revision },
        };
      }
      if (signal.aborted) {
        return {
          ok: false,
          code: "VISIBLE_STATE_ACK_ABORTED",
          message: "The human-only rehearsal became visible, but acknowledgement was cancelled. Inspect it before acting; do not replay the start call.",
          data: { attemptId, stageId: stage.stageId },
          state: { surface: "studio", revision: composerControllerRef.current?.getRevision() ?? revision },
        };
      }
      return {
        ok: true,
        code: "REHEARSAL_OPENED_WITHOUT_WEBMCP",
        message: "The transient guided rehearsal is visible. This browser has no WebMCP surface, so use the visible Player controls.",
        data: { attemptId, stageId: stage.stageId },
        state: { surface: "studio", revision: composerControllerRef.current?.getRevision() ?? revision },
      };
    }
    if (!exactCurrentStage(stage)) {
      void Promise.resolve().then(() => restoreStudioSurface(attemptId));
      return {
        ok: false,
        code: "REHEARSAL_STAGE_INVALIDATED_AFTER_READY",
        message: "The stage changed as rehearsal became ready. No rehearsal success was recorded, and automatic Studio restoration is queued; inspect the visible surface before acting.",
        data: { attemptId, stageId: stage.stageId },
        state: { surface: "rehearsal", revision: controller.getRevision() },
      };
    }
    if (signal.aborted) {
      return {
        ok: false,
        code: "VISIBLE_STATE_ACK_ABORTED",
        message: "The rehearsal overlay and destination tools became ready, but acknowledgement was cancelled. Inspect the rehearsal before acting; do not replay the start call.",
        data: { attemptId, stageId: stage.stageId },
        state: { surface: "rehearsal", revision: controller.getRevision() },
      };
    }
    return {
      ok: true,
      code: "REHEARSAL_READY",
      message: "The transient guided rehearsal is visible and all six destination tools are ready. The Studio source registry will retire after this call settles.",
      data: { attemptId, stageId: stage.stageId, rehearsalRevision: controller.getRevision() },
      state: { surface: "rehearsal", revision: controller.getRevision() },
    };
    } finally {
      rehearsalOpeningRef.current = false;
    }
  }, [clearRehearsalSession, exactCurrentStage, restoreStudioSurface]);

  const runProtocolCheckDelegate = useCallback(async (
    stage: StagedExperiment,
    signal: AbortSignal,
  ): Promise<WebMCPResult<JsonValue>> => {
    const protocolRun = protocolRunRef.current + 1;
    protocolRunRef.current = protocolRun;
    const outcome = await runProtocolCheck(structuredClone(stage), signal);
    const revision = composerControllerRef.current?.getRevision() ?? 0;
    if (outcome.status === "aborted") {
      return {
        ok: false,
        code: "PROTOCOL_CHECK_ABORTED",
        message: outcome.message,
        state: { surface: "studio", revision },
      };
    }
    if (signal.aborted) {
      return {
        ok: false,
        code: "PROTOCOL_CHECK_ABORTED",
        message: "Protocol Check was cancelled before its completed report could be stored. The prior completed report remains unchanged.",
        state: { surface: "studio", revision },
      };
    }
    if (protocolRun !== protocolRunRef.current) {
      return {
        ok: false,
        code: "PROTOCOL_CHECK_SUPERSEDED",
        message: "A newer Protocol Check superseded this run. No report from the older run was stored; inspect the current stage before retrying.",
        state: { surface: "studio", revision },
      };
    }
    await setProtocolReportRef.current?.(outcome.report);
    const currentReport = composerControllerRef.current?.getProtocolReport();
    if (currentReport?.reportId !== outcome.report.reportId) {
      return {
        ok: false,
        code: "PROTOCOL_REPORT_SUPERSEDED",
        message: "The stage changed before its completed report could be bound. The current report was not overwritten.",
        state: { surface: "studio", revision: composerControllerRef.current?.getRevision() ?? revision },
      };
    }
    const failedCount = outcome.report.checks.filter((check) => check.status === "failed").length;
    return {
      ok: outcome.report.passed,
      code: outcome.report.passed ? "PROTOCOL_CHECK_PASSED" : "PROTOCOL_CHECK_FAILED",
      message: outcome.report.passed
        ? "All ten declared Protocol Check cases passed. The visible report states the remaining scientific, safety, and physical limitations."
        : `Protocol Check completed with ${failedCount} failed declared case${failedCount === 1 ? "" : "s"}. Review the visible report; Apply remains locked.`,
      data: {
        reportId: outcome.report.reportId,
        passed: outcome.report.passed,
        checks: outcome.report.checks.map((check) => ({ name: check.name, status: check.status })),
        limitations: {
          scientific: outcome.report.limitations.scientific.length,
          safety: outcome.report.limitations.safety.length,
          physical: outcome.report.limitations.physical.length,
        },
      },
      state: { surface: "studio", revision: composerControllerRef.current?.getRevision() ?? revision },
    };
  }, []);

  const composer = useComposerSession({
    draft,
    applyStage: (stage) => {
      const result = commitTransaction(
        "Apply staged experiment",
        [{ type: "replaceDraft", draft: stage.definition }],
        {
          artifactKind: "lab",
          message: "Passing staged experiment applied to the Studio draft.",
          selectedNodeId: stage.definition.process.startNodeId,
        },
      );
      return { ok: result.ok, error: result.error };
    },
    delegates: {
      startRehearsal: startRehearsalDelegate,
      runProtocolCheck: runProtocolCheckDelegate,
    },
  });
  composerControllerRef.current = composer.controller;
  setProtocolReportRef.current = composer.setProtocolReport;
  const studioToolSet = useMemo(
    () => createStudioToolSet(composer.controller),
    [composer.controller],
  );
  const composerRegistry = useWebMCPRegistry(studioToolSet);
  registryRef.current = composerRegistry;
  studioToolSetRef.current = studioToolSet;

  const closeGuidedRehearsal = useCallback(
    () => restoreStudioSurface(rehearsalSessionRef.current?.attemptId),
    [restoreStudioSurface],
  );

  useEffect(() => {
    void composer.setWebMCPStatus(composerRegistry.status, composerRegistry.error);
  }, [composerRegistry.error, composerRegistry.status]);

  const resetComposerInventory = async () => {
    const inventory = defaultLabInventory();
    inventory.revision = composer.state.inventory.revision + 1;
    await composer.replaceInventory(inventory);
  };

  const stageComposerExample = async () => {
    const request: ExperimentRequest = {
      schemaVersion: "1",
      familyId: "acid_base_titration_v1",
      expectedInventoryRevision: composer.state.inventory.revision,
      objective: "Estimate the molarity of a synthetic monoprotic-acid sample by titration with standardized NaOH.",
      title: "Synthetic Unknown Acid Molarity Estimate",
      audience: "high_school",
      experience: "novice",
      durationMinutes: 45,
      deliveryContext: "virtual_training",
      aliquotVolumeMl: 20,
      endpointEvidence: "phenolphthalein",
      sampleLabel: "Synthetic unknown acid A",
    };
    await composer.preview(request);
  };

  const undoDraft = () => {
    const previous = undoStack.at(-1);
    if (!previous) return;
    setRedoStack((current) => [
      ...current,
      { draft, label: previous.label, revision, selectedNodeId, artifactKind },
    ]);
    setUndoStack((current) => current.slice(0, -1));
    setDraft(previous.draft);
    setRevision(previous.revision);
    setSelectedNodeId(previous.selectedNodeId);
    setArtifactKind(previous.artifactKind);
    setImportMessage(`Undid ${previous.label}.`);
  };

  const redoDraft = () => {
    const next = redoStack.at(-1);
    if (!next) return;
    setUndoStack((current) => [
      ...current,
      { draft, label: next.label, revision, selectedNodeId, artifactKind },
    ]);
    setRedoStack((current) => current.slice(0, -1));
    setDraft(next.draft);
    setRevision(next.revision);
    setSelectedNodeId(next.selectedNodeId);
    setArtifactKind(next.artifactKind);
    setImportMessage(`Redid ${next.label}.`);
  };

  useEffect(() => {
    saveWorkspaceLayout(workspaceLayout);
  }, [workspaceLayout]);

  useEffect(() => {
    if (canPreview) setLastRunnableDraft(draft);
  }, [canPreview, draft]);

  useEffect(() => {
    if (!selectedNodeId || draft.process.nodes.some((node) => node.id === selectedNodeId)) return;
    setSelectedNodeId(draft.process.startNodeId || draft.process.nodes[0]?.id || "");
  }, [draft.process.nodes, draft.process.startNodeId, selectedNodeId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undoDraft();
      }
      if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        redoDraft();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  useEffect(() => {
    saveSplitPercent(splitPanePercent);
  }, [splitPanePercent]);

  useEffect(() => {
    saveInspectorWidth(inspectorWidth);
  }, [inspectorWidth]);

  useEffect(() => {
    setSplitPanePercent((current) =>
      current < MIN_PERSISTED_SPLIT_PERCENT ? DEFAULT_SPLIT_PERCENT : current,
    );
  }, []);

  useEffect(() => {
    if (!aboutOpen) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAboutOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [aboutOpen]);

  useEffect(() => {
    if (!isNarrowWorkspace || !isInspectorOpen) return undefined;
    const panel = selectedStepPanelRef.current;
    if (!panel) return undefined;
    panel.focus();
    const handleDrawerKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsInspectorOpen(false);
        window.requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".process-outline-row[aria-current='step']")?.focus());
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex='-1'])"));
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    panel.addEventListener("keydown", handleDrawerKeyDown);
    return () => panel.removeEventListener("keydown", handleDrawerKeyDown);
  }, [isInspectorOpen, isNarrowWorkspace]);

  const showSplitWorkspace = () => {
    setWorkspaceLayout("split");
  };

  const showStudioWorkspace = () => {
    setWorkspaceLayout("tabs");
  };

  const openDetails = () => {
    setIsInspectorOpen(true);
    setIsInspectorPinned(true);
    setDetailsViewVersion((current) => current + 1);
  };

  const autoLayoutDraft = () => {
    commitTransaction("Auto layout", [{ type: "autoLayoutProcess" }], {
      message: "Process map auto-laid out.",
    });
  };

  const addNode = async (
    template: StudioTemplate,
    options?: InsertTemplateStepOptions,
    confirmedEntryTemplate = false,
  ) => {
    if (template.labId) {
      if (!confirmedEntryTemplate) {
        setPendingEntryTemplate(template);
        return;
      }
      try {
        const lab = await loadBundledLab(template.labId);
        const normalizedLab = normalizeStudioLabDraft(lab);
        const laidOutLab = {
          ...normalizedLab,
          process: {
            ...normalizedLab.process,
            nodes: autoLayoutProcessMap(normalizedLab.process.nodes),
          },
        };
        commitTransaction("Load lab template", [{ type: "replaceDraft", draft: laidOutLab }], {
          artifactKind: "lab",
          message: `${template.title} template loaded.`,
          selectedNodeId: normalizedLab.process.startNodeId,
        });
      } catch (error) {
        setImportMessage(error instanceof Error ? error.message : "Unable to load template.");
      }
      return;
    }
    if (template.techniqueId) {
      try {
        const technique = await loadBundledTechnique(template.techniqueId);
        const appended = appendTechniqueToDraft(draft, technique);
        // Appending copies the published technique as authored, templates and all: `prefixAction`
        // renames ids, it does not bind configuration. A workflow written against teacher
        // configuration therefore lands in the draft with `{{config.*}}` still sitting in the
        // parameters that should hold numbers, and the preview runs it that way. The append is
        // still the right thing to allow — the draft is being authored, not played — but the gap
        // is named at the moment it is introduced rather than discovered in the preview.
        const pending = configurationSlots(technique)
          .filter((slot) => slot.kind === "classroom-quantity")
          .map((slot) => slot.id);
        const pendingNote = pending.length > 0
          ? ` This workflow still needs approved ${pending.length === 1 ? "value" : "values"} for `
            + `${pending.join(", ")}; the preview will refuse until a host composition supplies them.`
          : "";
        commitTransaction("Append workflow", [
          { type: "appendTechnique", technique },
          { type: "autoLayoutProcess" },
        ], {
          message: `${template.title} workflow appended.${pendingNote}`,
          selectedNodeId: appended.startNodeId,
        });
      } catch (error) {
        setImportMessage(error instanceof Error ? error.message : "Unable to load workflow template.");
      }
      return;
    }
    const previousNodeIds = new Set(draft.process.nodes.map((node) => node.id));
    const result = commitTransaction("Add step", [
      { type: "appendTemplateStep", templateId: template.id, options },
    ]);
    if (result.ok) {
      const insertedNode = result.draft.process.nodes.find((node) => !previousNodeIds.has(node.id));
      if (insertedNode) setSelectedNodeId(insertedNode.id);
    }
  };

  const createNewLab = () => {
    const nextDraft = createBlankStudioLab();
    commitTransaction("New lab", [{ type: "replaceDraft", draft: nextDraft }], {
      artifactKind: "lab",
      message: "New lab draft created.",
      selectedNodeId: "",
    });
  };

  const createNewTechnique = () => {
    const nextDraft = createBlankStudioTechniqueLab();
    commitTransaction("New technique", [{ type: "replaceDraft", draft: nextDraft }], {
      artifactKind: "technique",
      message: "New technique draft created.",
      selectedNodeId: "",
    });
  };

  const loadPendingEntryTemplate = () => {
    if (!pendingEntryTemplate) return;
    void addNode(pendingEntryTemplate, undefined, true);
    setPendingEntryTemplate(null);
  };

  const convertArtifactKind = (nextKind: StudioArtifactKind) => {
    if (nextKind === artifactKind) return;
    try {
      serializeStudioArtifact(nextKind, draft);
      commitTransaction("Convert artifact kind", [], {
        artifactKind: nextKind,
        message: `Converted export mode to ${artifactKindLabels[nextKind]}.`,
      });
    } catch (error) {
      setImportMessage(
        error instanceof Error
          ? `Cannot convert to ${artifactKindLabels[nextKind]} yet: ${error.message}`
          : `Cannot convert to ${artifactKindLabels[nextKind]} yet.`,
      );
    }
  };

  const addRequiredEquipment = () => {
    if (!equipmentToAdd) return;
    commitTransaction("Add required equipment", [{ type: "addEquipment", definitionId: equipmentToAdd }], {
      message: `${equipmentById.get(equipmentToAdd)?.label ?? equipmentToAdd} added to required equipment.`,
    });
  };

  const removeRequiredEquipment = (definitionId: string) => {
    commitTransaction("Remove required equipment", [{ type: "removeEquipment", definitionId }], {
      message: `${equipmentById.get(definitionId)?.label ?? definitionId} removed from required equipment.`,
    });
  };

  const addStartingEquipment = (definitionId: string) => {
    const allocator = createStudioIdAllocator(draft);
    const instanceId = allocator.next(`${definitionId}-setup`);
    const instanceCount = draft.initialState?.equipment.length ?? 0;
    const instance = {
      ...createEquipmentInstance(definitionId, "setup", "workbench"),
      id: instanceId,
      x: 64 + (instanceCount % 5) * 34,
      y: 72 + Math.floor(instanceCount / 5) * 34,
      zIndex: instanceCount + 1,
    };
    commitTransaction("Add starting equipment", [{ type: "upsertInitialEquipment", instance }], {
      message: `${instance.label} added to the starting setup.`,
    });
  };

  const updateStartingEquipment = (instance: EquipmentInstance) => {
    commitTransaction("Update starting equipment", [{ type: "upsertInitialEquipment", instance }]);
  };

  const removeStartingEquipment = (instanceId: string) => {
    commitTransaction("Remove starting equipment", [{ type: "removeInitialEquipment", instanceId }]);
  };

  const updateStartingEquipmentFromJson = (instance: EquipmentInstance, value: string) => {
    try {
      const parsed = JSON.parse(value) as EquipmentInstance;
      updateStartingEquipment({
        ...instance,
        ...parsed,
        id: parsed.id || instance.id,
        definitionId: parsed.definitionId || instance.definitionId,
        label: parsed.label || instance.label,
        location: parsed.location || instance.location,
        contents: parsed.contents ?? instance.contents ?? emptyContents(),
      });
      setImportMessage("Advanced starting equipment JSON applied.");
    } catch {
      setImportMessage("Starting equipment JSON must parse before it can be committed.");
    }
  };

  const assistantAdapter = useMemo(
    () =>
      createStudioAssistantAdapter({
        artifactKind,
        applyTemplate: addNode,
        commitTransaction: commitAssistantTransaction,
        draft,
        focusNodeInPreview,
        revision,
        selectedNodeId,
        setDraft: (updater) => {
          commitDraftUpdater("Assistant edit", updater, "Assistant updated the draft.");
        },
        setStatusMessage: setImportMessage,
        undoDraft,
      }),
    [artifactKind, draft, revision, selectedNodeId],
  );

  const updateNode = (node: ProcessNode) => {
    commitTransaction("Update step", [{ type: "updateProcessNode", node }]);
  };

  const updateAction = (action: ActionDefinition) => {
    commitTransaction("Update action", [{ type: "updateAction", action }]);
  };

  const updateEdge = (index: number, edge: ProcessEdge) => {
    commitTransaction("Update connection", [{ type: "updateProcessEdge", index, edge }]);
  };

  const addRetryEdge = (fromNodeId: string) => {
    commitTransaction("Add retry path", [{ type: "addRetryEdge", nodeId: fromNodeId }]);
  };

  const addBranchEdge = (fromNodeId: string, toNodeId: string) => {
    commitTransaction("Add branch path", [{ type: "addBranchEdge", from: fromNodeId, to: toNodeId }]);
  };

  const deleteProcessNode = (nodeId: string) => {
    const node = draft.process.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return;
    const incidentConnections = draft.process.edges.filter(
      (edge) => edge.from === nodeId || edge.to === nodeId,
    ).length;
    if (!window.confirm(`Delete “${node.title}” and ${incidentConnections} connected path${incidentConnections === 1 ? "" : "s"}? You can undo this change.`)) return;
    const nodeIndex = draft.process.nodes.findIndex((candidate) => candidate.id === nodeId);
    const nextSelection = draft.process.nodes[nodeIndex + 1]?.id ?? draft.process.nodes[nodeIndex - 1]?.id ?? "";
    commitTransaction("Delete step", [{ type: "removeProcessNode", nodeId }], {
      message: `${node.title} deleted.`,
      selectedNodeId: nextSelection,
    });
  };

  const updateLabSettings = (
    patch: Extract<StudioOperation, { type: "updateLabSettings" }>["patch"],
  ) => {
    commitTransaction("Update lab setup", [{ type: "updateLabSettings", patch }]);
  };

  const updateTechniqueSettings = (
    patch: Extract<StudioOperation, { type: "updateTechniqueSettings" }>["patch"],
  ) => {
    commitTransaction("Update technique setup", [{ type: "updateTechniqueSettings", patch }]);
  };

  const updateTechniqueGoal = (goal: string) => {
    commitTransaction("Update technique goal", [
      { type: "updateLabSettings", patch: { description: goal, learningGoals: goal ? [goal] : [] } },
      { type: "updateTechniqueSettings", patch: { learningGoal: goal } },
    ]);
  };

  const saveCurrentDraft = () => {
    try {
      saveDraft(draft, artifactKind);
      setSavedRevision(revision);
      setImportMessage("Draft saved locally.");
    } catch (error) {
      setImportMessage(error instanceof Error ? `Save failed: ${error.message}` : "Save failed. Retry when local storage is available.");
    }
  };

  const changeStage = (stage: StudioStage) => {
    setActiveStage(stage);
  };

  const collapseSelectedStepEditor = () => {
    setBranchMenuOpen(false);
    setInspectorLibraryOptions(null);
    setIsInspectorOpen(false);
    window.requestAnimationFrame(() => collapsedInspectorButtonRef.current?.focus());
  };

  const expandSelectedStepEditor = () => {
    setIsInspectorOpen(true);
    window.requestAnimationFrame(() => {
      selectedStepPanelRef.current
        ?.querySelector<HTMLButtonElement>(".inspector-tab-list button[aria-selected='true']")
        ?.focus();
    });
  };

  const readinessMessage = readiness.level === "exportReady"
    ? "Looks good! You’re ready to preview."
    : readiness.level === "runnable"
      ? "Preview ready. Export still needs review."
      : `Preview blocked: ${readiness.diagnostics[0]?.message ?? "Review the draft."}`;

  const navigateToReadinessDiagnostic = (diagnostic: (typeof readiness.diagnostics)[number]) => {
    const anchor = diagnostic.anchor;
    if (anchor?.section === "setup") {
      changeStage("setup");
      return;
    }
    if (anchor?.section === "preview" || anchor?.section === "export") {
      changeStage("preview");
      return;
    }
    changeStage("process");
    if (anchor?.nodeId) {
      focusNodeInPreview(anchor.nodeId);
      return;
    }
    openDetails();
  };

  const exportDraft = () => {
    if (!canExport) {
      setImportMessage("Resolve export readiness issues before exporting.");
      return;
    }
    downloadJson(studioArtifactFilename(artifactKind, draft), serializeStudioArtifact(artifactKind, draft));
  };

  const importDraft = async (file: File | undefined) => {
    if (!file) return;
    const result = parseImportedJson(await file.text());
    if (!result.ok || !result.value) {
      setImportRepairErrors(result.errors);
      setImportMessage("Import repair needed before this JSON can become a Studio draft.");
      return;
    }
    setImportRepairErrors([]);
    if ("audience" in result.value) {
      const normalizedDraft = normalizeStudioLabDraft(result.value);
      commitTransaction("Import lab", [{ type: "replaceDraft", draft: normalizedDraft }], {
        artifactKind: "lab",
        message: "Imported lab draft.",
        selectedNodeId: normalizedDraft.process.startNodeId,
      });
    } else {
      const normalizedTechniqueDraft = labDraftFromTechnique(result.value);
      commitTransaction("Import technique", [{ type: "replaceDraft", draft: normalizedTechniqueDraft }], {
        artifactKind: "technique",
        message: "Imported technique draft.",
        selectedNodeId: normalizedTechniqueDraft.process.startNodeId,
      });
    }
  };

  return (
    <main className={`teacher-studio is-stage-${activeStage}`}>
      <StudioCommandHeader
        activeStage={activeStage}
        artifactKind={artifactKind}
        assistantOpen={assistantOpen}
        canExport={canExport}
        canRedo={Boolean(redoStack.length)}
        canUndo={Boolean(undoStack.length)}
        composerOpen={composer.state.drawerOpen}
        composerRevision={composer.state.revision}
        hasUnsavedChanges={hasUnsavedChanges}
        title={draft.title}
        onAssistantToggle={() => setAssistantOpen((current) => !current)}
        onComposerToggle={() => void composer.open()}
        onExport={exportDraft}
        onImport={(file) => void importDraft(file)}
        onNewLab={createNewLab}
        onNewTechnique={createNewTechnique}
        onOpenAbout={() => setAboutOpen(true)}
        onRedo={redoDraft}
        onSave={saveCurrentDraft}
        onStageChange={changeStage}
        onTitleCommit={(title) => updateLabSettings({ title })}
        onUndo={undoDraft}
      />
      {aboutOpen ? (
        <div
          className="about-dialog-backdrop"
          role="presentation"
          onMouseDown={() => setAboutOpen(false)}
        >
          <section
            className="about-dialog studio-about-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={aboutTitleId}
            aria-describedby={aboutDescriptionId}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="about-dialog__eyebrow">
              <span>About Lab Design Studio</span>
              <button
                className="about-dialog__close"
                type="button"
                onClick={() => setAboutOpen(false)}
              >
                <X size={16} aria-hidden="true" />
                <span className="sr-only">Close about dialog</span>
              </button>
            </div>
            <h2 id={aboutTitleId}>Design structured labs</h2>
            <p id={aboutDescriptionId}>
              Build structured lab process maps that run in the same simulator engine.
            </p>
          </section>
        </div>
      ) : null}
      {importMessage ? <p className="status-line">{importMessage}</p> : null}
      {importRepairErrors.length ? (
        <section className="import-repair-panel" aria-label="Import repair">
          <div>
            <h2>Import repair</h2>
            <p>Fix these JSON issues, then import the file again.</p>
          </div>
          <ul>
            {importRepairErrors.map((message, index) => (
              <li key={`${index}-${message}`}>{message}</li>
            ))}
          </ul>
          <button className="secondary-action" type="button" onClick={() => setImportRepairErrors([])}>
            Dismiss import repair
          </button>
        </section>
      ) : null}
      {pendingEntryTemplate ? (
        <div className="studio-confirmation-backdrop" role="presentation">
          <section className="template-confirmation studio-entry-confirmation" role="alertdialog" aria-modal="true" aria-label="Replace current draft">
            <p>
              <strong>{pendingEntryTemplate.title}</strong> will replace the current draft.
            </p>
            <div>
              <button type="button" onClick={loadPendingEntryTemplate}>
                Start template
              </button>
              <button
                autoFocus
                className="secondary-action"
                type="button"
                onClick={() => setPendingEntryTemplate(null)}
              >
                Cancel
              </button>
            </div>
          </section>
        </div>
      ) : null}
      <div
        ref={workspaceRef}
        className={`studio-workspace ${isSplitVisible ? "is-split" : "is-tabs"} is-stage-${activeStage}`}
        style={{
          "--studio-authoring-size": `${splitPanePercent}%`,
          "--studio-stage-sidebar-size": `${appliedStageSidebarWidth}px`,
        } as CSSProperties}
      >
        <section
          className={`studio-pane studio-authoring-pane ${showStudioPane ? "is-active" : ""}`}
          aria-label="Studio authoring"
          hidden={!showStudioPane}
        >
          {activeStage === "process" ? (
            <>
              <ProcessOutline
                draft={draft}
                selectedNodeId={selectedNodeId}
                onAddBranch={addBranchEdge}
                onAddRetry={addRetryEdge}
                onAddTemplate={addNode}
                onDelete={deleteProcessNode}
                onSelect={focusNodeInPreview}
                onSetStart={(nodeId) => commitTransaction("Update start node", [{ type: "setStartNode", nodeId }])}
              />
              <StudioResizeHandle
                className="process-outline-resizer"
                defaultValue={DEFAULT_STAGE_SIDEBAR_WIDTH}
                label="Resize Process outline"
                max={isSplitVisible ? MAX_SPLIT_STAGE_SIDEBAR_WIDTH : MAX_STAGE_SIDEBAR_WIDTH}
                min={MIN_STAGE_SIDEBAR_WIDTH}
                onChange={setStageSidebarWidth}
                orientation="vertical"
                step={12}
                value={appliedStageSidebarWidth}
              />
            </>
          ) : null}
          <div
            className={[
              "studio-grid",
              isInspectorOpen
                ? isInspectorPinned
                  ? "is-inspector-pinned"
                  : "is-inspector-floating"
                : "is-inspector-collapsed",
            ].join(" ")}
            style={{
              "--studio-inspector-width": `${inspectorWidth}px`,
            } as CSSProperties}
          >
            <ProcessMap
              draft={draft}
              detailsViewVersion={detailsViewVersion}
              selectedNodeId={selectedNodeId}
              onAddBranchEdge={addBranchEdge}
              onAddRetryEdge={addRetryEdge}
              onAddTemplate={addNode}
              onAutoLayout={autoLayoutDraft}
              onOpenDetails={openDetails}
              onSelect={focusNodeInPreview}
              onUpdateEdge={updateEdge}
              onUpdateNode={updateNode}
              connectionsOpen={connectionsOpen}
              onConnectionsOpenChange={setConnectionsOpen}
              previewVisible={isSplitVisible}
              onTogglePreview={() => isSplitVisible ? showStudioWorkspace() : showSplitWorkspace()}
              readinessLabel={readinessMessage}
              readinessTone={readiness.level === "exportReady" ? "ready" : canPreview ? "review" : "blocked"}
              onReadinessClick={() => {
                const diagnostic = readiness.diagnostics[0];
                if (!diagnostic) {
                  changeStage("preview");
                  return;
                }
                navigateToReadinessDiagnostic(diagnostic);
              }}
            />
            {activeStage === "process" && isInspectorOpen ? (
              <StudioResizeHandle
                className="studio-inspector-dock-resizer"
                defaultValue={DEFAULT_INSPECTOR_WIDTH}
                direction={-1}
                label="Resize process canvas and step editor sidebar"
                max={MAX_INSPECTOR_WIDTH}
                min={MIN_INSPECTOR_WIDTH}
                onChange={setInspectorWidth}
                orientation="vertical"
                step={16}
                value={inspectorWidth}
              />
            ) : null}
            <section
              ref={selectedStepPanelRef}
              className={`studio-selected-step ${isInspectorOpen ? "is-expanded" : "is-collapsed"}`}
              role={isNarrowWorkspace && isInspectorOpen ? "dialog" : undefined}
              aria-modal={isNarrowWorkspace && isInspectorOpen ? true : undefined}
              aria-label="Selected step editor"
              tabIndex={isNarrowWorkspace && isInspectorOpen ? -1 : undefined}
            >
                <div className="selected-step-command-bar">
                  <div>
                    <span>Editing step {Math.max(1, draft.process.nodes.findIndex((node) => node.id === selectedNodeId) + 1)} of {draft.process.nodes.length}</span>
                    <h2>{selectedNode?.title ?? "Select a step"}</h2>
                  </div>
                  {selectedNode && isInspectorOpen ? (
                    <div className="selected-step-command-actions">
                      <button type="button" onClick={() => setInspectorLibraryOptions({ anchorNodeId: selectedNode.id, placement: "after" })}><Plus size={14} aria-hidden="true" /> Add after</button>
                      <button type="button" onClick={() => setInspectorLibraryOptions({ anchorNodeId: selectedNode.id, placement: "before" })}><Plus size={14} aria-hidden="true" /> Insert before</button>
                      <button type="button" aria-haspopup="menu" aria-expanded={branchMenuOpen} onClick={() => setBranchMenuOpen((current) => !current)}><GitBranch size={14} aria-hidden="true" /> Branch</button>
                      <button type="button" disabled={draft.process.edges.some((edge) => edge.from === selectedNode.id && edge.condition.type === "retry")} onClick={() => addRetryEdge(selectedNode.id)}><RotateCcw size={14} aria-hidden="true" /> Retry</button>
                      <button type="button" aria-label={`Delete ${selectedNode.title}`} onClick={() => deleteProcessNode(selectedNode.id)}><Trash2 size={14} aria-hidden="true" /></button>
                      <button type="button" aria-label="Collapse step editor" aria-expanded="true" aria-controls={selectedStepEditorBodyId} onClick={collapseSelectedStepEditor}><PanelRightClose size={14} aria-hidden="true" /></button>
                    </div>
                  ) : null}
                  {!isInspectorOpen ? (
                    <button
                      ref={collapsedInspectorButtonRef}
                      className="selected-step-expand"
                      type="button"
                      aria-expanded="false"
                      aria-controls={selectedStepEditorBodyId}
                      onClick={expandSelectedStepEditor}
                    >
                      <PanelRightOpen size={14} aria-hidden="true" /> <span>Expand editor</span>
                    </button>
                  ) : null}
                  {selectedNode && isInspectorOpen && branchMenuOpen ? (
                    <div className="selected-step-branch-menu" role="menu">
                      {draft.process.nodes.filter((node) => node.id !== selectedNode.id).map((target) => (
                        <button key={target.id} type="button" role="menuitem" onClick={() => {
                          addBranchEdge(selectedNode.id, target.id);
                          setBranchMenuOpen(false);
                        }}>Branch to {target.title}</button>
                      ))}
                    </div>
                  ) : null}
                </div>
                {isInspectorOpen && inspectorLibraryOptions ? (
                  <NodePalette
                    mode="steps"
                    open
                    onAdd={(template) => {
                      void addNode(template, inspectorLibraryOptions);
                      setInspectorLibraryOptions(null);
                    }}
                    onClose={() => setInspectorLibraryOptions(null)}
                  />
                ) : null}
                <div className="selected-step-editor-body" id={selectedStepEditorBodyId} hidden={!isInspectorOpen}>
                  <NodeInspector
                    draft={draft}
                    isPinned={isInspectorPinned}
                    node={selectedNode}
                    onActionChange={updateAction}
                    onChange={updateNode}
                    onClose={collapseSelectedStepEditor}
                    onRenameTechnicalId={(from, to) =>
                      commitTransaction("Rename technical ID", [{ type: "renameTechnicalId", from, to }])
                    }
                    onTogglePinned={() => setIsInspectorPinned((current) => !current)}
                  />
                </div>
            </section>
            <section className="schema-panel lab-setup-panel">
              <div className="panel-heading lab-setup-heading">
                <div>
                  <h2>{artifactKind === "technique" ? "Technique setup" : "Lab setup"}</h2>
                  <span>
                    <span className="artifact-badge">{artifactKindLabels[artifactKind]}</span>
                    {" - "}
                    {draft.equipment.length} equipment - {readiness.label}
                  </span>
                </div>
                <button
                  className="secondary-action"
                  type="button"
                  aria-expanded={setupOpen}
                  onClick={() => setSetupOpen((current) => !current)}
                >
                  {setupOpen ? "Collapse" : "Expand"}
                </button>
              </div>
              {!setupOpen ? (
                <p className="setup-summary">
                  {draft.title || "Untitled"} - {artifactKindLabels[artifactKind]} - {draft.equipment.length} required - {readiness.label}
                </p>
              ) : (
                <div className="setup-stage-workbench">
                  <aside className="setup-configuration-rail" aria-label="Draft setup and readiness">
                  <div className="readiness-grid" aria-label="Readiness">
                    {readiness.categories.map((category) => {
                      const actionableDiagnostic = category.diagnostics[0];
                      const statusLabel =
                        category.status === "pass" ? "Ready" : category.status === "warning" ? "Review" : "Needs work";
                      const content = (
                        <>
                          <span>{category.label}</span>
                          <strong>{statusLabel}</strong>
                        </>
                      );

                      if (!actionableDiagnostic) {
                        return (
                          <div key={category.id} className={`readiness-card is-${category.status}`}>
                            {content}
                          </div>
                        );
                      }

                      return (
                        <button
                          key={category.id}
                          className={`readiness-card readiness-card-button is-${category.status}`}
                          type="button"
                          onClick={() => navigateToReadinessDiagnostic(actionableDiagnostic)}
                        >
                          {content}
                        </button>
                      );
                    })}
                  </div>
                  <div className="artifact-mode" aria-label="Artifact mode">
                    <span className="artifact-badge">{artifactKindLabels[artifactKind]}</span>
                    <button
                      className="secondary-action"
                      type="button"
                      disabled={artifactKind === "lab"}
                      onClick={() => convertArtifactKind("lab")}
                    >
                      Convert to lab
                    </button>
                    <button
                      className="secondary-action"
                      type="button"
                      disabled={artifactKind === "technique"}
                      onClick={() => convertArtifactKind("technique")}
                    >
                      Convert to technique
                    </button>
                  </div>
                  <div className="lab-settings">
                    <label>
                      Title
                      <input
                        value={draft.title}
                        onChange={(event) => updateLabSettings({ title: event.target.value })}
                      />
                    </label>
                    {artifactKind === "technique" ? (
                      <>
                        <label>
                          Goal
                          <textarea
                            value={techniqueGoal(draft)}
                            onChange={(event) => updateTechniqueGoal(event.target.value)}
                          />
                        </label>
                        <label>
                          Common mistakes
                          <textarea
                            value={commonMistakesText(draft)}
                            onChange={(event) =>
                              updateTechniqueSettings({
                                commonMistakes: commonMistakesFromText(event.target.value),
                              })
                            }
                          />
                        </label>
                        <label>
                          Reset behavior
                          <select
                            value={firstTechniqueSettings(draft)?.resetBehavior ?? "resetTechnique"}
                            onChange={(event) =>
                              updateTechniqueSettings({
                                resetBehavior: event.target.value as "resetTechnique" | "resetLab",
                              })
                            }
                          >
                            <option value="resetTechnique">Reset technique</option>
                            <option value="resetLab">Reset lab</option>
                          </select>
                        </label>
                      </>
                    ) : (
                      <>
                        <label>
                          Audience
                          <input
                            value={draft.audience}
                            onChange={(event) => updateLabSettings({ audience: event.target.value })}
                          />
                        </label>
                        <label>
                          Goals
                          <textarea
                            value={draft.learningGoals.join("\n")}
                            onChange={(event) => updateLabSettings({ learningGoals: listFromText(event.target.value) })}
                          />
                        </label>
                        <label>
                          Safety
                          <textarea
                            value={draft.safetyNotes.join("\n")}
                            onChange={(event) => updateLabSettings({ safetyNotes: listFromText(event.target.value) })}
                          />
                        </label>
                      </>
                    )}
                    <label>
                      Tags
                      <input
                        value={draft.metadata.tags.join(", ")}
                        onChange={(event) => {
                          const tags = listFromText(event.target.value);
                          if (artifactKind === "technique") {
                            commitTransaction("Update technique tags", [
                              { type: "updateLabSettings", patch: { tags } },
                              { type: "updateTechniqueSettings", patch: { tags } },
                            ]);
                          } else {
                            updateLabSettings({ tags });
                          }
                        }}
                      />
                    </label>
                  </div>
                  <div className="advanced-process-settings">
                    <button
                      className="secondary-action"
                      type="button"
                      aria-expanded={advancedSetupOpen}
                      onClick={() => setAdvancedSetupOpen((current) => !current)}
                    >
                      Advanced process settings
                    </button>
                    {advancedSetupOpen ? (
                      <label>
                        Start node
                        <select
                          value={draft.process.startNodeId || ""}
                          onChange={(event) =>
                            commitTransaction("Update start node", [
                              { type: "setStartNode", nodeId: event.target.value },
                            ])
                          }
                        >
                          <option value="">No start step</option>
                          {draft.process.nodes.map((node) => (
                            <option key={node.id} value={node.id}>
                              {node.title}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </div>
                  <section className="setup-validation-summary" aria-label="Setup validation summary">
                    {readiness.diagnostics.length ? (
                      <ul className="validation-errors readiness-diagnostics" aria-label="Readiness diagnostics">
                        {readiness.diagnostics.map((diagnostic) => (
                          <li key={diagnostic.id}>{diagnostic.message}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>Draft output is export ready and contains no teacher-authored code fields.</p>
                    )}
                    {interactionIssues.length ? (
                      <ul className="validation-warnings" aria-label="Interaction warnings">
                        {interactionIssues.map((issue) => (
                          <li key={`${issue.actionId}-${issue.message}`}>{issue.message}</li>
                        ))}
                      </ul>
                    ) : null}
                  </section>
                  </aside>
                  <StudioResizeHandle
                    className="setup-stage-resizer"
                    defaultValue={DEFAULT_STAGE_SIDEBAR_WIDTH}
                    label="Resize Setup configuration"
                    max={MAX_STAGE_SIDEBAR_WIDTH}
                    min={MIN_STAGE_SIDEBAR_WIDTH}
                    onChange={setStageSidebarWidth}
                    orientation="vertical"
                    step={12}
                    value={appliedStageSidebarWidth}
                  />
                  <section className="equipment-cards" aria-label="Required equipment">
                    <div className="equipment-cards-heading">
                      <h3>Required equipment</h3>
                      <label>
                        Add equipment from catalog
                        <span>
                          <select
                            aria-label="Equipment catalog"
                            value={equipmentToAdd}
                            onChange={(event) => setEquipmentToAdd(event.target.value)}
                          >
                            {v1EquipmentCatalog.map((definition) => (
                              <option key={definition.id} value={definition.id}>
                                {definition.label}
                              </option>
                            ))}
                          </select>
                          <button type="button" onClick={addRequiredEquipment}>
                            <Plus size={15} aria-hidden="true" /> Add
                          </button>
                        </span>
                      </label>
                    </div>
                    {draft.equipment.length ? (
                      <div className="equipment-card-grid">
                        {draft.equipment.map((definitionId) => {
                          const definition = equipmentById.get(definitionId);
                          const instances = (draft.initialState?.equipment ?? []).filter(
                            (instance) => instance.definitionId === definitionId,
                          );
                          return (
                            <article className="equipment-card" key={definitionId}>
                              <header>
                                <div>
                                  <strong>{definition?.label ?? definitionId}</strong>
                                  <span>{definitionId}</span>
                                </div>
                                <button
                                  className="icon-action equipment-card__remove"
                                  type="button"
                                  aria-label={`Remove ${definition?.label ?? definitionId}`}
                                  title={`Remove ${definition?.label ?? definitionId}`}
                                  onClick={() => removeRequiredEquipment(definitionId)}
                                >
                                  <Trash2 size={15} aria-hidden="true" />
                                </button>
                              </header>
                              <button
                                className="secondary-action equipment-card__add-starting"
                                type="button"
                                onClick={() => addStartingEquipment(definitionId)}
                              >
                                <Plus size={15} aria-hidden="true" /> Add starting item
                              </button>
                              {instances.length ? (
                                <div className="starting-instance-list">
                                  {instances.map((instance) => (
                                    <section className="starting-instance-card" key={instance.id}>
                                      <div className="starting-instance-card__heading">
                                        <strong>{instance.label}</strong>
                                        <button
                                          className="icon-action starting-instance-card__remove"
                                          type="button"
                                          aria-label={`Remove starting item ${instance.label}`}
                                          title={`Remove starting item ${instance.label}`}
                                          onClick={() => removeStartingEquipment(instance.id)}
                                        >
                                          <Trash2 size={15} aria-hidden="true" />
                                        </button>
                                      </div>
                                      <div className="starting-instance-grid">
                                        <label>
                                          Instance label
                                          <input
                                            value={instance.label}
                                            onChange={(event) =>
                                              updateStartingEquipment({ ...instance, label: event.target.value })
                                            }
                                          />
                                        </label>
                                        <label>
                                          Location
                                          <select
                                            value={instance.location}
                                            onChange={(event) =>
                                              updateStartingEquipment({
                                                ...instance,
                                                location: event.target.value as EquipmentInstance["location"],
                                              })
                                            }
                                          >
                                            {equipmentLocations.map((location) => (
                                              <option key={location} value={location}>
                                                {location}
                                              </option>
                                            ))}
                                          </select>
                                        </label>
                                        <label>
                                          X position
                                          <input
                                            type="number"
                                            value={instance.x ?? ""}
                                            onChange={(event) =>
                                              updateStartingEquipment({
                                                ...instance,
                                                x: optionalNumber(event.target.value),
                                              })
                                            }
                                          />
                                        </label>
                                        <label>
                                          Y position
                                          <input
                                            type="number"
                                            value={instance.y ?? ""}
                                            onChange={(event) =>
                                              updateStartingEquipment({
                                                ...instance,
                                                y: optionalNumber(event.target.value),
                                              })
                                            }
                                          />
                                        </label>
                                        <label>
                                          Contents
                                          <select
                                            value={instance.contents.kind}
                                            onChange={(event) =>
                                              updateStartingEquipment({
                                                ...instance,
                                                contents: updateContents(instance.contents, {
                                                  kind: event.target.value as ContentState["kind"],
                                                }),
                                              })
                                            }
                                          >
                                            {contentKinds.map((kind) => (
                                              <option key={kind} value={kind}>
                                                {kind}
                                              </option>
                                            ))}
                                          </select>
                                        </label>
                                        <label>
                                          Contents label
                                          <input
                                            value={instance.contents.label}
                                            onChange={(event) =>
                                              updateStartingEquipment({
                                                ...instance,
                                                contents: updateContents(instance.contents, {
                                                  label: event.target.value,
                                                }),
                                              })
                                            }
                                          />
                                        </label>
                                        <label>
                                          Volume mL
                                          <input
                                            type="number"
                                            value={instance.contents.volumeMl ?? ""}
                                            onChange={(event) =>
                                              updateStartingEquipment({
                                                ...instance,
                                                contents: updateContents(instance.contents, {
                                                  volumeMl: optionalNumber(event.target.value),
                                                }),
                                              })
                                            }
                                          />
                                        </label>
                                        <label>
                                          Mass g
                                          <input
                                            type="number"
                                            value={instance.contents.massG ?? ""}
                                            onChange={(event) =>
                                              updateStartingEquipment({
                                                ...instance,
                                                contents: updateContents(instance.contents, {
                                                  massG: optionalNumber(event.target.value),
                                                }),
                                              })
                                            }
                                          />
                                        </label>
                                        <label>
                                          Temperature C
                                          <input
                                            type="number"
                                            value={instance.contents.temperatureC ?? ""}
                                            onChange={(event) =>
                                              updateStartingEquipment({
                                                ...instance,
                                                contents: updateContents(instance.contents, {
                                                  temperatureC: optionalNumber(event.target.value),
                                                }),
                                              })
                                            }
                                          />
                                        </label>
                                        <label>
                                          Wet state
                                          <select
                                            value={instance.contents.wetState}
                                            onChange={(event) =>
                                              updateStartingEquipment({
                                                ...instance,
                                                contents: updateContents(instance.contents, {
                                                  wetState: event.target.value as ContentState["wetState"],
                                                }),
                                              })
                                            }
                                          >
                                            <option value="dry">dry</option>
                                            <option value="wet">wet</option>
                                            <option value="rinsed">rinsed</option>
                                          </select>
                                        </label>
                                      </div>
                                      <details className="advanced-equipment-json">
                                        <summary>Advanced raw equipment JSON</summary>
                                        <textarea
                                          defaultValue={JSON.stringify(instance, null, 2)}
                                          onBlur={(event) =>
                                            updateStartingEquipmentFromJson(instance, event.currentTarget.value)
                                          }
                                        />
                                      </details>
                                    </section>
                                  ))}
                                </div>
                              ) : (
                                <p className="equipment-card__empty">No starting item</p>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    ) : (
                      <p>No required equipment configured.</p>
                    )}
                  </section>
                </div>
              )}
            </section>
          </div>
        </section>
        {isSplitVisible ? (
          <StudioResizeHandle
            className="studio-split-resizer"
            ariaValueText={`${Math.round(splitPanePercent)} percent authoring, ${Math.round(100 - splitPanePercent)} percent preview`}
            defaultValue={DEFAULT_SPLIT_PERCENT}
            getPixelsPerUnit={() => (workspaceRef.current?.getBoundingClientRect().width ?? 100) / 100}
            label="Resize authoring and in-context preview"
            max={MAX_SPLIT_PERCENT}
            min={MIN_SPLIT_PERCENT}
            onChange={(value) => setSplitPanePercent(clampSplitPercent(value))}
            orientation="vertical"
            step={2}
            value={splitPanePercent}
          />
        ) : null}
        <section
          className={`studio-pane studio-draft-pane ${showDraftPane ? "is-active" : ""} ${activeStage === "preview" ? "is-stage-preview" : "is-in-context-preview"}`}
          aria-label={previewPaneLabel}
          hidden={!showDraftPane}
        >
          {activeStage === "preview" ? (
            <>
              <aside className="preview-validation-rail" aria-label="Preview readiness and validation">
                <div className="preview-validation-heading">
                  <div>
                    <h2>Preview &amp; validate</h2>
                    <span>{artifactKindLabels[artifactKind]} · {readiness.label}</span>
                  </div>
                  <strong className={`preview-readiness-state is-${readiness.level}`}>
                    {canPreview ? "Runtime ready" : "Preview blocked"}
                  </strong>
                </div>
                <div className="preview-readiness-list" aria-label="Preview readiness categories">
                  {readiness.categories.map((category) => {
                    const diagnostic = category.diagnostics[0];
                    const statusLabel = category.status === "pass" ? "Ready" : category.status === "warning" ? "Review" : "Needs work";
                    const content = <><span>{category.label}</span><strong>{statusLabel}</strong></>;
                    return diagnostic ? (
                      <button
                        key={category.id}
                        className={`preview-readiness-row is-${category.status}`}
                        type="button"
                        onClick={() => navigateToReadinessDiagnostic(diagnostic)}
                      >
                        {content}
                      </button>
                    ) : (
                      <div key={category.id} className={`preview-readiness-row is-${category.status}`}>
                        {content}
                      </div>
                    );
                  })}
                </div>
                <div className="preview-validation-diagnostics">
                  <h3>{readiness.diagnostics.length ? "What needs attention" : "Validation summary"}</h3>
                  {readiness.diagnostics.length ? (
                    <ul>
                      {readiness.diagnostics.map((diagnostic) => (
                        <li key={diagnostic.id}>
                          <button type="button" onClick={() => navigateToReadinessDiagnostic(diagnostic)}>
                            {diagnostic.message}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>The draft is ready to run, review, and export.</p>
                  )}
                  {isSplitVisible ? null : (
                    <p className="preview-context-note">Use Process → Split preview when you need to edit and observe the runtime at the same time.</p>
                  )}
                </div>
              </aside>
              <StudioResizeHandle
                className="preview-stage-resizer"
                defaultValue={DEFAULT_STAGE_SIDEBAR_WIDTH}
                label="Resize preview validation"
                max={MAX_STAGE_SIDEBAR_WIDTH}
                min={MIN_STAGE_SIDEBAR_WIDTH}
                onChange={setStageSidebarWidth}
                orientation="vertical"
                step={12}
                value={appliedStageSidebarWidth}
              />
            </>
          ) : null}
          <PreviewPanel
            draft={canPreview ? draft : lastRunnableDraft}
            isStale={!canPreview}
            readiness={readiness}
            selectedNodeFocusVersion={selectedNodeFocusVersion}
            selectedNodeId={selectedNodeId}
            variant={activeStage === "preview" ? "stage" : "split"}
          />
        </section>
      </div>
      <ExperimentComposerDrawer
        open={composer.state.drawerOpen}
        revision={composer.state.revision}
        inventory={composer.state.inventory}
        stage={composer.stage}
        report={composer.protocolReport}
        canApply={composer.canApply}
        webMCPStatus={composer.state.webMCPStatus}
        webMCPSurface={composerRegistry.surface}
        webMCPError={composer.state.webMCPError}
        activity={composer.state.activity}
        onClose={() => void composer.close()}
        onUseSimulationProfile={resetComposerInventory}
        onStageExample={stageComposerExample}
        onOpenRehearsal={() => composer.startRehearsal()}
        onRunProtocolCheck={() => composer.runProtocolCheck()}
        onApply={() => composer.apply()}
        onDiscard={() => composer.discard()}
      />
      {rehearsalSession ? (
        <GuidedRehearsalOverlay
          attemptId={rehearsalSession.attemptId}
          definition={rehearsalSession.definition}
          onClose={closeGuidedRehearsal}
          onControllerChange={onRehearsalControllerChange}
          open
        />
      ) : null}
      <div id="studio-assistant-panel">
        <Suspense fallback={null}>
          <StudioAssistantPanel
            adapter={assistantAdapter}
            isOpen={assistantOpen}
            onClose={() => setAssistantOpen(false)}
          />
        </Suspense>
      </div>
    </main>
  );
};
