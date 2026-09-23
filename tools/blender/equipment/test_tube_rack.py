"""`test-tube-rack`: visual-only bench scenery (decision D9), not a catalogue definition.

A four-place polypropylene rack for 16 mm tubes: an upper plate with 17 mm holes, a lower plate
with shallow wells, and two end frames. The runtime has no supported-tube state in Pack 1, so the
viewer draws this rack under a standing test tube; it is never an equipment instance, never
selectable, never listed, and Examine labels it "Scenery" (handoff G-8).
"""
import bmesh

from labeq.geometry import MM, Matrix, bm_to_mesh, box_mesh, make_obj, new_root, transform_mesh

DEFINITION_ID = 'test-tube-rack'
SCENERY = True
THUMB_ELEVATION_DEG = 25

LEN, WID, H_UPPER, H_LOWER, PLATE = 100.0, 32.0, 62.0, 6.0, 3.0
PITCH = 22.0
HOLE_R = 8.5  # 17 mm holes for 16 mm tubes


def build(coll, M):
    root = new_root('Test_tube_rack_4', coll)
    mat = M['Polypropylene rack white']
    upper = box_mesh('Rack_upper_plate', LEN, WID, PLATE, bevel=0.6, segs=2)
    transform_mesh(upper, Matrix.Translation((0, 0, (H_UPPER + PLATE / 2) * MM)))
    make_obj('Rack_upper_plate', upper, coll, mat, root, uv='box')
    # the holes in the upper plate, drawn as dark discs that a standing tube passes through
    for k in range(4):
        x = (-1.5 + k) * PITCH
        bm = bmesh.new()
        bmesh.ops.create_circle(bm, cap_ends=True, segments=40, radius=HOLE_R * MM)
        bmesh.ops.translate(bm, verts=bm.verts, vec=(x * MM, 0, (H_UPPER + PLATE + 0.05) * MM))
        make_obj(f'Rack_hole_{k}', bm_to_mesh(bm, f'Rack_hole_{k}'), coll, M['Instrument housing dark grey'], root, uv='box')
    lower = box_mesh('Rack_lower_plate', LEN, WID, PLATE, bevel=0.6, segs=2)
    transform_mesh(lower, Matrix.Translation((0, 0, (H_LOWER - PLATE / 2) * MM)))
    make_obj('Rack_lower_plate', lower, coll, mat, root, uv='box')
    for sx in (-1, 1):
        end = box_mesh('Rack_end', PLATE, WID, H_UPPER + PLATE, bevel=0.6, segs=2)
        transform_mesh(end, Matrix.Translation((sx * (LEN / 2 - PLATE / 2) * MM, 0, (H_UPPER + PLATE) / 2 * MM)))
        make_obj('Rack_end', end, coll, mat, root, uv='box')
    seats = [[round((-1.5 + k) * PITCH, 2), 0.0, H_LOWER] for k in range(4)]
    registry = {
        'footprintMm': {'shape': 'rect', 'width': LEN, 'depth': WID},
        'grip': {'heightMm': H_UPPER},
        'graduations': None,
        'sceneryFor': {'definitionId': 'test-tube', 'seatsMm': seats},
        'anchors': {},
        'displays': [],
        'states': {},
    }
    return root, registry
