// Drapeaux locaux country-flag-icons (MIT), sans requête externe.
const codes = new Set('AC AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BQ-BO BQ-SA BQ-SE BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ES-CT ET EU FI FJ FK FM FO FR GA GB GB-ENG GB-NIR GB-SCT GB-WLS GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU IC ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TA TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XA XC XK XO YE YT ZA ZM ZW'.split(' ').filter(code => /^[A-Z]{2}$/.test(code)));
const normalize = value => String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^\p{Letter}\p{Number}]/gu, '');
const names = new Map();
for (const locale of ['fr', 'en', 'sv', 'de', 'es', 'it', 'pt', 'ja', 'ar']) {
  const display = new Intl.DisplayNames([locale], { type: 'region' });
  for (const code of codes) names.set(normalize(display.of(code)), code);
}
for (const [name, code] of Object.entries({ usa: 'US', uk: 'GB', angleterre: 'GB', suede: 'SE', coreedusud: 'KR', coreedunord: 'KP', tchequie: 'CZ' })) names.set(name, code);
export function flagCode(country) {
  const value = String(country || '').trim();
  const code = value.toUpperCase();
  return codes.has(code) ? code : names.get(normalize(value)) || null;
}
export function flagMarkup(country) {
  const code = flagCode(country);
  // Le pays est déjà écrit à côté : l’image est décorative.
  return code ? `<img class="country-flag" src="${new URL(`../vendor/flags/${code}.svg`, import.meta.url).href}" alt="" width="27" height="18">` : '';
}
