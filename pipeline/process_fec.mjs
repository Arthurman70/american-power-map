// Aggregates FEC bulk data for the 2025-2026 election cycle -> data/fec.json.
// Inputs (data/fec/, from https://www.fec.gov/data/browse-data/?tab=bulk-data):
//   webk26.txt  PAC & party committee financial summaries
//   cm.txt      committee master (connected organization, party, type)
//   itpas2.txt  contributions & independent expenditures from committees to candidates
//   cn.txt      candidate master;  weball26.txt  candidate financial summaries
// Keeps the 400 biggest non-candidate committees (super PACs, party committees, corporate/union/trade PACs) and
// their money flows to candidates, so every resulting edge carries a real FEC-reported dollar amount.
import fs from 'node:fs';
import readline from 'node:readline';

const D = 'data/fec/';
const lines = f => fs.readFileSync(D + f, 'utf8').split(/\r?\n/).filter(Boolean).map(l => l.split('|'));
const TOP_COMMITTEES = 400, MIN_CAND_TOTAL = 250000, MAX_CANDIDATES = 350;

// committee master
const cm = {};
for (const r of lines('cm.txt')) cm[r[0]] = { name: r[1], dsgn: r[8], type: r[9], party: r[10], orgType: r[12], connectedOrg: r[13], candId: r[14] };
// committee financial summaries (excluding candidates' own campaign committees: types H, S, P)
const committees = [];
for (const r of lines('webk26.txt')) {
  const type = r[2]; if (type === 'H' || type === 'S' || type === 'P') continue;
  const c = { id: r[0], name: r[1], type, dsgn: r[3], receipts: +r[5] || 0, indivContrib: +r[7] || 0, disb: +r[12] || 0, coh: +r[19] || 0, contribToOther: +r[22] || 0, ie: +r[23] || 0, coordExp: +r[24] || 0, cvgEnd: r[26] };
  const m = cm[c.id] || {}; Object.assign(c, { party: m.party || '', connectedOrg: m.connectedOrg || '', orgType: m.orgType || '' });
  committees.push(c);
}
committees.sort((a, b) => Math.max(b.disb, b.receipts) - Math.max(a.disb, a.receipts));
const top = committees.slice(0, TOP_COMMITTEES);
const topIds = new Set(top.map(c => c.id));

// candidates
const cand = {};
for (const r of lines('cn.txt')) cand[r[0]] = { id: r[0], name: r[1], party: r[2], year: r[3], officeState: r[4], office: r[5], district: r[6], ici: r[7], status: r[8], pcc: r[9] };
for (const r of lines('weball26.txt')) { const c = cand[r[0]]; if (c) { c.receipts = +r[5] || 0; c.disb = +r[7] || 0; c.coh = +r[10] || 0; c.indivContrib = +r[17] || 0; c.pacContrib = +r[25] || 0; c.cvgEnd = r[27]; } }

// flows: committee -> candidate
const KIND = { '24K': 'contrib', '24Z': 'contrib', '24C': 'contrib', '24E': 'ie_support', '24A': 'ie_oppose', '24F': 'ie_support', '24N': 'ie_oppose' };
const flows = new Map(); const seenSub = new Set(); let rowsIn = 0, rowsUsed = 0;
const rl = readline.createInterface({ input: fs.createReadStream(D + 'itpas2.txt'), crlfDelay: Infinity });
for await (const line of rl) {
  rowsIn++;
  const r = line.split('|');
  const cmte = r[0], tp = r[5], candId = r[16], memo = r[19], sub = r[21];
  if (!topIds.has(cmte) || !candId || memo === 'X') continue;
  const kind = KIND[tp]; if (!kind) continue;
  if (sub) { if (seenSub.has(sub)) continue; seenSub.add(sub); }
  const amt = +r[14] || 0; if (amt <= 0) continue;
  const k = cmte + '|' + candId + '|' + kind;
  const f = flows.get(k) || { cmte, cand: candId, kind, amount: 0, count: 0 };
  f.amount += amt; f.count++; flows.set(k, f); rowsUsed++;
}
const flowList = [...flows.values()];
const candTotals = {};
for (const f of flowList) candTotals[f.cand] = (candTotals[f.cand] || 0) + f.amount;
const keepCands = Object.entries(candTotals).filter(([id, t]) => t >= MIN_CAND_TOTAL && cand[id]).sort((a, b) => b[1] - a[1]).slice(0, MAX_CANDIDATES).map(([id]) => id);
const keepSet = new Set(keepCands);
const keptFlows = flowList.filter(f => keepSet.has(f.cand) && (f.amount >= 10000 || f.kind !== 'contrib'));
const cvgEnd = top.map(c => c.cvgEnd).filter(Boolean).sort().pop();

fs.writeFileSync('data/fec.json', JSON.stringify({ cycle: 2026, fetched: new Date().toISOString().slice(0, 10), coverageEnd: cvgEnd, committees: top, candidates: keepCands.map(id => ({ ...cand[id], fromTopCommittees: candTotals[id] })), flows: keptFlows }));
console.log(`committees kept ${top.length} (threshold $${(Math.max(top.at(-1).disb, top.at(-1).receipts) / 1e6).toFixed(1)}M), itpas2 rows ${rowsIn.toLocaleString()} used ${rowsUsed.toLocaleString()}, candidates kept ${keepCands.length}, flows kept ${keptFlows.length}`);
console.log('top committees:', top.slice(0, 10).map(c => `${c.name} $${(c.disb / 1e6).toFixed(0)}M`).join(' | '));
console.log('top candidates by inflow:', keepCands.slice(0, 8).map(id => `${cand[id].name} $${(candTotals[id] / 1e6).toFixed(1)}M`).join(' | '));
