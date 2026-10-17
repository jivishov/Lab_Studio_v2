"""`reagent-shelf`: visual-only bench furniture (decision D9), not a catalogue definition.

The two-tier reagent shelf that stands along the back of the bench in place of the 3D tray (option B of
`proposals/SHELF_INSTEAD_OF_TRAY.md`, approved 2026-10-11): what starts on the runtime's `shelf` stands on it, each
item on its own spot (src/studio3d/adapters/shelfSpots.ts, whose `SHELF` holds these same numbers). As in a teaching
lab, a steel frame of four square posts with end rails carries two phenolic boards, each with a label rail along
its front edge (the viewer puts the items' tags on it) and a back rod that keeps bottles off the wall. The runtime
has no shelf: it is never an equipment instance, never selectable, never listed (handoff G-8).

The lab room (decided 2026-10-16, `proposals/LAB_ROOM_LAYOUT.md` revision 2, finding 9, from the photos) makes it a
section of an island's centre spine: the posts are perforated grey uprights, each end carries a twin socket outlet,
a service bar at the foot carries yellow-handled gas and water valves with short blue hoses, and a gooseneck tap
stands just past the left end, between this section and the next. Everything stays inside the shelf's 180 mm depth,
so nothing reaches into the working area; the tap and the sockets stand outside the tiers' length, so no spot moves.
The lab room places further sections 1300 mm apart along the islands, leaving each tap its gap.

The origin is the centre of its footprint on the bench top; x runs along the shelf, y away from the viewer, z up.
"""
import math

import bmesh

from labeq.geometry import MM, Matrix, Vector, bm_to_mesh, box_mesh, curve_tube_mesh, cylinder_mesh, make_obj, new_root, transform_mesh

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
# The spine's fittings (the lab room, 2026-10-16).
SLOT_W, SLOT_H, SLOT_PITCH = 5.0, 11.0, 25.0  # the uprights' perforations
SOCKET_Z, SOCKET_PROUD = 165.0, 22.0  # the twin socket boxes on each end, their centre height and depth
VALVES_X = (-430.0, -150.0, 150.0, 430.0)  # along the service bar
TAP_X, TAP_TOP = -(LENGTH / 2 + 50.0), 430.0  # the gooseneck tap, just past the left end
SECTION_PITCH = 1300.0  # sections along an island, so each tap has its gap (the lab room places them)


def boxes_mesh(name, boxes):
    """Several plain boxes as one mesh: (size, centre) pairs in mm."""
    bm = bmesh.new()
    for size, at in boxes:
        mat = Matrix.Translation(tuple(c * MM for c in at)) @ Matrix.Diagonal((size[0] * MM, size[1] * MM, size[2] * MM, 1.0))
        bmesh.ops.create_cube(bm, size=1.0, matrix=mat)
    return bm_to_mesh(bm, name)


