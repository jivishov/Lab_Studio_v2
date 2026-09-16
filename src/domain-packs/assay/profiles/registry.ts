import { findForbiddenArtifactData } from "../../../platform/artifacts/security";
import { canonicalSerializeJson } from "../../../platform/procedure-ir/canonical";
import type { ContractDiagnostic, ContractValidationResult } from "../../../platform/validation/jsonSchema";
import { validateAssayProtocolProfileSchema } from "./schema";
import type { AssayAnalysisExpression, AssayProtocolProfile } from "./types";

const xttActivity: AssayAnalysisExpression = {
  type: "multiply",
  left: {
    type: "divide",
    left: { type: "subtract", left: { type: "input", input: "observed" }, right: { type: "input", input: "blankMean" } },
    right: { type: "subtract", left: { type: "input", input: "referenceMean" }, right: { type: "input", input: "blankMean" } },
  },
  right: { type: "constant", value: "100" },
};

export const xttMetabolicActivityProfile: AssayProtocolProfile = {
  schema: "assay-studio.protocol-profile",
  schemaVersion: "1.0",
  id: "assay.profile.xtt-metabolic-activity",
  version: "1.0.0",
  title: "XTT metabolic-activity normalization",
  workflow: "xtt-metabolic-activity",
  useBoundary: "education",
  sourceReferences: [{
    id: "nih-agm-cell-viability",
    title: "Assay Guidance Manual: Cell Viability Assays",
    organization: "NCBI Bookshelf / Assay Guidance Manual",
    url: "https://www.ncbi.nlm.nih.gov/books/NBK144065/",
    versionOrAccessDate: "accessed 2026-07-26",
    supports: [
      "Tetrazolium-reduction assays report metabolic activity associated with viable cells.",
      "Assay conditions, controls, signal range, and interference must be protocol-specific.",
    ],
  }],
  requiredControls: [
    { role: "blank", minimumCount: 1, expectedSignal: "low" },
    { role: "positiveControl", minimumCount: 1, expectedSignal: "high" },
  ],
  readouts: [{
    id: "xtt-signal",
    label: "Protocol-supplied XTT signal",
    kind: "continuous-signal",
    allowedUnits: ["AU", "absorbance", "image-intensity"],
    allowedSourceTypes: ["instrument-export", "image-derived", "manual", "synthetic"],
    channelRequirement: "required",
    interpretation: "A protocol-dependent signal associated with metabolic activity; it is not a direct cell count.",
  }],
  blankControlRole: "blank",
  referenceControlRole: "positiveControl",
  metricRules: [
    {
      id: "percent-metabolic-activity",
      label: "Percent metabolic activity",
      unit: "%",
      expression: xttActivity,
      interpretation: "Blank-corrected signal relative to the profile-selected reference control.",
    },
    {
      id: "percent-metabolic-inhibition",
      label: "Percent metabolic inhibition",
      unit: "%",
      expression: {
        type: "subtract",
        left: { type: "constant", value: "100" },
        right: xttActivity,
      },
      interpretation: "One hundred minus protocol-normalized metabolic activity.",
    },
  ],
  endpointRules: [],
  roundingPolicy: { mode: "round", decimalPlaces: 4, tieBreaking: "half-even" },
  validityRange: [
    "Only reviewed observations from one explicitly selected channel and unit.",
    "The supplying protocol must declare wavelength or image channel, incubation, reagent conditions, control design, and usable signal range.",
  ],
  materialDefaults: [
    { resourceClass: "reagent", label: "XTT reagent system", quantityStatus: "protocol-supplied-required", note: "No reagent amount or incubation default is bundled." },
    { resourceClass: "instrument", label: "Compatible readout instrument or reviewed image method", quantityStatus: "protocol-supplied-required", note: "The active protocol must supply readout settings." },
  ],
  limitations: [
    "XTT output is a protocol-dependent metabolic-activity proxy, not a direct cell count.",
    "No universal wavelength, incubation time, signal threshold, linear range, or acceptance criterion is bundled.",
    "Image-derived intensity remains distinguishable from instrument-exported signal and is not automatically equivalent to absorbance.",
    "The profile is educational and non-clinical; it supplies no diagnosis or treatment advice.",
  ],
};

