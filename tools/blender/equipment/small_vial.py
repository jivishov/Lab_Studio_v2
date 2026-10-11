"""`small-vial`: 20 mL borosilicate glass vial, 28 x 61 mm, open (Pack 2, decided 2026-10-05).

It holds a replicate's working portion of the solid mixture (Heat and Reweigh), which is tipped out over
its threaded neck into the crucible. Its cap is set aside and not drawn. The neck carries one moulded
helical thread (2026-10-10), as a real screw-cap vial does.
"""
from labeq.geometry import helix_thread_mesh, lathe, make_obj, new_root, rounded, set_material_index

DEFINITION_ID = 'small-vial'
THUMB_ELEVATION_DEG = 18

R, T, H, FLOOR = 14.0, 1.2, 61.0, 1.8
NECK_R, NECK_H = 12.0, 9.0


def build(coll, M):
    root = new_root('Vial_20mL', coll)
    shoulder = H - NECK_H
    pts = [(0, 0), (R - 2.0, 0), (R, 2.0), (R, shoulder - 3.0), (NECK_R + 0.6, shoulder), (NECK_R, shoulder + 1.0),
           (NECK_R, H - 0.6), (NECK_R - 0.6, H), (NECK_R - T - 0.2, H), (NECK_R - T, H - 1.0), (NECK_R - T, shoulder + 0.5),
           (R - T, shoulder - 3.5), (R - T, FLOOR + 2.0), (R - T - 2.0, FLOOR), (0, FLOOR)]
    rad = [0, 1.6, 1.6, 2.0, 1.0, 0.4, 0.4, 0.4, 0.4, 0.4, 1.0, 2.0, 1.6, 1.6, 0]
    glass = lathe(rounded(pts, rad), segs=96)
    # only the fire-polished lip and the floor are thick glass; the neck wall is as thin as the body
    set_material_index(glass, lambda x, y, z: z > H - 1.2 or z < FLOOR + 0.3)
    make_obj('Vial_glass', glass, coll, [M['Borosilicate glass'], M['Borosilicate glass thick']], root)
    # the cap thread of a 400-series finish: one moulded turn and a quarter at 8 threads an inch
    # (3.2 mm), faded in and out at its ends
    thread = helix_thread_mesh('Vial_thread', NECK_R, 0.8, shoulder + 2.4, 3.2, 1.25, 1.5, runout=0.25)
    make_obj('Vial_thread', thread, coll, M['Borosilicate glass thick'], root)
    registry = {
        'footprintMm': {'shape': 'circle', 'radius': R},
        'grip': {'heightMm': 35.0},
        'pour': {'lipMm': [-NECK_R, 0.0, H], 'tiltDeg': 120.0, 'style': 'pour'},
        'fill': {'innerProfileMm': [[0.0, FLOOR], [R - T - 2.0, FLOOR], [R - T, FLOOR + 2.0], [R - T, shoulder - 3.5],
                                    [NECK_R - T, shoulder + 0.5], [NECK_R - T, H]], 'capacityMl': 20, 'meniscus': 'concave'},
        'graduations': None,
        'solidRest': {'centreMm': [0.0, 0.0, FLOOR], 'radiusMm': 8.0},
        'anchors': {},
        'displays': [],
        'states': {},
    }
    return root, registry
