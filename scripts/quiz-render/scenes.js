// One builder per quiz question. Each takes an option id and returns the scene, the
// camera and an exposure. Within a question everything is shared except the thing
// being asked about - same wall, same light, same lens - so the client is comparing
// a detail, not a room.
import {
  THREE, studioEnv, brightEnv, shoot, dispose, camera, sun, loadAO,
  sweep, placeSweep, board, box, mesh, turned, woodBoard, paint, wallPaint, woodMat, woodTexture, metal,
  outdoorsTexture, skyTexture, grassTexture, brickTexture, stoneTexture, paintTexture, rand,
  flatProfile, colonialCasing, flutedCasing, capMoulding, arc, sCurve,
} from "./lib.js?v=5b77f93a";

// The live quiz takes these from here rather than from lib.js directly, so the page and
// the scenes share a single copy of lib.js (two copies would mean two renderers).
export { configureLive, dispose } from "./lib.js?v=5b77f93a";

const TRIM = 0xf2efe8;      // semi-gloss white trim
const WALL = 0x9e968b;      // mid greige: white trim reads because the wall is darker

// ------------------------------------------------------------------ shared pieces

/** A wall with rectangular holes cut through it, face at z = 0, `thick` deep. */
function wallWithHoles(x0, x1, y0, y1, holes, thick, mat) {
  const s = new THREE.Shape();
  s.moveTo(x0, y0); s.lineTo(x1, y0); s.lineTo(x1, y1); s.lineTo(x0, y1); s.lineTo(x0, y0);
  holes.forEach(([hx0, hx1, hy0, hy1]) => {
    const h = new THREE.Path();
    h.moveTo(hx0, hy0); h.lineTo(hx0, hy1); h.lineTo(hx1, hy1); h.lineTo(hx1, hy0); h.lineTo(hx0, hy0);
    s.holes.push(h);
  });
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false });
  g.translate(0, 0, -thick);
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  m.castShadow = true;
  return m;
}

function outdoorsBackdrop(scene, cx, cy, z, w, h) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: outdoorsTexture(), toneMapped: false, color: 0xe8e8e8 }),
  );
  m.material.userData.cached = false;
  m.position.set(cx, cy, z);
  scene.add(m);
}

// ================================================================== window trim

const OPEN_W = 30, OPEN_H = 52, REVEAL = 0.25;

function windowUnit(scene, trimMat) {
  const hw = OPEN_W / 2;
  // Jambs lining the opening, flush with the wall face
  scene.add(board(0.75, OPEN_H, 5, trimMat, [-hw - 0.375, OPEN_H / 2, -2.5], 0.04));
  scene.add(board(0.75, OPEN_H, 5, trimMat, [hw + 0.375, OPEN_H / 2, -2.5], 0.04));
  scene.add(board(OPEN_W + 1.5, 0.75, 5, trimMat, [0, OPEN_H + 0.375, -2.5], 0.04));

  // Double-hung sashes: the lower one sits proud of the upper, meeting at the check rail
  const sash = (y0, h, z) => {
    const s = 2.25, t = 1.6;
    scene.add(board(OPEN_W, s, t, trimMat, [0, y0 + h - s / 2, z], 0.12));
    scene.add(board(OPEN_W, s * 1.15, t, trimMat, [0, y0 + s * 0.575, z], 0.12));
    scene.add(board(s, h, t, trimMat, [-hw + s / 2, y0 + h / 2, z], 0.12));
    scene.add(board(s, h, t, trimMat, [hw - s / 2, y0 + h / 2, z], 0.12));
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(OPEN_W - 2 * s, h - 2.15 * s),
      new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, roughness: 0.12, metalness: 0, envMapIntensity: 0.6 }),
    );
    glass.position.set(0, y0 + h / 2 + 0.1, z);
    scene.add(glass);
  };
  sash(OPEN_H / 2 - 0.6, OPEN_H / 2 + 0.6, -3.4);
  sash(0, OPEN_H / 2 + 0.6, -1.9);
  outdoorsBackdrop(scene, 0, OPEN_H / 2, -90, 210, 210);
}

function stoolAndApron(scene, trimMat, span) {
  // Stool: runs a horn past the casing each side and stands proud of the wall
  scene.add(board(span + 3, 1.0, 5.6, trimMat, [0, -0.5, -0.2], 0.32));
  // Apron, under it
  scene.add(board(span - 0.5, 3.5, 0.75, trimMat, [0, -1 - 1.75, 0.375], 0.08));
}

/** The two legs and head of a casing, square at the stool, butted under a head board. */
function buttLegs(scene, mat, prof, width, top) {
  const hw = OPEN_W / 2 + REVEAL;
  scene.add(placeSweep(sweep(prof, top), mat, [-hw, 0, 0], [0, 1, 0], [-1, 0, 0]));
  scene.add(placeSweep(sweep(prof, top), mat, [hw, top, 0], [0, -1, 0], [1, 0, 0]));
  return hw + width;   // outer edge of each leg
}

function headBoard(scene, mat, outer, ear, height, thick, angle) {
  const L = 2 * (outer + ear);
  const prof = flatProfile(height, thick, 0.1);
  const y = OPEN_H + REVEAL;
  scene.add(placeSweep(sweep(prof, L, angle, angle), mat, [-(outer + ear), y, 0], [1, 0, 0], [0, 1, 0]));
  return L / 2;
}

function pictureFrame(scene, mat, prof, width) {
  const hw = OPEN_W / 2 + REVEAL;
  const top = OPEN_H + REVEAL;
  scene.add(placeSweep(sweep(prof, top, 0, 45), mat, [-hw, 0, 0], [0, 1, 0], [-1, 0, 0]));
  scene.add(placeSweep(sweep(prof, top, 45, 0), mat, [hw, top, 0], [0, -1, 0], [1, 0, 0]));
  scene.add(placeSweep(sweep(prof, 2 * hw, 45, 45), mat, [-hw, top, 0], [1, 0, 0], [0, 1, 0]));
  return hw + width;
}

