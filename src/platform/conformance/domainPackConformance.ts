import { validateCapabilityManifestFragment } from "../capabilities/validation";
import { validateDomainPackDescriptor } from "../domain-packs/schema";
import type {
  ArtifactPackageContext,
  ComposeArtifactRequest,
  RunContext,
  StudioDomainPack,
  VersionedStudioArtifact,
} from "../domain-packs/types";
import { coreEvidenceRegistryFragment } from "../evidence/coreRegistry";
import { createEvidenceRegistry } from "../evidence/registry";
import { validateEvidenceRegistryFragmentSchema } from "../evidence/schema";
import { validateStudioArtifactPackage } from "../artifacts/schema";
import { validateResourceRunPlan } from "../planning/schema";

export interface DomainPackConformanceAssertion {
  id: string;
  passed: boolean;
  message: string;
}

export interface DomainPackComposeConformanceCase<TConstraintExtension = unknown> {
  id: string;
  request: ComposeArtifactRequest<TConstraintExtension>;
  expected: "success" | "failure";
  expectedGapCode?: string;
}

export interface DomainPackInvalidArtifactCase {
  id: string;
  artifact: unknown;
  expectedDiagnosticCode: string;
}

export interface DomainPackConformanceOptions<
  TArtifact extends VersionedStudioArtifact,
  TValidationContext,
  TConstraintExtension = unknown,
> {
  validationContext: TValidationContext | ((artifact: TArtifact) => TValidationContext);
  runContext: RunContext;
  packageContext: ArtifactPackageContext;
  composeCases: readonly DomainPackComposeConformanceCase<TConstraintExtension>[];
  invalidArtifactCases: readonly DomainPackInvalidArtifactCase[];
}

export interface DomainPackConformanceReport {
  domainPackId: string;
  domainPackVersion: string;
  passed: boolean;
  assertions: DomainPackConformanceAssertion[];
}

const sortedJsonValue = (value: unknown): unknown => {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortedJsonValue);
  return Object.fromEntries(
    Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => [key, sortedJsonValue((value as Record<string, unknown>)[key])]),
  );
};

const stableJson = (value: unknown): string => JSON.stringify(sortedJsonValue(value));

const resolveValidationContext = <TArtifact, TValidationContext>(
  context: TValidationContext | ((artifact: TArtifact) => TValidationContext),
  artifact: TArtifact,
): TValidationContext => typeof context === "function"
  ? (context as (value: TArtifact) => TValidationContext)(artifact)
  : context;

const forbiddenPackageKeys = new Set([
  "assetpath",
  "assethash",
  "generatedassetpath",
  "filepath",
  "localpath",
  "fileid",
  "providerfileid",
  "remotefileid",
  "vendorfileid",
  "sha256",
  "hash",
  "credentials",
  "credential",
  "apikey",
  "secret",
  "password",
  "authorization",
  "cookie",
  "chainofthought",
  "hiddenreasoning",
  "reasoningtrace",
  "runtimestate",
  "rawruntimestate",
  "providerresponse",
  "rawresponse",
]);
const localPathPattern = /^(?:[A-Za-z]:[\\/]|\\\\|file:\/\/|\/(?:Users|home|var|tmp|private|etc|opt|srv|mnt|Volumes)(?:\/|$))/i;
const normalizeKey = (key: string): string => key.replace(/[-_\s]/g, "").toLowerCase();

export const findConformancePackageLeaks = (input: unknown): string[] => {
  const leaks: string[] = [];
  const visit = (value: unknown, path: string): void => {
    if (typeof value === "string") {
      if (localPathPattern.test(value)) leaks.push(`${path || "/"} contains a local path.`);
      return;
    }
    if (value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((child, index) => visit(child, `${path}/${index}`));
      return;
    }
    Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
      const childPath = `${path}/${key}`;
      if (forbiddenPackageKeys.has(normalizeKey(key))) {
        leaks.push(`${childPath} is forbidden in artifact packages.`);
      }
      visit(child, childPath);
    });
  };
  visit(input, "");
  return leaks.sort();
};

export const runDomainPackConformance = <
  TArtifact extends VersionedStudioArtifact,
  TValidationContext,
  TRunPlanExtension = unknown,
  TConstraintExtension = unknown,
