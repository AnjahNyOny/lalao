"""
Low-poly assets for Kalesa (a race on the roads of Madagascar), built from code.

Run inside Blender (background is fine):
    blender -b --python-expr "exec(open('assets/blender/kalesa_assets.py').read(), {'__file__': 'assets/blender/kalesa_assets.py'})"
It borrows the helpers of tsena_assets.py (Asset, palette), rebuilds the
'Kalesa' collection, then `export_kalesa(path)` writes the .glb and
`render_cars(dir)` the lobby's pictures of the cars.

Conventions: Z up, 1 unit = 1 metre. Cars face +X; their origin is halfway
between the axles, at axle height: the game draws the wheels (whatever the
player traced) and lifts the body to their hubs. CAR_WHEELS gives each
car's wheel positions, as the game's games/kalesa/cars.ts does.
Scenery stands on its base centre.

The cult cars of Madagascar: the cream Renault 4 taxis of Antananarivo, the
2CV, the Peugeot 404 pick-up with its canvas, the loaded taxi-brousse, the
Karenjy (built in Fianarantsoa) and the bajaj of the coastal towns.
"""
import math
import os
import random

import bpy
from mathutils import Euler, Vector

HERE = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else '/Users/mac/Projects/game/assets/blender'
_helpers = {'KEEP_SCENE': True}
exec(open(os.path.join(HERE, 'tsena_assets.py')).read(), _helpers)
Asset = _helpers['Asset']
PALETTE = _helpers['PALETTE']
zebu_parts = _helpers['zebu_parts']
PALETTE.update({
    'TaxiCream': '#ecdcab',
    'DeucheRed': '#c9433a',
    'PeugeotBlue': '#2f6cb3',
    'BrousseTeal': '#169b93',
    'KarenjyOrange': '#e27a2c',
    'BajajLime': '#86c440',
    'Chrome': '#c9cdd2',
    'Trim': '#3a3b3e',
    'Under': '#2a2a2c',
    'Canvas': '#36363a',
    'Khaki': '#a39563',
    'KhakiDark': '#7d7248',
    'Sack': '#ddcb9b',
    'Lamp': '#fff4c8',
    'Indicator': '#f39c32',
    'TailRed': '#c0282d',
    'Seat': '#7a4a2e',
    'Mattress': '#4f7fc2',
    'Banana': '#f2cf3c',
    'Charcoal': '#2e2b29',
    'Brick': '#b0553a',
    'Eucalyptus': '#8aa58a',
    'EucaBark': '#cfc4b3',
    'Pine': '#3f6b45',
})

COLLECTION = 'Kalesa'

# Where the game puts each car's wheels: (x forward, y to the left), metres from the car's origin.
CAR_WHEELS = {
    'taxi4l': [(1.2, 0.8), (1.2, -0.8), (-1.2, 0.8), (-1.2, -0.8)],
    'deuche': [(1.2, 0.78), (1.2, -0.78), (-1.2, 0.78), (-1.2, -0.78)],
    'bachee': [(1.4, 0.86), (1.4, -0.86), (-1.4, 0.86), (-1.4, -0.86)],
    'brousse': [(1.4, 0.9), (1.4, -0.9), (-1.5, 0.9), (-1.5, -0.9)],
    'karenjy': [(1.15, 0.86), (1.15, -0.86), (-1.15, 0.86), (-1.15, -0.86)],
    'bajaj': [(1.0, 0.0), (-0.7, 0.7), (-0.7, -0.7)],
}


# ---------- Helpers ----------

