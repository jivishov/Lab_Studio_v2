import { describe, expect, it } from "vitest";
import { parseHashRoute } from "../routes";

describe("parseHashRoute", () => {
  it("parses primary catalog and authoring routes", () => {
    expect(parseHashRoute("#/")).toEqual({ name: "home" });
    expect(parseHashRoute("")).toEqual({ name: "home" });
    expect(parseHashRoute("#/studio")).toEqual({ name: "studio" });
    expect(parseHashRoute("#/labs")).toEqual({ name: "labs" });
    expect(parseHashRoute("#/techniques")).toEqual({ name: "techniques" });
  });

  it("parses existing execution and prototype routes", () => {
    expect(parseHashRoute("#/play/hard-water-demo")).toEqual({
      name: "play",
      labId: "hard-water-demo",
    });
    expect(parseHashRoute("#/technique/filtration")).toEqual({
      name: "technique",
      techniqueId: "filtration",
    });
    expect(parseHashRoute("#/case/acid-base-titration")).toEqual({
      name: "case",
      caseId: "acid-base-titration",
    });
    expect(parseHashRoute("#/trial/realistic-equipment")).toEqual({
      name: "trial",
      trialId: "realistic-equipment",
    });
    expect(parseHashRoute("#/trial/goblin-animation")).toEqual({
      name: "trial",
      trialId: "goblin-animation",
    });
    expect(parseHashRoute("#/trial/goblin-threejs")).toEqual({
      name: "trial",
      trialId: "goblin-threejs",
    });
  });

  it("ignores query strings and falls back to home for unknown routes", () => {
    expect(parseHashRoute("#/labs?filter=titration")).toEqual({ name: "labs" });
    expect(parseHashRoute("#/unknown")).toEqual({ name: "home" });
  });

  it("keeps every assay route unavailable while the assay flag is off", () => {
    const flags = { assayStudioV1: false, causalystLocalV1: false, causalystLtiV1: false };
    expect(parseHashRoute("#/assays", flags)).toEqual({ name: "home" });
    expect(parseHashRoute("#/assay-studio", flags)).toEqual({ name: "home" });
    expect(parseHashRoute("#/assay/demo-assay", flags)).toEqual({ name: "home" });
    expect(parseHashRoute("#/assay-results/demo-assay", flags)).toEqual({ name: "home" });
    expect(parseHashRoute("#/causalyst", flags)).toEqual({ name: "home" });
  });

  it("parses the assay library, authoring, rehearsal, and results routes when enabled", () => {
    const flags = { assayStudioV1: true, causalystLocalV1: false, causalystLtiV1: false };
    expect(parseHashRoute("#/assays", flags)).toEqual({ name: "assays" });
    expect(parseHashRoute("#/assay-studio", flags)).toEqual({ name: "assay-studio" });
    expect(parseHashRoute("#/assay/demo-assay", flags)).toEqual({
      name: "assay",
      assayId: "demo-assay",
    });
    expect(parseHashRoute("#/assay-results/demo-assay?view=table", flags)).toEqual({
      name: "assay-results",
      assayId: "demo-assay",
    });
  });

  it("gates Causalyst local routes independently", () => {
    const flags = { assayStudioV1: false, causalystLocalV1: true, causalystLtiV1: false };
    expect(parseHashRoute("#/causalyst", flags)).toEqual({ name: "causalyst" });
    expect(parseHashRoute("#/causalyst-author", flags)).toEqual({ name: "causalyst-author" });
    expect(parseHashRoute("#/causalyst-author/example", flags)).toEqual({
      name: "causalyst-author",
      assessmentId: "example",
    });
    expect(parseHashRoute("#/causalyst-preview/example", flags)).toEqual({
      name: "causalyst-preview",
      assessmentId: "example",
    });
  });

  it("gates the cookie-independent LTI route separately from local Causalyst", () => {
    const flags = { assayStudioV1: false, causalystLocalV1: false, causalystLtiV1: true };
    expect(parseHashRoute("#/causalyst-lti?launchCode=one-time", flags)).toEqual({
      name: "causalyst-lti",
    });
  });
});
