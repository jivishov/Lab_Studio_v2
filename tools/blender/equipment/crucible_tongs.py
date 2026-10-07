"""`crucible-tongs`: 230 mm steel crucible tongs, lying closed on the bench (Pack 2, decided 2026-10-05).

Two round steel arms crossed at a rivet. Near their tips the jaws bow apart, about 38 mm across, to close
around a crucible's body (decided 2026-10-06), and their tips meet to pinch a crucible's or a watch
glass's rim. They lie flat along the bench's width, jaws to the right; `tipMm` is the jaws' tip, the end that grips,
so a carried pair is aimed by its jaws (as the spatula is aimed by its spoon).
"""
import math

from labeq.geometry import MM, Matrix, Vector, curve_tube_mesh, lathe, make_obj, new_root, transform_mesh

DEFINITION_ID = 'crucible-tongs'
THUMB_ELEVATION_DEG = 55

L = 230.0
PIVOT_X = 50.0          # the rivet, measured from the middle toward the jaws
JAW_X = L / 2
R = 2.4                 # the arm's half thickness, as a round bar


def _arm(side):
    """One arm: a handle bowed out from the rivet, crossing to the jaw on the other side."""
    s = 1 if side > 0 else -1
    pts = [(-L / 2, s * 14.0), (-L / 2 + 30, s * 12.0), (-20, s * 8.0), (PIVOT_X, 0.0), (PIVOT_X + 12, -s * 6.0),
           (JAW_X - 40, -s * 16.0), (JAW_X - 24, -s * 19.0), (JAW_X - 10, -s * 12.0), (JAW_X - 3, -s * 3.0), (JAW_X, -s * 1.2)]
    return [Vector((x, y, R)) for x, y in pts]


def build(coll, M):
    root = new_root('Crucible_tongs_230mm', coll)
    for side in (1, -1):
        arm = curve_tube_mesh(f'Tongs_arm_{side}', _arm(side), R, resolution=4)
        make_obj(f'Tongs_arm_{"a" if side > 0 else "b"}', arm, coll, M['Brushed stainless'], root, uv='box')
    rivet = lathe([(0, 0), (4.0, 0), (4.0, 2 * R + 1.6), (0, 2 * R + 1.6)], segs=24)
    transform_mesh(rivet, Matrix.Translation((PIVOT_X * MM, 0, -0.8 * MM)))
    make_obj('Tongs_rivet', rivet, coll, M['Cast clamp chrome'], root)
    registry = {
        'footprintMm': {'shape': 'rect', 'width': L, 'depth': 2 * (19.0 + R)},
        'grip': {'heightMm': 2 * R},
        'graduations': None,
        'tipMm': [JAW_X, 0.0, R],
        'anchors': {},
        'displays': [],
        'states': {},
    }
    return root, registry
