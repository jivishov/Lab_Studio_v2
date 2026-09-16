from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "public" / "assets" / "goblin-mode" / "sprites" / "v1" / "manifest.json"


def asset_path(url: str) -> Path:
    return ROOT / "public" / url


def fail(message: str) -> None:
    raise AssertionError(message)


def assert_transparent_corners(image: Image.Image, label: str) -> None:
    rgba = image.convert("RGBA")
    width, height = rgba.size
    for x, y in [(0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)]:
        r, g, b, a = rgba.getpixel((x, y))
        if a > 4:
            fail(f"{label} has non-transparent corner at {(x, y)}: {(r, g, b, a)}")
        if a > 0 and (g > 240 and r < 24 and b < 24):
            fail(f"{label} still has chroma-key green at {(x, y)}")


def validate_optional_metadata(sprite: dict, sprite_id: str, frame_count: int) -> None:
    display = sprite.get("display")
    if display is not None:
        for key in ("width", "height", "scale"):
            if float(display.get(key, 0)) <= 0:
                fail(f"{sprite_id} display.{key} must be positive.")

    stage_cue = sprite.get("stageCue")
    if stage_cue is not None:
        if not 0 <= float(stage_cue.get("x", -1)) <= 100:
            fail(f"{sprite_id} stageCue.x must be a percentage.")
        if not 0 <= float(stage_cue.get("y", -1)) <= 100:
            fail(f"{sprite_id} stageCue.y must be a percentage.")
        if stage_cue.get("facing") not in ("left", "right"):
            fail(f"{sprite_id} stageCue.facing must be left or right.")

    events = sprite.get("eventFrames")
    if events is not None:
        for key, value in events.items():
            if value is None:
                continue
            frame = int(value)
            if frame < 0 or frame >= frame_count:
                fail(f"{sprite_id} eventFrames.{key} must be inside the frame range.")
        pour_start = events.get("pourStart")
        pour_end = events.get("pourEnd")
        if pour_start is not None and pour_end is not None and int(pour_start) > int(pour_end):
            fail(f"{sprite_id} eventFrames.pourStart must be before pourEnd.")
        pour_hold_start = events.get("pourHoldStart")
        if pour_hold_start is not None and pour_start is not None and int(pour_hold_start) < int(pour_start):
            fail(f"{sprite_id} eventFrames.pourHoldStart must not be before pourStart.")


def validate_contact_sheet(sprite: dict, sprite_id: str, key: str) -> None:
    contact_url = sprite.get(key)
    if not contact_url:
        return
    contact_path = asset_path(contact_url)
    if not contact_path.exists():
        fail(f"{sprite_id} {key} missing: {contact_path}")
    with Image.open(contact_path) as contact:
        if contact.mode not in ("RGBA", "RGB"):
            fail(f"{sprite_id} {key} must be an image contact sheet; got {contact.mode}")


def validate_manifest() -> None:
    if not MANIFEST_PATH.exists():
        fail(f"Missing manifest: {MANIFEST_PATH}")
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    sprites = manifest.get("sprites")
    if not isinstance(sprites, list) or not sprites:
        fail("Manifest must contain at least one sprite.")

    for sprite in sprites:
        sprite_id = sprite.get("id", "<unknown>")
        frame_width = int(sprite["frameWidth"])
        frame_height = int(sprite["frameHeight"])
        frame_count = int(sprite["frameCount"])
        validate_optional_metadata(sprite, sprite_id, frame_count)
        source_frames = sprite.get("sourceFrames")
        if not isinstance(source_frames, list) or len(source_frames) != frame_count:
            fail(f"{sprite_id} sourceFrames must match frameCount.")

        for index, frame_url in enumerate(source_frames):
            frame_path = asset_path(frame_url)
            if not frame_path.exists():
                fail(f"{sprite_id} frame {index} missing: {frame_path}")
            with Image.open(frame_path) as frame:
                if frame.size != (frame_width, frame_height):
                    fail(f"{sprite_id} frame {index} is {frame.size}, expected {(frame_width, frame_height)}")
                if frame.mode not in ("RGBA", "LA"):
                    fail(f"{sprite_id} frame {index} must include alpha; got {frame.mode}")
                assert_transparent_corners(frame, f"{sprite_id} frame {index}")

        sheet_path = asset_path(sprite["sheetUrl"])
        if not sheet_path.exists():
            fail(f"{sprite_id} sheet missing: {sheet_path}")
        with Image.open(sheet_path) as sheet:
            expected_sheet_size = (frame_width * frame_count, frame_height)
            if sheet.size != expected_sheet_size:
                fail(f"{sprite_id} sheet is {sheet.size}, expected {expected_sheet_size}")
            if sheet.mode not in ("RGBA", "LA"):
                fail(f"{sprite_id} sheet must include alpha; got {sheet.mode}")
            assert_transparent_corners(sheet.crop((0, 0, frame_width, frame_height)), f"{sprite_id} sheet first frame")

        validate_contact_sheet(sprite, sprite_id, "contactSheetUrl")
        validate_contact_sheet(sprite, sprite_id, "sourceContactSheetUrl")


if __name__ == "__main__":
    try:
        validate_manifest()
    except AssertionError as error:
        print(error, file=sys.stderr)
        sys.exit(1)
