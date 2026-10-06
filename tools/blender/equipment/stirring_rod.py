"""`stirring-rod`: 200 mm glass stirring rod, 6 mm, fire-polished ends.

Modelled upright with its origin at the lower tip, as it stands in a beaker (Pack 2's precipitation
practice, decided 2026-10-05: it rests in the 250 mL beaker, leaning on the rim, while the reagent is
stirred in). Off the hand it lies on the bench (`benchRest`: laid down along the bench's depth, lifted
by its radius, and shifted so its footprint centres on its bench point), as the Beral pipette does.
"""
from labeq.geometry import lathe, make_obj, new_root, rounded

DEFINITION_ID = 'stirring-rod'
THUMB_ELEVATION_DEG = 40

L, RR = 200.0, 3.0


def build(coll, M):
    root = new_root('Stirring_rod_200mm', coll)
    prof = rounded([(0, 0), (RR, 0), (RR, L), (0, L)], [0, 2.4, 2.4, 0])
    rod = lathe(prof, segs=32)
    make_obj('Stirring_rod', rod, coll, M['Borosilicate glass thick'], root, uv='box')
    registry = {
        'footprintMm': {'shape': 'rect', 'width': 2 * RR, 'depth': L},
        'grip': {'heightMm': L * 0.7},
        'graduations': None,
        'benchRest': {'rollDeg': -90.0, 'liftMm': RR, 'shiftMm': [0.0, -L / 2]},
        'anchors': {},
        'displays': [],
        'states': {},
    }
    return root, registry
