"""`capillary-spotter`: an open glass capillary, 1 mm bore and 75 mm long (Pack 3a, decided 2026-10-10).

The manual lists no spotting tool; the capillary is an inferred choice (the content's "inferred tool"). Dipped
in the dye, it fills by capillary action; touched to the baseline, it leaves a small spot. Modelled upright with
its origin at its tip, so it is carried and judged by the tip (`carriedByTip`), and lying flat at rest. A blue
code ring near its top end makes the thin tube easier to find on the bench (a modest boost; real capillaries are
often ringed).

Its bore holds about 0.06 mL, which is its fill profile and `capacityMl`; the catalogue's 1 mL is the 2D player's
allowance, so the validator lists it as a transient fill (decided 2026-10-11).
"""
import math

from labeq.geometry import FRONT, lathe, make_obj, new_root, profile_volume_ml, rounded, set_material_index
from labeq.markings import markings

DEFINITION_ID = 'capillary-spotter'
THUMB_ELEVATION_DEG = 30

R_IN, R_OUT, L = 0.5, 0.8, 75.0


def build(coll, M):
    root = new_root('Capillary_spotter', coll)
    prof = [(R_IN, 0.0), (R_OUT, 0.0), (R_OUT, L), (R_IN, L)]
    tube = lathe(rounded(prof, [0.12, 0.12, 0.12, 0.12], closed=True), segs=24, closed=True)
    set_material_index(tube, lambda x, y, z: z < 0.4 or z > L - 0.4)
    make_obj('Capillary_glass', tube, coll, [M['Borosilicate glass'], M['Borosilicate glass thick']], root, uv='box')
    half = math.pi * R_OUT
    markings('Capillary_ring', [('rect', -half, half, L - 9.0, L - 6.0, 12)], lambda z: R_OUT, FRONT, 0.02,
             coll, M['Blue print ink'], root)
    fill = [[R_IN, 0.0], [R_IN, L]]
    registry = {
        'footprintMm': {'shape': 'rect', 'width': R_OUT * 2 + 1, 'depth': L},
        'grip': {'heightMm': L - 15.0},
        'fill': {'innerProfileMm': fill, 'capacityMl': round(profile_volume_ml(fill), 3), 'meniscus': 'concave'},
        'graduations': None,
        'carriedByTip': True,
        'benchRest': {'rollDeg': -90.0, 'liftMm': R_OUT, 'shiftMm': [0.0, -L / 2]},
        'anchors': {},
        'displays': [],
        'states': {},
    }
    return root, registry
