import {
  emptyContents,
  type ContentState,
  type EquipmentDefinition,
  type EquipmentInstance,
  type QualitativeSolidProvenanceRecord,
  type SoluteState,
} from "../domain/types";
import {
  mergeTransferredSolid,
  physicalSolidTransferTargetError,
  resolvePhysicalSolidInventoryMassG,
  splitSolidForMass,
  wholeRemainingSolidEligibility,
  UNKNOWN_PHYSICAL_SOLID_QUANTITY_MESSAGE,
  UNKNOWN_PHYSICAL_SOLID_QUANTITY_RECOVERY,
} from "./contentTransfer";

/**
 * Shared solid-material operations.
 *
 * Both the reducer's transfer branch and the green-chemistry custom route call these, so that a
 * route cannot grow a second eligibility or merge algorithm that drifts from the runtime's. Every
 * function here is pure: it reads a slice and returns a new instance list, and never mutates its
 * input. Action-value resolution, measurement emission, thermal response-series generation, node
 * advancement and prerequisite validation all stay with the caller.
 */

/**
 * A caller-owned ledger entry for one configured stock container.
 *
 * Deliberately *not* named `SolidStockInitializationRecord`: `src/domain/types.ts` already exports
 * that name for the reducer's own lifecycle record, which carries the setup action id and the
 * evidence scope in force. A custom route has neither, so it keeps its own entry shape rather than
 * pretending to hold runtime evidence provenance. The eligibility rules both callers enforce are
 * shared - see `configuredSolidStockContents` below - so only the bookkeeping differs.
 */
export interface ConfiguredSolidStockLedgerEntry {
  /** The container the configured stock was issued into. */
  instanceId: string;
  definitionId: string;
  /** Configured gram total. A teacher setup quantity, never a balance reading. */
  massG: number;
  /** The single component the configured total belongs to, so no allocation is ever implied. */
  materialSoluteId: string;
  materialLabel: string;
  /** Evidence id the configuring action emitted, for auditability. */
  outputMeasurementId: string;
}

export interface SolidMaterialSlice {
  instances: readonly EquipmentInstance[];
  stockInitializations: Readonly<Record<string, ConfiguredSolidStockLedgerEntry>>;
}

export type SolidTransferStream = "unheated" | "heated-product";

/**
 * Optional identity constraints for a caller that owns a named material stream.
 *
 * The default reducer path leaves these unset so existing solid and dissolution actions retain
 * their historical destination semantics. The green route supplies trusted values from its
 * compiled holder/configuration context; the helper then checks both the actual source inventory
 * and any occupied receiver before it can construct a new slice.
 */
export interface SolidTransferIdentityConstraints {
  materialId: string;
  materialLabel?: string;
  destinationStream?: SolidTransferStream;
  runId?: string;
  replicate?: number;
  sourceActionId?: string;
}

const qualitativeTrustedContextError = (
  constraints: SolidTransferIdentityConstraints | undefined,
): string | undefined => {
  if (
    !constraints
    || typeof constraints.materialId !== "string"
    || !constraints.materialId.trim()
    || typeof constraints.materialLabel !== "string"
    || !constraints.materialLabel.trim()
    || (constraints.destinationStream !== "unheated" && constraints.destinationStream !== "heated-product")
    || typeof constraints.runId !== "string"
    || !constraints.runId.trim()
    || typeof constraints.replicate !== "number"
    || !Number.isInteger(constraints.replicate)
    || constraints.replicate <= 0
    || typeof constraints.sourceActionId !== "string"
    || !constraints.sourceActionId.trim()
  ) {
    return "Qualitative recovery requires complete trusted run, replicate, material, stream and source-action context.";
  }
  return undefined;
};

export type SolidTransferRequest =
  | {
      mode: "measured-portion";
      sourceInstanceId: string;
      targetInstanceId: string;
      massG: number;
      /** A measured portion always lands as physical mass; qualitative is not legal here. */
      destinationRepresentation?: "physical";
      constraints?: SolidTransferIdentityConstraints;
      targetLabel?: string;
      visualState?: string;
    }
  | {
      mode: "whole-remaining";
      sourceInstanceId: string;
      targetInstanceId: string;
      requireNonEmptySource: boolean;
      destinationRepresentation?: "physical" | "qualitative-unknown";
      /** Required by, and only by, a `qualitative-unknown` destination. */
      provenance?: QualitativeSolidProvenanceRecord;
      constraints?: SolidTransferIdentityConstraints;
      targetLabel?: string;
      visualState?: string;
    };

