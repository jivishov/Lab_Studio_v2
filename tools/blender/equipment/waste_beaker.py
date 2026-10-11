"""`waste-beaker`: a 250 mL Griffin beaker kept for waste (Pack 3a, decided 2026-10-10).

The organic-waste receiver: the 2-propanol trial's used solvent is poured into it, never down the sink (S-03,
S-04). The `beaker-250ml` model, with "Waste" written on a frosted writing spot to the right of its capacity print.
Only the word: the same definition may receive other waste in later packs, so no stream is named. It claims no
anchors (the working beaker's stirring-rod rest is not a zone this definition owns).
"""
from equipment import beaker_250ml as beaker
from labeq.geometry import FRONT
from labeq.markings import markings

DEFINITION_ID = 'waste-beaker'
THUMB_ELEVATION_DEG = beaker.THUMB_ELEVATION_DEG


def build(coll, M):
    root, registry = beaker.build(coll, M)
    root.name = 'Waste_beaker_250mL'
    radius = lambda z: beaker.R
    markings('Waste_beaker_spot', [('rect', 9.0, 31.0, 30.0, 47.0, 16)], radius, FRONT, 0.06, coll, M['Frosted marking spot'], root)
    markings('Waste_beaker_writing', [('text', 'Waste', 4.4, 20.0, 38.5, 'CENTER')], radius, FRONT, 0.1, coll,
             M['Blue print ink'], root)
    registry['anchors'] = {}
    return root, registry
