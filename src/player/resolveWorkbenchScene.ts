import type { AttachmentRelation, EquipmentInstance, RuntimeState } from "../domain/types";
import { isVisibleWorkbenchLocation } from "../domain/equipmentLocations";
import { equipmentById } from "../equipment/catalog";
import {
  getBenchSize,
  getFootprint,
  getHitBox,
  getSnapSourceAnchor,
  getVisualStateAsset,
  getVisualProfile,
  type Rect,
} from "../equipment/visualCatalog";
import { resolveAttachments } from "../runtime/attachments";
import type { EquipmentViewLayer } from "./EquipmentView";

export interface Transform {
  x: number;
  y: number;
  rotation?: number;
  zIndex?: number;
}

export interface RenderLayer {
  id: string;
  instanceId: string;
  definitionId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

export interface RenderNode {
  id: string;
  representedInstanceIds: string[];
  primaryInstanceId: string;
  layers: RenderLayer[];
  transform: Transform;
  bounds: Rect;
  footprint: Rect;
  hitBox: Rect;
  accessibleLabel: string;
  selectionTargetId: string;
  attachedSummary?: string;
}

const defaultPosition = (index: number) => ({
  x: 34 + (index % 5) * 148,
  y: 86 + Math.floor(index / 5) * 160,
});

const union = (rects: Rect[]): Rect => {
  const minX = Math.min(...rects.map((rect) => rect.x));
  const minY = Math.min(...rects.map((rect) => rect.y));
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.width));
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.height));
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

const layerFor = (instance: EquipmentInstance, x = 0, y = 0, zIndex = 1): RenderLayer => {
  const size = getBenchSize(instance.definitionId);
  return {
    id: instance.id,
    instanceId: instance.id,
    definitionId: instance.definitionId,
    x,
    y,
    width: size.width,
    height: size.height,
    zIndex,
  };
};

const profileZoneBounds = (parentDefinitionId: string, zoneId: string): Rect | undefined =>
  getVisualProfile(parentDefinitionId)?.visualZones.find((zone) => zone.id === zoneId)?.bounds;

const profileZoneAnchor = (
  parentDefinitionId: string,
  zoneId: string,
): { x: number; y: number } | undefined =>
  getVisualProfile(parentDefinitionId)?.visualZones.find((zone) => zone.id === zoneId)?.anchor;

const rendersCompleteStateAsset = (instance: EquipmentInstance): boolean =>
  Boolean(getVisualStateAsset(instance.definitionId, instance.contents.visualState));

