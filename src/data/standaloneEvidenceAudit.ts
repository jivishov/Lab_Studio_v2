import type { ActionDefinition, TechniqueDefinition, ValidationRule } from "../domain/types";

const CONFIG_SLOT = /^\{\{config\.([A-Za-z0-9_-]+)\}\}$/;
const configSlot = (value: unknown): string | undefined =>
  typeof value === "string" ? value.match(CONFIG_SLOT)?.[1] : undefined;

interface MeasurementReference {
  key: string;
  configurationSlot?: string;
  measurementId?: string;
}

const measurementReference = (value: unknown): MeasurementReference | undefined => {
  if (typeof value !== "string" || value.length === 0) return undefined;
  const slot = configSlot(value);
  return slot
    ? { key: `config:${slot}`, configurationSlot: slot }
    : { key: `id:${value}`, measurementId: value };
};

export interface StandaloneEvidenceIssue {
  code:
    | "missing-measurement-producer"
    | "misleading-final-volume-producer"
    | "untyped-dilution-calculation"
    | "untyped-photometric-calculation";
  message: string;
  actionId?: string;
  ruleId?: string;
  configurationSlot?: string;
  measurementId?: string;
}

const copiesExistingMeasurementOnly = (action: ActionDefinition): boolean =>
  action.verb === "record" && action.parameters.copyExistingMeasurementOnly === true;

const hasOwnNumericRecordInput = (action: ActionDefinition): boolean =>
  action.parameters.inputMode === "numeric"
  || (typeof action.parameters.value === "number" && Number.isFinite(action.parameters.value));

/**
 * Whether the reducer can write `parameters.measurementId` for this action without first requiring
 * that same measurement to exist. Keep this aligned with the concrete runtime branches rather than
 * treating a verb name as evidence production.
 */
const measurementParameterIsProduced = (action: ActionDefinition): boolean => {
  const params = action.parameters;
  if (params.measurementId === undefined || copiesExistingMeasurementOnly(action)) return false;

  if (action.verb === "weigh") {
    // An action-input mass contract writes its own `mass.outputMeasurementId`; otherwise the weigh
    // branch falls back to `parameters.measurementId`.
    return action.mass?.source !== "action-input";
  }

  if (action.verb === "measureVolume") {
    // Instrument reads always use `parameters.measurementId`. A physical volume measurement prefers
    // `volume.outputMeasurementId` when one is declared, so the parameter is not also produced.
    if (action.interaction?.type === "readInstrument") return true;
    return action.volume?.outputMeasurementId === undefined;
  }

  if (action.verb === "observe") {
    return params.chromatographyMeasurementType !== undefined
      || params.configurationQuantity !== undefined
      || params.photometerOperation === "read"
      || params.instrumentEvidence !== undefined
      || params.inputMode === "numeric";
  }

  if (action.verb === "record") {
    // A plain record action only copies/relabels an existing measurement. It is a producer from
    // source-level inspection only when it declares its own numeric input/value.
    return hasOwnNumericRecordInput(action);
  }

  // `dilute` does not generically write parameters.measurementId, and developChromatogram writes
  // measurements derived from its prefix/model rather than this parameter. Do not credit either as
  // a producer merely because a similarly named parameter is present.
  return false;
};

const dropDispenseFinalReadingIsProduced = (action: ActionDefinition): boolean =>
  action.verb === "transfer"
  && action.interaction?.type === "dispenseDrops"
  && action.parameters.finalBuretteMeasurementId !== undefined;

const producedParameterKeys = (action: ActionDefinition): ReadonlySet<string> => {
  const keys = new Set<string>();
  if (measurementParameterIsProduced(action)) keys.add("measurementId");
  if (dropDispenseFinalReadingIsProduced(action)) keys.add("finalBuretteMeasurementId");
  return keys;
};

const producedMeasurements = (action: ActionDefinition): MeasurementReference[] => {
  const produced = new Map<string, MeasurementReference>();
  const add = (value: unknown) => {
    const reference = measurementReference(value);
    if (reference) produced.set(reference.key, reference);
  };

  if (
    action.verb === "measureVolume"
    && action.interaction?.type !== "readInstrument"
    && action.volume?.outputMeasurementId !== undefined
  ) {
    add(action.volume.outputMeasurementId);
  }
  if (action.verb === "weigh" && action.mass?.source === "action-input") {
    add(action.mass.outputMeasurementId);
  }
  if (action.sourceInventory) add(action.sourceInventory.outputMeasurementId);
  if (measurementParameterIsProduced(action)) add(action.parameters.measurementId);
  if (dropDispenseFinalReadingIsProduced(action)) add(action.parameters.finalBuretteMeasurementId);
  if (action.runtimeRepeat && measurementParameterIsProduced(action)) {
    add(action.runtimeRepeat.outputMeasurementId);
  }

  return [...produced.values()];
};

