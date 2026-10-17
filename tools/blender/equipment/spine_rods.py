"""`spine-rods`: visual-only lab-room scenery (decisions D9 and the lab room, 2026-10-16), not a catalogue definition.

The lattice of support rods that teaching-lab islands carry over their spines (`proposals/LAB_ROOM_LAYOUT.md`
revision 2, finding 9, photos 1, 2 and 5): two plated uprights standing on a `reagent-shelf` section's upper board, two
cross rods clamped to them with bosses, and two iron rings clamped on. The lab room puts it only on the spine over
the neighbouring station and the far island, never over our own bays, so it is not mistaken for the runtime's ring
stand. Everything stays inside the shelf's 180 mm depth.

The origin is that of the `reagent-shelf` section it stands on: the centre of the shelf's footprint on the bench top;
x along the shelf, y away from the viewer, z up.
"""
import math

from labeq.geometry import MM, Matrix, Vector, box_mesh, curve_tube_mesh, cylinder_mesh, lathe, make_obj, new_root, transform_mesh

DEFINITION_ID = 'spine-rods'
SCENERY = True
THUMB_ELEVATION_DEG = 20

UPPER_TOP = 520.0  # the shelf's upper board (reagent_shelf.TIER_TOPS[1])
ROD_R = 6.35  # 12.7 mm plated steel rod
ROD_X, ROD_Y = 420.0, 45.0
ROD_TOP = 1180.0
CROSS_Z = (900.0, 1150.0)
CROSS_X = 520.0
RINGS = ((-1, 800.0, 48.0), (1, 980.0, 38.0))  # (upright, height, inner radius)


def build(coll, M):
    root = new_root('Spine_rods', coll)
    chrome, iron = M['Cast clamp chrome'], M['Black powder coat']
    for sx in (-1, 1):
        x = sx * ROD_X
        foot = cylinder_mesh(f'Rod_foot_{"LR"[sx > 0]}', 16.0, UPPER_TOP, UPPER_TOP + 6.0, x=x, y=ROD_Y, segs=24)
        make_obj(f'Rod_foot_{"LR"[sx > 0]}', foot, coll, chrome, root, sharp_deg=50)
        rod = cylinder_mesh(f'Rod_{"LR"[sx > 0]}', ROD_R, UPPER_TOP + 6.0, ROD_TOP, x=x, y=ROD_Y, segs=20)
        make_obj(f'Rod_{"LR"[sx > 0]}', rod, coll, chrome, root, sharp_deg=50)
    for k, z in enumerate(CROSS_Z):
        cross = cylinder_mesh(f'Cross_rod_{k}', ROD_R, -CROSS_X, CROSS_X, segs=20)
        transform_mesh(cross, Matrix.Rotation(math.pi / 2, 4, 'Y'))
        transform_mesh(cross, Matrix.Translation((0.0, (ROD_Y - 2 * ROD_R) * MM, z * MM)))
        make_obj(f'Cross_rod_{k}', cross, coll, chrome, root, sharp_deg=50)
        for sx in (-1, 1):
            boss = box_mesh(f'Boss_{k}{"LR"[sx > 0]}', 24.0, 30.0, 26.0, bevel=2.5, segs=2)
            transform_mesh(boss, Matrix.Translation((sx * ROD_X * MM, (ROD_Y - ROD_R) * MM, z * MM)))
            make_obj(f'Boss_{k}{"LR"[sx > 0]}', boss, coll, iron, root, uv='box')

    # The iron rings, each on a short arm from a boss on an upright, held towards the front.
    for i, (sx, z, inner) in enumerate(RINGS):
        x = sx * ROD_X
        wire = 3.5
        ring_r = inner + wire
        cy = -(90.0 - ring_r - wire - 2.0)  # the ring's front edge just inside the shelf's front
        boss = box_mesh(f'Ring_boss_{i}', 24.0, 22.0, 26.0, bevel=2.5, segs=2)
        transform_mesh(boss, Matrix.Translation((x * MM, ROD_Y * MM, z * MM)))
        make_obj(f'Ring_boss_{i}', boss, coll, iron, root, uv='box')
        arm = curve_tube_mesh(f'Ring_arm_{i}', [Vector((x, ROD_Y - 11.0, z)), Vector((x, cy + ring_r, z))], wire, resolution=4)
        make_obj(f'Ring_arm_{i}', arm, coll, iron, root, uv='box')
        torus = lathe([(ring_r + wire * math.cos(a), wire * math.sin(a)) for a in [j * math.tau / 12 for j in range(13)]], segs=48)
        transform_mesh(torus, Matrix.Translation((x * MM, cy * MM, z * MM)))
        make_obj(f'Ring_{i}', torus, coll, iron, root, uv='box')

    registry = {
        'footprintMm': {'shape': 'rect', 'width': 2 * CROSS_X, 'depth': 180.0},
        'grip': {'heightMm': ROD_TOP},
        'graduations': None,
        'anchors': {},
        'displays': [],
        'states': {},
    }
    return root, registry
