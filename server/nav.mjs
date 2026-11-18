// Malaysian unit trust prices (NAV) from FIMM's public daily price report (all fund houses, incl. Public Mutual).
// The report is a PDF; we read the text positions in it: fund name on the left, NAV on the same line to the right.
const FIMM = 'https://www.fimm.com.my/report/dailyprice.php';

async function inflate(bytes) {
  const ds = new DecompressionStream('deflate');
  const w = ds.writable.getWriter(); w.write(bytes).catch(() => {}); w.close().catch(() => {});
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}
const latin1 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return s; };
const unesc = (s) => s.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (m, c) => (/^[0-7]/.test(c) ? String.fromCharCode(parseInt(c, 8)) : ({ n: '\n', r: '\r', t: '\t', b: '', f: '' })[c] ?? c));

// Pull [{page, x, y, text}] out of every content stream.
export async function pdfItems(buf) {
  const u8 = new Uint8Array(buf), s = latin1(u8), items = [];
  let i = 0, page = 0;
  while ((i = s.indexOf('stream', i)) >= 0) {
    if (s.slice(i - 3, i) === 'end') { i += 6; continue; }
    let st = i + 6; if (s[st] === '\r') st++; if (s[st] === '\n') st++;
    const e = s.indexOf('endstream', st); if (e < 0) break;
    let t = '', end = e;
    while (end > st && (u8[end - 1] === 10 || u8[end - 1] === 13)) end--;
    try { t = latin1(await inflate(u8.subarray(st, end))); } catch (x) { i = e + 9; continue; }
    if (t.includes('Tj') || t.includes('TJ')) {
      page++;
      const re = /(-?[\d.]+)\s+(-?[\d.]+)\s+Tm|(-?[\d.]+)\s+(-?[\d.]+)\s+Td|\(((?:[^()\\]|\\.)*)\)\s*Tj|\[((?:[^\]\\]|\\.)*)\]\s*TJ/g;
      let x = 0, y = 0, m;
      while ((m = re.exec(t))) {
        if (m[1] !== undefined) { x = +m[1]; y = +m[2]; }
        else if (m[3] !== undefined) { x += +m[3]; y += +m[4]; }
        else {
          const raw = m[5] !== undefined ? m[5] : (m[6].match(/\((?:[^()\\]|\\.)*\)/g) || []).map((p) => p.slice(1, -1)).join('');
          const text = unesc(raw).replace(/\s+/g, ' ').trim();
          if (text) items.push({ page, x, y, text });
        }
      }
    }
    i = e + 9;
  }
  return items;
}

const NUM = /^(\d+\.\d+|NA|N\/A|-)$/i;
const clean = (n) => n.replace(/\s*\([a-z]{1,2}\)/gi, ' ').replace(/\s+[a-z]\d+$/, '').replace(/\s+/g, ' ').trim();
const isManager = (t) => /\b(BERHAD|BHD|LIMITED|LTD)\b/i.test(t) && !NUM.test(t);

export function parseNav(items) {
  const date = ((items.find((it) => /\b(19|20)\d\d\b/.test(it.text) && /(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)/i.test(it.text)) || {}).text || '').trim();
  // rows: same page + same y
  const rows = new Map();
  items.forEach((it) => { const k = it.page + ':' + Math.round(it.y * 2); (rows.get(k) || rows.set(k, []).get(k)).push(it); });
  const cells = [];
  rows.forEach((list) => {
    list.sort((a, b) => a.x - b.x);
    list.forEach((it, j) => {
      if (!NUM.test(it.text)) return;
      // the name is the nearest non-number text to the left on the same line
      for (let k = j - 1; k >= 0; k--) { if (!NUM.test(list[k].text)) { cells.push({ page: it.page, x: list[k].x, y: it.y, name: list[k].text, nav: it.text }); return; } }
    });
  });
  const named = new Set(cells.map((c) => c.page + ':' + c.x + ':' + c.y));
  const others = items.filter((it) => !NUM.test(it.text) && !named.has(it.page + ':' + it.x + ':' + it.y)).map((it) => ({ page: it.page, x: it.x, y: it.y, other: it.text }));
  // reading order: page, column (left to right), top to bottom
  const all = cells.concat(others).sort((a, b) => a.page - b.page || Math.round(a.x / 60) - Math.round(b.x / 60) || b.y - a.y);
  let mgr = '', prev = null;
  const funds = [];
  all.forEach((c) => {
    if (c.other !== undefined) {
      if (isManager(c.other)) {
        // a fund house name can wrap onto two lines: join the line just above it
        if (/^as\b/i.test(c.other) || (/\)$/.test(c.other) && !c.other.includes('('))) { prev = c; return; } // second line of "(formerly known as …)"
        const wrapped = c.other.split(' ').length <= 2 && prev && prev.other !== undefined && prev.page === c.page && Math.abs(prev.y - c.y) <= 9;
        mgr = (wrapped ? prev.other + ' ' + c.other : c.other).replace(/\s*\(formerly.*$/i, '').replace(/\s+/g, ' ').trim();
      }
      prev = c; return;
    }
    prev = c;
    const nav = /^\d/.test(c.nav) ? Number(c.nav) : null;
    funds.push({ name: clean(c.name), manager: mgr, nav });
  });
  return { date, source: 'FIMM daily price report', funds };
}

export async function getNavs() {
  const r = await fetch(FIMM, { headers: { 'User-Agent': 'Mozilla/5.0 (MoneyAccount price relay)' }, cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!r.ok) throw new Error('FIMM ' + r.status);
  const out = parseNav(await pdfItems(await r.arrayBuffer()));
  if (out.funds.length < 50) throw new Error('could not read the FIMM report');
  return out;
}
