// Power-chain engine: scores, discovers and resolves chains of influence over the in-memory graph.
//
// Every link gets a dollar value. If a source reported one (13F position, FY2025 federal award, FEC
// contribution/IE, a figure in a curated note) that is used as-is and marked "reported". Otherwise the link is
// ESTIMATED as a share of the smaller party's size, scaled by link strength (1-5) — a proxy for how much money
// or power can plausibly pass, always labeled as an estimate in the UI.
//
// A chain's raw BOTTLENECK is its smallest link value — the most that can flow through every hop. Chains are
// RANKED by an evidence-weighted version, the INFLUENCE SCORE: estimated links count at EST_DISCOUNT of their
// value, so a chain made of reported money outranks one held together by guesses about how big institutions
// relate. Dollar figures quoted in curated notes ("$600B pledge", "holds ~$4T of Treasuries") are often stocks or
// pledges rather than money moving along the link, so they are displayed as "cited" but scored as estimates.
export const EST_DISCOUNT = 0.1;

// link strength (1-5) -> share of the smaller party's size, by link type. Money and control links can move a real
// fraction of a budget; influence, pressure and oversight links are sized like the spending it takes to exert them.
const SHARE = {
  C: [0, 0.001, 0.004, 0.015, 0.05, 0.15],
  F: [0, 0.0005, 0.002, 0.008, 0.03, 0.1], D: [0, 0.0005, 0.002, 0.008, 0.03, 0.1],
  I: [0, 0.00002, 0.0001, 0.0004, 0.0015, 0.005], L: [0, 0.00002, 0.0001, 0.0004, 0.0015, 0.005],
  K: [0, 0.00002, 0.0001, 0.0004, 0.0015, 0.005], E: [0, 0.00005, 0.0002, 0.0008, 0.003, 0.01], R: [0, 0.00002, 0.0001, 0.0004, 0.0015, 0.005],
};
const POWER_PROXY = [5e7, 1.5e8, 5e8, 1.7e9, 5e9, 1.7e10, 5e10, 1.7e11, 5e11, 2e12, 6e12]; // power 0-10 -> $ size when no funding figure exists
export const VERB = { C: 'controls', F: 'funds', R: 'regulates', K: 'checks', E: 'coerces', I: 'influences', L: 'has leverage over', D: 'moves dark money to' };

export function nodeSize(n) { return n.funding > 0 ? n.funding : POWER_PROXY[Math.max(0, Math.min(10, Math.round(n.p || 0)))]; }
const isCited = e => e.amount > 0 && /source note/i.test(e.basis || '');
export function edgeValue(g, e) {
  if (e.amount > 0 && !isCited(e)) return { v: e.amount, est: false, cited: false };
  const a = g.nodes[e.si], b = g.nodes[e.di];
  return { v: Math.min(nodeSize(a), nodeSize(b)) * (SHARE[e.t] || SHARE.I)[e.w || 1], est: true, cited: isCited(e) };
}
// ranking value: estimates discounted
function val(g, e) { if (e._v === undefined) { const ev = edgeValue(g, e); e._v = ev.est ? ev.v * EST_DISCOUNT : ev.v; } return e._v; }

// ---------- chain object ----------
export function describeChain(g, idxs, hopEdges) {
  const nodes = idxs.map(i => { const n = g.nodes[i]; return { id: n.id, name: n.name, c: n.c, s: n.s, b: n.b, ind: n.ind, p: n.p, funding: n.funding ?? null, fundingBasis: n.fundingBasis ?? null }; });
  const hops = hopEdges.map((e, k) => {
    const forward = e.si === idxs[k];
    const ev = edgeValue(g, e);
    return { src: e.src, dst: e.dst, t: e.t, verb: VERB[e.t] || e.t, w: e.w, note: e.note || '', amount: e.amount ?? null, basis: e.basis ?? null, source: e.source || null, value: ev.v, est: ev.est, cited: ev.cited, forward };
  });
  const values = hops.map(h => h.value);
  const bottleneck = values.length ? Math.min(...values) : 0;
  const reported = hops.filter(h => !h.est);
  const ranked = hops.map(h => h.est ? h.value * EST_DISCOUNT : h.value);
  const influence = ranked.length ? Math.min(...ranked) : 0;
  return {
    key: idxs.map(i => g.nodes[i].id).join('>'),
    nodes, hops,
    score: { influence, bottleneck, bottleneckEst: hops.length ? hops[values.indexOf(bottleneck)].est : true, reportedHops: reported.length, hops: hops.length, reportedTotal: reported.reduce((a, h) => a + h.amount, 0), start: nodeSize(g.nodes[idxs[0]]), end: nodeSize(g.nodes[idxs.at(-1)]) },
  };
}

