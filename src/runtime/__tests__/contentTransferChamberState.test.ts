import { describe, expect, it } from "vitest";
import type { ContentState } from "../../domain/types";
import { mergeTransferredContents } from "../contentTransfer";

/**
 * Apparatus-owned state must survive material transfer.
 *
 * Authored for the item-1 chamber repair and intentionally not executed under the current
 * repository validation ceiling.
 */
const emptyChamber = (closed: boolean): ContentState => ({
  kind: "empty",
  label: "Developing chamber",
  solutes: [],
  contamination: [],
  wetState: "dry",
  visualState: "empty",
  developingChamberClosed: closed,
});

const solvent = (sourceClosure?: boolean): ContentState => ({
  kind: "liquid",
  label: "Water",
  volumeMl: 10,
  solutes: [],
  contamination: [],
  wetState: "wet",
  visualState: "clear-liquid",
  ...(sourceClosure === undefined ? {} : { developingChamberClosed: sourceClosure }),
});

describe("liquid transfer preserves receiving chamber closure", () => {
  it("keeps an explicitly open empty chamber open after the first solvent charge", () => {
    const filled = mergeTransferredContents(emptyChamber(false), solvent(true));
    expect(filled.kind).toBe("liquid");
    expect(filled.volumeMl).toBe(10);
    expect(filled.developingChamberClosed).toBe(false);
  });

  it("keeps an explicitly closed receiver closed and never copies a source vessel lid state", () => {
    const filled = mergeTransferredContents(emptyChamber(true), solvent(false));
    expect(filled.developingChamberClosed).toBe(true);
  });

  it("preserves receiver closure when more solvent is mixed into an already filled chamber", () => {
    const charged = mergeTransferredContents(emptyChamber(false), solvent());
    const toppedUp = mergeTransferredContents(charged, { ...solvent(), volumeMl: 5 });
    expect(toppedUp.volumeMl).toBe(15);
    expect(toppedUp.developingChamberClosed).toBe(false);
  });
});
