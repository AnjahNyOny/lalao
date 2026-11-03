"""
Low-poly assets for Miaraka (co-op adventure in the Tsingy), built from code.

Run inside Blender (Scripting tab, or the Blender MCP):
    exec(open('/path/to/assets/blender/miaraka_assets.py').read())
It borrows the helpers of tsena_assets.py (Asset, palette), rebuilds the
'Miaraka' collection, then `export_miaraka(path)` writes the .glb.

Same conventions as Tsena: Z up, 1 unit = one cell of the level, origin at the
base centre (cell centre), fronts face -Y. The heroes and the vegetation come
from tsena.glb, which the game loads too.
"""
import math
import os
import random

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else '/Users/mac/Projects/game/assets/blender'
_helpers = {'KEEP_SCENE': True}
exec(open(os.path.join(HERE, 'tsena_assets.py')).read(), _helpers)
Asset = _helpers['Asset']
PALETTE = _helpers['PALETTE']
PALETTE.update({
    'Limestone': '#9aa0a6',
    'LimestoneDark': '#6f767d',
    'LimestoneLight': '#c3c6c4',
    'Moss': '#5f9e4a',
    'Gold': '#e6b53a',
    'GoldDark': '#b0841f',
    'Bronze': '#b07a3c',
    'Croc': '#5d7a3a',
    'CrocBelly': '#c9c08a',
    'Crack': '#3b3633',
    'Orchid': '#f4f0e6',
})

COLLECTION = 'Miaraka'


def wall(name, seed):
    """A tsingy block: limestone needles on a rocky base, a cell wide."""
    a = Asset(name)
    a.cube('LimestoneDark', (0, 0, 0.35), (1.0, 1.0, 0.7))
    rng = random.Random(seed)
    for i in range(6):
        x, y = rng.uniform(-0.3, 0.3), rng.uniform(-0.3, 0.3)
        h = 1.2 + rng.random() * 1.1
        a.cyl('Limestone' if i % 2 else 'LimestoneLight', (x, y, 0.6 + h / 2), 0.18 + rng.random() * 0.1, 0.0, h, seg=5,
              rot=(0, 0, rng.random()))
    return a


def ledge():
    """A flat-topped limestone block, 1.5 high, moss on top."""
    a = Asset('ledge')
    a.cube('Limestone', (0, 0, 0.7), (1.0, 1.0, 1.4))
    a.cube('Moss', (0, 0, 1.45), (1.0, 1.0, 0.1))
    rng = random.Random(3)
    for i in range(3):
        a.ball('Leaf' if i % 2 else 'LeafDark', (rng.uniform(-0.35, 0.35), rng.uniform(-0.35, 0.35), 1.52), (0.12, 0.12, 0.06), sub=1)
    return a


def cracked():
    """A sandy block shot through with cracks: the zebu's to break."""
    a = Asset('cracked')
    a.cube('Sandstone', (0, 0, 0.8), (0.96, 0.96, 1.6))
    rng = random.Random(8)
    for side in (-1, 1):
        for i in range(4):
            a.cube('Crack', (rng.uniform(-0.3, 0.3), side * 0.485, 0.3 + i * 0.32), (0.32, 0.02, 0.035), rot=(0, rng.uniform(-0.9, 0.9), 0))
            a.cube('Crack', (side * 0.485, rng.uniform(-0.3, 0.3), 0.3 + i * 0.32), (0.02, 0.32, 0.035), rot=(rng.uniform(-0.9, 0.9), 0, 0))
    return a


def rubble():
    a = Asset('rubble')
    rng = random.Random(4)
    for i in range(7):
        a.ball('Sandstone' if i % 2 else 'RockRed', (rng.uniform(-0.35, 0.35), rng.uniform(-0.35, 0.35), 0.06), (0.12, 0.1, 0.07), sub=0,
               rot=(0, 0, rng.random() * 3))
    return a


def gate():
    """A palisade of pointed stakes: sinks into the ground when open."""
    a = Asset('gate')
    for i in range(5):
        x = -0.4 + i * 0.2
        a.cyl('Wood', (x, 0, 0.75), 0.075, 0.075, 1.5, seg=6)
        a.cyl('Wood', (x, 0, 1.6), 0.075, 0.0, 0.2, seg=6)
    for z in (0.4, 1.1):
        a.cube('WoodDark', (0, -0.08, z), (1.0, 0.05, 0.1))
    return a


def bridge():
    """Planks across a cell of water, rope rails."""
    a = Asset('bridge')
    for i in range(6):
        a.cube('Wood' if i % 2 else 'WoodDark', (0, -0.42 + i * 0.168, 0.0), (1.02, 0.15, 0.06))
    for x in (-0.48, 0.48):
        a.cube('Basket', (x, 0, 0.35), (0.03, 1.0, 0.03))
        for y in (-0.45, 0.45):
            a.cyl('WoodDark', (x, y, 0.18), 0.03, 0.03, 0.4, seg=5)
    return a