function rosette(mat) {
  const pts = [
    [0.001, 0.95], [0.25, 0.92], [0.42, 0.7], [0.55, 0.52], [0.7, 0.78], [0.86, 0.8],
    [1.0, 0.5], [1.18, 0.42], [1.34, 0.62], [1.5, 0.6], [1.66, 0.26], [1.8, 0.08], [1.86, 0.0],
  ].map(([r, h]) => new THREE.Vector2(r, h)).reverse();   // outside in, so the faces point out
  const g = new THREE.LatheGeometry(pts, 48);
  g.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

function buildTrim(opt) {
  const scene = new THREE.Scene();
  scene.environment = studioEnv();
  const trim = paint(TRIM, 0.36);
  const wall = wallPaint(WALL);
  // The rough opening is the finished opening plus the jamb stock lining it
  scene.add(wallWithHoles(-110, 110, -70, 140, [[-OPEN_W / 2 - 0.75, OPEN_W / 2 + 0.75, 0, OPEN_H + 0.75]], 5, wall));
  windowUnit(scene, trim);

  let span;
  const flat = flatProfile(3.5, 0.75);
  if (opt === "square" || opt === "22" || opt === "45") {
    const outer = buttLegs(scene, trim, flat, 3.5, OPEN_H + REVEAL);
    headBoard(scene, trim, outer, 0.6, 5.5, 1.0, { square: 0, 22: 22, 45: 45 }[opt]);
    span = 2 * outer;
  } else if (opt === "cap") {
    const outer = buttLegs(scene, trim, flat, 3.5, OPEN_H + REVEAL);
    const half = headBoard(scene, trim, outer, 0.6, 5.5, 0.875, 0);
    const y = OPEN_H + REVEAL + 5.5;
    // Bed moulding tucked under the cap, then the cap itself, thick and proud
    const cove = [[0, 0], [0.85, 0], ...arc(0.85, 0.85, 0.85, -90, -180, 10).slice(1), [0, 0.85]];
    scene.add(placeSweep(sweep(cove, 2 * half + 0.3), trim, [-half - 0.15, y, 0.875], [1, 0, 0], [0, 0, 1]));
    scene.add(board(2 * half + 2.8, 1.75, 2.7, trim, [0, y + 0.875, 1.35], 0.22));
    span = 2 * outer;
  } else if (opt === "colonial") {
    span = 2 * pictureFrame(scene, trim, colonialCasing(2.5), 2.5);
  } else if (opt === "frame") {
    span = 2 * pictureFrame(scene, trim, flat, 3.5);
  } else if (opt === "victorian") {
    const fl = flutedCasing(4, 0.875);
    const hw = OPEN_W / 2 + REVEAL;
    const blockBottom = OPEN_H + REVEAL - 0.25;
    scene.add(placeSweep(sweep(fl, blockBottom), trim, [-hw, 0, 0], [0, 1, 0], [-1, 0, 0]));
    scene.add(placeSweep(sweep(fl, blockBottom), trim, [hw, blockBottom, 0], [0, -1, 0], [1, 0, 0]));
    // Head runs between the corner blocks
    scene.add(placeSweep(sweep(fl, 2 * hw - 0.5), trim, [-hw + 0.25, OPEN_H + REVEAL, 0], [1, 0, 0], [0, 1, 0]));
    [-1, 1].forEach((s) => {
      const cx = s * (hw + 2);
      const cy = blockBottom + 2.25;
      scene.add(board(4.5, 4.5, 1.125, trim, [cx, cy, 0.5625], 0.12));
      const r = rosette(trim);
      r.position.set(cx, cy, 1.125);
      scene.add(r);
    });
    span = 2 * (hw + 4.25);
  }
  stoolAndApron(scene, trim, span);

  // Light rakes in from the left, the way it does from a window across the room,
  // so every profile throws a shadow across itself and onto the wall
  scene.add(new THREE.HemisphereLight(0xfff8ee, 0x8a7d70, 0.25));
  sun(scene, { from: [-140, 75, 80], at: [0, 26, 0], size: 55, intensity: 3.0 });
  const cam = camera([30, 30, 142], [0, 27, 0], 30);
  return { scene, camera: cam, exposure: 1.0, ao: { strength: 1 } };
}

// ================================================================== interior kit

function interiorLight(scene, at, from, size = 70, intensity = 3.0, { fill = 0, bounce = 0.25, bounceColor = 0x8a7d70 } = {}) {
  scene.environment = studioEnv();
  // Sky above, and below it whatever the floor throws back up - which is what lights a
  // ceiling in a real room
  scene.add(new THREE.HemisphereLight(0xfff8ee, bounceColor, bounce));
  sun(scene, { from, at, size, intensity });
  if (fill) {
    // A soft, shadowless fill from the other side: no real room has a black wall
    const f = new THREE.DirectionalLight(0xf2f0ff, fill);
    f.position.set(at[0] - from[0], at[1] + Math.abs(from[1]) * 0.4, at[2] + from[2] * 0.3);
    f.target.position.set(...at);
    scene.add(f, f.target);
  }
}

/** Oak strip flooring, boards running away from the viewer. */
function oakFloor(scene, x0, x1, z0, z1) {
  const tex = woodTexture("oak-floor", {
    base: 0xae8a66, dark: 0x765639, boards: 8, seam: 2.4, joints: 1, ring: 5, wobble: 2.6, tone: 0.12, seed: 4,
  });
  const mat = woodMat(tex, { rough: 0.45, repeat: [(z1 - z0) / 26, (x1 - x0) / 26], rotate: Math.PI / 2 });
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
  m.receiveShadow = true;
  scene.add(m);
}

const baseBoardProfile = () => flatProfile(5.25, 0.625, 0.06);
const baseCap = () => capMoulding(1.1, 0.72);

/** A run of baseboard and cap along the wall at z = 0, from x0 to x1. */
function baseRun(scene, mat, x0, x1) {
  scene.add(placeSweep(sweep(baseBoardProfile(), x1 - x0), mat, [x0, 0, 0], [1, 0, 0], [0, 1, 0]));
  scene.add(placeSweep(sweep(baseCap(), x1 - x0), mat, [x0, 5.25, 0], [1, 0, 0], [0, 1, 0]));
}

/** A colonial base: an ogee top running down into a flat face. */
function colonialBase(h = 3.25) {
  return [
    [0, 0], [h, 0], [h, 0.18],
    ...arc(h - 0.1, 0.18, 0.1, 0, 90, 4),
    ...sCurve([h - 0.12, 0.3], [h - 0.85, 0.56], 9),
    [0.05, 0.56], [0, 0.5],
  ];
}

// ================================================================== interior doors

const DOOR_W = 32, DOOR_H = 80;

/** Panels by door, as [x0, x1, y0, y1] in the door's own coordinates. */
function doorPanels(kind) {
  const L = 4.5, R = DOOR_W - 4.5;
  if (kind === "shaker2") return [[L, R, 8, 36], [L, R, 43, 75.5]];
  if (kind === "shaker3") return [[L, R, 8, 27.5], [L, R, 32, 51.5], [L, R, 56, 75.5]];
  if (kind === "shaker5") {
    const out = [];
    const each = (75.5 - 8 - 4 * 3.5) / 5;
    for (let i = 0; i < 5; i++) out.push([L, R, 8 + i * (each + 3.5), 8 + i * (each + 3.5) + each]);
    return out;
  }
  if (kind === "raised6") {
    const cols = [[L, 14], [18, R]];
    const rows = [[8, 30], [37.5, 64], [68.5, 75.5]];
    return rows.flatMap((r) => cols.map((c) => [c[0], c[1], r[0], r[1]]));
  }
  if (kind === "french") return [[L, R, 8, 75.5]];
  return [];
}

function buildDoorSlab(scene, kind, trim, x0, zFace) {
  const T = 1.375;
  const panels = doorPanels(kind);
  const z0 = zFace - T;
  // The frame - stiles and rails - is the slab with the panel openings cut out,
  // extruded with an eased edge so every edge catches a little light
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(DOOR_W, 0); s.lineTo(DOOR_W, DOOR_H); s.lineTo(0, DOOR_H); s.lineTo(0, 0);
  panels.forEach(([a, b, c, d]) => {
    const h = new THREE.Path();
    h.moveTo(a, c); h.lineTo(a, d); h.lineTo(b, d); h.lineTo(b, c); h.lineTo(a, c);
    s.holes.push(h);
  });
  const ease = 0.07;
  const g = new THREE.ExtrudeGeometry(s, { depth: T - 2 * ease, bevelEnabled: true, bevelThickness: ease, bevelSize: ease, bevelSegments: 2, curveSegments: 4 });
  g.translate(x0, 0, z0 + ease);
  scene.add(mesh(g, trim));

  panels.forEach(([a, b, c, d]) => {
    const w = b - a, h = d - c, cx = x0 + (a + b) / 2, cy = (c + d) / 2;
    if (kind === "french") {
      // Ten lites: a muntin grid over glass, the room beyond showing through
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
        new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, roughness: 0.06, envMapIntensity: 0.9 }));
      glass.position.set(cx, cy, zFace - T / 2);
      scene.add(glass);
      for (let i = 1; i < 2; i++) scene.add(board(0.875, h, 1.0, trim, [x0 + a + (w * i) / 2, cy, zFace - T / 2], 0.05));
      for (let j = 1; j < 5; j++) scene.add(board(w, 0.875, 1.0, trim, [cx, c + (h * j) / 5, zFace - T / 2], 0.05));
      return;
    }
    if (kind === "raised6") {
      // A raised field: the panel's bevel is the extrusion's own wide bevel
      const bev = Math.min(1.6, w / 4, h / 4);
      const ps = new THREE.Shape();
      ps.moveTo(-w / 2 + bev, -h / 2 + bev); ps.lineTo(w / 2 - bev, -h / 2 + bev);
      ps.lineTo(w / 2 - bev, h / 2 - bev); ps.lineTo(-w / 2 + bev, h / 2 - bev); ps.lineTo(-w / 2 + bev, -h / 2 + bev);
      const pg = new THREE.ExtrudeGeometry(ps, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.3, bevelSize: bev - 0.05, bevelSegments: 1 });
      pg.translate(cx, cy, zFace - 0.85);
      scene.add(mesh(pg, trim));
      // and a small ogee sticking where the panel meets the frame
      const stick = [[0, 0], [0.45, 0], ...sCurve([0.45, 0.02], [0.05, 0.32], 6), [0, 0.32]];
      const top = cy + h / 2, bot = cy - h / 2, lft = cx - w / 2, rgt = cx + w / 2;
      const zz = zFace - 0.32;
      scene.add(placeSweep(sweep(stick, w, -45, -45), trim, [lft, bot, zz], [1, 0, 0], [0, 1, 0]));
      scene.add(placeSweep(sweep(stick, w, -45, -45), trim, [rgt, top, zz], [-1, 0, 0], [0, -1, 0]));
      scene.add(placeSweep(sweep(stick, h, -45, -45), trim, [rgt, bot, zz], [0, 1, 0], [-1, 0, 0]));
      scene.add(placeSweep(sweep(stick, h, -45, -45), trim, [lft, top, zz], [0, -1, 0], [1, 0, 0]));
      return;
    }
    // Shaker: a flat panel set back inside the frame
    scene.add(board(w + 0.6, h + 0.6, 0.5, trim, [cx, cy, zFace - 0.55 - 0.25], 0.03));
  });

  // Knob, the same on every door so it isn't part of the choice
  const nickel = metal("nickel");
  nickel.roughness = 0.42;
  const kx = x0 + DOOR_W - 2.25, ky = 36;
  const rose = turned([[1.25, 0], [1.25, 0.12], [1.05, 0.3], [0.45, 0.42], [0.35, 0.9]], nickel, [0, 0, 0], 40);
  rose.rotation.x = Math.PI / 2; rose.position.set(kx, ky, zFace);
  const knob = turned([[0.35, 0], [0.38, 0.6], [0.95, 1.1], [1.12, 1.6], [0.95, 2.15], [0.4, 2.4], [0.001, 2.42]], nickel, [0, 0, 0], 40);
  knob.rotation.x = Math.PI / 2; knob.position.set(kx, ky, zFace + 0.6);
  scene.add(rose, knob);
}

function buildDoors(opt) {
  const scene = new THREE.Scene();
  const trim = paint(TRIM, 0.36);
  const wall = wallPaint(WALL);
  const hw = DOOR_W / 2;
  scene.add(wallWithHoles(-140, 140, 0, 160, [[-hw - 0.75, hw + 0.75, 0, DOOR_H + 0.75]], 4.5, wall));
  oakFloor(scene, -140, 140, -60, 160);
  // Jambs, then flat casing mitred at the head
  scene.add(board(0.75, DOOR_H + 0.75, 4.5, trim, [-hw - 0.375, (DOOR_H + 0.75) / 2, -2.25], 0.04));
  scene.add(board(0.75, DOOR_H + 0.75, 4.5, trim, [hw + 0.375, (DOOR_H + 0.75) / 2, -2.25], 0.04));
  scene.add(board(DOOR_W + 1.5, 0.75, 4.5, trim, [0, DOOR_H + 0.375, -2.25], 0.04));
  const c = hw + REVEAL, top = DOOR_H + REVEAL, prof = flatProfile(3.5, 0.875);
  scene.add(placeSweep(sweep(prof, top, 0, 45), trim, [-c, 0, 0], [0, 1, 0], [-1, 0, 0]));
  scene.add(placeSweep(sweep(prof, top, 45, 0), trim, [c, top, 0], [0, -1, 0], [1, 0, 0]));
  scene.add(placeSweep(sweep(prof, 2 * c, 45, 45), trim, [-c, top, 0], [1, 0, 0], [0, 1, 0]));
  baseRun(scene, trim, -140, -c - 3.5);
  baseRun(scene, trim, c + 3.5, 140);
  // The room beyond, for the glass door
  const beyond = new THREE.Mesh(new THREE.PlaneGeometry(300, 300),
    new THREE.MeshBasicMaterial({ color: 0xcfc3b4, toneMapped: true }));
  beyond.position.set(0, 60, -120);
  scene.add(beyond);
  buildDoorSlab(scene, opt, trim, -hw, -1.0);

  interiorLight(scene, [0, 40, 0], [-150, 70, 95], 75, 3.0);
  const cam = camera([34, 44, 192], [0, 42, -2], 30);
  return { scene, camera: cam, exposure: 1.0, ao: {} };
}

