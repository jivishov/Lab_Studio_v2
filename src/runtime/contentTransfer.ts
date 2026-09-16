import {
  emptyContents,
  type ActionSolidTransferContract,
  type ContentState,
  type SoluteState,
} from "../domain/types";

const CONTENT_PRECISION = 12;

/**
 * Solids round to six decimals, liquids to `CONTENT_PRECISION`. These are deliberately different
 * contracts: the solid split/merge below is extracted verbatim from the reducer's whole-solid
 * branch, and adopting the liquid precision there would silently change shipped gram inventories.
 */
const SOLID_MASS_PRECISION = 6;

export interface NormalizedSolidTransferContract {
  mode: ActionSolidTransferContract["mode"];
  destinationRepresentation: "physical" | "qualitative-unknown";
  requireNonEmptySource: boolean;
}

export interface SolidTransferContractNormalizationFailure {
  ok: false;
  message: string;
  recovery: string;
}

export type SolidTransferContractNormalization =
  | { ok: true; contract: NormalizedSolidTransferContract }
  | SolidTransferContractNormalizationFailure
  | undefined;

/**
 * Normalizes the typed solid-transfer contract and the legacy reducer aliases at one boundary.
 *
 * The aliases remain necessary for older hand-warmer and Brass content, but a typed declaration
 * must not silently turn an omitted `requireNonEmptySource` into `false` when the legacy action
 * still declares the required first delivery. A competing pair is reported to the caller so it
 * can fail before the physical branch is entered.
 */
export const normalizeSolidTransferContract = (
  solidTransfer: ActionSolidTransferContract | undefined,
  parameters: Readonly<Record<string, unknown>> = {},
): SolidTransferContractNormalization => {
  const legacyWholeRemaining = parameters.emptyRemainingSolid === true;
  const legacyRequireNonEmpty = parameters.requireNonEmptySolidSource === true;

  if (solidTransfer === undefined) {
    if (legacyRequireNonEmpty && !legacyWholeRemaining) {
      return {
        ok: false,
        message: "This transfer requires a non-empty solid source but does not declare a whole-solid delivery.",
        recovery: "Declare the whole-remaining-solid transfer alongside the non-empty source requirement, or use the measured-portion path.",
      };
    }
    if (!legacyWholeRemaining) return undefined;
    return {
      ok: true,
      contract: {
        mode: "whole-remaining",
        destinationRepresentation: "physical",
        requireNonEmptySource: legacyRequireNonEmpty,
      },
    };
  }

  if (solidTransfer.mode !== "measured-portion" && solidTransfer.mode !== "whole-remaining") {
    return {
      ok: false,
      message: "The authored solid-transfer mode is not supported.",
      recovery: "Use measured-portion or whole-remaining in the solid-transfer contract.",
    };
  }
  const representation = solidTransfer.destinationRepresentation ?? "physical";
  if (representation !== "physical" && representation !== "qualitative-unknown") {
    return {
      ok: false,
      message: "The authored solid-transfer destination representation is not supported.",
      recovery: "Use physical or qualitative-unknown in the solid-transfer contract.",
    };
  }

  if (solidTransfer.mode === "measured-portion" && (legacyWholeRemaining || legacyRequireNonEmpty)) {
    return {
      ok: false,
      message: "The measured solid transfer competes with legacy parameters that declare a whole-solid delivery.",
      recovery: "Remove the legacy whole-solid parameters or author the matching whole-remaining contract.",
    };
  }
  if (solidTransfer.mode === "measured-portion" && solidTransfer.requireNonEmptySource !== undefined) {
    return {
      ok: false,
      message: "A measured solid transfer cannot declare a non-empty-source requirement.",
      recovery: "Remove requireNonEmptySource or use the whole-remaining solid-transfer mode.",
    };
  }
  if (legacyRequireNonEmpty && !legacyWholeRemaining) {
    return {
      ok: false,
      message: "This transfer requires a non-empty solid source but does not declare a whole-solid delivery.",
      recovery: "Declare the whole-remaining-solid transfer alongside the non-empty source requirement, or remove the legacy alias.",
    };
  }
  if (
    solidTransfer.mode === "whole-remaining"
    && legacyRequireNonEmpty
    && solidTransfer.requireNonEmptySource !== true
  ) {
    return {
      ok: false,
      message: "The typed solid-transfer requirement conflicts with legacy parameters.requireNonEmptySolidSource.",
      recovery: "Declare requireNonEmptySource true or remove the legacy alias.",
    };
  }
  if (solidTransfer.mode === "whole-remaining" && parameters.massG !== undefined) {
    return {
      ok: false,
      message: "The whole-remaining solid transfer cannot also declare parameters.massG.",
      recovery: "Remove parameters.massG or use the measured-portion solid-transfer mode.",
    };
  }

  return {
    ok: true,
    contract: {
      mode: solidTransfer.mode,
      destinationRepresentation: representation,
      requireNonEmptySource:
        solidTransfer.requireNonEmptySource ?? legacyRequireNonEmpty,
    },
  };
};

