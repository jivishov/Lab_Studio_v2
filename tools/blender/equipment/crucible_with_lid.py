"""`crucible-with-lid`: glazed porcelain crucible with its lid (Pack 2, decided 2026-10-05).

A tapered porcelain body, 45 mm across the rim, 25 mm across the foot and 39 mm tall (about 25 mL to the
brim), glazed inside and out except the foot ring; a domed lid with a knob. The lid is drawn on the rim
(`closed`) or askew (`askew`: slid across the rim until its lip rides up onto it, so the lid rests level
on its lip and a crescent gap stays open for the gases, as the source's Figure 1 shows), from the
runtime's apparatus state. Under strong heating the body shows a dull red glow (`glow`).
A tipped-out solid leaves from the rim.
"""
from equipment._fits import CRUCIBLE
from labeq.geometry import MM, Matrix, lathe, make_obj, new_root, rounded, set_material_index, transform_mesh

DEFINITION_ID = 'crucible-with-lid'
THUMB_ELEVATION_DEG = 28

R_TOP, R_FOOT, H = CRUCIBLE['r_top'], CRUCIBLE['r_foot'], CRUCIBLE['height']
WALL, FLOOR = 2.4, 3.2
LID_R, LID_T, LID_DOME, LID_LIP = 23.6, 2.2, 3.0, 2.0
ASKEW_SHIFT = 9.0


def wall_r(z):
    """The body's outer radius at height z above the foot."""
    return R_FOOT + (R_TOP - R_FOOT) * z / H


def build(coll, M):
    root = new_root('Crucible_30mL', coll)
    porcelain, foot = M['Glazed porcelain'], M['Pipe clay']
    pts = [(0, 0), (R_FOOT - 1.5, 0), (R_FOOT, 1.5), (R_TOP, H - 0.8), (R_TOP - 0.6, H), (R_TOP - WALL + 0.4, H),
           (R_TOP - WALL, H - 1.0), (R_FOOT - WALL + 0.8, FLOOR + 2.0), (R_FOOT - WALL - 1.5, FLOOR), (0, FLOOR)]
    rad = [0, 1.0, 1.0, 0.8, 0.6, 0.6, 0.6, 2.5, 2.5, 0]
    body = lathe(rounded(pts, rad, n=5), segs=64)
    # The foot ring is left unglazed, as fired porcelain is.
    set_material_index(body, lambda x, y, z: z < 0.6)
    make_obj('Crucible_body', body, coll, [porcelain, foot], root)
    # The lid: a shallow dome with a lip that drops just inside the rim, and a knob.
    lid_pts = [(0, LID_T + LID_DOME), (LID_R * 0.5, LID_T + LID_DOME * 0.8), (LID_R, LID_T * 0.6), (LID_R, 0),
               (R_TOP - WALL - 0.6, 0), (R_TOP - WALL - 0.8, -LID_LIP), (R_TOP - WALL - 2.0, -LID_LIP), (R_TOP - WALL - 2.0, 0.2),
               (0, LID_DOME * 0.8)]
    lid_rad = [0, 6.0, 1.0, 0.6, 0.3, 0.5, 0.5, 0.5, 0]
    knob = [(0, LID_T + LID_DOME + 7.0), (4.0, LID_T + LID_DOME + 7.0), (4.6, LID_T + LID_DOME + 5.0), (2.6, LID_T + LID_DOME + 2.0),
            (3.4, LID_T + LID_DOME - 0.5), (0, LID_T + LID_DOME - 0.5)]
    knob_rad = [0, 1.2, 1.2, 1.0, 0.6, 0]
    for name, askew in (('Crucible_lid', False), ('Crucible_lid_askew', True)):
        for part, prof, r in ((name, lid_pts, lid_rad), (f'{name}_knob', knob, knob_rad)):
            me = lathe(rounded(prof, r, n=5), segs=56, name=part)
            if askew:
                # Slid across toward +x: the lip, which drops just inside the mouth when it is closed, rides up
                # onto the rim where it crosses it, so the lid rests level on its lip, a lip's depth higher,
                # and a crescent of the mouth stays open at -x.
                transform_mesh(me, Matrix.Translation((ASKEW_SHIFT * MM, 0, (H + LID_LIP) * MM)))
            else:
                transform_mesh(me, Matrix.Translation((0, 0, H * MM)))
            make_obj(part, me, coll, porcelain, root)
    inner = [[0.0, FLOOR], [R_FOOT - WALL - 1.5, FLOOR], [R_TOP - WALL, H]]
    registry = {
        'footprintMm': {'shape': 'circle', 'radius': R_TOP},
        'grip': {'heightMm': 30.0},
        'pour': {'lipMm': [-R_TOP, 0.0, H], 'tiltDeg': 115.0, 'style': 'pour'},
        'graduations': None,
        'solidRest': {'centreMm': [0.0, 0.0, FLOOR], 'radiusMm': 9.0},
        'stateObjects': [
            {'stateKeys': ['lid'], 'default': 'closed',
             'objects': {'closed': ['Crucible_lid', 'Crucible_lid_knob'], 'askew': ['Crucible_lid_askew', 'Crucible_lid_askew_knob']}},
        ],
        'glow': {'stateKey': 'glow', 'objects': ['Crucible_body']},
        'anchors': {},
        'displays': [],
        'states': {},
    }
    assert inner[-1][0] > inner[1][0]
    return root, registry