// ================================================================== baseboard

function baseProfiles(opt) {
  if (opt === "modern") return [{ p: flatProfile(3.5, 0.625, 0.05), y: 0 }];
  if (opt === "colonial") return [{ p: colonialBase(3.25), y: 0 }];
  if (opt === "craftsman") return [{ p: flatProfile(5.25, 0.75, 0.05), y: 0 }, { p: capMoulding(1.1, 0.9), y: 5.25 }];
  if (opt === "tall") return [{ p: flatProfile(7.25, 0.75, 0.05), y: 0 }, { p: capMoulding(1.25, 0.95), y: 7.25 }];
  if (opt === "builtup") return [
    { p: flatProfile(9, 0.75, 0.05), y: 0 },
    { p: capMoulding(1.5, 1.0), y: 9 },
    { p: [[0, 0], [0.75, 0], ...arc(0, 0, 0.75, 0, 90, 10).slice(1)], y: 0, t: 0.75 },
  ];
  return [];
}

function buildBase(opt) {
  const scene = new THREE.Scene();
  const trim = paint(TRIM, 0.36);
  const wall = wallPaint(WALL);
  // An outside corner: the solid is x < 0, z < 0, and the room wraps round it
  scene.add(mesh(new THREE.BoxGeometry(200, 140, 200), wall, [-100, 70, -100]));
  oakFloor(scene, -200, 120, -200, 120);
  const L = 200;
  baseProfiles(opt).forEach(({ p, y, t = 0 }) => {
    // Along the face at z = 0, ending on a mitre through the depth at the corner
    scene.add(placeSweep(sweep(p, L + t, 0, 0, 38, { d1: 45 }), trim, [-L, y, t], [1, 0, 0], [0, 1, 0]));
    // Round the corner, along the face at x = 0
    scene.add(placeSweep(sweep(p, L + t, 0, 0, 38, { d0: 45 }), trim, [t, y, t], [0, 0, -1], [0, 1, 0]));
  });
  interiorLight(scene, [-6, 5, -6], [-35, 70, 100], 40, 3.0, { fill: 1.1, bounce: 0.45 });
  const cam = camera([40, 21, 45], [-5, 5.5, -5], 30);
  return { scene, camera: cam, exposure: 1.0, ao: { radius: 3 } };
}

// ================================================================== crown

const CEIL = 108;

/** Crown profiles in (drop down the wall, projection out onto the ceiling). */
function crownProfile(drop, proj) {
  return [
    [0, 0], [drop, 0], [drop, 0.22],
    [drop - 0.22, 0.3],
    ...sCurve([drop - 0.3, 0.42], [0.4, proj - 0.22], 14),
    [0.28, proj - 0.12], [0.28, proj], [0, proj],
  ];
}

function buildCrown(opt) {
  const scene = new THREE.Scene();
  const trim = paint(TRIM, 0.36);
  const wall = wallPaint(WALL);
  // An inside corner: the room is x > 0, z > 0
  scene.add(mesh(new THREE.BoxGeometry(220, CEIL, 8), wall, [110, CEIL / 2, -4]));
  scene.add(mesh(new THREE.BoxGeometry(8, CEIL, 220), wall, [-4, CEIL / 2, 110]));
  const ceil = mesh(new THREE.BoxGeometry(240, 4, 240), paint(0xefebe4, 0.9), [110, CEIL + 2, 110]);
  scene.add(ceil);

  const L = 220;
  const pieces = [];
  if (opt === "cove") pieces.push({ p: [[0, 0], [2.25, 0], ...arc(2.25, 2.25, 2.25, -90, -180, 12).slice(1)], drop: 0 });
  if (opt === "colonial") pieces.push({ p: crownProfile(3.625, 2.6), drop: 0 });
  if (opt === "large") pieces.push({ p: crownProfile(5.25, 3.7), drop: 0 });
  if (opt === "builtup") {
    pieces.push({ p: crownProfile(5.25, 3.7), drop: 0 });
    pieces.push({ p: flatProfile(5.5, 0.75, 0.05).map(([u, t]) => [u, t]), drop: 5.25 });
    pieces.push({ p: [[0, 0], [1.1, 0], ...arc(0.55, 0.75, 0.55, -90, 90, 10).map(([u, t]) => [u + 0.55, t]).slice(0), [0, 0.75]], drop: 10.75 });
  }
  pieces.forEach(({ p, drop }) => {
    const y = CEIL - drop;
    // Along the back wall (z = 0), running into the corner on an inside mitre
    scene.add(placeSweep(sweep(p, L, 0, 0, 38, { d1: -45 }), trim, [L, y, 0], [-1, 0, 0], [0, -1, 0]));
    // and out along the side wall (x = 0)
    scene.add(placeSweep(sweep(p, L, 0, 0, 38, { d0: -45 }), trim, [0, y, 0], [0, 0, 1], [0, -1, 0]));
  });
  interiorLight(scene, [10, 96, 10], [120, -12, 95], 60, 2.2, { bounce: 1.6, bounceColor: 0xf3eadf, fill: 0.5 });
  const cam = camera([58, 74, 66], [7, 99, 7], 30);
  return { scene, camera: cam, exposure: 1.05, ao: { radius: 4 } };
}

// ================================================================== wainscoting

const CHAIR = 36;

function chairRail() {
  return [
    [0, 0], [2.5, 0], [2.5, 0.5],
    ...arc(2.0, 0.55, 0.5, 0, 90, 6),
    [1.6, 1.05], ...arc(1.6, 0.55, 0.5, 90, 160, 4),
    ...sCurve([1.13, 0.72], [0.25, 0.5], 6),
    [0, 0.45],
  ];
}

function buildPanel(opt) {
  const scene = new THREE.Scene();
  const trim = paint(TRIM, 0.38);
  const wall = wallPaint(WALL);
  scene.add(mesh(new THREE.BoxGeometry(260, 160, 6), wall, [0, 80, -3]));
  oakFloor(scene, -130, 130, -10, 160);
  const X0 = -120, X1 = 120;
  const baseTop = 5.25 + 1.1;
  const zBack = 0;

  if (opt === "shiplap") {
    // Full height: horizontal boards with the narrow shadow gap that makes shiplap shiplap
    for (let y = 0; y < 150; y += 5.5) scene.add(board(X1 - X0, 5.3, 0.6, trim, [0, y + 2.65, 0.3], 0.04));
    baseRun(scene, trim, X0, X1);
  } else {
    baseRun(scene, trim, X0, X1);
    if (opt !== "none") {
      if (opt === "beadboard") {
        for (let x = X0; x < X1; x += 3.5) {
          scene.add(board(3.4, CHAIR - baseTop, 0.45, trim, [x + 1.75, (CHAIR + baseTop) / 2, 0.225], 0.03));
          const bead = mesh(new THREE.CylinderGeometry(0.13, 0.13, CHAIR - baseTop, 10), trim, [x + 3.45, (CHAIR + baseTop) / 2, 0.38]);
          scene.add(bead);
        }
      } else if (opt === "batten") {
        scene.add(board(X1 - X0, CHAIR - baseTop, 0.25, trim, [0, (CHAIR + baseTop) / 2, 0.125], 0.02));
        scene.add(board(X1 - X0, 3.5, 0.75, trim, [0, CHAIR - 1.75, 0.375], 0.06));
        for (let x = -108; x <= 108; x += 18) scene.add(board(2.5, CHAIR - 3.5 - baseTop, 0.75, trim, [x, (CHAIR - 3.5 + baseTop) / 2, 0.375], 0.06));
      } else if (opt === "frame") {
        scene.add(board(X1 - X0, CHAIR - baseTop, 0.12, trim, [0, (CHAIR + baseTop) / 2, 0.06], 0.02));
        const prof = [[0, 0], [1.25, 0], [1.25, 0.18], ...sCurve([1.18, 0.24], [0.3, 0.55], 8), [0.12, 0.55], [0, 0.45]];
        const y0 = baseTop + 3, y1 = CHAIR - 4, w = 25, gap = 4;
        for (let x = -116; x + w <= 118; x += w + gap) {
          const a = x, b = x + w;
          // Measured from the box's outer edge inward, so the inner edge is the short one
          scene.add(placeSweep(sweep(prof, w, -45, -45), trim, [a, y0, 0.12], [1, 0, 0], [0, 1, 0]));
          scene.add(placeSweep(sweep(prof, w, -45, -45), trim, [b, y1, 0.12], [-1, 0, 0], [0, -1, 0]));
          scene.add(placeSweep(sweep(prof, y1 - y0, -45, -45), trim, [b, y0, 0.12], [0, 1, 0], [-1, 0, 0]));
          scene.add(placeSweep(sweep(prof, y1 - y0, -45, -45), trim, [a, y1, 0.12], [0, -1, 0], [1, 0, 0]));
        }
      } else if (opt === "raised") {
        const s = new THREE.Shape();
        const h0 = baseTop, h1 = CHAIR;
        s.moveTo(X0, h0); s.lineTo(X1, h0); s.lineTo(X1, h1); s.lineTo(X0, h1); s.lineTo(X0, h0);
        const pw = 24, gap = 4.5, py0 = h0 + 4, py1 = h1 - 4;
        const holes = [];
        for (let x = -116 + gap; x + pw <= 118; x += pw + gap) holes.push([x, x + pw]);
        holes.forEach(([a, b]) => {
          const h = new THREE.Path();
          h.moveTo(a, py0); h.lineTo(a, py1); h.lineTo(b, py1); h.lineTo(b, py0); h.lineTo(a, py0);
          s.holes.push(h);
        });
        const g = new THREE.ExtrudeGeometry(s, { depth: 0.6, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 });
        scene.add(mesh(g, trim));
        holes.forEach(([a, b]) => {
          const w = b - a, h = py1 - py0, bev = 1.3;
          const ps = new THREE.Shape();
          ps.moveTo(-w / 2 + bev, -h / 2 + bev); ps.lineTo(w / 2 - bev, -h / 2 + bev);
          ps.lineTo(w / 2 - bev, h / 2 - bev); ps.lineTo(-w / 2 + bev, h / 2 - bev); ps.lineTo(-w / 2 + bev, -h / 2 + bev);
          const pg = new THREE.ExtrudeGeometry(ps, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.25, bevelSize: bev - 0.05, bevelSegments: 1 });
          pg.translate((a + b) / 2, (py0 + py1) / 2, 0.15);
          scene.add(mesh(pg, trim));
        });
      }
      scene.add(placeSweep(sweep(chairRail(), X1 - X0), trim, [X0, CHAIR, 0.6], [1, 0, 0], [0, 1, 0]));
    }
  }
  interiorLight(scene, [0, 30, 0], [-150, 70, 95], 70, 3.0);
  const cam = camera([34, 46, 132], [0, 30, 0], 30);
  return { scene, camera: cam, exposure: 1.0, ao: {} };
}

