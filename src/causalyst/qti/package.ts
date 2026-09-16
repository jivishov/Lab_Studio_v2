import { serializeArtifactPackage } from "../../platform/artifacts/canonical";
import type { CausalystAssessmentDefinition } from "../domain";
import { validateCausalystAssessment } from "../domain/validation";
import { serializeQti22Item, serializeQti22Manifest, serializeQti22Test } from "./qti22";
import type {
  QtiCompanionModel,
  QtiCompanionPackage,
  QtiPackageFile,
  QtiPackageReport,
} from "./types";
import { validateQtiCompanionModel } from "./validation";
import { qtiXmlSecurityDiagnostics } from "./xml";
import { createStoredZip } from "./zip";

const encoder = new TextEncoder();
const textFile = (path: string, mediaType: string, content: string): QtiPackageFile => ({
  path,
  mediaType,
  content: encoder.encode(content),
});
const fromBase64 = (value: string): Uint8Array => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

export const createDefaultQtiCompanionModel = (
  assessment: CausalystAssessmentDefinition,
  associatedActivity: QtiCompanionModel["associatedActivity"],
): QtiCompanionModel => {
  const items: QtiCompanionModel["items"] = [];
  if (assessment.runPolicy.requirePredictionBeforeRun) {
    items.push({
      id: "prediction",
      type: "extended-text",
      title: "Prediction",
      prompt: "Record your prediction before completing the associated Causalyst activity.",
      required: true,
      staticAssetRefs: [],
      expectedLines: 5,
    });
  }
  assessment.explanationPrompts.forEach((prompt, index) => items.push({
    id: `explanation-${index + 1}`,
    type: "extended-text",
    title: `Explanation ${index + 1}`,
    prompt: prompt.prompt,
    required: prompt.required,
    staticAssetRefs: [],
    expectedLines: 8,
    rubricReference: prompt.evidenceSelectorIds.join(", "),
  }));
  return {
    schema: "causalyst.qti-companion-model",
    schemaVersion: "1.0",
    profile: "qti22-companion",
    id: `${assessment.id}.companion`,
    title: `${assessment.title} companion`,
    instructions: `${assessment.instructions} Complete the executable activity in Causalyst; this QTI package contains companion prompts only.`,
    sourceAssessmentRef: { id: assessment.id, version: assessment.metadata.version },
    associatedActivity,
    items,
    assets: [],
    limitations: [
      "The executable Lab Studio or Assay Studio simulation is not embedded in this QTI package.",
      "Causalyst evidence, semantic traces, replay, rubric review, and teacher-approved AGS remain in Causalyst.",
      "No universal LMS portability claim is made.",
    ],
  };
};

export const buildQti22CompanionPackage = (
  assessment: CausalystAssessmentDefinition,
  modelCandidate: unknown,
  input: { generatedAt: string },
): QtiCompanionPackage => {
  const assessmentValidation = validateCausalystAssessment(assessment);
  if (!assessmentValidation.ok) throw new Error("QTI export requires a valid Causalyst assessment.");
  const modelValidation = validateQtiCompanionModel(modelCandidate);
  if (!modelValidation.ok) throw new Error(modelValidation.diagnostics.map(({ path, message }) => `${path}: ${message}`).join("\n"));
  const model = modelValidation.value;
  if (model.sourceAssessmentRef.id !== assessment.id || model.sourceAssessmentRef.version !== assessment.metadata.version) {
    throw new Error("QTI model source assessment reference does not match the validated assessment.");
  }
  if (!Number.isFinite(Date.parse(input.generatedAt))) throw new Error("generatedAt must be an ISO-8601 timestamp.");

  const manifest = serializeQti22Manifest(model);
  const test = serializeQti22Test(model);
  const itemFiles = model.items.map((item) => textFile(
    `items/${item.id}.xml`,
    "application/xml",
    serializeQti22Item(item, model.assets, { ...model.associatedActivity, instructions: model.instructions }),
  ));
  const xmlFiles = [textFile("imsmanifest.xml", "application/xml", manifest), textFile("assessment.xml", "application/xml", test), ...itemFiles];
  const xmlDiagnostics = xmlFiles.flatMap((file) => qtiXmlSecurityDiagnostics(new TextDecoder().decode(file.content)).map((code) => `${file.path}:${code}`));
  if (xmlDiagnostics.length > 0) throw new Error(`Unsafe or malformed generated XML: ${xmlDiagnostics.join(", ")}`);
  const assetFiles = model.assets.map((asset) => ({
    path: `assets/${asset.fileName}`,
    mediaType: asset.mediaType,
    content: fromBase64(asset.contentBase64),
  }));
  const report: QtiPackageReport = {
    schema: "causalyst.qti-package-report",
    schemaVersion: "1.0",
    profile: "qti22-companion",
    sourceAssessmentRef: structuredClone(model.sourceAssessmentRef),
    generatedAt: input.generatedAt,
    structuralValidation: {
      status: "passed",
      checks: [
        "version-neutral companion model validated",
        "QTI 2.2 manifest, test, and item references are internally complete",
        "item and resource identifiers are unique",
        "asset paths are flat, relative, and complete",
        "XML is generated through escaping and contains no DTD, entities, scripts, or absolute local paths",
        "ZIP paths are deterministic and traversal-free",
        "every image asset has non-empty alternative text",
      ],
    },
    targetProfile: "1EdTech QTI 2.2 standard-item companion",
    targetLms: {
      name: null,
      importStatus: "not-run",
      reason: "No named LMS import was executed under the repository validation policy.",
    },
    independentValidator: {
      name: null,
      status: "not-run",
      reason: "No independent QTI validator was executed under the repository validation policy.",
    },
    simulationEmbedding: "not-included",
    releaseDecision: "disabled-pending-interoperability-validation",
    unsupportedFeatures: [
      "QTI custom interactions",
      "embedded or replayable Lab Studio/Assay Studio simulation",
      "portable Causalyst evidence bundle, semantic trace, replay, or teacher review",
      "QTI 3.0 serialization",
      "file-upload interaction",
      "automatic or model-final scoring",
    ],
    limitations: [...model.limitations],
  };
  const reportFile = textFile("package-report.json", "application/json", serializeArtifactPackage(report));
  const files = [...xmlFiles, ...assetFiles, reportFile].sort((left, right) => left.path.localeCompare(right.path));
  return { profile: "qti22-companion", files, report, zip: createStoredZip(files) };
};
