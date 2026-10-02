"""`beral-pipette`: disposable LDPE transfer (Beral) pipette, 155 mm, with a squeeze bulb (catalogue 3 mL).

Modelled upright with its origin at the tip, the end that goes into a liquid, so a carried pipette
is judged and drawn by its tip. Off the hand it lies on the bench (`benchRest`: laid down along the
bench's depth, lifted by the bulb radius, and shifted so its footprint centres on its bench point).
The stem and bulb are one blow-moulded LDPE wall; the fill profile follows the bore from the tip up,
as liquid drawn in rises from the tip. Stem graduations are not modelled or claimed (the catalogue's
0.2 mL precision is not a scale this part carries).
"""
from labeq.geometry import lathe, make_obj, new_root, rounded

DEFINITION_ID = 'beral-pipette'
THUMB_ELEVATION_DEG = 12

L, BULB_R, STEM_R, TIP_R, WALL = 155.0, 7.5, 3.0, 1.0, 0.6
TAPER_TOP, BULB_START, BULB_TOP = 22.0, 108.0, 150.0


def build(coll, M):
    root = new_root('Beral_pipette_3mL', coll)
    outer = [(TIP_R - WALL, 0.0), (TIP_R, 0.2), (STEM_R, TAPER_TOP), (STEM_R, BULB_START),
             (BULB_R, BULB_START + 9.0), (BULB_R, BULB_TOP - 8.0), (3.0, L - 0.6), (0.0, L)]
    rad = [0, 0.2, 3.0, 3.0, 4.0, 5.0, 3.0, 0]
    inner = [(0.0, L - WALL), (3.0 - WALL, L - 1.2), (BULB_R - WALL, BULB_TOP - 8.0), (BULB_R - WALL, BULB_START + 9.0),
             (STEM_R - WALL, BULB_START), (STEM_R - WALL, TAPER_TOP), (TIP_R - WALL, 0.6)]
    irad = [0, 3.0, 5.0, 4.0, 3.0, 3.0, 0]
    wall = lathe(rounded(outer + inner, rad + irad), segs=64)
    make_obj('Beral_pipette', wall, coll, M['LDPE natural'], root)
    fill = [[round(r, 3), round(z, 3)] for r, z in reversed(inner)]
    registry = {
        'footprintMm': {'shape': 'rect', 'width': BULB_R * 2, 'depth': L},
        'grip': {'heightMm': BULB_START + 20.0},
        'fill': {'innerProfileMm': fill, 'capacityMl': 3, 'meniscus': 'concave'},
        'graduations': None,
        'carriedByTip': True,
        'benchRest': {'rollDeg': -90.0, 'liftMm': BULB_R, 'shiftMm': [0.0, -L / 2]},
        'anchors': {},
        'displays': [],
        'states': {},
    }
    return root, registry
