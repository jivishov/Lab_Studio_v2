"""The support stand with its iron ring, shared by `ring-stand` and the `funnel-stand` assembly.

A cast-iron base finished in black powder coat, a 12.7 mm plated steel rod at the back, and a 48 mm
iron ring on a short arm, clamped to the rod by a boss with a thumbscrew, over the middle of the base
(dimensions in _fits.RING_STAND). Its origin is the centre of the base's footprint on the bench.
"""
import math

from equipment._fits import RING_STAND as S
from labeq.geometry import MM, Matrix, Vector, box_mesh, curve_tube_mesh, lathe, make_obj, rounded, transform_mesh


def ring_centre():
    """The ring's centre (mm, model-local): over the front of the base, at the ring's height."""
    return (0.0, S['ring_y'], S['ring_z'])


def build_stand(coll, M, root):
    base = box_mesh('Stand_base', S['base_w'], S['base_d'], S['base_h'], bevel=2.0, segs=2, chamfer=4.0)
    transform_mesh(base, Matrix.Translation((0, 0, S['base_h'] / 2 * MM)))
    make_obj('Stand_base', base, coll, M['Black powder coat'], root, uv='box')
    r = S['rod_d'] / 2
    rod = lathe(rounded([(0, 0), (r, 0), (r, S['rod_h']), (0, S['rod_h'])], [0, 0.4, 1.2, 0]), segs=40)
    transform_mesh(rod, Matrix.Translation((0, S['rod_y'] * MM, S['base_h'] * MM)))
    make_obj('Stand_rod', rod, coll, M['Cast clamp chrome'], root)
    # The ring's boss on the rod, its thumbscrew at the back, and the arm out to the ring.
    boss_z = S['ring_z']
    boss = box_mesh('Stand_ring_boss', 24.0, 22.0, 26.0, bevel=2.5, segs=2)
    transform_mesh(boss, Matrix.Translation((0, S['rod_y'] * MM, boss_z * MM)))
    make_obj('Stand_ring_boss', boss, coll, M['Black powder coat'], root, uv='box')
    screw = lathe(rounded([(0, 0), (3.0, 0), (3.0, 14.0), (7.0, 14.0), (7.0, 20.0), (0, 20.0)], [0, 0.3, 0.3, 1.0, 1.5, 0]), segs=24)
    transform_mesh(screw, Matrix.Rotation(-math.pi / 2, 4, 'X'))
    transform_mesh(screw, Matrix.Translation((0, (S['rod_y'] + 11.0) * MM, boss_z * MM)))
    make_obj('Stand_thumbscrew', screw, coll, M['Cast clamp chrome'], root)
    ring_r = S['ring_id'] / 2 + S['ring_wire'] / 2
    arm = curve_tube_mesh('Stand_ring_arm', [Vector((0, S['rod_y'] - 11.0, boss_z)), Vector((0, S['ring_y'] + ring_r, boss_z))],
                          S['ring_wire'] / 2, resolution=4)
    make_obj('Stand_ring_arm', arm, coll, M['Black powder coat'], root, uv='box')
    w = S['ring_wire'] / 2
    torus = lathe([(ring_r + w * math.cos(a), w * math.sin(a)) for a in [i * math.tau / 16 for i in range(17)]], segs=72)
    transform_mesh(torus, Matrix.Translation((0, S['ring_y'] * MM, S['ring_z'] * MM)))
    make_obj('Stand_ring', torus, coll, M['Black powder coat'], root, uv='box')


def stand_registry_base():
    """Footprint and grip shared by the stand and the assembly built on it."""
    return {
        'footprintMm': {'shape': 'rect', 'width': S['base_w'], 'depth': S['base_d']},
        # Lifted by the rod, about halfway up.
        'grip': {'heightMm': 260.0},
        'graduations': None,
        'displays': [],
        'states': {},
    }
