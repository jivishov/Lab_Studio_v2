"""`pipette-pump`: 10 mL thumbwheel pipette pump (catalogue: pipette pump).

A moulded body with a soft cone at its open end and a thumbwheel on the side; turning the wheel
draws liquid up and lets it down to a line, and a pipette is never filled by mouth. Its origin is
the open end, which sits on the pipette's pump seat (decided 2026-10-02). At rest it lies on the
bench (`benchRest`). Not a particular manufacturer's product.
"""
import math

from labeq.geometry import MM, Matrix, lathe, make_obj, new_root, rounded, transform_mesh

DEFINITION_ID = 'pipette-pump'
THUMB_ELEVATION_DEG = 15

BODY_R, CONE_L, LENGTH = 12.0, 18.0, 112.0
WHEEL_R, WHEEL_T, WHEEL_Z = 13.5, 5.0, 74.0


def build(coll, M):
    root = new_root('Pipette_pump_10mL', coll)
    body = rounded([(0, 0), (6.0, 0), (9.5, CONE_L), (BODY_R, CONE_L + 4), (BODY_R, LENGTH - 6), (BODY_R - 3, LENGTH), (0, LENGTH)],
                   [0, 1.0, 2.0, 2.0, 3.0, 2.0, 0])
    make_obj('Pump_body', lathe(body, segs=64), coll, M['Pipette pump green'], root)
    tip = rounded([(0, -0.5), (5.2, -0.5), (6.2, 6.0), (0, 6.0)], [0, 0.8, 0.5, 0])
    make_obj('Pump_soft_tip', lathe(tip, segs=48), coll, M['Black rubber'], root)
    # the thumbwheel: a ribbed disc turned on the body's side, its axis along x
    wheel = lathe(rounded([(0, -WHEEL_T / 2), (WHEEL_R, -WHEEL_T / 2), (WHEEL_R, WHEEL_T / 2), (0, WHEEL_T / 2)],
                          [0, 0.8, 0.8, 0]), segs=40)
    transform_mesh(wheel, Matrix.Translation((BODY_R * 0.55 * MM, 0, WHEEL_Z * MM)) @ Matrix.Rotation(math.pi / 2, 4, 'Y'))
    make_obj('Pump_thumbwheel', wheel, coll, M['Black phenolic knob'], root)
    registry = {
        'footprintMm': {'shape': 'rect', 'width': BODY_R * 2 + 4, 'depth': LENGTH},
        'grip': {'heightMm': 70.0},
        'graduations': None,
        'benchRest': {'rollDeg': -90.0, 'liftMm': BODY_R, 'shiftMm': [0.0, -LENGTH / 2]},
        'anchors': {},
        'displays': [],
        'states': {},
    }
    return root, registry