const roundContentAmount = (value: number): number =>
  Number(value.toFixed(CONTENT_PRECISION));

const cloneSolute = (solute: SoluteState): SoluteState => ({ ...solute });

const partitionedSolutes = (
  solutes: readonly SoluteState[],
  fraction: number,
): { transferred: SoluteState[]; remaining: SoluteState[] } => {
  const transferred = solutes.map((solute) => ({
    ...solute,
    amount: roundContentAmount(solute.amount * fraction),
  }));
  return {
    transferred,
    remaining: solutes.map((solute, index) => ({
      ...solute,
      amount: roundContentAmount(solute.amount - transferred[index].amount),
    })),
  };
};

const cloneContents = (contents: ContentState): ContentState => ({
  ...contents,
  solutes: contents.solutes.map(cloneSolute),
  contamination: [...contents.contamination],
  concentration: contents.concentration ? { ...contents.concentration } : undefined,
});

export const isOrdinaryLiquidContent = (contents: ContentState): boolean =>
  (contents.kind === "liquid" || contents.kind === "solution" || contents.kind === "mixture")
  && !contents.precipitate
  && !contents.chromatogram;

export interface ContentVolumeSplit {
  transferredContents: ContentState;
  remainingContents: ContentState;
}

/** Proportionally partitions ordinary liquid/solution content without fabricating solute. */
export const splitContentForVolume = (
  sourceContents: ContentState,
  transferredVolumeMl: number,
): ContentVolumeSplit => {
  const sourceVolumeMl = sourceContents.volumeMl ?? 0;
  if (!Number.isFinite(sourceVolumeMl) || sourceVolumeMl <= 0) {
    throw new Error("Source content must have a positive finite volume.");
  }
  if (
    !Number.isFinite(transferredVolumeMl)
    || transferredVolumeMl < 0
    || transferredVolumeMl > sourceVolumeMl
  ) {
    throw new Error("Transferred volume must be between zero and the source volume.");
  }

  if (transferredVolumeMl === 0) {
    return {
      transferredContents: emptyContents(),
      remainingContents: cloneContents(sourceContents),
    };
  }

  const transferredFraction = transferredVolumeMl / sourceVolumeMl;
  const remainingVolumeMl = Math.max(0, sourceVolumeMl - transferredVolumeMl);
  const solutes = partitionedSolutes(sourceContents.solutes, transferredFraction);
  const transferredContents: ContentState = {
    ...sourceContents,
    volumeMl: transferredVolumeMl,
    solutes: solutes.transferred,
    contamination: [...sourceContents.contamination],
    concentration: sourceContents.concentration
      ? { ...sourceContents.concentration }
      : undefined,
  };
  const remainingContents = remainingVolumeMl === 0
    ? emptyContents()
    : {
        ...sourceContents,
        volumeMl: remainingVolumeMl,
        solutes: solutes.remaining,
        contamination: [...sourceContents.contamination],
        concentration: sourceContents.concentration
          ? { ...sourceContents.concentration }
          : undefined,
      };

  return { transferredContents, remainingContents };
};

