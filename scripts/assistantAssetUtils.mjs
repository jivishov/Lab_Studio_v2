export const sanitizeImageFilename = (
  filename,
  fallback = "lab-studio-image",
  timestamp = Date.now(),
) => {
  const safeFallback = String(fallback || "lab-studio-image")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "lab-studio-image";
  const base = String(filename || safeFallback)
    .replace(/\.[a-z0-9]+$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return `${base || safeFallback}-${timestamp}.png`;
};

export const publicAssetPathForFilename = (filename) =>
  `assets/assistant-generated/${filename}`;
