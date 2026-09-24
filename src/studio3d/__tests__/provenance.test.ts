import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyTechniqueConfiguration } from "../../data/techniqueConfiguration";
import type { ActionDefinition, NotebookEntry, TechniqueDefinition } from "../../domain/types";
import { isConfigurationBinding, measurementProvenance, notebookProvenance } from "../player/provenance";

const readTechnique = (id: string): TechniqueDefinition =>
  JSON.parse(readFileSync(join(process.cwd(), "public", "techniques", `${id}.json`), "utf8")) as TechniqueDefinition;

const entry = (nodeId: string, type: NotebookEntry["type"] = "observation"): NotebookEntry =>
  ({ id: "e-1", timestamp: "", nodeId, type, label: "", value: "", tags: [] });

describe("provenance chips (handoff §3.2)", () => {
  it("recognises a whole-string setup binding only", () => {
    expect(isConfigurationBinding("{{config.solutionObservation}}")).toBe(true);
    expect(isConfigurationBinding("The {{config.solutionObservation}}")).toBe(false);
    expect(isConfigurationBinding(42)).toBe(false);
  });

  it("marks an observation the teacher configured as a teacher setting, not a bench record", () => {
    const authored = readTechnique("making-solution");
    const configured = applyTechniqueConfiguration(authored, {
      initialSolventVolumeMl: "50", soluteMassG: "1.06", finalVolumeMl: "100", solutionObservation: "clear colourless solution",
    });
    expect(notebookProvenance(configured, authored, entry("observe-solution-node"))).toBe("teacher");
    // Without the authored definition the binding cannot be seen, and the old reading returns.
    expect(notebookProvenance(configured, undefined, entry("observe-solution-node"))).toBe("bench");
  });

  it("marks the balance mass the learner types as their entry", () => {
    const authored = readTechnique("weighing");
    const configured = applyTechniqueConfiguration(authored, {});
    const weigh = configured.actions.find((a) => a.verb === "weigh")!;
    const measurementId = (weigh.mass as { outputMeasurementId: string }).outputMeasurementId;
    expect(measurementId).toMatch(/^[^{]+$/);
    expect(measurementProvenance(configured, authored, measurementId)).toBe("entry");
  });

  it("keeps a runtime record with no input and no binding as from the bench", () => {
    const observe = { id: "look", verb: "observe", label: "Look", parameters: { note: "Clear", tag: "t" }, prerequisites: [], stateChanges: [] } as unknown as ActionDefinition;
    const source = { actions: [observe], process: { nodes: [{ id: "n", actionId: "look" }] } };
    expect(notebookProvenance(source, source, entry("n"))).toBe("bench");
    expect(measurementProvenance(source, source, "nothing-records-this")).toBe("bench");
  });
});
