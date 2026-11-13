"""Shared helpers for the Blender house: units, materials, and mesh builders.

Everything is authored in inches, in plan: X runs east along the street, Y north into the
lot, Z up, the inside floor at Z = 0. `IN` turns inches into Blender's metres.
"""
import glob
import json
import math
import os
import random

import bmesh
import bpy
from mathutils import Matrix, Vector

IN = 0.0254
ASSETS = os.environ.get("HOUSE_ASSETS", os.path.join(os.path.expanduser("~"), "Tools", "house-assets"))
EXPORT = os.environ.get("HOUSE_EXPORT", os.path.join(os.path.expanduser("~"), "Tools", "house-export"))


def v(x, y, z=0.0):
    return Vector((x * IN, y * IN, z * IN))


def hexrgb(h, alpha=1.0):
    """sRGB hex to linear RGBA, the way Blender wants colours."""
    def lin(c):
        c /= 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (lin((h >> 16) & 255), lin((h >> 8) & 255), lin(h & 255), alpha)


# ------------------------------------------------------------------ collections

def coll(name, parent=None):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
        (parent or bpy.context.scene.collection).children.link(c)
    return c


def hidden_coll(name):
    """A collection that only exists to be instanced: kept out of the view layer."""
    lib = coll("_library")
    c = coll(name, lib)
    return c


def exclude_library():
    vl = bpy.context.view_layer
    for lc in vl.layer_collection.children:
        if lc.name == "_library":
            lc.exclude = True


def instance(collection, name, matrix, parent_coll):
    e = bpy.data.objects.new(name, None)
    e.instance_type = "COLLECTION"
    e.instance_collection = collection
    e.matrix_world = matrix
    parent_coll.objects.link(e)
    return e


# ------------------------------------------------------------------ materials

_mats = {}


def tex_path(name, *kinds):
    base = os.path.join(ASSETS, "textures", name, "textures")
    for k in kinds:
        for ext in ("jpg", "png", "exr"):
            hits = glob.glob(os.path.join(base, f"{name}_{k}_*.{ext}"))
            if hits:
                return hits[0]
    return None


def _img(path, data=False):
    img = bpy.data.images.load(path, check_existing=True)
    if data:
        img.colorspace_settings.name = "Non-Color"
    return img


def new_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (600, 0)
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (300, 0)
    nt.links.new(bsdf.outputs[0], out.inputs[0])
    return m, nt, bsdf


def _bevel_normal(nt, bsdf, radius_in=0.06, bump=None):
    """Rounded-off edges at render time: no real edge is a knife edge, and the thin
    highlight along one is most of what makes joinery read as real."""
    bev = nt.nodes.new("ShaderNodeBevel")
    bev.inputs["Radius"].default_value = radius_in * IN
    bev.samples = 6
    bev.location = (0, -400)
    if bump is not None:
        nt.links.new(bev.outputs[0], bump.inputs["Normal"])
        nt.links.new(bump.outputs[0], bsdf.inputs["Normal"])
    else:
        nt.links.new(bev.outputs[0], bsdf.inputs["Normal"])
    return bev


def _noise_bump(nt, scale, strength, distance=0.0004):
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = scale
    nz.inputs["Detail"].default_value = 8
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = strength
    bump.inputs["Distance"].default_value = distance
    nt.links.new(nz.outputs["Fac"], bump.inputs["Height"])
    return bump


def paint_mat(name, color, rough=0.4, bevel=0.06, orange_peel=0.08, sheen=0.5):
    if name in _mats:
        return _mats[name]
    m, nt, bsdf = new_mat(name)
    bsdf.inputs["Base Color"].default_value = hexrgb(color) if isinstance(color, int) else color
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Specular IOR Level"].default_value = sheen
    bump = _noise_bump(nt, 900, orange_peel) if orange_peel else None
    if bevel:
        _bevel_normal(nt, bsdf, bevel, bump)
    elif bump:
        nt.links.new(bump.outputs[0], bsdf.inputs["Normal"])
    _mats[name] = m
    return m


