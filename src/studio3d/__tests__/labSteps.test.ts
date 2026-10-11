import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { compileLabComposition } from "../../data/compileLabComposition";
import { resolveActionInteraction } from "../../domain/interactions";
import type { LabCompositionSourceDefinition, LabDefinition, RuntimeState, TechniqueDefinition } from "../../domain/types";
import { validateBundledLabSource } from "../../domain/validation";
import { createRuntimeState, performRuntimeAction } from "../../runtime";
import { resolveActionInput } from "../../runtime/actionInputs";
import { resolveInteractionIntent, type RuntimeInteractionIntent } from "../../runtime/interactionIntents";
import { intentTypeForInteraction, mergeActionInput } from "../adapters/sceneToIntent";
import { inRunOrder, labPartLabels } from "../labs3d";
import type { Lab3DSummary } from "../labs3dSetup";

/**
 * Lab steps in 3D labs (Pack 3a step 2, decided 2026-10-10; `proposals/PACK3_ATOMIZATION.md`, "Lab steps in 3D
 * labs"), proved on a fixture: the first two parts of `intro-filtration-demo` (measure the sample, transfer it),
 * with a record before them, a calculation and a teacher's approval between them, and a record after. The build
 * scripts are loaded as the build runs them (`scripts/practice3d/`, plain JavaScript).
 */
const script = (path: string) => import(/* @vite-ignore */ pathToFileURL(join(process.cwd(), "scripts", "practice3d", path)).href);

interface Step { action: { id: string; parameters: Record<string, unknown> }; node: { id: string } }
interface Declaration {
  id: string;
  bench: Array<{ id: string }>;
  parts: Array<{ instanceId: string; items: Record<string, string>; technique: TechniqueDefinition }>;
  setup: Array<{ id: string }>;
  steps?: Array<{ id: string; title: string; after?: string; steps: Step[] }>;
  [key: string]: unknown;
}

const fixture = async (): Promise<{ declaration: Declaration; compose: (declaration: Declaration) => { source: LabCompositionSourceDefinition; entry: Lab3DSummary } }> => {
  const [{ composeLab }, { labRecord, labCalculation, labApproval }, intro] = await Promise.all([
    script("composeLab.mjs"), script("common.mjs"), script("labs/introFiltrationDemo.mjs"),
  ]);
  const base = intro.default as Declaration;
  const parts = base.parts.slice(0, 2);
  const used = new Set(parts.flatMap((part) => Object.values(part.items)));
  const declaration: Declaration = {
    ...base,
    id: "lab-steps-fixture",
    bench: base.bench.filter((item) => used.has(item.id)),
    parts,
    setup: base.setup.filter((field) => ["sampleVolumeMl", "transferObservation"].includes(field.id)),
    rules: [],
    steps: [
      { id: "before", title: "Before you begin", steps: [
        labRecord("review-safety", "Review the safety notes", "Read the safety notes and confirm you have your goggles on."),
      ] },
      { id: "check", title: "Check the measurement", after: "measuring-volume", steps: [
        labCalculation("count-readings", "Count the readings", "Count the volume readings you have recorded.", {
          calculationId: "readings-counted", template: "measurementCount", measurementIds: ["measuring-volume--sample-volume"], tolerance: 0, unit: "readings",
        }),
        labApproval("approve-transfer", "Teacher's approval", "Your teacher checks the reading before you pour the sample."),
      ] },
      { id: "after", title: "Afterwards", after: "transfer", steps: [
        labRecord("record-conclusion", "Record what you did", "Write one sentence on how you measured and transferred the sample.",
          { input: { inputMode: "text", inputLabel: "What you did" } }),
      ] },
    ],
  };
  return { declaration, compose: (value) => composeLab(value, (part: { technique: TechniqueDefinition }) => part.technique) };
};

/** The nodes in the order the edges run them, from the start. */
const runOrder = (lab: LabDefinition) => {
  const order = [];
  for (let id: string | undefined = lab.process.startNodeId; id; id = lab.process.edges.find((edge) => edge.from === id)?.to) {
    order.push(lab.process.nodes.find((node) => node.id === id)!);
    if (order.length > lab.process.nodes.length) throw new Error("The edges loop.");
  }
  return order;
};

/** Plays the lab through the process control, in run order; `inputs` by action id. */
const play = (lab: LabDefinition, inputs: Record<string, string>): RuntimeState => {
  let state = createRuntimeState(lab);
  const send = (nodeId: string, intent: RuntimeInteractionIntent) => {
    const resolved = resolveInteractionIntent(lab, state, intent);
    if (!resolved.ok) throw new Error(`${nodeId}: ${resolved.feedback.message}`);
    const before = state.feedbackQueue.length;
    state = performRuntimeAction(lab, state, resolved.request);
    const error = state.feedbackQueue.slice(before).find((entry) => entry.severity === "error");
    if (error) throw new Error(`${nodeId}: ${error.message}`);
  };
  for (const node of runOrder(lab)) {
    expect(state.currentNodeId, node.id).toBe(node.id);
    const action = lab.actions.find((candidate) => candidate.id === node.actionId)!;
    const interaction = resolveActionInteraction(action)!;
    if (interaction.type === "dispenseDrops") {
      const level = state.equipmentInstances.find((item) => item.id === action.parameters.targetInstanceId)?.contents?.volumeMl ?? 0;
      const dropCount = Math.round((Number(action.parameters.markVolumeMl) - level) / Number(action.parameters.dropVolumeMl));
      send(node.id, { origin: "keyboard", type: "dispenseDropIntent", runtimeParameters: { dropCount } } as RuntimeInteractionIntent);
      send(node.id, { origin: "keyboard", type: "dispenseCompleteIntent" } as RuntimeInteractionIntent);
    }
    for (let i = 0; i < 40 && !state.completedNodes.includes(node.id); i += 1) {
      send(node.id, mergeActionInput({ origin: "keyboard", type: intentTypeForInteraction[interaction.type] } as RuntimeInteractionIntent,
        resolveActionInput(action, inputs[action.id] ?? ""), action));
    }
    expect(state.completedNodes, node.id).toContain(node.id);
  }
  return state;
};

