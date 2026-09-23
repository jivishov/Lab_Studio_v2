import { describe, expect, it } from "vitest";
import {
  parseStudio3DRoute,
  studio3DFallbackHash,
  studio3DRouteHash,
  type Studio3DRoute,
} from "../routes3d";

const routes: Studio3DRoute[] = [
  { view: "home" },
  { view: "studio" },
  { view: "technique", techniqueId: "transmittance-dilution" },
  { view: "play", labId: "hard-water-demo" },
];

describe("Lab Studio 3D routes", () => {
  it("round-trips every route through its hash", () => {
    for (const route of routes) {
      const segments = studio3DRouteHash(route).replace(/^#\/3d\/?/, "").split("/").filter(Boolean);
      expect(parseStudio3DRoute(segments)).toEqual(route);
    }
  });

  it("falls back to the 3D home for unknown or incomplete paths", () => {
    expect(parseStudio3DRoute([])).toEqual({ view: "home" });
    expect(parseStudio3DRoute(["unknown"])).toEqual({ view: "home" });
    expect(parseStudio3DRoute(["play"])).toEqual({ view: "home" });
  });

  it("navigates to the existing 2D route for the same content (plan D3)", () => {
    expect(routes.map(studio3DFallbackHash)).toEqual([
      "#/techniques",
      "#/studio",
      "#/technique/transmittance-dilution",
      "#/play/hard-water-demo",
    ]);
  });
});
