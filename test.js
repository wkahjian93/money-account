// node test.js — checks the money maths in docs/core.js
const C = require('./docs/core.js');
let pass = 0, fail = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); ok ? pass++ : fail++; if (!ok) console.log('FAIL', name, '\n  got ', JSON.stringify(got), '\n  want', JSON.stringify(want)); };
const near = (name, got, want, tol) => { const ok = Math.abs(got - want) <= (tol || 0.01); ok ? pass++ : fail++; if (!ok) console.log('FAIL', name, got, 'vs', want); };

// allocate always sums exactly
eq('allocate 100 / 3', C.allocate(10000, [1, 1, 1]), [3334, 3333, 3333]);
eq('allocate sum', C.allocate(1001, [1, 2, 3]).reduce((a, b) => a + b), 1001);
eq('allocate zero weights → equal', C.allocate(10, [0, 0]), [5, 5]);

// split: equal
const M = ['me', 'a', 'b'];
let r = C.splitShares({ mode: 'equal', total: 100, who: M, paid: { me: 100 } }, M);
eq('equal shares', [r.owe.me, r.owe.a, r.owe.b], [3334, 3333, 3333]);
eq('equal no error', r.error, '');
// split: exact mismatch
r = C.splitShares({ mode: 'exact', total: 50, vals: { me: 20, a: 20, b: 5 }, paid: { me: 50 } }, M);
eq('exact mismatch error', /add up to 45.00/.test(r.error), true);
// split: percent
r = C.splitShares({ mode: 'percent', total: 200, vals: { me: 50, a: 25, b: 25 }, paid: { a: 200 } }, M);
eq('percent', [r.owe.me, r.owe.a, r.owe.b, r.paid.a], [10000, 5000, 5000, 20000]);
// split: items with SC 10% + SST 6%
const items = { mode: 'items', sc: 10, tax: 6, items: [{ name: 'set', amount: 168, who: ['me', 'a', 'b'] }, { name: 'beer', amount: 54, who: ['me', 'a'] }, { name: 'juice', amount: 7.9, who: ['b'] }], paid: { me: 0 } };
const tot = C.expenseTotalC(items);
eq('items total = 229.90 × 1.1 × 1.06', tot, Math.round(22990 * 1.1 * 1.06));
items.paid = { me: tot / 100 };
r = C.splitShares(items, M);
eq('items shares sum to total', r.owe.me + r.owe.a + r.owe.b, tot);
eq('items me = a', r.owe.me, r.owe.a);
eq('items no error', r.error, '');
// receipt total override
r = C.splitShares(Object.assign({}, items, { receiptTotal: 268, paid: { me: 268 } }), M);
eq('receipt total override', r.owe.me + r.owe.a + r.owe.b, 26800);
// unticked item
r = C.splitShares({ mode: 'items', items: [{ name: 'x', amount: 10, who: [] }], paid: { me: 10 } }, M);
eq('unticked item error', /nobody ticked/.test(r.error), true);
// several payers
r = C.splitShares({ mode: 'equal', total: 90, who: M, paid: { me: 60, a: 30 } }, M);
eq('two payers', [r.paid.me, r.paid.a, r.error], [6000, 3000, '']);

// group balances + simplify
const g = { members: M, expenses: [{ mode: 'equal', total: 90, who: M, paid: { me: 90 } }, { mode: 'equal', total: 30, who: ['a', 'b'], paid: { a: 30 } }], settlements: [{ from: 'b', to: 'me', amount: 10 }] };
const gb = C.groupBalances(g);
eq('net me', gb.net.me, 6000 - 1000);
eq('net sums to zero', gb.net.me + gb.net.a + gb.net.b, 0);
const plan = C.simplify(gb.net);
eq('simplify transfers settle all', plan.reduce((a, t) => a + t.c, 0), 5000);

