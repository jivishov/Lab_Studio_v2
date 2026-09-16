import { forbiddenEvidenceDataCategories } from "../../platform/evidence/security";
import type { EvidenceRegistryFragment } from "../../platform/evidence/types";

export const chemistryValidationRuleEvidenceSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://lab-studio.local/schemas/evidence/chemistry.validation.rule/1.0.0",
  type: "object",
  additionalProperties: false,
  required: ["ruleId", "nodeId", "passed", "message"],
  properties: {
    ruleId: { type: "string", minLength: 1, pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]*$" },
    nodeId: { type: "string", minLength: 1, pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]*$" },
    passed: { type: "boolean" },
    message: { type: "string", minLength: 1, maxLength: 10000 },
  },
} as const;

export const chemistryEvidenceRegistryFragment: EvidenceRegistryFragment = {
  schema: "studio.evidence-registry-fragment",
  schemaVersion: "1.0",
  domainPackId: "chemistry",
  version: "1.0.0",
  entries: [
    {
      id: "chemistry.validation.rule",
      version: "1.0.0",
      domainPackId: "chemistry",
      title: "Chemistry runtime validation rule",
      jsonSchema: chemistryValidationRuleEvidenceSchema,
      producerIds: ["chemistry.runtime"],
      consumerIds: ["studio.trace", "causalyst.rubric"],
      accessibleRepresentation: "text",
      retentionClass: "submission",
      sensitivity: "none",
      redaction: {
        policyId: "chemistry.validation.rule.allowlist-v1",
        strategy: "allowlist",
        excludedDataCategories: [...forbiddenEvidenceDataCategories],
      },
    },
  ],
};

export const getChemistryEvidenceRegistryFragment = (): EvidenceRegistryFragment =>
  structuredClone(chemistryEvidenceRegistryFragment);

