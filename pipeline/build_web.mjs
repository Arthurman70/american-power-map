// Assembles web/index.html and web/importers.js from the single-file map: reuses its CSS + panel markup and its
// CSV/JSON converters and live fetchers verbatim, then wires in app.js (the database-backed engine).
import fs from 'node:fs';
const src = process.argv[2] || 'source/us-power-map.html';
const html = fs.readFileSync(src, 'utf8');
const headEnd = html.indexOf('</style>') + '</style>'.length;
let head = html.slice(0, headEnd);
head = head.replace(/<title>[^<]*<\/title>/, '<title>American Power Map — database edition</title>');
head += `\n<style>
#layStatus{white-space:nowrap}
#loading span{display:block;margin-top:6px}
/* The list is now virtualized (server/… no — web/app.js renders only the rows scrolled into view) so it can
   hold thousands of centers smoothly; give it its own fixed-height scroll pane instead of scrolling with the
   rest of the filter UI, so the filters above stay put while the list itself scrolls. */
#left .body{display:flex;flex-direction:column;overflow:hidden}
#left .body>.sec,#left .body>.count{flex:none}
#left .body>#list{flex:1 1 auto;overflow-y:auto;min-height:180px;scrollbar-width:thin;scrollbar-color:#37435a transparent;margin-top:4px}
#list .row,#list .grp{box-sizing:border-box;display:flex;align-items:center;height:100%;margin:0;border-top:none;padding:0 6px}
</style>\n<link rel="stylesheet" href="/chains.css">\n</head>`;
const bodyStart = html.indexOf('<body>');
const scriptStart = html.indexOf('<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js');
let body = html.slice(bodyStart, scriptStart);
body = body.replace(/<span>Who decides, who controls whom[^<]*<\/span>/, '<span>Loading the database…</span>');
body = body.replace(/Scaling past ~5,000 centers needs a database-backed build \(the in-browser layout is O\(N²\)\); the import format here is designed to migrate to that\./, 'This is the database-backed build: centers and arrows live in SQLite behind an API, layouts are Barnes-Hut and precomputed, and imports go to the shared database (admin token required).');
body = body.replace(/<div id="loading"><b>American Power Map<\/b><span>[^<]*<\/span><\/div>/, '<div id="loading"><b>American Power Map</b><span>Loading…</span></div>');
body = body.replace('<label class="t">Min arrow strength <span class="v" id="minWv">1</span></label><input type="range" id="minW" min="1" max="5" value="1">', '<label class="t" title="Arrows of strength 3+ are loaded for the whole map; weaker arrows load when you select a center">Min arrow strength <span class="v" id="minWv">4</span></label><input type="range" id="minW" min="1" max="5" value="4">');
body = body.replace('Imported centers are tagged with their source and can be exported with Download JSON.', 'Imports are stored in the shared database (admin token required) and tagged with their source.');
// glob size filter: hide centers below a funding-derived size threshold
body = body.replace(
  '<div class="sec chips">\n        <button class="chip" id="focusBtn"',
  '<div class="sec"><div class="range"><label class="t" title="Globs are sized by funding — company revenue, 13F holdings, or a government agency\'s budget ×10. This slider hides everything below a size, to declutter the map.">Min size <span class="v" id="minSizev">off</span></label><input type="range" id="minSize" min="0" max="13" step="0.25" value="0"></div></div>\n      <div class="sec chips">\n        <button class="chip" id="focusBtn"'
);
// arrows master on/off toggle, and a hidden-centers status + restore control
body = body.replace(
  '<div class="sec"><label class="t">Arrow types</label><div class="chips" id="etypeChips"></div></div>',
  '<div class="sec"><label class="t">Arrow types</label><div class="chips"><button class="chip" id="arrowsBtn" title="Show or hide every connection line at once, regardless of the type filters below">Arrows</button><button class="chip" id="bundlesBtn" title="Hubs with many same-type routine connections (SEC registrants, IRS-regulated nonprofits...) are drawn as one soft membrane instead of a hairball of lines. Turn off to see every individual line at once.">Bundles</button></div><div class="chips" id="etypeChips"></div></div>'
);
body = body.replace(
  '<button class="chip" id="dlCsv" title="Download edges as CSV">Download CSV</button>\n      </div>',
  '<button class="chip" id="dlCsv" title="Download edges as CSV">Download CSV</button>\n      </div>\n      <div class="sec chips" id="hiddenRow"><span class="status" id="hiddenStatus"></span><button class="chip" id="showHiddenBtn" hidden title="Bring back every center you\'ve hidden">Show all hidden</button></div>'
);
// Chain Studio entry point (web/chains.js): the 2D power-chain view
body = body.replace('<button id="tLeft" class="on" title="Toggle explore panel">Explore</button>', '<button id="chainsBtn" title="Follow chains of money and control in a 2D diagram: ranked findings, discovery, builder and saved chains">Power chains</button>\n      <button id="tLeft" class="on" title="Toggle explore panel">Explore</button>');
if (!body.includes('id="chainsBtn"')) throw new Error('topright marker not found in ' + src);
// converters + fetchers, verbatim from the original
const cStart = html.indexOf('function convertFecScheduleA');
const cEnd = html.indexOf('// ---------- file / paste import ----------');
const fStart = html.indexOf('const FEC_KEY=');
const fEnd = html.indexOf("document.getElementById('fetchBox')");
if (cStart < 0 || cEnd < 0 || fStart < 0 || fEnd < 0) throw new Error('markers not found in ' + src);
let importers = '// Extracted verbatim from the single-file map: registry CSV/JSON converters and best-effort live fetchers.\n' + html.slice(cStart, cEnd) + '\n' + html.slice(fStart, fEnd).replace(/^async function getJSON[^\n]*\n/m, '').replace(/^function busy[^\n]*\n/m, '');
fs.mkdirSync('web', { recursive: true });
fs.writeFileSync('web/importers.js', importers);
fs.writeFileSync('web/index.html', head + '\n' + body + '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>\n<script src="/layout.js"></script>\n<script src="/app.js"></script>\n<script src="/chains.js"></script>\n<script src="/importers.js"></script>\n</body>\n</html>\n');
console.log('web/index.html', fs.statSync('web/index.html').size, 'bytes; web/importers.js', importers.length, 'bytes');
