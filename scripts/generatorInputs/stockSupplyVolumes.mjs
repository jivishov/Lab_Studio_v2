import { readFileSync } from "node:fs";

const variants = JSON.parse(readFileSync(new URL("../../src/equipment/stockBottleVariants.json", import.meta.url), "utf8"));
const variantFor = Object.fromEntries(Object.entries(variants).map(([id, base]) => [base, id]));
const targets = {
  "blue1-spectroscopy": ["i1-unknown-sample", "i1-unknown-dilution-water"],
  "blue1-percent-transmittance": ["i1-unknown-sample", "i1-unknown-dilution-water"],
  "transmittance-dilution": ["sample-bottle-1", "blank-source-1"],
  "beers-law-calibration": ["sample-bottle-1", "blank-source-1"],
  "quick-ache-relief-separation": ["qar-property-reagent"],
  "quick-ache-property-evidence": ["qar-property-reagent"],
  "brass-colorimetry": ["assigned-salt-a-solution", "assigned-salt-b-solution"],
  "brass-spectrophotometry": ["assigned-salt-a-solution", "assigned-salt-b-solution"],
};
const visit = (value, fn) => {
  if (!value || typeof value !== "object") return;
  fn(value);
  for (const child of Object.values(value)) visit(child, fn);
};
const replaceDefinitions = (value, replacements) => {
  visit(value, (node) => {
    for (const [key, item] of Object.entries(node)) {
      if (typeof item === "string" && replacements[item]) node[key] = replacements[item];
    }
  });
};

/** User-configured stock inventory, not an analytical measurement or concentration. */
export const applyStockSupplyVolumes = (definition) => {
  const ids = targets[definition.id];
  if (!ids) return definition;
  const equipment = definition.initialState?.equipment ?? [];
  const changed = new Map();
  for (const id of ids) {
    const item = equipment.find((candidate) => candidate.id === id);
    if (!item) throw new Error(`Missing stock initialization target ${definition.id}/${id}`);
    if (item.definitionId === "test-tube") {
      // Brass scan: two 1 mL conditioning portions plus a 3 mL cuvette fill.
      item.contents.volumeMl = 5;
      continue;
    }
    const base = variants[item.definitionId] ?? item.definitionId;
    const next = variantFor[base];
    if (!next) throw new Error(`Unsupported stock container ${item.definitionId}`);
    changed.set(id, { base, next });
    item.definitionId = next;
    item.contents.volumeMl = 1000;
    if (!item.label.endsWith(" (1 L stock)")) item.label += " (1 L stock)";
  }
  for (const action of definition.actions ?? []) {
    const replacements = {};
    visit(action, (node) => {
      for (const value of Object.values(node)) {
        const change = changed.get(value);
        if (change) replacements[change.base] = change.next;
      }
    });
    replaceDefinitions(action, replacements);
  }
  // Lab instance bindings carry their own definition IDs independently of actions.
  visit(definition, (node) => {
    const source = changed.get(node.sourceInstanceId ?? node.instanceId);
    if (source && node.definitionId === source.base) node.definitionId = source.next;
    if (Array.isArray(node.sourceInstanceIds) && Array.isArray(node.allowedDefinitionIds)) {
      for (const id of node.sourceInstanceIds) {
        const change = changed.get(id);
        if (change && !node.allowedDefinitionIds.includes(change.next)) node.allowedDefinitionIds.push(change.next);
      }
    }
  });
  for (const key of ["equipment", "requiredEquipment"]) {
    if (!Array.isArray(definition[key])) continue;
    for (const { next } of changed.values()) if (!definition[key].includes(next)) definition[key].push(next);
  }
  return definition;
};
