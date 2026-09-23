"""`stirring-rod`: 200 mm glass stirring rod, 6 mm, fire-polished ends, lying on the bench.

Pack 1 binds it by role only; no step manipulates it (plan §2.6)."""
import math

from labeq.geometry import Matrix, lathe, make_obj, new_root, rounded, transform_mesh

DEFINITION_ID = 'stirring-rod'
THUMB_ELEVATION_DEG = 40

L, RR = 200.0, 3.0


def build(coll, M):
    root = new_root('Stirring_rod_200mm', coll)
    prof = rounded([(0, -L / 2), (RR, -L / 2), (RR, L / 2), (0, L / 2)], [0, 2.4, 2.4, 0])
    rod = lathe(prof, segs=32)
    transform_mesh(rod, Matrix.Rotation(math.pi / 2, 4, 'Y'))
    transform_mesh(rod, Matrix.Translation((0, 0, RR * 0.001)))
    make_obj('Stirring_rod', rod, coll, M['Borosilicate glass thick'], root, uv='box')
    registry = {
        'footprintMm': {'shape': 'rect', 'width': L, 'depth': 2 * RR},
        'grip': {'heightMm': RR},
        'graduations': None,
        'anchors': {},
        'displays': [],
        'states': {},
    }
    return root, registry
