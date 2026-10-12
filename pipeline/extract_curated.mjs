// Extracts the hand-curated NODES / EDGES from the single-file us-power-map.html into data/curated.json,
// then appends pipeline/additions.mjs (new nonprofit + government centers not present in the original file).
import fs from 'node:fs';
import { ADD_NODES, ADD_EDGES } from './additions.mjs';
import { ADD_NODES2, ADD_EDGES2 } from './additions2.mjs';
const src = process.argv[2] || 'source/us-power-map.html';
const html = fs.readFileSync(src, 'utf8');
const start = html.indexOf('// ===================== DATA =====================');
const end = html.indexOf('// ===================== GRAPH =====================');
if (start < 0 || end < 0) throw new Error('DATA/GRAPH markers not found');
let js = html.slice(start, end);
// Some data sections push into NODES/EDGES_RAW after their declaration; evaluate the whole block.
const THREE = { Color: class { constructor(c){ this.c=c; } } };
const fn = new Function('THREE', js + '\n return {CATS, ETYPES, NODES, EDGES_RAW};');
const { CATS, ETYPES, NODES, EDGES_RAW } = fn(THREE);
const RE = /^([^>]+)>([^:]+):([CFRKEILD])([1-5]):?(.*)$/;
const ids = new Set(NODES.map(n => n.id));
const seen = new Set(); const edges = [];
for (const s of EDGES_RAW) { const m = String(s).match(RE); if (!m) continue; if (!ids.has(m[1]) || !ids.has(m[2]) || m[1] === m[2]) continue; const k = m[1] + '>' + m[2]; if (seen.has(k)) continue; seen.add(k); edges.push({ from: m[1], to: m[2], type: m[3], weight: +m[4], note: m[5] || '' }); }
const nodes = NODES.map(n => ({ id: n.id, name: n.n, category: n.c, sector: n.s, branch: n.b, dm: n.dm || '', power: n.p, tier: n.t, description: n.d || '', industry: n.ind || 'Other', group: n.g || null, party: n.pt || null, aliases: n.al || n.aliases || null }));

// merge in pipeline/additions.mjs and additions2.mjs — same shape, same rules, applied in order
let addNodeCount = 0, addEdgeCount = 0;
function mergeBatch(label, ADD_NODES, ADD_EDGES) {
  const dupWithExisting = ADD_NODES.filter(n => ids.has(n.id));
  if (dupWithExisting.length) throw new Error(`${label} id collides with an existing node: ` + dupWithExisting.map(n => n.id).join(', '));
  for (const n of ADD_NODES) {
    nodes.push({ id: n.id, name: n.name, category: n.category, sector: n.sector, branch: n.branch, dm: n.dm || '', power: n.power, tier: n.tier, description: n.description || '', industry: n.industry || 'Other', group: null, party: null, aliases: null, funding: n.funding ?? null, fundingBasis: n.fundingBasis ?? null });
    ids.add(n.id); addNodeCount++;
  }
  for (const e of ADD_EDGES) { if (!ids.has(e.from) || !ids.has(e.to) || e.from === e.to) continue; const k = e.from + '>' + e.to; if (seen.has(k)) continue; seen.add(k); edges.push(e); addEdgeCount++; }
}
mergeBatch('additions.mjs', ADD_NODES, ADD_EDGES);
mergeBatch('additions2.mjs', ADD_NODES2, ADD_EDGES2);

fs.writeFileSync('data/curated.json', JSON.stringify({ generated: new Date().toISOString().slice(0,10), categories: CATS, edgeTypes: ETYPES, nodes, edges }, null, 0));
console.log('nodes', nodes.length, '(+' + addNodeCount + ' additions)', 'edges', edges.length, '(+' + addEdgeCount + ' additions)', 'edgeTypes', Object.keys(ETYPES).join(''));
