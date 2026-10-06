"""`bunsen-burner`: a laboratory Bunsen burner and its flames (Pack 2, decided 2026-10-05).

A round cast-iron base, a brass barrel 13 mm across with its top 162 mm above the bench, a brass air
collar near its foot, and a ribbed hose inlet. The flame is drawn from the runtime's apparatus state: off;
`yellow` when just lit with the air collar nearly closed (a tall, luminous flame); `blue` once the collar
is opened (a pale blue cone with a brighter inner cone), smaller while warming gently. The collar's air
ports show open only when it is opened. Standing on the ring stand's base, the inner cone's tip is just
below a crucible in the clay triangle (ring_stand.py), the hottest part of the flame.
"""
import math

from labeq.geometry import MM, Matrix, box_mesh, lathe, make_obj, new_root, rounded, transform_mesh

DEFINITION_ID = 'bunsen-burner'
THUMB_ELEVATION_DEG = 12

BASE_R, BASE_H = 47.5, 14.0
BARREL_R, BARREL_TOP = 6.5, 162.0
COLLAR_R, COLLAR_Z0, COLLAR_H = 8.5, 34.0, 18.0
INLET_Z = BASE_H + 9.0


def _flame(name, height, radius, coll, M, mat, root):
    # A teardrop of revolution standing on the barrel's mouth: widest about a third of the way up.
    n = 16
    pts = [(0, 0)]
    for i in range(1, n + 1):
        t = i / n
        r = radius * math.sin(math.pi * min(1.0, t * 1.1)) ** 0.8 * (1 - t) ** 0.35
        pts.append((max(0.05, r if t < 1 else 0), height * t))
    pts[-1] = (0, height)
    me = lathe(pts, segs=48, name=name)
    # Its origin is the barrel's mouth, so a flicker scales it from there.
    return make_obj(name, me, coll, M[mat], root, sharp_deg=0, loc=(0, 0, BARREL_TOP))


def build(coll, M):
    root = new_root('Bunsen_burner', coll)
    base = lathe(rounded([(0, 0), (BASE_R, 0), (BASE_R, 4.0), (BASE_R - 18.0, BASE_H - 2.0), (12.0, BASE_H), (0, BASE_H)],
                         [0, 1.0, 2.0, 6.0, 3.0, 0]), segs=96)
    make_obj('Burner_base', base, coll, M['Black powder coat'], root)
    # The barrel, with a thicker union where it screws into the base.
    # The barrel's foot: a brass block that takes the gas from the inlet, the barrel screwed into its top.
    union = lathe(rounded([(0, BASE_H - 2), (9.5, BASE_H - 2), (9.5, BASE_H + 16), (0, BASE_H + 16)], [0, 0.6, 0.6, 0]), segs=48)
    make_obj('Burner_union', union, coll, M['Burner brass'], root)
    barrel = lathe(rounded([(0, BASE_H + 16), (BARREL_R, BASE_H + 16), (BARREL_R, BARREL_TOP), (BARREL_R - 1.0, BARREL_TOP),
                            (BARREL_R - 1.0, BARREL_TOP - 8.0), (0, BARREL_TOP - 8.0)], [0, 0.3, 0.6, 0.4, 0, 0]), segs=48)
    make_obj('Burner_barrel', barrel, coll, M['Burner brass'], root)
    collar = lathe(rounded([(0, COLLAR_Z0), (COLLAR_R, COLLAR_Z0), (COLLAR_R, COLLAR_Z0 + COLLAR_H), (0, COLLAR_Z0 + COLLAR_H)],
                           [0, 0.8, 0.8, 0]), segs=48)
    make_obj('Burner_collar', collar, coll, M['Burner brass'], root)
    # The two air ports, drawn as dark openings on the collar's front and back; shown only when it is open.
    for k, side in enumerate((-1, 1)):
        port = box_mesh(f'Burner_collar_port_{k}', 7.0, 0.6, 9.0, bevel=0.25, segs=1)
        transform_mesh(port, Matrix.Translation((0, side * (COLLAR_R + 0.05) * MM, (COLLAR_Z0 + COLLAR_H / 2) * MM)))
        make_obj(f'Burner_collar_port_{k}', port, coll, M['Black rubber'], root, uv='box')
    # The ribbed hose inlet, out to the left from the foot, clear of the base.
    inlet = lathe(rounded([(0, 0), (4.5, 0), (4.5, 6), (5.4, 8), (4.5, 10), (5.4, 12), (4.5, 14), (5.4, 16), (4.5, 18),
                           (4.5, 34), (0, 34)], [0, 0.4, 0, 0, 0, 0, 0, 0, 0, 0.4, 0]), segs=32)
    transform_mesh(inlet, Matrix.Rotation(-math.pi / 2, 4, 'Y'))
    transform_mesh(inlet, Matrix.Translation((-8.0 * MM, 0, INLET_Z * MM)))
    make_obj('Burner_inlet', inlet, coll, M['Burner brass'], root)
    # The flames spread as they meet a crucible's base above the inner cone, so they are drawn wide.
    _flame('Flame_yellow', 110.0, 14.0, coll, M, 'Flame yellow', root)
    _flame('Flame_blue_outer', 78.0, 15.0, coll, M, 'Flame blue', root)
    _flame('Flame_blue_inner', 22.0, 5.2, coll, M, 'Flame inner cone', root)
    _flame('Flame_gentle_outer', 42.0, 10.0, coll, M, 'Flame blue', root)
    _flame('Flame_gentle_inner', 12.0, 3.8, coll, M, 'Flame inner cone', root)
    registry = {
        'footprintMm': {'shape': 'circle', 'radius': BASE_R},
        'grip': {'heightMm': 80.0},
        'graduations': None,
        'stateObjects': [
            {'stateKeys': ['flame', 'heat'], 'default': 'off',
             'objects': {'off': [], 'yellow': ['Flame_yellow'], 'blue': ['Flame_blue_outer', 'Flame_blue_inner'],
                         'blue/gentle': ['Flame_gentle_outer', 'Flame_gentle_inner']}},
            {'stateKeys': ['collar'], 'default': 'nearly-closed',
             'objects': {'nearly-closed': [], 'open': ['Burner_collar_port_0', 'Burner_collar_port_1']}},
        ],
        # Each flame flickers slightly while shown (not under reduced motion).
        'flicker': ['Flame_yellow', 'Flame_blue_outer', 'Flame_gentle_outer'],
        'anchors': {},
        'displays': [],
        'states': {},
    }
    return root, registry
