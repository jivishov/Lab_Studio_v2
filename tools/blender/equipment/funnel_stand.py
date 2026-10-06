"""`funnel-stand`: the support stand with the glass funnel resting in its ring (Pack 2, decided 2026-10-05).

The runtime assembles it when the funnel is seated in the ring stand's ring (the registered
instance-swap composite), so it is drawn as exactly those two models: the stand from _stand.py and the
funnel from funnel.py, its stem tip where the ring stand's funnel anchor puts it. Its zones:
- the filter paper's seat, at the apex of a 60 degree paper cone lying against the funnel's glass;
- the receiving vessel's place on the base under the funnel, set so the stem touches the inside of a
  250 mL Erlenmeyer flask's neck (the stem against the wall lets the filtrate run down it, GRAV-04).
"""
import math

from equipment import funnel
from equipment._fits import ERLENMEYER_250 as F, FILTER_PAPER, RING_STAND as S, funnel_paper_apex_above_tip, ring_funnel_tip_z
from equipment._stand import build_stand, ring_centre, stand_registry_base
from labeq.geometry import MM, new_root

DEFINITION_ID = 'funnel-stand'
THUMB_ELEVATION_DEG = 18


def build(coll, M):
    root = new_root('Funnel_stand', coll)
    build_stand(coll, M, root)
    x, y, _ = ring_centre()
    tip_z = ring_funnel_tip_z()
    funnel_root, _ = funnel.build(coll, M)
    funnel_root.parent = root
    funnel_root.location = (x * MM, y * MM, tip_z * MM)
    stem_r = 7.0 / 2
    registry = stand_registry_base()
    registry['anchors'] = {
        'funnel-stand-paper-seat': {'positionMm': [x, y, round(tip_z + funnel_paper_apex_above_tip(), 2)]},
        # The flask's centre is set off by its neck's inner radius less the stem's radius.
        'funnel-receiving-vessel-zone': {'positionMm': [round(x - (F['neck_id'] / 2 - stem_r), 2), y, S['base_h']]},
    }
    # What the funnel holds while it drains: the inside of the seated paper cone, up to the paper's top
    # edge (a 9 cm paper opened into a 60 degree cone). The catalogue's 150 mL is the 2D player's
    # transient capacity, not this cone's (validate_equipment3d.py exempts filter targets).
    apex = tip_z + funnel_paper_apex_above_tip()
    paper_top_r = FILTER_PAPER['radius'] / 2
    registry['fill'] = {'innerProfileMm': [[0.0, round(apex, 2)], [paper_top_r, round(apex + paper_top_r / math.tan(math.radians(30.0)), 2)]],
                        'capacityMl': round(math.pi / 3 * paper_top_r ** 2 * paper_top_r / math.tan(math.radians(30.0)) / 1000.0, 1),
                        'meniscus': 'concave'}
    assert abs(x) < 1e-9 and abs(y) < 1e-9, 'the funnel axis must be the origin axis for its fill profile'
    return root, registry
