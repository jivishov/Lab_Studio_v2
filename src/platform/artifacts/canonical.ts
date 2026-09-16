const sortJson = (value: unknown): unknown => {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortJson);
  return Object.fromEntries(
    Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => [key, sortJson((value as Record<string, unknown>)[key])]),
  );
};

export const serializeArtifactPackage = (value: unknown): string =>
  `${JSON.stringify(sortJson(value), null, 2)}\n`;
