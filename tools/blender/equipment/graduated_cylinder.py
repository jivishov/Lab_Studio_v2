"""`graduated-cylinder`: 100 mL glass graduated cylinder, 1 mL divisions (catalogue: 100 mL, 1 mL).

A 30 mm tube (26.8 mm bore) on a hexagonal glass foot, with a pouring spout. Graduations are
placed from the bore's own inner profile: every 1 mL, a longer tick every 5 mL, and a numbered
tick every 10 mL from 10 to 100. The catalogue precision (1 mL, a volume unit) sets the minor step,
as the validator checks. Only the scale and "mL" are printed; no tolerance class is claimed.
"""
import math

import bmesh

from labeq.geometry import FRONT, MM, bm_to_mesh, lathe_bmesh, level_for_volume_mm, make_obj, new_root, rounded, set_material_index
from labeq.markings import markings

DEFINITION_ID = 'graduated-cylinder'
THUMB_ELEVATION_DEG = 8

R, T, FOOT_H, FLOOR, TOP = 15.0, 1.6, 6.0, 3.0, 212.0
BORE = R - T
FOOT_R = 38.0


def build(coll, M):
    root = new_root('Graduated_cylinder_100mL', coll)
    z_floor = FOOT_H + FLOOR
    pts = [(0, FOOT_H), (R, FOOT_H), (R, TOP - 1.2), (R + 0.6, TOP - 0.2), (BORE + 0.2, TOP + 0.2),
           (BORE, TOP - 1.0), (BORE, z_floor + 1.5), (BORE - 1.5, z_floor), (0, z_floor)]
    rad = [0, 2.0, 0.8, 0.6, 0.6, 0.6, 1.0, 1.0, 0]
    bm = lathe_bmesh(rounded(pts, rad), segs=128)
    for v in bm.verts:  # pull a pouring spout out of the rim, facing -X (the prototype beaker's method)
        z = v.co.z / MM
        if z < TOP - 12:
            continue
        a = math.atan2(v.co.y, v.co.x)
        da = math.atan2(math.sin(a - math.pi), math.cos(a - math.pi))
        w = math.exp(-(da / 0.32) ** 2)
        h = min(1.0, (z - (TOP - 12)) / 12.0) ** 2.2
        r = math.hypot(v.co.x, v.co.y)
        nr = r + 5.0 * MM * w * h
        v.co.x, v.co.y = nr * math.cos(a), nr * math.sin(a)
        v.co.z += 1.2 * MM * w * h
    glass = bm_to_mesh(bm, 'Cylinder_glass')
    set_material_index(glass, lambda x, y, z: z > TOP - 1.5 or z < z_floor + 0.3)
    make_obj('Cylinder_glass', glass, coll, [M['Borosilicate glass'], M['Borosilicate glass thick']], root)

    # hexagonal foot, 6 mm thick, rounded edges
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
    bmesh.ops.bevel(fb, geom=list(fb.edges), offset=1.2 * MM, segments=3, affect='EDGES', clamp_overlap=True)
    make_obj('Cylinder_foot', bm_to_mesh(fb, 'Cylinder_foot'), coll, M['Borosilicate glass thick'], root, uv='box')

    inner = [[0.0, z_floor], [BORE - 1.5, z_floor], [BORE, z_floor + 1.5], [BORE, TOP]]
    pieces = []
    for ml in range(1, 101):
        z = level_for_volume_mm(inner, ml)
        if ml % 10 == 0:
            pieces.append(('rect', -6.0, 6.0, z - 0.28, z + 0.28, 6))
            pieces.append(('text', str(ml), 3.4, 7.5, z, 'LEFT'))
        elif ml % 5 == 0:
            pieces.append(('rect', -4.5, 4.5, z - 0.22, z + 0.22, 4))
        else:
            pieces.append(('rect', -2.5, 2.5, z - 0.18, z + 0.18, 2))
    pieces.append(('text', 'mL', 3.4, 0.0, level_for_volume_mm(inner, 100) + 9.0, 'CENTER'))
    markings('Cylinder_graduations', pieces, lambda z: R, FRONT, 0.06, coll, M['Blue print ink'], root)

    registry = {
        'footprintMm': {'shape': 'circle', 'radius': FOOT_R},
        'grip': {'heightMm': 130.0},
        'pour': {'lipMm': [-(R + 5.0), 0.0, TOP + 1.0], 'tiltDeg': 105.0, 'style': 'pour'},
        'fill': {'innerProfileMm': inner, 'capacityMl': 100, 'meniscus': 'concave'},
        'graduations': {'unit': 'mL', 'minor': 1, 'major': 10, 'maxMl': 100},
        'anchors': {},
        'displays': [],
        'states': {},
    }
    return root, registry
