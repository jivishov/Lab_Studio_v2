export type GoblinCharacterId = "apparatus-helper" | "notebook-helper";

export type GoblinMotionKind = "idle" | "carry" | "work" | "rinse" | "pour";

export type GoblinFacingDirection = "left" | "right";

export type GoblinActorEffect = "spark" | "note" | "water" | "pour";

export interface GoblinActorCue {
  id: string;
  characterId: GoblinCharacterId;
  motion: GoblinMotionKind;
  x: number;
  y: number;
  scale: number;
  facing: GoblinFacingDirection;
  delayMs?: number;
  effect?: GoblinActorEffect;
}

export interface GoblinBenchEffect {
  id: string;
  kind: "target" | "rinse-stream" | "pour-stream" | "work-spark";
  x: number;
  y: number;
  width?: number;
  rotation?: number;
  delayMs?: number;
}

export interface GoblinAnimationPreset {
  id: GoblinMotionKind;
  label: string;
  description: string;
  durationMs: number;
  actors: GoblinActorCue[];
  effects?: GoblinBenchEffect[];
}

export const goblinAnimationPresetOrder: GoblinMotionKind[] = [
  "idle",
  "carry",
  "work",
  "rinse",
  "pour",
];

export const goblinAnimationPresets: Record<GoblinMotionKind, GoblinAnimationPreset> = {
  idle: {
    id: "idle",
    label: "Idle",
    description: "A quiet readiness loop for waiting between lab steps.",
    durationMs: 1800,
    actors: [
      {
        id: "idle-apparatus",
        characterId: "apparatus-helper",
        motion: "idle",
        x: 34,
        y: 76,
        scale: 0.88,
        facing: "right",
        effect: "spark",
      },
      {
        id: "idle-notebook",
        characterId: "notebook-helper",
        motion: "idle",
        x: 62,
        y: 78,
        scale: 0.74,
        facing: "left",
        delayMs: 160,
        effect: "note",
      },
    ],
  },
  carry: {
    id: "carry",
    label: "Carry",
    description: "A traveling loop for moving an item toward the active apparatus.",
    durationMs: 1600,
    actors: [
      {
        id: "carry-apparatus",
        characterId: "apparatus-helper",
        motion: "carry",
        x: 32,
        y: 76,
        scale: 0.84,
        facing: "right",
      },
      {
        id: "carry-notebook",
        characterId: "notebook-helper",
        motion: "carry",
        x: 57,
        y: 80,
        scale: 0.66,
        facing: "right",
        delayMs: 140,
        effect: "note",
      },
    ],
    effects: [
      {
        id: "carry-target",
        kind: "target",
        x: 57,
        y: 50,
        width: 18,
        delayMs: 360,
      },
    ],
  },
  work: {
    id: "work",
    label: "Work",
    description: "A two-helper setup motion for seating, adjusting, and checking equipment.",
    durationMs: 1450,
    actors: [
      {
        id: "work-apparatus",
        characterId: "apparatus-helper",
        motion: "work",
        x: 46,
        y: 72,
        scale: 0.92,
        facing: "right",
        effect: "spark",
      },
      {
        id: "work-notebook",
        characterId: "notebook-helper",
        motion: "work",
        x: 68,
        y: 79,
        scale: 0.7,
        facing: "left",
        delayMs: 110,
        effect: "note",
      },
    ],
    effects: [
      {
        id: "work-target",
        kind: "work-spark",
        x: 55,
        y: 48,
        width: 12,
        delayMs: 260,
      },
    ],
  },
  rinse: {
    id: "rinse",
    label: "Rinse",
    description: "A wash-bottle gesture with visible hand motion and a short water stream.",
    durationMs: 1500,
    actors: [
      {
        id: "rinse-apparatus",
        characterId: "apparatus-helper",
        motion: "rinse",
        x: 42,
        y: 73,
        scale: 0.9,
        facing: "right",
        effect: "water",
      },
      {
        id: "rinse-notebook",
        characterId: "notebook-helper",
        motion: "rinse",
        x: 67,
        y: 79,
        scale: 0.68,
        facing: "left",
        delayMs: 150,
        effect: "note",
      },
    ],
    effects: [
      {
        id: "rinse-stream",
        kind: "rinse-stream",
        x: 53,
        y: 43,
        width: 18,
        rotation: 20,
        delayMs: 400,
      },
    ],
  },
  pour: {
    id: "pour",
    label: "Pour",
    description: "A stronger two-handed pour pose with a directional stream toward the receiver.",
    durationMs: 1550,
    actors: [
      {
        id: "pour-apparatus",
        characterId: "apparatus-helper",
        motion: "pour",
        x: 40,
        y: 72,
        scale: 0.92,
        facing: "right",
        effect: "pour",
      },
      {
        id: "pour-notebook",
        characterId: "notebook-helper",
        motion: "pour",
        x: 69,
        y: 80,
        scale: 0.7,
        facing: "left",
        delayMs: 120,
        effect: "note",
      },
    ],
    effects: [
      {
        id: "pour-stream",
        kind: "pour-stream",
        x: 51,
        y: 42,
        width: 25,
        rotation: 16,
        delayMs: 420,
      },
    ],
  },
};
