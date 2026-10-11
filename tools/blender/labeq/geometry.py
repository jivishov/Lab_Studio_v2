"""Profiles, lathes, boxes, UVs and object helpers for real-scale lab equipment.

Ported from the prototype generator (`blender-equipment/build_equipment.py`, plan §12) with the
geometry maths unchanged. Blender units are metres; every public helper takes millimetres.

Model convention (shared with the equipment3d registry, plan §4.3): millimetres, x to the
viewer's right, y away from the default viewer, z up, origin at the centre of the item's
footprint on the bench plane. The default viewer looks from -Y, so a surface facing the viewer
sits at the angle FRONT. glTF export converts to three.js Y-up.
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector

MM = 0.001
TAU = 2 * math.pi
TAN30 = math.tan(math.radians(30))
FRONT = -math.pi / 2  # surface angle facing a camera on -Y
UV_SCALE = 10.0       # 1 UV unit = 10 cm, so viewer textures tile in physical units
# Tessellation by size (decided 2026-10-10): a lathe gets as many segments as keep its largest
# radius within CHORD_TOL of the true circle, and a fillet one point about every FILLET_STEP of
# arc, so small parts are no longer cut as finely as large ones. Positions are unchanged: only
# how finely a curve between the same points is drawn.
CHORD_TOL = 0.03      # mm
FILLET_STEP = 0.25    # mm of arc


def segments_for(radius_mm, asked, angle=TAU, tol=CHORD_TOL):
    """Lathe segments for a sweep of `angle` that keep a circle of `radius_mm` within `tol` mm:
    a multiple of 8, at least 16 for a full turn, never more than `asked`. `tol=0` keeps `asked`."""
    if tol <= 0 or radius_mm <= tol:
        return asked
    full = math.ceil(math.pi / math.acos(1 - tol / radius_mm))
    full = max(16, (full + 7) // 8 * 8)
    n = max(4, math.ceil(full * angle / TAU))
    return min(asked, n)


def rounded(pts, radii, n=8, closed=False, step=FILLET_STEP):
    """Polyline (r, z in mm) with each corner replaced by a quadratic fillet, sampled about every
    `step` mm of arc (2 to `n` intervals); `step=0` gives every fillet `n` intervals."""
    count = len(pts)
    out = []
    for i in range(count):
        edge = not closed and (i == 0 or i == count - 1)
        r = radii[i]
        p1 = Vector(pts[i])
        if edge or r <= 0:
            out.append(tuple(p1))
            continue
        p0 = Vector(pts[i - 1])
        p2 = Vector(pts[(i + 1) % count])
        a, b = p0 - p1, p2 - p1
        t = min(r, a.length * 0.49, b.length * 0.49)
        s = p1 + a.normalized() * t
        e = p1 + b.normalized() * t
        k_n = n
        if step > 0:
            turn = math.pi - a.angle(b) if a.length and b.length else 0.0
            k_n = max(2, min(n, math.ceil(turn * t / step)))
        for k in range(k_n + 1):
            u = k / k_n
            out.append(tuple((1 - u) ** 2 * s + 2 * (1 - u) * u * p1 + u * u * e))
    return out


def lathe_bmesh(prof, segs=192, closed=False, angle=TAU, tol=CHORD_TOL):
    """Profile (r, z in mm) spun about Z. `segs` is the most segments wanted; the count actually
    used follows the largest radius (segments_for), unless `tol=0`."""
    segs = segments_for(max(r for r, z in prof), segs, angle, tol)
    bm = bmesh.new()
    vs = [bm.verts.new((r * MM, 0, z * MM)) for r, z in prof]
    es = [bm.edges.new((vs[i], vs[i + 1])) for i in range(len(vs) - 1)]
    if closed:
        es.append(bm.edges.new((vs[-1], vs[0])))
    full = abs(angle - TAU) < 1e-9
    bmesh.ops.spin(bm, geom=vs + es, cent=(0, 0, 0), axis=(0, 0, 1),
                   dvec=(0, 0, 0), angle=angle, steps=segs, use_merge=full)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    bmesh.ops.dissolve_degenerate(bm, dist=1e-8, edges=bm.edges)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def bm_to_mesh(bm, name):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return me


def lathe(prof, segs=192, closed=False, angle=TAU, name='lathe', tol=CHORD_TOL):
    return bm_to_mesh(lathe_bmesh(prof, segs, closed, angle, tol), name)


def pull_spout(bm, top_z, depth, out, lift, width=0.3, facing=math.pi):
    """Pull a pouring spout out of a lathed rim (the prototype beaker's method): vertices in the top
    `depth` mm move outward by up to `out` mm and up by `lift` mm, most at angle `facing` (default -X),
    falling off over about `width` radians."""
    for v in bm.verts:
        z = v.co.z / MM
        if z < top_z - depth:
            continue
        a = math.atan2(v.co.y, v.co.x)
        da = math.atan2(math.sin(a - facing), math.cos(a - facing))
        wgt = math.exp(-(da / width) ** 2)
        h = min(1.0, (z - (top_z - depth)) / depth) ** 2.2
        r = math.hypot(v.co.x, v.co.y)
        nr = r + out * MM * wgt * h
        v.co.x, v.co.y = nr * math.cos(a), nr * math.sin(a)
        v.co.z += lift * MM * wgt * h


def helix_thread_mesh(name, r_root, depth, z_start, pitch, turns, width, runout=0.3, segs_per_turn=None,
                      start_deg=0.0):
    """A single-start screw thread on a neck of radius `r_root` (mm): a rounded trapezoid ridge
    `depth` mm high and `width` mm wide at its root, rising `pitch` mm a turn from `z_start` for
    `turns` turns, faded in and out over `runout` turns at each end as a moulded or ground thread
    is. The ridge's root sits 0.2 mm inside the neck so it joins it without a gap."""
    if segs_per_turn is None:
        segs_per_turn = segments_for(r_root + depth, 128)
    steps = max(8, int(round(turns * segs_per_turn)))
    # cross-section (radial offset, z offset), from the lower root round the crest to the upper root
    section = [(-0.2, -width / 2), (0.55, -width * 0.36), (1.0, -width * 0.14), (1.0, width * 0.14),
               (0.55, width * 0.36), (-0.2, width / 2)]
    bm = bmesh.new()
    rows = []
    for i in range(steps + 1):
        f = i / steps
        tt = f * turns
        fade = min(1.0, tt / runout, (turns - tt) / runout) if runout > 0 else 1.0
        fade = 0.5 - 0.5 * math.cos(math.pi * max(0.0, fade))
        a = math.radians(start_deg) + tt * TAU
        z0 = z_start + tt * pitch
        row = []
        for dr, dz in section:
            rr = r_root + (dr * depth * fade if dr > 0 else dr)
            zz = z0 + dz * (0.35 + 0.65 * fade)
            row.append(bm.verts.new((rr * math.cos(a) * MM, rr * math.sin(a) * MM, zz * MM)))
        rows.append(row)
    for i in range(steps):
        for j in range(len(section) - 1):
            bm.faces.new((rows[i][j], rows[i + 1][j], rows[i + 1][j + 1], rows[i][j + 1]))
    bm.faces.new(list(reversed(rows[0])))
    bm.faces.new(rows[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm_to_mesh(bm, name)


def cut(me, cutters, name=None):
    """Exact boolean difference: `me` less each mesh in `cutters` (all in the same frame), applied
    at build time, so a plate gets real holes and a deck a real well. The cutter meshes are freed."""
    tmp = bpy.data.objects.new('tmp_cut', me)
    bpy.context.scene.collection.objects.link(tmp)
    tools = []
    for k, c in enumerate(cutters):
        ob = bpy.data.objects.new(f'tmp_cutter_{k}', c)
        bpy.context.scene.collection.objects.link(ob)
        ob.hide_render = True
        tools.append(ob)
        mod = tmp.modifiers.new(f'cut_{k}', 'BOOLEAN')
        mod.operation = 'DIFFERENCE'
        mod.solver = 'EXACT'
        mod.object = ob
    dg = bpy.context.evaluated_depsgraph_get()
    out = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
    out.name = name or me.name
    out.materials.clear()  # the evaluated mesh carries empty slots; make_obj assigns the real ones
    for poly in out.polygons:
        poly.material_index = 0
    bpy.data.objects.remove(tmp)
    bpy.data.meshes.remove(me)
    for ob in tools:
        c = ob.data
        bpy.data.objects.remove(ob)
        bpy.data.meshes.remove(c)
    return out


def cylinder_mesh(name, r, z0, z1, x=0.0, y=0.0, segs=None):
    """A closed cylinder (mm) about a vertical axis at (x, y), for cutters and pins."""
    segs = segs or segments_for(r, 64)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs,
                          radius1=r * MM, radius2=r * MM, depth=(z1 - z0) * MM)
    bmesh.ops.translate(bm, vec=(x * MM, y * MM, (z0 + z1) / 2 * MM), verts=bm.verts)
    return bm_to_mesh(bm, name)


def box_mesh(name, sx, sy, sz, bevel=0.0, segs=4, chamfer=0.0):
    """Box centred on the origin; `chamfer` cuts a flat bevel round the top face first, as on
    a cast base, then `bevel` softens every edge."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(sx * MM, sy * MM, sz * MM), verts=bm.verts)
    if chamfer > 0:
        top = [e for e in bm.edges if all(v.co.z > sz * MM / 2 - 1e-7 for v in e.verts)]
        bmesh.ops.bevel(bm, geom=top, offset=chamfer * MM, offset_type='OFFSET',
                        profile_type='SUPERELLIPSE', segments=1, profile=0.5,
                        affect='EDGES', clamp_overlap=True)
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel * MM, offset_type='OFFSET',
                        profile_type='SUPERELLIPSE', segments=segs, profile=0.5,
                        affect='EDGES', clamp_overlap=True)
    return bm_to_mesh(bm, name)


def transform_mesh(me, mat):
    me.transform(mat)
    me.update()


def add_uvs(me, mode='cyl'):
    """Physical-unit UVs for surface textures (brushing, powder coat, paper fibre).
    'cyl': arc length round the Z axis by height, with the seam at the back (+Y) and planar
    mapping on near-horizontal faces. 'box': projection on each face's dominant axis."""
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.normal_update()
    uv = bm.loops.layers.uv.verify()
    s = UV_SCALE
    for f in bm.faces:
        n = f.normal
        if mode == 'box' or abs(n.z) > 0.75:
            ax = max(range(3), key=lambda i: abs(n[i])) if mode == 'box' else 2
            i, j = [(1, 2), (0, 2), (0, 1)][ax]
            for lp in f.loops:
                lp[uv].uv = (lp.vert.co[i] * s, lp.vert.co[j] * s)
            continue
        c = f.calc_center_median()
        ac = math.atan2(c.x, -c.y)
        for lp in f.loops:
            co = lp.vert.co
            a = math.atan2(co.x, -co.y)
            a = ac + math.atan2(math.sin(a - ac), math.cos(a - ac))
            lp[uv].uv = (a * math.hypot(co.x, co.y) * s, co.z * s)
    bm.to_mesh(me)
    bm.free()


def set_material_index(me, pred, index=1):
    """Assign material slot `index` to faces whose centre (x, y, z in mm) satisfies pred."""
    for poly in me.polygons:
        c = poly.center / MM
        if pred(c.x, c.y, c.z):
            poly.material_index = index


def make_obj(name, me, coll, mat=None, parent=None, sharp_deg=38, loc=(0, 0, 0), uv='cyl'):
    if uv:
        add_uvs(me, uv)
    for m in (mat if isinstance(mat, (list, tuple)) else [mat]):
        if m is not None:
            me.materials.append(m)
    me.name = name  # glTF primitives take the mesh name
    me.shade_smooth()
    if sharp_deg:
        me.set_sharp_from_angle(angle=math.radians(sharp_deg))
    ob = bpy.data.objects.new(name, me)
    ob.location = [c * MM for c in loc]
    coll.objects.link(ob)
    if parent is not None:
        ob.parent = parent
    return ob


def new_root(name, coll):
    root = bpy.data.objects.new(name, None)
    root.empty_display_type = 'PLAIN_AXES'
    root.empty_display_size = 0.05
    coll.objects.link(root)
    return root


def curve_tube_mesh(name, pts_mm, radius_mm, tip_taper=None, resolution=6):
    """Round tube swept along a polyline (mm). `tip_taper` maps point index -> radius factor."""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius_mm * MM
    cu.bevel_resolution = resolution
    cu.use_fill_caps = True
    sp = cu.splines.new('POLY')
    sp.points.add(len(pts_mm) - 1)
    for i, p in enumerate(pts_mm):
        sp.points[i].co = (p.x * MM, p.y * MM, p.z * MM, 1)
        sp.points[i].radius = (tip_taper or {}).get(i, 1.0)
    tmp = bpy.data.objects.new('tmp_' + name, cu)
    bpy.context.scene.collection.objects.link(tmp)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
    bpy.data.objects.remove(tmp)
    bpy.data.curves.remove(cu)
    return me


# ---------------------------------------------------------------- profile measures

def profile_volume_ml(inner_profile_mm):
    """Volume (mL) enclosed by an inner surface-of-revolution profile [(r, z), ...] in mm, with
    z increasing, integrated as conical frusta between consecutive points."""
    vol = 0.0
    for (r0, z0), (r1, z1) in zip(inner_profile_mm, inner_profile_mm[1:]):
        h = z1 - z0
        if h > 0:
            vol += math.pi * h * (r0 * r0 + r0 * r1 + r1 * r1) / 3.0
    return vol / 1000.0


def level_for_volume_mm(inner_profile_mm, ml):
    """Height (mm) at which the inner profile holds `ml`; None if it cannot."""
    target = ml * 1000.0
    vol = 0.0
    for (r0, z0), (r1, z1) in zip(inner_profile_mm, inner_profile_mm[1:]):
        h = z1 - z0
        if h <= 0:
            continue
        seg = math.pi * h * (r0 * r0 + r0 * r1 + r1 * r1) / 3.0
        if vol + seg >= target:
            lo, hi = 0.0, h
            for _ in range(60):
                mid = (lo + hi) / 2
                rm = r0 + (r1 - r0) * mid / h
                part = math.pi * mid * (r0 * r0 + r0 * rm + rm * rm) / 3.0
                lo, hi = (mid, hi) if vol + part < target else (lo, mid)
            return z0 + lo
        vol += seg
    return None


def bounds_mm(objs):
    lo = Vector((1e9, 1e9, 1e9))
    hi = -lo
    for ob in objs:
        if ob.type != 'MESH':
            continue
        for c in ob.bound_box:
            w = ob.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, w))
            hi = Vector(map(max, hi, w))
    return [round(v / MM, 2) for v in lo], [round(v / MM, 2) for v in hi]


__all__ = [
    'MM', 'TAU', 'TAN30', 'FRONT', 'UV_SCALE', 'CHORD_TOL', 'FILLET_STEP', 'Matrix', 'Vector',
    'segments_for', 'rounded', 'lathe_bmesh', 'bm_to_mesh', 'lathe', 'pull_spout', 'helix_thread_mesh',
    'cut', 'cylinder_mesh', 'box_mesh', 'transform_mesh', 'add_uvs', 'set_material_index',
    'make_obj', 'new_root', 'curve_tube_mesh', 'profile_volume_ml', 'level_for_volume_mm',
    'bounds_mm',
]
