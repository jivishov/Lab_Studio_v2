"""Enamel and ink markings wrapped onto curved surfaces (graduations, capacity prints, frosted
writing spots). Ported from the prototype generator with the maths unchanged.

Baked text uses Inter, loaded explicitly from Blender's own datafiles, instead of Blender's
anonymous built-in font, so every asset can record the font and its licence (plan §6.3).
"""
import os

import bmesh
import bpy

from .geometry import MM, bm_to_mesh, make_obj

MARKING_FONT = {
    'family': 'Inter',
    'file': 'datafiles/fonts/Inter.woff2 (shipped with Blender)',
    'licence': 'SIL Open Font License 1.1 (Blender license/license.md, Fonts)',
}
_font = None


def marking_font():
    global _font
    try:
        cached = _font is not None and _font.name in bpy.data.fonts
    except ReferenceError:  # freed by a factory reset between items
        cached = False
    if not cached:
        path = os.path.join(bpy.utils.system_resource('DATAFILES'), 'fonts', 'Inter.woff2')
        if not os.path.exists(path):
            raise RuntimeError(f'Marking font not found: {path}')
        _font = bpy.data.fonts.load(path, check_existing=True)
    return _font


def text_mesh(body, size_mm, x_mm, z_mm, align='LEFT'):
    """Text laid out in the XZ plane (x right, z up), in metres."""
    cu = bpy.data.curves.new('tmp_text', 'FONT')
    cu.body = body
    cu.font = marking_font()
    cu.size = size_mm * MM
    cu.align_x = align
    cu.align_y = 'CENTER'
    ob = bpy.data.objects.new('tmp_text', cu)
    bpy.context.scene.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob)
    bpy.data.curves.remove(cu)
    for v in me.vertices:
        v.co = (v.co.x + x_mm * MM, 0.0, v.co.y + z_mm * MM)
    return me


def add_rect(bm, x0, x1, z0, z1, nx=10):
    """Flat strip in the XZ plane (mm in, metres out), subdivided along x for wrapping."""
    row0, row1 = [], []
    for i in range(nx + 1):
        x = (x0 + (x1 - x0) * i / nx) * MM
        row0.append(bm.verts.new((x, 0, z0 * MM)))
        row1.append(bm.verts.new((x, 0, z1 * MM)))
    for i in range(nx):
        bm.faces.new((row0[i], row0[i + 1], row1[i + 1], row1[i]))


def wrap_on_surface(me, radius_at_z, phi, offset_mm):
    """Bend an XZ-plane mesh around the Z axis onto a surface of revolution."""
    import math
    for v in me.vertices:
        x, z = v.co.x, v.co.z
        r = radius_at_z(z / MM) * MM + offset_mm * MM
        a = phi + x / r
        v.co = (r * math.cos(a), r * math.sin(a), z)
    me.update()


def markings(name, pieces, radius_at_z, phi, offset_mm, coll, mat, parent):
    """pieces: list of ('rect', x0, x1, z0, z1[, nx]) or ('text', body, size, x, z, align)."""
    bm = bmesh.new()
    for p in pieces:
        if p[0] == 'rect':
            add_rect(bm, *p[1:])
        else:
            tm = text_mesh(*p[1:])
            bm.from_mesh(tm)
            bpy.data.meshes.remove(tm)
    me = bm_to_mesh(bm, name)
    wrap_on_surface(me, radius_at_z, phi, offset_mm)
    return make_obj(name, me, coll, mat, parent, sharp_deg=0)
