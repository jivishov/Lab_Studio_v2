import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LabDefinition, TechniqueDefinition } from "../../domain/types";
import { loadDraftArtifact, saveDraft } from "../../studio/persistence";
import { createBlankStudioLab, createBlankStudioTechniqueLab, labDraftFromTechnique, type StudioArtifactKind } from "../../studio/studioArtifact";
import { assessStudioReadiness } from "../../studio/studioReadiness";
import {
  commitStudioTransaction,
  createInitialStudioRevision,
  type StudioOperation,
  type StudioTransactionResult,
} from "../../studio/studioTransactions";

/**
 * Studio 3D's draft (plan §4.6, §4.7): the original Studio's mechanism, unchanged. Every edit is
 * one `commitStudioTransaction` with a readable label (handoff §4.4 "one change, one
 * transaction"); undo and redo are the same snapshot stacks `TeacherStudio` keeps. The draft is
 * saved under its own key, so the two Studios never overwrite each other (plan §11).
 */
export const STUDIO3D_DRAFT_KEY = "lab-studio:3d:v1:draft";

export type Studio3DSelection =
  | { kind: "node"; id: string }
  | { kind: "edge"; index: number }
  | { kind: "equipment"; id: string }
  | undefined;

/** A published technique opened to look at: nothing is edited until "Edit a copy". */
export interface ReadOnlySource {
  techniqueId: string;
  title: string;
}

interface Snapshot {
  draft: LabDefinition;
  artifactKind: StudioArtifactKind;
  revision: string;
  label: string;
  selection: Studio3DSelection;
  readOnly?: ReadOnlySource;
}

export type SaveStatus = "saved" | "saving" | "unavailable" | "not-saved";

const readSaved = () => {
  try {
    return loadDraftArtifact(STUDIO3D_DRAFT_KEY);
  } catch {
    return undefined;
  }
};

