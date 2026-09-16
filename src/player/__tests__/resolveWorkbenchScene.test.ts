import { describe, expect, it } from "vitest";
import { getInteractionZone } from "../../domain/interactionZones";
import { emptyContents, type EquipmentInstance, type RuntimeState } from "../../domain/types";
import { createEquipmentInstance } from "../../equipment/catalog";
import { makeAttachmentRelation } from "../../runtime/attachments";
import { resolveWorkbenchScene } from "../resolveWorkbenchScene";

const stateWith = (equipmentInstances: EquipmentInstance[]): Pick<RuntimeState, "equipmentInstances" | "attachments"> => ({
  equipmentInstances,
  attachments: equipmentInstances.flatMap((instance) => {
    if (!instance.snapZoneId || instance.location !== "snapZone") return [];
    const parentDefinitionId =
      getInteractionZone(instance.snapZoneId)?.ownerDefinitionId ??
      (instance.snapZoneId === "funnel-stand-paper-seat" || instance.snapZoneId === "funnel-receiving-vessel-zone"
        ? "funnel-stand"
        : "ring-stand-clamp");
    const parent = equipmentInstances.find((candidate) => candidate.definitionId === parentDefinitionId);
    const attachment = parent ? makeAttachmentRelation(parent.id, instance.id, instance.snapZoneId) : undefined;
    return attachment ? [attachment] : [];
  }),
});

