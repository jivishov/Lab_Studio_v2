import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();

const emptyContents = () => ({
  kind: "empty",
  label: "empty",
  solutes: [],
  contamination: [],
  wetState: "dry",
  visualState: "empty",
});

const receiverEquipment = () => ({
  id: "erlenmeyer-flask-250ml-1",
  definitionId: "erlenmeyer-flask-250ml",
  label: "Receiving flask",
  location: "shelf",
  contents: emptyContents(),
});

const receiverAction = () => ({
  id: "place-filtration-receiver",
  verb: "place",
  label: "Place receiving flask",
  parameters: {
    equipmentDefinitionId: "erlenmeyer-flask-250ml",
    targetDefinitionId: "funnel-stand",
    snapZoneId: "funnel-receiving-vessel-zone",
  },
  interaction: {
    type: "snapIntoTarget",
    sourceDefinitionId: "erlenmeyer-flask-250ml",
    targetDefinitionId: "funnel-stand",
    snapZoneId: "funnel-receiving-vessel-zone",
    accessibleLabel: "Place the receiving flask under the funnel.",
    successCue: "Receiving flask is under the funnel.",
    invalidCue: "Use a beaker or Erlenmeyer flask under the funnel stem.",
  },
  prerequisites: [],
  stateChanges: ["Place the receiving vessel below the prepared funnel."],
  invalidCases: [],
  feedback: {
    success: "Receiving flask is under the funnel.",
    invalid: "Place a receiving vessel below the funnel before filtering.",
  },
  evidence: ["place"],
});

const receiverNode = (prefix = "") => ({
  id: `${prefix}place-receiver-node`,
  type: "action",
  title: "Place receiver",
  description: "Place a receiving flask below the funnel.",
  actionId: "place-filtration-receiver",
  config: {},
  validation: [
    {
      id: `${prefix}placed-filtration-receiver`,
      type: "actionEvidence",
      label: "Receiving flask has been placed.",
      actionId: "place-filtration-receiver",
    },
  ],
  hints: ["Place the receiving flask in the receiving vessel zone below the funnel."],
  feedback: {
    success: "Receiver placement checkpoint passed.",
    retry: "Place a receiving vessel below the funnel before filtering.",
  },
});

const addUniqueString = (items, value) => {
  if (!Array.isArray(items)) return;
  if (!items.includes(value)) items.push(value);
};

const addUniqueObjectById = (items, item, beforeId) => {
  if (!Array.isArray(items) || items.some((candidate) => candidate.id === item.id)) return;
  const beforeIndex = beforeId ? items.findIndex((candidate) => candidate.id === beforeId) : -1;
  if (beforeIndex >= 0) {
    items.splice(beforeIndex, 0, item);
  } else {
    items.push(item);
  }
};

const linearEdge = (from, to, label = "Next") => ({
  from,
  to,
  label,
  condition: { type: "validationPassed" },
});

const insertNodeBeforeAction = (process, actionId, node) => {
  if (!process?.nodes || process.nodes.some((candidate) => candidate.id === node.id)) return;
  const targetIndex = process.nodes.findIndex((candidate) => candidate.actionId === actionId);
  if (targetIndex < 0) return;
  const targetNode = process.nodes[targetIndex];
  const previousInbound = process.edges?.find(
    (edge) => edge.to === targetNode.id && edge.condition?.type === "validationPassed",
  );
  const previousNodeId = previousInbound?.from;
  const previousNode = previousNodeId
    ? process.nodes.find((candidate) => candidate.id === previousNodeId)
    : undefined;
  const layout = previousNode?.layout
    ? {
        x: previousNode.layout.x + 220,
        y: previousNode.layout.y,
        lane: previousNode.layout.lane,
        display: previousNode.layout.display,
      }
    : undefined;
  process.nodes.splice(targetIndex, 0, layout ? { ...node, layout } : node);
  process.edges ??= [];
  if (previousInbound) previousInbound.to = node.id;
  process.edges.push(linearEdge(node.id, targetNode.id));
  if (process.startNodeId === targetNode.id && !previousInbound) {
    process.startNodeId = node.id;
    process.edges.push(linearEdge(node.id, targetNode.id));
  }
};