// ================================================================== built-ins

/** A ceiling that's in shot: lit by bounce, and casting no shadow of its own. */
function ceiling(scene, y, w, d, z) {
  const c = mesh(new THREE.BoxGeometry(w, 4, d), paint(0xefebe4, 0.9), [0, y + 2, z]);
  c.castShadow = false;
  scene.add(c);
}

const BOOK_COLORS = [0x6e2b26, 0x26344f, 0x2f4a3a, 0xa8823e, 0xe4dccb, 0x1f1f1f, 0x8a6a4a,
  0x5c5f63, 0x7d3a52, 0xc9b48f, 0x3c5a6b, 0x9b5a34];

/** Fill a shelf with books: mixed heights and colours, the odd one leaning, a stack. */
function books(scene, x0, x1, y, maxH, zBack, seed) {
  const R = rand(seed);
  const mats = BOOK_COLORS.map((c) => paint(c, 0.6));
  let x = x0 + 0.3;
  while (x < x1 - 1.2) {
    const r = R();
    if (r < 0.07 && x1 - x > 9) {
      // a short horizontal stack
      let yy = y;
      for (let i = 0; i < 3 + Math.floor(R() * 3); i++) {
        const t = 0.9 + R() * 0.8, w = 7 + R() * 2;
        scene.add(board(w, t, 6 + R() * 2, mats[Math.floor(R() * mats.length)], [x + w / 2, yy + t / 2, zBack + 4.2], 0.08));
        yy += t;
      }
      x += 9.5;
      continue;
    }
    if (r < 0.12) { x += 1.5 + R() * 3; continue; }   // a gap
    const w = 0.75 + R() * 1.4, h = Math.min(maxH - 0.6, 7.2 + R() * 3.6), d = 6 + R() * 2.5;
    const b = board(w, h, d, mats[Math.floor(R() * mats.length)], [x + w / 2, y + h / 2, zBack + d / 2 + 0.4], 0.07);
    if (R() < 0.05 && x1 - x > 4) { b.rotation.z = -0.22; b.position.x += 1.0; x += 1.2; }
    scene.add(b);
    x += w + 0.04;
  }
}

/** A plain stoneware vase and a small potted plant, so a shelf isn't only books. */
function shelfThings(scene, x, y, z, seed) {
  const R = rand(seed);
  const pot = paint([0xe9e2d6, 0x3d3f3c, 0x9a6b4b][Math.floor(R() * 3)], 0.5);
  scene.add(turned([[0, 0], [1.6, 0], [2.1, 1.5], [2.3, 4], [1.6, 6.5], [1.0, 7.4], [1.15, 8.2], [0.001, 8.2]], pot, [x, y, z], 32));
  const leaf = paint(0x4d6b3d, 0.7);
  for (let i = 0; i < 7; i++) {
    const s = mesh(new THREE.IcosahedronGeometry(1.4 + R() * 0.9, 1), leaf,
      [x + 7 + (R() - 0.5) * 4, y + 6 + R() * 3, z + (R() - 0.5) * 3]);
    scene.add(s);
  }
  scene.add(turned([[0, 0], [2.2, 0], [2.4, 4.5], [0.001, 4.5]], paint(0xc9b9a3, 0.8), [x + 7, y, z], 24));
}

function shakerDoor(scene, mat, x, y, w, h, z) {
  const st = 2.5;
  scene.add(board(w, h, 0.75, mat, [x + w / 2, y + h / 2, z - 0.375], 0.05));
  scene.add(board(w - 2 * st + 0.2, h - 2 * st + 0.2, 0.75, mat, [x + w / 2, y + h / 2, z - 0.375 - 0.28], 0.03));
  // stiles and rails stand proud of the recessed panel
  scene.add(board(st, h, 0.3, mat, [x + st / 2, y + h / 2, z + 0.15], 0.04));
  scene.add(board(st, h, 0.3, mat, [x + w - st / 2, y + h / 2, z + 0.15], 0.04));
  scene.add(board(w - 2 * st, st, 0.3, mat, [x + w / 2, y + st / 2, z + 0.15], 0.04));
  scene.add(board(w - 2 * st, st, 0.3, mat, [x + w / 2, y + h - st / 2, z + 0.15], 0.04));
  const pull = metal("satinbrass");
  pull.roughness = 0.4;
  scene.add(mesh(new THREE.CapsuleGeometry(0.2, 3.2, 4, 10), pull, [x + w - 1.25, y + h - 5, z + 0.75]));
}

function lowerCabinets(scene, trim, x0, x1, depth, seed) {
  const w = x1 - x0, H = 34.5;
  scene.add(board(w, 3.5, depth - 3, paint(0x2b2a28, 0.8), [(x0 + x1) / 2, 1.75, (depth - 3) / 2], 0.02));
  scene.add(board(w, H - 3.5, depth, trim, [(x0 + x1) / 2, 3.5 + (H - 3.5) / 2, depth / 2], 0.05));
  const n = Math.round(w / 21);
  const dw = (w - 1) / n;
  for (let i = 0; i < n; i++) shakerDoor(scene, trim, x0 + 0.5 + i * dw + 0.06, 4, dw - 0.12, H - 4.5, depth + 0.76);
  const top = woodMat(woodTexture("walnut", { base: 0x7a5236, dark: 0x4a2e1c, ring: 40, wobble: 6, seed: 9 }), { rough: 0.4, clear: true });
  scene.add(woodBoard(w + 2, 1.5, depth + 1.2, top, [(x0 + x1) / 2, H + 0.75, (depth + 1.2) / 2], "x", 0.12, 30));
}

function caseSides(scene, trim, xs, y0, y1, depth) {
  xs.forEach((x) => scene.add(board(0.75, y1 - y0, depth, trim, [x, (y0 + y1) / 2, depth / 2], 0.05)));
}

