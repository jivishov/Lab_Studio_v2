import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateLabDefinition, validateTechniqueDefinition } from "../validation";

const root = process.cwd();
const load = (path: string) => JSON.parse(readFileSync(join(root, path), "utf8"));

describe("complete hand-warmer definitions", () => {
  const technique = load("public/techniques/hand-warmer-calorimetry.json");
  const lab = load("public/labs/hand-warmer-calorimetry.json");
  type AuthoredAction = { id: string; parameters: Record<string, unknown> };
  type AuthoredEquipment = {
    id: string;
    location: string;
    contents: { kind: string };
  };

  it("publishes a valid technique and lab with exact traceability coverage plus the second Part 1 trial", () => {
    expect(validateTechniqueDefinition(technique).errors).toEqual([]);
    expect(validateLabDefinition(lab).errors).toEqual([]);
    const traceability = readFileSync(
      join(root, "experiments/lab-studio/docs/hand-warmer-calorimetry/source-traceability.md"),
      "utf8",
    );
    const rows = [...traceability.matchAll(/^\| ([A-Z][A-Z0-9-]+) `([^`]+)` \| ([^|]+) \|/gm)];
    expect(rows).toHaveLength(143);
    const ids = technique.actions.map((action: { id: string }) => action.id);
    expect(ids).toHaveLength(310);
    expect(new Set(ids).size).toBe(310);
    for (const prefix of ["SAF-", "CAL-", "VOL-", "P1-", "P2-", "INV-", "DA-", "CER-"]) {
      expect(ids.some((id: string) => id.startsWith(prefix))).toBe(true);
    }
    expect(technique.metadata.tags).toContain("143-action-traceability");
    expect(technique.process.nodes).toHaveLength(310);
  });

  it("preserves Part 1 peak, non-splash stirring, fresh-trial, and cleanup actions", () => {
    const byId = new Map<string, AuthoredAction>(
      technique.actions.map((action: AuthoredAction) => [action.id, action]),
    );
    expect(byId.get("P1-26")?.parameters.temperatureEvidenceKind).toBe("peak");
    expect(byId.get("P1-26")?.parameters.dataSeriesId).toBe("part1-trial-1-temperature-response");
    expect(byId.get("P1-22")?.parameters.thermalResponseMode).toBe("dissolution");
    expect(byId.get("P1-14")?.parameters.splashThreshold).toBe(7);
    for (const id of [
      "P1-D01",
      "P1-D02",
      "P1-D03",
      "P1-D04",
      "P1-D05",
      "P1-D06-CUP",
      "P1-D06-PROBE",
      "P1-D06-CYLINDER",
      "P1-D06-CONTAINER",
      "P1-D07",
    ]) {
      expect(byId.has(id)).toBe(true);
    }
    expect(technique.process.nodes.find((node: { id: string }) => node.id === "p1-02-node")?.config.evidenceScope).toBe("part1-trial");
    expect(technique.process.nodes.find((node: { id: string }) => node.id === "p1-02-t2-node")?.config.evidenceScope).toBe("part1-trial-2");
    expect(byId.get("P1-02-T2")?.parameters.measurementId).toBe("part1-trial-2-water-volume");
    expect(byId.get("P1-22-T2")?.parameters.dataSeriesId).toBe("part1-trial-2-temperature-response");
  });

  it("starts measured vessels empty and keeps the temporary composite on the live bench", () => {
    const equipment = new Map<string, AuthoredEquipment>(
      technique.initialState.equipment.map((item: AuthoredEquipment) => [item.id, item]),
    );
    expect(equipment.get("inner-cup-1")?.contents.kind).toBe("empty");
    expect(equipment.get("beaker-150ml-1")?.contents.kind).toBe("empty");
    expect(equipment.get("hand-warmer-calorimeter-1")?.location).toBe("workbench");
  });

  it("preserves calibration heating, exact timing, all readings, and three-determination configuration", () => {
    const byId = new Map<string, AuthoredAction>(
      technique.actions.map((action: AuthoredAction) => [action.id, action]),
    );
    expect(byId.get("P2-H09")?.parameters).toMatchObject({
      thermalMode: "targetTemperature",
      targetTemperatureC: 50,
      toleranceC: 3,
    });
    expect(byId.get("P2-M13")?.parameters).toMatchObject({ waitSeconds: 15, requiredSeconds: 15 });
    expect(byId.get("P2-M14")?.parameters.temperatureEvidenceKind).toBe("timed");
    for (const id of ["P2-M03", "P2-M04", "P2-M07", "P2-M08", "P2-M15"]) {
      expect(byId.has(id)).toBe(true);
    }
    expect(technique.metadata.tags).toContain("three-calibration-determinations-default");
    expect(technique.metadata.tags).toContain("three-calibration-determinations-runtime");
    expect(byId.get("P2-M14-D2")?.parameters.evidenceId).toBe("calibration-d2-mixture-temperature");
    expect(byId.get("P2-M14-D3")?.parameters.evidenceId).toBe("calibration-d3-mixture-temperature");
  });
});
