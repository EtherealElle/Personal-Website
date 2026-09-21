(() => {
  const tiles = Array.from(document.querySelectorAll(".tile"));
  const filters = Array.from(document.querySelectorAll(".filter"));

  /* Hide filters that have no photos yet */
  filters.forEach((btn) => {
    const cat = btn.dataset.filter;
    if (cat !== "all" && !tiles.some((t) => t.dataset.cat === cat)) btn.hidden = true;
  });

  /* Filters */
  filters.forEach((btn) => {
    btn.addEventListener("click", () => {
      const cat = btn.dataset.filter;
      filters.forEach((f) => f.classList.toggle("is-active", f === btn));

      let i = 0;
      tiles.forEach((tile) => {
        const show = cat === "all" || tile.dataset.cat === cat;
        tile.classList.toggle("is-filtered", !show);
        if (!show) return;
        // replay the reveal for tiles that remain
        tile.classList.remove("is-in");
        tile.style.setProperty("--d", `${i++ * 0.06}s`);
        void tile.offsetWidth;
        requestAnimationFrame(() => tile.classList.add("is-in"));
      });
    });
  });

  /* Lightbox */
  const lb = document.querySelector(".lightbox");
  if (!lb) return;
  lb.hidden = false;
  const lbMedia = lb.querySelector(".lightbox__media");
  const [lbTitle, lbPlace] = lb.querySelectorAll(".lightbox__cap span");
  let current = -1;
  let lastFocus = null;

  const visible = () => tiles.filter((t) => !t.classList.contains("is-filtered"));

  function show(tile) {
    const list = visible();
    current = list.indexOf(tile);
    lbMedia.innerHTML = "";
    const media = tile.querySelector(".media").cloneNode(true);
    const img = media.querySelector("img[data-src]"); // photo not scrolled to yet
    if (img) { img.src = img.dataset.src; img.removeAttribute("data-src"); }
    lbMedia.appendChild(media);
    const caps = tile.querySelectorAll(".tile__cap span");
    lbTitle.textContent = caps[0]?.textContent || "";
    lbPlace.textContent = caps[1]?.textContent || "";
  }

  function open(tile) {
    lastFocus = document.activeElement;
    show(tile);
    lb.classList.add("is-open");
    document.body.style.overflow = "hidden";
    lb.querySelector(".lightbox__close").focus();
  }

  function close() {
    lb.classList.remove("is-open");
    document.body.style.overflow = "";
    lastFocus?.focus();
  }

  function step(dir) {
    const list = visible();
    if (!list.length) return;
    show(list[(current + dir + list.length) % list.length]);
  }

  tiles.forEach((tile) => tile.addEventListener("click", () => open(tile)));
  lb.querySelector(".lightbox__close").addEventListener("click", close);
  lb.querySelector(".lightbox__nav--prev").addEventListener("click", () => step(-1));
  lb.querySelector(".lightbox__nav--next").addEventListener("click", () => step(1));
  lb.addEventListener("click", (e) => { if (e.target === lb) close(); });

  document.addEventListener("keydown", (e) => {
    if (!lb.classList.contains("is-open")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  });
})();