const addFiltrationReceiver = (definition) => {
  if (Array.isArray(definition.requiredEquipment)) addUniqueString(definition.requiredEquipment, "erlenmeyer-flask-250ml");
  if (Array.isArray(definition.equipment)) addUniqueString(definition.equipment, "erlenmeyer-flask-250ml");
  if (definition.initialState?.equipment) {
    addUniqueObjectById(definition.initialState.equipment, receiverEquipment());
  }
  if (Array.isArray(definition.actions) && definition.actions.some((action) => action.id === "filter-mixture")) {
    addUniqueObjectById(definition.actions, receiverAction(), "filter-mixture");
  }
  if (definition.process) {
    insertNodeBeforeAction(definition.process, "filter-mixture", receiverNode(definition.id === "hard-water-demo" ? "hw-" : ""));
  }
  for (const technique of definition.techniques ?? []) addFiltrationReceiver(technique);
};

const mountBuretteAction = () => ({
  id: "mount-burette",
  verb: "place",
  label: "Mount burette on ring stand",
  parameters: {
    equipmentDefinitionId: "burette-50ml",
    targetDefinitionId: "ring-stand-clamp",
    snapZoneId: "ring-stand-burette-clamp",
  },
  interaction: {
    type: "snapIntoTarget",
    sourceDefinitionId: "burette-50ml",
    targetDefinitionId: "ring-stand-clamp",
    snapZoneId: "ring-stand-burette-clamp",
    successCue: "Burette is mounted on the ring stand.",
    invalidCue: "Mount the burette in the ring stand clamp before titrating.",
    accessibleLabel: "Mount the burette on the ring stand clamp.",
  },
  prerequisites: [],
  stateChanges: ["Attach the burette to the ring stand clamp."],
  invalidCases: [],
  feedback: {
    success: "Burette is mounted on the ring stand.",
    invalid: "Mount the burette before recording titration readings.",
  },
  evidence: ["place", "titration-setup"],
});

const mountBuretteNode = () => ({
  id: "mount-burette-node",
  type: "action",
  title: "Mount burette",
  description: "Attach the burette to the ring stand clamp before titration.",
  actionId: "mount-burette",
  layout: {
    x: 40,
    y: 60,
    lane: "setup",
    display: "expanded",
  },
  config: {},
  validation: [
    {
      id: "burette-mounted",
      type: "actionEvidence",
      label: "Burette mounted on ring stand.",
      actionId: "mount-burette",
    },
  ],
  hints: ["Mount the burette on the ring stand clamp before recording readings."],
  feedback: {
    success: "Burette mount checkpoint passed.",
    retry: "Attach the burette to the ring stand clamp.",
  },
});

const addMountedBuretteFlow = (lab) => {
  if (!Array.isArray(lab.actions) || lab.actions.some((action) => action.id === "mount-burette")) return;
  lab.actions.unshift(mountBuretteAction());
  const oldStart = lab.process?.startNodeId;
  if (lab.process?.nodes && oldStart) {
    lab.process.nodes.unshift(mountBuretteNode());
    lab.process.startNodeId = "mount-burette-node";
    lab.process.edges ??= [];
    lab.process.edges.unshift(linearEdge("mount-burette-node", oldStart));
  }
  const initialRecord = lab.actions.find((action) => action.id === "record-initial-burette");
  if (initialRecord && !initialRecord.prerequisites.some((rule) => rule.id === "burette-mounted-required")) {
    initialRecord.prerequisites.unshift({
      id: "burette-mounted-required",
      type: "actionEvidence",
      label: "Burette has been mounted.",
      actionId: "mount-burette",
    });
  }
};

const updateJson = async (relativePath, updater) => {
  const fullPath = join(root, relativePath);
  const json = JSON.parse(await readFile(fullPath, "utf8"));
  updater(json);
  await writeFile(fullPath, `${JSON.stringify(json, null, 2)}\n`);
};

await updateJson("public/techniques/filtration.json", addFiltrationReceiver);
await updateJson("public/labs/hard-water-demo.json", addFiltrationReceiver);
await updateJson("public/labs/intro-filtration-demo.json", addFiltrationReceiver);
await updateJson("public/labs/acid-base-titration.json", addMountedBuretteFlow);
