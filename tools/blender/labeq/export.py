"""GLB export and per-asset provenance."""
import hashlib
import os

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.abspath(os.path.join(HERE, '..'))
REPO = os.path.abspath(os.path.join(TOOLS, '..', '..'))


def export_glb(coll, path):
    """Export one item's collection as a GLB (Y-up, modifiers applied, names kept)."""
    for ob in bpy.context.scene.objects:
        ob.select_set(False)
    for ob in coll.all_objects:
        ob.select_set(True)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True,
                              export_apply=True, export_yup=True)


def _normalised_bytes(path):
    with open(path, 'rb') as fh:
        return fh.read().replace(b'\r\n', b'\n')


def source_hash(module_path):
    """SHA-256 over the definition module and every labeq module, line endings normalised, so
    the hash changes exactly when the generator that produced the asset changes."""
    h = hashlib.sha256()
    files = [module_path] + sorted(
        os.path.join(HERE, f) for f in os.listdir(HERE) if f.endswith('.py'))
    for f in files:
        h.update(os.path.relpath(f, REPO).replace('\\', '/').encode())
        h.update(b'\0')
        h.update(_normalised_bytes(f))
    return h.hexdigest()


def rel(path):
    return os.path.relpath(path, REPO).replace('\\', '/')


def blender_version():
    return bpy.app.version_string.split(' ')[0]