export const mergeSameSolutes = (
  left: readonly SoluteState[],
  right: readonly SoluteState[],
): SoluteState[] => {
  const merged = new Map<string, SoluteState>();
  [...left, ...right].forEach((solute) => {
    const key = `${solute.id}\u0000${solute.unit}`;
    const existing = merged.get(key);
    merged.set(key, existing
      ? { ...existing, amount: roundContentAmount(existing.amount + solute.amount) }
      : cloneSolute(solute));
  });
  return [...merged.values()];
};

const soluteKeys = (contents: ContentState): string[] =>
  [...new Set(contents.solutes.map((solute) => `${solute.id}\u0000${solute.unit}`))].sort();

const hasCompatibleConcentrationIdentity = (
  left: ContentState,
  right: ContentState,
): boolean => {
  const leftKeys = soluteKeys(left);
  const rightKeys = soluteKeys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  if (leftKeys.some((key, index) => key !== rightKeys[index])) return false;
  if (leftKeys.length === 0) return left.label === right.label;
  const leftVolumeMl = left.volumeMl ?? 0;
  const rightVolumeMl = right.volumeMl ?? 0;
  if (leftVolumeMl <= 0 || rightVolumeMl <= 0) return false;
  const amountPerMl = (contents: ContentState, key: string, volumeMl: number) =>
    contents.solutes
      .filter((solute) => `${solute.id}\u0000${solute.unit}` === key)
      .reduce((total, solute) => total + solute.amount, 0) / volumeMl;
  return leftKeys.every((key) =>
    Math.abs(amountPerMl(left, key, leftVolumeMl) - amountPerMl(right, key, rightVolumeMl))
      <= 10 ** -CONTENT_PRECISION,
  );
};

const matchingConcentration = (
  left: ContentState,
  right: ContentState,
): ContentState["concentration"] => {
  if (!left.concentration || !right.concentration) return undefined;
  return left.concentration.unit === right.concentration.unit
    && left.concentration.value === right.concentration.value
    && hasCompatibleConcentrationIdentity(left, right)
    ? { ...left.concentration }
    : undefined;
};

/** Merges a transferred ordinary liquid portion into an ordinary or empty receiver. */
export const mergeTransferredContents = (
  targetContents: ContentState,
  transferredContents: ContentState,
): ContentState => {
  if (transferredContents.kind === "empty" || (transferredContents.volumeMl ?? 0) === 0) {
    return cloneContents(targetContents);
  }
  if (targetContents.kind === "empty" || (targetContents.volumeMl ?? 0) === 0) {
    return {
      ...transferredContents,
      solutes: transferredContents.solutes.map(cloneSolute),
      contamination: [...transferredContents.contamination],
      concentration: transferredContents.concentration
        ? { ...transferredContents.concentration }
        : undefined,
    };
  }

  return {
    ...targetContents,
    kind: targetContents.kind === transferredContents.kind
      ? targetContents.kind
      : "mixture",
    label: `${targetContents.label} + ${transferredContents.label}`,
    volumeMl: (targetContents.volumeMl ?? 0) + (transferredContents.volumeMl ?? 0),
    solutes: mergeSameSolutes(targetContents.solutes, transferredContents.solutes),
    contamination: [...new Set([
      ...targetContents.contamination,
      ...transferredContents.contamination,
    ])],
    concentration: matchingConcentration(targetContents, transferredContents),
    wetState: "wet",
  };
};

const roundSolidMass = (value: number): number => Number(value.toFixed(SOLID_MASS_PRECISION));

