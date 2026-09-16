import { chemistryDomainPack } from "../../domain-packs/chemistry/chemistryPack";
import { assayDomainPack } from "../../domain-packs/assay/assayPack";
import { createStudioDomainPackRegistry } from "./registry";
import type { AnyStudioDomainPack } from "./types";

// Registrations are source-controlled imports, never filesystem scans or remote plugins.
// Assay intentionally remains absent until Cycle 06.
export const registeredStudioDomainPacks = [
  chemistryDomainPack,
  assayDomainPack,
] as const satisfies readonly AnyStudioDomainPack[];
export const studioDomainPackRegistry = createStudioDomainPackRegistry(registeredStudioDomainPacks);
