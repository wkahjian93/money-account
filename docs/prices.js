/* Money Account live prices: exchange rates + crypto + gold straight from the phone, stocks via the price relay. */
(function () {
  const P = {};
  const OZ = 31.1034768;

  P.server = (s) => {
    if (s && (s.server || s.priceServer)) return (s.server || s.priceServer).replace(/\/+$/, '');
    return /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? '/api' : 'https://money-account-server.dwz-rooms-server.workers.dev';
  };

  async function getJSON(u, ms) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms || 15000);
    try {
      const r = await fetch(u, { signal: ac.signal, cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }

  P.fx = async () => {
    const d = await getJSON('https://open.er-api.com/v6/latest/MYR');
    if (d.result !== 'success' || !d.rates) throw new Error('bad reply');
    return { rates: d.rates, at: new Date().toISOString() };
  };

  // Updates prices inside state.holdings in place. Returns {updated, errors}.
  P.refresh = async (state) => {
    const errors = [];
    let updated = 0;
    const now = new Date().toISOString();
    const hs = (state.holdings || []).filter((h) => !h.archived);

    try { state.fx = await P.fx(); } catch (e) { errors.push('Exchange rates: ' + e.message); }

    const coins = new Set();
    hs.forEach((h) => { if (h.kind === 'crypto' && h.coinId) coins.add(h.coinId); if (h.kind === 'gold') coins.add('pax-gold'); });
    if (coins.size) {
      try {
        const d = await getJSON('https://api.coingecko.com/api/v3/simple/price?vs_currencies=myr&ids=' + [...coins].join(','));
        hs.forEach((h) => {
          let px = null;
          if (h.kind === 'crypto' && d[h.coinId]) px = d[h.coinId].myr;
          if (h.kind === 'gold' && d['pax-gold']) px = d['pax-gold'].myr / OZ * (h.unit === 'oz' ? OZ : 1);
          if (px > 0) { h.price = px; h.priceCur = 'MYR'; h.priceAt = now; h.priceSrc = h.kind === 'gold' ? 'Gold spot (via PAXG)' : 'CoinGecko'; updated++; }
        });
      } catch (e) { errors.push('Crypto/gold prices: ' + e.message); }
    }

    const stocks = hs.filter((h) => h.kind === 'stock' && h.symbol);
    if (stocks.length) {
      const srv = P.server(state.settings);
      if (!srv) errors.push('Stock prices need the server link (More → Settings). Until then, update stock prices by hand.');
      else {
        try {
          const syms = [...new Set(stocks.map((h) => h.symbol))];
          const d = await getJSON(srv + '/quote?symbols=' + encodeURIComponent(syms.join(',')));
          const map = {}; (d.quotes || []).forEach((q) => (map[q.symbol] = q));
          stocks.forEach((h) => {
            const q = map[h.symbol];
            if (!q || q.error) { errors.push(h.symbol + ': ' + (q ? q.error : 'no reply')); return; }
            let px = q.price, cur = q.currency || 'MYR';
            if (cur === 'GBp') { px /= 100; cur = 'GBP'; }
            if (cur === 'ZAc') { px /= 100; cur = 'ZAR'; }
            h.price = px; h.priceCur = cur; h.priceAt = now; h.priceSrc = 'Yahoo Finance ' + (q.exchange || ''); h.prevClose = q.prevClose;
            if (h.prevClose && cur === 'GBP') h.prevClose /= 100;
            updated++;
          });
        } catch (e) { errors.push('Stock prices: ' + e.message); }
      }
    }
    state.pricesAt = now;
    return { updated, errors };
  };

  P.searchStock = async (q, settings) => {
    const srv = P.server(settings);
    if (!srv) throw new Error('Server link not set (More → Settings)');
    const d = await getJSON(srv + '/search?q=' + encodeURIComponent(q));
    return d.results || [];
  };
  P.searchCoin = async (q) => {
    const d = await getJSON('https://api.coingecko.com/api/v3/search?query=' + encodeURIComponent(q));
    return (d.coins || []).slice(0, 8).map((c) => ({ id: c.id, symbol: (c.symbol || '').toUpperCase(), name: c.name }));
  };

  self.WBPrices = P;
})();
