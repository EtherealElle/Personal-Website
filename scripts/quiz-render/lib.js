// Shared kit for the quiz renders: renderer, textures, materials, and the sweep that
// turns a 2D moulding profile into a real piece of trim with mitred or square ends.
//
// Units are inches throughout. A casing is 3.5 wide because a casing is 3.5in wide.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export { THREE, RoundedBoxGeometry };

export const OUT_W = 1000;
export const OUT_H = 1250;
const SUPERSAMPLE = 2;

// ------------------------------------------------------------------ renderer

let renderer = null;
let envTex = null;

export function getRenderer() {
  if (renderer) return renderer;
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(SUPERSAMPLE);
  renderer.setSize(OUT_W, OUT_H);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);
  return renderer;
}

/** A soft studio environment: what makes paint read as paint and brass as brass. */
export function studioEnv() {
  if (envTex) return envTex;
  const pm = new THREE.PMREMGenerator(getRenderer());
  envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  pm.dispose();
  return envTex;
}

// Ambient occlusion: the darkening in the crease where trim meets wall, inside a
// flute, under a stool. It is most of what separates a render from a diagram.
let AO = null;
export async function loadAO() {
  if (AO !== null) return AO;
  try {
    const [{ EffectComposer }, { RenderPass }, { GTAOPass }, { OutputPass }] = await Promise.all([
      import("three/addons/postprocessing/EffectComposer.js"),
      import("three/addons/postprocessing/RenderPass.js"),
      import("three/addons/postprocessing/GTAOPass.js"),
      import("three/addons/postprocessing/OutputPass.js"),
    ]);
    AO = { EffectComposer, RenderPass, GTAOPass, OutputPass };
  } catch (e) {
    console.error("ambient occlusion unavailable, rendering without it: " + e.message);
    AO = false;
  }
  return AO;
}

/**
 * A bright, mostly white room for hardware to reflect. Chrome and polished brass are
 * nothing but reflection; in a dark studio they read as black. In a real room they
 * mirror light walls, a window, and a darker floor.
 */
let brightTex = null;
export function brightEnv() {
  if (brightTex) return brightTex;
  const env = new THREE.Scene();
  const cv = document.createElement("canvas");
  cv.width = 8; cv.height = 256;
  const g = cv.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#f4f1ec"); grad.addColorStop(0.45, "#e6e1d9");
  grad.addColorStop(0.55, "#a49b90"); grad.addColorStop(1, "#6f665d");
  g.fillStyle = grad; g.fillRect(0, 0, 8, 256);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  env.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide })));
  // a window and a ceiling light: the bright shapes a polished finish catches
  const glow = new THREE.MeshBasicMaterial({ color: 0xffffff });
  glow.color.multiplyScalar(4);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(26, 30), glow);
  win.position.set(-38, 8, 20); win.lookAt(0, 0, 0);
  const lamp = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), glow);
  lamp.position.set(10, 46, 10); lamp.lookAt(0, 0, 0);
  env.add(win, lamp);
  const pm = new THREE.PMREMGenerator(getRenderer());
  brightTex = pm.fromScene(env, 0.02).texture;
  pm.dispose();
  return brightTex;
}