export interface SolidMaterialOutcome {
  ok: boolean;
  instances: EquipmentInstance[];
  /** How much represented inventory left the source. Zero for a genuine no-op. */
  movedSourceInventoryMassG: number;
  /** False only for a qualitative destination, whose physical mass nobody measured. */
  destinationPhysicalMassKnown: boolean;
  destinationRecordIds?: string[];
  message?: string;
  recovery?: string;
  /** The source was genuinely empty and a residual step truthfully completed with nothing to move. */
  noOp?: boolean;
}

const failure = (
  slice: SolidMaterialSlice,
  message: string,
  recovery: string,
): SolidMaterialOutcome => ({
  ok: false,
  instances: [...slice.instances],
  movedSourceInventoryMassG: 0,
  destinationPhysicalMassKnown: true,
  message,
  recovery,
});

const withInstance = (
  instances: readonly EquipmentInstance[],
  instanceId: string,
  update: (instance: EquipmentInstance) => EquipmentInstance,
): EquipmentInstance[] =>
  instances.map((instance) => (instance.id === instanceId ? update(instance) : instance));

const isQualitativeReceiver = (contents: ContentState): boolean =>
  Array.isArray(contents.qualitativeSolidProvenance)
  && contents.qualitativeSolidProvenance.length > 0;

const hasMalformedQualitativeProvenance = (contents: ContentState): boolean =>
  contents.qualitativeSolidProvenance !== undefined
  && !Array.isArray(contents.qualitativeSolidProvenance);

const receiverHoldsPhysicalMaterial = (contents: ContentState): boolean =>
  contents.kind !== "empty"
  && contents.kind !== "solid"
  || contents.massG !== undefined
  || !Array.isArray(contents.solutes)
  || contents.solutes.length > 0
  || contents.volumeMl !== undefined
  || contents.finalVolumeMl !== undefined
  || contents.concentration !== undefined
  || contents.precipitate !== undefined
  || contents.chromatogram !== undefined
  || contents.unallocatedInventory !== undefined
  || (contents.wasteContents?.length ?? 0) > 0
  || hasMalformedQualitativeProvenance(contents);

const isGenuinelyEmptyContents = (contents: ContentState): boolean =>
  contents.kind === "empty"
  && contents.massG === undefined
  && contents.volumeMl === undefined
  && contents.finalVolumeMl === undefined
  && Array.isArray(contents.solutes)
  && contents.solutes.length === 0
  && contents.concentration === undefined
  && contents.precipitate === undefined
  && contents.chromatogram === undefined
  && Array.isArray(contents.contamination)
  && contents.contamination.length === 0
  && contents.temperatureC === undefined
  && contents.recordedTemperature === undefined
  && contents.recoveryEvidence === undefined
  && contents.unallocatedInventory === undefined
  && contents.allocationReferenceId === undefined
  && (contents.wasteContents?.length ?? 0) === 0
  && contents.extractionState === undefined
  && contents.probeImmersedInInstanceId === undefined
  && contents.instrumentReadout === undefined
  && contents.wetState === "dry"
  && contents.visualState === "empty"
  && (contents.qualitativeSolidProvenance === undefined
    || (Array.isArray(contents.qualitativeSolidProvenance)
      && contents.qualitativeSolidProvenance.length === 0));

const positiveSolutes = (contents: ContentState): readonly SoluteState[] =>
  Array.isArray(contents.solutes)
    ? contents.solutes.filter((solute) => Boolean(solute) && Number.isFinite(solute.amount) && solute.amount > 0)
    : [];

const strictMaterialIdentityError = (
  contents: ContentState,
  constraints: SolidTransferIdentityConstraints | undefined,
  role: "source" | "destination",
  allowEmpty: boolean,
): string | undefined => {
  if (!constraints) return undefined;
  if (allowEmpty && isGenuinelyEmptyContents(contents)) return undefined;
  if (hasMalformedQualitativeProvenance(contents)) {
    return `The named ${role} has malformed qualitative solid provenance.`;
  }
  const entries = positiveSolutes(contents);
  if (entries.length === 0) {
    return `The named ${role} does not identify the configured solid material.`;
  }
  if (entries.some((solute) => solute.id !== constraints.materialId)) {
    return `The named ${role} contains a different solid material.`;
  }
  if (
    constraints.materialLabel
    && entries.some(
      (solute) => solute.id === constraints.materialId && solute.label !== constraints.materialLabel,
    )
  ) {
    return `The named ${role} does not carry the configured solid material label.`;
  }
  return undefined;
};

