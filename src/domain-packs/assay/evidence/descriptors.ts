import type { EvidenceTypeDescriptorDocument } from "../../../platform/evidence";
import { forbiddenEvidenceDataCategories } from "../../../platform/evidence/security";

export const ASSAY_OBSERVATION_EVIDENCE = "assay.observation" as const;
export const ASSAY_TRANSFER_EVIDENCE = "assay.transfer" as const;
export const ASSAY_COMPOSITION_EVIDENCE = "assay.well-composition" as const;
export const ASSAY_QC_RESULT_EVIDENCE = "assay.qc-result" as const;
export const ASSAY_NORMALIZED_RESULT_EVIDENCE = "assay.normalized-result" as const;
export const ASSAY_FORMULA_TRACE_EVIDENCE = "assay.formula-trace" as const;
export const ASSAY_ENDPOINT_CANDIDATE_EVIDENCE = "assay.endpoint-candidate" as const;
export const ASSAY_MANUAL_CORRECTION_EVIDENCE = "assay.manual-correction" as const;
export const ASSAY_ASSIGNMENT_CHANGE_EVIDENCE = "assay.assignment-change" as const;
export const ASSAY_CYCLE08_EVIDENCE_VERSION = "1.0.0" as const;

const id = { type: "string", minLength: 1, pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]*$" } as const;
const nonEmpty = { type: "string", minLength: 1 } as const;
const decimal = { type: "string", pattern: "^[+-]?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?$" } as const;
const ids = { type: "array", uniqueItems: true, items: id } as const;
const strings = { type: "array", uniqueItems: true, items: nonEmpty } as const;

const payload = (
  required: string[],
  properties: Record<string, unknown>,
): Record<string, unknown> => ({
  type: "object",
  additionalProperties: false,
  required,
  properties,
});

const descriptor = (
  idValue: string,
  title: string,
  jsonSchema: Record<string, unknown>,
  producerIds: string[],
  consumerIds: string[],
  accessibleRepresentation: EvidenceTypeDescriptorDocument["accessibleRepresentation"] = "table",
): EvidenceTypeDescriptorDocument => ({
  id: idValue,
  version: ASSAY_CYCLE08_EVIDENCE_VERSION,
  domainPackId: "assay",
  title,
  jsonSchema,
  producerIds,
  consumerIds,
  accessibleRepresentation,
  retentionClass: "submission",
  sensitivity: "none",
  redaction: {
    policyId: `${idValue}.allowlist.v1`,
    strategy: "allowlist",
    excludedDataCategories: [...forbiddenEvidenceDataCategories],
  },
});

