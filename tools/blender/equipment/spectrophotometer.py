"""`spectrophotometer`: generic benchtop single-beam visible spectrophotometer.

A light-grey moulded housing, its side walls drafted inward as moulded panels are, on a dark recessed plinth, with a sloped front control panel (a blank
display face behind a raised bezel, and a keypad of raised keys) and a top-loading sample compartment:
a dark compartment block with a real square well cut 30 mm down into it, and a hinged lid shown raised
on its hinge behind the well (refined 2026-10-10). The display face is blank glass: the viewer draws
only what `photometer-settings-status-and-entry` allows, meaning the configured mode and wavelength,
blank status and, after entry, the learner's own %T. It never shows a reading (plan §2.4, D7). The
cuvette well's anchor turns a seated cuvette 90 degrees, so its clear faces meet the beam, which runs
along x. Not a particular manufacturer's product.

The housing's outer size, the well anchor and the display face are those of the first model, so
nothing the runtime reads moved in the refinement. The dark plinth stands in for the rubber feet,
which the first model buried inside the housing.
"""
import math

import bmesh

from equipment._fits import CUVETTE_WELL
from labeq.geometry import (MM, Matrix, bm_to_mesh, box_mesh, cut, cylinder_mesh, make_obj, new_root,
                            set_material_index, transform_mesh)

DEFINITION_ID = 'spectrophotometer'
THUMB_ELEVATION_DEG = 22

W, D, H_BACK, H_FRONT_LO, H_FRONT_HI, SPLIT_Y = 320.0, 300.0, 120.0, 58.0, 84.0, -40.0
WELL_X, WELL_Y = -80.0, 45.0
PLINTH = 4.0           # the dark plinth the housing sits on, set in 6 mm all round
BLOCK, BLOCK_H = 58.0, 4.0   # the sample-compartment block on the deck; its top is the well's rim
LID_L, LID_T, LID_OPEN = 43.6, 4.5, 100.0  # the lid: length over the well, thickness, opening angle
HINGE_Y = WELL_Y + 25.0
SLOPE = math.atan2(H_FRONT_HI - H_FRONT_LO, SPLIT_Y + D / 2)
DRAFT_DEG = 1.5        # the moulded side walls lean in this much; front and back faces stay upright


def _draft(me):
    """Lean the side walls (+/-X) of a housing section in by DRAFT_DEG from where the bottom bevel ends,
    so the housing keeps its full width there. Only x moves, so the sloped panel, and the display and keys
    laid on it, keep their places."""
    k = math.tan(math.radians(DRAFT_DEG)) / (W / 2)
    for v in me.vertices:
        rise = max(0.0, v.co.z / MM - (PLINTH + 5.0))
        v.co.x *= 1.0 - k * rise
    me.update()


def _sloped_front():
    """Front section, on the plinth: a box whose top slopes from H_FRONT_LO at the front edge to H_FRONT_HI."""
    depth = SPLIT_Y + D / 2
    hgt = H_FRONT_HI - PLINTH
    me = box_mesh('Spectro_front', W, depth, hgt, bevel=4.0, segs=3)
    transform_mesh(me, Matrix.Translation((0, (-D / 2 + depth / 2) * MM, (PLINTH + hgt / 2) * MM)))
    y0, y1 = -D / 2, SPLIT_Y
    for v in me.vertices:
        z, y = v.co.z / MM, v.co.y / MM
        if z > PLINTH + hgt * 0.5:
            u = (y - y0) / (y1 - y0)
            target = H_FRONT_LO + (H_FRONT_HI - H_FRONT_LO) * max(0.0, min(1.0, u))
            v.co.z = (z - H_FRONT_HI + target) * MM
    me.update()
    _draft(me)
    return me


def _on_slope(x, u, height=0.4):
    """A point on the sloped panel at fraction u (0 front, 1 back), `height` mm above it."""
    y = -D / 2 + (SPLIT_Y + D / 2) * u
    z = H_FRONT_LO + (H_FRONT_HI - H_FRONT_LO) * u
    ny, nz = -(H_FRONT_HI - H_FRONT_LO), SPLIT_Y + D / 2
    ln = math.hypot(ny, nz)
    return (x, y + ny / ln * height, z + nz / ln * height)