const strictDestinationError = (
  contents: ContentState,
  constraints: SolidTransferIdentityConstraints | undefined,
  qualitative: boolean,
): string | undefined => {
  if (!constraints) return undefined;
  if (qualitative && isQualitativeReceiver(contents)) return undefined;
  if (qualitative) {
    if (
      hasMalformedQualitativeProvenance(contents)
      || receiverHoldsPhysicalMaterial(contents)
      || !isGenuinelyEmptyContents(contents)
    ) {
      return "The named recovery container already holds contradictory physical material.";
    }
    return undefined;
  }
  if (isGenuinelyEmptyContents(contents)) return undefined;
  if (isQualitativeReceiver(contents)) {
    return UNKNOWN_PHYSICAL_SOLID_QUANTITY_MESSAGE;
  }
  if (
    contents.kind !== "solid"
    && contents.kind !== "mixture"
  ) {
    return "The named destination does not hold a compatible physical solid stream.";
  }
  if (resolvePhysicalSolidInventoryMassG(contents) === undefined) {
    return "The named destination does not hold a usable physical solid inventory.";
  }
  return strictMaterialIdentityError(contents, constraints, "destination", false);
};

const qualitativeRecordShapeError = (
  candidate: unknown,
  targetInstanceId: string,
  constraints: SolidTransferIdentityConstraints,
): string | undefined => {
  if (!candidate || typeof candidate !== "object") {
    return "The named recovery container contains an invalid product provenance record.";
  }
  const record = candidate as Partial<QualitativeSolidProvenanceRecord>;
  const requiredIds = [
    record.recordId,
    record.runId,
    record.sourceMaterialId,
    record.sourceMaterialLabel,
    record.sourceInstanceId,
    record.destinationInstanceId,
    record.sourceActionId,
  ];
  if (requiredIds.some((value) => typeof value !== "string" || value.trim().length === 0)) {
    return "A qualitative recovery record must name its run, material, record and action identities.";
  }
  if (record.destinationInstanceId !== targetInstanceId) {
    return "The qualitative recovery record does not match the named destination container.";
  }
  if (
    record.operationId !== "recover-replicate-product"
    || record.stream !== "heated-product"
    || record.quantityBasis !== "source-inventory-equivalent"
    || record.destinationPhysicalMassKnown !== false
  ) {
    return "A qualitative recovery record must identify a heated product with unknown physical quantity.";
  }
  if (
    typeof record.replicate !== "number"
    || !Number.isInteger(record.replicate)
    || record.replicate <= 0
  ) {
    return "A qualitative recovery record must name a positive integer replicate.";
  }
  if (
    typeof record.sourceInventoryMassG !== "number"
    || !Number.isFinite(record.sourceInventoryMassG)
    || record.sourceInventoryMassG < 0
    || typeof record.sourceInventoryEquivalentMassG !== "number"
    || !Number.isFinite(record.sourceInventoryEquivalentMassG)
    || record.sourceInventoryEquivalentMassG < 0
    || record.sourceInventoryMassG !== record.sourceInventoryEquivalentMassG
  ) {
    return "A qualitative recovery record must carry matching finite non-negative source inventory amounts.";
  }
  for (const [name, values] of [
    ["measurement", record.measurementEvidenceIds],
    ["recovery", record.recoveryEvidenceIds],
    ["route", record.routeEvidenceIds],
  ] as const) {
    if (!Array.isArray(values) || values.some((value) => typeof value !== "string" || !value.trim())) {
      return `A qualitative recovery record must carry a valid ${name} evidence-id array.`;
    }
  }
  if (record.sourceMaterialId !== constraints.materialId) {
    return "The qualitative recovery record does not match the configured source material.";
  }
  if (record.sourceMaterialLabel !== constraints.materialLabel) {
    return "The qualitative recovery record does not match the configured source material label.";
  }
  if (record.stream !== constraints.destinationStream) {
    return "The qualitative recovery record does not match the configured recovery stream.";
  }
  if (record.runId !== constraints.runId) {
    return "The qualitative recovery record belongs to a different run.";
  }
  if (constraints.replicate !== undefined && record.replicate !== constraints.replicate) {
    return "The qualitative recovery record belongs to a different replicate.";
  }
  if (record.sourceActionId !== constraints.sourceActionId) {
    return "The qualitative recovery record does not match the approved recovery action.";
  }
  return undefined;
};

