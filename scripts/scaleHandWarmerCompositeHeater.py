"""Render every CAL-00..CAL-12 apparatus state from canonical source layers.

The historical filename is retained for callers, but this is no longer an
incremental heater patch.  It is the one idempotent Pillow compositor used on
every platform.  Geometry comes from calorimeter-scene.v1.json; no CAL output
is ever used as an input to another CAL output.
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter


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


def load_rgba(path: Path) -> Image.Image:
    with Image.open(path) as image:
        return image.convert("RGBA")


def resized(image: Image.Image, scale: float) -> Image.Image:
    return image.resize(
        (round(image.width * scale), round(image.height * scale)),
        Image.Resampling.LANCZOS,
    )


def transformed(image: Image.Image, transform: dict) -> Image.Image:
    layer = resized(image, float(transform["scale"]))
    rotation = float(transform.get("rotationDeg", 0))
    if rotation:
        layer = layer.rotate(-rotation, resample=Image.Resampling.BICUBIC, expand=True)
    return layer


def alpha_composite_at(canvas: Image.Image, layer: Image.Image, transform: dict) -> None:
    canvas.alpha_composite(layer, (round(transform["x"]), round(transform["y"])))


def support_ring_foreground(ring: Image.Image, component: dict) -> Image.Image:
    transform = component["transform"]
    scaled = resized(ring, float(transform["scale"]))
    source_bounds = component["sourceMask"]["bounds"]
    scale = float(transform["scale"])
    left = round(source_bounds["x"] * scale)
    top = round(source_bounds["y"] * scale)
    right = round((source_bounds["x"] + source_bounds["width"]) * scale)
    bottom = round((source_bounds["y"] + source_bounds["height"]) * scale)
    center_y = round((source_bounds["y"] + source_bounds["height"] / 2) * scale)

    mask = Image.new("L", scaled.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((left, top, right, bottom), fill=255)
    draw.rectangle((0, 0, scaled.width, center_y - 1), fill=0)
    feather = float(component["sourceMask"].get("featherPx", 0))
    if feather:
        mask = mask.filter(ImageFilter.GaussianBlur(feather))
    mask = Image.composite(scaled.getchannel("A"), Image.new("L", scaled.size, 0), mask)
    foreground = scaled.copy()
    foreground.putalpha(mask)
    return foreground


def contact_shadow(bounds: dict, opacity: float, blur_px: float) -> Image.Image:
    width = round(bounds["width"])
    height = round(bounds["height"])
    alpha = Image.new("L", (width, height), 0)
    inset_x = max(2, round(width * 0.04))
    inset_y = max(2, round(height * 0.2))
    ImageDraw.Draw(alpha).ellipse(
        (inset_x, inset_y, width - inset_x, height - inset_y),
        fill=round(255 * opacity),
    )
    alpha = alpha.filter(ImageFilter.GaussianBlur(blur_px))
    shadow = Image.new("RGBA", alpha.size, (0, 0, 0, 0))
    shadow.putalpha(alpha)
    return shadow


def water_overlay(canvas_size: tuple[int, int], solution: bool = False) -> Image.Image:
    overlay = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    fill = (125, 211, 252, 66) if not solution else (103, 232, 249, 78)
    stroke = (14, 116, 144, 166)
    draw.polygon(((858, 612), (1022, 612), (1010, 748), (870, 748)), fill=fill)
    draw.line(((870, 748), (1010, 748)), fill=stroke, width=3)
    draw.ellipse((858, 594, 1022, 630), fill=fill, outline=stroke, width=4)
    return overlay


def stirring_overlay(canvas_size: tuple[int, int]) -> Image.Image:
    overlay = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    color = (8, 145, 178, 230)
    draw.arc((858, 592, 1022, 650), start=20, end=155, fill=color, width=8)
    draw.arc((858, 592, 1022, 650), start=200, end=335, fill=color, width=8)
    return overlay


def particle_overlay(canvas_size: tuple[int, int], weighed: bool) -> Image.Image:
    overlay = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    if weighed:
        circles = ((278, 914, 12), (316, 902, 11), (350, 925, 11), (388, 909, 10))
        fill, outline = (226, 232, 240, 245), (100, 116, 139, 204)
    else:
        circles = ((891, 704, 7), (925, 723, 8), (968, 706, 7), (996, 728, 6))
        fill, outline = (120, 53, 15, 235), (255, 255, 255, 140)
    for x, y, radius in circles:
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=fill, outline=outline, width=2)
    return overlay


def masked_probe(
    layer: Image.Image,
    transform: dict,
    cover_layer: Image.Image,
    cover_transform: dict,
    crossing_y: float,
    occlusion_y: int | None,
) -> Image.Image:
    alpha = layer.getchannel("A")
    cover_on_probe = Image.new("L", layer.size, 0)
    cover_on_probe.paste(
        cover_layer.getchannel("A"),
        (
            round(cover_transform["x"] - transform["x"]),
            round(cover_transform["y"] - transform["y"]),
        ),
    )
    start = max(0, min(layer.height, round(crossing_y - transform["y"])))
    keep = Image.new("L", layer.size, 255)
    if start < layer.height:
        inverted_cover = ImageChops.invert(cover_on_probe)
        keep.paste(inverted_cover.crop((0, start, layer.width, layer.height)), (0, start))
    alpha = ImageChops.multiply(alpha, keep)
    if occlusion_y is not None:
        cutoff = max(0, min(layer.height, round(occlusion_y - transform["y"])))
        if cutoff < layer.height:
            ImageDraw.Draw(alpha).rectangle((0, cutoff, layer.width, layer.height), fill=0)
    result = layer.copy()
    result.putalpha(alpha)
    return result


def validate_geometry(scene: dict, assets: dict[str, Image.Image]) -> None:
    components = scene["canonicalComponents"]
    references = scene["assetReferences"]

    heater = components["hot-plate-stirrer"]["transform"]
    heater_center = references["hot-plate-stirrer"]["anchors"]["platformCenter"]
    heater_axis = heater["x"] + heater_center["x"] * heater["scale"]
    cup = components["outer-cup"]["transform"]
    cup_center = references["polystyrene-cup-8oz"]["measuredAnchors"]["rimCenter"]
    cup_axis = cup["x"] + cup_center["x"] * cup["scale"]
    if abs(heater_axis - cup_axis) > 8:
        raise ValueError(f"Heater/cup axes differ by {abs(heater_axis - cup_axis):.2f}px.")

    cover_transform = components["closed-cover"]["transform"]
    cover_bounds = assets["wooden-calorimeter-cover"].getchannel("A").getbbox()
    if not cover_bounds:
        raise ValueError("Wooden cover has no visible alpha bounds.")
    cover_width = (cover_bounds[2] - cover_bounds[0]) * cover_transform["scale"]
    if not 205 <= cover_width <= 220:
        raise ValueError(f"Wooden cover visible width is {cover_width:.1f}px, expected 205..220px.")
    cover_hole = references["wooden-calorimeter-cover"]["measuredAnchors"]["probeHoleCenter"]
    hole_scene = (
        cover_transform["x"] + cover_hole["x"] * cover_transform["scale"],
        cover_transform["y"] + cover_hole["y"] * cover_transform["scale"],
    )
    if max(abs(hole_scene[0] - 940), abs(hole_scene[1] - 600)) > 1:
        raise ValueError(f"Cover hole is at {hole_scene}, expected (940, 600).")

    probe_transform = components["closed-probe"]["transform"]
    probe_ref = references["probe-thermometer"]["measuredAnchors"]
    shaft_scene = (
        probe_transform["x"] + probe_ref["shaftLidCrossing"]["x"] * probe_transform["scale"],
        probe_transform["y"] + probe_ref["shaftLidCrossing"]["y"] * probe_transform["scale"],
    )
    tip_scene_y = probe_transform["y"] + probe_ref["probeTip"]["y"] * probe_transform["scale"]
    if max(abs(shaft_scene[0] - 940), abs(shaft_scene[1] - 600)) > 1:
        raise ValueError(f"Probe shaft crossing is at {shaft_scene}, expected (940, 600).")
    if not 870 <= tip_scene_y <= 880:
        raise ValueError(f"Probe tip is at y={tip_scene_y:.1f}, expected 870..880.")
    probe_bounds = assets["probe-thermometer"].getchannel("A").getbbox()
    if not probe_bounds:
        raise ValueError("Probe thermometer has no visible alpha bounds.")
    head_width = (probe_bounds[2] - probe_bounds[0]) * probe_transform["scale"]
    if head_width > 90:
        raise ValueError(f"Probe display head is {head_width:.1f}px wide, expected at most 90px.")


def main() -> None:
    scene = json.loads(SCENE_PATH.read_text(encoding="utf-8"))
    canvas_size = (
        int(scene["coordinateSystem"]["canvas"]["width"]),
        int(scene["coordinateSystem"]["canvas"]["height"]),
    )
    component_specs = scene["canonicalComponents"]
    assets = {
        asset_id: load_rgba(ASSET_DIR / f"{asset_id}.png")
        for asset_id in {
            "ring-stand",
            "hot-plate-stirrer",
            "polystyrene-cup-8oz",
            "wooden-calorimeter-cover",
            "probe-thermometer",
            "magnetic-stir-bar",
            "weigh-boat",
        }
    }
    # Scene identifiers distinguish the support-ring role from the canonical asset filename.
    assets["ring-stand-support-ring"] = assets["ring-stand"]
    validate_geometry(scene, assets)

    foreground = support_ring_foreground(assets["ring-stand"], component_specs["ring-support-foreground"])
    occlusion_y = int(scene["maskedRegions"]["inner-cup-interior"]["frontWallOcclusionStartsAtY"])
    component_layers: dict[str, tuple[Image.Image, dict]] = {}
    for component_id, component in component_specs.items():
        if component_id in {"ring-stand-back", "ring-support-foreground"}:
            continue
        asset = assets.get(component["assetId"])
        if asset is None:
            continue
        layer = transformed(asset, component["transform"])
        component_layers[component_id] = (layer, component["transform"])
    probe_reference = scene["assetReferences"]["probe-thermometer"]["measuredAnchors"]["shaftLidCrossing"]
    for probe_id, cover_id, final_occlusion in (
        ("closed-probe", "closed-cover", occlusion_y),
        ("open-probe", "open-cover", None),
    ):
        probe_layer, probe_transform = component_layers[probe_id]
        cover_layer, cover_transform = component_layers[cover_id]
        crossing_y = probe_transform["y"] + probe_reference["y"] * probe_transform["scale"]
        component_layers[probe_id] = (
            masked_probe(
                probe_layer,
                probe_transform,
                cover_layer,
                cover_transform,
                crossing_y,
                final_occlusion,
            ),
            probe_transform,
        )
    component_layers["ring-stand-back"] = component_layers["ring-stand-full"]
    component_layers["ring-support-foreground"] = (
        foreground,
        component_specs["ring-support-foreground"]["transform"],
    )

    shadows = {
        item["id"]: (
            contact_shadow(item["bounds"], float(item["opacity"]), float(item["blurPx"])),
            (round(item["bounds"]["x"]), round(item["bounds"]["y"])),
        )
        for item in scene["overlayPolicy"]["contactShadows"]
    }
    overlay_images = {
        "liquid-fill:water": water_overlay(canvas_size),
        "liquid-fill:solution": water_overlay(canvas_size, solution=True),
        "stirring": stirring_overlay(canvas_size),
        "undissolved-solid:runtime": particle_overlay(canvas_size, weighed=False),
        "weigh-boat-solid:runtime": particle_overlay(canvas_size, weighed=True),
    }

    state_ids = []
    for state in scene["states"]:
        state_id = state["id"]
        state_ids.append(state_id)
        canvas = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
        visible = sorted(
            state["visibleComponents"],
            key=lambda item: component_specs[item]["transform"]["z"],
        )
        overlays = set(state.get("overlays", []))

        for component_id in visible:
            z = component_specs[component_id]["transform"]["z"]
            if z >= 35:
                for overlay_id in ("liquid-fill:water", "liquid-fill:solution"):
                    if overlay_id in overlays:
                        canvas.alpha_composite(overlay_images[overlay_id])
                        overlays.remove(overlay_id)
                if "weigh-boat-solid:runtime" in overlays and z >= 37:
                    canvas.alpha_composite(overlay_images["weigh-boat-solid:runtime"])
                    overlays.remove("weigh-boat-solid:runtime")
                if "undissolved-solid:runtime" in overlays and z >= 40:
                    canvas.alpha_composite(overlay_images["undissolved-solid:runtime"])
                    overlays.remove("undissolved-solid:runtime")
                if "stirring" in overlays and z >= 41:
                    canvas.alpha_composite(overlay_images["stirring"])
                    overlays.remove("stirring")
            layer, transform = component_layers[component_id]
            if component_id == "hot-plate-stirrer" and "stirrer-bench-contact" in overlays:
                shadow, point = shadows["stirrer-bench-contact"]
                canvas.alpha_composite(shadow, point)
                overlays.remove("stirrer-bench-contact")
            alpha_composite_at(canvas, layer, transform)

        for overlay_id in ("liquid-fill:water", "liquid-fill:solution", "weigh-boat-solid:runtime", "undissolved-solid:runtime", "stirring"):
            if overlay_id in overlays:
                canvas.alpha_composite(overlay_images[overlay_id])
        output = ASSET_DIR / f"hand-warmer-calorimeter-{state_id.lower()}.png"
        canvas.save(output)

    reference_crop = (650, 990, 1210, 1510)
    reference = load_rgba(ASSET_DIR / "hand-warmer-calorimeter-cal-01.png").crop(reference_crop).tobytes()
    for state_id in state_ids[2:]:
        crop = load_rgba(ASSET_DIR / f"hand-warmer-calorimeter-{state_id.lower()}.png").crop(reference_crop)
        if crop.tobytes() != reference:
            raise ValueError(f"{state_id} changed the inherited heater/base region.")
    print("Rendered CAL-00 through CAL-12 from original component layers with Pillow.")


if __name__ == "__main__":
    main()
