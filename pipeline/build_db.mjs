// Builds data/powermap.db (SQLite) from: curated.json (the hand-built map), edgar_companies.json (SEC company list
// with SIC codes), f13.json (13F institutional ownership), and XBRL frames (revenue / net income / assets).
// Usage: node pipeline/build_db.mjs [out.db]
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { normName } from './names.mjs';
import { prettyName } from './pretty.mjs';
import { AGENCY_BUDGET, NONPROFIT_FUNDING } from './budgets.mjs';
import { addExtraSources, noteAmount } from './extra_sources.mjs';

const OUT = process.argv[2] || 'data/powermap.db';
const curated = JSON.parse(fs.readFileSync('data/curated.json', 'utf8'));
const edgar = JSON.parse(fs.readFileSync('data/edgar_companies.json', 'utf8'));
const f13 = JSON.parse(fs.readFileSync('data/f13.json', 'utf8'));
const frame = (name) => { try { const j = JSON.parse(fs.readFileSync(`data/frames_${name}.json`, 'utf8')); const m = {}; for (const d of j.data) m[d.cik] = d.val; return m; } catch { return {}; } };
const REV = [frame('Revenues_CY2025'), frame('RevenueFromContractWithCustomerExcludingAssessedTax_CY2025'), frame('Revenues_CY2024'), frame('RevenueFromContractWithCustomerExcludingAssessedTax_CY2024')];
const NI = [frame('NetIncomeLoss_CY2025'), frame('NetIncomeLoss_CY2024')];
const ASSETS = [frame('Assets_CY2025Q4I'), frame('Assets_CY2025Q2I'), frame('Assets_CY2024Q4I')];
const pickFrame = (arr, cik) => { for (const m of arr) if (m[cik] !== undefined) return m[cik]; return null; };
const f13Period = (() => { const m = f13.period.match(/(\d+)-([A-Z]+)-(\d+)/); const q = { MAR: 'Q1', JUN: 'Q2', SEP: 'Q3', DEC: 'Q4' }[m[2]] || m[2]; return `${q} ${m[3]}`; })();

