// American Power Map — database-backed API + static server. Node 24+, no dependencies (node:sqlite, http, zlib).
// env: PORT (8092), DB (data/powermap.db), ADMIN_TOKEN (required for POST /api/import), WEB (web/)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { DatabaseSync } from 'node:sqlite';
import { loadGraph, chainOfCommand, shortestPath, depthFrom, LAYOUTS } from './graph.mjs';
import { normName } from '../pipeline/names.mjs';
import { createChainApi } from './chain_api.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = +(process.env.PORT || 8092);
const DB_PATH = process.env.DB || path.join(__dirname, '..', 'data', 'powermap.db');
const WEB = process.env.WEB || path.join(__dirname, '..', 'web');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
const meta = Object.fromEntries(db.prepare('SELECT key,value FROM meta').all().map(r => [r.key, r.value]));
const CATS = JSON.parse(meta.categories), ETYPES = JSON.parse(meta.edgeTypes), HAS_FTS = meta.fts === '1';
let version = +(meta.version || 1);
let g = loadGraph(db);
const cache = new Map();                   // key -> {etag, body(Buffer), gz(Buffer), type}
function bump() { version++; db.prepare("INSERT OR REPLACE INTO meta(key,value) VALUES('version',?)").run(String(version)); g = loadGraph(db); cache.clear(); }

