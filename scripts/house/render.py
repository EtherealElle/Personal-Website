"""Render the quiz house: one still per style, and the walks between stations.

    blender -b house.blend --python scripts/house/render.py -- preview [station ...] [--res N] [--samples N] [--out DIR]
    blender -b house.blend --python scripts/house/render.py -- stills  [station[/option] ...] [--out DIR]
    blender -b house.blend --python scripts/house/render.py -- clips   [index ...] [--out DIR]

A station is where the camera stands for a question; its still shows one style with every
other question at the house's default. A clip is the walk from one station to the next
along ROUTE, rendered as numbered frames for encode.py to turn into video.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stations import ROUTE, STATIONS, WAYPOINTS, slot_for  # noqa: E402

IN = 0.0254
scene = bpy.context.scene


def use_gpu():
    """The GPU choice lives in Blender's preferences, not the file: set it every run."""
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for kind in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = kind
        except TypeError:
            continue
        prefs.get_devices()
        devs = [d for d in prefs.devices if d.type == kind]
        if devs:
            for d in prefs.devices:
                d.use = d.type == kind
            scene.cycles.device = "GPU"
            print("rendering on", kind, [d.name for d in devs], flush=True)
            return
    print("no GPU found: rendering on the CPU", flush=True)


use_gpu()
VARIANTS = json.loads(scene["variants"])
DEFAULTS = json.loads(scene["defaults"])

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
mode = argv[0] if argv else "preview"
args, opts = [], {}
i = 1
while i < len(argv):
    if argv[i].startswith("--"):
        opts[argv[i][2:]] = argv[i + 1]
        i += 2
    else:
        args.append(argv[i])
        i += 1
OUT = opts.get("out", os.path.join(os.path.expanduser("~"), "Tools", "house-work", mode))
os.makedirs(OUT, exist_ok=True)


# ------------------------------------------------------------------ variants

def set_slot(slot, opt):
    for o, info in VARIANTS[slot].items():
        if info["kind"] == "coll":
            c = bpy.data.collections[info["name"]]
            c.hide_render = o != opt
            c.hide_viewport = o != opt
    info = VARIANTS[slot][opt]
    if info["kind"] == "inst":
        target = bpy.data.collections[info["name"]]
        for ob in bpy.data.objects:
            if ob.get("slot") == slot:
                ob.instance_collection = target


def house_defaults(**override):
    for slot, opt in DEFAULTS.items():
        set_slot(slot, override.get(slot, opt))


# ------------------------------------------------------------------ camera

cam_data = bpy.data.cameras.new("quiz_cam")
cam = bpy.data.objects.new("quiz_cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
cam_data.sensor_fit = "AUTO"
cam_data.clip_start = 0.05
cam_data.clip_end = 400


def aim(pos, target, fov, shift=-0.08):
    p, t = Vector(pos) * IN, Vector(target) * IN
    cam.location = p
    cam.rotation_euler = (t - p).to_track_quat("-Z", "Y").to_euler()
    cam_data.angle = math.radians(fov)
    cam_data.shift_y = shift


def expose(ev):
    scene.view_settings.exposure = ev


SUN = scene.world.node_tree.nodes["sun_rot"]


def sun(deg):
    SUN.inputs["Rotation"].default_value = (0, 0, math.radians(deg))


GRASS = bpy.data.collections.get("grass")


def grass(on):
    if GRASS:
        GRASS.hide_render = not on


def pose(name):
    s = STATIONS[name]
    grass(s["outside"])
    aim(s["pos"], s["target"], s["fov"], s.get("shift", -0.08))
    expose(s["ev"])
    sun(s["sun"])


def quality(res, samples):
    # Keeping the scene loaded between renders is faster, but GPU memory creeps up until
    # the driver gives out: run.py starts a fresh Blender per question instead
    scene.render.use_persistent_data = mode == "clips"
    scene.render.resolution_x = res
    scene.render.resolution_y = res
    scene.render.resolution_percentage = 100
    scene.cycles.samples = samples


def shoot(path):
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("wrote", path, flush=True)


# ------------------------------------------------------------------ modes

if mode == "preview":
    quality(int(opts.get("res", 512)), int(opts.get("samples", 48)))
    names = args or list(ROUTE)
    for name in names:
        n, o = (name.split("/") + [None])[:2]
        if o:
            slot, key = slot_for(n, o)
            house_defaults(**{slot: key})
        else:
            house_defaults()
        pose(n)
        shoot(os.path.join(OUT, name.replace("/", "_") + ".png"))

elif mode == "stills":
    quality(int(opts.get("res", 2048)), int(opts.get("samples", 384)))
    scene.render.image_settings.file_format = "PNG"
    wanted = args or list(ROUTE)
    for w in wanted:
        n, only = (w.split("/") + [None])[:2]
        for o in STATIONS[n]["options"]:
            if only and o != only:
                continue
            path = os.path.join(OUT, n, f"{o}.png")
            if os.path.exists(path) and not opts.get("force"):
                continue
            slot, key = slot_for(n, o)
            house_defaults(**{slot: key})
            pose(n)
            shoot(path)

elif mode == "clips":
    res = int(opts.get("res", 1280))
    quality(res, int(opts.get("samples", 128)))
    fps = 30
    scene.render.fps = fps
    scene.render.use_motion_blur = True
    scene.render.motion_blur_shutter = 0.5
    house_defaults()
    which = [int(a) for a in args] if args else list(range(len(ROUTE) - 1))
    for k in which:
        a, b = ROUTE[k], ROUTE[k + 1]
        path_pts = [STATIONS[a]] + WAYPOINTS.get((a, b), []) + [STATIONS[b]]
        frames = int(opts.get("frames", 0)) or STATIONS[b].get("frames", 60)
        grass(STATIONS[a]["outside"] or STATIONS[b]["outside"])
        cam.animation_data_clear()
        scene.view_settings.animation_data_clear() if hasattr(scene.view_settings, "animation_data_clear") else None
        from stations import walk
        for f, (pos, target, fov, ev, sn) in enumerate(walk(path_pts, frames)):
            sun(sn)
            SUN.inputs["Rotation"].keyframe_insert("default_value", frame=f + 1)
            aim(pos, target, fov, STATIONS[b].get("shift", -0.08))
            cam.keyframe_insert("location", frame=f + 1)
            cam.keyframe_insert("rotation_euler", frame=f + 1)
            cam_data.keyframe_insert("lens", frame=f + 1)
            scene.view_settings.exposure = ev
            scene.view_settings.keyframe_insert("exposure", frame=f + 1)
        scene.frame_start, scene.frame_end = 1, frames
        d = os.path.join(OUT, f"{k:02d}-{a}-{b}")
        os.makedirs(d, exist_ok=True)
        scene.render.filepath = os.path.join(d, "f")
        scene.render.image_settings.file_format = "PNG"
        scene.render.use_overwrite = False
        bpy.ops.render.render(animation=True)
        print("clip done", d, flush=True)
