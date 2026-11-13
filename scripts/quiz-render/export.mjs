// Export the quiz scenes' geometry for the Blender house (scripts/house/).
//
//   node scripts/quiz-render/export.mjs <outDir> trim doors panel builtin mantel
//
// Writes <outDir>/<question>/<option>.json - every mesh in world space, inches, y up,
// tagged with its material - and <outDir>/profiles.json, the moulding profiles.
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
  const outDir = process.argv[2];
  const want = process.argv.slice(3);
  if (!outDir) throw new Error("usage: node export.mjs <outDir> [question ...]");
  const srv = await serve();
  const port = srv.address().port;
  const debugPort = 9500 + Math.floor(Math.random() * 400);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "quiz-export-"));
  const chrome = spawn(findChrome(), [
    "--headless=new", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-first-run",
    `--user-data-dir=${profile}`, `--remote-debugging-port=${debugPort}`, "about:blank",
  ], { stdio: "ignore" });
  let tab;
  for (let i = 0; i < 40 && !tab; i++) {
    try {
      tab = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?` +
        encodeURIComponent(`http://127.0.0.1:${port}/scripts/quiz-render/export.html`), { method: "PUT" })).json();
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
    if (m.method === "Runtime.exceptionThrown") console.error("page error:", m.params.exceptionDetails.exception?.description);
  };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || "evaluation failed");
    return r.result?.result?.value;
  };
  await send("Runtime.enable");
  for (let i = 0; i < 120; i++) {
    if (await evaluate("window.EXPORT_READY === true").catch(() => false)) break;
    await sleep(250);
  }
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "profiles.json"), JSON.stringify(await evaluate("window.profiles()")));
  for (const q of want) {
    for (const o of await evaluate(`window.buildable(${JSON.stringify(q)})`)) {
      const data = await evaluate(`window.exportScene(${JSON.stringify(q)}, ${JSON.stringify(o)})`);
      fs.mkdirSync(path.join(outDir, q), { recursive: true });
      fs.writeFileSync(path.join(outDir, q, `${o}.json`), JSON.stringify(data));
      console.log(`exported ${q}/${o}: ${data.meshes.length} meshes`);
    }
  }
  ws.close(); chrome.kill(); srv.close();
  await sleep(500);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* still held */ }
}

main().catch((e) => { console.error(e); process.exit(1); });
