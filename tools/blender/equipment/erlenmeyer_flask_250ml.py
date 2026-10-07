"""`erlenmeyer-flask-250ml`: 250 mL narrow-neck borosilicate Erlenmeyer flask (Pack 2, decided 2026-10-05).

It receives the filtrate under the funnel (Filter a Precipitate), standing on the stand's base with the
funnel's stem against the inside of its neck. 85 mm across the base, 145 mm tall, a 34 mm neck with a
beaded rim. As on a real flask, an approximate white scale is printed on the cone beside the "250 mL"
capacity print (50 to 200 mL in 25 mL steps; decided 2026-10-06). It is for looks only: the registry
claims no graduations, so it is never read as a measurement.
"""
from equipment._fits import ERLENMEYER_250 as F
from equipment._scales import approximate_scale
from labeq.geometry import FRONT, lathe, make_obj, new_root, rounded, set_material_index
from labeq.markings import markings

DEFINITION_ID = 'erlenmeyer-flask-250ml'
THUMB_ELEVATION_DEG = 15

R, H, NO, NI, NH, T, FL = F['base_r'], F['height'], F['neck_od'] / 2, F['neck_id'] / 2, F['neck_h'], F['wall'], F['floor']
SHOULDER = H - NH


def build(coll, M):
    root = new_root('Erlenmeyer_250mL', coll)
    pts = [(0, 0.4), (R - 5.0, 0), (R, 4.0), (NO, SHOULDER), (NO, H - 1.5), (NO + 1.0, H - 0.6), (NI + 0.3, H),
           (NI, H - 1.2), (NI, SHOULDER + 1.0), (R - T, 4.5), (R - T - 5.0, FL), (0, FL)]
    rad = [0, 3.0, 4.0, 8.0, 0.6, 0.8, 0.5, 0.5, 6.0, 3.5, 3.0, 0]
    glass = lathe(rounded(pts, rad), segs=128)
    set_material_index(glass, lambda x, y, z: z > H - 2.0 or z < FL + 0.3)
    make_obj('Erlenmeyer_glass', glass, coll, [M['Borosilicate glass'], M['Borosilicate glass thick']], root)
    inner = [[0.0, FL], [R - T - 5.0, FL], [R - T, 4.5], [NI, SHOULDER + 1.0], [NI, H]]
    markings('Erlenmeyer_print', [('text', '250 mL', 4.5, 0.0, 30.0, 'CENTER')] + approximate_scale(inner, 50, 200),
             lambda z: R - (R - NO) * (z - 4.0) / (SHOULDER - 4.0) + 0.05, FRONT, 0.06, coll, M['White enamel print'], root)
    registry = {
        'footprintMm': {'shape': 'circle', 'radius': R},
        'grip': {'heightMm': SHOULDER - 5.0},
        'pour': {'lipMm': [-(NO + 1.0), 0.0, H], 'tiltDeg': 115.0, 'style': 'pour'},
        'fill': {'innerProfileMm': inner, 'capacityMl': 250, 'meniscus': 'concave'},
        'graduations': None,
        'anchors': {
            'erlenmeyer-stopper-neck': {'positionMm': [0.0, 0.0, H - 12.0]},
            'erlenmeyer-ph-probe-zone': {'positionMm': [0.0, 0.0, H + 10.0]},
        },
        'displays': [],
        'states': {},
    }
    return root, registry
