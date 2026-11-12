"""Shrink oversized photos and keep data/gallery.json in sync.

Run by .github/workflows/optimize-photos.yml after photos are added through Pages CMS.
Photos are scaled down proportionally (never cropped) to at most 1600px on the longest
side. PNG photos are converted to JPG. Each gallery entry gets its width and height
recorded, the gallery page's preload hint is pointed at the first photo, and
data/gallery.js (a copy used when previewing the site from disk) is regenerated.
"""
import io
import json
import os
import re
from PIL import Image, ImageOps

PHOTO_DIR = "images/work"
DATA = "data/gallery.json"
QUIZ_DIR = "images/quiz"
QUIZ_DATA = "data/quiz.json"
DATA_JS = "data/gallery.js"
GALLERY_PAGE = "gallery.html"
MAX_SIDE = 1600
MAX_BYTES = 500 * 1024
QUALITY = 74


def optimize(path, force=False):
    """Resize/recompress one photo. Returns the new path if the file was renamed.
    `force` re-encodes even a small photo, which is how its metadata gets dropped."""
    ext = os.path.splitext(path)[1].lower()
    im = Image.open(path)
    too_big = max(im.size) > MAX_SIDE or os.path.getsize(path) > MAX_BYTES
    if not too_big and not force:
        return path
    im = ImageOps.exif_transpose(im)  # bake in phone rotation before metadata is dropped
    im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
    if im.mode not in ("RGB", "L"):
        im = im.convert("RGB")
    out = path
    if ext == ".png":
        out = os.path.splitext(path)[0] + ".jpg"
    buf = io.BytesIO()
    if ext == ".webp":
        im.save(buf, "WEBP", quality=QUALITY, method=6)
    else:
        im.save(buf, "JPEG", quality=QUALITY, optimize=True, progressive=True)
    data = buf.getvalue()
    # A detailed photo can stay above MAX_BYTES even at full quality. Keep the original
    # unless the new one is meaningfully smaller, so repeat runs don't slowly degrade it.
    if out == path and len(data) > os.path.getsize(path) * 0.9 and not force:
        return path
    with open(out, "wb") as f:
        f.write(data)
    if out != path:
        os.remove(path)
    print(f"optimized {path} -> {out} {im.size[0]}x{im.size[1]} {os.path.getsize(out) // 1024}K")
    return out


def has_metadata(path):
    try:
        return len(Image.open(path).getexif()) > 0
    except Exception:
        return False


def optimize_quiz():
    """Photos uploaded for the design quiz through Pages CMS land in images/quiz/photos.
    They're shrunk like gallery photos, and their metadata is stripped every time, not
    only when they're big: a phone photo of a client's room carries where it was taken.
    The renders, one folder per question, are left alone."""
    if not os.path.isdir(QUIZ_DIR):
        return
    renamed = {}
    for root, _, files in os.walk(QUIZ_DIR):
        rel = os.path.relpath(root, QUIZ_DIR).replace("\\", "/")
        if rel not in (".", "photos") and not rel.startswith("photos/"):
            continue
        for name in sorted(files):
            if os.path.splitext(name)[1].lower() not in (".jpg", ".jpeg", ".png", ".webp"):
                continue
            path = os.path.join(root, name).replace("\\", "/")
            new = optimize(path, force=has_metadata(path))
            if new != path:
                renamed["/" + path] = "/" + new
    if renamed and os.path.exists(QUIZ_DATA):
        with open(QUIZ_DATA, encoding="utf-8") as f:
            quiz = json.load(f)
        for q in quiz.get("questions", []):
            for o in q.get("options", []):
                for k in ("image", "thumb"):
                    if o.get(k) in renamed:
                        o[k] = renamed[o[k]]
        with open(QUIZ_DATA, "w", encoding="utf-8") as f:
            json.dump(quiz, f, indent=2, ensure_ascii=False)
            f.write("\n")


def main():
    renamed = {}
    for name in sorted(os.listdir(PHOTO_DIR)):
        if os.path.splitext(name)[1].lower() not in (".jpg", ".jpeg", ".png", ".webp"):
            continue
        path = f"{PHOTO_DIR}/{name}"
        new = optimize(path)
        if new != path:
            renamed["/" + path] = "/" + new

    with open(DATA, encoding="utf-8") as f:
        data = json.load(f)

    def local(p):  # "/images/work/x.jpg" or "x.jpg" -> repo path
        return p.lstrip("/") if "/" in p else f"{PHOTO_DIR}/{p}"

    if data.get("detailPhoto") in renamed:
        data["detailPhoto"] = renamed[data["detailPhoto"]]
    for photo in data.get("photos", []):
        img = photo.get("image") or ""
        if img in renamed:
            photo["image"] = img = renamed[img]
        if img and os.path.exists(local(img)):
            photo["w"], photo["h"] = Image.open(local(img)).size

    with open(DATA, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    # Script copy for previewing the site from disk, where browsers block reading the JSON
    with open(DATA_JS, "w", encoding="utf-8") as f:
        f.write("// Generated from data/gallery.json by scripts/optimize_photos.py. Do not edit.\n")
        f.write("window.GALLERY_DATA = " + json.dumps(data, indent=2, ensure_ascii=False) + ";\n")

    photos = [p for p in data.get("photos", []) if p.get("image")]
    if photos:
        first = local(photos[0]["image"])
        with open(GALLERY_PAGE, encoding="utf-8") as f:
            page = f.read()
        page = re.sub(r'(<link rel="preload" as="image" href=")[^"]*(")', rf"\g<1>{first}\g<2>", page, count=1)
        with open(GALLERY_PAGE, "w", encoding="utf-8") as f:
            f.write(page)


if __name__ == "__main__":
    main()
    optimize_quiz()
