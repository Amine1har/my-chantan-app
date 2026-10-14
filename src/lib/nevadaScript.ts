export const NEVADA_SCRIPT = `// Cloud Brand CRM ↔ Google Sheet Nivada (feuille "Orders")
const TOKEN = 'CHOISISSEZ_UNE_CLE_SECRETE';
const SHEET_NAME = 'Orders';
const STATUS_HEADER = 'Statut livraison';

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function norm_(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').trim();
}
function key_(s) {
  return String(s || '').replace('#', '').toUpperCase().trim();
}
// Trouve la ligne d'en-tête (celle qui contient "Order ID") et les colonnes
function layout_(sh) {
  const maxR = Math.min(sh.getLastRow(), 10);
  const maxC = Math.max(sh.getLastColumn(), 14);
  const top = sh.getRange(1, 1, Math.max(maxR, 1), maxC).getValues();
  let hr = -1;
  for (let i = 0; i < top.length; i++) {
    if (top[i].some(v => norm_(v) === 'order id')) { hr = i + 1; break; }
  }
  if (hr < 0) throw new Error('En-tête "Order ID" introuvable dans la feuille ' + SHEET_NAME);
  const head = top[hr - 1].map(norm_);
  const col = n => head.indexOf(n) + 1;
  let st = 0;
  head.forEach((h, i) => { if (!st && /statut|status/.test(h) && h !== 'etat de colis') st = i + 1; });
  if (!st) {
    st = Math.max(head.length, 14);
    while (st > 1 && !head[st - 2] && st - 1 > 13) st--;
    if (st <= 13) st = 14;
    sh.getRange(hr, st).setValue(STATUS_HEADER);
  }
  return { hr: hr, c: col('order id'), st: st, last: Math.max(sh.getLastColumn(), st) };
}
// Dernière ligne remplie dans la colonne Order ID
function lastRow_(sh, L) {
  const n = sh.getLastRow();
  if (n <= L.hr) return L.hr;
  const v = sh.getRange(L.hr + 1, L.c, n - L.hr, 1).getValues();
  let last = L.hr;
  for (let i = 0; i < v.length; i++) if (String(v[i][0]).trim()) last = L.hr + 1 + i;
  return last;
}
function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents);
    if (b.token !== TOKEN) return out_({ error: 'Clé secrète invalide' });
    const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
    if (!sh) return out_({ error: 'Feuille "' + SHEET_NAME + '" introuvable' });
    const L = layout_(sh);
    const last = lastRow_(sh, L);
    if (b.action === 'upsert') {
      const existing = {};
      if (last > L.hr) {
        sh.getRange(L.hr + 1, L.c, last - L.hr, 1).getValues().forEach((r, i) => { if (r[0]) existing[key_(r[0])] = true; });
      }
      const add = [];
      let skipped = 0;
      b.rows.forEach(o => {
        if (existing[key_(o.number)]) { skipped++; return; }
        existing[key_(o.number)] = true;
        (o.lines.length ? o.lines : [{ name: '', color: '', size: '', price: o.total, qty: 1 }]).forEach(l => {
          add.push([o.source, o.etat || 'Normal', o.number, o.name, o.phone, o.city, o.address, l.name, l.color, l.size, l.price, l.qty, '']);
        });
      });
      if (add.length) {
        const r = last + 1;
        sh.getRange(r, 5, add.length, 1).setNumberFormat('@');
        sh.getRange(r, 1, add.length, 13).setValues(add);
      }
      return out_({ ok: true, count: b.rows.length - skipped, skipped: skipped });
    }
    if (b.action === 'statuses') {
      const res = [];
      if (last > L.hr) {
        const rows = sh.getRange(L.hr + 1, 1, last - L.hr, L.st).getValues();
        rows.forEach(r => {
          const num = String(r[L.c - 1] || '').trim();
          const s = String(r[L.st - 1] || '').trim();
          if (num && s) res.push({ number: num, statut: s });
        });
      }
      return out_({ rows: res });
    }
    return out_({ error: 'Action inconnue' });
  } catch (err) {
    return out_({ error: String(err) });
  }
}
`
