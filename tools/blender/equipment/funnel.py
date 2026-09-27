"""`funnel`: 55 mm, 60 degree borosilicate filling funnel with a 45 mm stem (catalogue: glass funnel).

Its origin is the stem tip, so a parent's seat anchor places it exactly: in the 25 mL cylinder the
cone rests on the rim where its outer radius equals the bore (_fits.py, decided 2026-09-26).
Off its seat it rests mouth-down on the bench, as a funnel is set down (`benchRest`: turned over and
lifted by its height); the viewer carries and seats it upright.
"""
import math

from equipment._fits import FUNNEL
from labeq.geometry import lathe, make_obj, new_root, rounded, set_material_index

DEFINITION_ID = 'funnel'
THUMB_ELEVATION_DEG = 25


def build(coll, M):
    root = new_root('Filling_funnel_55mm', coll)
    so, si, ls, w = FUNNEL['stem_od'] / 2, FUNNEL['stem_id'] / 2, FUNNEL['stem_len'], FUNNEL['wall']
    tan = math.tan(math.radians(FUNNEL['half_angle_deg']))
    top_r = FUNNEL['top_r']
    z_top = ls + (top_r - so) / tan
    # Outer wall up from the tip, a rolled rim, then the inner wall back down to the tip.
    pts = [(si, 0.0), (so, 0.6), (so, ls), (top_r, z_top), (top_r + 0.6, z_top + 0.4),
           (top_r - w, z_top + 0.2), (si, ls + w / tan * 0.5), (si, 0.3)]
    rad = [0, 0.3, 2.0, 0.6, 0.5, 0.5, 1.2, 0]
    glass = lathe(rounded(pts, rad), segs=128)
    set_material_index(glass, lambda x, y, z: z > z_top - 1.0 or z < 1.0)
    make_obj('Funnel_glass', glass, coll, [M['Borosilicate glass'], M['Borosilicate glass thick']], root)
    height = round(z_top + 0.4, 2)
    registry = {
        'footprintMm': {'shape': 'circle', 'radius': round(top_r + 0.6, 2)},
        'grip': {'heightMm': round(ls + 8.0, 1)},
        'graduations': None,
        'benchRest': {'rollDeg': 180.0, 'liftMm': height, 'shiftMm': [0.0, 0.0]},
        'anchors': {},
        'displays': [],
        'states': {},
    }
    return root, registry
