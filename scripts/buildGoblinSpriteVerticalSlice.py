from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SPRITE_ROOT = ROOT / "public" / "assets" / "goblin-mode" / "sprites" / "v1"
SOURCE_ROOT = SPRITE_ROOT / "source" / "apparatus-helper" / "pour"
SHEET_ROOT = SPRITE_ROOT / "sheets"
CONTACT_ROOT = SPRITE_ROOT / "contact"

FRAME_WIDTH = 512
FRAME_HEIGHT = 512
FRAME_COUNT = 16
FPS = 12
STILL_FRAME = 15

SHEET_URL = "assets/goblin-mode/sprites/v1/sheets/apparatus-helper-pour.png"
CONTACT_URL = "assets/goblin-mode/sprites/v1/contact/apparatus-helper-pour-contact.png"
SOURCE_CONTACT_URL = "assets/goblin-mode/sprites/v1/contact/apparatus-helper-pour-source-contact.png"


def frame_url(index: int) -> str:
    return f"assets/goblin-mode/sprites/v1/source/apparatus-helper/pour/frame-{index:02d}.png"


def load_source_frames() -> list[Image.Image]:
    frames: list[Image.Image] = []
    for index in range(FRAME_COUNT):
        path = SOURCE_ROOT / f"frame-{index:02d}.png"
        if not path.exists():
            raise FileNotFoundError(f"Missing source sprite frame: {path}")
        frame = Image.open(path).convert("RGBA")
        if frame.size != (FRAME_WIDTH, FRAME_HEIGHT):
            raise ValueError(f"{path} is {frame.size}, expected {(FRAME_WIDTH, FRAME_HEIGHT)}")
        frames.append(frame)
    return frames


def write_sheet(frames: list[Image.Image]) -> None:
    SHEET_ROOT.mkdir(parents=True, exist_ok=True)
    sheet = Image.new("RGBA", (FRAME_WIDTH * FRAME_COUNT, FRAME_HEIGHT), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        sheet.alpha_composite(frame, (index * FRAME_WIDTH, 0))
    sheet.save(SPRITE_ROOT / "sheets" / "apparatus-helper-pour.png")


def write_contact_sheet(frames: list[Image.Image], filename: str) -> None:
    CONTACT_ROOT.mkdir(parents=True, exist_ok=True)
    columns = 4
    rows = 4
    contact = Image.new("RGBA", (FRAME_WIDTH * columns, FRAME_HEIGHT * rows), (244, 248, 246, 255))
    for index, frame in enumerate(frames):
        tile = Image.new("RGBA", (FRAME_WIDTH, FRAME_HEIGHT), (244, 248, 246, 255))
        tile.alpha_composite(frame)
        contact.alpha_composite(tile, ((index % columns) * FRAME_WIDTH, (index // columns) * FRAME_HEIGHT))
    contact.save(CONTACT_ROOT / filename)


def write_manifest() -> None:
    manifest = {
        "version": "v1",
        "sprites": [
            {
                "id": "apparatus-helper/pour",
                "characterId": "apparatus-helper",
                "motion": "pour",
                "sheetUrl": SHEET_URL,
                "sourceFrames": [frame_url(index) for index in range(FRAME_COUNT)],
                "contactSheetUrl": CONTACT_URL,
                "sourceContactSheetUrl": SOURCE_CONTACT_URL,
                "frameWidth": FRAME_WIDTH,
                "frameHeight": FRAME_HEIGHT,
                "frameCount": FRAME_COUNT,
                "fps": FPS,
                "loop": True,
                "stillFrame": STILL_FRAME,
                "anchor": {"x": 0.5, "y": 1},
                "scale": 1.0,
                "display": {"width": 288, "height": 288, "scale": 1.0},
                "stageCue": {"x": 56, "y": 83, "facing": "right"},
                "eventFrames": {"pourStart": 9, "pourHoldStart": 9, "pourEnd": 11},
                "status": "vertical-slice",
            }
        ],
    }
    (SPRITE_ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    frames = load_source_frames()
    write_sheet(frames)
    write_contact_sheet(frames, "apparatus-helper-pour-contact.png")
    write_contact_sheet(frames, "apparatus-helper-pour-source-contact.png")
    write_manifest()


if __name__ == "__main__":
    main()
