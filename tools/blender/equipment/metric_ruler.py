"""`metric-ruler`: a clear 15 cm ruler with millimetre divisions (Pack 3a, decided 2026-10-10).

Clear polystyrene with a faint mould satin, 172 x 30 x 2 mm, its top edges chamfered. The scale is printed in black along its left edge (the
measuring edge): a line every millimetre, longer at every 5 mm and longest and numbered at every centimetre, 0 to
15, with the zero inset 10 mm from the near end, as on a real ruler, so the zero can be laid on a pencil line. The
lines are laid by `graduation_scale` over a straight "profile" that rises 1 mm per unit. Modelled lying flat along
the bench's depth, zero nearest the student, its origin at the centre of its underside; the numbers read upright
from the student's side. `scaleMm` tells the viewer where the zero is on the measuring edge, which way the scale
runs, and its length and division, so a strip's distances line up with the printed lines. It is measurement-
neutral: the strip shows the prepared distances and the student reads them (G-1).
"""
import math

import bmesh
import bpy

from equipment._scales import graduation_scale
from labeq.geometry import MM, Matrix, bm_to_mesh, box_mesh, make_obj, new_root, transform_mesh
from labeq.markings import add_rect, text_mesh

DEFINITION_ID = 'metric-ruler'
THUMB_ELEVATION_DEG = 28

W, L, T = 30.0, 172.0, 2.0
CHAMFER = 0.8
EDGE = -W / 2 + CHAMFER + 0.2      # the measuring edge's lines start just inside the chamfer
ZERO_Y = -L / 2 + 10.0
SCALE_MM = 150
UNIT_R = math.sqrt(1000.0 / math.pi)  # a cylinder of this radius holds 1 mL per mm of height


def build(coll, M):
    root = new_root('Metric_ruler_15cm', coll)
    plate = box_mesh('Ruler_plate', W, L, T, bevel=0.25, segs=2, chamfer=CHAMFER)
    transform_mesh(plate, Matrix.Translation((0, 0, T / 2 * MM)))
    ob = make_obj('Ruler_plate', plate, coll, M['Polystyrene ruler clear'], root, uv='box')
    # Renders only: lying on the studio floor, the clear plate would darken the floor seen through it with its own
    # shadow. The GLB carries no shadow setting; the viewer lights it as its role says.
    ob.visible_shadow = False

    # The scale, laid out in the XZ plane (z the distance from the zero), each line starting at the measuring edge.
    pieces = graduation_scale([[UNIT_R, 0.0], [UNIT_R, SCALE_MM + 5.0]], range(0, SCALE_MM + 1), lambda mm: mm,
                              lambda mm: str(mm // 10), 10, 5, ((3.2, 0.09, 2), (2.4, 0.08, 2), (1.6, 0.07, 2)), 3.0, EDGE + 7.6)
    pieces = [('rect', EDGE, EDGE + p[2] - p[1], p[3], p[4], p[5]) if p[0] == 'rect' else p for p in pieces]
    pieces.append(('text', 'cm', 2.6, EDGE + 7.6, SCALE_MM + 7.0, 'LEFT'))
    pieces.append(('text', 'mm', 2.0, EDGE + 13.0, 2.5, 'LEFT'))
    bm = bmesh.new()
    for p in pieces:
        if p[0] == 'rect':
            add_rect(bm, *p[1:])
        else:
            tm = text_mesh(*p[1:])
            bm.from_mesh(tm)
            bpy.data.meshes.remove(tm)
    scale = bm_to_mesh(bm, 'Ruler_scale')
    # Laid flat on the top face: the layout's z runs along +Y from the zero, its faces turned up.
    transform_mesh(scale, Matrix.Translation((0, ZERO_Y * MM, (T + 0.02) * MM)) @ Matrix.Rotation(-math.pi / 2, 4, 'X'))
    make_obj('Ruler_scale', scale, coll, M['Black print ink'], root, sharp_deg=0)

    registry = {
        'footprintMm': {'shape': 'rect', 'width': W, 'depth': L},
        'grip': {'heightMm': T},
        'graduations': None,
        'scaleMm': {'zeroMm': [EDGE, ZERO_Y, T], 'directionMm': [0.0, 1.0, 0.0], 'lengthMm': SCALE_MM, 'minorMm': 1},
        'anchors': {},
        'displays': [],
        'states': {},
    }
    return root, registry