/** Render, then step the supersampled frame down twice for clean edges. */
export function shoot(scene, camera, exposure = 1.0, ao = null) {
  const r = getRenderer();
  r.toneMappingExposure = exposure;
  if (ao && AO) {
    const comp = new AO.EffectComposer(r);
    comp.setPixelRatio(SUPERSAMPLE);
    comp.setSize(OUT_W, OUT_H);
    comp.addPass(new AO.RenderPass(scene, camera));
    const pass = new AO.GTAOPass(scene, camera, OUT_W * SUPERSAMPLE, OUT_H * SUPERSAMPLE);
    pass.updateGtaoMaterial({
      radius: ao.radius ?? 9, distanceExponent: 1, thickness: ao.thickness ?? 2.5,
      distanceFallOff: 1, scale: ao.scale ?? 1.9, samples: 24,
    });
    pass.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    pass.blendIntensity = ao.strength ?? 1;
    if (window.AO_DEBUG) pass.output = AO.GTAOPass.OUTPUT.Denoise;
    comp.addPass(pass);
    comp.addPass(new AO.OutputPass());
    comp.render();
    comp.dispose();
  } else {
    r.render(scene, camera);
  }
  const full = document.createElement("canvas");
  full.width = OUT_W; full.height = OUT_H;
  const g1 = full.getContext("2d");
  g1.imageSmoothingEnabled = true;
  g1.imageSmoothingQuality = "high";
  g1.drawImage(r.domElement, 0, 0, OUT_W, OUT_H);
  const sm = document.createElement("canvas");
  sm.width = OUT_W / 2; sm.height = OUT_H / 2;
  const g2 = sm.getContext("2d");
  g2.imageSmoothingEnabled = true;
  g2.imageSmoothingQuality = "high";
  g2.drawImage(full, 0, 0, sm.width, sm.height);
  return { full: full.toDataURL("image/webp", 0.86), sm: sm.toDataURL("image/webp", 0.84) };
}

/** Free everything a scene made, except the cached textures. */
export function dispose(scene) {
  scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => { if (!m.userData.cached) m.dispose(); });
    }
  });
}

export function camera(pos, target, fov = 30) {
  const c = new THREE.PerspectiveCamera(fov, OUT_W / OUT_H, 1, 5000);
  c.position.set(...pos);
  c.lookAt(...target);
  return c;
}

/**
 * Sunlight with a tight shadow frustum around the subject, so the shadow map's
 * resolution is spent where the eye is.
 */
export function sun(scene, { from, at = [0, 0, 0], size = 60, intensity = 2.4, color = 0xfff2e0, depth = 600 }) {
  const l = new THREE.DirectionalLight(color, intensity);
  l.position.set(at[0] + from[0], at[1] + from[1], at[2] + from[2]);
  l.target.position.set(...at);
  l.castShadow = true;
  l.shadow.mapSize.set(4096, 4096);
  const c = l.shadow.camera;
  c.left = -size; c.right = size; c.top = size; c.bottom = -size;
  c.near = 1; c.far = depth;
  l.shadow.bias = -0.0002;
  l.shadow.normalBias = 0.04;
  scene.add(l, l.target);
  return l;
}

// ------------------------------------------------------------------ noise

function hash(x, y, seed) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function vnoise(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x, y, seed = 0, oct = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, seed + i * 17); f *= 2.03; a *= 0.5; }
  return s;
}

/**
 * Value noise that wraps: the lattice repeats every px by py cells, so a texture built
 * from it tiles with no seam. Each octave doubles exactly, which keeps that true.
 */
function vnoiseP(x, y, px, py, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const m = (a, n) => ((a % n) + n) % n;
  const x0 = m(xi, px), x1 = m(xi + 1, px), y0 = m(yi, py), y1 = m(yi + 1, py);
  const a = hash(x0, y0, seed), b = hash(x1, y0, seed);
  const c = hash(x0, y1, seed), d = hash(x1, y1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbmP(x, y, px, py, seed = 0, oct = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * vnoiseP(x * f, y * f, px * f, py * f, seed + i * 17); f *= 2; a *= 0.5; }
  return s;
}

export function rand(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9) >>> 0; return s / 4294967296; };
}

const hex = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

// ------------------------------------------------------------------ textures

const texCache = new Map();

function canvasTex(key, w, h, paint, { repeat = [1, 1], srgb = true } = {}) {
  if (texCache.has(key)) return texCache.get(key);
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const g = cv.getContext("2d");
  const img = g.createImageData(w, h);
  paint(img.data, w, h);
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
}

