"""Build the quiz house in Blender.

    blender -b --factory-startup --python scripts/house/build.py -- <out.blend>

One house, every quiz question in its own spot in it: a porch out front (columns, porch
ceiling), a foyer, living room, dining room and hall inside (trim, base, crown,
wainscoting, built-ins, mantel, doors, hardware), and a deck and yard out back (decking,
railing, fence). Each question's styles are variants that can be swapped in place;
`variants` on the scene records how. Plan in inches: X east along the street, Y north,
Z up, the inside floor at 0, the yard at -24.
"""
import json
import math
import os
import random
import sys

import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hlib import (IN, PLANKS, Builder, append_collection, coll, emit_mat, exclude_library, glass_mat,  # noqa: E402
                  hexrgb, hidden_coll, image_mat, import_meshes, instance, load_export, metal_mat,
                  new_mat, paint_mat, place, solid_glass_mat, v, ASSETS, EXPORT)

OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else os.path.join(os.path.expanduser("~"), "Tools", "house-work", "house.blend")

TRIM = 0xf2efe8
WALL = 0xc9c1b3          # interior walls: a warm light greige
SIDING = 0xe4e1d8        # outside: soft white lap siding
CEIL = 108
GRADE = -24
DECK = -8

random.seed(7)

# ================================================================== scene

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
VARIANTS = {}             # slot -> {option: {"kind": "coll"|"inst", "name": ...}}
DEFAULTS = {}             # slot -> option shown when a slot isn't the one being asked about


def variant(slot, opt, kind, name):
    VARIANTS.setdefault(slot, {})[opt] = {"kind": kind, "name": name}


root = coll("house")
var_root = coll("variants")

# ================================================================== materials

M = {}
M["trim"] = paint_mat("trim", TRIM, 0.3, bevel=0.06, orange_peel=0.05)
M["wall"] = paint_mat("wall", WALL, 0.88, bevel=0, orange_peel=0.12, sheen=0.25)
M["ceiling"] = paint_mat("ceiling", 0xf1eee8, 0.92, bevel=0, orange_peel=0.08, sheen=0.2)
M["porch_floor"] = paint_mat("porch_floor", 0x8a8d8a, 0.55, bevel=0.05, orange_peel=0.1)
M["door_green"] = paint_mat("door_green", 0x2f4436, 0.32, bevel=0.05)
M["black_paint"] = paint_mat("black_paint", 0x1d1d1c, 0.5, bevel=0.03)
M["toe"] = paint_mat("toe", 0x2b2a28, 0.8, bevel=0.02)
M["floor"] = image_mat("floor", "plank_flooring_04", 78.7, hue=0.53, sat=0.6, val=1.35, rough_mul=0.9, coat=0.15)
M["brick"] = image_mat("brick", "red_brick_03", 39.4, bump=1.0)
M["soot"] = image_mat("soot", "dark_brick_wall", 41.3, val=0.45, sat=0.5)
M["slate"] = image_mat("slate", "slate_floor", 60.0, sat=0.3, val=0.55, rough_mul=0.8)
M["lawn_ground"] = image_mat("lawn_ground", "leafy_grass", 78.7, hue=0.56, sat=1.1, val=0.5)
M["roof"] = image_mat("roof", "grey_roof_01", 315.0, val=0.8)
M["concrete"] = image_mat("concrete", "concrete_pavement", 70.9, val=1.05)
M["mulch"] = image_mat("mulch", "brown_mud_leaves_01", 51.0, val=0.8)
M["rug"] = image_mat("rug", "fabric_pattern_07", 15.7, sat=0.0, val=0.9, tint=0xd8cdbb)
M["glass"] = glass_mat()
M["glass_solid"] = solid_glass_mat()
M["metal_black"] = metal_mat("metal_black", 0x222222, 0.62, 0.35)
M["steel"] = metal_mat("steel", 0xc6c6c1, 0.25, brushed=True)
M["bark"] = paint_mat("bark", 0x3d2c20, 0.95, bevel=0, orange_peel=0.9)


OAK, OAK_TILE = "oak_wood_planks", 47.0
OAK_BANDS = [(0.03, 0.43), (0.5, 0.95)]      # clear of the seams at 0 and 0.465 of the tile


def wood(name, tex=OAK, tile=OAK_TILE, **kw):
    m = image_mat("wood_" + name, tex, tile, bevel=0.04, **kw)
    if tex == OAK:
        PLANKS[m.name] = (tile * IN, OAK_BANDS)
    return m


WOODS = {
    "cedar": dict(tint=0xf0cdb2, sat=0.62),
    "cedar-dark": dict(tint=0xa88268, sat=0.7, val=0.8),
    "treated": dict(tint=0xf6dbae, sat=0.7),
    "composite-grey": dict(sat=0.0, val=0.8, contrast=-0.45, rough_add=0.2, bump=0.4),
    "composite-brown": dict(tint=0x9a7a66, sat=0.3, val=0.8, contrast=-0.3, rough_add=0.15, bump=0.4),
    "ipe": dict(tex="rosewood_veneer1", tile=95.7, val=0.6, sat=0.65, coat=0.15),
    "stained": dict(tint=0xd9a983, sat=0.8, coat=0.15),
    "ceiling-cedar": dict(tint=0xf2c8a6, sat=0.8),
    "knotty-pine": dict(tint=0xfae2bc, sat=0.85, val=1.1, coat=0.3),
    "white-oak": dict(val=1.05),
    "walnut": dict(tex="rosewood_veneer1", tile=95.7, val=0.55, sat=0.8, coat=0.3),
    "reclaimed": dict(tint=0xbc9c82, sat=0.7, val=0.8, bump=1.6),
    "rough-cedar": dict(tint=0xcfa98a, sat=0.7, val=0.9, bump=2.0),
}


def W(key):
    k = key.replace("wood:", "")
    if k not in WOODS:
        k = "white-oak"
    return wood(k, **WOODS[k])


def from_export(kind):
    """Material for a mesh from the three.js export, or None to leave it out."""
    k = kind["kind"]
    if k in ("wall", "backdrop"):
        return None
    if k == "glass":
        return M["glass"]
    if k == "metal":
        return METALS[kind["name"]]
    if k == "wood":
        if kind["key"] == "wood:oak-floor":
            return None
        if kind["key"] == "wood:bark":
            return M["bark"]
        return W(kind["key"])
    if k == "textured":
        if "soot" in kind["key"]:
            return M["soot"]
        if "slate" in kind["key"]:
            return M["slate"]
        return M["brick"]
    c = kind["color"]
    if c == TRIM:
        return M["trim"]
    if c == 0xefebe4:            # a scene's own ceiling: the house has one
        return None
    return paint_mat(f"paint_{c:06x}", c, max(0.3, kind.get("rough", 0.5)), bevel=0.04, orange_peel=0.04)


METALS = {
    "black": metal_mat("hw_black", 0x222222, 0.62, 0.35),
    "satinbrass": metal_mat("hw_satinbrass", 0xc9a25a, 0.34, brushed=True),
    "brass": metal_mat("hw_brass", 0xd8b064, 0.12),
    "nickel": metal_mat("hw_nickel", 0xc6c6c1, 0.3, brushed=True),
    "chrome": metal_mat("hw_chrome", 0xeeeeee, 0.05),
    "bronze": metal_mat("hw_bronze", 0x3e2c22, 0.45, 0.85),
}


def siding_mat():
    """Lap siding: the 7in steps are a sawtooth on the bump, read off the wall's UV
    height, so every board throws a shadow line onto the one below."""
    m, nt, bsdf = new_mat("siding")
    bsdf.inputs["Base Color"].default_value = hexrgb(SIDING)
    bsdf.inputs["Roughness"].default_value = 0.55
    uv = nt.nodes.new("ShaderNodeUVMap")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(uv.outputs[0], sep.inputs[0])
    div = nt.nodes.new("ShaderNodeMath"); div.operation = "DIVIDE"; div.inputs[1].default_value = 7 * IN
    nt.links.new(sep.outputs[1], div.inputs[0])
    fr = nt.nodes.new("ShaderNodeMath"); fr.operation = "FRACT"
    nt.links.new(div.outputs[0], fr.inputs[0])
    pw = nt.nodes.new("ShaderNodeMath"); pw.operation = "POWER"; pw.inputs[1].default_value = 0.7
    nt.links.new(fr.outputs[0], pw.inputs[0])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 1.0
    bump.inputs["Distance"].default_value = 0.75 * IN
    nt.links.new(pw.outputs[0], bump.inputs["Height"])
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 600
    b2 = nt.nodes.new("ShaderNodeBump"); b2.inputs["Strength"].default_value = 0.08
    nt.links.new(nz.outputs[0], b2.inputs["Height"])
    nt.links.new(b2.outputs[0], bump.inputs["Normal"])
    nt.links.new(bump.outputs[0], bsdf.inputs["Normal"])
    return m


