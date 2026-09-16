import { describe, expect, it, vi } from "vitest";
import { BundleContentError, BundleResourceError } from "../bundleErrors";
import { hydrateBundledLab } from "../hydrateBundledLab";
import { validateBundledLabSource } from "../../domain/validation";
import type {
  ActionDefinition,
  BundledLabSourceDefinition,
  TechniqueDefinition,
} from "../../domain/types";

const metadata = (version: string) => ({
  version,
  author: "test",
  updatedAt: "2026-08-04T00:00:00.000Z",
  tags: [],
});

const action = (id: string, overrides: Partial<ActionDefinition> = {}): ActionDefinition => ({
  id,
  verb: "place",
  label: id,
  parameters: { equipmentDefinitionId: "beaker-250ml", location: "workbench" },
  prerequisites: [],
  stateChanges: [],
  invalidCases: [],
  feedback: { success: "ok", invalid: "no" },
  evidence: [],
  ...overrides,
});

const technique = (
  id: string,
  actions: ActionDefinition[],
  version = "1.0.0",
): TechniqueDefinition => ({
  id,
  title: id,
  learningGoal: id,
  requiredEquipment: ["beaker-250ml"],
  initialState: { equipment: [] },
  actions,
  process: {
    startNodeId: `${id}-node`,
    nodes: [
      {
        id: `${id}-node`,
        type: "action",
        title: id,
        description: id,
        actionId: actions[0]?.id,
        config: {},
        validation: [],
        hints: [],
        feedback: { success: "ok", retry: "again" },
      },
    ],
    edges: [],
  },
  successCriteria: [],
  commonMistakes: [],
  resetBehavior: "resetTechnique",
  metadata: metadata(version),
});

const source = (
  overrides: Partial<BundledLabSourceDefinition> = {},
): BundledLabSourceDefinition => ({
  id: "fx-lab",
  title: "Fixture lab",
  description: "Fixture lab",
  audience: "Testers",
  learningGoals: [],
  safetyNotes: [],
  equipment: ["beaker-250ml"],
  techniques: [],
  actions: [action("local-place")],
  process: {
    startNodeId: "node-a",
    nodes: [
      {
        id: "node-a",
        type: "action",
        title: "A",
        description: "A",
        actionId: "shared-place",
        config: {},
        validation: [],
        hints: [],
        feedback: { success: "ok", retry: "again" },
      },
      {
        id: "node-b",
        type: "action",
        title: "B",
        description: "B",
        actionId: "local-place",
        config: {},
        validation: [],
        hints: [],
        feedback: { success: "ok", retry: "again" },
      },
    ],
    edges: [{ from: "node-a", to: "node-b", label: "next", condition: { type: "always" } }],
  },
  assessments: [],
  metadata: metadata("1.0.0"),
  ...overrides,
});

const resolver = (...techniques: TechniqueDefinition[]) => {
  const byId = new Map(techniques.map((entry) => [entry.id, entry]));
  return vi.fn(async (id: string) => {
    const found = byId.get(id);
    if (!found) throw new BundleResourceError(`no technique ${id}`);
    return found;
  });
};

