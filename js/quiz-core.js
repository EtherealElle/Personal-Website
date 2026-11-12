/* Shared by the quiz and the builder: loading the catalog, and the link format.

   Both pages use this one copy, so the link the builder writes is, by construction,
   the link the quiz reads. (They used to each have their own idea of it, which is how
   a builder link once came out as /quiz-builderquiz.)

   A link looks like:
     /quiz?for=Jess&trim=square.22.cap&doors
   - for=     the client's first name; optional
   - trim=... include that question, with those styles, in that order
   - doors    include that question with its default styles
   Questions appear in the order they're named. Old links that use q=a,b still work,
   and so do a question's old names, listed as its aliases. Anything the catalog
   doesn't recognise - a tracking tag Facebook adds, a typo - is ignored. */
(function () {
  "use strict";

  var RESERVED = ["for", "q"];

  function slug(s) {
    return String(s || "").toLowerCase().replace(/&amp;|&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  /** Text from the catalog may carry entities like &amp;. Decode without running anything. */
  function text(s) {
    var t = document.createElement("textarea");
    t.innerHTML = String(s || "");
    return t.value;
  }

  function normalise(data) {
    var questions = (data.questions || []).filter(function (q) {
      return q && q.title && Array.isArray(q.options);
    }).map(function (q) {
      var used = {};
      var options = q.options.filter(function (o) { return o && o.label && o.image; }).map(function (o) {
        var id = slug(o.id || o.label) || "style";
        while (used[id]) id += "-2";
        used[id] = true;
        return {
          id: id, label: text(o.label), note: text(o.note), image: o.image,
          thumb: o.thumb || o.image, default: o.default !== false,
        };
      });
      return {
        id: slug(q.id || q.title), title: text(q.title), note: text(q.note),
        aliases: String(q.aliases || "").split(/[,\s]+/).map(slug).filter(Boolean),
        options: options,
      };
    }).filter(function (q) { return q.options.length >= 2; });
    return { title: text(data.title || "Design quiz"), blurb: text(data.blurb), questions: questions };
  }

  function load() {
    return fetch("/data/quiz.json", { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error("catalog " + r.status);
      return r.json();
    }).then(normalise);
  }

  function find(catalog, key) {
    var k = slug(key);
    for (var i = 0; i < catalog.questions.length; i++) {
      var q = catalog.questions[i];
      if (q.id === k || q.aliases.indexOf(k) !== -1) return q;
    }
    return null;
  }

  function defaults(q) {
    var d = q.options.filter(function (o) { return o.default; });
    return d.length >= 2 ? d : q.options;
  }

  /** Read a link into the client's name and an ordered list of {question, options}. */
  function parse(catalog, search) {
    var params = new URLSearchParams(search);
    var name = (params.get("for") || "").replace(/[<>]/g, "").trim().slice(0, 40);
    var items = [], seen = {};

    function add(q, ids) {
      if (!q || seen[q.id]) return;
      seen[q.id] = true;
      var opts = [];
      ids.forEach(function (id) {
        var o = q.options.filter(function (x) { return x.id === slug(id); })[0];
        if (o && opts.indexOf(o) === -1) opts.push(o);
      });
      // A question needs at least two styles to be a question
      items.push({ question: q, options: opts.length >= 2 ? opts : defaults(q) });
    }

    (params.get("q") || "").split(/[,.~]/).forEach(function (k) { if (k) add(find(catalog, k), []); });
    params.forEach(function (value, key) {
      if (RESERVED.indexOf(key) !== -1) return;
      add(find(catalog, key), String(value).split(/[.,~]/).filter(Boolean));
    });
    if (!items.length) catalog.questions.forEach(function (q) { add(q, []); });
    return { name: name, items: items };
  }

  /** Write a link. `items` is [{question, options}] in the order the client should see. */
  function build(base, name, items, catalog) {
    var parts = [];
    if (name) parts.push("for=" + encodeURIComponent(name.trim()));
    var everything = catalog && items.length === catalog.questions.length;
    var keys = items.map(function (it) {
      var def = defaults(it.question).map(function (o) { return o.id; });
      var ids = it.options.map(function (o) { return o.id; });
      var same = ids.length === def.length && ids.every(function (id, i) { return id === def[i]; });
      if (!same) everything = false;
      return encodeURIComponent(it.question.id) + (same ? "" : "=" + ids.map(encodeURIComponent).join("."));
    });
    if (everything) items.forEach(function (it, i) { if (catalog.questions[i] !== it.question) everything = false; });
    // Every question, all at their defaults, needs no question list at all
    if (!everything) parts = parts.concat(keys);
    return base + (parts.length ? "?" + parts.join("&") : "");
  }

  window.QuizCore = { load: load, parse: parse, build: build, defaults: defaults, slug: slug };
})();