M["siding"] = siding_mat()

# ================================================================== shell


def slab(b, x0, y0, z0, x1, y1, z1, face_mat):
    """An axis-aligned box whose six faces each get a material from face_mat(axis, sign)."""
    xs, ys, zs = (x0 * IN, x1 * IN), (y0 * IN, y1 * IN), (z0 * IN, z1 * IN)
    vs = {}
    for i in (0, 1):
        for j in (0, 1):
            for k in (0, 1):
                vs[i, j, k] = b.bm.verts.new((xs[i], ys[j], zs[k]))
    quads = {
        (0, -1): [(0, 0, 0), (0, 0, 1), (0, 1, 1), (0, 1, 0)],
        (0, 1): [(1, 0, 0), (1, 1, 0), (1, 1, 1), (1, 0, 1)],
        (1, -1): [(0, 0, 0), (1, 0, 0), (1, 0, 1), (0, 0, 1)],
        (1, 1): [(0, 1, 0), (0, 1, 1), (1, 1, 1), (1, 1, 0)],
        (2, -1): [(0, 0, 0), (0, 1, 0), (1, 1, 0), (1, 0, 0)],
        (2, 1): [(0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1)],
    }
    faces = []
    for key, q in quads.items():
        mat = face_mat(*key)
        if mat is None:
            continue
        f = b.bm.faces.new([vs[c] for c in q])
        f.material_index = b.slot(mat)
        faces.append(f)
    b.bm.normal_update()
    b.uv_faces(faces)
    return faces


def wall(b, axis, a0, a1, c0, c1, z0, z1, holes=(), sides=("wall", "wall"), reveal="wall"):
    """A wall running along `axis` ("x" or "y") from a0 to a1, occupying c0..c1 across it,
    from z0 to z1, with rectangular holes (h0, h1, hz0, hz1) cut through it. sides gives
    the material of the low-c and high-c faces."""
    lo, hi = M[sides[0]], M[sides[1]]

    def piece(p0, p1, q0, q1):
        if p1 - p0 < 0.01 or q1 - q0 < 0.01:
            return

        def fm(ax, s):
            along = 0 if axis == "x" else 1
            if ax == 2:
                return M[reveal]
            if ax == along:
                return M[reveal]
            return lo if s < 0 else hi
        if axis == "x":
            slab(b, p0, c0, q0, p1, c1, q1, fm)
        else:
            slab(b, c0, p0, q0, c1, p1, q1, fm)
    hs = sorted(holes)
    cur = a0
    for h0, h1, hz0, hz1 in hs:
        piece(cur, h0, z0, z1)
        piece(h0, h1, z0, hz0)
        piece(h0, h1, hz1, z1)
        cur = h1
    piece(cur, a1, z0, z1)


TOP = 118                 # top of the wall plates, under the roof
# Openings, as (along0, along1, z0, z1) on each wall
WIN_W, WIN_H, SILL = 30 + 1.5, 52 + 0.75, 30
WINDOWS = {               # name: (wall, centre along it)
    "front_living_w": ("front", 66), "front_living_e": ("front", 190), "front_dining": ("front", 410),
    "west_s": ("west", 40), "west_n": ("west", 200), "west_bed": ("west", 300),
    "back_bed": ("back", 130), "back_kitchen": ("back", 410),
}
FRONT_DOOR = (281.25, 318.75, 0, 80.75)
BACK_DOOR = (281.25, 318.75, 0, 80.75)
FIREBOX = (102, 138, 0, 30)


def win_hole(c):
    return (c - WIN_W / 2, c + WIN_W / 2, SILL, SILL + WIN_H)


def build_shell():
    b = Builder("shell")
    ext = {"front": [FRONT_DOOR], "back": [BACK_DOOR], "west": [FIREBOX], "east": []}
    for name, (w, c) in WINDOWS.items():
        ext[w].append(win_hole(c))
    # exterior walls: siding outside from the floor up, brick foundation below
    wall(b, "x", -6, 486, -6, 0, 0, TOP, ext["front"], ("siding", "wall"), "trim")
    wall(b, "x", -6, 486, 360, 366, 0, TOP, ext["back"], ("wall", "siding"), "trim")
    wall(b, "y", 0, 360, -6, 0, 0, TOP, ext["west"], ("siding", "wall"), "trim")
    wall(b, "y", 0, 360, 480, 486, 0, TOP, ext["east"], ("wall", "siding"), "trim")
    for args in [("x", -6.5, 486.5, -6.5, 0, GRADE, 0), ("x", -6.5, 486.5, 360, 366.5, GRADE, 0),
                 ("y", 0, 360, -6.5, 0, GRADE, 0), ("y", 0, 360, 480, 486.5, GRADE, 0)]:
        wall(b, *args, sides=("brick", "brick"), reveal="brick")
    # interior walls
    wall(b, "y", 0, 360, 259.5, 264, 0, CEIL + 2, [(72, 168, 0, 84), (283.25, 316.75, 0, 80.75)])
    wall(b, "y", 0, 360, 336, 340.5, 0, CEIL + 2, [(60, 132, 0, 84)])
    wall(b, "x", 0, 259.5, 240, 244.5, 0, CEIL + 2)
    wall(b, "x", 340.5, 480, 240, 244.5, 0, CEIL + 2)
    # floor, ceiling
    slab(b, 0, 0, -1, 480, 360, 0, lambda ax, s: M["floor"] if (ax, s) == (2, 1) else None)
    slab(b, 0, 0, CEIL, 480, 360, CEIL + 1, lambda ax, s: M["ceiling"] if (ax, s) == (2, -1) else None)
    # thresholds
    b.flat_box(281.25, -6, -0.5, 318.75, 0, 0.6, W("white-oak"))
    b.flat_box(281.25, 360, -0.5, 318.75, 366, 0.6, W("white-oak"))
    return b.finish(root)


def build_roof():
    """Gable roof, ridge running front to back, so the gable faces the street; a shallow
    shed roof over the porch tucks under it."""
    b = Builder("roof")
    pitch = 0.5
    ridge_x, eave = 240, 12
    z_wall = TOP
    zr = z_wall + pitch * (ridge_x + 6)
    t = 7
    for side in (-1, 1):
        xe = -6 - eave if side < 0 else 486 + eave
        ze = z_wall - pitch * eave
        y0, y1 = -6 - 14, 366 + 12
        # top (shingles), underside (soffit), fascia
        p = lambda x, y, z: b.bm.verts.new((x * IN, y * IN, z * IN))
        a, bb, c, d = p(xe, y0, ze + t), p(ridge_x, y0, zr + t), p(ridge_x, y1, zr + t), p(xe, y1, ze + t)
        e, f, g, h = p(xe, y0, ze), p(ridge_x, y0, zr), p(ridge_x, y1, zr), p(xe, y1, ze)
        faces = [
            ((a, bb, c, d), "roof"), ((e, h, g, f), "trim"), ((a, d, h, e), "trim"),
            ((a, e, f, bb), "trim"), ((d, c, g, h), "trim"),
        ]
        made = []
        for vs, mn in faces:
            fc = b.bm.faces.new(vs if side > 0 else list(reversed(vs)))
            fc.material_index = b.slot(M[mn])
            made.append(fc)
        b.bm.normal_update()
        b.uv_faces(made)
    # gable ends, in siding, filling the triangle over each end wall
    for y0, y1 in ((-6, 0), (360, 366)):
        pts = [(-6, z_wall), (486, z_wall), (ridge_x, zr)]
        vs0 = [b.bm.verts.new((x * IN, y0 * IN, z * IN)) for x, z in pts]
        vs1 = [b.bm.verts.new((x * IN, y1 * IN, z * IN)) for x, z in pts]
        fs = [b.bm.faces.new(vs0), b.bm.faces.new(list(reversed(vs1)))]
        for i in range(3):
            j = (i + 1) % 3
            fs.append(b.bm.faces.new((vs0[i], vs1[i], vs1[j], vs0[j])))
        for fc in fs:
            fc.material_index = b.slot(M["siding"])
        b.bm.normal_update()
        b.uv_faces(fs)
    # porch roof
    b.flat_box(-8, -114, 119, 488, -6, 121, M["roof"])
    b.flat_box(-8, -114, 116, 488, -112.5, 121, M["trim"])
    b.flat_box(-6, -102, 108, 486, -6, 116, M["trim"])
    return b.finish(root, 30)


