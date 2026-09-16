import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScientificText } from "../ScientificText";

describe("ScientificText", () => {
  it("renders ionic charge notation without changing the authored text", () => {
    const { container } = render(
      <p><ScientificText text="Practice Fe2+ aliquot within the manual's 5-15 mL range." /></p>,
    );

    expect(container.textContent).toBe("Practice Fe2+ aliquot within the manual's 5-15 mL range.");
    expect(container.querySelector("sup")?.textContent).toBe("2+");
  });

  it("renders molecular subscripts and preserves hyphenated scientific terms", () => {
    const { container } = render(
      <p><ScientificText text="Practice 6 M H2SO4 and compare the CO2-based result." /></p>,
    );

    expect([...container.querySelectorAll("sub")].map((node) => node.textContent)).toEqual(["2", "4", "2"]);
    expect(container.textContent).toBe("Practice 6 M H2SO4 and compare the CO2-based result.");
  });
});