const childLayerForAttachment = (
  parent: EquipmentInstance,
  child: EquipmentInstance,
  attachment: AttachmentRelation,
  parentLayer: RenderLayer,
): RenderLayer | undefined => {
  const childSize = getBenchSize(child.definitionId);
  const parentSize = getBenchSize(parent.definitionId);
  const scaleX = parentSize.width > 0 ? parentLayer.width / parentSize.width : 1;
  const scaleY = parentSize.height > 0 ? parentLayer.height / parentSize.height : 1;
  const zoneBounds = profileZoneBounds(parent.definitionId, attachment.zoneId);
  if (attachment.zoneId === "funnel-stand-paper-seat" && child.definitionId === "filter-paper") {
    return {
      ...layerFor(
        child,
        parentLayer.x + (zoneBounds?.x ?? 42) * scaleX,
        parentLayer.y + (zoneBounds?.y ?? 38) * scaleY,
        2,
      ),
      width: (zoneBounds?.width ?? 58) * scaleX,
      height: (zoneBounds?.height ?? 38) * scaleY,
    };
  }
  if (attachment.zoneId === "ring-stand-burette-clamp" && child.definitionId === "burette-50ml") {
    return {
      ...layerFor(
        child,
        parentLayer.x + 181 * scaleX,
        parentLayer.y + 28 * scaleY,
        2,
      ),
      width: 64 * scaleX,
      height: 250 * scaleY,
    };
  }
  if (attachment.zoneId === "burette-funnel-seat" && child.definitionId === "funnel") {
    const mountedScaleX = parentLayer.width / 64;
    const mountedScaleY = parentLayer.height / 250;
    return {
      ...layerFor(
        child,
        parentLayer.x + 3 * mountedScaleX,
        parentLayer.y - 28 * mountedScaleY,
        parentLayer.zIndex + 1,
      ),
      width: 59 * mountedScaleX,
      height: 88 * mountedScaleY,
    };
  }
  if (attachment.zoneId === "chromatography-chamber-paper-slot" && child.definitionId === "chromatography-paper") {
    return {
      ...layerFor(child, parentLayer.x + (zoneBounds?.x ?? 44) * scaleX, parentLayer.y + (zoneBounds?.y ?? 20) * scaleY, 2),
      width: (zoneBounds?.width ?? 68) * scaleX,
      height: (zoneBounds?.height ?? 130) * scaleY,
    };
  }
  if (attachment.zoneId === "volumetric-flask-stopper-seat" && child.definitionId === "rubber-stopper-set") {
    return {
      ...layerFor(child, parentLayer.x + (zoneBounds?.x ?? 39) * scaleX, parentLayer.y + (zoneBounds?.y ?? 8) * scaleY, 3),
      width: (zoneBounds?.width ?? 20) * scaleX,
      height: (zoneBounds?.height ?? 26) * scaleY,
    };
  }
  if (attachment.zoneId === "spectrophotometer-cuvette-slot" && child.definitionId === "cuvette") {
    return {
      ...layerFor(child, parentLayer.x + (zoneBounds?.x ?? 120) * scaleX, parentLayer.y + (zoneBounds?.y ?? 42) * scaleY, 3),
      width: (zoneBounds?.width ?? 42) * scaleX,
      height: (zoneBounds?.height ?? 44) * scaleY,
    };
  }
  if (attachment.zoneId === "ring-stand-clay-triangle-seat" && child.definitionId === "clay-triangle") {
    return {
      ...layerFor(child, parentLayer.x + (zoneBounds?.x ?? 80) * scaleX, parentLayer.y + (zoneBounds?.y ?? 166) * scaleY, 2),
      width: (zoneBounds?.width ?? 92) * scaleX,
      height: (zoneBounds?.height ?? 50) * scaleY,
    };
  }
  if (attachment.zoneId === "ring-stand-crucible-seat" && child.definitionId === "crucible-with-lid") {
    return {
      ...layerFor(child, parentLayer.x + (zoneBounds?.x ?? 84) * scaleX, parentLayer.y + (zoneBounds?.y ?? 118) * scaleY, 3),
      width: (zoneBounds?.width ?? 84) * scaleX,
      height: (zoneBounds?.height ?? 64) * scaleY,
    };
  }
  if (!zoneBounds) return undefined;
  const width = childSize.width * scaleX;
  const height = childSize.height * scaleY;
  return {
    ...layerFor(
      child,
      parentLayer.x + (zoneBounds.x + zoneBounds.width / 2) * scaleX - width / 2,
      parentLayer.y + (zoneBounds.y + zoneBounds.height / 2) * scaleY - height / 2,
      parentLayer.zIndex + 1,
    ),
    width,
    height,
  };
};

const nodeFromInstance = (
  instance: EquipmentInstance,
  index: number,
  positionOverride?: { x: number; y: number },
): RenderNode => {
  const size = getBenchSize(instance.definitionId);
  const footprint = getFootprint(instance.definitionId);
  const hitBox = getHitBox(instance.definitionId);
  const position = {
    x: positionOverride?.x ?? instance.x ?? defaultPosition(index).x,
    y: positionOverride?.y ?? instance.y ?? defaultPosition(index).y,
  };
  return {
    id: instance.id,
    representedInstanceIds: [instance.id],
    primaryInstanceId: instance.id,
    layers: [layerFor(instance)],
    transform: {
      x: position.x,
      y: position.y,
      rotation: instance.rotation,
      zIndex: instance.zIndex ?? index + 1,
    },
    bounds: { x: 0, y: 0, width: size.width, height: size.height },
    footprint,
    hitBox,
    accessibleLabel: instance.label,
    selectionTargetId: instance.id,
  };
};

