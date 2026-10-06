"""`lab-sink`: a black epoxy-resin cup sink set at the bench's back edge, with a gooseneck tap (Pack 2,
decided 2026-10-05: the filtrate is poured down a sink at the bench edge, decision 8).

The bench top here is one solid slab, so the basin is modelled standing on it, its rim raised, rather
than let into it: 360 x 280 mm outside, 110 mm high, with a drain grid in its floor. A liquid poured
in runs away (the runtime keeps nothing in it); `fill` is the basin's true inside, so a pour is aimed
at its mouth.
"""
import math

from labeq.geometry import MM, Matrix, Vector, box_mesh, curve_tube_mesh, lathe, make_obj, new_root, rounded, transform_mesh

DEFINITION_ID = 'lab-sink'
THUMB_ELEVATION_DEG = 30

W, D, H, T, FLOOR = 360.0, 280.0, 110.0, 12.0, 20.0


def _box(name, sx, sy, sz, cx, cy, cz, coll, mat, root, bevel=2.0):
    me = box_mesh(name, sx, sy, sz, bevel=bevel, segs=2)
    transform_mesh(me, Matrix.Translation((cx * MM, cy * MM, cz * MM)))
    return make_obj(name, me, coll, mat, root, uv='box')


def build(coll, M):
    root = new_root('Lab_sink', coll)
    epoxy = M['Black epoxy resin']
    _box('Sink_floor', W, D, FLOOR, 0, 0, FLOOR / 2, coll, epoxy, root, 3.0)
    _box('Sink_front', W, T, H - FLOOR, 0, -D / 2 + T / 2, FLOOR + (H - FLOOR) / 2, coll, epoxy, root, 3.0)
    _box('Sink_back', W, T, H - FLOOR, 0, D / 2 - T / 2, FLOOR + (H - FLOOR) / 2, coll, epoxy, root, 3.0)
    _box('Sink_left', T, D - 2 * T, H - FLOOR, -W / 2 + T / 2, 0, FLOOR + (H - FLOOR) / 2, coll, epoxy, root, 3.0)
    _box('Sink_right', T, D - 2 * T, H - FLOOR, W / 2 - T / 2, 0, FLOOR + (H - FLOOR) / 2, coll, epoxy, root, 3.0)
    drain = lathe([(0, 0), (22.0, 0), (22.0, 1.2), (0, 1.2)], segs=48)
    transform_mesh(drain, Matrix.Translation((0, 0, (FLOOR + 0.1) * MM)))
    make_obj('Sink_drain', drain, coll, M['Brushed stainless'], root)
    # The gooseneck tap rises from the back rim and turns over the basin.
    neck = [Vector((0, D / 2 - T / 2, H)), Vector((0, D / 2 - T / 2, H + 180.0)), Vector((0, D / 2 - 40.0, H + 230.0)),
            Vector((0, D / 2 - 95.0, H + 225.0)), Vector((0, D / 2 - 110.0, H + 190.0))]
    tap = curve_tube_mesh('Sink_tap', neck, 7.0, resolution=6)
    make_obj('Sink_tap', tap, coll, M['Cast clamp chrome'], root)
    for x in (-34.0, 34.0):
        handle = lathe(rounded([(0, 0), (9.0, 0), (9.0, 26.0), (0, 26.0)], [0, 1.0, 3.0, 0]), segs=24)
        transform_mesh(handle, Matrix.Translation((x * MM, (D / 2 - T / 2) * MM, H * MM)))
        make_obj(f'Sink_tap_handle_{"l" if x < 0 else "r"}', handle, coll, M['Cast clamp chrome'], root)
    registry = {
        'footprintMm': {'shape': 'rect', 'width': W, 'depth': D},
        'grip': {'heightMm': H},
        'graduations': None,
        'fill': {'innerBoxMm': {'width': W - 2 * T, 'depth': D - 2 * T, 'floorZ': FLOOR, 'topZ': H}, 'capacityMl': 7500, 'meniscus': 'flat'},
        'anchors': {},
        'displays': [],
        'states': {},
    }
    return root, registry
