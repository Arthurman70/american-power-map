// Second wave of nonprofit additions (~500 nodes), generated from pipeline/nonprofits_data.mjs rather than
// hand-typed one at a time. Every node gets an IRS tax-exempt-status edge (weight 1) plus one category-based
// "hub" edge — several of those hub edges deliberately land on the same target (npo_pbs, cms, irs, fg_samhsa,
// npo_hrc, npo_feedingamerica, education) so the new membrane-bundling view (server/layout.js "bundles") has
// real, meaningful clusters to summarize instead of a hairball of one-off lines.
import {
  FOUNDATIONS2, CHILDRENS_HOSPITALS, PBS_STATIONS, ORCHESTRAS, MUSEUMS, DISEASE_CHARITIES, LAND_TRUSTS, ZOOS,
  YOUTH_ORGS, DISABILITY_ORGS, ADDICTION_MH_ORGS, LGBTQ_ORGS, IMMIGRATION_ORGS, BLOOD_ORGAN_ORGS, HOSPICE_ORGS,
  HISTORIC_PRESERVATION, PROFESSIONAL_ASSOC, COMMUNITY_FOUNDATIONS2, FOOD_BANKS, INTL_NGOS2, UNIVERSITIES2,
  SCIENCE_HISTORY_MUSEUMS, LEGAL_AID_ORGS, ANIMAL_WELFARE2,
} from './nonprofits_data.mjs';

const nodes = [], edges = [];
const usedIds = new Set();
function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40); }
function id2(prefix, s) { let id = 'n2_' + prefix + '_' + slug(s); if (usedIds.has(id)) id += '_' + Math.random().toString(36).slice(2, 5); usedIds.add(id); return id; }
function add(idPrefix, name, opts) {
  const id = id2(idPrefix, name);
  nodes.push({
    id, name, category: opts.category, sector: 'Nonprofit', branch: opts.branch || 'Private', industry: opts.industry,
    dm: opts.dm || '', description: opts.description, power: opts.power ?? 2, tier: opts.tier ?? 4,
    funding: opts.funding ?? null, fundingBasis: opts.fundingBasis ?? null,
  });
  edges.push({ from: 'irs', to: id, type: 'R', weight: 1, note: 'Tax-exempt status oversight' });
  if (opts.hub) edges.push({ from: opts.hubDir === 'in' ? id : opts.hub, to: opts.hubDir === 'in' ? opts.hub : id, type: opts.hubType || 'I', weight: opts.hubWeight || 1, note: opts.hubNote || '' });
  return id;
}

// ---------- foundations ----------
for (const f of FOUNDATIONS2) add('fdn', f.name, { category: 'economic', industry: 'Foundations & philanthropy', dm: `Endowment ~$${(f.endowment / 1e9).toFixed(1)}B`, description: f.desc, funding: f.grants, fundingBasis: 'Annual grantmaking', power: 4, tier: 3 });

// ---------- children's hospitals: hub = cms (Medicare/Medicaid pediatric funding) ----------
for (const [name, city, state] of CHILDRENS_HOSPITALS) add('hosp', name, {
  category: 'environmental', industry: 'Hospitals & nursing homes', dm: `${city}, ${state}`,
  description: `Nonprofit children's hospital in ${city}, ${state}.`, funding: 4e8, fundingBasis: 'Typical large nonprofit children’s-hospital annual revenue (estimate)',
  power: 3, tier: 4, hub: 'cms', hubType: 'F', hubWeight: 2, hubNote: 'Medicare/Medicaid pediatric funding',
});

// ---------- PBS stations: hub = npo_pbs (member station) + CPB funding ----------
for (const [name, city] of PBS_STATIONS) {
  const pid = add('pbs', name, {
    category: 'cultural', industry: 'News media', dm: city,
    description: `Local PBS member station serving ${city}.`, funding: 1.2e7, fundingBasis: 'Typical PBS member-station annual budget (estimate)',
    power: 1, tier: 5,
  });
  edges.push({ from: pid, to: 'npo_pbs', type: 'I', weight: 2, note: 'PBS member station' });
  edges.push({ from: 'ag_cpb', to: pid, type: 'F', weight: 1, note: 'Community Service Grant' });
}

