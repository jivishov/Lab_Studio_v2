import { getInteractionZone } from "../domain/interactionZones";
import type {
  AttachmentRelation,
  EquipmentInstance,
  EquipmentLocation,
  RuntimeState,
} from "../domain/types";
import { equipmentById } from "../equipment/catalog";

const cloneAttachment = (attachment: AttachmentRelation): AttachmentRelation => ({ ...attachment });

/**
 * A closed developing chamber refuses every access to what is inside it.
 *
 * Investigation 5 requires the container to be sealed during development (printed page 49). The
 * same lid that makes that true also means nothing can be put in or taken out until the learner
 * opens it again, so this is checked wherever a child can enter or leave an apparatus — the
 * attachment path, the place/move paths and the pour path — not only in the develop handler. A
 * process-only prerequisite would leave the other entry paths unguarded.
 *
 * Apparatus that models no lid leaves `developingChamberClosed` absent and is unaffected.
 */
export const closedChamberAccessRefusal = (
  apparatus: Pick<EquipmentInstance, "label" | "contents">,
): { message: string; recovery: string } | undefined =>
  apparatus.contents.developingChamberClosed === true
    ? {
        message: `${apparatus.label} is closed.`,
        recovery: "Open the chamber before putting anything into it or taking anything out.",
      }
    : undefined;

export const attachmentId = (parentInstanceId: string, childInstanceId: string, zoneId: string): string =>
  `${parentInstanceId}:${zoneId}:${childInstanceId}`;

const renderModeForRelation = (
  relationType: AttachmentRelation["relationType"],
): AttachmentRelation["renderMode"] => {
  if (relationType === "mounted") return "layered";
  if (relationType === "receiving") return "independent";
  return "delegated";
};

const lockedForRelation = (relationType: AttachmentRelation["relationType"]): boolean =>
  relationType === "inserted" || relationType === "mounted" || relationType === "placedOn";

export const makeAttachmentRelation = (
  parentInstanceId: string,
  childInstanceId: string,
  zoneId: string,
): AttachmentRelation | undefined => {
  const zone = getInteractionZone(zoneId);
  if (!zone || zone.relationType === "insideInstrument") return undefined;
  return {
    id: attachmentId(parentInstanceId, childInstanceId, zoneId),
    parentInstanceId,
    childInstanceId,
    zoneId,
    relationType: zone.relationType,
    renderMode: renderModeForRelation(zone.relationType),
    locked: lockedForRelation(zone.relationType),
  };
};

export const attachmentsForParent = (
  state: Pick<RuntimeState, "attachments">,
  parentInstanceId: string,
): AttachmentRelation[] =>
  state.attachments.filter((attachment) => attachment.parentInstanceId === parentInstanceId);

export const attachmentsForChild = (
  state: Pick<RuntimeState, "attachments">,
  childInstanceId: string,
): AttachmentRelation[] =>
  state.attachments.filter((attachment) => attachment.childInstanceId === childInstanceId);

export const childAttachmentByRelation = (
  state: Pick<RuntimeState, "attachments" | "equipmentInstances">,
  parentInstanceId: string,
  relationType: AttachmentRelation["relationType"],
): { attachment: AttachmentRelation; child: EquipmentInstance } | undefined => {
  const attachment = state.attachments.find(
    (candidate) =>
      candidate.parentInstanceId === parentInstanceId &&
      candidate.relationType === relationType,
  );
  const child = attachment
    ? state.equipmentInstances.find((instance) => instance.id === attachment.childInstanceId)
    : undefined;
  return attachment && child ? { attachment, child } : undefined;
};

export const zoneOccupancy = (
  state: Pick<RuntimeState, "attachments">,
  parentInstanceId: string,
  zoneId: string,
): AttachmentRelation[] =>
  state.attachments.filter(
    (attachment) => attachment.parentInstanceId === parentInstanceId && attachment.zoneId === zoneId,
  );

type AttachmentStateParameters = Record<
  string,
  string | number | boolean | string[] | undefined
>;

