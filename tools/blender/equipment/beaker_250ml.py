"""`beaker-250ml`: 250 mL low-form (Griffin) borosilicate beaker, 70 x 95 mm, with a spout.

Pack 2's working beaker (decided 2026-10-05): the hard-water sample is poured into it and rinsed in,
the calcium carbonate is precipitated in it, and it is poured and rinsed into the filter funnel. As
for a real Griffin beaker, an approximate white scale is printed beside the "250 mL" capacity print
(50 to 200 mL in 25 mL steps; decided 2026-10-06). It is for looks only: the registry claims no
graduations, so it is never read as a measurement, and the catalogue's 5 mL precision is not its own.
"""
from equipment._scales import approximate_scale
from labeq.geometry import FRONT, bm_to_mesh, lathe_bmesh, make_obj, new_root, pull_spout, rounded, set_material_index
from labeq.markings import markings

DEFINITION_ID = 'beaker-250ml'
THUMB_ELEVATION_DEG = 18

R, T, H, FLOOR = 35.0, 1.6, 95.0, 2.2
BORE = R - T
SPOUT = 5.5


def build(coll, M):
    root = new_root('Beaker_250mL', coll)
    pts = [(0, 0), (R - 3.0, 0), (R, 3.0), (R, H - 1.2), (R + 0.8, H - 0.2), (BORE + 0.2, H + 0.2),
           (BORE, H - 1.0), (BORE, FLOOR + 2.5), (BORE - 2.5, FLOOR), (0, FLOOR)]
    rad = [0, 1.5, 1.5, 0.8, 0.6, 0.6, 0.6, 1.5, 1.5, 0]
    bm = lathe_bmesh(rounded(pts, rad), segs=128)
    pull_spout(bm, H, 11.0, SPOUT, 1.0)  # the spout, facing -X
    glass = bm_to_mesh(bm, 'Beaker_glass')
    set_material_index(glass, lambda x, y, z: z > H - 1.5 or z < FLOOR + 0.3)
    make_obj('Beaker_glass', glass, coll, [M['Borosilicate glass'], M['Borosilicate glass thick']], root)
    inner = [[0.0, FLOOR], [BORE - 2.5, FLOOR], [BORE, FLOOR + 2.5], [BORE, H]]
    markings('Beaker_print', [('text', '250 mL', 4.5, 0.0, H - 18.0, 'CENTER')] + approximate_scale(inner, 50, 200),
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
