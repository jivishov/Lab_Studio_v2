import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getAssayLayoutGoldenArtifact } from "../../../domain-packs/assay/__fixtures__/assay-layout.v1";
import { AssayReleaseReview } from "../AssayReleaseReview";

describe("AssayReleaseReview", () => {
  it("provides semantic validation, compare/apply, downloads, and explicit limited-release text", () => {
    const assay = getAssayLayoutGoldenArtifact();
    const candidate = structuredClone(assay);
    candidate.title = "Reviewed candidate";
    const onApplyCandidate = vi.fn();
    render(
      <AssayReleaseReview
        assay={assay}
        candidate={candidate}
        onApplyCandidate={onApplyCandidate}
      />,
    );
    expect(screen.getByRole("heading", { name: "Release review" })).toBeInTheDocument();
    expect(screen.getByText(/limited: artifact, schema, output-boundary/i)).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Semantic comparison before apply" })).toHaveTextContent("title");
    expect(screen.getByRole("button", { name: "Apply validated candidate" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Apply validated candidate" }));
    expect(onApplyCandidate).toHaveBeenCalledWith(expect.objectContaining({ title: "Reviewed candidate" }));
    expect(screen.getByRole("button", { name: /\.assay-package\.json/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /\.plate-map\.csv/ })).toBeInTheDocument();
  });

  it("blocks a candidate for a different artifact id", () => {
    const assay = getAssayLayoutGoldenArtifact();
    const candidate = structuredClone(assay);
    candidate.id = "different-assay";
    render(<AssayReleaseReview assay={assay} candidate={candidate} />);
    expect(screen.getByText(/cannot be applied/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply validated candidate" })).toBeDisabled();
  });
});
