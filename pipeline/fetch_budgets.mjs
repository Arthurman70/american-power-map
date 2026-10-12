// Fetches each major agency's FY2025 total obligations and its sub-agencies' obligations from the USAspending agency
// profile API -> data/agency_budgets.json. These put reported dollars on the top of every federal-money chain:
// Congress -> agency (what the agency obligated under the authority Congress provided) and agency -> sub-agency.
import fs from 'node:fs';

const FY = 2025;
// toptier code, agency node id, sub-agency name pattern -> node id
export const BUDGET_AGENCIES = [
  ['075', 'hhs', [[/Medicare and Medicaid/, 'cms'], [/Children and Families/, 'hhs_acf'], [/National Institutes of Health/, 'nih'], [/Disease Control/, 'cdc'], [/Food and Drug/, 'fda'], [/Indian Health/, 'hs_ihs'], [/Substance Abuse/, 'fg_samhsa']]],
  ['097', 'dod', [[/Department of the Navy/, 'navy'], [/Department of the Army/, 'army'], [/Department of the Air Force/, 'airforce'], [/Advanced Research Projects/, 'darpa']]],
  ['036', 'va', []],
  ['089', 'energy', [[/Nuclear Security/, 'nnsa']]],
  ['080', 'nasa', []],
  ['070', 'dhs', [[/Immigration and Customs/, 'ice'], [/Customs and Border/, 'cbp'], [/Emergency Management/, 'fema'], [/Transportation Security/, 'tsa'], [/Coast Guard/, 'uscg'], [/Secret Service/, 'usss'], [/Cybersecurity/, 'cisa'], [/Citizenship and Immigration/, 'uscis']]],
  ['047', 'gsa', []],
  ['019', 'state', []],
  ['012', 'usda', [[/Food and Nutrition/, 'fns'], [/Forest Service/, 'usfs']]],
  ['069', 'dot', [[/Federal Aviation/, 'faa'], [/Highway Traffic Safety/, 'nhtsa']]],
  ['091', 'education', [[/Federal Student Aid/, 'fsa']]],
  ['015', 'doj', [[/Federal Bureau of Investigation/, 'fbi'], [/Drug Enforcement/, 'dea'], [/Alcohol, Tobacco/, 'atf'], [/Bureau of Prisons|Federal Prison System/, 'bop'], [/Marshals/, 'usms']]],
  ['020', 'treasury', [[/Internal Revenue/, 'irs'], [/Fiscal Service/, 'fiscal']]],
  ['013', 'commerce', [[/Oceanic and Atmospheric/, 'noaa'], [/Census/, 'census'], [/Standards and Technology/, 'nist'], [/Patent and Trademark/, 'uspto']]],
  ['014', 'interior', [[/Land Management/, 'blm'], [/National Park/, 'nps'], [/Fish and Wildlife/, 'fws'], [/Indian Affairs/, 'bia'], [/Reclamation/, 'usbr']]],
  ['068', 'epa', []],
  ['086', 'hud', []],
  ['1601', 'labor', [[/Occupational Safety/, 'osha']]],
  ['049', 'ag_nsf', []],
  ['028', 'ssa', []],
  ['073', 'sba', []],
  ['024', 'opm', []],
  ['096', 'usace', []],
];

async function get(url) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const r = await fetch(url);
      if (r.status === 429 || r.status >= 500) { await new Promise(s => setTimeout(s, 4000 * (attempt + 1))); continue; }
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return await r.json();
    } catch (e) { if (attempt === 4) throw e; await new Promise(s => setTimeout(s, 4000)); }
  }
}

const out = { fiscalYear: FY, fetched: new Date().toISOString().slice(0, 10), agencies: [] };
for (const [code, id, subs] of BUDGET_AGENCIES) {
  const br = await get(`https://api.usaspending.gov/api/v2/agency/${code}/budgetary_resources/`);
  const y = br.agency_data_by_year.find(x => x.fiscal_year === FY) || {};
  const row = { code, id, obligated: y.agency_total_obligated ?? null, budgetaryResources: y.agency_budgetary_resources ?? null, subs: [] };
  if (subs.length) {
    const sa = await get(`https://api.usaspending.gov/api/v2/agency/${code}/sub_agency/?fiscal_year=${FY}&limit=100`);
    for (const s of sa.results || []) { const m = subs.find(([re]) => re.test(s.name)); if (m) row.subs.push({ id: m[1], name: s.name, obligated: s.total_obligations }); }
  }
  out.agencies.push(row);
  console.log(`${id.padEnd(10)} $${((row.obligated || 0) / 1e9).toFixed(1)}B obligated · ${row.subs.map(s => `${s.id} $${(s.obligated / 1e9).toFixed(1)}B`).join(', ')}`);
  await new Promise(s => setTimeout(s, 300));
}
fs.writeFileSync('data/agency_budgets.json', JSON.stringify(out));
