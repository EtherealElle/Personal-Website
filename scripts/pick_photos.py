"""Pick the gallery photos worth sending with a reply.

    python scripts/pick_photos.py "drywall patch in the hallway" --town Decatur

Reads data/gallery.json and ranks it against what the job actually is, so a reply
about a sticking door goes out with door photos instead of the carports that happen
to be featured on the home page. Prints JSON: the matched gallery filters and the
best photos, with the live URL of each.

Scoring is deliberately dull - keyword to gallery filter, a nudge for the same town,
a nudge for a featured photo. The point is that the URLs and titles are real and
copied rather than remembered.
"""
import argparse
import json
import re

DATA = "data/gallery.json"
SITE = "https://cleovalentinebuilds.com"

# What a homeowner calls it -> the gallery filter it lives under
WORDS = {
    "trim": ["door", "doors", "doorway", "latch", "jamb", "hinge", "trim", "baseboard",
             "casing", "crown", "moulding", "molding", "threshold", "sticking", "stick"],
    "sheetrock": ["drywall", "sheetrock", "plaster", "patch", "patches", "hole", "holes",
                  "crack", "cracks", "water damage", "ceiling", "mud", "taping", "texture"],
    "flooring": ["floor", "floors", "flooring", "hardwood", "lvp", "laminate", "vinyl",
                 "subfloor", "squeak", "squeaky", "transition"],
    "decks": ["deck", "decking", "railing", "rail", "baluster", "balusters", "joist",
              "stair", "stairs", "step", "steps", "handrail"],
    "pergolas": ["pergola", "arbor", "arbour", "shade structure", "trellis"],
    "porches": ["porch", "porches", "screened", "screen porch", "sunroom", "veranda",
                "columns", "column"],
    "woodwork": ["shelf", "shelves", "shelving", "bookshelf", "bookcase", "built-in",
                 "built in", "builtin", "mantel", "mantle", "bench", "cabinet", "cabinets",
                 "closet", "desk", "table", "furniture", "custom", "woodwork", "library"],
    "carports": ["carport", "pavilion", "shed", "shelter", "lean-to"],
    "remodels": ["remodel", "remodelling", "remodeling", "renovation", "renovate",
                 "basement", "garage", "garage conversion", "attic", "bathroom",
                 "kitchen", "bedroom", "convert", "finish out", "whole home",
                 "spare room", "office"],
    "fencing": ["fence", "fencing", "gate", "privacy fence"],
    "framing": ["framing", "frame", "stud", "studs", "header", "beam", "addition",
                "structural", "wall", "walls", "rot", "rotten", "rotted", "soft",
                "ramp", "grab bar", "grab bars", "accessibility", "wheelchair"],
}
# A garage can mean either; a remodel is the likelier ask in town
NEAR = {"remodels": ["woodwork", "sheetrock"], "sheetrock": ["trim"], "trim": ["sheetrock"],
        "decks": ["porches", "framing"], "porches": ["decks", "framing"],
        "pergolas": ["carports", "decks"], "carports": ["pergolas", "framing"],
        "woodwork": ["remodels", "trim"], "framing": ["decks", "remodels"],
        "flooring": ["trim"], "fencing": ["decks"]}


def matched_types(text):
    """Gallery filters the job text points at, strongest first."""
    low = " " + re.sub(r"[^a-z0-9 -]+", " ", text.lower()) + " "
    # "floor to ceiling shelving" is shelving, not flooring and not a ceiling
    low = re.sub(r" floor[ -]to[ -]ceiling ", " tall ", low)
    hits = {}
    for gtype, words in WORDS.items():
        score = sum(3 if f" {w} " in low else 0 for w in words)
        if score:
            hits[gtype] = score
    for gtype, score in list(hits.items()):
        for neighbour in NEAR.get(gtype, []):
            hits[neighbour] = hits.get(neighbour, 0) + 1
    return sorted(hits, key=lambda t: -hits[t]), hits


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("job", help="what the job is, in the client's own words")
    ap.add_argument("--town", default="", help="the client's town, if they said")
    ap.add_argument("--count", type=int, default=3)
    args = ap.parse_args()

    with open(DATA, encoding="utf-8") as f:
        photos = [p for p in json.load(f).get("photos", []) if p.get("image")]

    order, hits = matched_types(args.job)
    town = args.town.strip().lower()

    scored = []
    for i, p in enumerate(photos):
        # A photo only qualifies on what it shows. Town and featured break ties between
        # relevant photos; they never promote unrelated work, or a reply about a sticking
        # door goes out with the carport that happens to be on the home page.
        score = hits.get(p.get("type", ""), 0)
        if not score:
            continue
        if town and town in (p.get("town") or "").lower():
            score += 4
        if p.get("featured"):
            score += 1
        scored.append((score, -i, p))
    scored.sort(key=lambda t: (-t[0], -t[1]))

    picks = [{
        "title": p.get("title"),
        "type": p.get("type"),
        "town": p.get("town") or None,
        "url": SITE + p["image"],
    } for _, _, p in scored[:args.count]]

    have = {p.get("type") for p in photos}
    empty = [t for t in order if t not in have]

    if not order:
        note = ("Nothing in the job description matched a gallery filter. Send no photos "
                "and link the gallery, or ask what the job is.")
    elif not picks:
        note = ("The job matched " + ", ".join(order) + " but the gallery has no photos of "
                "that work. Say so plainly - link the gallery, don't substitute.")
    else:
        note = "Only send a photo if it genuinely resembles the job. Drop the rest."

    print(json.dumps({
        "job": args.job,
        "town": args.town or None,
        "matched_filters": order or None,
        "matched_but_no_photos": empty or None,
        "picks": picks,
        "gallery": SITE + "/gallery",
        "note": note,
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
