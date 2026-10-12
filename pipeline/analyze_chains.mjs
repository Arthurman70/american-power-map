// Offline chain analysis used to research and write the curated findings (server/findings.mjs).
// Usage: node pipeline/analyze_chains.mjs [db] [mode] [args...]
//   presets            top chains for every flow preset
//   from <id> [up|down] [depth]
//   between <a> <b>
//   resolve <id> <id> ...
import { DatabaseSync } from 'node:sqlite';
import { loadGraph } from '../server/graph.mjs';
import { chainsFrom, chainsBetween, topChains, resolveChain, PRESETS } from '../server/chains.mjs';

const [dbPath = 'data/powermap.db', mode = 'presets', ...args] = process.argv.slice(2);
const db = new DatabaseSync(dbPath, { readOnly: true });
const g = loadGraph(db);
const $ = v => v >= 1e12 ? '$' + (v / 1e12).toFixed(2) + 'T' : v >= 1e9 ? '$' + (v / 1e9).toFixed(1) + 'B' : v >= 1e6 ? '$' + (v / 1e6).toFixed(1) + 'M' : '$' + (v / 1e3).toFixed(0) + 'K';
function print(ch, i) {
  if (ch.error) { console.log('  ERROR', ch.error); return; }
  console.log(`#${i + 1}  influence ${$(ch.score.influence)}  raw bottleneck ${$(ch.score.bottleneck)}${ch.score.bottleneckEst ? ' (est)' : ''}  reported hops ${ch.score.reportedHops}/${ch.score.hops}`);
  console.log('    ' + ch.nodes.map(n => n.id).join(' > '));
  ch.nodes.forEach((n, k) => {
    console.log(`    ${n.name}  [${n.s}/${n.ind}]`);
    const h = ch.hops[k]; if (h) console.log(`        ${h.forward ? '-->' : '<--'} ${h.verb} ${h.est ? '~' + $(h.value) + ' est' : $(h.amount) + ' reported'} :: ${h.note.slice(0, 140)}`);
  });
}
const t0 = Date.now();
if (mode === 'presets') for (const key of Object.keys(PRESETS)) { console.log(`\n========== ${PRESETS[key].label} ==========`); topChains(g, key, +args[0] || 12).forEach(print); }
else if (mode === 'from') chainsFrom(g, args[0], { dir: args[1] || 'down', maxDepth: +args[2] || 4, k: +args[3] || 10, reportedOnly: args[4] === 'rep' }).forEach(print);
else if (mode === 'between') chainsBetween(g, args[0], args[1], { k: 8, directed: args[2] !== 'any' }).forEach(print);
else if (mode === 'resolve') print(resolveChain(g, args), 0);
console.error(`(${Date.now() - t0} ms, ${g.nodes.length} nodes, ${g.edges.length} edges)`);