const gramSoluteTotalG = (contents: ContentState): number => {
  if (!Array.isArray(contents.solutes)) return Number.NaN;
  return contents.solutes.reduce(
    (total, solute) =>
      solute.unit === "g" && Number.isFinite(solute.amount)
        ? total + solute.amount
        : total,
    0,
  );
};

/**
 * The legacy physical-solid inventory rule: a declared `massG`, or else the gram-valued solute
 * total. Shipped content relies on both forms, so a valid solid that carries gram solutes and no
 * `massG` is an existing physical inventory and must keep resolving. Callers must not substitute a
 * `massG`-presence test for this.
 *
 * Deliberately ungated on `kind`: the reducer resolves the amount before it classifies the
 * container, and several of its refusals depend on comparing a resolved zero against the other
 * material a container still holds.
 */
export const legacySolidInventoryMassG = (contents: ContentState): number =>
  contents.massG ?? gramSoluteTotalG(contents);

/**
 * A recovered solid of unknown quantity is not a physical source. Its bookkeeping grams say only
 * how much represented input left some earlier container; treating them as an inventory would
 * reintroduce exactly the false product mass the provenance representation exists to avoid.
 */
export const UNKNOWN_PHYSICAL_SOLID_QUANTITY_MESSAGE =
  "The collected product has unknown physical quantity; use a recorded physical mass for this calculation or transfer.";

export const UNKNOWN_PHYSICAL_SOLID_QUANTITY_RECOVERY =
  "Record a physical mass for this material before using it as a source or a calculation input.";

const carriesQualitativeProvenance = (contents: ContentState): boolean =>
  Array.isArray(contents.qualitativeSolidProvenance)
  && contents.qualitativeSolidProvenance.length > 0;

const hasMalformedQualitativeProvenance = (contents: ContentState): boolean =>
  contents.qualitativeSolidProvenance !== undefined
  && !Array.isArray(contents.qualitativeSolidProvenance);

/**
 * Physical transfer callers must reject a receiver that already claims qualitative product
 * provenance.  Keeping this check here gives the reducer's legacy merge and the typed helper one
 * boundary: neither can spread a qualitative packet into a physical receiver, and neither can
 * turn malformed provenance into a successful empty-source no-op.
 */
export const physicalSolidTransferTargetError = (
  contents: ContentState,
): { message: string; recovery: string } | undefined => {
  if (hasMalformedQualitativeProvenance(contents)) {
    return {
      message: "The named destination contains malformed qualitative solid provenance.",
      recovery: "Reset the destination before transferring a physical solid.",
    };
  }
  if (carriesQualitativeProvenance(contents)) {
    return {
      message: UNKNOWN_PHYSICAL_SOLID_QUANTITY_MESSAGE,
      recovery: UNKNOWN_PHYSICAL_SOLID_QUANTITY_RECOVERY,
    };
  }
  return undefined;
};

/**
 * Strict physical-solid inventory for new callers that hold a named instance rather than a
 * reducer action: returns the legacy-compatible amount only when the container really is a usable
 * physical solid, and `undefined` for a qualitative, non-solid or malformed one.
 */
export const resolvePhysicalSolidInventoryMassG = (
  contents: ContentState,
): number | undefined => {
  // A malformed provenance collection is still a provenance claim. Do not let an object with a
  // missing `length` property fall through to the legacy mass/gram-solute resolver and become a
  // physical source by accident.
  if (hasMalformedQualitativeProvenance(contents) || carriesQualitativeProvenance(contents)) {
    return undefined;
  }
  if (contents.kind !== "solid" && contents.kind !== "mixture") return undefined;
  if (contents.precipitate !== undefined) return undefined;
  if (
    contents.finalVolumeMl !== undefined
    || contents.concentration !== undefined
    || contents.chromatogram !== undefined
    || contents.unallocatedInventory !== undefined
    || (contents.wasteContents?.length ?? 0) > 0
  ) return undefined;
  if (!Number.isFinite(contents.massG ?? 0) || (contents.massG ?? 0) < 0) return undefined;
  if (!Array.isArray(contents.solutes)) return undefined;
  // A physical solid may record `undefined` or an explicit zero volume. A positive volume is a
  // liquid phase, and a negative or non-finite one is malformed; neither is a solid inventory.
  if (contents.volumeMl !== undefined && (!Number.isFinite(contents.volumeMl) || contents.volumeMl !== 0)) {
    return undefined;
  }
  if (contents.solutes.some((solute) => !Number.isFinite(solute.amount) || solute.amount < 0)) {
    return undefined;
  }
  const massG = legacySolidInventoryMassG(contents);
  return Number.isFinite(massG) && massG >= 0 ? massG : undefined;
};