def side(a, mat, pts, y0, y1):
    """A slab from a side silhouette: the polygon pts (x, z) pushed from y0 to y1."""
    n = len(pts)
    verts = [(x, y0, z) for x, z in pts] + [(x, y1, z) for x, z in pts]
    faces = [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))]
    faces += [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    a.poly(mat, verts, faces)


def sym(a, mat, pts, w):
    """A slab as wide as 2w, centred on the car."""
    side(a, mat, pts, -w, w)


def pane(a, mat, p0, p1, w, t=0.025):
    """A thin plate (a windscreen) from p0 to p1 in the side view, 2w wide, standing t proud of the body."""
    (x0, z0), (x1, z1) = p0, p1
    dx, dz = x1 - x0, z1 - z0
    L = math.hypot(dx, dz)
    nx, nz = dz / L, -dx / L  # outward, to the right of p0 -> p1
    sym(a, mat, [(x0, z0), (x1, z1), (x1 + nx * t, z1 + nz * t), (x0 + nx * t, z0 + nz * t)], w)


def arch(a, x, r, w, mat='Under', z0=-0.06):
    """A wheel arch: the dark half-disc the drawn wheels turn in front of, both sides."""
    pts = [(x + r * math.cos(t), max(z0, r * math.sin(t))) for t in [math.pi * k / 10 for k in range(11)]]
    pts = [(x + r, z0)] + pts + [(x - r, z0)]
    # Drop repeated points where the arc meets the sill.
    clean = []
    for p in pts:
        if not clean or (abs(p[0] - clean[-1][0]) > 1e-4 or abs(p[1] - clean[-1][1]) > 1e-4):
            clean.append(p)
    for s in (-1, 1):
        side(a, mat, clean, s * w, s * (w + 0.012))


def lamps(a, x, z, y, r=0.09, mat='Lamp', rim='Chrome'):
    for s in (-1, 1):
        a.cyl(rim, (x, s * y, z), r * 1.2, r * 1.2, 0.04, seg=12, rot=(0, math.pi / 2, 0))
        a.cyl(mat, (x + 0.02, s * y, z), r, r, 0.04, seg=12, rot=(0, math.pi / 2, 0))


def text(a, mat, string, loc, rot=(0, 0, 0), size=0.2, depth=0.01):
    """Raised lettering, from Blender's built-in font."""
    curve = bpy.data.curves.new('kalesa_text', 'FONT')
    curve.body = string
    curve.size = size
    curve.extrude = depth
    curve.align_x = 'CENTER'
    curve.align_y = 'CENTER'
    curve.resolution_u = 2
    obj = bpy.data.objects.new('kalesa_text', curve)
    bpy.context.scene.collection.objects.link(obj)
    dg = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(dg))
    verts = [tuple(v.co) for v in mesh.vertices]
    faces = [tuple(p.vertices) for p in mesh.polygons]
    a.poly(mat, verts, faces, loc=loc, rot=rot)
    bpy.data.objects.remove(obj)
    bpy.data.curves.remove(curve)
    bpy.data.meshes.remove(mesh)


# ---------- The cars ----------

def taxi4l():
    """The Renault 4 taxi of Antananarivo: cream, boxy, a sign on the roof."""
    a = Asset('car_taxi4l')
    body, w = 'TaxiCream', 0.76
    sym(a, body, [(-1.8, -0.04), (1.78, -0.04), (1.82, 0.44), (1.0, 0.6), (-1.8, 0.6)], w)
    sym(a, body, [(-1.78, 0.58), (0.95, 0.58), (0.55, 1.1), (-1.7, 1.12)], w - 0.06)
    # Glass all round the cabin, the pillars over it.
    sym(a, 'Glass', [(-1.64, 0.64), (0.86, 0.64), (0.5, 1.04), (-1.6, 1.05)], w - 0.045)
    for x in (-0.38, -1.12):
        sym(a, body, [(x - 0.05, 0.6), (x + 0.05, 0.6), (x + 0.05, 1.1), (x - 0.05, 1.1)], w - 0.04)
    pane(a, 'Glass', (0.9, 0.64), (0.58, 1.05), w - 0.14)
    pane(a, 'Glass', (-1.71, 1.04), (-1.77, 0.66), w - 0.16)
    # Ribbed bonnet, grille, lamps, bumpers.
    for y in (-0.3, 0, 0.3):
        a.cube(body, (1.38, y, 0.53), (0.78, 0.05, 0.03), rot=(0, 0.19, 0))
    a.cube('Chrome', (1.81, 0, 0.3), (0.05, 1.0, 0.18))
    for i in range(4):
        a.cube('Trim', (1.835, 0, 0.23 + i * 0.045), (0.02, 0.94, 0.015))
    lamps(a, 1.82, 0.32, 0.6, r=0.08)
    for x, mat in ((1.86, 'Chrome'), (-1.84, 'Chrome')):
        a.cube(mat, (x, 0, 0.06), (0.08, 1.56, 0.1))
    for s in (-1, 1):
        a.cube('TailRed', (-1.81, s * 0.62, 0.42), (0.03, 0.12, 0.12))
        a.cube('Trim', (0.1, s * (w + 0.005), 0.36), (0.25, 0.02, 0.03))
        a.cube('Trim', (-0.6, s * (w + 0.005), 0.36), (0.25, 0.02, 0.03))
    # The roof sign: TAXI on both faces.
    a.cube('Trim', (-0.45, 0, 1.15), (0.12, 0.06, 0.06))
    a.cube('Lamp', (-0.45, 0, 1.28), (0.18, 0.62, 0.2))
    for s in (-1, 1):
        text(a, 'Trim', 'TAXI', (-0.45 + s * 0.095, 0, 1.28), rot=(math.pi / 2, 0, s * math.pi / 2), size=0.17)
    arch(a, 1.2, 0.43, w)
    arch(a, -1.2, 0.43, w)
    return a