def image_mat(name, tex, tile_in, tint=None, hue=0.5, sat=1.0, val=1.0, contrast=0.0, rough_mul=1.0,
              rough_add=0.0, coat=0.0, bump=1.0, bevel=0.0, rotate=0.0, use_uv=True, rough_override=None):
    """A Poly Haven texture, tiled every `tile_in` inches over the mesh's UVs (which the
    builders lay out in metres in world space)."""
    if name in _mats:
        return _mats[name]
    m, nt, bsdf = new_mat(name)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    s = 1.0 / (tile_in * IN)
    mp.inputs["Scale"].default_value = (s, s, s)
    mp.inputs["Rotation"].default_value = (0, 0, rotate)
    nt.links.new(tc.outputs["UV" if use_uv else "Object"], mp.inputs["Vector"])

    def image(kinds, data):
        p = tex_path(tex, *kinds)
        if not p:
            return None
        n = nt.nodes.new("ShaderNodeTexImage")
        n.image = _img(p, data)
        nt.links.new(mp.outputs[0], n.inputs["Vector"])
        return n

    col = image(("diff", "col", "diffuse"), False)
    c = col.outputs["Color"]
    if hue != 0.5 or sat != 1.0 or val != 1.0:
        hsv = nt.nodes.new("ShaderNodeHueSaturation")
        hsv.inputs["Hue"].default_value = hue
        hsv.inputs["Saturation"].default_value = sat
        hsv.inputs["Value"].default_value = val
        nt.links.new(c, hsv.inputs["Color"])
        c = hsv.outputs["Color"]
    if contrast:
        bc = nt.nodes.new("ShaderNodeBrightContrast")
        bc.inputs["Contrast"].default_value = contrast
        nt.links.new(c, bc.inputs["Color"])
        c = bc.outputs["Color"]
    if tint is not None:
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1.0
        nt.links.new(c, mix.inputs[6])
        mix.inputs[7].default_value = hexrgb(tint)
        c = mix.outputs[2]
    nt.links.new(c, bsdf.inputs["Base Color"])

    if rough_override is not None:
        bsdf.inputs["Roughness"].default_value = rough_override
    else:
        r = image(("rough", "roughness"), True)
        if r:
            mm = nt.nodes.new("ShaderNodeMath")
            mm.operation = "MULTIPLY_ADD"
            mm.inputs[1].default_value = rough_mul
            mm.inputs[2].default_value = rough_add
            mm.use_clamp = True
            nt.links.new(r.outputs["Color"], mm.inputs[0])
            nt.links.new(mm.outputs[0], bsdf.inputs["Roughness"])
    nrm = image(("nor_gl",), True)
    normal_out = None
    if nrm and bump:
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nm.inputs["Strength"].default_value = bump
        nt.links.new(nrm.outputs["Color"], nm.inputs["Color"])
        normal_out = nm.outputs["Normal"]
    if bevel:
        bev = nt.nodes.new("ShaderNodeBevel")
        bev.inputs["Radius"].default_value = bevel * IN
        bev.samples = 6
        if normal_out is not None:
            nt.links.new(normal_out, bev.inputs["Normal"])
        normal_out = bev.outputs[0]
    if normal_out is not None:
        nt.links.new(normal_out, bsdf.inputs["Normal"])
    if coat:
        bsdf.inputs["Coat Weight"].default_value = coat
        bsdf.inputs["Coat Roughness"].default_value = 0.18
    _mats[name] = m
    return m


def metal_mat(name, color, rough, metallic=1.0, brushed=False):
    if name in _mats:
        return _mats[name]
    m, nt, bsdf = new_mat(name)
    bsdf.inputs["Base Color"].default_value = hexrgb(color)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = rough
    if brushed:
        bsdf.inputs["Anisotropic"].default_value = 0.6
    _bevel_normal(nt, bsdf, 0.02)
    _mats[name] = m
    return m


def glass_mat(name="glass", tint=0xf4f8f6):
    """Window glass the way archviz does it: clear to shadows, so daylight comes in
    without having to find its way through a refracting slab, and still reflective."""
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    gl = nt.nodes.new("ShaderNodeBsdfGlossy")
    gl.inputs["Roughness"].default_value = 0.0
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    tr.inputs["Color"].default_value = hexrgb(tint)
    fr = nt.nodes.new("ShaderNodeFresnel")
    fr.inputs["IOR"].default_value = 1.52
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(fr.outputs[0], mix.inputs[0])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(gl.outputs[0], mix.inputs[2])
    lp = nt.nodes.new("ShaderNodeLightPath")
    mix2 = nt.nodes.new("ShaderNodeMixShader")
    tr2 = nt.nodes.new("ShaderNodeBsdfTransparent")
    nt.links.new(lp.outputs["Is Shadow Ray"], mix2.inputs[0])
    nt.links.new(mix.outputs[0], mix2.inputs[1])
    nt.links.new(tr2.outputs[0], mix2.inputs[2])
    nt.links.new(mix2.outputs[0], out.inputs[0])
    _mats[name] = m
    return m


