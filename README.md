# American Power Map — Explore US Money, Ownership and Government

[![Open live power map](https://img.shields.io/badge/Open%20live%20power%20map-0f766e?style=for-the-badge)](https://thegreatlakesgleaner.press/power-map/) [![Download database](https://img.shields.io/badge/Download%20database-2563eb?style=for-the-badge)](https://github.com/Arthurman70/american-power-map/releases/download/v1.0.0/powermap.db.gz) [![Download source](https://img.shields.io/badge/Download%20source-475569?style=for-the-badge)](https://github.com/Arthurman70/american-power-map/archive/refs/heads/main.zip)

[Local setup](#quick-start) · [Data sources and accuracy](#data-and-accuracy) · [API](#api) · [FAQ](#frequently-asked-questions)

**Browser demo available.** To self-host, download both the source and database and use Node.js 24+. The database is a snapshot; source periods and editorial estimates are documented below.

**Downloads and setup:** [Open live power map](https://thegreatlakesgleaner.press/power-map/) · [Download database](https://github.com/Arthurman70/american-power-map/releases/download/v1.0.0/powermap.db.gz) · [Download source](https://github.com/Arthurman70/american-power-map/archive/refs/heads/main.zip)

**Who decides, who controls whom.** An open-source 3D map of power in the United States, with 14,000 centers
(federal agencies, Congress, courts, states, companies, investors, nonprofits, unions, PACs, super PACs, dark-money
groups, megadonors and candidates) and 72,000 arrows of control, funding, regulation and influence, plus
**Chain Studio**, a 2D explorer for following chains of money and power with a dollar figure on every link.

Built from public records: SEC EDGAR and 13F filings, FEC campaign-finance data, USAspending.gov and the IRS
exempt-organization file, layered on a hand-curated map of government and political power.

- **3D map:** instanced blobs sized by real dollars (revenue, holdings, budgets), several layouts (power type,
  sector, branch, hierarchy, radial, distance), search, filters, shortest control paths between any two centers.
- **Chain Studio:** 27 pre-analyzed findings (Medicaid to all 50 states and DC, crypto and AI money, the Kentucky and
  Michigan Senate races, the defense money loop, who owns Berkshire...), discovery of the strongest chains from or
  between any centers, a step-by-step chain builder, saved and shareable chains, PNG and SVG export.
- **No dependencies:** Node 24 (`node:sqlite`, `http`, `worker_threads`) and three.js from a CDN. No npm install.

## Quick start

```bash
git clone https://github.com/Arthurman70/american-power-map.git
cd american-power-map
# download the prebuilt database from the latest release into data/
curl -L -o data/powermap.db.gz https://github.com/Arthurman70/american-power-map/releases/latest/download/powermap.db.gz
gunzip data/powermap.db.gz
node server/server.mjs          # open http://localhost:8092
```

Or build the database yourself from the processed data in `data/` (`npm run build:db`, about 2 minutes), or from
scratch with the full pipeline below.

## Data and accuracy

All dollar figures come from public filings: FEC (2025-26 cycle), USAspending (fiscal 2025), SEC 13F (Q1 2026),
SEC XBRL frames and the IRS exempt-organization file. Links without a reported amount are clearly marked as
estimates in the app. Power scores and the hand-curated arrows are editorial. The findings in `server/findings.mjs`
were written by analyzing this data; `pipeline/check_findings.mjs` re-verifies them against any rebuild.

Individual contributor names come from FEC filings. Federal law (52 U.S.C. 30111(a)(4)) prohibits using contributor
information from FEC reports to solicit contributions or for commercial purposes, and that applies to anything
built on this data too.

The code is MIT licensed (see `LICENSE`). The government data it ingests is public domain.

---

## Architecture

Database-backed successor to the single-file map in `source/us-power-map.html`. Same look and panels, but centers
and arrows live in SQLite behind a small API, layouts are Barnes-Hut and precomputed on the server, and the browser
loads compact records plus strong arrows, fetching everything else on demand. Built for tens of thousands of
centers; the single-file build stalled at ~5,000.

## What is in the database

| Source | What it adds | As of |
|---|---|---|
| Hand-curated map (extracted from `source/us-power-map.html`) | 940 centers, 10,111 arrows: government, politics, media, unions, dark money, editorial power scores | Sept 2026 |
| SEC EDGAR company list + submissions API | ~5,100 SEC-registered operating companies with SIC industry, exchange, HQ, state of incorporation; XBRL frames give revenue, net income, assets | fetched at build time |
| SEC Form 13F bulk data (quarter ended 31 Mar 2026) | ~2,300 institutional managers and ~31,000 "controls" arrows: the top 8 reported holders of every matched company, weighted by share of institutional holdings | Q1 2026 |
| SIC-code regulators | "regulates" arrows from the SEC, Fed/OCC/FDIC, FDA, CMS, FERC, FCC, FAA, NHTSA, EPA, Interior, DOT and exchanges to each company | editorial mapping in `pipeline/build_db.mjs` |
| IRS Exempt Organizations Business Master File | ~3,600 large nonprofits, unions, trade associations, 501(c)(4)s and credit unions (revenue ≥ $250M or assets ≥ $1B; c4/c5/c6 ≥ $20M); IRS revenue replaces estimates for curated nonprofits | 2026 extract |
| USAspending.gov | FY2025 top contract and grant recipients for 21 agencies; formula programs to all 50 states + DC (Medicaid/CHIP, SNAP and child nutrition, highways, Title I/IDEA, TANF and child care); agency and sub-agency obligations | FY2025 |
| FEC bulk data, 2025-26 cycle | 400 largest PACs/super PACs/party committees, ~280 candidates, committee→candidate contributions and independent expenditures, megadonors (≥ $500K), committee-to-committee transfers, all with reported amounts | through 30 Sep 2026 |

Curated single-company centers (Apple, JPMorgan, BlackRock, Exxon...) are merged with their EDGAR record rather
than duplicated; group centers ("Big Pharma", "Regional banks") get a "member of" arrow from the representative
listed company.

## Layout

`server/layout.js` is a 3-D Barnes-Hut octree force layout (theta 0.85, degree-normalised springs so hubs like the
SEC do not collapse the map). The same file runs in Node (precompute, `server/precompute.mjs`) and in a browser
Web Worker (`web/worker.js`, used for the "Distance" view, which depends on the selected center). 8,400 centers
take about 8 s per layout in Node.

## Run locally

```bash
node server/server.mjs                       # http://localhost:8092  (needs data/powermap.db)
ADMIN_TOKEN=secret node server/server.mjs    # enables POST /api/import from the "Add data" panel
```

Node 24+ (uses `node:sqlite`). No npm dependencies.

## Rebuild the data

```bash
node pipeline/extract_curated.mjs                           # source/us-power-map.html -> data/curated.json
curl -A "$SEC_USER_AGENT" -o data/company_tickers_exchange.json https://www.sec.gov/files/company_tickers_exchange.json
node pipeline/fetch_edgar.mjs                               # ~20 min at SEC's 8 req/s -> data/edgar_companies.json (resumable)
# XBRL frames: data/frames_<Tag>_<CY>.json from https://data.sec.gov/api/xbrl/frames/us-gaap/<Tag>/USD/<CY>.json
# 13F: download the latest zip from https://www.sec.gov/data-research/sec-markets-data/form-13f-data-sets
#      and unzip INFOTABLE.tsv, SUBMISSION.tsv, COVERPAGE.tsv into data/13f/
node pipeline/process_13f.mjs                               # -> data/f13.json (two streaming passes, ~1 min)
node pipeline/fetch_usaspending.mjs                         # -> data/usaspending.json
node pipeline/fetch_state_programs.mjs                      # -> data/state_programs.json (Medicaid etc. by state + DC)
node pipeline/fetch_budgets.mjs                             # -> data/agency_budgets.json (Congress -> agency -> sub-agency)
# IRS: eo1.csv-eo4.csv from https://www.irs.gov/charities-non-profits/exempt-organizations-business-master-file-extract-eo-bmf into data/irs/
node pipeline/process_irs.mjs                               # -> data/irs_large.json
# FEC: cm.txt, cn.txt, webk26.txt, weball26.txt, itpas2.txt (+ indiv26.zip, oth26.zip) into data/fec/ (curl -L)
node pipeline/process_fec.mjs && node pipeline/process_fec_donors.mjs && node pipeline/process_fec_transfers.mjs
node pipeline/build_db.mjs data/powermap.db                 # -> SQLite, ~20 s
node server/precompute.mjs data/powermap.db                 # all 9 layouts, ~70 s
```

SEC requires a descriptive `User-Agent` with a contact address; set `SEC_USER_AGENT="Your Name you@example.com"`.

## API

| Route | Returns |
|---|---|
| `GET /api/meta` | counts, categories, arrow types, industries, sectors, sources |
| `GET /api/nodes` | every center as parallel arrays (id, name, category, sector, branch, industry, power, tier, degree, weights) |
| `GET /api/edges?min=3` | arrows of at least that strength, as node indices |
| `GET /api/node/:id` | full record, every arrow with notes, chain of command |
| `GET /api/search?q=` | FTS5 search over names, tickers, descriptions, former names |
| `GET /api/path?from&to&directed=1` | shortest control chain over the full arrow table |
| `GET /api/depth/:id?dir=any` | BFS distance of every center from one center (Int32 binary) |
| `GET /api/positions/:layout` | precomputed Barnes-Hut positions (Float32 binary); computed in a worker thread if missing |
| `GET /api/export.json`, `/api/export.csv` | whole dataset |
| `POST /api/import` (Bearer ADMIN_TOKEN) | nodes/edges payload in the single-file import format; names are matched to existing centers |
| `GET /api/findings` | curated, pre-analyzed power chains (`server/findings.mjs`), resolved against the live graph and ranked by influence |
| `GET /api/chains/presets`, `/api/chains/top?preset=` | discovered top chains per flow type (money-politics, federal-money, ownership, dark-money, control) |
| `GET /api/chains/from/:id?dir=down\|up&depth&k&reported=1` | strongest chains flowing out of (or into) one center |
| `GET /api/chains/between?from&to&k&directed` | k best chains between two centers |
| `GET /api/chains/next/:id?dir&exclude` | builder suggestions: the strongest next links, ranked by dollars |
| `GET /api/chains/resolve?ids=a,b,c` | describe any chain: per-link amounts, sources, influence score |
| `POST /api/chains`, `GET/PUT/DELETE /api/chains/saved/:id` | saved chains (anyone can save; the returned edit key, sent as Bearer, is needed to rename/delete) |

## Power chains

The "Power chains" button opens Chain Studio (`web/chains.js`): ranked findings, discovery, a step-by-step builder,
saved/shared chains (`#chain=<id>`, `#finding=<id>`) and a 2D diagram with a dollar label on every link. Scoring
(`server/chains.mjs`): a link's value is its reported amount (FEC, USAspending, 13F) or an estimate scaled from the
two centers' sizes; a chain's influence score is its smallest link, with estimated links counted at 10% so reported
money ranks first. Figures quoted in curated notes are shown but scored as estimates. Findings are written offline
from this data (no AI at runtime). After any rebuild run `node pipeline/check_findings.mjs data/powermap.db`: every
chain must resolve, and dollar figures quoted in summaries are cross-checked against the links (derived totals are
listed for a manual check). `node pipeline/analyze_chains.mjs` is the research tool for writing new ones. Contributions of new, verifiable findings are welcome.
Saved chains live in `userchains.db` next to the map database (or `USER_DB`), so rebuilding `powermap.db` keeps them.

## Deploy

`docker compose up -d --build` with `data/powermap.db` present and `.env` containing `ADMIN_TOKEN=...`.
Serves on port 8092; put it behind any reverse proxy (Caddy, nginx) for HTTPS.

## Toward "every business in America"

The import format (`nodes` + `edges` with name matching) is the extension point. Next feeders, in order of value:
OpenSecrets bulk data (PAC-to-PAC and industry lobbying), Senate LDA lobbying disclosures, ProPublica
Nonprofit Explorer (990 grants for the dark-money layer), OpenCorporates or state SOS registries for private
companies. At ~50k+ centers the browser should switch from "load all centers" to viewport tiles; the API already
serves positions and edges by index so that split is mechanical.

## Frequently asked questions

Answers describe this repository and its documented scope as of **October 23, 2026**.

### What tool can I use to explore US government, company and political funding connections?

American Power Map combines an interactive 3D relationship map with Chain Studio, a 2D explorer of funding, ownership, regulation and control links. [Open the live map](https://thegreatlakesgleaner.press/power-map/) to search a company, agency or political organization and inspect the connections recorded in the dataset.

### Where does American Power Map get its data?

The project processes SEC EDGAR and 13F filings, FEC campaign-finance records, USAspending data and IRS exempt-organization data, alongside a hand-curated government and political map. The [source table](#what-is-in-the-database) identifies the periods, coverage and editorial additions.

### Can I follow a money trail between two organizations?

Chain Studio can find paths between centers, discover strong chains, and let you build a chain step by step. Links include amounts and source context where available. A connected chain is a research starting point; examine the meaning and reporting period of each individual link.

### Does an ownership or funding link prove corruption or direct control?

No. A relationship in a public filing is not proof of misconduct, coordinated behavior or legal control. Some labels, power scores and regulatory mappings are editorial, and some amounts are estimates. Check the underlying source and the [data and accuracy notes](#data-and-accuracy) before drawing conclusions.

### Is this a live feed of every transaction or every US business?

No. The included database is a snapshot with different reporting periods for each source, and it covers selected entities and relationships. The README records those periods. A refreshed website does not by itself mean the underlying filings were refreshed; rebuilding the data is a separate process.

### How do I run American Power Map on my own computer?

Download the source and prebuilt database, decompress `powermap.db.gz` into `data/powermap.db`, and run `node server/server.mjs` with Node.js 24 or newer. Open `http://localhost:8092`. The [quick start](#quick-start) contains the full commands; no npm package installation is needed for the server.

### Is the database download a complete desktop application?

No. `powermap.db.gz` is a compressed SQLite database. You also need this repository and its Node.js server to use the interactive interface. The source ZIP and database buttons are separate so you can choose the files you actually need.

### Can I export a chart or download the underlying data?

Chain Studio supports PNG and SVG diagram export. The server exposes JSON and CSV dataset exports, search, node details and chain endpoints. See the [API table](#api) and [Power chains guide](#power-chains) for the available formats and saved-chain behavior.

### Can I rebuild the map with newer public records?

Yes. The [rebuild instructions](#rebuild-the-data) describe the fetch, processing and database steps. Source access requirements vary, and SEC requests require an identifying user agent. Recheck the curated findings after rebuilding because changed records can change the chains and figures.

### Can I use this project for research or my own visualization?

The code is MIT licensed. Dataset use still needs to respect source-specific restrictions; the README flags the FEC contributor-information restriction and links to the relevant accuracy context. Start with the [data notes](#data-and-accuracy) and preserve source attribution in derived research.
