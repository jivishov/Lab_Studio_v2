import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioAssistantAdapter, StudioAssistantContext } from "../types";
import { StudioAssistant } from "../StudioAssistant";
import { checkAssistantHealth, postAssistantTurn } from "../client";

vi.mock("../client", () => ({
  checkAssistantHealth: vi.fn(),
  pollAssistantResponse: vi.fn(),
  postAssistantImage: vi.fn(),
  postAssistantTurn: vi.fn(),
}));

const context: StudioAssistantContext = {
  draft: {
    id: "teacher-draft",
    revision: "rev-test",
    artifactKind: "lab",
    title: "Teacher Draft Lab",
    description: "Draft",
    audience: "Students",
    learningGoals: [],
    safetyNotes: [],
    equipment: [],
    tags: [],
    nodeCount: 1,
    actionCount: 1,
    startNodeId: "start",
    selectedNodeId: "start",
  },
  validation: { ok: true, errors: [], warnings: [] },
  templates: [],
  processNodes: [],
};

const makeAdapter = (executeTool = vi.fn()): StudioAssistantAdapter => ({
  getContext: () => context,
  executeTool,
});

describe("StudioAssistant", () => {
  beforeEach(() => {
    vi.mocked(checkAssistantHealth).mockResolvedValue({
      ok: true,
      configured: true,
      models: ["gpt-5.4-mini", "gpt-5.5", "gpt-5.5-pro"],
    });
    vi.mocked(postAssistantTurn).mockReset();
  });

  it("runs an automatic tool call and reports the final assistant text", async () => {
    const executeTool = vi.fn().mockResolvedValue({ status: "ok", message: "Added filtration." });
    vi.mocked(postAssistantTurn)
      .mockResolvedValueOnce({
        responseId: "resp-1",
        status: "completed",
        outputText: "",
        toolCalls: [
          {
            callId: "call-1",
            name: "add_template_node",
            arguments: { templateId: "template-filtration" },
          },
        ],
      })
      .mockResolvedValueOnce({
        responseId: "resp-2",
        status: "completed",
        outputText: "Added the filtration template.",
        toolCalls: [],
      });

    render(
      <StudioAssistant adapter={makeAdapter(executeTool)} isOpen onClose={() => undefined} />,
    );
    await screen.findByText(/local assistant server ready/i);
    fireEvent.change(screen.getByPlaceholderText(/ask for a filtration workflow/i), {
      target: { value: "Add filtration" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send assistant message/i }));

    await screen.findByText(/added the filtration template/i);
    expect(executeTool).toHaveBeenCalledWith(
      {
        callId: "call-1",
        name: "add_template_node",
        arguments: { templateId: "template-filtration" },
      },
    );
    expect(vi.mocked(postAssistantTurn).mock.calls[1][0].toolOutputs?.[0].result).toMatchObject({
      status: "ok",
    });
  });

  it("shows guarded tool confirmation before executing side effects", async () => {
    const executeTool = vi
      .fn()
      .mockResolvedValueOnce({
        status: "pending_confirmation",
        message: "Export lab JSON is waiting for confirmation.",
      })
      .mockResolvedValueOnce({ status: "ok", message: "Exported." });
    vi.mocked(postAssistantTurn)
      .mockResolvedValueOnce({
        responseId: "resp-1",
        status: "completed",
        outputText: "",
        toolCalls: [{ callId: "call-1", name: "export_lab_json", arguments: {} }],
      })
      .mockResolvedValueOnce({
        responseId: "resp-2",
        status: "completed",
        outputText: "Export queued.",
        toolCalls: [],
      });

    render(
      <StudioAssistant adapter={makeAdapter(executeTool)} isOpen onClose={() => undefined} />,
    );
    await screen.findByText(/local assistant server ready/i);
    fireEvent.change(screen.getByPlaceholderText(/ask for a filtration workflow/i), {
      target: { value: "Export this" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send assistant message/i }));

    await screen.findByLabelText(/assistant confirmation/i);
    expect(executeTool).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    await waitFor(() => expect(executeTool).toHaveBeenCalledTimes(2));
    expect(executeTool.mock.calls[1][1]).toEqual({ confirmed: true });
  });

  it("sends a cancellation tool output when guarded confirmation is cancelled", async () => {
    const executeTool = vi.fn().mockResolvedValueOnce({
      status: "pending_confirmation",
      message: "Export lab JSON is waiting for confirmation.",
    });
    vi.mocked(postAssistantTurn)
      .mockResolvedValueOnce({
        responseId: "resp-1",
        status: "completed",
        outputText: "",
        toolCalls: [{ callId: "call-1", name: "export_lab_json", arguments: {} }],
      })
      .mockResolvedValueOnce({
        responseId: "resp-2",
        status: "completed",
        outputText: "Export cancelled.",
        toolCalls: [],
      });

    render(
      <StudioAssistant adapter={makeAdapter(executeTool)} isOpen onClose={() => undefined} />,
    );
    await screen.findByText(/local assistant server ready/i);
    fireEvent.change(screen.getByPlaceholderText(/ask for a filtration workflow/i), {
      target: { value: "Export this" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send assistant message/i }));

    await screen.findByLabelText(/assistant confirmation/i);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    await screen.findByText(/export cancelled/i);
    expect(executeTool).toHaveBeenCalledTimes(1);
    expect(vi.mocked(postAssistantTurn).mock.calls[1][0]).toMatchObject({
      previousResponseId: "resp-1",
      toolOutputs: [
        {
          callId: "call-1",
          name: "export_lab_json",
          result: {
            status: "error",
            message: "export_lab_json was cancelled by the user.",
          },
        },
      ],
    });
  });

  it("surfaces the missing local server state", async () => {
    vi.mocked(checkAssistantHealth).mockRejectedValueOnce(new Error("offline"));
    render(
      <StudioAssistant adapter={makeAdapter()} isOpen onClose={() => undefined} />,
    );
    expect(await screen.findByText(/npm run assistant:server/i)).toBeInTheDocument();
  });
});
