"""`scoopula`: 210 mm stainless steel scoopula (metal scoop), lying on the bench (Pack 2, decided 2026-10-05).

A flat handle and a long scoop, curved across its width, that breaks a dried cake into small pieces
(FD-16). It lies along the bench's width, scoop to the right; `tipMm` is the scoop's end, which is the
end aimed at the watch glass when it is carried.
"""
import math

import bmesh

from labeq.geometry import MM, Matrix, bm_to_mesh, box_mesh, make_obj, new_root, transform_mesh

DEFINITION_ID = 'scoopula'
THUMB_ELEVATION_DEG = 55

L, W_HANDLE, W_SCOOP, T = 210.0, 12.0, 16.0, 1.2
SCOOP_LEN = 95.0


def build(coll, M):
    root = new_root('Scoopula_210mm', coll)
    handle = box_mesh('Scoopula_handle', L - SCOOP_LEN, W_HANDLE, T, bevel=0.5, segs=2)
    transform_mesh(handle, Matrix.Translation(((-L / 2 + (L - SCOOP_LEN) / 2) * MM, 0, (T / 2 + 2.0) * MM)))
    make_obj('Scoopula_handle', handle, coll, M['Brushed stainless'], root, uv='box')
    # The scoop: a thin sheet curved across its width (a shallow trough), rising a little at its tip.
    bm = bmesh.new()
    nx, ny = 24, 10
    verts = []
    x0 = L / 2 - SCOOP_LEN
    for i in range(nx + 1):
        u = i / nx
        x = x0 + u * SCOOP_LEN
        half = W_SCOOP / 2 * (1.0 if u < 0.85 else 1.0 - (u - 0.85) / 0.15 * 0.45)
        row = []
        for j in range(ny + 1):
            v = j / ny * 2 - 1
            y = v * half
            z = 2.0 + 3.2 * v * v + 2.5 * u * u
            row.append(bm.verts.new((x * MM, y * MM, z * MM)))
        verts.append(row)
    for i in range(nx):
        for j in range(ny):
            bm.faces.new((verts[i][j], verts[i + 1][j], verts[i + 1][j + 1], verts[i][j + 1]))
    bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=T * MM)
    scoop = bm_to_mesh(bm, 'Scoopula_scoop')
    make_obj('Scoopula_scoop', scoop, coll, M['Brushed stainless'], root, uv='box')
    registry = {
        'footprintMm': {'shape': 'rect', 'width': L, 'depth': W_SCOOP},
        'grip': {'heightMm': 4.0},
        'graduations': None,
        'tipMm': [L / 2 - 6.0, 0.0, 4.0],
        'anchors': {},
        'displays': [],
        'states': {},
    }
    return root, registry
