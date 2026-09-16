import { registeredStudioDomainPacks } from "../../platform/domain-packs/staticRegistry";
import { coreEvidenceRegistryFragment } from "../../platform/evidence/coreRegistry";
import { createEvidenceRegistry } from "../../platform/evidence/registry";

export const causalystEvidenceRegistry = createEvidenceRegistry([
  coreEvidenceRegistryFragment,
  ...registeredStudioDomainPacks.map((pack) => pack.getEvidenceRegistryFragment()),
], "1.0.0");