/**
 * A qualitative receiver may accumulate further deliveries only from the same run, material and
 * stream. Anything else would merge two unrelated recoveries into one indistinguishable pile, which
 * is the failure the per-record provenance exists to prevent.
 */
const qualitativeReceiverConflict = (
  contents: ContentState,
  record: QualitativeSolidProvenanceRecord,
  targetInstanceId: string,
  constraints: SolidTransferIdentityConstraints,
): string | undefined => {
  if (receiverHoldsPhysicalMaterial(contents)) {
    return "The named recovery container already holds physical material.";
  }
  if (hasMalformedQualitativeProvenance(contents)) {
    return "The named recovery container contains malformed qualitative provenance.";
  }
  const existing = Array.isArray(contents.qualitativeSolidProvenance)
    ? contents.qualitativeSolidProvenance
    : [];
  // `replicate` identifies the new delivery. Earlier compatible records in an accumulating
  // receiver necessarily have different ordinals, while run/material/stream/action identity still
  // applies to every existing record.
  const existingConstraints = { ...constraints, replicate: undefined };
  const existingIds = new Set<string>();
  for (const entry of existing) {
    const shapeError = qualitativeRecordShapeError(entry, targetInstanceId, existingConstraints);
    if (shapeError) return shapeError;
    if (existingIds.has(entry.recordId)) {
      return "The named recovery container already contains a duplicate recovery record.";
    }
    existingIds.add(entry.recordId);
  }
  if (existing.some((entry) => entry.recordId === record.recordId)) {
    return "This recovery has already been recorded for the named container.";
  }
  const incompatible = existing.find(
    (entry) =>
      entry.runId !== record.runId
      || entry.sourceMaterialId !== record.sourceMaterialId
      || entry.sourceMaterialLabel !== record.sourceMaterialLabel
      || entry.sourceInstanceId !== record.sourceInstanceId
      || entry.destinationInstanceId !== record.destinationInstanceId
      || entry.sourceActionId !== record.sourceActionId
      || entry.operationId !== record.operationId
      || entry.stream !== record.stream
      || entry.quantityBasis !== record.quantityBasis
      || entry.destinationPhysicalMassKnown !== record.destinationPhysicalMassKnown,
  );
  if (incompatible) {
    return "The named recovery container holds material from a different run, material or recovery stream.";
  }
  return undefined;
};

const provenanceShapeError = (
  record: QualitativeSolidProvenanceRecord | undefined,
  resolvedSourceMassG: number,
  source: EquipmentInstance,
  target: EquipmentInstance,
  constraints: SolidTransferIdentityConstraints,
): string | undefined => {
  const shapeError = qualitativeRecordShapeError(record, target.id, constraints);
  if (shapeError) return shapeError;
  if (!record) return "A qualitative recovery requires a provenance record.";
  if (
    !Number.isFinite(record.sourceInventoryMassG)
    || record.sourceInventoryMassG < 0
    || !Number.isFinite(record.sourceInventoryEquivalentMassG)
    || record.sourceInventoryEquivalentMassG < 0
  ) {
    return "A qualitative recovery record must carry a finite non-negative source inventory amount.";
  }
  if (
    record.sourceInventoryMassG !== resolvedSourceMassG
    || record.sourceInventoryEquivalentMassG !== resolvedSourceMassG
  ) {
    return "The qualitative recovery record does not match the resolved source inventory.";
  }
  if (!Number.isInteger(record.replicate) || record.replicate <= 0) {
    return "A qualitative recovery record must name a positive integer replicate.";
  }
  if (record.operationId !== "recover-replicate-product" || record.stream !== "heated-product") {
    return "A qualitative recovery record must identify the heated-product recovery operation and stream.";
  }
  if (record.quantityBasis !== "source-inventory-equivalent") {
    return "A qualitative recovery record must use source-inventory-equivalent quantity basis.";
  }
  if (record.sourceInstanceId !== source.id || record.destinationInstanceId !== target.id) {
    return "The qualitative recovery record does not match the named source and destination containers.";
  }
  return undefined;
};

/**
 * Moves solid material between two named instances.
 *
 * Everything is validated before either updated instance is constructed, so a refused transfer
 * leaves the caller's slice untouched and cannot half-apply.
 */
