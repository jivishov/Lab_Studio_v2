"""Real dimensions shared between parts that fit together (mm).

A parent's zone anchor is computed from these numbers, never placed by eye, so a seated child
sits where the real part would: a stopper wedges where its taper meets the bore, a funnel's cone
rests on a mouth, a cuvette rests on the slot floor, a vessel stands on the pan.
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

# 25 mL graduated cylinder: bore radius and rim height (its own script builds from these).
CYLINDER_25 = dict(bore_r=9.2, outer_r=10.5, top=150.0)
# 60 degree glass filling funnel: the cone meets the stem at the stem's outer radius. Its origin is
# the stem tip; seated, the cone rests on a mouth (the 25 mL cylinder's rim, the 100 mL volumetric
# flask's neck) where its outer radius equals the bore.
FUNNEL = dict(top_r=27.5, half_angle_deg=30.0, stem_od=7.0, stem_id=5.0, stem_len=45.0, wall=1.4)


def funnel_rim_contact_z(f=FUNNEL, bore_r=CYLINDER_25['bore_r']):
    """Height above the funnel's stem tip where its cone's outer radius equals the bore."""
    import math
    return f['stem_len'] + (bore_r - f['stem_od'] / 2) / math.tan(math.radians(f['half_angle_deg']))


def flask_funnel_seat_depth(f=FUNNEL):
    """How far the funnel's stem tip sits below the volumetric flask's mouth: the cone rests on the
    mouth where its outer radius equals the 14.5 mm bore, and the 7 mm stem hangs free in the neck."""
    return funnel_rim_contact_z(f, bore_r=FLASK_BORE_D / 2)


# Pack 2 (decided 2026-10-05). The support stand: a cast base, a rod at the back, and a 48 mm iron ring
# clamped over the middle of the base, so the ring's axis is the stand's origin (a vessel's fill profile
# and a funnel's cone share it). The ring takes the 55 mm funnel for gravity filtration (its cone
# rests where its outer radius equals the ring's inner radius) and a clay triangle for heating a crucible.
RING_STAND = dict(base_w=130.0, base_d=210.0, base_h=12.0, rod_d=12.7, rod_h=500.0, rod_y=80.0,
                  ring_y=0.0, ring_z=220.0, ring_id=48.0, ring_wire=6.0)
# 250 mL narrow-neck Erlenmeyer flask; its origin is the centre of its base.
ERLENMEYER_250 = dict(base_r=42.5, height=145.0, neck_od=34.0, neck_id=30.0, neck_h=25.0, wall=1.6, floor=2.2)
# 9 cm filter paper, folded in quarters and opened into a 60 degree cone, as the funnel is.
FILTER_PAPER = dict(radius=45.0, thickness=0.2)
# The porcelain crucible: rim and foot radii and height; its origin is the centre of its foot.
CRUCIBLE = dict(r_top=22.5, r_foot=12.5, height=39.0)
# 2 inch pipe-clay triangle: the tube axes' inscribed circle and the tubes' radius. Its tubes cross the
# 48 mm ring and rest on it; its origin is the centre, at the tubes' underside.
CLAY_TRIANGLE = dict(inradius=20.5, tube_r=3.25)


def crucible_foot_below_triangle(c=CRUCIBLE, t=CLAY_TRIANGLE):
    """How far a crucible's foot sits below the clay triangle's origin: its tapered wall touches the
    three tubes at their midpoints, where the tube is the inscribed radius from the axis."""
    import math
    k = (c['r_top'] - c['r_foot']) / c['height']
    tube_axis_above_foot = (t['inradius'] - c['r_foot'] - t['tube_r'] * math.sqrt(1 + k * k)) / k
    return tube_axis_above_foot - t['tube_r']


def ring_funnel_tip_z(stand=RING_STAND, f=FUNNEL):
    """The funnel's stem tip height above the bench when its cone rests in the ring."""
    ring_top = stand['ring_z'] + stand['ring_wire'] / 2 - 1.0
    return ring_top - funnel_rim_contact_z(f, bore_r=stand['ring_id'] / 2)


def funnel_paper_apex_above_tip(f=FUNNEL):
    """Where a filter paper cone's apex sits above the funnel's stem tip: the inner glass surface,
    extrapolated down the cone to the axis (the paper lies against the glass all the way up)."""
    import math
    tan = math.tan(math.radians(f['half_angle_deg']))
    si, ls, w = f['stem_id'] / 2, f['stem_len'], f['wall']
    z_inner_start = ls + w / tan * 0.5
    return z_inner_start - si / tan