export const resolveWorkbenchScene = (
  state: Pick<RuntimeState, "equipmentInstances" | "attachments">,
): RenderNode[] => {
  const placed = state.equipmentInstances.filter((instance) =>
    isVisibleWorkbenchLocation(instance.location),
  );
  const attachments = resolveAttachments(state);
  const parentById = new Map(state.equipmentInstances.map((instance) => [instance.id, instance]));
  const isEmbeddedByParentStateAsset = (attachment: AttachmentRelation): boolean => {
    if (attachment.renderMode !== "independent") return false;
    const parent = parentById.get(attachment.parentInstanceId);
    return Boolean(parent && rendersCompleteStateAsset(parent));
  };
  const delegatedChildIds = new Set(
    attachments
      .filter(
        (attachment) =>
          attachment.renderMode === "delegated" ||
          attachment.renderMode === "layered" ||
          isEmbeddedByParentStateAsset(attachment),
      )
      .map((attachment) => attachment.childInstanceId),
  );
  const attachmentsByParent = new Map<string, AttachmentRelation[]>();
  const receivingAttachmentByChild = new Map<string, AttachmentRelation>();
  for (const attachment of attachments) {
    const list = attachmentsByParent.get(attachment.parentInstanceId) ?? [];
    list.push(attachment);
    attachmentsByParent.set(attachment.parentInstanceId, list);
    if (attachment.renderMode === "independent" && attachment.relationType === "receiving") {
      receivingAttachmentByChild.set(attachment.childInstanceId, attachment);
    }
  }

  const renderableInstances = placed.filter((instance) => !delegatedChildIds.has(instance.id));
  const renderIndexById = new Map(renderableInstances.map((instance, index) => [instance.id, index]));
  const positionFor = (instance: EquipmentInstance): { x: number; y: number } => {
    const index = renderIndexById.get(instance.id) ?? placed.findIndex((candidate) => candidate.id === instance.id);
    return {
      x: instance.x ?? defaultPosition(Math.max(0, index)).x,
      y: instance.y ?? defaultPosition(Math.max(0, index)).y,
    };
  };
  const receivingPositionFor = (instance: EquipmentInstance): { x: number; y: number } | undefined => {
    const attachment = receivingAttachmentByChild.get(instance.id);
    if (!attachment) return undefined;
    const parent = state.equipmentInstances.find((candidate) => candidate.id === attachment.parentInstanceId);
    if (!parent) return undefined;
    const anchor = profileZoneAnchor(parent.definitionId, attachment.zoneId);
    if (!anchor) return undefined;
    const parentPosition = positionFor(parent);
    const childSize = getBenchSize(instance.definitionId);
    const sourceAnchor = getSnapSourceAnchor(
      instance.definitionId,
      parent.definitionId,
      attachment.zoneId,
    ) ?? { x: 0.5, y: 0.5 };
    return {
      x: parentPosition.x + anchor.x - childSize.width * sourceAnchor.x,
      y: parentPosition.y + anchor.y - childSize.height * sourceAnchor.y,
    };
  };

  return renderableInstances
    .map((instance, index) => {
      const base = nodeFromInstance(instance, index, receivingPositionFor(instance));
      const layers = [...base.layers];
      const visitedInstanceIds = new Set([instance.id]);
      const appendAttachedLayers = (
        parentInstance: EquipmentInstance,
        parentLayer: RenderLayer,
      ) => {
        const childAttachments = (attachmentsByParent.get(parentInstance.id) ?? []).filter(
          (attachment) =>
            attachment.renderMode === "delegated" ||
            attachment.renderMode === "layered" ||
            (attachment.renderMode === "independent" && rendersCompleteStateAsset(parentInstance)),
        );
        for (const attachment of childAttachments) {
          const child = state.equipmentInstances.find(
            (candidate) => candidate.id === attachment.childInstanceId,
          );
          if (!child || visitedInstanceIds.has(child.id)) continue;
          const childLayer = childLayerForAttachment(parentInstance, child, attachment, parentLayer);
          if (!childLayer) continue;
          visitedInstanceIds.add(child.id);
          layers.push(childLayer);
          appendAttachedLayers(child, childLayer);
        }
      };
      appendAttachedLayers(instance, base.layers[0]);
      if (layers.length === 1) return base;

      const representedInstanceIds = layers.map((layer) => layer.instanceId);
      const childLabels = layers.slice(1)
        .map((layer) => equipmentById.get(layer.definitionId)?.label)
        .filter((label): label is string => Boolean(label));
      const bounds = union(layers.map((layer) => ({
        x: layer.x,
        y: layer.y,
        width: layer.width,
        height: layer.height,
      })));
      return {
        ...base,
        id: `${instance.id}-composite`,
        representedInstanceIds,
        layers,
        bounds,
        hitBox: union([base.hitBox, bounds]),
        accessibleLabel:
          childLabels.length > 0
            ? `${instance.label} with ${childLabels.join(", ")}`
            : instance.label,
        attachedSummary: childLabels.length > 0 ? `Attached: ${childLabels.join(", ")}` : undefined,
      };
    })
    .sort((a, b) => (a.transform.zIndex ?? 0) - (b.transform.zIndex ?? 0));
};

export const renderLayersForNode = (
  node: RenderNode,
  instances: EquipmentInstance[],
): EquipmentViewLayer[] => {
  const resolved: EquipmentViewLayer[] = [];
  for (const layer of node.layers) {
    const definition = equipmentById.get(layer.definitionId);
    if (!definition) continue;
    resolved.push({
      id: layer.id,
      definition,
      instance: instances.find((instance) => instance.id === layer.instanceId),
      x: layer.x - node.bounds.x,
      y: layer.y - node.bounds.y,
      width: layer.width,
      height: layer.height,
      zIndex: layer.zIndex,
    });
  }
  return resolved;
};
