"""`drying-oven`: compact benchtop gravity-convection drying oven (Pack 2, decided 2026-10-05).

A light-grey steel case, 420 x 380 x 420 mm, with a stainless chamber 300 mm wide behind a door hinged
on its left, a wire shelf, and a control panel on the right: a temperature display and a setting dial.
The watch glass sits on the shelf (`drying-oven-chamber`). The door is drawn closed or open from the
runtime's apparatus state (`doors`); the display shows the setting the student made, nothing else
(`oven-setpoint`). Nothing is printed but the panel's legends.
"""
from labeq.geometry import MM, Matrix, box_mesh, lathe, make_obj, new_root, rounded, transform_mesh
from labeq.markings import text_mesh

DEFINITION_ID = 'drying-oven'
THUMB_ELEVATION_DEG = 14

W, D, H = 420.0, 380.0, 420.0
FEET = 12.0
WALL = 18.0
CH_W, CH_H = 300.0, 300.0           # the chamber opening, left part of the front
CH_X0 = -W / 2 + WALL                # its left edge
CH_Z0 = FEET + 50.0                  # its floor
SHELF_Z = CH_Z0 + 100.0
PANEL_X0 = CH_X0 + CH_W + WALL       # the control panel, right of the chamber
DOOR_T = 22.0


def _box(name, sx, sy, sz, cx, cy, cz, coll, mat, root, bevel=1.5):
    me = box_mesh(name, sx, sy, sz, bevel=bevel, segs=2)
    transform_mesh(me, Matrix.Translation((cx * MM, cy * MM, cz * MM)))
    return make_obj(name, me, coll, mat, root, uv='box')


