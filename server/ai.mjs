// Money Account AI helper: voice → records, receipt photo → record, investment statement / handwritten notes → holdings + report.
// Runs inside the Cloudflare Worker (and the local test server). Needs env.OPENAI_API_KEY; env.APP_CODE guards it.
// Nothing is stored here: the request is passed to OpenAI and the answer goes straight back to the phone.

const MODEL = (env) => env.AI_MODEL || 'gpt-4o-mini';
const VISION_MODEL = (env) => env.AI_VISION_MODEL || 'gpt-4o';

const ENTRY_SCHEMA = `{"entries":[{"type":"expense|income|transfer|balance|invest","amount":number,"date":"YYYY-MM-DD","cat":"<category id, empty for transfer/balance>","account":"<account id from the list, or empty>","toAccount":"<account id, transfers only>","note":"short description in the user's words","relief":"<relief id or empty>","merchant":"shop name or empty","biz":true|false,"side":"buy|sell (invest only)","kind":"gold|stock|crypto|fund|fd|other (invest only)","asset":"what was bought/sold, e.g. Gold, Maybank, Bitcoin, Public Mutual PIX (invest only)","units":number_or_null,"unit":"g|oz (gold only)","symbol":"ticker, Bursa ends with .KL e.g. Maybank 1155.KL, Public Bank 1295.KL, US e.g. AAPL (stock only, empty if unsure)","coinId":"CoinGecko id e.g. bitcoin, ethereum (crypto only)","holding":"<id from the user's investments list if it is the same asset, else empty>"}],"comment":"one short line in the user's language: anything unclear, or empty"}`;

const SLANG = `Malaysian speech guide (English, Malay, Chinese, rojak mixed in one sentence is normal):
- Amounts: "k" / "K" / "千" = thousand ("2k5" or "2.5k" = 2500); "块" / "kuai" / "箍" / "ringgit" / "rm" / "hengit" = RM; "毛" / "sen" = cents; "一百五" = 150, "两百二" = 220, "三千五" = 3500, "lima puluh" = 50, "seratus" = 100, "setengah" = half; "lui" = money; "half k" = 500.
- Spending words: makan, tapau / 打包, minum, kopi / kopi-o / teh tarik, mamak, 吃饭, 早餐, 午餐, 晚餐, 宵夜, yum cha / 饮茶, minyak / 油 / petrol / 打油 = petrol (cat transport), tol / toll, parking / 泊车, Grab / 打车 (transport), belanja / 请客 = I treated others (expense), bayar / 付 / 还 = pay, bil / bill / 水电 = utilities, astro / unifi / 上网 = phone & internet, 杂货 / barang dapur / pasar / 巴刹 = groceries, Shopee / Lazada = shopping, 看医生 / klinik = health, 学费 / yuran = education, 保险 / premium = insurance, 家用 / bagi mak / 给妈妈 = parents, angpau / 红包 given = gifts.
- Income words: gaji / 薪水 / 工资 / salary, komisen / 佣金 / commission, override, bonus / 花红 / 奖金, masuk / 进 / 入账 / dapat / 收到 / received = income into an account, dividend / 股息, sewa / 租金 = rental, angpau received = gift.
- Accounts: TNG / Touch n Go / tng ewallet, Maybank / MBB / M2U, CIMB, Public Bank / PBB, RHB, Hong Leong / HLB, GrabPay, cash / tunai / 现金. Match to the closest account in the list.
- Balances: "tinggal" / "baki" / "balance" / "剩" / "还有" / "left" with an account = type "balance" (the money now in that account), NOT spending.
- Investments = type "invest", NOT spending: buying or selling gold (bar, coin, 金条, 金币, gold savings account / GAP / Maybank gold / Public Gold, "beli emas", "买金"), shares / saham / 股票, unit trust / Public Mutual / ASB / ASNB / 基金, crypto / bitcoin, fixed deposit / FD / 定期, top-up into an investment. "amount" = total RM paid (buy) or received (sell); "units" = grams for gold ("10 gram" / "10g" / "10克" / "一两" = 37.5 g / "1 tael" = 37.5 g, "1 oz" = unit oz), number of shares (1 lot Bursa = 100 shares), or fund units; "account" = where the money came from (buy) or went to (sell). Gold jewellery (rantai, gelang, cincin, 金链, 金手镯, 戒指) is spending (shopping) unless they say it is for saving / investment.
- Transfers: "pindah" / "transfer" / "转" / "top up TNG from Maybank" = type "transfer" (account = from, toAccount = to).
- "semalam" / "昨天" = yesterday; "kelmarin" / "前天" = day before yesterday; "tadi" / "刚才" / "just now" = today; "minggu lepas" / "上个星期" = last week (pick that weekday if named, else 7 days ago).`;