def deuche():
    """The Citroën 2CV: a low ribbed bonnet, a tall rounded cabin, its mudguards apart."""
    a = Asset('car_deuche')
    body, w = 'DeucheRed', 0.66
    sym(a, body, [(-1.86, 0.0), (1.76, 0.0), (1.84, 0.44), (0.76, 0.74), (-1.86, 0.74)], w)
    sym(a, body, [(-1.86, 0.72), (0.76, 0.72), (0.42, 1.3), (-0.3, 1.36), (-0.95, 1.28), (-1.45, 1.04), (-1.8, 0.74)], w - 0.04)
    sym(a, 'Glass', [(0.6, 0.78), (0.38, 1.22), (-0.3, 1.28), (-0.92, 1.2), (-1.36, 0.98), (-1.6, 0.78)], w - 0.034)
    for x in (0.0, -0.75):
        sym(a, body, [(x - 0.04, 0.74), (x + 0.04, 0.74), (x + 0.04, 1.33), (x - 0.04, 1.33)], w - 0.028)
    pane(a, 'Glass', (0.72, 0.78), (0.42, 1.27), w - 0.12)
    # The rolled-back canvas roof.
    for i, (x, z, tilt) in enumerate([(0.15, 1.36, 0.06), (-0.35, 1.38, -0.02), (-0.8, 1.32, -0.15)]):
        a.cube('Canvas', (x, 0, z + 0.02), (0.5, 1.2, 0.05), rot=(0, tilt, 0))
    a.cyl('Canvas', (-1.12, 0, 1.24), 0.09, 0.09, 1.2, seg=8, rot=(math.pi / 2, 0, 0))
    # Mudguards, standing out from the body over each wheel; the front ones run on to the bumper.
    for x, r, ahead in ((1.2, 0.52, 0.42), (-1.2, 0.5, 0.06)):
        pts = [(x + r * math.cos(t), r * math.sin(t) + 0.06) for t in [math.pi * k / 8 for k in range(9)]]
        for s in (-1, 1):
            side(a, body, [(x + r + ahead, 0.06), (x + r + ahead, 0.2)] + pts[1:] + [(x - r - 0.04, 0.06)], s * w, s * (w + 0.12))
        arch(a, x, r - 0.06, w + 0.12)
    # Ribbed bonnet, the grille and its chevrons, lamps on stalks.
    for i in range(5):
        a.cube(body, (1.29, -0.4 + i * 0.2, 0.62), (0.98, 0.03, 0.02), rot=(0, 0.27, 0))
    a.cube('Chrome', (1.82, 0, 0.26), (0.04, 0.6, 0.3))
    a.cube('Trim', (1.84, 0, 0.33), (0.02, 0.32, 0.03), rot=(0.35, 0, 0))
    a.cube('Trim', (1.84, 0, 0.27), (0.02, 0.32, 0.03), rot=(0.35, 0, 0))
    for s in (-1, 1):
        a.cyl('Chrome', (1.55, s * 0.48, 0.7), 0.015, 0.015, 0.2, seg=6)
        a.ball('Chrome', (1.58, s * 0.48, 0.84), (0.11, 0.11, 0.11), sub=1)
        a.cyl('Lamp', (1.68, s * 0.48, 0.84), 0.08, 0.08, 0.02, seg=10, rot=(0, math.pi / 2, 0))
        a.cube('TailRed', (-1.86, s * 0.48, 0.52), (0.03, 0.08, 0.1))
    a.cube('Chrome', (1.9, 0, 0.1), (0.06, 1.5, 0.06))
    a.cube('Chrome', (-1.9, 0, 0.12), (0.06, 1.5, 0.06))
    return a


