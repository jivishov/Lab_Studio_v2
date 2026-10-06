import type { ActionVerb } from "./types";

/**
 * Bench operations (Pack 2, decided 2026-10-05; `planning/2026-09-23_lab-studio-3d/proposals/
 * PACK2_ATOMIZATION.md`): physical actions a student performs on apparatus through the process
 * control (a click on the item, a hand gesture, or the step card), each with its own verb and atom.
 * A step names one with `parameters.benchOperation`; the reducer's bench-operation handler
 * (`src/runtime/benchOperations.ts`) performs it, and each records a notebook entry under the step's
 * own tag, by which the step is judged.
 *
 * An operation and its atom imply each other, as a chamber operation and its atom do: neither a
 * notebook sentence claiming the atom nor the operation without it can stand in for the action.
 */
export interface BenchOperationSpec {
  verb: ActionVerb;
  atomId: string;
  /** What the student does, for the step card's button. */
  control: string;
}

export const benchOperations = {
  /** Stir a vessel with the stirring rod standing in it, for a stated time (PR-15). */
  stir: { verb: "mix", atomId: "atom.mix.stir-with-rod", control: "Stir" },
  /** Leave a precipitate to settle, so clear liquid stands above it (real practice). */
  "settle-precipitate": { verb: "settle", atomId: "atom.settle.let-precipitate-settle", control: "Wait" },
  /** One drop of reagent from a dropping pipette onto the clear liquid above a settled precipitate. */
  "precipitation-drop-test": { verb: "observe", atomId: "atom.observe.complete-precipitation-test", control: "Add a drop" },
  /** Fold a dry filter paper in half and in half again, ready to open into a cone in the funnel. */
  "fold-filter-paper": { verb: "observe", atomId: "atom.observe.fold-filter-paper", control: "Fold" },
} as const satisfies Record<string, BenchOperationSpec>;

export type BenchOperationId = keyof typeof benchOperations;

export const benchOperationSpec = (id: unknown): BenchOperationSpec | undefined =>
  typeof id === "string" && Object.prototype.hasOwnProperty.call(benchOperations, id)
    ? benchOperations[id as BenchOperationId]
    : undefined;

export const benchOperationAtomIds: ReadonlySet<string> = new Set(Object.values(benchOperations).map((spec) => spec.atomId));
