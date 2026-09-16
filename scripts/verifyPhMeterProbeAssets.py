from __future__ import annotations

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "public" / "assets" / "equipment-realistic" / "v1"
PROBE_CROP = (955, 220, 1090, 1100)
DETACHED_EDIT_BOUNDS = (760, 100, 1110, 1110)


def main() -> None:
    master = Image.open(ASSET_DIR / "ph-meter.png").convert("RGBA")
    probe = Image.open(ASSET_DIR / "ph-meter-probe.png").convert("RGBA")
    detached = Image.open(ASSET_DIR / "ph-meter-probe-detached-console.png").convert("RGBA")
    source_crop = master.crop(PROBE_CROP)

    assert probe.size == source_crop.size, "Probe dimensions must match the declared master crop."
    for source, extracted in zip(source_crop.getdata(), probe.getdata()):
        if extracted[3] > 0:
            assert extracted == source, "Probe contains a non-source pixel."

    assert detached.size == master.size, "Detached console must preserve master dimensions."
    left, top, right, bottom = DETACHED_EDIT_BOUNDS
    for y in range(master.height):
        for x in range(master.width):
            if left <= x < right and top <= y < bottom:
                continue
            assert detached.getpixel((x, y)) == master.getpixel((x, y)), (
                "Detached console changed a pixel outside the declared parked-probe/lead region."
            )


if __name__ == "__main__":
    main()
