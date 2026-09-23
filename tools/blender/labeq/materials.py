"""Principled materials for equipment models, ported from the prototype generator.

Names are the contract with the viewer: `src/studio3d/equipment3d/viewerMaterials.json` lists
every allowed name with its role, and `material()` refuses a name that is not listed. The
prototype's liquid materials (water, bottle water, suspension) are not carried over, because
contents are drawn from runtime state, never baked into a model (plan §4.4, handoff G-3).
"""
import json
import os

import bpy

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
VIEWER_MATERIALS_PATH = os.path.join(REPO, 'src', 'studio3d', 'equipment3d', 'viewerMaterials.json')


def viewer_material_names():
    with open(VIEWER_MATERIALS_PATH, encoding='utf-8') as fh:
        return set(json.load(fh)['materials'])


def principled(name, **inputs):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    for key, val in inputs.items():
        bsdf.inputs[key].default_value = val
    return mat


def add_noise(mat, target, scale=(300, 300, 300), lo=0.1, hi=0.3, detail=6.0, bump=0.0):
    """Drive a Principled input (or bump) with object-space noise for surface breakup."""
    nt = mat.node_tree
    bsdf = nt.nodes['Principled BSDF']
    coord = nt.nodes.new('ShaderNodeTexCoord')
    mapping = nt.nodes.new('ShaderNodeMapping')
    mapping.inputs['Scale'].default_value = scale
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 1.0
    noise.inputs['Detail'].default_value = detail
    nt.links.new(coord.outputs['Object'], mapping.inputs['Vector'])
    nt.links.new(mapping.outputs['Vector'], noise.inputs['Vector'])
    if target == 'Normal':
        b = nt.nodes.new('ShaderNodeBump')
        b.inputs['Strength'].default_value = bump
        b.inputs['Distance'].default_value = 0.0002
        nt.links.new(noise.outputs['Fac'], b.inputs['Height'])
        nt.links.new(b.outputs['Normal'], bsdf.inputs['Normal'])
    else:
        ramp = nt.nodes.new('ShaderNodeMapRange')
        ramp.inputs['To Min'].default_value = lo
        ramp.inputs['To Max'].default_value = hi
        nt.links.new(noise.outputs['Fac'], ramp.inputs['Value'])
        nt.links.new(ramp.outputs['Result'], bsdf.inputs[target])


def _glass(name, base):
    return principled(name, **{'Base Color': base, 'Roughness': 0.0, 'IOR': 1.473,
                               'Transmission Weight': 1.0})


def _steel(name):
    m = principled(name, **{'Base Color': (0.78, 0.78, 0.77, 1), 'Metallic': 1.0, 'Roughness': 0.2,
                            'Anisotropic': 0.5})
    add_noise(m, 'Roughness', scale=(900, 900, 6), lo=0.12, hi=0.3)
    return m


def _zinc(name):
    m = principled(name, **{'Base Color': (0.72, 0.72, 0.72, 1), 'Metallic': 1.0, 'Roughness': 0.28})
    add_noise(m, 'Normal', scale=(1500, 1500, 1500), bump=0.08)
    return m


def _powder(name):
    m = principled(name, **{'Base Color': (0.012, 0.012, 0.013, 1), 'Roughness': 0.58,
                            'Specular IOR Level': 0.35})
    add_noise(m, 'Normal', scale=(2200, 2200, 2200), bump=0.12)
    return m


def _ldpe(name):
    m = principled(name, **{'Base Color': (0.84, 0.845, 0.83, 1), 'Roughness': 0.36,
                            'Subsurface Weight': 1.0, 'Subsurface Radius': (1.0, 0.95, 0.85),
                            'Subsurface Scale': 0.005, 'Specular IOR Level': 0.45})
    add_noise(m, 'Roughness', scale=(250, 250, 250), lo=0.3, hi=0.42)
    return m


def _paper(name):
    m = principled(name, **{'Base Color': (0.93, 0.93, 0.91, 1), 'Roughness': 0.92,
                            'Subsurface Weight': 0.35, 'Subsurface Scale': 0.001, 'Sheen Weight': 0.3})
    add_noise(m, 'Normal', scale=(3000, 3000, 3000), bump=0.25)
    return m