function prompts(task, b) {
  const catList = (l) => (l || []).map((c) => (Array.isArray(c) ? c[0] + ' (' + c[1] + ')' : c)).join(', ');
  const cats = 'Expense categories, reply with the id before the brackets and pick the closest real match, use "other" only if nothing fits: ' + catList(b.cats && b.cats.expense) + '. Examples: sports equipment, gym, badminton court → fitness; restaurant, cafe, mamak, food delivery → food; supermarket, pasar → groceries; petrol, Grab, toll, parking → transport; car service, road tax, car insurance → car; pharmacy, clinic, dental → health; clothes, electronics, online shopping → shopping; TNB, water, Indah Water → bills; phone, internet, Astro → phone; books, courses, tuition → education; salon, barber → care. Income categories: ' + catList(b.cats && b.cats.income) + '.';
  const rel = 'Malaysian personal income tax relief ids — set "relief" whenever the item is the kind the relief covers, else "": ' + (b.reliefs || []).map((r) => r.id + ' = ' + r.name).join('; ') +
    '. Examples: badminton racket, shoes for sport, gym fees, sports facility rental, marathon entry → sports; books, smartphone, laptop, tablet, internet bill, short courses → lifestyle; clinic for serious illness, vaccination, dental, health screening → medical; parents\' medical / care → parents; kindergarten / taska fees → childcare; SSPN deposit → sspn; EV charger → ev; university / professional course fees for self → edu.';
  const today = 'Today is ' + (b.today || new Date().toISOString().slice(0, 10)) + ' (Malaysia). Currency is RM unless stated.';
  const accs = 'The user\'s accounts: ' + JSON.stringify(b.accounts || []) + '. ' + (task !== 'invest' && b.holdings && b.holdings.length ? 'The user\'s investments: ' + JSON.stringify(b.holdings).slice(0, 3000) + '. ' : '');
  if (task === 'entries') return {
    system: 'You turn a Malaysian person\'s voice note (often a long summary of the day or week, in English, Malay, Mandarin, Cantonese, Hokkien or rojak mixed) into money records for their personal finance app. ' + today + ' Relative days are relative to today. ' +
      'Make ONE record for EVERY amount mentioned — spending, income, transfers between their own accounts, investments bought or sold, and account balances they state. Do not merge separate items; do not invent amounts; if someone says "about 30" use 30. If an item is shared and they say only their part, record their part. ' +
      'Note: keep it short, in the words they used (e.g. "Tapau nasi lemak", "打油 Shell"). ' + SLANG + ' ' + accs + cats + ' ' + rel + ' Reply ONLY with JSON: ' + ENTRY_SCHEMA + '. If no amount is said, return {"entries":[],"comment":"what was missing"}.',
    user: [{ type: 'text', text: 'They said: ' + String(b.text || '').slice(0, 2000) }],
  };
  if (task === 'receipt') return {
    system: 'You read receipts, bills, invoices and payment screenshots for a Malaysian personal finance app. ' + today + ' Use the FINAL amount paid (after service charge, SST, rounding, discounts). Use the receipt date if shown. Usually one record per receipt; if the photo shows several separate receipts, one record each. A payslip or commission statement is income (net amount). A bank / e-wallet screen showing the available balance is type "balance". A receipt for gold bars / coins / gold savings, shares, unit trust or crypto bought is type "invest" (gold jewellery is spending). Set "biz": true only when it looks like a cost of earning insurance-agency commission (client meals, petrol / toll / parking for client visits, phone bill, marketing, gifts to clients, training, stationery, printing); the user confirms. ' + accs + cats + ' ' + rel + ' Reply ONLY with JSON: ' + ENTRY_SCHEMA + '. If unreadable, return {"entries":[],"comment":"why"}.',
    user: [{ type: 'text', text: 'Read this.' + (b.text ? ' Extra note from the user: ' + String(b.text).slice(0, 500) : '') }],
  };
  if (task === 'invest') return {
    system: 'You read unit trust / investment statements (e.g. Public Mutual, ILP fund statements, broker statements) and handwritten notes for a Malaysian personal finance app. ' + today +
      ' Extract each fund or holding: name exactly as written, units held, latest price per unit (NAV) and its date, market value, and total amount invested (cost) if shown. Numbers must come from the image; never guess — use null when not shown. ' +
      'Then write a short plain-English report for the owner: total value, total gain or loss, allocation (equity / bond / money market / mixed / Shariah if the name shows it), concentration, things worth checking (e.g. sales charges, funds lagging, lots of small funds, missing cost data). ' +
      'This is education, not advice: do not tell them to buy, sell or switch any specific fund, and do not promise returns. ' +
      'Existing holdings in the app (to match names): ' + JSON.stringify(b.holdings || []).slice(0, 3000) + '. ' +
      'Reply ONLY with JSON: {"statementDate":"YYYY-MM-DD or null","provider":"","holdings":[{"name":"","units":number|null,"nav":number|null,"navDate":"YYYY-MM-DD|null","value":number|null,"cost":number|null,"type":"equity|bond|money market|mixed|other","matches":"existing holding id or empty"}],"report":{"summary":"2-3 sentences","points":["..."],"check":["..."]}}',
    user: [{ type: 'text', text: 'Read these pages.' + (b.text ? ' Note from the user: ' + String(b.text).slice(0, 1000) : '') }],
  };
  return null;
}