def solid_glass_mat(name="glass_solid", attenuation=0xd9e4ea):
    if name in _mats:
        return _mats[name]
    m, nt, bsdf = new_mat(name)
    bsdf.inputs["Transmission Weight"].default_value = 1.0
    bsdf.inputs["Roughness"].default_value = 0.0
    bsdf.inputs["IOR"].default_value = 1.52
    bsdf.inputs["Base Color"].default_value = hexrgb(attenuation)
    _mats[name] = m
    return m


def emit_mat(name, color, strength):
    if name in _mats:
        return _mats[name]
    m, nt, bsdf = new_mat(name)
    bsdf.inputs["Emission Color"].default_value = hexrgb(color)
    bsdf.inputs["Emission Strength"].default_value = strength
    bsdf.inputs["Base Color"].default_value = hexrgb(0xffffff)
    _mats[name] = m
    return m


# ------------------------------------------------------------------ mesh building

# Plank textures have seams; a board laid with one must sit inside a single plank.
# material name -> (texture tile in metres, [(from, to) fractions of the tile that are clear])
PLANKS = {}

_boxes = {}


def _rounded_box(w, h, d, e):
    """A box w x d x h inches (x, y, z) about the origin, its edges eased by e: built once
    per size, then copied in wherever it's used."""
    key = (w, h, d, e)
    if key not in _boxes:
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=(w * IN, d * IN, h * IN), verts=bm.verts)
        if e > 0.01:
            bmesh.ops.bevel(bm, geom=list(bm.verts) + list(bm.edges), offset=e * IN, segments=2,
                            profile=0.5, affect="EDGES", clamp_overlap=True)
        bm.verts.index_update()
        _boxes[key] = ([tuple(x.co) for x in bm.verts], [[x.index for x in f.verts] for f in bm.faces])
        bm.free()
    return _boxes[key]


