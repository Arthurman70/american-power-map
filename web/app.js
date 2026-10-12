/* American Power Map — database edition. Loads centers from the API, draws them as instanced blobs,
   fetches arrows lazily (backbone first, the rest on selection) and uses precomputed Barnes-Hut layouts. */
'use strict';
const CAT_ORDER = ['enforcement', 'economic', 'legal', 'political', 'environmental', 'cultural'];
let META = null, CATS = null, ETYPES = null, SECTORS = [], BRANCHES = [], SPREAD = 1;
const NODES = [], byId = {}, EDGES = [], edgeKey = new Map();
const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = id => document.getElementById(id);
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
async function getJSON(url, opts) { const r = await fetch(url, Object.assign({ mode: 'cors' }, opts || {})); if (!r.ok) throw new Error(r.status + ' ' + r.statusText); return r.json(); }
const money = v => v === null || v === undefined ? '' : (Math.abs(v) >= 1e12 ? (v / 1e12).toFixed(2) + 'T' : Math.abs(v) >= 1e9 ? (v / 1e9).toFixed(1) + 'B' : Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(0) + 'M' : (v / 1e3).toFixed(0) + 'K');

function loadHiddenIds() { try { return new Set(JSON.parse(localStorage.getItem('pm_hidden_ids') || '[]')); } catch { return new Set(); } }
function saveHiddenIds() { try { localStorage.setItem('pm_hidden_ids', JSON.stringify([...state.hiddenIds])); } catch { } }

const state = {
  layout: 'cat', radialMetric: 'p', depthDir: 'any',
  cats: new Set(CAT_ORDER), sectors: new Set(), branches: new Set(), etypes: new Set(),
  minW: 4, minSize: 0, labelMin: 7, search: '', searchSet: null, focus: false,
  selected: null, hovered: null, pathA: null, pathB: null, path: null, pathDirected: true,
  sort: 'p', group: '', highlight: null, hlMode: 'highlight', hlLabel: '', darkOnly: false, detail: null,
  edgesOn: true, bundlesOn: true, hiddenIds: loadHiddenIds(),
};

// ===================== GRAPH =====================
function addEdge(s, d, t, w, note) {
  const k = s.idx + '>' + d.idx; let e = edgeKey.get(k);
  if (e) { if (note && !e.note) e.note = note; return e; }
  e = { i: EDGES.length, s, d, t, w, note: note || '', offset: 0, vis: true, dim: false, hl: false };
  EDGES.push(e); edgeKey.set(k, e); s.out.push(e); d.in.push(e);
  const r = edgeKey.get(d.idx + '>' + s.idx); if (r) { e.offset = s.idx < d.idx ? 1 : -1; r.offset = -e.offset; }
  return e;
}
function neighborSet(n) { const s = new Set([n]); n.out.forEach(e => s.add(e.d)); n.in.forEach(e => s.add(e.s)); return s; }

// ===================== THREE =====================
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, 1, 0.5, 12000);
scene.add(new THREE.AmbientLight(0xffffff, 0.55));
scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x2a1d10, 0.5));
const key = new THREE.DirectionalLight(0xffffff, 0.85); key.position.set(40, 70, 30); scene.add(key);
const fill = new THREE.DirectionalLight(0x88a0ff, 0.35); fill.position.set(-50, -20, -40); scene.add(fill);

function blobGeometry(seed, detail) {
  const g = new THREE.SphereGeometry(1, detail, Math.round(detail * 0.8)); const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const r = 1 + 0.17 * Math.sin(3.1 * x + seed) * Math.cos(2.6 * y + seed * 0.7) + 0.11 * Math.sin(4.2 * z + seed * 1.9) * Math.cos(2.2 * x - seed) + 0.07 * Math.sin(5.5 * y + seed * 0.4) * Math.sin(3.3 * z + seed * 2.3);
    pos.setXYZ(i, x * r, y * r, z * r);
  }
  g.computeVertexNormals(); return g;
}
// one material, per-instance colour; emissive follows the instance colour via a tiny shader patch
const nodeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.08 });
nodeMat.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_INSTANCING_COLOR\n totalEmissiveRadiance += vColor * 0.24;\n#endif'); };
const BUCKETS = 5; const buckets = []; // {mesh, nodes:[], cap}
const _dummy = new THREE.Object3D(), _col = new THREE.Color(), _white = new THREE.Color(0xffffff);
function buildNodeMeshes() {
  buckets.forEach(b => { scene.remove(b.mesh); b.mesh.dispose(); }); buckets.length = 0;
  for (let k = 0; k < BUCKETS; k++) {
    const nodes = NODES.filter(n => n.idx % BUCKETS === k); const cap = Math.max(16, Math.ceil(nodes.length * 1.25));
    const mesh = new THREE.InstancedMesh(blobGeometry(k * 1.37 + 0.5, 18), nodeMat, cap); mesh.count = nodes.length; mesh.frustumCulled = false; mesh.userData.bucket = k;
    nodes.forEach((n, j) => { n.bk = k; n.bi = j; mesh.setColorAt(j, n.color); });
    mesh.instanceColor.needsUpdate = true; scene.add(mesh); buckets.push({ mesh, nodes, cap });
  }
  writeAllNodeMatrices();
}
function writeNodeMatrix(n) {
  const b = buckets[n.bk]; if (!n.vis) { _dummy.scale.setScalar(0); } else { _dummy.scale.setScalar(n.size); }
  _dummy.position.copy(n.pos); _dummy.rotation.set(n.idx * 0.7, n.idx * 1.3 + n.spin, 0); _dummy.updateMatrix(); b.mesh.setMatrixAt(n.bi, _dummy.matrix);
}
function writeAllNodeMatrices() { for (const n of NODES) writeNodeMatrix(n); buckets.forEach(b => b.mesh.instanceMatrix.needsUpdate = true); }
function writeNodeColor(n) {
  _col.copy(n.color);
  if (n.glow > 0) _col.lerp(_white, n.glow); else if (n.dim) _col.multiplyScalar(0.18);
  buckets[n.bk].mesh.setColorAt(n.bi, _col);
}
function flushNodeColors() { buckets.forEach(b => { if (b.mesh.instanceColor) b.mesh.instanceColor.needsUpdate = true; }); }

// --- labels: created lazily, capped ---
let labelCount = 0;
function makeLabel(n) {
  const c = document.createElement('canvas'), ctx = c.getContext('2d');
  const font = '600 34px "Avenir Next","Segoe UI",system-ui,sans-serif'; ctx.font = font;
  const text = n.n.length > 60 ? n.n.slice(0, 58) + '…' : n.n; const w = Math.ceil(ctx.measureText(text).width);
  c.width = w + 44; c.height = 56; ctx.font = font; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(16,21,29,0.82)'; const r = 12; ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(c.width - r, 0); ctx.quadraticCurveTo(c.width, 0, c.width, r); ctx.lineTo(c.width, c.height - r); ctx.quadraticCurveTo(c.width, c.height, c.width - r, c.height); ctx.lineTo(r, c.height); ctx.quadraticCurveTo(0, c.height, 0, c.height - r); ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0); ctx.fill();
  ctx.fillStyle = CATS[n.c].hex; ctx.fillRect(0, 0, 6, c.height); ctx.fillStyle = '#eef2f8'; ctx.fillText(text, 22, c.height / 2 + 1);
  const tex = new THREE.CanvasTexture(c); tex.minFilter = THREE.LinearFilter;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); sp.userData.w = c.width; sp.userData.h = c.height; sp.renderOrder = 10; sp.visible = false;
  scene.add(sp); labelCount++; return sp;
}
function showLabel(n, on) {
  if (on) { if (!n.label) n.label = makeLabel(n); n.label.visible = true; n.label.position.set(n.pos.x, n.pos.y + n.size * 1.3 + 1.4, n.pos.z); }
  else if (n.label) n.label.visible = false;
}
function pruneLabels() { if (labelCount < 900) return; for (const n of NODES) if (n.label && !n.label.visible) { scene.remove(n.label); n.label.material.map.dispose(); n.label.material.dispose(); n.label = null; labelCount--; } }

