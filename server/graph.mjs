// In-memory graph mirror of the SQLite edge table: adjacency for path / chain / depth queries,
// plus the layout job used by both the API server (worker thread) and the precompute script.
import { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
require(path.join(__dirname, 'layout.js'));            // defines globalThis.PowerLayout
const PL = globalThis.PowerLayout;

export const LAYOUTS = ['cat', 'sector', 'branch', 'hier', 'radial:p', 'radial:outW', 'radial:inW', 'radial:net', 'radial:deg'];

export function loadGraph(db) {
  const nodes = db.prepare('SELECT rowid AS rid, id, name, category c, sector s, branch b, industry ind, power p, tier t, deg, out_w outW, in_w inW, (out_w-in_w) net, has_dark dark, source src, funding, funding_basis fundingBasis FROM nodes ORDER BY rowid').all();
  const idx = new Map(); nodes.forEach((n, i) => { idx.set(n.id, i); n.i = i; n.out = []; n.in = []; });
  const edges = db.prepare('SELECT id, src, dst, type t, weight w, note, amount, amount_basis basis, source FROM edges ORDER BY id').all();
  const live = [];
  for (const e of edges) { const s = idx.get(e.src), d = idx.get(e.dst); if (s === undefined || d === undefined) continue; e.si = s; e.di = d; nodes[s].out.push(e); nodes[d].in.push(e); live.push(e); }
  const sectors = [...new Set(nodes.map(n => n.s))], branches = [...new Set(nodes.map(n => n.b))];
  return { nodes, idx, edges: live, sectors, branches };
}

export function chainOfCommand(g, n) {
  const chain = [n]; const seen = new Set([n]); let cur = n;
  for (let k = 0; k < 8; k++) {
    const cands = cur.in.filter(e => e.t === 'C' && !seen.has(g.nodes[e.si])).sort((a, b) => b.w - a.w || g.nodes[b.si].p - g.nodes[a.si].p);
    if (!cands.length) break; cur = g.nodes[cands[0].si]; seen.add(cur); chain.unshift(cur); if (cur.t === 0) break;
  }
  return chain;
}

export function shortestPath(g, srcId, dstId, directed) {
  const src = g.idx.get(srcId), dst = g.idx.get(dstId); if (src === undefined || dst === undefined) return null;
  const N = g.nodes.length; const dist = new Float64Array(N).fill(Infinity); const prev = new Array(N); dist[src] = 0;
  // binary heap
  const heap = [[0, src]]; const done = new Uint8Array(N);
  const push = (it) => { heap.push(it); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  while (heap.length) {
    const [d, u] = pop(); if (done[u]) continue; done[u] = 1; if (u === dst) break;
    const step = (e, v) => { if (done[v]) return; const nd = d + (6 - e.w); if (nd < dist[v]) { dist[v] = nd; prev[v] = { e, from: u }; push([nd, v]); } };
    for (const e of g.nodes[u].out) step(e, e.di);
    if (!directed) for (const e of g.nodes[u].in) step(e, e.si);
  }
  if (dist[dst] === Infinity) return { none: true };
  const nodes = [dst], edges = []; let cur = dst;
  while (cur !== src) { const p = prev[cur]; edges.unshift(p.e); cur = p.from; nodes.unshift(cur); }
  return { nodes: nodes.map(i => g.nodes[i].id), edges: edges.map(e => ({ src: e.src, dst: e.dst, t: e.t, w: e.w, note: e.note })) };
}

export function depthFrom(g, rootId, dir) {
  const root = g.idx.get(rootId); if (root === undefined) return null;
  const depth = new Int32Array(g.nodes.length).fill(-1); depth[root] = 0; const q = [root]; let maxD = 0;
  for (let h = 0; h < q.length; h++) {
    const u = q[h]; const nb = [];
    if (dir !== 'up') for (const e of g.nodes[u].out) nb.push(e.di);
    if (dir !== 'down') for (const e of g.nodes[u].in) nb.push(e.si);
    for (const v of nb) if (depth[v] < 0) { depth[v] = depth[u] + 1; if (depth[v] > maxD) maxD = depth[v]; q.push(v); }
  }
  return { depth, maxD };
}

/* Computes and stores one layout. Returns Float32Array(N*3). */
export function computeLayout(dbPath, layoutName, onProgress) {
  const db = new DatabaseSync(dbPath);
  const g = loadGraph(db);
  const [mode, metric] = layoutName.split(':');
  const N = g.nodes.length; const size = new Float32Array(N); g.nodes.forEach((n, i) => size[i] = PL.sizeOf(n));
  const a = PL.anchors(g.nodes, mode, { sectors: g.sectors, branches: g.branches, metric: metric || 'p' });
  const E = g.edges.length; const es = new Int32Array(E), ed = new Int32Array(E), ew = new Float32Array(E);
  g.edges.forEach((e, k) => { es[k] = e.si; ed[k] = e.di; ew[k] = e.w; });
  const r = PL.run({ N, size, ...a, es, ed, ew, iters: 260, onProgress });
  const ins = db.prepare('INSERT OR REPLACE INTO positions(layout,node_id,x,y,z) VALUES(?,?,?,?,?)');
  db.exec('BEGIN'); db.prepare('DELETE FROM positions WHERE layout=?').run(layoutName);
  for (let i = 0; i < N; i++) ins.run(layoutName, g.nodes[i].id, r.x[i], r.y[i], r.z[i]);
  db.exec('COMMIT'); db.close();
  const out = new Float32Array(N * 3); for (let i = 0; i < N; i++) { out[i * 3] = r.x[i]; out[i * 3 + 1] = r.y[i]; out[i * 3 + 2] = r.z[i]; }
  return out;
}
