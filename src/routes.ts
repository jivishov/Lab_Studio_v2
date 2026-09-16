import {
  getStudioFeatureFlags,
  type StudioFeatureFlags,
} from "./platform/featureFlags";

export type AppRoute =
  | { name: "home" }
  | { name: "studio" }
  | { name: "labs" }
  | { name: "techniques" }
  | { name: "assays" }
  | { name: "assay-studio" }
  | { name: "assay"; assayId: string }
  | { name: "assay-results"; assayId: string }
  | { name: "causalyst" }
  | { name: "causalyst-author"; assessmentId?: string }
  | { name: "causalyst-preview"; assessmentId: string }
  | { name: "causalyst-attempt"; assessmentId: string }
  | { name: "causalyst-review"; submissionId: string }
  | { name: "causalyst-lti" }
  | { name: "play"; labId: string }
  | { name: "technique"; techniqueId: string }
  | { name: "case"; caseId: string }
  | { name: "trial"; trialId: string };

type RouteFeatureFlags = Pick<StudioFeatureFlags, "assayStudioV1" | "causalystLocalV1" | "causalystLtiV1">;

export const parseHashRoute = (
  hash: string,
  featureFlags: RouteFeatureFlags = getStudioFeatureFlags(),
): AppRoute => {
  const clean = hash.replace(/^#\/?/, "").split("?")[0];
  const [section, id] = clean.split("/");
  if (section === "studio") return { name: "studio" };
  if (section === "labs") return { name: "labs" };
  if (section === "techniques") return { name: "techniques" };
  if (featureFlags.assayStudioV1 && section === "assays") return { name: "assays" };
  if (featureFlags.assayStudioV1 && section === "assay-studio") return { name: "assay-studio" };
  if (featureFlags.assayStudioV1 && section === "assay" && id) {
    return { name: "assay", assayId: id };
  }
  if (featureFlags.assayStudioV1 && section === "assay-results" && id) {
    return { name: "assay-results", assayId: id };
  }
  if (featureFlags.causalystLocalV1 && section === "causalyst") return { name: "causalyst" };
  if (featureFlags.causalystLocalV1 && section === "causalyst-author") {
    return { name: "causalyst-author", ...(id ? { assessmentId: id } : {}) };
  }
  if (featureFlags.causalystLocalV1 && section === "causalyst-preview" && id) {
    return { name: "causalyst-preview", assessmentId: id };
  }
  if (featureFlags.causalystLocalV1 && section === "causalyst-attempt" && id) return { name: "causalyst-attempt", assessmentId: id };
  if (featureFlags.causalystLocalV1 && section === "causalyst-review" && id) return { name: "causalyst-review", submissionId: id };
  if (featureFlags.causalystLtiV1 && section === "causalyst-lti") return { name: "causalyst-lti" };
  if (section === "play" && id) return { name: "play", labId: id };
  if (section === "technique" && id) return { name: "technique", techniqueId: id };
  if (section === "case" && id) return { name: "case", caseId: id };
  if (section === "trial" && id) return { name: "trial", trialId: id };
  return { name: "home" };
};