/**
 * Wood, with the grain running along U. Boards are bands across V, each with its
 * own tone, its own figure, and a seam between them; `joints` adds butt joints the
 * way a floor has them.
 *
 * `ring` is growth rings per board. Rings sit a fraction of an inch apart in real
 * wood, so a texture covering one board 60in across wants rings in the dozens; a
 * figure of 7 across 60in reads as plywood. The noise wraps, so the texture tiles
 * along a board without a visible seam.
 */
export function woodTexture(key, {
  base, dark, boards = 1, seam = 0, joints = 0, ring = 7, wobble = 2.2,
  streak = 0.35, tone = 0.12, knots = 0, size = 1024, seed = 1, contrast = 0.55,
}) {
  return canvasTex("wood:" + key, size, size, (d, w, h) => {
    const B = hex(base), D = hex(dark);
    const bh = h / boards;
    const R = rand(seed);
    const boardTone = Array.from({ length: boards }, () => (R() - 0.5) * 2 * tone);
    const boardShift = Array.from({ length: boards }, () => R() * 50);
    const jointAt = Array.from({ length: boards }, () => (joints ? [R() * w, R() * w] : []));
    const knotsAt = Array.from({ length: knots }, () => [R() * w, R() * h, 3 + R() * 6]);
    const PX = 3, PY = 64;                    // long and lazy along the grain, busy across it
    for (let y = 0; y < h; y++) {
      const bi = Math.min(boards - 1, Math.floor(y / bh));
      const yl = (y - bi * bh) / bh;
      for (let x = 0; x < w; x++) {
        const n = fbmP(x / w * PX, y / h * PY, PX, PY, seed + bi * 7, 4);
        let r = yl * ring + n * wobble + boardShift[bi];
        let k = 0;
        for (const [kx, ky, kr] of knotsAt) {
          for (const ox of [-w, 0, w]) {
            const dx = (x - kx - ox) / (kr * 2.4), dy = (y - ky) / kr;
            const dd = Math.sqrt(dx * dx + dy * dy);
            if (dd < 7) { r += 1.4 / (dd + 0.3); k = Math.max(k, Math.max(0, 1 - dd / 1.1)); }
          }
        }
        let fig = 0.5 + 0.5 * Math.sin(r * Math.PI * 2);
        fig = Math.pow(fig, 2.2);
        const st = fbmP(x / w * 2, y / h * 512, 2, 512, seed + 99, 3);
        let m = fig * contrast + (st - 0.45) * streak + k * 0.8;
        m = Math.max(0, Math.min(1, m));
        const tt = 1 + boardTone[bi];
        let cr = (B[0] + (D[0] - B[0]) * m) * tt;
        let cg = (B[1] + (D[1] - B[1]) * m) * tt;
        let cb = (B[2] + (D[2] - B[2]) * m) * tt;
        if (seam) {
          const e = Math.min(y - bi * bh, (bi + 1) * bh - y);
          if (e < seam) { const s = 0.45 + 0.55 * (e / seam); cr *= s; cg *= s; cb *= s; }
        }
        for (const jx of jointAt[bi]) {
          if (Math.abs(x - jx) < 1.5) { cr *= 0.5; cg *= 0.5; cb *= 0.5; }
        }
        const i = (y * w + x) * 4;
        d[i] = Math.min(255, cr); d[i + 1] = Math.min(255, cg); d[i + 2] = Math.min(255, cb); d[i + 3] = 255;
      }
    }
  });
}

/** Flat paint is never quite flat: a faint roller stipple stops a wall looking like CG. */
export function paintTexture(key, color, amount = 0.035, scale = 3) {
  return canvasTex("paint:" + key, 512, 512, (d, w, h) => {
    const C = hex(color);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const n = (fbm(x / scale, y / scale, 7, 3) - 0.5) * 2 * amount + (fbm(x / 60, y / 60, 3, 3) - 0.5) * amount;
      const i = (y * w + x) * 4;
      d[i] = C[0] * (1 + n); d[i + 1] = C[1] * (1 + n); d[i + 2] = C[2] * (1 + n); d[i + 3] = 255;
    }
  }, { repeat: [4, 4] });
}

