"""`crucible-tongs`: 230 mm steel crucible tongs, lying closed on the bench (Pack 2, decided 2026-10-05).

Two flat stamped steel strips riveted face to face, as scissor-action tongs are made, lying on their
broad faces: one arm on the bench, the other on top of it (refined 2026-10-10; the first model drew them
as round wire). Near their tips the jaws bow apart, about 38 mm across, to close
around a crucible's body (decided 2026-10-06), and their tips meet to pinch a crucible's or a watch
glass's rim. They lie flat along the bench's width, jaws to the right; `tipMm` is the jaws' tip, the end that grips,
so a carried pair is aimed by its jaws (as the spatula is aimed by its spoon).
"""
import math

import bmesh

from labeq.geometry import MM, Matrix, Vector, bm_to_mesh, lathe, make_obj, new_root, transform_mesh

DEFINITION_ID = 'crucible-tongs'
THUMB_ELEVATION_DEG = 55

L = 230.0
PIVOT_X = 50.0          # the rivet, measured from the middle toward the jaws
JAW_X = L / 2
R = 2.4                 # each strip's thickness: the pair stands 2R high (the registry's grip height),
                        # and the jaws' tips meet at R (the registry's tip height)
BAR_W = 7.0             # the strip's width


def _arm(side):
    """One arm: a handle bowed out from the rivet, crossing to the jaw on the other side."""
    s = 1 if side > 0 else -1
    pts = [(-L / 2, s * 14.0), (-L / 2 + 30, s * 12.0), (-20, s * 8.0), (PIVOT_X, 0.0), (PIVOT_X + 12, -s * 6.0),
           (JAW_X - 40, -s * 16.0), (JAW_X - 24, -s * 19.0), (JAW_X - 10, -s * 12.0), (JAW_X - 3, -s * 3.0), (JAW_X, -s * 1.2)]
    return [Vector((x, y, R)) for x, y in pts]


def _smooth(pts, rounds=3):
    """Chaikin corner cutting, keeping the end points, so the bar bends smoothly through the arm's points."""
    for _ in range(rounds):
        out = [pts[0]]
        for a, b in zip(pts, pts[1:]):
            out += [a.lerp(b, 0.25), a.lerp(b, 0.75)]
        out.append(pts[-1])
        pts = out
    return pts


def _flat_bar(name, path, width, height, z0=0.0, edge=0.8):
    """A flat strip `width` x `height` mm with rounded edges, swept along a path in the bench plane from
    z0 to z0 + `height`, its ends closed."""
    hw = width / 2
    c = edge * (1 - math.cos(math.pi / 4))
    section = [(-hw + edge, 0.0), (hw - edge, 0.0), (hw - c, c), (hw, edge), (hw, height - edge), (hw - c, height - c),
               (hw - edge, height), (-hw + edge, height), (-hw + c, height - c), (-hw, height - edge), (-hw, edge), (-hw + c, c)]
    section = [(s, z0 + z) for s, z in section]
    bm = bmesh.new()
    rows = []
    for i, p in enumerate(path):
        a, b = path[max(0, i - 1)], path[min(len(path) - 1, i + 1)]
        d = (b - a).normalized()
        n = Vector((-d.y, d.x, 0.0))
        rows.append([bm.verts.new(((p.x + n.x * s) * MM, (p.y + n.y * s) * MM, z * MM)) for s, z in section])
    k = len(section)
    for r0, r1 in zip(rows, rows[1:]):
        for j in range(k):
            bm.faces.new((r0[j], r0[(j + 1) % k], r1[(j + 1) % k], r1[j]))
    bm.faces.new(list(reversed(rows[0])))
    bm.faces.new(rows[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm_to_mesh(bm, name)


def build(coll, M):
    root = new_root('Crucible_tongs_230mm', coll)
    for side in (1, -1):
        path = _smooth([Vector((p.x, p.y, 0.0)) for p in _arm(side)])
        arm = _flat_bar(f'Tongs_arm_{side}', path, BAR_W, R, z0=R if side > 0 else 0.0)  # arm a lies on arm b
        make_obj(f'Tongs_arm_{"a" if side > 0 else "b"}', arm, coll, M['Brushed stainless'], root, uv='box', sharp_deg=50)
    rivet = lathe([(0, 0), (4.0, 0), (4.0, 2 * R + 1.6), (0, 2 * R + 1.6)], segs=24)
    transform_mesh(rivet, Matrix.Translation((PIVOT_X * MM, 0, -0.8 * MM)))
    make_obj('Tongs_rivet', rivet, coll, M['Cast clamp chrome'], root)
    registry = {
        'footprintMm': {'shape': 'rect', 'width': L, 'depth': 2 * (19.0 + R)},
        'grip': {'heightMm': 2 * R},
        'graduations': None,
        'tipMm': [JAW_X, 0.0, R],
        'anchors': {},
        'displays': [],
        'states': {},
    }
    return root, registry