// ---------- curated node <-> EDGAR ticker links (single-company curated centers only) ----------
const TICKER_LINK = { apple: 'AAPL', microsoft: 'MSFT', alphabet: 'GOOGL', amazon: 'AMZN', meta: 'META', nvidia: 'NVDA', oracle: 'ORCL', exxon: 'XOM', chevron: 'CVX', lockheed: 'LMT', rtx: 'RTX', boeing: 'BA', unitedhealth: 'UNH', walmart: 'WMT', jpm: 'JPM', gs: 'GS', bofa: 'BAC', citi: 'C', ms: 'MS', wells: 'WFC', berkshire: 'BRK-B', blackrock: 'BLK', statestreet: 'STT', palantir: 'PLTR', co_intel: 'INTC', co_amd: 'AMD', co_broadcom: 'AVGO', co_micron: 'MU', co_cloudflare: 'NET', co_roblox: 'RBLX', co_gm: 'GM', co_ford: 'F', co_costco: 'COST', co_gd: 'GD', co_northrop: 'NOC', co_pfizer: 'PFE', co_jnj: 'JNJ', co_lilly: 'LLY', co_moderna: 'MRNA', co_hca: 'HCA', co_schwab: 'SCHW', co_robinhood: 'HOOD', co_coinbase: 'COIN', co_apollo: 'APO', co_kkr: 'KKR', co_carlyle: 'CG', co_blackstone: 'BX', co_ice: 'ICE', spacex_tesla: 'TSLA', co_blueorigin: null, youtube: null, tko: 'TKO', reddit: 'RDDT', co_geaero: 'GE', co_caterpillar: 'CAT', co_duke: 'DUK', co_pge: 'PCG', co_conoco: 'COP', co_cheniere: 'LNG', co_adm: 'ADM', co_tyson: 'TSN', co_corteva: 'CTVA', co_coke: 'KO', co_pg: 'PG', co_nike: 'NKE', co_homedepot: 'HD', co_target: 'TGT', co_dollar: 'DG', co_marriott: 'MAR', co_l3: 'LHX', co_textron: 'TXT', co_amgen: 'AMGN', co_medtronic: 'MDT', co_mckesson: 'MCK', co_labcorp: 'LH', co_tenet: 'THC', co_humana: 'HUM', co_cigna: 'CI', co_lennar: 'LEN', co_landlords: 'INVH', co_delta: 'DAL', co_railroads: 'UNP', co_upsfedex: 'UPS', co_nucor: 'NUE', co_alcoa: 'AA', co_constellation: 'CEG', co_exelon: 'EXC', co_refiners: 'MPC', co_pipelines: 'ET', co_oilfield: 'SLB', co_coal: 'BTU', co_qualcomm: 'QCOM', co_asml: 'AMAT', co_dell: 'DELL', co_cisco: 'CSCO', co_salesforce: 'CRM', co_paloalto: 'PANW', co_okta: 'OKTA', co_zoom: 'ZM', co_snap: 'SNAP', co_airbnb: 'ABNB', co_ebay: 'EBAY', co_zillow: 'Z', co_carvana: 'CVNA', co_rivian: 'RIVN', co_honeywell: 'HON', co_dow: 'DOW', co_moodys: 'MCO', co_amex: 'AXP', co_nasdaq: 'NDAQ', co_prudential: 'PRU', co_pcinsurers: 'ALL', co_regionalbanks: 'PNC', co_rocketlab: 'RKLB', co_planet: 'PL', co_epicgames: null, co_novo: 'NVO', co_related: 'PLD', co_stripe: 'PYPL', co_boozallen: 'BAH', co_oraclehealth: 'TDOC', co_waymo: null, co_kuiper: null, co_twitch: null, co_linkedin: null, co_telegram: null, co_databricks: null, co_perplexity: null, co_shieldai: null, co_cellebrite: 'CLBT', co_wework: null, co_bcbs: null, co_nursinghomes: 'ENSG', co_circle: 'CRCL', co_ripple: null, co_dtcc: null, co_fhlb: null, co_reinsurers: null, co_tsmc: 'TSM', co_walgreens: null, co_stellantis: 'STLA', co_softbank: null, co_sequoia: null, co_ycomb: null, co_janestreet: null, co_pershing: null, co_elliott: null, co_millennium: null, co_bridgewater: null, co_citadel: null, co_tpg: 'TPG', telecom: 'T', semis: null, utilities: 'NEE', oil_indep: 'FANG', other_primes: null, pharma: null, hospitals: null, insurers: 'ELV', retail: null, food_ag: 'DE', automakers: null, transport: null, realestate: null, adagencies: 'OMC', prisons: 'GEO', surveil: 'AXON', privsec: null, creditbureaus: 'EFX', pbm: 'CVS', gigplat: 'UBER', mining: 'FCX', renewables: 'FSLR', datacenters: null, tobacco: 'MO', gambling: 'DKNG', restaurants: 'MCD', consumerfin: 'COF', cloud: null, exchanges: 'CME', ratings: 'SPGI', visa: 'V', big4: null, consult: null, biglaw: null, hedge: null, pe: null, crypto: null, anduril: null, openai: null, anthropic: null, indie: null, gse: 'FNMA' };
// group centers whose ticker link is only a representative member get a "member" relationship rather than a merge:
const GROUP_REPRESENTATIVE = new Set(['gse', 'co_stellantis', 'co_nursinghomes', 'co_landlords', 'co_railroads', 'co_upsfedex', 'co_refiners', 'co_pipelines', 'co_oilfield', 'co_coal', 'co_asml', 'co_dell', 'co_cisco', 'co_salesforce', 'co_paloalto', 'co_okta', 'co_zoom', 'co_snap', 'co_airbnb', 'co_ebay', 'co_zillow', 'co_carvana', 'co_rivian', 'co_honeywell', 'co_dow', 'co_moodys', 'co_amex', 'co_nasdaq', 'co_prudential', 'co_pcinsurers', 'co_regionalbanks', 'co_rocketlab', 'co_planet', 'co_novo', 'co_related', 'co_stripe', 'co_boozallen', 'co_oraclehealth', 'co_tpg', 'telecom', 'utilities', 'oil_indep', 'insurers', 'food_ag', 'adagencies', 'prisons', 'surveil', 'creditbureaus', 'pbm', 'gigplat', 'mining', 'renewables', 'tobacco', 'gambling', 'restaurants', 'consumerfin', 'exchanges', 'ratings', 'visa', 'co_geaero', 'co_duke', 'co_conoco', 'co_adm', 'co_tyson', 'co_corteva', 'co_coke', 'co_pg', 'co_nike', 'co_homedepot', 'co_target', 'co_dollar', 'co_marriott', 'co_l3', 'co_textron', 'co_amgen', 'co_medtronic', 'co_mckesson', 'co_labcorp', 'co_tenet', 'co_humana', 'co_cigna', 'co_lennar', 'co_delta', 'co_nucor', 'co_alcoa', 'co_constellation', 'co_exelon', 'co_pge', 'co_cheniere', 'co_caterpillar', 'co_qualcomm', 'spacex_tesla', 'co_cellebrite', 'co_tsmc', 'co_circle']);