// loans
let L = C.loanStatus({ principal: 400000, rate: 4, tenureMonths: 420, start: '2026-01-01' }, '2026-01-01');
near('housing monthly 400k 4% 35y', L.monthly, 1771.11, 0.5);
eq('housing balance at start', L.balance, 400000);
L = C.loanStatus({ principal: 400000, rate: 4, tenureMonths: 420, start: '2016-01-01' }, '2026-01-01');
near('housing balance after 10y (month-by-month check)', L.balance, 335539.10, 0.05);
L = C.loanStatus({ principal: 100000, rate: 3, tenureMonths: 108, start: '2026-01-01', method: 'flat' }, '2026-01-01');
near('car flat monthly', L.monthly, (100000 + 100000 * 0.03 * 9) / 108, 0.01);
L = C.loanStatus({ principal: 100000, rate: 3, tenureMonths: 108, start: '2017-01-01', method: 'flat' }, '2026-06-01');
eq('car done', [L.balance, L.done], [0, true]);
L = C.loanStatus({ principal: 100000, rate: 3, tenureMonths: 120, start: '2020-01-01', balanceOverride: 55555 }, '2026-01-01');
eq('statement override', L.balance, 55555);

// investments: average cost with sells
const h = { kind: 'stock', price: 12, priceCur: 'MYR', lots: [{ type: 'buy', date: '2024-01-01', units: 100, amount: 1000 }, { type: 'buy', date: '2024-02-01', units: 100, amount: 1400 }, { type: 'sell', date: '2024-03-01', units: 50, amount: 700 }] };
const pos = C.position(h);
eq('position units', pos.units, 150);
eq('position cost', pos.cost, 1800);
eq('realised', pos.realized, 100);
const v = C.holdingValue(h, null);
eq('value & pl', [v.value, v.pl], [1800, 0]);
// USD stock with fx (rates: units per MYR)
const us = C.holdingValue({ kind: 'stock', price: 200, priceCur: 'USD', lots: [{ type: 'buy', units: 10, amount: 8000 }] }, { rates: { USD: 0.25 } });
eq('usd value in RM', us.value, 8000);
// FD accrual
const fd = C.holdingValue({ kind: 'fd', principal: 10000, rate: 3.65, start: '2026-01-01', maturity: '2027-01-01' }, null, '2026-07-01');
near('fd interest 181 days', fd.value, 10000 * (1 + 0.0365 * 181 / 365));

// accounts & ledger (Dr = in, Cr = out)
const st = { accounts: [{ id: 'a', opening: 100 }, { id: 'b', opening: 0 }], txns: [
  { id: 1, date: '2026-01-02', type: 'income', amount: 50, account: 'a' },
  { id: 2, date: '2026-01-03', type: 'expense', amount: 20, account: 'a' },
  { id: 3, date: '2026-01-04', type: 'transfer', amount: 30, account: 'a', toAccount: 'b' },
  { id: 4, date: '2026-01-05', type: 'expense', amount: 999, account: 'a', noCash: true }] };
eq('balances', C.accountBalances(st), { a: 100, b: 30 });
const led = C.ledger(st, 'a', '2026-01-03', '2026-12-31');
eq('ledger opening', led.opening, 150);
eq('ledger dr/cr', [led.debit, led.credit, led.closing], [0, 50, 100]);
eq('ledger b', C.ledger(st, 'b').rows.map((x) => [x.debit, x.credit]), [[30, 0]]);

// repeating records
const rs = { txns: [], recurring: [{ id: 'r', type: 'expense', amount: 100, cat: 'bills', every: 3, start: '2026-01-31', lastPosted: '2026-01-31' }] };
C.postRecurring(rs, '2026-11-18');
eq('quarterly from 31 Jan', rs.txns.map((t) => t.date), ['2026-04-30', '2026-07-31', '2026-10-31']);
C.postRecurring(rs, '2026-11-18');
eq('no double posting', rs.txns.length, 3);
eq('next date', C.nextRuleDate(rs.recurring[0]), '2027-01-31');
const rs2 = { txns: [], recurring: [{ id: 'y', type: 'income', amount: 5, every: 12, start: '2024-02-29', end: '2026-12-31' }] };
C.postRecurring(rs2, '2026-11-18');
eq('yearly incl. first, leap day', rs2.txns.map((t) => t.date), ['2024-02-29', '2025-02-28', '2026-02-28']);

