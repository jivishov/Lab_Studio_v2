/**
 * Green-chemistry product recovery — the catalog capabilities the route is gated on.
 *
 * `purify-a-mixture-green-chemistry_2026-07-27.md` EX-06 loads a planned mixture out of the
 * teacher's configured solid master stock, and EX-17-EX-19 recovers the cooled product out of the
 * crucible into two labelled 250 mL beakers. Each of those steps is refused with a message rather
 * than misbehaving when the catalog withholds the capability, so a regression here would present
 * as content that simply cannot execute — which is exactly how it presented before this change.
 *
 * `small-vial` is pinned deliberately: the route reuses it exactly as it already stands, and a
 * later narrowing of it would break that reuse without touching anything named above.
 *
 * Authored, not executed, under the repository validation policy (`AGENTS.md`).
 */
import { describe, expect, it } from "vitest";
import { equipmentById } from "../catalog";

describe("equipment capabilities for green-chemistry product recovery", () => {
  it("lets the sample bottle both hold and deliver a solid, because the master stock is configured in it", () => {
    const bottle = equipmentById.get("sample-bottle");

    expect(bottle?.allowedContents).toContain("solid");
    expect(bottle?.affordances).toContain("pourable");
  });

  it("lets a 250 mL beaker hold a solid, because both labelled recovery containers are beakers", () => {
    expect(equipmentById.get("beaker-250ml")?.allowedContents).toContain("solid");
  });

  it("lets the crucible act as a pour source, because EX-17 recovers the product out of it", () => {
    expect(equipmentById.get("crucible-with-lid")?.affordances).toContain("pourable");
  });

  it("keeps the small vial exactly as the route reuses it, with no capability change of its own", () => {
    const vial = equipmentById.get("small-vial");

    expect(vial?.affordances).toEqual(["draggable", "pourable"]);
    expect(vial?.allowedContents).toEqual(["empty", "solid", "solution"]);
  });
});
