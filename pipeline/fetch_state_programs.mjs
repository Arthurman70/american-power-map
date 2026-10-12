// Fetches FY2025 federal grant and direct-payment obligations (SNAP benefits are booked as direct payments) by
// state (plus DC) for the big formula programs that fund state governments, from the USAspending geography API -> data/state_programs.json. No API key needed.
// Each program becomes a dollar-labeled "funds" edge from its federal agency to every state (and DC), so chains
// like Congress -> HHS -> CMS -> <state> cover all 51 jurisdictions instead of only an agency's top recipients.
import fs from 'node:fs';

const FY = { start_date: '2024-10-01', end_date: '2025-09-30' };
// key, agency node id, label, assistance listings (CFDA) summed into one edge
export const PROGRAMS = [
  { key: 'medicaid', agency: 'cms', label: 'Medicaid (federal share)', aln: ['93.778'] },
  { key: 'chip', agency: 'cms', label: 'Children’s Health Insurance Program', aln: ['93.767'], addTo: 'medicaid' },
  { key: 'highways', agency: 'dot', label: 'Federal-aid highways', aln: ['20.205'] },
  { key: 'snap', agency: 'fns', label: 'SNAP and child nutrition', aln: ['10.551', '10.561', '10.555', '10.553', '10.557'] },
  { key: 'title1', agency: 'education', label: 'Title I and special education', aln: ['84.010', '84.027'] },
  { key: 'tanf', agency: 'hhs_acf', label: 'TANF, child care and foster care', aln: ['93.558', '93.575', '93.596', '93.658'] },
];
const STATES = { AL: 'st_al', AK: 'st_ak', AZ: 'st_az', AR: 'st_ar', CA: 'st_ca', CO: 'st_co', CT: 'st_ct', DE: 'st_de', FL: 'st_fl', GA: 'st_ga', HI: 'st_hi', ID: 'st_id', IL: 'st_il', IN: 'st_in', IA: 'st_ia', KS: 'st_ks', KY: 'st_ky', LA: 'st_la', ME: 'st_me', MD: 'st_md', MA: 'st_ma', MI: 'st_mi', MN: 'st_mn', MS: 'st_ms', MO: 'st_mo', MT: 'st_mt', NE: 'st_ne', NV: 'st_nv', NH: 'st_nh', NJ: 'st_nj', NM: 'st_nm', NY: 'st_ny', NC: 'st_nc', ND: 'st_nd', OH: 'st_oh', OK: 'st_ok', OR: 'st_or', PA: 'st_pa', RI: 'st_ri', SC: 'st_sc', SD: 'st_sd', TN: 'st_tn', TX: 'st_tx', UT: 'st_ut', VT: 'st_vt', VA: 'st_va', WA: 'st_wa', WV: 'st_wv', WI: 'st_wi', WY: 'st_wy', DC: 'ct_dc' };
export { STATES };

async function query(aln) {
  const body = { scope: 'place_of_performance', geo_layer: 'state', filters: { time_period: [FY], program_numbers: aln, award_type_codes: ['02', '03', '04', '05', '06', '10', '11'] } };
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const r = await fetch('https://api.usaspending.gov/api/v2/search/spending_by_geography/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (r.status === 429 || r.status >= 500) { await new Promise(s => setTimeout(s, 4000 * (attempt + 1))); continue; }
      if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
      return (await r.json()).results || [];
    } catch (e) { if (attempt === 4) throw e; await new Promise(s => setTimeout(s, 4000)); }
  }
  return [];
}

const out = { fiscalYear: 2025, period: FY, fetched: new Date().toISOString().slice(0, 10), programs: [] };
for (const p of PROGRAMS) {
  const rows = await query(p.aln);
  const byState = {};
  for (const r of rows) if (STATES[r.shape_code]) byState[r.shape_code] = { amount: Math.round(r.aggregated_amount), population: r.population };
  const total = Object.values(byState).reduce((a, r) => a + r.amount, 0);
  out.programs.push({ ...p, byState });
  console.log(`${p.label.padEnd(42)} ${Object.keys(byState).length} jurisdictions, $${(total / 1e9).toFixed(1)}B`);
  await new Promise(s => setTimeout(s, 500));
}
fs.writeFileSync('data/state_programs.json', JSON.stringify(out));
