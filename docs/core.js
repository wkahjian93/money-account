/* Money Account core: pure money logic (no DOM). Works in browser (window.WBCore) and Node (require). */
(function (root) {
  const C = {};

  // ---------- basics ----------
  C.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  C.cents = (x) => Math.round((Number(x) || 0) * 100);
  C.r2 = (x) => Math.round((Number(x) || 0) * 100) / 100;
  C.pad = (n) => String(n).padStart(2, '0');
  C.iso = (d) => d.getFullYear() + '-' + C.pad(d.getMonth() + 1) + '-' + C.pad(d.getDate());
  C.today = () => C.iso(new Date());
  C.parse = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
  C.daysBetween = (a, b) => Math.round((C.parse(b) - C.parse(a)) / 86400000);
  C.monthsBetween = (a, b) => {
    const x = C.parse(a), y = C.parse(b);
    let m = (y.getFullYear() - x.getFullYear()) * 12 + (y.getMonth() - x.getMonth());
    if (y.getDate() < x.getDate()) m -= 1;
    return m;
  };
  C.addMonths = (s, n) => {
    const d = C.parse(s), day = d.getDate();
    const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
    const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
    t.setDate(Math.min(day, last));
    return C.iso(t);
  };

  // Split totalC (integer cents) by weights so the parts add up EXACTLY (largest remainder).
  C.allocate = (totalC, weights) => {
    const n = weights.length;
    if (!n) return [];
    let w = weights.map((x) => Math.max(0, Number(x) || 0));
    let sum = w.reduce((a, b) => a + b, 0);
    if (sum <= 0) { w = w.map(() => 1); sum = n; }
    const sign = totalC < 0 ? -1 : 1, T = Math.abs(totalC);
    const raw = w.map((x) => (T * x) / sum);
    const base = raw.map(Math.floor);
    let left = T - base.reduce((a, b) => a + b, 0);
    const order = raw.map((r, i) => [r - Math.floor(r), i]).filter(([, i]) => w[i] > 0)
      .sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    for (let k = 0; left > 0 && order.length; k++, left--) base[order[k % order.length][1]] += 1;
    return base.map((x) => x * sign);
  };

  // ---------- split bills (Splitwise style) ----------
  // exp: {total, paid:{pid:amt}, mode:'equal'|'exact'|'shares'|'percent'|'items', who:[pid], vals:{pid:n},
  //       items:[{name, amount, who:[pid]}], sc, tax, receiptTotal}
  C.expenseTotalC = (exp) => {
    if (exp.mode === 'items') {
      const sub = (exp.items || []).reduce((a, it) => a + C.cents(it.amount), 0);
      if (Number(exp.receiptTotal) > 0) return C.cents(exp.receiptTotal);
      return Math.round(sub * (1 + (Number(exp.sc) || 0) / 100) * (1 + (Number(exp.tax) || 0) / 100));
    }
    return C.cents(exp.total);
  };

  C.splitShares = (exp, members) => {
    const totalC = C.expenseTotalC(exp);
    const owe = {}; members.forEach((p) => (owe[p] = 0));
    let error = '';
    const mode = exp.mode || 'equal';
    if (mode === 'equal') {
      const who = (exp.who && exp.who.length ? exp.who : members).filter((p) => members.includes(p));
      if (!who.length) error = 'Pick at least one person';
      else C.allocate(totalC, who.map(() => 1)).forEach((c, i) => (owe[who[i]] += c));
    } else if (mode === 'exact') {
      let s = 0;
      members.forEach((p) => { const c = C.cents((exp.vals || {})[p]); owe[p] = c; s += c; });
      if (s !== totalC) error = 'Amounts add up to ' + (s / 100).toFixed(2) + ', bill is ' + (totalC / 100).toFixed(2);
    } else if (mode === 'shares' || mode === 'percent') {
      const w = members.map((p) => Number((exp.vals || {})[p]) || 0);
      const s = w.reduce((a, b) => a + b, 0);
      if (s <= 0) error = 'Enter shares for at least one person';
      else if (mode === 'percent' && Math.abs(s - 100) > 0.001) error = 'Percentages add up to ' + C.r2(s) + '%, need 100%';
      else C.allocate(totalC, w).forEach((c, i) => (owe[members[i]] = c));
    } else if (mode === 'items') {
      const sub = {}; members.forEach((p) => (sub[p] = 0));
      (exp.items || []).forEach((it, k) => {
        const who = (it.who || []).filter((p) => members.includes(p));
        if (!who.length) { if (C.cents(it.amount)) error = 'Item "' + (it.name || '#' + (k + 1)) + '" has nobody ticked'; return; }
        C.allocate(C.cents(it.amount), who.map(() => 1)).forEach((c, i) => (sub[who[i]] += c));
      });
      if (!error) C.allocate(totalC, members.map((p) => sub[p])).forEach((c, i) => (owe[members[i]] = c));
      // allocate() with all-zero weights splits equally; avoid that when nothing was assigned
      if (members.every((p) => !sub[p])) members.forEach((p) => (owe[p] = 0));
    }
    // payers
    const paid = {}; members.forEach((p) => (paid[p] = 0));
    const P = exp.paid || {};
    let ps = 0; Object.keys(P).forEach((p) => { if (p in paid) { paid[p] = C.cents(P[p]); ps += paid[p]; } });
    const payers = Object.keys(P).filter((p) => p in paid);
    if (payers.length === 1) { paid[payers[0]] = totalC; ps = totalC; }
    if (!error && ps !== totalC) error = 'Paid amounts add up to ' + (ps / 100).toFixed(2) + ', bill is ' + (totalC / 100).toFixed(2);
    return { totalC, owe, paid, error };
  };

  // net > 0: group owes this person; net < 0: this person owes the group
  C.groupBalances = (g) => {
    const members = g.members || [];
    const net = {}, paid = {}, share = {};
    members.forEach((p) => { net[p] = 0; paid[p] = 0; share[p] = 0; });
    let total = 0; const errors = [];
    (g.expenses || []).forEach((e) => {
      const r = C.splitShares(e, members);
      if (r.error) { errors.push({ id: e.id, title: e.title, error: r.error }); return; }
      total += r.totalC;
      members.forEach((p) => { paid[p] += r.paid[p]; share[p] += r.owe[p]; net[p] += r.paid[p] - r.owe[p]; });
    });
    (g.settlements || []).forEach((s) => {
      const c = C.cents(s.amount);
      if (s.from in net) net[s.from] += c;
      if (s.to in net) net[s.to] -= c;
    });
    return { net, paid, share, total, errors };
  };

  // fewest transfers (greedy, biggest debtor pays biggest creditor)
  C.simplify = (net) => {
    const cr = [], db = [];
    Object.keys(net).forEach((p) => { if (net[p] > 0) cr.push([p, net[p]]); else if (net[p] < 0) db.push([p, -net[p]]); });
    const out = [];
    while (cr.length && db.length) {
      cr.sort((a, b) => b[1] - a[1]); db.sort((a, b) => b[1] - a[1]);
      const c = cr[0], d = db[0], x = Math.min(c[1], d[1]);
      out.push({ from: d[0], to: c[0], c: x });
      c[1] -= x; d[1] -= x;
      if (!c[1]) cr.shift(); if (!d[1]) db.shift();
    }
    return out;
  };

  // ---------- loans ----------
  // loan: {principal, rate (% p.a.), tenureMonths, start, method:'reducing'|'flat', monthly?, balanceOverride?, balanceAt?}
  C.loanStatus = (L, today) => {
    today = today || C.today();
    const P = Number(L.principal) || 0, n = Math.max(1, Math.round(Number(L.tenureMonths) || 1));
    const rate = Number(L.rate) || 0;
    const k = Math.max(0, Math.min(n, L.start ? C.monthsBetween(L.start, today) : 0));
    let monthly, balance, payable, interestTotal;
    if (L.method === 'flat') {
      interestTotal = P * rate / 100 * (n / 12);
      monthly = (P + interestTotal) / n;
      const m = n - k;
      payable = monthly * m;
      const intLeft = interestTotal * (m * (m + 1)) / (n * (n + 1)); // Rule of 78
      balance = payable - intLeft;
    } else {
      const r = rate / 1200;
      monthly = r ? P * r / (1 - Math.pow(1 + r, -n)) : P / n;
      balance = r ? P * Math.pow(1 + r, k) - monthly * (Math.pow(1 + r, k) - 1) / r : P - monthly * k;
      payable = monthly * (n - k);
      interestTotal = monthly * n - P;
    }
    if (Number(L.monthly) > 0) monthly = Number(L.monthly);
    let fromStatement = false;
    if (L.balanceOverride !== undefined && L.balanceOverride !== '' && L.balanceOverride !== null) {
      balance = Number(L.balanceOverride) || 0; fromStatement = true;
    }
    balance = Math.max(0, balance);
    return {
      monthly: C.r2(monthly), paidMonths: k, leftMonths: n - k, balance: C.r2(balance), payable: C.r2(Math.max(0, payable)),
      interestTotal: C.r2(interestTotal), endDate: L.start ? C.addMonths(L.start, n) : '', progress: k / n, fromStatement, done: k >= n,
    };
  };

  // ---------- investments ----------
  C.position = (h) => {
    let units = 0, cost = 0, realized = 0, income = 0;
    (h.lots || []).slice().sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach((l) => {
      const u = Number(l.units) || 0, amt = Number(l.amount) || 0;
      if (l.type === 'sell') {
        const avg = units ? cost / units : 0;
        const take = Math.min(u, units);
        cost -= avg * take; units -= take; realized += amt - avg * take;
      } else if (l.type === 'div') income += amt;
      else { units += u; cost += amt; }
    });
    return { units, cost: C.r2(cost), realized: C.r2(realized), income: C.r2(income) };
  };

  C.LIVE_KINDS = ['stock', 'crypto', 'gold'];
  // fx: {RATE: units of currency per 1 MYR}
  C.toMYR = (amount, cur, fx) => {
    if (!cur || cur === 'MYR') return amount;
    const r = fx && fx.rates && fx.rates[cur];
    return r ? amount / r : NaN;
  };
  C.holdingValue = (h, fx, today) => {
    today = today || C.today();
    if (h.kind === 'fd') {
      const P = Number(h.principal) || 0;
      const end = h.maturity && h.maturity < today ? h.maturity : today;
      const days = h.start ? Math.max(0, C.daysBetween(h.start, end)) : 0;
      const value = P * (1 + (Number(h.rate) || 0) / 100 * days / 365);
      return { value: C.r2(value), cost: P, pl: C.r2(value - P), units: 0, live: false, matured: !!(h.maturity && h.maturity <= today) };
    }
    if (C.LIVE_KINDS.includes(h.kind) || (h.kind === 'fund' && h.lots && h.lots.length)) {
      const pos = C.position(h);
      const px = Number(h.price);
      let value = px > 0 ? C.toMYR(pos.units * px, h.priceCur || 'MYR', fx) : NaN;
      if (!(value >= 0)) value = pos.cost; // no price yet: show at cost
      return { value: C.r2(value), cost: pos.cost, pl: C.r2(value - pos.cost), units: pos.units, realized: pos.realized, income: pos.income, live: px > 0 };
    }
    const base = Number(h.value) || 0, cost = Number(h.cost) || 0, g = Number(h.growth) || 0;
    const days = g && h.valueAt ? Math.max(0, C.daysBetween(h.valueAt, today)) : 0;
    const value = g ? base * Math.pow(1 + g / 100, days / 365) : base;
    return { value: C.r2(value), cost: C.r2(cost), pl: C.r2(cost ? value - cost : 0), units: 0, live: false, estimated: !!(g && days) };
  };

  // ---------- accounts / records ----------
  C.accountBalances = (state) => {
    const bal = {};
    (state.accounts || []).forEach((a) => (bal[a.id] = C.cents(a.opening)));
    (state.txns || []).forEach((t) => {
      if (t.noCash) return;
      const c = C.cents(t.amount);
      if (t.type === 'income' && t.account in bal) bal[t.account] += c;
      else if (t.type === 'expense' && t.account in bal) bal[t.account] -= c;
      else if (t.type === 'transfer') { if (t.account in bal) bal[t.account] -= c; if (t.toAccount in bal) bal[t.toAccount] += c; }
    });
    Object.keys(bal).forEach((k) => (bal[k] /= 100));
    return bal;
  };

  C.monthStats = (txns, ym) => {
    const r = { income: 0, expense: 0, byCat: {}, incByCat: {} };
    txns.forEach((t) => {
      if (t.noCash || !t.date || t.date.slice(0, 7) !== ym) return;
      const c = C.cents(t.amount);
      if (t.type === 'income') { r.income += c; r.incByCat[t.cat] = (r.incByCat[t.cat] || 0) + c; }
      if (t.type === 'expense') { r.expense += c; r.byCat[t.cat] = (r.byCat[t.cat] || 0) + c; }
    });
    r.income /= 100; r.expense /= 100;
    Object.keys(r.byCat).forEach((k) => (r.byCat[k] /= 100));
    Object.keys(r.incByCat).forEach((k) => (r.incByCat[k] /= 100));
    r.saved = C.r2(r.income - r.expense);
    r.rate = r.income > 0 ? r.saved / r.income : null;
    return r;
  };

  // ---------- repeating income / expenses ----------
  // rule: {id, type, amount, cat, account, toAccount, note, relief, every (months: 1,2,3,6,12), start, end?, lastPosted, paused}
  C.EVERY = { 1: 'Every month', 2: 'Every 2 months', 3: 'Every 3 months (quarterly)', 6: 'Every 6 months (half-yearly)', 12: 'Every year' };
  C.ruleDates = (rule, upto) => {
    const out = []; const every = Number(rule.every) || 1;
    if (!rule.start) return out;
    for (let i = 0; i < 1200; i++) {
      const d = C.addMonths(rule.start, every * i);
      if (d > upto || (rule.end && d > rule.end)) break;
      out.push(d);
    }
    return out;
  };
  C.nextRuleDate = (rule) => {
    const every = Number(rule.every) || 1;
    for (let i = 0; i < 1200; i++) {
      const d = C.addMonths(rule.start, every * i);
      if (rule.end && d > rule.end) return '';
      if (d > (rule.lastPosted || '')) return d;
    }
    return '';
  };
  // Adds every due record up to today that was not added yet. Returns the new records.
  C.postRecurring = (state, today, uid) => {
    today = today || C.today(); uid = uid || C.uid;
    const made = [];
    (state.recurring || []).forEach((r) => {
      if (r.paused) return;
      C.ruleDates(r, today).forEach((d) => {
        if (r.lastPosted && d <= r.lastPosted) return;
        const t = { id: uid(), at: new Date().toISOString(), date: d, type: r.type, amount: r.amount, cat: r.cat, account: r.account, note: r.note, recur: r.id };
        if (r.toAccount) t.toAccount = r.toAccount;
        if (r.relief) t.relief = r.relief;
        (state.txns = state.txns || []).push(t); made.push(t);
        r.lastPosted = d;
      });
    });
    return made;
  };

  // ---------- accounts & reports ----------
  // Bookkeeping view of one account (asset): Debit = money in, Credit = money out.
  C.ledger = (state, accId, from, to) => {
    const acc = (state.accounts || []).find((a) => a.id === accId) || {};
    let bal = C.cents(acc.opening);
    const rows = [];
    const list = (state.txns || []).filter((t) => !t.noCash && (t.account === accId || t.toAccount === accId))
      .slice().sort((a, b) => (a.date + (a.at || '')).localeCompare(b.date + (b.at || '')));
    let opening = null;
    list.forEach((t) => {
      const c = C.cents(t.amount);
      let dr = 0, cr = 0;
      if (t.type === 'income') dr = c;
      else if (t.type === 'expense') cr = c;
      else if (t.type === 'transfer') { if (t.toAccount === accId) dr = c; else cr = c; }
      if (from && t.date < from) { bal += dr - cr; return; }
      if (opening === null) opening = bal;
      if (to && t.date > to) return;
      bal += dr - cr;
      rows.push({ id: t.id, date: t.date, t, debit: dr / 100, credit: cr / 100, balance: bal / 100 });
    });
    if (opening === null) opening = bal;
    const totals = rows.reduce((a, r) => { a.debit += r.debit; a.credit += r.credit; return a; }, { debit: 0, credit: 0 });
    return { opening: opening / 100, rows, closing: rows.length ? rows[rows.length - 1].balance : opening / 100, debit: C.r2(totals.debit), credit: C.r2(totals.credit) };
  };

  C.pnl = (state, from, to) => {
    const inc = {}, exp = {};
    let ti = 0, te = 0;
    (state.txns || []).forEach((t) => {
      if (t.noCash || !t.date || t.date < from || t.date > to) return;
      const c = C.cents(t.amount);
      if (t.type === 'income') { inc[t.cat] = (inc[t.cat] || 0) + c; ti += c; }
      if (t.type === 'expense') { exp[t.cat] = (exp[t.cat] || 0) + c; te += c; }
    });
    const f = (o) => Object.keys(o).map((k) => [k, o[k] / 100]).sort((a, b) => b[1] - a[1]);
    return { income: f(inc), expense: f(exp), totalIncome: ti / 100, totalExpense: te / 100, net: (ti - te) / 100 };
  };

  // Malaysian tax grouping of income categories (a guide for the user's accountant, who decides)
  C.TAX_CLASS = {
    commission: ['biz', 'Business income — agency commission (s.4(a))'], override: ['biz', 'Business income — agency commission (s.4(a))'],
    bonus: ['biz', 'Business income — agency commission (s.4(a))'], allowance: ['biz', 'Business income — agency commission (s.4(a))'],
    side: ['biz', 'Business income — agency commission (s.4(a))'],
    salary: ['emp', 'Employment income (s.4(b))'], dividend: ['div', 'Dividends, interest, discounts (s.4(c))'], interest: ['div', 'Dividends, interest, discounts (s.4(c))'],
    rental: ['rent', 'Rental income (s.4(d))'], other: ['other', 'Other income'],
  };
  C.taxPack = (state, year) => {
    const y = String(year), groups = {}, biz = {}, notTax = [];
    let bizTotal = 0;
    (state.txns || []).forEach((t) => {
      if (!t.date || t.date.slice(0, 4) !== y) return;
      if (t.type === 'income') {
        if (t.notTaxable || t.cat === 'gift' || t.cat === 'refund') { notTax.push(t); return; }
        const cl = C.TAX_CLASS[t.cat] || C.TAX_CLASS.other;
        const g = groups[cl[0]] || (groups[cl[0]] = { label: cl[1], total: 0, items: [] });
        g.total += Number(t.amount) || 0; g.items.push(t);
      }
      if (t.type === 'expense' && t.biz) { biz[t.cat] = (biz[t.cat] || 0) + (Number(t.amount) || 0); bizTotal += Number(t.amount) || 0; }
    });
    Object.values(groups).forEach((g) => (g.total = C.r2(g.total)));
    return { groups, biz: Object.keys(biz).map((k) => [k, C.r2(biz[k])]).sort((a, b) => b[1] - a[1]), bizTotal: C.r2(bizTotal), notTax, relief: C.taxSummary(state, year) };
  };

  C.csv = (rows) => '﻿' + rows.map((r) => r.map((x) => { const s = x == null ? '' : String(x); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\r\n');

  // ---------- simple offline reader for spoken / typed notes (used when no AI server) ----------
  const KW = [
    ['income', 'commission', /komisen|commission|佣金/i], ['income', 'override', /override/i], ['income', 'salary', /gaji|salary|薪水|工资/i],
    ['income', 'bonus', /bonus|花红|奖金/i], ['income', 'dividend', /dividen|dividend|股息/i], ['income', 'rental', /sewa|rental|租金/i],
    ['expense', 'transport', /minyak|petrol|打油|油钱|grab|toll|tol|parking|泊车|打车|lrt|mrt|bus/i], ['expense', 'food', /makan|tapau|打包|lunch|dinner|breakfast|吃|饭|早餐|午餐|晚餐|宵夜|kopi|coffee|mamak|teh|drink|minum|yum ?cha|饮茶/i],
    ['expense', 'groceries', /grocer|pasar|巴刹|杂货|barang dapur|lotus|giant|aeon|mydin|jaya grocer/i], ['expense', 'bills', /bil|bill|electric|tnb|水电|air|water/i],
    ['expense', 'phone', /unifi|maxis|celcom|digi|astro|internet|上网|phone bill/i], ['expense', 'shopping', /shopee|lazada|shopping|baju|kasut|衣服/i],
    ['expense', 'health', /klinik|clinic|doctor|医生|ubat|medicine|pharmacy|farmasi/i], ['expense', 'insurance', /premium|insurans|保险/i],
    ['expense', 'parents', /mak|ayah|妈|爸|parents|家用/i], ['expense', 'kids', /anak|baby|daughter|son|女儿|儿子|tadika|kindergarten/i],
    ['expense', 'fun', /movie|wayang|wayang|netflix|karaoke|ktv|game/i], ['expense', 'fitness', /gym|健身/i], ['expense', 'gifts', /angpau|angpow|红包|gift|hadiah|donat|derma/i],
  ];
  const CN = { '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };
  function cnNum(s) { // 一百五 → 150, 三千五 → 3500, 两百 → 200
    let total = 0, cur = 0, lastUnit = 1;
    for (const ch of s) {
      if (ch in CN && ch !== '十') cur = CN[ch];
      else if (ch === '十') { total += (cur || 1) * 10; cur = 0; lastUnit = 10; }
      else if (ch === '百') { total += cur * 100; cur = 0; lastUnit = 100; }
      else if (ch === '千') { total += cur * 1000; cur = 0; lastUnit = 1000; }
      else if (ch === '万') { total = (total + cur) * 10000; cur = 0; lastUnit = 10000; }
    }
    return total + (cur ? (lastUnit >= 100 ? cur * lastUnit / 10 : cur) : 0);
  }
  C.parseSpoken = (text, today) => {
    today = today || C.today();
    const out = [];
    String(text || '').split(/[,，;；。\n]|\band\b|\bdan\b|\blepas tu\b|\bthen\b|然后|还有/i).forEach((part) => {
      const p = part.trim(); if (!p) return;
      let amount = null;
      const m = p.match(/(\d+(?:[.,]\d+)?)\s*(k|K|千)(\d)?/) ;
      if (m) amount = parseFloat(m[1].replace(',', '.')) * 1000 + (m[3] ? Number(m[3]) * 100 : 0);
      else { const n = p.match(/(?:rm\s*)?(\d+(?:\.\d{1,2})?)/i); if (n) amount = parseFloat(n[1]); }
      if (amount == null) { const c = p.match(/[一二两三四五六七八九十百千万]{2,}/); if (c) amount = cnNum(c[0]); }
      if (!(amount > 0)) return;
      let type = 'expense', cat = 'other';
      for (const [t, c, re] of KW) if (re.test(p)) { type = t; cat = c; break; }
      if (/tinggal|baki|balance|剩|left/i.test(p)) type = 'balance';
      else if (/masuk|dapat|received|收到|入账|got\b/i.test(p) && type === 'expense' && cat === 'other') { type = 'income'; cat = 'other'; }
      let date = today;
      if (/kelmarin|前天|day before yesterday/i.test(p)) date = C.iso(new Date(C.parse(today) - 2 * 864e5));
      else if (/semalam|昨天|yesterday|ytd/i.test(p)) date = C.iso(new Date(C.parse(today) - 864e5));
      out.push({ type, amount: C.r2(amount), date, cat: type === 'balance' ? '' : cat, note: p.replace(/\s+/g, ' ').slice(0, 60) });
    });
    return out;
  };

  // ---------- insurance ----------
  C.MODE_PER_YEAR = { M: 12, Q: 4, H: 2, Y: 1 };
  C.annualPremium = (p) => (Number(p.premium) || 0) * (C.MODE_PER_YEAR[p.mode] || 1);
  C.COVERS = [
    ['death', 'Death'], ['tpd', 'TPD'], ['ci', 'Critical illness'], ['eci', 'Early CI'],
    ['med', 'Medical (annual limit)'], ['room', 'Room & board / day'], ['pa', 'Accident'], ['hi', 'Hospital income / day'],
  ];
  C.coverage = (policies, today) => {
    today = today || C.today();
    const by = {};
    (policies || []).forEach((p) => {
      if (p.status === 'lapsed' || p.status === 'ended' || (p.end && p.end < today)) return;
      const who = (p.insured || 'Me').trim() || 'Me';
      const o = by[who] || (by[who] = { premium: 0, count: 0 });
      o.premium += C.annualPremium(p); o.count++;
      C.COVERS.forEach(([k]) => (o[k] = (o[k] || 0) + (Number((p.cover || {})[k]) || 0)));
    });
    return by;
  };
  C.nextDue = (p, today) => {
    today = today || C.today();
    if (!p.start) return '';
    const step = 12 / (C.MODE_PER_YEAR[p.mode] || 1);
    let d = p.start, i = 0;
    while (d < today && i < 2000) { i++; d = C.addMonths(p.start, step * i); }
    return d;
  };

  // ---------- tax relief (Malaysia) ----------
  // Defaults are YA2025 limits as published by LHDN. Users must check the current year and can edit them.
  C.RELIEFS = [
    { id: 'self', name: 'Individual & dependent relatives', limit: 9000, kind: 'auto' },
    { id: 'parents', name: 'Parents: medical, care, dental, full medical exam', limit: 8000 },
    { id: 'disEquip', name: 'Supporting equipment for disabled self/family', limit: 6000 },
    { id: 'disSelf', name: 'Disabled individual', limit: 7000, kind: 'flag' },
    { id: 'edu', name: 'Education fees (self), incl. upskilling', limit: 7000 },
    { id: 'medical', name: 'Medical: serious illness, fertility, vaccination, dental, check-up, mental health, child learning disability', limit: 10000 },
    { id: 'lifestyle', name: 'Lifestyle: books, phone, PC, tablet, internet, courses', limit: 2500 },
    { id: 'sports', name: 'Sports: equipment, gym, facility, competition fees', limit: 1000 },
    { id: 'breastfeed', name: 'Breastfeeding equipment', limit: 1000 },
    { id: 'childcare', name: 'Childcare / kindergarten fees', limit: 3000 },
    { id: 'sspn', name: 'SSPN net deposit', limit: 8000 },
    { id: 'spouse', name: 'Spouse (no income) / alimony', limit: 4000, kind: 'flag' },
    { id: 'disSpouse', name: 'Disabled spouse', limit: 6000, kind: 'flag' },
    { id: 'child', name: 'Child under 18 (per child)', limit: 2000, kind: 'count' },
    { id: 'child18', name: 'Child 18+ in diploma/degree (per child)', limit: 8000, kind: 'count' },
    { id: 'disChild', name: 'Disabled child (per child)', limit: 8000, kind: 'count' },
    { id: 'epf', name: 'EPF contributions', limit: 4000 },
    { id: 'life', name: 'Life insurance / family takaful', limit: 3000 },
    { id: 'prs', name: 'PRS & deferred annuity', limit: 3000 },
    { id: 'medins', name: 'Education & medical insurance', limit: 4000 },
    { id: 'socso', name: 'SOCSO / EIS', limit: 350 },
    { id: 'ev', name: 'EV charging / food-waste composting', limit: 2500 },
    { id: 'housing', name: 'Housing loan interest (first home, SPA 2025-2027)', limit: 7000 },
  ];
  C.TAX_BANDS = [ // chargeable income band upper limits and rates (YA2023 onwards)
    [5000, 0], [20000, 1], [35000, 3], [50000, 6], [70000, 11], [100000, 19], [400000, 25], [600000, 26], [2000000, 28], [Infinity, 30],
  ];
  C.incomeTax = (chargeable) => {
    let tax = 0, prev = 0, marginal = 0;
    for (const [top, rate] of C.TAX_BANDS) {
      if (chargeable > prev) { tax += (Math.min(chargeable, top) - prev) * rate / 100; marginal = rate; }
      prev = top;
    }
    const rebate = chargeable > 0 && chargeable <= 35000 ? Math.min(400, tax) : 0;
    return { tax: C.r2(tax - rebate), gross: C.r2(tax), rebate, marginal };
  };

  C.reliefList = (settings) => {
    const o = (settings && settings.reliefLimits) || {};
    return C.RELIEFS.map((r) => Object.assign({}, r, o[r.id] !== undefined ? { limit: Number(o[r.id]) } : {}));
  };

  C.taxSummary = (state, year) => {
    const s = state.settings || {};
    const ty = (s.tax && s.tax[year]) || {};
    const list = C.reliefList(s);
    const claimed = {}, items = {};
    list.forEach((r) => { claimed[r.id] = 0; items[r.id] = []; });
    (state.txns || []).forEach((t) => {
      if (!t.relief || !(t.relief in claimed) || !t.date || t.date.slice(0, 4) !== String(year)) return;
      claimed[t.relief] += Number(t.amount) || 0; items[t.relief].push(t);
    });
    if (s.autoInsRelief !== false) {
      (state.policies || []).forEach((p) => {
        if (!p.relief || !(p.relief in claimed) || p.status === 'lapsed' || p.status === 'ended') return;
        if (p.start && p.start.slice(0, 4) > String(year)) return;
        const amt = Number(p.reliefAmount) > 0 ? Number(p.reliefAmount) : C.annualPremium(p);
        claimed[p.relief] += amt; items[p.relief].push({ policy: p.id, amount: amt, note: (p.plan || 'Policy') + ' (' + (p.insured || 'Me') + ')' });
      });
    }
    let total = 0;
    const rows = list.map((r) => {
      let amount;
      if (r.kind === 'auto') amount = r.limit;
      else if (r.kind === 'flag') amount = ty[r.id] ? r.limit : 0;
      else if (r.kind === 'count') amount = (Number(ty[r.id]) || 0) * r.limit;
      else amount = Math.min(claimed[r.id], r.limit);
      total += amount;
      return Object.assign({}, r, { claimed: C.r2(r.kind ? amount : claimed[r.id]), allowed: C.r2(amount), items: items[r.id], count: Number(ty[r.id]) || 0, on: !!ty[r.id] });
    });
    let income = Number(ty.income);
    const incomeFromRecords = (state.txns || []).filter((t) => t.type === 'income' && !t.notTaxable && (t.date || '').slice(0, 4) === String(year))
      .reduce((a, t) => a + (Number(t.amount) || 0), 0);
    if (!(income > 0)) income = incomeFromRecords;
    const bizFromRecords = (state.txns || []).filter((t) => t.type === 'expense' && t.biz && (t.date || '').slice(0, 4) === String(year)).reduce((a, t) => a + (Number(t.amount) || 0), 0);
    const expenses = Number(ty.businessExp) > 0 ? Number(ty.businessExp) : C.r2(bizFromRecords);
    const chargeable = Math.max(0, income - expenses - total);
    const t = C.incomeTax(chargeable);
    const noRelief = C.incomeTax(Math.max(0, income - expenses - 9000));
    return { rows, total: C.r2(total), income: C.r2(income), incomeFromRecords: C.r2(incomeFromRecords), expenses, bizFromRecords: C.r2(bizFromRecords), chargeable: C.r2(chargeable), tax: t, saved: C.r2(noRelief.tax - t.tax) };
  };

  // ---------- net worth ----------
  C.summary = (state, today) => {
    today = today || C.today();
    const fx = state.fx || {};
    const bal = C.accountBalances(state);
    let cash = 0, cardDebt = 0;
    const cashBy = { bank: 0, cash: 0, ewallet: 0, other: 0 };
    (state.accounts || []).forEach((a) => { if (a.archived) return; const b = bal[a.id] || 0; if (b >= 0) { cash += b; const k = a.type in cashBy ? a.type : 'other'; cashBy[k] += b; } else cardDebt += -b; });
    let invest = 0, investCost = 0, property = 0, retire = 0;
    const byKind = {};
    (state.holdings || []).forEach((h) => {
      if (h.archived) return;
      const v = C.holdingValue(h, fx, today);
      byKind[h.kind] = (byKind[h.kind] || 0) + v.value;
      if (h.kind === 'property') property += v.value;
      else if (h.kind === 'epf') retire += v.value;
      else { invest += v.value; investCost += v.cost; }
    });
    let owedToMe = 0, iOwe = 0;
    (state.owed || []).forEach((o) => {
      const left = C.owedLeft(o);
      if (o.dir === 'out') iOwe += left; else owedToMe += left;
    });
    let splitIn = 0, splitOut = 0;
    ((state.split || {}).groups || []).forEach((g) => {
      const n = C.groupBalances(g).net.me || 0;
      if (n > 0) splitIn += n / 100; else splitOut += -n / 100;
    });
    let insCash = 0; (state.policies || []).forEach((p) => { if (p.status !== 'lapsed' && p.status !== 'ended') insCash += Number(p.cashValue) || 0; });
    let loans = 0; (state.loans || []).forEach((l) => { if (!l.archived) loans += C.loanStatus(l, today).balance; });
    const assets = cash + invest + property + retire + owedToMe + splitIn + insCash;
    // Liquidity: money usable now / investments you can sell within days / long-term or locked
    const liquid = cash, sellable = invest, longTerm = property + retire + insCash + owedToMe + splitIn;
    const liabilities = loans + cardDebt + iOwe + splitOut;
    return {
      cash: C.r2(cash), cardDebt: C.r2(cardDebt), invest: C.r2(invest), investCost: C.r2(investCost), investPL: C.r2(invest - investCost),
      property: C.r2(property), retire: C.r2(retire), owedToMe: C.r2(owedToMe), iOwe: C.r2(iOwe), splitIn: C.r2(splitIn), splitOut: C.r2(splitOut),
      insCash: C.r2(insCash), loans: C.r2(loans), assets: C.r2(assets), cashBy: { bank: C.r2(cashBy.bank), cash: C.r2(cashBy.cash), ewallet: C.r2(cashBy.ewallet), other: C.r2(cashBy.other) }, liquid: C.r2(liquid), sellable: C.r2(sellable), longTerm: C.r2(longTerm), liabilities: C.r2(liabilities), netWorth: C.r2(assets - liabilities), byKind,
    };
  };
  // Monthly repayment plan: o.plan = { amount, start (first payment date), auto (reduce by itself), posted (last due date handled) }
  C.owedPlanDue = (o, today) => {
    const p = o.plan, out = [];
    if (!p || !(Number(p.amount) > 0) || !p.start) return out;
    for (let i = 0; i < 600; i++) { const d = C.addMonths(p.start, i); if (d > (today || C.today())) break; if (p.posted && d <= p.posted) continue; out.push(d); }
    return out;
  };
  C.owedPlanInfo = (o, today) => {
    const p = o.plan, left = C.owedLeft(o);
    if (!p || !(Number(p.amount) > 0) || !p.start || left <= 0) return null;
    let next = p.start, i = 0;
    while (p.posted && next <= p.posted && i < 600) next = C.addMonths(p.start, ++i);
    const months = Math.ceil(C.r2(left / Number(p.amount)) - 1e-9);
    return { next, months, finish: C.addMonths(next, months - 1), last: C.r2(left - (months - 1) * Number(p.amount)) };
  };
  // Auto plans: record each repayment due by today. Returns [{o, date, amount}].
  C.postOwedPlans = (state, today) => {
    const made = [];
    (state.owed || []).forEach((o) => {
      if (!o.plan || !o.plan.auto) return;
      C.owedPlanDue(o, today).forEach((d) => {
        const left = C.owedLeft(o); if (left <= 0) return;
        const amount = C.r2(Math.min(Number(o.plan.amount), left));
        (o.repaid = o.repaid || []).push({ date: d, amount, plan: true }); o.plan.posted = d; made.push({ o, date: d, amount });
      });
    });
    return made;
  };
  // Property market value from comparable sales / listings read off screenshots.
  // items: [{kind:'sold'|'asking', date, price, size (sq ft), psf, use:false to skip}]. Sold prices are used first.
  const quant = (sorted, q) => { if (!sorted.length) return NaN; const p = (sorted.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p); return sorted[lo] + (sorted[hi] - sorted[lo]) * (p - lo); };
  C.marketValue = (items, builtUp, today) => {
    today = today || C.today();
    const cut = C.addMonths(today, -24);
    const rows = (items || []).map((x, i) => {
      const size = Number(x.size) || 0, price = Number(x.price) || 0;
      const psf = Number(x.psf) > 0 ? Number(x.psf) : size > 0 && price > 0 ? price / size : 0;
      return { i, kind: x.kind === 'asking' ? 'asking' : 'sold', date: x.date || '', size, price, psf };
    }).filter((r, k) => r.psf > 0 && (items[k].use !== false));
    const recent = rows.filter((r) => r.kind === 'asking' || !r.date || r.date >= cut);
    const sold = recent.filter((r) => r.kind === 'sold'), asking = recent.filter((r) => r.kind === 'asking');
    const basis = sold.length ? 'sold' : asking.length ? 'asking' : null;
    if (!basis) return { basis: null, n: 0 };
    let pool = basis === 'sold' ? sold : asking;
    const size = Number(builtUp) || 0;
    if (size) { const near = pool.filter((r) => r.size && Math.abs(r.size - size) / size <= 0.3); if (near.length >= 3) pool = near; }
    const ps = pool.map((r) => r.psf).sort((a, b) => a - b);
    const med = quant(ps, 0.5), lo = quant(ps, 0.25), hi = quant(ps, 0.75);
    const round = (v) => Math.round(v / 1000) * 1000;
    const askMed = asking.length ? quant(asking.map((r) => r.psf).sort((a, b) => a - b), 0.5) : null;
    return {
      basis, n: pool.length, used: pool.map((r) => r.i), psf: C.r2(med), psfLow: C.r2(lo), psfHigh: C.r2(hi),
      value: size ? round(med * size) : null, low: size ? round(lo * size) : null, high: size ? round(hi * size) : null,
      soldN: sold.length, askingN: asking.length, askingPsf: askMed == null ? null : C.r2(askMed),
    };
  };
  C.owedLeft = (o) => C.r2(Math.max(0, (Number(o.amount) || 0) - (o.repaid || []).reduce((a, r) => a + (Number(r.amount) || 0), 0)));

  if (typeof module !== 'undefined' && module.exports) module.exports = C;
  else root.WBCore = C;
})(typeof self !== 'undefined' ? self : this);
