import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateBundledLabSource, validateTechniqueDefinition } from "../src/domain/validation";
import { v1EquipmentCatalog } from "../src/equipment/catalog";
import { v1VisualCatalog } from "../src/equipment/visualCatalog";
import { parseHashRoute } from "../src/routes";

interface CatalogEntry {
  id: string;
  title: string;
  description: string;
  file: string;
  tags?: string[];
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures: string[] = [];
const equipmentIds = new Set(v1EquipmentCatalog.map((definition) => definition.id));
const forbiddenDisplayName = /\bAP\b|Investigation\s+\d+/i;

const readJson = (relativePath: string): unknown =>
  JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));

const readCatalog = (folder: "labs" | "techniques"): CatalogEntry[] => {
  const value = readJson(`public/${folder}/index.json`);
  if (!Array.isArray(value)) {
    failures.push(`${folder}/index.json must contain an array.`);
    return [];
  }
  return value as CatalogEntry[];
};

const collectEquipmentIds = (definition: unknown): string[] => {
  if (!definition || typeof definition !== "object" || Array.isArray(definition)) return [];
  const equipment = (definition as { equipment?: unknown }).equipment;
  return Array.isArray(equipment)
    ? equipment.filter((item): item is string => typeof item === "string")
    : [];
};

const checkCatalog = (folder: "labs" | "techniques", entries: CatalogEntry[]): void => {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.id)) failures.push(`${folder}/index.json duplicates id "${entry.id}".`);
    seen.add(entry.id);

    if (forbiddenDisplayName.test(entry.title)) {
      failures.push(`${folder}/${entry.id} uses prohibited display branding in "${entry.title}".`);
    }

    const relativeFile = `public/${folder}/${entry.file}`;
    const absoluteFile = path.join(root, relativeFile);
    if (!fs.existsSync(absoluteFile)) {
      failures.push(`${folder}/${entry.id} references missing file "${entry.file}".`);
      continue;
    }

    const raw = readJson(relativeFile);
    const validation =
      folder === "labs"
        ? validateBundledLabSource(raw)
        : validateTechniqueDefinition(raw);
    if (!validation.ok || !validation.value) {
      failures.push(
        `${folder}/${entry.id} failed definition validation: ${validation.errors.join(" | ")}`,
      );
      continue;
    }

    if (validation.value.id !== entry.id) {
      failures.push(
        `${folder}/${entry.id} loads definition id "${validation.value.id}" from "${entry.file}".`,
      );
    }
    if (validation.value.title !== entry.title) {
      failures.push(
        `${folder}/${entry.id} title "${entry.title}" does not match definition title "${validation.value.title}".`,
      );
    }

    const href = folder === "labs" ? `#/play/${entry.id}` : `#/technique/${entry.id}`;
    const route = parseHashRoute(href, {
      assayStudioV1: false,
      causalystLocalV1: false,
      causalystLtiV1: false,
    });
    const routedId =
      route.name === "play"
        ? route.labId
        : route.name === "technique"
          ? route.techniqueId
          : undefined;
    if (routedId !== entry.id) {
      failures.push(`${folder}/${entry.id} does not resolve through route "${href}".`);
    }

    for (const equipmentId of collectEquipmentIds(validation.value)) {
      if (!equipmentIds.has(equipmentId)) {
        failures.push(`${folder}/${entry.id} references unknown equipment "${equipmentId}".`);
      }
      if (!v1VisualCatalog[equipmentId]) {
        failures.push(`${folder}/${entry.id} has no visual profile for "${equipmentId}".`);
      }
    }
  }
};

const labs = readCatalog("labs");
const techniques = readCatalog("techniques");
checkCatalog("labs", labs);
checkCatalog("techniques", techniques);

console.log(
  JSON.stringify(
    {
      labs: labs.length,
      techniques: techniques.length,
      failures,
    },
    null,
    2,
  ),
);

if (failures.length > 0) process.exitCode = 1;
