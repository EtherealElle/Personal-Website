/* Design quiz. One question per screen, one answer each, then the answers are
   emailed to Cleo through the same Formspree inbox as the contact form.

   The questions live in js/quiz-data.js. Nothing here knows what trim is. */
(function () {
  "use strict";

  var FORMSPREE = "https://formspree.io/f/xvkgglnj";
  var PHONE = "4703019576";

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var data = window.QUIZ || { questions: [] };
  var questions = data.questions || [];
  if (!questions.length) return;

  // Name from the link, e.g. /quiz?for=Jess
  var params = new URLSearchParams(location.search);
  var invited = (params.get("for") || "").replace(/[<>]/g, "").trim().slice(0, 40);

  var answers = {};
  var at = 0;

  var screens = {
    intro: $("#screen-intro"),
    quiz: $("#screen-quiz"),
    done: $("#screen-done")
  };

  function show(name) {
    Object.keys(screens).forEach(function (key) {
      var el = screens[key];
      var on = key === name;
      el.classList.toggle("is-on", on);
      el.hidden = !on;
    });
    window.scrollTo(0, 0);
  }

  /* ------------------------------------------------------------ intro */
  $("[data-blurb]").textContent = invited
    ? "Hi " + invited + " — " + (data.blurb || "")
    : (data.blurb || "");
  var n = questions.length;
  $("[data-meta]").textContent = n + (n === 1 ? " question" : " questions") +
    " · " + (n <= 3 ? "under a minute" : "about a minute");
  $("[data-total]").textContent = String(n);

  // A name typed into the form is only asked for when the link didn't carry one
  if (invited) {
    var nameField = $("[data-namefield]");
    nameField.hidden = true;
    $("input", nameField).required = false;
  }

  $("[data-start]").addEventListener("click", function () {
    at = 0;
    render();
    show("quiz");
  });

  /* ------------------------------------------------------------ questions */
  var board = $("[data-board]");

  function render() {
    var q = questions[at];
    $("[data-now]").textContent = String(at + 1);
    $("[data-title]").innerHTML = q.title;
    var note = $("[data-note]");
    note.textContent = q.note || "";
    note.hidden = !q.note;
    $("[data-back]").hidden = at === 0;
    $("[data-progress]").style.width = (at / questions.length) * 100 + "%";

    board.innerHTML = "";
    (q.options || []).forEach(function (opt) {
      var card = document.createElement("button");
      card.type = "button";
      card.className = "opt";
      if (answers[q.id] === opt.label) card.classList.add("is-picked");
      card.setAttribute("aria-pressed", answers[q.id] === opt.label ? "true" : "false");

      var box = document.createElement("div");
      box.className = "opt__img";
      if (opt.image) {
        var img = document.createElement("img");
        img.src = opt.image;
        img.alt = opt.label;
        img.loading = at === 0 ? "eager" : "lazy";
        img.decoding = "async";
        box.appendChild(img);
      }

      var text = document.createElement("div");
      text.className = "opt__text";
      var label = document.createElement("span");
      label.className = "opt__label";
      label.textContent = opt.label;
      text.appendChild(label);
      if (opt.note) {
        var sub = document.createElement("span");
        sub.className = "opt__note";
        sub.textContent = opt.note;
        text.appendChild(sub);
      }

      card.append(box, text);
      card.addEventListener("click", function () { pick(q, opt); });
      board.appendChild(card);
    });
  }

  function pick(q, opt) {
    answers[q.id] = opt.label;
    // Let the pick register before moving on, so the tap feels like it did something
    setTimeout(function () {
      if (at < questions.length - 1) {
        at += 1;
        render();
      } else {
        finish();
      }
    }, 180);
    render();
  }

  $("[data-back]").addEventListener("click", function () {
    if (at > 0) { at -= 1; render(); }
  });

  /* ------------------------------------------------------------ results */
  function finish() {
    var list = $("[data-summary]");
    list.innerHTML = "";
    questions.forEach(function (q) {
      var li = document.createElement("li");
      var name = document.createElement("span");
      // The title can carry an entity like &amp;, so read it back as text
      var tmp = document.createElement("div");
      tmp.innerHTML = q.title;
      name.textContent = tmp.textContent;
      var val = document.createElement("span");
      val.textContent = answers[q.id] || "—";
      li.append(name, val);
      list.appendChild(li);
    });
    $("[data-progress]").style.width = "100%";
    show("done");
  }

  function summaryText() {
    return questions.map(function (q) {
      var tmp = document.createElement("div");
      tmp.innerHTML = q.title;
      return tmp.textContent + ": " + (answers[q.id] || "—");
    }).join("\n");
  }

  var form = $("[data-form]");
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var button = $("button[type=submit]", form);
    var typed = $("input[name=client]", form);
    var who = invited || (typed ? typed.value.trim() : "") || "A client";
    var notes = $("textarea[name=notes]", form).value.trim();

    button.disabled = true;
    button.textContent = "Sending…";

    var body = new FormData();
    body.append("_subject", "Design quiz — " + who);
    body.append("client", who);
    body.append("answers", summaryText());
    if (notes) body.append("notes", notes);

    fetch(FORMSPREE, { method: "POST", body: body, headers: { Accept: "application/json" } })
      .then(function (res) {
        if (!res.ok) throw new Error("formspree");
        $("[data-sent]").hidden = false;
        button.hidden = true;
      })
      .catch(function () {
        // Formspree unreachable: hand it to the messaging app instead
        button.hidden = true;
        var sms = $("[data-sms]");
        sms.href = "sms:" + PHONE + "?&body=" +
          encodeURIComponent("Design quiz — " + who + "\n" + summaryText() +
            (notes ? "\n\n" + notes : ""));
        sms.hidden = false;
      });
  });

  $("[data-restart]").addEventListener("click", function () {
    answers = {};
    at = 0;
    var button = $("button[type=submit]", form);
    button.disabled = false;
    button.hidden = false;
    button.textContent = "Send to Cleo";
    $("[data-sent]").hidden = true;
    $("[data-sms]").hidden = true;
    show("intro");
  });
})();
