"""Cycles studio renders: library thumbnails and review renders (plan §6.3, M2 review).

The studio is the prototype's: a seamless cove backdrop, a key softbox, fill, top strip and
backdrop wash, plus black flags that only reflections and refractions see, which give glass its
dark edge definition. The studio world uses one of Blender's bundled studio-light EXRs.
"""
import math
import os

import bmesh
import bpy
from mathutils import Vector

from .geometry import bm_to_mesh, box_mesh, make_obj
from .materials import principled


def look_at(ob, target):
    d = Vector(target) - ob.location
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


def area_light(coll, name, loc, target, size, energy, size_y=None, color=(1, 1, 1)):
    li = bpy.data.lights.new(name, 'AREA')
    li.energy = energy
    li.color = color
    if size_y:
        li.shape = 'RECTANGLE'
        li.size, li.size_y = size, size_y
    else:
        li.size = size
    ob = bpy.data.objects.new(name, li)
    ob.location = loc
    coll.objects.link(ob)
    look_at(ob, target)
    return ob


def studio_world(scene, strength=0.3, name='studio.exr'):
    world = bpy.data.worlds.new('World_' + name)
    world.use_nodes = True
    nt = world.node_tree
    bg = nt.nodes['Background']
    env = nt.nodes.new('ShaderNodeTexEnvironment')
    path = os.path.join(bpy.utils.system_resource('DATAFILES'), 'studiolights', 'world', name)
    env.image = bpy.data.images.load(path, check_existing=True)
    nt.links.new(env.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = strength
    lp = nt.nodes.new('ShaderNodeLightPath')
    mix = nt.nodes.new('ShaderNodeMixShader')
    solid = nt.nodes.new('ShaderNodeBackground')
    solid.inputs['Color'].default_value = (0.5, 0.5, 0.5, 1)
    solid.inputs['Strength'].default_value = 0.4
    out = nt.nodes['World Output']
    nt.links.new(lp.outputs['Is Camera Ray'], mix.inputs['Fac'])
    nt.links.new(bg.outputs['Background'], mix.inputs[1])
    nt.links.new(solid.outputs['Background'], mix.inputs[2])
    nt.links.new(mix.outputs['Shader'], out.inputs['Surface'])
    scene.world = world


def build_studio(coll):
    bm = bmesh.new()
    prof = [(-3.0, 0.0), (0.35, 0.0)]
    for i in range(1, 17):
        a = i / 16 * math.pi / 2
        prof.append((0.35 + 0.7 * math.sin(a), 0.7 - 0.7 * math.cos(a)))
    prof.append((1.05, 3.0))
    rows = []
    for x in (-3.0, 3.0):
        rows.append([bm.verts.new((x, y, z)) for y, z in prof])
    for i in range(len(prof) - 1):
        bm.faces.new((rows[0][i], rows[1][i], rows[1][i + 1], rows[0][i + 1]))
    me = bm_to_mesh(bm, 'Backdrop')
    mat = principled('Studio backdrop paper', **{'Base Color': (0.6, 0.6, 0.6, 1), 'Roughness': 1.0,
                                                 'Specular IOR Level': 0.0})
    make_obj('Backdrop', me, coll, mat, sharp_deg=0)
    area_light(coll, 'Key softbox', (-1.5, -0.9, 1.1), (0, 0, 0.1), 1.1, 130)
    area_light(coll, 'Fill', (1.4, -1.0, 0.6), (0, 0, 0.1), 1.0, 12)
    area_light(coll, 'Top strip', (0.0, 0.25, 1.4), (0, 0, 0), 0.25, 60, size_y=1.4)
    area_light(coll, 'Backdrop wash', (0.0, -0.2, 1.6), (0, 1.1, 0.5), 1.5, 110)
    flag_mat = principled('Studio flag black', **{'Base Color': (0.0, 0.0, 0.0, 1), 'Roughness': 1.0})
    for sx in (-1, 1):
        f = make_obj('Flag', box_mesh('Flag', 10, 700, 1500), coll, flag_mat, sharp_deg=0,
                     loc=(sx * 190, 150, 770))
        f.visible_camera = f.visible_shadow = f.visible_diffuse = False
    f = make_obj('Flag', box_mesh('Flag', 500, 10, 1500), coll, flag_mat, sharp_deg=0, loc=(0, -900, 770))
    f.visible_camera = f.visible_shadow = f.visible_diffuse = False


def frame_camera(cam, lo, hi, elev_deg, res, margin=1.12):
    """Frame an axis-aligned box (metres) from -Y at `elev_deg`."""
    lo, hi = Vector(lo), Vector(hi)
    centre = (lo + hi) / 2
    size = hi - lo
    lens = cam.data.lens
    w, h = res
    half_v = math.atan(18.0 / lens) if h >= w else math.atan(18.0 * h / w / lens)
    half_h = math.atan(18.0 * w / h / lens) if h >= w else math.atan(18.0 / lens)
    e = math.radians(elev_deg)
    proj_h = size.z * math.cos(e) + size.y * math.sin(e)
    need = max(proj_h / 2 / math.tan(half_v), max(size.x, size.y) / 2 / math.tan(half_h))
    dist = need * margin + max(size.x, size.y) / 2
    cam.location = centre + Vector((0, -math.cos(e), math.sin(e))) * dist
    look_at(cam, centre)
    cam.data.dof.use_dof = True
    cam.data.dof.focus_distance = dist
    cam.data.dof.aperture_fstop = 11.0


def configure_cycles(scene, samples):
    scene.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    device = 'CPU'
    for backend in ('OPTIX', 'CUDA'):
        try:
            prefs.compute_device_type = backend
            prefs.get_devices()
            gpus = [d for d in prefs.devices if d.type == backend]
            if gpus:
                for d in prefs.devices:
                    d.use = d.type == backend
                scene.cycles.device = 'GPU'
                device = backend
                break
        except TypeError:
            continue
    c = scene.cycles
    c.samples = samples
    c.use_adaptive_sampling = True
    c.adaptive_threshold = 0.008
    c.use_denoising = True
    c.denoiser = 'OPENIMAGEDENOISE'
    c.max_bounces = 32
    c.transmission_bounces = 24
    c.glossy_bounces = 10
    c.transparent_max_bounces = 16
    c.diffuse_bounces = 4
    c.caustics_reflective = False
    c.blur_glossy = 0.6
    scene.view_settings.view_transform = 'AgX'
    try:
        scene.view_settings.look = 'AgX - Medium High Contrast'
    except TypeError:
        pass
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'
    return device


def render_item(scene, cam, lo, hi, path, res, elev_deg, samples):
    """Render the current scene contents framed on the item bounds (metres)."""
    configure_cycles(scene, samples)
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.resolution_percentage = 100
    cam.data.lens = 85
    frame_camera(cam, lo, hi, elev_deg, res)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
