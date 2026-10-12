// Curated findings: power chains identified by analyzing this map's data offline (pipeline/analyze_chains.mjs),
// then checked hop-by-hop against the underlying filings. Each finding names one or more chains of center ids;
// the server resolves them against the live graph, so every dollar figure shown in the app comes from the data,
// and findings are ranked by computed influence (never by the order below). Each finding is meant to show the
// bigger picture around its headline: who funds the funders, where the money goes next, and the peers alongside.
// Data vintages: FEC 2025-26 cycle filings; USAspending FY2025 (awards, formula programs by state, agency
// obligations); SEC 13F Q1 2026; IRS exempt-organization file 2026.
export const FINDINGS_ASOF = '2026-10-12';

// all 50 states plus the District of Columbia (DC's government is the ct_dc center)
const STATES = ['st_al', 'st_ak', 'st_az', 'st_ar', 'st_ca', 'st_co', 'st_ct', 'st_de', 'st_fl', 'st_ga', 'st_hi', 'st_id', 'st_il', 'st_in', 'st_ia', 'st_ks', 'st_ky', 'st_la', 'st_me', 'st_md', 'st_ma', 'st_mi', 'st_mn', 'st_ms', 'st_mo', 'st_mt', 'st_ne', 'st_nv', 'st_nh', 'st_nj', 'st_nm', 'st_ny', 'st_nc', 'st_nd', 'st_oh', 'st_ok', 'st_or', 'st_pa', 'st_ri', 'st_sc', 'st_sd', 'st_tn', 'st_tx', 'st_ut', 'st_vt', 'st_va', 'st_wa', 'st_wv', 'st_wi', 'st_wy', 'ct_dc'];
const toAll = (...path) => STATES.map(s => [...path, s]);