def build_chimney():
    b = Builder("chimney")
    br = lambda ax, s: M["brick"]
    slab(b, -36, 90, GRADE, -18, 150, 196, br)
    slab(b, -18, 90, GRADE, -6, 102, 196, br)
    slab(b, -18, 138, GRADE, -6, 150, 196, br)
    slab(b, -18, 102, GRADE, -6, 138, 0, br)
    slab(b, -18, 102, 30, -6, 138, 196, br)
    slab(b, -37, 89, 196, -5, 151, 199, lambda ax, s: M["slate"])
    return b.finish(root)


# ================================================================== exterior trim, doors


def boards_round_hole(b, plane, face, c0, c1, z0, z1, w=3.5, t=1.0, sill=False, mat=None):
    """Flat casing boards round a hole on a wall face. plane: "x" walls run along x."""
    mat = mat or M["trim"]
    s = 1 if face > 0 else -1

    def bx(a0, a1, h0, h1, out=t):
        cz = (h0 + h1) / 2
        if plane == "x":
            b.box(a1 - a0, h1 - h0, out, ((a0 + a1) / 2, face + s * out / 2, cz), mat, ease=0.08)
        else:
            b.box(out, h1 - h0, a1 - a0, (face + s * out / 2, (a0 + a1) / 2, cz), mat, ease=0.08)
    bx(c0 - w, c0, z0 if not sill else z0 - 1.5, z1 + w)
    bx(c1, c1 + w, z0 if not sill else z0 - 1.5, z1 + w)
    bx(c0, c1, z1, z1 + w)
    if sill:
        bx(c0 - w - 1, c1 + w + 1, z0 - 1.5, z0, out=t + 1.5)


def build_exterior_trim():
    b = Builder("exterior_trim")
    for name, (w, c) in WINDOWS.items():
        h0, h1, z0, z1 = win_hole(c)
        if w == "front":
            boards_round_hole(b, "x", -6, h0, h1, z0, z1, sill=True)
        elif w == "back":
            boards_round_hole(b, "x", 366, h0, h1, z0, z1, sill=True)
        elif w == "west":
            boards_round_hole(b, "y", -6, h0, h1, z0, z1, sill=True)
    boards_round_hole(b, "x", -6, FRONT_DOOR[0], FRONT_DOOR[1], 0, FRONT_DOOR[3], w=4.5)
    boards_round_hole(b, "x", 366, BACK_DOOR[0], BACK_DOOR[1], 0, BACK_DOOR[3], w=4.5)
    # corner boards and a frieze under the eaves
    for x, y in ((-6, -6), (486, -6), (-6, 366), (486, 366)):
        b.box(5, TOP, 5, (x + (2.5 if x > 0 else -2.5) * 0 , y, TOP / 2), M["trim"], ease=0.1)
    for y in (-6, 366):
        b.box(494, 7, 1, (240, y + (-0.5 if y < 0 else 0.5), TOP - 3.5), M["trim"])
    for x in (-6, 486):
        b.box(1, 7, 374, (x + (-0.5 if x < 0 else 0.5), 180, TOP - 3.5), M["trim"])
    return b.finish(root)


def jambs_and_casing(b, axis, face_lo, face_hi, c0, c1, top, casing_lo=True, casing_hi=True, w=3.5, t=0.75):
    """Line a hole with jamb boards and case it on one or both faces."""
    depth = face_hi - face_lo
    mid = (face_lo + face_hi) / 2
    if axis == "x":
        b.box(0.75, top, depth, (c0 + 0.375, mid, top / 2), M["trim"], ease=0.04)
        b.box(0.75, top, depth, (c1 - 0.375, mid, top / 2), M["trim"], ease=0.04)
        b.box(c1 - c0, 0.75, depth, ((c0 + c1) / 2, mid, top - 0.375), M["trim"], ease=0.04)
    else:
        b.box(depth, top, 0.75, (mid, c0 + 0.375, top / 2), M["trim"], ease=0.04)
        b.box(depth, top, 0.75, (mid, c1 - 0.375, top / 2), M["trim"], ease=0.04)
        b.box(depth, 0.75, c1 - c0, (mid, (c0 + c1) / 2, top - 0.375), M["trim"], ease=0.04)
    for face, on, s in ((face_lo, casing_lo, -1), (face_hi, casing_hi, 1)):
        if not on:
            continue
        r = 0.25
        if axis == "x":
            b.box(w, top + r + w, t, (c0 - r - w / 2, face + s * t / 2, (top + r + w) / 2), M["trim"])
            b.box(w, top + r + w, t, (c1 + r + w / 2, face + s * t / 2, (top + r + w) / 2), M["trim"])
            b.box(c1 - c0 + 2 * r, w, t, ((c0 + c1) / 2, face + s * t / 2, top + r + w / 2), M["trim"])
        else:
            b.box(t, top + r + w, w, (face + s * t / 2, c0 - r - w / 2, (top + r + w) / 2), M["trim"])
            b.box(t, top + r + w, w, (face + s * t / 2, c1 + r + w / 2, (top + r + w) / 2), M["trim"])
            b.box(t, w, c1 - c0 + 2 * r, (face + s * t / 2, (c0 + c1) / 2, top + r + w / 2), M["trim"])


def build_doors_and_openings():
    b = Builder("openings")
    # front door: jambs, casing inside; the door stands open into the hall
    jambs_and_casing(b, "x", -6, 0, FRONT_DOOR[0], FRONT_DOOR[1], 80.75, casing_lo=False)
    jambs_and_casing(b, "x", 360, 366, BACK_DOOR[0], BACK_DOOR[1], 80.75, casing_hi=False)
    jambs_and_casing(b, "y", 336, 340.5, 60, 132, 84)
    ob = b.finish(root)

    # Front door: a craftsman door, three lites over two panels, painted deep green,
    # swung open against the hall
    d = Builder("front_door")
    W_, H_, T_ = 36, 80, 1.75
    d.box(W_, H_, T_, (0, 0, H_ / 2), M["door_green"], ease=0.08)
    for i in range(3):
        d.box(9, 10, T_ + 0.2, (-11 + i * 11, 0, 66), M["glass"], ease=0)
    for zc in (20, 42):
        d.box(26, 16, 0.3, (0, T_ / 2 + 0.05, zc), M["door_green"], ease=0.04)
        d.box(26, 16, 0.3, (0, -T_ / 2 - 0.05, zc), M["door_green"], ease=0.04)
    d.box(30, 2.5, 0.6, (0, T_ / 2 + 0.2, 57), M["door_green"], ease=0.15)
    d.lathe([(1.0, 0), (1.0, 0.2), (0.4, 0.3), (0.4, 1.4), (0.9, 1.9), (0.9, 2.3), (0.001, 2.35)], (14.5, T_ / 2, 36),
            M["metal_black"], 32, Matrix.Rotation(math.radians(-90), 4, "X"))
    fd = d.finish(root)
    fd.location = v(282.3, 19, 0)
    fd.rotation_euler = (0, 0, math.radians(92))

    # Back door: a full-lite door onto the deck, open
    bd = Builder("back_door")
    bd.box(36, 80, 1.75, (0, 0, 40), M["trim"], ease=0.08)
    bd.box(28, 68, 2.0, (0, 0, 42), M["glass"], ease=0)
    bdo = bd.finish(root)
    bdo.location = v(317.7, 341, 0)
    bdo.rotation_euler = (0, 0, math.radians(92))
    return ob