async function chat(env, task, b) {
  const p = prompts(task, b);
  if (!p) return { status: 400, body: { error: 'unknown task' } };
  const imgs = (b.images || []).slice(0, 6).filter((u) => /^data:image\/(jpeg|png|webp);base64,/.test(u));
  if ((task === 'receipt' || task === 'invest') && !imgs.length) return { status: 400, body: { error: 'no photo' } };
  const content = p.user.concat(imgs.map((u) => ({ type: 'image_url', image_url: { url: u, detail: 'high' } })));
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { Authorization: 'Bearer ' + env.OPENAI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: imgs.length ? VISION_MODEL(env) : MODEL(env), temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: p.system }, { role: 'user', content }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { status: 502, body: { error: 'AI error: ' + ((j.error && j.error.message) || r.status) } };
  let out; try { out = JSON.parse(j.choices[0].message.content); } catch (e) { return { status: 502, body: { error: 'AI reply was not readable' } }; }
  if (Array.isArray(out.entries)) out.entries.forEach((e) => fixCat(e, b));
  return { status: 200, body: out };
}

// The model sometimes answers with a relief id or a loose word as the category: map it to a real category id.
const ALIAS = {
  sports: 'fitness', sport: 'fitness', gym: 'fitness', medical: 'health', parents: 'parents', lifestyle: 'shopping', edu: 'education', childcare: 'kids',
  petrol: 'transport', fuel: 'transport', grab: 'transport', toll: 'transport', parking: 'transport', restaurant: 'food', meal: 'food', drinks: 'food',
  supermarket: 'groceries', grocery: 'groceries', utilities: 'bills', electricity: 'bills', internet: 'phone', mobile: 'phone', clothes: 'shopping',
  electronics: 'shopping', pharmacy: 'health', clinic: 'health', dental: 'health', insurance: 'insurance', donation: 'gifts', gift: 'gifts', salon: 'care',
  commission: 'commission', komisen: 'commission', gaji: 'salary', wages: 'salary', dividends: 'dividend', rent: 'rental',
};
function fixCat(e, b) {
  if (e.type !== 'expense' && e.type !== 'income') return;
  const ids = ((b.cats && b.cats[e.type]) || []).map((c) => (Array.isArray(c) ? c[0] : c));
  if (!ids.length) return;
  const c = String(e.cat || '').toLowerCase().trim();
  if (ids.includes(c)) { e.cat = c; return; }
  const a = ALIAS[c] || (ALIAS[String(e.relief || '').toLowerCase()] && e.type === 'expense' ? ALIAS[String(e.relief).toLowerCase()] : '');
  e.cat = ids.includes(a) ? a : ids.includes('other') ? 'other' : ids[0];
}