>(
  pack: StudioDomainPack<TArtifact, TValidationContext, TRunPlanExtension, TConstraintExtension>,
  options: DomainPackConformanceOptions<TArtifact, TValidationContext, TConstraintExtension>,
): DomainPackConformanceReport => {
  const assertions: DomainPackConformanceAssertion[] = [];
  const check = (id: string, test: () => boolean, message: string): void => {
    try {
      const passed = test();
      assertions.push({ id, passed, message: passed ? "Passed." : message });
    } catch (error) {
      assertions.push({
        id,
        passed: false,
        message: error instanceof Error ? error.message : message,
      });
    }
  };

  check(
    "descriptor.valid",
    () => validateDomainPackDescriptor(pack.descriptor).ok,
    "Domain-pack descriptor validation failed.",
  );

  const evidenceFragment = pack.getEvidenceRegistryFragment();
  check(
    "evidence.fragment.valid",
    () => validateEvidenceRegistryFragmentSchema(evidenceFragment).ok,
    "Evidence registry fragment schema validation failed.",
  );
  const evidenceRegistry = createEvidenceRegistry(
    evidenceFragment.domainPackId === "core"
      ? [evidenceFragment]
      : [coreEvidenceRegistryFragment, evidenceFragment],
  );
  check(
    "capabilities.fragment.valid",
    () => validateCapabilityManifestFragment(pack.getCapabilityManifestFragment(), {
      evidenceTypeIds: evidenceRegistry.typeIds,
    }).ok,
    "Capability fragment or proof graph validation failed.",
  );

  check(
    "golden.ids.present",
    () => pack.conformance.goldenArtifactIds.length > 0,
    "At least one golden artifact is required.",
  );

  pack.conformance.goldenArtifactIds.forEach((id) => {
    const artifact = pack.conformance.getGoldenArtifact(id);
    check(
      `golden.${id}.resolves`,
      () => artifact !== undefined && artifact.id === id,
      `Golden artifact ${id} did not resolve with the same id.`,
    );
    if (!artifact) return;
    const context = resolveValidationContext(options.validationContext, artifact);
    const firstValidation = pack.validateArtifact(artifact, context);
    const secondValidation = pack.validateArtifact(artifact, context);
    check(
      `golden.${id}.validates`,
      () => firstValidation.ok,
      `Golden artifact ${id} did not validate.`,
    );
    check(
      `golden.${id}.validation-deterministic`,
      () => stableJson(firstValidation) === stableJson(secondValidation),
      `Golden artifact ${id} validation was not deterministic.`,
    );

    const firstPlan = pack.planRun(artifact, options.runContext);
    const secondPlan = pack.planRun(artifact, options.runContext);
    check(
      `golden.${id}.plan-deterministic`,
      () => stableJson(firstPlan) === stableJson(secondPlan) &&
        firstPlan.domainPackId === pack.descriptor.id,
      `Golden artifact ${id} run planning was not deterministic.`,
    );
    check(
      `golden.${id}.shared-plan-valid`,
      () => {
        const extension = firstPlan.extension;
        if (!extension || typeof extension !== "object") return false;
        const sharedPlan = (extension as Record<string, unknown>).plan;
        return validateResourceRunPlan(sharedPlan).ok;
      },
      `Golden artifact ${id} did not return a valid shared deterministic resource/run plan.`,
    );

    const firstPackage = pack.packageArtifact(artifact, options.packageContext);
    const secondPackage = pack.packageArtifact(artifact, options.packageContext);
    check(
      `golden.${id}.package-deterministic`,
      () => stableJson(firstPackage) === stableJson(secondPackage),
      `Golden artifact ${id} packaging was not deterministic.`,
    );
    check(
      `golden.${id}.package-sanitized`,
      () => findConformancePackageLeaks(firstPackage).length === 0,
      `Golden artifact ${id} package contains forbidden runtime or provider data.`,
    );
    check(
      `golden.${id}.package-valid`,
      () => validateStudioArtifactPackage(firstPackage).ok,
      `Golden artifact ${id} package failed the shared artifact-package schema.`,
    );
  });

  options.invalidArtifactCases.forEach((invalidCase) => {
    const report = pack.validateArtifact(
      invalidCase.artifact,
      resolveValidationContext(options.validationContext, invalidCase.artifact as TArtifact),
    );
    check(
      `artifact-negative.${invalidCase.id}`,
      () => !report.ok && report.diagnostics.some(
        (diagnostic) => diagnostic.code === invalidCase.expectedDiagnosticCode,
      ),
      `Invalid artifact ${invalidCase.id} did not return ${invalidCase.expectedDiagnosticCode}.`,
    );
  });

  options.composeCases.forEach((composeCase) => {
    const first = pack.composeArtifact(composeCase.request);
    const second = pack.composeArtifact(composeCase.request);
    check(
      `compose.${composeCase.id}.deterministic`,
      () => stableJson(first) === stableJson(second),
      `Compose case ${composeCase.id} was not deterministic.`,
    );
    check(
      `compose.${composeCase.id}.${composeCase.expected}`,
      () => composeCase.expected === "success"
        ? first.ok
        : !first.ok && (!composeCase.expectedGapCode || first.gaps.some(
          (gap) => gap.code === composeCase.expectedGapCode,
        )),
      `Compose case ${composeCase.id} did not produce the expected ${composeCase.expected} result.`,
    );
  });

  return {
    domainPackId: pack.descriptor.id,
    domainPackVersion: pack.descriptor.version,
    passed: assertions.every(({ passed }) => passed),
    assertions,
  };
};
