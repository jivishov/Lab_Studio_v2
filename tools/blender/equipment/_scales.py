"""The approximate scale printed on beakers and flasks (decided 2026-10-06), for looks only.

Real beakers and Erlenmeyer flasks carry an approximate white scale beside their capacity print. It is
drawn, never claimed: the registry entry of a vessel that prints one keeps `graduations: None`, so the
viewer never reads a volume from it, and the measuring vessels (cylinders, pipettes) stay the ones read.
"""
from labeq.geometry import level_for_volume_mm


def approximate_scale(inner, first_ml, last_ml, step_ml=25, number_every_ml=50):
    """Lines from `first_ml` to `last_ml` every `step_ml`, the ones on `number_every_ml` longer and numbered,
    each where the inner profile holds that volume; laid 16 to 24 mm left of the capacity print's centre
    line, the numbers to their left, as `markings` pieces."""
    pieces = []
    for ml in range(first_ml, last_ml + 1, step_ml):
        z = level_for_volume_mm(inner, ml)
        if ml % number_every_ml == 0:
            pieces.append(('rect', -24.0, -16.0, z - 0.28, z + 0.28, 6))
            pieces.append(('text', str(ml), 3.2, -25.5, z, 'RIGHT'))
        else:
            pieces.append(('rect', -24.0, -19.0, z - 0.22, z + 0.22, 4))
    return pieces
