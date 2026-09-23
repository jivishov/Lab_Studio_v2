"""`analytical-balance`: generic milligram balance with a glass draft shield.

The catalogue records its precision as 0.001 with the unit mL, which is a volume unit, so the
model claims no readability and prints nothing (decision U9). The display face is blank glass:
the runtime does not simulate mass, and the viewer draws only what `balance-status-and-entry`
allows, meaning status and, after entry, the learner's own value (plan §2.4, D7, decision U4).
The right-hand draft-shield door is shown slid back, so a vessel can plausibly reach the pan.
Not a particular manufacturer's product.
"""
from labeq.geometry import MM, Matrix, box_mesh, lathe, make_obj, new_root, rounded, transform_mesh

DEFINITION_ID = 'analytical-balance'
THUMB_ELEVATION_DEG = 14

W, D, BASE_H = 220.0, 330.0, 78.0
SHIELD = dict(w=196.0, d=200.0, h=210.0, y=40.0, t=3.0)
PAN_R, PAN_Z = 45.0, BASE_H + 12.0


def build(coll, M):
    root = new_root('Analytical_balance', coll)
    housing, dark, glass = M['Instrument housing light grey'], M['Instrument housing dark grey'], M['Borosilicate glass']
    base = box_mesh('Balance_base', W, D, BASE_H, bevel=6.0, segs=3)
    transform_mesh(base, Matrix.Translation((0, 0, BASE_H / 2 * MM)))
    make_obj('Balance_base', base, coll, housing, root, uv='box', sharp_deg=30)

    # front panel: dark bezel, blank display face, four keys
    bezel = box_mesh('Balance_bezel', W - 30, 2.0, 40.0, bevel=0.8, segs=2)
    transform_mesh(bezel, Matrix.Translation((0, (-D / 2 - 0.6) * MM, 40.0 * MM)))
    make_obj('Balance_bezel', bezel, coll, dark, root, uv='box')
    disp = box_mesh('Balance_display', 86.0, 1.0, 22.0, bevel=0.3, segs=1)
    transform_mesh(disp, Matrix.Translation((-35.0 * MM, (-D / 2 - 1.8) * MM, 42.0 * MM)))
    make_obj('Balance_display', disp, coll, M['Display glass'], root, uv='box')
    for k in range(4):
        key = box_mesh('Balance_key', 13.0, 2.2, 9.0, bevel=0.8, segs=2)
        transform_mesh(key, Matrix.Translation(((28.0 + k * 17.0) * MM, (-D / 2 - 2.0) * MM, 42.0 * MM)))
        make_obj(f'Balance_key_{k}', key, coll, M['Keypad membrane'], root, uv='box')

    # weighing pan on its stem, inside the draft shield
    stem = lathe([(0, BASE_H), (6, BASE_H), (6, PAN_Z - 2), (0, PAN_Z - 2)], segs=32)
    make_obj('Balance_pan_stem', stem, coll, M['Brushed stainless'], root, loc=(0, SHIELD['y'], 0))
    pan = lathe(rounded([(0, PAN_Z - 2.0), (PAN_R, PAN_Z - 2.0), (PAN_R + 0.8, PAN_Z), (0, PAN_Z)], [0, 0.6, 0.6, 0]), segs=96)
    make_obj('Balance_pan', pan, coll, M['Brushed stainless'], root, loc=(0, SHIELD['y'], 0))

    # draft shield: glass walls in a light frame; the right-hand door slid back along its track
    s = SHIELD
    top_z = BASE_H + s['h']

    def panel(name, sx, sy, sz, x, y, z, mat=glass):
        me = box_mesh(name, sx, sy, sz, bevel=0.4, segs=1)
        transform_mesh(me, Matrix.Translation((x * MM, y * MM, z * MM)))
        make_obj(name, me, coll, mat, root, uv='box', sharp_deg=30)

    zc = BASE_H + s['h'] / 2
    panel('Shield_front', s['w'], s['t'], s['h'], 0, s['y'] - s['d'] / 2, zc)
    panel('Shield_back', s['w'], s['t'], s['h'], 0, s['y'] + s['d'] / 2, zc)
    panel('Shield_left', s['t'], s['d'], s['h'], -s['w'] / 2, s['y'], zc)
    panel('Shield_right_door', s['t'], s['d'], s['h'], s['w'] / 2 + 4.0, s['y'] + 140.0, zc)
    panel('Shield_top', s['w'], s['d'], s['t'], 0, s['y'], top_z)
    panel('Shield_frame_top', s['w'] + 8, s['d'] + 8, 8.0, 0, s['y'], top_z + 5.0, housing)
    # corner posts: the light frame real draft shields have, which also keeps the glass box legible
    for px in (-1, 1):
        for py in (-1, 1):
            panel('Shield_post', 6.0, 6.0, s['h'], px * (s['w'] / 2 + 1.5), s['y'] + py * (s['d'] / 2 + 1.5), zc, housing)
    panel('Shield_door_rail', 6.0, s['d'] + 150.0, 5.0, s['w'] / 2 + 4.0, s['y'] + 75.0, top_z + 3.5, housing)
    for sx in (-1, 1):
        for sy in (-1, 1):
            foot = lathe([(0, -3), (8, -3), (8, 0.5), (0, 0.5)], segs=32)
            make_obj('Balance_foot', foot, coll, M['Black rubber'], root, loc=(sx * (W / 2 - 22), sy * (D / 2 - 22), 3.0))

    registry = {
        'footprintMm': {'shape': 'rect', 'width': W, 'depth': D},
        'grip': {'heightMm': 50.0},
        'graduations': None,
        'anchors': {'analytical-balance-pan': {'positionMm': [0.0, SHIELD['y'], PAN_Z]}},
        'displays': [{'id': 'main', 'policy': 'balance-status-and-entry',
                      'centreMm': [-35.0, -D / 2 - 2.35, 42.0], 'sizeMm': [86.0, 22.0], 'normalMm': [0.0, -1.0, 0.0]}],
        'states': {'draftShieldRightDoor': 'open'},
    }
    return root, registry
