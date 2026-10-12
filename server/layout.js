/* Barnes-Hut force layout shared by the Node precompute step and the browser Web Worker.
 * Plain script (no modules) so it can be loaded with importScripts() in a worker and with
 * vm/require in Node. Exposes a single global: PowerLayout.
 *
 * run({ N, size, ax, ay, az, kx, ky, kz, es, ed, ew, x0, y0, z0, iters, spread, theta, onProgress })
 *   size   Float32Array(N)   node radius
 *   ax..az Float32Array(N)   anchor position per node
 *   kx..kz Float32Array(N)   anchor spring strength per axis
 *   es, ed Int32Array(E)     edge endpoints (indices), ew Float32Array(E) weight 1..5
 *   x0..z0 optional initial positions (otherwise start at anchors + jitter)
 * returns { x, y, z } Float32Arrays
 */
(function (root) {
  'use strict';

  // ---- octree in flat typed arrays --------------------------------------------------------
  // cell layout: child[c*8+k] = cell index or -1; body[c] = -1 empty, -2 internal, >=0 leaf body
  function Octree(capacity) {
    this.cap = capacity;
    this.child = new Int32Array(capacity * 8);
    this.body = new Int32Array(capacity);
    this.mass = new Float64Array(capacity);
    this.cx = new Float64Array(capacity); this.cy = new Float64Array(capacity); this.cz = new Float64Array(capacity);
    this.mx = new Float64Array(capacity); this.my = new Float64Array(capacity); this.mz = new Float64Array(capacity); // cell min corner
    this.half = new Float64Array(capacity);
    this.n = 0;
  }
  Octree.prototype.newCell = function (mx, my, mz, half) {
    if (this.n >= this.cap) this.grow();
    const c = this.n++;
    this.child.fill(-1, c * 8, c * 8 + 8);
    this.body[c] = -1; this.mass[c] = 0; this.cx[c] = 0; this.cy[c] = 0; this.cz[c] = 0;
    this.mx[c] = mx; this.my[c] = my; this.mz[c] = mz; this.half[c] = half;
    return c;
  };
  Octree.prototype.grow = function () {
    const cap = this.cap * 2; const g = (a, T) => { const b = new T(a.length / this.cap * cap); b.set(a); return b; };
    this.child = g(this.child, Int32Array); this.body = g(this.body, Int32Array); this.mass = g(this.mass, Float64Array);
    this.cx = g(this.cx, Float64Array); this.cy = g(this.cy, Float64Array); this.cz = g(this.cz, Float64Array);
    this.mx = g(this.mx, Float64Array); this.my = g(this.my, Float64Array); this.mz = g(this.mz, Float64Array); this.half = g(this.half, Float64Array);
    this.cap = cap;
  };
  Octree.prototype.build = function (px, py, pz, m, N) {
    this.n = 0;
    let minx = Infinity, miny = Infinity, minz = Infinity, maxx = -Infinity, maxy = -Infinity, maxz = -Infinity;
    for (let i = 0; i < N; i++) { const x = px[i], y = py[i], z = pz[i]; if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; if (z < minz) minz = z; if (z > maxz) maxz = z; }
    const side = Math.max(maxx - minx, maxy - miny, maxz - minz, 1) * 1.01 + 1;
    const root = this.newCell(minx - 0.5, miny - 0.5, minz - 0.5, side / 2);
    for (let i = 0; i < N; i++) this.insert(root, i, px[i], py[i], pz[i], m[i], 0);
    return root;
  };
  Octree.prototype.octant = function (c, x, y, z) {
    const h = this.half[c]; let k = 0;
    if (x >= this.mx[c] + h) k |= 1; if (y >= this.my[c] + h) k |= 2; if (z >= this.mz[c] + h) k |= 4;
    return k;
  };
  Octree.prototype.childCell = function (c, k) {
    let cc = this.child[c * 8 + k];
    if (cc < 0) {
      const h = this.half[c] / 2;
      cc = this.newCell(this.mx[c] + ((k & 1) ? h * 2 : 0), this.my[c] + ((k & 2) ? h * 2 : 0), this.mz[c] + ((k & 4) ? h * 2 : 0), h);
      this.child[c * 8 + k] = cc;
    }
    return cc;
  };
  Octree.prototype.insert = function (c, i, x, y, z, m, depth) {
    // accumulate mass / centre of mass on the way down
    const tm = this.mass[c] + m;
    this.cx[c] = (this.cx[c] * this.mass[c] + x * m) / tm; this.cy[c] = (this.cy[c] * this.mass[c] + y * m) / tm; this.cz[c] = (this.cz[c] * this.mass[c] + z * m) / tm;
    this.mass[c] = tm;
    if (this.body[c] === -1) { this.body[c] = i; return; }           // empty leaf -> take it
    if (depth > 40) { return; }                                        // degenerate (coincident points): keep as aggregate
    if (this.body[c] >= 0) {                                           // occupied leaf -> split
      const j = this.body[c]; this.body[c] = -2;
      const jc = this.childCell(c, this.octant(c, this._px[j], this._py[j], this._pz[j]));
      this.insertRaw(jc, j, this._px[j], this._py[j], this._pz[j], this._m[j], depth + 1);
    }
    const ic = this.childCell(c, this.octant(c, x, y, z));
    this.insert(ic, i, x, y, z, m, depth + 1);
  };
  Octree.prototype.insertRaw = function (c, i, x, y, z, m, depth) { // insert into a fresh cell (mass accumulate + recurse)
    this.insert(c, i, x, y, z, m, depth);
  };

  function run(o) {
    const N = o.N, E = o.es ? o.es.length : 0;
    const iters = o.iters || 250, theta = o.theta || 0.85, theta2 = theta * theta;
    const spread = o.spread || Math.sqrt(N / 350);
    const size = o.size;
    const px = new Float64Array(N), py = new Float64Array(N), pz = new Float64Array(N), vx = new Float64Array(N), vy = new Float64Array(N), vz = new Float64Array(N);
    const mass = new Float64Array(N);
    const jit = o.x0 ? 1.5 : 6;
    for (let i = 0; i < N; i++) {
      px[i] = (o.x0 ? o.x0[i] : o.ax[i]) + (Math.random() - 0.5) * jit;
      py[i] = (o.y0 ? o.y0[i] : o.ay[i]) + (Math.random() - 0.5) * jit;
      pz[i] = (o.z0 ? o.z0[i] : o.az[i]) + (Math.random() - 0.5) * jit;
      mass[i] = 0.6 + size[i] * 0.4;
    }
    // degree-normalised spring strength so hub nodes (SEC, exchanges) don't collapse the map
    const deg = new Int32Array(N);
    for (let e = 0; e < E; e++) { deg[o.es[e]]++; deg[o.ed[e]]++; }
    const REP = 900 * spread, K = 0.003, CUT2 = (90 * spread) * (90 * spread);
    const tree = new Octree(Math.max(64, N * 3));
    tree._px = px; tree._py = py; tree._pz = pz; tree._m = mass;
    const stack = new Int32Array(4096);
    for (let it = 0; it < iters; it++) {
      const alpha = 1 - it / iters, damp = 0.82;
      const root = tree.build(px, py, pz, mass, N);
      const child = tree.child, body = tree.body, cmass = tree.mass, cx = tree.cx, cy = tree.cy, cz = tree.cz, half = tree.half;
      for (let i = 0; i < N; i++) {
        const xi = px[i], yi = py[i], zi = pz[i], si = size[i]; let fx = 0, fy = 0, fz = 0;
        let sp = 0; stack[sp++] = root;
        while (sp > 0) {
          const c = stack[--sp]; const b = body[c];
          if (b === -1) continue;
          let dx = xi - cx[c], dy = yi - cy[c], dz = zi - cz[c]; let d2 = dx * dx + dy * dy + dz * dz;
          if (b >= 0) {                                   // leaf: exact pairwise
            if (b === i) continue;
            if (d2 > CUT2) continue;
            if (d2 < 0.04) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; dz = Math.random() - 0.5; d2 = 0.75; }
            const d = Math.sqrt(d2); const minD = (si + size[b]) * 2.4;
            let f = REP * alpha * mass[b] / d2; if (d < minD) f += (minD - d) * 2.0;
            f = Math.min(f, 7); const inv = f / d; fx += dx * inv; fy += dy * inv; fz += dz * inv;
          } else {                                        // internal cell
            const s = half[c] * 2;
            if (s * s < theta2 * d2) {                    // far enough: use aggregate
              if (d2 > CUT2) continue;
              const d = Math.sqrt(d2); let f = Math.min(REP * alpha * cmass[c] / d2, 7 * cmass[c]); const inv = f / d;
              fx += dx * inv; fy += dy * inv; fz += dz * inv;
            } else {
              const base = c * 8; for (let k = 0; k < 8; k++) { const cc = child[base + k]; if (cc >= 0) { if (sp < stack.length) stack[sp++] = cc; } }
            }
          }
        }
        vx[i] += fx; vy[i] += fy; vz[i] += fz;
      }
      for (let e = 0; e < E; e++) {
        const i = o.es[e], j = o.ed[e], w = o.ew[e];
        const dx = px[j] - px[i], dy = py[j] - py[i], dz = pz[j] - pz[i]; const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.01;
        const rest = size[i] + size[j] + 14 + (5 - w) * 3;
        const norm = 1 / Math.sqrt(Math.max(1, Math.min(deg[i], deg[j])));
        const f = K * (0.6 + 0.12 * w) * (d - rest) * alpha * norm; const inv = f / d;
        vx[i] += dx * inv; vy[i] += dy * inv; vz[i] += dz * inv; vx[j] -= dx * inv; vy[j] -= dy * inv; vz[j] -= dz * inv;
      }
      for (let i = 0; i < N; i++) {
        vx[i] += (o.ax[i] - px[i]) * o.kx[i]; vy[i] += (o.ay[i] - py[i]) * o.ky[i]; vz[i] += (o.az[i] - pz[i]) * o.kz[i];
        vx[i] *= damp; vy[i] *= damp; vz[i] *= damp;
        const sp2 = vx[i] * vx[i] + vy[i] * vy[i] + vz[i] * vz[i]; if (sp2 > 36) { const s = 6 / Math.sqrt(sp2); vx[i] *= s; vy[i] *= s; vz[i] *= s; }
        px[i] += vx[i]; py[i] += vy[i]; pz[i] += vz[i];
      }
      if (o.onProgress && (it % 10 === 0 || it === iters - 1)) o.onProgress(it + 1, iters);
    }
    return { x: Float32Array.from(px), y: Float32Array.from(py), z: Float32Array.from(pz) };
  }

  // ---- anchors: same geometry as the single-file map -------------------------------------------
  const CAT_ORDER = ['enforcement', 'economic', 'legal', 'political', 'environmental', 'cultural'];
  function angleOf(list, key) { const i = Math.max(0, list.indexOf(key)); return (i / list.length) * Math.PI * 2 - Math.PI / 2; }
  /* nodes: array of {c,s,b,t,p,outW,inW,net,deg}; mode: cat|sector|branch|hier|radial|depth; opts: {sectors, branches, metric, depth:{id->d}, maxD}
     returns { ax, ay, az, kx, ky, kz } typed arrays */
  function anchors(nodes, mode, opts) {
    const N = nodes.length, spread = opts.spread || Math.sqrt(N / 350);
    const ax = new Float32Array(N), ay = new Float32Array(N), az = new Float32Array(N), kx = new Float32Array(N), ky = new Float32Array(N), kz = new Float32Array(N);
    const ky0 = 0.02, kxz = 0.012;
    // Grouped layouts (cat/sector/branch) get a wider ring, taller tier stacking and a stiffer angular spring
    // than the legacy values so the six/several clusters read as distinctly separated globs of globs rather
    // than one blended ring — bumping radius widens the arc-length gap between adjacent clusters, and the
    // stiffer kxz keeps a cluster's own members from bleeding angularly into its neighbors.
    const groupKxz = 0.017, groupKy = 0.027;
    let lo = 0, hi = 1; const metric = opts.metric || 'p';
    if (mode === 'radial') { lo = Infinity; hi = -Infinity; for (const n of nodes) { const v = n[metric] || 0; if (v < lo) lo = v; if (v > hi) hi = v; } }
    for (let i = 0; i < N; i++) {
      const n = nodes[i]; let a, x, y, z, fx = kxz, fy = ky0, fz = kxz;
      if (mode === 'sector') { a = angleOf(opts.sectors, n.s); const r = 118 * spread; x = r * Math.cos(a); y = (2.4 - n.t) * 20 * spread; z = r * Math.sin(a); fx = groupKxz; fy = groupKy; fz = groupKxz; }
      else if (mode === 'branch') { a = angleOf(opts.branches, n.b); const r = 120 * spread; x = r * Math.cos(a); y = (2.4 - n.t) * 20 * spread; z = r * Math.sin(a); fx = groupKxz; fy = groupKy; fz = groupKxz; }
      else if (mode === 'hier') { a = angleOf(CAT_ORDER, n.c); x = 58 * spread * Math.cos(a); y = (2.4 - n.t) * 36 * spread; z = 58 * spread * Math.sin(a); fx = 0.012; fy = 0.35; fz = 0.012; }
      else if (mode === 'radial') { a = angleOf(CAT_ORDER, n.c) + (i % 7 - 3) * 0.11; const v = ((n[metric] || 0) - lo) / ((hi - lo) || 1); const r = (12 + (1 - v) * 110) * spread; const el = ((i * 0.61) % 1 - 0.5) * 0.9; x = r * Math.cos(a) * Math.cos(el); y = r * Math.sin(el) * 0.55; z = r * Math.sin(a) * Math.cos(el); fx = fy = fz = 0.09; }
      else if (mode === 'depth') { const dd = opts.depth[n.id]; const d = dd === undefined ? opts.maxD + 1 : dd; a = angleOf(CAT_ORDER, n.c); const r = d === 0 ? 0 : (20 + d * 18) * spread; x = r * Math.cos(a); y = (2 - d) * 26 * spread; z = r * Math.sin(a); fx = 0.02; fy = 0.35; fz = 0.02; }
      else { a = angleOf(CAT_ORDER, n.c); const r = 112 * spread; x = r * Math.cos(a); y = (2.4 - n.t) * 20 * spread; z = r * Math.sin(a); fx = groupKxz; fy = groupKy; fz = groupKxz; }
      ax[i] = x; ay[i] = y; az[i] = z; kx[i] = fx; ky[i] = fy; kz[i] = fz;
    }
    return { ax, ay, az, kx, ky, kz };
  }

  // ---- size: funding (USD) drives glob radius on a log scale; falls back to the editorial power score
  // (0-10) for the many nodes with no real dollar figure attached (Voters, the Constitution, individuals...).
  // Shared by the server (layout physics + initial render matrix) and the browser (rendering), so a node is
  // the same size everywhere. `funding` is annual USD, already x10-stretched for government where that applies
  // (see pipeline/budgets.mjs) — this function just turns a dollar figure into a screen-space radius.
  const FUNDING_FLOOR = 3e5, FUNDING_SCALE = 1.15, SIZE_MIN = 0.8, SIZE_MAX = 13;
  function fundingToSize(funding) {
    const f = Math.max(funding || 0, FUNDING_FLOOR);
    return Math.min(SIZE_MAX, Math.max(SIZE_MIN, SIZE_MIN + FUNDING_SCALE * Math.log10(f / FUNDING_FLOOR)));
  }
  function powerToSize(power) { return 1 + (power || 0) * 0.3; }
  function sizeOf(node) { return (node.funding != null && node.funding > 0) ? fundingToSize(node.funding) : powerToSize(node.p != null ? node.p : node.power); }

  root.PowerLayout = { run, anchors, sizeOf, fundingToSize, powerToSize, CAT_ORDER, Octree };
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this));