# ================================================================== porch


def build_porch():
    b = Builder("porch")
    # floor boards run out from the house
    for x in range(-6, 486, 4):
        b.box(3.85, 0.75, 96, (x + 2, -54, -0.375), M["porch_floor"], ease=0.05, grain=1)
    b.box(494, 7.25, 1.5, (240, -102.75, -4), M["trim"])                       # skirt
    b.box(1.5, 7.25, 98, (-7.75, -54, -4), M["trim"])
    b.box(1.5, 7.25, 98, (487.75, -54, -4), M["trim"])
    # lattice-less: solid painted skirting boards down to grade
    for x0, x1 in ((-8, 270), (330, 488)):
        b.box(x1 - x0, -GRADE - 7, 1, ((x0 + x1) / 2, -102.5, (GRADE + -7.6) / 2), M["trim"], ease=0.05)
    # steps down to the walk
    for i, z in enumerate((-8, -16)):
        y0 = -102 - 11 * (i + 1)
        b.box(62, 1.25, 12, (300, y0 + 6, z - 0.625 + 0), M["porch_floor"], ease=0.1)
        b.box(60, 8, 1, (300, y0 + 0.5, z - 4.6), M["trim"], ease=0.05)
        b.box(1.5, -GRADE + z, 12, (269.25, y0 + 6, (GRADE + z) / 2), M["trim"])
        b.box(1.5, -GRADE + z, 12, (330.75, y0 + 6, (GRADE + z) / 2), M["trim"])
    # beam over the columns, and the frieze
    b.box(494, 7.25, 6, (240, -92, CEIL - 3.625), M["trim"], ease=0.12)
    ob = b.finish(root)
    return ob


COLUMN_X = [12, 135, 258, 342, 468]
COLUMN_Y = -92


def build_columns():
    top = CEIL - 7.25
    white = M["trim"]
    for opt in ("box", "tapered", "tuscan", "turned", "timber"):
        c = hidden_coll(f"col:{opt}")
        b = Builder(f"column_{opt}")
        if opt == "box":
            b.box(8, top, 8, (0, 0, top / 2), white, 0.12)
            b.box(10, 8, 10, (0, 0, 4), white, 0.12)
            b.box(9, 0.75, 9, (0, 0, 8.4), white, 0.2)
            b.box(10, 4, 10, (0, 0, top - 2), white, 0.12)
            b.box(11, 1.25, 11, (0, 0, top - 4.6), white, 0.3)
        elif opt == "tapered":
            b.box(20, 36, 20, (0, 0, 18), M["brick"], 0.0)
            b.box(23, 2.5, 23, (0, 0, 37.25), paint_mat("pier_cap", 0xb9b4ab, 0.8, bevel=0.08), 0.2)
            h = top - 38.5 - 5
            b.lathe([(12 / math.sqrt(2), 0), (8 / math.sqrt(2), h)], (0, 0, 40), white, 4, Matrix.Rotation(math.radians(45), 4, "Z"))
            b.box(14, 3, 14, (0, 0, 40), white, 0.15)
            b.box(11, 3.5, 11, (0, 0, top - 1.75), white, 0.15)
            b.box(12.5, 1.25, 12.5, (0, 0, top - 4), white, 0.3)
        elif opt == "tuscan":
            b.box(12.5, 2, 12.5, (0, 0, 1), white, 0.12)
            prof = [[6.1, 0], [6.1, 0.6], [5.7, 1.6], [5.0, 2.2], [4.95, 3], [4.85, 20], [4.6, 50], [4.2, 82],
                    [4.05, 87], [4.5, 87.4], [4.5, 88.6], [4.05, 89], [4.0, 91.5], [4.3, 93], [5.2, 94.8], [5.6, 95.8], [5.6, top - 4.2]]
            b.lathe(prof, (0, 0, 2), white, 64)
            b.box(12.5, 2.25, 12.5, (0, 0, top - 1.125), white, 0.12)
        elif opt == "turned":
            b.box(5.5, 32, 5.5, (0, 0, 16), white, 0.25)
            b.box(5.5, top - 86, 5.5, (0, 0, (86 + top) / 2), white, 0.25)
            prof = [[2.4, 0], [2.6, 0.8], [2.0, 1.6], [1.6, 3], [2.5, 5], [2.75, 6.5], [2.2, 8], [1.5, 10],
                    [1.4, 16], [2.2, 26], [2.6, 32], [2.3, 37], [1.6, 40], [1.4, 43], [2.1, 45], [2.6, 47.5], [2.0, 50], [2.4, 52], [2.4, 54]]
            b.lathe(prof, (0, 0, 32), white, 48)
        elif opt == "timber":
            b.box(7.5, top - 3, 7.5, (0, 0, 3 + (top - 3) / 2), W("rough-cedar"), 0.35, grain=2)
            b.box(8.5, 3, 8.5, (0, 0, 1.5), M["metal_black"], 0.1)
        b.finish(c)
        variant("columns", opt, "inst", c.name)
    place_coll = coll("porch_columns", root)
    for i, x in enumerate(COLUMN_X):
        e = place(bpy.data.collections["col:box"], f"column_{i}", (x, COLUMN_Y, 0), parent=place_coll)
        e["slot"] = "columns"
    DEFAULTS["columns"] = "box"


def build_porch_ceiling():
    y0, y1 = -102, -6
    for opt in ("stained", "white", "cedar", "haint", "beadboard", "pine"):
        c = coll(f"v:ceiling:{opt}", var_root)
        b = Builder(f"porch_ceiling_{opt}")
        if opt == "stained":
            mat = W("stained")
        elif opt == "cedar":
            mat = W("ceiling-cedar")
        elif opt == "pine":
            mat = W("knotty-pine")
        elif opt == "haint":
            mat = paint_mat("haint", 0xb2cfc9, 0.45, bevel=0.03)
        else:
            mat = paint_mat("porch_white", TRIM, 0.45, bevel=0.03)
        bw = 1.75 if opt == "beadboard" else 3.5
        b.box(494, 0.25, y1 - y0, (240, (y0 + y1) / 2, CEIL + 0.9), paint_mat("porch_backing", 0x2a2018, 0.9, bevel=0), 0)
        y = y0
        while y < y1 - 0.1:
            if opt == "beadboard":
                b.box(494, 0.6, bw - 0.08, (240, y + bw / 2, CEIL + 0.3), mat, 0.03, grain=0)
                b.lathe([(0.12, 0), (0.12, 494)], (-7, y, CEIL - 0.02), mat, 8, Matrix.Rotation(math.radians(90), 4, "Y"))
            else:
                b.box(494, 0.75, bw - 0.04, (240, y + bw / 2, CEIL + 0.375), mat, 0.02, grain=0)
            y += bw
        b.finish(c)
        variant("ceiling", opt, "coll", c.name)
    DEFAULTS["ceiling"] = "stained"


# ================================================================== deck

DX0, DX1, DY0, DY1 = 192, 408, 366, 510


def build_deck():
    b = Builder("deck")
    for x, y0, y1 in ((DX0, DY0, DY1), (DX1, DY0, DY1)):
        b.box(1.5, 9.25, y1 - y0, (x + (-0.75 if x == DX0 else 0.75), (y0 + y1) / 2, DECK - 5.6), M["trim"], 0.08)
    b.box(DX1 - DX0 + 3, 9.25, 1.5, ((DX0 + DX1) / 2, DY1 + 0.75, DECK - 5.6), M["trim"], 0.08)
    for x in (DX0 + 4, DX1 - 4):
        b.box(5.5, DECK - GRADE - 1.5, 5.5, (x, DY1 - 6, (DECK - 1.5 + GRADE) / 2), M["trim"], 0.1)
    # stairs down to the lawn, in the gap in the railing
    for i, z in enumerate((DECK - 8,)):
        b.box(72, 1.25, 11, (300, DY1 + 6.5, z - 0.6), W("cedar"), 0.1, grain=0)
        b.box(72, 7.5, 1, (300, DY1 + 1.5, z - 4), M["trim"])
    b.finish(root)

    for opt in ("cedar", "treated", "grey", "brown", "ipe"):
        c = coll(f"v:decking:{opt}", var_root)
        key = {"cedar": "cedar", "treated": "treated", "grey": "composite-grey", "brown": "composite-brown", "ipe": "ipe"}[opt]
        mat = W(key)
        db = Builder(f"deck_boards_{opt}")
        y = DY0 + 0.5
        while y + 5.5 <= DY1 + 0.5:
            db.box(DX1 - DX0, 1, 5.5, ((DX0 + DX1) / 2, y + 2.75, DECK - 0.5), mat, 0.12, grain=0)
            y += 5.75
        db.finish(c)
        variant("decking", opt, "coll", c.name)
    DEFAULTS["decking"] = "cedar"


