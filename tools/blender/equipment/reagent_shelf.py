"""`reagent-shelf`: visual-only bench furniture (decision D9), not a catalogue definition.

The two-tier reagent shelf that stands along the back of the bench in place of the 3D tray (option B of
`proposals/SHELF_INSTEAD_OF_TRAY.md`, approved 2026-10-11): what starts on the runtime's `shelf` stands on it, each
item on its own spot (src/studio3d/adapters/shelfSpots.ts, whose `SHELF` holds these same numbers). As in a teaching
lab, a steel frame of four square posts with end rails carries two phenolic boards, each with a label rail along
its front edge (the viewer puts the items' tags on it) and a back rod that keeps bottles off the wall. The runtime
has no shelf: it is never an equipment instance, never selectable, never listed (handoff G-8).

The origin is the centre of its footprint on the bench top; x runs along the shelf, y away from the viewer, z up.
"""
from labeq.geometry import MM, Matrix, box_mesh, cylinder_mesh, make_obj, new_root, transform_mesh

DEFINITION_ID = 'reagent-shelf'
SCENERY = True
THUMB_ELEVATION_DEG = 25

LENGTH, DEPTH = 1200.0, 180.0
BOARD = 18.0
TIER_TOPS = (300.0, 520.0)
POST = 24.0
POST_TOP = TIER_TOPS[1] + 40.0
RAIL_H, RAIL_T = 20.0, 2.0  # label rail: height and how far it stands proud of the board's edge
ROD_R, ROD_ABOVE = 5.0, 55.0  # back rod: radius and its height above the board


def build(coll, M):
    root = new_root('Reagent_shelf', coll)
    frame, board, rail = M['Black powder coat'], M['Phenolic shelf board'], M['Brushed stainless']
    post_x = LENGTH / 2 - POST / 2
    post_y = DEPTH / 2 - POST / 2 - 6.0

    def box(name, sx, sy, sz, at, mat, bevel=0.8, uv='box'):
        me = box_mesh(name, sx, sy, sz, bevel=bevel, segs=2)
        transform_mesh(me, Matrix.Translation(tuple(c * MM for c in at)))
        make_obj(name, me, coll, mat, root, uv=uv, sharp_deg=50)

    # The frame: a post at each corner, standing on the bench, with an end rail at each tier and at the top.
    for sx in (-1, 1):
        for sy in (-1, 1):
            box(f'Post_{"LR"[sx > 0]}{"FB"[sy > 0]}', POST, POST, POST_TOP, (sx * post_x, sy * post_y, POST_TOP / 2), frame, bevel=1.5)
        for k, z in enumerate((TIER_TOPS[0] - BOARD - 12.0, TIER_TOPS[1] - BOARD - 12.0, POST_TOP - 12.0)):
            box(f'End_rail_{"LR"[sx > 0]}{k}', POST - 4.0, 2 * post_y - POST, 22.0, (sx * post_x, 0.0, z), frame, bevel=1.0)
        # A foot pad under each end, so the frame stands on the worktop as it would.
        box(f'Foot_{"LR"[sx > 0]}', POST + 10.0, DEPTH - 8.0, 6.0, (sx * (post_x - 5.0), 0.0, 3.0), frame, bevel=1.5)

    for k, top in enumerate(TIER_TOPS):
        # The board, its top at the tier's height, between the posts' faces.
        box(f'Board_{k}', LENGTH - 2.0, DEPTH, BOARD, (0.0, 0.0, top - BOARD / 2), board, bevel=2.0)
        # The label rail along the front edge, where the tags sit.
        box(f'Label_rail_{k}', LENGTH - 2 * POST - 8.0, RAIL_T, RAIL_H, (0.0, -DEPTH / 2 - RAIL_T / 2, top - BOARD / 2), rail, bevel=0.6)
        # The back rod, between the back posts.
        rod = cylinder_mesh(f'Back_rod_{k}', ROD_R, -(post_x - POST / 2), post_x - POST / 2, segs=16)
        transform_mesh(rod, Matrix.Rotation(1.5707963267948966, 4, 'Y'))
        transform_mesh(rod, Matrix.Translation((0.0, (post_y + POST / 2 - ROD_R) * MM, (top + ROD_ABOVE) * MM)))
        make_obj(f'Back_rod_{k}', rod, coll, frame, root, sharp_deg=50)

    registry = {
        'footprintMm': {'shape': 'rect', 'width': LENGTH, 'depth': DEPTH},
        'grip': {'heightMm': TIER_TOPS[0]},
        'graduations': None,
        'anchors': {},
        'displays': [],
        'states': {},
    }
    return root, registry