export const transferSolid = (
  slice: SolidMaterialSlice,
  request: SolidTransferRequest,
  equipmentById: ReadonlyMap<string, EquipmentDefinition>,
): SolidMaterialOutcome => {
  const source = slice.instances.find((instance) => instance.id === request.sourceInstanceId);
  const target = slice.instances.find((instance) => instance.id === request.targetInstanceId);
  if (!source || !target) {
    return failure(
      slice,
      "The named source or destination container is not on the bench.",
      "Place both the source and the destination container before transferring the solid.",
    );
  }
  if (source.id === target.id) {
    return failure(
      slice,
      "A solid cannot be transferred into its own container.",
      "Choose a different destination container.",
    );
  }

  const sourceDefinition = equipmentById.get(source.definitionId);
  if (!sourceDefinition?.affordances.includes("pourable")) {
    return failure(
      slice,
      "The selected source is not pourable.",
      "Use a bottle, cylinder, beaker, or other pourable container as the source.",
    );
  }
  const targetDefinition = equipmentById.get(target.definitionId);
  if (!targetDefinition) {
    return failure(
      slice,
      "The named destination container is not a known piece of equipment.",
      "Choose a destination container from the shelf.",
    );
  }

  // A physical receiver must never be treated as an ordinary empty/solid target when it already
  // carries a qualitative product packet (or malformed provenance).  This is deliberately before
  // either the measured split or the whole-solid zero/no-op decision, so the refusal is atomic.
  if (request.destinationRepresentation !== "qualitative-unknown") {
    const targetError = physicalSolidTransferTargetError(target.contents);
    if (targetError) return failure(slice, targetError.message, targetError.recovery);
  }

  if (request.mode === "measured-portion") {
    if (request.destinationRepresentation !== undefined && request.destinationRepresentation !== "physical") {
      return failure(
        slice,
        "A measured solid portion must use a physical destination representation.",
        "Use whole-remaining qualitative recovery only when the destination quantity is unknown.",
      );
    }
    if (isQualitativeReceiver(source.contents)) {
      return failure(slice, UNKNOWN_PHYSICAL_SOLID_QUANTITY_MESSAGE, UNKNOWN_PHYSICAL_SOLID_QUANTITY_RECOVERY);
    }
    const sourceIdentityError = strictMaterialIdentityError(
      source.contents,
      request.constraints,
      "source",
      false,
    );
    if (sourceIdentityError) {
      return failure(slice, sourceIdentityError, "Use the configured solid material for this route transfer.");
    }
    const massG = request.massG;
    if (!Number.isFinite(massG) || massG <= 0) {
      return failure(
        slice,
        "A positive material-portion mass is required before the transfer.",
        "Choose a positive solid mass to transfer.",
      );
    }
    const sourceMassG = resolvePhysicalSolidInventoryMassG(source.contents);
    if (sourceMassG === undefined && isQualitativeReceiver(source.contents)) {
      return failure(slice, UNKNOWN_PHYSICAL_SOLID_QUANTITY_MESSAGE, UNKNOWN_PHYSICAL_SOLID_QUANTITY_RECOVERY);
    }
    if (source.contents.kind !== "solid" && source.contents.kind !== "mixture") {
      return failure(
        slice,
        "Only a solid source can deliver a measured solid portion.",
        "Use a container holding the prepared solid as the source.",
      );
    }
    if (sourceMassG === undefined) {
      return failure(
        slice,
        "The source does not carry a usable physical solid inventory.",
        "Use a solid with finite non-negative mass or gram-valued solutes as the source.",
      );
    }
    if (sourceMassG < massG) {
      return failure(
        slice,
        "The source does not contain enough solid.",
        "Choose the solid sample source or transfer a smaller mass.",
      );
    }
    if (!targetDefinition.allowedContents.includes("solid")) {
      return failure(
        slice,
        "The named destination cannot hold a solid.",
        "Choose a destination container that accepts solid contents.",
      );
    }
    const destinationIdentityError = strictDestinationError(
      target.contents,
      request.constraints,
      false,
    );
    if (destinationIdentityError) {
      return failure(
        slice,
        destinationIdentityError,
        "Use the empty or same-material physical receiver assigned to this route.",
      );
    }
    if (isQualitativeReceiver(target.contents)) {
      return failure(
        slice,
        "The named destination holds recovered material of unknown quantity.",
        "Use an empty or physical destination container for a measured portion.",
      );
    }

    const split = splitSolidForMass(source.contents, sourceMassG, massG);
    const afterTarget = withInstance(slice.instances, target.id, (instance) => ({
      ...instance,
      location: "workbench",
      contents: mergeTransferredSolid(
        instance.contents,
        {
          massG,
          solutes: split.transferredSolutes,
          sourceLabel: source.contents.label,
          sourceVisualState: source.contents.visualState,
          sourceTemperatureC: source.contents.temperatureC,
        },
        { targetLabel: request.targetLabel, visualState: request.visualState },
      ),
    }));
    const instances = withInstance(afterTarget, source.id, (instance) => ({
      ...instance,
      contents: split.remainingContents,
    }));
    return {
      ok: true,
      instances,
      movedSourceInventoryMassG: massG,
      destinationPhysicalMassKnown: true,
    };
  }

  const qualitative = request.destinationRepresentation === "qualitative-unknown";
  if (qualitative) {
    const contextError = qualitativeTrustedContextError(request.constraints);
    if (contextError) {
      return failure(
        slice,
        contextError,
        "Supply the independently compiled run, replicate, material, stream and recovery-action identity.",
      );
    }
  }
  if (qualitative && request.requireNonEmptySource !== true) {
    return failure(
      slice,
      "A qualitative recovery requires a non-empty source.",
      "Use a physical whole-remaining no-op only when no material was issued.",
    );
  }
  if (!targetDefinition.allowedContents.includes("solid")) {
    return failure(
      slice,
      "The named destination cannot hold a solid.",
      "Choose a destination container that accepts solid contents.",
    );
  }
  const destinationIdentityError = strictDestinationError(
    target.contents,
    request.constraints,
    qualitative,
  );
  if (destinationIdentityError) {
    return failure(
      slice,
      destinationIdentityError,
      "Use the empty or compatible receiver assigned to this route.",
    );
  }
  if (!qualitative && isQualitativeReceiver(target.contents)) {
    return failure(
      slice,
      "The named destination holds recovered material of unknown quantity.",
      "Use an empty or physical destination container for this transfer.",
    );
  }
  if (qualitative && receiverHoldsPhysicalMaterial(target.contents)) {
    return failure(
      slice,
      "The named recovery container already holds physical material.",
      "Use the empty or compatible qualitative product recovery container.",
    );
  }

  const eligibility = wholeRemainingSolidEligibility(source.contents, {
    requireNonEmptySource: request.requireNonEmptySource,
  });
  if (!eligibility.ok) {
    return failure(slice, eligibility.message, eligibility.recovery);
  }

  const sourceIdentityError = strictMaterialIdentityError(
    source.contents,
    request.constraints,
    "source",
    true,
  );
  if (sourceIdentityError) {
    return failure(slice, sourceIdentityError, "Use the configured solid material for this route transfer.");
  }

  if (eligibility.noOp) {
    // Nothing moved, so neither container changes - in particular an untouched destination stays a
    // genuinely empty receiver rather than acquiring an empty provenance entry.
    return {
      ok: true,
      instances: [...slice.instances],
      movedSourceInventoryMassG: 0,
      destinationPhysicalMassKnown: !qualitative,
      message: eligibility.message,
      noOp: true,
    };
  }

  const sourceMassG = eligibility.massG;

  if (qualitative) {
    // A qualitative receiver holds real solid material; only its mass is unknown. The destination
    // must therefore still be a container the catalog lets hold a solid, exactly as the physical
    // branches below and above require.
    if (!targetDefinition.allowedContents.includes("solid")) {
      return failure(
        slice,
        "The named destination cannot hold a solid.",
        "Choose a destination container that accepts solid contents.",
      );
    }
    const shapeError = provenanceShapeError(
      request.provenance,
      sourceMassG,
      source,
      target,
      request.constraints!,
    );
    if (shapeError) {
      return failure(slice, shapeError, "Record the recovery through the approved recovery step.");
    }
    const record = request.provenance!;
    const conflict = qualitativeReceiverConflict(
      target.contents,
      record,
      target.id,
      request.constraints!,
    );
    if (conflict) {
      return failure(slice, conflict, "Use the correct labelled recovery container for this material.");
    }

    const afterTarget = withInstance(slice.instances, target.id, (instance) => ({
      ...instance,
      location: "workbench",
      contents: {
        ...instance.contents,
        kind: "solid",
        label: request.targetLabel ?? instance.contents.label,
        // No `massG`, no solutes and no concentration: nobody measured this product's mass, and
        // the source-inventory-equivalent grams in the record are bookkeeping, not a mass.
        massG: undefined,
        solutes: [],
        concentration: undefined,
        recoveryEvidence: undefined,
        wetState: "dry",
        visualState: request.visualState ?? instance.contents.visualState,
        qualitativeSolidProvenance: [
          ...(instance.contents.qualitativeSolidProvenance ?? []).map((entry) => ({
            ...entry,
            measurementEvidenceIds: [...entry.measurementEvidenceIds],
            recoveryEvidenceIds: [...entry.recoveryEvidenceIds],
            routeEvidenceIds: [...entry.routeEvidenceIds],
          })),
          {
            ...record,
            measurementEvidenceIds: [...record.measurementEvidenceIds],
            recoveryEvidenceIds: [...record.recoveryEvidenceIds],
            routeEvidenceIds: [...record.routeEvidenceIds],
          },
        ],
      },
    }));
    const instances = withInstance(afterTarget, source.id, (instance) => ({
      ...instance,
      contents: emptyContents(),
    }));
    const existingIds = (target.contents.qualitativeSolidProvenance ?? []).map((entry) => entry.recordId);
    return {
      ok: true,
      instances,
      movedSourceInventoryMassG: sourceMassG,
      destinationPhysicalMassKnown: false,
      destinationRecordIds: [...existingIds, record.recordId],
    };
  }

  const transferredSolutes: SoluteState[] = source.contents.solutes.map((solute) => ({ ...solute }));
  const afterTarget = withInstance(slice.instances, target.id, (instance) => ({
    ...instance,
    location: "workbench",
    contents: mergeTransferredSolid(
      instance.contents,
      {
        massG: sourceMassG,
        solutes: transferredSolutes,
        sourceLabel: source.contents.label,
        sourceVisualState: source.contents.visualState,
        sourceTemperatureC: source.contents.temperatureC,
      },
      { targetLabel: request.targetLabel, visualState: request.visualState },
    ),
  }));
  const instances = withInstance(afterTarget, source.id, (instance) => ({
    ...instance,
    contents: emptyContents(),
  }));
  return {
    ok: true,
    instances,
    movedSourceInventoryMassG: sourceMassG,
    destinationPhysicalMassKnown: true,
  };
};

