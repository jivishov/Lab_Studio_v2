"""Real dimensions shared between parts that fit together (mm).

A parent's zone anchor is computed from these numbers, never placed by eye, so a seated child
sits where the real part would: a stopper wedges where its taper meets the bore, a cuvette rests
on the slot floor, a vessel stands on the pan.
"""

# #0 rubber stopper: small end 13 mm, large end 17 mm, 25 mm long. Its origin is the centre of
# the small end, which is the end that enters a neck.
STOPPER = dict(small_d=13.0, large_d=17.0, height=25.0)

# 100 mL volumetric flask neck bore at the mouth (NS 14/23 size), and the neck top height.
FLASK_BORE_D = 14.5
FLASK_NECK_TOP_Z = 170.0


def stopper_seat_depth(bore_d=FLASK_BORE_D, s=STOPPER):
    """How far the stopper's small end sits below the mouth: where its diameter equals the bore."""
    return s['height'] * (bore_d - s['small_d']) / (s['large_d'] - s['small_d'])


# Standard macro cuvette: 12.5 mm square, 45 mm tall, 10 mm light path, 1.5 mm floor.
CUVETTE = dict(outer=12.5, height=45.0, inner=10.0, floor=1.5)
# Spectrophotometer sample well: clearance round the cuvette, and its depth below the deck.
CUVETTE_WELL = dict(side=12.9, depth=30.0)

# 16 x 150 mm test tube with a round bottom; its origin is the lowest point of the bottom.
TEST_TUBE = dict(od=16.0, length=150.0, wall=1.2)
