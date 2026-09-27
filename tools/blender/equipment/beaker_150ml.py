"""`beaker-150ml`: 150 mL low-form (Griffin) borosilicate beaker, 60 x 80 mm, with a spout.

It holds a working portion of a liquid so a pipette never enters a stock bottle (transmittance-dilution's
blank, decided 2026-09-26). Beaker graduations are approximate and the catalogue's 5 mL precision is
not one they carry, so none are printed or claimed; only the true "150 mL" capacity print is.
"""
import math

from labeq.geometry import FRONT, MM, bm_to_mesh, lathe_bmesh, make_obj, new_root, rounded, set_material_index
from labeq.markings import markings

DEFINITION_ID = 'beaker-150ml'
THUMB_ELEVATION_DEG = 18

R, T, H, FLOOR = 30.0, 1.5, 80.0, 2.0
BORE = R - T


def build(coll, M):
    root = new_root('Beaker_150mL', coll)
    pts = [(0, 0), (R - 3.0, 0), (R, 3.0), (R, H - 1.2), (R + 0.8, H - 0.2), (BORE + 0.2, H + 0.2),
           (BORE, H - 1.0), (BORE, FLOOR + 2.5), (BORE - 2.5, FLOOR), (0, FLOOR)]
    rad = [0, 1.5, 1.5, 0.8, 0.6, 0.6, 0.6, 1.5, 1.5, 0]
    bm = lathe_bmesh(rounded(pts, rad), segs=128)
    for v in bm.verts:  # the spout, facing -X
        z = v.co.z / MM
        if z < H - 10:
            continue
        a = math.atan2(v.co.y, v.co.x)
        da = math.atan2(math.sin(a - math.pi), math.cos(a - math.pi))
        wgt = math.exp(-(da / 0.3) ** 2)
        h = min(1.0, (z - (H - 10)) / 10.0) ** 2.2
        r = math.hypot(v.co.x, v.co.y)
        nr = r + 5.0 * MM * wgt * h
        v.co.x, v.co.y = nr * math.cos(a), nr * math.sin(a)
        v.co.z += 1.0 * MM * wgt * h
    glass = bm_to_mesh(bm, 'Beaker_glass')
    set_material_index(glass, lambda x, y, z: z > H - 1.5 or z < FLOOR + 0.3)
    make_obj('Beaker_glass', glass, coll, [M['Borosilicate glass'], M['Borosilicate glass thick']], root)
    markings('Beaker_print', [('text', '150 mL', 4.0, 0.0, H - 16.0, 'CENTER')],
             lambda z: R, FRONT, 0.06, coll, M['White enamel print'], root)
    inner = [[0.0, FLOOR], [BORE - 2.5, FLOOR], [BORE, FLOOR + 2.5], [BORE, H]]
    registry = {
        'footprintMm': {'shape': 'circle', 'radius': R},
        'grip': {'heightMm': 45.0},
        'pour': {'lipMm': [-(R + 5.0), 0.0, H + 1.0], 'tiltDeg': 100.0, 'style': 'pour'},
        'fill': {'innerProfileMm': inner, 'capacityMl': 150, 'meniscus': 'concave'},
        'graduations': None,
        'anchors': {},
        'displays': [],
        'states': {},
    }
    return root, registry
