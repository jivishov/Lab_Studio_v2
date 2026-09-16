from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

from generateSimulatorTechniqueAssets import write_asset, write_png_wrapper


ROOT = Path(__file__).resolve().parents[1]
PLANNING_OUT = ROOT / "planning" / "2026-06-17_ap-chem-investigations"


def shadow(canvas: Image.Image, ellipse: tuple[int, int, int, int], opacity: int = 42) -> None:
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw.ellipse(ellipse, fill=(18, 28, 32, opacity))
    canvas.alpha_composite(layer.filter(ImageFilter.GaussianBlur(16)))


def glass_round_rect(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    radius: int,
    fill: tuple[int, int, int, int] = (230, 250, 255, 42),
) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=(48, 92, 110, 165), width=6)
    x0, y0, x1, y1 = box
    draw.line((x0 + 22, y0 + 18, x0 + 22, y1 - 22), fill=(255, 255, 255, 120), width=8)
    draw.line((x1 - 18, y0 + 20, x1 - 18, y1 - 24), fill=(28, 72, 90, 90), width=5)


def cutout_mask(image: Image.Image) -> Image.Image:
    return image.getchannel("A").filter(ImageFilter.GaussianBlur(0.35))


def apply_directional_lighting(
    image: Image.Image,
    *,
    highlight_strength: int = 42,
    shadow_strength: int = 34,
) -> Image.Image:
    mask = cutout_mask(image)
    width, height = image.size
    light = Image.new("RGBA", image.size, (0, 0, 0, 0))
    light_pixels = light.load()
    mask_pixels = mask.load()
    for y in range(height):
        y_ratio = y / max(1, height - 1)
        for x in range(width):
            alpha = mask_pixels[x, y]
            if alpha == 0:
                continue
            x_ratio = x / max(1, width - 1)
            highlight = int(highlight_strength * max(0, 1 - x_ratio * 1.5) * max(0, 1 - y_ratio * 1.15))
            shadow_value = int(shadow_strength * max(0, (x_ratio + y_ratio - 0.65) / 1.35))
            if highlight > shadow_value:
                light_pixels[x, y] = (255, 255, 255, min(alpha, highlight))
            elif shadow_value > 0:
                light_pixels[x, y] = (8, 15, 18, min(alpha, shadow_value))
    finished = Image.alpha_composite(image, light)
    return finished