// ---------------- helpers ----------------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain' };
function send(req, res, status, body, type, extra = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  const headers = { 'Content-Type': type || 'application/json', 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*', ...extra };
  const ae = String(req.headers['accept-encoding'] || '');
  if (buf.length > 1024 && /gzip/.test(ae) && !extra['Content-Encoding']) { const gz = zlib.gzipSync(buf, { level: 6 }); headers['Content-Encoding'] = 'gzip'; headers['Content-Length'] = gz.length; res.writeHead(status, headers); res.end(gz); return; }
  headers['Content-Length'] = buf.length; res.writeHead(status, headers); res.end(buf);
}
function cached(req, res, key, type, build) {
  let c = cache.get(key);
  if (!c) { const body = build(); const buf = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)); c = { etag: `"${version}-${key.length}-${buf.length}"`, buf, gz: buf.length > 1024 ? zlib.gzipSync(buf, { level: 6 }) : null, type }; cache.set(key, c); }
  if (req.headers['if-none-match'] === c.etag) { res.writeHead(304, { ETag: c.etag }); res.end(); return; }
  const headers = { 'Content-Type': c.type, ETag: c.etag, 'Cache-Control': 'public, max-age=60', 'Access-Control-Allow-Origin': '*' };
  if (c.gz && /gzip/.test(String(req.headers['accept-encoding'] || ''))) { headers['Content-Encoding'] = 'gzip'; headers['Content-Length'] = c.gz.length; res.writeHead(200, headers); res.end(c.gz); }
  else { headers['Content-Length'] = c.buf.length; res.writeHead(200, headers); res.end(c.buf); }
}
function readBody(req, limit = 50e6) { return new Promise((resolve, reject) => { const chunks = []; let n = 0; req.on('data', c => { n += c.length; if (n > limit) { reject(new Error('body too large')); req.destroy(); } chunks.push(c); }); req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8'))); req.on('error', reject); }); }
const nodeFull = db.prepare('SELECT * FROM nodes WHERE id=?');
const chainApi = createChainApi({ getGraph: () => g, getVersion: () => version, send: (...a) => send(...a), readBody: (...a) => readBody(...a), dbPath: DB_PATH });
const edgesOf = db.prepare('SELECT e.id, e.src, e.dst, e.type t, e.weight w, e.note, e.source, e.amount, e.amount_basis basis FROM edges e WHERE e.src=? OR e.dst=? ORDER BY e.weight DESC');

// ---------------- API ----------------
function apiMeta() {
  const counts = db.prepare("SELECT (SELECT COUNT(*) FROM nodes) nodes, (SELECT COUNT(*) FROM edges) edges").get();
  const industries = db.prepare('SELECT industry k, COUNT(*) c FROM nodes GROUP BY industry ORDER BY industry').all();
  const sources = db.prepare('SELECT * FROM sources').all();
  return { generated: meta.generated, version, categories: CATS, edgeTypes: ETYPES, counts, industries, sectors: g.sectors, branches: g.branches, layouts: LAYOUTS, sources, f13Period: meta.f13_period, curatedGenerated: meta.curated_generated, importEnabled: !!ADMIN_TOKEN };
}
function apiNodes() {
  const n = g.nodes; const o = { id: [], name: [], c: [], s: [], b: [], ind: [], p: [], t: [], deg: [], outW: [], inW: [], dark: [], src: [], funding: [] };
  for (const x of n) { o.id.push(x.id); o.name.push(x.name); o.c.push(x.c); o.s.push(x.s); o.b.push(x.b); o.ind.push(x.ind); o.p.push(x.p); o.t.push(x.t); o.deg.push(x.deg); o.outW.push(x.outW); o.inW.push(x.inW); o.dark.push(x.dark ? 1 : 0); o.src.push(x.src); o.funding.push(x.funding ?? null); }
  return o;
}
function apiEdges(minW) {
  const o = { s: [], d: [], t: [], w: [] };
  for (const e of g.edges) if (e.w >= minW) { o.s.push(e.si); o.d.push(e.di); o.t.push(e.t); o.w.push(e.w); }
  return o;
}
const NODE_EDGE_CAP = 150; // a hub like the SEC or IRS can have thousands of routine same-type edges; the detail
// panel shows the strongest NODE_EDGE_CAP per direction (edgesOf is already ORDER BY weight DESC) plus the true
// total, rather than trying to render every row — the ambient 3D view summarizes the rest as a connection bundle.
function apiNode(id) {
  const row = nodeFull.get(id); if (!row) return null;
  const gi = g.idx.get(id); const gn = g.nodes[gi];
  const other = (oid) => { const x = g.nodes[g.idx.get(oid)]; return x ? { id: x.id, name: x.name, c: x.c, p: x.p, ind: x.ind, i: x.i } : null; };
  const all = edgesOf.all(id, id).map(e => ({ ...e, si: g.idx.get(e.src), di: g.idx.get(e.dst), other: other(e.src === id ? e.dst : e.src), dir: e.src === id ? 'out' : 'in' })).filter(e => e.other);
  const inAll = all.filter(e => e.dir === 'in'), outAll = all.filter(e => e.dir === 'out');
  const edges = inAll.slice(0, NODE_EDGE_CAP).concat(outAll.slice(0, NODE_EDGE_CAP));
  return { node: { ...row, i: gi, net: row.out_w - row.in_w }, edges, inTotal: inAll.length, outTotal: outAll.length, chain: chainOfCommand(g, gn).map(x => ({ id: x.id, name: x.name })) };
}
function apiSearch(q) {
  q = String(q || '').trim().slice(0, 80); if (!q) return [];
  const seen = new Set(); const out = [];
  const push = (r) => { if (seen.has(r.id) || out.length >= 40) return; seen.add(r.id); out.push({ id: r.id, name: r.name, c: r.category, ind: r.industry, p: r.power, i: g.idx.get(r.id) }); };
  // exact ticker / id first
  db.prepare('SELECT id,name,category,industry,power FROM nodes WHERE upper(ticker)=upper(?) OR id=? LIMIT 3').all(q, q).forEach(push);
  if (HAS_FTS) {
    const toks = q.replace(/[^\p{L}\p{N} ]+/gu, ' ').split(/\s+/).filter(Boolean).map(t => `"${t}"*`).join(' ');
    if (toks) try { db.prepare('SELECT n.id,n.name,n.category,n.industry,n.power FROM nodes_fts f JOIN nodes n ON n.id=f.id WHERE nodes_fts MATCH ? ORDER BY bm25(nodes_fts, 0, 10, 3, 1, 2, 5, 4), n.power DESC LIMIT 40').all(toks).forEach(push); } catch { /* bad query */ }
  }
  if (out.length < 10) db.prepare('SELECT id,name,category,industry,power FROM nodes WHERE name LIKE ? OR aliases LIKE ? ORDER BY power DESC LIMIT 40').all(`%${q}%`, `%${q}%`).forEach(push);
  return out;
}

// ---- layouts: cached in DB, computed lazily in a worker ----
const layoutJobs = new Map();
function positionsFromDb(layout) {
  const rows = db.prepare('SELECT node_id, x, y, z FROM positions WHERE layout=?').all(layout);
  if (!rows.length) return null;
  const N = g.nodes.length; const out = new Float32Array(N * 3); let have = 0;
  const seen = new Uint8Array(N);
  for (const r of rows) { const i = g.idx.get(r.node_id); if (i === undefined) continue; out[i * 3] = r.x; out[i * 3 + 1] = r.y; out[i * 3 + 2] = r.z; seen[i] = 1; have++; }
  if (have < N * 0.9) return null;                                  // too stale -> recompute
  if (have < N) {                                                   // a few new nodes (imports): drop them near their category anchor
    const [mode, metric] = layout.split(':'); const a = globalThis.PowerLayout.anchors(g.nodes, mode, { sectors: g.sectors, branches: g.branches, metric: metric || 'p' });
    for (let i = 0; i < N; i++) if (!seen[i]) { out[i * 3] = a.ax[i] + (Math.random() - 0.5) * 10; out[i * 3 + 1] = a.ay[i] + (Math.random() - 0.5) * 10; out[i * 3 + 2] = a.az[i] + (Math.random() - 0.5) * 10; }
  }
  return out;
}
function computeLayoutAsync(layout) {
  if (layoutJobs.has(layout)) return layoutJobs.get(layout);
  const p = new Promise((resolve, reject) => {
    const w = new Worker(path.join(__dirname, 'layoutworker.mjs'), { workerData: { db: DB_PATH, layout } });
    w.on('message', m => { if (m.done) resolve(m.positions); });
    w.on('error', reject); w.on('exit', c => { layoutJobs.delete(layout); if (c !== 0) reject(new Error('layout worker exited ' + c)); });
  });
  layoutJobs.set(layout, p); return p;
}

// ---- import (admin) ----
const NAME_STOP = /\b(inc|corp|corporation|co|company|llc|lp|ltd|plc|the|of|and|&|pac|committee|for|association|assn|group|holdings|fund|foundation)\b/g;
function looseName(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(NAME_STOP, ' ').replace(/\s+/g, ' ').trim(); }
function findNode(name) {
  if (!name) return null; if (g.idx.has(name)) return name;
  const q = looseName(name); if (!q) return null;
  const nn = normName(name);
  const exact = db.prepare('SELECT id FROM nodes WHERE lower(name)=lower(?) OR aliases LIKE ? LIMIT 1').get(name, `%|${name}|%`); if (exact) return exact.id;
  let best = null, bestScore = 0; const qt = q.split(' ').filter(x => x.length > 2);
  for (const n of g.nodes) {
    const ln = n._ln || (n._ln = looseName(n.name)); if (ln === q) return n.id;
    if (n._nn === undefined) n._nn = normName(n.name); if (nn && n._nn === nn) return n.id;
    const nt = n._nt || (n._nt = ln.split(' ').filter(x => x.length > 2));
    if (qt.length >= 2 && qt.every(x => nt.includes(x)) && nt.length <= qt.length + 2) { const sc = 10 + qt.length; if (sc > bestScore) { best = n.id; bestScore = sc; } continue; }
    if (q.length >= 5 && (ln.includes(q) || (ln.length >= 6 && q.includes(ln)))) { const sc = Math.min(ln.length, q.length); if (sc > bestScore) { best = n.id; bestScore = sc; } }
  }
  return best;
}
function importPayload(payload, label) {
  const added = { nodes: 0, edges: 0, skipped: 0 }; const TYPEKEY = {};
  Object.keys(ETYPES).forEach(k => { TYPEKEY[k] = k; TYPEKEY[ETYPES[k].key] = k; TYPEKEY[ETYPES[k].label.toLowerCase()] = k; });
  const insN = db.prepare('INSERT INTO nodes(id,name,category,sector,branch,industry,dm,power,tier,description,source) VALUES(?,?,?,?,?,?,?,?,?,?,?)');
  const insE = db.prepare('INSERT OR IGNORE INTO edges(src,dst,type,weight,note,source,amount) VALUES(?,?,?,?,?,?,?)');
  const newIds = new Map();
  db.exec('BEGIN');
  try {
    for (const r of payload.nodes || []) {
      const name = r.name || r.n; if (!name) continue;
      let id = r.id; if (!id || g.idx.has(id) || newIds.has(id)) { const ex = findNode(name); if (ex) { newIds.set(name, ex); added.skipped++; continue; } id = 'x_' + looseName(name).replace(/ /g, '_').slice(0, 40) + '_' + Math.random().toString(36).slice(2, 6); }
      const c = CATS[r.category || r.c] ? (r.category || r.c) : 'economic'; let s = r.sector || r.s || 'Business', b = r.branch || r.b || 'Private';
      if (!g.sectors.includes(s)) s = 'Business'; if (!g.branches.includes(b)) b = 'Private';
      insN.run(id, String(name).slice(0, 90), c, s, b, r.industry || r.ind || 'Imported', r.dm || r.decisionMakers || '', Math.max(0, Math.min(10, +(r.power ?? r.p ?? 3))), Math.max(0, Math.min(5, +(r.tier ?? r.t ?? 4))), r.description || r.d || ('Imported from ' + label), 'import:' + label);
      newIds.set(name, id); newIds.set(id, id); added.nodes++;
    }
    const resolve = (v) => v ? (newIds.get(v) || (g.idx.has(v) ? v : null) || findNode(v)) : null;
    for (const r of payload.edges || []) {
      const s = resolve(r.from) || resolve(r.from_name), d = resolve(r.to) || resolve(r.to_name); if (!s || !d || s === d) { added.skipped++; continue; }
      const t = TYPEKEY[String(r.type || 'I')] || TYPEKEY[String(r.type || '').toLowerCase()] || 'I'; const w = Math.max(1, Math.min(5, Math.round(+(r.weight || 2))));
      const res = insE.run(s, d, t, w, String(r.note || '').slice(0, 200), 'import:' + label, r.amount ? +r.amount : null); if (res.changes) added.edges++; else added.skipped++;
    }
    db.exec(`UPDATE nodes SET out_w=(SELECT COALESCE(SUM(weight),0) FROM edges WHERE src=nodes.id), in_w=(SELECT COALESCE(SUM(weight),0) FROM edges WHERE dst=nodes.id), deg=(SELECT COUNT(*) FROM edges WHERE src=nodes.id OR dst=nodes.id), has_dark=(SELECT COUNT(*)>0 FROM edges WHERE type='D' AND (src=nodes.id OR dst=nodes.id))`);
    if (HAS_FTS) db.exec(`INSERT INTO nodes_fts(id,name,dm,description,industry,ticker,aliases) SELECT id,name,dm,description,industry,COALESCE(ticker,''),COALESCE(aliases,'') FROM nodes WHERE id NOT IN (SELECT id FROM nodes_fts)`);
    db.prepare("INSERT INTO sources(key,label,url,asof,nodes,edges) VALUES(?,?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET nodes=nodes+excluded.nodes, edges=edges+excluded.edges, asof=excluded.asof").run('import:' + label, label, '', new Date().toISOString().slice(0, 10), added.nodes, added.edges);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  if (added.nodes || added.edges) bump();
  return added;
}

// ---------------- server ----------------
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x'); const p = url.pathname;
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE' }); res.end(); return; }
    if (await chainApi(req, res, url)) return;
    if (p === '/api/meta') return cached(req, res, 'meta', 'application/json', apiMeta);
    if (p === '/api/nodes') return cached(req, res, 'nodes', 'application/json', apiNodes);
    if (p === '/api/edges') { const min = Math.max(1, Math.min(5, +(url.searchParams.get('min') || 3))); return cached(req, res, 'edges:' + min, 'application/json', () => apiEdges(min)); }
    if (p.startsWith('/api/node/')) { const r = apiNode(decodeURIComponent(p.slice(10))); return r ? send(req, res, 200, r) : send(req, res, 404, { error: 'not found' }); }
    if (p === '/api/search') return send(req, res, 200, apiSearch(url.searchParams.get('q')));
    if (p === '/api/path') { const r = shortestPath(g, url.searchParams.get('from'), url.searchParams.get('to'), url.searchParams.get('directed') !== '0'); return send(req, res, r ? 200 : 404, r || { error: 'unknown node' }); }
    if (p.startsWith('/api/depth/')) { const r = depthFrom(g, decodeURIComponent(p.slice(11)), url.searchParams.get('dir') || 'any'); if (!r) return send(req, res, 404, { error: 'unknown node' }); return send(req, res, 200, Buffer.from(r.depth.buffer), 'application/octet-stream', { 'X-Max-Depth': String(r.maxD) }); }
    if (p.startsWith('/api/positions/')) {
      const layout = decodeURIComponent(p.slice(15)); if (!LAYOUTS.includes(layout)) return send(req, res, 400, { error: 'unknown layout' });
      let pos = positionsFromDb(layout);
      if (!pos) { pos = await computeLayoutAsync(layout); }
      const buf = Buffer.from(pos.buffer, pos.byteOffset, pos.byteLength);
      return send(req, res, 200, buf, 'application/octet-stream', { 'X-Version': String(version) });
    }
    if (p === '/api/export.json') { const nodes = db.prepare('SELECT * FROM nodes').all(); const edges = db.prepare('SELECT src "from",dst "to",type,weight,note,source,amount FROM edges').all(); return send(req, res, 200, { generated: meta.generated, categories: CATS, edgeTypes: ETYPES, nodes, edges }, 'application/json', { 'Content-Disposition': 'attachment; filename="us-power-map.json"' }); }
    if (p === '/api/export.csv') { const q = s => '"' + String(s ?? '').replace(/"/g, '""') + '"'; const rows = db.prepare('SELECT e.src,a.name an,e.dst,b.name bn,e.type,e.weight,e.note,e.source FROM edges e JOIN nodes a ON a.id=e.src JOIN nodes b ON b.id=e.dst').all(); const csv = ['from,from_name,to,to_name,type,weight,note,source', ...rows.map(r => [r.src, q(r.an), r.dst, q(r.bn), ETYPES[r.type].key, r.weight, q(r.note), r.source].join(','))].join('\n'); return send(req, res, 200, csv, 'text/csv', { 'Content-Disposition': 'attachment; filename="us-power-map-edges.csv"' }); }
    if (p === '/api/import' && req.method === 'POST') {
      const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (!ADMIN_TOKEN || auth !== ADMIN_TOKEN) return send(req, res, 401, { error: ADMIN_TOKEN ? 'bad token' : 'imports disabled (ADMIN_TOKEN not set)' });
      const body = JSON.parse(await readBody(req)); const added = importPayload(body.payload || body, String(body.label || 'import').slice(0, 60));
      return send(req, res, 200, added);
    }
    if (p === '/api/health') return send(req, res, 200, { ok: true, nodes: g.nodes.length, edges: g.edges.length, version });
    // static
    let f = p === '/' ? '/index.html' : p; if (f === '/layout.js') { return sendFile(req, res, path.join(__dirname, 'layout.js')); }
    f = path.normalize(f).replace(/^(\.\.[/\\])+/, ''); const fp = path.join(WEB, f);
    if (!fp.startsWith(WEB) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) return send(req, res, 404, 'Not found', 'text/plain');
    return sendFile(req, res, fp);
  } catch (e) { console.error(e); send(req, res, 500, { error: String(e.message || e) }); }
});
function sendFile(req, res, fp) { const ext = path.extname(fp); send(req, res, 200, fs.readFileSync(fp), MIME[ext] || 'application/octet-stream'); }
server.listen(PORT, () => console.log(`power-map listening on :${PORT} · ${g.nodes.length} nodes · ${g.edges.length} edges · db ${DB_PATH}${ADMIN_TOKEN ? '' : ' · imports disabled'}`));
