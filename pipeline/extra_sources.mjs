// Adds three sizable-organization databases to the power map, each carrying REAL dollar amounts on its edges:
//   1. IRS Exempt Organizations Business Master File: ~3,600 large nonprofits, unions, trade associations,
//      501(c)(4) advocacy groups and credit unions, sized by IRS-reported revenue/assets (data/irs_large.json)
//   2. USAspending: FY2025 top contract and grant recipients of 21 federal agencies (data/usaspending.json)
//   3. FEC: 2025-26 cycle super PACs, party committees and PACs, and their money to candidates (data/fec.json)
// Called from build_db.mjs after the EDGAR and 13F stages. Matching against existing centers is conservative
// (exact normalized names, plus hand-checked aliases); anything unmatched becomes a new center.
import fs from 'node:fs';
import { normName, sortedKey } from './names.mjs';
import { prettyName, personName } from './pretty.mjs';

const STATES = { AL: 'ALABAMA', AK: 'ALASKA', AZ: 'ARIZONA', AR: 'ARKANSAS', CA: 'CALIFORNIA', CO: 'COLORADO', CT: 'CONNECTICUT', DE: 'DELAWARE', FL: 'FLORIDA', GA: 'GEORGIA', HI: 'HAWAII', ID: 'IDAHO', IL: 'ILLINOIS', IN: 'INDIANA', IA: 'IOWA', KS: 'KANSAS', KY: 'KENTUCKY', LA: 'LOUISIANA', ME: 'MAINE', MD: 'MARYLAND', MA: 'MASSACHUSETTS', MI: 'MICHIGAN', MN: 'MINNESOTA', MS: 'MISSISSIPPI', MO: 'MISSOURI', MT: 'MONTANA', NE: 'NEBRASKA', NV: 'NEVADA', NH: 'NEW HAMPSHIRE', NJ: 'NEW JERSEY', NM: 'NEW MEXICO', NY: 'NEW YORK', NC: 'NORTH CAROLINA', ND: 'NORTH DAKOTA', OH: 'OHIO', OK: 'OKLAHOMA', OR: 'OREGON', PA: 'PENNSYLVANIA', RI: 'RHODE ISLAND', SC: 'SOUTH CAROLINA', SD: 'SOUTH DAKOTA', TN: 'TENNESSEE', TX: 'TEXAS', UT: 'UTAH', VT: 'VERMONT', VA: 'VIRGINIA', WA: 'WASHINGTON', WV: 'WEST VIRGINIA', WI: 'WISCONSIN', WY: 'WYOMING' };
const STATE_BY_NAME = Object.fromEntries(Object.entries(STATES).map(([k, v]) => [v, k]));
const STATE_NAMES_LONGEST_FIRST = Object.values(STATES).sort((a, b) => b.length - a.length);

// Hand-checked aliases: source-database name pattern -> existing center id. Applied before generic matching.
// recipient name pattern -> stock ticker of the parent (resolved to its EDGAR center at build time)
const TICKER_ALIASES = [
  [/^HUNTINGTON INGALLS|^HII /, 'HII'], [/^AMERISOURCEBERGEN|^CENCORA/, 'COR'], [/^BOOZ ALLEN/, 'BAH'], [/^HUMANA /, 'HUM'],
  [/^LEIDOS|^QTC MEDICAL/, 'LDOS'], [/^AMENTUM/, 'AMTM'], [/^CACI/, 'CACI'], [/^ACCENTURE FEDERAL/, 'ACN'], [/^HONEYWELL /, 'HON'],
  [/^DELL FEDERAL/, 'DELL'], [/^FCA US/, 'STLA'], [/^MAXIMUS|^VETERANS EVALUATION SERVICES/, 'MMS'], [/^FLUOR /, 'FLR'],
  [/^STONEX/, 'SNEX'], [/^SCIENCE APPLICATIONS INTERNATIONAL/, 'SAIC'], [/^GENERAL ATOMICS/, null],
];
const ALIASES = [
  [/^OPTUM/, 'unitedhealth'], [/^NATIONAL RAILROAD PASSENGER/, 'co_amtrak'], [/^METROPOLITAN TRANSPORTATION AUTHORITY$/, 'co_amtrak'],
  [/^RTX CORPORATION$/, 'rtx'], [/^ORACLE /, 'oracle'], [/^UCHICAGO ARGONNE/, 'n2_univ_university_of_chicago'],
  // IRS legal names of centers already in the map
  [/^PRESIDENT AND FELLOWS OF HARVARD COLLEGE/, 'n2_univ_harvard_university'], [/^YALE UNIVERSITY$/, 'n2_univ_yale_university'],
  [/LELAND STANFORD JUNIOR UNIVERSITY/, 'n2_univ_stanford_university'], [/^(THE )?TRUSTEES OF PRINCETON UNIVERSITY|^PRINCETON UNIVERSITY$/, 'n2_univ_princeton_university'],
  [/^MASSACHUSETTS INSTITUTE OF TECHNOLOGY$/, 'n2_univ_mit'], [/^(THE )?TRUSTEES OF THE UNIVERSITY OF PENNSYLVANIA/, 'n2_univ_university_of_pennsylvania'],
  [/^(THE )?TRUSTEES OF COLUMBIA UNIVERSITY/, 'n2_univ_columbia_university'], [/^CORNELL UNIVERSITY$/, 'n2_univ_cornell_university'],
  [/^DUKE UNIVERSITY$/, 'n2_univ_duke_university'], [/^NORTHWESTERN UNIVERSITY$/, 'n2_univ_northwestern_university'],
  [/^(THE )?UNIVERSITY OF CHICAGO$/, 'n2_univ_university_of_chicago'], [/^(THE )?JOHNS HOPKINS UNIVERSITY$/, 'n2_univ_johns_hopkins_university'],
  [/GATES FOUNDATION/, 'npo_gates'], [/^FORD FOUNDATION$/, 'npo_ford'], [/^AMERICAN NATIONAL RED CROSS$/, 'npo_redcross'],
  [/^AMERICAN CANCER SOCIETY INC$/, 'npo_cancer'], [/^AMERICAN HEART ASSOCIATION INC$/, 'npo_heart'],
  [/^AMERICAN LEBANESE SYRIAN ASSOCIATED CHARITIES/, 'npo_stjude'], [/^FEEDING AMERICA$/, 'npo_feedingamerica'],
  [/^UNITED WAY WORLDWIDE$/, 'npo_unitedway'], [/^HABITAT FOR HUMANITY INTERNATIONAL/, 'npo_habitat'],
  [/^(THE )?NATURE CONSERVANCY$/, 'npo_natureconservancy'], [/^ROBERT WOOD JOHNSON FOUNDATION$/, 'npo_rwjf'],
  [/^LILLY ENDOWMENT INC$/, 'npo_lilly_endow'], [/^WILLIAM AND FLORA HEWLETT FOUNDATION$/, 'npo_hewlett'],
  [/^DAVID AND LUCILE PACKARD FOUNDATION$/, 'npo_packard'], [/^W K KELLOGG FOUNDATION$/, 'npo_kellogg'],
  [/^HOWARD HUGHES MEDICAL INSTITUTE$/, 'n2_fdn_howard_hughes_medical_institute'], [/^NATIONAL CHRISTIAN CHARITABLE FOUNDATION/, 'npo_ncf'],
  [/^SILICON VALLEY COMMUNITY FOUNDATION$/, 'npo_svcf'], [/^TIDES FOUNDATION$/, 'npo_tides'],
  [/^COLLEGE ENTRANCE EXAMINATION BOARD$/, 'npo_collegeboard'], [/^AMERICAN MEDICAL ASSOCIATION$/, 'npo_ama'],
  [/^AMERICAN HOSPITAL ASSOCIATION$/, 'npo_aha'], [/^CHAMBER OF COMMERCE OF THE UNITED STATES OF AMERICA$/, 'chamber'],
  [/^NATIONAL RIFLE ASSOCIATION OF AMERICA$/, 'nra'], [/^AMERICAN ISRAEL PUBLIC AFFAIRS COMMITTEE$/, 'aipac'],
  [/^SERVICE EMPLOYEES INTERNATIONAL UNION$/, 'seiu'], [/^INTERNATIONAL BROTHERHOOD OF TEAMSTERS$/, 'teamsters'],
  [/^AMERICAN FEDERATION OF LABOR & CONGRESS OF INDUSTRIAL ORG/, 'aflcio'], [/^NATIONAL EDUCATION ASSOCIATION OF THE UNITED STATES$/, 'nea'],
  [/^AMERICAN FEDERATION OF TEACHERS$/, 'ul_nea_aft'], [/^AMERICAN FEDERATION OF STATE COUNTY & MUNICIPAL EMPLOYEES$/, 'ul_afscme'],
  [/^UNITED FOOD & COMMERCIAL WORKERS INTERNATIONAL UNION$/, 'ul_ufcw'], [/^UNITED STEELWORKERS$/, 'ul_usw'],
  [/^AMERICANS FOR PROSPERITY$/, 'pac_afp'], [/^STAND TOGETHER CHAMBER OF COMMERCE$/, 'dk_stc'],
  [/^FIDELITY INVESTMENTS CHARITABLE GIFT FUND$/, 'dk_dafs'],
  // USAspending recipients that are subsidiaries or systems of existing centers
  [/^ELECTRIC BOAT CORPORATION$|^GENERAL DYNAMICS |^BATH IRON WORKS/, 'co_gd'], [/^RAYTHEON( COMPANY)?$|^RAYTHEON /, 'rtx'],
  [/^SIKORSKY AIRCRAFT/, 'lockheed'], [/^(THE )?BOEING COMPANY$/, 'boeing'], [/^NORTHROP GRUMMAN/, 'co_northrop'],
  [/^(THE )?REGENTS OF THE UNIVERSITY OF CALIFORNIA/, 'un_uc'], [/^REGENTS OF THE UNIVERSITY OF MICHIGAN$/, 'un_michigan'],
  [/^(THE )?UNIVERSITY OF TEXAS /, 'un_texas'], [/^(THE )?JOHNS HOPKINS UNIVERSITY APPLIED PHYSICS/, 'n2_univ_johns_hopkins_university'],
  [/^SPACE EXPLORATION TECHNOLOG/, 'spacex_tesla'], [/^PALANTIR /, 'palantir'], [/^MCKESSON /, 'co_mckesson'],
];

