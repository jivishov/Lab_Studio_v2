import { describe, expect, it } from "vitest";
import { validateAssayDefinition } from "../../types/validation";
import {
  cycle11MicObservationSet,
  cycle11XttObservationSet,
  createCycle11MicAssay,
  createCycle11XttAssay,
  getCycle11ProtocolGoldenWorkflows,
} from "../__fixtures__/cycle11ProtocolFixtures";
import { analyzeBrothMicrodilutionEndpoint, analyzeXttMetabolicActivity } from "../analysis";
import {
  educationalBrothMicrodilutionProfile,
  serializeAssayProtocolProfile,
  validateAssayProtocolProfile,
  xttMetabolicActivityProfile,
} from "../registry";

describe("Cycle 11 assay protocol profiles", () => {
  it("validates immutable checked profiles and canonical round trips", () => {
    for (const profile of [xttMetabolicActivityProfile, educationalBrothMicrodilutionProfile]) {
      expect(validateAssayProtocolProfile(profile).ok).toBe(true);
      expect(serializeAssayProtocolProfile(JSON.parse(serializeAssayProtocolProfile(profile))))
        .toBe(serializeAssayProtocolProfile(profile));
    }
    expect(validateAssayProtocolProfile({ ...xttMetabolicActivityProfile, schemaVersion: "2.0" }).ok).toBe(false);
  });

  it("keeps XTT terminology metabolic and reports source provenance", () => {
    const analysis = analyzeXttMetabolicActivity(createCycle11XttAssay(), cycle11XttObservationSet, xttMetabolicActivityProfile);
    expect(analysis.status).toBe("complete");
    expect(analysis.scientificBoundary).toContain("metabolic-activity proxy");
    expect(JSON.stringify(analysis).toLowerCase()).not.toContain("is a direct cell count");
    expect(analysis.dataSources).toEqual(["synthetic"]);
  });

  it("returns the lowest monotonic no-growth concentration without clinical fields", () => {
    const analysis = analyzeBrothMicrodilutionEndpoint(createCycle11MicAssay(), cycle11MicObservationSet, educationalBrothMicrodilutionProfile);
    expect(analysis.status).toBe("complete");
    expect(analysis.endpoint?.concentration).toEqual({ value: "0.5", unit: "uM" });
    expect(analysis.endpoint?.terminology).toContain("non-clinical");
    expect(JSON.stringify(analysis)).not.toMatch(/susceptibilityCategory|treatmentAdvice/);
  });

  it("makes invalid controls and nonmonotonic endpoints indeterminate", () => {
    const invalidControls = structuredClone(cycle11MicObservationSet);
    invalidControls.observations[0].rawValue = "0";
    expect(analyzeBrothMicrodilutionEndpoint(createCycle11MicAssay(), invalidControls, educationalBrothMicrodilutionProfile).status).toBe("indeterminate");
    const nonmonotonic = structuredClone(cycle11MicObservationSet);
    nonmonotonic.observations.find(({ wellId }) => wellId.endsWith(":B5"))!.rawValue = "1";
    nonmonotonic.observations.find(({ wellId }) => wellId.endsWith(":B6"))!.rawValue = "1";
    expect(analyzeBrothMicrodilutionEndpoint(createCycle11MicAssay(), nonmonotonic, educationalBrothMicrodilutionProfile).status).toBe("indeterminate");
  });

  it("provides schema-valid assay artifacts and complete golden workflows", () => {
    expect(validateAssayDefinition(createCycle11XttAssay()).ok).toBe(true);
    expect(validateAssayDefinition(createCycle11MicAssay()).ok).toBe(true);
    const workflows = getCycle11ProtocolGoldenWorkflows();
    expect(workflows.xtt.analysis.status).toBe("complete");
    expect(workflows.mic.analysis.status).toBe("complete");
  });
});