// best link between consecutive nodes (either direction; prefers the forward, highest-value one)
function linkBetween(g, ai, bi) {
  let best = null, bestScore = -1;
  for (const e of g.nodes[ai].out) if (e.di === bi) { const s = val(g, e) * 1.0001; if (s > bestScore) { best = e; bestScore = s; } }
  for (const e of g.nodes[ai].in) if (e.si === bi) { const s = val(g, e); if (s > bestScore) { best = e; bestScore = s; } }
  return best;
}
export function resolveChain(g, ids) {
  const idxs = []; for (const id of ids) { const i = g.idx.get(id); if (i === undefined) return { error: `unknown center: ${id}` }; idxs.push(i); }
  if (idxs.length < 2) return { error: 'a chain needs at least two centers' };
  const hops = [];
  for (let k = 0; k + 1 < idxs.length; k++) { const e = linkBetween(g, idxs[k], idxs[k + 1]); if (!e) return { error: `no direct link between ${g.nodes[idxs[k]].name} and ${g.nodes[idxs[k + 1]].name}`, at: k }; hops.push(e); }
  return describeChain(g, idxs, hops);
}

// ---------- discovery: widest (max-bottleneck) chains from one center ----------
// Layered DP: best[d].get(v) = the highest-bottleneck d-hop route found from the start to v.
export function chainsFrom(g, startId, opts = {}) {
  const s = g.idx.get(startId); if (s === undefined) return [];
  const dir = opts.dir === 'up' ? 'up' : 'down', maxDepth = Math.min(6, opts.maxDepth || 4), minDepth = Math.max(1, opts.minDepth || 2), k = Math.min(40, opts.k || 12);
  const keep = opts.keepStates || 2500;
  const typeOk = opts.edgeTypes ? (e) => opts.edgeTypes.includes(e.t) : () => true;
  const allowEdge = opts.reportedOnly ? (e) => typeOk(e) && !edgeValue(g, e).est : typeOk; // reportedOnly: every hop must carry a source-reported dollar figure
  const endOk = opts.endFilter || (() => true);
  const skip = opts.skipNodes || new Set();
  const midOk = opts.midFilter || (() => true);
  let layer = new Map([[s, { v: Infinity, prev: null, e: null, d: 0 }]]);
  const candidates = [];
  const onPath = (st, x) => { for (let c = st; c; c = c.prev) if (c.node === x) return true; return false; };
  layer.get(s).node = s;
  for (let d = 1; d <= maxDepth; d++) {
    const next = new Map();
    for (const [u, st] of layer) {
      if (st.term) continue; // a node that may end a chain but not sit in the middle of one
      const list = dir === 'down' ? g.nodes[u].out : g.nodes[u].in;
      for (const e of list) {
        if (!allowEdge(e)) continue;
        const x = dir === 'down' ? e.di : e.si;
        if (x === s || skip.has(x) || onPath(st, x)) continue;
        const v = Math.min(st.v, val(g, e));
        const cur = next.get(x);
        if (!cur || v > cur.v) next.set(x, { v, prev: st, e, d, node: x, term: !midOk(g.nodes[x]) });
      }
    }
    // keep only the strongest frontier states so dense hubs don't blow up the search
    layer = new Map([...next.entries()].sort((a, b) => b[1].v - a[1].v).slice(0, keep));
    if (d >= minDepth) for (const st of layer.values()) if (endOk(g.nodes[st.node])) candidates.push(st);
  }
  candidates.sort((a, b) => b.v - a.v || a.d - b.d);
  const picked = [], usedEnds = new Set();
  for (const st of candidates) {
    if (picked.length >= k) break;
    if (usedEnds.has(st.node)) continue;
    const idxs = [], hops = [];
    for (let c = st; c; c = c.prev) { idxs.unshift(c.node); if (c.e) hops.unshift(c.e); }
    // diversity: skip a chain that mostly retraces one already picked
    const set = new Set(idxs);
    if (picked.some(p => { let shared = 0; for (const i of p.idxs) if (set.has(i)) shared++; return shared / Math.max(p.idxs.length, idxs.length) > 0.75; })) continue;
    if (opts.requireReported && !hops.some(e => !edgeValue(g, e).est)) continue;
    if (opts.mustHaveType && !hops.some(e => e.t === opts.mustHaveType)) continue;
    usedEnds.add(st.node);
    picked.push({ idxs, hops });
  }
  return picked.map(p => {
    // upstream searches were built end -> start; present them in power-flow order (controller first)
    if (dir === 'up') { p.idxs.reverse(); p.hops.reverse(); }
    return describeChain(g, p.idxs, p.hops);
  });
}

