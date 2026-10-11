"""`chromatography-paper`: a strip of chromatography paper, 15 x 110 mm (Pack 3a, decided 2026-10-10).

Cut to size before the lab (cutting is not a student step), with a hole punched 5 mm below its top for the hook
under the chamber's cap. Modelled upright, as it hangs in the chamber, with its origin at the centre of its lower
edge and its face toward the viewer (-Y); off the hook it lies flat on the bench, face up, its lower edge nearest
the student (`benchRest`). Nothing is printed on it: the pencil baseline, the spots, the rising solvent front, the
bands and the front mark are drawn by the viewer from the runtime's chromatogram state, on the face that
`stripFace` describes (its width, length and thickness, the face's outward normal, and the hole). The bands come
from the prepared values, never baked in. Wet paper darkens (`wetLook`).
"""
import math

from equipment._fits import CHROMATOGRAPHY_STRIP as S
from labeq.geometry import MM, Matrix, box_mesh, cut, cylinder_mesh, make_obj, new_root, transform_mesh

DEFINITION_ID = 'chromatography-paper'
THUMB_ELEVATION_DEG = 20

W, L, T = S['width'], S['length'], S['thickness']
HOLE_Z = L - S['hole_below_top']


def build(coll, M):
    root = new_root('Chromatography_strip', coll)
    strip = box_mesh('Strip_paper', W, T, L)
    transform_mesh(strip, Matrix.Translation((0, 0, L / 2 * MM)))
    punch = cylinder_mesh('Strip_punch', S['hole_r'], -1.0, 1.0, segs=24)
    transform_mesh(punch, Matrix.Translation((0, 0, HOLE_Z * MM)) @ Matrix.Rotation(math.pi / 2, 4, 'X'))
    strip = cut(strip, [punch], 'Strip_paper')
    make_obj('Strip_paper', strip, coll, M['Filter paper'], root, sharp_deg=60, uv='box')
    registry = {
        'footprintMm': {'shape': 'rect', 'width': W, 'depth': L},
        'grip': {'heightMm': L - 12.0},
        'graduations': None,
        'benchRest': {'rollDeg': -90.0, 'liftMm': T / 2, 'shiftMm': [0.0, -L / 2]},
        'stripFace': {'widthMm': W, 'lengthMm': L, 'thicknessMm': T, 'normalMm': [0.0, -1.0, 0.0],
                      'hole': {'centreZMm': HOLE_Z, 'radiusMm': S['hole_r']}},
        'wetLook': True,
        'anchors': {},
        'displays': [],
        'states': {},
    }
    return root, registry