// ---------- orchestras & museums ----------
for (const o of ORCHESTRAS) add('orch', o.name, { category: 'cultural', industry: 'TV, movies, music & games', dm: o.city, description: `Major U.S. symphony orchestra based in ${o.city}.`, funding: 6e7, fundingBasis: 'Typical major-orchestra annual budget (estimate)', power: 2, tier: 4 });
for (const m of MUSEUMS) add('mus', m.name, { category: 'cultural', industry: 'Other', dm: m.city, description: `Major encyclopedic art museum in ${m.city}.`, funding: 1e8, fundingBasis: 'Typical major-museum annual budget (estimate)', power: 2, tier: 4 });

// ---------- disease charities: hub = nih (research partnership) ----------
for (const d of DISEASE_CHARITIES) add('dis', d.name, { category: 'environmental', industry: 'Health policy & science', description: d.desc, funding: 1.5e8, fundingBasis: 'Typical national disease-charity annual revenue (estimate)', power: 3, tier: 4, hub: 'nih', hubType: 'F', hubWeight: 1, hubNote: 'Research funding partnership' });

// ---------- land trusts / environmental: hub = epa ----------
for (const l of LAND_TRUSTS) add('env', l.name, { category: 'environmental', industry: 'Think tanks & advocacy', description: l.desc, funding: 8e7, fundingBasis: 'Typical national environmental-nonprofit annual revenue (estimate)', power: 3, tier: 4, hub: 'epa', hubType: 'I', hubWeight: 1, hubNote: 'Rulemaking comments and litigation' });

// ---------- zoos: hub = usda (Animal Welfare Act licensing) ----------
for (const z of ZOOS) add('zoo', z.name, { category: 'environmental', industry: 'Other', dm: z.city, description: `Nonprofit zoo/aquarium and conservation organization in ${z.city}.`, funding: 9e7, fundingBasis: 'Typical major-zoo annual budget (estimate)', power: 2, tier: 4, hub: 'usda', hubType: 'R', hubWeight: 1, hubNote: 'Animal Welfare Act licensing and inspection' });

// ---------- youth orgs ----------
for (const y of YOUTH_ORGS) add('yth', y.name, { category: 'environmental', industry: 'Education', description: y.desc, funding: 3e8, fundingBasis: 'Network-wide annual revenue (estimate)', power: 3, tier: 4 });

// ---------- disability orgs: hub = doj_civilrights ----------
for (const d of DISABILITY_ORGS) add('dis2', d.name, { category: 'legal', industry: 'Think tanks & advocacy', description: d.desc, funding: 1e8, fundingBasis: 'Network-wide annual revenue (estimate)', power: 2, tier: 4, hub: 'doj_civilrights', hubType: 'I', hubWeight: 1, hubNote: 'ADA and disability-rights enforcement referrals' });

// ---------- addiction / mental health: hub = fg_samhsa ----------
for (const a of ADDICTION_MH_ORGS) add('mh', a.name, { category: 'environmental', industry: 'Health policy & science', description: a.desc, funding: 6e7, fundingBasis: 'Annual revenue (estimate)', power: 2, tier: 4, hub: 'fg_samhsa', hubType: 'I', hubWeight: 2, hubNote: 'Treatment and crisis-line coordination' });

// ---------- LGBTQ+: hub = npo_hrc ----------
for (const l of LGBTQ_ORGS) add('lgbtq', l.name, { category: 'political', industry: 'Think tanks & advocacy', description: l.desc, funding: 4e7, fundingBasis: 'Annual revenue (estimate)', power: 2, tier: 4, hub: 'npo_hrc', hubType: 'I', hubWeight: 2, hubNote: 'Coalition partner' });

// ---------- immigration legal aid: hub = uscis ----------
for (const i of IMMIGRATION_ORGS) add('imm', i.name, { category: 'legal', industry: 'Lawyers & law firms', description: i.desc, funding: 5e7, fundingBasis: 'Annual revenue (estimate)', power: 2, tier: 4, hub: 'uscis', hubType: 'K', hubWeight: 1, hubNote: 'Litigation over immigration enforcement' });

// ---------- blood/organ + hospice: hub = fda / cms ----------
for (const b of BLOOD_ORGAN_ORGS) add('blood', b.name, { category: 'environmental', industry: 'Hospitals & nursing homes', description: b.desc, funding: 3e8, fundingBasis: 'Network-wide annual revenue (estimate)', power: 3, tier: 4, hub: 'fda', hubType: 'R', hubWeight: 1, hubNote: 'Blood and tissue-safety regulation' });
for (const h of HOSPICE_ORGS) add('hos', h.name, { category: 'environmental', industry: 'Hospitals & nursing homes', description: h.desc, funding: 2e7, fundingBasis: 'Annual revenue (estimate)', power: 1, tier: 5, hub: 'cms', hubType: 'I', hubWeight: 1, hubNote: 'Medicare hospice-benefit rules' });