/** Brick, for a fireplace or a pier. Running bond, mortar, and a few odd ones out. */
export function brickTexture(key, { base = 0x9a4d38, mortar = 0xcfc4b6, seed = 3 } = {}) {
  return canvasTex("brick:" + key, 1024, 1024, (d, w, h) => {
    const B = hex(base), M = hex(mortar);
    const rows = 16, bh = h / rows, bw = bh * 2.9, joint = 5;
    const R = rand(seed);
    const tones = Array.from({ length: 400 }, () => (R() - 0.5) * 0.32);
    for (let y = 0; y < h; y++) {
      const row = Math.floor(y / bh), yl = y - row * bh;
      const off = (row % 2) * bw / 2;
      for (let x = 0; x < w; x++) {
        const xx = x + off, col = Math.floor(xx / bw), xl = xx - col * bw;
        const i = (y * w + x) * 4;
        const n = fbm(x / 6, y / 6, seed, 3);
        if (yl < joint || xl < joint) {
          const m = 0.85 + n * 0.3;
          d[i] = M[0] * m; d[i + 1] = M[1] * m; d[i + 2] = M[2] * m;
        } else {
          const t = 1 + tones[(row * 37 + col) % tones.length] + (n - 0.5) * 0.22;
          d[i] = B[0] * t; d[i + 1] = B[1] * t; d[i + 2] = B[2] * t;
        }
        d[i + 3] = 255;
      }
    }
  });
}

/** Stone veneer: irregular flat stones in warm greys. */
export function stoneTexture(key, seed = 5) {
  return canvasTex("stone:" + key, 1024, 1024, (d, w, h) => {
    const R = rand(seed);
    const pts = Array.from({ length: 70 }, () => [R() * w, R() * h * 1.0, 0.75 + R() * 0.45, R()]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let b1 = 1e9, b2 = 1e9, bi = 0;
      for (let k = 0; k < pts.length; k++) {
        for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
          const dx = (x - pts[k][0] - ox) * 0.62, dy = y - pts[k][1] - oy;
          const dd = dx * dx + dy * dy;
          if (dd < b1) { b2 = b1; b1 = dd; bi = k; } else if (dd < b2) b2 = dd;
        }
      }
      const edge = Math.sqrt(b2) - Math.sqrt(b1);
      const n = fbm(x / 9, y / 9, seed, 4);
      const i = (y * w + x) * 4;
      if (edge < 5) { d[i] = 92; d[i + 1] = 88; d[i + 2] = 82; }
      else {
        const t = pts[bi][2] * (0.82 + n * 0.36);
        const warm = pts[bi][3];
        d[i] = (150 + warm * 22) * t; d[i + 1] = (142 + warm * 10) * t; d[i + 2] = (132 - warm * 6) * t;
      }
      d[i + 3] = 255;
    }
  });
}

/**
 * What you see through a window: bright, hazy and slightly blown out, the way it is in
 * any real photo of a room. Painted small and soft on purpose - it's background, and
 * a sharp view outside would pull the eye off the trim.
 */
export function outdoorsTexture() {
  return canvasTex("outdoors", 256, 256, (d, w, h) => {
    const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const t = y / h;
      // sky, nearly white at the horizon
      let r = 222 + 26 * t, g = 234 + 16 * t, b = 246 + 6 * t;
      const leaf = fbm(x / 9, y / 9, 11, 4);
      const crown = 0.36 + (fbm(x / 34, 0.5, 4, 3) - 0.5) * 0.28;
      const k = smooth(crown - 0.06, crown + 0.08, t + (leaf - 0.5) * 0.18);
      const tr = 158 + leaf * 50, tg = 178 + leaf * 44, tb = 150 + leaf * 34;
      r += (tr - r) * k; g += (tg - g) * k; b += (tb - b) * k;
      const i = (y * w + x) * 4;
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
    }
  });
}

