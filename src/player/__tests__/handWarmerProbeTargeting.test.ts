import { describe, expect, it } from "vitest";
import type { ActionInteractionSpec } from "../../domain/types";
import { createEquipmentInstance } from "../../equipment/catalog";
import { resolveBenchOverlap } from "../benchOverlap";
import {
  benchBoundsForInteractionSource,
  benchTargetBoundsForInteraction,
  benchTargetBoundsForNode,
  snapPointAligningSourceAnchor,
} from "../benchTargeting";
import type { RenderNode } from "../resolveWorkbenchScene";

const interaction: ActionInteractionSpec = {
  type: "snapIntoTarget",
  sourceDefinitionId: "probe-thermometer",
  targetDefinitionId: "hand-warmer-calorimeter",
  snapZoneId: "hand-warmer-probe-hole",
  accessibleLabel: "Insert the thermometer through the cover hole.",
};

const probe = createEquipmentInstance("probe-thermometer", "probe-thermometer-1");
const calorimeter = createEquipmentInstance("hand-warmer-calorimeter", "hand-warmer-calorimeter-1");
const innerCup = createEquipmentInstance("polystyrene-cup-8oz", "inner-cup-1");

const probeNode: RenderNode = {
  id: probe.id,
  representedInstanceIds: [probe.id],
  primaryInstanceId: probe.id,
  layers: [{ id: probe.id, instanceId: probe.id, definitionId: probe.definitionId, x: 0, y: 0, width: 52, height: 154, zIndex: 1 }],
  transform: { x: 0, y: 0 },
  bounds: { x: 0, y: 0, width: 52, height: 154 },
  footprint: { x: 20, y: 142, width: 12, height: 6 },
  hitBox: { x: 0, y: 0, width: 52, height: 154 },
  accessibleLabel: "Digital probe thermometer",
  selectionTargetId: probe.id,
};

const calorimeterNode: RenderNode = {
  id: calorimeter.id,
  representedInstanceIds: [calorimeter.id, innerCup.id],
  primaryInstanceId: calorimeter.id,
  layers: [
    { id: calorimeter.id, instanceId: calorimeter.id, definitionId: calorimeter.definitionId, x: 0, y: 0, width: 400, height: 400, zIndex: 1 },
    { id: innerCup.id, instanceId: innerCup.id, definitionId: innerCup.definitionId, x: 205, y: 146, width: 60, height: 120, zIndex: 2 },
  ],
  transform: { x: 100, y: 50 },
  bounds: { x: 0, y: 0, width: 400, height: 400 },
  footprint: { x: 56, y: 346, width: 288, height: 36 },
  hitBox: { x: 20, y: 16, width: 360, height: 368 },
  accessibleLabel: "Hand-warmer calorimeter assembly",
  selectionTargetId: calorimeter.id,
};

describe("CAL-05 probe anchor targeting", () => {
  it("selects the assembly hole rather than the embedded inner cup", () => {
    const instances = [probe, calorimeter, innerCup];
    const candidates = benchTargetBoundsForNode(
      calorimeterNode,
      calorimeterNode.transform,
      instances,
    ).map((bounds) => benchTargetBoundsForInteraction(bounds, interaction));
    const assemblyTarget = candidates.find((candidate) => candidate.id === calorimeter.id);
    if (!assemblyTarget) throw new Error("Missing calorimeter target fixture.");
    const probePoint = snapPointAligningSourceAnchor(
      assemblyTarget,
      probe.definitionId,
      interaction.snapZoneId!,
    );
    if (!probePoint) throw new Error("Missing probe snap point.");

    const dragged = benchBoundsForInteractionSource(probeNode, probePoint, instances, interaction);
    const result = resolveBenchOverlap(dragged, candidates, interaction);

    expect(dragged).toMatchObject({ width: 4, height: 4 });
    expect(result.kind).toBe("valid");
    expect(result.target?.id).toBe(calorimeter.id);
    expect(probePoint.x + 52 * (129 / 256)).toBeCloseTo(335, 4);
    expect(probePoint.y + 154 * (231 / 1175)).toBeCloseTo(200, 4);
  });
});
