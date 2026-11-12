// Render the design-quiz images.
//
//   node scripts/quiz-render/render.mjs              every option of every question
//   node scripts/quiz-render/render.mjs trim doors   just those questions
//   node scripts/quiz-render/render.mjs trim/22      just one option
//
// Opens scripts/quiz-render/render.html in headless Chrome, using its software
// WebGL so the result is the same on any machine, and writes
// images/quiz/<question>/<option>.webp (1000x1250) and <option>-sm.webp (500x625).
//
// Needs Chrome, and a network connection for three.js (pinned in render.html).
// Set CHROME if Chrome is somewhere unusual.
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = path.join(ROOT, "images", "quiz");

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json" };

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
        res.writeHead(404); res.end(); return;
      }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" });
      fs.createReadStream(p).pipe(res);
    });
    srv.listen(0, "127.0.0.1", () => resolve(srv));
  });
}

function findChrome() {
  const c = [process.env.CHROME,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome", "/usr/bin/chromium"];
  for (const p of c) if (p && fs.existsSync(p)) return p;
  throw new Error("Chrome not found. Set CHROME to its path.");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const want = process.argv.slice(2);
  const srv = await serve();
  const port = srv.address().port;
  const debugPort = 9500 + Math.floor(Math.random() * 400);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "quiz-render-"));
  const chrome = spawn(findChrome(), [
    "--headless=new", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    "--hide-scrollbars", "--mute-audio", "--no-first-run",
    `--user-data-dir=${profile}`, `--remote-debugging-port=${debugPort}`, "about:blank",
  ], { stdio: "ignore" });

  let tab;
  for (let i = 0; i < 40 && !tab; i++) {
    try {
      tab = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?` +
        encodeURIComponent(`http://127.0.0.1:${port}/scripts/quiz-render/render.html`), { method: "PUT" })).json();
    } catch { await sleep(250); }
  }
  if (!tab) throw new Error("Chrome did not start");

  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === "Runtime.exceptionThrown") console.error("page error:", m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") console.error("page console:", m.params.args.map((a) => a.value ?? a.description).join(" "));
  };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || "evaluation failed");
    return r.result?.result?.value;
  };
  await send("Runtime.enable");

  for (let i = 0; i < 120; i++) {
    if (await evaluate("window.RENDER_READY === true").catch(() => false)) break;
    await sleep(250);
  }

  if (process.env.AO_DEBUG) await evaluate("window.AO_DEBUG = true");
  let jobs = await evaluate("window.renderList()");
  if (want.length) {
    jobs = jobs.filter(({ q, o }) => want.some((w) => w === q || w === `${q}/${o}`));
  }
  if (!jobs.length) console.error("Nothing matched:", want.join(" "));

  let failed = 0;
  for (const { q, o } of jobs) {
    const t0 = Date.now();
    try {
      const out = await evaluate(`window.renderOne(${JSON.stringify(q)}, ${JSON.stringify(o)})`);
      const dir = path.join(OUT, q);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${o}.webp`), Buffer.from(out.full.split(",")[1], "base64"));
      fs.writeFileSync(path.join(dir, `${o}-sm.webp`), Buffer.from(out.sm.split(",")[1], "base64"));
      console.log(`rendered ${q}/${o}  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    } catch (e) {
      failed++;
      console.error(`FAILED ${q}/${o}: ${e.message}`);
    }
  }

  ws.close();
  chrome.kill();
  srv.close();
  await sleep(500);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold it */ }

  // Every image the quiz points at should exist
  const data = path.join(ROOT, "data", "quiz.json");
  if (fs.existsSync(data)) {
    const quiz = JSON.parse(fs.readFileSync(data, "utf8"));
    const missing = [];
    (quiz.questions || []).forEach((qq) => (qq.options || []).forEach((oo) => {
      [oo.image, oo.thumb].filter(Boolean).forEach((img) => {
        if (!fs.existsSync(path.join(ROOT, img.replace(/^\//, "")))) missing.push(img);
      });
    }));
    if (missing.length) console.error(`\n${missing.length} image(s) in data/quiz.json do not exist:\n  ` + missing.join("\n  "));
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
