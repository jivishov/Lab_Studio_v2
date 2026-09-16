import type { EvidenceRegistryFragment } from "../../platform/evidence/types";
import { getAssayCycle08EvidenceDescriptors } from "./evidence/descriptors";
import { assayIngestedObservationEvidenceDescriptor } from "./ingestion/evidence";
import { getAssayPipettingEvidenceRegistryDescriptors } from "./runtime/evidence";

const assayEvidenceRegistryFragment: EvidenceRegistryFragment = {
  schema: "studio.evidence-registry-fragment",
  schemaVersion: "1.0",
  domainPackId: "assay",
  version: "1.0.0",
  entries: [
    ...getAssayPipettingEvidenceRegistryDescriptors(),
    ...getAssayCycle08EvidenceDescriptors(),
    assayIngestedObservationEvidenceDescriptor,
  ],
};

/** Registers semantic assay operation, reviewed ingestion, correction, QC, and result evidence. */
export const getAssayEvidenceRegistryFragment = (): EvidenceRegistryFragment =>
  structuredClone(assayEvidenceRegistryFragment);
