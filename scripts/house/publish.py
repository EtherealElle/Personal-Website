"""Put the house renders on the site.

    python scripts/house/publish.py <stills dir> <videos dir>

- Each still becomes images/house/<question>/<style>.webp (the stage, square), and
  images/quiz/<question>/<style>.webp and -sm.webp, the 4:5 pictures the card quiz,
  the builder and the chips use - cropped from the same render, so all three agree.
- Each walk is copied to images/house/walk/.
- data/house.json lists them, each with a content fingerprint, so a changed render
  gets a new address and no browser or Cloudflare keeps showing the old one.
"""
import hashlib
import json
import os
import shutil
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.environ.get("HOUSE_SITE_ROOT") or os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
from stations import ROUTE, STATIONS  # noqa: E402

stills_dir, videos_dir = sys.argv[1:3]
OUT = os.path.join(ROOT, "images", "house")
QUIZ = os.path.join(ROOT, "images", "quiz")


def fp(path):
    with open(path, "rb") as f:
        return hashlib.sha1(f.read()).hexdigest()[:8]


def url(path):
    return "/" + os.path.relpath(path, ROOT).replace(os.sep, "/") + "?v=" + fp(path)


def crop(im, cx, cy, w, h):
    W, H = im.size
    x0 = min(max(0, cx * W - w / 2), W - w)
    y0 = min(max(0, cy * H - h / 2), H - h)
    return im.crop((round(x0), round(y0), round(x0 + w), round(y0 + h)))


manifest = {"route": ROUTE, "stills": {}, "walks": []}
for q in ROUTE:
    manifest["stills"][q] = {}
    for o in STATIONS[q]["options"]:
        src = os.path.join(stills_dir, q, f"{o}.png")
        if not os.path.exists(src):
            print("missing", src)
            continue
        im = Image.open(src).convert("RGB")
        d = os.path.join(OUT, q)
        os.makedirs(d, exist_ok=True)
        big = os.path.join(d, f"{o}.webp")
        im.resize((2048, 2048), Image.LANCZOS).save(big, "WEBP", quality=80, method=6)
        manifest["stills"][q][o] = url(big)
        # The subject sits centred, a little above the middle: 4:5 crops round it
        W = im.size[0]
        card = crop(im, 0.5, 0.45, W * 0.72, W * 0.9)
        os.makedirs(os.path.join(QUIZ, q), exist_ok=True)
        card.resize((1000, 1250), Image.LANCZOS).save(os.path.join(QUIZ, q, f"{o}.webp"), "WEBP", quality=82, method=6)
        thumb = crop(im, 0.5, 0.42, W * 0.5, W * 0.625)
        thumb.resize((500, 625), Image.LANCZOS).save(os.path.join(QUIZ, q, f"{o}-sm.webp"), "WEBP", quality=80, method=6)
        print("still", q, o)

wd = os.path.join(OUT, "walk")
os.makedirs(wd, exist_ok=True)
for k in range(len(ROUTE) - 1):
    a, b = ROUTE[k], ROUTE[k + 1]
    name = f"{k:02d}-{a}-{b}"
    f, r = os.path.join(videos_dir, name + ".mp4"), os.path.join(videos_dir, name + "-back.mp4")
    if not (os.path.exists(f) and os.path.exists(r)):
        print("missing walk", name)
        manifest["walks"].append({"from": a, "to": b, "forward": None, "back": None})
        continue
    for s in (f, r):
        shutil.copyfile(s, os.path.join(wd, os.path.basename(s)))
    manifest["walks"].append({
        "from": a, "to": b,
        "forward": url(os.path.join(wd, name + ".mp4")),
        "back": url(os.path.join(wd, name + "-back.mp4")),
    })
with open(os.path.join(ROOT, "data", "house.json"), "w", encoding="utf-8") as fh:
    json.dump(manifest, fh, indent=1)
print("wrote data/house.json")