// tax
eq('tax 0 under 5000', C.incomeTax(5000).tax, 0);
eq('tax 35000 with rebate', C.incomeTax(35000).tax, Math.max(0, 150 + 450 - 400));
eq('tax 100000', C.incomeTax(100000).tax, 150 + 450 + 900 + 2200 + 5700);
const tstate = { settings: { tax: { 2026: { child: 2, spouse: true } } }, txns: [
  { date: '2026-03-01', type: 'expense', amount: 3000, relief: 'lifestyle' },
  { date: '2026-05-01', type: 'income', amount: 120000, cat: 'commission' },
  { date: '2026-06-01', type: 'expense', amount: 5000, cat: 'business', biz: true }], policies: [{ id: 'p', premium: 400, mode: 'M', relief: 'life' }] };
const ts = C.taxSummary(tstate, 2026);
const row = (id) => ts.rows.find((x) => x.id === id);
eq('lifestyle capped', row('lifestyle').allowed, 2500);
eq('life premium capped', row('life').allowed, 3000);
eq('children count', row('child').allowed, 4000);
eq('spouse flag', row('spouse').allowed, 4000);
eq('total relief', ts.total, 9000 + 2500 + 3000 + 4000 + 4000);
eq('business expenses from records', ts.expenses, 5000);
const tp = C.taxPack(tstate, 2026);
eq('commission is business income', tp.groups.biz.total, 120000);

// spoken notes (offline reader)
const sp = C.parseSpoken('makan 12.50, minyak 80 semalam, gaji masuk 3k5, 打包 一百五, maybank tinggal 2300', '2026-11-18');
eq('spoken amounts', sp.map((e) => e.amount), [12.5, 80, 3500, 150, 2300]);
eq('spoken types', sp.map((e) => e.type), ['expense', 'expense', 'income', 'expense', 'balance']);
eq('spoken cats', sp.slice(0, 4).map((e) => e.cat), ['food', 'transport', 'salary', 'food']);
eq('spoken yesterday', sp[1].date, '2026-11-17');

// csv quoting
eq('csv', C.csv([['a,b', 'x"y']]), '﻿"a,b","x""y"');

// owed monthly plan
{
  const o = { amount: 1000, repaid: [{ date: '2026-01-01', amount: 100 }], plan: { amount: 200, start: '2026-01-31', auto: true } };
  eq('plan due dates', C.owedPlanDue(o, '2026-03-30'), ['2026-01-31', '2026-02-28']);
  const st = { owed: [o] };
  const made = C.postOwedPlans(st, '2026-04-30');
  eq('plan posted 4', made.length, 4);
  eq('plan left', C.owedLeft(o), 100);
  eq('plan posted marker', o.plan.posted, '2026-04-30');
  const pi = C.owedPlanInfo(o, '2026-04-30');
  eq('plan info', [pi.next, pi.months, pi.finish, pi.last], ['2026-05-31', 1, '2026-05-31', 100]);
  C.postOwedPlans(st, '2026-12-31');
  eq('plan stops at zero', [C.owedLeft(o), o.repaid.length, o.repaid[o.repaid.length - 1].amount], [0, 6, 100]);
}

// liquidity groups + property estimate
{
  const st = { accounts: [{ id: 'b', type: 'bank', opening: 1000 }, { id: 'c', type: 'cash', opening: 50 }, { id: 'e', type: 'ewallet', opening: 20 }, { id: 'k', type: 'card', opening: -300 }], txns: [],
    holdings: [{ id: 'p', kind: 'property', value: 500000, valueAt: '2025-01-01', growth: 3 }, { id: 'f', kind: 'fd', principal: 10000, rate: 0, start: '2026-01-01' }, { id: 'e2', kind: 'epf', value: 80000 }], owed: [{ amount: 200, repaid: [] }], loans: [], policies: [], split: { groups: [] } };
  const s = C.summary(st, '2026-01-01');
  eq('cash by type', s.cashBy, { bank: 1000, cash: 50, ewallet: 20, other: 0 });
  eq('liquid', s.liquid, 1070);
  eq('sellable', s.sellable, 10000);
  eq('property +3% after 1 year', C.holdingValue(st.holdings[0], {}, '2026-01-01').value, 515000);
  eq('long-term', s.longTerm, 515000 + 80000 + 200);
  eq('groups add up', C.r2(s.liquid + s.sellable + s.longTerm), s.assets);
}