// ---------- discovery: k best chains between two centers (Yen's k-shortest paths) ----------
function cost(g, e) { const v = val(g, e); return 1 + Math.max(0.1, 13 - Math.log10(Math.max(v, 1))); }
function dijkstra(g, src, dst, directed, bannedEdges, bannedNodes, maxDepth) {
  const N = g.nodes.length, dist = new Float64Array(N).fill(Infinity), prev = new Array(N), depth = new Int32Array(N);
  const heap = [[0, src]]; dist[src] = 0;
  const push = (it) => { heap.push(it); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const done = new Uint8Array(N);
  while (heap.length) {
    const [d, u] = pop(); if (done[u]) continue; done[u] = 1; if (u === dst) break;
    if (depth[u] >= maxDepth) continue;
    const relax = (e, v) => { if (done[v] || bannedNodes.has(v) || bannedEdges.has(e)) return; const nd = d + cost(g, e); if (nd < dist[v]) { dist[v] = nd; prev[v] = { e, from: u }; depth[v] = depth[u] + 1; push([nd, v]); } };
    for (const e of g.nodes[u].out) relax(e, e.di);
    if (!directed) for (const e of g.nodes[u].in) relax(e, e.si);
  }
  if (dist[dst] === Infinity) return null;
  const idxs = [dst], hops = []; let c = dst;
  while (c !== src) { const p = prev[c]; hops.unshift(p.e); c = p.from; idxs.unshift(c); }
  return { idxs, hops, cost: dist[dst] };
}
export function chainsBetween(g, fromId, toId, opts = {}) {
  const a = g.idx.get(fromId), b = g.idx.get(toId); if (a === undefined || b === undefined || a === b) return [];
  const K = Math.min(12, opts.k || 8), directed = opts.directed !== false, maxDepth = Math.min(8, opts.maxDepth || 7);
  const first = dijkstra(g, a, b, directed, new Set(), new Set(), maxDepth); if (!first) return [];
  const A = [first], B = [];
  const pathCost = (hops) => hops.reduce((s, e) => s + cost(g, e), 0);
  for (let k = 1; k < K; k++) {
    const last = A[k - 1];
    for (let i = 0; i < last.idxs.length - 1; i++) {
      const spur = last.idxs[i], rootIdx = last.idxs.slice(0, i + 1), rootHops = last.hops.slice(0, i);
      const bannedEdges = new Set(), bannedNodes = new Set(rootIdx.slice(0, -1));
      for (const p of A) if (p.idxs.length > i && rootIdx.every((x, j) => p.idxs[j] === x)) bannedEdges.add(p.hops[i]);
      const sp = dijkstra(g, spur, b, directed, bannedEdges, bannedNodes, maxDepth - i);
      if (!sp) continue;
      const cand = { idxs: rootIdx.concat(sp.idxs.slice(1)), hops: rootHops.concat(sp.hops) };
      cand.cost = pathCost(cand.hops);
      const key = cand.idxs.join(',');
      if (!A.some(p => p.idxs.join(',') === key) && !B.some(p => p.idxs.join(',') === key)) B.push(cand);
    }
    if (!B.length) break;
    B.sort((x, y) => x.cost - y.cost);
    A.push(B.shift());
  }
  return A.map(p => describeChain(g, p.idxs, p.hops)).sort((x, y) => y.score.influence - x.score.influence);
}

// ---------- next-step suggestions for the chain builder ----------
export function nextSteps(g, id, dir, limit = 14, exclude = []) {
  const i = g.idx.get(id); if (i === undefined) return [];
  const ex = new Set(exclude);
  const list = dir === 'up' ? g.nodes[i].in : g.nodes[i].out;
  return list.map(e => {
    const o = g.nodes[dir === 'up' ? e.si : e.di]; const ev = edgeValue(g, e);
    return { id: o.id, name: o.name, c: o.c, s: o.s, ind: o.ind, p: o.p, t: e.t, verb: VERB[e.t], w: e.w, note: e.note || '', amount: e.amount ?? null, basis: e.basis ?? null, value: ev.v, est: ev.est, degree: o.out.length + o.in.length };
  }).filter(x => !ex.has(x.id)).sort((a, b) => (b.est ? b.value * EST_DISCOUNT : b.value) - (a.est ? a.value * EST_DISCOUNT : a.value)).slice(0, limit);
}

// ---------- ranked "top chains" across the whole map, by flow preset ----------
export const PRESETS = {
  'money-politics': { label: 'Money into politics', desc: 'Companies, donors and groups whose money reaches parties, PACs, candidates and Congress', dir: 'down', start: n => ['Business', 'Individuals & dynasties', 'Nonprofit', 'Entertainment & media'].includes(n.s), end: n => n.s === 'Politics' || n.b === 'Legislative', mid: n => n.s !== 'Government' && n.s !== 'Public', depth: 4, edgeTypes: ['F', 'D', 'K'], requireReported: true, reportedOnly: true, seed: n => n.out.some(e => e.amount > 0 && e.source === 'fec'), seeds: 400 },
  'federal-money': { label: 'Federal money out', desc: 'Appropriations to agencies to the contractors, states and universities that receive FY2025 awards', dir: 'down', start: n => ['congress', 'happrops', 'sapprops', 'budget', 'omb', 'potus'].includes(n.id), end: n => n.s !== 'Government' || n.b === 'State & local', mid: n => n.s === 'Government' && n.b !== 'State & local', depth: 3, edgeTypes: ['F', 'C'], requireReported: true, seeds: 6, perSeed: 14, perStart: 14 },
  'ownership': { label: 'Ownership webs', desc: 'Asset managers and holding companies down through what they own', dir: 'down', start: n => n.ind === 'Securities & investment', end: () => true, depth: 3, edgeTypes: ['C'] },
  'dark-money': { label: 'Dark money', desc: 'Chains that pass through a 501(c)(4) or other conduit whose own donors are undisclosed, then reach politics', dir: 'down', start: n => n.s !== 'Government' && n.s !== 'Public', end: n => n.s === 'Politics' || n.b === 'Legislative', mid: n => n.s !== 'Government' && n.s !== 'Public', depth: 4, edgeTypes: ['F', 'D', 'K'], mustHaveType: 'D', requireReported: true, reportedOnly: true, seed: n => n.out.some(e => e.t === 'D' && e.amount > 0), seeds: 200 },
  'control': { label: 'Chains of command', desc: 'Formal control from the top of government down', dir: 'down', start: n => n.t <= 1, end: () => true, depth: 4, edgeTypes: ['C'] },
};
export function topChains(g, presetKey, limit = 40) {
  const P = PRESETS[presetKey] || PRESETS['money-politics'];
  const seeds = g.nodes.filter(n => P.start(n) && (!P.seed || P.seed(n))).sort((a, b) => nodeSize(b) - nodeSize(a)).slice(0, P.seeds || 220);
  const seen = new Set(), all = [];
  for (const sd of seeds) {
    for (const ch of chainsFrom(g, sd.id, { dir: P.dir, maxDepth: P.depth, minDepth: 2, k: P.perSeed || 4, keepStates: 900, edgeTypes: P.edgeTypes, endFilter: P.end, midFilter: P.mid, requireReported: P.requireReported, mustHaveType: P.mustHaveType, reportedOnly: P.reportedOnly })) {
      if (seen.has(ch.key)) continue; seen.add(ch.key); all.push(ch);
    }
  }
  all.sort((a, b) => b.score.influence - a.score.influence);
  // diversity across the ranked list: at most 3 chains starting at the same center
  const perStart = {}, out = [];
  for (const ch of all) { const s = ch.nodes[0].id; if ((perStart[s] = (perStart[s] || 0) + 1) > (P.perStart || 3)) continue; out.push(ch); if (out.length >= limit) break; }
  return out;
}