interface MeasurementConsumer extends MeasurementReference {
  actionId?: string;
  ruleId?: string;
  context: string;
}

const validationConsumer = (
  rule: ValidationRule,
  context: string,
  actionId?: string,
): MeasurementConsumer | undefined => {
  if (rule.type !== "measurementRecorded") return undefined;
  const reference = measurementReference(rule.measurementId);
  return reference
    ? { ...reference, actionId, ruleId: rule.id, context }
    : undefined;
};

const consumedMeasurements = (definition: TechniqueDefinition): MeasurementConsumer[] => {
  const consumed: MeasurementConsumer[] = [];
  const add = (value: unknown, context: string, actionId?: string, ruleId?: string) => {
    const reference = measurementReference(value);
    if (reference) consumed.push({ ...reference, actionId, ruleId, context });
  };

  for (const action of definition.actions) {
    const producedKeys = producedParameterKeys(action);
    for (const [key, value] of Object.entries(action.parameters)) {
      if (!key.endsWith("MeasurementId") || producedKeys.has(key)) continue;
      add(value, `action parameter ${action.id}.${key}`, action.id);
    }
    if (copiesExistingMeasurementOnly(action)) {
      add(
        action.parameters.measurementId,
        `copy-only measurement source ${action.id}.measurementId`,
        action.id,
      );
    } else if (
      action.verb === "record"
      && action.parameters.measurementId !== undefined
      && !measurementParameterIsProduced(action)
    ) {
      add(
        action.parameters.measurementId,
        `record source ${action.id}.measurementId`,
        action.id,
      );
    }
    if (action.volume?.source === "measurement") {
      add(action.volume.referenceId, `volume source for ${action.id}`, action.id);
    }
    if (action.mass?.source === "measurement") {
      add(action.mass.referenceId, `mass source for ${action.id}`, action.id);
    }
    for (const rule of action.prerequisites) {
      const consumer = validationConsumer(rule, `prerequisite ${action.id}.${rule.id}`, action.id);
      if (consumer) consumed.push(consumer);
    }
  }

  for (const node of definition.process.nodes) {
    for (const rule of node.validation) {
      const consumer = validationConsumer(
        rule,
        `process validation ${node.id}.${rule.id}`,
        node.actionId,
      );
      if (consumer) consumed.push(consumer);
    }
  }

  for (const rule of definition.successCriteria) {
    const consumer = validationConsumer(rule, `success criterion ${rule.id}`);
    if (consumer) consumed.push(consumer);
  }

  for (const output of definition.composition?.evidenceOutputs ?? []) {
    if (output.kind !== "measurement") continue;
    add(output.referenceId, `composition evidence output ${output.id}`, output.actionId);
  }

  return consumed;
};

const referenceLabel = (reference: MeasurementReference): string =>
  reference.configurationSlot
    ? `configuration slot "${reference.configurationSlot}"`
    : `measurement "${reference.measurementId}"`;

const expectedPhotometricTemplate = (
  action: ActionDefinition,
  producers: ReadonlyMap<string, { reference: MeasurementReference; actions: ActionDefinition[] }>,
): string | undefined => {
  if (action.verb !== "calculate") return undefined;
  const source = measurementReference(action.parameters.sourceMeasurementId);
  if (!source) return undefined;
  const sourceActions = producers.get(source.key)?.actions ?? [];
  const quantities = new Set(
    sourceActions
      .map((producer) => producer.parameters.photometricQuantity)
      .filter((value): value is string => typeof value === "string"),
  );
  if (quantities.size !== 1) return undefined;

  const identity = `${String(action.parameters.calculationId ?? "")} ${action.label}`.toLowerCase();
  const [quantity] = [...quantities];
  if (identity.includes("absorbance")) {
    if (quantity === "percentTransmittance") return "absorbanceFromPercentT";
    if (quantity === "decimalTransmittance") return "absorbanceFromDecimalT";
  }
  if (
    identity.includes("decimal")
    && identity.includes("transmittance")
    && quantity === "percentTransmittance"
  ) {
    return "decimalTransmittance";
  }
  return undefined;
};

