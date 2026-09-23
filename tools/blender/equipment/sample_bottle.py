"""`sample-bottle`: 125 mL narrow-neck (GL 32) borosilicate laboratory bottle, a pour source.

Shown open, printed with its capacity only (see _bottles.py).
"""
from equipment._bottles import build_lab_bottle, check_capacity

DEFINITION_ID = 'sample-bottle'
THUMB_ELEVATION_DEG = 12
SPEC = dict(name='Sample_bottle_125mL', R=28.0, H=64.0, shoulder=16.0, neck_r=16.0, neck_h=16.0,
            wall=1.8, floor=2.8, capacity_ml=125, print='125 mL', print_size=4.2, shoulder_fillet=9.0,
            pour_tilt=110.0, thread_pitch=3.5)


def build(coll, M):
    root, registry, inner = build_lab_bottle(coll, M, SPEC)
    check_capacity(inner, SPEC['capacity_ml'])
    return root, registry