def _housing_light(name):
    m = principled(name, **{'Base Color': (0.8, 0.805, 0.8, 1), 'Roughness': 0.38, 'Specular IOR Level': 0.45})
    add_noise(m, 'Normal', scale=(1800, 1800, 1800), bump=0.05)
    return m


# name -> factory; the prototype's values are unchanged
_FACTORIES = {
    'Borosilicate glass': lambda n: _glass(n, (0.985, 0.995, 0.99, 1)),
    # rims, bases and stems: the same glass in a separate slot, so the viewer can give it the
    # thickness and edge tint of thick borosilicate
    'Borosilicate glass thick': lambda n: _glass(n, (0.955, 0.985, 0.975, 1)),
    'Frosted marking spot': lambda n: principled(n, **{'Base Color': (0.86, 0.86, 0.84, 1), 'Roughness': 0.9}),
    'Blue print ink': lambda n: principled(n, **{'Base Color': (0.03, 0.12, 0.42, 1), 'Roughness': 0.5}),
    'White enamel print': lambda n: principled(n, **{'Base Color': (0.92, 0.92, 0.9, 1), 'Roughness': 0.45,
                                                     'Subsurface Weight': 0.3, 'Subsurface Scale': 0.0003}),
    'Brushed stainless': _steel,
    'Cast clamp chrome': _zinc,
    'Black powder coat': _powder,
    'Black rubber': lambda n: principled(n, **{'Base Color': (0.012, 0.012, 0.012, 1), 'Roughness': 0.75}),
    'Black phenolic knob': lambda n: principled(n, **{'Base Color': (0.01, 0.01, 0.012, 1), 'Roughness': 0.28}),
    'LDPE natural': _ldpe,
    'PP cap': lambda n: principled(n, **{'Base Color': (0.95, 0.95, 0.94, 1), 'Roughness': 0.3,
                                         'Subsurface Weight': 0.8, 'Subsurface Scale': 0.004}),
    'LDPE delivery tube': lambda n: principled(n, **{'Base Color': (0.95, 0.95, 0.93, 1), 'Roughness': 0.25,
                                                     'Transmission Weight': 0.55, 'Subsurface Weight': 0.6,
                                                     'Subsurface Scale': 0.002}),
    'Filter paper': _paper,
    # Pack 1 instruments, cuvette and scenery (M2)
    'Instrument housing light grey': _housing_light,
    'Instrument housing dark grey': lambda n: principled(n, **{'Base Color': (0.06, 0.063, 0.066, 1), 'Roughness': 0.5,
                                                              'Specular IOR Level': 0.3}),
    'Keypad membrane': lambda n: principled(n, **{'Base Color': (0.2, 0.21, 0.22, 1), 'Roughness': 0.6}),
    # a blank, dark display face: the viewer draws only what its display policy allows (G-1)
    'Display glass': lambda n: principled(n, **{'Base Color': (0.012, 0.015, 0.017, 1), 'Roughness': 0.12,
                                                'Specular IOR Level': 0.22}),
    'Polystyrene clear': lambda n: principled(n, **{'Base Color': (0.99, 0.99, 0.99, 1), 'Roughness': 0.02,
                                                    'IOR': 1.59, 'Transmission Weight': 1.0}),
    'Polystyrene frosted': lambda n: principled(n, **{'Base Color': (0.93, 0.93, 0.92, 1), 'Roughness': 0.55,
                                                      'IOR': 1.59, 'Transmission Weight': 0.6}),
    'Polypropylene rack white': lambda n: principled(n, **{'Base Color': (0.9, 0.9, 0.88, 1), 'Roughness': 0.42,
                                                           'Subsurface Weight': 0.3, 'Subsurface Scale': 0.003}),
}


def material(name):
    """The named model material, created once per scene. Refuses names the viewer lacks."""
    allowed = viewer_material_names()
    if name not in allowed:
        raise ValueError(f'Material "{name}" is not in viewerMaterials.json')
    if name not in _FACTORIES:
        raise ValueError(f'Material "{name}" has no factory in labeq/materials.py')
    existing = bpy.data.materials.get(name)
    return existing if existing is not None else _FACTORIES[name](name)


class Materials:
    """Attribute-free lookup: M['LDPE natural'] creates the material on first use."""

    def __getitem__(self, name):
        return material(name)
