# Personal website

A static five-page site: `index.html` (home), `small-jobs.html`, `gallery.html`, `referrals.html`, `contact.html`.
No build step. Upload the whole folder to any static host (Netlify, GitHub Pages, Cloudflare Pages).

To preview it locally, run a small web server in this folder (`npx http-server`) and open
<http://localhost:8080>. Double-clicking a file no longer works, because the pages link to each other
by path (`/gallery`, not `gallery.html`) and the gallery loads its photo list with `fetch`.

## Addresses

Pages are linked without the `.html`: `/gallery`, `/small-jobs`, `/referrals`, `/contact`, and `/` for
home. GitHub Pages serves `gallery.html` at `/gallery` on its own, so the files keep their names and
old `...html` links still work. If a page is ever renamed, update its `canonical` and `og:url` tags too.

## Contact details

Phone (470) 301-9576, email cleo@cleovalentinebuilds.com, and the Formspree form are already filled in.
To change the phone number, search every `.html` file for `4703019576` (the `tel:` and `sms:` links, digits only) and `(470) 301-9576` (the visible text).
To change the email, search the `.html` files and `js/contact.js` for `cleo@cleovalentinebuilds.com`.

The site is served at `https://cleovalentinebuilds.com/` (set by the `CNAME` file). Link previews (Facebook, Nextdoor, texts) use absolute URLs on that domain; if the domain ever changes, update `CNAME` and search-and-replace the old address.

## Update the gallery (Pages CMS)

