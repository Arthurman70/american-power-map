// Two-pass streaming aggregation of the SEC 13F bulk dataset -> data/f13.json
// Pass 1: per-CUSIP totals + issuer names + per-filer AUM. Match CUSIP issuer names to EDGAR company names.
// Pass 2: per (filer, CUSIP) sums for matched CUSIPs only -> top holders per company.
import fs from 'node:fs';
import readline from 'node:readline';
import { normName, sortedKey } from './names.mjs';

const DIR = process.env.F13_DIR || 'data/13f';
const TOP = 8;
const tsv = f => fs.readFileSync(`${DIR}/${f}`, 'utf8').split(/\r?\n/).filter(Boolean).map(l => l.split('\t'));

// --- submissions: choose accessions for the latest period, handling amendments ---
const sub = tsv('SUBMISSION.tsv'); const S = {}; sub[0].forEach((h, i) => S[h] = i);
const periods = {}; sub.slice(1).forEach(r => { periods[r[S.PERIODOFREPORT]] = (periods[r[S.PERIODOFREPORT]] || 0) + 1; });
const period = Object.entries(periods).sort((a, b) => b[1] - a[1])[0][0];
const cover = tsv('COVERPAGE.tsv'); const C = {}; cover[0].forEach((h, i) => C[h] = i);
const coverBy = {}; cover.slice(1).forEach(r => coverBy[r[C.ACCESSION_NUMBER]] = r);
const byFiler = {}; // cik -> {orig:[], restate:[], newh:[]}
sub.slice(1).forEach(r => {
  if (r[S.PERIODOFREPORT] !== period) return;
  const t = r[S.SUBMISSIONTYPE]; if (t !== '13F-HR' && t !== '13F-HR/A') return;
  const cik = r[S.CIK]; const acc = r[S.ACCESSION_NUMBER]; const cv = coverBy[acc] || [];
  const f = byFiler[cik] = byFiler[cik] || { orig: [], restate: [], newh: [], name: '', city: '', state: '' };
  f.name = f.name || cv[C.FILINGMANAGER_NAME] || ''; f.city = cv[C.FILINGMANAGER_CITY] || f.city; f.state = cv[C.FILINGMANAGER_STATEORCOUNTRY] || f.state;
  if (t === '13F-HR') f.orig.push(acc); else if ((cv[C.AMENDMENTTYPE] || '').toUpperCase().includes('RESTATE')) f.restate.push(acc); else f.newh.push(acc);
});
const CANON = [[/^VANGUARD/, 'vanguard'], [/^BLACKROCK/, 'blackrock'], [/^STATE STREET/, 'statestreet'], [/^FMR LLC|^FIDELITY MANAGEMENT/, 'co_fidelity'], [/^CAPITAL (WORLD|RESEARCH|INTERNATIONAL) INVESTORS/, 'capitalgroup'], [/^UBS /, 'ubs'], [/^JPMORGAN CHASE/, 'jpm'], [/^GOLDMAN SACHS/, 'gs'], [/^MORGAN STANLEY/, 'ms'], [/^BANK OF AMERICA/, 'bofa'], [/^WELLS FARGO/, 'wells'], [/^CITIGROUP/, 'citi']];
function canonFiler(cik, name) { const u = String(name || '').toUpperCase(); for (const [re, key] of CANON) if (re.test(u)) return key; return cik; }
const accFiler = {}; let nFilers = 0; const canonName = {};
for (const [cik, f] of Object.entries(byFiler)) {
  const accs = f.restate.length ? [f.restate.sort().at(-1)] : [...(f.orig.length ? [f.orig.sort().at(-1)] : []), ...f.newh]; // one original per filer: duplicate originals double-count
  if (!accs.length) continue; nFilers++; const key = canonFiler(cik, f.name); if (!canonName[key] || f.name.length < canonName[key].name.length) canonName[key] = { name: key === cik ? f.name : f.name.replace(/,? (INC|LLC|CORP|CO|GROUP AG|GROUP INC).?$/i, ''), city: f.city, state: f.state, cik }; accs.forEach(a => accFiler[a] = key);
}
console.log('period', period, 'filers', nFilers, 'accessions', Object.keys(accFiler).length);