export type WholeRemainingSolidEligibility =
  | { ok: true; massG: number; noOp?: false }
  /** The container is genuinely empty, so a residual step truthfully completes with nothing to move. */
  | { ok: true; massG: 0; noOp: true; message: string }
  | { ok: false; message: string; recovery: string };

/**
 * Decides whether a whole-remaining solid transfer may proceed, and for how much.
 *
 * Extracted from the reducer's whole-solid branch with its ordering intact, because that order is
 * load-bearing: each test is written so a malformed value counts as material rather than as
 * emptiness. Three unrelated states share the arithmetic `massG <= 0` - a container that really is
 * empty, a liquid carrying no gram inventory, and a solid whose declared total is zero while its
 * own solutes or precipitate are not. Only the first may complete.
 */
export const wholeRemainingSolidEligibility = (
  contents: ContentState,
  options: { requireNonEmptySource: boolean },
): WholeRemainingSolidEligibility => {
  const cannotHandle = (recovery: string): WholeRemainingSolidEligibility => ({
    ok: false,
    message: "The named source has material contents that this whole-solid action cannot safely handle.",
    recovery,
  });

  if (hasMalformedQualitativeProvenance(contents) || carriesQualitativeProvenance(contents)) {
    return {
      ok: false,
      message: hasMalformedQualitativeProvenance(contents)
        ? "The named source contains malformed qualitative solid provenance."
        : UNKNOWN_PHYSICAL_SOLID_QUANTITY_MESSAGE,
      recovery: hasMalformedQualitativeProvenance(contents)
        ? "Reset the physical setup so the source contains a valid solid inventory."
        : UNKNOWN_PHYSICAL_SOLID_QUANTITY_RECOVERY,
    };
  }

  const sourceMassG = legacySolidInventoryMassG(contents);
  // Malformed inventory is not an empty container, and it is never a completed delivery.
  if (!Number.isFinite(sourceMassG) || sourceMassG < 0) {
    return {
      ok: false,
      message: "The named source does not carry a usable solid mass.",
      recovery: "Reset the physical setup so the source container holds a finite non-negative solid mass.",
    };
  }

  // A whole-solid action can neither interpret a negative liquid volume nor decide which material a
  // malformed solute record represents. Check those persisted-state failures before either the
  // required delivery or the residual-completion path makes a decision.
  const sourceVolumeMl = contents.volumeMl;
  const hasInvalidLiquidVolume =
    sourceVolumeMl !== undefined && (!Number.isFinite(sourceVolumeMl) || sourceVolumeMl < 0);
  if (!Array.isArray(contents.solutes)) {
    return cannotHandle("Use a source with a valid solid solute inventory before continuing.");
  }
  const hasInvalidSoluteInventory = contents.solutes.some(
    (solute) => !Number.isFinite(solute.amount) || solute.amount < 0,
  );
  if (hasInvalidLiquidVolume || hasInvalidSoluteInventory) {
    return cannotHandle("Use a source with finite non-negative liquid and solute quantities before moving a whole solid.");
  }

  // These fields describe another content model or a prior recovery bookkeeping packet. They
  // cannot be ignored merely because the declared solid mass is zero: doing so would turn a
  // contradictory or unresolved source into a successful residual no-op and silently write off
  // material. A genuine empty source has none of them.
  if (
    contents.finalVolumeMl !== undefined
    || contents.concentration !== undefined
    || contents.chromatogram !== undefined
    || contents.unallocatedInventory !== undefined
    || (contents.wasteContents?.length ?? 0) > 0
  ) {
    return cannotHandle("Use a source holding only a consistent solid inventory before moving a whole solid.");
  }

  const carriesLiquidPhase = sourceVolumeMl !== undefined && sourceVolumeMl > 0;
  const carriesPrecipitate = contents.precipitate !== undefined;
  const carriesSolute = contents.solutes.some((solute) => solute.amount > 0);
  const holdsNoMaterial =
    contents.kind === "empty"
    && contents.massG === undefined
    && contents.volumeMl === undefined
    && contents.solutes.length === 0
    && sourceMassG === 0
    && !carriesSolute
    && !carriesLiquidPhase
    && !carriesPrecipitate
    && Array.isArray(contents.contamination)
    && contents.contamination.length === 0
    && contents.temperatureC === undefined
    && contents.recordedTemperature === undefined
    && contents.recoveryEvidence === undefined
    && contents.allocationReferenceId === undefined
    && contents.extractionState === undefined
    && contents.probeImmersedInInstanceId === undefined
    && contents.instrumentReadout === undefined
    && contents.wetState === "dry"
    && contents.visualState === "empty";

  // A physical solid is not a valid whole-solid remainder while it also carries a liquid phase or a
  // settled precipitate. Likewise `empty` cannot truthfully coexist with a positive declared mass.
  const hasIncompatibleWholeSolidContents =
    (contents.kind === "solid" || contents.kind === "mixture")
    && (carriesLiquidPhase || carriesPrecipitate);
  const hasContradictoryEmptyContents = contents.kind === "empty" && !holdsNoMaterial;
  if (hasIncompatibleWholeSolidContents || hasContradictoryEmptyContents) {
    return cannotHandle("Use a container holding only a consistent solid remainder before continuing.");
  }

  // `mixture` is the kind this same path writes when a solid lands in a liquid, so the kind alone
  // does not make a container a solid remainder. A mixture qualifies only while it carries no
  // liquid phase; otherwise emptying it would pour a solution.
  const solidRemainder =
    (contents.kind === "solid" || contents.kind === "mixture")
    && !carriesLiquidPhase
    && !carriesPrecipitate;
  const resolvedPhysicalMassG = solidRemainder
    ? resolvePhysicalSolidInventoryMassG(contents)
    : undefined;
  if (solidRemainder && resolvedPhysicalMassG === undefined) {
    return cannotHandle(
      "Use a source with a finite non-negative physical solid inventory before continuing.",
    );
  }
  const usableSourceMassG = resolvedPhysicalMassG ?? sourceMassG;
  const notASolidRemainder: WholeRemainingSolidEligibility = {
    ok: false,
    message: "Only a visible solid remainder can be emptied by this action.",
    recovery: "Use the approved remaining-solid transfer only after a solid portion has been measured.",
  };

  if (options.requireNonEmptySource) {
    if (contents.kind === "empty" || usableSourceMassG <= 0) {
      return {
        ok: false,
        message: "The named source holds no solid to deliver.",
        recovery: "Prepare the required solid in the named container before completing this delivery.",
      };
    }
    if (!solidRemainder) return notASolidRemainder;
    return { ok: true, massG: usableSourceMassG };
  }

  if (!solidRemainder) {
    // A residual step may truthfully complete with nothing to move, but only when the container is
    // genuinely empty. Anything else here is material this action may not write off as delivered.
    if (contents.kind === "empty" && holdsNoMaterial) {
      return { ok: true, massG: 0, noOp: true, message: "No visible solid remained in the source container." };
    }
    return notASolidRemainder;
  }

  if (usableSourceMassG <= 0) {
    // A zero total sitting on top of gram-valued solutes or a precipitate is contradictory
    // inventory, and completing it would quietly discard the remaining material.
    if (holdsNoMaterial) {
      return { ok: true, massG: 0, noOp: true, message: "No visible solid remained in the source container." };
    }
    return {
      ok: false,
      message: "The source reports no remaining solid mass while it still holds material.",
      recovery: "Reconcile the recorded contents of the source container before completing the residual transfer.",
    };
  }

  return { ok: true, massG: usableSourceMassG };
};

