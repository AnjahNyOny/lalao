"""
Low-poly assets for Tsena (Madagascar board game), built from code.

Run inside Blender (Scripting tab, or the Blender MCP):
    exec(open('/path/to/assets/blender/tsena_assets.py').read())
It rebuilds the 'Tsena' collection, then `export(path)` writes the .glb.

Conventions: Z up, 1 unit = 1 board unit (a cell is about 1.6 wide),
origin at the base centre, fronts face -Y (three.js +Z after export).
A material named 'Owner' is recoloured in the game with the player's colour.

Each site of the board has its landmark: the real monument, or what the
place is famous for (the Allée des Baobabs, the Rova, Sambava's vanilla…).
"""
import math
import random
from contextlib import contextmanager

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

COLLECTION = 'Tsena'

PALETTE = {
    # Recoloured per player in the game; this is only the preview colour.
    'Owner': '#e2553a',
    'White': '#f7f3ea',
    'Black': '#26221f',
    'Wood': '#9a6a43',
    'WoodDark': '#5e3b24',
    'Brick': '#b9573c',
    'Plaster': '#f0e3c6',
    'Thatch': '#c9a45c',
    'RoofDark': '#6b3d2e',
    'Leaf': '#5aa64a',
    'LeafDark': '#2f7d3b',
    'Bark': '#ad8a6d',
    'BarkGrey': '#8b8178',
    'Stone': '#cdbb9c',
    'Rock': '#8f969c',
    'RockDark': '#6c7378',
    'Coat': '#a5653f',
    'Cream': '#efe1c6',
    'Horn': '#e9dcc0',
    'Grey': '#a3a6aa',
    'Amber': '#f2a531',
    'Green': '#46b86a',
    'Yellow': '#f4d35e',
    'BusCream': '#f3e7cc',
    'Stripe': '#d9483b',
    'Glass': '#2f4559',
    'Tire': '#2b2b2b',
    'Luggage': '#c0392b',
    'Basket': '#c8a165',
    'Fruit': '#f39c12',
    'Tomato': '#e74c3c',
    'Sail': '#f6efe0',
    'Whale': '#3d4d61',
    'Cloud': '#c3c9d3',
    'CloudDark': '#8e97a6',
    'Sapphire': '#2f6fe0',
    'FlagRed': '#d62f2f',
    'FlagGreen': '#1f9a4a',
    'Sign': '#f2c14e',
    'RoofTile': '#c7653f',
    'Sandstone': '#d9a066',
    'RockRed': '#b5573a',
    'Water': '#3fa7d6',
    'Emerald': '#2bb5a6',
    'Lagoon': '#5cc9d1',
    'Copper': '#c47a3a',
    'Pod': '#e08a2c',
    'Vanilla': '#3a2618',
    'Purple': '#9a72d0',
    'Rust': '#c0552e',
    'ContainerBlue': '#2f6db5',
    'ContainerGreen': '#3a9d5d',
    'Gold': '#e2a93b',
    'Fossa': '#a8673a',
    'Rail': '#55585c',
    'Train': '#c43c32',
    'Sand': '#ecd9a6',
    'Net': '#d8c49a',
    'PousseBlue': '#3d7ccc',
    'Bamboo': '#a8c64e',
    'Grass': '#79b956',
    'Sage': '#8aa86b',
    'Road': '#b9653f',
}


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def material(name):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    hexa = PALETTE[name].lstrip('#')
    rgb = [srgb_to_linear(int(hexa[i:i + 2], 16) / 255) for i in (0, 2, 4)]
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    sockets = {s.identifier: s for s in bsdf.inputs}
    sockets['Base Color'].default_value = (*rgb, 1)
    sockets['Roughness'].default_value = 0.3 if name in ('Sapphire', 'Glass', 'Water', 'Emerald', 'Lagoon', 'Copper') else 0.85
    sockets['Metallic'].default_value = 0.0
    m.diffuse_color = (*rgb, 1)
    return m