/**
 * A sky behind outdoor scenes: deeper blue overhead, pale at the horizon, and two
 * rows of trees - the far one hazed toward the sky, the near one darker - with soft
 * crowns rather than a cut-out edge.
 */
export function skyTexture() {
  const smooth = (a, b, x) => { const q = Math.max(0, Math.min(1, (x - a) / (b - a))); return q * q * (3 - 2 * q); };
  return canvasTex("sky3", 2048, 1024, (d, w, h) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const t = y / h;
      let r = 128 + 104 * t, g = 166 + 70 * t, b = 212 + 34 * t;
      // Far trees: hazed toward the sky, but with a real edge. A crown line built from a
      // broad swell plus small bumps reads as treetops; a soft edge reads as fog.
      const fleaf = fbmP(x / w * 96, y / h * 48, 96, 48, 71, 4);
      const fline = 0.55 + (fbmP(x / w * 12, 0.5, 12, 4, 72, 3) - 0.5) * 0.14
                         + (fbmP(x / w * 90, 0.5, 90, 4, 75, 2) - 0.5) * 0.05;
      const fk = smooth(fline - 0.006, fline + 0.006, t);
      r += (132 + fleaf * 30 - r) * fk; g += (150 + fleaf * 28 - g) * fk; b += (138 + fleaf * 22 - b) * fk;
      // Near trees: darker and fuller, bigger crowns
      const nleaf = fbmP(x / w * 128, y / h * 64, 128, 64, 73, 5);
      const nline = 0.635 + (fbmP(x / w * 8, 0.5, 8, 4, 74, 3) - 0.5) * 0.18
                          + (fbmP(x / w * 56, 0.5, 56, 4, 76, 2) - 0.5) * 0.07;
      const nk = smooth(nline - 0.005, nline + 0.005, t);
      r += (64 + nleaf * 50 - r) * nk; g += (84 + nleaf * 50 - g) * nk; b += (56 + nleaf * 34 - b) * nk;
      const i = (y * w + x) * 4;
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
    }
  });
}

/** Lawn: muted, mixed greens with a little straw in it, never paint-chip green. */
export function grassTexture() {
  return canvasTex("grass2", 1024, 1024, (d, w, h) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const blade = fbmP(x / w * 256, y / h * 256, 256, 256, 31, 2);
      const patch = fbmP(x / w * 6, y / h * 6, 6, 6, 32, 4);
      const straw = Math.max(0, fbmP(x / w * 12, y / h * 12, 12, 12, 33, 3) - 0.55) * 1.8;
      const v = 0.62 + blade * 0.38;
      let r = (86 + patch * 34) * v, g = (104 + patch * 34) * v, b = (60 + patch * 16) * v;
      r += straw * 46; g += straw * 30; b += straw * 6;
      const i = (y * w + x) * 4;
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
    }
  }, { repeat: [40, 28] });
}

// ------------------------------------------------------------------ materials

export function paint(color, rough = 0.42, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, envMapIntensity: 0.7, ...opts });
}

export function wallPaint(color) {
  return new THREE.MeshStandardMaterial({
    map: paintTexture("wall-" + color.toString(16), color), roughness: 0.92, metalness: 0, envMapIntensity: 0.55,
  });
}

export function woodMat(tex, { rough = 0.55, tint = 0xffffff, repeat = null, rotate = 0, clear = false } = {}) {
  const t = tex.clone();
  t.needsUpdate = true;
  if (repeat) t.repeat.set(...repeat);
  if (rotate) { t.center.set(0.5, 0.5); t.rotation = rotate; }
  const Mat = clear ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const m = new Mat({ map: t, color: tint, roughness: rough, metalness: 0, envMapIntensity: 0.6 });
  if (clear) { m.clearcoat = 0.6; m.clearcoatRoughness = 0.25; }
  return m;
}