function buildBuiltin(opt) {
  const scene = new THREE.Scene();
  const trim = paint(TRIM, 0.38);
  const wall = wallPaint(WALL);
  const CEIL_H = 108;
  scene.add(mesh(new THREE.BoxGeometry(280, CEIL_H, 6), wall, [0, CEIL_H / 2, -3]));
  ceiling(scene, CEIL_H, 280, 120, 50);
  oakFloor(scene, -140, 140, -10, 180);
  const D = 14;

  if (opt === "floating") {
    baseRun(scene, trim, -140, 140);
    const oak = woodMat(woodTexture("white-oak", { base: 0xb48f68, dark: 0x7f6146, ring: 55, wobble: 7, seed: 12 }), { rough: 0.5 });
    [40, 56, 72].forEach((y, i) => {
      scene.add(woodBoard(72, 2, 10, oak, [0, y, 5], "x", 0.12, 40));
      books(scene, -35, i === 1 ? 6 : 22, y + 1, 13, 0.2, 31 + i);
      if (i !== 1) shelfThings(scene, 25, y + 1, 4.5, 40 + i);
      else shelfThings(scene, 12, y + 1, 4.5, 44);
    });
  } else {
    const wide = opt === "library";
    const X0 = wide ? -66 : -42, X1 = -X0;
    const top = wide ? CEIL_H : 96;
    const bays = wide ? 3 : 2;
    const bw = (X1 - X0) / bays;
    // Back, sides, dividers, toe kick
    scene.add(board(X1 - X0, top, 0.5, trim, [0, top / 2, 0.25], 0.02));
    caseSides(scene, trim, Array.from({ length: bays + 1 }, (_, i) => X0 + i * bw + (i === 0 ? 0.375 : i === bays ? -0.375 : 0)), 0, top, D);
    let shelfFrom = 4;
    if (opt === "cabinet" || opt === "glass") {
      lowerCabinets(scene, trim, X0, X1, D + 2, 7);
      shelfFrom = 36;
    } else {
      scene.add(board(X1 - X0, 3.5, D - 2.5, paint(0x2b2a28, 0.8), [0, 1.75, (D - 2.5) / 2], 0.02));
      scene.add(board(X1 - X0, 0.75, D, trim, [0, 3.875, D / 2], 0.04));
    }
    const shelves = [];
    const step = opt === "glass" ? 16 : 15;
    const start = opt === "glass" ? 48 : shelfFrom;
    for (let y = start; y < top - 10; y += step) shelves.push(y);
    shelves.forEach((y, si) => {
      for (let b = 0; b < bays; b++) {
        const a = X0 + b * bw + 0.75, z = X0 + (b + 1) * bw - 0.75;
        if (y !== start || opt === "open" || opt === "library" || opt === "glass") {
          scene.add(board(z - a, 1.0, D - 0.5, trim, [(a + z) / 2, y + 0.5, (D - 0.5) / 2 + 0.5], 0.05));
        }
        const thing = (b + si) % 3 === 1 && !wide;
        books(scene, a, thing ? z - 15 : z, y + 1, step - 1.5, 0.5, 100 + si * 7 + b);
        if (thing) shelfThings(scene, z - 14, y + 1, 5, 200 + si + b);
      }
    });
    // Top: a cap and a small crown, or into the ceiling for the library
    if (!wide) {
      scene.add(board(X1 - X0 + 2, 1.5, D + 1.5, trim, [0, top + 0.75, (D + 1.5) / 2], 0.1));
    }
    if (opt === "glass") {
      // Glass doors over the uppers
      const gy0 = 48, gy1 = top;
      for (let b = 0; b < bays; b++) {
        const a = X0 + b * bw + 0.5, z = X0 + (b + 1) * bw - 0.5, half = (z - a) / 2;
        [a, a + half].forEach((dx) => {
          const st = 2.25, w = half - 0.15, h = gy1 - gy0 - 0.3, zz = D + 0.4;
          scene.add(board(st, h, 0.9, trim, [dx + st / 2, gy0 + h / 2, zz], 0.05));
          scene.add(board(st, h, 0.9, trim, [dx + w - st / 2, gy0 + h / 2, zz], 0.05));
          scene.add(board(w, st, 0.9, trim, [dx + w / 2, gy0 + st / 2, zz], 0.05));
          scene.add(board(w, st, 0.9, trim, [dx + w / 2, gy0 + h - st / 2, zz], 0.05));
          const g = new THREE.Mesh(new THREE.PlaneGeometry(w - 2 * st, h - 2 * st),
            new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.14, roughness: 0.05, envMapIntensity: 1.0 }));
          g.position.set(dx + w / 2, gy0 + h / 2, zz);
          scene.add(g);
        });
      }
    }
    if (wide) {
      // A rolling library ladder on a rail
      const iron = metal("black");
      const rail = mesh(new THREE.CylinderGeometry(0.5, 0.5, X1 - X0 - 4, 16), iron, [0, 88, D + 2.5]);
      rail.rotation.z = Math.PI / 2;
      scene.add(rail);
      const oak = woodMat(woodTexture("white-oak", { base: 0xb48f68, dark: 0x7f6146, ring: 55, wobble: 7, seed: 12 }), { rough: 0.5 });
      const lx = 14, topZ = D + 2.5, botZ = D + 30, topY = 88, botY = 0;
      const len = Math.hypot(topY - botY, botZ - topZ);
      const lean = Math.atan2(botZ - topZ, topY - botY);
      const ladder = new THREE.Group();
      [-8, 8].forEach((dx) => ladder.add(woodBoard(1.5, len, 3, oak, [dx, len / 2, 0], "y", 0.15, 40)));
      for (let y = 10; y < len - 4; y += 11) ladder.add(woodBoard(16, 1.25, 3.2, oak, [0, y, 0], "x", 0.15, 40));
      ladder.position.set(lx, botY, botZ);
      ladder.rotation.x = lean;
      scene.add(ladder);
    }
  }
  interiorLight(scene, [0, 50, 6], [-150, 70, 110], 85, 2.9, { fill: 0.4, bounce: 0.9, bounceColor: 0xf1e7da });
  const cam = camera([44, 54, 236], [0, 52, 4], 30);
  return { scene, camera: cam, exposure: 1.02, ao: {} };
}

// ================================================================== mantels

function buildMantel(opt) {
  const scene = new THREE.Scene();
  const trim = paint(TRIM, 0.38);
  const wall = wallPaint(WALL);
  const FW = 36, FH = 30;
  scene.add(wallWithHoles(-150, 150, 0, 130, [[-FW / 2, FW / 2, 0, FH]], 6, wall));
  oakFloor(scene, -150, 150, -10, 180);

  // Firebox: sooty brick inside, a few logs
  const soot = new THREE.MeshStandardMaterial({ map: brickTexture("soot", { base: 0x3a2a24, mortar: 0x4a4440 }), roughness: 0.95, color: 0x777777 });
  scene.add(box(FW, FH, 0.5, soot, [0, FH / 2, -18]));
  scene.add(box(0.5, FH, 18, soot, [-FW / 2 + 0.25, FH / 2, -9]));
  scene.add(box(0.5, FH, 18, soot, [FW / 2 - 0.25, FH / 2, -9]));
  scene.add(box(FW, 0.5, 18, soot, [0, FH - 0.25, -9]));
  scene.add(box(FW, 0.5, 18, paint(0x2a2522, 0.95), [0, 0.25, -9]));
  const bark = woodMat(woodTexture("bark", { base: 0x4a3626, dark: 0x271a12, ring: 22, wobble: 4, streak: 0.8, seed: 15 }), { rough: 0.9 });
  [[-6, 2.6, -9, 0.3], [5, 2.6, -10, -0.2], [0, 6.6, -9.5, 0.08]].forEach(([x, y, z, r]) => {
    const log = mesh(new THREE.CylinderGeometry(2.4, 2.6, 22, 12), bark, [x, y, z]);
    log.rotation.z = Math.PI / 2; log.rotation.y = r;
    scene.add(log);
  });

  // Surround and hearth in honed slate, the same on every option
  const slate = new THREE.MeshStandardMaterial({ map: paintTexture("slate", 0x3c3b3a, 0.06, 6), roughness: 0.55, envMapIntensity: 0.55 });
  const surround = new THREE.Shape();
  surround.moveTo(-FW / 2 - 7, 0); surround.lineTo(FW / 2 + 7, 0); surround.lineTo(FW / 2 + 7, FH + 7);
  surround.lineTo(-FW / 2 - 7, FH + 7); surround.lineTo(-FW / 2 - 7, 0);
  const sh = new THREE.Path();
  sh.moveTo(-FW / 2, 0); sh.lineTo(-FW / 2, FH); sh.lineTo(FW / 2, FH); sh.lineTo(FW / 2, 0); sh.lineTo(-FW / 2, 0);
  surround.holes.push(sh);
  const sg = new THREE.ExtrudeGeometry(surround, { depth: 0.6, bevelEnabled: false });
  scene.add(mesh(sg, slate));
  scene.add(board(FW + 30, 1.5, 18, slate, [0, 0.75, 9], 0.08));

  const shelfY = 54;
  if (opt === "beam") {
    const beamWood = woodMat(woodTexture("reclaimed", { base: 0x86613f, dark: 0x4a301d, ring: 45, wobble: 9, streak: 0.8, knots: 4, seed: 21 }), { rough: 0.72 });
    scene.add(woodBoard(72, 8, 8, beamWood, [0, shelfY + 4, 4], "x", 0.35, 50));
  } else {
    // Legs, frieze and shelf - the craftsman bones every other option builds on
    const legW = opt === "colonial" ? 6 : 7;
    const legX = FW / 2 + 7 + legW / 2 - 1;
    const friezeH = 10, friezeY = shelfY - friezeH;
    if (opt === "colonial") {
      const fl = flutedCasing(legW, 1.1);
      [-1, 1].forEach((s) => {
        scene.add(board(legW + 1, 8, 1.6, trim, [s * legX, 4, 0.8], 0.08));   // plinth block
        // Fluted pilaster standing on it, flutes running up
        scene.add(placeSweep(sweep(fl, friezeY - 8), trim, [s * legX + legW / 2, 8, 0], [0, 1, 0], [-1, 0, 0]));
      });
    } else {
      [-1, 1].forEach((s) => scene.add(board(legW, friezeY, 1.0, trim, [s * legX, friezeY / 2, 0.5], 0.08)));
    }
    scene.add(board(2 * legX + legW, friezeH, 1.0, trim, [0, friezeY + friezeH / 2, 0.5], 0.08));
    if (opt === "colonial") {
      // a centre panel on the frieze and crown under the shelf
      scene.add(board(24, 6, 0.4, trim, [0, friezeY + 5, 1.2], 0.08));
      const cr = [[0, 0], [2.6, 0], [2.6, 0.2], ...sCurve([2.4, 0.3], [0.3, 2.2], 12), [0, 2.2]];
      const run = 2 * legX + legW + 1.0;
      scene.add(placeSweep(sweep(cr, run), trim, [run / 2, shelfY, 1.0], [-1, 0, 0], [0, -1, 0]));
    } else {
      // two simple corbels
      [-1, 1].forEach((s) => scene.add(board(2.5, 6, 4, trim, [s * (legX - 1), shelfY - 3, 2.6], 0.12)));
    }
    scene.add(board(2 * legX + legW + 6, 1.75, 9.5, trim, [0, shelfY + 0.875, 4.75], 0.18));

    if (opt === "overmantel") {
      // Panelled to the ceiling above the shelf
      const y0 = shelfY + 1.75, y1 = 108, w = 2 * legX + legW;
      scene.add(board(w, y1 - y0, 0.75, trim, [0, (y0 + y1) / 2, 0.375], 0.04));
      const st = 3.5;
      [[-w / 2 + st / 2], [w / 2 - st / 2], [0]].forEach(([x]) => scene.add(board(st, y1 - y0, 0.6, trim, [x, (y0 + y1) / 2, 1.05], 0.06)));
      [y0 + st / 2, y1 - 6 - st / 2].forEach((y) => scene.add(board(w, st, 0.6, trim, [0, y, 1.05], 0.06)));
      scene.add(board(w + 3, 5.5, 2.5, trim, [0, y1 - 2.75, 1.25], 0.1));
    }
  }
  ceiling(scene, 108, 300, 120, 50);
  interiorLight(scene, [0, 44, 4], [-150, 75, 110], 80, 2.9, { fill: 0.4, bounce: 0.9, bounceColor: 0xf1e7da });
  const cam = camera([38, 54, 222], [0, 51, 2], 30);
  return { scene, camera: cam, exposure: 1.02, ao: {} };
}

