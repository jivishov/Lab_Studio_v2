"""`ring-stand`: support stand with a 48 mm iron ring (Pack 2, decided 2026-10-05).

The ring takes the glass funnel for gravity filtration (Filter a Precipitate) and a clay triangle,
with a crucible on it, over a Bunsen burner (Heat and Reweigh); a magnetic stirrer or a calorimeter
cup stand on or in the same ring elsewhere in the catalogue. Every anchor follows from the stand's
dimensions in _fits.py: the funnel's stem tip where its cone rests in the ring; the clay triangle on
the ring; the crucible standing in the triangle with its base just above a Bunsen flame's inner cone.
"""
from equipment._fits import FUNNEL, RING_STAND as S, crucible_foot_below_triangle, ring_funnel_tip_z
from equipment._stand import build_stand, ring_centre, stand_registry_base
from labeq.geometry import new_root

DEFINITION_ID = 'ring-stand'
THUMB_ELEVATION_DEG = 18

# The clay triangle's pipe-clay tubes cross the ring and rest on its top; the crucible stands in the
# triangle, its foot below the tubes where its tapered wall meets them (_fits.crucible_foot_below_triangle).
TRIANGLE_Z = S['ring_z'] + S['ring_wire'] / 2
CRUCIBLE_BASE_BELOW_TRIANGLE = crucible_foot_below_triangle()


def build(coll, M):
    root = new_root('Ring_stand', coll)
    build_stand(coll, M, root)
    x, y, _ = ring_centre()
    registry = stand_registry_base()
    registry['anchors'] = {
        'ring-stand-funnel-seat': {'positionMm': [x, y, round(ring_funnel_tip_z(), 2)]},
        'ring-stand-clay-triangle-seat': {'positionMm': [x, y, TRIANGLE_Z]},
        'ring-stand-crucible-seat': {'positionMm': [x, y, round(TRIANGLE_Z - CRUCIBLE_BASE_BELOW_TRIANGLE, 2)]},
        'ring-stand-calorimeter-support': {'positionMm': [x, y, TRIANGLE_Z]},
        'ring-stand-stirrer-bay': {'positionMm': [x, y, S['base_h']]},
        # A Bunsen burner stands on the base under the ring (HEAT-05), its inner cone's tip just below the crucible.
        'ring-stand-burner-bay': {'positionMm': [x, y, S['base_h']]},
    }
    assert FUNNEL['top_r'] > S['ring_id'] / 2, 'the funnel must rest in the ring, not drop through it'
    return root, registry
