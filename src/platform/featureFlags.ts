export const studioFeatureFlagDefaults = Object.freeze({
  studioCoreV1: false,
  assayStudioV1: false,
  assayImageImportV1: false,
  causalystLocalV1: false,
  causalystPromptBuildV1: false,
  causalystLtiV1: false,
  causalystAgsV1: false,
  causalystQtiExportV1: false,
} as const);

export type StudioFeatureFlag = keyof typeof studioFeatureFlagDefaults;
export type StudioFeatureFlags = Readonly<Record<StudioFeatureFlag, boolean>>;

export const studioFeatureFlagEnvVariables = Object.freeze({
  studioCoreV1: "VITE_STUDIO_CORE_V1",
  assayStudioV1: "VITE_ASSAY_STUDIO_V1",
  assayImageImportV1: "VITE_ASSAY_IMAGE_IMPORT_V1",
  causalystLocalV1: "VITE_CAUSALYST_LOCAL_V1",
  causalystPromptBuildV1: "VITE_CAUSALYST_PROMPT_BUILD_V1",
  causalystLtiV1: "VITE_CAUSALYST_LTI_V1",
  causalystAgsV1: "VITE_CAUSALYST_AGS_V1",
  causalystQtiExportV1: "VITE_CAUSALYST_QTI_EXPORT_V1",
} as const satisfies Readonly<Record<StudioFeatureFlag, string>>);

let testOverrides: Partial<StudioFeatureFlags> | undefined;

// Keep these property reads static so Vite can replace them in production
// builds. Dynamic `import.meta.env[key]` access is not build-time safe.
const readBuildTimeFeatureFlags = (): StudioFeatureFlags => ({
  studioCoreV1: import.meta.env.VITE_STUDIO_CORE_V1 === "true",
  assayStudioV1: import.meta.env.VITE_ASSAY_STUDIO_V1 === "true",
  assayImageImportV1: import.meta.env.VITE_ASSAY_IMAGE_IMPORT_V1 === "true",
  causalystLocalV1: import.meta.env.VITE_CAUSALYST_LOCAL_V1 === "true",
  causalystPromptBuildV1: import.meta.env.VITE_CAUSALYST_PROMPT_BUILD_V1 === "true",
  causalystLtiV1: import.meta.env.VITE_CAUSALYST_LTI_V1 === "true",
  causalystAgsV1: import.meta.env.VITE_CAUSALYST_AGS_V1 === "true",
  causalystQtiExportV1: import.meta.env.VITE_CAUSALYST_QTI_EXPORT_V1 === "true",
});

export const getStudioFeatureFlags = (): StudioFeatureFlags =>
  Object.freeze({
    ...studioFeatureFlagDefaults,
    ...readBuildTimeFeatureFlags(),
    ...(testOverrides ?? {}),
  });

export const isStudioFeatureEnabled = (flag: StudioFeatureFlag): boolean =>
  getStudioFeatureFlags()[flag];

/**
 * The sole runtime override path. Production flags are fixed by Vite at build
 * time; query strings and browser storage are not feature-flag inputs.
 */
export const setStudioFeatureFlagOverridesForTesting = (
  overrides?: Partial<StudioFeatureFlags>,
): void => {
  if (import.meta.env.MODE !== "test") {
    throw new Error("Studio feature flag overrides are available only in tests.");
  }
  testOverrides = overrides ? { ...overrides } : undefined;
};
