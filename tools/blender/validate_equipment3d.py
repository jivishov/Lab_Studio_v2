"""Static validator for Lab Studio 3D equipment assets (plan §6.4). Needs no Blender or browser.

    py tools/blender/validate_equipment3d.py --pack 1 [--only wash-bottle] [--inventory <json>]

The pack's required definitions, owned semantic zones and catalogue capacity and precision come
from tools/blender/inventory_pack.ts, which evaluates the real core functions (run here with
Node unless --inventory names a saved report). With --only, just those definitions are required,
which is how a pack is validated while its models are still being built.

Checks, per required definition:
  1. a registry entry, GLB, meta.json and thumbnail exist;
  2. every semantic zone the definition owns has an anchor keyed by that zone id;
  3. a vessel with a catalogue capacity in mL declares a fill profile that holds at least that
     capacity, and fill.capacityMl equals it;
  4. declared graduations are in mL and top out at the capacity, and their minor step equals the
     catalogue precision when that precision is in mL (decision U9: a precision recorded in
     another unit is not treated as a volume precision);
  5. every display declares a policy from src/studio3d/equipment3d/displayPolicies.json;
  6. every GLB material is in src/studio3d/equipment3d/viewerMaterials.json;
  7. sizes are within budget (an item with a display is an instrument), and positions are float;
  8. the registry entry equals what the generator wrote into meta.json.
Scenery entries (decision D9) must be flagged `scenery` and may not be catalogue definitions.
Exit code 1 on any failure.
"""
import argparse
import json
import math
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
REPO = TOOLS.parent.parent
ASSETS = REPO / 'public' / 'assets' / 'equipment-3d' / 'v1'
EQ3D = REPO / 'src' / 'studio3d' / 'equipment3d'
REGISTRY = EQ3D / 'registry.json'
VIEWER_MATERIALS = EQ3D / 'viewerMaterials.json'
DISPLAY_POLICIES = EQ3D / 'displayPolicies.json'

# Plan §6.3: "about 250 KB per ordinary item and 600 KB per instrument, and about 4 MB for all of
# Pack 1". Taken as decimal kilobytes, the stricter reading.
BUDGET_ITEM = 250_000
BUDGET_INSTRUMENT = 600_000
BUDGET_PACK = 4_000_000
FLOAT = 5126


def load_inventory(pack, path):
    if path:
        return json.loads(Path(path).read_text(encoding='utf-8'))
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / 'inventory.json'
        subprocess.run(['node', '--experimental-strip-types', '--no-warnings', '--experimental-loader',
                        './scripts/tsCompositionLoader.mjs', 'tools/blender/inventory_pack.ts',
                        '--pack', str(pack), '--json', str(out)], cwd=REPO, check=True)
        return json.loads(out.read_text(encoding='utf-8'))


def glb_json(path):
    data = path.read_bytes()
    magic, _version, _length = struct.unpack_from('<4sII', data, 0)
    if magic != b'glTF':
        raise ValueError('not a GLB file')
    chunk_len, chunk_type = struct.unpack_from('<II', data, 12)
    if chunk_type != 0x4E4F534A:
        raise ValueError('first GLB chunk is not JSON')
    return json.loads(data[20:20 + chunk_len])


