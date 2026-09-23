"""`wash-bottle`: 500 mL blow-moulded LDPE wash bottle (catalogue capacity 500 mL).

Rebuilt from the prototype's `build_wash_bottle` with the geometry unchanged: 1.3 mm LDPE wall,
dip tube, ribbed PP cap, tube boss and a delivery tube that rises, sweeps over and ends in a
down-turned, tapering tip. Two prototype details are deliberately dropped:

- the baked 350 mL of water: contents are runtime state, drawn by the viewer inside the fill
  profile below (plan §4.4, handoff G-3);
- the "DEIONIZED WATER" print: the same definition holds deionized, distilled or rinse water,
  a teacher-approved rinse, or nothing, depending on the technique, so a contents label would be
  false for some of them (AGENTS.md: no baked labels the real object does not need). The
  runtime's contents text reaches the learner through the hover label instead.

The "500 mL" capacity print stays: it is true of the definition.
"""
import math

from labeq.geometry import FRONT, MM, Matrix, Vector, bm_to_mesh, curve_tube_mesh, lathe, lathe_bmesh, make_obj, new_root, rounded
from labeq.markings import markings

DEFINITION_ID = 'wash-bottle'
THUMB_ELEVATION_DEG = 10

R, H, NECK_R, WALL = 40.0, 140.0, 22.0, 1.3
# 160 rather than the prototype's 192 segments round the body: the profile is unchanged, the
# chord error is about 1.6 mm on the 40 mm radius (hidden by smooth shading), and the packed
# model then meets the plan's 250 KB budget for an ordinary item (§6.3).
BODY_SEGMENTS = 160


def _delivery_tube_points(z0):
    pts = []
    zt = z0 + 26
    for i in range(12):
        pts.append(Vector((0, 0, zt + i * 5.0)))
    top = pts[-1]
    bend_r, turn = 16.0, math.radians(100)
    centre = top + Vector((-bend_r, 0, 0))
    for i in range(1, 25):
        a = turn * i / 24
        pts.append(centre + Vector((bend_r * math.cos(a), 0, bend_r * math.sin(a))))
    d = (pts[-1] - pts[-2]).normalized()
    for i in range(1, 13):
        pts.append(pts[-1] + d * 5.0)
    tip = []
    for i in range(1, 9):
        d = Matrix.Rotation(math.radians(-3.5), 3, 'Y') @ d
        pts.append(pts[-1] + d * 3.2)
        tip.append(len(pts) - 1)
    return pts, tip, d


def build(coll, M):
    w = WALL
    root = new_root('Wash_bottle_500mL', coll)
    body = [(0, 0), (R - 3, 0), (R, 3), (R, H), (NECK_R, H + 16), (NECK_R, H + 24),
            (NECK_R - w, H + 24), (NECK_R - w, H + 16.6), (R - w, H + 0.6), (R - w, 3.4), (R - 3.4, w), (0, w)]
    rad = [0, 2, 3, 14, 5, 0.4, 0.4, 4.5, 12.5, 2.4, 1.6, 0]
    make_obj('Bottle_body', lathe(rounded(body, rad), segs=BODY_SEGMENTS), coll, M['LDPE natural'], root)
    dip = [(1.6, 5.0), (2.4, 5.0), (2.4, H + 27), (1.6, H + 27)]
    make_obj('Bottle_dip_tube', lathe(dip, segs=32, closed=True), coll, M['LDPE delivery tube'], root)
    markings('Bottle_print', [('text', '500 mL', 5.0, 0.0, 71.0, 'CENTER')],
             lambda z: R, FRONT, 0.08, coll, M['Blue print ink'], root)

    z0 = H + 20
    cap_bm = lathe_bmesh(rounded([(0, z0), (26, z0), (26, z0 + 22), (0, z0 + 22)], [0, 0.8, 2.2, 0]), segs=288)
    for v in cap_bm.verts:  # 72 grip ribs round the cap skirt
        z = v.co.z / MM
        r = math.hypot(v.co.x, v.co.y)
        if z0 + 1.5 < z < z0 + 20 and r > 25.5 * MM:
            a = math.atan2(v.co.y, v.co.x)
            k = 1.0 + 0.5 * MM / r * max(-1.0, min(1.0, 2.5 * math.cos(72 * a)))
            v.co.x *= k
            v.co.y *= k
    make_obj('Bottle_cap', bm_to_mesh(cap_bm, 'Bottle_cap'), coll, M['PP cap'], root)
    nub = lathe(rounded([(0, z0 + 21), (6.5, z0 + 21), (6.5, z0 + 29), (0, z0 + 29)], [0, 0, 1.5, 0]), segs=64)
    make_obj('Bottle_tube_boss', nub, coll, M['PP cap'], root)

    pts, tip, tip_dir = _delivery_tube_points(z0)
    taper = {idx: 1.0 - 0.6 * (j + 1) / len(tip) for j, idx in enumerate(tip)}
    make_obj('Bottle_tube', curve_tube_mesh('Bottle_tube', pts, 3.0, taper), coll,
             M['LDPE delivery tube'], root, sharp_deg=70, uv='box')

    lip = pts[-1]
    # Inner cavity, floor to neck mouth, from the body profile's inner wall (fillets ignored,
    # which overstates capacity by well under 1 %).
    inner = [[0.0, w], [R - 3.4, w], [R - w, 3.4], [R - w, H + 0.6], [NECK_R - w, H + 16.6], [NECK_R - w, H + 24.0]]
    registry = {
        'footprintMm': {'shape': 'circle', 'radius': R},
        'grip': {'heightMm': 70.0},
        'pour': {
            'lipMm': [round(lip.x, 2), round(lip.y, 2), round(lip.z, 2)],
            'tiltDeg': 45.0,
            'style': 'squeeze-jet',
            'tipDirection': [round(tip_dir.x, 4), round(tip_dir.y, 4), round(tip_dir.z, 4)],
        },
        'fill': {'innerProfileMm': inner, 'capacityMl': 500, 'meniscus': 'flat'},
        'graduations': None,
        'anchors': {},
        'displays': [],
        'states': {},
    }
    return root, registry
