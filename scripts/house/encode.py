"""Turn rendered walk frames into web video, forwards and backwards.

    blender -b --factory-startup --python scripts/house/encode.py -- <clips dir> <out dir>

Each <clips dir>/NN-a-b/ of PNG frames becomes <out dir>/NN-a-b.mp4 and NN-a-b-back.mp4
(H.264, so every browser plays it; the backwards copy because video can't play in
reverse smoothly). Uses Blender's own FFmpeg, so nothing else needs installing.
"""
import glob
import os
import sys

import bpy

src, dst = sys.argv[sys.argv.index("--") + 1:][:2]
os.makedirs(dst, exist_ok=True)
scene = bpy.context.scene


def encode(frames, out):
    se = scene.sequence_editor_create()
    strips = se.strips if hasattr(se, "strips") else se.sequences
    for s in list(strips):
        strips.remove(s)
    first = frames[0]
    st = strips.new_image("walk", first, 1, 1)
    for f in frames[1:]:
        st.elements.append(os.path.basename(f))
    st.directory = os.path.dirname(first) + os.sep
    scene.frame_start, scene.frame_end = 1, len(frames)
    r = scene.render
    r.fps = 30
    try:
        r.image_settings.media_type = "VIDEO"
    except (AttributeError, TypeError):
        pass
    r.image_settings.file_format = "FFMPEG"
    r.ffmpeg.format = "MPEG4"
    r.ffmpeg.codec = "H264"
    r.ffmpeg.constant_rate_factor = "MEDIUM"
    r.ffmpeg.ffmpeg_preset = "GOOD"
    r.ffmpeg.gopsize = 10
    r.ffmpeg.audio_codec = "NONE"
    r.use_sequencer = True
    r.filepath = out
    bpy.ops.render.render(animation=True)
    # Blender appends the frame range to the name; settle on the name we asked for
    made = glob.glob(out + "*.mp4") + glob.glob(out + "*")
    made = [m for m in made if m.endswith(".mp4")]
    if made and made[0] != out:
        os.replace(made[0], out)
    print("encoded", out, flush=True)


for d in sorted(glob.glob(os.path.join(src, "*-*-*"))):
    if not os.path.isdir(d):
        continue
    frames = sorted(glob.glob(os.path.join(d, "f*.png")))
    if not frames:
        continue
    import struct
    with open(frames[0], "rb") as fh:
        fh.read(16)
        w, h = struct.unpack(">II", fh.read(8))
    scene.render.resolution_x, scene.render.resolution_y = w, h
    scene.render.resolution_percentage = 100
    name = os.path.basename(d)
    encode(frames, os.path.join(dst, name + ".mp4"))
    encode(list(reversed(frames)), os.path.join(dst, name + "-back.mp4"))