// --- arrows (instanced) ---
const shaftGeo = new THREE.CylinderGeometry(1, 1, 1, 7, 1, true); shaftGeo.translate(0, 0.5, 0);
const headGeo = new THREE.ConeGeometry(1, 1, 9); headGeo.translate(0, 0.5, 0);
const shaftMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false });
const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false });
let shafts = null, heads = null, arrowCap = 0;
function ensureArrows() {
  if (shafts && EDGES.length <= arrowCap) return;
  if (shafts) { scene.remove(shafts); scene.remove(heads); shafts.dispose(); heads.dispose(); }
  arrowCap = Math.max(1024, Math.ceil(EDGES.length * 1.4));
  shafts = new THREE.InstancedMesh(shaftGeo, shaftMat, arrowCap); heads = new THREE.InstancedMesh(headGeo, headMat, arrowCap);
  shafts.frustumCulled = false; heads.frustumCulled = false; scene.add(shafts); scene.add(heads);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = EDGES.length; i < arrowCap; i++) { shafts.setMatrixAt(i, zero); heads.setMatrixAt(i, zero); }
  EDGES.forEach(colorEdge); refreshEdges(); shafts.instanceColor.needsUpdate = true; heads.instanceColor.needsUpdate = true;
}
const ECOL = {};
const UP = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _m = new THREE.Matrix4(), _off = new THREE.Vector3(), _tmp = new THREE.Vector3(), _zero = new THREE.Matrix4().makeScale(0, 0, 0), _c = new THREE.Color(), _x = new THREE.Vector3(1, 0, 0);
function writeEdge(e) {
  if (!e.vis) { shafts.setMatrixAt(e.i, _zero); heads.setMatrixAt(e.i, _zero); return; }
  const a = e.s.pos, b = e.d.pos; _d.subVectors(b, a); const len = _d.length(); if (len < 0.01) { shafts.setMatrixAt(e.i, _zero); heads.setMatrixAt(e.i, _zero); return; }
  _d.divideScalar(len); _off.set(0, 0, 0);
  if (e.offset) { _tmp.crossVectors(_d, Math.abs(_d.y) > 0.9 ? _x : UP).normalize(); _off.copy(_tmp).multiplyScalar(0.6 * e.offset); }
  const ra = e.s.size * 0.95, rb = e.d.size * 0.95; const headLen = Math.min(0.8 + 0.3 * e.w, len * 0.35); const shaft = Math.max(0.05, len - ra - rb - headLen);
  const r = 0.03 + 0.037 * e.w, hr = r * 2.8 + 0.08; _q.setFromUnitVectors(UP, _d);
  _p.copy(a).addScaledVector(_d, ra).add(_off); _s.set(r, shaft, r); _m.compose(_p, _q, _s); shafts.setMatrixAt(e.i, _m);
  _p.addScaledVector(_d, shaft); _s.set(hr, headLen, hr); _m.compose(_p, _q, _s); heads.setMatrixAt(e.i, _m);
}
function colorEdge(e) { _c.copy(ECOL[e.t] || _white); if (e.hl) _c.lerp(_white, 0.35); else if (e.dim) _c.multiplyScalar(0.22); shafts.setColorAt(e.i, _c); heads.setColorAt(e.i, _c); }
function refreshEdges() { for (const e of EDGES) writeEdge(e); shafts.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true; }
function refreshEdgeColors() { for (const e of EDGES) colorEdge(e); shafts.instanceColor.needsUpdate = true; heads.instanceColor.needsUpdate = true; }

// ===================== CONNECTION MEMBRANES =====================
// With tens of thousands of low-weight "routine" arrows (every SEC-registered company has a weight-2 "SEC
// regulates" edge, every BlackRock position under 2.5% is weight 1...) drawing each as its own line is a
// hairball. Instead, a hub with many same-type edges gets ONE soft translucent membrane — a tapering cone when
// its targets cluster in roughly one direction (e.g. PBS stations around npo_pbs), or a glowing halo when they
// fan out in every direction (e.g. the SEC's thousands of registrants) — like a bundle of nerve fibers meeting
// at a synapse. Individual arrows for a bundled edge only reappear when you select one of its two endpoints.
const BUNDLE_MAX_WEIGHT = 2, BUNDLE_MIN_COUNT = 14, BUNDLE_MAX_RENDERED = 240, BUNDLE_SAMPLE = 40, BUNDLE_HALO_ANGLE = 62 * Math.PI / 180;
let BUNDLES = [];
function computeBundles() {
  const outMap = new Map(), inMap = new Map();
  const push = (map, key, e) => { let a = map.get(key); if (!a) { a = []; map.set(key, a); } a.push(e); };
  for (const e of EDGES) { if (e.w > BUNDLE_MAX_WEIGHT) continue; push(outMap, e.s.idx + '|' + e.t, e); push(inMap, e.d.idx + '|' + e.t, e); }
  const assign = new Map();
  const consider = (map, dir) => { for (const [key, list] of map) { if (list.length < BUNDLE_MIN_COUNT) continue; for (const e of list) { const prev = assign.get(e); if (!prev || list.length > prev.size) assign.set(e, { key, dir, size: list.length }); } } };
  consider(outMap, 'out'); consider(inMap, 'in');
  const groups = new Map();
  for (const [e, a] of assign) { const gk = a.key + '|' + a.dir; e.bundleKey = gk; let g = groups.get(gk); if (!g) { g = { dir: a.dir, edges: [] }; groups.set(gk, g); } g.edges.push(e); }
  let list = [...groups.entries()].map(([gk, g]) => { const [hubIdxStr, type] = gk.split('|'); const hub = NODES[+hubIdxStr]; return { key: gk, hub, type: /** @type {string} */(type), dir: g.dir, edges: g.edges }; });
  list.sort((a, b) => b.edges.length - a.edges.length);
  if (list.length > BUNDLE_MAX_RENDERED) { for (const b of list.slice(BUNDLE_MAX_RENDERED)) for (const e of b.edges) e.bundleKey = null; list = list.slice(0, BUNDLE_MAX_RENDERED); }
  BUNDLES = list;
}
const coneUnitGeo = new THREE.ConeGeometry(1, 1, 20, 1, true); coneUnitGeo.translate(0, 0.5, 0);
const haloUnitGeo = new THREE.SphereGeometry(1, 16, 12);
const membraneConeMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, vertexColors: true });
const membraneHaloMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, vertexColors: true });
let membraneCones = null, membraneHalos = null, membraneCap = 0;
function ensureMembranes() {
  if (membraneCones && BUNDLES.length <= membraneCap) return;
  if (membraneCones) { scene.remove(membraneCones); scene.remove(membraneHalos); membraneCones.dispose(); membraneHalos.dispose(); }
  membraneCap = Math.max(16, Math.ceil(BUNDLES.length * 1.3));
  membraneCones = new THREE.InstancedMesh(coneUnitGeo, membraneConeMat, membraneCap);
  membraneHalos = new THREE.InstancedMesh(haloUnitGeo, membraneHaloMat, membraneCap);
  membraneCones.instanceMatrix.setUsage(THREE.DynamicDrawUsage); membraneHalos.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  membraneCones.frustumCulled = false; membraneHalos.frustumCulled = false;
  scene.add(membraneCones); scene.add(membraneHalos);
}
const _bd = new THREE.Vector3(), _bavg = new THREE.Vector3(), _bq = new THREE.Quaternion(), _bs = new THREE.Vector3(), _bm = new THREE.Matrix4(), _bcol = new THREE.Color();
function writeMembrane(b, i) {
  const hub = b.hub; const zero = () => { membraneCones.setMatrixAt(i, _zero); membraneHalos.setMatrixAt(i, _zero); };
  if (!state.bundlesOn || !hub.vis) return zero();
  const n = b.edges.length; const step = Math.max(1, Math.floor(n / BUNDLE_SAMPLE));
  _bavg.set(0, 0, 0); let count = 0; const dirs = [];
  for (let k = 0; k < n; k += step) { const e = b.edges[k]; const other = b.dir === 'out' ? e.d : e.s; if (!other.vis || other === hub) continue; _bd.subVectors(other.pos, hub.pos); const len = _bd.length(); if (len < 0.01) continue; _bd.divideScalar(len); dirs.push({ d: _bd.clone(), len }); _bavg.add(_bd); count++; }
  if (count === 0) return zero();
  _bavg.divideScalar(count); const avgLen = _bavg.length(); if (avgLen < 1e-4) { _bavg.set(0, 1, 0); } else _bavg.normalize();
  let avgDist = 0; for (const { len } of dirs) avgDist += len; avgDist /= dirs.length;
  let maxAngle = 0; for (const { d } of dirs) { const ang = Math.acos(Math.max(-1, Math.min(1, d.dot(_bavg)))); if (ang > maxAngle) maxAngle = ang; }
  _bcol.copy(ECOL[b.type] || _white);
  if (maxAngle > BUNDLE_HALO_ANGLE || avgLen < 0.35) {
    // wide fan-out: render a soft halo around the hub instead of a directional cone
    const r = Math.max(hub.size * 1.6, avgDist * 0.32);
    _bm.compose(hub.pos, _bq.identity(), _bs.set(r, r, r)); membraneHalos.setMatrixAt(i, _bm); membraneHalos.setColorAt(i, _bcol);
    membraneCones.setMatrixAt(i, _zero);
  } else {
    const baseR = Math.max(1.2, avgDist * Math.tan(Math.min(maxAngle + 0.15, 1.3)));
    _bq.setFromUnitVectors(UP, _bavg); _bs.set(baseR, avgDist, baseR); _bm.compose(hub.pos, _bq, _bs); membraneCones.setMatrixAt(i, _bm); membraneCones.setColorAt(i, _bcol);
    membraneHalos.setMatrixAt(i, _zero);
  }
}
function refreshMembranes() {
  if (!membraneCones) return;
  BUNDLES.forEach((b, i) => writeMembrane(b, i));
  membraneCones.instanceMatrix.needsUpdate = true; membraneHalos.instanceMatrix.needsUpdate = true;
  if (membraneCones.instanceColor) membraneCones.instanceColor.needsUpdate = true; if (membraneHalos.instanceColor) membraneHalos.instanceColor.needsUpdate = true;
}

