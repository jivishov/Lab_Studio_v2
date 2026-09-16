import { describe, expect, it } from "vitest";
import {
  parseSplatTrialManifest,
  resolveSplatTrialFrame,
  type SplatTrialManifest,
} from "../futureSplatBenchManifest";

const validManifest = {
  id: "future-splat-bench",
  title: "Future Splat Bench",
  renderer: "playcanvas",
  frames: [
    {
      id: "heat",
      time: 0.5,
      splatUrl: "/assets/equipment-splats/v0/future-splat-bench-heat.ply",
      format: "ply",
      fallbackImages: [
        "/assets/equipment-realistic/v1/bunsen-burner.svg",
        "/assets/equipment-realistic/v1/wire-gauze.svg",
      ],
    },
    {
      id: "setup",
      time: 0,
      splatUrl: "/assets/equipment-splats/v0/future-splat-bench-setup.ply",
      format: "ply",
      fallbackImages: ["/assets/equipment-realistic/v1/bunsen-burner.svg"],
    },
  ],
};

describe("future splat bench manifest", () => {
  it("parses public PlayCanvas frame metadata in timeline order", () => {
    const manifest = parseSplatTrialManifest(validManifest);
    expect(manifest.id).toBe("future-splat-bench");
    expect(manifest.renderer).toBe("playcanvas");
    expect(manifest.frames.map((frame) => frame.id)).toEqual(["setup", "heat"]);
  });

  it("rejects local paths and provider-style URLs", () => {
    expect(() =>
      parseSplatTrialManifest({
        ...validManifest,
        frames: [
          {
            ...validManifest.frames[0],
            splatUrl: "C:\\Users\\EmilJivishov\\capture.ply",
          },
        ],
      }),
    ).toThrow(/public splat URL/i);

    expect(() =>
      parseSplatTrialManifest({
        ...validManifest,
        frames: [
          {
            ...validManifest.frames[0],
            fallbackImages: ["https://example.com/equipment.svg"],
          },
        ],
      }),
    ).toThrow(/public fallback image/i);
  });

  it("falls back to the first timeline frame when a requested frame is missing", () => {
    const manifest = parseSplatTrialManifest(validManifest) as SplatTrialManifest;
    expect(resolveSplatTrialFrame(manifest, "cool").id).toBe("setup");
    expect(resolveSplatTrialFrame(manifest, "heat").id).toBe("heat");
  });
});