RAIL_TOP = 40


def build_railing():
    """Posts, rails and cap are the house's; what fills each 6ft bay is the style."""
    white = M["trim"]
    b = Builder("railing")
    PX = 36
    posts = [(DX0, DY1 - 1.75), (264, DY1 - 1.75), (336, DY1 - 1.75), (DX1, DY1 - 1.75),
             (DX0 + 1.75, 438), (DX1 - 1.75, 438), (DX0 + 1.75, DY0 + 2), (DX1 - 1.75, DY0 + 2)]
    for x, y in posts:
        b.box(3.5, RAIL_TOP + 4, 3.5, (x, y, DECK + (RAIL_TOP + 4) / 2 - 4), white, 0.12)
        b.box(4.5, 1, 4.5, (x, y, DECK + RAIL_TOP + 0.6), white, 0.2)
    bays = []   # (centre, along-axis, length)
    for x0, x1 in ((DX0, 264), (336, DX1)):
        bays.append((((x0 + x1) / 2, DY1 - 1.75), "x", x1 - x0))
    for x in (DX0 + 1.75, DX1 - 1.75):
        for y0, y1 in ((DY0 + 2, 438), (438, DY1 - 1.75)):
            bays.append(((x, (y0 + y1) / 2), "y", y1 - y0))
    for (cx, cy), ax, L in bays:
        inner = L - 3.5
        if ax == "x":
            b.box(inner, 3.5, 1.5, (cx, cy, DECK + RAIL_TOP - 1.75), white, 0.08)
            b.box(inner, 1.5, 3.5, (cx, cy, DECK + 4.25), white, 0.08)
            b.box(L + 4, 1.5, 5.5, (cx, cy, DECK + RAIL_TOP + 0.75 - 0.0), white, 0.14)
        else:
            b.box(1.5, 3.5, inner, (cx, cy, DECK + RAIL_TOP - 1.75), white, 0.08)
            b.box(3.5, 1.5, inner, (cx, cy, DECK + 4.25), white, 0.08)
            b.box(5.5, 1.5, L + 4, (cx, cy, DECK + RAIL_TOP + 0.75), white, 0.14)
    b.finish(root)

    # each style fills a bay 68.5in long, built along local X about its centre
    x0, x1, y0, y1 = -34.25, 34.25, 5, RAIL_TOP - 3.5
    for opt in ("metal", "picket", "cable", "slat", "glass"):
        c = hidden_coll(f"rail:{opt}")
        ib = Builder(f"rail_infill_{opt}")
        if opt == "metal":
            x = x0 + 2.4
            while x < x1 - 1:
                ib.lathe([(0.375, 0), (0.375, y1 - y0)], (x, 0, y0), M["metal_black"], 14)
                x += 4.5
        elif opt == "picket":
            x = x0 + 2.5
            while x < x1 - 1:
                ib.box(1.5, y1 - y0, 1.5, (x, 0, (y0 + y1) / 2), white, 0.1)
                x += 5.2
        elif opt == "cable":
            y = y0 + 2.5
            while y < y1 - 1:
                ib.lathe([(0.09, 0), (0.09, x1 - x0)], (x0, 0, y), M["steel"], 8, Matrix.Rotation(math.radians(90), 4, "Y"))
                y += 3
        elif opt == "slat":
            y = y0 + 1
            while y + 3.5 <= y1:
                ib.box(x1 - x0, 3.5, 0.75, (0, 0, y + 1.75), white, 0.08)
                y += 4.1
        elif opt == "glass":
            ib.box(x1 - x0 - 1, y1 - y0 - 1, 0.5, (0, 0, (y0 + y1) / 2), M["glass"], 0.05)
            for px, py in ((x0 + 6, y0 + 2), (x1 - 6, y0 + 2), (x0 + 6, y1 - 2), (x1 - 6, y1 - 2)):
                ib.box(2, 1.4, 1.4, (px, 0, py), M["steel"], 0.15)
        ib.finish(c)
        variant("railing", opt, "inst", c.name)
    pc = coll("rail_bays", root)
    for i, ((cx, cy), ax, L) in enumerate(bays):
        s = (L - 3.5) / 68.5
        m = Matrix.Translation(v(cx, cy, DECK)) @ Matrix.Rotation(math.radians(0 if ax == "x" else 90), 4, "Z") @ Matrix.Diagonal((s, 1, 1, 1))
        e = instance(bpy.data.collections["rail:metal"], f"rail_bay_{i}", m, pc)
        e["slot"] = "railing"
    DEFAULTS["railing"] = "metal"


# ================================================================== fence

FENCE_Y, FX0, FX1 = 900, -240, 816


def fence_run(name, opt, X0, X1, y, collection):
    """One straight run of fence along x at y, faces toward -y."""
    posts = list(range(X0, X1 + 1, 96))
    b = Builder(name)
    cedar = W("cedar")
    white = paint_mat("fence_white", TRIM, 0.45, bevel=0.05)
    tall = opt != "picket"
    H = 72 if tall else 42
    z0 = GRADE
    postmat = white if opt == "picket" else cedar
    ph = H + (4 if opt == "picket" else 0)
    for x in posts:
        b.box(3.5, ph, 3.5, (x, y + 1.75, z0 + ph / 2), postmat, 0.12, grain=2)
    rails = [8, 36, 64] if tall else [8, 32]
    for x in posts[:-1]:
        for r in rails:
            b.box(92.5, 3.5, 1.5, (x + 48, y + 0.75, z0 + r), postmat, 0.08, grain=0)
    if opt == "privacy":
        x = X0
        while x < X1:
            b.box(5.5, H, 0.75, (x + 2.75, y - 0.375, z0 + H / 2), cedar, 0.06, grain=2)
            x += 5.625
    elif opt == "shadowbox":
        x = X0
        while x < X1:
            b.box(5.5, H, 0.75, (x + 2.75, y - 0.375, z0 + H / 2), cedar, 0.06, grain=2)
            b.box(5.5, H, 0.75, (x + 7.25, y + 1.875, z0 + H / 2), cedar, 0.06, grain=2)
            x += 9
    elif opt == "horizontal":
        dark = W("cedar-dark")
        for x in posts[:-1]:
            yy = 1
            while yy + 5.5 <= H:
                b.box(96, 5.5, 0.75, (x + 48, y - 0.375, z0 + yy + 2.75), dark, 0.06, grain=0)
                yy += 6
            b.box(98, 1.5, 3.5, (x + 48, y + 0.5, z0 + H + 0.75), dark, 0.1, grain=0)
    elif opt == "picket":
        x = X0 + 6
        while x < X1:
            if all(abs(p - x) >= 3 for p in posts):
                b.prism([(-1.75, 0), (1.75, 0), (1.75, H - 2.5), (0, H), (-1.75, H - 2.5)], 0.6, (x, y - 0.35, z0), white)
            x += 6
        for p in posts:
            b.box(5, 1.25, 5, (p, y + 1.75, z0 + H + 4.6), white, 0.2)
    elif opt == "capped":
        x = X0
        while x < X1:
            b.box(5.5, H - 6, 0.75, (x + 2.75, y - 0.375, z0 + (H - 6) / 2), cedar, 0.06, grain=2)
            b.box(5.5, H - 6, 0.75, (x + 7.25, y - 1.125, z0 + (H - 6) / 2), cedar, 0.06, grain=2)
            x += 9
        b.box(X1 - X0, 3.5, 0.75, ((X0 + X1) / 2, y - 1.875, z0 + H - 4.25), cedar, 0.06, grain=0)
        b.box(X1 - X0 + 2, 1.5, 5.5, ((X0 + X1) / 2, y, z0 + H - 1.75), cedar, 0.1, grain=0)
    return b.finish(collection)