def build(coll, M):
    root = new_root('Reagent_shelf', coll)
    frame, board, rail = M['Grey powder coat'], M['Phenolic shelf board'], M['Brushed stainless']
    dark, chrome = M['Black powder coat'], M['Cast clamp chrome']
    post_x = LENGTH / 2 - POST / 2
    post_y = DEPTH / 2 - POST / 2 - 6.0

    def box(name, sx, sy, sz, at, mat, bevel=0.8, uv='box'):
        me = box_mesh(name, sx, sy, sz, bevel=bevel, segs=2)
        transform_mesh(me, Matrix.Translation(tuple(c * MM for c in at)))
        make_obj(name, me, coll, mat, root, uv=uv, sharp_deg=50)

    def tube(name, pts, r, mat, res=4):
        me = curve_tube_mesh(name, [Vector(p) for p in pts], r, resolution=res)
        make_obj(name, me, coll, mat, root, uv='box')

    # The frame: a perforated upright at each corner, standing on the bench, with an end rail at each tier and at the top.
    slots = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            box(f'Post_{"LR"[sx > 0]}{"FB"[sy > 0]}', POST, POST, POST_TOP, (sx * post_x, sy * post_y, POST_TOP / 2), frame, bevel=1.5)
            face = sy * (post_y + POST / 2)
            z = SLOT_PITCH
            while z < POST_TOP - SLOT_PITCH / 2:
                slots.append(((SLOT_W, 1.2, SLOT_H), (sx * post_x, face + sy * 0.3, z)))
                z += SLOT_PITCH
        for k, z in enumerate((TIER_TOPS[0] - BOARD - 12.0, TIER_TOPS[1] - BOARD - 12.0, POST_TOP - 12.0)):
            box(f'End_rail_{"LR"[sx > 0]}{k}', POST - 4.0, 2 * post_y - POST, 22.0, (sx * post_x, 0.0, z), frame, bevel=1.0)
        # A foot pad under each end, so the frame stands on the worktop as it would.
        box(f'Foot_{"LR"[sx > 0]}', POST + 10.0, DEPTH - 8.0, 6.0, (sx * (post_x - 5.0), 0.0, 3.0), frame, bevel=1.5)
    make_obj('Upright_slots', boxes_mesh('Upright_slots', slots), coll, dark, root, uv='box', sharp_deg=30)

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

    # A twin socket outlet on each end, fixed across the end's two uprights, under the lower tier.
    pins = []
    for sx in (-1, 1):
        cx = sx * (LENGTH / 2 + SOCKET_PROUD / 2)
        box(f'Socket_box_{"LR"[sx > 0]}', SOCKET_PROUD, 2 * post_y + POST, 64.0, (cx, 0.0, SOCKET_Z), frame, bevel=2.0)
        for sy in (-1, 1):
            fx = sx * (LENGTH / 2 + SOCKET_PROUD + 0.8)
            box(f'Socket_{"LR"[sx > 0]}{"FB"[sy > 0]}', 1.6, 46.0, 46.0, (fx, sy * 36.0, SOCKET_Z), M['Socket plate white'], bevel=0.5)
            for dy in (-9.5, 9.5):
                pins.append(((1.4, 4.6, 4.6), (fx + sx * 0.4, sy * 36.0 + dy, SOCKET_Z + 4.0)))
            pins.append(((1.4, 7.0, 3.2), (fx + sx * 0.4, sy * 36.0, SOCKET_Z - 10.0)))
    make_obj('Socket_pins', boxes_mesh('Socket_pins', pins), coll, dark, root, uv='box', sharp_deg=30)

    # The service bar at the spine's foot, between the end feet, with its valves facing the working side.
    bar_y, bar_d, bar_h = 30.0, 46.0, 64.0
    box('Service_bar', 2 * (post_x - POST / 2) - 30.0, bar_d, bar_h, (0.0, bar_y, bar_h / 2 + 0.5), frame, bevel=2.0)
    front = bar_y - bar_d / 2
    for i, x in enumerate(VALVES_X):
        body = cylinder_mesh(f'Valve_body_{i}', 8.0, 0.0, 30.0, segs=16)
        transform_mesh(body, Matrix.Rotation(math.pi / 2, 4, 'X'))  # along -y from the bar's face
        transform_mesh(body, Matrix.Translation((x * MM, front * MM, 40.0 * MM)))
        make_obj(f'Valve_body_{i}', body, coll, chrome, root, sharp_deg=50)
        nozzle = cylinder_mesh(f'Valve_nozzle_{i}', 4.5, 22.0, 34.0, x=x, y=front - 22.0, segs=12)
        make_obj(f'Valve_nozzle_{i}', nozzle, coll, chrome, root, sharp_deg=50)
        stem = cylinder_mesh(f'Valve_stem_{i}', 3.0, 46.0, 52.0, x=x, y=front - 14.0, segs=10)
        make_obj(f'Valve_stem_{i}', stem, coll, chrome, root, sharp_deg=50)
        box(f'Valve_handle_{i}', 52.0, 10.0, 7.0, (x + 14.0, front - 14.0, 55.0), M['Valve handle yellow'], bevel=2.5)
        # A short blue hose off the nozzle, falling to the worktop and lying along the spine.
        tube(f'Hose_{i}', [(x, front - 22.0, 23.0), (x, front - 26.0, 13.0), (x + 18.0, front - 36.0, 7.5),
                           (x + 70.0, front - 44.0, 6.5), (x + 120.0, front - 40.0, 6.5)], 6.0, M['Blue PVC hose'])

    # The gooseneck tap, in the gap past the left end: a riser at the back, arching over to the front, its spout down.
    flange = cylinder_mesh('Tap_flange', 17.0, 0.0, 7.0, x=TAP_X, y=20.0, segs=24)
    make_obj('Tap_flange', flange, coll, chrome, root, sharp_deg=50)
    arc = [(TAP_X, 20.0 - 35.0 + 35.0 * math.cos(a), TAP_TOP - 35.0 + 35.0 * math.sin(a))
           for a in [i * math.pi / 10 for i in range(11)]]
    tube('Tap_gooseneck', [(TAP_X, 20.0, 6.0)] + arc + [(TAP_X, -50.0, TAP_TOP - 95.0)], 9.0, chrome, res=5)
    box('Tap_lever', 8.0, 46.0, 7.0, (TAP_X, -2.0, 150.0), M['Valve handle yellow'], bevel=2.5)

    registry = {
        'footprintMm': {'shape': 'rect', 'width': LENGTH, 'depth': DEPTH},
        'grip': {'heightMm': TIER_TOPS[0]},
        'graduations': None,
        'anchors': {},
        'displays': [],
        'states': {},
    }
    return root, registry
