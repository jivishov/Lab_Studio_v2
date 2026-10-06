"""`clay-triangle`: pipe-clay triangle, 2 inch, on twisted nichrome wire (Pack 2, decided 2026-10-05).

Three pipe-clay tubes threaded on nichrome wire, the wires twisted together at each corner into a leg.
Its tubes cross the ring stand's 48 mm iron ring and rest on it, and a crucible stands on them
(ring_stand.py's `ring-stand-crucible-seat`). Its origin is the centre, at the tubes' underside.
"""
import math

from equipment._fits import CLAY_TRIANGLE
from labeq.geometry import MM, Matrix, Vector, curve_tube_mesh, lathe, make_obj, new_root, rounded, transform_mesh

DEFINITION_ID = 'clay-triangle'
THUMB_ELEVATION_DEG = 40

INRADIUS = CLAY_TRIANGLE['inradius']    # the tube axes' inscribed circle, which the crucible's wall meets
TUBE_R, TUBE_LEN = CLAY_TRIANGLE['tube_r'], 56.0
WIRE_R = 0.6
LEG_OUT = 60.0         # the twisted legs reach out past the ring


def build(coll, M):
    root = new_root('Clay_triangle', coll)
    # The wires run through the tubes' axes, a tube's radius above the tubes' underside.
    z = TUBE_R
    side = 2 * math.sqrt(3) * INRADIUS
    tube = lathe(rounded([(0, 0), (TUBE_R, 0), (TUBE_R, TUBE_LEN), (0, TUBE_LEN)], [0, 0.8, 0.8, 0]), segs=24)
    corners = []
    for k in range(3):
        a = math.radians(90 + 120 * k)       # each side's outward normal
        mid = Vector((INRADIUS * math.cos(a), INRADIUS * math.sin(a), z))
        along = Vector((-math.sin(a), math.cos(a), 0))
        me = tube.copy()
        me.name = f'Triangle_tube_{k}'
        # Lay the tube along its side, centred on the side's midpoint.
        transform_mesh(me, Matrix.Translation((0, 0, -TUBE_LEN / 2 * MM)))
        transform_mesh(me, Matrix.Rotation(math.pi / 2, 4, 'X'))
        transform_mesh(me, Matrix.Rotation(a, 4, 'Z'))
        transform_mesh(me, Matrix.Translation(mid * MM))
        make_obj(f'Triangle_tube_{k}', me, coll, M['Pipe clay'], root)
        corners.append((mid - along * (side / 2), mid + along * (side / 2)))
    # The wire through each tube runs on to the corners, where pairs twist into a leg reaching outward.
    for k in range(3):
        a0, a1 = corners[k]
        wire = curve_tube_mesh(f'Triangle_wire_{k}', [a0, a1], WIRE_R, resolution=4)
        make_obj(f'Triangle_wire_{k}', wire, coll, M['Nichrome wire'], root, uv='box')
    for k in range(3):
        a = math.radians(90 + 120 * k + 60)
        corner = Vector((2 * INRADIUS * math.cos(a), 2 * INRADIUS * math.sin(a), z))
        tip = Vector((LEG_OUT * math.cos(a), LEG_OUT * math.sin(a), z))
        for strand, twist in ((0, 1.0), (1, -1.0)):
            pts = []
            for i in range(9):
                t = i / 8
                p = corner.lerp(tip, t)
                normal = Vector((-math.sin(a), math.cos(a), 0)) * (twist * 0.7 * math.cos(t * 6 * math.pi))
                pts.append(p + normal + Vector((0, 0, 0.7 * math.sin(t * 6 * math.pi) * twist)))
            leg = curve_tube_mesh(f'Triangle_leg_{k}_{strand}', pts, WIRE_R, resolution=4)
            make_obj(f'Triangle_leg_{k}_{strand}', leg, coll, M['Nichrome wire'], root, uv='box')
    registry = {
        'footprintMm': {'shape': 'circle', 'radius': LEG_OUT},
        'grip': {'heightMm': 3.0},
        'graduations': None,
        'anchors': {},
        'displays': [],
        'states': {},
    }
    return root, registry