describe("bundled lab hydration", () => {
  it("imports selected actions in declaration order, then lab-local actions", async () => {
    const lab = await hydrateBundledLab(
      source({
        techniqueRefs: [
          { techniqueId: "beta", version: "1.0.0", actionIds: ["beta-two", "beta-one"] },
          { techniqueId: "alpha", version: "1.0.0", actionIds: ["shared-place"] },
        ],
      }),
      resolver(
        technique("alpha", [action("shared-place")]),
        technique("beta", [action("beta-one"), action("beta-two")]),
      ),
    );

    expect(lab.actions.map((entry) => entry.id)).toEqual([
      "beta-two",
      "beta-one",
      "shared-place",
      "local-place",
    ]);
  });

  it("imports every action when the selection is \"all\"", async () => {
    const lab = await hydrateBundledLab(
      source({ techniqueRefs: [{ techniqueId: "alpha", version: "1.0.0", actionIds: "all" }] }),
      resolver(technique("alpha", [action("shared-place"), action("extra-place")])),
    );

    expect(lab.actions.map((entry) => entry.id)).toEqual([
      "shared-place",
      "extra-place",
      "local-place",
    ]);
  });

  it("clones imported actions so a lab never aliases the technique cache", async () => {
    const alpha = technique("alpha", [action("shared-place")]);
    const lab = await hydrateBundledLab(
      source({ techniqueRefs: [{ techniqueId: "alpha", version: "1.0.0", actionIds: "all" }] }),
      resolver(alpha),
    );

    const imported = lab.actions.find((entry) => entry.id === "shared-place");
    expect(imported).not.toBe(alpha.actions[0]);
    expect(imported).toEqual(alpha.actions[0]);
    imported!.parameters.location = "shelf";
    expect(alpha.actions[0].parameters.location).toBe("workbench");
  });

  it("never composes technique process nodes, edges, equipment, or models into the lab", async () => {
    const alpha = technique("alpha", [action("shared-place")]);
    alpha.initialState.equipment = [
      {
        id: "technique-owned-beaker",
        definitionId: "beaker-250ml",
        label: "Beaker",
        location: "workbench",
        contents: {
          kind: "empty",
          label: "empty",
          solutes: [],
          contamination: [],
          wetState: "dry",
          visualState: "empty",
        },
      },
    ];

    const lab = await hydrateBundledLab(
      source({ techniqueRefs: [{ techniqueId: "alpha", version: "1.0.0", actionIds: "all" }] }),
      resolver(alpha),
    );

    expect(lab.process.nodes.map((node) => node.id)).toEqual(["node-a", "node-b"]);
    expect(lab.process.edges).toHaveLength(1);
    expect(lab.techniques).toEqual([]);
    expect(lab.initialState).toBeUndefined();
    expect("techniqueRefs" in lab).toBe(false);
  });

  it("rejects a version that does not match the technique exactly", async () => {
    await expect(
      hydrateBundledLab(
        source({ techniqueRefs: [{ techniqueId: "alpha", version: "1.0.0", actionIds: "all" }] }),
        resolver(technique("alpha", [action("shared-place")], "1.1.0")),
      ),
    ).rejects.toThrow(/pins 1\.0\.0/);
  });

  it("rejects a selected action the technique does not publish", async () => {
    await expect(
      hydrateBundledLab(
        source({
          techniqueRefs: [
            { techniqueId: "alpha", version: "1.0.0", actionIds: ["shared-place", "absent"] },
          ],
        }),
        resolver(technique("alpha", [action("shared-place")])),
      ),
    ).rejects.toThrow(/no action "absent"/);
  });

  it("rejects the same action id imported from two techniques", async () => {
    await expect(
      hydrateBundledLab(
        source({
          techniqueRefs: [
            { techniqueId: "alpha", version: "1.0.0", actionIds: ["shared-place"] },
            { techniqueId: "beta", version: "1.0.0", actionIds: ["shared-place"] },
          ],
        }),
        resolver(
          technique("alpha", [action("shared-place")]),
          technique("beta", [action("shared-place")]),
        ),
      ),
    ).rejects.toThrow(/imported by both/);
  });

  it("rejects a lab-local action that collides with an imported one", async () => {
    await expect(
      hydrateBundledLab(
        source({
          actions: [action("shared-place")],
          techniqueRefs: [{ techniqueId: "alpha", version: "1.0.0", actionIds: "all" }],
        }),
        resolver(technique("alpha", [action("shared-place")])),
      ),
    ).rejects.toThrow(/which it also imports/);
  });

  it("rejects a process node whose action is neither imported nor lab-local", async () => {
    const draft = source({
      techniqueRefs: [{ techniqueId: "alpha", version: "1.0.0", actionIds: "all" }],
    });
    draft.process.nodes[0].actionId = "never-declared";

    await expect(
      hydrateBundledLab(draft, resolver(technique("alpha", [action("shared-place")]))),
    ).rejects.toThrow(/neither imported nor lab-local/);
  });

  it("rejects an imported action whose equipment the lab does not declare", async () => {
    await expect(
      hydrateBundledLab(
        source({
          equipment: ["beaker-250ml"],
          techniqueRefs: [{ techniqueId: "alpha", version: "1.0.0", actionIds: "all" }],
        }),
        resolver(
          technique("alpha", [
            action("shared-place", {
              parameters: { equipmentDefinitionId: "analytical-balance", location: "workbench" },
            }),
          ]),
        ),
      ),
    ).rejects.toThrow(/does not declare in lab\.equipment/);
  });

  it("rejects an imported action that depends on a model the lab does not own", async () => {
    await expect(
      hydrateBundledLab(
        source({ techniqueRefs: [{ techniqueId: "alpha", version: "1.0.0", actionIds: "all" }] }),
        resolver(
          technique("alpha", [
            action("shared-place", {
              parameters: {
                equipmentDefinitionId: "beaker-250ml",
                location: "workbench",
                titrationModelId: "unowned-model",
              },
            }),
          ]),
        ),
      ),
    ).rejects.toThrow(/titrationModels "unowned-model"/);
  });

  it("raises content errors, never resource errors, so no fixture can mask them", async () => {
    await expect(
      hydrateBundledLab(
        source({ techniqueRefs: [{ techniqueId: "alpha", version: "9.9.9", actionIds: "all" }] }),
        resolver(technique("alpha", [action("shared-place")])),
      ),
    ).rejects.toBeInstanceOf(BundleContentError);
  });
});

describe("bundled lab source contract", () => {
  it("accepts a process reference that only an explicit selection resolves", () => {
    const result = validateBundledLabSource(
      source({ techniqueRefs: [{ techniqueId: "alpha", version: "1.0.0", actionIds: ["shared-place"] }] }),
    );
    expect(result.errors).toEqual([]);
  });

  it("requires an exact non-empty version", () => {
    const result = validateBundledLabSource(
      source({ techniqueRefs: [{ techniqueId: "alpha", version: "", actionIds: "all" }] }),
    );
    expect(result.errors).toContain(
      "lab.techniqueRefs[0].version must be an exact non-empty technique version.",
    );
  });

  it("requires \"all\" or a non-empty selection", () => {
    const result = validateBundledLabSource(
      source({ techniqueRefs: [{ techniqueId: "alpha", version: "1.0.0", actionIds: [] }] }),
    );
    expect(result.errors).toContain(
      'lab.techniqueRefs[0].actionIds must be "all" or a non-empty array of action ids.',
    );
  });

  it("rejects a repeated action id inside one reference", () => {
    const result = validateBundledLabSource(
      source({
        techniqueRefs: [
          { techniqueId: "alpha", version: "1.0.0", actionIds: ["shared-place", "shared-place"] },
        ],
      }),
    );
    expect(result.errors).toContain(
      'lab.techniqueRefs[0].actionIds[1] repeats action id "shared-place".',
    );
  });

  it("rejects the same technique referenced twice", () => {
    const result = validateBundledLabSource(
      source({
        techniqueRefs: [
          { techniqueId: "alpha", version: "1.0.0", actionIds: ["shared-place"] },
          { techniqueId: "alpha", version: "1.0.0", actionIds: ["other-place"] },
        ],
      }),
    );
    expect(result.errors).toContain('lab.techniqueRefs[1].techniqueId repeats technique "alpha".');
  });
});
