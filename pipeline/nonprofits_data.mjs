// Raw source data for the ~500-node nonprofit expansion (pipeline/additions2.mjs turns this into nodes/edges).
// Hospital, PBS-station and foundation names/cities are pulled from Wikipedia's lists (see project memory);
// everything else is well-established, low-volatility public knowledge (long-standing national organizations).
// Figures are rounded annual-revenue/endowment estimates, consistent with the rest of the map's editorial,
// "verify before citing" figures.

export const FOUNDATIONS2 = [
  { name: 'Howard Hughes Medical Institute', endowment: 27.1e9, grants: 1e9, desc: 'One of the largest biomedical research funders in the world; also directly employs its own investigators rather than only awarding grants.' },
  { name: 'J. Paul Getty Trust', endowment: 10.4e9, grants: 0.4e9, desc: 'Endows the Getty museums and conservation and research institutes in Los Angeles.' },
  { name: 'Gordon and Betty Moore Foundation', endowment: 9.5e9, grants: 0.4e9, desc: 'Intel co-founder’s foundation; funds environmental conservation, science and patient care.' },
  { name: 'Margaret A. Cargill Philanthropies', endowment: 9.2e9, grants: 0.3e9, desc: 'Cargill-family foundation funding disaster relief, the environment and Native American communities.' },
  { name: 'Leona M. and Harry B. Helmsley Charitable Trust', endowment: 8.3e9, grants: 0.4e9, desc: 'Funds rural health care, type 1 diabetes research and Jewish life programs.' },
  { name: 'Michael & Susan Dell Foundation', endowment: 7.5e9, grants: 0.15e9, desc: 'Michael Dell’s foundation, focused on childhood poverty in the U.S., India and sub-Saharan Africa.' },
  { name: 'Andrew W. Mellon Foundation', endowment: 6.2e9, grants: 0.25e9, desc: 'The largest funder of the humanities and higher education in the U.S.' },
  { name: 'Conrad N. Hilton Foundation', endowment: 5.9e9, grants: 0.2e9, desc: 'Funds homelessness, safe water and early-childhood programs; awards the Hilton Humanitarian Prize.' },
  { name: 'Nemours Foundation', endowment: 4.6e9, grants: 1.5e9, desc: 'Operates the Nemours Children’s Health hospital system from an endowment built by DuPont heir Alfred I. du Pont.' },
  { name: 'Carnegie Corporation of New York', endowment: 4.1e9, grants: 0.15e9, desc: 'Andrew Carnegie’s original foundation; education, democracy and international peace grantmaking.' },
  { name: 'Mother Cabrini Health Foundation', endowment: 4e9, grants: 0.2e9, desc: 'Formed from the sale of a Catholic health system; funds underserved health care in New York State.' },
  { name: 'The Kresge Foundation', endowment: 3.6e9, grants: 0.16e9, desc: 'Funds community development, arts and health equity, largely in American cities.' },
  { name: 'California Health Care Foundation', endowment: 3.6e9, grants: 0.15e9, desc: 'California-only health-policy and access grantmaker.' },
  { name: 'Cleveland Foundation', endowment: 2.8e9, grants: 0.1e9, desc: 'The first community foundation in the world (1914); funds Cleveland-area civic and social programs.' },
  { name: 'Greater Kansas City Community Foundation', endowment: 2.7e9, grants: 0.5e9, desc: 'One of the largest community foundations by assets, largely donor-advised funds.' },
];

