import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Focused asset regressions for the two open-chamber wrappers changed in this repair.
 *
 * Authored, not executed, under the repository validation policy. The decoded embedded PNG is
 * compared byte-for-byte with its sibling raster so the SVG edit cannot silently redraw or replace
 * the visual source of truth.
 */

const wrapperSpecs = [
  {
    svg: "chromatography-chamber-open.svg",
    png: "chromatography-chamber-open.png",
    ariaLabel: "chromatography chamber with the lid off",
  },
  {
    svg: "chromatography-chamber-with-paper-open.svg",
    png: "chromatography-chamber-with-paper-open.png",
    ariaLabel: "chromatography chamber holding a paper strip with the lid off",
  },
] as const;

const assetPath = (fileName: string): string =>
  join(process.cwd(), "public", "assets", "equipment-realistic", "v1", fileName);

const readPngDimensions = (fileName: string): { width: number; height: number } => {
  const bytes = readFileSync(assetPath(fileName));
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
};

describe("open chromatography chamber PNG-backed wrappers", () => {
  it("preserves the exact raster, viewport, aspect behavior, and apparatus label", () => {
    for (const spec of wrapperSpecs) {
      const svg = readFileSync(assetPath(spec.svg), "utf8");
      const png = readFileSync(assetPath(spec.png));
      const root = svg.match(/<svg\b[^>]*>/s)?.[0] ?? "";
      const image = svg.match(/<image\b[^>]*\/>/s)?.[0] ?? "";
      const embedded = svg.match(/href="data:image\/png;base64,([^"]+)"/);
      const rootDimensions = root.match(/\bwidth="(\d+)"[^>]*\bheight="(\d+)"/);
      const viewBox = root.match(/\bviewBox="([^"]+)"/);
      const imageDimensions = image.match(/\bwidth="(\d+)"[^>]*\bheight="(\d+)"/);
      const pngDimensions = readPngDimensions(spec.png);

      expect(root, spec.svg).toContain('role="img"');
      expect(root.match(/\baria-label="([^"]+)"/)?.[1], spec.svg).toBe(spec.ariaLabel);
      expect((svg.match(/<image\b/g) ?? []).length, spec.svg).toBe(1);
      expect((svg.match(/href="data:image\/png;base64,/g) ?? []).length, spec.svg).toBe(1);
      expect(image, spec.svg).toContain('preserveAspectRatio="xMidYMid meet"');
      expect(rootDimensions?.slice(1).map(Number), spec.svg).toEqual([1041, 1254]);
      expect(imageDimensions?.slice(1).map(Number), spec.svg).toEqual([1041, 1254]);
      expect(viewBox?.[1].split(/\s+/).map(Number), spec.svg).toEqual([0, 0, 1041, 1254]);
      expect(pngDimensions, spec.svg).toEqual({ width: 1041, height: 1254 });
      expect(embedded, spec.svg).not.toBeNull();
      expect(Buffer.from(embedded?.[1] ?? "", "base64").equals(png), spec.svg).toBe(true);
    }
  });
});
