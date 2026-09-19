import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * `scripts/generateHandWarmerCalorimetry.mjs` writes both `public/techniques/hand-warmer-calorimetry.json`
 * and `public/labs/hand-warmer-calorimetry.json`, so the committed files must match what it emits.
 * The generator itself asserts its own invariants and throws (143 traceability rows, 310
 * actions/nodes, 264 mandatory-path assessments), which is why these cases read the *output*:
 * they catch a hand edit to generated JSON, which no assertion inside the generator can see.
 *
 * Not executed under the AGENTS.md repository validation policy.
 */

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const read = (relative) => JSON.parse(readFileSync(join(root, relative), "utf8"));

describe("hand-warmer calorimetry generated definitions", () => {
  const technique = read("public/techniques/hand-warmer-calorimetry.json");
  const lab = read("public/labs/hand-warmer-calorimetry.json");

  it("keeps the 143-row traceability source and its 310 generated actions", () => {
    const traceability = readFileSync(
      join(root, "experiments/lab-studio/docs/hand-warmer-calorimetry/source-traceability.md"),
      "utf8",
    );
    const rows = [...traceability.matchAll(/^\| ([A-Z][A-Z0-9-]+) `([^`]+)` \| ([^|]+) \|/gm)];
    expect(rows).toHaveLength(143);
    expect(technique.actions).toHaveLength(310);
    expect(technique.process.nodes).toHaveLength(310);
    expect(technique.successCriteria).toHaveLength(264);
    expect(lab.assessments).toHaveLength(0);
  });

  it("publishes the lab as a composition source that imports the technique by exact version", () => {
    expect(lab.techniqueRefs).toBeUndefined();
    expect(lab.techniqueInstances).toHaveLength(1);
    expect(lab.techniqueInstances[0]).toMatchObject({
      instanceId: "hand-warmer",
      techniqueId: "hand-warmer-calorimetry",
      version: "2.5.1",
    });
    expect(technique.metadata.version).toBe("2.5.1");
    // The imported technique stays published separately; the lab owns only its inquiry wrapper.
    expect(lab.techniques).toEqual([]);
    expect(lab.actions).toHaveLength(3);
    expect(lab.initialState.equipment).toHaveLength(22);
  });

  it("keeps the lab-owned inquiry wrapper separate from imported technique actions", () => {
    const published = new Set(technique.actions.map((action) => action.id));
    const local = new Set(lab.actions.map((action) => action.id));
    for (const node of lab.process.nodes) {
      expect(local, `node ${node.id}`).toContain(node.actionId);
      for (const rule of node.validation) expect(local, `rule ${rule.id}`).toContain(rule.actionId);
    }
    expect([...local].filter((actionId) => published.has(actionId))).toEqual([]);
    expect(lab.compositionStart).toEqual({ kind: "lab-node", nodeId: "HW-PLAN-01-node" });
    expect(lab.compositionConnections).toHaveLength(2);
  });

  it("keeps the catalog card description in step with the lab it points at", () => {
    const entry = read("public/labs/index.json").find((item) => item.id === "hand-warmer-calorimetry");
    // The generator owns both strings; they had drifted before Cycle 04 re-ran it.
    expect(entry.description).toBe(lab.description);
  });

  it("keeps build-time traceability out of the client-visible definitions", () => {
    // Cycle 12 closes F-23 through the generator. The source rows remain in the generator input and
    // the build-time source-trace registry; neither the action parameters nor process-node config
    // serializes that provenance into the Student Player payload.
    const withBasis = technique.actions.filter(
      (action) => typeof action.parameters?.traceabilityBasis === "string",
    );
    expect(withBasis).toHaveLength(0);
    for (const node of lab.process.nodes) {
      expect(node.config.traceabilityId).toBeUndefined();
      expect(node.config.basis).toBeUndefined();
    }
    expect(lab.actions).toHaveLength(3);
    expect(JSON.stringify(lab.actions)).not.toContain("traceabilityBasis");
    expect(JSON.stringify(technique.actions)).not.toContain("traceabilityBasis");
  });

  it("keeps CAL-04 through CAL-12 and the first beaker workflow on valid apparatus targets", () => {
    const byId = new Map(technique.actions.map((action) => [action.id, action]));
    const visualStates = new Map([
      ["CAL-04", "CAL-04"],
      ["CAL-05", "CAL-05"],
      ["P1-04", "CAL-06"],
      ["P1-11", "CAL-07"],
      ["P1-14", "CAL-08"],
      ["P1-21", "CAL-09"],
      ["P1-22", "CAL-10"],
      ["P1-24", "CAL-11"],
      ["P1-29", "CAL-12"],
    ]);
    for (const [actionId, state] of visualStates) {
      const action = byId.get(actionId);
      expect(action, actionId).toBeDefined();
      expect(action.parameters.visualProxyInstanceId, actionId).toBe("hand-warmer-calorimeter-1");
      expect(action.parameters.visualProxyVisualState, actionId).toBe(state);
      expect(action.interaction.accessibleLabel.trim(), actionId).not.toBe("");
      expect(action.feedback.invalid.trim(), actionId).not.toBe("");
    }

    expect(byId.get("VOL-02")).toMatchObject({
      verb: "measureVolume",
      parameters: {
        sourceDefinitionId: "distilled-water-bottle-2l",
        targetDefinitionId: "graduated-cylinder",
        volumeMl: 95,
      },
    });
    expect(byId.get("VOL-03")).toMatchObject({
      verb: "measureVolume",
      parameters: {
        sourceDefinitionId: "distilled-water-bottle-2l",
        targetDefinitionId: "graduated-cylinder",
        targetVolumeMl: 99,
      },
      interaction: {
        type: "pourInto",
        sourceDefinitionId: "distilled-water-bottle-2l",
        targetDefinitionId: "graduated-cylinder",
      },
    });
    expect(byId.get("VOL-05")).toMatchObject({
      verb: "measureVolume",
      parameters: { targetVolumeMl: 100 },
      interaction: {
        type: "pourInto",
        sourceDefinitionId: "distilled-water-bottle-2l",
        targetDefinitionId: "graduated-cylinder",
      },
    });
    expect(byId.get("P1-02-T2")?.parameters).toMatchObject({ volumeMl: 100 });
    expect(byId.get("P1-09")?.parameters).toMatchObject({
      measurementId: "part1-trial-1-initial-temperature",
      recordedTemperatureTargetInstanceId: "hand-warmer-calorimeter-1",
      recordedTemperatureLabel: "Recorded initial temperature",
      recordedTemperaturePrecision: 1,
    });
    expect(byId.get("P1-09-T2")?.parameters).toMatchObject({
      measurementId: "part1-trial-2-initial-temperature",
      recordedTemperatureTargetInstanceId: "hand-warmer-calorimeter-1",
      recordedTemperatureLabel: "Recorded initial temperature",
      recordedTemperaturePrecision: 1,
    });
    expect(byId.get("P1-D07")?.parameters.clearRecordedTemperatureInstanceIds).toEqual([
      "hand-warmer-calorimeter-1",
    ]);

    expect(byId.get("CAL-05")?.interaction).toMatchObject({
      type: "snapIntoTarget",
      sourceDefinitionId: "probe-thermometer",
      targetDefinitionId: "hand-warmer-calorimeter",
      snapZoneId: "hand-warmer-probe-hole",
    });
    expect(byId.get("P1-11")?.interaction).toMatchObject({
      sourceDefinitionId: "magnetic-stir-bar",
      targetDefinitionId: "hand-warmer-calorimeter",
      snapZoneId: "hand-warmer-stir-bar-well",
    });
    expect(byId.get("P2-H01")?.interaction).toMatchObject({
      type: "dragToZone",
      sourceDefinitionId: "beaker-150ml",
      stationId: "workbench",
    });
    expect(byId.get("P2-H04")?.interaction).toMatchObject({
      type: "snapIntoTarget",
      sourceDefinitionId: "beaker-150ml",
      targetDefinitionId: "hot-plate-stirrer",
      snapZoneId: "hot-plate-stirrer-deck",
    });
    expect(byId.get("P2-H09")?.parameters).toMatchObject({
      sourceInstanceId: "beaker-150ml-1",
      targetInstanceId: "hot-plate-stirrer-1",
      targetTemperatureC: 50,
    });
    expect(byId.get("P2-H10")?.interaction).toMatchObject({
      type: "dragToZone",
      sourceDefinitionId: "beaker-150ml",
      stationId: "workbench",
    });
  });
});
