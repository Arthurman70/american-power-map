// Verifies server/findings.mjs against a built database: every chain must resolve, and every dollar figure quoted
// in a summary should match a reported amount on one of the finding's links or a center's size. Figures that match
// nothing (derived totals, per-resident numbers) are listed for a human to re-check.
// Usage: node pipeline/check_findings.mjs [db]
import { DatabaseSync } from 'node:sqlite';
import { loadGraph } from '../server/graph.mjs';
import { resolveChain } from '../server/chains.mjs';
import { FINDINGS } from '../server/findings.mjs';

const db = new DatabaseSync(process.argv[2] || 'data/powermap.db', { readOnly: true });
const g = loadGraph(db);
const fmt = v => { const a = Math.abs(v); return a >= 1e12 ? [(v / 1e12).toFixed(2) + 'T', (v / 1e12).toFixed(1) + 'T'] : a >= 1e9 ? [(v / 1e9).toFixed(1) + 'B'] : a >= 1e6 ? [(v / 1e6).toFixed(1) + 'M', (v / 1e6).toFixed(0) + 'M'] : [(v / 1e3).toFixed(0) + 'K']; };
let errors = 0, unmatched = 0;
for (const f of FINDINGS) {
  const known = new Set(), add = v => { if (v > 0) for (const s of fmt(v)) known.add(s); };
  const fundingOf = id => { const r = db.prepare('SELECT funding FROM nodes WHERE id=?').get(id); return r && r.funding; };
  let bad = 0;
  for (const ids of f.chains) {
    const c = resolveChain(g, ids);
    if (c.error) { console.log(`  ✗ ${f.id}: ${ids.join(' > ')} :: ${c.error}`); bad++; errors++; continue; }
    for (const h of c.hops) if (!h.est || h.cited) add(h.amount);
    for (const n of c.nodes) add(fundingOf(n.id));
  }
  const quoted = [...f.summary.matchAll(/\$(\d[\d,.]*)([KMBT])\b/g)].map(m => m[1].replace(/,/g, '') + m[2]);
  const miss = quoted.filter(q => !known.has(q) && !known.has(q.replace(/\.0([MBT])$/, '$1')));
  unmatched += miss.length;
  console.log(`${bad ? '✗' : '✓'} ${f.id.padEnd(22)} ${f.chains.length} chains${miss.length ? '  · check: ' + miss.map(m => '$' + m).join(' ') : ''}`);
}
console.log(`\n${FINDINGS.length} findings, ${errors} broken chains, ${unmatched} figures not matched to a single link (derived totals are expected here)`);
process.exit(errors ? 1 : 0);