def plate():
    """A stone disc anyone can weigh down."""
    a = Asset('plate')
    a.cyl('LimestoneLight', (0, 0, 0.03), 0.4, 0.42, 0.06, seg=12)
    a.cyl('Sign', (0, 0, 0.065), 0.16, 0.16, 0.01, seg=10)
    return a


def heavy_plate():
    """A bronze plate marked with zebu horns: too heavy for a maki."""
    a = Asset('heavy_plate')
    a.cube('LimestoneDark', (0, 0, 0.04), (0.9, 0.9, 0.08))
    a.cube('Bronze', (0, 0, 0.09), (0.7, 0.7, 0.04))
    for s in (-1, 1):
        a.along('Horn', (s * 0.05, 0, 0.12), (s * 0.22, 0.02, 0.12), 0.04, 0.03, seg=5)
        a.along('Horn', (s * 0.22, 0.02, 0.12), (s * 0.2, -0.18, 0.12), 0.03, 0.01, seg=5)
    return a


def lever_base():
    a = Asset('lever_base')
    a.cube('WoodDark', (0, 0, 0.1), (0.4, 0.3, 0.2))
    a.cube('Black', (0, 0, 0.21), (0.3, 0.08, 0.02))
    return a


def lever_arm():
    """Pivots at its origin (the top of the base)."""
    a = Asset('lever_arm')
    a.cyl('Wood', (0, 0, 0.3), 0.03, 0.03, 0.6, seg=6)
    a.ball('Stripe', (0, 0, 0.62), (0.07, 0.07, 0.07), sub=1)
    return a


def crate():
    a = Asset('crate')
    a.cube('Wood', (0, 0, 0.45), (0.9, 0.9, 0.9))
    for s in (-1, 1):
        for t in (-1, 1):
            a.cube('WoodDark', (s * 0.44, t * 0.44, 0.45), (0.06, 0.06, 0.92))
            a.cube('WoodDark', (s * 0.44, 0, 0.45 + t * 0.44), (0.06, 0.92, 0.06))
            a.cube('WoodDark', (0, s * 0.44, 0.45 + t * 0.44), (0.92, 0.06, 0.06))
    a.cube('Basket', (0, -0.455, 0.45), (0.92, 0.02, 0.08))
    return a


def key():
    a = Asset('key')
    a.cyl('Gold', (0, 0, 0.5), 0.12, 0.12, 0.05, seg=10, rot=(math.pi / 2, 0, 0))
    a.cyl('GoldDark', (0, 0, 0.5), 0.06, 0.06, 0.06, seg=8, rot=(math.pi / 2, 0, 0))
    a.cube('Gold', (0, 0, 0.27), (0.05, 0.05, 0.36))
    for z in (0.13, 0.2):
        a.cube('Gold', (0.06, 0, z), (0.08, 0.05, 0.04))
    return a


def door():
    """A plank door in a stone frame, a big lock on it. Hinged at its left edge."""
    a = Asset('door')
    a.cube('Wood', (0.45, 0, 0.8), (0.9, 0.1, 1.6))
    for z in (0.35, 1.25):
        a.cube('WoodDark', (0.45, -0.06, z), (0.92, 0.03, 0.1))
    a.cube('Gold', (0.75, -0.08, 0.8), (0.14, 0.04, 0.18))
    a.cube('Black', (0.75, -0.105, 0.78), (0.03, 0.01, 0.06))
    return a


def door_frame():
    a = Asset('door_frame')
    for x in (-0.47, 0.47):
        a.cube('LimestoneDark', (x, 0, 0.95), (0.08, 0.3, 1.9))
    a.cube('LimestoneDark', (0, 0, 1.9), (1.0, 0.3, 0.16))
    return a


def pod():
    """A vanilla pod and its orchid: something to collect."""
    a = Asset('pod')
    a.along('Vanilla', (-0.12, 0, 0.25), (0.12, 0, 0.5), 0.03, 0.02, seg=6)
    a.along('Vanilla', (-0.05, 0.03, 0.22), (0.15, 0.03, 0.42), 0.026, 0.018, seg=6)
    for k in range(5):
        ang = k / 5 * math.tau
        a.ball('Orchid', (math.cos(ang) * 0.07, math.sin(ang) * 0.07, 0.56), (0.06, 0.04, 0.02), sub=1, rot=(0, 0, ang))
    a.ball('Yellow', (0, 0, 0.57), (0.03, 0.03, 0.03), sub=0)
    return a