export const educationalBrothMicrodilutionProfile: AssayProtocolProfile = {
  schema: "assay-studio.protocol-profile",
  schemaVersion: "1.0",
  id: "assay.profile.educational-broth-microdilution",
  version: "1.0.0",
  title: "Educational broth-microdilution endpoint",
  workflow: "broth-microdilution",
  useBoundary: "education",
  sourceReferences: [{
    id: "eucast-mic-methodology",
    title: "EUCAST reading guide for broth microdilution",
    organization: "EUCAST",
    url: "https://www.eucast.org/fileadmin/eucast/pdf/MIC/Reading_guide_BMD_v_5.0_2024.pdf",
    versionOrAccessDate: "version 5.0, January 2024; accessed 2026-07-26",
    supports: [
      "Broth microdilution validity requires a satisfactory positive growth control.",
      "The standard endpoint is the lowest tested concentration that completely inhibits visible growth, with method-specific exceptions.",
    ],
  }],
  requiredControls: [
    { role: "growthControl", minimumCount: 1, expectedSignal: "growth" },
    { role: "sterilityControl", minimumCount: 1, expectedSignal: "no-growth" },
  ],
  readouts: [{
    id: "binary-growth-readout",
    label: "Reviewed binary growth observation",
    kind: "binary-growth",
    allowedUnits: ["binary-growth"],
    allowedSourceTypes: ["instrument-export", "image-derived", "manual", "synthetic"],
    channelRequirement: "optional",
    interpretation: "Profile-coded 1 means growth and 0 means no growth after explicit review.",
  }],
  metricRules: [],
  endpointRules: [{
    id: "lowest-reviewed-no-growth",
    type: "lowest-no-growth-concentration",
    concentrationComponentRef: "test-compound",
    growthValue: "1",
    noGrowthValue: "0",
    terminology: "profile-bound educational MIC endpoint (non-clinical)",
    requireMonotonic: true,
  }],
  roundingPolicy: { mode: "round", decimalPlaces: 6, tieBreaking: "half-even" },
  validityRange: [
    "Only the explicitly authored concentration component and reviewed binary-growth readout are interpreted.",
    "The supplying protocol must define organism/sample, medium, inoculum, incubation, concentration series, and endpoint reading conditions.",
  ],
  materialDefaults: [
    { resourceClass: "reagent", label: "Protocol-defined broth, compound, and sample inputs", quantityStatus: "protocol-supplied-required", note: "No organism, drug, medium, inoculum, or amount is selected automatically." },
    { resourceClass: "consumable", label: "Broth-microdilution plate and consumables", quantityStatus: "protocol-supplied-required", note: "Planning requires explicit quantities and dead-volume policy." },
  ],
  limitations: [
    "This profile does not claim ISO, CLSI, or EUCAST conformity; the citation supports the bounded endpoint concept only.",
    "No clinical breakpoint, susceptibility category, species/drug selection, treatment advice, or safety certification is included.",
    "Invalid controls, conflicting replicates, missing concentrations, or non-monotonic outcomes make the endpoint indeterminate.",
    "Image-derived observations require explicit review and remain labeled by source.",
  ],
};

const error = (code: string, path: string, message: string): ContractDiagnostic => ({
  code, path, message, severity: "error",
});

export const validateAssayProtocolProfile = (
  input: unknown,
): ContractValidationResult<AssayProtocolProfile> => {
  const schema = validateAssayProtocolProfileSchema(input);
  if (!schema.ok) return schema;
  const profile = schema.value;
  const diagnostics: ContractDiagnostic[] = [...findForbiddenArtifactData(profile)];
  const unique = (values: string[], path: string, code: string) => {
    const seen = new Set<string>();
    values.forEach((value, index) => {
      if (seen.has(value)) diagnostics.push(error(code, `${path}/${index}`, `Duplicate id ${value}.`));
      seen.add(value);
    });
  };
  unique(profile.sourceReferences.map(({ id }) => id), "/sourceReferences", "assay.profile.source.duplicate");
  unique(profile.readouts.map(({ id }) => id), "/readouts", "assay.profile.readout.duplicate");
  unique(profile.metricRules.map(({ id }) => id), "/metricRules", "assay.profile.metric.duplicate");
  unique(profile.endpointRules.map(({ id }) => id), "/endpointRules", "assay.profile.endpoint.duplicate");
  const metricIds = new Set(profile.metricRules.map(({ id }) => id));
  profile.endpointRules.forEach((rule, index) => {
    if (rule.type === "lowest-metric-threshold-concentration" && !metricIds.has(rule.metricRuleRef)) {
      diagnostics.push(error("assay.profile.endpoint.metric-missing", `/endpointRules/${index}/metricRuleRef`, `Missing metric rule ${rule.metricRuleRef}.`));
    }
  });
  if (profile.workflow === "xtt-metabolic-activity" && (!profile.blankControlRole || !profile.referenceControlRole)) {
    diagnostics.push(error("assay.profile.xtt.controls-required", "/", "XTT profiles require explicit blank and reference control roles."));
  }
  diagnostics.sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code));
  return diagnostics.length ? { ok: false, diagnostics } : { ok: true, value: profile, diagnostics: [] };
};

const profiles = [xttMetabolicActivityProfile, educationalBrothMicrodilutionProfile] as const;
profiles.forEach((profile) => {
  const validation = validateAssayProtocolProfile(profile);
  if (!validation.ok) throw new Error(`Invalid checked assay profile ${profile.id}: ${JSON.stringify(validation.diagnostics)}`);
});

export const listAssayProtocolProfiles = (): AssayProtocolProfile[] =>
  profiles.map((profile) => structuredClone(profile));

export const resolveAssayProtocolProfile = (id: string, version: string): AssayProtocolProfile => {
  const profile = profiles.find((candidate) => candidate.id === id && candidate.version === version);
  if (!profile) throw new Error(`Assay protocol profile ${id}@${version} is not registered.`);
  return structuredClone(profile);
};

export const serializeAssayProtocolProfile = (input: unknown): string => {
  const validation = validateAssayProtocolProfile(input);
  if (!validation.ok) throw new Error(JSON.stringify(validation.diagnostics));
  return canonicalSerializeJson(validation.value);
};
