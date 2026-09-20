# Personal website

A static four-page site: `index.html` (home), `small-jobs.html`, `gallery.html`, `contact.html`.
No build step. Open `index.html` in a browser, or upload the whole folder to any static host (Netlify, GitHub Pages, Cloudflare Pages).

## Contact details

Phone (470) 301-9576, email cleo@cleovalentinebuilds.com, and the Formspree form are already filled in.
To change the phone number, search every `.html` file for `4703019576` (the `tel:` and `sms:` links, digits only) and `(470) 301-9576` (the visible text).
To change the email, search the `.html` files and `js/contact.js` for `cleo@cleovalentinebuilds.com`.

The site is served at `https://cleovalentinebuilds.com/` (set by the `CNAME` file). Link previews (Facebook, Nextdoor, texts) use absolute URLs on that domain; if the domain ever changes, update `CNAME` and search-and-replace the old address.

## Add your photos

1. Copy photos of your work into `images/work/`.
2. Open `js/photos.js` and add one line per photo:
   ```js
   { file: "back-deck.jpg", title: "Back deck", town: "Jackson", type: "decks", featured: true },
   ```
   - `type` picks the gallery filter: framing, sheetrock, trim, flooring, decks, pergolas, porches, woodwork, carports, remodels.
   - `featured: true` also shows it in "Selected work" on the home page (first 6 featured).
3. Set `window.DETAIL_PHOTO` in the same file to a close-up shot for the home page "The approach" section.
4. Save and refresh.

Gallery photos keep their own shape. Any entry whose file is missing shows a blank placeholder, and filters with no photos are hidden.

## Contact form

Out of the box, sending the form opens the visitor's email app with the details filled in.

To receive requests directly (works on phones with no email app set up):
1. Create a free form at [formspree.io](https://formspree.io) and verify your email.
2. Copy the form's endpoint (it looks like `https://formspree.io/f/abcd1234`).
3. In `contact.html`, put it in the form's `action` (currently `https://formspree.io/f/xvkgglnj`).

Keep `js/contact.js`: it validates the form, sends it to Formspree, and falls back to the email app if Formspree is unreachable.
The free Formspree plan doesn't accept file uploads, so the site asks people to text photos instead.