FENCE_EAST_X = 816


def build_fence():
    for opt in ("privacy", "shadowbox", "horizontal", "picket", "capped"):
        c = coll(f"v:fence:{opt}", var_root)
        fence_run(f"fence_back_{opt}", opt, FX0, FX1, FENCE_Y, c)
        east = fence_run(f"fence_east_{opt}", opt, -FENCE_Y, -384, 0, c)
        east.rotation_euler = (0, 0, math.radians(-90))
        east.location = v(FENCE_EAST_X, 0, 0)
        variant("fence", opt, "coll", c.name)
    DEFAULTS["fence"] = "privacy"


# ================================================================== the interior, from the quiz scenes


def frame_fn(origin, n):
    u = (-n[1], n[0])
    from hlib import station_frame
    return station_frame(origin, u, n)


def local_frame(x, y, z):
    """Three's frame to a library collection's own: X right, Y into the wall, Z up."""
    return (x * IN, -z * IN, y * IN)


def placement(origin, n):
    """The matrix that stands a library collection built in local_frame on a wall."""
    u = Vector((-n[1], n[0], 0))
    nn = Vector((n[0], n[1], 0))
    rot = Matrix((u, -nn, Vector((0, 0, 1)))).transposed().to_4x4()
    return Matrix.Translation(v(*origin)) @ rot


def build_windows():
    """Every window shares one casing: the trim question swaps it everywhere at once."""
    for opt in ("square", "22", "45", "cap", "colonial", "victorian", "frame"):
        c = hidden_coll(f"trim:{opt}")
        data = load_export("trim", opt)
        import_meshes(data, local_frame, from_export, f"trim_{opt}", c)
        variant("trim", opt, "inst", c.name)
    DEFAULTS["trim"] = "square"
    wc = coll("windows", root)
    for name, (w, c) in WINDOWS.items():
        if w == "front":
            origin, n = (c, 0, SILL), (0, 1)
        elif w == "back":
            origin, n = (c, 360, SILL), (0, -1)
        elif w == "west":
            origin, n = (0, c, SILL), (1, 0)
        else:
            origin, n = (480, c, SILL), (-1, 0)
        e = instance(bpy.data.collections["trim:square"], f"window_{name}", placement(origin, n), wc)
        e["slot"] = "trim"


def build_interior_doors():
    """The bedroom door off the hall: the doors question. Its handle is the hardware's."""
    origin, n = (264, 300, 0), (1, 0)
    f = frame_fn(origin, n)

    def keep(m, bb):
        if m["mat"]["kind"] == "metal":
            return False
        return (bb[1] - bb[0]) < 60
    for opt in ("slab", "shaker2", "shaker3", "shaker5", "raised6", "french"):
        c = coll(f"v:doors:{opt}", var_root)
        import_meshes(load_export("doors", opt), f, from_export, f"door_{opt}", c, keep)
        variant("doors", opt, "coll", c.name)
    DEFAULTS["doors"] = "shaker5"


HANDLE_AT = (263.0, 313.75, 36)


def build_hardware():
    """Door hardware, built about the rose in the quiz's own frame (local_frame)."""
    rx = Matrix.Rotation(math.radians(90), 4, "X")      # lathe axis Z -> -Y, out of the door
    ry = Matrix.Rotation(math.radians(90), 4, "Y")      # lathe axis Z -> X

    def rose(b, mat):
        b.lathe([[1.3, 0], [1.3, 0.14], [1.18, 0.3], [0.62, 0.42], [0.42, 0.5], [0.001, 0.5]], (0, 0, 0), mat, 48, rx)

    def capsule(r, L, n=8):
        pts = [(r * math.sin(math.pi / 2 * i / n), -L / 2 - r * math.cos(math.pi / 2 * i / n)) for i in range(n + 1)]
        pts += [(r * math.sin(math.pi / 2 + math.pi / 2 * i / n), L / 2 - r * math.cos(math.pi / 2 + math.pi / 2 * i / n)) for i in range(1, n + 1)]
        return [(max(p[0], 0.001), p[1]) for p in pts]

    def lever(b, mat):
        b.lathe([(0.42, 0.4), (0.4, 1.6)], (0, 0, 0), mat, 32, rx)
        b.lathe(capsule(0.3, 4.1), (-2.15, -1.55, 0), mat, 24, ry)

    opts = {}
    for fin in ("black", "satinbrass", "brass", "nickel", "chrome", "bronze"):
        opts[f"finish:{fin}"] = ("lever", METALS[fin])
    for shape in ("knob", "lever", "curved", "glass", "square"):
        opts[f"handles:{shape}"] = (shape, METALS["satinbrass"])
    for key, (shape, mat) in opts.items():
        c = hidden_coll(f"hw:{key}")
        b = Builder(f"hw_{key.replace(':', '_')}")
        if shape == "lever":
            rose(b, mat); lever(b, mat)
        elif shape == "knob":
            rose(b, mat)
            b.lathe([[0.38, 0], [0.4, 0.55], [0.98, 0.95], [1.16, 1.45], [1.02, 2.0], [0.48, 2.25], [0.001, 2.27]], (0, -0.45, 0), mat, 48, rx)
        elif shape == "curved":
            rose(b, mat)
            b.lathe([(0.42, 0.4), (0.4, 1.6)], (0, 0, 0), mat, 32, rx)
        elif shape == "glass":
            b.lathe([[0.85, 0], [0.85, 0.1], [0.7, 0.24], [0.42, 0.3], [0.001, 0.3]], (0, 0, 0), mat, 40, rx)
            b.lathe([(0.36, 0.2), (0.3, 0.9)], (0, 0, 0), mat, 24, rx)
            b.lathe([[0.45, 0], [0.6, 0.3], [1.18, 0.75], [1.24, 1.55], [0.98, 1.95], [0.001, 2.0]], (0, -0.85, 0), M["glass_solid"], 12, rx)
        elif shape == "square":
            b.box(2.4, 2.4, 0.35, (0, -0.175, 0), mat, 0.06)
            b.box(0.6, 0.6, 1.1, (0, -0.9, 0), mat, 0.08)
            b.box(4.6, 0.6, 0.45, (-2.0, -1.55, 0), mat, 0.1)
        ob = b.finish(c, smooth_angle=None if shape == "glass" else 50)
        if shape == "curved":
            cu = bpy.data.curves.new("curved_lever", "CURVE")
            cu.dimensions = "3D"
            cu.bevel_depth = 0.29 * IN
            cu.bevel_resolution = 6
            sp = cu.splines.new("BEZIER")
            pts = [(0, 0, 1.55), (-1.4, 0.02, 1.68), (-3.0, -0.12, 1.58), (-4.3, -0.55, 1.12)]
            sp.bezier_points.add(len(pts) - 1)
            for bp, (x, y, z) in zip(sp.bezier_points, pts):
                bp.co = local_frame(x, y, z)
                bp.handle_left_type = bp.handle_right_type = "AUTO"
            cu.use_fill_caps = True
            co = bpy.data.objects.new("curved_lever_arm", cu)
            co.data.materials.append(mat)
            c.objects.link(co)
        variant("hardware", key, "inst", c.name)
    e = instance(bpy.data.collections["hw:finish:black"], "bedroom_door_handle",
                 placement(HANDLE_AT, (1, 0)), coll("hardware", root))
    e["slot"] = "hardware"
    DEFAULTS["hardware"] = "finish:black"


def build_mantels():
    origin, n = (0, 120, 0), (1, 0)
    f = frame_fn(origin, n)
    for opt in ("beam", "craftsman", "colonial", "overmantel"):
        c = coll(f"v:mantel:{opt}", var_root)
        import_meshes(load_export("mantel", opt), f, from_export, f"mantel_{opt}", c)
        variant("mantel", opt, "coll", c.name)
    DEFAULTS["mantel"] = "craftsman"