async function transcribe(env, audio, type) {
  const models = [env.TRANSCRIBE_MODEL, 'gpt-4o-transcribe', 'whisper-1'].filter(Boolean);
  let last = '';
  for (const m of models) {
    const fd = new FormData();
    const ext = /mp4|m4a|aac/.test(type) ? 'm4a' : /ogg/.test(type) ? 'ogg' : /wav/.test(type) ? 'wav' : 'webm';
    fd.append('file', new Blob([audio], { type: type || 'audio/webm' }), 'voice.' + ext);
    fd.append('model', m);
    fd.append('prompt', 'Malaysian speaker summarising spending and income, mixing English, Malay, Mandarin, Cantonese, Hokkien (rojak). Words like makan, tapau, minyak, gaji masuk, komisen, tinggal, baki, belanja, mamak, Grab, TNG, Maybank, 打包, 打油, 佣金, 收到, 剩, 块, lui, RM, ringgit, 2k5.');
    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: 'Bearer ' + env.OPENAI_API_KEY }, body: fd });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.text !== undefined) return { status: 200, body: { text: j.text, model: m } };
    last = (j.error && j.error.message) || String(r.status);
  }
  return { status: 502, body: { error: 'Transcribe failed: ' + last } };
}

function allowed(env, code) {
  if (!env.APP_CODE) return env.LOCAL === '1'; // live server: AI stays locked until an access code is set
  const want = String(env.APP_CODE).trim();
  return typeof code === 'string' && code.trim().length > 0 && code.trim() === want;
}

// req-like: {path, headers: Map-like get(), json(), arrayBuffer()}
export async function handleAI(path, req, env) {
  if (!env.OPENAI_API_KEY) return { status: 503, body: { error: 'AI is not switched on for this server (no OpenAI key yet)' } };
  if (/\/transcribe$/.test(path)) {
    if (!allowed(env, req.headers.get('x-code'))) return { status: 401, body: { error: 'Wrong AI access code (Settings)' } };
    const buf = await req.arrayBuffer();
    if (!buf.byteLength) return { status: 400, body: { error: 'no audio' } };
    if (buf.byteLength > 20e6) return { status: 413, body: { error: 'Recording too long' } };
    return transcribe(env, buf, req.headers.get('content-type') || '');
  }
  if (/\/ai$/.test(path)) {
    const b = await req.json().catch(() => null);
    if (!b) return { status: 400, body: { error: 'bad request' } };
    if (!allowed(env, b.code)) return { status: 401, body: { error: 'Wrong AI access code (Settings)' } };
    if (b.task === 'ping') return { status: 200, body: { ok: true } };
    return chat(env, b.task, b);
  }
  return { status: 404, body: { error: 'not found' } };
}