const stringParameter = (
  parameters: AttachmentStateParameters,
  key: string,
): string | undefined => {
  const value = parameters[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
};

/**
 * Enforces live apparatus state for actions whose physical validity depends on an attachment.
 * Action evidence alone is intentionally insufficient: a learner can detach or move apparatus
 * after completing an earlier process node.
 */
export const validateActionAttachmentState = (
  state: Pick<RuntimeState, "attachments" | "equipmentInstances">,
  parameters: AttachmentStateParameters,
): { message: string; recovery: string } | undefined => {
  const requiredState = stringParameter(parameters, "requiredAttachmentState");
  if (requiredState !== "attached" && requiredState !== "detached") return undefined;

  const parentDefinitionId = stringParameter(parameters, "attachmentParentDefinitionId");
  const childDefinitionId = stringParameter(parameters, "attachmentChildDefinitionId");
  const zoneId = stringParameter(parameters, "attachmentSnapZoneId");
  if (!parentDefinitionId || !childDefinitionId || !zoneId) {
    return {
      message: "The required apparatus attachment is not fully configured.",
      recovery: "Reload the activity or ask the instructor to review this step.",
    };
  }

  const parent = state.equipmentInstances.find(
    (instance) => instance.definitionId === parentDefinitionId,
  );
  const child = state.equipmentInstances.find(
    (instance) => instance.definitionId === childDefinitionId,
  );
  const parentLabel = parent?.label ?? equipmentById.get(parentDefinitionId)?.label ?? "target apparatus";
  const childLabel = child?.label ?? equipmentById.get(childDefinitionId)?.label ?? "required equipment";
  const zoneLabel =
    equipmentById
      .get(parentDefinitionId)
      ?.snapZones.find((zone) => zone.id === zoneId)?.label ?? "the required seat";
  const exactAttachment = Boolean(
    parent &&
      child &&
      state.attachments.some(
        (attachment) =>
          attachment.parentInstanceId === parent.id &&
          attachment.childInstanceId === child.id &&
          attachment.zoneId === zoneId,
      ),
  );

  if (requiredState === "detached") {
    return exactAttachment
      ? {
          message: `${childLabel} is still seated on ${parentLabel}.`,
          recovery: `Remove ${childLabel} and return it to the equipment shelf before continuing.`,
        }
      : undefined;
  }
  if (exactAttachment) return undefined;

  const attachedElsewhere = Boolean(
    child && state.attachments.some((attachment) => attachment.childInstanceId === child.id),
  );
  return attachedElsewhere
    ? {
        message: `${childLabel} is attached in the wrong place.`,
        recovery: `Detach it, then seat it in ${zoneLabel} on ${parentLabel}.`,
      }
    : {
        message: `${childLabel} is not seated on ${parentLabel}.`,
        recovery: `Seat ${childLabel} in ${zoneLabel} before continuing.`,
      };
};

export const canAttach = (
  state: Pick<RuntimeState, "attachments" | "equipmentInstances">,
  parent: EquipmentInstance,
  child: EquipmentInstance,
  zoneId: string,
): { ok: true; attachment: AttachmentRelation } | { ok: false; message: string; recovery: string } => {
  const closed = closedChamberAccessRefusal(parent);
  if (closed) return { ok: false, ...closed };
  const zone = getInteractionZone(zoneId);
  if (!zone) {
    return {
      ok: false,
      message: "The selected snap zone is not configured.",
      recovery: "Use a configured target zone for this equipment.",
    };
  }
  if (parent.definitionId !== zone.ownerDefinitionId) {
    return {
      ok: false,
      message: "That target does not own the selected snap zone.",
      recovery: "Use the highlighted parent equipment for this step.",
    };
  }
  if (!zone.accepts.includes(child.definitionId)) {
    return {
      ok: false,
      message: "That equipment cannot attach to the selected zone.",
      recovery: "Choose equipment accepted by the highlighted target.",
    };
  }
  const existingForChild = attachmentsForChild(state, child.id).filter(
    (attachment) => attachment.parentInstanceId !== parent.id || attachment.zoneId !== zoneId,
  );
  if (existingForChild.length > 0) {
    return {
      ok: false,
      message: "That equipment is already attached elsewhere.",
      recovery: "Detach it before attaching it to another apparatus.",
    };
  }
  const occupied = zoneOccupancy(state, parent.id, zoneId).filter(
    (attachment) => attachment.childInstanceId !== child.id,
  );
  if (occupied.length >= zone.maxOccupancy) {
    return {
      ok: false,
      message: "That snap zone is already occupied.",
      recovery: "Remove the attached item before placing another one there.",
    };
  }
  const attachment = makeAttachmentRelation(parent.id, child.id, zoneId);
  if (!attachment) {
    return {
      ok: false,
      message: "That snap zone is not modeled as a runtime attachment.",
      recovery: "Use another compatible target zone.",
    };
  }
  return { ok: true, attachment };
};

export const upsertAttachment = (
  state: RuntimeState,
  attachment: AttachmentRelation,
): RuntimeState => ({
  ...state,
  attachments: [
    ...state.attachments.filter(
      (candidate) =>
        candidate.id !== attachment.id &&
        candidate.childInstanceId !== attachment.childInstanceId,
    ),
    attachment,
  ],
});

export const detachChild = (state: RuntimeState, childInstanceId: string): RuntimeState => ({
  ...state,
  attachments: state.attachments.filter((attachment) => attachment.childInstanceId !== childInstanceId),
});

export const detachParentChildren = (state: RuntimeState, parentInstanceId: string): RuntimeState => ({
  ...state,
  attachments: state.attachments.filter((attachment) => attachment.parentInstanceId !== parentInstanceId),
});

const parentDefinitionForSnapZone = (zoneId: string): string | undefined => {
  const configured = getInteractionZone(zoneId)?.ownerDefinitionId;
  if (configured) return configured;
  for (const definition of equipmentById.values()) {
    if (definition.snapZones.some((zone) => zone.id === zoneId)) return definition.id;
  }
  return undefined;
};

export const deriveLegacyAttachments = (
  equipmentInstances: EquipmentInstance[],
): AttachmentRelation[] => {
  const attachments: AttachmentRelation[] = [];
  for (const child of equipmentInstances) {
    if (!child.snapZoneId || child.location !== "snapZone") continue;
    const parentDefinitionId = parentDefinitionForSnapZone(child.snapZoneId);
    if (!parentDefinitionId) continue;
    const parent = equipmentInstances.find(
      (candidate) => candidate.definitionId === parentDefinitionId && candidate.id !== child.id,
    );
    if (!parent) continue;
    const attachment = makeAttachmentRelation(parent.id, child.id, child.snapZoneId);
    if (attachment) attachments.push(attachment);
  }
  return attachments;
};

export const resolveAttachments = (
  state: Pick<RuntimeState, "attachments" | "equipmentInstances">,
): AttachmentRelation[] => {
  const byId = new Map<string, AttachmentRelation>();
  for (const attachment of state.attachments) byId.set(attachment.id, cloneAttachment(attachment));
  for (const attachment of deriveLegacyAttachments(state.equipmentInstances)) {
    if (!byId.has(attachment.id)) byId.set(attachment.id, attachment);
  }
  return [...byId.values()];
};

export const withResolvedAttachments = (state: RuntimeState): RuntimeState => ({
  ...state,
  attachments: resolveAttachments(state),
});

export const moveLockedChildren = (
  state: RuntimeState,
  parentBefore: EquipmentInstance,
  parentAfter: EquipmentInstance,
): RuntimeState => {
  const dx = (parentAfter.x ?? parentBefore.x ?? 0) - (parentBefore.x ?? 0);
  const dy = (parentAfter.y ?? parentBefore.y ?? 0) - (parentBefore.y ?? 0);
  if (dx === 0 && dy === 0) return state;
  const lockedChildIds = new Set(
    state.attachments
      .filter((attachment) => attachment.parentInstanceId === parentAfter.id && attachment.locked)
      .map((attachment) => attachment.childInstanceId),
  );
  if (lockedChildIds.size === 0) return state;
  const equipmentInstances = state.equipmentInstances.map((instance) =>
    lockedChildIds.has(instance.id)
      ? {
          ...instance,
          x: (instance.x ?? parentBefore.x ?? 0) + dx,
          y: (instance.y ?? parentBefore.y ?? 0) + dy,
        }
      : instance,
  );
  return {
    ...state,
    equipmentInstances,
    contents: Object.fromEntries(equipmentInstances.map((instance) => [instance.id, instance.contents])),
  };
};

export const nearbyDetachedChildren = (
  state: RuntimeState,
  parent: EquipmentInstance,
  location: EquipmentLocation = "workbench",
): RuntimeState => {
  const childIds = new Set(
    state.attachments
      .filter((attachment) => attachment.parentInstanceId === parent.id)
      .map((attachment) => attachment.childInstanceId),
  );
  if (childIds.size === 0) return state;
  const equipmentInstances = state.equipmentInstances.map((instance, index) =>
    childIds.has(instance.id)
      ? {
          ...instance,
          location,
          snapZoneId: undefined,
          interactionStatus: "free" as const,
          x: (parent.x ?? 40) + 28 + index * 12,
          y: (parent.y ?? 40) + 28 + index * 12,
        }
      : instance,
  );
  return {
    ...state,
    equipmentInstances,
    attachments: state.attachments.filter((attachment) => attachment.parentInstanceId !== parent.id),
    contents: Object.fromEntries(equipmentInstances.map((instance) => [instance.id, instance.contents])),
  };
};
