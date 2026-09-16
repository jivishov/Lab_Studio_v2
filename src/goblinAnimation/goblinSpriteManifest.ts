import type { GoblinCharacterId, GoblinMotionKind } from "./goblinAnimationPresets";

export type GoblinSpriteMotionId = `${GoblinCharacterId}/${GoblinMotionKind}`;

export interface GoblinSpriteAnchor {
  x: number;
  y: number;
}

export interface GoblinSpriteDisplay {
  width: number;
  height: number;
  scale: number;
}

export interface GoblinSpriteEventFrames {
  pourStart?: number;
  pourHoldStart?: number;
  pourEnd?: number;
}

export interface GoblinSpriteStageCue {
  x: number;
  y: number;
  facing: "left" | "right";
}

export interface GoblinSpriteDefinition {
  id: GoblinSpriteMotionId;
  characterId: GoblinCharacterId;
  motion: GoblinMotionKind;
  sheetUrl: string;
  sourceFrames: string[];
  contactSheetUrl: string;
  sourceContactSheetUrl?: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  fps: number;
  loop: boolean;
  stillFrame: number;
  anchor: GoblinSpriteAnchor;
  scale: number;
  display?: GoblinSpriteDisplay;
  stageCue?: GoblinSpriteStageCue;
  eventFrames?: GoblinSpriteEventFrames;
  status: "vertical-slice" | "approved";
}

export interface GoblinSpriteManifest {
  version: string;
  sprites: GoblinSpriteDefinition[];
}

export interface GoblinSpriteActorCue {
  id: string;
  spriteId: GoblinSpriteMotionId;
  x: number;
  y: number;
  scale?: number;
  facing?: "left" | "right";
}

export const goblinSpriteManifest = {
  version: "v1",
  sprites: [
    {
      id: "apparatus-helper/pour",
      characterId: "apparatus-helper",
      motion: "pour",
      sheetUrl: "assets/goblin-mode/sprites/v1/sheets/apparatus-helper-pour.png",
      sourceFrames: Array.from(
        { length: 16 },
        (_, index) =>
          `assets/goblin-mode/sprites/v1/source/apparatus-helper/pour/frame-${String(index).padStart(2, "0")}.png`,
      ),
      contactSheetUrl: "assets/goblin-mode/sprites/v1/contact/apparatus-helper-pour-contact.png",
      sourceContactSheetUrl: "assets/goblin-mode/sprites/v1/contact/apparatus-helper-pour-source-contact.png",
      frameWidth: 512,
      frameHeight: 512,
      frameCount: 16,
      fps: 12,
      loop: true,
      stillFrame: 15,
      anchor: { x: 0.5, y: 1 },
      scale: 1,
      display: { width: 288, height: 288, scale: 1 },
      stageCue: { x: 56, y: 83, facing: "right" },
      eventFrames: { pourStart: 9, pourHoldStart: 9, pourEnd: 11 },
      status: "vertical-slice",
    },
  ],
} satisfies GoblinSpriteManifest;

export const spriteIdFor = (
  characterId: GoblinCharacterId,
  motion: GoblinMotionKind,
): GoblinSpriteMotionId => `${characterId}/${motion}`;

export const getGoblinSpriteDefinition = (
  spriteId: GoblinSpriteMotionId,
  manifest: GoblinSpriteManifest = goblinSpriteManifest,
): GoblinSpriteDefinition | undefined => manifest.sprites.find((sprite) => sprite.id === spriteId);

export const validateGoblinSpriteManifest = (
  manifest: GoblinSpriteManifest,
): { ok: boolean; errors: string[] } => {
  const errors: string[] = [];
  const seen = new Set<string>();

  if (!manifest.version) errors.push("version is required");
  if (manifest.sprites.length === 0) errors.push("at least one sprite is required");

  for (const sprite of manifest.sprites) {
    if (seen.has(sprite.id)) errors.push(`${sprite.id} is duplicated`);
    seen.add(sprite.id);
    if (sprite.id !== spriteIdFor(sprite.characterId, sprite.motion)) {
      errors.push(`${sprite.id} must match characterId/motion`);
    }
    if (sprite.frameWidth <= 0 || sprite.frameHeight <= 0) {
      errors.push(`${sprite.id} frame dimensions must be positive`);
    }
    if (sprite.frameCount <= 1) errors.push(`${sprite.id} frameCount must be greater than 1`);
    if (sprite.sourceFrames.length !== sprite.frameCount) {
      errors.push(`${sprite.id} sourceFrames must match frameCount`);
    }
    if (sprite.fps <= 0) errors.push(`${sprite.id} fps must be positive`);
    if (sprite.stillFrame < 0 || sprite.stillFrame >= sprite.frameCount) {
      errors.push(`${sprite.id} stillFrame must be inside frame range`);
    }
    if (sprite.anchor.x < 0 || sprite.anchor.x > 1 || sprite.anchor.y < 0 || sprite.anchor.y > 1) {
      errors.push(`${sprite.id} anchor must be normalized`);
    }
    if (sprite.display) {
      if (sprite.display.width <= 0 || sprite.display.height <= 0 || sprite.display.scale <= 0) {
        errors.push(`${sprite.id} display values must be positive`);
      }
    }
    if (sprite.stageCue) {
      if (sprite.stageCue.x < 0 || sprite.stageCue.x > 100 || sprite.stageCue.y < 0 || sprite.stageCue.y > 100) {
        errors.push(`${sprite.id} stageCue coordinates must be percentages`);
      }
    }
    if (sprite.eventFrames) {
      const eventEntries = Object.entries(sprite.eventFrames);
      for (const [name, frame] of eventEntries) {
        if (frame !== undefined && (frame < 0 || frame >= sprite.frameCount)) {
          errors.push(`${sprite.id} ${name} must be inside frame range`);
        }
      }
      if (
        sprite.eventFrames.pourStart !== undefined &&
        sprite.eventFrames.pourEnd !== undefined &&
        sprite.eventFrames.pourStart > sprite.eventFrames.pourEnd
      ) {
        errors.push(`${sprite.id} pourStart must be before pourEnd`);
      }
      if (
        sprite.eventFrames.pourHoldStart !== undefined &&
        sprite.eventFrames.pourStart !== undefined &&
        sprite.eventFrames.pourHoldStart < sprite.eventFrames.pourStart
      ) {
        errors.push(`${sprite.id} pourHoldStart must not be before pourStart`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
};
