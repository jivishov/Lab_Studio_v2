export const resolveGestureAssetUrl = (baseUrl: string, path: string): string => {
  const base = baseUrl || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return `${normalizedBase}${path.replace(/^\/+/, "")}`;
};
