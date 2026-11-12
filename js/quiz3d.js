/* The 3D design quiz: one page, one world, a room per question.

   Each question's room is built by the same scene builders that make the quiz renders
   (scripts/quiz-render/scenes.js), placed far apart in one world so their skies and lawns
   never overlap. Only the room in view is drawn. Scrolling to a question glides the
   camera into its room; choosing a style rebuilds that room in place; at the end the
   client can walk round every room with their picks in it.

   The link format and catalog are shared with the builder (js/quiz-core.js). */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { configureLive, dispose } from "/scripts/quiz-render/lib.js";

const FORMSPREE = "https://formspree.io/f/xvkgglnj";
const PHONE = "4703019576";
const SPACING = 6000;
const isPhone = Math.min(screen.width, screen.height) < 700;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s, c = document) => c.querySelector(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const nextPaint = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

// ------------------------------------------------------------ renderer and camera

const canvas = $("[data-stage]");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isPhone ? 1.75 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
configureLive({ renderer, textureScale: isPhone ? 0.5 : 1, shadowSize: isPhone ? 1024 : 2048 });

const BG = new THREE.Color(0xd9d3cc);
const world = new THREE.Scene();
world.background = BG;
const cam = new THREE.PerspectiveCamera(30, 1, 1, 6000);
const look = new THREE.Vector3();
let pose = null;          // the active room's resting camera: { pos, target, fov }
let mode = "story";       // or "explore"
let dirty = true;

/**
 * Frame the room in whatever part of the screen the panels leave free: the top on a
 * phone, the right on a wide screen. The scenes were composed for a 4:5 frame, so on a
 * tall narrow phone the lens widens until the subject still fits across.
 */
function frame() {
  const w = innerWidth, h = innerHeight;
  let fw = w, fh = h, ox = 0, oy = 0;
  if (mode === "story") {
    if (w >= 900) fw = w * 1.5;                       // subject sits two-thirds across
    else { const extra = h * 0.46; fh = h + extra; oy = extra; }   // subject in the top half
  } else {
    const extra = h * 0.12; fh = h + extra; oy = extra;
  }
  cam.aspect = fw / fh;
  if (pose) {
    const half = Math.atan(Math.tan(pose.fov * Math.PI / 360) * 0.8) * 0.92;
    const need = 2 * Math.atan(Math.tan(half) / cam.aspect) * 180 / Math.PI;
    cam.fov = Math.min(78, Math.max(pose.fov, need));
  }
  cam.setViewOffset(fw, fh, ox, oy, w, h);
  cam.updateProjectionMatrix();
  dirty = true;
}

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  frame();
}
addEventListener("resize", resize);
resize();

// A glide between two camera positions
let tween = null;
const ease = (k) => 1 - Math.pow(1 - k, 3);
function setCam(p) { cam.position.copy(p.pos); look.copy(p.target); cam.lookAt(look); dirty = true; }
function glide(to, ms = 1100) {
  tween = { t0: performance.now(), ms: reduce ? 1 : ms, a: { pos: cam.position.clone(), target: look.clone() }, b: to };
}

const controls = new OrbitControls(cam, canvas);
controls.enabled = false;
controls.enablePan = false;
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.55;
controls.addEventListener("change", () => { dirty = true; });

function loop(now) {
  requestAnimationFrame(loop);
  let moving = false;
  if (tween) {
    const k = Math.min(1, (now - tween.t0) / tween.ms);
    const e = ease(k);
    cam.position.lerpVectors(tween.a.pos, tween.b.pos, e);
    look.lerpVectors(tween.a.target, tween.b.target, e);
    cam.lookAt(look);
    moving = true;
    if (k >= 1) { tween = null; if (mode === "explore") limitControls(); }
  }
  if (controls.enabled && controls.update()) moving = true;
  if (dirty || moving) { renderer.render(world, cam); dirty = false; }
}
requestAnimationFrame(loop);

// ------------------------------------------------------------ the rooms