export const METALS = {
  black:      { color: 0x222222, metalness: 0.35, roughness: 0.62 },
  satinbrass: { color: 0xc9a25a, metalness: 1, roughness: 0.34 },
  brass:      { color: 0xd8b064, metalness: 1, roughness: 0.12 },
  nickel:     { color: 0xc6c6c1, metalness: 1, roughness: 0.3 },
  chrome:     { color: 0xeeeeee, metalness: 1, roughness: 0.05 },
  bronze:     { color: 0x3e2c22, metalness: 0.85, roughness: 0.45 },
};

export function metal(kind) {
  return new THREE.MeshStandardMaterial({ ...METALS[kind], envMapIntensity: 1.25 });
}

// ------------------------------------------------------------------ geometry

/**
 * Sweep a closed 2D profile along a straight run, with each end cut square or on a
 * mitre. The profile is in (u, t): u across the face, t out from the wall, listed
 * counter-clockwise. u = 0 is the edge that sits nearest the opening, so a mitre at
 * angle a puts that end at x = -u * tan(a): the outer edge runs longer, exactly as a
 * real mitred casing does.
 *
 * Creases sharper than `crease` degrees get hard normals; gentler turns are smoothed,
 * so an ogee shades as a curve and a fillet stays crisp.
 */
export function sweep(rawProfile, L, a0 = 0, a1 = 0, crease = 38, depth = {}) {
  // Arcs and curves joined end to end repeat their meeting point; a zero-length edge
  // has no normal and shades black, so drop near-duplicates before anything else.
  const profile = [];
  rawProfile.forEach((p) => {
    const q = profile[profile.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-4) profile.push(p);
  });
  while (profile.length > 3) {
    const a = profile[0], z = profile[profile.length - 1];
    if (Math.hypot(a[0] - z[0], a[1] - z[1]) > 1e-4) break;
    profile.pop();
  }
  const n = profile.length;
  const t0 = Math.tan(a0 * Math.PI / 180), t1 = Math.tan(a1 * Math.PI / 180);
  // A corner turned in plan - baseboard round an outside corner, crown into an inside
  // one - mitres through the moulding's depth instead: depth.d0 / depth.d1 are those
  // angles, positive for an outside corner, negative for an inside one.
  const d0 = Math.tan((depth.d0 || 0) * Math.PI / 180), d1 = Math.tan((depth.d1 || 0) * Math.PI / 180);
  const xs = (u, v = 0) => -u * t0 - v * d0;
  const xe = (u, v = 0) => L + u * t1 + v * d1;

  const pos = [], nor = [], uv = [], idx = [];
  const edgeN = [];
  for (let i = 0; i < n; i++) {
    const [u0, v0] = profile[i], [u1, v1] = profile[(i + 1) % n];
    const dx = u1 - u0, dy = v1 - v0, len = Math.hypot(dx, dy) || 1;
    edgeN.push([dy / len, -dx / len]);
  }
  const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1]))) * 180 / Math.PI;
  const lim = crease;

  let per = 0;
  for (let i = 0; i < n; i++) {
    const prev = edgeN[(i - 1 + n) % n], cur = edgeN[i], next = edgeN[(i + 1) % n];
    const nS = ang(prev, cur) < lim ? norm2([prev[0] + cur[0], prev[1] + cur[1]]) : cur;
    const nE = ang(cur, next) < lim ? norm2([cur[0] + next[0], cur[1] + next[1]]) : cur;
    const [u0, v0] = profile[i], [u1, v1] = profile[(i + 1) % n];
    const seg = Math.hypot(u1 - u0, v1 - v0);
    const b = pos.length / 3;
    pos.push(xs(u0, v0), u0, v0, xe(u0, v0), u0, v0, xe(u1, v1), u1, v1, xs(u1, v1), u1, v1);
    nor.push(0, nS[0], nS[1], 0, nS[0], nS[1], 0, nE[0], nE[1], 0, nE[0], nE[1]);
    uv.push(xs(u0, v0) / 24, per / 24, xe(u0, v0) / 24, per / 24, xe(u1, v1) / 24, (per + seg) / 24, xs(u1, v1) / 24, (per + seg) / 24);
    // Wound so each face's front side agrees with its outward normal; the other way
    // round, the face you're looking at gets culled and you see the back of the piece.
    idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
    per += seg;
  }

  // End caps, triangulated in profile space and laid on the cut planes
  const contour = profile.map(([u, v]) => new THREE.Vector2(u, v));
  const tris = THREE.ShapeUtils.triangulateShape(contour, []);
  const cap = (atStart) => {
    // The cut plane is x = xs(u, v) or xe(u, v); its outward normal follows from that
    const N0 = atStart ? [-1, -t0, -d0] : [1, -t1, -d1];
    const l = Math.hypot(...N0);
    const N = N0.map((c) => c / l);
    const b = pos.length / 3;
    profile.forEach(([u, v]) => {
      pos.push(atStart ? xs(u, v) : xe(u, v), u, v);
      nor.push(...N);
      uv.push(u / 12, v / 12);
    });
    tris.forEach(([a, c, e]) => {
      // keep the winding facing outward
      const A = profile[a], C = profile[c], E = profile[e];
      const cross = (C[0] - A[0]) * (E[1] - A[1]) - (C[1] - A[1]) * (E[0] - A[0]);
      const flip = atStart ? cross > 0 : cross < 0;
      if (flip) idx.push(b + a, b + e, b + c); else idx.push(b + a, b + c, b + e);
    });
  };
  cap(true); cap(false);

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function norm2([x, y]) { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; }

