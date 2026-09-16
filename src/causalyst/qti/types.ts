export const qtiCompanionModelSchema = "causalyst.qti-companion-model" as const;
export const qtiCompanionModelSchemaVersion = "1.0" as const;
export const qtiPackageReportSchema = "causalyst.qti-package-report" as const;
export const qtiPackageReportSchemaVersion = "1.0" as const;

export interface QtiChoice {
  id: string;
  label: string;
}

interface QtiCompanionItemBase {
  id: string;
  title: string;
  prompt: string;
  required: boolean;
  staticAssetRefs: string[];
}

export interface QtiSingleChoiceItem extends QtiCompanionItemBase {
  type: "single-choice";
  choices: QtiChoice[];
  correctChoiceId: string;
}

export interface QtiMultipleResponseItem extends QtiCompanionItemBase {
  type: "multiple-response";
  choices: QtiChoice[];
  correctChoiceIds: string[];
  minimumChoices: number;
  maximumChoices: number;
}

export interface QtiNumericResponseItem extends QtiCompanionItemBase {
  type: "numeric-response";
  correctResponse: string;
  tolerance: string;
  unitLabel?: string;
}

export interface QtiExtendedTextItem extends QtiCompanionItemBase {
  type: "extended-text";
  expectedLines: number;
  rubricReference?: string;
}

export type QtiCompanionItem =
  | QtiSingleChoiceItem
  | QtiMultipleResponseItem
  | QtiNumericResponseItem
  | QtiExtendedTextItem;

export interface QtiStaticAsset {
  id: string;
  fileName: string;
  mediaType: "image/png" | "image/jpeg";
  contentBase64: string;
  alternativeText: string;
}

export interface QtiCompanionModel {
  schema: typeof qtiCompanionModelSchema;
  schemaVersion: typeof qtiCompanionModelSchemaVersion;
  profile: "qti22-companion";
  id: string;
  title: string;
  instructions: string;
  sourceAssessmentRef: {
    id: string;
    version: string;
  };
  associatedActivity: {
    label: string;
    href?: string;
  };
  items: QtiCompanionItem[];
  assets: QtiStaticAsset[];
  limitations: string[];
}

export interface QtiPackageReport {
  schema: typeof qtiPackageReportSchema;
  schemaVersion: typeof qtiPackageReportSchemaVersion;
  profile: "qti22-companion";
  sourceAssessmentRef: {
    id: string;
    version: string;
  };
  generatedAt: string;
  structuralValidation: {
    status: "passed";
    checks: string[];
  };
  targetProfile: "1EdTech QTI 2.2 standard-item companion";
  targetLms: {
    name: null;
    importStatus: "not-run";
    reason: string;
  };
  independentValidator: {
    name: null;
    status: "not-run";
    reason: string;
  };
  simulationEmbedding: "not-included";
  releaseDecision: "disabled-pending-interoperability-validation";
  unsupportedFeatures: string[];
  limitations: string[];
}

export interface QtiPackageFile {
  path: string;
  mediaType: string;
  content: Uint8Array;
}

export interface QtiCompanionPackage {
  profile: "qti22-companion";
  files: QtiPackageFile[];
  report: QtiPackageReport;
  zip: Uint8Array;
}