let scenes = null;        // the builders, loaded once the page is up
let items = [], byId = {}, order = [], name = "";
const rooms = new Map();  // question id -> { group, shown, pose, env, bg, exposure }
let active = null;        // question id whose room is in view
let building = 0;

function showBuilding(on) {
  building += on ? 1 : -1;
  $("[data-building]").hidden = building <= 0;
}

/** Build (or rebuild) a question's room showing one style. Quiet = while idle, ahead of time. */
async function room(qid, oid, quiet = false) {
  let r = rooms.get(qid);
  if (r && r.shown === oid) return r;
  if (!scenes.buildable(qid).includes(oid)) return null;
  if (!quiet) { showBuilding(true); await nextPaint(); }
  let built = null;
  try { built = scenes.buildScene(qid, oid); } catch (e) { console.error(e); }
  if (!quiet) showBuilding(false);
  if (!built) return null;
  r = rooms.get(qid);
  if (r && r.shown === oid) return r;               // built meanwhile
  const off = new THREE.Vector3(order.indexOf(qid) * SPACING, 0, 0);
  const g = new THREE.Group();
  g.position.copy(off);
  [...built.scene.children].forEach((c) => g.add(c));
  const c = built.camera;
  const next = {
    group: g, shown: oid,
    env: built.scene.environment, bg: built.scene.background || BG, exposure: built.exposure || 1,
    pose: { pos: c.position.clone().add(off), target: new THREE.Vector3(...c.userData.target).add(off), fov: c.fov },
  };
  if (r) { world.remove(r.group); dispose(r.group); }
  g.visible = active === qid;
  world.add(g);
  rooms.set(qid, next);
  return next;
}

function useRoom(r) {
  rooms.forEach((x) => { x.group.visible = x === r; });
  world.environment = r ? r.env : null;
  world.background = r ? r.bg : BG;
  renderer.toneMappingExposure = r ? r.exposure : 1;
  dirty = true;
}

/** The style a question's room should show: their pick, or the first one offered. */
function shownOption(item) {
  const a = answers[item.question.id];
  const picked = a && a.pick && a.pick !== "none" && item.options.find((o) => o.id === a.pick);
  return picked || item.options[0];
}

const photo = $("[data-photo]");
let jumpToken = 0;

/** Bring a question's room into view, with its current style in it. */
async function show(item, { instant = false } = {}) {
  const token = ++jumpToken;
  const qid = item.question.id;
  const opt = shownOption(item);
  const same = active === qid;

  // A style that's a photo, not a model, is shown framed instead of in a room
  if (!scenes.buildable(qid).includes(opt.id)) {
    $("img", photo).src = opt.image;
    photo.hidden = false;
    active = qid;
    useRoom(null);
    return;
  }
  photo.hidden = true;

  const veil = $("[data-veil]");
  if (!same && !instant && rooms.size) { veil.classList.add("is-on"); await wait(230); }
  const r = await room(qid, opt.id);
  if (token !== jumpToken) return;                  // they've already scrolled on
  if (!r) { veil.classList.remove("is-on"); return; }
  active = qid;
  useRoom(r);
  pose = r.pose;
  frame();
  if (!same) {
    // Start a little further out and settle in: a glide, not a cut
    const out = r.pose.pos.clone().sub(r.pose.target).multiplyScalar(reduce || instant ? 1 : 1.14).add(r.pose.target);
    setCam({ pos: out, target: r.pose.target });
    glide(r.pose);
  }
  veil.classList.remove("is-on");
  prefetchSoon();
}

// Build the next room ahead of time, but only once scrolling has stopped: building
// blocks for a moment, and a hitch mid-swipe is worse than one at a standstill.
let lastScroll = 0, prefetchTimer = 0;
addEventListener("scroll", () => { lastScroll = performance.now(); }, { passive: true });
function prefetchSoon() {
  clearTimeout(prefetchTimer);
  prefetchTimer = setTimeout(async () => {
    if (performance.now() - lastScroll < 600) return prefetchSoon();
    const i = order.indexOf(active);
    for (const it of [items[i + 1], items[i - 1]]) {
      if (it && !rooms.has(it.question.id)) { await room(it.question.id, shownOption(it).id, true); break; }
    }
  }, 900);
}

