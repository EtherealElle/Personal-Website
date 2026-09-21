"""Shrink oversized photos and keep data/gallery.json in sync.

Run by .github/workflows/optimize-photos.yml after photos are added through Pages CMS.
Photos are scaled down proportionally (never cropped) to at most 1600px on the longest
side. PNG photos are converted to JPG. Each gallery entry gets its width and height
recorded, and the gallery page's preload hint is pointed at the first photo.
"""
import json
import os
import re
from PIL import Image, ImageOps

PHOTO_DIR = "images/work"
DATA = "data/gallery.json"
GALLERY_PAGE = "gallery.html"
MAX_SIDE = 1600
MAX_BYTES = 500 * 1024
QUALITY = 74


def optimize(path):
    """Resize/recompress one photo. Returns the new path if the file was renamed."""
    ext = os.path.splitext(path)[1].lower()
    im = Image.open(path)
    too_big = max(im.size) > MAX_SIDE or os.path.getsize(path) > MAX_BYTES
    if not too_big:
        return path
    im = ImageOps.exif_transpose(im)  # bake in phone rotation before metadata is dropped
    im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
    if im.mode not in ("RGB", "L"):
        im = im.convert("RGB")
    out = path
    if ext == ".png":
        out = os.path.splitext(path)[0] + ".jpg"
    if ext == ".webp":
        im.save(out, "WEBP", quality=QUALITY, method=6)
    else:
        im.save(out, "JPEG", quality=QUALITY, optimize=True, progressive=True)
    if out != path:
        os.remove(path)
    print(f"optimized {path} -> {out} {im.size[0]}x{im.size[1]} {os.path.getsize(out) // 1024}K")
    return out


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
