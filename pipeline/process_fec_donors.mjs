// Streams the FEC individual-contributions file (data/fec/indiv26.zip, 2.3 GB zipped — never extracted to disk)
// and keeps the large donors to the 400 committees in data/fec.json -> data/fec_donors.json.
// These are public FEC records (Schedule A). Only donors giving $500K+ in total to these committees are kept:
// this is the megadonor and corporate layer, not ordinary contributors. ActBlue and WinRed are excluded because
// they are pass-through conduits for earmarked small-dollar gifts, not donors' final destination.
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import readline from 'node:readline';

const fec = JSON.parse(fs.readFileSync('data/fec.json', 'utf8'));
const CONDUITS = new Set(['C00401224', 'C00694323']);
const cmtes = new Set(fec.committees.map(c => c.id).filter(id => !CONDUITS.has(id)));
const MIN_ROW = 5000, MIN_DONOR = 500000;

const unzip = spawn('unzip', ['-p', 'data/fec/indiv26.zip', 'itcont.txt'], { stdio: ['ignore', 'pipe', 'inherit'] });
const rl = readline.createInterface({ input: unzip.stdout, crlfDelay: Infinity });
const donors = new Map(); const seenSub = new Set();
let rows = 0, kept = 0;
const keyOf = (ent, name) => ent + '|' + String(name).toUpperCase().replace(/[.,]/g, ' ').replace(/\b(MR|MRS|MS|DR|JR|SR|II|III|IV)\b/g, ' ').replace(/\s+[A-Z]\s*$/, '').replace(/\s+/g, ' ').trim();
for await (const line of rl) {
  rows++;
  const r = line.split('|');
  const cmte = r[0]; if (!cmtes.has(cmte)) continue;
  const ent = r[6]; if (ent !== 'IND' && ent !== 'ORG') continue;
  if (r[18] === 'X') continue;                      // memo entries duplicate other rows
  const amt = +r[14] || 0; if (amt < MIN_ROW) continue;
  const sub = r[20]; if (sub) { if (seenSub.has(sub)) continue; seenSub.add(sub); }
  const k = keyOf(ent, r[7]);
  let d = donors.get(k);
  if (!d) donors.set(k, d = { key: k, entity: ent, name: r[7], city: r[8], state: r[9], employer: r[11], occupation: r[12], total: 0, gifts: {} });
  if (!d.employer && r[11]) d.employer = r[11]; if (!d.occupation && r[12]) d.occupation = r[12];
  d.total += amt; d.gifts[cmte] = (d.gifts[cmte] || 0) + amt; kept++;
  if (rows % 5e6 === 0) console.log(`  ${(rows / 1e6).toFixed(0)}M rows scanned, ${kept.toLocaleString()} large gifts to tracked committees`);
}
const list = [...donors.values()].filter(d => d.total >= MIN_DONOR).sort((a, b) => b.total - a.total)
  .map(d => ({ ...d, gifts: Object.entries(d.gifts).map(([cmte, amount]) => ({ cmte, amount })).sort((a, b) => b.amount - a.amount) }));
fs.writeFileSync('data/fec_donors.json', JSON.stringify({ cycle: 2026, fetched: new Date().toISOString().slice(0, 10), minDonor: MIN_DONOR, donors: list }));
console.log(`scanned ${rows.toLocaleString()} rows; ${list.length} donors with $${MIN_DONOR / 1e3}K+ (${list.filter(d => d.entity === 'IND').length} individuals, ${list.filter(d => d.entity === 'ORG').length} organizations)`);
console.log('top 25:', list.slice(0, 25).map(d => `${d.name} $${(d.total / 1e6).toFixed(1)}M`).join(' | '));
