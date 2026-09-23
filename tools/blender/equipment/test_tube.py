"""`test-tube`: 16 x 150 mm round-bottom test tube (catalogue capacity 20 mL).

It cannot stand unsupported, so the registry names its support: the visual-only
`test-tube-rack` scenery (decision D9), which is never an equipment instance. The origin is the
lowest point of the round bottom, the point a rack seat supports.
"""
import math

from equipment._fits import TEST_TUBE
from labeq.geometry import lathe, make_obj, new_root, rounded, set_material_index

DEFINITION_ID = 'test-tube'
THUMB_ELEVATION_DEG = 10


def build(coll, M):
    root = new_root('Test_tube_16x150', coll)
    ro, t, L = TEST_TUBE['od'] / 2, TEST_TUBE['wall'], TEST_TUBE['length']
    ri = ro - t
    n = 12
    outer = [(ro * math.sin(math.pi / 2 * i / n), ro - ro * math.cos(math.pi / 2 * i / n)) for i in range(n + 1)]
    inner = [(ri * math.sin(math.pi / 2 * i / n), ro - ri * math.cos(math.pi / 2 * i / n)) for i in range(n, -1, -1)]
    pts = outer + [(ro, L - 1.6), (ro + 0.7, L - 0.6), (ro - 0.2, L + 0.3), (ri, L - 1.0)] + inner
    rad = [0] * len(outer) + [0.6, 0.6, 0.6, 0.6] + [0] * len(inner)
    glass = lathe(rounded(pts, rad), segs=64)
    set_material_index(glass, lambda x, y, z: z > L - 2.0)
    make_obj('Test_tube_glass', glass, coll, [M['Borosilicate glass'], M['Borosilicate glass thick']], root)
    fill = [[round(r, 3), round(z, 3)] for r, z in reversed(inner)] + [[ri, L - 1.0]]
    registry = {
        'footprintMm': {'shape': 'circle', 'radius': ro},
        'grip': {'heightMm': 110.0},
        'pour': {'lipMm': [-(ro - 0.2), 0.0, L + 0.3], 'tiltDeg': 110.0, 'style': 'pour'},
        'fill': {'innerProfileMm': fill, 'capacityMl': 20, 'meniscus': 'concave'},
        'graduations': None,
        'requiresSupport': 'test-tube-rack',
        'anchors': {},
        'displays': [],
        'states': {},
    }
    return root, registry