export const useStudio3DDraft = () => {
  const initial = useMemo(readSaved, []);
  const initialRevision = useRef(createInitialStudioRevision());
  const committedKeys = useRef(new Set<string>());
  const [draft, setDraft] = useState<LabDefinition>(() => initial?.draft ?? createBlankStudioTechniqueLab());
  const [artifactKind, setArtifactKind] = useState<StudioArtifactKind>(initial?.artifactKind ?? "technique");
  const [revision, setRevision] = useState(initialRevision.current);
  const [savedRevision, setSavedRevision] = useState(initialRevision.current);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [undoStack, setUndoStack] = useState<Snapshot[]>([]);
  const [redoStack, setRedoStack] = useState<Snapshot[]>([]);
  const [activity, setActivity] = useState<string[]>(() => (initial ? ["Opened the saved draft"] : []));
  const [selection, setSelection] = useState<Studio3DSelection>();
  const [readOnly, setReadOnly] = useState<ReadOnlySource>();
  const [message, setMessage] = useState<{ text: string; tone: "info" | "error" }>();

  const readiness = useMemo(() => assessStudioReadiness(draft), [draft]);
  const lastChange = activity[0];

  const snapshot = (label: string): Snapshot => ({ draft, artifactKind, revision, label, selection, ...(readOnly ? { readOnly } : {}) });
  const pushHistory = (label: string) => {
    setUndoStack((stack) => [...stack, snapshot(label)]);
    setRedoStack([]);
  };

  /**
   * One labelled transaction. A refused one changes nothing and says why; a read-only draft
   * refuses every edit (handoff §4.4, read-only state).
   */
  const commit = (
    label: string,
    operations: StudioOperation[],
    options: { artifactKind?: StudioArtifactKind; selection?: Studio3DSelection; readOnly?: ReadOnlySource | null } = {},
  ): StudioTransactionResult => {
    if (readOnly && options.readOnly === undefined) {
      const error = "This published technique is read-only. Choose \"Edit a copy\" to change it.";
      setMessage({ text: error, tone: "error" });
      return { ok: false, draft, revision, diagnostics: [], error };
    }
    const result = commitStudioTransaction(draft, revision, {
      baseRevision: revision,
      idempotencyKey: `${label}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
      label,
      operations,
    }, committedKeys.current);
    if (!result.ok) {
      setMessage({ text: result.error ?? `Unable to ${label.toLowerCase()}.`, tone: "error" });
      return result;
    }
    if (!result.idempotent) {
      pushHistory(label);
      setDraft(result.draft);
      setRevision(result.revision);
      setActivity((items) => [label, ...items].slice(0, 50));
    }
    if (options.artifactKind) setArtifactKind(options.artifactKind);
    if (options.readOnly !== undefined) setReadOnly(options.readOnly ?? undefined);
    if (options.selection !== undefined) setSelection(options.selection);
    setMessage(undefined);
    return result;
  };

  const restore = (from: Snapshot[], to: (update: (stack: Snapshot[]) => Snapshot[]) => void, drop: (update: (stack: Snapshot[]) => Snapshot[]) => void, verb: string) => {
    const entry = from.at(-1);
    if (!entry) return;
    to((stack) => [...stack, snapshot(entry.label)]);
    drop((stack) => stack.slice(0, -1));
    setDraft(entry.draft);
    setRevision(entry.revision);
    setArtifactKind(entry.artifactKind);
    setSelection(entry.selection);
    setReadOnly(entry.readOnly);
    setActivity((items) => [`${verb} ${entry.label}`, ...items].slice(0, 50));
  };
  const undo = () => restore(undoStack, setRedoStack, setUndoStack, "Undid");
  const redo = () => restore(redoStack, setUndoStack, setRedoStack, "Redid");

  /** New (handoff §4.8): a blank technique or experiment. An open draft's kind is never flipped. */
  const createNew = (kind: StudioArtifactKind) => {
    const blank = kind === "technique" ? createBlankStudioTechniqueLab() : { ...createBlankStudioLab(), id: "untitled-experiment", title: "Untitled experiment" };
    commit(kind === "technique" ? "New technique" : "New experiment", [{ type: "replaceDraft", draft: blank }],
      { artifactKind: kind, selection: undefined, readOnly: null });
  };

  /** Open a published technique read-only (handoff §4.4); "Edit a copy" makes it a draft. */
  const openPublished = (technique: TechniqueDefinition) => {
    commit(`Opened ${technique.title}`, [{ type: "replaceDraft", draft: labDraftFromTechnique(technique) }],
      { artifactKind: "technique", selection: undefined, readOnly: { techniqueId: technique.id, title: technique.title } });
  };

  /** "Edit a copy": the published technique becomes an editable draft with its own id and title. */
  const editCopy = () => {
    if (!readOnly) return;
    const id = `${draft.id}-copy`;
    const title = `${draft.title} (copy)`;
    const copy: LabDefinition = {
      ...draft,
      id,
      title,
      techniques: draft.techniques.map((technique, index) => (index === 0 ? { ...technique, id, title } : technique)),
    };
    commit(`Edit a copy of ${readOnly.title}`, [{ type: "replaceDraft", draft: copy }], { readOnly: null });
  };

  // Saving (handoff §4.2): automatic, in this browser only, never for a read-only published view.
  const hasUnsavedChanges = savedRevision !== revision;
  useEffect(() => {
    if (readOnly) { setSaveStatus("not-saved"); return undefined; }
    if (!hasUnsavedChanges) return undefined;
    setSaveStatus("saving");
    const timer = window.setTimeout(() => {
      try {
        saveDraft(draft, artifactKind, STUDIO3D_DRAFT_KEY);
        setSavedRevision(revision);
        setSaveStatus("saved");
      } catch {
        setSaveStatus("unavailable");
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [artifactKind, draft, hasUnsavedChanges, readOnly, revision]);

  const clearMessage = useCallback(() => setMessage(undefined), []);

  return {
    draft,
    artifactKind,
    revision,
    readiness,
    selection,
    setSelection,
    readOnly,
    commit,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    activity,
    lastChange,
    saveStatus,
    message,
    setMessage,
    clearMessage,
    createNew,
    openPublished,
    editCopy,
  };
};

export type Studio3DController = ReturnType<typeof useStudio3DDraft>;
