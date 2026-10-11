"""`test-tube-rack`: visual-only bench scenery (decision D9), not a catalogue definition.

A four-place polypropylene rack for 16 mm tubes: an upper plate with 17 mm holes, a lower plate
with shallow wells, and two end frames. The holes and wells are cut for real (2026-10-10). The runtime has no supported-tube state in Pack 1, so the
viewer draws this rack under a standing test tube; it is never an equipment instance, never
selectable, never listed, and Examine labels it "Scenery" (handoff G-8).
"""
from labeq.geometry import MM, Matrix, box_mesh, cut, cylinder_mesh, make_obj, new_root, transform_mesh

DEFINITION_ID = 'test-tube-rack'
SCENERY = True
THUMB_ELEVATION_DEG = 25

LEN, WID, H_UPPER, H_LOWER, PLATE = 100.0, 32.0, 62.0, 6.0, 3.0
PITCH = 22.0
HOLE_R = 8.5  # 17 mm holes for 16 mm tubes
WELL = 2.0    # the lower plate's wells: their floors stay at H_LOWER, the seats


def build(coll, M):
    root = new_root('Test_tube_rack_4', coll)
    mat = M['Polypropylene rack white']
    xs = [(-1.5 + k) * PITCH for k in range(4)]
    # the upper plate, with four real 17 mm holes a standing tube passes through
    upper = box_mesh('Rack_upper_plate', LEN, WID, PLATE, bevel=0.6, segs=2)
    transform_mesh(upper, Matrix.Translation((0, 0, (H_UPPER + PLATE / 2) * MM)))
    upper = cut(upper, [cylinder_mesh('hole', HOLE_R, H_UPPER - 1, H_UPPER + PLATE + 1, x) for x in xs], 'Rack_upper_plate')
    make_obj('Rack_upper_plate', upper, coll, mat, root, uv='box', sharp_deg=50)
    # the lower plate, with a shallow well under each hole whose floor is the tube's seat
    lower = box_mesh('Rack_lower_plate', LEN, WID, PLATE + WELL, bevel=0.6, segs=2)
    transform_mesh(lower, Matrix.Translation((0, 0, (H_LOWER + WELL - (PLATE + WELL) / 2) * MM)))
    lower = cut(lower, [cylinder_mesh('well', HOLE_R, H_LOWER, H_LOWER + WELL + 1, x) for x in xs], 'Rack_lower_plate')
    make_obj('Rack_lower_plate', lower, coll, mat, root, uv='box', sharp_deg=50)
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