// ===================== LAYOUT =====================
let animT = null, layoutWorker = null, layoutSeq = 0;
function layStatus(msg) { const el = $('layStatus'); el.textContent = msg || ''; el.style.display = msg ? 'inline-block' : 'none'; }
async function applyLayout(mode, fromScratch) {
  if (mode === 'depth' && !state.selected) { state.selected = byId.potus || NODES[0]; renderDetail(); renderList(); }
  state.layout = mode; const seq = ++layoutSeq;
  document.querySelectorAll('#layouts button').forEach(b => b.classList.toggle('on', b.dataset.l === mode));
  $('radialMetric').classList.toggle('show', mode === 'radial'); $('depthDir').classList.toggle('show', mode === 'depth');
  let pos;
  try {
    if (mode === 'depth') pos = await depthLayout(seq);
    else { const keyName = mode === 'radial' ? 'radial:' + state.radialMetric : mode; layStatus('Loading layout…'); const r = await fetch('/api/positions/' + encodeURIComponent(keyName)); if (!r.ok) throw new Error('layout ' + r.status); pos = new Float32Array(await r.arrayBuffer()); }
  } catch (e) { layStatus('Layout failed: ' + e.message); setTimeout(() => layStatus(''), 4000); return; }
  if (seq !== layoutSeq) return; layStatus('');
  if (!pos || pos.length < NODES.length * 3) { layStatus('Layout is out of date with the data; recomputing on the server…'); return; }
  NODES.forEach((n, i) => { n.from.copy(n.pos); n.target.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); if (fromScratch) { n.from.copy(n.target).multiplyScalar(0.15); n.pos.copy(n.from); } });
  animT = performance.now();
}
async function depthLayout(seq) {
  layStatus('Computing distances…');
  const r = await fetch(`/api/depth/${encodeURIComponent(state.selected.id)}?dir=${state.depthDir}`); if (!r.ok) throw new Error('depth ' + r.status);
  const maxD = +r.headers.get('X-Max-Depth') || 1; const depth = new Int32Array(await r.arrayBuffer());
  if (seq !== layoutSeq) return null;
  if (!layoutWorker) { layoutWorker = new Worker('/worker.js'); }
  const N = NODES.length; const size = new Float32Array(N), x0 = new Float32Array(N), y0 = new Float32Array(N), z0 = new Float32Array(N);
  NODES.forEach((n, i) => { size[i] = n.size; x0[i] = n.pos.x; y0[i] = n.pos.y; z0[i] = n.pos.z; });
  const E = EDGES.length; const es = new Int32Array(E), ed = new Int32Array(E), ew = new Float32Array(E); EDGES.forEach((e, k) => { es[k] = e.s.idx; ed[k] = e.d.idx; ew[k] = e.w; });
  const nodes = NODES.map(n => ({ id: n.id, c: n.c, s: n.s, b: n.b, t: n.t, p: n.p }));
  return new Promise((resolve, reject) => {
    layoutWorker.onmessage = ev => { if (seq !== layoutSeq) return; if (ev.data.progress !== undefined) layStatus(`Laying out… ${Math.round(ev.data.progress * 100)}%`); if (ev.data.done) { const { x, y, z } = ev.data; const out = new Float32Array(N * 3); for (let i = 0; i < N; i++) { out[i * 3] = x[i]; out[i * 3 + 1] = y[i]; out[i * 3 + 2] = z[i]; } resolve(out); } };
    layoutWorker.onerror = e => reject(new Error(e.message));
    layoutWorker.postMessage({ nodes, size, es, ed, ew, depth, maxD, spread: SPREAD, x0, y0, z0, iters: 130 }, [depth.buffer, es.buffer, ed.buffer, ew.buffer, x0.buffer, y0.buffer, z0.buffer]);
  });
}
function stepAnim(now) {
  if (animT === null) return; const D = reducedMotion ? 1 : 1000; const t = Math.min(1, (now - animT) / D); const e = 1 - Math.pow(1 - t, 3);
  for (const n of NODES) { n.pos.lerpVectors(n.from, n.target, e); if (n.label && n.label.visible) n.label.position.set(n.pos.x, n.pos.y + n.size * 1.3 + 1.4, n.pos.z); }
  writeAllNodeMatrices(); refreshEdges(); refreshMembranes(); if (t >= 1) animT = null;
}

// ===================== CAMERA & POINTER =====================
const cam = { target: new THREE.Vector3(0, 0, 0), theta: 0.55, phi: 1.15, radius: 320 };
const camAnim = { active: false };
function updateCamera() { const r = cam.radius, p = cam.phi, t = cam.theta; camera.position.set(cam.target.x + r * Math.sin(p) * Math.sin(t), cam.target.y + r * Math.cos(p), cam.target.z + r * Math.sin(p) * Math.cos(t)); camera.lookAt(cam.target); }
function flyTo(v, radius) { camAnim.active = true; camAnim.t0 = performance.now(); camAnim.fromT = cam.target.clone(); camAnim.toT = v.clone(); camAnim.fromR = cam.radius; camAnim.toR = radius; }
function stepCam(now) { if (!camAnim.active) return; const D = reducedMotion ? 1 : 650; const t = Math.min(1, (now - camAnim.t0) / D), e = 1 - Math.pow(1 - t, 3); cam.target.lerpVectors(camAnim.fromT, camAnim.toT, e); cam.radius = camAnim.fromR + (camAnim.toR - camAnim.fromR) * e; if (t >= 1) camAnim.active = false; }
function resize() { const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
window.addEventListener('resize', resize); resize();
const ptr = { down: false, moved: false, x: 0, y: 0, btn: 0, shift: false, lastTap: 0 }; const touches = {};
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => { ptr.down = true; ptr.moved = false; ptr.x = e.clientX; ptr.y = e.clientY; ptr.btn = e.button; ptr.shift = e.shiftKey; touches[e.pointerId] = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); camAnim.active = false; });
canvas.addEventListener('pointermove', e => {
  const ids = Object.keys(touches);
  if (ptr.down && ids.length === 2 && e.pointerType === 'touch') { const other = touches[ids.find(k => k != e.pointerId)]; const prev = touches[e.pointerId]; const d0 = Math.hypot(prev.x - other.x, prev.y - other.y), d1 = Math.hypot(e.clientX - other.x, e.clientY - other.y); if (d0 > 0) cam.radius = Math.max(8, Math.min(4000 * SPREAD, cam.radius * d0 / d1)); touches[e.pointerId] = { x: e.clientX, y: e.clientY }; ptr.moved = true; return; }
  if (ptr.down) {
    const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y; if (Math.abs(dx) + Math.abs(dy) > 3) ptr.moved = true;
    if (ptr.btn === 2 || ptr.btn === 1 || ptr.shift) { const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0), up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1); const k = cam.radius * 0.0016; cam.target.addScaledVector(right, -dx * k).addScaledVector(up, dy * k); }
    else { cam.theta -= dx * 0.0055; cam.phi = Math.max(0.08, Math.min(Math.PI - 0.08, cam.phi - dy * 0.0055)); }
    ptr.x = e.clientX; ptr.y = e.clientY; touches[e.pointerId] = { x: e.clientX, y: e.clientY };
  } else hoverAt(e.clientX, e.clientY);
});
function endPointer(e) {
  delete touches[e.pointerId]; if (!ptr.down) return; ptr.down = false;
  if (!ptr.moved && ptr.btn === 0) { const n = pick(e.clientX, e.clientY); const now = performance.now(); if (n && now - ptr.lastTap < 320 && state.selected === n) flyTo(n.pos, Math.max(24, n.size * 12)); else if (n && e.shiftKey) setPathEnd(n); else select(n); ptr.lastTap = now; }
}
canvas.addEventListener('pointerup', endPointer); canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', e => { e.preventDefault(); cam.radius = Math.max(8, Math.min(4000 * SPREAD, cam.radius * Math.pow(1.0012, e.deltaY))); camAnim.active = false; }, { passive: false });
window.addEventListener('keydown', e => { if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return; if (e.key === 'Escape') { select(null); clearPath(); } if (e.key === 'l' || e.key === 'L') { const s = $('labelMin'); s.value = s.value === '0' ? '7' : '0'; s.dispatchEvent(new Event('input')); } });
const ray = new THREE.Raycaster(); const mouse = new THREE.Vector2();
function pick(cx, cy) {
  const r = canvas.getBoundingClientRect(); mouse.x = ((cx - r.left) / r.width) * 2 - 1; mouse.y = -((cy - r.top) / r.height) * 2 + 1;
  ray.setFromCamera(mouse, camera); const hits = ray.intersectObjects(buckets.map(b => b.mesh), false);
  for (const h of hits) { const n = buckets[h.object.userData.bucket].nodes[h.instanceId]; if (n && n.vis) return n; }
  return null;
}
const tip = $('tip'); let hoverPending = null;
function hoverAt(x, y) { hoverPending = { x, y }; }
function doHover() {
  if (!hoverPending) return; const { x, y } = hoverPending; hoverPending = null; const n = pick(x, y);
  if (n !== state.hovered) { state.hovered = n; canvas.style.cursor = n ? 'pointer' : 'grab'; applyVisibility(false); }
  if (n) { tip.style.display = 'block'; tip.innerHTML = `<b><i style="--c:${CATS[n.c].hex}"></i>${esc(n.n)}</b><span>${CATS[n.c].label} · ${esc(n.s)} · ${esc(n.ind)}</span><span>power ${n.p} · ${n.deg} links${n.src !== 'curated' ? ' · ' + esc(sourceLabel(n.src)) : ''}</span>`; const r = canvas.getBoundingClientRect(); const tw = tip.offsetWidth, th = tip.offsetHeight; let lx = x - r.left + 14, ly = y - r.top + 14; if (lx + tw > r.width - 8) lx = x - r.left - tw - 14; if (ly + th > r.height - 70) ly = y - r.top - th - 14; tip.style.left = lx + 'px'; tip.style.top = ly + 'px'; }
  else tip.style.display = 'none';
}
function sourceLabel(src) { return src === 'edgar' ? 'SEC EDGAR' : src === '13f' ? '13F filer' : src === 'context' ? 'documented ownership' : src.startsWith('import:') ? 'imported: ' + src.slice(7) : src; }

