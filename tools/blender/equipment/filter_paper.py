"""`filter-paper`: a 9 cm qualitative filter paper in three forms (Pack 2, decided 2026-10-05).

- `flat`: the paper as it comes from the box, lying flat (and opened out flat on the watch glass after
  filtering, as it is lifted out of the funnel and opened, FD-11);
- `folded`: folded in half and in half again, a quarter-circle of four layers, as it lies on the bench
  after the fold step;
- `cone`: opened into a 60 degree cone, three layers on one side and one on the other, as it sits in
  the funnel; its origin is the cone's apex, which the funnel stand's paper seat anchors.

The viewer shows one form at a time: `cone` while seated in the funnel, `flat` on the watch glass,
otherwise `folded` once the runtime records the fold, else `flat`. A collected solid rests at each form's
own solid rest. Nothing is printed on it.
"""
import math

from equipment._fits import FILTER_PAPER as P
from labeq.geometry import Matrix, lathe, make_obj, new_root, transform_mesh

DEFINITION_ID = 'filter-paper'
THUMB_ELEVATION_DEG = 35

R, T = P['radius'], P['thickness']
CONE_R = R / 2                     # a quarter-folded circle opens to a cone whose rim radius is half the paper's
CONE_H = CONE_R / math.tan(math.radians(30.0))
FOLD_T = 4 * T


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
    registry = {
        'footprintMm': {'shape': 'circle', 'radius': R},
        'grip': {'heightMm': 2.0},
        'graduations': None,
        'forms': {'flat': ['Paper_flat'], 'folded': ['Paper_folded'], 'cone': ['Paper_cone']},
        'defaultForm': 'flat',
        'formBySeat': {'funnel-stand-paper-seat': 'cone', 'watch-glass-paper-seat': 'flat'},
        # Where a collected solid rests in each form: low in the cone; at the centre when flat.
        'formSolidRest': {
            'cone': {'centreMm': [0.0, 0.0, 6.0], 'radiusMm': 7.0},
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
