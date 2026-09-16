import type {
  CompositionManifest,
  RouteTechniqueExecutionAdapter,
  RouteTechniqueExecutionIntent,
  RouteTechniqueExecutionTarget,
} from "../../domain/types";

export type { RouteTechniqueExecutionAdapter };

/**
 * Static seam for the two specialized investigation routes. It deliberately does not execute a
 * technique or translate route-specific controls; Cycle 04 must map both real control inventories
 * before this provisional interface is frozen.
 */
export const validateRouteTechniqueExecutionIntent = (
  manifest: CompositionManifest | undefined,
  intent: RouteTechniqueExecutionIntent,
): string[] => {
  if (!manifest || manifest.status !== "compiled") {
    return ["Route execution requires a compiler-issued compiled composition manifest."];
  }
  const instance = manifest.instances.find((candidate) => candidate.instanceId === intent.instanceId);
  if (!instance) return [`Route intent references unknown technique instance "${intent.instanceId}".`];
  const origin = manifest.origins.find((candidate) =>
    candidate.instanceId === intent.instanceId && candidate.actionId === intent.actionId);
  return origin ? [] : [
    `Route intent action "${intent.actionId}" is not compiler-owned by instance "${intent.instanceId}".`,
  ];
};

export const validateRouteTechniqueExecutionTargets = (
  manifest: CompositionManifest | undefined,
  targets: readonly RouteTechniqueExecutionTarget[],
): string[] => targets.flatMap((target, index) => {
  const prefix = `Route sequence target ${index + 1}`;
  const intentErrors = validateRouteTechniqueExecutionIntent(manifest, target);
  if (intentErrors.length) return intentErrors.map((error) => `${prefix}: ${error}`);
  const origin = manifest!.origins.find((candidate) =>
    candidate.instanceId === target.instanceId && candidate.actionId === target.actionId);
  const instance = manifest!.instances.find((candidate) => candidate.instanceId === target.instanceId)!;
  const errors: string[] = [];
  if (origin?.techniqueId !== target.techniqueId || origin?.techniqueVersion !== target.techniqueVersion) {
    errors.push(`${prefix}: technique/version does not match the compiler-issued origin.`);
  }
  if (origin?.nodeId !== target.nodeId) errors.push(`${prefix}: nodeId does not match the compiler-issued origin.`);
  const availableEvidence = new Set(instance.evidenceOutputs.map((output) => output.id));
  for (const evidenceOutputId of target.evidenceOutputIds) {
    if (!availableEvidence.has(evidenceOutputId)) {
      errors.push(`${prefix}: evidence output "${evidenceOutputId}" is not compiler-issued by instance "${target.instanceId}".`);
    }
  }
  return errors;
});