// property market value
{
  const items = [
    { kind: 'sold', date: '2026-06-01', price: 600000, size: 1000 },
    { kind: 'sold', date: '2026-03-01', price: 660000, size: 1100 },
    { kind: 'sold', date: '2025-12-01', psf: 580, size: 1050 },
    { kind: 'sold', date: '2023-01-01', price: 400000, size: 1000 },
    { kind: 'sold', date: '2026-05-01', price: 900000, size: 2000 },
    { kind: 'asking', price: 750000, size: 1000 },
  ];
  const m = C.marketValue(items, 1000, '2026-11-19');
  eq('mv basis sold, old sale + big unit left out', [m.basis, m.n, m.used], ['sold', 3, [0, 1, 2]]);
  eq('mv median psf', m.psf, 600);
  eq('mv value', m.value, 600000);
  eq('mv asking kept apart', [m.askingN, m.askingPsf], [1, 750]);
  const a = C.marketValue([{ kind: 'asking', price: 700000, size: 1000 }, { kind: 'asking', price: 800000, size: 1000 }], 1000, '2026-11-19');
  eq('mv asking only', [a.basis, a.value], ['asking', 750000]);
  eq('mv skip unticked', C.marketValue(items.map((x, i) => Object.assign({}, x, { use: i !== 0 })), 1000, '2026-11-19').psf, 580);
}

// new launch property
{
  eq('schedule H adds to 100', C.r2(C.SCHEDULE_H.reduce((a, s) => a + s[1], 0)), 100);
  eq('21 working days', C.addWorkdays('2026-11-19', 21), '2026-12-18');
  const h = { kind: 'property', offplan: { price: 700000, rebate: 50000, stages: C.SCHEDULE_H.map(([l, pct]) => ({ l, pct })) } };
  h.offplan.stages[0].paid = '2026-01-10'; h.offplan.stages[1].paid = '2026-06-01'; h.offplan.stages[2].billed = '2026-11-01';
  const st = C.offplanStatus(h, '2026-12-15');
  eq('offplan net/paid/billed', [st.net, st.paid, st.billedUnpaid, st.pctPaid], [650000, 130000, 97500, 20]);
  eq('offplan due + late', [st.owing[0].due, st.owing[0].late], ['2026-11-30', true]);
  eq('offplan value = paid so far', C.holdingValue(h, {}, '2026-12-15').value, 130000);
  h.offplan.done = true; h.value = 650000;
  eq('after keys: normal value', C.holdingValue(h, {}, '2026-12-15').value, 650000);
  const sm = C.summary({ accounts: [], txns: [], holdings: [h], owed: [], loans: [], policies: [], split: { groups: [] } }, '2026-12-15');
  eq('after keys: unpaid owed to developer', [sm.devOwe, sm.netWorth], [520000, 130000]);
}

// shared ownership
{
  const st = { accounts: [], txns: [], owed: [], policies: [], split: { groups: [] },
    holdings: [{ id: 'p', kind: 'property', value: 600000, cost: 500000, share: 50 }, { id: 'g', kind: 'gold', unit: 'g', price: 500, priceCur: 'MYR', lots: [{ type: 'buy', units: 10, amount: 4000, date: '2026-01-01' }], share: 30 }],
    loans: [{ id: 'l', principal: 400000, rate: 0, tenureMonths: 400, start: '2026-11-01', method: 'reducing', share: 50 }] };
  const s = C.summary(st, '2026-11-19');
  eq('share: property half', s.property, 300000);
  eq('share: gold 30%', [s.invest, s.investCost], [1500, 1200]);
  eq('share: loan half', s.loans, C.r2(C.loanStatus(st.loans[0], '2026-11-19').balance / 2));
  eq('share default 100', C.share({}), 1);
}

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
