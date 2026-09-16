import { createStudioMcpAdapter } from "./adapter";
import { assayMcpDomainRegistration } from "./assayServices";
import { chemistryMcpDomainRegistration } from "./chemistryServices";
import type { McpAdapterOptions } from "./types";

export const createLabStudioMcpAdapter = (options: McpAdapterOptions = {}) =>
  createStudioMcpAdapter([
    chemistryMcpDomainRegistration,
    assayMcpDomainRegistration,
  ], options);

export * from "./adapter";
export * from "./assayServices";
export * from "./chemistryServices";
export * from "./domainRegistration";
export * from "./http";
export * from "./schemas";
export * from "./stdio";
export * from "./types";
