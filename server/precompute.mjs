// Precomputes every layout into the positions table. Usage: node server/precompute.mjs [db] [layout ...]
import { computeLayout, LAYOUTS } from './graph.mjs';
const db = process.argv[2] || 'data/powermap.db';
const which = process.argv.length > 3 ? process.argv.slice(3) : LAYOUTS;
for (const l of which) {
  const t0 = Date.now();
  const out = computeLayout(db, l);
  console.log(`${l}: ${out.length / 3} nodes in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
