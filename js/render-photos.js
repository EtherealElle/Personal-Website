// Builds the gallery grid, the home page reel, and the detail photo from data/gallery.json
// (edited through Pages CMS). js/main.js and js/gallery.js wait on window.photosReady so
// the scroll animations and filters see the photos once they are on the page.
window.photosReady = fetch("data/gallery.json")
  .then((res) => (res.ok ? res.json() : {}))
  .catch(() => ({}))
  .then(render);

function render(data) {
  const DIR = "images/work/";
  const photos = (data.photos || []).filter((p) => p && (p.image || p.title));
  // Pages CMS saves "/images/work/name.jpg"; older entries may be a bare file name
  const src = (path) => (!path ? "" : path.includes("/") ? path.replace(/^\//, "") : DIR + path);

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

  // Photos load lazily (only as they near the screen) unless eager is set.
  function addImage(el, file, alt, { fallback = "Project photo", parallax, eager = false, priority = false, w, h, deferred = false } = {}) {
    if (!file) return placeholder(el, fallback);
    const img = new Image();
    img.decoding = "async";
    img.loading = eager ? "eager" : "lazy";
    if (priority) img.fetchPriority = "high";
    // Reserve the photo's shape before it loads. New uploads may not have their size recorded
    // yet, so assume 4:3 until the real size is known.
    img.width = w || 4; img.height = h || 3;
    if (!(w && h)) img.addEventListener("load", () => { img.width = img.naturalWidth; img.height = img.naturalHeight; }, { once: true });
    img.alt = alt || "Project photo";
    if (parallax) img.dataset.parallax = parallax;
    img.onerror = () => placeholder(el, fallback);
    // deferred photos get their src later from loadWhenNear()
    if (deferred) img.dataset.src = src(file);
    else img.src = src(file);
    el.innerHTML = "";
    el.classList.add("has-img");
    el.appendChild(img);
  }

  // Tighter than the browser's built-in lazy loading, which fetches photos far
  // ahead of the screen and slows the first one down on phone connections.
  function loadWhenNear(imgs) {
    const load = (img) => { img.src = img.dataset.src; img.removeAttribute("data-src"); };
    if (!("IntersectionObserver" in window)) return imgs.forEach(load);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { load(e.target); io.unobserve(e.target); } });
    }, { rootMargin: "400px 0px" });
    imgs.forEach((img) => io.observe(img));
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
      // The first photo is on screen at load, so fetch it right away
      addImage(media, p.image, p.title, { eager: i === 0, priority: i === 0, deferred: i > 0, w: p.w, h: p.h });
      tile.append(media, caption("div", "tile__cap", p));
      grid.appendChild(tile);
    });
    loadWhenNear([...grid.querySelectorAll("img[data-src]")]);
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
      addImage(media, p.image, p.title);
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

      // The reel slides sideways inside a clipped box, which native lazy loading
      // can't see into, so fetch all its photos once the section is getting close.
      const reel = track.closest(".reel");
      if (reel && "IntersectionObserver" in window) {
        const io = new IntersectionObserver((entries) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          track.querySelectorAll("img[loading=lazy]").forEach((img) => { img.loading = "eager"; });
          io.disconnect();
        }, { rootMargin: "100% 0px" });
        io.observe(reel);
      }
    }
  }

  /* Home page detail photo */
  const detail = document.querySelector("[data-photo='detail']");
  if (detail) {
    addImage(detail, data.detailPhoto, "Close-up of finished carpentry work", {
      fallback: "Project detail photo",
      parallax: "0.08",
    });
    // placeholder fallback needs the parallax hook too
    const inner = detail.querySelector(".media__inner");
    if (inner) inner.dataset.parallax = "0.08";
  }
}
