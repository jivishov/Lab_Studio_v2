import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import type {
  ComposerActivityItem,
  ComposerWebMCPStatus,
} from "../experimentComposer/useComposerSession";
import type {
  LabInventoryProfile,
  StagedExperiment,
} from "../experimentComposer/types";
import type { ProtocolCheckReport } from "../protocolCheck/types";
import { equipmentById } from "../equipment/catalog";
import type { WebMCPSurface } from "../webmcp/result";
import { StagedExperimentReview } from "./StagedExperimentReview";

export interface ExperimentComposerDrawerProps {
  open: boolean;
  revision: number;
  inventory: LabInventoryProfile;
  stage?: StagedExperiment;
  report?: ProtocolCheckReport;
  canApply: boolean;
  webMCPStatus: ComposerWebMCPStatus;
  webMCPSurface?: WebMCPSurface;
  webMCPError?: string;
  activity: ComposerActivityItem[];
  onClose: () => void;
  onUseSimulationProfile: () => Promise<void>;
  onStageExample: () => Promise<void>;
  onOpenRehearsal: () => Promise<{ ok: boolean; message: string }>;
  onRunProtocolCheck: () => Promise<{ ok: boolean; message: string }>;
  onApply: () => Promise<{ ok: boolean; message: string }>;
  onDiscard: () => Promise<void>;
}

const statusLabel: Omit<Record<ComposerWebMCPStatus, string>, "ready"> = {
  unsupported: "WebMCP unavailable · human controls active",
  registering: "Registering grounded tool surface…",
  error: "WebMCP registration error",
};

const readyStatusLabel = (surface?: WebMCPSurface): string => surface === "rehearsal"
  ? "Six rehearsal tools ready"
  : surface === "studio"
    ? "Seven Studio tools ready"
    : "Grounded tool surface ready";

export const ExperimentComposerDrawer = ({
  open,
  revision,
  inventory,
  stage,
  report,
  canApply,
  webMCPStatus,
  webMCPSurface,
  webMCPError,
  activity,
  onClose,
  onUseSimulationProfile,
  onStageExample,
  onOpenRehearsal,
  onRunProtocolCheck,
  onApply,
  onDiscard,
}: ExperimentComposerDrawerProps) => {
  const titleId = useId();
  const descriptionId = useId();
  const drawerRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [busyAction, setBusyAction] = useState<"inventory" | "preview" | "rehearsal" | "protocol" | "apply" | "discard">();
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    window.requestAnimationFrame(() => drawerRef.current?.querySelector<HTMLButtonElement>("button")?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      const drawer = drawerRef.current;
      if (!drawer) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(drawer.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex='-1'])",
      ));
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!drawer.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.requestAnimationFrame(() => returnFocusRef.current?.focus());
    };
  }, [open]);

  if (!open) return null;

  const run = async (
    action: NonNullable<typeof busyAction>,
    operation: () => Promise<void | { ok: boolean; message: string }>,
  ) => {
    setBusyAction(action);
    setFeedback("");
    try {
      const result = await operation();
      if (result) setFeedback(result.message);
    } catch {
      setFeedback("The Composer action could not complete. Inspect the current visible state before trying again.");
    } finally {
      setBusyAction(undefined);
    }
  };

  return (
    <div className="composer-drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        id="experiment-composer-drawer"
        ref={drawerRef}
        className="experiment-composer-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="composer-drawer-header">
          <div>
            <span className="composer-kicker">Grounded experiment Composer</span>
            <h2 id={titleId}>Stage before changing Studio</h2>
            <p id={descriptionId}>Inventory-aware preview, fidelity review, and exact-stage human Apply.</p>
          </div>
          <button type="button" className="composer-close" onClick={onClose} aria-label="Close experiment Composer">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="composer-status-strip" role="status">
          <span className={`composer-status-dot is-${webMCPStatus}`} aria-hidden="true" />
          <strong>{webMCPStatus === "ready" ? readyStatusLabel(webMCPSurface) : statusLabel[webMCPStatus]}</strong>
          <span>Session revision {revision}</span>
          {webMCPError ? <small>{webMCPError}</small> : null}
        </div>

        <div className="composer-drawer-scroll">
          <section className="composer-inventory-section" aria-labelledby="composer-inventory-title">
            <div className="composer-section-heading">
              <div>
                <span className="composer-kicker">Simulation profile · revision {inventory.revision}</span>
                <h3 id="composer-inventory-title">Declared inventory</h3>
              </div>
              <button
                type="button"
                className="secondary-action"
                disabled={Boolean(busyAction)}
                onClick={() => void run("inventory", onUseSimulationProfile)}
              >
                {busyAction === "inventory" ? "Updating…" : "Reset simulation profile"}
              </button>
            </div>
            <p className="composer-disclaimer">This is a reversible simulation profile. It is not evidence that equipment, chemicals, PPE, or facilities exist in a physical room.</p>
            <div className="composer-inventory-grid">
              <div>
                <h4>Equipment</h4>
                <ul>{inventory.equipment.map((item) => <li key={item.definitionId}>{equipmentById.get(item.definitionId)?.label ?? item.definitionId} <span>×{item.count}</span></li>)}</ul>
              </div>
              <div>
                <h4>Chemicals</h4>
                <ul>{inventory.chemicals.map((item) => <li key={item.chemicalId}>{item.chemicalId.replaceAll("_", " ")} <span>{item.quantityMl} mL{item.concentrationM ? ` · ${item.concentrationM} M` : ""}</span></li>)}</ul>
              </div>
            </div>
            <dl className="composer-facility-grid">
              {Object.entries(inventory.facilities).map(([name, available]) => (
                <div key={name}><dt>{name.replace(/([A-Z])/g, " $1").toLowerCase()}</dt><dd>{available ? "Declared" : "Not declared"}</dd></div>
              ))}
            </dl>
            {!stage ? (
              <button type="button" className="primary-action composer-stage-example" disabled={Boolean(busyAction)} onClick={() => void run("preview", onStageExample)}>
                {busyAction === "preview" ? "Validating and staging…" : "Stage supported titration example"}
              </button>
            ) : null}
          </section>

          {stage ? (
            <StagedExperimentReview
              stage={stage}
              report={report}
              canApply={canApply}
              busyAction={busyAction}
              onOpenRehearsal={() => void run("rehearsal", onOpenRehearsal)}
              onRunProtocolCheck={() => void run("protocol", onRunProtocolCheck)}
              onApply={() => void run("apply", onApply)}
              onDiscard={() => void run("discard", onDiscard)}
            />
          ) : (
            <section className="composer-empty-stage" aria-label="No staged experiment">
              <h3>No staged experiment</h3>
              <p>A preview appears here only after strict request, inventory, definition, and Studio-interaction validation pass. Failed previews preserve the last valid stage.</p>
            </section>
          )}

          {feedback ? <p className="composer-action-feedback" role="status">{feedback}</p> : null}

          <section className="composer-activity" aria-labelledby="composer-activity-title">
            <div className="composer-section-heading">
              <div>
                <span className="composer-kicker">Bounded session history</span>
                <h3 id="composer-activity-title">Activity feedback</h3>
              </div>
              <span>{activity.length} / 32</span>
            </div>
            <ol reversed>
              {[...activity].reverse().map((item) => (
                <li key={item.id} className={`is-${item.kind}`}>
                  <span>{new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  <p>{item.message}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </aside>
    </div>
  );
};