// ---------- SIC -> industry / category / regulators ----------
function sicInfo(sic) {
  const s = +sic || 0, d2 = Math.floor(s / 100);
  let ind = 'Other business', cat = 'economic'; const regs = [];
  const R = (id, w, note) => regs.push([id, w, note]);
  if (s >= 100 && s < 1000) { ind = 'Agribusiness'; cat = 'environmental'; R('usda', 2, 'Farm programs and inspection'); }
  else if (d2 === 10 || d2 === 14 || (s >= 3310 && s < 3400)) { ind = 'Steel, mining & metals'; cat = d2 === 33 ? 'economic' : 'environmental'; if (d2 !== 33) { R('interior', 2, 'Mining permits on federal land'); R('epa', 2, 'Air, water and waste rules'); } }
  else if (d2 === 12) { ind = 'Coal'; cat = 'environmental'; R('interior', 2, 'Mining permits and reclamation'); R('epa', 3, 'Emissions and water rules'); }
  else if (d2 === 13 || d2 === 29) { ind = 'Oil & gas'; cat = 'environmental'; R('interior', 2, 'Leasing on federal land and waters'); R('epa', 2, 'Emissions, methane and refinery rules'); }
  else if (d2 >= 15 && d2 <= 17) { ind = 'Real estate & construction'; }
  else if (d2 === 20 || s === 2111 || d2 === 21) { ind = 'Food, beverage & consumer goods'; R('fda', s === 2111 ? 3 : 2, s === 2111 ? 'Tobacco product authority' : 'Food safety and labeling'); if (d2 === 20) R('usda', 2, 'Meat, poultry and dairy inspection'); }
  else if (d2 === 27 || s === 2711 || s === 2721) { ind = 'News media'; cat = 'cultural'; }
  else if (s === 2834 || s === 2835 || s === 2836 || s === 8731) { ind = 'Pharmaceuticals'; R('fda', 4, 'Drug approval and manufacturing oversight'); R('cms', 2, 'Medicare and Medicaid pricing'); }
  else if (d2 === 28) { ind = 'Chemicals'; cat = 'environmental'; R('epa', 3, 'Toxics, air and water rules'); }
  else if (s >= 3840 && s < 3852) { ind = 'Medical devices'; R('fda', 4, 'Device clearance and recalls'); R('cms', 2, 'Reimbursement'); }
  else if (s === 3674 || s === 3672 || (s >= 3670 && s < 3680) || (s >= 3570 && s < 3580)) { ind = 'Electronics & semiconductors'; R('bis', 2, 'Export controls on advanced chips'); }
  else if (s === 3711 || s === 3713 || s === 3714 || s === 3716 || s === 3751) { ind = 'Automotive & robotics'; R('nhtsa', 3, 'Vehicle safety standards and recalls'); R('epa', 2, 'Emissions standards'); }
  else if (s === 3720 || s === 3721 || s === 3724 || s === 3728) { ind = 'Defense'; R('faa', 3, 'Aircraft certification'); R('dod', 3, 'Prime contracts'); }
  else if (s === 3760 || s === 3761 || s === 3769 || s === 3480 || s === 3812 || s === 3795) { ind = 'Defense'; R('dod', 4, 'Prime contracts and export licensing'); }
  else if (d2 >= 30 && d2 <= 39) { ind = 'Industrial manufacturing'; }
  else if (s === 4011 || s === 4013) { ind = 'Railroads & logistics'; R('dot', 3, 'Rail safety (FRA) and rate oversight'); }
  else if (d2 === 42 || s === 4731 || s === 4700) { ind = 'Railroads & logistics'; R('dot', 2, 'Motor carrier safety'); }
  else if (d2 === 44) { ind = 'Railroads & logistics'; R('ag_fmc', 2, 'Ocean shipping rules'); R('uscg', 2, 'Vessel safety'); }
  else if (d2 === 45) { ind = 'Air transport'; R('faa', 4, 'Certification, airspace and safety'); R('dot', 2, 'Consumer rules and route authority'); }
  else if (s >= 4810 && s < 4900) { ind = (s === 4832 || s === 4833 || s === 4841) ? 'TV, movies, music & games' : 'Telecom'; cat = (s === 4832 || s === 4833 || s === 4841) ? 'cultural' : 'economic'; R('fcc', 4, 'Licensing and spectrum'); }
  else if (s === 4911 || s === 4931 || s === 4932 || s === 4939) { ind = 'Electric utilities'; cat = 'environmental'; R('ferc', 3, 'Wholesale rates and transmission'); R('nrc', 1, 'Nuclear units, where operated'); R('epa', 2, 'Power-plant emissions'); }
  else if (s === 4922 || s === 4923 || s === 4924 || s === 4610) { ind = 'Oil & gas'; cat = 'environmental'; R('ferc', 3, 'Pipeline rates and siting'); }
  else if (s === 4941 || s === 4950 || s === 4953 || s === 4955) { ind = 'Electric utilities'; cat = 'environmental'; R('epa', 3, 'Water and waste rules'); }
  else if (d2 >= 50 && d2 <= 59) { ind = 'Retail'; R('ftc', 1, 'Consumer protection'); }
  else if (s >= 6020 && s < 6040 || s === 6712 || s === 6099) { ind = 'Commercial banks'; R('fed', 3, 'Holding-company supervision and capital'); R('occ', 3, 'National-bank charter and examination'); R('fdic', 2, 'Deposit insurance and resolution'); R('cfpb', 2, 'Consumer-finance rules'); }
  else if (s >= 6100 && s < 6200) { ind = 'Finance & credit'; R('cfpb', 3, 'Lending and servicing rules'); }
  else if (s >= 6200 && s < 6300) { ind = 'Securities & investment'; }
  else if (s === 6324) { ind = 'Health insurance'; R('cms', 3, 'Medicare Advantage and ACA rules'); }
  else if (s >= 6300 && s < 6500) { ind = 'Insurance'; R('states', 2, 'State insurance commissioners'); }
  else if (s >= 6500 && s < 6600 || s === 6798) { ind = 'Real estate & construction'; }
  else if (s >= 6700 && s < 6800) { ind = 'Securities & investment'; }
  else if (d2 === 70) { ind = 'Lodging & tourism'; }
  else if (s >= 7370 && s < 7380) { ind = 'Internet & software'; R('ftc', 1, 'Privacy and competition'); }
  else if (s === 7389 || s === 7381 || s === 7380) { ind = 'Other business'; }
  else if (s >= 7800 && s < 8000) { ind = 'TV, movies, music & games'; cat = 'cultural'; }
  else if (s === 8051 || s === 8062 || s === 8060 || s === 8082 || s === 8090 || s === 8093 || s === 8011 || s === 8071) { ind = 'Hospitals & nursing homes'; R('cms', 4, 'Medicare/Medicaid conditions of participation'); }
  else if (s >= 8000 && s < 8100) { ind = 'Health services'; R('cms', 3, 'Reimbursement'); }
  else if (d2 === 82) { ind = 'Education'; R('education', 3, 'Title IV student aid'); }
  else if (s === 6770) { ind = 'Blank-check (SPAC)'; }
  return { ind, cat, regs };
}

