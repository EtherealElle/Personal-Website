"""Draw the options for the design quiz.

    python scripts/build_quiz_art.py

Within a question every option is the same room, the same light and the same paint.
Only the one thing being asked about changes, so the client is choosing a detail
rather than choosing a room - which is what four photographs of four different
houses would actually ask them to do.

Drawn rather than photographed for the same reason, and because the difference
between a 22 and a 45 degree cut is about three inches of a photo.

The wall is a mid greige and the trim is near-white, about 3:1 apart. That is the
way a real room works - white trim reads because the wall behind it is darker - and
it is the only way the casing stays legible in a thumbnail on a phone.

Scale: a window about 30in wide, so 1in is roughly 6 units in the 400x500 viewBox.
Casing is 3.5in stock; the flat head boards are 5.5in.
"""
import math
import os

OUT = "images/quiz"
W, H = 400, 500

# ---------------------------------------------------------------- palette
WALL_TOP = "#a3968c"
WALL_BOT = "#92857b"
TRIM = "#fcfaf8"
TRIM_EDGE = "#b3a69c"
PANEL = "#e7dcd3"          # a recessed face catches less light than the stiles
FLOOR = "#9a7c5f"
FLOOR_DARK = "#8a6e54"
SHADOW = "rgba(38,28,22,0.22)"
SOFT = "rgba(38,28,22,0.20)"

STYLE = """
  .trim { fill: %(trim)s; stroke: %(edge)s; stroke-width: 1; stroke-linejoin: round; }
  .panel { fill: %(panel)s; stroke: %(edge)s; stroke-width: 0.9; }
  .sash { fill: %(trim)s; stroke: %(edge)s; stroke-width: 1; }
  .score { stroke: %(edge)s; stroke-width: 0.9; fill: none; opacity: 0.8; }
  .cast { fill: %(shadow)s; }
  .soft { fill: %(soft)s; }
""" % {"trim": TRIM, "edge": TRIM_EDGE, "panel": PANEL,
       "shadow": SHADOW, "soft": SOFT}


def open_svg(extra_defs=""):
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img">
  <defs>
    <linearGradient id="day" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0" stop-color="#b9cedd"/><stop offset="0.55" stop-color="#d7e6ee"/>
      <stop offset="1" stop-color="#e6eff1"/>
    </linearGradient>
    <linearGradient id="wall" x1="0" y1="0" x2="0.15" y2="1">
      <stop offset="0" stop-color="{WALL_TOP}"/><stop offset="1" stop-color="{WALL_BOT}"/>
    </linearGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{FLOOR}"/><stop offset="1" stop-color="{FLOOR_DARK}"/>
    </linearGradient>{extra_defs}
    <style>{STYLE}</style>
  </defs>
  <rect width="{W}" height="{H}" fill="url(#wall)"/>
"""


# ================================================================ window
GLASS = (110, 120, 290, 400)
LEG_OUT, LEG_IN = 88, 110
LEG_IN_R, LEG_OUT_R = 290, 312
HEAD_BOTTOM = 120
FLAT_HEAD_TOP = 87
CASING_HEAD_TOP = 98
STOOL = (78, 400, 322, 414)
APRON = (92, 414, 308, 442)


def window_scene():
    gl, gt, gr, gb = GLASS
    mid = (gt + gb) / 2
    return open_svg() + f"""  <rect x="{gl}" y="{gt}" width="{gr - gl}" height="{gb - gt}" fill="url(#day)"/>
  <rect x="{gl}" y="{gt}" width="{gr - gl}" height="11" class="cast"/>
  <g class="sash">
    <rect x="{gl + 7}" y="{gt + 7}" width="{gr - gl - 14}" height="9"/>
    <rect x="{gl + 7}" y="{gt + 7}" width="9" height="{gb - gt - 14}"/>
    <rect x="{gr - 16}" y="{gt + 7}" width="9" height="{gb - gt - 14}"/>
    <rect x="{gl + 7}" y="{mid - 6:.0f}" width="{gr - gl - 14}" height="12"/>
    <rect x="{gl + 7}" y="{gb - 16}" width="{gr - gl - 14}" height="9"/>
  </g>