def _slope_quad(name, x0, x1, u0, u1, height):
    bm = bmesh.new()
    corners = [_on_slope(x0, u0, height), _on_slope(x1, u0, height), _on_slope(x1, u1, height), _on_slope(x0, u1, height)]
    vs = [bm.verts.new(tuple(c * MM for c in p)) for p in corners]
    bm.faces.new(vs)
    return bm_to_mesh(bm, name)


def _on_panel(me, x, u, lift):
    """Lay a mesh built flat about the origin (its underside at z = 0) on the sloped panel, centred at
    (x, u) and lifted `lift` mm off it."""
    px, py, pz = _on_slope(x, u, lift)
    transform_mesh(me, Matrix.Translation((px * MM, py * MM, pz * MM)) @ Matrix.Rotation(SLOPE, 4, 'X'))


def _slope_len(u0, u1):
    return (u1 - u0) * (SPLIT_Y + D / 2) / math.cos(SLOPE)


def build(coll, M):
    root = new_root('Spectrophotometer', coll)
    housing, dark = M['Instrument housing light grey'], M['Instrument housing dark grey']

    plinth = box_mesh('Spectro_plinth', W - 12, D - 12, PLINTH + 1.0, bevel=1.5, segs=2)
    transform_mesh(plinth, Matrix.Translation((0, 0, (PLINTH + 1.0) / 2 * MM)))
    make_obj('Spectro_plinth', plinth, coll, dark, root, uv='box')
    make_obj('Spectro_front', _sloped_front(), coll, housing, root, uv='box', sharp_deg=30)

    # the back section, with the sample well cut 30 mm down from the compartment block's top
    rim = H_BACK + BLOCK_H
    floor = rim - CUVETTE_WELL['depth']
    s = CUVETTE_WELL['side']

    def well_cutter():
        c = box_mesh('well_cut', s, s, rim + 2 - floor)
        transform_mesh(c, Matrix.Translation((WELL_X * MM, WELL_Y * MM, (floor + (rim + 2 - floor) / 2) * MM)))
        return c

    in_well = lambda x, y, z: abs(x - WELL_X) < s / 2 + 0.05 and abs(y - WELL_Y) < s / 2 + 0.05 and z < rim - 0.05
    back_d = D / 2 - SPLIT_Y
    back = box_mesh('Spectro_back', W, back_d, H_BACK - PLINTH, bevel=5.0, segs=3)
    transform_mesh(back, Matrix.Translation((0, (SPLIT_Y + back_d / 2) * MM, (PLINTH + (H_BACK - PLINTH) / 2) * MM)))
    _draft(back)
    back = cut(back, [well_cutter()], 'Spectro_back')
    set_material_index(back, in_well)
    make_obj('Spectro_back', back, coll, [housing, dark], root, uv='box', sharp_deg=30)

    block = box_mesh('Spectro_compartment', BLOCK, BLOCK, BLOCK_H + 1.0, bevel=1.5, segs=2)
    transform_mesh(block, Matrix.Translation((WELL_X * MM, WELL_Y * MM, (H_BACK - 1.0 + (BLOCK_H + 1.0) / 2) * MM)))
    block = cut(block, [well_cutter()], 'Spectro_compartment')
    make_obj('Spectro_compartment', block, coll, dark, root, uv='box', sharp_deg=30)

    # the lid: hinged on a barrel behind the well and raised past upright, as when a cuvette goes in
    lid = box_mesh('Spectro_lid', BLOCK - 4.0, LID_L, LID_T, bevel=1.4, segs=2)
    transform_mesh(lid, Matrix.Translation((0, -LID_L / 2 * MM, LID_T / 2 * MM)))
    tab = box_mesh('Spectro_lid_tab', 18.0, 4.0, LID_T + 2.5, bevel=1.0, segs=2)  # the finger tab at its free edge
    transform_mesh(tab, Matrix.Translation((0, -(LID_L + 1.0) * MM, (LID_T + 2.5) / 2 * MM)))
    hinge_at = Matrix.Translation((WELL_X * MM, HINGE_Y * MM, (rim + 0.3) * MM)) @ Matrix.Rotation(-math.radians(LID_OPEN), 4, 'X')
    for me in (lid, tab):
        transform_mesh(me, hinge_at)
    make_obj('Spectro_lid', lid, coll, dark, root, uv='box', sharp_deg=30)
    make_obj('Spectro_lid_tab', tab, coll, dark, root, uv='box', sharp_deg=30)
    barrel = cylinder_mesh('Spectro_hinge', 2.6, -21.0, 21.0)
    transform_mesh(barrel, Matrix.Translation((WELL_X * MM, (HINGE_Y + 1.5) * MM, (rim + 1.6) * MM)) @ Matrix.Rotation(math.pi / 2, 4, 'Y'))
    make_obj('Spectro_hinge', barrel, coll, dark, root, uv='box')

    # display: a blank glass face sunk behind a raised dark bezel, on the sloped panel
    u0, u1 = 0.18, 0.86
    bezel = box_mesh('Spectro_display_bezel', 150.0, _slope_len(u0, u1), 1.6, bevel=0.8, segs=2)
    window = box_mesh('window', 132.0, _slope_len(0.25, 0.79), 4.0)
    transform_mesh(window, Matrix.Translation((0, (_slope_len(u0, 0.25) - _slope_len(0.79, u1)) / 2 * MM, 0)))
    bezel = cut(bezel, [window], 'Spectro_display_bezel')
    transform_mesh(bezel, Matrix.Translation((0, 0, 0.8 * MM)))
    _on_panel(bezel, -30.0, (u0 + u1) / 2, -0.4)
    make_obj('Spectro_display_bezel', bezel, coll, dark, root, uv='box', sharp_deg=30)
    make_obj('Spectro_display', _slope_quad('display', -95.0, 35.0, 0.26, 0.78, 0.6), coll, M['Display glass'], root, uv='box')

    # keypad: eight raised, rounded keys on a slightly sunk dark key field
    field = box_mesh('Spectro_key_field', 86.0, _slope_len(0.2, 0.78), 0.6, bevel=0.3, segs=1)
    transform_mesh(field, Matrix.Translation((0, 0, 0.3 * MM)))
    _on_panel(field, 97.0, 0.49, -0.2)
    make_obj('Spectro_key_field', field, coll, dark, root, uv='box')
    for k in range(8):  # 2 x 4
        cx, cu = 70.0 + (k % 4) * 18.0, 0.34 + (k // 4) * 0.3
        key = box_mesh(f'key_{k}', 13.0, _slope_len(cu - 0.09, cu + 0.09), 2.0, bevel=0.7, segs=2)
        transform_mesh(key, Matrix.Translation((0, 0, 1.0 * MM)))
        _on_panel(key, cx, cu, 0.2)
        make_obj(f'Spectro_key_{k}', key, coll, M['Keypad membrane'], root, uv='box')

    centre = _on_slope(-30.0, 0.52, 0.6)
    ny, nz = -(H_FRONT_HI - H_FRONT_LO), SPLIT_Y + D / 2
    ln = math.hypot(ny, nz)
    registry = {
        'footprintMm': {'shape': 'rect', 'width': W, 'depth': D},
        'grip': {'heightMm': 60.0},
        'graduations': None,
        'anchors': {'spectrophotometer-cuvette-slot': {
            'positionMm': [WELL_X, WELL_Y, floor], 'yawDeg': 90.0}},
        'displays': [{'id': 'main', 'policy': 'photometer-settings-status-and-entry',
                      'centreMm': [round(c, 2) for c in centre], 'sizeMm': [130.0, 52.0],
                      'normalMm': [0.0, round(ny / ln, 4), round(nz / ln, 4)]}],
        'states': {'sampleLid': 'raised', 'beamAxis': 'x'},
    }
    return root, registry
