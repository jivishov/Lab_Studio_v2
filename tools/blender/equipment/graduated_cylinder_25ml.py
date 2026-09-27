"""`graduated-cylinder-25ml`: 25 mL glass graduated cylinder, 0.5 mL divisions (catalogue: 25 mL, 0.5 mL).

Built as the 100 mL cylinder is: a 21 mm tube (18.4 mm bore) on a hexagonal glass foot, with a
pouring spout. Graduations are placed from the bore's own inner profile: every 0.5 mL, a longer tick
every 1 mL, and a numbered tick every 5 mL from 5 to 25. Only the scale and "mL" are printed; no
tolerance class is claimed.

A filling funnel seats in its mouth (`graduated-cylinder-funnel-seat`, decided 2026-09-26): the
anchor is where the funnel's origin, its stem tip, sits when the cone rests on the rim (_fits.py).
"""
import math

import bmesh

from equipment._fits import CYLINDER_25, funnel_rim_contact_z
from labeq.geometry import FRONT, MM, bm_to_mesh, lathe_bmesh, level_for_volume_mm, make_obj, new_root, rounded, set_material_index
from labeq.markings import markings

DEFINITION_ID = 'graduated-cylinder-25ml'
THUMB_ELEVATION_DEG = 8

R, BORE, TOP = CYLINDER_25['outer_r'], CYLINDER_25['bore_r'], CYLINDER_25['top']
FOOT_H, FLOOR = 5.0, 3.0
FOOT_R = 26.0


def build(coll, M):
    root = new_root('Graduated_cylinder_25mL', coll)
    z_floor = FOOT_H + FLOOR
    pts = [(0, FOOT_H), (R, FOOT_H), (R, TOP - 1.2), (R + 0.5, TOP - 0.2), (BORE + 0.2, TOP + 0.2),
           (BORE, TOP - 1.0), (BORE, z_floor + 1.2), (BORE - 1.2, z_floor), (0, z_floor)]
    rad = [0, 1.6, 0.6, 0.5, 0.5, 0.5, 0.8, 0.8, 0]
    bm = lathe_bmesh(rounded(pts, rad), segs=112)
    for v in bm.verts:  # a pouring spout pulled out of the rim, facing -X, as on the 100 mL cylinder
        z = v.co.z / MM
        if z < TOP - 9:
            continue
        a = math.atan2(v.co.y, v.co.x)
        da = math.atan2(math.sin(a - math.pi), math.cos(a - math.pi))
        w = math.exp(-(da / 0.32) ** 2)
        h = min(1.0, (z - (TOP - 9)) / 9.0) ** 2.2
        r = math.hypot(v.co.x, v.co.y)
        nr = r + 3.5 * MM * w * h
        v.co.x, v.co.y = nr * math.cos(a), nr * math.sin(a)
        v.co.z += 0.9 * MM * w * h
    glass = bm_to_mesh(bm, 'Cylinder_glass')
    set_material_index(glass, lambda x, y, z: z > TOP - 1.5 or z < z_floor + 0.3)
    make_obj('Cylinder_glass', glass, coll, [M['Borosilicate glass'], M['Borosilicate glass thick']], root)

    fb = bmesh.new()
    ring_lo, ring_hi = [], []
    for i in range(6):
        a = math.pi / 6 + i * math.pi / 3
        ring_lo.append(fb.verts.new((FOOT_R * math.cos(a) * MM, FOOT_R * math.sin(a) * MM, 0)))
        ring_hi.append(fb.verts.new((FOOT_R * math.cos(a) * MM, FOOT_R * math.sin(a) * MM, FOOT_H * MM)))
    fb.faces.new(list(reversed(ring_lo)))
    fb.faces.new(ring_hi)
    for i in range(6):
        j = (i + 1) % 6
        fb.faces.new((ring_lo[i], ring_lo[j], ring_hi[j], ring_hi[i]))
    bmesh.ops.bevel(fb, geom=list(fb.edges), offset=1.0 * MM, segments=3, affect='EDGES', clamp_overlap=True)
    make_obj('Cylinder_foot', bm_to_mesh(fb, 'Cylinder_foot'), coll, M['Borosilicate glass thick'], root, uv='box')

    inner = [[0.0, z_floor], [BORE - 1.2, z_floor], [BORE, z_floor + 1.2], [BORE, TOP]]
    pieces = []
    for half in range(1, 51):
        ml = half / 2
        z = level_for_volume_mm(inner, ml)
        if half % 10 == 0:
            pieces.append(('rect', -4.5, 4.5, z - 0.24, z + 0.24, 5))
            pieces.append(('text', str(int(ml)), 2.8, 5.8, z, 'LEFT'))
        elif half % 2 == 0:
            pieces.append(('rect', -3.2, 3.2, z - 0.18, z + 0.18, 3))
        else:
            pieces.append(('rect', -1.8, 1.8, z - 0.15, z + 0.15, 2))
    pieces.append(('text', 'mL', 2.8, 0.0, level_for_volume_mm(inner, 25) + 8.0, 'CENTER'))
    markings('Cylinder_graduations', pieces, lambda z: R, FRONT, 0.06, coll, M['Blue print ink'], root)

    registry = {
        'footprintMm': {'shape': 'circle', 'radius': FOOT_R},
        'grip': {'heightMm': 95.0},
        'pour': {'lipMm': [-(R + 3.5), 0.0, TOP + 0.8], 'tiltDeg': 105.0, 'style': 'pour'},
        'fill': {'innerProfileMm': inner, 'capacityMl': 25, 'meniscus': 'concave'},
        'graduations': {'unit': 'mL', 'minor': 0.5, 'major': 5, 'maxMl': 25},
        'anchors': {'graduated-cylinder-funnel-seat': {'positionMm': [0.0, 0.0, round(TOP - funnel_rim_contact_z(), 3)]}},
        'displays': [],
        'states': {},
    }
    return root, registry
