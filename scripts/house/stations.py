"""Where the camera stands for each question, and the walk between them.

Positions are plan inches (X east, Y north, Z up from the inside floor; the yard is at
-24). `ev` is the exposure: indoors needs more than out in the sun. ROUTE is the order a
visitor walks the house - street, porch, in through the front door, round the living
room, down the hall, out the back onto the deck and into the yard - so the quiz can
always move between neighbours.
"""
import json
import math
import os

_here = os.path.dirname(os.path.abspath(__file__))
_root = os.path.dirname(os.path.dirname(_here))
with open(os.path.join(_root, "data", "quiz.json"), encoding="utf-8") as f:
    _quiz = {q["id"]: [o["id"] for o in q["options"]] for q in json.load(f)["questions"]}

BUILT = {
    "trim": ["square", "22", "45", "cap", "colonial", "victorian", "frame"],
    "doors": ["slab", "shaker2", "shaker3", "shaker5", "raised6", "french"],
    "base": ["modern", "colonial", "craftsman", "tall", "builtup"],
    "crown": ["none", "cove", "colonial", "large", "builtup"],
    "panel": ["none", "beadboard", "batten", "frame", "raised", "shiplap"],
    "builtin": ["open", "cabinet", "glass", "floating", "library"],
    "mantel": ["beam", "craftsman", "colonial", "overmantel"],
    "railing": ["metal", "picket", "cable", "slat", "glass"],
    "decking": ["cedar", "treated", "grey", "brown", "ipe"],
    "ceiling": ["stained", "white", "cedar", "haint", "beadboard", "pine"],
    "columns": ["box", "tapered", "tuscan", "turned", "timber"],
    "fence": ["privacy", "shadowbox", "horizontal", "picket", "capped"],
    "finish": ["black", "satinbrass", "brass", "nickel", "chrome", "bronze"],
    "handles": ["knob", "lever", "curved", "glass", "square"],
}

IN_EV, OUT_EV = 1.4, 0.0
# The sky's rotation: the sun comes in low from the west-south-west, across the front of
# the house and in at the living room windows. Out back it's swung round to the
# west-north-west, so the deck and yard aren't standing in the house's shadow.
FRONT_SUN, BACK_SUN = 124.0, 174.0

STATIONS = {
    "columns": dict(pos=(352, -330, 40), target=(300, -92, 58), fov=44, ev=OUT_EV),
    "ceiling": dict(pos=(150, -28, 54), target=(178, -74, 108), fov=62, ev=OUT_EV + 2.0, frames=84),
    "panel": dict(pos=(356, 70, 54), target=(480, 150, 34), fov=52, ev=IN_EV, frames=124),
    "trim": dict(frames=84, pos=(206, 98, 54), target=(190, 0, 62), fov=46, ev=IN_EV),
    "crown": dict(pos=(38, 46, 84), target=(1, 1, 104), fov=46, ev=IN_EV + 0.3),
    "mantel": dict(pos=(212, 126, 52), target=(0, 120, 48), fov=44, ev=IN_EV),
    "builtin": dict(pos=(138, 58, 56), target=(132, 240, 54), fov=52, ev=IN_EV),
    "base": dict(pos=(226, 108, 20), target=(259.5, 72, 4), fov=40, ev=IN_EV + 0.2),
    "doors": dict(frames=84, pos=(330, 222, 50), target=(264, 300, 42), fov=56, ev=IN_EV + 0.2),
    "handles": dict(frames=44, pos=(278.5, 318.4, 39.2), target=(263.8, 312.4, 36), fov=36, ev=IN_EV + 0.2),
    "finish": dict(frames=36, pos=(279.5, 321, 41), target=(263.8, 312.2, 36), fov=31, ev=IN_EV + 0.2),
    "decking": dict(frames=96, pos=(300, 392, 54), target=(300, 470, -8), fov=50, ev=OUT_EV + 0.3, sun=BACK_SUN),
    "railing": dict(pos=(328, 418, 50), target=(372, 510, 20), fov=46, ev=OUT_EV + 0.3, sun=BACK_SUN),
    "fence": dict(frames=84, pos=(590, 560, 38), target=(816, 700, 14), fov=46, ev=OUT_EV + 0.4, sun=BACK_SUN),
}
OUTSIDE = {"columns", "ceiling", "decking", "railing", "fence"}
for k, s in STATIONS.items():
    s["options"] = BUILT[k]
    s["outside"] = k in OUTSIDE
    s.setdefault("sun", FRONT_SUN)

ROUTE = ["columns", "ceiling", "panel", "trim", "crown", "mantel", "builtin", "base",
         "doors", "handles", "finish", "decking", "railing", "fence"]

# Extra points a walk passes through, so it goes through doorways, not walls:
# (pos, target) pairs, fov and exposure blended along the way
WAYPOINTS = {
    ("ceiling", "panel"): [dict(pos=(292, -58, 58), target=(300, 60, 54)), dict(pos=(300, 30, 56), target=(360, 110, 50)),
                           dict(pos=(322, 88, 55), target=(450, 130, 40))],
    ("panel", "trim"): [dict(pos=(300, 80, 54), target=(200, 60, 54))],
    ("base", "doors"): [dict(pos=(290, 120, 46), target=(300, 220, 46))],
    ("railing", "fence"): [dict(pos=(300, 488, 46), target=(300, 600, 30)), dict(pos=(300, 530, 34), target=(520, 640, 20))],
    ("finish", "decking"): [dict(pos=(300, 300, 52), target=(300, 420, 40)), dict(pos=(300, 372, 52), target=(300, 450, 10))],
}


def slot_for(station, option):
    if station in ("finish", "handles"):
        return "hardware", f"{station}:{option}"
    return station, option


def _catmull(ps, t):
    """Centripetal-ish Catmull-Rom through points ps at t in [0, 1]."""
    n = len(ps) - 1
    x = min(t * n, n - 1e-9)
    i = int(x)
    u = x - i
    p0 = ps[max(i - 1, 0)]; p1 = ps[i]; p2 = ps[i + 1]; p3 = ps[min(i + 2, n)]
    return tuple(0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u * u
                        + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u * u * u) for k in range(3))


def _ease(t):
    return t * t * (3 - 2 * t) if t < 1 else 1.0


def walk(points, frames):
    """Per-frame (pos, target, fov, ev, sun) from the first station to the last, easing in and out."""
    pos = [p["pos"] for p in points]
    # Steer by heading, not by a moving target point: a target the camera walks past
    # whips the view round in a few frames. Yaw takes the short way round at each key.
    look = []
    for p in points:
        d = [p["target"][k] - p["pos"][k] for k in range(3)]
        yaw = math.atan2(d[1], d[0])
        pitch = math.atan2(d[2], math.hypot(d[0], d[1]))
        if look:
            prev = look[-1][0]
            yaw = prev + (yaw - prev + math.pi) % (2 * math.pi) - math.pi
        look.append((yaw, pitch, 0.0))
    a, b = points[0], points[-1]
    out = []
    for f in range(frames):
        t = _ease(f / (frames - 1))
        fov = a["fov"] + (b["fov"] - a["fov"]) * t
        ev = a["ev"] + (b["ev"] - a["ev"]) * t
        sun = a["sun"] + (b["sun"] - a["sun"]) * t
        p = _catmull(pos, t)
        yaw, pitch, _ = _catmull(look, t)
        r = 100 * math.cos(pitch)
        tgt = (p[0] + r * math.cos(yaw), p[1] + r * math.sin(yaw), p[2] + 100 * math.sin(pitch))
        out.append((p, tgt, fov, ev, sun))
    return out