export interface ConfiguredSolidStockInput {
  /** The configured gram total. Callers validate that it is finite and positive first. */
  massG: number;
  materialSoluteId: string;
  materialLabel: string;
  visualState?: string;
  /** Whether this exact container was already configured in the current physical setup. */
  alreadyInitialized: boolean;
}

export type ConfiguredSolidStockEligibility =
  | { ok: true; contents: ContentState }
  | { ok: false; message: string; recovery: string };

/**
 * The one place that decides whether a named container may take a configured solid stock, and what
 * its contents then are.
 *
 * Extracted from the reducer's `sourceInventory` solid-mass branch with its order and its messages
 * intact, because both are load-bearing: capability, then contents compatibility, then the
 * one-initialization-per-setup lock. A container that is both already configured and occupied must
 * keep reporting the occupancy, exactly as it did before. Callers keep their own ledger record and
 * their own evidence, and supply `alreadyInitialized` from whichever ledger they own.
 */
export const configuredSolidStockContents = (
  instance: EquipmentInstance,
  definition: EquipmentDefinition | undefined,
  input: ConfiguredSolidStockInput,
): ConfiguredSolidStockEligibility => {
  if (!definition?.allowedContents.includes("solid") || !definition.affordances.includes("pourable")) {
    return {
      ok: false,
      message: "The named container cannot hold or deliver a configured solid stock.",
      recovery: "Use the declared solid stock container.",
    };
  }
  // Only an empty container or one already holding this single configured solid may be configured.
  // A liquid phase, a settled precipitate, or more than one component would make the gram total
  // ambiguous, so none of them is silently overwritten.
  const carriesLiquidPhase =
    (instance.contents.volumeMl ?? 0) !== 0
    || ["liquid", "solution"].includes(instance.contents.kind);
  const carriesPrecipitate = instance.contents.precipitate !== undefined;
  const solutes = Array.isArray(instance.contents.solutes) ? instance.contents.solutes : [];
  const foreignSolute = solutes.some(
    (solute) => solute.id !== input.materialSoluteId,
  );
  if (
    carriesLiquidPhase
    || carriesPrecipitate
      || !Array.isArray(instance.contents.solutes)
      || foreignSolute
      || solutes.length > 1
      || isQualitativeReceiver(instance.contents)
      || hasMalformedQualitativeProvenance(instance.contents)
      || instance.contents.finalVolumeMl !== undefined
      || instance.contents.concentration !== undefined
      || instance.contents.chromatogram !== undefined
      || instance.contents.unallocatedInventory !== undefined
      || instance.contents.wasteContents !== undefined
      || !["empty", "solid"].includes(instance.contents.kind)
  ) {
    return {
      ok: false,
      message: "The named container holds material this configured solid stock cannot describe.",
      recovery: "Reset the setup so the stock container is empty or holds only its single configured solid.",
    };
  }
  // One successful initialization per named source per physical setup. Any later attempt is
  // refused, whether the source is untouched, partly consumed, empty, or the submitted value is
  // unchanged. Nothing derived from the material or the evidence can stand in for this: a positive
  // remaining mass is not proof the source is unused, and a replaced or deleted measurement record
  // is not permission to refill it.
  if (input.alreadyInitialized) {
    return {
      ok: false,
      message: "This stock container was already configured for the current physical setup.",
      recovery: "An accepted stock value cannot be edited. Reset the physical setup to configure it again; that restarts the physical work for this sample.",
    };
  }
  return {
    ok: true,
    contents: {
      ...instance.contents,
      kind: "solid",
      label: input.materialLabel,
      // The declared total and its single component always agree; a gram total is never left
      // sitting on top of a contradictory solute quantity.
      massG: input.massG,
      solutes: [
        {
          id: input.materialSoluteId,
          label: input.materialLabel,
          amount: input.massG,
          unit: "g",
        },
      ],
      wetState: "dry",
      visualState: input.visualState ?? "solid-sample",
    },
  };
};

