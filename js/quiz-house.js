/* The design quiz as a walk through one house.

   Every question has its spot in the house: the porch columns from the front walk, the
   porch ceiling, then in through the front door to the dining room, round the living
   room, down the hall, out onto the deck and into the yard. Each style is a still,
   rendered in Blender with real daylight (scripts/house/), and the walk between two
   neighbouring spots is a short video. Scrolling to a question walks you there;
   choosing a style changes it in place; at the end you can walk round your picks.

   Questions are visited in the house's order, whatever order the link names them in,
   so every move is a walk between neighbours. The manifest (data/house.json) lists
   the stills, the walks, and a fingerprint for each so an old copy is never reused.
   The link format and catalog are shared with the builder (js/quiz-core.js). */
(function () {
  "use strict";

  var FORMSPREE = "https://formspree.io/f/xvkgglnj";
  var PHONE = "4703019576";
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  var house = null;                       // the manifest
  var items = [], byId = {}, name = "";
  var answers = {};
  var mode = "story";                     // or "explore"

  // ------------------------------------------------------------ the stage

  var stage = $("[data-stage]");
  var layers = [$("[data-still-a]"), $("[data-still-b]")];
  var front = 0;                          // which still layer is showing
  var video = $("[data-walk]");
  var photo = $("[data-photo]");
  var at = null;                          // the station the camera is at
  var goal = null;                        // where it's headed
  var walking = false;
  var shown = {};                         // station -> image URL currently meant to be on screen

  function stillURL(q, o) {
    var s = house.stills[q];
    return s && s[o] ? s[o] : null;
  }

  function load(url) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.decoding = "async";
      img.onload = img.onerror = function () { resolve(url); };
      img.src = url;
    });
  }

  /** Cross-fade the stage to a still. */
  function showStill(url, ms) {
    return load(url).then(function () {
      var cur = layers[front];
      if (cur.getAttribute("src") === url && cur.classList.contains("is-on")) return;
      var next = layers[1 - front];
      next.style.transitionDuration = (reduce ? 0 : ms == null ? 450 : ms) + "ms";
      cur.style.transitionDuration = next.style.transitionDuration;
      next.src = url;
      next.classList.add("is-on");
      cur.classList.remove("is-on");
      front = 1 - front;
      resetPan();
    });
  }

  // The walks: one clip per pair of neighbours, forwards and backwards. Fetched whole
  // (a couple of MB each) so they start the instant they're asked for.
  var clips = {};                         // url -> Promise<objectURL|null>
  function clip(url) {
    if (!clips[url]) {
      clips[url] = fetch(url).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.blob();
      }).then(function (b) { return URL.createObjectURL(b); }).catch(function () { return null; });
    }
    return clips[url];
  }

  function segment(a, b) {
    var i = house.route.indexOf(a), j = house.route.indexOf(b);
    if (i < 0 || j < 0 || Math.abs(i - j) !== 1) return null;
    var w = house.walks[Math.min(i, j)];
    return i < j ? w.forward : w.back;
  }

  function stepToward(from, to) {
    var i = house.route.indexOf(from), j = house.route.indexOf(to);
    return house.route[i + (j > i ? 1 : -1)];
  }

  function playClip(url, rate) {
    return clip(url).then(function (src) {
      if (!src) return false;
      return new Promise(function (resolve) {
        var done = false;
        function finish(ok) {
          if (done) return;
          done = true;
          video.onended = video.onerror = null;
          resolve(ok);
        }
        video.onended = function () { finish(true); };
        video.onerror = function () { finish(false); };
        video.src = src;
        video.playbackRate = rate;
        var p = video.play();
        if (p && p.catch) p.catch(function () { finish(false); });   // low power mode, etc.
        video.classList.add("is-on");
        setTimeout(function () { finish(true); }, 8000 / rate);
      });
    });
  }

  /** Walk from wherever the camera is to `to`, a station at a time, then show `url`. */
  function walkTo(to, url) {
    goal = to;
    shown[to] = url;
    if (walking) return;                  // the walk under way will pick up the new goal
    walking = true;
    (async function () {
      try {
        while (at && goal && at !== goal) {
          var steps = Math.abs(house.route.indexOf(goal) - house.route.indexOf(at));
          if (reduce || steps > 4 || house.route.indexOf(at) < 0 || house.route.indexOf(goal) < 0) break;
          var next = stepToward(at, goal);
          var seg = segment(at, next);
          var rate = Math.min(2.6, 1 + 0.55 * (steps - 1));
          var ok = seg ? await playClip(seg, rate) : false;
          if (!ok) break;
          at = next;
          // the clip's last frame is the house as built; settle onto this station's
          // still (the client's pick) only if this is where we're stopping
          if (at !== goal) prefetchAround(at);
        }
        var dest = goal;
        at = dest;
        // the still goes in under the video's last frame, and the video fades off it
        var over = video.classList.contains("is-on");
        await showStill(shown[dest], over ? 0 : 380);
        video.classList.remove("is-on");
        setTimeout(function () { if (!walking) video.pause(); }, 500);
        prefetchAround(dest);
      } finally {
        walking = false;
        if (goal && goal !== at) walkTo(goal, shown[goal]);
      }
    })();
  }

  var prefetched = {};
  function prefetchAround(q) {
    var i = house.route.indexOf(q);
    [i + 1, i - 1].forEach(function (j) {
      var n = house.route[j];
      if (!n || !byId[n]) return;
      var seg = segment(q, n);
      if (seg && !prefetched[seg]) { prefetched[seg] = true; clip(seg); }
      var o = shownOption(byId[n]);
      var u = stillURL(n, o.id);
      if (u && !prefetched[u]) { prefetched[u] = true; load(u); }
    });
  }

  /** Bring a question's spot into view, with its current style in it. */
  function show(item, instant) {
    var q = item.question.id;
    var opt = shownOption(item);
    var url = stillURL(q, opt.id);
    if (!url) {
      // a style that's a photo, not a render: framed over its spot in the house
      $("img", photo).src = opt.image;
      photo.hidden = false;
      var base = stillURL(q, Object.keys(house.stills[q] || {})[0]);
      if (base) { at = q; return showStill(base, instant ? 0 : 380); }
      return Promise.resolve();
    }
    photo.hidden = true;
    if (instant || !at || at === q) {
      at = q;
      goal = q;
      shown[q] = url;
      return showStill(url, instant ? 0 : 320).then(function () { prefetchAround(q); });
    }
    walkTo(q, url);
    return Promise.resolve();
  }

  // ------------------------------------------------------------ looking around
  // The stills are square; a screen shows only part of one. Dragging slides it, so the
  // rest of the room is there to see.

  var pan = { x: 0, y: 0 };
  function bounds() {
    // how far the showing layer can slide before an edge comes into view
    var r = layers[front].getBoundingClientRect();
    var l = r.left - pan.x, t = r.top - pan.y;
    return { x0: -(r.width + l - innerWidth), x1: -l, y0: -(r.height + t - innerHeight), y1: -t };
  }
  function applyPan() {
    var t = "translate(" + pan.x + "px," + pan.y + "px)";
    layers.forEach(function (l) { l.style.transform = t; });
  }
  function resetPan() { pan.x = pan.y = 0; applyPan(); }
  (function () {
    var start = null;
    stage.addEventListener("pointerdown", function (e) {
      if (mode !== "explore") return;
      start = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
      stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener("pointermove", function (e) {
      if (!start) return;
      var b = bounds();
      pan.x = Math.max(b.x0, Math.min(b.x1, start.px + e.clientX - start.x));
      pan.y = Math.max(b.y0, Math.min(b.y1, start.py + e.clientY - start.y));
      applyPan();
    });
    ["pointerup", "pointercancel"].forEach(function (t) {
      stage.addEventListener(t, function () { start = null; });
    });
  })();

  // ------------------------------------------------------------ answers

  var KEY = "quizhouse:" + location.search;
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(answers)); } catch (e) { /* private mode */ } }
  function restore() { try { answers = JSON.parse(sessionStorage.getItem(KEY) || "{}") || {}; } catch (e) { answers = {}; } }
  function answer(qid) { return answers[qid] || (answers[qid] = { pick: null, note: "" }); }

  /** The style a question's spot should show: their pick, or the first one offered. */
  function shownOption(item) {
    var a = answers[item.question.id];
    var picked = a && a.pick && a.pick !== "none" && item.options.find(function (o) { return o.id === a.pick; });
    return picked || item.options[0];
  }

  function pickedLabel(item) {
    var a = answers[item.question.id];
    if (!a || !a.pick) return null;
    if (a.pick === "none") return "None of these";
    var o = item.options.find(function (x) { return x.id === a.pick; });
    return o ? o.label : null;
  }

  // ------------------------------------------------------------ the page

  function section(item, i) {
    var q = item.question;
    var sec = document.createElement("section");
    sec.className = "q";
    sec.dataset.q = q.id;
    sec.innerHTML =
      '<div class="panel">' +
      '<span class="q__step"></span>' +
      '<h2 class="q__title"></h2>' +
      '<p class="q__note"></p>' +
      '<div class="chips" role="group"></div>' +
      '<p class="q__showing" aria-live="polite"></p>' +
      '<div class="q__row">' +
      '<button class="none" type="button" aria-pressed="false">None of these are quite right</button>' +
      '<button class="link q__notebtn" type="button">+ Add a note</button>' +
      "</div>" +
      '<label class="field" hidden><span>Your note</span>' +
      '<textarea rows="3" maxlength="500" placeholder="Anything you like or don\'t, or what you\'d change"></textarea></label>' +
      '<button class="q__next" type="button"></button>' +
      "</div>";
    $(".q__step", sec).textContent = (i + 1) + " of " + items.length;
    $(".q__title", sec).textContent = q.title;
    var note = $(".q__note", sec);
    note.textContent = q.note;
    note.hidden = !q.note;
    $(".q__next", sec).textContent = i === items.length - 1 ? "See it all together ↓" : "Next ↓";

    var chips = $(".chips", sec);
    item.options.forEach(function (o) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.dataset.o = o.id;
      b.innerHTML = '<img alt="" loading="lazy" decoding="async"><span></span>';
      $("img", b).src = o.thumb;
      $("span", b).textContent = o.label;
      b.addEventListener("click", function () { choose(item, o.id); });
      chips.appendChild(b);
    });
    $(".none", sec).addEventListener("click", function () { choose(item, "none"); });

    var field = $(".field", sec), area = $("textarea", field), noteBtn = $(".q__notebtn", sec);
    function openNote() { field.hidden = false; noteBtn.hidden = true; }
    noteBtn.addEventListener("click", function () { openNote(); area.focus(); });
    area.addEventListener("input", function () { answer(q.id).note = area.value; save(); renderSummary(); });
    var a = answers[q.id];
    if (a && a.note) { area.value = a.note; openNote(); }

    $(".q__next", sec).addEventListener("click", function () {
      var target = sec.nextElementSibling || $("[data-finale]");
      target.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    });
    item.sec = sec;
    paint(item);
    return sec;
  }

  function paint(item) {
    var a = answers[item.question.id] || {};
    item.sec.querySelectorAll(".chip").forEach(function (b) { b.setAttribute("aria-pressed", a.pick === b.dataset.o ? "true" : "false"); });
    $(".none", item.sec).setAttribute("aria-pressed", a.pick === "none" ? "true" : "false");
    var line = $(".q__showing", item.sec);
    var cur = shownOption(item);
    if (a.pick === "none") line.innerHTML = "<strong>None of these.</strong> <span>Tell me what you'd want instead.</span>";
    else if (a.pick) { line.innerHTML = "<strong>Your pick:</strong> "; line.append(cur.label); }
    else { line.innerHTML = "<span>Showing</span> "; line.append(cur.label); line.insertAdjacentHTML("beforeend", "<span> · tap a style to choose</span>"); }
  }

  function choose(item, oid) {
    var a = answer(item.question.id);
    a.pick = oid;
    save();
    paint(item);
    if (oid === "none") {
      var field = $(".field", item.sec);
      if (field.hidden) { field.hidden = false; $(".q__notebtn", item.sec).hidden = true; $("textarea", field).focus(); }
    }
    if (current === item.sec || mode === "explore") show(item, false);
    renderSummary();
  }

  // Which section is in the middle of the screen decides where in the house we are
  var current = null;
  var watcher = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting || mode !== "story") return;
      if (e.target === current) return;
      current = e.target;
      var id = e.target.dataset.q;
      var it = id ? byId[id] : (e.target.hasAttribute("data-intro") ? items[0] : items[items.length - 1]);
      if (it) show(it, false);
    });
  }, { rootMargin: "-48% 0px -48% 0px" });

  function progress() {
    var max = document.documentElement.scrollHeight - innerHeight;
    $("[data-progress]").style.width = (max > 0 ? (scrollY / max) * 100 : 0) + "%";
  }
  addEventListener("scroll", progress, { passive: true });

  function renderSummary() {
    var list = $("[data-summary]");
    list.innerHTML = "";
    var missing = 0;
    items.forEach(function (it) {
      var li = document.createElement("li");
      var label = pickedLabel(it);
      if (!label) { li.className = "is-missing"; missing++; }
      var o = shownOption(it);
      li.innerHTML = "<img alt=''><div><small></small><strong></strong></div>";
      $("img", li).src = o.thumb;
      $("small", li).textContent = it.question.title;
      $("strong", li).textContent = label || "Not chosen yet";
      var note = (answers[it.question.id] || {}).note;
      if (note && note.trim()) { var em = document.createElement("em"); em.textContent = "“" + note.trim() + "”"; $("div", li).appendChild(em); }
      li.style.cursor = "pointer";
      li.addEventListener("click", function () { it.sec.scrollIntoView({ behavior: reduce ? "auto" : "smooth" }); });
      list.appendChild(li);
    });
    var p = $("[data-pending]");
    p.textContent = missing ? missing + " " + (missing === 1 ? "question" : "questions") + " still to choose — tap one above to go back, or send as it is." : "";
    p.hidden = !missing;
  }

  // ------------------------------------------------------------ walking round

  function roomButtons(currentId) {
    var nav = $("[data-rooms]");
    nav.innerHTML = "";
    items.forEach(function (it) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "room";
      b.innerHTML = "<small></small><strong></strong>";
      $("small", b).textContent = it.question.title;
      $("strong", b).textContent = pickedLabel(it) || shownOption(it).label;
      b.setAttribute("aria-current", it.question.id === currentId ? "true" : "false");
      b.addEventListener("click", function () { visit(it); });
      nav.appendChild(b);
    });
  }

  function visit(it) {
    roomButtons(it.question.id);
    show(it, false);
    var btn = $("[data-rooms]").children[items.indexOf(it)];
    if (btn) btn.scrollIntoView({ inline: "center", block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }

  function openExplore() {
    mode = "explore";
    document.body.classList.add("is-exploring");
    $("[data-explore]").hidden = false;
    var start = byId[at] || items[0];
    visit(start);
  }

  function closeExplore() {
    mode = "story";
    document.body.classList.remove("is-exploring");
    $("[data-explore]").hidden = true;
    resetPan();
    current = null;
    var last = items[items.length - 1];
    show(last, false);
  }

  // ------------------------------------------------------------ sending

  function summaryText() {
    return items.map(function (it) {
      var note = ((answers[it.question.id] || {}).note || "").trim();
      return it.question.title + ": " + (pickedLabel(it) || "—") + (note ? "\n    Note: " + note : "");
    }).join("\n");
  }

  function wireForm() {
    var form = $("[data-form]");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var button = $("button[type=submit]", form);
      var typed = $("input[name=client]", form);
      var who = name || (typed ? typed.value.trim() : "") || "A client";
      var extra = $("textarea[name=notes]", form).value.trim();
      button.disabled = true;
      button.textContent = "Sending…";
      var body = new FormData();
      body.append("_subject", "Design quiz — " + who);
      body.append("client", who);
      body.append("answers", summaryText());
      if (extra) body.append("anything else", extra);
      body.append("link", location.href);
      fetch(FORMSPREE, { method: "POST", body: body, headers: { Accept: "application/json" } })
        .then(function (res) {
          if (!res.ok) throw new Error("formspree");
          $("[data-sent]").hidden = false;
          button.hidden = true;
          try { sessionStorage.removeItem(KEY); } catch (err) { /* nothing saved */ }
        })
        .catch(function () {
          button.hidden = true;
          var sms = $("[data-sms]");
          sms.href = "sms:" + PHONE + "?&body=" + encodeURIComponent("Design quiz — " + who + "\n" + summaryText() + (extra ? "\n\n" + extra : ""));
          sms.hidden = false;
        });
    });
    if (name) {
      var f = $("[data-namefield]");
      f.hidden = true;
      $("input", f).required = false;
    }
  }

  // ------------------------------------------------------------ start

  function start() {
    return Promise.all([
      QuizCore.load(),
      fetch("/data/house.json", { cache: "no-cache" }).then(function (r) {
        if (!r.ok) throw new Error("house " + r.status);
        return r.json();
      }),
    ]).then(function (got) {
      var catalog = got[0];
      house = got[1];
      var parsed = QuizCore.parse(catalog, location.search);
      name = parsed.name;
      // walk the house in its own order: every move is then to a neighbour
      var rank = function (it) { var i = house.route.indexOf(it.question.id); return i < 0 ? 999 : i; };
      items = parsed.items.slice().sort(function (a, b) { return rank(a) - rank(b); });
      items.forEach(function (it) { byId[it.question.id] = it; });
      restore();

      $("[data-blurb]").textContent = (name ? "Hi " + name + " — " : "") + catalog.blurb;
      var n = items.length;
      $("[data-meta]").textContent = n + " " + (n === 1 ? "question" : "questions") + " · scroll through the house";
      var box = $("[data-questions]");
      items.forEach(function (it, i) { box.appendChild(section(it, i)); });
      renderSummary();
      wireForm();

      $("[data-begin]").addEventListener("click", function () { items[0].sec.scrollIntoView({ behavior: reduce ? "auto" : "smooth" }); });
      $("[data-explore-open]").addEventListener("click", openExplore);
      $("[data-explore-close]").addEventListener("click", closeExplore);
      addEventListener("keydown", function (e) { if (e.key === "Escape" && mode === "explore") closeExplore(); });
      $("[data-restart]").addEventListener("click", function () {
        answers = {};
        try { sessionStorage.removeItem(KEY); } catch (e) { /* nothing saved */ }
        items.forEach(function (it) {
          var field = $(".field", it.sec);
          $("textarea", field).value = "";
          field.hidden = true;
          $(".q__notebtn", it.sec).hidden = false;
          paint(it);
        });
        renderSummary();
        scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      });

      [$("[data-intro]")].concat(items.map(function (it) { return it.sec; }), [$("[data-finale]")]).forEach(function (s) { watcher.observe(s); });
      return show(items[0], true);
    }).then(function () {
      window.__quizReady = true;
      document.body.classList.add("is-ready");
      progress();
    });
  }

  start().catch(function (e) {
    if (window.__quizFail) window.__quizFail(e && e.message ? e.message : String(e));
  });
})();
