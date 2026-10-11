"""`pencil`: a sharpened HB pencil, hexagonal, 173 mm (Pack 3a, decided 2026-10-10).

The marking tool for the baseline, the solvent front and the trial's label ("use pencil, never ink"). A yellow
lacquered cedar body 7 mm across the flats, sharpened to a cone of bare wood and a graphite point, with an
aluminium ferrule and a pink eraser. The sharpened cone is wider than the hexagon's flats, so the wood shows in a
scallop on each flat, as on a real sharpened pencil. Modelled upright with its origin at the point (`tipMm`), and
lying on a flat at rest (`benchRest`).
"""
from labeq.geometry import lathe, make_obj, new_root, rounded

DEFINITION_ID = 'pencil'
THUMB_ELEVATION_DEG = 35

FLAT = 3.5                        # half the width across the flats
CORNER = FLAT / 0.8660254         # the hexagon's corner radius
LEAD_R, POINT_Z, CONE_Z = 1.0, 5.0, 21.0
BODY_Z, FERRULE_Z, ERASER_Z, TOP = 20.0, 160.0, 167.0, 173.0


def build(coll, M):
    root = new_root('Pencil_HB', coll)
    point = lathe(rounded([(0, 0), (0.25, 0.05), (LEAD_R, POINT_Z), (LEAD_R, POINT_Z + 3.0), (0, POINT_Z + 3.0)],
                          [0, 0.2, 0, 0, 0]), segs=24)
    make_obj('Pencil_point', point, coll, M['Pencil graphite'], root)
    cone = lathe([(LEAD_R, POINT_Z), (3.75, CONE_Z), (0, CONE_Z), (0, POINT_Z + 3.0)], segs=48, closed=True)
    make_obj('Pencil_wood', cone, coll, M['Pencil cedar'], root, uv='box')
    # Six segments: corners on +-X, flats facing +-Y, so the pencil lies on a flat when rolled onto its side.
    body = lathe([(0, BODY_Z), (CORNER, BODY_Z), (CORNER, FERRULE_Z + 0.5), (0, FERRULE_Z + 0.5)], segs=6, closed=True, tol=0)
    make_obj('Pencil_body', body, coll, M['Pencil lacquer yellow'], root, sharp_deg=50, uv='box')
    ferrule = [(0, FERRULE_Z), (4.1, FERRULE_Z), (4.1, FERRULE_Z + 1.6), (3.9, FERRULE_Z + 2.0), (4.1, FERRULE_Z + 2.4),
               (4.1, ERASER_Z - 2.4), (3.9, ERASER_Z - 2.0), (4.1, ERASER_Z - 1.6), (4.1, ERASER_Z), (0, ERASER_Z)]
    make_obj('Pencil_ferrule', lathe(rounded(ferrule, [0, 0.2, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.2, 0]), segs=48), coll,
             M['Pencil ferrule'], root)
    eraser = lathe(rounded([(0, ERASER_Z - 0.5), (3.6, ERASER_Z - 0.5), (3.6, TOP), (0, TOP)], [0, 0, 1.4, 0]), segs=40)
    make_obj('Pencil_eraser', eraser, coll, M['Pencil eraser'], root)
    registry = {
        'footprintMm': {'shape': 'rect', 'width': FLAT * 2, 'depth': TOP},
        'grip': {'heightMm': 45.0},
        'graduations': None,
        'tipMm': [0.0, 0.0, 0.0],
        'benchRest': {'rollDeg': -90.0, 'liftMm': FLAT, 'shiftMm': [0.0, -TOP / 2]},
        'anchors': {},
        'displays': [],
        'states': {},
    }
    return root, registry
