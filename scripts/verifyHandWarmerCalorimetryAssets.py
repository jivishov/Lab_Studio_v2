"""Focused regression checks for hand-warmer production assets and CAL geometry."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageChops


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "public" / "assets" / "equipment-realistic" / "v1"
SCENE_PATH = (
    ROOT
    / "experiments"
    / "lab-studio"
    / "docs"
    / "hand-warmer-calorimetry"
    / "calorimeter-scene.v1.json"
)
PRODUCTION_ASSETS = (
    "wooden-calorimeter-cover",
    "probe-thermometer",
    "magnetic-stir-bar",
    "beaker-150ml",
)


def rgba(name: str) -> Image.Image:
    with Image.open(ASSET_DIR / f"{name}.png") as image:
        return image.convert("RGBA")


def main() -> None:
    scene = json.loads(SCENE_PATH.read_text(encoding="utf-8"))
    for name in PRODUCTION_ASSETS:
        image = rgba(name)
        assert image.size == (1254, 1254), (name, image.size)
        alpha = image.getchannel("A")
        assert alpha.getbbox(), f"{name} has no visible alpha"
        assert all(alpha.getpixel(point) == 0 for point in ((0, 0), (1253, 0), (0, 1253), (1253, 1253)))
        svg = (ASSET_DIR / f"{name}.svg").read_text(encoding="utf-8")
        assert "placeholder" not in svg.lower(), name

    cover = rgba("wooden-calorimeter-cover").getchannel("A")
    assert cover.getpixel((632, 582)) == 0, "wooden cover hole is not transparent"
    assert cover.getpixel((632, 520)) > 200, "wooden cover does not surround the hole"

    heater_crop = (650, 990, 1210, 1510)
    inherited = rgba("hand-warmer-calorimeter-cal-01").crop(heater_crop).tobytes()
    for index in range(2, 13):
        state = rgba(f"hand-warmer-calorimeter-cal-{index:02d}")
        assert state.crop(heater_crop).tobytes() == inherited, f"CAL-{index:02d} accumulated heater pixels"

    cal04 = rgba("hand-warmer-calorimeter-cal-04")
    cal05 = rgba("hand-warmer-calorimeter-cal-05")
    probe_delta = ImageChops.difference(cal04, cal05).getbbox()
    assert probe_delta is not None, "CAL-05 does not add the probe"
    assert probe_delta[1] < 550 and probe_delta[3] <= 735, probe_delta

    probe_transform = scene["canonicalComponents"]["closed-probe"]["transform"]
    anchors = scene["assetReferences"]["probe-thermometer"]["measuredAnchors"]
    crossing_x = probe_transform["x"] + anchors["shaftLidCrossing"]["x"] * probe_transform["scale"]
    crossing_y = probe_transform["y"] + anchors["shaftLidCrossing"]["y"] * probe_transform["scale"]
    tip_y = probe_transform["y"] + anchors["probeTip"]["y"] * probe_transform["scale"]
    assert abs(crossing_x - 940) <= 1 and abs(crossing_y - 600) <= 1
    assert 870 <= tip_y <= 880

    print("Hand-warmer asset regression checks passed.")


if __name__ == "__main__":
    main()
