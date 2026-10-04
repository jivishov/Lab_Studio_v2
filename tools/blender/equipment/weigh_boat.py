"""`weigh-boat`: medium square antistatic weighing boat in white polystyrene (catalogue: weighing boat).

A thermoformed boat: 89 x 89 mm over its narrow flat rim, a flat 64 x 64 mm base, 25 mm deep, with
a 0.6 mm wall and slightly rounded corners. Every cross-section is a rounded square, a square spine
grown by the corner radius; the inner and outer walls share the spine, so they stay one wall apart
all round, corners included.

It holds only a solid (catalogue contents: empty or solid), so it declares no fill profile, and no
graduations: the catalogue precision, 0.001 g, is a mass precision, not a volume one (decision U9).
Nothing is printed on it. A weighed solid heaps on the flat inner floor (solidRest) and is tipped
out over one corner of the rim (pour), as a powder is tipped from a boat.
"""
import math

import bmesh

from labeq.geometry import MM, bm_to_mesh, make_obj, new_root, rounded

DEFINITION_ID = 'weigh-boat'
THUMB_ELEVATION_DEG = 40  # high enough to look into the hollow

TOP, BASE, DEPTH, T = 44.5, 32.0, 25.0, 0.6  # half-width over the rim, half-width of the base, depth, wall
RIM = 2.5                                     # width of the flat rim outside the wall
RIM_CORNER, BASE_CORNER = 7.0, 4.0            # corner radii of the rim's outline and of the base
NC = 10                                       # segments per corner arc
WALL_TOP, Z_RIM = TOP - RIM, DEPTH - T        # the outer wall meets the rim's underside here
SLOPE = (WALL_TOP - BASE) / Z_RIM             # outward run of the wall per mm of height
INSET = T * math.sqrt(1 + SLOPE * SLOPE)      # the wall's horizontal thickness: T across the slope
K_TOP, K_BASE = TOP - RIM_CORNER, BASE - BASE_CORNER  # half-widths of the square spine


def inner_wall(z):
    return BASE + SLOPE * z - INSET


def profile():
    """(half-width, height) in mm along a section through the middle of a side: out along the
    underside, up the outer wall, over the rim, down the inner wall and in along the floor. A point
    on each floor keeps the floor flat up to its fillet."""
    pts = [(0.0, 0.0), (BASE - 6.0, 0.0), (BASE, 0.0), (WALL_TOP, Z_RIM), (TOP, Z_RIM), (TOP, DEPTH),
           (inner_wall(DEPTH), DEPTH), (inner_wall(T), T), (inner_wall(T) - 5.0, T), (0.0, T)]
    rad = [0, 0, 2.5, 0.8, 0.3, 0.3, 0.8 + T, 2.5 - T, 0, 0]
    return rounded(pts, rad, n=5)


def section(w, z):
    """The rounded square of half-width w at height z, counter-clockwise from +x. A vertex near each
    end of every straight side keeps the flat sides shading flat."""
    k = K_BASE + (K_TOP - K_BASE) * min(1.0, max(0.0, z / Z_RIM))
    c = w - k
    if c < 1.0:  # inside the base fillet the floor is flat, so any small radius will do
        c, k = 1.0, w - 1.0
    out = []
    for q in range(4):
        cx, cy = (k if q in (0, 3) else -k), (k if q in (0, 1) else -k)
        for i in range(NC + 1):
            a = (q + i / NC) * math.pi / 2
            out.append((cx + c * math.cos(a), cy + c * math.sin(a)))
        a = (q + 1) * math.pi / 2
        ex, ey = out[-1]
        for d in (1.5, 2 * k - 1.5):
            out.append((ex - d * math.sin(a), ey + d * math.cos(a)))
    return [(x, y, z) for x, y in out]


def build(coll, M):
    root = new_root('Weighing_boat_medium', coll)
    prof = profile()
    bm = bmesh.new()
    rings = [[bm.verts.new((x * MM, y * MM, z * MM)) for x, y, z in section(w, z)] for w, z in prof[1:-1]]
    under = bm.verts.new((0.0, 0.0, prof[0][1] * MM))
    floor = bm.verts.new((0.0, 0.0, prof[-1][1] * MM))
    n = len(rings[0])
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((under, rings[0][j], rings[0][i]))
        for a, b in zip(rings, rings[1:]):
            bm.faces.new((a[i], a[j], b[j], b[i]))
        bm.faces.new((floor, rings[-1][i], rings[-1][j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    make_obj('Weigh_boat', bm_to_mesh(bm, 'Weigh_boat'), coll, M['Polystyrene antistatic white'], root, uv='box')

    lip = K_TOP + RIM_CORNER * math.sqrt(0.5)  # the rim's outer edge on a diagonal
    registry = {
        'footprintMm': {'shape': 'rect', 'width': 2 * TOP, 'depth': 2 * TOP},
        'grip': {'heightMm': 20.0},
        # a powder is tipped out over a corner of the rim: the front-left one, as the default viewer sees it
        'pour': {'lipMm': [-round(lip, 2), -round(lip, 2), DEPTH], 'tiltDeg': 70.0, 'style': 'pour'},
        'graduations': None,
        'solidRest': {'centreMm': [0.0, 0.0, T], 'radiusMm': 20.0},
        'anchors': {},
        'displays': [],
        'states': {},
    }
    return root, registry