// ===================== VISIBILITY =====================
function nodePasses(n) {
  if (state.hiddenIds.has(n.id)) return false;
  if (!(state.cats.has(n.c) && state.sectors.has(n.s) && state.branches.has(n.b))) return false;
  if (n.size < state.minSize) return false;
  if (state.darkOnly && !n.hasDark) return false;
  if (state.highlight && state.hlMode === 'isolate' && !state.highlight.has(n)) return false;
  return true;
}
function matches(n) { return !state.search || (state.searchSet ? state.searchSet.has(n) : n.search.includes(state.search)); }
function applyVisibility(recolorEdges = true) {
  const sel = state.selected, hov = state.hovered, q = state.search; const nb = sel ? neighborSet(sel) : null;
  const pathNodes = state.path ? new Set(state.path.nodes) : null, pathEdges = state.path ? new Set(state.path.edges) : null;
  const hl = state.highlight && state.hlMode === 'highlight';
  for (const n of NODES) {
    let vis = nodePasses(n); if (state.focus && sel) vis = vis && nb.has(n);
    const match = q && matches(n);
    let dim = !vis ? false : ((q && !match) || (sel && !nb.has(n)) || (pathNodes && !pathNodes.has(n)) || (hl && !state.highlight.has(n)));
    if (sel === n || hov === n) dim = false;
    const inHl = hl && state.highlight.has(n);
    n.vis = vis; n.dim = dim; n.glow = sel === n ? 0.55 : hov === n ? 0.35 : (pathNodes && pathNodes.has(n)) || inHl ? 0.25 : 0;
    writeNodeMatrix(n); writeNodeColor(n);
    showLabel(n, vis && !dim && (n.p >= state.labelMin || sel === n || hov === n || (q && match) || (nb && nb.has(n)) || (pathNodes && pathNodes.has(n)) || (inHl && n.p >= Math.min(state.labelMin, 4))));
  }
  buckets.forEach(b => b.mesh.instanceMatrix.needsUpdate = true); flushNodeColors(); pruneLabels();
  for (const e of EDGES) {
    let vis = state.edgesOn && e.s.vis && e.d.vis && state.etypes.has(e.t) && e.w >= state.minW;
    if (state.darkOnly) vis = vis && e.t === 'D';
    if (sel) vis = vis && (e.s === sel || e.d === sel);
    else if (e.bundleKey && state.bundlesOn) vis = false; // ambient view: the membrane represents this edge instead
    if (pathEdges) vis = vis || pathEdges.has(e);
    e.vis = vis;
    const hlE = hl && !(state.highlight.has(e.s) && state.highlight.has(e.d));
    e.dim = pathEdges ? !pathEdges.has(e) : (hov && !sel ? !(e.s === hov || e.d === hov) : hlE);
    e.hl = pathEdges ? pathEdges.has(e) : false;
  }
  refreshEdges(); if (recolorEdges) refreshEdgeColors();
  refreshMembranes();
}

