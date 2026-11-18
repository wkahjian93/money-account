/* Money Account storage: everything stays on this phone. Records in localStorage, receipt photos in IndexedDB. */
(function () {
  const KEY = 'wb.state.v1';
  const S = {};

  S.blank = () => ({
    v: 1, created: new Date().toISOString(),
    settings: { name: '', hide: false, server: '', aiCode: '', sound: true, autoInsRelief: true, budgets: {}, tax: {}, reliefLimits: {},
      targets: { income: 0, deathX: 10, ciX: 5, med: 1000000, emergencyMonths: 6 }, lastBackup: null },
    accounts: [{ id: 'cash', name: 'Cash', type: 'cash', opening: 0 }],
    txns: [], recurring: [], holdings: [], loans: [], owed: [], policies: [],
    split: { people: [], groups: [] }, fx: null, pricesAt: null,
  });

  S.load = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      const b = S.blank();
      Object.keys(b).forEach((k) => { if (s[k] === undefined) s[k] = b[k]; });
      s.settings = Object.assign(b.settings, s.settings || {});
      s.settings.targets = Object.assign(b.settings.targets, s.settings.targets || {});
      if (s.settings.priceServer && !s.settings.server) s.settings.server = s.settings.priceServer;
      s.split = Object.assign({ people: [], groups: [] }, s.split || {});
      return s;
    } catch (e) { console.error(e); return null; }
  };
  let timer = null;
  S.save = (state, now) => {
    clearTimeout(timer);
    const go = () => {
      try { localStorage.setItem(KEY, JSON.stringify(state)); }
      catch (e) { alert('Could not save on this phone: ' + e.message + '\nMake a backup (More → Backup) and remove old receipt photos.'); }
    };
    if (now) go(); else timer = setTimeout(go, 250);
  };
  S.erase = () => localStorage.removeItem(KEY);

  // ---- receipt photos ----
  let dbp = null;
  const db = () => dbp || (dbp = new Promise((ok, no) => {
    const r = indexedDB.open('moneyaccount', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('receipts');
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
  }));
  const tx = async (mode, fn) => {
    const d = await db();
    return new Promise((ok, no) => {
      const t = d.transaction('receipts', mode), st = t.objectStore('receipts');
      const req = fn(st);
      t.oncomplete = () => ok(req && req.result); t.onerror = () => no(t.error);
    });
  };
  S.putImg = (id, data) => tx('readwrite', (s) => s.put(data, id));
  S.getImg = (id) => tx('readonly', (s) => s.get(id));
  S.delImg = (id) => tx('readwrite', (s) => s.delete(id));
  S.allImgKeys = () => tx('readonly', (s) => s.getAllKeys());

  // shrink a photo to <=1400px JPEG
  S.compress = (file) => new Promise((ok, no) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const m = 1400, k = Math.min(1, m / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      ok(c.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => { URL.revokeObjectURL(url); no(new Error('Not a picture')); };
    img.src = url;
  });

  self.WBStore = S;
})();
