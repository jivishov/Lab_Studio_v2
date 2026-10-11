"""`propanol-bottle`: 250 mL narrow-neck borosilicate bottle of 2-propanol (Pack 3a, decided 2026-10-10).

The second trial's mobile phase. The lab bottle of `_bottles.py` at 250 mL with a GL 45 neck, shown open (the
runtime has no closure state). This definition always holds 2-propanol, so its name is written on the frosted
writing spot, as a teacher labels a stock bottle.
"""
from equipment._bottles import build_lab_bottle, check_capacity
from labeq.geometry import FRONT
from labeq.markings import markings

DEFINITION_ID = 'propanol-bottle'
THUMB_ELEVATION_DEG = 12
SPEC = dict(name='Propanol_bottle_250mL', R=35.0, H=86.0, shoulder=18.0, neck_r=22.0, neck_h=20.0,
            wall=2.0, floor=3.0, capacity_ml=250, print='250 mL', shoulder_fillet=8.0, pour_tilt=110.0)


def build(coll, M):
    root, registry, inner = build_lab_bottle(coll, M, SPEC)
    check_capacity(inner, SPEC['capacity_ml'])
    markings('Propanol_bottle_writing', [('text', '2-Propanol', 3.3, 0.0, SPEC['H'] * 0.41, 'CENTER')],
             lambda z: SPEC['R'], FRONT, 0.12, coll, M['Blue print ink'], root)
    return root, registry
