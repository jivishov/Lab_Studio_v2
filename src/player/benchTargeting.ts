import type { EquipmentInstance } from "../domain/types";
import type { ActionInteractionSpec } from "../domain/types";
import { equipmentById } from "../equipment/catalog";
import { getBenchSize, getSnapSourceAnchor, getVisualProfile } from "../equipment/visualCatalog";
import type { BenchBounds } from "./benchOverlap";
import type { RenderLayer, RenderNode } from "./resolveWorkbenchScene";

interface BenchPoint {
  x: number;
  y: number;
}

export const benchBoundsForNode = (
  node: RenderNode,
  point: BenchPoint,
  instances: EquipmentInstance[],
): BenchBounds => ({
  id: node.primaryInstanceId,
  definitionId:
    instances.find((instance) => instance.id === node.primaryInstanceId)?.definitionId ?? "",
  x: point.x + node.hitBox.x - node.bounds.x,
  y: point.y + node.hitBox.y - node.bounds.y,
  width: node.hitBox.width,
  height: node.hitBox.height,
  visualX: point.x + node.bounds.x,
  visualY: point.y + node.bounds.y,
  visualWidth: node.bounds.width,
  visualHeight: node.bounds.height,
});

/**
 * Snap interactions may define a physical source point (for example, a probe shaft) whose
 * position is more meaningful than the source artwork's bounding box. Other interactions retain
 * the existing full-hit-box behavior.
 */
export const benchBoundsForInteractionSource = (
  node: RenderNode,
  point: BenchPoint,
  instances: EquipmentInstance[],
  interaction?: ActionInteractionSpec,
): BenchBounds => {
  const bounds = benchBoundsForNode(node, point, instances);
  if (interaction?.type !== "snapIntoTarget") return bounds;
  const snapAnchor = getSnapSourceAnchor(
    bounds.definitionId,
    interaction.targetDefinitionId,
    interaction.snapZoneId,
  );
  if (!snapAnchor || bounds.visualX === undefined || bounds.visualY === undefined) return bounds;
  const anchorX = bounds.visualX + node.bounds.width * snapAnchor.x;
  const anchorY = bounds.visualY + node.bounds.height * snapAnchor.y;
  return {
    ...bounds,
    x: anchorX - 2,
    y: anchorY - 2,
    width: 4,
    height: 4,
  };
};

export const snapPointAligningSourceAnchor = (
  target: BenchBounds,
  sourceDefinitionId: string,
  snapZoneId: string,
): BenchPoint | undefined => {
  const targetProfile = getVisualProfile(target.definitionId);
  const visualZone = targetProfile?.visualZones.find((zone) => zone.id === snapZoneId);
  const snapZone = equipmentById.get(target.definitionId)?.snapZones.find(
    (zone) => zone.id === snapZoneId,
  );
  const targetAnchor = visualZone?.anchor ?? snapZone;
  if (!targetAnchor) return undefined;

  const targetSize = getBenchSize(target.definitionId);
  const sourceSize = getBenchSize(sourceDefinitionId);
  const sourceAnchor = getSnapSourceAnchor(sourceDefinitionId, target.definitionId, snapZoneId) ?? {
    x: 0.5,
    y: 0.5,
  };
  const scaleX = targetSize.width > 0 ? (target.visualWidth ?? targetSize.width) / targetSize.width : 1;
  const scaleY = targetSize.height > 0 ? (target.visualHeight ?? targetSize.height) / targetSize.height : 1;
  const baseX = target.visualX ?? target.x;
  const baseY = target.visualY ?? target.y;
  return {
    x: baseX + targetAnchor.x * scaleX - sourceSize.width * sourceAnchor.x,
    y: baseY + targetAnchor.y * scaleY - sourceSize.height * sourceAnchor.y,
  };
};

export const benchBoundsForLayer = (
  node: RenderNode,
  layer: RenderLayer,
  point: BenchPoint,
): BenchBounds => ({
  id: layer.instanceId,
  definitionId: layer.definitionId,
  x: point.x + layer.x,
  y: point.y + layer.y,
  width: layer.width,
  height: layer.height,
  visualX: point.x + layer.x,
  visualY: point.y + layer.y,
  visualWidth: layer.width,
  visualHeight: layer.height,
});

export const benchTargetBoundsForInteraction = (
  bounds: BenchBounds,
  interaction?: ActionInteractionSpec,
): BenchBounds => {
  if (
    interaction?.type !== "snapIntoTarget" ||
    bounds.definitionId !== interaction.targetDefinitionId ||
    bounds.visualX === undefined ||
    bounds.visualY === undefined
  ) {
    return bounds;
  }
  const profile = getVisualProfile(bounds.definitionId);
  const zone = profile?.visualZones.find((candidate) => candidate.id === interaction.snapZoneId);
  if (!profile || !zone) return bounds;
  const profileSize = getBenchSize(bounds.definitionId);
  const scaleX = profileSize.width > 0 ? (bounds.visualWidth ?? profileSize.width) / profileSize.width : 1;
  const scaleY = profileSize.height > 0 ? (bounds.visualHeight ?? profileSize.height) / profileSize.height : 1;
  return {
    ...bounds,
    x: bounds.visualX + zone.bounds.x * scaleX,
    y: bounds.visualY + zone.bounds.y * scaleY,
    width: zone.bounds.width * scaleX,
    height: zone.bounds.height * scaleY,
  };
};

export const benchTargetBoundsForNode = (
  node: RenderNode,
  point: BenchPoint,
  instances: EquipmentInstance[],
): BenchBounds[] => [
  benchBoundsForNode(node, point, instances),
  ...node.layers
    .filter((layer) => layer.instanceId !== node.primaryInstanceId)
    .map((layer) => benchBoundsForLayer(node, layer, point)),
];

export const benchOccupiedBoundsFromNodes = (
  renderNodes: RenderNode[],
  positions: Map<string, BenchPoint>,
  excludeInstanceId: string,
  instances: EquipmentInstance[],
): BenchBounds[] =>
  renderNodes
    .filter((node) => node.primaryInstanceId !== excludeInstanceId)
    .map((node) =>
      benchBoundsForNode(node, positions.get(node.primaryInstanceId) ?? node.transform, instances),
    );
