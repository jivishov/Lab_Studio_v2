import { describe, expect, it } from "vitest";
import { buildQti22CompanionPackage, createCycle16QtiFixture, validateQtiCompanionModel } from "..";

describe("Cycle 16 QTI companion package", () => {
  it("packages the conservative four-item subset without an embedded simulation", () => {
    const { assessment, model } = createCycle16QtiFixture();
    const value = buildQti22CompanionPackage(assessment, model, { generatedAt: "2026-07-27T12:00:00.000Z" });
    expect(value.files.map(({ path }) => path)).toContain("imsmanifest.xml");
    expect(value.files.filter(({ path }) => path.startsWith("items/"))).toHaveLength(4);
    expect(value.report.simulationEmbedding).toBe("not-included");
    expect(value.report.releaseDecision).toBe("disabled-pending-interoperability-validation");
    expect(value.zip.slice(0, 4)).toEqual(Uint8Array.of(0x50, 0x4b, 0x03, 0x04));
  });

  it("rejects traversal, active content, missing choices, and invalid numeric tolerance", () => {
    const { model } = createCycle16QtiFixture();
    const unsafe = structuredClone(model);
    unsafe.assets = [{
      id: "unsafe",
      fileName: "../unsafe.svg",
      mediaType: "image/png",
      contentBase64: "PHNjcmlwdD4=",
      alternativeText: "<script>alert(1)</script>",
    }];
    unsafe.items[0].staticAssetRefs = ["missing"];
    const numeric = unsafe.items.find(({ type }) => type === "numeric-response");
    if (numeric?.type === "numeric-response") numeric.tolerance = "-1";
    const result = validateQtiCompanionModel(unsafe);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining([
      "qti.asset.path",
      "qti.text.active-content",
      "qti.item.asset-missing",
      "qti.numeric.tolerance",
    ]));
  });
});
