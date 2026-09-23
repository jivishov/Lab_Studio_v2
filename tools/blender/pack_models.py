"""Compress built GLBs with gltfpack and regenerate the equipment3d registry (plan §6.3, §4.3).

    py tools/blender/pack_models.py [--only wash-bottle,cuvette] [--registry-only]

gltfpack flags (plan §6.3), and why each matters to the viewer:
  -cc      meshopt compression, decoded offline by three.js's bundled MeshoptDecoder, no workers;
  -kn -km  keep node and material names: the viewer assigns materials by name;
  -kv      keep every vertex attribute: the physical-unit UVs drive procedural textures;
  -vn 12   12-bit normals, so glass reflections do not band;
  -vtf     float UVs;
  -vpf     float positions. Quantized positions move a ~1e-5 dequantisation scale onto the nodes,
           and three.js scales transmission thickness by the model scale, flattening the glass.

The registry (src/studio3d/equipment3d/registry.json) is regenerated from every
public/assets/equipment-3d/v1/<id>.meta.json, so it can never drift from the generator.
"""
import argparse
import json
import struct
import subprocess
import sys
import time
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
REPO = TOOLS.parent.parent
ASSETS = REPO / 'public' / 'assets' / 'equipment-3d' / 'v1'
BUILD = TOOLS / '.build' / 'models'
REGISTRY = REPO / 'src' / 'studio3d' / 'equipment3d' / 'registry.json'
GLTFPACK = REPO / 'node_modules' / 'gltfpack' / 'cli.js'
FLAGS = ['-cc', '-kn', '-km', '-kv', '-vn', '12', '-vtf', '-vpf']


def complete_glb(path, not_before):
    """True when `path` is a whole GLB written during this run: magic, declared length equal to
    the file size, and a JSON chunk that parses with at least one mesh."""
    try:
        if path.stat().st_mtime < not_before:
            return False
        data = path.read_bytes()
        magic, _v, length = struct.unpack_from('<4sII', data, 0)
        chunk_len, chunk_type = struct.unpack_from('<II', data, 12)
        doc = json.loads(data[20:20 + chunk_len])
        return magic == b'glTF' and length == len(data) and chunk_type == 0x4E4F534A and bool(doc.get('meshes'))
    except (OSError, struct.error, ValueError):
        return False


def pack(def_id):
    src, dst = BUILD / f'{def_id}.glb', ASSETS / f'{def_id}.glb'
    if not src.is_file():
        raise SystemExit(f'{src} is missing: run build_equipment3d.py first')
    started = time.time() - 1
    result = subprocess.run(['node', str(GLTFPACK), '-i', str(src), '-o', str(dst), *FLAGS])
    if result.returncode != 0:
        # Node 23 on Windows can abort in libuv teardown (async.c UV_HANDLE_CLOSING assertion)
        # after gltfpack has already written its output, typically on very small inputs. Accept
        # the run only when the output provably finished; anything else still fails.
        if not complete_glb(dst, started):
            raise SystemExit(f'gltfpack failed for {def_id} (exit {result.returncode})')
        print(f'warning: gltfpack exited {result.returncode} after writing a complete {dst.name} '
              '(Node teardown assertion); output verified')
    print(f'{def_id}: {src.stat().st_size:,} -> {dst.stat().st_size:,} bytes')


def registry_entry(meta):
    reg = meta['registry']
    entry = {
        'definitionId': meta['definitionId'],
        'model': meta['model'],
        'thumbnail': meta['thumbnail'],
        **reg,
        'provenance': {k: meta['provenance'][k] for k in ('blender', 'generator', 'sourceHash')},
    }
    if meta['build'].get('scenery'):
        entry['scenery'] = True
    return entry


def write_registry():
    metas = [json.loads(p.read_text(encoding='utf-8')) for p in sorted(ASSETS.glob('*.meta.json'))]
    doc = {
        'schema': 'lab-studio-3d/equipment3d-registry@1',
        'generatedBy': 'tools/blender/pack_models.py',
        'coordinates': 'Model-local millimetres: x right, y away from the default viewer, z up; '
                       'origin at the footprint centre on the bench plane. Anchors are keyed by '
                       'semantic zone id (src/domain/interactionZones.ts).',
        'assetBase': 'assets/equipment-3d/v1/',
        'entries': sorted((registry_entry(m) for m in metas), key=lambda e: e['definitionId']),
    }
    REGISTRY.parent.mkdir(parents=True, exist_ok=True)
    REGISTRY.write_text(json.dumps(doc, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(f'registry: {len(doc["entries"])} entries -> {REGISTRY.relative_to(REPO)}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', default='')
    ap.add_argument('--registry-only', action='store_true')
    args = ap.parse_args()
    if not args.registry_only:
        if not GLTFPACK.is_file():
            raise SystemExit('gltfpack not found in node_modules (devDependency "gltfpack")')
        only = [s for s in args.only.split(',') if s]
        ids = only or sorted(p.name[:-len('.meta.json')] for p in ASSETS.glob('*.meta.json'))
        for def_id in ids:
            pack(def_id)
    write_registry()


if __name__ == '__main__':
    sys.exit(main())