// [name, city, state] — a distributed subset of the Wikipedia children's-hospital list, favoring one or two
// flagship nonprofit children's hospitals per state.
export const CHILDRENS_HOSPITALS = [
  ["Children's of Alabama", 'Birmingham', 'AL'], ["Arkansas Children's Hospital", 'Little Rock', 'AR'],
  ['Phoenix Children\'s Hospital', 'Phoenix', 'AZ'], ["Children's Hospital Los Angeles", 'Los Angeles', 'CA'],
  ["Children's Hospital of Orange County", 'Orange', 'CA'], ['Lucile Packard Children\'s Hospital Stanford', 'Palo Alto', 'CA'],
  ["Rady Children's Hospital", 'San Diego', 'CA'], ['UCSF Benioff Children\'s Hospital', 'San Francisco', 'CA'],
  ["Valley Children's Hospital", 'Madera', 'CA'], ["Children's Hospital Colorado", 'Aurora', 'CO'],
  ["Connecticut Children's Medical Center", 'Hartford', 'CT'], ["Children's National Hospital", 'Washington', 'DC'],
  ["Nemours Children's Hospital", 'Wilmington', 'DE'], ["Arnold Palmer Hospital for Children", 'Orlando', 'FL'],
  ["Nicklaus Children's Hospital", 'Miami', 'FL'], ['Johns Hopkins All Children\'s Hospital', 'St. Petersburg', 'FL'],
  ["Children's Healthcare of Atlanta", 'Atlanta', 'GA'], ["Kapi'olani Medical Center for Women & Children", 'Honolulu', 'HI'],
  ["St. Luke's Children's Hospital", 'Boise', 'ID'], ['Ann and Robert H. Lurie Children\'s Hospital of Chicago', 'Chicago', 'IL'],
  ["University of Chicago Comer Children's Hospital", 'Chicago', 'IL'], ["Riley Hospital for Children", 'Indianapolis', 'IN'],
  ["Peyton Manning Children's Hospital", 'Indianapolis', 'IN'], ["Blank Children's Hospital", 'Des Moines', 'IA'],
  ["University of Iowa Stead Family Children's Hospital", 'Iowa City', 'IA'], ["Children's Mercy Kansas City", 'Kansas City', 'KS'],
  ["Norton Children's Hospital", 'Louisville', 'KY'], ["Manning Family Children's Hospital", 'New Orleans', 'LA'],
  ["Barbara Bush Children's Hospital", 'Portland', 'ME'], ["Johns Hopkins Children's Center", 'Baltimore', 'MD'],
  ["Boston Children's Hospital", 'Boston', 'MA'], ['MassGeneral Hospital for Children', 'Boston', 'MA'],
  ["C.S. Mott Children's Hospital", 'Ann Arbor', 'MI'], ["Helen DeVos Children's Hospital", 'Grand Rapids', 'MI'],
  ["Children's Minnesota", 'Minneapolis', 'MN'], ["Gillette Children's Specialty Healthcare", 'St. Paul', 'MN'],
  ["Children's of Mississippi", 'Jackson', 'MS'], ["Children's Mercy Hospital", 'Kansas City', 'MO'],
  ["St. Louis Children's Hospital", 'St. Louis', 'MO'], ["Children's Nebraska", 'Omaha', 'NE'],
  ["Sunrise Children's Hospital", 'Las Vegas', 'NV'], ["Children's Hospital at Dartmouth", 'Lebanon', 'NH'],
  ['Bristol Myers Squibb Children\'s Hospital', 'New Brunswick', 'NJ'], ["University of New Mexico Children's Hospital", 'Albuquerque', 'NM'],
  ["Hassenfeld Children's Hospital", 'New York', 'NY'], ["Golisano Children's Hospital", 'Rochester', 'NY'],
  ['Steven and Alexandra Cohen Children\'s Medical Center', 'New Hyde Park', 'NY'], ["Duke Children's Hospital", 'Durham', 'NC'],
  ["Levine Children's Hospital", 'Charlotte', 'NC'], ["UNC Children's Hospital", 'Chapel Hill', 'NC'],
  ["Akron Children's Hospital", 'Akron', 'OH'], ["Cincinnati Children's Hospital Medical Center", 'Cincinnati', 'OH'],
  ["Nationwide Children's Hospital", 'Columbus', 'OH'], ["The Children's Hospital of Oklahoma", 'Oklahoma City', 'OK'],
  ["Doernbecher Children's Hospital", 'Portland', 'OR'], ["Children's Hospital of Philadelphia", 'Philadelphia', 'PA'],
  ["UPMC Children's Hospital of Pittsburgh", 'Pittsburgh', 'PA'], ["Hasbro Children's Hospital", 'Providence', 'RI'],
  ["Prisma Health Children's Hospital", 'Greenville', 'SC'], ["Sanford Health Children's Hospital", 'Sioux Falls', 'SD'],
  ["Le Bonheur Children's Medical Center", 'Memphis', 'TN'], ["Monroe Carell Jr. Children's Hospital at Vanderbilt", 'Nashville', 'TN'],
  ["St. Jude Children's Research Hospital", 'Memphis', 'TN'], ["Texas Children's Hospital", 'Houston', 'TX'],
  ["Children's Medical Center Dallas", 'Dallas', 'TX'], ["Cook Children's Healthcare System", 'Fort Worth', 'TX'],
  ["Dell Children's Medical Center", 'Austin', 'TX'], ["Primary Children's Hospital", 'Salt Lake City', 'UT'],
  ["University of Vermont Children's Hospital", 'Burlington', 'VT'], ["Children's Hospital of The King's Daughters", 'Norfolk', 'VA'],
  ["Children's Hospital of Richmond at VCU", 'Richmond', 'VA'], ["Seattle Children's", 'Seattle', 'WA'],
  ["Mary Bridge Children's Hospital", 'Tacoma', 'WA'], ["West Virginia University Children's Hospital", 'Morgantown', 'WV'],
  ["American Family Children's Hospital", 'Madison', 'WI'], ["Children's Wisconsin", 'Wauwatosa', 'WI'],
  ["Children's Hospital Colorado Colorado Springs", 'Colorado Springs', 'CO'], ["Yale-New Haven Children's Hospital", 'New Haven', 'CT'],
  ["Wolfson Children's Hospital", 'Jacksonville', 'FL'], ["Joe DiMaggio Children's Hospital", 'Hollywood', 'FL'],
  ["St. Joseph's Children's Hospital", 'Tampa', 'FL'], ["Shriners Children's Florida", 'Tampa', 'FL'],
  ["Children's Hospital of Georgia", 'Augusta', 'GA'], ["Advocate Children's Hospital", 'Oak Lawn', 'IL'],
  ["Rush University Children's Hospital", 'Chicago', 'IL'], ["Beacon Children's Hospital", 'South Bend', 'IN'],
  ["MercyOne Children's Hospital", 'Des Moines', 'IA'], ["Shriners Children's Lexington", 'Lexington', 'KY'],
  ["University of Kentucky Children's Hospital", 'Lexington', 'KY'], ["Our Lady of the Lake Children's Hospital", 'Baton Rouge', 'LA'],
  ['Kennedy Krieger Institute', 'Baltimore', 'MD'], ["Floating Hospital for Children", 'Boston', 'MA'],
  ["Franciscan Hospital for Children", 'Boston', 'MA'], ["Children's Hospital of Michigan", 'Detroit', 'MI'],
  ["Hurley Children's Hospital", 'Flint', 'MI'], ["Cardinal Glennon Children's Hospital", 'St. Louis', 'MO'],
  ["Ranken Jordan Pediatric Bridge Hospital", 'Maryland Heights', 'MO'], ["Montana Children's Medical Center", 'Kalispell', 'MT'],
  ["Renown Children's Hospital", 'Reno', 'NV'], ["Children's Specialized Hospital", 'New Brunswick', 'NJ'],
  ["Goryeb Children's Hospital", 'Morristown', 'NJ'], ["Blythedale Children's Hospital", 'Valhalla', 'NY'],
  ["Children's Hospital at Montefiore", 'Bronx', 'NY'], ["Memorial Sloan Kettering Children's Cancer Center", 'New York', 'NY'],
  ["Stony Brook Children's Hospital", 'Stony Brook', 'NY'], ["Brenner Children's Hospital", 'Winston-Salem', 'NC'],
  ["Dayton Children's Hospital", 'Dayton', 'OH'], ["Rainbow Babies & Children's Hospital", 'Cleveland', 'OH'],
  ["Randall Children's Hospital", 'Portland', 'OR'], ["St. Christopher's Hospital for Children", 'Philadelphia', 'PA'],
  ["Penn State Children's Hospital", 'Hershey', 'PA'], ["Bradley Hospital", 'Providence', 'RI'],
  ["MUSC Shawn Jenkins Children's Hospital", 'Charleston', 'SC'], ["East Tennessee Children's Hospital", 'Knoxville', 'TN'],
  ["Children's Hospital of San Antonio", 'San Antonio', 'TX'], ["Driscoll Children's Hospital", 'Corpus Christi', 'TX'],
  ["El Paso Children's Hospital", 'El Paso', 'TX'], ["Carilion Clinic Children's Hospital", 'Roanoke', 'VA'],
  ["INOVA Children's Hospital", 'Falls Church', 'VA'], ["Sacred Heart Children's Hospital", 'Spokane', 'WA'],
  ["CAMC Women and Children's Hospital", 'Charleston', 'WV'],
];

