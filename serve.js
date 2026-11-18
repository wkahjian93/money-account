// Local test server: serves docs/, the price relay (GET /api/quote, /api/search) and the AI helper (POST /api/ai, /api/transcribe).
// node serve.js [port]
// With OPENAI_API_KEY in the environment the AI is real. Without it, the AI answers with clearly marked STAND-IN replies
// from test/fixtures so the screens can be tested without spending anything.
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, 'docs');
const PORT = Number(process.argv[2]) || 5201;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
let relay, ai;

function standIn(urlPath, body) {
  if (/transcribe$/.test(urlPath)) return { text: 'Lunch with client 38.50, Grab to office 18 ringgit, and yesterday I got commission 4k', standIn: true };
  const task = (body && body.task) || 'entries';
  const f = path.join(__dirname, 'test', 'fixtures', 'ai-' + task + '.json');
  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const out = JSON.parse(fs.readFileSync(f, 'utf8').replace(/YESTERDAY/g, iso(new Date(Date.now() - 864e5))).replace(/TODAY/g, iso(new Date())));
  out.standIn = true;
  return out;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  // local-only helpers for making the icons (tools/icon.html)
  if (url.pathname === '/tools/icon.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(fs.readFileSync(path.join(__dirname, 'tools', 'icon.html'))); }
  if (url.pathname === '/__save-icon' && req.method === 'POST') {
    const chunks = []; for await (const c of req) chunks.push(c);
    const size = Number(url.searchParams.get('size'));
    if (![180, 192, 512].includes(size)) { res.writeHead(400); return res.end(); }
    fs.mkdirSync(path.join(ROOT, 'icons'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'icons', 'icon-' + size + '.png'), Buffer.from(Buffer.concat(chunks).toString().split(',')[1], 'base64'));
    res.writeHead(200); return res.end('ok');
  }
  if (url.pathname.startsWith('/api/')) {
    let r;
    if (req.method === 'POST') {
      const chunks = []; for await (const c of req) chunks.push(c);
      const buf = Buffer.concat(chunks);
      if (process.env.OPENAI_API_KEY) {
        ai = ai || (await import('./server/ai.mjs'));
        r = await ai.handleAI(url.pathname, { headers: { get: (k) => req.headers[k.toLowerCase()] }, json: async () => JSON.parse(buf.toString()), arrayBuffer: async () => buf }, Object.assign({ LOCAL: '1' }, process.env));
      } else {
        let body = null; try { body = JSON.parse(buf.toString()); } catch (e) {}
        await new Promise((ok) => setTimeout(ok, 700));
        r = { status: 200, body: standIn(url.pathname, body) };
      }
    } else {
      relay = relay || (await import('./server/quote.mjs'));
      r = await relay.handle(url.pathname, url.searchParams);
    }
    res.writeHead(r.status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify(r.body));
  }
  let p = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
  if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(PORT, () => console.log('Money Account on http://localhost:' + PORT + (process.env.OPENAI_API_KEY ? ' (real AI)' : ' (AI stand-in replies)')));
