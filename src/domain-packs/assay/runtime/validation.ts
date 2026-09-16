import type { ContractDiagnostic, ContractValidationResult } from "../../../platform/validation/jsonSchema";
import { toMicroliters } from "../pipetting";
import { isCanonical96WellCoordinate } from "../plate";
import {
  assayOperationSchemaId,
  assayOperationSchemaVersion,
  type AssayOperation,
} from "./types";

const operationTypes = new Set([
  "selectPipette", "setVolume", "attachTips", "aspirate", "dispense", "discard", "mix", "ejectTips", "recoverInvalid",
]);

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const error = (code: string, path: string, message: string): ContractDiagnostic => ({
  code,
  path,
  message,
  severity: "error",
});

const validSelection = (selection: unknown, target: boolean): boolean => {
  if (!record(selection) || typeof selection.kind !== "string") return false;
  if (selection.kind === "single") {
    if (target) return typeof selection.coordinate === "string" && isCanonical96WellCoordinate(selection.coordinate);
    if (!record(selection.location) || typeof selection.location.kind !== "string") return false;
    return selection.location.kind === "source"
      ? typeof selection.location.sourceId === "string" && selection.location.sourceId.length > 0
      : selection.location.kind === "well"
        && typeof selection.location.coordinate === "string"
        && isCanonical96WellCoordinate(selection.location.coordinate);
  }
  if (!target && selection.kind === "shared-source") {
    return typeof selection.sourceId === "string" && selection.sourceId.length > 0;
  }
  if ((target && selection.kind === "multichannel") || (!target && selection.kind === "plate-multichannel")) {
    return typeof selection.anchor === "string"
      && isCanonical96WellCoordinate(selection.anchor)
      && (selection.orientation === "vertical" || selection.orientation === "horizontal");
  }
  return false;
};

export const validateAssayOperation = (input: unknown): ContractValidationResult<AssayOperation> => {
  const diagnostics: ContractDiagnostic[] = [];
  if (!record(input)) return { ok: false, diagnostics: [error("assay.operation.type", "/", "Operation must be an object.")] };
  if (input.schema !== assayOperationSchemaId) diagnostics.push(error("assay.operation.schema", "/schema", `Expected ${assayOperationSchemaId}.`));
  if (input.schemaVersion !== assayOperationSchemaVersion) diagnostics.push(error("assay.operation.version", "/schemaVersion", `Expected schema version ${assayOperationSchemaVersion}.`));
  if (typeof input.operationId !== "string" || !input.operationId.trim()) diagnostics.push(error("assay.operation.id", "/operationId", "operationId must be non-empty."));
  if (typeof input.type !== "string" || !operationTypes.has(input.type)) diagnostics.push(error("assay.operation.unsupported", "/type", "Unsupported assay runtime operation."));
  if (typeof input.pipetteId !== "string" || !input.pipetteId.trim()) diagnostics.push(error("assay.operation.pipette", "/pipetteId", "pipetteId must be non-empty."));

  if (input.type === "setVolume") {
    if (!record(input.volume) || typeof input.volume.value !== "string" || typeof input.volume.unit !== "string") {
      diagnostics.push(error("assay.operation.volume", "/volume", "volume must be a decimal quantity."));
    } else {
      try { toMicroliters(input.volume as never); } catch { diagnostics.push(error("assay.operation.volume", "/volume", "volume must be a non-negative convertible volume.")); }
    }
  }
  if (input.type === "attachTips" && (typeof input.tipTypeId !== "string" || !input.tipTypeId.trim())) {
    diagnostics.push(error("assay.operation.tip", "/tipTypeId", "tipTypeId must be non-empty."));
  }
  if (input.type === "aspirate" && !validSelection(input.source, false)) diagnostics.push(error("assay.operation.source", "/source", "Invalid liquid source selection."));
  if ((input.type === "dispense" || input.type === "mix") && !validSelection(input.target, true)) diagnostics.push(error("assay.operation.target", "/target", "Invalid plate target selection."));
  if (input.type === "discard" && (typeof input.wasteRef !== "string" || !input.wasteRef.trim())) diagnostics.push(error("assay.operation.waste", "/wasteRef", "Discard requires a named waste destination."));
  if (input.type === "mix" && (!Number.isInteger(input.cycles) || Number(input.cycles) < 1 || Number(input.cycles) > 20)) {
    diagnostics.push(error("assay.operation.mix.cycles", "/cycles", "Mix cycles must be an integer from 1 through 20."));
  }
  if (input.type === "recoverInvalid" && typeof input.confirmDiscard !== "boolean") diagnostics.push(error("assay.operation.recovery.confirm", "/confirmDiscard", "Recovery requires an explicit boolean confirmation."));
  return diagnostics.length > 0 ? { ok: false, diagnostics } : { ok: true, value: input as unknown as AssayOperation, diagnostics: [] };
};
