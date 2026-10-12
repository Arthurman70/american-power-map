// Committee-to-committee money among the 400 tracked committees, from the FEC "any transaction from one committee
// to another" file (data/fec/oth26.zip, streamed — not extracted). Receipts reported by the RECEIVING committee
// whose counterparty (OTHER_ID) is another tracked committee, aggregated per pair -> data/fec_transfers.json.
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import readline from 'node:readline';

const fec = JSON.parse(fs.readFileSync('data/fec.json', 'utf8'));
const ids = new Set(fec.committees.map(c => c.id));
const RECEIPT_TYPES = new Set(['18G', '18K', '15Z', '18J', '15C']); // transfers in from affiliates, contributions/in-kind from registered committees
const unzip = spawn('unzip', ['-p', 'data/fec/oth26.zip'], { stdio: ['ignore', 'pipe', 'inherit'] });
const rl = readline.createInterface({ input: unzip.stdout, crlfDelay: Infinity });
const pairs = new Map(); const seen = new Set(); let rows = 0;
for await (const line of rl) {
  rows++;
  const r = line.split('|');
  const receiver = r[0], tp = r[5], giver = r[15], memo = r[18], sub = r[20];
  if (!ids.has(receiver) || !ids.has(giver) || receiver === giver || !RECEIPT_TYPES.has(tp) || memo === 'X') continue;
  if (sub) { if (seen.has(sub)) continue; seen.add(sub); }
  const amt = +r[14] || 0; if (amt <= 0) continue;
  const k = giver + '|' + receiver; const p = pairs.get(k) || { from: giver, to: receiver, amount: 0, count: 0 }; p.amount += amt; p.count++; pairs.set(k, p);
}
const list = [...pairs.values()].filter(p => p.amount >= 250000).sort((a, b) => b.amount - a.amount);
fs.writeFileSync('data/fec_transfers.json', JSON.stringify({ cycle: 2026, fetched: new Date().toISOString().slice(0, 10), transfers: list }));
const nm = Object.fromEntries(fec.committees.map(c => [c.id, c.name]));
console.log(`scanned ${rows.toLocaleString()} rows; ${list.length} committee-to-committee flows of $250K+`);
console.log(list.slice(0, 20).map(p => `${nm[p.from]} -> ${nm[p.to]} $${(p.amount / 1e6).toFixed(1)}M`).join('\n'));