// [display, city] — a curated subset of PBS member stations, skipping most "Statewide" network duplicates.
export const PBS_STATIONS = [
  ['Alaska Public Media (KAKM)', 'Anchorage'], ['Arizona PBS (KAET)', 'Phoenix'], ['Valley PBS (KVPT)', 'Fresno'],
  ['PBS SoCal / KCET', 'Los Angeles'], ['KQED', 'San Francisco'], ['KPBS', 'San Diego'],
  ['Rocky Mountain PBS', 'Denver'], ['Connecticut Public Television', 'Hartford'], ['WETA', 'Washington'],
  ['WHUT', 'Washington'], ['WGCU', 'Fort Myers'], ['WJCT', 'Jacksonville'], ['South Florida PBS (WPBT)', 'Miami'],
  ['WEDU', 'Tampa'], ['Georgia Public Broadcasting', 'Atlanta'], ['PBS Hawai\'i', 'Honolulu'],
  ['Idaho Public Television', 'Boise'], ['WTTW', 'Chicago'], ['Illinois Public Media (WILL)', 'Champaign'],
  ['WFYI', 'Indianapolis'], ['Iowa PBS', 'Johnston'], ['PBS Kansas (KPTS)', 'Wichita'],
  ['Kentucky Educational Television', 'Lexington'], ['Louisiana Public Broadcasting', 'Baton Rouge'],
  ['WYES-TV', 'New Orleans'], ['Maine Public', 'Portland'], ['Maryland Public Television', 'Owings Mills'],
  ['GBH (WGBH)', 'Boston'], ['Detroit PBS (WTVS)', 'Detroit'], ['WKAR', 'East Lansing'],
  ['Twin Cities PBS', 'St. Paul'], ['Mississippi Public Broadcasting', 'Jackson'], ['KETC / Nine PBS', 'St. Louis'],
  ['Kansas City PBS', 'Kansas City'], ['Montana PBS', 'Bozeman'], ['Nebraska Public Media', 'Lincoln'],
  ['Vegas PBS', 'Las Vegas'], ['New Hampshire PBS', 'Durham'], ['NJ PBS', 'Trenton'],
  ['WNET', 'New York'], ['WLIW', 'New York'], ['New Mexico PBS', 'Albuquerque'], ['WMHT', 'Albany'],
  ['WXXI-TV', 'Rochester'], ['WCNY-TV', 'Syracuse'], ['Buffalo Toronto Public Media (WNED)', 'Buffalo'],
  ['PBS North Carolina', 'Research Triangle Park'], ['PBS Charlotte (WTVI)', 'Charlotte'],
  ['Prairie Public Broadcasting', 'Fargo'], ['Ideastream Public Media', 'Cleveland'], ['WOSU-TV', 'Columbus'],
  ['ThinkTV', 'Dayton'], ['WGTE-TV', 'Toledo'], ['Oklahoma Educational Television Authority', 'Oklahoma City'],
  ['Oregon Public Broadcasting', 'Portland'], ['WHYY-TV', 'Philadelphia'], ['WQED', 'Pittsburgh'],
  ['WITF-TV', 'Harrisburg'], ['South Carolina ETV', 'Columbia'], ['South Dakota Public Broadcasting', 'Vermillion'],
  ['Nashville PBS (WNPT)', 'Nashville'], ['WKNO', 'Memphis'], ['Austin PBS (KLRU)', 'Austin'],
  ['KERA-TV', 'Dallas'], ['Houston Public Media (KUHT)', 'Houston'], ['KLRN', 'San Antonio'],
  ['PBS Utah', 'Salt Lake City'], ['Vermont Public', 'Colchester'], ['VPM PBS', 'Richmond'],
  ['WHRO-TV', 'Norfolk'], ['Cascade PBS (KCTS)', 'Seattle'], ['KSPS-TV', 'Spokane'],
  ['West Virginia Public Broadcasting', 'Charleston'], ['PBS Wisconsin', 'Madison'], ['Milwaukee PBS', 'Milwaukee'],
  ['Wyoming PBS', 'Riverton'], ['Alabama Public Television', 'Birmingham'], ['Arkansas PBS', 'Conway'],
  ['WEDU Tampa', 'Tampa'], ['WFSU-TV', 'Tallahassee'], ['WUFT', 'Gainesville'],
];