// ---------- helpers ----------
const money = v => v === null || v === undefined ? null : (Math.abs(v) >= 1e12 ? (v / 1e12).toFixed(2) + 'T' : Math.abs(v) >= 1e9 ? (v / 1e9).toFixed(1) + 'B' : Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(0) + 'M' : (v / 1e3).toFixed(0) + 'K');
const powerFromValue = v => v >= 1e12 ? 9 : v >= 3e11 ? 8 : v >= 1e11 ? 7 : v >= 3e10 ? 6 : v >= 1e10 ? 5 : v >= 3e9 ? 4 : v >= 1e9 ? 3 : v >= 3e8 ? 2 : 1;
const tierFromPower = p => p >= 8 ? 1 : p >= 6 ? 2 : p >= 4 ? 3 : 4;
const pctWeight = pct => pct >= 10 ? 5 : pct >= 5 ? 4 : pct >= 2.5 ? 3 : pct >= 1 ? 2 : 1;
const slugify = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
// Which of instValue/revenue/(assets*0.1) drove a company's size, for the detail-panel label.
function basisLabel(instValue, revenue, assetsBasis) {
  const iv = instValue || 0, rv = revenue || 0, ab = assetsBasis || 0;
  if (iv === 0 && rv === 0 && ab === 0) return null;
  if (rv >= iv && rv >= ab) return 'Annual revenue';
  if (iv >= ab) return '13F institutional holdings';
  return 'Assets (10%, illustrative)';
}
// Government budgets are stretched x10 (a decade of budget authority) so agencies read on the same dollar
// scale as a company's revenue history; nonprofits use a single year, like a company's revenue. Returns
// {funding, fundingBasis, power, tier} or null if this id has no funding figure attached.
function fundingFor(node) {
  const id = node.id;
  // a node from pipeline/additions2.mjs (or similar) can carry its own funding figure directly
  if (node.funding != null && node.funding > 0) {
    const power = powerFromValue(node.funding);
    return { funding: node.funding, fundingBasis: node.fundingBasis || null, power, tier: tierFromPower(power) };
  }
  const gov = AGENCY_BUDGET[id];
  if (gov) {
    const funding = gov.noStretch ? gov.annual : gov.annual * 10;
    const fundingBasis = gov.basis + (gov.noStretch ? '' : ' × 10 (illustrative decade total, for comparison with corporate revenue)');
    const power = powerFromValue(funding);
    return { funding, fundingBasis, power, tier: tierFromPower(power) };
  }
  const npo = NONPROFIT_FUNDING[id];
  if (npo) { const power = powerFromValue(npo.annual); return { funding: npo.annual, fundingBasis: npo.basis, power, tier: tierFromPower(power) }; }
  return null;
}