// ===================== SELECTION, DETAIL, PATH =====================
let detailSeq = 0;
async function select(n, fly) {
  state.selected = n; state.detail = null; renderDetail(); renderList(); scrollListToSelected(); applyVisibility();
  if (n && fly) flyTo(n.pos, Math.max(24, n.size * 12));
  if (!n) return;
  const seq = ++detailSeq;
  try {
    const d = await getJSON('/api/node/' + encodeURIComponent(n.id)); if (seq !== detailSeq) return;
    for (const e of d.edges) { const s = NODES[e.si], t = NODES[e.di]; if (s && t) { const le = addEdge(s, t, e.t, e.w, e.note); e.local = le; } }
    ensureArrows(); state.detail = d; renderDetail(); applyVisibility();
  } catch (err) { $('detail').insertAdjacentHTML('afterbegin', `<div class="status" style="padding:8px 12px;color:#ff8a8a">Could not load details: ${esc(err.message)}</div>`); }
  if (state.layout === 'depth') applyLayout('depth', false);
}
function renderDetail() {
  const box = $('detail'); const n = state.selected; const pathHtml = renderPathBox();
  if (!n) { box.innerHTML = pathHtml ? '<div style="padding:12px 12px 0">' + pathHtml + '</div>' + EMPTY_HTML : EMPTY_HTML; return; }
  const d = state.detail; const row = d ? d.node : null;
  const edgeRow = (e) => { const o = e.other; return `<div class="edge" data-id="${esc(o.id)}" style="--c:${ETYPES[e.t].hex};--nc:${CATS[o.c].hex}" title="Power ${o.p}"><div class="bar" style="width:${4 + e.w * 3.6}px"></div><div><div class="who"><i></i>${esc(o.name)}</div><div class="how"><b>${ETYPES[e.t].verb}</b>${e.note ? esc(e.note) : ''} <span style="color:var(--faint)">· ${e.w}/5${e.source && e.source !== 'curated' ? ' · ' + esc(sourceLabel(e.source)) : ''}</span></div></div></div>`; };
  const inc = d ? d.edges.filter(e => e.dir === 'in').sort((a, b) => b.w - a.w || b.other.p - a.other.p) : [], out = d ? d.edges.filter(e => e.dir === 'out').sort((a, b) => b.w - a.w || b.other.p - a.other.p) : [];
  const facts = row && row.ticker ? `<div class="stats" style="grid-template-columns:repeat(3,1fr)">
      ${row.revenue != null ? `<div class="stat"><b>$${money(row.revenue)}</b><span>revenue</span></div>` : ''}
      ${row.net_income != null ? `<div class="stat"><b>${row.net_income < 0 ? '−' : ''}$${money(Math.abs(row.net_income))}</b><span>net income</span></div>` : ''}
      ${row.assets != null ? `<div class="stat"><b>$${money(row.assets)}</b><span>${row.source === '13f' ? '13F equity holdings' : 'assets'}</span></div>` : ''}
      ${row.inst_value != null ? `<div class="stat"><b>$${money(row.inst_value)}</b><span>held by institutions</span></div>` : ''}
      ${row.inst_holders != null ? `<div class="stat"><b>${row.inst_holders.toLocaleString()}</b><span>13F holders</span></div>` : ''}
      ${row.sic ? `<div class="stat"><b>${row.sic}</b><span>${esc(row.sic_desc || 'SIC')}</span></div>` : ''}
    </div>` : '';
  const links = row && row.cik ? `<div class="meta" style="margin:6px 0">${row.ticker ? `${esc(row.exchange || '')} ${esc(row.ticker)} · ` : ''}${row.hq ? esc(row.hq) + ' · ' : ''}<a href="https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${row.cik}&type=10-K" target="_blank" rel="noopener">EDGAR filings</a> · CIK ${row.cik}</div>` : '';
  box.innerHTML = `
    <div class="hd">
      <div class="cat" style="--c:${CATS[n.c].hex}"><i></i>${CATS[n.c].label} · ${esc(n.s)} · ${esc(n.b)} · <a href="#" class="indlink" data-ind="${esc(n.ind)}" title="Highlight this industry">${esc(n.ind)}</a>${n.hasDark ? ' · <span style="color:#ff5fc9">dark money</span>' : ''}</div>
      <h1>${esc(n.n)}</h1>
      <div class="dm">${esc(row ? row.dm : '')}</div>
    </div>
    <div style="padding:0 12px 12px">
      ${pathHtml}
      <p>${row ? esc(row.description) : '<span style="color:var(--faint)">Loading…</span>'}</p>
      ${links}${facts}
      <div class="stats">
        <div class="stat"><b>${n.p}</b><span>power score</span></div>
        <div class="stat"><b>${n.outW}</b><span>control out (${d ? d.outTotal.toLocaleString() : '…'})</span></div>
        <div class="stat"><b>${n.inW}</b><span>control in (${d ? d.inTotal.toLocaleString() : '…'})</span></div>
        <div class="stat"><b>${n.net > 0 ? '+' : ''}${n.net}</b><span>net</span></div>
      </div>
      <div class="acts">
        <button data-act="fly">Fly to</button>
        <button data-act="focus" class="${state.focus ? 'on' : ''}">Isolate links</button>
        <button data-act="pa" class="${state.pathA === n ? 'on' : ''}">Path from here</button>
        <button data-act="pb" class="${state.pathB === n ? 'on' : ''}">Path to here</button>
        <button data-act="depth" class="${state.layout === 'depth' ? 'on' : ''}">Rings of distance</button>
        <button data-act="chain-start" title="Open the chain builder starting at this center">Build a chain from here</button>
        <button data-act="chain-from" title="Find the strongest chains of money and control flowing out of this center">Top chains from here</button>
        <button data-act="hide" title="Remove this center from the map. Restore it later from “hidden centers” in the Explore panel.">Hide this center</button>
      </div>
      ${row && row.funding ? `<div class="meta" style="margin-bottom:6px">Sized by: $${money(row.funding)} · ${esc(row.funding_basis || '')}</div>` : ''}
      <div class="meta" style="margin-bottom:6px">Source: ${esc(row ? (row.source === 'curated' ? 'hand-curated map' : row.source === 'edgar' ? 'SEC EDGAR company registry' : row.source === '13f' ? 'SEC Form 13F filer' : sourceLabel(row.source)) : '…')}</div>
      <div class="edges">
        ${d ? `<h3>Chain of command (strongest control arrows inward)</h3><div class="chain">${d.chain.map(c => `<a data-id="${esc(c.id)}">${esc(c.name)}</a>`).join('<em>→</em>')}</div>` : ''}
        <h3>Controlled, checked or pressured by — ${(d && d.inTotal) ?? inc.length}</h3>
        ${inc.map(edgeRow).join('') || '<div class="how" style="color:var(--faint)">Nothing in the map reaches this center.</div>'}
        ${d && d.inTotal > inc.length ? `<div class="how" style="color:var(--faint);padding:4px 6px">+${(d.inTotal - inc.length).toLocaleString()} more, mostly routine low-strength connections — shown ambiently in the 3D view as a connection bundle (turn on “Bundles” in Explore).</div>` : ''}
        <h3>Controls, funds or influences — ${(d && d.outTotal) ?? out.length}</h3>
        ${out.map(edgeRow).join('') || '<div class="how" style="color:var(--faint)">No outgoing arrows.</div>'}
        ${d && d.outTotal > out.length ? `<div class="how" style="color:var(--faint);padding:4px 6px">+${(d.outTotal - out.length).toLocaleString()} more, mostly routine low-strength connections — shown ambiently in the 3D view as a connection bundle (turn on “Bundles” in Explore).</div>` : ''}
      </div>
    </div>`;
  box.scrollTop = 0;
}
const EMPTY_HTML = $('empty').outerHTML;
$('detail').addEventListener('click', e => {
  const il = e.target.closest('.indlink'); if (il) { e.preventDefault(); setHighlight(il.dataset.ind, 'highlight'); return; }
  const a = e.target.closest('[data-id]'); if (a) { const n = byId[a.dataset.id]; if (n) select(n, true); return; }
  const b = e.target.closest('[data-act]'); if (!b) return; const n = state.selected; const act = b.dataset.act;
  if (act === 'fly' && n) flyTo(n.pos, Math.max(24, n.size * 12));
  if (act === 'focus') { state.focus = !state.focus; $('focusBtn').classList.toggle('on', state.focus); renderDetail(); applyVisibility(); }
  if (act === 'pa' && n) { state.pathA = state.pathA === n ? null : n; computePath(); }
  if (act === 'pb' && n) { state.pathB = state.pathB === n ? null : n; computePath(); }
  if (act === 'depth' && n) { applyLayout(state.layout === 'depth' ? 'cat' : 'depth', false); renderDetail(); }
  if (act === 'hide' && n) { hideNode(n); }
  if (act === 'chain-start' && n && window.ChainStudio) window.ChainStudio.startFrom(n.id);
  if (act === 'chain-from' && n && window.ChainStudio) window.ChainStudio.discoverFrom(n.id);
  if (act === 'chain2d' && window.ChainStudio) window.ChainStudio.open();
  if (act === 'clearpath') clearPath();
  if (act === 'pathdir') { state.pathDirected = !state.pathDirected; computePath(); }
});
function setPathEnd(n) { if (!state.pathA || (state.pathA && state.pathB)) { state.pathA = n; state.pathB = null; } else state.pathB = n; computePath(); }
function clearPath() { state.pathA = null; state.pathB = null; state.path = null; renderDetail(); applyVisibility(); }
async function computePath() {
  state.path = null;
  if (state.pathA && state.pathB && state.pathA !== state.pathB) {
    const src = state.pathA, dst = state.pathB; renderDetail();
    try {
      const r = await getJSON(`/api/path?from=${encodeURIComponent(src.id)}&to=${encodeURIComponent(dst.id)}&directed=${state.pathDirected ? 1 : 0}`);
      if (state.pathA !== src || state.pathB !== dst) return;
      if (r.none) state.path = { nodes: [], edges: [], src, dst, none: true };
      else { const edges = r.edges.map(e => addEdge(byId[e.src], byId[e.dst], e.t, e.w, e.note)); ensureArrows(); state.path = { nodes: r.nodes.map(id => byId[id]), edges, src, dst }; }
    } catch (e) { state.path = { nodes: [], edges: [], src, dst, none: true }; }
  }
  renderDetail(); applyVisibility();
}
function renderPathBox() {
  if (state.path && state.path.chainTitle) return `<div id="pathbox"><div class="h"><b>Chain</b> ${esc(state.path.chainTitle)} <button data-act="chain2d" style="margin-left:auto;padding:2px 7px;font-size:11px">2D view</button><button data-act="clearpath" style="padding:2px 7px;font-size:11px">clear</button></div><div class="steps">${state.path.nodes.map(n => `<a data-id="${esc(n.id)}">${esc(n.n)}</a>`).join(' · ')}</div></div>`;
  if (!state.pathA && !state.pathB) return ''; const a = state.pathA, b = state.pathB, p = state.path; let steps = '';
  if (p && !p.none) steps = '<div class="steps">' + p.nodes.map((n, i) => { const e = p.edges[i - 1]; const pre = e ? (e.s === p.nodes[i - 1] ? `<em style="color:${ETYPES[e.t].hex}">${ETYPES[e.t].verb} ${e.w}/5 →</em>` : `<em style="color:${ETYPES[e.t].hex}">← ${ETYPES[e.t].verb} ${e.w}/5</em>`) : ''; return pre + `<a data-id="${esc(n.id)}">${esc(n.n)}</a>`; }).join(' ') + '</div>';
  else if (p && p.none) steps = `<div class="none">No ${state.pathDirected ? 'arrow-following' : ''} chain connects these two. Try "any direction".</div>`;
  else if (a && b) steps = '<div class="none">Searching the full arrow table…</div>';
  else steps = '<div class="none">Pick the other end: click a center and use "Path to here", or shift+click it.</div>';
  return `<div id="pathbox"><div class="h"><b>Path</b> ${a ? esc(a.n) : '…'} <span>→</span> ${b ? esc(b.n) : '…'} <button data-act="pathdir" style="margin-left:auto;padding:2px 7px;font-size:11px">${state.pathDirected ? 'follow arrows' : 'any direction'}</button><button data-act="clearpath" style="padding:2px 7px;font-size:11px">clear</button></div>${steps}</div>`;
}

