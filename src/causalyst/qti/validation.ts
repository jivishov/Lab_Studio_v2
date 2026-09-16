import { compareDecimal, parseDecimal } from "../../platform/planning/decimal";
import { findForbiddenArtifactData } from "../../platform/artifacts/security";
import type { QtiCompanionItem, QtiCompanionModel } from "./types";

export interface QtiValidationDiagnostic {
  code: string;
  path: string;
  message: string;
}

export type QtiValidationResult =
  | { ok: true; value: QtiCompanionModel; diagnostics: [] }
  | { ok: false; diagnostics: QtiValidationDiagnostic[] };

const safeIdentifier = /^[A-Za-z][A-Za-z0-9._-]{0,127}$/;
const safeFileName = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const base64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const forbiddenText = /(?:<script\b|javascript:|data:text\/html|<!DOCTYPE|<!ENTITY)/i;
const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const issue = (
  diagnostics: QtiValidationDiagnostic[],
  code: string,
  path: string,
  message: string,
) => diagnostics.push({ code, path, message });

const validateText = (
  value: unknown,
  path: string,
  diagnostics: QtiValidationDiagnostic[],
) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    issue(diagnostics, "qti.text.required", path, "A non-empty text value is required.");
  } else if (forbiddenText.test(value)) {
    issue(diagnostics, "qti.text.active-content", path, "Active XML/HTML content is not allowed.");
  }
};

const rejectUnknownKeys = (
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  diagnostics: QtiValidationDiagnostic[],
) => Object.keys(value).forEach((key) => {
  if (!allowed.includes(key)) issue(diagnostics, "qti.schema.additional-property", `${path}/${key}`, `Property ${key} is not allowed.`);
});

const validateAssetBytes = (
  contentBase64: string,
  mediaType: QtiCompanionModel["assets"][number]["mediaType"],
  path: string,
  diagnostics: QtiValidationDiagnostic[],
) => {
  try {
    const bytes = Uint8Array.from(atob(contentBase64), (character) => character.charCodeAt(0));
    if (bytes.byteLength > 2 * 1024 * 1024) issue(diagnostics, "qti.asset.size", path, "Static assets are limited to 2 MiB.");
    const valid = mediaType === "image/png"
      ? pngSignature.every((byte, index) => bytes[index] === byte)
      : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
    if (!valid) issue(diagnostics, "qti.asset.signature", path, `Asset bytes do not match ${mediaType}.`);
  } catch {
    issue(diagnostics, "qti.asset.base64", path, "Asset bytes must use valid base64.");
  }
};

const validateChoices = (
  item: Extract<QtiCompanionItem, { type: "single-choice" | "multiple-response" }>,
  path: string,
  diagnostics: QtiValidationDiagnostic[],
) => {
  if (!Array.isArray(item.choices)) {
    issue(diagnostics, "qti.choice.array", `${path}/choices`, "Choices must be an array.");
    return new Set<string>();
  }
  if (item.choices.length < 2) issue(diagnostics, "qti.choice.minimum", `${path}/choices`, "At least two choices are required.");
  const seen = new Set<string>();
  item.choices.forEach((choice, index) => {
    if (!isRecord(choice)) {
      issue(diagnostics, "qti.choice.object", `${path}/choices/${index}`, "Each choice must be an object.");
      return;
    }
    if (!safeIdentifier.test(choice.id)) issue(diagnostics, "qti.choice.id", `${path}/choices/${index}/id`, "Choice IDs must be portable XML identifiers.");
    if (seen.has(choice.id)) issue(diagnostics, "qti.choice.duplicate", `${path}/choices/${index}/id`, "Choice IDs must be unique.");
    seen.add(choice.id);
    validateText(choice.label, `${path}/choices/${index}/label`, diagnostics);
  });
  return seen;
};

