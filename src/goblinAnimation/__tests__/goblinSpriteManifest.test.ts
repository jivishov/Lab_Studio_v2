import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getGoblinSpriteDefinition,
  goblinSpriteManifest,
  validateGoblinSpriteManifest,
} from "../goblinSpriteManifest";

describe("goblin sprite manifest", () => {
  it("validates the in-app sprite manifest", () => {
    const result = validateGoblinSpriteManifest(goblinSpriteManifest);
    expect(result).toEqual({ ok: true, errors: [] });
    expect(getGoblinSpriteDefinition("apparatus-helper/pour")).toMatchObject({
      characterId: "apparatus-helper",
      motion: "pour",
      frameCount: 16,
      fps: 12,
      display: { width: 288, height: 288, scale: 1 },
      eventFrames: { pourStart: 9, pourHoldStart: 9, pourEnd: 11 },
      stageCue: { x: 56, y: 83, facing: "right" },
    });
  });

  it("rejects malformed sprite metadata", () => {
    const result = validateGoblinSpriteManifest({
      version: "bad",
      sprites: [
        {
          ...goblinSpriteManifest.sprites[0],
          id: "apparatus-helper/pour",
          frameCount: 16,
          sourceFrames: [],
          stillFrame: 20,
          display: { width: 0, height: 288, scale: 1 },
          eventFrames: { pourStart: 12, pourEnd: 9 },
          stageCue: { x: 120, y: 83, facing: "right" },
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/sourceFrames/);
    expect(result.errors.join(" ")).toMatch(/stillFrame/);
    expect(result.errors.join(" ")).toMatch(/display/);
    expect(result.errors.join(" ")).toMatch(/eventFrames|pourStart/);
    expect(result.errors.join(" ")).toMatch(/stageCue/);
  });

  it("keeps public sprite files and manifest in a valid build shape", () => {
    expect(existsSync(join(process.cwd(), "public", "assets", "goblin-mode", "sprites", "v1", "manifest.json"))).toBe(true);
    execFileSync("python", ["scripts/validateGoblinSprites.py"], { cwd: process.cwd(), stdio: "pipe" });
  });
});
