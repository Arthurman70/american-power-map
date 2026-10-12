// Fetches EDGAR submissions JSON for every CIK in company_tickers_exchange.json → data/edgar_companies.json
// Rate-limited to SEC's fair-access limit (<10 req/s). Resumable: already-fetched CIKs are skipped.
import fs from 'node:fs';
const UA = process.env.SEC_USER_AGENT || 'USPowerMap research@uspowermap.org';
const OUT = 'data/edgar_companies.json';
const src = JSON.parse(fs.readFileSync('data/company_tickers_exchange.json', 'utf8'));
const f = src.fields; const iCik = f.indexOf('cik'), iName = f.indexOf('name'), iTicker = f.indexOf('ticker'), iEx = f.indexOf('exchange');
const byCik = new Map();
for (const r of src.data) { const cik = r[iCik]; if (!byCik.has(cik)) byCik.set(cik, { cik, name: r[iName], tickers: [], exchanges: new Set() }); const c = byCik.get(cik); if (r[iTicker]) c.tickers.push(r[iTicker]); if (r[iEx]) c.exchanges.add(r[iEx]); }
const done = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const todo = [...byCik.values()].filter(c => !done[c.cik]);
console.log('ciks', byCik.size, 'todo', todo.length);
let i = 0, ok = 0, fail = 0; const started = Date.now();
const RATE = 8; // requests per second
let lastSave = Date.now();
async function one(c) {
  const url = `https://data.sec.gov/submissions/CIK${String(c.cik).padStart(10, '0')}.json`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Encoding': 'gzip, deflate' } });
      if (r.status === 429 || r.status === 403) { await new Promise(s => setTimeout(s, 5000 * (attempt + 1))); continue; }
      if (!r.ok) { done[c.cik] = { cik: c.cik, name: c.name, tickers: c.tickers, exchanges: [...c.exchanges], error: r.status }; fail++; return; }
      const j = await r.json();
      const addr = (j.addresses && (j.addresses.business || j.addresses.mailing)) || {};
      const recent = j.filings && j.filings.recent || {}; const forms = recent.form || []; const dates = recent.filingDate || [];
      let last10k = null; for (let k = 0; k < forms.length; k++) { if (forms[k] === '10-K' || forms[k] === '20-F' || forms[k] === '40-F') { last10k = dates[k]; break; } }
      done[c.cik] = { cik: c.cik, name: j.name || c.name, tickers: j.tickers && j.tickers.length ? j.tickers : c.tickers, exchanges: (j.exchanges || [...c.exchanges]).filter(Boolean), sic: j.sic || '', sicDescription: j.sicDescription || '', stateOfIncorporation: j.stateOfIncorporation || '', category: j.category || '', entityType: j.entityType || '', ein: j.ein || '', fiscalYearEnd: j.fiscalYearEnd || '', city: addr.city || '', state: addr.stateOrCountry || '', formerNames: (j.formerNames || []).map(x => x.name).slice(0, 5), last10k, filings: forms.length, website: j.website || '' };
      ok++; return;
    } catch (e) { if (attempt === 2) { done[c.cik] = { cik: c.cik, name: c.name, tickers: c.tickers, exchanges: [...c.exchanges], error: String(e.message).slice(0, 80) }; fail++; } else await new Promise(s => setTimeout(s, 2000)); }
  }
}
function save() { fs.writeFileSync(OUT + '.tmp', JSON.stringify(done)); fs.renameSync(OUT + '.tmp', OUT); }
async function worker() {
  while (i < todo.length) {
    const c = todo[i++];
    const t0 = Date.now(); await one(c);
    const el = Date.now() - t0; if (el < 1000 / RATE * 4) await new Promise(s => setTimeout(s, 1000 / RATE * 4 - el)); // 4 workers × RATE/4 each
    if (Date.now() - lastSave > 15000) { save(); lastSave = Date.now(); console.log(`${i}/${todo.length} ok=${ok} fail=${fail} ${((Date.now() - started) / 1000 | 0)}s`); }
  }
}
await Promise.all([worker(), worker(), worker(), worker()]);
save(); console.log('done', ok, 'ok', fail, 'failed', ((Date.now() - started) / 1000 | 0), 's');
