import { describe, expect, it } from "vitest";
import type { ActionInteractionSpec } from "../../domain/types";
import { createEquipmentInstance } from "../../equipment/catalog";
import { getFootprint } from "../../equipment/visualCatalog";
import { makeAttachmentRelation } from "../../runtime/attachments";
import { resolveBenchOverlap } from "../benchOverlap";
import {
  benchBoundsForInteractionSource,
  benchTargetBoundsForInteraction,
  benchTargetBoundsForNode,
  snapPointAligningSourceAnchor,
} from "../benchTargeting";
import { resolveWorkbenchScene } from "../resolveWorkbenchScene";

const interaction: ActionInteractionSpec = {
  type: "snapIntoTarget",
  sourceDefinitionId: "erlenmeyer-flask-250ml",
  targetDefinitionId: "ring-stand-clamp",
  snapZoneId: "ring-stand-burette-receiver",
  accessibleLabel: "Place the Erlenmeyer flask beneath the mounted burette tip.",
};

describe("titration receiving flask placement", () => {
  it("accepts the flask by its foot on the stand base rather than by a body-only overlap", () => {
    const stand = { ...createEquipmentInstance("ring-stand-clamp", "stand", "workbench"), x: 60, y: 30 };
    const flask = { ...createEquipmentInstance("erlenmeyer-flask-250ml", "receiver", "workbench"), x: 0, y: 0 };
    const standNode = resolveWorkbenchScene({ equipmentInstances: [stand], attachments: [] })[0];
    const flaskNode = resolveWorkbenchScene({ equipmentInstances: [flask], attachments: [] })[0];
    const candidates = benchTargetBoundsForNode(standNode, standNode.transform, [stand, flask]).map((bounds) =>
      benchTargetBoundsForInteraction(bounds, interaction),
    );
    const target = candidates.find((candidate) => candidate.id === stand.id);
    if (!target) throw new Error("Missing titration receiver target.");

    const snapPoint = snapPointAligningSourceAnchor(target, flask.definitionId, interaction.snapZoneId!);
    if (!snapPoint) throw new Error("Missing titration receiver snap point.");

    const snapped = benchBoundsForInteractionSource(flaskNode, snapPoint, [stand, flask], interaction);
    const belowBaseOverlap = benchBoundsForInteractionSource(
      flaskNode,
      { x: snapPoint.x, y: snapPoint.y + 14 },
      [stand, flask],
      interaction,
    );

    expect(target).toMatchObject({ x: 240, y: 354, width: 66, height: 52 });
    expect(snapped).toMatchObject({ width: 4, height: 4 });
    expect(resolveBenchOverlap(snapped, candidates, interaction).kind).toBe("valid");
    expect(resolveBenchOverlap(belowBaseOverlap, candidates, interaction).kind).toBe("moveOnly");
  });

  it("renders the accepted flask over the stand base and directly below the burette outlet", () => {
    const stand = { ...createEquipmentInstance("ring-stand-clamp", "stand", "workbench"), x: 60, y: 30 };
    const burette = {
      ...createEquipmentInstance("burette-50ml", "burette", "snapZone"),
      snapZoneId: "ring-stand-burette-clamp",
      interactionStatus: "snapped" as const,
    };
    const flask = {
      ...createEquipmentInstance("erlenmeyer-flask-250ml", "receiver", "snapZone"),
      snapZoneId: "ring-stand-burette-receiver",
      interactionStatus: "snapped" as const,
    };
    const buretteAttachment = makeAttachmentRelation(stand.id, burette.id, "ring-stand-burette-clamp");
    const flaskAttachment = makeAttachmentRelation(stand.id, flask.id, "ring-stand-burette-receiver");
    if (!buretteAttachment || !flaskAttachment) throw new Error("Missing titration attachment fixture.");

    const nodes = resolveWorkbenchScene({
      equipmentInstances: [stand, burette, flask],
      attachments: [buretteAttachment, flaskAttachment],
    });
    const standNode = nodes.find((node) => node.primaryInstanceId === stand.id);
    const flaskNode = nodes.find((node) => node.primaryInstanceId === flask.id);
    const mountedBurette = standNode?.layers.find((layer) => layer.instanceId === burette.id);
    if (!standNode || !flaskNode || !mountedBurette) throw new Error("Missing titration workbench layers.");

    const standBase = getFootprint(stand.definitionId);
    const flaskFoot = getFootprint(flask.definitionId);
    const standBaseTop = standNode.transform.y + standBase.y;
    const standBaseBottom = standBaseTop + standBase.height;
    const flaskFootTop = flaskNode.transform.y + flaskFoot.y;
    const flaskFootBottom = flaskFootTop + flaskFoot.height;
    const buretteOutletX = standNode.transform.x + mountedBurette.x + mountedBurette.width * 0.5;
    const buretteOutletY = standNode.transform.y + mountedBurette.y + mountedBurette.height * 0.97;

    const flaskMouthTopY = flaskNode.transform.y + 30;

    expect(flaskNode.transform).toMatchObject({ x: 220, y: 273 });
    expect(flaskFootTop).toBeGreaterThanOrEqual(standBaseTop);
    expect(flaskFootBottom).toBeLessThanOrEqual(standBaseBottom);
    expect(flaskNode.transform.x + 53).toBeCloseTo(buretteOutletX, 4);
    expect(flaskMouthTopY - buretteOutletY).toBeGreaterThanOrEqual(0);
    expect(flaskMouthTopY - buretteOutletY).toBeLessThanOrEqual(4);
    expect(flaskNode.transform.zIndex).toBeGreaterThan(standNode.transform.zIndex ?? 0);
  });
});
