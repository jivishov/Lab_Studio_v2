import { readFile } from "node:fs/promises";
import { extname } from "node:path";

export const resolve = async (specifier, context, nextResolve) => {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if ((error?.code === "ERR_MODULE_NOT_FOUND" || error?.code === "ERR_UNSUPPORTED_DIR_IMPORT") &&
      specifier.startsWith(".") && extname(specifier) === "") {
      try {
        return await nextResolve(`${specifier}.ts`, context);
      } catch (fileError) {
        if (fileError?.code === "ERR_MODULE_NOT_FOUND") {
          return nextResolve(`${specifier}/index.ts`, context);
        }
        throw fileError;
      }
    }
    throw error;
  }
};

export const load = async (url, context, nextLoad) => {
  if (url.endsWith(".json")) {
    const source = await readFile(new URL(url), "utf8");
    return { format: "module", shortCircuit: true, source: `export default ${source};` };
  }
  const loaded = await nextLoad(url, context);
  if (url.endsWith(".ts") && typeof loaded.source !== "undefined") {
    const source = Buffer.isBuffer(loaded.source) ? loaded.source.toString("utf8") : String(loaded.source);
    return { ...loaded, source: source.replaceAll("import.meta.env.BASE_URL", '"/"') };
  }
  return loaded;
};
