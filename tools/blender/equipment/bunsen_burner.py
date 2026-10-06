"""`bunsen-burner`: a laboratory Bunsen burner and its flames (Pack 2, decided 2026-10-05).

A round cast-iron base, a brass barrel 13 mm across with its top 162 mm above the bench, a brass air
collar near its foot, and a ribbed hose inlet. The flame is drawn from the runtime's apparatus state: off;
`yellow` when just lit with the air collar nearly closed (a tall, luminous flame); `blue` once the collar
is opened (a pale blue cone with a brighter inner cone), smaller while warming gently. The collar's air
ports show open only when it is opened. The burner is lit only standing in the ring stand's burner bay under
a crucible in the clay triangle (ring_stand.py), so the yellow and blue flames are drawn meeting it: they
spread under its foot and lick up the outside of its wall, never inside it. The inner cone's tip is about
1 cm below the foot, so the crucible sits just above the hottest part of the flame; the gentle flame for
warming stays clear of it.
"""
import math

from equipment._fits import CRUCIBLE, RING_STAND as S, crucible_foot_below_triangle
from labeq.geometry import MM, Matrix, box_mesh, lathe, make_obj, new_root, rounded, transform_mesh

DEFINITION_ID = 'bunsen-burner'
THUMB_ELEVATION_DEG = 12

BASE_R, BASE_H = 47.5, 14.0
BARREL_R, BARREL_TOP = 6.5, 162.0
COLLAR_R, COLLAR_Z0, COLLAR_H = 8.5, 34.0, 18.0
INLET_Z = BASE_H + 9.0
# How far above the barrel's mouth the foot of a crucible in the clay triangle is, the burner in its bay.
CRUCIBLE_ABOVE_MOUTH = S['ring_z'] + S['ring_wire'] / 2 - crucible_foot_below_triangle() - S['base_h'] - BARREL_TOP


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


def _flame_on_crucible(name, sheath, lick, coll, M, mat, root):
    # A flame meeting the crucible's foot: it widens from the mouth to spread under the foot, then licks up
    # the outside of the wall as a thinning sheath `lick` mm high, a small gap off the glaze.
    gap, n, m = 0.8, 10, 10
    top = CRUCIBLE_ABOVE_MOUTH - 0.4
    taper = (CRUCIBLE['r_top'] - CRUCIBLE['r_foot']) / CRUCIBLE['height']
    wall = lambda z: CRUCIBLE['r_foot'] + taper * z + gap
    mouth = BARREL_R - 1.0
    pts = [(0.0, 0.0)]
    pts += [(mouth + (wall(0) + sheath - mouth) * (i / n) ** 0.6, top * i / n) for i in range(n + 1)]
    pts += [(wall(lick * j / m) + sheath * (1 - j / m) ** 0.7, top + lick * j / m) for j in range(1, m + 1)]
    pts += [(wall(lick * j / m), top + lick * j / m) for j in range(m - 1, -1, -1)]
    pts.append((0.0, top))
    me = lathe(pts, segs=48, name=name)
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
    # Just lit, the collar nearly closed, the luminous yellow flame is lazy and large: it spreads wide and
    # licks well up the crucible's side. Opened to blue, the flame is tighter, its inner cone's tip about
    # 1 cm below the foot. Warming gently, a small flame stays clear of the crucible.
    _flame_on_crucible('Flame_yellow', 4.5, 24.0, coll, M, 'Flame yellow', root)
    _flame_on_crucible('Flame_blue_outer', 2.2, 9.0, coll, M, 'Flame blue', root)
    _flame('Flame_blue_inner', CRUCIBLE_ABOVE_MOUTH - 10.0, 5.2, coll, M, 'Flame inner cone', root)
    _flame('Flame_gentle_outer', CRUCIBLE_ABOVE_MOUTH - 8.0, 8.0, coll, M, 'Flame blue', root)
    _flame('Flame_gentle_inner', 10.0, 3.4, coll, M, 'Flame inner cone', root)
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