export const ORCHESTRAS = [
  { name: 'New York Philharmonic', city: 'New York, NY' }, { name: 'Boston Symphony Orchestra', city: 'Boston, MA' },
  { name: 'Chicago Symphony Orchestra', city: 'Chicago, IL' }, { name: 'Cleveland Orchestra', city: 'Cleveland, OH' },
  { name: 'Philadelphia Orchestra', city: 'Philadelphia, PA' }, { name: 'Los Angeles Philharmonic', city: 'Los Angeles, CA' },
  { name: 'San Francisco Symphony', city: 'San Francisco, CA' }, { name: 'Metropolitan Opera', city: 'New York, NY' },
  { name: 'Cincinnati Symphony Orchestra', city: 'Cincinnati, OH' }, { name: 'National Symphony Orchestra', city: 'Washington, DC' },
];

export const MUSEUMS = [
  { name: 'Whitney Museum of American Art', city: 'New York, NY' }, { name: 'National Gallery of Art', city: 'Washington, DC' },
  { name: 'Art Institute of Chicago', city: 'Chicago, IL' }, { name: 'Museum of Fine Arts, Houston', city: 'Houston, TX' },
  { name: 'Brooklyn Museum', city: 'Brooklyn, NY' }, { name: 'Los Angeles County Museum of Art', city: 'Los Angeles, CA' },
  { name: 'Museum of Fine Arts, Boston', city: 'Boston, MA' }, { name: 'de Young Museum & Legion of Honor', city: 'San Francisco, CA' },
];

export const DISEASE_CHARITIES = [
  { name: 'Leukemia & Lymphoma Society', desc: 'The largest nonprofit funder of blood-cancer research.' },
  { name: 'Cystic Fibrosis Foundation', desc: 'Funds CF drug development and a nationwide specialized-care network.' },
  { name: 'Muscular Dystrophy Association', desc: 'Funds research and clinics for ALS, muscular dystrophy and related neuromuscular diseases.' },
  { name: "Michael J. Fox Foundation", desc: "The largest nonprofit funder of Parkinson's disease research." },
  { name: 'ALS Association', desc: 'Funds ALS research and patient services; behind the 2014 Ice Bucket Challenge.' },
  { name: "Alzheimer's Association", desc: "The leading voluntary health organization for Alzheimer's care, support and research." },
  { name: 'Autism Speaks', desc: 'Funds autism research and advocates for services and insurance coverage.' },
  { name: 'National Multiple Sclerosis Society', desc: 'Funds MS research and connects patients to services nationwide.' },
  { name: 'Arthritis Foundation', desc: 'Funds arthritis research and advocacy; the largest patient-advocacy organization for the disease.' },
  { name: "Crohn's & Colitis Foundation", desc: 'Funds research into inflammatory bowel disease.' },
  { name: 'JDRF (Breakthrough T1D)', desc: 'The leading funder of type 1 diabetes research worldwide.' },
  { name: 'National Kidney Foundation', desc: 'Funds kidney-disease research and organ-donation advocacy.' },
  { name: 'American Diabetes Association', desc: 'Funds diabetes research and runs public-awareness and advocacy campaigns.' },
  { name: 'American Lung Association', desc: 'Funds lung-disease research and tobacco-control and clean-air advocacy.' },
  { name: 'Epilepsy Foundation', desc: 'Patient services and research funding for epilepsy.' },
  { name: 'National Alliance on Mental Illness (NAMI)', desc: 'The largest grassroots mental-health advocacy organization in the U.S.' },
  { name: 'National Down Syndrome Society', desc: 'Advocacy and research funding for Down syndrome.' },
  { name: 'Lymphoma Research Foundation', desc: 'The largest nonprofit devoted solely to funding lymphoma research.' },
  { name: 'Susan G. Komen (national office)', desc: 'Breast-cancer research and screening-access advocacy (see also npo_komen entry from a prior batch).' },
  { name: 'National Organization for Rare Disorders (NORD)', desc: 'Advocates for the roughly 30 million Americans with a rare disease.' },
];

export const LAND_TRUSTS = [
  { name: 'The Trust for Public Land', desc: 'Buys and protects land for parks and public access nationwide.' },
  { name: 'Land Trust Alliance', desc: 'National umbrella and accreditation body for the roughly 1,000 local and regional land trusts.' },
  { name: 'American Farmland Trust', desc: 'Protects farmland from development and promotes conservation agriculture.' },
  { name: 'Chesapeake Bay Foundation', desc: 'Advocacy and restoration group for the Chesapeake Bay watershed.' },
  { name: 'Trout Unlimited', desc: 'Coldwater fisheries conservation nonprofit.' },
  { name: 'Ducks Unlimited', desc: 'Wetland and waterfowl habitat conservation; a major land-easement holder.' },
  { name: 'National Wildlife Federation', desc: 'One of the largest U.S. conservation and wildlife-education organizations.' },
  { name: 'American Rivers', desc: 'River conservation and dam-removal advocacy.' },
  { name: 'The Conservation Fund', desc: 'Land conservation, working forests and public-private conservation finance.' },
  { name: 'Defenders of Wildlife', desc: 'Endangered-species litigation and advocacy.' },
  { name: 'Ocean Conservancy', desc: 'Ocean policy advocacy and the International Coastal Cleanup.' },
  { name: 'Surfrider Foundation', desc: 'Coastal and ocean water-quality advocacy.' },
  { name: 'Rocky Mountain Elk Foundation', desc: 'Habitat conservation funded by hunting-community membership.' },
  { name: 'National Parks Conservation Association', desc: 'Advocacy and watchdog group for the National Park System.' },
  { name: 'Appalachian Trail Conservancy', desc: 'Maintains and protects the 2,190-mile Appalachian Trail.' },
  { name: 'Earthjustice', desc: 'The largest nonprofit environmental law organization in the U.S.' },
  { name: 'League of Conservation Voters', desc: 'Scores members of Congress on environmental votes and funds pro-environment candidates.' },
  { name: '350.org', desc: 'Global grassroots climate campaign network founded around the 350 ppm CO2 target.' },
];

