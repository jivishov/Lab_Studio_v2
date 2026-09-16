import type {
  AssayLensObservationPackage,
  AssayLensObservationRequest,
} from "../types";

export const cycle10LongCsv = [
  "Plate,Well,Signal,Unit,Channel,CapturedAt",
  "assay-cycle06-plate,A1,0.120,AU,primary,2026-07-26T12:00:00.000Z",
  "assay-cycle06-plate,A2,0.875,AU,primary,2026-07-26T12:00:01.000Z",
  "assay-cycle06-plate,A3,0.861,AU,primary,2026-07-26T12:00:02.000Z",
].join("\n");

export const cycle10CommaDecimalLongCsv = [
  "Plate;Well;Signal;Unit;Channel",
  "assay-cycle06-plate;A1;0,120;AU;primary",
  "assay-cycle06-plate;A2;0,875;AU;primary",
].join("\n");

export const cycle10MatrixCsv = [
  "Row,1,2,3,4,5,6,7,8,9,10,11,12",
  "A,0.120,0.875,0.861,0.840,0.820,0.800,0.780,0.760,0.740,0.720,0.700,0.680",
  "B,0.130,0.870,0.850,0.830,0.810,0.790,0.770,0.750,0.730,0.710,0.690,0.670",
].join("\n");

export const cycle10AssayLensRequest: AssayLensObservationRequest = {
  schema: "assay-lens.observation-request",
  schemaVersion: "1.0",
  requestId: "cycle10-assay-lens-request",
  plate: {
    id: "assay-cycle06-plate",
    format: 96,
    orientation: "A1-top-left",
  },
  requestedChannels: [{ id: "primary", unit: "relative-intensity" }],
  attachments: [{
    attachmentId: "cycle10-plate-image",
    mimeType: "image/png",
    byteLength: 2048,
    purpose: "assay-lens-analysis",
  }],
  createdAt: "2026-07-26T12:00:00.000Z",
  limitations: [
    "Synthetic interoperability fixture only; the image bytes are external and no absorbance equivalence is claimed.",
  ],
};

export const cycle10AssayLensObservationPackage: AssayLensObservationPackage = {
  schema: "assay-lens.observation-package",
  schemaVersion: "1.0",
  plate: {
    format: 96,
    orientation: "A1-top-left",
    detectedCorners: [
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.1 },
      { x: 0.9, y: 0.9 },
      { x: 0.1, y: 0.9 },
    ],
  },
  observations: [
    {
      well: "A1",
      rawSignal: "0.12",
      normalizedSignal: "0.14",
      confidence: "0.96",
      roi: { x: 10, y: 10, width: 20, height: 20 },
      flags: ["synthetic-fixture"],
    },
    {
      well: "A2",
      rawSignal: "0.82",
      confidence: "0.91",
      roi: { x: 32, y: 10, width: 20, height: 20 },
      flags: ["synthetic-fixture", "manual-boundary-review"],
    },
  ],
  analysis: {
    methodId: "synthetic-intensity-fixture",
    methodVersion: "1.0.0",
    settings: {
      channel: "primary",
      backgroundMode: "none",
      reviewed: true,
    },
  },
  manualCorrections: [{
    well: "A2",
    previousValue: "0.80",
    acceptedValue: "0.82",
    reason: "Synthetic fixture correction for provenance coverage.",
  }],
};