def build(coll, M):
    root = new_root('Drying_oven', coll)
    case, liner, dark = M['Instrument housing light grey'], M['Brushed stainless'], M['Instrument housing dark grey']
    front_y = -D / 2
    # The case: top, bottom, back and two sides, and the wall between the chamber and the panel.
    _box('Oven_top', W, D, WALL, 0, 0, H - WALL / 2, coll, case, root, 3.0)
    _box('Oven_bottom', W, D, CH_Z0 - FEET, 0, 0, FEET + (CH_Z0 - FEET) / 2, coll, case, root, 3.0)
    _box('Oven_back', W, WALL, H - FEET, 0, D / 2 - WALL / 2, FEET + (H - FEET) / 2, coll, case, root)
    _box('Oven_left', WALL, D, H - FEET, -W / 2 + WALL / 2, 0, FEET + (H - FEET) / 2, coll, case, root)
    _box('Oven_right', W / 2 - PANEL_X0 + WALL, D, H - FEET, (PANEL_X0 - WALL + W / 2) / 2, 0, FEET + (H - FEET) / 2, coll, case, root)
    # The front fascia above the door, closing the case over the chamber's opening.
    top_of_door = CH_Z0 + CH_H + 4
    _box('Oven_fascia', CH_W + WALL, WALL, H - WALL - top_of_door, CH_X0 + CH_W / 2, -D / 2 + WALL / 2,
         top_of_door + (H - WALL - top_of_door) / 2, coll, case, root)
    # The stainless chamber's liner and its wire shelf.
    _box('Oven_liner_back', CH_W, 2.0, CH_H, CH_X0 + CH_W / 2, D / 2 - WALL - 1.0, CH_Z0 + CH_H / 2, coll, liner, root, 0.3)
    _box('Oven_liner_floor', CH_W, D - WALL - DOOR_T, 2.0, CH_X0 + CH_W / 2, (DOOR_T - WALL) / 2, CH_Z0 + 1.0, coll, liner, root, 0.3)
    for i in range(9):
        y = -D / 2 + DOOR_T + 20 + i * (D - DOOR_T - WALL - 40) / 8
        _box(f'Oven_shelf_wire_{i}', CH_W - 8, 2.4, 2.4, CH_X0 + CH_W / 2, y, SHELF_Z, coll, liner, root, 0.8)
    for x in (CH_X0 + 6, CH_X0 + CH_W - 6):
        _box(f'Oven_shelf_rail_{int(x)}', 3.0, D - DOOR_T - WALL - 20, 3.0, x, (DOOR_T - WALL) / 2, SHELF_Z - 2.0, coll, liner, root, 0.8)
    # The door: a steel frame round a window, hinged on the chamber's left edge; closed, it covers the opening.
    door_w = CH_W + WALL
    door_x = CH_X0 - WALL / 2 + door_w / 2
    door_z = CH_Z0 - 4 + (CH_H + 8) / 2
    _box('Oven_door', door_w, DOOR_T, CH_H + 8, door_x, front_y + DOOR_T / 2, door_z, coll, case, root, 3.0)
    _box('Oven_door_window', 160.0, 2.0, 120.0, door_x, front_y - 0.4, door_z + 40.0, coll, M['Display glass'], root, 0.5)
    handle = lathe(rounded([(0, 0), (6.0, 0), (6.0, 90.0), (0, 90.0)], [0, 2.0, 2.0, 0]), segs=24)
    transform_mesh(handle, Matrix.Translation(((door_x + door_w / 2 - 28) * MM, (front_y - 14.0) * MM, (door_z - 45.0) * MM)))
    make_obj('Oven_door_handle', handle, coll, M['Cast clamp chrome'], root)
    # The control panel: a display and a setting dial, with their legends.
    px = (PANEL_X0 + W / 2) / 2
    _box('Oven_panel', W / 2 - PANEL_X0, 4.0, H - FEET - 40, px, front_y - 1.0, FEET + (H - FEET) / 2, coll, dark, root, 1.0)
    _box('Oven_display', 64.0, 1.6, 24.0, px, front_y - 3.6, 330.0, coll, M['Display glass'], root, 0.4)
    dial = lathe(rounded([(0, 0), (18.0, 0), (18.0, 14.0), (0, 14.0)], [0, 1.5, 3.0, 0]), segs=48)
    transform_mesh(dial, Matrix.Rotation(-1.5707963, 4, 'X'))
    transform_mesh(dial, Matrix.Translation((px * MM, (front_y - 3.0) * MM, 250.0 * MM)))
    make_obj('Oven_dial', dial, coll, M['Black phenolic knob'], root)
    pointer = box_mesh('Oven_dial_pointer', 2.4, 1.0, 12.0, bevel=0.3, segs=1)
    transform_mesh(pointer, Matrix.Translation((px * MM, (front_y - 17.6) * MM, 256.0 * MM)))
    make_obj('Oven_dial_pointer', pointer, coll, M['White enamel print'], root, uv='box')
    # Legends on the panel's front face, facing the viewer.
    for name, body, z in (('Oven_legend_set', 'SET', 280.0), ('Oven_legend_temp', 'TEMP', 352.0)):
        legend = text_mesh(body, 4.0, px, z, align='CENTER')
        transform_mesh(legend, Matrix.Translation((0, (front_y - 3.1) * MM, 0)))
        make_obj(name, legend, coll, M['White enamel print'], root, sharp_deg=0)
    for x in (-W / 2 + 30, W / 2 - 30):
        for y in (-D / 2 + 30, D / 2 - 30):
            _box(f'Oven_foot_{int(x)}_{int(y)}', 30.0, 30.0, FEET, x, y, FEET / 2, coll, M['Black rubber'], root, 2.0)
    registry = {
        'footprintMm': {'shape': 'rect', 'width': W, 'depth': D},
        'grip': {'heightMm': H * 0.6},
        'graduations': None,
        'anchors': {'drying-oven-chamber': {'positionMm': [round(CH_X0 + CH_W / 2, 2), -40.0, SHELF_Z + 1.5]}},
        'displays': [{'id': 'main', 'policy': 'oven-setpoint', 'centreMm': [round(px, 2), round(front_y - 4.6, 2), 330.0],
                      'sizeMm': [64.0, 24.0], 'normalMm': [0, -1, 0]}],
        'controls': [
            {'id': 'dial', 'operation': 'set-temperature', 'label': 'SET', 'objects': ['Oven_dial', 'Oven_dial_pointer'],
             'centreMm': [round(px, 2), round(front_y - 10.0, 2), 250.0], 'sizeMm': [36.0, 36.0], 'normalMm': [0, -1, 0]},
            {'id': 'door', 'operation': 'door', 'label': 'Door', 'objects': ['Oven_door', 'Oven_door_window', 'Oven_door_handle'],
             'centreMm': [round(door_x, 2), round(front_y - 2.0, 2), round(door_z, 2)], 'sizeMm': [round(door_w, 2), CH_H], 'normalMm': [0, -1, 0]},
        ],
        # Drawn open (turned out to the left about its hinge) when the runtime records the door open.
        'doors': [{'id': 'door', 'objects': ['Oven_door', 'Oven_door_window', 'Oven_door_handle'],
                   'hingeMm': [round(CH_X0 - WALL / 2, 2), round(front_y, 2)], 'openDeg': 105.0, 'stateKey': 'door'}],
        'states': {},
    }
    return root, registry