export interface SolidMassSplit {
  transferredSolutes: SoluteState[];
  remainingContents: ContentState;
}

/**
 * Partitions a solid source proportionally for a measured portion.
 *
 * Only gram-valued solutes scale. Non-gram solutes are carried to the destination and left on the
 * source unscaled, which is the shipped behaviour: mol/mg components are identity markers here
 * rather than an allocated inventory. They are cloned rather than shared so neither side can be
 * mutated through the other.
 */
export const splitSolidForMass = (
  sourceContents: ContentState,
  sourceMassG: number,
  transferredMassG: number,
): SolidMassSplit => {
  const fraction = sourceMassG > 0 ? Math.min(1, transferredMassG / sourceMassG) : 1;
  const transferredSolutes = sourceContents.solutes.map((solute) =>
    solute.unit === "g"
      ? { ...solute, amount: roundSolidMass(solute.amount * fraction) }
      : { ...solute },
  );
  const remainingMassG = Math.max(0, sourceMassG - transferredMassG);
  const remainingContents: ContentState = remainingMassG === 0
    ? emptyContents()
    : {
        ...sourceContents,
        massG: roundSolidMass(remainingMassG),
        solutes: sourceContents.solutes.map((solute) =>
          solute.unit === "g"
            ? { ...solute, amount: roundSolidMass(solute.amount * (1 - fraction)) }
            : { ...solute },
        ),
      };
  return { transferredSolutes, remainingContents };
};

