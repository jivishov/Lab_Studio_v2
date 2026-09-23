"""Build Lab Studio 3D equipment: model, meta and thumbnail per definition (plan §6).

    blender -b --factory-startup -P tools/blender/build_equipment3d.py -- [--only wash-bottle,cuvette]
        [--no-render] [--review] [--preview]

For each module in tools/blender/equipment/ (one per catalogue definition id):
- builds it in a fresh, empty scene at real scale;
- exports the raw GLB to tools/blender/.build/models/<id>.glb (packed later by pack_models.py);
- writes public/assets/equipment-3d/v1/<id>.meta.json: the registry facts the module derives
  from its own geometry, build facts, and provenance (Blender version, generator path, source
  hash, marking font);
- renders the Cycles thumbnail public/assets/equipment-3d/v1/thumbs/<id>.png (256 x 256, enough for the largest UI use at 2x), and with
  --review a 1200 x 1500 review render into tools/blender/.build/review/.
"""
import argparse
import importlib
import json
import os
import sys

import bpy

TOOLS = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, TOOLS)

from labeq.export import REPO, blender_version, export_glb, rel, source_hash  # noqa: E402
from labeq.geometry import MM, bounds_mm  # noqa: E402
from labeq.markings import MARKING_FONT  # noqa: E402
from labeq.materials import Materials  # noqa: E402
from labeq.render import build_studio, render_item, studio_world  # noqa: E402

ASSETS = os.path.join(REPO, 'public', 'assets', 'equipment-3d', 'v1')
BUILD = os.path.join(TOOLS, '.build')


def equipment_modules():
    mods = {}
    folder = os.path.join(TOOLS, 'equipment')
    for f in sorted(os.listdir(folder)):
        if f.endswith('.py') and not f.startswith('_'):
            mod = importlib.import_module(f'equipment.{f[:-3]}')
            mods[mod.DEFINITION_ID] = mod
    return mods


def fresh_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    return scene


def triangle_count(coll):
    dg = bpy.context.evaluated_depsgraph_get()
    total = 0
    for ob in coll.all_objects:
        if ob.type == 'MESH':
            me = ob.evaluated_get(dg).to_mesh()
            me.calc_loop_triangles()
            total += len(me.loop_triangles)
            ob.evaluated_get(dg).to_mesh_clear()
    return total


def material_names(coll):
    names = set()
    for ob in coll.all_objects:
        if ob.type == 'MESH':
            names.update(m.name for m in ob.data.materials if m is not None)
    return sorted(names)


def build_one(def_id, mod, args):
    scene = fresh_scene()
    coll = bpy.data.collections.new(def_id)
    scene.collection.children.link(coll)
    root, registry = mod.build(coll, Materials())
    bpy.context.view_layer.update()
    raw = os.path.join(BUILD, 'models', f'{def_id}.glb')
    export_glb(coll, raw)
    lo, hi = bounds_mm(coll.all_objects)
    module_path = os.path.abspath(mod.__file__)
    meta = {
        'schema': 'lab-studio-3d/equipment-meta@1',
        'definitionId': def_id,
        'model': f'{def_id}.glb',
        'thumbnail': f'thumbs/{def_id}.png',
        'registry': registry,
        'build': {
            'boundsMm': {'min': lo, 'max': hi},
            'triangles': triangle_count(coll),
            'materials': material_names(coll),
            'scenery': bool(getattr(mod, 'SCENERY', False)),
        },
        'provenance': {
            'blender': blender_version(),
            'generator': rel(module_path),
            'library': 'tools/blender/labeq',
            'sourceHash': source_hash(module_path),
            'markingFont': MARKING_FONT,
        },
    }
    os.makedirs(ASSETS, exist_ok=True)
    with open(os.path.join(ASSETS, f'{def_id}.meta.json'), 'w', encoding='utf-8', newline='\n') as fh:
        json.dump(meta, fh, indent=2)
        fh.write('\n')
    print(f'built {def_id}: {meta["build"]["triangles"]} triangles, materials {meta["build"]["materials"]}')

    if args.no_render:
        return
    studio = bpy.data.collections.new('studio')
    scene.collection.children.link(studio)
    build_studio(studio)
    studio_world(scene, strength=0.3)
    scene.view_settings.exposure = -0.75
    cam = bpy.data.objects.new('Camera', bpy.data.cameras.new('Camera'))
    scene.collection.objects.link(cam)
    scene.camera = cam
    lo_m = [v * MM for v in lo]
    hi_m = [v * MM for v in hi]
    elev = getattr(mod, 'THUMB_ELEVATION_DEG', 10)
    render_item(scene, cam, lo_m, hi_m, os.path.join(ASSETS, 'thumbs', f'{def_id}.png'),
                (256, 256), elev, 48 if args.preview else 160)
    if args.review:
        render_item(scene, cam, lo_m, hi_m, os.path.join(BUILD, 'review', f'{def_id}.png'),
                    (1200, 1500), elev, 64 if args.preview else 384)


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', default='')
    ap.add_argument('--no-render', action='store_true')
    ap.add_argument('--review', action='store_true')
    ap.add_argument('--preview', action='store_true')
    args = ap.parse_args(argv)
    only = set(filter(None, args.only.split(',')))
    mods = equipment_modules()
    unknown = only - set(mods)
    if unknown:
        raise SystemExit(f'No equipment module for: {", ".join(sorted(unknown))}')
    for def_id, mod in mods.items():
        if only and def_id not in only:
            continue
        build_one(def_id, mod, args)


if __name__ == '__main__':
    main()
