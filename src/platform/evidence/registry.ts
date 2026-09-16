import {
  compileJsonSchemaValidator,
  schemaErrorsToDiagnostics,
  type ContractDiagnostic,
} from "../validation/jsonSchema";
import { validateEvidenceRegistryFragmentSchema, validateEvidenceRegistrySchema } from "./schema";
import { findForbiddenEvidenceData, forbiddenEvidenceDataCategories } from "./security";
import type {
  EvidenceRegistry,
  EvidenceRegistryDocument,
  EvidenceRegistryFragment,
  EvidenceTypeDescriptor,
} from "./types";

const error = (code: string, path: string, message: string): ContractDiagnostic => ({
  code,
  path,
  message,
  severity: "error",
});

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
  }
  return value;
};

export class EvidenceRegistryValidationError extends Error {
  readonly diagnostics: ContractDiagnostic[];

  constructor(message: string, diagnostics: ContractDiagnostic[]) {
    super(message);
    this.name = "EvidenceRegistryValidationError";
    this.diagnostics = diagnostics;
  }
}

export const createEvidenceRegistry = (
  fragments: readonly EvidenceRegistryFragment[],
  version = "1.0.0",
): EvidenceRegistry => {
  const diagnostics: ContractDiagnostic[] = [];
  if (fragments.length === 0) diagnostics.push(error("evidence.registry.fragment-required", "/", "At least one evidence registry fragment is required."));
  const validFragments = fragments.flatMap((fragment, fragmentIndex) => {
    const result = validateEvidenceRegistryFragmentSchema(fragment);
    if (!result.ok) {
      diagnostics.push(...result.diagnostics.map((item) => ({ ...item, path: `/fragments/${fragmentIndex}${item.path === "/" ? "" : item.path}` })));
      return [];
    }
    result.value.entries.forEach((entry, entryIndex) => {
      if (entry.domainPackId !== result.value.domainPackId) diagnostics.push(error(
        "evidence.registry.domain-pack-mismatch",
        `/fragments/${fragmentIndex}/entries/${entryIndex}/domainPackId`,
        `Evidence type ${entry.id} belongs to ${entry.domainPackId}, not fragment ${result.value.domainPackId}.`,
      ));
      const excluded = new Set(entry.redaction.excludedDataCategories);
      forbiddenEvidenceDataCategories.forEach((category) => {
        if (!excluded.has(category)) diagnostics.push(error(
          "evidence.registry.redaction-category-missing",
          `/fragments/${fragmentIndex}/entries/${entryIndex}/redaction/excludedDataCategories`,
          `Redaction policy must explicitly exclude ${category}.`,
        ));
      });
    });
    return [result.value];
  });
  const entries = validFragments.flatMap(({ entries }) => entries)
    .sort((left, right) => left.id.localeCompare(right.id) || left.version.localeCompare(right.version));
  const seen = new Set<string>();
  entries.forEach((entry, index) => {
    if (seen.has(entry.id)) diagnostics.push(error("evidence.registry.type-duplicate", `/entries/${index}/id`, `Evidence type ${entry.id} is duplicated in this registry snapshot.`));
    seen.add(entry.id);
  });
  const registryDocument: EvidenceRegistryDocument = {
    schema: "studio.evidence-registry",
    schemaVersion: "1.0",
    version,
    entries,
  };
  const registryDocumentResult = validateEvidenceRegistrySchema(registryDocument);
  if (!registryDocumentResult.ok) diagnostics.push(...registryDocumentResult.diagnostics);

  const runtimeEntries: EvidenceTypeDescriptor[] = [];
  entries.forEach((entry, index) => {
    try {
      const validator = compileJsonSchemaValidator<unknown>(entry.jsonSchema);
      runtimeEntries.push({
        ...entry,
        validate: (payload: unknown): payload is unknown => validator(payload),
      });
    } catch (cause) {
      diagnostics.push(error(
        "evidence.registry.payload-schema-invalid",
        `/entries/${index}/jsonSchema`,
        cause instanceof Error ? cause.message : `Evidence type ${entry.id} has an invalid JSON Schema.`,
      ));
    }
  });
  if (diagnostics.length > 0) throw new EvidenceRegistryValidationError(
    "Evidence registry validation failed.",
    diagnostics.sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code)),
  );

  const frozenDocument = deepFreeze(structuredClone(registryDocument));
  const frozenEntries = runtimeEntries.map((entry) => deepFreeze(entry));
  const byId = new Map(frozenEntries.map((entry) => [entry.id, entry]));
  const typeIds = new Set(byId.keys());
  return Object.freeze({
    registryDocument: frozenDocument,
    typeIds,
    list: () => frozenEntries,
    get: (typeId: string, expectedVersion?: string) => {
      const descriptor = byId.get(typeId);
      return descriptor && (!expectedVersion || descriptor.version === expectedVersion) ? descriptor : undefined;
    },
    validatePayload: (typeId: string, expectedVersion: string, payload: unknown) => {
      const descriptor = byId.get(typeId);
      if (!descriptor) return { ok: false as const, diagnostics: [error("evidence.type.not-registered", "/typeId", `Evidence type ${typeId} is not registered.`)] };
      if (descriptor.version !== expectedVersion) return { ok: false as const, diagnostics: [error("evidence.type.version-mismatch", "/typeVersion", `Evidence type ${typeId} requires ${descriptor.version}, not ${expectedVersion}.`)] };
      const securityDiagnostics = findForbiddenEvidenceData(payload, "/payload");
      const validator = compileJsonSchemaValidator<unknown>(descriptor.jsonSchema);
      if (!validator(payload)) securityDiagnostics.push(...schemaErrorsToDiagnostics(validator.errors).map((item) => ({
        ...item,
        path: `/payload${item.path === "/" ? "" : item.path}`,
      })));
      return securityDiagnostics.length > 0
        ? { ok: false as const, diagnostics: securityDiagnostics.sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code)) }
        : { ok: true as const, value: payload, diagnostics: [] };
    },
  });
};
