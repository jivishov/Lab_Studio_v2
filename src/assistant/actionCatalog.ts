import Ajv from "ajv";
import rawActionCatalog from "./actionCatalog.json";
import type {
  AssistantActionCatalogEntry,
  AssistantPageId,
  AssistantToolCall,
} from "./types";

export const actionCatalog = rawActionCatalog as AssistantActionCatalogEntry[];

const ajv = new Ajv({ allErrors: true });

const validators = new Map(
  actionCatalog.map((action) => [action.name, ajv.compile(action.parameters)]),
);

export const actionsForPage = (pageId: AssistantPageId): AssistantActionCatalogEntry[] =>
  actionCatalog.filter((action) => action.pageId === pageId);

export const findAction = (name: string): AssistantActionCatalogEntry | undefined =>
  actionCatalog.find((action) => action.name === name);

export const openAiToolsForPage = (pageId: AssistantPageId) =>
  actionsForPage(pageId).map((action) => ({
    type: "function" as const,
    name: action.name,
    description: action.description,
    parameters: action.parameters,
    strict: true,
  }));

export const validateToolCall = (
  call: Pick<AssistantToolCall, "name" | "arguments">,
  pageId: AssistantPageId,
): { ok: true; action: AssistantActionCatalogEntry } | { ok: false; error: string } => {
  const action = findAction(call.name);
  if (!action || action.pageId !== pageId) {
    return { ok: false, error: `Unknown assistant tool for ${pageId}: ${call.name}` };
  }

  const validate = validators.get(call.name);
  if (!validate) return { ok: false, error: `No schema validator for ${call.name}.` };
  if (!validate(call.arguments)) {
    const message = ajv.errorsText(validate.errors, { separator: "; " });
    return { ok: false, error: `${call.name} arguments failed validation: ${message}` };
  }
  return { ok: true, action };
};