/**
 * Source-level audit for standalone evidence plumbing.
 *
 * A configuration slot whose value is an evidence *identifier* is only a name. It becomes useful
 * when an action with supported runtime semantics really produces the named measurement. Literal
 * validation ids are checked as well: a process node or success criterion must not wait on a
 * measurement that no action writes. This deliberately does not invent values and does not treat
 * substitution as evidence creation.
 *
 * This pass checks producer existence and producer/consumer meaning. It does not prove graph order
 * or reachability, so callers must not describe a clean result as an end-to-end reachability proof.
 */
export const auditStandaloneEvidence = (
  definition: TechniqueDefinition,
): StandaloneEvidenceIssue[] => {
  const producers = new Map<string, { reference: MeasurementReference; actions: ActionDefinition[] }>();
  for (const action of definition.actions) {
    for (const reference of producedMeasurements(action)) {
      const entry = producers.get(reference.key) ?? { reference, actions: [] };
      entry.actions.push(action);
      producers.set(reference.key, entry);
    }
  }

  const issues: StandaloneEvidenceIssue[] = [];
  const seenMissing = new Set<string>();
  for (const consumer of consumedMeasurements(definition)) {
    if (producers.has(consumer.key) || seenMissing.has(consumer.key)) continue;
    seenMissing.add(consumer.key);
    issues.push({
      code: "missing-measurement-producer",
      configurationSlot: consumer.configurationSlot,
      measurementId: consumer.measurementId,
      actionId: consumer.actionId,
      ruleId: consumer.ruleId,
      message: `${referenceLabel(consumer)} is consumed by ${consumer.context}, but no action in the technique produces that measurement.`,
    });
  }

  const dilutionFinalVolumeReferences = new Set(
    definition.actions
      .filter((action) =>
        action.verb === "calculate"
        && action.parameters.stockConcentrationMeasurementId !== undefined
        && action.parameters.stockVolumeMeasurementId !== undefined
        && action.parameters.finalVolumeMeasurementId !== undefined)
      .map((action) => measurementReference(action.parameters.finalVolumeMeasurementId)?.key)
      .filter((key): key is string => Boolean(key)),
  );

  // A water-addition measurement is not automatically the final *solution* volume. Keep this
  // semantic guard tied to a real dilution calculation that consumes that exact reference. Other
  // workflows may legitimately name a water-volume record with a finalVolumeMeasurementId slot.
  for (const entry of producers.values()) {
    if (!dilutionFinalVolumeReferences.has(entry.reference.key)) continue;
    const slot = entry.reference.configurationSlot;
    if (!slot || !/finalVolumeMeasurementId$/i.test(slot)) continue;
    for (const producer of entry.actions) {
      const description = `${producer.id} ${producer.label}`.toLowerCase();
      if (producer.verb === "measureVolume" && description.includes("water")) {
        issues.push({
          code: "misleading-final-volume-producer",
          configurationSlot: slot,
          actionId: producer.id,
          message: `Configuration slot "${slot}" is produced by a water-volume measurement rather than by evidence for the actual final solution volume.`,
        });
      }
    }
  }

  for (const action of definition.actions) {
    if (action.verb !== "calculate") continue;
    const hasDilutionInputs =
      action.parameters.stockConcentrationMeasurementId !== undefined
      && action.parameters.stockVolumeMeasurementId !== undefined
      && action.parameters.finalVolumeMeasurementId !== undefined;
    if (hasDilutionInputs && action.parameters.template !== "dilutedConcentration") {
      issues.push({
        code: "untyped-dilution-calculation",
        actionId: action.id,
        message: `Calculation "${action.id}" consumes stock concentration, stock volume and final volume but is not bound to the dilutedConcentration template.`,
      });
    }

    const expectedTemplate = expectedPhotometricTemplate(action, producers);
    if (expectedTemplate && action.parameters.template !== expectedTemplate) {
      issues.push({
        code: "untyped-photometric-calculation",
        actionId: action.id,
        message: `Calculation "${action.id}" consumes a typed photometer measurement but is not bound to the ${expectedTemplate} template required by that measurement quantity.`,
      });
    }
  }

  return issues;
};
