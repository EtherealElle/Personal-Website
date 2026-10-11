"""Render the stacked wordmark to PNGs for profile pictures.

    python scripts/render_logo.py

Writes images/logo/profile-1024.png and profile-512.png: CLEO / heart / VALENTINE
stacked and centred on the dark ground, where the pink is at its brightest (11:1
against #151412). Profile pictures get cropped to a circle by Instagram, Google and
Facebook, so the text is kept well inside the inscribed circle rather than the square.

The mark is set in Instrument Serif, the site's display face, so this renders the page
in headless Chrome and photographs it. The 512 is scaled down from the 1024
proportionally - nothing here crops.
"""
import os
import shutil
import subprocess
import sys
import tempfile

from PIL import Image

OUT_DIR = "images/logo"
SIZE = 1024
ALSO = [512]

INK = "#151412"
TEXT = "#efebe4"
HEART = "#f4b8c9"

# Keep the widest line inside the circle a profile picture gets cropped to
FONT_PX = 156
TRACKING = "0.04em"
HEART_PX = 102

HEART_PATH = ("M12 20.6C9.7 18.5 3.8 14.3 3.8 10.1 3.8 7.4 6 5.3 8.6 5.3 10.3 5.3 "
              "11.4 6.4 12 7.6 12.6 6.4 13.7 5.3 15.4 5.3 18 5.3 20.2 7.4 20.2 10.1 "
              "20.2 14.3 14.3 18.5 12 20.6Z")

PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Cleo Valentine Builds</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif&display=swap">
<style>
  html, body { margin: 0; padding: 0; }
  body {
    width: %(size)spx; height: %(size)spx;
    background: %(ink)s;
    display: flex; align-items: center; justify-content: center;
  }
  .mark {
    display: flex; flex-direction: column; align-items: center; gap: 18px;
    font-family: 'Instrument Serif', Georgia, serif; font-weight: 400;
    font-size: %(font)spx; line-height: 1;
    text-transform: uppercase; letter-spacing: %(tracking)s;
    color: %(text)s;
  }
  /* Tracking adds a trailing gap after the last letter; pull it back so the
     lines stay optically centred on each other. */
  .mark > span { margin-right: -%(tracking)s; }
  .mark svg { width: %(heart)spx; height: %(heart)spx; fill: %(heartcolor)s; display: block; }
</style>
</head>
<body>
  <div class="mark">
    <span>Cleo</span>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="%(path)s"/></svg>
    <span>Valentine</span>
  </div>
</body>
</html>
"""


def find_chrome():
    for p in (os.environ.get("CHROME"),
              r"C:\Program Files\Google\Chrome\Application\chrome.exe",
              r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
              shutil.which("google-chrome"), shutil.which("chromium")):
        if p and os.path.exists(p):
            return p
    raise SystemExit("Could not find Chrome. Set CHROME to its path and run again.")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    html = PAGE % {"size": SIZE, "ink": INK, "text": TEXT, "heartcolor": HEART,
                   "font": FONT_PX, "tracking": TRACKING, "heart": HEART_PX,
                   "path": HEART_PATH}

    work = tempfile.mkdtemp(prefix="logo-")
    page = os.path.join(work, "logo.html")
    with open(page, "w", encoding="utf-8") as f:
        f.write(html)

    big = os.path.abspath(os.path.join(OUT_DIR, "profile-%d.png" % SIZE))
    cmd = [find_chrome(), "--headless=new", "--disable-gpu", "--hide-scrollbars",
           "--force-device-scale-factor=1", "--virtual-time-budget=6000",
           "--window-size=%d,%d" % (SIZE, SIZE),
           "--screenshot=" + big, "file:///" + page.replace("\\", "/")]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if not os.path.exists(big):
        sys.stderr.write(res.stderr[-2000:] + "\n")
        raise SystemExit("Chrome did not write the screenshot.")
    print("wrote %s  %s" % (big, Image.open(big).size))

    im = Image.open(big)
    for s in ALSO:
        small = os.path.join(OUT_DIR, "profile-%d.png" % s)
        out = im.copy()
        out.thumbnail((s, s), Image.LANCZOS)  # proportional, never cropped
        out.save(small, "PNG", optimize=True)
        print("wrote %s  %s" % (os.path.abspath(small), out.size))

    shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    main()
