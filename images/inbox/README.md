# Photo inbox

Drop job photos here straight off your phone. Any name, any size — `IMG_4471.jpg` is fine.

Then, in Claude Code: **`/photo-intake`**

It looks at each photo, writes a title, picks the gallery filter, reads the GPS to work
out the town, spots before/after pairs and duplicates, holds back the ones that won't do,
renames and moves the keepers into `images/work/`, adds them to `data/gallery.json`, and
opens a commit. You approve the list before anything moves.

Nothing in this folder is committed, so it's safe to leave photos sitting here.

## By hand

```
python scripts/intake_photos.py scan
```

Measures everything and prints JSON — sizes, dates, town guess, sharpness, which photos
look like the same scene. Decides nothing.

```
python scripts/intake_photos.py apply private/intake.json
```

Applies a decisions file. See the top of `scripts/intake_photos.py` for its shape.

## Two things it always does

**Never crops.** Oversized photos are scaled down proportionally to 1600px on the long
side by `scripts/optimize_photos.py`; the framing you shot is the framing that ships.

**Strips the metadata.** A phone photo taken in a client's living room has their
coordinates in it. Those are read to guess the town, then thrown away — photos in
`images/work/` carry no EXIF at all.

Rejects move to `images/inbox/rejected/` rather than being deleted. Clear it out yourself
when you've had a look.
