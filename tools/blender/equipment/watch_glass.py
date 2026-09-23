"""`watch-glass`: 100 mm borosilicate watch glass, a spherical cap 10 mm deep.

It rests on its convex underside, as a real watch glass does. Solids heap at the centre of the
dish (solidRest), and the `watch-glass-paper-seat` anchor (filter paper, Pack 2) is the same point.
"""
import math

from labeq.geometry import lathe, make_obj, new_root, rounded, set_material_index

DEFINITION_ID = 'watch-glass'
THUMB_ELEVATION_DEG = 35

A, SAG, T = 50.0, 10.0, 1.6
RS = (A * A + SAG * SAG) / (2 * SAG)  # sphere radius of the cap


def build(coll, M):
    root = new_root('Watch_glass_100mm', coll)
    n = 24
    outer = [(A * i / n, RS - math.sqrt(RS * RS - (A * i / n) ** 2)) for i in range(n + 1)]
    ri_max = A - 0.8
    inner = [(ri_max * i / n, RS - math.sqrt((RS - T) ** 2 - (ri_max * i / n) ** 2)) for i in range(n, -1, -1)]
    rim = [(A + 0.5, outer[-1][1] + 0.8)]
    pts = outer + rim + inner
    rad = [0] * len(outer) + [0.8] + [0] * len(inner)
    rad[len(outer) - 1] = 0.8
    glass = lathe(rounded(pts, rad), segs=160)
    set_material_index(glass, lambda x, y, z: math.hypot(x, y) > A - 1.2, 1)
    make_obj('Watch_glass', glass, coll, [M['Borosilicate glass'], M['Borosilicate glass thick']], root)
    seat_z = round(RS - math.sqrt((RS - T) ** 2), 3)
    registry = {
        'footprintMm': {'shape': 'circle', 'radius': A},
        'grip': {'heightMm': 6.0},
        'graduations': None,
        'solidRest': {'centreMm': [0.0, 0.0, seat_z], 'radiusMm': 18.0},
        'anchors': {'watch-glass-paper-seat': {'positionMm': [0.0, 0.0, seat_z]}},
        'displays': [],
        'states': {},
    }
    return root, registry
