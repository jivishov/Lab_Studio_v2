"""`beaker-250ml`: 250 mL low-form (Griffin) borosilicate beaker, 70 x 95 mm, with a spout.

Pack 2's working beaker (decided 2026-10-05): the hard-water sample is poured into it and rinsed in,
the calcium carbonate is precipitated in it, and it is poured and rinsed into the filter funnel. As
for a real Griffin beaker, an approximate white scale is printed beside the "250 mL" capacity print
(50 to 200 mL in 25 mL steps; decided 2026-10-06). It is for looks only: the registry claims no
graduations, so it is never read as a measurement, and the catalogue's 5 mL precision is not its own.
"""
import math

from labeq.geometry import FRONT, MM, bm_to_mesh, lathe_bmesh, level_for_volume_mm, make_obj, new_root, rounded, set_material_index
from labeq.markings import markings

DEFINITION_ID = 'beaker-250ml'
THUMB_ELEVATION_DEG = 18

R, T, H, FLOOR = 35.0, 1.6, 95.0, 2.2
BORE = R - T
SPOUT = 5.5


def approximate_scale(inner):
    """The printed approximate scale (decided 2026-10-06, look only): 50 to 200 mL in 25 mL steps, every
    50 mL numbered, beside the capacity print. Each line sits where the inner profile holds that volume."""
    pieces = []
    for ml in range(50, 201, 25):
        z = level_for_volume_mm(inner, ml)
        if ml % 50 == 0:
            pieces.append(('rect', -24.0, -16.0, z - 0.28, z + 0.28, 6))
            pieces.append(('text', str(ml), 3.2, -25.5, z, 'RIGHT'))
        else:
            pieces.append(('rect', -24.0, -19.0, z - 0.22, z + 0.22, 4))
    return pieces


def build(coll, M):
    root = new_root('Beaker_250mL', coll)
    pts = [(0, 0), (R - 3.0, 0), (R, 3.0), (R, H - 1.2), (R + 0.8, H - 0.2), (BORE + 0.2, H + 0.2),
           (BORE, H - 1.0), (BORE, FLOOR + 2.5), (BORE - 2.5, FLOOR), (0, FLOOR)]
    rad = [0, 1.5, 1.5, 0.8, 0.6, 0.6, 0.6, 1.5, 1.5, 0]
    bm = lathe_bmesh(rounded(pts, rad), segs=128)
    for v in bm.verts:  # the spout, facing -X
        z = v.co.z / MM
        if z < H - 11:
            continue
        a = math.atan2(v.co.y, v.co.x)
        da = math.atan2(math.sin(a - math.pi), math.cos(a - math.pi))
        wgt = math.exp(-(da / 0.3) ** 2)
        h = min(1.0, (z - (H - 11)) / 11.0) ** 2.2
        r = math.hypot(v.co.x, v.co.y)
        nr = r + SPOUT * MM * wgt * h
        v.co.x, v.co.y = nr * math.cos(a), nr * math.sin(a)
        v.co.z += 1.0 * MM * wgt * h
    glass = bm_to_mesh(bm, 'Beaker_glass')
    set_material_index(glass, lambda x, y, z: z > H - 1.5 or z < FLOOR + 0.3)
    make_obj('Beaker_glass', glass, coll, [M['Borosilicate glass'], M['Borosilicate glass thick']], root)
    inner = [[0.0, FLOOR], [BORE - 2.5, FLOOR], [BORE, FLOOR + 2.5], [BORE, H]]
    markings('Beaker_print', [('text', '250 mL', 4.5, 0.0, H - 18.0, 'CENTER')] + approximate_scale(inner),
             lambda z: R, FRONT, 0.06, coll, M['White enamel print'], root)
    registry = {
        'footprintMm': {'shape': 'circle', 'radius': R},
        'grip': {'heightMm': 52.0},
        'pour': {'lipMm': [-(R + SPOUT), 0.0, H + 1.0], 'tiltDeg': 100.0, 'style': 'pour'},
        'fill': {'innerProfileMm': inner, 'capacityMl': 250, 'meniscus': 'concave'},
        # A settled precipitate lies on the floor (Precipitation's drop test).
        'solidRest': {'centreMm': [0.0, 0.0, FLOOR], 'radiusMm': BORE - 3.0},
        'graduations': None,
        # The stirring rod stands in the beaker with its tip on the floor on the spout's side and leans
        # across to rest against the far rim (30 degrees from upright), seen side-on from the front.
        'anchors': {'beaker-250ml-stirring-rod-rest': {'positionMm': [-(BORE - 9.0), 0.0, FLOOR], 'yawDeg': -90.0, 'leanDeg': 30.0}},
        'displays': [],
        'states': {},
    }
    return root, registry
