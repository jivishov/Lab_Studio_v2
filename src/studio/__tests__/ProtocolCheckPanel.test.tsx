import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PROTOCOL_CHECK_NAMES, type ProtocolCheckReport } from "../../protocolCheck/types";
import { ProtocolCheckPanel } from "../ProtocolCheckPanel";

const report: ProtocolCheckReport = {
  reportId: "protocol-stage-1-r1",
  stage: {
    stageId: "stage-1",
    stageRevision: 1,
    sourceInventoryRevision: 0,
    sourceDraftFingerprint: "private-guard-only",
  },
  passed: true,
  completedAt: "2026-08-29T20:00:00.000Z",
  checks: PROTOCOL_CHECK_NAMES.map((name) => ({
    name,
    status: "passed",
    message: `${name} passed through its declared source path.`,
  })),
  limitations: {
    scientific: ["The simulation omits full indicator equilibrium."],
    safety: ["Declared readiness is not comprehensive safety review."],
    physical: ["The synthetic preset does not characterize an external sample."],
  },
};

describe("ProtocolCheckPanel", () => {
  it("shows all cases and explicit limitation categories without certification language", () => {
    render(<ProtocolCheckPanel report={report} />);

    expect(screen.getByText("10 of 10 declared checks passed")).toBeInTheDocument();
    PROTOCOL_CHECK_NAMES.forEach((name) => {
      expect(screen.getByText(name.replaceAll("_", " "))).toBeInTheDocument();
    });
    expect(screen.getByText("Scientific model")).toBeInTheDocument();
    expect(screen.getByText("Declared safety only")).toBeInTheDocument();
    expect(screen.getByText("Physical transfer")).toBeInTheDocument();
    expect(screen.getByText(/does not certify analytical accuracy/i)).toBeInTheDocument();
  });
});
