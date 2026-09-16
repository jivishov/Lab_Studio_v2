import {
  ASSAY_IMAGE_MAX_BYTES,
  ASSAY_IMPORT_MAX_BYTES,
  assayCsvMimeTypes,
  assayImageMimeTypes,
  assayJsonMimeTypes,
  type AssayImageAttachmentDescriptor,
  type AssayImportDiagnostic,
} from "./types";

const diagnostic = (
  code: string,
  message: string,
): AssayImportDiagnostic => ({ code, message, severity: "error" });

export const validateCsvFileBoundary = (
  byteLength: number,
  mimeType: string,
): AssayImportDiagnostic[] => {
  const diagnostics: AssayImportDiagnostic[] = [];
  if (!Number.isInteger(byteLength) || byteLength < 0 || byteLength > ASSAY_IMPORT_MAX_BYTES) {
    diagnostics.push(diagnostic(
      "assay.ingestion.file-size",
      `CSV input must be at most ${ASSAY_IMPORT_MAX_BYTES} bytes.`,
    ));
  }
  if (!assayCsvMimeTypes.includes(mimeType.toLowerCase() as typeof assayCsvMimeTypes[number])) {
    diagnostics.push(diagnostic(
      "assay.ingestion.mime",
      `Unsupported CSV MIME type ${mimeType || "(missing)"}.`,
    ));
  }
  return diagnostics;
};

export const validateStructuredFileBoundary = (
  byteLength: number,
  mimeType: string,
): AssayImportDiagnostic[] => {
  const diagnostics: AssayImportDiagnostic[] = [];
  if (!Number.isInteger(byteLength) || byteLength < 0 || byteLength > ASSAY_IMPORT_MAX_BYTES) {
    diagnostics.push(diagnostic(
      "assay.ingestion.file-size",
      `Structured input must be at most ${ASSAY_IMPORT_MAX_BYTES} bytes.`,
    ));
  }
  if (!assayJsonMimeTypes.includes(mimeType.toLowerCase() as typeof assayJsonMimeTypes[number])) {
    diagnostics.push(diagnostic(
      "assay.ingestion.mime",
      `Unsupported structured-file MIME type ${mimeType || "(missing)"}.`,
    ));
  }
  return diagnostics;
};

export const createImageAttachmentDescriptor = (
  attachmentId: string,
  byteLength: number,
  mimeType: string,
  purpose: AssayImageAttachmentDescriptor["purpose"],
): { ok: true; value: AssayImageAttachmentDescriptor } | {
  ok: false;
  diagnostics: AssayImportDiagnostic[];
} => {
  const diagnostics: AssayImportDiagnostic[] = [];
  const normalizedMime = mimeType.toLowerCase();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(attachmentId)) {
    diagnostics.push(diagnostic(
      "assay.ingestion.attachment-id",
      "Attachment id must be a stable identifier, not a path or file name.",
    ));
  }
  if (!Number.isInteger(byteLength) || byteLength <= 0 || byteLength > ASSAY_IMAGE_MAX_BYTES) {
    diagnostics.push(diagnostic(
      "assay.ingestion.image-size",
      `Image attachment must be between 1 and ${ASSAY_IMAGE_MAX_BYTES} bytes.`,
    ));
  }
  if (!assayImageMimeTypes.includes(normalizedMime as typeof assayImageMimeTypes[number])) {
    diagnostics.push(diagnostic(
      "assay.ingestion.image-mime",
      `Unsupported image MIME type ${mimeType || "(missing)"}.`,
    ));
  }
  if (diagnostics.length > 0) return { ok: false, diagnostics };
  return {
    ok: true,
    value: {
      attachmentId,
      byteLength,
      mimeType: normalizedMime as AssayImageAttachmentDescriptor["mimeType"],
      purpose,
    },
  };
};
