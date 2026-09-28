"""Turn the folders in images/picks/ into the tournament list at js/picks-data.js.

One subfolder per decision, one photo per option. Folder and file names become the
question and the option labels. Photos are scaled down proportionally (never cropped)
to at most 1400px on the longest side, the same as the gallery optimizer.

Run by .github/workflows/build-picks.yml, or by hand:  python scripts/build_picks.py

This whole feature is temporary; see images/picks/README.md for how to remove it.
"""
import io
import json
import os
import re
from urllib.parse import quote

from PIL import Image, ImageOps

PICKS_DIR = "images/picks"
OUT_JS = "js/picks-data.js"
MAX_SIDE = 1400
MAX_BYTES = 420 * 1024
QUALITY = 78
EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp")
# Camera and messaging-app file names carry no meaning, so those options get an A/B badge
CAMERA_NAME = re.compile(r"^(img|dsc|dscn|pxl|photo|image|signal|screenshot|untitled)[-_ ]?\d", re.I)


def optimize(path):
    """Resize/recompress one photo in place. Returns the path (new one if converted)."""
    ext = os.path.splitext(path)[1].lower()
    im = Image.open(path)
    if max(im.size) <= MAX_SIDE and os.path.getsize(path) <= MAX_BYTES:
        return path
    im = ImageOps.exif_transpose(im)  # bake in phone rotation before metadata is dropped
    im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
    if im.mode not in ("RGB", "L"):
        im = im.convert("RGB")
    out = os.path.splitext(path)[0] + ".jpg" if ext == ".png" else path
    buf = io.BytesIO()
    if ext == ".webp":
        im.save(buf, "WEBP", quality=QUALITY, method=6)
    else:
        im.save(buf, "JPEG", quality=QUALITY, optimize=True, progressive=True)
    data = buf.getvalue()
    # Keep the original unless the new file is meaningfully smaller, so repeat runs
    # don't slowly degrade a photo that is simply detailed.
    if out == path and len(data) > os.path.getsize(path) * 0.9:
        return path
    with open(out, "wb") as f:
        f.write(data)
    if out != path:
        os.remove(path)
    print(f"optimized {path} -> {out} {im.size[0]}x{im.size[1]} {os.path.getsize(out) // 1024}K")
    return out


def title_from(name):
    """'01-railing-style' -> 'Railing style';  'black-metal' -> 'Black metal'."""
    text = re.sub(r"^[\d]+[-_. ]+", "", name)          # drop an ordering prefix
    text = re.sub(r"[-_]+", " ", text).strip()
    text = re.sub(r"\s+", " ", text)
    return text[:1].upper() + text[1:] if text else ""


def main():
    rounds = []
    if not os.path.isdir(PICKS_DIR):
        print(f"No {PICKS_DIR} folder; nothing to build.")
    for folder in sorted(os.listdir(PICKS_DIR) if os.path.isdir(PICKS_DIR) else []):
        path = os.path.join(PICKS_DIR, folder)
        if not os.path.isdir(path) or folder.startswith("."):
            continue

        options = []
        for name in sorted(os.listdir(path)):
            if name.startswith(".") or os.path.splitext(name)[1].lower() not in EXTENSIONS:
                continue
            new = optimize(os.path.join(path, name).replace("\\", "/"))
            stem = os.path.splitext(os.path.basename(new))[0]
            with Image.open(new) as im:
                w, h = im.size
            options.append({
                "src": "/" + quote(new),
                "label": "" if CAMERA_NAME.match(stem) else title_from(stem),
                "w": w,
                "h": h,
            })

        if not options:
            print(f"skipped {folder}: no photos yet")
            continue
        rounds.append({"id": folder, "title": title_from(folder) or folder, "options": options})
        print(f"{folder}: {len(options)} options")

    os.makedirs(os.path.dirname(OUT_JS), exist_ok=True)
    payload = {"rounds": rounds}
    with open(OUT_JS, "w", encoding="utf-8") as f:
        f.write("// Generated from images/picks/ by scripts/build_picks.py. Do not edit.\n")
        f.write("window.PICKS = " + json.dumps(payload, indent=2, ensure_ascii=False) + ";\n")
    matches = sum(max(0, len(r["options"]) - 1) for r in rounds)
    print(f"wrote {OUT_JS}: {len(rounds)} rounds, {matches} matchups")


if __name__ == "__main__":
    main()
