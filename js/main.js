// Pages with a photo list wait for it so reveals and the reel measure the real content
(window.photosReady || Promise.resolve()).then(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ------------------------------------------------------------------
     Page transition curtain
     ------------------------------------------------------------------ */
  const curtain = document.querySelector(".curtain");
  // Two frames so the curtain is painted once before it slides away
  const liftCurtain = () => curtain && requestAnimationFrame(() => requestAnimationFrame(() => {
    curtain.classList.remove("is-down");
    curtain.classList.add("is-up");
  }));
  // Lift as soon as the page is ready to show; photos keep loading underneath.
  liftCurtain();
  window.addEventListener("pageshow", (e) => { if (e.persisted) liftCurtain(); });

  document.addEventListener("click", (e) => {
    const link = e.target.closest("a[href]");
    if (!link || !curtain || reduceMotion) return;
    const url = new URL(link.href, location.href);
    const internal = url.protocol === location.protocol && url.origin === location.origin && !link.target && !link.hasAttribute("download");
    const samePage = url.pathname === location.pathname && url.hash;
    if (!internal || samePage || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    curtain.classList.remove("is-up");
    curtain.classList.add("is-down");
    setTimeout(() => { location.href = link.href; }, 600);
  });

  /* ------------------------------------------------------------------
     Navigation
     ------------------------------------------------------------------ */
  const nav = document.querySelector(".nav");
  const toggle = document.querySelector(".nav__toggle");
  toggle?.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  /* ------------------------------------------------------------------
     Split text into words for staggered reveals
     ------------------------------------------------------------------ */
  $$(".split").forEach((el) => {
    let i = 0;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
            const w = document.createElement("span");
            w.className = "w";
            const inner = document.createElement("span");
            inner.style.setProperty("--i", i++);
            inner.textContent = part;
            w.appendChild(inner);
            frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && child.tagName !== "BR") {
          walk(child);
        }
      });
    };
    walk(el);
  });

  // Statement: words light up with scroll
  const statement = document.querySelector(".statement__text");
  let statementWords = [];
  if (statement) {
    statement.innerHTML = statement.textContent.trim().split(/\s+/)
      .map((w) => `<span class="word">${w}</span>`).join(" ");
    statementWords = $$(".word", statement);
  }

  /* ------------------------------------------------------------------
     Reveal on enter
     ------------------------------------------------------------------ */
  $$("[data-stagger]").forEach((group) => {
    const step = parseFloat(group.dataset.stagger) || 0.08;
    Array.from(group.children).forEach((child, i) => {
      child.style.setProperty("--d", `${i * step}s`);
    });
  });

  const revealables = $$("[data-reveal], .split, [data-wipe]");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
    revealables.forEach((el) => {
      // anything already on screen at load reveals right away
      if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add("is-in");
      else io.observe(el);
    });
  } else {
    revealables.forEach((el) => el.classList.add("is-in"));
  }

  /* ------------------------------------------------------------------
     Counters
     ------------------------------------------------------------------ */
  const counters = $$("[data-count]");
  const countIO = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseFloat(el.dataset.count);
      const start = performance.now();
      const dur = reduceMotion ? 1 : 1800;
      const tick = (now) => {
        const t = clamp((now - start) / dur);
        const eased = 1 - Math.pow(1 - t, 4);
        el.textContent = Math.round(target * eased);
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      countIO.unobserve(el);
    });
  }, { threshold: 0.6 });
  counters.forEach((el) => countIO.observe(el));

  /* ------------------------------------------------------------------
     Story: pinned drawing, layers draw as you scroll
     ------------------------------------------------------------------ */
  const story = document.querySelector(".story");
  const storySteps = story ? $$(".story__step", story) : [];
  const storyDots = story ? $$(".story__dots span", story) : [];
  const storyLayers = story ? $$("[data-layer]", story).map((layer) => {
    const shapes = $$("path, line, rect, polyline", layer).map((shape) => {
      const len = shape.getTotalLength ? shape.getTotalLength() : 1000;
      shape.style.strokeDasharray = len;
      shape.style.strokeDashoffset = len;
      return { shape, len };
    });
    return { layer, shapes, index: parseInt(layer.dataset.layer, 10) };
  }) : [];

  function updateStory(vh) {
    const rect = story.getBoundingClientRect();
    const total = rect.height - vh;
    const p = clamp(-rect.top / total);
    const count = storySteps.length;
    const active = Math.min(count - 1, Math.floor(p * count));

    storySteps.forEach((step, i) => {
      step.classList.toggle("is-active", i === active);
      step.classList.toggle("is-past", i < active);
    });
    storyDots.forEach((dot, i) => dot.classList.toggle("is-active", i <= active));

    storyLayers.forEach(({ layer, shapes, index }) => {
      // each layer draws across the first 80% of its chapter
      const lp = clamp((p * count - index) / 0.8);
      const n = shapes.length;
      shapes.forEach(({ shape, len }, i) => {
        const sp = clamp(lp * n - i * 0.85);
        shape.style.strokeDashoffset = len * (1 - sp);
      });
      layer.style.opacity = clamp(lp * 3);
    });
  }

  /* ------------------------------------------------------------------
     Horizontal reel
     ------------------------------------------------------------------ */
  const reel = document.querySelector(".reel");
  const reelTrack = reel?.querySelector(".reel__track");
  const reelBar = reel?.querySelector(".reel__bar i");
  const reelCount = reel?.querySelector("[data-reel-count]");
  const reelItems = reelTrack ? reelTrack.querySelectorAll(".reel__item:not(.reel__more)").length : 0;

  function updateReel(vh) {
    const rect = reel.getBoundingClientRect();
    const p = clamp(-rect.top / (rect.height - vh));
    // scrollWidth ignores the track's right padding, so measure to the last item instead
    const last = reelTrack.lastElementChild;
    const padRight = parseFloat(getComputedStyle(reelTrack).paddingRight) || 0;
    const distance = Math.max(0, last.offsetLeft + last.offsetWidth + padRight - window.innerWidth);
    reelTrack.style.transform = `translate3d(${-distance * p}px,0,0)`;
    if (reelBar) reelBar.style.transform = `scaleX(${p})`;
    if (reelCount) {
      const n = Math.min(reelItems, Math.floor(p * reelItems) + 1);
      reelCount.textContent = `${String(n).padStart(2, "0")} / ${String(reelItems).padStart(2, "0")}`;
    }
  }

  /* ------------------------------------------------------------------
     Marquees — drift continuously, speed up with scroll velocity
     ------------------------------------------------------------------ */
  const marquees = $$(".marquee").map((el) => {
    const group = el.querySelector(".marquee__group");
    el.appendChild(group.cloneNode(true)).setAttribute("aria-hidden", "true");
    return { el, group, x: 0, dir: el.dataset.dir === "right" ? 1 : -1 };
  });

  /* ------------------------------------------------------------------
     Scroll loop
     ------------------------------------------------------------------ */
  const progress = document.querySelector(".progress");
  const heroContent = document.querySelector(".hero__content");
  const parallax = $$("[data-parallax]");
  let lastY = window.scrollY;
  let velocity = 0;

  function frame() {
    const y = window.scrollY;
    const vh = window.innerHeight;
    const delta = y - lastY;
    velocity += (delta - velocity) * 0.1;

    if (progress) {
      const max = document.documentElement.scrollHeight - vh;
      progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    }

    if (nav) {
      nav.classList.toggle("is-scrolled", y > 40);
      if (!nav.classList.contains("is-open") && Math.abs(delta) > 2) {
        nav.classList.toggle("is-hidden", delta > 0 && y > vh * 0.6);
      }
    }

    if (heroContent && !reduceMotion && y < vh * 1.2) {
      const t = y / vh;
      heroContent.style.transform = `translate3d(0, ${t * -120}px, 0)`;
      heroContent.style.opacity = String(1 - t * 1.1);
    }

    if (statementWords.length) {
      const r = statement.getBoundingClientRect();
      const p = clamp((vh * 0.85 - r.top) / (r.height + vh * 0.35));
      const lit = Math.floor(p * statementWords.length);
      statementWords.forEach((w, i) => w.classList.toggle("is-lit", i < lit));
    }

    if (story) updateStory(vh);
    if (reel && reelTrack) updateReel(vh);

    if (!reduceMotion) {
      parallax.forEach((el) => {
        const r = el.parentElement.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;
        const speed = parseFloat(el.dataset.parallax) || 0.1;
        const offset = (r.top + r.height / 2 - vh / 2) * speed;
        el.style.transform = `translate3d(0, ${offset}px, 0) scale(1.15)`;
      });

      marquees.forEach((m) => {
        const w = m.group.offsetWidth;
        m.x += (0.6 + Math.abs(velocity) * 0.35) * m.dir;
        if (m.x <= -w) m.x += w;
        if (m.x > 0) m.x -= w;
        m.el.style.transform = `translate3d(${m.x}px,0,0)`;
      });
    }

    lastY = y;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ------------------------------------------------------------------
     Misc
     ------------------------------------------------------------------ */
  $$("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });
});