def build_builtins():
    origin, n = (132, 240, 0), (0, -1)
    f = frame_fn(origin, n)

    def keep(m, bb):
        return (bb[1] - bb[0]) < 200
    for opt in ("open", "cabinet", "glass", "floating", "library"):
        c = coll(f"v:builtin:{opt}", var_root)
        import_meshes(load_export("builtin", opt), f, from_export, f"builtin_{opt}", c, keep)
        # baseboard either side, up to the case (the house's own base runs stop at 66 and 198)
        half = {"library": 66, "floating": 0}.get(opt, 42)
        runs = {66: [], 42: [[(198, 240), (174, 240)], [(90, 240), (66, 240)]], 0: [[(198, 240), (66, 240)]]}[half]
        if runs:
            b = Builder(f"builtin_base_{opt}")
            for run in runs:
                for prof in PROFILES["houseBase"]:
                    b.sweep(prof["p"], run, M["trim"], prof["y"])
            b.finish(c)
        variant("builtin", opt, "coll", c.name)
    DEFAULTS["builtin"] = "open"


def build_panels():
    origin, n = (480, 120, 0), (-1, 0)
    f0 = frame_fn(origin, n)

    def f(x, y, z):
        return f0(x, min(y, CEIL - 0.05), z)

    def keep(m, bb):
        return bb[2] < CEIL - 0.5
    for opt in ("none", "beadboard", "batten", "frame", "raised", "shiplap"):
        c = coll(f"v:panel:{opt}", var_root)
        import_meshes(load_export("panel", opt), f, from_export, f"panel_{opt}", c, keep)
        variant("panel", opt, "coll", c.name)
    DEFAULTS["panel"] = "none"


# ================================================================== base and crown, along the walls

with open(os.path.join(EXPORT, "profiles.json"), encoding="utf-8") as fh:
    PROFILES = json.load(fh)

# Wall runs, room on the left, each a polyline in plan inches
BASE_RUNS = [
    [(0, 87), (0, 0), (259.5, 0), (259.5, 72), (264, 72), (264, 0), (277.5, 0)],      # living, round the opening
    [(264, 279.75), (264, 168), (259.5, 168), (259.5, 240), (198, 240)],               # opening's north side
    [(66, 240), (0, 240), (0, 153)],
    [(340.5, 56.25), (340.5, 0), (480, 0)],                                            # dining
    [(480, 240), (340.5, 240), (340.5, 135.75)],
    [(322.25, 0), (336, 0), (336, 56.25)],                                             # hall
    [(336, 135.75), (336, 360), (322.25, 360)],
    [(277.75, 360), (264, 360), (264, 320.25)],
]
CROWN_LOOPS = [
    [(0, 0), (259.5, 0), (259.5, 240), (0, 240)],
    [(340.5, 0), (480, 0), (480, 240), (340.5, 240)],
    [(264, 0), (336, 0), (336, 360), (264, 360)],
]


def build_base_and_crown():
    for opt, pieces in PROFILES["base"].items():
        c = coll(f"v:base:{opt}", var_root)
        b = Builder(f"base_{opt}")
        for run in BASE_RUNS:
            for pc in pieces:
                t = pc.get("t", 0)
                prof = [(u, tt + t) for u, tt in pc["p"]] if t else pc["p"]
                b.sweep(prof, run, M["trim"], pc["y"])
        b.finish(c)
        variant("base", opt, "coll", c.name)
    DEFAULTS["base"] = "colonial"
    for opt, pieces in PROFILES["crown"].items():
        c = coll(f"v:crown:{opt}", var_root)
        if pieces:
            b = Builder(f"crown_{opt}")
            for loop in CROWN_LOOPS:
                for pc in pieces:
                    b.sweep(pc["p"], loop, M["trim"], CEIL - pc["drop"], down=True, closed=True)
            b.finish(c)
        variant("crown", opt, "coll", c.name)
    DEFAULTS["crown"] = "colonial"


# ================================================================== furnishing, yard


def furnish():
    fc = coll("furniture", root)
    sofa = append_collection("sofa_02")
    place(sofa, "sofa", (128, 22, 0), 0, parent=fc)
    chair = append_collection("mid_century_lounge_chair")
    place(chair, "lounge_chair", (62, 48, 0), -135, parent=fc)
    table = append_collection("modern_coffee_table_01")
    place(table, "coffee_table", (128, 82, 0), 0, parent=fc)
    side = append_collection("side_table_01")
    place(side, "side_table", (208, 22, 0), 0, parent=fc)
    plant = append_collection("potted_plant_02")
    place(plant, "plant_living", (236, 215, 0), 30, 1.3, parent=fc)
    place(plant, "plant_dining", (455, 222, 0), 0, 1.1, parent=fc)
    place(plant, "plant_bed", (40, 330, 0), 0, 1.2, parent=fc)
    place(chair, "bed_chair", (200, 320, 0), 160, parent=fc)
    vase = append_collection("ceramic_vase_01")
    place(vase, "vase", (208, 22, 21.6), 0, 0.9, parent=fc)
    # rug under the sitting area
    b = Builder("rug")
    b.box(110, 0.35, 84, (128, 78, 0.18), M["rug"], 0.1)
    b.finish(fc)
    # porch: rockers, ferns flanking the steps
    rock = append_collection("Rockingchair_01")
    place(rock, "rocker_1", (110, -55, 0), 170, parent=fc)
    place(rock, "rocker_2", (170, -58, 0), 195, parent=fc)
    planter = append_collection("planter_box_01")
    fern = append_collection("fern_02")
    for x in (240, 360):
        place(planter, f"porch_planter_{x}", (x, -88, 0), 0, 0.8, parent=fc)
        place(fern, f"porch_fern_{x}", (x, -88, 13), random.random() * 360, 0.8, parent=fc)
    # deck
    sets = append_collection("outdoor_table_chair_set_01")
    place(sets, "deck_table", (240, 455, DECK), 20, parent=fc)
    place(planter, "deck_planter", (385, 385, DECK), 90, 1.0, parent=fc)
    place(plant, "deck_plant", (215, 385, DECK), 0, 1.2, parent=fc)


def build_yard():
    yc = coll("yard", root)
    b = Builder("ground")
    # lawn everywhere but the walk and the beds
    b.flat_box(-1200, -900, GRADE - 6, 1700, 2400, GRADE, M["lawn_ground"])
    b.finish(yc)
    p = Builder("hardscape")
    p.flat_box(276, -520, GRADE - 2, 324, -135, GRADE + 0.4, M["concrete"])            # walk
    p.flat_box(-1200, -580, GRADE - 2, 1700, -520, GRADE + 0.4, M["concrete"])         # sidewalk
    p.flat_box(-6, -112, GRADE - 2, 270, -102, GRADE + 1.5, M["mulch"])                 # beds
    p.flat_box(330, -112, GRADE - 2, 486, -102, GRADE + 1.5, M["mulch"])
    p.finish(yc)
    # street beyond the sidewalk
    s = Builder("street")
    s.flat_box(-3000, -900, GRADE - 3, 3500, -600, GRADE - 0.5, paint_mat("asphalt", 0x3b3b3b, 0.85, bevel=0, orange_peel=0.6))
    s.finish(yc)
    # trees
    # each tree comes with two levels of detail in one collection: take just one
    t1 = append_collection("island_tree_01", "island_tree_01_LOD1")
    t2 = append_collection("island_tree_02", "island_tree_02_LOD1")
    t3 = append_collection("tree_small_02", "tree_small_02_LOD1")
    rnd = random.Random(3)
    spots = [(-160, -330, t2, 2.2), (720, -260, t1, 1.9), (-420, 300, t1, 2.4), (960, 420, t2, 2.3),
             (1010, 700, t1, 2.5), (1080, 940, t3, 2.6)]
    for i in range(14):
        x = -500 + i * 110 + rnd.uniform(-30, 30)
        y = 1180 + rnd.uniform(0, 300)
        spots.append((x, y, rnd.choice((t1, t2, t3)), rnd.uniform(1.8, 2.8)))
    for i, (x, y, t, s_) in enumerate(spots):
        place(t, f"tree_{i}", (x, y, GRADE), rnd.uniform(0, 360), s_, parent=yc)
    # ferns along the porch skirt
    fern = append_collection("fern_02")
    for i, x in enumerate(list(range(0, 260, 34)) + list(range(345, 486, 34))):
        place(fern, f"bed_fern_{i}", (x + 10, -107, GRADE + 1), rnd.uniform(0, 360), rnd.uniform(0.7, 1.0), parent=yc)
    scatter_grass(yc)