// --- EDGAR names for matching ---
const ex = JSON.parse(fs.readFileSync('data/company_tickers_exchange.json', 'utf8')); const F = ex.fields; const iC = F.indexOf('cik'), iN = F.indexOf('name');
const nameToCik = new Map(); const prefixToCik = new Map(); const sortedToCik = new Map(); const compactToCik = new Map();
const compact = s => normName(s).replace(/ /g, '');
const edgar = fs.existsSync('data/edgar_companies.json') ? JSON.parse(fs.readFileSync('data/edgar_companies.json', 'utf8')) : {};
for (const r of ex.data) {
  const cik = r[iC]; const nn = normName(r[iN]); if (!nn) continue;
  if (!nameToCik.has(nn)) nameToCik.set(nn, cik); const sk = sortedKey(r[iN]); if (!sortedToCik.has(sk)) sortedToCik.set(sk, cik); const ck = compact(r[iN]); if (!compactToCik.has(ck)) compactToCik.set(ck, cik);
  const e = edgar[cik]; if (e && e.formerNames) for (const fn of e.formerNames) { const fnn = normName(fn); if (fnn && !nameToCik.has(fnn)) nameToCik.set(fnn, cik); }
  const tk = nn.split(' ');
  for (const L of [3, 2]) { if (tk.length >= L) { const p = L + ':' + tk.slice(0, L).join(' '); if (!prefixToCik.has(p)) prefixToCik.set(p, cik); else if (prefixToCik.get(p) !== cik) prefixToCik.set(p, -1); } }
}
// Issuer names that neither the current EDGAR name nor its former names cover (brand vs registrant renames).
const MANUAL = { 'EXXON MOBIL': 'XOM', 'GE AEROSPACE': 'GE', 'ALPHABET': 'GOOGL', 'META PLATFORMS': 'META', 'BERKSHIRE HATHAWAY': 'BRK-B' };
const tickerToCik = new Map(); { const iT = F.indexOf('ticker'); for (const r of ex.data) if (r[iT] && !tickerToCik.has(r[iT])) tickerToCik.set(r[iT], r[iC]); }
function matchName(name) {
  { const m = MANUAL[normName(name)]; if (m && tickerToCik.has(m)) return tickerToCik.get(m); }
  const nn = normName(name); if (!nn) return null;
  if (nameToCik.has(nn)) return nameToCik.get(nn); const sk = sortedKey(name); if (sortedToCik.has(sk)) return sortedToCik.get(sk); const ck = compact(name); if (ck.length >= 6 && compactToCik.has(ck)) return compactToCik.get(ck);
  const tk = nn.split(' ');
  for (const L of [3, 2]) { if (tk.length >= L) { const c = prefixToCik.get(L + ':' + tk.slice(0, L).join(' ')); if (c && c > 0) return c; } }
  return null;
}

// Hand-checked filing errors. Mirae Asset Global Investments reported 368,452 Berkshire CLASS A shares ($264.6B),
// more than half of all Class A shares outstanding; almost certainly Class B shares filed under the Class A CUSIP.
const EXCLUDE = new Set(['0001569395|084670108']);

// --- streaming helper ---
async function stream(fn) {
  const rl = readline.createInterface({ input: fs.createReadStream(`${DIR}/INFOTABLE.tsv`, { highWaterMark: 1 << 20 }), crlfDelay: Infinity });
  let H = null;
  for await (const line of rl) {
    if (!H) { H = {}; line.split('\t').forEach((h, i) => H[h] = i); continue; }
    const r = line.split('\t');
    if (!accFiler[r[H.ACCESSION_NUMBER]]) continue;
    if (r[H.PUTCALL]) continue;
    if (EXCLUDE.has(accFiler[r[H.ACCESSION_NUMBER]] + '|' + r[H.CUSIP])) continue;
    if (r[H.SSHPRNAMTTYPE] !== 'SH') continue;
    const v = +r[H.VALUE]; if (!(v > 0)) continue;
    // unit-error filter: drop rows whose implied share price is >10x off this security's median across filers
    if (MED) { const sh = +r[H.SSHPRNAMT]; const m = MED.get(r[H.CUSIP]); if (sh > 0 && m && (v / sh > m * 10 || v / sh < m / 10)) { DROPPED.rows++; DROPPED.value += v; continue; } }
    fn(r, H, v);
  }
}

