import { Icon } from "./Icon";

/**
 * Value provenance (handoff §3.2): every value on screen carries one. A chip always has its text
 * label and a glyph, so colour is never the only signal. Learners never read "measured" for their
 * own entries (§9).
 */
export type ProvenanceKind = "teacher" | "entry" | "bench" | "simulated" | "calculated";

const CHIPS: Record<ProvenanceKind, { label: string; icon: string; studio: string }> = {
  teacher: { label: "Teacher setting", icon: "clip", studio: "teacherConfiguration input or setup slot" },
  entry: { label: "Your entry", icon: "pencil", studio: "studentResponse input" },
  bench: { label: "From the bench", icon: "beaker", studio: "runtime state" },
  simulated: { label: "Simulated", icon: "chip", studio: "instrumentReadout, provenance simulator-generated" },
  calculated: { label: "Calculated", icon: "equals", studio: "calculation evidence" },
};

export const provenanceLabel = (kind: ProvenanceKind): string => CHIPS[kind].label;

export const ProvenanceChip = ({ kind, studio = false }: { kind: ProvenanceKind; studio?: boolean }) => (
  <span className={`s3d-chip s3d-prov s3d-prov--${kind}`} title={studio ? CHIPS[kind].studio : undefined}>
    <Icon name={CHIPS[kind].icon} size={12} />
    {CHIPS[kind].label}
  </span>
);
