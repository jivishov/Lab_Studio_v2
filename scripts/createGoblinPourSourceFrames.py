from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE_IMAGE = ROOT / "public" / "assets" / "goblin-mode" / "apparatus-helper.png"
BEAKER_IMAGE = ROOT / "public" / "assets" / "equipment-realistic" / "v1" / "beaker-250ml.png"
SOURCE_ROOT = (
    ROOT / "public" / "assets" / "goblin-mode" / "sprites" / "v1" / "source" / "apparatus-helper" / "pour"
)

FRAME_WIDTH = 512
FRAME_HEIGHT = 512
FRAME_COUNT = 16


@dataclass(frozen=True)
class Pose:
    body_angle: float
    body_dx: int
    body_dy: int
    head_angle: float
    head_dx: int
    head_dy: int
    vessel_x: int
    vessel_y: int
    vessel_angle: float
    left_elbow: tuple[int, int]
    left_hand: tuple[int, int]
    right_elbow: tuple[int, int]
    right_hand: tuple[int, int]
    crouch: int = 0


POSES: tuple[Pose, ...] = (
    Pose(0, 0, 0, 0, 0, 0, 256, 350, 0, (214, 332), (229, 356), (301, 332), (285, 356)),
    Pose(0, 0, 1, 1, 0, 0, 258, 351, -2, (214, 334), (230, 357), (302, 333), (286, 357), 1),
    Pose(-1, 1, 2, 2, 1, 1, 262, 351, -6, (215, 336), (233, 358), (304, 333), (290, 356), 2),
    Pose(-2, 3, 5, 4, 2, 2, 274, 346, -12, (216, 338), (243, 354), (309, 330), (302, 350), 5),
    Pose(-4, 6, 7, 5, 4, 2, 292, 338, -20, (219, 339), (258, 346), (318, 326), (319, 338), 7),
    Pose(-6, 10, 5, 5, 6, 1, 314, 327, -30, (224, 336), (278, 334), (328, 319), (339, 325), 5),
    Pose(-7, 14, 2, 4, 8, 0, 334, 316, -42, (230, 331), (296, 322), (339, 312), (359, 315), 3),
    Pose(-8, 18, 0, 2, 10, -1, 350, 308, -54, (237, 327), (313, 314), (350, 305), (374, 306), 1),
    Pose(-9, 20, -1, 0, 11, -2, 362, 302, -64, (243, 323), (327, 308), (360, 300), (386, 299)),
    Pose(-10, 21, -2, -3, 12, -2, 370, 298, -72, (249, 320), (336, 304), (368, 296), (394, 295)),
    Pose(-10, 21, -2, -4, 12, -2, 372, 297, -76, (250, 319), (338, 303), (369, 295), (397, 294)),
    Pose(-9, 20, -1, -3, 11, -1, 368, 300, -70, (247, 321), (334, 306), (366, 298), (392, 297)),
    Pose(-7, 16, 0, -1, 9, 0, 352, 312, -54, (241, 327), (315, 318), (355, 307), (377, 310)),
    Pose(-5, 11, 1, 1, 6, 0, 326, 328, -34, (231, 332), (292, 335), (340, 318), (354, 326), 1),
    Pose(-2, 5, 1, 1, 3, 0, 292, 342, -14, (220, 333), (260, 350), (318, 328), (321, 341), 1),
    Pose(0, 0, 0, 0, 0, 0, 258, 350, -2, (214, 332), (230, 356), (302, 332), (286, 356)),
)


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError(f"{SOURCE_IMAGE} has no visible pixels")
    return bbox


def fit_subject(image: Image.Image) -> Image.Image:
    subject = image.crop(alpha_bbox(image))
    subject.thumbnail((438, 456), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (FRAME_WIDTH, FRAME_HEIGHT), (0, 0, 0, 0))
    x = (FRAME_WIDTH - subject.width) // 2
    y = 502 - subject.height
    canvas.alpha_composite(subject, (x, y))
    return canvas


def masked_layer(image: Image.Image, mask: Image.Image) -> Image.Image:
    layer = image.copy()
    alpha = ImageChops.multiply(image.getchannel("A"), mask)
    layer.putalpha(alpha)
    return layer


def subtract_mask(alpha: Image.Image, *masks: Image.Image) -> Image.Image:
    result = alpha.copy()
    for mask in masks:
        result = ImageChops.subtract(result, mask)
    return result


def build_layers(base: Image.Image) -> tuple[Image.Image, Image.Image, Image.Image]:
    alpha = base.getchannel("A")
    head_mask = Image.new("L", base.size, 0)
    draw = ImageDraw.Draw(head_mask)
    draw.ellipse((75, 34, 437, 270), fill=255)
    draw.polygon(((42, 118), (120, 86), (178, 174), (116, 242), (42, 165)), fill=255)
    draw.polygon(((470, 118), (392, 86), (334, 174), (396, 242), (470, 165)), fill=255)
    head_mask = ImageChops.multiply(head_mask.filter(ImageFilter.GaussianBlur(1.3)), alpha)

    feet_mask = Image.new("L", base.size, 0)
    ImageDraw.Draw(feet_mask).rectangle((0, 402, FRAME_WIDTH, FRAME_HEIGHT), fill=255)
    feet_mask = ImageChops.multiply(feet_mask.filter(ImageFilter.GaussianBlur(0.8)), alpha)

    body_mask = subtract_mask(alpha, head_mask, feet_mask)
    return masked_layer(base, body_mask), masked_layer(base, head_mask), masked_layer(base, feet_mask)


