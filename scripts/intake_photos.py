"""Sort phone photos out of images/inbox and into the gallery.

Two steps, because only one of them is a judgement call.

    python scripts/intake_photos.py scan
        Measures every photo in images/inbox and prints JSON: size, orientation,
        when it was taken, the town the GPS points at, a sharpness score, and which
        other photos in the batch look like the same scene (duplicates, or a
        before/after pair). It decides nothing.

    python scripts/intake_photos.py apply private/intake.json
        Takes the decisions - title, gallery filter, town, order, what to throw out -
        renames each keeper after its title, strips the metadata, moves it into
        images/work, adds it to data/gallery.json, and runs optimize_photos.py so
        widths and heights are recorded. Rejects move to images/inbox/rejected.

Everything here resizes proportionally or not at all. Nothing is ever cropped.

The town guess is made against a built-in table of local coordinates rather than a
geocoding service, so a client's home coordinates never leave this machine. It is a
guess: check it before applying. The GPS is read and then thrown away - photos that
reach images/work carry no metadata at all, which matters because a phone photo taken
in someone's living room otherwise pins their address in a public repository.
"""
import json
import math
import os
import re
import sys
from datetime import datetime

from PIL import Image, ImageFilter, ImageOps, ImageStat

INBOX = "images/inbox"
REJECTED = "images/inbox/rejected"
PHOTO_DIR = "images/work"
DATA = "data/gallery.json"
EXTS = (".jpg", ".jpeg", ".png", ".webp")

# Keep in sync with the "Gallery filter" options in .pages.yml
TYPES = ("framing", "sheetrock", "trim", "flooring", "decks", "pergolas",
         "porches", "woodwork", "carports", "remodels", "fencing")

# Below this, a photo is soft enough to be worth a second look. It is a hint for the
# eye, not a verdict: motion blur and a shallow depth of field score the same.
BLUR_LIMIT = 90.0

# Where the work is. Neighbourhoods are listed as well as cities because an in-town
# job is more usefully tagged "Kirkwood" than "Atlanta". Anything more than
# FAR_MILES from the nearest of these is reported as unknown rather than guessed at.
FAR_MILES = 12.0
PLACES = [
    ("Atlanta", None, 33.7490, -84.3880),
    ("Decatur", None, 33.7748, -84.2963),
    ("East Atlanta", "Atlanta", 33.7407, -84.3405),
    ("Kirkwood", "Atlanta", 33.7520, -84.3200),
    ("Edgewood", "Atlanta", 33.7540, -84.3360),
    ("Reynoldstown", "Atlanta", 33.7487, -84.3573),
    ("Inman Park", "Atlanta", 33.7614, -84.3537),
    ("Candler Park", "Atlanta", 33.7667, -84.3400),
    ("Grant Park", "Atlanta", 33.7340, -84.3700),
    ("Ormewood Park", "Atlanta", 33.7260, -84.3496),
    ("Midtown", "Atlanta", 33.7838, -84.3830),
    ("West End", "Atlanta", 33.7391, -84.4175),
    ("Druid Hills", None, 33.7943, -84.3233),
    ("Avondale Estates", None, 33.7715, -84.2651),
    ("Scottdale", None, 33.7906, -84.2633),
    ("Clarkston", None, 33.8098, -84.2399),
    ("Stone Mountain", None, 33.8081, -84.1702),
    ("Tucker", None, 33.8545, -84.2171),
    ("Chamblee", None, 33.8920, -84.2988),
    ("Brookhaven", None, 33.8651, -84.3366),
    ("Doraville", None, 33.8979, -84.2680),
    ("Belvedere Park", None, 33.7437, -84.2583),
    ("Panthersville", None, 33.6885, -84.2769),
    ("Gresham Park", None, 33.7026, -84.3048),
    ("Lithonia", None, 33.7123, -84.1052),
    ("Snellville", None, 33.8573, -84.0199),
    ("Lilburn", None, 33.8898, -84.1430),
    ("Conyers", None, 33.6676, -84.0177),
    ("Covington", None, 33.5968, -83.8602),
    ("East Point", None, 33.6795, -84.4394),
    ("College Park", None, 33.6534, -84.4494),
    ("Hapeville", None, 33.6601, -84.4100),
    ("Forest Park", None, 33.6221, -84.3691),
    ("Riverdale", None, 33.5726, -84.4132),
    ("Union City", None, 33.5871, -84.5424),
    ("Fairburn", None, 33.5674, -84.5807),
    ("Morrow", None, 33.5829, -84.3394),
    ("Jonesboro", None, 33.5215, -84.3533),
    ("Stockbridge", None, 33.5443, -84.2338),
    ("Fayetteville", None, 33.4487, -84.4549),
    ("Peachtree City", None, 33.3968, -84.5957),
    ("Hampton", None, 33.3868, -84.2827),
    ("McDonough", None, 33.4473, -84.1469),
    ("Locust Grove", None, 33.3457, -84.1091),
    ("Griffin", None, 33.2468, -84.2641),
    ("Jenkinsburg", None, 33.3271, -84.0291),
    ("Flovilla", None, 33.2534, -83.8907),
    ("Jackson", None, 33.2946, -83.9654),
    ("Monticello", None, 33.3043, -83.6821),
    ("Barnesville", None, 33.0546, -84.1557),
    ("Forsyth", None, 33.0346, -83.9382),
    ("Marietta", None, 33.9526, -84.5499),
    ("Smyrna", None, 33.8840, -84.5144),
    ("Sandy Springs", None, 33.9304, -84.3733),
    ("Dunwoody", None, 33.9462, -84.3346),
    ("Norcross", None, 33.9412, -84.2135),
    ("Roswell", None, 34.0232, -84.3616),
]