def bachee():
    """The Peugeot 404 pick-up: a long bonnet, and its load under a canvas."""
    a = Asset('car_bachee')
    body, w = 'PeugeotBlue', 0.8
    sym(a, body, [(-0.4, -0.04), (2.24, -0.04), (2.3, 0.44), (2.1, 0.64), (-0.4, 0.68)], w)
    sym(a, body, [(-0.38, 0.66), (0.76, 0.66), (0.46, 1.2), (-0.36, 1.22)], w - 0.04)
    sym(a, 'Glass', [(-0.24, 0.72), (0.64, 0.72), (0.42, 1.12), (-0.22, 1.14)], w - 0.03)
    pane(a, 'Glass', (0.71, 0.72), (0.48, 1.14), w - 0.12)
    # The bed, the hoops and the canvas over them, sacks of rice at the back.
    sym(a, body, [(-2.32, -0.04), (-0.4, -0.04), (-0.4, 0.66), (-2.32, 0.66)], w)
    sym(a, 'Khaki', [(-2.3, 0.64), (-0.44, 0.64), (-0.44, 1.26), (-0.62, 1.44), (-2.14, 1.44), (-2.3, 1.26)], w - 0.02)
    for x in (-0.8, -1.37, -1.94):
        sym(a, 'KhakiDark', [(x - 0.03, 0.64), (x + 0.03, 0.64), (x + 0.03, 1.45), (x - 0.03, 1.45)], w)
    a.cube('KhakiDark', (-2.31, 0, 1.0), (0.02, 1.4, 0.5))
    for i, y in enumerate((-0.45, 0.0, 0.45)):
        a.ball('Sack', (-2.36, y, 0.8 + (i % 2) * 0.08), (0.1, 0.24, 0.17), sub=1)
    # Grille, lamps, bumpers, tail lights.
    a.cube('Chrome', (2.29, 0, 0.3), (0.04, 1.1, 0.22))
    for i in range(5):
        a.cube('Trim', (2.31, -0.44 + i * 0.22, 0.3), (0.02, 0.04, 0.18))
    lamps(a, 2.27, 0.34, 0.66, r=0.085)
    a.cube('Chrome', (2.34, 0, 0.06), (0.08, 1.64, 0.1))
    a.cube('Chrome', (-2.36, 0, 0.06), (0.08, 1.64, 0.1))
    for s in (-1, 1):
        a.cube('TailRed', (-2.33, s * 0.68, 0.42), (0.03, 0.1, 0.16))
        a.cube('Chrome', (1.2, s * (w + 0.005), 0.42), (1.5, 0.01, 0.025))
    arch(a, 1.4, 0.44, w)
    arch(a, -1.4, 0.44, w)
    return a


def brousse():
    """The taxi-brousse: a minibus, white and teal, its roof piled high."""
    a = Asset('car_brousse')
    body, w = 'White', 0.86
    sym(a, body, [(-2.36, -0.04), (2.24, -0.04), (2.32, 0.6), (2.12, 0.96), (1.82, 1.74), (-2.36, 1.76)], w)
    # Teal skirt and stripes.
    sym(a, 'BrousseTeal', [(-2.37, -0.04), (2.25, -0.04), (2.29, 0.32), (-2.37, 0.32)], w + 0.006)
    sym(a, 'BrousseTeal', [(-2.37, 0.5), (2.3, 0.5), (2.28, 0.6), (-2.37, 0.6)], w + 0.006)
    sym(a, 'Glass', [(-2.2, 0.98), (1.98, 0.98), (1.76, 1.56), (-2.2, 1.56)], w + 0.004)
    for x in (-1.6, -0.9, -0.2, 0.5, 1.2):
        sym(a, body, [(x - 0.05, 0.96), (x + 0.05, 0.96), (x + 0.05, 1.6), (x - 0.05, 1.6)], w + 0.008)
    pane(a, 'Glass', (2.08, 1.0), (1.84, 1.66), w - 0.1)
    pane(a, 'Glass', (-2.36, 1.62), (-2.36, 1.0), w - 0.14, t=-0.025)
    for s in (-1, 1):
        text(a, 'BrousseTeal', 'TAXI-BROUSSE', (-0.2, s * (w + 0.01), 0.78), rot=(math.pi / 2, 0, 0 if s < 0 else math.pi), size=0.2)
    lamps(a, 2.3, 0.45, 0.62, r=0.08)
    a.cube('Chrome', (2.3, 0, 0.72), (0.04, 0.9, 0.16))
    a.cube('Trim', (2.36, 0, 0.08), (0.08, 1.7, 0.12))
    a.cube('Trim', (-2.4, 0, 0.08), (0.08, 1.7, 0.12))
    for s in (-1, 1):
        a.cube('TailRed', (-2.37, s * 0.72, 0.5), (0.03, 0.12, 0.2))
    # The roof rack and the load: bags, a mattress, bananas, a crate of hens, sacks.
    for s in (-1, 1):
        a.cube('Trim', (-0.2, s * 0.8, 1.86), (4.1, 0.04, 0.04))
        for x in (-2.1, -0.9, 0.3, 1.5):
            a.cube('Trim', (x, s * 0.8, 1.81), (0.04, 0.04, 0.1))
    for x in (-2.1, -0.9, 0.3, 1.5):
        a.cube('Trim', (x, 0, 1.86), (0.04, 1.64, 0.04))
    a.cube('Luggage', (1.1, -0.35, 2.0), (0.7, 0.6, 0.3))
    a.cube('Sapphire', (1.2, 0.35, 1.98), (0.55, 0.55, 0.26))
    a.cyl('Mattress', (0.2, 0, 2.02), 0.18, 0.18, 1.5, seg=10, rot=(math.pi / 2, 0, 0))
    for i in range(4):
        a.ball('Sack', (-0.65 - i * 0.4, (-1) ** i * 0.25, 2.02), (0.24, 0.32, 0.18), sub=1)
    a.cube('Wood', (-1.85, 0.3, 2.08), (0.5, 0.5, 0.36))
    for i in range(4):
        a.cube('WoodDark', (-1.85, 0.3, 1.94 + i * 0.1), (0.52, 0.52, 0.02))
    a.ball('White', (-1.85, 0.3, 2.31), (0.1, 0.12, 0.09), sub=1)
    a.ball('Banana', (-1.2, -0.45, 2.3), (0.22, 0.14, 0.12), sub=1, rot=(0, 0.4, 0.3))
    # The ladder up the back.
    for s in (-1, 1):
        a.cube('Trim', (-2.42, s * 0.25, 1.2), (0.03, 0.03, 1.2))
    for i in range(5):
        a.cube('Trim', (-2.42, 0, 0.75 + i * 0.22), (0.03, 0.5, 0.025))
    arch(a, 1.4, 0.45, w)
    arch(a, -1.5, 0.45, w)
    return a


