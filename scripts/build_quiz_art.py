"""Draw the trim options for the design quiz.

    python scripts/build_quiz_art.py

Every option is the same window in the same wall with the same light. Only the
casing changes, so the client is choosing a detail rather than choosing a room -
which is what four photographs of four different houses would actually ask them
to do.

Drawn rather than photographed for the same reason, and because the difference
between a 22 and a 45 degree cut is about three inches of a photo.

Scale: the window reads as roughly 30in wide, so 1in is about 6 units in the
400x500 viewBox. Casing is 3.5in stock; the flat head boards are 5.5in.
"""
import os

OUT = "images/quiz/01-window-door-trim"

W, H = 400, 500

# The opening, and the trim around it. Shared by every option.
GLASS = (110, 120, 290, 400)          # left, top, right, bottom
LEG_OUT, LEG_IN = 88, 110             # left leg casing edges (right is mirrored)
LEG_OUT_R, LEG_IN_R = 312, 290
HEAD_BOTTOM = 120
FLAT_HEAD_TOP = 87                    # 5.5in board
CASING_HEAD_TOP = 98                  # 3.5in milled casing
STOOL = (78, 400, 322, 414)
APRON = (92, 414, 308, 442)

WALL = "#e9e2de"
TRIM = "#fdfbfa"
# Dark enough that the casing still reads as a shape on a phone-sized tile
TRIM_EDGE = "#bfb3ab"
SASH = "#f7f3f1"
SHADOW = "rgba(60,46,40,0.13)"

STYLE = """
  .trim { fill: %(trim)s; stroke: %(edge)s; stroke-width: 1; stroke-linejoin: round; }
  .sash { fill: %(sash)s; stroke: %(edge)s; stroke-width: 1; }
  .score { stroke: %(edge)s; stroke-width: 0.9; fill: none; opacity: 0.75; }
  .cast { fill: %(shadow)s; }
""" % {"trim": TRIM, "edge": TRIM_EDGE, "sash": SASH, "shadow": SHADOW}


def scene_open():
    """Wall, glass, sash - everything behind the casing."""
    gl, gt, gr, gb = GLASS
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img">
  <defs>
    <linearGradient id="day" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0" stop-color="#cfdce4"/><stop offset="0.55" stop-color="#e4edf1"/>
      <stop offset="1" stop-color="#eef2f2"/>
    </linearGradient>
    <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ece5e1"/><stop offset="1" stop-color="#e3dcd7"/>
    </linearGradient>
    <style>{STYLE}</style>
  </defs>
  <rect width="{W}" height="{H}" fill="url(#wall)"/>
  <rect x="{gl}" y="{gt}" width="{gr - gl}" height="{gb - gt}" fill="url(#day)"/>
  <!-- the opening sits slightly proud, so it drops a soft shadow onto the glass -->
  <rect x="{gl}" y="{gt}" width="{gr - gl}" height="10" class="cast"/>
  <g class="sash">
    <rect x="{gl}" y="{gt}" width="{gr - gl}" height="{gb - gt}" fill="none"/>
    <rect x="{gl + 7}" y="{gt + 7}" width="{gr - gl - 14}" height="9"/>
    <rect x="{gl + 7}" y="{gt + 7}" width="9" height="{gb - gt - 14}"/>
    <rect x="{gr - gl + gl - 16}" y="{gt + 7}" width="9" height="{gb - gt - 14}"/>
    <rect x="{gl + 7}" y="{(gt + gb) / 2 - 6:.0f}" width="{gr - gl - 14}" height="12"/>
    <rect x="{gl + 7}" y="{gb - 16}" width="{gr - gl - 14}" height="9"/>
  </g>