def scatter_grass(yc):
    """Real blades on the lawn where the camera sees it, over the grass texture. In its
    own collection, so renders from indoors can leave it out."""
    yc = coll("grass", yc)
    grass = append_collection("grass_medium_01", "grass_medium_01_LOD1")
    # The asset mixes in patches of dead grass, which in low sun read as snow: green only
    gm = bpy.data.materials.get("grass_medium_01")
    if gm:
        nodes = gm.node_tree.nodes
        green = nodes.get("Image Texture")
        grp = next((n for n in nodes if n.bl_idname == "ShaderNodeGroup"), None)
        if green and grp and "Diffuse Dead" in grp.inputs:
            gm.node_tree.links.new(green.outputs["Color"], grp.inputs["Diffuse Dead"])
    regions = [(-500, -500, 820, -112), (-260, 366, 816, 900)]
    for i, (x0, y0, x1, y1) in enumerate(regions):
        me = bpy.data.meshes.new(f"lawn_{i}")
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        hx, hy = (x1 - x0) / 2 * IN, (y1 - y0) / 2 * IN
        me.from_pydata([(-hx, -hy, 0), (hx, -hy, 0), (hx, hy, 0), (-hx, hy, 0)], [], [(0, 1, 2, 3)])
        ob = bpy.data.objects.new(f"lawn_{i}", me)
        ob.location = v(cx, cy, GRADE + 0.05)
        yc.objects.link(ob)
        mod = ob.modifiers.new("grass", "NODES")
        mod.node_group = grass_nodes(grass)


_grass_ng = None


def grass_nodes(grass):
    global _grass_ng
    if _grass_ng:
        return _grass_ng
    ng = bpy.data.node_groups.new("scatter_grass", "GeometryNodeTree")
    ng.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    ng.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    N = ng.nodes
    gi = N.new("NodeGroupInput"); go = N.new("NodeGroupOutput")
    dist = N.new("GeometryNodeDistributePointsOnFaces")
    dist.inputs["Density"].default_value = 700.0
    ci = N.new("GeometryNodeCollectionInfo")
    ci.inputs["Collection"].default_value = grass
    ci.inputs["Separate Children"].default_value = True
    ci.inputs["Reset Children"].default_value = True
    inst = N.new("GeometryNodeInstanceOnPoints")
    inst.inputs["Pick Instance"].default_value = True
    rr = N.new("FunctionNodeRandomValue"); rr.data_type = "FLOAT_VECTOR"
    [x for x in rr.inputs if x.name == "Max" and x.type == "VECTOR"][0].default_value = (0, 0, 6.283)
    rs = N.new("FunctionNodeRandomValue"); rs.data_type = "FLOAT"
    sock = lambda socks, name, kind: [x for x in socks if x.name == name and x.type == kind][0]
    sock(rs.inputs, "Min", "VALUE").default_value = 0.55
    sock(rs.inputs, "Max", "VALUE").default_value = 1.1
    real = N.new("GeometryNodeRealizeInstances")
    L = ng.links.new
    L(gi.outputs[0], dist.inputs["Mesh"])
    L(dist.outputs["Points"], inst.inputs["Points"])
    L(ci.outputs[0], inst.inputs["Instance"])
    L([x for x in rr.outputs if x.type == "VECTOR"][0], inst.inputs["Rotation"])
    L(sock(rs.outputs, "Value", "VALUE"), inst.inputs["Scale"])
    jg = N.new("GeometryNodeJoinGeometry")
    L(inst.outputs[0], jg.inputs[0])
    L(gi.outputs[0], jg.inputs[0])
    L(jg.outputs[0], go.inputs[0])
    _grass_ng = ng
    return ng


# ================================================================== light and world


def build_world():
    w = bpy.data.worlds.new("sky")
    scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    env = nt.nodes.new("ShaderNodeTexEnvironment")
    import glob
    env.image = bpy.data.images.load(glob.glob(os.path.join(ASSETS, "hdri", "*.hdr"))[0])
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.name = "sun_rot"
    mp.inputs["Rotation"].default_value = (0, 0, math.radians(124))
    nt.links.new(tc.outputs["Generated"], mp.inputs["Vector"])
    nt.links.new(mp.outputs[0], env.inputs["Vector"])
    nt.links.new(env.outputs[0], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 1.0
    nt.links.new(bg.outputs[0], out.inputs[0])
    # portals in every window and door, so the sky that lights a room is sampled through
    # the openings rather than found by chance
    pc = coll("portals", root)
    ops = []
    for name, (wname, c) in WINDOWS.items():
        h0, h1, z0, z1 = win_hole(c)
        if wname == "front":
            ops.append(((c, -6.5, (z0 + z1) / 2), (math.radians(-90), 0, 0), (h1 - h0, z1 - z0)))
        elif wname == "back":
            ops.append(((c, 366.5, (z0 + z1) / 2), (math.radians(90), 0, 0), (h1 - h0, z1 - z0)))
        elif wname == "west":
            ops.append(((-6.5, c, (z0 + z1) / 2), (0, math.radians(90), 0), (z1 - z0, h1 - h0)))
    ops.append(((300, -6.5, 40), (math.radians(-90), 0, 0), (37.5, 80.75)))
    ops.append(((300, 366.5, 40), (math.radians(90), 0, 0), (37.5, 80.75)))
    for i, (loc, rot, (sx, sy)) in enumerate(ops):
        ld = bpy.data.lights.new(f"portal_{i}", "AREA")
        ld.shape = "RECTANGLE"
        ld.size, ld.size_y = sx * IN, sy * IN
        try:
            ld.cycles.is_portal = True
        except AttributeError:
            ld.is_portal = True
        lo = bpy.data.objects.new(f"portal_{i}", ld)
        lo.location = v(*loc)
        lo.rotation_euler = rot
        pc.objects.link(lo)
    # a little warm light inside: a lived-in house has a lamp on
    for i, (x, y) in enumerate(((128, 120), (410, 120), (300, 180))):
        ld = bpy.data.lights.new(f"room_{i}", "AREA")
        ld.shape = "DISK"
        ld.size = 30 * IN
        ld.energy = 60
        ld.color = (1.0, 0.82, 0.62)
        lo = bpy.data.objects.new(f"room_{i}", ld)
        lo.location = v(x, y, CEIL - 2)
        pc.objects.link(lo)


def render_settings():
    scene.render.engine = "CYCLES"
    cy = scene.cycles
    cy.device = "GPU"
    cy.samples = 256
    cy.use_adaptive_sampling = True
    cy.adaptive_threshold = 0.02
    cy.use_denoising = True
    cy.denoiser = "OPENIMAGEDENOISE"
    cy.max_bounces = 10
    cy.diffuse_bounces = 5
    cy.glossy_bounces = 4
    cy.transmission_bounces = 8
    cy.transparent_max_bounces = 16
    cy.sample_clamp_indirect = 8.0
    cy.blur_glossy = 1.0
    cy.caustics_reflective = False
    cy.caustics_refractive = False
    scene.render.resolution_x = 2048
    scene.render.resolution_y = 2048
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.render.image_settings.file_format = "PNG"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for kind in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = kind
            prefs.get_devices()
            if any(d.type == kind for d in prefs.devices):
                for d in prefs.devices:
                    d.use = d.type == kind
                break
        except TypeError:
            continue


# ================================================================== go

build_shell()
build_roof()
build_chimney()
build_exterior_trim()
build_doors_and_openings()
build_porch()
build_columns()
build_porch_ceiling()
build_deck()
build_railing()
build_fence()
build_windows()
build_interior_doors()
build_hardware()
build_mantels()
build_builtins()
build_panels()
build_base_and_crown()
furnish()
build_yard()
build_world()
render_settings()
exclude_library()

scene["variants"] = json.dumps(VARIANTS)
scene["defaults"] = json.dumps(DEFAULTS)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print("saved", OUT, "variants:", {k: len(v_) for k, v_ in VARIANTS.items()})
