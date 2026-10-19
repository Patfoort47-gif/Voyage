export function wikipediaLink(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && /^[a-z-]+\.wikipedia\.org$/.test(u.hostname) ? u.href : null; } catch { return null; }
}

export async function findArticles(query, language = 'fr', request = fetch) {
  if (!['fr', 'en'].includes(language)) throw new Error('Langue non prise en charge.');
  if (!query.trim()) throw new Error('Précisez le nom du lieu.');
  const url = new URL(`https://${language}.wikipedia.org/w/api.php`);
  url.search = new URLSearchParams({ action: 'query', format: 'json', origin: '*', generator: 'search', gsrsearch: query.trim(), gsrnamespace: '0', gsrlimit: '3', prop: 'extracts|info', exintro: '1', explaintext: '1', exchars: '1000', inprop: 'url' });
  const response = await request(url.href, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error('Wikipédia est indisponible. Vous pouvez saisir un descriptif manuellement.');
  const data = await response.json();
  if (data.error) throw new Error('La recherche Wikipédia a échoué.');
  return Object.values(data.query?.pages || {}).filter(p => p.extract && wikipediaLink(p.fullurl)).sort((a, b) => a.index - b.index).map(p => ({ title: p.title, description: p.extract, sourceURL: wikipediaLink(p.fullurl) }));
}
