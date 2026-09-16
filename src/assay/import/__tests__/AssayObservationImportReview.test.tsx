import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getAssayLayoutGoldenArtifact } from "../../../domain-packs/assay/__fixtures__/assay-layout.v1";
import { AssayObservationImportReview } from "../AssayObservationImportReview";

describe("AssayObservationImportReview", () => {
  it("exposes native mapping, manual, image, file-bridge, and semantic review controls", () => {
    render(<AssayObservationImportReview assay={getAssayLayoutGoldenArtifact()} />);
    expect(screen.getByRole("heading", { name: "Observation import & review" })).toBeInTheDocument();
    expect(screen.getByLabelText("Shape")).toBeInTheDocument();
    expect(screen.getByLabelText("CSV source preview")).toBeInTheDocument();
    expect(screen.getByLabelText("Choose image for manual review")).toBeInTheDocument();
    expect(screen.getByLabelText("Import reviewed Assay Lens result")).toBeInTheDocument();
    expect(screen.getByText(/performs no built-in computer vision/i)).toBeInTheDocument();
  });

  it("keeps a manual value unreviewed until an explicit decision and commit", () => {
    const onCommit = vi.fn();
    render(
      <AssayObservationImportReview
        assay={getAssayLayoutGoldenArtifact()}
        onCommit={onCommit}
      />,
    );
    fireEvent.change(screen.getByLabelText("Value"), { target: { value: "0.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Add to review queue" }));
    expect(screen.getByRole("table", { name: "Mapped observations and explicit review state" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Commit reviewed set" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    fireEvent.click(screen.getByRole("button", { name: "Commit reviewed set" }));
    expect(onCommit).toHaveBeenCalledTimes(1);
  });
});
