import { canonicalSerializeJson } from "../procedure-ir/canonical";
import { validatePlatformProcessGraph } from "./validation";
import type { PlatformProcessGraph } from "./types";

export const serializePlatformProcessGraph = (graph: PlatformProcessGraph): string => {
  const validation = validatePlatformProcessGraph(graph);
  if (!validation.ok) {
    throw new Error(validation.diagnostics.map(({ code, path }) => `${code} at ${path}`).join("; "));
  }
  return canonicalSerializeJson(validation.value);
};

export const parsePlatformProcessGraph = (serialized: string): PlatformProcessGraph => {
  const input: unknown = JSON.parse(serialized);
  const validation = validatePlatformProcessGraph(input);
  if (!validation.ok) {
    throw new Error(validation.diagnostics.map(({ code, path }) => `${code} at ${path}`).join("; "));
  }
  return validation.value;
};
