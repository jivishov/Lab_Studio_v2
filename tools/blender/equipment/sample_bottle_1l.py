"""`sample-bottle-1l`: 1000 mL narrow-neck (GL 45) borosilicate laboratory bottle, the stock
variant of `sample-bottle` (src/equipment/stockBottleVariants.json). Shown open, printed with its
capacity only (see _bottles.py).
"""
from equipment._bottles import build_lab_bottle, check_capacity

DEFINITION_ID = 'sample-bottle-1l'
THUMB_ELEVATION_DEG = 12
SPEC = dict(name='Sample_bottle_1000mL', R=50.5, H=152.0, shoulder=34.0, neck_r=22.5, neck_h=18.0,
            wall=2.6, floor=3.5, capacity_ml=1000, print='1000 mL', print_size=7.0, shoulder_fillet=18.0,
            pour_tilt=105.0, segs=148)


def build(coll, M):
    root, registry, inner = build_lab_bottle(coll, M, SPEC)
    check_capacity(inner, SPEC['capacity_ml'])
    return root, registry