class Asset:
    """Accumulates primitives into one mesh, one material slot per colour."""

    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.mats = []
        # Where primitives go: lets a model reuse another's parts (zebus in a market pen).
        self.frame = Matrix.Identity(4)

    @contextmanager
    def at(self, loc=(0, 0, 0), rot=(0, 0, 0), scale=1.0):
        saved = self.frame
        self.frame = saved @ self.matrix(loc, rot, (scale, scale, scale))
        try:
            yield self
        finally:
            self.frame = saved

    def place(self, loc, rot, scale):
        return self.frame @ self.matrix(loc, rot, scale)

    def _paint(self, before, mat):
        if mat not in self.mats:
            self.mats.append(mat)
        index = self.mats.index(mat)
        for f in self.bm.faces:
            if f not in before:
                f.material_index = index

    @staticmethod
    def matrix(loc, rot, scale):
        return Matrix.LocRotScale(Vector(loc), Euler(rot).to_quaternion(), Vector(scale))

    def cube(self, mat, loc, scale, rot=(0, 0, 0)):
        before = set(self.bm.faces)
        bmesh.ops.create_cube(self.bm, size=1.0, matrix=self.place(loc, rot, scale))
        self._paint(before, mat)

    def cyl(self, mat, loc, r1, r2, depth, seg=10, rot=(0, 0, 0), scale=(1, 1, 1)):
        """Cone or cylinder, centred on loc, along Z before rotation."""
        before = set(self.bm.faces)
        bmesh.ops.create_cone(self.bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=depth,
                              matrix=self.place(loc, rot, scale))
        self._paint(before, mat)

    def ball(self, mat, loc, scale, sub=1, rot=(0, 0, 0)):
        before = set(self.bm.faces)
        bmesh.ops.create_icosphere(self.bm, subdivisions=sub, radius=1.0, matrix=self.place(loc, rot, scale))
        self._paint(before, mat)

    def poly(self, mat, verts, faces, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
        before = set(self.bm.faces)
        m = self.place(loc, rot, scale)
        vs = [self.bm.verts.new(m @ Vector(v)) for v in verts]
        for f in faces:
            self.bm.faces.new([vs[i] for i in f])
        self._paint(before, mat)

    def plate(self, mat, tri, thickness=0.012, loc=(0, 0, 0)):
        """A triangle given a little thickness along Y, so it shows from both sides."""
        t = thickness / 2
        verts = [(x, y - t, z) for x, y, z in tri] + [(x, y + t, z) for x, y, z in tri]
        faces = [(0, 1, 2), (5, 4, 3), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)]
        self.poly(mat, verts, faces, loc)

    def prism(self, mat, loc, w, d, h, rot=(0, 0, 0)):
        """Gable roof: ridge along X, base at loc."""
        verts = [(-w / 2, -d / 2, 0), (w / 2, -d / 2, 0), (w / 2, d / 2, 0), (-w / 2, d / 2, 0), (-w / 2, 0, h), (w / 2, 0, h)]
        faces = [(3, 2, 1, 0), (0, 1, 5, 4), (2, 3, 4, 5), (0, 4, 3), (1, 2, 5)]
        self.poly(mat, verts, faces, loc, rot)

    def along(self, mat, a, b, r1, r2, seg=8):
        """A cone from point a to point b."""
        a, b = self.frame @ Vector(a), self.frame @ Vector(b)
        k = sum(self.frame.to_scale()) / 3
        r1, r2 = r1 * k, r2 * k
        d = b - a
        q = Vector((0, 0, 1)).rotation_difference(d.normalized())
        before = set(self.bm.faces)
        m = Matrix.LocRotScale((a + b) / 2, q, Vector((1, 1, 1)))
        bmesh.ops.create_cone(self.bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=d.length, matrix=m)
        self._paint(before, mat)

    def build(self, collection, index):
        mesh = bpy.data.meshes.new(self.name)
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        self.bm.to_mesh(mesh)
        self.bm.free()
        for f in mesh.polygons:
            f.use_smooth = False
        for name in self.mats:
            mesh.materials.append(material(name))
        obj = bpy.data.objects.new(self.name, mesh)
        # Laid out on a grid, ten to a row, to look them over.
        obj.location = ((index % 10) * 1.6, -(index // 10) * 1.8, 0)
        collection.objects.link(obj)
        return obj


# ---------- Pawns ----------

def zebu_parts(a):
    a.cube('Coat', (0, 0.02, 0.36), (0.3, 0.56, 0.26))
    a.cube('Cream', (0, 0.02, 0.24), (0.26, 0.5, 0.06))
    a.ball('Coat', (0, -0.15, 0.55), (0.13, 0.14, 0.15))
    a.cube('Coat', (0, -0.36, 0.47), (0.2, 0.2, 0.2))
    a.cube('Cream', (0, -0.48, 0.42), (0.16, 0.08, 0.12))
    for s in (-1, 1):
        a.along('Horn', (s * 0.07, -0.36, 0.56), (s * 0.2, -0.38, 0.66), 0.035, 0.022, seg=6)
        a.along('Horn', (s * 0.2, -0.38, 0.66), (s * 0.18, -0.36, 0.8), 0.022, 0.006, seg=6)
        a.cube('Coat', (s * 0.13, -0.32, 0.52), (0.08, 0.03, 0.05))
        for y in (-0.18, 0.2):
            a.cyl('Coat', (s * 0.09, y, 0.13), 0.045, 0.04, 0.22, seg=6)
            a.cyl('Black', (s * 0.09, y, 0.025), 0.05, 0.05, 0.05, seg=6)
        a.ball('Black', (s * 0.055, -0.465, 0.5), (0.02, 0.02, 0.02), sub=0)
    a.along('Coat', (0, 0.29, 0.42), (0, 0.36, 0.2), 0.02, 0.015, seg=5)
    a.ball('Black', (0, 0.37, 0.18), (0.035, 0.035, 0.05), sub=0)
    return a


def zebu():
    return zebu_parts(Asset('pawn_zebu'))


def lemur_parts(a, fur='Grey', belly='White', ring='Black'):
    a.ball(fur, (0, 0, 0.26), (0.17, 0.16, 0.22), sub=2)
    a.ball(belly, (0, -0.08, 0.24), (0.12, 0.09, 0.17), sub=1)
    a.ball(fur, (0, -0.04, 0.5), (0.13, 0.12, 0.12), sub=2)
    a.ball(belly, (0, -0.12, 0.48), (0.1, 0.06, 0.08), sub=1)
    a.cyl('Black', (0, -0.19, 0.465), 0.04, 0.012, 0.09, seg=6, rot=(math.pi / 2, 0, 0))
    for s in (-1, 1):
        a.ball('Black', (s * 0.045, -0.165, 0.515), (0.032, 0.02, 0.03), sub=1)
        a.ball('Amber', (s * 0.045, -0.178, 0.517), (0.018, 0.012, 0.018), sub=1)
        a.cyl(fur, (s * 0.085, -0.02, 0.61), 0.04, 0.008, 0.08, seg=5, rot=(0, s * 0.35, 0))
        a.along(fur, (s * 0.12, -0.06, 0.36), (s * 0.08, -0.16, 0.2), 0.035, 0.03, seg=6)
        a.cyl(fur, (s * 0.09, -0.1, 0.04), 0.05, 0.045, 0.08, seg=6)
    # Ringed tail curling up behind.
    points = []
    for i in range(13):
        t = i / 12
        points.append(Vector((0, 0.14 + 0.24 * math.sin(t * math.pi * 0.85), 0.08 + 0.78 * t)))
    for i in range(12):
        a.along(ring if i % 2 else belly, points[i], points[i + 1], 0.045, 0.042, seg=8)
    return a


def lemur():
    return lemur_parts(Asset('pawn_lemur'))


def chameleon():
    a = Asset('pawn_chameleon')
    a.ball('Green', (0, 0, 0.32), (0.12, 0.27, 0.17), sub=2)
    a.ball('Yellow', (0, 0.0, 0.27), (0.125, 0.2, 0.05), sub=1)
    for i in range(6):
        y = -0.18 + i * 0.07
        a.cyl('Green', (0, y, 0.48 - abs(y) * 0.25), 0.03, 0.0, 0.07, seg=4)
    # Head: narrow snout at the front, casque rising at the back.
    a.cyl('Green', (0, -0.31, 0.38), 0.035, 0.12, 0.26, seg=8, rot=(-1.2, 0, 0))
    a.cyl('Yellow', (0, -0.42, 0.355), 0.03, 0.03, 0.02, seg=6, rot=(-1.2, 0, 0))
    for s in (-1, 1):
        a.ball('Yellow', (s * 0.07, -0.3, 0.4), (0.04, 0.04, 0.04), sub=1)
        a.ball('Black', (s * 0.1, -0.31, 0.405), (0.014, 0.014, 0.014), sub=0)
        for y in (-0.14, 0.14):
            a.along('Green', (s * 0.07, y, 0.26), (s * 0.13, y - 0.03, 0.03), 0.028, 0.022, seg=5)
            a.cube('Green', (s * 0.13, y - 0.03, 0.015), (0.06, 0.06, 0.03))
    # Curled tail.
    prev = Vector((0, 0.24, 0.3))
    for i in range(1, 12):
        ang = i / 11 * math.pi * 1.7
        r = 0.13 * (1 - i / 16)
        p = Vector((0, 0.36 + r * math.sin(ang), 0.2 + r * math.cos(ang)))
        a.along('Green', prev, p, 0.04 * (1 - i / 14), 0.04 * (1 - (i + 1) / 14), seg=6)
        prev = p
    return a


def taxi():
    a = Asset('pawn_taxi')
    a.cube('BusCream', (0, 0, 0.29), (0.36, 0.72, 0.3))
    a.cube('Stripe', (0, 0, 0.23), (0.368, 0.728, 0.06))
    a.cube('BusCream', (0, 0.01, 0.45), (0.34, 0.66, 0.04))
    a.cube('Glass', (0, 0.05, 0.37), (0.372, 0.52, 0.1))
    a.cube('Glass', (0, -0.36, 0.36), (0.3, 0.014, 0.12))
    for s in (-1, 1):
        a.cube('Yellow', (s * 0.12, -0.362, 0.2), (0.06, 0.012, 0.04))
        for y in (-0.22, 0.22):
            a.cyl('Tire', (s * 0.17, y, 0.08), 0.08, 0.08, 0.07, seg=10, rot=(0, math.pi / 2, 0))
    # Roof rack, loaded.
    for s in (-1, 1):
        a.cube('WoodDark', (s * 0.15, 0.02, 0.485), (0.02, 0.6, 0.02))
    a.cube('Luggage', (0.03, 0.14, 0.54), (0.22, 0.18, 0.1))
    a.cube('Basket', (-0.04, -0.1, 0.53), (0.18, 0.16, 0.08))
    a.cyl('Leaf', (0.06, -0.1, 0.6), 0.05, 0.05, 0.16, seg=8, rot=(0, math.pi / 2, 0))
    a.cyl('Cream', (-0.06, 0.24, 0.54), 0.06, 0.05, 0.1, seg=8)
    return a


# ---------- Special cells ----------

def rova():
    """Antananarivo: a palace on its hill, with four corner towers."""
    a = Asset('rova')
    a.cube('Stone', (0, 0, 0.3), (0.86, 0.66, 0.6))
    a.prism('RoofDark', (0, 0, 0.6), 0.78, 0.6, 0.62)
    for x in (-0.43, 0.43):
        for y in (-0.33, 0.33):
            a.cyl('Stone', (x, y, 0.36), 0.1, 0.1, 0.72, seg=8)
            a.cyl('RoofDark', (x, y, 0.82), 0.13, 0.0, 0.22, seg=8)
    for row in (0.18, 0.42):
        for x in (-0.24, -0.08, 0.08, 0.24):
            a.cube('WoodDark', (x, -0.333, row), (0.07, 0.02, 0.12))
    return a


def busstop():
    a = Asset('busstop')
    for x in (-0.25, 0.25):
        a.cube('WoodDark', (x, 0.12, 0.28), (0.04, 0.04, 0.56))
    a.cube('Thatch', (0, 0.06, 0.58), (0.66, 0.36, 0.05), rot=(-0.15, 0, 0))
    a.cube('Wood', (0, 0.14, 0.18), (0.46, 0.12, 0.04))
    a.cyl('BarkGrey', (0.38, -0.12, 0.35), 0.015, 0.015, 0.7, seg=5)
    a.cube('Sign', (0.38, -0.12, 0.68), (0.24, 0.025, 0.16))
    a.cube('Black', (0.38, -0.135, 0.68), (0.14, 0.01, 0.05))
    return a


def sapphire_parts(a):
    """Vintana: a floating gem (Madagascar's sapphires)."""
    a.cyl('Sapphire', (0, 0, 0.16), 0.0, 0.16, 0.16, seg=6)
    a.cyl('Sapphire', (0, 0, 0.28), 0.16, 0.09, 0.08, seg=6)
    return a


def sapphire():
    return sapphire_parts(Asset('sapphire'))


def office():
    """Hetra (tax office) with a flag."""
    a = Asset('office')
    a.cube('Plaster', (0, 0.06, 0.2), (0.52, 0.4, 0.4))
    a.cube('RoofDark', (0, 0.06, 0.42), (0.58, 0.46, 0.05))
    a.cube('WoodDark', (0, -0.142, 0.13), (0.12, 0.02, 0.26))
    for x in (-0.16, 0.16):
        a.cube('Glass', (x, -0.142, 0.25), (0.1, 0.02, 0.1))
    a.cyl('BarkGrey', (0.34, -0.16, 0.42), 0.012, 0.012, 0.84, seg=5)
    # Flag: white band at the hoist, red over green.
    a.cube('White', (0.39, -0.16, 0.74), (0.08, 0.01, 0.16))
    a.cube('FlagRed', (0.5, -0.16, 0.78), (0.14, 0.01, 0.08))
    a.cube('FlagGreen', (0.5, -0.16, 0.7), (0.14, 0.01, 0.08))
    return a


def stage():
    """Hira gasy: a little stage with a drum and pennants."""
    a = Asset('stage')
    a.cube('Wood', (0, 0, 0.06), (0.7, 0.5, 0.12))
    a.cyl('Stripe', (-0.12, 0.05, 0.24), 0.13, 0.13, 0.22, seg=10)
    a.cyl('White', (-0.12, 0.05, 0.36), 0.132, 0.132, 0.02, seg=10)
    a.cyl('Fruit', (0.16, 0.08, 0.2), 0.08, 0.08, 0.16, seg=8)
    for x in (-0.33, 0.33):
        a.cyl('WoodDark', (x, 0.22, 0.4), 0.015, 0.015, 0.8, seg=5)
    for i, m in enumerate(['FlagRed', 'White', 'FlagGreen', 'Yellow', 'FlagRed', 'White', 'FlagGreen']):
        x = -0.28 + i * 0.093
        sag = 0.06 * math.sin((i + 0.5) / 7 * math.pi)
        a.plate(m, [(-0.035, 0, 0), (0.035, 0, 0), (0, 0, -0.08)], loc=(x, 0.22, 0.78 - sag))
    return a


def cyclone():
    a = Asset('cyclone')
    a.cyl('CloudDark', (0, 0, 0.45), 0.05, 0.3, 0.8, seg=10)
    for i in range(8):
        ang = i / 8 * math.tau
        r = 0.32 + 0.04 * (i % 2)
        a.ball('Cloud' if i % 2 else 'CloudDark', (math.cos(ang) * r, math.sin(ang) * r, 0.86 + 0.04 * (i % 3)),
               (0.16, 0.16, 0.1), sub=1)
    return a


# ---------- Scenery ----------

def baobab_parts(a):
    a.cyl('Bark', (0, 0, 0.2), 0.3, 0.27, 0.4, seg=10)
    a.cyl('Bark', (0, 0, 0.95), 0.27, 0.19, 1.1, seg=10)
    rng = random.Random(3)
    for i in range(6):
        ang = i / 6 * math.tau + rng.random() * 0.4
        tip = Vector((math.cos(ang) * 0.42, math.sin(ang) * 0.42, 1.72 + rng.random() * 0.12))
        a.along('Bark', (math.cos(ang) * 0.08, math.sin(ang) * 0.08, 1.45), tip, 0.06, 0.03, seg=5)
        a.ball('Leaf' if i % 2 else 'LeafDark', tip + Vector((0, 0, 0.04)), (0.2, 0.2, 0.09), sub=1)
    a.ball('Leaf', (0, 0, 1.62), (0.22, 0.22, 0.1), sub=1)
    return a


def baobab():
    return baobab_parts(Asset('baobab'))


def ravinala():
    a = Asset('ravinala')
    a.cyl('BarkGrey', (0, 0, 0.3), 0.07, 0.06, 0.6, seg=8)
    for i in range(11):
        ang = math.radians(-75 + i * 15)
        d = Vector((math.sin(ang), 0, math.cos(ang)))
        base = Vector((0, 0, 0.6))
        a.along('LeafDark', base, base + d * 0.38, 0.018, 0.012, seg=4)
        a.ball('Leaf' if i % 2 else 'LeafDark', base + d * 0.62, (0.07, 0.015, 0.26), sub=1, rot=(0, ang, 0))
    return a


def palm():
    a = Asset('palm')
    pts = [Vector((0.06 * i * i / 4, 0, 0.3 * i)) for i in range(6)]
    for i in range(5):
        a.along('BarkGrey', pts[i], pts[i + 1], 0.06 - i * 0.006, 0.055 - i * 0.006, seg=7)
    top = pts[-1]
    for i in range(7):
        ang = i / 7 * math.tau
        d = Vector((math.cos(ang), math.sin(ang), 0))
        a.ball('Leaf' if i % 2 else 'LeafDark', top + d * 0.42 + Vector((0, 0, -0.12)), (0.46, 0.1, 0.03), sub=1,
               rot=(0, 0.45, ang))
    for i in range(3):
        ang = i / 3 * math.tau
        a.ball('WoodDark', top + Vector((math.cos(ang) * 0.06, math.sin(ang) * 0.06, -0.08)), (0.05, 0.05, 0.05), sub=0)
    return a


def tsingy_parts(a, seed=5):
    rng = random.Random(seed)
    for i in range(9):
        ang = rng.random() * math.tau
        r = rng.random() * 0.38
        h = 0.35 + rng.random() * 0.75 * (1 - r)
        a.cyl('Rock' if i % 2 else 'RockDark', (math.cos(ang) * r, math.sin(ang) * r, h / 2), 0.1 + rng.random() * 0.08,
              0.0, h, seg=5, rot=(0, 0, rng.random()))
    return a


def tsingy():
    return tsingy_parts(Asset('tsingy'))


def hut():
    a = Asset('hut')
    a.cube('Wood', (0, 0, 0.15), (0.42, 0.32, 0.3))
    a.prism('Thatch', (0, 0, 0.3), 0.5, 0.42, 0.34)
    a.cube('WoodDark', (0, -0.162, 0.1), (0.09, 0.02, 0.2))
    return a


def pirogue_parts(a):
    a.cyl('WoodDark', (0, 0, 0.06), 0.08, 0.08, 0.7, seg=8, rot=(math.pi / 2, 0, 0), scale=(1.2, 1, 0.7))
    for s in (-1, 1):
        a.cyl('WoodDark', (0, s * 0.44, 0.06), 0.08, 0.0, 0.18, seg=8, rot=(-s * math.pi / 2, 0, 0), scale=(1.2, 1, 0.7))
    a.cyl('Wood', (0.36, 0, 0.04), 0.03, 0.03, 0.6, seg=6, rot=(math.pi / 2, 0, 0))
    for y in (-0.15, 0.15):
        a.cube('Wood', (0.18, y, 0.09), (0.38, 0.02, 0.02))
    a.cyl('Wood', (0, -0.05, 0.4), 0.012, 0.012, 0.75, seg=5)
    a.plate('Sail', [(0, 0, 0), (0.34, 0, 0), (0, 0, 0.6)], loc=(0.0, -0.05, 0.12))
    return a


def pirogue():
    return pirogue_parts(Asset('pirogue'))


def whale():
    a = Asset('whale')
    a.cyl('Whale', (0, 0, 0.2), 0.12, 0.05, 0.5, seg=8, rot=(0.25, 0, 0))
    for s in (-1, 1):
        a.ball('Whale', (s * 0.18, -0.06, 0.48), (0.22, 0.05, 0.08), sub=1, rot=(0, -s * 0.45, 0))
    return a


# ---------- Buildings on the sites ----------

def house():
    """A highland trano gasy: tall brick house, steep roof, wooden balcony."""
    a = Asset('house')
    a.cube('Brick', (0, 0.02, 0.21), (0.3, 0.24, 0.42))
    a.prism('Owner', (0, 0.02, 0.42), 0.36, 0.34, 0.26)
    for x in (-0.13, 0.13):
        a.cyl('Wood', (x, -0.16, 0.2), 0.012, 0.012, 0.4, seg=5)
    a.cube('Wood', (0, -0.14, 0.22), (0.32, 0.08, 0.02))
    a.cube('Wood', (0, -0.18, 0.27), (0.32, 0.01, 0.06))
    a.cube('WoodDark', (0, -0.101, 0.08), (0.07, 0.01, 0.16))
    for x in (-0.08, 0.08):
        a.cube('WoodDark', (x, -0.101, 0.34), (0.06, 0.01, 0.08))
    return a


def hotel():
    """Colonial hotel with a two-storey veranda."""
    a = Asset('hotel')
    a.cube('Plaster', (0, 0.04, 0.33), (0.8, 0.5, 0.66))
    a.cube('Owner', (0, 0.04, 0.68), (0.86, 0.56, 0.05))
    a.prism('Owner', (0, 0.04, 0.7), 0.82, 0.52, 0.26)
    a.cube('Wood', (0, -0.27, 0.33), (0.84, 0.12, 0.025))
    a.cube('White', (0, -0.33, 0.38), (0.84, 0.012, 0.06))
    for x in (-0.4, -0.2, 0, 0.2, 0.4):
        a.cyl('White', (x, -0.32, 0.3), 0.018, 0.018, 0.6, seg=6)
    a.cube('Wood', (0, -0.28, 0.61), (0.86, 0.14, 0.025))
    for z in (0.14, 0.46):
        for x in (-0.28, -0.1, 0.1, 0.28):
            if z < 0.3 and abs(x) < 0.15:
                continue
            a.cube('WoodDark', (x, -0.211, z), (0.09, 0.01, 0.14))
    a.cube('WoodDark', (0, -0.211, 0.11), (0.14, 0.01, 0.22))
    a.cube('Sign', (0, -0.36, 0.66), (0.32, 0.02, 0.08))
    return a


def flag():
    """Marks a bare site that has been bought."""
    a = Asset('flag')
    a.cyl('Stone', (0, 0, 0.03), 0.07, 0.08, 0.06, seg=8)
    a.cyl('BarkGrey', (0, 0, 0.36), 0.012, 0.012, 0.66, seg=5)
    a.plate('Owner', [(0, 0, 0), (0.26, 0, -0.07), (0, 0, -0.16)], loc=(0.01, 0, 0.68))
    return a


def cage():
    """Bars round a pawn in the fonja."""
    a = Asset('cage')
    ring = [Vector((math.cos(i / 10 * math.tau) * 0.34, math.sin(i / 10 * math.tau) * 0.34, 0)) for i in range(10)]
    for p in ring:
        a.cyl('Black', (p.x, p.y, 0.36), 0.012, 0.012, 0.72, seg=4)
    for z in (0.02, 0.72):
        for i in range(10):
            a.along('Black', ring[i] + Vector((0, 0, z)), ring[(i + 1) % 10] + Vector((0, 0, z)), 0.015, 0.015, seg=4)
    return a


# ---------- More special cells ----------

def market():
    """Antananarivo: the pavilions of Analakely market and its white parasols."""
    a = Asset('market')
    for x in (-0.3, 0.3):
        a.cube('Plaster', (x, 0.15, 0.18), (0.42, 0.36, 0.36))
        a.cyl('RoofTile', (x, 0.15, 0.46), 0.34, 0.0, 0.22, seg=4, rot=(0, 0, math.pi / 4))
        a.cube('WoodDark', (x, -0.031, 0.12), (0.14, 0.01, 0.24))
    for i, x in enumerate((-0.42, -0.12, 0.18, 0.46)):
        a.cyl('BarkGrey', (x, -0.27, 0.2), 0.008, 0.008, 0.4, seg=4)
        a.cyl('White', (x, -0.27, 0.42), 0.17, 0.0, 0.1, seg=8)
        a.cube('Basket', (x, -0.27, 0.08), (0.18, 0.12, 0.06))
        a.ball(['Fruit', 'Tomato', 'Leaf', 'Fruit'][i], (x, -0.27, 0.12), (0.07, 0.045, 0.03), sub=1)
    return a


def sobika():
    """Fihavanana: a woven basket, full of things to share."""
    a = Asset('sobika')
    a.cyl('Basket', (0, 0, 0.09), 0.1, 0.15, 0.18, seg=10)
    a.cyl('Wood', (0, 0, 0.185), 0.158, 0.158, 0.02, seg=10)
    a.ball('Cream', (0, 0, 0.19), (0.13, 0.13, 0.04), sub=1)
    a.ball('Fruit', (-0.05, 0.02, 0.22), (0.05, 0.05, 0.05), sub=1)
    a.ball('Tomato', (0.05, -0.03, 0.22), (0.045, 0.045, 0.045), sub=1)
    a.ball('Leaf', (0.01, 0.06, 0.23), (0.07, 0.03, 0.02), sub=1, rot=(0, 0, 0.6))
    return a


def cadastre():
    """Taxe foncière: a boundary stone and a surveyor's tripod."""
    a = Asset('cadastre')
    a.cube('Plaster', (-0.18, 0, 0.12), (0.1, 0.1, 0.24))
    a.cube('FlagRed', (-0.18, 0, 0.26), (0.1, 0.1, 0.04))
    top = Vector((0.15, 0.02, 0.46))
    for ang in (0.5, 2.6, 4.7):
        a.along('Wood', (0.15 + math.cos(ang) * 0.15, 0.02 + math.sin(ang) * 0.15, 0), top, 0.014, 0.01, seg=4)
    a.cube('Sign', (0.15, 0.02, 0.51), (0.1, 0.07, 0.07))
    a.cyl('Glass', (0.15, -0.04, 0.52), 0.022, 0.022, 0.06, seg=6, rot=(math.pi / 2, 0, 0))
    a.cyl('White', (-0.02, -0.2, 0.025), 0.025, 0.025, 0.24, seg=6, rot=(0, math.pi / 2, 0))
    return a


def prison():
    """The fonja: a walled yard with a barred gate and a watchtower."""
    a = Asset('prison')
    a.cube('Stone', (0, 0.2, 0.25), (0.7, 0.3, 0.5))
    a.cube('RockDark', (0, 0.2, 0.52), (0.74, 0.34, 0.05))
    for x in (-0.22, 0, 0.22):
        a.cube('Black', (x, 0.049, 0.33), (0.1, 0.01, 0.12))
        for dx in (-0.03, 0, 0.03):
            a.cube('Grey', (x + dx, 0.04, 0.33), (0.014, 0.014, 0.13))
    a.cube('Stone', (-0.37, -0.1, 0.15), (0.06, 0.6, 0.3))
    a.cube('Stone', (0.37, -0.1, 0.15), (0.06, 0.6, 0.3))
    a.cube('Stone', (-0.25, -0.4, 0.15), (0.26, 0.06, 0.3))
    a.cube('Stone', (0.25, -0.4, 0.15), (0.26, 0.06, 0.3))
    for i in range(6):
        a.cyl('Black', (-0.1 + i * 0.04, -0.4, 0.14), 0.009, 0.009, 0.28, seg=4)
    a.cube('Black', (0, -0.4, 0.28), (0.26, 0.02, 0.025))
    a.cube('Stone', (0.37, -0.4, 0.3), (0.13, 0.13, 0.6))
    a.cube('RockDark', (0.37, -0.4, 0.62), (0.19, 0.19, 0.04))
    a.cyl('RockDark', (0.37, -0.4, 0.7), 0.14, 0.0, 0.12, seg=4, rot=(0, 0, math.pi / 4))
    return a


def roadblock():
    """Barrage: the gendarmerie checkpoint, boom across the road."""
    a = Asset('roadblock')
    a.cube('Plaster', (0.3, 0.15, 0.2), (0.3, 0.3, 0.4))
    a.cube('FlagGreen', (0.3, 0.15, 0.42), (0.36, 0.36, 0.04))
    a.cube('Glass', (0.3, -0.001, 0.25), (0.16, 0.01, 0.1))
    a.cube('Black', (-0.42, -0.25, 0.14), (0.06, 0.06, 0.28))
    for i in range(6):
        a.cube('Stripe' if i % 2 == 0 else 'White', (-0.36 + i * 0.12, -0.25, 0.26), (0.12, 0.035, 0.035))
    for x in (-0.2, 0.05):
        a.cyl('Fruit', (x, -0.42, 0.06), 0.05, 0.01, 0.12, seg=6)
        a.cyl('White', (x, -0.42, 0.07), 0.034, 0.03, 0.02, seg=6)
    a.cyl('BarkGrey', (0.0, 0.05, 0.25), 0.01, 0.01, 0.5, seg=4)
    a.cyl('FlagRed', (0.0, 0.04, 0.52), 0.1, 0.1, 0.015, seg=8, rot=(math.pi / 2, 0, math.pi / 8))
    a.cube('White', (0, 0.03, 0.52), (0.12, 0.005, 0.025))
    return a


# ---------- Landmarks of the sites, in board order ----------

def pousse_pousse():
    """Antsirabe: the pousse-pousse, the town's rickshaws."""
    a = Asset('pousse_pousse')
    for x in (-0.19, 0.19):
        a.cyl('Tire', (x, 0.06, 0.2), 0.2, 0.2, 0.04, seg=12, rot=(0, math.pi / 2, 0))
        a.cyl('White', (x, 0.06, 0.2), 0.05, 0.05, 0.05, seg=6, rot=(0, math.pi / 2, 0))
    a.cube('PousseBlue', (0, 0.05, 0.3), (0.32, 0.24, 0.14))
    a.cube('PousseBlue', (0, 0.16, 0.44), (0.32, 0.04, 0.24))
    a.cube('Cream', (0, 0.0, 0.37), (0.28, 0.16, 0.03))
    a.cube('Cream', (0, 0.1, 0.62), (0.34, 0.24, 0.03), rot=(-0.45, 0, 0))
    a.cube('Stripe', (0, 0.15, 0.3), (0.33, 0.02, 0.06))
    a.cube('Wood', (0, -0.12, 0.22), (0.26, 0.12, 0.02))
    for x in (-0.13, 0.13):
        a.along('Wood', (x, -0.05, 0.28), (x, -0.62, 0.1), 0.016, 0.014, seg=5)
    a.along('Wood', (-0.13, -0.6, 0.1), (0.13, -0.6, 0.1), 0.012, 0.012, seg=4)
    return a


def crater_lake():
    """Lac Tritriva: a crater lake with emerald water."""
    a = Asset('crater_lake')
    a.cyl('LeafDark', (0, 0, 0.11), 0.6, 0.44, 0.22, seg=12)
    a.cyl('Emerald', (0, 0, 0.22), 0.37, 0.37, 0.02, seg=12)
    rng = random.Random(7)
    for i in range(9):
        ang = i / 9 * math.tau + rng.random() * 0.3
        a.ball('Rock' if i % 2 else 'RockDark', (math.cos(ang) * 0.42, math.sin(ang) * 0.42, 0.22), (0.08, 0.08, 0.06), sub=0)
    for ang in (2.2, 3.6, 0.6):
        x, y = math.cos(ang) * 0.5, math.sin(ang) * 0.5
        a.cyl('Bark', (x, y, 0.3), 0.02, 0.015, 0.2, seg=5)
        a.ball('Leaf', (x, y, 0.45), (0.1, 0.1, 0.12), sub=1)
    return a


def zafimaniry():
    """Ambositra: a carved Zafimaniry wooden house."""
    a = Asset('zafimaniry')
    a.cube('RockDark', (0, 0, 0.03), (0.56, 0.42, 0.06))
    a.cube('Wood', (0, 0, 0.26), (0.5, 0.36, 0.4))
    a.prism('Thatch', (0, 0, 0.46), 0.6, 0.48, 0.42)
    a.cube('WoodDark', (0, -0.181, 0.22), (0.12, 0.01, 0.26))
    for x in (-0.17, 0.17):
        for z in (0.16, 0.26, 0.36):
            a.cube('Cream', (x, -0.183, z), (0.05, 0.01, 0.05), rot=(0, math.pi / 4, 0))
    for x in (-0.25, 0.25):
        a.cube('WoodDark', (x, -0.18, 0.26), (0.04, 0.03, 0.4))
    for s in (-1, 1):
        a.along('WoodDark', (s * 0.27, 0, 0.82), (s * 0.36, 0, 0.98), 0.016, 0.01, seg=4)
    return a


def bamboo():
    """Ranomafana: rainforest bamboo, a golden bamboo lemur, a hot spring."""
    a = Asset('bamboo')
    rng = random.Random(11)
    for i in range(7):
        ang = rng.random() * math.tau
        r = 0.08 + rng.random() * 0.22
        base = Vector((0.1 + math.cos(ang) * r, 0.12 + math.sin(ang) * r, 0))
        top = base + Vector((rng.uniform(-0.12, 0.12), rng.uniform(-0.12, 0.12), 0.8 + rng.random() * 0.4))
        a.along('Bamboo', base, top, 0.028, 0.02, seg=6)
        for k in (0.3, 0.55, 0.8):
            a.ball('LeafDark', base.lerp(top, k), (0.032, 0.032, 0.012), sub=0)
        a.ball('Leaf' if i % 2 else 'LeafDark', top + Vector((0, 0, 0.02)), (0.14, 0.14, 0.07), sub=1)
    with a.at((-0.28, -0.2, 0), (0, 0, 0.5), 0.5):
        lemur_parts(a, fur='Gold', belly='Cream', ring='Gold')
    a.cyl('Water', (0.3, -0.3, 0.02), 0.15, 0.16, 0.03, seg=10)
    a.ball('White', (0.3, -0.3, 0.14), (0.06, 0.06, 0.05), sub=1)
    a.ball('White', (0.33, -0.28, 0.24), (0.045, 0.045, 0.04), sub=1)
    return a


def train():
    """Fianarantsoa: the FCE train down to the east coast."""
    a = Asset('train')
    for y in (-0.07, 0.07):
        a.cube('Rail', (0, y, 0.025), (1.3, 0.02, 0.02))
    for i in range(9):
        a.cube('WoodDark', (-0.6 + i * 0.15, 0, 0.01), (0.05, 0.26, 0.02))
    a.cube('Train', (0.32, 0, 0.2), (0.46, 0.22, 0.22))
    a.cube('BusCream', (0.32, 0, 0.13), (0.47, 0.225, 0.05))
    a.cube('Train', (0.2, 0, 0.37), (0.2, 0.2, 0.14))
    a.cube('Glass', (0.2, 0, 0.38), (0.21, 0.205, 0.06))
    a.cyl('Black', (0.46, 0, 0.36), 0.03, 0.04, 0.1, seg=6)
    a.cube('Yellow', (0.555, 0, 0.18), (0.01, 0.12, 0.04))
    a.cube('BusCream', (-0.25, 0, 0.22), (0.56, 0.22, 0.24))
    a.cube('Stripe', (-0.25, 0, 0.14), (0.565, 0.225, 0.04))
    a.cube('Glass', (-0.25, 0, 0.27), (0.5, 0.226, 0.07))
    a.cube('Grey', (-0.25, 0, 0.355), (0.58, 0.24, 0.03))
    for x in (-0.42, -0.08, 0.18, 0.46):
        for y in (-0.1, 0.1):
            a.cyl('Black', (x, y, 0.08), 0.05, 0.05, 0.03, seg=8, rot=(math.pi / 2, 0, 0))
    return a


def zebu_market():
    """Ambalavao: the great zebu market."""
    a = Asset('zebu_market')
    w, d = 0.9, 0.62
    posts = [(-w / 2 + i * w / 4, s * d / 2) for i in range(5) for s in (-1, 1)]
    posts += [(s * w / 2, -d / 2 + j * d / 3) for j in (1, 2) for s in (-1, 1)]
    for x, y in posts:
        a.cube('WoodDark', (x, y, 0.13), (0.03, 0.03, 0.26))
    for z in (0.12, 0.22):
        for s in (-1, 1):
            a.cube('Wood', (0, s * d / 2, z), (w, 0.015, 0.02))
            a.cube('Wood', (s * w / 2, 0, z), (0.015, d, 0.02))
    for loc, rot in (((-0.22, 0.06, 0), 0.6), ((0.2, -0.06, 0), -2.4), ((0.04, 0.14, 0), 1.9)):
        with a.at(loc, (0, 0, rot), 0.6):
            zebu_parts(a)
    return a


def isalo_window():
    """Isalo: the sandstone 'window' the sun sets through."""
    a = Asset('isalo_window')
    a.cube('Sandstone', (0, 0.05, 0.12), (1.05, 0.55, 0.24))
    a.cube('RockRed', (-0.32, 0.05, 0.5), (0.34, 0.45, 0.56), rot=(0, 0, 0.05))
    a.cube('Sandstone', (0.32, 0.05, 0.5), (0.34, 0.45, 0.56), rot=(0, 0, -0.04))
    a.cube('RockRed', (0, 0.05, 0.88), (1.0, 0.47, 0.22))
    a.cube('Sandstone', (0.05, 0.08, 1.02), (0.7, 0.36, 0.08))
    a.cyl('Amber', (0, 0.33, 0.5), 0.12, 0.12, 0.02, seg=10, rot=(math.pi / 2, 0, 0))
    for x, y in ((-0.45, -0.25), (0.48, -0.22), (0.1, -0.26)):
        a.cyl('Thatch', (x, y, 0.29), 0.05, 0.0, 0.1, seg=5)
    return a


def sapphire_mine():
    """Ilakaka: a sapphire pit, its hoist, sieve and gravel."""
    a = Asset('sapphire_mine')
    a.cyl('Brick', (0, 0.05, 0.05), 0.4, 0.3, 0.1, seg=10)
    a.cyl('Black', (0, 0.05, 0.1), 0.17, 0.17, 0.012, seg=10)
    top = Vector((0, 0.05, 0.62))
    for ang in (0.3, 2.4, 4.5):
        a.along('Wood', (math.cos(ang) * 0.3, 0.05 + math.sin(ang) * 0.3, 0.08), top, 0.018, 0.012, seg=5)
    a.cyl('WoodDark', top + Vector((0, 0, -0.05)), 0.045, 0.045, 0.05, seg=6, rot=(0, math.pi / 2, 0))
    a.cyl('Black', (0, 0.05, 0.36), 0.005, 0.005, 0.46, seg=3)
    a.cyl('Basket', (0, 0.05, 0.14), 0.05, 0.04, 0.06, seg=6)
    a.cyl('Stone', (0.38, -0.25, 0.06), 0.16, 0.02, 0.12, seg=7)
    a.cyl('Basket', (-0.36, -0.25, 0.03), 0.13, 0.13, 0.03, seg=10)
    with a.at((0.38, -0.25, 0.1), scale=0.7):
        sapphire_parts(a)
    return a


def fort():
    """Taolagnaro: the walls of Fort Flacourt, a cannon facing the sea."""
    a = Asset('fort')
    a.cube('Stone', (0, 0.25, 0.18), (0.9, 0.12, 0.36))
    a.cube('Stone', (-0.39, -0.02, 0.18), (0.12, 0.5, 0.36))
    for i in range(7):
        a.cube('Stone', (-0.39 + i * 0.13, 0.25, 0.39), (0.07, 0.12, 0.06))
    for i in range(3):
        a.cube('Stone', (-0.39, 0.12 - i * 0.13, 0.39), (0.12, 0.07, 0.06))
    a.cyl('Stone', (-0.39, 0.25, 0.24), 0.14, 0.14, 0.48, seg=10)
    a.cyl('RockDark', (-0.39, 0.25, 0.49), 0.15, 0.15, 0.03, seg=10)
    a.cube('WoodDark', (0.12, -0.08, 0.06), (0.14, 0.22, 0.08))
    for x in (0.04, 0.2):
        a.cyl('WoodDark', (x, -0.08, 0.06), 0.05, 0.05, 0.03, seg=8, rot=(0, math.pi / 2, 0))
    a.cyl('Black', (0.12, -0.15, 0.14), 0.045, 0.03, 0.36, seg=8, rot=(math.pi / 2 - 0.15, 0, 0))
    return a


def sifaka():
    """Berenty: a 'dancing' sifaka hopping by a tamarind tree."""
    a = Asset('sifaka')
    a.cyl('Bark', (0.28, 0.28, 0.3), 0.05, 0.035, 0.6, seg=7)
    a.ball('LeafDark', (0.28, 0.28, 0.66), (0.2, 0.18, 0.12), sub=1)
    a.ball('Leaf', (0.36, 0.2, 0.72), (0.12, 0.12, 0.08), sub=1)
    with a.at((-0.15, -0.1, 0.12)):
        a.ball('White', (0, 0, 0.32), (0.11, 0.1, 0.18), sub=2, rot=(0, 0.35, 0))
        a.ball('White', (0.06, 0, 0.53), (0.08, 0.08, 0.08), sub=2)
        a.ball('Black', (0.12, 0, 0.52), (0.035, 0.05, 0.045), sub=1)
        a.ball('Coat', (0.04, 0, 0.6), (0.06, 0.055, 0.03), sub=1)
        for s in (-1, 1):
            a.along('White', (0.02, s * 0.08, 0.42), (-0.06, s * 0.25, 0.6), 0.026, 0.02, seg=5)
            a.along('White', (-0.02, s * 0.06, 0.2), (0.07 if s > 0 else -0.08, s * 0.09, -0.08), 0.036, 0.03, seg=5)
        a.along('White', (-0.08, 0, 0.18), (-0.32, 0, 0.0), 0.03, 0.02, seg=5)
    return a


def vezo():
    """Anakao: a Vezo fishing pirogue on the beach, nets drying."""
    a = Asset('vezo')
    a.cyl('Sand', (0, 0, 0.015), 0.55, 0.58, 0.03, seg=12)
    with a.at((-0.05, -0.05, 0.02), (0, 0, 0.35)):
        pirogue_parts(a)
    for x in (-0.38, 0.0):
        a.cyl('WoodDark', (x, 0.34, 0.2), 0.012, 0.012, 0.4, seg=4)
    a.cube('Net', (-0.19, 0.34, 0.3), (0.38, 0.008, 0.18))
    for i in range(3):
        a.ball('Grey', (0.28 + i * 0.07, 0.3, 0.05), (0.045, 0.014, 0.018), sub=1)
    return a


def mahafaly_tomb():
    """Toliara: a Mahafaly tomb, its carved aloalo posts and zebu horns."""
    a = Asset('mahafaly_tomb')
    a.cube('Stone', (0, 0.05, 0.1), (0.9, 0.6, 0.2))
    rng = random.Random(9)
    for i in range(14):
        a.cube('RockDark' if i % 3 else 'Rock', (rng.uniform(-0.38, 0.38), 0.1 + rng.uniform(-0.2, 0.2), 0.22),
               (0.08, 0.07, 0.05), rot=(0, 0, rng.random()))
    for x in (-0.3, -0.1, 0.1, 0.3):
        y = -0.18
        a.cube('Wood', (x, y, 0.42), (0.05, 0.04, 0.44))
        for z in (0.35, 0.5):
            a.cube('WoodDark', (x, y, z), (0.09, 0.05, 0.03))
        a.cube('Wood', (x, y, 0.62), (0.1, 0.05, 0.04))
        a.ball('Wood', (x, y, 0.69), (0.04, 0.035, 0.05), sub=1)
    for x in (-0.22, 0.04, 0.28):
        for s in (-1, 1):
            a.along('Horn', (x + s * 0.03, 0.22, 0.24), (x + s * 0.12, 0.22, 0.38), 0.02, 0.008, seg=5)
    return a


def spiny_forest():
    """Ifaty: the spiny forest, octopus trees and a bottle baobab."""
    a = Asset('spiny_forest')
    for i, (x, y) in enumerate(((-0.4, -0.1), (-0.24, 0.22), (-0.06, -0.26), (0.36, 0.26), (0.4, -0.22))):
        base = Vector((x, y, 0))
        h = 0.55 + (i * 0.37) % 0.5
        prev = base
        for k in range(1, 6):
            p = base + Vector((math.sin(k * 1.3 + i) * 0.05, math.cos(k * 1.1 + i) * 0.05, h * k / 5))
            a.along('Sage', prev, p, 0.032, 0.026, seg=5)
            prev = p
        a.cyl('Sage', prev + Vector((0, 0, 0.03)), 0.03, 0.0, 0.08, seg=5)
    a.ball('Bark', (0.1, 0.05, 0.22), (0.18, 0.18, 0.24), sub=2)
    a.cyl('Bark', (0.1, 0.05, 0.5), 0.08, 0.05, 0.26, seg=7)
    for ang in (0, 2.1, 4.2):
        tip = Vector((0.1 + math.cos(ang) * 0.15, 0.05 + math.sin(ang) * 0.15, 0.7))
        a.along('Bark', (0.1, 0.05, 0.6), tip, 0.03, 0.015, seg=4)
        a.ball('Leaf', tip, (0.08, 0.08, 0.05), sub=1)
    return a


def tall_baobab(a, x, y, h):
    """Adansonia grandidieri: a tall smooth trunk, a flat crown."""
    a.cyl('Bark', (x, y, h / 2), 0.1, 0.08, h, seg=8)
    for k in range(5):
        ang = k / 5 * math.tau
        tip = Vector((x + math.cos(ang) * 0.15, y + math.sin(ang) * 0.15, h + 0.1))
        a.along('Bark', (x, y, h - 0.04), tip, 0.03, 0.015, seg=4)
    a.ball('LeafDark', (x, y, h + 0.12), (0.22, 0.22, 0.06), sub=1)


def baobab_alley():
    """Morondava: the Allée des Baobabs."""
    a = Asset('baobab_alley')
    a.cube('Road', (0, 0, 0.005), (0.26, 1.1, 0.01))
    for i, y in enumerate((-0.42, 0, 0.42)):
        tall_baobab(a, -0.28, y, 1.1 + 0.1 * ((i * 7) % 3))
        tall_baobab(a, 0.28, y + 0.08, 1.15 + 0.08 * ((i * 5) % 3))
    return a


def fossa():
    """Kirindy: the fosa, Madagascar's great predator, on a log."""
    a = Asset('fossa')
    a.along('Bark', (-0.42, 0.1, 0.07), (0.42, -0.05, 0.08), 0.075, 0.065, seg=7)
    with a.at((0, 0.02, 0.1)):
        a.ball('Fossa', (0, 0, 0.14), (0.22, 0.08, 0.08), sub=2)
        a.ball('Fossa', (0.24, 0, 0.19), (0.07, 0.06, 0.06), sub=2)
        a.cyl('Fossa', (0.31, 0, 0.18), 0.035, 0.015, 0.06, seg=6, rot=(0, math.pi / 2, 0))
        a.ball('Black', (0.335, 0, 0.18), (0.012, 0.012, 0.012), sub=0)
        for s in (-1, 1):
            a.ball('Fossa', (0.23, s * 0.04, 0.25), (0.022, 0.012, 0.028), sub=0)
            a.ball('Amber', (0.29, s * 0.03, 0.205), (0.013, 0.013, 0.013), sub=0)
            for x in (-0.14, 0.14):
                a.cyl('Fossa', (x, s * 0.05, 0.05), 0.025, 0.02, 0.12, seg=5)
        a.along('Fossa', (-0.2, 0, 0.15), (-0.5, 0, 0.24), 0.035, 0.02, seg=6)
    return a


def tsingy_bridge():
    """Tsingy de Bemaraha: limestone needles and the hanging bridge."""
    a = Asset('tsingy_bridge')
    with a.at((-0.36, 0, 0), scale=0.75):
        tsingy_parts(a, seed=4)
    with a.at((0.36, 0, 0), scale=0.75):
        tsingy_parts(a, seed=6)
    left, right = Vector((-0.24, 0, 0.62)), Vector((0.24, 0, 0.62))
    n = 9
    for i in range(n):
        t = (i + 0.5) / n
        p = left.lerp(right, t)
        p.z -= 0.08 * math.sin(t * math.pi)
        a.cube('Wood', p, (0.045, 0.14, 0.012))
    for y in (-0.07, 0.07):
        prev = left + Vector((0, y, 0.08))
        for i in range(1, n + 1):
            t = i / n
            p = left.lerp(right, t) + Vector((0, y, 0.08))
            p.z -= 0.08 * math.sin(t * math.pi)
            a.along('WoodDark', prev, p, 0.006, 0.006, seg=3)
            prev = p
    return a


def giant_baobab():
    """Mahajanga: the giant baobab on its seafront roundabout."""
    a = Asset('giant_baobab')
    a.cyl('Plaster', (0, 0, 0.04), 0.56, 0.56, 0.08, seg=14)
    a.cyl('Grass', (0, 0, 0.085), 0.5, 0.5, 0.01, seg=14)
    a.cyl('Bark', (0, 0, 0.45), 0.36, 0.3, 0.8, seg=12)
    a.cyl('Bark', (0, 0, 0.95), 0.3, 0.2, 0.25, seg=12)
    rng = random.Random(21)
    for i in range(7):
        ang = i / 7 * math.tau + rng.random() * 0.3
        tip = Vector((math.cos(ang) * 0.5, math.sin(ang) * 0.5, 1.3 + rng.random() * 0.15))
        a.along('Bark', (math.cos(ang) * 0.1, math.sin(ang) * 0.1, 1.02), tip, 0.08, 0.035, seg=5)
        a.ball('Leaf' if i % 2 else 'LeafDark', tip + Vector((0, 0, 0.05)), (0.24, 0.24, 0.1), sub=1)
    return a


def ylang():
    """Nosy Be: ylang-ylang trees and the copper still for the perfume."""
    a = Asset('ylang')
    a.cyl('Bark', (-0.2, 0.05, 0.2), 0.05, 0.04, 0.4, seg=7)
    for k in range(6):
        ang = k / 6 * math.tau
        mid = Vector((-0.2 + math.cos(ang) * 0.18, 0.05 + math.sin(ang) * 0.18, 0.5))
        tip = Vector((-0.2 + math.cos(ang) * 0.32, 0.05 + math.sin(ang) * 0.32, 0.3))
        a.along('Bark', (-0.2, 0.05, 0.38), mid, 0.02, 0.015, seg=4)
        a.along('Bark', mid, tip, 0.015, 0.01, seg=4)
        a.ball('LeafDark', mid, (0.1, 0.1, 0.05), sub=1)
        a.ball('Yellow', tip, (0.04, 0.04, 0.055), sub=1)
    a.cyl('Brick', (0.25, 0.0, 0.08), 0.13, 0.15, 0.16, seg=8)
    a.cyl('Copper', (0.25, 0.0, 0.25), 0.11, 0.11, 0.18, seg=10)
    a.ball('Copper', (0.25, 0.0, 0.34), (0.11, 0.11, 0.08), sub=1)
    a.along('Copper', (0.25, 0, 0.4), (0.45, -0.05, 0.3), 0.015, 0.012, seg=5)
    a.cyl('Wood', (0.45, -0.05, 0.12), 0.07, 0.07, 0.24, seg=8)
    return a


def cacao():
    """Ambanja: Sambirano cacao, pods on the trunk, beans drying."""
    a = Asset('cacao')
    a.cyl('Bark', (-0.1, 0.05, 0.3), 0.05, 0.04, 0.6, seg=7)
    a.ball('LeafDark', (-0.1, 0.05, 0.72), (0.3, 0.28, 0.2), sub=1)
    a.ball('Leaf', (0.05, 0.1, 0.8), (0.16, 0.16, 0.12), sub=1)
    for i, (z, ang) in enumerate(((0.2, 0.3), (0.32, 2.4), (0.42, 4.2), (0.27, 5.4))):
        a.ball('Pod' if i % 2 else 'Tomato', (-0.1 + math.cos(ang) * 0.07, 0.05 + math.sin(ang) * 0.07, z), (0.045, 0.045, 0.075), sub=1)
    a.cube('Basket', (0.3, -0.15, 0.04), (0.34, 0.26, 0.04))
    for i in range(10):
        a.ball('WoodDark', (0.2 + (i % 5) * 0.05, -0.2 + (i // 5) * 0.1, 0.07), (0.022, 0.015, 0.012), sub=0)
    return a


def waterfall():
    """Montagne d'Ambre: rainforest waterfalls and tree ferns."""
    a = Asset('waterfall')
    a.cube('RockDark', (0, 0.25, 0.4), (0.9, 0.3, 0.8))
    a.cube('LeafDark', (0, 0.25, 0.83), (0.94, 0.34, 0.08))
    a.cube('Water', (0, 0.09, 0.42), (0.2, 0.03, 0.8))
    a.cyl('Water', (0, -0.12, 0.02), 0.32, 0.34, 0.04, seg=12)
    for x in (-0.08, 0.08):
        a.ball('White', (x, -0.02, 0.06), (0.08, 0.06, 0.04), sub=1)
    for x in (-0.38, 0.38):
        a.cyl('Bark', (x, -0.05, 0.25), 0.025, 0.02, 0.5, seg=5)
        for k in range(6):
            ang = k / 6 * math.tau
            a.ball('Leaf', (x + math.cos(ang) * 0.12, -0.05 + math.sin(ang) * 0.12, 0.5), (0.13, 0.03, 0.015), sub=1,
                   rot=(0, 0.4, ang))
    return a


def sugarloaf():
    """Antsiranana: the Pain de Sucre rising from Diego bay."""
    a = Asset('sugarloaf')
    a.cyl('Lagoon', (0, 0, 0.015), 0.55, 0.55, 0.03, seg=14)
    a.cyl('Rock', (0, 0.05, 0.35), 0.24, 0.17, 0.66, seg=10)
    a.ball('Rock', (0, 0.05, 0.68), (0.17, 0.17, 0.12), sub=1)
    a.ball('LeafDark', (0, 0.05, 0.73), (0.15, 0.15, 0.08), sub=1)
    with a.at((0.3, -0.3, 0.02), (0, 0, 0.5), 0.5):
        pirogue_parts(a)
    return a


def dhow():
    """Mer d'Émeraude: a boutre under sail on the turquoise lagoon."""
    a = Asset('dhow')
    a.cyl('Emerald', (0, 0, 0.015), 0.55, 0.55, 0.03, seg=14)
    a.cube('Wood', (0, 0, 0.1), (0.6, 0.2, 0.1))
    a.cyl('Wood', (0.38, 0, 0.11), 0.1, 0.0, 0.16, seg=6, rot=(0, math.pi / 2, 0))
    a.cube('WoodDark', (0, 0, 0.155), (0.62, 0.21, 0.02))
    a.cyl('WoodDark', (0.05, 0, 0.45), 0.015, 0.012, 0.7, seg=5)
    a.along('WoodDark', (-0.35, 0, 0.3), (0.45, 0, 0.84), 0.012, 0.01, seg=4)
    a.plate('Sail', [(-0.33, 0, 0.31), (0.43, 0, 0.81), (0.1, 0, 0.2)])
    return a


def vanilla():
    """Sambava: vanilla vines on their stakes, pods drying on a mat."""
    a = Asset('vanilla')
    for x in (-0.3, 0.0):
        a.cyl('BarkGrey', (x, 0.15, 0.35), 0.03, 0.025, 0.7, seg=6)
        prev = Vector((x + 0.045, 0.15, 0.02))
        for k in range(1, 13):
            ang = k * 0.9
            p = Vector((x + math.cos(ang) * 0.045, 0.15 + math.sin(ang) * 0.045, 0.02 + k * 0.055))
            a.along('Leaf', prev, p, 0.012, 0.012, seg=4)
            prev = p
            if k % 3 == 0:
                a.ball('LeafDark', p + Vector((math.cos(ang) * 0.05, math.sin(ang) * 0.05, 0)), (0.06, 0.025, 0.035), sub=1,
                       rot=(0, 0, ang))
        for k in range(3):
            a.cyl('Green', (x + 0.07, 0.1 + k * 0.02, 0.32), 0.009, 0.009, 0.14, seg=4)
    a.cube('Basket', (0.3, -0.12, 0.02), (0.36, 0.3, 0.03))
    for i in range(7):
        a.cyl('Vanilla', (0.16 + i * 0.045, -0.12, 0.045), 0.01, 0.01, 0.24, seg=4, rot=(math.pi / 2, 0, 0))
    return a


def peaks():
    """Marojejy: steep forested peaks in the clouds."""
    a = Asset('peaks')
    for x, y, h, r in ((-0.25, 0.1, 0.95, 0.32), (0.15, 0.2, 0.75, 0.3), (0.35, -0.12, 0.55, 0.22)):
        a.cyl('LeafDark', (x, y, h / 2), r, 0.05, h, seg=7)
        a.cyl('Rock', (x, y, h * 0.92), r * 0.2, 0.0, h * 0.16, seg=7)
    for p in ((-0.06, 0.0, 0.62), (0.16, -0.05, 0.56), (-0.3, 0.05, 0.42)):
        a.ball('White', p, (0.17, 0.1, 0.06), sub=1)
    return a


def aye_aye():
    """Masoala: the aye-aye on a rainforest branch."""
    a = Asset('aye_aye')
    a.cyl('Bark', (-0.35, 0.08, 0.2), 0.06, 0.05, 0.4, seg=6)
    a.along('Bark', (-0.42, 0.06, 0.3), (0.45, 0.0, 0.42), 0.045, 0.035, seg=7)
    a.ball('LeafDark', (-0.38, 0.14, 0.62), (0.24, 0.22, 0.16), sub=1)
    with a.at((0.05, 0.02, 0.37)):
        a.ball('Black', (0, 0, 0.1), (0.13, 0.09, 0.09), sub=2)
        a.ball('Grey', (0.14, 0, 0.16), (0.07, 0.065, 0.065), sub=2)
        for s in (-1, 1):
            a.ball('Black', (0.11, s * 0.07, 0.25), (0.02, 0.06, 0.075), sub=1, rot=(s * 0.3, 0, 0))
            a.ball('Amber', (0.195, s * 0.032, 0.18), (0.024, 0.024, 0.024), sub=1)
            a.ball('Black', (0.212, s * 0.032, 0.18), (0.01, 0.01, 0.01), sub=0)
            a.along('Black', (0.0, s * 0.06, 0.05), (0.02, s * 0.07, -0.05), 0.02, 0.015, seg=4)
        a.along('Black', (0.1, 0.05, 0.08), (0.22, 0.08, -0.02), 0.012, 0.004, seg=4)
        a.along('Grey', (-0.12, 0, 0.1), (-0.32, 0, 0.3), 0.05, 0.065, seg=6)
    return a


def pirate_cemetery():
    """Nosy Boraha: the pirates' cemetery, skull and crossbones."""
    a = Asset('pirate_cemetery')
    a.cyl('Grass', (0, 0, 0.01), 0.55, 0.57, 0.02, seg=12)
    rng = random.Random(17)
    for i, (x, y) in enumerate(((-0.3, 0.2), (0.0, 0.25), (0.3, 0.15), (-0.18, -0.12), (0.2, -0.14))):
        tilt = rng.uniform(-0.15, 0.15)
        if i % 2 == 0:
            a.cube('Stone', (x, y, 0.13), (0.16, 0.05, 0.24), rot=(tilt, 0, 0))
            a.cyl('Stone', (x, y, 0.25), 0.08, 0.08, 0.05, seg=8, rot=(math.pi / 2, 0, 0))
        else:
            a.cube('RockDark', (x, y, 0.15), (0.035, 0.035, 0.3), rot=(0, tilt, 0))
            a.cube('RockDark', (x, y, 0.22), (0.14, 0.035, 0.035), rot=(0, tilt, 0))
    a.ball('White', (-0.3, 0.17, 0.18), (0.036, 0.02, 0.036), sub=1)
    for s in (-1, 1):
        a.cube('White', (-0.3, 0.17, 0.11), (0.12, 0.012, 0.018), rot=(0, s * 0.6, 0))
    return a


def port_crane():
    """Toamasina: the island's great port, its crane and a crate of lychees."""
    a = Asset('port_crane')
    a.cube('Stone', (0, 0.05, 0.04), (1.0, 0.6, 0.08))
    for x, y, z, m in ((-0.3, 0.15, 0.13, 'ContainerBlue'), (-0.3, 0.15, 0.23, 'Rust'), (-0.05, 0.18, 0.13, 'ContainerGreen'),
                       (-0.02, -0.1, 0.13, 'FlagRed')):
        a.cube(m, (x, y, z), (0.24, 0.12, 0.1))
    for x in (0.25, 0.42):
        for y in (-0.05, 0.2):
            a.cube('Rust', (x, y, 0.4), (0.03, 0.03, 0.64))
    a.cube('Rust', (0.335, 0.075, 0.74), (0.24, 0.32, 0.06))
    a.cube('Yellow', (0.335, 0.075, 0.82), (0.16, 0.14, 0.1))
    a.cube('Rust', (0.05, 0.075, 0.8), (0.75, 0.04, 0.04), rot=(0, -0.12, 0))
    a.cyl('Black', (-0.25, 0.075, 0.63), 0.004, 0.004, 0.36, seg=3)
    a.cube('Grey', (-0.25, 0.075, 0.44), (0.05, 0.05, 0.03))
    a.cube('Wood', (0.3, -0.28, 0.12), (0.16, 0.12, 0.08))
    for i in range(6):
        a.ball('Tomato', (0.25 + (i % 3) * 0.05, -0.3 + (i // 3) * 0.04, 0.17), (0.024, 0.024, 0.024), sub=0)
    return a


def indri():
    """Andasibe: the indri, the singing lemur, clinging to a trunk."""
    a = Asset('indri')
    a.cyl('Bark', (0, 0.12, 0.5), 0.07, 0.05, 1.0, seg=8)
    a.ball('LeafDark', (0, 0.12, 1.05), (0.28, 0.26, 0.18), sub=1)
    a.ball('Leaf', (0.15, 0.05, 0.92), (0.15, 0.15, 0.1), sub=1)
    with a.at((0, 0.03, 0.42)):
        a.ball('Black', (0, 0, 0.1), (0.1, 0.08, 0.15), sub=2)
        a.ball('White', (0, -0.04, 0.0), (0.08, 0.05, 0.07), sub=1)
        a.ball('Black', (0, -0.02, 0.29), (0.07, 0.07, 0.07), sub=2)
        a.ball('White', (0, -0.08, 0.27), (0.045, 0.03, 0.04), sub=1)
        a.ball('Black', (0, -0.105, 0.27), (0.016, 0.016, 0.016), sub=0)
        for s in (-1, 1):
            a.ball('Black', (s * 0.06, 0, 0.35), (0.025, 0.015, 0.025), sub=0)
            a.ball('Amber', (s * 0.025, -0.095, 0.29), (0.012, 0.012, 0.012), sub=0)
            a.along('Black', (s * 0.07, 0, 0.18), (s * 0.06, 0.08, 0.3), 0.025, 0.02, seg=5)
            a.along('White', (s * 0.06, -0.02, -0.02), (s * 0.05, 0.06, -0.2), 0.035, 0.025, seg=5)
    return a


def anosy():
    """Lac Anosy: the heart-shaped lake, the black angel, the jacarandas."""
    a = Asset('anosy')
    for x in (-0.13, 0.13):
        a.cyl('Water', (x, 0.08, 0.012), 0.26, 0.26, 0.024, seg=12)
    a.poly('Water', [(-0.36, 0.0, 0.0), (0.36, 0.0, 0.0), (0, -0.42, 0.0), (-0.36, 0.0, 0.024), (0.36, 0.0, 0.024),
                     (0, -0.42, 0.024)], [(2, 1, 0), (3, 4, 5), (0, 1, 4, 3), (1, 2, 5, 4), (2, 0, 3, 5)])
    a.cyl('Grass', (0, 0.02, 0.03), 0.12, 0.13, 0.04, seg=10)
    a.cyl('Stone', (0, 0.02, 0.07), 0.07, 0.07, 0.04, seg=8)
    a.cyl('Stone', (0, 0.02, 0.33), 0.035, 0.03, 0.5, seg=8)
    a.ball('Black', (0, 0.02, 0.63), (0.035, 0.03, 0.07), sub=1)
    a.ball('Black', (0, 0.02, 0.72), (0.026, 0.026, 0.026), sub=1)
    for s in (-1, 1):
        a.plate('Black', [(0, 0, 0), (s * 0.13, 0, 0.1), (s * 0.05, 0, -0.07)], loc=(0, 0.045, 0.65))
    for x, y in ((-0.42, 0.3), (0.42, 0.28), (0.45, -0.2)):
        a.cyl('Bark', (x, y, 0.15), 0.025, 0.02, 0.3, seg=5)
        a.ball('Purple', (x, y, 0.36), (0.15, 0.15, 0.11), sub=1)
    return a


def stone_gate():
    """Ambohimanga: the royal hill's gate and the stone disc that closed it."""
    a = Asset('stone_gate')
    a.cube('Stone', (-0.33, 0.12, 0.22), (0.34, 0.22, 0.44))
    a.cube('Stone', (0.33, 0.12, 0.22), (0.34, 0.22, 0.44))
    a.cube('Stone', (0, 0.12, 0.41), (0.32, 0.22, 0.06))
    a.cube('Black', (0, 0.12, 0.19), (0.3, 0.2, 0.38))
    a.cyl('RockDark', (0.17, -0.04, 0.2), 0.2, 0.2, 0.07, seg=14, rot=(math.pi / 2, 0, 0))
    a.cyl('Bark', (-0.3, 0.38, 0.35), 0.06, 0.05, 0.7, seg=7)
    a.ball('LeafDark', (-0.3, 0.38, 0.82), (0.3, 0.26, 0.2), sub=1)
    return a


BUILDERS = [
    # Pawns
    zebu, lemur, chameleon, taxi,
    # On the sites
    house, hotel, flag, cage,
    # Special cells
    market, busstop, sapphire, sobika, office, cadastre, stage, cyclone, prison, roadblock,
    # Landmarks, in board order
    pousse_pousse, crater_lake, zafimaniry, bamboo, train, zebu_market, isalo_window, sapphire_mine, fort, sifaka,
    vezo, mahafaly_tomb, spiny_forest, baobab_alley, fossa, tsingy_bridge, giant_baobab, ylang, cacao, waterfall,
    sugarloaf, dhow, vanilla, peaks, aye_aye, pirate_cemetery, port_crane, indri, anosy, stone_gate, rova,
    # Scenery
    baobab, ravinala, palm, tsingy, hut, pirogue, whale,
]


def rebuild():
    coll = bpy.data.collections.get(COLLECTION)
    if coll is None:
        coll = bpy.data.collections.new(COLLECTION)
        bpy.context.scene.collection.children.link(coll)
    for obj in list(coll.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in [m for m in bpy.data.meshes if m.users == 0]:
        bpy.data.meshes.remove(mesh)
    return [b().build(coll, i) for i, b in enumerate(BUILDERS)]


def export(path):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in bpy.data.collections[COLLECTION].objects:
        obj.select_set(True)
    # The game draws with flat shading: no normals or UVs needed, and the file is a third of the size.
    bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_apply=True, export_yup=True,
                              export_normals=False, export_texcoords=False)


objects = rebuild()
print('built', len(objects), 'assets,', sum(len(o.data.polygons) for o in objects), 'faces')
