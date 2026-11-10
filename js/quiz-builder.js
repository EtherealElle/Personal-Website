/* Build a client's quiz link: tick the questions, get a URL.

   Nothing is stored anywhere. The whole choice travels in the link itself, which is
   why this works on a site with no server behind it. */
(function () {
  "use strict";

  var $ = function (sel) { return document.querySelector(sel); };
  var questions = (window.QUIZ && window.QUIZ.questions) || [];
  if (!questions.length) return;

  var list = $("#list");
  var who = $("#who");
  var box = $("#link");
  var tally = $("#tally");
  var preview = $("#preview");

  // Built from wherever this page is served, so it is right on the live site and
  // right when previewing from a laptop. Drop the last path segment whatever it is:
  // the live page is /quiz-builder, not /quiz-builder.html, so matching on the
  // extension produced /quiz-builderquiz and a 404.
  var BASE = location.origin + location.pathname.replace(/[^/]*$/, "") + "quiz";

  var plain = function (html) {
    var d = document.createElement("div");
    d.innerHTML = html;
    return d.textContent;
  };

  questions.forEach(function (q, i) {
    var row = document.createElement("label");
    row.className = "pick";
    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = q.id;
    cb.checked = true;
    var text = document.createElement("span");
    var name = document.createElement("strong");
    name.textContent = plain(q.title);
    var count = document.createElement("em");
    count.textContent = (q.options || []).length + " options";
    text.append(name, count);
    row.append(cb, text);
    cb.addEventListener("change", update);
    list.appendChild(row);
    if (i === 0) row.classList.add("pick--first");
  });

  function chosen() {
    return Array.prototype.slice.call(list.querySelectorAll("input:checked"))
      .map(function (cb) { return cb.value; });
  }

  function update() {
    var ids = chosen();
    var name = who.value.trim();
    var qs = [];
    if (name) qs.push("for=" + encodeURIComponent(name));
    // Every question selected is the default, so the link stays short without it
    if (ids.length && ids.length !== questions.length) qs.push("q=" + ids.join(","));

    var url = BASE + (qs.length ? "?" + qs.join("&") : "");
    box.value = ids.length ? url : "Tick at least one question.";
    preview.href = ids.length ? url : "#";
    preview.setAttribute("aria-disabled", ids.length ? "false" : "true");
    tally.textContent = ids.length
      ? "· " + ids.length + (ids.length === 1 ? " question" : " questions")
      : "";
    $("#said").hidden = true;
  }

  who.addEventListener("input", update);

  $("#all").addEventListener("click", function () {
    list.querySelectorAll("input").forEach(function (cb) { cb.checked = true; });
    update();
  });
  $("#none").addEventListener("click", function () {
    list.querySelectorAll("input").forEach(function (cb) { cb.checked = false; });
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

  update();
})();