// ================================================================== outdoor kit

/** Sky with a tree line, a lawn, and an afternoon sun. */
function outdoors(scene, { groundY = -30, at, from = [-90, 120, 90], size = 90, intensity = 3.3, bounce = 0.6, bounceColor = 0x7d8c64 }) {
  scene.environment = studioEnv();
  scene.background = new THREE.Color(0xcddce6);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(2600, 1300),
    new THREE.MeshBasicMaterial({ map: skyTexture(), toneMapped: false, color: 0xeeeeee }));
  sky.position.set(0, 220, -950);
  scene.add(sky);
  const lawn = new THREE.PlaneGeometry(3200, 2200);
  lawn.rotateX(-Math.PI / 2);
  const g = new THREE.Mesh(lawn, new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1, color: 0xd6dcc8 }));
  g.position.set(0, groundY, -100);
  g.receiveShadow = true;
  scene.add(g);
  scene.add(new THREE.HemisphereLight(0xd6e6f2, bounceColor, bounce));
  sun(scene, { from, at, size, intensity, color: 0xfff0d8 });
}

const cedarTex = () => woodTexture("cedar", { base: 0xae7a54, dark: 0x744a2f, ring: 70, wobble: 7, streak: 0.5, contrast: 0.45, seed: 33 });

/** Deck boards, each its own board with a real gap, running along `along`. */
function deckBoards(scene, mat, { along = "z", x0, x1, z0, z1, w = 5.5, gap = 0.25 }) {
  if (along === "z") {
    for (let x = x0; x < x1; x += w + gap) scene.add(woodBoard(w, 1, z1 - z0, mat, [x + w / 2, -0.5, (z0 + z1) / 2], "z", 0.12, 60));
  } else {
    for (let z = z0; z < z1; z += w + gap) scene.add(woodBoard(x1 - x0, 1, w, mat, [(x0 + x1) / 2, -0.5, z + w / 2], "x", 0.12, 60));
  }
}

// ================================================================== deck railing

function buildRailing(opt) {
  const scene = new THREE.Scene();
  const white = paint(TRIM, 0.45);
  const cedar = woodMat(cedarTex(), { rough: 0.62 });
  deckBoards(scene, cedar, { along: "z", x0: -90, x1: 90, z0: -18, z1: 110 });
  scene.add(board(190, 9.25, 1.5, white, [0, -5.6, -18.75], 0.08));        // rim board
  const Z = -15.5, PX = 36, top = 40;
  [-PX, PX].forEach((x) => scene.add(board(3.5, top, 3.5, white, [x, top / 2, Z], 0.12)));
  scene.add(board(2 * PX + 22, 1.5, 5.5, white, [0, top + 0.75, Z], 0.14));                 // cap
  const inner = 2 * PX - 3.5;
  scene.add(board(inner, 3.5, 1.5, white, [0, top - 1.75, Z], 0.08));                       // top rail
  scene.add(board(inner, 1.5, 3.5, white, [0, 4.25, Z], 0.08));                             // bottom rail
  const x0 = -PX + 1.75, x1 = PX - 1.75, y0 = 5, y1 = top - 3.5;

  if (opt === "metal") {
    const black = metal("black");
    for (let x = x0 + 2.4; x < x1 - 1; x += 4.5) {
      scene.add(mesh(new THREE.CylinderGeometry(0.375, 0.375, y1 - y0, 14), black, [x, (y0 + y1) / 2, Z]));
    }
  } else if (opt === "picket") {
    for (let x = x0 + 2.5; x < x1 - 1; x += 5.2) scene.add(board(1.5, y1 - y0, 1.5, white, [x, (y0 + y1) / 2, Z], 0.1));
  } else if (opt === "cable") {
    const steel = metal("nickel");
    steel.roughness = 0.25;
    for (let y = y0 + 2.5; y < y1 - 1; y += 3) {
      const c = mesh(new THREE.CylinderGeometry(0.09, 0.09, x1 - x0, 8), steel, [0, y, Z]);
      c.rotation.z = Math.PI / 2;
      scene.add(c);
    }
  } else if (opt === "slat") {
    for (let y = y0 + 1; y + 3.5 <= y1; y += 4.1) scene.add(board(x1 - x0, 3.5, 0.75, white, [0, y + 1.75, Z], 0.08));
  } else if (opt === "glass") {
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0xf4fbf8, transmission: 0.96, roughness: 0.02, metalness: 0, ior: 1.5, thickness: 0.5,
      transparent: true, opacity: 0.9, envMapIntensity: 1.2,
    });
    scene.add(mesh(new THREE.BoxGeometry(x1 - x0 - 1, y1 - y0 - 1, 0.5), glass, [0, (y0 + y1) / 2, Z]));
    const steel = metal("nickel");
    [[x0 + 6, y0 + 2], [x1 - 6, y0 + 2], [x0 + 6, y1 - 2], [x1 - 6, y1 - 2]].forEach(([x, y]) =>
      scene.add(board(2, 1.4, 1.4, steel, [x, y, Z], 0.15)));
  }
  outdoors(scene, { groundY: -38, at: [0, 22, -16], from: [-110, 130, 70], size: 70 });
  const cam = camera([28, 62, 90], [0, 34, -16], 32);
  return { scene, camera: cam, exposure: 0.95, ao: {} };
}

// ================================================================== deck boards

function deckMaterial(opt) {
  if (opt === "cedar") return woodMat(cedarTex(), { rough: 0.6 });
  if (opt === "treated") return woodMat(woodTexture("treated", { base: 0xbd9861, dark: 0x8a6838, ring: 60, wobble: 8, streak: 0.4, knots: 6, contrast: 0.45, seed: 41 }), { rough: 0.62 });
  if (opt === "grey") return woodMat(woodTexture("composite-grey", { base: 0x928d86, dark: 0x6d6964, ring: 70, wobble: 4, streak: 0.9, tone: 0.05, contrast: 0.22, seed: 42 }), { rough: 0.72 });
  if (opt === "brown") return woodMat(woodTexture("composite-brown", { base: 0x6f4d37, dark: 0x452c1d, ring: 70, wobble: 4, streak: 0.9, tone: 0.05, contrast: 0.25, seed: 43 }), { rough: 0.68 });
  if (opt === "ipe") return woodMat(woodTexture("ipe", { base: 0x83482b, dark: 0x51281a, ring: 120, wobble: 5, streak: 0.55, contrast: 0.4, seed: 44 }), { rough: 0.42, clear: true });
  return paint(0x888888);
}

function buildDecking(opt) {
  const scene = new THREE.Scene();
  const white = paint(TRIM, 0.45);
  deckBoards(scene, deckMaterial(opt), { along: "x", x0: -100, x1: 100, z0: -80, z1: 70 });
  scene.add(board(210, 9.25, 1.5, white, [0, -5.6, -80.75], 0.08));
  // A plain railing at the far edge, so it reads as a deck and not a floor
  const Z = -77.5;
  [-60, 0, 60].forEach((x) => scene.add(board(3.5, 40, 3.5, white, [x, 20, Z], 0.12)));
  scene.add(board(140, 1.5, 5.5, white, [0, 40.75, Z], 0.14));
  scene.add(board(130, 1.5, 3.5, white, [0, 4.25, Z], 0.08));
  for (let x = -57; x < 58; x += 5) if (Math.abs(x) > 2.5) scene.add(board(1.5, 31, 1.5, white, [x, 20.5, Z], 0.1));
  outdoors(scene, { groundY: -38, at: [0, 0, -20], from: [-110, 140, 40], size: 95 });
  const cam = camera([6, 66, 78], [0, 2, -26], 34);
  return { scene, camera: cam, exposure: 0.95, ao: {} };
}

// ================================================================== porch ceiling