export const ZOOS = [
  { name: 'Wildlife Conservation Society (Bronx Zoo)', city: 'Bronx, NY' }, { name: 'San Diego Zoo Wildlife Alliance', city: 'San Diego, CA' },
  { name: 'Monterey Bay Aquarium', city: 'Monterey, CA' }, { name: 'Georgia Aquarium', city: 'Atlanta, GA' },
  { name: 'National Aquarium', city: 'Baltimore, MD' }, { name: 'Shedd Aquarium', city: 'Chicago, IL' },
  { name: 'Chicago Zoological Society (Brookfield Zoo)', city: 'Brookfield, IL' }, { name: 'Cincinnati Zoo & Botanical Garden', city: 'Cincinnati, OH' },
  { name: 'Columbus Zoo and Aquarium', city: 'Columbus, OH' }, { name: 'Denver Zoo', city: 'Denver, CO' },
  { name: 'Houston Zoo', city: 'Houston, TX' }, { name: 'Saint Louis Zoo', city: 'St. Louis, MO' },
];

export const YOUTH_ORGS = [
  { name: 'Boy Scouts of America', desc: 'Youth-development organization reorganized in 2020 bankruptcy over a national sexual-abuse settlement.' },
  { name: 'Girl Scouts of the USA', desc: 'The largest girls-only youth-development organization in the U.S.' },
  { name: 'Big Brothers Big Sisters of America', desc: 'The largest youth-mentoring network in the U.S.' },
  { name: 'National 4-H Council', desc: 'Fundraising and program arm for the land-grant-university 4-H youth-development system.' },
  { name: 'Junior Achievement USA', desc: 'In-school financial-literacy and entrepreneurship education.' },
  { name: 'Boys Town', desc: 'Residential and family-support programs for at-risk youth, based in Nebraska.' },
  { name: 'Camp Fire', desc: 'Coed youth-development organization operating camps and after-school programs nationwide.' },
];

export const DISABILITY_ORGS = [
  { name: 'The Arc of the United States', desc: 'The largest organization advocating for people with intellectual and developmental disabilities.' },
  { name: 'Special Olympics', desc: 'Year-round sports training and competition for people with intellectual disabilities.' },
  { name: 'Easterseals', desc: 'Disability services, therapy and workforce programs through a national affiliate network.' },
  { name: 'National Federation of the Blind', desc: 'The largest membership organization of blind Americans, focused on advocacy.' },
  { name: 'American Foundation for the Blind', desc: 'Research and advocacy for blindness and low vision; Helen Keller was a longtime staff member.' },
  { name: 'National Association of the Deaf', desc: 'Civil-rights advocacy for deaf and hard-of-hearing Americans.' },
  { name: 'United Cerebral Palsy', desc: 'National affiliate network providing services for people with cerebral palsy and other disabilities.' },
];

export const ADDICTION_MH_ORGS = [
  { name: 'Mental Health America', desc: "The nation's oldest mental-health advocacy and screening organization." },
  { name: 'Partnership to End Addiction', desc: 'Runs helplines and resources for families dealing with substance use.' },
  { name: 'Hazelden Betty Ford Foundation', desc: 'The largest nonprofit addiction-treatment provider in the U.S.' },
  { name: 'American Foundation for Suicide Prevention', desc: 'Funds suicide-prevention research and the 988 crisis-line advocacy.' },
];

export const LGBTQ_ORGS = [
  { name: 'Lambda Legal', desc: 'LGBTQ+ civil-rights litigation organization.' },
  { name: 'GLAAD', desc: 'Media-advocacy organization monitoring LGBTQ+ representation.' },
  { name: 'PFLAG', desc: 'The largest organization for LGBTQ+ people, their parents, families and allies.' },
  { name: 'The Trevor Project', desc: 'Crisis-intervention and suicide-prevention services for LGBTQ+ youth.' },
  { name: 'National Center for Transgender Equality', desc: 'Policy advocacy for transgender Americans.' },
];

export const IMMIGRATION_ORGS = [
  { name: 'National Immigration Law Center', desc: 'Litigation and policy advocacy for low-income immigrants.' },
  { name: 'American Immigration Council', desc: 'Legal and policy research supporting immigrants and immigration reform.' },
  { name: 'RAICES', desc: 'Texas-based immigration legal-aid organization for refugees and asylum seekers.' },
  { name: 'National Immigrant Justice Center', desc: 'Provides direct legal services to immigrants and asylum seekers.' },
];

export const BLOOD_ORGAN_ORGS = [
  { name: "America's Blood Centers", desc: 'Network of independent, community-based blood centers supplying roughly half the U.S. blood.' },
  { name: 'United Network for Organ Sharing (UNOS)', desc: 'Operates the U.S. organ-transplant waiting list under federal contract.' },
  { name: 'National Marrow Donor Program (NMDP/Be The Match)', desc: 'Operates the U.S. bone-marrow and cord-blood donor registry.' },
];

export const HOSPICE_ORGS = [
  { name: 'National Hospice and Palliative Care Organization', desc: 'The largest membership organization for hospice and palliative-care providers.' },
  { name: 'Hospice Foundation of America', desc: 'Public education and professional training on end-of-life care.' },
];

export const HISTORIC_PRESERVATION = [
  { name: 'National Trust for Historic Preservation', desc: 'Chartered by Congress in 1949; the leading U.S. preservation advocacy organization.' },
  { name: 'Colonial Williamsburg Foundation', desc: 'Operates the largest U.S. living-history museum.' },
  { name: "Mount Vernon Ladies' Association", desc: "The oldest national historic-preservation organization in the U.S.; owns and operates George Washington's estate." },
];

