"""`beaker-150ml`: 150 mL low-form (Griffin) borosilicate beaker, 60 x 80 mm, with a spout.

It holds a working portion of a liquid so a pipette never enters a stock bottle (transmittance-dilution's
blank, decided 2026-09-26). As on a real Griffin beaker, an approximate white scale is printed beside the
"150 mL" capacity print (25 to 125 mL in 25 mL steps, matching the 250 mL beaker; decided 2026-10-06). It
is for looks only (`_scales.py`): the registry claims no graduations, so it is never read as a measurement.
"""
from equipment._scales import approximate_scale
from labeq.geometry import FRONT, bm_to_mesh, lathe_bmesh, make_obj, new_root, pull_spout, rounded, set_material_index
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
    pull_spout(bm, H, 10.0, 5.0, 1.0)  # the spout, facing -X
    glass = bm_to_mesh(bm, 'Beaker_glass')
    set_material_index(glass, lambda x, y, z: z > H - 1.5 or z < FLOOR + 0.3)
    make_obj('Beaker_glass', glass, coll, [M['Borosilicate glass'], M['Borosilicate glass thick']], root)
    inner = [[0.0, FLOOR], [BORE - 2.5, FLOOR], [BORE, FLOOR + 2.5], [BORE, H]]
    markings('Beaker_print', [('text', '150 mL', 4.0, 0.0, H - 16.0, 'CENTER')] + approximate_scale(inner, 25, 125),
             lambda z: R, FRONT, 0.06, coll, M['White enamel print'], root)
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