def photos_in(folder):
    if not os.path.isdir(folder):
        return []
    return [n for n in sorted(os.listdir(folder))
            if os.path.splitext(n)[1].lower() in EXTS]


# ---------------------------------------------------------------- measuring

def miles(lat1, lon1, lat2, lon2):
    r = 3958.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def nearest_place(lat, lon):
    """The closest known town or neighbourhood, or None if the job was out of area."""
    name, parent, dist = min(
        ((n, p, miles(lat, lon, la, lo)) for n, p, la, lo in PLACES),
        key=lambda t: t[2])
    if dist > FAR_MILES:
        return None, round(dist, 1)
    return (f"{name}, {parent}" if parent else name), round(dist, 1)


def gps_of(exif):
    """Decimal latitude and longitude from the EXIF GPS block, if the phone recorded one."""
    try:
        gps = exif.get_ifd(0x8825)
    except Exception:
        return None
    if not gps or 2 not in gps or 4 not in gps:
        return None

    def deg(parts, ref):
        d, m, s = (float(x) for x in parts)
        v = d + m / 60 + s / 3600
        return -v if str(ref).upper() in ("S", "W") else v

    try:
        return deg(gps[2], gps.get(1, "N")), deg(gps[4], gps.get(3, "E"))
    except Exception:
        return None


def shot_at(exif):
    for tag in (36867, 36868, 306):  # DateTimeOriginal, DateTimeDigitized, DateTime
        raw = exif.get_ifd(0x8769).get(tag) if tag != 306 else exif.get(306)
        if raw:
            try:
                return datetime.strptime(str(raw), "%Y:%m:%d %H:%M:%S").isoformat(" ")
            except ValueError:
                return str(raw)
    return None


def sharpness(gray):
    """Variance of a Laplacian pass - low means soft. The offset keeps the filter's
    negative values from being clamped away before they can be measured."""
    lap = gray.filter(ImageFilter.Kernel((3, 3), [0, 1, 0, 1, -4, 1, 0, 1, 0],
                                         scale=1, offset=128))
    return round(ImageStat.Stat(lap).stddev[0] ** 2, 1)


def ahash(gray):
    """64-bit average hash. Two photos of the same scene land close together."""
    small = gray.resize((8, 8), Image.LANCZOS)
    px = list(small.getdata())
    avg = sum(px) / len(px)
    bits = 0
    for i, v in enumerate(px):
        if v >= avg:
            bits |= 1 << i
    return bits


def measure(path):
    im = Image.open(path)
    exif = im.getexif()
    gps = gps_of(exif)
    im = ImageOps.exif_transpose(im)
    w, h = im.size
    gray = im.convert("L")
    gray.thumbnail((512, 512), Image.LANCZOS)
    stat = ImageStat.Stat(gray)
    sharp = sharpness(gray)

    out = {
        "file": os.path.basename(path),
        "w": w, "h": h,
        "shape": "portrait" if h > w * 1.1 else "landscape" if w > h * 1.1 else "square",
        "kb": os.path.getsize(path) // 1024,
        "shot": shot_at(exif),
        "sharpness": sharp,
        "soft": sharp < BLUR_LIMIT,
        "brightness": round(stat.mean[0], 1),
        "_hash": ahash(gray),
    }
    if gps:
        town, dist = nearest_place(*gps)
        out["town_guess"] = town
        out["town_miles_off"] = dist
    else:
        out["town_guess"] = None
    return out


