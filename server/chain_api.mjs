// HTTP routes for power chains: curated findings, discovery, resolution, builder suggestions and saved chains.
// Saved chains live in their own SQLite file (USER_DB, default next to the map database) so that rebuilding and
// redeploying powermap.db never wipes what people have saved. Anyone may save (no accounts); each saved chain
// gets a random edit key returned once to its creator, and only that key can update or delete it.
import crypto from 'node:crypto';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { chainsFrom, chainsBetween, nextSteps, resolveChain, topChains, PRESETS, EST_DISCOUNT } from './chains.mjs';
import { FINDINGS, FINDINGS_ASOF } from './findings.mjs';

const MAX_CHAINS_PER_SET = 8, MAX_STEPS = 30, MAX_TITLE = 120, MAX_NOTES = 2000, MAX_SAVED = 20000;
const WRITES_PER_HOUR = 30;

export function createChainApi({ getGraph, getVersion, send, readBody, dbPath }) {
  const udb = new DatabaseSync(process.env.USER_DB || path.join(path.dirname(dbPath), 'userchains.db'));
  udb.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=4000;
    CREATE TABLE IF NOT EXISTS chains(id TEXT PRIMARY KEY, title TEXT NOT NULL, notes TEXT DEFAULT '', steps TEXT NOT NULL,
      created TEXT NOT NULL, updated TEXT NOT NULL, edit_hash TEXT NOT NULL, ip_hash TEXT, views INTEGER DEFAULT 0);`);
  const q = {
    insert: udb.prepare('INSERT INTO chains(id,title,notes,steps,created,updated,edit_hash,ip_hash) VALUES(?,?,?,?,?,?,?,?)'),
    get: udb.prepare('SELECT * FROM chains WHERE id=?'),
    update: udb.prepare('UPDATE chains SET title=?, notes=?, steps=?, updated=? WHERE id=?'),
    del: udb.prepare('DELETE FROM chains WHERE id=?'),
    view: udb.prepare('UPDATE chains SET views=views+1 WHERE id=?'),
    count: udb.prepare('SELECT COUNT(*) c FROM chains'),
  };
  const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
  const newId = (n) => { const a = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (const b of crypto.randomBytes(n)) s += a[b % a.length]; return s; };
  const writes = new Map(); // ip -> timestamps
  const clientIp = (req) => (process.env.TRUST_PROXY === '1' && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '?';
  function rateOk(req) {
    const ip = clientIp(req), now = Date.now();
    const list = (writes.get(ip) || []).filter(t => now - t < 3600e3);
    if (list.length >= WRITES_PER_HOUR) { writes.set(ip, list); return false; }
    list.push(now); writes.set(ip, list); return true;
  }
  const cache = new Map(); // version-scoped results for the expensive, parameter-free routes
  const memo = (key, fn) => { const k = getVersion() + ':' + key; if (!cache.has(k)) { if (cache.size > 200) cache.clear(); cache.set(k, fn()); } return cache.get(k); };

  // ---------- findings ----------
  function resolvedFindings() {
    return memo('findings', () => {
      const g = getGraph();
      const out = FINDINGS.map(f => {
        // biggest chains first: the 2D view keeps this order down each column, so 51-state findings read as a ranking
        const chains = f.chains.map(ids => resolveChain(g, ids)).filter(c => !c.error).sort((a, b) => b.score.influence - a.score.influence);
        const seen = new Set(); let reportedTotal = 0, hops = 0, reportedHops = 0;
        for (const c of chains) for (const h of c.hops) { const k = h.src + '>' + h.dst; if (seen.has(k)) continue; seen.add(k); hops++; if (!h.est) { reportedHops++; reportedTotal += h.amount; } }
        const influence = chains.length ? Math.max(...chains.map(c => c.score.influence)) : 0;
        return { id: f.id, theme: f.theme, title: f.title, summary: f.summary, chains, score: { influence, reportedTotal, hops, reportedHops } };
      }).filter(f => f.chains.length);
      out.sort((a, b) => b.score.influence - a.score.influence);
      out.forEach((f, i) => f.rank = i + 1);
      return { asof: FINDINGS_ASOF, estDiscount: EST_DISCOUNT, findings: out };
    });
  }

  // ---------- validation for saved chain sets ----------
  function normalizeSet(body) {
    let sets = body.chains ?? (body.ids ? [body.ids] : null);
    if (!Array.isArray(sets) || !sets.length) return { error: 'chains must be a non-empty array of center-id arrays' };
    if (!Array.isArray(sets[0])) sets = [sets];
    if (sets.length > MAX_CHAINS_PER_SET) return { error: `at most ${MAX_CHAINS_PER_SET} chains per saved set` };
    const g = getGraph();
    for (const ids of sets) {
      if (!Array.isArray(ids) || ids.length < 2 || ids.length > MAX_STEPS || !ids.every(x => typeof x === 'string' && x.length <= 80)) return { error: `each chain needs 2-${MAX_STEPS} center ids` };
      const r = resolveChain(g, ids); if (r.error) return { error: r.error };
    }
    const title = String(body.title || '').trim().slice(0, MAX_TITLE); if (!title) return { error: 'a title is required' };
    return { sets, title, notes: String(body.notes || '').slice(0, MAX_NOTES) };
  }
  function savedView(row) {
    const g = getGraph(); const sets = JSON.parse(row.steps);
    return { id: row.id, title: row.title, notes: row.notes, created: row.created, updated: row.updated, views: row.views, chains: sets.map(ids => resolveChain(g, ids)) };
  }
  const authed = (req, row) => { const key = String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''); return key && sha(key) === row.edit_hash; };
  const num = (v, d, lo, hi) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };

  // returns true when the route was handled
  return async function handle(req, res, url) {
    const p = url.pathname, sp = url.searchParams;
    if (!p.startsWith('/api/chains') && p !== '/api/findings') return false;
    const g = getGraph();
    if (p === '/api/findings') { send(req, res, 200, resolvedFindings()); return true; }
    if (p === '/api/chains/presets') { send(req, res, 200, Object.entries(PRESETS).map(([key, v]) => ({ key, label: v.label, desc: v.desc, reportedOnly: !!v.reportedOnly }))); return true; }
    if (p === '/api/chains/top') { const key = PRESETS[sp.get('preset')] ? sp.get('preset') : 'money-politics'; const limit = num(sp.get('limit'), 30, 1, 60); send(req, res, 200, memo('top:' + key + ':' + limit, () => ({ preset: key, chains: topChains(g, key, limit) }))); return true; }
    if (p.startsWith('/api/chains/from/')) {
      const id = decodeURIComponent(p.slice(17));
      const opts = { dir: sp.get('dir') === 'up' ? 'up' : 'down', maxDepth: num(sp.get('depth'), 4, 1, 6), k: num(sp.get('k'), 12, 1, 30), reportedOnly: sp.get('reported') === '1' };
      if (sp.get('types')) opts.edgeTypes = sp.get('types').split('').filter(t => 'CFRKEILD'.includes(t));
      const end = sp.get('end'); if (end) opts.endFilter = n => n.s === end;
      send(req, res, 200, { chains: chainsFrom(g, id, opts) }); return true;
    }
    if (p === '/api/chains/between') { send(req, res, 200, { chains: chainsBetween(g, sp.get('from'), sp.get('to'), { k: num(sp.get('k'), 8, 1, 12), directed: sp.get('directed') !== '0', maxDepth: num(sp.get('depth'), 7, 2, 8) }) }); return true; }
    if (p.startsWith('/api/chains/next/')) { const ex = (sp.get('exclude') || '').split(',').filter(Boolean); send(req, res, 200, { steps: nextSteps(g, decodeURIComponent(p.slice(17)), sp.get('dir') === 'up' ? 'up' : 'down', num(sp.get('limit'), 14, 1, 40), ex) }); return true; }
    if (p === '/api/chains/resolve') {
      const sets = (sp.get('chains') || sp.get('ids') || '').split(';').map(s => s.split(',').filter(Boolean)).filter(a => a.length);
      if (!sets.length || sets.length > MAX_CHAINS_PER_SET) { send(req, res, 400, { error: 'pass ids=a,b,c (or chains=a,b;c,d)' }); return true; }
      send(req, res, 200, { chains: sets.map(ids => resolveChain(g, ids.slice(0, MAX_STEPS))) }); return true;
    }
    // ----- saved chains -----
    if (p === '/api/chains' && req.method === 'POST') {
      if (!rateOk(req)) { send(req, res, 429, { error: `limit of ${WRITES_PER_HOUR} saves per hour reached` }); return true; }
      if (q.count.get().c >= MAX_SAVED) { send(req, res, 507, { error: 'saved-chain storage is full' }); return true; }
      let body; try { body = JSON.parse(await readBody(req, 64e3)); } catch { send(req, res, 400, { error: 'invalid JSON' }); return true; }
      const v = normalizeSet(body); if (v.error) { send(req, res, 400, { error: v.error }); return true; }
      const id = newId(10), editKey = newId(28), now = new Date().toISOString();
      q.insert.run(id, v.title, v.notes, JSON.stringify(v.sets), now, now, sha(editKey), sha(clientIp(req)));
      send(req, res, 201, { id, editKey, url: `/#chain=${id}` }); return true;
    }
    if (p.startsWith('/api/chains/saved/')) {
      const id = decodeURIComponent(p.slice(18)); const row = q.get.get(id);
      if (!row) { send(req, res, 404, { error: 'no saved chain with that id' }); return true; }
      if (req.method === 'GET') { q.view.run(id); send(req, res, 200, savedView(row)); return true; }
      if (!authed(req, row)) { send(req, res, 403, { error: 'this edit key does not match' }); return true; }
      if (req.method === 'DELETE') { q.del.run(id); send(req, res, 200, { deleted: id }); return true; }
      if (req.method === 'PUT') {
        if (!rateOk(req)) { send(req, res, 429, { error: 'rate limit reached' }); return true; }
        let body; try { body = JSON.parse(await readBody(req, 64e3)); } catch { send(req, res, 400, { error: 'invalid JSON' }); return true; }
        const v = normalizeSet({ title: body.title ?? row.title, notes: body.notes ?? row.notes, chains: body.chains ?? body.ids ?? JSON.parse(row.steps) });
        if (v.error) { send(req, res, 400, { error: v.error }); return true; }
        q.update.run(v.title, v.notes, JSON.stringify(v.sets), new Date().toISOString(), id);
        send(req, res, 200, savedView(q.get.get(id))); return true;
      }
    }
    send(req, res, 404, { error: 'unknown chain route' }); return true;
  };
}
