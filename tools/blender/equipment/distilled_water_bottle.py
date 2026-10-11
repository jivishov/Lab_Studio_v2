"""`distilled-water-bottle`: 500 mL narrow-neck borosilicate bottle of distilled water (Pack 3a, decided 2026-10-10).

The water trial's mobile phase. The lab bottle of `_bottles.py` at 500 mL with a GL 45 neck, shown open (the
runtime has no closure state). Unlike the general-purpose bottles, this definition always holds the same reagent,
so its name is written on the frosted writing spot, as a teacher labels a stock bottle.
"""
from equipment._bottles import build_lab_bottle, check_capacity
from labeq.geometry import FRONT
from labeq.markings import markings

DEFINITION_ID = 'distilled-water-bottle'
THUMB_ELEVATION_DEG = 12
SPEC = dict(name='Distilled_water_bottle_500mL', R=43.0, H=112.0, shoulder=26.0, neck_r=24.0, neck_h=22.0,
            wall=2.2, floor=3.2, capacity_ml=500, print='500 mL', shoulder_fillet=10.0, pour_tilt=108.0)


def build(coll, M):
    root, registry, inner = build_lab_bottle(coll, M, SPEC)
    check_capacity(inner, SPEC['capacity_ml'])
    H = SPEC['H']
    markings('Distilled_water_bottle_writing', [('text', 'Distilled', 4.4, 0.0, H * 0.445, 'CENTER'),
                                                 ('text', 'water', 4.4, 0.0, H * 0.38, 'CENTER')],
             lambda z: SPEC['R'], FRONT, 0.12, coll, M['Blue print ink'], root)
    return root, registry
