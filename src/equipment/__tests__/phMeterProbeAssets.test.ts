import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { assetDispositionById } from "../registries";
import { getVisualProfile } from "../visualCatalog";

const assetPath = (name: string) =>
  join(process.cwd(), "public", "assets", "equipment-realistic", "v1", name);

const pngDimensions = (name: string) => {
  const bytes = readFileSync(assetPath(name));
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};

const parseElementAttributes = (svg: string, element: "svg" | "image"): Record<string, string> => {
  const startTag = svg.match(new RegExp(`<${element}\\b([^>]*)>`));
  if (!startTag) throw new Error(`Missing <${element}> element.`);
  return Object.fromEntries(
    [...startTag[1].matchAll(/([:\w-]+)="([^"]*)"/g)].map(([, name, value]) => [name, value]),
  );
};

describe("pH meter detachable probe presentation", () => {
  it("keeps the physical companion assets and normalized geometry in one profile contract", () => {
    const presentation = getVisualProfile("ph-meter")?.probePresentation;
    expect(presentation).toEqual(
      expect.objectContaining({
        probeSize: { width: 24, height: 72 },
        consoleLeadPort: expect.any(Object),
        sourceGripAnchor: expect.any(Object),
        probeLeadPort: expect.any(Object),
        probeTipAnchor: expect.any(Object),
      }),
    );
    for (const anchor of [
      presentation?.consoleLeadPort,
      presentation?.sourceGripAnchor,
      presentation?.probeLeadPort,
      presentation?.probeTipAnchor,
    ]) {
      expect(anchor?.x).toBeGreaterThanOrEqual(0);
      expect(anchor?.x).toBeLessThanOrEqual(1);
      expect(anchor?.y).toBeGreaterThanOrEqual(0);
      expect(anchor?.y).toBeLessThanOrEqual(1);
    }
  });

  it("uses PNG-backed, registry-classified companion art without a visual-state claim", () => {
    const labels = {
      "ph-meter-probe": "pH meter probe",
      "ph-meter-probe-detached-console": "pH meter console with probe removed",
    } as const;

    for (const id of Object.keys(labels) as Array<keyof typeof labels>) {
      const svg = readFileSync(assetPath(`${id}.svg`), "utf8");
      const dimensions = pngDimensions(`${id}.png`);
      const root = parseElementAttributes(svg, "svg");
      const image = parseElementAttributes(svg, "image");

      expect(root.width).toBe(String(dimensions.width));
      expect(root.height).toBe(String(dimensions.height));
      expect(root.viewBox).toBe(`0 0 ${dimensions.width} ${dimensions.height}`);
      expect(root["aria-label"]).toBe(labels[id]);
      expect(image.width).toBe(String(dimensions.width));
      expect(image.height).toBe(String(dimensions.height));
      expect(image.preserveAspectRatio).toBe("xMidYMid meet");
      expect(image.href).toMatch(/^data:image\/png;base64,/);
      expect((svg.match(/<image\b/g) ?? [])).toHaveLength(1);
      expect(assetDispositionById.get(id)?.disposition).toBe("accessory-active");
    }
  });

  it("keeps the probe lossless to its master crop and confines console changes to its declared region", () => {
    expect(() =>
      execFileSync("python", ["scripts/verifyPhMeterProbeAssets.py"], {
        cwd: process.cwd(),
        stdio: "pipe",
      }),
    ).not.toThrow();
  });
});