// FEC committee -> existing curated center: 'merge' = same entity, 'affiliate' = umbrella -> committee edge
const FEC_LINKS = [
  [/^REPUBLICAN NATIONAL COMMITTEE$/, 'po_rnc', 'merge'], [/^DNC SERVICES CORP/, 'po_dnc', 'merge'],
  [/^DCCC$/, 'po_dccc', 'merge'], [/^NRCC$/, 'po_nrcc', 'merge'], [/^NRSC$/, 'po_nrsc', 'merge'], [/^DSCC$/, 'po_dscc', 'merge'],
  [/^MAGA INC\.?$/, 'pac_maga', 'merge'], [/^LEADING THE FUTURE$/, 'pac_ltf', 'merge'],
  [/^SLF PAC$|^CLF$/, 'pac_clf', 'affiliate'], [/^SMP$|^HMP$|^WINSENATE$/, 'pac_smp', 'affiliate'],
  [/^FAIRSHAKE$|^DEFEND AMERICAN JOBS$|^PROTECT PROGRESS$/, 'fairshake', 'affiliate'],
  [/^AMERICAN ISRAEL PUBLIC AFFAIRS COMMITTEE POLITICAL ACTION|^UNITED DEMOCRACY PROJECT/, 'aipac', 'affiliate'],
  [/^EMILYS LIST$/, 'pac_emily', 'affiliate'], [/^CLUB FOR GROWTH ACTION$/, 'pac_club', 'affiliate'],
  [/^AMERICANS FOR PROSPERITY ACTION/, 'pac_afp', 'affiliate'], [/^FF PAC$|^FUTURE FORWARD/, 'pac_ff', 'affiliate'],
  [/^MOVEON\.ORG POLITICAL ACTION$|^INDIVISIBLE ACTION/, 'pac_indiv', 'affiliate'], [/^LCV VICTORY FUND$/, 'dk_lcv', 'affiliate'],
  [/^SEIU COPE/, 'seiu', 'affiliate'], [/^NRA POLITICAL VICTORY FUND|^NRA-ILA/, 'nra', 'affiliate'],
  [/^ACTBLUE$/, 'dem', 'conduit'], [/^WINRED$/, 'gop', 'conduit'],
];
// Publicly documented major donors to the crypto super PAC network (FEC filings, 2024-26)
const FEC_FUNDERS = [['co_coinbase', 'FAIRSHAKE'], ['co_ripple', 'FAIRSHAKE'], ['dn_a16zfounders', 'FAIRSHAKE']];

