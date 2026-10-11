---
name: photo-intake
description: Turn phone photos in images/inbox into gallery entries - title, filter, town from the photo's GPS, before/after pairs spotted, bad shots held back - then commit. Use after finishing a job, or whenever the user mentions new job photos, adding photos to the gallery or the portfolio.
---

# Photo intake

Phone photos go in `images/inbox/`. This turns them into `data/gallery.json` entries and a commit.

The script measures; you judge. Do not skip the looking — a title written from a filename
is worse than no title, and the sharpness number cannot tell a soft photo from a soft
focus one.

## 1. Measure

```
python scripts/intake_photos.py scan
```

JSON per photo: dimensions, orientation, when it was taken, `town_guess` from the EXIF
GPS, `sharpness` (`soft: true` under 90), and `looks_like` — other photos in the batch
with a close image hash, which is either a duplicate or a before/after pair.

If the inbox is empty, say so and stop. Don't go hunting for photos elsewhere.

## 2. Look at every photo

Read each file in `images/inbox/` with the Read tool. Actually look. For each one decide:

- **Keep or hold back.** Hold back: out of focus, nothing legible in frame, a person's
  face, anything identifying the house (street number, mail, a car plate), a phone
  screen, a receipt, a photo of the same thing you already kept. Say why.
- **Title.** What the thing is, the way Cleo writes it (see `docs/voice.md`): concrete
  and specific. *"Hallway door rehung and trimmed"*, not *"Door project"* and not
  *"IMG_4471"*. No town in the title — the town is its own field. Check it against
  `existing_titles` in the scan so the gallery doesn't repeat itself.
- **Gallery filter.** One of the eleven in the scan's `types`. Pick for what the photo
  *shows*, not what the job was called: a garage conversion photographed as finished
  shelving is `woodwork`.
- **Town.** Use `town_guess` if it's plausible, but it is a nearest-match against a
  table of coordinates, so check `town_miles_off` and ask the user if it's over ~4 miles
  or the batch spans two towns. If there's no GPS, ask — don't leave it blank. **0 of 49
  existing photos have a town**, and a town is what tells a Decatur homeowner you work
  in Decatur.
- **Before/after.** Where `looks_like` says "same scene" and the photos really are the
  same spot in two states, title them `… — before` and `… — after` and keep them next to
  each other in the plan so they read as a pair in the grid. (A proper before/after
  slider would need the gallery renderer changed; that's separate work.)
- **Featured.** Default off. The home page's "Selected work" is the first six featured
  photos in order, so turning one on changes the home page — only propose it for a
  genuinely better photo than what's there, and say what it would displace.

## 3. Show the plan, then apply it

Write the decisions to `private/intake.json`:

```json
{
  "photos": [
    {"file": "IMG_4471.jpg", "title": "Hallway door rehung and trimmed",
     "type": "trim", "town": "Decatur", "featured": false}
  ],
  "reject": [{"file": "IMG_4468.jpg", "why": "out of focus"}]
}
```

Show the user the table — file, title, filter, town, and the held-back ones with reasons —
**before** running apply. Then:

```
python scripts/intake_photos.py apply private/intake.json
```

That renames each photo after its title, strips the EXIF (so no client's coordinates ship
with the site), moves it to `images/work/`, adds it to the front of `data/gallery.json`,
moves the rejects to `images/inbox/rejected/`, and runs `optimize_photos.py` to resize
anything oversized — proportionally, never cropped — and record widths and heights.

## 4. Commit

Add the photos apply actually named, not the whole folder — `images/work/` can hold
untracked files that have nothing to do with this batch:

```
git add data/gallery.json data/gallery.js gallery.html
git add images/work/<each-new-file>
git status   # read it before committing
git commit
```

A one-line message naming the work, e.g. `Add the Decatur door and drywall photos`.
`images/inbox/` is gitignored, so nothing from it is committed by accident.

Then tell the user it will be live in a few minutes and offer to push. Don't push
without being asked.

## Don'ts

- Don't crop anything, ever, or add a crop step to the script.
- Don't write a town you were not given or did not derive from GPS.
- Don't commit anything from `images/inbox/` or `private/`.
- Don't invent a gallery filter that isn't in `.pages.yml`.
