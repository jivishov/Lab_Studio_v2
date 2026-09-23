"""`cuvette`: 12.5 mm square polystyrene macro cuvette, 10 mm light path (catalogue 4 mL).

Two clear optical faces (+/-Y as modelled) and two frosted faces (+/-X), as on real cuvettes; the
optical-face rule itself is recorded by a notebook step (plan §2.6). Seated in the
spectrophotometer it is turned 90 degrees so the clear faces meet the beam (the slot anchor's yaw).
"""
from equipment._fits import CUVETTE
from labeq.geometry import MM, Matrix, box_mesh, make_obj, new_root, transform_mesh

DEFINITION_ID = 'cuvette'
THUMB_ELEVATION_DEG = 20


def build(coll, M):
    root = new_root('Cuvette_10mm', coll)
    o, h, i, fl = CUVETTE['outer'], CUVETTE['height'], CUVETTE['inner'], CUVETTE['floor']
    w = (o - i) / 2

    def slab(name, sx, sy, sz, x, y, z, mat):
        me = box_mesh(name, sx, sy, sz, bevel=0.2, segs=1)
        transform_mesh(me, Matrix.Translation((x * MM, y * MM, z * MM)))
        make_obj(name, me, coll, mat, root, uv='box', sharp_deg=30)

    clear, frosted = M['Polystyrene clear'], M['Polystyrene frosted']
    slab('Cuvette_floor', o, o, fl, 0, 0, fl / 2, clear)
    for sy in (-1, 1):   # optical faces
        slab('Cuvette_optical_face', o, w, h - fl, 0, sy * (o / 2 - w / 2), fl + (h - fl) / 2, clear)
    for sx in (-1, 1):   # frosted faces, between the optical faces
        slab('Cuvette_frosted_face', w, i, h - fl, sx * (o / 2 - w / 2), 0, fl + (h - fl) / 2, frosted)
    registry = {
        'footprintMm': {'shape': 'rect', 'width': o, 'depth': o},
        'grip': {'heightMm': h - 8.0},
        'fill': {'innerBoxMm': {'width': i, 'depth': i, 'floorZ': fl, 'topZ': h}, 'capacityMl': 4, 'meniscus': 'concave'},
        'graduations': None,
        'anchors': {},
        'displays': [],
        'states': {'opticalFaces': '+y/-y', 'frostedFaces': '+x/-x'},
    }
    return root, registry
