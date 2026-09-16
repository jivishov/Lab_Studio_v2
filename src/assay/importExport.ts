import { downloadJson } from "../studio/importExport";
import type { AssayDefinition } from "../domain-packs/assay/types";
import {
  parseAssayDefinition,
  serializeAssayDefinition,
} from "../domain-packs/assay/types/validation";

export const parseImportedAssayJson = (text: string): AssayDefinition =>
  parseAssayDefinition(text);

export const serializeAssay = (assay: AssayDefinition): string =>
  serializeAssayDefinition(assay);

export const downloadAssay = (assay: AssayDefinition): void => {
  downloadJson(`${assay.id}.assay.json`, serializeAssay(assay));
};