function buildCeiling(opt) {
  const scene = new THREE.Scene();
  const white = paint(TRIM, 0.45);
  const Y = 108;
  let mat;
  if (opt === "stained") mat = woodMat(woodTexture("ceiling-stain", { base: 0x9a6a43, dark: 0x5c3b22, ring: 60, wobble: 7, seed: 51 }), { rough: 0.5, clear: true });
  if (opt === "cedar") mat = woodMat(woodTexture("ceiling-cedar", { base: 0xc49a6d, dark: 0x8c6341, ring: 60, wobble: 7, seed: 52 }), { rough: 0.6 });
  if (opt === "pine") mat = woodMat(woodTexture("knotty-pine", { base: 0xd6ad78, dark: 0xa1733f, ring: 55, wobble: 7, knots: 9, seed: 53 }), { rough: 0.45, clear: true });
  if (opt === "white" || opt === "beadboard") mat = paint(TRIM, 0.5);
  if (opt === "haint") mat = paint(0xb2cfc9, 0.5);
  const bw = opt === "beadboard" ? 1.75 : 3.5;
  for (let z = -100; z < 80; z += bw) {
    const b = opt === "beadboard"
      ? board(220, 0.6, bw - 0.08, mat, [0, Y + 0.3, z + bw / 2], 0.03)
      : woodBoard(220, 0.75, bw - 0.3, mat, [0, Y + 0.375, z + bw / 2], "x", 0.1, 50);
    scene.add(b);
    if (opt === "beadboard") {
      const bead = mesh(new THREE.CylinderGeometry(0.12, 0.12, 220, 8), mat, [0, Y - 0.02, z]);
      bead.rotation.z = Math.PI / 2;
      scene.add(bead);
    }
  }
  // The beam at the porch edge, and a column under it
  scene.add(board(230, 7.25, 5.5, white, [0, Y - 3.625, -103], 0.12));
  scene.add(board(8, Y - 7.25, 8, white, [-30, (Y - 7.25) / 2, -103], 0.12));
  // The porch floor, in shade
  const floor = paint(0x8f9290, 0.6);
  for (let x = -110; x < 110; x += 3.6) scene.add(board(3.5, 0.75, 180, floor, [x + 1.75, -0.375, -10], 0.04));
  // Light comes up off the floor and the lawn: that's what lights a porch ceiling
  outdoors(scene, { groundY: -24, at: [0, 60, -60], from: [-140, 160, -160], size: 140, intensity: 3.0, bounce: 2.3, bounceColor: 0xd9d2c3 });
  const cam = camera([20, 56, 46], [0, 104, -46], 42);
  return { scene, camera: cam, exposure: 1.12, ao: { radius: 3 } };
}

// ================================================================== porch columns

function buildColumns(opt) {
  const scene = new THREE.Scene();
  const white = paint(TRIM, 0.42);
  const Y = 108, BEAM = 7.25, CX = 0, CZ = -30;
  const top = Y - BEAM;
  const floor = paint(0x8f9290, 0.55);
  for (let x = -110; x < 110; x += 3.6) scene.add(board(3.5, 0.75, 100, floor, [x + 1.75, -0.375, 10], 0.04));
  scene.add(board(230, 7.25, 1.5, white, [0, -4, -40.75], 0.06));                 // skirt
  scene.add(board(230, BEAM, 6, white, [0, Y - BEAM / 2, CZ], 0.12));
  scene.add(board(230, 0.75, 110, paint(0xeeeae2, 0.6), [0, Y + 0.375, 20], 0.04));

  if (opt === "box") {
    scene.add(board(8, top, 8, white, [CX, top / 2, CZ], 0.12));
    scene.add(board(10, 8, 10, white, [CX, 4, CZ], 0.12));
    scene.add(board(9, 0.75, 9, white, [CX, 8.4, CZ], 0.2));
    scene.add(board(10, 4, 10, white, [CX, top - 2, CZ], 0.12));
    scene.add(board(11, 1.25, 11, white, [CX, top - 4.6, CZ], 0.3));
  } else if (opt === "tapered") {
    const brick = new THREE.MeshStandardMaterial({ map: brickTexture("pier"), roughness: 0.9 });
    scene.add(mesh(new THREE.BoxGeometry(20, 36, 20), brick, [CX, 18, CZ]));
    scene.add(board(23, 2.5, 23, paint(0xb9b4ab, 0.8), [CX, 37.25, CZ], 0.2));
    const h = top - 38.5 - 5;
    const fr = new THREE.CylinderGeometry(8 / Math.SQRT2, 12 / Math.SQRT2, h, 4, 1).toNonIndexed();
    fr.rotateY(Math.PI / 4);
    fr.computeVertexNormals();
    scene.add(mesh(fr, white, [CX, 38.5 + 1.5 + h / 2, CZ]));
    scene.add(board(14, 3, 14, white, [CX, 38.5 + 1.5, CZ], 0.15));
    scene.add(board(11, 3.5, 11, white, [CX, top - 1.75, CZ], 0.15));
    scene.add(board(12.5, 1.25, 12.5, white, [CX, top - 4, CZ], 0.3));
  } else if (opt === "tuscan") {
    scene.add(board(12.5, 2, 12.5, white, [CX, 1, CZ], 0.12));
    const prof = [[6.1, 0], [6.1, 0.6], [5.7, 1.6], [5.0, 2.2], [4.95, 3], [4.85, 20], [4.6, 50], [4.2, 82],
      [4.05, 87], [4.5, 87.4], [4.5, 88.6], [4.05, 89], [4.0, 91.5], [4.3, 93], [5.2, 94.8], [5.6, 95.8], [5.6, top - 4.2]];
    scene.add(turned(prof, white, [CX, 2, CZ], 56));
    scene.add(board(12.5, 2.25, 12.5, white, [CX, top - 1.125, CZ], 0.12));
  } else if (opt === "turned") {
    scene.add(board(5.5, 32, 5.5, white, [CX, 16, CZ], 0.25));
    scene.add(board(5.5, top - 86, 5.5, white, [CX, (86 + top) / 2, CZ], 0.25));
    const prof = [[2.4, 0], [2.6, 0.8], [2.0, 1.6], [1.6, 3], [2.5, 5], [2.75, 6.5], [2.2, 8], [1.5, 10],
      [1.4, 16], [2.2, 26], [2.6, 32], [2.3, 37], [1.6, 40], [1.4, 43], [2.1, 45], [2.6, 47.5], [2.0, 50], [2.4, 52], [2.4, 54]];
    scene.add(turned(prof, white, [CX, 32, CZ], 40));
  } else if (opt === "timber") {
    const rough = woodMat(woodTexture("rough-cedar", { base: 0x8c5f3e, dark: 0x5a3922, ring: 60, wobble: 9, streak: 0.9, knots: 3, seed: 61 }), { rough: 0.85 });
    scene.add(woodBoard(7.5, top - 3, 7.5, rough, [CX, 3 + (top - 3) / 2, CZ], "y", 0.35, 60));
    scene.add(board(8.5, 3, 8.5, metal("black"), [CX, 1.5, CZ], 0.1));
  }
  outdoors(scene, { groundY: -24, at: [0, 50, -30], from: [-120, 150, 120], size: 90, bounce: 0.8, bounceColor: 0xb5b2a4 });
  const cam = camera([46, 54, 168], [0, 52, -30], 32);
  return { scene, camera: cam, exposure: 0.98, ao: {} };
}

// ================================================================== fences

function buildFence(opt) {
  const scene = new THREE.Scene();
  const cedar = woodMat(cedarTex(), { rough: 0.66 });
  const white = paint(TRIM, 0.45);
  const posts = [-96, 0, 96];
  const tall = opt !== "picket";
  const H = tall ? 72 : 42;
  const postMat = opt === "picket" ? white : cedar;
  posts.forEach((x) => scene.add(woodBoard(3.5, H + (opt === "picket" ? 4 : 0), 3.5, postMat, [x, (H + (opt === "picket" ? 4 : 0)) / 2, -1.75], "y", 0.12, 60)));
  const rails = tall ? [8, 36, 64] : [8, 32];
  rails.forEach((y) => scene.add(woodBoard(196, 3.5, 1.5, postMat, [0, y, -0.75], "x", 0.08, 60)));

  if (opt === "privacy") {
    for (let x = -100; x < 100; x += 5.625) scene.add(woodBoard(5.5, H, 0.75, cedar, [x + 2.75, H / 2, 0.375], "y", 0.06, 60));
  } else if (opt === "shadowbox") {
    for (let x = -100; x < 100; x += 9) {
      scene.add(woodBoard(5.5, H, 0.75, cedar, [x + 2.75, H / 2, 0.375], "y", 0.06, 60));
      scene.add(woodBoard(5.5, H, 0.75, cedar, [x + 7.25, H / 2, -1.875], "y", 0.06, 60));
    }
  } else if (opt === "horizontal") {
    const dark = woodMat(woodTexture("cedar-dark", { base: 0x6e4b33, dark: 0x45291a, ring: 70, wobble: 7, contrast: 0.45, seed: 34 }), { rough: 0.6 });
    for (let y = 1; y + 5.5 <= H; y += 6) scene.add(woodBoard(196, 5.5, 0.75, dark, [0, y + 2.75, 0.375], "x", 0.06, 60));
    scene.add(woodBoard(198, 1.5, 3.5, dark, [0, H + 0.75, -0.5], "x", 0.1, 60));
  } else if (opt === "picket") {
    const pk = new THREE.Shape();
    pk.moveTo(-1.75, 0); pk.lineTo(1.75, 0); pk.lineTo(1.75, H - 2.5); pk.lineTo(0, H); pk.lineTo(-1.75, H - 2.5); pk.lineTo(-1.75, 0);
    for (let x = -94; x < 96; x += 6) {
      if (posts.some((p) => Math.abs(p - x) < 3)) continue;
      const g = new THREE.ExtrudeGeometry(pk, { depth: 0.6, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 1 });
      g.translate(x, 0, 0.05);
      scene.add(mesh(g, white));
    }
    posts.forEach((x) => scene.add(board(5, 1.25, 5, white, [x, H + 4.6, -1.75], 0.2)));
  } else if (opt === "capped") {
    for (let x = -100; x < 100; x += 9) {
      scene.add(woodBoard(5.5, H - 6, 0.75, cedar, [x + 2.75, (H - 6) / 2, 0.375], "y", 0.06, 60));
      scene.add(woodBoard(5.5, H - 6, 0.75, cedar, [x + 7.25, (H - 6) / 2, 1.125], "y", 0.06, 60));
    }
    scene.add(woodBoard(196, 3.5, 0.75, cedar, [0, H - 4.25, 1.875], "x", 0.06, 60));      // trim
    scene.add(woodBoard(198, 1.5, 5.5, cedar, [0, H - 1.75, 0], "x", 0.1, 60));            // cap
  }
  outdoors(scene, { groundY: 0, at: [0, 36, 0], from: [-120, 150, 140], size: 130, bounce: 0.7 });
  const cam = camera([48, 52, 196], [0, 36, 0], 32);
  return { scene, camera: cam, exposure: 0.96, ao: {} };
}