def add_surface_grain(
    image: Image.Image,
    *,
    opacity: int = 16,
    step: int = 5,
) -> Image.Image:
    mask = cutout_mask(image)
    width, height = image.size
    grain = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(grain)
    for y in range(0, height, step):
        for x in range((y // step) % step, width, step):
            alpha = mask.getpixel((x, y))
            if alpha < 24:
                continue
            seed = (x * 1103515245 + y * 12345 + width * 97 + height * 53) & 0xFFFFFFFF
            shade = 245 if seed & 1 else 38
            local_opacity = max(2, min(opacity, (seed >> 8) % (opacity + 1)))
            draw.point((x, y), fill=(shade, shade, shade, min(alpha, local_opacity)))
    return Image.alpha_composite(image, grain.filter(ImageFilter.GaussianBlur(0.45)))


def add_edge_definition(image: Image.Image) -> Image.Image:
    alpha = image.getchannel("A")
    edge = ImageChops.difference(alpha, alpha.filter(ImageFilter.MinFilter(3)))
    dark = Image.new("RGBA", image.size, (5, 18, 22, 0))
    dark.putalpha(edge.point(lambda value: min(95, value * 2)))
    return Image.alpha_composite(image, dark)


def photoreal_finish(
    image: Image.Image,
    *,
    grain_opacity: int = 15,
    highlight_strength: int = 42,
    shadow_strength: int = 34,
) -> Image.Image:
    finished = image.convert("RGBA")
    finished = apply_directional_lighting(
        finished,
        highlight_strength=highlight_strength,
        shadow_strength=shadow_strength,
    )
    finished = add_surface_grain(finished, opacity=grain_opacity)
    finished = add_edge_definition(finished)
    return finished.filter(ImageFilter.UnsharpMask(radius=1.0, percent=115, threshold=3))


def write_existing_photo_asset(name: str, label: str) -> None:
    png_path = ROOT / "public" / "assets" / "equipment-realistic" / "v1" / f"{name}.png"
    if not png_path.exists():
        raise FileNotFoundError(f"Expected curated photorealistic PNG at {png_path}")
    write_png_wrapper(name, label)


def draw_buchner_funnel() -> Image.Image:
    image = Image.new("RGBA", (820, 980), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    shadow(image, (178, 862, 642, 930), 42)
    draw.ellipse((160, 106, 660, 250), fill=(246, 251, 248, 255), outline=(118, 125, 120, 210), width=8)
    draw.rounded_rectangle((194, 166, 626, 455), radius=40, fill=(235, 239, 235, 255), outline=(105, 114, 110, 210), width=8)
    draw.ellipse((206, 176, 614, 300), fill=(250, 253, 250, 255), outline=(124, 132, 126, 200), width=6)
    for x in range(260, 570, 46):
        for y in range(226, 300, 34):
            draw.ellipse((x, y, x + 13, y + 13), fill=(144, 152, 146, 170))
    draw.polygon([(360, 450), (460, 450), (496, 848), (324, 848)], fill=(226, 231, 226, 255), outline=(104, 112, 108, 210))
    draw.line((392, 472, 358, 826), fill=(255, 255, 255, 105), width=9)
    draw.line((454, 474, 482, 828), fill=(80, 88, 86, 95), width=7)
    return image


def draw_small_vial() -> Image.Image:
    scale = 4
    width, height = 512, 768
    image = Image.new("RGBA", (width * scale, height * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    s = scale

    shadow(image, (138 * s, 666 * s, 374 * s, 728 * s), 28)

    # Screw cap with knurled black plastic and a slightly glossy top ellipse.
    draw.rounded_rectangle(
        (138 * s, 50 * s, 374 * s, 178 * s),
        radius=22 * s,
        fill=(32, 36, 38, 255),
        outline=(8, 12, 14, 230),
        width=5 * s,
    )
    draw.ellipse((126 * s, 22 * s, 386 * s, 92 * s), fill=(54, 58, 60, 255), outline=(12, 15, 17, 230), width=5 * s)
    draw.arc((144 * s, 36 * s, 368 * s, 86 * s), 185, 352, fill=(120, 125, 126, 115), width=4 * s)
    for x in range(158, 356, 24):
        draw.line((x * s, 76 * s, (x - 10) * s, 170 * s), fill=(5, 9, 11, 160), width=5 * s)
        draw.line(((x + 8) * s, 84 * s, (x - 2) * s, 166 * s), fill=(92, 96, 98, 55), width=2 * s)

    # Clear cylindrical glass body. Keep it empty; contents are runtime-rendered.
    body = (122 * s, 160 * s, 390 * s, 690 * s)
    draw.rounded_rectangle(body, radius=88 * s, fill=(226, 248, 255, 42), outline=(38, 92, 110, 142), width=7 * s)
    draw.ellipse((126 * s, 150 * s, 386 * s, 244 * s), fill=(238, 253, 255, 56), outline=(40, 94, 112, 124), width=5 * s)
    draw.ellipse((140 * s, 178 * s, 372 * s, 234 * s), fill=(255, 255, 255, 44), outline=(255, 255, 255, 95), width=2 * s)
    draw.ellipse((126 * s, 610 * s, 386 * s, 718 * s), fill=(225, 246, 252, 54), outline=(38, 90, 108, 124), width=5 * s)
    draw.arc((144 * s, 618 * s, 368 * s, 704 * s), 0, 180, fill=(255, 255, 255, 110), width=4 * s)
    draw.arc((146 * s, 648 * s, 366 * s, 714 * s), 0, 180, fill=(34, 85, 102, 72), width=3 * s)

    # Neck ring and shoulder refraction.
    draw.rounded_rectangle((150 * s, 140 * s, 362 * s, 218 * s), radius=38 * s, fill=(238, 253, 255, 46), outline=(43, 96, 114, 90), width=4 * s)
    draw.arc((150 * s, 210 * s, 362 * s, 292 * s), 184, 356, fill=(255, 255, 255, 72), width=3 * s)

    # Long specular highlights and rear edge tint.
    draw.rounded_rectangle((164 * s, 206 * s, 204 * s, 632 * s), radius=24 * s, fill=(255, 255, 255, 126))
    draw.rounded_rectangle((316 * s, 204 * s, 352 * s, 616 * s), radius=22 * s, fill=(255, 255, 255, 92))
    draw.line((210 * s, 188 * s, 210 * s, 642 * s), fill=(255, 255, 255, 58), width=5 * s)
    draw.line((354 * s, 194 * s, 354 * s, 640 * s), fill=(25, 78, 96, 82), width=4 * s)
    draw.arc((162 * s, 320 * s, 350 * s, 442 * s), 184, 356, fill=(38, 104, 128, 42), width=3 * s)
    draw.arc((156 * s, 392 * s, 356 * s, 520 * s), 184, 356, fill=(255, 255, 255, 40), width=3 * s)

    # Fine deterministic glass stipple.
    speckle = Image.new("RGBA", image.size, (0, 0, 0, 0))
    speckle_draw = ImageDraw.Draw(speckle)
    for y in range(190 * s, 650 * s, 12 * s):
        for x in range(140 * s + (y // (12 * s)) % (8 * s), 376 * s, 8 * s):
            seed = (x * 22695477 + y * 1103515245) & 0xFFFFFFFF
            shade = 255 if seed & 1 else 38
            speckle_draw.point((x, y), fill=(shade, shade, shade, 5 + seed % 12))
    image.alpha_composite(speckle.filter(ImageFilter.GaussianBlur(0.35 * s)))

    image = image.resize((width, height), Image.LANCZOS)
    return image


def draw_side_arm_filter_flask() -> Image.Image:
    scale = 3
    width, height = 880, 1030
    image = Image.new("RGBA", (width * scale, height * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    s = scale

    def pts(points: list[tuple[int, int]]) -> list[tuple[int, int]]:
        return [(x * s, y * s) for x, y in points]

    def line(points: list[tuple[int, int]], fill: tuple[int, int, int, int], line_width: int) -> None:
        draw.line(pts(points), fill=fill, width=line_width * s, joint="curve")

    shadow(image, (176 * s, 888 * s, 684 * s, 970 * s), 28)

    body = pts([(386, 94), (494, 94), (508, 384), (654, 838), (226, 838), (372, 384)])
    shoulder = pts([(372, 384), (508, 384), (608, 792), (272, 792)])
    side_arm = pts([(506, 236), (694, 174), (722, 238), (532, 304)])

    draw.polygon(body, fill=(232, 250, 255, 34), outline=(31, 89, 110, 150))
    draw.polygon(shoulder, fill=(230, 248, 255, 22))

    # Thick glass base and rear bottom ellipse.
    draw.ellipse((224 * s, 774 * s, 656 * s, 900 * s), fill=(230, 250, 255, 55), outline=(35, 89, 108, 135), width=5 * s)
    draw.arc((246 * s, 748 * s, 634 * s, 878 * s), 0, 180, fill=(255, 255, 255, 138), width=5 * s)
    draw.arc((246 * s, 786 * s, 634 * s, 910 * s), 0, 180, fill=(34, 87, 105, 75), width=4 * s)

    # Mouth and neck, with visible glass thickness.
    draw.rounded_rectangle((354 * s, 52 * s, 526 * s, 138 * s), radius=24 * s, fill=(235, 252, 255, 68), outline=(36, 89, 108, 150), width=6 * s)
    draw.rounded_rectangle((376 * s, 78 * s, 504 * s, 116 * s), radius=16 * s, fill=(250, 255, 255, 48), outline=(255, 255, 255, 115), width=3 * s)
    line([(386, 132), (386, 374)], (255, 255, 255, 105), 7)
    line([(492, 134), (498, 376)], (26, 80, 98, 82), 5)

    # Side-arm tube: main wall, opening ellipse, and rim ring.
    draw.polygon(side_arm, fill=(232, 250, 255, 62), outline=(35, 89, 108, 140))
    line([(526, 252), (692, 198)], (255, 255, 255, 112), 6)
    line([(536, 292), (704, 232)], (29, 83, 101, 68), 5)
    draw.ellipse((674 * s, 162 * s, 744 * s, 250 * s), fill=(232, 250, 255, 62), outline=(36, 88, 106, 140), width=5 * s)
    draw.ellipse((688 * s, 176 * s, 730 * s, 236 * s), fill=(244, 255, 255, 36), outline=(255, 255, 255, 110), width=2 * s)

    # Reflections and subtle internal refraction bands.
    line([(404, 112), (406, 384), (276, 816)], (255, 255, 255, 142), 8)
    line([(430, 120), (434, 384), (326, 810)], (255, 255, 255, 46), 4)
    line([(490, 118), (498, 382), (628, 818)], (24, 77, 96, 88), 6)
    line([(466, 140), (472, 386), (568, 810)], (255, 255, 255, 34), 3)

    for offset, opacity in [(0, 58), (36, 32), (72, 24)]:
        draw.arc(
            ((286 + offset) * s, (532 + offset // 3) * s, (592 + offset // 4) * s, (830 - offset // 6) * s),
            196,
            344,
            fill=(255, 255, 255, opacity),
            width=3 * s,
        )

    # Fine blue-green edge tint like real borosilicate glass.
    edge_tint = Image.new("RGBA", image.size, (0, 0, 0, 0))
    edge_draw = ImageDraw.Draw(edge_tint)
    edge_draw.polygon(body, outline=(68, 174, 196, 72), width=2 * s)
    edge_draw.polygon(side_arm, outline=(68, 174, 196, 64), width=2 * s)
    edge_draw.ellipse((224 * s, 774 * s, 656 * s, 900 * s), outline=(68, 174, 196, 58), width=2 * s)
    image.alpha_composite(edge_tint.filter(ImageFilter.GaussianBlur(0.45 * s)))

    image = image.resize((width, height), Image.LANCZOS)
    return image


def draw_vacuum_source() -> Image.Image:
    image = Image.new("RGBA", (1030, 720), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    shadow(image, (110, 580, 920, 666), 50)
    draw.rounded_rectangle((116, 180, 666, 574), radius=42, fill=(217, 224, 223, 255), outline=(82, 92, 94, 220), width=7)
    draw.rounded_rectangle((182, 244, 424, 370), radius=24, fill=(34, 58, 66, 255), outline=(18, 34, 38, 200), width=5)
    font = ImageFont.load_default()
    draw.text((228, 288), "VAC", fill=(152, 226, 231, 255), font=font)
    draw.text((306, 288), "ON", fill=(152, 226, 231, 255), font=font)
    draw.ellipse((486, 262, 594, 370), fill=(62, 73, 76, 255), outline=(30, 38, 40, 220), width=6)
    draw.ellipse((520, 296, 560, 336), fill=(143, 196, 205, 255), outline=(40, 74, 82, 200), width=3)
    draw.line((616, 330, 908, 480), fill=(60, 63, 63, 230), width=34)
    draw.line((616, 330, 908, 480), fill=(117, 124, 124, 150), width=11)
    draw.ellipse((872, 444, 950, 520), fill=(58, 62, 62, 255), outline=(25, 28, 28, 220), width=5)
    return image


def draw_conductivity_tester() -> Image.Image:
    image = Image.new("RGBA", (840, 900), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    shadow(image, (120, 760, 724, 832), 45)
    draw.rounded_rectangle((150, 120, 560, 630), radius=52, fill=(38, 48, 52, 255), outline=(16, 24, 27, 230), width=8)
    draw.rounded_rectangle((210, 190, 500, 322), radius=22, fill=(40, 76, 82, 255), outline=(12, 30, 34, 230), width=5)
    font = ImageFont.load_default()
    draw.text((250, 238), "1480 uS", fill=(146, 229, 220, 255), font=font)
    for x, color in [(244, (94, 210, 113, 255)), (356, (235, 212, 74, 255)), (468, (229, 83, 83, 255))]:
        draw.ellipse((x, 392, x + 56, 448), fill=color, outline=(20, 24, 24, 180), width=4)
    draw.line((420, 612, 652, 742), fill=(30, 32, 33, 245), width=18)
    draw.line((478, 610, 692, 718), fill=(30, 32, 33, 245), width=18)
    draw.line((650, 742, 650, 838), fill=(184, 191, 188, 255), width=7)
    draw.line((692, 718, 692, 836), fill=(184, 191, 188, 255), width=7)
    draw.line((160, 150, 540, 150), fill=(255, 255, 255, 36), width=8)
    return image


def draw_melting_point_apparatus() -> Image.Image:
    image = Image.new("RGBA", (760, 1070), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    shadow(image, (132, 932, 628, 1006), 45)
    draw.rounded_rectangle((164, 160, 596, 892), radius=56, fill=(221, 225, 224, 255), outline=(76, 88, 91, 220), width=8)
    draw.rounded_rectangle((226, 236, 534, 346), radius=20, fill=(35, 64, 70, 255), outline=(17, 34, 39, 220), width=5)
    font = ImageFont.load_default()
    draw.text((282, 278), "132.4 C", fill=(152, 226, 231, 255), font=font)
    draw.rounded_rectangle((266, 430, 494, 756), radius=30, fill=(44, 50, 53, 255), outline=(20, 24, 26, 220), width=6)
    draw.ellipse((292, 462, 468, 634), fill=(22, 28, 31, 255), outline=(99, 112, 116, 190), width=5)
    draw.line((382, 380, 382, 812), fill=(222, 240, 245, 160), width=11)
    draw.line((384, 444, 384, 802), fill=(168, 56, 46, 190), width=4)
    for x in [260, 340, 420]:
        draw.ellipse((x, 804, x + 52, 856), fill=(232, 235, 229, 255), outline=(71, 80, 82, 160), width=3)
    return image


def draw_ph_paper() -> Image.Image:
    image = Image.new("RGBA", (980, 520), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    shadow(image, (110, 390, 870, 462), 38)
    draw.rounded_rectangle((120, 146, 860, 332), radius=20, fill=(246, 245, 231, 255), outline=(115, 108, 82, 180), width=5)
    colors = [(212, 45, 53), (230, 112, 51), (239, 202, 65), (96, 183, 91), (65, 155, 211), (88, 92, 181), (142, 73, 157)]
    for i, color in enumerate(colors):
        x = 168 + i * 86
        draw.rectangle((x, 190, x + 62, 288), fill=(*color, 255), outline=(78, 72, 54, 100))
    draw.rounded_rectangle((744, 192, 826, 286), radius=7, fill=(250, 248, 202, 255), outline=(120, 112, 68, 160), width=3)
    draw.line((132, 160, 848, 160), fill=(255, 255, 255, 130), width=6)
    return image


def draw_permanent_marker() -> Image.Image:
    image = Image.new("RGBA", (1120, 330), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    shadow(image, (112, 226, 1010, 292), 44)
    draw.rounded_rectangle((132, 116, 824, 202), radius=38, fill=(34, 43, 47, 255), outline=(10, 13, 15, 220), width=5)
    draw.rounded_rectangle((278, 126, 610, 192), radius=14, fill=(232, 236, 229, 255), outline=(85, 90, 88, 130), width=3)
    draw.text((352, 148), "MARKER", fill=(32, 38, 42, 255), font=ImageFont.load_default())
    draw.polygon([(824, 128), (976, 90), (994, 220), (824, 194)], fill=(42, 47, 49, 255), outline=(10, 12, 13, 220))
    draw.polygon([(972, 94), (1052, 138), (994, 218)], fill=(26, 28, 30, 255), outline=(6, 7, 8, 220))
    draw.line((160, 130, 790, 130), fill=(255, 255, 255, 48), width=6)
    return image


def draw_magnet() -> Image.Image:
    image = Image.new("RGBA", (780, 820), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    shadow(image, (142, 692, 638, 760), 42)
    draw.rounded_rectangle((150, 110, 310, 672), radius=70, fill=(203, 42, 50, 255), outline=(94, 24, 28, 210), width=7)
    draw.rounded_rectangle((470, 110, 630, 672), radius=70, fill=(43, 91, 190, 255), outline=(24, 48, 102, 210), width=7)
    draw.rounded_rectangle((252, 110, 528, 286), radius=86, fill=(203, 42, 50, 255), outline=(94, 24, 28, 210), width=7)
    draw.rounded_rectangle((302, 256, 478, 560), radius=74, fill=(0, 0, 0, 0), outline=(224, 230, 232, 255), width=84)
    draw.rectangle((150, 542, 310, 684), fill=(232, 235, 238, 255), outline=(92, 99, 102, 170), width=5)
    draw.rectangle((470, 542, 630, 684), fill=(232, 235, 238, 255), outline=(92, 99, 102, 170), width=5)
    draw.line((174, 138, 292, 132), fill=(255, 255, 255, 65), width=8)
    draw.line((494, 138, 612, 132), fill=(255, 255, 255, 65), width=8)
    return image


def draw_data_collection_interface() -> Image.Image:
    image = Image.new("RGBA", (1040, 820), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    shadow(image, (118, 680, 926, 760), 48)
    draw.rounded_rectangle((128, 96, 912, 684), radius=58, fill=(36, 44, 48, 255), outline=(15, 22, 25, 230), width=8)
    draw.rounded_rectangle((206, 164, 834, 498), radius=22, fill=(222, 237, 235, 255), outline=(72, 84, 88, 210), width=5)
    points = [(252, 426), (330, 384), (420, 394), (512, 326), (610, 292), (734, 240)]
    draw.line(points, fill=(27, 127, 170, 255), width=9, joint="curve")
    for x, y in points:
        draw.ellipse((x - 9, y - 9, x + 9, y + 9), fill=(245, 92, 74, 255), outline=(80, 30, 25, 200), width=3)
    for x in [260, 380, 500, 620, 740]:
        draw.line((x, 188, x, 468), fill=(148, 166, 166, 90), width=2)
    for y in [238, 302, 366, 430]:
        draw.line((230, y, 806, y), fill=(148, 166, 166, 90), width=2)
    for x in [296, 416, 536, 656]:
        draw.ellipse((x, 556, x + 56, 612), fill=(226, 231, 226, 255), outline=(83, 92, 92, 190), width=4)
    return image


def draw_graduated_pipette() -> Image.Image:
    image = Image.new("RGBA", (420, 1254), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    shadow(image, (114, 1132, 306, 1194), 36)
    draw.rounded_rectangle((184, 80, 236, 1160), radius=26, fill=(225, 249, 255, 56), outline=(46, 94, 112, 165), width=7)
    draw.line((198, 104, 198, 1138), fill=(255, 255, 255, 135), width=6)
    draw.line((230, 112, 230, 1134), fill=(30, 78, 96, 100), width=4)
    for i, y in enumerate(range(166, 1058, 42)):
        length = 36 if i % 5 == 0 else 22
        draw.line((184, y, 184 + length, y), fill=(38, 82, 98, 165), width=3)
    draw.polygon([(194, 1156), (226, 1156), (210, 1228)], fill=(224, 248, 255, 52), outline=(46, 94, 112, 150))
    return image


def draw_beral_pipette() -> Image.Image:
    image = Image.new("RGBA", (520, 1180), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    shadow(image, (126, 1050, 394, 1116), 36)
    draw.ellipse((150, 78, 370, 300), fill=(234, 250, 255, 80), outline=(52, 96, 112, 150), width=6)
    draw.rounded_rectangle((214, 246, 306, 934), radius=42, fill=(226, 248, 255, 52), outline=(52, 96, 112, 150), width=6)
    draw.polygon([(230, 928), (290, 928), (262, 1130)], fill=(226, 248, 255, 48), outline=(52, 96, 112, 140))
    draw.line((188, 126, 274, 102), fill=(255, 255, 255, 105), width=7)
    draw.rectangle((226, 592, 294, 826), fill=(92, 162, 216, 68))
    return image


def draw_pipette_pump() -> Image.Image:
    image = Image.new("RGBA", (480, 980), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    shadow(image, (114, 838, 366, 902), 40)
    draw.rounded_rectangle((154, 92, 326, 786), radius=70, fill=(218, 64, 55, 255), outline=(100, 34, 30, 210), width=7)
    draw.rounded_rectangle((190, 158, 290, 660), radius=32, fill=(236, 92, 76, 255), outline=(130, 44, 36, 150), width=4)
    draw.ellipse((170, 44, 310, 168), fill=(232, 236, 232, 255), outline=(92, 100, 100, 180), width=5)
    draw.ellipse((180, 704, 300, 824), fill=(42, 48, 50, 255), outline=(16, 22, 24, 200), width=5)
    draw.line((178, 118, 178, 730), fill=(255, 255, 255, 54), width=8)
    return image


ASSETS = [
    ("small-vial", "small vial", draw_small_vial),
    ("buchner-funnel", "Buchner funnel", draw_buchner_funnel),
    ("side-arm-filter-flask", "side-arm filter flask", draw_side_arm_filter_flask),
    ("vacuum-source", "vacuum source and tubing", draw_vacuum_source),
    ("conductivity-tester", "conductivity tester", draw_conductivity_tester),
    ("melting-point-apparatus", "melting point apparatus", draw_melting_point_apparatus),
    ("ph-paper", "pH paper strips", draw_ph_paper),
    ("permanent-marker", "permanent marker", draw_permanent_marker),
    ("magnet", "magnet", draw_magnet),
    ("data-collection-interface", "data collection interface", draw_data_collection_interface),
    ("graduated-pipette-10ml", "10 mL graduated pipette", draw_graduated_pipette),
    ("beral-pipette", "Beral pipette", draw_beral_pipette),
    ("pipette-pump", "pipette pump", draw_pipette_pump),
]

CURATED_PHOTO_ASSET_IDS = {
    "beral-pipette",
    "buchner-funnel",
    "conductivity-tester",
    "data-collection-interface",
    "magnet",
    "melting-point-apparatus",
    "permanent-marker",
    "ph-paper",
    "pipette-pump",
    "side-arm-filter-flask",
    "small-vial",
    "vacuum-source",
}


def contact_sheet() -> None:
    PLANNING_OUT.mkdir(parents=True, exist_ok=True)
    cell_w, cell_h = 280, 240
    cols = 4
    rows = (len(ASSETS) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell_w, rows * cell_h), (246, 246, 242))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for index, (asset_id, label, factory) in enumerate(ASSETS):
        row, col = divmod(index, cols)
        x, y = col * cell_w, row * cell_h
        tile = Image.new("RGBA", (cell_w, cell_h), (246, 246, 242, 255))
        output_path = ROOT / "public" / "assets" / "equipment-realistic" / "v1" / f"{asset_id}.png"
        art = Image.open(output_path).convert("RGBA") if output_path.exists() else factory()
        scale = min((cell_w - 48) / art.width, (cell_h - 62) / art.height)
        resized = art.resize((round(art.width * scale), round(art.height * scale)), Image.LANCZOS)
        tile.alpha_composite(resized, ((cell_w - resized.width) // 2, 18))
        sheet.paste(tile.convert("RGB"), (x, y))
        draw.rectangle((x + 8, y + 8, x + cell_w - 8, y + cell_h - 8), outline=(206, 203, 195))
        draw.text((x + 16, y + cell_h - 34), label, fill=(28, 32, 34), font=font)
        draw.text((x + 16, y + cell_h - 18), asset_id, fill=(88, 92, 92), font=font)
    sheet.save(PLANNING_OUT / "asset-contact-sheet.png")
    print(f"wrote {(PLANNING_OUT / 'asset-contact-sheet.png').relative_to(ROOT)}")


def main() -> None:
    for asset_id, label, factory in ASSETS:
        if asset_id in CURATED_PHOTO_ASSET_IDS:
            write_existing_photo_asset(asset_id, label)
            continue
        write_asset(asset_id, label, photoreal_finish(factory()))
    contact_sheet()


if __name__ == "__main__":
    main()