// ===================== LIST & FILTERS =====================
// Virtualized: with 9,000+ centers, building one DOM row per node is what made the old 400-row cap necessary.
// Instead we keep a flat "plan" (one entry per header/row, with its pixel offset) and only ever materialize the
// rows currently scrolled into view (+ a buffer), so the full unfiltered list scrolls smoothly.
const listEl = $('list'); const LIST_ROW_H = 26, LIST_HEADER_H = 27;
let listInner = null, listPlan = [], listTotalH = 0;
const collapsedGroups = new Set();
function ensureListInner() { if (!listInner) { listEl.style.position = 'relative'; listInner = document.createElement('div'); listInner.style.cssText = 'position:relative'; listEl.appendChild(listInner); } return listInner; }
function sortNodes(arr) { const k = state.sort; const s = [...arr]; if (k === 'name') s.sort((a, b) => a.n.localeCompare(b.n)); else s.sort((a, b) => b[k] - a[k] || a.n.localeCompare(b.n)); return s; }
function gLabel(n) { return state.group === 'c' ? CATS[n.c].label : state.group === 's' ? n.s : state.group === 'b' ? n.b : state.group === 't' ? ('Tier ' + n.t) : state.group === 'i' ? n.ind : null; }
function buildListPlan() {
  let arr = NODES.filter(n => nodePasses(n) && matches(n));
  if (state.focus && state.selected) { const nb = neighborSet(state.selected); arr = arr.filter(n => nb.has(n)); }
  arr = sortNodes(arr);
  $('listCount').textContent = `${arr.length.toLocaleString()} of ${NODES.length.toLocaleString()} centers`;
  const plan = []; let y = 0;
  if (state.group) {
    const groups = new Map(); arr.forEach(n => { const g = gLabel(n); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(n); });
    groups.forEach((ns, g) => {
      const collapsed = collapsedGroups.has(g);
      plan.push({ type: 'header', label: g, count: ns.length, collapsed, top: y, height: LIST_HEADER_H }); y += LIST_HEADER_H;
      if (!collapsed) for (const n of ns) { plan.push({ type: 'row', node: n, top: y, height: LIST_ROW_H }); y += LIST_ROW_H; }
    });
  } else for (const n of arr) { plan.push({ type: 'row', node: n, top: y, height: LIST_ROW_H }); y += LIST_ROW_H; }
  listPlan = plan; listTotalH = y;
}
function rowHtml(n) { return `<div class="row${state.selected === n ? ' sel' : ''}" tabindex="0" style="--c:${CATS[n.c].hex}" data-id="${esc(n.id)}"><i></i><span class="nm">${esc(n.n)}</span><span class="st" title="power · control out · control in"><b>${n.p}</b> ${n.outW}↑ ${n.inW}↓</span></div>`; }
function headerHtml(it) { return `<div class="grp" data-g="${esc(it.label)}" style="cursor:pointer;user-select:none" title="Click to ${it.collapsed ? 'expand' : 'collapse'} this group">${it.collapsed ? '▸' : '▾'} ${esc(it.label)} · ${it.count}</div>`; }
function renderVisibleList() {
  const el = ensureListInner(); el.style.height = listTotalH + 'px';
  const viewH = listEl.clientHeight || 300, top = listEl.scrollTop, buf = 300;
  const lo = top - buf, hi = top + viewH + buf;
  let a = 0, b = listPlan.length; while (a < b) { const m = (a + b) >> 1; if (listPlan[m].top + listPlan[m].height < lo) a = m + 1; else b = m; }
  let html = '';
  for (let i = a; i < listPlan.length; i++) { const it = listPlan[i]; if (it.top > hi) break; const wrapStyle = `position:absolute;left:0;right:0;top:${it.top}px;height:${it.height}px`; html += it.type === 'header' ? `<div style="${wrapStyle}">${headerHtml(it)}</div>` : `<div style="${wrapStyle}">${rowHtml(it.node)}</div>`; }
  el.innerHTML = html;
}
function renderList() { buildListPlan(); renderVisibleList(); }
function scrollListToSelected() {
  const n = state.selected; if (!n) return;
  if (state.group) { const g = gLabel(n); if (collapsedGroups.has(g)) { collapsedGroups.delete(g); buildListPlan(); } }
  const it = listPlan.find(p => p.type === 'row' && p.node === n); if (!it) return;
  const viewH = listEl.clientHeight || 300;
  if (it.top < listEl.scrollTop || it.top + it.height > listEl.scrollTop + viewH) listEl.scrollTop = Math.max(0, it.top - viewH / 2);
  renderVisibleList();
}
listEl.addEventListener('scroll', renderVisibleList);
window.addEventListener('resize', renderVisibleList);
listEl.addEventListener('click', e => {
  const g = e.target.closest('.grp'); if (g) { const label = g.dataset.g; if (collapsedGroups.has(label)) collapsedGroups.delete(label); else collapsedGroups.add(label); buildListPlan(); renderVisibleList(); return; }
  const r = e.target.closest('.row'); if (r) select(byId[r.dataset.id], true);
});
listEl.addEventListener('keydown', e => { if (e.key === 'Enter') { const r = e.target.closest('.row'); if (r) select(byId[r.dataset.id], true); } });
function chip(label, color, on, line) { const b = document.createElement('button'); b.className = 'chip' + (on ? ' on' : '') + (line ? ' line' : ''); b.innerHTML = `<i style="--c:${color}"></i>${esc(label)}`; return b; }
let lastChipShift = false; document.addEventListener('pointerdown', e => { lastChipShift = e.shiftKey; }, true);
function toggleSet(set, k, all) { if (lastChipShift) { set.clear(); set.add(k); return; } if (set.has(k)) { set.delete(k); if (set.size === 0) all.forEach(x => set.add(x)); } else set.add(k); }
function syncChips(container, set) { container.querySelectorAll('.chip').forEach(b => b.classList.toggle('on', set.has(b.dataset.k))); }
function buildChips() {
  const cc = $('catChips'); cc.innerHTML = ''; CAT_ORDER.forEach(k => { const b = chip(CATS[k].label, CATS[k].hex, true); b.title = CATS[k].sub; b.onclick = () => { toggleSet(state.cats, k, CAT_ORDER); syncChips(cc, state.cats); refresh(); }; b.dataset.k = k; cc.appendChild(b); });
  const sc = $('sectorChips'); sc.innerHTML = ''; SECTORS.forEach(k => { const b = chip(k, '#7f8ba3', true); b.querySelector('i').remove(); b.onclick = () => { toggleSet(state.sectors, k, SECTORS); syncChips(sc, state.sectors); refresh(); }; b.dataset.k = k; sc.appendChild(b); });
  const bc = $('branchChips'); bc.innerHTML = ''; BRANCHES.forEach(k => { const b = chip(k, '#7f8ba3', true); b.querySelector('i').remove(); b.onclick = () => { toggleSet(state.branches, k, BRANCHES); syncChips(bc, state.branches); refresh(); }; b.dataset.k = k; bc.appendChild(b); });
  const ec = $('etypeChips'); ec.innerHTML = ''; Object.keys(ETYPES).forEach(k => { const b = chip(ETYPES[k].label, ETYPES[k].hex, true, true); b.title = ETYPES[k].sub; b.onclick = () => { toggleSet(state.etypes, k, Object.keys(ETYPES)); syncChips(ec, state.etypes); refresh(); }; b.dataset.k = k; ec.appendChild(b); });
  const al = $('arrowLegend'); al.innerHTML = ''; Object.keys(ETYPES).forEach(k => { const s = document.createElement('span'); s.className = 'arr'; s.title = ETYPES[k].sub; s.innerHTML = `<svg viewBox="0 0 34 12"><line x1="1" y1="6" x2="24" y2="6" stroke="${ETYPES[k].hex}" stroke-width="3"/><polygon points="22,1 33,6 22,11" fill="${ETYPES[k].hex}"/></svg>${ETYPES[k].label}`; al.appendChild(s); });
}
function refresh() { renderList(); applyVisibility(); }
$('sortSel').onchange = e => { state.sort = e.target.value; renderList(); };
$('groupSel').onchange = e => { state.group = e.target.value; renderList(); };
$('minW').oninput = e => { state.minW = +e.target.value; $('minWv').textContent = state.minW; applyVisibility(); };
$('labelMin').oninput = e => { state.labelMin = +e.target.value; $('labelMinv').textContent = state.labelMin; applyVisibility(); };
$('focusBtn').onclick = () => { state.focus = !state.focus; $('focusBtn').classList.toggle('on', state.focus); renderDetail(); refresh(); };
let searchTimer = null, searchSeq = 0;
$('topsearch').oninput = e => { clearTimeout(searchTimer); searchTimer = setTimeout(() => runSearch(e.target.value), 160); };
async function runSearch(v) {
  state.search = v.trim().toLowerCase(); state.searchSet = null; const seq = ++searchSeq;
  if (state.search.length >= 2) {
    const local = new Set(NODES.filter(n => n.search.includes(state.search)));
    try { const hits = await getJSON('/api/search?q=' + encodeURIComponent(state.search)); if (seq !== searchSeq) return; hits.forEach(h => { const n = byId[h.id]; if (n) local.add(n); }); } catch { }
    state.searchSet = local;
  }
  refresh();
}
$('topsearch').onkeydown = e => { if (e.key === 'Enter') { const first = sortNodes(NODES.filter(n => nodePasses(n) && matches(n)))[0]; if (first) select(first, true); } };
document.querySelectorAll('#layouts button').forEach(b => b.onclick = () => { applyLayout(b.dataset.l, false); if (state.selected) renderDetail(); });
$('radialMetric').onchange = e => { state.radialMetric = e.target.value; applyLayout('radial', false); };
$('depthDir').onchange = e => { state.depthDir = e.target.value; applyLayout('depth', false); };
$('tLeft').onclick = e => { $('left').classList.toggle('hidden'); e.target.classList.toggle('on'); };
$('tRight').onclick = e => { $('right').classList.toggle('hidden'); e.target.classList.toggle('on'); };
$('resetView').onclick = () => { flyTo(new THREE.Vector3(0, 0, 0), 320 * SPREAD); cam.theta = 0.55; cam.phi = 1.15; };
$('dlJson').onclick = () => { location.href = '/api/export.json'; };
$('dlCsv').onclick = () => { location.href = '/api/export.csv'; };
function updateTitle() { document.querySelector('#title span').textContent = `Who decides, who controls whom · ${NODES.length.toLocaleString()} centers · ${(META.counts.edges).toLocaleString()} arrows · 13F ${META.f13Period}`; }