// ------------------------------------------------------------ answers

let answers = {};
const KEY = "quiz3d:" + location.search;
function save() { try { sessionStorage.setItem(KEY, JSON.stringify(answers)); } catch (e) { /* private mode */ } }
function restore() { try { answers = JSON.parse(sessionStorage.getItem(KEY) || "{}") || {}; } catch (e) { answers = {}; } }
function answer(qid) { return answers[qid] || (answers[qid] = { pick: null, note: "" }); }

function pickedLabel(item) {
  const a = answers[item.question.id];
  if (!a || !a.pick) return null;
  if (a.pick === "none") return "None of these";
  const o = item.options.find((x) => x.id === a.pick);
  return o ? o.label : null;
}

// ------------------------------------------------------------ the page

function section(item, i) {
  const q = item.question;
  const sec = document.createElement("section");
  sec.className = "q";
  sec.dataset.q = q.id;
  sec.innerHTML = `
    <div class="panel">
      <span class="q__step"></span>
      <h2 class="q__title"></h2>
      <p class="q__note"></p>
      <div class="chips" role="group"></div>
      <p class="q__showing" aria-live="polite"></p>
      <div class="q__row">
        <button class="none" type="button" aria-pressed="false">None of these are quite right</button>
        <button class="link q__notebtn" type="button">+ Add a note</button>
      </div>
      <label class="field" hidden><span>Your note</span>
        <textarea rows="3" maxlength="500" placeholder="Anything you like or don't, or what you'd change"></textarea></label>
      <button class="q__next" type="button"></button>
    </div>`;
  $(".q__step", sec).textContent = `${i + 1} of ${items.length}`;
  $(".q__title", sec).textContent = q.title;
  const note = $(".q__note", sec);
  note.textContent = q.note;
  note.hidden = !q.note;
  $(".q__next", sec).textContent = i === items.length - 1 ? "See it all together ↓" : "Next ↓";

  const chips = $(".chips", sec);
  item.options.forEach((o) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.dataset.o = o.id;
    b.innerHTML = '<img alt="" loading="lazy" decoding="async"><span></span>';
    $("img", b).src = o.thumb;
    $("span", b).textContent = o.label;
    b.addEventListener("click", () => choose(item, o.id));
    chips.appendChild(b);
  });
  $(".none", sec).addEventListener("click", () => choose(item, "none"));

  const field = $(".field", sec), area = $("textarea", field), noteBtn = $(".q__notebtn", sec);
  const openNote = () => { field.hidden = false; noteBtn.hidden = true; };
  noteBtn.addEventListener("click", () => { openNote(); area.focus(); });
  area.addEventListener("input", () => { answer(q.id).note = area.value; save(); renderSummary(); });
  const a = answers[q.id];
  if (a && a.note) { area.value = a.note; openNote(); }

  $(".q__next", sec).addEventListener("click", () => {
    const target = sec.nextElementSibling || $("[data-finale]");
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  });
  item.sec = sec;
  paint(item);
  return sec;
}

/** Reflect a question's answer in its panel. */
function paint(item) {
  const a = answers[item.question.id] || {};
  item.sec.querySelectorAll(".chip").forEach((b) => b.setAttribute("aria-pressed", a.pick === b.dataset.o ? "true" : "false"));
  $(".none", item.sec).setAttribute("aria-pressed", a.pick === "none" ? "true" : "false");
  const line = $(".q__showing", item.sec);
  const shown = shownOption(item);
  if (a.pick === "none") line.innerHTML = "<strong>None of these.</strong> <span>Tell me what you'd want instead.</span>";
  else if (a.pick) { line.innerHTML = "<strong>Your pick:</strong> "; line.append(shown.label); }
  else { line.innerHTML = "<span>Showing</span> "; line.append(shown.label); line.insertAdjacentHTML("beforeend", "<span> · tap a style to choose</span>"); }
}