export interface ConfiguredSolidStockRequest {
  instanceId: string;
  massG: number;
  materialSoluteId: string;
  materialLabel: string;
  outputMeasurementId: string;
  /**
   * Presentation for the stock contents. The container's label comes from `materialLabel`, which is
   * authored, so the handler never invents chemical naming of its own.
   */
  visualState?: string;
}

export interface SolidStockInitializationOutcome {
  ok: boolean;
  slice: SolidMaterialSlice;
  message?: string;
  recovery?: string;
}

/**
 * Issues a teacher-configured gram inventory into a stock container, once per run.
 *
 * The configured total is a setup quantity rather than a balance reading, so it produces no
 * mass-continuity evidence. On any refusal the caller's slice is returned unchanged: no ledger
 * entry, no material and no success evidence.
 */
export const initializeConfiguredSolidStock = (
  slice: SolidMaterialSlice,
  request: ConfiguredSolidStockRequest,
  equipmentById: ReadonlyMap<string, EquipmentDefinition>,
): SolidStockInitializationOutcome => {
  const refuse = (message: string, recovery: string): SolidStockInitializationOutcome => ({
    ok: false,
    slice,
    message,
    recovery,
  });

  if (!Number.isFinite(request.massG) || request.massG <= 0) {
    return refuse(
      "A finite positive stock mass is required.",
      "Enter the total mass of the prepared mixture available to the class.",
    );
  }
  const instance = slice.instances.find((entry) => entry.id === request.instanceId);
  if (!instance) {
    return refuse(
      "The named stock container is not on the bench.",
      "Place the stock container before configuring its contents.",
    );
  }
  // Capability, contents compatibility and the one-per-setup lock come from the shared rule the
  // reducer uses, so a route cannot quietly accept a container the runtime would refuse.
  const eligibility = configuredSolidStockContents(
    instance,
    equipmentById.get(instance.definitionId),
    {
      massG: request.massG,
      materialSoluteId: request.materialSoluteId,
      materialLabel: request.materialLabel,
      visualState: request.visualState,
      alreadyInitialized: slice.stockInitializations[request.instanceId] !== undefined,
    },
  );
  if (!eligibility.ok) return refuse(eligibility.message, eligibility.recovery);
  const contents = eligibility.contents;

  return {
    ok: true,
    slice: {
      instances: withInstance(slice.instances, instance.id, (entry) => ({ ...entry, contents })),
      stockInitializations: {
        ...slice.stockInitializations,
        [request.instanceId]: {
          instanceId: request.instanceId,
          definitionId: instance.definitionId,
          massG: request.massG,
          materialSoluteId: request.materialSoluteId,
          materialLabel: request.materialLabel,
          outputMeasurementId: request.outputMeasurementId,
        },
      },
    },
  };
};