export const FINDINGS = [
  // ---------------- Federal money: formula programs reaching every state ----------------
  {
    id: 'medicaid-all-states', theme: 'Federal money', title: 'Medicaid sends $683B a year to all 50 states and DC',
    summary: 'Congress funds HHS ($2.79T in fiscal 2025 obligations), HHS runs CMS ($1.88T in awards, mostly Medicare and Medicaid), and CMS paid every state and DC the federal share of Medicaid plus CHIP: $682.7B in fiscal 2025. California received $112.0B, New York $62.8B, Texas $31.7B, Pennsylvania $29.8B and Ohio $27.7B; those five take 39%. Per resident, DC ($4,899), New Mexico ($3,938), Kentucky ($3,535) and Alaska ($3,425) lead, while Texas ($1,088), Florida ($1,060) and Wyoming ($848), all states that have not adopted the ACA Medicaid expansion, are near the bottom. The U.S. average is $2,060 per person. Medicaid is the single largest federal flow into state government, larger than highways, nutrition, schools and welfare combined.',
    chains: toAll('congress', 'hhs', 'cms'),
  },
  {
    id: 'snap-all-states', theme: 'Federal money', title: 'SNAP and school meals: $128B to every state',
    summary: 'Through the farm bill, Congress funds USDA ($276.6B in fiscal 2025 obligations), whose Food and Nutrition Service obligated $136.2B in awards. Its SNAP benefits, SNAP administration, school lunch, school breakfast and WIC reached every state and DC: $128.4B. California received $17.6B, Texas $10.9B, New York $9.8B and Florida $8.8B. Per resident the highest are DC ($620), New Mexico ($614), Hawaii ($535) and Louisiana ($533); the lowest are Utah ($194), Wyoming ($186) and New Hampshire ($133), against a national average of $387.',
    chains: toAll('congress', 'usda', 'fns'),
  },
  {
    id: 'highways-all-states', theme: 'Federal money', title: 'Federal highway money favors big, empty states',
    summary: 'The Transportation Department ($169.6B in fiscal 2025 obligations) sent $67.0B in federal-aid highway grants to the states and DC. The biggest checks go to the biggest states: California $6.3B, Texas $5.7B, New York $3.2B, Florida $2.7B. Per resident the formula strongly favors large rural states, led by Alaska ($1,459), Wyoming ($818), Montana ($682) and Vermont ($649), while New York ($157), Washington ($156), Maryland ($146) and Florida ($125) get the least per person. The national average is $202.',
    chains: toAll('congress', 'dot'),
  },
  {
    id: 'schools-all-states', theme: 'Federal money', title: 'Title I and special education reach every state, but thinly',
    summary: 'The Education Department obligated $179.7B in fiscal 2025, most of it student aid. Its two big formula grants to schools, Title I for low-income districts and IDEA special education, sent $31.7B to the states and DC: California $3.7B, Texas $3.0B, New York $2.4B, Florida $1.8B. That is $96 per resident nationally, from DC ($346), Wyoming ($149) and South Dakota ($141) at the top to Utah ($70), Idaho ($69) and Colorado ($66) at the bottom.',
    chains: toAll('congress', 'education'),
  },
  {
    id: 'tanf-all-states', theme: 'Federal money', title: 'Welfare, child care and foster care: $31.6B to the states',
    summary: 'HHS’s Administration for Children and Families ($64.5B in fiscal 2025 awards) funds TANF cash assistance, the Child Care and Development Fund and foster care through formula grants: $31.6B to the states and DC. California received $5.8B and New York $3.6B, together more than any other ten states. Per resident, DC ($230), New York ($176), California ($146) and West Virginia ($137) lead; Colorado ($58), New Hampshire ($54) and Virginia ($52) get the least.',
    chains: toAll('congress', 'hhs', 'hhs_acf'),
  },
  {
    id: 'federal-budget-map', theme: 'Federal money', title: 'Where Congress’s money goes: the agencies by FY2025 obligations',
    summary: 'Every federal dollar starts with Congress. In fiscal 2025 HHS obligated $2.79T (CMS alone $1.88T), Treasury $1.95T (mostly interest and tax refunds; the IRS itself $4.0B in awards), Social Security $1.74T, Defense $1.45T (Navy $177.3B, Army $111.8B and Air Force $99.6B in contracts and grants), Veterans Affairs $412.4B, Agriculture $276.6B (food and nutrition programs $136.2B), the Office of Personnel Management $262.0B (federal retirement and health benefits), Education $179.7B, Homeland Security $171.2B (FEMA $47.4B) and Transportation $169.6B. Sub-agency figures count contracts, grants and benefits, not payroll.',
    chains: [['congress', 'hhs', 'cms'], ['congress', 'hhs', 'nih'], ['congress', 'treasury', 'irs'], ['congress', 'ssa'], ['congress', 'dod', 'navy'], ['congress', 'dod', 'army'], ['congress', 'dod', 'airforce'], ['congress', 'va'], ['congress', 'usda', 'fns'], ['congress', 'opm'], ['congress', 'education'], ['congress', 'dhs', 'fema'], ['congress', 'dot'], ['congress', 'energy']],
  },
  // ---------------- Federal money: contractors ----------------
  {
    id: 'lockheed', theme: 'Federal money', title: 'The defense money loop: Congress, the Pentagon, Lockheed and its owners',
    summary: 'Congress gave the Defense Department the authority behind $1.45T in fiscal 2025 obligations. Its largest contractor, Lockheed Martin, received $62.9B, more than General Dynamics ($23.7B), RTX ($21.4B) and Boeing ($15.4B) combined; Huntington Ingalls, the Navy shipbuilder, got $8.8B. Lockheed is owned mostly by index funds: State Street holds $19.7B, Vanguard $13.0B and BlackRock $10.8B. The loop closes in politics: Lockheed’s employee PAC raised $3.5M this cycle and gives to both parties, including House Appropriations Chairman Tom Cole and Democratic leader Hakeem Jeffries.',
    chains: [['congress', 'dod', 'lockheed'], ['dod', 'co_gd'], ['dod', 'rtx'], ['dod', 'boeing'], ['dod', 'co_hii'], ['statestreet', 'lockheed'], ['vanguard', 'lockheed'], ['blackrock', 'lockheed'], ['lockheed', 'fec_c00303024', 'rep_cole'], ['lockheed', 'fec_c00303024', 'rep_jeffries'], ['lockheed', 'fec_c00303024', 'sen_cornyn']],
  },
  {
    id: 'va-optum', theme: 'Federal money', title: 'Veterans’ and military health care runs through private contractors',
    summary: 'Veterans Affairs obligated $412.4B in fiscal 2025. Its largest contractor is UnitedHealth, whose Optum units got $25.2B to run much of the Community Care Network for veterans treated outside VA hospitals; drug distributors received $11.5B and TriWest Healthcare Alliance $9.8B. TriWest also took $3.5B from the Pentagon and Humana $6.5B, both for military health coverage. UnitedHealth itself is owned largely by Vanguard ($25.0B) and BlackRock ($19.9B).',
    chains: [['congress', 'va', 'unitedhealth'], ['va', 'co_mckesson'], ['va', 'fed_triwest_health_care_alliance'], ['va', 'co_ldos'], ['va', 'co_mms'], ['dod', 'fed_triwest_health_care_alliance'], ['dod', 'co_hum'], ['vanguard', 'unitedhealth'], ['blackrock', 'unitedhealth']],
  },
  {
    id: 'nuclear-labs', theme: 'Federal money', title: 'Private companies and universities run America’s nuclear-weapons labs',
    summary: 'The Energy Department ($98.5B in fiscal 2025 obligations) pays private consortia to manage its laboratories. Honeywell’s subsidiary National Technology & Engineering Solutions of Sandia received $5.7B; Triad National Security (Battelle, the University of California and Texas A&M), which runs Los Alamos, $5.2B; Lawrence Livermore National Security (led by Bechtel and the University of California) $3.6B; Battelle’s UT-Battelle (Oak Ridge) $2.7B; Bechtel-led Consolidated Nuclear Security (Y-12) $2.5B; and Battelle Energy Alliance (Idaho) $1.9B. Through Honeywell, the same index funds that own most large companies stand behind Sandia.',
    chains: [['congress', 'energy', 'fed_national_technology_engineering_solutions_sa'], ['co_hon', 'fed_national_technology_engineering_solutions_sa'], ['vanguard', 'co_hon'], ['energy', 'fed_triad_national_security'], ['irs_314379427', 'fed_triad_national_security'], ['im_regents_of_the_university_of_california', 'fed_triad_national_security'], ['energy', 'fed_lawrence_livermore_national_security'], ['fed_bechtel_national', 'fed_lawrence_livermore_national_security'], ['im_regents_of_the_university_of_california', 'fed_lawrence_livermore_national_security'], ['energy', 'fed_ut_battelle'], ['irs_314379427', 'fed_ut_battelle'], ['energy', 'fed_consolidated_nuclear_security'], ['fed_bechtel_national', 'fed_consolidated_nuclear_security'], ['energy', 'fed_battelle_energy_alliance'], ['irs_314379427', 'fed_battelle_energy_alliance']],
  },
  // ---------------- Money into politics ----------------
  {
    id: 'crypto-fairshake', theme: 'Money into politics', title: 'Crypto money runs through both parties and MAGA Inc.',
    summary: 'Ripple Labs ($48.0M) and Coinbase ($33.2M) fund Fairshake, which has raised $137.9M. Fairshake splits its money between a Republican-side affiliate, Defend American Jobs ($37.0M), and a Democratic-side one, Protect Progress ($33.0M), and spends directly against Illinois Democrats including Juliana Stratton ($10.0M) and La Shawn Ford ($2.5M). Defend American Jobs backs Barry Moore ($12.2M), Andy Barr ($7.2M) and Randy Fine ($1.7M); Protect Progress backs Christian Menefee ($6.5M), Adrian Boafo ($5.3M) and Jasmine Clark ($4.2M). Crypto money also flows straight to Trump’s super PAC: Crypto.com’s operator Foris DAX gave MAGA Inc. $35.0M, its largest donor in this data, and Gemini Trust $24.4M. Coinbase hedges by giving $1.0M to each party’s House and Senate super PACs. Vanguard is Coinbase’s largest shareholder ($4.5B).',
    chains: [['vanguard', 'co_coinbase', 'fec_c00835959', 'fec_c00836221', 'cand_s6al00476'], ['co_ripple', 'fec_c00835959', 'fec_c00836221', 'cand_s6ky00286'], ['fec_c00835959', 'fec_c00836221', 'cand_h6fl06258'], ['co_coinbase', 'fec_c00835959', 'fec_c00848440', 'cand_h6tx18232'], ['fec_c00835959', 'fec_c00848440', 'cand_h6md05321'], ['fec_c00835959', 'fec_c00848440', 'cand_h6ga13070'], ['co_ripple', 'fec_c00835959', 'cand_s6il00458'], ['fec_c00835959', 'cand_h6il07354'], ['dorg_foris_dax', 'pac_maga'], ['co_ripple', 'pac_maga'], ['co_coinbase', 'fec_c00571703'], ['co_coinbase', 'fec_c00504530'], ['co_coinbase', 'fec_c00484642'], ['co_coinbase', 'fec_c00495028']],
  },
  {
    id: 'kentucky-proxy-war', theme: 'Money into politics', title: 'Kentucky’s open Senate seat became a billionaire and crypto proxy war',
    summary: 'For Mitch McConnell’s open seat, Elon Musk gave $10.0M and Thomas Klingenstein $2.5M to Fight For Kentucky, which spent $9.6M for Nate Morris and $3.8M against Rep. Andy Barr (filed as Garland Andy Barr). Jeff Yass’s Win It Back PAC added $4.4M against Barr, and Richard Uihlein’s Restoration of America PAC $1.7M for Morris. Barr’s side is funded differently: crypto’s Defend American Jobs spent $7.2M for him, and Keep America Great PAC spent $5.7M for Barr and $7.4M against Morris. Its funders are American Jobs and Growth Fund ($7.5M), Defend Us Inc. ($2.8M), Crypto.com’s operator Foris DAX ($2.4M) and Barr’s own joint fundraising committee ($338K).',
    chains: [['musk', 'fec_c00898130', 'cand_s6ky00302'], ['musk', 'fec_c00898130', 'cand_s6ky00286'], ['donor_klingenstein_thomas', 'fec_c00898130'], ['yass', 'fec_c00844613', 'cand_s6ky00286'], ['dn_uihlein', 'fec_c00571588', 'cand_s6ky00302'], ['co_coinbase', 'fec_c00835959', 'fec_c00836221', 'cand_s6ky00286'], ['dorg_foris_dax', 'fec_c00896365', 'cand_s6ky00286'], ['dorg_american_jobs_growth_fund', 'fec_c00896365', 'cand_s6ky00302'], ['dorg_defend_us', 'fec_c00896365'], ['fec_c00633792', 'fec_c00896365']],
  },
  {
    id: 'massie-primary', theme: 'Money into politics', title: 'Pro-Trump and pro-Israel super PACs teamed up against Thomas Massie',
    summary: 'Rep. Thomas Massie, a Kentucky Republican who often votes against his party’s leadership, drew three opposing super PACs. MAGA KY spent $6.2M against him and $1.3M for challenger Ed Gallrein, funded by Paul Singer ($1.0M) and John Paulson ($250K). AIPAC’s United Democracy Project spent $3.6M against him and RJC Victory Fund $363K. His main outside defender, Make Liberty Win, spent $1.1M.',
    chains: [['dn_singer', 'fec_c00908723', 'rep_massie'], ['donor_paulson_john_alfred', 'fec_c00908723', 'rep_massie'], ['fec_c00908723', 'cand_h6ky04171'], ['aipac', 'fec_c00799031', 'rep_massie'], ['fec_c00528554', 'rep_massie'], ['fec_c00731133', 'rep_massie']],
  },
  {
    id: 'michigan-primary', theme: 'Money into politics', title: 'Michigan’s Senate race: $48M in the Democratic primary, the Koch network behind Rogers',
    summary: 'In the Democratic primary, AIPAC gave $30.0M to its super PAC, United Democracy Project, which spent $20.1M against Abdul El-Sayed and $10.5M for Haley Stevens (other UDP donors include Paul Singer at $2.6M and Haim Saban at $2.0M). A Stronger Michigan, funded with $17.8M from Center Forward, spent $17.2M more for Stevens, and Center Forward’s own committee $1.0M. El-Sayed’s largest outside ally, Fighting For Michigan PAC, spent $1.1M. On the Republican side Mike Rogers has $7.1M from the Koch network’s AFP Action (which also spent $300K against El-Sayed), $4.5M from the NRSC, $3.3M from GLCF and $748K from SLF PAC, while WinSenate spent $1.9M against him.',
    chains: [['aipac', 'fec_c00799031', 'cand_s6mi00418'], ['aipac', 'fec_c00799031', 'cand_s6mi00426'], ['dn_singer', 'fec_c00799031'], ['donor_saban_haim', 'fec_c00799031'], ['dorg_center_forward', 'fec_c00952259', 'cand_s6mi00426'], ['dorg_center_forward', 'fec_c00568444', 'cand_s6mi00426'], ['fec_c00919373', 'cand_s6mi00418'], ['koch', 'fec_c00687103', 'cand_s4mi00595'], ['koch', 'fec_c00687103', 'cand_s6mi00418'], ['po_nrsc', 'cand_s4mi00595'], ['fec_c00853861', 'cand_s4mi00595'], ['adelson', 'fec_c00571703', 'cand_s4mi00595'], ['fec_c00865444', 'cand_s4mi00595']],
  },
  {
    id: 'udp-national', theme: 'Money into politics', title: 'AIPAC’s super PAC works House primaries from Maryland to California',
    summary: 'Beyond Michigan and Kentucky, United Democracy Project ($109.7M raised, $30.0M of it from AIPAC) is spending heavily in Democratic House primaries. It spent $5.7M for Adrian Boafo in Maryland, who also has $5.3M from crypto’s Protect Progress, and $5.0M for Melissa Conyears-Ervin in Illinois. It spent against Cori Bush in Missouri ($2.5M), Tom Malinowski in New Jersey ($2.3M) and Aisha Wahab in California ($1.6M).',
    chains: [['aipac', 'fec_c00799031', 'cand_h6md05321'], ['co_coinbase', 'fec_c00835959', 'fec_c00848440', 'cand_h6md05321'], ['aipac', 'fec_c00799031', 'cand_h4il07177'], ['aipac', 'fec_c00799031', 'cand_h8mo01143'], ['aipac', 'fec_c00799031', 'cand_h6nj11245'], ['aipac', 'fec_c00799031', 'cand_h0ca15213']],
  },
  {
    id: 'texas-paxton', theme: 'Money into politics', title: 'Texas Senate primary: $25M against Paxton, and a counter-PAC against Cornyn',
    summary: 'Texans for a Conservative Majority ($37.3M raised; its FEC registration lists the Cornyn Victory Committee as an affiliate) spent $25.0M against Attorney General Ken Paxton (filed as Warren Kenneth Paxton Jr.), $5.1M against Rep. Wesley Hunt and $5.3M for Sen. John Cornyn. Its funders include John L. Nau III ($7.9M), Ohio Works Inc. ($5.5M), America Works Fund ($3.4M), Stephen Schwarzman ($1.5M) and Energy Transfer ($1.0M). On the other side, Lone Star Liberty PAC ($10.3M raised; top donors Douglas Scharbauer at $1.2M and Jonathan Knutz at $1.1M) spent $3.6M against Cornyn, $3.1M against Hunt and $770K for Paxton, and Texans Demanding Accountability spent $1.9M against Paxton.',
    chains: [['donor_nau_john_mr_iii', 'fec_c00542217', 'cand_s6tx00388'], ['dorg_ohio_works', 'fec_c00542217', 'rep_hunt'], ['dorg_america_works_fund', 'fec_c00542217'], ['dn_schwarzman', 'fec_c00542217'], ['co_et', 'fec_c00542217', 'sen_cornyn'], ['donor_scharbauer_douglas', 'fec_c00901223', 'sen_cornyn'], ['donor_knutz_jonathan', 'fec_c00901223', 'cand_s6tx00388'], ['fec_c00901223', 'rep_hunt'], ['fec_c00948695', 'cand_s6tx00388']],
  },
  {
    id: 'koch-afp', theme: 'Money into politics', title: 'The Koch network’s $50M runs through AFP Action into eight Senate races',
    summary: 'The Koch network gave $50.0M to Americans for Prosperity Action ($93.8M raised), joined by Walmart heirs Jim and Rob Walton ($7.0M each) and Stand Together Chamber of Commerce ($6.5M), a 501(c)(4) that does not disclose its donors. AFP Action’s biggest bets are Senate races: $7.1M for Mike Rogers in Michigan, $4.7M for Michael Whatley in North Carolina, $3.6M for Sen. Jon Husted in Ohio, $3.6M for Ashley Hinson in Iowa (filed as Ashley Arenholz), $2.9M for John Sununu in New Hampshire and $2.1M for Kurt Alme in Montana, plus $1.8M each against Democrats Sherrod Brown and Roy Cooper.',
    chains: [['koch', 'fec_c00687103', 'cand_s4mi00595'], ['koch', 'fec_c00687103', 'cand_s6nc00415'], ['koch', 'fec_c00687103', 'sen_husted'], ['koch', 'fec_c00687103', 'cand_s6ia00314'], ['koch', 'fec_c00687103', 'cand_s6nh00208'], ['koch', 'fec_c00687103', 'cand_s6mt00295'], ['koch', 'fec_c00687103', 'cand_s6oh00163'], ['koch', 'fec_c00687103', 'cand_s6nc00407'], ['donor_walton_jim', 'fec_c00687103'], ['donor_walton_robson', 'fec_c00687103'], ['dk_stc', 'fec_c00687103']],
  },
  {
    id: 'maga-inc-donors', theme: 'Money into politics', title: 'Who funds MAGA Inc.’s $424M',
    summary: 'MAGA Inc., the pro-Trump super PAC, has raised $424.4M this cycle. Its largest donors in this data are Crypto.com’s operator Foris DAX ($35.0M), Miriam Adelson ($25.0M), Diane Hendricks ($25.0M), Gemini Trust ($24.4M), MAGA-aligned 501(c)(4)s that don’t disclose their donors ($21.3M), Jeff Yass ($16.0M), OpenAI president Greg Brockman and Anna Brockman ($12.5M each), Energy Transfer and its chairman Kelcy Warren ($12.5M each), Andreessen Horowitz ($6.0M) and Elon Musk ($5.0M). Its candidate spending in this data is small by comparison, led by about $845K each for Matt Van Epps and against Aftyn Behn in a Tennessee special House election.',
    chains: [['dorg_foris_dax', 'pac_maga'], ['adelson', 'pac_maga'], ['dn_marcus', 'pac_maga'], ['co_ripple', 'pac_maga'], ['dk_sag', 'pac_maga'], ['yass', 'pac_maga'], ['openai', 'donor_brockman_greg', 'pac_maga'], ['donor_brockman_anna', 'pac_maga'], ['co_et', 'pac_maga'], ['co_et', 'donor_warren_kelcy_mr', 'pac_maga'], ['a16z', 'pac_maga'], ['musk', 'pac_maga'], ['pac_maga', 'cand_h6tn07161'], ['pac_maga', 'cand_h6tn07195']],
  },
  {
    id: 'parked-money', theme: 'Money into politics', title: 'Hundreds of millions raised, little spent on candidates (so far)',
    summary: 'Several of the cycle’s biggest super PACs report little or no spending for or against federal candidates in this data. Leading the Future (AI industry) raised $75.8M, Win For America (sports betting) $72.0M, Restoration of America PAC (Uihlein) $60.8M, Elon Musk’s America PAC $50.3M and V-Pac: Victors, Not Victims $41.8M, funded by Jeff Yass ($20.0M), Ross Stevens ($6.0M) and Musk ($5.0M). That is about $300M held for later, spent on activity that isn’t reported as candidate spending, or both.',
    chains: [['a16z', 'pac_ltf'], ['co_dkng', 'fec_c00925586'], ['dn_uihlein', 'fec_c00571588'], ['musk', 'fec_c00879510'], ['yass', 'fec_c00892919'], ['musk', 'fec_c00892919'], ['donor_stevens_ross_mr', 'fec_c00892919']],
  },
  {
    id: 'ai-money', theme: 'Money into politics', title: 'AI money: an industry super PAC sits on $76M while a rival network funds both parties',
    summary: 'Leading the Future raised $75.8M, $50.0M from Andreessen Horowitz and $12.5M each from OpenAI president Greg Brockman and Anna Brockman, and reports no candidate spending in this data; the Brockmans gave another $12.5M each to MAGA Inc. A different network is spending. Public First Action gave $15.4M to Jobs and Democracy PAC, which spent $15.0M for Alex Bores in New York’s 12th District (Bores sponsored New York’s RAISE Act on AI safety) and $1.6M for Rep. Valerie Foushee, and $7.9M to the Republican-side Defending Our Values PAC, which backs candidates such as Carlos De La Cruz ($1.5M) and Kevin Hern ($808K). AI researcher Jan Leike gave $100K to each.',
    chains: [['a16z', 'pac_ltf'], ['openai', 'donor_brockman_greg', 'pac_ltf'], ['donor_brockman_anna', 'pac_ltf'], ['donor_brockman_greg', 'pac_maga'], ['dorg_public_first_action', 'fec_c00928374', 'cand_h6ny12214'], ['dorg_public_first_action', 'fec_c00928374', 'cand_h2nc06114'], ['dorg_public_first_action', 'fec_c00928390', 'cand_h6tx35087'], ['dorg_public_first_action', 'fec_c00928390', 'cand_s6ok04247'], ['donor_leike_jan', 'fec_c00928374'], ['donor_leike_jan', 'fec_c00928390']],
  },
  {
    id: 'sports-betting', theme: 'Money into politics', title: 'Sports betting built a $72M super PAC and pays every leadership PAC',
    summary: 'DraftKings ($34.0M) and FanDuel’s parent Flutter Entertainment ($27.0M), joined by FBG Enterprises Opco ($5.5M) and Hillside (Shared Services US) ($5.5M), fund Win For America, which raised $72.0M but reports no candidate spending in this data. Flutter also gave $500K to each of the four congressional leadership super PACs, DraftKings $500K to the Senate Republicans’ SLF PAC, and the Sports Betting Alliance $650K to V-Pac. Both companies are owned mostly by institutions; Vanguard is the largest holder of each ($944M of DraftKings, $1.5B of Flutter).',
    chains: [['vanguard', 'co_dkng', 'fec_c00925586'], ['vanguard', 'co_flut', 'fec_c00925586'], ['dorg_fbg_enterprise_opco', 'fec_c00925586'], ['dorg_hillside_shared_services_us', 'fec_c00925586'], ['co_flut', 'fec_c00571703'], ['co_flut', 'fec_c00504530'], ['co_flut', 'fec_c00484642'], ['co_flut', 'fec_c00495028'], ['co_dkng', 'fec_c00571703'], ['irs_874117395', 'fec_c00892919']],
  },
  {
    id: 'uihlein-restoration', theme: 'Money into politics', title: 'Uline’s owners: $57.7M to one super PAC, and gifts across the GOP',
    summary: 'Richard and Elizabeth Uihlein gave $57.7M to Restoration of America PAC, the largest amount any individual donor in this data gave to one committee, and its affiliated 501(c)(4) added $1.7M. The PAC has spent little so far: $1.7M for Nate Morris in Kentucky and a $2.5M transfer to Club for Growth Action. The Uihleins also gave $4.0M to Fair Courts America, which works on state supreme court races, and around $1M each to CLF, SLF PAC, the NRSC and the RNC.',
    chains: [['dn_uihlein', 'fec_c00571588', 'cand_s6ky00302'], ['dn_uihlein', 'fec_c00571588', 'fec_c00487470'], ['irs_472862042', 'fec_c00571588'], ['dn_uihlein', 'fec_c00805283'], ['dn_uihlein', 'fec_c00504530'], ['dn_uihlein', 'fec_c00571703'], ['dn_uihlein', 'po_nrsc'], ['dn_uihlein', 'po_rnc']],
  },
  {
    id: 'trump-jfc', theme: 'Money into politics', title: 'Trump’s fundraising pipeline: JFC to leadership PAC, RNC and state parties',
    summary: 'Trump National Committee JFC raised $98.6M and transferred $42.1M to Never Surrender, Inc., a leadership PAC, and $24.5M to the Republican National Committee. Never Surrender moved $2.4M to Save America, $665K to Grow The Majority and $575K to Make America Great Again PAC. The RNC ($316.3M raised) passes money down to the NRSC ($3.5M) and to state parties, led by North Carolina ($934K), Virginia ($519K) and Pennsylvania ($484K). Large individual RNC donors include Stephen Wynn and Richard Uihlein ($886K each).',
    chains: [['fec_c00873893', 'fec_c00828541', 'fec_c00762591'], ['fec_c00873893', 'fec_c00828541', 'fec_c00858373'], ['fec_c00873893', 'fec_c00828541', 'fec_c00580100'], ['fec_c00867937', 'fec_c00828541'], ['fec_c00873893', 'po_rnc', 'po_nrsc'], ['fec_c00873893', 'po_rnc', 'fec_c00038505'], ['fec_c00873893', 'po_rnc', 'fec_c00001305'], ['fec_c00873893', 'po_rnc', 'fec_c00044842'], ['donor_wynn_stephen', 'po_rnc'], ['dn_uihlein', 'po_rnc']],
  },
  // ---------------- Dark money ----------------
  {
    id: 'leadership-c4s', theme: 'Dark money', title: 'Congress’s four leadership super PACs: $768M raised, $238M from undisclosed donors',
    summary: 'Each party’s House and Senate leadership super PAC is paired with a 501(c)(4) that doesn’t disclose its donors, and that c4 is its biggest funder: One Nation gave $70.7M to SLF PAC, House Majority Forward $61.7M to HMP, Majority Forward $61.0M to SMP, and American Action Network $44.3M to CLF. Together the four PACs have raised $767.7M. Their largest disclosed donors are billionaires: Miriam Adelson ($30.0M to SLF, $10.0M to CLF), Stephen Schwarzman ($17.0M to SLF), Paul Singer ($14.5M to SLF, $8.0M to CLF), Elon Musk ($10.0M to each) and Ken Griffin ($10.0M to SLF) on the Republican side; a donor group led by Fred Eychaner ($11.5M to SMP, $5.2M to HMP) and George Marcus ($4.3M to HMP) on the Democratic side.',
    chains: [['dk_onenation', 'fec_c00571703', 'cand_s4mi00595'], ['adelson', 'fec_c00571703'], ['dn_schwarzman', 'fec_c00571703'], ['dn_singer', 'fec_c00571703'], ['musk', 'fec_c00571703'], ['dn_griffin', 'fec_c00571703'], ['dk_aan', 'fec_c00504530', 'cand_h2ca20094'], ['adelson', 'fec_c00504530'], ['musk', 'fec_c00504530'], ['dn_singer', 'fec_c00504530'], ['dk_hmf', 'fec_c00495028', 'cand_h6tn07161'], ['dn_simons', 'fec_c00495028'], ['donor_marcus_george_m', 'fec_c00495028'], ['dk_majfwd', 'fec_c00484642', 'fec_c00865444'], ['dn_simons', 'fec_c00484642']],
  },
  // ---------------- Ownership ----------------
  {
    id: 'index-berkshire-apple', theme: 'Ownership', title: 'Index giants own Berkshire, and Berkshire owns a slice of corporate America',
    summary: 'Vanguard holds $78.8B of Berkshire Hathaway, BlackRock $58.4B and State Street $35.7B; the Gates Foundation Trust holds $8.2B. Berkshire in turn holds $57.8B of Apple, $45.9B of American Express (27.0% of its institutional ownership), $30.4B of Coca-Cola, $25.0B of Bank of America, $17.5B of Chevron and $17.2B of Occidental Petroleum (33.3%). The same index funds also own Apple directly, Vanguard alone $364.6B, so they sit on both ends of the chain.',
    chains: [['vanguard', 'berkshire', 'apple'], ['blackrock', 'berkshire', 'co_axp'], ['statestreet', 'berkshire', 'co_ko'], ['im_gates_foundation_trust', 'berkshire', 'bofa'], ['berkshire', 'chevron'], ['berkshire', 'co_oxy'], ['vanguard', 'apple']],
  },
  {
    id: 'mufg-morgan-stanley', theme: 'Ownership', title: 'A Japanese bank is Morgan Stanley’s biggest owner, and Morgan Stanley holds Big Tech',
    summary: 'Mitsubishi UFJ Financial Group’s $62.1B stake is 29.3% of all institutional holdings in Morgan Stanley, a strategic position dating to the 2008 financial crisis and three times Vanguard’s ($19.8B). Morgan Stanley’s own asset-management arm reports $62.0B of Apple, $59.8B of Nvidia, $55.3B of Alphabet, $46.2B of Microsoft, $36.2B of Amazon, $21.8B of Meta and $14.6B of Tesla.',
    chains: [['im_mitsubishi_ufj_financial_group_inc', 'ms', 'apple'], ['im_mitsubishi_ufj_financial_group_inc', 'ms', 'nvidia'], ['ms', 'alphabet'], ['ms', 'microsoft'], ['ms', 'amazon'], ['ms', 'meta'], ['ms', 'co_tsla'], ['vanguard', 'ms']],
  },
  {
    id: 'lilly-endowment', theme: 'Ownership', title: 'A foundation is Eli Lilly’s largest owner',
    summary: 'The Lilly Endowment’s $84.5B stake is 12.3% of all institutional holdings in Eli Lilly, more than Vanguard ($76.0B) or BlackRock ($61.1B), which makes a private foundation the most powerful owner in the world’s most valuable drugmaker. PNC holds another $47.2B. Lilly, in turn, presses Medicare to cover its obesity drugs.',
    chains: [['npo_lilly_endow', 'co_lilly', 'cms'], ['vanguard', 'co_lilly'], ['blackrock', 'co_lilly'], ['co_pnc', 'co_lilly']],
  },
  // ---------------- Chains of command ----------------
  {
    id: 'command-navy', theme: 'Chains of command', title: 'From the Constitution to the fleet',
    summary: 'Article I gives Congress the power of the purse and Article II makes the President commander in chief. Both run to the Defense Department, which obligated $1.45T in fiscal 2025, and on to the military departments: the Navy ($177.3B in contracts and grants), Army ($111.8B) and Air Force ($99.6B). The Navy’s ships come from Huntington Ingalls ($8.8B) and General Dynamics ($23.7B, including Electric Boat). The constitutional links are legal authority rather than money, so they are scored as estimates.',
    chains: [['constitution', 'potus', 'dod', 'navy'], ['constitution', 'congress', 'dod', 'army'], ['dod', 'airforce'], ['dod', 'co_hii'], ['dod', 'co_gd']],
  },
];
