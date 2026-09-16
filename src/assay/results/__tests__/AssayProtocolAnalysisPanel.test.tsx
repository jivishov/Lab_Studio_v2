import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getCycle11ProtocolGoldenWorkflows } from "../../../domain-packs/assay/profiles/__fixtures__/cycle11ProtocolFixtures";
import { AssayProtocolAnalysisPanel } from "../AssayProtocolAnalysisPanel";

describe("AssayProtocolAnalysisPanel", () => {
  it("shows the checked profile, scientific boundary, source, and table parity", () => {
    const { xtt } = getCycle11ProtocolGoldenWorkflows();
    render(<AssayProtocolAnalysisPanel analysis={xtt.analysis} profile={xtt.profile} />);
    expect(screen.getByText(/metabolic-activity proxy/i)).toBeInTheDocument();
    expect(screen.getByRole("table", { name: /profile-bound reviewed well results/i })).toBeInTheDocument();
    expect(screen.getByText(/NIH|NCBI/i)).toBeInTheDocument();
  });
});