def karenjy():
    """The Karenjy, the car made in Fianarantsoa: square, tall, a spare wheel on its back."""
    a = Asset('car_karenjy')
    body, w = 'KarenjyOrange', 0.8
    sym(a, body, [(-1.86, -0.04), (1.84, -0.04), (1.9, 0.62), (0.98, 0.74), (-1.86, 0.74)], w)
    sym(a, 'White', [(-1.84, 0.72), (0.9, 0.72), (0.7, 1.38), (-1.84, 1.4)], w - 0.05)
    sym(a, 'Glass', [(-1.7, 0.8), (0.82, 0.8), (0.66, 1.3), (-1.7, 1.31)], w - 0.04)
    for x in (-0.45, -1.25):
        sym(a, 'White', [(x - 0.05, 0.74), (x + 0.05, 0.74), (x + 0.05, 1.38), (x - 0.05, 1.38)], w - 0.035)
    pane(a, 'Glass', (0.86, 0.8), (0.69, 1.32), w - 0.13)
    # Black flares over the wheels, a black sill.
    for x in (1.15, -1.15):
        pts = [(x + 0.5 * math.cos(t), 0.5 * math.sin(t) + 0.02) for t in [math.pi * k / 6 for k in range(7)]]
        for s in (-1, 1):
            side(a, 'Trim', [(x + 0.58, 0.02)] + pts + [(x - 0.58, 0.02)], s * w, s * (w + 0.07))
        arch(a, x, 0.44, w + 0.07)
    sym(a, 'Trim', [(-0.62, -0.04), (0.62, -0.04), (0.62, 0.1), (-0.62, 0.1)], w + 0.02)
    # The spare wheel, the bull bar, the lamps, the roof bars.
    a.cyl('Tire', (-1.98, 0, 0.82), 0.32, 0.32, 0.2, seg=14, rot=(0, math.pi / 2, 0))
    a.cyl('Chrome', (-2.08, 0, 0.82), 0.14, 0.14, 0.02, seg=10, rot=(0, math.pi / 2, 0))
    a.cube('Trim', (1.91, 0, 0.42), (0.04, 1.2, 0.3))
    lamps(a, 1.91, 0.48, 0.6, r=0.09)
    for s in (-1, 1):
        a.cyl('Chrome', (2.02, s * 0.5, 0.35), 0.03, 0.03, 0.6, seg=6)
        a.cube('TailRed', (-1.87, s * 0.66, 0.5), (0.03, 0.1, 0.18))
        a.cube('Trim', (-0.4, s * 0.62, 1.47), (2.5, 0.05, 0.05))
    a.cyl('Chrome', (2.02, 0, 0.62), 0.03, 0.03, 1.0, seg=6, rot=(math.pi / 2, 0, 0))
    a.cyl('Chrome', (2.02, 0, 0.12), 0.03, 0.03, 1.0, seg=6, rot=(math.pi / 2, 0, 0))
    a.cube('Trim', (1.95, 0, 0.06), (0.1, 1.64, 0.12))
    # A snorkel up the right-hand pillar: it fords rivers.
    a.cyl('Trim', (0.95, -(w + 0.05), 0.9), 0.04, 0.04, 0.7, seg=6)
    a.cube('Trim', (0.95, -(w + 0.05), 1.27), (0.12, 0.1, 0.06))
    return a