"""


def window_legs(top):
    b = STOOL[1]
    return (f'  <rect class="trim" x="{LEG_OUT}" y="{top}" width="{LEG_IN - LEG_OUT}" height="{b - top}"/>\n'
            f'  <rect class="trim" x="{LEG_IN_R}" y="{top}" width="{LEG_OUT_R - LEG_IN_R}" height="{b - top}"/>\n')


def stool_and_apron():
    sl, st, sr, sb = STOOL
    al, at, ar, ab = APRON
    return (f'  <rect class="cast" x="{sl}" y="{sb}" width="{sr - sl}" height="8"/>\n'
            f'  <rect class="trim" x="{al}" y="{at}" width="{ar - al}" height="{ab - at}"/>\n'
            f'  <rect class="trim" x="{sl}" y="{st}" width="{sr - sl}" height="{sb - st}"/>\n'
            f'  <path class="score" d="M{sl + 3} {sb - 3}H{sr - 3}"/>\n')


def drop(path_d, dy=6):
    return f'  <g transform="translate(0 {dy})"><path class="cast" d="{path_d}"/></g>\n'


def square_cut():
    l, r = 82, 318                    # a small ear past each leg, as a butt joint gets
    t, b = FLAT_HEAD_TOP, HEAD_BOTTOM
    d = f"M{l} {t}H{r}V{b}H{l}Z"
    return (window_scene() + drop(d) + window_legs(b) +
            f'  <path class="trim" d="{d}"/>\n' + stool_and_apron() + "</svg>\n")


def angled(degrees):
    """Flat head board whose ends are cut back, so the top is wider than the bottom.
    The bottom edge still has to cover both legs, so the board grows with the angle."""
    t, b = FLAT_HEAD_TOP, HEAD_BOTTOM
    run = (b - t) * math.tan(math.radians(degrees))
    bl, br = 84, 316
    tl, tr = bl - run, br + run
    d = f"M{tl:.1f} {t}H{tr:.1f}L{br} {b}H{bl}Z"
    return (window_scene() + drop(d) + window_legs(b) +
            f'  <path class="trim" d="{d}"/>\n' + stool_and_apron() + "</svg>\n")


def standard_casing():
    """Milled colonial casing, same width all round, mitred at the top corners.
    The profile runs around the mitre: each line stops at the joint, as the milling does."""
    t, b = CASING_HEAD_TOP, HEAD_BOTTOM
    l, r = LEG_OUT, LEG_OUT_R
    li, ri = LEG_IN, LEG_IN_R
    bottom = STOOL[1]
    head = f"M{l} {t}H{r}V{b}H{li}L{l} {t}Z"
    left = f"M{l} {t}L{li} {b}V{bottom}H{l}Z"
    right = f"M{r} {t}L{ri} {b}V{bottom}H{r}Z"

    svg = window_scene() + drop(f"M{l} {t}H{r}V{b}H{l}Z")
    for d in (left, right, head):
        svg += f'  <path class="trim" d="{d}"/>\n'
    for off in (6, 13, 17):
        svg += (f'  <path class="score" d="M{l + off} {t + off}H{r - off}"/>\n'
                f'  <path class="score" d="M{l + off} {t + off}V{bottom}"/>\n'
                f'  <path class="score" d="M{r - off} {t + off}V{bottom}"/>\n')
    return svg + stool_and_apron() + "</svg>\n"


# ================================================================ doors
D_LEG_OUT, D_LEG_IN = 78, 100
D_LEG_IN_R, D_LEG_OUT_R = 300, 322
D_HEAD_TOP, D_HEAD_BOTTOM = 62, 95
DOOR = (100, 95, 300, 468)            # the slab
FLOOR_Y = 468
STILE, TOP_RAIL, BOT_RAIL, MID_RAIL = 22, 26, 42, 16


def door_scene():
    """Wall, floor, slab and casing - everything except the panels."""
    dl, dt, dr, db = DOOR
    head = f"M{D_LEG_OUT - 4} {D_HEAD_TOP}H{D_LEG_OUT_R + 4}V{D_HEAD_BOTTOM}H{D_LEG_OUT - 4}Z"
    svg = open_svg()
    svg += f'  <rect x="0" y="{FLOOR_Y}" width="{W}" height="{H - FLOOR_Y}" fill="url(#floor)"/>\n'
    svg += f'  <rect class="soft" x="0" y="{FLOOR_Y}" width="{W}" height="4"/>\n'
    # slab, sitting back from the wall so it takes a shadow down one side
    svg += f'  <rect class="trim" x="{dl}" y="{dt}" width="{dr - dl}" height="{db - dt}"/>\n'
    svg += f'  <rect class="cast" x="{dl}" y="{dt}" width="{dr - dl}" height="9"/>\n'
    svg += drop(head, 5)
    svg += (f'  <rect class="trim" x="{D_LEG_OUT}" y="{D_HEAD_BOTTOM}" '
            f'width="{D_LEG_IN - D_LEG_OUT}" height="{FLOOR_Y - D_HEAD_BOTTOM}"/>\n'
            f'  <rect class="trim" x="{D_LEG_IN_R}" y="{D_HEAD_BOTTOM}" '
            f'width="{D_LEG_OUT_R - D_LEG_IN_R}" height="{FLOOR_Y - D_HEAD_BOTTOM}"/>\n')
    svg += f'  <path class="trim" d="{head}"/>\n'
    # Knob, on every option so it is not part of the choice. It sits centred on the
    # lock stile - the far edge from the hinges - which is where one actually goes.
    svg += f'  <circle cx="{dr - STILE / 2:.0f}" cy="288" r="7" class="panel"/>\n'
    return svg


def door(panels):
    """A door with `panels` stacked recessed panels. 0 is a flat slab."""
    dl, dt, dr, db = DOOR
    svg = door_scene()
    if panels:
        left, right = dl + STILE, dr - STILE
        top, bottom = dt + TOP_RAIL, db - BOT_RAIL
        each = (bottom - top - MID_RAIL * (panels - 1)) / panels
        y = top
        for _ in range(panels):
            svg += (f'  <rect class="panel" x="{left}" y="{y:.1f}" '
                    f'width="{right - left}" height="{each:.1f}"/>\n')
            # the shadows a recess throws across its own top and left edges
            svg += (f'  <rect class="soft" x="{left}" y="{y:.1f}" '
                    f'width="{right - left}" height="4"/>\n'
                    f'  <rect class="soft" x="{left}" y="{y:.1f}" '
                    f'width="4" height="{each:.1f}"/>\n')
            y += each + MID_RAIL
    return svg + "</svg>\n"


# ================================================================ output
SETS = {
    "01-window-door-trim": [
        ("square-cut.svg", square_cut),
        ("22-degree-angle.svg", lambda: angled(22)),
        ("45-degree-angle.svg", lambda: angled(45)),
        ("standard-casing.svg", standard_casing),
    ],
    "02-interior-doors": [
        ("flat-slab.svg", lambda: door(0)),
        ("two-panel.svg", lambda: door(2)),
        ("three-panel.svg", lambda: door(3)),
        ("five-panel.svg", lambda: door(5)),
    ],
}


def main():
    for folder, options in SETS.items():
        out = os.path.join(OUT, folder)
        os.makedirs(out, exist_ok=True)
        for name, draw in options:
            path = os.path.join(out, name)
            svg = draw()
            with open(path, "w", encoding="utf-8") as f:
                f.write(svg)
            print("drew %-52s %5d bytes" % (path, len(svg)))


if __name__ == "__main__":
    main()
