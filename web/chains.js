/* Chain Studio — follow, discover, compare and save chains of power, drawn as a readable 2D diagram.
   Loaded after app.js (shares its globals: META, CATS, ETYPES, NODES, byId, state, addEdge, ensureArrows,
   applyVisibility, renderDetail, flyTo, esc). All data comes from the /api/findings and /api/chains routes. */
(function () {
  'use strict';
  const S = {
    tab: 'findings', findings: null, theme: 'All', current: null, results: [], resultsLabel: '',
    disc: { mode: 'top', preset: 'money-politics', from: null, to: null, dir: 'down', depth: 3, reported: true, directed: true },
    build: { ids: [], dir: 'down' },
  };
  const MY_KEY = 'pm_my_chains';
  let studio = null, toastTimer = null;

  // ---------- helpers ----------
  const fmt$ = v => { if (v == null || !isFinite(v)) return ''; const a = Math.abs(v); return '$' + (a >= 1e12 ? (v / 1e12).toFixed(2) + 'T' : a >= 1e9 ? (v / 1e9).toFixed(1) + 'B' : a >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : a >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : v.toFixed(0)); };
  const h = s => esc(s == null ? '' : String(s));
  const catHex = c => (CATS[c] && CATS[c].hex) || '#8a94a8';
  const typeHex = t => (ETYPES[t] && ETYPES[t].hex) || '#c48bff';
  async function api(path, opts) {
    const r = await fetch(path, opts);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || (r.status + ' ' + r.statusText));
    return j;
  }
  function toast(msg) { const t = document.getElementById('studioToast'); if (!t) return; t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600); }
  const myChains = () => { try { return JSON.parse(localStorage.getItem(MY_KEY) || '[]'); } catch { return []; } };
  const setMyChains = list => { try { localStorage.setItem(MY_KEY, JSON.stringify(list)); } catch { } };
  function basisShort(b) {
    b = String(b || '');
    if (/IRS Form 990/.test(b)) return 'revenue (IRS)';
    if (/13F institutional AUM/.test(b)) return '13F holdings';
    if (/13F institutional holdings/.test(b)) return 'held by institutions';
    if (/× 10/.test(b)) return 'budget × 10 yrs';
    if (/balance sheet/i.test(b)) return 'balance sheet';
    if (/receipts/.test(b)) return 'raised 2025-26';
    if (/political giving/.test(b)) return 'given 2025-26';
    if (/federal awards received/.test(b)) return 'federal awards';
    if (/grantmaking|grants/i.test(b)) return 'grants / yr';
    if (/revenue/i.test(b)) return 'revenue';
    if (/assets/i.test(b)) return 'assets';
    return b ? 'size' : '';
  }
  function hopVerb(hp) {
    const n = hp.note || '';
    if (/independent expenditures opposing/.test(n) && hp.t === 'K') return 'spends against';
    if (/independent expenditures supporting|in direct contributions/.test(n)) return /direct contributions/.test(n) && !/independent/.test(n) ? 'contributes to' : 'spends for';
    if (/whose own donors are undisclosed/.test(n)) return 'dark money to';
    if (/transferred committee to committee/.test(n)) return 'transfers to';
    if (/contract obligations/.test(n)) return 'contracts with';
    if (/grant obligations/.test(n)) return 'grants to';
    if (/13F filings/.test(n)) return 'owns stake in';
    if (/FEC Schedule A/.test(n)) return 'gives to';
    if (/Employer listed in FEC/.test(n)) return 'employs';
    if (hp.source === 'context') return /^Wholly owned/.test(n) ? 'owns and runs' : /^Lead member/.test(n) ? 'leads' : /^Partner/.test(n) ? 'partner in' : 'member of';
    return hp.verb || (ETYPES[hp.t] && ETYPES[hp.t].verb) || 'links to';
  }
  function hopAmount(hp) {
    if (hp.source === 'context') return { text: 'ownership link', kind: 'none' };
    if (!hp.est) return { text: fmt$(hp.amount), kind: 'reported' };
    if (hp.cited) return { text: 'cited ' + fmt$(hp.amount), kind: 'cited' };
    if (hp.value >= 1e6) return { text: '≈ ' + fmt$(hp.value) + ' est.', kind: 'est' };
    return { text: 'no $ figure', kind: 'none' };
  }
  function evidence(score) { const r = score.reportedHops, n = score.hops; return { text: `${r} of ${n} link${n === 1 ? '' : 's'} reported`, low: r < n }; }
  function chainPathHtml(c) { return c.nodes.map(n => `<span><i class="dot" style="--c:${catHex(n.c)}"></i> ${h(n.name)}</span>`).join('<em>→</em>'); }

  // ---------- DOM ----------
  function ensureStudio() {
    if (studio) return studio;
    studio = document.createElement('div'); studio.id = 'studio'; studio.hidden = true;
    studio.innerHTML = `
      <aside class="side">
        <div class="side-hd"><b>Power chains</b><button id="stClose" title="Back to the 3D map">3D map</button></div>
        <div class="tabs" role="tablist">
          <button data-tab="findings">Findings</button><button data-tab="discover">Discover</button><button data-tab="build">Build</button><button data-tab="saved">Saved</button>
        </div>
        <div class="pane" id="stPane"></div>
      </aside>
      <section class="main">
        <div class="main-hd" id="stHead"></div>
        <div class="canvas" id="stCanvas">
          <div class="zoombar"><button data-z="in" title="Zoom in">+</button><button data-z="out" title="Zoom out">−</button><button data-z="fit" title="Fit to screen">⤢</button></div>
          <svg id="stSvg" xmlns="http://www.w3.org/2000/svg"></svg>
          <div class="legend2" id="stLegend"></div>
          <div class="empty2" id="stEmpty"><div><b>Pick a chain to see it here</b>Open a finding, discover chains from any center, or build your own one link at a time.<br>Every link shows its dollar amount and where the figure comes from.</div></div>
        </div>
        <div id="studioToast" hidden></div>
      </section>`;
    document.getElementById('app').appendChild(studio);
    studio.querySelector('#stClose').onclick = close;
    studio.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { S.tab = b.dataset.tab; renderPane(); });
    studio.querySelector('.zoombar').onclick = e => { const z = e.target.closest('[data-z]'); if (!z) return; if (z.dataset.z === 'fit') fit(); else zoomBy(z.dataset.z === 'in' ? 0.8 : 1.25); };
    setupPanZoom();
    renderLegend();
    return studio;
  }
  function open(tab) { ensureStudio(); if (tab) S.tab = tab; studio.hidden = false; renderPane(); renderHead(); if (S.current) draw(); }
  function close() { if (studio) studio.hidden = true; if (location.hash.startsWith('#chain=') || location.hash.startsWith('#finding=')) history.replaceState(null, '', location.pathname); }

  // ---------- panes ----------
  function renderPane() {
    studio.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === S.tab));
    const pane = studio.querySelector('#stPane');
    if (S.tab === 'findings') return paneFindings(pane);
    if (S.tab === 'discover') return paneDiscover(pane);
    if (S.tab === 'build') return paneBuild(pane);
    return paneSaved(pane);
  }

  async function loadFindings() { if (!S.findings) S.findings = await api('/api/findings'); return S.findings; }
  async function paneFindings(pane) {
    pane.innerHTML = '<div class="hint">Loading findings…</div>';
    let data; try { data = await loadFindings(); } catch (e) { pane.innerHTML = `<div class="hint">Could not load findings: ${h(e.message)}</div>`; return; }
    const themes = ['All', ...new Set(data.findings.map(f => f.theme))];
    const list = data.findings.filter(f => S.theme === 'All' || f.theme === S.theme);
    pane.innerHTML = `<div class="hint">Chains identified by analyzing this map’s data, ranked by <b>influence score</b>: the smallest dollar link in the chain, with estimated links counted at ${Math.round(data.estDiscount * 100)}% so reported money ranks first. Data as of ${h(data.asof)}.</div>
      <div class="chipsx">${themes.map(t => `<button data-theme="${h(t)}" class="${t === S.theme ? 'on' : ''}">${h(t)}</button>`).join('')}</div>
      ${list.map(f => { const ev = evidence(f.score); return `<div class="card ${S.current && S.current.findingId === f.id ? 'on' : ''}" data-f="${h(f.id)}">
        <div class="k"><span>#${f.rank} · ${h(f.theme)}</span><span class="money">${fmt$(f.score.influence)}</span></div>
        <div class="t">${h(f.title)}</div>
        <div class="k"><span class="ev ${ev.low ? 'low' : ''}">${ev.text}</span><span>${f.chains.length} chain${f.chains.length > 1 ? 's' : ''}${f.score.reportedTotal ? ' · ' + fmt$(f.score.reportedTotal) + ' reported' : ''}</span></div>
      </div>`; }).join('')}`;
    pane.querySelectorAll('[data-theme]').forEach(b => b.onclick = () => { S.theme = b.dataset.theme; paneFindings(pane); });
    pane.querySelectorAll('[data-f]').forEach(c => c.onclick = () => showFinding(c.dataset.f));
  }
  async function showFinding(id) {
    const data = await loadFindings(); const f = data.findings.find(x => x.id === id); if (!f) return toast('That finding is not available');
    S.current = { kind: 'finding', findingId: f.id, title: f.title, summary: f.summary, theme: f.theme, rank: f.rank, total: data.findings.length, chains: f.chains, score: f.score };
    history.replaceState(null, '', '#finding=' + f.id);
    renderHead(); draw(); if (S.tab === 'findings') paneFindings(studio.querySelector('#stPane'));
  }

  function searchBox(holder, placeholder, onPick) {
    holder.innerHTML = `<div class="search"><input type="search" placeholder="${h(placeholder)}"><div class="res" hidden></div></div>`;
    const inp = holder.querySelector('input'), res = holder.querySelector('.res'); let timer = null, seq = 0, items = [];
    inp.oninput = () => { clearTimeout(timer); const q = inp.value.trim(); if (q.length < 2) { res.hidden = true; return; } timer = setTimeout(async () => {
      const my = ++seq; let list = []; try { list = await api('/api/search?q=' + encodeURIComponent(q)); } catch { }
      if (my !== seq) return; items = list.slice(0, 12);
      res.innerHTML = items.map((x, i) => `<div data-i="${i}"><i class="dot" style="--c:${catHex(x.c)}"></i>${h(x.name)}<span style="margin-left:auto;color:var(--faint);font-size:12px">${h(x.ind || '')}</span></div>`).join('') || '<div style="color:var(--muted)">No matches</div>';
      res.hidden = false; }, 180); };
    res.onclick = e => { const d = e.target.closest('[data-i]'); if (!d) return; const x = items[+d.dataset.i]; res.hidden = true; inp.value = ''; onPick({ id: x.id, name: x.name, c: x.c }); };
    inp.onkeydown = e => { if (e.key === 'Enter' && items[0] && !res.hidden) { res.hidden = true; inp.value = ''; onPick({ id: items[0].id, name: items[0].name, c: items[0].c }); } };
    inp.onblur = () => setTimeout(() => { res.hidden = true; }, 200);
  }
  const pickHtml = (x, role) => `<div class="pick"><i class="dot" style="--c:${catHex(x.c)}"></i><b>${h(x.name)}</b><button data-clear="${role}">change</button></div>`;

  async function paneDiscover(pane) {
    const D = S.disc;
    let presets = []; try { presets = await (S._presets || (S._presets = api('/api/chains/presets'))); } catch { }
    pane.innerHTML = `
      <div class="seg" style="margin-bottom:8px">${[['top', 'Top chains'], ['from', 'From a center'], ['between', 'Between two']].map(([k, l]) => `<button data-mode="${k}" class="${D.mode === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div id="dCtl"></div>
      <div class="row2" style="margin:8px 0"><button class="primary" id="dGo">Find chains</button><button id="dAll" ${S.results.length > 1 ? '' : 'hidden'}>Show all ${S.results.length} together</button></div>
      <div class="hint" id="dLabel">${h(S.resultsLabel)}</div>
      <div id="dRes"></div>`;
    pane.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { D.mode = b.dataset.mode; paneDiscover(pane); });
    const ctl = pane.querySelector('#dCtl');
    if (D.mode === 'top') {
      ctl.innerHTML = `<div class="field"><label>Flow type</label><select id="dPreset" style="width:100%">${presets.map(p => `<option value="${h(p.key)}" ${p.key === D.preset ? 'selected' : ''}>${h(p.label)}</option>`).join('')}</select></div><div class="hint" id="dDesc"></div>`;
      const sel = ctl.querySelector('#dPreset'); const desc = () => { const p = presets.find(x => x.key === sel.value); ctl.querySelector('#dDesc').textContent = p ? p.desc + (p.reportedOnly ? ' Only links with reported dollar amounts are used.' : '') : ''; };
      sel.onchange = () => { D.preset = sel.value; desc(); }; desc();
    } else if (D.mode === 'from') {
      ctl.innerHTML = `<div class="field"><label>Start at</label><div id="dFrom"></div></div>
        <div class="field"><label>Direction</label><div class="seg"><button data-dir="down" class="${D.dir === 'down' ? 'on' : ''}">What it controls or funds</button><button data-dir="up" class="${D.dir === 'up' ? 'on' : ''}">Who controls or funds it</button></div></div>
        <div class="field row2"><label style="margin:0">Max links</label><select id="dDepth">${[2, 3, 4, 5].map(n => `<option ${n === D.depth ? 'selected' : ''}>${n}</option>`).join('')}</select>
        <label style="margin:0 0 0 10px;display:inline-flex;gap:6px;align-items:center"><input type="checkbox" id="dRep" ${D.reported ? 'checked' : ''}> Reported $ only</label></div>`;
      if (D.from) { ctl.querySelector('#dFrom').innerHTML = pickHtml(D.from, 'from'); } else searchBox(ctl.querySelector('#dFrom'), 'Search a company, agency, PAC, person…', x => { D.from = x; paneDiscover(pane); });
      ctl.querySelectorAll('[data-dir]').forEach(b => b.onclick = () => { D.dir = b.dataset.dir; paneDiscover(pane); });
      ctl.querySelector('#dDepth').onchange = e => { D.depth = +e.target.value; };
      ctl.querySelector('#dRep').onchange = e => { D.reported = e.target.checked; };
    } else {
      ctl.innerHTML = `<div class="field"><label>From</label><div id="dA"></div></div><div class="field"><label>To</label><div id="dB"></div></div>
        <label style="display:inline-flex;gap:6px;align-items:center;font-size:13px;color:var(--muted)"><input type="checkbox" id="dDir" ${D.directed ? 'checked' : ''}> Follow the direction of power (uncheck for any connection)</label>`;
      if (D.from) ctl.querySelector('#dA').innerHTML = pickHtml(D.from, 'from'); else searchBox(ctl.querySelector('#dA'), 'Search the starting center…', x => { D.from = x; paneDiscover(pane); });
      if (D.to) ctl.querySelector('#dB').innerHTML = pickHtml(D.to, 'to'); else searchBox(ctl.querySelector('#dB'), 'Search the end center…', x => { D.to = x; paneDiscover(pane); });
      ctl.querySelector('#dDir').onchange = e => { D.directed = e.target.checked; };
    }
    ctl.querySelectorAll('[data-clear]').forEach(b => b.onclick = () => { D[b.dataset.clear] = null; paneDiscover(pane); });
    pane.querySelector('#dGo').onclick = () => runDiscover(pane);
    pane.querySelector('#dAll').onclick = () => { S.current = { kind: 'results', title: S.resultsLabel, chains: S.results, score: combinedScore(S.results) }; renderHead(); draw(); };
    renderResults(pane);
  }
  async function runDiscover(pane) {
    const D = S.disc; const lab = pane.querySelector('#dLabel'); lab.textContent = 'Searching the map…';
    try {
      let r, label;
      if (D.mode === 'top') { r = await api(`/api/chains/top?preset=${encodeURIComponent(D.preset)}&limit=30`); const p = (S._presetList || (await S._presets)).find?.(x => x.key === D.preset); label = `Top chains: ${p ? p.label : D.preset}`; }
      else if (D.mode === 'from') { if (!D.from) { lab.textContent = 'Pick a starting center first.'; return; } r = await api(`/api/chains/from/${encodeURIComponent(D.from.id)}?dir=${D.dir}&depth=${D.depth}&k=15${D.reported ? '&reported=1' : ''}`); label = `${D.dir === 'down' ? 'Chains from' : 'Chains into'} ${D.from.name}${D.reported ? ' (reported $ only)' : ''}`; }
      else { if (!D.from || !D.to) { lab.textContent = 'Pick both ends first.'; return; } r = await api(`/api/chains/between?from=${encodeURIComponent(D.from.id)}&to=${encodeURIComponent(D.to.id)}&k=8&directed=${D.directed ? 1 : 0}`); label = `Chains from ${D.from.name} to ${D.to.name}`; }
      S.results = r.chains || []; S.resultsLabel = S.results.length ? `${label} · ${S.results.length} found, ranked by influence` : `${label}: no chains found.${D.mode === 'from' && D.reported ? ' Try unchecking “Reported $ only”.' : ''}`;
      paneDiscover(pane);
      if (S.results[0]) showChainList([S.results[0]], { title: label, kind: 'results' });
    } catch (e) { lab.textContent = 'Search failed: ' + e.message; }
  }
  function renderResults(pane) {
    const box = pane.querySelector('#dRes'); if (!box) return;
    box.innerHTML = S.results.map((c, i) => { const ev = evidence(c.score); return `<div class="card" data-r="${i}">
      <div class="k"><span>#${i + 1} · ${c.hops.length} link${c.hops.length > 1 ? 's' : ''}</span><span class="money">${fmt$(c.score.influence)}</span></div>
      <div class="path">${chainPathHtml(c)}</div>
      <div class="k" style="margin-top:4px"><span class="ev ${ev.low ? 'low' : ''}">${ev.text}</span><button data-build="${i}" style="padding:1px 8px;font-size:12px">Edit in builder</button></div></div>`; }).join('');
    box.querySelectorAll('[data-r]').forEach(c => c.onclick = e => { if (e.target.closest('[data-build]')) return; const ch = S.results[+c.dataset.r]; showChainList([ch], { title: S.resultsLabel.split(' · ')[0], kind: 'results' }); });
    box.querySelectorAll('[data-build]').forEach(b => b.onclick = () => { const ch = S.results[+b.dataset.build]; S.build.ids = ch.nodes.map(n => n.id); S.tab = 'build'; renderPane(); refreshBuild(); });
  }
  function combinedScore(chains) { const seen = new Set(); let hops = 0, rep = 0, tot = 0; for (const c of chains) for (const hp of c.hops) { const k = hp.src + '>' + hp.dst; if (seen.has(k)) continue; seen.add(k); hops++; if (!hp.est) { rep++; tot += hp.amount; } } return { influence: Math.max(0, ...chains.map(c => c.score.influence)), hops, reportedHops: rep, reportedTotal: tot }; }
  function showChainList(chains, meta) { S.current = Object.assign({ chains, score: chains.length === 1 ? chains[0].score : combinedScore(chains) }, meta); history.replaceState(null, '', location.pathname); renderHead(); draw(); }

  // ----- builder -----
  async function paneBuild(pane) {
    const B = S.build;
    pane.innerHTML = `<div class="hint">Follow power one link at a time. Pick a starting center, then choose the next link from the strongest connections, ranked by dollars.</div>
      ${B.ids.length ? '' : '<div class="field"><label>Start at</label><div id="bStart"></div></div>'}
      <div class="steps" id="bSteps"></div>
      ${B.ids.length ? `<div class="field"><label>Next link</label><div class="seg"><button data-bd="down" class="${B.dir === 'down' ? 'on' : ''}">Follow from the last center</button><button data-bd="up" class="${B.dir === 'up' ? 'on' : ''}">Trace back from the first</button></div></div><div id="bSugg"><div class="hint">Loading connections…</div></div>` : ''}
      ${B.ids.length >= 2 ? `<div class="field" style="margin-top:12px"><label>Save this chain</label><input type="text" id="bTitle" maxlength="120" placeholder="Title (required)"><textarea id="bNotes" maxlength="2000" placeholder="Notes (optional)" style="margin-top:6px"></textarea>
        <div class="row2" style="margin-top:6px"><button class="primary" id="bSave">Save & get link</button><button id="bClear">Start over</button></div><div id="bShare"></div></div>` : (B.ids.length ? '<div class="row2" style="margin-top:8px"><button id="bClear">Start over</button></div>' : '')}`;
    if (!B.ids.length) searchBox(pane.querySelector('#bStart'), 'Search a company, agency, PAC, person…', x => { B.ids = [x.id]; paneBuild(pane); refreshBuild(); });
    pane.querySelectorAll('[data-bd]').forEach(b => b.onclick = () => { B.dir = b.dataset.bd; paneBuild(pane); });
    const clr = pane.querySelector('#bClear'); if (clr) clr.onclick = () => { B.ids = []; S.current = null; renderHead(); draw(); paneBuild(pane); };
    const sv = pane.querySelector('#bSave'); if (sv) sv.onclick = () => saveBuild(pane);
    renderSteps(pane);
    if (B.ids.length) loadSuggestions(pane);
  }
  function renderSteps(pane) {
    const B = S.build, box = pane.querySelector('#bSteps'); if (!box) return;
    const ch = S.current && S.current.kind === 'build' ? S.current.chains[0] : null;
    box.innerHTML = B.ids.map((id, i) => { const n = (ch && ch.nodes[i]) || byId[id] || { name: id }; const hp = ch && i > 0 ? ch.hops[i - 1] : null; const amt = hp ? hopAmount(hp) : null;
      return `<div class="step"><span class="nm"><i class="dot" style="--c:${catHex(n.c)}"></i> ${h(n.name || n.n)}${hp ? `<span class="via">${h(hopVerb(hp))} · <span class="${amt.kind === 'reported' ? 'money' : ''}">${h(amt.text)}</span></span>` : ''}</span>${i === 0 || i === B.ids.length - 1 ? `<button data-rm="${i}" title="Remove">×</button>` : ''}</div>`; }).join('');
    box.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { const i = +b.dataset.rm; if (i === 0) B.ids.shift(); else B.ids.pop(); paneBuild(pane); refreshBuild(); });
  }
  async function loadSuggestions(pane) {
    const B = S.build, box = pane.querySelector('#bSugg'); if (!box) return;
    const anchor = B.dir === 'down' ? B.ids[B.ids.length - 1] : B.ids[0];
    let r; try { r = await api(`/api/chains/next/${encodeURIComponent(anchor)}?dir=${B.dir}&limit=16&exclude=${encodeURIComponent(B.ids.join(','))}`); } catch (e) { box.innerHTML = `<div class="hint">${h(e.message)}</div>`; return; }
    if (!r.steps.length) { box.innerHTML = `<div class="hint">No further ${B.dir === 'down' ? 'outgoing' : 'incoming'} links from here.</div>`; return; }
    box.innerHTML = r.steps.map((s, i) => { const amt = hopAmount(s); return `<div class="sugg" data-s="${i}"><span><i class="dot" style="--c:${catHex(s.c)}"></i> ${h(s.name)}</span><span class="${amt.kind === 'reported' ? 'money' : ''}" style="font-size:12.5px">${h(amt.text)}</span><span class="v">${h(B.dir === 'down' ? hopVerb(s) : 'which ' + hopVerb(s) + ' this')}${s.note ? ' · ' + h(s.note.slice(0, 90)) : ''}</span></div>`; }).join('');
    box.querySelectorAll('[data-s]').forEach(d => d.onclick = () => { const s = r.steps[+d.dataset.s]; if (B.dir === 'down') B.ids.push(s.id); else B.ids.unshift(s.id); paneBuild(pane); refreshBuild(); });
  }
  async function refreshBuild() {
    const B = S.build;
    if (B.ids.length < 2) { if (B.ids.length === 1) { const n = byId[B.ids[0]]; S.current = { kind: 'build', title: 'New chain', chains: [{ nodes: [{ id: n.id, name: n.n, c: n.c, s: n.s, ind: n.ind, p: n.p, funding: n.funding }], hops: [], score: { influence: 0, hops: 0, reportedHops: 0 } }], score: { influence: 0, hops: 0, reportedHops: 0 } }; } renderHead(); draw(); return; }
    try { const r = await api('/api/chains/resolve?ids=' + encodeURIComponent(B.ids.join(','))); const ch = r.chains[0]; if (ch.error) throw new Error(ch.error);
      S.current = { kind: 'build', title: 'New chain', chains: [ch], score: ch.score }; renderHead(); draw(); const pane = studio.querySelector('#stPane'); if (S.tab === 'build') renderSteps(pane);
    } catch (e) { toast(e.message); }
  }
  async function saveBuild(pane) {
    const title = pane.querySelector('#bTitle').value.trim(), notes = pane.querySelector('#bNotes').value;
    if (!title) { toast('Give the chain a title first'); return; }
    try {
      const r = await api('/api/chains', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, notes, ids: S.build.ids }) });
      const list = myChains(); list.unshift({ id: r.id, title, editKey: r.editKey, saved: new Date().toISOString() }); setMyChains(list);
      const link = location.origin + location.pathname + '#chain=' + r.id;
      pane.querySelector('#bShare').innerHTML = `<div class="sharebox">Saved. Share link:<br><b>${h(link)}</b><div class="row2" style="margin-top:6px"><button id="bCopy">Copy link</button></div></div>`;
      pane.querySelector('#bCopy').onclick = () => copy(link);
      S.current.title = title; S.current.notes = notes; S.current.savedId = r.id; renderHead();
    } catch (e) { toast('Save failed: ' + e.message); }
  }

  // ----- saved -----
  function paneSaved(pane) {
    const list = myChains();
    pane.innerHTML = `<div class="hint">Chains you save are stored on the server with a shareable link. This browser keeps the private edit key that lets you rename or delete them.</div>
      <div class="field"><label>Open a shared chain</label><div class="row2"><input type="text" id="sOpen" placeholder="Paste a link or chain id" style="flex:1"><button id="sGo">Open</button></div></div>
      <div class="field"><label>My saved chains (${list.length})</label></div>
      ${list.length ? list.map((c, i) => `<div class="card" data-o="${i}"><div class="t">${h(c.title)}</div><div class="k"><span>${new Date(c.saved).toLocaleDateString()}</span><span><button data-ren="${i}" style="padding:1px 8px;font-size:12px">Rename</button> <button data-del="${i}" style="padding:1px 8px;font-size:12px">Delete</button></span></div></div>`).join('') : '<div class="hint">Nothing saved yet. Build a chain, or open any finding or discovery result and save it.</div>'}`;
    pane.querySelector('#sGo').onclick = () => { const v = pane.querySelector('#sOpen').value.trim(); const m = v.match(/chain=([A-Za-z0-9]+)/) || v.match(/^([A-Za-z0-9]{6,})$/); if (m) loadSaved(m[1]); else toast('That does not look like a chain link'); };
    pane.querySelectorAll('[data-o]').forEach(c => c.onclick = e => { if (e.target.closest('button')) return; loadSaved(list[+c.dataset.o].id); });
    pane.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { const c = list[+b.dataset.del]; if (!confirm(`Delete “${c.title}”? The share link will stop working.`)) return;
      try { await api('/api/chains/saved/' + c.id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + c.editKey } }); } catch (e) { if (!/no saved chain/.test(e.message)) { toast('Delete failed: ' + e.message); return; } }
      setMyChains(list.filter(x => x.id !== c.id)); paneSaved(pane); toast('Deleted'); });
    pane.querySelectorAll('[data-ren]').forEach(b => b.onclick = async () => { const c = list[+b.dataset.ren]; const t = prompt('New title', c.title); if (!t || !t.trim()) return;
      try { await api('/api/chains/saved/' + c.id, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + c.editKey }, body: JSON.stringify({ title: t.trim() }) }); c.title = t.trim(); setMyChains(list); paneSaved(pane); } catch (e) { toast('Rename failed: ' + e.message); } });
  }
  async function loadSaved(id) {
    ensureStudio();
    try { const r = await api('/api/chains/saved/' + encodeURIComponent(id)); const good = r.chains.filter(c => !c.error);
      if (!good.length) throw new Error('its links no longer exist in the current data');
      S.current = { kind: 'saved', savedId: r.id, title: r.title, summary: r.notes, chains: good, score: good.length === 1 ? good[0].score : combinedScore(good), created: r.created };
      history.replaceState(null, '', '#chain=' + r.id); open(); renderHead(); draw();
    } catch (e) { open(); toast('Could not open that chain: ' + e.message); }
  }

  // ---------- header ----------
  function renderHead() {
    const head = studio && studio.querySelector('#stHead'); if (!head) return;
    const C = S.current;
    if (!C) { head.innerHTML = `<div class="meta">2D chain view</div><h2>Follow the money and the power</h2><p>Every link is labeled with its dollar amount: <b>reported</b> figures come straight from FEC, USAspending, SEC 13F and IRS filings, and anything else is a clearly marked estimate.</p>`; return; }
    const ev = evidence(C.score);
    const metaBits = [C.theme ? `<span class="theme">${h(C.theme)}</span>` : '', C.rank ? `<span>Finding #${C.rank} of ${C.total}</span>` : '', C.kind === 'saved' ? '<span class="theme">Saved chain</span>' : '', C.kind === 'build' ? '<span class="theme">Builder</span>' : '',
      C.score.influence ? `<span class="score" title="The smallest dollar link in the chain; estimated links count at a fraction of their value so reported money ranks first">Influence score <b>${fmt$(C.score.influence)}</b></span>` : '', C.score.hops ? `<span class="ev ${ev.low ? 'low' : ''}">${ev.text}</span>` : '', C.score.reportedTotal ? `<span>${fmt$(C.score.reportedTotal)} in reported flows</span>` : ''].filter(Boolean).join('');
    head.innerHTML = `<div class="meta">${metaBits}</div><h2>${h(C.title || 'Chain')}</h2>${C.summary ? `<p>${h(C.summary)}</p>` : ''}
      <div class="acts"><button id="hd3d">Show in 3D map</button><button id="hdPng">Download PNG</button><button id="hdSvg">Download SVG</button>${C.kind === 'finding' || C.kind === 'saved' ? '<button id="hdLink">Copy link</button>' : ''}${C.chains.length === 1 && C.kind !== 'build' ? '<button id="hdEdit">Edit in builder</button>' : ''}${C.kind !== 'build' && C.kind !== 'saved' ? '<button id="hdSave">Save a copy</button>' : ''}</div>`;
    const sp = head.querySelector('p'); if (sp) sp.onclick = () => sp.classList.toggle('open');
    head.querySelector('#hd3d').onclick = showIn3D;
    head.querySelector('#hdPng').onclick = () => exportImage('png');
    head.querySelector('#hdSvg').onclick = () => exportImage('svg');
    const lk = head.querySelector('#hdLink'); if (lk) lk.onclick = () => copy(location.origin + location.pathname + (C.kind === 'finding' ? '#finding=' + C.findingId : '#chain=' + C.savedId));
    const ed = head.querySelector('#hdEdit'); if (ed) ed.onclick = () => { S.build.ids = C.chains[0].nodes.map(n => n.id); S.tab = 'build'; renderPane(); refreshBuild(); };
    const sv = head.querySelector('#hdSave'); if (sv) sv.onclick = () => saveCopy();
  }
  async function saveCopy() {
    const C = S.current; const title = prompt('Title for your saved copy', C.title || 'My chain'); if (!title) return;
    try { const r = await api('/api/chains', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, notes: C.summary || '', chains: C.chains.slice(0, 8).map(c => c.nodes.map(n => n.id)) }) });
      const list = myChains(); list.unshift({ id: r.id, title, editKey: r.editKey, saved: new Date().toISOString() }); setMyChains(list);
      copy(location.origin + location.pathname + '#chain=' + r.id, 'Saved. Share link copied');
    } catch (e) { toast('Save failed: ' + e.message); }
  }
  async function copy(text, msg) { try { await navigator.clipboard.writeText(text); toast(msg || 'Link copied'); } catch { prompt('Copy this link', text); } }

  // ---------- 2D diagram ----------
  const CW = 240, CH = 96, GX = 170, GY = 30, GXV = 110, GYV = 24, PAD = 40, LANE = 44, LIST_X = 56, LIST_GAP = 50;
  let V = false, narrowAtDraw = false; // vertical (top-to-bottom) layout, used on narrow screens
  let vb = { x: 0, y: 0, w: 1000, h: 600 }, content = { w: 1000, h: 600 };
  // Columns run left to right on wide screens; on narrow screens (phones) the chain flows top to bottom instead.
  function layout(chains, vertical) {
    const nodes = new Map(), succ = new Map(), edges = new Map();
    for (const c of chains) {
      c.nodes.forEach(n => { if (!nodes.has(n.id)) nodes.set(n.id, { ...n, order: nodes.size }); if (!succ.has(n.id)) succ.set(n.id, new Set()); });
      c.hops.forEach((hp, i) => { const a = c.nodes[i].id, b = c.nodes[i + 1].id; succ.get(a).add(b); const k = a + '>' + b; if (!edges.has(k)) edges.set(k, { a, b, hop: hp }); });
    }
    // longest-path layering over the chain-order graph (cycles are cut by the visiting set)
    const layer = new Map(), visiting = new Set();
    const preds0 = new Map([...nodes.keys()].map(k => [k, []])); for (const [a, s] of succ) for (const b of s) preds0.get(b).push(a);
    const depth = (id) => { if (layer.has(id)) return layer.get(id); if (visiting.has(id)) return 0; visiting.add(id); let d = 0; for (const p of preds0.get(id)) d = Math.max(d, depth(p) + 1); visiting.delete(id); layer.set(id, d); return d; };
    for (const id of nodes.keys()) depth(id);
    // links that skip columns get a "lane" (dummy item) in every column they cross, so they never run behind a card
    const items = new Map(); for (const [id, n] of nodes) items.set(id, { id, real: true, order: n.order });
    const up = new Map(), down = new Map(); const link = (a, b) => { (down.get(a) || down.set(a, []).get(a)).push(b); (up.get(b) || up.set(b, []).get(b)).push(a); };
    for (const e of edges.values()) {
      const la = layer.get(e.a), lb = layer.get(e.b); e.lanes = [];
      if (lb - la > 1) { let prev = e.a; for (let l = la + 1; l < lb; l++) { const d = `~${e.a}>${e.b}@${l}`; items.set(d, { id: d, real: false, order: nodes.get(e.a).order + 0.5 }); layer.set(d, l); link(prev, d); e.lanes.push(d); prev = d; } link(prev, e.b); }
      else if (lb > la) link(e.a, e.b);
    }
    const layers = []; for (const [id, l] of layer) (layers[l] = layers[l] || []).push(id);
    for (let l = 0; l < layers.length; l++) layers[l] = (layers[l] || []).sort((x, y) => items.get(x).order - items.get(y).order);
    // barycenter sweeps to reduce crossings
    const pos = new Map(); const setPos = () => layers.forEach(L => L.forEach((id, i) => pos.set(id, i)));
    const bary = (id, m) => { const ns = m.get(id) || []; return ns.length ? ns.reduce((s, p) => s + pos.get(p), 0) / ns.length : pos.get(id); };
    setPos();
    for (let sweep = 0; sweep < 6; sweep++) {
      for (let l = 1; l < layers.length; l++) { layers[l].sort((x, y) => bary(x, up) - bary(y, up)); setPos(); }
      for (let l = layers.length - 2; l >= 0; l--) { layers[l].sort((x, y) => bary(x, down) - bary(y, down)); setPos(); }
    }
    // "across" = the axis items in one column share; "along" = the direction of flow
    const acrossOf = id => items.get(id).real ? (vertical ? CW : CH) : LANE;
    const colSpan = L => L.reduce((s, id) => s + acrossOf(id), 0) + Math.max(0, L.length - 1) * (vertical ? GYV : GY);
    // phones: a wide column of end points (all 51 states) becomes a vertical list under its source instead of a row
    const isList = L => vertical && L.length > 3 && L.every(id => items.get(id).real && !(down.get(id) || []).length);
    const listMode = layers.map(isList);
    const span = Math.max(vertical ? CW : CH, ...layers.map((L, l) => listMode[l] ? LIST_X + CW : colSpan(L)));
    const extent = (L, l) => listMode[l] ? L.length * (CH + LIST_GAP) - LIST_GAP : (vertical ? CH : CW);
    const at = new Map();
    const tall = !vertical && span > 1800; // very tall fans (all 51 states): pin short columns to the top so the source is on screen first
    let pos0 = PAD;
    layers.forEach((L, l) => {
      if (listMode[l]) { let y = pos0; for (const id of L) { at.set(id, { x: PAD + LIST_X, y, w: CW, h: CH, list: true }); y += CH + LIST_GAP; } }
      else { let a = PAD + (tall ? 0 : (span - colSpan(L)) / 2); for (const id of L) { const s = acrossOf(id), real = items.get(id).real; at.set(id, vertical ? { x: a, y: pos0, w: s, h: CH } : { x: pos0, y: a, w: CW, h: real ? CH : s }); a += s + (vertical ? GYV : GY); } }
      pos0 += extent(L, l) + (vertical ? GXV : GX);
    });
    for (const [id, n] of nodes) Object.assign(n, at.get(id));
    for (const e of edges.values()) e.lanePos = e.lanes.map(d => at.get(d));
    const along = pos0 - (vertical ? GXV : GX) + PAD, across = PAD * 2 + span;
    content = vertical ? { w: across, h: along } : { w: along, h: across };
    return { nodes, edges, maxLayer: Math.max(1, ...layers.map(L => L.filter(id => items.get(id).real).length)) };
  }
  function wrap(text, max, lines) { const words = String(text).split(/\s+/); const out = []; let cur = ''; for (const w of words) { if ((cur + ' ' + w).trim().length > max) { if (cur) out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); if (out.length === lines) break; } if (out.length < lines && cur) out.push(cur); if (out.length === lines && words.join(' ').length > out.join(' ').length) out[lines - 1] = out[lines - 1].replace(/.{0,2}$/, '…'); return out.slice(0, lines); }
  function draw() {
    if (!studio) return;
    const svg = studio.querySelector('#stSvg'), empty = studio.querySelector('#stEmpty');
    const C = S.current;
    if (!C || !C.chains.length) { svg.innerHTML = ''; empty.hidden = false; return; }
    empty.hidden = true;
    // top-to-bottom on phones, unless a column is too wide for that (e.g. 51 states): then left-to-right and scroll
    narrowAtDraw = studio.querySelector('#stCanvas').clientWidth < 700;
    let L = layout(C.chains, false); V = false;
    if (narrowAtDraw) { V = true; L = layout(C.chains, true); }
    const outN = {}, inN = {}; for (const e of L.edges.values()) { outN[e.a] = (outN[e.a] || 0) + 1; inN[e.b] = (inN[e.b] || 0) + 1; }
    const defs = Object.keys(ETYPES).map(t => `<marker id="ar-${t}" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="15" markerHeight="15" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${typeHex(t)}"/></marker>`).join('');
    let edgesSvg = '', labelsSvg = '';
    const labels = [];
    for (const e of L.edges.values()) {
      const A = L.nodes.get(e.a), B = L.nodes.get(e.b), hp = e.hop;
      const amt = hopAmount(hp), col = typeHex(hp.t);
      const wv = hp.est ? 1.6 : Math.max(1.8, Math.min(7, 1.8 + 1.1 * (Math.log10(Math.max(hp.value, 1)) - 5)));
      const marker = hp.forward ? `marker-end="url(#ar-${hp.t})"` : `marker-start="url(#ar-${hp.t})"`;
      // route: source card -> each lane it crosses (straight through the column) -> target card
      const exitOf = n => V ? [n.x + n.w / 2, n.y + n.h] : [n.x + n.w, n.y + n.h / 2], entryOf = n => V ? [n.x + n.w / 2, n.y] : [n.x, n.y + n.h / 2];
      const pts = [exitOf(A)]; for (const p of e.lanePos) pts.push(entryOf(p), exitOf(p)); pts.push(entryOf(B));
      const back = V ? B.y <= A.y : B.x <= A.x;
      let d = `M${pts[0][0]},${pts[0][1]}`, mx, my;
      if (back) { // a cycle sends this link backwards: loop it around the outside
        const [x1, y1] = pts[0], [x2, y2] = pts[pts.length - 1];
        if (V) { const side = Math.max(A.x + A.w, B.x + B.w) + 60; d += ` C${x1},${y1 + 80} ${side},${y1 + 80} ${side},${(y1 + y2) / 2} S${x2},${y2 - 80} ${x2},${y2}`; mx = side; my = (y1 + y2) / 2; }
        else { const lift = Math.min(A.y, B.y) - 50; d += ` C${x1 + 90},${y1} ${x1 + 90},${lift} ${(x1 + x2) / 2},${lift} S${x2 - 90},${y2} ${x2},${y2}`; mx = (x1 + x2) / 2; my = lift; }
      } else {
        for (let i = 0; i + 1 < pts.length; i += 2) {
          const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
          d += V ? ` C${x1},${y1 + (y2 - y1) / 2} ${x2},${y2 - (y2 - y1) / 2} ${x2},${y2}` : ` C${x1 + (x2 - x1) / 2},${y1} ${x2 - (x2 - x1) / 2},${y2} ${x2},${y2}`;
          if (i + 2 < pts.length) d += ` L${pts[i + 2][0]},${pts[i + 2][1]}`;
        }
        mx = (pts[0][0] + pts[1][0]) / 2; my = (pts[0][1] + pts[1][1]) / 2; // label sits in the first gap, on the curve
      }
      if (V && B.list && !back) {
        d = `M${pts[0][0]},${pts[0][1]}`;
        for (let i = 0; i + 3 < pts.length; i += 2) { const [x1, y1] = pts[i], [x2, y2] = pts[i + 1]; d += ` C${x1},${y1 + (y2 - y1) / 2} ${x2},${y2 - (y2 - y1) / 2} ${x2},${y2} L${pts[i + 2][0]},${pts[i + 2][1]}`; }
        const [sx, sy] = pts[pts.length - 2], tx = PAD + 26, by = B.y + CH / 2;
        d += ` C${sx},${sy + 30} ${tx},${sy + 10} ${tx},${sy + 50} L${tx},${by - 14} Q${tx},${by} ${tx + 14},${by} L${B.x},${by}`;
      }
      const fanOut = !B.list && outN[e.a] >= 4 && inN[e.b] < 4, fanIn = inN[e.b] >= 4 && outN[e.a] < 4; // big fans: pin the label beside the lone end
      const tip = `<title>${h(hp.note || '')}${hp.basis ? '\nSource: ' + h(hp.basis) : ''}</title>`;
      edgesSvg += `<path d="${d}" fill="none" stroke="${col}" stroke-width="${wv.toFixed(1)}" ${hp.est ? 'stroke-dasharray="6 5"' : ''} opacity="${amt.kind === 'none' ? 0.55 : 0.92}" ${marker}>${tip}</path>`;
      const verb = hopVerb(hp) + (hp.forward ? (V ? ' ↓' : ' →') : (V ? ' ↑' : ' ←'));
      const lw = Math.max(amt.text.length * 7.8, verb.length * 6.7) + 20;
      if (V && B.list && !back) { mx = B.x + CW - lw / 2; my = B.y - 25; }
      else if (!back && fanOut) { const [ex, ey] = pts[pts.length - 1]; if (V) { mx = ex; my = ey - 30; } else { mx = ex - lw / 2 - 22; my = ey; } }
      else if (!back && fanIn) { const [sx, sy] = pts[0]; if (V) { mx = sx; my = sy + 30; } else { mx = sx + lw / 2 + 16; my = sy; } }
      labels.push({ gap: V && B.list ? 'L' + e.b : Math.round(V ? my : mx), x: mx, y: my, lw, html: (x, y) => `<g transform="translate(${x - lw / 2},${y - 20})">${tip}<rect width="${lw}" height="40" rx="8" fill="#0f1622" stroke="${col}" stroke-opacity=".7"/>
        <text x="${lw / 2}" y="17" text-anchor="middle" font-size="14" font-weight="700" fill="${amt.kind === 'reported' ? '#ffd76a' : amt.kind === 'none' ? '#8f9ab0' : '#e8c88a'}" ${amt.kind === 'est' || amt.kind === 'cited' ? 'font-style="italic"' : ''}>${h(amt.text)}</text>
        <text x="${lw / 2}" y="32" text-anchor="middle" font-size="11.5" fill="#b9c4d8">${h(verb)}</text></g>` });
    }
    // keep labels in the same gap from overlapping: push apart along the column, then re-centre the group
    const key = V ? 'x' : 'y', gapOf = (a, b) => V ? a.lw / 2 + b.lw / 2 + 8 : 46;
    const gaps = new Map(); for (const lb of labels) (gaps.get(lb.gap) || gaps.set(lb.gap, []).get(lb.gap)).push(lb);
    for (const list of gaps.values()) {
      list.sort((a, b) => a[key] - b[key]); const orig = list.reduce((s, l) => s + l[key], 0);
      for (let i = 1; i < list.length; i++) list[i][key] = Math.max(list[i][key], list[i - 1][key] + gapOf(list[i - 1], list[i]));
      const shift = (orig - list.reduce((s, l) => s + l[key], 0)) / list.length;
      for (const l of list) l[key] += shift;
      for (let i = 1; i < list.length; i++) list[i][key] = Math.max(list[i][key], list[i - 1][key] + gapOf(list[i - 1], list[i]));
    }
    for (const lb of labels) labelsSvg += lb.html(lb.x, lb.y);
    let nodesSvg = '';
    for (const n of L.nodes.values()) {
      const lines = wrap(n.name, 27, 2), col = catHex(n.c);
      const fund = n.funding ? `${fmt$(n.funding)}${basisShort(n.fundingBasis) ? ' · ' + basisShort(n.fundingBasis) : ''}` : '';
      const sub = [n.ind, n.s].filter(Boolean).join(' · ');
      nodesSvg += `<g class="nd" data-id="${h(n.id)}" transform="translate(${n.x},${n.y})" style="cursor:pointer"><title>${h(n.name)}${fund ? '\n' + h(fund) : ''}\nClick to open in the 3D map</title>
        <rect width="${CW}" height="${CH}" rx="10" fill="#172030" stroke="#33415a"/><rect width="6" height="${CH}" rx="3" fill="${col}"/>
        ${lines.map((ln, i) => `<text x="16" y="${23 + i * 18}" font-size="14.5" font-weight="650" fill="#eef2f8">${h(ln)}</text>`).join('')}
        <text x="16" y="${lines.length > 1 ? 61 : 43}" font-size="11.5" fill="#8f9ab0">${h(sub.length > 36 ? sub.slice(0, 35) + '…' : sub)}</text>
        ${fund ? `<rect x="12" y="${CH - 25}" width="${Math.min(CW - 24, fund.length * 6.7 + 14)}" height="18" rx="9" fill="#24304a"/><text x="19" y="${CH - 12}" font-size="11.5" fill="#d6def0">${h(fund)}</text>` : ''}</g>`;
    }
    svg.innerHTML = `<defs>${defs}</defs><g id="stWorld">${edgesSvg}${nodesSvg}${labelsSvg}</g>`;
    svg.querySelectorAll('.nd').forEach(g => g.addEventListener('click', () => { if (dragMoved) return; const n = byId[g.dataset.id]; if (n) { close(); select(n, true); } }));
    fit();
  }
  function applyVb() { const svg = studio.querySelector('#stSvg'); svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`); }
  function fit() { const cv = studio.querySelector('#stCanvas'); const W = cv.clientWidth || 1000, H = cv.clientHeight || 600; if (V) { const s = Math.max(content.w / W, 0.8); vb = { w: W * s, h: H * s, x: (content.w - W * s) / 2, y: content.h <= H * s ? (content.h - H * s) / 2 : 0 }; return applyVb(); } const sAll = Math.max(content.w / W, content.h / (H - 50), 0.8); if (sAll > 1.6) { const s = Math.min(1.6, Math.max(content.w / W, 0.8)); vb = { w: W * s, h: H * s, x: content.w <= W * s ? (content.w - W * s) / 2 : 0, y: -10 * s }; return applyVb(); } const s = sAll; vb = { w: W * s, h: H * s, x: (content.w - W * s) / 2, y: (content.h - H * s) / 2 - 10 * s }; applyVb(); }
  function zoomBy(f, cx, cy) { const nx = cx ?? vb.x + vb.w / 2, ny = cy ?? vb.y + vb.h / 2; const w = Math.max(200, Math.min(content.w * 6 + 2000, vb.w * f)), k = w / vb.w; vb = { x: nx - (nx - vb.x) * k, y: ny - (ny - vb.y) * k, w, h: vb.h * k }; applyVb(); }
  let dragMoved = false;
  function setupPanZoom() {
    const cv = studio.querySelector('#stCanvas'); let drag = null;
    const toWorld = (ev) => { const r = cv.getBoundingClientRect(); return { x: vb.x + (ev.clientX - r.left) / r.width * vb.w, y: vb.y + (ev.clientY - r.top) / r.height * vb.h }; };
    cv.addEventListener('wheel', ev => { ev.preventDefault(); if (ev.ctrlKey || ev.metaKey) { const p = toWorld(ev); zoomBy(Math.pow(1.004, ev.deltaY), p.x, p.y); return; } const r = cv.getBoundingClientRect(), k = vb.w / r.width; vb.x += (ev.shiftKey && !ev.deltaX ? ev.deltaY : ev.deltaX) * k; vb.y += (ev.shiftKey && !ev.deltaX ? 0 : ev.deltaY) * k; applyVb(); }, { passive: false });
    const touches = new Map(); let pinch = null;
    const pinchState = () => { const [a, b] = [...touches.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), m: toWorld({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 }) }; };
    cv.addEventListener('pointerdown', ev => { touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY }); if (touches.size === 2) { pinch = pinchState(); drag = null; dragMoved = true; } }, true);
    cv.addEventListener('pointermove', ev => { if (!touches.has(ev.pointerId)) return; touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY }); if (pinch && touches.size === 2) { const p = pinchState(); zoomBy(pinch.d / Math.max(p.d, 1), pinch.m.x, pinch.m.y); pinch.d = p.d; } }, true);
    const lift = ev => { touches.delete(ev.pointerId); if (touches.size < 2) pinch = null; };
    cv.addEventListener('pointerup', lift, true); cv.addEventListener('pointercancel', lift, true);
    cv.addEventListener('pointerdown', ev => { if (ev.target.closest('.zoombar,.legend2')) return; drag = { x: ev.clientX, y: ev.clientY, vx: vb.x, vy: vb.y }; dragMoved = false; cv.setPointerCapture(ev.pointerId); });
    cv.addEventListener('pointermove', ev => { if (!drag || pinch) return; const r = cv.getBoundingClientRect(); const dx = (ev.clientX - drag.x) / r.width * vb.w, dy = (ev.clientY - drag.y) / r.height * vb.h; if (Math.abs(ev.clientX - drag.x) + Math.abs(ev.clientY - drag.y) > 4) { dragMoved = true; cv.classList.add('dragging'); } vb.x = drag.vx - dx; vb.y = drag.vy - dy; applyVb(); });
    const end = () => { drag = null; cv.classList.remove('dragging'); setTimeout(() => { dragMoved = false; }, 0); };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    window.addEventListener('resize', () => { if (!studio || studio.hidden || !S.current) return; if ((studio.querySelector('#stCanvas').clientWidth < 700) !== narrowAtDraw) draw(); else fit(); });
  }
  function renderLegend() {
    const lg = studio.querySelector('#stLegend');
    lg.onclick = () => lg.classList.toggle('open');
    lg.innerHTML = `<span class="lgk">Key ▸</span><span><svg width="34" height="10"><line x1="0" y1="5" x2="34" y2="5" stroke="#ffd76a" stroke-width="4"/></svg><span title="FEC, USAspending, SEC 13F and IRS filings">reported $</span></span>
      <span><svg width="34" height="10"><line x1="0" y1="5" x2="34" y2="5" stroke="#e8c88a" stroke-width="2" stroke-dasharray="6 5"/></svg>estimated</span>
      ${['F', 'C', 'D', 'K', 'I'].filter(t => ETYPES[t]).map(t => `<span><i class="dot" style="--c:${typeHex(t)}"></i>${h(ETYPES[t].label)}</span>`).join('')}
      <span>Line width = dollars · arrow = direction of power · scroll to pan, Ctrl+scroll or pinch to zoom</span>`;
  }

  // ---------- export ----------
  function exportImage(kind) {
    const svg = studio.querySelector('#stSvg'); if (!svg.querySelector('#stWorld')) return;
    const C = S.current, W = Math.ceil(content.w), Hh = Math.ceil(content.h) + 70;
    const title = `<text x="${PAD}" y="30" font-size="20" font-weight="700" fill="#eef2f8">${h(C.title || 'Power chain')}</text><text x="${PAD}" y="52" font-size="12.5" fill="#8f9ab0">American Power Map · influence score ${h(fmt$(C.score.influence))} · ${h(evidence(C.score).text)} · reported $ from FEC, USAspending, SEC 13F, IRS</text>`;
    const out = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Hh}" viewBox="0 -70 ${W} ${Hh}" font-family="Segoe UI, Avenir Next, system-ui, sans-serif"><rect x="0" y="-70" width="${W}" height="${Hh}" fill="#0d1219"/><g transform="translate(0,-70)">${title}</g>${svg.innerHTML}</svg>`;
    const name = (C.title || 'power-chain').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
    const save = (blob, ext) => { const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = `${name}.${ext}`; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1500); };
    if (kind === 'svg') return save(new Blob([out], { type: 'image/svg+xml' }), 'svg');
    const img = new Image(); const url = URL.createObjectURL(new Blob([out], { type: 'image/svg+xml' }));
    img.onload = () => { const scale = 2, cv = document.createElement('canvas'); cv.width = W * scale; cv.height = Hh * scale; const ctx = cv.getContext('2d'); ctx.scale(scale, scale); ctx.drawImage(img, 0, 0); URL.revokeObjectURL(url); cv.toBlob(b => save(b, 'png'), 'image/png'); };
    img.onerror = () => { URL.revokeObjectURL(url); toast('PNG export failed; try SVG'); };
    img.src = url;
  }

  // ---------- 3D hand-off ----------
  function showIn3D() {
    const C = S.current; if (!C) return;
    const nodes = [], edges = [], seen = new Set();
    for (const c of C.chains) {
      c.nodes.forEach(n => { const o = byId[n.id]; if (o && !seen.has(o)) { seen.add(o); nodes.push(o); } });
      c.hops.forEach(hp => { const s = byId[hp.src], d = byId[hp.dst]; if (s && d) edges.push(addEdge(s, d, hp.t, hp.w, hp.note)); });
    }
    if (!nodes.length) return;
    ensureArrows();
    state.selected = null; state.pathA = null; state.pathB = null;
    state.path = { nodes, edges, src: nodes[0], dst: nodes[nodes.length - 1], chainTitle: C.title || 'Power chain' };
    close(); renderDetail(); applyVisibility();
    const c = new THREE.Vector3(); nodes.forEach(n => c.add(n.pos)); c.divideScalar(nodes.length);
    let r = 30; nodes.forEach(n => { r = Math.max(r, n.pos.distanceTo(c)); }); flyTo(c, r * 2.6);
  }

  // ---------- public entry points ----------
  async function startFrom(id) { ensureStudio(); S.build = { ids: [id], dir: 'down' }; open('build'); refreshBuild(); }
  function discoverFrom(id) { ensureStudio(); const n = byId[id]; S.disc.mode = 'from'; S.disc.from = n ? { id: n.id, name: n.n, c: n.c } : null; S.tab = 'discover'; open('discover'); const pane = studio.querySelector('#stPane'); setTimeout(() => runDiscover(pane), 0); }
  async function routeHash() {
    const m = location.hash.match(/^#(chain|finding)=([A-Za-z0-9_-]+)/); if (!m) return;
    if (m[1] === 'chain') loadSaved(m[2]); else { open('findings'); showFinding(m[2]); }
  }
  window.ChainStudio = { open, close, startFrom, discoverFrom, loadSaved, showFinding };
  window.addEventListener('pm:ready', () => {
    const btn = document.getElementById('chainsBtn'); if (btn) btn.onclick = () => open();
    routeHash();
  });
  window.addEventListener('hashchange', routeHash);
})();