// --- pass 0: median implied share price per CUSIP (catches filers reporting values in the wrong units) ---
let MED = null; const DROPPED = { rows: 0, value: 0 };
{ const prices = new Map();
  await stream((r, H, v) => { const sh = +r[H.SSHPRNAMT]; if (!(sh > 0)) return; const c = r[H.CUSIP]; let a = prices.get(c); if (!a) prices.set(c, a = []); a.push(v / sh); });
  MED = new Map(); for (const [c, a] of prices) { if (a.length < 3) continue; a.sort((x, y) => x - y); MED.set(c, a[a.length >> 1]); } }

// --- pass 1 ---
const cusip = {}; const filerAum = {}; let rows = 0;
await stream((r, H, v) => {
  rows++;
  const c = r[H.CUSIP]; const o = cusip[c] || (cusip[c] = { total: 0, names: {} });
  o.total += v; const nm = r[H.NAMEOFISSUER]; o.names[nm] = (o.names[nm] || 0) + 1;
  const f = accFiler[r[H.ACCESSION_NUMBER]]; filerAum[f] = (filerAum[f] || 0) + v;
});
console.log('pass1 rows', rows, 'cusips', Object.keys(cusip).length, 'dropped as unit errors:', DROPPED.rows, 'rows, USD bn', (DROPPED.value / 1e9).toFixed(0));

const cusipCik = {}; let matchedTotal = 0, allTotal = 0, matchedN = 0; const unmatched = [];
for (const [c, o] of Object.entries(cusip)) {
  allTotal += o.total;
  const name = Object.entries(o.names).sort((a, b) => b[1] - a[1])[0][0]; o.name = name;
  const cik = matchName(name);
  if (cik) { cusipCik[c] = cik; matchedTotal += o.total; matchedN++; } else unmatched.push([o.total, name, c]);
}
unmatched.sort((a, b) => b[0] - a[0]);
console.log('matched cusips', matchedN, 'value share', (matchedTotal / allTotal * 100).toFixed(1) + '%');
console.log('top unmatched:', unmatched.slice(0, 25).map(u => u[1] + ' $' + (u[0] / 1e9).toFixed(0) + 'B').join(' | '));

// --- pass 2 ---
const hold = {}; // cik -> { filer -> value }
await stream((r, H, v) => {
  const cik = cusipCik[r[H.CUSIP]]; if (!cik) return;
  const f = accFiler[r[H.ACCESSION_NUMBER]]; const h = hold[cik] || (hold[cik] = {}); h[f] = (h[f] || 0) + v;
});
const companies = {}; const usedFilers = new Set();
for (const [cik, h] of Object.entries(hold)) {
  const entries = Object.entries(h).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((a, e) => a + e[1], 0);
  const top = entries.slice(0, TOP).map(([f, v]) => { usedFilers.add(f); return [f, Math.round(v), +(v / total * 100).toFixed(2)]; });
  companies[cik] = { instTotal: Math.round(total), holders: entries.length, top };
}
const filers = {};
for (const f of usedFilers) { const b = canonName[f] || byFiler[f]; filers[f] = { name: b.name, city: b.city, state: b.state, cik: b.cik || f, aum: Math.round(filerAum[f] || 0) }; }
fs.writeFileSync('data/f13.json', JSON.stringify({ period, companies, filers, unmatchedTop: unmatched.slice(0, 300).map(u => ({ value: Math.round(u[0]), name: u[1], cusip: u[2] })) }));
console.log('companies', Object.keys(companies).length, 'filers used', usedFilers.size);