export const assayCycle08EvidenceDescriptors: EvidenceTypeDescriptorDocument[] = [
  descriptor(
    ASSAY_OBSERVATION_EVIDENCE,
    "Reviewed assay observation",
    payload(
      ["observationId", "plateId", "wellId", "sourceType", "value", "unit", "reviewStatus", "provenanceSourceId", "provenanceSourceVersion"],
      {
        observationId: id,
        plateId: id,
        wellId: id,
        sourceType: { enum: ["instrument-export", "image-derived", "manual", "synthetic"] },
        value: decimal,
        unit: nonEmpty,
        reviewStatus: { enum: ["unreviewed", "accepted", "corrected", "rejected"] },
        provenanceSourceId: id,
        provenanceSourceVersion: nonEmpty,
      },
    ),
    ["assay.evidence.assembler"],
    ["assay.qc.engine", "assay.results", "causalyst.rubric"],
  ),
  descriptor(
    ASSAY_TRANSFER_EVIDENCE,
    "Assay liquid transfer",
    payload(
      ["operationId", "operationType", "summary", "objectRefs", "sourceRefs", "destinationRefs"],
      {
        operationId: id,
        operationType: { enum: ["aspirate", "dispense", "discard", "mix"] },
        summary: nonEmpty,
        objectRefs: ids,
        sourceRefs: ids,
        destinationRefs: ids,
        volume: decimal,
        unit: nonEmpty,
      },
    ),
    ["assay.evidence.assembler"],
    ["assay.runtime.replay", "assay.results", "causalyst.rubric"],
  ),
  descriptor(
    ASSAY_COMPOSITION_EVIDENCE,
    "Assay well composition",
    payload(
      ["plateId", "wellId", "volume", "unit", "mixed", "components"],
      {
        plateId: id,
        wellId: id,
        volume: decimal,
        unit: nonEmpty,
        mixed: { type: "boolean" },
        components: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["resourceRef", "volume", "unit", "sourceRefs"],
            properties: {
              resourceRef: id,
              volume: decimal,
              unit: nonEmpty,
              concentration: decimal,
              concentrationUnit: nonEmpty,
              sourceRefs: ids,
            },
          },
        },
      },
    ),
    ["assay.evidence.assembler"],
    ["assay.results", "causalyst.rubric"],
  ),
  descriptor(
    ASSAY_QC_RESULT_EVIDENCE,
    "Assay QC rule result",
    payload(
      ["evaluationId", "ruleId", "ruleType", "status", "summary", "affectedWellIds", "formulaTraceRefs", "policySourceRef"],
      {
        evaluationId: id,
        ruleId: id,
        ruleType: id,
        status: { enum: ["pass", "warn", "fail", "indeterminate"] },
        summary: nonEmpty,
        metricValue: decimal,
        unit: nonEmpty,
        threshold: decimal,
        affectedWellIds: ids,
        formulaTraceRefs: ids,
        policySourceRef: id,
      },
    ),
    ["assay.qc.engine", "assay.evidence.assembler"],
    ["assay.results", "causalyst.rubric"],
  ),
  descriptor(
    ASSAY_NORMALIZED_RESULT_EVIDENCE,
    "Assay normalized result",
    payload(
      ["evaluationId", "wellId", "observationId", "rawValue", "normalizedValue", "unit", "formulaTraceRef", "policySourceRef"],
      {
        evaluationId: id,
        wellId: id,
        observationId: id,
        rawValue: decimal,
        correctedValue: decimal,
        normalizedValue: decimal,
        unit: nonEmpty,
        formulaTraceRef: id,
        policySourceRef: id,
      },
    ),
    ["assay.qc.engine", "assay.evidence.assembler"],
    ["assay.results", "causalyst.rubric"],
  ),
  descriptor(
    ASSAY_FORMULA_TRACE_EVIDENCE,
    "Assay deterministic formula trace",
    payload(
      ["traceId", "policySourceRef", "formula", "inputRefs", "inputValues", "result", "unit", "rounding"],
      {
        traceId: id,
        policySourceRef: id,
        formula: nonEmpty,
        inputRefs: ids,
        inputValues: { type: "array", items: decimal },
        result: decimal,
        unit: nonEmpty,
        rounding: nonEmpty,
      },
    ),
    ["assay.qc.engine", "assay.evidence.assembler"],
    ["assay.results", "causalyst.rubric"],
  ),
  descriptor(
    ASSAY_ENDPOINT_CANDIDATE_EVIDENCE,
    "Protocol-bound endpoint candidate",
    payload(
      ["candidateId", "profileRef", "status", "wellIds", "formulaTraceRefs", "limitations"],
      {
        candidateId: id,
        profileRef: id,
        status: { enum: ["candidate", "rejected", "indeterminate"] },
        value: decimal,
        unit: nonEmpty,
        wellIds: ids,
        formulaTraceRefs: ids,
        limitations: strings,
      },
    ),
    ["assay.analysis.endpoint-candidate", "assay.evidence.assembler"],
    ["assay.results", "causalyst.rubric"],
  ),
  descriptor(
    ASSAY_MANUAL_CORRECTION_EVIDENCE,
    "Assay manual correction",
    payload(
      ["correctionId", "observationId", "previousValue", "acceptedValue", "actorRole", "provenanceSourceId", "provenanceSourceVersion"],
      {
        correctionId: id,
        observationId: id,
        previousValue: decimal,
        acceptedValue: decimal,
        reason: nonEmpty,
        actorRole: nonEmpty,
        provenanceSourceId: id,
        provenanceSourceVersion: nonEmpty,
      },
    ),
    ["assay.evidence.assembler"],
    ["assay.results", "causalyst.rubric"],
  ),
  descriptor(
    ASSAY_ASSIGNMENT_CHANGE_EVIDENCE,
    "Assay control or replicate assignment change",
    payload(
      ["assignmentId", "assignmentType", "targetRef", "wellIds", "outcome", "summary"],
      {
        assignmentId: id,
        assignmentType: { enum: ["control", "replicate-group"] },
        targetRef: id,
        wellIds: ids,
        outcome: { enum: ["accepted", "rejected"] },
        summary: nonEmpty,
      },
    ),
    ["assay.assignment.actions"],
    ["assay.authoring", "causalyst.rubric"],
  ),
];

export const getAssayCycle08EvidenceDescriptors = (): EvidenceTypeDescriptorDocument[] =>
  structuredClone(assayCycle08EvidenceDescriptors);
