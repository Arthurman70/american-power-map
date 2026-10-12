// Filters the IRS Exempt Organizations Business Master File (data/irs/eo1-4.csv, ~1.96M orgs) down to sizable
// organizations -> data/irs_large.json. Thresholds:
//   any subsection: annual revenue >= $250M or assets >= $1B
//   501(c)(4) social welfare, (c)(5) labor unions, (c)(6) trade associations: revenue >= $20M (politically active
//     groups are influential at much smaller budgets than hospitals and universities)
//   501(c)(14) credit unions: assets >= $2B
// Source: https://www.irs.gov/charities-non-profits/exempt-organizations-business-master-file-extract-eo-bmf
import fs from 'node:fs';
import readline from 'node:readline';

function parseCSVLine(line) {
  const out = []; let f = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"') { if (line[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { out.push(f); f = ''; } else f += ch;
  }
  out.push(f); return out;
}

const KEEP_SUB = new Set(['03', '04', '05', '06', '12', '14']);
const orgs = [];
let rows = 0;
for (const f of ['eo1', 'eo2', 'eo3', 'eo4']) {
  const rl = readline.createInterface({ input: fs.createReadStream(`data/irs/${f}.csv`), crlfDelay: Infinity });
  let H = null;
  for await (const line of rl) {
    if (!H) { H = {}; parseCSVLine(line).forEach((h, i) => H[h] = i); continue; }
    rows++;
    const p = parseCSVLine(line);
    const sub = p[H.SUBSECTION]; if (!KEEP_SUB.has(sub)) continue;
    if (p[H.STATUS] && p[H.STATUS] !== '01' && p[H.STATUS] !== '02') continue; // unconditional/conditional exemption only
    const rev = +p[H.REVENUE_AMT] || 0, assets = +p[H.ASSET_AMT] || 0;
    const big = rev >= 250e6 || assets >= 1e9;
    const political = (sub === '04' || sub === '05' || sub === '06') && rev >= 20e6;
    const cu = sub === '14' && assets >= 2e9;
    if (!(big || political || cu)) continue;
    orgs.push({
      ein: p[H.EIN], name: p[H.NAME], sortName: p[H.SORT_NAME] || '', city: p[H.CITY], state: p[H.STATE],
      subsection: sub, foundation: p[H.FOUNDATION], ntee: (p[H.NTEE_CD] || '').trim(),
      revenue: rev, assets, income: +p[H.INCOME_AMT] || 0, taxPeriod: p[H.TAX_PERIOD] || '',
    });
  }
}
orgs.sort((a, b) => b.revenue - a.revenue);
fs.writeFileSync('data/irs_large.json', JSON.stringify({ source: 'IRS EO BMF', fetched: new Date().toISOString().slice(0, 10), rows, orgs }));
const bySub = {}; for (const o of orgs) bySub[o.subsection] = (bySub[o.subsection] || 0) + 1;
console.log(`scanned ${rows.toLocaleString()} orgs, kept ${orgs.length}`, bySub);
console.log('top 12 by revenue:', orgs.slice(0, 12).map(o => `${o.name} $${(o.revenue / 1e9).toFixed(1)}B`).join(' | '));