def bajaj():
    """The bajaj: three wheels, an open cab under a canvas roof."""
    a = Asset('car_bajaj')
    body, w = 'BajajLime', 0.62
    sym(a, body, [(-1.24, -0.04), (0.72, -0.04), (1.22, 0.32), (1.3, 0.62), (-1.24, 0.62)], w)
    sym(a, 'Banana', [(-1.25, 0.3), (1.12, 0.3), (1.2, 0.4), (-1.25, 0.4)], w + 0.006)
    # The nose narrows round the front wheel.
    sym(a, body, [(0.95, 0.62), (1.32, 0.62), (1.14, 1.22), (1.02, 1.22)], w - 0.08)
    pane(a, 'Glass', (1.3, 0.66), (1.1, 1.22), w - 0.14)
    a.cyl('Lamp', (1.34, 0, 0.5), 0.09, 0.09, 0.04, seg=12, rot=(0, math.pi / 2, 0))
    a.cyl('Chrome', (1.32, 0, 0.5), 0.11, 0.11, 0.03, seg=12, rot=(0, math.pi / 2, 0))
    for s in (-1, 1):
        a.cube('Indicator', (1.3, s * 0.4, 0.58), (0.04, 0.08, 0.06))
        a.cube('TailRed', (-1.25, s * 0.48, 0.48), (0.03, 0.1, 0.1))
    # The canvas roof on its posts, the seats, the handlebar.
    sym(a, 'Canvas', [(-1.32, 1.36), (1.14, 1.3), (1.2, 1.42), (1.06, 1.52), (-1.2, 1.58), (-1.34, 1.5)], w + 0.04)
    for x, y in ((1.07, w - 0.05), (-1.2, w - 0.02)):
        for s in (-1, 1):
            a.cyl('Trim', (x, s * y, 0.98), 0.025, 0.025, 0.74, seg=6)
    sym(a, 'Canvas', [(-1.24, 0.62), (-0.95, 0.62), (-0.95, 1.36), (-1.24, 1.36)], w + 0.01)
    a.cube('Seat', (-0.68, 0, 0.72), (0.5, 1.1, 0.2))
    a.cube('Seat', (-0.9, 0, 1.0), (0.12, 1.1, 0.42))
    a.cube('Seat', (0.42, 0, 0.74), (0.36, 0.5, 0.16))
    a.cyl('Chrome', (0.86, 0, 0.98), 0.02, 0.02, 0.62, seg=6, rot=(math.pi / 2, 0, 0))
    a.cyl('Chrome', (0.95, 0, 0.82), 0.02, 0.02, 0.32, seg=6, rot=(0, -0.6, 0))
    # Mudguard over the front wheel, arches at the back.
    pts = [(1.0 + 0.4 * math.cos(t), 0.4 * math.sin(t) + 0.04) for t in [math.pi * k / 8 for k in range(9)]]
    side(a, 'Trim', pts, -0.13, 0.13)
    arch(a, -0.7, 0.4, w)
    return a


CARS = [taxi4l, deuche, bachee, brousse, karenjy, bajaj]


# ---------- Along the road ----------

def finish_arch():
    """The finish: a gantry over the whole road, chequered, the flag of Madagascar on each post."""
    a = Asset('finish_arch')
    for s in (-1, 1):
        a.cube('White', (0, s * 7.4, 3.0), (0.4, 0.4, 6.0))
        a.cube('Trim', (0, s * 7.4, 0.15), (0.6, 0.6, 0.3))
        # The flag: white at the hoist, red over green.
        a.cyl('Trim', (0, s * 7.4, 6.6), 0.04, 0.04, 1.2, seg=6)
        a.cube('White', (0, s * 7.4 - s * 0.25, 6.8), (0.02, 0.5, 0.6))
        a.cube('FlagRed', (0, s * 7.4 - s * 0.9, 6.95), (0.02, 0.8, 0.3))
        a.cube('FlagGreen', (0, s * 7.4 - s * 0.9, 6.65), (0.02, 0.8, 0.3))
    a.cube('White', (0, 0, 5.4), (0.3, 15.2, 1.2))
    for i in range(30):
        for j in range(2):
            if (i + j) % 2:
                a.cube('Black', (0, -7.25 + i * 0.5, 5.1 + j * 0.6), (0.34, 0.5, 0.6))
    return a


def borne():
    """A kilometre stone: white, its top painted red."""
    a = Asset('borne')
    a.cube('White', (0, 0, 0.3), (0.25, 0.42, 0.6))
    a.cyl('FlagRed', (0, 0, 0.6), 0.21, 0.21, 0.25, seg=10, rot=(0, math.pi / 2, 0))
    a.cube('White', (0, 0, 0.55), (0.255, 0.42, 0.1))
    return a


def rock(name, seed):
    a = Asset(name)
    rng = random.Random(seed)
    for i in range(3):
        r = 0.35 + rng.random() * 0.25
        a.ball('Rock' if i % 2 else 'RockDark', (rng.uniform(-0.25, 0.25), rng.uniform(-0.25, 0.25), r * 0.45),
               (r, r * (0.7 + rng.random() * 0.4), r * 0.7), sub=1, rot=(rng.random(), rng.random(), rng.random()))
    return a