def scan():
    names = photos_in(INBOX)
    if not names:
        print(json.dumps({"photos": [], "note": f"No photos in {INBOX}."}, indent=2))
        return
    rows = [measure(f"{INBOX}/{n}") for n in names]

    # Same scene, two states: a close hash is either a duplicate or a before/after.
    for a in rows:
        close = []
        for b in rows:
            if a is b:
                continue
            d = bin(a["_hash"] ^ b["_hash"]).count("1")
            if d <= 14:
                close.append({"file": b["file"], "distance": d,
                              "likely": "duplicate" if d <= 5 else "same scene"})
        a["looks_like"] = sorted(close, key=lambda c: c["distance"])
    for a in rows:  # after every comparison, not during
        del a["_hash"]

    report = {
        "inbox": INBOX,
        "photos": rows,
        "existing_titles": [p.get("title") for p in load_gallery()["photos"]],
        "types": list(TYPES),
        "notes": [
            f"sharpness below {BLUR_LIMIT} is worth a second look, not an automatic reject",
            "town_guess is the nearest known place to the photo's GPS; confirm it",
            "'same scene' pairs are usually before/after; 'duplicate' means pick one",
        ],
    }
    out = json.dumps(report, indent=2, ensure_ascii=False)
    print(out)
    os.makedirs("private", exist_ok=True)
    with open("private/intake-scan.json", "w", encoding="utf-8") as f:
        f.write(out + "\n")


# ---------------------------------------------------------------- applying

def load_gallery():
    with open(DATA, encoding="utf-8") as f:
        data = json.load(f)
    data.setdefault("photos", [])
    return data


def slugify(title, ext, taken):
    base = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:60] or "project-photo"
    name = base + ext
    n = 2
    while name in taken or os.path.exists(f"{PHOTO_DIR}/{name}"):
        name = f"{base}-{n}{ext}"
        n += 1
    return name


def strip_metadata(src, dest):
    """Copy the pixels without the EXIF, so no GPS or device details ship with the site.
    JPEGs keep their original quantisation tables, so this does not recompress them."""
    im = Image.open(src)
    im = ImageOps.exif_transpose(im)
    ext = os.path.splitext(dest)[1].lower()
    if ext in (".jpg", ".jpeg"):
        if im.mode not in ("RGB", "L"):
            im = im.convert("RGB")
        im.save(dest, "JPEG", quality="keep" if im.format == "JPEG" else 92,
                optimize=True, progressive=True)
    elif ext == ".webp":
        im.save(dest, "WEBP", quality=90, method=6)
    else:
        im.save(dest)


def apply(plan_path):
    with open(plan_path, encoding="utf-8") as f:
        plan = json.load(f)
    keep = plan.get("photos", [])
    reject = plan.get("reject", [])

    for entry in keep:
        for field in ("file", "title", "type"):
            if not entry.get(field):
                raise SystemExit(f"every kept photo needs a {field}: {entry}")
        if entry["type"] not in TYPES:
            raise SystemExit(f"{entry['file']}: unknown gallery filter {entry['type']!r}; "
                             f"pick one of {', '.join(TYPES)}")
        if not os.path.exists(f"{INBOX}/{entry['file']}"):
            raise SystemExit(f"{entry['file']} is not in {INBOX}")

    data = load_gallery()
    os.makedirs(PHOTO_DIR, exist_ok=True)
    taken = set()
    added = []
    for entry in keep:
        src = f"{INBOX}/{entry['file']}"
        ext = os.path.splitext(entry["file"])[1].lower()
        ext = ".jpg" if ext == ".jpeg" else ext
        name = entry.get("slug") or slugify(entry["title"], ext, taken)
        taken.add(name)
        strip_metadata(src, f"{PHOTO_DIR}/{name}")
        os.remove(src)
        record = {"image": f"/{PHOTO_DIR}/{name}", "title": entry["title"],
                  "type": entry["type"], "featured": bool(entry.get("featured"))}
        if entry.get("town"):
            record["town"] = entry["town"]
        added.append(record)
        print(f"added  {entry['file']} -> {name}  [{entry['type']}]"
              + (f"  {entry['town']}" if entry.get("town") else ""))

    # Newest work reads first. Featured stays off by default, so the home page's
    # "Selected work" - the first six featured photos - is not reshuffled by an intake.
    if plan.get("append"):
        data["photos"].extend(added)
    else:
        data["photos"] = added + data["photos"]

    with open(DATA, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")

    if reject:
        os.makedirs(REJECTED, exist_ok=True)
        for entry in reject:
            src = f"{INBOX}/{entry['file']}"
            if os.path.exists(src):
                os.replace(src, f"{REJECTED}/{entry['file']}")
                print(f"held back {entry['file']}  ({entry.get('why', 'no reason given')})")

    # Reuse the pipeline that already shrinks oversized photos and records sizes
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import optimize_photos
    optimize_photos.main()
    print(f"\n{len(added)} added, {len(reject)} held back, "
          f"{len(load_gallery()['photos'])} photos in the gallery.")


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in ("scan", "apply"):
        raise SystemExit(__doc__)
    if sys.argv[1] == "scan":
        scan()
    else:
        if len(sys.argv) < 3:
            raise SystemExit("apply needs the path to a decisions file")
        apply(sys.argv[2])


if __name__ == "__main__":
    main()