export const PROFESSIONAL_ASSOC = [
  { name: 'American Association for the Advancement of Science', desc: 'Publishes Science magazine; the largest general scientific society in the world.' },
  { name: 'National Academies of Sciences, Engineering, and Medicine', desc: 'Chartered by Congress in 1863 to advise the federal government on science policy.' },
  { name: 'American Chemical Society', desc: 'The largest scientific society in the world by membership.' },
  { name: 'American Psychological Association', desc: 'The leading professional association for U.S. psychologists.' },
  { name: 'American Institute of CPAs', desc: 'Sets U.S. accounting standards and administers the CPA exam.' },
  { name: 'American Society of Civil Engineers', desc: 'Publishes the influential quadrennial U.S. infrastructure report card.' },
  { name: 'American Veterinary Medical Association', desc: 'Accredits veterinary schools and lobbies on animal-health policy.' },
];

export const COMMUNITY_FOUNDATIONS2 = [
  { name: 'New York Community Trust', city: 'New York, NY' }, { name: 'Chicago Community Trust', city: 'Chicago, IL' },
  { name: 'San Francisco Foundation', city: 'San Francisco, CA' }, { name: 'The Boston Foundation', city: 'Boston, MA' },
  { name: 'Communities Foundation of Texas', city: 'Dallas, TX' }, { name: 'Houston Endowment', city: 'Houston, TX' },
  { name: 'Saint Paul & Minnesota Foundation', city: 'St. Paul, MN' }, { name: 'The Denver Foundation', city: 'Denver, CO' },
  { name: 'Seattle Foundation', city: 'Seattle, WA' }, { name: 'Miami Foundation', city: 'Miami, FL' },
  { name: 'Community Foundation for Greater Atlanta', city: 'Atlanta, GA' }, { name: 'Arizona Community Foundation', city: 'Phoenix, AZ' },
];

export const FOOD_BANKS = [
  { name: 'Los Angeles Regional Food Bank', city: 'Los Angeles, CA' }, { name: 'Greater Chicago Food Depository', city: 'Chicago, IL' },
  { name: 'Houston Food Bank', city: 'Houston, TX' }, { name: 'City Harvest', city: 'New York, NY' },
  { name: 'Food Bank For New York City', city: 'New York, NY' },
];

export const INTL_NGOS2 = [
  { name: 'Oxfam America', desc: 'U.S. affiliate of the international poverty-relief confederation.' },
  { name: 'Save the Children (U.S.)', desc: 'U.S. arm of the global child-welfare and emergency-relief organization.' },
  { name: 'UNICEF USA', desc: "Raises U.S. private funding for the UN Children's Fund." },
  { name: 'American Jewish World Service', desc: 'Jewish-community-funded international human-rights and development grantmaker.' },
  { name: 'Direct Relief', desc: 'Medical-supply relief organization for disaster and poverty response worldwide.' },
  { name: 'Heifer International', desc: 'Provides livestock and training to fight rural poverty worldwide.' },
];

