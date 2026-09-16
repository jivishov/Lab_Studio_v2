import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoots = [
  join(process.cwd(), "src", "platform"),
  join(process.cwd(), "src", "domain-packs", "chemistry"),
];

const sourceFiles = async (): Promise<string[]> => {
  const result: string[] = [];
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === "__tests__" || entry.name === "__fixtures__") continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.name.endsWith(".ts")) result.push(path);
    }
  };
  for (const root of sourceRoots) await visit(root);
  return result.sort();
};

describe("Cycle 02 framework boundary", () => {
  it("keeps platform and chemistry read-adapter contracts free of React and browser-only APIs", async () => {
    for (const path of await sourceFiles()) {
      const source = await readFile(path, "utf8");
      expect(source, path).not.toMatch(/from\s+["'](?:react|react-dom|@xyflow\/react)["']/);
      expect(source, path).not.toMatch(/\b(?:window|document|navigator|localStorage|sessionStorage)\s*\./);
    }
  });
});
