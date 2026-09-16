from __future__ import annotations

import base64
from collections.abc import Callable
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "assets" / "equipment-realistic" / "v1"


def asset(name: str) -> Image.Image:
    return Image.open(OUT / f"{name}.png").convert("RGBA")


def write_asset(name: str, label: str, image: Image.Image) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    png_path = OUT / f"{name}.png"
    image.save(png_path)
    print(f"wrote {png_path.relative_to(ROOT)}")
    write_png_wrapper(name, label)


def write_existing_photo_asset(name: str, label: str) -> None:
    png_path = OUT / f"{name}.png"
    if not png_path.exists():
        raise FileNotFoundError(f"Expected curated photorealistic PNG at {png_path}")
    write_png_wrapper(name, label)


CURATED_PHOTO_ASSET_IDS = {
    "cuvette",
    "luer-lock-syringe-locked",
    "pencil",
    "spectrophotometer",
    "spectrophotometer-cuvette-inserted",
}


def write_generated_or_curated_asset(name: str, label: str, image_factory: Callable[[], Image.Image]) -> None:
    if name in CURATED_PHOTO_ASSET_IDS:
        write_existing_photo_asset(name, label)
        return
    write_asset(name, label, image_factory())


def write_png_wrapper(name: str, label: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    png_path = OUT / f"{name}.png"
    svg_path = OUT / f"{name}.svg"
    with Image.open(png_path) as png:
        width, height = png.size
    data = base64.b64encode(png_path.read_bytes()).decode("ascii")
    svg = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}" role="img" aria-label="{label}">\n'
        f'  <image width="{width}" height="{height}" href="data:image/png;base64,{data}" '
        'preserveAspectRatio="xMidYMid meet"/>\n'
        "</svg>\n"
    )
    svg_path.write_text(svg, encoding="utf-8")
    print(f"wrote {svg_path.relative_to(ROOT)}")


def paste_fit(canvas: Image.Image, source: Image.Image, box: tuple[int, int, int, int]) -> None:
    x, y, width, height = box
    scale = min(width / source.width, height / source.height)
    resized = source.resize((max(1, round(source.width * scale)), max(1, round(source.height * scale))), Image.LANCZOS)
    px = x + (width - resized.width) // 2
    py = y + (height - resized.height) // 2
    canvas.alpha_composite(resized, (px, py))


def shadow(canvas: Image.Image, ellipse: tuple[int, int, int, int], opacity: int = 50) -> None:
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw.ellipse(ellipse, fill=(20, 30, 35, opacity))
    canvas.alpha_composite(layer.filter(ImageFilter.GaussianBlur(18)))


