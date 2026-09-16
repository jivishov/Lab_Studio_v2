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
    | "untyped-dilution-calculation";
  message: string;
  actionId?: string;
  ruleId?: string;
  configurationSlot?: string;
  measurementId?: string;
}

const measurementParameterIsProduced = (action: ActionDefinition): boolean => {
  const params = action.parameters;
  if (params.measurementId === undefined) return false;
  if (
    action.verb === "developChromatogram"
    && params.recordMeasurementsOnDevelop === false
  ) {
    return false;
  }
  if (new Set(["weigh", "measureVolume", "dilute", "developChromatogram", "record"]).has(action.verb)) {
    return true;
  }
  if (action.atomId === "atom.measure.read-burette") return true;
  return action.verb === "observe" && (
    params.chromatographyMeasurementType !== undefined
    || params.configurationQuantity !== undefined
    || params.photometerOperation === "read"
  );
};

const producedMeasurements = (action: ActionDefinition): MeasurementReference[] => {
  const produced = new Map<string, MeasurementReference>();
  const add = (value: unknown) => {
    const reference = measurementReference(value);
    if (reference) produced.set(reference.key, reference);
  };

  add(action.volume?.outputMeasurementId);
  add(action.mass?.outputMeasurementId);
  if (measurementParameterIsProduced(action)) add(action.parameters.measurementId);

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
    for (const [key, value] of Object.entries(action.parameters)) {
      if (!key.endsWith("MeasurementId")) continue;
      add(value, `action parameter ${action.id}.${key}`, action.id);
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

/**
 * Source-level audit for standalone evidence plumbing.
 *
 * A configuration slot whose value is an evidence *identifier* is only a name. It becomes useful
 * when a reachable action really produces the named measurement. Literal validation ids are checked
 * as well: a process node or success criterion must not wait on a measurement that no action writes.
 * This deliberately does not invent values and does not treat substitution as evidence creation.
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

  // A water-addition measurement is not automatically the final *solution* volume. Keep this
  // semantic guard narrow: it exists for the repaired catalog path where the same configured id was
  // wired to the water measurement and then consumed as final volume by the dilution calculation.
  for (const entry of producers.values()) {
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
  }

  return issues;
};
