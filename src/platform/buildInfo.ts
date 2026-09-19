const valueOr = (value: string | undefined, fallback: string): string => {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
};

const buildFlags = Object.freeze({
  studioCoreV1: import.meta.env.VITE_STUDIO_CORE_V1 === "true",
  assayStudioV1: import.meta.env.VITE_ASSAY_STUDIO_V1 === "true",
  assayImageImportV1: import.meta.env.VITE_ASSAY_IMAGE_IMPORT_V1 === "true",
  causalystLocalV1: import.meta.env.VITE_CAUSALYST_LOCAL_V1 === "true",
  causalystPromptBuildV1: import.meta.env.VITE_CAUSALYST_PROMPT_BUILD_V1 === "true",
  causalystLtiV1: import.meta.env.VITE_CAUSALYST_LTI_V1 === "true",
  causalystAgsV1: import.meta.env.VITE_CAUSALYST_AGS_V1 === "true",
  causalystQtiExportV1: import.meta.env.VITE_CAUSALYST_QTI_EXPORT_V1 === "true",
});

export const labStudioBuildInfo = Object.freeze({
  buildId: valueOr(import.meta.env.VITE_LAB_STUDIO_BUILD_ID, "development-unbuilt"),
  sourceCommit: valueOr(import.meta.env.VITE_LAB_STUDIO_BUILD_SOURCE_COMMIT, "uncommitted"),
  buildTimestamp: valueOr(import.meta.env.VITE_LAB_STUDIO_BUILD_TIMESTAMP, "not-recorded"),
  featureProfile: valueOr(import.meta.env.VITE_LAB_STUDIO_BUILD_FEATURE_PROFILE, "development"),
  flags: buildFlags,
});

export const buildIdentityLabel = labStudioBuildInfo.buildId === "development-unbuilt"
  ? "Development build"
  : "Item 3 local";