def house_merina():
    """A house of the Hautes Terres: red brick, two storeys, a steep roof, a balcony on columns."""
    a = Asset('house_merina')
    a.cube('Brick', (0, 0, 1.6), (3.2, 2.4, 3.2))
    a.prism('RoofDark', (0, 0, 3.2), 3.5, 2.7, 1.9)
    for x in (-1.0, 0, 1.0):
        for z in (0.9, 2.4):
            a.cube('Glass', (x, -1.21, z), (0.5, 0.02, 0.7))
            a.cube('Wood', (x - 0.36, -1.22, z), (0.2, 0.02, 0.72))
            a.cube('Wood', (x + 0.36, -1.22, z), (0.2, 0.02, 0.72))
    # The balcony over the front.
    a.cube('Wood', (0, -1.7, 1.75), (3.4, 1.0, 0.1))
    for x in (-1.6, -0.55, 0.55, 1.6):
        a.cyl('Plaster', (x, -2.15, 0.9), 0.08, 0.08, 1.8, seg=8)
        a.cyl('Wood', (x, -2.15, 2.25), 0.04, 0.04, 0.9, seg=6)
    a.cube('Wood', (0, -2.15, 2.2), (3.3, 0.06, 0.06))
    a.cube('RoofDark', (0, -1.75, 2.75), (3.5, 1.1, 0.08), rot=(-0.25, 0, 0))
    return a


def eucalyptus():
    a = Asset('eucalyptus')
    a.cyl('EucaBark', (0, 0, 2.4), 0.16, 0.09, 4.8, seg=7)
    rng = random.Random(4)
    for i in range(6):
        z = 3.2 + i * 0.5
        a.ball('Eucalyptus' if i % 2 else 'Sage', (rng.uniform(-0.6, 0.6), rng.uniform(-0.6, 0.6), z),
               (0.9 - i * 0.08, 0.7, 0.7), sub=1, rot=(0, 0, rng.random() * 3))
    return a


def pine():
    a = Asset('pine')
    a.cyl('Bark', (0, 0, 0.8), 0.14, 0.12, 1.6, seg=6)
    for i in range(4):
        a.cyl('Pine', (0, 0, 1.4 + i * 0.9), 1.3 - i * 0.28, 0.1, 1.6, seg=8)
    return a


def sarety():
    """A zebu cart: two zebus under a yoke, two big wooden wheels."""
    a = Asset('sarety')
    for s in (-1, 1):
        with a.at((2.2, s * 0.45, 0), (0, 0, math.pi / 2), 2.0):
            zebu_parts(a)
    a.cube('Wood', (1.6, 0, 1.25), (0.12, 1.6, 0.1))
    a.cube('Wood', (0.5, 0, 0.9), (2.4, 0.12, 0.1))
    a.cube('Wood', (-0.6, 0, 1.0), (1.8, 1.3, 0.12))
    for s in (-1, 1):
        a.cube('Wood', (-0.6, s * 0.62, 1.3), (1.8, 0.06, 0.5))
        a.cyl('WoodDark', (-0.6, s * 0.78, 0.75), 0.75, 0.75, 0.1, seg=12, rot=(math.pi / 2, 0, 0))
        a.cyl('Wood', (-0.6, s * 0.84, 0.75), 0.15, 0.15, 0.08, seg=8, rot=(math.pi / 2, 0, 0))
        for k in range(4):
            a.cube('Wood', (-0.6, s * 0.84, 0.75), (1.3, 0.05, 0.06), rot=(0, k * math.pi / 4, 0))
    a.ball('Sack', (-0.8, 0, 1.3), (0.5, 0.45, 0.3), sub=1)
    return a


def charcoal():
    """Sacks of charcoal for sale by the road."""
    a = Asset('charcoal')
    rng = random.Random(2)
    for i, (x, y) in enumerate([(-0.4, 0), (0.1, 0.05), (0.55, -0.05), (-0.15, -0.45), (0.35, -0.5)]):
        h = 0.7 + rng.random() * 0.15
        a.cyl('Sack', (x, y, h / 2), 0.24, 0.27, h, seg=8)
        a.ball('Charcoal', (x, y, h), (0.22, 0.22, 0.1), sub=1)
    a.cyl('Wood', (0.9, 0.3, 0.8), 0.04, 0.04, 1.6, seg=6)
    a.cube('Leaf', (0.9, 0.3, 1.6), (0.6, 0.6, 0.06))
    return a


SCENERY = [finish_arch, borne, lambda: rock('rock_a', 1), lambda: rock('rock_b', 2), lambda: rock('rock_c', 3),
           house_merina, eucalyptus, pine, sarety, charcoal]