// ================================================================== hardware

function doorCloseUp(scene) {
  const white = paint(TRIM, 0.34);
  const wall = wallPaint(WALL);
  scene.add(board(4.5, 40, 1.375, white, [0.125, 0, -0.6875], 0.04));          // lock stile
  scene.add(board(36, 40, 0.875, white, [-20.125, 0, -0.9375], 0.04));         // panel, set back
  scene.add(board(3.5, 40, 0.75, white, [4.35, 0, 0.375], 0.08));             // casing past the gap
  scene.add(mesh(new THREE.BoxGeometry(60, 40, 1), wall, [36, 0, -0.5]));
  scene.environment = brightEnv();
  scene.add(new THREE.HemisphereLight(0xfff8ee, 0x8a7d70, 0.3));
  sun(scene, { from: [-26, 30, 34], at: [-1, 0, 0], size: 14, intensity: 2.4 });
}

function rose(mat, z = 0) {
  const r = turned([[1.3, 0], [1.3, 0.14], [1.18, 0.3], [0.62, 0.42], [0.42, 0.5], [0.001, 0.5]], mat, [0, 0, 0], 48);
  r.rotation.x = Math.PI / 2;
  r.position.z = z;
  return r;
}

function lever(mat) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.4, 0.42, 1.2, 32), mat, [0, 0, 1.0]).rotateX(Math.PI / 2));
  const arm = mesh(new THREE.CapsuleGeometry(0.3, 4.1, 8, 24), mat, [-2.15, 0, 1.55]);
  arm.rotation.z = Math.PI / 2;
  g.add(arm);
  return g;
}

function buildFinish(opt) {
  const scene = new THREE.Scene();
  doorCloseUp(scene);
  const m = metal(opt);
  scene.add(rose(m));
  scene.add(lever(m));
  const cam = camera([4.6, 3.2, 15.5], [-1.3, 0, 0.8], 32);
  return { scene, camera: cam, exposure: 1.0, ao: { radius: 0.6, scale: 1.4 } };
}

function buildHandles(opt) {
  const scene = new THREE.Scene();
  doorCloseUp(scene);
  const brass = metal("satinbrass");
  if (opt === "knob") {
    scene.add(rose(brass));
    const k = turned([[0.38, 0], [0.4, 0.55], [0.98, 0.95], [1.16, 1.45], [1.02, 2.0], [0.48, 2.25], [0.001, 2.27]], brass, [0, 0, 0], 48);
    k.rotation.x = Math.PI / 2; k.position.z = 0.45;
    scene.add(k);
  } else if (opt === "lever") {
    scene.add(rose(brass));
    scene.add(lever(brass));
  } else if (opt === "curved") {
    scene.add(rose(brass));
    scene.add(mesh(new THREE.CylinderGeometry(0.4, 0.42, 1.2, 32), brass, [0, 0, 1.0]).rotateX(Math.PI / 2));
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 1.55), new THREE.Vector3(-1.4, 0.02, 1.68),
      new THREE.Vector3(-3.0, -0.12, 1.58), new THREE.Vector3(-4.3, -0.55, 1.12),
    ]);
    scene.add(mesh(new THREE.TubeGeometry(path, 64, 0.29, 20, false), brass));
    scene.add(mesh(new THREE.SphereGeometry(0.29, 20, 14), brass, [-4.3, -0.55, 1.12]));
  } else if (opt === "glass") {
    // A faceted glass knob on a small brass rose and shank. Kept small behind the
    // glass, so what shows through the knob is mostly the white door.
    const small = turned([[0.85, 0], [0.85, 0.1], [0.7, 0.24], [0.42, 0.3], [0.001, 0.3]], brass, [0, 0, 0], 40);
    small.rotation.x = Math.PI / 2;
    scene.add(small);
    scene.add(mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.7, 24), brass, [0, 0, 0.55]).rotateX(Math.PI / 2));
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, transmission: 1, roughness: 0.0, ior: 1.52, thickness: 1.3, metalness: 0,
      attenuationColor: new THREE.Color(0xd9e4ea), attenuationDistance: 1.6,
      flatShading: true, envMapIntensity: 2.2, specularIntensity: 1, clearcoat: 1, clearcoatRoughness: 0,
    });
    const k = turned([[0.45, 0], [0.6, 0.3], [1.18, 0.75], [1.24, 1.55], [0.98, 1.95], [0.001, 2.0]], glass, [0, 0, 0], 12);
    k.rotation.x = Math.PI / 2; k.position.z = 0.85;
    k.castShadow = false;   // clear glass throws a faint caustic, not a solid shadow
    scene.add(k);
  } else if (opt === "square") {
    scene.add(board(2.4, 2.4, 0.35, brass, [0, 0, 0.175], 0.06));
    scene.add(board(0.6, 0.6, 1.1, brass, [0, 0, 0.9], 0.08));
    scene.add(board(4.6, 0.6, 0.45, brass, [-2.0, 0, 1.55], 0.1));
  }
  const cam = camera([4.6, 3.2, 15.5], [-1.3, -0.2, 0.8], 32);
  return { scene, camera: cam, exposure: 1.0, ao: { radius: 0.6, scale: 1.4 } };
}

// ================================================================== registry

const BUILDERS = {
  trim: { build: buildTrim, options: ["square", "22", "45", "cap", "colonial", "victorian", "frame"] },
  doors: { build: buildDoors, options: ["slab", "shaker2", "shaker3", "shaker5", "raised6", "french"] },
  base: { build: buildBase, options: ["modern", "colonial", "craftsman", "tall", "builtup"] },
  crown: { build: buildCrown, options: ["none", "cove", "colonial", "large", "builtup"] },
  panel: { build: buildPanel, options: ["none", "beadboard", "batten", "frame", "raised", "shiplap"] },
  builtin: { build: buildBuiltin, options: ["open", "cabinet", "glass", "floating", "library"] },
  mantel: { build: buildMantel, options: ["beam", "craftsman", "colonial", "overmantel"] },
  railing: { build: buildRailing, options: ["metal", "picket", "cable", "slat", "glass"] },
  decking: { build: buildDecking, options: ["cedar", "treated", "grey", "brown", "ipe"] },
  ceiling: { build: buildCeiling, options: ["stained", "white", "cedar", "haint", "beadboard", "pine"] },
  columns: { build: buildColumns, options: ["box", "tapered", "tuscan", "turned", "timber"] },
  fence: { build: buildFence, options: ["privacy", "shadowbox", "horizontal", "picket", "capped"] },
  finish: { build: buildFinish, options: ["black", "satinbrass", "brass", "nickel", "chrome", "bronze"] },
  handles: { build: buildHandles, options: ["knob", "lever", "curved", "glass", "square"] },
};

/** Build one question's scene with one style, for the live quiz. */
export function buildScene(q, o) {
  const b = BUILDERS[q];
  if (!b || !b.options.includes(o)) return null;
  return b.build(o);
}

/** Which styles of a question can be built in 3D (photo styles can't). */
export function buildable(q) {
  return BUILDERS[q] ? BUILDERS[q].options.slice() : [];
}

export function renderList() {
  const out = [];
  Object.entries(BUILDERS).forEach(([q, b]) => b.options.forEach((o) => out.push({ q, o })));
  return out;
}

export async function renderOne(q, o) {
  const b = BUILDERS[q];
  if (!b) throw new Error("no builder for " + q);
  await loadAO();
  const { scene, camera: cam, exposure, ao } = b.build(o);
  const out = shoot(scene, cam, exposure, ao);
  dispose(scene);
  return out;
}

/** The moulding profiles the Blender house runs along its walls, in (u, t) inches. */
export function profiles() {
  const out = { base: {}, crown: {}, chairRail: chairRail() };
  BUILDERS.base.options.forEach((o) => { out.base[o] = baseProfiles(o).map(({ p, y, t = 0 }) => ({ p, y, t })); });
  out.crown.none = [];
  out.crown.cove = [{ p: [[0, 0], [2.25, 0], ...arc(2.25, 2.25, 2.25, -90, -180, 12).slice(1)], drop: 0 }];
  out.crown.colonial = [{ p: crownProfile(3.625, 2.6), drop: 0 }];
  out.crown.large = [{ p: crownProfile(5.25, 3.7), drop: 0 }];
  out.crown.builtup = [
    { p: crownProfile(5.25, 3.7), drop: 0 },
    { p: flatProfile(5.5, 0.75, 0.05), drop: 5.25 },
    { p: [[0, 0], [1.1, 0], ...arc(0.55, 0.75, 0.55, -90, 90, 10).map(([u, t]) => [u + 0.55, t]), [0, 0.75]], drop: 10.75 },
  ];
  out.houseBase = [{ p: flatProfile(5.25, 0.625, 0.06), y: 0 }, { p: capMoulding(1.1, 0.72), y: 5.25 }];
  out.casing = { flat: flatProfile(3.5, 0.75), colonial: colonialCasing(2.5) };
  return out;
}
