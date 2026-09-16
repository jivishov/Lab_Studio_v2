/**
 * Cycle 08 — every visual state the reducer assigns must be registered and must say so.
 *
 * Cycle 05 classified what content authors and what the two fallback tables name. Nothing
 * classified what the reducer writes into `contents.visualState` by itself, so eight assigned
 * states were registered nowhere and `measured-liquid` was registered with provenance asserting
 * the runtime never assigned it. `scripts/checkContentConsistency.mjs` enforces this as
 * `mirror/runtime-assigned-state-*`; this is the same invariant expressed where a reader of the
 * registry will meet it.
 *
 * Authored, not executed. See `docs/step-and-image-consistency-audit.md` §20.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import visualStateRegistry from "../visualStateRegistry.json";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const reducerSource = readFileSync(join(repositoryRoot, "src/runtime/reducer.ts"), "utf8");

/**
 * Reads each `visualState:` assignment with brace balancing, so it sees a bare literal, a ternary,
 * and a multi-line `?? "default"` chain alike. `stringSetting(params, "…")` is removed first: the
 * literal there names an action parameter, not a state.
 */
const runtimeAssignedStates = (): string[] => {
  const found = new Set<string>();
  const marker = /visualState:/g;
  let match: RegExpExecArray | null;
  while ((match = marker.exec(reducerSource))) {
    let depth = 0;
    let end = match.index + match[0].length;
    for (; end < reducerSource.length; end += 1) {
      const character = reducerSource[end];
      if ("([{".includes(character)) depth += 1;
      else if (")]}".includes(character)) {
        if (depth === 0) break;
        depth -= 1;
      } else if (character === "," && depth === 0) break;
    }
    const expression = reducerSource
      .slice(match.index + match[0].length, end)
      .replace(/stringSetting\(\s*params\s*,\s*"[A-Za-z]+"\s*\)/g, "");
    for (const literal of expression.matchAll(/"([a-z][a-z0-9]*(?:-[a-z0-9]+)*)"/g)) {
      found.add(literal[1]);
    }
  }
  return [...found].sort();
};

const byId = new Map(visualStateRegistry.states.map((state) => [state.id, state]));

/** The JSON import narrows `selectors` per entry, which makes a shared lookup unassignable. */
const selectorsOf = (state: { selectors?: readonly string[] }): readonly string[] =>
  (state.selectors ?? []) as readonly string[];

describe("runtime-assigned visual states", () => {
  it("finds the assignments it is meant to guard", () => {
    // A parser that silently matched nothing would make every assertion below vacuous.
    const assigned = runtimeAssignedStates();
    expect(assigned.length).toBeGreaterThan(8);
    expect(assigned).toContain("dry-precipitate");
    expect(assigned).toContain("cooled-residue");
    expect(assigned).not.toContain("visualState");
  });

  it("registers every state the reducer can put on screen", () => {
    const unregistered = runtimeAssignedStates().filter((state) => !byId.has(state));
    expect(unregistered).toEqual([]);
  });

  it("declares the runtime-assigned selector on each of them", () => {
    const undeclared = runtimeAssignedStates().filter(
      (state) => {
        const found = byId.get(state);
        return !found || !selectorsOf(found).includes("runtime-assigned");
      },
    );
    expect(undeclared).toEqual([]);
  });

  it("keeps the Investigation 3 dryness stages distinguishable in state, not colour", () => {
    // The three dry appearances are deliberately identical, and each says so about the others.
    const dry = byId.get("dry-precipitate");
    const broken = byId.get("broken-dry-precipitate");
    const cooled = byId.get("cooled-dry-precipitate");
    expect(dry?.solidStyle).toEqual(broken?.solidStyle);
    expect(broken?.solidStyle).toEqual(cooled?.solidStyle);
    expect(broken?.sharesAppearanceWith).toContain("cooled-dry-precipitate");
    expect(cooled?.sharesAppearanceWith).toContain("broken-dry-precipitate");
    expect(dry?.sharesAppearanceWith).toEqual(
      expect.arrayContaining(["broken-dry-precipitate", "cooled-dry-precipitate"]),
    );
  });

  it("attributes each still-unresolved runtime state to an owning cycle", () => {
    for (const state of visualStateRegistry.states) {
      if (state.disposition !== "unresolved") continue;
      if (!selectorsOf(state).includes("runtime-assigned")) continue;
      expect(state.ownerCycle, `${state.id} has no owning cycle`).toBeTruthy();
    }
  });
});
