# Personal website

A static four-page site: `index.html` (home), `small-jobs.html`, `gallery.html`, `contact.html`.
No build step. Open `index.html` in a browser, or upload the whole folder to any static host (Netlify, GitHub Pages, Cloudflare Pages).

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

## Caching

Cloudflare tells browsers to keep CSS and JS files for hours. To stop visitors getting a new page with an old script, every CSS/JS link carries a `?v=` fingerprint of the file. `.github/workflows/stamp-versions.yml` updates these automatically when CSS or JS changes; you can also run `python scripts/stamp_versions.py` before pushing.

## Walkthrough video

`images/work/carport-walkthrough.mp4` plays in the "Step inside the build" section on the home page. It has no audio track and does not download until a visitor taps play; `images/work/carport-walkthrough-poster.jpg` is the still shown until then. To swap the video, replace both files (keep the names), or ask for the section to point somewhere else.