def rebuild_kalesa():
    coll = bpy.data.collections.get(COLLECTION)
    if coll is None:
        coll = bpy.data.collections.new(COLLECTION)
        bpy.context.scene.collection.children.link(coll)
    for obj in list(coll.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in [m for m in bpy.data.meshes if m.users == 0]:
        bpy.data.meshes.remove(mesh)
    objects = []
    for i, b in enumerate(CARS + SCENERY):
        obj = b().build(coll, i)
        # Cars in a row, the scenery behind them.
        obj.location = (i * 6.0, 0, 0) if i < len(CARS) else ((i - len(CARS)) * 9.0, 14, 0)
        objects.append(obj)
    return objects


def export_kalesa(path):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in bpy.data.collections[COLLECTION].objects:
        obj.hide_set(False)
        obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_apply=True, export_yup=True,
                              export_normals=False, export_texcoords=False)


def render_cars(out_dir, size=160):
    """A transparent PNG per car, three-quarters from the front, on plain round wheels: the lobby's picker."""
    scene = bpy.context.scene
    coll = bpy.data.collections[COLLECTION]
    cam_data = bpy.data.cameras.get('CarCam') or bpy.data.cameras.new('CarCam')
    cam = bpy.data.objects.get('CarCam') or bpy.data.objects.new('CarCam', cam_data)
    sun_data = bpy.data.lights.get('CarSun') or bpy.data.lights.new('CarSun', 'SUN')
    sun = bpy.data.objects.get('CarSun') or bpy.data.objects.new('CarSun', sun_data)
    for o in (cam, sun):
        if o.name not in scene.collection.objects:
            scene.collection.objects.link(o)
    cam_data.type = 'ORTHO'
    sun_data.energy = 3.5
    sun.rotation_euler = Euler((math.radians(50), 0, math.radians(-30)))
    world = bpy.data.worlds.get('IconWorld') or bpy.data.worlds.new('IconWorld')
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs[0].default_value = (0.75, 0.8, 0.85, 1)
    bg.inputs[1].default_value = 0.8
    r = scene.render
    vs = scene.view_settings
    if 'Standard' in [i.identifier for i in vs.bl_rna.properties['view_transform'].enum_items]:
        vs.view_transform = 'Standard'
    r.resolution_x = r.resolution_y = size
    r.resolution_percentage = 100
    r.film_transparent = True
    r.image_settings.file_format = 'PNG'
    r.image_settings.color_mode = 'RGBA'
    for engine in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT', 'BLENDER_WORKBENCH'):
        try:
            r.engine = engine
            break
        except TypeError:
            continue
    scene.camera = cam
    scene.world = world
    tire = _helpers['material']('Tire')
    hub = _helpers['material']('Chrome')
    view = Vector((-0.75, 1, -0.42)).normalized()  # from the front-right, a little above
    right = view.cross(Vector((0, 0, 1))).normalized()
    up = right.cross(view).normalized()
    bpy.ops.render.render()
    for name in [b.__name__ for b in CARS]:
        obj = coll.objects['car_' + name]
        # Plain wheels for the picture; in the game, the players draw them.
        wheels = []
        for x, y in CAR_WHEELS[name]:
            for mat, rad, depth, dy in ((tire, 0.36, 0.24, 0), (hub, 0.16, 0.26, 0)):
                bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=rad, depth=depth,
                                                    location=obj.location + Vector((x, y + dy, 0)), rotation=(math.pi / 2, 0, 0))
                w = bpy.context.active_object
                w.data.materials.append(mat)
                wheels.append(w)
        # On the ground: lift everything by the wheels' radius.
        lift = Vector((0, 0, 0.36))
        obj.location += lift
        for w in wheels:
            w.location += lift
        for o in scene.objects:
            o.hide_render = o not in [obj, cam, sun] + wheels
        bpy.context.view_layer.update()
        corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box] + [w.matrix_world @ Vector(c) for w in wheels for c in w.bound_box]
        centre = sum(corners, Vector()) / len(corners)
        width = max(c.dot(right) for c in corners) - min(c.dot(right) for c in corners)
        height = max(c.dot(up) for c in corners) - min(c.dot(up) for c in corners)
        cam.location = centre - view * 20
        cam.rotation_euler = view.to_track_quat('-Z', 'Y').to_euler()
        cam_data.ortho_scale = max(width, height) * 1.05
        r.filepath = os.path.join(out_dir, name + '.png')
        bpy.ops.render.render(write_still=True)
        obj.location -= lift
        for w in wheels:
            bpy.data.objects.remove(w, do_unlink=True)
    for o in scene.objects:
        o.hide_render = False
    return r.engine


if not globals().get('KEEP_SCENE'):
    objects = rebuild_kalesa()
    print('built', len(objects), 'assets,', sum(len(o.data.polygons) for o in objects), 'faces')
