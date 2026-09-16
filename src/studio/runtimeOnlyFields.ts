export const runtimeOnlyJsonKeys = new Set([
  "assetPath",
  "assetUrl",
  "assetHash",
  "resolvedAssetUrl",
  "blobUrl",
  "hash",
  "fileId",
  "naturalWidth",
  "naturalHeight",
  "imageElement",
  "runtimeId",
  "generatedAssetPath",
  "_runtime",
  "_resolved",
]);

export const stripRuntimeOnlyFields = <T>(value: T): T =>
  JSON.parse(JSON.stringify(value, (key, child) => runtimeOnlyJsonKeys.has(key) ? undefined : child)) as T;
