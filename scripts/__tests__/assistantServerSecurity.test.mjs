import { describe, expect, it } from "vitest";
import { createAssistantOriginPolicy } from "../assistantServerSecurity.mjs";

describe("assistant server origin policy", () => {
  it("allows loopback browser origins and non-browser requests", () => {
    const policy = createAssistantOriginPolicy();

    expect(policy.isAllowedAssistantOrigin(undefined)).toBe(true);
    expect(policy.isAllowedAssistantOrigin("http://127.0.0.1:5173")).toBe(true);
    expect(policy.isAllowedAssistantOrigin("http://localhost:5175")).toBe(true);
    expect(policy.isAllowedAssistantOrigin("http://[::1]:5173")).toBe(true);
  });

  it("rejects wildcard, null, and remote origins", () => {
    const policy = createAssistantOriginPolicy();

    expect(policy.isAllowedAssistantOrigin("*")).toBe(false);
    expect(policy.isAllowedAssistantOrigin("null")).toBe(false);
    expect(policy.isAllowedAssistantOrigin("https://example.com")).toBe(false);
  });

  it("echoes allowed origins without opening CORS to every site", () => {
    const policy = createAssistantOriginPolicy(["https://lab.example.test"]);

    expect(policy.isAllowedAssistantOrigin("https://lab.example.test")).toBe(true);
    expect(policy.corsHeadersForOrigin("https://lab.example.test")).toMatchObject({
      "Access-Control-Allow-Origin": "https://lab.example.test",
      Vary: "Origin",
    });
    expect(policy.corsHeadersForOrigin("https://example.com")).not.toHaveProperty(
      "Access-Control-Allow-Origin",
    );
  });
});
