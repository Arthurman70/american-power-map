// Fetches the top federal contract and grant recipients of each major agency for fiscal year 2025
// (Oct 2024 - Sep 2025, the most recent complete FY) from the USAspending API -> data/usaspending.json.
// No API key needed. Each row becomes a dollar-labeled "funds" edge: agency -> recipient.
import fs from 'node:fs';

const FY = { start_date: '2024-10-01', end_date: '2025-09-30' };
// USAspending toptier agency name -> curated node id in the power map
export const AGENCIES = [
  ['Department of Defense', 'dod'], ['Department of Health and Human Services', 'hhs'],
  ['Department of Veterans Affairs', 'va'], ['Department of Energy', 'energy'],
  ['National Aeronautics and Space Administration', 'nasa'], ['Department of Homeland Security', 'dhs'],
  ['General Services Administration', 'gsa'], ['Department of State', 'state'],
  ['Department of Agriculture', 'usda'], ['Department of Transportation', 'dot'],
  ['Department of Education', 'education'], ['Department of Justice', 'doj'],
  ['Department of the Treasury', 'treasury'], ['Department of Commerce', 'commerce'],
  ['Department of the Interior', 'interior'], ['Environmental Protection Agency', 'epa'],
  ['Department of Housing and Urban Development', 'hud'], ['Department of Labor', 'labor'],
  ['National Science Foundation', 'ag_nsf'], ['Social Security Administration', 'ssa'],
  ['Small Business Administration', 'sba'],
];
const KINDS = [
  { kind: 'contracts', codes: ['A', 'B', 'C', 'D'], limit: 25 },
  { kind: 'grants', codes: ['02', '03', '04', '05'], limit: 20 },
];

async function query(agency, k) {
  const body = { filters: { time_period: [FY], agencies: [{ type: 'awarding', tier: 'toptier', name: agency }], award_type_codes: k.codes }, category: 'recipient', limit: k.limit, page: 1 };
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch('https://api.usaspending.gov/api/v2/search/spending_by_category/recipient/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (r.status === 429 || r.status >= 500) { await new Promise(s => setTimeout(s, 3000 * (attempt + 1))); continue; }
      if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
      const j = await r.json();
      return (j.results || []).map(x => ({ name: x.name, amount: x.amount, uei: x.uei || null }));
    } catch (e) { if (attempt === 3) throw e; await new Promise(s => setTimeout(s, 3000)); }
  }
  return [];
}

const out = [];
for (const [agency, id] of AGENCIES) {
  for (const k of KINDS) {
    const results = await query(agency, k);
    out.push({ agency, agencyId: id, kind: k.kind, results });
    const total = results.reduce((a, r) => a + (r.amount || 0), 0);
    console.log(`${agency.padEnd(46)} ${k.kind.padEnd(9)} ${results.length} recipients, top-${k.limit} total $${(total / 1e9).toFixed(1)}B`);
    await new Promise(s => setTimeout(s, 400));
  }
}
fs.writeFileSync('data/usaspending.json', JSON.stringify({ fiscalYear: 2025, period: FY, fetched: new Date().toISOString().slice(0, 10), rows: out }));
console.log('wrote data/usaspending.json');