export interface TransferredSolid {
  massG: number;
  solutes: readonly SoluteState[];
  sourceLabel: string;
  sourceVisualState: string;
  sourceTemperatureC?: number;
}

export interface SolidMergeOptions {
  targetLabel?: string;
  visualState?: string;
}

/**
 * Merges a delivered solid portion into a physical receiver.
 *
 * Solutes are appended rather than combined by identity - unlike the liquid path's
 * `mergeSameSolutes` - because a solid receiver's component list records what arrived, and
 * collapsing two deliveries of the same component would erase that. The liquid-target branch keeps
 * its shipped behaviour: the receiver becomes a wet `mixture` presenting a dissolving solid.
 */
export const mergeTransferredSolid = (
  targetContents: ContentState,
  transferred: TransferredSolid,
  options: SolidMergeOptions = {},
): ContentState => {
  const targetContainsLiquid = ["liquid", "solution", "mixture"].includes(targetContents.kind);
  return {
    ...targetContents,
    kind: targetContainsLiquid ? "mixture" : "solid",
    label:
      options.targetLabel
      ?? (targetContainsLiquid
        ? `${targetContents.label} with ${transferred.sourceLabel}`
        : transferred.sourceLabel),
    massG: roundSolidMass((targetContents.massG ?? 0) + transferred.massG),
    recoveryEvidence: undefined,
    solutes: [...targetContents.solutes, ...transferred.solutes.map((solute) => ({ ...solute }))],
    contamination: [...targetContents.contamination],
    temperatureC: targetContents.temperatureC ?? transferred.sourceTemperatureC,
    wetState: targetContainsLiquid ? "wet" : "dry",
    visualState:
      options.visualState
      ?? (targetContainsLiquid ? "dissolving-solid" : transferred.sourceVisualState),
  };
};