const validateItem = (
  item: QtiCompanionItem,
  path: string,
  assetIds: Set<string>,
  diagnostics: QtiValidationDiagnostic[],
) => {
  const allowedItemKeys = item.type === "single-choice"
    ? ["id", "type", "title", "prompt", "required", "staticAssetRefs", "choices", "correctChoiceId"]
    : item.type === "multiple-response"
      ? ["id", "type", "title", "prompt", "required", "staticAssetRefs", "choices", "correctChoiceIds", "minimumChoices", "maximumChoices"]
      : item.type === "numeric-response"
        ? ["id", "type", "title", "prompt", "required", "staticAssetRefs", "correctResponse", "tolerance", "unitLabel"]
        : ["id", "type", "title", "prompt", "required", "staticAssetRefs", "expectedLines", "rubricReference"];
  rejectUnknownKeys(item as unknown as Record<string, unknown>, allowedItemKeys, path, diagnostics);
  if (typeof item.required !== "boolean") issue(diagnostics, "qti.item.required-flag", `${path}/required`, "required must be boolean.");
  if (!Array.isArray(item.staticAssetRefs) || item.staticAssetRefs.some((id) => typeof id !== "string")) {
    issue(diagnostics, "qti.item.asset-refs", `${path}/staticAssetRefs`, "Static asset references must be a string array.");
    return;
  }
  if (!safeIdentifier.test(item.id)) issue(diagnostics, "qti.item.id", `${path}/id`, "Item IDs must be portable XML identifiers.");
  validateText(item.title, `${path}/title`, diagnostics);
  validateText(item.prompt, `${path}/prompt`, diagnostics);
  item.staticAssetRefs.forEach((id, index) => {
    if (!assetIds.has(id)) issue(diagnostics, "qti.item.asset-missing", `${path}/staticAssetRefs/${index}`, `Asset ${id} is not defined.`);
  });
  if (item.type === "single-choice") {
    const choices = validateChoices(item, path, diagnostics);
    if (!choices.has(item.correctChoiceId)) issue(diagnostics, "qti.choice.correct-missing", `${path}/correctChoiceId`, "The correct choice must reference a defined choice.");
  }
  if (item.type === "multiple-response") {
    const choices = validateChoices(item, path, diagnostics);
    if (!Array.isArray(item.correctChoiceIds)) {
      issue(diagnostics, "qti.multiple.correct-invalid", `${path}/correctChoiceIds`, "Correct responses must be a non-empty unique list.");
      return;
    }
    const correct = new Set(item.correctChoiceIds);
    if (correct.size !== item.correctChoiceIds.length || correct.size === 0) {
      issue(diagnostics, "qti.multiple.correct-invalid", `${path}/correctChoiceIds`, "Correct responses must be a non-empty unique list.");
    }
    item.correctChoiceIds.forEach((id, index) => {
      if (!choices.has(id)) issue(diagnostics, "qti.multiple.correct-missing", `${path}/correctChoiceIds/${index}`, "Correct responses must reference defined choices.");
    });
    if (!Number.isInteger(item.minimumChoices) || item.minimumChoices < 0
      || !Number.isInteger(item.maximumChoices) || item.maximumChoices < 1
      || item.minimumChoices > item.maximumChoices || item.maximumChoices > item.choices.length) {
      issue(diagnostics, "qti.multiple.cardinality", path, "Choice limits must be valid for the authored choices.");
    }
  }
  if (item.type === "numeric-response") {
    try {
      parseDecimal(item.correctResponse);
      const tolerance = parseDecimal(item.tolerance);
      if (compareDecimal(tolerance, parseDecimal("0")) < 0) {
        issue(diagnostics, "qti.numeric.tolerance", `${path}/tolerance`, "Tolerance cannot be negative.");
      }
    } catch {
      issue(diagnostics, "qti.numeric.decimal", path, "Numeric responses and tolerances must be exact decimal strings.");
    }
    if (item.unitLabel !== undefined) validateText(item.unitLabel, `${path}/unitLabel`, diagnostics);
  }
  if (item.type === "extended-text" && (!Number.isInteger(item.expectedLines) || item.expectedLines < 1 || item.expectedLines > 50)) {
    issue(diagnostics, "qti.extended-text.lines", `${path}/expectedLines`, "Expected lines must be an integer from 1 through 50.");
  }
};

