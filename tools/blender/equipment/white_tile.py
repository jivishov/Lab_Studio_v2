"""`white-tile`: visual-only bench scenery (decision D9), not a catalogue definition.

A white glazed ceramic tile, 150 x 150 x 6 mm, its edges rounded (decided 2026-10-11): the clean, flat surface a
chromatography strip lies on while it is marked, spotted, dried and measured, kept off the bench top. The runtime has
no tile, so the viewer draws one under a strip lying on the bench, and leaves it where the strip lay while the strip
hangs in its chamber; it is never an equipment instance, never selectable, never listed, and Examine labels it
"Scenery" (handoff G-8). The origin is the centre of its underside; the strip lies on its top face (`sceneryFor`).
"""
from labeq.geometry import MM, Matrix, box_mesh, make_obj, new_root, transform_mesh

DEFINITION_ID = 'white-tile'
SCENERY = True
THUMB_ELEVATION_DEG = 35

SIDE, THICK = 150.0, 6.0


def build(coll, M):
    root = new_root('White_tile', coll)
    tile = box_mesh('Tile_body', SIDE, SIDE, THICK, bevel=1.2, segs=3)
    transform_mesh(tile, Matrix.Translation((0, 0, THICK / 2 * MM)))
    make_obj('Tile_body', tile, coll, M['Glazed tile white'], root, uv='box', sharp_deg=50)
    registry = {
        'footprintMm': {'shape': 'rect', 'width': SIDE, 'depth': SIDE},
        'grip': {'heightMm': THICK},
        'graduations': None,
        'sceneryFor': {'definitionId': 'chromatography-paper', 'seatsMm': [[0.0, 0.0, THICK]]},
        'anchors': {},
        'displays': [],
        'states': {},
    }
    return root, registry