def transform_layer(
    layer: Image.Image,
    angle: float,
    dx: int,
    dy: int,
    center: tuple[int, int],
    scale: float = 1.0,
) -> Image.Image:
    working = layer
    if scale != 1.0:
        scaled = Image.new("RGBA", layer.size, (0, 0, 0, 0))
        size = (round(layer.width * scale), round(layer.height * scale))
        resized = layer.resize(size, Image.Resampling.LANCZOS)
        scaled.alpha_composite(resized, ((layer.width - size[0]) // 2, (layer.height - size[1]) // 2))
        working = scaled
    return working.rotate(
        angle,
        resample=Image.Resampling.BICUBIC,
        center=center,
        translate=(dx, dy),
        fillcolor=(0, 0, 0, 0),
    )


def draw_clean_torso(frame: Image.Image, pose: Pose) -> None:
    draw = ImageDraw.Draw(frame, "RGBA")
    dy = pose.crouch // 2
    draw.rounded_rectangle((181 + pose.body_dx // 3, 273 + dy, 332 + pose.body_dx // 3, 381 + dy), 28, fill=(239, 242, 235, 226))
    draw.line((255, 281 + dy, 252, 380 + dy), fill=(180, 190, 181, 110), width=3)
    draw.line((208, 291 + dy, 226, 371 + dy), fill=(255, 255, 255, 138), width=7)
    draw.line((306, 291 + dy, 287, 371 + dy), fill=(214, 220, 211, 105), width=5)
    draw.rounded_rectangle((190, 338 + dy, 229, 385 + dy), 8, outline=(188, 196, 187, 118), width=2)
    draw.rounded_rectangle((286, 337 + dy, 326, 382 + dy), 8, outline=(188, 196, 187, 118), width=2)


def draw_sleeve(draw: ImageDraw.ImageDraw, points: tuple[tuple[int, int], tuple[int, int], tuple[int, int]], width: int) -> None:
    draw.line(points, fill=(126, 135, 128, 120), width=width + 8, joint="curve")
    draw.line(points, fill=(246, 247, 242, 246), width=width, joint="curve")
    for x, y in points[1:]:
        radius = width // 2
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(246, 247, 242, 246), outline=(150, 159, 151, 120), width=2)


def vessel_layer(angle: float) -> Image.Image:
    beaker = Image.open(BEAKER_IMAGE).convert("RGBA")
    bbox = beaker.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError(f"{BEAKER_IMAGE} has no visible pixels")
    prop = beaker.crop(bbox)
    prop.thumbnail((88, 114), Image.Resampling.LANCZOS)

    tinted = Image.new("RGBA", prop.size, (78, 181, 200, 0))
    prop = Image.alpha_composite(prop, tinted)
    return prop.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)


def draw_action_arms_and_vessel(frame: Image.Image, pose: Pose) -> None:
    detail = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(detail, "RGBA")
    left_shoulder = (198 + pose.body_dx // 3, 296 + pose.body_dy // 3)
    right_shoulder = (314 + pose.body_dx // 3, 296 + pose.body_dy // 3)

    draw_sleeve(draw, (left_shoulder, pose.left_elbow, pose.left_hand), 22)
    draw_sleeve(draw, (right_shoulder, pose.right_elbow, pose.right_hand), 22)

    prop = vessel_layer(pose.vessel_angle)
    detail.alpha_composite(prop, (pose.vessel_x - prop.width // 2, pose.vessel_y - prop.height // 2))

    for hand_x, hand_y in (pose.left_hand, pose.right_hand):
        draw.ellipse((hand_x - 14, hand_y - 12, hand_x + 14, hand_y + 13), fill=(92, 155, 45, 248), outline=(41, 95, 38, 170), width=2)
        draw.ellipse((hand_x - 7, hand_y - 4, hand_x + 7, hand_y + 7), fill=(142, 199, 67, 170))

    frame.alpha_composite(detail)


def render_frame(base_layers: tuple[Image.Image, Image.Image, Image.Image], pose: Pose) -> Image.Image:
    body, head, feet = base_layers
    frame = Image.new("RGBA", (FRAME_WIDTH, FRAME_HEIGHT), (0, 0, 0, 0))
    shadow = Image.new("RGBA", (214, 34), (34, 48, 44, 54))
    shadow = shadow.filter(ImageFilter.GaussianBlur(10))
    frame.alpha_composite(shadow, (151, 472))
    frame.alpha_composite(feet)
    frame.alpha_composite(transform_layer(body, pose.body_angle, pose.body_dx, pose.body_dy, (256, 398)))
    frame.alpha_composite(transform_layer(head, pose.head_angle, pose.head_dx, pose.head_dy, (256, 154), 1.0))
    draw_clean_torso(frame, pose)
    draw_action_arms_and_vessel(frame, pose)
    return frame


def main() -> None:
    if len(POSES) != FRAME_COUNT:
        raise ValueError(f"Expected {FRAME_COUNT} poses, got {len(POSES)}")

    SOURCE_ROOT.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE_IMAGE).convert("RGBA")
    base = fit_subject(source)
    layers = build_layers(base)

    for index, pose in enumerate(POSES):
        frame = render_frame(layers, pose)
        frame.save(SOURCE_ROOT / f"frame-{index:02d}.png")


if __name__ == "__main__":
    main()
