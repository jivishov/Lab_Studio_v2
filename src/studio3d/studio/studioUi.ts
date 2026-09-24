/**
 * Studio 3D's UI preferences (handoff §3.8): `lab-studio:3d:v1:studio-ui` holds the stage view
 * and the stage toggles, never draft or runtime state. Every read and write is wrapped, and the
 * Studio works without storage; a stale or edited value falls back to its default field by field.
 */
export type StageView = "flow" | "bench" | "preview";

export interface StudioUi {
  view: StageView;
  flow: { snap: boolean; minimap: boolean; compact: boolean };
  bench: { snapZones: boolean; labels: boolean };
  /** The tablet inspector sheet's height, as a share of the window (§4.10). */
  sheet: number;
}

export const STUDIO_UI_KEY = "lab-studio:3d:v1:studio-ui";

const DEFAULTS: StudioUi = { view: "flow", flow: { snap: true, minimap: true, compact: false }, bench: { snapZones: true, labels: true }, sheet: 0.4 };

const bool = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);

export const readStudioUi = (): StudioUi => {
  try {
    const raw = JSON.parse(localStorage.getItem(STUDIO_UI_KEY) ?? "{}") as Record<string, unknown>;
    const flow = (raw.flow ?? {}) as Record<string, unknown>;
    const bench = (raw.bench ?? {}) as Record<string, unknown>;
    return {
      view: raw.view === "bench" || raw.view === "preview" ? raw.view : "flow",
      flow: { snap: bool(flow.snap, DEFAULTS.flow.snap), minimap: bool(flow.minimap, DEFAULTS.flow.minimap), compact: bool(flow.compact, DEFAULTS.flow.compact) },
      bench: { snapZones: bool(bench.snapZones, DEFAULTS.bench.snapZones), labels: bool(bench.labels, DEFAULTS.bench.labels) },
      sheet: typeof raw.sheet === "number" && raw.sheet >= 0.2 && raw.sheet <= 0.8 ? raw.sheet : DEFAULTS.sheet,
    };
  } catch {
    return DEFAULTS;
  }
};

export const updateStudioUi = (patch: Partial<StudioUi>): void => {
  try {
    localStorage.setItem(STUDIO_UI_KEY, JSON.stringify({ ...readStudioUi(), ...patch }));
  } catch {
    // The Studio works without storage.
  }
};