/**
 * Place a swept piece. `along` is the world direction of the run, `across` the
 * direction u grows in; the third axis (out from the surface) follows from those.
 */
export function placeSweep(geom, mat, origin, along, across) {
  const X = new THREE.Vector3(...along).normalize();
  const U = new THREE.Vector3(...across).normalize();
  const T = new THREE.Vector3().crossVectors(X, U);
  const m = new THREE.Matrix4().makeBasis(X, U, T);
  m.setPosition(...origin);
  geom.applyMatrix4(m);
  const mesh = new THREE.Mesh(geom, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** A board with softly eased edges - nothing in real trim has a knife edge. */
export function board(w, h, d, mat, pos, ease = 0.08) {
  const g = new RoundedBoxGeometry(w, h, d, 3, Math.min(ease, w / 2.2, h / 2.2, d / 2.2));
  const m = new THREE.Mesh(g, mat);
  m.position.set(...pos);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function box(w, h, d, mat, pos) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(...pos);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// ------------------------------------------------------------------ profiles
// Each returns a closed polygon in (u, t), counter-clockwise, starting at the
// wall-side corner of the u = 0 edge.

export function arc(cx, cy, r, a0, a1, steps = 8) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = (a0 + (a1 - a0) * (i / steps)) * Math.PI / 180;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

/** Flat stock with a small round-over on both face edges. */
export function flatProfile(width, thick, ease = 0.09) {
  return [
    [0, 0], [width, 0],
    ...arc(width - ease, thick - ease, ease, 0, 90, 4),
    ...arc(ease, thick - ease, ease, 90, 180, 4),
  ];
}

/** The standard "colonial" casing: bead at the opening, flat field, ogee to a thick outer edge. */
export function colonialCasing(width = 2.5) {
  const s = width / 2.5;
  return [
    [0, 0], [width, 0], [width, 0.56],
    ...arc(width - 0.12 * s, 0.56, 0.12 * s, 0, 90, 4),
    ...sCurve([width - 0.14 * s, 0.68], [1.35 * s, 0.47], 10),
    [1.25 * s, 0.47], [1.2 * s, 0.43],
    [0.32 * s, 0.43],
    ...arc(0.17 * s, 0.43, 0.15 * s, 0, 180, 7),
    [0, 0.43],
  ];
}

/** An S-curve from a to b, for ogees. */
export function sCurve(a, b, steps = 10) {
  const pts = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const e = 0.5 - 0.5 * Math.cos(Math.PI * t);
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * e]);
  }
  return pts;
}