// more children's hospitals from the same source list
CHILDRENS_HOSPITALS.push(
  ["Huntsville Hospital for Women and Children", 'Huntsville', 'AL'], ["Banner Children's", 'Mesa', 'AZ'],
  ["Loma Linda University Children's Hospital", 'Loma Linda', 'CA'], ["Miller Children's Hospital", 'Long Beach', 'CA'],
  ["Memorial Hospital for Children", 'Colorado Springs', 'CO'], ["Golisano Children's Hospital of Southwest Florida", 'Fort Myers', 'FL'],
  ["Holtz Children's Hospital", 'Miami', 'FL'], ["Palm Beach Children's Hospital", 'West Palm Beach', 'FL'],
  ["UF Health Shands Children's Hospital", 'Gainesville', 'FL'], ["The Children's Hospital of Illinois", 'Peoria', 'IL'],
  ["St. John's Children's Hospital", 'Springfield', 'IL'], ["Norton Children's Hospital", 'Louisville', 'KY'],
  ["The Herman & Walter Samuelson Children's Hospital at Sinai", 'Baltimore', 'MD'], ["Mt. Washington Pediatric Hospital", 'Baltimore', 'MD'],
  ["Baystate Children's Hospital", 'Springfield', 'MA'], ["UMass Memorial Children's Medical Center", 'Worcester', 'MA'],
  ["Bronson Methodist Children's Health", 'Kalamazoo', 'MI'], ["Essentia Health-St. Mary's Children's Hospital", 'Duluth', 'MN'],
  ["M Health Fairview Masonic Children's Hospital", 'Minneapolis', 'MN'], ["Mercy Kids Children's Hospital St. Louis", 'St. Louis', 'MO'],
  ["University of Missouri Women's and Children's Hospital", 'Columbia', 'MO'], ["Children's Hospital of Nevada", 'Las Vegas', 'NV'],
  ["Children's Hospital of New Jersey", 'Newark', 'NJ'], ["Children's Regional Hospital at Cooper", 'Camden', 'NJ'],
  ["Joseph M. Sanzari Children's Hospital", 'Hackensack', 'NJ'], ["Komansky Center for Children's Health", 'New York', 'NY'],
  ["Kravis Children's Hospital", 'New York', 'NY'], ["Maria Fareri Children's Hospital", 'Valhalla', 'NY'],
  ["Morgan Stanley Children's Hospital", 'New York', 'NY'], ["Upstate Golisano Children's Hospital", 'Syracuse', 'NY'],
  ["Golisano Children's Hospital of Buffalo", 'Buffalo', 'NY'], ["Hemby Children's Hospital", 'Charlotte', 'NC'],
  ["Maynard Children's Hospital", 'Greenville', 'NC'], ["Cleveland Clinic Children's Hospital", 'Cleveland', 'OH'],
  ["Toledo Children's Hospital", 'Toledo', 'OH'], ["The Children's Hospital at Saint Francis", 'Tulsa', 'OK'],
  ["Janet Weis Children's Hospital", 'Danville', 'PA'], ["Lehigh Valley Reilly Children's Hospital", 'Allentown', 'PA'],
  ["Women & Infants Hospital of Rhode Island", 'Providence', 'RI'], ["Prisma Health Children's Hospital–Midlands", 'Columbia', 'SC'],
  ["Niswonger Children's Hospital", 'Johnson City', 'TN'], ["Children's Memorial Hermann Hospital", 'Houston', 'TX'],
  ["Covenant Children's Hospital", 'Lubbock', 'TX'], ["Medical City Children's Hospital", 'Dallas', 'TX'],
  ["Methodist Children's Hospital", 'San Antonio', 'TX'], ["McLane Children's Hospital", 'Temple', 'TX'],
  ["Texas Scottish Rite Hospital for Children", 'Dallas', 'TX'], ["University of Virginia Children's Hospital", 'Charlottesville', 'VA'],
);
// more PBS member stations
PBS_STATIONS.push(
  ['KUAC-TV', 'Fairbanks'], ['AZPM', 'Tucson'], ['KIXE-TV', 'Chico–Redding'], ['KVIE', 'Sacramento'],
  ['KBDI-TV', 'Denver'], ['WUFT News', 'Gainesville'], ['South Florida PBS (WXEL)', 'West Palm Beach'],
  ['WSIU-TV', 'Carbondale'], ['WQPT-TV', 'Moline'], ['WTVP', 'Peoria'], ['WTIU', 'Bloomington'],
  ['PBS Fort Wayne (WFWA)', 'Fort Wayne'], ['Michiana PBS (WNIT)', 'South Bend'], ['Smoky Hills PBS', 'Hays'],
  ['WKU PBS', 'Bowling Green'], ['New England Public Media', 'Springfield'], ['WGVU Public Media', 'Grand Rapids'],
  ['Pioneer PBS', 'Granite Falls'], ['Lakeland PBS', 'Bemidji'], ['PBS North', 'Duluth'],
  ['Ozarks Public Television', 'Springfield'], ['KMOS-TV', 'Jefferson City'], ['PBS Reno (KNPB)', 'Reno'],
  ['WSKG-TV', 'Binghamton'], ['Mountain Lake PBS', 'Plattsburgh'], ['WPBS-TV', 'Watertown'],
  ['PBS Western Reserve', 'Akron'], ['WOUB-TV', 'Athens'], ['WBGU-TV', 'Bowling Green'],
  ['WCET', 'Cincinnati'], ['PBS 39 (WLVT)', 'Allentown'], ['WQLN', 'Erie'], ['WVIA-TV', 'Scranton'],
  ['WPSU-TV', 'State College'], ['WTCI', 'Chattanooga'], ['West TN PBS (WLJT)', 'Jackson'],
  ['East Tennessee PBS', 'Knoxville'], ['WCTE', 'Cookeville'], ['Panhandle PBS', 'Amarillo'],
  ['KAMU-TV', 'Bryan–College Station'], ['KEDT', 'Corpus Christi'], ['PBS El Paso (KCOS)', 'El Paso'],
  ['Texas Tech Public Media', 'Lubbock'], ['Basin PBS', 'Midland–Odessa'], ['Blue Ridge PBS', 'Roanoke'],
  ['Northwest Public Broadcasting', 'Richland'], ['KBTC-TV', 'Tacoma'],
);

export const SCIENCE_HISTORY_MUSEUMS = [
  { name: 'American Museum of Natural History', city: 'New York, NY' }, { name: 'Field Museum of Natural History', city: 'Chicago, IL' },
  { name: 'California Academy of Sciences', city: 'San Francisco, CA' }, { name: 'Museum of Science, Boston', city: 'Boston, MA' },
  { name: 'Exploratorium', city: 'San Francisco, CA' }, { name: 'The National WWII Museum', city: 'New Orleans, LA' },
  { name: 'The Henry Ford', city: 'Dearborn, MI' }, { name: 'Franklin Institute', city: 'Philadelphia, PA' },
];

export const LEGAL_AID_ORGS = [
  { name: 'Legal Services Corporation', desc: 'Federally funded nonprofit that channels Congressional appropriations to local civil legal-aid programs nationwide.' },
  { name: 'Legal Aid Society (NYC)', desc: "The nation's oldest and largest provider of free legal services to low-income New Yorkers." },
  { name: 'Equal Justice Initiative', desc: 'Alabama-based criminal-justice-reform and wrongful-conviction litigation organization; runs the National Memorial for Peace and Justice.' },
  { name: 'National Legal Aid & Defender Association', desc: 'Umbrella membership organization for public defenders and civil legal-aid programs.' },
];

export const ANIMAL_WELFARE2 = [
  { name: 'Best Friends Animal Society', desc: 'No-kill animal-shelter advocacy and the largest no-kill sanctuary in the U.S.' },
  { name: 'American Humane', desc: 'Certifies "no animals were harmed" in film production and funds animal-welfare programs.' },
  { name: 'Farm Sanctuary', desc: 'Farm-animal rescue and factory-farming advocacy organization.' },
];

DISEASE_CHARITIES.push(
  { name: 'National Breast Cancer Foundation', desc: 'Funds free mammograms and breast-health education.' },
  { name: 'Prostate Cancer Foundation', desc: 'The largest funder of prostate-cancer research philanthropy in the world.' },
  { name: 'Colorectal Cancer Alliance', desc: 'Screening advocacy and patient support for colorectal cancer.' },
  { name: 'National Psoriasis Foundation', desc: 'Research funding and advocacy for psoriasis and psoriatic arthritis.' },
  { name: 'Lupus Foundation of America', desc: 'Research funding and patient support for lupus.' },
  { name: "Huntington's Disease Society of America", desc: "Support and research funding for Huntington's disease families." },
  { name: 'Cure SMA', desc: 'Research funding for spinal muscular atrophy; helped drive newborn-screening mandates.' },
  { name: 'National Eating Disorders Association', desc: 'The largest nonprofit for eating-disorder support and advocacy.' },
  { name: 'American Heart Association Go Red for Women', desc: 'Women’s cardiovascular-health initiative of the American Heart Association.' },
  { name: 'Michael J. Fox-adjacent: Parkinson\'s Foundation', desc: 'Funds Parkinson’s research and operates a national helpline, distinct from the Michael J. Fox Foundation.' },
);