"""


def legs(top):
    """The two vertical casings, from under the head down to the stool."""
    bottom = STOOL[1]
    return (f'  <rect class="trim" x="{LEG_OUT}" y="{top}" '
            f'width="{LEG_IN - LEG_OUT}" height="{bottom - top}"/>\n'
            f'  <rect class="trim" x="{LEG_IN_R}" y="{top}" '
            f'width="{LEG_OUT_R - LEG_IN_R}" height="{bottom - top}"/>\n')


def stool_and_apron():
    sl, st, sr, sb = STOOL
    al, at, ar, ab = APRON
    return (f'  <rect class="cast" x="{sl}" y="{sb}" width="{sr - sl}" height="7"/>\n'
            f'  <rect class="trim" x="{al}" y="{at}" width="{ar - al}" height="{ab - at}"/>\n'
            f'  <rect class="trim" x="{sl}" y="{st}" width="{sr - sl}" height="{sb - st}"/>\n'
            f'  <path class="score" d="M{sl + 3} {sb - 3}H{sr - 3}"/>\n')


def head_shadow(path_d):
    """A soft shadow dropped just under whatever the head board is."""
    return f'  <g transform="translate(0 5)"><path class="cast" d="{path_d}"/></g>\n'


# ------------------------------------------------------------------ options

def square_cut():
    """Flat head board, square ends, sitting on the legs with a small ear each side."""
    l, r = 82, 318                    # a small ear past each leg, as a butt joint gets
    t, b = FLAT_HEAD_TOP, HEAD_BOTTOM
    d = f"M{l} {t}H{r}V{b}H{l}Z"
    svg = scene_open() + head_shadow(d) + legs(b)
    svg += f'  <path class="trim" d="{d}"/>\n'
    svg += stool_and_apron()
    return svg + "</svg>\n"


def angled(degrees):
    """Flat head board whose ends are cut back, so the top is wider than the bottom.
    The bottom edge still has to cover both legs, so the board grows with the angle."""
    import math
    t, b = FLAT_HEAD_TOP, HEAD_BOTTOM
    run = (b - t) * math.tan(math.radians(degrees))
    bl, br = 84, 316                      # bottom edge, same as the square cut
    tl, tr = bl - run, br + run           # top edge flares out
    d = f"M{tl:.1f} {t}H{tr:.1f}L{br} {b}H{bl}Z"
    svg = scene_open() + head_shadow(d) + legs(b)
    svg += f'  <path class="trim" d="{d}"/>\n'
    svg += stool_and_apron()
    return svg + "</svg>\n"


def standard_casing():
    """Milled colonial casing, same width all round, mitred at the top corners.

    The profile is what makes it read as off-the-shelf casing rather than flat
    stock, and the profile has to run around the mitre: each line stops where the
    joint is, the way the milling actually does."""
    t, b = CASING_HEAD_TOP, HEAD_BOTTOM
    l, r = LEG_OUT, LEG_OUT_R
    li, ri = LEG_IN, LEG_IN_R
    bottom = STOOL[1]

    head = f"M{l} {t}H{r}V{b}H{li}L{l} {t}Z"
    left = f"M{l} {t}L{li} {b}V{bottom}H{l}Z"
    right = f"M{r} {t}L{ri} {b}V{bottom}H{r}Z"

    svg = scene_open() + head_shadow(f"M{l} {t}H{r}V{b}H{l}Z")
    for d in (left, right, head):
        svg += f'  <path class="trim" d="{d}"/>\n'
    # Two steps and a bead. Each line is inset the same distance from its piece's
    # outer edge, so they meet cleanly on the mitre instead of crossing it.
    for off in (6, 13, 17):
        svg += (f'  <path class="score" d="M{l + off} {t + off}H{r - off}"/>\n'
                f'  <path class="score" d="M{l + off} {t + off}V{bottom}"/>\n'
                f'  <path class="score" d="M{r - off} {t + off}V{bottom}"/>\n')
    svg += stool_and_apron()
    return svg + "</svg>\n"


OPTIONS = [
    ("square-cut.svg", square_cut()),
    ("22-degree-angle.svg", angled(22)),
    ("45-degree-angle.svg", angled(45)),
    ("standard-casing.svg", standard_casing()),
]


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, svg in OPTIONS:
        path = os.path.join(OUT, name)
        with open(path, "w", encoding="utf-8") as f:
            f.write(svg)
        print("drew %s  %d bytes" % (path, len(svg)))


if __name__ == "__main__":
    main()