// NTEE major group -> [industry, category]
const NTEE = {
  A: ['Arts & culture', 'cultural'], B: ['Education', 'environmental'], C: ['Environment & conservation', 'environmental'], D: ['Environment & conservation', 'environmental'],
  E: ['Health systems & hospitals', 'environmental'], F: ['Health services', 'environmental'], G: ['Health policy & science', 'environmental'], H: ['Health policy & science', 'environmental'],
  I: ['Human services', 'environmental'], J: ['Human services', 'environmental'], K: ['Human services', 'environmental'], L: ['Housing & community development', 'economic'],
  M: ['Human services', 'environmental'], N: ['Human services', 'cultural'], O: ['Human services', 'environmental'], P: ['Human services', 'environmental'],
  Q: ['International affairs', 'political'], R: ['Think tanks & advocacy', 'political'], S: ['Housing & community development', 'economic'], T: ['Foundations & philanthropy', 'economic'],
  U: ['Research institutes', 'environmental'], V: ['Research institutes', 'political'], W: ['Think tanks & advocacy', 'political'], X: ['Religion', 'cultural'], Y: ['Pensions & endowments', 'economic'],
};
const NTEE_LABEL = { A: 'arts & culture', B: 'education', C: 'environment', D: 'animal welfare', E: 'health care', F: 'mental health', G: 'disease research & charity', H: 'medical research', I: 'crime & legal', J: 'employment', K: 'food & agriculture', L: 'housing', M: 'public safety', N: 'recreation & sports', O: 'youth development', P: 'human services', Q: 'international affairs', R: 'civil rights & advocacy', S: 'community improvement', T: 'philanthropy & grantmaking', U: 'science & technology', V: 'social science', W: 'public & societal benefit', X: 'religion', Y: 'mutual & membership benefit' };
const SUB_LABEL = { '03': '501(c)(3) charity', '04': '501(c)(4) social-welfare organization', '05': '501(c)(5) labor union', '06': '501(c)(6) trade association', '12': '501(c)(12) cooperative', '14': '501(c)(14) credit union' };

