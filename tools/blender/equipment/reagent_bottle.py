"""`reagent-bottle`: 250 mL wide-neck borosilicate laboratory bottle (catalogue capacity 250 mL).

A wide neck, because in Pack 1 it holds solid sodium carbonate that dissolve pours out; the
catalogue also allows liquids and solutions, so it keeps a fill profile. Shown open, printed
with its capacity only (see _bottles.py).
"""
from equipment._bottles import build_lab_bottle, check_capacity

DEFINITION_ID = 'reagent-bottle'
THUMB_ELEVATION_DEG = 12
SPEC = dict(name='Reagent_bottle_250mL', R=35.0, H=80.0, shoulder=14.0, neck_r=28.5, neck_h=16.0,
            wall=2.0, floor=3.0, capacity_ml=250, print='250 mL', shoulder_fillet=8.0, pour_tilt=110.0)


def build(coll, M):
    root, registry, inner = build_lab_bottle(coll, M, SPEC)
    check_capacity(inner, SPEC['capacity_ml'])
    return root, registry
