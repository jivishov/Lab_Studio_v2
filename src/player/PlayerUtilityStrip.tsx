import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  MessageSquareText,
  NotebookTabs,
} from "lucide-react";

export type EvidenceView = "feedback" | "notebook" | "results";

interface PlayerUtilityStripProps {
  activeView: EvidenceView;
  feedbackCount: number;
  notebookCount: number;
  onSelect: (view: EvidenceView) => void;
  resultsCount: number;
  status: "blocked" | "complete" | "ready";
  statusDetail: string;
}

const evidenceItems = [
  { icon: MessageSquareText, key: "feedback", label: "Feedback" },
  { icon: NotebookTabs, key: "notebook", label: "Notebook" },
  { icon: BarChart3, key: "results", label: "Results" },
] as const;

export const PlayerUtilityStrip = ({
  activeView,
  feedbackCount,
  notebookCount,
  onSelect,
  resultsCount,
  status,
  statusDetail,
}: PlayerUtilityStripProps) => {
  const counts = { feedback: feedbackCount, notebook: notebookCount, results: resultsCount };
  const StatusIcon = status === "blocked" ? AlertTriangle : CheckCircle2;
  return (
    <section className="player-utility-strip" aria-label="Lab evidence and immediate status">
      <div className="player-utility-actions" role="group" aria-label="Open lab evidence">
        {evidenceItems.map(({ icon: Icon, key, label }) => (
          <button
            aria-pressed={activeView === key}
            key={key}
            onClick={() => onSelect(key)}
            type="button"
          >
            <Icon size={17} aria-hidden="true" />
            <span>{label}</span>
            <strong aria-label={`${counts[key]} ${label.toLowerCase()} records`}>{counts[key]}</strong>
          </button>
        ))}
      </div>
      <p className={`player-immediate-status is-${status}`} role="status" aria-live="polite">
        <StatusIcon size={18} aria-hidden="true" />
        <span>{statusDetail}</span>
      </p>
    </section>
  );
};
