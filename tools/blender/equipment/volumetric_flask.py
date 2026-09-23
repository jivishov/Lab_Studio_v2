"""`volumetric-flask`: 100 mL volumetric flask (catalogue capacity 100 mL).

A flat-based spherical bulb (58.6 mm outer diameter) on a 14.5 mm-bore neck with a frosted
ground-joint band. The single calibration ring is placed where this model's own inner profile
holds 100 mL, so the ring and the fill level the viewer draws from the same profile cannot
disagree. The stopper is not part of the flask: `rubber-stopper-set` seats at the
`volumetric-flask-stopper-seat` anchor, computed from the stopper's taper (_fits.py).
Only "100 mL" is printed: no tolerance class is claimed, since the catalogue states none.
"""
import math

from equipment._fits import FLASK_BORE_D, FLASK_NECK_TOP_Z, stopper_seat_depth
from labeq.geometry import FRONT, lathe, level_for_volume_mm, make_obj, new_root, rounded, set_material_index
from labeq.markings import markings

DEFINITION_ID = 'volumetric-flask'
THUMB_ELEVATION_DEG = 10

RI, T, FLOOR, RB_IN = 27.9, 1.4, 2.2, 17.0
BORE_R = FLASK_BORE_D / 2
NECK_R = BORE_R + 1.5
TOP = FLASK_NECK_TOP_Z
JOINT_LEN = 23.0


def _sphere_arc(radius, zc, r_start, z_start_sign, r_end, n=28):
    d0 = math.sqrt(max(radius * radius - r_start * r_start, 0.0))
    a0 = math.atan2(z_start_sign * d0, r_start)
    a1 = math.atan2(math.sqrt(radius * radius - r_end * r_end), r_end)
    return [(radius * math.cos(a0 + (a1 - a0) * i / n), zc + radius * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]


def inner_profile():
    zc = FLOOR + math.sqrt(RI * RI - RB_IN * RB_IN)
    return [[0.0, FLOOR]] + [[round(r, 3), round(z, 3)] for r, z in _sphere_arc(RI, zc, RB_IN, -1, BORE_R)] + [[BORE_R, TOP]], zc


def build(coll, M):
    root = new_root('Volumetric_flask_100mL', coll)
    inner, zc = inner_profile()
    ro = RI + T
    rb_out = RB_IN + T  # the flat base is one wall wider than the inner floor
    arc = _sphere_arc(ro, zc, rb_out, -1, NECK_R)
    outer = [(0, 0), (rb_out, 0)] + arc + [(NECK_R, TOP - 1.2), (NECK_R - 0.3, TOP)]
    back = [(BORE_R + 0.15, TOP), (BORE_R, TOP - 1.0)] + [tuple(p) for p in reversed(inner[1:-1])] + [(0, FLOOR)]
    pts = outer + back
    rad = [0.0] * len(pts)
    rad[1] = 1.2                      # base edge
    rad[1 + len(arc)] = 4.0           # bulb into neck, outside
    rad[len(outer) - 2] = 0.6         # fire-polished lip
    rad[len(outer) - 1] = 0.4
    rad[len(outer)] = 0.4
    rad[len(outer) + 1] = 0.6
    rad[len(outer) + 2] = 3.5         # neck into bulb, inside
    rad[len(pts) - 2] = 1.5           # inner floor edge
    glass = lathe(rounded(pts, rad), segs=160)
    set_material_index(glass, lambda x, y, z: z > TOP - 1.5 or z < FLOOR + 0.3, 1)
    set_material_index(glass, lambda x, y, z: TOP - JOINT_LEN < z < TOP - 1.5 and math.hypot(x, y) > NECK_R - 0.2, 2)
    make_obj('Volumetric_flask_glass', glass, coll,
             [M['Borosilicate glass'], M['Borosilicate glass thick'], M['Frosted marking spot']], root)

    ring_z = level_for_volume_mm(inner, 100.0)
    circ = math.pi * NECK_R
    markings('Volumetric_flask_ring', [('rect', -circ, circ, ring_z - 0.35, ring_z + 0.35, 96)],
             lambda z: NECK_R, FRONT, 0.06, coll, M['White enamel print'], root)
    markings('Volumetric_flask_print', [('text', '100 mL', 5.2, 0.0, zc + 4.0, 'CENTER')],
             lambda z: math.sqrt(max(ro * ro - (z - zc) ** 2, 1.0)), FRONT, 0.1, coll, M['White enamel print'], root)

    registry = {
        'footprintMm': {'shape': 'circle', 'radius': round(ro, 2)},
        'grip': {'heightMm': round(TOP - 45.0, 1)},
        'pour': {'lipMm': [-(NECK_R - 0.3), 0.0, TOP], 'tiltDeg': 110.0, 'style': 'pour'},
        'fill': {'innerProfileMm': inner, 'capacityMl': 100, 'meniscus': 'concave'},
        'graduations': None,
        'calibration': {'ml': 100, 'heightMm': round(ring_z, 2)},
        'anchors': {'volumetric-flask-stopper-seat': {'positionMm': [0.0, 0.0, round(TOP - stopper_seat_depth(), 3)]}},
        'displays': [],
        'states': {},
    }
    return root, registry
