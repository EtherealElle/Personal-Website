/* Design picks — a private, temporary tournament (picks.html).
   Photos come from js/picks-data.js, generated from images/picks/ by
   scripts/build_picks.py. Progress is kept in this browser so a closed tab
   doesn't lose anything. Deleting this file and css/picks.css removes the
   feature without touching the rest of the site. */
(() => {
  const ROUNDS = (window.PICKS && Array.isArray(window.PICKS.rounds) ? window.PICKS.rounds : [])
    .filter((r) => r.options && r.options.length);
  const STORE = "cvb-picks-v1";
  const FORMSPREE = "https://formspree.io/f/xvkgglnj";
  const PHONE = "4703019576";
  const CHEERS = ["Ooh, nice.", "Good eye.", "Noted!", "Love that one.", "Solid choice.",
    "Tough call!", "Yes, that one.", "Great taste.", "Locked in."];

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const screens = { intro: $("#screen-intro"), game: $("#screen-game"), results: $("#screen-results") };
  const cards = $$(".card");
  const arena = $(".arena");

  const TOTAL = ROUNDS.reduce((n, r) => n + Math.max(0, r.options.length - 1), 0);
  const SIG = ROUNDS.map((r) => `${r.id}:${r.options.length}:${r.options[0].src}`).join("|");

  // Name from the link, e.g. /picks?for=Jess
  const params = new URLSearchParams(location.search);
  const invited = (params.get("for") || "").replace(/[<>]/g, "").trim().slice(0, 40);

  let state = null;
  let history = [];

  /* ---------------------------------------------------------------- state */
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  function freshState() {
    return {
      sig: SIG,
      who: invited,
      ti: 0,
      done: 0,
      finished: false,
      notes: {},
      topics: ROUNDS.map((r) => ({
        id: r.id,
        pool: shuffle(r.options.map((_, i) => i)),
        next: [],
        i: 0,
        round: 1,
        champion: null,
        runnerUp: null,
      })),
    };
  }

  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch {} };
  const load = () => { try { return JSON.parse(localStorage.getItem(STORE) || "null"); } catch { return null; } };
  const clear = () => { try { localStorage.removeItem(STORE); } catch {} };

  /* ------------------------------------------------------------- bracket */
  // Walks a topic to the next real matchup, handing byes to the next round.
  function matchIn(t) {
    if (t.champion !== null) return null;
    for (let guard = 0; guard < 200; guard++) {
      if (t.i + 1 < t.pool.length) return [t.pool[t.i], t.pool[t.i + 1]];
      if (t.i < t.pool.length) { t.next.push(t.pool[t.i]); t.i++; continue; }
      if (t.next.length <= 1) { t.champion = t.next.length ? t.next[0] : t.pool[0]; return null; }
      t.pool = t.next; t.next = []; t.i = 0; t.round++;
    }
    return null;
  }

  function current() {
    while (state.ti < state.topics.length) {
      const t = state.topics[state.ti];
      const pair = matchIn(t);
      if (pair) return { t, round: ROUNDS[state.ti], pair };
      state.ti++;
    }
    return null;
  }

  function contendersLeft(t) {
    return (t.pool.length - t.i) + t.next.length;
  }

  /* -------------------------------------------------------------- screens */
  function show(name) {
    Object.entries(screens).forEach(([key, el]) => { el.hidden = key !== name; });
    window.scrollTo(0, 0);
  }

  /* ----------------------------------------------------------------- intro */
  function setupIntro() {
    const saved = load();
    const resumable = saved && saved.sig === SIG && (saved.done > 0 || saved.finished);
    const hello = $("[data-hello]");
    if (invited) { hello.textContent = `Made for ${invited}`; hello.hidden = false; }

    $("[data-stat]").innerHTML = ROUNDS.length
      ? `<b>${ROUNDS.length}</b> ${ROUNDS.length === 1 ? "thing" : "things"} to decide · <b>${TOTAL}</b> quick taps`
      : "";

    if (!ROUNDS.length) {
      $("[data-empty]").hidden = false;
      $("[data-start]").disabled = true;
    }
    $("[data-resume]").hidden = !resumable;

    $("[data-start]").addEventListener("click", () => {
      clear();
      state = freshState();
      history = [];
      save();
      render();
    });

    $("[data-resume]").addEventListener("click", () => {
      state = saved;
      if (invited) state.who = invited;
      history = [];
      render();
    });
  }

  /* ------------------------------------------------------------ the game */
  let busy = false;

  function render() {
    const cur = current();
    if (!cur) return finish();

    show("game");
    const { t, round, pair } = cur;
    $("[data-topic]").textContent = round.title;
    const left = contendersLeft(t);
    $("[data-round]").textContent = left === 2 ? "Final" : `Round ${t.round}`;
    $("[data-count]").textContent = `${Math.min(state.done + 1, TOTAL)} / ${TOTAL}`;
    $("[data-progress]").style.width = `${(state.done / Math.max(TOTAL, 1)) * 100}%`;
    $("[data-undo]").disabled = history.length === 0;

    cards.forEach((card, side) => {
      const opt = round.options[pair[side]];
      const img = $("[data-img]", card);
      card.classList.remove("is-won", "is-lost");
      img.src = opt.src;
      img.alt = opt.label || `Option ${side === 0 ? "A" : "B"}`;
      if (opt.w && opt.h) { img.width = opt.w; img.height = opt.h; }
      $("[data-badge]", card).textContent = side === 0 ? "A" : "B";
      $("[data-label]", card).textContent = opt.label || "";
    });

    // let the pair animate in
    arena.classList.remove("is-fresh");
    void arena.offsetWidth;
    arena.classList.add("is-fresh");

    preload(round);
    busy = false;
    save();
  }

  const preloaded = new Set();
  function preload(round) {
    round.options.forEach((o) => {
      if (preloaded.has(o.src)) return;
      preloaded.add(o.src);
      const im = new Image();
      im.src = o.src;
    });
  }

  function choose(side) {
    if (busy) return;
    const cur = current();
    if (!cur) return;
    busy = true;

    history.push(JSON.stringify(state));
    if (history.length > 30) history.shift();

    const { t, pair } = cur;
    const winner = pair[side];
    t.runnerUp = pair[1 - side];   // the last loser of a topic is its runner-up
    t.next.push(winner);
    t.i += 2;
    state.done++;
    save();

    cards[side].classList.add("is-won");
    cards[1 - side].classList.add("is-lost");
    const cheer = $("[data-cheer]");
    cheer.textContent = CHEERS[Math.floor(Math.random() * CHEERS.length)];
    cheer.classList.remove("is-pop");
    void cheer.offsetWidth;
    cheer.classList.add("is-pop");

    setTimeout(() => {
      cheer.textContent = "Tap the one you like more";
      render();
    }, reduceMotion ? 80 : 620);
  }

  function undo() {
    if (!history.length) return;
    state = JSON.parse(history.pop());
    save();
    busy = false;
    render();
  }

  /* ---------------------------------------------------------- the results */
  const stemOf = (src) => {
    try { return decodeURIComponent(src.split("/").pop()).replace(/\.[^.]+$/, ""); }
    catch { return "photo"; }
  };

  // Photos straight off a camera have no meaningful name, so the screen just says
  // "Your pick" next to the photo, while the email gets the file name to go find.
  function nameOf(round, idx, forText) {
    if (idx === null || idx === undefined) return "";
    const opt = round.options[idx];
    if (!opt) return "";
    if (opt.label) return opt.label;
    return forText ? stemOf(opt.src) : "Your pick";
  }

  function finish() {
    state.finished = true;
    save();
    show("results");

    const list = $("[data-winners]");
    list.innerHTML = "";
    state.topics.forEach((t, i) => {
      const round = ROUNDS[i];
      if (!round || t.champion === null || t.champion === undefined) return;
      const win = round.options[t.champion];
      const li = document.createElement("li");
      li.className = "winner";
      li.innerHTML = `
        <span class="winner__pic"><img alt="" src="${win.src}"></span>
        <div>
          <span class="winner__topic">${escapeHtml(round.title)}</span>
          <h3 class="winner__name">${escapeHtml(nameOf(round, t.champion))}</h3>
          <input class="winner__note" type="text" placeholder="Add a note (optional)" data-note="${escapeHtml(round.id)}">
        </div>`;
      const note = $("[data-note]", li);
      note.value = state.notes[round.id] || "";
      note.addEventListener("input", () => { state.notes[round.id] = note.value.slice(0, 200); save(); });
      list.appendChild(li);
    });

    $("[data-name-field]").hidden = !!state.who;
    if (state.who) $("[data-done-note]").textContent =
      `Nice work, ${state.who}. Add a note to anything you want to explain, then send them over.`;

    burst();
  }

  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function summary() {
    const lines = [];
    state.topics.forEach((t, i) => {
      const round = ROUNDS[i];
      if (!round || t.champion === null || t.champion === undefined) return;
      const win = round.options[t.champion];
      let line = `${round.title}: ${nameOf(round, t.champion, true)}`;
      if (t.runnerUp !== null && t.runnerUp !== undefined && t.runnerUp !== t.champion) {
        line += ` (runner-up: ${nameOf(round, t.runnerUp, true)})`;
      }
      line += `\n    ${win.src}`;
      const note = (state.notes[round.id] || "").trim();
      if (note) line += `\n    Note: ${note}`;
      lines.push(line);
    });
    return lines.join("\n\n");
  }

  function shortSummary() {
    return state.topics.map((t, i) => {
      const round = ROUNDS[i];
      if (!round || t.champion === null || t.champion === undefined) return null;
      return `${round.title}: ${nameOf(round, t.champion, true)}`;
    }).filter(Boolean).join("; ");
  }

  function setupResults() {
    const form = $("[data-send]");
    const status = $("[data-status]");
    const sms = $("[data-sms]");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const typed = (form.who && form.who.value || "").trim();
      const who = state.who || typed;
      if (!who) { status.textContent = "Add your name first so I know whose picks these are."; form.who.focus(); return; }
      state.who = who;
      save();

      const body = new FormData();
      body.set("_subject", `Design picks from ${who}`);
      body.set("who", who);
      body.set("picks", summary());
      const btn = $("button[type=submit]", form);
      btn.disabled = true;
      status.textContent = "Sending…";
      try {
        const res = await fetch(FORMSPREE, { method: "POST", body, headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(res.status);
        status.textContent = "Sent! Cleo has your picks. Thank you!";
        burst();
      } catch {
        status.textContent = "That didn't go through. Send them by text instead:";
        sms.href = `sms:${PHONE}?&body=${encodeURIComponent(`My design picks — ${shortSummary()}`)}`;
        sms.hidden = false;
        btn.disabled = false;
      }
    });

    $("[data-restart]").addEventListener("click", () => {
      clear();
      state = freshState();
      history = [];
      status.textContent = "";
      sms.hidden = true;
      $("button[type=submit]", form).disabled = false;   // re-arm after a send
      render();
    });
  }

  /* ------------------------------------------------------------- confetti */
  function burst() {
    if (reduceMotion) return;
    const box = $(".confetti");
    const colors = ["#f4b8c9", "#fbe3ea", "#b85a7c", "#f7f2f1"];
    for (let i = 0; i < 44; i++) {
      const bit = document.createElement("i");
      bit.style.left = `${Math.random() * 100}%`;
      bit.style.background = colors[i % colors.length];
      bit.style.animationDuration = `${2.2 + Math.random() * 1.8}s`;
      bit.style.animationDelay = `${Math.random() * 0.6}s`;
      bit.style.transform = `scale(${0.6 + Math.random() * 0.8})`;
      box.appendChild(bit);
      setTimeout(() => bit.remove(), 5200);
    }
  }

  /* ----------------------------------------------------------------- wire */
  cards.forEach((card, side) => card.addEventListener("click", () => choose(side)));
  $("[data-undo]").addEventListener("click", undo);
  document.addEventListener("keydown", (e) => {
    if (screens.game.hidden) return;
    if (e.key === "ArrowLeft" || e.key === "1") choose(0);
    if (e.key === "ArrowRight" || e.key === "2") choose(1);
  });

  setupIntro();
  setupResults();
  show("intro");
})();
