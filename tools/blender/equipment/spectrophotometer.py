"""`spectrophotometer`: generic benchtop single-beam visible spectrophotometer.

A light-grey housing with a sloped front control panel (a blank display face and a keypad) and a
top-loading sample compartment whose lid is shown raised. The display face is blank glass: the
viewer draws only what `photometer-settings-status-and-entry` allows, meaning the configured mode
and wavelength, blank status and, after entry, the learner's own %T. It never shows a reading
(plan §2.4, D7). The cuvette well's anchor turns a seated cuvette 90 degrees, so its clear faces
meet the beam, which runs along x. Not a particular manufacturer's product.
"""
import math

import bmesh

from equipment._fits import CUVETTE_WELL
from labeq.geometry import MM, Matrix, bm_to_mesh, box_mesh, lathe, make_obj, new_root, transform_mesh

DEFINITION_ID = 'spectrophotometer'
THUMB_ELEVATION_DEG = 22

W, D, H_BACK, H_FRONT_LO, H_FRONT_HI, SPLIT_Y = 320.0, 300.0, 120.0, 58.0, 84.0, -40.0
WELL_X, WELL_Y = -80.0, 45.0


def _sloped_front():
    """Front section: a box whose top slopes from H_FRONT_LO at the front edge to H_FRONT_HI."""
    depth = SPLIT_Y + D / 2
    me = box_mesh('Spectro_front', W, depth, H_FRONT_HI, bevel=4.0, segs=3)
    transform_mesh(me, Matrix.Translation((0, (-D / 2 + depth / 2) * MM, H_FRONT_HI / 2 * MM)))
    y0, y1 = -D / 2, SPLIT_Y
    for v in me.vertices:
        z, y = v.co.z / MM, v.co.y / MM
        if z > H_FRONT_HI * 0.5:
            u = (y - y0) / (y1 - y0)
            target = H_FRONT_LO + (H_FRONT_HI - H_FRONT_LO) * max(0.0, min(1.0, u))
            v.co.z = (z - H_FRONT_HI + target) * MM
    me.update()
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


def build(coll, M):
    root = new_root('Spectrophotometer', coll)
    housing, dark = M['Instrument housing light grey'], M['Instrument housing dark grey']
    make_obj('Spectro_front', _sloped_front(), coll, housing, root, uv='box', sharp_deg=30)
    back_d = D / 2 - SPLIT_Y
    back = box_mesh('Spectro_back', W, back_d, H_BACK, bevel=5.0, segs=3)
    transform_mesh(back, Matrix.Translation((0, (SPLIT_Y + back_d / 2) * MM, H_BACK / 2 * MM)))
    make_obj('Spectro_back', back, coll, housing, root, uv='box', sharp_deg=30)

    # display: a blank dark face with a dark bezel, on the sloped panel
    make_obj('Spectro_display_bezel', _slope_quad('bezel', -105.0, 45.0, 0.18, 0.86, 0.3), coll, dark, root, uv='box')
    make_obj('Spectro_display', _slope_quad('display', -95.0, 35.0, 0.26, 0.78, 0.6), coll, M['Display glass'], root, uv='box')
    for k in range(8):  # keypad, 2 x 4
        cx, cu = 70.0 + (k % 4) * 18.0, 0.34 + (k // 4) * 0.3
        key = _slope_quad(f'key_{k}', cx - 6.5, cx + 6.5, cu - 0.09, cu + 0.09, 1.2)
        make_obj(f'Spectro_key_{k}', key, coll, M['Keypad membrane'], root, uv='box')

    # sample compartment: a dark surround on the deck, the well opening, and the raised lid
    surround = box_mesh('Spectro_well_surround', 46, 46, 4, bevel=1.2, segs=2)
    transform_mesh(surround, Matrix.Translation((WELL_X * MM, WELL_Y * MM, (H_BACK + 2) * MM)))
    make_obj('Spectro_well_surround', surround, coll, dark, root, uv='box')
    s = CUVETTE_WELL['side']
    bm = bmesh.new()
    vs = [bm.verts.new(((WELL_X + dx) * MM, (WELL_Y + dy) * MM, (H_BACK + 4.05) * MM))
          for dx, dy in ((-s / 2, -s / 2), (s / 2, -s / 2), (s / 2, s / 2), (-s / 2, s / 2))]
    bm.faces.new(vs)
    make_obj('Spectro_well', bm_to_mesh(bm, 'Spectro_well'), coll, M['Display glass'], root, uv='box')
    lid = box_mesh('Spectro_lid', 50, 14, 50, bevel=2.0, segs=2)  # raised: stands upright behind the well
    transform_mesh(lid, Matrix.Translation((WELL_X * MM, (WELL_Y + 30) * MM, (H_BACK + 25) * MM)))  # stands on the deck
    make_obj('Spectro_lid', lid, coll, dark, root, uv='box')
    for sx in (-1, 1):
        for sy in (-1, 1):
            foot = lathe([(0, -3), (9, -3), (9, 0.5), (0, 0.5)], segs=32)
            make_obj('Spectro_foot', foot, coll, M['Black rubber'], root,
                     loc=(sx * (W / 2 - 25), sy * (D / 2 - 25), 3.0))

    centre = _on_slope(-30.0, 0.52, 0.6)
    registry = {
        'footprintMm': {'shape': 'rect', 'width': W, 'depth': D},
        'grip': {'heightMm': 60.0},
        'graduations': None,
        'anchors': {'spectrophotometer-cuvette-slot': {
            'positionMm': [WELL_X, WELL_Y, H_BACK + 4.0 - CUVETTE_WELL['depth']], 'yawDeg': 90.0}},
        'displays': [{'id': 'main', 'policy': 'photometer-settings-status-and-entry',
                      'centreMm': [round(c, 2) for c in centre], 'sizeMm': [130.0, 52.0]}],
        'states': {'sampleLid': 'raised', 'beamAxis': 'x'},
    }
    return root, registry
