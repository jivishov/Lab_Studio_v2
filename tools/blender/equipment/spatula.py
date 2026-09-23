"""`spatula`: 180 mm stainless double-ended spatula (flat blade and spoon), lying on the bench.

Pack 1 binds it by role only; no step manipulates it (plan §2.6)."""
import math

from labeq.geometry import box_mesh, lathe, make_obj, new_root, rounded, transform_mesh, Matrix

DEFINITION_ID = 'spatula'
THUMB_ELEVATION_DEG = 40

L, W, TH = 180.0, 4.0, 1.4


def build(coll, M):
    root = new_root('Spatula_180mm', coll)
    shaft = box_mesh('Spatula_shaft', L - 36, W, TH, bevel=0.5, segs=2)  # reaches both the blade and the spoon
    transform_mesh(shaft, Matrix.Translation((0, 0, TH / 2 * 0.001)))
    make_obj('Spatula_shaft', shaft, coll, M['Brushed stainless'], root, uv='box')
    blade = box_mesh('Spatula_blade', 36, 9, 0.8, bevel=0.35, segs=2)
    transform_mesh(blade, Matrix.Translation(((L / 2 - 18) * 0.001, 0, 0.4 * 0.001)))
    make_obj('Spatula_blade', blade, coll, M['Brushed stainless'], root, uv='box')
    spoon = lathe(rounded([(0, 0.0), (5.5, 0.6), (6.5, 2.8), (6.1, 3.0), (5.0, 1.2), (0, 0.8)], [0, 2, 0.4, 0.3, 2, 0]), segs=48)
    transform_mesh(spoon, Matrix.Scale(1.45, 4, (1, 0, 0)))
    transform_mesh(spoon, Matrix.Translation((-(L / 2 - 9) * 0.001, 0, 0)))
    make_obj('Spatula_spoon', spoon, coll, M['Brushed stainless'], root)
    registry = {
        'footprintMm': {'shape': 'rect', 'width': L, 'depth': 13.0},
        'grip': {'heightMm': 1.5},
        'graduations': None,
        'anchors': {},
        'displays': [],
        'states': {},
    }
    return root, registry