/** Victorian fluted casing: three flutes cut into a flat face, beads at both edges. */
export function flutedCasing(width = 4, thick = 0.875) {
  const e = 0.16;                                   // round-over at each face edge
  const half = width * 0.085, depth = 0.13;         // each flute: shallow and wide
  const pts = [[0, 0], [width, 0], [width, thick - e]];
  pts.push(...arc(width - e, thick - e, e, 0, 90, 4));
  // Travelling right to left along the face, dipping into each flute
  [0.74, 0.5, 0.26].forEach((f) => {
    const c = width * f;
    pts.push([c + half, thick]);
    for (let i = 1; i < 10; i++) {
      const a = Math.PI * i / 10;
      pts.push([c + half * Math.cos(a), thick - depth * Math.sin(a)]);
    }
    pts.push([c - half, thick]);
  });
  pts.push(...arc(e, thick - e, e, 90, 180, 4));
  return pts;
}

/** A small cap: ogee on top of a fillet. Crowns a baseboard or a craftsman head. */
export function capMoulding(h = 1.25, d = 0.8) {
  return [
    [0, 0], [h, 0],
    ...arc(h - 0.15, 0.15, 0.15, 0, 90, 4).map(([u, t]) => [u, t]),
    ...sCurve([h - 0.15, 0.3], [0.35, d], 9),
    [0.12, d], [0, d - 0.12],
  ];
}

/** Quarter-round shoe moulding. */
export function shoeProfile(r = 0.75) {
  return [[0, 0], [r, 0], ...arc(0, 0, r, 0, 90, 10).slice(1)];
}

// ------------------------------------------------------------------ wood in world space

/**
 * Give a geometry UVs from where it actually sits in the world, projected along each
 * face's dominant axis. Grain then runs along `grain` ("x", "y" or "z") at true scale,
 * nothing stretches to fit, and two boards side by side show two different bits of wood.
 */
export function worldUV(geom, grain = "x", inchesPerTile = 48) {
  const p = geom.attributes.position, nrm = geom.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  const ax = { x: 0, y: 1, z: 2 };
  for (let i = 0; i < p.count; i++) {
    const c = [p.getX(i), p.getY(i), p.getZ(i)];
    const n = [Math.abs(nrm.getX(i)), Math.abs(nrm.getY(i)), Math.abs(nrm.getZ(i))];
    const dom = n[0] > n[1] ? (n[0] > n[2] ? 0 : 2) : (n[1] > n[2] ? 1 : 2);
    const rest = [0, 1, 2].filter((a) => a !== dom);
    const g = ax[grain];
    const ua = rest.includes(g) ? g : rest[0];
    const va = rest.find((a) => a !== ua);
    uv[i * 2] = c[ua] / inchesPerTile;
    uv[i * 2 + 1] = c[va] / inchesPerTile;
  }
  geom.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geom;
}

/** A board whose wood runs along `grain`, at true scale, wherever it's put. */
export function woodBoard(w, h, d, mat, pos, grain = "x", ease = 0.08, tile = 48) {
  const g = new RoundedBoxGeometry(w, h, d, 3, Math.min(ease, w / 2.2, h / 2.2, d / 2.2));
  g.translate(...pos);
  worldUV(g, grain, tile);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Something turned on a lathe, standing on its base at `pos`. Points are [radius, height]. */
export function turned(points, mat, pos, segments = 48) {
  // Listed bottom to top; LatheGeometry wants them that way round for outward faces
  const g = new THREE.LatheGeometry(points.map(([r, h]) => new THREE.Vector2(Math.max(r, 0.001), h)), segments);
  const m = new THREE.Mesh(g, mat);
  m.position.set(...pos);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function mesh(geom, mat, pos = [0, 0, 0]) {
  const m = new THREE.Mesh(geom, mat);
  m.position.set(...pos);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
