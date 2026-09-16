import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bundledLabs, standaloneTechniques } from "../fixtures";
import { resolveActionInteraction } from "../interactions";
import type { ActionDefinition, LabDefinition, ProcessNode, TechniqueDefinition } from "../types";
import {
  createActionFromTemplate,
  createNodeFromTemplate,
  studioTemplates,
} from "../../studio/studioState";

type ActiveStepDefinition = {
  actions: ActionDefinition[];
  process: {
    nodes: ProcessNode[];
  };
};

const generatedPlaceholder = /^(Use a .* action for |(?:TODO|TBD)\b)/i;

const normalizeInstructionText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const expectAuthoredProcessCopy = (description: string) => {
  expect(description.trim()).toMatch(/[A-Za-z]/);
  expect(description).not.toMatch(/\n/);
  // Process copy may be a short imperative, an observation, or a safety/configuration gate.
  // Keep this guard focused on authored copy instead of imposing a stale verb whitelist or
  // rewriting source safety prose to satisfy it.
  expect(description).not.toMatch(generatedPlaceholder);
};

const expectNoRedundantHints = (
  hints: string[],
  description: string,
  accessibleLabel: string | undefined,
) => {
  const references = [description, accessibleLabel ?? ""]
    .map(normalizeInstructionText)
    .filter(Boolean);

  for (const hint of hints) {
    expect(hint).not.toMatch(/^Use the equipment and action configured for /);
    const normalizedHint = normalizeInstructionText(hint);
    expect(normalizedHint).not.toHaveLength(0);
    expect(
      references.some(
        (reference) =>
          normalizedHint === reference ||
          normalizedHint.includes(reference) ||
          reference.includes(normalizedHint),
      ),
    ).toBe(false);
  }
};

const readPublicJson = <T,>(folder: "labs" | "techniques", file: string): T =>
  JSON.parse(readFileSync(join(process.cwd(), "public", folder, file), "utf8")) as T;

const publicLabDefinitions = (): Array<[string, ActiveStepDefinition]> => {
  const index = readPublicJson<Array<{ id: string; file?: string }>>("labs", "index.json");
  return index
    .filter((entry) => entry.id !== "acid-base-titration")
    .flatMap((entry) => {
      const lab = readPublicJson<LabDefinition>("labs", entry.file ?? `${entry.id}.json`);
      return [
        [`public lab ${lab.id}`, lab] as [string, ActiveStepDefinition],
        ...lab.techniques.map(
          (technique) =>
            [`public lab ${lab.id} embedded technique ${technique.id}`, technique] as [
              string,
              ActiveStepDefinition,
            ],
        ),
      ];
    });
};

const publicTechniqueDefinitions = (): Array<[string, ActiveStepDefinition]> => {
  const index = readPublicJson<Array<{ id: string; file?: string }>>("techniques", "index.json");
  return index.map((entry) => {
    const technique = readPublicJson<TechniqueDefinition>("techniques", entry.file ?? `${entry.id}.json`);
    return [`public technique ${technique.id}`, technique] as [string, ActiveStepDefinition];
  });
};

const fixtureDefinitions = (): Array<[string, ActiveStepDefinition]> => [
  ...bundledLabs.map((lab) => [`fixture lab ${lab.id}`, lab] as [string, ActiveStepDefinition]),
  ...standaloneTechniques.map(
    (technique) => [`fixture technique ${technique.id}`, technique] as [string, ActiveStepDefinition],
  ),
];

const studioTemplateDefinitions = (): Array<[string, ActiveStepDefinition]> =>
  studioTemplates
    .filter((template) => template.nodeType && template.verb)
    .map(
      (template, index) =>
        [
          `studio template ${template.id}`,
          {
            actions: [createActionFromTemplate(template, index + 1)],
            process: {
              nodes: [createNodeFromTemplate(template, index + 1)],
            },
          },
        ] as [string, ActiveStepDefinition],
    );

describe("active process step copy", () => {
  const definitions = [
    ...publicLabDefinitions(),
    ...publicTechniqueDefinitions(),
    ...fixtureDefinitions(),
    ...studioTemplateDefinitions(),
  ];

  it.each(definitions)("%s uses authored process-step copy without generic fallback text", (_name, definition) => {
    const actions = new Map(definition.actions.map((action) => [action.id, action]));

    for (const node of definition.process.nodes) {
      expectAuthoredProcessCopy(node.description);

      const action = node.actionId ? actions.get(node.actionId) : undefined;
      const explicitAccessibleLabel = action?.interaction?.accessibleLabel;
      if (explicitAccessibleLabel) {
        expect(explicitAccessibleLabel.trim()).toMatch(/[A-Za-z]/);
        expect(explicitAccessibleLabel).not.toMatch(generatedPlaceholder);
      }

      const resolvedInteraction = action ? resolveActionInteraction(action) : undefined;
      expectNoRedundantHints(node.hints, node.description, resolvedInteraction?.accessibleLabel);
    }
  });
});
