import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import type { RehearsalController } from "../experimentComposer/types";
import type { RuntimeDefinition } from "../runtime";
import { StudentPlayer } from "./StudentPlayer";

export interface GuidedRehearsalOverlayProps {
  attemptId: string;
  definition: RuntimeDefinition;
  onClose: () => Promise<{ ok: boolean; message: string }>;
  onControllerChange: (controller: RehearsalController | undefined) => void;
  open: boolean;
}

/** Player-owned guided-only shell; final Studio mounting and shared styling belong to Cycle 05. */
export const GuidedRehearsalOverlay = ({
  attemptId,
  definition,
  onClose,
  onControllerChange,
  open,
}: GuidedRehearsalOverlayProps) => {
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const closingRef = useRef(false);
  const [closing, setClosing] = useState(false);
  const [closeFeedback, setCloseFeedback] = useState("");
  const guidedRehearsal = useMemo(
    () => ({ attemptId, onControllerChange }),
    [attemptId, onControllerChange],
  );

  const requestClose = useCallback(async () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    setCloseFeedback("");
    try {
      const result = await closeRef.current();
      if (!result.ok) setCloseFeedback(result.message);
    } catch {
      setCloseFeedback("Studio tools could not be restored. Rehearsal remains open; retry Close rehearsal.");
    } finally {
      closingRef.current = false;
      setClosing(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        void requestClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])",
      ) ?? [])].filter((element) => !element.hidden);
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable.at(-1)!;
      if (!dialogRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [open, requestClose]);

  if (!open) return null;

  return (
    <section
      ref={dialogRef}
      className="guided-rehearsal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Guided rehearsal: ${definition.title}`}
    >
      <header className="guided-rehearsal-overlay__header">
        <div>
          <strong>Transient guided rehearsal</strong>
          <span>The staged Studio draft remains unchanged.</span>
          {closeFeedback ? <span className="guided-rehearsal-overlay__close-feedback" role="alert">{closeFeedback}</span> : null}
        </div>
        <button ref={closeButtonRef} type="button" disabled={closing} onClick={() => void requestClose()}>
          <X size={16} aria-hidden="true" /> {closing ? "Restoring Studio…" : "Close rehearsal"}
        </button>
      </header>
      <StudentPlayer
        definition={definition}
        guidedRehearsal={guidedRehearsal}
      />
    </section>
  );
};