// ---------- historic preservation: hub = nps ----------
for (const h of HISTORIC_PRESERVATION) add('hist', h.name, { category: 'cultural', industry: 'Other', description: h.desc, funding: 1e8, fundingBasis: 'Annual revenue (estimate)', power: 2, tier: 4, hub: 'nps', hubType: 'I', hubWeight: 1, hubNote: 'Historic-site partnership' });

// ---------- professional / scientific associations: hub = congress ----------
for (const p of PROFESSIONAL_ASSOC) add('prof', p.name, { category: 'political', industry: 'Think tanks & advocacy', description: p.desc, funding: 1.5e8, fundingBasis: 'Annual revenue (estimate)', power: 3, tier: 4, hub: 'congress', hubType: 'I', hubWeight: 1, hubNote: 'Professional-licensing and science-policy advocacy' });

// ---------- community foundations ----------
for (const c of COMMUNITY_FOUNDATIONS2) add('cf', c.name, { category: 'economic', industry: 'Foundations & philanthropy', dm: c.city, description: `Major community foundation serving ${c.city}.`, funding: 2e8, fundingBasis: 'Annual grantmaking (estimate)', power: 3, tier: 4 });

// ---------- food banks: hub = npo_feedingamerica ----------
for (const f of FOOD_BANKS) add('food', f.name, { category: 'environmental', industry: 'Other', dm: f.city, description: `Regional food bank serving ${f.city} and a member of the Feeding America network.`, funding: 2e8, fundingBasis: 'Annual revenue, mostly in-kind food (estimate)', power: 3, tier: 4, hub: 'npo_feedingamerica', hubType: 'I', hubWeight: 2, hubNote: 'Feeding America network member' });

// ---------- international NGOs: hub = state (foreign-aid contracts) ----------
for (const i of INTL_NGOS2) add('intl', i.name, { category: 'environmental', industry: 'Other', description: i.desc, funding: 3e8, fundingBasis: 'Annual revenue (estimate)', power: 3, tier: 4, hub: 'state', hubType: 'F', hubWeight: 1, hubNote: 'USAID/State foreign-aid contracts' });

// ---------- elite private universities: hub = education (Title IV student aid) ----------
for (const u of UNIVERSITIES2) add('univ', u.name, { category: 'economic', industry: 'Education', dm: `Endowment ~$${(u.endowment / 1e9).toFixed(0)}B`, description: u.desc, funding: u.endowment * 0.05, fundingBasis: 'Typical annual endowment spending draw (~5% of endowment)', power: 5, tier: 3, hub: 'education', hubType: 'R', hubWeight: 2, hubNote: 'Title IV student-aid oversight' });

// ---------- science & history museums ----------
for (const m of SCIENCE_HISTORY_MUSEUMS) add('smus', m.name, { category: 'cultural', industry: 'Other', dm: m.city, description: `Major science/history museum in ${m.city}.`, funding: 9e7, fundingBasis: 'Typical major-museum annual budget (estimate)', power: 2, tier: 4 });

// ---------- legal aid: hub = scotus/courts (litigation) ----------
for (const l of LEGAL_AID_ORGS) add('legal', l.name, { category: 'legal', industry: 'Lawyers & law firms', description: l.desc, funding: 3e8, fundingBasis: 'Annual revenue/appropriation (estimate)', power: 3, tier: 4, hub: 'statecourts', hubType: 'K', hubWeight: 1, hubNote: 'Civil legal-aid litigation' });

// ---------- animal welfare: hub = npo_hsus ----------
for (const a of ANIMAL_WELFARE2) add('animal', a.name, { category: 'environmental', industry: 'Other', description: a.desc, funding: 8e7, fundingBasis: 'Annual revenue (estimate)', power: 2, tier: 4, hub: 'npo_hsus', hubType: 'I', hubWeight: 1, hubNote: 'Animal-welfare coalition partner' });

export const ADD_NODES2 = nodes;
export const ADD_EDGES2 = edges;
