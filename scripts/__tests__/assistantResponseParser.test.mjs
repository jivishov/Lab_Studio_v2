import { describe, expect, it } from "vitest";
import { createOpenAiResponseParser } from "../assistantResponseParser.mjs";

const actionCatalog = [
  {
    name: "select_node",
    description: "Select a node.",
    pageId: "studio",
    safety: "auto",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", minLength: 1 },
      },
      required: ["nodeId"],
      additionalProperties: false,
    },
  },
];

const parseResponse = createOpenAiResponseParser(actionCatalog);

describe("assistant response parser", () => {
  it("returns only schema-valid Studio tool calls", () => {
    const parsed = parseResponse(
      {
        id: "resp_1",
        status: "completed",
        output: [
          {
            type: "function_call",
            call_id: "call_1",
            name: "select_node",
            arguments: JSON.stringify({ nodeId: "node-1" }),
          },
        ],
      },
      { pageId: "studio", latencyMs: 12 },
    );

    expect(parsed.status).toBe("completed");
    expect(parsed.latencyMs).toBe(12);
    expect(parsed.toolCalls).toEqual([
      { callId: "call_1", name: "select_node", arguments: { nodeId: "node-1" } },
    ]);
  });

  it("fails unknown tool names before they reach the client adapter", () => {
    const parsed = parseResponse({
      id: "resp_2",
      status: "completed",
      output: [
        {
          type: "function_call",
          call_id: "call_2",
          name: "click_dom_selector",
          arguments: JSON.stringify({ selector: "#save" }),
        },
      ],
    });

    expect(parsed.status).toBe("failed");
    expect(parsed.toolCalls).toEqual([]);
    expect(parsed.error).toBe("Unknown assistant tool for studio: click_dom_selector");
  });

  it("fails invalid tool arguments before they reach the client adapter", () => {
    const parsed = parseResponse({
      id: "resp_3",
      status: "completed",
      output: [
        {
          type: "function_call",
          call_id: "call_3",
          name: "select_node",
          arguments: JSON.stringify({ nodeId: "" }),
        },
      ],
    });

    expect(parsed.status).toBe("failed");
    expect(parsed.toolCalls).toEqual([]);
    expect(parsed.error).toContain("select_node arguments failed validation");
  });

  it("preserves assistant text output", () => {
    const parsed = parseResponse({
      id: "resp_4",
      status: "completed",
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: "Updated the workflow." }],
        },
      ],
    });

    expect(parsed.outputText).toBe("Updated the workflow.");
  });
});
