"""Generate a synthetic Bunsen burner dataset for a 4DGS trial.

Run with Blender:
  blender --background --python scripts/blender/generateBunsenBurner4dgsDataset.py -- \
    --output experiments/bunsen-burner-4dgs/dataset --resolution 768 --views 48

The output follows the D-NeRF-style transform JSON shape that HUST 4DGaussians
uses for synthetic scenes: transforms_train.json, transforms_test.json, images,
and a small seed fused.ply.
"""

from __future__ import annotations

import argparse
import json
import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector


FRAME_STATES = [
    {"id": "off", "time": 0.0, "flame_height": 0.0, "flame_alpha": 0.0},
    {"id": "low-flame", "time": 1.0, "flame_height": 0.46, "flame_alpha": 0.70},
    {"id": "high-flame", "time": 2.0, "flame_height": 0.82, "flame_alpha": 0.86},
    {"id": "cooldown", "time": 3.0, "flame_height": 0.28, "flame_alpha": 0.34},
]

TARGET = Vector((0.0, 0.0, 0.62))


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="experiments/bunsen-burner-4dgs/dataset")
    parser.add_argument("--resolution", type=int, default=768)
    parser.add_argument("--views", type=int, default=48)
    parser.add_argument("--test-hold", type=int, default=8)
    parser.add_argument("--radius", type=float, default=4.35)
    parser.add_argument("--samples", type=int, default=96)
    parser.add_argument("--seed", type=int, default=20260514)
    return parser.parse_args(argv)


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    bpy.context.scene.frame_set(1)


def set_input(node, name: str, value) -> None:
    if name in node.inputs:
        node.inputs[name].default_value = value


