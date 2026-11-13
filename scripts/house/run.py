"""Render everything, one Blender process per question or walk, retrying a crash.

    python scripts/house/run.py <house.blend> <work dir> [stills|clips|encode|all]

A long GPU batch in one process eventually runs out of memory; separate processes,
skipping what's already on disk, make the whole run restartable.
"""
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from stations import ROUTE  # noqa: E402

BLENDER = os.environ.get("BLENDER", r"C:\Program Files (x86)\Steam\steamapps\common\Blender\blender.exe")
blend, work = sys.argv[1], sys.argv[2]
what = sys.argv[3] if len(sys.argv) > 3 else "all"


def blender(*args):
    for attempt in range(3):
        r = subprocess.run([BLENDER, "-b", *args], capture_output=True, text=True)
        bad = r.returncode != 0 or "Traceback" in r.stdout + r.stderr or "illegal memory" in r.stdout
        if not bad:
            return True
        print("  retrying after failure:", (r.stdout + r.stderr)[-400:].replace("\n", " | "), flush=True)
    return False


if what in ("stills", "all"):
    for q in ROUTE:
        print("stills", q, flush=True)
        blender(blend, "--python", os.path.join(HERE, "render.py"), "--", "stills", q, "--samples", "256",
                "--out", os.path.join(work, "final"))
if what in ("clips", "all"):
    for k in range(len(ROUTE) - 1):
        print("clip", k, flush=True)
        blender(blend, "--python", os.path.join(HERE, "render.py"), "--", "clips", str(k), "--res", "864",
                "--samples", "64", "--out", os.path.join(work, "clips"))
if what in ("encode", "all"):
    blender("--factory-startup", "--python", os.path.join(HERE, "encode.py"), "--",
            os.path.join(work, "clips"), os.path.join(work, "videos"))
print("done", flush=True)
