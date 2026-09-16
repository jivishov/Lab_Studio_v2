import { readFile, writeFile } from "node:fs/promises";
const registryPath = "src/domain/atomRegistry.json";
const registry = JSON.parse(await readFile(registryPath, "utf8"));
const operations = { "remove-solvent": "dry", "remove-drying-agent": "transfer", "observe-residue": "observe", "collect-residue": "transfer", "observe-dryness": "dry", "observe-cooling": "cool", dispose: "transfer", "remove-label": "rinse" };
for (const [operation, verb] of Object.entries(operations)) {
  const id = `atom.${verb}.fraction-${operation}`;
  const row = { id, family: "separation", documentationLabel: `Classroom fraction handling: ${operation}`, verb, allowedInteractionTypes: ["recordNotebook"], effectContract: { classes: ["apparatus-material-instrument-state", "evidence-recording"], targets: [{ domain: "equipment" }, { domain: "material" }, { domain: "evidence" }] }, requiredRoles: ["recovery-vessel"], optionalRoles: [], proceduralConstraints: ["Requires typed fractionHandling, a named vessel, and actual classroom observations. No predicted identity, distribution or yield. No heating model."], evidence: "Named fraction provenance and observed handling state", sourceExamples: [{ sourceFile: "quick-ache-relief-component-separation_2026-07-27.md", sourceTable: "phase", step: "E-09 to E-13", basis: "R/C" }], contentExamples: [] };
  const index = registry.atoms.findIndex((atom) => atom.id === id);
  if (index < 0) registry.atoms.push(row); else registry.atoms[index] = row;
}
await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
const rolePath = "src/domain/equipmentRoleRegistry.json";
const roles = JSON.parse(await readFile(rolePath, "utf8"));
const role = { id: "recovery-vessel", label: "Named fraction or cleanup vessel", kind: "vessel", constraints: { retainsProvenance: true }, allowedEquipmentIds: ["watch-glass", "filter-paper", "erlenmeyer-flask-250ml", "beaker-250ml", "side-arm-filter-flask", "waste-beaker"], rationale: "Physical handling retains the named fraction without inferring identity or yield." };
const index = roles.roles.findIndex((entry) => entry.id === role.id);
if (index < 0) roles.roles.push(role); else roles.roles[index] = role;
await writeFile(rolePath, `${JSON.stringify(roles, null, 2)}\n`);
