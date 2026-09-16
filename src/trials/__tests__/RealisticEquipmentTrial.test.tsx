import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RealisticEquipmentTrial } from "../RealisticEquipmentTrial";
import { realisticEquipmentAssets, type RealisticEquipmentAsset } from "../realisticEquipmentAssets";

const equipmentLabelCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

const sortEquipmentAssets = (assets: RealisticEquipmentAsset[]) =>
  [...assets].sort((first, second) => {
    const labelComparison = equipmentLabelCollator.compare(first.label, second.label);
    return labelComparison === 0
      ? equipmentLabelCollator.compare(first.sublabel, second.sublabel)
      : labelComparison;
  });

const sortedEquipmentLabels = sortEquipmentAssets(realisticEquipmentAssets).map((asset) => asset.label);

const sortedCatalogBackedLabels = sortEquipmentAssets(
  realisticEquipmentAssets.filter((asset) => asset.legacySvgPath),
).map((asset) => asset.label);

const activeCardLabels = () =>
  Array.from(screen.getByRole("tabpanel").querySelectorAll("article strong")).map((element) =>
    element.textContent?.trim(),
  );

describe("RealisticEquipmentTrial", () => {
  it("uses one alphabetized equipment order across all review tabs", () => {
    render(<RealisticEquipmentTrial />);

    expect(activeCardLabels()).toEqual(sortedEquipmentLabels);

    fireEvent.click(screen.getByRole("tab", { name: /shelf preview/i }));
    expect(activeCardLabels()).toEqual(sortedEquipmentLabels);

    fireEvent.click(screen.getByRole("tab", { name: /svg comparison/i }));
    expect(activeCardLabels()).toEqual(sortedCatalogBackedLabels);
  });
});
