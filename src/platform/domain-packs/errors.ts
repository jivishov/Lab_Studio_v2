import type { ContractDiagnostic } from "../validation/jsonSchema";
import type { StudioDomainPackId } from "./types";

export type DomainPackRegistryErrorCode =
  | "domain-pack.unsupported-id"
  | "domain-pack.not-registered"
  | "domain-pack.version-mismatch"
  | "domain-pack.duplicate-registration"
  | "domain-pack.descriptor-invalid";

export class DomainPackRegistryError extends Error {
  constructor(
    public readonly code: DomainPackRegistryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class UnsupportedDomainPackIdError extends DomainPackRegistryError {
  constructor(public readonly domainPackId: string) {
    super("domain-pack.unsupported-id", `Domain pack id ${domainPackId} is not allowed.`);
  }
}

export class DomainPackNotRegisteredError extends DomainPackRegistryError {
  constructor(public readonly domainPackId: StudioDomainPackId) {
    super("domain-pack.not-registered", `Domain pack ${domainPackId} is not registered.`);
  }
}

export class DomainPackVersionMismatchError extends DomainPackRegistryError {
  constructor(
    public readonly domainPackId: StudioDomainPackId,
    public readonly requestedVersion: string,
    public readonly availableVersions: readonly string[],
  ) {
    super(
      "domain-pack.version-mismatch",
      `Domain pack ${domainPackId} does not provide exact version ${requestedVersion}; available: ${availableVersions.join(", ") || "none"}.`,
    );
  }
}

export class DuplicateDomainPackRegistrationError extends DomainPackRegistryError {
  constructor(
    public readonly domainPackId: StudioDomainPackId,
    public readonly version: string,
  ) {
    super(
      "domain-pack.duplicate-registration",
      `Domain pack ${domainPackId} version ${version} is registered more than once.`,
    );
  }
}

export class InvalidDomainPackDescriptorError extends DomainPackRegistryError {
  constructor(public readonly diagnostics: readonly ContractDiagnostic[]) {
    super(
      "domain-pack.descriptor-invalid",
      `Domain pack descriptor is invalid: ${diagnostics.map(({ code, path }) => `${code} at ${path}`).join("; ")}`,
    );
  }
}

export const isDomainPackRegistryError = (error: unknown): error is DomainPackRegistryError =>
  error instanceof DomainPackRegistryError;
