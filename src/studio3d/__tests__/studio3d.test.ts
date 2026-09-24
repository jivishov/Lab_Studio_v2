import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { EquipmentInstance, LabDefinition, TechniqueDefinition } from "../../domain/types";
import { createRuntimeState } from "../../runtime";
import { labDraftFromTechnique } from "../../studio/studioArtifact";
import { assessStudioReadiness } from "../../studio/studioReadiness";
import { commitStudioTransaction, createInitialStudioRevision, type StudioOperation } from "../../studio/studioTransactions";
import { neighbourAlongEdges, nodeCards } from "../studio/flowModel";
import { seatingZonesFor, startingState } from "../studio/BenchSetupView";
import { hasIncompleteInboundStep } from "../studio/PreviewView";
import { describeTechnique, needsTeacherSetup } from "../studio/techniqueCatalog";

const readTechnique = (id: string): TechniqueDefinition =>
  JSON.parse(readFileSync(join(process.cwd(), "public", "techniques", `${id}.json`), "utf8")) as TechniqueDefinition;

const apply = (draft: LabDefinition, operations: StudioOperation[]) => {
  const revision = createInitialStudioRevision();
  return commitStudioTransaction(draft, revision, { baseRevision: revision, idempotencyKey: `t-${Math.random()}`, label: "test", operations });
};

describe("the Flow view reads a draft without changing it (handoff §4.4)", () => {
  const draft = labDraftFromTechnique(readTechnique("making-solution"));

  it("shows each step's verb, derived interaction, equipment and input role", () => {
    const cards = nodeCards(draft, assessStudioReadiness(draft).diagnostics);
    expect(cards).toHaveLength(draft.process.nodes.length);
    const first = cards[0];
    expect(first.isStart).toBe(true);
    expect(first.interaction).toBe("pourInto");
    expect(first.icon).toBe("pour");
    expect(first.equipment).toContain("volumetric-flask");
    expect(first.inputRole).toBe("teacherConfiguration");
    expect(first.eyebrow.startsWith("Action · ")).toBe(true);
  });

  it("counts the Studio's diagnostics on the step they concern", () => {
    const diagnostics = assessStudioReadiness(draft).diagnostics;
    const anchored = diagnostics.filter((d) => d.severity !== "pass" && (d.anchor?.nodeId || d.anchor?.actionId)).length;
    const total = nodeCards(draft, diagnostics).reduce((sum, card) => sum + card.issues, 0);
    expect(total).toBe(anchored);
  });

  it("moves along connections with the arrow keys (§4.9)", () => {
    const [a, b] = draft.process.nodes;
    expect(neighbourAlongEdges(draft, a.id, "ArrowRight")).toBe(b.id);
    expect(neighbourAlongEdges(draft, b.id, "ArrowLeft")).toBe(a.id);
  });
});

describe("library statuses come from the core's checks (§4.3)", () => {
  it("names measuring-volume host-bound and making-solution needing setup", () => {
    expect(describeTechnique(readTechnique("measuring-volume")).status).toBe("host");
    expect(describeTechnique(readTechnique("making-solution")).status).toBe("setup");
  });

  it("does not ask a teacher to set a derived record name", () => {
    const weighing = readTechnique("weighing");
    expect(needsTeacherSetup(weighing)).toBe(false);
  });
});

describe("the Flow's gestures map onto existing operations (plan §4.6)", () => {
  const draft = labDraftFromTechnique(readTechnique("making-solution"));

  it("inserts a library step after the edge's source (appendTemplateStep with an anchor)", () => {
    const anchor = draft.process.nodes[0].id;
    const result = apply(draft, [{ type: "appendTemplateStep", templateId: "template-observe", options: { anchorNodeId: anchor, placement: "after" } }]);
    expect(result.ok, result.error).toBe(true);
    expect(result.draft.process.nodes[1].title).toBe("Observation");
  });

  it("draws a retry between two steps as a branch whose condition becomes retry, in one transaction", () => {
    const [a, b] = draft.process.nodes;
    const index = draft.process.edges.length;
    const result = apply(draft, [
      { type: "addBranchEdge", from: b.id, to: a.id },
      { type: "updateProcessEdge", index, edge: { from: b.id, to: a.id, label: "Retry", condition: { type: "retry" } } },
    ]);
    expect(result.ok, result.error).toBe(true);
    expect(result.draft.process.edges[index]).toMatchObject({ from: b.id, to: a.id, condition: { type: "retry" } });
  });
});

describe("the Starting bench seats a starting item the way the runtime will (§4.5)", () => {
  const lab = labDraftFromTechnique(readTechnique("weighing"));
  const withBench = (instances: EquipmentInstance[]): LabDefinition => ({ ...lab, initialState: { equipment: instances } });
  const balance: EquipmentInstance = { ...lab.initialState!.equipment.find((i) => i.definitionId === "analytical-balance")!, location: "workbench", x: 200, y: 200 };
  const glass = lab.initialState!.equipment.find((i) => i.definitionId === "watch-glass")!;

  it("offers the balance pan for a watch glass when one balance is on the bench", () => {
    const state = startingState(withBench([balance, glass]));
    expect(seatingZonesFor(state, "watch-glass").map((z) => z.zone.id)).toContain("analytical-balance-pan");
  });

  it("offers no zone when the owner is ambiguous", () => {
    const second = { ...balance, id: `${balance.id}-second` };
    expect(seatingZonesFor(startingState(withBench([balance, second, glass])), "watch-glass")).toHaveLength(0);
  });

  it("is honoured by the runtime: a starting item in a zone starts attached (deriveLegacyAttachments)", () => {
    const seated = { ...glass, location: "snapZone" as const, snapZoneId: "analytical-balance-pan" };
    const state = createRuntimeState(withBench([balance, seated]));
    expect(state.attachments).toEqual(expect.arrayContaining([expect.objectContaining({ parentInstanceId: balance.id, childInstanceId: glass.id, zoneId: "analytical-balance-pan" })]));
  });
});

describe("the preview notice follows StudentPlayer's rule", () => {
  it("shows while an inbound step is not complete", () => {
    const process = { startNodeId: "a", nodes: [], edges: [{ from: "a", to: "b", label: "", condition: { type: "always" as const } }] };
    expect(hasIncompleteInboundStep(process, "b", [])).toBe(true);
    expect(hasIncompleteInboundStep(process, "b", ["a"])).toBe(false);
  });
});
