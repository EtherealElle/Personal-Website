"""Download the CC0 Poly Haven assets the house is built with (polyhaven.com, public domain).

    python scripts/house/fetch_assets.py [dest]

dest defaults to ~/Tools/house-assets. Nothing here goes on the site: Blender reads these
to render the quiz, and only the finished images and clips are committed. Safe to re-run;
files already downloaded with the right size are skipped.
"""
import json
import os
import sys
import urllib.request

DEST = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.expanduser("~"), "Tools", "house-assets")
UA = {"User-Agent": "house-render-fetch/1.0"}

HDRIS = {"meadow_2": "4k"}
TEXTURES = {
    "plank_flooring_04": "2k", "japanese_cedar_planks": "2k", "fine_grained_wood": "2k",
    "rosewood_veneer1": "2k", "oak_wood_planks": "2k", "red_brick_03": "2k", "dark_brick_wall": "2k",
    "slate_floor": "2k", "leafy_grass": "2k", "grey_roof_01": "2k", "concrete_pavement": "2k",
    "fabric_pattern_07": "2k", "brown_mud_leaves_01": "2k",
}
MODELS = {
    "sofa_02": "2k", "mid_century_lounge_chair": "2k", "modern_coffee_table_01": "2k",
    "side_table_01": "1k", "potted_plant_02": "2k", "ceramic_vase_01": "1k", "Rockingchair_01": "2k",
    "outdoor_table_chair_set_01": "2k", "planter_box_01": "1k", "island_tree_01": "2k",
    "island_tree_02": "2k", "tree_small_02": "2k", "grass_medium_01": "1k", "grass_bermuda_01": "1k",
    "fern_02": "1k", "Lantern_01": "1k",
}


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
        return r.read()


def fetch(url, path, size):
    if os.path.exists(path) and os.path.getsize(path) == size:
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    data = get(url)
    with open(path + ".part", "wb") as f:
        f.write(data)
    os.replace(path + ".part", path)
    print(f"  {os.path.relpath(path, DEST)}  {len(data) / 1e6:.1f} MB")


def blend_with_includes(kind, name, res):
    files = json.loads(get(f"https://api.polyhaven.com/files/{name}"))
    entry = files["blend"][res]["blend"]
    base = os.path.join(DEST, kind, name)
    fetch(entry["url"], os.path.join(base, os.path.basename(entry["url"])), entry["size"])
    for rel, inc in entry.get("include", {}).items():
        fetch(inc["url"], os.path.join(base, rel), inc["size"])


def main():
    print("Downloading to", DEST)
    for name, res in HDRIS.items():
        e = json.loads(get(f"https://api.polyhaven.com/files/{name}"))["hdri"][res]["hdr"]
        fetch(e["url"], os.path.join(DEST, "hdri", f"{name}_{res}.hdr"), e["size"])
    for name, res in TEXTURES.items():
        blend_with_includes("textures", name, res)
    for name, res in MODELS.items():
        blend_with_includes("models", name, res)
    print("done")


if __name__ == "__main__":
    main()