// ---------- industry highlight / dark money ----------
const indSel = $('indSel');
function buildIndustrySelect() { const cur = indSel.value; indSel.innerHTML = '<option value="">Choose an industry…</option>' + META.industries.map(x => `<option value="${esc(x.k)}">${esc(x.k)} · ${x.c}</option>`).join(''); if (cur) indSel.value = cur; }
function setHighlight(ind, mode) {
  if (!ind) { state.highlight = null; state.hlLabel = ''; } else { state.highlight = new Set(NODES.filter(n => n.ind === ind)); state.hlLabel = ind; indSel.value = ind; }
  if (mode) state.hlMode = mode;
  $('hlHighlight').classList.toggle('on', !!state.highlight && state.hlMode === 'highlight'); $('hlIsolate').classList.toggle('on', !!state.highlight && state.hlMode === 'isolate');
  $('hlStatus').textContent = state.highlight ? `${state.highlight.size} centers in “${state.hlLabel}”` : ''; refresh();
}
indSel.onchange = () => setHighlight(indSel.value, state.hlMode);
$('hlHighlight').onclick = () => setHighlight(indSel.value || state.hlLabel, 'highlight');
$('hlIsolate').onclick = () => setHighlight(indSel.value || state.hlLabel, 'isolate');
$('hlClear').onclick = () => { indSel.value = ''; setHighlight(null); };
$('darkBtn').onclick = () => { state.darkOnly = !state.darkOnly; $('darkBtn').classList.toggle('on', state.darkOnly); $('darkStatus').textContent = state.darkOnly ? `${NODES.filter(n => n.hasDark).length} centers with dark-money arrows` : ''; refresh(); };

// ---------- hide / remove individual centers ----------
function updateHiddenStatus() {
  const n = state.hiddenIds.size; const el = $('hiddenStatus'); if (!el) return;
  el.textContent = n ? `${n} center${n === 1 ? '' : 's'} hidden` : '';
  $('showHiddenBtn').hidden = !n;
}
function hideNode(n) {
  state.hiddenIds.add(n.id); saveHiddenIds();
  if (state.selected === n) select(null);
  if (state.pathA === n || state.pathB === n) clearPath();
  updateHiddenStatus(); refresh();
}
function showAllHidden() { state.hiddenIds.clear(); saveHiddenIds(); updateHiddenStatus(); refresh(); }
const showHiddenEl = $('showHiddenBtn'); if (showHiddenEl) showHiddenEl.onclick = showAllHidden;

// ---------- arrows on/off ----------
const arrowsBtn = $('arrowsBtn');
if (arrowsBtn) { arrowsBtn.classList.toggle('on', state.edgesOn); arrowsBtn.onclick = () => { state.edgesOn = !state.edgesOn; arrowsBtn.classList.toggle('on', state.edgesOn); applyVisibility(); }; }
const bundlesBtn = $('bundlesBtn');
if (bundlesBtn) { bundlesBtn.classList.toggle('on', state.bundlesOn); bundlesBtn.onclick = () => { state.bundlesOn = !state.bundlesOn; bundlesBtn.classList.toggle('on', state.bundlesOn); applyVisibility(); }; }

// ---------- min size (funding) filter ----------
// The slider is in the same "size" units glob radius uses (see server/layout.js sizeOf); the label converts
// that back to an approximate dollar figure so the control reads naturally ("hide anything under $1B").
function sizeToFunding(size) { return 3e5 * Math.pow(10, (size - 0.8) / 1.15); }
const minSizeEl = $('minSize');
if (minSizeEl) {
  const fmtThreshold = v => v <= 0 ? 'off' : '$' + money(sizeToFunding(v)) + '+';
  minSizeEl.oninput = e => { state.minSize = +e.target.value; $('minSizev').textContent = fmtThreshold(state.minSize); refresh(); };
}

