import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../App";
import {
  getStudioFeatureFlags,
  isStudioFeatureEnabled,
  setStudioFeatureFlagOverridesForTesting,
  studioFeatureFlagDefaults,
  studioFeatureFlagEnvVariables,
} from "../featureFlags";

const storageSnapshot = (): Record<string, string> =>
  Object.fromEntries(
    Array.from({ length: window.localStorage.length }, (_, index) => {
      const key = window.localStorage.key(index) ?? "";
      return [key, window.localStorage.getItem(key) ?? ""];
    }),
  );

afterEach(() => {
  setStudioFeatureFlagOverridesForTesting();
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  window.localStorage.clear();
  window.location.hash = "#/";
});

describe("Studio extension feature flags", () => {
  it("defaults every planned extension layer to false", () => {
    expect(studioFeatureFlagDefaults).toEqual({
      studioCoreV1: false,
      assayStudioV1: false,
      assayImageImportV1: false,
      causalystLocalV1: false,
      causalystPromptBuildV1: false,
      causalystLtiV1: false,
      causalystAgsV1: false,
      causalystQtiExportV1: false,
    });
    expect(Object.values(getStudioFeatureFlags())).toEqual(Array(8).fill(false));
  });

  it("reads only explicit true values from centralized Vite build-time variables", () => {
    expect(studioFeatureFlagEnvVariables.assayStudioV1).toBe("VITE_ASSAY_STUDIO_V1");
    vi.stubEnv("VITE_ASSAY_STUDIO_V1", "true");
    vi.stubEnv("VITE_CAUSALYST_LOCAL_V1", "1");

    expect(isStudioFeatureEnabled("assayStudioV1")).toBe(true);
    expect(isStudioFeatureEnabled("causalystLocalV1")).toBe(false);
    expect(isStudioFeatureEnabled("studioCoreV1")).toBe(false);
  });

  it("supports one in-memory override path for tests without persistence", () => {
    window.localStorage.setItem("existing-key", "keep-me");
    const before = storageSnapshot();

    setStudioFeatureFlagOverridesForTesting({ studioCoreV1: true });

    expect(isStudioFeatureEnabled("studioCoreV1")).toBe(true);
    expect(isStudioFeatureEnabled("assayStudioV1")).toBe(false);
    expect(storageSnapshot()).toEqual(before);
  });

  it("does not read query parameters or alter default navigation or storage", () => {
    window.location.hash = "#/?assayStudioV1=true&causalystLocalV1=true";
    window.localStorage.setItem("existing-key", "keep-me");
    const before = storageSnapshot();
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline baseline"))));

    render(<App />);

    const links = screen.getAllByRole("navigation", { name: "Main navigation" })[0]
      .querySelectorAll("a");
    expect(Array.from(links, (link) => [link.textContent?.trim(), link.getAttribute("href")]))
      .toEqual([
        ["Lab Studio", "#/"],
        ["Studio", "#/studio"],
        ["Labs", "#/labs"],
        ["Techniques", "#/techniques"],
      ]);
    expect(screen.queryByText("Assay Studio")).not.toBeInTheDocument();
    expect(screen.queryByText("Causalyst")).not.toBeInTheDocument();
    expect(Object.values(getStudioFeatureFlags())).toEqual(Array(8).fill(false));
    expect(storageSnapshot()).toEqual(before);
  });

  it("exposes the flagged assay library without changing chemistry navigation", async () => {
    setStudioFeatureFlagOverridesForTesting({ assayStudioV1: true });
    window.location.hash = "#/assays";

    render(<App />);

    expect(await screen.findByRole("heading", {
      name: "Design the plate before touching the bench.",
    }, { timeout: 5_000 })).toBeInTheDocument();
    const links = screen.getByRole("navigation", { name: "Main navigation" })
      .querySelectorAll("a");
    expect(Array.from(links, (link) => link.textContent?.trim())).toEqual([
      "Lab Studio",
      "Studio",
      "Labs",
      "Techniques",
      "Assays",
      "Assay Studio",
    ]);
    expect(screen.getByRole("link", { name: /Assays/ })).toHaveAttribute("aria-current", "page");
  });
});