LAND_TRUSTS.push(
  { name: 'Environmental Working Group', desc: 'Consumer-facing research and advocacy on pesticides, chemicals and water quality.' },
  { name: 'Union of Concerned Scientists', desc: 'Science-based advocacy on climate, food and nuclear-weapons policy.' },
  { name: 'Center for Biological Diversity', desc: 'Litigation-heavy endangered-species advocacy group.' },
  { name: 'Waterkeeper Alliance', desc: 'Global network of local water-quality watchdog groups.' },
  { name: 'American Forests', desc: 'The oldest national conservation organization in the U.S., focused on forest restoration.' },
  { name: 'Izaak Walton League of America', desc: 'Sportsmen’s conservation organization founded in 1922.' },
);

COMMUNITY_FOUNDATIONS2.push(
  { name: 'Oregon Community Foundation', city: 'Portland, OR' }, { name: 'Greater Milwaukee Foundation', city: 'Milwaukee, WI' },
  { name: 'The Columbus Foundation', city: 'Columbus, OH' }, { name: 'The Pittsburgh Foundation', city: 'Pittsburgh, PA' },
  { name: 'Baltimore Community Foundation', city: 'Baltimore, MD' }, { name: 'Vermont Community Foundation', city: 'Middlebury, VT' },
  { name: 'Maine Community Foundation', city: 'Ellsworth, ME' }, { name: 'Hawai\'i Community Foundation', city: 'Honolulu, HI' },
);

FOOD_BANKS.push(
  { name: 'Second Harvest Heartland', city: 'Minneapolis, MN' }, { name: 'Feeding South Florida', city: 'Pembroke Park, FL' },
  { name: 'San Antonio Food Bank', city: 'San Antonio, TX' }, { name: 'Central Texas Food Bank', city: 'Austin, TX' },
  { name: 'Food Bank of the Rockies', city: 'Denver, CO' },
);

INTL_NGOS2.push(
  { name: 'Partners In Health', desc: 'Delivers health care in poor communities worldwide, co-founded by Paul Farmer.' },
  { name: 'GiveDirectly', desc: 'Sends unconditional cash transfers directly to people living in extreme poverty.' },
  { name: 'Human Rights Watch', desc: 'Investigates and reports on human-rights abuses worldwide.' },
  { name: 'Amnesty International USA', desc: 'U.S. section of the global human-rights advocacy movement.' },
);

PROFESSIONAL_ASSOC.push(
  { name: 'American Library Association', desc: 'Sets library-science standards and tracks book-challenge and censorship trends.' },
  { name: 'American Institute of Architects', desc: 'The main professional association for licensed U.S. architects.' },
  { name: 'Association of American Medical Colleges', desc: 'Represents U.S. medical schools and teaching hospitals; runs the med-school application system.' },
  { name: 'American Public Health Association', desc: 'The oldest and largest organization of public-health professionals in the world.' },
);

FOUNDATIONS2.push(
  { name: 'Surdna Foundation', endowment: 1e9, grants: 0.05e9, desc: 'Family foundation funding sustainable communities and racial-equity programs.' },
  { name: 'William Penn Foundation', endowment: 3e9, grants: 0.1e9, desc: 'Funds Philadelphia-region education, environment and arts programs.' },
  { name: 'McKnight Foundation', endowment: 3e9, grants: 0.1e9, desc: 'Minnesota family foundation funding climate, arts and Midwest agriculture.' },
  { name: 'Ewing Marion Kauffman Foundation', endowment: 3e9, grants: 0.1e9, desc: 'Funds entrepreneurship research and Kansas City education programs.' },
  { name: 'Barr Foundation', endowment: 2e9, grants: 0.1e9, desc: 'Boston-focused foundation funding climate, education and the arts.' },
);

// Elite private research universities: real, stable endowment figures (huge power-map-relevant "funding").
export const UNIVERSITIES2 = [
  { name: 'Harvard University', endowment: 53e9, desc: 'The oldest and wealthiest U.S. university by endowment.' },
  { name: 'Yale University', endowment: 41e9, desc: 'Ivy League research university with one of the largest endowments in the world.' },
  { name: 'Stanford University', endowment: 36e9, desc: 'Major private research university and a hub of Silicon Valley talent and funding.' },
  { name: 'Princeton University', endowment: 34e9, desc: 'Ivy League university with the highest endowment per student in the U.S.' },
  { name: 'MIT', endowment: 24e9, desc: 'Leading engineering and science research university.' },
  { name: 'University of Pennsylvania', endowment: 21e9, desc: 'Ivy League university anchoring Philadelphia’s biotech and finance talent pipeline.' },
  { name: 'Columbia University', endowment: 14e9, desc: 'Ivy League university in New York City; a major recipient of federal research funding.' },
  { name: 'Cornell University', endowment: 10e9, desc: 'Ivy League university combining private and New York State land-grant colleges.' },
  { name: 'Duke University', endowment: 12e9, desc: 'Major private research university anchoring North Carolina’s Research Triangle.' },
  { name: 'Northwestern University', endowment: 14e9, desc: 'Major private research university near Chicago.' },
  { name: 'University of Chicago', endowment: 10e9, desc: 'Major private research university known for economics and law scholarship.' },
  { name: 'Johns Hopkins University', endowment: 13e9, desc: 'The largest U.S. recipient of federal research funding; also a major hospital system operator.' },
];
