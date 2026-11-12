/* Build a client's quiz link: tick the questions, choose the styles in each, get a URL.

   Nothing is stored anywhere. The whole choice travels in the link, written by
   QuizCore.build - the same file the quiz reads links with. */
(function () {
  "use strict";

  var $ = function (sel) { return document.querySelector(sel); };
  var list = $("#list"), who = $("#who"), box = $("#link"), tally = $("#tally");
  var preview = $("#preview"), textIt = $("#text");

  // Wherever this page is served from, the quiz sits beside it. Drop the last path
  // segment whatever it is: the live address has no .html on the end.
  var BASE = location.origin + location.pathname.replace(/[^/]*$/, "") + "quiz";

  var catalog = null;
  var state = {};     // question id -> { on: bool, picked: Set of option ids }

  QuizCore.load().then(function (c) {
    catalog = c;
    list.innerHTML = "";
    c.questions.forEach(function (q) {
      state[q.id] = { on: false, picked: QuizCore.defaults(q).map(function (o) { return o.id; }) };
      list.appendChild(row(q));
    });
    update();
  }).catch(function () {
    list.innerHTML = '<p class="blurb">The question list didn\'t load. Check your connection and refresh.</p>';
  });

  function row(q) {
    var s = state[q.id];
    var wrap = document.createElement("div");
    wrap.className = "pq";

    var head = document.createElement("div");
    head.className = "pq__head";
    var check = document.createElement("label");
    check.className = "pq__check";
    var cb = document.createElement("input");
    cb.type = "checkbox";
    var title = document.createElement("span");
    title.className = "pq__title";
    title.textContent = q.title;
    check.append(cb, title);

    var more = document.createElement("button");
    more.type = "button";
    more.className = "pq__more";
    more.setAttribute("aria-expanded", "false");
    var count = document.createElement("span");
    more.append(count);
    more.insertAdjacentHTML("beforeend", '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>');
    head.append(check, more);

    var styles = document.createElement("div");
    styles.className = "pq__styles";
    styles.hidden = true;
    var hint = document.createElement("p");
    hint.className = "pq__hint";
    hint.textContent = "Tap a style to show or hide it. Keep at least two.";

    q.options.forEach(function (o) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      var img = document.createElement("img");
      img.src = o.thumb;
      img.alt = "";
      img.loading = "lazy";
      var label = document.createElement("span");
      label.textContent = o.label;
      chip.append(img, label);
      chip.addEventListener("click", function () {
        var i = s.picked.indexOf(o.id);
        if (i !== -1) {
          if (s.picked.length <= 2) {
            hint.textContent = "A question needs at least two styles to choose between.";
            hint.classList.add("is-warn");
            return;
          }
          s.picked.splice(i, 1);
        } else {
          // keep the catalog's order, whatever order they were tapped in
          s.picked.push(o.id);
          s.picked.sort(function (a, b) { return idx(q, a) - idx(q, b); });
        }
        hint.textContent = "Tap a style to show or hide it. Keep at least two.";
        hint.classList.remove("is-warn");
        s.on = true;       // choosing styles means you want the question
        paint();
        update();
      });
      styles.appendChild(chip);
    });
    styles.appendChild(hint);

    cb.addEventListener("change", function () { s.on = cb.checked; paint(); update(); });
    more.addEventListener("click", function () {
      var open = styles.hidden;
      styles.hidden = !open;
      more.setAttribute("aria-expanded", open ? "true" : "false");
    });

    function paint() {
      cb.checked = s.on;
      wrap.classList.toggle("is-on", s.on);
      count.textContent = s.picked.length + " of " + q.options.length + " styles";
      Array.prototype.forEach.call(styles.querySelectorAll(".chip"), function (chip, i) {
        var on = s.picked.indexOf(q.options[i].id) !== -1;
        chip.classList.toggle("is-on", on);
        chip.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }
    wrap._paint = paint;
    paint();

    wrap.append(head, styles);
    return wrap;
  }

  function idx(q, id) {
    for (var i = 0; i < q.options.length; i++) if (q.options[i].id === id) return i;
    return 999;
  }

  function chosen() {
    if (!catalog) return [];
    return catalog.questions.filter(function (q) { return state[q.id].on; }).map(function (q) {
      return {
        question: q,
        options: state[q.id].picked.map(function (id) { return q.options[idx(q, id)]; }).filter(Boolean),
      };
    });
  }

  function update() {
    var items = chosen();
    var name = who.value.trim();
    var ok = items.length > 0;
    var url = QuizCore.build(BASE, name, items, catalog);
    box.value = ok ? url : "Tick at least one question.";
    tally.textContent = ok ? "· " + items.length + " ticked" : "";
    preview.href = ok ? url : "#";
    preview.setAttribute("aria-disabled", ok ? "false" : "true");
    var msg = (name ? "Hi " + name + " — here's" : "Here's") + " the design quiz I mentioned. Takes a few minutes: " + url;
    textIt.href = ok ? "sms:?&body=" + encodeURIComponent(msg) : "#";
    textIt.setAttribute("aria-disabled", ok ? "false" : "true");
    $("#copy").disabled = !ok;
    $("#said").hidden = true;
  }

  who.addEventListener("input", update);

  $("#none").addEventListener("click", function () {
    Object.keys(state).forEach(function (k) { state[k].on = false; });
    Array.prototype.forEach.call(list.querySelectorAll(".pq"), function (r) { r._paint(); });
    update();
  });

  $("#copy").addEventListener("click", function () {
    if (!chosen().length) return;
    var done = function () { $("#said").hidden = false; };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(box.value).then(done, fallback);
    } else {
      fallback();
    }
    function fallback() {
      // Older phone browsers, and anywhere the clipboard API is blocked
      box.removeAttribute("readonly");
      box.select();
      box.setSelectionRange(0, 99999);
      try { document.execCommand("copy"); done(); } catch (e) { box.focus(); }
      box.setAttribute("readonly", "");
    }
  });
})();
