// Builds the gallery grid, the home page reel, and the detail photo from js/photos.js.
// Must load before js/main.js so the scroll animations pick up the new elements.
(() => {
  const DIR = "images/work/";
  const photos = (window.PHOTOS || []).filter((p) => p && (p.file || p.title));

  function placeholder(el, label = "Project photo") {
    el.classList.remove("has-img");
    el.innerHTML = "";
    const inner = document.createElement("div");
    inner.className = "media__inner";
    const span = document.createElement("span");
    span.className = "media__label";
    span.textContent = label;
    el.append(inner, span);
  }

  function addImage(el, file, alt, { fallback = "Project photo", parallax } = {}) {
    if (!file) return placeholder(el, fallback);
    const img = new Image();
    img.decoding = "async";
    img.alt = alt || "Project photo";
    if (parallax) img.dataset.parallax = parallax;
    img.onerror = () => placeholder(el, fallback);
    img.src = DIR + file;
    el.innerHTML = "";
    el.classList.add("has-img");
    el.appendChild(img);
  }

  function caption(tag, cls, p) {
    const cap = document.createElement(tag);
    cap.className = cls;
    const a = document.createElement("span");
    a.textContent = p.title || "";
    const b = document.createElement("span");
    b.textContent = p.town || "";
    cap.append(a, b);
    return cap;
  }

  /* Gallery page */
  const grid = document.querySelector("[data-photos='gallery']");
  if (grid) {
    const shapes = ["tall", "wide", "square"];
    photos.forEach((p, i) => {
      const tile = document.createElement("button");
      tile.className = `tile tile--${shapes[i % shapes.length]}`;
      tile.dataset.cat = (p.type || "").toLowerCase();
      tile.setAttribute("data-reveal", "");
      const media = document.createElement("div");
      media.className = "media";
      addImage(media, p.file, p.title);
      tile.append(media, caption("div", "tile__cap", p));
      grid.appendChild(tile);
    });
    if (!photos.length) {
      grid.insertAdjacentHTML("beforebegin", '<p class="gallery-empty">Photos coming soon.</p>');
    }
  }

  /* Home page "Selected work" reel */
  const track = document.querySelector("[data-photos='featured']");
  if (track) {
    let picks = photos.filter((p) => p.featured);
    if (!picks.length) picks = photos;
    picks.slice(0, 6).forEach((p) => {
      const fig = document.createElement("figure");
      fig.className = "reel__item";
      fig.style.margin = "0";
      const media = document.createElement("div");
      media.className = "media media--dark";
      addImage(media, p.file, p.title);
      fig.append(media, caption("figcaption", "reel__cap", p));
      track.appendChild(fig);
    });
    if (!track.children.length) {
      track.closest(".reel")?.remove();
    } else {
      // Final tile linking to the full gallery
      const more = document.createElement("a");
      more.href = "gallery.html";
      more.className = "reel__item reel__more";
      more.innerHTML = `
        <span class="reel__more-box">
          <span class="reel__more-count">${photos.length} projects</span>
          <span class="reel__more-title">See all<br><em>my work</em></span>
          <span class="reel__more-arrow" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </span>
        </span>
        <span class="reel__cap"><span>Full gallery</span><span>View all</span></span>`;
      track.appendChild(more);
    }
  }

  /* Home page detail photo */
  const detail = document.querySelector("[data-photo='detail']");
  if (detail) {
    addImage(detail, window.DETAIL_PHOTO, "Close-up of finished carpentry work", {
      fallback: "Project detail photo",
      parallax: "0.08",
    });
    // placeholder fallback needs the parallax hook too
    const inner = detail.querySelector(".media__inner");
    if (inner) inner.dataset.parallax = "0.08";
  }
})();
