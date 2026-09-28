# Design picks — drop photos here

This folder feeds the private tournament page at `/picks`. It is not linked from the
website and is not indexed by search engines.

## How to set one up

Make one folder per decision you want the client to make. The folder name becomes the
question, and each photo inside it becomes an option:

```
images/picks/
  01-railing-style/
    black-metal.jpg
    cable-rail.jpg
    wood-picket.jpg
    horizontal-slat.jpg
  02-porch-ceiling/
    stained-tongue-groove.jpg
    painted-white.jpg
    natural-cedar.jpg
  03-stain-color/
    ...
```

- **Folder name** → the question. `01-railing-style` shows as "Railing style". The number
  in front only sets the order and is never shown.
- **File name** → the option's label. `black-metal.jpg` shows as "Black metal". Camera
  names like `IMG_4821.jpg` get an A/B badge instead, so nothing ugly shows up.
- **How many** per folder: 4 to 8 works best. Two is fine. Odd numbers are fine too — one
  photo gets a free pass to the next round.
- **File types**: jpg, jpeg, png, or webp. Photos are shrunk to fit a phone screen,
  proportionally, never cropped. Originals are replaced, so keep your own copies.

## After you add or change photos

Run this once, then commit and push:

```bash
python scripts/build_picks.py
```

Pushing photos to GitHub without running it also works — the `Build design picks`
workflow rebuilds the list for you.

## Sending it to a client

The page takes her name so it feels personal:

```
https://cleovalentinebuilds.com/picks?for=Jess
```

When she finishes, her picks are emailed to you through the same Formspree inbox the
contact form uses.

## Taking it down

Delete `picks.html`, `css/picks.css`, `js/picks.js`, `js/picks-data.js`,
`scripts/build_picks.py`, `.github/workflows/build-picks.yml`, and this folder.
Nothing else on the site touches them.