class Builder:
    """Accumulates geometry for one object, with one slot per material."""

    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new("UVMap")
        self.mats = []

    def slot(self, mat):
        if mat not in self.mats:
            self.mats.append(mat)
        return self.mats.index(mat)

    # every face gets world-space UVs in metres, projected along its dominant axis, with
    # the long way of the wood (`grain`: 0 x, 1 y, 2 z) running along U
    def uv_faces(self, faces, grain=None, offset=(0.0, 0.0)):
        for f in faces:
            n = f.normal
            a = [abs(n.x), abs(n.y), abs(n.z)]
            dom = a.index(max(a))
            rest = [i for i in (0, 1, 2) if i != dom]
            ua = grain if grain in rest else rest[0]
            va = [i for i in rest if i != ua][0]
            for lp in f.loops:
                c = lp.vert.co
                lp[self.uv].uv = (c[ua] + offset[0], c[va] + offset[1])

    def box(self, w, h, d, pos, mat, ease=0.08, grain=None, rot=None, seed=None):
        """A board w (x) by d (y) by h (z) inches, centred on pos, with eased edges."""
        e = min(ease, w / 2.2, h / 2.2, d / 2.2)
        cos, polys = _rounded_box(round(w, 4), round(h, 4), round(d, 4), round(e, 4))
        verts = [self.bm.verts.new(c) for c in cos]
        faces = [self.bm.faces.new([verts[i] for i in p]) for p in polys]
        if rot is not None:
            bmesh.ops.transform(self.bm, matrix=rot, verts=verts)
        bmesh.ops.translate(self.bm, vec=v(*pos), verts=verts)
        si = self.slot(mat)
        for f in faces:
            f.material_index = si
            f.smooth = True
        bmesh.ops.recalc_face_normals(self.bm, faces=faces)
        rnd = random.Random(seed if seed is not None else hash(pos))
        off = (rnd.random() * 3, rnd.random() * 3)
        if grain is not None and mat.name in PLANKS:
            tile, bands = PLANKS[mat.name]
            dims = {0: w, 1: d, 2: h}
            thin = min(dims, key=dims.get)
            cross = [a for a in (0, 1, 2) if a not in (thin, grain)]
            if cross:
                c = cross[0]
                size = dims[c] * IN
                fits = [(a, b) for a, b in bands if (b - a) * tile >= size * 1.05]
                if fits:
                    a, b = rnd.choice(fits)
                    start = (a + rnd.random() * ((b - a) - size / tile)) * tile + rnd.randint(0, 6) * tile
                    off = (off[0], start - (pos[c] * IN - size / 2))
        self.uv_faces(faces, grain, off)
        return faces

    def prism(self, pts, depth, pos, mat):
        """A flat shape in the x-z plane (inches, about pos), `depth` thick along y."""
        x0, y0, z0 = pos
        front = [self.bm.verts.new(((x0 + x) * IN, (y0 - depth / 2) * IN, (z0 + z) * IN)) for x, z in pts]
        back = [self.bm.verts.new(((x0 + x) * IN, (y0 + depth / 2) * IN, (z0 + z) * IN)) for x, z in pts]
        faces = [self.bm.faces.new(front), self.bm.faces.new(list(reversed(back)))]
        k = len(pts)
        for i in range(k):
            j = (i + 1) % k
            faces.append(self.bm.faces.new((front[i], back[i], back[j], front[j])))
        si = self.slot(mat)
        for f in faces:
            f.material_index = si
        bmesh.ops.recalc_face_normals(self.bm, faces=faces)
        self.uv_faces(faces, 2)
        return faces

    def flat_box(self, x0, y0, z0, x1, y1, z1, mat, grain=None):
        return self.box(x1 - x0, z1 - z0, y1 - y0, ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), mat, ease=0, grain=grain)

    def lathe(self, pts, center, mat, segs=48, axis=None):
        """Turn [radius, height] points (bottom to top, inches) about Z at `center`."""
        rings = []
        for r, h in pts:
            ring = []
            for i in range(segs):
                a = 2 * math.pi * i / segs
                ring.append(self.bm.verts.new((max(r, 0.001) * IN * math.cos(a), max(r, 0.001) * IN * math.sin(a), h * IN)))
            rings.append(ring)
        faces = []
        for j in range(len(rings) - 1):
            for i in range(segs):
                a, b = rings[j][i], rings[j][(i + 1) % segs]
                c, d = rings[j + 1][(i + 1) % segs], rings[j + 1][i]
                faces.append(self.bm.faces.new((a, b, c, d)))
        if pts[0][0] > 0.01:
            faces.append(self.bm.faces.new(list(reversed(rings[0]))))
        if pts[-1][0] > 0.01:
            faces.append(self.bm.faces.new(rings[-1]))
        verts = [x for r in rings for x in r]
        if axis is not None:
            bmesh.ops.transform(self.bm, matrix=axis, verts=verts)
        bmesh.ops.translate(self.bm, vec=v(*center), verts=verts)
        si = self.slot(mat)
        for f in faces:
            f.material_index = si
            f.smooth = True
        bmesh.ops.recalc_face_normals(self.bm, faces=faces)
        self.uv_faces(faces, 2)
        return faces

    def sweep(self, profile, path, mat, z0=0.0, down=False, closed=False):
        """Run a closed (u, t) profile along a wall line. `path` is plan points with the
        room on the left; u goes up from z0 (or down, for crown), t out from the wall.
        Corners are true mitres: each profile point moves along the bisector."""
        prof = []
        for p in profile:
            if not prof or (abs(p[0] - prof[-1][0]) + abs(p[1] - prof[-1][1])) > 1e-4:
                prof.append(p)
        if len(prof) > 3 and abs(prof[0][0] - prof[-1][0]) + abs(prof[0][1] - prof[-1][1]) < 1e-4:
            prof.pop()
        pts = [Vector((p[0], p[1])) for p in path]
        n = len(pts)
        segs = n if closed else n - 1
        normals = []
        for i in range(segs):
            d = (pts[(i + 1) % n] - pts[i]).normalized()
            normals.append(Vector((-d.y, d.x)))
        rings = []
        for i in range(n):
            if closed:
                na, nb = normals[i - 1], normals[i % segs]
            else:
                na = normals[max(0, i - 1)]
                nb = normals[min(segs - 1, i)]
            m = (na + nb) / (1 + na.dot(nb))
            ring = []
            for u, t in prof:
                z = z0 - u if down else z0 + u
                q = pts[i] + m * t
                ring.append(self.bm.verts.new((q.x * IN, q.y * IN, z * IN)))
            rings.append(ring)
        faces = []
        k = len(prof)
        for i in range(segs):
            r0, r1 = rings[i], rings[(i + 1) % n]
            for j in range(k):
                faces.append(self.bm.faces.new((r0[j], r0[(j + 1) % k], r1[(j + 1) % k], r1[j])))
        if not closed:
            faces.append(self.bm.faces.new(list(reversed(rings[0]))))
            faces.append(self.bm.faces.new(rings[-1]))
        si = self.slot(mat)
        for f in faces:
            f.material_index = si
            f.smooth = True
        bmesh.ops.recalc_face_normals(self.bm, faces=faces)
        self.uv_faces(faces)
        return faces

    def finish(self, collection, smooth_angle=38.0):
        me = bpy.data.meshes.new(self.name)
        self.bm.normal_update()
        self.bm.to_mesh(me)
        self.bm.free()
        for m in self.mats:
            me.materials.append(m)
        if smooth_angle is not None:
            me.set_sharp_from_angle(angle=math.radians(smooth_angle))
        ob = bpy.data.objects.new(self.name, me)
        collection.objects.link(ob)
        return ob