def make_material(
    name: str,
    color: tuple[float, float, float, float],
    *,
    metallic: float = 0.0,
    roughness: float = 0.55,
    alpha: float = 1.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        set_input(bsdf, "Base Color", color)
        set_input(bsdf, "Metallic", metallic)
        set_input(bsdf, "Roughness", roughness)
        set_input(bsdf, "Alpha", alpha)
        set_input(bsdf, "Emission Color", color)
        set_input(bsdf, "Emission Strength", 0.0)
    material.diffuse_color = color
    if alpha < 1:
        material.blend_method = "BLEND"
        material.use_screen_refraction = True
        material.show_transparent_back = False
    return material


def assign(obj: bpy.types.Object, material: bpy.types.Material) -> bpy.types.Object:
    obj.data.materials.append(material)
    try:
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.shade_smooth()
    except Exception:
        pass
    return obj


def cylinder(
    name: str,
    radius: float,
    depth: float,
    location: tuple[float, float, float],
    material: bpy.types.Material,
    *,
    vertices: int = 96,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    scale: tuple[float, float, float] = (1.0, 1.0, 1.0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    return assign(obj, material)


def cone(
    name: str,
    radius1: float,
    radius2: float,
    depth: float,
    location: tuple[float, float, float],
    material: bpy.types.Material,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(
        vertices=96,
        radius1=radius1,
        radius2=radius2,
        depth=depth,
        location=location,
    )
    obj = bpy.context.object
    obj.name = name
    return assign(obj, material)


def add_burner(materials: dict[str, bpy.types.Material]) -> list[bpy.types.Object]:
    objects: list[bpy.types.Object] = []
    objects.append(cylinder("burner_base", 0.56, 0.12, (0.0, 0.0, 0.06), materials["dark_metal"], scale=(1.34, 0.86, 1.0)))
    objects.append(cylinder("burner_base_rim", 0.58, 0.025, (0.0, 0.0, 0.135), materials["brushed_metal"], scale=(1.32, 0.84, 1.0)))
    objects.append(cylinder("barrel", 0.135, 1.18, (0.0, 0.0, 0.74), materials["brushed_metal"]))
    objects.append(cylinder("barrel_inner_dark", 0.118, 0.018, (0.0, 0.0, 1.34), materials["black_metal"]))
    objects.append(cylinder("air_collar", 0.19, 0.16, (0.0, 0.0, 0.43), materials["dark_metal"], vertices=80))

    for x in (-0.065, 0.065):
        objects.append(
            cylinder(
                f"front_air_hole_{x}",
                0.034,
                0.006,
                (x, -0.137, 0.45),
                materials["black_metal"],
                vertices=32,
                rotation=(math.radians(90), 0.0, 0.0),
            )
        )

    objects.append(
        cylinder(
            "gas_inlet_pipe",
            0.042,
            0.76,
            (-0.52, 0.0, 0.25),
            materials["brass"],
            vertices=48,
            rotation=(0.0, math.radians(90), 0.0),
        )
    )
    objects.append(
        cylinder(
            "gas_inlet_nozzle",
            0.066,
            0.13,
            (-0.93, 0.0, 0.25),
            materials["brass"],
            vertices=48,
            rotation=(0.0, math.radians(90), 0.0),
        )
    )
    objects.append(
        cylinder(
            "gas_knob",
            0.082,
            0.055,
            (-0.28, -0.2, 0.25),
            materials["black_metal"],
            vertices=40,
            rotation=(math.radians(90), 0.0, 0.0),
            scale=(1.0, 0.5, 1.0),
        )
    )
    return objects


def add_world(materials: dict[str, bpy.types.Material]) -> None:
    bpy.ops.mesh.primitive_plane_add(size=5.2, location=(0.0, 0.0, -0.003))
    bench = bpy.context.object
    bench.name = "matte_bench"
    assign(bench, materials["bench"])

    bpy.ops.object.light_add(type="AREA", location=(-2.2, -3.0, 4.0))
    key = bpy.context.object
    key.name = "large_softbox_key"
    key.data.energy = 520
    key.data.size = 4.0

    bpy.ops.object.light_add(type="POINT", location=(2.2, 2.4, 2.0))
    fill = bpy.context.object
    fill.name = "weak_front_fill"
    fill.data.energy = 36

    bpy.context.scene.world = bpy.data.worlds.new("soft_gray_world")
    bpy.context.scene.world.color = (0.78, 0.82, 0.82)


def add_flame(materials: dict[str, bpy.types.Material]) -> tuple[bpy.types.Object, bpy.types.Object]:
    outer = cone("flame_outer", 0.18, 0.018, 0.8, (0.0, 0.0, 1.74), materials["flame_orange"])
    inner = cone("flame_inner", 0.076, 0.01, 0.48, (0.0, 0.0, 1.56), materials["flame_blue"])
    return outer, inner


def set_flame_state(
    outer: bpy.types.Object,
    inner: bpy.types.Object,
    state: dict[str, float | str],
    materials: dict[str, bpy.types.Material],
) -> None:
    height = float(state["flame_height"])
    alpha = float(state["flame_alpha"])
    visible = height > 0
    outer.hide_render = not visible
    outer.hide_viewport = not visible
    inner.hide_render = not visible
    inner.hide_viewport = not visible
    if not visible:
        return

    outer.dimensions = (0.34, 0.34, height)
    outer.location = (0.0, 0.0, 1.33 + height / 2)
    inner.dimensions = (0.13, 0.13, height * 0.58)
    inner.location = (0.0, 0.0, 1.34 + height * 0.29)
    for name, multiplier in (("flame_orange", 1.0), ("flame_blue", 0.78)):
        material = materials[name]
        material.diffuse_color[3] = max(0.0, min(1.0, alpha * multiplier))
        bsdf = material.node_tree.nodes.get("Principled BSDF")
        if bsdf and "Alpha" in bsdf.inputs:
            bsdf.inputs["Alpha"].default_value = material.diffuse_color[3]
        if bsdf and "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = 1.4 if name == "flame_orange" else 0.9


def configure_render(resolution: int, samples: int) -> None:
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.view_settings.view_transform = "Filmic"
    scene.view_settings.look = "Medium High Contrast"
    scene.render.resolution_x = resolution
    scene.render.resolution_y = resolution
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = "PNG"


def create_camera() -> bpy.types.Object:
    camera_data = bpy.data.cameras.new("calibrated_orbit_camera")
    camera_data.lens = 38
    camera_data.sensor_width = 32
    camera = bpy.data.objects.new("Camera", camera_data)
    bpy.context.collection.objects.link(camera)
    bpy.context.scene.camera = camera
    return camera


def aim_at(obj: bpy.types.Object, target: Vector) -> None:
    direction = target - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def place_camera(camera: bpy.types.Object, view_index: int, view_count: int, radius: float) -> None:
    angle = (2.0 * math.pi * view_index) / view_count
    elevation = math.radians(19.0 + 4.0 * math.sin(angle * 2.0))
    horizontal = radius * math.cos(elevation)
    camera.location = (
        horizontal * math.cos(angle),
        horizontal * math.sin(angle),
        TARGET.z + radius * math.sin(elevation),
    )
    aim_at(camera, TARGET)


def relative_without_extension(path: Path, root: Path) -> str:
    relative = path.relative_to(root).with_suffix("")
    return relative.as_posix()


def render_dataset(args: argparse.Namespace) -> dict[str, object]:
    output = Path(args.output).resolve()
    images_dir = output / "images"
    qa_dir = output / "qa"
    images_dir.mkdir(parents=True, exist_ok=True)
    qa_dir.mkdir(parents=True, exist_ok=True)

    random.seed(args.seed)
    reset_scene()

    materials = {
        "bench": make_material("warm_gray_bench", (0.58, 0.54, 0.47, 1.0), roughness=0.78),
        "brushed_metal": make_material("brushed_steel", (0.62, 0.66, 0.65, 1.0), metallic=0.82, roughness=0.34),
        "dark_metal": make_material("dark_cast_metal", (0.08, 0.10, 0.10, 1.0), metallic=0.72, roughness=0.42),
        "black_metal": make_material("blackened_openings", (0.006, 0.008, 0.009, 1.0), metallic=0.2, roughness=0.62),
        "brass": make_material("aged_brass", (0.85, 0.58, 0.20, 1.0), metallic=0.68, roughness=0.36),
        "flame_orange": make_material("transparent_orange_flame", (1.0, 0.35, 0.06, 0.75), roughness=0.2, alpha=0.75),
        "flame_blue": make_material("transparent_blue_core", (0.22, 0.72, 1.0, 0.58), roughness=0.16, alpha=0.58),
    }

    add_world(materials)
    seed_objects = add_burner(materials)
    flame_outer, flame_inner = add_flame(materials)
    seed_objects.extend([flame_outer, flame_inner])
    configure_render(args.resolution, args.samples)
    camera = create_camera()

    train_frames: list[dict[str, object]] = []
    test_frames: list[dict[str, object]] = []
    all_images: list[dict[str, str]] = []

    for state in FRAME_STATES:
        state_dir = images_dir / str(state["id"])
        state_dir.mkdir(parents=True, exist_ok=True)
        set_flame_state(flame_outer, flame_inner, state, materials)
        for view_index in range(args.views):
            place_camera(camera, view_index, args.views, args.radius)
            image_path = state_dir / f"view_{view_index:03d}.png"
            bpy.context.scene.render.filepath = str(image_path)
            bpy.ops.render.render(write_still=True)

            frame = {
                "file_path": relative_without_extension(image_path, output),
                "transform_matrix": [[float(value) for value in row] for row in camera.matrix_world],
                "time": float(state["time"]),
                "state": state["id"],
                "view_index": view_index,
            }
            if view_index % args.test_hold == 0:
                test_frames.append(frame)
            else:
                train_frames.append(frame)
            all_images.append({"state": str(state["id"]), "path": image_path.relative_to(output).as_posix()})

    camera_angle_x = float(camera.data.angle_x)
    common = {
        "camera_angle_x": camera_angle_x,
        "w": args.resolution,
        "h": args.resolution,
        "equipment": "bunsen-burner",
        "frame_states": FRAME_STATES,
    }
    (output / "transforms_train.json").write_text(json.dumps({**common, "frames": train_frames}, indent=2), encoding="utf-8")
    (output / "transforms_test.json").write_text(json.dumps({**common, "frames": test_frames}, indent=2), encoding="utf-8")
    (output / "dataset_manifest.json").write_text(
        json.dumps(
            {
                "id": "bunsen-burner-4dgs-synthetic-v1",
                "views_per_state": args.views,
                "resolution": args.resolution,
                "train_frames": len(train_frames),
                "test_frames": len(test_frames),
                "states": [state["id"] for state in FRAME_STATES],
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    write_seed_ply(output / "fused.ply", seed_objects)
    write_contact_sheet_html(qa_dir / "contact-sheet.html", all_images)
    return {"output": str(output), "train_frames": len(train_frames), "test_frames": len(test_frames)}


def object_color(obj: bpy.types.Object) -> tuple[int, int, int]:
    if obj.data.materials:
        color = obj.data.materials[0].diffuse_color
        return tuple(max(0, min(255, round(channel * 255))) for channel in color[:3])
    return (180, 180, 180)


def write_seed_ply(path: Path, objects: list[bpy.types.Object]) -> None:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    rows: list[tuple[float, float, float, int, int, int]] = []
    for obj in objects:
        if obj.hide_render or obj.type != "MESH":
            continue
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        color = object_color(obj)
        try:
            stride = max(1, len(mesh.vertices) // 320)
            for index, vertex in enumerate(mesh.vertices):
                if index % stride != 0:
                    continue
                point = obj.matrix_world @ vertex.co
                rows.append((point.x, point.y, point.z, *color))
        finally:
            evaluated.to_mesh_clear()

    header = [
        "ply",
        "format ascii 1.0",
        f"element vertex {len(rows)}",
        "property float x",
        "property float y",
        "property float z",
        "property float nx",
        "property float ny",
        "property float nz",
        "property uchar red",
        "property uchar green",
        "property uchar blue",
        "end_header",
    ]
    body = [f"{x:.6f} {y:.6f} {z:.6f} 0 0 0 {r} {g} {b}" for x, y, z, r, g, b in rows]
    path.write_text("\n".join(header + body) + "\n", encoding="utf-8")


def write_contact_sheet_html(path: Path, images: list[dict[str, str]]) -> None:
    items = "\n".join(
        f'<figure><img src="../{image["path"]}" alt="{image["state"]}"><figcaption>{image["state"]}</figcaption></figure>'
        for image in images
    )
    path.write_text(
        f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Bunsen burner 4DGS contact sheet</title>
    <style>
      body {{ margin: 24px; font-family: system-ui, sans-serif; background: #f5f6f3; color: #111; }}
      main {{ display: grid; gap: 18px; }}
      section {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); gap: 8px; }}
      figure {{ margin: 0; border: 1px solid #d9ded8; background: white; padding: 6px; }}
      img {{ aspect-ratio: 1; display: block; object-fit: cover; width: 100%; }}
      figcaption {{ font-size: 11px; margin-top: 4px; overflow-wrap: anywhere; }}
    </style>
  </head>
  <body>
    <main>
      <h1>Bunsen burner 4DGS contact sheet</h1>
      <section>{items}</section>
    </main>
  </body>
</html>
""",
        encoding="utf-8",
    )


def main() -> None:
    args = parse_args()
    result = render_dataset(args)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
