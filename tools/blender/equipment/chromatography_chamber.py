"""`chromatography-chamber`: a small clear developing chamber with a push-on cap (Pack 3a, decided 2026-10-10).

Investigation 5's materials: "Small (25-50 mL) containers with lids" and "Tape to make labels". A clear glass
tube 30 mm across and 120 mm tall (about 68 mL to the brim; the catalogue's 50 mL is its working capacity), so the
110 mm strip hangs inside, shorter than it. A white polypropylene cap pushes on over the rim; a stainless wire hook
under it holds the strip through a hole punched near the strip's top, with the strip's lower edge 2 mm above the
floor, in the shallow solvent. A blank band of masking tape is wrapped on the front for the trial's label (the
student's writing is drawn from state, never baked in). Nothing is in it: the solvent is drawn from runtime state.

The cap is drawn from the apparatus state (`lid`, `strip`), which the viewer sets from the runtime's
`developingChamberClosed` and the paper slot:
- `closed`: seated on the rim, the hook inside, holding a hung strip in the solvent;
- `open/hung`: held `liftedWithLidMm` above the rim with the strip on its hook, the strip's edge above the solvent
  (hung, about to be lowered, or lifted out after developing); the viewer lifts the seated strip with it;
- `open`: set down upside down beside the chamber, hook up.
The paper slot's anchor is the strip's origin (the centre of its lower edge) as it hangs with the cap seated.
Transparent: the open glass draw-order issue applies (noted, not fixed here).
"""
import math

from equipment._fits import CHROMATOGRAPHY_CHAMBER as C, strip_hole_z
from labeq.geometry import FRONT, MM, Matrix, Vector, curve_tube_mesh, lathe, make_obj, new_root, rounded, set_material_index, transform_mesh
from labeq.markings import markings

DEFINITION_ID = 'chromatography-chamber'
THUMB_ELEVATION_DEG = 14

R, T, H, FLOOR = C['r'], C['wall'], C['height'], C['floor']
BORE = R - T
CAP_R, CAP_TOP, CAP_SKIRT, CAP_WALL = R + 1.5, 1.6, 12.0, 1.2
RAISE = 15.0                       # how far the cap is held above the rim with a strip on its hook
ASIDE_X = R + CAP_R + 5.0          # where the cap is set down, to the chamber's right
TAPE_Z0, TAPE_Z1, TAPE_HALF = 68.0, 86.0, 24.0


def build(coll, M):
    root = new_root('Chromatography_chamber', coll)
    pts = [(0, 0), (R - 2.5, 0), (R, 2.5), (R, H - 2.4), (R + 0.6, H - 1.4), (R + 0.6, H - 0.5), (R - 0.2, H),
           (BORE + 0.2, H), (BORE, H - 1.0), (BORE, FLOOR + 2.0), (BORE - 2.0, FLOOR), (0, FLOOR)]
    rad = [0, 1.6, 1.6, 0.6, 0.4, 0.3, 0.4, 0.4, 0.4, 1.6, 1.6, 0]
    glass = lathe(rounded(pts, rad), segs=96)
    # the beaded, fire-polished rim and the floor are thick glass
    set_material_index(glass, lambda x, y, z: z > H - 2.6 or z < FLOOR + 0.3)
    make_obj('Chamber_glass', glass, coll, [M['Borosilicate glass'], M['Borosilicate glass thick']], root)
    # the blank label tape, wrapped on the front just outside the glass
    markings('Chamber_label_tape', [('rect', -TAPE_HALF, TAPE_HALF, TAPE_Z0, TAPE_Z1, 24)], lambda z: R, FRONT, 0.12,
             coll, M['Masking tape'], root)

    # The push-on cap, its inner top resting on the rim, and the hook's wire hanging from the centre of its underside:
    # down behind the strip, round under the hole and up in front of it.
    cap = [(0, CAP_TOP), (CAP_R - 1.0, CAP_TOP), (CAP_R, CAP_TOP - 1.0), (CAP_R, -CAP_SKIRT + 0.6),
           (CAP_R - 0.5, -CAP_SKIRT), (CAP_R - CAP_WALL, -CAP_SKIRT), (CAP_R - CAP_WALL, 0.0), (0, 0.0)]
    cap_rad = [0, 1.0, 1.0, 0.4, 0.3, 0.3, 0.6, 0]
    hole = strip_hole_z() - H      # relative to the cap's inner top, which sits on the rim
    hook_pts = [Vector(p) for p in ((0.0, 1.6, 0.0), (0.0, 1.6, hole + 2.0), (0.0, 1.1, hole + 0.6), (0.0, 0.0, hole - 0.1),
                                   (0.0, -1.1, hole + 0.6), (0.0, -1.6, hole + 2.0), (0.0, -1.6, hole + 3.5))]
    poses = {
        '': Matrix.Translation((0, 0, H * MM)),
        '_raised': Matrix.Translation((0, 0, (H + RAISE) * MM)),
        # upside down on the bench beside the chamber, the cap's top on the bench
        '_aside': Matrix.Translation((ASIDE_X * MM, 0, CAP_TOP * MM)) @ Matrix.Rotation(math.pi, 4, 'X'),
    }
    for suffix, pose in poses.items():
        me = lathe(rounded(cap, cap_rad, n=5), segs=64, name=f'Chamber_cap{suffix}')
        transform_mesh(me, pose)
        make_obj(f'Chamber_cap{suffix}', me, coll, M['PP cap'], root)
        wire = curve_tube_mesh(f'Chamber_hook{suffix}', hook_pts, C['hook_wire_r'], resolution=3)
        transform_mesh(wire, pose)
        make_obj(f'Chamber_hook{suffix}', wire, coll, M['Brushed stainless'], root, uv='box')

    inner = [[0.0, FLOOR], [BORE - 2.0, FLOOR], [BORE, FLOOR + 2.0], [BORE, H]]
    registry = {
        'footprintMm': {'shape': 'circle', 'radius': R + 0.6},
        'grip': {'heightMm': 55.0},
        'pour': {'lipMm': [-(R - 0.2), 0.0, H], 'tiltDeg': 115.0, 'style': 'pour'},
        'fill': {'innerProfileMm': inner, 'capacityMl': 50, 'meniscus': 'concave'},
        'graduations': None,
        'stateObjects': [
            {'stateKeys': ['lid', 'strip'], 'default': 'open',
             'objects': {'closed': ['Chamber_cap', 'Chamber_hook'],
                         'open/hung': ['Chamber_cap_raised', 'Chamber_hook_raised'],
                         'open': ['Chamber_cap_aside', 'Chamber_hook_aside']}},
        ],
        # The hung strip rides up with the cap while it is held above the rim (`open/hung`).
        'liftedWithLidMm': RAISE,
        'anchors': {'chromatography-chamber-paper-slot': {'positionMm': [0.0, 0.0, FLOOR + C['strip_above_floor']]}},
        'displays': [],
        'states': {},
    }
    return root, registry