// ---------- DB ----------
if (fs.existsSync(OUT)) fs.unlinkSync(OUT);
const db = new DatabaseSync(OUT);
db.exec(`
PRAGMA journal_mode=WAL; PRAGMA synchronous=OFF;
CREATE TABLE nodes(id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, sector TEXT NOT NULL, branch TEXT NOT NULL, industry TEXT NOT NULL,
  dm TEXT DEFAULT '', power REAL NOT NULL, tier INTEGER NOT NULL, description TEXT DEFAULT '', source TEXT NOT NULL,
  cik INTEGER, ticker TEXT, exchange TEXT, sic INTEGER, sic_desc TEXT, state TEXT, hq TEXT, revenue REAL, net_income REAL, assets REAL, inst_value REAL, inst_holders INTEGER,
  funding REAL, funding_basis TEXT, ein TEXT, fec_id TEXT,
  grp TEXT, party TEXT, aliases TEXT, deg INTEGER DEFAULT 0, out_w INTEGER DEFAULT 0, in_w INTEGER DEFAULT 0, has_dark INTEGER DEFAULT 0);
CREATE TABLE edges(id INTEGER PRIMARY KEY, src TEXT NOT NULL, dst TEXT NOT NULL, type TEXT NOT NULL, weight INTEGER NOT NULL, note TEXT DEFAULT '', source TEXT NOT NULL, amount REAL, amount_basis TEXT, UNIQUE(src,dst));
CREATE INDEX edges_src ON edges(src); CREATE INDEX edges_dst ON edges(dst); CREATE INDEX edges_w ON edges(weight);
CREATE TABLE positions(layout TEXT NOT NULL, node_id TEXT NOT NULL, x REAL, y REAL, z REAL, PRIMARY KEY(layout,node_id));
CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE sources(key TEXT PRIMARY KEY, label TEXT, url TEXT, asof TEXT, nodes INTEGER DEFAULT 0, edges INTEGER DEFAULT 0);
`);
const insNode = db.prepare(`INSERT INTO nodes(id,name,category,sector,branch,industry,dm,power,tier,description,source,cik,ticker,exchange,sic,sic_desc,state,hq,revenue,net_income,assets,inst_value,inst_holders,funding,funding_basis,grp,party,aliases)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const insEdge = db.prepare(`INSERT OR IGNORE INTO edges(src,dst,type,weight,note,source,amount) VALUES(?,?,?,?,?,?,?)`);
const attach13f = db.prepare("UPDATE edges SET amount=?, note=CASE WHEN note IS NULL OR note='' THEN ? ELSE note || ' · ' || ? END WHERE src=? AND dst=? AND amount IS NULL");
const updNodeEdgar = db.prepare(`UPDATE nodes SET cik=?, ticker=?, exchange=?, sic=?, sic_desc=?, state=?, hq=?, revenue=?, net_income=?, assets=?, inst_value=?, inst_holders=?, aliases=COALESCE(aliases,'')||?, funding=COALESCE(?,funding), funding_basis=COALESCE(?,funding_basis), power=COALESCE(?,power), tier=COALESCE(?,tier) WHERE id=?`);

const nodeIds = new Set(); const stats = { curatedNodes: 0, curatedEdges: 0, edgarNodes: 0, edgarMerged: 0, holderNodes: 0, ownEdges: 0, regEdges: 0, skipped: 0 };
db.exec('BEGIN');
// 1. curated
for (const n of curated.nodes) {
  const f = fundingFor(n);
  const power = f ? f.power : n.power, tier = f ? f.tier : n.tier;
  insNode.run(n.id, n.name, n.category, n.sector, n.branch, n.industry, n.dm, power, tier, n.description, 'curated', null, null, null, null, null, null, null, null, null, null, null, null, f ? f.funding : null, f ? f.fundingBasis : null, n.group, n.party, n.aliases);
  nodeIds.add(n.id); stats.curatedNodes++;
}
for (const e of curated.edges) { insEdge.run(e.from, e.to, e.type, e.weight, e.note, 'curated', noteAmount(e.note)); stats.curatedEdges++; }

// 2. EDGAR companies
const tickerToCurated = {}; for (const [id, t] of Object.entries(TICKER_LINK)) if (t) tickerToCurated[t] = id;
const cikNode = {}; // cik -> node id
const companies = Object.values(edgar).filter(c => !c.error && c.tickers && c.tickers.length && (c.entityType === 'operating' || !c.entityType));
const ownerRows = f13.companies;
for (const c of companies) {
  const sic = +c.sic || 0; if (sic === 6770 || sic === 6189) { stats.skipped++; continue; } // SPAC shells, asset-backed issuers
  const own = ownerRows[c.cik] || ownerRows[String(c.cik)]; const instValue = own ? own.instTotal : null;
  const revenue = pickFrame(REV, c.cik), ni = pickFrame(NI, c.cik), assets = pickFrame(ASSETS, c.cik);
  const primary = c.tickers[0]; const ex = (c.exchanges && c.exchanges[0]) || '';
  const link = c.tickers.map(t => tickerToCurated[t]).find(Boolean);
  const hq = [c.city && prettyName(c.city), c.state].filter(Boolean).join(', ');
  const aliasStr = '|' + [c.name, ...(c.formerNames || [])].join('|');
  const sizeBasis = Math.max(instValue || 0, revenue || 0, (assets || 0) * 0.1);
  if (link && !GROUP_REPRESENTATIVE.has(link) && nodeIds.has(link)) {
    const mergedPower = sizeBasis ? powerFromValue(sizeBasis) : null;
    updNodeEdgar.run(c.cik, primary, ex, sic || null, c.sicDescription || null, c.stateOfIncorporation || null, hq, revenue, ni, assets, instValue, own ? own.holders : null, aliasStr, sizeBasis || null, basisLabel(instValue, revenue, (assets || 0) * 0.1), mergedPower, mergedPower ? tierFromPower(mergedPower) : null, link);
    cikNode[c.cik] = link; stats.edgarMerged++; continue;
  }
  const { ind, cat, regs } = sicInfo(sic);
  const p = sizeBasis ? powerFromValue(sizeBasis) : 1; const t = tierFromPower(p);
  const id = 'co_' + slugify(primary || c.name) + (nodeIds.has('co_' + slugify(primary || c.name)) ? '_' + c.cik : '');
  const parts = [`${ex ? ex + ': ' : ''}${c.tickers.join(', ')}`, sic ? `SIC ${sic} ${prettyName(c.sicDescription || '')}` : null, c.stateOfIncorporation ? `incorporated in ${c.stateOfIncorporation}` : null, hq ? `HQ ${hq}` : null, revenue !== null ? `revenue $${money(revenue)}` : null, ni !== null ? `net income $${money(ni)}` : null, assets !== null ? `assets $${money(assets)}` : null, own ? `${own.holders.toLocaleString()} institutional holders reporting $${money(own.instTotal)} in ${f13Period} 13F filings` : null].filter(Boolean);
  const desc = `SEC-registered public company. ${parts.join(' · ')}. Power score is sized from institutional holdings, revenue and assets; relationships come from 13F ownership filings and the primary federal regulator for its SIC code.`;
  insNode.run(id, prettyName(c.name), cat, 'Business', 'Private', ind, ex ? `${ex}: ${primary}` : primary, p, t, desc, 'edgar', c.cik, primary, ex, sic || null, c.sicDescription || null, c.stateOfIncorporation || null, hq, revenue, ni, assets, instValue, own ? own.holders : null, sizeBasis || null, basisLabel(instValue, revenue, (assets || 0) * 0.1), null, null, aliasStr);
  nodeIds.add(id); cikNode[c.cik] = id; stats.edgarNodes++;
  // regulator edges
  if (nodeIds.has('sec')) { insEdge.run('sec', id, 'R', 2, 'Registered issuer: periodic reporting, disclosure and enforcement', 'edgar', null); stats.regEdges++; }
  for (const [rid, w, note] of regs) if (nodeIds.has(rid)) { insEdge.run(rid, id, 'R', w, `${note} (SIC ${sic})`, 'edgar', null); stats.regEdges++; }
  if (/NYSE/i.test(ex) && nodeIds.has('co_ice')) { insEdge.run('co_ice', id, 'R', 1, 'NYSE listing standards', 'edgar', null); stats.regEdges++; }
  if (/Nasdaq/i.test(ex) && nodeIds.has('co_nasdaq')) { insEdge.run('co_nasdaq', id, 'R', 1, 'Nasdaq listing standards', 'edgar', null); stats.regEdges++; }
  if (link && GROUP_REPRESENTATIVE.has(link) && nodeIds.has(link)) { insEdge.run(id, link, 'I', 2, 'Member of this industry group', 'edgar', null); }
}

// 3. 13F holders -> nodes, ownership edges
const holderNode = {};
function holderNodeId(key, f) {
  if (holderNode[key]) return holderNode[key];
  let id = null;
  if (nodeIds.has(key)) id = key;                                  // canonical key already a curated id (vanguard, blackrock...)
  else if (cikNode[+key] ) id = cikNode[+key];                      // filer is itself a listed company
  else if (cikNode[key]) id = cikNode[key];
  if (!id) {
    // try matching curated names loosely
    const nn = normName(f.name); const hit = curated.nodes.find(n => normName(n.name) === nn);
    if (hit) id = hit.id;
  }
  if (!id) {
    id = 'im_' + slugify(f.name) ; if (nodeIds.has(id)) id += '_' + key;
    const p = powerFromValue(f.aum); const t = tierFromPower(p);
    const hq = [f.city && prettyName(f.city), f.state].filter(Boolean).join(', ');
    const known = { capitalgroup: 'Capital Group (American Funds)', ubs: 'UBS' }[key];
    insNode.run(id, known || prettyName(f.name), 'economic', 'Business', 'Private', 'Securities & investment', hq, p, t, `Institutional investment manager reporting $${money(f.aum)} of U.S. equity holdings in ${f13Period} 13F filings${hq ? ' · ' + hq : ''}. Ownership arrows show where it ranks among the largest reported holders of a company.`, '13f', /^\d+$/.test(f.cik) ? +f.cik : null, null, null, null, null, null, hq, null, null, f.aum, null, null, f.aum, '13F institutional AUM', null, null, null);
    nodeIds.add(id); stats.holderNodes++;
    if (nodeIds.has('sec')) insEdge.run('sec', id, 'R', 2, 'Registered investment adviser; quarterly 13F reporting', '13f', null);
  } else {
    // Existing node (curated or EDGAR) matched to a 13F filer key. Never clobber a curated node's `assets`
    // (protects hand-written figures), but DO fill in `funding` when it's still empty — e.g. Vanguard is a
    // mutual, non-public company with no EDGAR/revenue figure, so its 13F AUM is the only real size signal.
    db.prepare("UPDATE nodes SET assets=COALESCE(assets,?) WHERE id=? AND source<>'curated'").run(f.aum, id);
    const fp = powerFromValue(f.aum);
    db.prepare('UPDATE nodes SET funding=COALESCE(funding,?), funding_basis=COALESCE(funding_basis,?), power=CASE WHEN funding IS NULL THEN ? ELSE power END, tier=CASE WHEN funding IS NULL THEN ? ELSE tier END WHERE id=?').run(f.aum, '13F institutional AUM', fp, tierFromPower(fp), id);
  }
  holderNode[key] = id; return id;
}
for (const [cik, own] of Object.entries(ownerRows)) {
  const target = cikNode[+cik] || cikNode[cik]; if (!target) continue;
  for (const [fkey, value, pct] of own.top) {
    const f = f13.filers[fkey]; if (!f) continue;
    const src = holderNodeId(fkey, f); if (src === target) continue;
    { const note13 = `$${money(value)} position · ${pct}% of institutional holdings reported in ${f13Period} 13F filings`;
      const r13 = insEdge.run(src, target, 'C', pctWeight(pct), note13, '13f', value);
      if (!r13.changes) attach13f.run(value, note13, note13, src, target); // curated edge already links them: attach the reported dollars
      stats.ownEdges++; }
  }
}
db.exec('COMMIT');
db.exec("UPDATE edges SET amount_basis='Figure cited in the map’s source note' WHERE source='curated' AND amount IS NOT NULL AND note NOT LIKE '%13F filings%'");
db.prepare("UPDATE edges SET amount_basis=? WHERE (source='13f' OR note LIKE '%13F filings%') AND amount IS NOT NULL AND amount_basis IS NULL").run(f13Period + ' 13F position value (SEC Form 13F)');

// 3b. IRS large exempt orgs, USAspending FY2025 awards, FEC 2025-26 PAC money
const extra = addExtraSources({ db, insNode, nodeIds, stats, money, powerFromValue, tierFromPower });
console.log('extra sources:', JSON.stringify(extra));
Object.assign(stats, { extra });

// 4. stats per node
db.exec(`
UPDATE nodes SET
  out_w=(SELECT COALESCE(SUM(weight),0) FROM edges WHERE src=nodes.id),
  in_w=(SELECT COALESCE(SUM(weight),0) FROM edges WHERE dst=nodes.id),
  deg=(SELECT COUNT(*) FROM edges WHERE src=nodes.id OR dst=nodes.id),
  has_dark=(SELECT COUNT(*)>0 FROM edges WHERE type='D' AND (src=nodes.id OR dst=nodes.id));
`);
// 5. full-text search
try {
  db.exec(`CREATE VIRTUAL TABLE nodes_fts USING fts5(id UNINDEXED, name, dm, description, industry, ticker, aliases, tokenize='unicode61');
    INSERT INTO nodes_fts(id,name,dm,description,industry,ticker,aliases) SELECT id,name,dm,description,industry,COALESCE(ticker,''),COALESCE(aliases,'') FROM nodes;`);
  db.prepare("INSERT INTO meta(key,value) VALUES('fts','1')").run();
} catch (e) { console.log('FTS5 unavailable, search falls back to LIKE:', e.message); db.prepare("INSERT INTO meta(key,value) VALUES('fts','0')").run(); }
// 6. meta + sources
const ins = db.prepare('INSERT INTO meta(key,value) VALUES(?,?)');
ins.run('generated', new Date().toISOString().slice(0, 10)); ins.run('categories', JSON.stringify(curated.categories)); ins.run('edgeTypes', JSON.stringify(curated.edgeTypes)); ins.run('f13_period', f13Period); ins.run('curated_generated', curated.generated);
const srcIns = db.prepare('INSERT INTO sources(key,label,url,asof,nodes,edges) VALUES(?,?,?,?,?,?)');
srcIns.run('curated', 'Hand-curated American Power Map', '', curated.generated, stats.curatedNodes, stats.curatedEdges);
srcIns.run('edgar', 'SEC EDGAR company list + XBRL frames', 'https://www.sec.gov/search-filings/edgar-application-programming-interfaces', new Date().toISOString().slice(0, 10), stats.edgarNodes, stats.regEdges);
srcIns.run('13f', `SEC Form 13F bulk data, quarter ended ${f13.period}`, 'https://www.sec.gov/data-research/sec-markets-data/form-13f-data-sets', f13.period, stats.holderNodes, stats.ownEdges);
{
  const cnt = db.prepare('SELECT (SELECT COUNT(*) FROM nodes WHERE source=?) n, (SELECT COUNT(*) FROM edges WHERE source=?) e');
  const irsJ = JSON.parse(fs.readFileSync('data/irs_large.json', 'utf8')), usaJ = JSON.parse(fs.readFileSync('data/usaspending.json', 'utf8')), fecJ = JSON.parse(fs.readFileSync('data/fec.json', 'utf8'));
  const c1 = cnt.get('irs', 'irs'), c2 = cnt.get('usaspending', 'usaspending'), c3 = cnt.get('fec', 'fec');
  srcIns.run('irs', 'IRS Exempt Organizations Business Master File (large nonprofits, unions, trade associations, 501(c)(4)s, credit unions)', 'https://www.irs.gov/charities-non-profits/exempt-organizations-business-master-file-extract-eo-bmf', irsJ.fetched, c1.n, c1.e);
  srcIns.run('usaspending', 'USAspending.gov, FY2025: top contract and grant recipients of 21 agencies, formula programs to all 50 states + DC (Medicaid/CHIP, SNAP and child nutrition, highways, Title I/IDEA, TANF and child care), agency and sub-agency obligations', 'https://www.usaspending.gov', usaJ.fetched, c2.n, c2.e);
  const c4 = cnt.get('context', 'context');
  if (c4.e) srcIns.run('context', 'Documented management and ownership of DOE laboratory contractors (DOE/NNSA contract records)', 'https://www.energy.gov/national-laboratories', '2026', c4.n, c4.e);
  srcIns.run('fec', 'FEC bulk data: 400 largest PACs, super PACs and party committees, 2025-26 cycle, and their money to candidates', 'https://www.fec.gov/data/browse-data/?tab=bulk-data', fecJ.coverageEnd || fecJ.fetched, c3.n, c3.e);
}
db.exec('VACUUM'); db.close();
const totals = new DatabaseSync(OUT, { readOnly: true });
console.log(JSON.stringify(stats), 'nodes', totals.prepare('SELECT COUNT(*) c FROM nodes').get().c, 'edges', totals.prepare('SELECT COUNT(*) c FROM edges').get().c, 'size', (fs.statSync(OUT).size / 1e6).toFixed(1) + 'MB');