const compile = async (source: LabCompositionSourceDefinition, declaration: Declaration) => {
  const twins = new Map(declaration.parts.map((part) => [part.technique.id, part.technique]));
  return compileLabComposition(source, async (id) => structuredClone(twins.get(id)!));
};

describe("Lab steps in a 3D lab module", () => {
  it("writes the lab steps with their effects, and runs them before, between and after the parts", async () => {
    const { declaration, compose } = await fixture();
    const { source, entry } = compose(declaration);
    expect(validateBundledLabSource(source).errors ?? []).toEqual([]);
    expect(source.actions.map((action) => action.id)).toEqual(["review-safety", "count-readings", "approve-transfer", "record-conclusion"]);
    expect(source.actions.find((action) => action.id === "count-readings")!.effect).toEqual({
      classes: ["calculation-analysis"],
      targets: [{ domain: "analysis", reference: "readings-counted" }, { domain: "evidence", reference: "measuring-volume--sample-volume" }],
    });
    expect(source.actions.find((action) => action.id === "approve-transfer")!.effect!.classes).toEqual(["evidence-recording", "pedagogical-orchestration"]);
    expect(source.compositionStart).toEqual({ kind: "lab-node", nodeId: "review-safety-node" });
    expect(source.process.edges.map((edge) => [edge.from, edge.to])).toEqual([["count-readings-node", "approve-transfer-node"]]);
    expect(source.compositionConnections.map((connection) => connection.id)).toEqual([
      "review-safety-node-to-measuring-volume", "measuring-volume-to-count-readings-node",
      "approve-transfer-node-to-transfer", "transfer-to-record-conclusion-node",
    ]);
    expect(entry.parts.map((part) => [part.instanceId, part.nodeIds ?? part.techniqueId])).toEqual([
      ["before", ["review-safety-node"]], ["measuring-volume", "measuring-volume-3d"],
      ["check", ["count-readings-node", "approve-transfer-node"]], ["transfer", "transfer-3d"], ["after", ["record-conclusion-node"]],
    ]);
  });

  it("compiles and plays: the record, the calculation on the first part's reading, the approval, then the second part", async () => {
    const { declaration, compose } = await fixture();
    const { source, entry } = compose(declaration);
    const lab = await compile(source, declaration);
    const order = runOrder(lab);
    expect(order).toHaveLength(lab.process.nodes.length);
    expect(order[0].id).toBe("review-safety-node");
    expect(order.at(-1)!.id).toBe("record-conclusion-node");
    // The compiler lists the lab steps first; the 3D loader puts the nodes in run order, so the steps number 1 to 13.
    expect(lab.process.nodes[1].id).toBe("count-readings-node");
    expect(inRunOrder(lab).process.nodes).toEqual(order);
    const state = play(lab, { "measuring-volume--read-volume": "20", "approve-transfer": "Approved by the teacher",
      "record-conclusion": "I filled the cylinder to the line and poured it all in." });
    expect(state.completedNodes).toHaveLength(lab.process.nodes.length);
    expect(state.calculations.find((entry) => entry.id === "readings-counted")).toMatchObject({ value: 1, passed: true });
    const noted = (tag: string) => state.notebook.find((note) => note.tags.includes(tag))?.value;
    expect(noted("review-safety-recorded")).toBeDefined();
    expect(noted("approve-transfer-approved")).toContain("Approved by the teacher");
    expect(noted("record-conclusion-recorded")).toContain("poured it all in");

    // The step card's part label: a lab step by its group, a technique's step by its part.
    const labels = labPartLabels(lab, entry);
    expect(labels.get("review-safety-node")).toEqual({ index: 1, count: 5, title: "Before you begin" });
    expect(labels.get("approve-transfer-node")).toEqual({ index: 3, count: 5, title: "Check the measurement" });
    expect(labels.get(order.find((node) => node.id.startsWith("transfer--"))!.id)).toMatchObject({ index: 4, title: "Transfer the sample" });
    expect(labels.size).toBe(lab.process.nodes.length);
  });

  it("refuses a lab step naming a part that is not there, or following one", async () => {
    const { declaration, compose } = await fixture();
    const [before, check, after] = declaration.steps!;
    const stray = { ...check, steps: [{ ...check.steps[0], action: { ...check.steps[0].action,
      parameters: { ...check.steps[0].action.parameters, measurementIds: ["filtration--sample-volume"] } } }] };
    expect(() => compose({ ...declaration, steps: [before, stray, after] })).toThrow(/filtration--sample-volume, which no part scopes/);
    expect(() => compose({ ...declaration, steps: [before, { ...check, after: "filtration" }, after] })).toThrow(/no part "filtration"/);
    expect(() => compose({ ...declaration, steps: [before, { ...check, id: "transfer" }, after] })).toThrow(/already a part's/);
  });
});