def cairn():
    """A checkpoint: a cairn with a lamba-striped pennant."""
    a = Asset('cairn')
    for i, (r, z) in enumerate(((0.22, 0.08), (0.17, 0.22), (0.12, 0.34))):
        a.ball('Rock' if i % 2 else 'RockDark', (0, 0, z), (r, r, 0.08), sub=1)
    a.cyl('WoodDark', (0, 0, 0.6), 0.015, 0.015, 0.6, seg=5)
    for i, m in enumerate(('Stripe', 'Yellow', 'FlagGreen')):
        a.plate(m, [(0, 0, 0), (0.28, 0, -0.03), (0, 0, -0.06)], loc=(0.01, 0, 0.88 - i * 0.06))
    return a


def croc():
    """A crocodile, facing -Y, low in the water."""
    a = Asset('croc')
    a.ball('Croc', (0, 0.05, 0.1), (0.2, 0.5, 0.1), sub=2)
    a.ball('CrocBelly', (0, 0.05, 0.05), (0.18, 0.45, 0.05), sub=1)
    a.cube('Croc', (0, -0.55, 0.08), (0.18, 0.36, 0.08))
    a.cube('White', (0, -0.6, 0.04), (0.16, 0.3, 0.015))
    for s in (-1, 1):
        a.ball('Yellow', (s * 0.08, -0.4, 0.17), (0.04, 0.04, 0.04), sub=1)
        a.ball('Black', (s * 0.085, -0.43, 0.18), (0.015, 0.015, 0.015), sub=0)
        for y in (-0.2, 0.3):
            a.cube('Croc', (s * 0.24, y, 0.04), (0.14, 0.08, 0.05))
    for i in range(6):
        a.cyl('LeafDark', (0, -0.25 + i * 0.14, 0.2), 0.035, 0.0, 0.07, seg=4)
    a.along('Croc', (0, 0.5, 0.08), (0, 1.0, 0.05), 0.11, 0.02, seg=6)
    return a


def chest_base():
    a = Asset('chest_base')
    a.cube('WoodDark', (0, 0, 0.22), (0.8, 0.5, 0.44))
    a.cube('Gold', (0, -0.255, 0.3), (0.12, 0.02, 0.14))
    for x in (-0.33, 0.33):
        a.cube('GoldDark', (x, 0, 0.22), (0.05, 0.52, 0.46))
    for i in range(9):
        a.cyl('Gold', ((i % 3 - 1) * 0.2, (i // 3 - 1) * 0.12, 0.45), 0.06, 0.06, 0.03, seg=8)
    return a


def chest_lid():
    """Hinged along its back edge, at its origin."""
    a = Asset('chest_lid')
    a.cyl('Wood', (0, -0.25, 0.0), 0.25, 0.25, 0.8, seg=8, rot=(0, math.pi / 2, 0), scale=(1, 1, 1))
    a.cube('GoldDark', (0, -0.25, 0.0), (0.82, 0.52, 0.05))
    return a


def pad():
    """A treasure pad: a stone circle with a spiral."""
    a = Asset('pad')
    a.cyl('LimestoneLight', (0, 0, 0.04), 0.45, 0.47, 0.08, seg=14)
    for i in range(9):
        ang = i * 0.8
        r = 0.05 + i * 0.035
        a.ball('Gold', (math.cos(ang) * r, math.sin(ang) * r, 0.085), (0.035, 0.035, 0.012), sub=0)
    return a


BUILDERS = [
    lambda: wall('wall_a', 1), lambda: wall('wall_b', 2), ledge, cracked, rubble, gate, bridge, plate, heavy_plate,
    lever_base, lever_arm, crate, key, door, door_frame, pod, cairn, croc, chest_base, chest_lid, pad,
]


def rebuild_miaraka():
    coll = bpy.data.collections.get(COLLECTION)
    if coll is None:
        coll = bpy.data.collections.new(COLLECTION)
        bpy.context.scene.collection.children.link(coll)
    for obj in list(coll.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in [m for m in bpy.data.meshes if m.users == 0]:
        bpy.data.meshes.remove(mesh)
    objects = []
    for i, b in enumerate(BUILDERS):
        obj = b().build(coll, i)
        obj.location.y -= 30  # out of the way of Tsena's assets
        objects.append(obj)
    return objects


def export_miaraka(path):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in bpy.data.collections[COLLECTION].objects:
        obj.hide_set(False)
        obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_apply=True, export_yup=True,
                              export_normals=False, export_texcoords=False)


if not globals().get('KEEP_SCENE'):
    objects = rebuild_miaraka()
    print('built', len(objects), 'assets,', sum(len(o.data.polygons) for o in objects), 'faces')
