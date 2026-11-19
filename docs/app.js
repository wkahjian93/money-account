/* Money Account screens */
(function () {
  const C = self.WBCore, S = self.WBStore, PR = self.WBPrices;
  let state = S.load();
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v) => { const n = Number(String(v == null ? '' : v).replace(/[, ]/g, '')); return isFinite(n) ? n : 0; };
  const hidden = () => state && state.settings.hide;
  const fmtN = (n, d) => Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: d == null ? 2 : d, maximumFractionDigits: d == null ? 2 : d });
  const rm = (n, opt) => (hidden() && !(opt && opt.show) ? 'RM •••' : (n < 0 ? '-' : '') + 'RM ' + fmtN(Math.abs(n), opt && opt.d));
  const fmtU = (n) => Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 6 });
  const rmk = (n) => { if (hidden()) return 'RM •••'; const a = Math.abs(n); const s = a >= 1e6 ? fmtN(a / 1e6, 2) + 'M' : a >= 1e4 ? fmtN(a / 1e3, 1) + 'k' : fmtN(a); return (n < 0 ? '-' : '') + 'RM ' + s; };
  const pct = (x) => (x == null || !isFinite(x) ? '–' : (x >= 0 ? '+' : '') + fmtN(x * 100, 1) + '%');
  const plc = (x) => (x > 0 ? 'up' : x < 0 ? 'down' : '');
  const dmy = (s) => (s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const ymLabel = (ym) => MONTHS[Number(ym.slice(5, 7)) - 1] + ' ' + ym.slice(0, 4);
  const ago = (iso) => { if (!iso) return 'never'; const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago'; };
  const save = (now) => S.save(state, now);

  // ---------- constants ----------
  const EXP_CATS = [
    ['food', '🍜', 'Food & drinks'], ['groceries', '🛒', 'Groceries'], ['transport', '⛽', 'Petrol & transport'], ['car', '🚗', 'Car'],
    ['housing', '🏠', 'Housing & rent'], ['bills', '💡', 'Utilities & bills'], ['phone', '📱', 'Phone & internet'], ['shopping', '🛍️', 'Shopping'],
    ['kids', '🧸', 'Family & kids'], ['parents', '👵', 'Parents'], ['health', '🩺', 'Health & medical'], ['insurance', '🛡️', 'Insurance premium'],
    ['education', '📚', 'Education'], ['fun', '🎬', 'Entertainment'], ['travel', '✈️', 'Travel'], ['gifts', '🎁', 'Gifts & donations'],
    ['business', '💼', 'Business / agency'], ['care', '💇', 'Personal care'], ['fitness', '🏋️', 'Fitness'], ['loan', '🏦', 'Loan repayment'],
    ['tax', '🧾', 'Tax'], ['other', '📦', 'Others'], ['unknown', '❓', 'Unrecorded (balance check)'],
  ];
  const INC_CATS = [
    ['commission', '💰', 'Commission'], ['override', '📈', 'Override'], ['salary', '💵', 'Salary'], ['bonus', '🎉', 'Bonus / contest'],
    ['allowance', '🪙', 'Allowance'], ['dividend', '🌱', 'Dividend'], ['interest', '🏦', 'Interest'], ['rental', '🏘️', 'Rental'],
    ['side', '🧰', 'Side income'], ['gift', '🎁', 'Gift / angpau'], ['refund', '↩️', 'Refund'], ['other', '📦', 'Others'],
  ];
  const catOf = (type, id) => (type === 'income' ? INC_CATS : EXP_CATS).find((c) => c[0] === id) || ['other', '📦', id || 'Others'];
  const ACC_TYPES = [['bank', '🏦 Bank / savings'], ['cash', '💵 Cash'], ['ewallet', '📲 E-wallet'], ['card', '💳 Credit card'], ['other', '📁 Other']];
  const KINDS = [
    ['stock', '📈', 'Shares (Bursa / US / others)'], ['crypto', '🪙', 'Crypto'], ['gold', '🥇', 'Gold'], ['fund', '📊', 'Unit trust / ILP fund'],
    ['fd', '🏦', 'Fixed deposit'], ['epf', '👴', 'EPF / KWSP / PRS'], ['property', '🏠', 'Property'], ['other', '💼', 'Other asset'],
  ];
  const kindOf = (k) => KINDS.find((x) => x[0] === k) || KINDS[7];
  const invIcon = (t) => kindOf((state.holdings.find((h) => h.id === t.inv.holding) || {}).kind)[1];
  const LOAN_KINDS = [['housing', '🏠 Housing loan', 'reducing'], ['car', '🚗 Car loan (hire purchase)', 'flat'], ['personal', '💳 Personal loan', 'flat'], ['study', '🎓 Study loan (PTPTN)', 'reducing'], ['business', '💼 Business loan', 'reducing'], ['other', '📁 Other', 'reducing']];
  const POL_TYPES = [['life', 'Life / whole life'], ['ilp', 'Investment-linked (ILP)'], ['medical', 'Medical card'], ['ci', 'Critical illness'], ['pa', 'Personal accident'], ['term', 'Term'], ['endow', 'Savings / endowment'], ['other', 'Other']];

  // ---------- shell ----------
  const app = $('#app');
  const TABS = [['home', '🏠', 'Home'], ['records', '🧾', 'Records'], ['wealth', '💎', 'Wealth'], ['split', '🍻', 'Split'], ['more', '☰', 'More']];
  function route() { const h = location.hash.replace(/^#\/?/, '') || 'home'; return h.split('/'); }
  function go(h) { location.hash = '#/' + h; }

  function render() {
    if (!state) return renderWelcome();
    const r = route(), page = r[0];
    const tab = ({ insurance: 'more', tax: 'more', settings: 'more', budget: 'more', reports: 'more', receipts: 'more', accounts: 'wealth', group: 'split' })[page] || page;
    const view = VIEWS[page] || VIEWS.home;
    app.innerHTML = '<main class="page">' + view(r) + '</main>' +
      '<nav class="tabs">' + TABS.map(([k, i, l]) => '<a href="#/' + k + '" class="' + (k === tab ? 'on' : '') + '"><span>' + i + '</span>' + l + '</a>').join('') + '</nav>' +
      '<button class="fab" data-act="quickAdd" aria-label="Add">＋</button>';
    window.scrollTo(0, 0);
    $$('img[data-rid]').forEach(async (img) => { const src = await S.getImg(img.dataset.rid).catch(() => null); if (src) img.src = src; else img.alt = 'missing'; });
  }
  window.addEventListener('hashchange', render);

  function renderWelcome() {
    app.innerHTML = `<main class="page welcome">
      <div class="logo">💎</div><h1>Money Account</h1>
      <p class="muted">Your personal money book: spending, income, investments at today's prices, loans, insurance cover, tax relief receipts and split bills with friends.</p>
      <div class="card"><b>Private by design.</b> Everything you type stays on this phone. Only ticker symbols (like 1155.KL or BTC) go out to fetch prices, and, when you use AI, just the voice note or photo you choose to read. Make a backup now and then (More → Backup).</div>
      <button class="btn primary big" data-act="startFresh">Start my book</button>
      <button class="btn big" data-act="startSample">Look around with sample data first</button>
      <label class="btn big ghost">Restore from a backup file<input type="file" accept=".json,application/json" hidden data-change="importFile"></label>
    </main>`;
  }

  // ---------- views ----------
  const VIEWS = {};

  // Bar: liquid / sellable / long-term share of total assets
  function liqBar(s) {
    const tot = s.liquid + s.sellable + s.longTerm; if (!(tot > 0)) return '';
    const p = (v) => Math.round(v / tot * 1000) / 10;
    return '<div class="liqbar"><i class="l1" style="width:' + p(s.liquid) + '%"></i><i class="l2" style="width:' + p(s.sellable) + '%"></i><i class="l3" style="width:' + p(s.longTerm) + '%"></i></div>' +
      '<div class="liqkey small"><span><i class="l1"></i>Liquid ' + p(s.liquid) + '%</span><span><i class="l2"></i>Investments ' + p(s.sellable) + '%</span><span><i class="l3"></i>Long-term ' + p(s.longTerm) + '%</span></div>';
  }
  VIEWS.home = () => {
    const s = C.summary(state), t = C.today(), ym = t.slice(0, 7);
    const ms = C.monthStats(state.txns, ym);
    const alerts = homeAlerts();
    const LIQ = [
      ['💧 Liquid — use it today', s.liquid, [['🏦', 'Cash in bank', s.cashBy.bank, 'wealth'], ['💵', 'Cash on hand', s.cashBy.cash, 'wealth'], ['📲', 'E-wallets', s.cashBy.ewallet, 'wealth'], ['📁', 'Other accounts', s.cashBy.other, 'wealth']]],
      ['⏳ Investments — can sell in days', s.sellable, [['📈', 'Shares, unit trusts, gold, crypto, FD', s.invest, 'wealth', s.investCost ? '<span class="' + plc(s.investPL) + '">' + rm(s.investPL) + ' (' + pct(s.investCost ? s.investPL / s.investCost : null) + ')</span>' : '']]],
      ['🏛️ Long-term — hard to turn into cash', s.longTerm, [['🏠', 'Property', s.property, 'wealth'], ['👴', 'EPF / retirement', s.retire, 'wealth'], ['🛡️', 'Insurance cash / fund value', s.insCash, 'insurance'], ['🤝', 'People owe me', s.owedToMe + s.splitIn, 'wealth']]],
    ].map(([t, v, list]) => [t, v, list.filter((x) => x[2])]).filter((g) => g[1]);
    const rows = LIQ.flatMap((g) => g[2]);
    const neg = [['🏦', 'Loans outstanding', s.loans, 'wealth'], ['💳', 'Credit card balance', s.cardDebt, 'wealth'], ['🙏', 'I owe others', s.iOwe + s.splitOut, 'wealth'], ['🏗️', 'Still owed to developer', s.devOwe, 'wealth']].filter((x) => x[2]);
    const line = (x, sign) => `<a class="row" href="#/${x[3]}"><span class="ic">${x[0]}</span><span class="grow">${x[1]}${x[4] ? '<small>' + x[4] + '</small>' : ''}</span><b class="${sign < 0 ? 'down' : ''}">${sign < 0 ? '−' : ''}${rm(x[2])}</b></a>`;
    // emergency fund: months of spending covered by cash
    const last3 = [1, 2, 3].map((k) => C.monthStats(state.txns, C.addMonths(ym + '-01', -k).slice(0, 7)).expense).filter((x) => x > 0);
    const avgSpend = last3.length ? last3.reduce((a, b) => a + b, 0) / last3.length : ms.expense;
    const em = avgSpend > 0 ? s.cash / avgSpend : null;
    const budgets = state.settings.budgets || {};
    const cats = Object.keys(Object.assign({}, ms.byCat, budgets)).map((k) => [k, ms.byCat[k] || 0, num(budgets[k])]).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const loanMonthly = state.loans.filter((l) => !l.archived).reduce((a, l) => { const st = C.loanStatus(l); return a + (st.done ? 0 : st.monthly); }, 0);
    return `
      <header class="top"><div><small class="muted">${esc(state.settings.name ? 'Hi ' + state.settings.name : 'Money Account')}</small><h1>Net worth</h1></div>
        <button class="icon" data-act="toggleHide" title="Hide amounts">${hidden() ? '🙈' : '👁️'}</button></header>
      <section class="hero">
        <div class="big ${s.netWorth < 0 ? 'down' : ''}">${rm(s.netWorth)}</div>
        <div class="split2"><div><small>Total assets</small><b>${rm(s.assets)}</b></div><div><small>Total owing</small><b>${rm(s.liabilities)}</b></div></div>
        <div class="pricebar"><small>Prices ${ago(state.pricesAt)}</small><button class="chip" data-act="refreshPrices">↻ Update to today's prices</button></div>
      </section>
      ${alerts.length ? '<section class="card alerts">' + alerts.join('') + '</section>' : ''}
      <section class="card"><h3>What I own</h3>${rows.length ? liqBar(s) + LIQ.map(([t, v, list]) => '<div class="liqhead"><span>' + t + '</span><b>' + rm(v) + '</b></div>' + list.map((x) => line(x, 1)).join('')).join('') : '<p class="muted">Add your bank accounts and investments in the Wealth tab.</p>'}
        ${neg.length ? '<h3 class="mt">What I owe</h3>' + neg.map((x) => line(x, -1)).join('') : ''}</section>
      <section class="card"><div class="h3row"><h3>${ymLabel(ym)}</h3><a href="#/records" class="link">All records →</a></div>
        <div class="stats3"><div><small>Income</small><b class="up">${rm(ms.income)}</b></div><div><small>Spent</small><b>${rm(ms.expense)}</b></div><div><small>Saved</small><b class="${plc(ms.saved)}">${rm(ms.saved)}</b><small>${ms.rate == null ? '' : fmtN(ms.rate * 100, 0) + '% of income'}</small></div></div>
        ${cats.length ? cats.map(([k, v, b]) => bar(catOf('expense', k)[1] + ' ' + catOf('expense', k)[2], v, b)).join('') : '<p class="muted">No spending recorded this month yet. Tap ＋ to add one.</p>'}
        <a class="link small" href="#/budget">Set monthly budgets →</a></section>
      <section class="card"><h3>Health check</h3>
        ${check('Emergency fund', em == null ? 'Record a month of spending to see this' : fmtN(em, 1) + ' months of spending in cash', em != null && em >= state.settings.targets.emergencyMonths, 'Target ' + state.settings.targets.emergencyMonths + ' months')}
        ${check('Loan repayments', rm(loanMonthly) + ' a month', !ms.income || loanMonthly / Math.max(ms.income, 1) < 0.4, ms.income ? fmtN(loanMonthly / ms.income * 100, 0) + '% of this month’s income (aim under 40%)' : '')}
        ${insuranceCheck()}
      </section>`;
  };
  function check(title, text, ok, sub) { return `<div class="row"><span class="ic">${ok ? '✅' : '⚠️'}</span><span class="grow">${esc(title)}<small>${esc(text)}${sub ? ' · ' + esc(sub) : ''}</small></span></div>`; }
  function bar(label, v, budget) {
    const p = budget > 0 ? Math.min(1, v / budget) : 0;
    return `<div class="bar"><div class="barlab"><span>${esc(label)}</span><span>${rm(v)}${budget > 0 ? ' / ' + rm(budget, { d: 0 }) : ''}</span></div>${budget > 0 ? '<div class="track"><i class="' + (v > budget ? 'over' : '') + '" style="width:' + (p * 100).toFixed(1) + '%"></i></div>' : ''}</div>`;
  }
  function insuranceCheck() {
    const tg = state.settings.targets, inc = num(tg.income);
    const cov = C.coverage(state.policies)['Me'] || {};
    if (!state.policies.length) return check('Insurance', 'No policies recorded yet', false, 'Add them in More → Insurance');
    if (!inc) return check('Insurance', 'Death cover ' + rm(cov.death || 0) + ', CI ' + rm(cov.ci || 0), true, 'Set your yearly income in Settings to compare');
    const ok = (cov.death || 0) >= inc * tg.deathX && (cov.ci || 0) >= inc * tg.ciX;
    return check('Insurance cover (me)', 'Death ' + rm(cov.death || 0) + ' of ' + rm(inc * tg.deathX, { d: 0 }) + ' · CI ' + rm(cov.ci || 0) + ' of ' + rm(inc * tg.ciX, { d: 0 }), ok, '');
  }
  function homeAlerts() {
    const t = C.today(), out = [], soon = C.iso(new Date(Date.now() + 30 * 864e5));
    state.policies.forEach((p) => { if (p.status === 'lapsed' || p.status === 'ended') return; const d = C.nextDue(p, t); if (d && d <= soon) out.push(`<a class="row" href="#/insurance"><span class="ic">🛡️</span><span class="grow">Premium due ${dmy(d)}<small>${esc(p.plan || p.insurer || 'Policy')} · ${esc(p.insured || 'Me')}</small></span><b>${rm(p.premium)}</b></a>`); });
    state.holdings.forEach((h) => { if (h.kind === 'fd' && h.maturity && h.maturity >= t && h.maturity <= soon) out.push(`<a class="row" href="#/wealth"><span class="ic">🏦</span><span class="grow">FD matures ${dmy(h.maturity)}<small>${esc(h.name)}</small></span><b>${rm(C.holdingValue(h, state.fx).value)}</b></a>`); });
    state.owed.forEach((o) => { if (o.dir !== 'out' && o.due && o.due < t && C.owedLeft(o) > 0) out.push(`<a class="row" href="#/wealth"><span class="ic">⏰</span><span class="grow">${esc(o.person)} was due to pay you ${dmy(o.due)}</span><b>${rm(C.owedLeft(o))}</b></a>`); });
    state.owed.forEach((o) => {
      if (!o.plan || o.plan.auto || C.owedLeft(o) <= 0) return;
      const due = C.owedPlanDue(o, t)[0]; if (!due) return;
      const amt = Math.min(num(o.plan.amount), C.owedLeft(o));
      out.push(`<div class="row"><span class="ic">📅</span><span class="grow">${esc(o.person)} ${o.dir === 'out' ? 'you pay' : 'pays you'} monthly · due ${dmy(due)}<small>${rm(C.owedLeft(o))} still owing</small></span><b>${rm(amt)}</b><button type="button" class="btn small primary" data-act="owedGot" data-id="${o.id}">✓ ${o.dir === 'out' ? 'Paid' : 'Got it'}</button><button type="button" class="btn small ghost" data-act="owedMiss" data-id="${o.id}">Missed</button></div>`);
    });
    state.holdings.forEach((h) => { if (!h.offplan) return; C.offplanStatus(h, t).owing.forEach((s) => out.push(`<button class="row" data-act="openHolding" data-id="${h.id}"><span class="ic">🏗️</span><span class="grow">${esc(s.label)} — ${s.late ? '<b class="warn">late</b>' : 'pay by ' + dmy(s.due)}<small>${esc(h.project || h.name)} · progress billing</small></span><b>${rm(s.amount, { d: 0 })}</b></button>`)); });
    const lb = state.settings.lastBackup;
    if (!lb || Date.now() - new Date(lb) > 14 * 864e5) out.push(`<a class="row" href="#/settings"><span class="ic">💾</span><span class="grow">Backup ${lb ? 'last made ' + ago(lb) : 'not made yet'}<small>Your records live only on this phone. Tap to back up.</small></span></a>`);
    return out;
  }

  // ----- records -----
  let recMonth = C.today().slice(0, 7), recFilter = 'all', recSearch = '';
  VIEWS.records = () => {
    const list = state.txns.filter((t) => (t.date || '').slice(0, 7) === recMonth)
      .filter((t) => recFilter === 'all' || t.type === recFilter || (recFilter === 'relief' && t.relief))
      .filter((t) => !recSearch || (t.note + ' ' + catOf(t.type, t.cat)[2]).toLowerCase().includes(recSearch.toLowerCase()))
      .sort((a, b) => (b.date + (b.at || '')).localeCompare(a.date + (a.at || '')));
    const ms = C.monthStats(state.txns, recMonth);
    const byDay = {}; list.forEach((t) => (byDay[t.date] = byDay[t.date] || []).push(t));
    const accName = (id) => (state.accounts.find((a) => a.id === id) || {}).name || '';
    const cats = Object.entries(ms.byCat).sort((a, b) => b[1] - a[1]);
    return `
      <header class="top"><h1>Records</h1><div class="hbtns"><button class="icon gold" data-act="aiVoice" title="Say it">🎙️</button><button class="icon gold" data-act="aiReceipt" title="Scan receipt">📷</button><button class="chip" data-act="addTxn" data-type="expense">＋ Add</button></div></header>
      ${recurringBox()}
      <div class="monthnav"><button class="icon" data-act="recMonth" data-d="-1">‹</button><b>${ymLabel(recMonth)}</b><button class="icon" data-act="recMonth" data-d="1">›</button></div>
      <div class="stats3 card"><div><small>Income</small><b class="up">${rm(ms.income)}</b></div><div><small>Spent</small><b>${rm(ms.expense)}</b></div><div><small>Saved</small><b class="${plc(ms.saved)}">${rm(ms.saved)}</b></div></div>
      ${cats.length ? '<details class="card"><summary><b>Spending by category</b></summary>' + cats.map(([k, v]) => bar(catOf('expense', k)[1] + ' ' + catOf('expense', k)[2], v, num(state.settings.budgets[k]))).join('') + '</details>' : ''}
      <div class="filters">${[['all', 'All'], ['expense', 'Spent'], ['income', 'Income'], ['transfer', 'Transfers'], ['relief', '🧾 Tax receipts']].map(([k, l]) => `<button class="chip ${recFilter === k ? 'on' : ''}" data-act="recFilter" data-f="${k}">${l}</button>`).join('')}</div>
      <input class="search" placeholder="Search notes…" value="${esc(recSearch)}" data-input="recSearch">
      ${Object.keys(byDay).map((d) => `<div class="day"><small class="muted">${dmy(d)} · ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][C.parse(d).getDay()]}</small>
        ${byDay[d].map((t) => { const c = t.inv ? ['', invIcon(t), t.inv.side === 'sell' ? 'Investment sold' : 'Investment'] : t.type === 'transfer' ? ['', '🔁', 'Transfer'] : catOf(t.type, t.cat); return `<button class="row txn" data-act="editTxn" data-id="${t.id}"><span class="ic">${c[1]}</span><span class="grow">${esc(t.note || c[2])}<small>${esc(c[2])}${t.inv ? ' · ' + esc(accName(t.account || t.toAccount)) : t.type === 'transfer' ? ' · ' + esc(accName(t.account)) + ' → ' + esc(accName(t.toAccount)) : t.account ? ' · ' + esc(accName(t.account)) : ''}${t.relief ? ' · 🧾 tax' : ''}${(t.receipts || []).length ? ' · 📎' : ''}${t.noCash ? ' · claim only' : ''}${t.recur ? ' · 🔁' : ''}${t.biz ? ' · 💼' : ''}</small></span><b class="${t.type === 'income' ? 'up' : ''}">${t.type === 'income' ? '+' : t.type === 'expense' ? '−' : ''}${rm(t.amount)}</b></button>`; }).join('')}</div>`).join('') || '<p class="muted center">Nothing here for this month.</p>'}`;
  };

  // ----- wealth -----
  VIEWS.wealth = () => {
    const s = C.summary(state), bal = C.accountBalances(state), fx = state.fx;
    const hs = state.holdings.filter((h) => !h.archived);
    const groups = KINDS.map(([k, ic, l]) => [k, ic, l, hs.filter((h) => h.kind === k)]).filter((g) => g[3].length);
    const hrow = (h) => {
      const v = C.holdingValue(h, fx), pl = v.cost ? v.pl / v.cost : null;
      let sub = '';
      if (['stock', 'crypto', 'gold', 'fund'].includes(h.kind)) sub = fmtU(v.units) + (h.kind === 'gold' ? (h.unit === 'oz' ? ' oz' : ' g') : ' units') + (h.price ? ' @ ' + (h.priceCur || 'MYR') + ' ' + fmtN(h.price, h.price < 10 ? 4 : 2) : ' · no price yet');
      if (h.kind === 'fd') sub = fmtN(h.rate, 2) + '% p.a. · matures ' + dmy(h.maturity);
      if (['epf', 'property', 'other'].includes(h.kind)) sub = h.growth ? 'Estimate: ' + rm(h.value) + ' on ' + dmy(h.valueAt || '') + ' ' + (h.growth > 0 ? '+' : '') + fmtN(h.growth, 1) + '%/yr' : 'Value as at ' + dmy(h.valueAt || '');
      const day = h.prevClose && h.price ? (h.price - h.prevClose) / h.prevClose : null;
      return `<button class="row" data-act="openHolding" data-id="${h.id}"><span class="grow">${esc(h.name)}${h.symbol ? ' <small class="tag">' + esc(h.symbol) + '</small>' : ''}<small>${esc(sub)}${day != null ? ' · today <span class="' + plc(day) + '">' + pct(day) + '</span>' : ''}</small></span><span class="right"><b>${rm(v.value)}</b><small class="${plc(v.pl)}">${v.cost ? rm(v.pl) + ' ' + pct(pl) : ''}</small></span></button>`;
    };
    const loans = state.loans.filter((l) => !l.archived);
    const owedIn = state.owed.filter((o) => o.dir !== 'out' && C.owedLeft(o) > 0), owedOut = state.owed.filter((o) => o.dir === 'out' && C.owedLeft(o) > 0);
    const settled = state.owed.filter((o) => C.owedLeft(o) <= 0);
    const splitRows = state.split.groups.map((g) => [g, C.groupBalances(g).net.me || 0]).filter((x) => x[1]);
    return `
      <header class="top"><h1>Wealth</h1><button class="icon" data-act="toggleHide">${hidden() ? '🙈' : '👁️'}</button></header>
      <section class="hero slim"><div class="split2"><div><small>Total assets</small><b>${rm(s.assets)}</b></div><div><small>Net worth</small><b>${rm(s.netWorth)}</b></div></div>
        <div class="pricebar"><small>Prices ${ago(state.pricesAt)}</small><button class="chip" data-act="refreshPrices">↻ Update prices</button></div></section>
      ${s.assets ? '<section class="card"><h3>Liquid vs long-term</h3>' + liqBar(s) + '<div class="stats3"><div><small>💧 Liquid</small><b>' + rm(s.liquid) + '</b><small>🏦 bank ' + rm(s.cashBy.bank) + '</small></div><div><small>⏳ Investments</small><b>' + rm(s.sellable) + '</b><small>sell in days</small></div><div><small>🏛️ Long-term</small><b>' + rm(s.longTerm) + '</b><small>property, EPF…</small></div></div></section>' : ''}

      <section class="card"><div class="h3row"><h3>📈 Investments</h3><div class="hbtns"><button class="chip" data-act="aiInvest">📷 Scan statement</button><button class="chip" data-act="addHolding">＋ Add</button></div></div>
        ${s.investCost ? `<div class="stats3"><div><small>Capital put in</small><b>${rm(s.investCost)}</b></div><div><small>Worth today</small><b>${rm(s.invest)}</b></div><div><small>Gain / loss</small><b class="${plc(s.investPL)}">${rm(s.investPL)}</b><small class="${plc(s.investPL)}">${pct(s.investPL / s.investCost)}</small></div></div>` : ''}
        ${groups.map(([k, ic, l, list]) => `<h4>${ic} ${esc(l)}</h4>` + list.map(hrow).join('')).join('') || '<p class="muted">Add shares, crypto, gold, unit trusts, FD, EPF or property. Shares, crypto and gold update to today’s price by themselves.</p>'}</section>

      <section class="card"><div class="h3row"><h3>🏦 Accounts</h3><button class="chip" data-act="addAccount">＋ Add</button></div>
        ${ACC_TYPES.map(([k, l]) => { const list = state.accounts.filter((a) => !a.archived && (a.type === k || (k === 'other' && !ACC_TYPES.some((x) => x[0] === a.type)))); if (!list.length) return ''; const sub = list.reduce((t, a) => t + (bal[a.id] || 0), 0); return '<div class="liqhead"><span>' + (k === 'bank' ? '🏦 Cash in bank' : l) + '</span><b class="' + (sub < 0 ? 'down' : '') + '">' + rm(sub) + '</b></div>' + list.map((a) => `<button class="row" data-act="editAccount" data-id="${a.id}"><span class="ic">${(ACC_TYPES.find((x) => x[0] === a.type) || ACC_TYPES[4])[1].split(' ')[0]}</span><span class="grow">${esc(a.name)}</span><b class="${bal[a.id] < 0 ? 'down' : ''}">${rm(bal[a.id] || 0)}</b></button>`).join(''); }).join('')}
        <div class="btnrow"><button class="btn small" data-act="balanceCheck">⚖️ Balance check</button><button class="btn small" data-act="addTxn" data-type="transfer">🔁 Move money</button></div>
        <small class="muted">Forgot to record some spending? Balance check compares what your bank / e-wallet really shows with this app and records the gap.</small></section>
      ${(state.reports || []).length ? `<section class="card"><h3>📊 Investment reports</h3>${state.reports.slice().reverse().map((r) => `<button class="row" data-act="viewReport" data-id="${r.id}"><span class="grow">${esc(r.provider || 'Statement')}<small>${dmy(r.date)} · ${r.count} holdings</small></span><b>${rm(r.total || 0)}</b></button>`).join('')}</section>` : ''}

      <section class="card"><div class="h3row"><h3>🏦 Loans</h3><button class="chip" data-act="addLoan">＋ Add</button></div>
        ${loans.map((l) => { const st = C.loanStatus(l); return `<button class="row" data-act="editLoan" data-id="${l.id}"><span class="grow">${esc(l.name)}<small>${rm(st.monthly)}/month · ${st.leftMonths} months left${st.fromStatement ? ' · from statement' : ''}</small><span class="track thin"><i style="width:${(st.progress * 100).toFixed(1)}%"></i></span></span><span class="right"><b class="down">${rm(st.balance)}</b><small>balance</small></span></button>`; }).join('') || '<p class="muted">No loans recorded.</p>'}
        ${loans.length ? `<div class="row total"><span class="grow">Total monthly repayments</span><b>${rm(loans.reduce((a, l) => { const st = C.loanStatus(l); return a + (st.done ? 0 : st.monthly); }, 0))}</b></div>` : ''}</section>

      <section class="card"><div class="h3row"><h3>🤝 Money people owe me</h3><button class="chip" data-act="addOwed" data-dir="in">＋ Add</button></div>
        ${owedIn.map(owedRow).join('')}
        ${splitRows.filter((x) => x[1] > 0).map(([g, n]) => `<a class="row" href="#/group/${g.id}"><span class="ic">🍻</span><span class="grow">${esc(g.name)}<small>Split bill · friends owe you</small></span><b class="up">${rm(n / 100)}</b></a>`).join('')}
        ${!owedIn.length && !splitRows.some((x) => x[1] > 0) ? '<p class="muted">Nobody owes you money right now.</p>' : `<div class="row total"><span class="grow">Total owed to me</span><b class="up">${rm(s.owedToMe + s.splitIn)}</b></div>`}
        <div class="h3row mt"><h3>🙏 Money I owe</h3><button class="chip" data-act="addOwed" data-dir="out">＋ Add</button></div>
        ${owedOut.map(owedRow).join('')}
        ${splitRows.filter((x) => x[1] < 0).map(([g, n]) => `<a class="row" href="#/group/${g.id}"><span class="ic">🍻</span><span class="grow">${esc(g.name)}<small>Split bill · you owe</small></span><b class="down">${rm(-n / 100)}</b></a>`).join('')}
        ${!owedOut.length && !splitRows.some((x) => x[1] < 0) ? '<p class="muted">You don’t owe anyone.</p>' : ''}
        ${settled.length ? '<details><summary class="muted small">Settled (' + settled.length + ')</summary>' + settled.map(owedRow).join('') + '</details>' : ''}</section>`;
  };
  function owedPlanText(o) {
    const pi = C.owedPlanInfo(o); if (!pi) return '';
    return ' · 📅 ' + rm(o.plan.amount) + '/month' + (o.plan.auto ? '' : ' (confirm)') + ', next ' + dmy(pi.next) + ', done ~' + dmy(pi.finish);
  }
  function owedRow(o) {
    const left = C.owedLeft(o);
    return `<button class="row" data-act="editOwed" data-id="${o.id}"><span class="ic">${o.dir === 'out' ? '🙏' : '🤝'}</span><span class="grow">${esc(o.person)}<small>${esc(o.note || '')}${o.date ? ' · since ' + dmy(o.date) : ''}${o.due ? ' · due ' + dmy(o.due) : ''}${owedPlanText(o)}</small></span><span class="right"><b class="${left ? (o.dir === 'out' ? 'down' : 'up') : 'muted'}">${left ? rm(left) : 'Settled'}</b>${left && left < num(o.amount) ? '<small>of ' + rm(o.amount) + '</small>' : ''}</span></button>`;
  }

  // ----- split -----
  const pname = (id) => (id === 'me' ? 'Me' : (state.split.people.find((p) => p.id === id) || {}).name || '?');
  VIEWS.split = () => {
    const gs = state.split.groups.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    let inn = 0, out = 0; gs.forEach((g) => { const n = C.groupBalances(g).net.me || 0; if (n > 0) inn += n; else out -= n; });
    return `
      <header class="top"><h1>Split bills</h1><button class="chip" data-act="addGroup">＋ New outing</button></header>
      <section class="hero slim"><div class="split2"><div><small>Friends owe me</small><b class="up">${rm(inn / 100)}</b></div><div><small>I owe friends</small><b>${rm(out / 100)}</b></div></div></section>
      <p class="muted small">Make an outing (a dinner, a trip, a house). Add each bill, say who paid and how to split it — equally, exact amounts, shares, % or item by item with service charge and SST. The app works out who pays whom with the fewest transfers.</p>
      ${gs.map((g) => { const b = C.groupBalances(g), n = b.net.me || 0; return `<a class="row card" href="#/group/${g.id}"><span class="ic">🍻</span><span class="grow">${esc(g.name)}<small>${dmy(g.date)} · ${g.members.length} people · spent ${rm(b.total / 100)}</small></span><span class="right">${n ? '<b class="' + (n > 0 ? 'up' : 'down') + '">' + rm(Math.abs(n) / 100) + '</b><small>' + (n > 0 ? 'owed to you' : 'you owe') + '</small>' : '<small class="muted">settled</small>'}</span></a>`; }).join('') || '<p class="muted center">No outings yet.</p>'}`;
  };
  VIEWS.group = (r) => {
    const g = state.split.groups.find((x) => x.id === r[1]);
    if (!g) return '<p>Not found. <a href="#/split">Back</a></p>';
    const b = C.groupBalances(g), plan = C.simplify(b.net);
    return `
      <header class="top"><a href="#/split" class="icon">‹</a><h1 class="grow">${esc(g.name)}</h1><button class="icon" data-act="editGroup" data-id="${g.id}">✎</button></header>
      <section class="hero slim"><div class="split2"><div><small>Team spent</small><b>${rm(b.total / 100)}</b></div><div><small>My share</small><b>${rm((b.share.me || 0) / 100)}</b></div></div></section>
      ${b.errors.length ? '<div class="card warn">' + b.errors.map((e) => '⚠️ ' + esc(e.title) + ': ' + esc(e.error)).join('<br>') + '</div>' : ''}
      <section class="card"><h3>Each person</h3>
        <div class="tbl"><div class="th"><span>Name</span><span>Paid</span><span>Share</span><span>Balance</span></div>
        ${g.members.map((p) => `<div><span>${esc(pname(p))}</span><span>${fmtN(b.paid[p] / 100)}</span><span>${fmtN(b.share[p] / 100)}</span><span class="${plc(b.net[p])}">${b.net[p] > 0 ? '+' : ''}${fmtN(b.net[p] / 100)}</span></div>`).join('')}</div>
        <small class="muted">Balance + means the group owes them; − means they owe.</small></section>
      <section class="card"><h3>To settle up</h3>
        ${plan.map((t) => `<div class="row"><span class="grow"><b>${esc(pname(t.from))}</b> pays <b>${esc(pname(t.to))}</b></span><b>${rm(t.c / 100, { show: true })}</b><button class="chip" data-act="settle" data-g="${g.id}" data-from="${t.from}" data-to="${t.to}" data-c="${t.c}">Paid ✓</button></div>`).join('') || '<p class="muted">All settled 🎉</p>'}
        <div class="btnrow"><button class="btn" data-act="copySplit" data-id="${g.id}">📋 Copy for WhatsApp</button><button class="btn" data-act="shareToRecords" data-id="${g.id}">🧾 Add my share to my records</button></div></section>
      <section class="card"><div class="h3row"><h3>Bills</h3><button class="chip" data-act="addExp" data-g="${g.id}">＋ Add bill</button></div>
        ${(g.expenses || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((e) => { const sh = C.splitShares(e, g.members); const payers = Object.keys(e.paid || {}).filter((p) => num(e.paid[p]) || Object.keys(e.paid).length === 1); return `<button class="row" data-act="editExp" data-g="${g.id}" data-id="${e.id}"><span class="grow">${esc(e.title || 'Bill')}<small>${dmy(e.date)} · paid by ${payers.map((p) => esc(pname(p))).join(', ')} · ${({ equal: 'split equally', exact: 'exact amounts', shares: 'by shares', percent: 'by %', items: 'by items' })[e.mode]}${sh.error ? ' · ⚠️' : ''}</small></span><span class="right"><b>${rm(sh.totalC / 100)}</b><small>me ${rm((sh.owe.me || 0) / 100)}</small></span></button>`; }).join('') || '<p class="muted">No bills yet.</p>'}
        ${(g.settlements || []).length ? '<h4>Payments made</h4>' + g.settlements.map((s, i) => `<div class="row"><span class="grow">${esc(pname(s.from))} paid ${esc(pname(s.to))}<small>${dmy(s.date)}</small></span><b>${rm(s.amount, { show: true })}</b><button class="icon small" data-act="delSettle" data-g="${g.id}" data-i="${i}">✕</button></div>`).join('') : ''}</section>`;
  };

  // ----- more -----
  VIEWS.more = () => `
    <header class="top"><h1>More</h1></header>
    <section class="card menu">
      <a class="row" href="#/insurance"><span class="ic">🛡️</span><span class="grow">Insurance & coverage<small>Policies, cover per person, premiums due</small></span>›</a>
      <a class="row" href="#/tax"><span class="ic">🧾</span><span class="grow">Income tax relief<small>Receipts by relief type, limits, tax estimate</small></span>›</a>
      <a class="row" href="#/reports"><span class="ic">📑</span><span class="grow">Reports & accounts<small>Debit / credit statements, income statement, assets & liabilities, tax pack for your accountant</small></span>›</a>
      <a class="row" href="#/receipts"><span class="ic">🗂️</span><span class="grow">Receipts library<small>Every receipt photo by year, category and tax relief</small></span>›</a>
      <a class="row" href="#/budget"><span class="ic">🎯</span><span class="grow">Monthly budgets</span>›</a>
      <a class="row" href="#/settings"><span class="ic">⚙️</span><span class="grow">Settings & backup</span>›</a>
    </section>
    <p class="muted small center">Money Account keeps your records on this phone only.</p>`;

  VIEWS.insurance = () => {
    const cov = C.coverage(state.policies), tg = state.settings.targets, inc = num(tg.income);
    const ppl = Object.keys(cov).sort((a, b) => (a === 'Me' ? -1 : b === 'Me' ? 1 : a.localeCompare(b)));
    const totalPrem = ppl.reduce((a, p) => a + cov[p].premium, 0);
    const t = C.today();
    const tgt = { death: inc * tg.deathX, tpd: inc * tg.deathX, ci: inc * tg.ciX, med: num(tg.med) };
    return `
      <header class="top"><a href="#/more" class="icon">‹</a><h1 class="grow">Insurance</h1><button class="chip" data-act="addPolicy">＋ Policy</button></header>
      <section class="hero slim"><div class="split2"><div><small>Premiums a year</small><b>${rm(totalPrem)}</b></div><div><small>A month</small><b>${rm(totalPrem / 12)}</b></div></div></section>
      ${ppl.map((p) => `<section class="card"><h3>${esc(p)} <small class="muted">${cov[p].count} polic${cov[p].count > 1 ? 'ies' : 'y'} · ${rm(cov[p].premium)}/yr</small></h3>
        ${C.COVERS.filter(([k]) => cov[p][k] || (p === 'Me' && inc && tgt[k])).map(([k, l]) => { const v = cov[p][k] || 0, target = p === 'Me' && inc ? tgt[k] : 0; return `<div class="bar"><div class="barlab"><span>${l}</span><span>${rm(v, { d: 0 })}${target ? ' / ' + rm(target, { d: 0 }) : ''}</span></div>${target ? '<div class="track"><i class="' + (v < target ? 'short' : '') + '" style="width:' + Math.min(100, v / target * 100).toFixed(1) + '%"></i></div>' : ''}</div>`; }).join('')}
        ${p === 'Me' && !inc ? '<small class="muted">Set your yearly income in Settings to compare cover with a target (rule of thumb: death/TPD ' + tg.deathX + '×, CI ' + tg.ciX + '× income).</small>' : ''}
      </section>`).join('')}
      <section class="card"><h3>Policies</h3>
        ${state.policies.slice().sort((a, b) => (a.insured || '').localeCompare(b.insured || '')).map((p) => `<button class="row" data-act="editPolicy" data-id="${p.id}"><span class="grow">${esc(p.plan || 'Policy')}<small>${esc(p.insurer || '')} · ${esc(p.insured || 'Me')} · ${(POL_TYPES.find((x) => x[0] === p.type) || POL_TYPES[7])[1]}${p.status === 'lapsed' || p.status === 'ended' ? ' · ' + p.status : ' · next due ' + dmy(C.nextDue(p, t))}</small></span><span class="right"><b>${rm(p.premium)}</b><small>${({ M: 'monthly', Q: 'quarterly', H: 'half-yearly', Y: 'yearly' })[p.mode] || ''}</small></span></button>`).join('') || '<p class="muted">Add each policy for you and your family to see total cover in one place.</p>'}
      </section>
      <p class="muted small">Targets are simple rules of thumb you can change in Settings, not advice. Cover amounts are what you type from your policy documents.</p>`;
  };

  let taxYear = Number(C.today().slice(0, 4));
  VIEWS.tax = () => {
    const ts = C.taxSummary(state, taxYear), ty = (state.settings.tax || {})[taxYear] || {};
    return `
      <header class="top"><a href="#/more" class="icon">‹</a><h1 class="grow">Tax relief</h1><button class="chip" data-act="addTxn" data-type="expense" data-relief="lifestyle">＋ Receipt</button></header>
      <div class="monthnav"><button class="icon" data-act="taxYear" data-d="-1">‹</button><b>Year ${taxYear} (YA ${taxYear})</b><button class="icon" data-act="taxYear" data-d="1">›</button></div>
      <section class="hero slim"><div class="split2"><div><small>Relief claimed</small><b>${rm(ts.total)}</b></div><div><small>Tax saved (estimate)</small><b class="up">${rm(ts.saved)}</b></div></div></section>
      <section class="card"><h3>Reliefs</h3>
        ${ts.rows.map((r) => {
          if (r.kind === 'auto') return `<div class="bar"><div class="barlab"><span>✅ ${esc(r.name)}</span><span>${rm(r.limit, { d: 0 })}</span></div></div>`;
          if (r.kind === 'flag') return `<label class="bar flag"><div class="barlab"><span><input type="checkbox" data-change="taxFlag" data-id="${r.id}" ${r.on ? 'checked' : ''}> ${esc(r.name)}</span><span>${rm(r.limit, { d: 0 })}</span></div></label>`;
          if (r.kind === 'count') return `<div class="bar"><div class="barlab"><span>${esc(r.name)}</span><span><input class="mini" type="number" min="0" inputmode="numeric" value="${r.count || ''}" placeholder="0" data-change="taxCount" data-id="${r.id}"> × ${fmtN(r.limit, 0)}</span></div></div>`;
          const p = r.limit ? Math.min(1, r.claimed / r.limit) : 0;
          return `<button class="bar tap" data-act="reliefItems" data-id="${r.id}"><div class="barlab"><span>${esc(r.name)}</span><span>${rm(r.claimed)} / ${rm(r.limit, { d: 0 })}</span></div><div class="track"><i class="${r.claimed > r.limit ? 'over' : ''}" style="width:${(p * 100).toFixed(1)}%"></i></div>${r.items.length ? '<small class="muted">' + r.items.length + ' receipt' + (r.items.length > 1 ? 's' : '') + (r.claimed > r.limit ? ' · only ' + rm(r.limit, { d: 0 }) + ' counts' : '') + '</small>' : ''}</button>`;
        }).join('')}
      </section>
      <section class="card"><h3>Tax estimate</h3>
        <label class="fld">Yearly income for tax (RM)<input inputmode="decimal" data-change="taxIncome" value="${ty.income || ''}" placeholder="${ts.incomeFromRecords ? 'From records: ' + fmtN(ts.incomeFromRecords) : 'e.g. 120000'}"></label>
        <label class="fld">Allowable business expenses (RM)<input inputmode="decimal" data-change="taxExp" value="${ty.businessExp || ''}" placeholder="${ts.bizFromRecords ? 'From records tagged 💼: ' + fmtN(ts.bizFromRecords) : '0'}"><small class="muted">Agents: expenses wholly for earning commission, as allowed by LHDN. Leave blank to use records you tagged 💼 Business.</small></label>
        <div class="row"><span class="grow">Income</span><b>${rm(ts.income)}</b></div>
        <div class="row"><span class="grow">Less expenses & reliefs</span><b>−${rm(ts.expenses + ts.total)}</b></div>
        <div class="row"><span class="grow">Chargeable income</span><b>${rm(ts.chargeable)}</b></div>
        <div class="row total"><span class="grow">Estimated income tax${ts.tax.rebate ? ' (after RM400 rebate)' : ''}<small>Top rate on your last ringgit: ${ts.tax.marginal}%</small></span><b>${rm(ts.tax.tax)}</b></div>
        <small class="muted">Estimate only, using resident rates in force since YA2023. It ignores zakat, PCB already paid and special cases.</small></section>
      <section class="card"><h3>Relief limits</h3><p class="small muted">Starting limits are LHDN’s YA2025 amounts. Budget changes each year, so check hasil.gov.my for YA ${taxYear} and edit any limit here.</p>
        <button class="btn" data-act="editLimits">Edit limits</button>
        <label class="row"><input type="checkbox" data-change="autoIns" ${state.settings.autoInsRelief !== false ? 'checked' : ''}> <span class="grow small">Count my insurance premiums automatically (from Insurance, by each policy’s relief type)</span></label></section>`;
  };

  VIEWS.budget = () => `
    <header class="top"><a href="#/more" class="icon">‹</a><h1 class="grow">Monthly budgets</h1></header>
    <p class="muted small">Leave blank for no budget. Home shows how this month is going.</p>
    <section class="card">${EXP_CATS.map(([k, i, l]) => `<label class="row"><span class="ic">${i}</span><span class="grow">${l}</span><input class="mini wide" inputmode="decimal" placeholder="–" value="${state.settings.budgets[k] || ''}" data-change="budget" data-k="${k}"></label>`).join('')}</section>`;

  VIEWS.settings = () => {
    const s = state.settings, tg = s.targets;
    return `
    <header class="top"><a href="#/more" class="icon">‹</a><h1 class="grow">Settings</h1></header>
    <section class="card"><h3>Me</h3>
      <label class="fld">Name shown on Home<input data-change="set" data-k="name" value="${esc(s.name)}"></label>
      <label class="row"><input type="checkbox" data-change="setBool" data-k="hide" ${s.hide ? 'checked' : ''}><span class="grow">Hide amounts (for showing the app to others)</span></label></section>
    <section class="card"><h3>Planning targets</h3>
      <label class="fld">My yearly income (RM) for insurance targets<input inputmode="decimal" data-change="target" data-k="income" value="${tg.income || ''}"></label>
      <div class="grid2"><label class="fld">Death / TPD × income<input inputmode="decimal" data-change="target" data-k="deathX" value="${tg.deathX}"></label>
      <label class="fld">Critical illness × income<input inputmode="decimal" data-change="target" data-k="ciX" value="${tg.ciX}"></label>
      <label class="fld">Medical annual limit (RM)<input inputmode="decimal" data-change="target" data-k="med" value="${tg.med}"></label>
      <label class="fld">Emergency fund (months)<input inputmode="decimal" data-change="target" data-k="emergencyMonths" value="${tg.emergencyMonths}"></label></div></section>
    <section class="card"><h3>Live prices & AI</h3>
      <p class="small muted">Crypto, gold and exchange rates update by themselves. Bursa / US share prices and the AI (voice, receipt and statement reading) go through your own small server, because phones cannot call those services directly. The server keeps nothing: only ticker symbols, and the voice / photo you choose to send to AI, pass through it.</p>
      <label class="fld">Server link<input data-change="set" data-k="server" value="${esc(s.server)}" placeholder="blank = built-in server"></label>
      <label class="fld">AI access code<input type="password" id="aicodeIn" data-change="set" data-input="setLive" data-k="aiCode" value="${esc(s.aiCode)}" placeholder="the code set on your server" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"></label>
      <div class="btnrow"><button type="button" class="btn" data-act="codeShow">👁️ Show</button><button type="button" class="btn" data-act="codeTest">✅ Test code</button></div><div id="codeRes" class="small"></div>
      <small class="muted">Now using: ${esc(PR.server(s) || 'none — share prices must be typed by hand; voice uses the phone’s own speech typing')}</small></section>
    <section class="card"><h3>Sound</h3><label class="row"><input type="checkbox" data-change="setBool" data-k="sound" ${s.sound !== false ? 'checked' : ''}><span class="grow">💰 Money sound on buttons</span></label></section>
    <section class="card"><h3>💾 Backup</h3>
      <p class="small muted">Your records live only on this phone. If the phone is lost or the app is deleted, they are gone unless you have a backup file. Save it to Google Drive, email it to yourself, or keep it on your laptop. Last backup: ${s.lastBackup ? dmy(s.lastBackup.slice(0, 10)) + ' (' + ago(s.lastBackup) + ')' : 'never'}.</p>
      <div class="btnrow"><button class="btn primary" data-act="backup" data-img="1">Back up (with receipt photos)</button><button class="btn" data-act="backup">Back up (records only)</button></div>
      <label class="btn ghost">Restore from a backup file<input type="file" accept=".json,application/json" hidden data-change="importFile"></label></section>
    <section class="card"><h3>Danger zone</h3><button class="btn danger" data-act="eraseAll">Erase everything on this phone</button></section>
    <p class="muted small center">Money Account · data stays on your phone</p>`;
  };

  // ---------- sheets (pop-up forms) ----------
  let sheetSubmit = null;
  function openSheet(title, body, onSubmit, opts) {
    opts = opts || {};
    closeSheet();
    const d = document.createElement('div');
    d.className = 'sheetwrap';
    d.innerHTML = `<div class="sheetbg" data-act="closeSheet"></div><form class="sheet" novalidate><div class="sheethead"><button type="button" class="icon" data-act="closeSheet">✕</button><h2>${esc(title)}</h2>${onSubmit ? '<button class="btn primary small" type="submit">' + (opts.saveText || 'Save') + '</button>' : ''}</div><div class="sheetbody">${body}</div></form>`;
    document.body.appendChild(d);
    document.body.classList.add('locked');
    sheetSubmit = onSubmit;
    d.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); if (sheetSubmit && sheetSubmit(formVals(d.querySelector('form'))) !== false) closeSheet(); });
    const f = d.querySelector('[autofocus]'); if (f) setTimeout(() => f.focus(), 50);
    return d;
  }
  function closeSheet() { $$('.sheetwrap').forEach((x) => x.remove()); document.body.classList.remove('locked'); sheetSubmit = null; }
  function formVals(form) {
    const o = {};
    $$('[name]', form).forEach((el) => {
      if (el.type === 'checkbox') { if (el.dataset.multi) { (o[el.name] = o[el.name] || []); if (el.checked) o[el.name].push(el.value); } else o[el.name] = el.checked; }
      else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
      else o[el.name] = el.value.trim();
    });
    return o;
  }
  const opt = (list, val) => list.map(([k, l]) => `<option value="${esc(k)}" ${k === val ? 'selected' : ''}>${esc(l)}</option>`).join('');
  const fld = (label, inner, hint) => `<label class="fld">${label}${inner}${hint ? '<small class="muted">' + hint + '</small>' : ''}</label>`;
  const inp = (name, val, attrs) => `<input name="${name}" value="${esc(val == null ? '' : val)}" ${attrs || ''}>`;
  const money = (name, val, attrs) => inp(name, val === 0 || val ? val : '', 'inputmode="decimal" placeholder="0.00" ' + (attrs || ''));
  function toast(msg, ms) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.remove(), ms || 2600);
  }
  const confirmBox = (msg) => window.confirm(msg);

  // ----- transaction form -----
  let draftReceipts = [];
  function txnForm(t) {
    const isNew = !t;
    t = t || { type: 'expense', date: C.today(), account: (state.accounts[0] || {}).id, cat: 'food' };
    draftReceipts = (t.receipts || []).slice();
    const rule = t.recur ? (state.recurring || []).find((r) => r.id === t.recur) : null;
    const accs = state.accounts.filter((a) => !a.archived || a.id === t.account).map((a) => [a.id, a.name]);
    const reliefs = [['', '— not a tax relief —']].concat(C.reliefList(state.settings).filter((r) => !r.kind).map((r) => [r.id, r.name]));
    const body = `
      <div class="seg">${[['expense', 'Spent'], ['income', 'Income'], ['transfer', 'Transfer']].map(([k, l]) => `<label><input type="radio" name="type" value="${k}" ${t.type === k ? 'checked' : ''} data-change="txnType"><span>${l}</span></label>`).join('')}</div>
      <label class="amount">RM ${money('amount', t.amount, 'autofocus required')}</label>
      <div class="grid2">${fld('Date', inp('date', t.date, 'type="date"'))}${fld('<span class="t-transfer-hide">Account</span><span class="t-transfer-show">From</span>', '<select name="account">' + opt(accs, t.account) + '</select>')}</div>
      <div class="t-transfer-show">${fld('To', '<select name="toAccount">' + opt(accs, t.toAccount || (accs[1] || [])[0]) + '</select>')}</div>
      <div class="t-transfer-hide">${fld('Category', '<div class="cats" data-for="expense">' + EXP_CATS.map(([k, i, l]) => `<label><input type="radio" name="catE" value="${k}" ${t.cat === k && t.type !== 'income' ? 'checked' : ''}><span>${i}<small>${l}</small></span></label>`).join('') + '</div><div class="cats" data-for="income">' + INC_CATS.map(([k, i, l]) => `<label><input type="radio" name="catI" value="${k}" ${t.cat === k && t.type === 'income' ? 'checked' : ''}><span>${i}<small>${l}</small></span></label>`).join('') + '</div>')}</div>
      ${fld('Note', inp('note', t.note, 'placeholder="e.g. Lunch with client, Grab to office"'))}
      <div class="t-expense-only">${fld('Tax relief', '<select name="relief">' + opt(reliefs, t.relief || '') + '</select>', 'Tag receipts you can claim. They add up in More → Tax relief.')}
        <label class="row"><input type="checkbox" name="noCash" ${t.noCash ? 'checked' : ''}><span class="grow small">Claim only — don’t count as spending (e.g. EPF or SOCSO deducted from pay)</span></label>
        <label class="row"><input type="checkbox" name="biz" ${t.biz ? 'checked' : ''}><span class="grow small">💼 Business expense — cost of earning my agency income (goes to the accountant’s tax pack)</span></label></div>
      <div class="t-income-only"><label class="row"><input type="checkbox" name="notTaxable" ${t.notTaxable ? 'checked' : ''}><span class="grow small">Not taxable income (gift, refund, money moved)</span></label></div>
      ${isNew ? `<div class="grid2">${fld('🔁 Repeat', '<select name="every">' + opt([['0', 'Just once']].concat(Object.entries(C.EVERY)), '0') + '</select>')}${fld('Until (optional)', inp('until', '', 'type="date"'))}</div>`
        : rule ? `<div class="card inset">🔁 ${esc(C.EVERY[rule.every])} from ${dmy(rule.start)}${rule.end ? ' until ' + dmy(rule.end) : ''}${rule.paused ? ' · stopped' : ' · next ' + dmy(C.nextRuleDate(rule))}<div class="btnrow"><button type="button" class="btn small" data-act="editRule" data-id="${rule.id}">Change repeat</button></div></div>` : ''}
      <div class="fld">Receipt photos<div class="thumbs" id="thumbs"></div><label class="btn small">📷 Add photo<input type="file" accept="image/*" multiple hidden data-change="addReceipt"></label></div>
      ${!isNew ? '<button type="button" class="btn danger" data-act="delTxn" data-id="' + t.id + '">Delete this record</button>' : ''}`;
    const d = openSheet(isNew ? 'New record' : 'Edit record', body, (v) => {
      const amount = num(v.amount);
      if (!(amount > 0)) { toast('Enter an amount'); return false; }
      if (v.type === 'transfer' && v.account === v.toAccount) { toast('Pick two different accounts'); return false; }
      const o = isNew ? { id: C.uid(), at: new Date().toISOString() } : t;
      Object.assign(o, { type: v.type, amount: C.r2(amount), date: v.date || C.today(), account: v.account, note: v.note, receipts: draftReceipts.slice() });
      o.cat = v.type === 'income' ? v.catI || 'other' : v.type === 'expense' ? v.catE || 'other' : '';
      o.toAccount = v.type === 'transfer' ? v.toAccount : undefined;
      o.relief = v.type === 'expense' ? v.relief || undefined : undefined;
      o.noCash = v.type === 'expense' && v.noCash ? true : undefined;
      o.biz = v.type === 'expense' && v.biz ? true : undefined;
      o.notTaxable = v.type === 'income' && v.notTaxable ? true : undefined;
      if (isNew) state.txns.push(o);
      if (isNew && num(v.every) > 0) {
        const r = { id: C.uid(), type: o.type, amount: o.amount, cat: o.cat, account: o.account, toAccount: o.toAccount, note: o.note, relief: o.relief, every: num(v.every), start: o.date, end: v.until || undefined, lastPosted: o.date };
        (state.recurring = state.recurring || []).push(r); o.recur = r.id;
        const made = C.postRecurring(state);
        if (made.length) toast('Saved, plus ' + made.length + ' earlier repeat' + (made.length > 1 ? 's' : '') + ' up to today', 3500);
      }
      save(); render(); if (!(isNew && num(v.every) > 0)) toast('Saved'); else if (!$('.toast')) toast('Saved. It will repeat ' + C.EVERY[num(v.every)].toLowerCase() + '.');
    });
    txnTypeUI(d, t.type);
    drawThumbs();
    return d;
  }
  function txnTypeUI(d, type) {
    d.querySelector('.sheet').dataset.type = type;
  }
  async function drawThumbs() {
    const box = $('#thumbs'); if (!box) return;
    box.innerHTML = '';
    for (const id of draftReceipts) {
      const src = await S.getImg(id).catch(() => null);
      const el = document.createElement('div'); el.className = 'thumb';
      el.innerHTML = (src ? `<img src="${src}" data-act="viewImg" data-id="${id}">` : '<span>missing</span>') + `<button type="button" data-act="rmReceipt" data-id="${id}">✕</button>`;
      box.appendChild(el);
    }
  }

  // ----- account form -----
  function accountForm(a) {
    const isNew = !a; a = a || { type: 'bank', opening: 0 };
    const bal = isNew ? 0 : C.accountBalances(state)[a.id];
    openSheet(isNew ? 'New account' : 'Edit account', `
      ${fld('Name', inp('name', a.name, 'placeholder="e.g. Maybank savings, TNG eWallet, CIMB Visa" autofocus'))}
      ${fld('Type', '<select name="type">' + opt(ACC_TYPES, a.type) + '</select>')}
      ${fld('Starting balance (RM)', money('opening', a.opening), 'The balance on the day you start recording. For a credit card, type what you owe as a minus, e.g. -1200. ' + (isNew ? '' : 'Balance now with records: ' + rm(bal, { show: true })))}
      ${!isNew ? '<label class="row"><input type="checkbox" name="archived" ' + (a.archived ? 'checked' : '') + '><span class="grow small">Closed / hide this account</span></label><button type="button" class="btn danger" data-act="delAccount" data-id="' + a.id + '">Delete account</button>' : ''}`,
    (v) => {
      if (!v.name) { toast('Give it a name'); return false; }
      const o = isNew ? { id: C.uid() } : a;
      Object.assign(o, { name: v.name, type: v.type, opening: C.r2(num(v.opening)), archived: !!v.archived || undefined });
      if (isNew) state.accounts.push(o);
      save(); render();
    });
  }

  // ----- holding forms -----
  function holdingForm(h) {
    const isNew = !h;
    h = h || { kind: 'stock', date: C.today(), priceCur: 'MYR' };
    const lot0 = (h.lots || [])[0] || {};
    const body = `
      ${isNew ? fld('What is it?', '<select name="kind" data-change="holdKind">' + opt(KINDS.map(([k, i, l]) => [k, i + ' ' + l]), h.kind) + '</select>') : '<input type="hidden" name="kind" value="' + h.kind + '">'}
      <div class="k-stock k-crypto">${fld('Search', '<div class="searchbox"><input id="symq" placeholder="e.g. Maybank, Apple, VOO, Bitcoin" autocomplete="off"><button type="button" class="btn small" data-act="symSearch">Find</button></div><div id="symres"></div>')}</div>
      ${fld('Name', inp('name', h.name, 'placeholder="e.g. Maybank, Public Mutual PIX, GE Dana Gemilang"'))}
      <div class="k-stock">${fld('Ticker symbol', inp('symbol', h.symbol, 'placeholder="1155.KL for Bursa, AAPL for US" autocapitalize="characters"'), 'Bursa codes end with .KL (Maybank = 1155.KL). Find fills this in.')}</div>
      <div class="k-crypto">${fld('Coin id', inp('coinId', h.coinId, 'placeholder="bitcoin"'), 'Filled by Find.')}</div>
      <div class="k-gold">${fld('Unit', '<select name="unit">' + opt([['g', 'grams'], ['oz', 'troy ounces']], h.unit || 'g') + '</select>')}</div>
      ${isNew ? `<div class="k-stock k-crypto k-gold k-fund"><div class="grid2">${fld('Units / quantity', inp('units', lot0.units, 'inputmode="decimal" placeholder="e.g. 1000"'))}${fld('Capital put in (RM)', money('capital', lot0.amount), 'Total paid incl. fees')}</div>${fld('Date bought', inp('date', lot0.date || C.today(), 'type="date"'))}<small class="muted">Bought at different times? Add the first buy here, then “Buy more” later. Or put total units and total capital.</small></div>` : ''}
      <div class="k-fund">${fld('Find the fund (daily price)', '<div class="searchbox"><input id="fundq" placeholder="e.g. Public Ittikal, PB Growth" autocomplete="off"><button type="button" class="btn small" data-act="fundSearch">Find</button></div><div id="fundres">' + (h.navName ? '<p class="small up">✓ Daily price from ' + esc(h.navName) + ' · ' + esc(h.navMgr || '') + '</p>' : '') + '</div>', 'Unit trusts from Public Mutual and every other Malaysian fund house: the price updates by itself each business day (FIMM daily price report). ILP funds are not in it — type their price.')}
        <input type="hidden" name="navName" value="${esc(h.navName || '')}"><input type="hidden" name="navMgr" value="${esc(h.navMgr || '')}">
        ${fld('Price per unit (NAV, RM)', inp('price', h.price, 'inputmode="decimal" placeholder="e.g. 0.8512"'), 'Filled in by itself once the fund is found.')}</div>
      <div class="k-stock"><details><summary class="small muted">Type the price yourself</summary>${fld('Price', inp('mprice', '', 'inputmode="decimal" placeholder="leave blank to use live price"'))}${fld('Currency', '<select name="mcur">' + opt([['MYR', 'MYR'], ['USD', 'USD'], ['SGD', 'SGD'], ['HKD', 'HKD'], ['GBP', 'GBP'], ['EUR', 'EUR'], ['AUD', 'AUD'], ['JPY', 'JPY'], ['CNY', 'CNY']], h.priceCur || 'MYR') + '</select>')}</details></div>
      <div class="k-fd"><div class="grid2">${fld('Amount placed (RM)', money('principal', h.principal))}${fld('Interest % a year', inp('rate', h.rate, 'inputmode="decimal" placeholder="3.5"'))}${fld('Start date', inp('start', h.start || C.today(), 'type="date"'))}${fld('Maturity date', inp('maturity', h.maturity, 'type="date"'))}</div></div>
      <div class="k-epf k-property k-other"><div class="grid2">${fld('Value (RM)', money('value', h.value))}${fld('As at', inp('valueAt', h.valueAt || C.today(), 'type="date"'))}</div></div>
      <div class="k-property"><label class="row"><input type="checkbox" name="isOff" ${h.offplan && !h.offplan.done ? 'checked' : ''}><span class="grow"><b>🏗️ New launch — still being built</b><small>Track the SPA price, each progress billing and handover.</small></span></label>
        <div class="grid2">${fld('SPA price (RM)', money('offPrice', (h.offplan || {}).price))}${fld('Rebate / discount (RM)', money('offRebate', (h.offplan || {}).rebate))}${fld('SPA signed', inp('offSpa', (h.offplan || {}).spaDate || C.today(), 'type="date"'))}${fld('Expected keys', inp('offVp', (h.offplan || {}).vpDue, 'type="date"'))}</div>
        <small class="muted">For a new launch, fill these and leave “Value” blank. Under the standard SPA (Schedule H) keys are due within 36 months of signing.</small></div>
      <div class="k-property"><div class="grid2">${fld('Project / building', inp('project', h.project, 'placeholder="e.g. Artis 3 Residence"'))}${fld('Built-up (sq ft)', inp('builtUp', h.builtUp, 'inputmode="decimal" placeholder="e.g. 1076"'))}</div>${fld('Unit type', inp('ptype', h.ptype, 'placeholder="e.g. Condo, 3 rooms, mid floor"'))}</div>
      <div class="k-property k-other">${fld('Expected change a year (%)', inp('growth', h.growth, 'inputmode="decimal" placeholder="e.g. 2 — blank = keep value as typed"'), 'The value then moves a little every day from the date above. It is an estimate, not a valuation.')}
        <div class="k-property"><p class="small muted">No service gives a daily market price for one house. For a real figure: recent sales nearby on <a href="https://www.brickz.my" target="_blank" rel="noopener">Brickz</a> (from government transaction records), the state's House Price Index from <a href="https://napic.jpph.gov.my" target="_blank" rel="noopener">NAPIC</a> (every quarter — use its yearly % above), or a bank / valuer's valuation. Type the new value and date when you get one.</p></div></div>
      <div class="k-epf k-property k-other">${fld('Capital put in (RM)', money('cost', h.cost), 'Optional. For property: purchase price. For EPF leave blank.')}</div>
      ${fld('Note', inp('note', h.note, 'placeholder="Optional, e.g. broker, platform"'))}`;
    const d = openSheet(isNew ? 'Add investment' : 'Edit ' + (h.name || ''), body, (v) => {
      const o = isNew ? { id: C.uid(), kind: v.kind, lots: [] } : h;
      o.name = v.name || (v.kind === 'stock' ? v.symbol : v.kind === 'crypto' ? v.coinId : v.kind === 'gold' ? 'Gold' : '') || kindOf(v.kind)[2];
      o.note = v.note;
      if (v.kind === 'stock') { o.symbol = (v.symbol || '').toUpperCase(); if (!o.symbol && !num(v.mprice)) { toast('Add a ticker symbol, or type a price'); return false; } }
      if (v.kind === 'crypto') { o.coinId = v.coinId; if (!o.coinId) { toast('Use Find to pick the coin'); return false; } }
      if (v.kind === 'gold') o.unit = v.unit;
      if (v.kind === 'fund') { if (v.navName) { o.navName = v.navName; o.navMgr = v.navMgr; delete o.navOff; } o.price = num(v.price) || undefined; o.priceCur = 'MYR'; o.priceAt = new Date().toISOString(); o.priceSrc = 'typed by you'; }
      if (v.kind === 'stock' && num(v.mprice)) { o.price = num(v.mprice); o.priceCur = v.mcur; o.priceAt = new Date().toISOString(); o.priceSrc = 'typed by you'; }
      if (v.kind === 'fd') Object.assign(o, { principal: C.r2(num(v.principal)), rate: num(v.rate), start: v.start, maturity: v.maturity });
      if (['epf', 'property', 'other'].includes(v.kind)) Object.assign(o, { value: C.r2(num(v.value)), valueAt: v.valueAt, cost: C.r2(num(v.cost)), growth: v.kind !== 'epf' && v.growth !== '' && v.growth != null ? num(v.growth) : undefined });
      if (v.kind === 'property' && v.isOff) {
        if (!(num(v.offPrice) > 0)) { toast('Enter the SPA price'); return false; }
        o.offplan = Object.assign(o.offplan || { stages: C.SCHEDULE_H.map(([l, pct]) => ({ l, pct })) }, { price: C.r2(num(v.offPrice)), rebate: C.r2(num(v.offRebate)), spaDate: v.offSpa, vpDue: v.offVp || undefined, done: false });
        const net = C.r2(num(v.offPrice) - num(v.offRebate));
        if (!(num(v.value) > 0)) { o.value = net; o.valueAt = v.offVp || v.offSpa; }
        if (!(num(v.cost) > 0)) o.cost = net;
      } else if (v.kind === 'property' && o.offplan && !o.offplan.done) delete o.offplan;
      if (v.kind === 'property') Object.assign(o, { project: v.project || undefined, builtUp: num(v.builtUp) || undefined, ptype: v.ptype || undefined });
      if (isNew && ['stock', 'crypto', 'gold', 'fund'].includes(v.kind)) {
        if (!(num(v.units) > 0)) { toast('Enter how many units'); return false; }
        o.lots.push({ id: C.uid(), type: 'buy', date: v.date || C.today(), units: num(v.units), amount: C.r2(num(v.capital)) });
      }
      if (isNew) state.holdings.push(o);
      save(); render();
      if ((isNew && C.LIVE_KINDS.includes(o.kind)) || (o.kind === 'fund' && o.navName)) refreshPrices(true);
    });
    d.querySelector('.sheet').dataset.kind = h.kind;
    return d;
  }
  function holdingDetail(h) {
    const v = C.holdingValue(h, state.fx), live = ['stock', 'crypto', 'gold', 'fund'].includes(h.kind);
    const lots = (h.lots || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    openSheet(h.name, `
      <div class="stats3"><div><small>Capital</small><b>${rm(v.cost)}</b></div><div><small>Worth today</small><b>${rm(v.value)}</b></div><div><small>Gain / loss</small><b class="${plc(v.pl)}">${rm(v.pl)}</b><small class="${plc(v.pl)}">${v.cost ? pct(v.pl / v.cost) : ''}</small></div></div>
      ${live ? `<p class="small muted">${fmtU(v.units)} ${h.kind === 'gold' ? (h.unit === 'oz' ? 'oz' : 'g') : 'units'}${h.price ? ' × ' + (h.priceCur || 'MYR') + ' ' + fmtN(h.price, 4) + (h.priceCur && h.priceCur !== 'MYR' ? ' (converted to RM at today’s rate)' : '') : ''}. Price from ${esc(h.priceSrc || '—')}, ${ago(h.priceAt)}.${v.realized ? ' Realised gain from sales: ' + rm(v.realized) + '.' : ''}${v.income ? ' Dividends received: ' + rm(v.income) + '.' : ''}</p>
        <div class="btnrow"><button type="button" class="btn" data-act="lot" data-id="${h.id}" data-t="buy">＋ Buy more</button><button type="button" class="btn" data-act="lot" data-id="${h.id}" data-t="sell">Sell</button><button type="button" class="btn" data-act="lot" data-id="${h.id}" data-t="div">Dividend</button></div>
        <h4>History</h4>${lots.map((l) => `<div class="row"><span class="grow">${({ buy: 'Bought', sell: 'Sold', div: 'Dividend' })[l.type]} ${l.type !== 'div' ? fmtU(l.units) + ' units' : ''}<small>${dmy(l.date)}</small></span><b>${rm(l.amount)}</b><button type="button" class="icon small" data-act="delLot" data-id="${h.id}" data-lot="${l.id}">✕</button></div>`).join('')}` : ''}
      ${h.kind === 'fd' ? `<p class="small muted">${rm(h.principal)} at ${h.rate}% from ${dmy(h.start)} to ${dmy(h.maturity)}. Interest so far is counted day by day.${v.matured ? ' <b>Matured</b> — renew or move it, then update here.' : ''}</p>` : ''}
      ${['epf', 'property', 'other'].includes(h.kind) && !(h.offplan && !h.offplan.done) ? `<p class="small muted">${h.growth ? 'Estimated from ' + rm(h.value) + ' on ' + dmy(h.valueAt) + ', moving ' + fmtN(h.growth, 1) + '% a year, day by day. Not a valuation.' : (h.mkt && h.mkt.date === h.valueAt ? 'Value from your market price check on ' : 'Value typed by you on ') + dmy(h.valueAt) + '.'} Update it when you get a new statement or valuation.</p>` : ''}
      ${h.offplan && !h.offplan.done ? offplanHTML(h) : (h.offplan && C.offplanStatus(h).toPay > 0 ? offplanHTML(h) : '') + (h.kind === 'property' ?  mktInfo(h) + '<button type="button" class="btn primary" data-act="mktCheck" data-id="' + h.id + '">📷 Check market price</button>' : '')}
      <div class="btnrow"><button type="button" class="btn" data-act="editHolding" data-id="${h.id}">✎ Edit</button><button type="button" class="btn danger" data-act="delHolding" data-id="${h.id}">Delete</button></div>`);
  }
  // ----- new launch: progress billing -----
  function offplanHTML(h) {
    const st = C.offplanStatus(h), o = h.offplan;
    const w = st.net ? Math.min(100, st.paid / st.net * 100) : 0;
    return (o.done ? '<p class="small">🔑 Keys received ' + dmy(o.vpDate) + '. Stages not yet paid are counted as owed to the developer.</p>' : '<p class="small">🏗️ <b>Under construction</b>' + (o.vpDue ? ' · keys expected ' + dmy(o.vpDue) : '') + '. Counted in your assets at what you have paid so far.</p>') +
      '<div class="liqbar"><i class="l1" style="width:' + w + '%"></i></div>' +
      '<div class="stats3"><div><small>Price after rebate</small><b>' + rm(st.net, { d: 0 }) + '</b></div><div><small>Paid (' + fmtN(st.pctPaid, 1) + '%)</small><b class="up">' + rm(st.paid, { d: 0 }) + '</b></div><div><small>Still to pay</small><b>' + rm(st.toPay, { d: 0 }) + '</b>' + (st.billedUnpaid ? '<small class="warn">' + rm(st.billedUnpaid, { d: 0 }) + ' billed</small>' : '') + '</div></div>' +
      (Math.abs(st.pctTotal - 100) > 0.01 ? '<p class="small warn">Stages add up to ' + fmtN(st.pctTotal, 1) + '%, not 100%. Edit the stages.</p>' : '') +
      '<h4>Progress billing</h4>' + st.stages.map((s) => '<div class="row"><span class="grow">' + (s.paid ? '✅ ' : s.billed ? (s.late ? '⚠️ ' : '🧾 ') : '⬜ ') + esc(s.label) + '<small>' + fmtN(s.pct, 1) + '%' + (s.paid ? ' · paid ' + dmy(s.paid) : s.billed ? ' · billed ' + dmy(s.billed) + ' · pay by ' + dmy(s.due) + (s.late ? ' — late, SPA charges interest' : '') : '') + '</small></span><b>' + rm(s.amount, { d: 0 }) + '</b>' +
        (s.paid ? '<button type="button" class="icon small" data-act="offUndo" data-id="' + h.id + '" data-i="' + s.i + '">↺</button>' : s.billed ? '<button type="button" class="btn small primary" data-act="offPay" data-id="' + h.id + '" data-i="' + s.i + '">Paid</button>' : '<button type="button" class="btn small" data-act="offBill" data-id="' + h.id + '" data-i="' + s.i + '">Billed</button>') + '</div>').join('') +
      '<small class="muted">Stages start from the standard SPA (Schedule H). Your own SPA’s Third Schedule rules — tap ✎ Stages to match it.</small>' +
      '<div class="btnrow"><button type="button" class="btn" data-act="offStages" data-id="' + h.id + '">✎ Stages</button>' + (o.done ? '' : '<button type="button" class="btn primary" data-act="offKeys" data-id="' + h.id + '">🔑 Got the keys</button>') + '</div>';
  }
  function offBill(h, i) {
    const s = h.offplan.stages[i];
    openSheet('Billed: ' + s.l, fld('Date of the developer’s notice', inp('date', C.today(), 'type="date"')) + '<p class="small muted">Under the standard SPA you have 21 working days from the notice to pay.</p>', (v) => {
      s.billed = v.date || C.today(); save(); render(); holdingDetail(h); return false;
    }, { saveText: 'Save' });
  }
  function offPay(h, i) {
    const s = h.offplan.stages[i], st = C.offplanStatus(h), amount = st.stages[i].amount;
    const accs = state.accounts.filter((a) => !a.archived).map((a) => [a.id, 'From ' + a.name]);
    openSheet('Paid: ' + s.l, '<p>' + rm(amount) + '</p>' + fld('Date paid', inp('date', C.today(), 'type="date"')) + fld('Who paid', '<select name="from">' + opt([['loan', '🏦 My housing loan (bank paid the developer)']].concat(accs), 'loan') + '</select>', 'Paid from your own account: the money moves into the property (not spending).'), (v) => {
      s.paid = v.date || C.today(); if (!s.billed) s.billed = s.paid;
      if (v.from !== 'loan') { const t = { id: C.uid(), at: new Date().toISOString(), type: 'transfer', cat: '', amount, date: s.paid, account: v.from, note: 'Progress payment: ' + s.l + ' · ' + (h.project || h.name), inv: { holding: h.id, side: 'buy', stage: i } }; state.txns.push(t); s.txn = t.id; }
      save(); render(); holdingDetail(h); toast('✓ Paid ' + rm(amount, { d: 0 })); return false;
    }, { saveText: 'Save' });
  }
  function offStages(h) {
    const rows = h.offplan.stages;
    openSheet('Payment stages', '<p class="small muted">Copy from the Third Schedule of your SPA. Percentages must add up to 100.</p>' + rows.map((s, i) => '<div class="grid2">' + inp('l_' + i, s.l) + inp('p_' + i, s.pct, 'inputmode="decimal"') + '</div>').join('') + '<div class="grid2">' + inp('l_new', '', 'placeholder="Add a stage"') + inp('p_new', '', 'inputmode="decimal" placeholder="%"') + '</div><p class="small" id="stTot"></p>', (v) => {
      const next = rows.map((s, i) => Object.assign({}, s, { l: v['l_' + i], pct: num(v['p_' + i]) })).filter((s) => s.l && s.pct > 0);
      if (v.l_new && num(v.p_new) > 0) next.push({ l: v.l_new, pct: num(v.p_new) });
      const tot = C.r2(next.reduce((a, s) => a + s.pct, 0));
      if (Math.abs(tot - 100) > 0.01 && !confirmBox('Stages add up to ' + tot + '%, not 100%. Save anyway?')) return false;
      h.offplan.stages = next; save(); render(); holdingDetail(h); return false;
    }, { saveText: 'Save stages' });
    const sh = $$('.sheetwrap').pop(), tot = () => { const f = formVals(sh); let t = 0; Object.keys(f).forEach((k) => { if (/^p_/.test(k)) t += num(f[k]); }); sh.querySelector('#stTot').innerHTML = 'Total: <b class="' + (Math.abs(t - 100) > 0.01 ? 'warn' : 'up') + '">' + fmtN(t, 1) + '%</b>'; };
    sh.addEventListener('input', tot); tot();
  }
  // ----- property: market price from screenshots of sales (Brickz) or listings (PropertyGuru) -----
  function mktInfo(h) {
    const m = h.mkt; if (!m) return '';
    return '<p class="small">Last check ' + dmy(m.date) + ': ' + (m.basis === 'sold' ? m.n + ' recent sale' + (m.n > 1 ? 's' : '') : m.n + ' asking price' + (m.n > 1 ? 's' : '') + ' (not sales)') + ' · median ' + rm(m.psf) + ' psf' + (m.low ? ' · range ' + rm(m.low, { d: 0 }) + ' – ' + rm(m.high, { d: 0 }) : '') + (m.imgs && m.imgs.length ? ' · <a href="#" data-act="mktImgs" data-id="' + h.id + '">screenshots</a>' : '') + '</p>';
  }
  let mktPhotos = [];
  function mktCheck(h) {
    mktPhotos = [];
    openSheet('📷 Market price · ' + h.name, `
      <p class="small muted">1. Open your project on <a href="https://www.brickz.my" target="_blank" rel="noopener">Brickz</a> (past sales, from government records) and screenshot the list of transactions. Listings from PropertyGuru / iProperty also work, but those are asking prices — usually higher than what really sells.<br>2. Add the screenshots here. AI reads every sale; the app works out the median price per sq ft for units like yours and × your size.</p>
      ${!h.builtUp ? fld('Your built-up (sq ft)', inp('mktSize', '', 'inputmode="decimal" id="mktSize" placeholder="e.g. 1076"')) : ''}
      <div class="btnrow"><label class="btn primary">🖼️ Add screenshots<input type="file" accept="image/*" multiple hidden data-change="mktPick"></label></div>
      <div class="thumbs" id="mktthumbs"></div>
      <button type="button" class="btn primary big" data-act="mktRead" data-id="${h.id}">✨ Read prices</button>
      ${!aiServer() ? '<p class="small warn">Needs the server link (More → Settings).</p>' : ''}`);
  }
  async function mktPick(el) {
    for (const f of el.files) { try { mktPhotos.push(await S.compress(f)); } catch (e) {} }
    el.value = '';
    $('#mktthumbs').innerHTML = mktPhotos.map((s) => '<div class="thumb"><img src="' + s + '"></div>').join('');
  }
  async function mktRead(h) {
    if (!mktPhotos.length) { toast('Add at least one screenshot'); return; }
    const size = num(($('#mktSize') || {}).value); if (size > 0) h.builtUp = size;
    const btn = $('[data-act=mktRead]'); btn.disabled = true; btn.textContent = '⏳ Reading… (up to a minute)';
    try {
      const r = await aiCall('property', { images: mktPhotos, property: { name: h.name, project: h.project, builtUp: h.builtUp, type: h.ptype } });
      mktReview(h, r, mktPhotos.slice());
    } catch (e) { toast(e.message, 5000); btn.disabled = false; btn.textContent = '✨ Read prices'; }
  }
  function mktReview(h, r, photos) {
    const fixDate = (d) => (/^\d{4}-\d\d$/.test(d || '') ? d + '-15' : /^\d{4}-\d\d-\d\d$/.test(d || '') ? d : '');
    const items = (r.items || []).filter((x) => x && (x.price || x.psf)).map((x) => ({ kind: x.kind === 'asking' ? 'asking' : 'sold', date: fixDate(x.date), price: x.price, size: x.size, psf: x.psf, type: x.type || '', floor: x.floor || '', note: x.note || '' }));
    const d = openSheet('Market price check', `
      ${r.standIn ? '<p class="warn small">TEST MODE: stand-in AI reply, not a real reading.</p>' : ''}
      <p class="small muted">${esc([r.project, r.area].filter(Boolean).join(' · '))}${r.comment ? ' — ' + esc(r.comment) : ''}</p>
      ${fld('Your built-up (sq ft)', inp('size', h.builtUp || '', 'inputmode="decimal"'))}
      <div id="mktsum" class="card inset"></div>
      <h4>What AI read (untick any that are not like your unit)</h4>
      ${items.map((x, i) => '<label class="row"><input type="checkbox" name="use_' + i + '" checked><span class="grow">' + (x.kind === 'sold' ? '✅ Sold' : '🏷️ Asking') + (x.date ? ' · ' + dmy(x.date) : '') + '<small>' + [x.size ? fmtN(x.size, 0) + ' sq ft' : '', x.type, x.floor ? 'floor ' + x.floor : '', x.note].filter(Boolean).map(esc).join(' · ') + '</small></span><span class="right"><b>' + (x.price ? rm(x.price, { d: 0 }) : '') + '</b><small>' + (x.psf || (x.price && x.size) ? rm(x.psf || x.price / x.size) + ' psf' : '') + '</small></span></label>').join('') || '<p class="muted">No prices found in the screenshots.</p>'}
      ${fld('Value to save (RM)', money('value', ''), 'Filled in from the median. Change it if you know better (e.g. renovated, corner unit).')}
      <small class="muted">An estimate from other units' prices, not a valuation. Banks and valuers may differ.</small>`, (v) => {
      if (!(num(v.value) > 0)) { toast('Enter the value to save'); return false; }
      const m = C.marketValue(items.map((x, i) => Object.assign({}, x, { use: !!v['use_' + i] })), num(v.size));
      const ids = photos.map(() => 'm_' + C.uid());
      photos.forEach((p, i) => S.putImg(ids[i], p));
      if (num(v.size) > 0) h.builtUp = num(v.size);
      if (!h.project && r.project) h.project = r.project;
      h.value = C.r2(num(v.value)); h.valueAt = C.today();
      h.mkt = { date: C.today(), basis: m.basis, n: m.n, psf: m.psf, low: m.low, high: m.high, askingPsf: m.askingPsf, imgs: ids, source: items.some((x) => x.kind === 'sold') ? 'sales screenshots' : 'listing screenshots' };
      save(); render(); toast('Saved ' + rm(h.value, { d: 0 }) + ' as at today ✓'); holdingDetail(h); return false;
    }, { saveText: 'Save value' });
    const sh = d.querySelector ? d : $$('.sheetwrap').pop();
    let touched = false;
    const calc = (e) => {
      if (e && e.target && e.target.name === 'value') { touched = true; return; }
      const f = formVals(sh), m = C.marketValue(items.map((x, i) => Object.assign({}, x, { use: !!f['use_' + i] })), num(f.size));
      const box = sh.querySelector('#mktsum');
      if (!m.basis) { box.innerHTML = '<p class="muted small">Tick at least one price.</p>'; return; }
      box.innerHTML = '<div class="stats3"><div><small>Median</small><b>' + rm(m.psf) + '</b><small>per sq ft</small></div><div><small>Your unit</small><b>' + (m.value ? rm(m.value, { d: 0 }) : '—') + '</b><small>' + (m.value ? '' : 'type your size') + '</small></div><div><small>Range</small><b>' + (m.low ? rm(m.low, { d: 0 }) : '—') + '</b><small>' + (m.high ? 'to ' + rm(m.high, { d: 0 }) : '') + '</small></div></div>' +
        '<p class="small ' + (m.basis === 'asking' ? 'warn' : 'muted') + '">' + (m.basis === 'sold' ? 'From ' + m.n + ' sale' + (m.n > 1 ? 's' : '') + ' in the last 2 years' + (num(f.size) ? ', sizes close to yours where possible' : '') + '.' + (m.askingPsf ? ' Asking prices now: ' + rm(m.askingPsf) + ' psf (not used).' : '') : 'Only asking prices — what sellers hope for, usually higher than what sells. Add Brickz sales for a truer figure.') + '</p>';
      const vi = sh.querySelector('[name=value]'); if (vi && !touched && m.value) vi.value = m.value;
    };
    sh.addEventListener('input', calc); sh.addEventListener('change', calc); calc();
  }
  function lotForm(h, type) {
    openSheet(({ buy: 'Buy more ', sell: 'Sell ', div: 'Dividend from ' })[type] + h.name, `
      ${type !== 'div' ? fld('Units', inp('units', '', 'inputmode="decimal" autofocus')) : ''}
      ${fld(type === 'buy' ? 'Total paid incl. fees (RM)' : type === 'sell' ? 'Total received after fees (RM)' : 'Dividend received (RM)', money('amount', ''))}
      ${fld('Date', inp('date', C.today(), 'type="date"'))}`, (v) => {
      const pos = C.position(h);
      if (type !== 'div' && !(num(v.units) > 0)) { toast('Enter units'); return false; }
      if (type === 'sell' && num(v.units) > pos.units + 1e-9) { toast('You only hold ' + pos.units + ' units'); return false; }
      h.lots.push({ id: C.uid(), type, date: v.date || C.today(), units: num(v.units), amount: C.r2(num(v.amount)) });
      save(); render(); holdingDetail(h);
      return false;
    });
  }

  // ----- loan form -----
  function loanForm(l) {
    const isNew = !l; l = l || { kind: 'housing', method: 'reducing', start: C.today() };
    const st = isNew ? null : C.loanStatus(l);
    openSheet(isNew ? 'Add loan' : 'Edit loan', `
      ${st ? `<div class="stats3"><div><small>Balance</small><b class="down">${rm(st.balance)}</b></div><div><small>Monthly</small><b>${rm(st.monthly)}</b></div><div><small>Left</small><b>${st.leftMonths} mo</b><small>ends ${dmy(st.endDate)}</small></div></div><p class="small muted">Still to pay in total: ${rm(st.payable)}. Total interest over the loan: ${rm(st.interestTotal)}.</p>` : ''}
      ${fld('Name', inp('name', l.name, 'placeholder="e.g. House loan RHB, Honda HR-V" autofocus'))}
      ${fld('Type', '<select name="kind" data-change="loanKind">' + opt(LOAN_KINDS.map((x) => [x[0], x[1]]), l.kind) + '</select>')}
      ${fld('Interest method', '<select name="method">' + opt([['reducing', 'Reducing balance (housing, most bank loans)'], ['flat', 'Flat rate (car hire purchase, many personal loans)']], l.method) + '</select>')}
      <div class="grid2">${fld('Amount borrowed (RM)', money('principal', l.principal))}${fld('Interest % a year', inp('rate', l.rate, 'inputmode="decimal" placeholder="e.g. 4.2"'))}
      ${fld('Tenure (years)', inp('years', l.tenureMonths ? C.r2(l.tenureMonths / 12) : '', 'inputmode="decimal" placeholder="e.g. 35"'))}${fld('First month', inp('start', l.start, 'type="date"'))}</div>
      ${fld('Actual monthly instalment (RM)', money('monthly', l.monthly), 'Optional. Put the bank’s figure if it differs from the calculation.')}
      <details ${l.balanceOverride !== undefined && l.balanceOverride !== '' ? 'open' : ''}><summary class="small muted">Use the balance from my bank statement instead</summary>
      <div class="grid2">${fld('Balance on statement (RM)', money('balanceOverride', l.balanceOverride))}${fld('Statement date', inp('balanceAt', l.balanceAt || C.today(), 'type="date"'))}</div></details>
      ${!isNew ? '<label class="row"><input type="checkbox" name="archived" ' + (l.archived ? 'checked' : '') + '><span class="grow small">Fully paid / hide</span></label><button type="button" class="btn danger" data-act="delLoan" data-id="' + l.id + '">Delete loan</button>' : ''}`,
    (v) => {
      if (!(num(v.principal) > 0) || !(num(v.years) > 0)) { toast('Enter amount and tenure'); return false; }
      const o = isNew ? { id: C.uid() } : l;
      Object.assign(o, { name: v.name || (LOAN_KINDS.find((x) => x[0] === v.kind) || [])[1], kind: v.kind, method: v.method, principal: C.r2(num(v.principal)), rate: num(v.rate), tenureMonths: Math.round(num(v.years) * 12), start: v.start, monthly: num(v.monthly) || undefined, balanceOverride: v.balanceOverride === '' ? undefined : C.r2(num(v.balanceOverride)), balanceAt: v.balanceOverride === '' ? undefined : v.balanceAt, archived: !!v.archived || undefined });
      if (isNew) state.loans.push(o);
      save(); render();
    });
  }

  // ----- owed form -----
  function owedForm(o, dir) {
    const isNew = !o; o = o || { dir: dir || 'in', date: C.today(), repaid: [] };
    const left = isNew ? 0 : C.owedLeft(o);
    openSheet(isNew ? (o.dir === 'out' ? 'I owe someone' : 'Someone owes me') : esc(o.person), `
      <div class="seg">${[['in', 'They owe me'], ['out', 'I owe them']].map(([k, l]) => `<label><input type="radio" name="dir" value="${k}" ${o.dir === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
      ${fld('Person', inp('person', o.person, 'placeholder="Name" autofocus list="peoplelist"') + '<datalist id="peoplelist">' + state.split.people.map((p) => '<option value="' + esc(p.name) + '">').join('') + '</datalist>')}
      <div class="grid2">${fld('Amount (RM)', money('amount', o.amount))}${fld('Date', inp('date', o.date, 'type="date"'))}</div>
      ${fld('Pay back by', inp('due', o.due, 'type="date"'), 'Optional — Home reminds you when it is late.')}
      ${fld('Note', inp('note', o.note, 'placeholder="What for?"'))}
      <details class="card inset" ${o.plan ? 'open' : ''}><summary><b>📅 Pays back monthly</b> <small class="muted">optional</small></summary>
        <div class="grid2">${fld('Each month (RM)', money('planAmt', o.plan ? o.plan.amount : ''))}${fld('First payment', inp('planStart', o.plan ? o.plan.start : C.addMonths(o.date || C.today(), 1), 'type="date"'))}</div>
        <label class="row"><input type="checkbox" name="planAuto" ${!o.plan || o.plan.auto ? 'checked' : ''}><span class="grow small">Reduce by itself on each payment date<br><span class="muted">Untick to tap “✓ Got it” on Home each month instead.</span></span></label>
        <p class="small" id="planPrev"></p>
        ${o.plan ? '<label class="row"><input type="checkbox" name="planStop"><span class="grow small">Stop this plan</span></label>' : ''}</details>
      ${!isNew ? `<h4>Paid back so far</h4>${(o.repaid || []).map((r, i) => `<div class="row"><span class="grow">${dmy(r.date)}</span><b>${rm(r.amount)}</b><button type="button" class="icon small" data-act="delRepay" data-id="${o.id}" data-i="${i}">✕</button></div>`).join('') || '<p class="muted small">Nothing yet.</p>'}
        <p>Still owing: <b>${rm(left)}</b></p>
        <div class="grid2">${fld('Repayment (RM)', money('repay', ''))}${fld('Date', inp('repayDate', C.today(), 'type="date"'))}</div>
        <button type="button" class="btn danger" data-act="delOwed" data-id="${o.id}">Delete</button>` : ''}`,
    (v) => {
      if (!v.person || !(num(v.amount) > 0)) { toast('Enter a name and amount'); return false; }
      const x = isNew ? { id: C.uid(), repaid: [] } : o;
      Object.assign(x, { dir: v.dir, person: v.person, amount: C.r2(num(v.amount)), date: v.date, due: v.due || undefined, note: v.note });
      if (v.planStop) delete x.plan;
      else if (num(v.planAmt) > 0 && v.planStart) {
        const old = x.plan || {};
        x.plan = { amount: C.r2(num(v.planAmt)), start: v.planStart, auto: !!v.planAuto, posted: old.start === v.planStart ? old.posted : undefined };
      }
      if (num(v.repay) > 0) x.repaid.push({ date: v.repayDate || C.today(), amount: C.r2(num(v.repay)) });
      if (isNew) state.owed.push(x);
      const made = C.postOwedPlans(state);
      save(); render();
      if (made.length) toast('📅 Counted ' + made.length + ' monthly repayment' + (made.length > 1 ? 's' : '') + ' already due', 3500);
    });
    const sh = $$('.sheetwrap').pop();
    const prev = () => {
      const f = formVals(sh), amt = num(f.amount) - (o.repaid || []).reduce((a, r) => a + num(r.amount), 0), pm = num(f.planAmt), out = sh.querySelector('#planPrev');
      if (!out) return;
      if (!(pm > 0) || !(amt > 0) || !f.planStart) { out.textContent = ''; return; }
      const n = Math.ceil(C.r2(amt / pm) - 1e-9);
      out.innerHTML = 'Owing ' + rm(amt) + ' ÷ ' + rm(pm) + ' a month = <b>' + n + ' payment' + (n > 1 ? 's' : '') + '</b>, last one about <b>' + dmy(C.addMonths(f.planStart, n - 1)) + '</b>' + (n > 1 && C.r2(amt - (n - 1) * pm) !== pm ? ' (last payment ' + rm(C.r2(amt - (n - 1) * pm)) + ')' : '') + '.';
    };
    if (sh) { sh.addEventListener('input', prev); sh.addEventListener('change', prev); prev(); }
  }

  // ----- policy form -----
  function policyForm(p) {
    const isNew = !p; p = p || { insured: 'Me', mode: 'M', type: 'life', status: 'active', cover: {}, relief: 'life' };
    const insuredNames = [...new Set(['Me'].concat(state.policies.map((x) => x.insured).filter(Boolean)))];
    openSheet(isNew ? 'Add policy' : 'Edit policy', `
      ${fld('Who is insured', inp('insured', p.insured, 'list="insuredlist"') + '<datalist id="insuredlist">' + insuredNames.map((n) => '<option value="' + esc(n) + '">').join('') + '</datalist>', 'Use the same name for the same person, e.g. Me, Wife, Daughter, Dad.')}
      <div class="grid2">${fld('Insurer', inp('insurer', p.insurer, 'placeholder="e.g. Great Eastern"'))}${fld('Plan name', inp('plan', p.plan, 'placeholder="As on the policy"'))}</div>
      <div class="grid2">${fld('Type', '<select name="type">' + opt(POL_TYPES, p.type) + '</select>')}${fld('Status', '<select name="status">' + opt([['active', 'In force'], ['lapsed', 'Lapsed'], ['ended', 'Matured / ended']], p.status) + '</select>')}</div>
      <div class="grid2">${fld('Premium (RM)', money('premium', p.premium))}${fld('Paid', '<select name="mode">' + opt([['M', 'Monthly'], ['Q', 'Quarterly'], ['H', 'Half-yearly'], ['Y', 'Yearly']], p.mode) + '</select>')}
      ${fld('Start date', inp('start', p.start, 'type="date"'))}${fld('Policy no. (last 4 digits)', inp('ref', p.ref, 'maxlength="6" placeholder="optional"'))}</div>
      <h4>Cover (RM) — type from your policy schedule</h4>
      <div class="grid2">${C.COVERS.map(([k, l]) => fld(l, money('cv_' + k, (p.cover || {})[k]))).join('')}</div>
      ${fld('Cash / fund value now (RM)', money('cashValue', p.cashValue), 'Optional. Counted in your assets (e.g. ILP fund value, surrender value).')}
      <div class="grid2">${fld('Tax relief type', '<select name="relief">' + opt([['', 'None'], ['life', 'Life insurance / takaful'], ['medins', 'Education & medical insurance']], p.relief || '') + '</select>')}${fld('Relief amount a year (RM)', money('reliefAmount', p.reliefAmount), 'Blank = whole yearly premium. Use the insurer’s premium statement figure if split.')}</div>
      ${fld('Note', inp('note', p.note, 'placeholder="Riders, agent, claims notes"'))}
      ${!isNew ? '<button type="button" class="btn danger" data-act="delPolicy" data-id="' + p.id + '">Delete policy</button>' : ''}`,
    (v) => {
      const o = isNew ? { id: C.uid() } : p;
      const cover = {}; C.COVERS.forEach(([k]) => { const x = num(v['cv_' + k]); if (x) cover[k] = x; });
      Object.assign(o, { insured: v.insured || 'Me', insurer: v.insurer, plan: v.plan, type: v.type, status: v.status, premium: C.r2(num(v.premium)), mode: v.mode, start: v.start, ref: v.ref, cover, cashValue: num(v.cashValue) || undefined, relief: v.relief || undefined, reliefAmount: num(v.reliefAmount) || undefined, note: v.note });
      if (isNew) state.policies.push(o);
      save(); render();
    });
  }

  // ----- split forms -----
  function groupForm(g) {
    const isNew = !g; g = g || { name: '', date: C.today(), members: ['me'], expenses: [], settlements: [] };
    const known = state.split.people.slice().sort((a, b) => a.name.localeCompare(b.name));
    openSheet(isNew ? 'New outing' : 'Edit outing', `
      ${fld('Name', inp('name', g.name, 'placeholder="e.g. Friday steamboat, Bangkok trip" autofocus'))}
      ${fld('Date', inp('date', g.date, 'type="date"'))}
      <div class="fld">Who’s in?<div class="chips"><label class="chip on">Me</label>${known.map((p) => `<label class="chip"><input type="checkbox" name="members" data-multi="1" value="${p.id}" ${g.members.includes(p.id) ? 'checked' : ''}>${esc(p.name)}</label>`).join('')}</div></div>
      ${fld('Add new friends', inp('newPeople', '', 'placeholder="Names, separated by commas: Ali, Mei, Raj"'))}
      ${!isNew ? '<button type="button" class="btn danger" data-act="delGroup" data-id="' + g.id + '">Delete outing</button>' : ''}`,
    (v) => {
      const ids = (v.members || []).slice();
      (v.newPeople || '').split(',').map((x) => x.trim()).filter(Boolean).forEach((name) => {
        let p = state.split.people.find((x) => x.name.toLowerCase() === name.toLowerCase());
        if (!p) { p = { id: C.uid(), name }; state.split.people.push(p); }
        if (!ids.includes(p.id)) ids.push(p.id);
      });
      // keep anyone who already has bills in this outing
      const used = new Set(); (g.expenses || []).forEach((e) => { Object.keys(e.paid || {}).forEach((p) => used.add(p)); Object.keys(e.vals || {}).forEach((p) => num(e.vals[p]) && used.add(p)); (e.who || []).forEach((p) => used.add(p)); (e.items || []).forEach((it) => (it.who || []).forEach((p) => used.add(p))); });
      used.forEach((p) => { if (p !== 'me' && !ids.includes(p)) ids.push(p); });
      if (!ids.length) { toast('Add at least one friend'); return false; }
      const o = isNew ? { id: C.uid(), expenses: [], settlements: [] } : g;
      Object.assign(o, { name: v.name || 'Outing', date: v.date, members: ['me'].concat(ids.filter((x) => x !== 'me')) });
      if (isNew) { state.split.groups.push(o); save(); go('group/' + o.id); } else { save(); render(); }
    });
  }

  let draft = null, draftG = null;
  function expForm(g, e) {
    const isNew = !e;
    draftG = g;
    draft = JSON.parse(JSON.stringify(e || { id: C.uid(), title: '', date: C.today(), total: '', mode: 'equal', who: g.members.slice(), vals: {}, items: [{ name: '', amount: '', who: [] }], sc: 10, tax: 6, receiptTotal: '', paid: { me: '' } }));
    draft._payMode = Object.keys(draft.paid || {}).length > 1 ? 'many' : 'one';
    draft._payer = Object.keys(draft.paid || {})[0] || 'me';
    const d = openSheet(isNew ? 'Add bill' : 'Edit bill', '<div id="expbody"></div>', () => {
      const x = buildExp();
      const r = C.splitShares(x, g.members);
      if (!r.totalC) { toast('Enter the bill amount'); return false; }
      if (r.error) { toast(r.error); return false; }
      const i = g.expenses.findIndex((y) => y.id === x.id);
      if (i >= 0) g.expenses[i] = x; else g.expenses.push(x);
      save(); render();
    });
    drawExp();
    d.addEventListener('input', (ev) => {
      const el = ev.target; if (!el.dataset.path) return;
      setPath(draft, el.dataset.path, el.value);
      if (el.dataset.path === 'total' && draft._payMode === 'one') {} // payer amount follows total
      drawPreview();
    });
    return d;
  }
  function setPath(o, path, v) { const ks = path.split('.'); let x = o; for (let i = 0; i < ks.length - 1; i++) { if (x[ks[i]] == null) x[ks[i]] = /^\d+$/.test(ks[i + 1]) ? [] : {}; x = x[ks[i]]; } x[ks[ks.length - 1]] = v; }
  function buildExp() {
    const x = JSON.parse(JSON.stringify(draft));
    const total = C.expenseTotalC(x) / 100;
    if (x.mode === 'items') x.total = total;
    x.total = C.r2(num(x.total));
    if (x._payMode === 'one') x.paid = { [x._payer]: x.total };
    else { const p = {}; Object.keys(x.paid || {}).forEach((k) => { if (num(x.paid[k])) p[k] = C.r2(num(x.paid[k])); }); x.paid = p; }
    if (x.mode !== 'items') delete x.items;
    if (x.mode !== 'equal') delete x.who;
    if (!['exact', 'shares', 'percent'].includes(x.mode)) delete x.vals;
    delete x._payMode; delete x._payer;
    if (!x.title) x.title = 'Bill';
    return x;
  }
  function drawExp() {
    const box = $('#expbody'); if (!box) return;
    const g = draftG, m = g.members, x = draft;
    const tick = (path, list, p) => `<label class="chip ${list.includes(p) ? 'on' : ''}"><input type="checkbox" data-act="tick" data-path="${path}" data-p="${p}" ${list.includes(p) ? 'checked' : ''}>${esc(pname(p))}</label>`;
    box.innerHTML = `
      ${fld('What for', `<input data-path="title" value="${esc(x.title)}" placeholder="e.g. Dinner at Gurney, Grab, Hotel">`)}
      <div class="grid2">${fld('Date', `<input type="date" data-path="date" value="${esc(x.date)}">`)}${x.mode !== 'items' ? fld('Amount (RM)', `<input inputmode="decimal" data-path="total" value="${esc(x.total)}" placeholder="0.00">`) : '<div></div>'}</div>
      <div class="fld">Paid by<div class="seg small">${[['one', 'One person'], ['many', 'Several people']].map(([k, l]) => `<label><input type="radio" name="_pm" ${x._payMode === k ? 'checked' : ''} data-act="payMode" data-v="${k}"><span>${l}</span></label>`).join('')}</div>
        ${x._payMode === 'one' ? '<div class="chips">' + m.map((p) => `<label class="chip ${x._payer === p ? 'on' : ''}"><input type="radio" name="_payer" data-act="payer" data-p="${p}" ${x._payer === p ? 'checked' : ''}>${esc(pname(p))}</label>`).join('') + '</div>'
        : m.map((p) => `<div class="row"><span class="grow">${esc(pname(p))}</span><input class="mini wide" inputmode="decimal" data-path="paid.${p}" value="${esc((x.paid || {})[p] || '')}" placeholder="0.00"></div>`).join('')}</div>
      <div class="fld">Split<div class="seg small">${[['equal', 'Equally'], ['exact', 'Exact RM'], ['shares', 'Shares'], ['percent', '%'], ['items', 'By items']].map(([k, l]) => `<label><input type="radio" name="_mode" ${x.mode === k ? 'checked' : ''} data-act="splitMode" data-v="${k}"><span>${l}</span></label>`).join('')}</div></div>
      ${x.mode === 'equal' ? '<div class="chips">' + m.map((p) => tick('who', x.who || [], p)).join('') + '</div>' : ''}
      ${['exact', 'shares', 'percent'].includes(x.mode) ? m.map((p) => `<div class="row"><span class="grow">${esc(pname(p))}</span><input class="mini wide" inputmode="decimal" data-path="vals.${p}" value="${esc((x.vals || {})[p] || '')}" placeholder="${x.mode === 'shares' ? '1' : x.mode === 'percent' ? '%' : '0.00'}"></div>`).join('') : ''}
      ${x.mode === 'items' ? `<p class="small muted">Type each item from the receipt and tick who had it. Shared items split equally among those ticked. Service charge and SST are shared in proportion.</p>
        ${x.items.map((it, i) => `<div class="item"><div class="itemrow"><input data-path="items.${i}.name" value="${esc(it.name)}" placeholder="Item ${i + 1}"><input class="mini wide" inputmode="decimal" data-path="items.${i}.amount" value="${esc(it.amount)}" placeholder="RM"><button type="button" class="icon small" data-act="rmItem" data-i="${i}">✕</button></div>
          <div class="chips">${m.map((p) => tick('items.' + i + '.who', it.who || [], p)).join('')}<button type="button" class="chip" data-act="itemAll" data-i="${i}">All</button></div></div>`).join('')}
        <button type="button" class="btn small" data-act="addItem">＋ Item</button>
        <div class="grid2">${fld('Service charge %', `<input inputmode="decimal" data-path="sc" value="${esc(x.sc)}">`)}${fld('SST / tax %', `<input inputmode="decimal" data-path="tax" value="${esc(x.tax)}">`)}</div>
        ${fld('Receipt grand total (RM)', `<input inputmode="decimal" data-path="receiptTotal" value="${esc(x.receiptTotal)}" placeholder="optional — makes it match the receipt to the sen">`, 'If the receipt has rounding or a discount, type its final total here.')}` : ''}
      <div id="exppreview" class="preview"></div>
      ${g.expenses.some((y) => y.id === x.id) ? '<button type="button" class="btn danger" data-act="delExp" data-id="' + x.id + '">Delete bill</button>' : ''}`;
    drawPreview();
  }
  function drawPreview() {
    const box = $('#exppreview'); if (!box) return;
    const x = buildExp(), r = C.splitShares(x, draftG.members);
    box.innerHTML = `<div class="h3row"><b>Each person pays</b><b>Total ${rm(r.totalC / 100, { show: true })}</b></div>` +
      draftG.members.map((p) => `<div class="row"><span class="grow">${esc(pname(p))}</span><b>${rm(r.owe[p] / 100, { show: true })}</b></div>`).join('') +
      (r.error ? `<p class="warn small">⚠️ ${esc(r.error)}</p>` : '');
  }

  // ---------- actions ----------
  const ACT = {
    closeSheet: () => closeSheet(),
    codeShow: (el) => { const i = $('#aicodeIn'); if (!i) return; const show = i.type === 'password'; i.type = show ? 'text' : 'password'; el.textContent = show ? '🙈 Hide' : '👁️ Show'; },
    codeTest: async () => {
      const out = $('#codeRes'); const code = (state.settings.aiCode || '').trim();
      if (!code) { out.innerHTML = '<span class="warn">No code typed yet.</span>'; return; }
      out.textContent = '⏳ Checking with the server…';
      try {
        const r = await fetch(aiServer() + '/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task: 'ping', code }) });
        const j = await r.json().catch(() => ({}));
        out.innerHTML = r.ok ? '<span class="up">✓ Code accepted — voice, receipt and statement AI will work.</span>' : '<span class="warn">✗ ' + esc(j.error || 'Server error ' + r.status) + ' (' + code.length + ' characters typed)</span>';
      } catch (e) { out.innerHTML = '<span class="warn">✗ Could not reach the server: ' + esc(e.message) + '</span>'; }
    },
    startFresh: () => { state = S.blank(); save(true); go('home'); render(); },
    startSample: () => { state = sampleData(); save(true); go('home'); render(); toast('Sample data loaded. Erase it in Settings when you are ready to start.', 4000); },
    toggleHide: () => { state.settings.hide = !state.settings.hide; save(); render(); },
    refreshPrices: () => refreshPrices(),
    quickAdd: () => openSheet('Add', `<div class="quick">
      <button type="button" class="ai" data-act="aiVoice">🎙️<span>Say it</span></button><button type="button" class="ai" data-act="aiReceipt">📷<span>Scan receipt</span></button>
      <button type="button" class="ai" data-act="aiInvest">📊<span>Scan statement</span></button><button type="button" data-act="balanceCheck">⚖️<span>Balance check</span></button>
      <button type="button" data-act="addTxn" data-type="expense">💸<span>Spending</span></button><button type="button" data-act="addTxn" data-type="income">💰<span>Income</span></button>
      <button type="button" data-act="addTxn" data-type="expense" data-relief="lifestyle">🧾<span>Tax receipt</span></button><button type="button" data-act="addGroup">🍻<span>Split a bill</span></button>
      <button type="button" data-act="addHolding">📈<span>Investment</span></button><button type="button" data-act="addOwed" data-dir="in">🤝<span>Someone owes me</span></button>
      <button type="button" data-act="addLoan">🏦<span>Loan</span></button><button type="button" data-act="addPolicy">🛡️<span>Insurance</span></button></div>`),
    addTxn: (ds) => { const d = txnForm(); if (ds.type) { const r = d.querySelector('input[name=type][value=' + ds.type + ']'); r.checked = true; txnTypeUI(d, ds.type); } if (ds.relief) { d.querySelector('[name=relief]').value = ds.relief; const h = d.querySelector('input[name=catE][value=shopping]'); if (h) h.checked = true; } },
    editTxn: (ds) => { const t = state.txns.find((x) => x.id === ds.id); const h = t && t.inv && state.holdings.find((x) => x.id === t.inv.holding); if (h && (!t.inv.lot || (h.lots || []).some((l) => l.id === t.inv.lot))) holdingDetail(h); else txnForm(t); },
    delTxn: (ds) => { if (!confirmBox('Delete this record?')) return; const t = state.txns.find((x) => x.id === ds.id); (t.receipts || []).forEach((id) => S.delImg(id)); state.txns = state.txns.filter((x) => x.id !== ds.id); save(); closeSheet(); render(); },
    rmReceipt: (ds) => { draftReceipts = draftReceipts.filter((x) => x !== ds.id); drawThumbs(); },
    viewImg: async (ds) => { const src = await S.getImg(ds.id); const w = document.createElement('div'); w.className = 'viewer'; w.innerHTML = '<img src="' + src + '"><button class="icon">✕</button>'; w.onclick = () => w.remove(); document.body.appendChild(w); },
    recMonth: (ds) => { recMonth = C.addMonths(recMonth + '-01', Number(ds.d)).slice(0, 7); render(); },
    recFilter: (ds) => { recFilter = ds.f; render(); },
    addAccount: () => accountForm(),
    editAccount: (ds) => accountForm(state.accounts.find((a) => a.id === ds.id)),
    delAccount: (ds) => { if (state.txns.some((t) => t.account === ds.id || t.toAccount === ds.id)) { toast('This account has records. Tick “Closed / hide” instead.', 3500); return; } if (!confirmBox('Delete this account?')) return; state.accounts = state.accounts.filter((a) => a.id !== ds.id); save(); closeSheet(); render(); },
    addHolding: () => holdingForm(),
    openHolding: (ds) => holdingDetail(state.holdings.find((h) => h.id === ds.id)),
    editHolding: (ds) => holdingForm(state.holdings.find((h) => h.id === ds.id)),
    delHolding: (ds) => { if (!confirmBox('Delete this investment and its history?')) return; state.holdings = state.holdings.filter((h) => h.id !== ds.id); save(); closeSheet(); render(); },
    lot: (ds) => lotForm(state.holdings.find((h) => h.id === ds.id), ds.t),
    delLot: (ds) => { const h = state.holdings.find((x) => x.id === ds.id); const linked = state.txns.some((t) => t.inv && t.inv.lot === ds.lot); if (!confirmBox(linked ? 'Remove this entry and its money record? The account balance goes back.' : 'Remove this entry?')) return; h.lots = h.lots.filter((l) => l.id !== ds.lot); state.txns = state.txns.filter((t) => !(t.inv && t.inv.lot === ds.lot)); save(); render(); holdingDetail(h); },
    symSearch: () => symSearch(),
    offBill: (ds) => offBill(state.holdings.find((x) => x.id === ds.id), Number(ds.i)),
    offPay: (ds) => offPay(state.holdings.find((x) => x.id === ds.id), Number(ds.i)),
    offStages: (ds) => offStages(state.holdings.find((x) => x.id === ds.id)),
    offUndo: (ds) => { const h = state.holdings.find((x) => x.id === ds.id), s = h.offplan.stages[Number(ds.i)]; if (!confirmBox('Mark “' + s.l + '” as not paid?' + (s.txn ? ' Its money record is removed too.' : ''))) return; if (s.txn) state.txns = state.txns.filter((t) => t.id !== s.txn); delete s.paid; delete s.txn; save(); render(); holdingDetail(h); },
    offKeys: (ds) => { const h = state.holdings.find((x) => x.id === ds.id), st = C.offplanStatus(h); if (!confirmBox('Got the keys? The property is then valued at ' + rm(st.net, { d: 0 }) + ' from today, and you can check its market price. Remaining stages stay on record.')) return; Object.assign(h.offplan, { done: true, vpDate: C.today() }); h.value = st.net; h.valueAt = C.today(); if (!h.cost) h.cost = st.net; save(); render(); holdingDetail(h); toast('🔑 Congratulations on your new home!', 3500); },
    mktCheck: (ds) => mktCheck(state.holdings.find((x) => x.id === ds.id)),
    mktRead: (ds) => mktRead(state.holdings.find((x) => x.id === ds.id)),
    mktImgs: async (ds) => { const h = state.holdings.find((x) => x.id === ds.id); const imgs = []; for (const id of (h.mkt && h.mkt.imgs) || []) { const s = await S.getImg(id); if (s) imgs.push(s); } if (!imgs.length) { toast('Screenshots not found on this phone'); return; } openSheet('Screenshots · ' + h.name, imgs.map((s) => '<img src="' + s + '" style="width:100%;border-radius:10px;margin-bottom:8px">').join('')); },
    fundSearch: async () => {
      const q = ($('#fundq') || {}).value, box = $('#fundres'); if (!q) return;
      box.innerHTML = '<p class="small muted">Searching today’s fund prices…</p>';
      try {
        const r = await PR.searchFund(q, state.settings);
        box.innerHTML = r.map((f) => `<button type="button" class="row" data-act="pickFund" data-n="${esc(f.name)}" data-m="${esc(f.manager)}" data-p="${f.nav == null ? '' : f.nav}"><span class="grow">${esc(f.name)}<small>${esc(f.manager)}</small></span><b>${f.nav == null ? 'no price' : fmtN(f.nav, 4)}</b></button>`).join('') || '<p class="small muted">Not found. Try fewer words, e.g. “Ittikal”.</p>';
      } catch (e) { box.innerHTML = '<p class="small warn">' + esc(e.message) + '</p>'; }
    },
    pickFund: (ds) => {
      const f = $('.sheet'), set = (n, val) => { const el = f.querySelector('[name=' + n + ']'); if (el) el.value = val; };
      set('navName', ds.n); set('navMgr', ds.m); if (ds.p) set('price', ds.p);
      const nm = f.querySelector('[name=name]'); if (nm && !nm.value) nm.value = ds.n.replace(/\b\w+/g, (w) => w[0] + w.slice(1).toLowerCase());
      $('#fundres').innerHTML = '<p class="small up">✓ ' + esc(ds.n) + ' · ' + esc(ds.m) + (ds.p ? ' · NAV ' + fmtN(Number(ds.p), 4) : '') + '</p>';
    },
    pickSym: (ds) => { const f = $('.sheet'); if (ds.coin) { f.querySelector('[name=coinId]').value = ds.coin; } else { f.querySelector('[name=symbol]').value = ds.sym; } if (!f.querySelector('[name=name]').value) f.querySelector('[name=name]').value = ds.name; $('#symres').innerHTML = '<p class="small up">✓ ' + esc(ds.name) + ' (' + esc(ds.sym || ds.coin) + ')</p>'; },
    addLoan: () => loanForm(),
    editLoan: (ds) => loanForm(state.loans.find((l) => l.id === ds.id)),
    delLoan: (ds) => { if (!confirmBox('Delete this loan?')) return; state.loans = state.loans.filter((l) => l.id !== ds.id); save(); closeSheet(); render(); },
    addOwed: (ds) => owedForm(null, ds.dir),
    editOwed: (ds) => owedForm(state.owed.find((o) => o.id === ds.id)),
    delOwed: (ds) => { if (!confirmBox('Delete this record?')) return; state.owed = state.owed.filter((o) => o.id !== ds.id); save(); closeSheet(); render(); },
    owedGot: (ds) => { const o = state.owed.find((x) => x.id === ds.id); const d = C.owedPlanDue(o)[0]; if (!d) return; const amount = C.r2(Math.min(num(o.plan.amount), C.owedLeft(o))); o.repaid.push({ date: d, amount, plan: true }); o.plan.posted = d; save(); render(); toast('✓ ' + rm(amount) + ' from ' + o.person + ' · ' + (C.owedLeft(o) > 0 ? rm(C.owedLeft(o)) + ' left' : 'all paid 🎉')); },
    owedMiss: (ds) => { const o = state.owed.find((x) => x.id === ds.id); const d = C.owedPlanDue(o)[0]; if (!d) return; o.plan.posted = d; save(); render(); toast('Marked as missed — the plan runs one month longer'); },
    delRepay: (ds) => { const o = state.owed.find((x) => x.id === ds.id); o.repaid.splice(Number(ds.i), 1); save(); render(); owedForm(o); },
    addPolicy: () => policyForm(),
    editPolicy: (ds) => policyForm(state.policies.find((p) => p.id === ds.id)),
    delPolicy: (ds) => { if (!confirmBox('Delete this policy?')) return; state.policies = state.policies.filter((p) => p.id !== ds.id); save(); closeSheet(); render(); },
    addGroup: () => groupForm(),
    editGroup: (ds) => groupForm(state.split.groups.find((g) => g.id === ds.id)),
    delGroup: (ds) => { if (!confirmBox('Delete this outing and all its bills?')) return; state.split.groups = state.split.groups.filter((g) => g.id !== ds.id); save(); closeSheet(); go('split'); },
    addExp: (ds) => expForm(state.split.groups.find((g) => g.id === ds.g)),
    editExp: (ds) => { const g = state.split.groups.find((x) => x.id === ds.g); expForm(g, g.expenses.find((e) => e.id === ds.id)); },
    delExp: (ds) => { if (!confirmBox('Delete this bill?')) return; draftG.expenses = draftG.expenses.filter((e) => e.id !== ds.id); save(); closeSheet(); render(); },
    payMode: (ds) => { draft._payMode = ds.v; if (ds.v === 'many' && !Object.keys(draft.paid || {}).some((k) => num(draft.paid[k]))) draft.paid = { [draft._payer]: draft.mode === 'items' ? '' : draft.total }; drawExp(); },
    payer: (ds) => { draft._payer = ds.p; drawExp(); },
    splitMode: (ds) => { draft.mode = ds.v; if (ds.v === 'shares' && !Object.keys(draft.vals || {}).length) { draft.vals = {}; draftG.members.forEach((p) => (draft.vals[p] = 1)); } drawExp(); },
    tick: (ds, el) => { const ks = ds.path.split('.'); let o = draft; ks.slice(0, -1).forEach((k) => (o = o[k])); const k = ks[ks.length - 1]; const list = o[k] || (o[k] = []); const i = list.indexOf(ds.p); if (el.checked && i < 0) list.push(ds.p); if (!el.checked && i >= 0) list.splice(i, 1); drawExp(); },
    itemAll: (ds) => { const it = draft.items[Number(ds.i)]; it.who = it.who.length === draftG.members.length ? [] : draftG.members.slice(); drawExp(); },
    addItem: () => { draft.items.push({ name: '', amount: '', who: [] }); drawExp(); const ins = $$('#expbody .item input[data-path$=".name"]'); if (ins.length) ins[ins.length - 1].focus(); },
    rmItem: (ds) => { draft.items.splice(Number(ds.i), 1); if (!draft.items.length) draft.items.push({ name: '', amount: '', who: [] }); drawExp(); },
    settle: (ds) => { const g = state.split.groups.find((x) => x.id === ds.g); const amt = Number(ds.c) / 100; if (!confirmBox(pname(ds.from) + ' paid ' + pname(ds.to) + ' RM ' + fmtN(amt) + '?')) return; (g.settlements = g.settlements || []).push({ from: ds.from, to: ds.to, amount: amt, date: C.today() }); save(); render(); },
    delSettle: (ds) => { const g = state.split.groups.find((x) => x.id === ds.g); if (!confirmBox('Remove this payment?')) return; g.settlements.splice(Number(ds.i), 1); save(); render(); },
    copySplit: (ds) => copySplit(state.split.groups.find((g) => g.id === ds.id)),
    shareToRecords: (ds) => shareToRecords(state.split.groups.find((g) => g.id === ds.id)),
    taxYear: (ds) => { taxYear += Number(ds.d); render(); },
    reliefItems: (ds) => {
      const r = C.taxSummary(state, taxYear).rows.find((x) => x.id === ds.id);
      openSheet(r.name, `<p class="small muted">Limit ${rm(r.limit, { show: true })} for YA ${taxYear}.</p>` + (r.items.map((t) => t.policy ? `<div class="row"><span class="ic">🛡️</span><span class="grow">${esc(t.note)}<small>From Insurance</small></span><b>${rm(t.amount)}</b></div>` : `<button type="button" class="row" data-act="editTxn" data-id="${t.id}"><span class="ic">${(t.receipts || []).length ? '📎' : '🧾'}</span><span class="grow">${esc(t.note || catOf('expense', t.cat)[2])}<small>${dmy(t.date)}</small></span><b>${rm(t.amount)}</b></button>`).join('') || '<p class="muted">No receipts yet.</p>') + `<button type="button" class="btn primary" data-act="addTxn" data-type="expense" data-relief="${r.id}">＋ Add receipt</button>`);
    },
    editLimits: () => {
      const list = C.reliefList(state.settings).filter((r) => r.kind !== 'auto' || true);
      openSheet('Relief limits (RM)', '<p class="small muted">Defaults are YA2025. Change any that differ for your year.</p>' + list.map((r) => `<label class="row"><span class="grow small">${esc(r.name)}${r.kind === 'count' ? ' (per child)' : ''}</span><input class="mini wide" name="L_${r.id}" inputmode="decimal" value="${r.limit}"></label>`).join('') + '<button type="button" class="btn" data-act="resetLimits">Reset to defaults</button>', (v) => {
        const o = {}; C.RELIEFS.forEach((r) => { const x = num(v['L_' + r.id]); if (x !== r.limit) o[r.id] = x; });
        state.settings.reliefLimits = o; save(); render();
      });
    },
    resetLimits: () => { state.settings.reliefLimits = {}; save(); closeSheet(); render(); toast('Limits reset'); },
    backup: (ds) => backup(!!ds.img),
    eraseAll: async () => {
      if (!confirmBox('Erase ALL records on this phone? This cannot be undone unless you have a backup file.')) return;
      if (!confirmBox('Last check: erase everything?')) return;
      S.erase(); try { (await S.allImgKeys()).forEach((k) => S.delImg(k)); } catch (e) {}
      state = null; location.hash = ''; render();
    },
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    if (b.tagName === 'INPUT' && b.type !== 'checkbox' && b.type !== 'radio') return;
    const f = ACT[b.dataset.act]; if (!f) return;
    if (b.tagName !== 'INPUT') e.preventDefault();
    f(b.dataset, b);
  });

  const CHANGE = {
    txnType: (el) => txnTypeUI(el.closest('.sheetwrap'), el.value),
    holdKind: (el) => { el.closest('.sheet').dataset.kind = el.value; },
    loanKind: (el) => { const k = LOAN_KINDS.find((x) => x[0] === el.value); el.closest('.sheet').querySelector('[name=method]').value = k[2]; },
    addReceipt: async (el) => {
      for (const f of el.files) { try { const data = await S.compress(f); const id = 'r_' + C.uid(); await S.putImg(id, data); draftReceipts.push(id); } catch (e) { toast('Could not add photo: ' + e.message); } }
      el.value = ''; drawThumbs();
    },
    importFile: (el) => importFile(el.files[0]),
    taxFlag: (el) => { taxSet(el.dataset.id, el.checked); },
    taxCount: (el) => { taxSet(el.dataset.id, num(el.value)); },
    taxIncome: (el) => { taxSet('income', num(el.value) || undefined); },
    taxExp: (el) => { taxSet('businessExp', num(el.value) || undefined); },
    autoIns: (el) => { state.settings.autoInsRelief = el.checked; save(); render(); },
    budget: (el) => { const v = num(el.value); if (v > 0) state.settings.budgets[el.dataset.k] = v; else delete state.settings.budgets[el.dataset.k]; save(); },
    set: (el) => { state.settings[el.dataset.k] = el.value.trim(); save(); if (el.dataset.k === 'priceServer') render(); },
    setBool: (el) => { state.settings[el.dataset.k] = el.checked; save(); render(); },
    target: (el) => { state.settings.targets[el.dataset.k] = num(el.value); save(); },
  };
  document.addEventListener('change', (e) => { const f = CHANGE[e.target.dataset.change]; if (f) f(e.target); });
  document.addEventListener('input', (e) => { if (e.target.dataset.input === 'setLive') { state.settings[e.target.dataset.k] = e.target.value.trim(); save(); return; } if (e.target.dataset.input === 'recSearch') { recSearch = e.target.value; const pos = e.target.selectionStart; render(); const s = $('.search'); s.focus(); s.setSelectionRange(pos, pos); } });
  function taxSet(k, v) { const t = state.settings.tax; t[taxYear] = t[taxYear] || {}; if (v === undefined || v === false || v === 0) delete t[taxYear][k]; else t[taxYear][k] = v; save(); render(); }

  // ---------- helpers ----------
  let refreshing = false;
  async function refreshPrices(quiet) {
    if (refreshing) return; refreshing = true;
    if (!quiet) toast('Getting today’s prices…', 1500);
    try {
      const r = await PR.refresh(state);
      save(); render();
      if (r.errors.length) toast('Updated ' + r.updated + '. ' + r.errors[0], 5000);
      else if (!quiet) toast('Prices updated (' + r.updated + ')');
    } catch (e) { toast('Could not get prices: ' + e.message); }
    refreshing = false;
  }
  async function symSearch() {
    const q = ($('#symq') || {}).value; const box = $('#symres'); if (!q) return;
    const kind = $('.sheet [name=kind]').value;
    box.innerHTML = '<p class="small muted">Searching…</p>';
    try {
      if (kind === 'crypto') {
        const r = await PR.searchCoin(q);
        box.innerHTML = r.map((c) => `<button type="button" class="row" data-act="pickSym" data-coin="${esc(c.id)}" data-name="${esc(c.name)}"><span class="grow">${esc(c.name)}<small>${esc(c.symbol)}</small></span></button>`).join('') || '<p class="small muted">Nothing found.</p>';
      } else {
        const r = await PR.searchStock(q, state.settings);
        box.innerHTML = r.map((c) => `<button type="button" class="row" data-act="pickSym" data-sym="${esc(c.symbol)}" data-name="${esc(c.name)}"><span class="grow">${esc(c.name)}<small>${esc(c.symbol)} · ${esc(c.exchange)} · ${esc(c.type)}</small></span></button>`).join('') || '<p class="small muted">Nothing found.</p>';
      }
    } catch (e) { box.innerHTML = '<p class="small warn">' + esc(e.message) + '</p>'; }
  }
  function copySplit(g) {
    const b = C.groupBalances(g), plan = C.simplify(b.net);
    const f = (c) => 'RM ' + fmtN(c / 100);
    const lines = ['🍻 ' + g.name + ' (' + dmy(g.date) + ')', 'Total spent: ' + f(b.total), ''];
    (g.expenses || []).forEach((e) => { const r = C.splitShares(e, g.members); lines.push('• ' + (e.title || 'Bill') + ': ' + f(r.totalC) + ' (paid by ' + Object.keys(r.paid).filter((p) => r.paid[p]).map(pname).join(', ') + ')'); });
    lines.push('', 'Each person’s share:'); g.members.forEach((p) => lines.push('• ' + pname(p) + ': ' + f(b.share[p])));
    lines.push('', plan.length ? 'To settle:' : 'All settled ✅'); plan.forEach((t) => lines.push('👉 ' + pname(t.from) + ' pays ' + pname(t.to) + ' ' + f(t.c)));
    const text = lines.join('\n');
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => toast('Copied — paste in WhatsApp'), () => openSheet('Copy this', '<textarea class="copybox" readonly>' + esc(text) + '</textarea>'));
  }
  function shareToRecords(g) {
    const b = C.groupBalances(g), mine = (b.share.me || 0) / 100;
    if (!mine) { toast('Your share is RM 0'); return; }
    const existing = state.txns.find((t) => t.splitRef === g.id);
    const t = existing || { id: C.uid(), at: new Date().toISOString(), type: 'expense', cat: 'food', account: (state.accounts[0] || {}).id, splitRef: g.id };
    Object.assign(t, { amount: C.r2(mine), date: g.date || C.today(), note: g.name + ' (my share)' });
    if (!existing) state.txns.push(t);
    save();
    txnForm(t);
    toast(existing ? 'Updated your share — check category and account' : 'Added your share — check category and account', 3500);
  }
  async function backup(withImg) {
    const data = JSON.parse(JSON.stringify(state));
    data.settings.lastBackup = new Date().toISOString();
    if (withImg) {
      data.receipts = {};
      for (const t of state.txns) for (const id of t.receipts || []) { const src = await S.getImg(id).catch(() => null); if (src) data.receipts[id] = src; }
    }
    const name = 'Money Account-backup-' + C.today() + '.json';
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const file = new File([blob], name, { type: 'application/json' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)) await navigator.share({ files: [file], title: name });
      else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }
      state.settings.lastBackup = data.settings.lastBackup; save(); render();
      toast('Backup made (' + Math.round(blob.size / 1024) + ' KB)');
    } catch (e) { if (e.name !== 'AbortError') toast('Backup failed: ' + e.message); }
  }
  function importFile(file) {
    if (!file) return;
    const rd = new FileReader();
    rd.onload = async () => {
      try {
        const d = JSON.parse(rd.result);
        if (!d || !d.settings || !Array.isArray(d.txns)) throw new Error('This is not a Money Account backup');
        if (state && !confirmBox('Replace everything on this phone with the backup from ' + (d.settings.lastBackup || '').slice(0, 10) + '?')) return;
        const imgs = d.receipts || {}; delete d.receipts;
        for (const id of Object.keys(imgs)) await S.putImg(id, imgs[id]);
        localStorage.setItem('wb.state.v1', JSON.stringify(d));
        state = S.load(); go('home'); render(); toast('Backup restored');
      } catch (e) { alert('Could not restore: ' + e.message); }
    };
    rd.readAsText(file);
  }

  // ---------- reports & accounts ----------
  const yearStart = () => C.today().slice(0, 4) + '-01-01';
  let repTab = 'ledger', repFrom = yearStart(), repTo = C.today(), repAcc = null;
  const catName = (type, k) => { const c = catOf(type, k); return c[2]; };
  const accName = (id) => (state.accounts.find((a) => a.id === id) || {}).name || '';
  const descOf = (t) => t.note || (t.type === 'transfer' ? 'Transfer ' + accName(t.account) + ' → ' + accName(t.toAccount) : catName(t.type, t.cat));
  const n2 = (x) => (x ? fmtN(x) : '');
  function periodBar() {
    const y = Number(C.today().slice(0, 4));
    return `<div class="period"><input type="date" value="${repFrom}" data-change="repFrom"><span>to</span><input type="date" value="${repTo}" data-change="repTo"></div>
      <div class="filters">${[[y + '-01-01', C.today(), 'This year'], [(y - 1) + '-01-01', (y - 1) + '-12-31', 'Last year'], [C.today().slice(0, 7) + '-01', C.today(), 'This month']].map(([f, t, l]) => `<button class="chip ${repFrom === f && repTo === t ? 'on' : ''}" data-act="repPeriod" data-f="${f}" data-t="${t}">${l}</button>`).join('')}</div>`;
  }
  VIEWS.reports = () => {
    const tabs = [['ledger', 'Dr / Cr statement'], ['pnl', 'Income statement'], ['bs', 'Assets & liabilities'], ['tax', 'Tax pack']];
    let body = '';
    if (repTab === 'ledger') {
      const accs = state.accounts; repAcc = repAcc && accs.some((a) => a.id === repAcc) ? repAcc : (accs[0] || {}).id;
      const L = C.ledger(state, repAcc, repFrom, repTo);
      body = `${periodBar()}<select class="full" data-change="repAcc">${opt(accs.map((a) => [a.id, a.name]), repAcc)}</select>
        <p class="small muted">Bookkeeping view: <b>Debit</b> = money into this account, <b>Credit</b> = money out. (Your bank’s own statement shows it the other way round, from the bank’s side.)</p>
        <div class="ledger"><div class="lh"><span>Date</span><span>Description</span><span>Debit</span><span>Credit</span><span>Balance</span></div>
        <div class="lo"><span></span><span><b>Opening balance</b></span><span></span><span></span><span>${fmtN(L.opening)}</span></div>
        ${L.rows.map((r) => `<button class="lr" data-act="editTxn" data-id="${r.id}"><span>${dmy(r.date).slice(0, 5)}</span><span>${esc(descOf(r.t))}${(r.t.receipts || []).length ? ' 📎' : ''}</span><span>${n2(r.debit)}</span><span>${n2(r.credit)}</span><span>${fmtN(r.balance)}</span></button>`).join('')}
        <div class="lo tot"><span></span><span><b>Totals / closing</b></span><span>${fmtN(L.debit)}</span><span>${fmtN(L.credit)}</span><span><b>${fmtN(L.closing)}</b></span></div></div>
        <div class="btnrow"><button class="btn" data-act="exportLedger">📊 Excel (CSV)</button><button class="btn" data-act="printReport" data-r="ledger">🖨️ PDF / print</button></div>`;
    } else if (repTab === 'pnl') {
      const P = C.pnl(state, repFrom, repTo);
      body = `${periodBar()}<section class="card stmt"><h3>Income statement</h3><small class="muted">${dmy(repFrom)} – ${dmy(repTo)}</small>
        <h4>Income</h4>${P.income.map(([k, v]) => `<div class="row"><span class="grow">${esc(catName('income', k))}</span><b>${fmtN(v)}</b></div>`).join('') || '<p class="muted small">None</p>'}
        <div class="row total"><span class="grow">Total income</span><b>${fmtN(P.totalIncome)}</b></div>
        <h4>Expenses</h4>${P.expense.map(([k, v]) => `<div class="row"><span class="grow">${esc(catName('expense', k))}</span><b>${fmtN(v)}</b></div>`).join('') || '<p class="muted small">None</p>'}
        <div class="row total"><span class="grow">Total expenses</span><b>(${fmtN(P.totalExpense)})</b></div>
        <div class="row grand"><span class="grow">${P.net >= 0 ? 'Surplus (saved)' : 'Deficit'}</span><b class="${plc(P.net)}">${fmtN(P.net)}</b></div></section>
        <div class="btnrow"><button class="btn" data-act="exportPnl">📊 Excel (CSV)</button><button class="btn" data-act="printReport" data-r="pnl">🖨️ PDF / print</button></div>`;
    } else if (repTab === 'bs') {
      body = `<section class="card stmt">${bsHTML()}</section><div class="btnrow"><button class="btn" data-act="printReport" data-r="bs">🖨️ PDF / print</button></div>`;
    } else {
      const y = Number(repTo.slice(0, 4));
      const tp = C.taxPack(state, y);
      body = `<div class="monthnav"><button class="icon" data-act="repYear" data-d="-1">‹</button><b>Year of assessment ${y}</b><button class="icon" data-act="repYear" data-d="1">›</button></div>
        <section class="card"><h3>For your tax accountant</h3>
        <p class="small muted">One pack with your income by source, business expenses, tax reliefs and receipt photos — numbered so every amount can be traced to its receipt. Send it by email or WhatsApp.</p>
        ${Object.values(tp.groups).map((g) => `<div class="row"><span class="grow">${esc(g.label)}<small>${g.items.length} records</small></span><b>${fmtN(g.total)}</b></div>`).join('') || '<p class="muted small">No taxable income recorded for this year.</p>'}
        <div class="row"><span class="grow">💼 Business expenses tagged<small>${tp.biz.length} categories</small></span><b>${fmtN(tp.bizTotal)}</b></div>
        <div class="row"><span class="grow">🧾 Tax reliefs<small>see Tax relief page</small></span><b>${fmtN(tp.relief.total)}</b></div>
        <div class="row"><span class="grow">📎 Receipt photos</span><b>${state.txns.filter((t) => (t.date || '').startsWith(y) && (t.receipts || []).length).length}</b></div>
        <div class="btnrow"><button class="btn primary" data-act="printReport" data-r="tax">🖨️ Tax pack PDF</button><button class="btn" data-act="exportTax">📊 Excel (CSV)</button><button class="btn" data-act="receiptPack">📎 Receipts pack</button></div>
        <small class="muted">The income grouping (agency commission as business income, etc.) is a starting point for your accountant, who decides the final treatment.</small></section>`;
    }
    return `<header class="top"><a href="#/more" class="icon">‹</a><h1 class="grow">Reports</h1></header>
      <div class="tabs2">${tabs.map(([k, l]) => `<button class="${repTab === k ? 'on' : ''}" data-act="repTab" data-t="${k}">${l}</button>`).join('')}</div>${body}`;
  };
  function bsHTML() {
    const s = C.summary(state), bal = C.accountBalances(state), fx = state.fx;
    const line = (l, v, cls) => `<div class="row ${cls || ''}"><span class="grow">${esc(l)}</span><b>${fmtN(v)}</b></div>`;
    const accs = state.accounts.filter((a) => !a.archived);
    const hs = state.holdings.filter((h) => !h.archived);
    const loans = state.loans.filter((l) => !l.archived);
    return `<h3>Statement of assets & liabilities</h3><small class="muted">As at ${dmy(C.today())} · investments at market prices ${ago(state.pricesAt)}</small>
      <h4>Current (liquid) assets</h4>${accs.filter((a) => (bal[a.id] || 0) >= 0).map((a) => line(a.name + (a.type === 'bank' ? ' (cash in bank)' : ''), bal[a.id] || 0)).join('')}
      ${line('Total liquid assets', s.liquid, 'sub')}
      <h4>Investments (realisable within days)</h4>${hs.filter((h) => !['property', 'epf'].includes(h.kind)).map((h) => line(h.name + ' (' + kindOf(h.kind)[2] + ')', C.holdingValue(h, fx).value)).join('')}
      ${line('Total investments', s.sellable, 'sub')}
      <h4>Long-term assets</h4>${hs.filter((h) => ['property', 'epf'].includes(h.kind)).map((h) => { const v = C.holdingValue(h, fx); return line(h.name + ' (' + kindOf(h.kind)[2] + (v.estimated ? ', estimated' : '') + ')', v.value); }).join('')}
      ${s.insCash ? line('Insurance cash / fund value', s.insCash) : ''}${s.owedToMe + s.splitIn ? line('Amounts owed to me', s.owedToMe + s.splitIn) : ''}
      ${line('Total long-term assets', s.longTerm, 'sub')}
      ${line('Total assets', s.assets, 'total')}
      <h4>Liabilities</h4>${loans.map((l) => line(l.name, C.loanStatus(l).balance)).join('')}
      ${accs.filter((a) => (bal[a.id] || 0) < 0).map((a) => line(a.name, -(bal[a.id] || 0))).join('')}
      ${s.iOwe + s.splitOut ? line('Amounts I owe', s.iOwe + s.splitOut) : ''}${s.devOwe ? line('Balance purchase price owed to developer', s.devOwe) : ''}
      ${line('Total liabilities', s.liabilities, 'total')}
      ${line('NET WORTH', s.netWorth, 'grand')}`;
  }
  // receipt numbers for one year: R001… in date order
  function receiptNos(year) {
    const map = {}; let k = 0;
    state.txns.filter((t) => (t.date || '').startsWith(String(year)) && (t.receipts || []).length).sort((a, b) => a.date.localeCompare(b.date))
      .forEach((t) => (map[t.id] = 'R' + String(++k).padStart(3, '0')));
    return map;
  }
  function taxPackHTML(y) {
    const tp = C.taxPack(state, y), nos = receiptNos(y), ts = tp.relief;
    const tr = (cells) => '<tr>' + cells.map((c, i) => `<td${i >= cells.length - 1 ? ' class="n"' : ''}>${c}</td>`).join('') + '</tr>';
    const listT = (items) => '<table><tr><th>Date</th><th>Description</th><th>Receipt</th><th class="n">RM</th></tr>' + items.map((t) => tr([dmy(t.date), esc(descOf(t)), nos[t.id] || '', fmtN(t.amount)])).join('') + '</table>';
    const bizItems = state.txns.filter((t) => t.type === 'expense' && t.biz && (t.date || '').startsWith(String(y))).sort((a, b) => a.date.localeCompare(b.date));
    const pols = state.policies.filter((p) => p.relief && p.status !== 'lapsed' && p.status !== 'ended');
    return `<h1>Income tax pack — Year of Assessment ${y}</h1>
      <p>${esc(state.settings.name || '')} · Prepared ${dmy(C.today())} from personal records in Money Account. For the tax agent to review.</p>
      <h2>A. Income by source</h2>${Object.values(tp.groups).map((g) => `<h3>${esc(g.label)}: RM ${fmtN(g.total)}</h3>${listT(g.items.sort((a, b) => a.date.localeCompare(b.date)))}`).join('') || '<p>No income recorded.</p>'}
      ${tp.notTax.length ? '<p class="note">Excluded as not taxable (gifts, refunds, own money moved): RM ' + fmtN(tp.notTax.reduce((a, t) => a + num(t.amount), 0)) + ' in ' + tp.notTax.length + ' records.</p>' : ''}
      <h2>B. Business expenses (tagged 💼): RM ${fmtN(tp.bizTotal)}</h2>
      <table><tr><th>Category</th><th class="n">RM</th></tr>${tp.biz.map(([k, v]) => tr([esc(catName('expense', k)), fmtN(v)])).join('')}</table>${bizItems.length ? listT(bizItems) : ''}
      <h2>C. Personal tax reliefs: RM ${fmtN(ts.total)}</h2>
      <table><tr><th>Relief</th><th class="n">Claimed</th><th class="n">Limit</th><th class="n">Allowed</th></tr>${ts.rows.filter((r) => r.allowed || r.claimed).map((r) => '<tr><td>' + esc(r.name) + (r.kind === 'count' ? ' × ' + r.count : '') + '</td><td class="n">' + fmtN(r.claimed) + '</td><td class="n">' + fmtN(r.kind === 'count' ? r.limit * r.count : r.limit) + '</td><td class="n">' + fmtN(r.allowed) + '</td></tr>').join('')}</table>
      ${ts.rows.filter((r) => r.items.length).map((r) => `<h3>${esc(r.name)}</h3><table><tr><th>Date</th><th>Description</th><th>Receipt</th><th class="n">RM</th></tr>${r.items.map((t) => t.policy ? tr(['', esc(t.note) + ' (insurance premium)', '', fmtN(t.amount)]) : tr([dmy(t.date), esc(descOf(t)), nos[t.id] || '', fmtN(t.amount)])).join('')}</table>`).join('')}
      ${pols.length ? '<h2>D. Insurance policies used for relief</h2><table><tr><th>Insured</th><th>Insurer / plan</th><th>Relief type</th><th class="n">Yearly premium</th></tr>' + pols.map((p) => tr([esc(p.insured || 'Me'), esc((p.insurer || '') + ' ' + (p.plan || '')), p.relief === 'life' ? 'Life insurance' : 'Education & medical insurance', fmtN(num(p.reliefAmount) || C.annualPremium(p))])).join('') + '</table><p class="note">Use the insurer’s premium statement for the final figures.</p>' : ''}
      <h2>E. Estimate (for reference only)</h2><table>
        ${tr(['Income', fmtN(ts.income)])}${tr(['Less business expenses', '(' + fmtN(ts.expenses) + ')'])}${tr(['Less reliefs', '(' + fmtN(ts.total) + ')'])}${tr(['Chargeable income', fmtN(ts.chargeable)])}${tr(['Estimated tax' + (ts.tax.rebate ? ' after RM400 rebate' : ''), fmtN(ts.tax.tax)])}</table>
      <p class="note">Estimate uses resident rates since YA2023 and relief limits set in the app (defaults: LHDN YA2025). It ignores PCB/instalments paid, zakat and special cases. Receipt numbers (R001…) match the photos in the receipts pack.</p>`;
  }
  const PRINT_CSS = `body{font:12px/1.45 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111;margin:24px}h1{font-size:18px;margin:0 0 4px}h2{font-size:14px;margin:18px 0 6px;border-bottom:2px solid #b8892b;padding-bottom:3px}h3{font-size:12.5px;margin:12px 0 4px}h4{margin:12px 0 4px}table{width:100%;border-collapse:collapse;margin:4px 0 8px}td,th{border-bottom:1px solid #ddd;padding:4px 6px;text-align:left;vertical-align:top}th{background:#f6f1e4}.n{text-align:right;white-space:nowrap}.note{color:#555;font-size:11px}.row{display:flex;justify-content:space-between;border-bottom:1px solid #eee;padding:4px 0}.total{font-weight:700;border-top:1px solid #999}.grand{font-weight:800;font-size:14px;border-top:2px solid #111}.muted{color:#666}.rc{page-break-inside:avoid;border:1px solid #ccc;padding:8px;margin:0 0 12px}.rc img{max-width:100%;max-height:820px;display:block;margin-top:6px}`;
  function printHTML(title, html) {
    const w = window.open('', '_blank');
    if (!w) { toast('Allow pop-ups to print'); return; }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${PRINT_CSS}</style></head><body>${html}<script>setTimeout(function(){print()},400)<\/script></body></html>`);
    w.document.close();
  }
  async function shareFile(name, blob, type) {
    const file = new File([blob], name, { type });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)) { try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  const csvFile = (name, rows) => shareFile(name, new Blob([C.csv(rows)], { type: 'text/csv' }), 'text/csv');
  function reportTitle(r) { return ({ ledger: 'Account statement — ' + accName(repAcc), pnl: 'Income statement', bs: 'Statement of assets and liabilities', tax: 'Tax pack YA ' + repTo.slice(0, 4) })[r]; }
  function printReport(r) {
    let html = '';
    if (r === 'ledger') {
      const L = C.ledger(state, repAcc, repFrom, repTo);
      html = `<h1>${esc(reportTitle('ledger'))}</h1><p>${dmy(repFrom)} – ${dmy(repTo)} · Debit = money in, Credit = money out</p><table><tr><th>Date</th><th>Description</th><th>Category</th><th class="n">Debit</th><th class="n">Credit</th><th class="n">Balance</th></tr>
        <tr><td></td><td><b>Opening balance</b></td><td></td><td></td><td></td><td class="n">${fmtN(L.opening)}</td></tr>
        ${L.rows.map((x) => `<tr><td>${dmy(x.date)}</td><td>${esc(descOf(x.t))}</td><td>${x.t.inv ? 'Investment' : x.t.type === 'transfer' ? 'Transfer' : esc(catName(x.t.type, x.t.cat))}</td><td class="n">${n2(x.debit)}</td><td class="n">${n2(x.credit)}</td><td class="n">${fmtN(x.balance)}</td></tr>`).join('')}
        <tr><td></td><td><b>Totals / closing balance</b></td><td></td><td class="n"><b>${fmtN(L.debit)}</b></td><td class="n"><b>${fmtN(L.credit)}</b></td><td class="n"><b>${fmtN(L.closing)}</b></td></tr></table>`;
    } else if (r === 'pnl') {
      const P = C.pnl(state, repFrom, repTo);
      html = `<h1>Income statement</h1><p>${esc(state.settings.name || '')} · ${dmy(repFrom)} – ${dmy(repTo)}</p><h2>Income</h2><table>${P.income.map(([k, v]) => `<tr><td>${esc(catName('income', k))}</td><td class="n">${fmtN(v)}</td></tr>`).join('')}<tr class="total"><td>Total income</td><td class="n">${fmtN(P.totalIncome)}</td></tr></table>
        <h2>Expenses</h2><table>${P.expense.map(([k, v]) => `<tr><td>${esc(catName('expense', k))}</td><td class="n">${fmtN(v)}</td></tr>`).join('')}<tr class="total"><td>Total expenses</td><td class="n">(${fmtN(P.totalExpense)})</td></tr></table>
        <table><tr class="grand"><td>${P.net >= 0 ? 'Surplus' : 'Deficit'}</td><td class="n">${fmtN(P.net)}</td></tr></table>`;
    } else if (r === 'bs') html = bsHTML();
    else html = taxPackHTML(Number(repTo.slice(0, 4)));
    printHTML(reportTitle(r), html);
  }
  async function receiptPack(year, filter) {
    const nos = receiptNos(year);
    const list = state.txns.filter((t) => nos[t.id] && (!filter || filter(t))).sort((a, b) => a.date.localeCompare(b.date));
    if (!list.length) { toast('No receipt photos for ' + year); return; }
    toast('Preparing ' + list.length + ' receipts…', 1500);
    let html = `<h1>Receipts — ${year}</h1><p>${esc(state.settings.name || '')} · ${list.length} records · numbers match the tax pack</p>`;
    for (const t of list) {
      const imgs = []; for (const id of t.receipts) { const s = await S.getImg(id).catch(() => null); if (s) imgs.push(s); }
      html += `<div class="rc"><b>${nos[t.id]}</b> · ${dmy(t.date)} · ${esc(descOf(t))} · ${t.type === 'income' ? 'Income' : esc(catName(t.type, t.cat))} · <b>RM ${fmtN(t.amount)}</b>${t.relief ? ' · Relief: ' + esc((C.RELIEFS.find((r) => r.id === t.relief) || {}).name || '') : ''}${t.biz ? ' · Business expense' : ''}${imgs.map((s) => '<img src="' + s + '">').join('')}</div>`;
    }
    const doc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Receipts ${year}</title><style>${PRINT_CSS}</style></head><body>${html}</body></html>`;
    shareFile('Receipts-' + year + '.html', new Blob([doc], { type: 'text/html' }), 'text/html');
  }

  // ----- receipts library -----
  let rcYear = Number(C.today().slice(0, 4)), rcFilter = 'all';
  VIEWS.receipts = () => {
    const nos = receiptNos(rcYear);
    const all = state.txns.filter((t) => nos[t.id]);
    const list = all.filter((t) => rcFilter === 'all' || (rcFilter === 'biz' && t.biz) || (rcFilter === 'relief' && t.relief) || (rcFilter === 'income' && t.type === 'income')).sort((a, b) => b.date.localeCompare(a.date));
    const groups = {};
    list.forEach((t) => { const k = t.type === 'income' ? '💰 Income' : t.relief ? '🧾 ' + ((C.RELIEFS.find((r) => r.id === t.relief) || {}).name || t.relief) : catOf(t.type, t.cat)[1] + ' ' + catName(t.type, t.cat); (groups[k] = groups[k] || []).push(t); });
    return `<header class="top"><a href="#/more" class="icon">‹</a><h1 class="grow">Receipts</h1><button class="icon gold" data-act="aiReceipt">📷</button></header>
      <div class="monthnav"><button class="icon" data-act="rcYear" data-d="-1">‹</button><b>${rcYear} · ${all.length} receipts</b><button class="icon" data-act="rcYear" data-d="1">›</button></div>
      <div class="filters">${[['all', 'All'], ['biz', '💼 Business'], ['relief', '🧾 Tax relief'], ['income', '💰 Income slips']].map(([k, l]) => `<button class="chip ${rcFilter === k ? 'on' : ''}" data-act="rcFilter" data-f="${k}">${l}</button>`).join('')}</div>
      ${Object.keys(groups).map((g) => `<section class="card"><h3>${esc(g)} <small class="muted">RM ${fmtN(groups[g].reduce((a, t) => a + num(t.amount), 0))}</small></h3><div class="rgrid">${groups[g].map((t) => `<button class="rcard" data-act="editTxn" data-id="${t.id}"><img data-rid="${t.receipts[0]}" alt=""><span><b>${rm(t.amount)}</b><small>${nos[t.id]} · ${dmy(t.date)}</small><small>${esc(descOf(t))}</small></span></button>`).join('')}</div></section>`).join('') || '<p class="muted center">No receipt photos for this filter. Tap 📷 to scan one.</p>'}
      ${list.length ? `<button class="btn primary" data-act="rcPack">📎 Send these ${list.length} receipts (one file)</button>` : ''}`;
  };

  Object.assign(ACT, {
    repTab: (ds) => { repTab = ds.t; if (ds.t === 'tax' && repFrom.slice(5) !== '01-01') repFrom = repTo.slice(0, 4) + '-01-01'; render(); },
    repPeriod: (ds) => { repFrom = ds.f; repTo = ds.t; render(); },
    repYear: (ds) => { const y = Number(repTo.slice(0, 4)) + Number(ds.d); repFrom = y + '-01-01'; repTo = y + '-12-31'; render(); },
    printReport: (ds) => printReport(ds.r),
    exportLedger: () => { const L = C.ledger(state, repAcc, repFrom, repTo); csvFile('Statement-' + accName(repAcc).replace(/\W+/g, '_') + '-' + repFrom + '-to-' + repTo + '.csv', [['Account', accName(repAcc)], ['Period', repFrom + ' to ' + repTo], [], ['Date', 'Description', 'Category', 'Debit (in)', 'Credit (out)', 'Balance', 'Receipt'], ['', 'Opening balance', '', '', '', L.opening.toFixed(2)]].concat(L.rows.map((x) => [x.date, descOf(x.t), x.t.inv ? 'Investment' : x.t.type === 'transfer' ? 'Transfer' : catName(x.t.type, x.t.cat), x.debit ? x.debit.toFixed(2) : '', x.credit ? x.credit.toFixed(2) : '', x.balance.toFixed(2), (x.t.receipts || []).length ? 'yes' : ''])).concat([['', 'Totals', '', L.debit.toFixed(2), L.credit.toFixed(2), L.closing.toFixed(2)]])); },
    exportPnl: () => { const P = C.pnl(state, repFrom, repTo); csvFile('Income-statement-' + repFrom + '-to-' + repTo + '.csv', [['Income statement', repFrom + ' to ' + repTo], [], ['INCOME', '']].concat(P.income.map(([k, v]) => [catName('income', k), v.toFixed(2)])).concat([['Total income', P.totalIncome.toFixed(2)], [], ['EXPENSES', '']]).concat(P.expense.map(([k, v]) => [catName('expense', k), v.toFixed(2)])).concat([['Total expenses', P.totalExpense.toFixed(2)], [], ['Surplus / (deficit)', P.net.toFixed(2)]])); },
    exportTax: () => {
      const y = Number(repTo.slice(0, 4)), nos = receiptNos(y);
      const rows = [['Money Account — tax records YA ' + y], [], ['Receipt no', 'Date', 'Type', 'Tax group', 'Category', 'Description', 'Account', 'Amount (RM)', 'Business expense', 'Tax relief']];
      state.txns.filter((t) => (t.date || '').startsWith(String(y)) && t.type !== 'transfer').sort((a, b) => a.date.localeCompare(b.date)).forEach((t) => rows.push([nos[t.id] || '', t.date, t.type, t.type === 'income' ? (t.notTaxable ? 'Not taxable' : (C.TAX_CLASS[t.cat] || C.TAX_CLASS.other)[1]) : '', catName(t.type, t.cat), descOf(t), accName(t.account), num(t.amount).toFixed(2), t.biz ? 'yes' : '', t.relief ? (C.RELIEFS.find((r) => r.id === t.relief) || {}).name : '']));
      const ts = C.taxSummary(state, y);
      rows.push([], ['RELIEF SUMMARY'], ['Relief', 'Claimed', 'Limit', 'Allowed']);
      ts.rows.filter((r) => r.allowed || r.claimed).forEach((r) => rows.push([r.name, r.claimed.toFixed(2), r.limit, r.allowed.toFixed(2)]));
      csvFile('Tax-records-YA' + y + '.csv', rows);
    },
    receiptPack: () => receiptPack(Number(repTo.slice(0, 4))),
    rcYear: (ds) => { rcYear += Number(ds.d); render(); },
    rcFilter: (ds) => { rcFilter = ds.f; render(); },
    rcPack: () => receiptPack(rcYear, (t) => rcFilter === 'all' || (rcFilter === 'biz' && t.biz) || (rcFilter === 'relief' && t.relief) || (rcFilter === 'income' && t.type === 'income')),
  });
  Object.assign(CHANGE, {
    repFrom: (el) => { repFrom = el.value || yearStart(); render(); }, repTo: (el) => { repTo = el.value || C.today(); render(); }, repAcc: (el) => { repAcc = el.value; render(); },
  });

  // ---------- repeating records ----------
  function recurringBox() {
    const rs = (state.recurring || []);
    if (!rs.length) return '';
    const live = rs.filter((r) => !r.paused);
    const monthly = live.reduce((a, r) => a + (r.type === 'transfer' ? 0 : (r.type === 'income' ? 1 : -1) * num(r.amount) / (Number(r.every) || 1)), 0);
    return `<details class="card"><summary><b>🔁 Repeating (${live.length})</b> <small class="muted">${monthly >= 0 ? '+' : '−'}${rm(Math.abs(monthly))} a month on average</small></summary>
      ${rs.map((r) => { const c = r.type === 'transfer' ? ['', '🔁', 'Transfer'] : catOf(r.type, r.cat); return `<button class="row" data-act="editRule" data-id="${r.id}"><span class="ic">${c[1]}</span><span class="grow">${esc(r.note || c[2])}<small>${esc(C.EVERY[r.every])}${r.paused ? ' · stopped' : ' · next ' + dmy(C.nextRuleDate(r))}</small></span><b class="${r.type === 'income' ? 'up' : ''}">${rm(r.amount)}</b></button>`; }).join('')}</details>`;
  }
  function ruleForm(r) {
    openSheet('Repeating record', `
      <p class="small muted">${esc(r.note || catOf(r.type, r.cat)[2])} · ${r.type}. Changes apply to future repeats; records already added stay as they are.</p>
      ${fld('Amount (RM)', money('amount', r.amount))}
      <div class="grid2">${fld('Repeat', '<select name="every">' + opt(Object.entries(C.EVERY), String(r.every)) + '</select>')}${fld('Until', inp('end', r.end, 'type="date"'))}</div>
      ${fld('Note', inp('note', r.note))}
      <label class="row"><input type="checkbox" name="paused" ${r.paused ? 'checked' : ''}><span class="grow">Stop repeating</span></label>
      <button type="button" class="btn danger" data-act="delRule" data-id="${r.id}">Delete repeat (keeps past records)</button>`, (v) => {
      Object.assign(r, { amount: C.r2(num(v.amount)), every: num(v.every) || 1, end: v.end || undefined, note: v.note, paused: v.paused || undefined });
      C.postRecurring(state); save(); render();
    });
  }

  // ---------- balance check (find unrecorded spending) ----------
  function balanceCheck() {
    const bal = C.accountBalances(state);
    const accs = state.accounts.filter((a) => !a.archived);
    openSheet('⚖️ Balance check', `
      <p class="small muted">Open your bank / e-wallet app, or count your cash, and type what it shows <b>right now</b>. Leave blank to skip. The difference is recorded as “Unrecorded spending” (or income), so your totals match real life even when you forgot a receipt.</p>
      ${accs.map((a) => `<div class="row"><span class="grow">${esc(a.name)}<small>App says ${rm(bal[a.id] || 0, { show: true })}</small></span><input class="mini wide" inputmode="decimal" name="b_${a.id}" placeholder="real"></div>`).join('')}
      <div id="bcprev" class="preview"></div>`, (v) => {
      let n = 0;
      accs.forEach((a) => {
        if (v['b_' + a.id] === '') return;
        const diff = C.r2(num(v['b_' + a.id]) - (bal[a.id] || 0));
        if (!diff) return;
        state.txns.push({ id: C.uid(), at: new Date().toISOString(), date: C.today(), type: diff < 0 ? 'expense' : 'income', cat: diff < 0 ? 'unknown' : 'other', amount: Math.abs(diff), account: a.id, note: diff < 0 ? 'Unrecorded spending (balance check)' : 'Unrecorded money in (balance check)', notTaxable: diff > 0 ? true : undefined, balanceCheck: true });
        n++;
      });
      save(); render(); toast(n ? 'Recorded ' + n + ' difference' + (n > 1 ? 's' : '') + '. Tap one later to re-label it if you remember.' : 'All balances match 👍', 4000);
    }, { saveText: 'Record gaps' });
    const box = $('.sheet');
    box.addEventListener('input', () => {
      const v = formVals(box);
      $('#bcprev').innerHTML = accs.map((a) => { if (v['b_' + a.id] === '') return ''; const d = C.r2(num(v['b_' + a.id]) - (bal[a.id] || 0)); return `<div class="row"><span class="grow">${esc(a.name)}</span><b class="${plc(d)}">${d === 0 ? 'matches ✓' : d < 0 ? rm(-d, { show: true }) + ' unrecorded spending' : rm(d, { show: true }) + ' more than expected'}</b></div>`; }).join('');
    });
  }

  // ---------- AI: voice, receipt, statement ----------
  const aiServer = () => PR.server(state.settings);
  // Ask for the AI access code in a pop-up over the current screen (keeps the voice text / photos), resolve true if saved.
  function askCode(why) {
    return new Promise((done) => {
      const d = document.createElement('div'); d.className = 'codeask';
      d.innerHTML = '<div class="card"><h3>🔑 AI access code</h3><p class="small">' + esc(why) + '</p>' +
        '<input id="caIn" type="text" autocapitalize="off" autocorrect="off" spellcheck="false" autocomplete="off" value="' + esc(state.settings.aiCode || '') + '">' +
        '<p class="small muted">Shown so you can check it. Capital letters and spaces count — type it exactly as you set it on the server.</p>' +
        '<div class="btnrow"><button type="button" class="btn primary" id="caOk">Save & try again</button><button type="button" class="btn ghost" id="caNo">Cancel</button></div></div>';
      document.body.appendChild(d);
      const inp = d.querySelector('#caIn'); setTimeout(() => inp.focus(), 50);
      const end = (ok) => { if (ok) { state.settings.aiCode = inp.value.trim(); save(); } d.remove(); done(ok && !!inp.value.trim()); };
      d.querySelector('#caOk').onclick = () => end(true);
      d.querySelector('#caNo').onclick = () => end(false);
      inp.onkeydown = (e) => { if (e.key === 'Enter') end(true); };
    });
  }
  const NO_CODE = 'This phone has no AI access code saved yet. Type the code you set on your server.';
  const BAD_CODE = 'The server did not accept this code. Check it and try again.';
  // Runs a server call; if the code is missing or rejected, asks for it and tries again.
  async function withCode(run) {
    if (!(state.settings.aiCode || '').trim() && (aiServer() || '') !== '/api') { if (!(await askCode(NO_CODE))) throw new Error('No AI access code'); }
    for (;;) {
      try { return await run(); }
      catch (e) { if (e.status !== 401) throw e; if (!(await askCode(BAD_CODE))) throw new Error('Wrong AI access code'); }
    }
  }
  const aiCall = (task, payload) => withCode(() => aiCall1(task, payload));
  async function aiCall1(task, payload) {
    const srv = aiServer();
    if (!srv) throw new Error('Set the server link in More → Settings to use AI');
    const reliefs = C.reliefList(state.settings).filter((r) => !r.kind).map((r) => ({ id: r.id, name: r.name }));
    const accounts = state.accounts.filter((a) => !a.archived).map((a) => ({ id: a.id, name: a.name, type: a.type }));
    const r = await fetch(srv + '/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ task, code: (state.settings.aiCode || '').trim(), today: C.today(), cats: { expense: EXP_CATS.filter((c) => c[0] !== 'unknown').map((c) => [c[0], c[2]]), income: INC_CATS.map((c) => [c[0], c[2]]) }, reliefs, accounts, holdings: state.holdings.filter((h) => !h.archived).map((h) => ({ id: h.id, name: h.name, kind: h.kind })) }, payload)) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || 'Server error ' + r.status); e.status = r.status; throw e; }
    return j;
  }
  async function transcribe(blob) {
    const r = await fetch(aiServer() + '/transcribe', { method: 'POST', headers: { 'Content-Type': blob.type, 'X-Code': (state.settings.aiCode || '').trim() }, body: blob });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || 'Server error ' + r.status); e.status = r.status; throw e; }
    return j;
  }
  // Voice: record → server transcribe; without server, the phone's own speech typing.
  let rec = null;
  function aiVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const canRec = !!(aiServer() && navigator.mediaDevices && window.MediaRecorder);
    openSheet('🎙️ Say it', `
      <p class="small muted">Say what you spent or received, any language mix. E.g. <i>“Lunch 25, Grab 18, petrol 80 yesterday, commission 4k masuk Maybank”</i>.</p>
      <button type="button" class="micbtn" id="mic" data-act="micToggle">🎙️<span>Tap to start</span></button>
      ${fld('What I heard (you can fix it)', '<textarea id="vtext" rows="3" placeholder="…or just type here"></textarea>')}
      <button type="button" class="btn primary" data-act="voiceRead">✨ Turn into records</button>
      ${!canRec && !SR ? '<p class="small warn">This phone has no speech typing here. Type instead, or use the microphone key on your keyboard.</p>' : ''}
      ${!aiServer() ? '<p class="small muted">No AI server set: the app reads the amounts itself (simple rules). Add the server in Settings for smarter reading.</p>' : ''}`);
    rec = { canRec, SR };
  }
  async function micToggle() {
    const btn = $('#mic'); if (!btn) return;
    if (rec.active) { rec.stop(); return; }
    if (rec.canRec) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mr = new MediaRecorder(stream); const chunks = [];
        mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        mr.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop()); rec.active = false;
          btn.classList.remove('on'); btn.innerHTML = '⏳<span>Listening back…</span>';
          try {
            const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
            const j = await withCode(() => transcribe(blob));
            $('#vtext').value = ($('#vtext').value ? $('#vtext').value + ' ' : '') + j.text;
            btn.innerHTML = '🎙️<span>Tap to add more</span>';
            voiceRead();
          } catch (e) { btn.innerHTML = '🎙️<span>Try again</span>'; toast('Could not hear it: ' + e.message, 4000); }
        };
        mr.start(); rec.active = true; rec.stop = () => mr.stop();
        btn.classList.add('on'); btn.innerHTML = '⏹️<span>Recording… tap to finish</span>';
        setTimeout(() => { if (rec.active && rec.stop === mr.stop.bind(mr)) {} }, 0);
      } catch (e) { toast('Microphone blocked: ' + e.message, 4000); }
      return;
    }
    if (rec.SR) {
      const sr = new rec.SR(); sr.lang = 'en-MY'; sr.interimResults = true; sr.continuous = true;
      const base = $('#vtext').value;
      sr.onresult = (e) => { let s = ''; for (const r of e.results) s += r[0].transcript; $('#vtext').value = (base ? base + ' ' : '') + s; };
      sr.onend = () => { rec.active = false; btn.classList.remove('on'); btn.innerHTML = '🎙️<span>Tap to add more</span>'; };
      sr.onerror = (e) => toast('Speech: ' + e.error);
      sr.start(); rec.active = true; rec.stop = () => sr.stop();
      btn.classList.add('on'); btn.innerHTML = '⏹️<span>Listening… tap to finish</span>';
    } else toast('Type it instead — speech is not available here');
  }
  async function voiceRead() {
    const text = ($('#vtext') || {}).value || '';
    if (!text.trim()) { toast('Say or type something first'); return; }
    if (!aiServer()) { reviewEntries(C.parseSpoken(text, C.today()), { title: 'Check these', comment: 'Read by simple rules — check categories.' }); return; }
    toast('✨ Reading…', 1500);
    try { const r = await aiCall('entries', { text }); reviewEntries(r.entries || [], { title: 'Check these', comment: r.comment, standIn: r.standIn }); }
    catch (e) { toast(e.message, 4500); reviewEntries(C.parseSpoken(text, C.today()), { title: 'Check these', comment: 'AI not reachable — read by simple rules.' }); }
  }
  // Receipt: photo → AI → review (photo is attached to the record)
  function aiReceipt() {
    openSheet('📷 Scan receipt', `
      <p class="small muted">Take a photo of a receipt, bill, invoice, payment screenshot, payslip or commission statement. AI reads the amount, date and type, and suggests a tax relief if it fits. You check before saving.</p>
      <div class="btnrow"><label class="btn primary big">📷 Take photo<input type="file" accept="image/*" capture="environment" hidden data-change="receiptPick"></label>
      <label class="btn big">🖼️ Upload<input type="file" accept="image/*" multiple hidden data-change="receiptPick"></label></div>
      ${!aiServer() ? '<p class="small warn">AI needs the server link (More → Settings). Without it the photo is saved with a blank record for you to fill in.</p>' : ''}
      <div id="scanstate"></div>`);
  }
  async function receiptPick(el) {
    const files = [...el.files]; if (!files.length) return;
    const st = $('#scanstate'); st.innerHTML = '<p class="center">⏳ Reading the receipt…</p>';
    const ids = [], imgs = [];
    for (const f of files) { const data = await S.compress(f); const id = 'r_' + C.uid(); await S.putImg(id, data); ids.push(id); imgs.push(data); }
    let entries = [], comment = '', standIn = false;
    if (aiServer()) {
      try { const r = await aiCall('receipt', { images: imgs }); entries = r.entries || []; comment = r.comment; standIn = r.standIn; }
      catch (e) { comment = 'AI could not read it: ' + e.message; }
    }
    if (!entries.length) entries = [{ type: 'expense', amount: '', date: C.today(), cat: 'other', note: '' }];
    reviewEntries(entries, { title: 'Check the receipt', comment, standIn, receipts: ids });
  }
  // Review list shared by voice and receipt
  function reviewEntries(entries, o) {
    const accs = state.accounts.filter((a) => !a.archived).map((a) => [a.id, a.name]);
    const reliefs = [['', '— no tax relief —']].concat(C.reliefList(state.settings).filter((r) => !r.kind).map((r) => [r.id, r.name]));
    const valid = (type, cat) => (type === 'income' ? INC_CATS : EXP_CATS).some((c) => c[0] === cat) ? cat : 'other';
    const accOf = (id, fallback) => (accs.some((a) => a[0] === id) ? id : fallback);
    const TYPES = { expense: '💸 Spending', income: '💰 Income', transfer: '🔁 Transfer', balance: '⚖️ Balance now', invest: '📈 Investment' };
    const IKINDS = [['gold', '🥇 Gold'], ['stock', '📈 Shares'], ['crypto', '🪙 Crypto'], ['fund', '📊 Unit trust / ILP'], ['fd', '🏦 Fixed deposit'], ['other', '💼 Other']];
    const holds = [['', '＋ New investment']].concat(state.holdings.filter((h) => !h.archived).map((h) => [h.id, kindOf(h.kind)[1] + ' ' + h.name]));
    const holdOf = (e) => { if (state.holdings.some((h) => h.id === e.holding)) return e.holding; const n = String(e.asset || '').toLowerCase(); const m = state.holdings.find((h) => !h.archived && h.kind === e.kind && (e.kind === 'gold' || (n && String(h.name).toLowerCase().includes(n)))); return m ? m.id : ''; };
    const invCard = (e, i) => {
      const kind = IKINDS.some((k) => k[0] === e.kind) ? e.kind : 'other', sell = e.side === 'sell';
      return '<div class="grid2">' + fld('Buy or sell', '<select name="side_' + i + '">' + opt([['buy', 'Bought'], ['sell', 'Sold']], sell ? 'sell' : 'buy') + '</select>') + fld('What', '<select name="kind_' + i + '">' + opt(IKINDS, kind) + '</select>') + '</div>' +
        '<div class="grid2">' + fld('Name', inp('asset_' + i, e.asset || (kind === 'gold' ? 'Gold' : ''))) + fld(kind === 'gold' ? (e.unit === 'oz' ? 'Troy ounces' : 'Grams') : 'Units', inp('units_' + i, e.units == null ? '' : e.units, 'inputmode="decimal"')) + '</div>' +
        '<input type="hidden" name="unit_' + i + '" value="' + (e.unit === 'oz' ? 'oz' : 'g') + '">' +
        '<div class="grid2">' + fld(sell ? 'Received (RM)' : 'Paid (RM)', money('amt_' + i, e.amount)) + fld('Date', inp('date_' + i, /^\d{4}-\d\d-\d\d$/.test(e.date || '') ? e.date : C.today(), 'type="date"')) + '</div>' +
        '<div class="grid2">' + fld('Add to', '<select name="hold_' + i + '">' + opt(holds, holdOf(e)) + '</select>') + fld(sell ? 'Money into' : 'Paid from', '<select name="acc_' + i + '">' + opt(accs, accOf(e.account, (accs[0] || [])[0])) + '</select>') + '</div>' +
        (kind === 'stock' || kind === 'crypto' ? fld(kind === 'stock' ? 'Ticker (for live price)' : 'Coin id (for live price)', inp('tick_' + i, kind === 'stock' ? (e.symbol || '') : (e.coinId || ''), 'autocapitalize="off"'), kind === 'stock' ? 'Bursa ends with .KL, e.g. Maybank 1155.KL' : 'e.g. bitcoin') : '') +
        fld('Note', inp('note_' + i, e.note || '')) +
        '<small class="muted">Not counted as spending: the money moves from your account into this investment.</small>';
    };
    const sum = { expense: 0, income: 0 }; entries.forEach((e) => { if (sum[e.type] !== undefined) sum[e.type] += num(e.amount); });
    openSheet(o.title, `
      ${o.standIn ? '<p class="warn small">TEST MODE: this is a stand-in AI reply, not a real reading.</p>' : ''}
      ${o.comment ? '<p class="small muted">' + esc(o.comment) + '</p>' : ''}
      ${entries.length > 1 ? `<p class="small"><b>${entries.length} items</b> · spent ${rm(sum.expense, { show: true })} · income ${rm(sum.income, { show: true })}. Untick anything wrong.</p>` : ''}
      ${o.receipts ? '<div class="thumbs" id="thumbs"></div>' : ''}
      ${entries.map((e, i) => { const type = TYPES[e.type] ? e.type : 'expense'; const cats = type === 'income' ? INC_CATS : EXP_CATS; return `<div class="card inset t-${type}">
        <label class="row"><input type="checkbox" name="on_${i}" checked><span class="grow"><b>${TYPES[type]}</b>${e.merchant ? ' · ' + esc(e.merchant) : ''}</span><input type="hidden" name="type_${i}" value="${type}"></label>
        ${type === 'invest' ? invCard(e, i) + '</div>' : ''}${type === 'invest' ? '' : `<div class="grid2">${fld(type === 'balance' ? 'Money in the account now (RM)' : 'Amount (RM)', money('amt_' + i, e.amount))}${fld('Date', inp('date_' + i, /^\d{4}-\d\d-\d\d$/.test(e.date || '') ? e.date : C.today(), 'type="date"'))}</div>
        <div class="grid2">${type === 'expense' || type === 'income' ? fld('Category', '<select name="cat_' + i + '">' + opt(cats.map((c) => [c[0], c[1] + ' ' + c[2]]), valid(type, e.cat)) + '</select>') : ''}
          ${fld(type === 'transfer' ? 'From' : 'Account', '<select name="acc_' + i + '">' + opt(accs, accOf(e.account, (accs[0] || [])[0])) + '</select>')}
          ${type === 'transfer' ? fld('To', '<select name="to_' + i + '">' + opt(accs, accOf(e.toAccount, (accs[1] || accs[0] || [])[0])) + '</select>') : ''}</div>
        ${type === 'balance' ? '<small class="muted">The app compares this with its own figure and records any gap as unrecorded spending.</small>' : fld('Note', inp('note_' + i, e.note || e.merchant || ''))}
        ${type === 'expense' ? fld('Tax relief', '<select name="rel_' + i + '">' + opt(reliefs, reliefs.some((r) => r[0] === e.relief) ? e.relief : '') + '</select>') + '<label class="row"><input type="checkbox" name="biz_' + i + '" ' + (e.biz ? 'checked' : '') + '><span class="grow small">💼 Business expense (agency)</span></label>' : ''}</div>`}`; }).join('') || '<p class="muted">No amounts found. Try again, or add it by hand.</p>'}`,
    (v) => {
      let n = 0, gaps = 0; const newLive = [];
      // check investments first so nothing is half-saved
      for (let i = 0; i < entries.length; i++) {
        if (v['type_' + i] !== 'invest' || !v['on_' + i] || !(num(v['amt_' + i]) > 0)) continue;
        const h = state.holdings.find((x) => x.id === v['hold_' + i]), kind = h ? h.kind : v['kind_' + i];
        if (['gold', 'stock', 'crypto', 'fund'].includes(kind) && !(num(v['units_' + i]) > 0)) { toast('Item ' + (i + 1) + ': type how many ' + (kind === 'gold' ? 'grams' : 'units')); return false; }
        if (v['side_' + i] === 'sell' && !h) { toast('Item ' + (i + 1) + ': pick which investment you sold'); return false; }
        if (v['side_' + i] === 'sell' && h && h.lots && h.lots.length && num(v['units_' + i]) > C.position(h).units + 1e-9) { toast('Item ' + (i + 1) + ': you only hold ' + fmtU(C.position(h).units) + ' of ' + h.name); return false; }
      }
      const ok = (i) => v['on_' + i] && (num(v['amt_' + i]) > 0 || (v['type_' + i] === 'balance' && v['amt_' + i] !== ''));
      entries.forEach((e, i) => {
        const type = v['type_' + i];
        if (!ok(i) || type === 'balance') return;
        if (type === 'invest') { saveInvest(i); n++; return; }
        const t = { id: C.uid(), at: new Date().toISOString(), type, amount: C.r2(num(v['amt_' + i])), date: v['date_' + i] || C.today(), account: v['acc_' + i], note: v['note_' + i], ai: true, receipts: n === 0 && o.receipts ? o.receipts : [] };
        if (type === 'transfer') { if (v['to_' + i] === t.account) return; t.toAccount = v['to_' + i]; t.cat = ''; }
        else { t.cat = v['cat_' + i]; if (type === 'expense' && v['rel_' + i]) t.relief = v['rel_' + i]; if (type === 'expense' && v['biz_' + i]) t.biz = true; }
        state.txns.push(t); n++;
      });
      function saveInvest(i) {
        const side = v['side_' + i] === 'sell' ? 'sell' : 'buy', amount = C.r2(num(v['amt_' + i])), units = num(v['units_' + i]), date = v['date_' + i] || C.today(), tick = (v['tick_' + i] || '').trim();
        let h = state.holdings.find((x) => x.id === v['hold_' + i]);
        if (!h) {
          const kind = v['kind_' + i];
          h = { id: C.uid(), kind, name: v['asset_' + i] || (kind === 'gold' ? 'Gold' : kindOf(kind)[2]), lots: [], note: 'Added from AI' };
          if (kind === 'gold') h.unit = v['unit_' + i] || 'g';
          if (kind === 'stock' && tick) h.symbol = tick.toUpperCase();
          if (kind === 'crypto' && tick) h.coinId = tick.toLowerCase();
          if (kind === 'fd') Object.assign(h, { principal: 0, rate: 0, start: date });
          if (kind === 'other') Object.assign(h, { value: 0, valueAt: date, cost: 0 });
          state.holdings.push(h);
        }
        const sg = side === 'sell' ? -1 : 1;
        let lot;
        if (['gold', 'stock', 'crypto', 'fund'].includes(h.kind)) { lot = C.uid(); (h.lots = h.lots || []).push({ id: lot, type: side, date, units, amount }); if (C.LIVE_KINDS.includes(h.kind) || h.kind === 'fund') newLive.push(h); }
        else if (h.kind === 'fd') h.principal = C.r2(num(h.principal) + sg * amount);
        else { h.value = C.r2(num(h.value) + sg * amount); h.cost = C.r2(num(h.cost) + sg * amount); h.valueAt = date; }
        const u = units ? ' ' + fmtU(units) + (h.kind === 'gold' ? (h.unit === 'oz' ? ' oz' : ' g') : ' units') : '';
        const t = { id: C.uid(), at: new Date().toISOString(), type: 'transfer', cat: '', amount, date, note: v['note_' + i] || (side === 'sell' ? 'Sold' : 'Bought') + u + ' ' + h.name, ai: true, receipts: n === 0 && o.receipts ? o.receipts : [], inv: { holding: h.id, lot, side } };
        if (side === 'buy') t.account = v['acc_' + i]; else t.toAccount = v['acc_' + i];
        state.txns.push(t);
      }
      // balances last, after everything said in the same note is counted
      entries.forEach((e, i) => {
        if (!ok(i) || v['type_' + i] !== 'balance') return;
        const id = v['acc_' + i], have = C.accountBalances(state)[id] || 0, diff = C.r2(num(v['amt_' + i]) - have);
        if (!diff) return;
        state.txns.push({ id: C.uid(), at: new Date().toISOString(), date: v['date_' + i] || C.today(), type: diff < 0 ? 'expense' : 'income', cat: diff < 0 ? 'unknown' : 'other', amount: Math.abs(diff), account: id, note: diff < 0 ? 'Unrecorded spending (balance check)' : 'Unrecorded money in (balance check)', notTaxable: diff > 0 ? true : undefined, balanceCheck: true });
        gaps++;
      });
      if (!n && !gaps && !entries.some((e, i) => ok(i))) { toast('Nothing ticked with an amount'); return false; }
      save(); render(); if (newLive.length) refreshPrices(true); toast('Saved ' + n + ' record' + (n === 1 ? '' : 's') + (gaps ? ' + ' + gaps + ' balance gap' + (gaps > 1 ? 's' : '') : '') + ' ✓', 3500);
    }, { saveText: 'Save all' });
    if (o.receipts) { draftReceipts = o.receipts.slice(); drawThumbs(); }
  }
  // Investment statement / handwritten notes → holdings + report
  let investPhotos = [];
  function aiInvest() {
    investPhotos = [];
    openSheet('📊 Scan investment statement', `
      <p class="small muted">Photos of your Public Mutual (or any unit trust / ILP / broker) statement, or your own handwritten list of funds, units and prices. AI reads each fund, updates your holdings to the statement figures and writes a short report. You check everything before saving.</p>
      <div class="btnrow"><label class="btn primary">📷 Take photo<input type="file" accept="image/*" capture="environment" hidden data-change="investPick"></label>
      <label class="btn">🖼️ Upload pages<input type="file" accept="image/*" multiple hidden data-change="investPick"></label></div>
      <div class="thumbs" id="invthumbs"></div>
      ${fld('Anything to add? (optional)', '<textarea id="invnote" rows="2" placeholder="e.g. I put in RM 5,000 for the bond fund in 2022"></textarea>')}
      <button type="button" class="btn primary big" data-act="investRead">✨ Read and report</button>
      ${!aiServer() ? '<p class="small warn">Needs the server link (More → Settings).</p>' : ''}`);
  }
  async function investPick(el) {
    for (const f of el.files) { try { investPhotos.push(await S.compress(f)); } catch (e) {} }
    el.value = '';
    $('#invthumbs').innerHTML = investPhotos.map((s, i) => `<div class="thumb"><img src="${s}"><button type="button" data-act="investRm" data-i="${i}">✕</button></div>`).join('');
  }
  async function investRead() {
    if (!investPhotos.length) { toast('Add at least one photo'); return; }
    const btn = $('[data-act=investRead]'); btn.disabled = true; btn.textContent = '⏳ Reading… (up to a minute)';
    try {
      const existing = state.holdings.filter((h) => h.kind === 'fund').map((h) => ({ id: h.id, name: h.name }));
      const r = await aiCall('invest', { images: investPhotos, text: ($('#invnote') || {}).value || '', holdings: existing });
      investReview(r);
    } catch (e) { toast(e.message, 5000); btn.disabled = false; btn.textContent = '✨ Read and report'; }
  }
  function investReview(r) {
    const funds = state.holdings.filter((h) => h.kind === 'fund');
    const hs = (r.holdings || []).filter((h) => h && h.name);
    const total = hs.reduce((a, h) => a + (num(h.value) || num(h.units) * num(h.nav)), 0);
    const cost = hs.reduce((a, h) => a + num(h.cost), 0);
    const valWithCost = hs.filter((h) => num(h.cost) > 0).reduce((a, h) => a + (num(h.value) || num(h.units) * num(h.nav)), 0);
    const noCost = hs.filter((h) => !(num(h.cost) > 0)).length;
    const guess = (h) => { if (h.matches && funds.some((f) => f.id === h.matches)) return h.matches; const n = h.name.toLowerCase(); const f = funds.find((x) => x.name.toLowerCase() === n || n.includes(x.name.toLowerCase()) || x.name.toLowerCase().includes(n)); return f ? f.id : 'new'; };
    const rep = r.report || {};
    openSheet('📊 ' + (r.provider || 'Statement'), `
      ${r.standIn ? '<p class="warn small">TEST MODE: stand-in AI reply, not a real reading.</p>' : ''}
      <div class="stats3"><div><small>Value</small><b>${rm(total, { show: true })}</b></div><div><small>Cost shown</small><b>${cost ? rm(cost, { show: true }) : '–'}</b></div><div><small>Gain</small><b class="${plc(valWithCost - cost)}">${cost ? pct((valWithCost - cost) / cost) : '–'}</b>${cost && noCost ? '<small>' + noCost + ' fund' + (noCost > 1 ? 's' : '') + ' without cost not counted</small>' : ''}</div></div>
      <div class="report"><h4>AI report</h4><p>${esc(rep.summary || '')}</p>${(rep.points || []).length ? '<ul>' + rep.points.map((p) => '<li>' + esc(p) + '</li>').join('') + '</ul>' : ''}${(rep.check || []).length ? '<b>Worth checking</b><ul>' + rep.check.map((p) => '<li>' + esc(p) + '</li>').join('') + '</ul>' : ''}<small class="muted">Written by AI from your photos, for your own understanding — not financial advice. Check figures against the statement.</small></div>
      <h4>Funds found</h4>
      ${hs.map((h, i) => `<div class="card inset"><label class="row"><input type="checkbox" name="on_${i}" checked><span class="grow"><b>${esc(h.name)}</b><small>${esc(h.type || '')}</small></span></label>
        <div class="grid2">${fld('Units', inp('u_' + i, h.units == null ? '' : h.units, 'inputmode="decimal"'))}${fld('Price / NAV (RM)', inp('n_' + i, h.nav == null ? '' : h.nav, 'inputmode="decimal"'))}
        ${fld('Total cost (RM)', inp('c_' + i, h.cost == null ? '' : h.cost, 'inputmode="decimal" placeholder="not shown"'))}${fld('Save as', '<select name="m_' + i + '">' + opt([['new', '＋ New fund']].concat(funds.map((f) => [f.id, 'Update: ' + f.name])), guess(h)) + '</select>')}</div></div>`).join('') || '<p class="muted">No funds could be read. Try clearer photos.</p>'}`,
    (v) => {
      const date = /^\d{4}-\d\d-\d\d$/.test(r.statementDate || '') ? r.statementDate : C.today();
      let n = 0;
      hs.forEach((h, i) => {
        if (!v['on_' + i]) return;
        const units = num(v['u_' + i]), nav = num(v['n_' + i]);
        if (!(units > 0)) return;
        let f = v['m_' + i] !== 'new' ? state.holdings.find((x) => x.id === v['m_' + i]) : null;
        const oldCost = f ? C.position(f).cost : 0;
        const costTyped = v['c_' + i] !== '' ? C.r2(num(v['c_' + i])) : null;
        if (!f) { f = { id: C.uid(), kind: 'fund', name: h.name, lots: [] }; state.holdings.push(f); }
        f.lots = [{ id: C.uid(), type: 'buy', date, units, amount: costTyped != null ? costTyped : oldCost || C.r2(units * nav), note: 'From statement' }];
        if (nav > 0) { f.price = nav; f.priceCur = 'MYR'; f.priceAt = new Date().toISOString(); f.priceSrc = 'statement ' + dmy(h.navDate || date); }
        n++;
      });
      (state.reports = state.reports || []).push({ id: C.uid(), date, provider: r.provider || '', total: C.r2(total), cost: C.r2(cost), count: hs.length, summary: rep.summary || '', points: rep.points || [], check: rep.check || [] });
      save(); go('wealth'); render(); toast('Updated ' + n + ' fund' + (n === 1 ? '' : 's') + ' and saved the report'); setTimeout(() => refreshPrices(true), 1500);
    }, { saveText: 'Save' });
  }
  function viewReport(id) {
    const r = (state.reports || []).find((x) => x.id === id); if (!r) return;
    const text = ['📊 ' + (r.provider || 'Investment statement') + ' — ' + dmy(r.date), 'Value: RM ' + fmtN(r.total) + (r.cost ? ' · Cost shown: RM ' + fmtN(r.cost) : ''), '', r.summary].concat(r.points.map((p) => '• ' + p)).concat(r.check.length ? ['', 'Worth checking:'].concat(r.check.map((p) => '• ' + p)) : []).join('\n');
    openSheet('📊 Report ' + dmy(r.date), `<div class="report"><p>${esc(r.summary)}</p><ul>${r.points.map((p) => '<li>' + esc(p) + '</li>').join('')}</ul>${r.check.length ? '<b>Worth checking</b><ul>' + r.check.map((p) => '<li>' + esc(p) + '</li>').join('') + '</ul>' : ''}</div>
      <textarea class="copybox" readonly>${esc(text)}</textarea><div class="btnrow"><button type="button" class="btn danger" data-act="delReport" data-id="${r.id}">Delete report</button></div>`);
  }
  Object.assign(ACT, {
    editRule: (ds) => ruleForm(state.recurring.find((r) => r.id === ds.id)),
    delRule: (ds) => { if (!confirmBox('Delete this repeat? Records already added stay.')) return; state.recurring = state.recurring.filter((r) => r.id !== ds.id); save(); closeSheet(); render(); },
    balanceCheck: () => balanceCheck(),
    aiVoice: () => aiVoice(), micToggle: () => micToggle(), voiceRead: () => voiceRead(),
    aiReceipt: () => aiReceipt(), aiInvest: () => aiInvest(), investRead: () => investRead(),
    investRm: (ds) => { investPhotos.splice(Number(ds.i), 1); $('#invthumbs').innerHTML = investPhotos.map((s, i) => `<div class="thumb"><img src="${s}"><button type="button" data-act="investRm" data-i="${i}">✕</button></div>`).join(''); },
    viewReport: (ds) => viewReport(ds.id),
    delReport: (ds) => { if (!confirmBox('Delete this report?')) return; state.reports = state.reports.filter((r) => r.id !== ds.id); save(); closeSheet(); render(); },
  });
  Object.assign(CHANGE, { receiptPick: (el) => receiptPick(el), investPick: (el) => investPick(el), mktPick: (el) => mktPick(el) });

  // ---------- money sound ----------
  let actx = null;
  function cashSound(big) {
    if (!state || state.settings.sound === false) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const t0 = actx.currentTime, out = actx.createGain(); out.gain.value = 0.22; out.connect(actx.destination);
      const ping = (f, at, len, vol) => {
        [1, 2.76, 5.4].forEach((h, k) => {
          const o = actx.createOscillator(), g = actx.createGain();
          o.type = 'sine'; o.frequency.value = f * h;
          g.gain.setValueAtTime(0, t0 + at); g.gain.linearRampToValueAtTime(vol / (k + 1), t0 + at + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len / (k + 1));
          o.connect(g); g.connect(out); o.start(t0 + at); o.stop(t0 + at + len);
        });
      };
      ping(2093, 0, 0.35, 0.6); ping(2637, 0.07, 0.5, 0.5);
      if (big) { ping(3136, 0.16, 0.7, 0.45); ping(2349, 0.24, 0.6, 0.3); }
    } catch (e) {}
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button, .btn, .chip, .tabs a, .row[href]');
    if (b) cashSound(b.type === 'submit' || b.classList.contains('primary'));
  }, true);

  // ---------- sample data (made up) ----------
  function sampleData() {
    const s = S.blank(), t = C.today(), ym = t.slice(0, 7), m1 = C.addMonths(ym + '-01', -1).slice(0, 7), d = (ymx, day) => ymx + '-' + C.pad(day);
    s.settings.name = 'Sample';
    s.settings.targets.income = 180000;
    s.settings.budgets = { food: 1500, groceries: 800, transport: 600, fun: 400 };
    s.accounts = [{ id: 'a1', name: 'Maybank savings (sample)', type: 'bank', opening: 25000 }, { id: 'a2', name: 'TNG eWallet', type: 'ewallet', opening: 600 }, { id: 'a3', name: 'Credit card (sample)', type: 'card', opening: -1200 }, { id: 'cash', name: 'Cash', type: 'cash', opening: 400 }];
    const tx = (date, type, cat, amount, account, note, extra) => s.txns.push(Object.assign({ id: C.uid(), date, type, cat, amount, account, note }, extra || {}));
    [m1, ym].forEach((x, i) => {
      tx(d(x, 5), 'income', 'commission', 9800 + i * 1200, 'a1', 'Commission');
      tx(d(x, 6), 'income', 'override', 3200, 'a1', 'Override');
      tx(d(x, 1), 'expense', 'housing', 2100, 'a1', 'House loan instalment');
      tx(d(x, 3), 'expense', 'food', 86.5, 'a3', 'Client lunch');
      tx(d(x, 4), 'expense', 'groceries', 342.8, 'a3', 'Lotus’s');
      tx(d(x, 7), 'expense', 'transport', 180, 'a2', 'Petrol');
      tx(d(x, 9), 'expense', 'kids', 450, 'a1', 'Kindergarten', { relief: 'childcare' });
      tx(d(x, 10), 'expense', 'fitness', 150, 'a3', 'Gym membership', { relief: 'sports' });
    });
    tx(d(ym, 2), 'expense', 'phone', 3899, 'a3', 'New phone', { relief: 'lifestyle' });
    tx(d(ym, 2), 'expense', 'other', 4000, 'a1', 'EPF deducted (claim only)', { relief: 'epf', noCash: true });
    s.holdings = [
      { id: 'h1', kind: 'stock', name: 'Maybank', symbol: '1155.KL', lots: [{ id: 'l1', type: 'buy', date: '2024-03-01', units: 2000, amount: 19400 }] },
      { id: 'h2', kind: 'stock', name: 'Apple', symbol: 'AAPL', lots: [{ id: 'l2', type: 'buy', date: '2024-06-10', units: 10, amount: 9200 }] },
      { id: 'h3', kind: 'crypto', name: 'Bitcoin', coinId: 'bitcoin', lots: [{ id: 'l3', type: 'buy', date: '2023-11-01', units: 0.05, amount: 7500 }] },
      { id: 'h4', kind: 'gold', name: 'Gold savings', unit: 'g', lots: [{ id: 'l4', type: 'buy', date: '2024-01-15', units: 50, amount: 14500 }] },
      { id: 'h5', kind: 'fund', name: 'Sample equity fund', price: 1.0832, priceCur: 'MYR', priceSrc: 'typed by you', priceAt: new Date().toISOString(), lots: [{ id: 'l5', type: 'buy', date: '2023-05-01', units: 10000, amount: 9500 }] },
      { id: 'h6', kind: 'fd', name: 'FD 12 months', principal: 20000, rate: 3.6, start: C.addMonths(t, -5), maturity: C.addMonths(t, 7) },
      { id: 'h7', kind: 'epf', name: 'EPF Account 1 & 2', value: 186000, valueAt: d(m1, 28) },
      { id: 'h8', kind: 'property', name: 'Home (sample)', value: 650000, cost: 520000, valueAt: '2026-01-01' },
    ];
    s.loans = [
      { id: 'L1', name: 'House loan (sample)', kind: 'housing', method: 'reducing', principal: 470000, rate: 4.1, tenureMonths: 420, start: '2021-06-01' },
      { id: 'L2', name: 'Car HP (sample)', kind: 'car', method: 'flat', principal: 110000, rate: 2.6, tenureMonths: 108, start: '2023-02-01' },
    ];
    s.owed = [{ id: 'o1', dir: 'in', person: 'Ah Seng', amount: 1500, date: d(m1, 12), due: d(m1, 30), note: 'Lent for car repair', repaid: [{ date: d(ym, 1), amount: 500 }] }];
    s.policies = [
      { id: 'p1', insured: 'Me', insurer: 'Insurer A', plan: 'Whole life (sample)', type: 'life', status: 'active', premium: 450, mode: 'M', start: '2019-08-15', cover: { death: 500000, tpd: 500000, ci: 200000 }, relief: 'life', reliefAmount: 3000 },
      { id: 'p2', insured: 'Me', insurer: 'Insurer A', plan: 'Medical card (sample)', type: 'medical', status: 'active', premium: 250, mode: 'M', start: '2020-02-01', cover: { med: 1500000, room: 250 }, relief: 'medins' },
      { id: 'p3', insured: 'Daughter', insurer: 'Insurer A', plan: 'Child plan (sample)', type: 'medical', status: 'active', premium: 2400, mode: 'Y', start: '2023-04-20', cover: { med: 1000000, ci: 100000, death: 50000 }, relief: 'medins' },
    ];
    s.split.people = [{ id: 'f1', name: 'Ali' }, { id: 'f2', name: 'Mei' }, { id: 'f3', name: 'Raj' }];
    s.split.groups = [{
      id: 'g1', name: 'Friday steamboat', date: d(ym, 8), members: ['me', 'f1', 'f2', 'f3'], settlements: [{ from: 'f3', to: 'me', amount: 20, date: d(ym, 9) }],
      expenses: [
        { id: 'e1', title: 'Steamboat dinner', date: d(ym, 8), mode: 'items', paid: { me: 0 }, sc: 10, tax: 6, receiptTotal: '', items: [{ name: 'Set for 4', amount: 168, who: ['me', 'f1', 'f2', 'f3'] }, { name: 'Beer x3', amount: 54, who: ['me', 'f1', 'f3'] }, { name: 'Lime juice', amount: 7.9, who: ['f2'] }] },
        { id: 'e2', title: 'Grab home', date: d(ym, 8), mode: 'equal', total: 32, who: ['f1', 'f2'], paid: { f1: 32 } },
      ],
    }];
    s.split.groups[0].expenses[0].paid = { me: C.expenseTotalC(s.split.groups[0].expenses[0]) / 100 };
    return s;
  }

  // ---------- start ----------
  if (state) { const om = C.postOwedPlans(state); if (om.length) { save(true); setTimeout(() => toast('📅 Counted ' + om.length + ' monthly repayment' + (om.length > 1 ? 's' : '') + ' from people who owe you', 3500), 4200); } }
  if (state) { const made = C.postRecurring(state); if (made.length) { save(true); setTimeout(() => toast('🔁 Added ' + made.length + ' repeating record' + (made.length > 1 ? 's' : '') + ' due by today', 3500), 400); } }
  render();
  if (state && (!state.pricesAt || Date.now() - new Date(state.pricesAt) > 30 * 60000) && state.holdings.some((h) => C.LIVE_KINDS.includes(h.kind) || h.kind === 'fund')) refreshPrices(true);
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  // tidy receipt photos that no record uses any more
  if (state) setTimeout(async () => { try { const used = new Set(); state.txns.forEach((t) => (t.receipts || []).forEach((id) => used.add(id))); (await S.allImgKeys()).forEach((k) => { if (!used.has(k) && !(draftReceipts || []).includes(k)) S.delImg(k); }); } catch (e) {} }, 8000);
})();
