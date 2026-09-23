"""`rubber-stopper-set`: one #0 tapered rubber stopper (13 -> 17 mm, 25 mm long).

The transmittance technique's instance is a single "Rubber stopper", so one stopper is modelled.
Its origin is the centre of the small end, the end that enters a neck, so a parent's seat anchor
places it exactly (_fits.py).
"""
from equipment._fits import STOPPER
from labeq.geometry import lathe, make_obj, new_root, rounded

DEFINITION_ID = 'rubber-stopper-set'
THUMB_ELEVATION_DEG = 25


def build(coll, M):
    root = new_root('Rubber_stopper_0', coll)
    rs, rl, h = STOPPER['small_d'] / 2, STOPPER['large_d'] / 2, STOPPER['height']
    prof = rounded([(0, 0), (rs, 0), (rl, h), (0, h)], [0, 1.0, 1.4, 0])
    make_obj('Rubber_stopper', lathe(prof, segs=64), coll, M['Black rubber'], root)
    registry = {
        'footprintMm': {'shape': 'circle', 'radius': rl},
        'grip': {'heightMm': h * 0.7},
        'graduations': None,
        'anchors': {},
        'displays': [],
        'states': {},
    }
    return root, registry
