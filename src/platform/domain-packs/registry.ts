import {
  DomainPackNotRegisteredError,
  DomainPackVersionMismatchError,
  DuplicateDomainPackRegistrationError,
  InvalidDomainPackDescriptorError,
  UnsupportedDomainPackIdError,
} from "./errors";
import { validateDomainPackDescriptor } from "./schema";
import type {
  AnyStudioDomainPack,
  DomainPackDescriptor,
  StudioDomainPackId,
} from "./types";

export interface DomainPackVersionRef {
  id: string;
  version: string;
}

export interface StudioDomainPackRegistry {
  listDescriptors(): readonly DomainPackDescriptor[];
  hasExact(ref: DomainPackVersionRef): boolean;
  resolveExact(ref: DomainPackVersionRef): AnyStudioDomainPack;
}

const allowedDomainPackIds = new Set<StudioDomainPackId>(["chemistry", "assay"]);
const registryKey = (id: StudioDomainPackId, version: string): string => `${id}@${version}`;

const assertDomainPackId = (id: string): StudioDomainPackId => {
  if (!allowedDomainPackIds.has(id as StudioDomainPackId)) throw new UnsupportedDomainPackIdError(id);
  return id as StudioDomainPackId;
};

const freezeDescriptor = (descriptor: DomainPackDescriptor): DomainPackDescriptor => Object.freeze({
  ...descriptor,
  artifactKinds: Object.freeze([...descriptor.artifactKinds]) as unknown as string[],
  supportedProcedureIRVersions: Object.freeze([...descriptor.supportedProcedureIRVersions]) as unknown as string[],
  publicNamespaces: Object.freeze([...descriptor.publicNamespaces]) as unknown as string[],
  limitations: Object.freeze([...descriptor.limitations]) as unknown as string[],
});

export const createStudioDomainPackRegistry = (
  packs: readonly AnyStudioDomainPack[],
): StudioDomainPackRegistry => {
  const registered = new Map<string, AnyStudioDomainPack>();
  const descriptors: DomainPackDescriptor[] = [];
  const versionsById = new Map<StudioDomainPackId, string[]>();

  packs.forEach((pack) => {
    const validation = validateDomainPackDescriptor(pack.descriptor);
    if (!validation.ok) throw new InvalidDomainPackDescriptorError(validation.diagnostics);
    const descriptor = freezeDescriptor(validation.value);
    const id = assertDomainPackId(descriptor.id);
    const key = registryKey(id, descriptor.version);
    if (registered.has(key)) throw new DuplicateDomainPackRegistrationError(id, descriptor.version);
    registered.set(key, pack);
    descriptors.push(descriptor);
    versionsById.set(id, [...(versionsById.get(id) ?? []), descriptor.version].sort());
  });

  descriptors.sort((left, right) => left.id.localeCompare(right.id) || left.version.localeCompare(right.version));
  const descriptorSnapshot = Object.freeze([...descriptors]);

  return Object.freeze({
    listDescriptors: (): readonly DomainPackDescriptor[] => descriptorSnapshot,
    hasExact: (ref: DomainPackVersionRef): boolean => {
      if (!allowedDomainPackIds.has(ref.id as StudioDomainPackId)) return false;
      return registered.has(registryKey(ref.id as StudioDomainPackId, ref.version));
    },
    resolveExact: (ref: DomainPackVersionRef): AnyStudioDomainPack => {
      const id = assertDomainPackId(ref.id);
      const versions = versionsById.get(id);
      if (!versions) throw new DomainPackNotRegisteredError(id);
      const pack = registered.get(registryKey(id, ref.version));
      if (!pack) throw new DomainPackVersionMismatchError(id, ref.version, versions);
      return pack;
    },
  });
};
