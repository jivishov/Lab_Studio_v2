"""`filter-paper`: a 9 cm qualitative filter paper in three forms (Pack 2, decided 2026-10-05).

- `flat`: the paper as it comes from the box, lying flat on the bench or the balance pan;
- `folded`: folded in half and in half again, a quarter-circle of four layers, as it lies on the bench
  after the fold step;
- `cone`: opened into a 60 degree cone, three layers on one side and one on the other, as it sits in
  the funnel; its origin is the cone's apex, which the funnel stand's paper seat anchors;
- `dished`: lifted out of the funnel and opened out on the watch glass (FD-11), the wet paper lying in
  the dish's curve; its origin is the centre of its underside, at the watch glass's paper seat.

The viewer shows one form at a time: `cone` while seated in the funnel, `dished` on the watch glass,
otherwise `folded` once the runtime records the fold, else `flat`. A collected solid rests at each form's
own solid rest. Nothing is printed on it.
"""
import math

from equipment._fits import FILTER_PAPER as P
from equipment.watch_glass import A as WG_R, SAG as WG_SAG, T as WG_T
from labeq.geometry import Matrix, lathe, make_obj, new_root, transform_mesh

DEFINITION_ID = 'filter-paper'
THUMB_ELEVATION_DEG = 35

R, T = P['radius'], P['thickness']
CONE_R = R / 2                     # a quarter-folded circle opens to a cone whose rim radius is half the paper's
CONE_H = CONE_R / math.tan(math.radians(30.0))
FOLD_T = 4 * T
# The watch glass's inner surface, a sphere of radius WG_RS - WG_T, measured up from its lowest point (the seat).
WG_RS = (WG_R * WG_R + WG_SAG * WG_SAG) / (2 * WG_SAG)
DISH_GAP = 0.15


def dish_rise(r):
    """How far the watch glass's inner surface rises above its lowest point at radius r."""
    return (WG_RS - WG_T) - math.sqrt((WG_RS - WG_T) ** 2 - r * r)


def build(coll, M):
    root = new_root('Filter_paper_9cm', coll)
    flat = lathe([(0.0, 0.0), (R, 0.0), (R, T), (0.0, T)], segs=96, closed=True)
    make_obj('Paper_flat', flat, coll, M['Filter paper'], root, uv='box')
    # The quarter, centred on its centroid so it rests where it is put.
    c = 4 * R / (3 * math.pi)
    quarter = lathe([(0.0, 0.0), (R, 0.0), (R, FOLD_T), (0.0, FOLD_T)], segs=24, closed=True, angle=math.pi / 2)
    transform_mesh(quarter, Matrix.Translation((-c * 0.001, -c * 0.001, 0)))
    make_obj('Paper_folded', quarter, coll, M['Filter paper'], root, uv='box')
    # The cone, apex at the origin, a thin double-sided wall.
    cone = lathe([(0.0, 0.0), (CONE_R, CONE_H), (CONE_R - T, CONE_H), (0.0, T * 2)], segs=96, closed=True)
    make_obj('Paper_cone', cone, coll, M['Filter paper'], root, uv='box')
    # Opened out in the watch glass, following its curve just clear of the glass.
    n = 24
    under = [(R * i / n, DISH_GAP + dish_rise(R * i / n)) for i in range(n + 1)]
    dished = lathe(under + [(r, z + T) for r, z in reversed(under)], segs=96, closed=True)
    make_obj('Paper_dished', dished, coll, M['Filter paper'], root, uv='box')
    registry = {
        'footprintMm': {'shape': 'circle', 'radius': R},
        'grip': {'heightMm': 2.0},
        'graduations': None,
        'forms': {'flat': ['Paper_flat'], 'folded': ['Paper_folded'], 'cone': ['Paper_cone'], 'dished': ['Paper_dished']},
        'defaultForm': 'flat',
        'formBySeat': {'funnel-stand-paper-seat': 'cone', 'watch-glass-paper-seat': 'dished'},
        # Where a collected solid rests in each form: low in the cone, where the cone is wide enough to hold
        # the drawn heap (its base is 0.8 of the radius); at the centre otherwise.
        'formSolidRest': {
            'cone': {'centreMm': [0.0, 0.0, 11.0], 'radiusMm': 7.0},
            'dished': {'centreMm': [0.0, 0.0, DISH_GAP + T], 'radiusMm': 12.0},
            'flat': {'centreMm': [0.0, 0.0, T], 'radiusMm': 16.0},
            'folded': {'centreMm': [0.0, 0.0, FOLD_T], 'radiusMm': 10.0},
        },
        'solidRest': {'centreMm': [0.0, 0.0, T], 'radiusMm': 16.0},
        # Wet paper darkens and turns translucent (pre-wetted, or holding a wet precipitate).
        'wetLook': True,
        'anchors': {},
        'displays': [],
        'states': {},
    }
    return root, registry
