"""The approximate scale printed on beakers and flasks (decided 2026-10-06), for looks only.

Real beakers and Erlenmeyer flasks carry an approximate white scale beside their capacity print. It is
drawn, never claimed: the registry entry of a vessel that prints one keeps `graduations: None`, so the
viewer never reads a volume from it, and the measuring vessels (cylinders, pipettes) stay the ones read.
Those measuring vessels draw their claimed scales with `graduation_scale` (shared 2026-10-10).
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


def graduation_scale(fill, marks, volume, label, major_every, mid_every, ticks, text_size, text_x):
    """The claimed scale of a measuring vessel (cylinders, pipettes), as `markings` pieces: for each
    mark index in `marks`, a line where the fill profile holds `volume(i)` mL; every `major_every`th
    long and numbered `label(i)`, every `mid_every`th medium, the rest short. `ticks` gives the
    (half length, half height, segments) of the long, medium and short lines."""
    (maj_w, maj_h, maj_n), (mid_w, mid_h, mid_n), (min_w, min_h, min_n) = ticks
    pieces = []
    for i in marks:
        z = level_for_volume_mm(fill, volume(i))
        if i % major_every == 0:
            pieces.append(('rect', -maj_w, maj_w, z - maj_h, z + maj_h, maj_n))
            pieces.append(('text', label(i), text_size, text_x, z, 'LEFT'))
        elif i % mid_every == 0:
            pieces.append(('rect', -mid_w, mid_w, z - mid_h, z + mid_h, mid_n))
        else:
            pieces.append(('rect', -min_w, min_w, z - min_h, z + min_h, min_n))
    return pieces
