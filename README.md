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