describe("resolveWorkbenchScene", () => {
  it("renders an empty funnel as a standalone node", () => {
    const funnel = { ...createEquipmentInstance("funnel-stand"), location: "workbench" as const, x: 40, y: 40 };
    const nodes = resolveWorkbenchScene(stateWith([funnel]));
    expect(nodes).toHaveLength(1);
    expect(nodes[0].representedInstanceIds).toEqual([funnel.id]);
  });

  it("composes seated filter paper into the funnel node", () => {
    const funnel = { ...createEquipmentInstance("funnel-stand"), location: "workbench" as const, x: 40, y: 40 };
    const paper = {
      ...createEquipmentInstance("filter-paper"),
      location: "snapZone" as const,
      snapZoneId: "funnel-stand-paper-seat",
      interactionStatus: "snapped" as const,
      contents: { ...emptyContents(), wetState: "wet" as const, visualState: "wet-equipment" },
    };
    const nodes = resolveWorkbenchScene(stateWith([funnel, paper]));
    expect(nodes).toHaveLength(1);
    expect(nodes[0].representedInstanceIds).toContain(paper.id);
    expect(nodes[0].layers.map((layer) => layer.definitionId)).toEqual(["funnel-stand", "filter-paper"]);
    expect(nodes[0].layers.find((layer) => layer.definitionId === "filter-paper")).toMatchObject({
      x: 94,
      y: 128,
      width: 66,
      height: 56,
    });
  });

  it("layers chromatography paper inside the chamber only after insertion", () => {
    const chamber = {
      ...createEquipmentInstance("chromatography-chamber"),
      location: "workbench" as const,
      x: 40,
      y: 40,
    };
    const paper = {
      ...createEquipmentInstance("chromatography-paper"),
      location: "snapZone" as const,
      snapZoneId: "chromatography-chamber-paper-slot",
      interactionStatus: "snapped" as const,
      contents: { ...emptyContents(), chromatogram: { modelId: "test", baselineMarked: true, spotted: true, bands: [] } },
    };
    const attachment = makeAttachmentRelation(chamber.id, paper.id, "chromatography-chamber-paper-slot");

    const emptyNodes = resolveWorkbenchScene({ equipmentInstances: [chamber], attachments: [] });
    const insertedNodes = resolveWorkbenchScene({
      equipmentInstances: [chamber, paper],
      attachments: attachment ? [attachment] : [],
    });

    expect(emptyNodes).toHaveLength(1);
    expect(emptyNodes[0].layers.map((layer) => layer.definitionId)).toEqual(["chromatography-chamber"]);
    expect(insertedNodes).toHaveLength(1);
    expect(insertedNodes[0].representedInstanceIds).toContain(paper.id);
    expect(insertedNodes[0].layers.map((layer) => layer.definitionId)).toEqual([
      "chromatography-chamber",
      "chromatography-paper",
    ]);
    expect(insertedNodes[0].layers.find((layer) => layer.definitionId === "chromatography-paper")).toMatchObject({
      x: 53,
      y: 38,
      width: 50,
      height: 124,
    });
  });

  it("composes a stopper into the volumetric flask node", () => {
    const flask = { ...createEquipmentInstance("volumetric-flask"), location: "workbench" as const, x: 40, y: 40 };
    const stopper = {
      ...createEquipmentInstance("rubber-stopper-set"),
      location: "snapZone" as const,
      snapZoneId: "volumetric-flask-stopper-seat",
      interactionStatus: "snapped" as const,
    };

    const nodes = resolveWorkbenchScene(stateWith([flask, stopper]));

    expect(nodes).toHaveLength(1);
    expect(nodes[0].representedInstanceIds).toContain(stopper.id);
    expect(nodes[0].layers.map((layer) => layer.definitionId)).toEqual(["volumetric-flask", "rubber-stopper-set"]);
    expect(nodes[0].layers.find((layer) => layer.definitionId === "rubber-stopper-set")).toMatchObject({
      x: 39,
      y: 8,
      width: 20,
      height: 26,
      zIndex: 3,
    });
  });

  it("composes an inserted cuvette into the spectrophotometer node", () => {
    const instrument = { ...createEquipmentInstance("spectrophotometer"), location: "workbench" as const, x: 40, y: 40 };
    const cuvette = {
      ...createEquipmentInstance("cuvette"),
      location: "snapZone" as const,
      snapZoneId: "spectrophotometer-cuvette-slot",
      interactionStatus: "snapped" as const,
    };

    const nodes = resolveWorkbenchScene(stateWith([instrument, cuvette]));

    expect(nodes).toHaveLength(1);
    expect(nodes[0].representedInstanceIds).toContain(cuvette.id);
    expect(nodes[0].layers.map((layer) => layer.definitionId)).toEqual(["spectrophotometer", "cuvette"]);
    expect(nodes[0].layers.find((layer) => layer.definitionId === "cuvette")).toMatchObject({
      x: 120,
      y: 42,
      width: 42,
      height: 44,
      zIndex: 3,
    });
  });

  it("composes the clay triangle and crucible into the ring stand node", () => {
    const stand = { ...createEquipmentInstance("ring-stand"), location: "workbench" as const, x: 40, y: 40 };
    const clayTriangle = {
      ...createEquipmentInstance("clay-triangle"),
      location: "snapZone" as const,
      snapZoneId: "ring-stand-clay-triangle-seat",
      interactionStatus: "snapped" as const,
    };
    const crucible = {
      ...createEquipmentInstance("crucible-with-lid"),
      location: "snapZone" as const,
      snapZoneId: "ring-stand-crucible-seat",
      interactionStatus: "snapped" as const,
    };

    const nodes = resolveWorkbenchScene(stateWith([stand, clayTriangle, crucible]));

    expect(nodes).toHaveLength(1);
    expect(nodes[0].representedInstanceIds).toEqual([stand.id, clayTriangle.id, crucible.id]);
    expect(nodes[0].layers.map((layer) => layer.definitionId)).toEqual([
      "ring-stand",
      "clay-triangle",
      "crucible-with-lid",
    ]);
    expect(nodes[0].layers.find((layer) => layer.definitionId === "clay-triangle")).toMatchObject({
      x: 80,
      y: 166,
      width: 92,
      height: 50,
      zIndex: 2,
    });
    expect(nodes[0].layers.find((layer) => layer.definitionId === "crucible-with-lid")).toMatchObject({
      x: 84,
      y: 118,
      width: 84,
      height: 64,
      zIndex: 3,
    });
  });

  it("keeps the receiving flask independent while snapping it below the larger funnel stand", () => {
    const funnel = { ...createEquipmentInstance("funnel-stand"), location: "workbench" as const, x: 40, y: 40 };
    const flask = {
      ...createEquipmentInstance("erlenmeyer-flask-250ml"),
      location: "snapZone" as const,
      snapZoneId: "funnel-receiving-vessel-zone",
      interactionStatus: "snapped" as const,
      x: 43,
      y: 148,
    };
    const nodes = resolveWorkbenchScene(stateWith([funnel, flask]));
    const funnelNode = nodes.find((node) => node.primaryInstanceId === funnel.id);
    const flaskNode = nodes.find((node) => node.primaryInstanceId === flask.id);

    expect(nodes).toHaveLength(2);
    expect(funnelNode?.representedInstanceIds).not.toContain(flask.id);
    expect(flaskNode?.bounds.height).toBe(140);
    expect(flaskNode?.transform).toMatchObject({ x: 114, y: 285 });
  });

  it("keeps the hand-warmer heater interactive while its state asset renders the stand-base position", () => {
    const calorimeter = {
      ...createEquipmentInstance("hand-warmer-calorimeter"),
      location: "workbench" as const,
      x: 40,
      y: 40,
      contents: { ...emptyContents(), visualState: "CAL-01" },
    };
    const heater = {
      ...createEquipmentInstance("hot-plate-stirrer"),
      location: "snapZone" as const,
      snapZoneId: "hand-warmer-stirrer-base",
      interactionStatus: "snapped" as const,
    };
    const attachment = makeAttachmentRelation(
      calorimeter.id,
      heater.id,
      "hand-warmer-stirrer-base",
    );

    const nodes = resolveWorkbenchScene({
      equipmentInstances: [calorimeter, heater],
      attachments: attachment ? [attachment] : [],
    });

    expect(nodes).toHaveLength(1);
    expect(nodes[0].representedInstanceIds).toEqual([calorimeter.id, heater.id]);
    expect(nodes[0].layers.map((layer) => layer.definitionId)).toEqual([
      "hand-warmer-calorimeter",
      "hot-plate-stirrer",
    ]);
    expect(nodes[0].layers.find((layer) => layer.definitionId === "hot-plate-stirrer")).toMatchObject({
      x: 158,
      y: 281,
      width: 154,
      height: 96,
    });
  });

  it("does not render storage instances on the workbench", () => {
    const hiddenStand = { ...createEquipmentInstance("ring-stand"), location: "storage" as const };
    const hiddenFunnel = { ...createEquipmentInstance("funnel"), location: "storage" as const };
    const composite = { ...createEquipmentInstance("funnel-stand"), location: "workbench" as const };

    const nodes = resolveWorkbenchScene(stateWith([hiddenStand, hiddenFunnel, composite]));

    expect(nodes).toHaveLength(1);
    expect(nodes[0].representedInstanceIds).toEqual([composite.id]);
  });

  it("composes mounted burette into the ring stand node", () => {
    const stand = { ...createEquipmentInstance("ring-stand-clamp"), location: "workbench" as const, x: 60, y: 30 };
    const burette = {
      ...createEquipmentInstance("burette-50ml"),
      location: "snapZone" as const,
      snapZoneId: "ring-stand-burette-clamp",
      interactionStatus: "snapped" as const,
    };
    const nodes = resolveWorkbenchScene(stateWith([stand, burette]));
    expect(nodes).toHaveLength(1);
    expect(nodes[0].representedInstanceIds).toContain(burette.id);
    expect(nodes[0].layers.map((layer) => layer.definitionId)).toEqual(["ring-stand-clamp", "burette-50ml"]);
    expect(nodes[0].layers.find((layer) => layer.definitionId === "burette-50ml")).toMatchObject({
      x: 181,
      y: 28,
      width: 64,
      height: 250,
      zIndex: 2,
    });
    const outletY = 28 + 250 * 0.97;
    const flaskTopY = 310;
    expect(flaskTopY - outletY).toBeGreaterThanOrEqual(20);
  });

  it("flattens a filling funnel nested on the mounted burette", () => {
    const stand = { ...createEquipmentInstance("ring-stand-clamp"), location: "workbench" as const, x: 60, y: 30 };
    const burette = {
      ...createEquipmentInstance("burette-50ml"),
      location: "snapZone" as const,
      snapZoneId: "ring-stand-burette-clamp",
      interactionStatus: "snapped" as const,
    };
    const funnel = {
      ...createEquipmentInstance("funnel"),
      location: "snapZone" as const,
      snapZoneId: "burette-funnel-seat",
      interactionStatus: "snapped" as const,
    };

    const nodes = resolveWorkbenchScene(stateWith([stand, burette, funnel]));
    expect(nodes).toHaveLength(1);
    expect(nodes[0].representedInstanceIds).toEqual([stand.id, burette.id, funnel.id]);
    expect(nodes[0].layers.map((layer) => layer.definitionId)).toEqual([
      "ring-stand-clamp",
      "burette-50ml",
      "funnel",
    ]);
    expect(nodes[0].layers.find((layer) => layer.definitionId === "funnel")).toMatchObject({
      x: 184,
      y: 0,
      width: 59,
      height: 88,
      zIndex: 3,
    });
    expect(nodes[0].accessibleLabel).toMatch(/burette.*funnel/i);
  });
});
