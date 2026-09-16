import type { DomainPackVersionRef, StudioDomainPackRegistry } from "./registry";
import type { DomainPackDescriptor, StudioDomainPackId } from "./types";

export interface DomainResolutionSignal {
  domainPackId: StudioDomainPackId;
  version?: string;
  confidence: number;
  reason: string;
}

export interface DomainResolutionCandidate {
  descriptor: DomainPackDescriptor;
  confidence: number;
  reasons: string[];
}

export interface DomainResolutionRequest {
  explicit?: DomainPackVersionRef;
  signals?: readonly DomainResolutionSignal[];
  automaticSelectionThreshold?: number;
  minimumLead?: number;
}

export interface DomainResolutionResult {
  candidates: DomainResolutionCandidate[];
  selected?: DomainResolutionCandidate;
  requiresConfirmation: boolean;
}

const boundedConfidence = (confidence: number): number =>
  Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0;

export const resolveDomainPackCandidates = (
  registry: StudioDomainPackRegistry,
  request: DomainResolutionRequest,
): DomainResolutionResult => {
  if (request.explicit) {
    const pack = registry.resolveExact(request.explicit);
    const selected: DomainResolutionCandidate = {
      descriptor: pack.descriptor,
      confidence: 1,
      reasons: ["Explicit domain pack id and exact version requested."],
    };
    return { candidates: [selected], selected, requiresConfirmation: false };
  }

  const signals = request.signals ?? [];
  const candidates = registry.listDescriptors().map((descriptor): DomainResolutionCandidate => {
    const matching = signals.filter((signal) =>
      signal.domainPackId === descriptor.id
      && (signal.version === undefined || signal.version === descriptor.version));
    return {
      descriptor,
      confidence: matching.reduce((maximum, signal) => Math.max(maximum, boundedConfidence(signal.confidence)), 0),
      reasons: matching.length > 0
        ? matching.map(({ reason }) => reason).sort()
        : ["No validated evidence supports this registered pack version."],
    };
  }).sort((left, right) =>
    right.confidence - left.confidence
    || left.descriptor.id.localeCompare(right.descriptor.id)
    || left.descriptor.version.localeCompare(right.descriptor.version));

  const threshold = request.automaticSelectionThreshold ?? 0.85;
  const minimumLead = request.minimumLead ?? 0.15;
  const first = candidates[0];
  const second = candidates[1];
  const isHighConfidence = first !== undefined && first.confidence >= threshold;
  const hasClearLead = second === undefined || first.confidence - second.confidence >= minimumLead;
  const selected = isHighConfidence && hasClearLead ? first : undefined;
  return { candidates, selected, requiresConfirmation: selected === undefined };
};
