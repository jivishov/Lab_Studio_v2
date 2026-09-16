export type SplatTrialFrameId = "setup" | "heat" | "cool";
export type SplatTrialRenderer = "playcanvas";
export type SplatTrialFormat = "ply" | "sog";

export type SplatTrialFrame = {
  id: SplatTrialFrameId;
  time: number;
  splatUrl: string;
  format: SplatTrialFormat;
  fallbackImages: string[];
};

export type SplatTrialManifest = {
  id: "future-splat-bench";
  title: string;
  renderer: SplatTrialRenderer;
  frames: SplatTrialFrame[];
};

const frameIds = new Set<SplatTrialFrameId>(["setup", "heat", "cool"]);
const formats = new Set<SplatTrialFormat>(["ply", "sog"]);

const publicAssetPath = (path: string): string => {
  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${base}${path.replace(/^\/+/, "")}`;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isPublicUrl = (value: unknown): value is string =>
  typeof value === "string" &&
  (value.startsWith("/") || value.startsWith("assets/")) &&
  !value.includes("\\") &&
  !/^[a-z][a-z0-9+.-]*:/i.test(value);

const parseFrame = (value: unknown, index: number): SplatTrialFrame => {
  if (!isRecord(value)) {
    throw new Error(`Frame ${index + 1} must be an object.`);
  }
  if (!frameIds.has(value.id as SplatTrialFrameId)) {
    throw new Error(`Frame ${index + 1} has an unsupported id.`);
  }
  if (typeof value.time !== "number" || !Number.isFinite(value.time)) {
    throw new Error(`Frame ${value.id} must include a finite time.`);
  }
  if (!isPublicUrl(value.splatUrl)) {
    throw new Error(`Frame ${value.id} must use a public splat URL.`);
  }
  if (!formats.has(value.format as SplatTrialFormat)) {
    throw new Error(`Frame ${value.id} has an unsupported splat format.`);
  }
  const fallbackImages = Array.isArray(value.fallbackImages)
    ? value.fallbackImages
    : value.pngFallbacks;
  if (!Array.isArray(fallbackImages) || fallbackImages.some((url) => !isPublicUrl(url))) {
    throw new Error(`Frame ${value.id} must include public fallback image URLs.`);
  }
  return {
    id: value.id as SplatTrialFrameId,
    time: value.time,
    splatUrl: publicAssetPath(value.splatUrl),
    format: value.format as SplatTrialFormat,
    fallbackImages: fallbackImages.map(publicAssetPath),
  };
};

export const parseSplatTrialManifest = (value: unknown): SplatTrialManifest => {
  if (!isRecord(value)) {
    throw new Error("Splat trial manifest must be an object.");
  }
  if (value.id !== "future-splat-bench") {
    throw new Error("Splat trial manifest id must be future-splat-bench.");
  }
  if (typeof value.title !== "string" || value.title.trim().length === 0) {
    throw new Error("Splat trial manifest must include a title.");
  }
  if (value.renderer !== "playcanvas") {
    throw new Error("Splat trial manifest renderer must be playcanvas.");
  }
  if (!Array.isArray(value.frames) || value.frames.length === 0) {
    throw new Error("Splat trial manifest must include at least one frame.");
  }

  const frames = value.frames.map(parseFrame).slice().sort((a: SplatTrialFrame, b: SplatTrialFrame) => a.time - b.time);
  return {
    id: "future-splat-bench",
    title: value.title,
    renderer: "playcanvas",
    frames,
  };
};

export const loadSplatTrialManifest = async (
  url = publicAssetPath("assets/equipment-splats/v0/manifest.json"),
): Promise<SplatTrialManifest> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to load splat trial manifest (${response.status}).`);
  }
  return parseSplatTrialManifest(await response.json());
};

export const resolveSplatTrialFrame = (
  manifest: SplatTrialManifest,
  requestedId: string,
): SplatTrialFrame => {
  return manifest.frames.find((frame) => frame.id === requestedId) ?? manifest.frames[0];
};
