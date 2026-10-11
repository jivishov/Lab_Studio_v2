"""`graduated-pipette-10ml`: 10 mL serological glass pipette, 0.1 mL divisions (catalogue: 10 mL, 0.1 mL).

Modelled upright with its origin at the tip, as the Beral pipette is, so it is carried and judged by
its tip and lies flat on the bench at rest (`benchRest`). The 0 mark is at the top of the scale and the
numbers rise toward the tip: filled to 0 it holds 10 mL, and the line labelled 5 is where 5 mL has
been delivered. Each line is placed from the bore's own profile at the volume it leaves in the
pipette. The pump seat (`graduated-pipette-pump-seat`) is where the pump's open end sits on the top
of the tube (decided 2026-10-02). No tolerance class is claimed.
"""
from equipment._scales import graduation_scale
from labeq.geometry import FRONT, lathe, level_for_volume_mm, make_obj, new_root, rounded, set_material_index
from labeq.markings import markings

DEFINITION_ID = 'graduated-pipette-10ml'
THUMB_ELEVATION_DEG = 10

R_OUT, R_IN, TIP_OUT, TIP_IN = 4.3, 3.5, 0.8, 0.45
TAPER, TOP = 12.0, 330.0
PUMP_SEAT_DEPTH = 14.0


def build(coll, M):
    root = new_root('Graduated_pipette_10mL', coll)
    outer = [(TIP_IN, 0.0), (TIP_OUT, 0.15), (R_OUT, TAPER), (R_OUT, TOP - 0.6), (R_OUT - 0.3, TOP)]
    inner = [(R_IN, TOP), (R_IN, TAPER + 0.8), (TIP_IN, 0.6)]
    glass = lathe(rounded(outer + inner, [0, 0.1, 3.0, 0.3, 0, 0, 3.0, 0]), segs=48)
    set_material_index(glass, lambda x, y, z: z > TOP - 1.0 or z < 1.0)
    make_obj('Pipette_glass', glass, coll, [M['Borosilicate glass'], M['Borosilicate glass thick']], root)

    fill = [[TIP_IN, 0.6], [R_IN, TAPER + 0.8], [R_IN, TOP]]
    # each line at the volume it leaves in the pipette, labelled with what has been delivered
    pieces = graduation_scale(fill, range(0, 100), lambda tenth: 10.0 - tenth / 10, lambda tenth: str(tenth // 10), 10, 5,
                              ((2.6, 0.16, 3), (1.9, 0.13, 2), (1.2, 0.11, 2)), 2.0, 3.0)
    top_line = level_for_volume_mm(fill, 10.0)
    pieces.append(('text', '10 mL', 2.0, 0.0, top_line + 9.0, 'CENTER'))
    markings('Pipette_graduations', pieces, lambda z: R_OUT, FRONT, 0.05, coll, M['Blue print ink'], root)

    registry = {
        'footprintMm': {'shape': 'rect', 'width': R_OUT * 2 + 1, 'depth': TOP},
        'grip': {'heightMm': 210.0},
        'fill': {'innerProfileMm': fill, 'capacityMl': 10, 'meniscus': 'concave'},
        'graduations': {'unit': 'mL', 'minor': 0.1, 'major': 1, 'maxMl': 10, 'direction': 'delivered-from-top'},
        'carriedByTip': True,
        'benchRest': {'rollDeg': -90.0, 'liftMm': R_OUT, 'shiftMm': [0.0, -TOP / 2]},
        'anchors': {'graduated-pipette-pump-seat': {'positionMm': [0.0, 0.0, TOP - PUMP_SEAT_DEPTH]}},
        'displays': [],
        'states': {},
    }
    return root, registry
