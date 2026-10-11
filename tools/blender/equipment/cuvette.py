"""`cuvette`: 12.5 mm square polystyrene macro cuvette, 10 mm light path (catalogue 4 mL).

Two clear optical faces (+/-Y as modelled) and two frosted faces (+/-X), as on real cuvettes; the
optical-face rule itself is recorded by a notebook step (plan §2.6). Seated in the
spectrophotometer it is turned 90 degrees so the clear faces meet the beam (the slot anchor's yaw).
It is one moulded body with softly rounded outer edges and a square bore (refined 2026-10-10).
"""
from equipment._fits import CUVETTE
from labeq.geometry import MM, Matrix, box_mesh, cut, make_obj, new_root, set_material_index, transform_mesh

DEFINITION_ID = 'cuvette'
THUMB_ELEVATION_DEG = 20


def build(coll, M):
    root = new_root('Cuvette_10mm', coll)
    o, h, i, fl = CUVETTE['outer'], CUVETTE['height'], CUVETTE['inner'], CUVETTE['floor']
    edge = 0.6
    body = box_mesh('Cuvette_body', o, o, h, bevel=edge, segs=3)
    transform_mesh(body, Matrix.Translation((0, 0, h / 2 * MM)))
    bore = box_mesh('bore', i, i, h)
    transform_mesh(bore, Matrix.Translation((0, 0, (fl + h / 2 + 0.5) * MM)))
    body = cut(body, [bore], 'Cuvette_body')
    # the two side walls (+/-X) are frosted, inside and out; the optical faces and the rounded corners are clear
    set_material_index(body, lambda x, y, z: abs(x) > i / 2 - 0.01 and abs(y) < o / 2 - edge and z > fl - 0.01)
    make_obj('Cuvette_body', body, coll, [M['Polystyrene clear'], M['Polystyrene frosted']], root, uv='box', sharp_deg=30)
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