def draw_pencil() -> Image.Image:
    scale = 4
    width, height = 1254, 260
    image = Image.new("RGBA", (width * scale, height * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    s = scale

    shadow(image, (90 * s, 178 * s, 1126 * s, 240 * s), 38)

    def pts(points: list[tuple[int, int]]) -> list[tuple[int, int]]:
        return [(x * s, y * s) for x, y in points]

    body_top = pts([(206, 93), (924, 45), (1032, 96), (312, 148)])
    body_mid = pts([(206, 115), (927, 68), (1032, 96), (312, 171)])
    body_bottom = pts([(312, 171), (1032, 96), (1016, 126), (332, 185)])
    draw.polygon(body_top, fill=(249, 197, 66, 255), outline=(116, 84, 34, 210))
    draw.polygon(body_mid, fill=(236, 174, 48, 255), outline=(117, 81, 31, 180))
    draw.polygon(body_bottom, fill=(180, 116, 35, 255), outline=(95, 66, 29, 185))

    # Polished facets, subtle lacquer grain, and softened wear near the edges.
    draw.line(pts([(235, 104), (916, 59), (1006, 100)]), fill=(255, 232, 128, 190), width=6 * s)
    draw.line(pts([(252, 125), (912, 82), (1000, 108)]), fill=(255, 211, 88, 145), width=3 * s)
    draw.line(pts([(334, 177), (1014, 119)]), fill=(102, 66, 28, 115), width=4 * s)
    for index, x in enumerate(range(270, 910, 70)):
        offset = (index % 3) - 1
        draw.line(
            pts([(x, 99 + offset), (x + 76, 94 + offset)]),
            fill=(125, 78, 24, 24),
            width=1 * s,
        )
        draw.line(
            pts([(x + 12, 118 + offset), (x + 82, 113 + offset)]),
            fill=(255, 237, 133, 22),
            width=1 * s,
        )

    wood = pts([(924, 45), (1032, 96), (1104, 68), (1036, 24)])
    graphite = pts([(1032, 96), (1104, 68), (1072, 116)])
    draw.polygon(wood, fill=(204, 162, 94, 255), outline=(92, 63, 36, 190))
    draw.polygon(pts([(939, 51), (1034, 89), (1070, 75), (1028, 33)]), fill=(218, 180, 110, 235))
    draw.line(pts([(927, 47), (1032, 96)]), fill=(118, 72, 32, 130), width=2 * s)
    draw.polygon(graphite, fill=(40, 38, 37, 255), outline=(20, 20, 20, 160))
    draw.line(pts([(1088, 72), (1072, 116)]), fill=(8, 8, 8, 110), width=2 * s)

    ferrule = (166 * s, 95 * s, 224 * s, 162 * s)
    draw.rounded_rectangle(ferrule, radius=6 * s, fill=(178, 188, 184, 255), outline=(80, 88, 86, 210), width=3 * s)
    for x in (177, 191, 208):
        draw.line((x * s, 100 * s, x * s, 157 * s), fill=(236, 241, 238, 70), width=2 * s)
        draw.line(((x + 4) * s, 100 * s, (x + 4) * s, 157 * s), fill=(84, 92, 90, 58), width=1 * s)
    draw.rounded_rectangle((110 * s, 103 * s, 170 * s, 164 * s), radius=11 * s, fill=(197, 76, 78, 255), outline=(98, 43, 45, 210), width=4 * s)
    draw.rounded_rectangle((116 * s, 109 * s, 164 * s, 156 * s), radius=8 * s, fill=(218, 100, 102, 78))

    image = image.filter(ImageFilter.UnsharpMask(radius=1.0 * s, percent=85, threshold=4))
    return image.resize((width, height), Image.LANCZOS)


def draw_luer_lock_syringe_locked() -> Image.Image:
    scale = 4
    width, height = 1200, 360
    image = Image.new("RGBA", (width * scale, height * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    s = scale

    shadow(image, (118 * s, 236 * s, 1116 * s, 314 * s), 28)

    def pts(points: list[tuple[int, int]]) -> list[tuple[int, int]]:
        return [(x * s, y * s) for x, y in points]

    # Plunger thumb rest and shaft.
    draw.rounded_rectangle((72 * s, 92 * s, 132 * s, 246 * s), radius=16 * s, fill=(232, 241, 246, 255), outline=(58, 77, 91, 210), width=5 * s)
    draw.rounded_rectangle((132 * s, 122 * s, 276 * s, 218 * s), radius=28 * s, fill=(202, 215, 224, 236), outline=(62, 83, 96, 196), width=5 * s)
    draw.rectangle((132 * s, 168 * s, 276 * s, 178 * s), fill=(70, 91, 104, 130))
    for x in (158, 184):
        draw.line((x * s, 112 * s, (x + 72) * s, 246 * s), fill=(43, 59, 70, 210), width=7 * s)

    # Clear barrel with thick plastic walls; the interior is intentionally empty.
    barrel_outer = (278 * s, 94 * s, 918 * s, 250 * s)
    barrel_inner = (322 * s, 132 * s, 858 * s, 214 * s)
    draw.rounded_rectangle(barrel_outer, radius=62 * s, fill=(221, 241, 250, 70), outline=(54, 80, 96, 190), width=7 * s)
    draw.rounded_rectangle((292 * s, 108 * s, 902 * s, 238 * s), radius=52 * s, fill=(199, 232, 244, 50), outline=(105, 140, 155, 100), width=3 * s)
    draw.rounded_rectangle(barrel_inner, radius=38 * s, fill=(255, 255, 255, 20), outline=(244, 253, 255, 170), width=3 * s)
    draw.line((322 * s, 139 * s, 820 * s, 139 * s), fill=(255, 255, 255, 188), width=3 * s)
    draw.line((320 * s, 222 * s, 868 * s, 222 * s), fill=(43, 76, 90, 95), width=3 * s)
    draw.arc((294 * s, 104 * s, 918 * s, 250 * s), 184, 344, fill=(255, 255, 255, 112), width=5 * s)
    draw.arc((300 * s, 138 * s, 902 * s, 260 * s), 18, 166, fill=(30, 62, 76, 90), width=3 * s)

    # Printed graduations on the far wall.
    for index, x in enumerate(range(348, 836, 42)):
        y0 = 118 if index % 2 == 0 else 132
        y1 = 218 if index % 2 == 0 else 198
        draw.line((x * s, y0 * s, x * s, y1 * s), fill=(49, 77, 91, 150), width=2 * s)
    for y in (144, 180, 216):
        draw.line((324 * s, y * s, 820 * s, y * s), fill=(255, 255, 255, 155), width=2 * s)

    # Finger flange, luer collar, threaded nose, and lock cap.
    draw.rounded_rectangle((900 * s, 122 * s, 990 * s, 218 * s), radius=44 * s, fill=(214, 225, 233, 246), outline=(58, 80, 95, 190), width=6 * s)
    draw.ellipse((928 * s, 136 * s, 986 * s, 204 * s), fill=(190, 207, 218, 155), outline=(64, 86, 100, 190), width=4 * s)
    draw.rounded_rectangle((980 * s, 134 * s, 1124 * s, 208 * s), radius=22 * s, fill=(223, 232, 238, 248), outline=(72, 91, 104, 188), width=4 * s)
    draw.line((990 * s, 126 * s, 1034 * s, 218 * s), fill=(255, 255, 255, 210), width=5 * s)
    draw.rounded_rectangle((1106 * s, 146 * s, 1162 * s, 194 * s), radius=18 * s, fill=(208, 221, 230, 255), outline=(74, 93, 107, 190), width=4 * s)
    draw.line((1042 * s, 142 * s, 1090 * s, 142 * s), fill=(255, 255, 255, 96), width=2 * s)
    draw.line((1040 * s, 202 * s, 1094 * s, 202 * s), fill=(80, 99, 111, 85), width=2 * s)

    # Rear gasket and dense plastic edge definition.
    draw.rounded_rectangle((246 * s, 116 * s, 310 * s, 222 * s), radius=28 * s, fill=(185, 203, 214, 230), outline=(55, 77, 91, 160), width=4 * s)
    draw.arc((256 * s, 122 * s, 324 * s, 232 * s), 90, 270, fill=(255, 255, 255, 120), width=4 * s)
    draw.line((278 * s, 235 * s, 892 * s, 252 * s), fill=(25, 54, 68, 68), width=2 * s)

    # Fine molded-plastic stipple and machining marks.
    speckle = Image.new("RGBA", image.size, (0, 0, 0, 0))
    speckle_draw = ImageDraw.Draw(speckle)
    for y in range(106 * s, 238 * s, 10 * s):
        for x in range(294 * s + (y // (10 * s)) % (7 * s), 902 * s, 8 * s):
            seed = (x * 1664525 + y * 1013904223 + 73) & 0xFFFFFFFF
            shade = 255 if seed & 1 else 40
            speckle_draw.point((x, y), fill=(shade, shade, shade, 4 + seed % 10))
    image.alpha_composite(speckle.filter(ImageFilter.GaussianBlur(0.35 * s)))

    image = image.filter(ImageFilter.UnsharpMask(radius=0.9 * s, percent=82, threshold=4))
    return image.resize((width, height), Image.LANCZOS)


def draw_cuvette() -> Image.Image:
    scale = 4
    width, height = 420, 1254
    image = Image.new("RGBA", (width * scale, height * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    s = scale

    shadow(image, (96 * s, 1134 * s, 324 * s, 1198 * s), 26)

    outer = (116 * s, 68 * s, 304 * s, 1148 * s)
    inner = (148 * s, 156 * s, 272 * s, 1066 * s)
    chamber = (160 * s, 198 * s, 260 * s, 1018 * s)

    # Main rectangular glass body with soft blue edge tint.
    draw.rounded_rectangle(
        outer,
        radius=42 * s,
        fill=(226, 248, 255, 48),
        outline=(33, 90, 110, 155),
        width=7 * s,
    )
    draw.rounded_rectangle(
        inner,
        radius=24 * s,
        fill=(247, 255, 255, 32),
        outline=(76, 132, 148, 76),
        width=3 * s,
    )

    # Optical path chamber; empty and transparent so runtime liquid can render underneath.
    draw.rounded_rectangle(
        chamber,
        radius=18 * s,
        fill=(244, 254, 255, 24),
        outline=(39, 91, 108, 82),
        width=3 * s,
    )
    draw.rectangle((162 * s, 208 * s, 258 * s, 356 * s), fill=(255, 255, 255, 34))

    # Thick rim and base, including faint top and bottom ellipses.
    draw.rounded_rectangle((124 * s, 78 * s, 296 * s, 154 * s), radius=30 * s, fill=(236, 252, 255, 58), outline=(39, 92, 110, 130), width=5 * s)
    draw.rounded_rectangle((140 * s, 104 * s, 280 * s, 136 * s), radius=16 * s, fill=(255, 255, 255, 52), outline=(255, 255, 255, 112), width=2 * s)
    draw.ellipse((140 * s, 1042 * s, 280 * s, 1096 * s), fill=(234, 250, 255, 48), outline=(36, 88, 106, 92), width=3 * s)
    draw.arc((130 * s, 1090 * s, 290 * s, 1158 * s), 0, 180, fill=(255, 255, 255, 96), width=4 * s)
    draw.arc((132 * s, 1108 * s, 288 * s, 1162 * s), 0, 180, fill=(24, 76, 94, 65), width=3 * s)

    # Long specular reflections and darker rear edge.
    draw.line((156 * s, 116 * s, 156 * s, 1118 * s), fill=(255, 255, 255, 150), width=7 * s)
    draw.line((168 * s, 130 * s, 168 * s, 1086 * s), fill=(255, 255, 255, 55), width=3 * s)
    draw.line((282 * s, 132 * s, 282 * s, 1110 * s), fill=(23, 78, 96, 100), width=5 * s)
    draw.line((260 * s, 150 * s, 260 * s, 1038 * s), fill=(255, 255, 255, 34), width=2 * s)

    # Etched graduations on the left side.
    for index, y in enumerate(range(244, 978, 86)):
        length = 18 if index % 2 else 26
        draw.line((132 * s, y * s, (132 + length) * s, y * s), fill=(42, 91, 108, 130), width=2 * s)

    # Tiny deterministic glass speckle, clipped by alpha after downsampling.
    speckle = Image.new("RGBA", image.size, (0, 0, 0, 0))
    speckle_draw = ImageDraw.Draw(speckle)
    for y in range(120 * s, 1110 * s, 13 * s):
        for x in range(136 * s + (y // (13 * s)) % (9 * s), 288 * s, 9 * s):
            seed = (x * 1664525 + y * 1013904223) & 0xFFFFFFFF
            alpha = 8 + (seed % 13)
            shade = 255 if seed & 1 else 38
            speckle_draw.point((x, y), fill=(shade, shade, shade, alpha))
    image.alpha_composite(speckle.filter(ImageFilter.GaussianBlur(0.4 * s)))

    image = image.resize((width, height), Image.LANCZOS)
    return image


def draw_spectrophotometer() -> Image.Image:
    image = Image.new("RGBA", (1254, 760), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    shadow(image, (96, 602, 1158, 714), 58)
    draw.rounded_rectangle((118, 198, 1136, 632), radius=54, fill=(218, 224, 224, 255), outline=(78, 92, 96, 220), width=7)
    draw.rounded_rectangle((174, 245, 676, 566), radius=32, fill=(190, 199, 199, 255), outline=(84, 97, 102, 180), width=5)
    draw.rounded_rectangle((238, 290, 562, 388), radius=18, fill=(38, 69, 78, 255), outline=(18, 34, 40, 200), width=4)
    font = ImageFont.load_default()
    draw.text((284, 326), "630 nm", fill=(152, 226, 231, 255), font=font)
    draw.text((432, 326), "%T 42.0", fill=(152, 226, 231, 255), font=font)
    draw.rounded_rectangle((746, 250, 1046, 540), radius=38, fill=(54, 63, 67, 255), outline=(24, 31, 35, 220), width=5)
    draw.rounded_rectangle((800, 300, 992, 468), radius=16, fill=(16, 23, 27, 255), outline=(87, 99, 104, 170), width=4)
    draw.rounded_rectangle((798, 246, 994, 302), radius=16, fill=(172, 179, 178, 255), outline=(85, 95, 96, 190), width=4)
    for i, x in enumerate([250, 330, 410, 490, 570]):
        fill = (70, 154, 170, 255) if i == 0 else (236, 238, 232, 255)
        draw.ellipse((x, 442, x + 44, 486), fill=fill, outline=(68, 77, 78, 170), width=3)
    draw.line((154, 222, 1114, 222), fill=(255, 255, 255, 145), width=8)
    draw.line((174, 610, 1100, 610), fill=(92, 101, 101, 110), width=6)
    return image


def draw_single_rubber_stopper() -> Image.Image:
    image = Image.new("RGBA", (560, 780), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    shadow(image, (176, 650, 384, 718), 42)

    # Wide end up, narrow end down: the opposite orientation from the old trio asset.
    body = [(112, 146), (448, 146), (362, 604), (198, 604)]
    draw.polygon(body, fill=(28, 28, 26, 255), outline=(12, 12, 12, 230))
    draw.line((122, 154, 206, 604), fill=(68, 68, 62, 150), width=9)
    draw.line((438, 154, 356, 604), fill=(5, 5, 5, 180), width=11)

    top_layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    top_draw = ImageDraw.Draw(top_layer)
    top_draw.ellipse((104, 88, 456, 206), fill=(46, 46, 43, 255), outline=(9, 9, 9, 230), width=5)
    top_draw.arc((116, 96, 444, 196), 188, 352, fill=(92, 92, 84, 150), width=5)
    top_draw.arc((124, 110, 436, 202), 16, 166, fill=(10, 10, 10, 150), width=4)
    image.alpha_composite(top_layer)

    bottom_layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    bottom_draw = ImageDraw.Draw(bottom_layer)
    bottom_draw.ellipse((188, 560, 372, 646), fill=(23, 23, 21, 255), outline=(7, 7, 7, 210), width=4)
    bottom_draw.arc((198, 568, 362, 638), 190, 350, fill=(78, 78, 72, 125), width=4)
    image.alpha_composite(bottom_layer)

    highlight = Image.new("RGBA", image.size, (0, 0, 0, 0))
    highlight_draw = ImageDraw.Draw(highlight)
    highlight_draw.polygon([(154, 172), (204, 168), (238, 590), (210, 590)], fill=(255, 255, 240, 18))
    highlight_draw.polygon([(340, 164), (414, 154), (346, 594), (318, 594)], fill=(0, 0, 0, 40))
    image.alpha_composite(highlight.filter(ImageFilter.GaussianBlur(2)))

    texture = Image.new("RGBA", image.size, (0, 0, 0, 0))
    texture_draw = ImageDraw.Draw(texture)
    for offset in range(0, 380, 42):
        y = 196 + offset
        inset = offset // 8
        texture_draw.arc(
            (128 + inset, y - 22, 432 - inset, y + 28),
            12,
            168,
            fill=(95, 95, 88, 25),
            width=3,
        )
    image.alpha_composite(texture)
    return image


def chamber_with_paper() -> Image.Image:
    chamber = asset("chromatography-chamber")
    canvas = Image.new("RGBA", chamber.size, (0, 0, 0, 0))
    canvas.alpha_composite(chamber)
    paste_fit(canvas, asset("chromatography-paper"), (390, 250, 260, 790))
    return canvas


def flask_stoppered() -> Image.Image:
    canvas = asset("volumetric-flask")
    stopper = asset("rubber-stopper-set")
    paste_fit(canvas, stopper, (542, 12, 170, 210))
    return canvas


def spectro_with_cuvette() -> Image.Image:
    canvas = draw_spectrophotometer()
    paste_fit(canvas, asset("cuvette"), (824, 276, 132, 236))
    return canvas


def ring_stand_with_support(include_crucible: bool) -> Image.Image:
    canvas = asset("ring-stand")
    paste_fit(canvas, asset("clay-triangle"), (235, 555, 300, 210))
    if include_crucible:
        paste_fit(canvas, asset("crucible-with-lid"), (252, 455, 300, 270))
    return canvas


def main() -> None:
    write_png_wrapper("volumetric-flask", "volumetric flask")
    write_generated_or_curated_asset("pencil", "pencil", draw_pencil)
    write_generated_or_curated_asset(
        "luer-lock-syringe-locked",
        "locked luer-lock syringe",
        draw_luer_lock_syringe_locked,
    )
    write_generated_or_curated_asset("cuvette", "cuvette", draw_cuvette)
    write_generated_or_curated_asset("spectrophotometer", "spectrophotometer", draw_spectrophotometer)
    write_asset("chromatography-chamber-with-paper", "chromatography chamber with paper", chamber_with_paper())
    write_asset("rubber-stopper-set", "rubber stopper", draw_single_rubber_stopper())
    write_asset("volumetric-flask-stoppered", "volumetric flask with stopper", flask_stoppered())
    write_generated_or_curated_asset(
        "spectrophotometer-cuvette-inserted",
        "spectrophotometer with cuvette inserted",
        spectro_with_cuvette,
    )
    write_asset("ring-stand-clay-triangle", "ring stand with clay triangle", ring_stand_with_support(False))
    write_asset(
        "ring-stand-clay-triangle-crucible-lid-ajar",
        "ring stand with clay triangle and crucible lid ajar",
        ring_stand_with_support(True),
    )


if __name__ == "__main__":
    main()
