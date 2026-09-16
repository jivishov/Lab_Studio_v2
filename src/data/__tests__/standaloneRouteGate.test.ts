import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { TechniqueDefinition } from "../../domain/types";
import {
  standaloneTechniqueConfigurationBlocker,
  unresolvedConfigurationSlots,
} from "../techniqueConfiguration";

/** Authored route-gate regression; intentionally not executed under the current verification ceiling. */
const readTechnique = async (id: string): Promise<TechniqueDefinition> =>
  JSON.parse(
    await readFile(join(process.cwd(), "public", "techniques", `${id}.json`), "utf8"),
  ) as TechniqueDefinition;

describe("standalone technique route gate", () => {
  it("surfaces a host blocker even when a technique shape has no config template", async () => {
    const templateFree = await readTechnique("tablet-separation");
    expect(unresolvedConfigurationSlots(templateFree)).toEqual([]);

    // The route decision is intentionally tested independently of raw template presence. Reusing
    // a template-free shape under an actually hosted id proves that host policy, not brace scanning,
    // is what causes the standalone setup gate to render.
    const hostedShape: TechniqueDefinition = { ...templateFree, id: "transfer" };
    expect(standaloneTechniqueConfigurationBlocker(hostedShape)).toMatch(/supported composed lab route/i);
    expect(unresolvedConfigurationSlots(hostedShape)).toEqual(["__standalone-route-blocked__"]);
  });
});
