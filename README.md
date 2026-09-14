# Personal website

A static three-page site: `index.html` (home), `gallery.html`, `contact.html`.
No build step. Open `index.html` in a browser, or upload the whole folder to any static host (Netlify, GitHub Pages, Cloudflare Pages).

## Fill in your details

Search all files for these placeholders and replace them:

| Placeholder       | Where                                                       |
| ----------------- | ----------------------------------------------------------- |
| `[Phone Number]`  | About section, contact page, footers (also `tel:` links)    |
| `[Email Address]` | About section, contact page, footers, and `js/contact.js`   |

For `tel:` links, use digits only, e.g. `href="tel:7705551234"`.

## Add your photos

1. Copy photos of your work into `images/work/`.
2. Open `js/photos.js` and add one line per photo:
   ```js
   { file: "back-deck.jpg", title: "Back deck", town: "Jackson", type: "decks", featured: true },
   ```
   - `type` picks the gallery filter: framing, sheetrock, trim, flooring, decks, pergolas, porches, woodwork.
   - `featured: true` also shows it in "Selected work" on the home page (first 6 featured).
3. Set `window.DETAIL_PHOTO` in the same file to a close-up shot for the home page "The approach" section.
4. Save and refresh.

Gallery photos keep their own shape. Any entry whose file is missing shows a blank placeholder, and filters with no photos are hidden.
The 12 entries already in `js/photos.js` are examples: rename your files to match, or replace the entries.

## Contact form

The form opens the visitor's email app with the message filled in, so it works without a server.
To receive submissions directly instead, point the form at a service like Formspree and remove `js/contact.js`.
