import {
  bundledLabSurfaces,
  bundledTechniqueSurface,
  BUNDLED_CATALOG_POLICY_FINAL_STRICT,
  evaluateBundledCatalogPolicy,
  evaluateCompiledBundledCatalogPolicy,
  type BundledCatalogAuthority,
  type BundledCatalogPolicyResult,
} from "../domain/bundledCatalogPolicy";
import type { LabCompositionSourceDefinition, LabDefinition, TechniqueDefinition } from "../domain/types";
import { BundleContentError } from "./bundleErrors";
import { sourceInstanceScopesFor } from "./collectCompiledWitnesses";
import { compileLabComposition } from "./compileLabComposition";
import type { TechniqueResolver } from "./hydrateBundledLab";

const describeRejections = (result: BundledCatalogPolicyResult): string[] => [
  ...result.blockingFindings.map((finding) =>
    `${finding.rule} ${finding.owner.artifact}#${finding.sourceActionId}: ${finding.detail}`,
  ),
  ...result.migrationIssues.map((issue) =>
    `bundled/migration-${issue.kind} ${issue.entryId}: ${issue.detail}`,
  ),
];

const requireAccepted = (
  subject: string,
  result: BundledCatalogPolicyResult,
): BundledCatalogPolicyResult => {
  if (result.evaluationMode !== BUNDLED_CATALOG_POLICY_FINAL_STRICT) {
    throw new BundleContentError(
      `Bundled catalog policy boundary requires final-strict evaluation; received ${result.evaluationMode}.`,
    );
  }
  if (!result.accepted) {
    throw new BundleContentError(
      `Bundled catalog policy rejected ${subject}:\n${describeRejections(result).join("\n")}`,
    );
  }
  return result;
};

/**
 * Explicit authority boundary for indexed public assets and their named fixture fallback. Generic
 * validators, Studio import/export, and arbitrary hydration deliberately do not call this module.
 */
export const assessBundledTechniqueCatalogPolicy = async (
  authority: BundledCatalogAuthority,
  artifact: string,
  technique: TechniqueDefinition,
  fixture = false,
): Promise<BundledCatalogPolicyResult> => requireAccepted(
  artifact,
  await evaluateBundledCatalogPolicy([
    bundledTechniqueSurface(
      authority,
      artifact,
      technique,
      fixture ? "fixture-technique" : "technique",
    ),
  ], { mode: BUNDLED_CATALOG_POLICY_FINAL_STRICT }),
);

export const assessBundledLabCatalogPolicy = async (
  authority: BundledCatalogAuthority,
  artifact: string,
  lab: Pick<LabDefinition, "id" | "actions" | "techniques" | "process">,
  fixture = false,
): Promise<BundledCatalogPolicyResult> => requireAccepted(
  artifact,
  await evaluateBundledCatalogPolicy(
    bundledLabSurfaces(authority, artifact, lab, fixture),
    { mode: BUNDLED_CATALOG_POLICY_FINAL_STRICT },
  ),
);

/**
 * The runtime bundled-composition seam. Raw template policy is checked against the immutable
 * catalog source, while mass references deferred through `{{config.*}}` are checked again against
 * the exact configured compile returned to the caller. Generic compiler and hydration callers do
 * not pass through this boundary and retain their legacy readability contract.
 */
export const compileBundledLabCompositionWithPolicy = async (input: {
  authority: BundledCatalogAuthority;
  artifact: string;
  catalogSource: LabCompositionSourceDefinition;
  compilationSource?: LabCompositionSourceDefinition;
  resolveTechnique: TechniqueResolver;
  witnessId?: string;
}): Promise<LabDefinition> => {
  await assessBundledLabCatalogPolicy(
    input.authority,
    input.artifact,
    input.catalogSource,
    input.authority === "fixture-fallback",
  );

  const effectiveSource = input.compilationSource ?? input.catalogSource;
  const resolvedTechniques = new Map<string, TechniqueDefinition>();
  const resolveAndRecord: TechniqueResolver = async (techniqueId) => {
    const technique = await input.resolveTechnique(techniqueId);
    resolvedTechniques.set(`${technique.id}@${technique.metadata.version}`, technique);
    return technique;
  };
  const compiled = await compileLabComposition(
    effectiveSource,
    resolveAndRecord,
    input.witnessId ? { witnessId: input.witnessId } : {},
  );
  const manifest = compiled.compositionManifest;
  const effectiveWitnessId = input.witnessId ?? effectiveSource.reachabilityWitnesses[0]?.id;
  if (!manifest || manifest.status !== "compiled" || !effectiveWitnessId) {
    throw new BundleContentError(
      `Bundled composition "${input.artifact}" did not emit a compiled manifest with an exact witness identity.`,
    );
  }
  const findings = await evaluateCompiledBundledCatalogPolicy({
    source: effectiveSource,
    collection: {
      sourceInstanceScopes: sourceInstanceScopesFor(effectiveSource),
      attempts: [{
        status: "compiled",
        effectiveWitnessId,
        compiled,
        manifest,
      }],
    },
    techniques: [...resolvedTechniques.values()],
  });
  if (findings.length > 0) {
    throw new BundleContentError(
      `Bundled compiled catalog policy rejected ${input.artifact}:\n${findings.map((finding) =>
        `${finding.rule} ${finding.context.compiledActionId}: ${finding.detail}`,
      ).join("\n")}`,
    );
  }
  return compiled;
};
