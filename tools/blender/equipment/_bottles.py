"""Parametric borosilicate laboratory bottle with a threaded GL neck, shown uncapped.

Used by reagent-bottle (wide neck, 250 mL), sample-bottle (125 mL) and sample-bottle-1l (1000 mL):
the same real object at three sizes (plan §6.1, "parametric where only sizes differ").

Bottles are shown open. The runtime has no closure state for these definitions, and their
Pack 1 roles (a pour source, or the solid poured in dissolve) need an open mouth, so a cap would
show a state the runtime does not have. Only the capacity is printed: the same definitions hold
different reagents in different techniques, so a contents label would be false for some.
"""
import math

from labeq.geometry import FRONT, lathe, make_obj, new_root, rounded, set_material_index
from labeq.markings import markings


def build_lab_bottle(coll, M, spec):
    """spec: name, R (body radius), H (body height to shoulder start), shoulder (height of the
    shoulder), neck_r (outer), neck_h, wall, floor, capacity_ml, print."""
    R, H, sh, nr, nh = spec['R'], spec['H'], spec['shoulder'], spec['neck_r'], spec['neck_h']
    t, fl = spec['wall'], spec['floor']
    top = H + sh + nh
    root = new_root(spec['name'], coll)
    # outer wall up, fire-polished lip, inner wall down
    pts = [(0, 0.4), (R - 4, 0), (R, 2.5), (R, H), (nr, H + sh), (nr, top - 1.2), (nr - 0.4, top),
           (nr - t + 0.2, top), (nr - t, top - 1.0), (nr - t, H + sh + 0.8), (R - t, H + 1.2),
           (R - t, fl + 2.0), (R - t - 3.0, fl), (0, fl)]
    rad = [0, 2.5, 3.0, spec.get('shoulder_fillet', 10.0), 4.0, 0.6, 0.5, 0.5, 0.6, 3.5,
           spec.get('shoulder_fillet', 10.0) - 1.5, 2.5, 2.0, 0]
    glass = lathe(rounded(pts, rad), segs=spec.get('segs', 160))
    set_material_index(glass, lambda x, y, z: z > top - 1.5 or z < fl + 0.3)
    make_obj(spec['name'] + '_glass', glass, coll, [M['Borosilicate glass'], M['Borosilicate glass thick']], root)
    # GL thread: three turns approximated as raised rings (a helix reads the same at bench scale)
    turns = spec.get('thread_turns', 3)
    for k in range(turns):
        z0 = top - 3.0 - k * spec.get('thread_pitch', 4.0)
        ring = lathe(rounded([(nr - 0.2, z0 - 1.0), (nr + 1.1, z0 - 0.4), (nr + 1.1, z0 + 0.4), (nr - 0.2, z0 + 1.0)],
                             [0, 0.4, 0.4, 0]), segs=spec.get('segs', 160) // 2)
        make_obj(f'{spec["name"]}_thread_{k}', ring, coll, M['Borosilicate glass thick'], root)
    # capacity print and a frosted writing spot, in white enamel as on real bottles
    body_r = lambda z: R
    markings(spec['name'] + '_print', [('text', spec['print'], spec.get('print_size', 5.0), 0.0, H * 0.72, 'CENTER')],
             body_r, FRONT, 0.1, coll, M['White enamel print'], root)
    markings(spec['name'] + '_spot', [('rect', -R * 0.28, R * 0.28, H * 0.3, H * 0.52, 20)],
             body_r, FRONT, 0.08, coll, M['Frosted marking spot'], root)

    inner = [[0.0, fl], [R - t - 3.0, fl], [R - t, fl + 2.0], [R - t, H + 1.2], [nr - t, H + sh + 0.8], [nr - t, top]]
    lip = [-(nr - 0.2), 0.0, top]
    registry = {
        'footprintMm': {'shape': 'circle', 'radius': R},
        'grip': {'heightMm': round(H * 0.55, 1)},
        'pour': {'lipMm': lip, 'tiltDeg': spec.get('pour_tilt', 105.0), 'style': 'pour'},
        'fill': {'innerProfileMm': inner, 'capacityMl': spec['capacity_ml'], 'meniscus': 'concave'},
        'graduations': None,
        'solidRest': {'centreMm': [0.0, 0.0, fl], 'radiusMm': round((R - t) * 0.8, 1)},
        'anchors': {},
        'displays': [],
        'states': {'closure': 'open'},
    }
    return root, registry, inner


def check_capacity(inner, capacity_ml):
    vol = 0.0
    for (r0, z0), (r1, z1) in zip(inner, inner[1:]):
        h = z1 - z0
        if h > 0:
            vol += math.pi * h * (r0 * r0 + r0 * r1 + r1 * r1) / 3.0
    if vol / 1000.0 < capacity_ml:
        raise ValueError(f'bottle holds {vol / 1000.0:.1f} mL, below {capacity_ml} mL')
