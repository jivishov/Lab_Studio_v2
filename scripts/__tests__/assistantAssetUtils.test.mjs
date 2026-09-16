import { describe, expect, it } from "vitest";
import { publicAssetPathForFilename, sanitizeImageFilename } from "../assistantAssetUtils.mjs";

describe("assistant asset utilities", () => {
  it("sanitizes generated filenames", () => {
    expect(sanitizeImageFilename("../My Lab Image.PNG", "fallback", 1234)).toBe(
      "my-lab-image-1234.png",
    );
    expect(sanitizeImageFilename("", "workflow asset", 5)).toBe("workflow-asset-5.png");
  });

  it("returns relative public paths only", () => {
    expect(publicAssetPathForFilename("workflow-1.png")).toBe(
      "assets/assistant-generated/workflow-1.png",
    );
  });
});
