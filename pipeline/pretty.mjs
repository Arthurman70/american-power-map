// Title-cases the SHOUTING names EDGAR and 13F use ("CAPITAL ONE FINANCIAL CORP" -> "Capital One Financial Corp")
// while leaving genuine short acronyms ("CVS", "TJX", "AT&T") alone.
const SHORT_WORDS = new Set('INC CO LTD THE OF AND DE MAE MAC ONE TWO NEW OLD BIG RED SUN SEA AIR GAS OIL BAY BOX CAR DAY END EYE FAR FUN GO HOT ICE JET KEY LAB LAW LOW MAN MAX NET NOW OAK OUT PAY PET PRO RAY ROW RUN SET SKY SPA TAX TEA TOP TOY VAN WAY WEB WIN ZIP MED BIO ECO ART INN AID ACE ALL ARC BAR BED BEE BUS CAP CAT CUT DOG DOT DRY DUE EAT FAN FIT FIX FLY FOX GEM GYM HAT HUB JOY KID LAY LED LOT MAP MIX NUT OWL PAD PAN PEN PIE PIN POP POT PUB RAM RIB ROD SAW SEE SIT SON TAB TAG TAN TIP TON TUB VET WAX WET ZEN I A AN AS AT BY DO IN IS IT MY NO ON OR SO TO UP US WE FOR OUR YOU NOT ACT ARE BUT CAN GET HAS HER HIS HOW ITS LET MAY OFF OWN PER PUT SAY SHE TOO USE WAS WHO WHY YES YET WAR AGE ERA LIFE'.split(' '));
const SLASH_SUFFIX = /\s*\/[A-Z ]*\/?\s*$/;
const BACKSLASH_TAG = /\\[A-Z ]*\\/g;
function titleWord(w) {
  const lw = w.toLowerCase();
  return lw.replace(/(^|[-'&.])([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/^Mc([a-z])/, (m, a) => 'Mc' + a.toUpperCase());
}
export function prettyName(s) {
  s = String(s || '').replace(SLASH_SUFFIX, '').replace(BACKSLASH_TAG, ' ').trim();
  return s.split(/\s+/).filter(Boolean).map(w => {
    if (w !== w.toUpperCase()) return w;                                        // already mixed case
    if (/^[A-Z]{1,2}&[A-Z]{1,2}$/.test(w)) return w;                                // AT&T, S&P
    if (w.length <= 3 && !SHORT_WORDS.has(w) && /^[A-Z0-9&.-]+$/.test(w)) return w; // acronym
    return titleWord(w);
  }).join(' ');
}
// People's names have no acronyms ("JIM C. WALTON" -> "Jim C. Walton", not "JIM"), and generational suffixes go last
// ("JOHN L. III NAU" -> "John L. Nau III", "ROSS JR. PEROT" -> "Ross Perot Jr.").
export function personName(s) {
  const out = [], suffix = [];
  for (const w of String(s || '').split(/\s+/).filter(Boolean)) {
    if (/^(II|III|IV)$/i.test(w)) suffix.push(w.toUpperCase());
    else if (/^(JR|SR)\.?,?$/i.test(w)) suffix.push(w[0].toUpperCase() + w[1].toLowerCase() + '.');
    else out.push(w === w.toUpperCase() && /[A-Z]{2}/.test(w) ? titleWord(w) : w);
  }
  return [...out, ...suffix].join(' ');
}
