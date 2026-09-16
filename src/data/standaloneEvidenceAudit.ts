import type { ActionDefinition, TechniqueDefinition } from "../domain/types";

const CONFIG_SLOT = /^\{\{config\.([A-Za-z0-9_-]+)\}\}$/;
const configSlot = (value: unknown): string | undefined =>
  typeof value === "string" ? value.match(CONFIG_SLOT)?.[1] : undefined;

export interface StandaloneEvidenceIssue {
  code:
    | "missing-measurement-producer"
    | "misleading-final-volume-producer"
    | "untyped-dilution-calculation";
  message: string;
  actionId?: string;
  configurationSlot?: string;
}

const producedMeasurementSlots = (action: ActionDefinition): string[] => {
  const produced = new Set<string>();
  const add = (value: unknown) => {
    const slot = configSlot(value);
    if (slot) produced.add(slot);
  };

  add(action.volume?.outputMeasurementId);
  add(action.mass?.outputMeasurementId);

  // The ordinary configurationQuantity branch writes parameters.measurementId. Photometer reads
  // and other typed observation branches may also write it, but only the configuration branch is a
  // pre-start/teacher-value producer relevant to the standalone configuration audit.
  if (
    action.verb === "observe"
    && typeof action.parameters.configurationQuantity === "string"
    && action.parameters.configurationQuantity.length > 0
  ) {
    add(action.parameters.measurementId);
  }

  return [...produced];
};

const consumedMeasurementSlots = (action: ActionDefinition): string[] => {
  const consumed = new Set<string>();
  for (const [key, value] of Object.entries(action.parameters)) {
    if (!key.endsWith("MeasurementId")) continue;
    const slot = configSlot(value);
    if (slot) consumed.add(slot);
  }
  if (action.volume?.source === "measurement") {
    const slot = configSlot(action.volume.referenceId);
    if (slot) consumed.add(slot);
  }
  if (action.mass?.source === "measurement") {
    const slot = configSlot(action.mass.referenceId);
    if (slot) consumed.add(slot);
  }
  return [...consumed];
};

/**
 * Source-level audit for standalone evidence plumbing.
 *
 * A configuration slot whose value is an evidence *identifier* is only a name. It becomes useful
 * when a reachable action really produces the named measurement. This deliberately does not invent
 * values and does not treat substitution as evidence creation.
 */
export const auditStandaloneEvidence = (
  definition: TechniqueDefinition,
): StandaloneEvidenceIssue[] => {
  const producers = new Map<string, ActionDefinition[]>();
  for (const action of definition.actions) {
    for (const slot of producedMeasurementSlots(action)) {
      const actions = producers.get(slot) ?? [];
      actions.push(action);
      producers.set(slot, actions);
    }
  }

  const issues: StandaloneEvidenceIssue[] = [];
  const seenMissing = new Set<string>();
  for (const action of definition.actions) {
    for (const slot of consumedMeasurementSlots(action)) {
      if (producers.has(slot) || seenMissing.has(slot)) continue;
      seenMissing.add(slot);
      issues.push({
        code: "missing-measurement-producer",
        configurationSlot: slot,
        actionId: action.id,
        message: `Configuration slot "${slot}" names measurement evidence consumed by "${action.id}", but no action in the technique produces that measurement.`,
      });
    }
  }

  // A water-addition measurement is not automatically the final *solution* volume. Keep this
  // semantic guard narrow: it exists for the repaired catalog path where the same configured id was
  // wired to the water measurement and then consumed as final volume by the dilution calculation.
  for (const [slot, actions] of producers) {
    if (!/finalVolumeMeasurementId$/i.test(slot)) continue;
    for (const producer of actions) {
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