export function addExtraSources(ctx) {
  const { db, insNode, nodeIds, stats, money, powerFromValue, tierFromPower } = ctx;
  const amountWeight = a => a >= 10e9 ? 5 : a >= 1e9 ? 4 : a >= 1e8 ? 3 : a >= 1e7 ? 2 : 1;
  const fecWeight = a => a >= 10e6 ? 5 : a >= 1e6 ? 4 : a >= 1e5 ? 3 : a >= 25e3 ? 2 : 1; // campaign money runs ~1000x smaller than federal contracts
  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 44);
  const insEdge = db.prepare('INSERT OR IGNORE INTO edges(src,dst,type,weight,note,source,amount,amount_basis) VALUES(?,?,?,?,?,?,?,?)');
  const addMoney = db.prepare("UPDATE edges SET amount=?, amount_basis=?, note=CASE WHEN note IS NULL OR note='' THEN ? ELSE note || ' · ' || ? END, weight=MAX(weight, ?) WHERE src=? AND dst=? AND amount IS NULL");
  // insert, or attach the dollar figure to an existing hand-curated edge between the same pair
  function moneyEdge(src, dst, type, weight, note, source, amount, basis) {
    if (!nodeIds.has(src) || !nodeIds.has(dst) || src === dst) return 0;
    const r = insEdge.run(src, dst, type, weight, note, source, amount, basis);
    if (r.changes) return 1;
    if (amount != null) addMoney.run(amount, basis, note, note, weight, src, dst);
    return 0;
  }
  const plainEdge = (src, dst, type, weight, note, source) => (nodeIds.has(src) && nodeIds.has(dst) && src !== dst) ? insEdge.run(src, dst, type, weight, note, source, null, null).changes : 0;

  // ---------- name index over every existing center ----------
  const exact = new Map(), sorted = new Map(), compact = new Map();
  const rank = s => s === 'curated' ? 0 : s === 'edgar' ? 1 : 2;
  const rows = db.prepare('SELECT id, name, aliases, source FROM nodes').all().sort((a, b) => rank(a.source) - rank(b.source));
  const index = (name, id) => { const nn = normName(name); if (!nn || nn.length < 3) return; if (!exact.has(nn)) exact.set(nn, id); const sk = sortedKey(name); if (!sorted.has(sk)) sorted.set(sk, id); const c = nn.replace(/ /g, ''); if (c.length >= 6 && !compact.has(c)) compact.set(c, id); };
  for (const r of rows) { index(r.name, r.id); for (const a of String(r.aliases || '').split('|')) if (a) index(a, r.id); }
  const tickerIdStmt = db.prepare('SELECT id FROM nodes WHERE ticker=? LIMIT 1');
  const tickerId = { get: t => tickerIdStmt.get(t) };
  function match(name) {
    const up = String(name || '').toUpperCase().trim();
    for (const [re, id] of ALIASES) if (re.test(up) && nodeIds.has(id)) return id;
    for (const [re, t] of TICKER_ALIASES) if (t && re.test(up)) { const r = tickerId.get(t); if (r) return r.id; }
    const nn = normName(up); if (!nn || nn.length < 4) return null;
    return exact.get(nn) || sorted.get(sortedKey(up)) || compact.get(nn.replace(/ /g, '')) || null;
  }
  function stateGov(name) {
    let up = String(name || '').toUpperCase().replace(/LOUSIANA/g, 'LOUISIANA').replace(/^NYS /, 'NY ');
    const GOV_WORDS = /STATE|COMMONWEALTH|DEPARTMENT|DEPT|AGENCY|AUTHORITY|COMMISSION|COMMN|OFFICE|DIVISION|EXECUTIVE|HEALTH|HUMAN S|SOCIAL SERV|FAMILY|MEDICAL ASSISTANCE|EDUCATION AGENCY|COMPTROLLER|TREASURER|GOVERNOR|ADMIN/;
    if (GOV_WORDS.test(up) && !/UNIVERSITY|COLLEGE|INC\b|LLC|CORP/.test(up)) {
      const ab = (up.match(/^([A-Z]{2}) (DEPARTMENT|DEPT|EDUCATION|HEALTH|OFFICE|DIVISION)/) || up.match(/ ([A-Z]{2})$/) || [])[1];
      if (ab && STATES[ab]) { const id = 'st_' + ab.toLowerCase(); if (nodeIds.has(id)) return id; }
    }
    if (/UNIVERSITY|COLLEGE|CITY OF|COUNTY|SCHOOL|HOSPITAL|FOUNDATION|INC\b|LLC|CORP/.test(up)) return null;
    if (!/STATE|COMMONWEALTH|DEPARTMENT|DEPT|AGENCY|AUTHORITY|COMMISSION|OFFICE|DIVISION|EXECUTIVE|HEALTH|HUMAN SERVICES|SOCIAL SERV|FAMILY|COMPTROLLER|TREASURER|GOVERNOR/.test(up)) return null;
    for (const s of STATE_NAMES_LONGEST_FIRST) if (up.includes(s)) { if (s === 'WASHINGTON' && /DISTRICT OF COLUMBIA|WASHINGTON DC/.test(up)) return null; const id = 'st_' + STATE_BY_NAME[s].toLowerCase(); return nodeIds.has(id) ? id : null; }
    return null;
  }
  const getNode = db.prepare('SELECT id, funding, funding_basis, description, source, sector FROM nodes WHERE id=?');
  const setFunding = db.prepare('UPDATE nodes SET funding=?, funding_basis=?, power=?, tier=? WHERE id=?');
  const appendDesc = db.prepare("UPDATE nodes SET description = description || ' ' || ? WHERE id=?");
  const setCol = (col) => db.prepare(`UPDATE nodes SET ${col}=? WHERE id=?`);
  const setEin = setCol('ein'), setFec = setCol('fec_id');
  const newNode = (id, name, category, sector, branch, industry, dm, description, source, funding, basis, extra = {}) => {
    const p = funding ? powerFromValue(funding) : 2;
    insNode.run(id, name, category, sector, branch, industry, dm, p, tierFromPower(p), description, source, null, null, null, null, null, extra.state || null, extra.hq || null, null, null, extra.assets ?? null, null, null, funding || null, basis || null, null, extra.party || null, extra.aliases || null);
    nodeIds.add(id); index(name, id); if (extra.aliases) for (const a of extra.aliases.split('|')) if (a) index(a, id);
  };
  const out = { irsNew: 0, irsMatched: 0, irsUpgraded: 0, usaEdges: 0, usaNew: 0, usaToStates: 0, fecNew: 0, fecMerged: 0, fecCandNew: 0, fecCandMatched: 0, fecEdges: 0 };

  db.exec('BEGIN');
  // ================= 1. IRS large exempt organizations =================
  const irs = JSON.parse(fs.readFileSync('data/irs_large.json', 'utf8'));
  for (const o of irs.orgs) {
    const name = prettyName(o.name);
    const period = o.taxPeriod ? `${o.taxPeriod.slice(4, 6)}/${o.taxPeriod.slice(0, 4)}` : 'latest filing';
    const factLine = `IRS-reported revenue $${money(o.revenue)}, assets $${money(o.assets)} (Form 990, tax period ${period}; EIN ${o.ein}).`;
    const existing = match(o.name);
    if (existing && !String(existing).startsWith('irs_')) {
      out.irsMatched++;
      setEin.run(o.ein, existing);
      const row = getNode.get(existing);
      if (row && o.revenue > 0 && (!row.funding || (row.source === 'curated' && row.sector !== 'Government' && !/IRS Form 990/.test(row.funding_basis || '')))) {
        const p = powerFromValue(o.revenue); setFunding.run(o.revenue, `Annual revenue (IRS Form 990, tax period ${period})`, p, tierFromPower(p), existing); out.irsUpgraded++;
      }
      if (row && !/IRS-reported revenue/.test(row.description || '')) appendDesc.run(factLine, existing);
      continue;
    }
    if (existing) continue; // a duplicate EIN/entity of an org already added this run
    const letter = (o.ntee || ' ')[0].toUpperCase();
    let [industry, category] = NTEE[letter] || ['Other nonprofits', 'economic'];
    if (o.subsection === '05') [industry, category] = ['Labor unions', 'political'];
    else if (o.subsection === '06') [industry, category] = ['Trade associations', 'political'];
    else if (o.subsection === '04') [industry, category] = ['Social-welfare & advocacy groups (501c4)', 'political'];
    else if (o.subsection === '14') [industry, category] = ['Credit unions', 'economic'];
    else if (o.subsection === '12') [industry, category] = ['Cooperatives & utilities', 'economic'];
    const isFoundation = o.subsection === '03' && ['02', '03', '04'].includes(o.foundation);
    if (isFoundation) [industry, category] = ['Foundations & philanthropy', 'economic'];
    const fundingVal = o.revenue > 0 ? o.revenue : o.assets * 0.05;
    const basis = o.revenue > 0 ? `Annual revenue (IRS Form 990, tax period ${period})` : 'Assets × 5% (no revenue reported; IRS Form 990)';
    const where = [o.city && prettyName(o.city), o.state].filter(Boolean).join(', ');
    const desc = `${SUB_LABEL[o.subsection] || 'Tax-exempt organization'}${NTEE_LABEL[letter] ? ' (' + NTEE_LABEL[letter] + ')' : ''}${where ? ' based in ' + where : ''}. ${factLine}`;
    const id = 'irs_' + o.ein;
    newNode(id, name, category, 'Nonprofit', 'Private', industry, where, desc, 'irs', fundingVal, basis, { state: o.state, hq: where, assets: o.assets, aliases: '|' + o.name });
    setEin.run(o.ein, id); out.irsNew++;
    plainEdge('irs', id, 'R', 1, 'Tax-exempt status oversight', 'irs');
    const nt = o.ntee.toUpperCase();
    if (o.subsection === '05') plainEdge('nlrb', id, 'R', 2, 'Union representation elections and unfair-labor-practice cases', 'irs');
    else if (o.subsection === '14') plainEdge('ag_ncua', id, 'R', 2, 'Federal credit-union supervision and share insurance', 'irs');
    else if (/^E2[0-4]/.test(nt)) plainEdge('cms', id, 'F', 2, 'Medicare & Medicaid reimbursement (typical for U.S. hospitals)', 'irs');
    else if (/^B4[0-3]/.test(nt)) plainEdge('education', id, 'R', 2, 'Title IV federal student-aid eligibility (typical for U.S. universities)', 'irs');
  }

  // ================= 2. USAspending FY2025 contracts & grants =================
  const usa = JSON.parse(fs.readFileSync('data/usaspending.json', 'utf8'));
  const agg = new Map(); // agencyId|recipientId|kind -> amount
  const recipientName = {};
  for (const row of usa.rows) {
    if (!nodeIds.has(row.agencyId)) continue;
    for (const r of row.results) {
      if (!(r.amount > 0)) continue;
      let rid = match(r.name) || stateGov(r.name);
      if (!rid) {
        const up = r.name.toUpperCase();
        rid = 'fed_' + slug(normName(up) || up);
        if (!nodeIds.has(rid)) {
          const nonprofit = /UNIVERSITY|COLLEGE|INSTITUTE|FOUNDATION|HOSPITAL|ASSOCIATION|COUNCIL|SOCIETY|SCHOOL OF MEDICINE|MEDICAL CENTER/.test(up);
          const localGov = !nonprofit && !/\bINC\b|LLC|CORP|L\.P|COMPANY/.test(up) && /^CITY OF|COUNTY|AUTHORITY|DISTRICT|PUBLIC SCHOOLS|TRANSIT|PORT OF|METROPOLITAN|DEPARTMENT|DEPT\b|OFFICE OF|COMMISSION|GOVERNMENT OF|GOVERNOR|AGENCY|COMPTROLLER/.test(up);
          const sector = nonprofit ? 'Nonprofit' : localGov ? 'Government' : 'Business';
          const industry = nonprofit ? 'Research institutes' : localGov ? 'Local government' : 'Government contractors';
          newNode(rid, prettyName(r.name), nonprofit ? 'environmental' : 'economic', sector, localGov ? 'State & local' : 'Private', industry, 'Federal award recipient', `Major federal ${row.kind === 'grants' ? 'grant' : 'contract'} recipient (USAspending, FY2025).`, 'usaspending', null, null, { aliases: '|' + r.name });
          out.usaNew++;
        }
      }
      if (rid.startsWith('st_')) out.usaToStates++;
      recipientName[rid] = r.name;
      const k = row.agencyId + '|' + rid + '|' + row.kind; agg.set(k, (agg.get(k) || 0) + r.amount);
    }
  }
  const received = {};
  for (const [k, amount] of agg) {
    const [agency, rid, kind] = k.split('|');
    received[rid] = (received[rid] || 0) + amount;
    const note = `$${money(amount)} in FY2025 federal ${kind === 'grants' ? 'grant' : 'contract'} obligations (USAspending)`;
    out.usaEdges += moneyEdge(agency, rid, 'F', amountWeight(amount), note, 'usaspending', amount, `FY2025 federal ${kind === 'grants' ? 'grant' : 'contract'} obligations (USAspending)`);
  }
  for (const [rid, total] of Object.entries(received)) {
    if (!rid.startsWith('fed_')) continue;
    const p = powerFromValue(total); setFunding.run(total, 'FY2025 federal awards received (USAspending)', p, tierFromPower(p), rid);
    appendDesc.run(`Received $${money(total)} from the agencies in this map in FY2025.`, rid);
  }

  // ================= 2b. formula programs to all 50 states + DC (USAspending geography) =================
  // These replace an agency->state edge's dollar figure (top-recipient totals cover ~20 states; these cover all 51),
  // so every state's chain carries the same, program-defined number.
  if (fs.existsSync('data/state_programs.json')) {
    const sp = JSON.parse(fs.readFileSync('data/state_programs.json', 'utf8'));
    if (!nodeIds.has('hhs_acf') && nodeIds.has('hhs')) {
      newNode('hhs_acf', 'Administration for Children & Families', 'economic', 'Government', 'Executive', 'Social services', 'HHS operating division', 'Runs TANF, the Child Care and Development Fund, foster care and Head Start, mostly as formula grants to states.', 'usaspending', null, null);
      plainEdge('hhs', 'hhs_acf', 'C', 5, 'Operating division of HHS', 'usaspending');
    }
    const setProgram = db.prepare('UPDATE edges SET amount=?, amount_basis=?, note=?, weight=MAX(weight, ?), type=? WHERE src=? AND dst=?');
    const addOn = Object.fromEntries(sp.programs.filter(p => p.addTo).map(p => [p.addTo, p]));
    const stateTotals = {};
    out.stateProgramEdges = 0;
    for (const p of sp.programs) {
      if (p.addTo || !nodeIds.has(p.agency)) continue;
      const extra = addOn[p.key];
      for (const [code, row] of Object.entries(p.byState)) {
        const dst = code === 'DC' ? 'ct_dc' : 'st_' + code.toLowerCase(); if (!nodeIds.has(dst) || !(row.amount > 0)) continue;
        const ex = extra && extra.byState[code] ? extra.byState[code].amount : 0;
        const amount = row.amount + ex, per = row.population ? amount / row.population : null;
        const note = `FY2025 ${p.label}: $${money(amount)}${per ? ` ($${Math.round(per).toLocaleString('en-US')} per resident)` : ''}${ex ? `, including $${money(ex)} for ${extra.label}` : ''} (USAspending)`;
        const basis = `FY2025 obligations, assistance listings ${[...p.aln, ...(ex ? extra.aln : [])].join(', ')} (USAspending)`;
        if (!moneyEdge(p.agency, dst, 'F', amountWeight(amount), note, 'usaspending', amount, basis)) setProgram.run(amount, basis, note, amountWeight(amount), 'F', p.agency, dst);
        stateTotals[dst] = (stateTotals[dst] || 0) + amount; out.stateProgramEdges++;
      }
    }
    for (const [dst, total] of Object.entries(stateTotals)) appendDesc.run(`FY2025 federal formula funding tracked in this map (Medicaid, CHIP, highways, nutrition, Title I/IDEA, TANF and child care): $${money(total)}.`, dst);
  }

  // ================= 2c. agency budgets: Congress -> agency -> sub-agency with reported FY2025 obligations =================
  if (fs.existsSync('data/agency_budgets.json')) {
    const ab = JSON.parse(fs.readFileSync('data/agency_budgets.json', 'utf8'));
    const setAmt = db.prepare('UPDATE edges SET amount=?, amount_basis=?, note=? WHERE src=? AND dst=?');
    const put = (src, dst, type, amount, note, basis) => { if (!nodeIds.has(src) || !nodeIds.has(dst) || !(amount > 0)) return; if (!moneyEdge(src, dst, type, amountWeight(amount), note, 'usaspending', amount, basis)) setAmt.run(amount, basis, note, src, dst); out.budgetEdges = (out.budgetEdges || 0) + 1; };
    for (const a of ab.agencies) {
      put('congress', a.id, 'F', a.obligated, `FY2025 total obligations under budget authority provided by Congress: $${money(a.obligated)} (USAspending agency profile)`, 'FY2025 total agency obligations (USAspending agency profile)');
      const subs = {}; for (const s of a.subs) subs[s.id] = (subs[s.id] || 0) + s.obligated;
      for (const [sid, amt] of Object.entries(subs)) put(a.id, sid, 'C', amt, `Sub-agency; FY2025 contract, grant and benefit awards: $${money(amt)} (USAspending; excludes payroll)`, 'FY2025 sub-agency award obligations (USAspending)');
    }
  }

  // ================= 3. FEC 2025-26 cycle =================
  const fec = JSON.parse(fs.readFileSync('data/fec.json', 'utf8'));
  const thru = fec.coverageEnd || 'latest filing';
  const cmteNode = {};
  const TYPE_IND = { O: 'Super PACs', U: 'Super PACs', V: 'Hybrid PACs', W: 'Hybrid PACs', Q: 'PACs', N: 'PACs', X: 'Party committees', Y: 'Party committees', Z: 'Party committees', I: 'Independent-expenditure filers', E: 'Electioneering filers' };
  const affiliateEdges = [];
  for (const c of fec.committees) {
    const up = c.name.toUpperCase().trim();
    const link = FEC_LINKS.find(([re]) => re.test(up));
    const facts = `FEC 2025-26 cycle through ${thru}: receipts $${money(c.receipts)}, disbursements $${money(c.disb)}${c.ie ? ', independent expenditures $' + money(c.ie) : ''}, cash on hand $${money(c.coh)} (committee ${c.id}).`;
    if (link && link[2] === 'merge' && nodeIds.has(link[1])) {
      const id = link[1]; cmteNode[c.id] = id; setFec.run(c.id, id); out.fecMerged++;
      const row = getNode.get(id);
      if (row && !row.funding && c.receipts > 0) { const p = powerFromValue(c.receipts); setFunding.run(c.receipts, `2025-26 cycle receipts through ${thru} (FEC)`, p, tierFromPower(p), id); }
      if (row && !/FEC 2025-26 cycle/.test(row.description || '')) appendDesc.run(facts, id);
      continue;
    }
    const id = 'fec_' + c.id.toLowerCase();
    const industry = c.dsgn === 'J' ? 'Joint fundraising committees' : (TYPE_IND[c.type] || 'PACs');
    const partyTag = c.party === 'REP' ? 'R' : c.party === 'DEM' ? 'D' : '';
    const dm = [industry.replace(/s$/, ''), partyTag && `(${partyTag})`, c.connectedOrg && !/^NONE$/i.test(c.connectedOrg) && ['C', 'L', 'M', 'T', 'V', 'W'].includes(c.orgType) ? 'sponsor: ' + prettyName(c.connectedOrg) : ''].filter(Boolean).join(' ');
    newNode(id, prettyName(c.name), 'political', 'Politics', 'Private', industry, dm, facts, 'fec', c.receipts || c.disb || null, `2025-26 cycle receipts through ${thru} (FEC)`, { party: c.party || null, aliases: '|' + c.name });
    setFec.run(c.id, id); cmteNode[c.id] = id; out.fecNew++;
    plainEdge('fec', id, 'R', 1, 'Federal campaign-finance reporting and enforcement', 'fec');
    if (link && nodeIds.has(link[1])) {
      if (link[2] === 'affiliate') affiliateEdges.push([link[1], id, 'C', 4, 'Affiliated committee (FEC filings)']);
      else if (link[2] === 'conduit') affiliateEdges.push([id, link[1], 'I', 3, `Online fundraising conduit for ${link[1] === 'dem' ? 'Democratic' : 'Republican'} candidates (earmarked small-dollar contributions)`]);
    }
    if (c.type === 'X' || c.type === 'Y' || c.type === 'Z') affiliateEdges.push([c.party === 'REP' ? 'gop' : c.party === 'DEM' ? 'dem' : null, id, 'C', 3, 'Party committee']);
    // sponsoring organization of a corporate / union / trade / membership PAC
    if (c.connectedOrg && !/^NONE$/i.test(c.connectedOrg) && ['C', 'L', 'M', 'T', 'V', 'W'].includes(c.orgType)) {
      const sponsor = match(c.connectedOrg);
      if (sponsor && sponsor !== id) affiliateEdges.push([sponsor, id, 'F', 2, 'Sponsors and administers this PAC (separate segregated fund)']);
    }
  }
  for (const [src, dst, t, w, note] of affiliateEdges) if (src) out.fecEdges += plainEdge(src, dst, t, w, note, 'fec');
  // curated umbrella centers (e.g. 'Fairshake & crypto super PACs') with no funding figure: size them by the summed
  // FEC receipts of their affiliated committees
  const umb = {}; for (const [src, dst, t, , note] of affiliateEdges) if (src && t === 'C' && /^Affiliated committee/.test(note)) { const c = fec.committees.find(x => cmteNode[x.id] === dst); if (c) (umb[src] = umb[src] || []).push(c); }
  for (const [id, list] of Object.entries(umb)) { const row = getNode.get(id); if (row && !row.funding) { const tot = list.reduce((a, c) => a + (c.receipts || 0), 0); if (tot > 0) { const p = powerFromValue(tot); setFunding.run(tot, `Combined 2025-26 receipts of ${list.length} affiliated committees through ${thru} (FEC)`, p, tierFromPower(p), id); } } }
  const byName = Object.fromEntries(fec.committees.map(c => [c.name.toUpperCase().trim(), cmteNode[c.id]]));
  for (const [funder, cname] of FEC_FUNDERS) if (byName[cname]) out.fecEdges += plainEdge(funder, byName[cname], 'F', 3, 'Major disclosed donor (FEC filings, 2024-26)', 'fec');
  for (const sub of ['DEFEND AMERICAN JOBS', 'PROTECT PROGRESS']) if (byName.FAIRSHAKE && byName[sub]) out.fecEdges += plainEdge(byName.FAIRSHAKE, byName[sub], 'F', 4, 'Affiliated super PAC funded by Fairshake transfers (FEC filings)', 'fec');

  // candidates: match sitting members already in the map (sen_/rep_), else create a candidate center
  const members = db.prepare("SELECT id, name FROM nodes WHERE id LIKE 'sen\\_%' ESCAPE '\\' OR id LIKE 'rep\\_%' ESCAPE '\\'").all();
  const memberKey = n => { const t = normName(n).split(' ').filter(x => x.length > 1); return t.length ? t[t.length - 1] + '|' + t[0].slice(0, 3) : ''; };
  const memberByKey = {}; for (const m of members) memberByKey[memberKey(m.name)] = m.id;
  const candNode = {}, personNode = {};
  for (const c of fec.candidates) {
    const [last, firstRest] = c.name.split(',').map(s => (s || '').trim());
    const first = (firstRest || '').split(/\s+/)[0] || '';
    const display = personName(prettyName(`${first} ${last}`.trim()));
    const key = normName(last).split(' ').pop() + '|' + normName(first).slice(0, 3);
    const office = c.office === 'S' ? 'Senate' : c.office === 'H' ? 'House' : 'President';
    const party = c.party === 'REP' ? 'R' : c.party === 'DEM' ? 'D' : (c.party || '').slice(0, 3);
    const seat = c.office === 'H' ? `${c.officeState}-${String(c.district || '').replace(/^0+/, '') || 'AL'}` : c.officeState;
    const status = c.ici === 'I' ? 'incumbent' : c.ici === 'C' ? 'challenger' : 'open seat';
    const facts = `FEC 2025-26 cycle: campaign receipts $${money(c.receipts || 0)}; $${money(c.fromTopCommittees)} from the 400 largest PACs, super PACs and party committees (contributions and independent expenditures for or against).`;
    const personKey = key + '|' + c.officeState; // one person can hold several FEC candidate IDs (e.g. House and Senate runs)
    if (personNode[personKey]) { candNode[c.id] = personNode[personKey]; setFec.run(personNode[personKey] && c.id, personNode[personKey]); continue; }
    const matched = c.office !== 'P' ? memberByKey[key] : null;
    if (matched) { candNode[c.id] = matched; personNode[personKey] = matched; setFec.run(c.id, matched); appendDesc.run(facts, matched); out.fecCandMatched++; continue; }
    const id = 'cand_' + c.id.toLowerCase();
    newNode(id, `${display} (${party}-${seat})`, 'political', 'Politics', 'Legislative', `${office} candidates 2026`, `${party} · ${office} ${status}, ${seat}`, `${office} candidate (${status}) for ${seat} in the 2026 cycle. ${facts}`, 'fec', c.receipts || null, `2025-26 campaign receipts (FEC)`, { party: c.party || null, aliases: '|' + c.name });
    setFec.run(c.id, id); candNode[c.id] = id; personNode[personKey] = id; out.fecCandNew++;
    const chamber = c.office === 'S' ? 'senate' : c.office === 'H' ? 'house' : 'potus';
    if (c.ici === 'I' && chamber !== 'potus') plainEdge(id, chamber, 'I', 3, 'Sitting member: votes in the chamber', 'fec');
    else plainEdge(id, chamber, 'L', 1, `Running for this office in 2026 (${status})`, 'fec');
  }
  const KIND_LABEL = { contrib: ['F', 'in direct contributions'], ie_support: ['F', 'in independent expenditures supporting'], ie_oppose: ['K', 'in independent expenditures opposing'] };
  const pairs = new Map();
  for (const f of fec.flows) {
    const src = cmteNode[f.cmte], dst = candNode[f.cand]; if (!src || !dst) continue;
    const k = src + '|' + dst; const p = pairs.get(k) || { src, dst, parts: [], total: 0, oppose: 0 };
    p.parts.push(f); p.total += f.amount; if (f.kind === 'ie_oppose') p.oppose += f.amount; pairs.set(k, p);
  }
  for (const p of pairs.values()) {
    const opposeMostly = p.oppose > p.total / 2;
    const type = opposeMostly ? 'K' : 'F';
    const note = p.parts.sort((a, b) => b.amount - a.amount).map(f => `$${money(f.amount)} ${KIND_LABEL[f.kind][1]}`).join('; ') + ', 2025-26 cycle (FEC)';
    const amount = opposeMostly ? p.oppose : p.total - p.oppose;
    out.fecEdges += moneyEdge(p.src, p.dst, type, fecWeight(amount), note, 'fec', amount, opposeMostly ? '2025-26 independent expenditures opposing (FEC)' : '2025-26 contributions and supporting independent expenditures (FEC)');
  }

  // ================= 3c. FEC megadonors: individuals and organizations giving $500K+ to the tracked committees =================
  if (fs.existsSync('data/fec_donors.json')) {
    const dj = JSON.parse(fs.readFileSync('data/fec_donors.json', 'utf8'));
    const PEOPLE = [
      [/^MUSK, ELON/, 'musk'], [/^YASS, JEFF/, 'yass'], [/^ADELSON, MIRIAM/, 'adelson'], [/^UIHLEIN, (RICHARD|ELIZABETH)/, 'dn_uihlein'],
      [/^GRIFFIN, KENNETH/, 'dn_griffin'], [/^SCHWARZMAN, STEPHEN/, 'dn_schwarzman'], [/^SINGER, PAUL/, 'dn_singer'], [/^MELLON, TIMOTHY/, 'dn_mellon'],
      [/^HENDRICKS, DIANE|^RICKETTS, J|^MARCUS, BERNARD/, 'dn_marcus'], [/^MERCER, (ROBERT|REBEKAH)/, 'dn_mercer'], [/^BLOOMBERG, MICHAEL/, 'dn_bloomberg'],
      [/^SOROS, (GEORGE|ALEXANDER)/, 'dn_soros'], [/^PRITZKER/, 'dn_pritzker'], [/^HOFFMAN, REID/, 'dn_hoffman'], [/^MOSKOVITZ, DUSTIN|^TUNA, CARI/, 'dn_moskovitz'],
      [/^SIMONS, (JAMES|MARILYN)|^JURVETSON, KARLA|^EYCHANER, FRED|^SIMON, DEBORAH/, 'dn_simons'], [/^ELLISON, (LAWRENCE|LARRY)/, 'ellison'], [/^BEZOS, JEFF/, 'bezos'],
      [/^ANDREESSEN, MARC|^HOROWITZ, BEN/, 'dn_a16zfounders'], [/^SACKS, DAVID/, 'dn_sacks'], [/^ARNOLD, (JOHN|LAURA)/, 'dn_arnold'], [/^SCOTT, MACKENZIE|^FRENCH GATES, MELINDA/, 'dn_scott'],
    ];
    const ORGS = [
      [/^A16Z|^ANDREESSEN HOROWITZ/, 'a16z'], [/^KOCH INC|^KOCH INDUSTRIES|^STAND TOGETHER INC/, 'koch'], [/^AMERICAN ISRAEL PUBLIC AFFAIRS COMMITTEE$/, 'aipac'],
      [/^RIPPLE LABS/, 'co_ripple'], [/^GEMINI TRUST/, 'co_ripple'], [/^COINBASE/, 'co_coinbase'], [/^GEOSOR CORPORATION/, 'dn_soros'], [/^ELON MUSK/, 'musk'],
      [/^CHEVRON/, 'chevron'], [/^RAI SERVICES/, 'tobacco'], [/^SECURING AMERICAN GREATNESS/, 'dk_sag'], [/^STAND TOGETHER CHAMBER OF COMMERCE/, 'dk_stc'],
    ];
    const ORG_TICKERS = [[/^DK CROWN HOLDINGS|^DRAFTKINGS/, 'DKNG', 'gambling'], [/^FANDUEL/, 'FLUT', 'gambling'], [/^ENERGY TRANSFER/, 'ET', null], [/^ALTRIA/, 'MO', 'tobacco']];
    const EMPLOYERS = [[/^SIG$|^SUSQUEHANNA/, 'co_janestreet'], [/^CITADEL/, 'co_citadel'], [/^ELLIOTT (MANAGEMENT|INVESTMENT)/, 'co_elliott'], [/^SPACE EXPLORATION TECHNOLOG/, 'spacex_tesla'], [/^APOLLO /, 'co_apollo'], [/^ENERGY TRANSFER/, null, 'ET'], [/^BLACKSTONE/, 'co_blackstone']];
    const resolveTicker = (t) => (t && tickerId.get(t)) ? tickerId.get(t).id : null;
    const looksOrg = n => /\b(FUND|ACCOUNT|ASSOCIATION|COMMITTEE|PAC|INC|LLC|CORP|TRUST|FOUNDATION|PARTNERSHIP|ACTION)\b/.test(n) || !n.includes(',');
    const darkish = id => { const r = db.prepare('SELECT industry, id FROM nodes WHERE id=?').get(id); return r && (/501c4|Dark money/i.test(r.industry) || r.id.startsWith('dk_')); };
    const donorNode = {}; const donorGifts = new Map();
    for (const d of dj.donors) {
      const up = d.name.toUpperCase().trim();
      const isOrg = d.entity === 'ORG' || looksOrg(up);
      let id = null;
      if (!isOrg) { for (const [re, cid] of PEOPLE) if (re.test(up) && nodeIds.has(cid)) { id = cid; break; } }
      else {
        for (const [re, cid] of ORGS) if (re.test(up) && nodeIds.has(cid)) { id = cid; break; }
        if (!id) for (const [re, t, fallback] of ORG_TICKERS) if (re.test(up)) { id = resolveTicker(t) || (fallback && nodeIds.has(fallback) ? fallback : null); if (id) break; }
        if (!id) id = match(up);
      }
      if (!id) {
        const pretty = isOrg ? prettyName(up.replace(/,\s*(NON-FEDERAL ACCOUNT|ASSOCIATION)$/, '')) : personName(prettyName(up.replace(/\b(MR|MRS|MS|DR)\.?(?=\s|$)/g, '').replace(/^([^,]+),\s*(.+)$/, '$2 $1').replace(/\s+/g, ' ').trim()));
        id = (isOrg ? 'dorg_' : 'donor_') + slug(normName(up) || up);
        if (!nodeIds.has(id)) {
          const job = [d.occupation && !/^(N\/A|NONE|INFORMATION REQUESTED)$/i.test(d.occupation) ? prettyName(d.occupation) : '', d.employer && !/^(N\/A|NONE|SELF|RETIRED|NOT[ -]EMPLOYED|HOMEMAKER|INFORMATION REQUESTED)/i.test(d.employer) ? prettyName(d.employer) : ''].filter(Boolean).join(', ');
          const where = [d.city && prettyName(d.city), d.state].filter(Boolean).join(', ');
          const desc = isOrg
            ? `Organization giving $${money(d.total)} to major PACs, super PACs and party committees in the 2025-26 cycle (FEC Schedule A).${where ? ' ' + where + '.' : ''}`
            : `Political megadonor: $${money(d.total)} to major PACs, super PACs and party committees in the 2025-26 cycle (FEC Schedule A).${job ? ' Listed as ' + job + '.' : ''}${where ? ' ' + where + '.' : ''}`;
          newNode(id, pretty, isOrg ? 'political' : 'economic', isOrg ? 'Politics' : 'Individuals & dynasties', 'Private', isOrg ? 'Political donors (organizations)' : 'Megadonors', job || where, desc, 'fec', d.total, '2025-26 political giving to major committees (FEC)', { aliases: '|' + d.name });
          out.donorsNew = (out.donorsNew || 0) + 1;
          // employer link for new individual donors (e.g. an executive giving in their own name)
          if (!isOrg && d.employer) {
            const emUp = d.employer.toUpperCase();
            let emp = null; for (const [re, cid, t] of EMPLOYERS) if (re.test(emUp)) { emp = cid && nodeIds.has(cid) ? cid : resolveTicker(t); break; }
            if (!emp && !/^(N\/A|NONE|SELF|RETIRED|NOT[ -]EMPLOYED|HOMEMAKER|INFORMATION)/.test(emUp)) emp = match(emUp);
            if (emp && emp !== id) { const en = (db.prepare('SELECT name FROM nodes WHERE id=?').get(emp) || {}).name || prettyName(d.employer); out.fecEdges += plainEdge(emp, id, 'I', 2, `Employer listed in FEC filings: ${en}`, 'fec'); }
          }
        }
      } else out.donorsMatched = (out.donorsMatched || 0) + 1;
      donorNode[d.key] = id;
      const dark = isOrg && darkish(id);
      for (const gft of d.gifts) {
        const dst = cmteNode[gft.cmte]; if (!dst || dst === id) continue;
        const gk = id + "|" + dst; const cur = donorGifts.get(gk) || { src: id, dst, amount: 0, dark, cmte: gft.cmte };
        cur.amount += gft.amount; donorGifts.set(gk, cur);
      }
    }
    for (const gft of donorGifts.values()) {
      const cname = (fec.committees.find(c => c.id === gft.cmte) || {}).name || gft.cmte;
      const note = gft.dark ? `$${money(gft.amount)} from a 501(c)(4) whose own donors are undisclosed, 2025-26 (FEC Schedule A)` : `$${money(gft.amount)} to ${prettyName(cname)}, 2025-26 cycle (FEC Schedule A)`;
      out.fecEdges += moneyEdge(gft.src, gft.dst, gft.dark ? 'D' : 'F', fecWeight(gft.amount), note, 'fec', gft.amount, gft.dark ? '2025-26 dark-money transfer (FEC Schedule A)' : '2025-26 contributions (FEC Schedule A)');
    }
  }

  // ================= 3d. committee-to-committee transfers among the tracked committees =================
  if (fs.existsSync('data/fec_transfers.json')) {
    const tj = JSON.parse(fs.readFileSync('data/fec_transfers.json', 'utf8'));
    for (const t of tj.transfers) {
      const src = cmteNode[t.from], dst = cmteNode[t.to]; if (!src || !dst || src === dst) continue;
      const note = 'USD ' + money(t.amount) + ' transferred committee to committee, 2025-26 cycle (FEC)';
      out.fecEdges += moneyEdge(src, dst, 'F', fecWeight(t.amount), note.replace('USD ', String.fromCharCode(36)), 'fec', t.amount, '2025-26 committee-to-committee transfers (FEC)');
    }
  }

  // ================= 4. documented ownership/management context the bulk feeds lack =================
  // Who runs the Energy Department's management-and-operating contractors (public DOE/NNSA contract records).
  // No dollar figure: these links explain who stands behind a contractor, the money is on the agency link.
  const CONTEXT_EDGES = [
    ['co_hon', 'fed_national_technology_engineering_solutions_sa', 'C', 5, 'Wholly owned subsidiary of Honeywell; manages Sandia National Laboratories for NNSA'],
    ['irs_314379427', 'fed_triad_national_security', 'C', 4, 'Member of Triad National Security (with the University of California and Texas A&M), which manages Los Alamos'],
    ['im_regents_of_the_university_of_california', 'fed_triad_national_security', 'C', 4, 'Member of Triad National Security (with Battelle and Texas A&M), which manages Los Alamos'],
    ['im_regents_of_the_university_of_california', 'fed_lawrence_livermore_national_security', 'C', 4, 'Member of Lawrence Livermore National Security (with Bechtel and others), which manages Livermore'],
    ['fed_bechtel_national', 'fed_lawrence_livermore_national_security', 'C', 4, 'Lead member of Lawrence Livermore National Security, which manages Livermore'],
    ['fed_bechtel_national', 'fed_consolidated_nuclear_security', 'C', 4, 'Lead member of Consolidated Nuclear Security, which manages the Y-12 National Security Complex'],
    ['irs_314379427', 'fed_ut_battelle', 'C', 4, 'Partner with the University of Tennessee in UT-Battelle, which manages Oak Ridge National Laboratory'],
    ['irs_314379427', 'fed_battelle_energy_alliance', 'C', 4, 'Lead member of Battelle Energy Alliance, which manages Idaho National Laboratory'],
  ];
  for (const [s, d, t, w, note] of CONTEXT_EDGES) out.contextEdges = (out.contextEdges || 0) + plainEdge(s, d, t, w, note, 'context');
  db.exec('COMMIT');
  return out;
}

// Dollar figures stated in hand-curated edge notes ("~$20B/yr default-search payments"). Unit required, so
// slogans like "Fight for $15" are not mistaken for amounts.
const NOTE_RE = /\$\s?(\d+(?:\.\d+)?)\s?(trillion|billion|million|T|B|M)\b/i;
export function noteAmount(note) {
  const m = NOTE_RE.exec(String(note || '')); if (!m) return null;
  const mult = { t: 1e12, trillion: 1e12, b: 1e9, billion: 1e9, m: 1e6, million: 1e6 }[m[2].toLowerCase()];
  return +m[1] * mult;
}
