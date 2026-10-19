import { coordinates, distance } from './core.js';

export const countryLanguages = { FR: 'fr', SE: 'sv', MC: 'fr', JO: 'ar', PT: 'pt', ES: 'es', DE: 'de', IT: 'it', GR: 'el', TR: 'tr', JP: 'ja', NO: 'no', DK: 'da', FI: 'fi', NL: 'nl', PL: 'pl', CZ: 'cs', GB: 'en', US: 'en', IE: 'en', CA: 'en', CH: 'de', AT: 'de', BE: 'fr', MA: 'ar', TN: 'ar', EG: 'ar', IS: 'is', HR: 'hr', CN: 'zh', TH: 'th', VN: 'vi', IN: 'en' };
const languages = new Set(['fr', 'en', ...Object.values(countryLanguages)]);
const normalize = text => String(text || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

export function countryCode(country, explicit = '') {
  if (/^[a-z]{2}$/i.test(explicit)) return explicit.toUpperCase();
  if (/^[a-z]{2}$/i.test(country)) return country.toUpperCase();
  for (const lang of ['fr', 'en', 'sv', 'ar', 'pt', 'de', 'it', 'es']) {
    const names = new Intl.DisplayNames([lang], { type: 'region' });
    for (const code of Object.keys(countryLanguages)) if (normalize(names.of(code)) === normalize(country)) return code;
  }
  return '';
}

export function suggestedLanguage(place) {
  return countryLanguages[countryCode(place.country, place.countryCode)] || 'en';
}

export function wikipediaLink(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && /^[a-z-]+\.wikipedia\.org$/.test(u.hostname) ? u.href : null; } catch { return null; }
}

export async function findArticles(query, language = 'fr', request = fetch) {
  if (!languages.has(language)) throw new Error('Langue non prise en charge.');
  if (!query.trim()) throw new Error('Précisez le nom du lieu.');
  const url = new URL(`https://${language}.wikipedia.org/w/api.php`);
  url.search = new URLSearchParams({ action: 'query', format: 'json', origin: '*', generator: 'search', gsrsearch: query.trim(), gsrnamespace: '0', gsrlimit: '5', prop: 'extracts|info|coordinates|langlinks', colimit: '1', coprimary: 'primary', lllimit: 'max', exintro: '1', explaintext: '1', exchars: '1000', inprop: 'url' });
  const response = await request(url.href, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error('Wikipédia est indisponible. Vous pouvez saisir un descriptif manuellement.');
  const data = await response.json();
  if (data.error) throw new Error('La recherche Wikipédia a échoué.');
  return Object.values(data.query?.pages || {}).filter(p => p.extract && wikipediaLink(p.fullurl)).sort((a, b) => a.index - b.index).map(p => ({ title: p.title, description: p.extract, sourceURL: wikipediaLink(p.fullurl), location: coordinates(p.coordinates?.[0]?.lat, p.coordinates?.[0]?.lon), translations: p.langlinks || [], language }));
}

export async function findPlaceArticles(place, language = 'auto', request = fetch) {
  if (!place.country?.trim()) throw new Error('Précisez le pays du lieu avant de rechercher une fiche.');
  if (!place.city?.trim()) throw new Error('Précisez la ville du lieu pour distinguer les homonymes.');
  const localLanguage = suggestedLanguage(place), code = countryCode(place.country, place.countryCode);
  const selected = language === 'auto' ? localLanguage : language;
  const localizedCountry = code ? new Intl.DisplayNames([selected], { type: 'region' }).of(code) : place.country;
  const query = [...new Set([place.localName || place.name, place.city, localizedCountry].filter(Boolean))].join(' ');
  const candidates = await findArticles(query, selected, request);
  const position = coordinates(place.lat, place.lng);
  // A matching name alone never authorizes a fiche from another country.
  const checked = candidates.flatMap(article => {
    const km = position && article.location ? distance(position, article.location) : null;
    return km !== null && km > 25 ? [] : [{ ...article, km, verifiedLocation: km !== null, query }];
  });
  if (checked.length || language !== 'auto' || selected === 'fr') return checked;
  // A French name may only exist on French Wikipedia. Read real interlanguage
  // titles from that page rather than inventing a local translation.
  const french = await findArticles([place.name, place.city, place.country].filter(Boolean).join(' '), 'fr', request);
  const valid = french.filter(a => !position || !a.location || distance(position, a.location) <= 25);
  const linked = valid.find(a => a.location && position && distance(position, a.location) <= 25)?.translations.find(t => t.lang === localLanguage);
  if (linked?.['*']) {
    const translated = await findArticles([linked['*'], place.city, localizedCountry].filter(Boolean).join(' '), localLanguage, request);
    const nearby = translated.filter(a => !position || !a.location || distance(position, a.location) <= 25);
    if (nearby.length) return nearby.map(a => ({ ...a, km: position && a.location ? distance(position, a.location) : null, verifiedLocation: Boolean(position && a.location) }));
  }
  return valid.map(a => ({ ...a, km: position && a.location ? distance(position, a.location) : null, verifiedLocation: Boolean(position && a.location) }));
}
