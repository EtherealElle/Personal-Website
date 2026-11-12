/* Design quiz. One question per screen: tap a style to choose it, look closer if you
   want, add a note if you have one, then Next. Answers and notes are emailed to Cleo
   through the same Formspree inbox as the contact form.

   What's asked comes from the link (see js/quiz-core.js); the catalog itself is
   data/quiz.json. Nothing here knows what trim is. */
(function () {
  "use strict";

  var FORMSPREE = "https://formspree.io/f/xvkgglnj";
  var PHONE = "4703019576";

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var items = [], name = "", at = 0, answers = {};

  var screens = ["intro", "quiz", "done", "error"].reduce(function (m, k) {
    m[k] = $("#screen-" + k); return m;
  }, {});

  function show(which) {
    Object.keys(screens).forEach(function (k) {
      screens[k].classList.toggle("is-on", k === which);
      screens[k].hidden = k !== which;
    });
    window.scrollTo(0, 0);
  }

  // A refresh halfway through shouldn't cost the client their answers
  var KEY = "quiz:" + location.search;
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify({ at: at, answers: answers })); } catch (e) { /* private mode */ } }
  function restore() {
    try {
      var s = JSON.parse(sessionStorage.getItem(KEY) || "null");
      if (s && s.answers) { answers = s.answers; at = Math.min(s.at || 0, items.length - 1); return true; }
    } catch (e) { /* nothing saved */ }
    return false;
  }

  function answer(q) {
    if (!answers[q.id]) answers[q.id] = { pick: null, note: "" };
    return answers[q.id];
  }

  // ------------------------------------------------------------ start

  QuizCore.load().then(function (catalog) {
    var parsed = QuizCore.parse(catalog, location.search);
    items = parsed.items;
    name = parsed.name;
    if (!items.length) throw new Error("no questions");

    $("[data-blurb]").textContent = (name ? "Hi " + name + " — " : "") + catalog.blurb;
    var n = items.length;
    $("[data-meta]").textContent = n + (n === 1 ? " question" : " questions") + " · " +
      (n <= 3 ? "about a minute" : n <= 7 ? "a few minutes" : "about ten minutes");
    $("[data-total]").textContent = String(n);

    // The link already says who this is for, so don't ask them again at the end
    if (name) {
      var f = $("[data-namefield]");
      f.hidden = true;
      $("input", f).required = false;
    }

    var start = $("[data-start]");
    var resumed = restore() && Object.keys(answers).length;
    start.textContent = resumed ? "Pick up where you left off" : "Start";
    start.disabled = false;
    start.addEventListener("click", function () { render(); show("quiz"); });
    preload(0);
  }).catch(function () { show("error"); });

  // ------------------------------------------------------------ a question

  var board = $("[data-board]");
  var noneBtn = $("[data-none]");
  var noteToggle = $("[data-note-toggle]");
  var noteField = $("[data-note-field]");
  var noteText = $("[data-note-text]");
  var nextBtn = $("[data-next]");

  function preload(i) {
    var it = items[i];
    if (!it) return;
    it.options.forEach(function (o) { var im = new Image(); im.src = o.thumb; });
  }

  function render() {
    var it = items[at], q = it.question, a = answer(q);
    $("[data-now]").textContent = String(at + 1);
    $("[data-title]").textContent = q.title;
    var note = $("[data-note]");
    note.textContent = q.note;
    note.hidden = !q.note;
    $("[data-back]").hidden = at === 0;
    $("[data-progress]").style.width = (at / items.length) * 100 + "%";

    board.innerHTML = "";
    it.options.forEach(function (o) {
      var card = document.createElement("div");
      card.className = "opt" + (a.pick === o.id ? " is-picked" : "");

      var pick = document.createElement("button");
      pick.type = "button";
      pick.className = "opt__pick";
      pick.setAttribute("aria-pressed", a.pick === o.id ? "true" : "false");

      var box = document.createElement("span");
      box.className = "opt__img";
      var img = document.createElement("img");
      img.src = o.thumb;
      if (o.thumb !== o.image) {
        img.srcset = o.thumb + " 500w, " + o.image + " 1000w";
        img.sizes = "(min-width: 1000px) 240px, (min-width: 760px) 30vw, 46vw";
      }
      img.alt = "";
      img.decoding = "async";
      box.appendChild(img);

      var label = document.createElement("span");
      label.className = "opt__text";
      var l = document.createElement("span");
      l.className = "opt__label";
      l.textContent = o.label;
      label.appendChild(l);
      if (o.note) {
        var sub = document.createElement("span");
        sub.className = "opt__note";
        sub.textContent = o.note;
        label.appendChild(sub);
      }
      pick.append(box, label);
      pick.addEventListener("click", function () { choose(o.id); });

      // Look closer: its own button, so it never counts as choosing
      var zoom = document.createElement("button");
      zoom.type = "button";
      zoom.className = "opt__zoom";
      zoom.setAttribute("aria-label", "See " + o.label + " larger");
      zoom.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21M10.5 7.5v6M7.5 10.5h6"/></svg>';
      zoom.addEventListener("click", function () { openZoom(o, zoom); });

      card.append(pick, zoom);
      board.appendChild(card);
    });

    noneBtn.setAttribute("aria-pressed", a.pick === "none" ? "true" : "false");
    noneBtn.classList.toggle("is-picked", a.pick === "none");
    noteText.value = a.note || "";
    setNoteOpen(!!a.note);
    nextBtn.textContent = at === items.length - 1 ? "Finish" : "Next";
    nextBtn.disabled = !a.pick;
    preload(at + 1);
  }

  function choose(id) {
    var a = answer(items[at].question);
    a.pick = id;
    save();
    render();
    // "None of these" is worth a word of explanation, so open the note for it
    if (id === "none" && !a.note) { setNoteOpen(true); noteText.focus(); }
  }

  noneBtn.addEventListener("click", function () { choose("none"); });

  function setNoteOpen(open) {
    noteField.hidden = !open;
    noteToggle.hidden = open;
    noteToggle.setAttribute("aria-expanded", open ? "true" : "false");
  }
  noteToggle.addEventListener("click", function () { setNoteOpen(true); noteText.focus(); });
  noteText.addEventListener("input", function () {
    answer(items[at].question).note = noteText.value;
    save();
  });

  nextBtn.addEventListener("click", function () {
    if (nextBtn.disabled) return;
    if (at < items.length - 1) { at += 1; save(); render(); window.scrollTo(0, 0); }
    else finish();
  });

  $("[data-back]").addEventListener("click", function () {
    if (at > 0) { at -= 1; save(); render(); window.scrollTo(0, 0); }
  });

  // ------------------------------------------------------------ look closer

  var zoomBox = $("[data-zoom]");
  var zoomFor = null, zoomFrom = null;

  function openZoom(o, from) {
    zoomFor = o; zoomFrom = from;
    var img = $("[data-zoom-img]");
    img.src = o.image;
    img.alt = o.label;
    $("[data-zoom-label]").textContent = o.label;
    $("[data-zoom-note]").textContent = o.note || "";
    zoomBox.hidden = false;
    document.body.classList.add("is-zoomed");
    $("[data-zoom-pick]").focus();
  }

  function closeZoom() {
    zoomBox.hidden = true;
    document.body.classList.remove("is-zoomed");
    if (zoomFrom) zoomFrom.focus();
    zoomFor = null;
  }

  $("[data-zoom-close]").addEventListener("click", closeZoom);
  zoomBox.addEventListener("click", function (e) { if (e.target === zoomBox) closeZoom(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !zoomBox.hidden) closeZoom(); });
  $("[data-zoom-pick]").addEventListener("click", function () {
    var id = zoomFor && zoomFor.id;
    closeZoom();
    if (id) choose(id);
  });

  // ------------------------------------------------------------ results

  function pickedLabel(it) {
    var a = answer(it.question);
    if (a.pick === "none") return "None of these";
    var o = it.options.filter(function (x) { return x.id === a.pick; })[0];
    return o ? o.label : "—";
  }

  function finish() {
    var list = $("[data-summary]");
    list.innerHTML = "";
    items.forEach(function (it) {
      var li = document.createElement("li");
      var head = document.createElement("div");
      head.className = "summary__row";
      var k = document.createElement("span");
      k.textContent = it.question.title;
      var v = document.createElement("span");
      v.textContent = pickedLabel(it);
      head.append(k, v);
      li.appendChild(head);
      var note = (answer(it.question).note || "").trim();
      if (note) {
        var p = document.createElement("p");
        p.className = "summary__note";
        p.textContent = "“" + note + "”";
        li.appendChild(p);
      }
      list.appendChild(li);
    });
    $("[data-progress]").style.width = "100%";
    show("done");
  }

  function summaryText() {
    return items.map(function (it) {
      var note = (answer(it.question).note || "").trim();
      return it.question.title + ": " + pickedLabel(it) + (note ? "\n    Note: " + note : "");
    }).join("\n");
  }

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
        try { sessionStorage.removeItem(KEY); } catch (err) { /* nothing to clear */ }
      })
      .catch(function () {
        // Formspree unreachable: hand it to the messaging app instead
        button.hidden = true;
        var sms = $("[data-sms]");
        sms.href = "sms:" + PHONE + "?&body=" + encodeURIComponent(
          "Design quiz — " + who + "\n" + summaryText() + (extra ? "\n\n" + extra : ""));
        sms.hidden = false;
      });
  });

  $("[data-restart]").addEventListener("click", function () {
    answers = {};
    at = 0;
    try { sessionStorage.removeItem(KEY); } catch (e) { /* nothing saved */ }
    var button = $("button[type=submit]", form);
    button.disabled = false;
    button.hidden = false;
    button.textContent = "Send to Cleo";
    $("[data-sent]").hidden = true;
    $("[data-sms]").hidden = true;
    $("[data-start]").textContent = "Start";
    show("intro");
  });
})();