async function choose(item, oid) {
  const a = answer(item.question.id);
  a.pick = oid;
  save();
  paint(item);
  if (oid === "none") {
    const field = $(".field", item.sec);
    if (field.hidden) { field.hidden = false; $(".q__notebtn", item.sec).hidden = true; $("textarea", field).focus(); }
  }
  await show(item, { instant: true });
  renderSummary();
}

// Which section is in the middle of the screen decides which room is in view
let current = null;
const watcher = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting || mode !== "story") return;
    const id = e.target.dataset.q;
    const it = id ? byId[id] : items[0];
    if (e.target === current) return;
    current = e.target;
    if (it) show(it);
  });
}, { rootMargin: "-48% 0px -48% 0px" });

function progress() {
  const max = document.documentElement.scrollHeight - innerHeight;
  $("[data-progress]").style.width = (max > 0 ? (scrollY / max) * 100 : 0) + "%";
}
addEventListener("scroll", progress, { passive: true });

function renderSummary() {
  const list = $("[data-summary]");
  list.innerHTML = "";
  let missing = 0;
  items.forEach((it) => {
    const li = document.createElement("li");
    const label = pickedLabel(it);
    if (!label) { li.className = "is-missing"; missing++; }
    const o = shownOption(it);
    li.innerHTML = "<img alt=''><div><small></small><strong></strong></div>";
    $("img", li).src = o.thumb;
    $("small", li).textContent = it.question.title;
    $("strong", li).textContent = label || "Not chosen yet";
    const note = (answers[it.question.id] || {}).note;
    if (note && note.trim()) { const em = document.createElement("em"); em.textContent = "“" + note.trim() + "”"; $("div", li).appendChild(em); }
    li.style.cursor = "pointer";
    li.addEventListener("click", () => it.sec.scrollIntoView({ behavior: reduce ? "auto" : "smooth" }));
    list.appendChild(li);
  });
  const p = $("[data-pending]");
  p.textContent = missing ? `${missing} ${missing === 1 ? "question" : "questions"} still to choose — tap one above to go back, or send as it is.` : "";
  p.hidden = !missing;
}

// ------------------------------------------------------------ walking round

function limitControls() {
  if (!pose) return;
  controls.target.copy(pose.target);
  const s = new THREE.Spherical().setFromVector3(cam.position.clone().sub(pose.target));
  controls.minAzimuthAngle = s.theta - 0.6;
  controls.maxAzimuthAngle = s.theta + 0.6;
  controls.minPolarAngle = Math.max(0.2, s.phi - 0.32);
  controls.maxPolarAngle = Math.min(Math.PI - 0.2, s.phi + 0.22);
  controls.minDistance = s.radius * 0.55;
  controls.maxDistance = s.radius * 1.2;
  controls.enabled = true;
  controls.update();
}

function roomButtons(currentId) {
  const nav = $("[data-rooms]");
  nav.innerHTML = "";
  items.forEach((it) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "room";
    b.innerHTML = "<small></small><strong></strong>";
    $("small", b).textContent = it.question.title;
    $("strong", b).textContent = pickedLabel(it) || shownOption(it).label;
    b.setAttribute("aria-current", it.question.id === currentId ? "true" : "false");
    b.addEventListener("click", () => visit(it));
    nav.appendChild(b);
  });
}

async function visit(it) {
  controls.enabled = false;
  roomButtons(it.question.id);
  await show(it);
  const btn = [...$("[data-rooms]").children][items.indexOf(it)];
  if (btn) btn.scrollIntoView({ inline: "center", block: "nearest", behavior: reduce ? "auto" : "smooth" });
}

function openExplore() {
  mode = "explore";
  document.body.classList.add("is-exploring");
  $("[data-explore]").hidden = false;
  frame();
  const start = items.find((it) => answers[it.question.id] && answers[it.question.id].pick) || items[0];
  visit(start);
}

