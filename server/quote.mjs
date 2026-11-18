// Stock price relay: the phone cannot read Yahoo Finance directly (no CORS), so this tiny relay does it.
// Only public market data passes through here: ticker symbols in, prices out. No personal data.
// Used by the Cloudflare Worker (worker.mjs) and by the local test server (serve.js).

const UA = { 'User-Agent': 'Mozilla/5.0 (Money Account price relay)' };
const SYM = /^[A-Za-z0-9.\-^=]{1,20}$/;

async function quote(symbol) {
  const u = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(symbol) + '?range=5d&interval=1d';
  const r = await fetch(u, { headers: UA });
  if (!r.ok) return { symbol, error: 'not found (' + r.status + ')' };
  const j = await r.json();
  const m = j && j.chart && j.chart.result && j.chart.result[0] && j.chart.result[0].meta;
  if (!m || !(m.regularMarketPrice > 0)) return { symbol, error: 'no price' };
  return {
    symbol, price: m.regularMarketPrice, currency: m.currency || '', name: m.shortName || m.longName || symbol,
    prevClose: m.chartPreviousClose || m.previousClose || null, exchange: m.fullExchangeName || m.exchangeName || '',
    time: m.regularMarketTime ? new Date(m.regularMarketTime * 1000).toISOString() : null,
  };
}

async function search(q) {
  const u = 'https://query2.finance.yahoo.com/v1/finance/search?quotesCount=8&newsCount=0&q=' + encodeURIComponent(q);
  const r = await fetch(u, { headers: UA });
  if (!r.ok) return [];
  const j = await r.json();
  return (j.quotes || []).filter((x) => x.symbol).map((x) => ({
    symbol: x.symbol, name: x.shortname || x.longname || x.symbol, exchange: x.exchDisp || x.exchange || '', type: x.typeDisp || x.quoteType || '',
  }));
}

// path: '/quote' or '/search' (any prefix allowed, e.g. /api/quote)
export async function handle(path, params) {
  try {
    if (/\/quote$/.test(path)) {
      const list = String(params.get('symbols') || '').split(',').map((s) => s.trim()).filter((s) => SYM.test(s)).slice(0, 40);
      if (!list.length) return { status: 400, body: { error: 'symbols missing' } };
      const out = await Promise.all(list.map((s) => quote(s).catch((e) => ({ symbol: s, error: String(e.message || e) }))));
      return { status: 200, body: { quotes: out, at: new Date().toISOString() } };
    }
    if (/\/search$/.test(path)) {
      const q = String(params.get('q') || '').trim().slice(0, 40);
      if (!q) return { status: 400, body: { error: 'q missing' } };
      return { status: 200, body: { results: await search(q) } };
    }
    return { status: 404, body: { error: 'not found' } };
  } catch (e) {
    return { status: 502, body: { error: String(e.message || e) } };
  }
}