# ------------------------------------------------------------------ quiz exports

def load_export(q, o):
    with open(os.path.join(EXPORT, q, f"{o}.json"), encoding="utf-8") as f:
        return json.load(f)


def station_frame(origin, u, n):
    """Three's (x right, y up, z out of the wall) to plan inches: origin + x u + y Z + z n."""
    u = Vector((u[0], u[1], 0)).normalized()
    nn = Vector((n[0], n[1], 0)).normalized()
    up = Vector((0, 0, 1))

    def f(x, y, z):
        p = Vector(origin) + u * x + up * y + nn * z
        return (p.x * IN, p.y * IN, p.z * IN)
    return f


def import_meshes(data, frame, mat_for, name, collection, keep=None, smooth_angle=38.0):
    """Rebuild an exported three.js scene's meshes in Blender, one object per material.
    `mat_for(kind)` returns a material or None to skip; `keep(mesh, bbox)` filters."""
    builders = {}
    for mi, m in enumerate(data["meshes"]):
        mat = mat_for(m["mat"])
        if mat is None:
            continue
        pos = m["pos"]
        xs, ys, zs = pos[0::3], pos[1::3], pos[2::3]
        bbox = (min(xs), max(xs), min(ys), max(ys), min(zs), max(zs))
        if keep and not keep(m, bbox):
            continue
        b = builders.get(mat.name)
        if b is None:
            b = builders[mat.name] = Builder(f"{name}.{mat.name}")
        bm = b.bm
        vs = [bm.verts.new(frame(pos[i], pos[i + 1], pos[i + 2])) for i in range(0, len(pos), 3)]
        idx = m["idx"] or list(range(len(vs)))
        si = b.slot(mat)
        faces = []
        for i in range(0, len(idx), 3):
            tri = (vs[idx[i]], vs[idx[i + 1]], vs[idx[i + 2]])
            if len({tri[0], tri[1], tri[2]}) < 3:
                continue
            try:
                f = bm.faces.new(tri)
            except ValueError:
                continue
            f.material_index = si
            f.smooth = True
            faces.append(f)
        bm.normal_update()
        ext = (bbox[1] - bbox[0], bbox[3] - bbox[2], bbox[5] - bbox[4])
        grain3 = ext.index(max(ext))          # three axis the piece is longest along
        # map three's axis to plan's: x -> along u, y -> Z, z -> along n
        gx = frame(1, 0, 0); g0 = frame(0, 0, 0); gz = frame(0, 0, 1)
        axis_vec = {0: Vector(gx) - Vector(g0), 1: Vector((0, 0, 1)), 2: Vector(gz) - Vector(g0)}[grain3]
        a = [abs(axis_vec.x), abs(axis_vec.y), abs(axis_vec.z)]
        b.uv_faces(faces, a.index(max(a)), (random.random() * 3, random.random() * 3))
    obs = []
    for b in builders.values():
        obs.append(b.finish(collection, smooth_angle))
    return obs


# ------------------------------------------------------------------ assets

def append_collection(blend_name, coll_name=None, kind="models"):
    """Append a Poly Haven model's collection (once) and return it, kept out of the scene."""
    coll_name = coll_name or blend_name
    have = bpy.data.collections.get("ph:" + coll_name)
    if have:
        return have
    p = glob.glob(os.path.join(ASSETS, kind, blend_name, "*.blend"))[0]
    with bpy.data.libraries.load(p, link=False) as (src, dst):
        dst.collections = [coll_name]
    c = dst.collections[0]
    c.name = "ph:" + coll_name
    hidden = coll("_library")
    hidden.children.link(c)
    return c


def place(collection, name, at, rot_z=0.0, scale=1.0, parent=None):
    m = Matrix.Translation(v(*at)) @ Matrix.Rotation(math.radians(rot_z), 4, "Z") @ Matrix.Scale(scale, 4)
    return instance(collection, name, m, parent or bpy.context.scene.collection)