function closeExplore() {
  mode = "story";
  controls.enabled = false;
  document.body.classList.remove("is-exploring");
  $("[data-explore]").hidden = true;
  frame();
  if (pose) { setCam(pose); }
}

// ------------------------------------------------------------ sending

function summaryText() {
  return items.map((it) => {
    const note = ((answers[it.question.id] || {}).note || "").trim();
    return it.question.title + ": " + (pickedLabel(it) || "—") + (note ? "\n    Note: " + note : "");
  }).join("\n");
}

function wireForm() {
  const form = $("[data-form]");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const button = $("button[type=submit]", form);
    const typed = $("input[name=client]", form);
    const who = name || (typed ? typed.value.trim() : "") || "A client";
    const extra = $("textarea[name=notes]", form).value.trim();
    button.disabled = true;
    button.textContent = "Sending…";
    const body = new FormData();
    body.append("_subject", "Design quiz — " + who);
    body.append("client", who);
    body.append("answers", summaryText());
    if (extra) body.append("anything else", extra);
    body.append("link", location.href);
    fetch(FORMSPREE, { method: "POST", body, headers: { Accept: "application/json" } })
      .then((res) => {
        if (!res.ok) throw new Error("formspree");
        $("[data-sent]").hidden = false;
        button.hidden = true;
        try { sessionStorage.removeItem(KEY); } catch (err) { /* nothing saved */ }
      })
      .catch(() => {
        button.hidden = true;
        const sms = $("[data-sms]");
        sms.href = "sms:" + PHONE + "?&body=" + encodeURIComponent("Design quiz — " + who + "\n" + summaryText() + (extra ? "\n\n" + extra : ""));
        sms.hidden = false;
      });
  });
  if (name) {
    const f = $("[data-namefield]");
    f.hidden = true;
    $("input", f).required = false;
  }
}

// ------------------------------------------------------------ start

async function start() {
  let catalog;
  try { catalog = await QuizCore.load(); }
  catch (e) { $("[data-failed]").hidden = false; return; }
  // If the 3D itself can't load, the flat quiz asks the same questions
  try { scenes = await import("/scripts/quiz-render/scenes.js"); }
  catch (e) { window.__quizFail("Couldn't load the 3D: " + (e && e.message)); return; }
  const parsed = QuizCore.parse(catalog, location.search);
  items = parsed.items;
  name = parsed.name;
  order = items.map((it) => it.question.id);
  items.forEach((it) => { byId[it.question.id] = it; });
  restore();

  $("[data-blurb]").textContent = (name ? "Hi " + name + " — " : "") + catalog.blurb;
  const n = items.length;
  $("[data-meta]").textContent = `${n} ${n === 1 ? "question" : "questions"} · scroll through the house`;
  const box = $("[data-questions]");
  items.forEach((it, i) => box.appendChild(section(it, i)));
  renderSummary();
  wireForm();

  $("[data-begin]").addEventListener("click", () => items[0].sec.scrollIntoView({ behavior: reduce ? "auto" : "smooth" }));
  $("[data-explore-open]").addEventListener("click", openExplore);
  $("[data-explore-close]").addEventListener("click", closeExplore);
  addEventListener("keydown", (e) => { if (e.key === "Escape" && mode === "explore") closeExplore(); });
  $("[data-restart]").addEventListener("click", () => {
    answers = {};
    try { sessionStorage.removeItem(KEY); } catch (e) { /* nothing saved */ }
    items.forEach((it) => {
      const field = $(".field", it.sec);
      $("textarea", field).value = "";
      field.hidden = true;
      $(".q__notebtn", it.sec).hidden = false;
      paint(it);
    });
    renderSummary();
    scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  });

  [$("[data-intro]"), ...items.map((it) => it.sec), $("[data-finale]")].forEach((s) => watcher.observe(s));
  await show(items[0], { instant: true });
  if (rooms.size || !photo.hidden) window.__quizReady = true;
  else window.__quizFail("The first room didn't build");
  progress();
}

start().catch((e) => window.__quizFail(e && e.message ? e.message : String(e)));
