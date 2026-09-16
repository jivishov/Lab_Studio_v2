import { demoLab } from "../domain/fixtures";
import type { ActionDefinition, LabDefinition, ProcessNode } from "../domain/types";

const legacySampleSourceId = "sample-rack";
const sampleBottleId = "sample-bottle";

const cloneDemoLab = (): LabDefinition =>
  JSON.parse(JSON.stringify(demoLab)) as LabDefinition;

const drySampleAction: ActionDefinition = {
  id: "dry-sample-legacy",
  verb: "dry",
  label: "Dry sample",
  parameters: {
    sourceDefinitionId: "watch-glass",
    targetDefinitionId: "watch-glass",
    ovenDefinitionId: "drying-oven",
    dryMassG: 1,
    supportedOnly: true,
  },
  prerequisites: [],
  stateChanges: ["dry updates runtime state through structured equipment contents."],
  invalidCases: [],
  feedback: {
    success: "Dry sample completed.",
    invalid: "Review the dry sample node.",
  },
  evidence: ["dry"],
  interaction: {
    type: "placeInInstrument",
    sourceDefinitionId: "watch-glass",
    targetDefinitionId: "drying-oven",
    stationId: "drying-oven",
    accessibleLabel: "Place the measured sample in the drying oven.",
  },
};

const drySampleNode: ProcessNode = {
  id: "dry-sample-node",
  type: "action",
  title: "Dry sample",
  description: "Place the measured sample in the drying oven.",
  actionId: drySampleAction.id,
  config: {
    verb: "dry",
    supportedOnly: true,
  },
  validation: [
    {
      id: "legacy-dry-sample",
      type: "actionEvidence",
      label: "Dry sample completed.",
      actionId: drySampleAction.id,
    },
  ],
  hints: [],
  feedback: {
    success: "Dry sample complete.",
    retry: "Review Dry sample and try again.",
  },
};

const replaceSampleBottleEquipment = (equipmentIds: string[]): string[] =>
  equipmentIds.map((equipmentId) =>
    equipmentId === sampleBottleId ? legacySampleSourceId : equipmentId,
  );

const makeMeasureActionLegacy = (action: ActionDefinition): ActionDefinition =>
  action.id === "measure-20ml"
    ? {
        ...action,
        parameters: {
          ...action.parameters,
          sourceDefinitionId: legacySampleSourceId,
        },
        interaction: undefined,
      }
    : action;

export const createLegacySampleRackDraft = (): LabDefinition => {
  const draft = cloneDemoLab();
  const lastNode = draft.process.nodes[draft.process.nodes.length - 1];

  return {
    ...draft,
    id: "legacy-sample-rack-draft",
    title: "Legacy Sample Rack Draft",
    equipment: Array.from(
      new Set([
        ...replaceSampleBottleEquipment(draft.equipment),
        "watch-glass",
        "drying-oven",
      ]),
    ),
    techniques: draft.techniques.map((technique) =>
      technique.id === "measuring-volume"
        ? {
            ...technique,
            requiredEquipment: replaceSampleBottleEquipment(technique.requiredEquipment),
            initialState: {
              equipment: technique.initialState.equipment.map((instance) =>
                instance.definitionId === sampleBottleId
                  ? {
                      ...instance,
                      id: "sample-rack-1",
                      definitionId: legacySampleSourceId,
                      label: "Sample rack",
                    }
                  : instance,
              ),
            },
            actions: technique.actions.map(makeMeasureActionLegacy),
          }
        : technique,
    ),
    actions: [...draft.actions.map(makeMeasureActionLegacy), drySampleAction],
    process: {
      ...draft.process,
      nodes: [...draft.process.nodes, drySampleNode],
      edges: lastNode
        ? [
            ...draft.process.edges,
            {
              from: lastNode.id,
              to: drySampleNode.id,
              label: "Next",
              condition: { type: "validationPassed" },
            },
          ]
        : draft.process.edges,
    },
  };
};
