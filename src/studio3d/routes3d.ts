/**
 * Routes of the additive Lab Studio 3D app, all under `#/3d` (plan §4.2). The shell's
 * `parseHashRoute` delegates here only while the `studio3dV1` flag is on.
 */
export type Studio3DRoute =
  | { view: "home" }
  | { view: "studio" }
  | { view: "technique"; techniqueId: string }
  | { view: "play"; labId: string };

/** `segments` are the hash path segments after `3d`, without the query string. */
export const parseStudio3DRoute = (segments: readonly string[]): Studio3DRoute => {
  const [view, id] = segments;
  if (view === "studio") return { view: "studio" };
  if (view === "technique" && id) return { view: "technique", techniqueId: id };
  if (view === "play" && id) return { view: "play", labId: id };
  return { view: "home" };
};

export const studio3DRouteHash = (route: Studio3DRoute): string => {
  if (route.view === "studio") return "#/3d/studio";
  if (route.view === "technique") return `#/3d/technique/${route.techniqueId}`;
  if (route.view === "play") return `#/3d/play/${route.labId}`;
  return "#/3d";
};

/**
 * The existing 2D route for the same content. When the 3D view cannot run, the app navigates
 * here instead of importing the 2D player (plan D3).
 */
export const studio3DFallbackHash = (route: Studio3DRoute): string => {
  if (route.view === "studio") return "#/studio";
  if (route.view === "technique") return `#/technique/${route.techniqueId}`;
  if (route.view === "play") return `#/play/${route.labId}`;
  return "#/techniques";
};
