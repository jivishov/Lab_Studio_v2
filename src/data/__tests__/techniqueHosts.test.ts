import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HOST_LABS_BY_TECHNIQUE, hostLabsForTechnique } from "../techniqueHosts";

/**
 * The host table is a copy, so this is the thing that keeps it honest.
 *
 * `src/data/techniqueHosts.ts` records which labs compose which techniques so the standalone route
 * can offer a real link instead of telling a teacher to find a host themselves. Reading that back
 * at runtime would mean fetching every lab definition to render one sentence, so it is written
 * down — and re-derived here from the shipped catalog, so a new lab, a renamed technique or a
 * dropped composition fails this instead of quietly pointing somewhere wrong.
 *
 * Authored, not executed, under the AGENTS.md repository validation policy.
 */
const readJson = async <T,>(...parts: string[]): Promise<T> =>
  JSON.parse(await readFile(join(process.cwd(), "public", ...parts), "utf8")) as T;

interface LabSource {
  techniqueInstances?: Array<{ techniqueId?: string }>;
  techniques?: Array<{ id?: string } | string>;
}

const deriveHosts = async (): Promise<Map<string, string[]>> => {
  const labs = await readJson<Array<{ id: string; file: string }>>("labs", "index.json");
  const indexed = new Set(
    (await readJson<Array<{ id: string }>>("techniques", "index.json")).map((entry) => entry.id),
  );
  const hosts = new Map<string, string[]>();
  for (const entry of labs) {
    const lab = await readJson<LabSource>("labs", entry.file);
    const composed = new Set<string>();
    for (const instance of lab.techniqueInstances ?? []) {
      if (instance.techniqueId) composed.add(instance.techniqueId);
    }
    for (const technique of lab.techniques ?? []) {
      const id = typeof technique === "string" ? technique : technique.id;
      if (id) composed.add(id);
    }
    for (const id of composed) {
      if (!indexed.has(id)) continue;
      hosts.set(id, [...(hosts.get(id) ?? []), entry.id]);
    }
  }
  return hosts;
};

describe("technique host labs", () => {
  it("matches the labs that actually compose each indexed technique", async () => {
    const derived = await deriveHosts();
    const recorded = new Map(
      Object.entries(HOST_LABS_BY_TECHNIQUE).map(([id, labs]) => [id, [...labs]]),
    );

    expect([...recorded.keys()].sort()).toEqual([...derived.keys()].sort());
    for (const [id, labs] of derived) {
      expect(recorded.get(id), id).toEqual(labs);
    }
  });

  it("resolves a host to a title and a route a teacher can follow", () => {
    const hosts = hostLabsForTechnique("thermal-decomposition-mass-loss");
    expect(hosts).toHaveLength(1);
    expect(hosts[0].id).toBe("green-chemistry-mixture-purification");
    expect(hosts[0].href).toBe("#/play/green-chemistry-mixture-purification");
    // The title comes from the catalog rather than the id, so the link reads as the lab's name.
    expect(hosts[0].title).not.toBe(hosts[0].id);
  });

  it("reports no host for a technique no lab composes", () => {
    // These are the activities the standalone configuration path exists for. An empty list is the
    // honest answer; it must not be a missing entry that reads as "not looked at".
    for (const id of [
      "beers-law-calibration",
      "dilution",
      "hard-water-gravimetry",
      "making-solution",
      "transmittance-dilution",
      "weighing",
    ]) {
      expect(hostLabsForTechnique(id), id).toEqual([]);
    }
  });
});