export const validateQtiCompanionModel = (candidate: unknown): QtiValidationResult => {
  const diagnostics: QtiValidationDiagnostic[] = [];
  if (!candidate || typeof candidate !== "object") {
    return { ok: false, diagnostics: [{ code: "qti.model.object", path: "/", message: "QTI companion model must be an object." }] };
  }
  const value = candidate as Partial<QtiCompanionModel>;
  rejectUnknownKeys(
    value as Record<string, unknown>,
    ["schema", "schemaVersion", "profile", "id", "title", "instructions", "sourceAssessmentRef", "associatedActivity", "items", "assets", "limitations"],
    "",
    diagnostics,
  );
  if (value.schema !== "causalyst.qti-companion-model" || value.schemaVersion !== "1.0" || value.profile !== "qti22-companion") {
    issue(diagnostics, "qti.model.version", "/", "Only causalyst.qti-companion-model 1.0 with qti22-companion is supported.");
  }
  if (!safeIdentifier.test(value.id ?? "")) issue(diagnostics, "qti.model.id", "/id", "Model ID must be a portable XML identifier.");
  validateText(value.title, "/title", diagnostics);
  validateText(value.instructions, "/instructions", diagnostics);
  validateText(value.associatedActivity?.label, "/associatedActivity/label", diagnostics);
  if (value.associatedActivity?.href !== undefined && !/^https:\/\/[^\s]+$/.test(value.associatedActivity.href)) {
    issue(diagnostics, "qti.activity.href", "/associatedActivity/href", "Activity links must use HTTPS.");
  }
  if (!value.sourceAssessmentRef?.id || !value.sourceAssessmentRef.version) {
    issue(diagnostics, "qti.model.assessment-ref", "/sourceAssessmentRef", "A version-pinned source assessment reference is required.");
  }
  const assets = Array.isArray(value.assets) ? value.assets : [];
  const assetIds = new Set<string>();
  const assetFiles = new Set<string>();
  assets.forEach((assetCandidate, index) => {
    const path = `/assets/${index}`;
    if (!isRecord(assetCandidate)) {
      issue(diagnostics, "qti.asset.object", path, "Each asset must be an object.");
      return;
    }
    const asset = assetCandidate as unknown as QtiCompanionModel["assets"][number];
    rejectUnknownKeys(asset as unknown as Record<string, unknown>, ["id", "fileName", "mediaType", "contentBase64", "alternativeText"], path, diagnostics);
    if (!safeIdentifier.test(asset.id)) issue(diagnostics, "qti.asset.id", `${path}/id`, "Asset IDs must be portable XML identifiers.");
    if (assetIds.has(asset.id)) issue(diagnostics, "qti.asset.duplicate", `${path}/id`, "Asset IDs must be unique.");
    assetIds.add(asset.id);
    if (!safeFileName.test(asset.fileName) || asset.fileName.includes("..")) issue(diagnostics, "qti.asset.path", `${path}/fileName`, "Asset file names must be flat and portable.");
    if (assetFiles.has(asset.fileName.toLowerCase())) issue(diagnostics, "qti.asset.file-duplicate", `${path}/fileName`, "Asset file names must be unique.");
    assetFiles.add(asset.fileName.toLowerCase());
    if (!["image/png", "image/jpeg"].includes(asset.mediaType)) issue(diagnostics, "qti.asset.media-type", `${path}/mediaType`, "Only PNG and JPEG assets are supported.");
    if (!asset.contentBase64 || !base64.test(asset.contentBase64)) issue(diagnostics, "qti.asset.base64", `${path}/contentBase64`, "Asset bytes must use non-empty canonical base64.");
    else validateAssetBytes(asset.contentBase64, asset.mediaType, `${path}/contentBase64`, diagnostics);
    validateText(asset.alternativeText, `${path}/alternativeText`, diagnostics);
  });
  const items = Array.isArray(value.items) ? value.items : [];
  if (items.length === 0) issue(diagnostics, "qti.item.minimum", "/items", "At least one companion item is required.");
  const itemIds = new Set<string>();
  items.forEach((itemCandidate, index) => {
    if (!isRecord(itemCandidate)) {
      issue(diagnostics, "qti.item.object", `/items/${index}`, "Each item must be an object.");
      return;
    }
    if (!["single-choice", "multiple-response", "numeric-response", "extended-text"].includes(String(itemCandidate.type))) {
      issue(diagnostics, "qti.item.type", `/items/${index}/type`, "Item type is unsupported.");
      return;
    }
    const item = itemCandidate as unknown as QtiCompanionItem;
    if (itemIds.has(item.id)) issue(diagnostics, "qti.item.duplicate", `/items/${index}/id`, "Item IDs must be unique.");
    itemIds.add(item.id);
    validateItem(item, `/items/${index}`, assetIds, diagnostics);
  });
  assetIds.forEach((id) => {
    if (itemIds.has(id)) issue(diagnostics, "qti.resource.id-collision", "/assets", `Asset and item IDs collide at ${id}.`);
  });
  if (!Array.isArray(value.limitations) || value.limitations.length === 0) {
    issue(diagnostics, "qti.model.limitations", "/limitations", "At least one explicit limitation is required.");
  } else value.limitations.forEach((limitation, index) => validateText(limitation, `/limitations/${index}`, diagnostics));
  findForbiddenArtifactData(value).forEach((entry) => issue(diagnostics, entry.code, entry.path, entry.message));
  if (diagnostics.length > 0) return { ok: false, diagnostics: diagnostics.sort((a, b) => a.path.localeCompare(b.path) || a.code.localeCompare(b.code)) };
  return { ok: true, value: structuredClone(value as QtiCompanionModel), diagnostics: [] };
};