// ---------- import: parsed in the browser, stored by the server ----------
function amountWeight(a) { a = Math.abs(+a || 0); return a >= 10e6 ? 5 : a >= 1e6 ? 4 : a >= 1e5 ? 3 : a >= 1e4 ? 2 : 1; }
function normName(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\b(inc|corp|corporation|co|company|llc|lp|ltd|plc|the|of|and|&|pac|committee|for|association|assn|group|holdings|fund|foundation)\b/g, ' ').replace(/\s+/g, ' ').trim(); }
function busy(msg) { $('dataStatus').textContent = msg; }
function adminToken(force) { let t = localStorage.getItem('pm_admin_token'); if (!t || force) { t = prompt('Imports are stored in the shared database. Enter the admin token:'); if (t) localStorage.setItem('pm_admin_token', t.trim()); } return t; }
async function ingest(payload, label) {
  if (!META.importEnabled) { busy('Imports are disabled on this server (no ADMIN_TOKEN configured).'); return; }
  const token = adminToken(false); if (!token) { busy('Import cancelled: no token.'); return; }
  busy(`Importing ${(payload.nodes || []).length} centers, ${(payload.edges || []).length} arrows…`);
  const r = await fetch('/api/import', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ label, payload }) });
  if (r.status === 401) { localStorage.removeItem('pm_admin_token'); busy('Import rejected: bad admin token. Try again to re-enter it.'); return; }
  if (!r.ok) { busy('Import failed: ' + (await r.text()).slice(0, 200)); return; }
  const added = await r.json();
  busy(`${label}: +${added.nodes} centers, +${added.edges} arrows${added.skipped ? ` (${added.skipped} matched or skipped)` : ''} — reloading…`);
  if (added.nodes || added.edges) setTimeout(() => location.reload(), 1200);
}
function parseCSV(text) {
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) { const ch = text[i]; if (q) { if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += ch; } else if (ch === '"') q = true; else if (ch === ',') { row.push(field); field = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(field); rows.push(row); row = []; field = ''; } else field += ch; }
  if (field || row.length) { row.push(field); rows.push(row); } if (!rows.length) return [];
  const head = rows[0].map(h => h.trim().toLowerCase().replace(/\s+/g, '_')); return rows.slice(1).filter(r => r.length > 1).map(r => { const o = {}; head.forEach((h, i) => o[h] = r[i]); return o; });
}
function detectAndConvert(text, fname) {
  if (/^\s*[\[{]/.test(text)) { const j = JSON.parse(text); if (j.nodes || j.edges) return { label: 'JSON', payload: { nodes: j.nodes || [], edges: (j.edges || []).map(e => ({ from: e.from, to: e.to, type: e.type, weight: e.weight, note: e.note })) } }; if (j.data && Array.isArray(j.data)) return convertLittleSis(j); throw new Error('Unrecognized JSON shape'); }
  const rows = parseCSV(text); if (!rows.length) throw new Error('Empty CSV'); const cols = Object.keys(rows[0]); const has = c => cols.includes(c);
  if (has('from') && has('to')) return { label: 'Edges CSV', payload: { edges: rows.map(r => ({ from: r.from, to: r.to, type: r.type, weight: r.weight, note: r.note })) } };
  if ((has('id') || has('name')) && !has('to') && !has('contributor_name') && !has('recipient_name')) return { label: 'Nodes CSV', payload: { nodes: rows } };
  if (has('contributor_name') && has('committee_name')) return convertFecScheduleA(rows);
  if (has('recipient_name') && has('committee_name')) return convertFecScheduleB(rows);
  if (has('recipient_name') && (has('awarding_agency_name') || has('awarding_agency'))) return convertUSAspending(rows);
  if (has('registrant_name') && has('client_name')) return convertLobbying(rows);
  if (has('entity1_id') || has('entity1')) return convertLittleSisCSV(rows);
  throw new Error('Unrecognized columns: ' + cols.slice(0, 8).join(', '));
}
$('fileIn').onchange = async e => { for (const f of e.target.files) { try { const t = await f.text(); const { label, payload } = detectAndConvert(t, f.name); await ingest(payload, label + ' · ' + f.name); } catch (err) { busy('Import failed: ' + err.message); } } e.target.value = ''; };
$('pasteBtn').onclick = async () => { try { const t = await navigator.clipboard.readText(); const { label, payload } = detectAndConvert(t, ''); await ingest(payload, label + ' · clipboard'); } catch (err) { busy('Paste failed: ' + err.message); } };
$('tplBtn').onclick = () => { const b = new Blob([`# Two CSV shapes are accepted (save each as its own .csv and drop it on "Import file"):\n# nodes.csv\nid,name,category,sector,branch,dm,power,tier,description,industry\nco_example,Example Corp,economic,Business,Private,"CEO Jane Doe",4,3,"What it controls and who controls it.",Retail\n# edges.csv  (type = control|fund|regulate|check|enforce|influence|leverage|darkmoney or the letter C F R K E I L D; weight 1-5)\nfrom,to,type,weight,note\nco_example,congress,influence,3,Lobbying\nblackrock,co_example,control,2,Top shareholder\n# Also accepted as-is: FEC Schedule A/B CSV exports, USAspending award CSVs, Senate LDA filings CSV, LittleSis relationships JSON/CSV, and this app's own export JSON.\n`], { type: 'text/plain' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = 'power-map-template.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); };
$('fetchBox').addEventListener('click', async e => {
  const b = e.target.closest('[data-src]'); if (!b) return; const n = state.selected; if (!n) { busy('Select a center first, then fetch.'); return; }
  const f = { fec: fetchFEC, usa: fetchUSAspending, ls: fetchLittleSis, lda: fetchLDA }[b.dataset.src];
  try { await f(n); } catch (err) { busy(`${b.textContent} failed (${err.message}). Cross-origin fetches are often blocked in browsers; export a CSV from the site and use Import file instead.`); }
});
$('srcBtn').onclick = () => $('help').classList.add('show');
$('helpClose').onclick = () => $('help').classList.remove('show');
$('help').addEventListener('click', e => { if (e.target.id === 'help') e.target.classList.remove('show'); });

// ===================== INIT =====================
async function init() {
  const loading = $('loading'); const say = m => loading.querySelector('span').textContent = m;
  say('Loading centers…');
  // min=1 (every edge, not just strength >=3): connection-bundle detection needs the low-weight "routine" mass
  // edges (SEC registrant, IRS tax-exempt oversight...) that the old ambient fetch used to filter out entirely.
  const [meta, nodes, edges] = await Promise.all([getJSON('/api/meta'), getJSON('/api/nodes'), getJSON('/api/edges?min=1')]);
  META = meta; CATS = meta.categories; ETYPES = meta.edgeTypes; SECTORS = meta.sectors; BRANCHES = meta.branches;
  Object.keys(ETYPES).forEach(k => ECOL[k] = new THREE.Color(ETYPES[k].hex)); state.sectors = new Set(SECTORS); state.branches = new Set(BRANCHES); state.etypes = new Set(Object.keys(ETYPES));
  for (let i = 0; i < nodes.id.length; i++) {
    const n = { idx: i, id: nodes.id[i], n: nodes.name[i], c: nodes.c[i], s: nodes.s[i], b: nodes.b[i], ind: nodes.ind[i], p: nodes.p[i], t: nodes.t[i], deg: nodes.deg[i], outW: nodes.outW[i], inW: nodes.inW[i], net: nodes.outW[i] - nodes.inW[i], hasDark: !!nodes.dark[i], src: nodes.src[i], funding: nodes.funding[i], out: [], in: [], vis: true, dim: false, glow: 0, spin: 0, label: null };
    n.size = PowerLayout.sizeOf(n); n.color = new THREE.Color(CATS[n.c] ? CATS[n.c].color : 0x888888); n.search = (n.n + ' ' + n.ind).toLowerCase(); n.pos = new THREE.Vector3(); n.target = new THREE.Vector3(); n.from = new THREE.Vector3();
    NODES.push(n); byId[n.id] = n;
  }
  SPREAD = Math.sqrt(NODES.length / 350); cam.radius = 320 * SPREAD; camera.far = 12000 * SPREAD; camera.updateProjectionMatrix();
  for (let k = 0; k < edges.s.length; k++) addEdge(NODES[edges.s[k]], NODES[edges.d[k]], edges.t[k], edges.w[k], '');
  say(`Placing ${NODES.length.toLocaleString()} centers…`);
  computeBundles(); ensureMembranes();
  buildNodeMeshes(); ensureArrows(); buildChips(); buildIndustrySelect(); updateTitle(); updateHiddenStatus();
  $('layouts').insertAdjacentHTML('afterend', '<span id="layStatus" style="display:none;font-size:12.5px;color:var(--muted);background:rgba(19,25,34,.7);border:1px solid var(--line);border-radius:6px;padding:4px 8px"></span>');
  $('groupSel').insertAdjacentHTML('beforeend', '<option value="i">Industry</option>');
  $('note').textContent = `Curated centers per public reporting, ${META.curatedGenerated}; listed companies from SEC EDGAR; ownership from 13F filings (${META.f13Period}); large nonprofits, unions and trade groups from the IRS exempt-organization file; federal awards from USAspending; political money from FEC 2025-26 filings; power scores editorial for curated centers, size-based for companies.`;
  const srcTbl = META.sources.map(s => `<tr><td>${esc(s.label)}</td><td>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url.replace(/^https?:\/\//, ''))}</a> — ` : ''}${s.nodes.toLocaleString()} centers, ${s.edges.toLocaleString()} arrows, as of ${esc(s.asof || '')}</td></tr>`).join('');
  $('help').querySelector('.card').insertAdjacentHTML('beforeend', `<h3>Loaded into this database</h3><table>${srcTbl}</table><p style="color:var(--muted);font-size:13px">This build stores centers and arrows in SQLite behind an API; the browser loads compact center records plus strong arrows, fetches the rest on selection, and uses Barnes-Hut layouts precomputed on the server. Growing toward every business in America is a matter of feeding more registries through the same import format.</p>`);
  await applyLayout('cat', true); renderList(); applyVisibility(); updateCamera();
  loading.remove(); canvas.style.cursor = 'grab';
  let last = 0;
  function loop(now) {
    requestAnimationFrame(loop); stepAnim(now); stepCam(now); doHover(); updateCamera();
    if (!reducedMotion && animT === null) { const dt = Math.min(0.05, (now - last) / 1000); last = now; if (state.selected) { const n = state.selected; n.spin += dt * 0.6; writeNodeMatrix(n); buckets[n.bk].mesh.instanceMatrix.needsUpdate = true; } }
    const lf = 0.048 * Math.max(0.55, Math.min(2.6, cam.radius / (230 * SPREAD)));
    for (const n of NODES) { const L = n.label; if (L && L.visible) L.scale.set(L.userData.w * lf, L.userData.h * lf, 1); }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(loop);
  window.dispatchEvent(new Event('pm:ready'));
}
init().catch(err => { const l = $('loading'); if (l) l.innerHTML = `<b>American Power Map</b><span style="color:#ff8a8a">Could not load: ${esc(err.message)}</span>`; console.error(err); });