1. Go to [app.pagescms.org](https://app.pagescms.org) and sign in with GitHub.
2. Open **EtherealElle/Personal-Website**, then **Gallery**.
3. Add, edit, reorder or remove photos:
   - **Photo**: upload straight from your phone.
   - **Title** and **Town**: shown under each photo.
   - **Gallery filter**: which filter button it appears under.
   - **Feature on home page**: the first 6 featured photos appear in "Selected work".
   - Leave the width and height boxes empty; they fill in automatically.
4. Click **Save**. The site updates within a few minutes.

After each save, a GitHub Action (`.github/workflows/optimize-photos.yml`) shrinks big phone photos to 1600px on the longest side (never cropped), converts PNGs to JPG, records each photo's size, and redeploys. Your full-size originals are not kept in the repository, so keep them on your phone or computer.

The gallery data lives in `data/gallery.json`, which you can also edit by hand. Previewing locally needs a small web server (for example `npx http-server`), because the pages load that file with `fetch`, which doesn't work from a double-clicked HTML file.

## Contact form

Out of the box, sending the form opens the visitor's email app with the details filled in.

To receive requests directly (works on phones with no email app set up):
1. Create a free form at [formspree.io](https://formspree.io) and verify your email.
2. Copy the form's endpoint (it looks like `https://formspree.io/f/abcd1234`).
3. In `contact.html`, put it in the form's `action` (currently `https://formspree.io/f/xvkgglnj`).

Keep `js/contact.js`: it validates the form, sends it to Formspree, and falls back to the email app if Formspree is unreachable.
The free Formspree plan doesn't accept file uploads, so the site asks people to text photos instead.

## Agents

Three jobs that come up after every job, packaged as Claude Code skills. Type the name
with a slash in Claude Code and it runs. Each one drafts and shows its work first;
none of them sends anything or commits without being asked.

### `/photo-intake` — photos into the gallery

Drop phone photos in `images/inbox/`, then run it. It looks at each photo, writes a
title in the right voice, picks the gallery filter, reads the EXIF GPS to work out the
town, spots before/after pairs and duplicates, holds back the ones that won't do, moves
the keepers into `images/work/`, adds them to `data/gallery.json` and opens a commit.
You approve the list before anything moves.

Two things it always does: never crops (oversized photos scale down proportionally), and
strips the metadata, so a photo taken in a client's living room doesn't ship their
coordinates to a public repository. See `images/inbox/README.md`.

Underneath: `scripts/intake_photos.py scan` measures, `apply` moves. The measuring is a
script; the judging needs eyes on the photo.

### `/lead-reply` — answer an enquiry fast

Paste in a Formspree notification, a Facebook message or a text. It drafts a reply in
your voice, as a short text and as an email, picks two or three gallery photos that
actually match the job, and logs the lead. Whoever replies first usually gets the job.

It never quotes a price, never commits to a date, never claims licensed or insured, and
never sends anything — the output is text to copy. It reads a pasted enquiry rather than
watching the inbox, because nothing here can read your mail: Formspree's free plan has
no API.

Underneath: `scripts/pick_photos.py "<the job>" --town "<town>"` ranks the gallery
against the job. If there's no matching work it says so instead of sending a carport
photo to someone with a hole in their wall.

### `/review-ask` — get the reviews

Reads the ledger, tells you who's owed a review ask and who's gone quiet, and drafts
each ask naming the actual job. Follows up once after five days, twice at most, then
stops — a client who hasn't answered twice has answered.

It needs the direct review link once. In Google Business Profile tap **Ask for reviews**,
copy the `https://g.page/r/.../review` link, then:

    python scripts/jobs.py config --review-link <url>

### The ledger

`scripts/jobs.py` keeps `private/jobs.json` — who got in touch, what stage it's at, who's
been asked for a review. `private/` is gitignored and never committed; client details
don't go in a public repository.

    python scripts/jobs.py add --name Jess --town Decatur --job "drywall patch"
    python scripts/jobs.py set jess --stage done --finished today
    python scripts/jobs.py due          # a lead with no reply, a job with no review ask
    python scripts/jobs.py list

It's also the only honest record of whether the site is working. Cloudflare counts
visits; it cannot count a text message.

## Logo

The mark is the name itself: **CLEO ♥ VALENTINE**, set in Instrument Serif uppercase
with a heart where the space would be. Two forms.

### In the nav and the footer

Markup, not an image — the name stays real text, so it is selectable, searchable and read
aloud properly, and only the heart is drawn:

```html
<a href="/" class="brand" aria-label="Cleo Valentine Builds, home">
  <span>Cleo</span>
  <svg class="brand__heart" viewBox="0 0 24 24" aria-hidden="true"><path d="..."/></svg>
  <span>Valentine</span>
</a>
```

Styled by `.brand` / `.footer__brand` / `.brand__heart` in `css/styles.css`. The heart is
`var(--accent)`, the same pink as the nav underline and the scroll bar. That is brilliant
on the dark footer (11:1 against `--dark`) and deliberately soft on the cream nav
(1.5:1) — a quiet tint rather than a second logo competing with the name. To make it
carry harder on cream, give `.brand__heart` its own colour; `#d4628a` reaches 3:1 while
still reading as pink.

To use it anywhere new, copy the markup above and give it `.brand`.

### Profile pictures

`images/logo/profile-1024.png` and `profile-512.png` — CLEO / heart / VALENTINE stacked
and centred on the dark ground. For Google Business Profile, Facebook, Instagram and
anywhere else that wants a square avatar. The text sits well inside the circle those
platforms crop to, so nothing is lost when it goes round.

Regenerate at any size, or after changing the wording or colours:

```
python scripts/render_logo.py
```

It renders the mark in headless Chrome (so it is set in the real Instrument Serif) and
scales the smaller copy down proportionally. Needs Chrome and a network connection for
the font; set `CHROME` if it is installed somewhere unusual.

### Still the old house

`favicon.svg` is unchanged — a wordmark cannot be a 16px tab icon. Replacing it with a
heart on an ink tile would match; ask when you want that done.

## Design quiz

**It's a walk through one house.** `/quiz` is one long page over a photoreal house,
rendered in Blender: a porch out front, a living room, dining room and hall inside, a
deck and yard out back. Every question has its spot in it. As the client scrolls, the
camera **walks** from one spot to the next &mdash; up the steps, through the front door,
down the hall, out onto the deck &mdash; and tapping a style changes it in place. At the
end, **Walk through your picks** lets them drag to look around each spot and tap to walk
between them, with every choice they made in it.

Questions are always visited in the house's order (street to back yard), whatever order
the link lists them in, so every move is a walk to a neighbour. A question added in
Pages CMS that the house doesn't have a spot for still works: its styles are shown as
framed photos. If anything fails to load, the page offers **`/quiz-classic`**, the same
quiz as simple cards, with the same link. The code is `js/quiz-house.js` and
`css/quiz-house.css`; what it shows is listed in `data/house.json`.

`quiz.html` asks a client how they want the details built: one question per screen, a
board of styles, tap the one you like. It is **not linked from the site** and carries a
`noindex` tag, so it only reaches whoever you send it to. Fourteen questions and 75
styles so far &mdash; trim, doors, baseboards, crown, wainscoting, built-ins, mantels,
deck railing, deck boards, porch ceilings, columns, fences, hardware finish and handle
style.

On each question the client can:

- **tap a style** to choose it (nothing moves on until they press Next),
- **tap the magnifier** to see it full screen, and choose from there,
- pick **None of these are quite right**, which opens a note so they can say why,
- **add a note** about any question &mdash; it comes through with their answer.

When the link carries their name they're greeted by it and **never asked for it**. If
they reload halfway through, they pick up where they left off. Answers and notes come to
the same Formspree inbox as the contact form, as `Design quiz - <name>`, with a text
message as the fallback if Formspree can't be reached.

### Sending one: `/quiz-builder`

Your page, also unlinked and `noindex`. Bookmark it on your phone.

1. Type the client's first name.
2. Tick the questions this job needs.
3. Open any question to choose **which styles** they see. Each needs at least two.
4. **Text it** opens Messages with the link written in; or copy it, or open it yourself
   first.

The link carries everything, so nothing is stored anywhere:

```
https://cleovalentinebuilds.com/quiz?for=Jess&trim=square.22.cap&doors
```

`trim=square.22.cap` means that question, with those styles. `doors` on its own means
that question with its default styles. Questions appear in the order they're listed.
Older links (`?q=window-door-trim,interior-doors`) still work, as do a question's old
names; anything unrecognised, like the tracking tag Facebook adds to shared links, is
ignored.

The quiz and the builder share one file for reading and writing these links,
`js/quiz-core.js`, so the link the builder writes is always the one the quiz reads.

### Changing what's in it: Pages CMS

The catalog is `data/quiz.json`, and it's editable in **Pages CMS under Design quiz**:

- **Show by default** decides whether a style is included unless you untick it in the
  builder. Use it to retire a style without deleting it.
- Rename a style, rewrite its description, reorder styles or questions.
- **Add your own style** with a photo &mdash; of a finished job, say. Upload it as the
  Picture and leave Small version empty. It's shown whole, never cropped, and the GitHub
  Action shrinks it and strips its location data on the way in, since a phone photo of a
  client's room records where it was taken.
- Don't change a **Link name** once a link using it has gone out.

### The renders: `scripts/house/`

Every built-in style is a render, not a photo. Four photos of four different houses
would differ in wall colour, window size and light, so the client would be choosing a
room rather than a detail. Here it's always the same house in the same afternoon light,
and only the thing being asked about changes.

The house is built by script in **Blender** (5.2, Cycles on the GPU) from real
dimensions in inches. The joinery &mdash; casings, doors, wainscoting, built-ins, mantels
&mdash; is the same geometry as before, exported from the old three.js builders in
`scripts/quiz-render/`; baseboard and crown run round every wall of the rooms with true
mitres; the porch, deck, railing, fence and hardware are built directly. Floors, brick,
slate, roofing, grass, trees and furniture are free CC0 assets from
[Poly Haven](https://polyhaven.com), and the light is a real sky (HDRI) coming in through
the windows.

```
python scripts/house/fetch_assets.py                     # Poly Haven assets, ~250 MB, to ~/Tools/house-assets
node scripts/quiz-render/export.mjs ~/Tools/house-export trim doors panel builtin mantel
blender -b --factory-startup --python scripts/house/build.py -- house.blend
blender -b house.blend --python scripts/house/render.py -- preview            # quick look at every spot
blender -b house.blend --python scripts/house/render.py -- stills             # every style, 2048px
blender -b house.blend --python scripts/house/render.py -- clips              # the walks, as frames
blender -b --factory-startup --python scripts/house/encode.py -- <frames> <videos>
python scripts/house/publish.py <stills> <videos>
```

- `stations.py` is where the camera stands for each question, the route through the
  house, and the doorways each walk passes through.
- `render.py stills trim/22` renders one style; `stills trim` one question.
- `publish.py` writes `images/house/<question>/<style>.webp` (the square stage),
  `images/house/walk/*.mp4` (each walk, forwards and backwards), and the 4:5
  `images/quiz/<question>/<style>.webp` and `-sm.webp` the card quiz, the builder and
  the style chips use &mdash; all cropped from the same render. `data/house.json` lists
  them with a fingerprint each, so a re-render is never hidden behind a cached copy.
- Only the finished images and videos are committed; the assets, the `.blend` and the
  raw frames stay on your machine.

Adding a rendered style: add it to its builder (or `build.py`), list it in `BUILT` in
`stations.py`, add it to `data/quiz.json`, then build, `stills <question>`, publish.

### Removing it

Delete `quiz.html`, `quiz-classic.html`, `quiz-builder.html`, `css/quiz.css`,
`css/quiz-house.css`, `js/quiz.js`, `js/quiz-house.js`, `js/quiz-builder.js`,
`js/quiz-core.js`, `data/quiz.json`, `data/house.json`, `images/quiz/`, `images/house/`,
`scripts/quiz-render/` and `scripts/house/`, and the `quiz` entries in `.pages.yml`.
Nothing else refers to them.

It is separate from `/picks`, which is a head-to-head tournament for narrowing a long
list of photos. Use the quiz for "which of these styles", and picks for "which of these
twenty photos".

## Caching

Cloudflare tells browsers to keep CSS and JS files for hours. To stop visitors getting a new page with an old script, every CSS/JS link carries a `?v=` fingerprint of the file. `.github/workflows/stamp-versions.yml` updates these automatically when CSS or JS changes; you can also run `python scripts/stamp_versions.py` before pushing.

## Walkthrough video

`images/work/carport-walkthrough.mp4` plays in the "Step inside the build" section on the home page. It has no audio track and does not download until a visitor taps play; `images/work/carport-walkthrough-poster.jpg` is the still shown until then. To swap the video, replace both files (keep the names), or ask for the section to point somewhere else.

## Referral program

`referrals.html` is meant to be sent to people I've already worked for, by text or email:
`https://cleovalentinebuilds.com/referrals.html`. It isn't in the top menu — only in the footer of
every page — so it stays a thank-you for existing clients instead of an offer to strangers. The page
states the two terms ($100 gift card of your choice, once the referral goes through with the job)
and how it works. It deliberately doesn't list specific stores.

## Design picks (temporary)

`picks.html` is a private tournament page for helping a client settle design choices: two
photos at a time, tap the one you like more, winner advances. It is **not linked from the
site** and carries a `noindex` tag, so it only reaches whoever you send it to:

```
https://cleovalentinebuilds.com/picks?for=Jess
```

The `?for=` name is optional and only personalises the greeting. Finished picks are emailed
to you through the same Formspree inbox as the contact form, with a text-message fallback if
that fails.

Photos live in `images/picks/`, one folder per decision — see `images/picks/README.md` for
how to set one up and how to remove the whole feature when it has served its purpose.
