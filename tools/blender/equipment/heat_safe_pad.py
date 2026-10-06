"""`heat-safe-pad`: a 150 mm square ceramic-fibre heat-safe pad, 8 mm thick (Pack 2, decided 2026-10-05).

Hot glassware and crucibles are set on it to cool (S-05/S-06; Investigation 7's cooling surface). The
seat `heat-safe-pad-surface` is the centre of its top face. Nothing is printed on it.
"""
from labeq.geometry import MM, Matrix, box_mesh, make_obj, new_root, transform_mesh

DEFINITION_ID = 'heat-safe-pad'
THUMB_ELEVATION_DEG = 35

S, T = 150.0, 8.0


def build(coll, M):
    root = new_root('Heat_safe_pad', coll)
    pad = box_mesh('Heat_safe_pad', S, S, T, bevel=1.5, segs=2)
    transform_mesh(pad, Matrix.Translation((0, 0, T / 2 * MM)))
    make_obj('Heat_safe_pad', pad, coll, M['Ceramic fibre board'], root, uv='box')
    registry = {
        'footprintMm': {'shape': 'rect', 'width': S, 'depth': S},
        'grip': {'heightMm': T},
        'graduations': None,
        'anchors': {'heat-safe-pad-surface': {'positionMm': [0.0, 0.0, T]}},
        'displays': [],
        'states': {},
    }
    return root, registry
