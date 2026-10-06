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
  /** Turn the drying oven's control to the stated range (FD-13). */
  "set-oven-temperature": { verb: "observe", atomId: "atom.observe.set-drying-oven", control: "Set" },
  /** Open the drying oven's door. */
  "open-oven-door": { verb: "observe", atomId: "atom.observe.open-oven-door", control: "Open the door" },
  /** Close the door on the sample and dry it for a stated time (FD-14, FD-17), on the fast step clock. */
  "dry-in-oven": { verb: "dry", atomId: "atom.dry.close-oven-and-dry", control: "Close and dry" },
  /** Break a partly dried solid into small pieces with the metal scoop (FD-16). */
  "break-up-precipitate": { verb: "observe", atomId: "atom.observe.break-up-precipitate", control: "Break it up" },
  /** Leave a hot assembly on the heat-safe pad until it is cool enough to weigh (FD-18, FD-19). */
  "cool-on-pad": { verb: "cool", atomId: "atom.cool.on-heat-safe-pad", control: "Wait" },
  /** Set the crucible's lid askew on the crucible, its vent gap open (S-02, S-03, EX-09). */
  "set-crucible-lid": { verb: "observe", atomId: "atom.observe.set-crucible-lid-askew", control: "Set the lid askew" },
  /** Light the burner: air collar nearly closed, gas on, the striker at the top of the barrel (EX-10). */
  "light-burner": { verb: "observe", atomId: "atom.control.light-burner", control: "Light" },
  /** Open the burner's air collar until the flame turns from yellow to blue with an inner cone (decision 10). */
  "set-flame": { verb: "observe", atomId: "atom.control.set-burner-flame", control: "Open the air collar" },
  /** Heat the crucible over the blue flame, its lid askew, for a stated time (EX-10, EX-16). */
  "heat-crucible": { verb: "heat", atomId: "atom.heat.crucible-over-burner", control: "Heat" },
  /** Turn the burner's gas off before the crucible is moved (EX-11). */
  "turn-off-burner": { verb: "observe", atomId: "atom.control.turn-off-burner", control: "Turn off" },
} as const satisfies Record<string, BenchOperationSpec>;

export type BenchOperationId = keyof typeof benchOperations;

export const benchOperationSpec = (id: unknown): BenchOperationSpec | undefined =>
  typeof id === "string" && Object.prototype.hasOwnProperty.call(benchOperations, id)
    ? benchOperations[id as BenchOperationId]
    : undefined;

export const benchOperationAtomIds: ReadonlySet<string> = new Set(Object.values(benchOperations).map((spec) => spec.atomId));
