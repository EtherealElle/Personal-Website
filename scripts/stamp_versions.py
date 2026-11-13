"""Add a content fingerprint to every CSS/JS link in the HTML pages, e.g. js/main.js?v=3f2a9c1b.

Browsers (and Cloudflare) keep CSS/JS for hours, but pages for only minutes. Without this,
a visitor can get a new page with an old script and see a broken site. The fingerprint
changes only when the file's contents change, so running this again is harmless.
Run by .github/workflows/stamp-versions.yml; safe to run locally too.
"""
import glob
import hashlib
import re

pattern = re.compile(r'((?:href|src)=")((?:css|js)/[\w./-]+\.(?:css|js))(?:\?v=[0-9a-f]+)?(")')


def fingerprint(path):
    # Ignore line endings so Windows checkouts and GitHub agree on the fingerprint
    with open(path, "rb") as f:
        return hashlib.sha1(f.read().replace(b"\r\n", b"\n")).hexdigest()[:8]


for page in sorted(glob.glob("*.html")):
    with open(page, encoding="utf-8") as f:
        html = f.read()
    new = pattern.sub(lambda m: f"{m.group(1)}{m.group(2)}?v={fingerprint(m.group(2))}{m.group(3)}", html)
    if new != html:
        with open(page, "w", encoding="utf-8") as f:
            f.write(new)
        print(f"stamped {page}")