def profile_volume_ml(profile):
    vol = 0.0
    for (r0, z0), (r1, z1) in zip(profile, profile[1:]):
        h = z1 - z0
        if h > 0:
            vol += math.pi * h * (r0 * r0 + r0 * r1 + r1 * r1) / 3.0
    return vol / 1000.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pack', type=int, default=1)
    ap.add_argument('--only', default='')
    ap.add_argument('--inventory', default='')
    args = ap.parse_args()

    inventory = load_inventory(args.pack, args.inventory)
    catalogue = {e['definitionId']: e for e in inventory['equipment']}
    only = [s for s in args.only.split(',') if s]
    unknown = [d for d in only if d not in catalogue]
    required = only or sorted(catalogue)
    errors, notes = [], []
    if unknown:
        errors.append(f'--only names definitions outside Pack {args.pack}: {", ".join(unknown)}')

    registry = json.loads(REGISTRY.read_text(encoding='utf-8')) if REGISTRY.is_file() else {'entries': []}
    entries = {e['definitionId']: e for e in registry['entries']}
    viewer_materials = set(json.loads(VIEWER_MATERIALS.read_text(encoding='utf-8'))['materials'])
    policies = set(json.loads(DISPLAY_POLICIES.read_text(encoding='utf-8'))['policies']) \
        if DISPLAY_POLICIES.is_file() else set()

    pack_bytes = 0
    for def_id in required:
        where = f'[{def_id}]'
        cat = catalogue[def_id]
        entry = entries.get(def_id)
        if entry is None:
            errors.append(f'{where} no registry entry')
            continue
        glb, meta_path = ASSETS / entry['model'], ASSETS / f'{def_id}.meta.json'
        thumb = ASSETS / entry['thumbnail']
        for label, p in (('GLB', glb), ('meta.json', meta_path), ('thumbnail', thumb)):
            if not p.is_file():
                errors.append(f'{where} {label} missing: {p.relative_to(REPO)}')
        # 2. anchors for owned semantic zones
        for zone in cat['semanticZonesOwned']:
            if zone['id'] not in entry.get('anchors', {}):
                errors.append(f'{where} no anchor for owned zone "{zone["id"]}"')
        for anchor in entry.get('anchors', {}):
            if anchor not in {z['id'] for z in cat['semanticZonesOwned']}:
                errors.append(f'{where} anchor "{anchor}" is not a semantic zone this definition owns')
        # 3. fill profile and capacity
        cap = cat.get('capacitySpec') or {}
        fill = entry.get('fill')
        if cap.get('unit') == 'mL' and cap.get('amount', 0) > 0:
            if not fill:
                errors.append(f'{where} catalogue capacity {cap["amount"]} mL but no fill profile')
            else:
                vol = profile_volume_ml(fill['innerProfileMm'])
                if vol + 1e-6 < cap['amount']:
                    errors.append(f'{where} fill profile holds {vol:.1f} mL, below catalogue capacity {cap["amount"]} mL')
                if fill.get('capacityMl') != cap['amount']:
                    errors.append(f'{where} fill.capacityMl {fill.get("capacityMl")} != catalogue {cap["amount"]} mL')
                notes.append(f'{where} fill profile holds {vol:.1f} mL (catalogue {cap["amount"]} mL)')
        elif fill:
            errors.append(f'{where} declares a fill profile but has no catalogue capacity in mL')
        # 4. graduations (decision U9 for precision units)
        grads = entry.get('graduations')
        prec = cat.get('precisionSpec') or {}
        if grads:
            if grads.get('unit') != 'mL':
                errors.append(f'{where} graduations must be in mL')
            if cap.get('unit') == 'mL' and grads.get('maxMl') != cap.get('amount'):
                errors.append(f'{where} graduations top out at {grads.get("maxMl")}, capacity is {cap.get("amount")} mL')
            if prec.get('unit') == 'mL' and prec.get('amount', 0) > 0 and grads.get('minor') != prec['amount']:
                errors.append(f'{where} minor graduation {grads.get("minor")} != catalogue precision {prec["amount"]} mL')
        if prec.get('unit') not in (None, 'mL', 'none') and prec.get('amount', 0) > 0:
            notes.append(f'{where} catalogue precision {prec["amount"]} {prec["unit"]} is not a volume precision; '
                         'not used for graduations or shown (decision U9)')
        # 5. display policies
        for i, disp in enumerate(entry.get('displays', [])):
            if disp.get('policy') not in policies:
                errors.append(f'{where} display {i} policy "{disp.get("policy")}" is not in displayPolicies.json')
        # 6-7. GLB facts
        if glb.is_file():
            size = glb.stat().st_size
            pack_bytes += size
            instrument = bool(entry.get('displays'))
            budget = BUDGET_INSTRUMENT if instrument else BUDGET_ITEM
            if size > budget:
                errors.append(f'{where} GLB is {size:,} bytes, over the {budget:,} byte {"instrument" if instrument else "item"} budget')
            notes.append(f'{where} GLB {size:,} bytes ({"instrument" if instrument else "item"} budget {budget:,})')
            try:
                gltf = glb_json(glb)
            except ValueError as exc:
                errors.append(f'{where} {exc}')
                continue
            for m in gltf.get('materials', []):
                if m.get('name') not in viewer_materials:
                    errors.append(f'{where} material "{m.get("name")}" is not in viewerMaterials.json')
            accessors = gltf.get('accessors', [])
            for mesh in gltf.get('meshes', []):
                for prim in mesh.get('primitives', []):
                    pos = prim.get('attributes', {}).get('POSITION')
                    if pos is None or accessors[pos].get('componentType') != FLOAT:
                        errors.append(f'{where} mesh "{mesh.get("name")}" positions are not float')
            if 'KHR_mesh_quantization' in gltf.get('extensionsRequired', []):
                notes.append(f'{where} uses KHR_mesh_quantization (normals); positions checked float above')
        # 8. registry equals meta
        if meta_path.is_file():
            meta = json.loads(meta_path.read_text(encoding='utf-8'))
            expected = {k: v for k, v in entry.items() if k not in ('definitionId', 'model', 'thumbnail', 'provenance', 'scenery')}
            if meta['registry'] != expected:
                errors.append(f'{where} registry entry differs from meta.json: run pack_models.py --registry-only')
            if meta['provenance']['sourceHash'] != entry.get('provenance', {}).get('sourceHash'):
                errors.append(f'{where} registry provenance hash differs from meta.json')

    for def_id, entry in entries.items():
        if entry.get('scenery'):
            if def_id in catalogue:
                errors.append(f'[{def_id}] scenery entry uses a catalogue definition id (decision D9)')
        elif def_id not in catalogue and not only:
            notes.append(f'[{def_id}] registry entry is outside Pack {args.pack}')
    if not only and pack_bytes > BUDGET_PACK:
        errors.append(f'Pack {args.pack} models total {pack_bytes:,} bytes, over {BUDGET_PACK:,}')

    scope = ', '.join(required)
    for n in notes:
        print(f'note  {n}')
    for e in errors:
        print(f'FAIL  {e}')
    print(f'{"FAIL" if errors else "PASS"}: Pack {args.pack}, {len(required)} definition(s) [{scope}], '
          f'{len(errors)} failure(s), models {pack_bytes:,} bytes')
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
