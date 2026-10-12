import { act, renderHook } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_THEME, readTheme, THEME_KEY, useStudio3DTheme, writeTheme } from "../ui/theme";

const styles = (name: string) => readFileSync(join(process.cwd(), "src", "studio3d", "styles", name), "utf8");

/** Every selector of a stylesheet, keyframes left out; a list is split at its top-level commas. */
const selectors = (css: string) => {
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
  return [...rules.matchAll(/([^{};]+)\{/g)]
    .map((match) => match[1].trim())
    .filter((selector) => !selector.startsWith("@"))
    .flatMap((list) => {
      const parts: string[] = [];
      let depth = 0;
      let current = "";
      for (const char of list) {
        if (char === "(") depth += 1;
        if (char === ")") depth -= 1;
        if (char === "," && depth === 0) { parts.push(current.trim()); current = ""; } else current += char;
      }
      return [...parts, current.trim()];
    });
};

describe("the two 3D themes (you, 2026-10-12)", () => {
  beforeEach(() => localStorage.clear());

  it("starts on the HUD, keeps a choice and ignores a stored value it does not know", () => {
    expect(DEFAULT_THEME).toBe("hud");
    expect(readTheme()).toBe("hud");
    writeTheme("light");
    expect(localStorage.getItem(THEME_KEY)).toBe("light");
    expect(readTheme()).toBe("light");
    localStorage.setItem(THEME_KEY, "neon");
    expect(readTheme()).toBe("light");
  });

  it("tells every caller of a switch", () => {
    writeTheme("hud");
    const first = renderHook(() => useStudio3DTheme());
    const second = renderHook(() => useStudio3DTheme());
    expect(first.result.current[0]).toBe("hud");
    act(() => first.result.current[1]("light"));
    expect(second.result.current[0]).toBe("light");
    act(() => second.result.current[1]("hud"));
    expect(first.result.current[0]).toBe("hud");
  });

  it("keeps every HUD rule inside the HUD theme, so the Light theme stays the original look", () => {
    for (const sheet of ["stepHud.css", "hud.css"]) {
      const all = selectors(styles(sheet));
      expect(all.length).toBeGreaterThan(40);
      expect(all.filter((selector) => !selector.startsWith('.s3d[data-theme="hud"]')), sheet).toEqual([]);
    }
  });

  it("gives the Light theme a value for every token the HUD theme remaps", () => {
    const tokens = styles("tokens.css");
    const names = (block: string) => [...block.matchAll(/--([a-z0-9-]+):/g)].map((match) => match[1]);
    const light = new Set(names(tokens.slice(tokens.indexOf(":root {"), tokens.indexOf("\n}"))));
    const hudStart = tokens.indexOf('.s3d[data-theme="hud"] {');
    expect(hudStart).toBeGreaterThan(0);
    const hud = names(tokens.slice(hudStart, tokens.indexOf("\n}", hudStart)));
    expect(hud.length).toBeGreaterThan(50);
    expect(hud.filter((name) => !light.has(name))).toEqual([]);
  });
});
