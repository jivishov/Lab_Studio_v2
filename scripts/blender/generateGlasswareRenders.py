"""Generate review-only Blender renders for realistic lab glassware.

Run with Blender:
  blender --factory-startup --background --python scripts/blender/generateGlasswareRenders.py -- \
    --output public/assets/equipment-realistic/v1/blender-lab-bench \
    --resolution 1024 \
    --samples 192
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


BLENDER_OUTPUTS = {
    "beaker-250ml": "beaker-250ml.png",
    "erlenmeyer-flask-250ml": "erlenmeyer-flask-250ml.png",
}

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="public/assets/equipment-realistic/v1/blender-lab-bench")
    parser.add_argument("--resolution", type=int, default=1024)
    parser.add_argument("--samples", type=int, default=192)
    return parser.parse_args(argv)


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()

    for collection in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.curves):
        for item in list(collection):
            if item.users == 0:
                collection.remove(item)


def set_input(node: bpy.types.Node, names: str | tuple[str, ...], value) -> None:
    if isinstance(names, str):
        names = (names,)
    for name in names:
        if name in node.inputs:
            node.inputs[name].default_value = value
            return


def make_principled_material(
    name: str,
    color: tuple[float, float, float, float],
    *,
    roughness: float = 0.5,
    metallic: float = 0.0,
    alpha: float = 1.0,
    transmission: float = 0.0,
    ior: float = 1.45,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = color
    if alpha < 1:
        material.blend_method = "BLEND"
        material.show_transparent_back = True
        if hasattr(material, "use_screen_refraction"):
            material.use_screen_refraction = True
        if hasattr(material, "surface_render_method"):
            material.surface_render_method = "BLENDED"

    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        set_input(bsdf, "Base Color", color)
        set_input(bsdf, "Alpha", alpha)
        set_input(bsdf, "Metallic", metallic)
        set_input(bsdf, "Roughness", roughness)
        set_input(bsdf, ("Transmission Weight", "Transmission"), transmission)
        set_input(bsdf, "IOR", ior)
        set_input(bsdf, ("Alpha",), alpha)
        set_input(bsdf, ("Specular IOR Level", "Specular"), 0.72)

    return material


def make_bench_material() -> bpy.types.Material:
    material = make_principled_material(
        "warm_gray_laminate_bench",
        (0.54, 0.51, 0.45, 1.0),
        roughness=0.64,
    )
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    if not bsdf:
        return material

    noise = nodes.new(type="ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 18
    noise.inputs["Detail"].default_value = 7
    noise.inputs["Roughness"].default_value = 0.58

    bump = nodes.new(type="ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.035
    bump.inputs["Distance"].default_value = 0.04

    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return material


def make_materials() -> dict[str, bpy.types.Material]:
    return {
        "glass": make_principled_material(
            "clear_borosilicate_glass",
            (0.72, 0.91, 1.0, 0.34),
            roughness=0.025,
            alpha=0.34,
            transmission=0.72,
            ior=1.47,
        ),
        "glass_edge": make_principled_material(
            "thicker_blue_glass_edges",
            (0.58, 0.85, 1.0, 0.48),
            roughness=0.04,
            alpha=0.48,
            transmission=0.55,
            ior=1.47,
        ),
        "etch": make_principled_material(
            "etched_gray_graduation_ink",
            (0.08, 0.11, 0.12, 0.72),
            roughness=0.42,
            alpha=0.72,
        ),
        "highlight": make_principled_material(
            "soft_white_glass_reflection",
            (1.0, 1.0, 0.94, 0.34),
            roughness=0.2,
            alpha=0.34,
        ),
        "bench": make_bench_material(),
        "backdrop": make_principled_material(
            "matte_neutral_backdrop",
            (0.70, 0.71, 0.68, 1.0),
            roughness=0.75,
        ),
        "contact_shadow": make_principled_material(
            "painted_contact_shadow",
            (0.08, 0.08, 0.07, 0.13),
            roughness=0.8,
            alpha=0.13,
        ),
    }


def assign(obj: bpy.types.Object, material: bpy.types.Material) -> bpy.types.Object:
    obj.data.materials.append(material)
    return obj


def smooth_with_modifiers(obj: bpy.types.Object, bevel_width: float = 0.006) -> bpy.types.Object:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.shade_smooth()

    bevel = obj.modifiers.new("small_real_glass_bevels", "BEVEL")
    bevel.width = bevel_width
    bevel.segments = 4
    bevel.affect = "EDGES"

    weighted = obj.modifiers.new("weighted_glass_normals", "WEIGHTED_NORMAL")
    weighted.keep_sharp = True
    return obj


def create_revolved_mesh(
    name: str,
    cross_section: list[tuple[float, float]],
    material: bpy.types.Material,
    *,
    segments: int = 160,
    bevel_width: float = 0.006,
) -> bpy.types.Object:
    vertices: list[tuple[float, float, float]] = []
    faces: list[list[int]] = []
    epsilon = 0.0004

    for segment in range(segments):
        angle = math.tau * segment / segments
        cos_angle = math.cos(angle)
        sin_angle = math.sin(angle)
        for radius, z in cross_section:
            radius = max(radius, epsilon)
            vertices.append((radius * cos_angle, radius * sin_angle, z))

    row_count = len(cross_section)

    def index(segment: int, row: int) -> int:
        return segment * row_count + row

    for segment in range(segments):
        next_segment = (segment + 1) % segments
        for row in range(row_count):
            next_row = (row + 1) % row_count
            faces.append(
                [
                    index(segment, row),
                    index(next_segment, row),
                    index(next_segment, next_row),
                    index(segment, next_row),
                ]
            )

    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    assign(obj, material)
    return smooth_with_modifiers(obj, bevel_width=bevel_width)


def add_torus(
    name: str,
    major_radius: float,
    minor_radius: float,
    z: float,
    material: bpy.types.Material,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_segments=192,
        minor_segments=16,
        major_radius=major_radius,
        minor_radius=minor_radius,
        location=(0.0, 0.0, z),
    )
    obj = bpy.context.object
    obj.name = name
    assign(obj, material)
    return smooth_with_modifiers(obj, bevel_width=0.001)


def add_box(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: bpy.types.Material,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    assign(obj, material)
    return obj


def add_text_label(
    text: str,
    location: tuple[float, float, float],
    size: float,
    material: bpy.types.Material,
) -> bpy.types.Object:
    bpy.ops.object.text_add(
        location=location,
        rotation=(math.radians(90), 0.0, 0.0),
    )
    obj = bpy.context.object
    obj.name = f"etched_label_{text.lower().replace(' ', '_')}"
    obj.data.body = text
    obj.data.align_x = "CENTER"
    obj.data.align_y = "CENTER"
    obj.data.size = size
    obj.data.extrude = 0.0008
    obj.data.resolution_u = 16
    assign(obj, material)
    return obj


def add_graduations(
    prefix: str,
    *,
    material: bpy.types.Material,
    y: float,
    x_left: float,
    z_start: float,
    tick_gap: float,
    count: int,
    major_every: int,
    major_length: float,
    minor_length: float,
) -> None:
    total_height = tick_gap * (count - 1)
    add_box(
        f"{prefix}_graduation_baseline",
        (x_left, y, z_start + total_height / 2),
        (0.007, 0.004, total_height + 0.018),
        material,
    )

    for index in range(count):
        is_major = index % major_every == 0
        length = major_length if is_major else minor_length
        z = z_start + index * tick_gap
        add_box(
            f"{prefix}_graduation_tick_{index:02d}",
            (x_left + length / 2, y, z),
            (length, 0.004, 0.008 if is_major else 0.006),
            material,
        )


def add_reflection_strip(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: bpy.types.Material,
) -> None:
    add_box(name, location, scale, material)


def add_contact_shadow(scale: tuple[float, float], material: bpy.types.Material) -> None:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=160,
        radius=1,
        depth=0.001,
        location=(0.0, -0.02, 0.002),
    )
    obj = bpy.context.object
    obj.name = "soft_elliptical_contact_shadow"
    obj.scale = (scale[0], scale[1], 1)
    assign(obj, material)


def create_beaker(materials: dict[str, bpy.types.Material]) -> None:
    cross_section = [
        (0.000, 0.020),
        (0.390, 0.020),
        (0.432, 0.046),
        (0.440, 0.088),
        (0.472, 1.255),
        (0.503, 1.312),
        (0.484, 1.350),
        (0.434, 1.322),
        (0.404, 0.145),
        (0.332, 0.092),
        (0.000, 0.092),
    ]
    create_revolved_mesh("beaker_thick_walled_body", cross_section, materials["glass"], bevel_width=0.005)
    add_torus("beaker_rolled_rim", 0.462, 0.020, 1.330, materials["glass_edge"])
    add_torus("beaker_heavy_base_ring", 0.354, 0.018, 0.082, materials["glass_edge"])

    add_graduations(
        "beaker",
        material=materials["etch"],
        y=-0.492,
        x_left=-0.300,
        z_start=0.255,
        tick_gap=0.092,
        count=11,
        major_every=2,
        major_length=0.166,
        minor_length=0.092,
    )
    add_text_label("250 mL", (-0.035, -0.504, 0.825), 0.073, materials["etch"])
    add_reflection_strip("beaker_left_softbox_reflection", (-0.355, -0.405, 0.760), (0.018, 0.004, 0.870), materials["highlight"])
    add_reflection_strip("beaker_right_softbox_reflection", (0.347, -0.408, 0.710), (0.014, 0.004, 0.720), materials["highlight"])
    add_contact_shadow((0.55, 0.38), materials["contact_shadow"])


def create_erlenmeyer_flask(materials: dict[str, bpy.types.Material]) -> None:
    cross_section = [
        (0.000, 0.020),
        (0.410, 0.020),
        (0.470, 0.052),
        (0.452, 0.112),
        (0.405, 0.500),
        (0.327, 0.620),
        (0.220, 0.748),
        (0.148, 0.902),
        (0.142, 1.246),
        (0.190, 1.292),
        (0.180, 1.342),
        (0.112, 1.352),
        (0.098, 0.922),
        (0.178, 0.782),
        (0.296, 0.638),
        (0.366, 0.505),
        (0.390, 0.148),
        (0.308, 0.090),
        (0.000, 0.090),
    ]
    create_revolved_mesh("erlenmeyer_thick_walled_body", cross_section, materials["glass"], bevel_width=0.005)
    add_torus("erlenmeyer_neck_rolled_rim", 0.147, 0.018, 1.326, materials["glass_edge"])
    add_torus("erlenmeyer_heavy_base_ring", 0.358, 0.018, 0.082, materials["glass_edge"])

    add_graduations(
        "erlenmeyer",
        material=materials["etch"],
        y=-0.440,
        x_left=-0.268,
        z_start=0.245,
        tick_gap=0.070,
        count=8,
        major_every=2,
        major_length=0.140,
        minor_length=0.080,
    )
    add_text_label("250 mL", (-0.010, -0.456, 0.455), 0.067, materials["etch"])
    add_reflection_strip("erlenmeyer_left_body_reflection", (-0.315, -0.350, 0.465), (0.017, 0.004, 0.450), materials["highlight"])
    add_reflection_strip("erlenmeyer_neck_reflection", (0.093, -0.120, 1.095), (0.012, 0.004, 0.365), materials["highlight"])
    add_contact_shadow((0.54, 0.39), materials["contact_shadow"])


def configure_renderer(resolution: int, samples: int) -> None:
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 8
    scene.cycles.transparent_max_bounces = 8
    scene.render.resolution_x = resolution
    scene.render.resolution_y = resolution
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.compression = 12
    scene.view_settings.view_transform = "Filmic"
    scene.view_settings.look = "Medium High Contrast"
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1

    try:
        cycles_preferences = bpy.context.preferences.addons["cycles"].preferences
        for device_type in ("OPTIX", "CUDA", "HIP", "ONEAPI", "METAL"):
            try:
                cycles_preferences.compute_device_type = device_type
                cycles_preferences.get_devices()
                gpu_devices = [device for device in cycles_preferences.devices if device.type != "CPU"]
                if gpu_devices:
                    for device in cycles_preferences.devices:
                        device.use = True
                    scene.cycles.device = "GPU"
                    break
            except Exception:
                continue
    except Exception:
        scene.cycles.device = "CPU"


def add_world(materials: dict[str, bpy.types.Material]) -> None:
    bpy.ops.mesh.primitive_plane_add(size=4.7, location=(0.0, 0.0, 0.0))
    bench = bpy.context.object
    bench.name = "matte_laminate_lab_bench"
    assign(bench, materials["bench"])

    bpy.ops.mesh.primitive_plane_add(
        size=4.7,
        location=(0.0, 1.72, 1.55),
        rotation=(math.radians(90), 0.0, 0.0),
    )
    backdrop = bpy.context.object
    backdrop.name = "neutral_lab_back_wall"
    assign(backdrop, materials["backdrop"])

    bpy.ops.object.light_add(type="AREA", location=(-2.25, -2.95, 3.15))
    key = bpy.context.object
    key.name = "large_left_softbox"
    key.data.energy = 520
    key.data.size = 3.8

    bpy.ops.object.light_add(type="AREA", location=(2.0, -2.0, 1.65))
    fill = bpy.context.object
    fill.name = "low_front_fill"
    fill.data.energy = 72
    fill.data.size = 4.2

    bpy.ops.object.light_add(type="AREA", location=(0.75, 1.12, 2.05))
    rim = bpy.context.object
    rim.name = "cool_rim_reflection_light"
    rim.data.energy = 165
    rim.data.size = 1.4

    world = bpy.data.worlds.new("soft_laboratory_world")
    world.color = (0.72, 0.74, 0.74)
    bpy.context.scene.world = world


def aim_at(obj: bpy.types.Object, target: Vector) -> None:
    direction = target - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_camera(asset_id: str) -> None:
    camera_data = bpy.data.cameras.new("Camera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 1.95 if asset_id == "beaker-250ml" else 1.92
    camera = bpy.data.objects.new("Camera", camera_data)
    camera.location = (2.15, -3.65, 1.55)
    bpy.context.collection.objects.link(camera)
    aim_at(camera, Vector((0.0, 0.0, 0.685)))
    bpy.context.scene.camera = camera


def render_asset(asset_id: str, output_path: Path, resolution: int, samples: int) -> None:
    reset_scene()
    configure_renderer(resolution, samples)
    materials = make_materials()
    add_world(materials)

    if asset_id == "beaker-250ml":
        create_beaker(materials)
    elif asset_id == "erlenmeyer-flask-250ml":
        create_erlenmeyer_flask(materials)
    else:
        raise ValueError(f"Unknown asset id: {asset_id}")

    add_camera(asset_id)
    bpy.context.scene.render.filepath = str(output_path)
    bpy.ops.render.render(write_still=True)


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output)
    if not output_dir.is_absolute():
        output_dir = PROJECT_ROOT / output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    for asset_id, filename in BLENDER_OUTPUTS.items():
        render_asset(asset_id, output_dir / filename, args.resolution, args.samples)


if __name__ == "__main__":
    main()
