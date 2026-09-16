import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RuntimeDefinition } from "../../runtime";
import { GuidedRehearsalOverlay } from "../GuidedRehearsalOverlay";

vi.mock("../StudentPlayer", () => ({
  StudentPlayer: () => <button type="button">Rehearsal player control</button>,
}));

const definition = { title: "Guided titration fixture" } as RuntimeDefinition;

describe("Guided rehearsal close recovery", () => {
  it("keeps the overlay visible and exposes recovery when Studio restoration fails", async () => {
    const onClose = vi.fn(async () => ({
      ok: false,
      message: "Studio tools could not be restored. Rehearsal remains open; retry Close rehearsal.",
    }));
    render(
      <GuidedRehearsalOverlay
        attemptId="attempt-1"
        definition={definition}
        onClose={onClose}
        onControllerChange={() => undefined}
        open
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /close rehearsal/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/remains open/i);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("disables repeated close while Studio restoration is pending", async () => {
    let resolve!: (value: { ok: boolean; message: string }) => void;
    const pending = new Promise<{ ok: boolean; message: string }>((settle) => { resolve = settle; });
    const onClose = vi.fn(() => pending);
    render(
      <GuidedRehearsalOverlay
        attemptId="attempt-2"
        definition={definition}
        onClose={onClose}
        onControllerChange={() => undefined}
        open
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /close rehearsal/i }));

    expect(screen.getByRole("button", { name: /restoring studio/i })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /restoring studio/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    resolve({ ok: false, message: "Retry close." });
    await waitFor(() => expect(screen.getByRole("button", { name: /close rehearsal/i })).toBeEnabled());
  });
});
